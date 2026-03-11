// Pie/donut chart renderer — arc shapes extruded with THREE.ExtrudeGeometry; V2 adds explodeSlice and data labels.

import * as THREE from 'three';
import { pie } from 'd3-shape';
import { LegendRenderer } from '../shared/LegendRenderer';
import { ChartMaterialFactory } from '../shared/ChartMaterialFactory';
import type { IChartRenderer, ChartRenderContext, ChartHitInfo, DataLabelEntry } from '../shared/IChartRenderer';
import type { ResolvedDataFrame } from '../../data/types';
// DataLabelRenderer from S4 — import path correct; resolves at merge time.
import type { DataLabelRenderer } from '../shared/DataLabelRenderer';

type SliceEntry = {
  mesh: THREE.Mesh;
  datumIndex: number;
  row: Record<string, unknown>;
  /** Centroid angle in radians (for explode direction). */
  centroidAngle: number;
};

/**
 * Renders pie or donut charts as camera-facing extruded arc shapes in the XY plane.
 * V2: reads innerRadius, pieTilt, explodeSlice from ctx.typeOptions.
 *     Computes DataLabelEntry[] when ctx.dataLabels is non-null.
 */
export class PieRenderer implements IChartRenderer {
  private readonly materialFactory = new ChartMaterialFactory();
  private legendRenderer: LegendRenderer | null = null;
  private slices: SliceEntry[] = [];
  private seriesGroupRef: THREE.Group | null = null;
  private lastDataLength = -1;
  private lastInnerRadius = -1;
  private hoveredIndex = -1;
  // DataLabelRenderer instance — created on demand when ctx.dataLabels is non-null.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private dataLabelRenderer: DataLabelRenderer | null = null;

  update(ctx: ChartRenderContext): void {
    const { seriesGroup, legendGroup, data, yAxis, series, bounds, theme, opacity, fontUrl } = ctx;

    const pieOptions = ctx.typeOptions.kind === 'pie' ? ctx.typeOptions.options : {};
    const innerRadiusRatio = pieOptions.innerRadius ?? 0;
    const pieTilt = pieOptions.pieTilt ?? theme.pie?.tilt ?? 0;
    const explodeSlice = pieOptions.explodeSlice;

    const valueField = series[0]?.field ?? yAxis?.field ?? data.fields[1] ?? data.fields[0] ?? 'value';
    const labelField = ctx.xAxis?.field ?? data.fields[0] ?? 'label';

    this.seriesGroupRef = seriesGroup;

    if (data.rows.length === 0) {
      this.reset();
      return;
    }

    const needsRebuild = data.rows.length !== this.lastDataLength || innerRadiusRatio !== this.lastInnerRadius;

    if (needsRebuild) {
      this.clearSlices();
      this.buildSlices(seriesGroup, data, valueField, labelField, bounds, theme, opacity, innerRadiusRatio, pieTilt, explodeSlice);
      this.lastDataLength = data.rows.length;
      this.lastInnerRadius = innerRadiusRatio;
    } else {
      for (let i = 0; i < this.slices.length; i++) {
        const entry = this.slices[i]!;
        const mat = entry.mesh.material as THREE.MeshPhysicalMaterial;
        mat.opacity = opacity;
        mat.transparent = opacity < 1;
        entry.mesh.rotation.x = pieTilt;

        // Re-apply explode on incremental update
        const row = entry.row;
        const isExploded = explodeSlice && String(row[labelField]) === explodeSlice;
        const explodeOffset = isExploded ? 0.1 * Math.min(bounds.width, bounds.height) * 0.4 : 0;
        const cx = bounds.width / 2 + Math.cos(entry.centroidAngle) * explodeOffset;
        const cy = bounds.height / 2 + Math.sin(entry.centroidAngle) * explodeOffset;
        entry.mesh.position.set(cx, cy, 0);
      }
    }

    // Data labels
    if (ctx.dataLabels) {
      const entries = this.computeDataLabelEntries(data, valueField, labelField, ctx.dataLabels.position, explodeSlice, bounds);
      if (this.dataLabelRenderer) {
        this.dataLabelRenderer.update(entries, theme, opacity, fontUrl);
      }
    }

    if (!this.legendRenderer) this.legendRenderer = new LegendRenderer(legendGroup);
    const legendSeries = data.rows.map((r, i) => ({
      field: String(r[labelField] ?? i),
      label: String(r[labelField] ?? i),
    }));
    this.legendRenderer.update(legendSeries, ctx.legend ?? { visible: true, position: 'right' }, theme, opacity, fontUrl);
  }

  private buildSlices(
    seriesGroup: THREE.Group,
    data: ResolvedDataFrame,
    valueField: string,
    labelField: string,
    bounds: { width: number; height: number; depth: number },
    theme: ChartRenderContext['theme'],
    opacity: number,
    innerRadiusRatio: number,
    pieTilt: number,
    explodeSlice: string | undefined,
  ): void {
    const radius = Math.min(bounds.width, bounds.height) * 0.4;
    const innerRadius = radius * Math.max(0, Math.min(0.85, innerRadiusRatio));

    const pieGen = pie<Record<string, unknown>>()
      .value((d) => Math.max(0, Number(d[valueField]) || 0))
      .sort(null);

    const sliceData = pieGen(data.rows as Array<Record<string, unknown>>);
    const segments = 48;

    for (let i = 0; i < sliceData.length; i++) {
      const d = sliceData[i]!;
      const centroidAngle = (d.startAngle + d.endAngle) / 2 - Math.PI / 2;
      const row = d.data as Record<string, unknown>;
      const isExploded = explodeSlice && String(row[labelField]) === explodeSlice;
      const explodeOffset = isExploded ? 0.1 * radius : 0;

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

      // Center the pie + explode offset
      const cx = bounds.width / 2 + Math.cos(centroidAngle) * explodeOffset;
      const cy = bounds.height / 2 + Math.sin(centroidAngle) * explodeOffset;
      mesh.position.set(cx, cy, 0);
      mesh.rotation.x = pieTilt;
      seriesGroup.add(mesh);
      this.slices.push({ mesh, datumIndex: i, row, centroidAngle });
    }
  }

  private computeDataLabelEntries(
    data: ResolvedDataFrame,
    valueField: string,
    labelField: string,
    position: 'top' | 'center' | 'outside',
    explodeSlice: string | undefined,
    bounds: { width: number; height: number; depth: number },
  ): DataLabelEntry[] {
    const entries: DataLabelEntry[] = [];
    for (let i = 0; i < this.slices.length; i++) {
      const entry = this.slices[i]!;
      const row = data.rows[i] as Record<string, unknown> | undefined;
      if (!row) continue;

      const value = Number(row[valueField]) || 0;
      const isExploded = explodeSlice && String(row[labelField]) === explodeSlice;

      let alignment: DataLabelEntry['alignment'];
      if (isExploded) {
        alignment = 'outside';
      } else {
        switch (position) {
          case 'center': alignment = 'center'; break;
          case 'outside': alignment = 'outside'; break;
          case 'top':
          default:
            alignment = 'above';
        }
      }

      entries.push({
        position: new THREE.Vector3(entry.mesh.position.x, entry.mesh.position.y, entry.mesh.position.z),
        text: String(Math.round(value)),
        alignment,
      });
    }
    return entries;
  }

  private clearSlices(): void {
    const group = this.seriesGroupRef;
    for (const s of this.slices) {
      group?.remove(s.mesh);
      s.mesh.geometry.dispose();
    }
    this.slices = [];
    this.hoveredIndex = -1;
    this.lastDataLength = -1;
    this.lastInnerRadius = -1;
  }

  private reset(): void {
    this.clearSlices();
    this.legendRenderer?.dispose();
    this.dataLabelRenderer?.dispose();
    this.legendRenderer = null;
    this.dataLabelRenderer = null;
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
    this.reset();
    this.materialFactory.dispose();
  }
}
