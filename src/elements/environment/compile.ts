/**
 * Environment element compilation.
 */

import type { SceneEnvironment } from './types';
import type { ElementTransitionSpec } from '../../compiler/transitions/transitionTypes';
import { blendNumber, transitionT } from '../../compiler/transitions/transitionTypes';

export const DEFAULT_ENVIRONMENT: SceneEnvironment = {
  enabled: false,
  url: undefined,
  preset: undefined,
  intensity: 1,
};

export const environmentTransitionSpec: ElementTransitionSpec<SceneEnvironment> = {
  exit: (frames, widgetId, fromState) => {
    for (let i = 0; i < frames.length; i++) {
      const t = transitionT(i, frames.length);
      frames[i]!.state.widgets[widgetId] = {
        ...fromState,
        enabled: t < 1 && fromState.enabled,
        intensity: blendNumber(fromState.intensity, 0, t),
      };
    }
  },
  enter: (frames, widgetId, toState) => {
    for (let i = 0; i < frames.length; i++) {
      const t = transitionT(i, frames.length);
      frames[i]!.state.widgets[widgetId] = {
        ...toState,
        enabled: t > 0 && toState.enabled,
        intensity: blendNumber(0, toState.intensity, t),
      };
    }
  },
  interpolate: (frames, widgetId, fromState, toState) => {
    for (let i = 0; i < frames.length; i++) {
      const t = transitionT(i, frames.length);
      const enabled = (fromState.enabled && toState.enabled)
        ? true
        : (t > 0 && toState.enabled) || (t < 1 && fromState.enabled);
      frames[i]!.state.widgets[widgetId] = {
        url: t < 0.5 ? fromState.url : toState.url,
        preset: t < 0.5 ? fromState.preset : toState.preset,
        enabled,
        intensity: blendNumber(fromState.intensity, toState.intensity, t),
      };
    }
  },
};
