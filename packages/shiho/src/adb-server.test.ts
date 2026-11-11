import { describe, expect, it } from "vitest";
import { type AdbServerOptions, adbServerClient } from "./adb-server";

/** An adb server that answers every request with OKAY and remembers what it was sent. */
function fakeServer() {
	const received: number[][] = [];
	class Socket {
		readonly opened: Promise<TCPSocketOpenInfo>;
		readonly closed = new Promise<void>(() => undefined);
		constructor() {
			let controller!: ReadableStreamDefaultController<Uint8Array>;
			const readable = new ReadableStream<Uint8Array>({
				start: (c) => {
					controller = c;
				},
			});
			const writable = new WritableStream<BufferSource>({
				write: (chunk) => {
					received.push([...(chunk as Uint8Array)]);
					controller.enqueue(new TextEncoder().encode("OKAY0004abcd"));
				},
			});
			this.opened = Promise.resolve({
				readable,
				writable,
				remoteAddress: "",
				remotePort: 0,
				localAddress: "",
				localPort: 0,
			});
		}
		close() {
			return Promise.resolve();
		}
	}
	return { received, sockets: { TCPSocket: Socket } as unknown as AdbServerOptions["sockets"] };
}

describe("adbServerClient", () => {
	it("talks to the adb server, and lets go of the socket afterwards", async () => {
		const { received, sockets } = fakeServer();
		const client = adbServerClient({ sockets });
		const features = await client.getServerFeatures();
		expect(features).toEqual(["abcd"]);
		expect(new TextDecoder().decode(new Uint8Array(received[0] ?? []))).toBe("0012host:host-features");
	});

	it("unwraps a Consumable from another copy of Tango's streams", async () => {
		const { received, sockets } = fakeServer();
		const client = adbServerClient({ sockets });
		const connection = await client.connector.connect();
		const writer = connection.writable.getWriter();
		const foreign = { tryConsume: (send: (value: Uint8Array) => unknown) => send(new Uint8Array([1, 2, 3])) };
		await writer.write(foreign as never);
		expect(received).toEqual([[1, 2, 3]]);
	});
});
