import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import * as THREE from 'three';
import { LightingWidget } from '../LightingWidget';
import {
  Lighting,
  Ambient,
  Directional,
  Point,
  Spot,
  LightStrand,
  Wave,
  Panel,
} from '../dsl';
import { resolveSceneFromDsl, Scene } from '../../../compiler/sceneDslCompiler';
import { registerNode, clearRegistry } from '../../../compiler/registry';
import { WidgetRegistry } from '../../../widget/WidgetRegistry';
import type { SceneSnapshotContext } from '../../../compiler/sceneTypes';
import type { SceneLighting } from '../types';

const makeContext = (): SceneSnapshotContext => ({
  sceneIndex: 0,
  numScenes: 1,
  assetsReady: false,
});

describe('LightingWidget DSL handler', () => {
  beforeEach(() => {
    clearRegistry();
    registerNode(Scene, (node, api, helpers) => {
      helpers.compileChildren(node, api);
      const props = node.props as { id?: string };
      if (props.id) api.setSceneMeta({ id: props.id });
    });
  });

  it('compiles lighting state from children', () => {
    const widget = new LightingWidget();
    const registry = new WidgetRegistry().register(widget);

    const tree = (
      <Scene id="scene">
        <Lighting intensityScale={0.8} color="#ff00ff">
          <Ambient intensity={() => 1.5} color="#ffffff" />
          <Directional intensity={2} color="#00ff00" position={[1, 2, 3]} />
          <LightStrand
            id="strand-main"
            count={4}
            intensity={0.5}
            color="#ffaa44"
            position={[5, 6, 7]}
          >
            <Wave
              length={12}
              yOffset={0}
              z={2}
              waveAmplitude={1}
              waveFrequency={1}
              depthAmplitude={0.5}
              depthFrequency={2}
              depthPhase={0}
            />
          </LightStrand>
          <Point id="pt-main" intensity={0.5} color="#ff0000" position={[0, 1, 0]} />
          <Spot id="spot-main" intensity={1} color="#00ff00" position={[0, 2, 0]} target={[0, 0, 0]} angle={0.5} penumbra={0.2} />
          <Panel id="panel" origin={[0, 0, 0]} rows={1} cols={1} spacing={[1, 1, 1]} intensity={1} />
        </Lighting>
      </Scene>
    );

    const { frame } = resolveSceneFromDsl(tree, makeContext(), registry);
    const state = frame.widgets['lighting'] as SceneLighting;

    expect(state.ambient.intensity).toBeCloseTo(1.5);
    expect(state.directional.position).toEqual([1, 2, 3]);
    expect(state.lightStrands).toHaveLength(1);
    expect(state.lightStrands?.[0]?.id).toBe('strand-main');
    expect(state.lightStrands?.[0]?.position).toEqual([5, 6, 7]);
    expect(state.lightStrands?.[0]?.shape.kind).toBe('wave');
    expect(state.points).toHaveLength(1);
    expect(state.spots).toHaveLength(1);
    expect(state.points?.[0]?.id).toBe('pt-main');
    expect(state.spots?.[0]?.id).toBe('spot-main');
    expect(state.panels).toHaveLength(1);
    expect(state.intensityScale).toBeCloseTo(0.8);
    expect(state.color).toBe('#ff00ff');
  });

  it('prefers first ambient/directional', () => {
    const widget = new LightingWidget();
    const registry = new WidgetRegistry().register(widget);
    const tree = (
      <Scene id="scene">
        <Lighting>
          <Ambient intensity={0.2} color="#000000" />
          <Ambient intensity={0.9} color="#ffffff" />
          <Directional intensity={0.1} color="#ff0000" position={[1, 1, 1]} />
          <Directional intensity={0.9} color="#00ff00" position={[2, 2, 2]} />
        </Lighting>
      </Scene>
    );
    const { frame } = resolveSceneFromDsl(tree, makeContext(), registry);
    const state = frame.widgets['lighting'] as SceneLighting;
    expect(state.ambient.intensity).toBeCloseTo(0.2);
    expect(state.directional.position).toEqual([1, 1, 1]);
  });

  it('warns when multiple Ambient elements are declared', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const widget = new LightingWidget();
    const registry = new WidgetRegistry().register(widget);
    const tree = (
      <Scene id="scene">
        <Lighting>
          <Ambient intensity={0.2} color="#000000" />
          <Ambient intensity={0.9} color="#ffffff" />
        </Lighting>
      </Scene>
    );
    resolveSceneFromDsl(tree, makeContext(), registry);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('<Ambient>'));
    warnSpy.mockRestore();
  });

  it('warns when LightStrand has no shape child', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const widget = new LightingWidget();
    const registry = new WidgetRegistry().register(widget);
    const tree = (
      <Scene id="scene">
        <Lighting>
          <LightStrand id="strand" count={8} intensity={1} color="#fff" />
        </Lighting>
      </Scene>
    );
    resolveSceneFromDsl(tree, makeContext(), registry);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('No shape specified'));
    warnSpy.mockRestore();
  });
});

describe('LightingWidget lifecycle', () => {
  it('apply adds lights after initialize and clears on dispose', () => {
    const widget = new LightingWidget();
    const scene = new THREE.Scene();
    widget.initialize({ scene, widgetId: widget.widgetId });
    const state: SceneLighting = {
      ...widget.defaultState,
      ambient: { intensity: 1, color: '#ffffff' },
      directional: { intensity: 1, color: '#ffffff', position: [1, 2, 3] },
      points: [],
      spots: [],
      panels: [],
    };
    widget.apply(state, { deltaSeconds: 0, globalProgress: 0, wallTimeSeconds: 0, variables: {} as never, extra: undefined });
    expect(scene.children.length).toBeGreaterThan(0);
    widget.dispose();
    expect(() => widget.apply(state, { deltaSeconds: 0, globalProgress: 0, wallTimeSeconds: 0, variables: {} as never, extra: undefined })).not.toThrow();
  });
});
