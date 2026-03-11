// Line chart renderer — extruded profile shapes swept along a CatmullRom curve.

import * as THREE from 'three';
import { scaleLinear } from 'd3-scale';
import { extent } from 'd3-array';
import { AxesRenderer } from '../shared/AxesRenderer';
import { LegendRenderer } from '../shared/LegendRenderer';
import { ChartMaterialFactory } from '../shared/ChartMaterialFactory';
import type { IChartRenderer, ChartRenderContext, ChartHitInfo } from '../shared/IChartRenderer';
import type { ResolvedDataFrame } from '../../data/types';
import type { ChartLineShape } from '../../elements/chart/types';

/**
 * Renders line charts as CatmullRom spline tubes in Three.js.
 * Multi-series lines are offset along Z.
 */
export class LineRenderer implements IChartRenderer {
  private readonly materialFactory = new ChartMaterialFactory();
  private axesRenderer: AxesRenderer | null = null;
  private legendRenderer: LegendRenderer | null = null;
  private readonly profileMeshes: THREE.Mesh[] = [];
  private readonly lineObjects: THREE.Line[] = [];
  private readonly seriesPoints: THREE.Vector3[][] = [];
  private seriesGroupRef: THREE.Group | null = null;
  private lastDataLength = -1;
  private lastSeriesCount = -1;
  private lastLineShape: ChartLineShape | null = null;
  private lastLineSmoothness = -1;
  private lastLineSubdivisions = -1;
  private chartPosition: readonly [number, number, number] = [0, 0, 0];

  update(ctx: ChartRenderContext): void {
    const { seriesGroup, axesGroup, legendGroup, data, xAxis, yAxis, series, bounds, theme, opacity, fontUrl } = ctx;
    this.chartPosition = ctx.chartPosition ?? [0, 0, 0];

    const effectiveSeries: Array<{ field: string; label?: string; color?: string }> = series.length > 0
      ? [...series]
      : (yAxis ? [{ field: yAxis.field, label: yAxis.label }] : []);

    this.seriesGroupRef = seriesGroup;

    if (effectiveSeries.length === 0 || data.rows.length < 2) {
      this.reset();
      return;
    }

    const xField = xAxis?.field ?? data.fields[0] ?? 'x';
    const lineShape = ctx.lineShape ?? theme.line.shape;
    const lineSmoothness = this.clampSmoothness(ctx.lineSmoothness ?? theme.line.smoothness);
    const lineSubdivisions = this.clampSubdivisions(ctx.lineSubdivisions ?? theme.line.subdivisions);
    const needsRebuild =
      data.rows.length !== this.lastDataLength ||
      effectiveSeries.length !== this.lastSeriesCount ||
      lineShape !== this.lastLineShape ||
      lineSmoothness !== this.lastLineSmoothness ||
      lineSubdivisions !== this.lastLineSubdivisions;

    if (needsRebuild) {
      this.clearProfiles();
      this.buildLines(seriesGroup, data, xField, effectiveSeries, bounds, theme, opacity, lineShape, lineSmoothness, lineSubdivisions);
      this.lastDataLength = data.rows.length;
      this.lastSeriesCount = effectiveSeries.length;
      this.lastLineShape = lineShape;
      this.lastLineSmoothness = lineSmoothness;
      this.lastLineSubdivisions = lineSubdivisions;
    } else {
      this.updateOpacity(opacity);
    }

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
    this.axesRenderer.update({ xTicks, yTicks, bounds, theme, opacity, xAxis, yAxis, fontUrl });

    if (!this.legendRenderer) this.legendRenderer = new LegendRenderer(legendGroup);
    this.legendRenderer.update(effectiveSeries, theme, opacity, fontUrl);
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
  ): void {
    const allValues = data.rows.flatMap((r) =>
      series.map((s) => Number(r[s.field]) || 0),
    );
    const [yMin, yMax] = extent(allValues) as [number, number];
    const yScale = scaleLinear().domain([yMin, yMax]).range([0, bounds.height]);
    const xScale = scaleLinear().domain([0, data.rows.length - 1]).range([0, bounds.width]);

    for (let si = 0; si < series.length; si++) {
      const s = series[si]!;
      const zOffset = si * 0.15;
      const points = data.rows.map((r, i) => {
        const y = yScale(Number(r[s.field]) || 0);
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
        const mat = new THREE.LineBasicMaterial({
          color: new THREE.Color(tokens.color),
          transparent: opacity < 1,
          opacity,
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
        seriesGroup.add(mesh);
        this.profileMeshes.push(mesh);
      }
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
    this.profileMeshes.length = 0;
    this.lineObjects.length = 0;
    this.seriesPoints.length = 0;
    this.lastDataLength = -1;
    this.lastSeriesCount = -1;
    this.lastLineShape = null;
    this.lastLineSmoothness = -1;
    this.lastLineSubdivisions = -1;
  }

  private reset(): void {
    this.clearProfiles();
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
  }

  getInteractiveObjects(): THREE.Object3D[] {
    return [...this.profileMeshes, ...this.lineObjects];
  }

  resolveHoverInfo(intersection: THREE.Intersection, data: ResolvedDataFrame): ChartHitInfo | null {
    const interactiveObjects: THREE.Object3D[] = [...this.profileMeshes, ...this.lineObjects];
    const objectIndex = interactiveObjects.indexOf(intersection.object);
    if (objectIndex < 0) return null;

    const points = this.seriesPoints[objectIndex] ?? [];
    const p = intersection.point.clone();
    p.x -= this.chartPosition[0] + (this.seriesGroupRef?.position.x ?? 0);
    p.y -= this.chartPosition[1] + (this.seriesGroupRef?.position.y ?? 0);
    p.z -= this.chartPosition[2] + (this.seriesGroupRef?.position.z ?? 0);
    let nearest = 0;
    let nearestDist = Infinity;
    for (let i = 0; i < points.length; i++) {
      const d = p.distanceTo(points[i]!);
      if (d < nearestDist) { nearestDist = d; nearest = i; }
    }

    const row = (data.rows[nearest] ?? {}) as Record<string, unknown>;
    return {
      seriesIndex: objectIndex,
      datumIndex: nearest,
      row,
      point: [p.x, p.y, p.z],
    };
  }

  dispose(): void {
    this.reset();
    this.materialFactory.dispose();
  }
}
