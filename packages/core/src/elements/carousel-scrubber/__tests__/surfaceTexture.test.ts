// Tests for surfaceTexture.ts — procedural normal map generation.
// Uses a mock canvas for the Node test environment.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as THREE from 'three';

/**
 * Creates a minimal mock canvas that satisfies the Canvas 2D API surface
 * used by surfaceTexture.ts: getContext('2d') returning createImageData/putImageData.
 */
function createMockCanvas(width: number, height: number): {
  width: number;
  height: number;
  getContext: (type: string) => {
    createImageData: (w: number, h: number) => { data: Uint8ClampedArray; width: number; height: number };
    putImageData: () => void;
  };
} {
  return {
    width,
    height,
    getContext: (_type: string) => ({
      createImageData: (w: number, h: number) => ({
        data: new Uint8ClampedArray(w * h * 4),
        width: w,
        height: h,
      }),
      putImageData: () => { /* no-op in test */ },
    }),
  };
}

// Stub document.createElement to return mock canvases in Node.
// Also stub createElementNS for THREE.TextureLoader which creates img elements.
const originalDocument = globalThis.document;

beforeEach(() => {
  vi.stubGlobal('document', {
    createElement: (tag: string) => {
      if (tag === 'canvas') return createMockCanvas(512, 512);
      // Return a minimal mock element for other tags
      return { style: {} };
    },
    createElementNS: (_ns: string, tag: string) => {
      if (tag === 'img') {
        // Return a minimal mock img element that never fires load/error
        return { style: {}, crossOrigin: '', src: '' };
      }
      return { style: {} };
    },
  });
});

afterEach(() => {
  if (originalDocument) {
    vi.stubGlobal('document', originalDocument);
  } else {
    vi.unstubAllGlobals();
  }
  // Clear module cache so the module-level Map caches reset between tests.
  vi.resetModules();
});

describe('generateSurfaceNormalMap', () => {
  it('returns null for "none" pattern', async () => {
    const { generateSurfaceNormalMap } = await import('../surfaceTexture');
    const result = generateSurfaceNormalMap('none');
    expect(result).toBeNull();
  });

  it('returns a THREE.CanvasTexture for "brushed" pattern', async () => {
    const { generateSurfaceNormalMap } = await import('../surfaceTexture');
    const result = generateSurfaceNormalMap('brushed');
    expect(result).not.toBeNull();
    expect(result).toBeInstanceOf(THREE.CanvasTexture);
    expect(result!.wrapS).toBe(THREE.RepeatWrapping);
    expect(result!.wrapT).toBe(THREE.RepeatWrapping);
  });

  it('returns a texture for "radial" pattern', async () => {
    const { generateSurfaceNormalMap } = await import('../surfaceTexture');
    const result = generateSurfaceNormalMap('radial');
    expect(result).not.toBeNull();
    expect(result).toBeInstanceOf(THREE.CanvasTexture);
  });

  it('returns a texture for "crosshatch" pattern', async () => {
    const { generateSurfaceNormalMap } = await import('../surfaceTexture');
    const result = generateSurfaceNormalMap('crosshatch');
    expect(result).not.toBeNull();
    expect(result).toBeInstanceOf(THREE.CanvasTexture);
  });

  it('returns a texture for "grain" pattern', async () => {
    const { generateSurfaceNormalMap } = await import('../surfaceTexture');
    const result = generateSurfaceNormalMap('grain');
    expect(result).not.toBeNull();
    expect(result).toBeInstanceOf(THREE.CanvasTexture);
  });

  it('returns the same cached instance for repeated calls with same pattern', async () => {
    const { generateSurfaceNormalMap } = await import('../surfaceTexture');
    const first = generateSurfaceNormalMap('brushed');
    const second = generateSurfaceNormalMap('brushed');
    expect(first).toBe(second);
  });

  it('returns different instances for different patterns', async () => {
    const { generateSurfaceNormalMap } = await import('../surfaceTexture');
    const brushed = generateSurfaceNormalMap('brushed');
    const radial = generateSurfaceNormalMap('radial');
    expect(brushed).not.toBe(radial);
  });
});

describe('loadCustomSurfaceMap', () => {
  it('is exported as a function', async () => {
    const { loadCustomSurfaceMap } = await import('../surfaceTexture');
    expect(typeof loadCustomSurfaceMap).toBe('function');
  });
});
