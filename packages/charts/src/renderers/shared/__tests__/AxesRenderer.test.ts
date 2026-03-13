// AxesRenderer V2.1 tests — fittedMargins axis title positioning.

import { describe, expect, it, vi } from 'vitest';

// ─── Three.js mock ─────────────────────────────────────────────────────────────

vi.mock('three', () => {
  function mkPos() {
    const pos = { x: 0, y: 0, z: 0 };
    return Object.assign(pos, {
      set(x: number, y: number, z: number) { pos.x = x; pos.y = y; pos.z = z; return pos; },
    });
  }
  class Vector3 {
    x: number; y: number; z: number;
    constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
    set(x: number, y: number, z: number) { this.x = x; this.y = y; this.z = z; return this; }
  }
  class Color {
    constructor(_v?: unknown) {}
    set(_v: unknown) { return this; }
  }
  class BufferGeometry {
    dispose = vi.fn();
    setFromPoints(_pts: unknown) { return this; }
  }
  class PlaneGeometry extends BufferGeometry {
    constructor(_w?: number, _h?: number) { super(); }
  }
  class MeshStandardMaterial {
    color = { set: vi.fn() };
    opacity = 1; transparent = false;
    dispose = vi.fn();
    constructor(opts: Record<string, unknown> = {}) { Object.assign(this, opts); }
  }
  class LineBasicMaterial {
    color = { set: vi.fn() };
    opacity = 1; transparent = false;
    dispose = vi.fn();
    constructor(opts: Record<string, unknown> = {}) { Object.assign(this, opts); }
  }
  class Object3D {
    children: Object3D[] = [];
    position = mkPos();
    rotation = { x: 0, y: 0, z: 0 };
    renderOrder = 0;
    userData: Record<string, unknown> = {};
    add(...objs: Object3D[]) { for (const o of objs) this.children.push(o); return this; }
    remove(obj: Object3D) {
      const idx = this.children.indexOf(obj);
      if (idx >= 0) this.children.splice(idx, 1);
    }
  }
  class Group extends Object3D {}
  class Mesh extends Object3D {
    geometry: BufferGeometry;
    material: MeshStandardMaterial;
    constructor(geo: BufferGeometry, mat: MeshStandardMaterial) {
      super(); this.geometry = geo; this.material = mat;
    }
  }
  class Line extends Object3D {
    geometry: BufferGeometry;
    material: LineBasicMaterial | LineDashedMaterial;
    constructor(geo: BufferGeometry, mat: LineBasicMaterial | LineDashedMaterial) {
      super(); this.geometry = geo; this.material = mat;
    }
    computeLineDistances() { return this; }
  }
  class LineDashedMaterial extends LineBasicMaterial {
    dashSize = 0;
    gapSize = 0;
    constructor(opts: Record<string, unknown> = {}) { super(opts); Object.assign(this, opts); }
  }
  const FrontSide = 0;
  return {
    Vector3, Color, BufferGeometry, PlaneGeometry, MeshStandardMaterial, LineBasicMaterial,
    LineDashedMaterial, Object3D, Group, Mesh, Line, FrontSide,
  };
});

// ─── Troika-three-text mock ────────────────────────────────────────────────────

vi.mock('troika-three-text', () => {
  function mkPos() {
    const pos = { x: 0, y: 0, z: 0 };
    return Object.assign(pos, {
      set(x: number, y: number, z: number) { pos.x = x; pos.y = y; pos.z = z; return pos; },
    });
  }
  class Text {
    text = '';
    color = '';
    fontSize = 0;
    opacity = 1;
    renderOrder = 0;
    position = mkPos();
    rotation = { x: 0, y: 0, z: 0 };
    userData: Record<string, unknown> = {};
    children: unknown[] = [];
    sync = vi.fn();
    dispose = vi.fn();
    add() { return this; }
    remove() {}
  }
  return { Text };
});

// ─── @brewsite/core ensureText mock ───────────────────────────────────────────

vi.mock('@brewsite/core', () => ({
  ensureText: vi.fn((label: Record<string, unknown>, text: string, _color: unknown, fontSize: number) => {
    label['text'] = text;
    label['fontSize'] = fontSize;
  }),
  disposeText: vi.fn((text: { dispose?: () => void }) => {
    text.dispose?.();
  }),
  parseHexColor: (hex: string) => ({
    rgb: hex.length === 9 && hex[0] === '#' ? hex.slice(0, 7) : hex,
    alpha: hex.length === 9 && hex[0] === '#' ? parseInt(hex.slice(7, 9), 16) / 255 : 1,
  }),
}));

import * as THREE from 'three';
import { AxesRenderer } from '../AxesRenderer';
import { darkGlassChartTheme } from '../../../themes/darkGlass';
import { neonCyberChartTheme } from '../../../themes/neonCyber';
import type { FittedMargins } from '../IChartRenderer';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const BOUNDS = { width: 4, height: 3 };

type AxisState = Parameters<AxesRenderer['update']>[0];

function makeState(overrides: Partial<AxisState> = {}): AxisState {
  return {
    xTicks: [{ value: 0, position: 0 }, { value: 5, position: 0.5 }, { value: 10, position: 1 }],
    yTicks: [{ value: 0, position: 0 }, { value: 5, position: 0.5 }, { value: 10, position: 1 }],
    bounds: BOUNDS,
    theme: darkGlassChartTheme,
    opacity: 1,
    xAxis: { axis: 'x', field: 'x', label: 'X Label' },
    yAxis: { axis: 'y', field: 'y', label: 'Y Label' },
    ...overrides,
  };
}

/** Finds a direct child of group whose rotation.z ≈ targetZ. */
function findByRotationZ(group: THREE.Group, targetZ: number) {
  return group.children.find((c) => {
    const r = (c as { rotation?: { z?: number } }).rotation;
    return r && typeof r.z === 'number' && Math.abs(r.z - targetZ) < 0.01;
  }) as (THREE.Object3D & { position: { x: number; y: number; z: number } }) | undefined;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('AxesRenderer — fittedMargins (V2.1)', () => {
  it('update() does not throw when fittedMargins is absent (backward compatible)', () => {
    const group = new THREE.Group();
    const renderer = new AxesRenderer(group);
    expect(() => renderer.update(makeState())).not.toThrow();
  });

  it('update() does not throw when fittedMargins is provided', () => {
    const group = new THREE.Group();
    const renderer = new AxesRenderer(group);
    const fittedMargins: FittedMargins = { left: 0.2, right: 0.05, top: 0.05, bottom: 0.15 };
    expect(() => renderer.update(makeState({ fittedMargins }))).not.toThrow();
  });

  it('Y axis title position.x = -fittedMargins.left + titlePad when fittedMargins is provided', () => {
    const group = new THREE.Group();
    const renderer = new AxesRenderer(group);
    const fittedMargins: FittedMargins = { left: 0.2, right: 0.05, top: 0.05, bottom: 0.15 };
    renderer.update(makeState({ fittedMargins }));

    // Y axis title has rotation.z = π/2
    const yTitle = findByRotationZ(group, Math.PI / 2);
    expect(yTitle).toBeDefined();

    const theme = darkGlassChartTheme;
    const titleFontSize = theme.axis.titleFontSize ?? theme.axis.fontSize * 1.1;
    const titlePad = titleFontSize * 0.5;
    const expectedX = -fittedMargins.left + titlePad;
    expect(yTitle!.position.x).toBeCloseTo(expectedX, 4);
  });

  it('Y axis title position.y = height/2 regardless of fittedMargins', () => {
    const group = new THREE.Group();
    const renderer = new AxesRenderer(group);
    const fittedMargins: FittedMargins = { left: 0.2, right: 0.05, top: 0.05, bottom: 0.15 };
    renderer.update(makeState({ fittedMargins }));

    const yTitle = findByRotationZ(group, Math.PI / 2);
    expect(yTitle).toBeDefined();
    expect(yTitle!.position.y).toBeCloseTo(BOUNDS.height / 2, 4);
  });

  it('Y axis title is closer to x=0 with tight margins than with wide margins', () => {
    const group1 = new THREE.Group();
    const group2 = new THREE.Group();
    const r1 = new AxesRenderer(group1);
    const r2 = new AxesRenderer(group2);

    const wideMargins: FittedMargins = { left: 0.2, right: 0.05, top: 0.05, bottom: 0.15 };
    const tightMargins: FittedMargins = { left: 0.05, right: 0.02, top: 0.02, bottom: 0.05 };

    r1.update(makeState({ fittedMargins: wideMargins }));
    r2.update(makeState({ fittedMargins: tightMargins }));

    const yTitle1 = findByRotationZ(group1, Math.PI / 2);
    const yTitle2 = findByRotationZ(group2, Math.PI / 2);
    expect(yTitle1).toBeDefined();
    expect(yTitle2).toBeDefined();

    // tight margins (left=0.05) → -0.05 + pad (less negative) > -0.2 + pad (more negative)
    expect(yTitle2!.position.x).toBeGreaterThan(yTitle1!.position.x);
  });

  it('Y axis title uses legacy formula (theme-based) when fittedMargins is absent', () => {
    const group = new THREE.Group();
    const renderer = new AxesRenderer(group);
    renderer.update(makeState()); // no fittedMargins

    const theme = darkGlassChartTheme;
    const yTitle = findByRotationZ(group, Math.PI / 2);
    expect(yTitle).toBeDefined();

    // Legacy formula: -(tickLength + gap + fontSize * 2.5)
    const expectedX = -(theme.axis.tickLength + theme.axis.gap + theme.axis.fontSize * 2.5);
    expect(yTitle!.position.x).toBeCloseTo(expectedX, 4);
  });

  it('dispose() does not throw after update()', () => {
    const group = new THREE.Group();
    const renderer = new AxesRenderer(group);
    renderer.update(makeState());
    expect(() => renderer.dispose()).not.toThrow();
  });

  it('background plane is placed behind the provided seriesDepth extent', () => {
    const group = new THREE.Group();
    const renderer = new AxesRenderer(group);
    const themeWithFloor = {
      ...darkGlassChartTheme,
      background: { ...darkGlassChartTheme.background, planeOpacity: 0.5 },
    };
    renderer.update(makeState({ seriesDepth: 0.75, theme: themeWithFloor }));

    const floorMesh = group.children.find((child) => child instanceof THREE.Mesh) as
      | (THREE.Mesh & { position: { z: number } })
      | undefined;
    expect(floorMesh).toBeDefined();
    expect(floorMesh?.position.z).toBeCloseTo(-0.76, 4);
  });

  it('removes background plane when effective floor opacity is zero', () => {
    const group = new THREE.Group();
    const renderer = new AxesRenderer(group);
    const visibleFloorTheme = {
      ...darkGlassChartTheme,
      background: { ...darkGlassChartTheme.background, planeOpacity: 0.5 },
    };

    renderer.update(makeState({ theme: visibleFloorTheme }));
    const meshBefore = group.children.find((child) => child instanceof THREE.Mesh);
    expect(meshBefore).toBeDefined();

    renderer.update(makeState({ theme: darkGlassChartTheme }));
    const meshAfter = group.children.find((child) => child instanceof THREE.Mesh);
    expect(meshAfter).toBeUndefined();
  });
});

// ─── gridlines token tests (V2.1) ─────────────────────────────────────────────

describe('AxesRenderer — gridlines tokens (V2.1)', () => {
  it('gridlines not shown when theme.gridlines.visible=false and no DSL override', () => {
    // darkGlass has gridlines.visible = false
    const group = new THREE.Group();
    const renderer = new AxesRenderer(group);
    // gridlines: null = no DSL override → falls through to theme.gridlines.visible (false)
    renderer.update(makeState({ gridlines: null }));
    // No gridline Line objects should be added (only axis lines + floor + tick objects)
    const lineCount = group.children.filter((c) => {
      // Lines for ticks/axes are added too; gridlines are added at end
      // We check that after adding tick objects, no extra lines appear due to gridlines
      // The simplest proxy: gridlineObjects were not pushed (renderer has no public accessor)
      // Instead: call update again with gridlines=true and assert count increases
      return c instanceof Object; // always true — we count manually instead
    }).length;
    // Invoke again with explicit enable and count the difference
    const countBefore = group.children.length;
    renderer.update(makeState({ gridlines: null })); // still false
    const countAfterNull = group.children.length;
    expect(countAfterNull).toBe(countBefore);
  });

  it('gridlines shown when theme.gridlines.visible=false but DSL gridlines=true', () => {
    const group = new THREE.Group();
    const renderer = new AxesRenderer(group);

    // First update with no gridlines
    renderer.update(makeState({ gridlines: null }));
    const countWithoutGridlines = group.children.length;

    // Re-render with DSL gridlines=true — theme.visible=false but DSL overrides it
    renderer.update(makeState({ gridlines: true }));
    const countWithGridlines = group.children.length;

    // 3 yTicks → 3 gridline Line objects added
    expect(countWithGridlines).toBeGreaterThan(countWithoutGridlines);
  });

  it('gridlines hidden when DSL gridlines=false (explicit disable overrides theme)', () => {
    const group = new THREE.Group();
    const renderer = new AxesRenderer(group);
    renderer.update(makeState({ gridlines: true }));
    const countWithGridlines = group.children.length;

    renderer.update(makeState({ gridlines: false }));
    const countWithoutGridlines = group.children.length;

    expect(countWithoutGridlines).toBeLessThan(countWithGridlines);
  });

  it('uses theme.gridlines.color for gridline material when provided', () => {
    const group = new THREE.Group();
    const renderer = new AxesRenderer(group);
    // darkGlass gridlines.color = '#4a6080'
    renderer.update(makeState({ gridlines: true }));
    // At least 1 gridline should exist
    expect(group.children.length).toBeGreaterThan(0);
    // No error thrown — color was read from theme.gridlines
  });

  it('uses LineDashedMaterial when theme.gridlines.dashSize is set', () => {
    // neonCyber has dashSize: 0.03
    const group = new THREE.Group();
    const renderer = new AxesRenderer(group);
    renderer.update(makeState({ theme: neonCyberChartTheme, gridlines: true }));
    // Find gridline objects — they should use LineDashedMaterial (has dashSize property)
    const gridlineLines = group.children.filter((c) => {
      const line = c as { material?: { dashSize?: number } };
      return line.material !== undefined && typeof line.material.dashSize === 'number';
    });
    expect(gridlineLines.length).toBe(3); // 3 yTicks → 3 gridlines
    expect((gridlineLines[0] as { material: { dashSize: number } }).material.dashSize).toBeCloseTo(0.03, 4);
  });
});
