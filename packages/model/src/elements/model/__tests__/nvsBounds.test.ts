// Tests for NVS bounds compilation and ModelWidget.nvsBounds getter.

import { describe, it, expect, vi } from 'vitest';
import { createDefaultModelInstanceState } from '../compile';
import { ModelWidget, type ModelWidgetConfig } from '../ModelWidget';
import type { SceneModelInstanceState } from '../types';
import type { ModelMeta } from '../metadata';
import { CUSTOM_NODE_HANDLER } from '@brewsite/core/widget/WidgetRegistry';

// ---------------------------------------------------------------------------
// Shared fixture helpers
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
// compile.ts — nvsBounds in createDefaultModelInstanceState
// ---------------------------------------------------------------------------

describe('createDefaultModelInstanceState nvsBounds default', () => {
  it('provides fullscreen nvsBounds when identity has nvsBounds', () => {
    const identity = makeIdentity();
    const state = createDefaultModelInstanceState('bot', identity);
    expect(state.nvsBounds).toEqual({ x: 0, y: 0, w: 1, h: 1 });
  });

  it('fills fullscreen nvsBounds when identity lacks nvsBounds (old manifest)', () => {
    // Simulate a JSON manifest identity with no nvsBounds field.
    const identity = makeIdentity();
    const legacyIdentity = { ...identity } as SceneModelInstanceState;
    // Force omit nvsBounds to simulate an old manifest
    delete (legacyIdentity as Record<string, unknown>)['nvsBounds'];
    const state = createDefaultModelInstanceState('bot', legacyIdentity as SceneModelInstanceState);
    expect(state.nvsBounds).toEqual({ x: 0, y: 0, w: 1, h: 1 });
  });
});

// ---------------------------------------------------------------------------
// CUSTOM_NODE_HANDLER — nvsBounds mapping from DSL props
// ---------------------------------------------------------------------------

describe('ModelWidget CUSTOM_NODE_HANDLER nvsBounds', () => {
  /**
   * Minimal handler invocation helper.
   * Resolves the custom node handler from the widget and calls it with the given props.
   */
  const invokeHandler = (
    widget: ModelWidget,
    modelProps: Record<string, unknown>,
  ): SceneModelInstanceState => {
    type HandlerFn = (
      node: { props: unknown },
      api: {
        setWidgetState: (id: string, state: SceneModelInstanceState) => void;
        state: { widgets: Record<string, unknown>; materialMetalnessMultiplier?: number; materialRoughnessMultiplier?: number };
        context: unknown;
      },
      helpers: {
        collectChildren: (n: { props: unknown }) => unknown[];
        resolveObjectValues: (v: unknown) => unknown;
        resolveValue: (v: unknown) => unknown;
      },
    ) => void;

    const handler = (widget as unknown as Record<symbol, unknown>)[CUSTOM_NODE_HANDLER] as HandlerFn;
    let captured: SceneModelInstanceState | undefined;
    handler(
      { props: { ...modelProps, children: [] } },
      {
        setWidgetState: (_id, state) => { captured = state; },
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

  it('maps x/y/w/h props to nvsBounds', () => {
    const widget = new ModelWidget(makeConfig('bot'));
    const state = invokeHandler(widget, { x: 0.5, y: 0.25, w: 0.5, h: 0.75 });
    expect(state.nvsBounds).toEqual({ x: 0.5, y: 0.25, w: 0.5, h: 0.75 });
  });

  it('defaults nvsBounds to fullscreen when no x/y/w/h props are provided', () => {
    const widget = new ModelWidget(makeConfig('bot'));
    const state = invokeHandler(widget, {});
    expect(state.nvsBounds).toEqual({ x: 0, y: 0, w: 1, h: 1 });
  });

  it('defaults individual missing props while using provided ones', () => {
    const widget = new ModelWidget(makeConfig('bot'));
    // Only w and h provided — x and y default to 0
    const state = invokeHandler(widget, { w: 0.5, h: 0.5 });
    expect(state.nvsBounds).toEqual({ x: 0, y: 0, w: 0.5, h: 0.5 });
  });
});

// ---------------------------------------------------------------------------
// ModelWidget.nvsBounds getter
// ---------------------------------------------------------------------------

describe('ModelWidget.nvsBounds getter', () => {
  it('returns fullscreen default before any apply() call', () => {
    const widget = new ModelWidget(makeConfig('bot'));
    expect(widget.nvsBounds).toEqual({ x: 0, y: 0, w: 1, h: 1 });
  });

  it('returns last applied state nvsBounds after apply()', () => {
    const widget = new ModelWidget(makeConfig('bot'));

    // Apply a state with a sub-region nvsBounds
    const state: SceneModelInstanceState = {
      ...makeIdentity(),
      nvsBounds: { x: 0.5, y: 0, w: 0.5, h: 1 },
    };

    // apply() needs renderer but we can call it regardless — it guards with if (!this.renderer)
    const fakeContext = {
      delta: 0,
      elapsed: 0,
      sceneProgress: 0,
      variables: { get: () => undefined },
      extra: undefined,
    };
    widget.apply(state, fakeContext as never);

    expect(widget.nvsBounds).toEqual({ x: 0.5, y: 0, w: 0.5, h: 1 });
  });

  it('returns updated nvsBounds after second apply() with different bounds', () => {
    const widget = new ModelWidget(makeConfig('bot'));
    const fakeContext = {
      delta: 0,
      elapsed: 0,
      sceneProgress: 0,
      variables: { get: () => undefined },
      extra: undefined,
    };

    const first: SceneModelInstanceState = {
      ...makeIdentity(),
      nvsBounds: { x: 0, y: 0, w: 0.5, h: 1 },
    };
    widget.apply(first, fakeContext as never);
    expect(widget.nvsBounds).toEqual({ x: 0, y: 0, w: 0.5, h: 1 });

    const second: SceneModelInstanceState = {
      ...makeIdentity(),
      nvsBounds: { x: 0.5, y: 0, w: 0.5, h: 1 },
    };
    widget.apply(second, fakeContext as never);
    expect(widget.nvsBounds).toEqual({ x: 0.5, y: 0, w: 0.5, h: 1 });
  });
});
