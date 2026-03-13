// Tests for ModelWidget CUSTOM_NODE_HANDLER bounds composition via api.composeBounds.
// DEBT: Move makeIdentity/makeModelMeta/makeConfig to elementTestMocks.ts

import { describe, it, expect, vi } from 'vitest';
import { ModelWidget, type ModelWidgetConfig } from '../ModelWidget';
import type { SceneModelInstanceState } from '../types';
import type { ModelMeta } from '../metadata';
import type { NVSRect } from '@brewsite/core';
import { CUSTOM_NODE_HANDLER } from '@brewsite/core/widget/WidgetRegistry';

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

const makeIdentity = (): SceneModelInstanceState => ({
  model: {
    scale: 0.1,
    nvsX: 0.5,
    nvsY: 0.5,
    z: 0,
    rotation: [0, 0, 0],
    enabled: true,
    bodyPartOverrides: {},
  },
  playback: {
    motion: { commands: [], scenes: [], customAnimations: [] },
    animation: { enabled: false },
  },
  nvsBounds: { x: 0, y: 0, w: 1, h: 1 },
});

const makeModelMeta = (type: string): ModelMeta => ({
  type,
  glb: `/assets/${type}.glb`,
  bones: [],
  meshes: [],
  anchorTargets: {},
  bodyParts: [],
  identity: makeIdentity(),
});

const makeConfig = (type: string): ModelWidgetConfig => ({
  modelMeta: makeModelMeta(type),
  clipMeta: [],
});

// Mock ModelRenderer to avoid Three.js WebGL context
vi.mock('../ModelRenderer', () => {
  class MockModelRenderer {
    static disposeKtx2Loader = vi.fn();
    loadGlb = vi.fn().mockResolvedValue(undefined);
    apply = vi.fn();
    dispose = vi.fn();
    findNodeByName = vi.fn();
    getBoneWorldPositions = vi.fn(() => new Map());
    getTargetColors = vi.fn(() => new Map());
    constructor(_scene: unknown, _renderer?: unknown) {}
  }
  return { ModelRenderer: MockModelRenderer };
});

// ---------------------------------------------------------------------------
// Handler invocation helper
// ---------------------------------------------------------------------------

type HandlerFn = (
  node: { props: unknown },
  api: {
    setWidgetState: (id: string, state: SceneModelInstanceState) => void;
    composeBounds: (localRect: NVSRect) => NVSRect;
    state: { widgets: Record<string, unknown>; materialMetalnessMultiplier?: number; materialRoughnessMultiplier?: number };
    context: unknown;
  },
  helpers: {
    collectChildren: (n: { props: unknown }) => unknown[];
    resolveObjectValues: (v: unknown) => unknown;
    resolveValue: (v: unknown) => unknown;
  },
) => void;

/**
 * Invokes the ModelWidget CUSTOM_NODE_HANDLER with the given model props and a custom composeBounds.
 * Returns the SceneModelInstanceState captured by setWidgetState.
 */
const invokeHandlerWithCompose = (
  widget: ModelWidget,
  modelProps: Record<string, unknown>,
  composeBounds: (localRect: NVSRect) => NVSRect,
): SceneModelInstanceState => {
  const handler = (widget as unknown as Record<symbol, unknown>)[CUSTOM_NODE_HANDLER] as HandlerFn;
  let captured: SceneModelInstanceState | undefined;
  handler(
    { props: { ...modelProps, children: [] } },
    {
      setWidgetState: (_id, state) => { captured = state; },
      composeBounds,
      state: { widgets: {} },
      context: {},
    },
    {
      collectChildren: () => [],
      resolveObjectValues: (v) => v,
      resolveValue: (v) => v,
    },
  );
  if (!captured) throw new Error('Handler did not call setWidgetState');
  return captured;
};

/** Identity composeBounds — returns localRect unchanged. */
const identityCompose = (r: NVSRect): NVSRect => r;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ModelWidget CUSTOM_NODE_HANDLER composeBounds integration', () => {
  it('identity composeBounds → nvsBounds unchanged from DSL props', () => {
    const widget = new ModelWidget(makeConfig('bot'));
    const state = invokeHandlerWithCompose(widget, { x: 0.5, y: 0.1, w: 0.4, h: 0.8 }, identityCompose);
    expect(state.nvsBounds).toEqual({ x: 0.5, y: 0.1, w: 0.4, h: 0.8 });
    expect(state.model.nvsX).toBeCloseTo(0.5 + 0.4 / 2);
    expect(state.model.nvsY).toBeCloseTo(0.1 + 0.8 / 2);
  });

  it('identity composeBounds → fullscreen defaults when no x/y/w/h provided', () => {
    const widget = new ModelWidget(makeConfig('bot'));
    const state = invokeHandlerWithCompose(widget, {}, identityCompose);
    expect(state.nvsBounds).toEqual({ x: 0, y: 0, w: 1, h: 1 });
    expect(state.model.nvsX).toBeCloseTo(0.5);
    expect(state.model.nvsY).toBeCloseTo(0.5);
  });

  it('non-identity composeBounds → nvsBounds and nvsX/nvsY correctly composed', () => {
    // Parent region: [0.1, 0.1, 0.8, 0.8] — model placed at full area [0.5, 0.1, 0.4, 0.8] locally
    // Expected composed: { x: 0.1 + 0.5*0.8, y: 0.1 + 0.1*0.8, w: 0.4*0.8, h: 0.8*0.8 }
    //                  = { x: 0.5, y: 0.18, w: 0.32, h: 0.64 }
    const parentCompose = (r: NVSRect): NVSRect => ({
      x: 0.1 + r.x * 0.8,
      y: 0.1 + r.y * 0.8,
      w: r.w * 0.8,
      h: r.h * 0.8,
    });
    const widget = new ModelWidget(makeConfig('bot'));
    const state = invokeHandlerWithCompose(widget, { x: 0.5, y: 0.1, w: 0.4, h: 0.8 }, parentCompose);

    expect(state.nvsBounds.x).toBeCloseTo(0.5);
    expect(state.nvsBounds.y).toBeCloseTo(0.18);
    expect(state.nvsBounds.w).toBeCloseTo(0.32);
    expect(state.nvsBounds.h).toBeCloseTo(0.64);

    // nvsX = composed.x + composed.w / 2 = 0.5 + 0.32/2 = 0.66
    expect(state.model.nvsX).toBeCloseTo(0.5 + 0.32 / 2);
    // nvsY = composed.y + composed.h / 2 = 0.18 + 0.64/2 = 0.5
    expect(state.model.nvsY).toBeCloseTo(0.18 + 0.64 / 2);
  });

  it('non-identity composeBounds with fullscreen local → composed into parent bounds', () => {
    // Local [0,0,1,1] composed into parent [0.1,0.1,0.8,0.8]
    const parentCompose = (r: NVSRect): NVSRect => ({
      x: 0.1 + r.x * 0.8,
      y: 0.1 + r.y * 0.8,
      w: r.w * 0.8,
      h: r.h * 0.8,
    });
    const widget = new ModelWidget(makeConfig('bot'));
    const state = invokeHandlerWithCompose(widget, {}, parentCompose);

    expect(state.nvsBounds).toEqual({ x: 0.1, y: 0.1, w: 0.8, h: 0.8 });
    expect(state.model.nvsX).toBeCloseTo(0.5);
    expect(state.model.nvsY).toBeCloseTo(0.5);
  });
});
