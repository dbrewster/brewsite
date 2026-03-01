import { describe, it, expect, beforeEach } from 'vitest';
import { ChartMaterialFactory } from '../shared/ChartMaterialFactory';
import { darkGlassChartTheme } from '../../themes/darkGlass';
import { enterpriseChartTheme } from '../../themes/enterprise';

// We test the pure caching contract. Three.js constructors are real (node env).
// We mock THREE to avoid WebGL requirements.
vi.mock('three', () => {
  class MockMaterial {
    color = { set: vi.fn() };
    opacity = 1;
    transparent = false;
    transmission = 0;
    emissiveIntensity = 0;
    metalness = 0;
    roughness = 0;
    dispose = vi.fn();
    constructor(opts: Record<string, unknown> = {}) {
      Object.assign(this, opts);
    }
  }
  class MeshPhysicalMaterial extends MockMaterial {
    constructor(opts: Record<string, unknown> = {}) { super(opts); }
  }
  class LineBasicMaterial extends MockMaterial {}
  class MeshStandardMaterial extends MockMaterial {}
  class Color { constructor(_: unknown) {} set(_: unknown) {} }
  const FrontSide = 0;
  return { MeshPhysicalMaterial, LineBasicMaterial, MeshStandardMaterial, Color, FrontSide };
});

import { vi } from 'vitest';

describe('ChartMaterialFactory', () => {
  let factory: ChartMaterialFactory;

  beforeEach(() => {
    factory = new ChartMaterialFactory();
  });

  it('returns the same instance for the same series tokens', () => {
    const mat1 = factory.getSeriesMaterial(darkGlassChartTheme, 0);
    const mat2 = factory.getSeriesMaterial(darkGlassChartTheme, 0);
    expect(mat1).toBe(mat2);
  });

  it('returns different instances for different series indices', () => {
    const mat0 = factory.getSeriesMaterial(darkGlassChartTheme, 0);
    const mat1 = factory.getSeriesMaterial(darkGlassChartTheme, 1);
    expect(mat0).not.toBe(mat1);
  });

  it('wraps series index modulo series count', () => {
    const seriesCount = darkGlassChartTheme.series.length;
    const mat0 = factory.getSeriesMaterial(darkGlassChartTheme, 0);
    const matWrapped = factory.getSeriesMaterial(darkGlassChartTheme, seriesCount);
    expect(mat0).toBe(matWrapped);
  });

  it('dispose clears all cached materials', () => {
    const mat = factory.getSeriesMaterial(darkGlassChartTheme, 0);
    factory.dispose();
    // After dispose, getting the same series creates a new instance
    const mat2 = factory.getSeriesMaterial(darkGlassChartTheme, 0);
    expect(mat).not.toBe(mat2);
  });
});
