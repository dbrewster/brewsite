import type {SceneEnvironment} from './types';
import type {ElementTransitionSpec} from '../../runtime/compiler/transitions/transitionTypes';
import {blendNumber} from '../../runtime/compiler/transitions/transitionTypes';

export const environmentTransitionSpec: ElementTransitionSpec<SceneEnvironment> = {
  exit: (from, context) => ({
    ...from,
    enabled: context.tExit < 1 && from.enabled,
    intensity: blendNumber(from.intensity, 0, context.tExit) ?? 0,
  }),
  enter: (to, context) => ({
    ...to,
    enabled: context.tEnter > 0 && to.enabled,
    intensity: blendNumber(0, to.intensity, context.tEnter) ?? to.intensity,
  }),
  interpolate: (from, to, context) => ({
    ...from,
    ...to,
    enabled: (from.enabled && to.enabled) ? true : (context.tFull > 0 && to.enabled) || (context.tFull < 1 && from.enabled),
    intensity: blendNumber(from.intensity, to.intensity, context.tFull) ?? to.intensity,
    url: context.tFull < 0.5 ? from.url : to.url,
    preset: context.tFull < 0.5 ? from.preset : to.preset,
  }),
};
