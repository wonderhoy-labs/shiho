import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import { shiho } from "./plugins/shiho.ts";

export default defineConfig({
	// Relative, so that the same build works on GitHub Pages and inside the signed web bundle.
	base: "./",
	plugins: [react(), shiho()],
	build: { target: "esnext", chunkSizeWarningLimit: 1500 },
	test: { environment: "node", include: ["src/**/*.test.ts", "plugins/**/*.test.ts"] },
});
