import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { createDefaultWidgetRegistry } from '../defaultWidgets';
import type { AssetManifest } from '../../elements/model/metadata';
import type { JsonPrimitive } from '../../widget/VariableStore';
import { ModelWidget } from '../../elements/model/ModelWidget';
import { ModelRouter } from '../../elements/model/dsl';
import { resolveSceneFromDsl, Scene } from '../../compiler/sceneDslCompiler';
import { clearRegistry, registerNode } from '../../compiler/registry';
import type { SceneSnapshotContext } from '../../compiler/sceneTypes';

const makeManifest = (): AssetManifest => ({
  version: 2,
  models: [
    {
      type: 'primary',
      glb: '/model.glb',
      bones: [],
      meshes: [],
      anchorTargets: {},
      identity: {
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
      },
    },
  ],
  containedModels: [],
  animations: [],
});

const makeContext = (): SceneSnapshotContext => ({
  sceneIndex: 0,
  numScenes: 1,
  assetsReady: true,
});

describe('createDefaultWidgetRegistry', () => {
  beforeEach(() => {
    clearRegistry();
    registerNode(Scene, (node, api, helpers) => {
      helpers.compileChildren(node, api);
      const props = node.props as { id?: string; meta?: Record<string, JsonPrimitive> };
      if (props.id) api.setSceneMeta({ id: props.id });
      if (props.meta) api.setSceneMeta({ meta: props.meta });
    });
  });

  it('registers default widgets when manifest is null', () => {
    const registry = createDefaultWidgetRegistry(null);
    expect(registry.getAll().length).toBeGreaterThan(0);
    expect(registry.get('__scene_meta__')).toBeDefined();
  });

  it('registers model widgets from manifest', () => {
    const manifest = makeManifest();
    const registry = createDefaultWidgetRegistry(manifest);
    const routerWidget = new ModelWidget({
      modelMeta: manifest.models[0],
      clipMeta: [],
      widgetId: '__router__',
    });
    registry.register(routerWidget);

    const tree = React.createElement(
      Scene,
      { id: 'scene' },
      React.createElement(ModelRouter, { id: 'primary', type: 'primary' }),
    );
    resolveSceneFromDsl(tree, makeContext(), registry);

    expect(registry.get('primary')).toBeDefined();
    expect(registry.get('primary')).not.toBe(routerWidget);
  });
});
