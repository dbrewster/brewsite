// Integration tests for compileTrayFromViewLayout — the full DSL → theme → compiled state pipeline.
// Tests the seam where DSL props, theme tokens, and compiled defaults merge.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { compileTrayFromViewLayout, computeViewExtent, resolveHighlightMode, buildViewHighlights, buildViewHighlightsFromDsl, resolveRuntimeHighlight, type TrayViewBounds } from '../compileTray';
import { DEFAULT_CAROUSEL_SCRUBBER_STYLE } from '../compile';
import type { CarouselTrayProps } from '../dsl';
import type { CarouselLayoutConfig } from '../../../layout/regionTypes';
import type { NVSRect } from '../../../layout/types';
import type { ThemeFamily } from '../../../theme/types';
import {
  registerSceneThemePair,
  _resetSceneThemeRegistryForTesting,
} from '../../../theme/sceneThemeRegistry';
import type { SceneTheme } from '../../../theme/types';

// ─── Test fixtures ──────────────────────────────────────────────────────────

const containerBounds: NVSRect = { x: 0, y: 0, w: 1, h: 1 };

const baseCarouselConfig: CarouselLayoutConfig = {
  kind: 'carousel',
  activeIndex: 0,
  loop: true,
  zStep: 15,
  spread: 0.7,
};

const linearCarouselConfig: CarouselLayoutConfig = {
  kind: 'carousel',
  activeIndex: 0,
  loop: false,
  zStep: 8,
};

const viewIds = ['v1', 'v2', 'v3'];

const viewStates = new Map<string, TrayViewBounds>([
  ['v1', { bounds: { x: 0.1, y: 0.2, w: 0.3, h: 0.4 } }],
  ['v2', { bounds: { x: 0.3, y: 0.1, w: 0.3, h: 0.5 } }],
  ['v3', { bounds: { x: 0.5, y: 0.15, w: 0.3, h: 0.45 } }],
]);

/** Minimal SceneTheme with carousel tray tokens for the 'testTheme' family. */
const testThemeDark: SceneTheme = {
  colorMode: 'dark',
  font: { htmlFamily: 'Inter' },
  fontSize: { heading: 1.5, body: 1.0, label: 0.85, caption: 0.7, annotation: 0.6 },
  carouselTray: {
    color: '#ff0000',
    opacity: 0.9,
    accentColor: '#00ff00',
    metalness: 0.8,
    roughness: 0.2,
    edgeStyle: 'ridged',
    surfacePattern: 'grain',
    surfaceIntensity: 0.5,
    surfaceMapUrl: '/theme-normal.png',
    depth: 0.5,
    gap: 0.05,
  },
};

const testThemeLight: SceneTheme = {
  colorMode: 'light',
  font: { htmlFamily: 'Inter' },
  fontSize: { heading: 1.5, body: 1.0, label: 0.85, caption: 0.7, annotation: 0.6 },
  carouselTray: {
    color: '#ccddee',
    opacity: 0.85,
    surfacePattern: 'crosshatch',
  },
};

// ─── Setup ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  _resetSceneThemeRegistryForTesting();
  registerSceneThemePair('testTheme' as ThemeFamily, { dark: testThemeDark, light: testThemeLight });
});

// ─── compileTrayFromViewLayout ──────────────────────────────────────────────

describe('compileTrayFromViewLayout', () => {
  // -- DSL prop passthrough -----------------------------------------------

  it('passes DSL surfacePattern through to compiled state', () => {
    const trayProps: CarouselTrayProps = { surfacePattern: 'radial' };
    const state = compileTrayFromViewLayout(
      trayProps, 'layout-1', baseCarouselConfig, viewIds,
      containerBounds, viewStates, 'default', 'dark',
    );
    expect(state.style.surfacePattern).toBe('radial');
  });

  it('passes DSL color through to compiled state as baseColor', () => {
    const trayProps: CarouselTrayProps = { color: '#aabbcc' };
    const state = compileTrayFromViewLayout(
      trayProps, 'layout-1', baseCarouselConfig, viewIds,
      containerBounds, viewStates, 'default', 'dark',
    );
    expect(state.style.baseColor).toBe('#aabbcc');
  });

  it('passes DSL opacity through to compiled state as baseOpacity', () => {
    const trayProps: CarouselTrayProps = { opacity: 0.42 };
    const state = compileTrayFromViewLayout(
      trayProps, 'layout-1', baseCarouselConfig, viewIds,
      containerBounds, viewStates, 'default', 'dark',
    );
    expect(state.style.baseOpacity).toBe(0.42);
  });

  it('passes DSL metalness through to compiled state', () => {
    const trayProps: CarouselTrayProps = { metalness: 0.95 };
    const state = compileTrayFromViewLayout(
      trayProps, 'layout-1', baseCarouselConfig, viewIds,
      containerBounds, viewStates, 'default', 'dark',
    );
    expect(state.style.metalness).toBe(0.95);
  });

  it('passes DSL roughness through to compiled state', () => {
    const trayProps: CarouselTrayProps = { roughness: 0.15 };
    const state = compileTrayFromViewLayout(
      trayProps, 'layout-1', baseCarouselConfig, viewIds,
      containerBounds, viewStates, 'default', 'dark',
    );
    expect(state.style.roughness).toBe(0.15);
  });

  it('passes DSL edgeStyle through to compiled state', () => {
    const trayProps: CarouselTrayProps = { edgeStyle: 'smooth' };
    const state = compileTrayFromViewLayout(
      trayProps, 'layout-1', baseCarouselConfig, viewIds,
      containerBounds, viewStates, 'default', 'dark',
    );
    expect(state.style.edgeStyle).toBe('smooth');
  });

  it('passes DSL surfaceIntensity through to compiled state', () => {
    const trayProps: CarouselTrayProps = { surfaceIntensity: 0.9 };
    const state = compileTrayFromViewLayout(
      trayProps, 'layout-1', baseCarouselConfig, viewIds,
      containerBounds, viewStates, 'default', 'dark',
    );
    expect(state.style.surfaceIntensity).toBe(0.9);
  });

  it('passes DSL surfaceMapUrl through to compiled state', () => {
    const trayProps: CarouselTrayProps = { surfaceMapUrl: '/custom.png' };
    const state = compileTrayFromViewLayout(
      trayProps, 'layout-1', baseCarouselConfig, viewIds,
      containerBounds, viewStates, 'default', 'dark',
    );
    expect(state.style.surfaceMapUrl).toBe('/custom.png');
  });

  it('passes DSL depth through to compiled state as trayDepth', () => {
    const trayProps: CarouselTrayProps = { depth: 0.8 };
    const state = compileTrayFromViewLayout(
      trayProps, 'layout-1', baseCarouselConfig, viewIds,
      containerBounds, viewStates, 'default', 'dark',
    );
    expect(state.trayDepth).toBe(0.8);
  });

  it('passes DSL gap through to compiled state', () => {
    const trayProps: CarouselTrayProps = { gap: 0.1 };
    const state = compileTrayFromViewLayout(
      trayProps, 'layout-1', baseCarouselConfig, viewIds,
      containerBounds, viewStates, 'default', 'dark',
    );
    expect(state.gap).toBe(0.1);
  });

  // -- Theme token application -------------------------------------------

  it('applies theme surfacePattern when DSL does not set it', () => {
    const trayProps: CarouselTrayProps = {};
    const state = compileTrayFromViewLayout(
      trayProps, 'layout-1', baseCarouselConfig, viewIds,
      containerBounds, viewStates, 'testTheme' as ThemeFamily, 'dark',
    );
    expect(state.style.surfacePattern).toBe('grain');
  });

  it('applies theme color when DSL does not set it', () => {
    const trayProps: CarouselTrayProps = {};
    const state = compileTrayFromViewLayout(
      trayProps, 'layout-1', baseCarouselConfig, viewIds,
      containerBounds, viewStates, 'testTheme' as ThemeFamily, 'dark',
    );
    expect(state.style.baseColor).toBe('#ff0000');
  });

  it('applies theme opacity when DSL does not set it', () => {
    const trayProps: CarouselTrayProps = {};
    const state = compileTrayFromViewLayout(
      trayProps, 'layout-1', baseCarouselConfig, viewIds,
      containerBounds, viewStates, 'testTheme' as ThemeFamily, 'dark',
    );
    expect(state.style.baseOpacity).toBe(0.9);
  });

  it('applies theme metalness when DSL does not set it', () => {
    const trayProps: CarouselTrayProps = {};
    const state = compileTrayFromViewLayout(
      trayProps, 'layout-1', baseCarouselConfig, viewIds,
      containerBounds, viewStates, 'testTheme' as ThemeFamily, 'dark',
    );
    expect(state.style.metalness).toBe(0.8);
  });

  it('applies theme edgeStyle when DSL does not set it', () => {
    const trayProps: CarouselTrayProps = {};
    const state = compileTrayFromViewLayout(
      trayProps, 'layout-1', baseCarouselConfig, viewIds,
      containerBounds, viewStates, 'testTheme' as ThemeFamily, 'dark',
    );
    expect(state.style.edgeStyle).toBe('ridged');
  });

  it('applies theme gap when DSL does not set it', () => {
    const trayProps: CarouselTrayProps = {};
    const state = compileTrayFromViewLayout(
      trayProps, 'layout-1', baseCarouselConfig, viewIds,
      containerBounds, viewStates, 'testTheme' as ThemeFamily, 'dark',
    );
    expect(state.gap).toBe(0.05);
  });

  it('applies light polarity theme tokens', () => {
    const trayProps: CarouselTrayProps = {};
    const state = compileTrayFromViewLayout(
      trayProps, 'layout-1', baseCarouselConfig, viewIds,
      containerBounds, viewStates, 'testTheme' as ThemeFamily, 'light',
    );
    expect(state.style.baseColor).toBe('#ccddee');
    expect(state.style.baseOpacity).toBe(0.85);
    expect(state.style.surfacePattern).toBe('crosshatch');
  });

  // -- DSL overrides theme -----------------------------------------------

  it('DSL surfacePattern overrides theme surfacePattern', () => {
    const trayProps: CarouselTrayProps = { surfacePattern: 'brushed' };
    const state = compileTrayFromViewLayout(
      trayProps, 'layout-1', baseCarouselConfig, viewIds,
      containerBounds, viewStates, 'testTheme' as ThemeFamily, 'dark',
    );
    // Theme has 'grain', DSL has 'brushed' → DSL wins
    expect(state.style.surfacePattern).toBe('brushed');
  });

  it('DSL color overrides theme color', () => {
    const trayProps: CarouselTrayProps = { color: '#0000ff' };
    const state = compileTrayFromViewLayout(
      trayProps, 'layout-1', baseCarouselConfig, viewIds,
      containerBounds, viewStates, 'testTheme' as ThemeFamily, 'dark',
    );
    // Theme has '#ff0000', DSL has '#0000ff' → DSL wins
    expect(state.style.baseColor).toBe('#0000ff');
  });

  it('DSL edgeStyle overrides theme edgeStyle', () => {
    const trayProps: CarouselTrayProps = { edgeStyle: 'matte' };
    const state = compileTrayFromViewLayout(
      trayProps, 'layout-1', baseCarouselConfig, viewIds,
      containerBounds, viewStates, 'testTheme' as ThemeFamily, 'dark',
    );
    expect(state.style.edgeStyle).toBe('matte');
  });

  it('DSL gap overrides theme gap', () => {
    const trayProps: CarouselTrayProps = { gap: 0.01 };
    const state = compileTrayFromViewLayout(
      trayProps, 'layout-1', baseCarouselConfig, viewIds,
      containerBounds, viewStates, 'testTheme' as ThemeFamily, 'dark',
    );
    // Theme has 0.05, DSL has 0.01 → DSL wins
    expect(state.gap).toBe(0.01);
  });

  // -- Compiled defaults (no DSL, no theme) ------------------------------

  it('falls back to compiled defaults when no DSL and no theme tokens', () => {
    const trayProps: CarouselTrayProps = {};
    const state = compileTrayFromViewLayout(
      trayProps, 'layout-1', baseCarouselConfig, viewIds,
      containerBounds, viewStates, 'default', 'dark',
    );
    // The 'default' theme has carouselTray tokens that match defaults
    // but let's verify the structure is complete and valid
    expect(state.style.baseColor).toBeDefined();
    expect(state.style.baseOpacity).toBeGreaterThan(0);
    expect(state.style.metalness).toBeGreaterThanOrEqual(0);
    expect(state.style.roughness).toBeGreaterThanOrEqual(0);
    expect(state.style.edgeStyle).toBeDefined();
    expect(state.style.surfacePattern).toBeDefined();
    expect(state.style.surfaceIntensity).toBeGreaterThanOrEqual(0);
  });

  it('uses compiled default surfacePattern when theme has no carouselTray', () => {
    // Register a theme with NO carouselTray tokens
    const bareTheme: SceneTheme = {
      colorMode: 'dark',
      font: { htmlFamily: 'Inter' },
      fontSize: { heading: 1.5, body: 1.0, label: 0.85, caption: 0.7, annotation: 0.6 },
    };
    registerSceneThemePair('bareTheme' as ThemeFamily, { dark: bareTheme, light: bareTheme });

    const trayProps: CarouselTrayProps = {};
    const state = compileTrayFromViewLayout(
      trayProps, 'layout-1', baseCarouselConfig, viewIds,
      containerBounds, viewStates, 'bareTheme' as ThemeFamily, 'dark',
    );
    expect(state.style.surfacePattern).toBe(DEFAULT_CAROUSEL_SCRUBBER_STYLE.surfacePattern);
    expect(state.style.baseColor).toBe(DEFAULT_CAROUSEL_SCRUBBER_STYLE.baseColor);
    expect(state.style.edgeStyle).toBe(DEFAULT_CAROUSEL_SCRUBBER_STYLE.edgeStyle);
  });

  // -- Carousel config passthrough ---------------------------------------

  it('passes loop=true from carousel config', () => {
    const trayProps: CarouselTrayProps = {};
    const state = compileTrayFromViewLayout(
      trayProps, 'layout-1', baseCarouselConfig, viewIds,
      containerBounds, viewStates, 'default', 'dark',
    );
    expect(state.loop).toBe(true);
  });

  it('passes loop=false from carousel config', () => {
    const trayProps: CarouselTrayProps = {};
    const state = compileTrayFromViewLayout(
      trayProps, 'layout-1', linearCarouselConfig, viewIds,
      containerBounds, viewStates, 'default', 'dark',
    );
    expect(state.loop).toBe(false);
  });

  it('passes activeIndex from carousel config', () => {
    const config: CarouselLayoutConfig = { ...baseCarouselConfig, activeIndex: 2 };
    const trayProps: CarouselTrayProps = {};
    const state = compileTrayFromViewLayout(
      trayProps, 'layout-1', config, viewIds,
      containerBounds, viewStates, 'default', 'dark',
    );
    expect(state.activeIndex).toBe(2);
  });

  it('passes childCount from viewIds length', () => {
    const trayProps: CarouselTrayProps = {};
    const state = compileTrayFromViewLayout(
      trayProps, 'layout-1', baseCarouselConfig, viewIds,
      containerBounds, viewStates, 'default', 'dark',
    );
    expect(state.childCount).toBe(3);
  });

  it('passes zStep from carousel config', () => {
    const trayProps: CarouselTrayProps = {};
    const state = compileTrayFromViewLayout(
      trayProps, 'layout-1', baseCarouselConfig, viewIds,
      containerBounds, viewStates, 'default', 'dark',
    );
    expect(state.zStep).toBe(15);
  });

  it('passes spread from carousel config', () => {
    const trayProps: CarouselTrayProps = {};
    const state = compileTrayFromViewLayout(
      trayProps, 'layout-1', baseCarouselConfig, viewIds,
      containerBounds, viewStates, 'default', 'dark',
    );
    expect(state.spread).toBe(0.7);
  });

  // -- Layout and widget ID -----------------------------------------------

  it('produces widgetId as layoutId__tray', () => {
    const trayProps: CarouselTrayProps = {};
    const state = compileTrayFromViewLayout(
      trayProps, 'my-carousel', baseCarouselConfig, viewIds,
      containerBounds, viewStates, 'default', 'dark',
    );
    expect(state.layoutId).toBe('my-carousel');
  });

  it('computes viewExtent from resolved view bounds', () => {
    const trayProps: CarouselTrayProps = {};
    const state = compileTrayFromViewLayout(
      trayProps, 'layout-1', baseCarouselConfig, viewIds,
      containerBounds, viewStates, 'default', 'dark',
    );
    // viewStates span: x=[0.1,0.8], y=[0.1,0.6]
    expect(state.viewExtent.x).toBeCloseTo(0.1, 5);
    expect(state.viewExtent.y).toBeCloseTo(0.1, 5);
    expect(state.viewExtent.w).toBeCloseTo(0.7, 5);
    expect(state.viewExtent.h).toBeCloseTo(0.5, 5);
  });

  it('falls back to container bounds when no views have resolved bounds', () => {
    const emptyViews = new Map<string, TrayViewBounds>();
    const trayProps: CarouselTrayProps = {};
    const state = compileTrayFromViewLayout(
      trayProps, 'layout-1', baseCarouselConfig, viewIds,
      containerBounds, emptyViews, 'default', 'dark',
    );
    expect(state.viewExtent).toEqual(containerBounds);
  });

  // -- Mixed: partial DSL + partial theme ---------------------------------

  it('mixes DSL and theme: DSL color + theme surfacePattern', () => {
    const trayProps: CarouselTrayProps = { color: '#112233' };
    const state = compileTrayFromViewLayout(
      trayProps, 'layout-1', baseCarouselConfig, viewIds,
      containerBounds, viewStates, 'testTheme' as ThemeFamily, 'dark',
    );
    expect(state.style.baseColor).toBe('#112233');      // DSL
    expect(state.style.surfacePattern).toBe('grain');    // theme
    expect(state.style.edgeStyle).toBe('ridged');        // theme
  });

  it('mixes DSL and theme: DSL surfacePattern + theme color', () => {
    const trayProps: CarouselTrayProps = { surfacePattern: 'radial' };
    const state = compileTrayFromViewLayout(
      trayProps, 'layout-1', baseCarouselConfig, viewIds,
      containerBounds, viewStates, 'testTheme' as ThemeFamily, 'dark',
    );
    expect(state.style.surfacePattern).toBe('radial');   // DSL
    expect(state.style.baseColor).toBe('#ff0000');       // theme
  });

  // -- Unregistered theme family fallback ---------------------------------

  it('falls back to default theme for unknown theme family', () => {
    const trayProps: CarouselTrayProps = {};
    const state = compileTrayFromViewLayout(
      trayProps, 'layout-1', baseCarouselConfig, viewIds,
      containerBounds, viewStates, 'nonexistent' as ThemeFamily, 'dark',
    );
    // Should get default theme's carouselTray tokens, not crash
    expect(state.style.baseColor).toBeDefined();
    expect(state.style.surfacePattern).toBeDefined();
  });
});

// ─── computeViewExtent ──────────────────────────────────────────────────────

describe('computeViewExtent', () => {
  const fallback: NVSRect = { x: 0, y: 0, w: 1, h: 1 };

  it('computes tight bounding box from view bounds', () => {
    const result = computeViewExtent(['v1', 'v2', 'v3'], viewStates, fallback);
    expect(result.x).toBeCloseTo(0.1, 5);
    expect(result.y).toBeCloseTo(0.1, 5);
    expect(result.w).toBeCloseTo(0.7, 5);
    expect(result.h).toBeCloseTo(0.5, 5);
  });

  it('returns fallback when no views have bounds', () => {
    const result = computeViewExtent(['v1', 'v2'], new Map(), fallback);
    expect(result).toEqual(fallback);
  });

  it('returns fallback for empty viewIds', () => {
    const result = computeViewExtent([], viewStates, fallback);
    expect(result).toEqual(fallback);
  });

  it('handles single view', () => {
    const single = new Map<string, TrayViewBounds>([
      ['only', { bounds: { x: 0.2, y: 0.3, w: 0.4, h: 0.5 } }],
    ]);
    const result = computeViewExtent(['only'], single, fallback);
    expect(result.x).toBeCloseTo(0.2, 5);
    expect(result.y).toBeCloseTo(0.3, 5);
    expect(result.w).toBeCloseTo(0.4, 5);
    expect(result.h).toBeCloseTo(0.5, 5);
  });

  it('skips viewIds not present in viewStates', () => {
    const result = computeViewExtent(['v1', 'missing', 'v3'], viewStates, fallback);
    // Only v1 and v3 contribute: x=[0.1,0.8], y=[0.15,0.6]
    expect(result.x).toBeCloseTo(0.1, 5);
    expect(result.y).toBeCloseTo(0.15, 5);
  });
});

// ─── resolveHighlightMode ──────────────────────────────────────────────────

describe('resolveHighlightMode', () => {
  it('returns glow for boolean true', () => {
    expect(resolveHighlightMode(true, undefined)).toBe('glow');
  });

  it('returns none for boolean false', () => {
    expect(resolveHighlightMode(false, undefined)).toBe('none');
  });

  it('returns the explicit mode when provided', () => {
    expect(resolveHighlightMode('holographic', undefined)).toBe('holographic');
    expect(resolveHighlightMode('glow', undefined)).toBe('glow');
    expect(resolveHighlightMode('none', undefined)).toBe('none');
  });

  it('falls back to theme when DSL is undefined', () => {
    expect(resolveHighlightMode(undefined, 'holographic')).toBe('holographic');
  });

  it('returns none when both DSL and theme are undefined', () => {
    expect(resolveHighlightMode(undefined, undefined)).toBe('none');
  });

  it('DSL true overrides theme holographic', () => {
    expect(resolveHighlightMode(true, 'holographic')).toBe('glow');
  });

  it('DSL false overrides theme glow', () => {
    expect(resolveHighlightMode(false, 'glow')).toBe('none');
  });
});

// ─── buildViewHighlights ───────────────────────────────────────────────────

describe('buildViewHighlights', () => {
  it('returns empty array when mode resolves to none', () => {
    const result = buildViewHighlights(
      {}, undefined, '#5090e0', 0, viewIds, viewStates,
    );
    expect(result).toEqual([]);
  });

  it('builds highlights with glow mode for active view only', () => {
    const result = buildViewHighlights(
      { highlightActive: 'glow' }, undefined, '#5090e0', 1, viewIds, viewStates,
    );
    expect(result).toHaveLength(3);
    expect(result[0].mode).toBe('none');
    expect(result[1].mode).toBe('glow');
    expect(result[1].viewId).toBe('v2');
    expect(result[2].mode).toBe('none');
  });

  it('uses default glow intensity of 0.8', () => {
    const result = buildViewHighlights(
      { highlightActive: 'glow' }, undefined, '#5090e0', 0, viewIds, viewStates,
    );
    expect(result[0].intensity).toBe(0.8);
  });

  it('uses default holographic intensity', () => {
    const result = buildViewHighlights(
      { highlightActive: 'holographic' }, undefined, '#5090e0', 0, viewIds, viewStates,
    );
    expect(result[0].intensity).toBe(0.5);
  });

  it('uses DSL color over theme color', () => {
    const result = buildViewHighlights(
      { highlightActive: 'glow', highlightColor: '#ff0000' },
      { highlightColor: '#00ff00' },
      '#5090e0', 0, viewIds, viewStates,
    );
    expect(result[0].color).toBe('#ff0000');
  });

  it('falls back to theme color when DSL color is absent', () => {
    const result = buildViewHighlights(
      { highlightActive: 'glow' },
      { highlightColor: '#00ff00' },
      '#5090e0', 0, viewIds, viewStates,
    );
    expect(result[0].color).toBe('#00ff00');
  });

  it('falls back to accentColor when both DSL and theme colors are absent', () => {
    const result = buildViewHighlights(
      { highlightActive: 'glow' }, undefined, '#5090e0', 0, viewIds, viewStates,
    );
    expect(result[0].color).toBe('#5090e0');
  });

  it('uses DSL intensity override', () => {
    const result = buildViewHighlights(
      { highlightActive: 'glow', highlightIntensity: 0.8 },
      undefined, '#5090e0', 0, viewIds, viewStates,
    );
    expect(result[0].intensity).toBe(0.8);
  });

  it('uses theme intensity when DSL is absent', () => {
    const result = buildViewHighlights(
      { highlightActive: 'glow' },
      { highlightIntensity: 0.7 },
      '#5090e0', 0, viewIds, viewStates,
    );
    expect(result[0].intensity).toBe(0.7);
  });

  it('includes beamHeight and smoke for holographic mode', () => {
    const result = buildViewHighlights(
      { highlightActive: 'holographic', highlightBeamHeight: 2.0, highlightSmoke: true },
      undefined, '#5090e0', 0, viewIds, viewStates,
    );
    expect(result[0].beamHeight).toBe(2.0);
    expect(result[0].smoke).toBe(true);
  });

  it('uses default beamHeight and smoke=false for holographic mode', () => {
    const result = buildViewHighlights(
      { highlightActive: 'holographic' }, undefined, '#5090e0', 0, viewIds, viewStates,
    );
    expect(result[0].beamHeight).toBe(5.0);
    expect(result[0].smoke).toBe(false);
  });

  it('does not include beamHeight or smoke for glow mode', () => {
    const result = buildViewHighlights(
      { highlightActive: 'glow' }, undefined, '#5090e0', 0, viewIds, viewStates,
    );
    expect(result[0].beamHeight).toBeUndefined();
    expect(result[0].smoke).toBeUndefined();
  });

  it('copies view bounds from viewStates', () => {
    const result = buildViewHighlights(
      { highlightActive: 'glow' }, undefined, '#5090e0', 0, viewIds, viewStates,
    );
    expect(result[0].bounds).toEqual({ x: 0.1, y: 0.2, w: 0.3, h: 0.4 });
  });

  it('uses zero bounds for views not in viewStates', () => {
    const result = buildViewHighlights(
      { highlightActive: 'glow' }, undefined, '#5090e0', 0,
      ['missing'], new Map(),
    );
    expect(result[0].bounds).toEqual({ x: 0, y: 0, w: 0, h: 0 });
  });

  it('inactive views have intensity 0', () => {
    const result = buildViewHighlights(
      { highlightActive: 'glow' }, undefined, '#5090e0', 0, viewIds, viewStates,
    );
    expect(result[1].intensity).toBe(0);
    expect(result[2].intensity).toBe(0);
  });

  it('uses theme highlightActive when DSL is absent', () => {
    const result = buildViewHighlights(
      {}, { highlightActive: 'holographic' }, '#5090e0', 0, viewIds, viewStates,
    );
    expect(result[0].mode).toBe('holographic');
  });

  it('uses theme beamHeight and smoke when DSL is absent', () => {
    const result = buildViewHighlights(
      {},
      { highlightActive: 'holographic', highlightBeamHeight: 2.5, highlightSmoke: true },
      '#5090e0', 0, viewIds, viewStates,
    );
    expect(result[0].beamHeight).toBe(2.5);
    expect(result[0].smoke).toBe(true);
  });
});

// ─── compileTrayFromViewLayout — highlight integration ──────────────────────

describe('compileTrayFromViewLayout highlight integration', () => {
  it('produces empty viewHighlights when no highlight props set', () => {
    const trayProps: CarouselTrayProps = {};
    const state = compileTrayFromViewLayout(
      trayProps, 'layout-1', baseCarouselConfig, viewIds,
      containerBounds, viewStates, 'default', 'dark',
    );
    expect(state.viewHighlights).toEqual([]);
  });

  it('produces viewHighlights from DSL highlightActive prop', () => {
    const trayProps: CarouselTrayProps = { highlightActive: 'glow' };
    const config: CarouselLayoutConfig = { ...baseCarouselConfig, activeIndex: 1 };
    const state = compileTrayFromViewLayout(
      trayProps, 'layout-1', config, viewIds,
      containerBounds, viewStates, 'default', 'dark',
    );
    expect(state.viewHighlights).toHaveLength(3);
    expect(state.viewHighlights[1].mode).toBe('glow');
    expect(state.viewHighlights[0].mode).toBe('none');
    expect(state.viewHighlights[2].mode).toBe('none');
  });

  it('produces viewHighlights from theme highlightActive', () => {
    // Register a theme with highlight tokens
    const hlTheme: SceneTheme = {
      colorMode: 'dark',
      font: { htmlFamily: 'Inter' },
      fontSize: { heading: 1.5, body: 1.0, label: 0.85, caption: 0.7, annotation: 0.6 },
      carouselTray: {
        highlightActive: 'holographic',
        highlightColor: '#E36A2E',
      },
    };
    registerSceneThemePair('hlTheme' as ThemeFamily, { dark: hlTheme, light: hlTheme });

    const trayProps: CarouselTrayProps = {};
    const state = compileTrayFromViewLayout(
      trayProps, 'layout-1', baseCarouselConfig, viewIds,
      containerBounds, viewStates, 'hlTheme' as ThemeFamily, 'dark',
    );
    expect(state.viewHighlights).toHaveLength(3);
    expect(state.viewHighlights[0].mode).toBe('holographic');
    expect(state.viewHighlights[0].color).toBe('#E36A2E');
  });

  it('uses resolved accentColor as highlight color fallback', () => {
    const trayProps: CarouselTrayProps = { highlightActive: 'glow', accentColor: '#AABBCC' };
    const state = compileTrayFromViewLayout(
      trayProps, 'layout-1', baseCarouselConfig, viewIds,
      containerBounds, viewStates, 'default', 'dark',
    );
    // accentColor from DSL is '#AABBCC', used as highlight color fallback
    expect(state.viewHighlights[0].color).toBe('#AABBCC');
  });
});

// ─── buildViewHighlights — backdropColor ────────────────────────────────────

describe('buildViewHighlights backdropColor', () => {
  it('threads explicit backdropColor through to compiled highlight', () => {
    const result = buildViewHighlights(
      {
        highlights: [{ viewId: 'v1', mode: 'holographic', backdropColor: '#ff0000' }],
      },
      undefined, '#5090e0', 0, viewIds, viewStates, 'dark',
    );
    const v1 = result.find(h => h.viewId === 'v1')!;
    expect(v1.backdropColor).toBe('#ff0000');
  });

  it('threads variant backdropColor through to compiled highlight', () => {
    const palette = {
      primary: { color: '#4A88D0', backdropColor: '#112233', backdropOpacity: 0.7 },
    };
    const result = buildViewHighlights(
      {
        highlights: [{ viewId: 'v1', variant: 'primary' }],
      },
      undefined, '#5090e0', 0, viewIds, viewStates, 'dark', palette,
    );
    const v1 = result.find(h => h.viewId === 'v1')!;
    expect(v1.backdropColor).toBe('#112233');
  });

  it('explicit backdropColor overrides variant backdropColor', () => {
    const palette = {
      primary: { color: '#4A88D0', backdropColor: '#112233' },
    };
    const result = buildViewHighlights(
      {
        highlights: [{ viewId: 'v1', variant: 'primary', backdropColor: '#aabbcc' }],
      },
      undefined, '#5090e0', 0, viewIds, viewStates, 'dark', palette,
    );
    const v1 = result.find(h => h.viewId === 'v1')!;
    expect(v1.backdropColor).toBe('#aabbcc');
  });

  it('threads variant backdropColor for active-target highlights', () => {
    const palette = {
      error: { color: '#CC3333', backdropColor: '#334455' },
    };
    const result = buildViewHighlights(
      { highlightActive: 'holographic', highlightVariant: 'error' },
      undefined, '#5090e0', 0, viewIds, viewStates, 'dark', palette,
    );
    expect(result[0].backdropColor).toBe('#334455');
  });

  it('omits backdropColor when neither explicit nor variant sets it', () => {
    const result = buildViewHighlights(
      { highlightActive: 'glow' },
      undefined, '#5090e0', 0, viewIds, viewStates, 'dark',
    );
    expect(result[0].backdropColor).toBeUndefined();
  });
});

// ─── resolveRuntimeHighlight ────────────────────────────────────────────────

describe('resolveRuntimeHighlight', () => {
  const zeroBounds = { x: 0, y: 0, w: 0, h: 0 };
  const realBounds = { x: 0.1, y: 0.2, w: 0.3, h: 0.4 };

  it('produces a glow highlight with fallback color', () => {
    const hl = resolveRuntimeHighlight(
      { viewId: 'v1' },
      realBounds,
      '#5090e0',
    );
    expect(hl.viewId).toBe('v1');
    expect(hl.mode).toBe('glow');
    expect(hl.color).toBe('#5090e0');
    expect(hl.intensity).toBe(0.8); // HL_DEFAULT_GLOW_INTENSITY
    expect(hl.blendMode).toBe('additive');
    expect(hl.followView).toBe(true);
    expect(hl.bounds).toEqual(realBounds);
  });

  it('uses explicit mode and color', () => {
    const hl = resolveRuntimeHighlight(
      { viewId: 'v1', mode: 'holographic', color: '#ff0000' },
      zeroBounds,
      '#5090e0',
    );
    expect(hl.mode).toBe('holographic');
    expect(hl.color).toBe('#ff0000');
    expect(hl.intensity).toBe(0.5); // HL_DEFAULT_HOLOGRAPHIC_INTENSITY
    expect(hl.beamHeight).toBe(5.0);
    expect(hl.smoke).toBe(false);
    expect(hl.dust).toBe(false);
  });

  it('threads backdropColor through', () => {
    const hl = resolveRuntimeHighlight(
      { viewId: 'v1', backdropColor: '#e8e4e0' },
      zeroBounds,
      '#5090e0',
    );
    expect(hl.backdropColor).toBe('#e8e4e0');
  });

  it('threads backdropOpacity through', () => {
    const hl = resolveRuntimeHighlight(
      { viewId: 'v1', backdropOpacity: 0.7 },
      zeroBounds,
      '#5090e0',
    );
    expect(hl.backdropOpacity).toBe(0.7);
  });

  it('omits backdropColor when not specified', () => {
    const hl = resolveRuntimeHighlight(
      { viewId: 'v1' },
      zeroBounds,
      '#5090e0',
    );
    expect(hl.backdropColor).toBeUndefined();
  });

  it('omits holographic fields for glow mode', () => {
    const hl = resolveRuntimeHighlight(
      { viewId: 'v1', mode: 'glow' },
      zeroBounds,
      '#5090e0',
    );
    expect(hl.beamHeight).toBeUndefined();
    expect(hl.smoke).toBeUndefined();
    expect(hl.dust).toBeUndefined();
  });

  it('threads zOffset through', () => {
    const hl = resolveRuntimeHighlight(
      { viewId: 'v1', zOffset: -2.5 },
      zeroBounds,
      '#5090e0',
    );
    expect(hl.zOffset).toBe(-2.5);
  });

  it('uses explicit blendMode', () => {
    const hl = resolveRuntimeHighlight(
      { viewId: 'v1', blendMode: 'normal' },
      zeroBounds,
      '#5090e0',
    );
    expect(hl.blendMode).toBe('normal');
  });

  it('resolves variant mode from palette when cfg.mode is absent', () => {
    const palette = {
      error: { color: '#FF4444', mode: 'holographic' as const, intensity: 0.6, smoke: true },
    };
    const hl = resolveRuntimeHighlight(
      { viewId: 'v1', variant: 'error' },
      realBounds,
      '#5090e0',
      palette,
    );
    expect(hl.mode).toBe('holographic');
    expect(hl.color).toBe('#FF4444');
    expect(hl.intensity).toBe(0.6);
    expect(hl.smoke).toBe(true);
  });

  it('explicit cfg fields override variant fields from palette', () => {
    const palette = {
      error: { color: '#FF4444', mode: 'holographic' as const, intensity: 0.6 },
    };
    const hl = resolveRuntimeHighlight(
      { viewId: 'v1', variant: 'error', color: '#00FF00', mode: 'glow', intensity: 0.9 },
      realBounds,
      '#5090e0',
      palette,
    );
    expect(hl.mode).toBe('glow');
    expect(hl.color).toBe('#00FF00');
    expect(hl.intensity).toBe(0.9);
  });

  it('resolves variant backdropColor and backdropOpacity from palette', () => {
    const palette = {
      primary: { color: '#5090e0', backdropColor: '#112233', backdropOpacity: 0.8 },
    };
    const hl = resolveRuntimeHighlight(
      { viewId: 'v1', variant: 'primary' },
      zeroBounds,
      '#5090e0',
      palette,
    );
    expect(hl.backdropColor).toBe('#112233');
    expect(hl.backdropOpacity).toBe(0.8);
  });

  it('resolves variant blendMode from palette', () => {
    const palette = {
      primary: { color: '#5090e0', blendMode: 'normal' as const },
    };
    const hl = resolveRuntimeHighlight(
      { viewId: 'v1', variant: 'primary' },
      zeroBounds,
      '#5090e0',
      palette,
    );
    expect(hl.blendMode).toBe('normal');
  });

  it('falls back to glow mode when variant not found in palette', () => {
    const palette = {
      primary: { color: '#5090e0' },
    };
    const hl = resolveRuntimeHighlight(
      { viewId: 'v1', variant: 'error' },
      zeroBounds,
      '#5090e0',
      palette,
    );
    // 'error' not in palette → no variant resolution → fallback glow
    expect(hl.mode).toBe('glow');
    expect(hl.color).toBe('#5090e0'); // fallbackColor
  });

  it('ignores variant when no palette is provided', () => {
    const hl = resolveRuntimeHighlight(
      { viewId: 'v1', variant: 'error' },
      zeroBounds,
      '#5090e0',
    );
    // No palette → variant ignored → fallback defaults
    expect(hl.mode).toBe('glow');
    expect(hl.color).toBe('#5090e0');
  });
});

// ─── buildViewHighlightsFromDsl ─────────────────────────────────────────────

describe('buildViewHighlightsFromDsl', () => {
  it('returns highlight targeting active view', () => {
    const result = buildViewHighlightsFromDsl(
      [{ active: true }],
      '#5090e0', 1, viewIds, viewStates, 'dark',
    );
    expect(result).toHaveLength(1);
    expect(result[0].viewId).toBe('v2');
    expect(result[0].mode).toBe('glow');
    expect(result[0].color).toBe('#5090e0');
    expect(result[0].followView).toBe(true);
  });

  it('returns highlight targeting specific viewId', () => {
    const result = buildViewHighlightsFromDsl(
      [{ viewId: 'v3' }],
      '#5090e0', 0, viewIds, viewStates, 'dark',
    );
    expect(result).toHaveLength(1);
    expect(result[0].viewId).toBe('v3');
    expect(result[0].bounds).toEqual({ x: 0.5, y: 0.15, w: 0.3, h: 0.45 });
  });

  it('emits warning and skips when neither active nor viewId is set', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = buildViewHighlightsFromDsl(
      [{ mode: 'glow' }],
      '#5090e0', 0, viewIds, viewStates, 'dark',
    );
    expect(result).toHaveLength(0);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('has neither "active" nor "viewId"'),
    );
    warnSpy.mockRestore();
  });

  it('resolves variant from palette', () => {
    const palette = {
      error: { color: '#FF4444', mode: 'holographic' as const, intensity: 0.6, smoke: true, backdropColor: '#000' },
    };
    const result = buildViewHighlightsFromDsl(
      [{ active: true, variant: 'error' }],
      '#5090e0', 0, viewIds, viewStates, 'dark', palette,
    );
    expect(result[0].mode).toBe('holographic');
    expect(result[0].color).toBe('#FF4444');
    expect(result[0].intensity).toBe(0.6);
    expect(result[0].smoke).toBe(true);
    expect(result[0].backdropColor).toBe('#000');
  });

  it('explicit props override variant values', () => {
    const palette = {
      error: { color: '#FF4444', mode: 'holographic' as const, intensity: 0.6 },
    };
    const result = buildViewHighlightsFromDsl(
      [{ active: true, variant: 'error', color: '#00FF00', mode: 'glow', intensity: 0.9 }],
      '#5090e0', 0, viewIds, viewStates, 'dark', palette,
    );
    expect(result[0].color).toBe('#00FF00');
    expect(result[0].mode).toBe('glow');
    expect(result[0].intensity).toBe(0.9);
  });

  it('resolves highlightDefaults when no variant', () => {
    const result = buildViewHighlightsFromDsl(
      [{ active: true }],
      '#5090e0', 0, viewIds, viewStates, 'dark', undefined,
      { mode: 'holographic', backdropOpacity: 0.5, backdropColor: '#222', beamHeight: 3 },
    );
    expect(result[0].mode).toBe('holographic');
    expect(result[0].backdropOpacity).toBe(0.5);
    expect(result[0].backdropColor).toBe('#222');
    expect(result[0].beamHeight).toBe(3);
  });

  it('uses zero bounds for views not in viewStates', () => {
    const result = buildViewHighlightsFromDsl(
      [{ viewId: 'missing' }],
      '#5090e0', 0, viewIds, viewStates, 'dark',
    );
    expect(result[0].bounds).toEqual({ x: 0, y: 0, w: 0, h: 0 });
  });

  it('uses light polarity blend mode', () => {
    const result = buildViewHighlightsFromDsl(
      [{ active: true }],
      '#5090e0', 0, viewIds, viewStates, 'light',
    );
    expect(result[0].blendMode).toBe('normal');
  });

  it('multiple highlights produce multiple entries', () => {
    const result = buildViewHighlightsFromDsl(
      [
        { active: true, mode: 'glow' },
        { viewId: 'v3', mode: 'holographic', smoke: true },
      ],
      '#5090e0', 0, viewIds, viewStates, 'dark',
    );
    expect(result).toHaveLength(2);
    expect(result[0].viewId).toBe('v1');
    expect(result[0].mode).toBe('glow');
    expect(result[1].viewId).toBe('v3');
    expect(result[1].mode).toBe('holographic');
    expect(result[1].smoke).toBe(true);
  });

  it('does not include holographic fields for glow mode', () => {
    const result = buildViewHighlightsFromDsl(
      [{ active: true, mode: 'glow' }],
      '#5090e0', 0, viewIds, viewStates, 'dark',
    );
    expect(result[0].beamHeight).toBeUndefined();
    expect(result[0].smoke).toBeUndefined();
  });

  it('includes holographic fields for holographic mode', () => {
    const result = buildViewHighlightsFromDsl(
      [{ active: true, mode: 'holographic', beamHeight: 3, smoke: true, dust: true }],
      '#5090e0', 0, viewIds, viewStates, 'dark',
    );
    expect(result[0].beamHeight).toBe(3);
    expect(result[0].smoke).toBe(true);
    expect(result[0].dust).toBe(true);
  });

  it('includes zOffset when non-zero', () => {
    const result = buildViewHighlightsFromDsl(
      [{ active: true, zOffset: -2 }],
      '#5090e0', 0, viewIds, viewStates, 'dark',
    );
    expect(result[0].zOffset).toBe(-2);
  });

  it('omits zOffset when zero', () => {
    const result = buildViewHighlightsFromDsl(
      [{ active: true }],
      '#5090e0', 0, viewIds, viewStates, 'dark',
    );
    expect(result[0].zOffset).toBeUndefined();
  });
});

// ─── compileTrayFromViewLayout — DSL <Highlight> integration ────────────────

describe('compileTrayFromViewLayout DSL Highlight integration', () => {
  it('produces viewHighlights from dslHighlightConfigs', () => {
    const trayProps = {};
    const state = compileTrayFromViewLayout(
      trayProps, 'layout-1', baseCarouselConfig, viewIds,
      containerBounds, viewStates, 'default', 'dark',
      [{ active: true, mode: 'holographic', smoke: true }],
    );
    expect(state.viewHighlights).toHaveLength(1);
    expect(state.viewHighlights[0].viewId).toBe('v1');
    expect(state.viewHighlights[0].mode).toBe('holographic');
    expect(state.viewHighlights[0].smoke).toBe(true);
  });

  it('merges DSL <Highlight> with legacy tray props — DSL wins for same viewId', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const trayProps = { highlightActive: 'glow' as const };
    const state = compileTrayFromViewLayout(
      trayProps, 'layout-1', baseCarouselConfig, viewIds,
      containerBounds, viewStates, 'default', 'dark',
      [{ active: true, mode: 'holographic' }],
    );
    // DSL <Highlight> targets v1 (activeIndex=0) with holographic.
    // Legacy trayProps also targets v1 with glow.
    // DSL should win for v1.
    const v1Highlight = state.viewHighlights.find(h => h.viewId === 'v1');
    expect(v1Highlight).toBeDefined();
    expect(v1Highlight!.mode).toBe('holographic');
    warnSpy.mockRestore();
  });

  it('emits deprecation warning when legacy highlight* props are used', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    compileTrayFromViewLayout(
      { highlightActive: 'glow' }, 'layout-1', baseCarouselConfig, viewIds,
      containerBounds, viewStates, 'default', 'dark',
    );
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('highlight* props on <CarouselTray> are deprecated'),
    );
    warnSpy.mockRestore();
  });

  it('does not emit deprecation warning when no legacy highlight props', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    compileTrayFromViewLayout(
      {}, 'layout-1', baseCarouselConfig, viewIds,
      containerBounds, viewStates, 'default', 'dark',
      [{ active: true }],
    );
    // Should not see the deprecation warning (only DSL highlights, no legacy)
    const deprecationWarnings = warnSpy.mock.calls.filter(([msg]) =>
      typeof msg === 'string' && msg.includes('deprecated')
    );
    expect(deprecationWarnings).toHaveLength(0);
    warnSpy.mockRestore();
  });
});
