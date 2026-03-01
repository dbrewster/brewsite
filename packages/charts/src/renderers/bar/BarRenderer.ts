// Bar chart renderer — grouped or stacked bars using BoxGeometry + d3-scale.

import * as THREE from 'three';
import { scaleBand, scaleLinear } from 'd3-scale';
import { max } from 'd3-array';
import { AxesRenderer } from '../shared/AxesRenderer';
import { LegendRenderer } from '../shared/LegendRenderer';
import { ChartMaterialFactory } from '../shared/ChartMaterialFactory';
import type { IChartRenderer, ChartRenderContext, ChartHitInfo } from '../shared/IChartRenderer';
import type { ResolvedDataFrame } from '../../data/types';

type BarHitEntry = {
  seriesIndex: number;
  datumIndex: number;
  row: Record<string, unknown>;
};

/**
 * Renders grouped or stacked bar charts.
 * Rebuilds bar geometry when data changes; otherwise updates material opacity in-place.
 */
export class BarRenderer implements IChartRenderer {
  private readonly materialFactory = new ChartMaterialFactory();
  private axesRenderer: AxesRenderer | null = null;
  private legendRenderer: LegendRenderer | null = null;
  private readonly barMeshes: THREE.Mesh[] = [];
  private readonly hitMap = new Map<THREE.Mesh, BarHitEntry>();
  private lastDataLength = -1;
  private lastSeriesCount = -1;

  update(ctx: ChartRenderContext): void {
    const { seriesGroup, axesGroup, legendGroup, data, xAxis, yAxis, series, bounds, theme, opacity } = ctx;

    const effectiveSeries: Array<{ field: string; label?: string; color?: string }> = series.length > 0
      ? [...series]
      : (yAxis ? [{ field: yAxis.field, label: yAxis.label }] : []);

    if (effectiveSeries.length === 0 || data.rows.length === 0) {
      this.clearBars(seriesGroup);
      return;
    }

    const xField = xAxis?.field ?? data.fields[0] ?? 'x';
    const needsRebuild =
      data.rows.length !== this.lastDataLength ||
      effectiveSeries.length !== this.lastSeriesCount;

    if (needsRebuild) {
      this.clearBars(seriesGroup);
      this.buildBars(seriesGroup, data, xField, effectiveSeries, bounds, theme, opacity);
      this.lastDataLength = data.rows.length;
      this.lastSeriesCount = effectiveSeries.length;
    } else {
      // Incremental update — only opacity
      for (const mesh of this.barMeshes) {
        const mat = mesh.material as THREE.MeshPhysicalMaterial;
        mat.opacity = opacity;
        mat.transparent = opacity < 1;
      }
    }

    // Axes
    if (!this.axesRenderer) {
      this.axesRenderer = new AxesRenderer(axesGroup);
    }
    const categories = data.rows.map((r) => String(r[xField]));
    const xBand = scaleBand().domain(categories).range([0, bounds.width]).padding(0.2);
    const xTicks = categories.map((cat, i) => ({
      value: cat,
      position: ((xBand(cat) ?? 0) + xBand.bandwidth() / 2) / bounds.width,
    }));
    const maxY = max(data.rows.flatMap((r) =>
      effectiveSeries.map((s) => Number(r[s.field]) || 0),
    )) ?? 1;
    const yScale = scaleLinear().domain([0, maxY * 1.1]).range([0, bounds.height]);
    const yTickCount = 5;
    const yTicks = Array.from({ length: yTickCount + 1 }, (_, i) => ({
      value: Math.round((maxY * 1.1 * i) / yTickCount),
      position: i / yTickCount,
    }));
    this.axesRenderer.update({ xTicks, yTicks, bounds, theme, opacity, xAxis, yAxis });

    // Legend
    if (!this.legendRenderer) this.legendRenderer = new LegendRenderer(legendGroup);
    this.legendRenderer.update(effectiveSeries, theme, opacity);
  }

  private buildBars(
    seriesGroup: THREE.Group,
    data: ResolvedDataFrame,
    xField: string,
    series: Array<{ field: string; label?: string; color?: string }>,
    bounds: { width: number; height: number; depth: number },
    theme: { series: ReadonlyArray<{ color: string; metalness: number; roughness: number; transmission: number; emissiveIntensity: number; depth: number }> },
    opacity: number,
  ): void {
    const categories = data.rows.map((r) => String(r[xField]));
    const maxY = max(data.rows.flatMap((r) =>
      series.map((s) => Number(r[s.field]) || 0),
    )) ?? 1;

    const xBand = scaleBand().domain(categories).range([0, bounds.width]).padding(0.2);
    const innerBand = scaleBand().domain(series.map((_, i) => String(i))).range([0, xBand.bandwidth()]).padding(0.05);
    const yScale = scaleLinear().domain([0, maxY * 1.1]).range([0, bounds.height]);

    for (let si = 0; si < series.length; si++) {
      const s = series[si]!;
      const mat = this.materialFactory.getSeriesMaterial(theme as Parameters<typeof this.materialFactory.getSeriesMaterial>[0], si);
      mat.opacity = opacity;
      mat.transparent = opacity < 1;

      for (let di = 0; di < data.rows.length; di++) {
        const row = data.rows[di]!;
        const catStr = String(row[xField]);
        const xPos = (xBand(catStr) ?? 0) + (innerBand(String(si)) ?? 0);
        const value = Number(row[s.field]) || 0;
        const barH = yScale(value);
        if (barH <= 0) continue;

        const tokens = theme.series[si % theme.series.length]!;
        const geo = new THREE.BoxGeometry(innerBand.bandwidth(), barH, tokens.depth);
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(xPos + innerBand.bandwidth() / 2, barH / 2, 0);
        seriesGroup.add(mesh);
        this.barMeshes.push(mesh);
        this.hitMap.set(mesh, { seriesIndex: si, datumIndex: di, row: row as Record<string, unknown> });
      }
    }
  }

  private clearBars(seriesGroup: THREE.Group): void {
    for (const mesh of this.barMeshes) {
      seriesGroup.remove(mesh);
      mesh.geometry.dispose();
    }
    this.barMeshes.length = 0;
    this.hitMap.clear();
  }

  getInteractiveObjects(): THREE.Object3D[] {
    return this.barMeshes;
  }

  resolveHoverInfo(intersection: THREE.Intersection, _data: ResolvedDataFrame): ChartHitInfo | null {
    const mesh = intersection.object as THREE.Mesh;
    const entry = this.hitMap.get(mesh);
    if (!entry) return null;
    const p = intersection.point;
    return {
      seriesIndex: entry.seriesIndex,
      datumIndex: entry.datumIndex,
      row: entry.row,
      point: [p.x, p.y, p.z],
    };
  }

  dispose(): void {
    this.clearBars({ children: [] } as unknown as THREE.Group);
    this.axesRenderer?.dispose();
    this.legendRenderer?.dispose();
    this.materialFactory.dispose();
    this.axesRenderer = null;
    this.legendRenderer = null;
  }
}
