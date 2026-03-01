// IChartRenderer — interface every chart-type renderer implements.

import type * as THREE from 'three';
import type { ResolvedDataFrame } from '../../data/types';
import type { ChartTheme } from '../../themes/types';

/** Hit info returned by hover/click raycasting. */
export type ChartHitInfo = {
  readonly seriesIndex: number;
  readonly datumIndex: number;
  readonly row: Record<string, unknown>;
  readonly point: readonly [number, number, number];
};

/** Axis state — pre-computed scale domain/range for one axis. */
export type ChartAxisState = {
  readonly axis: 'x' | 'y';
  readonly field: string;
  readonly label?: string;
  readonly format?: string;
  readonly domain?: readonly [number | string, number | string];
};

/** State for one data series within a chart. */
export type ChartSeriesState = {
  readonly field: string;
  readonly label?: string;
  readonly color?: string;
};

/** Render context passed to every IChartRenderer.update() call. */
export type ChartRenderContext = {
  readonly seriesGroup: THREE.Group;
  readonly axesGroup: THREE.Group;
  readonly legendGroup: THREE.Group;
  readonly data: ResolvedDataFrame;
  readonly xAxis: ChartAxisState | null;
  readonly yAxis: ChartAxisState | null;
  readonly series: readonly ChartSeriesState[];
  readonly bounds: { readonly width: number; readonly height: number; readonly depth: number };
  readonly theme: ChartTheme;
  readonly opacity: number;
};

/**
 * Interface every chart-type renderer (Bar, Line, Area, Pie, Scatter, Heatmap) implements.
 *
 * Lifecycle:
 * 1. `update(ctx)` — called each frame with current compiled state and resolved data.
 * 2. `getInteractiveObjects()` — called once per frame for raycasting.
 * 3. `resolveHoverInfo(intersection, data)` — called when a ray hit is detected.
 * 4. `dispose()` — called when the widget is destroyed or chart type changes.
 */
export interface IChartRenderer {
  /** Update (or initially create) all Three.js geometry for the current data/state. */
  update(ctx: ChartRenderContext): void;
  /** Release all Three.js resources owned by this renderer. */
  dispose(): void;
  /** Returns Three.js objects eligible for interactive raycasting. */
  getInteractiveObjects(): THREE.Object3D[];
  /** Resolves a raycaster intersection to a ChartHitInfo, or null if not applicable. */
  resolveHoverInfo(intersection: THREE.Intersection, data: ResolvedDataFrame): ChartHitInfo | null;
}
