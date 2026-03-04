// Pie/donut chart renderer — arc shapes extruded with THREE.ExtrudeGeometry.

import * as THREE from 'three';
import { pie } from 'd3-shape';
import { LegendRenderer } from '../shared/LegendRenderer';
import { ChartMaterialFactory } from '../shared/ChartMaterialFactory';
import type { IChartRenderer, ChartRenderContext, ChartHitInfo } from '../shared/IChartRenderer';
import type { ResolvedDataFrame } from '../../data/types';

type SliceEntry = {
  mesh: THREE.Mesh;
  datumIndex: number;
  row: Record<string, unknown>;
};

/**
 * Renders pie or donut charts as extruded arc shapes in the XZ plane.
 * Supports exploded slice on hover via position offset.
 */
export class PieRenderer implements IChartRenderer {
  private readonly materialFactory = new ChartMaterialFactory();
  private legendRenderer: LegendRenderer | null = null;
  private slices: SliceEntry[] = [];
  private seriesGroupRef: THREE.Group | null = null;
  private lastDataLength = -1;
  private hoveredIndex = -1;

  update(ctx: ChartRenderContext): void {
    const { seriesGroup, legendGroup, data, yAxis, series, bounds, theme, opacity, fontUrl } = ctx;

    const valueField = series[0]?.field ?? yAxis?.field ?? data.fields[1] ?? data.fields[0] ?? 'value';
    const labelField = ctx.xAxis?.field ?? data.fields[0] ?? 'label';

    this.seriesGroupRef = seriesGroup;

    if (data.rows.length === 0) {
      this.clearSlices();
      return;
    }

    const needsRebuild = data.rows.length !== this.lastDataLength;

    if (needsRebuild) {
      this.clearSlices();
      this.buildSlices(seriesGroup, data, valueField, labelField, bounds, theme, opacity);
      this.lastDataLength = data.rows.length;
    } else {
      for (let i = 0; i < this.slices.length; i++) {
        const mat = this.slices[i]!.mesh.material as THREE.MeshPhysicalMaterial;
        mat.opacity = opacity;
        mat.transparent = opacity < 1;
      }
    }

    if (!this.legendRenderer) this.legendRenderer = new LegendRenderer(legendGroup);
    const legendSeries = data.rows.map((r, i) => ({
      field: String(r[labelField] ?? i),
      label: String(r[labelField] ?? i),
    }));
    this.legendRenderer.update(legendSeries, theme, opacity, fontUrl);
  }

  private buildSlices(
    seriesGroup: THREE.Group,
    data: ResolvedDataFrame,
    valueField: string,
    _labelField: string,
    bounds: { width: number; height: number; depth: number },
    theme: ChartRenderContext['theme'],
    opacity: number,
  ): void {
    const radius = Math.min(bounds.width, bounds.height) * 0.4;
    const innerRadius = 0; // 0 = pie, radius * 0.5 = donut

    const pieGen = pie<Record<string, unknown>>()
      .value((d) => Math.max(0, Number(d[valueField]) || 0))
      .sort(null);

    const sliceData = pieGen(data.rows as Array<Record<string, unknown>>);
    const segments = 48;

    for (let i = 0; i < sliceData.length; i++) {
      const d = sliceData[i]!;
      const shape = new THREE.Shape();

      // Build arc shape
      const startAngle = d.startAngle - Math.PI / 2;
      const endAngle = d.endAngle - Math.PI / 2;
      const arcPoints = segments;

      shape.moveTo(
        Math.cos(startAngle) * innerRadius,
        Math.sin(startAngle) * innerRadius,
      );

      // Outer arc
      for (let j = 0; j <= arcPoints; j++) {
        const angle = startAngle + ((endAngle - startAngle) * j) / arcPoints;
        shape.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
      }

      // Inner arc (back to center for pie, or inner radius for donut)
      if (innerRadius > 0) {
        for (let j = arcPoints; j >= 0; j--) {
          const angle = startAngle + ((endAngle - startAngle) * j) / arcPoints;
          shape.lineTo(Math.cos(angle) * innerRadius, Math.sin(angle) * innerRadius);
        }
      } else {
        shape.lineTo(0, 0);
      }
      shape.closePath();

      const tokens = theme.series[i % theme.series.length]!;
      const geo = new THREE.ExtrudeGeometry(shape, {
        depth: tokens.depth,
        bevelEnabled: false,
      });
      const mat = this.materialFactory.getSeriesMaterial(theme, i);
      mat.opacity = opacity;
      mat.transparent = opacity < 1;
      const mesh = new THREE.Mesh(geo, mat);
      // Center the pie
      mesh.position.set(bounds.width / 2, bounds.height / 2, 0);
      mesh.rotation.x = -Math.PI / 2;
      seriesGroup.add(mesh);
      this.slices.push({ mesh, datumIndex: i, row: d.data as Record<string, unknown> });
    }
  }

  private clearSlices(): void {
    const group = this.seriesGroupRef;
    for (const s of this.slices) {
      group?.remove(s.mesh);
      s.mesh.geometry.dispose();
    }
    this.slices = [];
    this.hoveredIndex = -1;
  }

  getInteractiveObjects(): THREE.Object3D[] {
    return this.slices.map((s) => s.mesh);
  }

  resolveHoverInfo(intersection: THREE.Intersection, _data: ResolvedDataFrame): ChartHitInfo | null {
    const mesh = intersection.object as THREE.Mesh;
    const entry = this.slices.find((s) => s.mesh === mesh);
    if (!entry) return null;
    const p = intersection.point;
    return {
      seriesIndex: 0,
      datumIndex: entry.datumIndex,
      row: entry.row,
      point: [p.x, p.y, p.z],
    };
  }

  dispose(): void {
    this.clearSlices();
    this.legendRenderer?.dispose();
    this.materialFactory.dispose();
    this.legendRenderer = null;
  }
}
