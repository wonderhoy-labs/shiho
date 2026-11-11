// The parts of the Direct Sockets API that Shiho uses. Only Isolated Web Apps have it.
// https://wicg.github.io/direct-sockets/

interface TCPSocketOptions {
	sendBufferSize?: number;
	receiveBufferSize?: number;
	noDelay?: boolean;
	keepAliveDelay?: number;
	dnsQueryType?: "ipv4" | "ipv6";
}

interface TCPSocketOpenInfo {
	readable: ReadableStream<Uint8Array>;
	writable: WritableStream<BufferSource>;
	remoteAddress: string;
	remotePort: number;
	localAddress: string;
	localPort: number;
}

declare class TCPSocket {
	constructor(remoteAddress: string, remotePort: number, options?: TCPSocketOptions);
	readonly opened: Promise<TCPSocketOpenInfo>;
	readonly closed: Promise<void>;
	close(): Promise<void>;
}

interface UDPSocketOptions {
	remoteAddress?: string;
	remotePort?: number;
	localAddress?: string;
	localPort?: number;
	sendBufferSize?: number;
	receiveBufferSize?: number;
	dnsQueryType?: "ipv4" | "ipv6";
}

interface UDPMessage {
	data: BufferSource;
	remoteAddress?: string;
	remotePort?: number;
}

interface UDPSocketOpenInfo {
	readable: ReadableStream<UDPMessage & { data: Uint8Array }>;
	writable: WritableStream<UDPMessage>;
	remoteAddress?: string;
	remotePort?: number;
	localAddress: string;
	localPort: number;
}

declare class UDPSocket {
	constructor(options: UDPSocketOptions);
	readonly opened: Promise<UDPSocketOpenInfo>;
	readonly closed: Promise<void>;
	close(): Promise<void>;
}
