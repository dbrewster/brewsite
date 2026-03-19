// Interface-based stateful tests for buildThemeRenderConfig.
// Tests the contract of the themeResolver — pure function with real inputs.

import { describe, it, expect } from 'vitest';
import { buildThemeRenderConfig } from '../themeResolver';
import { darkGlassTheme } from '../../themes/darkGlass';
import type { DiagramTheme } from '../../types';

import { mergeTheme } from '../../themes/mergeTheme';
import { lightMinimalTheme } from '../../themes/lightMinimal';

describe('buildThemeRenderConfig — fontUrl fallback chain', () => {
  it('extracts fontUrl from theme.fontUrl when present', () => {
    const theme: DiagramTheme = { ...darkGlassTheme, fontUrl: 'https://cdn.example.com/font.ttf' };
    const config = buildThemeRenderConfig(theme);
    expect(config.fontUrl).toBe('https://cdn.example.com/font.ttf');
  });

  it('fontUrl falls back to sceneTheme.font.webglFontUrl when theme.fontUrl absent', () => {
    const theme = mergeTheme(darkGlassTheme, {
      sceneTheme: { font: { webglFontUrl: '/my-font.ttf' }, fontSize: { label: 1, caption: 1 }, colorMode: 'dark' },
    });
    const config = buildThemeRenderConfig(theme);
    expect(config.fontUrl).toBe('/my-font.ttf');
  });

  it('theme.fontUrl overrides sceneTheme.font.webglFontUrl', () => {
    const theme = mergeTheme(darkGlassTheme, {
      fontUrl: '/override.ttf',
      sceneTheme: { font: { webglFontUrl: '/fallback.ttf' }, fontSize: { label: 1, caption: 1 }, colorMode: 'dark' },
    });
    const config = buildThemeRenderConfig(theme);
    expect(config.fontUrl).toBe('/override.ttf');
  });

  it('fontUrl is undefined when neither theme.fontUrl nor sceneTheme.font.webglFontUrl is set', () => {
    const config = buildThemeRenderConfig(darkGlassTheme);
    expect(config.fontUrl).toBeUndefined();
  });

  it('fontUrl is undefined when sceneTheme has no webglFontUrl', () => {
    const theme: DiagramTheme = {
      ...darkGlassTheme,
      sceneTheme: {
        colorMode: 'dark',
        font: { htmlFamily: 'sans-serif' },
        fontSize: { heading: 1.5, body: 1.0, label: 0.85, caption: 0.7, annotation: 0.6 },
      },
    };
    const config = buildThemeRenderConfig(theme);
    expect(config.fontUrl).toBeUndefined();
  });
});

describe('buildThemeRenderConfig — effectiveLabelSizeFactor', () => {
  it('effectiveLabelSizeFactor applies sceneTheme.fontSize.label multiplier', () => {
    const theme: DiagramTheme = {
      ...darkGlassTheme,
      node: { ...darkGlassTheme.node, labelSizeFactor: 1.0 },
      sceneTheme: {
        colorMode: 'dark',
        font: { htmlFamily: 'sans-serif' },
        fontSize: { heading: 1.5, body: 1.0, label: 0.8, caption: 0.7, annotation: 0.6 },
      },
    };
    const config = buildThemeRenderConfig(theme);
    expect(config.effectiveLabelSizeFactor).toBeCloseTo(0.8);
  });

  it('effectiveLabelSizeFactor is labelSizeFactor × 1.0 when no sceneTheme', () => {
    const theme: DiagramTheme = {
      ...darkGlassTheme,
      node: { ...darkGlassTheme.node, labelSizeFactor: 1.2 },
    };
    const config = buildThemeRenderConfig(theme);
    expect(config.effectiveLabelSizeFactor).toBeCloseTo(1.2);
  });

  it('effectiveLabelSizeFactor is 1.0 when labelSizeFactor is 1.0 and no sceneTheme', () => {
    const theme: DiagramTheme = {
      ...darkGlassTheme,
      node: { ...darkGlassTheme.node, labelSizeFactor: 1.0 },
    };
    const config = buildThemeRenderConfig(theme);
    expect(config.effectiveLabelSizeFactor).toBeCloseTo(1.0);
  });

  it('effectiveLabelSizeFactor combines node labelSizeFactor with sceneTheme scale', () => {
    const theme: DiagramTheme = {
      ...darkGlassTheme,
      node: { ...darkGlassTheme.node, labelSizeFactor: 1.2 },
      sceneTheme: {
        colorMode: 'dark',
        font: { htmlFamily: 'sans-serif' },
        fontSize: { heading: 1.5, body: 1.0, label: 0.85, caption: 0.7, annotation: 0.6 },
      },
    };
    const config = buildThemeRenderConfig(theme);
    expect(config.effectiveLabelSizeFactor).toBeCloseTo(1.2 * 0.85);
  });
});

describe('buildThemeRenderConfig — effectiveSublabelSizeFactor', () => {
  it('effectiveSublabelSizeFactor applies sceneTheme.fontSize.caption multiplier', () => {
    const theme: DiagramTheme = {
      ...darkGlassTheme,
      node: { ...darkGlassTheme.node, sublabelSizeFactor: 1.0 },
      sceneTheme: {
        colorMode: 'dark',
        font: { htmlFamily: 'sans-serif' },
        fontSize: { heading: 1.5, body: 1.0, label: 0.85, caption: 0.7, annotation: 0.6 },
      },
    };
    const config = buildThemeRenderConfig(theme);
    expect(config.effectiveSublabelSizeFactor).toBeCloseTo(0.7);
  });

  it('effectiveSublabelSizeFactor is sublabelSizeFactor × 1.0 when no sceneTheme', () => {
    const theme: DiagramTheme = {
      ...darkGlassTheme,
      node: { ...darkGlassTheme.node, sublabelSizeFactor: 1.0 },
    };
    const config = buildThemeRenderConfig(theme);
    expect(config.effectiveSublabelSizeFactor).toBeCloseTo(1.0);
  });
});

describe('buildThemeRenderConfig — new Stream C fields', () => {
  it('emits all new DiagramThemeRenderConfig fields from darkGlassTheme', () => {
    const config = buildThemeRenderConfig(darkGlassTheme);
    expect(config.nodeGlowSpread).toBe(2.2);
    expect(config.nodeLabelFontSizeBase).toBe(0.32);
    expect(config.nodeSublabelFontSizeBase).toBe(0.22);
    expect(config.edgeFlowPulseIntensity).toBe(0.68);
    expect(config.groupBorderMetalness).toBe(0.32);
    expect(config.groupBorderRoughness).toBe(0.48);
    expect(config.groupBorderSideDarken).toBe(0.42);
    expect(config.groupBorderEdgeDarken).toBe(0.46);
  });

  it('emits new fields from lightMinimalTheme with distinct values', () => {
    const config = buildThemeRenderConfig(lightMinimalTheme);
    expect(config.nodeLabelFontSizeBase).toBe(0.32);
    expect(config.nodeSublabelFontSizeBase).toBe(0.22);
    expect(config.groupBorderMetalness).toBe(0.08);
    expect(config.groupBorderRoughness).toBe(0.60);
  });
});
