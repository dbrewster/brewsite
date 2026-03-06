/**
 * Background element compilation.
 */

import type { SceneBackground } from './types';
import type {
  ElementTransitionSpec,
  FunctionalTransitionSpec,
} from '../../compiler/transitions/transitionTypes';
import { blendOpacity, transitionT } from '../../compiler/transitions/transitionTypes';

const crossFadeOpacity = (from: SceneBackground, to: SceneBackground, t: number): number => {
  if (from.imageUrl === to.imageUrl) {
    return blendOpacity(from.opacity, to.opacity, t) ?? to.opacity;
  }
  if (t < 0.5) {
    return blendOpacity(from.opacity, 0, t * 2) ?? 0;
  }
  return blendOpacity(0, to.opacity, (t - 0.5) * 2) ?? to.opacity;
};

const selectImageUrl = (from: string | undefined, to: string | undefined, t: number): string | undefined =>
  from === to ? to : t < 0.5 ? from : to;

/** Discrete midpoint selection for string fields that cannot be interpolated. */
const selectStr = (from: string | undefined, to: string | undefined, t: number): string | undefined =>
  t < 0.5 ? from : to;

export const DEFAULT_BACKGROUND: SceneBackground = {
  imageUrl: undefined,
  opacity: 1,
  color: undefined,
  gradient: undefined,
  cssPosition: undefined,
  cssSize: undefined,
  cssRepeat: undefined,
  cssFilter: undefined,
  overlayGradient: undefined,
  backdropFilter: undefined,
};

/** ElementTransitionSpec — batch-fill model for background state. */
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
        imageUrl:        selectImageUrl(fromState.imageUrl, toState.imageUrl, t),
        opacity:         crossFadeOpacity(fromState, toState, t),
        color:           selectStr(fromState.color, toState.color, t),
        gradient:        selectStr(fromState.gradient, toState.gradient, t),
        cssPosition:     selectStr(fromState.cssPosition, toState.cssPosition, t),
        cssSize:         selectStr(fromState.cssSize, toState.cssSize, t),
        cssRepeat:       selectStr(fromState.cssRepeat, toState.cssRepeat, t),
        cssFilter:       selectStr(fromState.cssFilter, toState.cssFilter, t),
        overlayGradient: selectStr(fromState.overlayGradient, toState.overlayGradient, t),
        backdropFilter:  selectStr(fromState.backdropFilter, toState.backdropFilter, t),
      };
    }
  },
};

/** FunctionalTransitionSpec — closure model for background state. */
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
    imageUrl:        selectImageUrl(from.imageUrl, to.imageUrl, ctx.t),
    opacity:         crossFadeOpacity(from, to, ctx.t),
    color:           selectStr(from.color, to.color, ctx.t),
    gradient:        selectStr(from.gradient, to.gradient, ctx.t),
    cssPosition:     selectStr(from.cssPosition, to.cssPosition, ctx.t),
    cssSize:         selectStr(from.cssSize, to.cssSize, ctx.t),
    cssRepeat:       selectStr(from.cssRepeat, to.cssRepeat, ctx.t),
    cssFilter:       selectStr(from.cssFilter, to.cssFilter, ctx.t),
    overlayGradient: selectStr(from.overlayGradient, to.overlayGradient, ctx.t),
    backdropFilter:  selectStr(from.backdropFilter, to.backdropFilter, ctx.t),
  }),
};
