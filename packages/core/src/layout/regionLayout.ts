// Layout policy resolution for ViewLayout — pure math, no Three.js, no React.

import type { NVSRect } from './types';
import type {
  ViewLayoutConfig,
  ViewLayoutResult,
  StackLayoutConfig,
  CarouselLayoutConfig,
} from './regionTypes';

/**
 * Dispatches to resolveStackLayout or resolveCarouselLayout based on config.kind.
 *
 * @param config - Layout policy configuration.
 * @param containerBounds - The NVS bounds of the container holding all views.
 * @param childSizeHints - Authored w/h for each child. Use w=0 or h=0 to indicate
 *   "no explicit size" — those children will receive equal distribution of remaining space.
 * @returns One ViewLayoutResult per child, in the same order as childSizeHints.
 */
export function resolveLayout(
  config: ViewLayoutConfig,
  containerBounds: NVSRect,
  childSizeHints: ReadonlyArray<{ w: number; h: number }>,
): ReadonlyArray<ViewLayoutResult> {
  if (config.kind === 'stack') {
    return resolveStackLayout(config, containerBounds, childSizeHints);
  }
  return resolveCarouselLayout(config, containerBounds, childSizeHints);
}

/**
 * Resolves stack layout — places views sequentially along horizontal or vertical axis.
 *
 * - direction defaults to 'horizontal'.
 * - gap defaults to 0.
 * - Children with explicit w > 0 (horizontal) or h > 0 (vertical) use their authored size.
 * - Remaining space is distributed equally among children without an explicit size.
 * - All views get layer: 0 and scale: 1.0.
 */
export function resolveStackLayout(
  config: StackLayoutConfig,
  containerBounds: NVSRect,
  childSizeHints: ReadonlyArray<{ w: number; h: number }>,
): ReadonlyArray<ViewLayoutResult> {
  const N = childSizeHints.length;
  if (N === 0) return [];

  const direction = config.direction ?? 'horizontal';
  const gap = config.gap ?? 0;

  if (direction === 'horizontal') {
    const totalGap = (N - 1) * gap;
    const explicitWidths = childSizeHints.map((h) => (h.w > 0 ? h.w : null));
    const explicitTotal = explicitWidths.reduce<number>(
      (sum, w) => sum + (w !== null ? w : 0),
      0,
    );
    const implicitCount = explicitWidths.filter((w) => w === null).length;
    const implicitWidth =
      implicitCount > 0
        ? Math.max(0, (containerBounds.w - totalGap - explicitTotal) / implicitCount)
        : 0;

    const results: ViewLayoutResult[] = [];
    let cursor = containerBounds.x;
    for (let i = 0; i < N; i++) {
      const w = explicitWidths[i] !== null ? (explicitWidths[i] as number) : implicitWidth;
      results.push({
        bounds: { x: cursor, y: containerBounds.y, w, h: containerBounds.h },
        layer: 0,
        scale: 1.0,
        z: 0,
        opacity: 1,
      });
      cursor += w + (i < N - 1 ? gap : 0);
    }
    return results;
  }

  // vertical
  const totalGap = (N - 1) * gap;
  const explicitHeights = childSizeHints.map((h) => (h.h > 0 ? h.h : null));
  const explicitTotal = explicitHeights.reduce<number>(
    (sum, h) => sum + (h !== null ? h : 0),
    0,
  );
  const implicitCount = explicitHeights.filter((h) => h === null).length;
  const implicitHeight =
    implicitCount > 0
      ? Math.max(0, (containerBounds.h - totalGap - explicitTotal) / implicitCount)
      : 0;

  const results: ViewLayoutResult[] = [];
  let cursor = containerBounds.y;
  for (let i = 0; i < N; i++) {
    const h = explicitHeights[i] !== null ? (explicitHeights[i] as number) : implicitHeight;
    results.push({
      bounds: { x: containerBounds.x, y: cursor, w: containerBounds.w, h },
      layer: 0,
      scale: 1.0,
      z: 0,
      opacity: 1,
    });
    cursor += h + (i < N - 1 ? gap : 0);
  }
  return results;
}

/**
 * Resolves carousel layout — one active view centered, others fanned out with scale reduction.
 *
 * Algorithm:
 * 1. Clamp activeIndex to [0, N-1].
 * 2. For each child i:
 *    - distance = |i - activeIndex|
 *    - scale = distance === 0 ? 1.0 : inactiveScale ** distance
 *    - layer = N - distance (active gets highest layer)
 * 3. Compute horizontal placement:
 *    - Active view centered within containerBounds.
 *    - offset from active center to center of view i:
 *      sign(i - activeIndex) * (effectiveW_active/2 + gap + intermediaries + effectiveW_i/2)
 *    - child.x = centerX_active + offset - effectiveW_i/2
 *    - child.y centered vertically in container.
 */
export function resolveCarouselLayout(
  config: CarouselLayoutConfig,
  containerBounds: NVSRect,
  childSizeHints: ReadonlyArray<{ w: number; h: number }>,
): ReadonlyArray<ViewLayoutResult> {
  if (config.loop) {
    return resolveLoopCarouselLayout(config, containerBounds, childSizeHints);
  }

  const N = childSizeHints.length;
  if (N === 0) return [];

  const gap = config.gap ?? 0.04;
  const inactiveScale = config.inactiveScale ?? 0.75;
  const zStep = config.zStep ?? 0;
  const clampedActive = Math.max(0, Math.min(N - 1, config.activeIndex));

  // Pre-compute scales and effective dimensions.
  const scales = childSizeHints.map((_, i) => {
    const distance = Math.abs(i - clampedActive);
    return distance === 0 ? 1.0 : Math.pow(inactiveScale, distance);
  });

  const effectiveWs = childSizeHints.map((hint, i) => hint.w * scales[i]);
  const effectiveHs = childSizeHints.map((hint, i) => hint.h * scales[i]);

  const centerX = containerBounds.x + containerBounds.w / 2;

  const results: ViewLayoutResult[] = [];
  for (let i = 0; i < N; i++) {
    const distance = Math.abs(i - clampedActive);
    const scale = scales[i];
    const effectiveW = effectiveWs[i];
    const effectiveH = effectiveHs[i];
    const layer = N - distance;

    // Compute the signed offset from the active center to this view's center.
    let offset = 0;
    if (i !== clampedActive) {
      const sign = i > clampedActive ? 1 : -1;
      const step = sign;

      // Start with half-width of active, then gap.
      offset = effectiveWs[clampedActive] / 2 + gap;

      // Add full widths of intermediate views + gaps.
      for (let k = clampedActive + step; k !== i; k += step) {
        offset += effectiveWs[k] + gap;
      }

      // Add half-width of this view.
      offset += effectiveW / 2;
      offset *= sign;
    }

    const x = centerX + offset - effectiveW / 2;
    const y = containerBounds.y + (containerBounds.h - effectiveH) / 2;

    // Z offset: active view at z=0, inactive views recede by zStep per distance.
    // Negative Z pushes views away from the camera in the default NVS coordinate space.
    const z = distance === 0 || zStep === 0 ? 0 : -distance * zStep;

    results.push({
      bounds: { x, y, w: effectiveW, h: effectiveH },
      layer,
      scale,
      z,
      opacity: 1,
    });
  }

  return results;
}

/**
 * Resolves loop carousel layout — views distributed on an elliptical ring.
 *
 * The active view sits at the front center (angle = 0). Other views are
 * evenly spaced around the ellipse. As activeIndex changes across scenes,
 * the ring rotates so the new active view moves to front-center.
 *
 * Algorithm:
 * 1. Each view i gets angle = 2π × ((i − activeIndex) / N), wrapping via modular arithmetic.
 *    Active is at angle 0 (front), opposite side is at angle π (back).
 * 2. X position follows sin(angle) — left/right spread.
 * 3. Z position follows cos(angle) — front/back depth.
 * 4. Scale interpolates between 1.0 (front) and inactiveScale (back) based on depth.
 * 5. Layer is derived from depth — front items render on top.
 *
 * @param config          Carousel config with loop=true.
 * @param containerBounds NVS bounds of the layout container.
 * @param childSizeHints  Authored w/h for each child.
 */
export function resolveLoopCarouselLayout(
  config: CarouselLayoutConfig,
  containerBounds: NVSRect,
  childSizeHints: ReadonlyArray<{ w: number; h: number }>,
): ReadonlyArray<ViewLayoutResult> {
  const N = childSizeHints.length;
  if (N === 0) return [];
  if (N === 1) {
    // Single view: centered, full scale, no depth.
    const hint = childSizeHints[0];
    return [{
      bounds: {
        x: containerBounds.x + (containerBounds.w - hint.w) / 2,
        y: containerBounds.y + (containerBounds.h - hint.h) / 2,
        w: hint.w,
        h: hint.h,
      },
      layer: 1,
      scale: 1.0,
      z: 0,
      opacity: 1,
    }];
  }

  const inactiveScale = config.inactiveScale ?? 0.75;
  const zStep = config.zStep ?? 0;
  const fadeMin = Math.max(0, Math.min(1, config.fadeMin ?? 1));
  const clampedActive = Math.max(0, Math.min(N - 1, config.activeIndex));

  const centerX = containerBounds.x + containerBounds.w / 2;
  const centerY = containerBounds.y + containerBounds.h / 2;

  // ── Adaptive horizontal radius ────────────────────────────────────────────
  // When zStep is large, perspective separation does the heavy lifting —
  // the ellipse can be narrower. When zStep is small, items need more
  // horizontal spread so they don't overlap.
  //
  // Formula: spread = maxSpread / (1 + zStep × damping)
  //   zStep= 0 → spread ≈ 0.45 (wide, items arranged in a flat ring)
  //   zStep= 2 → spread ≈ 0.36 (moderate — some depth helps)
  //   zStep=15 → spread ≈ 0.18 (narrow — perspective does the work)
  //
  // The explicit `spread` prop overrides the auto-computation.
  const MAX_SPREAD = 0.45;
  const DAMPING = 0.08;
  const autoSpread = MAX_SPREAD / (1 + zStep * DAMPING);
  const spread = config.spread ?? autoSpread;
  const radiusX = containerBounds.w * spread;

  // Z radius (depth): front-to-back distance = zStep.
  // cos goes from +1 (front) to -1 (back), so full range is 2 × radiusZ.
  // We want front=0, back=-zStep, so radiusZ = zStep / 2.

  const TWO_PI = 2 * Math.PI;

  const results: ViewLayoutResult[] = [];
  for (let i = 0; i < N; i++) {
    // Angle: 0 for active (front), evenly distributed around the ring.
    // Positive angle = clockwise when viewed from above.
    const angle = TWO_PI * ((i - clampedActive + N) % N) / N;

    // Depth factor: 1 at front (cos=1), 0 at back (cos=-1).
    // Quantize to 3 decimal places so symmetric angles (e.g. cos(2π/3) vs
    // cos(4π/3), which differ by ~1e-16 in IEEE 754) produce identical
    // scale, opacity, layer, and Z for items at the same ring distance.
    const rawDepth = (1 + Math.cos(angle)) / 2;
    const depthFactor = Math.round(rawDepth * 1000) / 1000;

    // Scale: lerp between inactiveScale (back) and 1.0 (front).
    const scale = inactiveScale + (1 - inactiveScale) * depthFactor;

    const effectiveW = childSizeHints[i].w * scale;
    const effectiveH = childSizeHints[i].h * scale;

    // X: horizontal position on the ellipse. sin(angle) is NOT quantized —
    // left/right positions should remain distinct (no symmetry requirement on X).
    const x = centerX + radiusX * Math.sin(angle) - effectiveW / 2;

    // Y: vertically centered.
    const y = centerY - effectiveH / 2;

    // Z: front at 0, back at -zStep.
    const z = depthFactor === 1 || zStep === 0 ? 0 : -zStep * (1 - depthFactor);

    // Layer: front items get highest layer.
    const layer = Math.round(1 + depthFactor * (N - 1));

    // Opacity: power-curve fade from 1.0 (front) to fadeMin (back).
    // depthFactor² drops steeply off the front then flattens — the active
    // item reads as clearly dominant while background items settle near fadeMin.
    // When fadeMin=1 (default), all views are fully opaque.
    const fadeCurve = depthFactor * depthFactor; // quadratic ease-out
    const opacity = depthFactor === 1 ? 1 : fadeMin + (1 - fadeMin) * fadeCurve;

    results.push({
      bounds: { x, y, w: effectiveW, h: effectiveH },
      layer,
      scale,
      z,
      opacity,
    });
  }

  return results;
}
