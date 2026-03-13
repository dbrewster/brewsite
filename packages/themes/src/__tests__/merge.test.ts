import { describe, it, expect } from 'vitest';
import { mergeThemeBundle } from '../merge';
import { darkGlassBundle } from '../bundles/darkGlass';

describe('mergeThemeBundle', () => {
  it('returns a new bundle without mutating the original', () => {
    const original = darkGlassBundle.scene.dark.background?.fill;
    const merged = mergeThemeBundle(darkGlassBundle, {
      scene: { dark: { background: { fill: { kind: 'color', value: '#ff0000' } } } },
    });
    expect(merged.scene.dark.background?.fill).toEqual({ kind: 'color', value: '#ff0000' });
    expect(darkGlassBundle.scene.dark.background?.fill).toEqual(original); // not mutated
  });

  it('light polarity is unchanged when only dark is overridden', () => {
    const merged = mergeThemeBundle(darkGlassBundle, {
      scene: { dark: { colorMode: 'dark' } },
    });
    expect(merged.scene.light).toBe(darkGlassBundle.scene.light);
  });

  it('preserves family', () => {
    const merged = mergeThemeBundle(darkGlassBundle, {});
    expect(merged.family).toBe('darkGlass');
  });

  it('returns same bundle slices by reference when no overrides for that slice', () => {
    const merged = mergeThemeBundle(darkGlassBundle, {
      scene: { dark: { colorMode: 'dark' } },
    });
    // diagram and chart slices untouched — same reference
    expect(merged.diagram.dark).toBe(darkGlassBundle.diagram.dark);
    expect(merged.diagram.light).toBe(darkGlassBundle.diagram.light);
    expect(merged.chart.dark).toBe(darkGlassBundle.chart.dark);
    expect(merged.chart.light).toBe(darkGlassBundle.chart.light);
  });

  it('returns same bundle when no overrides at all', () => {
    const merged = mergeThemeBundle(darkGlassBundle);
    expect(merged.family).toBe(darkGlassBundle.family);
    expect(merged.scene.dark).toBe(darkGlassBundle.scene.dark);
    expect(merged.scene.light).toBe(darkGlassBundle.scene.light);
  });
});
