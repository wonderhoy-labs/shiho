import type { UpstreamStreamEvents } from "@wonderhoy-labs/shira";
import { describe, expect, it } from "vitest";
import { CLOSE_UNREACHABLE, CLOSE_VOLUNTARY, directSocketsUpstream, type SocketClasses } from "./upstream";

/** A socket whose far end the test plays. */
class FakeTcp {
	static last: FakeTcp | null = null;
	static refuse = false;
	readonly written: Uint8Array[] = [];
	closedSocket = false;
	private controller!: ReadableStreamDefaultController<Uint8Array>;
	readonly opened: Promise<TCPSocketOpenInfo>;
	readonly closed = new Promise<void>(() => undefined);

	constructor(
		readonly host: string,
		readonly port: number,
	) {
		FakeTcp.last = this;
		const readable = new ReadableStream<Uint8Array>({
			start: (controller) => {
				this.controller = controller;
			},
		});
		const writable = new WritableStream<BufferSource>({
			write: (chunk) => {
				this.written.push(new Uint8Array(chunk as Uint8Array));
			},
		});
		this.opened = FakeTcp.refuse
			? Promise.reject(new Error("refused"))
			: Promise.resolve({
					readable,
					writable,
					remoteAddress: host,
					remotePort: port,
					localAddress: "",
					localPort: 0,
				});
	}

	receive(bytes: number[]) {
		this.controller.enqueue(new Uint8Array(bytes));
	}

	hangUp() {
		this.controller.close();
	}

	close() {
		this.closedSocket = true;
		return Promise.resolve();
	}
}

class FakeUdp {
	static last: FakeUdp | null = null;
	readonly sent: Uint8Array[] = [];
	private controller!: ReadableStreamDefaultController<UDPMessage & { data: Uint8Array }>;
	readonly opened: Promise<UDPSocketOpenInfo>;
	readonly closed = new Promise<void>(() => undefined);

	constructor(readonly options: UDPSocketOptions) {
		FakeUdp.last = this;
		const readable = new ReadableStream<UDPMessage & { data: Uint8Array }>({
			start: (controller) => {
				this.controller = controller;
			},
		});
		const writable = new WritableStream<UDPMessage>({
			write: (message) => {
				this.sent.push(new Uint8Array(message.data as Uint8Array));
			},
		});
		this.opened = Promise.resolve({ readable, writable, localAddress: "", localPort: 0 });
	}

	receive(bytes: number[]) {
		this.controller.enqueue({ data: new Uint8Array(bytes) });
	}

	close() {
		return Promise.resolve();
	}
}

const sockets = { TCPSocket: FakeTcp, UDPSocket: FakeUdp } as unknown as SocketClasses;
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

function recorder() {
	const log = { data: [] as number[][], continues: [] as number[], closes: [] as (number | null)[] };
	const events: UpstreamStreamEvents = {
		onData: (data) => log.data.push([...data]),
		onContinue: (credits) => log.continues.push(credits),
		onClose: (reason) => log.closes.push(reason),
	};
	return { log, events };
}

describe("directSocketsUpstream", () => {
	it("says what it is", async () => {
		const upstream = await directSocketsUpstream({ sockets, credits: 8 }).connect(() => undefined);
		expect(upstream.credits).toBe(8);
		expect(upstream.udp).toBe(true);
		expect(upstream.label).toBe("your computer");
		expect(upstream.details.wispVersion).toBe(0);
	});

	it("carries a TCP stream both ways, and gives credit back as it goes", async () => {
		FakeTcp.refuse = false;
		const upstream = await directSocketsUpstream({ sockets, credits: 4 }).connect(() => undefined);
		const { log, events } = recorder();
		const stream = upstream.openStream("1.1.1.1", 53, 0x01, events);
		const socket = FakeTcp.last as FakeTcp;
		expect([socket.host, socket.port]).toEqual(["1.1.1.1", 53]);

		// Before it's open, and after.
		stream.send(new Uint8Array([1]));
		expect(upstream.unsentBytes).toBe(1);
		await settle();
		stream.send(new Uint8Array([2, 3]));
		await settle();
		expect(socket.written.map((chunk) => [...chunk])).toEqual([[1], [2, 3]]);
		expect(upstream.unsentBytes).toBe(0);
		expect(log.continues.at(-1)).toBe(4);

		socket.receive([9, 8]);
		await settle();
		expect(log.data).toEqual([[9, 8]]);

		socket.hangUp();
		await settle();
		expect(log.closes).toEqual([CLOSE_VOLUNTARY]);
		await settle();
		expect(socket.closedSocket).toBe(false);
	});

	it("tells the phone when a connection can't be made", async () => {
		FakeTcp.refuse = true;
		const upstream = await directSocketsUpstream({ sockets }).connect(() => undefined);
		const { log, events } = recorder();
		upstream.openStream("10.0.0.1", 80, 0x01, events);
		await settle();
		expect(log.closes).toEqual([CLOSE_UNREACHABLE]);
		FakeTcp.refuse = false;
	});

	it("stays quiet when the phone closes a stream", async () => {
		const upstream = await directSocketsUpstream({ sockets }).connect(() => undefined);
		const { log, events } = recorder();
		const stream = upstream.openStream("1.1.1.1", 443, 0x01, events);
		await settle();
		stream.close(CLOSE_VOLUNTARY);
		await settle();
		expect(log.closes).toEqual([]);
		expect((FakeTcp.last as FakeTcp).closedSocket).toBe(false);
	});

	it("carries UDP datagrams", async () => {
		const upstream = await directSocketsUpstream({ sockets }).connect(() => undefined);
		const { log, events } = recorder();
		const stream = upstream.openStream("8.8.8.8", 443, 0x02, events);
		stream.send(new Uint8Array([7]));
		await settle();
		const socket = FakeUdp.last as FakeUdp;
		expect(socket.options).toEqual({ remoteAddress: "8.8.8.8", remotePort: 443 });
		expect(socket.sent.map((data) => [...data])).toEqual([[7]]);
		socket.receive([5, 5]);
		await settle();
		expect(log.data).toEqual([[5, 5]]);
	});

	it("waits at the gate before reading more", async () => {
		let open: () => void = () => undefined;
		let shut = true;
		const gate = () => (shut ? new Promise<void>((resolve) => (open = resolve)) : undefined);
		const upstream = await directSocketsUpstream({ sockets }).connect(gate);
		const { log, events } = recorder();
		upstream.openStream("1.1.1.1", 80, 0x01, events);
		await settle();
		const socket = FakeTcp.last as FakeTcp;
		socket.receive([1]);
		socket.receive([2]);
		await settle();
		expect(log.data).toEqual([[1]]);
		shut = false;
		open();
		await settle();
		expect(log.data).toEqual([[1], [2]]);
	});
});
