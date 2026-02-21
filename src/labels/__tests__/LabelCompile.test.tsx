// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderLabels } from '../render';
import { Label, Labels } from '../dsl';
import type { LabelDefinition } from '../types';
import { resolveSceneFromDsl, Scene } from '../../compiler/sceneDslCompiler';
import { registerNode, clearRegistry } from '../../compiler/registry';
import { WidgetRegistry } from '../../widget/WidgetRegistry';
import type { SceneSnapshotContext } from '../../compiler/sceneTypes';

const makeContext = (): SceneSnapshotContext => ({
  sceneIndex: 0,
  numScenes: 1,
  assetsReady: false,
});

describe('label compile + dsl', () => {
  it('DSL components register labels into scene frame', () => {
    clearRegistry();
    registerNode(Scene, (node, api, helpers) => {
      helpers.compileChildren(node, api);
      const props = node.props as { id?: string };
      if (props.id) api.setSceneMeta({ id: props.id });
    });
    registerNode(Label, (node, api) => {
      api.pushLabel(node.props as LabelDefinition);
    });
    registerNode(Labels, (node, api, helpers) => {
      helpers.compileChildren(node, api);
    });
    const registry = new WidgetRegistry();
    const tree = (
      <Scene id="scene">
        <Labels>
          <Label id="l1" text="Hello" targetPartId="head" />
        </Labels>
      </Scene>
    );
    const { frame } = resolveSceneFromDsl(tree, makeContext(), registry);
    expect(frame.labels?.[0].id).toBe('l1');
    expect(frame.labels?.[0].text).toBe('Hello');
  });

  it('Label and Labels components render null and have displayName', () => {
    expect(Label.displayName).toBe('Label');
    expect(Labels.displayName).toBe('Labels');
    expect(Label({ id: 'l1', text: 'A', targetPartId: 'head' })).toBeNull();
    expect(Labels({})).toBeNull();
  });
});

describe('label render', () => {
  it('renderLabels is a no-op stub that does not throw', () => {
    const canvas = document.createElement('canvas');
    expect(() => renderLabels([], canvas)).not.toThrow();
  });
});
