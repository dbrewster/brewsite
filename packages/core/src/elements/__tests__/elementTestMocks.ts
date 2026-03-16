import * as THREE from 'three';
import type { SceneTrackTick } from '../../compiler/sceneTrackTypes';
import type { WidgetInitContext, WidgetRenderContext } from '../../widget/types';
import { VariableStore } from '../../widget/VariableStore';
import { createNVSCoordService } from '../../layout/nvsCoordService';
import type { NVSCameraParams } from '../../layout/nvsCoordService';

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

/** Default NVS camera params used by makeRenderContext. Matches worldScale=10 (distance≈12.07, fov=45). */
const _defaultTestCamera: NVSCameraParams = { distance: 12.07, fovDeg: 45 };

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
