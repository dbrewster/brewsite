// Three.js render layer for chart elements — delegates to per-type IChartRenderer.

import * as THREE from 'three';
import { darkGlassChartTheme } from '../../themes/darkGlass';
import { neonCyberChartTheme } from '../../themes/neonCyber';
import { enterpriseChartTheme } from '../../themes/enterprise';
import { lightMinimalChartTheme } from '../../themes/lightMinimal';
import { BarRenderer } from '../../renderers/bar/BarRenderer';
import { LineRenderer } from '../../renderers/line/LineRenderer';
import { AreaRenderer } from '../../renderers/area/AreaRenderer';
import { PieRenderer } from '../../renderers/pie/PieRenderer';
import { ScatterRenderer } from '../../renderers/scatter/ScatterRenderer';
import { HeatmapRenderer } from '../../renderers/heatmap/HeatmapRenderer';
import type { IChartRenderer, ChartHitInfo, MorphContext } from '../../renderers/shared/IChartRenderer';
import type { ChartDataStore } from '../../data/ChartDataStore';
import type { ResolvedDataFrame } from '../../data/types';
import type { ChartState, ChartType, ChartStateDataSource, ChartRenderInput } from './types';
import type { ChartTheme, ChartThemeName } from '../../themes/types';
import { computeChartLayout } from './layout';
import type { ChartLayout } from './layout';

// ChartRenderInput is now defined in ./types and imported above.
// It was moved there in V2.1 so ChartWidget.ts and render.ts share a single source.

const THEME_MAP: Record<ChartThemeName, ChartTheme> = {
  darkGlass: darkGlassChartTheme,
  neonCyber: neonCyberChartTheme,
  enterprise: enterpriseChartTheme,
  lightMinimal: lightMinimalChartTheme,
};

/**
 * Manages the Three.js scene subtree for a single chart widget.
 * Delegates rendering to the appropriate IChartRenderer for the active chart type.
 *
 * Sole construction site for MorphContext — ChartWidget.apply() does NOT build it.
 * lastFromData stores the previous frame's resolved data for datum-level morphing.
 */
export class ChartRenderer {
  private readonly chartGroup = new THREE.Group();
  private readonly seriesGroup = new THREE.Group();
  private readonly axesGroup = new THREE.Group();
  private readonly legendGroup = new THREE.Group();
  private activeRenderer: IChartRenderer | null = null;
  private lastType: ChartType | null = null;
  private lastData: ResolvedDataFrame = { rows: [], fields: [] };
  /** Previous frame's resolved data — used to build MorphContext for datum morphing. */
  private lastFromData: ResolvedDataFrame | null = null;
  /** Cached layout from last update() call — reused by updateHeatmapSlice(). */
  private lastLayout: ChartLayout | null = null;

  constructor(private readonly store: ChartDataStore) {
    this.chartGroup.add(this.seriesGroup, this.axesGroup, this.legendGroup);
  }

  mount(scene: THREE.Scene): void {
    scene.add(this.chartGroup);
  }

  update(state: ChartRenderInput, widgetId: string): void {
    // Position and rotation (position is in world-space, pre-converted by ChartWidget)
    this.chartGroup.position.set(...state.position as [number, number, number]);
    this.chartGroup.rotation.set(...state.rotation as [number, number, number]);

    // Switch renderer if type changed
    if (state.type !== this.lastType) {
      this.activeRenderer?.dispose();
      this.clearGroups();
      this.activeRenderer = this.createRenderer(state.type);
      this.lastType = state.type;
    }

    if (!this.activeRenderer) return;

    // Resolve data from store via discriminated source type
    const data = this.resolveData(state.dataSource, state.transforms, widgetId);
    if (data.rows.length === 0) {
      const name = this.resolveSourceName(state.dataSource, widgetId);
      if (name.length > 0) {
        console.warn(`[ChartRenderer] No data for source "${name}" in widget "${widgetId}" — chart will be empty`);
      }
    }

    // Build MorphContext — sole construction site (Q3 resolution).
    // lastFromData holds the PREVIOUS frame's resolved data. During a transition,
    // the first frame where _morphT is set correctly morphs from-scene to to-scene.
    let morphCtx: MorphContext | undefined;
    if (state._morphT !== undefined && state.dataSource.keyField && this.lastFromData) {
      morphCtx = {
        fromData: this.lastFromData,
        // toData intentionally absent — renderers use ctx.data for the to-state (Challenge 11)
        t: state._morphT,
        keyField: state.dataSource.keyField,
      };
    }
    // Update lastFromData AFTER building morphCtx so next frame can use this frame's data
    this.lastFromData = data;
    this.lastData = data;

    const effectiveTheme: ChartTheme =
      typeof state.theme === 'string'
        ? (THEME_MAP[state.theme as ChartThemeName] ?? darkGlassChartTheme)
        : state.theme;

    // Resolve sceneTheme: state.sceneTheme (DSL prop) takes precedence over theme.sceneTheme
    const resolvedSceneTheme = state.sceneTheme ?? effectiveTheme.sceneTheme;

    // Derive font URL from sceneTheme
    const fontUrl = resolvedSceneTheme?.font.webglFontUrl;

    const layout = computeChartLayout({
      bounds: state.bounds,
      typeConfig: state.typeConfig,
      theme: effectiveTheme,
      xAxis: state.xAxis,
      yAxis: state.yAxis,
      series: state.series,
      legend: state.legend,
    });
    this.lastLayout = layout;

    this.seriesGroup.position.set(layout.plotFrame.x, layout.plotFrame.y, 0);
    this.axesGroup.position.set(layout.plotFrame.x, layout.plotFrame.y, 0);
    this.legendGroup.position.set(0, 0, 0);

    this.activeRenderer.update({
      seriesGroup: this.seriesGroup,
      axesGroup: this.axesGroup,
      legendGroup: this.legendGroup,
      chartPosition: state.position,
      data,
      xAxis: state.xAxis,
      yAxis: state.yAxis,
      series: state.series,
      referenceLines: state.referenceLines,
      legend: state.legend,
      bounds: {
        width: layout.plotFrame.width,
        height: layout.plotFrame.height,
        depth: state.bounds.depth,
      },
      theme: effectiveTheme,
      opacity: state.opacity,
      typeOptions: state.typeConfig,
      dataLabels: state.dataLabels ?? null,
      gridlines: state.gridlines ?? null,
      fontUrl,
      morphCtx,
      entryT: state.entryT,             // V2.1 — pass through from ChartWidget.apply()
      accessors: state.accessors,        // V2.1 — pass through from ChartWidget.apply()
      fittedMargins: layout.fittedMargins, // V2.1 — for axis title positioning in AxesRenderer
    });

    // Update legend group visibility/position based on state
    if (state.legend) {
      this.legendGroup.visible = state.legend.visible;
      if (layout.legendAnchor) {
        this.positionLegend(state.legend.position, state.bounds, layout.legendAnchor);
      }
    } else {
      this.legendGroup.visible = false;
    }
  }

  /**
   * Updates a heatmap chart to display a specific time slice.
   * Called by ChartWidget.onTick() for scroll-driven heatmap animation.
   * Skips layout recomputation — uses the layout cached from the last update() call.
   */
  updateHeatmapSlice(sliceIndex: number, state: ChartRenderInput, widgetId: string): void {
    if (!this.activeRenderer || state.typeConfig.kind !== 'heatmap') return;
    const opts = state.typeConfig.options;
    if (!opts.timeField || !this.lastLayout) return;

    const sourceName = this.resolveSourceName(state.dataSource, widgetId);
    const data = this.store.getTimeSlice(sourceName, opts.timeField, sliceIndex);

    const effectiveTheme: ChartTheme =
      typeof state.theme === 'string'
        ? (THEME_MAP[state.theme as ChartThemeName] ?? darkGlassChartTheme)
        : state.theme;

    const resolvedSceneTheme = state.sceneTheme ?? effectiveTheme.sceneTheme;
    const fontUrl = resolvedSceneTheme?.font.webglFontUrl;

    const layout = this.lastLayout;

    this.activeRenderer.update({
      seriesGroup: this.seriesGroup,
      axesGroup: this.axesGroup,
      legendGroup: this.legendGroup,
      chartPosition: state.position,
      data,
      xAxis: state.xAxis,
      yAxis: state.yAxis,
      series: state.series,
      referenceLines: state.referenceLines,
      legend: state.legend,
      bounds: {
        width: layout.plotFrame.width,
        height: layout.plotFrame.height,
        depth: state.bounds.depth,
      },
      theme: effectiveTheme,
      opacity: state.opacity,
      typeOptions: state.typeConfig,
      dataLabels: state.dataLabels ?? null,
      gridlines: state.gridlines ?? null,
      fontUrl,
    });
  }

  getInteractiveObjects(): THREE.Object3D[] {
    return this.activeRenderer?.getInteractiveObjects() ?? [];
  }

  resolveHoverInfo(intersection: THREE.Intersection): ChartHitInfo | null {
    if (!this.activeRenderer || !this.lastType) return null;
    return this.activeRenderer.resolveHoverInfo(intersection, this.lastData);
  }

  dispose(scene: THREE.Scene): void {
    this.activeRenderer?.dispose();
    this.activeRenderer = null;
    this.clearGroups();
    scene.remove(this.chartGroup);
  }

  /**
   * Resolves a ChartStateDataSource to the store key name used for data lookup.
   * - inline sources register under `__inline__${widgetId}`
   * - named sources use the configured name directly
   * - async sources register under `__async__${widgetId}` once loaded
   */
  private resolveSourceName(dataSource: ChartStateDataSource, widgetId: string): string {
    switch (dataSource.type) {
      case 'inline': return `__inline__${widgetId}`;
      case 'named':  return dataSource.name;
      case 'async':  return `__async__${widgetId}`;
    }
  }

  /**
   * Resolves data for the given source, applying transforms.
   * Routes to the correct store key based on the source discriminant.
   */
  private resolveData(
    dataSource: ChartStateDataSource,
    transforms: readonly import('../../data/types').DataTransform[],
    widgetId: string,
  ): ResolvedDataFrame {
    const name = this.resolveSourceName(dataSource, widgetId);
    return this.store.resolve(name, transforms);
  }

  private createRenderer(type: ChartType): IChartRenderer {
    switch (type) {
      case 'bar':     return new BarRenderer();
      case 'line':    return new LineRenderer();
      case 'area':    return new AreaRenderer();
      case 'pie':     return new PieRenderer();
      case 'scatter': return new ScatterRenderer();
      case 'heatmap': return new HeatmapRenderer();
      default: {
        const _exhaustive: never = type;
        console.warn(`[ChartRenderer] Unknown chart type: ${String(_exhaustive)}`);
        return new BarRenderer();
      }
    }
  }

  private clearGroups(): void {
    for (const group of [this.seriesGroup, this.axesGroup, this.legendGroup]) {
      while (group.children.length > 0) {
        group.remove(group.children[0]!);
      }
    }
  }

  private positionLegend(
    position: string,
    bounds: { width: number; height: number; depth: number },
    anchor: { x: number; y: number },
  ): void {
    switch (position) {
      case 'right':
      case 'left':
        this.legendGroup.position.set(anchor.x, anchor.y, 0);
        break;
      case 'top':
        this.legendGroup.position.set(anchor.x, Math.min(anchor.y, bounds.height - 0.02), 0);
        break;
      case 'bottom':
        this.legendGroup.position.set(anchor.x, Math.max(anchor.y, 0.02), 0);
        break;
    }
  }
}
