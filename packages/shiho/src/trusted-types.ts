/** The part of the Trusted Types API this uses. */
interface TrustedTypesLike {
	defaultPolicy: unknown;
	createPolicy(name: string, rules: { createScriptURL(input: string): string }): unknown;
}

/**
 * Lets the page start workers and load scripts from its own origin, and nowhere else.
 *
 * Isolated Web Apps require Trusted Types for script URLs, so `new Worker(url)` throws unless a policy vouches for the
 * URL. Libraries such as Shira's start workers that way, so call this once, before anything else runs. It installs
 * the page's default policy, which only accepts URLs on the page's own origin. It does nothing where Trusted Types
 * don't exist or a default policy is already set, and returns whether it installed one.
 */
export function trustSameOriginScripts(
	scope: { trustedTypes?: TrustedTypesLike; location?: Location } = globalThis,
): boolean {
	const trustedTypes = scope.trustedTypes;
	const base = scope.location?.href;
	if (!trustedTypes || !base || trustedTypes.defaultPolicy) return false;
	// By scheme and host, because URL gives schemes it doesn't know, like isolated-app:, an opaque origin.
	const site = (url: URL) => `${url.protocol}//${url.host}`;
	const own = site(new URL(base));
	trustedTypes.createPolicy("default", {
		createScriptURL(input) {
			const url = new URL(input, base);
			if (site(url) !== own) throw new TypeError(`Only this app's own scripts can run, not ${url.href}.`);
			return url.href;
		},
	});
	return true;
}
