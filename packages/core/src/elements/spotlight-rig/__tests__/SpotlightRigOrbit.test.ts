// SpotlightRigOrbit tests — CUSTOM_NODE_HANDLER orbit extraction and per-light resolution.
// Tests the handler in isolation using minimal CompileApi and CompileHelpers test doubles.

import { describe, it, expect, beforeEach } from 'vitest';
import { createElement, isValidElement } from 'react';
import { SpotlightRigWidget, SpotlightRig, Spotlight } from '../SpotlightRigWidget';
import { CUSTOM_NODE_HANDLER } from '../../../widget/index';
import type { CompileApi, CompileHelpers } from '../../../compiler/sceneDslTypes';
import type { SpotlightRigState, OrbitFn } from '../types';
import type { SceneFrame } from '../../../compiler/sceneTrackTypes';
import type { NVSRect } from '../../../layout/types';

// ─── Test doubles ────────────────────────────────────────────────────────────

/**
 * Minimal CompileApi conforming to the interface contract.
 * Only populates fields that the SpotlightRigWidget handler actually uses.
 */
const makeApi = (
  sceneIndex = 0,
): {
  api: CompileApi;
  capturedWidgetState: Map<string, unknown>;
} => {
  const captured = new Map<string, unknown>();
  const api: CompileApi = {
    context: { sceneIndex, numScenes: 3, assetsReady: true },
    state: { id: 'test', scrollProgress: 0, widgets: {} } as SceneFrame,
    setWidgetState: (id, s) => { captured.set(id, s); },
    setSceneMeta: () => {},
    pushWarning: () => {},
    composeBounds: (r: NVSRect) => r,
    composeZ: (z: number) => z,
    composeOpacity: (o: number) => o,
  };
  return { api, capturedWidgetState: captured };
};

/**
 * Minimal CompileHelpers conforming to the interface contract.
 * collectChildren uses React.Children semantics on node.props.children.
 * resolveObjectValues and stripUndefinedDeep are identity transforms (values are already concrete).
 */
const makeHelpers = (): CompileHelpers => ({
  compileChildren: () => {},
  compileChildrenSeparated: () => [],
  resolveValue: <T>(v: T | ((ctx: unknown) => T)) =>
    typeof v === 'function' ? (v as (ctx: unknown) => T)({}) : v,
  resolveObjectValues: <T extends Record<string, unknown>>(v: T) => v,
  stripUndefinedDeep: <T extends Record<string, unknown>>(v: T): T => {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(v)) {
      if (val !== undefined) result[key] = val;
    }
    return result as T;
  },
  collectChildren: (node) => {
    const children = (node.props as Record<string, unknown>).children;
    if (!children) return [];
    if (Array.isArray(children)) return children;
    return [children];
  },
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('SpotlightRigWidget CUSTOM_NODE_HANDLER — child collection', () => {
  let widget: SpotlightRigWidget;
  const helpers = makeHelpers();

  beforeEach(() => {
    widget = new SpotlightRigWidget('spotlight-rig');
  });

  it('handler with two <Spotlight> children: setWidgetState called with lights array of length 2', () => {
    const { api, capturedWidgetState } = makeApi(0);
    const node = createElement(SpotlightRig, null,
      createElement(Spotlight, { color: '#ff0000' }),
      createElement(Spotlight, { color: '#00ff00' }),
    );

    widget[CUSTOM_NODE_HANDLER](node, api, helpers);

    const state = capturedWidgetState.get('spotlight-rig') as SpotlightRigState;
    expect(state.lights).toHaveLength(2);
  });

  it('handler with three <Spotlight> children: lights array of length 3', () => {
    const { api, capturedWidgetState } = makeApi(0);
    const node = createElement(SpotlightRig, null,
      createElement(Spotlight, {}),
      createElement(Spotlight, {}),
      createElement(Spotlight, {}),
    );

    widget[CUSTOM_NODE_HANDLER](node, api, helpers);

    const state = capturedWidgetState.get('spotlight-rig') as SpotlightRigState;
    expect(state.lights).toHaveLength(3);
  });

  it('handler with zero children: lights array of length 0', () => {
    const { api, capturedWidgetState } = makeApi(0);
    const node = createElement(SpotlightRig, {});

    widget[CUSTOM_NODE_HANDLER](node, api, helpers);

    const state = capturedWidgetState.get('spotlight-rig') as SpotlightRigState;
    expect(state.lights).toHaveLength(0);
  });

  it('non-<Spotlight> children are skipped silently', () => {
    const { api, capturedWidgetState } = makeApi(0);
    const NonSpotlight = (_props: Record<string, unknown>): null => null;
    const node = createElement(SpotlightRig, null,
      createElement(Spotlight, {}),
      createElement(NonSpotlight, {}),
      createElement(Spotlight, {}),
    );

    widget[CUSTOM_NODE_HANDLER](node, api, helpers);

    const state = capturedWidgetState.get('spotlight-rig') as SpotlightRigState;
    // Only the two <Spotlight> children count — the NonSpotlight is skipped
    expect(state.lights).toHaveLength(2);
  });
});

describe('SpotlightRigWidget CUSTOM_NODE_HANDLER — orbit function extraction', () => {
  let widget: SpotlightRigWidget;
  const helpers = makeHelpers();

  beforeEach(() => {
    widget = new SpotlightRigWidget('spotlight-rig');
  });

  it('handler with <Spotlight orbit={fn}>: widget._orbitStore contains fn at sceneIndex → 0', () => {
    const { api } = makeApi(0);
    const fn: OrbitFn = (t) => [t, 0, 0];
    const node = createElement(SpotlightRig, null,
      createElement(Spotlight, { orbit: fn }),
    );

    widget[CUSTOM_NODE_HANDLER](node, api, helpers);

    const stored = widget.getOrbitFns(0);
    expect(stored[0]).toBe(fn);
  });

  it('handler with two orbit fns: both stored at indices 0 and 1', () => {
    const { api } = makeApi(0);
    const fn0: OrbitFn = (t) => [t, 0, 0];
    const fn1: OrbitFn = (t) => [0, t, 0];
    const node = createElement(SpotlightRig, null,
      createElement(Spotlight, { orbit: fn0 }),
      createElement(Spotlight, { orbit: fn1 }),
    );

    widget[CUSTOM_NODE_HANDLER](node, api, helpers);

    const stored = widget.getOrbitFns(0);
    expect(stored[0]).toBe(fn0);
    expect(stored[1]).toBe(fn1);
  });

  it('handler with <Spotlight> (no orbit): orbit store is empty for that scene', () => {
    const { api } = makeApi(0);
    const node = createElement(SpotlightRig, null,
      createElement(Spotlight, { color: '#ffffff' }),
    );

    widget[CUSTOM_NODE_HANDLER](node, api, helpers);

    // No orbit fn stored for scene 0
    expect(widget.getOrbitFns(0)).toHaveLength(0);
  });

  it('handler fires twice for two different scenes: orbit store maps both independently', () => {
    const fn0: OrbitFn = (t) => [t, 0, 0];
    const fn1: OrbitFn = (t) => [0, t, 0];

    const { api: api0 } = makeApi(0);
    const nodeScene0 = createElement(SpotlightRig, null,
      createElement(Spotlight, { orbit: fn0 }),
    );
    widget[CUSTOM_NODE_HANDLER](nodeScene0, api0, helpers);

    const { api: api1 } = makeApi(1);
    const nodeScene1 = createElement(SpotlightRig, null,
      createElement(Spotlight, { orbit: fn1 }),
    );
    widget[CUSTOM_NODE_HANDLER](nodeScene1, api1, helpers);

    expect(widget.getOrbitFns(0)[0]).toBe(fn0);
    expect(widget.getOrbitFns(1)[0]).toBe(fn1);
    // Scene 0 store not polluted by scene 1
    expect(widget.getOrbitFns(0)).toHaveLength(1);
    expect(widget.getOrbitFns(1)).toHaveLength(1);
  });

  it('orbit fn stored at correct sceneIndex when sceneIndex > 0', () => {
    const { api } = makeApi(2);
    const fn: OrbitFn = (t) => [t, t, t];
    const node = createElement(SpotlightRig, null,
      createElement(Spotlight, { orbit: fn }),
    );

    widget[CUSTOM_NODE_HANDLER](node, api, helpers);

    // Stored at scene 2, not scene 0
    expect(widget.getOrbitFns(0)).toHaveLength(0);
    expect(widget.getOrbitFns(2)[0]).toBe(fn);
  });
});

describe('SpotlightRigWidget CUSTOM_NODE_HANDLER — state output', () => {
  let widget: SpotlightRigWidget;
  const helpers = makeHelpers();

  beforeEach(() => {
    widget = new SpotlightRigWidget('spotlight-rig');
  });

  it('per-light color prop propagates to lights[0].color', () => {
    const { api, capturedWidgetState } = makeApi(0);
    const node = createElement(SpotlightRig, null,
      createElement(Spotlight, { color: '#abcdef' }),
    );

    widget[CUSTOM_NODE_HANDLER](node, api, helpers);

    const state = capturedWidgetState.get('spotlight-rig') as SpotlightRigState;
    expect(state.lights[0]!.color).toBe('#abcdef');
  });

  it('rig-level center prop propagates to state.center', () => {
    const { api, capturedWidgetState } = makeApi(0);
    const node = createElement(SpotlightRig, { center: [1, 2, 3] },
      createElement(Spotlight, {}),
    );

    widget[CUSTOM_NODE_HANDLER](node, api, helpers);

    const state = capturedWidgetState.get('spotlight-rig') as SpotlightRigState;
    expect(state.center).toEqual([1, 2, 3]);
  });

  it('rig-level target prop propagates to state.target', () => {
    const { api, capturedWidgetState } = makeApi(0);
    const node = createElement(SpotlightRig, { target: [0, 0, -4] },
      createElement(Spotlight, {}),
    );

    widget[CUSTOM_NODE_HANDLER](node, api, helpers);

    const state = capturedWidgetState.get('spotlight-rig') as SpotlightRigState;
    expect(state.target).toEqual([0, 0, -4]);
  });

  it('isValidElement guard: non-element children are skipped', () => {
    const { api, capturedWidgetState } = makeApi(0);
    // Manually create a node with a non-element child in the children array
    const node = createElement(SpotlightRig, null,
      createElement(Spotlight, {}),
    );
    // Override collectChildren to include a non-element
    const customHelpers: CompileHelpers = {
      ...helpers,
      collectChildren: () => [
        createElement(Spotlight, {}),
        'a string child',   // not a valid React element
        42,                  // number — not a valid React element
      ],
    };

    widget[CUSTOM_NODE_HANDLER](node, api, customHelpers);

    const state = capturedWidgetState.get('spotlight-rig') as SpotlightRigState;
    // Only the valid <Spotlight> element counted
    expect(state.lights).toHaveLength(1);
  });
});
