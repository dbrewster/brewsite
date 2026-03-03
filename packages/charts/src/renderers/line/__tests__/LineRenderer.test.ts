// Hover resolution tests for LineRenderer.

import { describe, it, expect, beforeEach, vi } from 'vitest';

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
  class BufferGeometry { dispose = vi.fn(); }
  class TubeGeometry extends BufferGeometry {}
  class CatmullRomCurve3 { constructor(_pts: Vector3[]) {} }
  class MockMaterial {
    opacity = 1; transparent = false; color = {}; emissive = {};
    emissiveIntensity = 0; metalness = 0; roughness = 0; transmission = 0;
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
  class Color { constructor(_?: unknown) {} set(_: unknown) {} }
  const FrontSide = 0;
  return {
    Vector3, Object3D, Group, BufferGeometry, TubeGeometry, CatmullRomCurve3,
    MeshPhysicalMaterial, LineBasicMaterial, MeshStandardMaterial,
    Mesh, Color, FrontSide,
  };
});

vi.mock('../../shared/AxesRenderer', () => ({
  AxesRenderer: class { update = vi.fn(); dispose = vi.fn(); },
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
    ...overrides,
  };
}

describe('LineRenderer', () => {
  let renderer: LineRenderer;

  beforeEach(() => {
    renderer = new LineRenderer();
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
