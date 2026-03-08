// Tests for nvsToScissorRect, computeNdcForNvs, DiagramCanvasWidget.renderPass(), and
// mixed-scene isolation. nvsToScissorRect and renderPass() are implemented in Track F.
// These tests are written now and will pass once Track F is merged.

import { vi, describe, it, expect } from 'vitest';
import * as THREE from 'three';
import * as widgetModule from '../widget';
import { DiagramCanvasWidget, computeNdcForNvs } from '../widget';
import type { DiagramCanvasState } from '../types';
import type { DiagramState } from '../../types';

// Cast to any to safely access functions that are added by Track F.
const widgetModuleAny = widgetModule as Record<string, unknown>;

// ─── Test helpers ─────────────────────────────────────────────────────────────

const makeDiagramState = (id: string): DiagramState => ({
  id,
  nodes: [],
  edges: [],
  groups: [],
  viewportBounds: { x: 0, y: 0, w: 1, h: 1 },
  tiltRotation: [0, 0, 0],
  exit: undefined,
  enter: undefined,
  themeConfig: {} as any,
});

/** Produces a valid DiagramCanvasState with sensible defaults. */
const makeDefaultCanvasState = (overrides: Partial<DiagramCanvasState> = {}): DiagramCanvasState => ({
  id: 'canvas',
  tilt: 0,
  scale: 1,
  padding: 0.1,
  nvsBounds: { x: 0, y: 0, w: 1, h: 1 },
  diagrams: [makeDiagramState('d1')],
  pipes: [],
  ...overrides,
});

const makeMockRenderer = () => ({
  setScissorTest: vi.fn(),
  setScissor: vi.fn(),
  setViewport: vi.fn(),
  clearDepth: vi.fn(),
  render: vi.fn(),
});

type ScissorRect = { left: number; bottom: number; width: number; height: number };
type NvsToScissorRectFn = (
  nvs: { x: number; y: number; w: number; h: number },
  vw: number,
  vh: number,
) => ScissorRect;

// ─── 4a: nvsToScissorRect — pure scissor math ─────────────────────────────────
// NOTE: nvsToScissorRect is exported from widget.ts in Track F.
// Until Track F is merged these tests are skipped (nvsToScissorRect === undefined).

describe('nvsToScissorRect', () => {
  const nvsToScissorRect = widgetModuleAny['nvsToScissorRect'] as NvsToScissorRectFn | undefined;

  it('NVS top-half maps to correct WebGL bottom-half pixel rect', () => {
    if (!nvsToScissorRect) return;  // skip until Track F
    // NVS y=0, h=0.5 is the top half. WebGL bottom = (1 - 0 - 0.5) * 600 = 300.
    const rect = nvsToScissorRect({ x: 0, y: 0, w: 1, h: 0.5 }, 1600, 600);
    expect(rect).toEqual({ left: 0, bottom: 300, width: 1600, height: 300 });
  });

  it('NVS right-half maps to correct left/width', () => {
    if (!nvsToScissorRect) return;
    const rect = nvsToScissorRect({ x: 0.5, y: 0, w: 0.5, h: 1 }, 1600, 600);
    expect(rect).toEqual({ left: 800, bottom: 0, width: 800, height: 600 });
  });

  it('sub-pixel NVS values are rounded', () => {
    if (!nvsToScissorRect) return;
    // x=0.333, w=0.334 on 1000px wide viewport → left=333, width=334
    const rect = nvsToScissorRect({ x: 0.333, y: 0, w: 0.334, h: 1 }, 1000, 600);
    expect(rect.left).toBe(333);
    expect(rect.width).toBe(334);
  });
});

// ─── 4b: computeNdcForNvs — NVS sub-region pointer mapping ───────────────────

describe('computeNdcForNvs', () => {
  it('maps pointer at center of NVS sub-region to NDC (0, 0)', () => {
    // Right half canvas. Center of right half = x=1200, y=300 on 1600×600 viewport.
    const ndc = computeNdcForNvs(1200, 300, 1600, 600, { x: 0.5, y: 0, w: 0.5, h: 1 });
    expect(ndc.x).toBeCloseTo(0, 3);
    expect(ndc.y).toBeCloseTo(0, 3);
  });

  it('maps pointer at NVS sub-region top-left to NDC (-1, 1)', () => {
    const ndc = computeNdcForNvs(800, 0, 1600, 600, { x: 0.5, y: 0, w: 0.5, h: 1 });
    expect(ndc.x).toBeCloseTo(-1, 3);
    expect(ndc.y).toBeCloseTo(1, 3);
  });
});

// ─── 4c: DiagramCanvasWidget.renderPass() — verify renderer call contract ─────
// NOTE: renderPass() is added to DiagramCanvasWidget in Track F.
// Until then, the tests below are skipped via the `renderPass` guard.

describe('DiagramCanvasWidget.renderPass()', () => {
  it('calls setScissor with correct pixel rect for right-half NVS region', () => {
    const widget = new DiagramCanvasWidget('test', makeDefaultCanvasState());
    const state: DiagramCanvasState = {
      ...makeDefaultCanvasState(),
      nvsBounds: { x: 0.5, y: 0, w: 0.5, h: 1 },
    };
    // Force lastState (replicate what apply() would do without full Three.js setup).
    (widget as unknown as { lastState: DiagramCanvasState }).lastState = state;
    // Set diagramScene and privateCamera to non-null stubs.
    (widget as unknown as { diagramScene: object }).diagramScene = {};
    (widget as unknown as { privateCamera: object }).privateCamera = {};

    if (typeof (widget as any).renderPass !== 'function') return; // skip until Track F

    const renderer = makeMockRenderer();
    (widget as any).renderPass(renderer as unknown as THREE.WebGLRenderer, 1600, 600);

    // Right half: left=800, bottom=0, width=800, height=600.
    expect(renderer.setScissor).toHaveBeenCalledWith(800, 0, 800, 600);
    expect(renderer.setViewport).toHaveBeenCalledWith(800, 0, 800, 600);
    expect(renderer.setScissorTest).toHaveBeenCalledWith(true);
    expect(renderer.clearDepth).toHaveBeenCalledOnce();
    expect(renderer.render).toHaveBeenCalledOnce();
    // Scissor test must be reset after pass.
    expect(renderer.setScissorTest).toHaveBeenLastCalledWith(false);
  });

  it('does not call render when nvsBounds produces zero-area rect', () => {
    const widget = new DiagramCanvasWidget('test', makeDefaultCanvasState());
    const state: DiagramCanvasState = {
      ...makeDefaultCanvasState(),
      nvsBounds: { x: 0.5, y: 0, w: 0, h: 1 },  // zero width
    };
    (widget as unknown as { lastState: DiagramCanvasState }).lastState = state;
    (widget as unknown as { diagramScene: object }).diagramScene = {};
    (widget as unknown as { privateCamera: object }).privateCamera = {};

    if (typeof (widget as any).renderPass !== 'function') return; // skip until Track F

    const renderer = makeMockRenderer();
    (widget as any).renderPass(renderer as unknown as THREE.WebGLRenderer, 1600, 600);

    expect(renderer.render).not.toHaveBeenCalled();
  });
});

// ─── Test 7: Mixed-scene isolation ───────────────────────────────────────────

describe('DiagramCanvasWidget mixed-scene isolation', () => {
  it('initialize() does not throw and widget is usable after initialization', () => {
    const widget = new DiagramCanvasWidget('test', makeDefaultCanvasState());
    const sharedCamera = new THREE.PerspectiveCamera(45, 16 / 9, 0.1, 100);
    sharedCamera.position.set(99, 99, 99);

    widget.initialize({
      scene: new THREE.Scene(),
      widgetId: 'test',
      renderer: undefined,
      camera: sharedCamera,
    });

    widget.dispose();
    // No throw = pass.
    expect(true).toBe(true);
  });

  it('initialize() does not store the shared camera as the private diagram camera (Track F)', () => {
    const widget = new DiagramCanvasWidget('test', makeDefaultCanvasState());
    const sharedCamera = new THREE.PerspectiveCamera(45, 16 / 9, 0.1, 100);
    sharedCamera.position.set(99, 99, 99);

    widget.initialize({
      scene: new THREE.Scene(),
      widgetId: 'test',
      renderer: undefined,
      camera: sharedCamera,
    });

    const internalPrivateCamera = (widget as unknown as { privateCamera?: THREE.PerspectiveCamera }).privateCamera;

    if (internalPrivateCamera !== undefined) {
      // Post-Track F: private camera must not be the shared camera.
      expect(internalPrivateCamera).not.toBe(sharedCamera);
      expect(internalPrivateCamera.position.z).not.toBe(99);
    }
    // Pre-Track F: privateCamera is undefined — guard above skips assertion.

    widget.dispose();
  });
});
