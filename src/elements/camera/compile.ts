/**
 * Camera element compilation.
 */

import type { SceneCamera } from './types';
import type { ElementTransitionSpec } from '../../compiler/transitions/transitionTypes';
import { transitionT } from '../../compiler/transitions/transitionTypes';

export const DEFAULT_CAMERA: SceneCamera = {
  enabled: false,
  mode: 'fitBotHeight',
  fov: undefined,
  targetId: undefined,
  targetHeight: undefined,
  framingHeightPct: 0.4,
  heightOffset: 0,
  distanceOffset: 0,
  floorY: undefined,
  floorZMin: undefined,
  floorZMax: undefined,
  lookAtZ: undefined,
  cameraX: 0,
  cameraY: undefined,
};

export const cameraTransitionSpec: ElementTransitionSpec<SceneCamera> = {
  exit: (frames, widgetId, fromState) => {
    for (let i = 0; i < frames.length; i++) {
      const t = transitionT(i, frames.length);
      frames[i]!.state.widgets[widgetId] = {
        ...fromState,
        enabled: fromState.enabled && t < 1,
      };
    }
  },
  enter: (frames, widgetId, toState) => {
    for (let i = 0; i < frames.length; i++) {
      const t = transitionT(i, frames.length);
      frames[i]!.state.widgets[widgetId] = {
        ...toState,
        enabled: toState.enabled && t > 0,
      };
    }
  },
  interpolate: (frames, widgetId, fromState, toState) => {
    for (let i = 0; i < frames.length; i++) {
      const t = transitionT(i, frames.length);
      frames[i]!.state.widgets[widgetId] = {
        ...(t < 0.5 ? fromState : toState),
        enabled: (fromState.enabled && t < 1) || (toState.enabled && t > 0),
      };
    }
  },
};
