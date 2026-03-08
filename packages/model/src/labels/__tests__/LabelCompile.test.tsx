// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderLabels } from '../render';
import { Label, Labels } from '../dsl';
import { resolveSceneFromDsl, Scene } from '@brewsite/core';
import { registerNode } from '@brewsite/core';
import { clearRegistry } from '@brewsite/core/testing';
import { WidgetRegistry } from '@brewsite/core/widget/WidgetRegistry';
import type { SceneSnapshotContext } from '@brewsite/core';

const makeContext = (): SceneSnapshotContext => ({
  sceneIndex: 0,
  numScenes: 1,
  assetsReady: false,
});

describe('label compile + dsl', () => {
  it('Label and Labels are not allowed at top level', () => {
    clearRegistry();
    registerNode(Scene, (node, api, helpers) => {
      helpers.compileChildren(node, api);
      const props = node.props as { id?: string };
      if (props.id) api.setSceneMeta({ id: props.id });
    });
    registerNode(Label, () => {
      throw new Error('Label not allowed');
    });
    registerNode(Labels, () => {
      throw new Error('Labels not allowed');
    });
    const registry = new WidgetRegistry();
    const tree = (
      <Scene id="scene">
        <Labels>
          <Label id="l1" text="Hello" />
        </Labels>
      </Scene>
    );
    expect(() => resolveSceneFromDsl(tree, makeContext(), registry)).toThrow();
  });

  it('Label and Labels components render null and have displayName', () => {
    expect(Label.displayName).toBe('Label');
    expect(Labels.displayName).toBe('Labels');
    expect(Label({ id: 'l1', text: 'A' })).toBeNull();
    expect(Labels({})).toBeNull();
  });
});

describe('label render', () => {
  it('renderLabels is a no-op stub that does not throw', () => {
    const canvas = document.createElement('canvas');
    expect(() => renderLabels([], canvas)).not.toThrow();
  });
});
