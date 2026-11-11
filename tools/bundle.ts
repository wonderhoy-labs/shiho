// Packs web/dist into a signed web bundle, which is how Chrome installs an Isolated Web App.
//
// The key is Ed25519 PEM text, from the WEB_BUNDLE_KEY environment variable (CI's SHIHO_IWA_KEY secret) or from
// ~/.config/wonderhoy-labs/shiho/iwa-key.pem. The key decides the app's address, isolated-app://<Web Bundle ID>/, so
// it's never replaced: an app signed with another key is another app. Without a key this says so and does nothing,
// so builds without the secret, like pull requests from forks, still pass.
//
//     pnpm bundle            writes web/dist/shiho.swbn
//     pnpm bundle --id       prints the Web Bundle ID and exits

import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { BundleBuilder } from "wbn";
import { NodeCryptoSigningStrategy, parsePemKey, SignedWebBundle, WebBundleId } from "wbn-sign";

const root = fileURLToPath(new URL("..", import.meta.url));
const dist = join(root, "web", "dist");
const output = "shiho.swbn";
const keyFile = join(homedir(), ".config", "wonderhoy-labs", "shiho", "iwa-key.pem");

const TYPES: Record<string, string> = {
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
	apk: "application/vnd.android.package-archive",
};

function readKey(): string | null {
	const fromEnvironment = process.env.WEB_BUNDLE_KEY?.trim();
	if (fromEnvironment) return fromEnvironment;
	return existsSync(keyFile) ? readFileSync(keyFile, "utf8") : null;
}

function files(directory: string): string[] {
	return readdirSync(directory).flatMap((name) => {
		const path = join(directory, name);
		return statSync(path).isDirectory() ? files(path) : [path];
	});
}

const pem = readKey();
if (!pem) {
	process.stdout.write(`No signing key in WEB_BUNDLE_KEY or ${keyFile}, so no ${output}.\n`);
	process.exit(0);
}
const key = parsePemKey(pem);
const id = new WebBundleId(key);
if (process.argv.includes("--id")) {
	process.stdout.write(`${id.serialize()}\n`);
	process.exit(0);
}
if (!existsSync(join(dist, "index.html"))) throw new Error("Build the site first: pnpm --filter ./web build");

const origin = id.serializeWithIsolatedWebAppOrigin();
const builder = new BundleBuilder();
for (const path of files(dist)) {
	const name = relative(dist, path).split(sep).join("/");
	if (name.endsWith(".swbn")) continue;
	const extension = name.slice(name.lastIndexOf(".") + 1).toLowerCase();
	const headers = { "Content-Type": TYPES[extension] ?? "application/octet-stream" };
	const body = readFileSync(path);
	builder.addExchange(`${origin}${name}`, 200, headers, body);
	if (name === "index.html") builder.addExchange(origin, 200, headers, body);
}
const signed = await SignedWebBundle.fromWebBundle(builder.createBundle(), [new NodeCryptoSigningStrategy(key)]);
writeFileSync(join(dist, output), signed.getSignedWebBundleBytes());
process.stdout.write(`Wrote web/dist/${output} for ${origin}\n`);
