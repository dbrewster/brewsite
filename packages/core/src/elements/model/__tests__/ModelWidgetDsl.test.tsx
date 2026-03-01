import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { ModelWidget } from '../ModelWidget';
import {
  ModelRouter,
  BodyParts,
  BodyPart,
  Pose,
  ModelPart,
  ContainedModel,
  Subpart,
  Playback,
  Motion,
  Animation,
} from '../dsl';
import { resolveSceneFromDsl, Scene } from '../../../compiler/sceneDslCompiler';
import { registerNode, clearRegistry } from '../../../compiler/registry';
import { WidgetRegistry } from '../../../widget/WidgetRegistry';
import type { SceneSnapshotContext } from '../../../compiler/sceneTypes';
import type { SceneModelInstanceState } from '../types';

const makeContext = (): SceneSnapshotContext => ({
  sceneIndex: 0,
  numScenes: 1,
  assetsReady: false,
});
const identity: SceneModelInstanceState = {
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
};

describe('ModelWidget DSL handler', () => {
  beforeEach(() => {
    clearRegistry();
    registerNode(Scene, (node, api, helpers) => {
      helpers.compileChildren(node, api);
      const props = node.props as { id?: string };
      if (props.id) api.setSceneMeta({ id: props.id });
    });
  });

  it('compiles model, body parts, parts, and playback from DSL', () => {
    const widget = new ModelWidget({
      widgetId: 'bot-instance',
      modelMeta: {
        type: 'bot',
        glb: '/bot.glb',
        bones: [],
        meshes: [],
        anchorTargets: { head: 'Head' },
        identity,
      },
      clipMeta: [{ name: 'idle', duration: 2 }],
    });
    const registry = new WidgetRegistry().register(widget);

    const tree = (
      <Scene id="scene">
        <ModelRouter
          id="bot-instance"
          type="bot"
          scale={() => 0.5}
          position={[1, 2, 3]}
          rotation={[0, 0, 1]}
          metalness={() => 0.1}
          roughness={0.9}
          enabled={() => false}
        >
          <BodyParts>
            <BodyPart id="Head" opacity={() => 0.4}>
              <Pose rotate={{ yawPct: 0.1 }} translate={{ xPct: 0.2 }} />
            </BodyPart>
          </BodyParts>
          <BodyPart id="Arm" color="#ff0000" />
          <ModelPart id="hat" anchor="head" position={[0, 1, 0]} rotation={[0, 0, 0]} scale={1}>
            <ContainedModel modelId="hatModel" position={[1, 0, 0]} rotation={[0, 0, 0]} scale={1.2} />
            <Subpart id="Brim" opacity={0.5} color="#00ff00" />
          </ModelPart>
          <Playback>
            <Animation enabled clipName="idle" weight={0.8} />
            <Motion
              commands={[{ groupId: 'g1', rotate: { yawPct: 0.5 } }]}
              scenes={[{ id: 'm1', start: 0, end: 1, commands: [] }]}
              customAnimations={[{ id: 'c1', enabled: true, apply: () => [] }]}
            />
          </Playback>
        </ModelRouter>
      </Scene>
    );

    const { frame } = resolveSceneFromDsl(tree, makeContext(), registry);
    const state = frame.widgets['bot-instance'] as SceneModelInstanceState;

    expect(state.model.scale).toBeCloseTo(0.5);
    expect(state.model.position).toEqual([1, 2, 3]);
    expect(state.model.rotation).toEqual([0, 0, 1]);
    expect(state.model.metalness).toBeCloseTo(0.1);
    expect(state.model.roughness).toBeCloseTo(0.9);
    expect(state.enabled).toBe(false);

    expect(state.model.bodyPartOverrides?.Head?.opacity).toBeCloseTo(0.4);
    expect(state.model.bodyPartOverrides?.Head?.pose?.rotate?.yawPct).toBeCloseTo(0.1);
    expect(state.model.bodyPartOverrides?.Arm?.color).toBe('#ff0000');

    const hat = state.model.parts?.hat;
    expect(hat?.modelId).toBe('hatModel');
    expect(hat?.subparts?.Brim?.opacity).toBeCloseTo(0.5);
    expect(hat?.subparts?.Brim?.color).toBe('#00ff00');

    expect(state.playback.animation.clipName).toBe('idle');
    expect(state.playback.animation.weight).toBeCloseTo(0.8);
    expect(state.playback.motion.commands).toHaveLength(1);
    expect(state.playback.motion.scenes).toHaveLength(1);
    expect(state.playback.motion.customAnimations?.[0].id).toBe('c1');
  });

  // Base-state merging is not part of the snapshot compiler model.

  it('flat PoseProps (yawPct direct) compile to correct AxisRotation', () => {
    const widget = new ModelWidget({
      widgetId: 'bot-pose',
      modelMeta: {
        type: 'bot',
        glb: '/bot.glb',
        bones: ['mixamorig:RightForeArm'],
        meshes: ['FOREARM_RIGHT'],
        anchorTargets: {},
        identity,
      },
      clipMeta: [],
    });
    const registry = new WidgetRegistry().register(widget);

    const tree = (
      <Scene id="scene-flat-pose">
        <ModelRouter id="bot-pose" type="bot">
          <BodyPart
            id="RightForeArm"
            boneId="mixamorigRightForeArm"
            meshId="FOREARM_RIGHT"
            color="#ff0000"
          >
            <Pose yawPct={0.3} pitchPct={0.1} />
          </BodyPart>
        </ModelRouter>
      </Scene>
    );

    const { frame } = resolveSceneFromDsl(tree, makeContext(), registry);
    const state = frame.widgets['bot-pose'] as SceneModelInstanceState;
    const part = state.model.bodyPartOverrides?.RightForeArm;

    // Flat props compiled to rotate
    expect(part?.pose?.rotate?.yawPct).toBeCloseTo(0.3);
    expect(part?.pose?.rotate?.pitchPct).toBeCloseTo(0.1);
    // meshId and boneId should be on the override
    expect(part?.boneId).toBe('mixamorigRightForeArm');
    expect(part?.meshId).toBe('FOREARM_RIGHT');
    expect(part?.color).toBe('#ff0000');
  });

  it('linked component (boneId+meshId) populates both fields in the override', () => {
    const widget = new ModelWidget({
      widgetId: 'bot-linked',
      modelMeta: {
        type: 'bot',
        glb: '/bot.glb',
        bones: ['mixamorig:LeftHand'],
        meshes: ['HAND_LEFT'],
        anchorTargets: {},
        identity,
      },
      clipMeta: [],
    });
    const registry = new WidgetRegistry().register(widget);

    const tree = (
      <Scene id="scene-linked">
        <ModelRouter id="bot-linked" type="bot">
          <BodyPart
            id="LeftHand"
            boneId="mixamorigLeftHand"
            meshId="HAND_LEFT"
            opacity={0.5}
          >
            <Pose rollPct={0.2} zPct={0.1} />
          </BodyPart>
        </ModelRouter>
      </Scene>
    );

    const { frame } = resolveSceneFromDsl(tree, makeContext(), registry);
    const state = frame.widgets['bot-linked'] as SceneModelInstanceState;
    const part = state.model.bodyPartOverrides?.LeftHand;

    expect(part?.boneId).toBe('mixamorigLeftHand');
    expect(part?.meshId).toBe('HAND_LEFT');
    expect(part?.opacity).toBeCloseTo(0.5);
    expect(part?.pose?.rotate?.rollPct).toBeCloseTo(0.2);
    expect(part?.pose?.translate?.zPct).toBeCloseTo(0.1);
  });
});

describe('ModelWidget runtime helpers', () => {
  const makeWidget = () =>
    new ModelWidget({
      modelMeta: { type: 'bot', glb: '/bot.glb', bones: [], meshes: [], anchorTargets: {}, identity },
      clipMeta: [{ name: 'idle', duration: 2 }],
    });

  it('compileExtra delegates to compileAnimation', () => {
    const widget = makeWidget();
    const state: SceneModelInstanceState = {
      model: { scale: 1, position: [0, 0, 0], rotation: [0, 0, 0], enabled: true },
      playback: { motion: { commands: [], scenes: [] }, animation: { enabled: true, clipName: 'idle' } },
    };
    const extra = widget.compileExtra(state, { prefersReducedMotion: false, sceneProgress: 0, globalProgress: 0, clipMeta: [] });
    expect(extra.enabled).toBe(true);
    const reduced = widget.compileExtra(state, { prefersReducedMotion: true, sceneProgress: 0, globalProgress: 0, clipMeta: [] });
    expect(reduced.enabled).toBe(false);
  });

  it('load warns when renderer is missing', async () => {
    const widget = makeWidget();
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await widget.load(null);
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('no renderer'));
    spy.mockRestore();
  });

  it('load warns when GLB is missing', async () => {
    const widget = new ModelWidget({
      modelMeta: {
        type: 'bot',
        glb: undefined as unknown as string,
        bones: [],
        meshes: [],
        anchorTargets: {},
        identity,
      },
      clipMeta: [],
    });
    const renderer = { loadGlb: vi.fn() };
    (widget as unknown as { renderer: typeof renderer }).renderer = renderer;
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await widget.load(null);
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('no GLB URL'));
    expect(renderer.loadGlb).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('load uses manifest model and updates anchor targets', async () => {
    const widget = makeWidget();
    const renderer = {
      loadGlb: vi.fn(async () => {}),
      findNodeByName: vi.fn(),
      getBoneWorldPositions: vi.fn(() => new Map([['Head', [1, 2, 3]] as const])),
      apply: vi.fn(),
      dispose: vi.fn(),
    };
    (widget as unknown as { renderer: typeof renderer }).renderer = renderer;

    await widget.load({
      version: 2,
      models: [{
        type: 'bot',
        glb: '/manifest.glb',
        bones: [],
        meshes: [],
        anchorTargets: { head: 'Head' },
        identity,
      }],
      animations: [],
    });

    expect(renderer.loadGlb).toHaveBeenCalledWith(
      '/manifest.glb',
      expect.objectContaining({
        anchorTargets: { head: 'Head' },
        manifest: expect.any(Object),
        containedModels: [],
        footOffsetY: 0,
      }),
    );
    expect(widget.isLoaded).toBe(true);
    expect(widget.getAnchorBoneName('head')).toBe('Head');
  });

  it('apply forwards to renderer with animation extra', () => {
    const widget = makeWidget();
    const renderer = { apply: vi.fn() };
    (widget as unknown as { renderer: typeof renderer }).renderer = renderer;
    const state: SceneModelInstanceState = {
      model: { scale: 1, position: [0, 0, 0], rotation: [0, 0, 0], enabled: true },
      playback: { motion: { commands: [], scenes: [] }, animation: { enabled: false } },
    };
    widget.apply(state, { clock: { wallTimeSeconds: 0, deltaSeconds: 0 }, effectiveDeltaSeconds: 0, globalProgress: 0, variables: {} as never, extra: { enabled: false } });
    expect(renderer.apply).toHaveBeenCalledWith(state, { enabled: false }, expect.any(Object));
  });

  it('findBoneNode and getBoneWorldPositions proxy to renderer', () => {
    const widget = makeWidget();
    const node = {} as unknown as { name: string };
    const positions = new Map([['Head', [1, 2, 3] as [number, number, number]]]);
    const renderer = {
      findNodeByName: vi.fn(() => node),
      getBoneWorldPositions: vi.fn(() => positions),
    };
    (widget as unknown as { renderer: typeof renderer }).renderer = renderer;
    expect(widget.findBoneNode('Head')).toBe(node);
    expect(widget.getBoneWorldPositions()).toBe(positions);
  });
});
