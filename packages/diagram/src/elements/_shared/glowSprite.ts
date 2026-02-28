// Shared WebGL utility — Three.js only, no React, no compiler imports.

import * as THREE from 'three';

let cachedTexture: THREE.CanvasTexture | null = null;

const createCanvas = (size: number): HTMLCanvasElement => {
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    return canvas;
  }
  if (typeof OffscreenCanvas !== 'undefined') {
    return new OffscreenCanvas(size, size) as unknown as HTMLCanvasElement;
  }
  return { width: size, height: size, getContext: () => null } as unknown as HTMLCanvasElement;
};

export function createGlowTexture(): THREE.CanvasTexture {
  if (cachedTexture) return cachedTexture;

  const size = 128;
  const canvas = createCanvas(size);
  const ctx = canvas.getContext?.('2d') ?? null;
  if (!ctx) {
    const fallback = new THREE.CanvasTexture(canvas);
    cachedTexture = fallback;
    return fallback;
  }

  const gradient = ctx.createRadialGradient(
    size / 2,
    size / 2,
    0,
    size / 2,
    size / 2,
    size / 2,
  );
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  cachedTexture = texture;
  return texture;
}

export function createGlow(
  color: string,
  contentWidth: number,
  contentHeight: number,
  spread: number,
  opacity: number,
): THREE.Sprite {
  const material = new THREE.SpriteMaterial({
    map: createGlowTexture(),
    color: new THREE.Color(color),
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
    opacity,
  });
  const sprite = new THREE.Sprite(material);
  const [glowW, glowH] = computeGlowScale(contentWidth, contentHeight, spread);
  sprite.scale.set(glowW, glowH, 1);
  sprite.position.z = -0.1;
  return sprite;
}

/**
 * Computes glow dimensions that stay visually close to the node bounds.
 * Uses additive expansion (padding) based on the shorter side so ultra-wide
 * nodes don't project huge stretched halos across the scene.
 */
export function computeGlowScale(
  contentWidth: number,
  contentHeight: number,
  spread: number,
): readonly [number, number] {
  const w = Math.max(0, contentWidth);
  const h = Math.max(0, contentHeight);
  const minSide = Math.max(0.001, Math.min(w, h));
  const halo = minSide * Math.max(0, spread - 1) * 0.5;
  return [w + halo * 2, h + halo * 2];
}

/**
 * Dispose the SpriteMaterial owned by a glow sprite.
 * The shared canvas texture (createGlowTexture) is module-cached and must NOT
 * be disposed here — only the per-sprite SpriteMaterial is owned by this instance.
 */
export function disposeGlowSprite(sprite: THREE.Sprite): void {
  sprite.material.dispose();
}
