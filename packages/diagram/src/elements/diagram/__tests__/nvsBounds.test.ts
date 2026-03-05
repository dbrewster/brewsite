// Tests for NVS bounds integration: DiagramCanvasWidget.nvsBounds getter,
// compileCanvas nvsBounds output, and computeNdcForNvs formula.

import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { compileCanvas } from '../canvas/compile';
import { DiagramCanvasWidget, computeNdcForNvs } from '../canvas/widget';
import type { DiagramCanvasState } from '../canvas/types';
import type { WidgetRenderContext } from '@brewsite/core';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Builds a minimal valid DiagramCanvasState for widget construction. */
const makeDefaultState = (overrides: Partial<DiagramCanvasState> = {}): DiagramCanvasState => ({
  id: 'canvas',
  position: [0, 0, 0],
  rotation: [0, 0, 0],
  scale: 1,
  diagrams: [],
  pipes: [],
  nvsBounds: { x: 0, y: 0, w: 1, h: 1 },
  ...overrides,
});

/** Builds a minimal WidgetRenderContext for apply() calls (no Three.js side effects). */
const makeRenderContext = (): WidgetRenderContext => ({
  clock: {
    deltaSeconds: 0.016,
    wallTimeSeconds: 0,
  },
  effectiveDeltaSeconds: 0.016,
  globalProgress: 0,
  variables: {
    get: () => undefined,
    getNamespace: () => ({}),
  },
  extra: undefined,
  tick: null,
});

// ─── compileCanvas — nvsBounds ────────────────────────────────────────────────

describe('compileCanvas — nvsBounds', () => {
  it('maps explicit x/y/w/h props to nvsBounds', () => {
    const state = compileCanvas({ id: 'c', x: 0.2, y: 0.3, w: 0.5, h: 0.4 }, [], []);
    expect(state.nvsBounds).toEqual({ x: 0.2, y: 0.3, w: 0.5, h: 0.4 });
  });

  it('defaults nvsBounds to fullscreen when no x/y/w/h props are given', () => {
    const state = compileCanvas({ id: 'c' }, [], []);
    expect(state.nvsBounds).toEqual({ x: 0, y: 0, w: 1, h: 1 });
  });

  it('defaults individual missing props to their fullscreen value', () => {
    const statePartialX = compileCanvas({ id: 'c', x: 0.1 }, [], []);
    expect(statePartialX.nvsBounds).toEqual({ x: 0.1, y: 0, w: 1, h: 1 });

    const statePartialW = compileCanvas({ id: 'c', w: 0.5 }, [], []);
    expect(statePartialW.nvsBounds).toEqual({ x: 0, y: 0, w: 0.5, h: 1 });
  });
});

// ─── DiagramCanvasWidget — nvsBounds getter ───────────────────────────────────

describe('DiagramCanvasWidget — nvsBounds getter', () => {
  it('returns defaultState.nvsBounds before any apply() call', () => {
    const defaultState = makeDefaultState({
      nvsBounds: { x: 0.25, y: 0.25, w: 0.5, h: 0.5 },
    });
    const widget = new DiagramCanvasWidget('canvas', defaultState);

    expect(widget.nvsBounds).toEqual({ x: 0.25, y: 0.25, w: 0.5, h: 0.5 });
  });

  it('returns nvsBounds from the last applied state after apply()', () => {
    const defaultState = makeDefaultState({
      nvsBounds: { x: 0, y: 0, w: 1, h: 1 },
    });
    const widget = new DiagramCanvasWidget('canvas', defaultState);

    // initialize() with a real Three.js Scene (no WebGL required — pure scene graph).
    const scene = new THREE.Scene();
    widget.initialize({ scene, widgetId: 'canvas' });

    const appliedState = makeDefaultState({
      nvsBounds: { x: 0.1, y: 0.1, w: 0.8, h: 0.8 },
    });
    widget.apply(appliedState, makeRenderContext());

    expect(widget.nvsBounds).toEqual({ x: 0.1, y: 0.1, w: 0.8, h: 0.8 });
    widget.dispose();
  });

  it('returns the fullscreen default { x:0, y:0, w:1, h:1 } when defaultState is fullscreen and no apply() has run', () => {
    const widget = new DiagramCanvasWidget('canvas', makeDefaultState());
    expect(widget.nvsBounds).toEqual({ x: 0, y: 0, w: 1, h: 1 });
  });
});

// ─── computeNdcForNvs — NDC formula ──────────────────────────────────────────

describe('computeNdcForNvs — fullscreen NVS { x:0, y:0, w:1, h:1 }', () => {
  const fullscreen = { x: 0, y: 0, w: 1, h: 1 };
  const W = 1920;
  const H = 1080;

  it('maps pointer at top-left (0, 0) to NDC (-1, 1)', () => {
    const result = computeNdcForNvs(0, 0, W, H, fullscreen);
    expect(result.x).toBeCloseTo(-1);
    expect(result.y).toBeCloseTo(1);
  });

  it('maps pointer at center (960, 540) to NDC (0, 0)', () => {
    const result = computeNdcForNvs(960, 540, W, H, fullscreen);
    expect(result.x).toBeCloseTo(0);
    expect(result.y).toBeCloseTo(0);
  });

  it('maps pointer at bottom-right (1920, 1080) to NDC (1, -1)', () => {
    const result = computeNdcForNvs(1920, 1080, W, H, fullscreen);
    expect(result.x).toBeCloseTo(1);
    expect(result.y).toBeCloseTo(-1);
  });
});

describe('computeNdcForNvs — right-half sub-region NVS { x:0.5, y:0, w:0.5, h:1 }', () => {
  const rightHalf = { x: 0.5, y: 0, w: 0.5, h: 1 };
  const W = 1920;
  const H = 1080;

  it('maps pointer at (960, 540) — left edge of sub-region — to NDC (-1, 0)', () => {
    // pointerLocalX=960, regionLeft=0.5*1920=960, subX=0 → ndcX=(0/960)*2-1=-1
    // pointerLocalY=540, regionTop=0, subY=540 → ndcY=-(540/1080)*2+1=0
    const result = computeNdcForNvs(960, 540, W, H, rightHalf);
    expect(result.x).toBeCloseTo(-1);
    expect(result.y).toBeCloseTo(0);
  });

  it('maps pointer at (1440, 540) — center of sub-region — to NDC (0, 0)', () => {
    // pointerLocalX=1440, regionLeft=960, subX=480 → ndcX=(480/960)*2-1=0
    // pointerLocalY=540, regionTop=0, subY=540 → ndcY=-(540/1080)*2+1=0
    const result = computeNdcForNvs(1440, 540, W, H, rightHalf);
    expect(result.x).toBeCloseTo(0);
    expect(result.y).toBeCloseTo(0);
  });

  it('maps pointer at (1920, 0) — top-right of sub-region — to NDC (1, 1)', () => {
    // pointerLocalX=1920, regionLeft=960, subX=960 → ndcX=(960/960)*2-1=1
    // pointerLocalY=0, regionTop=0, subY=0 → ndcY=-(0/1080)*2+1=1
    const result = computeNdcForNvs(1920, 0, W, H, rightHalf);
    expect(result.x).toBeCloseTo(1);
    expect(result.y).toBeCloseTo(1);
  });
});
