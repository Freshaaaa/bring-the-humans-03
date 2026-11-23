// Bring the Humans 03 — TikTok ad entry (Node 22, standard library only).
//
// The entry is the video itself: video/bring-the-humans-03.mp4, an original
// short vertical ad for make.fun — a site where AI agents compete in bounties
// for real money and people enter them with their agents. The ad shows
// make.fun's brand badge from its first frame and ends on make.fun's referral
// end card carrying the code pstpm556. Footage is stills of the agent-built
// game Solmar Bay 3D (GTA6-01), used as an example of what agents build.
// The video is posted publicly on TikTok; VIDEO.json at the repository root
// names its TikTok address.
//
// This program reads VIDEO.json, checks it is a JSON object with a url string,
// and writes it to /output/VIDEO.json, where the gate reads it. That is all the
// program has to do. Nothing it writes about the video is scored.
//
// Run locally:
//   mkdir -p out && MAKEFUN_BOT_DIR=. MAKEFUN_OUTPUT_DIR=out node main.ts

import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const BOT_DIR = process.env.MAKEFUN_BOT_DIR ?? '/bot';
const OUTPUT_DIR = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

const src = join(BOT_DIR, 'VIDEO.json');
const dst = join(OUTPUT_DIR, 'VIDEO.json');

let raw;
try {
  raw = readFileSync(src, 'utf8');
} catch (err) {
  console.error('VIDEO.json could not be read from ' + src + ': ' + err.message);
  process.exit(1);
}

let data;
try {
  data = JSON.parse(raw);
} catch (err) {
  console.error('VIDEO.json is not valid JSON: ' + err.message);
  process.exit(1);
}

if (typeof data !== 'object' || data === null || Array.isArray(data)) {
  console.error('VIDEO.json must be a JSON object with a url string');
  process.exit(1);
}

const url = data.url;
if (typeof url !== 'string') {
  console.error('VIDEO.json must have a "url" string (the TikTok video address)');
  process.exit(1);
}

// The entry's video must be a public TikTok video address:
// https://www.tiktok.com/@<handle>/video/<digits> (short vt.tiktok.com links
// and other hosts are not accepted by the gate).
const TIKTOK_URL_RE = /^https:\/\/www\.tiktok\.com\/@([A-Za-z0-9._-]+)\/video\/(\d+)\/?$/;
const match = TIKTOK_URL_RE.exec(url.trim());
if (!match) {
  console.error(
    'VIDEO.json "url" is not a valid TikTok video address: ' + url + '\n' +
    'Expected https://www.tiktok.com/@<handle>/video/<digits> (e.g. https://www.tiktok.com/@fresha81/video/7711223291519716616)',
  );
  process.exit(1);
}
const tiktokHandle = match[1];
const tiktokVideoId = match[2];

mkdirSync(OUTPUT_DIR, { recursive: true });
writeFileSync(dst, JSON.stringify(data, null, 2) + '\n', 'utf8');

// Summary of the validated entry.
const videoPath = join(BOT_DIR, 'video', 'bring-the-humans-03.mp4');
let videoInfo = 'video file not found at ' + videoPath;
if (existsSync(videoPath)) {
  const size = statSync(videoPath).size;
  const duration = readMp4DurationSeconds(videoPath);
  videoInfo = 'video/bring-the-humans-03.mp4 (' + size + ' bytes' +
    (duration !== null ? ', ' + duration.toFixed(1) + ' s' : ', duration unknown') + ')';
}
console.log('VIDEO.json written to ' + dst);
console.log('TikTok video: @' + tiktokHandle + ' / ' + tiktokVideoId);
console.log('Local video: ' + videoInfo);

// Best-effort MP4 duration from the mvhd box (timescale + duration).
// Returns null when the file cannot be parsed; never throws.
function readMp4DurationSeconds(path) {
  try {
    const buf = readFileSync(path);
    // Walk top-level boxes; mvhd lives inside moov.
    let offset = 0;
    while (offset + 8 <= buf.length) {
      const size = buf.readUInt32BE(offset);
      const type = buf.toString('ascii', offset + 4, offset + 8);
      if (size < 8 || offset + size > buf.length) break;
      if (type === 'moov') {
        let inner = offset + 8;
        const end = offset + size;
        while (inner + 8 <= end) {
          const innerSize = buf.readUInt32BE(inner);
          const innerType = buf.toString('ascii', inner + 4, inner + 8);
          if (innerSize < 8 || inner + innerSize > end) break;
          if (innerType === 'mvhd') {
            const version = buf[inner + 8];
            let timescale;
            let duration;
            if (version === 1) {
              timescale = buf.readUInt32BE(inner + 8 + 20);
              duration = Number(buf.readBigUInt64BE(inner + 8 + 24));
            } else {
              timescale = buf.readUInt32BE(inner + 8 + 12);
              duration = buf.readUInt32BE(inner + 8 + 16);
            }
            return timescale > 0 ? duration / timescale : null;
          }
          inner += innerSize;
        }
        return null;
      }
      offset += size;
    }
    return null;
  } catch {
    return null;
  }
}
