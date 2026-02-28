import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { Scene, resolveSceneFromDsl } from '../sceneDslCompiler';
import {
  InputController,
  Action,
  PointerMap,
  PinchMap,
  KeyMap,
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

  it('compiles PointerMap event=\"click\" to click event', () => {
    const registry = new WidgetRegistry();
    const tree = (
      <Scene id="s1">
        <InputController id="main" scope="canvas">
          <Action id="focus-canvas" type="diagram-canvas.focus" canvasId="llm-canvas">
            <PointerMap event="click" button="left" />
          </Action>
        </InputController>
      </Scene>
    );

    const { frame } = resolveSceneFromDsl(tree, context, registry);
    const spec = frame.widgets['__input_controller'] as SceneInputControllerSpec;
    expect(spec.actions[0]?.maps[0]).toMatchObject({
      kind: 'pointer',
      event: 'click',
      button: 'left',
    });
  });

  it('warns when PointerMap click boolean prop is used', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const registry = new WidgetRegistry();
    const tree = (
      <Scene id="s1">
        <InputController id="main" scope="canvas">
          <Action id="focus-canvas" type="diagram-canvas.focus" canvasId="llm-canvas">
            <PointerMap click />
          </Action>
        </InputController>
      </Scene>
    );
    const { frame } = resolveSceneFromDsl(tree, context, registry);
    const spec = frame.widgets['__input_controller'] as SceneInputControllerSpec;
    expect(spec.actions[0]?.maps[0]).toMatchObject({ kind: 'pointer', event: 'click' });
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('deprecated'));
    warnSpy.mockRestore();
  });

  it('compiles an Action with a PinchMap child', () => {
    const registry = new WidgetRegistry();
    const tree = (
      <Scene id="s1">
        <InputController id="main" scope="canvas">
          <Action id="pinch-dolly" type="camera.dolly" cameraId="camera">
            <PinchMap direction="out" threshold={2} />
          </Action>
        </InputController>
      </Scene>
    );

    const { frame } = resolveSceneFromDsl(tree, context, registry);
    const spec = frame.widgets['__input_controller'] as SceneInputControllerSpec;
    expect(spec.actions).toHaveLength(1);
    expect(spec.actions[0]?.maps[0]).toMatchObject({
      kind: 'pinch',
      direction: 'out',
      threshold: 2,
    });
  });

  it('compiles KeyMap keyName and warns for React key fallback', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const registry = new WidgetRegistry();
    const keyNameTree = (
      <Scene id="s1">
        <InputController id="main" scope="canvas">
          <Action id="step-next" type="scene.step">
            <KeyMap keyName="ArrowRight" />
          </Action>
        </InputController>
      </Scene>
    );
    const keyFallbackTree = (
      <Scene id="s1">
        <InputController id="main" scope="canvas">
          <Action id="step-next" type="scene.step">
            {/* React key prop fallback path */}
            <KeyMap key="ArrowRight" />
          </Action>
        </InputController>
      </Scene>
    );

    const keyNameSpec = resolveSceneFromDsl(keyNameTree, context, registry).frame.widgets['__input_controller'] as SceneInputControllerSpec;
    expect(keyNameSpec.actions[0]?.maps[0]).toMatchObject({ kind: 'key', key: 'ArrowRight' });

    const fallbackSpec = resolveSceneFromDsl(keyFallbackTree, context, registry).frame.widgets['__input_controller'] as SceneInputControllerSpec;
    expect(fallbackSpec.actions[0]?.maps[0]).toMatchObject({ kind: 'key', key: 'ArrowRight' });
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('reserved \"key\" prop'));
    warnSpy.mockRestore();
  });
});
