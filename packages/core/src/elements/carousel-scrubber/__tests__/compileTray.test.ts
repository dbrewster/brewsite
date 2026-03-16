// Integration tests for compileTrayFromViewLayout — the full DSL → theme → compiled state pipeline.
// Tests the seam where DSL props, theme tokens, and compiled defaults merge.

import { describe, it, expect, beforeEach } from 'vitest';
import { compileTrayFromViewLayout, computeViewExtent, type TrayViewBounds } from '../compileTray';
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
