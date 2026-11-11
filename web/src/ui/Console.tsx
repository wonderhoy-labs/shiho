import { describeApp, describeClose, formatBytes, formatRate } from "@wonderhoy-labs/shira";
import { type ReactNode, useEffect, useState, useSyncExternalStore } from "react";
import { type AdbDevice, appIsCurrent, Controller, type State } from "../shiho/controller";

const controller = new Controller();
const ROWS_SHOWN = 200;
const LOG_REFRESH_MILLIS = 500;
const DEVICE_POLL_MILLIS = 2_000;

type StepState = "done" | "current" | "later";

/** The app: three steps from a plugged-in phone to one that's online through this computer, then what it's doing. */
export function Console() {
	const state = useSyncExternalStore(
		(listener) => controller.subscribe(listener),
		() => controller.state,
	);

	// Phones come and go, so keep looking while none is chosen.
	useEffect(() => {
		if (state.phone) return;
		void controller.refreshAdbDevices();
		const timer = setInterval(() => void controller.refreshAdbDevices(), DEVICE_POLL_MILLIS);
		return () => clearInterval(timer);
	}, [state.phone]);

	const current = appIsCurrent(state.app);
	const live = state.link === "live";
	const phoneStep: StepState = state.phone ? "done" : "current";
	const appStep: StepState = !state.phone ? "later" : current ? "done" : "current";
	const networkStep: StepState = !state.phone || !current ? "later" : live ? "done" : "current";
	const [title, subtitle] = headline(state, current);

	return (
		<main className="console">
			<header className="console-head">
				<h1>{title}</h1>
				<p>{subtitle}</p>
			</header>

			{state.problem && (
				<div className="banner" role="alert">
					<mdui-icon-error />
					<span>{state.problem}</span>
				</div>
			)}

			<mdui-card variant="filled" className="steps">
				<Step number={1} state={phoneStep} title="Phone" summary={phoneSummary(state)}>
					{state.phone ? (
						<mdui-button variant="text" onClick={() => void controller.disconnect()}>
							Change
						</mdui-button>
					) : (
						<DevicePicker state={state} />
					)}
				</Step>
				<mdui-divider />
				<Step
					number={2}
					state={appStep}
					title="Shira's VPN app"
					summary={
						current
							? `Shira ${state.app?.versionName} is on the phone.`
							: "Shiho uses Shira's VPN app on the phone to hand it every connection."
					}
				>
					{appStep === "current" &&
						(state.installing !== null ? (
							<mdui-linear-progress className="install-progress" value={state.installing} />
						) : (
							<mdui-button variant="filled" onClick={() => void controller.installApp()}>
								<mdui-icon-download slot="icon" />
								{state.app?.installed
									? `Update to ${__SHIRA_VERSION__}`
									: `Install Shira ${__SHIRA_VERSION__}`}
							</mdui-button>
						))}
				</Step>
				<mdui-divider />
				<Step number={3} state={networkStep} title="Network" summary={networkSummary(state)}>
					{networkStep !== "later" &&
						(state.link === "idle" ? (
							<mdui-button variant="filled" onClick={() => controller.start()}>
								<mdui-icon-lan slot="icon" />
								Share this computer's network
							</mdui-button>
						) : (
							<mdui-button variant="tonal" onClick={() => controller.stop()}>
								<mdui-icon-power-settings-new slot="icon" />
								Stop sharing
							</mdui-button>
						))}
				</Step>
			</mdui-card>

			{networkStep !== "later" && state.link !== "idle" && <Activity />}
		</main>
	);
}

function headline(state: State, current: boolean): [string, string] {
	if (!state.phone) return ["Connect your phone", "Plug it in with USB debugging on. It shows up below."];
	if (!current) return ["Set up your phone", "One app, installed over the cable. Nothing else to do on the phone."];
	if (state.link === "live") return ["Your phone is online", "Every app on it is using this computer's network."];
	if (state.link === "idle") return ["Ready", "Your phone is still using its own network."];
	return ["Starting", "Getting the phone's VPN going."];
}

function phoneSummary(state: State): string {
	if (state.phone) return `${state.phone.name}, ${state.phone.kind === "usb" ? "over USB" : "through adb"}`;
	return "Choose the phone to put online.";
}

function networkSummary(state: State): string {
	if (state.busy && state.phone && state.link !== "idle") return state.busy;
	switch (state.link) {
		case "live":
			return "Online through this computer.";
		case "waiting-for-app":
			return "Waiting for the phone. If it asks about a VPN connection, tap OK.";
		case "connecting":
		case "server-lost":
			return "Starting the VPN.";
		default:
			return "Share this computer's connection with the phone, apps, Minori's machines and Terminal included.";
	}
}

function Step({
	number,
	state,
	title,
	summary,
	children,
}: {
	number: number;
	state: StepState;
	title: string;
	summary: string;
	children?: ReactNode;
}) {
	return (
		<section className={`step step-${state}`}>
			<div className="step-marker" aria-hidden="true">
				{state === "done" ? <mdui-icon-check /> : number}
			</div>
			<div className="step-body">
				<h2>{title}</h2>
				<p>{summary}</p>
				{state !== "later" && children && <div className="step-content">{children}</div>}
			</div>
		</section>
	);
}

function DevicePicker({ state }: { state: State }) {
	const devices = state.adbDevices ?? [];
	return (
		<div className="picker">
			{state.busy ? (
				<div className="picker-note">
					<mdui-circular-progress />
					<span>{state.busy}</span>
				</div>
			) : devices.length > 0 ? (
				<mdui-list className="devices">
					{devices.map((device) => (
						<DeviceRow key={device.serial} device={device} />
					))}
				</mdui-list>
			) : (
				<div className="picker-note">
					{state.adbProblem ? (
						<span>adb isn't running on this computer, so connect the phone over USB instead.</span>
					) : (
						<>
							<mdui-circular-progress />
							<span>Looking for phones. Unlock yours and allow USB debugging if it asks.</span>
						</>
					)}
				</div>
			)}
			<mdui-button variant="text" onClick={() => void controller.pickUsbPhone()}>
				<mdui-icon-usb slot="icon" />
				{devices.length > 0 ? "Use USB instead" : "Connect over USB"}
			</mdui-button>
		</div>
	);
}

function DeviceRow({ device }: { device: AdbDevice }) {
	return (
		<mdui-list-item
			rounded
			headline={device.name}
			description={device.serial}
			onClick={() => void controller.connectAdbDevice(device)}
		>
			{device.emulator ? <mdui-icon-devices slot="icon" /> : <mdui-icon-smartphone slot="icon" />}
			<mdui-icon-chevron-right slot="end-icon" />
		</mdui-list-item>
	);
}

function Activity() {
	const [, setTick] = useState(0);
	useEffect(() => {
		const timer = setInterval(() => setTick((tick) => tick + 1), LOG_REFRESH_MILLIS);
		return () => clearInterval(timer);
	}, []);
	const { log } = controller;
	const totals = log.totals(Date.now());
	const rows = log.rows.slice(-ROWS_SHOWN).reverse();
	return (
		<section className="activity">
			<div className="stats">
				<Stat label="Open connections" value={String(totals.active)} detail={`${totals.total} so far`} />
				<Stat label="Sent" value={formatBytes(totals.up)} detail={formatRate(totals.upRate)} />
				<Stat label="Received" value={formatBytes(totals.down)} detail={formatRate(totals.downRate)} />
			</div>
			<mdui-card variant="filled" className="log-card">
				<h2>Connections</h2>
				{rows.length === 0 ? (
					<p className="quiet">Nothing yet. Open an app on the phone.</p>
				) : (
					<div className="log-scroll">
						<table className="log">
							<thead>
								<tr>
									<th>App</th>
									<th>Destination</th>
									<th className="number">Sent</th>
									<th className="number">Received</th>
									<th>Status</th>
								</tr>
							</thead>
							<tbody>
								{rows.map((row) => (
									<tr key={row.id} className={row.state}>
										<td>{describeApp(row.uid, log.packages.get(row.uid))}</td>
										<td>
											{row.kind === "dns"
												? `Looked up ${row.name}`
												: `${row.name || row.host}:${row.port}`}
											{row.kind === "udp" && <span className="tag">UDP</span>}
										</td>
										<td className="number">{formatBytes(row.up)}</td>
										<td className="number">{formatBytes(row.down)}</td>
										<td>{row.state === "open" ? "Open" : describeClose(row.closeReason)}</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}
			</mdui-card>
		</section>
	);
}

function Stat({ label, value, detail }: { label: string; value: string; detail: string }) {
	return (
		<div className="stat">
			<span className="stat-label">{label}</span>
			<span className="stat-value">{value}</span>
			<span className="stat-detail">{detail}</span>
		</div>
	);
}
