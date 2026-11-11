import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { Plugin } from "vite";

const repo = (path: string) => fileURLToPath(new URL(`../../${path}`, import.meta.url));

/** Where an Isolated Web App's manifest has to be. */
export const MANIFEST_PATH = ".well-known/manifest.webmanifest";

/**
 * The Isolated Web App's manifest. Direct Sockets need `direct-sockets`. The adb server on this computer and anything the
 * phone reaches on the local network also need Local Network Access, which Chrome asks the person about: `loopback-network`
 * and `local-network`, and `local-network-access`, its older name. WebUSB needs `usb`.
 */
export function manifest(version: string, name: string, description: string, color: string): string {
	return `${JSON.stringify(
		{
			name,
			short_name: name,
			description,
			version,
			id: "/",
			start_url: "/",
			scope: "/",
			display: "standalone",
			theme_color: color,
			background_color: color,
			icons: [
				{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
				{ src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
			],
			permissions_policy: {
				"cross-origin-isolated": ["self"],
				"direct-sockets": ["self"],
				"local-network": ["self"],
				"local-network-access": ["self"],
				"loopback-network": ["self"],
				usb: ["self"],
			},
		},
		null,
		"\t",
	)}\n`;
}

/** Tells the page its version and the version of Shira's app it carries, and writes the IWA manifest. */
export function shiho(): Plugin {
	const version = readFileSync(repo("VERSION"), "utf8").trim();
	const root = JSON.parse(readFileSync(repo("package.json"), "utf8")) as {
		wonderhoy: { name: string; tagline: string; color: string };
	};
	const shira = (
		JSON.parse(readFileSync(repo("web/node_modules/@wonderhoy-labs/shira/package.json"), "utf8")) as {
			version: string;
		}
	).version;
	const [major = 0, minor = 0, patch = 0] = shira.split(".").map(Number);
	const text = manifest(version, root.wonderhoy.name, root.wonderhoy.tagline, root.wonderhoy.color);

	return {
		name: "shiho",

		config: () => ({
			define: {
				__SHIHO_VERSION__: JSON.stringify(version),
				__SHIRA_VERSION__: JSON.stringify(shira),
				__SHIRA_VERSION_CODE__: major * 10_000 + minor * 100 + patch,
			},
		}),

		configureServer(server) {
			server.middlewares.use(`/${MANIFEST_PATH}`, (_request, response) => {
				response.setHeader("Content-Type", "application/manifest+json");
				response.end(text);
			});
		},

		generateBundle() {
			this.emitFile({ type: "asset", fileName: MANIFEST_PATH, source: text });
		},
	};
}
