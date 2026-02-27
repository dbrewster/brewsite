#!/usr/bin/env node
/**
 * scripts/gen-diagram-envmap.mjs
 *
 * Generates a procedural equirectangular Radiance HDR (RGBE) environment map
 * for the @brewsite/diagram package.
 *
 * The map has a dark tech-blue sky gradient with three studio lights:
 *   - Key light:  warm white, upper-right-front  (dominant light source)
 *   - Fill light: cool blue,  upper-left-rear     (soft secondary)
 *   - Rim light:  warm amber, right-rear          (accent / separation)
 *
 * Output: packages/diagram/public/assets/envmaps/diagram-default.hdr
 *
 * Usage:
 *   node scripts/gen-diagram-envmap.mjs
 *   pnpm --filter @brewsite/diagram gen-envmap
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, '../packages/diagram/public/assets/envmaps');
const OUTPUT_FILE = join(OUTPUT_DIR, 'diagram-default.hdr');

const WIDTH  = 1024;
const HEIGHT = 512;

// ─── RGBE encoding ───────────────────────────────────────────────────────────
// Each pixel is stored as 4 bytes: R, G, B, E
// actual_color = (R/256, G/256, B/256) × 2^(E − 128)

function floatToRGBE(r, g, b) {
  const m = Math.max(r, g, b);
  if (m < 1e-32) return [0, 0, 0, 0];
  // exponent such that m maps to the range [0.5, 1)
  const exp = Math.ceil(Math.log2(m));
  const scale = Math.pow(2, -exp) * 255.9999;
  return [
    Math.max(0, Math.min(255, Math.floor(r * scale))),
    Math.max(0, Math.min(255, Math.floor(g * scale))),
    Math.max(0, Math.min(255, Math.floor(b * scale))),
    exp + 128,
  ];
}

// ─── Procedural sky ───────────────────────────────────────────────────────────
/**
 * Returns HDR [r, g, b] for a ray direction given by azimuth φ and elevation θ.
 * φ ∈ [0, 2π]  (0 = +Z front)
 * θ ∈ [-π/2, +π/2]  (+π/2 = zenith, -π/2 = nadir)
 */
function sampleSky(phi, theta) {
  const sinT = Math.sin(theta);
  const cosT = Math.cos(theta);

  // ── Base sky gradient ──────────────────────────────────────────────────────
  let r, g, b;
  if (sinT >= 0) {
    // Sky hemisphere: near-black blue at zenith, deeper navy at horizon
    const t = sinT; // 0 = horizon, 1 = zenith
    r = 0.012 + 0.010 * (1 - t);
    g = 0.020 + 0.020 * (1 - t);
    b = 0.070 + 0.060 * (1 - t);
  } else {
    // Ground hemisphere: near-black with a hint of warmth
    r = 0.010;
    g = 0.008;
    b = 0.010;
  }

  // ── Light helper ──────────────────────────────────────────────────────────
  // cos(angular distance) between current ray direction and a light direction
  const lightDot = (lPhi, lTheta) => {
    const lSinT = Math.sin(lTheta);
    const lCosT = Math.cos(lTheta);
    return (
      cosT * lCosT * Math.cos(phi - lPhi) +
      sinT * lSinT
    );
  };

  // ── Key light: warm white, upper-right-front (φ≈π/6, θ≈π/3) ──────────────
  {
    const d = Math.max(0, lightDot(Math.PI / 6, Math.PI / 3));
    const spot = Math.pow(d, 110);   // tight source disc
    const halo = Math.pow(d, 18) * 0.22; // soft falloff halo
    r += 5.5 * spot + halo * 0.55;
    g += 5.2 * spot + halo * 0.60;
    b += 4.8 * spot + halo * 0.80;
  }

  // ── Fill light: cool blue-white, upper-left-rear (φ≈5π/4, θ≈π/4) ─────────
  {
    const d = Math.max(0, lightDot(Math.PI + Math.PI / 4, Math.PI / 4));
    const spot = Math.pow(d, 70);
    const halo = Math.pow(d, 14) * 0.10;
    r += 0.5 * spot + halo * 0.30;
    g += 0.8 * spot + halo * 0.40;
    b += 2.2 * spot + halo * 0.90;
  }

  // ── Rim light: warm amber, right-rear (φ≈-π/3, θ≈π/6) ───────────────────
  {
    const d = Math.max(0, lightDot(-Math.PI / 3, Math.PI / 6));
    const spot = Math.pow(d, 55);
    const halo = Math.pow(d, 12) * 0.12;
    r += 2.8 * spot + halo * 0.90;
    g += 1.6 * spot + halo * 0.55;
    b += 0.4 * spot + halo * 0.20;
  }

  return [r, g, b];
}

// ─── Scanline writer (new-style Radiance RLE format) ─────────────────────────
/**
 * Writes a single scanline in the new-style RGBE format that Three.js RGBELoader
 * expects. Channels are RLE-encoded separately (one pass per RGBE channel).
 *
 * Scanline header: bytes [2, 2, WIDTH>>8, WIDTH&0xFF]
 * Each channel: sequence of (run | non-run) blocks
 *   - Run block:     byte > 128  → (byte − 128) repeats of next byte value
 *   - Non-run block: byte ≤ 128  → that many literal bytes follow
 */
function writeScanline(rChan, gChan, bChan, eChan) {
  const out = [2, 2, (WIDTH >> 8) & 0xff, WIDTH & 0xff];

  for (const channel of [rChan, gChan, bChan, eChan]) {
    let i = 0;
    while (i < WIDTH) {
      // Attempt to find a run (≥3 identical values)
      let runLen = 1;
      while (runLen < 127 && i + runLen < WIDTH && channel[i + runLen] === channel[i]) {
        runLen++;
      }

      if (runLen >= 3) {
        out.push(128 + runLen, channel[i]);
        i += runLen;
        continue;
      }

      // Non-run: find a stretch of non-repeating values
      let nonRunLen = 1;
      while (nonRunLen < 128 && i + nonRunLen < WIDTH) {
        const val = channel[i + nonRunLen];
        // Stop if the next 3 bytes are all the same (start of a run)
        if (
          i + nonRunLen + 2 < WIDTH &&
          channel[i + nonRunLen + 1] === val &&
          channel[i + nonRunLen + 2] === val
        ) break;
        nonRunLen++;
      }

      out.push(nonRunLen);
      for (let j = 0; j < nonRunLen; j++) out.push(channel[i + j]);
      i += nonRunLen;
    }
  }

  return out;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
console.log(`Generating ${WIDTH}×${HEIGHT} equirectangular Radiance HDR...`);

// Build one row of raw pixel data at a time and encode each scanline
const scanlineBytes = [];

for (let y = 0; y < HEIGHT; y++) {
  const rChan = new Uint8Array(WIDTH);
  const gChan = new Uint8Array(WIDTH);
  const bChan = new Uint8Array(WIDTH);
  const eChan = new Uint8Array(WIDTH);

  for (let x = 0; x < WIDTH; x++) {
    // Standard equirectangular mapping
    const phi   = (x / WIDTH) * 2 * Math.PI;                  // [0, 2π]
    const theta = (0.5 - y / HEIGHT) * Math.PI;               // [+π/2, -π/2] top→bottom

    const [r, gr, bl] = sampleSky(phi, theta);
    const [re, ge, be, e] = floatToRGBE(r, gr, bl);

    rChan[x] = re;
    gChan[x] = ge;
    bChan[x] = be;
    eChan[x] = e;
  }

  scanlineBytes.push(writeScanline(rChan, gChan, bChan, eChan));
}

// ─── Assemble Radiance HDR file ───────────────────────────────────────────────
// Header: ends with a blank line, then the resolution string, then another newline
const header =
  '#?RADIANCE\n' +
  'FORMAT=32-bit_rle_rgbe\n' +
  'EXPOSURE=1.0\n' +
  'SOFTWARE=gen-diagram-envmap.mjs\n' +
  '\n' +
  `-Y ${HEIGHT} +X ${WIDTH}\n`;

const headerBuf = Buffer.from(header, 'ascii');
const totalPixelBytes = scanlineBytes.reduce((sum, arr) => sum + arr.length, 0);
const fileBuffer = Buffer.allocUnsafe(headerBuf.length + totalPixelBytes);

headerBuf.copy(fileBuffer, 0);
let offset = headerBuf.length;
for (const scanline of scanlineBytes) {
  for (let i = 0; i < scanline.length; i++) {
    fileBuffer[offset++] = scanline[i];
  }
}

mkdirSync(OUTPUT_DIR, { recursive: true });
writeFileSync(OUTPUT_FILE, fileBuffer);

const kb = (fileBuffer.length / 1024).toFixed(1);
console.log(`✓ Written: ${OUTPUT_FILE}`);
console.log(`  File size: ${kb} KB`);
console.log(`  Dimensions: ${WIDTH}×${HEIGHT} RGBE`);
