// modelDslHandler.test.ts — Tests for buildModelNodeHandler factory and merge helpers.
// Uses real CompileApi fixture — no mocks for business logic.

import { describe, it, expect } from 'vitest';
import React from 'react';
import type { CompileApi, NVSRect } from '@brewsite/core';
import type { SceneModelInstanceState } from '../types';
import {
  buildModelNodeHandler,
  mergeBodyPartOverrides,
  mergeSubparts,
  mergeModelParts,
  getModelAuthoredFlags,
  setModelAuthoredFlagsForTest,
  type ModelAuthoredFlags,
} from '../modelDslHandler';
import { createDefaultModelInstanceState } from '../compile';

// ─── DSL stub components (same stubs as ModelWidget.ts) ──────────────────────

const Model = (_props: Record<string, unknown>) => null;
const ModelRouter = (_props: Record<string, unknown>) => null;
const BodyParts = (_props: Record<string, unknown>) => null;
const BodyPart = (_props: Record<string, unknown>) => null;
const Pose = (_props: Record<string, unknown>) => null;
const ModelPart = (_props: Record<string, unknown>) => null;
const ContainedModel = (_props: Record<string, unknown>) => null;
const Subpart = (_props: Record<string, unknown>) => null;
const Playback = (_props: Record<string, unknown>) => null;
const Motion = (_props: Record<string, unknown>) => null;
const Animation = (_props: Record<string, unknown>) => null;
const Label = (_props: Record<string, unknown>) => null;
Label.displayName = 'Label';

const COMPONENTS = {
  Model: Model as React.ComponentType<unknown>,
  BodyParts: BodyParts as React.ComponentType<unknown>,
  BodyPart: BodyPart as React.ComponentType<unknown>,
  Pose: Pose as React.ComponentType<unknown>,
  ModelPart: ModelPart as React.ComponentType<unknown>,
  ContainedModel: ContainedModel as React.ComponentType<unknown>,
  Subpart: Subpart as React.ComponentType<unknown>,
  Playback: Playback as React.ComponentType<unknown>,
  Motion: Motion as React.ComponentType<unknown>,
  Animation: Animation as React.ComponentType<unknown>,
  Label: Label as React.ComponentType<unknown>,
};

// ─── Minimal real CompileApi fixture ─────────────────────────────────────────

function makeCompileApi(widgetId: string): {
  api: CompileApi;
  getState(): SceneModelInstanceState;
} {
  let stored: SceneModelInstanceState | null = null;
  const api: CompileApi = {
    context: {
      sceneId: 'test-scene',
      sceneIndex: 0,
      scrollProgress: 0,
      prevSceneState: null,
    } as ReturnType<CompileApi['context']['valueOf']> as CompileApi['context'],
    state: {
      widgets: {},
      materialMetalnessMultiplier: 1,
      materialRoughnessMultiplier: 1,
    } as CompileApi['state'],
    setWidgetState: (_id: string, s: unknown) => {
      stored = s as SceneModelInstanceState;
    },
    composeBounds: (b: NVSRect) => b,
    pushHudItem: () => {},
    pushLabel: () => {},
    setSceneMeta: () => {},
  } as unknown as CompileApi;
  return {
    api,
    getState: () => stored!,
  };
}

// Minimal real compile helpers — identity resolver, child collector
const makeHelpers = () => ({
  collectChildren: (n: { props: Record<string, unknown> }) => {
    const children = n.props.children;
    if (Array.isArray(children)) return children;
    if (children) return [children];
    return [];
  },
  resolveObjectValues: (v: unknown) => v,
  resolveValue: (v: unknown) => v,
});

// ─── Default state fixture ────────────────────────────────────────────────────

const makeDefaultState = (): SceneModelInstanceState => ({
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

// ─── buildModelNodeHandler ────────────────────────────────────────────────────

describe('buildModelNodeHandler', () => {
  it('produces SceneModelInstanceState with correct nvsX/nvsY from x/y/w/h props', () => {
    const defaultState = makeDefaultState();
    const handler = buildModelNodeHandler({
      widgetId: 'bot',
      defaultState,
      components: COMPONENTS,
    });
    const { api, getState } = makeCompileApi('bot');
    const node = { props: { x: 0.25, y: 0.25, w: 0.5, h: 0.5, children: [] } };
    handler(node as never, api, makeHelpers() as never);
    const state = getState();
    // nvsX = 0.25 + 0.5/2 = 0.5
    // nvsY = 0.25 + 0.5/2 = 0.5
    expect(state.model.nvsX).toBeCloseTo(0.5);
    expect(state.model.nvsY).toBeCloseTo(0.5);
    expect(state.nvsBounds).toEqual({ x: 0.25, y: 0.25, w: 0.5, h: 0.5 });
  });

  it('uses default bounds when x/y/w/h are not provided', () => {
    const defaultState = makeDefaultState();
    const handler = buildModelNodeHandler({
      widgetId: 'bot',
      defaultState,
      components: COMPONENTS,
    });
    const { api, getState } = makeCompileApi('bot');
    const node = { props: { children: [] } };
    handler(node as never, api, makeHelpers() as never);
    const state = getState();
    expect(state.nvsBounds).toEqual({ x: 0, y: 0, w: 1, h: 1 });
    expect(state.model.nvsX).toBeCloseTo(0.5);
    expect(state.model.nvsY).toBeCloseTo(0.5);
  });

  it('merges BodyPart overrides from <BodyParts> container', () => {
    const defaultState = makeDefaultState();
    const handler = buildModelNodeHandler({
      widgetId: 'bot',
      defaultState,
      components: COMPONENTS,
    });
    const { api, getState } = makeCompileApi('bot');
    const node = {
      props: {
        children: [
          React.createElement(BodyParts, {},
            React.createElement(BodyPart, { id: 'Head', opacity: 0.7 }),
          ),
        ],
      },
    };
    handler(node as never, api, makeHelpers() as never);
    const state = getState();
    expect(state.model.bodyPartOverrides?.Head?.opacity).toBe(0.7);
  });

  it('merges BodyPart overrides from direct <BodyPart> child of <Model>', () => {
    const defaultState = makeDefaultState();
    const handler = buildModelNodeHandler({
      widgetId: 'bot',
      defaultState,
      components: COMPONENTS,
    });
    const { api, getState } = makeCompileApi('bot');
    const node = {
      props: {
        children: [
          React.createElement(BodyPart, { id: 'Chest', opacity: 0.5 }),
        ],
      },
    };
    handler(node as never, api, makeHelpers() as never);
    const state = getState();
    expect(state.model.bodyPartOverrides?.Chest?.opacity).toBe(0.5);
  });

  it('applies <Pose> children inside <BodyPart> with pitchPct/yawPct/rollPct', () => {
    const defaultState = makeDefaultState();
    const handler = buildModelNodeHandler({
      widgetId: 'bot',
      defaultState,
      components: COMPONENTS,
    });
    const { api, getState } = makeCompileApi('bot');
    const node = {
      props: {
        children: [
          React.createElement(BodyPart, { id: 'Head' },
            React.createElement(Pose, { yawPct: 0.3, pitchPct: 0.1 }),
          ),
        ],
      },
    };
    handler(node as never, api, makeHelpers() as never);
    const state = getState();
    expect(state.model.bodyPartOverrides?.Head?.pose?.rotate?.yawPct).toBeCloseTo(0.3);
    expect(state.model.bodyPartOverrides?.Head?.pose?.rotate?.pitchPct).toBeCloseTo(0.1);
  });

  it('processes <Label> inside <BodyPart> and stores in labels array', () => {
    const defaultState = makeDefaultState();
    const handler = buildModelNodeHandler({
      widgetId: 'bot',
      defaultState,
      components: COMPONENTS,
    });
    const { api, getState } = makeCompileApi('bot');
    const node = {
      props: {
        children: [
          React.createElement(BodyPart, { id: 'Head' },
            React.createElement(Label, { id: 'lbl1', text: 'Head Label' }),
          ),
        ],
      },
    };
    handler(node as never, api, makeHelpers() as never);
    const state = getState();
    expect(state.labels).toHaveLength(1);
    expect(state.labels?.[0].id).toBe('lbl1');
    expect(state.labels?.[0].text).toBe('Head Label');
  });

  it('processes <ModelPart> with <ContainedModel> child', () => {
    const defaultState = makeDefaultState();
    const handler = buildModelNodeHandler({
      widgetId: 'bot',
      defaultState,
      components: COMPONENTS,
    });
    const { api, getState } = makeCompileApi('bot');
    const node = {
      props: {
        children: [
          React.createElement(ModelPart, { id: 'arm', anchor: 'shoulder' },
            React.createElement(ContainedModel, { modelId: 'child-bot', position: [1, 2, 3] }),
          ),
        ],
      },
    };
    handler(node as never, api, makeHelpers() as never);
    const state = getState();
    expect(state.model.parts?.arm?.modelId).toBe('child-bot');
    expect(state.model.parts?.arm?.containedPosition).toEqual([1, 2, 3]);
  });

  it('processes <Playback> with <Animation> child — sets clipName, weight, enabled', () => {
    const defaultState = makeDefaultState();
    const handler = buildModelNodeHandler({
      widgetId: 'bot',
      defaultState,
      components: COMPONENTS,
    });
    const { api, getState } = makeCompileApi('bot');
    const node = {
      props: {
        children: [
          React.createElement(Playback, {},
            React.createElement(Animation, { enabled: true, clipName: 'idle', weight: 0.8 }),
          ),
        ],
      },
    };
    handler(node as never, api, makeHelpers() as never);
    const state = getState();
    expect(state.playback.animation.enabled).toBe(true);
    expect(state.playback.animation.clipName).toBe('idle');
    expect(state.playback.animation.weight).toBe(0.8);
  });

  it('processes <Playback> with <Motion> child — sets commands, scenes', () => {
    const defaultState = makeDefaultState();
    const handler = buildModelNodeHandler({
      widgetId: 'bot',
      defaultState,
      components: COMPONENTS,
    });
    const { api, getState } = makeCompileApi('bot');
    const commands = [{ groupId: 'head', rotate: { yawPct: 0.5 } }];
    const scenes = [{ id: 'walk', start: 0, end: 2 }];
    const node = {
      props: {
        children: [
          React.createElement(Playback, {},
            React.createElement(Motion, { commands, scenes }),
          ),
        ],
      },
    };
    handler(node as never, api, makeHelpers() as never);
    const state = getState();
    expect(state.playback.motion.commands).toHaveLength(1);
    expect(state.playback.motion.commands[0].groupId).toBe('head');
    expect(state.playback.motion.scenes).toHaveLength(1);
  });

  it('attaches authored flags with correct authored fields', () => {
    const defaultState = makeDefaultState();
    const handler = buildModelNodeHandler({
      widgetId: 'bot',
      defaultState,
      components: COMPONENTS,
    });
    const { api, getState } = makeCompileApi('bot');
    const node = {
      props: {
        scale: 0.5,
        opacity: 1,
        children: [
          React.createElement(Playback, {},
            React.createElement(Animation, { enabled: true, clipName: 'idle' }),
          ),
        ],
      },
    };
    handler(node as never, api, makeHelpers() as never);
    const state = getState();
    const flags = getModelAuthoredFlags(state);
    expect(flags?.model?.scale).toBe(true);
    expect(flags?.model?.opacity).toBe(true);
    expect(flags?.playback?.animation?.enabled).toBe(true);
    expect(flags?.playback?.animation?.clipName).toBe(true);
  });

  it('sets model.scale from authored props', () => {
    const defaultState = makeDefaultState();
    const handler = buildModelNodeHandler({
      widgetId: 'bot',
      defaultState,
      components: COMPONENTS,
    });
    const { api, getState } = makeCompileApi('bot');
    const node = { props: { scale: 0.25, children: [] } };
    handler(node as never, api, makeHelpers() as never);
    const state = getState();
    expect(state.model.scale).toBe(0.25);
  });

  it('respects reset=true on Model props', () => {
    const defaultState = makeDefaultState();
    const handler = buildModelNodeHandler({
      widgetId: 'bot',
      defaultState,
      components: COMPONENTS,
    });
    const { api, getState } = makeCompileApi('bot');
    const node = { props: { reset: true, children: [] } };
    handler(node as never, api, makeHelpers() as never);
    const state = getState();
    const flags = getModelAuthoredFlags(state);
    expect(state.model.reset).toBe(true);
    expect(flags?.model?.reset).toBe(true);
  });

  it('handles model enabled=false', () => {
    const defaultState = makeDefaultState();
    const handler = buildModelNodeHandler({
      widgetId: 'bot',
      defaultState,
      components: COMPONENTS,
    });
    const { api, getState } = makeCompileApi('bot');
    const node = { props: { enabled: false, children: [] } };
    handler(node as never, api, makeHelpers() as never);
    const state = getState();
    expect(state.enabled).toBe(false);
    const flags = getModelAuthoredFlags(state);
    expect(flags?.enabled).toBe(true);
  });

  it('applies scene-level metalnessMultiplier × model-level multiplier', () => {
    const defaultState = makeDefaultState();
    const handler = buildModelNodeHandler({
      widgetId: 'bot',
      defaultState,
      components: COMPONENTS,
    });
    const { api, getState } = makeCompileApi('bot');
    // Override scene-level multipliers on the api.state
    (api.state as Record<string, unknown>).materialMetalnessMultiplier = 2;
    (api.state as Record<string, unknown>).materialRoughnessMultiplier = 3;
    const node = { props: { metalnessMultiplier: 0.5, roughnessMultiplier: 2, children: [] } };
    handler(node as never, api, makeHelpers() as never);
    const state = getState();
    // metalnessMultiplier: 2 * 0.5 = 1
    expect(state.model.metalnessMultiplier).toBeCloseTo(1);
    // roughnessMultiplier: 3 * 2 = 6
    expect(state.model.roughnessMultiplier).toBeCloseTo(6);
  });
});

// ─── mergeBodyPartOverrides ───────────────────────────────────────────────────

describe('mergeBodyPartOverrides', () => {
  it('returns undefined for empty/undefined inputs', () => {
    expect(mergeBodyPartOverrides(undefined, undefined)).toBeUndefined();
    expect(mergeBodyPartOverrides({}, {})).toBeUndefined();
    expect(mergeBodyPartOverrides(undefined, {})).toBeUndefined();
  });

  it('deep-merges two maps without reset — next wins on shared keys', () => {
    const prev = { Head: { opacity: 0.5, color: '#ff0000' } };
    const next = { Head: { opacity: 1 } };
    const result = mergeBodyPartOverrides(prev, next);
    expect(result?.Head?.opacity).toBe(1);
    // color from prev is preserved because next doesn't specify it
    expect(result?.Head?.color).toBe('#ff0000');
  });

  it('resets a part when override.reset=true — discards prev state for that part', () => {
    const prev = { Head: { opacity: 0.5, color: '#ff0000', pose: { rotate: { yawPct: 1 } } } };
    const next = { Head: { reset: true, opacity: 1 } };
    const result = mergeBodyPartOverrides(prev, next);
    // After reset, no leftover color or pose from prev
    expect(result?.Head?.color).toBeUndefined();
    expect(result?.Head?.pose).toBeUndefined();
    expect(result?.Head?.opacity).toBe(1);
    // reset flag is deleted from the merged result
    expect(result?.Head?.reset).toBeUndefined();
  });

  it('applies poseReset — replaces pose with zeroed values', () => {
    const prev = { Head: { pose: { rotate: { yawPct: 1, pitchPct: 0.5 } } } };
    const next = { Head: { poseReset: true } };
    const result = mergeBodyPartOverrides(prev, next);
    expect(result?.Head?.pose?.rotate?.yawPct).toBeCloseTo(0);
    expect(result?.Head?.pose?.rotate?.pitchPct).toBeCloseTo(0);
    // poseReset flag removed from result
    expect(result?.Head?.poseReset).toBeUndefined();
  });

  it('preserves parts not mentioned in next', () => {
    const prev = { Head: { opacity: 0.5 }, Chest: { opacity: 0.8 } };
    const next = { Head: { opacity: 1 } };
    const result = mergeBodyPartOverrides(prev, next);
    expect(result?.Chest?.opacity).toBe(0.8);
  });

  it('removes part when reset results in empty object', () => {
    const prev = { Head: { opacity: 0.5 } };
    const next = { Head: { reset: true } };
    // reset=true with no other fields → merged is empty → part removed
    const result = mergeBodyPartOverrides(prev, next);
    expect(result?.Head).toBeUndefined();
  });
});

// ─── mergeSubparts ────────────────────────────────────────────────────────────

describe('mergeSubparts', () => {
  it('returns undefined for empty/undefined inputs', () => {
    expect(mergeSubparts(undefined, undefined)).toBeUndefined();
    expect(mergeSubparts({}, {})).toBeUndefined();
  });

  it('deep-merges subpart maps — next wins on shared keys', () => {
    const prev = { Brim: { id: 'Brim', opacity: 0.5, color: '#ff0000' } };
    const next = { Brim: { id: 'Brim', opacity: 1 } };
    const result = mergeSubparts(prev, next);
    expect(result?.Brim?.opacity).toBe(1);
    expect(result?.Brim?.color).toBe('#ff0000');
  });

  it('resets a subpart when reset=true', () => {
    const prev = { Brim: { id: 'Brim', opacity: 0.5, color: '#ff0000' } };
    const next = { Brim: { id: 'Brim', reset: true, opacity: 1 } };
    const result = mergeSubparts(prev, next);
    // After reset, prev color is gone
    expect(result?.Brim?.color).toBeUndefined();
    expect(result?.Brim?.opacity).toBe(1);
    expect(result?.Brim?.reset).toBeUndefined();
  });

  it('preserves subparts not mentioned in next', () => {
    const prev = { Brim: { id: 'Brim', opacity: 0.5 }, Sole: { id: 'Sole', opacity: 0.8 } };
    const next = { Brim: { id: 'Brim', opacity: 1 } };
    const result = mergeSubparts(prev, next);
    expect(result?.Sole?.opacity).toBe(0.8);
  });
});

// ─── mergeModelParts ──────────────────────────────────────────────────────────

describe('mergeModelParts', () => {
  it('returns undefined for empty/undefined inputs', () => {
    expect(mergeModelParts(undefined, undefined)).toBeUndefined();
    expect(mergeModelParts({}, {})).toBeUndefined();
  });

  it('merges part specs with defaults for missing optional fields', () => {
    const prev = {
      arm: {
        id: 'arm', anchor: 'shoulder', enabled: true,
        position: [0, 0, 0] as [number, number, number],
        rotation: [0, 0, 0] as [number, number, number],
        scale: 1,
        opacity: 0.5,
      },
    };
    const next = {
      arm: {
        id: 'arm', anchor: 'shoulder', enabled: true,
        position: [1, 0, 0] as [number, number, number],
        rotation: [0, 0, 0] as [number, number, number],
        scale: 2,
      },
    };
    const result = mergeModelParts(prev, next);
    expect(result?.arm?.position).toEqual([1, 0, 0]);
    expect(result?.arm?.scale).toBe(2);
    // opacity from prev is preserved since next doesn't specify
    expect(result?.arm?.opacity).toBe(0.5);
  });

  it('resets a part when reset=true — applies default values', () => {
    const prev = {
      arm: {
        id: 'arm', anchor: 'special', enabled: false,
        position: [5, 5, 5] as [number, number, number],
        rotation: [1, 0, 0] as [number, number, number],
        scale: 3,
        opacity: 0.2,
      },
    };
    const next = {
      arm: {
        id: 'arm', anchor: 'arm', enabled: true,
        position: [0, 0, 0] as [number, number, number],
        rotation: [0, 0, 0] as [number, number, number],
        scale: 1,
        reset: true,
      },
    };
    const result = mergeModelParts(prev, next);
    // Reset means position/rotation/scale use override values, not prev
    expect(result?.arm?.scale).toBe(1);
    expect(result?.arm?.enabled).toBe(true);
    // opacity resets to undefined
    expect(result?.arm?.opacity).toBeUndefined();
    expect(result?.arm?.reset).toBeUndefined();
  });

  it('preserves subparts from previous state when not reset', () => {
    const prev = {
      arm: {
        id: 'arm', anchor: 'shoulder', enabled: true,
        position: [0, 0, 0] as [number, number, number],
        rotation: [0, 0, 0] as [number, number, number],
        scale: 1,
        subparts: { Grip: { id: 'Grip', opacity: 0.7 } },
      },
    };
    const next = {
      arm: {
        id: 'arm', anchor: 'shoulder', enabled: true,
        position: [0, 0, 0] as [number, number, number],
        rotation: [0, 0, 0] as [number, number, number],
        scale: 1,
      },
    };
    const result = mergeModelParts(prev, next);
    // Subparts from prev are preserved (mergeSubparts called with prev subparts + next undefined)
    expect(result?.arm?.subparts?.Grip?.opacity).toBe(0.7);
  });
});

// ─── getModelAuthoredFlags ────────────────────────────────────────────────────

describe('getModelAuthoredFlags', () => {
  it('returns undefined for state not produced by buildModelNodeHandler', () => {
    const plainState = makeDefaultState();
    expect(getModelAuthoredFlags(plainState)).toBeUndefined();
  });

  it('returns authored flags attached during handler execution', () => {
    const defaultState = makeDefaultState();
    const handler = buildModelNodeHandler({
      widgetId: 'bot',
      defaultState,
      components: COMPONENTS,
    });
    const { api, getState } = makeCompileApi('bot');
    const node = { props: { scale: 0.5, opacity: 0.8, children: [] } };
    handler(node as never, api, makeHelpers() as never);
    const state = getState();
    const flags = getModelAuthoredFlags(state);
    expect(flags).toBeDefined();
    expect(flags?.model?.scale).toBe(true);
    expect(flags?.model?.opacity).toBe(true);
  });

  it('setModelAuthoredFlagsForTest allows injecting flags without compilation', () => {
    const state = makeDefaultState();
    const flags: ModelAuthoredFlags = { enabled: true, model: { scale: true } };
    setModelAuthoredFlagsForTest(state, flags);
    expect(getModelAuthoredFlags(state)).toEqual(flags);
  });
});
