// Scatter chart renderer — InstancedMesh with 4D encoding: x/y position, sizeField scale, colorField color.

import * as THREE from 'three';
import { scaleLinear } from 'd3-scale';
import { extent } from 'd3-array';
import { parseHexColor, lerp } from '@brewsite/core';
import { AxesRenderer } from '../shared/AxesRenderer';
import { LegendRenderer } from '../shared/LegendRenderer';
import { getInterpolator } from '../shared/colorUtils';
import type { IChartRenderer, ChartRenderContext, ChartHitInfo, ChartHitMeta } from '../shared/IChartRenderer';
import type { ResolvedDataFrame } from '../../data/types';

const _dummy = new THREE.Object3D();
const SCATTER_Z_OFFSET = -0.2;

/**
 * Renders scatter plots as InstancedMesh of spheres.
 * V2: supports sizeField (per-instance scale), colorField (ordinal or continuous),
 *     datum-level morphing via ctx.morphCtx.
 */
export class ScatterRenderer implements IChartRenderer {
  private instancedMesh: THREE.InstancedMesh | null = null;
  private axesRenderer: AxesRenderer | null = null;
  private legendRenderer: LegendRenderer | null = null;
  private seriesGroupRef: THREE.Group | null = null;
  private lastDataFrame: ResolvedDataFrame | null = null;
  private lastCount = -1;
  private lastSizeField: string | undefined = undefined;
  private lastColorField: string | undefined = undefined;
  private readonly hitRows: Array<Record<string, unknown>> = [];
  private cachedChartPositionX = 0;
  private cachedPlotFrameOffsetX = 0;
  private cachedXField = '';
  private cachedSizeField: string | undefined = undefined;
  private cachedColorField: string | undefined = undefined;
  private lastBoundsWidth = -1;
  private lastBoundsHeight = -1;

  update(ctx: ChartRenderContext): void {
    const { seriesGroup, axesGroup, legendGroup, data, xAxis, yAxis, series, bounds, theme, opacity, fontUrl } = ctx;

    this.seriesGroupRef = seriesGroup;
    this.cachedChartPositionX   = ctx.chartPosition?.[0] ?? 0;
    this.cachedPlotFrameOffsetX = ctx.plotFrameOffset?.x ?? 0;

    if (data.rows.length === 0) {
      this.reset();
      return;
    }

    const scatterOptions = ctx.typeOptions.kind === 'scatter' ? ctx.typeOptions.options : {};
    const sizeField = scatterOptions.sizeField;
    const colorField = scatterOptions.colorField;
    const sizeScaleOpts = scatterOptions.sizeScale ?? { min: 0.5, max: 1.5 };
    const colorInterpolator = scatterOptions.colorInterpolator ?? 'viridis';

    const xField = xAxis?.field ?? data.fields[0] ?? 'x';
    const yField = series[0]?.field ?? yAxis?.field ?? data.fields[1] ?? data.fields[0] ?? 'y';
    this.cachedXField = xField;
    this.cachedSizeField = sizeField;
    this.cachedColorField = colorField;

    // Resolve x/y values via accessors when provided, else field-name lookup
    const xValues = data.rows.map((r) =>
      ctx.accessors?.xAccessor ? ctx.accessors.xAccessor(r as Record<string, unknown>) : (Number(r[xField]) || 0),
    );
    const yValues = data.rows.map((r) =>
      ctx.accessors?.yAccessor ? ctx.accessors.yAccessor(r as Record<string, unknown>) : (Number(r[yField]) || 0),
    );
    const [xMin, xMax] = extent(xValues) as [number, number];
    const [yMin, yMax] = extent(yValues) as [number, number];

    // V2.1: Move whitespace into domain padding instead of range padding.
    // This aligns point positions and tick positions on the same 0–100% range.
    const xPad = xMin === xMax ? Math.abs(xMin) * 0.1 + 0.5 : (xMax - xMin) * 0.05;
    const yPad = yMin === yMax ? Math.abs(yMin) * 0.1 + 0.5 : (yMax - yMin) * 0.05;
    const xScale = scaleLinear()
      .domain([xMin - xPad, xMax + xPad])
      .range([0, bounds.width]);
    const yScale = scaleLinear()
      .domain([yMin - yPad, yMax + yPad])
      .range([0, bounds.height]);

    const count = data.rows.length;
    const needsRebuild =
      data !== this.lastDataFrame ||
      count !== this.lastCount ||
      sizeField !== this.lastSizeField ||
      colorField !== this.lastColorField ||
      bounds.width !== this.lastBoundsWidth ||
      bounds.height !== this.lastBoundsHeight;

    if (needsRebuild) {
      this.clearMesh();
      const geo = new THREE.SphereGeometry(0.08, 12, 12);
      const mat = new THREE.MeshPhysicalMaterial({
        metalness: theme.series[0]?.metalness ?? 0.2,
        roughness: theme.series[0]?.roughness ?? 0.3,
        transparent: opacity < 1,
        opacity,
      });
      this.instancedMesh = new THREE.InstancedMesh(geo, mat, count);
      this.instancedMesh.castShadow = true;
      this.instancedMesh.receiveShadow = false;
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
      this.lastSizeField = sizeField;
      this.lastColorField = colorField;
      this.lastBoundsWidth = bounds.width;
      this.lastBoundsHeight = bounds.height;
      this.lastDataFrame = data;
    }

    if (!this.instancedMesh) return;

    // Compute size values for sizeField encoding
    const sizeValues = sizeField
      ? data.rows.map((r) => Number(r[sizeField]) || 0)
      : null;
    const sizeExtent = sizeValues ? (extent(sizeValues) as [number, number]) : null;
    const [sMin, sMax] = sizeExtent ?? [1, 1];
    const sRange = (sMax - sMin) || 1;
    const maxPointScale = sizeField ? sizeScaleOpts.max : 1;
    const pointRadius = 0.08;
    const seriesDepth = Math.abs(SCATTER_Z_OFFSET) + pointRadius * maxPointScale;

    // Detect colorField type: ordinal (string) vs continuous (number)
    const colorFieldFirstVal = colorField ? data.rows[0]?.[colorField] : undefined;
    const isColorOrdinal = colorField && typeof colorFieldFirstVal === 'string';
    const ordinalColorMap = isColorOrdinal
      ? (() => {
          const uniq = [...new Set(data.rows.map((r) => String(r[colorField!])))];
          return new Map(uniq.map((v, i) => [v, i]));
        })()
      : null;
    const continuousExtent = (!isColorOrdinal && colorField)
      ? (extent(data.rows.map((r) => Number(r[colorField!]) || 0)) as [number, number])
      : null;
    const [cMin, cMax] = continuousExtent ?? [0, 1];
    const cRange = (cMax - cMin) || 1;
    const colorInterp = getInterpolator(colorInterpolator);

    // MorphContext: build from-key → position map for interpolation
    const fromKeyMap = ctx.morphCtx
      ? new Map(
          ctx.morphCtx.fromData.rows.map((r) => [
            String(r[ctx.morphCtx!.keyField]),
            r as Record<string, unknown>,
          ]),
        )
      : null;

    const parsedBaseColor = parseHexColor(theme.series[0]?.color ?? '#00d4ff');
    const baseColor = new THREE.Color(parsedBaseColor.rgb);

    for (let i = 0; i < count; i++) {
      const row = data.rows[i] as Record<string, unknown>;
      let px = xScale(xValues[i]!);
      let py = yScale(yValues[i]!);

      // Morphing
      if (ctx.morphCtx && fromKeyMap) {
        const key = String(row[ctx.morphCtx.keyField]);
        const fromRow = fromKeyMap.get(key);
        if (fromRow) {
          const fromX = ctx.accessors?.xAccessor ? ctx.accessors.xAccessor(fromRow) : (Number(fromRow[xField]) || 0);
          const fromY = ctx.accessors?.yAccessor ? ctx.accessors.yAccessor(fromRow) : (Number(fromRow[yField]) || 0);
          const fromPx = xScale(fromX);
          const fromPy = yScale(fromY);
          px = lerp(fromPx, px, ctx.morphCtx.t);
          py = lerp(fromPy, py, ctx.morphCtx.t);
        }
      }

      // Size encoding — use sizeAccessor when available
      let scale = 1.0;
      if (sizeField && sizeValues && sizeExtent) {
        const rawSize = ctx.accessors?.sizeAccessor
          ? ctx.accessors.sizeAccessor(row)
          : (sizeValues[i]!);
        const normalizedSize = (rawSize - sMin) / sRange;
        scale = sizeScaleOpts.min + normalizedSize * (sizeScaleOpts.max - sizeScaleOpts.min);
      }

      _dummy.position.set(px, py, SCATTER_Z_OFFSET);
      _dummy.scale.set(scale, scale, scale);
      _dummy.updateMatrix();
      this.instancedMesh.setMatrixAt(i, _dummy.matrix);

      // Color encoding
      let color = baseColor;
      if (colorField) {
        if (isColorOrdinal && ordinalColorMap) {
          const colorIdx = ordinalColorMap.get(String(row[colorField])) ?? 0;
          const tokens = theme.series[colorIdx % theme.series.length]!;
          const parsedOrdinal = parseHexColor(tokens.color);
          color = new THREE.Color(parsedOrdinal.rgb);
        } else if (!isColorOrdinal) {
          const rawVal = ctx.accessors?.colorAccessor
            ? Number(ctx.accessors.colorAccessor(row))
            : (Number(row[colorField!]) || 0);
          const normalizedColor = (rawVal - cMin) / cRange;
          const cssColor = colorInterp(Math.max(0, Math.min(1, normalizedColor)));
          color = new THREE.Color(cssColor);
        }
      }
      this.instancedMesh.setColorAt(i, color);
    }

    this.instancedMesh.instanceMatrix.needsUpdate = true;
    if (this.instancedMesh.instanceColor) this.instancedMesh.instanceColor.needsUpdate = true;
    (this.instancedMesh.material as THREE.MeshPhysicalMaterial).opacity = opacity;
    (this.instancedMesh.material as THREE.MeshPhysicalMaterial).transparent = opacity < 1;

    // Axes — V2.1: ticks generated from same xScale/yScale as point positions for alignment
    if (!this.axesRenderer) this.axesRenderer = new AxesRenderer(axesGroup);
    const xTickValues = xScale.ticks(6);
    const xTicks = xTickValues.map((v) => ({
      value: Math.round(v * 100) / 100,
      position: xScale(v) / bounds.width,  // normalized [0..1] — same range as point x positions
    }));
    const yTickValues = yScale.ticks(5);
    const yTicks = yTickValues.map((v) => ({
      value: Math.round(v * 100) / 100,
      position: yScale(v) / bounds.height, // normalized [0..1] — same range as point y positions
    }));
    this.axesRenderer.update({
      xTicks,
      yTicks,
      bounds,
      seriesDepth,
      theme,
      opacity,
      xAxis,
      yAxis,
      fontUrl,
      gridlines: ctx.gridlines,
      fittedMargins: ctx.fittedMargins, // V2.1 — for axis title positioning
    });

    if (!this.legendRenderer) this.legendRenderer = new LegendRenderer(legendGroup);
    this.legendRenderer.update(
      series.length > 0 ? series : [{ field: yField }],
      ctx.legend ?? { visible: true, position: 'right' },
      theme,
      opacity,
      fontUrl,
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
    this.lastSizeField = undefined;
    this.lastColorField = undefined;
    this.lastDataFrame = null;
    this.hitRows.length = 0;
  }

  private reset(): void {
    this.clearMesh();
    this.axesRenderer?.dispose();
    this.legendRenderer?.dispose();
    this.axesRenderer = null;
    this.legendRenderer = null;
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
    const yAxisWorldX = this.cachedChartPositionX + this.cachedPlotFrameOffsetX;

    const meta: ChartHitMeta = {
      kind: 'scatter',
      xValue: Number(row[this.cachedXField]) || 0,
      sizeValue: this.cachedSizeField !== undefined ? (Number(row[this.cachedSizeField]) || undefined) : undefined,
      colorValue: this.cachedColorField !== undefined ? row[this.cachedColorField] as number | string | undefined : undefined,
    };

    return {
      seriesIndex: 0,
      datumIndex: instanceId,
      row,
      point: [p.x, p.y, p.z],
      meta,
      projectionTarget: [yAxisWorldX, p.y, p.z],
    };
  }

  dispose(): void {
    this.reset();
  }
}
