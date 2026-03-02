/**
 * Background element compilation.
 */

import type { SceneBackground } from './types';
import type {
  ElementTransitionSpec,
  FunctionalTransitionSpec,
} from '../../compiler/transitions/transitionTypes';
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
  color: undefined,
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
        color: t < 0.5 ? fromState.color : toState.color,
        position: blendVec3(fromState.position, toState.position, t),
        cssPosition: t < 0.5 ? fromState.cssPosition : toState.cssPosition,
        cssSize: t < 0.5 ? fromState.cssSize : toState.cssSize,
        cssRepeat: t < 0.5 ? fromState.cssRepeat : toState.cssRepeat,
      };
    }
  },
};

export const functionalBackgroundTransitionSpec: FunctionalTransitionSpec<SceneBackground> = {
  exitFn: (from) => (ctx) => ({
    ...from,
    opacity: blendOpacity(from.opacity, 0, ctx.t) ?? 0,
  }),
  enterFn: (to) => (ctx) => ({
    ...to,
    opacity: blendOpacity(0, to.opacity, ctx.t) ?? to.opacity ?? 0,
  }),
  interpolateFn: (from, to) => (ctx) => ({
    imageUrl: selectImageUrl(from.imageUrl, to.imageUrl, ctx.t),
    opacity: crossFadeOpacity(from, to, ctx.t),
    color: ctx.t < 0.5 ? from.color : to.color,
    position: blendVec3(from.position, to.position, ctx.t),
    cssPosition: ctx.t < 0.5 ? from.cssPosition : to.cssPosition,
    cssSize: ctx.t < 0.5 ? from.cssSize : to.cssSize,
    cssRepeat: ctx.t < 0.5 ? from.cssRepeat : to.cssRepeat,
  }),
};
