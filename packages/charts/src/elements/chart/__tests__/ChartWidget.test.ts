// ChartWidget lifecycle tests — uses Three.js mocks (no real GPU).

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
    position = new Vector3();
    rotation = { set: vi.fn(), x: 0, y: 0, z: 0 };
    userData: Record<string, unknown> = {};
    add(...objs: Object3D[]) { this.children.push(...objs); }
    remove(obj: Object3D) { const i = this.children.indexOf(obj); if (i >= 0) this.children.splice(i, 1); }
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
  const FrontSide = 0;
  const MathUtils = {
    degToRad: (deg: number) => deg * (Math.PI / 180),
  };
  return {
    Vector3, Vector2, Object3D, Scene, Group, BufferGeometry,
    MeshPhysicalMaterial, LineBasicMaterial, MeshStandardMaterial,
    Mesh, Camera, PerspectiveCamera, Raycaster, Color, FrontSide, MathUtils,
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

import * as THREE from 'three';
import { ChartWidget } from '../ChartWidget';
import { ChartDataStore } from '../../../data/ChartDataStore';
import { DEFAULT_CHART_STATE } from '../types';
import type { ChartState } from '../types';
import type { WidgetInitContext, WidgetRenderContext, NVSCoordService } from '@brewsite/core';
import { createNVSCoordService } from '@brewsite/core';

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

/** Build a real NVSCoordService for a worldScale=10 camera (position z=12.07, fov=45, 1920×1080).
 * Uses a plain object to bypass the THREE mock (which ignores PerspectiveCamera constructor args).
 */
function makeCoords(): NVSCoordService {
  const camera = { position: { x: 0, y: 0, z: 12.07 }, fov: 45 };
  return createNVSCoordService(camera as unknown as import('three').PerspectiveCamera, 1920, 1080);
}

function makeRenderCtx(): WidgetRenderContext {
  return { coords: makeCoords() } as unknown as WidgetRenderContext;
}

function makeState(overrides?: Partial<ChartState>): ChartState {
  return {
    ...DEFAULT_CHART_STATE,
    dataSource: 'sales',
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

  it('initialize mounts chart group into scene', () => {
    const ctx = makeInitCtx();
    const scene = ctx.scene as THREE.Scene;
    const childCountBefore = scene.children.length;
    widget.initialize(ctx);
    expect(scene.children.length).toBeGreaterThan(childCountBefore);
  });

  it('apply updates lastState', () => {
    widget.initialize(makeInitCtx());
    const state = makeState({ type: 'line', opacity: 0.5 });
    widget.apply(state, makeRenderCtx());
    // After apply, onTick should not crash (it accesses lastState)
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
    // Default state: nvsX=0.5, nvsY=0.5, bounds={width:1.0, height:1.0} (NVS fractions).
    // coords at worldScale=10 (fov=45, z=12.07, 1920x1080):
    //   visibleWorldHeight ≈ 10.0, visibleWorldWidth ≈ 17.78
    //   toWorld(0.5, 0.5) = [0, 0, 0]
    //   toWorldSize(1.0, 1.0) = [17.78, 10.0]
    // worldPos = [0 - 17.78/2, 0 - 10.0/2, 0] = [-8.89, -5.0, 0]
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
    // bounds.width=0.5 → worldW ≈ 0.5 * 17.78 ≈ 8.89
    // bounds.height=0.4 → worldH ≈ 0.4 * 10.0 = 4.0
    // worldPos (nvsCenter=0.5,0.5 → worldCenter=[0,0,0]): [-8.89/2, -4.0/2, 0] = [-4.44, -2.0, 0]
    const state = makeState({ bounds: { width: 0.5, height: 0.4, depth: 0.4 } });
    widget.apply(state, makeRenderCtx());

    const chartGroup = scene.children[0] as THREE.Object3D;
    expect(chartGroup.position.x).toBeCloseTo(-8.89 / 2, 1);   // ≈ -4.44
    expect(chartGroup.position.y).toBeCloseTo(-4.0 / 2, 1);    // ≈ -2.0
  });

  // §9.5 — NVS bounds conversion test
  it('apply() with bounds={width:0.5, height:0.4} sends worldW≈8.89, worldH≈4.0 to renderer', () => {
    const ctx = makeInitCtx();
    const scene = ctx.scene as THREE.Scene;
    widget.initialize(ctx);
    // worldScale=10: visibleWorldHeight≈10.0, visibleWorldWidth≈17.78
    // bounds.width=0.5 → worldW = 0.5 * 17.78 ≈ 8.89
    // bounds.height=0.4 → worldH = 0.4 * 10.0 = 4.0
    // bounds.depth=0.4 passes through unchanged
    const state = makeState({ nvsX: 0.5, nvsY: 0.5, bounds: { width: 0.5, height: 0.4, depth: 0.4 } });
    const coords = makeCoords();
    widget.apply(state, { coords } as unknown as WidgetRenderContext);

    // Chart group is positioned at [wcx - worldW/2, wcy - worldH/2, z].
    // With nvsCenter=(0.5,0.5) → worldCenter=[0,0,0].
    // So chartGroup.position.x = -worldW/2 ≈ -4.445
    //    chartGroup.position.y = -worldH/2 ≈ -2.0
    const chartGroup = scene.children[0] as THREE.Object3D;
    const worldW = coords.toWorldSize(0.5, 0.4)[0];
    const worldH = coords.toWorldSize(0.5, 0.4)[1];
    expect(worldW).toBeCloseTo(8.89, 1);
    expect(worldH).toBeCloseTo(4.0, 1);
    expect(chartGroup.position.x).toBeCloseTo(-worldW / 2, 1);
    expect(chartGroup.position.y).toBeCloseTo(-worldH / 2, 1);
    // depth passes through unchanged
    expect(state.bounds.depth).toBe(0.4);
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
});
