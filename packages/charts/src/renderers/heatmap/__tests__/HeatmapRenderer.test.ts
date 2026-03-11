// HeatmapRenderer V2 tests — timeField slicing, heightField, colorInterpolator.

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('three', () => {
  class Vector3 {
    x: number; y: number; z: number;
    constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
    set(x: number, y: number, z: number) { this.x = x; this.y = y; this.z = z; return this; }
  }
  class Matrix4 {
    elements: number[] = Array(16).fill(0);
    compose(_pos: Vector3, _q: unknown, _scale: Vector3) {
      this.elements[0] = _scale.x;
      this.elements[5] = _scale.y;
      this.elements[10] = _scale.z;
      return this;
    }
    identity() { return this; }
  }
  class Quaternion { set() { return this; } }
  class Object3D {
    children: Object3D[] = [];
    position = new Vector3();
    scale = new Vector3(1, 1, 1);
    matrix = new Matrix4();
    quaternion = new Quaternion();
    rotation = { set: vi.fn() };
    updateMatrix() { this.matrix.compose(this.position, this.quaternion, this.scale); }
    add(...objs: Object3D[]) { this.children.push(...objs); }
    remove(obj: Object3D) { const i = this.children.indexOf(obj); if (i >= 0) this.children.splice(i, 1); }
  }
  class Group extends Object3D {}
  class BufferGeometry { dispose = vi.fn(); }
  class PlaneGeometry extends BufferGeometry {
    constructor(_w?: number, _h?: number) { super(); }
  }
  class BoxGeometry extends BufferGeometry {
    constructor(_w?: number, _h?: number, _d?: number) { super(); }
  }
  class InstancedBufferAttribute {
    array: Float32Array;
    needsUpdate = false;
    constructor(arr: Float32Array, _itemSize: number) { this.array = arr; }
  }
  class MockMaterial {
    opacity = 1; transparent = false; metalness = 0; roughness = 0; vertexColors = false;
    dispose = vi.fn();
    constructor(opts: Record<string, unknown> = {}) { Object.assign(this, opts); }
  }
  class MeshPhysicalMaterial extends MockMaterial {}
  class Color {
    r = 0; g = 0; b = 0;
    constructor(cssOrHex?: unknown) {
      if (typeof cssOrHex === 'string') this._parse(cssOrHex);
    }
    _parse(s: string) {
      if (s.startsWith('#') && (s.length === 7 || s.length === 4)) {
        const hex = s.length === 4
          ? s.slice(1).split('').map((c) => c + c).join('')
          : s.slice(1);
        this.r = parseInt(hex.slice(0, 2), 16) / 255;
        this.g = parseInt(hex.slice(2, 4), 16) / 255;
        this.b = parseInt(hex.slice(4, 6), 16) / 255;
      } else if (s.startsWith('rgb(')) {
        const parts = s.slice(4, -1).split(',').map(Number);
        this.r = (parts[0] ?? 0) / 255;
        this.g = (parts[1] ?? 0) / 255;
        this.b = (parts[2] ?? 0) / 255;
      }
    }
    set(v: unknown) {
      if (typeof v === 'string') this._parse(v);
      else if (v instanceof Color) { this.r = v.r; this.g = v.g; this.b = v.b; }
      return this;
    }
  }
  class InstancedMesh extends Object3D {
    geometry: BufferGeometry;
    material: MockMaterial;
    count: number;
    instanceMatrix = { needsUpdate: false };
    instanceColor: InstancedBufferAttribute | null = null;
    private matrices: Matrix4[];
    private colors: Color[];
    constructor(geo: BufferGeometry, mat: MockMaterial, count: number) {
      super();
      this.geometry = geo;
      this.material = mat;
      this.count = count;
      this.matrices = Array.from({ length: count }, () => new Matrix4());
      this.colors = Array.from({ length: count }, () => new Color());
    }
    setMatrixAt(i: number, m: Matrix4) {
      if (this.matrices[i]) {
        // Deep-copy elements to avoid shared-array bugs
        this.matrices[i]!.elements = [...m.elements];
      }
    }
    getMatrixAt(i: number) { return this.matrices[i] ?? new Matrix4(); }
    setColorAt(i: number, c: Color) {
      if (this.colors[i]) {
        this.colors[i]!.r = c.r;
        this.colors[i]!.g = c.g;
        this.colors[i]!.b = c.b;
      }
    }
    getColorAt(i: number) { return this.colors[i] ?? new Color(); }
  }
  const FrontSide = 0;
  return {
    Vector3, Matrix4, Quaternion, Object3D, Group, BufferGeometry, PlaneGeometry, BoxGeometry,
    InstancedBufferAttribute, MeshPhysicalMaterial, InstancedMesh, Color, FrontSide,
  };
});

vi.mock('../../shared/AxesRenderer', () => ({
  AxesRenderer: class { update = vi.fn(); dispose = vi.fn(); },
}));

import * as THREE from 'three';
import { HeatmapRenderer } from '../HeatmapRenderer';
import { darkGlassChartTheme } from '../../../themes/darkGlass';
import type { ResolvedDataFrame } from '../../../data/types';
import type { ChartRenderContext } from '../../shared/IChartRenderer';

function makeCtx(data: ResolvedDataFrame, overrides: Partial<ChartRenderContext> = {}): ChartRenderContext {
  return {
    seriesGroup: new THREE.Group(),
    axesGroup: new THREE.Group(),
    legendGroup: new THREE.Group(),
    data,
    xAxis: { axis: 'x', field: 'row' },
    yAxis: { axis: 'y', field: 'col' },
    series: [{ field: 'value' }],
    bounds: { width: 4, height: 3, depth: 0.4 },
    theme: darkGlassChartTheme,
    opacity: 1,
    typeOptions: { kind: 'heatmap', options: {} },
    dataLabels: null,
    gridlines: null,
    legend: null,
    ...overrides,
  };
}

// 2×3 grid = 6 cells
const gridData: ResolvedDataFrame = {
  rows: [
    { row: 'R1', col: 'C1', value: 10 },
    { row: 'R1', col: 'C2', value: 50 },
    { row: 'R1', col: 'C3', value: 90 },
    { row: 'R2', col: 'C1', value: 20 },
    { row: 'R2', col: 'C2', value: 60 },
    { row: 'R2', col: 'C3', value: 80 },
  ],
  fields: ['row', 'col', 'value'],
};

// Time-series data: 2 time steps × 2×2 grid
const timeData: ResolvedDataFrame = {
  rows: [
    { week: 'W1', row: 'R1', col: 'C1', value: 10 },
    { week: 'W1', row: 'R1', col: 'C2', value: 20 },
    { week: 'W1', row: 'R2', col: 'C1', value: 30 },
    { week: 'W1', row: 'R2', col: 'C2', value: 40 },
    { week: 'W2', row: 'R1', col: 'C1', value: 50 },
    { week: 'W2', row: 'R1', col: 'C2', value: 60 },
    { week: 'W2', row: 'R2', col: 'C1', value: 70 },
    { week: 'W2', row: 'R2', col: 'C2', value: 80 },
  ],
  fields: ['week', 'row', 'col', 'value'],
};

describe('HeatmapRenderer V2', () => {
  let renderer: HeatmapRenderer;
  let groups: { seriesGroup: THREE.Group; axesGroup: THREE.Group; legendGroup: THREE.Group };

  beforeEach(() => {
    renderer = new HeatmapRenderer();
    groups = {
      seriesGroup: new THREE.Group(),
      axesGroup: new THREE.Group(),
      legendGroup: new THREE.Group(),
    };
  });

  it('basic render: instanceCount matches xField × yField grid size', () => {
    renderer.update(makeCtx(gridData, groups));
    const objects = renderer.getInteractiveObjects();
    expect(objects).toHaveLength(1);
    const mesh = objects[0] as THREE.InstancedMesh;
    // 2 rows × 3 cols = 6 cells
    expect(mesh.count).toBe(6);
  });

  it('heightField encoding: larger heightField value → larger Y scale on instance', () => {
    const heightData: ResolvedDataFrame = {
      rows: [
        { row: 'R1', col: 'C1', value: 50, height: 10 },
        { row: 'R1', col: 'C2', value: 50, height: 80 },
      ],
      fields: ['row', 'col', 'value', 'height'],
    };
    renderer.update(makeCtx(heightData, {
      ...groups,
      typeOptions: { kind: 'heatmap', options: { heightField: 'height' } },
    }));
    const mesh = renderer.getInteractiveObjects()[0] as THREE.InstancedMesh;
    const m0 = mesh.getMatrixAt(0); // height=10 (small)
    const m1 = mesh.getMatrixAt(1); // height=80 (large)
    // Y scale (element[5]) should be larger for bigger heightField value
    expect(m1.elements[5]).toBeGreaterThan(m0.elements[5]);
  });

  it('colorInterpolator=viridis: min value is dark, max value is bright', () => {
    const extremeData: ResolvedDataFrame = {
      rows: [
        { row: 'R1', col: 'C1', value: 0 },   // min → dark viridis
        { row: 'R1', col: 'C2', value: 100 },  // max → bright viridis
      ],
      fields: ['row', 'col', 'value'],
    };
    renderer.update(makeCtx(extremeData, {
      ...groups,
      typeOptions: { kind: 'heatmap', options: { colorInterpolator: 'viridis' } },
    }));
    const mesh = renderer.getInteractiveObjects()[0] as THREE.InstancedMesh;
    const cLow = mesh.getColorAt(0);
    const cHigh = mesh.getColorAt(1);
    // High end of viridis has higher green channel
    expect(cHigh.g).toBeGreaterThan(cLow.g);
  });

  it('timeField slicing: updateSlice switches displayed time slice', () => {
    // Use data where R1C1 is min in W1 but max in W2 (relative position flips)
    // This ensures normalized color differs between slices for the same cell.
    const invertedTimeData: ResolvedDataFrame = {
      rows: [
        // W1: R1C1=0 (dark/min), R1C2=100 (bright/max)
        { week: 'W1', row: 'R1', col: 'C1', value: 0 },
        { week: 'W1', row: 'R1', col: 'C2', value: 100 },
        // W2: R1C1=100 (bright/max), R1C2=0 (dark/min)
        { week: 'W2', row: 'R1', col: 'C1', value: 100 },
        { week: 'W2', row: 'R1', col: 'C2', value: 0 },
      ],
      fields: ['week', 'row', 'col', 'value'],
    };
    const ctx = makeCtx(invertedTimeData, {
      ...groups,
      xAxis: { axis: 'x', field: 'row' },
      yAxis: { axis: 'y', field: 'col' },
      typeOptions: { kind: 'heatmap', options: { timeField: 'week' } },
    });
    renderer.update(ctx);

    const mesh = renderer.getInteractiveObjects()[0] as THREE.InstancedMesh;
    expect(mesh.count).toBe(2); // 1 row × 2 cols per time slice

    // Slice 0 (W1): R1C1=0 (min→dark), R1C2=100 (max→bright)
    renderer.updateSlice(0, ctx);
    const c0_slice0_g = mesh.getColorAt(0).g;  // R1C1 at W1 = dark
    const c1_slice0_g = mesh.getColorAt(1).g;  // R1C2 at W1 = bright

    // Slice 1 (W2): R1C1=100 (max→bright), R1C2=0 (min→dark)
    renderer.updateSlice(1, ctx);
    const c0_slice1_g = mesh.getColorAt(0).g;  // R1C1 at W2 = bright
    const c1_slice1_g = mesh.getColorAt(1).g;  // R1C2 at W2 = dark

    // R1C1: bright in W2, dark in W1 → g should be higher in W2
    expect(c0_slice1_g).toBeGreaterThan(c0_slice0_g);
    // R1C2: dark in W2, bright in W1 → g should be higher in W1
    expect(c1_slice0_g).toBeGreaterThan(c1_slice1_g);
  });

  it('no timeField: updateSlice() is a no-op (does not throw)', () => {
    const ctx = makeCtx(gridData, {
      ...groups,
      typeOptions: { kind: 'heatmap', options: {} },
    });
    renderer.update(ctx);
    // Should not throw
    expect(() => renderer.updateSlice(0, ctx)).not.toThrow();
  });

  it('resolveHoverInfo: returns correct row for instanceId', () => {
    renderer.update(makeCtx(gridData, groups));
    const hit = renderer.resolveHoverInfo(
      {
        instanceId: 0,
        object: renderer.getInteractiveObjects()[0]!,
        point: new THREE.Vector3(0, 0, 0),
      } as unknown as THREE.Intersection,
      gridData,
    );
    expect(hit).not.toBeNull();
    expect(hit!.datumIndex).toBe(0);
  });

  it('dispose: releases resources without errors', () => {
    renderer.update(makeCtx(gridData, groups));
    expect(() => renderer.dispose()).not.toThrow();
  });
});
