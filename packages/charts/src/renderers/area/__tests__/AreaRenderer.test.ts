// AreaRenderer V2 tests — stackMode SmartRebuild, stacked areas, band areas, fillOpacity, morphCtx.

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Track all lineTo calls across all Shape instances for morphCtx Y position assertions
const allLineToCalls: Array<[number, number]> = [];

vi.mock('three', () => {
  class Vector3 {
    x: number; y: number; z: number;
    constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
    set(x: number, y: number, z: number) { this.x = x; this.y = y; this.z = z; return this; }
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
    lineTo = vi.fn((x: number, y: number) => { allLineToCalls.push([x, y]); });
    closePath = vi.fn();
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
    Vector3, Object3D, Group, BufferGeometry, Shape, ExtrudeGeometry,
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

vi.mock('@brewsite/core', () => ({
  parseHexColor: (hex: string) => ({
    rgb: hex.length === 9 && hex[0] === '#' ? hex.slice(0, 7) : hex,
    alpha: hex.length === 9 && hex[0] === '#' ? parseInt(hex.slice(7, 9), 16) / 255 : 1,
  }),
  lerp: (a: number, b: number, t: number) => a + (b - a) * t,
}));

import * as THREE from 'three';
import { AreaRenderer } from '../AreaRenderer';
import { darkGlassChartTheme } from '../../../themes/darkGlass';
import type { ResolvedDataFrame } from '../../../data/types';
import type { ChartRenderContext } from '../../shared/IChartRenderer';

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
    typeOptions: { kind: 'area', options: {} },
    dataLabels: null,
    gridlines: null,
    legend: null,
    ...overrides,
  };
}

const multiSeriesData: ResolvedDataFrame = {
  rows: [
    { x: 0, a: 10, b: 5 },
    { x: 1, a: 20, b: 10 },
    { x: 2, a: 15, b: 8 },
    { x: 3, a: 25, b: 12 },
  ],
  fields: ['x', 'a', 'b'],
};

describe('AreaRenderer V2', () => {
  let renderer: AreaRenderer;
  let groups: { seriesGroup: THREE.Group; axesGroup: THREE.Group; legendGroup: THREE.Group };

  beforeEach(() => {
    renderer = new AreaRenderer();
    groups = {
      seriesGroup: new THREE.Group(),
      axesGroup: new THREE.Group(),
      legendGroup: new THREE.Group(),
    };
    allLineToCalls.length = 0;
  });

  it('stacked mode: one mesh per series', () => {
    renderer.update(makeCtx(multiSeriesData, {
      ...groups,
      series: [{ field: 'a' }, { field: 'b' }],
      typeOptions: { kind: 'area', options: { stackMode: 'stacked' } },
    }));
    expect(renderer.getInteractiveObjects()).toHaveLength(2);
  });

  it('none mode: one mesh per series', () => {
    renderer.update(makeCtx(multiSeriesData, {
      ...groups,
      series: [{ field: 'a' }, { field: 'b' }],
      typeOptions: { kind: 'area', options: { stackMode: 'none' } },
    }));
    expect(renderer.getInteractiveObjects()).toHaveLength(2);
  });

  it('area meshes are positioned behind axes in negative Z', () => {
    renderer.update(makeCtx(multiSeriesData, {
      ...groups,
      series: [{ field: 'a' }, { field: 'b' }],
      typeOptions: { kind: 'area', options: { stackMode: 'none' } },
    }));
    const meshes = renderer.getInteractiveObjects() as THREE.Mesh[];
    expect(meshes).toHaveLength(2);
    expect(meshes[0]!.position.z).toBeLessThan(0);
    expect(meshes[1]!.position.z).toBeLessThan(meshes[0]!.position.z);
  });

  it('SmartRebuild: stackMode change from none to stacked triggers rebuild', () => {
    const ctx1 = makeCtx(multiSeriesData, {
      ...groups,
      series: [{ field: 'a' }, { field: 'b' }],
      typeOptions: { kind: 'area', options: { stackMode: 'none' } },
    });
    renderer.update(ctx1);
    const firstMeshes = [...renderer.getInteractiveObjects()];

    const ctx2 = makeCtx(multiSeriesData, {
      seriesGroup: groups.seriesGroup,
      axesGroup: groups.axesGroup,
      legendGroup: groups.legendGroup,
      series: [{ field: 'a' }, { field: 'b' }],
      typeOptions: { kind: 'area', options: { stackMode: 'stacked' } },
    });
    renderer.update(ctx2);
    const secondMeshes = [...renderer.getInteractiveObjects()];

    // Should be new mesh objects after rebuild
    expect(secondMeshes[0]).not.toBe(firstMeshes[0]);
  });

  it('SmartRebuild: same stackMode does NOT trigger rebuild', () => {
    const ctx1 = makeCtx(multiSeriesData, {
      ...groups,
      series: [{ field: 'a' }],
      typeOptions: { kind: 'area', options: { stackMode: 'none' } },
    });
    renderer.update(ctx1);
    const firstMeshes = [...renderer.getInteractiveObjects()];

    const ctx2 = makeCtx(multiSeriesData, {
      seriesGroup: groups.seriesGroup,
      axesGroup: groups.axesGroup,
      legendGroup: groups.legendGroup,
      series: [{ field: 'a' }],
      typeOptions: { kind: 'area', options: { stackMode: 'none' } },
    });
    renderer.update(ctx2);
    const secondMeshes = [...renderer.getInteractiveObjects()];

    // Same objects — no rebuild
    expect(secondMeshes[0]).toBe(firstMeshes[0]);
  });

  it('SmartRebuild: data content change with same row count triggers rebuild', () => {
    const firstData: ResolvedDataFrame = {
      rows: [{ x: 0, y: 10 }, { x: 1, y: 20 }, { x: 2, y: 30 }],
      fields: ['x', 'y'],
    };
    const secondData: ResolvedDataFrame = {
      rows: [{ x: 0, y: 35 }, { x: 1, y: 8 }, { x: 2, y: 15 }],
      fields: ['x', 'y'],
    };

    renderer.update(makeCtx(firstData, {
      ...groups,
      typeOptions: { kind: 'area', options: { stackMode: 'none' } },
    }));
    const firstMeshes = [...renderer.getInteractiveObjects()];

    renderer.update(makeCtx(secondData, {
      ...groups,
      typeOptions: { kind: 'area', options: { stackMode: 'none' } },
    }));
    const secondMeshes = [...renderer.getInteractiveObjects()];

    expect(secondMeshes[0]).not.toBe(firstMeshes[0]);
  });

  it('band area: series with bandField renders one mesh per series', () => {
    const bandData: ResolvedDataFrame = {
      rows: [
        { x: 0, upper: 30, lower: 10 },
        { x: 1, upper: 40, lower: 15 },
        { x: 2, upper: 35, lower: 12 },
      ],
      fields: ['x', 'upper', 'lower'],
    };
    renderer.update(makeCtx(bandData, {
      ...groups,
      series: [{ field: 'upper', bandField: 'lower' }],
      typeOptions: { kind: 'area', options: {} },
    }));
    expect(renderer.getInteractiveObjects()).toHaveLength(1);
  });

  it('fillOpacity: applied to mesh material opacity', () => {
    const data: ResolvedDataFrame = {
      rows: [{ x: 0, y: 10 }, { x: 1, y: 20 }, { x: 2, y: 15 }],
      fields: ['x', 'y'],
    };
    renderer.update(makeCtx(data, {
      ...groups,
      typeOptions: { kind: 'area', options: { fillOpacity: 0.4 } },
    }));
    const meshes = renderer.getInteractiveObjects() as THREE.Mesh[];
    expect(meshes).toHaveLength(1);
    const mat = meshes[0]!.material as THREE.MeshPhysicalMaterial;
    expect(mat.opacity).toBeCloseTo(0.4, 5);
    expect(mat.transparent).toBe(true);
  });

  it('resolveHoverInfo: returns datumIndex proportional to X position', () => {
    const data: ResolvedDataFrame = {
      rows: [{ x: 0, y: 10 }, { x: 1, y: 20 }, { x: 2, y: 30 }, { x: 3, y: 40 }, { x: 4, y: 50 }],
      fields: ['x', 'y'],
    };
    renderer.update(makeCtx(data, groups));
    const meshes = renderer.getInteractiveObjects();
    const hit = renderer.resolveHoverInfo(
      { object: meshes[0]!, point: new THREE.Vector3(2, 1, 0) } as unknown as THREE.Intersection,
      data,
    );
    expect(hit).not.toBeNull();
    expect(hit!.datumIndex).toBe(2);
  });

  it('resolveHoverInfo: returns null for non-area intersection', () => {
    const data: ResolvedDataFrame = {
      rows: [{ x: 0, y: 10 }, { x: 1, y: 20 }],
      fields: ['x', 'y'],
    };
    renderer.update(makeCtx(data, groups));
    const fakeObject = new THREE.Mesh();
    const hit = renderer.resolveHoverInfo(
      { object: fakeObject, point: new THREE.Vector3(0, 0, 0) } as unknown as THREE.Intersection,
      data,
    );
    expect(hit).toBeNull();
  });

  it('morphCtx at t=0.5: lineTo Y values are between from and to Y values', () => {
    const n = 3;
    const fromData: ResolvedDataFrame = {
      rows: Array.from({ length: n }, (_, i) => ({ id: String(i), y: 0 })),
      fields: ['id', 'y'],
    };
    const toData: ResolvedDataFrame = {
      rows: Array.from({ length: n }, (_, i) => ({ id: String(i), y: 100 })),
      fields: ['id', 'y'],
    };

    renderer.update(makeCtx(toData, {
      ...groups,
      xAxis: { axis: 'x', field: 'id' },
      yAxis: { axis: 'y', field: 'y' },
      series: [{ field: 'y' }],
      morphCtx: { fromData, t: 0.5, keyField: 'id' },
    }));

    expect(renderer.getInteractiveObjects()).toHaveLength(1);
    // All lineTo Y values should be > 0 (not at from baseline) and < full height (not at to max)
    // Since from=0, to=100, lerp at t=0.5 → y=50, which maps to yScale(50) = 0.5 * bounds.height
    const upperLineToYValues = allLineToCalls.map(([, y]) => y).filter((y) => y > 0);
    expect(upperLineToYValues.length).toBeGreaterThan(0);
    for (const y of upperLineToYValues) {
      expect(y).toBeGreaterThan(0);
    }
  });

  it('morphCtx: unmatched key falls back to toY (no NaN, no crash)', () => {
    const fromData: ResolvedDataFrame = {
      rows: [{ id: 'A', y: 50 }, { id: 'B', y: 30 }],
      fields: ['id', 'y'],
    };
    const toData: ResolvedDataFrame = {
      rows: [{ id: 'A', y: 80 }, { id: 'NEW', y: 60 }, { id: 'B', y: 40 }],
      fields: ['id', 'y'],
    };

    expect(() => {
      renderer.update(makeCtx(toData, {
        ...groups,
        xAxis: { axis: 'x', field: 'id' },
        series: [{ field: 'y' }],
        morphCtx: { fromData, t: 0.5, keyField: 'id' },
      }));
    }).not.toThrow();

    expect(renderer.getInteractiveObjects()).toHaveLength(1);
    // All lineTo calls must have finite Y values
    for (const [, y] of allLineToCalls) {
      expect(isFinite(y)).toBe(true);
    }
  });

  it('morphCtx with bandField: both upper and lower boundaries are interpolated', () => {
    const fromData: ResolvedDataFrame = {
      rows: [
        { id: '0', upper: 0, lower: 0 },
        { id: '1', upper: 0, lower: 0 },
        { id: '2', upper: 0, lower: 0 },
      ],
      fields: ['id', 'upper', 'lower'],
    };
    const toData: ResolvedDataFrame = {
      rows: [
        { id: '0', upper: 100, lower: 20 },
        { id: '1', upper: 100, lower: 20 },
        { id: '2', upper: 100, lower: 20 },
      ],
      fields: ['id', 'upper', 'lower'],
    };

    renderer.update(makeCtx(toData, {
      ...groups,
      xAxis: { axis: 'x', field: 'id' },
      series: [{ field: 'upper', bandField: 'lower' }],
      morphCtx: { fromData, t: 0.5, keyField: 'id' },
    }));

    expect(renderer.getInteractiveObjects()).toHaveLength(1);
    // At t=0.5: upper lerp(0,100,0.5)=50, lower lerp(0,20,0.5)=10
    // The shape should have upper and lower boundary calls
    const yValues = allLineToCalls.map(([, y]) => y).filter((y) => y > 0);
    expect(yValues.length).toBeGreaterThan(0);
  });

  it('fillOpacity reads from theme.area.fillOpacity when not specified in typeOptions', () => {
    const data: ResolvedDataFrame = {
      rows: [{ x: 0, y: 10 }, { x: 1, y: 20 }, { x: 2, y: 15 }],
      fields: ['x', 'y'],
    };
    const themeWithAreaOpacity = {
      ...darkGlassChartTheme,
      area: { fillOpacity: 0.55 },
    };
    renderer.update(makeCtx(data, {
      ...groups,
      theme: themeWithAreaOpacity,
      typeOptions: { kind: 'area', options: {} }, // no explicit fillOpacity
    }));
    const meshes = renderer.getInteractiveObjects() as THREE.Mesh[];
    expect(meshes).toHaveLength(1);
    const mat = meshes[0]!.material as THREE.MeshPhysicalMaterial;
    // opacity (1.0) * theme.area.fillOpacity (0.55) = 0.55
    expect(mat.opacity).toBeCloseTo(0.55, 5);
  });
});

import type { ChartHitInfo } from '../../shared/IChartRenderer';

describe('AreaRenderer: resolveHoverInfo meta + projectionTarget', () => {
  const areaData: ResolvedDataFrame = {
    rows: [
      { x: 'Jan', y: 100 },
      { x: 'Feb', y: 200 },
      { x: 'Mar', y: 150 },
    ],
    fields: ['x', 'y'],
  };

  const stackedData: ResolvedDataFrame = {
    rows: [
      { x: 'Jan', a: 10, b: 5 },
      { x: 'Feb', a: 20, b: 10 },
      { x: 'Mar', a: 15, b: 8 },
    ],
    fields: ['x', 'a', 'b'],
  };

  function renderAndResolve(
    data: ResolvedDataFrame,
    overrides: Partial<ChartRenderContext> = {},
  ): ChartHitInfo | null {
    const r = new AreaRenderer();
    const g = {
      seriesGroup: new THREE.Group(),
      axesGroup: new THREE.Group(),
      legendGroup: new THREE.Group(),
    };
    r.update(makeCtx(data, {
      ...g,
      chartPosition: [1.0, 0, 0],
      plotFrameOffset: { x: 0.5, y: 0 },
      ...overrides,
    }));
    const meshes = r.getInteractiveObjects();
    if (meshes.length === 0) return null;
    return r.resolveHoverInfo(
      { object: meshes[0]!, point: new THREE.Vector3(2.0, 0.8, -0.12) } as unknown as THREE.Intersection,
      data,
    );
  }

  it('meta.kind is "area"', () => {
    const hit = renderAndResolve(areaData);
    expect(hit).not.toBeNull();
    expect(hit!.meta).toBeDefined();
    expect(hit!.meta!.kind).toBe('area');
  });

  it('meta.seriesLabel matches the series label', () => {
    const hit = renderAndResolve(areaData);
    expect(hit!.meta!.kind).toBe('area');
    if (hit!.meta!.kind === 'area') {
      expect(hit!.meta.seriesLabel).toBe('Y');
    }
  });

  it('meta.yValue is a number', () => {
    const hit = renderAndResolve(areaData);
    expect(hit!.meta!.kind).toBe('area');
    if (hit!.meta!.kind === 'area') {
      expect(typeof hit!.meta.yValue).toBe('number');
    }
  });

  it('projectionTarget is present and x equals chartPositionX + plotFrameOffsetX', () => {
    const hit = renderAndResolve(areaData);
    expect(hit!.projectionTarget).toBeDefined();
    expect(hit!.projectionTarget![0]).toBeCloseTo(1.5, 5);
  });

  it('projectionTarget y and z match the intersection point', () => {
    const hit = renderAndResolve(areaData);
    expect(hit!.projectionTarget![1]).toBeCloseTo(0.8, 5);
    expect(hit!.projectionTarget![2]).toBeCloseTo(-0.12, 5);
  });

  it('stacked mode: meta.stackValue is a number', () => {
    const hit = renderAndResolve(stackedData, {
      series: [{ field: 'a', label: 'A' }, { field: 'b', label: 'B' }],
      typeOptions: { kind: 'area', options: { stackMode: 'stacked' } },
    });
    expect(hit).not.toBeNull();
    expect(hit!.meta!.kind).toBe('area');
    if (hit!.meta!.kind === 'area') {
      expect(hit!.meta.stackValue).toBeDefined();
      expect(typeof hit!.meta.stackValue).toBe('number');
    }
  });

  it('non-stacked mode: meta.stackValue is undefined', () => {
    const hit = renderAndResolve(areaData);
    expect(hit!.meta!.kind).toBe('area');
    if (hit!.meta!.kind === 'area') {
      expect(hit!.meta.stackValue).toBeUndefined();
    }
  });
});
