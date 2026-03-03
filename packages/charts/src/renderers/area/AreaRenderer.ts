// Area chart renderer — THREE.Shape from d3-area boundaries → ExtrudeGeometry.

import * as THREE from 'three';
import { scaleLinear } from 'd3-scale';
import { extent } from 'd3-array';
import { area } from 'd3-shape';
import { AxesRenderer } from '../shared/AxesRenderer';
import { LegendRenderer } from '../shared/LegendRenderer';
import { ChartMaterialFactory } from '../shared/ChartMaterialFactory';
import type { IChartRenderer, ChartRenderContext, ChartHitInfo } from '../shared/IChartRenderer';
import type { ResolvedDataFrame } from '../../data/types';

const AREA_OPACITY_FACTOR = 0.65;

/**
 * Renders area charts as extruded Three.js shapes.
 * Multi-series areas are slightly offset along Z for depth.
 */
export class AreaRenderer implements IChartRenderer {
  private readonly materialFactory = new ChartMaterialFactory();
  private axesRenderer: AxesRenderer | null = null;
  private legendRenderer: LegendRenderer | null = null;
  private readonly areaMeshes: THREE.Mesh[] = [];
  private seriesGroupRef: THREE.Group | null = null;
  private lastBoundsWidth = 1;
  private lastDataLength = -1;
  private lastSeriesCount = -1;

  update(ctx: ChartRenderContext): void {
    const { seriesGroup, axesGroup, legendGroup, data, xAxis, yAxis, series, bounds, theme, opacity } = ctx;

    const effectiveSeries: Array<{ field: string; label?: string; color?: string }> = series.length > 0
      ? [...series]
      : (yAxis ? [{ field: yAxis.field, label: yAxis.label }] : []);

    this.seriesGroupRef = seriesGroup;

    if (effectiveSeries.length === 0 || data.rows.length < 2) {
      this.clearAreas();
      return;
    }

    const xField = xAxis?.field ?? data.fields[0] ?? 'x';
    const needsRebuild =
      data.rows.length !== this.lastDataLength ||
      effectiveSeries.length !== this.lastSeriesCount;

    if (needsRebuild) {
      this.clearAreas();
      this.buildAreas(seriesGroup, data, xField, effectiveSeries, bounds, theme, opacity);
      this.lastDataLength = data.rows.length;
      this.lastSeriesCount = effectiveSeries.length;
    } else {
      for (const mesh of this.areaMeshes) {
        const mat = mesh.material as THREE.MeshPhysicalMaterial;
        mat.opacity = opacity * AREA_OPACITY_FACTOR;
        mat.transparent = true;
      }
    }

    if (!this.axesRenderer) this.axesRenderer = new AxesRenderer(axesGroup);
    const n = data.rows.length;
    const xTicks = data.rows
      .filter((_, i) => i % Math.max(1, Math.floor(n / 6)) === 0)
      .map((r, i) => ({ value: r[xField], position: i / (n - 1) }));
    const allValues = data.rows.flatMap((r) =>
      effectiveSeries.map((s) => Number(r[s.field]) || 0),
    );
    const [, yMax] = extent(allValues) as [number, number];
    const yTicks = Array.from({ length: 6 }, (_, i) => ({
      value: Math.round((yMax * i) / 5),
      position: i / 5,
    }));
    this.axesRenderer.update({ xTicks, yTicks, bounds, theme, opacity, xAxis, yAxis });

    if (!this.legendRenderer) this.legendRenderer = new LegendRenderer(legendGroup);
    this.legendRenderer.update(effectiveSeries, theme, opacity);
  }

  private buildAreas(
    seriesGroup: THREE.Group,
    data: ResolvedDataFrame,
    xField: string,
    series: Array<{ field: string; label?: string; color?: string }>,
    bounds: { width: number; height: number; depth: number },
    theme: ChartRenderContext['theme'],
    opacity: number,
  ): void {
    this.lastBoundsWidth = bounds.width;

    const allValues = data.rows.flatMap((r) =>
      series.map((s) => Number(r[s.field]) || 0),
    );
    const [, yMax] = extent(allValues) as [number, number];
    const yScale = scaleLinear().domain([0, yMax]).range([0, bounds.height]);
    const xScale = scaleLinear().domain([0, data.rows.length - 1]).range([0, bounds.width]);

    for (let si = 0; si < series.length; si++) {
      const s = series[si]!;
      const zOffset = si * 0.1;

      // Build shape from area boundaries
      const shape = new THREE.Shape();
      // Start at baseline left
      shape.moveTo(0, 0);
      // Upper boundary
      for (let i = 0; i < data.rows.length; i++) {
        const x = xScale(i);
        const y = yScale(Number(data.rows[i]![s.field]) || 0);
        if (i === 0) shape.lineTo(x, y);
        else shape.lineTo(x, y);
      }
      // Close back to baseline
      shape.lineTo(xScale(data.rows.length - 1), 0);
      shape.lineTo(0, 0);

      const tokens = theme.series[si % theme.series.length]!;
      const geo = new THREE.ExtrudeGeometry(shape, {
        depth: tokens.depth,
        bevelEnabled: false,
      });
      const mat = this.materialFactory.getSeriesMaterial(theme, si);
      mat.opacity = opacity * AREA_OPACITY_FACTOR;
      mat.transparent = true;
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.z = zOffset;
      seriesGroup.add(mesh);
      this.areaMeshes.push(mesh);
    }
  }

  private clearAreas(): void {
    const group = this.seriesGroupRef;
    for (const mesh of this.areaMeshes) {
      group?.remove(mesh);
      mesh.geometry.dispose();
    }
    this.areaMeshes.length = 0;
  }

  getInteractiveObjects(): THREE.Object3D[] {
    return this.areaMeshes;
  }

  resolveHoverInfo(intersection: THREE.Intersection, data: ResolvedDataFrame): ChartHitInfo | null {
    const meshIndex = this.areaMeshes.indexOf(intersection.object as THREE.Mesh);
    if (meshIndex < 0) return null;
    if (data.rows.length === 0) return null;

    // X coordinate maps linearly to data index
    const normalizedX = intersection.point.x / this.lastBoundsWidth;
    const datumIndex = Math.round(
      Math.max(0, Math.min(1, normalizedX)) * (data.rows.length - 1)
    );
    const row = (data.rows[datumIndex] ?? {}) as Record<string, unknown>;
    const p = intersection.point;
    return {
      seriesIndex: meshIndex,
      datumIndex,
      row,
      point: [p.x, p.y, p.z],
    };
  }

  dispose(): void {
    this.clearAreas();
    this.axesRenderer?.dispose();
    this.legendRenderer?.dispose();
    this.materialFactory.dispose();
    this.axesRenderer = null;
    this.legendRenderer = null;
  }
}
