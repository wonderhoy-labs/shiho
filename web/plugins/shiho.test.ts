import { describe, expect, it } from "vitest";
import { manifest } from "./shiho.ts";

describe("the Isolated Web App's manifest", () => {
	const parsed = JSON.parse(manifest("1.2.3", "Shiho", "A tagline", "#BBDD22")) as {
		version: string;
		start_url: string;
		permissions_policy: Record<string, string[]>;
		icons: { src: string }[];
	};

	it("carries the version, which Chrome compares on update", () => {
		expect(parsed.version).toBe("1.2.3");
		expect(parsed.start_url).toBe("/");
	});

	it("asks for Direct Sockets, Local Network Access and WebUSB", () => {
		for (const feature of ["direct-sockets", "loopback-network", "local-network", "local-network-access", "usb"]) {
			expect(parsed.permissions_policy[feature]).toEqual(["self"]);
		}
	});

	it("points at icons in the bundle", () => {
		expect(parsed.icons.map((icon) => icon.src)).toEqual(["/icons/icon-192.png", "/icons/icon-512.png"]);
	});
});
