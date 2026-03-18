// Region type contracts for spatial composition.
// No runtime, no Three.js, no React.

import type { NVSRect } from './types';

/**
 * RegionBounds is NVSRect — not a parallel concept.
 * All region math operates on NVSRect directly.
 */
export type RegionBounds = NVSRect;

/**
 * Padding specification for a region.
 * Can be a single uniform value, a [vertical, horizontal] pair,
 * or a full [top, right, bottom, left] tuple.
 *
 * All values are NVS fractions [0..1] relative to the parent region.
 */
export type RegionPadding =
  | number
  | readonly [number, number]
  | readonly [number, number, number, number];

/**
 * Normalized padding — always a 4-tuple [top, right, bottom, left].
 * All values are NVS fractions.
 */
export type NormalizedPadding = readonly [number, number, number, number];

/**
 * Static contract for a region's spatial configuration.
 * Used by the compiler to resolve a region's effective bounds.
 */
export type RegionContract = {
  /** The NVS bounds of this region within its parent (or viewport if root). */
  readonly bounds: NVSRect;
  /** Padding inset from bounds edges. */
  readonly padding: RegionPadding;
};

/**
 * A fully resolved region with computed content area.
 * Produced by resolveRegion() from a RegionContract.
 */
export type ResolvedRegion = {
  /** Outer bounds (same as input RegionContract.bounds). */
  readonly outerBounds: NVSRect;
  /** Inner content bounds after padding is applied. */
  readonly contentBounds: NVSRect;
  /** Resolved padding [top, right, bottom, left]. */
  readonly padding: NormalizedPadding;
  /**
   * Z-order layer for overlapping views. Default: 0.
   * Higher values render in front of lower values.
   * Set by layout managers (e.g., carousel active = highest layer).
   */
  readonly layer: number;
};

/**
 * Layout policy discriminator for ViewLayout.
 */
export type ViewLayoutKind = 'stack' | 'carousel';

/**
 * Configuration for the 'stack' layout policy.
 */
export type StackLayoutConfig = {
  readonly kind: 'stack';
  /** Direction of stacking. Default: 'horizontal'. */
  readonly direction?: 'horizontal' | 'vertical';
  /** NVS gap between views. Default: 0. */
  readonly gap?: number;
};

/**
 * Configuration for the 'carousel' layout policy.
 */
export type CarouselLayoutConfig = {
  readonly kind: 'carousel';
  /**
   * Internal active index. Maps to the DSL's `focusedIndex` (or deprecated `activeIndex`).
   * The DSL-to-internal mapping happens in viewLayoutHandler.
   */
  readonly activeIndex: number;
  /** NVS gap between adjacent views (linear mode only). Default: 0.04. */
  readonly gap?: number;
  /** Scale factor for inactive views. Default: 0.75. */
  readonly inactiveScale?: number;
  /** World-space Z depth. Linear: per-position step. Loop: total front-to-back depth. Default: 0. */
  readonly zStep?: number;
  /**
   * When true, views are arranged on an elliptical ring that wraps around.
   * The active view sits at the front center; others distribute evenly around
   * the ellipse. `gap` is ignored in loop mode — use container width and
   * child count to control horizontal spread.
   *
   * Default: false (linear fan).
   */
  readonly loop?: boolean;
  /**
   * Horizontal spread of the loop ellipse as a fraction of container width [0..1].
   * Higher values = wider carousel. When omitted, automatically computed from
   * zStep: shallow depth → wider spread, deep → narrower (items separate via
   * perspective instead of horizontal offset).
   *
   * Only used when loop=true. Ignored in linear mode.
   */
  readonly spread?: number;
  /**
   * Minimum opacity for the farthest-back views on the loop carousel [0..1].
   * 1.0 = no fade (default). 0 = fully transparent at the back.
   * Intermediate views interpolate linearly between 1.0 (front) and fadeMin (back).
   *
   * Only used when loop=true. Ignored in linear mode.
   */
  readonly fadeMin?: number;
};

/**
 * Union of all layout policy configurations.
 */
export type ViewLayoutConfig = StackLayoutConfig | CarouselLayoutConfig;

/**
 * Result of layout resolution for a single view within a ViewLayout.
 */
export type ViewLayoutResult = {
  /** Resolved NVS bounds for this view. */
  readonly bounds: NVSRect;
  /** Layer (z-order) for this view. Higher = front. */
  readonly layer: number;
  /** Scale factor applied to this view (1.0 = full size). */
  readonly scale: number;
  /** World-space Z offset applied by the layout. 0 = no offset (default). */
  readonly z: number;
  /** Opacity [0..1]. 1.0 = fully opaque (default). Applied by fade in loop carousel. */
  readonly opacity: number;
};
