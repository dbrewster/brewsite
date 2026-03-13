// Area chart renderer — THREE.Shape from d3-area boundaries → ExtrudeGeometry; V2 adds stacked areas and band areas.

import * as THREE from 'three';
import { scaleLinear } from 'd3-scale';
import { extent } from 'd3-array';
import { stack, stackOrderNone, stackOffsetNone } from 'd3-shape';
import { lerp } from '@brewsite/core';
import { AxesRenderer } from '../shared/AxesRenderer';
import { LegendRenderer } from '../shared/LegendRenderer';
import { ChartMaterialFactory } from '../shared/ChartMaterialFactory';
import type { IChartRenderer, ChartRenderContext, ChartHitInfo, ChartHitMeta, MorphContext } from '../shared/IChartRenderer';
import type { ResolvedDataFrame } from '../../data/types';

/**
 * Renders area charts as extruded Three.js shapes.
 * V2: reads stackMode and fillOpacity from ctx.typeOptions.
 *     SmartRebuild tracks lastStackMode per Q7 decision.
 *     Stacked mode uses d3-shape.stack() for cumulative layers.
 *     Band areas: series[i].bandField renders area between field (upper) and bandField (lower).
 */
export class AreaRenderer implements IChartRenderer {
  private readonly materialFactory = new ChartMaterialFactory();
  private axesRenderer: AxesRenderer | null = null;
  private legendRenderer: LegendRenderer | null = null;
  private readonly areaMeshes: THREE.Mesh[] = [];
  private seriesGroupRef: THREE.Group | null = null;
  private lastBoundsWidth = -1;
  private lastBoundsHeight = -1;
  private lastDataFrame: ResolvedDataFrame | null = null;
  private cachedChartPositionX = 0;
  private cachedPlotFrameOffsetX = 0;
  private cachedSeries: Array<{ field: string; label?: string }> = [];
  private cachedYField = '';
  /** cachedStackLayers[seriesIndex][datumIndex] = cumulative y1 for stacked mode. */
  private cachedStackLayers: Array<readonly number[]> = [];
  private cachedIsStacked = false;
  private lastDataLength = -1;
  private lastSeriesCount = -1;
  /** Q7: tracks last stackMode to trigger SmartRebuild when it changes. */
  private lastStackMode: 'none' | 'stacked' = 'none';
  private chartPosition: readonly [number, number, number] = [0, 0, 0];

  update(ctx: ChartRenderContext): void {
    const { seriesGroup, axesGroup, legendGroup, data, xAxis, yAxis, series, bounds, theme, opacity, fontUrl } = ctx;
    this.chartPosition = ctx.chartPosition ?? [0, 0, 0];
    this.cachedChartPositionX   = ctx.chartPosition?.[0] ?? 0;
    this.cachedPlotFrameOffsetX = ctx.plotFrameOffset?.x ?? 0;
    this.cachedYField = ctx.yAxis?.field ?? '';

    const areaOptions = ctx.typeOptions.kind === 'area' ? ctx.typeOptions.options : {};
    const stackMode = areaOptions.stackMode ?? 'none';
    const fillOpacity = areaOptions.fillOpacity ?? theme.area?.fillOpacity ?? 0.7;

    const effectiveSeries: Array<{ field: string; label?: string; color?: string; bandField?: string }> = series.length > 0
      ? series.map((s) => ({ ...s }))
      : (yAxis ? [{ field: yAxis.field, label: yAxis.label }] : []);
    this.cachedSeries = effectiveSeries;
    const maxTokenDepth = effectiveSeries.reduce((maxDepth, _series, i) => {
      const tokenDepth = theme.series[i % theme.series.length]?.depth ?? bounds.depth;
      return Math.max(maxDepth, tokenDepth);
    }, 0);
    const seriesZSpacing = stackMode === 'stacked' ? 0.05 : 0.1;
    const seriesDepth = maxTokenDepth + Math.max(0, effectiveSeries.length - 1) * seriesZSpacing;

    this.seriesGroupRef = seriesGroup;

    if (effectiveSeries.length === 0 || data.rows.length < 2) {
      this.reset();
      return;
    }

    const xField = xAxis?.field ?? data.fields[0] ?? 'x';
    const needsRebuild =
      data !== this.lastDataFrame ||
      data.rows.length !== this.lastDataLength ||
      effectiveSeries.length !== this.lastSeriesCount ||
      stackMode !== this.lastStackMode ||
      bounds.width !== this.lastBoundsWidth ||
      bounds.height !== this.lastBoundsHeight ||
      ctx.morphCtx !== undefined; // always rebuild during morph transitions

    if (needsRebuild) {
      this.clearAreas();
      this.cachedIsStacked = stackMode === 'stacked';
      if (stackMode === 'stacked') {
        this.buildStackedAreas(seriesGroup, data, xField, effectiveSeries, bounds, theme, opacity, fillOpacity);
      } else {
        this.cachedStackLayers = [];
        this.buildAreas(seriesGroup, data, xField, effectiveSeries, bounds, theme, opacity, fillOpacity, ctx.morphCtx);
      }
      this.lastDataFrame = data;
      this.lastDataLength = data.rows.length;
      this.lastSeriesCount = effectiveSeries.length;
      this.lastStackMode = stackMode;
      this.lastBoundsWidth = bounds.width;
      this.lastBoundsHeight = bounds.height;
    } else {
      for (const mesh of this.areaMeshes) {
        const mat = mesh.material as THREE.MeshPhysicalMaterial;
        mat.opacity = opacity * fillOpacity;
        mat.transparent = true;
      }
    }

    if (!this.axesRenderer) this.axesRenderer = new AxesRenderer(axesGroup);
    const n = data.rows.length;
    const stride = Math.max(1, Math.floor(n / 6));
    const xTicks: Array<{ value: unknown; position: number }> = [];
    for (let i = 0; i < n; i += stride) {
      xTicks.push({ value: data.rows[i]![xField], position: i / Math.max(1, n - 1) });
    }
    const allValues = data.rows.flatMap((r) =>
      effectiveSeries.map((s) => Number(r[s.field]) || 0),
    );
    const [, yMax] = extent(allValues) as [number, number];
    const yTicks = Array.from({ length: 6 }, (_, i) => ({
      value: Math.round((yMax * i) / 5),
      position: i / 5,
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
      fittedMargins: ctx.fittedMargins,
    });

    if (!this.legendRenderer) this.legendRenderer = new LegendRenderer(legendGroup);
    this.legendRenderer.update(effectiveSeries, ctx.legend ?? { visible: true, position: 'right' }, theme, opacity, fontUrl);
  }

  private buildAreas(
    seriesGroup: THREE.Group,
    data: ResolvedDataFrame,
    xField: string,
    series: Array<{ field: string; label?: string; color?: string; bandField?: string }>,
    bounds: { width: number; height: number; depth: number },
    theme: ChartRenderContext['theme'],
    opacity: number,
    fillOpacity: number,
    morphCtx: MorphContext | undefined,
  ): void {
    this.lastBoundsWidth = bounds.width;

    type Row = Record<string, unknown>;

    // Build O(1) lookup map from fromData rows for morphing — built once per update()
    const morphFromMap: Map<unknown, Row> | null = morphCtx
      ? new Map<unknown, Row>(
          morphCtx.fromData.rows.map((r) => [r[morphCtx.keyField], r as Row]),
        )
      : null;

    const allValues = data.rows.flatMap((r) =>
      series.map((s) => Number(r[s.field]) || 0),
    );
    const [, yMax] = extent(allValues) as [number, number];
    const yScale = scaleLinear().domain([0, yMax]).range([0, bounds.height]);
    const xScale = scaleLinear().domain([0, data.rows.length - 1]).range([0, bounds.width]);

    for (let si = 0; si < series.length; si++) {
      const s = series[si]!;
      const zOffset = si * 0.1;

      const shape = new THREE.Shape();

      if (s.bandField) {
        // Band area: between upper field and lower bandField
        // Upper boundary (left to right)
        const startRow = data.rows[0] as Row;
        const startToUpperY = Number(startRow[s.field]) || 0;
        const startUpperY = (() => {
          if (!morphFromMap || !morphCtx) return startToUpperY;
          const fromRow = morphFromMap.get(startRow[morphCtx.keyField]);
          const fromUpperY = fromRow ? (Number(fromRow[s.field]) || 0) : startToUpperY;
          return lerp(fromUpperY, startToUpperY, morphCtx.t);
        })();
        shape.moveTo(xScale(0), yScale(startUpperY));

        for (let i = 1; i < data.rows.length; i++) {
          const row = data.rows[i] as Row;
          const toUpperY = Number(row[s.field]) || 0;
          const upperY = (() => {
            if (!morphFromMap || !morphCtx) return toUpperY;
            const fromRow = morphFromMap.get(row[morphCtx.keyField]);
            const fromUpperY = fromRow ? (Number(fromRow[s.field]) || 0) : toUpperY;
            return lerp(fromUpperY, toUpperY, morphCtx.t);
          })();
          shape.lineTo(xScale(i), yScale(upperY));
        }
        // Lower boundary (right to left)
        for (let i = data.rows.length - 1; i >= 0; i--) {
          const row = data.rows[i] as Row;
          const toLowerY = Number(row[s.bandField!]) || 0;
          const lowerY = (() => {
            if (!morphFromMap || !morphCtx) return toLowerY;
            const fromRow = morphFromMap.get(row[morphCtx.keyField]);
            const fromLowerY = fromRow ? (Number(fromRow[s.bandField!]) || 0) : toLowerY;
            return lerp(fromLowerY, toLowerY, morphCtx.t);
          })();
          shape.lineTo(xScale(i), yScale(lowerY));
        }
        shape.closePath();
      } else {
        // Standard area: upper boundary + baseline
        shape.moveTo(0, 0);
        for (let i = 0; i < data.rows.length; i++) {
          const x = xScale(i);
          const row = data.rows[i] as Row;
          const toUpperY = Number(row[s.field]) || 0;
          const upperY = (() => {
            if (!morphFromMap || !morphCtx) return toUpperY;
            const fromRow = morphFromMap.get(row[morphCtx.keyField]);
            const fromUpperY = fromRow ? (Number(fromRow[s.field]) || 0) : toUpperY;
            return lerp(fromUpperY, toUpperY, morphCtx.t);
          })();
          shape.lineTo(x, yScale(upperY));
        }
        shape.lineTo(xScale(data.rows.length - 1), 0);
        shape.lineTo(0, 0);
      }

      const tokens = theme.series[si % theme.series.length]!;
      const geo = new THREE.ExtrudeGeometry(shape, {
        depth: tokens.depth,
        bevelEnabled: false,
      });
      const mat = this.materialFactory.getSeriesMaterial(theme, si);
      mat.opacity = opacity * fillOpacity;
      mat.transparent = true;
      const mesh = new THREE.Mesh(geo, mat);
      // Anchor front face at the axis plane and extrude into -Z.
      mesh.position.z = -(tokens.depth + zOffset);
      mesh.castShadow = true;
      mesh.receiveShadow = false;
      seriesGroup.add(mesh);
      this.areaMeshes.push(mesh);
    }
  }

  private buildStackedAreas(
    seriesGroup: THREE.Group,
    data: ResolvedDataFrame,
    xField: string,
    series: Array<{ field: string; label?: string; color?: string }>,
    bounds: { width: number; height: number; depth: number },
    theme: ChartRenderContext['theme'],
    opacity: number,
    fillOpacity: number,
  ): void {
    this.lastBoundsWidth = bounds.width;

    const stackedData = stack<Record<string, unknown>>()
      .keys(series.map((s) => s.field))
      .order(stackOrderNone)
      .offset(stackOffsetNone)(data.rows as Array<Record<string, unknown>>);

    const totalByRow = data.rows.map((r) =>
      series.reduce((sum, s) => sum + (Number(r[s.field]) || 0), 0),
    );
    const maxTotal = (extent(totalByRow) as [number, number])[1] ?? 1;
    const yScale = scaleLinear().domain([0, maxTotal]).range([0, bounds.height]);
    const xScale = scaleLinear().domain([0, data.rows.length - 1]).range([0, bounds.width]);

    this.cachedStackLayers = [];
    for (let si = 0; si < stackedData.length; si++) {
      const layer = stackedData[si]!;
      // Cache cumulative top (y1) values per datum for resolveHoverInfo
      this.cachedStackLayers[si] = layer.map((d) => d[1]);
      const shape = new THREE.Shape();

      // Upper boundary (left to right): y1 values
      const firstDatum = layer[0]!;
      shape.moveTo(xScale(0), yScale(firstDatum[0]));
      for (let i = 0; i < layer.length; i++) {
        shape.lineTo(xScale(i), yScale(layer[i]![1]));
      }
      // Lower boundary (right to left): y0 values
      for (let i = layer.length - 1; i >= 0; i--) {
        shape.lineTo(xScale(i), yScale(layer[i]![0]));
      }
      shape.closePath();

      const tokens = theme.series[si % theme.series.length]!;
      const geo = new THREE.ExtrudeGeometry(shape, {
        depth: tokens.depth,
        bevelEnabled: false,
      });
      const mat = this.materialFactory.getSeriesMaterial(theme, si);
      mat.opacity = opacity * fillOpacity;
      mat.transparent = true;
      const mesh = new THREE.Mesh(geo, mat);
      // Anchor front face at the axis plane and extrude into -Z.
      mesh.position.z = -(tokens.depth + si * 0.05);
      mesh.castShadow = true;
      mesh.receiveShadow = false;
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
    this.lastDataFrame = null;
    this.lastDataLength = -1;
    this.lastSeriesCount = -1;
  }

  private reset(): void {
    this.clearAreas();
    this.axesRenderer?.dispose();
    this.legendRenderer?.dispose();
    this.axesRenderer = null;
    this.legendRenderer = null;
  }

  getInteractiveObjects(): THREE.Object3D[] {
    return this.areaMeshes;
  }

  resolveHoverInfo(intersection: THREE.Intersection, data: ResolvedDataFrame): ChartHitInfo | null {
    const meshIndex = this.areaMeshes.indexOf(intersection.object as THREE.Mesh);
    if (meshIndex < 0) return null;
    if (data.rows.length === 0) return null;

    // X coordinate maps linearly to data index
    const localX =
      intersection.point.x -
      this.chartPosition[0] -
      (this.seriesGroupRef?.position.x ?? 0);
    const normalizedX = localX / this.lastBoundsWidth;
    const datumIndex = Math.round(
      Math.max(0, Math.min(1, normalizedX)) * (data.rows.length - 1)
    );
    const row = (data.rows[datumIndex] ?? {}) as Record<string, unknown>;

    const yValue = Number(row[this.cachedYField]) || 0;
    const stackValue = this.cachedIsStacked
      ? (this.cachedStackLayers[meshIndex]?.[datumIndex])
      : undefined;
    const seriesLabel = this.cachedSeries[meshIndex]?.label
      ?? this.cachedSeries[meshIndex]?.field
      ?? `Series ${meshIndex}`;
    const meta: ChartHitMeta = { kind: 'area', seriesLabel, yValue, stackValue };

    const worldP = intersection.point;
    const yAxisWorldX = this.cachedChartPositionX + this.cachedPlotFrameOffsetX;

    return {
      seriesIndex: meshIndex,
      datumIndex,
      row,
      point: [worldP.x, worldP.y, worldP.z],
      meta,
      projectionTarget: [yAxisWorldX, worldP.y, worldP.z],
    };
  }

  dispose(): void {
    this.reset();
    this.materialFactory.dispose();
  }
}
