import fs from "fs";
import path from "path";
import { convertToHls } from "../src/services/ffmpeg.js";

const input = process.argv[2];
if (!input) {
  console.log("Usage: node scripts/bench-ffmpeg.js <video file>");
  process.exit(1);
}

function folderSize(dir) {
  let total = 0;
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, item.name);
    total += item.isDirectory() ? folderSize(p) : fs.statSync(p).size;
  }
  return total;
}

const mb = (n) => (n / 1024 / 1024).toFixed(1) + " MB";
const out = path.resolve("storage", "bench", path.basename(input, path.extname(input)));
fs.rmSync(out, { recursive: true, force: true });

const started = Date.now();
const result = await convertToHls(input, out);
const secs = (Date.now() - started) / 1000;

console.log({
  file: path.basename(input),
  videoLengthSec: result.duration,
  conversionSec: Number(secs.toFixed(1)),
  speed: (result.duration / secs).toFixed(2) + "x",
  renditions: result.renditions.join("p, ") + "p",
  rawSize: mb(fs.statSync(input).size),
  hlsSize: mb(folderSize(out)),
});