import type {SceneFloor} from './types';
import type {ElementTransitionSpec} from '../../runtime/compiler/transitions/transitionTypes';

export const floorTransitionSpec: ElementTransitionSpec<SceneFloor> = {
  exit: (from, context) => ({
    ...from,
    enabled: from.enabled && context.tExit < 1,
  }),
  enter: (to, context) => ({
    ...to,
    enabled: to.enabled && context.tEnter > 0,
  }),
  interpolate: (from, to, context) => ({
    ...from,
    ...to,
    enabled: (from.enabled && context.tFull < 1) || (to.enabled && context.tFull > 0),
    textureUrl: context.tFull < 0.5 ? from.textureUrl : to.textureUrl,
  }),
};
