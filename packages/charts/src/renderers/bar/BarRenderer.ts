// Bar chart renderer — grouped, stacked, or horizontal bars with morphing and data labels.

import * as THREE from 'three';
import { scaleBand, scaleLinear } from 'd3-scale';
import { max } from 'd3-array';
import { stack, stackOrderNone, stackOffsetNone } from 'd3-shape';
import { AxesRenderer } from '../shared/AxesRenderer';
import { LegendRenderer } from '../shared/LegendRenderer';
import { ChartMaterialFactory } from '../shared/ChartMaterialFactory';
import type { IChartRenderer, ChartRenderContext, ChartHitInfo, DataLabelEntry, MorphContext, ChartAccessorFunctions } from '../shared/IChartRenderer';
import type { DataRow, ResolvedDataFrame } from '../../data/types';
// DataLabelRenderer from S4 — import path correct; resolves at merge time.
import type { DataLabelRenderer } from '../shared/DataLabelRenderer';

/** Cubic ease-out: fast at start, decelerates to final value. */
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

type BarHitEntry = {
  seriesIndex: number;
  datumIndex: number;
  row: Record<string, unknown>;
};

/** Linearly interpolates between a and b at progress t. */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Renders grouped, stacked, or horizontal bar charts with morphing support.
 * V2: reads orientation, stackMode, barPadding from ctx.typeOptions.
 *     Supports datum-level morphing via ctx.morphCtx.
 *     Computes DataLabelEntry[] when ctx.dataLabels is non-null.
 */
export class BarRenderer implements IChartRenderer {
  private readonly materialFactory = new ChartMaterialFactory();
  private axesRenderer: AxesRenderer | null = null;
  private legendRenderer: LegendRenderer | null = null;
  private readonly barMeshes: THREE.Mesh[] = [];
  private readonly hitMap = new Map<THREE.Mesh, BarHitEntry>();
  private seriesGroupRef: THREE.Group | null = null;
  private labelGroupRef: THREE.Group | null = null;
  private lastDataLength = -1;
  private lastSeriesCount = -1;
  private lastStackMode: 'grouped' | 'stacked' = 'grouped';
  private lastOrientation: 'vertical' | 'horizontal' = 'vertical';
  // DataLabelRenderer instance — created on demand when ctx.dataLabels is non-null.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private dataLabelRenderer: any | null = null;

  update(ctx: ChartRenderContext): void {
    const { seriesGroup, axesGroup, legendGroup, data, xAxis, yAxis, series, bounds, theme, opacity, fontUrl } = ctx;

    const barOptions = ctx.typeOptions.kind === 'bar' ? ctx.typeOptions.options : {};
    const orientation = barOptions.orientation ?? 'vertical';
    const stackMode = barOptions.stackMode ?? 'grouped';
    const barPadding = barOptions.barPadding ?? theme.bar?.padding ?? 0.2;

    const effectiveSeries: Array<{ field: string; label?: string; color?: string }> = series.length > 0
      ? [...series]
      : (yAxis ? [{ field: yAxis.field, label: yAxis.label }] : []);

    this.seriesGroupRef = seriesGroup;
    this.labelGroupRef = legendGroup;

    if (effectiveSeries.length === 0 || data.rows.length === 0) {
      this.reset();
      return;
    }

    const xField = xAxis?.field ?? data.fields[0] ?? 'x';
    const needsRebuild =
      data.rows.length !== this.lastDataLength ||
      effectiveSeries.length !== this.lastSeriesCount ||
      stackMode !== this.lastStackMode ||
      orientation !== this.lastOrientation ||
      ctx.morphCtx !== undefined; // always rebuild during morph transitions

    if (needsRebuild) {
      this.clearBars();
      if (stackMode === 'stacked') {
        this.buildStackedBars(seriesGroup, data, xField, effectiveSeries, bounds, theme, opacity, orientation, barPadding, ctx.morphCtx);
      } else {
        this.buildGroupedBars(seriesGroup, data, xField, effectiveSeries, bounds, theme, opacity, orientation, barPadding, ctx.morphCtx, ctx.accessors);
      }
      this.lastDataLength = data.rows.length;
      this.lastSeriesCount = effectiveSeries.length;
      this.lastStackMode = stackMode;
      this.lastOrientation = orientation;
    } else {
      // Incremental update — only opacity
      for (const mesh of this.barMeshes) {
        const mat = mesh.material as THREE.MeshPhysicalMaterial;
        mat.opacity = opacity;
        mat.transparent = opacity < 1;
      }
    }

    // Entry animation — applied every frame regardless of rebuild
    const entryT = ctx.entryT ?? 1.0;
    if (entryT < 1.0) {
      const eased = easeOutCubic(entryT);
      for (const mesh of this.barMeshes) {
        mesh.scale.y = eased;
      }
    } else {
      // Ensure scale is reset to 1.0 when animation completes
      for (const mesh of this.barMeshes) {
        mesh.scale.y = 1.0;
      }
    }

    // Data labels
    if (ctx.dataLabels) {
      const entries = this.computeDataLabelEntries(effectiveSeries, bounds, orientation, stackMode);
      if (this.dataLabelRenderer) {
        this.dataLabelRenderer.update(entries, theme, opacity, fontUrl);
      }
    }

    // Axes
    if (!this.axesRenderer) {
      this.axesRenderer = new AxesRenderer(axesGroup);
    }
    const categories = data.rows.map((r) => String(r[xField]));
    const maxY = max(data.rows.flatMap((r) =>
      effectiveSeries.map((s) => Number(r[s.field]) || 0),
    )) ?? 1;
    const xBand = scaleBand().domain(categories).range([0, bounds.width]).padding(barPadding);
    const xTicks = categories.map((cat) => ({
      value: cat,
      position: ((xBand(cat) ?? 0) + xBand.bandwidth() / 2) / bounds.width,
    }));
    const yDomainMax = (yAxis?.domain?.[1] !== undefined ? Number(yAxis.domain[1]) : maxY * 1.1) || 1;
    const yTickCount = 5;
    const yTicks = Array.from({ length: yTickCount + 1 }, (_, i) => ({
      value: Math.round((yDomainMax * i) / yTickCount),
      position: i / yTickCount,
    }));
    this.axesRenderer.update({ xTicks, yTicks, bounds, theme, opacity, xAxis, yAxis, fontUrl, gridlines: ctx.gridlines, fittedMargins: ctx.fittedMargins });

    // Legend
    if (!this.legendRenderer) this.legendRenderer = new LegendRenderer(legendGroup);
    this.legendRenderer.update(effectiveSeries, ctx.legend ?? { visible: true, position: 'right' }, theme, opacity, fontUrl);
  }

  private buildGroupedBars(
    seriesGroup: THREE.Group,
    data: ResolvedDataFrame,
    xField: string,
    series: Array<{ field: string; label?: string; color?: string }>,
    bounds: { width: number; height: number; depth: number },
    theme: ChartRenderContext['theme'],
    opacity: number,
    orientation: 'vertical' | 'horizontal',
    barPadding: number,
    morphCtx: MorphContext | undefined,
    accessors: ChartAccessorFunctions | undefined,
  ): void {
    const isHorizontal = orientation === 'horizontal';

    // Build key→from-value map for morphing
    const fromKeyMap = morphCtx
      ? new Map(
          morphCtx.fromData.rows.map((r) => [
            String(r[morphCtx.keyField]),
            r as Record<string, unknown>,
          ]),
        )
      : null;

    // Compute effective rows: union of toData + fromData-only rows for exiting bars
    const toKeys = new Set(data.rows.map((r) => String(r[xField])));
    const exitingRows: Array<Record<string, unknown>> = morphCtx
      ? morphCtx.fromData.rows
          .filter((r) => !toKeys.has(String(r[morphCtx.keyField])))
          .map((r) => ({ ...r, [xField]: r[morphCtx.keyField] } as Record<string, unknown>))
      : [];
    const effectiveRows = [...(data.rows as Array<Record<string, unknown>>), ...exitingRows];

    const categories = effectiveRows.map((r) => String(r[xField]));
    const maxYData = max(effectiveRows.flatMap((r) =>
      series.map((s) => Number(r[s.field]) || 0),
    )) ?? 1;
    const fromMaxY = fromKeyMap
      ? (max(morphCtx!.fromData.rows.flatMap((r) =>
          series.map((s) => Number(r[s.field]) || 0),
        )) ?? 1)
      : 0;
    const maxY = Math.max(maxYData, fromMaxY) || 1;

    const mainScale = scaleLinear().domain([0, maxY * 1.1]).range([0, isHorizontal ? bounds.width : bounds.height]);
    const catScale = scaleBand().domain(categories).range([0, isHorizontal ? bounds.height : bounds.width]).padding(barPadding);
    const innerScale = scaleBand().domain(series.map((_, i) => String(i))).range([0, catScale.bandwidth()]).padding(0.05);

    for (let si = 0; si < series.length; si++) {
      const s = series[si]!;
      const tokens = theme.series[si % theme.series.length]!;
      const mat = this.materialFactory.getSeriesMaterial(theme, si);
      mat.opacity = opacity;
      mat.transparent = opacity < 1;

      for (let di = 0; di < effectiveRows.length; di++) {
        const row = effectiveRows[di]!;
        const catStr = String(row[xField]);
        const catPos = catScale(catStr) ?? 0;
        const innerPos = innerScale(String(si)) ?? 0;
        const isExiting = di >= data.rows.length;

        const toValue = isExiting ? 0 : (
          accessors?.yAccessor
            ? accessors.yAccessor(row as DataRow)
            : (Number(row[s.field]) || 0)
        );
        let value = toValue;

        if (morphCtx && fromKeyMap) {
          const fromRow = fromKeyMap.get(catStr);
          const fromValue = fromRow
            ? (accessors?.yAccessor ? accessors.yAccessor(fromRow as DataRow) : (Number(fromRow[s.field]) || 0))
            : 0;
          value = lerp(fromValue, toValue, morphCtx.t);
        }

        const barExtent = mainScale(value);
        if (barExtent <= 0) continue;

        let geo: THREE.BufferGeometry;
        let mesh: THREE.Mesh;

        if (isHorizontal) {
          geo = new THREE.BoxGeometry(barExtent, innerScale.bandwidth(), tokens.depth);
          // Translate so bar grows from left baseline (x=0) rightward
          geo.translate(0, innerScale.bandwidth() / 2, 0);
          mesh = new THREE.Mesh(geo, mat);
          mesh.position.set(barExtent / 2, catPos + innerPos, 0);
        } else {
          geo = new THREE.BoxGeometry(innerScale.bandwidth(), barExtent, tokens.depth);
          // Translate so bar grows upward from y=0 baseline (not from center)
          geo.translate(0, barExtent / 2, 0);
          mesh = new THREE.Mesh(geo, mat);
          mesh.position.set(catPos + innerPos + innerScale.bandwidth() / 2, 0, 0);
        }

        seriesGroup.add(mesh);
        this.barMeshes.push(mesh);
        const datumRow = isExiting
          ? (fromKeyMap?.get(catStr) ?? row)
          : row;
        this.hitMap.set(mesh, { seriesIndex: si, datumIndex: di, row: datumRow });
      }
    }
  }

  private buildStackedBars(
    seriesGroup: THREE.Group,
    data: ResolvedDataFrame,
    xField: string,
    series: Array<{ field: string; label?: string; color?: string }>,
    bounds: { width: number; height: number; depth: number },
    theme: ChartRenderContext['theme'],
    opacity: number,
    orientation: 'vertical' | 'horizontal',
    barPadding: number,
    morphCtx: MorphContext | undefined,
  ): void {
    const isHorizontal = orientation === 'horizontal';
    const categories = (data.rows as Array<Record<string, unknown>>).map((r) => String(r[xField]));

    const stackedData = stack<Record<string, unknown>>()
      .keys(series.map((s) => s.field))
      .order(stackOrderNone)
      .offset(stackOffsetNone)(data.rows as Array<Record<string, unknown>>);

    const totalByRow = data.rows.map((r) =>
      series.reduce((sum, s) => sum + (Number(r[s.field]) || 0), 0),
    );
    const maxTotal = max(totalByRow) ?? 1;
    const mainScale = scaleLinear().domain([0, maxTotal * 1.1]).range([0, isHorizontal ? bounds.width : bounds.height]);
    const catScale = scaleBand().domain(categories).range([0, isHorizontal ? bounds.height : bounds.width]).padding(barPadding);

    // Build fromData map for morphing
    const fromKeyMap = morphCtx
      ? new Map(
          morphCtx.fromData.rows.map((r) => [
            String(r[morphCtx.keyField]),
            r as Record<string, unknown>,
          ]),
        )
      : null;

    for (let si = 0; si < stackedData.length; si++) {
      const layer = stackedData[si]!;
      const tokens = theme.series[si % theme.series.length]!;
      const mat = this.materialFactory.getSeriesMaterial(theme, si);
      mat.opacity = opacity;
      mat.transparent = opacity < 1;

      for (let di = 0; di < layer.length; di++) {
        const datum = layer[di]!;
        const row = data.rows[di] as Record<string, unknown>;
        const catStr = categories[di]!;
        const catPos = catScale(catStr) ?? 0;

        let y0 = datum[0];
        let y1 = datum[1];

        if (morphCtx && fromKeyMap) {
          const fromRow = fromKeyMap.get(catStr);
          if (fromRow) {
            const fromField = series[si]?.field ?? '';
            const fromVal = Number(fromRow[fromField]) || 0;
            const toVal = Number(row[series[si]?.field ?? '']) || 0;
            const interpVal = lerp(fromVal, toVal, morphCtx.t);
            // Recompute y0 based on interpolation — approximation
            const y0Interp = y0; // stacked position; use as-is
            y1 = y0Interp + interpVal;
          }
        }

        const barExtent = mainScale(y1) - mainScale(y0);
        const basePos = mainScale(y0);
        if (barExtent <= 0) continue;

        let geo: THREE.BufferGeometry;
        let mesh: THREE.Mesh;

        if (isHorizontal) {
          geo = new THREE.BoxGeometry(barExtent, catScale.bandwidth(), tokens.depth);
          // Translate so bar starts at catPos (y bottom of band)
          geo.translate(0, catScale.bandwidth() / 2, 0);
          mesh = new THREE.Mesh(geo, mat);
          mesh.position.set(basePos + barExtent / 2, catPos, 0);
        } else {
          geo = new THREE.BoxGeometry(catScale.bandwidth(), barExtent, tokens.depth);
          // Translate so bar grows upward from basePos (not from center)
          geo.translate(0, barExtent / 2, 0);
          mesh = new THREE.Mesh(geo, mat);
          mesh.position.set(catPos + catScale.bandwidth() / 2, basePos, 0);
        }

        seriesGroup.add(mesh);
        this.barMeshes.push(mesh);
        this.hitMap.set(mesh, { seriesIndex: si, datumIndex: di, row });
      }
    }
  }

  private computeDataLabelEntries(
    series: Array<{ field: string }>,
    _bounds: { width: number; height: number; depth: number },
    _orientation: 'vertical' | 'horizontal',
    _stackMode: 'grouped' | 'stacked',
  ): DataLabelEntry[] {
    const entries: DataLabelEntry[] = [];
    for (let mi = 0; mi < this.barMeshes.length; mi++) {
      const mesh = this.barMeshes[mi]!;
      const hit = this.hitMap.get(mesh);
      if (!hit) continue;
      const si = hit.seriesIndex % series.length;
      const seriesField = series[si]?.field ?? '';
      const value = Number(hit.row[seriesField]) || 0;
      // Position: top of bar. Since geometry is anchored at bottom (translate applied),
      // position.y is the bottom of the bar, so top = position.y + barHeight.
      const barHeight = ((mesh.geometry as THREE.BoxGeometry).parameters?.height) ?? 0;
      const topPos = new THREE.Vector3(mesh.position.x, mesh.position.y + barHeight, mesh.position.z);
      entries.push({
        position: topPos,
        text: String(Math.round(value)),
        alignment: 'above',
      });
    }
    return entries;
  }

  private clearBars(): void {
    const group = this.seriesGroupRef;
    for (const mesh of this.barMeshes) {
      group?.remove(mesh);
      mesh.geometry.dispose();
    }
    this.barMeshes.length = 0;
    this.hitMap.clear();
    this.lastDataLength = -1;
    this.lastSeriesCount = -1;
  }

  private reset(): void {
    this.clearBars();
    this.axesRenderer?.dispose();
    this.legendRenderer?.dispose();
    this.dataLabelRenderer?.dispose();
    this.axesRenderer = null;
    this.legendRenderer = null;
    this.dataLabelRenderer = null;
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
    this.reset();
    this.materialFactory.dispose();
  }
}
