import type { LinkApp } from "@wonderhoy-labs/shira";

/**
 * Shiho's app on the phone, for Shira's `Phone`: `new Phone(adb, name, kind, SHIHO_APP)`. It's built on Shira's
 * `vpn` Android library, so it speaks Shira's link, on its own socket. The APK is `@wonderhoy-labs/shiho/shiho.apk`.
 */
export const SHIHO_APP: LinkApp = {
	package: "com.wonderhoylabs.shiho",
	service: "com.wonderhoylabs.shiho/.vpn.ShihoVpnService",
	activateScreen: "com.wonderhoylabs.shiho/.Activate",
	socket: "localabstract:shiho",
};
