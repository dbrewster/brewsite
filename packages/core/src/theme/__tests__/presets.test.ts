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
  SCENE_THEME_PAIRS,
  darkGlassLightSceneTheme,
  lightCanvasDarkSceneTheme,
  enterpriseLightSceneTheme,
} from '../presets';
import type { ThemeFamily } from '../types';

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

  it('has default floor grid tokens', () => {
    expect(darkSceneTheme.floor?.grid?.spacing).toBe(1);
    expect(darkSceneTheme.floor?.grid?.lineOpacity).toBe(0.15);
    expect(darkSceneTheme.floor?.grid?.fillOpacity).toBe(1);
    expect(darkSceneTheme.floor?.negativeZExtent).toBe(200);
    expect(darkSceneTheme.floor?.negativeZEdge).toBe('hard');
    expect(darkSceneTheme.floor?.negativeZFadeDistance).toBe(24);
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

  it('darkGlassSceneTheme background fill is a gradient', () => {
    expect(darkGlassSceneTheme.background?.fill).toEqual({
      kind: 'gradient',
      value: 'linear-gradient(180deg, #070504 0%, #130B08 100%)',
    });
  });

  it('midnightSceneTheme has colorMode dark', () => {
    expect(midnightSceneTheme.colorMode).toBe('dark');
  });

  it('midnightSceneTheme background fill is a gradient', () => {
    expect(midnightSceneTheme.background?.fill).toEqual({
      kind: 'gradient',
      value: 'linear-gradient(180deg, #0D0907 0%, #1A120D 100%)',
    });
  });

  it('neonCyberSceneTheme has colorMode dark and gradient background', () => {
    expect(neonCyberSceneTheme.colorMode).toBe('dark');
    expect(neonCyberSceneTheme.background?.fill).toEqual({
      kind: 'gradient',
      value: 'linear-gradient(180deg, #02030D 0%, #09122A 100%)',
    });
  });

  it('enterpriseSceneTheme (the default aesthetic) has colorMode dark and gradient background', () => {
    expect(enterpriseSceneTheme.colorMode).toBe('dark');
    expect(enterpriseSceneTheme.background?.fill).toEqual({
      kind: 'gradient',
      value: 'linear-gradient(180deg, #0A1424 0%, #15253A 100%)',
    });
  });

  it('lightCanvasSceneTheme has colorMode light', () => {
    expect(lightCanvasSceneTheme.colorMode).toBe('light');
  });

  it('lightCanvasSceneTheme background fill is a gradient', () => {
    expect(lightCanvasSceneTheme.background?.fill).toEqual({
      kind: 'gradient',
      value: 'linear-gradient(180deg, #FFFFFF 0%, #F1F4F8 100%)',
    });
  });

  it('lightMinimalSceneTheme has colorMode light and gradient background', () => {
    expect(lightMinimalSceneTheme.colorMode).toBe('light');
    expect(lightMinimalSceneTheme.background?.fill).toEqual({
      kind: 'gradient',
      value: 'linear-gradient(180deg, #FFFFFF 0%, #F7F9FC 100%)',
    });
  });

  it('all 6 named presets have all required fontSize scale keys', () => {
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

  it('all 6 named presets have font.htmlFamily set', () => {
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

  it('all 6 named presets include floor.grid tokens', () => {
    const presets = [
      darkGlassSceneTheme,
      midnightSceneTheme,
      neonCyberSceneTheme,
      enterpriseSceneTheme,
      lightCanvasSceneTheme,
      lightMinimalSceneTheme,
    ];
    for (const preset of presets) {
      expect(preset.floor?.grid?.spacing).toBe(1);
      expect(preset.floor?.grid?.lineOpacity).toBe(0.15);
      expect(preset.floor?.grid?.majorEvery).toBe(1);
      expect(preset.floor?.negativeZExtent).toBe(200);
      expect(preset.floor?.negativeZEdge).toBe('hard');
      expect(preset.floor?.negativeZFadeDistance).toBe(24);
    }
  });
});

describe('SCENE_THEME_PAIRS', () => {
  const EXPECTED_FAMILIES: ThemeFamily[] = [
    'default', 'darkGlass', 'midnight', 'neonCyber', 'lightCanvas', 'lightMinimal',
  ];

  it('contains all six theme families', () => {
    for (const family of EXPECTED_FAMILIES) {
      expect(SCENE_THEME_PAIRS[family]).toBeDefined();
    }
  });

  it('each pair has a dark entry with colorMode === "dark"', () => {
    for (const family of EXPECTED_FAMILIES) {
      expect(SCENE_THEME_PAIRS[family].dark.colorMode).toBe('dark');
    }
  });

  it('each pair has a light entry with colorMode === "light"', () => {
    for (const family of EXPECTED_FAMILIES) {
      expect(SCENE_THEME_PAIRS[family].light.colorMode).toBe('light');
    }
  });

  it('dark entry for default is enterpriseSceneTheme by reference', () => {
    expect(SCENE_THEME_PAIRS['default'].dark).toBe(enterpriseSceneTheme);
  });

  it('light entry for default is enterpriseLightSceneTheme by reference', () => {
    expect(SCENE_THEME_PAIRS['default'].light).toBe(enterpriseLightSceneTheme);
  });

  it('dark entry for darkGlass is the existing darkGlassSceneTheme by reference', () => {
    expect(SCENE_THEME_PAIRS['darkGlass'].dark).toBe(darkGlassSceneTheme);
  });

  it('light entry for lightCanvas is the existing lightCanvasSceneTheme by reference', () => {
    expect(SCENE_THEME_PAIRS['lightCanvas'].light).toBe(lightCanvasSceneTheme);
  });

  it('light entry for darkGlass is the new darkGlassLightSceneTheme by reference', () => {
    expect(SCENE_THEME_PAIRS['darkGlass'].light).toBe(darkGlassLightSceneTheme);
  });

  it('dark entry for lightCanvas is the new lightCanvasDarkSceneTheme by reference', () => {
    expect(SCENE_THEME_PAIRS['lightCanvas'].dark).toBe(lightCanvasDarkSceneTheme);
  });

  it('no entry in the registry is undefined or null', () => {
    for (const family of EXPECTED_FAMILIES) {
      expect(SCENE_THEME_PAIRS[family].dark).not.toBeNull();
      expect(SCENE_THEME_PAIRS[family].light).not.toBeNull();
    }
  });
});
