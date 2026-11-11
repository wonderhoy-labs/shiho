// Node only: signs a built site into a web bundle, which is how Chrome installs an Isolated Web App.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { BundleBuilder } from "wbn";
import { NodeCryptoSigningStrategy, parsePemKey, SignedWebBundle, WebBundleId } from "wbn-sign";

const TYPES: Record<string, string> = {
	apk: "application/vnd.android.package-archive",
	css: "text/css",
	html: "text/html; charset=utf-8",
	ico: "image/x-icon",
	js: "text/javascript",
	json: "application/json",
	png: "image/png",
	svg: "image/svg+xml",
	txt: "text/plain; charset=utf-8",
	wasm: "application/wasm",
	webmanifest: "application/manifest+json",
	webp: "image/webp",
	woff: "font/woff",
	woff2: "font/woff2",
};

function files(directory: string): string[] {
	return readdirSync(directory).flatMap((name) => {
		const path = join(directory, name);
		return statSync(path).isDirectory() ? files(path) : [path];
	});
}

/** The Web Bundle ID that an Ed25519 or ECDSA P-256 private key in PEM gives an app: its isolated-app:// host. */
export function webBundleId(keyPem: string): string {
	return new WebBundleId(parsePemKey(keyPem)).serialize();
}

/**
 * Packs every file in [directory] into a web bundle signed with [keyPem], and returns its bytes. `index.html` is
 * served at `/` too. Files ending in `.swbn` are left out, so the bundle can be written into the same directory.
 * The key decides the app's address, so an app has to be signed with the same key every time.
 */
export async function signWebBundle(directory: string, keyPem: string): Promise<{ id: string; bytes: Uint8Array }> {
	const key = parsePemKey(keyPem);
	const origin = new WebBundleId(key).serializeWithIsolatedWebAppOrigin();
	const builder = new BundleBuilder();
	for (const path of files(directory)) {
		const name = relative(directory, path).split(sep).join("/");
		if (name.endsWith(".swbn")) continue;
		const extension = name.slice(name.lastIndexOf(".") + 1).toLowerCase();
		const headers = { "Content-Type": TYPES[extension] ?? "application/octet-stream" };
		const body = readFileSync(path);
		builder.addExchange(`${origin}${name}`, 200, headers, body);
		if (name === "index.html") builder.addExchange(origin, 200, headers, body);
	}
	const signed = await SignedWebBundle.fromWebBundle(builder.createBundle(), [new NodeCryptoSigningStrategy(key)]);
	return { id: new WebBundleId(key).serialize(), bytes: signed.getSignedWebBundleBytes() };
}
