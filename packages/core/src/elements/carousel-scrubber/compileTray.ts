// Pure function: compiles a CarouselTray child into CarouselScrubberState.
// Extracted from viewLayoutHandler to make the DSL → theme → compiled state
// pipeline testable in isolation.

import type {CarouselTrayProps} from './dsl';
import type {HighlightProps} from './highlightDsl';
import type {CarouselScrubberState, ViewHighlight, ViewHighlightConfig, ViewHighlightMode} from './types';
import {HL_DEFAULT_GLOW_INTENSITY, HL_DEFAULT_HOLOGRAPHIC_INTENSITY, HL_DEFAULT_BEAM_HEIGHT} from './highlightConstants';
import type {CarouselLayoutConfig} from '../../layout/index';
import type {NVSRect} from '../../layout/types';
import type {ThemeFamily, SceneThemeHighlightVariant, SceneThemeHighlightPalette, HighlightVariantName} from '../../theme/types';
import type {MaterialApplication} from '../../widget/materialTypes';
import {resolveSceneTheme} from '../../theme/index';
import {darkHighlightPalette, lightHighlightPalette} from '../../theme/highlightPalettes';
import {compileCarouselScrubber} from './compile';

/**
 * Resolved view bounds for a single view in a carousel layout.
 * Only the `bounds` field is needed for tray extent computation.
 */
export type TrayViewBounds = {
  readonly bounds: NVSRect;
};

/**
 * Builds a MaterialApplication by layering DSL prop overrides on top of
 * theme defaults. Only defined DSL values are applied — undefined props
 * do not clobber theme values.
 */
function buildMaterialApplication(
  trayProps: CarouselTrayProps,
  themeBase: MaterialApplication | undefined,
): MaterialApplication {
  const result: Record<string, unknown> = { ...themeBase };
  const overrides: Record<string, unknown> = {
    colorMix: trayProps.colorMix,
    brightness: trayProps.brightness,
    saturation: trayProps.saturation,
    contrast: trayProps.contrast,
    depthMix: trayProps.depthMix,
    roughnessMix: trayProps.roughnessMix,
    tint: trayProps.tint,
    texScale: trayProps.texScale,
    iridescence: trayProps.iridescence,
    iridescenceIOR: trayProps.iridescenceIOR,
    iridescenceThicknessRange: trayProps.iridescenceThicknessRange,
  };
  for (const [key, value] of Object.entries(overrides)) {
    if (value !== undefined) result[key] = value;
  }
  return result as MaterialApplication;
}

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
  dslHighlightConfigs?: readonly HighlightProps[],
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
      outerMargin: trayProps.outerMargin ?? trayTheme?.outerMargin,
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
        materialApplication: buildMaterialApplication(trayProps, trayTheme?.materialApplication),
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
  // Use the theme's palette if defined, otherwise fall back to the
  // polarity-appropriate default palette.
  const highlightPalette = sceneTheme.highlightPalette
    ?? (themePolarity === 'light' ? lightHighlightPalette : darkHighlightPalette);

  // Emit deprecation warning when legacy highlight* props are used on <CarouselTray>.
  const hasLegacyHighlightProps = trayProps.highlightActive !== undefined
    || trayProps.highlightVariant !== undefined
    || trayProps.highlightColor !== undefined
    || trayProps.highlightIntensity !== undefined
    || trayProps.highlightBeamHeight !== undefined
    || trayProps.highlightSmoke !== undefined
    || trayProps.highlightZOffset !== undefined
    || trayProps.highlightViewId !== undefined
    || (trayProps.highlights !== undefined && trayProps.highlights.length > 0);

  if (hasLegacyHighlightProps) {
    console.warn(
      '[CarouselTray] highlight* props on <CarouselTray> are deprecated — use <Highlight> as a sibling child of <ViewLayout>.',
    );
  }

  // Build highlights from legacy tray props (backward compat).
  const legacyHighlights = buildViewHighlights(
    trayProps,
    trayTheme,
    baseState.style.accentColor,
    carouselConfig.activeIndex,
    viewIds,
    viewStates,
    themePolarity,
    highlightPalette,
  );

  // Build highlights from new <Highlight> DSL children.
  const dslHighlights = dslHighlightConfigs && dslHighlightConfigs.length > 0
    ? buildViewHighlightsFromDsl(
      dslHighlightConfigs,
      baseState.style.accentColor,
      carouselConfig.activeIndex,
      viewIds,
      viewStates,
      themePolarity,
      highlightPalette,
      sceneTheme.highlightDefaults,
    )
    : [];

  // Merge both sources: DSL <Highlight> children override legacy for the same viewId.
  const viewHighlights = mergeHighlightSources(legacyHighlights, dslHighlights);

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

// Highlight defaults imported from types.ts — single source of truth.

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
 * Resolves a highlight variant name to its theme definition.
 * Returns undefined if the variant is not in the palette.
 */
function resolveHighlightVariant(
  variantName: HighlightVariantName | undefined,
  palette: import('../../theme/types').SceneThemeHighlightPalette | undefined,
): SceneThemeHighlightVariant | undefined {
  if (!variantName || !palette) return undefined;
  return palette[variantName];
}

/** Resolves the default intensity based on highlight mode. */
function defaultIntensityForMode(mode: ViewHighlightMode): number {
  return mode === 'glow' ? HL_DEFAULT_GLOW_INTENSITY : HL_DEFAULT_HOLOGRAPHIC_INTENSITY;
}

/** Resolves the default blend mode based on polarity. */
function defaultBlendForPolarity(polarity: 'dark' | 'light'): 'additive' | 'normal' {
  return polarity === 'light' ? 'normal' : 'additive';
}

/** Assembles holographic-specific fields when the mode requires them. */
function holographicFields(
  mode: ViewHighlightMode,
  beamHeight: number,
  smoke: boolean,
  dust: boolean,
): Partial<ViewHighlight> {
  if (mode !== 'holographic') return {};
  return { beamHeight, smoke, dust };
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
  polarity: 'dark' | 'light' = 'dark',
  palette?: import('../../theme/types').SceneThemeHighlightPalette,
): readonly ViewHighlight[] {
  const activeMode = resolveHighlightMode(trayProps.highlightActive, trayTheme?.highlightActive);
  const explicitHighlights = trayProps.highlights;
  const hasActiveHighlight = activeMode !== 'none';
  const hasExplicit = explicitHighlights && explicitHighlights.length > 0;

  if (!hasActiveHighlight && !hasExplicit) return [];

  // Build a lookup of explicit per-view configs (last one wins for a given viewId).
  const explicitByViewId = new Map<string, ViewHighlightConfig>();
  if (hasExplicit) {
    for (const cfg of explicitHighlights) {
      explicitByViewId.set(cfg.viewId, cfg);
    }
  }

  // Shared defaults resolved from DSL > theme > constants.
  const defaultColor = trayProps.highlightColor ?? trayTheme?.highlightColor ?? resolvedAccentColor;
  const defaultBeamHeight = trayProps.highlightBeamHeight ?? trayTheme?.highlightBeamHeight ?? HL_DEFAULT_BEAM_HEIGHT;
  const defaultSmoke = trayProps.highlightSmoke ?? trayTheme?.highlightSmoke ?? false;
  const defaultZOffset = trayProps.highlightZOffset ?? trayTheme?.highlightZOffset ?? 0;
  const targetViewId = trayProps.highlightViewId ?? trayTheme?.highlightViewId;

  const highlights: ViewHighlight[] = [];

  for (let i = 0; i < viewIds.length; i++) {
    const viewId = viewIds[i];
    const vs = viewStates.get(viewId);
    const bounds = vs?.bounds ?? { x: 0, y: 0, w: 0, h: 0 };

    const explicit = explicitByViewId.get(viewId);
    const isActiveTarget = hasActiveHighlight && (
      targetViewId ? viewId === targetViewId : i === activeIndex
    );

    if (explicit) {
      // Explicit config takes priority over highlightActive.
      // Variant values fill in anything the explicit config doesn't set.
      const series = resolveHighlightVariant(explicit.variant, palette);
      const mode = explicit.mode ?? series?.mode ?? 'glow';
      const color = explicit.color ?? series?.color ?? defaultColor;
      const intensity = explicit.intensity ?? series?.intensity ?? defaultIntensityForMode(mode);
      const blendMode = explicit.blendMode ?? series?.blendMode ?? defaultBlendForPolarity(polarity);
      const bdOpacity = explicit.backdropOpacity ?? series?.backdropOpacity;
      const bdColor = explicit.backdropColor ?? series?.backdropColor;
      highlights.push({
        viewId,
        bounds,
        mode,
        color,
        intensity,
        blendMode,
        ...holographicFields(
          mode,
          explicit.beamHeight ?? series?.beamHeight ?? defaultBeamHeight,
          explicit.smoke ?? series?.smoke ?? defaultSmoke,
          explicit.dust ?? series?.dust ?? false,
        ),
        ...(explicit.zOffset !== undefined ? { zOffset: explicit.zOffset } : defaultZOffset !== 0 ? { zOffset: defaultZOffset } : {}),
        ...(bdOpacity !== undefined ? { backdropOpacity: bdOpacity } : {}),
        ...(bdColor !== undefined ? { backdropColor: bdColor } : {}),
        ...(explicit.pulseSpeed !== undefined && explicit.pulseSpeed > 0 ? { pulseSpeed: explicit.pulseSpeed } : {}),
        ...(explicit.pulseIntensity !== undefined && explicit.pulseIntensity > 0 ? { pulseIntensity: explicit.pulseIntensity } : {}),
        followView: true,
      });
    } else if (isActiveTarget) {
      // Active target: resolve from highlightVariant DSL prop if set.
      const variant = resolveHighlightVariant(trayProps.highlightVariant, palette);
      const mode = variant?.mode ?? activeMode;
      const color = trayProps.highlightColor ?? variant?.color ?? trayTheme?.highlightColor ?? resolvedAccentColor;
      const intensity = trayProps.highlightIntensity ?? variant?.intensity ?? trayTheme?.highlightIntensity
        ?? defaultIntensityForMode(activeMode);
      const blendMode = variant?.blendMode ?? defaultBlendForPolarity(polarity);
      highlights.push({
        viewId,
        bounds,
        mode,
        color,
        intensity,
        blendMode,
        ...holographicFields(
          mode,
          trayProps.highlightBeamHeight ?? variant?.beamHeight ?? defaultBeamHeight,
          trayProps.highlightSmoke ?? variant?.smoke ?? defaultSmoke,
          variant?.dust ?? false,
        ),
        ...(defaultZOffset !== 0 ? { zOffset: defaultZOffset } : {}),
        ...(variant?.backdropOpacity !== undefined ? { backdropOpacity: variant.backdropOpacity } : {}),
        ...(variant?.backdropColor !== undefined ? { backdropColor: variant.backdropColor } : {}),
        ...(targetViewId ? { followView: true } : {}),
      });
    } else {
      highlights.push({
        viewId,
        bounds,
        mode: 'none',
        color: defaultColor,
        intensity: 0,
        blendMode: 'additive',
      });
    }
  }

  return highlights;
}

/**
 * Converts parsed `<Highlight>` DSL props into concrete `ViewHighlight[]`.
 *
 * Resolution chain per highlight:
 * 1. Resolve variant from `props.variant` → palette[variant]
 * 2. Each field: `props.{field} ?? variant.{field} ?? highlightDefaults.{field} ?? constant default`
 * 3. `active` → targets view at `activeIndex`; `viewId` → targets named view; neither → warning
 *
 * Exported for testing.
 */
export function buildViewHighlightsFromDsl(
  configs: readonly HighlightProps[],
  resolvedAccentColor: string,
  activeIndex: number,
  viewIds: readonly string[],
  viewStates: ReadonlyMap<string, TrayViewBounds>,
  polarity: 'dark' | 'light' = 'dark',
  palette?: SceneThemeHighlightPalette,
  highlightDefaults?: import('../../theme/types').SceneThemeHighlightDefaults,
): readonly ViewHighlight[] {
  const highlights: ViewHighlight[] = [];

  for (const cfg of configs) {
    // Determine target viewId.
    let targetViewId: string | undefined;
    if (cfg.active) {
      targetViewId = viewIds[activeIndex];
    } else if (cfg.viewId) {
      targetViewId = cfg.viewId;
    } else {
      console.warn(
        '[Highlight] <Highlight> has neither "active" nor "viewId" — highlight has no target and will be ignored.',
      );
      continue;
    }

    if (!targetViewId) continue;

    const vs = viewStates.get(targetViewId);
    const bounds = vs?.bounds ?? { x: 0, y: 0, w: 0, h: 0 };

    // Resolve variant from palette.
    const variant = resolveHighlightVariant(cfg.variant, palette);

    // Resolve fields: explicit prop → variant → highlightDefaults → constant default.
    const mode = cfg.mode ?? variant?.mode ?? highlightDefaults?.mode ?? 'glow';
    const color = cfg.color ?? variant?.color ?? resolvedAccentColor;
    const intensity = cfg.intensity ?? variant?.intensity ?? defaultIntensityForMode(mode);
    const blendMode = cfg.blendMode ?? variant?.blendMode ?? defaultBlendForPolarity(polarity);
    const beamHeight = cfg.beamHeight ?? variant?.beamHeight ?? highlightDefaults?.beamHeight ?? HL_DEFAULT_BEAM_HEIGHT;
    const smoke = cfg.smoke ?? variant?.smoke ?? false;
    const dust = cfg.dust ?? variant?.dust ?? false;
    const zOffset = cfg.zOffset ?? 0;
    const bdOpacity = cfg.backdropOpacity ?? variant?.backdropOpacity ?? highlightDefaults?.backdropOpacity;
    const bdColor = cfg.backdropColor ?? variant?.backdropColor ?? highlightDefaults?.backdropColor;
    const pulseSpeed = cfg.pulseSpeed;
    const pulseIntensity = cfg.pulseIntensity;

    highlights.push({
      viewId: targetViewId,
      bounds,
      mode,
      color,
      intensity,
      blendMode,
      ...holographicFields(mode, beamHeight, smoke, dust),
      ...(zOffset !== 0 ? { zOffset } : {}),
      ...(bdOpacity !== undefined ? { backdropOpacity: bdOpacity } : {}),
      ...(bdColor !== undefined ? { backdropColor: bdColor } : {}),
      ...(pulseSpeed !== undefined && pulseSpeed > 0 ? { pulseSpeed } : {}),
      ...(pulseIntensity !== undefined && pulseIntensity > 0 ? { pulseIntensity } : {}),
      followView: true,
    });
  }

  return highlights;
}

/**
 * Merges two highlight source arrays. DSL `<Highlight>` entries override legacy
 * entries for the same viewId. Non-overlapping entries from both sources are kept.
 */
function mergeHighlightSources(
  legacy: readonly ViewHighlight[],
  dsl: readonly ViewHighlight[],
): readonly ViewHighlight[] {
  if (dsl.length === 0) return legacy;
  if (legacy.length === 0) return dsl;

  // DSL entries win for overlapping viewIds.
  const dslViewIds = new Set(dsl.map(h => h.viewId));
  const merged: ViewHighlight[] = [];
  for (const h of legacy) {
    if (!dslViewIds.has(h.viewId)) {
      merged.push(h);
    }
  }
  merged.push(...dsl);
  return merged;
}

/**
 * Resolves a runtime (programmatic) ViewHighlightConfig into a fully concrete
 * ViewHighlight suitable for the render layer.
 *
 * Extracted from render.ts to make this pure compilation logic testable.
 * The render layer calls this when merging runtime highlights with compiled ones.
 *
 * @param cfg - The programmatic highlight configuration.
 * @param fallbackBounds - NVS bounds to use (typically from the compiled highlight for the same viewId).
 * @param fallbackColor - Fallback color when cfg.color is not set (typically accentColor).
 * @param palette - Optional highlight palette for variant resolution.
 *   When cfg.variant is set and a palette is provided, variant values fill in
 *   any fields not explicitly set on cfg.
 */
export function resolveRuntimeHighlight(
  cfg: ViewHighlightConfig,
  fallbackBounds: { x: number; y: number; w: number; h: number },
  fallbackColor: string,
  palette?: SceneThemeHighlightPalette,
): ViewHighlight {
  // Resolve variant from palette when provided.
  const variant = resolveHighlightVariant(cfg.variant, palette);
  const mode = cfg.mode ?? variant?.mode ?? 'glow';
  return {
    viewId: cfg.viewId,
    bounds: fallbackBounds,
    mode,
    color: cfg.color ?? variant?.color ?? fallbackColor,
    intensity: cfg.intensity ?? variant?.intensity ?? (mode === 'holographic' ? HL_DEFAULT_HOLOGRAPHIC_INTENSITY : HL_DEFAULT_GLOW_INTENSITY),
    ...(mode === 'holographic' ? { beamHeight: cfg.beamHeight ?? variant?.beamHeight ?? HL_DEFAULT_BEAM_HEIGHT, smoke: cfg.smoke ?? variant?.smoke ?? false, dust: cfg.dust ?? variant?.dust ?? false } : {}),
    ...(cfg.zOffset !== undefined ? { zOffset: cfg.zOffset } : {}),
    ...(cfg.backdropOpacity !== undefined ? { backdropOpacity: cfg.backdropOpacity } : variant?.backdropOpacity !== undefined ? { backdropOpacity: variant.backdropOpacity } : {}),
    ...(cfg.backdropColor !== undefined ? { backdropColor: cfg.backdropColor } : variant?.backdropColor !== undefined ? { backdropColor: variant.backdropColor } : {}),
    blendMode: cfg.blendMode ?? variant?.blendMode ?? 'additive',
    ...(cfg.pulseSpeed !== undefined && cfg.pulseSpeed > 0 ? { pulseSpeed: cfg.pulseSpeed } : {}),
    ...(cfg.pulseIntensity !== undefined && cfg.pulseIntensity > 0 ? { pulseIntensity: cfg.pulseIntensity } : {}),
    followView: true,
  };
}
