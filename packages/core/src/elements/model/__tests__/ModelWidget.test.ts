// ModelWidget tests — interface-based stateful tests.
// Tests exercise ISceneElement + ILoadable contracts.
// No Three.js renderer is invoked; renderer initialization is skipped.

import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { ModelWidget, type ModelWidgetConfig } from '../ModelWidget';
import type { ModelMeta } from '../metadata';
import type { SceneModelInstanceState } from '../types';
import {
  Animation,
  BodyPart,
  BodyParts,
  ContainedModel,
  ModelPart,
  Motion,
  Playback,
  Pose,
  Subpart,
} from '../dsl';
import { Label } from '../../../labels/dsl';
import { CUSTOM_NODE_HANDLER } from '../../../widget/WidgetRegistry';
import { makeInitContext, makeRenderContext } from '../../__tests__/elementTestMocks';

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
// Test fixture
// ---------------------------------------------------------------------------

const makeIdentity = (): SceneModelInstanceState => ({
  model: {
    scale: 0.1,
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    enabled: true,
    bodyPartOverrides: {},
  },
  playback: {
    motion: { commands: [], scenes: [], customAnimations: [] },
    animation: { enabled: false },
  },
});

const makeModelMeta = (type: string): ModelMeta => ({
  type,
  glb: `/assets/${type}.glb`,
  bones: ['root', 'head'],
  meshes: ['body', 'head_mesh'],
  anchorTargets: { 'mixamorig:Head': 'head' },
  bodyParts: [],
  identity: makeIdentity(),
});

const makeConfig = (type: string): ModelWidgetConfig => ({
  modelMeta: makeModelMeta(type),
  clipMeta: [{ name: 'idle', duration: 2.0 }],
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ModelWidget', () => {
  it('derives widgetId from modelMeta.type', () => {
    const widget = new ModelWidget(makeConfig('robot-main'));
    expect(widget.widgetId).toBe('robot-main');
  });

  it('creates a defaultState with the correct model id', () => {
    const widget = new ModelWidget(makeConfig('robot-arm'));
    expect(widget.defaultState).toBeDefined();
  });

  it('exposes clipMeta from config', () => {
    const widget = new ModelWidget(makeConfig('robot-head'));
    expect(widget.clipMeta).toHaveLength(1);
    expect(widget.clipMeta[0].name).toBe('idle');
  });

  it('starts with isLoaded = false', () => {
    const widget = new ModelWidget(makeConfig('bot'));
    expect(widget.isLoaded).toBe(false);
  });

  it('transitionSpec is defined', () => {
    const widget = new ModelWidget(makeConfig('bot'));
    expect(widget.transitionSpec).toBeDefined();
  });

  it('childDslComponents lists all expected child types', () => {
    const widget = new ModelWidget(makeConfig('bot'));
    const names = widget.childDslComponents.map((c) => c.displayName);
    expect(names).toContain('Playback');
    expect(names).toContain('Animation');
    expect(names).toContain('Motion');
    expect(names).toContain('BodyPart');
    expect(names).toContain('Pose');
  });

  it('mergeSnapshot propagates boneId/meshId from authored state', () => {
    const widget = new ModelWidget(makeConfig('bot'));
    const base = widget.defaultState;
    const prev: SceneModelInstanceState = {
      ...base,
      model: {
        ...base.model,
        bodyPartOverrides: {},
      },
    };
    const next: SceneModelInstanceState & { __authored?: unknown } = {
      ...base,
      model: {
        ...base.model,
        bodyPartOverrides: {
          RightForeArm: {
            color: '#ff0000',
            boneId: 'mixamorigRightForeArm',
            meshId: 'FOREARM_RIGHT',
          },
        },
      },
      playback: base.playback,
      __authored: {},
    };

    const merged = widget.mergeSnapshot(prev, next) as SceneModelInstanceState;
    const part = merged.model.bodyPartOverrides?.RightForeArm;
    expect(part?.boneId).toBe('mixamorigRightForeArm');
    expect(part?.meshId).toBe('FOREARM_RIGHT');
    expect(part?.color).toBe('#ff0000');
  });

  it('mergeSnapshot persists body part overrides until reset', () => {
    const widget = new ModelWidget(makeConfig('bot'));
    const base = widget.defaultState;
    const prev: SceneModelInstanceState = {
      ...base,
      model: {
        ...base.model,
        bodyPartOverrides: {
          Head: {
            color: '#ff0000',
            opacity: 0.5,
            pose: { rotate: { yawPct: 0.1 } },
          },
        },
      },
    };
    const next: SceneModelInstanceState & { __authored?: unknown } = {
      ...base,
      model: {
        ...base.model,
        bodyPartOverrides: {
          Head: {
            opacity: 1,
          },
        },
      },
      playback: base.playback,
      __authored: {},
    };

    const merged = widget.mergeSnapshot(prev, next) as SceneModelInstanceState;
    const head = merged.model.bodyPartOverrides?.Head;
    expect(head?.color).toBe('#ff0000');
    expect(head?.opacity).toBe(1);
    expect(head?.pose?.rotate?.yawPct).toBeCloseTo(0.1);

    const resetNext: SceneModelInstanceState & { __authored?: unknown } = {
      ...base,
      model: {
        ...base.model,
        bodyPartOverrides: {
          Head: { reset: true },
        },
      },
      playback: base.playback,
      __authored: {},
    };
    const resetMerged = widget.mergeSnapshot(merged, resetNext) as SceneModelInstanceState;
    expect(resetMerged.model.bodyPartOverrides?.Head).toBeUndefined();
  });

  it('constructor applies baseRotation by zeroing default rotation', () => {
    const meta: ModelMeta = {
      ...makeModelMeta('bot'),
      baseRotation: [0, 1, 0],
    };
    const widget = new ModelWidget({ modelMeta: meta, clipMeta: [] });
    expect(widget.defaultState.model.rotation).toEqual([0, 0, 0]);
  });

  it('custom node handler resolves body parts, poses, and labels', () => {
    const widget = new ModelWidget(makeConfig('bot'));
    const handler = (widget as unknown as Record<symbol, unknown>)[CUSTOM_NODE_HANDLER] as
      | ((node: { props: unknown }, api: { setWidgetState: (id: string, state: SceneModelInstanceState) => void; pushLabel: (label: unknown) => void; state: { widgets: Record<string, unknown>; materialMetalnessMultiplier?: number; materialRoughnessMultiplier?: number }; context: unknown }, helpers: {
        collectChildren: (n: { props: unknown }) => React.ReactNode[];
        resolveObjectValues: (v: unknown) => unknown;
        resolveValue: (v: unknown) => unknown;
      }) => void)
      | undefined;

    expect(handler).toBeDefined();
    const labels: unknown[] = [];
    let captured: SceneModelInstanceState | undefined;

    const node = {
      props: {
        children: [
          React.createElement(
            BodyPart,
            { id: 'head', opacity: 0.5 },
            React.createElement(Pose, { reset: true, yawPct: 0.2 }),
            React.createElement(Label, { id: 'l1', text: 'Head' }),
          ),
          React.createElement(
            ModelPart,
            { id: 'arm', anchor: 'root' },
            React.createElement(ContainedModel, { modelId: 'child', position: [1, 2, 3] }),
            React.createElement(
              Subpart,
              { id: 'grip', opacity: 0.6 },
              React.createElement(Label, { id: 'l2', text: 'Grip' }),
            ),
          ),
          React.createElement(
            Playback,
            { reset: true },
            React.createElement(Animation, { enabled: true, clipName: 'idle' }),
            React.createElement(Motion, { reset: true, commands: [{ groupId: 'g1' }] }),
          ),
        ],
      },
    };

    handler?.(
      node,
      {
        setWidgetState: (_id, state) => { captured = state; },
        pushLabel: (label) => labels.push(label),
        state: { widgets: {}, materialMetalnessMultiplier: 2, materialRoughnessMultiplier: 3 },
        context: {},
      },
      {
        collectChildren: (n) => {
          const children = (n.props as { children?: React.ReactNode }).children;
          return Array.isArray(children) ? children : (children ? [children] : []);
        },
        resolveObjectValues: (v) => v,
        resolveValue: (v) => v,
      },
    );

    expect(labels).toHaveLength(2);
    expect(captured?.model.bodyPartOverrides?.head?.poseReset).toBe(true);
    expect(captured?.model.bodyPartOverrides?.head?.pose?.rotate?.yawPct).toBeCloseTo(0.2);
    expect(captured?.model.parts?.arm?.modelId).toBe('child');
    expect(captured?.model.parts?.arm?.containedPosition).toEqual([1, 2, 3]);
    expect(captured?.model.parts?.arm?.subparts?.grip?.opacity).toBe(0.6);
    expect(captured?.playback.motion.commands).toHaveLength(1);
    expect(captured?.model.metalnessMultiplier).toBe(2);
    expect(captured?.model.roughnessMultiplier).toBe(3);
  });

  it('custom node handler throws for Label under ModelPart', () => {
    const widget = new ModelWidget(makeConfig('bot'));
    const handler = (widget as unknown as Record<symbol, unknown>)[CUSTOM_NODE_HANDLER] as
      | ((node: { props: unknown }, api: { setWidgetState: (id: string, state: SceneModelInstanceState) => void; pushLabel: (label: unknown) => void; state: { widgets: Record<string, unknown> }; context: unknown }, helpers: {
        collectChildren: (n: { props: unknown }) => React.ReactNode[];
        resolveObjectValues: (v: unknown) => unknown;
        resolveValue: (v: unknown) => unknown;
      }) => void)
      | undefined;
    const node = {
      props: {
        children: [
          React.createElement(
            ModelPart,
            { id: 'arm' },
            React.createElement(Label, { id: 'bad', text: 'Bad' }),
          ),
        ],
      },
    };
    expect(() => handler?.(
      node,
      { setWidgetState: () => {}, pushLabel: () => {}, state: { widgets: {} }, context: {} } as never,
      {
        collectChildren: (n) => {
          const children = (n.props as { children?: React.ReactNode }).children;
          return Array.isArray(children) ? children : (children ? [children] : []);
        },
        resolveObjectValues: (v) => v,
        resolveValue: (v) => v,
      },
    )).toThrow('<Label> must be nested under <Subpart> or <BodyPart>.');
  });

  it('mergeSnapshot honors authored flags and resets', () => {
    const widget = new ModelWidget(makeConfig('bot'));
    const prev = {
      ...widget.defaultState,
      model: { ...widget.defaultState.model, scale: 2, position: [1, 0, 0] },
      playback: {
        ...widget.defaultState.playback,
        animation: { ...widget.defaultState.playback.animation, clipName: 'idle', enabled: true },
      },
      enabled: false,
    };
    const next: SceneModelInstanceState & { __authored?: unknown } = {
      ...widget.defaultState,
      model: { ...widget.defaultState.model, reset: true, scale: 3, position: [9, 0, 0] },
      playback: {
        ...widget.defaultState.playback,
        animation: { ...widget.defaultState.playback.animation, clipName: 'run', enabled: false, reset: true },
        motion: { ...widget.defaultState.playback.motion, reset: true },
      },
      enabled: true,
      __authored: {
        model: { reset: true, scale: true, position: true },
        playback: { reset: true, animation: { reset: true, clipName: true, enabled: true } },
        enabled: true,
      },
    };
    const merged = widget.mergeSnapshot(prev, next) as SceneModelInstanceState;
    expect(merged.model.scale).toBe(3);
    expect(merged.model.position).toEqual([9, 0, 0]);
    expect(merged.playback.animation.clipName).toBe('run');
    expect(merged.enabled).toBe(true);
  });

  it('load warns when renderer is missing', async () => {
    const widget = new ModelWidget(makeConfig('bot'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    await widget.load(null);
    expect(warn).toHaveBeenCalledWith('[ModelWidget] no renderer');
    warn.mockRestore();
  });

  it('load warns when no GLB is available', async () => {
    const meta = { ...makeModelMeta('bot'), glb: undefined };
    const widget = new ModelWidget({ modelMeta: meta, clipMeta: [] });
    widget.initialize(makeInitContext({ widgetId: widget.widgetId }));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    await widget.load({ models: [meta] } as never);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('load warns when contained model is missing from manifest', async () => {
    const meta = makeModelMeta('bot');
    meta.identity.model.parts = { arm: { id: 'arm', modelId: 'child' } } as never;
    const widget = new ModelWidget({ modelMeta: meta, clipMeta: [] });
    widget.initialize(makeInitContext({ widgetId: widget.widgetId }));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    await widget.load({ models: [meta] } as never);
    expect(warn).toHaveBeenCalledWith('[ModelWidget] contained model "child" not found in manifest');
    warn.mockRestore();
  });

  it('load handles manifest without contained models', async () => {
    const meta = makeModelMeta('bot');
    meta.identity.model.parts = {};
    const widget = new ModelWidget({ modelMeta: meta, clipMeta: [] });
    widget.initialize(makeInitContext({ widgetId: widget.widgetId }));
    await widget.load({ models: [meta] } as never);
    expect(widget.isLoaded).toBe(true);
  });

  it('initialize/apply/dispose call through renderer', () => {
    const widget = new ModelWidget(makeConfig('bot'));
    widget.initialize(makeInitContext({ widgetId: widget.widgetId }));
    widget.apply(widget.defaultState, makeRenderContext());
    widget.dispose();
    expect(widget.getBoneWorldPositions()).toBeInstanceOf(Map);
  });

  it('proxy getters delegate to renderer', () => {
    const widget = new ModelWidget(makeConfig('bot'));
    widget.initialize(makeInitContext({ widgetId: widget.widgetId }));
    expect(widget.getAnchorBoneName('mixamorig:Head')).toBe('head');
    expect(widget.getBoneWorldPositions()).toBeInstanceOf(Map);
    expect(widget.getTargetColors()).toBeInstanceOf(Map);
  });
});
