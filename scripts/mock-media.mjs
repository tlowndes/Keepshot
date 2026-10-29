// Generates sample media for the dev-only browser preview (public/mock, git-ignored).
import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";

const out = "public/mock";
mkdirSync(out, { recursive: true });
const ff = (args) => {
  const r = spawnSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...args], { stdio: "inherit" });
  if (r.status !== 0) process.exit(r.status ?? 1);
};
const scene = (hue) =>
  `color=c=0x${hue}:s=1280x720,drawbox=x=100:y=90:w=760:h=70:color=white@0.35:t=fill,` +
  `drawbox=x=100:y=200:w=1080:h=420:color=white@0.15:t=fill,drawbox=x=880:y=90:w=300:h=70:color=0x2f5bea:t=fill`;
ff(["-f", "lavfi", "-i", `${scene("2a303b")}`, "-frames:v", "1", `${out}/poster-1.jpg`]);
ff(["-f", "lavfi", "-i", `${scene("3a2b3b")}`, "-frames:v", "1", `${out}/poster-2.jpg`]);
ff(["-f", "lavfi", "-i", `${scene("23343a")}`, "-frames:v", "1", `${out}/poster-3.jpg`]);
ff(["-f", "lavfi", "-i", `color=c=0xeef1fb:s=1280x800,drawbox=x=160:y=120:w=420:h=560:color=0x1b1f26@0.12:t=fill,drawbox=x=700:y=120:w=420:h=560:color=0x2f5bea@0.25:t=fill`, "-frames:v", "1", `${out}/shot-1.png`]);
ff(["-f", "lavfi", "-i", `testsrc2=size=1280x720:rate=30:duration=20`, "-f", "lavfi", "-i", "sine=frequency=330:duration=20", "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", "-movflags", "+faststart", `${out}/source.mp4`]);
ff(["-i", `${out}/source.mp4`, "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "40", "-deadline", "realtime", "-cpu-used", "8", "-c:a", "libopus", `${out}/source.webm`]);
console.log(`Sample media written to ${out}/`);
