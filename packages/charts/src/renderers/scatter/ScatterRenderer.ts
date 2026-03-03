// Scatter chart renderer — InstancedMesh of SphereGeometry for performance.

import * as THREE from 'three';
import { scaleLinear } from 'd3-scale';
import { extent } from 'd3-array';
import { AxesRenderer } from '../shared/AxesRenderer';
import { LegendRenderer } from '../shared/LegendRenderer';
import type { IChartRenderer, ChartRenderContext, ChartHitInfo } from '../shared/IChartRenderer';
import type { ResolvedDataFrame } from '../../data/types';

const _dummy = new THREE.Object3D();

/**
 * Renders scatter plots as InstancedMesh of spheres.
 * Rebuilds InstancedMesh only when the row count changes; otherwise
 * calls setMatrixAt/setColorAt in-place for fast incremental updates.
 */
export class ScatterRenderer implements IChartRenderer {
  private instancedMesh: THREE.InstancedMesh | null = null;
  private axesRenderer: AxesRenderer | null = null;
  private legendRenderer: LegendRenderer | null = null;
  private seriesGroupRef: THREE.Group | null = null;
  private lastCount = -1;
  private readonly hitRows: Array<Record<string, unknown>> = [];

  update(ctx: ChartRenderContext): void {
    const { seriesGroup, axesGroup, legendGroup, data, xAxis, yAxis, series, bounds, theme, opacity } = ctx;

    this.seriesGroupRef = seriesGroup;

    if (data.rows.length === 0) {
      this.clearMesh();
      return;
    }

    const xField = xAxis?.field ?? data.fields[0] ?? 'x';
    const yField = series[0]?.field ?? yAxis?.field ?? data.fields[1] ?? data.fields[0] ?? 'y';

    const xValues = data.rows.map((r) => Number(r[xField]) || 0);
    const yValues = data.rows.map((r) => Number(r[yField]) || 0);
    const [xMin, xMax] = extent(xValues) as [number, number];
    const [yMin, yMax] = extent(yValues) as [number, number];

    const xScale = scaleLinear().domain([xMin, xMax]).range([0.1 * bounds.width, 0.9 * bounds.width]);
    const yScale = scaleLinear().domain([yMin, yMax]).range([0.1 * bounds.height, 0.9 * bounds.height]);

    const count = data.rows.length;

    if (count !== this.lastCount) {
      this.clearMesh();
      const geo = new THREE.SphereGeometry(0.08, 12, 12);
      const mat = new THREE.MeshPhysicalMaterial({
        vertexColors: true,
        metalness: theme.series[0]?.metalness ?? 0.2,
        roughness: theme.series[0]?.roughness ?? 0.3,
        transparent: opacity < 1,
        opacity,
      });
      this.instancedMesh = new THREE.InstancedMesh(geo, mat, count);
      this.instancedMesh.instanceColor = new THREE.InstancedBufferAttribute(
        new Float32Array(count * 3),
        3,
      );
      seriesGroup.add(this.instancedMesh);
      this.hitRows.length = 0;
      for (const row of data.rows) {
        this.hitRows.push(row as Record<string, unknown>);
      }
      this.lastCount = count;
    }

    if (!this.instancedMesh) return;

    // Partial update — matrix and color per instance
    const baseColor = new THREE.Color(theme.series[0]?.color ?? '#00d4ff');
    for (let i = 0; i < count; i++) {
      _dummy.position.set(xScale(xValues[i]!), yScale(yValues[i]!), 0);
      _dummy.updateMatrix();
      this.instancedMesh.setMatrixAt(i, _dummy.matrix);
      this.instancedMesh.setColorAt(i, baseColor);
    }
    this.instancedMesh.instanceMatrix.needsUpdate = true;
    if (this.instancedMesh.instanceColor) this.instancedMesh.instanceColor.needsUpdate = true;
    (this.instancedMesh.material as THREE.MeshPhysicalMaterial).opacity = opacity;
    (this.instancedMesh.material as THREE.MeshPhysicalMaterial).transparent = opacity < 1;

    // Axes
    if (!this.axesRenderer) this.axesRenderer = new AxesRenderer(axesGroup);
    const xTicks = Array.from({ length: 6 }, (_, i) => ({
      value: Math.round(xMin + ((xMax - xMin) * i) / 5),
      position: i / 5,
    }));
    const yTicks = Array.from({ length: 6 }, (_, i) => ({
      value: Math.round(yMin + ((yMax - yMin) * i) / 5),
      position: i / 5,
    }));
    this.axesRenderer.update({ xTicks, yTicks, bounds, theme, opacity, xAxis, yAxis });

    if (!this.legendRenderer) this.legendRenderer = new LegendRenderer(legendGroup);
    this.legendRenderer.update(
      series.length > 0 ? series : [{ field: yField }],
      theme,
      opacity,
    );
  }

  private clearMesh(): void {
    const group = this.seriesGroupRef;
    if (this.instancedMesh) {
      group?.remove(this.instancedMesh);
      this.instancedMesh.geometry.dispose();
      (this.instancedMesh.material as THREE.Material).dispose();
      this.instancedMesh = null;
    }
    this.lastCount = -1;
    this.hitRows.length = 0;
  }

  getInteractiveObjects(): THREE.Object3D[] {
    return this.instancedMesh ? [this.instancedMesh] : [];
  }

  resolveHoverInfo(intersection: THREE.Intersection, _data: ResolvedDataFrame): ChartHitInfo | null {
    const instanceId = intersection.instanceId;
    if (instanceId === undefined || instanceId === null) return null;
    const row = this.hitRows[instanceId];
    if (!row) return null;
    const p = intersection.point;
    return {
      seriesIndex: 0,
      datumIndex: instanceId,
      row,
      point: [p.x, p.y, p.z],
    };
  }

  dispose(): void {
    this.clearMesh();
    this.axesRenderer?.dispose();
    this.legendRenderer?.dispose();
    this.axesRenderer = null;
    this.legendRenderer = null;
  }
}
