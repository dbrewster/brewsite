/**
 * Floor element compilation.
 */

import type { SceneFloor } from './types';
import type { ElementTransitionSpec } from '../../compiler/transitions/transitionTypes';
import { transitionT } from '../../compiler/transitions/transitionTypes';

export const DEFAULT_FLOOR: SceneFloor = {
  enabled: false,
  textureUrl: undefined,
};

export const floorTransitionSpec: ElementTransitionSpec<SceneFloor> = {
  exit: (frames, widgetId, fromState) => {
    for (let i = 0; i < frames.length; i++) {
      const t = transitionT(i, frames.length);
      frames[i]!.state.widgets[widgetId] = {
        textureUrl: fromState.textureUrl,
        enabled: fromState.enabled && t < 1,
      };
    }
  },
  enter: (frames, widgetId, toState) => {
    for (let i = 0; i < frames.length; i++) {
      const t = transitionT(i, frames.length);
      frames[i]!.state.widgets[widgetId] = {
        textureUrl: toState.textureUrl,
        enabled: toState.enabled && t > 0,
      };
    }
  },
  interpolate: (frames, widgetId, fromState, toState) => {
    for (let i = 0; i < frames.length; i++) {
      const t = transitionT(i, frames.length);
      frames[i]!.state.widgets[widgetId] = {
        textureUrl: t < 0.5 ? fromState.textureUrl : toState.textureUrl,
        enabled: (fromState.enabled && t < 1) || (toState.enabled && t > 0),
      };
    }
  },
};
