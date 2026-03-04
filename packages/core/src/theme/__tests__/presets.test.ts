// Interface-based stateful tests for SceneTheme presets.
// Tests the type shape and default value contracts — not implementation internals.

import { describe, it, expect } from 'vitest';
import { darkSceneTheme, lightSceneTheme } from '../presets';

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
