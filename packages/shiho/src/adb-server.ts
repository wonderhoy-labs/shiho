/// <reference path="./direct-sockets.d.ts" />

import { AdbServerClient } from "@yume-chan/adb";
import { MaybeConsumable } from "@yume-chan/stream-extra";
import type { SocketClasses } from "./upstream";

/** Where the adb server listens unless someone moved it. */
export const ADB_SERVER_PORT = 5037;

/** Where to find an adb server. */
export interface AdbServerOptions {
	/** "127.0.0.1" by default. */
	host?: string;
	/** 5037 by default. */
	port?: number;
	/** The socket classes to use instead of the browser's own. */
	sockets?: Pick<SocketClasses, "TCPSocket">;
}

/** Reaches an adb server with a TCP socket from Direct Sockets. */
class DirectSocketsConnector implements AdbServerClient.ServerConnector {
	constructor(
		private readonly host: string,
		private readonly port: number,
		private readonly Socket: typeof TCPSocket,
	) {}

	async connect(): Promise<AdbServerClient.ServerConnection> {
		const socket = new this.Socket(this.host, this.port, { noDelay: true });
		let opened: TCPSocketOpenInfo;
		try {
			opened = await socket.opened;
		} catch {
			throw new Error(`Couldn't reach the adb server at ${this.host}:${this.port}. Is adb running?`);
		}
		const writer = opened.writable.getWriter();
		const writable = new MaybeConsumable.WritableStream<Uint8Array>({
			write: (chunk) => writer.write(chunk as Uint8Array<ArrayBuffer>),
			// Only the sending side, which is how adb's own client says it's done.
			close: () => writer.close(),
			abort: () => writer.abort(),
		});
		const closed = socket.closed.then(
			() => undefined,
			() => undefined,
		);
		return {
			readable: opened.readable as AdbServerClient.ServerConnection["readable"],
			writable,
			closed,
			close: () => socket.close().catch(() => undefined),
		};
	}

	addReverseTunnel(): never {
		throw new Error("Reverse tunnels aren't supported through Direct Sockets.");
	}

	removeReverseTunnel(): void {
		// There are never any, because adding one throws.
	}

	clearReverseTunnels(): void {
		// There are never any, because adding one throws.
	}
}

/**
 * A Tango client for the adb server on this computer, reached with Direct Sockets. It sees every phone and emulator
 * that `adb devices` lists, without WebUSB, and leaves the adb server free for other tools.
 */
export function adbServerClient(options: AdbServerOptions = {}): AdbServerClient {
	const Socket = options.sockets?.TCPSocket ?? (globalThis as { TCPSocket?: typeof TCPSocket }).TCPSocket;
	if (!Socket) throw new Error("This page can't open connections itself, so it can't reach the adb server.");
	return new AdbServerClient(
		new DirectSocketsConnector(options.host ?? "127.0.0.1", options.port ?? ADB_SERVER_PORT, Socket),
	);
}
