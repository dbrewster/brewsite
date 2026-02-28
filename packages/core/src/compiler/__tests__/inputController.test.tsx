import { describe, it, expect } from 'vitest';
import React from 'react';
import { Scene, resolveSceneFromDsl } from '../sceneDslCompiler';
import {
  InputController,
  Action,
  PointerMap,
} from '../blocks/inputController';
import { WidgetRegistry } from '../../widget/WidgetRegistry';
import type { SceneInputControllerSpec } from '../../input/types';

const context = {
  sceneIndex: 0,
  numScenes: 1,
  assetsReady: true,
};

describe('inputController compiler', () => {
  it('compiles an Action with a single PointerMap child', () => {
    const registry = new WidgetRegistry();
    const tree = (
      <Scene id="s1">
        <InputController id="main" scope="canvas">
          <Action id="focus-canvas" type="diagram-canvas.focus" canvasId="llm-canvas">
            <PointerMap click button="left" modifiers={['meta']} />
          </Action>
        </InputController>
      </Scene>
    );

    const { frame } = resolveSceneFromDsl(tree, context, registry);
    const spec = frame.widgets['__input_controller'] as SceneInputControllerSpec;
    expect(spec.actions).toHaveLength(1);
    expect(spec.actions[0]?.id).toBe('focus-canvas');
    expect(spec.actions[0]?.maps).toHaveLength(1);
    expect(spec.actions[0]?.maps[0]).toMatchObject({
      kind: 'pointer',
      event: 'click',
      button: 'left',
    });
  });
});
