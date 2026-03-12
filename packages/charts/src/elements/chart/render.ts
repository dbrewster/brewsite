// Three.js render layer for chart elements — delegates to per-type IChartRenderer.

import * as THREE from 'three';
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
import type { ChartTheme } from '../../themes/types';
import { resolveChartTheme } from '../../themes/resolveTheme';
import { computeChartLayout } from './layout';
import type { ChartLayout } from './layout';
import { ChartProjectionRenderer, DEFAULT_PROJECTION_TOKENS } from './projection/ChartProjectionRenderer';

// ChartRenderInput is now defined in ./types and imported above.
// It was moved there in V2.1 so ChartWidget.ts and render.ts share a single source.

/**
 * Manages the Three.js scene subtree for a single chart widget.
 * Delegates rendering to the appropriate IChartRenderer for the active chart type.
 *
 * Sole construction site for MorphContext — ChartWidget.apply() does NOT build it.
 * The morph "from" dataset is pinned for the full transition block.
 */
export class ChartRenderer {
  private readonly chartGroup = new THREE.Group();
  private readonly seriesGroup = new THREE.Group();
  private readonly axesGroup = new THREE.Group();
  private readonly legendGroup = new THREE.Group();
  private readonly projectionRenderer: ChartProjectionRenderer;
  private activeRenderer: IChartRenderer | null = null;
  private lastType: ChartType | null = null;
  private lastData: ResolvedDataFrame = { rows: [], fields: [] };
  /** Snapshot of pre-transition data pinned for all frames in the current morph block. */
  private pinnedMorphFromData: ResolvedDataFrame | null = null;
  /** Tracks whether the previous update was inside a morph transition block. */
  private wasMorphing = false;
  /** Cached layout from last update() call — reused by updateHeatmapSlice(). */
  private lastLayout: ChartLayout | null = null;

  constructor(private readonly store: ChartDataStore) {
    this.chartGroup.add(this.seriesGroup, this.axesGroup, this.legendGroup);
    this.projectionRenderer = new ChartProjectionRenderer(this.chartGroup);
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

    }

    // Build MorphContext — sole construction site (Q3 resolution).
    // Pin the pre-transition data once when morphing starts so every morph frame
    // uses the same fromData baseline.
    let morphCtx: MorphContext | undefined;
    const isMorphing = state._morphT !== undefined && Boolean(state.dataSource.keyField);
    if (isMorphing) {
      if (!this.wasMorphing) {
        this.pinnedMorphFromData = this.lastData;
      }
      this.wasMorphing = true;
    } else {
      this.wasMorphing = false;
      this.pinnedMorphFromData = null;
    }
    if (isMorphing && state.dataSource.keyField && this.pinnedMorphFromData) {
      morphCtx = {
        fromData: this.pinnedMorphFromData,
        // toData intentionally absent — renderers use ctx.data for the to-state (Challenge 11)
        t: state._morphT,
        keyField: state.dataSource.keyField,
      };
    }

    this.lastData = data;

    const effectiveTheme: ChartTheme = resolveChartTheme(state.theme);

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
      plotFrameOffset: { x: layout.plotFrame.x, y: layout.plotFrame.y },
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

    const effectiveTheme: ChartTheme = resolveChartTheme(state.theme);

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

  /**
   * Updates the Y-axis projection beam for a hover event.
   * Called by ChartWidget immediately on hover change.
   * Null info starts the exit animation.
   */
  updateProjection(info: ChartHitInfo | null, theme: ChartTheme): void {
    const tokens = theme.projection ?? DEFAULT_PROJECTION_TOKENS;
    this.projectionRenderer.updateProjection(info, tokens);
  }

  /**
   * Advances projection beam animation. Called every frame by ChartWidget.onTick().
   */
  tickProjection(theme: ChartTheme): void {
    const tokens = theme.projection ?? DEFAULT_PROJECTION_TOKENS;
    this.projectionRenderer.tick(tokens);
  }

  dispose(scene: THREE.Scene): void {
    this.activeRenderer?.dispose();
    this.activeRenderer = null;
    this.projectionRenderer.dispose();
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
