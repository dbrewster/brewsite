// Line chart renderer — CatmullRomCurve3 spline tubes per series.

import * as THREE from 'three';
import { scaleLinear } from 'd3-scale';
import { extent } from 'd3-array';
import { AxesRenderer } from '../shared/AxesRenderer';
import { LegendRenderer } from '../shared/LegendRenderer';
import { ChartMaterialFactory } from '../shared/ChartMaterialFactory';
import type { IChartRenderer, ChartRenderContext, ChartHitInfo } from '../shared/IChartRenderer';
import type { ResolvedDataFrame } from '../../data/types';

/**
 * Renders line charts as CatmullRom spline tubes in Three.js.
 * Multi-series lines are offset along Z.
 */
export class LineRenderer implements IChartRenderer {
  private readonly materialFactory = new ChartMaterialFactory();
  private axesRenderer: AxesRenderer | null = null;
  private legendRenderer: LegendRenderer | null = null;
  private readonly tubeMeshes: THREE.Mesh[] = [];
  private readonly seriesPoints: THREE.Vector3[][] = [];
  private seriesGroupRef: THREE.Group | null = null;
  private lastDataLength = -1;
  private lastSeriesCount = -1;

  update(ctx: ChartRenderContext): void {
    const { seriesGroup, axesGroup, legendGroup, data, xAxis, yAxis, series, bounds, theme, opacity } = ctx;

    const effectiveSeries: Array<{ field: string; label?: string; color?: string }> = series.length > 0
      ? [...series]
      : (yAxis ? [{ field: yAxis.field, label: yAxis.label }] : []);

    this.seriesGroupRef = seriesGroup;

    if (effectiveSeries.length === 0 || data.rows.length < 2) {
      this.clearTubes();
      return;
    }

    const xField = xAxis?.field ?? data.fields[0] ?? 'x';
    const needsRebuild =
      data.rows.length !== this.lastDataLength ||
      effectiveSeries.length !== this.lastSeriesCount;

    if (needsRebuild) {
      this.clearTubes();
      this.buildLines(seriesGroup, data, xField, effectiveSeries, bounds, theme, opacity);
      this.lastDataLength = data.rows.length;
      this.lastSeriesCount = effectiveSeries.length;
    } else {
      for (const mesh of this.tubeMeshes) {
        const mat = mesh.material as THREE.MeshPhysicalMaterial;
        mat.opacity = opacity;
        mat.transparent = opacity < 1;
      }
    }

    // Axes
    if (!this.axesRenderer) this.axesRenderer = new AxesRenderer(axesGroup);
    const n = data.rows.length;
    const xTicks = data.rows
      .filter((_, i) => i % Math.max(1, Math.floor(n / 6)) === 0)
      .map((r, i) => ({ value: r[xField], position: i / (n - 1) }));
    const allValues = data.rows.flatMap((r) =>
      effectiveSeries.map((s) => Number(r[s.field]) || 0),
    );
    const [yMin, yMax] = extent(allValues) as [number, number];
    const yRange = yMax - yMin || 1;
    const yTicks = Array.from({ length: 6 }, (_, i) => ({
      value: Math.round(yMin + (yRange * i) / 5),
      position: i / 5,
    }));
    this.axesRenderer.update({ xTicks, yTicks, bounds, theme, opacity, xAxis, yAxis });

    if (!this.legendRenderer) this.legendRenderer = new LegendRenderer(legendGroup);
    this.legendRenderer.update(effectiveSeries, theme, opacity);
  }

  private buildLines(
    seriesGroup: THREE.Group,
    data: ResolvedDataFrame,
    xField: string,
    series: Array<{ field: string; label?: string; color?: string }>,
    bounds: { width: number; height: number; depth: number },
    theme: ChartRenderContext['theme'],
    opacity: number,
  ): void {
    const allValues = data.rows.flatMap((r) =>
      series.map((s) => Number(r[s.field]) || 0),
    );
    const [yMin, yMax] = extent(allValues) as [number, number];
    const yScale = scaleLinear().domain([yMin, yMax]).range([0, bounds.height]);
    const xScale = scaleLinear().domain([0, data.rows.length - 1]).range([0, bounds.width]);

    for (let si = 0; si < series.length; si++) {
      const s = series[si]!;
      const zOffset = si * 0.15;
      const points = data.rows.map((r, i) => {
        const y = yScale(Number(r[s.field]) || 0);
        return new THREE.Vector3(xScale(i), y, zOffset);
      });

      this.seriesPoints.push([...points]);

      const curve = new THREE.CatmullRomCurve3(points);
      const segments = Math.max(12, points.length * 3);
      const geo = new THREE.TubeGeometry(curve, segments, 0.03, 8, false);
      const mat = this.materialFactory.getSeriesMaterial(theme, si);
      mat.opacity = opacity;
      mat.transparent = opacity < 1;
      const mesh = new THREE.Mesh(geo, mat);
      seriesGroup.add(mesh);
      this.tubeMeshes.push(mesh);
    }
  }

  private clearTubes(): void {
    const group = this.seriesGroupRef;
    for (const mesh of this.tubeMeshes) {
      group?.remove(mesh);
      mesh.geometry.dispose();
    }
    this.tubeMeshes.length = 0;
    this.seriesPoints.length = 0;
  }

  getInteractiveObjects(): THREE.Object3D[] {
    return this.tubeMeshes;
  }

  resolveHoverInfo(intersection: THREE.Intersection, data: ResolvedDataFrame): ChartHitInfo | null {
    const meshIndex = this.tubeMeshes.indexOf(intersection.object as THREE.Mesh);
    if (meshIndex < 0) return null;

    const points = this.seriesPoints[meshIndex] ?? [];
    const p = intersection.point;
    let nearest = 0;
    let nearestDist = Infinity;
    for (let i = 0; i < points.length; i++) {
      const d = p.distanceTo(points[i]!);
      if (d < nearestDist) { nearestDist = d; nearest = i; }
    }

    const row = (data.rows[nearest] ?? {}) as Record<string, unknown>;
    return {
      seriesIndex: meshIndex,
      datumIndex: nearest,
      row,
      point: [p.x, p.y, p.z],
    };
  }

  dispose(): void {
    this.clearTubes();
    this.axesRenderer?.dispose();
    this.legendRenderer?.dispose();
    this.materialFactory.dispose();
    this.axesRenderer = null;
    this.legendRenderer = null;
  }
}
