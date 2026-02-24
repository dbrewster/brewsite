// CameraWidget — ISceneElement + IAnimationController (scene-driven camera control).

import type { SceneCamera } from './types';
import type * as THREE from 'three';
import { DEFAULT_CAMERA, cameraTransitionSpec } from './compile';
import { Camera } from './dsl';
import { applyCamera } from './render';
import type { AnimationTickContext, IAnimationController, ISceneElement } from '../../widget/types';

const CAMERA_KEY = '__brewsite_camera';

export class CameraWidget implements ISceneElement<SceneCamera>, IAnimationController {
  readonly widgetId = 'camera';
  readonly defaultState: SceneCamera = DEFAULT_CAMERA;
  readonly transitionSpec = cameraTransitionSpec;
  readonly DslComponent = Camera;
  readonly useDefaultStateWhenAbsent = false;

  mergeSnapshot(
    prev: SceneCamera | undefined,
    next: SceneCamera | undefined,
  ): SceneCamera | undefined {
    if (!prev && !next) return undefined;
    if (!next) return prev;
    return { ...prev, ...next } as SceneCamera;
  }

  onTick(context: AnimationTickContext): void {
    const tick = context.tick;
    if (!tick) return;

    const camera = context.scene.userData[CAMERA_KEY] as THREE.PerspectiveCamera | undefined;
    if (!camera) return;

    const state = (tick.state.widgets[this.widgetId] as SceneCamera | undefined) ?? this.defaultState;
    applyCamera(state, { camera, tick });
  }
}
