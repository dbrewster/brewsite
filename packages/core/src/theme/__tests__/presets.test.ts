// Interface-based stateful tests for SceneTheme default presets.
// Tests the type shape and default value contracts for the built-in defaults.

import { describe, it, expect } from 'vitest';
import {
  defaultSceneTheme,
  defaultLightSceneTheme,
} from '../presets';

describe('defaultSceneTheme', () => {
  it('has colorMode "dark"', () => {
    expect(defaultSceneTheme.colorMode).toBe('dark');
  });
  it('has all 5 fontSize scale levels ordered', () => {
    expect(defaultSceneTheme.fontSize.heading).toBeGreaterThan(1);
    expect(defaultSceneTheme.fontSize.body).toBe(1.0);
    expect(defaultSceneTheme.fontSize.label).toBeLessThan(1);
    expect(defaultSceneTheme.fontSize.caption).toBeLessThan(defaultSceneTheme.fontSize.label);
    expect(defaultSceneTheme.fontSize.annotation).toBeLessThan(defaultSceneTheme.fontSize.caption);
  });
  it('has a non-empty htmlFamily', () => {
    expect(defaultSceneTheme.font.htmlFamily.length).toBeGreaterThan(0);
  });
  it('has no webglFontUrl by default', () => {
    expect(defaultSceneTheme.font.webglFontUrl).toBeUndefined();
  });
  it('has a gradient background fill (enterprise aesthetic)', () => {
    expect(defaultSceneTheme.background?.fill?.kind).toBe('gradient');
    expect((defaultSceneTheme.background?.fill as { kind: 'gradient'; value: string }).value).toContain('linear-gradient');
  });
  it('has default floor grid tokens', () => {
    expect(defaultSceneTheme.floor?.grid?.spacing).toBe(1);
    expect(defaultSceneTheme.floor?.grid?.lineOpacity).toBe(0.15);
    expect(defaultSceneTheme.floor?.grid?.fillOpacity).toBe(0);
    expect(defaultSceneTheme.floor?.negativeZExtent).toBe(200);
    expect(defaultSceneTheme.floor?.negativeZEdge).toBe('hard');
    expect(defaultSceneTheme.floor?.negativeZFadeDistance).toBe(24);
  });
});

describe('defaultLightSceneTheme', () => {
  it('has colorMode "light"', () => {
    expect(defaultLightSceneTheme.colorMode).toBe('light');
  });
  it('has all 5 fontSize scale levels ordered', () => {
    expect(defaultLightSceneTheme.fontSize.heading).toBeGreaterThan(defaultLightSceneTheme.fontSize.body);
    expect(defaultLightSceneTheme.fontSize.label).toBeLessThan(defaultLightSceneTheme.fontSize.body);
  });
  it('has a gradient background fill', () => {
    expect(defaultLightSceneTheme.background?.fill?.kind).toBe('gradient');
  });
  it('has floor grid tokens with lineOpacity of 0.15', () => {
    expect(defaultLightSceneTheme.floor?.grid?.lineOpacity).toBe(0.15);
    expect(defaultLightSceneTheme.floor?.negativeZExtent).toBe(200);
  });
});
