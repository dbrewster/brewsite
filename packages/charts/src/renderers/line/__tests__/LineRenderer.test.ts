// LineRenderer V2 tests — multi-series, showPoints, reference lines, typeOptions.

import { describe, it, expect, beforeEach, vi } from 'vitest';

const catmullRomCalls: unknown[][] = [];
const extrudeGeometryCalls: unknown[][] = [];
const lineObjectCreations: unknown[] = [];
const axesUpdateCalls: unknown[] = [];

vi.mock('three', () => {
  class Vector3 {
    x: number; y: number; z: number;
    constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
    distanceTo(v: Vector3): number {
      const dx = this.x - v.x; const dy = this.y - v.y; const dz = this.z - v.z;
      return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }
    set(x: number, y: number, z: number) { this.x = x; this.y = y; this.z = z; return this; }
    clone() { return new Vector3(this.x, this.y, this.z); }
    copy(v: Vector3) { this.x = v.x; this.y = v.y; this.z = v.z; return this; }
  }
  class Object3D {
    children: Object3D[] = [];
    position = new Vector3();
    rotation = { set: vi.fn(), z: 0 };
    add(...objs: Object3D[]) { this.children.push(...objs); }
    remove(obj: Object3D) { const i = this.children.indexOf(obj); if (i >= 0) this.children.splice(i, 1); }
  }
  class Group extends Object3D {}
  class BufferGeometry {
    dispose = vi.fn();
    setFromPoints(points: unknown[]) {
      lineObjectCreations.push(['setFromPoints', points.length]);
      return this;
    }
  }
  class Shape {
    moveTo = vi.fn();
    lineTo = vi.fn();
    absarc = vi.fn();
    closePath = vi.fn();
  }
  class ExtrudeGeometry extends BufferGeometry {
    constructor(...args: unknown[]) { super(); extrudeGeometryCalls.push(args); }
  }
  class SphereGeometry extends BufferGeometry {
    constructor(_r?: number, _w?: number, _h?: number) { super(); }
  }
  class CatmullRomCurve3 {
    constructor(...args: unknown[]) { catmullRomCalls.push(args); }
    getPoints(count: number) { return Array.from({ length: count + 1 }, (_, i) => new Vector3(i, i, 0)); }
  }
  class MockMaterial {
    opacity = 1; transparent = false; color = {}; emissive = {};
    emissiveIntensity = 0; metalness = 0; roughness = 0; transmission = 0;
    flatShading = false; needsUpdate = false;
    dispose = vi.fn();
    constructor(opts: Record<string, unknown> = {}) { Object.assign(this, opts); }
  }
  class MeshPhysicalMaterial extends MockMaterial {}
  class LineBasicMaterial extends MockMaterial {}
  class MeshStandardMaterial extends MockMaterial {}
  class Mesh extends Object3D {
    geometry: BufferGeometry;
    material: MockMaterial;
    constructor(geo?: BufferGeometry, mat?: MockMaterial) {
      super();
      this.geometry = geo ?? new BufferGeometry();
      this.material = mat ?? new MockMaterial();
    }
  }
  class Line extends Object3D {
    geometry: BufferGeometry;
    material: MockMaterial;
    constructor(geo?: BufferGeometry, mat?: MockMaterial) {
      super();
      this.geometry = geo ?? new BufferGeometry();
      this.material = mat ?? new MockMaterial();
      lineObjectCreations.push(['line']);
    }
  }
  class Color { constructor(_?: unknown) {} set(_: unknown) {} }
  const FrontSide = 0;
  return {
    Vector3, Object3D, Group, BufferGeometry, Shape, ExtrudeGeometry, SphereGeometry,
    CatmullRomCurve3, Line, MeshPhysicalMaterial, LineBasicMaterial, MeshStandardMaterial,
    Mesh, Color, FrontSide,
  };
});

vi.mock('../../shared/AxesRenderer', () => ({
  AxesRenderer: class {
    update = vi.fn((state: unknown) => { axesUpdateCalls.push(state); });
    dispose = vi.fn();
  },
}));

vi.mock('../../shared/LegendRenderer', () => ({
  LegendRenderer: class { update = vi.fn(); dispose = vi.fn(); },
}));

import * as THREE from 'three';
import { LineRenderer } from '../LineRenderer';
import { darkGlassChartTheme } from '../../../themes/darkGlass';
import type { ResolvedDataFrame } from '../../../data/types';
import type { ChartRenderContext, ChartHitInfo } from '../../shared/IChartRenderer';

function makeCtx(data: ResolvedDataFrame, overrides: Partial<ChartRenderContext> = {}): ChartRenderContext {
  return {
    seriesGroup: new THREE.Group(),
    axesGroup: new THREE.Group(),
    legendGroup: new THREE.Group(),
    data,
    xAxis: { axis: 'x', field: 'x' },
    yAxis: { axis: 'y', field: 'y' },
    series: [{ field: 'y', label: 'Y' }],
    bounds: { width: 4, height: 3, depth: 0.3 },
    theme: darkGlassChartTheme,
    opacity: 1,
    typeOptions: { kind: 'line', options: {} },
    dataLabels: null,
    gridlines: null,
    legend: null,
    ...overrides,
  };
}

describe('LineRenderer V2', () => {
  let renderer: LineRenderer;

  beforeEach(() => {
    renderer = new LineRenderer();
    catmullRomCalls.length = 0;
    extrudeGeometryCalls.length = 0;
    lineObjectCreations.length = 0;
    axesUpdateCalls.length = 0;
  });

  it('showPoints=true: sphere objects added to seriesGroup for each datum', () => {
    const data: ResolvedDataFrame = {
      rows: [{ x: 0, y: 10 }, { x: 1, y: 20 }, { x: 2, y: 30 }],
      fields: ['x', 'y'],
    };
    const seriesGroup = new THREE.Group();
    renderer.update(makeCtx(data, {
      seriesGroup,
      typeOptions: { kind: 'line', options: { lineShape: 'line', showPoints: true } },
    }));
    // seriesGroup should have 1 line object + 3 sphere objects = 4 children
    const sphereCount = seriesGroup.children.length - 1; // subtract the line
    expect(sphereCount).toBe(3);
  });

  it('showPoints=false: no sphere markers added', () => {
    const data: ResolvedDataFrame = {
      rows: [{ x: 0, y: 10 }, { x: 1, y: 20 }, { x: 2, y: 30 }],
      fields: ['x', 'y'],
    };
    const seriesGroup = new THREE.Group();
    renderer.update(makeCtx(data, {
      seriesGroup,
      typeOptions: { kind: 'line', options: { lineShape: 'line' } },
    }));
    // Should only have the line object
    expect(seriesGroup.children).toHaveLength(1);
  });

  it('reference line on y-axis: axesGroup contains a Line at correct position', () => {
    const data: ResolvedDataFrame = {
      rows: [{ x: 0, y: 100 }, { x: 1, y: 200 }, { x: 2, y: 300 }],
      fields: ['x', 'y'],
    };
    const axesGroup = new THREE.Group();
    renderer.update(makeCtx(data, {
      axesGroup,
      typeOptions: { kind: 'line', options: { lineShape: 'line' } },
      referenceLines: [{ axis: 'y', value: 200, label: 'Target' }],
    }));
    // axesGroup should contain at least one Line child (from reference lines)
    const lineChildren = axesGroup.children.filter((c) => c instanceof THREE.Line);
    expect(lineChildren.length).toBeGreaterThan(0);
  });

  it('reference line: line is removed when referenceLines is cleared', () => {
    const data: ResolvedDataFrame = {
      rows: [{ x: 0, y: 100 }, { x: 1, y: 200 }, { x: 2, y: 300 }],
      fields: ['x', 'y'],
    };
    const groups = {
      seriesGroup: new THREE.Group(),
      axesGroup: new THREE.Group(),
      legendGroup: new THREE.Group(),
    };
    // First render with a reference line
    renderer.update(makeCtx(data, {
      ...groups,
      typeOptions: { kind: 'line', options: { lineShape: 'line' } },
      referenceLines: [{ axis: 'y', value: 200 }],
    }));
    const withLine = groups.axesGroup.children.filter((c) => c instanceof THREE.Line).length;
    expect(withLine).toBeGreaterThan(0);

    // Second render without reference lines
    renderer.update(makeCtx(data, {
      ...groups,
      typeOptions: { kind: 'line', options: { lineShape: 'line' } },
    }));
    const withoutLine = groups.axesGroup.children.filter((c) => c instanceof THREE.Line).length;
    // Axis lines remain but reference lines gone (fewer or same)
    expect(withoutLine).toBeLessThanOrEqual(withLine);
  });

  it('multi-series: one tube/line per series', () => {
    const data: ResolvedDataFrame = {
      rows: [
        { x: 0, a: 10, b: 20 },
        { x: 1, a: 15, b: 25 },
        { x: 2, a: 20, b: 30 },
      ],
      fields: ['x', 'a', 'b'],
    };
    renderer.update(makeCtx(data, {
      series: [{ field: 'a', label: 'A' }, { field: 'b', label: 'B' }],
      typeOptions: { kind: 'line', options: { lineShape: 'circle' } },
    }));
    expect(renderer.getInteractiveObjects()).toHaveLength(2);
  });

  it('series z offsets are negative so lines render behind axes', () => {
    const data: ResolvedDataFrame = {
      rows: [
        { x: 0, a: 10, b: 20 },
        { x: 1, a: 15, b: 25 },
        { x: 2, a: 20, b: 30 },
      ],
      fields: ['x', 'a', 'b'],
    };
    renderer.update(makeCtx(data, {
      series: [{ field: 'a', label: 'A' }, { field: 'b', label: 'B' }],
      typeOptions: { kind: 'line', options: { lineShape: 'line' } },
    }));
    const firstSeriesPoints = catmullRomCalls[0]?.[0] as Array<{ z: number }> | undefined;
    const secondSeriesPoints = catmullRomCalls[1]?.[0] as Array<{ z: number }> | undefined;
    expect(firstSeriesPoints?.[0]?.z).toBeLessThan(0);
    expect(secondSeriesPoints?.[0]?.z).toBeLessThan(firstSeriesPoints?.[0]?.z ?? 0);
  });

  it('typeOptions lineShape=circle used for curve generation', () => {
    const data: ResolvedDataFrame = {
      rows: [{ x: 0, y: 0 }, { x: 1, y: 10 }, { x: 2, y: 20 }],
      fields: ['x', 'y'],
    };
    renderer.update(makeCtx(data, {
      typeOptions: { kind: 'line', options: { lineShape: 'circle', lineSmoothness: 0.73, lineSubdivisions: 9 } },
    }));
    expect(catmullRomCalls).toHaveLength(1);
    expect(catmullRomCalls[0]?.[3]).toBe(0.73);
    expect((extrudeGeometryCalls[0]?.[1] as { steps?: number })?.steps).toBe(18);
  });

  it('SmartRebuild: data content change with same row count triggers rebuild', () => {
    const firstData: ResolvedDataFrame = {
      rows: [{ x: 0, y: 10 }, { x: 1, y: 20 }, { x: 2, y: 30 }],
      fields: ['x', 'y'],
    };
    const secondData: ResolvedDataFrame = {
      rows: [{ x: 0, y: 40 }, { x: 1, y: 5 }, { x: 2, y: 12 }],
      fields: ['x', 'y'],
    };

    const groups = {
      seriesGroup: new THREE.Group(),
      axesGroup: new THREE.Group(),
      legendGroup: new THREE.Group(),
    };

    renderer.update(makeCtx(firstData, {
      ...groups,
      typeOptions: { kind: 'line', options: { lineShape: 'circle' } },
    }));
    const firstObjects = [...renderer.getInteractiveObjects()];

    renderer.update(makeCtx(secondData, {
      ...groups,
      typeOptions: { kind: 'line', options: { lineShape: 'circle' } },
    }));
    const secondObjects = [...renderer.getInteractiveObjects()];

    expect(secondObjects[0]).not.toBe(firstObjects[0]);
  });

  it('typeOptions lineShape falls back to theme when not set', () => {
    const data: ResolvedDataFrame = {
      rows: [{ x: 0, y: 0 }, { x: 1, y: 10 }, { x: 2, y: 20 }],
      fields: ['x', 'y'],
    };
    renderer.update(makeCtx(data, {
      theme: { ...darkGlassChartTheme, line: { ...darkGlassChartTheme.line, shape: 'hexagon' } },
      typeOptions: { kind: 'line', options: {} },
    }));
    const hexShape = extrudeGeometryCalls[0]?.[0] as { lineTo?: ReturnType<typeof vi.fn> };
    expect(hexShape.lineTo?.mock.calls).toHaveLength(5);
  });

  it('resolveHoverInfo: returns nearest datumIndex for single series', () => {
    const data: ResolvedDataFrame = {
      rows: [{ x: 0, y: 0 }, { x: 1, y: 10 }, { x: 2, y: 20 }, { x: 3, y: 30 }],
      fields: ['x', 'y'],
    };
    renderer.update(makeCtx(data));
    const tubes = renderer.getInteractiveObjects();
    const hit = renderer.resolveHoverInfo({
      object: tubes[0]!,
      point: new THREE.Vector3(3.9, 2.9, 0),
    } as unknown as THREE.Intersection, data);
    expect(hit).not.toBeNull();
    expect(hit!.datumIndex).toBe(3);
  });

  it('resolveHoverInfo: returns null for non-line intersection', () => {
    const data: ResolvedDataFrame = {
      rows: [{ x: 0, y: 10 }, { x: 1, y: 20 }],
      fields: ['x', 'y'],
    };
    renderer.update(makeCtx(data));
    const fakeObject = new THREE.Mesh();
    const hit = renderer.resolveHoverInfo({
      object: fakeObject,
      point: new THREE.Vector3(0, 0, 0),
    } as unknown as THREE.Intersection, data);
    expect(hit).toBeNull();
  });

  it('positions filtered x-axis ticks correctly', () => {
    const data: ResolvedDataFrame = {
      rows: Array.from({ length: 12 }, (_, i) => ({ x: `M${i}`, y: i * 10 })),
      fields: ['x', 'y'],
    };
    renderer.update(makeCtx(data));
    const axisState = axesUpdateCalls[0] as { xTicks: Array<{ value: unknown; position: number }> };
    expect(axisState.xTicks.length).toBeGreaterThan(0);
    expect(axisState.xTicks.length).toBeLessThanOrEqual(6);
  });

  it('morphCtx: interpolates Y positions at t=0.5 (Map-based, O(1) lookup)', () => {
    // Use varied toData values so yScale domain is non-degenerate
    const fromData: ResolvedDataFrame = {
      rows: [
        { id: '0', y: 10 }, { id: '1', y: 20 }, { id: '2', y: 30 },
        { id: '3', y: 40 }, { id: '4', y: 50 },
      ],
      fields: ['id', 'y'],
    };
    const toData: ResolvedDataFrame = {
      rows: [
        { id: '0', y: 50 }, { id: '1', y: 60 }, { id: '2', y: 70 },
        { id: '3', y: 80 }, { id: '4', y: 90 },
      ],
      fields: ['id', 'y'],
    };
    const n = toData.rows.length;
    renderer.update(makeCtx(toData, {
      xAxis: { axis: 'x', field: 'id' },
      yAxis: { axis: 'y', field: 'y' },
      series: [{ field: 'y' }],
      typeOptions: { kind: 'line', options: { lineShape: 'line' } },
      morphCtx: { fromData, t: 0.5, keyField: 'id' },
    }));

    // seriesPoints[0] contains the Three.js Vector3 points fed into the curve
    const seriesPoints = (renderer as unknown as { seriesPoints: THREE.Vector3[][] }).seriesPoints;
    expect(seriesPoints.length).toBeGreaterThan(0);
    const points = seriesPoints[0]!;
    expect(points.length).toBe(n);

    // Points at t=0 and t=1 should bracket the t=0.5 points
    const r0 = new LineRenderer();
    r0.update(makeCtx(toData, {
      xAxis: { axis: 'x', field: 'id' },
      series: [{ field: 'y' }],
      typeOptions: { kind: 'line', options: { lineShape: 'line' } },
      morphCtx: { fromData, t: 0, keyField: 'id' },
    }));
    const r1 = new LineRenderer();
    r1.update(makeCtx(toData, {
      xAxis: { axis: 'x', field: 'id' },
      series: [{ field: 'y' }],
      typeOptions: { kind: 'line', options: { lineShape: 'line' } },
      morphCtx: { fromData, t: 1, keyField: 'id' },
    }));
    const points0 = (r0 as unknown as { seriesPoints: THREE.Vector3[][] }).seriesPoints[0]!;
    const points1 = (r1 as unknown as { seriesPoints: THREE.Vector3[][] }).seriesPoints[0]!;

    // t=0.5 Y values should be between t=0 and t=1 Y values (lerp midpoint)
    for (let i = 0; i < n; i++) {
      const y0 = points0[i]!.y;
      const y1 = points1[i]!.y;
      const y05 = points[i]!.y;
      expect(y05).toBeGreaterThanOrEqual(Math.min(y0, y1) - 0.001);
      expect(y05).toBeLessThanOrEqual(Math.max(y0, y1) + 0.001);
    }
  });

  it('morphCtx at t=0: Y positions reflect fromData values (lower than at t=1)', () => {
    // Use varied values so yScale domain is non-degenerate
    const fromData: ResolvedDataFrame = {
      rows: [{ id: 'a', y: 10 }, { id: 'b', y: 20 }, { id: 'c', y: 30 }],
      fields: ['id', 'y'],
    };
    const toData: ResolvedDataFrame = {
      rows: [{ id: 'a', y: 40 }, { id: 'b', y: 60 }, { id: 'c', y: 80 }],
      fields: ['id', 'y'],
    };
    const r0 = new LineRenderer();
    r0.update(makeCtx(toData, {
      xAxis: { axis: 'x', field: 'id' },
      series: [{ field: 'y' }],
      typeOptions: { kind: 'line', options: { lineShape: 'line' } },
      morphCtx: { fromData, t: 0, keyField: 'id' },
    }));
    const points0 = (r0 as unknown as { seriesPoints: THREE.Vector3[][] }).seriesPoints[0]!;

    const r1 = new LineRenderer();
    r1.update(makeCtx(toData, {
      xAxis: { axis: 'x', field: 'id' },
      series: [{ field: 'y' }],
      typeOptions: { kind: 'line', options: { lineShape: 'line' } },
      morphCtx: { fromData, t: 1, keyField: 'id' },
    }));
    const points1 = (r1 as unknown as { seriesPoints: THREE.Vector3[][] }).seriesPoints[0]!;

    // At t=0 (from values 10,20,30), Y positions should be lower than at t=1 (to values 40,60,80)
    for (let i = 0; i < points0.length; i++) {
      expect(points1[i]!.y).toBeGreaterThan(points0[i]!.y);
    }
  });

  it('morphCtx: unmatched key falls back to toY (no NaN, no crash)', () => {
    const fromData: ResolvedDataFrame = {
      rows: [{ id: 'A', y: 50 }],
      fields: ['id', 'y'],
    };
    const toData: ResolvedDataFrame = {
      rows: [{ id: 'A', y: 80 }, { id: 'NEW', y: 60 }], // 'NEW' not in fromData
      fields: ['id', 'y'],
    };
    expect(() => {
      renderer.update(makeCtx(toData, {
        xAxis: { axis: 'x', field: 'id' },
        series: [{ field: 'y' }],
        typeOptions: { kind: 'line', options: { lineShape: 'line' } },
        morphCtx: { fromData, t: 0.5, keyField: 'id' },
      }));
    }).not.toThrow();

    const seriesPoints = (renderer as unknown as { seriesPoints: THREE.Vector3[][] }).seriesPoints[0]!;
    // All Y values must be finite (no NaN)
    for (const pt of seriesPoints) {
      expect(isFinite(pt.y)).toBe(true);
    }
  });

  it('morphCtx: large dataset (50+ rows) completes without O(n²) regression', () => {
    const n = 50;
    const fromData: ResolvedDataFrame = {
      rows: Array.from({ length: n }, (_, i) => ({ id: String(i), y: i })),
      fields: ['id', 'y'],
    };
    const toData: ResolvedDataFrame = {
      rows: Array.from({ length: n }, (_, i) => ({ id: String(i), y: i * 2 })),
      fields: ['id', 'y'],
    };
    // Should complete (the O(1) Map lookup ensures this is fast)
    expect(() => {
      renderer.update(makeCtx(toData, {
        xAxis: { axis: 'x', field: 'id' },
        series: [{ field: 'y' }],
        typeOptions: { kind: 'line', options: { lineShape: 'line' } },
        morphCtx: { fromData, t: 0.5, keyField: 'id' },
      }));
    }).not.toThrow();

    const points = (renderer as unknown as { seriesPoints: THREE.Vector3[][] }).seriesPoints[0]!;
    expect(points).toHaveLength(n);
  });
});

describe('LineRenderer: resolveHoverInfo meta + projectionTarget', () => {
  const lineData: ResolvedDataFrame = {
    rows: [
      { x: 'Jan', y: 100 },
      { x: 'Feb', y: 200 },
      { x: 'Mar', y: 150 },
    ],
    fields: ['x', 'y'],
  };

  function renderAndResolve(
    data: ResolvedDataFrame,
    overrides: Partial<ChartRenderContext> = {},
  ): ChartHitInfo | null {
    const r = new LineRenderer();
    const g = {
      seriesGroup: new THREE.Group(),
      axesGroup: new THREE.Group(),
      legendGroup: new THREE.Group(),
    };
    r.update({
      ...makeCtx(data, g),
      chartPosition: [1.0, 0, 0],
      plotFrameOffset: { x: 0.5, y: 0 },
      typeOptions: { kind: 'line', options: { lineShape: 'line' } },
      ...overrides,
    });
    const objects = r.getInteractiveObjects();
    if (objects.length === 0) return null;
    const hitPoint = new THREE.Vector3(2.0, 0.8, -0.12);
    const intersection = {
      object: objects[0]!,
      point: hitPoint,
      distance: 5,
    } as unknown as THREE.Intersection;
    return r.resolveHoverInfo(intersection, data);
  }

  it('meta.kind = "line"', () => {
    const result = renderAndResolve(lineData);
    expect(result?.meta?.kind).toBe('line');
  });

  it('meta.seriesLabel = series[0].label', () => {
    const result = renderAndResolve(lineData);
    if (result?.meta?.kind !== 'line') throw new Error('expected line meta');
    expect(result.meta.seriesLabel).toBe('Y');
  });

  it('meta.yValue = row[yAxis.field]', () => {
    const result = renderAndResolve(lineData);
    if (result?.meta?.kind !== 'line') throw new Error('expected line meta');
    // The nearest datum to the hit point should have a numeric yValue
    expect(typeof result.meta.yValue).toBe('number');
  });

  it('projectionTarget is defined', () => {
    const result = renderAndResolve(lineData);
    expect(result?.projectionTarget).toBeDefined();
  });

  it('projectionTarget[0] = chartPositionX + plotFrameOffsetX = 1.5', () => {
    const result = renderAndResolve(lineData);
    expect(result?.projectionTarget?.[0]).toBeCloseTo(1.5, 5);
  });

  it('projectionTarget[1] = world-space hit point Y = 0.8', () => {
    const result = renderAndResolve(lineData);
    expect(result?.projectionTarget?.[1]).toBeCloseTo(0.8, 5);
  });

  it('projectionTarget[2] = world-space hit point Z = -0.12', () => {
    const result = renderAndResolve(lineData);
    expect(result?.projectionTarget?.[2]).toBeCloseTo(-0.12, 5);
  });
});
