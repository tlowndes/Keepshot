# Keepshot

A personal, local-only replacement for CleanShot X on **Windows 10 and 11**.

Capture a screenshot or a screen recording with microphone audio, trim it, annotate the key moments, then copy it or export a shareable video. Everything stays on your PC: no accounts, no uploads, no telemetry.

Built with Tauri 2, React, TypeScript, ffmpeg and SQLite.

## Quick start

Prerequisites (one-off):

```powershell
winget install OpenJS.NodeJS.LTS   # Node 22.13+
winget install Rustlang.Rustup     # Rust (builds the desktop shell)
winget install Gyan.FFmpeg         # ffmpeg + ffprobe on PATH
winget install Microsoft.VisualStudio.2022.BuildTools --override "--quiet --wait --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"   # C++ linker Rust needs
```

Restart the terminal after installing, then from the project folder:

```powershell
npm start
```

`npm start` checks the prerequisites, installs dependencies on the first run, creates `.env` from `.env.example` and opens the app. The first build of the Rust side takes a few minutes; later starts are quick. WebView2 is already part of Windows 10/11.

Optional, for transcripts (downloads whisper.cpp and a ~148 MB model, once):

```powershell
npm run setup:whisper
```

To build an installer: `npm run bundle` (writes an NSIS `.exe` under `src-tauri/target/release/bundle/`).

## What it does

| | |
|---|---|
| **Capture** | Screen, window or dragged region. Optional microphone (any DirectShow input). |
| **Screenshots** | Saved as PNG to `Screenshots\` **and** copied to the clipboard (toggle in Settings). |
| **Recording** | Always-visible timer pill (kept out of the recording itself), pause/resume, and Stop from the HUD, the tray or a hotkey. |
| **Edit** | Non-destructive: trim, crop, eased zoom-ins, cursor highlight, text callouts and key-moment markers. Undo/redo. The original file is never changed. |
| **Export** | Rendered locally by ffmpeg: MP4 H.264 (default), WebM VP9, or a small 720p MP4. |
| **Beside each export** | Poster frame (`.poster.jpg`), transcript (`.transcript.vtt`) and a Markdown summary (`.summary.md`) with key moments, callouts and highlight quotes. |
| **Share** | Copy file path, copy image, or Show in Explorer. No cloud upload. |

### Keyboard shortcuts (global, changeable in Settings)

| Action | Default |
|---|---|
| Screenshot a region | `Ctrl+Shift+4` |
| Screenshot the full screen (the one under the pointer) | `Ctrl+Shift+3` |
| Start recording (or stop, if already recording) | `Ctrl+Shift+5` |
| Stop recording | `Ctrl+Shift+2` |
| Pause / resume | `Ctrl+Shift+P` |

In the editor: `Space` play/pause, `←/→` step a frame (`Shift` for a second), `M` add a key moment, `Delete` remove the selection, `Ctrl+Z`/`Ctrl+Y` undo/redo.

## Architecture

```
src/
  core/        Pure TypeScript, no I/O. The tested heart of the app.
    recipe.ts      Edit recipe model + validation (trim, crop, zooms, callouts, markers, cursor)
    ffmpeg.ts      Builds every ffmpeg/ffprobe/whisper command (capture, concat, export, poster…)
    overlay.ts     Callouts + cursor highlight as an ASS subtitle file burned in by libass
    presets.ts     H.264 / VP9 / small export presets
    transcript.ts  WebVTT parse / re-time / write
    summary.ts     Markdown summary with extractive highlights
    filenames.ts   Safe Windows filenames, unique names, path helpers
    errors.ts      Maps tool failures to friendly, recoverable messages
  services/    Orchestration through ports (Runner, FileStore, Db) — runs in the app and in tests
    pipeline.ts    finaliseRecording → transcribe → exportCapture
    library.ts     SQLite schema, migrations and queries
    settings.ts    Settings + hotkey validation
  platform/
    desktop.ts     Tauri implementations of the ports + native actions
    mock.ts        Dev-only fake backend for browser previews
  ui/          React screens: capture bar, library, editor, export drawer, settings, HUD, region picker
src-tauri/     Rust shell: process runner, recorder (segments, clock, cursor sampling),
               tray, global shortcuts, HUD/region windows, clipboard, data-folder file access
tests/
  core/        Unit tests for the core transformation and helpers
  e2e/         Happy path through the real pipeline with real ffmpeg
```

**How a recording flows.** The UI builds a gdigrab/DirectShow ffmpeg command (`core/ffmpeg.ts`) and hands it to the Rust recorder, which runs it as a segment (`.mkv`, so a crash still leaves a playable file). Pause stops the segment; resume starts a new one. A 30 Hz sampler records cursor positions on the recording clock. On Stop (from anywhere) Rust emits `rec-finished`; the pipeline joins segments into `source.mp4`, makes a poster, adds it to SQLite and starts a local transcript.

**How an export flows.** The edit is a JSON *recipe*. `buildExportArgs` turns recipe + source + preset into one ffmpeg command: input seek for the trim → `subtitles` (callouts and cursor, drawn in source pixels so they follow crop and zoom) → `crop` → `zoompan` with smoothstep-eased expressions → `scale` to the preset → encoder settings. Progress is read from `-progress pipe:1`.

**Why TypeScript owns the media logic.** Every command is built by pure functions, so it can be unit-tested, and the same pipeline code runs in the end-to-end test with Node instead of Tauri.

## Permissions

Keepshot asks Windows for nothing at install time. What it touches:

- **Screen capture**: ffmpeg's `gdigrab` (GDI). No permission prompt on Windows. Some DRM-protected video shows as black, by design. ffmpeg is run DPI-aware so scaled displays capture at full resolution.
- **Microphone**: needs *Settings → Privacy & security → Microphone → Let desktop apps access your microphone*. If it's off, Keepshot records without audio and offers a button to that settings page.
- **Global shortcuts**: registered with Windows; if another app holds one, Keepshot tells you and you can pick another in Settings.
- **Files**: the UI can only read and write inside the Keepshot data folder (enforced in Rust). The webview can only load media from that folder.
- **Network**: none at runtime. Only `npm run setup:whisper` downloads, once, from GitHub and Hugging Face.

Tauri capabilities are in `src-tauri/capabilities/default.json`.

## Where your data lives

Default: `%USERPROFILE%\Videos\Keepshot` (the Windows Videos folder). Change it with `KEEPSHOT_DATA_DIR` in `.env`.

```
Videos\Keepshot\
  library.db                     SQLite: captures, edit recipes, exports, settings
  Recordings\2026-10-14 16-47-03\
    source.mp4                   the original recording (never modified)
    poster.jpg  cursor.json  transcript.vtt
  Screenshots\2026-10-14 16-47-03.png
  Exports\onboarding-flow-walkthrough\
    onboarding-flow-walkthrough.mp4
    onboarding-flow-walkthrough.poster.jpg
    onboarding-flow-walkthrough.transcript.vtt
    onboarding-flow-walkthrough.summary.md
  whisper\  models\              only after `npm run setup:whisper`
```

## Backup and restore

Everything is plain files, so a copy of the folder is a full backup.

1. Quit Keepshot from the tray (right-click → Quit) so the database isn't mid-write.
2. Copy the whole `Videos\Keepshot` folder to your backup drive, for example:
   ```powershell
   robocopy "$env:USERPROFILE\Videos\Keepshot" "E:\Backups\Keepshot" /MIR /XD whisper models
   ```
   (`/XD whisper models` skips the re-downloadable transcription files.)
3. To restore, copy it back (or point `KEEPSHOT_DATA_DIR` at the copy) and start Keepshot.

`library.db` stores full file paths, so restore to the same location (or set `KEEPSHOT_DATA_DIR` to the same path you used before).

## Configuration

`.env` (git-ignored; copy from `.env.example`). Keepshot has no accounts or API keys, so nothing secret is needed:

| Variable | Purpose |
|---|---|
| `KEEPSHOT_DATA_DIR` | Data folder. Default `%USERPROFILE%\Videos\Keepshot`. |
| `KEEPSHOT_FFMPEG`, `KEEPSHOT_FFPROBE` | Paths to ffmpeg/ffprobe if they aren't on PATH. |
| `KEEPSHOT_WHISPER_BIN`, `KEEPSHOT_WHISPER_MODEL` | whisper.cpp binary and model. Filled in by `npm run setup:whisper`. |

## Tests

```powershell
npm test            # everything (unit + end-to-end); needs ffmpeg on PATH
npm run test:unit   # core transformation and helpers only
npm run test:e2e    # happy path: segments → library → trim/crop/zoom/callout/marker → MP4 + WebM + sidecars
npm run typecheck
cd src-tauri; cargo test
```

The end-to-end test uses ffmpeg's test source in place of a real screen grab (gdigrab needs a Windows desktop); everything after capture is the production pipeline.

To preview the UI in a browser with sample data: `node scripts/mock-media.mjs`, `npm run dev:web`, then open `http://localhost:1420/?mock`.

## Deliberately left out

Accounts, billing, telemetry/analytics, a hosted control plane, public cloud hosting, viewer identity and engagement analytics, enterprise workspaces and SSO.

## Known limits

- Window capture uses the window title; if the title changes mid-recording (e.g. a browser tab switch) ffmpeg keeps the original window.
- Zoom eases with ffmpeg's `zoompan`, which moves in whole pixels; very slow, deep zooms can look slightly steppy.
- Cursor highlight uses cursor positions sampled during recording, so it's only available for recordings made on Windows by Keepshot.
