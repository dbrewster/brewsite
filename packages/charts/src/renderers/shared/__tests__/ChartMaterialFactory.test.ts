// ChartMaterialFactory tests — caching, opacity, and type safety.

import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('three', () => {
  function parseCssColor(input: string): { r: number; g: number; b: number } {
    // Handle rgb(r, g, b) format from d3-scale-chromatic
    const rgbMatch = input.match(/^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/);
    if (rgbMatch) {
      return {
        r: parseInt(rgbMatch[1]!, 10) / 255,
        g: parseInt(rgbMatch[2]!, 10) / 255,
        b: parseInt(rgbMatch[3]!, 10) / 255,
      };
    }
    // Handle hex format
    const h = input.replace('#', '');
    if (h.length === 6 || h.length === 8) {
      return {
        r: parseInt(h.substring(0, 2), 16) / 255,
        g: parseInt(h.substring(2, 4), 16) / 255,
        b: parseInt(h.substring(4, 6), 16) / 255,
      };
    }
    return { r: 0, g: 0, b: 0 };
  }

  class Color {
    r = 0; g = 0; b = 0;
    constructor(input?: string | number | Color) {
      if (typeof input === 'string') {
        const parsed = parseCssColor(input);
        this.r = parsed.r; this.g = parsed.g; this.b = parsed.b;
      }
    }
    set(input: string | Color) {
      if (typeof input === 'string') {
        const parsed = parseCssColor(input);
        this.r = parsed.r; this.g = parsed.g; this.b = parsed.b;
      } else if (input instanceof Color) {
        this.r = input.r; this.g = input.g; this.b = input.b;
      }
      return this;
    }
  }

  class MockMaterial {
    color: Color;
    opacity = 1;
    transparent = false;
    dispose = vi.fn();
    constructor(opts: Record<string, unknown> = {}) {
      this.color = (opts['color'] as Color) ?? new Color();
      Object.assign(this, opts);
    }
  }

  class MeshPhysicalMaterial extends MockMaterial {
    transmission = 0;
    emissive: Color;
    emissiveIntensity = 0;
    metalness = 0;
    roughness = 0;
    side = 0;
    constructor(opts: Record<string, unknown> = {}) {
      super(opts);
      this.emissive = (opts['emissive'] as Color) ?? new Color();
      if (opts['transmission'] !== undefined) this.transmission = opts['transmission'] as number;
      if (opts['emissiveIntensity'] !== undefined) this.emissiveIntensity = opts['emissiveIntensity'] as number;
      if (opts['metalness'] !== undefined) this.metalness = opts['metalness'] as number;
      if (opts['roughness'] !== undefined) this.roughness = opts['roughness'] as number;
      if (opts['side'] !== undefined) this.side = opts['side'] as number;
      if (opts['opacity'] !== undefined) this.opacity = opts['opacity'] as number;
      if (opts['transparent'] !== undefined) this.transparent = opts['transparent'] as boolean;
    }
  }

  class LineBasicMaterial extends MockMaterial {}

  class MeshStandardMaterial extends MockMaterial {
    metalness = 0;
    roughness = 0;
    side = 0;
    constructor(opts: Record<string, unknown> = {}) {
      super(opts);
      if (opts['metalness'] !== undefined) this.metalness = opts['metalness'] as number;
      if (opts['roughness'] !== undefined) this.roughness = opts['roughness'] as number;
    }
  }

  const FrontSide = 0;

  return { Color, MeshPhysicalMaterial, LineBasicMaterial, MeshStandardMaterial, FrontSide };
});

vi.mock('@brewsite/core', () => ({
  parseHexColor: (hex: string) => ({
    rgb: hex.length === 9 && hex[0] === '#' ? hex.slice(0, 7) : hex,
    alpha: hex.length === 9 && hex[0] === '#' ? parseInt(hex.slice(7, 9), 16) / 255 : 1,
  }),
}));

import * as THREE from 'three';
import { ChartMaterialFactory } from '../ChartMaterialFactory';
import { darkGlassChartTheme } from '../../../themes/darkGlass';
import { enterpriseChartTheme } from '../../../themes/enterprise';

describe('ChartMaterialFactory', () => {
  let factory: ChartMaterialFactory;

  beforeEach(() => {
    factory = new ChartMaterialFactory();
  });

  it('getSeriesMaterial returns a MeshPhysicalMaterial', () => {
    const mat = factory.getSeriesMaterial(darkGlassChartTheme, 0);
    expect(mat).toBeInstanceOf(THREE.MeshPhysicalMaterial);
  });

  it('getSeriesMaterial with same theme + seriesIndex returns the same cached instance', () => {
    const mat1 = factory.getSeriesMaterial(darkGlassChartTheme, 0);
    const mat2 = factory.getSeriesMaterial(darkGlassChartTheme, 0);
    expect(mat1).toBe(mat2);
  });

  it('getSeriesMaterial returns different instances for different series', () => {
    const mat0 = factory.getSeriesMaterial(darkGlassChartTheme, 0);
    const mat1 = factory.getSeriesMaterial(darkGlassChartTheme, 1);
    expect(mat0).not.toBe(mat1);
  });

  it('getSeriesMaterial wraps series index modulo series count', () => {
    const count = darkGlassChartTheme.series.length;
    const mat0 = factory.getSeriesMaterial(darkGlassChartTheme, 0);
    const matWrapped = factory.getSeriesMaterial(darkGlassChartTheme, count);
    expect(mat0).toBe(matWrapped);
  });

  it('applyOpacity on non-transmissive material sets mat.opacity directly', () => {
    // enterprise theme has transmission=0 for series[0]
    const mat = factory.getSeriesMaterial(enterpriseChartTheme, 0);
    // Manually set transmission to 0 to ensure non-transmissive
    (mat as { transmission: number }).transmission = 0;
    factory.applyOpacity(0.5);
    // min(0.5, 1.0) = 0.5
    expect(mat.opacity).toBe(0.5);
    // emissiveIntensity scales with opacity when userData is available
    if (mat.userData) {
      expect(mat.emissiveIntensity).toBeCloseTo(
        (mat.userData.baseEmissiveIntensity as number) * 0.5,
      );
    }
  });

  it('applyOpacity on transmissive material caps at 0.85', () => {
    const mat = factory.getSeriesMaterial(darkGlassChartTheme, 0);
    // darkGlass series[0] has transmission=0.3 (> 0), so cap applies
    factory.applyOpacity(1.0);
    expect(mat.opacity).toBe(0.85);
  });

  it('applyOpacity below cap is used as-is for transmissive material', () => {
    const mat = factory.getSeriesMaterial(darkGlassChartTheme, 0);
    factory.applyOpacity(0.5);
    // min(0.5, 0.85) = 0.5
    expect(mat.opacity).toBe(0.5);
  });

  it('createAxisMaterial returns a LineBasicMaterial', () => {
    const mat = factory.createAxisMaterial(darkGlassChartTheme);
    expect(mat).toBeInstanceOf(THREE.LineBasicMaterial);
  });

  it('createAxisMaterial caches by theme axis color', () => {
    const mat1 = factory.createAxisMaterial(darkGlassChartTheme);
    const mat2 = factory.createAxisMaterial(darkGlassChartTheme);
    expect(mat1).toBe(mat2);
  });

  it('createFloorMaterial returns null when planeColor is null', () => {
    const theme = { ...darkGlassChartTheme, background: { ...darkGlassChartTheme.background, planeColor: null } };
    const mat = factory.createFloorMaterial(theme);
    expect(mat).toBeNull();
  });

  it('createFloorMaterial returns MeshStandardMaterial when planeColor is set', () => {
    const mat = factory.createFloorMaterial(darkGlassChartTheme);
    expect(mat).toBeInstanceOf(THREE.MeshStandardMaterial);
  });

  it('dispose calls dispose on all cached materials', () => {
    const mat1 = factory.getSeriesMaterial(darkGlassChartTheme, 0);
    const mat2 = factory.createAxisMaterial(darkGlassChartTheme);
    factory.dispose();
    expect(mat1.dispose).toHaveBeenCalled();
    expect(mat2.dispose).toHaveBeenCalled();
  });

  it('dispose clears cache so new materials are created on next call', () => {
    const mat1 = factory.getSeriesMaterial(darkGlassChartTheme, 0);
    factory.dispose();
    const mat2 = factory.getSeriesMaterial(darkGlassChartTheme, 0);
    expect(mat1).not.toBe(mat2);
  });

  describe('getColorFieldMaterial', () => {
    it('returns a MeshPhysicalMaterial with the provided opacity', () => {
      const color = new THREE.Color('#ff0000');
      const mat = factory.getColorFieldMaterial(color, 0.6);
      expect(mat).toBeInstanceOf(THREE.MeshPhysicalMaterial);
      expect(mat.opacity).toBeCloseTo(0.6);
    });

    it('sets transparent=true when opacity < 1', () => {
      const color = new THREE.Color('#00ff00');
      const mat = factory.getColorFieldMaterial(color, 0.5);
      expect(mat.transparent).toBe(true);
    });

    it('sets transparent=false when opacity === 1', () => {
      const color = new THREE.Color('#0000ff');
      const mat = factory.getColorFieldMaterial(color, 1);
      expect(mat.transparent).toBe(false);
    });

    it('returns a fresh (non-cached) instance each call', () => {
      const color = new THREE.Color('#ffffff');
      const mat1 = factory.getColorFieldMaterial(color, 1);
      const mat2 = factory.getColorFieldMaterial(color, 1);
      expect(mat1).not.toBe(mat2);
    });
  });

  describe('ChartMaterialFactory.interpolateColor', () => {
    it('viridis at 0 produces a dark color (low R, low G)', () => {
      const color = ChartMaterialFactory.interpolateColor(0, 'viridis');
      // viridis(0) ≈ #440154 — dark purple: R≈0.27, G≈0.00, B≈0.33
      expect(color.r).toBeLessThan(0.4);
    });

    it('viridis at 1 produces a bright yellowish color (high R, high G)', () => {
      const color = ChartMaterialFactory.interpolateColor(1, 'viridis');
      // viridis(1) ≈ #fde725 — bright yellow: R≈0.99, G≈0.91, B≈0.14
      expect(color.r).toBeGreaterThan(0.8);
      expect(color.g).toBeGreaterThan(0.7);
    });

    it('blues at 0 produces a near-white color (high RGB)', () => {
      const color = ChartMaterialFactory.interpolateColor(0, 'blues');
      // blues(0) ≈ #f7fbff — very light blue
      expect(color.r).toBeGreaterThan(0.8);
    });

    it('reds at 1 produces a dark red color (high R, low G, low B)', () => {
      const color = ChartMaterialFactory.interpolateColor(1, 'reds');
      // reds(1) ≈ #67000d — dark red
      expect(color.r).toBeGreaterThan(0.3);
      expect(color.g).toBeLessThan(0.2);
    });

    it('plasma at 0.5 produces a mid-range color', () => {
      const color = ChartMaterialFactory.interpolateColor(0.5, 'plasma');
      // Should be valid (non-black, non-white)
      const brightness = color.r + color.g + color.b;
      expect(brightness).toBeGreaterThan(0.1);
      expect(brightness).toBeLessThan(2.9);
    });

    it('undefined interpolator falls back to viridis', () => {
      const color = ChartMaterialFactory.interpolateColor(0, undefined);
      // viridis(0) ≈ dark purple — R < 0.4
      expect(color.r).toBeLessThan(0.4);
    });
  });
});
