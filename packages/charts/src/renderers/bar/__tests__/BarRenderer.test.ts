import { beforeEach, describe, expect, it, vi } from 'vitest';

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
    remove(obj: Object3D) {
      const index = this.children.indexOf(obj);
      if (index >= 0) this.children.splice(index, 1);
    }
  }
  class Group extends Object3D {}
  class BufferGeometry { dispose = vi.fn(); }
  class BoxGeometry extends BufferGeometry {
    constructor(_width?: number, _height?: number, _depth?: number) { super(); }
  }
  class MockMaterial {
    opacity = 1;
    transparent = false;
    color = {};
    emissive = {};
    emissiveIntensity = 0;
    metalness = 0;
    roughness = 0;
    transmission = 0;
    dispose = vi.fn();
    constructor(options: Record<string, unknown> = {}) { Object.assign(this, options); }
  }
  class MeshPhysicalMaterial extends MockMaterial {}
  class LineBasicMaterial extends MockMaterial {}
  class MeshStandardMaterial extends MockMaterial {}
  class Mesh extends Object3D {
    geometry: BufferGeometry;
    material: MockMaterial;
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
    Vector3,
    Object3D,
    Group,
    BufferGeometry,
    BoxGeometry,
    MeshPhysicalMaterial,
    LineBasicMaterial,
    MeshStandardMaterial,
    Mesh,
    Color,
    FrontSide,
  };
});

vi.mock('../../shared/AxesRenderer', () => ({
  AxesRenderer: class { update = vi.fn(); dispose = vi.fn(); },
}));

vi.mock('../../shared/LegendRenderer', () => ({
  LegendRenderer: class { update = vi.fn(); dispose = vi.fn(); },
}));

import * as THREE from 'three';
import { BarRenderer } from '../BarRenderer';
import { darkGlassChartTheme } from '../../../themes/darkGlass';
import type { ResolvedDataFrame } from '../../../data/types';
import type { ChartRenderContext } from '../../shared/IChartRenderer';

function makeCtx(
  data: ResolvedDataFrame,
  groups: { seriesGroup: THREE.Group; axesGroup: THREE.Group; legendGroup: THREE.Group },
): ChartRenderContext {
  return {
    seriesGroup: groups.seriesGroup,
    axesGroup: groups.axesGroup,
    legendGroup: groups.legendGroup,
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
    innerRadius: 0,
    pieTilt: 0,
  };
}

describe('BarRenderer', () => {
  let renderer: BarRenderer;

  beforeEach(() => {
    renderer = new BarRenderer();
  });

  it('rebuilds bars after transitioning through an empty dataset', () => {
    const populated: ResolvedDataFrame = {
      rows: [
        { month: 'Jan', revenue: 120, costs: 80 },
        { month: 'Feb', revenue: 140, costs: 95 },
      ],
      fields: ['month', 'revenue', 'costs'],
    };
    const empty: ResolvedDataFrame = {
      rows: [],
      fields: ['month', 'revenue', 'costs'],
    };

    const groups = {
      seriesGroup: new THREE.Group(),
      axesGroup: new THREE.Group(),
      legendGroup: new THREE.Group(),
    };

    const initialCtx = makeCtx(populated, groups);
    renderer.update(initialCtx);
    expect(renderer.getInteractiveObjects()).toHaveLength(4);
    expect(initialCtx.seriesGroup.children).toHaveLength(4);

    const emptyCtx = makeCtx(empty, groups);
    renderer.update(emptyCtx);
    expect(renderer.getInteractiveObjects()).toHaveLength(0);
    expect(emptyCtx.seriesGroup.children).toHaveLength(0);

    const restoredCtx = makeCtx(populated, groups);
    renderer.update(restoredCtx);
    expect(renderer.getInteractiveObjects()).toHaveLength(4);
    expect(restoredCtx.seriesGroup.children).toHaveLength(4);
  });
});
