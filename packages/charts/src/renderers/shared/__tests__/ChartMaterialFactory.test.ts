// ChartMaterialFactory tests — caching, opacity, and type safety.

import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('three', () => {
  class Color {
    r = 0; g = 0; b = 0;
    constructor(hex?: string | number) {
      if (typeof hex === 'string') {
        // Simple hex parse for test
        const h = hex.replace('#', '');
        this.r = parseInt(h.substring(0, 2), 16) / 255;
        this.g = parseInt(h.substring(2, 4), 16) / 255;
        this.b = parseInt(h.substring(4, 6), 16) / 255;
      }
    }
    set(hex: string) {
      const h = hex.replace('#', '');
      this.r = parseInt(h.substring(0, 2), 16) / 255;
      this.g = parseInt(h.substring(2, 4), 16) / 255;
      this.b = parseInt(h.substring(4, 6), 16) / 255;
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
});
