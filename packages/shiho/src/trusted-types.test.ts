import { describe, expect, it } from "vitest";
import { trustSameOriginScripts } from "./trusted-types";

function fakeScope() {
	let rules: { createScriptURL(input: string): string } | null = null;
	const scope = {
		location: { origin: "isolated-app://abc", href: "isolated-app://abc/" } as Location,
		trustedTypes: {
			defaultPolicy: null as unknown,
			createPolicy(name: string, policy: { createScriptURL(input: string): string }) {
				expect(name).toBe("default");
				rules = policy;
				scope.trustedTypes.defaultPolicy = policy;
				return policy;
			},
		},
	};
	return { scope, rules: () => rules };
}

describe("trustSameOriginScripts", () => {
	it("allows the app's own scripts and nothing else", () => {
		const { scope, rules } = fakeScope();
		expect(trustSameOriginScripts(scope)).toBe(true);
		expect(rules()?.createScriptURL("/assets/ticker.js")).toBe("isolated-app://abc/assets/ticker.js");
		expect(() => rules()?.createScriptURL("https://example.com/x.js")).toThrow();
	});

	it("leaves an existing default policy alone", () => {
		const { scope } = fakeScope();
		trustSameOriginScripts(scope);
		expect(trustSameOriginScripts(scope)).toBe(false);
	});

	it("does nothing without Trusted Types", () => {
		expect(trustSameOriginScripts({})).toBe(false);
	});
});
