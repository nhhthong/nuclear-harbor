#!/usr/bin/env node
/**
 * Procedurally generates the web-app icons (T-17): dark disc, cyan ring, amber core, three
 * radiation-style blades. No binary source art. Output: public/icons/icon-{192,512}.png
 *
 *   node scripts/make-icons.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { deflateSync } from 'node:zlib';
import { root } from './lib/harness.mjs';

function crc32(buf) {
  let c;
  let crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function png(size, pixel) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixel((x + 0.5) / size, (y + 0.5) / size);
      const o = y * (size * 4 + 1) + 1 + x * 4;
      raw[o] = r;
      raw[o + 1] = g;
      raw[o + 2] = b;
      raw[o + 3] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function icon(u, v) {
  const dx = u - 0.5;
  const dy = v - 0.5;
  const r = Math.hypot(dx, dy);
  const ang = Math.atan2(dy, dx);
  const bg = [11, 14, 18, 255]; // full-bleed so the icon is also usable as maskable
  if (r < 0.07) return [255, 176, 32, 255];
  const blade = Math.cos(3 * ang) > 0.55 && r > 0.1 && r < 0.3;
  if (blade) return [255, 176, 32, 255];
  if (r > 0.36 && r < 0.42) return [102, 224, 255, 255];
  return bg;
}

const outDir = path.join(root, 'public', 'icons');
mkdirSync(outDir, { recursive: true });
for (const size of [192, 512]) {
  const file = path.join(outDir, `icon-${size}.png`);
  writeFileSync(file, png(size, icon));
  console.log(file);
}
