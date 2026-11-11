/** What GitHub Pages shows: what Shiho is, and how to install it, since Direct Sockets only work once it's installed. */
export function Site() {
	return (
		<main className="site">
			<section className="hero">
				<h1>Your phone online through your computer</h1>
				<p>
					Plug your Android phone into your computer, and Shiho gives it the computer's network: every app,
					Minori's Linux machines and Android's Terminal included. It runs in Chrome as an Isolated Web App,
					which can open network connections itself, so nothing else runs on the computer and there's no
					server in between.
				</p>
				<div className="actions">
					<mdui-button variant="filled" href="./shiho.swbn" download="shiho.swbn">
						<mdui-icon-download slot="icon" />
						Download Shiho {__SHIHO_VERSION__}
					</mdui-button>
					<mdui-button variant="tonal" href="https://github.com/wonderhoy-labs/shiho#readme">
						Read more
					</mdui-button>
				</div>
			</section>

			<mdui-card variant="outlined" className="card">
				<h2>How it works</h2>
				<p>
					On the phone, <a href="https://github.com/wonderhoy-labs/shira">Shira</a>'s VPN app takes every
					connection apps make and hands it over USB debugging to Shiho. Shiho opens the same connection from
					the computer with Chrome's{" "}
					<a href="https://developer.chrome.com/docs/iwa/direct-sockets">Direct Sockets</a>, and passes the
					bytes back. Shira's own page does the same through a Wisp server; Shiho needs none.
				</p>
				<p>
					Shiho finds the phone through the adb server on the computer, if one is running, which also covers
					emulators, or straight over USB with WebUSB.
				</p>
			</mdui-card>

			<mdui-card variant="outlined" className="card">
				<h2>Install it</h2>
				<p>
					Isolated Web Apps are installed from a signed web bundle. Outside managed ChromeOS, Chrome only
					allows that in its developer mode for them.
				</p>
				<ol>
					<li>
						In Chrome, open <code>chrome://flags/#enable-isolated-web-app-dev-mode</code>, set it to Enabled
						and relaunch.
					</li>
					<li>
						Download <a href="./shiho.swbn">shiho.swbn</a>, or take it from the{" "}
						<a href="https://github.com/wonderhoy-labs/shiho/releases/latest">latest release</a>.
					</li>
					<li>
						Open <code>chrome://web-app-internals</code>, and under Isolated Web Apps choose "Install IWA
						from Signed Web Bundle". Pick the file.
					</li>
					<li>Open Shiho from Chrome's apps, or from your computer's app list.</li>
				</ol>
				<p className="quiet">
					Every release is signed with the same key, so Shiho's address stays{" "}
					<code>isolated-app://7bnazaslgp73mlrzgb7e2x3opemnthhgdnmwhjb3rfudf75pivtqaaic/</code>. Install a new
					version the same way.
				</p>
			</mdui-card>

			<mdui-card variant="outlined" className="card">
				<h2>What you need</h2>
				<ul>
					<li>Chrome on macOS, Linux, Windows or ChromeOS.</li>
					<li>An Android phone with USB debugging on, and a USB cable. Shiho installs Shira's app on it.</li>
					<li>
						For Minori's machines and Android's Terminal,{" "}
						<a href="https://github.com/wonderhoy-labs/minori">Minori</a> 0.3.0 or newer on the phone.
					</li>
				</ul>
			</mdui-card>
		</main>
	);
}
