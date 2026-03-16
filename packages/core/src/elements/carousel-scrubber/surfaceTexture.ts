// Procedural normal-map generation for carousel tray surface textures.
// Render-adjacent utility: uses Canvas 2D API, produces THREE.CanvasTexture.

import * as THREE from 'three';
import type { CarouselTraySurfacePattern } from './types';

/** Resolution of the generated normal map canvas. */
const TEX_SIZE = 512;

/** Cache for procedural textures keyed by pattern name. */
const proceduralCache = new Map<CarouselTraySurfacePattern, THREE.CanvasTexture>();

/** Cache for URL-loaded textures keyed by URL string. */
const urlCache = new Map<string, Promise<THREE.Texture>>();

/**
 * Deterministic 2D hash function for grain noise generation.
 * Returns a value in [0, 1].
 */
function hash2D(x: number, y: number): number {
  const h = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return h - Math.floor(h);
}

/**
 * Bilinear interpolation between four hash values at integer grid corners.
 */
function bilinearNoise(x: number, y: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;

  const tl = hash2D(ix, iy);
  const tr = hash2D(ix + 1, iy);
  const bl = hash2D(ix, iy + 1);
  const br = hash2D(ix + 1, iy + 1);

  const top = tl + (tr - tl) * fx;
  const bottom = bl + (br - bl) * fx;
  return top + (bottom - top) * fy;
}

/**
 * Encodes a tangent-space normal (nx, ny, nz) into an RGBA pixel value.
 * Flat surface (no perturbation) encodes as (128, 128, 255, 255).
 */
function encodeNormal(nx: number, ny: number, nz: number): [number, number, number, number] {
  return [
    Math.round((nx * 0.5 + 0.5) * 255),
    Math.round((ny * 0.5 + 0.5) * 255),
    Math.round((nz * 0.5 + 0.5) * 255),
    255,
  ];
}

/**
 * Fills a Uint8ClampedArray with the 'brushed' pattern: fine radial lines
 * emanating from the center of the canvas (turned-on-a-lathe look).
 *
 * The pattern varies with distance from center: stronger in the mid-ring,
 * fading toward center and edges. A subtle noise overlay breaks up uniformity.
 */
function fillBrushed(data: Uint8ClampedArray): void {
  const lineCount = 120;
  for (let py = 0; py < TEX_SIZE; py++) {
    const v = py / TEX_SIZE;
    for (let px = 0; px < TEX_SIZE; px++) {
      const u = px / TEX_SIZE;
      const dx = u - 0.5;
      const dy = v - 0.5;
      const dist = Math.sqrt(dx * dx + dy * dy) * 2; // 0 at center, 1 at edge
      const theta = Math.atan2(dy, dx);

      // Vary line density with distance — more lines toward the edge
      const localLineCount = lineCount + dist * 40;
      const d = Math.sin(theta * localLineCount) * 0.5;

      // Radial envelope: fade at center, peak at ~60% radius, fade at edge
      const envelope = Math.sin(Math.min(dist, 1) * Math.PI) * (0.7 + 0.3 * dist);

      // Noise overlay for organic variation
      const noise = hash2D(u * 50, v * 50) * 0.15 - 0.075;

      const strength = (d * envelope + noise) * 0.5;
      const nx = Math.cos(theta) * strength;
      const ny = Math.sin(theta) * strength;
      const nzSq = 1 - nx * nx - ny * ny;
      const nz = Math.sqrt(Math.max(nzSq, 0));

      const idx = (py * TEX_SIZE + px) * 4;
      const [r, g, b, a] = encodeNormal(nx, ny, nz);
      data[idx] = r;
      data[idx + 1] = g;
      data[idx + 2] = b;
      data[idx + 3] = a;
    }
  }
}

/**
 * Fills a Uint8ClampedArray with the 'radial' pattern: concentric rings
 * from center (machined/turned metal look).
 *
 * Ring spacing varies with distance — tighter toward the edge like a real
 * machined surface. A subtle angular wobble breaks perfect symmetry.
 */
function fillRadial(data: Uint8ClampedArray): void {
  const ringCount = 40;
  for (let py = 0; py < TEX_SIZE; py++) {
    const v = py / TEX_SIZE;
    for (let px = 0; px < TEX_SIZE; px++) {
      const u = px / TEX_SIZE;
      const dx = u - 0.5;
      const dy = v - 0.5;
      const r = Math.sqrt(dx * dx + dy * dy) * 2;
      const theta = Math.atan2(dy, dx);

      // Wobble ring radius slightly with angle for organic feel
      const wobble = Math.sin(theta * 7) * 0.02 + Math.sin(theta * 13) * 0.01;
      const rWobbled = r + wobble;

      // Tighter rings toward the edge (quadratic spacing)
      const ringPhase = rWobbled * (1 + rWobbled * 0.5) * ringCount * Math.PI * 2;
      const d = Math.sin(ringPhase) * 0.5;

      // Fade at center to avoid singularity artifact
      const fade = Math.min(r * 4, 1);

      const rSafe = Math.max(r, 0.001);
      const dirX = dx / rSafe;
      const dirY = dy / rSafe;
      const nx = dirX * d * 0.5 * fade;
      const ny = dirY * d * 0.5 * fade;
      const nzSq = 1 - nx * nx - ny * ny;
      const nz = Math.sqrt(Math.max(nzSq, 0));

      const idx = (py * TEX_SIZE + px) * 4;
      const [rv, g, b, a] = encodeNormal(nx, ny, nz);
      data[idx] = rv;
      data[idx + 1] = g;
      data[idx + 2] = b;
      data[idx + 3] = a;
    }
  }
}

/**
 * Fills a Uint8ClampedArray with the 'crosshatch' pattern: two sets of
 * diagonal lines at +/-45 degrees (knurled/diamond feel).
 *
 * The diamond depth varies with a low-frequency wave so some regions are
 * deeper than others, creating visual interest across the surface.
 */
function fillCrosshatch(data: Uint8ClampedArray): void {
  const lineCount = 60;
  for (let py = 0; py < TEX_SIZE; py++) {
    const v = py / TEX_SIZE;
    for (let px = 0; px < TEX_SIZE; px++) {
      const u = px / TEX_SIZE;
      const d1 = Math.sin((u + v) * lineCount * Math.PI * 2) * 0.5;
      const d2 = Math.sin((u - v) * lineCount * Math.PI * 2) * 0.5;
      const d = d1 * d2;

      // Low-frequency modulation — varies diamond depth across the surface
      const mod = 0.6 + 0.4 * Math.sin(u * 5 * Math.PI) * Math.sin(v * 7 * Math.PI);

      // Subtle noise breaks up the perfect grid
      const noise = hash2D(u * 30, v * 30) * 0.1;

      const strength = (d * mod + noise) * 0.4;
      const nx = strength;
      const ny = strength;
      const nzSq = 1 - nx * nx - ny * ny;
      const nz = Math.sqrt(Math.max(nzSq, 0));

      const idx = (py * TEX_SIZE + px) * 4;
      const [r, g, b, a] = encodeNormal(nx, ny, nz);
      data[idx] = r;
      data[idx + 1] = g;
      data[idx + 2] = b;
      data[idx + 3] = a;
    }
  }
}

/**
 * Fills a Uint8ClampedArray with the 'grain' pattern: multi-octave noise
 * with smooth bilinear interpolation (organic stone/onyx feel).
 *
 * Uses three octaves at different frequencies and amplitudes for rich,
 * non-repetitive variation that looks like natural stone grain.
 */
function fillGrain(data: Uint8ClampedArray): void {
  const step = 1 / TEX_SIZE;

  // Three octaves: coarse veins, medium grain, fine detail
  const octaves = [
    { freq: 20, amp: 0.35 },  // large-scale veins
    { freq: 60, amp: 0.25 },  // medium grain
    { freq: 120, amp: 0.12 }, // fine detail
  ];

  for (let py = 0; py < TEX_SIZE; py++) {
    const v = py / TEX_SIZE;
    for (let px = 0; px < TEX_SIZE; px++) {
      const u = px / TEX_SIZE;

      let totalDdx = 0;
      let totalDdy = 0;

      for (const { freq, amp } of octaves) {
        const su = u * freq;
        const sv = v * freq;

        const center = bilinearNoise(su, sv);
        const right = bilinearNoise(su + step * freq, sv);
        const up = bilinearNoise(su, sv + step * freq);

        totalDdx += (right - center) * amp;
        totalDdy += (up - center) * amp;
      }

      const nx = -totalDdx;
      const ny = -totalDdy;
      const nzSq = 1 - nx * nx - ny * ny;
      const nz = Math.sqrt(Math.max(nzSq, 0));

      const idx = (py * TEX_SIZE + px) * 4;
      const [r, g, b, a] = encodeNormal(nx, ny, nz);
      data[idx] = r;
      data[idx + 1] = g;
      data[idx + 2] = b;
      data[idx + 3] = a;
    }
  }
}

/**
 * Generates a procedural normal map for the given surface pattern.
 *
 * Returns a THREE.CanvasTexture with RepeatWrapping. The texture is ready
 * for use as material.normalMap. Caller controls intensity via
 * material.normalScale.
 *
 * Results are cached by pattern name. Calling with the same pattern returns
 * the same texture instance.
 *
 * @param pattern - The surface pattern to generate.
 * @returns A THREE.CanvasTexture, or null for 'none'.
 */
export function generateSurfaceNormalMap(
  pattern: CarouselTraySurfacePattern,
): THREE.CanvasTexture | null {
  if (pattern === 'none') return null;

  const cached = proceduralCache.get(pattern);
  if (cached) return cached;

  const canvas = document.createElement('canvas');
  canvas.width = TEX_SIZE;
  canvas.height = TEX_SIZE;
  const ctx = canvas.getContext('2d')!;
  const imageData = ctx.createImageData(TEX_SIZE, TEX_SIZE);

  switch (pattern) {
    case 'brushed':
      fillBrushed(imageData.data);
      break;
    case 'radial':
      fillRadial(imageData.data);
      break;
    case 'crosshatch':
      fillCrosshatch(imageData.data);
      break;
    case 'grain':
      fillGrain(imageData.data);
      break;
  }

  ctx.putImageData(imageData, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;

  proceduralCache.set(pattern, texture);
  return texture;
}

/**
 * Loads an external texture URL as a normal map.
 * Uses THREE.TextureLoader. Returns a promise that resolves
 * when the texture is loaded. Results are cached by URL.
 *
 * @param url - The URL of the texture to load.
 * @returns A Promise resolving to the loaded THREE.Texture.
 */
export function loadCustomSurfaceMap(
  url: string,
): Promise<THREE.Texture> {
  const cached = urlCache.get(url);
  if (cached) return cached;

  const loader = new THREE.TextureLoader();
  const promise = new Promise<THREE.Texture>((resolve, reject) => {
    loader.load(
      url,
      (texture) => {
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        resolve(texture);
      },
      undefined,
      (err) => {
        urlCache.delete(url);
        reject(err);
      },
    );
  });

  urlCache.set(url, promise);
  return promise;
}
