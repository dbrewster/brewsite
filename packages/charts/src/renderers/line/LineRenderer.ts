// Line chart renderer — extruded profile shapes swept along a CatmullRom curve; V2 adds showPoints and reference lines.

import * as THREE from 'three';
import { scaleLinear } from 'd3-scale';
import { extent } from 'd3-array';
import { parseHexColor, lerp } from '@brewsite/core';
import { AxesRenderer } from '../shared/AxesRenderer';
import { LegendRenderer } from '../shared/LegendRenderer';
import { ChartMaterialFactory } from '../shared/ChartMaterialFactory';
import type { IChartRenderer, ChartRenderContext, ChartHitInfo, ChartHitMeta, MorphContext, ChartAccessorFunctions } from '../shared/IChartRenderer';
import type { DataRow, ResolvedDataFrame } from '../../data/types';
import type { ChartLineShape } from '../../elements/chart/types';

/**
 * Renders line charts as CatmullRom spline tubes in Three.js.
 * V2: reads lineShape/lineSmoothness/lineSubdivisions/showPoints from ctx.typeOptions.
 *     Multi-series lines offset along Z.
 *     Renders reference lines as THREE.Line objects.
 *     Adds sphere point markers when showPoints is enabled.
 */
export class LineRenderer implements IChartRenderer {
  private readonly materialFactory = new ChartMaterialFactory();
  private axesRenderer: AxesRenderer | null = null;
  private legendRenderer: LegendRenderer | null = null;
  private readonly profileMeshes: THREE.Mesh[] = [];
  private readonly lineObjects: THREE.Line[] = [];
  private readonly pointMeshes: THREE.Mesh[] = [];
  private readonly referenceLineObjects: THREE.Line[] = [];
  private readonly seriesPoints: THREE.Vector3[][] = [];
  private seriesGroupRef: THREE.Group | null = null;
  private axesGroupRef: THREE.Group | null = null;
  private lastDataFrame: ResolvedDataFrame | null = null;
  private cachedChartPositionX = 0;
  private cachedPlotFrameOffsetX = 0;
  private cachedSeries: Array<{ field: string; label?: string }> = [];
  private cachedYField = '';
  private lastDataLength = -1;
  private lastSeriesCount = -1;
  private lastLineShape: ChartLineShape | null = null;
  private lastLineSmoothness = -1;
  private lastLineSubdivisions = -1;
  private lastShowPoints = false;
  private lastBoundsWidth = -1;
  private lastBoundsHeight = -1;
  private chartPosition: readonly [number, number, number] = [0, 0, 0];

  update(ctx: ChartRenderContext): void {
    const { seriesGroup, axesGroup, legendGroup, data, xAxis, yAxis, series, bounds, theme, opacity, fontUrl } = ctx;
    this.chartPosition = ctx.chartPosition ?? [0, 0, 0];
    this.seriesGroupRef = seriesGroup;
    this.axesGroupRef = axesGroup;
    this.cachedChartPositionX   = ctx.chartPosition?.[0] ?? 0;
    this.cachedPlotFrameOffsetX = ctx.plotFrameOffset?.x ?? 0;
    this.cachedYField = ctx.yAxis?.field ?? '';

    const lineOptions = ctx.typeOptions.kind === 'line' ? ctx.typeOptions.options : {};
    const lineShape: ChartLineShape = lineOptions.lineShape ?? theme.line.shape;
    const lineSmoothness = this.clampSmoothness(lineOptions.lineSmoothness ?? theme.line.smoothness);
    const lineSubdivisions = this.clampSubdivisions(lineOptions.lineSubdivisions ?? theme.line.subdivisions);
    const showPoints = lineOptions.showPoints ?? false;

    const effectiveSeries: Array<{ field: string; label?: string; color?: string }> = series.length > 0
      ? [...series]
      : (yAxis ? [{ field: yAxis.field, label: yAxis.label }] : []);
    this.cachedSeries = effectiveSeries;
    const profileRadius = lineShape === 'line' ? (showPoints ? 0.04 : 0) : 0.03;
    const seriesDepth = 0.05 + Math.max(0, effectiveSeries.length - 1) * 0.15 + profileRadius;

    if (effectiveSeries.length === 0 || data.rows.length < 2) {
      this.reset();
      return;
    }

    const xField = xAxis?.field ?? data.fields[0] ?? 'x';
    const needsRebuild =
      data !== this.lastDataFrame ||
      data.rows.length !== this.lastDataLength ||
      effectiveSeries.length !== this.lastSeriesCount ||
      lineShape !== this.lastLineShape ||
      lineSmoothness !== this.lastLineSmoothness ||
      lineSubdivisions !== this.lastLineSubdivisions ||
      showPoints !== this.lastShowPoints ||
      bounds.width !== this.lastBoundsWidth ||
      bounds.height !== this.lastBoundsHeight ||
      ctx.morphCtx !== undefined; // always rebuild during morph transitions

    if (needsRebuild) {
      this.clearProfiles();
      this.buildLines(seriesGroup, data, xField, effectiveSeries, bounds, theme, opacity, lineShape, lineSmoothness, lineSubdivisions, showPoints, ctx.morphCtx, ctx.accessors);
      this.lastDataLength = data.rows.length;
      this.lastSeriesCount = effectiveSeries.length;
      this.lastLineShape = lineShape;
      this.lastLineSmoothness = lineSmoothness;
      this.lastLineSubdivisions = lineSubdivisions;
      this.lastShowPoints = showPoints;
      this.lastBoundsWidth = bounds.width;
      this.lastBoundsHeight = bounds.height;
      this.lastDataFrame = data;
    } else {
      this.updateOpacity(opacity);
    }

    // Reference lines
    this.updateReferenceLines(ctx, axesGroup, data, xField, effectiveSeries, bounds, theme, opacity);

    // Axes
    if (!this.axesRenderer) this.axesRenderer = new AxesRenderer(axesGroup);
    const n = data.rows.length;
    const tickStep = Math.max(1, Math.floor(n / 6));
    const xTicks = data.rows
      .flatMap((r, i) => (
        i % tickStep === 0
          ? [{ value: r[xField], position: i / Math.max(1, n - 1) }]
          : []
      ));
    const allValues = data.rows.flatMap((r) =>
      effectiveSeries.map((s) => Number(r[s.field]) || 0),
    );
    const [yMin, yMax] = extent(allValues) as [number, number];
    const yRange = yMax - yMin || 1;
    const yTicks = Array.from({ length: 6 }, (_, i) => ({
      value: Math.round(yMin + (yRange * i) / 5),
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

  private buildLines(
    seriesGroup: THREE.Group,
    data: ResolvedDataFrame,
    xField: string,
    series: Array<{ field: string; label?: string; color?: string }>,
    bounds: { width: number; height: number; depth: number },
    theme: ChartRenderContext['theme'],
    opacity: number,
    lineShape: ChartLineShape,
    lineSmoothness: number,
    lineSubdivisions: number,
    showPoints: boolean,
    morphCtx: MorphContext | undefined,
    accessors: ChartAccessorFunctions | undefined,
  ): void {
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
    const [yMin, yMax] = extent(allValues) as [number, number];
    const yScale = scaleLinear().domain([yMin, yMax]).range([0, bounds.height]);
    const xScale = scaleLinear().domain([0, data.rows.length - 1]).range([0, bounds.width]);

    for (let si = 0; si < series.length; si++) {
      const s = series[si]!;
      const zOffset = -0.05 - si * 0.15;
      const points = data.rows.map((r, i) => {
        // Resolve Y value: check accessor first, then field name
        const toY = accessors?.yAccessor
          ? accessors.yAccessor(r as DataRow)
          : (Number((r as Row)[s.field]) || 0);

        // Apply morphing via O(1) Map lookup
        const yValue = (() => {
          if (!morphFromMap || !morphCtx) return toY;
          const fromRow = morphFromMap.get((r as Row)[morphCtx.keyField]);
          const fromY = fromRow ? (Number(fromRow[s.field]) || 0) : toY;
          return lerp(fromY, toY, morphCtx.t);
        })();

        const y = yScale(yValue);
        return new THREE.Vector3(xScale(i), y, zOffset);
      });

      this.seriesPoints.push([...points]);

      const curve = this.createCurve(points, lineSmoothness);
      const spans = Math.max(1, points.length - 1);
      const segments = Math.max(12, spans * lineSubdivisions);
      if (lineShape === 'line') {
        const linePoints = curve.getPoints(segments);
        const geo = new THREE.BufferGeometry().setFromPoints(linePoints);
        const tokens = theme.series[si % theme.series.length]!;
        const parsedLineColor = parseHexColor(tokens.color);
        const mat = new THREE.LineBasicMaterial({
          color: new THREE.Color(parsedLineColor.rgb),
          transparent: (opacity * parsedLineColor.alpha) < 1,
          opacity: opacity * parsedLineColor.alpha,
        });
        const line = new THREE.Line(geo, mat);
        seriesGroup.add(line);
        this.lineObjects.push(line);
      } else {
        const geo = new THREE.ExtrudeGeometry(this.createProfileShape(lineShape), {
          extrudePath: curve,
          steps: segments,
          bevelEnabled: false,
        });
        const mat = this.materialFactory.getSeriesMaterial(theme, si, { flatShading: lineShape !== 'circle' });
        mat.opacity = opacity;
        mat.transparent = opacity < 1;
        mat.needsUpdate = true;
        const mesh = new THREE.Mesh(geo, mat);
        mesh.castShadow = true;
        mesh.receiveShadow = false;
        seriesGroup.add(mesh);
        this.profileMeshes.push(mesh);
      }

      // Show-points spheres
      if (showPoints) {
        const sphereGeo = new THREE.SphereGeometry(0.04, 8, 8);
        const tokens = theme.series[si % theme.series.length]!;
        const parsedPointColor = parseHexColor(tokens.color);
        for (const pt of points) {
          const pointOpacity = opacity * parsedPointColor.alpha;
          const mat = new THREE.MeshPhysicalMaterial({
            color: new THREE.Color(parsedPointColor.rgb),
            metalness: tokens.metalness,
            roughness: tokens.roughness,
            transparent: pointOpacity < 1,
            opacity: pointOpacity,
          });
          const sphere = new THREE.Mesh(sphereGeo, mat);
          sphere.position.copy(pt);
          sphere.castShadow = true;
          sphere.receiveShadow = false;
          seriesGroup.add(sphere);
          this.pointMeshes.push(sphere);
        }
      }
    }
  }

  private updateReferenceLines(
    ctx: ChartRenderContext,
    axesGroup: THREE.Group,
    data: ResolvedDataFrame,
    xField: string,
    series: Array<{ field: string }>,
    bounds: { width: number; height: number; depth: number },
    theme: ChartRenderContext['theme'],
    opacity: number,
  ): void {
    // Clear previous reference lines
    for (const line of this.referenceLineObjects) {
      axesGroup.remove(line);
      line.geometry.dispose();
      (line.material as THREE.Material).dispose();
    }
    this.referenceLineObjects.length = 0;

    if (!ctx.referenceLines || ctx.referenceLines.length === 0) return;

    const allValues = data.rows.flatMap((r) =>
      series.map((s) => Number(r[s.field]) || 0),
    );
    const [yMin, yMax] = extent(allValues) as [number, number];
    const yRange = yMax - yMin || 1;
    const yScale = scaleLinear().domain([yMin, yMax]).range([0, bounds.height]);
    const n = data.rows.length;
    const xScale = scaleLinear().domain([0, n - 1]).range([0, bounds.width]);

    for (const refLine of ctx.referenceLines) {
      const parsedRefColor = parseHexColor(refLine.color ?? theme.axis.lineColor);
      const color = new THREE.Color(parsedRefColor.rgb);
      const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: opacity * 0.8 * parsedRefColor.alpha });
      let points: THREE.Vector3[];

      if (refLine.axis === 'y') {
        const scaledValue = yRange > 0 ? yScale(refLine.value) : (refLine.value / (yMax || 1)) * bounds.height;
        points = [
          new THREE.Vector3(0, scaledValue, 0),
          new THREE.Vector3(bounds.width, scaledValue, 0),
        ];
      } else {
        const scaledValue = n > 1 ? xScale(refLine.value) : (refLine.value / ((n - 1) || 1)) * bounds.width;
        points = [
          new THREE.Vector3(scaledValue, 0, 0),
          new THREE.Vector3(scaledValue, bounds.height, 0),
        ];
      }

      const geo = new THREE.BufferGeometry().setFromPoints(points);
      const line = new THREE.Line(geo, mat);
      axesGroup.add(line);
      this.referenceLineObjects.push(line);
    }
  }

  private clearProfiles(): void {
    const group = this.seriesGroupRef;
    for (const mesh of this.profileMeshes) {
      group?.remove(mesh);
      mesh.geometry.dispose();
    }
    for (const line of this.lineObjects) {
      group?.remove(line);
      line.geometry.dispose();
      (line.material as THREE.Material).dispose();
    }
    for (const sphere of this.pointMeshes) {
      group?.remove(sphere);
      sphere.geometry.dispose();
      (sphere.material as THREE.Material).dispose();
    }
    this.profileMeshes.length = 0;
    this.lineObjects.length = 0;
    this.pointMeshes.length = 0;
    this.seriesPoints.length = 0;
    this.lastDataFrame = null;
    this.lastDataLength = -1;
    this.lastSeriesCount = -1;
    this.lastLineShape = null;
    this.lastLineSmoothness = -1;
    this.lastLineSubdivisions = -1;
    this.lastShowPoints = false;
  }

  private reset(): void {
    this.clearProfiles();
    // Clear reference lines
    const axesGroup = this.axesGroupRef;
    for (const line of this.referenceLineObjects) {
      axesGroup?.remove(line);
      line.geometry.dispose();
      (line.material as THREE.Material).dispose();
    }
    this.referenceLineObjects.length = 0;
    this.axesRenderer?.dispose();
    this.legendRenderer?.dispose();
    this.axesRenderer = null;
    this.legendRenderer = null;
  }

  private createCurve(
    points: THREE.Vector3[],
    smoothness: number,
  ): THREE.CatmullRomCurve3 {
    if (points.length < 2) {
      return new THREE.CatmullRomCurve3(points, false, 'catmullrom', smoothness);
    }

    // Duplicate endpoints to flatten entry/exit tangents so the rendered line
    // sits closer to the axes at the chart edges.
    const paddedPoints = [
      points[0]!.clone(),
      ...points,
      points[points.length - 1]!.clone(),
    ];
    return new THREE.CatmullRomCurve3(paddedPoints, false, 'catmullrom', smoothness);
  }

  private createProfileShape(shape: Exclude<ChartLineShape, 'line'>): THREE.Shape {
    const radius = 0.03;
    if (shape === 'circle') {
      const circle = new THREE.Shape();
      circle.absarc(0, 0, radius, 0, Math.PI * 2, false);
      return circle;
    }

    const sides = this.getProfileSides(shape);
    const polygon = new THREE.Shape();
    const angleOffset = this.getProfileAngleOffset(sides);
    for (let i = 0; i < sides; i++) {
      const angle = angleOffset + (i / sides) * Math.PI * 2;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      if (i === 0) polygon.moveTo(x, y);
      else polygon.lineTo(x, y);
    }
    polygon.closePath();
    return polygon;
  }

  private clampSmoothness(value: number): number {
    return Math.max(0, Math.min(1, value));
  }

  private clampSubdivisions(value: number): number {
    return Math.max(1, Math.round(value));
  }

  private getProfileSides(shape: Exclude<ChartLineShape, 'line'>): number {
    switch (shape) {
      case 'triangle': return 3;
      case 'hexagon': return 6;
      case 'heptagon': return 7;
      case 'octagon': return 8;
      case 'circle':
      default:
        return 16;
    }
  }

  private getProfileAngleOffset(sides: number): number {
    return Math.PI / sides;
  }

  private updateOpacity(opacity: number): void {
    for (const mesh of this.profileMeshes) {
      const mat = mesh.material as THREE.MeshPhysicalMaterial;
      mat.opacity = opacity;
      mat.transparent = opacity < 1;
    }
    for (const line of this.lineObjects) {
      const mat = line.material as THREE.LineBasicMaterial;
      mat.opacity = opacity;
      mat.transparent = opacity < 1;
    }
    for (const sphere of this.pointMeshes) {
      const mat = sphere.material as THREE.MeshPhysicalMaterial;
      mat.opacity = opacity;
      mat.transparent = opacity < 1;
    }
  }

  getInteractiveObjects(): THREE.Object3D[] {
    return [...this.profileMeshes, ...this.lineObjects];
  }

  resolveHoverInfo(intersection: THREE.Intersection, data: ResolvedDataFrame): ChartHitInfo | null {
    const interactiveObjects: THREE.Object3D[] = [...this.profileMeshes, ...this.lineObjects];
    const objectIndex = interactiveObjects.indexOf(intersection.object);
    if (objectIndex < 0) return null;

    const points = this.seriesPoints[objectIndex] ?? [];
    const localP = intersection.point.clone();
    localP.x -= this.chartPosition[0] + (this.seriesGroupRef?.position.x ?? 0);
    localP.y -= this.chartPosition[1] + (this.seriesGroupRef?.position.y ?? 0);
    localP.z -= this.chartPosition[2] + (this.seriesGroupRef?.position.z ?? 0);
    let nearest = 0;
    let nearestDist = Infinity;
    for (let i = 0; i < points.length; i++) {
      const d = localP.distanceTo(points[i]!);
      if (d < nearestDist) { nearestDist = d; nearest = i; }
    }

    const row = (data.rows[nearest] ?? {}) as Record<string, unknown>;
    const yValue = Number(row[this.cachedYField]) || 0;
    const seriesLabel = this.cachedSeries[objectIndex]?.label
      ?? this.cachedSeries[objectIndex]?.field
      ?? `Series ${objectIndex}`;
    const meta: ChartHitMeta = { kind: 'line', seriesLabel, yValue };

    const worldP = intersection.point;
    const yAxisWorldX = this.cachedChartPositionX + this.cachedPlotFrameOffsetX;

    return {
      seriesIndex: objectIndex,
      datumIndex: nearest,
      row,
      point: [localP.x, localP.y, localP.z],
      meta,
      projectionTarget: [yAxisWorldX, worldP.y, worldP.z],
    };
  }

  dispose(): void {
    this.reset();
    this.materialFactory.dispose();
  }
}
