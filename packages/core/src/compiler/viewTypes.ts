// Compiler state contracts for View and ViewLayout DSL nodes.
// No Three.js, no React, no runtime.

import type { NVSRect } from '../layout/types';
import type { ViewLayoutKind, NormalizedPadding, ViewLayoutConfig } from '../layout/regionTypes';

/**
 * Compiled state for a single View, stored on SceneFrame.widgets
 * keyed by the view's id.
 */
export type ViewState = {
  /** The view's stable identity. */
  readonly id: string;
  /** Resolved absolute NVS bounds for this view. */
  readonly bounds: NVSRect;
  /** Padding applied to this view's bounds. */
  readonly padding: NormalizedPadding;
  /** Content bounds (bounds after padding). */
  readonly contentBounds: NVSRect;
  /** Z-order layer. 0 = default. */
  readonly layer: number;
  /** Scale factor applied by layout manager. 1.0 when standalone. */
  readonly scale: number;
  /** World-space Z offset from layout. 0 when standalone. */
  readonly z: number;
  /** Opacity [0..1] from layout fade. 1.0 when standalone or no fade. */
  readonly opacity: number;
  /** ID of the parent ViewLayout, if any. */
  readonly layoutId?: string;
  /** Widget IDs compiled within this View's scoped child context. */
  readonly childWidgetIds: readonly string[];
};

/**
 * Compiled state for a ViewLayout, stored on SceneFrame.widgets
 * keyed by the layout's id.
 */
export type ViewLayoutState = {
  readonly id: string;
  readonly kind: ViewLayoutKind;
  /** Absolute NVS bounds of the layout container. */
  readonly bounds: NVSRect;
  /** Ordered list of child view IDs. */
  readonly viewIds: readonly string[];
  /**
   * Full layout configuration. Only populated for carousel kind.
   * Used by the carousel scrubbing runtime to drive active-index interpolation.
   */
  readonly layoutConfig?: ViewLayoutConfig;
  /**
   * Per-child size hints (w, h in NVS units). Only populated for carousel kind.
   * Used by the carousel scrubbing runtime to compute slide metrics.
   */
  readonly childSizeHints?: ReadonlyArray<{ readonly w: number; readonly h: number }>;
};
