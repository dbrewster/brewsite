// CarouselScrubber element compilation — pure state resolution and transition spec.

import type { CarouselScrubberState, CarouselScrubberStyle, ViewHighlight } from './types';
import type { CarouselScrubberProps } from './dsl';
import type { FunctionalTransitionSpec } from '../../compiler/transitions/transitionTypes';
import { blendNumber, blendColor, blendMaterialApplication } from '../../compiler/transitions/transitionTypes';

/** Default visual style for the carousel scrubber. */
export const DEFAULT_CAROUSEL_SCRUBBER_STYLE: CarouselScrubberStyle = {
  baseColor: '#1E2F44',
  baseOpacity: 0.82,
  accentColor: '#5090e0',
  metalness: 0.35,
  roughness: 0.6,
  edgeStyle: 'knurled',
  surfacePattern: 'brushed',
  surfaceIntensity: 0.25,
  surfaceMapUrl: null,
  surfaceMaterial: null,
  materialApplication: {},
};

/** Default compiled state used by the widget when no scene declares a CarouselScrubber. */
export const DEFAULT_CAROUSEL_SCRUBBER_STATE: CarouselScrubberState = {
  layoutId: '',
  activeIndex: 0,
  childCount: 0,
  loop: false,
  style: DEFAULT_CAROUSEL_SCRUBBER_STYLE,
  showBase: true,
  trayDepth: 0.36,
  gap: 0.02,
  nvsBounds: { x: 0, y: 0, w: 1, h: 1 },
  viewExtent: { x: 0, y: 0, w: 1, h: 1 },
  outerMargin: 0,
  zStep: 0,
  spread: 0.45,
  viewHighlights: [],
};

/**
 * Resolves CarouselScrubberProps into a fully concrete CarouselScrubberState.
 *
 * Pure function — no side effects, no Three.js, no React.
 * Called by viewLayoutHandler when a <CarouselTray> child is detected.
 */
export function compileCarouselScrubber(
  props: CarouselScrubberProps,
  activeIndex: number,
  childCount: number,
  loop: boolean,
  nvsBounds?: { x: number; y: number; w: number; h: number },
  carouselConfig?: { zStep?: number; spread?: number },
  viewExtent?: { x: number; y: number; w: number; h: number },
): CarouselScrubberState {
  // Strip undefined values from props.style before merging — undefined from
  // a spread (e.g. { baseColor: trayProps.color } when color is not set)
  // would overwrite the default with undefined, producing an invalid state.
  const definedStyle: Partial<CarouselScrubberStyle> = {};
  if (props.style) {
    for (const [k, v] of Object.entries(props.style)) {
      if (v !== undefined) {
        (definedStyle as Record<string, unknown>)[k] = v;
      }
    }
  }

  const style: CarouselScrubberStyle = {
    ...DEFAULT_CAROUSEL_SCRUBBER_STYLE,
    ...definedStyle,
  };

  const bounds = nvsBounds ?? { x: 0, y: 0, w: 1, h: 1 };

  return {
    layoutId: props.layoutId,
    activeIndex,
    childCount,
    loop,
    style,
    showBase: props.showBase ?? true,
    trayDepth: props.trayDepth ?? 0.36,
    gap: props.gap ?? 0.02,
    nvsBounds: bounds,
    viewExtent: viewExtent ?? bounds,
    outerMargin: props.outerMargin ?? 0,
    zStep: carouselConfig?.zStep ?? 0,
    spread: carouselConfig?.spread ?? 0.45,
    viewHighlights: [],
  };
}

/**
 * Blends two CarouselScrubberStyle objects at progress t.
 */
function blendStyle(
  from: CarouselScrubberStyle,
  to: CarouselScrubberStyle,
  t: number,
): CarouselScrubberStyle {
  return {
    baseColor: blendColor(from.baseColor, to.baseColor, t) ?? to.baseColor,
    baseOpacity: blendNumber(from.baseOpacity, to.baseOpacity, t) ?? to.baseOpacity,
    accentColor: blendColor(from.accentColor, to.accentColor, t) ?? to.accentColor,
    metalness: blendNumber(from.metalness, to.metalness, t) ?? to.metalness,
    roughness: blendNumber(from.roughness, to.roughness, t) ?? to.roughness,
    edgeStyle: t < 0.5 ? from.edgeStyle : to.edgeStyle,
    surfacePattern: t < 0.5 ? from.surfacePattern : to.surfacePattern,
    surfaceIntensity: blendNumber(from.surfaceIntensity, to.surfaceIntensity, t) ?? to.surfaceIntensity,
    surfaceMapUrl: t < 0.5 ? from.surfaceMapUrl : to.surfaceMapUrl,
    surfaceMaterial: t < 0.5 ? from.surfaceMaterial : to.surfaceMaterial,
    materialApplication: blendMaterialApplication(from.materialApplication, to.materialApplication, t) ?? to.materialApplication,
  };
}

/**
 * Functional transition spec for CarouselScrubber.
 */
/**
 * Fades highlight intensities and backdrop opacities toward zero at progress t.
 * Returns a new array with all intensities scaled by (1 - t).
 */
function fadeHighlightsOut(
  highlights: readonly ViewHighlight[],
  t: number,
): readonly ViewHighlight[] {
  if (highlights.length === 0) return highlights;
  const scale = 1 - t;
  return highlights.map((h) => ({
    ...h,
    intensity: (h.intensity ?? 0) * scale,
    backdropOpacity: (h.backdropOpacity ?? 0) * scale,
  }));
}

/**
 * Fades highlight intensities and backdrop opacities from zero toward their
 * target values at progress t.
 */
function fadeHighlightsIn(
  highlights: readonly ViewHighlight[],
  t: number,
): readonly ViewHighlight[] {
  if (highlights.length === 0) return highlights;
  return highlights.map((h) => ({
    ...h,
    intensity: (h.intensity ?? 0) * t,
    backdropOpacity: (h.backdropOpacity ?? 0) * t,
  }));
}

/**
 * Cross-fades between two highlight arrays. The FROM set fades out while the
 * TO set fades in, with both at half-intensity at the midpoint.
 */
function crossFadeHighlights(
  from: readonly ViewHighlight[],
  to: readonly ViewHighlight[],
  t: number,
): readonly ViewHighlight[] {
  // Build a merged set keyed by viewId. Where both FROM and TO have the same
  // viewId, blend intensity/backdrop. Otherwise fade out (FROM) or fade in (TO).
  const fromMap = new Map(from.map((h) => [h.viewId, h]));
  const toMap = new Map(to.map((h) => [h.viewId, h]));
  const allIds = new Set([...fromMap.keys(), ...toMap.keys()]);

  const result: ViewHighlight[] = [];
  for (const viewId of allIds) {
    const f = fromMap.get(viewId);
    const tgt = toMap.get(viewId);
    if (f && tgt) {
      // Both present — blend intensity and backdrop
      result.push({
        ...(t < 0.5 ? f : tgt),
        intensity: blendNumber(f.intensity, tgt.intensity, t) ?? tgt.intensity,
        backdropOpacity: blendNumber(f.backdropOpacity ?? 0, tgt.backdropOpacity ?? 0, t) ?? (tgt.backdropOpacity ?? 0),
      });
    } else if (f) {
      // FROM only — fade out
      result.push({
        ...f,
        intensity: (f.intensity ?? 0) * (1 - t),
        backdropOpacity: (f.backdropOpacity ?? 0) * (1 - t),
      });
    } else if (tgt) {
      // TO only — fade in
      result.push({
        ...tgt,
        intensity: (tgt.intensity ?? 0) * t,
        backdropOpacity: (tgt.backdropOpacity ?? 0) * t,
      });
    }
  }
  return result;
}

export const carouselScrubberTransitionSpec: FunctionalTransitionSpec<CarouselScrubberState> = {
  exitFn: (from) => ({ t }) => ({
    ...from,
    style: {
      ...from.style,
      baseOpacity: blendNumber(from.style.baseOpacity, 0, t) ?? 0,
    },
    viewHighlights: fadeHighlightsOut(from.viewHighlights, t),
  }),
  enterFn: (to) => ({ t }) => ({
    ...to,
    style: {
      ...to.style,
      baseOpacity: blendNumber(0, to.style.baseOpacity, t) ?? to.style.baseOpacity,
    },
    viewHighlights: fadeHighlightsIn(to.viewHighlights, t),
  }),
  interpolateFn: (from, to) => ({ t }) => ({
    layoutId: t < 0.5 ? from.layoutId : to.layoutId,
    activeIndex: blendNumber(from.activeIndex, to.activeIndex, t) ?? to.activeIndex,
    childCount: t < 0.5 ? from.childCount : to.childCount,
    loop: t < 0.5 ? from.loop : to.loop,
    style: blendStyle(from.style, to.style, t),
    showBase: t < 0.5 ? from.showBase : to.showBase,
    trayDepth: blendNumber(from.trayDepth, to.trayDepth, t) ?? to.trayDepth,
    gap: blendNumber(from.gap, to.gap, t) ?? to.gap,
    nvsBounds: {
      x: blendNumber(from.nvsBounds.x, to.nvsBounds.x, t) ?? to.nvsBounds.x,
      y: blendNumber(from.nvsBounds.y, to.nvsBounds.y, t) ?? to.nvsBounds.y,
      w: blendNumber(from.nvsBounds.w, to.nvsBounds.w, t) ?? to.nvsBounds.w,
      h: blendNumber(from.nvsBounds.h, to.nvsBounds.h, t) ?? to.nvsBounds.h,
    },
    viewExtent: {
      x: blendNumber(from.viewExtent.x, to.viewExtent.x, t) ?? to.viewExtent.x,
      y: blendNumber(from.viewExtent.y, to.viewExtent.y, t) ?? to.viewExtent.y,
      w: blendNumber(from.viewExtent.w, to.viewExtent.w, t) ?? to.viewExtent.w,
      h: blendNumber(from.viewExtent.h, to.viewExtent.h, t) ?? to.viewExtent.h,
    },
    outerMargin: blendNumber(from.outerMargin, to.outerMargin, t) ?? to.outerMargin,
    zStep: blendNumber(from.zStep, to.zStep, t) ?? to.zStep,
    spread: blendNumber(from.spread, to.spread, t) ?? to.spread,
    viewHighlights: crossFadeHighlights(from.viewHighlights, to.viewHighlights, t),
  }),
};
