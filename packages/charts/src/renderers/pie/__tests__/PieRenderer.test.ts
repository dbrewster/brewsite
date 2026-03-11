// PieRenderer regression tests for orientation and hover mapping.

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
    rotation = { x: 0, y: 0, z: 0 };
    add(...objs: Object3D[]) { this.children.push(...objs); }
    remove(obj: Object3D) {
      const index = this.children.indexOf(obj);
      if (index >= 0) this.children.splice(index, 1);
    }
  }
  class Group extends Object3D {}
  class BufferGeometry { dispose = vi.fn(); }
  class Shape {
    moveTo = vi.fn();
    lineTo = vi.fn();
    closePath = vi.fn();
  }
  class ExtrudeGeometry extends BufferGeometry {
    constructor(_shape?: Shape, _options?: Record<string, unknown>) { super(); }
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
    Shape,
    ExtrudeGeometry,
    MeshPhysicalMaterial,
    LineBasicMaterial,
    MeshStandardMaterial,
    Mesh,
    Color,
    FrontSide,
  };
});

vi.mock('../../shared/LegendRenderer', () => ({
  LegendRenderer: class { update = vi.fn(); dispose = vi.fn(); },
}));

import * as THREE from 'three';
import { PieRenderer } from '../PieRenderer';
import { darkGlassChartTheme } from '../../../themes/darkGlass';
import type { ResolvedDataFrame } from '../../../data/types';
import type { ChartRenderContext } from '../../shared/IChartRenderer';

function makeCtx(data: ResolvedDataFrame, overrides?: Partial<ChartRenderContext>): ChartRenderContext {
  return {
    seriesGroup: new THREE.Group(),
    axesGroup: new THREE.Group(),
    legendGroup: new THREE.Group(),
    data,
    xAxis: { axis: 'x', field: 'label' },
    yAxis: { axis: 'y', field: 'value' },
    series: [{ field: 'value', label: 'Value' }],
    bounds: { width: 4, height: 4, depth: 0.3 },
    theme: darkGlassChartTheme,
    opacity: 1,
    innerRadius: 0,
    pieTilt: darkGlassChartTheme.pie.tilt,
    ...overrides,
  };
}

describe('PieRenderer', () => {
  let renderer: PieRenderer;

  beforeEach(() => {
    renderer = new PieRenderer();
  });

  it('applies the theme-provided tilt by default', () => {
    const data: ResolvedDataFrame = {
      rows: [
        { label: 'A', value: 60 },
        { label: 'B', value: 40 },
      ],
      fields: ['label', 'value'],
    };

    renderer.update(makeCtx(data));

    const slices = renderer.getInteractiveObjects() as Array<THREE.Mesh>;
    expect(slices).toHaveLength(2);
    expect(slices[0]!.rotation.x).toBe(darkGlassChartTheme.pie.tilt);
  });

  it('applies an explicit pieTilt override from the chart state', () => {
    const data: ResolvedDataFrame = {
      rows: [
        { label: 'A', value: 60 },
        { label: 'B', value: 40 },
      ],
      fields: ['label', 'value'],
    };

    renderer.update(makeCtx(data, { pieTilt: 0.6 }));

    const slices = renderer.getInteractiveObjects() as Array<THREE.Mesh>;
    expect(slices).toHaveLength(2);
    expect(slices[0]!.rotation.x).toBe(0.6);
  });

  it('resolveHoverInfo maps the intersected slice back to the source row', () => {
    const data: ResolvedDataFrame = {
      rows: [
        { label: 'Core', value: 520 },
        { label: 'Diagram', value: 285 },
      ],
      fields: ['label', 'value'],
    };

    renderer.update(makeCtx(data));

    const slices = renderer.getInteractiveObjects() as Array<THREE.Mesh>;
    const hit = renderer.resolveHoverInfo({
      object: slices[1]!,
      point: new THREE.Vector3(1, 2, 0.2),
    } as unknown as THREE.Intersection, data);

    expect(hit).not.toBeNull();
    expect(hit!.datumIndex).toBe(1);
    expect(hit!.row).toMatchObject({ label: 'Diagram', value: 285 });
  });
});
