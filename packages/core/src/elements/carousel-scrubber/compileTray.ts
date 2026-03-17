// Pure function: compiles a CarouselTray child into CarouselScrubberState.
// Extracted from viewLayoutHandler to make the DSL → theme → compiled state
// pipeline testable in isolation.

import type {CarouselTrayProps} from './dsl';
import type {CarouselScrubberState, ViewHighlight, ViewHighlightMode} from './types';
import type {CarouselLayoutConfig} from '../../layout/index';
import type {NVSRect} from '../../layout/types';
import type {ThemeFamily} from '../../theme/types';
import {resolveSceneTheme} from '../../theme/index';
import {compileCarouselScrubber} from './compile';

/**
 * Resolved view bounds for a single view in a carousel layout.
 * Only the `bounds` field is needed for tray extent computation.
 */
export type TrayViewBounds = {
  readonly bounds: NVSRect;
};

/**
 * Compiles a <CarouselTray> child component into a fully theme-resolved
 * CarouselScrubberState.
 *
 * Merge priority: DSL props > theme tokens > compiled defaults.
 *
 * This function owns all three concerns:
 * 1. Theme resolution via resolveSceneTheme()
 * 2. View extent computation from resolved view bounds
 * 3. Delegation to compileCarouselScrubber() with merged style
 *
 * Pure function — no side effects, no Three.js, no React runtime.
 */
export function compileTrayFromViewLayout(
  trayProps: CarouselTrayProps,
  layoutId: string,
  carouselConfig: CarouselLayoutConfig,
  viewIds: readonly string[],
  composedContainerBounds: NVSRect,
  viewStates: ReadonlyMap<string, TrayViewBounds>,
  themeFamily: ThemeFamily,
  themePolarity: 'dark' | 'light',
): CarouselScrubberState {
  const isLoop = carouselConfig.loop ?? false;
  const trayDepth = trayProps.depth ?? 0.36;

  // -- View extent: tight bounding box of all resolved view rects ----------
  const viewExtent = computeViewExtent(viewIds, viewStates, composedContainerBounds);

  // -- Theme resolution: DSL props > theme tokens > compiled defaults ------
  const sceneTheme = resolveSceneTheme(themeFamily, themePolarity);
  const trayTheme = sceneTheme.carouselTray;

  const trayWidgetId = `${layoutId}__tray`;
  const baseState = compileCarouselScrubber(
    {
      id: trayWidgetId,
      layoutId,
      showBase: true,
      trayDepth,
      gap: trayProps.gap ?? trayTheme?.gap,
      style: {
        baseColor: trayProps.color ?? trayTheme?.color,
        baseOpacity: trayProps.opacity ?? trayTheme?.opacity,
        accentColor: trayProps.accentColor ?? trayTheme?.accentColor,
        metalness: trayProps.metalness ?? trayTheme?.metalness,
        roughness: trayProps.roughness ?? trayTheme?.roughness,
        edgeStyle: trayProps.edgeStyle ?? trayTheme?.edgeStyle,
        surfacePattern: trayProps.surfacePattern ?? trayTheme?.surfacePattern,
        surfaceIntensity: trayProps.surfaceIntensity ?? trayTheme?.surfaceIntensity,
        surfaceMapUrl: trayProps.surfaceMapUrl ?? trayTheme?.surfaceMapUrl,
        surfaceMaterial: trayProps.surface ?? trayTheme?.surfaceMaterial,
        materialApplication: {
          ...trayTheme?.materialApplication,
          ...(trayProps.colorMix !== undefined ? { colorMix: trayProps.colorMix } : {}),
          ...(trayProps.brightness !== undefined ? { brightness: trayProps.brightness } : {}),
          ...(trayProps.saturation !== undefined ? { saturation: trayProps.saturation } : {}),
          ...(trayProps.contrast !== undefined ? { contrast: trayProps.contrast } : {}),
          ...(trayProps.depthMix !== undefined ? { depthMix: trayProps.depthMix } : {}),
          ...(trayProps.roughnessMix !== undefined ? { roughnessMix: trayProps.roughnessMix } : {}),
          ...(trayProps.tint !== undefined ? { tint: trayProps.tint } : {}),
          ...(trayProps.texScale !== undefined ? { texScale: trayProps.texScale } : {}),
          ...(trayProps.iridescence !== undefined ? { iridescence: trayProps.iridescence } : {}),
          ...(trayProps.iridescenceIOR !== undefined ? { iridescenceIOR: trayProps.iridescenceIOR } : {}),
          ...(trayProps.iridescenceThicknessRange !== undefined ? { iridescenceThicknessRange: trayProps.iridescenceThicknessRange } : {}),
        },
      },
    },
    carouselConfig.activeIndex,
    viewIds.length,
    isLoop,
    composedContainerBounds,
    {zStep: carouselConfig.zStep, spread: carouselConfig.spread},
    viewExtent,
  );

  // -- View highlights: build per-view highlight array from DSL + theme ------
  const viewHighlights = buildViewHighlights(
    trayProps,
    trayTheme,
    baseState.style.accentColor,
    carouselConfig.activeIndex,
    viewIds,
    viewStates,
  );

  return {
    ...baseState,
    viewHighlights,
  };
}

/**
 * Computes the tight NVS bounding box of all resolved carousel views.
 * Falls back to composedContainerBounds when no views have resolved bounds.
 *
 * Exported for testing — callers outside this module should use
 * compileTrayFromViewLayout() which calls this internally.
 */
export function computeViewExtent(
  viewIds: readonly string[],
  viewStates: ReadonlyMap<string, TrayViewBounds>,
  fallback: NVSRect,
): NVSRect {
  let extMinX = Infinity;
  let extMinY = Infinity;
  let extMaxX = -Infinity;
  let extMaxY = -Infinity;

  for (const vid of viewIds) {
    const vs = viewStates.get(vid);
    if (!vs?.bounds) continue;
    extMinX = Math.min(extMinX, vs.bounds.x);
    extMinY = Math.min(extMinY, vs.bounds.y);
    extMaxX = Math.max(extMaxX, vs.bounds.x + vs.bounds.w);
    extMaxY = Math.max(extMaxY, vs.bounds.y + vs.bounds.h);
  }

  return Number.isFinite(extMinX)
    ? {x: extMinX, y: extMinY, w: extMaxX - extMinX, h: extMaxY - extMinY}
    : fallback;
}

/** Default intensity for glow highlights. */
const DEFAULT_GLOW_INTENSITY = 0.5;
/** Default intensity for holographic highlights. */
const DEFAULT_HOLOGRAPHIC_INTENSITY = 0.35;
/** Default beam height for holographic highlights in world units. */
const DEFAULT_BEAM_HEIGHT = 1.5;

/**
 * Resolves the highlight mode from DSL prop (which accepts boolean shorthand)
 * and theme fallback.
 *
 * - `true` -> `'glow'`
 * - `false` -> `'none'`
 * - `undefined` -> theme fallback -> `'none'`
 *
 * Exported for testing.
 */
export function resolveHighlightMode(
  dslProp: ViewHighlightMode | boolean | undefined,
  themeFallback: ViewHighlightMode | undefined,
): ViewHighlightMode {
  if (dslProp === true) return 'glow';
  if (dslProp === false) return 'none';
  if (dslProp !== undefined) return dslProp;
  return themeFallback ?? 'none';
}

/**
 * Builds the per-view highlight array from DSL props, theme tokens, and view bounds.
 * Only the view at `activeIndex` receives the highlight; all others get mode 'none'.
 *
 * Returns an empty array when highlight mode resolves to 'none'.
 *
 * Exported for testing.
 */
export function buildViewHighlights(
  trayProps: CarouselTrayProps,
  trayTheme: import('../../theme/types').SceneThemeCarouselTray | undefined,
  resolvedAccentColor: string,
  activeIndex: number,
  viewIds: readonly string[],
  viewStates: ReadonlyMap<string, TrayViewBounds>,
): readonly ViewHighlight[] {
  const mode = resolveHighlightMode(trayProps.highlightActive, trayTheme?.highlightActive);
  if (mode === 'none') return [];

  const color = trayProps.highlightColor ?? trayTheme?.highlightColor ?? resolvedAccentColor;
  const defaultIntensity = mode === 'glow' ? DEFAULT_GLOW_INTENSITY : DEFAULT_HOLOGRAPHIC_INTENSITY;
  const intensity = trayProps.highlightIntensity ?? trayTheme?.highlightIntensity ?? defaultIntensity;
  const beamHeight = trayProps.highlightBeamHeight ?? trayTheme?.highlightBeamHeight ?? DEFAULT_BEAM_HEIGHT;
  const smoke = trayProps.highlightSmoke ?? trayTheme?.highlightSmoke ?? false;

  const highlights: ViewHighlight[] = [];

  for (let i = 0; i < viewIds.length; i++) {
    const viewId = viewIds[i];
    const vs = viewStates.get(viewId);
    const bounds = vs?.bounds ?? { x: 0, y: 0, w: 0, h: 0 };

    if (i === activeIndex) {
      const highlight: ViewHighlight = {
        viewId,
        bounds,
        mode,
        color,
        intensity,
        ...(mode === 'holographic' ? { beamHeight, smoke } : {}),
      };
      highlights.push(highlight);
    } else {
      highlights.push({
        viewId,
        bounds,
        mode: 'none',
        color,
        intensity: 0,
      });
    }
  }

  return highlights;
}
