import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./ui/styles.css";
import { Hud } from "./ui/Hud";
import { MainApp } from "./ui/MainApp";
import { RegionPicker } from "./ui/RegionPicker";

// One bundle serves three windows: the main app, the recording HUD and the region overlay.
const params = new URLSearchParams(window.location.search);
const view = params.get("view");

if (view === "hud") document.body.classList.add("hud-body");
if (view === "region") document.body.classList.add("region-body");

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {view === "hud" ? <Hud /> : view === "region" ? <RegionPicker purpose={params.get("purpose") ?? "screenshot"} /> : <MainApp />}
  </StrictMode>,
);
