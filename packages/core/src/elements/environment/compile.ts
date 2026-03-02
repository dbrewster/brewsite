/**
 * Environment element compilation.
 */

import type { SceneEnvironment } from './types';
import type {
  ElementTransitionSpec,
  FunctionalTransitionSpec,
} from '../../compiler/transitions/transitionTypes';
import { blendNumber, transitionT } from '../../compiler/transitions/transitionTypes';

export const DEFAULT_ENVIRONMENT: SceneEnvironment = {
  enabled: false,
  intensity: 1,
  source: undefined,
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
        source: t < 0.5 ? fromState.source : toState.source,
        enabled,
        intensity: blendNumber(fromState.intensity, toState.intensity, t),
      };
    }
  },
};

export const functionalEnvironmentTransitionSpec: FunctionalTransitionSpec<SceneEnvironment> = {
  exitFn: (from) => (ctx) => ({
    ...from,
    enabled: ctx.t < 1 && from.enabled,
    intensity: blendNumber(from.intensity, 0, ctx.t) ?? 0,
  }),
  enterFn: (to) => (ctx) => ({
    ...to,
    enabled: ctx.t > 0 && to.enabled,
    intensity: blendNumber(0, to.intensity, ctx.t) ?? 0,
  }),
  interpolateFn: (from, to) => (ctx) => {
    const t = ctx.t;
    const enabled = (from.enabled && to.enabled)
      ? true
      : (t > 0 && to.enabled) || (t < 1 && from.enabled);
    return {
      source: t < 0.5 ? from.source : to.source,
      enabled,
      intensity: blendNumber(from.intensity, to.intensity, t) ?? to.intensity,
    };
  },
};
