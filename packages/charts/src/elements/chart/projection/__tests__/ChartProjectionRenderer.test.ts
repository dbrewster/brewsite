// ChartProjectionRenderer tests — animation state machine, geometry lifecycle, dispose.

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('three', () => {
  class Vector3 {
    x: number; y: number; z: number;
    constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
    set(x: number, y: number, z: number) { this.x = x; this.y = y; this.z = z; return this; }
    copy(v: Vector3) { this.x = v.x; this.y = v.y; this.z = v.z; return this; }
  }
  class Object3D {
    children: Object3D[] = [];
    position = new Vector3();
    visible = true;
    add(...objs: Object3D[]) { this.children.push(...objs); }
    remove(obj: Object3D) {
      const index = this.children.indexOf(obj);
      if (index >= 0) this.children.splice(index, 1);
    }
  }
  class Group extends Object3D {}
  class BufferGeometry {
    parameters: Record<string, number> = {};
    dispose = vi.fn();
    setFromPoints() { return this; }
    translate(_x: number, _y: number, _z: number) { return this; }
  }
  class BoxGeometry extends BufferGeometry {
    constructor(width = 0, height = 0, depth = 0) {
      super();
      this.parameters = { width, height, depth };
    }
  }
  class PlaneGeometry extends BufferGeometry {
    constructor(width = 0, height = 0) {
      super();
      this.parameters = { width, height };
    }
  }
  class MockMaterial {
    opacity = 0;
    transparent = false;
    color = { set: vi.fn() };
    blending = 0;
    depthWrite = true;
    side = 0;
    dispose = vi.fn();
    constructor(options: Record<string, unknown> = {}) { Object.assign(this, options); }
  }
  class MeshBasicMaterial extends MockMaterial {}
  class Mesh extends Object3D {
    geometry: BufferGeometry;
    material: MockMaterial;
    scale = new Vector3(1, 1, 1);
    constructor(geometry?: BufferGeometry, material?: MockMaterial) {
      super();
      this.geometry = geometry ?? new BufferGeometry();
      this.material = material ?? new MockMaterial();
    }
  }
  class Color {
    constructor(_?: unknown) {}
    set(_: unknown) { return this; }
  }
  const AdditiveBlending = 2;
  const DoubleSide = 2;
  return {
    Vector3, Object3D, Group, BufferGeometry, BoxGeometry, PlaneGeometry,
    MeshBasicMaterial, Mesh, Color, AdditiveBlending, DoubleSide,
  };
});

import * as THREE from 'three';
import { ChartProjectionRenderer, DEFAULT_PROJECTION_TOKENS } from '../ChartProjectionRenderer';
import type { ChartHitInfo } from '../../../../renderers/shared/IChartRenderer';

function makeChartGroup(): THREE.Group {
  const g = new THREE.Group();
  g.position.set(0, 0, 0);
  return g;
}

function makeHitInfo(overrides: Partial<ChartHitInfo> = {}): ChartHitInfo {
  return {
    seriesIndex: 0,
    datumIndex: 0,
    row: {},
    point: [2.0, 1.0, -0.1],
    projectionTarget: [0.0, 1.0, -0.1], // Y-axis face at x=0
    ...overrides,
  };
}

describe('ChartProjectionRenderer', () => {
  let renderer: ChartProjectionRenderer;
  let chartGroup: THREE.Group;
  let mockNow: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockNow = vi.fn(() => 0);
    chartGroup = makeChartGroup();
    renderer = new ChartProjectionRenderer(chartGroup, mockNow);
  });

  it('constructor adds projectionGroup as child of chartGroup', () => {
    expect(chartGroup.children).toHaveLength(1);
  });

  it('updateProjection(null) on idle: no state change, no geometry', () => {
    renderer.updateProjection(null, DEFAULT_PROJECTION_TOKENS);
    // tick should be a no-op
    renderer.tick(DEFAULT_PROJECTION_TOKENS);
    // projectionGroup still has no children
    const projGroup = chartGroup.children[0] as THREE.Group;
    expect(projGroup.children).toHaveLength(0);
  });

  it('updateProjection(info): beam + dot added to projectionGroup', () => {
    renderer.updateProjection(makeHitInfo(), DEFAULT_PROJECTION_TOKENS);
    const projGroup = chartGroup.children[0] as THREE.Group;
    expect(projGroup.children).toHaveLength(2); // beam + dot
  });

  it('beam starts at scale.x = 0', () => {
    renderer.updateProjection(makeHitInfo(), DEFAULT_PROJECTION_TOKENS);
    const projGroup = chartGroup.children[0] as THREE.Group;
    const beam = projGroup.children[0] as THREE.Mesh;
    expect((beam.scale as { x: number }).x).toBe(0);
  });

  it('tick() during entrance: scale.x follows easeOutExpo', () => {
    renderer.updateProjection(makeHitInfo(), DEFAULT_PROJECTION_TOKENS);
    // At 110ms (halfway through 220ms animation)
    mockNow.mockReturnValue(110);
    renderer.tick(DEFAULT_PROJECTION_TOKENS);

    const projGroup = chartGroup.children[0] as THREE.Group;
    const beam = projGroup.children[0] as THREE.Mesh;
    const scaleX = (beam.scale as { x: number }).x;
    // easeOutExpo(0.5) = 1 - 2^(-5) = 1 - 0.03125 = 0.96875
    expect(scaleX).toBeCloseTo(0.96875, 2);
  });

  it('tick() at end of entrance: transitions to holding state, scale.x = 1', () => {
    renderer.updateProjection(makeHitInfo(), DEFAULT_PROJECTION_TOKENS);
    mockNow.mockReturnValue(220); // full duration
    renderer.tick(DEFAULT_PROJECTION_TOKENS);
    // scale.x should be 1.0 now
    const projGroup = chartGroup.children[0] as THREE.Group;
    const beam = projGroup.children[0] as THREE.Mesh;
    expect((beam.scale as { x: number }).x).toBeCloseTo(1.0, 5);
  });

  it('re-trigger: new updateProjection() snaps to new position and restarts entrance', () => {
    renderer.updateProjection(makeHitInfo({ point: [2.0, 1.0, 0] }), DEFAULT_PROJECTION_TOKENS);
    mockNow.mockReturnValue(100);
    renderer.tick(DEFAULT_PROJECTION_TOKENS);

    // Retrigger on a new hit point
    renderer.updateProjection(makeHitInfo({ point: [3.0, 0.5, 0] }), DEFAULT_PROJECTION_TOKENS);
    const projGroup = chartGroup.children[0] as THREE.Group;
    const beam = projGroup.children[0] as THREE.Mesh;
    // scale.x should be 0 again (snapped, restart)
    expect((beam.scale as { x: number }).x).toBe(0);
  });

  it('updateProjection(null) while entering: transitions to exiting', () => {
    renderer.updateProjection(makeHitInfo(), DEFAULT_PROJECTION_TOKENS);
    mockNow.mockReturnValue(50); // halfway through entrance
    renderer.tick(DEFAULT_PROJECTION_TOKENS);

    renderer.updateProjection(null, DEFAULT_PROJECTION_TOKENS);
    // Further ticks should reduce opacity toward 0
    mockNow.mockReturnValue(50 + 160); // full exit duration
    renderer.tick(DEFAULT_PROJECTION_TOKENS);
    // After full exit, geometry should be hidden (visible = false)
    const projGroup = chartGroup.children[0] as THREE.Group;
    for (const child of projGroup.children) {
      expect((child as THREE.Mesh).visible).toBe(false);
    }
  });

  it('info without projectionTarget: stays idle, no geometry added', () => {
    const info: ChartHitInfo = { ...makeHitInfo(), projectionTarget: undefined };
    renderer.updateProjection(info, DEFAULT_PROJECTION_TOKENS);
    renderer.tick(DEFAULT_PROJECTION_TOKENS);
    const projGroup = chartGroup.children[0] as THREE.Group;
    expect(projGroup.children).toHaveLength(0);
  });

  it('dispose(): removes projectionGroup from chartGroup', () => {
    renderer.dispose();
    expect(chartGroup.children).toHaveLength(0);
  });

  it('dispose(): disposes geometry and material of beam + dot', () => {
    renderer.updateProjection(makeHitInfo(), DEFAULT_PROJECTION_TOKENS);
    const projGroup = chartGroup.children[0] as THREE.Group;
    const beam = projGroup.children[0] as THREE.Mesh;
    const dot  = projGroup.children[1] as THREE.Mesh;
    const beamGeoDispose = vi.spyOn(beam.geometry, 'dispose');
    const dotGeoDispose  = vi.spyOn(dot.geometry, 'dispose');

    renderer.dispose();
    expect(beamGeoDispose).toHaveBeenCalled();
    expect(dotGeoDispose).toHaveBeenCalled();
  });
});
