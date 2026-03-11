// Hover resolution tests for LineRenderer.

import { describe, it, expect, beforeEach, vi } from 'vitest';

const catmullRomCalls: unknown[][] = [];
const extrudeGeometryCalls: unknown[][] = [];
const lineObjectCreations: unknown[][] = [];
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
  }
  class Object3D {
    children: Object3D[] = [];
    position = new Vector3();
    rotation = { set: vi.fn() };
    add(...objs: Object3D[]) { this.children.push(...objs); }
    remove(obj: Object3D) { const i = this.children.indexOf(obj); if (i >= 0) this.children.splice(i, 1); }
  }
  class Group extends Object3D {}
  class BufferGeometry {
    dispose = vi.fn();
    setFromPoints(points: unknown[]) { lineObjectCreations.push(['setFromPoints', points.length]); return this; }
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
    Vector3, Object3D, Group, BufferGeometry, Shape, ExtrudeGeometry, CatmullRomCurve3, Line,
    MeshPhysicalMaterial, LineBasicMaterial, MeshStandardMaterial,
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
import type { ChartRenderContext } from '../../shared/IChartRenderer';

function makeCtx(data: ResolvedDataFrame, overrides?: Partial<ChartRenderContext>): ChartRenderContext {
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
    innerRadius: 0,
    pieTilt: 0,
    ...overrides,
  };
}

describe('LineRenderer', () => {
  let renderer: LineRenderer;

  beforeEach(() => {
    renderer = new LineRenderer();
    catmullRomCalls.length = 0;
    extrudeGeometryCalls.length = 0;
    lineObjectCreations.length = 0;
    axesUpdateCalls.length = 0;
  });

  it('resolveHoverInfo returns nearest datumIndex, not always 0', () => {
    const data: ResolvedDataFrame = {
      rows: [
        { x: 0, y: 0 },
        { x: 1, y: 10 },
        { x: 2, y: 20 },
        { x: 3, y: 30 },
      ],
      fields: ['x', 'y'],
    };
    const ctx = makeCtx(data);
    renderer.update(ctx);

    const tubeMeshes = renderer.getInteractiveObjects();
    expect(tubeMeshes.length).toBeGreaterThan(0);

    // Simulate an intersection near the last data point
    const intersection = {
      object: tubeMeshes[0]!,
      point: new THREE.Vector3(3.9, 2.9, 0),
    } as unknown as THREE.Intersection;

    const hit = renderer.resolveHoverInfo(intersection, data);
    expect(hit).not.toBeNull();
    // The nearest point should be index 3 (the last one) not 0
    expect(hit!.datumIndex).toBe(3);
    expect(hit!.seriesIndex).toBe(0);
    expect(hit!.row).toMatchObject({ x: 3, y: 30 });
  });

  it('uses per-chart smooth line overrides for curve generation', () => {
    const data: ResolvedDataFrame = {
      rows: [{ x: 0, y: 0 }, { x: 1, y: 10 }, { x: 2, y: 20 }],
      fields: ['x', 'y'],
    };
    renderer.update(makeCtx(data, { lineShape: 'circle', lineSmoothness: 0.73, lineSubdivisions: 9 }));
    expect(catmullRomCalls).toHaveLength(1);
    expect(catmullRomCalls[0]?.[2]).toBe('catmullrom');
    expect(catmullRomCalls[0]?.[3]).toBe(0.73);
    expect((extrudeGeometryCalls[0]?.[1] as { steps?: number })?.steps).toBe(18);
  });

  it('pads the curve endpoints to reduce endpoint lift above the axis', () => {
    const data: ResolvedDataFrame = {
      rows: [{ x: 0, y: 0 }, { x: 1, y: 10 }, { x: 2, y: 20 }],
      fields: ['x', 'y'],
    };

    renderer.update(makeCtx(data, { lineShape: 'circle' }));

    const curvePoints = catmullRomCalls[0]?.[0] as Array<{ x: number; y: number; z: number }>;
    expect(curvePoints).toHaveLength(5);
    expect(curvePoints[0]).toMatchObject(curvePoints[1]!);
    expect(curvePoints[3]).toMatchObject(curvePoints[4]!);
  });

  it('positions filtered x-axis ticks using original row indexes', () => {
    const data: ResolvedDataFrame = {
      rows: [
        { x: 'Jan', y: 10 },
        { x: 'Feb', y: 12 },
        { x: 'Mar', y: 14 },
        { x: 'Apr', y: 16 },
        { x: 'May', y: 18 },
        { x: 'Jun', y: 20 },
        { x: 'Jul', y: 22 },
        { x: 'Aug', y: 24 },
        { x: 'Sep', y: 26 },
        { x: 'Oct', y: 28 },
        { x: 'Nov', y: 30 },
        { x: 'Dec', y: 32 },
      ],
      fields: ['x', 'y'],
    };

    renderer.update(makeCtx(data));

    const axisState = axesUpdateCalls[0] as { xTicks: Array<{ value: string; position: number }> };
    expect(axisState.xTicks.map((tick) => tick.value)).toEqual(['Jan', 'Mar', 'May', 'Jul', 'Sep', 'Nov']);
    expect(axisState.xTicks.map((tick) => tick.position)).toEqual([
      0,
      2 / 11,
      4 / 11,
      6 / 11,
      8 / 11,
      10 / 11,
    ]);
  });

  it('uses polygonal profile shapes for true extruded cross-sections', () => {
    const data: ResolvedDataFrame = {
      rows: [{ x: 0, y: 0 }, { x: 1, y: 10 }, { x: 2, y: 20 }],
      fields: ['x', 'y'],
    };

    renderer.update(makeCtx(data, { lineShape: 'triangle' }));
    const triangleShape = extrudeGeometryCalls[0]?.[0] as {
      moveTo?: ReturnType<typeof vi.fn>;
      lineTo?: ReturnType<typeof vi.fn>;
    };
    expect(triangleShape.lineTo?.mock.calls).toHaveLength(2);
    expect(triangleShape.moveTo?.mock.calls[0]?.[0]).toBeCloseTo(0.015, 6);
    expect(triangleShape.moveTo?.mock.calls[0]?.[1]).toBeCloseTo(0.0259807621, 6);
    const triangleMesh = renderer.getInteractiveObjects()[0] as THREE.Mesh;
    expect((triangleMesh.material as { flatShading?: boolean }).flatShading).toBe(true);

    extrudeGeometryCalls.length = 0;
    renderer.update(makeCtx(data, { lineShape: 'octagon' }));
    const octagonShape = extrudeGeometryCalls[0]?.[0] as { lineTo?: ReturnType<typeof vi.fn> };
    expect(octagonShape.lineTo?.mock.calls).toHaveLength(7);
  });

  it('uses theme line shape when the chart does not override it', () => {
    const data: ResolvedDataFrame = {
      rows: [{ x: 0, y: 0 }, { x: 1, y: 10 }, { x: 2, y: 20 }],
      fields: ['x', 'y'],
    };

    renderer.update(makeCtx(data, {
      theme: {
        ...darkGlassChartTheme,
        line: { ...darkGlassChartTheme.line, shape: 'hexagon' },
      },
    }));

    const hexagonShape = extrudeGeometryCalls[0]?.[0] as { lineTo?: ReturnType<typeof vi.fn> };
    expect(hexagonShape.lineTo?.mock.calls).toHaveLength(5);
  });

  it('chart lineShape overrides the theme line shape', () => {
    const data: ResolvedDataFrame = {
      rows: [{ x: 0, y: 0 }, { x: 1, y: 10 }, { x: 2, y: 20 }],
      fields: ['x', 'y'],
    };

    renderer.update(makeCtx(data, {
      lineShape: 'triangle',
      theme: {
        ...darkGlassChartTheme,
        line: { ...darkGlassChartTheme.line, shape: 'hexagon' },
      },
    }));

    const triangleShape = extrudeGeometryCalls[0]?.[0] as { lineTo?: ReturnType<typeof vi.fn> };
    expect(triangleShape.lineTo?.mock.calls).toHaveLength(2);
  });

  it('uses flat line rendering when lineShape is line', () => {
    const data: ResolvedDataFrame = {
      rows: [{ x: 0, y: 0 }, { x: 1, y: 10 }, { x: 2, y: 20 }],
      fields: ['x', 'y'],
    };

    renderer.update(makeCtx(data, { lineShape: 'line', lineSubdivisions: 4 }));
    expect(extrudeGeometryCalls).toHaveLength(0);
    expect(lineObjectCreations.some((entry) => entry[0] === 'line')).toBe(true);
    expect(lineObjectCreations.some((entry) => entry[0] === 'setFromPoints' && entry[1] === 13)).toBe(true);
  });

  it('resolveHoverInfo returns correct seriesIndex for multi-series', () => {
    const data: ResolvedDataFrame = {
      rows: [
        { x: 0, a: 10, b: 20 },
        { x: 1, a: 15, b: 25 },
        { x: 2, a: 20, b: 30 },
      ],
      fields: ['x', 'a', 'b'],
    };
    const ctx = makeCtx(data, {
      series: [{ field: 'a', label: 'A' }, { field: 'b', label: 'B' }],
    });
    renderer.update(ctx);

    const tubes = renderer.getInteractiveObjects();
    expect(tubes.length).toBe(2);

    // Intersect on the second tube
    const intersection = {
      object: tubes[1]!,
      point: new THREE.Vector3(0, 0, 0.15),
    } as unknown as THREE.Intersection;

    const hit = renderer.resolveHoverInfo(intersection, data);
    expect(hit).not.toBeNull();
    expect(hit!.seriesIndex).toBe(1);
  });

  it('resolveHoverInfo returns null for non-tube intersection', () => {
    const data: ResolvedDataFrame = {
      rows: [{ x: 0, y: 10 }, { x: 1, y: 20 }],
      fields: ['x', 'y'],
    };
    const ctx = makeCtx(data);
    renderer.update(ctx);

    const fakeObject = new THREE.Mesh();
    const intersection = {
      object: fakeObject,
      point: new THREE.Vector3(0, 0, 0),
    } as unknown as THREE.Intersection;

    const hit = renderer.resolveHoverInfo(intersection, data);
    expect(hit).toBeNull();
  });

  it('resolveHoverInfo returns correct row from data.rows', () => {
    const data: ResolvedDataFrame = {
      rows: [
        { x: 0, y: 0, label: 'first' },
        { x: 1, y: 50, label: 'second' },
      ],
      fields: ['x', 'y', 'label'],
    };
    const ctx = makeCtx(data);
    renderer.update(ctx);

    const tubes = renderer.getInteractiveObjects();
    // Intersect near the first data point
    const intersection = {
      object: tubes[0]!,
      point: new THREE.Vector3(0, 0, 0),
    } as unknown as THREE.Intersection;

    const hit = renderer.resolveHoverInfo(intersection, data);
    expect(hit).not.toBeNull();
    expect(hit!.datumIndex).toBe(0);
    expect(hit!.row).toMatchObject({ label: 'first' });
  });
});
