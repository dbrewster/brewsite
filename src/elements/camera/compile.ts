/**
 * Camera element compilation.
 */

import type { SceneCamera } from './types';
import type {
  ElementTransitionSpec,
  FunctionalTransitionSpec,
} from '../../compiler/transitions/transitionTypes';
import { blendNumber, transitionT } from '../../compiler/transitions/transitionTypes';

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

const applyCameraExit = (from: SceneCamera, t: number): SceneCamera => ({
  ...from,
  enabled: from.enabled && t < 1,
});

const applyCameraEnter = (to: SceneCamera, t: number): SceneCamera => ({
  ...to,
  enabled: to.enabled && t > 0,
});

const applyCameraInterpolate = (from: SceneCamera, to: SceneCamera, t: number): SceneCamera => ({
  ...(t < 0.5 ? from : to),
  fov: blendNumber(from.fov, to.fov, t) ?? (t < 0.5 ? from.fov : to.fov),
  targetHeight: blendNumber(from.targetHeight, to.targetHeight, t) ?? (t < 0.5 ? from.targetHeight : to.targetHeight),
  framingHeightPct: blendNumber(from.framingHeightPct, to.framingHeightPct, t)
    ?? (t < 0.5 ? from.framingHeightPct : to.framingHeightPct),
  heightOffset: blendNumber(from.heightOffset, to.heightOffset, t) ?? (t < 0.5 ? from.heightOffset : to.heightOffset),
  distanceOffset: blendNumber(from.distanceOffset, to.distanceOffset, t)
    ?? (t < 0.5 ? from.distanceOffset : to.distanceOffset),
  floorY: blendNumber(from.floorY, to.floorY, t) ?? (t < 0.5 ? from.floorY : to.floorY),
  floorZMin: blendNumber(from.floorZMin, to.floorZMin, t) ?? (t < 0.5 ? from.floorZMin : to.floorZMin),
  floorZMax: blendNumber(from.floorZMax, to.floorZMax, t) ?? (t < 0.5 ? from.floorZMax : to.floorZMax),
  cameraX: blendNumber(from.cameraX, to.cameraX, t) ?? (t < 0.5 ? from.cameraX : to.cameraX),
  cameraY: blendNumber(from.cameraY, to.cameraY, t) ?? (t < 0.5 ? from.cameraY : to.cameraY),
  lookAtZ: blendNumber(from.lookAtZ, to.lookAtZ, t) ?? (t < 0.5 ? from.lookAtZ : to.lookAtZ),
  enabled: (from.enabled && t < 1) || (to.enabled && t > 0),
});

export const cameraTransitionSpec: ElementTransitionSpec<SceneCamera> = {
  exit: (frames, widgetId, fromState) => {
    for (let i = 0; i < frames.length; i++) {
      const t = transitionT(i, frames.length);
      frames[i]!.state.widgets[widgetId] = {
        ...applyCameraExit(fromState, t),
      };
    }
  },
  enter: (frames, widgetId, toState) => {
    for (let i = 0; i < frames.length; i++) {
      const t = transitionT(i, frames.length);
      frames[i]!.state.widgets[widgetId] = {
        ...applyCameraEnter(toState, t),
      };
    }
  },
  interpolate: (frames, widgetId, fromState, toState) => {
    for (let i = 0; i < frames.length; i++) {
      const t = transitionT(i, frames.length);
      frames[i]!.state.widgets[widgetId] = {
        ...applyCameraInterpolate(fromState, toState, t),
      };
    }
  },
};

export const functionalCameraTransitionSpec: FunctionalTransitionSpec<SceneCamera> = {
  exitFn: (from) => (t) => applyCameraExit(from, t),
  enterFn: (to) => (t) => applyCameraEnter(to, t),
  interpolateFn: (from, to) => (t) => applyCameraInterpolate(from, to, t),
};
