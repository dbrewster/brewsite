// Hover resolution tests for AreaRenderer.

import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('three', () => {
  class Vector3 {
    x: number; y: number; z: number;
    constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
    set(x: number, y: number, z: number) { this.x = x; this.y = y; this.z = z; return this; }
  }
  class Vector2 {
    x: number; y: number;
    constructor(x = 0, y = 0) { this.x = x; this.y = y; }
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
  class Shape {
    moveTo = vi.fn();
    lineTo = vi.fn();
  }
  class ExtrudeGeometry extends BufferGeometry {
    constructor(_shape?: Shape, _opts?: Record<string, unknown>) { super(); }
  }
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
    Vector3, Vector2, Object3D, Group, BufferGeometry, Shape, ExtrudeGeometry,
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
import { AreaRenderer } from '../AreaRenderer';
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

describe('AreaRenderer', () => {
  let renderer: AreaRenderer;

  beforeEach(() => {
    renderer = new AreaRenderer();
  });

  it('resolveHoverInfo returns datumIndex proportional to X position', () => {
    const data: ResolvedDataFrame = {
      rows: [
        { x: 0, y: 10 },
        { x: 1, y: 20 },
        { x: 2, y: 30 },
        { x: 3, y: 40 },
        { x: 4, y: 50 },
      ],
      fields: ['x', 'y'],
    };
    const ctx = makeCtx(data);
    renderer.update(ctx);

    const meshes = renderer.getInteractiveObjects();
    expect(meshes.length).toBeGreaterThan(0);

    // X at the midpoint of bounds.width (4) → should resolve to midpoint index (2)
    const intersection = {
      object: meshes[0]!,
      point: new THREE.Vector3(2, 1, 0),
    } as unknown as THREE.Intersection;

    const hit = renderer.resolveHoverInfo(intersection, data);
    expect(hit).not.toBeNull();
    expect(hit!.datumIndex).toBe(2);
    expect(hit!.seriesIndex).toBe(0);
  });

  it('resolveHoverInfo clamps datumIndex to [0, rows.length-1]', () => {
    const data: ResolvedDataFrame = {
      rows: [
        { x: 0, y: 10 },
        { x: 1, y: 20 },
        { x: 2, y: 30 },
      ],
      fields: ['x', 'y'],
    };
    const ctx = makeCtx(data);
    renderer.update(ctx);

    const meshes = renderer.getInteractiveObjects();

    // X beyond bounds — should clamp to last index
    const hitRight = renderer.resolveHoverInfo(
      { object: meshes[0]!, point: new THREE.Vector3(10, 1, 0) } as unknown as THREE.Intersection,
      data,
    );
    expect(hitRight).not.toBeNull();
    expect(hitRight!.datumIndex).toBe(2);

    // X at negative — should clamp to first index
    const hitLeft = renderer.resolveHoverInfo(
      { object: meshes[0]!, point: new THREE.Vector3(-5, 1, 0) } as unknown as THREE.Intersection,
      data,
    );
    expect(hitLeft).not.toBeNull();
    expect(hitLeft!.datumIndex).toBe(0);
  });

  it('resolveHoverInfo returns null for non-area intersection', () => {
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

  it('resolveHoverInfo returns null for empty data rows', () => {
    const data: ResolvedDataFrame = {
      rows: [{ x: 0, y: 10 }, { x: 1, y: 20 }],
      fields: ['x', 'y'],
    };
    const ctx = makeCtx(data);
    renderer.update(ctx);

    const meshes = renderer.getInteractiveObjects();

    const emptyData: ResolvedDataFrame = { rows: [], fields: ['x', 'y'] };
    const hit = renderer.resolveHoverInfo(
      { object: meshes[0]!, point: new THREE.Vector3(1, 1, 0) } as unknown as THREE.Intersection,
      emptyData,
    );
    expect(hit).toBeNull();
  });
});
