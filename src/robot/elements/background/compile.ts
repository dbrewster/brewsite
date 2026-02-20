import type {SceneBackground} from './types';
import type {ElementTransitionSpec} from '../../runtime/compiler/transitions/transitionTypes';
import {blendOpacity} from '../../runtime/compiler/transitions/transitionTypes';

const crossFadeOpacity = (from: SceneBackground, to: SceneBackground, t: number) => {
  if (from.imageUrl === to.imageUrl) {
    return blendOpacity(from.opacity, to.opacity, t) ?? to.opacity;
  }
  if (t < 0.5) {
    return blendOpacity(from.opacity, 0, t * 2) ?? 0;
  }
  return blendOpacity(0, to.opacity, (t - 0.5) * 2) ?? to.opacity;
};

const selectImageUrl = (from: SceneBackground, to: SceneBackground, t: number) =>
  from.imageUrl === to.imageUrl ? to.imageUrl : t < 0.5 ? from.imageUrl : to.imageUrl;

export const backgroundTransitionSpec: ElementTransitionSpec<SceneBackground> = {
  exit: (from, context) => ({
    ...from,
    opacity: blendOpacity(from.opacity, 0, context.tExit) ?? 0,
  }),
  enter: (to, context) => ({
    ...to,
    opacity: blendOpacity(0, to.opacity, context.tEnter) ?? to.opacity,
  }),
  interpolate: (from, to, context) => ({
    ...from,
    ...to,
    imageUrl: selectImageUrl(from, to, context.tFull),
    opacity: crossFadeOpacity(from, to, context.tFull),
  }),
};
