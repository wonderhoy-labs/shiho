import { describeApp, describeClose, formatBytes, formatRate, type LinkState } from "@wonderhoy-labs/shira";
import { useEffect, useState, useSyncExternalStore } from "react";
import { appIsCurrent, Controller } from "../shiho/controller";

const controller = new Controller();
const ROWS_SHOWN = 200;
const LOG_REFRESH_MILLIS = 500;

const LINK_WORDS: Record<LinkState, string> = {
	idle: "Off. Your phone is on its own network.",
	"waiting-for-app": "Waiting for Shira's VPN on the phone.",
	connecting: "Starting the VPN.",
	live: "Your phone is online through this computer.",
	"server-lost": "Reconnecting.",
};

export function Console() {
	const state = useSyncExternalStore(
		(listener) => controller.subscribe(listener),
		() => controller.state,
	);

	useEffect(() => {
		void controller.refreshAdbDevices();
	}, []);

	return (
		<main className="console">
			{state.problem && (
				<mdui-card variant="filled" className="card problem">
					<mdui-icon-error />
					<span>{state.problem}</span>
				</mdui-card>
			)}
			{state.busy && (
				<mdui-card variant="filled" className="card busy">
					<mdui-circular-progress />
					<span>{state.busy}</span>
				</mdui-card>
			)}
			{state.phone ? phoneCards() : choosePhone()}
		</main>
	);

	function choosePhone() {
		return (
			<mdui-card variant="outlined" className="card">
				<h2>Choose your phone</h2>
				<p>
					Turn on USB debugging on the phone and plug it in. Shiho can reach it through the adb server on this
					computer, if one is running, or straight over USB.
				</p>
				<h3>Phones adb can see</h3>
				{state.adbProblem ? (
					<p className="quiet">{state.adbProblem}</p>
				) : state.adbDevices?.length === 0 ? (
					<p className="quiet">None yet. Run "adb devices" on this computer and check the phone is listed.</p>
				) : (
					<mdui-list>
						{state.adbDevices?.map((device) => (
							<mdui-list-item
								key={device.serial}
								headline={device.label}
								onClick={() => void controller.connectAdbDevice(device)}
							>
								<mdui-icon-smartphone slot="icon" />
							</mdui-list-item>
						))}
					</mdui-list>
				)}
				<div className="actions">
					<mdui-button variant="tonal" onClick={() => void controller.refreshAdbDevices()}>
						<mdui-icon-refresh slot="icon" />
						Look again
					</mdui-button>
					<mdui-button variant="filled" onClick={() => void controller.pickUsbPhone()}>
						<mdui-icon-usb slot="icon" />
						Choose a USB phone
					</mdui-button>
				</div>
			</mdui-card>
		);
	}

	function phoneCards() {
		const { phone, app, installing, link } = state;
		const current = appIsCurrent(app);
		const running = link !== "idle";
		return (
			<>
				<mdui-card variant="outlined" className="card">
					<div className="row">
						<mdui-icon-smartphone />
						<div className="grow">
							<h2>{phone?.name}</h2>
							<p className="quiet">
								{phone?.kind === "usb" ? "Over USB" : "Through adb on this computer"}
								{app?.installed
									? ` · Shira ${app.versionName} installed`
									: " · Shira's app isn't installed"}
							</p>
						</div>
						<mdui-button variant="text" onClick={() => void controller.disconnect()}>
							Disconnect
						</mdui-button>
					</div>
					{!current && (
						<>
							<p>
								Shiho uses Shira's VPN app on the phone. This installs Shira {__SHIRA_VERSION__}, which
								comes with Shiho.
							</p>
							{installing !== null ? (
								<mdui-linear-progress value={installing} />
							) : (
								<div className="actions">
									<mdui-button variant="filled" onClick={() => void controller.installApp()}>
										<mdui-icon-download slot="icon" />
										{app?.installed ? "Update Shira" : "Install Shira"}
									</mdui-button>
								</div>
							)}
						</>
					)}
				</mdui-card>
				{current && (
					<mdui-card variant="outlined" className="card">
						<div className="row">
							{link === "live" ? <mdui-icon-check-circle className="live" /> : <mdui-icon-lan />}
							<div className="grow">
								<h2>Network</h2>
								<p className="quiet">{LINK_WORDS[link]}</p>
							</div>
							<mdui-button
								variant={running ? "tonal" : "filled"}
								onClick={() => (running ? controller.stop() : controller.start())}
							>
								<mdui-icon-power-settings-new slot="icon" />
								{running ? "Stop" : "Start"}
							</mdui-button>
						</div>
						{running && (
							<p className="quiet">
								The first time, the phone asks to allow Shira's VPN connection. Tap OK there.
							</p>
						)}
					</mdui-card>
				)}
				{current && <Connections />}
			</>
		);
	}
}

function Connections() {
	const [, setTick] = useState(0);
	useEffect(() => {
		const timer = setInterval(() => setTick((tick) => tick + 1), LOG_REFRESH_MILLIS);
		return () => clearInterval(timer);
	}, []);
	const { log } = controller;
	const totals = log.totals(Date.now());
	const rows = log.rows.slice(-ROWS_SHOWN).reverse();
	return (
		<mdui-card variant="outlined" className="card">
			<h2>Connections</h2>
			<p className="quiet">
				{totals.active} open · {totals.total} in all · ↑ {formatBytes(totals.up)} ({formatRate(totals.upRate)})
				· ↓ {formatBytes(totals.down)} ({formatRate(totals.downRate)})
			</p>
			<table className="log">
				<thead>
					<tr>
						<th>App</th>
						<th>To</th>
						<th>Up</th>
						<th>Down</th>
						<th>State</th>
					</tr>
				</thead>
				<tbody>
					{rows.map((row) => (
						<tr key={row.id} className={row.state}>
							<td>{describeApp(row.uid, log.packages.get(row.uid))}</td>
							<td>
								{row.kind === "dns" ? `DNS ${row.name}` : `${row.name || row.host}:${row.port}`}
								{row.kind === "udp" ? " (UDP)" : ""}
							</td>
							<td>{formatBytes(row.up)}</td>
							<td>{formatBytes(row.down)}</td>
							<td>{row.state === "open" ? "Open" : describeClose(row.closeReason)}</td>
						</tr>
					))}
				</tbody>
			</table>
		</mdui-card>
	);
}
