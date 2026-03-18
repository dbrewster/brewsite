/**
 * Environment element compilation.
 */

import type { SceneEnvironment } from './types';
import type {
  FunctionalTransitionSpec,
} from '../../compiler/transitions/transitionTypes';
import { blendNumber } from '../../compiler/transitions/transitionTypes';

export const DEFAULT_ENVIRONMENT: SceneEnvironment = {
  enabled: false,
  intensity: 1,
  source: undefined,
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
