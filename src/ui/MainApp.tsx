import { CaptureBar } from "./CaptureBar";
import { Editor } from "./Editor";
import { Library } from "./Library";
import { ScreenshotView } from "./ScreenshotView";
import { SettingsView } from "./SettingsView";
import { Toasts } from "./Toasts";
import { useKeepshot } from "./useKeepshot";
import { IconFolder, IconSettings } from "./icons";
import { openDataFolder } from "../platform/desktop";
import { formatBytes } from "../core/time";

export function MainApp() {
  const k = useKeepshot();

  if (k.boot.state === "loading") {
    return (
      <div className="state" role="status">
        <div className="spin" />
        <h2>Opening your library</h2>
        <p>Checking the Keepshot folder and ffmpeg.</p>
      </div>
    );
  }
  if (k.boot.state === "browser") {
    return (
      <div className="state">
        <h2>Open Keepshot as a desktop app</h2>
        <p>
          This is the web preview. Screen capture, the library and exports need the Windows app. Run{" "}
          <span className="kbd">npm start</span> from the project folder.
        </p>
      </div>
    );
  }
  if (k.boot.state === "error") {
    return (
      <div className="state">
        <h2>{k.boot.error.title}</h2>
        <p>{k.boot.error.message}</p>
        <div className="acts">
          <button className="btn primary" onClick={() => window.location.reload()}>Try again</button>
        </div>
      </div>
    );
  }

  const { view, counts, filter } = k;
  const nav = (f: typeof filter, label: string) => (
    <button
      className="navitem"
      aria-current={view.name === "library" && filter === f}
      onClick={() => {
        k.setFilter(f);
        k.setView({ name: "library" });
      }}
    >
      {label} <small>{counts[f]}</small>
    </button>
  );

  return (
    <div className="app">
      <CaptureBar k={k} />
      <div className="body">
        <nav className="sidebar" aria-label="Library">
          {nav("all", "All captures")}
          {nav("video", "Recordings")}
          {nav("screenshot", "Screenshots")}
          <h6>Storage</h6>
          <div className="storage">
            {k.config?.dataDir}
            <br />
            {formatBytes(k.storageBytes)} on disk
          </div>
          <button className="navitem" onClick={() => void openDataFolder()}>
            <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <IconFolder width={14} /> Open folder
            </span>
          </button>
          <button className="navitem" aria-current={view.name === "settings"} onClick={() => k.setView({ name: "settings" })}>
            <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <IconSettings width={14} /> Settings
            </span>
          </button>
        </nav>
        <main className="main">
          {!k.ffmpegOk && (
            <div className="banner err" role="alert">
              <b>ffmpeg isn't installed.</b> Capture and export need it. Run <span className="kbd">winget install Gyan.FFmpeg</span>,
              then restart Keepshot.
            </div>
          )}
          {k.hotkeyFailures.length > 0 && (
            <div className="banner" role="status">
              <b>Some shortcuts didn't register:</b>{" "}
              {k.hotkeyFailures.map((f) => `${f.accelerator} (${f.reason})`).join(", ")}
              <button className="btn" onClick={() => k.setView({ name: "settings" })}>Change shortcuts</button>
            </div>
          )}
          {k.saving && (
            <div className="banner" role="status">
              <div className="spin" style={{ width: 16, height: 16 }} /> Saving your recording…
            </div>
          )}
          {view.name === "library" && <Library k={k} />}
          {view.name === "screenshot" && <ScreenshotView k={k} id={view.id} />}
          {view.name === "editor" && <Editor k={k} id={view.id} key={view.id} />}
          {view.name === "settings" && <SettingsView k={k} />}
        </main>
      </div>
      <Toasts toasts={k.toasts} dismiss={k.dismiss} />
    </div>
  );
}
