/**
 * Development-only fake backend so the real UI can be previewed in a browser
 * with sample data: `npm run dev:web`, then open http://localhost:1420/?mock
 * (run `npm run mock:media` once first for sample images and video).
 * Never included in the desktop build.
 */
import { emit } from "@tauri-apps/api/event";
import { mockIPC, mockWindows } from "@tauri-apps/api/mocks";
import initSqlJs from "sql.js";
import wasmUrl from "sql.js/dist/sql-wasm.wasm?url";
import { basename } from "../core/filenames";
import { createRecipe } from "../core/recipe";
import { setFileUrlResolver } from "./desktop";

const DATA = "C:\\Users\\tom\\Videos\\Keepshot";
type Row = Record<string, unknown>;

export async function installMockBackend(): Promise<void> {
  const SQL = await initSqlJs({ locateFile: () => wasmUrl });
  const db = new SQL.Database();
  const files = new Map<string, string>();
  const now = Date.now();
  let rec: { start: number; paused: number; pausedAt: number | null } | null = null;

  const select = (query: string, values: unknown[] = []): Row[] => {
    const stmt = db.prepare(query);
    stmt.bind(values as never);
    const rows: Row[] = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    stmt.free();
    return rows;
  };

  (globalThis as { isTauri?: boolean }).isTauri = true;
  mockWindows(new URLSearchParams(location.search).get("view") ?? "main");
  // Open-source Chromium has no H.264, so the preview plays a WebM copy.
  setFileUrlResolver((p) => `/mock/${basename(p).replace(/\.mp4$/, ".webm")}`);

  mockIPC(
    async (cmd, raw) => {
      const args = (raw ?? {}) as Record<string, unknown>;
      switch (cmd) {
        case "app_config":
          return { dataDir: DATA, ffmpeg: "ffmpeg", ffprobe: "ffprobe", whisperBin: null, whisperModel: null, platform: "windows", version: "0.1.0" };
        case "plugin:sql|load":
          return args.db;
        case "plugin:sql|execute": {
          db.run(String(args.query), (args.values as never) ?? []);
          return [db.getRowsModified(), Number(select("SELECT last_insert_rowid() AS id")[0]?.id ?? 0)];
        }
        case "plugin:sql|select":
          return select(String(args.query), (args.values as unknown[]) ?? []);
        case "tool_available":
          return args.tool !== "whisper";
        case "run_tool": {
          const a = args.args as string[];
          if (a.includes("-list_devices")) {
            return { code: 1, stdout: "", stderr: '[dshow @ 0] "Microphone (Realtek(R) Audio)" (audio)\n[dshow @ 0] "Headset Microphone (Jabra Evolve2)" (audio)' };
          }
          if (args.tool === "ffprobe") {
            return {
              code: 0, stderr: "",
              stdout: JSON.stringify({ streams: [{ codec_type: "video", width: 2560, height: 1440, avg_frame_rate: "30/1" }, { codec_type: "audio" }], format: { duration: "134.6" } }),
            };
          }
          return { code: 0, stdout: "", stderr: "" };
        }
        case "fs_exists":
          return files.has(String(args.path)) || !String(args.path).endsWith(".bin");
        case "fs_list":
          return [];
        case "fs_read_text":
          return files.get(String(args.path)) ?? "";
        case "fs_write_text":
          files.set(String(args.path), String(args.text));
          return null;
        case "fs_size":
          return 18_200_000;
        case "data_size":
          return 2_516_582_400;
        case "list_windows":
          return [
            { title: "Figma - Onboarding v3", x: 0, y: 0, w: 1920, h: 1040 },
            { title: "Inbox - Outlook", x: 100, y: 80, w: 1400, h: 900 },
          ];
        case "plugin:window|available_monitors":
        case "plugin:window|primary_monitor": {
          const m = { name: "\\\\.\\DISPLAY1", position: { x: 0, y: 0 }, size: { width: 2560, height: 1440 }, scaleFactor: 1.5, workArea: { position: { x: 0, y: 0 }, size: { width: 2560, height: 1400 } } };
          return cmd.endsWith("primary_monitor") ? m : [m];
        }
        case "set_hotkeys":
          return [];
        case "rec_status":
          return rec ? { status: rec.pausedAt ? "paused" : "recording", elapsedMs: (rec.pausedAt ?? Date.now()) - rec.start - rec.paused } : { status: "idle", elapsedMs: 0 };
        case "rec_start":
          rec = { start: Date.now(), paused: 0, pausedAt: null };
          return null;
        case "rec_stop":
          rec = null;
          await emit("rec-state", { status: "idle", elapsedMs: 0 });
          return null;
        default:
          return null;
      }
    },
    { shouldMockEvents: true },
  );

  // Ticking recording state for the HUD preview.
  setInterval(() => {
    if (rec) void emit("rec-state", { status: rec.pausedAt ? "paused" : "recording", elapsedMs: Date.now() - rec.start - rec.paused });
  }, 200);
  if (new URLSearchParams(location.search).has("recording")) rec = { start: Date.now() - 134_600, paused: 0, pausedAt: null };

  // Seed the library once the app has created the tables.
  const { migrate } = await import("../services/library");
  await migrate({
    execute: async (sql) => void db.run(sql),
    select: async (sql) => select(sql) as never,
  });
  const source = { width: 2560, height: 1440, durationMs: 134_600, fps: 30, hasAudio: true };
  const recipe = {
    ...createRecipe(source),
    trim: { start: 4_200, end: 105_000 },
    crop: { x: 0, y: 0, w: 2560, h: 1440 },
    zooms: [{ id: "z1", start: 40_000, end: 52_500, rect: { x: 1100, y: 500, w: 1280, h: 720 } }],
    callouts: [{ id: "c1", start: 56_000, end: 70_000, text: 'Tap "Continue" here', x: 1500, y: 300 }],
    markers: [
      { id: "m1", at: 12_000, label: "Sign-up opens" },
      { id: "m2", at: 46_000, label: "Permissions prompt" },
      { id: "m3", at: 80_000, label: "Home screen" },
    ],
    cursor: { enabled: true, size: 44 },
  };
  const iso = (minsAgo: number) => new Date(now - minsAgo * 60_000).toISOString();
  const rows: unknown[][] = [
    ["video", "Onboarding flow walkthrough", `${DATA}\\Recordings\\2026-10-14 16-44-02\\source.mp4`, iso(3), 134_600, 2560, 1440, 1, `${DATA}\\Recordings\\a\\poster-1.jpg`, "x", JSON.stringify(recipe), "ready", "Welcome to the onboarding flow. First we open the sign-up screen and enter an email address. Then the permissions prompt asks for microphone access."],
    ["screenshot", "Pricing card spacing", `${DATA}\\Screenshots\\shot-1.png`, iso(330), 0, 2560, 1600, 0, `${DATA}\\Screenshots\\shot-1.png`, null, null, "none", null],
    ["video", "Bug: modal won't close", `${DATA}\\Recordings\\2026-10-13 15-02-11\\source.mp4`, iso(60 * 25), 48_000, 1920, 1080, 1, `${DATA}\\Recordings\\b\\poster-2.jpg`, null, null, "pending", null],
    ["video", "Design review notes", `${DATA}\\Recordings\\2026-10-10 10-12-40\\source.mp4`, iso(60 * 24 * 4), 312_000, 2560, 1440, 0, `${DATA}\\Recordings\\c\\poster-3.jpg`, null, null, "unavailable", null],
  ];
  for (const r of rows) {
    db.run(
      `INSERT INTO captures (kind, title, file_path, folder, created_at, duration_ms, width, height, has_audio, poster_path, cursor_path, recipe_json, transcript_status, transcript_text, transcript_error)
       VALUES (?, ?, ?, '${DATA.replace(/\\/g, "\\\\")}', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [...r, r[11] === "unavailable" ? "This recording has no audio." : null] as never,
    );
  }
}
