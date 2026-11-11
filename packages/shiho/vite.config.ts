import { defineConfig } from "vitest/config";

// The library's own build: an ES module for the page and one for Node tools, with dependencies left outside.
export default defineConfig({
	build: {
		target: "es2022",
		minify: false,
		lib: {
			entry: { index: "src/index.ts", bundle: "src/bundle.ts" },
			formats: ["es"],
			fileName: (_format, name) => `${name}.js`,
		},
		rollupOptions: { external: (id) => !id.startsWith(".") && !id.startsWith("/") && !id.includes("?raw") },
	},
	test: { environment: "node", include: ["src/**/*.test.ts"] },
});
