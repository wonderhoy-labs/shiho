import "@fontsource-variable/roboto-flex";
import "mdui/mdui.css";
import "mdui/components/button.js";
import "mdui/components/card.js";
import "mdui/components/divider.js";
import "mdui/components/circular-progress.js";
import "mdui/components/linear-progress.js";
import "mdui/components/list.js";
import "mdui/components/list-item.js";
import "@mdui/icons/check.js";
import "@mdui/icons/chevron-right.js";
import "@mdui/icons/devices.js";
import "@mdui/icons/download.js";
import "@mdui/icons/error.js";
import "@mdui/icons/install-desktop.js";
import "@mdui/icons/lan.js";
import "@mdui/icons/power-settings-new.js";
import "@mdui/icons/smartphone.js";
import "@mdui/icons/usb.js";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./ui/App";
import "./ui/theme.css";
import "./ui/wonderhoy.css";
import "./ui/styles.css";

const root = document.getElementById("root");
if (!root) throw new Error("index.html has no #root");
createRoot(root).render(
	<StrictMode>
		<App />
	</StrictMode>,
);
