import * as THREE from 'three';
import type { SceneTrackTick } from '../../compiler/sceneTrackTypes';
import type { WidgetInitContext, WidgetRenderContext } from '../../widget/types';
import { VariableStore } from '../../widget/VariableStore';

export const makeFrameSlice = (count: number, sceneId = 'scene'): SceneTrackTick[] =>
  Array.from({ length: count }, (_value, index) => ({
    index,
    progress: count > 1 ? index / (count - 1) : 0,
    sceneId,
    sceneIndex: 0,
    blockProgress: count > 1 ? index / (count - 1) : 0,
    state: { id: sceneId, scrollProgress: 0, widgets: {} },
    deltaForward: {},
    deltaBackward: {},
  }));

export const makeRenderContext = (
  overrides: Partial<WidgetRenderContext> = {},
): WidgetRenderContext => ({
  deltaSeconds: 0,
  globalProgress: 0,
  wallTimeSeconds: 0,
  variables: new VariableStore(),
  extra: undefined,
  tick: null,
  ...overrides,
});

export const makeInitContext = (
  overrides: Partial<WidgetInitContext> = {},
): WidgetInitContext => ({
  scene: new THREE.Scene(),
  widgetId: 'test-widget',
  ...overrides,
});

export const makeFakeDomElement = (): HTMLElement => {
  return { style: {} } as unknown as HTMLElement;
};
