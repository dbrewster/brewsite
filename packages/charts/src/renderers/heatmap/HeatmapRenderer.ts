// Heatmap renderer — InstancedMesh of PlaneGeometry, partial update per frame.

import * as THREE from 'three';
import { scaleBand, scaleLinear } from 'd3-scale';
import { extent } from 'd3-array';
import { AxesRenderer } from '../shared/AxesRenderer';
import type { IChartRenderer, ChartRenderContext, ChartHitInfo } from '../shared/IChartRenderer';
import type { ResolvedDataFrame } from '../../data/types';

const _dummy = new THREE.Object3D();

/**
 * Renders heatmaps as InstancedMesh of PlaneGeometry.
 * Incremental: rebuilds InstancedMesh only when cell count changes.
 * Supports time-series animation via sliced data passed from ChartWidget.onTick.
 */
export class HeatmapRenderer implements IChartRenderer {
  private instancedMesh: THREE.InstancedMesh | null = null;
  private axesRenderer: AxesRenderer | null = null;
  private lastXCount = -1;
  private lastYCount = -1;
  private readonly hitMap = new Map<number, { row: Record<string, unknown>; xi: number; yi: number }>();

  update(ctx: ChartRenderContext): void {
    const { seriesGroup, axesGroup, data, xAxis, yAxis, series, bounds, theme, opacity, fontUrl } = ctx;

    if (data.rows.length === 0) {
      this.clearMesh(seriesGroup);
      return;
    }

    const xField = xAxis?.field ?? data.fields[0] ?? 'x';
    const yField = yAxis?.field ?? data.fields[1] ?? data.fields[0] ?? 'y';
    const valueField = series[0]?.field ?? data.fields[2] ?? data.fields[0] ?? 'value';

    const xCategories = [...new Set(data.rows.map((r) => String(r[xField])))];
    const yCategories = [...new Set(data.rows.map((r) => String(r[yField])))];
    const xCount = xCategories.length;
    const yCount = yCategories.length;
    const totalCount = xCount * yCount;

    if (xCount !== this.lastXCount || yCount !== this.lastYCount) {
      this.clearMesh(seriesGroup);
      const cellW = bounds.width / Math.max(xCount, 1);
      const cellH = bounds.height / Math.max(yCount, 1);
      const geo = new THREE.PlaneGeometry(cellW * 0.92, cellH * 0.92);
      const mat = new THREE.MeshPhysicalMaterial({
        vertexColors: true,
        metalness: 0.1,
        roughness: 0.4,
        transparent: opacity < 1,
        opacity,
      });
      this.instancedMesh = new THREE.InstancedMesh(geo, mat, totalCount);
      this.instancedMesh.instanceColor = new THREE.InstancedBufferAttribute(
        new Float32Array(totalCount * 3),
        3,
      );
      seriesGroup.add(this.instancedMesh);
      this.lastXCount = xCount;
      this.lastYCount = yCount;
    }

    if (!this.instancedMesh) return;

    const values = data.rows.map((r) => Number(r[valueField]) || 0);
    const [vMin, vMax] = extent(values) as [number, number];
    // Simple viridis-like interpolation: dark blue → green → yellow
    const colorScale = (v: number): string => {
      const t = vMax > vMin ? (v - vMin) / (vMax - vMin) : 0;
      // Clamp t
      const tc = Math.max(0, Math.min(1, t));
      const r = Math.round(68 + tc * (253 - 68));
      const g = Math.round(1 + tc * (231 - 1));
      const b = Math.round(84 + (tc < 0.5 ? tc * 2 * (148 - 84) : (1 - (tc - 0.5) * 2) * (148 - 37) + 37));
      return `rgb(${r},${g},${b})`;
    };

    const cellW = bounds.width / Math.max(xCount, 1);
    const cellH = bounds.height / Math.max(yCount, 1);
    const rowMap = new Map<string, number>();
    for (const row of data.rows) {
      const key = `${row[xField]}|${row[yField]}`;
      rowMap.set(key, Number(row[valueField]) || 0);
    }

    this.hitMap.clear();
    for (let yi = 0; yi < yCount; yi++) {
      for (let xi = 0; xi < xCount; xi++) {
        const idx = yi * xCount + xi;
        const key = `${xCategories[xi]}|${yCategories[yi]}`;
        const val = rowMap.get(key) ?? 0;

        _dummy.position.set(xi * cellW + cellW / 2, yi * cellH + cellH / 2, 0);
        _dummy.updateMatrix();
        this.instancedMesh.setMatrixAt(idx, _dummy.matrix);

        const cssColor = colorScale(val);
        const color = new THREE.Color(cssColor);
        this.instancedMesh.setColorAt(idx, color);

        const row = data.rows.find(
          (r) => String(r[xField]) === xCategories[xi] && String(r[yField]) === yCategories[yi],
        );
        if (row) {
          this.hitMap.set(idx, { row: row as Record<string, unknown>, xi, yi });
        }
      }
    }
    this.instancedMesh.instanceMatrix.needsUpdate = true;
    if (this.instancedMesh.instanceColor) this.instancedMesh.instanceColor.needsUpdate = true;
    (this.instancedMesh.material as THREE.MeshPhysicalMaterial).opacity = opacity;
    (this.instancedMesh.material as THREE.MeshPhysicalMaterial).transparent = opacity < 1;

    // Axes
    if (!this.axesRenderer) this.axesRenderer = new AxesRenderer(axesGroup);
    const xTicks = xCategories.map((cat, i) => ({ value: cat, position: (i + 0.5) / xCount }));
    const yTicks = yCategories.map((cat, i) => ({ value: cat, position: (i + 0.5) / yCount }));
    this.axesRenderer.update({ xTicks, yTicks, bounds, theme, opacity, xAxis, yAxis, fontUrl });
  }

  private clearMesh(seriesGroup: THREE.Group): void {
    if (this.instancedMesh) {
      seriesGroup.remove(this.instancedMesh);
      this.instancedMesh.geometry.dispose();
      (this.instancedMesh.material as THREE.Material).dispose();
      this.instancedMesh = null;
    }
    this.lastXCount = -1;
    this.lastYCount = -1;
    this.hitMap.clear();
  }

  getInteractiveObjects(): THREE.Object3D[] {
    return this.instancedMesh ? [this.instancedMesh] : [];
  }

  resolveHoverInfo(intersection: THREE.Intersection, _data: ResolvedDataFrame): ChartHitInfo | null {
    const instanceId = intersection.instanceId;
    if (instanceId === undefined || instanceId === null) return null;
    const entry = this.hitMap.get(instanceId);
    if (!entry) return null;
    const p = intersection.point;
    return {
      seriesIndex: 0,
      datumIndex: instanceId,
      row: entry.row,
      point: [p.x, p.y, p.z],
    };
  }

  dispose(): void {
    this.clearMesh({ children: [] } as unknown as THREE.Group);
    this.axesRenderer?.dispose();
    this.axesRenderer = null;
  }
}
