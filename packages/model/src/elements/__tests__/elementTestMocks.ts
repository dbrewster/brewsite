import * as THREE from 'three';
import type { SceneTrackTick } from '@brewsite/core';
import type { WidgetInitContext, WidgetRenderContext } from '@brewsite/core';
import { VariableStore, createNVSCoordService } from '@brewsite/core';

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

/** Default camera used by makeRenderContext. Positioned for worldScale=10 (cameraZ≈12.07, fov=45). */
const _defaultTestCamera = new THREE.PerspectiveCamera(45, 16 / 9, 0.01, 100);
_defaultTestCamera.position.set(0, 0, 12.07);

export const makeRenderContext = (
  overrides: Partial<WidgetRenderContext> = {},
): WidgetRenderContext => ({
  clock: { wallTimeSeconds: 0, deltaSeconds: 0.016 },
  effectiveDeltaSeconds: 0.016,
  globalProgress: 0,
  variables: new VariableStore(),
  extra: undefined,
  tick: null,
  coords: createNVSCoordService(_defaultTestCamera, 1920, 1080),
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
