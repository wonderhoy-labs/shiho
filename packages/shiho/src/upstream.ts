/// <reference path="./direct-sockets.d.ts" />

import type {
	ReadGate,
	Upstream,
	UpstreamConnector,
	UpstreamDetails,
	UpstreamStream,
	UpstreamStreamEvents,
} from "@wonderhoy-labs/shira";
import { UpstreamError } from "@wonderhoy-labs/shira";

/** Wisp's stream types, which is what the phone's CONNECT carries. */
const STREAM_TCP = 0x01;
const STREAM_UDP = 0x02;

/** Wisp's close reasons. */
export const CLOSE_VOLUNTARY = 0x02;
export const CLOSE_NETWORK_ERROR = 0x03;
export const CLOSE_UNREACHABLE = 0x42;

/** Packets a TCP stream can take from the phone before it hears how far the socket has got. */
const DEFAULT_CREDITS = 128;

/** The socket classes, which only an Isolated Web App has. Tests bring their own. */
export interface SocketClasses {
	TCPSocket: typeof TCPSocket;
	UDPSocket: typeof UDPSocket;
}

/** How a Direct Sockets upstream behaves. */
export interface DirectSocketsOptions {
	/** What the phone shows as where its traffic goes. "your computer" by default. */
	label?: string;
	/** Packets each TCP stream can take from the phone ahead of the socket. 128 by default. */
	credits?: number;
	/** The socket classes to use instead of the browser's own. */
	sockets?: SocketClasses;
}

/** Whether this page can open sockets itself, which only an Isolated Web App that's allowed to can. */
export function isDirectSocketsAvailable(): boolean {
	return typeof (globalThis as { TCPSocket?: unknown }).TCPSocket === "function";
}

function browserSockets(): SocketClasses {
	const scope = globalThis as { TCPSocket?: typeof TCPSocket; UDPSocket?: typeof UDPSocket };
	if (!scope.TCPSocket || !scope.UDPSocket) {
		throw new UpstreamError(
			"This page can't open connections itself. Install Shiho as an Isolated Web App, and open it from there.",
			true,
		);
	}
	return { TCPSocket: scope.TCPSocket, UDPSocket: scope.UDPSocket };
}

/** Keeps the count of bytes the phone has sent that haven't gone out yet, for every stream together. */
class Unsent {
	bytes = 0;
}

/** One of the phone's TCP connections, as a socket on this computer. */
class TcpStream implements UpstreamStream {
	private writer: WritableStreamDefaultWriter<BufferSource> | null = null;
	private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
	/** What the phone sent before the socket opened. */
	private early: Uint8Array[] = [];
	/** Packets accepted from the phone that the socket hasn't taken yet. */
	private pending = 0;
	/** Packets the socket has taken since the phone last heard how many more it can send. */
	private written = 0;
	private ended = false;

	constructor(
		private readonly socket: TCPSocket,
		private readonly events: UpstreamStreamEvents,
		private readonly credits: number,
		private readonly gate: ReadGate,
		private readonly unsent: Unsent,
	) {
		socket.opened.then(
			({ readable, writable }) => {
				if (this.ended) {
					void socket.close().catch(() => undefined);
					return;
				}
				this.writer = writable.getWriter();
				this.reader = readable.getReader();
				for (const data of this.early) this.write(data);
				this.early = [];
				void this.pump();
			},
			() => this.end(CLOSE_UNREACHABLE),
		);
	}

	send(data: Uint8Array) {
		if (this.ended) return;
		this.pending++;
		this.unsent.bytes += data.length;
		if (this.writer) this.write(data);
		else this.early.push(data);
	}

	close(_reason: number) {
		if (this.ended) return;
		this.ended = true;
		this.shutDown();
	}

	private write(data: Uint8Array) {
		const writer = this.writer;
		if (!writer) return;
		const done = () => {
			this.pending--;
			this.unsent.bytes -= data.length;
			this.written++;
			// Like a Wisp server, say how much room there is once a fair amount has gone, or everything has.
			if (!this.ended && (this.pending === 0 || this.written >= this.credits / 2)) {
				this.written = 0;
				this.events.onContinue(this.credits - this.pending);
			}
		};
		writer.write(data as Uint8Array<ArrayBuffer>).then(done, () => {
			done();
			this.end(CLOSE_NETWORK_ERROR);
		});
	}

	private async pump() {
		const reader = this.reader;
		if (!reader) return;
		try {
			while (!this.ended) {
				const { value, done } = await reader.read();
				if (done) break;
				if (value.length > 0) this.events.onData(value);
				const wait = this.gate();
				if (wait) await wait;
			}
			this.end(CLOSE_VOLUNTARY);
		} catch {
			this.end(CLOSE_NETWORK_ERROR);
		}
	}

	/** The far end or the socket closed it. */
	private end(reason: number) {
		if (this.ended) return;
		this.ended = true;
		this.events.onClose(reason);
		this.shutDown();
	}

	/** Sends what's waiting, then closes, without telling the phone. */
	private shutDown() {
		for (const data of this.early) this.unsent.bytes -= data.length;
		this.early = [];
		const writer = this.writer;
		const reader = this.reader;
		this.writer = null;
		this.reader = null;
		const closeSocket = () => void this.socket.close().catch(() => undefined);
		void reader?.cancel().catch(() => undefined);
		if (writer) writer.close().then(closeSocket, closeSocket);
		else closeSocket();
	}
}

/** One of the phone's UDP flows, as a connected UDP socket on this computer. */
class UdpStream implements UpstreamStream {
	private writer: WritableStreamDefaultWriter<UDPMessage> | null = null;
	private reader: ReadableStreamDefaultReader<UDPMessage & { data: Uint8Array }> | null = null;
	private early: Uint8Array[] = [];
	private ended = false;

	constructor(
		private readonly socket: UDPSocket,
		private readonly events: UpstreamStreamEvents,
		private readonly gate: ReadGate,
	) {
		socket.opened.then(
			({ readable, writable }) => {
				if (this.ended) {
					void socket.close().catch(() => undefined);
					return;
				}
				this.writer = writable.getWriter();
				this.reader = readable.getReader();
				for (const data of this.early) this.send(data);
				this.early = [];
				void this.pump();
			},
			() => this.end(CLOSE_UNREACHABLE),
		);
	}

	send(data: Uint8Array) {
		if (this.ended) return;
		if (!this.writer) {
			this.early.push(data);
			return;
		}
		// A datagram that can't go is lost, as UDP's are.
		this.writer.write({ data: data as Uint8Array<ArrayBuffer> }).catch(() => undefined);
	}

	close(_reason: number) {
		if (this.ended) return;
		this.ended = true;
		this.shutDown();
	}

	private async pump() {
		const reader = this.reader;
		if (!reader) return;
		try {
			while (!this.ended) {
				const { value, done } = await reader.read();
				if (done) break;
				this.events.onData(value.data);
				const wait = this.gate();
				if (wait) await wait;
			}
			this.end(CLOSE_VOLUNTARY);
		} catch {
			this.end(CLOSE_NETWORK_ERROR);
		}
	}

	private end(reason: number) {
		if (this.ended) return;
		this.ended = true;
		this.events.onClose(reason);
		this.shutDown();
	}

	private shutDown() {
		this.early = [];
		const reader = this.reader;
		const writer = this.writer;
		this.reader = null;
		this.writer = null;
		void reader?.cancel().catch(() => undefined);
		void writer?.close().catch(() => undefined);
		void this.socket.close().catch(() => undefined);
	}
}

class DirectSocketsUpstream implements Upstream {
	readonly udp = true;
	readonly details: UpstreamDetails = { wispVersion: 0, message: null };
	/** Sockets on this computer don't go away all at once the way a server can. */
	readonly lost = new Promise<void>(() => undefined);
	private readonly unsent = new Unsent();
	private readonly streams = new Set<UpstreamStream>();

	constructor(
		private readonly sockets: SocketClasses,
		private readonly gate: ReadGate,
		readonly label: string,
		readonly credits: number,
	) {}

	get unsentBytes(): number {
		return this.unsent.bytes;
	}

	openStream(host: string, port: number, streamType: number, events: UpstreamStreamEvents): UpstreamStream {
		const tracked: UpstreamStreamEvents = {
			onData: events.onData,
			onContinue: events.onContinue,
			onClose: (reason) => {
				this.streams.delete(stream);
				events.onClose(reason);
			},
		};
		let stream: UpstreamStream;
		if (streamType === STREAM_TCP) {
			const socket = new this.sockets.TCPSocket(host, port, { noDelay: true });
			stream = new TcpStream(socket, tracked, this.credits, this.gate, this.unsent);
		} else if (streamType === STREAM_UDP) {
			const socket = new this.sockets.UDPSocket({ remoteAddress: host, remotePort: port });
			stream = new UdpStream(socket, tracked, this.gate);
		} else {
			throw new Error(`Unknown stream type ${streamType}`);
		}
		const close = stream.close.bind(stream);
		stream.close = (reason) => {
			this.streams.delete(stream);
			close(reason);
		};
		this.streams.add(stream);
		return stream;
	}

	close() {
		const streams = [...this.streams];
		this.streams.clear();
		for (const stream of streams) stream.close(CLOSE_VOLUNTARY);
	}
}

/**
 * Opens the phone's connections from this computer with Direct Sockets, so the phone shares the computer's network
 * with no server in between. Give it to ShiraLink as its `upstream`. It only works in an Isolated Web App whose
 * manifest allows `direct-sockets` (and `direct-sockets-private` for addresses on the local network).
 */
export function directSocketsUpstream(options: DirectSocketsOptions = {}): UpstreamConnector {
	return {
		connect: async (gate: ReadGate) =>
			new DirectSocketsUpstream(
				options.sockets ?? browserSockets(),
				gate,
				options.label ?? "your computer",
				options.credits ?? DEFAULT_CREDITS,
			),
	};
}
