/**
 * Background element compilation.
 */

import type { SceneBackground } from './types';
import type { ElementTransitionSpec } from '../../compiler/transitions/transitionTypes';
import { blendOpacity, blendVec3, transitionT } from '../../compiler/transitions/transitionTypes';

const crossFadeOpacity = (from: SceneBackground, to: SceneBackground, t: number) => {
  if (from.imageUrl === to.imageUrl) {
    return blendOpacity(from.opacity, to.opacity, t) ?? to.opacity;
  }
  if (t < 0.5) {
    return blendOpacity(from.opacity, 0, t * 2) ?? 0;
  }
  return blendOpacity(0, to.opacity, (t - 0.5) * 2) ?? to.opacity;
};

const selectImageUrl = (from: string | undefined, to: string | undefined, t: number) =>
  from === to ? to : t < 0.5 ? from : to;

export const DEFAULT_BACKGROUND: SceneBackground = {
  imageUrl: undefined,
  opacity: 1,
  position: undefined,
  cssPosition: undefined,
  cssSize: undefined,
  cssRepeat: undefined,
};

export const backgroundTransitionSpec: ElementTransitionSpec<SceneBackground> = {
  exit: (frames, widgetId, fromState) => {
    for (let i = 0; i < frames.length; i++) {
      const t = transitionT(i, frames.length);
      frames[i]!.state.widgets[widgetId] = {
        ...fromState,
        opacity: blendOpacity(fromState.opacity, 0, t),
      };
    }
  },
  enter: (frames, widgetId, toState) => {
    for (let i = 0; i < frames.length; i++) {
      const t = transitionT(i, frames.length);
      frames[i]!.state.widgets[widgetId] = {
        ...toState,
        opacity: blendOpacity(0, toState.opacity, t),
      };
    }
  },
  interpolate: (frames, widgetId, fromState, toState) => {
    for (let i = 0; i < frames.length; i++) {
      const t = transitionT(i, frames.length);
      frames[i]!.state.widgets[widgetId] = {
        imageUrl: selectImageUrl(fromState.imageUrl, toState.imageUrl, t),
        opacity: crossFadeOpacity(fromState, toState, t),
        position: blendVec3(fromState.position, toState.position, t),
        cssPosition: t < 0.5 ? fromState.cssPosition : toState.cssPosition,
        cssSize: t < 0.5 ? fromState.cssSize : toState.cssSize,
        cssRepeat: t < 0.5 ? fromState.cssRepeat : toState.cssRepeat,
      };
    }
  },
};
