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
import type { IChartRenderer, ChartHitInfo } from '../../renderers/shared/IChartRenderer';
import type { ChartDataStore } from '../../data/ChartDataStore';
import type { ChartState, ChartType } from './types';
import type { ChartTheme, ChartThemeName } from '../../themes/types';

const THEME_MAP: Record<ChartThemeName, ChartTheme> = {
  darkGlass: darkGlassChartTheme,
  neonCyber: neonCyberChartTheme,
  enterprise: enterpriseChartTheme,
  lightMinimal: lightMinimalChartTheme,
};

/**
 * Manages the Three.js scene subtree for a single chart widget.
 * Delegates rendering to the appropriate IChartRenderer for the active chart type.
 */
export class ChartRenderer {
  private readonly chartGroup = new THREE.Group();
  private readonly seriesGroup = new THREE.Group();
  private readonly axesGroup = new THREE.Group();
  private readonly legendGroup = new THREE.Group();
  private activeRenderer: IChartRenderer | null = null;
  private lastType: ChartType | null = null;

  constructor(private readonly store: ChartDataStore) {
    this.chartGroup.add(this.seriesGroup, this.axesGroup, this.legendGroup);
  }

  mount(scene: THREE.Scene): void {
    scene.add(this.chartGroup);
  }

  update(state: ChartState, _widgetId: string): void {
    // Position and rotation
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

    // Resolve data from store
    const data = this.store.resolve(state.dataSource, state.transforms);

    const theme = THEME_MAP[state.theme] ?? darkGlassChartTheme;

    this.activeRenderer.update({
      seriesGroup: this.seriesGroup,
      axesGroup: this.axesGroup,
      legendGroup: this.legendGroup,
      data,
      xAxis: state.xAxis,
      yAxis: state.yAxis,
      series: state.series,
      bounds: state.bounds,
      theme,
      opacity: state.opacity,
    });

    // Update legend group visibility/position based on state
    if (state.legend) {
      this.legendGroup.visible = state.legend.visible;
      this.positionLegend(state.legend.position, state.bounds);
    } else {
      this.legendGroup.visible = false;
    }
  }

  getInteractiveObjects(): THREE.Object3D[] {
    return this.activeRenderer?.getInteractiveObjects() ?? [];
  }

  resolveHoverInfo(intersection: THREE.Intersection): ChartHitInfo | null {
    if (!this.activeRenderer || !this.lastType) return null;
    const data = { rows: [], fields: [] };
    return this.activeRenderer.resolveHoverInfo(intersection, data);
  }

  dispose(scene: THREE.Scene): void {
    this.activeRenderer?.dispose();
    this.activeRenderer = null;
    this.clearGroups();
    scene.remove(this.chartGroup);
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
  ): void {
    switch (position) {
      case 'right':  this.legendGroup.position.set(bounds.width + 0.3, bounds.height / 2, 0); break;
      case 'left':   this.legendGroup.position.set(-0.5, bounds.height / 2, 0); break;
      case 'top':    this.legendGroup.position.set(bounds.width / 2, bounds.height + 0.3, 0); break;
      case 'bottom': this.legendGroup.position.set(bounds.width / 2, -0.5, 0); break;
    }
  }
}
