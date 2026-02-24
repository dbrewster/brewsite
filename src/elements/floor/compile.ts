/**
 * Floor element compilation.
 */

import type { SceneFloor } from './types';
import type { ElementTransitionSpec } from '../../compiler/transitions/transitionTypes';
import { transitionT } from '../../compiler/transitions/transitionTypes';

export const DEFAULT_FLOOR: SceneFloor = {
  enabled: false,
  position: undefined,
  rotation: undefined,
  scale: undefined,
  surface: undefined,
};

export const floorTransitionSpec: ElementTransitionSpec<SceneFloor> = {
  exit: (frames, widgetId, fromState) => {
    for (let i = 0; i < frames.length; i++) {
      const t = transitionT(i, frames.length);
      frames[i]!.state.widgets[widgetId] = {
        position: fromState.position,
        rotation: fromState.rotation,
        scale: fromState.scale,
        surface: fromState.surface,
        enabled: fromState.enabled && t < 1,
      };
    }
  },
  enter: (frames, widgetId, toState) => {
    for (let i = 0; i < frames.length; i++) {
      const t = transitionT(i, frames.length);
      frames[i]!.state.widgets[widgetId] = {
        position: toState.position,
        rotation: toState.rotation,
        scale: toState.scale,
        surface: toState.surface,
        enabled: toState.enabled && t > 0,
      };
    }
  },
  interpolate: (frames, widgetId, fromState, toState) => {
    for (let i = 0; i < frames.length; i++) {
      const t = transitionT(i, frames.length);
      frames[i]!.state.widgets[widgetId] = {
        position: t < 0.5 ? fromState.position : toState.position,
        rotation: t < 0.5 ? fromState.rotation : toState.rotation,
        scale: t < 0.5 ? fromState.scale : toState.scale,
        surface: t < 0.5 ? fromState.surface : toState.surface,
        enabled: (fromState.enabled && t < 1) || (toState.enabled && t > 0),
      };
    }
  },
};
