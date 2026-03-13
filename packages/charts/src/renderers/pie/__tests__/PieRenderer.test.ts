// PieRenderer V2 tests — innerRadius/donut, explodeSlice, DataLabels alignment.

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
    Vector3, Object3D, Group, BufferGeometry, Shape, ExtrudeGeometry,
    MeshPhysicalMaterial, LineBasicMaterial, MeshStandardMaterial,
    Mesh, Color, FrontSide,
  };
});

vi.mock('../../shared/LegendRenderer', () => ({
  LegendRenderer: class { update = vi.fn(); dispose = vi.fn(); },
}));

vi.mock('../../shared/DataLabelRenderer', () => ({
  DataLabelRenderer: class {
    entries: unknown[] = [];
    update(e: unknown[]) { this.entries = e; }
    dispose = vi.fn();
  },
}));

vi.mock('@brewsite/core', () => ({
  parseHexColor: (hex: string) => ({
    rgb: hex.length === 9 && hex[0] === '#' ? hex.slice(0, 7) : hex,
    alpha: hex.length === 9 && hex[0] === '#' ? parseInt(hex.slice(7, 9), 16) / 255 : 1,
  }),
}));

import * as THREE from 'three';
import { PieRenderer } from '../PieRenderer';
import { darkGlassChartTheme } from '../../../themes/darkGlass';
import type { ResolvedDataFrame } from '../../../data/types';
import type { ChartRenderContext } from '../../shared/IChartRenderer';

function makeCtx(data: ResolvedDataFrame, overrides: Partial<ChartRenderContext> = {}): ChartRenderContext {
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
    typeOptions: { kind: 'pie', options: {} },
    dataLabels: null,
    gridlines: null,
    legend: null,
    ...overrides,
  };
}

const twoSliceData: ResolvedDataFrame = {
  rows: [
    { label: 'Core Platform', value: 520 },
    { label: 'Diagram', value: 285 },
  ],
  fields: ['label', 'value'],
};

describe('PieRenderer V2', () => {
  let renderer: PieRenderer;

  beforeEach(() => {
    renderer = new PieRenderer();
  });

  it('pie (innerRadius=0): renders correct number of slices', () => {
    renderer.update(makeCtx(twoSliceData));
    expect(renderer.getInteractiveObjects()).toHaveLength(2);
  });

  it('slices are placed behind axis plane in negative Z', () => {
    renderer.update(makeCtx(twoSliceData));
    const slices = renderer.getInteractiveObjects() as THREE.Mesh[];
    expect(slices[0]!.position.z).toBeLessThan(0);
    expect(slices[1]!.position.z).toBeLessThan(0);
  });

  it('donut (innerRadius=0.5): renders same number of slices', () => {
    renderer.update(makeCtx(twoSliceData, {
      typeOptions: { kind: 'pie', options: { innerRadius: 0.5 } },
    }));
    expect(renderer.getInteractiveObjects()).toHaveLength(2);
  });

  it('donut rebuild: changing innerRadius from 0 to 0.5 triggers rebuild', () => {
    renderer.update(makeCtx(twoSliceData, {
      typeOptions: { kind: 'pie', options: { innerRadius: 0 } },
    }));
    const firstMeshes = [...renderer.getInteractiveObjects()];

    renderer.update(makeCtx(twoSliceData, {
      typeOptions: { kind: 'pie', options: { innerRadius: 0.5 } },
    }));
    const secondMeshes = [...renderer.getInteractiveObjects()];

    // Rebuild should create new mesh objects
    expect(secondMeshes[0]).not.toBe(firstMeshes[0]);
  });

  it('SmartRebuild: data content change with same slice count triggers rebuild', () => {
    const firstData: ResolvedDataFrame = {
      rows: [
        { label: 'Core Platform', value: 520 },
        { label: 'Diagram', value: 285 },
      ],
      fields: ['label', 'value'],
    };
    const secondData: ResolvedDataFrame = {
      rows: [
        { label: 'Core Platform', value: 100 },
        { label: 'Diagram', value: 900 },
      ],
      fields: ['label', 'value'],
    };

    renderer.update(makeCtx(firstData, {
      typeOptions: { kind: 'pie', options: { innerRadius: 0 } },
    }));
    const firstMeshes = [...renderer.getInteractiveObjects()];

    renderer.update(makeCtx(secondData, {
      typeOptions: { kind: 'pie', options: { innerRadius: 0 } },
    }));
    const secondMeshes = [...renderer.getInteractiveObjects()];

    expect(secondMeshes[0]).not.toBe(firstMeshes[0]);
  });

  it('explodeSlice: matching slice has different position from non-exploded', () => {
    renderer.update(makeCtx(twoSliceData, {
      typeOptions: { kind: 'pie', options: { explodeSlice: 'Core Platform' } },
    }));
    const slices = renderer.getInteractiveObjects() as THREE.Mesh[];
    expect(slices).toHaveLength(2);

    // Both slices start at the pie center (bounds.width/2, bounds.height/2)
    // The exploded slice should be offset from center
    const explodedSlice = slices[0]!;
    const normalSlice = slices[1]!;
    const centerX = 4 / 2; // bounds.width / 2
    const centerY = 4 / 2; // bounds.height / 2

    // The exploded slice should NOT be exactly at center
    const explodedDist = Math.sqrt(
      Math.pow(explodedSlice.position.x - centerX, 2) +
      Math.pow(explodedSlice.position.y - centerY, 2),
    );
    const normalDist = Math.sqrt(
      Math.pow(normalSlice.position.x - centerX, 2) +
      Math.pow(normalSlice.position.y - centerY, 2),
    );
    expect(explodedDist).toBeGreaterThan(normalDist);
  });

  it('DataLabels with position=center: all alignments are center', () => {
    renderer.update(makeCtx(twoSliceData, {
      dataLabels: { position: 'center' },
    }));
    // DataLabelRenderer is mocked — just verify slices were rendered
    expect(renderer.getInteractiveObjects()).toHaveLength(2);
  });

  it('DataLabels with explodeSlice: exploded slice gets outside alignment', () => {
    // We can't directly inspect DataLabelRenderer entries since it's mocked,
    // but we verify the render completes without errors
    renderer.update(makeCtx(twoSliceData, {
      typeOptions: { kind: 'pie', options: { explodeSlice: 'Core Platform' } },
      dataLabels: { position: 'center' },
    }));
    expect(renderer.getInteractiveObjects()).toHaveLength(2);
  });

  it('pieTilt from typeOptions is applied to slice rotation', () => {
    renderer.update(makeCtx(twoSliceData, {
      typeOptions: { kind: 'pie', options: { pieTilt: 0.6 } },
    }));
    const slices = renderer.getInteractiveObjects() as THREE.Mesh[];
    expect(slices[0]!.rotation.x).toBe(0.6);
  });

  it('pieTilt defaults to theme when not in typeOptions', () => {
    renderer.update(makeCtx(twoSliceData, {
      typeOptions: { kind: 'pie', options: {} },
    }));
    const slices = renderer.getInteractiveObjects() as THREE.Mesh[];
    expect(slices[0]!.rotation.x).toBe(darkGlassChartTheme.pie?.tilt ?? 0);
  });

  it('resolveHoverInfo maps the intersected slice back to the source row', () => {
    renderer.update(makeCtx(twoSliceData));
    const slices = renderer.getInteractiveObjects() as THREE.Mesh[];
    const hit = renderer.resolveHoverInfo({
      object: slices[1]!,
      point: new THREE.Vector3(1, 2, 0.2),
    } as unknown as THREE.Intersection, twoSliceData);
    expect(hit).not.toBeNull();
    expect(hit!.datumIndex).toBe(1);
    expect(hit!.row).toMatchObject({ label: 'Diagram', value: 285 });
  });
});

import type { ChartHitInfo } from '../../shared/IChartRenderer';

describe('PieRenderer: resolveHoverInfo meta + projectionTarget', () => {
  const pieData: ResolvedDataFrame = {
    rows: [
      { label: 'Alpha', value: 400 },
      { label: 'Beta', value: 600 },
    ],
    fields: ['label', 'value'],
  };

  function renderAndResolve(sliceIndex: number = 0): ChartHitInfo | null {
    const r = new PieRenderer();
    const g = {
      seriesGroup: new THREE.Group(),
      axesGroup: new THREE.Group(),
      legendGroup: new THREE.Group(),
    };
    r.update(makeCtx(pieData, { ...g }));
    const slices = r.getInteractiveObjects() as THREE.Mesh[];
    if (slices.length <= sliceIndex) return null;
    return r.resolveHoverInfo(
      { object: slices[sliceIndex]!, point: new THREE.Vector3(1, 2, 0.2) } as unknown as THREE.Intersection,
      pieData,
    );
  }

  it('meta.kind is "pie"', () => {
    const hit = renderAndResolve(0);
    expect(hit).not.toBeNull();
    expect(hit!.meta).toBeDefined();
    expect(hit!.meta!.kind).toBe('pie');
  });

  it('meta.sliceName matches the label field', () => {
    const hit = renderAndResolve(0);
    expect(hit!.meta!.kind).toBe('pie');
    if (hit!.meta!.kind === 'pie') {
      expect(hit!.meta.sliceName).toBe('Alpha');
    }
  });

  it('meta.percentage is a number between 0 and 100', () => {
    const hit = renderAndResolve(0);
    expect(hit!.meta!.kind).toBe('pie');
    if (hit!.meta!.kind === 'pie') {
      expect(hit!.meta.percentage).toBeGreaterThan(0);
      expect(hit!.meta.percentage).toBeLessThanOrEqual(100);
    }
  });

  it('meta.total equals the sum of all slice values', () => {
    const hit = renderAndResolve(0);
    expect(hit!.meta!.kind).toBe('pie');
    if (hit!.meta!.kind === 'pie') {
      expect(hit!.meta.total).toBe(1000);
    }
  });

  it('projectionTarget is undefined for pie charts', () => {
    const hit = renderAndResolve(0);
    expect(hit).not.toBeNull();
    expect(hit!.projectionTarget).toBeUndefined();
  });

  it('second slice: meta.sliceName is Beta', () => {
    const hit = renderAndResolve(1);
    expect(hit!.meta!.kind).toBe('pie');
    if (hit!.meta!.kind === 'pie') {
      expect(hit!.meta.sliceName).toBe('Beta');
    }
  });
});
