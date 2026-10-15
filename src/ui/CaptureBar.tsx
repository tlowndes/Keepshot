import { formatTimecode } from "../core/time";
import type { CaptureMode } from "../services/settings";
import { IconCamera, IconMic, IconPause, IconPlay, IconRecord, IconRefresh, IconStop } from "./icons";
import type { Keepshot } from "./useKeepshot";

const MODES: { id: CaptureMode; label: string }[] = [
  { id: "screen", label: "Screen" },
  { id: "window", label: "Window" },
  { id: "region", label: "Region" },
];

export function CaptureBar({ k }: { k: Keepshot }) {
  const s = k.settings!;
  const recording = k.rec.status !== "idle";
  const disabled = !k.ffmpegOk || k.saving;

  return (
    <header className="capturebar">
      <div className="brand">
        <img src="/icon.png" alt="" /> Keepshot
      </div>

      {recording ? (
        <div className="rec-live" role="status" aria-label="Recording">
          <span className={`rec-dot ${k.rec.status === "paused" ? "paused" : ""}`} />
          <span className="mono">{formatTimecode(k.rec.elapsedMs)}</span>
          <button className="btn" onClick={() => void k.togglePause()}>
            {k.rec.status === "paused" ? <IconPlay /> : <IconPause />}
            {k.rec.status === "paused" ? "Resume" : "Pause"}
          </button>
          <button className="btn rec" onClick={() => void k.stopRecording()}>
            <IconStop /> Stop
          </button>
        </div>
      ) : (
        <>
          <div className="seg" role="group" aria-label="What to capture">
            {MODES.map((m) => (
              <button key={m.id} aria-pressed={s.captureMode === m.id} onClick={() => void k.updateSettings({ captureMode: m.id })}>
                {m.label}
              </button>
            ))}
          </div>

          {s.captureMode === "screen" && k.screens.length > 1 && (
            <select
              className="field"
              aria-label="Screen"
              value={k.target.screen}
              onChange={(e) => k.setTarget({ ...k.target, screen: Number(e.target.value) })}
            >
              <option value={-1}>Main screen</option>
              {k.screens.map((scr, i) => (
                <option key={i} value={i}>{scr.name}</option>
              ))}
            </select>
          )}

          {s.captureMode === "window" && (
            <select
              className="field"
              aria-label="Window"
              value={k.target.window}
              onChange={(e) => k.setTarget({ ...k.target, window: e.target.value })}
            >
              {k.windows.length === 0 && <option value="">No windows found</option>}
              {k.windows.map((w) => (
                <option key={`${w.title}-${w.x}-${w.y}`} value={w.title}>{w.title}</option>
              ))}
            </select>
          )}

          <label className="seg" style={{ alignItems: "center", paddingLeft: 8, gap: 4 }}>
            <IconMic width={15} aria-hidden="true" />
            <span className="sr-only">Microphone</span>
            <select
              className="field"
              style={{ border: 0 }}
              value={s.mic ?? ""}
              onChange={(e) => void k.updateSettings({ mic: e.target.value || null })}
            >
              <option value="">No microphone</option>
              {s.mic && !k.mics.includes(s.mic) && <option value={s.mic}>{s.mic} (not found)</option>}
              {k.mics.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </label>
          <button className="btn icon ghost" title="Refresh screens, windows and microphones" onClick={() => void k.refreshSources()}>
            <IconRefresh />
          </button>
        </>
      )}

      <span className="spacer" />

      {!recording && (
        <>
          <div className="seg" role="group" aria-label="Screenshot">
            <button disabled={disabled} onClick={() => void k.takeScreenshot("screen")} title="Full screen · Ctrl+Shift+3">
              <IconCamera /> Screen
            </button>
            <button disabled={disabled || !k.target.window} onClick={() => void k.takeScreenshot("window")} title="Active window">
              <IconCamera /> Window
            </button>
            <button disabled={disabled} onClick={() => void k.takeScreenshot("region")} title="Region · Ctrl+Shift+4">
              <IconCamera /> Region
            </button>
          </div>
          <button className="btn primary" disabled={disabled} onClick={() => void k.startRecording()} title="Ctrl+Shift+5">
            <IconRecord /> Record
          </button>
        </>
      )}
    </header>
  );
}
