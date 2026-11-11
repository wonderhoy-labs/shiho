// Shiho as a library: a phone's network through this computer, from an Isolated Web App.
//
// Shira's app on the phone hands every connection to the page over adb. With directSocketsUpstream as ShiraLink's
// upstream, the page opens each one itself with Direct Sockets, so there's no Wisp server. adbServerClient reaches the
// adb server on this computer the same way, for emulators and phones that adb already has.

/// <reference path="./direct-sockets.d.ts" />

export { ADB_SERVER_PORT, type AdbServerOptions, adbServerClient } from "./adb-server";
export { trustSameOriginScripts } from "./trusted-types";
export {
	CLOSE_NETWORK_ERROR,
	CLOSE_UNREACHABLE,
	CLOSE_VOLUNTARY,
	type DirectSocketsOptions,
	directSocketsUpstream,
	isDirectSocketsAvailable,
	type SocketClasses,
} from "./upstream";
