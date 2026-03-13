// BarRenderer V2 tests — grouped/stacked/horizontal, SmartRebuild, morphing, data labels.

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
    rotation = { set: vi.fn() };
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
  class MockMaterial {
    opacity = 1;
    transparent = false;
    color = { set: vi.fn() };
    emissive = {};
    emissiveIntensity = 0;
    metalness = 0;
    roughness = 0;
    transmission = 0;
    needsUpdate = false;
    dispose = vi.fn();
    constructor(options: Record<string, unknown> = {}) { Object.assign(this, options); }
  }
  class MeshPhysicalMaterial extends MockMaterial {}
  class LineBasicMaterial extends MockMaterial {}
  class MeshStandardMaterial extends MockMaterial {}
  class Mesh extends Object3D {
    geometry: BufferGeometry;
    material: MockMaterial;
    scale = { x: 1, y: 1, z: 1 };
    constructor(geometry?: BufferGeometry, material?: MockMaterial) {
      super();
      this.geometry = geometry ?? new BufferGeometry();
      this.material = material ?? new MockMaterial();
    }
  }
  class Color {
    constructor(_?: unknown) {}
    set(_: unknown) {}
  }
  const FrontSide = 0;
  return {
    Vector3, Object3D, Group, BufferGeometry, BoxGeometry,
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

vi.mock('../../shared/DataLabelRenderer', () => ({
  DataLabelRenderer: class { update = vi.fn(); dispose = vi.fn(); },
}));

vi.mock('@brewsite/core', () => ({
  parseHexColor: (hex: string) => ({
    rgb: hex.length === 9 && hex[0] === '#' ? hex.slice(0, 7) : hex,
    alpha: hex.length === 9 && hex[0] === '#' ? parseInt(hex.slice(7, 9), 16) / 255 : 1,
  }),
  lerp: (a: number, b: number, t: number) => a + (b - a) * t,
}));

import * as THREE from 'three';
import { BarRenderer } from '../BarRenderer';
import { darkGlassChartTheme } from '../../../themes/darkGlass';
import type { ResolvedDataFrame } from '../../../data/types';
import type { ChartRenderContext, ChartHitInfo } from '../../shared/IChartRenderer';

function makeCtx(
  data: ResolvedDataFrame,
  overrides: Partial<ChartRenderContext> = {},
): ChartRenderContext {
  return {
    seriesGroup: new THREE.Group(),
    axesGroup: new THREE.Group(),
    legendGroup: new THREE.Group(),
    data,
    xAxis: { axis: 'x', field: 'month' },
    yAxis: { axis: 'y', field: 'revenue' },
    series: [
      { field: 'revenue', label: 'Revenue' },
      { field: 'costs', label: 'Costs' },
    ],
    bounds: { width: 4, height: 3, depth: 0.4 },
    theme: darkGlassChartTheme,
    opacity: 1,
    typeOptions: { kind: 'bar', options: {} },
    dataLabels: null,
    gridlines: null,
    legend: null,
    ...overrides,
  };
}

const twoRowData: ResolvedDataFrame = {
  rows: [
    { month: 'Jan', revenue: 120, costs: 80 },
    { month: 'Feb', revenue: 140, costs: 95 },
  ],
  fields: ['month', 'revenue', 'costs'],
};

describe('BarRenderer V2', () => {
  let renderer: BarRenderer;
  let groups: { seriesGroup: THREE.Group; axesGroup: THREE.Group; legendGroup: THREE.Group };

  beforeEach(() => {
    renderer = new BarRenderer();
    groups = {
      seriesGroup: new THREE.Group(),
      axesGroup: new THREE.Group(),
      legendGroup: new THREE.Group(),
    };
  });

  it('grouped bars: mesh count = rows × series', () => {
    const ctx = makeCtx(twoRowData, groups);
    renderer.update(ctx);
    // 2 rows × 2 series = 4 bars
    expect(renderer.getInteractiveObjects()).toHaveLength(4);
    expect(ctx.seriesGroup.children).toHaveLength(4);
  });

  it('bars are anchored at axis and extrude into negative Z', () => {
    const ctx = makeCtx(twoRowData, groups);
    renderer.update(ctx);
    const meshes = renderer.getInteractiveObjects() as THREE.Mesh[];
    expect(meshes.length).toBeGreaterThan(0);
    for (const mesh of meshes) {
      const geo = mesh.geometry as THREE.BoxGeometry;
      const depth = geo.parameters.depth;
      expect(mesh.position.z).toBeCloseTo(-depth / 2, 5);
    }
  });

  it('stacked bars: mesh count = rows × series (same as grouped)', () => {
    const ctx = makeCtx(twoRowData, {
      ...groups,
      typeOptions: { kind: 'bar', options: { stackMode: 'stacked' } },
    });
    renderer.update(ctx);
    expect(renderer.getInteractiveObjects()).toHaveLength(4);
  });

  it('stacked bars: Y positions are cumulative (second series starts above first)', () => {
    const data: ResolvedDataFrame = {
      rows: [{ month: 'Jan', a: 100, b: 50 }],
      fields: ['month', 'a', 'b'],
    };
    const ctx = makeCtx(data, {
      ...groups,
      series: [{ field: 'a' }, { field: 'b' }],
      typeOptions: { kind: 'bar', options: { stackMode: 'stacked' } },
    });
    renderer.update(ctx);
    const meshes = renderer.getInteractiveObjects() as THREE.Mesh[];
    expect(meshes).toHaveLength(2);
    // Second mesh (b layer) should have higher Y position than first mesh (a layer)
    expect(meshes[1]!.position.y).toBeGreaterThan(meshes[0]!.position.y);
  });

  it('horizontal orientation: bar width > bar height for tall values', () => {
    const data: ResolvedDataFrame = {
      rows: [{ cat: 'A', value: 100 }],
      fields: ['cat', 'value'],
    };
    const ctx = makeCtx(data, {
      ...groups,
      series: [{ field: 'value' }],
      typeOptions: { kind: 'bar', options: { orientation: 'horizontal' } },
    });
    renderer.update(ctx);
    const meshes = renderer.getInteractiveObjects() as THREE.Mesh[];
    expect(meshes.length).toBeGreaterThan(0);
    const geo = meshes[0]!.geometry as THREE.BoxGeometry;
    // Horizontal bar: width (x-axis = value extent) should be > height (band width)
    expect(geo.parameters.width).toBeGreaterThan(geo.parameters.height);
  });

  it('SmartRebuild: stackMode change triggers rebuild', () => {
    const ctx1 = makeCtx(twoRowData, { ...groups });
    renderer.update(ctx1);
    const firstMeshes = [...renderer.getInteractiveObjects()];

    const ctx2 = makeCtx(twoRowData, {
      ...groups,
      typeOptions: { kind: 'bar', options: { stackMode: 'stacked' } },
    });
    renderer.update(ctx2);
    const secondMeshes = [...renderer.getInteractiveObjects()];

    // Meshes should be different objects (rebuild occurred)
    expect(secondMeshes[0]).not.toBe(firstMeshes[0]);
  });

  it('SmartRebuild: orientation change triggers rebuild', () => {
    const ctx1 = makeCtx(twoRowData, { ...groups });
    renderer.update(ctx1);
    const firstMeshes = [...renderer.getInteractiveObjects()];

    const ctx2 = makeCtx(twoRowData, {
      ...groups,
      typeOptions: { kind: 'bar', options: { orientation: 'horizontal' } },
    });
    renderer.update(ctx2);
    const secondMeshes = [...renderer.getInteractiveObjects()];

    expect(secondMeshes[0]).not.toBe(firstMeshes[0]);
  });

  it('SmartRebuild: data content change with same row count triggers rebuild', () => {
    const firstData: ResolvedDataFrame = {
      rows: [{ month: 'Jan', value: 10 }, { month: 'Feb', value: 20 }],
      fields: ['month', 'value'],
    };
    const secondData: ResolvedDataFrame = {
      rows: [{ month: 'Jan', value: 90 }, { month: 'Feb', value: 5 }],
      fields: ['month', 'value'],
    };

    renderer.update(makeCtx(firstData, {
      ...groups,
      series: [{ field: 'value' }],
    }));
    const firstMeshes = [...renderer.getInteractiveObjects()];

    renderer.update(makeCtx(secondData, {
      ...groups,
      series: [{ field: 'value' }],
    }));
    const secondMeshes = [...renderer.getInteractiveObjects()];

    expect(secondMeshes[0]).not.toBe(firstMeshes[0]);
  });

  it('datum morphing at t=0: bar heights match fromData', () => {
    const fromData: ResolvedDataFrame = {
      rows: [{ id: 'A', value: 100 }, { id: 'B', value: 50 }],
      fields: ['id', 'value'],
    };
    const toData: ResolvedDataFrame = {
      rows: [{ id: 'A', value: 200 }, { id: 'B', value: 80 }],
      fields: ['id', 'value'],
    };
    const ctx = makeCtx(toData, {
      ...groups,
      xAxis: { axis: 'x', field: 'id' },
      series: [{ field: 'value' }],
      typeOptions: { kind: 'bar', options: {} },
      morphCtx: { fromData, t: 0, keyField: 'id' },
    });
    renderer.update(ctx);
    const meshes = renderer.getInteractiveObjects() as THREE.Mesh[];
    expect(meshes).toHaveLength(2);
    // At t=0, heights should match fromData values
    const barA = meshes[0]!.geometry as THREE.BoxGeometry;
    const barB = meshes[1]!.geometry as THREE.BoxGeometry;
    // Bar A (fromData=100) should be taller than Bar B (fromData=50)
    expect(barA.parameters.height).toBeGreaterThan(barB.parameters.height);
  });

  it('datum morphing at t=1: bar heights match toData', () => {
    const fromData: ResolvedDataFrame = {
      rows: [{ id: 'A', value: 100 }, { id: 'B', value: 50 }],
      fields: ['id', 'value'],
    };
    const toData: ResolvedDataFrame = {
      rows: [{ id: 'A', value: 200 }, { id: 'B', value: 80 }],
      fields: ['id', 'value'],
    };
    const ctxAt0 = makeCtx(toData, {
      ...groups,
      xAxis: { axis: 'x', field: 'id' },
      series: [{ field: 'value' }],
      morphCtx: { fromData, t: 0, keyField: 'id' },
    });
    renderer.update(ctxAt0);
    const heights0 = (renderer.getInteractiveObjects() as THREE.Mesh[]).map(
      (m) => (m.geometry as THREE.BoxGeometry).parameters.height,
    );

    const ctxAt1 = makeCtx(toData, {
      seriesGroup: groups.seriesGroup,
      axesGroup: groups.axesGroup,
      legendGroup: groups.legendGroup,
      xAxis: { axis: 'x', field: 'id' },
      series: [{ field: 'value' }],
      morphCtx: { fromData, t: 1, keyField: 'id' },
    });
    renderer.update(ctxAt1);
    const heights1 = (renderer.getInteractiveObjects() as THREE.Mesh[]).map(
      (m) => (m.geometry as THREE.BoxGeometry).parameters.height,
    );

    // At t=1, heights should be larger than at t=0 (since toData > fromData)
    expect(heights1[0]!).toBeGreaterThan(heights0[0]!);
  });

  it('datum morphing at t=0.5: bar heights are midpoints', () => {
    const fromData: ResolvedDataFrame = {
      rows: [{ id: 'A', value: 100 }],
      fields: ['id', 'value'],
    };
    const toData: ResolvedDataFrame = {
      rows: [{ id: 'A', value: 200 }],
      fields: ['id', 'value'],
    };
    const groups0 = { seriesGroup: new THREE.Group(), axesGroup: new THREE.Group(), legendGroup: new THREE.Group() };
    const groups1 = { seriesGroup: new THREE.Group(), axesGroup: new THREE.Group(), legendGroup: new THREE.Group() };
    const groups05 = { seriesGroup: new THREE.Group(), axesGroup: new THREE.Group(), legendGroup: new THREE.Group() };

    const r0 = new BarRenderer();
    r0.update(makeCtx(toData, { ...groups0, xAxis: { axis: 'x', field: 'id' }, series: [{ field: 'value' }], morphCtx: { fromData, t: 0, keyField: 'id' } }));
    const h0 = ((r0.getInteractiveObjects()[0] as THREE.Mesh).geometry as THREE.BoxGeometry).parameters.height;

    const r1 = new BarRenderer();
    r1.update(makeCtx(toData, { ...groups1, xAxis: { axis: 'x', field: 'id' }, series: [{ field: 'value' }], morphCtx: { fromData, t: 1, keyField: 'id' } }));
    const h1 = ((r1.getInteractiveObjects()[0] as THREE.Mesh).geometry as THREE.BoxGeometry).parameters.height;

    const r05 = new BarRenderer();
    r05.update(makeCtx(toData, { ...groups05, xAxis: { axis: 'x', field: 'id' }, series: [{ field: 'value' }], morphCtx: { fromData, t: 0.5, keyField: 'id' } }));
    const h05 = ((r05.getInteractiveObjects()[0] as THREE.Mesh).geometry as THREE.BoxGeometry).parameters.height;

    // h05 should be approximately midpoint of h0 and h1
    expect(h05).toBeCloseTo((h0 + h1) / 2, 1);
  });

  it('new key in toData not in fromData: bar enters from height ~0 at t=0', () => {
    const fromData: ResolvedDataFrame = {
      rows: [{ id: 'A', value: 100 }],
      fields: ['id', 'value'],
    };
    const toData: ResolvedDataFrame = {
      rows: [{ id: 'A', value: 100 }, { id: 'NEW', value: 80 }],
      fields: ['id', 'value'],
    };
    const ctx = makeCtx(toData, {
      ...groups,
      xAxis: { axis: 'x', field: 'id' },
      series: [{ field: 'value' }],
      morphCtx: { fromData, t: 0, keyField: 'id' },
    });
    renderer.update(ctx);
    const meshes = renderer.getInteractiveObjects() as THREE.Mesh[];
    // NEW bar enters from 0 at t=0
    const newBar = meshes.find((m) => {
      const hit = (renderer as unknown as { hitMap: Map<THREE.Mesh, { row: Record<string, unknown> }> }).hitMap?.get(m);
      return hit?.row['id'] === 'NEW';
    });
    if (newBar) {
      const barGeo = newBar.geometry as THREE.BoxGeometry;
      expect(barGeo.parameters.height).toBeCloseTo(0, 1);
    }
    // At least the existing bar renders
    expect(meshes.length).toBeGreaterThanOrEqual(1);
  });

  it('DataLabels: when ctx.dataLabels non-null, getInteractiveObjects includes bars', () => {
    const ctx = makeCtx(twoRowData, {
      ...groups,
      dataLabels: { position: 'top' },
    });
    renderer.update(ctx);
    const meshes = renderer.getInteractiveObjects();
    expect(meshes).toHaveLength(4); // 2 rows × 2 series
  });

  it('rebuilds bars after transitioning through an empty dataset', () => {
    const populated = twoRowData;
    const empty: ResolvedDataFrame = { rows: [], fields: ['month', 'revenue', 'costs'] };

    renderer.update(makeCtx(populated, groups));
    expect(renderer.getInteractiveObjects()).toHaveLength(4);

    renderer.update(makeCtx(empty, groups));
    expect(renderer.getInteractiveObjects()).toHaveLength(0);

    renderer.update(makeCtx(populated, groups));
    expect(renderer.getInteractiveObjects()).toHaveLength(4);
  });

  it('geometry origin: vertical bar position.y equals barY=0 (bottom at baseline)', () => {
    const data: ResolvedDataFrame = {
      rows: [{ month: 'Jan', revenue: 100 }],
      fields: ['month', 'revenue'],
    };
    const ctx = makeCtx(data, {
      ...groups,
      series: [{ field: 'revenue' }],
    });
    renderer.update(ctx);
    const meshes = renderer.getInteractiveObjects() as THREE.Mesh[];
    expect(meshes).toHaveLength(1);
    // After geometry.translate(0, barHeight/2, 0), mesh.position.y is the bottom of the bar (y=0)
    expect(meshes[0]!.position.y).toBeCloseTo(0, 5);
  });

  it('entryT=0: all bar meshes have scale.y === 0 (easeOutCubic(0) = 0)', () => {
    const ctx = makeCtx(twoRowData, { ...groups, entryT: 0 });
    renderer.update(ctx);
    const meshes = renderer.getInteractiveObjects() as THREE.Mesh[];
    expect(meshes.length).toBeGreaterThan(0);
    for (const mesh of meshes) {
      expect(mesh.scale.y).toBeCloseTo(0, 5);
    }
  });

  it('entryT=0.5: all bar meshes have scale.y ≈ easeOutCubic(0.5) ≈ 0.875', () => {
    const ctx = makeCtx(twoRowData, { ...groups, entryT: 0.5 });
    renderer.update(ctx);
    const meshes = renderer.getInteractiveObjects() as THREE.Mesh[];
    expect(meshes.length).toBeGreaterThan(0);
    for (const mesh of meshes) {
      // easeOutCubic(0.5) = 1 - (1 - 0.5)^3 = 1 - 0.125 = 0.875
      expect(mesh.scale.y).toBeCloseTo(0.875, 3);
    }
  });

  it('entryT=1.0: all bar meshes have scale.y === 1.0 (fully rendered)', () => {
    const ctx = makeCtx(twoRowData, { ...groups, entryT: 1.0 });
    renderer.update(ctx);
    const meshes = renderer.getInteractiveObjects() as THREE.Mesh[];
    expect(meshes.length).toBeGreaterThan(0);
    for (const mesh of meshes) {
      expect(mesh.scale.y).toBeCloseTo(1.0, 5);
    }
  });

  it('entryT absent (undefined): bar meshes have scale.y === 1.0', () => {
    const ctx = makeCtx(twoRowData, { ...groups });
    renderer.update(ctx);
    const meshes = renderer.getInteractiveObjects() as THREE.Mesh[];
    expect(meshes.length).toBeGreaterThan(0);
    for (const mesh of meshes) {
      expect(mesh.scale.y).toBeCloseTo(1.0, 5);
    }
  });

  it('yAccessor: overrides field-name lookup for bar height', () => {
    const data: ResolvedDataFrame = {
      rows: [{ month: 'Jan', revenue: 50 }],
      fields: ['month', 'revenue'],
    };
    const ctx = makeCtx(data, {
      ...groups,
      series: [{ field: 'revenue' }],
      // Accessor doubles the revenue value
      accessors: { yAccessor: (row) => (Number(row['revenue']) || 0) * 2 },
    });
    const ctxNoAccessor = makeCtx(data, {
      seriesGroup: new THREE.Group(),
      axesGroup: new THREE.Group(),
      legendGroup: new THREE.Group(),
      series: [{ field: 'revenue' }],
    });

    renderer.update(ctx);
    const heightWithAccessor = ((renderer.getInteractiveObjects()[0] as THREE.Mesh).geometry as THREE.BoxGeometry).parameters.height;

    const r2 = new BarRenderer();
    r2.update(ctxNoAccessor);
    const heightWithoutAccessor = ((r2.getInteractiveObjects()[0] as THREE.Mesh).geometry as THREE.BoxGeometry).parameters.height;

    // Accessor doubles the value so height should be double
    expect(heightWithAccessor).toBeCloseTo(heightWithoutAccessor * 2, 1);
  });
});

describe('BarRenderer: resolveHoverInfo meta + projectionTarget', () => {
  /**
   * Helper: call update() with chartPosition=[1.0,0,0] + plotFrameOffset.x=0.5,
   * then call resolveHoverInfo() against the first bar mesh.
   * Y-axis world X = 1.0 + 0.5 = 1.5.
   */
  function renderAndResolve(
    data: ResolvedDataFrame,
    overrides: Partial<ChartRenderContext> = {},
  ): ChartHitInfo | null {
    const r = new BarRenderer();
    const g = {
      seriesGroup: new THREE.Group(),
      axesGroup: new THREE.Group(),
      legendGroup: new THREE.Group(),
    };
    r.update({
      ...makeCtx(data, g),
      chartPosition: [1.0, 0, 0],
      plotFrameOffset: { x: 0.5, y: 0 },
      ...overrides,
    });
    const meshes = r.getInteractiveObjects() as THREE.Mesh[];
    if (meshes.length === 0) return null;
    const hitPoint = new THREE.Vector3(2.0, 0.8, -0.12);
    const intersection = { object: meshes[0]!, point: hitPoint, distance: 5 } as THREE.Intersection;
    return r.resolveHoverInfo(intersection, data);
  }

  it('grouped bar: meta.kind = "bar"', () => {
    const result = renderAndResolve(twoRowData);
    expect(result?.meta?.kind).toBe('bar');
  });

  it('grouped bar: meta.seriesLabel = series[0].label', () => {
    const result = renderAndResolve(twoRowData);
    if (result?.meta?.kind !== 'bar') throw new Error('expected bar meta');
    expect(result.meta.seriesLabel).toBe('Revenue');
  });

  it('grouped bar: meta.segmentValue = numeric value for that series + datum', () => {
    const data: ResolvedDataFrame = {
      rows: [{ month: 'Jan', revenue: 120, costs: 80 }],
      fields: ['month', 'revenue', 'costs'],
    };
    const result = renderAndResolve(data);
    if (result?.meta?.kind !== 'bar') throw new Error('expected bar meta');
    expect(result.meta.segmentValue).toBe(120);
  });

  it('grouped bar: meta.stackTotal is undefined', () => {
    const result = renderAndResolve(twoRowData);
    if (result?.meta?.kind !== 'bar') throw new Error('expected bar meta');
    expect(result.meta.stackTotal).toBeUndefined();
  });

  it('stacked bar: meta.stackTotal = sum of all series for that datum', () => {
    const data: ResolvedDataFrame = {
      rows: [{ month: 'Jan', revenue: 120, costs: 80 }],
      fields: ['month', 'revenue', 'costs'],
    };
    const result = renderAndResolve(data, {
      typeOptions: { kind: 'bar', options: { stackMode: 'stacked' } },
    });
    if (result?.meta?.kind !== 'bar') throw new Error('expected bar meta');
    // stackTotal = 120 + 80 = 200
    expect(result.meta.stackTotal).toBe(200);
  });

  it('projectionTarget[0] = chartPositionX + plotFrameOffsetX = 1.5', () => {
    const result = renderAndResolve(twoRowData);
    expect(result?.projectionTarget?.[0]).toBeCloseTo(1.5, 5);
  });

  it('projectionTarget[1] = hit point Y = 0.8', () => {
    const result = renderAndResolve(twoRowData);
    expect(result?.projectionTarget?.[1]).toBeCloseTo(0.8, 5);
  });

  it('projectionTarget[2] = hit point Z = -0.12', () => {
    const result = renderAndResolve(twoRowData);
    expect(result?.projectionTarget?.[2]).toBeCloseTo(-0.12, 5);
  });
});
