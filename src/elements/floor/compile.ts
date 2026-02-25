/**
 * Floor element compilation.
 */

import type { SceneFloor } from './types';
import type {
  ElementTransitionSpec,
  FunctionalTransitionSpec,
} from '../../compiler/transitions/transitionTypes';
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

export const functionalFloorTransitionSpec: FunctionalTransitionSpec<SceneFloor> = {
  exitFn: (from) => (t) => ({
    position: from.position,
    rotation: from.rotation,
    scale: from.scale,
    surface: from.surface,
    enabled: from.enabled && t < 1,
  }),
  enterFn: (to) => (t) => ({
    position: to.position,
    rotation: to.rotation,
    scale: to.scale,
    surface: to.surface,
    enabled: to.enabled && t > 0,
  }),
  interpolateFn: (from, to) => (t) => ({
    position: t < 0.5 ? from.position : to.position,
    rotation: t < 0.5 ? from.rotation : to.rotation,
    scale: t < 0.5 ? from.scale : to.scale,
    surface: t < 0.5 ? from.surface : to.surface,
    enabled: (from.enabled && t < 1) || (to.enabled && t > 0),
  }),
};
