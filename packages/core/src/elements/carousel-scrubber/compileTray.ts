// Pure function: compiles a CarouselTray child into CarouselScrubberState.
// Extracted from viewLayoutHandler to make the DSL → theme → compiled state
// pipeline testable in isolation.

import type {CarouselTrayProps} from './dsl';
import type {CarouselScrubberState} from './types';
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
  return compileCarouselScrubber(
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
      },
    },
    carouselConfig.activeIndex,
    viewIds.length,
    isLoop,
    composedContainerBounds,
    {zStep: carouselConfig.zStep, spread: carouselConfig.spread},
    viewExtent,
  );
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
