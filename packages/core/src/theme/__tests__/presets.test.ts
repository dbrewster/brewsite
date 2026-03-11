// Interface-based stateful tests for SceneTheme presets.
// Tests the type shape and default value contracts — not implementation internals.

import { describe, it, expect } from 'vitest';
import {
  darkSceneTheme,
  lightSceneTheme,
  darkGlassSceneTheme,
  midnightSceneTheme,
  neonCyberSceneTheme,
  enterpriseSceneTheme,
  lightCanvasSceneTheme,
  lightMinimalSceneTheme,
} from '../presets';

describe('darkSceneTheme', () => {
  it('has colorMode "dark"', () => {
    expect(darkSceneTheme.colorMode).toBe('dark');
  });
  it('has all 5 fontSize scale levels', () => {
    expect(darkSceneTheme.fontSize.heading).toBeGreaterThan(1);
    expect(darkSceneTheme.fontSize.body).toBe(1.0);
    expect(darkSceneTheme.fontSize.label).toBeLessThan(1);
    expect(darkSceneTheme.fontSize.caption).toBeLessThan(darkSceneTheme.fontSize.label);
    expect(darkSceneTheme.fontSize.annotation).toBeLessThan(darkSceneTheme.fontSize.caption);
  });
  it('has a non-empty htmlFamily', () => {
    expect(darkSceneTheme.font.htmlFamily.length).toBeGreaterThan(0);
  });
  it('has no webglFontUrl by default', () => {
    expect(darkSceneTheme.font.webglFontUrl).toBeUndefined();
  });
  it('has a background fill', () => {
    expect(darkSceneTheme.background?.fill?.kind).toBe('color');
  });
});

describe('lightSceneTheme', () => {
  it('has colorMode "light"', () => {
    expect(lightSceneTheme.colorMode).toBe('light');
  });
  it('has all 5 fontSize scale levels ordered', () => {
    expect(lightSceneTheme.fontSize.heading).toBeGreaterThan(lightSceneTheme.fontSize.body);
    expect(lightSceneTheme.fontSize.label).toBeLessThan(lightSceneTheme.fontSize.body);
  });
});

describe('new named presets', () => {
  it('darkGlassSceneTheme has colorMode dark', () => {
    expect(darkGlassSceneTheme.colorMode).toBe('dark');
  });

  it('darkGlassSceneTheme background fill is #070b18', () => {
    expect(darkGlassSceneTheme.background?.fill).toEqual({ kind: 'color', value: '#070b18' });
  });

  it('midnightSceneTheme has colorMode dark', () => {
    expect(midnightSceneTheme.colorMode).toBe('dark');
  });

  it('midnightSceneTheme background fill is #0d0a07', () => {
    expect(midnightSceneTheme.background?.fill).toEqual({ kind: 'color', value: '#0d0a07' });
  });

  it('neonCyberSceneTheme has colorMode dark and background #030610', () => {
    expect(neonCyberSceneTheme.colorMode).toBe('dark');
    expect(neonCyberSceneTheme.background?.fill).toEqual({ kind: 'color', value: '#030610' });
  });

  it('enterpriseSceneTheme has colorMode dark and background #0a1525', () => {
    expect(enterpriseSceneTheme.colorMode).toBe('dark');
    expect(enterpriseSceneTheme.background?.fill).toEqual({ kind: 'color', value: '#0a1525' });
  });

  it('lightCanvasSceneTheme has colorMode light', () => {
    expect(lightCanvasSceneTheme.colorMode).toBe('light');
  });

  it('lightCanvasSceneTheme background fill is #f0f2f4', () => {
    expect(lightCanvasSceneTheme.background?.fill).toEqual({ kind: 'color', value: '#f0f2f4' });
  });

  it('lightMinimalSceneTheme has colorMode light and background #ffffff', () => {
    expect(lightMinimalSceneTheme.colorMode).toBe('light');
    expect(lightMinimalSceneTheme.background?.fill).toEqual({ kind: 'color', value: '#ffffff' });
  });

  it('all 6 new presets have all required fontSize scale keys', () => {
    const presets = [
      darkGlassSceneTheme,
      midnightSceneTheme,
      neonCyberSceneTheme,
      enterpriseSceneTheme,
      lightCanvasSceneTheme,
      lightMinimalSceneTheme,
    ];
    for (const preset of presets) {
      expect(typeof preset.fontSize.heading).toBe('number');
      expect(typeof preset.fontSize.body).toBe('number');
      expect(typeof preset.fontSize.label).toBe('number');
      expect(typeof preset.fontSize.caption).toBe('number');
      expect(typeof preset.fontSize.annotation).toBe('number');
    }
  });

  it('all 6 new presets have font.htmlFamily set', () => {
    const presets = [
      darkGlassSceneTheme,
      midnightSceneTheme,
      neonCyberSceneTheme,
      enterpriseSceneTheme,
      lightCanvasSceneTheme,
      lightMinimalSceneTheme,
    ];
    for (const preset of presets) {
      expect(preset.font.htmlFamily.length).toBeGreaterThan(0);
    }
  });
});
