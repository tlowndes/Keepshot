#!/usr/bin/env node
// One command to run Keepshot from a fresh clone: `npm start`.
// Checks prerequisites, installs dependencies on first run, creates .env,
// then launches the desktop app in development mode.
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, statSync } from "node:fs";

const isWin = process.platform === "win32";
const run = (cmd, args, opts = {}) => spawnSync(cmd, args, { stdio: "inherit", shell: isWin, ...opts });
const has = (cmd, args = ["--version"]) => {
  const r = spawnSync(cmd, args, { stdio: "ignore", shell: isWin });
  return !r.error && r.status === 0;
};
const fail = (msg) => {
  console.error(`\n✖ ${msg}\n`);
  process.exit(1);
};

const [major, minor] = process.versions.node.split(".").map(Number);
if (major < 22 || (major === 22 && minor < 13)) fail(`Node 22.13 or newer is needed (you have ${process.versions.node}). Install with: winget install OpenJS.NodeJS.LTS`);
if (!isWin) console.warn("⚠ Keepshot targets Windows. It will start here, but screen capture needs Windows.");
if (!has("cargo")) fail("Rust is needed to build the desktop shell. Install with: winget install Rustlang.Rustup  (then restart the terminal)");
if (!has("ffmpeg", ["-version"]) && !process.env.KEEPSHOT_FFMPEG) {
  console.warn("⚠ ffmpeg wasn't found. Keepshot will open, but capture and export need it.\n  Install with: winget install Gyan.FFmpeg  (then restart the terminal)\n");
}

const needsInstall = !existsSync("node_modules/.package-lock.json") ||
  statSync("package-lock.json").mtimeMs > statSync("node_modules/.package-lock.json").mtimeMs;
if (needsInstall) {
  console.log("→ Installing dependencies (first run only)…");
  if (run("npm", ["install", "--no-fund", "--no-audit"]).status !== 0) fail("npm install failed. See the output above.");
}

if (!existsSync(".env")) {
  copyFileSync(".env.example", ".env");
  console.log("→ Created .env from .env.example");
}

console.log("→ Starting Keepshot (the first build of the Rust side takes a few minutes)…");
const res = run("npx", ["tauri", "dev"]);
process.exit(res.status ?? 0);
