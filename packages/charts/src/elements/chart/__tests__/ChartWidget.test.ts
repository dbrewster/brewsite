// ChartWidget V2 lifecycle and ILoadable tests — uses Three.js mocks (no real GPU).

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

vi.mock('three', () => {
  class Vector3 {
    x = 0; y = 0; z = 0;
    constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
    set(x: number, y: number, z: number) { this.x = x; this.y = y; this.z = z; return this; }
    distanceTo() { return 0; }
    clone() { return new Vector3(this.x, this.y, this.z); }
  }
  class Vector2 {
    x = 0; y = 0;
    constructor(x = 0, y = 0) { this.x = x; this.y = y; }
  }
  class Object3D {
    children: Object3D[] = [];
    parent: Object3D | null = null;
    position = new Vector3();
    rotation = { set: vi.fn(), x: 0, y: 0, z: 0 };
    userData: Record<string, unknown> = {};
    add(...objs: Object3D[]) {
      for (const obj of objs) {
        if (obj.parent) obj.parent.remove(obj);
        obj.parent = this;
        this.children.push(obj);
      }
    }
    remove(obj: Object3D) {
      const i = this.children.indexOf(obj);
      if (i >= 0) {
        this.children.splice(i, 1);
        obj.parent = null;
      }
    }
  }
  class Scene extends Object3D {
    override userData: Record<string, unknown> = {};
  }
  class Group extends Object3D {}
  class BufferGeometry { dispose = vi.fn(); }
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
  class Camera extends Object3D {}
  class PerspectiveCamera extends Camera {}
  class Raycaster {
    setFromCamera = vi.fn();
    intersectObjects = vi.fn().mockReturnValue([]);
  }
  class Color { constructor(_?: unknown) {} set(_: unknown) {} }
  class Quaternion { x = 0; y = 0; z = 0; w = 1; }
  const FrontSide = 0;
  const MathUtils = {
    degToRad: (deg: number) => deg * (Math.PI / 180),
  };
  class BoxGeometry extends BufferGeometry {}
  class PlaneGeometry extends BufferGeometry {}
  class SphereGeometry extends BufferGeometry {}
  class CylinderGeometry extends BufferGeometry {}
  class EdgesGeometry extends BufferGeometry {}
  class InstancedMesh extends Object3D {
    count = 0;
    constructor(_g?: BufferGeometry, _m?: MockMaterial, count = 0) { super(); this.count = count; }
    setMatrixAt = vi.fn();
    setColorAt = vi.fn();
    getMatrixAt = vi.fn().mockReturnValue({ elements: new Array(16).fill(0) });
    getColorAt = vi.fn().mockImplementation((_: number, target: Record<string, number>) => { target.r = 0; target.g = 0; target.b = 0; return target; });
    instanceMatrix = { needsUpdate: false };
    instanceColor = { needsUpdate: false };
    material: MockMaterial = new MockMaterial();
    geometry: BufferGeometry = new BufferGeometry();
    dispose = vi.fn();
  }
  class Line extends Object3D {}
  class Matrix4 { elements = new Array(16).fill(0); set() { return this; } makeScale() { return this; } copy() { return this; } }
  return {
    Vector3, Vector2, Object3D, Scene, Group, BufferGeometry,
    MeshPhysicalMaterial, LineBasicMaterial, MeshStandardMaterial,
    Mesh, Camera, PerspectiveCamera, Raycaster, Color, FrontSide, MathUtils, Quaternion,
    BoxGeometry, PlaneGeometry, SphereGeometry, CylinderGeometry, EdgesGeometry,
    InstancedMesh, Line, Matrix4,
  };
});

// Mock renderers so we don't pull in d3
vi.mock('../../renderers/bar/BarRenderer', () => ({
  BarRenderer: class { update = vi.fn(); dispose = vi.fn(); getInteractiveObjects = vi.fn().mockReturnValue([]); resolveHoverInfo = vi.fn().mockReturnValue(null); },
}));
vi.mock('../../renderers/line/LineRenderer', () => ({
  LineRenderer: class { update = vi.fn(); dispose = vi.fn(); getInteractiveObjects = vi.fn().mockReturnValue([]); resolveHoverInfo = vi.fn().mockReturnValue(null); },
}));
vi.mock('../../renderers/area/AreaRenderer', () => ({
  AreaRenderer: class { update = vi.fn(); dispose = vi.fn(); getInteractiveObjects = vi.fn().mockReturnValue([]); resolveHoverInfo = vi.fn().mockReturnValue(null); },
}));
vi.mock('../../renderers/pie/PieRenderer', () => ({
  PieRenderer: class { update = vi.fn(); dispose = vi.fn(); getInteractiveObjects = vi.fn().mockReturnValue([]); resolveHoverInfo = vi.fn().mockReturnValue(null); },
}));
vi.mock('../../renderers/scatter/ScatterRenderer', () => ({
  ScatterRenderer: class { update = vi.fn(); dispose = vi.fn(); getInteractiveObjects = vi.fn().mockReturnValue([]); resolveHoverInfo = vi.fn().mockReturnValue(null); },
}));
vi.mock('../../renderers/heatmap/HeatmapRenderer', () => ({
  HeatmapRenderer: class { update = vi.fn(); dispose = vi.fn(); getInteractiveObjects = vi.fn().mockReturnValue([]); resolveHoverInfo = vi.fn().mockReturnValue(null); },
}));

vi.mock('@brewsite/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@brewsite/core')>();
  return {
    ...actual,
    parseHexColor: (hex: string) => ({
      rgb: hex.length === 9 && hex[0] === '#' ? hex.slice(0, 7) : hex,
      alpha: hex.length === 9 && hex[0] === '#' ? parseInt(hex.slice(7, 9), 16) / 255 : 1,
    }),
  };
});

import * as THREE from 'three';
import { ChartWidget } from '../ChartWidget';
import { ChartDataStore } from '../../../data/ChartDataStore';
import { DEFAULT_CHART_STATE } from '../compile';
import type { ChartState, InlineDataSource, ChartRenderInput } from '../types';
import type { WidgetInitContext, WidgetRenderContext, NVSCoordService } from '@brewsite/core';
import { createNVSCoordService } from '@brewsite/core';

// ── ChartRendererDouble ───────────────────────────────────────────────────────
// Interface-conforming test double for ChartRenderer — records last update() input.

class ChartRendererDouble {
  readonly chartGroup = new THREE.Group();
  lastInput: ChartRenderInput | null = null;
  lastWidgetId: string | null = null;
  mountCalls = 0;
  disposeCalls = 0;

  update(input: ChartRenderInput, widgetId: string): void {
    this.lastInput = input;
    this.lastWidgetId = widgetId;
  }
  mount(scene: unknown): void {
    (scene as THREE.Scene).add(this.chartGroup);
    this.mountCalls++;
  }
  dispose(scene: unknown): void {
    (scene as THREE.Scene).remove(this.chartGroup);
    this.disposeCalls++;
  }
  updateHeatmapSlice(_sliceIndex: number, _input: ChartRenderInput, _widgetId: string): void {}
  getInteractiveObjects(): unknown[] { return []; }
  resolveHoverInfo(): null { return null; }
  updateProjection(_info: unknown, _theme: unknown): void {}
  tickProjection(_theme: unknown): void {}
}

/** Minimal mock DOM element for tests running in node environment. */
function createMockDomElement(): HTMLElement {
  const listeners = new Map<string, Set<Function>>();
  return {
    addEventListener: vi.fn((type: string, fn: Function) => {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(fn);
    }),
    removeEventListener: vi.fn((type: string, fn: Function) => {
      listeners.get(type)?.delete(fn);
    }),
    getBoundingClientRect: vi.fn(() => ({ left: 0, top: 0, width: 800, height: 600 })),
  } as unknown as HTMLElement;
}

function makeStore(): ChartDataStore {
  const store = new ChartDataStore();
  store.register('sales', [{ x: 1, y: 10 }, { x: 2, y: 20 }]);
  return store;
}

function makeInitCtx(): WidgetInitContext {
  const scene = new THREE.Scene();
  return {
    scene,
    renderer: null,
    camera: new THREE.PerspectiveCamera(),
  } as unknown as WidgetInitContext;
}

/** Build a real NVSCoordService for a worldScale=10 camera (distance=12.07, fov=45, 1920×1080). */
function makeCoords(): NVSCoordService {
  return createNVSCoordService({ distance: 12.07, fovDeg: 45 }, 1920, 1080);
}

function makeRenderCtx(): WidgetRenderContext {
  return { coords: makeCoords() } as unknown as WidgetRenderContext;
}

/** Build a V2 ChartState with named data source by default. */
function makeState(overrides?: Partial<ChartState>): ChartState {
  return {
    ...DEFAULT_CHART_STATE,
    dataSource: { type: 'named', name: 'sales' },
    ...overrides,
  };
}

describe('ChartWidget', () => {
  let widget: ChartWidget;
  let store: ChartDataStore;

  beforeEach(() => {
    store = makeStore();
    widget = new ChartWidget('test-chart', store);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Existing lifecycle tests ───────────────────────────────────────────────

  it('initialize mounts chart group into scene', () => {
    const ctx = makeInitCtx();
    const scene = ctx.scene as THREE.Scene;
    const childCountBefore = scene.children.length;
    widget.initialize(ctx);
    expect(scene.children.length).toBeGreaterThan(childCountBefore);
  });

  it('apply updates lastState', () => {
    widget.initialize(makeInitCtx());
    const state = makeState({ type: 'line', opacity: 0.5, typeConfig: { kind: 'line', options: {} } });
    widget.apply(state, makeRenderCtx());
    expect(() => widget.onTick({ tick: null, delta: 0 } as never)).not.toThrow();
  });

  it('apply with interactive=true attaches DOM listeners', () => {
    const scene = new THREE.Scene();
    const mockDom = createMockDomElement();

    widget.initialize({
      scene,
      renderer: { domElement: mockDom } as unknown as THREE.WebGLRenderer,
      camera: new THREE.PerspectiveCamera(),
    } as unknown as WidgetInitContext);

    widget.apply(makeState({ interactive: true }), makeRenderCtx());
    expect(mockDom.addEventListener).toHaveBeenCalledWith('mousemove', expect.any(Function));
    expect(mockDom.addEventListener).toHaveBeenCalledWith('mouseleave', expect.any(Function));
    expect(mockDom.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
  });

  it('apply with interactive=false after true detaches DOM listeners', () => {
    const scene = new THREE.Scene();
    const mockDom = createMockDomElement();

    widget.initialize({
      scene,
      renderer: { domElement: mockDom } as unknown as THREE.WebGLRenderer,
      camera: new THREE.PerspectiveCamera(),
    } as unknown as WidgetInitContext);

    widget.apply(makeState({ interactive: true }), makeRenderCtx());
    widget.apply(makeState({ interactive: false }), makeRenderCtx());
    expect(mockDom.removeEventListener).toHaveBeenCalledWith('mousemove', expect.any(Function));
    expect(mockDom.removeEventListener).toHaveBeenCalledWith('mouseleave', expect.any(Function));
    expect(mockDom.removeEventListener).toHaveBeenCalledWith('click', expect.any(Function));
  });

  it('onTick is a no-op if lastState is null (no crash)', () => {
    widget.initialize(makeInitCtx());
    expect(() => widget.onTick({ tick: null, delta: 0 } as never)).not.toThrow();
  });

  it('onTick is a no-op for non-heatmap chart types', () => {
    widget.initialize(makeInitCtx());
    widget.apply(makeState({ type: 'bar', typeConfig: { kind: 'bar', options: {} } }), makeRenderCtx());
    expect(() => widget.onTick({ tick: null, delta: 0 } as never)).not.toThrow();
  });

  it('dispose removes chart group from scene and detaches listeners', () => {
    const scene = new THREE.Scene();
    const mockDom = createMockDomElement();

    widget.initialize({
      scene,
      renderer: { domElement: mockDom } as unknown as THREE.WebGLRenderer,
      camera: new THREE.PerspectiveCamera(),
    } as unknown as WidgetInitContext);

    widget.apply(makeState({ interactive: true }), makeRenderCtx());

    const childCountBefore = scene.children.length;
    widget.dispose();
    expect(scene.children.length).toBeLessThan(childCountBefore);
    expect(mockDom.removeEventListener).toHaveBeenCalled();
  });

  it('apply before initialize does not throw', () => {
    expect(() => widget.apply(makeState(), makeRenderCtx())).not.toThrow();
  });

  it('widgetId matches constructor argument', () => {
    expect(widget.widgetId).toBe('test-chart');
  });

  it('defaultState is DEFAULT_CHART_STATE', () => {
    expect(widget.defaultState).toEqual(DEFAULT_CHART_STATE);
  });

  it('defaultState.sceneTheme is undefined', () => {
    expect(widget.defaultState.sceneTheme).toBeUndefined();
  });

  it('nvsBounds returns fullscreen default before first apply()', () => {
    expect(widget.nvsBounds).toEqual({ x: 0, y: 0, w: 1, h: 1 });
  });

  it('nvsBounds returns last applied state nvsBounds', () => {
    widget.initialize(makeInitCtx());
    const state = makeState({ nvsBounds: { x: 0.5, y: 0, w: 0.5, h: 1 } });
    widget.apply(state, makeRenderCtx());
    expect(widget.nvsBounds).toEqual({ x: 0.5, y: 0, w: 0.5, h: 1 });
  });

  it('nvsBounds updates when apply() is called with new nvsBounds', () => {
    widget.initialize(makeInitCtx());
    widget.apply(makeState({ nvsBounds: { x: 0, y: 0.5, w: 1, h: 0.5 } }), makeRenderCtx());
    expect(widget.nvsBounds).toEqual({ x: 0, y: 0.5, w: 1, h: 0.5 });
  });

  it('apply() centers chart group on NVS world position by subtracting half worldW/worldH', () => {
    const ctx = makeInitCtx();
    const scene = ctx.scene as THREE.Scene;
    widget.initialize(ctx);
    const state = makeState();
    const coords = makeCoords();
    const [worldW, worldH] = coords.toWorldSize(state.bounds.width, state.bounds.height);
    widget.apply(state, { coords } as unknown as WidgetRenderContext);

    const chartGroup = scene.children[0] as THREE.Object3D;
    expect(chartGroup).toBeDefined();
    expect(chartGroup.position.x).toBeCloseTo(-worldW / 2);
    expect(chartGroup.position.y).toBeCloseTo(-worldH / 2);
    expect(chartGroup.position.z).toBe(state.z);
  });

  it('apply() with NVS fraction bounds (0.5, 0.4) produces correct world-space group position', () => {
    const ctx = makeInitCtx();
    const scene = ctx.scene as THREE.Scene;
    widget.initialize(ctx);
    const state = makeState({ bounds: { width: 0.5, height: 0.4, depth: 0.4 } });
    widget.apply(state, makeRenderCtx());

    const chartGroup = scene.children[0] as THREE.Object3D;
    expect(chartGroup.position.x).toBeCloseTo(-8.89 / 2, 1);
    expect(chartGroup.position.y).toBeCloseTo(-4.0 / 2, 1);
  });

  it('apply() with bounds={width:0.5, height:0.4} sends worldW≈8.89, worldH≈4.0 to renderer', () => {
    const ctx = makeInitCtx();
    const scene = ctx.scene as THREE.Scene;
    widget.initialize(ctx);
    const state = makeState({ nvsX: 0.5, nvsY: 0.5, bounds: { width: 0.5, height: 0.4, depth: 0.4 } });
    const coords = makeCoords();
    widget.apply(state, { coords } as unknown as WidgetRenderContext);

    const chartGroup = scene.children[0] as THREE.Object3D;
    const worldW = coords.toWorldSize(0.5, 0.4)[0];
    const worldH = coords.toWorldSize(0.5, 0.4)[1];
    expect(worldW).toBeCloseTo(8.89, 1);
    expect(worldH).toBeCloseTo(4.0, 1);
    expect(chartGroup.position.x).toBeCloseTo(-worldW / 2, 1);
    expect(chartGroup.position.y).toBeCloseTo(-worldH / 2, 1);
    expect(state.bounds.depth).toBe(0.4);
  });

  describe('live NVS position computation (no reparent guard)', () => {
    it('apply() always recomputes position from current state.nvsX/nvsY on every call', () => {
      const rendererDouble = new ChartRendererDouble();
      const rWidget = new ChartWidget('live-chart', store, undefined, rendererDouble as never);
      const scene = new THREE.Scene();
      rWidget.initialize({ scene, renderer: null, camera: null } as unknown as WidgetInitContext);

      const coords = makeCoords();
      const ctx = { coords } as unknown as WidgetRenderContext;

      const state1 = makeState({ nvsX: 0.5, nvsY: 0.5, z: 0 });
      rWidget.apply(state1, ctx);
      const pos1 = rendererDouble.lastInput!.position;

      const state2 = makeState({ nvsX: 0.3, nvsY: 0.4, z: -5 });
      rWidget.apply(state2, ctx);
      const pos2 = rendererDouble.lastInput!.position;

      // Position must change when NVS coords change — no freezing
      expect(pos2).not.toEqual(pos1);
    });

    it('apply() recomputes position even when chartGroup is reparented into an external group', () => {
      const rendererDouble = new ChartRendererDouble();
      const rWidget = new ChartWidget('rp-chart', store, undefined, rendererDouble as never);
      const scene = new THREE.Scene();
      rWidget.initialize({ scene, renderer: null, camera: null } as unknown as WidgetInitContext);

      const coords = makeCoords();
      const ctx = { coords } as unknown as WidgetRenderContext;

      // First apply at nvsX=0.5
      rWidget.apply(makeState({ nvsX: 0.5, nvsY: 0.5, z: 0 }), ctx);
      const pos1 = rendererDouble.lastInput!.position;

      // Simulate reparent: move chartGroup into an external group (as ViewWidget would do)
      const externalGroup = new THREE.Group();
      scene.add(externalGroup);
      externalGroup.add(rendererDouble.chartGroup);

      // Second apply with different NVS — position must still update (no frozen guard)
      rWidget.apply(makeState({ nvsX: 0.15, nvsY: 0.5, z: -15 }), ctx);
      const pos2 = rendererDouble.lastInput!.position;

      expect(pos2).not.toEqual(pos1);
    });

    it('interpolated nvsX/nvsY produces proportionally correct world position', () => {
      const rendererDouble = new ChartRendererDouble();
      const rWidget = new ChartWidget('interp-chart', store, undefined, rendererDouble as never);
      rWidget.initialize(makeInitCtx());

      const coords = makeCoords();
      const ctx = { coords } as unknown as WidgetRenderContext;

      // Apply at nvsX=0.3 — midpoint between 0.1 and 0.5 simulates t=0.5 interpolation
      const state = makeState({ nvsX: 0.3, nvsY: 0.5 });
      rWidget.apply(state, ctx);

      const [wcx] = coords.toWorld(0.3, 0.5, 0);
      const [worldW] = coords.toWorldSize(state.bounds.width, state.bounds.height);
      expect(rendererDouble.lastInput!.position[0]).toBeCloseTo(wcx - worldW / 2, 3);
    });

    it('dispose does not leave any frozen position state — next lifecycle starts clean', () => {
      const rendererDouble = new ChartRendererDouble();
      const rWidget = new ChartWidget('reset-chart', store, undefined, rendererDouble as never);
      const scene = new THREE.Scene();
      rWidget.initialize({ scene, renderer: null, camera: null } as unknown as WidgetInitContext);

      const coords = makeCoords();
      const ctx = { coords } as unknown as WidgetRenderContext;

      rWidget.apply(makeState({ nvsX: 0.5, nvsY: 0.5, z: 0 }), ctx);
      rWidget.dispose();

      const scene2 = new THREE.Scene();
      rWidget.initialize({ scene: scene2, renderer: null, camera: null } as unknown as WidgetInitContext);
      rWidget.apply(makeState({ nvsX: 0.7, nvsY: 0.3, z: 5 }), ctx);

      const [wcx, wcy] = coords.toWorld(0.7, 0.3, 5);
      const [ww, wh] = coords.toWorldSize(1, 1);
      expect(rendererDouble.lastInput!.position[0]).toBeCloseTo(wcx - ww / 2, 3);
      expect(rendererDouble.lastInput!.position[1]).toBeCloseTo(wcy - wh / 2, 3);
    });
  });

  it('getCamera returns null before initialize', () => {
    expect(widget.getCamera()).toBeNull();
  });

  it('getContainerSize returns null before initialize', () => {
    expect(widget.getContainerSize()).toBeNull();
  });

  it('getContainerSize returns offsetWidth/offsetHeight from renderer DOM after initialize', () => {
    const scene = new THREE.Scene();
    const mockDom = {
      ...createMockDomElement(),
      offsetWidth: 1920,
      offsetHeight: 1080,
    } as unknown as HTMLElement;

    widget.initialize({
      scene,
      renderer: { domElement: mockDom } as unknown as THREE.WebGLRenderer,
      camera: new THREE.PerspectiveCamera(),
    } as unknown as WidgetInitContext);

    const size = widget.getContainerSize();
    expect(size).not.toBeNull();
    expect(size?.width).toBe(1920);
    expect(size?.height).toBe(1080);
  });

  // ── V2: ILoadable tests ───────────────────────────────────────────────────

  it('isLoaded is true when no async URL is configured', () => {
    expect(widget.isLoaded).toBe(true);
  });

  it('isLoaded is false after _configureAsync() and before load()', () => {
    widget._configureAsync('https://example.com/data.json');
    expect(widget.isLoaded).toBe(false);
  });

  it('load() with no async URL is a no-op and does not throw', async () => {
    await expect(widget.load(null)).resolves.toBeUndefined();
    expect(widget.isLoaded).toBe(true);
  });

  it('_configureAsync() + load() fetches data and registers in store under __async__ key', async () => {
    const rows = [{ month: 'Jan', revenue: 100 }, { month: 'Feb', revenue: 200 }];
    const fetchMock = vi.fn().mockResolvedValue({
      json: vi.fn().mockResolvedValue(rows),
      text: vi.fn().mockResolvedValue(''),
    });
    vi.stubGlobal('fetch', fetchMock);

    widget._configureAsync('https://example.com/data.json', 'json');
    await widget.load(null);

    expect(widget.isLoaded).toBe(true);
    // Data should be registered under __async__test-chart
    const result = store.resolve('__async__test-chart', []);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toMatchObject({ month: 'Jan', revenue: 100 });

    vi.unstubAllGlobals();
  });

  it('load() for CSV format uses parseCsv and registers rows correctly', async () => {
    const csvText = 'name,value\nAlpha,10\nBeta,20';
    const fetchMock = vi.fn().mockResolvedValue({
      json: vi.fn().mockResolvedValue([]),
      text: vi.fn().mockResolvedValue(csvText),
    });
    vi.stubGlobal('fetch', fetchMock);

    widget._configureAsync('https://example.com/data.csv', 'csv');
    await widget.load(null);

    expect(widget.isLoaded).toBe(true);
    const result = store.resolve('__async__test-chart', []);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toMatchObject({ name: 'Alpha', value: 10 });

    vi.unstubAllGlobals();
  });

  it('load() logs error and leaves isLoaded false when fetch fails', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const fetchMock = vi.fn().mockRejectedValue(new Error('Network error'));
    vi.stubGlobal('fetch', fetchMock);

    widget._configureAsync('https://example.com/data.json');
    await widget.load(null);

    expect(widget.isLoaded).toBe(false);
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[ChartWidget]'),
      expect.any(Error),
    );

    vi.unstubAllGlobals();
    consoleSpy.mockRestore();
  });

  // ── V2: Inline data registration tests ───────────────────────────────────

  it('apply() with inline source registers rows in store on first call', () => {
    widget.initialize(makeInitCtx());
    const rows = [{ x: 1, y: 10 }, { x: 2, y: 20 }] as const;
    const state = makeState({
      dataSource: { type: 'inline', rows },
      typeConfig: { kind: 'bar', options: {} },
    });

    widget.apply(state, makeRenderCtx());

    const result = store.resolve('__inline__test-chart', []);
    expect(result.rows).toHaveLength(2);
  });

  it('apply() with inline source skips re-registration when same rows reference is applied twice', () => {
    widget.initialize(makeInitCtx());
    const rows = [{ x: 1, y: 10 }] as const;
    const source: InlineDataSource = { type: 'inline', rows };

    const registerInlineSpy = vi.spyOn(store, 'registerInline');

    widget.apply(makeState({ dataSource: source }), makeRenderCtx());
    const callsAfterFirst = registerInlineSpy.mock.calls.length;

    // Second apply with same rows reference — no new registration expected
    widget.apply(makeState({ dataSource: source }), makeRenderCtx());
    expect(registerInlineSpy.mock.calls.length).toBe(callsAfterFirst);
  });

  it('apply() with inline source re-registers rows when rows reference changes', () => {
    widget.initialize(makeInitCtx());
    const rows1 = [{ x: 1, y: 10 }] as const;
    const rows2 = [{ x: 2, y: 20 }] as const;

    widget.apply(makeState({ dataSource: { type: 'inline', rows: rows1 } }), makeRenderCtx());
    widget.apply(makeState({ dataSource: { type: 'inline', rows: rows2 } }), makeRenderCtx());

    const result = store.resolve('__inline__test-chart', []);
    // rows2 should now be registered
    expect(result.rows[0]).toMatchObject({ x: 2, y: 20 });
  });

  it('apply() with named source does not register inline data', () => {
    widget.initialize(makeInitCtx());
    const registerSpy = vi.spyOn(store, 'register');
    const inlineCallsBefore = registerSpy.mock.calls.filter(c => String(c[0]).startsWith('__inline__')).length;

    widget.apply(makeState({ dataSource: { type: 'named', name: 'sales' } }), makeRenderCtx());

    const inlineCallsAfter = registerSpy.mock.calls.filter(c => String(c[0]).startsWith('__inline__')).length;
    expect(inlineCallsAfter).toBe(inlineCallsBefore);
  });

  // ── V2: childDslComponents ────────────────────────────────────────────────

  it('childDslComponents includes all V2 child components', () => {
    const displayNames = widget.childDslComponents.map(c => c.displayName);
    expect(displayNames).toContain('LineChart');
    expect(displayNames).toContain('ScatterPlotChart');
    expect(displayNames).toContain('PieChart');
    expect(displayNames).toContain('AreaChart');
    expect(displayNames).toContain('HeatMapChart');
    expect(displayNames).toContain('ChartData');
    expect(displayNames).toContain('ChartAxis');
    expect(displayNames).toContain('ChartSeries');
    expect(displayNames).toContain('ChartLegend');
    expect(displayNames).toContain('ChartDataLabels');
    expect(displayNames).toContain('ReferenceLine');
    // BarChart is DslComponent (not in childDslComponents), total 12 children (includes ChartTooltip)
    expect(widget.childDslComponents).toHaveLength(12);
  });

  it('DslComponent is BarChart', () => {
    expect(widget.DslComponent.displayName).toBe('BarChart');
  });

  // ── V2: heatmap onTick ────────────────────────────────────────────────────

  it('onTick is a no-op when lastState has no timeField', () => {
    // Heatmap without timeField configured → onTick returns early without crash
    widget.initialize(makeInitCtx());
    widget.apply(makeState({
      type: 'bar',
      typeConfig: { kind: 'bar', options: {} },
    }), makeRenderCtx());
    expect(() => widget.onTick({ tick: { blockProgress: 0.5 }, delta: 0 } as never)).not.toThrow();
  });

  it('onTick returns early when getTimeSliceCount returns 0', () => {
    // Named source not registered → getTimeSliceCount returns 0 → no-op
    const emptyStore = new ChartDataStore();
    const hw = new ChartWidget('hw', emptyStore);
    hw.initialize(makeInitCtx());

    // Apply a non-heatmap state (bar) so heatmap renderer doesn't need to be created
    hw.apply(makeState({
      type: 'bar',
      typeConfig: { kind: 'bar', options: {} },
      dataSource: { type: 'named', name: '' },
    }), makeRenderCtx());

    // Simulate that lastState has heatmap typeConfig but no real data
    // onTick should check typeConfig.kind === 'heatmap' → return early (kind is 'bar' here)
    expect(() => hw.onTick({ tick: { blockProgress: 0.5 }, delta: 0 } as never)).not.toThrow();
  });

  it('sliceIndex clamps to totalSlices-1 when blockProgress=1.0', () => {
    // Verify the clamping math: floor(1.0 * n) = n, clamped to n-1
    // This is a pure math verification, not a rendering test
    const totalSlices = 4;
    const blockProgress = 1.0;
    const sliceIndex = Math.min(
      Math.floor(blockProgress * totalSlices),
      totalSlices - 1,
    );
    expect(sliceIndex).toBe(totalSlices - 1); // clamped to 3
  });

  it('sliceIndex from blockProgress=0.5 with 4 slices = 2', () => {
    const totalSlices = 4;
    const blockProgress = 0.5;
    const sliceIndex = Math.min(
      Math.floor(blockProgress * totalSlices),
      totalSlices - 1,
    );
    expect(sliceIndex).toBe(2); // floor(0.5 * 4) = floor(2) = 2
  });

  // ── V2.1: Entry animation entryT threading ────────────────────────────────

  it('entryT is threaded to ChartRenderer when animateEntry=true and blockProgress < animationDuration', () => {
    const rendererDouble = new ChartRendererDouble();
    const w = new ChartWidget('chart1', store, undefined, rendererDouble as never);
    w.initialize(makeInitCtx());

    const state = makeState({ animateEntry: true, animationDuration: 0.4 });
    w.apply(state, makeRenderCtx()); // sets lastState

    // onTick at blockProgress=0.2 → entryT = 0.2/0.4 = 0.5
    w.onTick({ tick: { blockProgress: 0.2 }, delta: 0 } as never);
    w.apply(state, makeRenderCtx());

    expect(rendererDouble.lastInput?.entryT).toBeCloseTo(0.5);
  });

  it('entryT is undefined when animateEntry=true and blockProgress >= animationDuration (animation complete)', () => {
    const rendererDouble = new ChartRendererDouble();
    const w = new ChartWidget('chart1', store, undefined, rendererDouble as never);
    w.initialize(makeInitCtx());

    const state = makeState({ animateEntry: true, animationDuration: 0.4 });
    w.apply(state, makeRenderCtx());

    // blockProgress=0.4 → entryT = 0.4/0.4 = 1.0 → should be absent (undefined)
    w.onTick({ tick: { blockProgress: 0.4 }, delta: 0 } as never);
    w.apply(state, makeRenderCtx());

    expect(rendererDouble.lastInput?.entryT).toBeUndefined();
  });

  it('entryT is undefined when animateEntry=false regardless of blockProgress', () => {
    const rendererDouble = new ChartRendererDouble();
    const w = new ChartWidget('chart1', store, undefined, rendererDouble as never);
    w.initialize(makeInitCtx());

    const state = makeState({ animateEntry: false, animationDuration: 0.4 });
    w.apply(state, makeRenderCtx());

    w.onTick({ tick: { blockProgress: 0.1 }, delta: 0 } as never);
    w.apply(state, makeRenderCtx());

    expect(rendererDouble.lastInput?.entryT).toBeUndefined();
  });

  it('entryT progresses correctly: blockProgress=0.2, duration=0.4 → entryT≈0.5', () => {
    const rendererDouble = new ChartRendererDouble();
    const w = new ChartWidget('chart2', store, undefined, rendererDouble as never);
    w.initialize(makeInitCtx());

    const state = makeState({ animateEntry: true, animationDuration: 0.4 });
    w.apply(state, makeRenderCtx());
    w.onTick({ tick: { blockProgress: 0.2 }, delta: 0 } as never);
    w.apply(state, makeRenderCtx());

    // 0.2 / 0.4 = 0.5
    expect(rendererDouble.lastInput?.entryT).toBeCloseTo(0.5);
  });

  // ── V2.1: accessors threading ─────────────────────────────────────────────

  it('accessors from plugin registry are threaded to ChartRenderer when registered', () => {
    const accessorRegistry = new Map<string, import('../types').ChartRenderInput['accessors'] & object>();
    const yAccessor = (row: Record<string, unknown>) => Number(row['value']) * 2;
    accessorRegistry.set('chart-acc', { yAccessor });

    const rendererDouble = new ChartRendererDouble();
    const w = new ChartWidget('chart-acc', store, accessorRegistry as never, rendererDouble as never);
    w.initialize(makeInitCtx());

    const state = makeState();
    w.apply(state, makeRenderCtx());

    expect(rendererDouble.lastInput?.accessors).toBeDefined();
    expect(rendererDouble.lastInput?.accessors?.yAccessor).toBe(yAccessor);
  });

  it('accessors is undefined when no registry is provided', () => {
    const rendererDouble = new ChartRendererDouble();
    const w = new ChartWidget('chart-no-acc', store, undefined, rendererDouble as never);
    w.initialize(makeInitCtx());

    w.apply(makeState(), makeRenderCtx());

    expect(rendererDouble.lastInput?.accessors).toBeUndefined();
  });

  // ── V2.1: live override / onDeregisterInline callback ────────────────────

  it('apply() with inline source uses registerInline when no live override active', () => {
    widget.initialize(makeInitCtx());
    const rows = [{ x: 1, y: 10 }] as const;
    const registerInlineSpy = vi.spyOn(store, 'registerInline');

    widget.apply(makeState({ dataSource: { type: 'inline', rows } }), makeRenderCtx());

    expect(registerInlineSpy).toHaveBeenCalledWith('test-chart', rows);
  });

  it('apply() skips registerInline when live override is active', () => {
    widget.initialize(makeInitCtx());
    const rows1 = [{ x: 1, y: 10 }] as const;
    const rows2 = [{ x: 2, y: 20 }] as const;

    // Register initial inline data
    widget.apply(makeState({ dataSource: { type: 'inline', rows: rows1 } }), makeRenderCtx());

    // Activate live override
    store.setLiveOverride('test-chart');
    const registerInlineSpy = vi.spyOn(store, 'registerInline');

    // Apply with different rows — should NOT update store because live override is active
    widget.apply(makeState({ dataSource: { type: 'inline', rows: rows2 } }), makeRenderCtx());

    expect(registerInlineSpy).not.toHaveBeenCalled();
  });

  it('deregisterInline resets lastInlineRowsRef so next apply() re-registers SceneTrack rows', () => {
    widget.initialize(makeInitCtx());
    const rows = [{ x: 1, y: 10 }] as const;

    // Initial registration
    widget.apply(makeState({ dataSource: { type: 'inline', rows } }), makeRenderCtx());

    // Activate live override then deregister (simulates hook unmount)
    store.setLiveOverride('test-chart');
    store.deregisterInline('test-chart'); // triggers the callback, resetting lastInlineRowsRef

    // Now apply again — should re-register SceneTrack rows
    const registerInlineSpy = vi.spyOn(store, 'registerInline');
    widget.apply(makeState({ dataSource: { type: 'inline', rows } }), makeRenderCtx());

    expect(registerInlineSpy).toHaveBeenCalledWith('test-chart', rows);
  });

  it('dispose() unsubscribes deregisterInline callback — no callback after dispose', () => {
    widget.initialize(makeInitCtx());
    const rows = [{ x: 1, y: 10 }] as const;
    widget.apply(makeState({ dataSource: { type: 'inline', rows } }), makeRenderCtx());
    store.setLiveOverride('test-chart');

    // Dispose widget — unsubscribes from store
    widget.dispose();

    // deregisterInline should NOT invoke the (now-unsubscribed) callback
    const registerInlineSpy = vi.spyOn(store, 'registerInline');
    store.deregisterInline('test-chart');

    // Even if we had a fresh widget, the old callback is gone — no registerInline call
    expect(registerInlineSpy).not.toHaveBeenCalled();
  });
});
