import { adbServerClient, directSocketsUpstream } from "@wonderhoy-labs/shiho";
import {
	type AppInfo,
	InstallError,
	type LinkState,
	LogStore,
	Phone,
	ShiraLink,
	type StopReason,
} from "@wonderhoy-labs/shira";
import shiraApkUrl from "@wonderhoy-labs/shira/shira.apk?url";
import { Adb, AdbDaemonTransport } from "@yume-chan/adb";
import AdbWebCredentialStore from "@yume-chan/adb-credential-web";
import { AdbDaemonWebUsbDevice, AdbDaemonWebUsbDeviceManager } from "@yume-chan/adb-daemon-webusb";

/** How much can be on its way before adb waits for the other side. Bigger is faster, and adds some delay. */
const DELAYED_ACK_BYTES = 1024 * 1024;

/** A phone or emulator that the adb server on this computer knows. */
export interface AdbDevice {
	serial: string;
	/** What to call it, like "Pixel 10 Pro" or "Android emulator". */
	name: string;
	emulator: boolean;
}

export interface State {
	/** What adb on this computer can see, or null before anyone looked. */
	adbDevices: AdbDevice[] | null;
	/** Why the adb server couldn't be reached, if it couldn't. */
	adbProblem: string | null;
	/** The phone in use. */
	phone: { name: string; kind: Phone["kind"] } | null;
	app: AppInfo | null;
	/** How far an install has got, from 0 to 1, while there is one. */
	installing: number | null;
	link: LinkState;
	busy: string | null;
	problem: string | null;
}

const initial: State = {
	adbDevices: null,
	adbProblem: null,
	phone: null,
	app: null,
	installing: null,
	link: "idle",
	busy: null,
	problem: null,
};

/** True when Shira's app on the phone is the one this page carries, or newer. */
export function appIsCurrent(app: AppInfo | null): boolean {
	return !!app?.installed && (app.versionCode ?? 0) >= __SHIRA_VERSION_CODE__;
}

/** Everything the page does: finds the phone, sees to Shira's app on it, and runs the link. */
export class Controller {
	state: State = initial;
	readonly log = new LogStore();
	private readonly listeners = new Set<() => void>();
	private adbServerValue: ReturnType<typeof adbServerClient> | null = null;
	private phone: Phone | null = null;
	private link: ShiraLink | null = null;

	/** Made on first use, because only the installed app can make one, and the site loads this file too. */
	private get adbServer() {
		this.adbServerValue ??= adbServerClient();
		return this.adbServerValue;
	}

	subscribe(listener: () => void): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	private update(change: Partial<State>) {
		this.state = { ...this.state, ...change };
		for (const listener of this.listeners) listener();
	}

	/** Lists what the adb server on this computer can see. */
	async refreshAdbDevices() {
		try {
			const devices = await this.adbServer.getDevices(["device"]);
			this.update({
				adbProblem: null,
				adbDevices: devices.map((device) => {
					const emulator = device.serial.startsWith("emulator-");
					const model = device.model?.replaceAll("_", " ");
					return {
						serial: device.serial,
						emulator,
						name: emulator ? "Android emulator" : model || "Android phone",
					};
				}),
			});
		} catch (error) {
			this.update({ adbDevices: [], adbProblem: error instanceof Error ? error.message : String(error) });
		}
	}

	/** Uses a phone through the adb server on this computer. */
	async connectAdbDevice(device: AdbDevice) {
		await this.run(`Connecting to ${device.name}.`, async () => {
			const transport = await this.adbServer.createTransport({ serial: device.serial });
			await this.attachPhone(new Phone(new Adb(transport), device.name, "adb-server"));
		});
	}

	/** Shows Chrome's list of USB phones, which only works straight after a click. */
	async pickUsbPhone() {
		const manager = AdbDaemonWebUsbDeviceManager.BROWSER;
		if (!manager) {
			this.update({ problem: "This browser has no WebUSB." });
			return;
		}
		const device = await manager.requestDevice().catch(() => undefined);
		if (!device) return;
		await this.run("Connecting. If your phone asks whether to allow USB debugging, tap Allow.", async () => {
			let connection: Awaited<ReturnType<AdbDaemonWebUsbDevice["connect"]>>;
			try {
				connection = await device.connect();
			} catch (error) {
				if (error instanceof AdbDaemonWebUsbDevice.DeviceBusyError) {
					throw new Error(
						"Something else on this computer is using USB debugging, probably the adb server. Pick the phone from the list instead.",
					);
				}
				throw error;
			}
			const transport = await AdbDaemonTransport.authenticate({
				serial: device.serial,
				connection,
				credentialStore: new AdbWebCredentialStore("Shiho"),
				initialDelayedAckBytes: DELAYED_ACK_BYTES,
			});
			await this.attachPhone(new Phone(new Adb(transport), device.name || "Your phone", "usb"));
		});
	}

	private async attachPhone(phone: Phone) {
		this.phone = phone;
		this.update({ phone: { name: phone.name, kind: phone.kind }, app: await phone.appInfo() });
		void phone.disconnected.then(() => {
			if (this.phone !== phone) return;
			this.link?.stop();
			this.link = null;
			this.phone = null;
			this.update({ phone: null, app: null, link: "idle", busy: null, problem: "The phone went away." });
		});
	}

	/** Installs the Shira app that this page carries. */
	async installApp() {
		const phone = this.phone;
		if (!phone) return;
		this.update({ installing: 0, problem: null });
		try {
			const apk = new Uint8Array(await (await fetch(shiraApkUrl)).arrayBuffer());
			try {
				await phone.install(apk, (installing) => this.update({ installing }));
			} catch (error) {
				// Signed with another key, or newer: Android wants the old one gone first.
				if (!(error instanceof InstallError) || !error.needsUninstall) throw error;
				await phone.uninstall();
				await phone.install(apk, (installing) => this.update({ installing }));
			}
			this.update({ app: await phone.appInfo() });
		} catch (error) {
			this.update({ problem: `Couldn't install Shira's app. ${error instanceof Error ? error.message : error}` });
		} finally {
			this.update({ installing: null });
		}
	}

	/** Gives the phone this computer's network. */
	start() {
		const phone = this.phone;
		if (!phone || this.link?.isActive) return;
		this.update({ problem: null });
		this.link = new ShiraLink({
			phone,
			upstream: directSocketsUpstream(),
			log: this.log,
			events: {
				onState: (link) => this.update({ link }),
				onBusy: (busy) => this.update({ busy }),
				onStopped: (reason) => this.update({ problem: describeStop(reason) }),
			},
		});
		this.link.start("auto");
		this.link.refreshPackagesNow();
	}

	/** Lets go of the phone, which goes back to its own network. */
	stop() {
		this.link?.deactivate();
		this.link = null;
		this.update({ link: "idle", busy: null });
	}

	/** Stops and forgets the phone. */
	async disconnect() {
		this.stop();
		const phone = this.phone;
		this.phone = null;
		this.update({ phone: null, app: null });
		await phone?.close().catch(() => undefined);
	}

	private async run(busy: string, job: () => Promise<void>) {
		this.update({ busy, problem: null });
		try {
			await job();
		} catch (error) {
			this.update({ problem: error instanceof Error ? error.message : String(error) });
		} finally {
			this.update({ busy: null });
		}
	}
}

function describeStop(reason: StopReason): string {
	switch (reason.kind) {
		case "off":
			return "Shira was turned off on the phone.";
		case "replaced":
			return "Another page took over the phone's link.";
		case "app-mismatch":
			return `${reason.message} Install the app again from here.`;
		case "error":
			return reason.message;
	}
}
