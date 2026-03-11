// Heatmap renderer — InstancedMesh of PlaneGeometry or BoxGeometry; V2 adds heightField, colorInterpolator, timeField slicing.

import * as THREE from 'three';
import { extent } from 'd3-array';
import { interpolateViridis, interpolatePlasma, interpolateBlues, interpolateReds } from 'd3-scale-chromatic';
import { AxesRenderer } from '../shared/AxesRenderer';
import type { IChartRenderer, ChartRenderContext, ChartHitInfo } from '../shared/IChartRenderer';
import type { ResolvedDataFrame } from '../../data/types';

const _dummy = new THREE.Object3D();

/** Returns a d3 color interpolator function for the named palette. */
function getInterpolator(name: 'blues' | 'reds' | 'viridis' | 'plasma' | undefined): (t: number) => string {
  switch (name) {
    case 'blues': return interpolateBlues;
    case 'reds': return interpolateReds;
    case 'plasma': return interpolatePlasma;
    case 'viridis':
    default:
      return interpolateViridis;
  }
}

/**
 * Renders heatmaps as InstancedMesh of PlaneGeometry (or BoxGeometry when heightField is used).
 * V2: reads timeField, heightField, colorInterpolator from ctx.typeOptions.
 *     updateSlice() supports blockProgress-driven time-series animation from ChartWidget.onTick().
 */
export class HeatmapRenderer implements IChartRenderer {
  private instancedMesh: THREE.InstancedMesh | null = null;
  private axesRenderer: AxesRenderer | null = null;
  private seriesGroupRef: THREE.Group | null = null;
  private lastXCount = -1;
  private lastYCount = -1;
  private lastHasHeightField = false;
  private lastTimeSliceIndex = -1;
  private readonly hitMap = new Map<number, { row: Record<string, unknown>; xi: number; yi: number }>();

  update(ctx: ChartRenderContext): void {
    const { seriesGroup, axesGroup, data, xAxis, yAxis, series, bounds, theme, opacity, fontUrl } = ctx;
    this.seriesGroupRef = seriesGroup;

    if (data.rows.length === 0) {
      this.reset();
      return;
    }

    const heatmapOptions = ctx.typeOptions.kind === 'heatmap' ? ctx.typeOptions.options : {};
    const heightField = heatmapOptions.heightField;
    const colorInterpolator = heatmapOptions.colorInterpolator;
    const timeField = heatmapOptions.timeField;

    const xField = xAxis?.field ?? data.fields[0] ?? 'x';
    const yField = yAxis?.field ?? data.fields[1] ?? data.fields[0] ?? 'y';
    const valueField = series[0]?.field ?? data.fields[2] ?? data.fields[0] ?? 'value';

    // When timeField is present, filter to the most recent time slice by default (last)
    const activeRows = this.selectActiveRows(data, timeField, this.lastTimeSliceIndex);

    const xCategories = [...new Set(activeRows.map((r) => String(r[xField])))];
    const yCategories = [...new Set(activeRows.map((r) => String(r[yField])))];
    const xCount = xCategories.length;
    const yCount = yCategories.length;
    const totalCount = xCount * yCount;
    const hasHeightField = !!heightField;

    if (xCount !== this.lastXCount || yCount !== this.lastYCount || hasHeightField !== this.lastHasHeightField) {
      this.clearMesh();
      const cellW = bounds.width / Math.max(xCount, 1);
      const cellH = bounds.height / Math.max(yCount, 1);

      let geo: THREE.BufferGeometry;
      if (hasHeightField) {
        // BoxGeometry with unit Y height — scaled per-instance via matrix
        geo = new THREE.BoxGeometry(cellW * 0.92, 1, cellH * 0.92);
      } else {
        geo = new THREE.PlaneGeometry(cellW * 0.92, cellH * 0.92);
      }

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
      this.lastHasHeightField = hasHeightField;
    }

    if (!this.instancedMesh) return;

    this.applyInstanceData(activeRows, xField, yField, valueField, heightField, xCategories, yCategories, bounds, colorInterpolator, opacity);

    // Axes
    if (!this.axesRenderer) this.axesRenderer = new AxesRenderer(axesGroup);
    const xTicks = xCategories.map((cat, i) => ({ value: cat, position: (i + 0.5) / xCount }));
    const yTicks = yCategories.map((cat, i) => ({ value: cat, position: (i + 0.5) / yCount }));
    this.axesRenderer.update({ xTicks, yTicks, bounds, theme, opacity, xAxis, yAxis, fontUrl, gridlines: ctx.gridlines });
  }

  /**
   * Called by ChartRenderer.updateHeatmapSlice() from ChartWidget.onTick().
   * Allows blockProgress-driven time animation without a full update() cycle.
   */
  updateSlice(sliceIndex: number, ctx: ChartRenderContext): void {
    if (!this.instancedMesh) return;

    const heatmapOptions = ctx.typeOptions.kind === 'heatmap' ? ctx.typeOptions.options : {};
    const timeField = heatmapOptions.timeField;

    if (!timeField) return;

    this.lastTimeSliceIndex = sliceIndex;

    const { data, xAxis, yAxis, series, bounds } = ctx;
    const xField = xAxis?.field ?? data.fields[0] ?? 'x';
    const yField = yAxis?.field ?? data.fields[1] ?? data.fields[0] ?? 'y';
    const valueField = series[0]?.field ?? data.fields[2] ?? data.fields[0] ?? 'value';
    const heightField = heatmapOptions.heightField;
    const colorInterpolator = heatmapOptions.colorInterpolator;

    const activeRows = this.selectActiveRows(data, timeField, sliceIndex);
    const xCategories = [...new Set(activeRows.map((r) => String(r[xField])))];
    const yCategories = [...new Set(activeRows.map((r) => String(r[yField])))];

    this.applyInstanceData(activeRows, xField, yField, valueField, heightField, xCategories, yCategories, bounds, colorInterpolator, ctx.opacity);
  }

  private selectActiveRows(
    data: ResolvedDataFrame,
    timeField: string | undefined,
    sliceIndex: number,
  ): ReadonlyArray<Record<string, unknown>> {
    if (!timeField) return data.rows as Array<Record<string, unknown>>;
    const timeValues = [...new Set(data.rows.map((r) => String(r[timeField])))].sort();
    if (timeValues.length === 0) return data.rows as Array<Record<string, unknown>>;
    const effectiveIndex = sliceIndex >= 0 && sliceIndex < timeValues.length ? sliceIndex : timeValues.length - 1;
    const timeValue = timeValues[effectiveIndex]!;
    return (data.rows as Array<Record<string, unknown>>).filter((r) => String(r[timeField]) === timeValue);
  }

  private applyInstanceData(
    rows: ReadonlyArray<Record<string, unknown>>,
    xField: string,
    yField: string,
    valueField: string,
    heightField: string | undefined,
    xCategories: string[],
    yCategories: string[],
    bounds: { width: number; height: number; depth: number },
    colorInterpolator: 'blues' | 'reds' | 'viridis' | 'plasma' | undefined,
    opacity: number,
  ): void {
    if (!this.instancedMesh) return;

    const xCount = xCategories.length;
    const yCount = yCategories.length;
    const values = rows.map((r) => Number(r[valueField]) || 0);
    const [vMin, vMax] = extent(values) as [number, number];
    const vRange = (vMax - vMin) || 1;

    const heightValues = heightField ? rows.map((r) => Number(r[heightField]) || 0) : null;
    const [hMin, hMax] = heightValues ? (extent(heightValues) as [number, number]) : [0, 1];
    const hRange = (hMax - hMin) || 1;
    const maxBarHeight = bounds.height * 0.5;

    const colorInterp = getInterpolator(colorInterpolator);
    const cellW = bounds.width / Math.max(xCount, 1);
    const cellH = bounds.height / Math.max(yCount, 1);

    const rowMap = new Map<string, { value: number; height: number; row: Record<string, unknown> }>();
    for (const row of rows) {
      const key = `${row[xField]}|${row[yField]}`;
      rowMap.set(key, {
        value: Number(row[valueField]) || 0,
        height: heightField ? (Number(row[heightField]) || 0) : 0,
        row,
      });
    }

    this.hitMap.clear();
    let instanceIdx = 0;
    for (let yi = 0; yi < yCount; yi++) {
      for (let xi = 0; xi < xCount; xi++) {
        const idx = yi * xCount + xi;
        const key = `${xCategories[xi]}|${yCategories[yi]}`;
        const entry = rowMap.get(key);
        const val = entry?.value ?? 0;

        const normalizedVal = vRange > 0 ? Math.max(0, Math.min(1, (val - vMin) / vRange)) : 0;
        const cssColor = colorInterp(normalizedVal);
        const color = new THREE.Color(cssColor);

        if (heightValues && entry) {
          const normalizedH = hRange > 0 ? (entry.height - hMin) / hRange : 0;
          const barH = Math.max(0.01, normalizedH * maxBarHeight);
          _dummy.position.set(xi * cellW + cellW / 2, barH / 2, yi * cellH + cellH / 2);
          _dummy.scale.set(1, barH, 1);
        } else {
          _dummy.position.set(xi * cellW + cellW / 2, yi * cellH + cellH / 2, 0);
          _dummy.scale.set(1, 1, 1);
        }
        _dummy.updateMatrix();
        this.instancedMesh.setMatrixAt(idx, _dummy.matrix);
        this.instancedMesh.setColorAt(idx, color);

        if (entry?.row) {
          this.hitMap.set(idx, { row: entry.row, xi, yi });
        }
        instanceIdx++;
      }
    }

    this.instancedMesh.instanceMatrix.needsUpdate = true;
    if (this.instancedMesh.instanceColor) this.instancedMesh.instanceColor.needsUpdate = true;
    (this.instancedMesh.material as THREE.MeshPhysicalMaterial).opacity = opacity;
    (this.instancedMesh.material as THREE.MeshPhysicalMaterial).transparent = opacity < 1;
  }

  private clearMesh(): void {
    if (this.instancedMesh) {
      this.seriesGroupRef?.remove(this.instancedMesh);
      this.instancedMesh.geometry.dispose();
      (this.instancedMesh.material as THREE.Material).dispose();
      this.instancedMesh = null;
    }
    this.lastXCount = -1;
    this.lastYCount = -1;
    this.lastHasHeightField = false;
    this.hitMap.clear();
  }

  private reset(): void {
    this.clearMesh();
    this.axesRenderer?.dispose();
    this.axesRenderer = null;
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
    this.reset();
  }
}
