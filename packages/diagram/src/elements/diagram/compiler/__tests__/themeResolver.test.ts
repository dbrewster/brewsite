// Interface-based stateful tests for buildThemeRenderConfig.
// Tests the contract of the themeResolver — pure function with real inputs.

import { describe, it, expect } from 'vitest';
import { buildThemeRenderConfig } from '../themeResolver';
import { darkGlassTheme } from '../../themes/darkGlass';
import type { DiagramTheme } from '../../types';

describe('buildThemeRenderConfig — fontUrl fallback chain', () => {
  it('extracts fontUrl from node.fontUrl when present', () => {
    const theme: DiagramTheme = {
      ...darkGlassTheme,
      node: { ...darkGlassTheme.node, fontUrl: 'https://cdn.example.com/font.ttf' },
    };
    const config = buildThemeRenderConfig(theme);
    expect(config.fontUrl).toBe('https://cdn.example.com/font.ttf');
  });

  it('falls back to sceneTheme.font.webglFontUrl when node.fontUrl is absent', () => {
    const theme: DiagramTheme = {
      ...darkGlassTheme,
      node: { ...darkGlassTheme.node, fontUrl: undefined },
      sceneTheme: {
        colorMode: 'dark',
        font: { htmlFamily: 'sans-serif', webglFontUrl: 'https://cdn.example.com/fallback.ttf' },
        fontSize: { heading: 1.5, body: 1.0, label: 0.85, caption: 0.7, annotation: 0.6 },
      },
    };
    const config = buildThemeRenderConfig(theme);
    expect(config.fontUrl).toBe('https://cdn.example.com/fallback.ttf');
  });

  it('node.fontUrl takes precedence over sceneTheme.font.webglFontUrl', () => {
    const theme: DiagramTheme = {
      ...darkGlassTheme,
      node: { ...darkGlassTheme.node, fontUrl: 'node-specific.ttf' },
      sceneTheme: {
        colorMode: 'dark',
        font: { htmlFamily: 'sans-serif', webglFontUrl: 'fallback.ttf' },
        fontSize: { heading: 1.5, body: 1.0, label: 0.85, caption: 0.7, annotation: 0.6 },
      },
    };
    const config = buildThemeRenderConfig(theme);
    expect(config.fontUrl).toBe('node-specific.ttf');
  });

  it('fontUrl is undefined when neither node.fontUrl nor sceneTheme.font.webglFontUrl is set', () => {
    const config = buildThemeRenderConfig(darkGlassTheme);
    expect(config.fontUrl).toBeUndefined();
  });

  it('fontUrl is undefined when sceneTheme has no webglFontUrl', () => {
    const theme: DiagramTheme = {
      ...darkGlassTheme,
      node: { ...darkGlassTheme.node, fontUrl: undefined },
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
