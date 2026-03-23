// Pure compile-time defaults and transition spec for the signal field widget.

import type { FunctionalTransitionSpec } from '@brewsite/core/compiler/transitions/transitionTypes';
import { blendNumber } from '@brewsite/core/compiler/transitions/transitionTypes';
import type { SignalFieldState } from './types';

/** Default compiled state for the signal field. */
export const DEFAULT_SIGNAL_FIELD_STATE: SignalFieldState = {
  enabled: false,
  x: 0.1,
  y: 0.1,
  w: 0.8,
  h: 0.8,
  z: 0,
  count: 200,
  opacity: 0.6,
  size: 0.02,
  speed: 0.8,
  depth: 0.05,
  spread: 0.15,
  flow: 'orbit',
  palette: 'hero',
  targetBias: 0,
};

/** Functional transition spec for the signal field widget. */
export const signalFieldTransitionSpec: FunctionalTransitionSpec<SignalFieldState> = {
  exitFn: (from) => (ctx) => ({
    ...from,
    enabled: ctx.t < 1 && from.enabled,
    opacity: blendNumber(from.opacity, 0, ctx.t) ?? 0,
  }),

  enterFn: (to) => (ctx) => ({
    ...to,
    enabled: ctx.t > 0 && to.enabled,
    opacity: blendNumber(0, to.opacity, ctx.t) ?? to.opacity,
  }),

  interpolateFn: (from, to) => (ctx) => ({
    enabled: ctx.t < 0.5 ? from.enabled : to.enabled,
    x: blendNumber(from.x, to.x, ctx.t) ?? to.x,
    y: blendNumber(from.y, to.y, ctx.t) ?? to.y,
    w: blendNumber(from.w, to.w, ctx.t) ?? to.w,
    h: blendNumber(from.h, to.h, ctx.t) ?? to.h,
    z: blendNumber(from.z, to.z, ctx.t) ?? to.z,
    count: ctx.t < 0.5 ? from.count : to.count,
    opacity: blendNumber(from.opacity, to.opacity, ctx.t) ?? to.opacity,
    size: blendNumber(from.size, to.size, ctx.t) ?? to.size,
    speed: blendNumber(from.speed, to.speed, ctx.t) ?? to.speed,
    depth: blendNumber(from.depth, to.depth, ctx.t) ?? to.depth,
    spread: blendNumber(from.spread, to.spread, ctx.t) ?? to.spread,
    flow: ctx.t < 0.5 ? from.flow : to.flow,
    palette: ctx.t < 0.5 ? from.palette : to.palette,
    targetBias: blendNumber(from.targetBias, to.targetBias, ctx.t) ?? to.targetBias,
  }),
};
