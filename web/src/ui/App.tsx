import { isDirectSocketsAvailable } from "@wonderhoy-labs/shiho";
import { AppBar } from "./Brand";
import { Console } from "./Console";
import { Site } from "./Site";

/** Installed as an Isolated Web App, it's the app. Anywhere else, such as GitHub Pages, it explains how to get it. */
export function App() {
	return (
		<div className="app">
			<AppBar logo="./logo.webp" />
			{isDirectSocketsAvailable() ? <Console /> : <Site />}
		</div>
	);
}
