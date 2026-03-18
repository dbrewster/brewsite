import type { FunctionalTransitionSpec } from '@brewsite/core/compiler/transitions/transitionTypes';
import { blendNumber } from '@brewsite/core/compiler/transitions/transitionTypes';
import type { NeonSignState } from './types';

export const DEFAULT_NEON_SIGN_STATE: NeonSignState = {
  enabled: false,
  opacity: 1,
  text: 'BrewSite',
  fontUrl: '/fonts/DancingScript-Bold.woff',
  color: '#00f5ff',
  emissiveColor: '#00d8ff',
  intensity: 1,
  x: 0.5,
  y: 0.5,
  w: 0.6,
  h: 0.3,
  z: 0,
  tilt: 0,
  yRotation: 0,
};

export const neonSignTransitionSpec: FunctionalTransitionSpec<NeonSignState> = {
  exitFn: (from) => (ctx) => ({
    ...from,
    enabled: ctx.t < 1 && from.enabled,
    opacity: blendNumber(from.opacity, 0, ctx.t) ?? 0,
    intensity: blendNumber(from.intensity, 0, ctx.t) ?? 0,
  }),

  enterFn: (to) => (ctx) => ({
    ...to,
    enabled: ctx.t > 0 && to.enabled,
    opacity: blendNumber(0, to.opacity, ctx.t) ?? to.opacity,
    intensity: blendNumber(0, to.intensity, ctx.t) ?? to.intensity,
  }),

  interpolateFn: (from, to) => (ctx) => ({
    enabled: ctx.t < 0.5 ? from.enabled : to.enabled,
    text: ctx.t < 0.5 ? from.text : to.text,
    fontUrl: ctx.t < 0.5 ? from.fontUrl : to.fontUrl,
    color: ctx.t < 0.5 ? from.color : to.color,
    emissiveColor: ctx.t < 0.5 ? from.emissiveColor : to.emissiveColor,
    opacity: blendNumber(from.opacity, to.opacity, ctx.t) ?? to.opacity,
    intensity: blendNumber(from.intensity, to.intensity, ctx.t) ?? to.intensity,
    x: blendNumber(from.x, to.x, ctx.t) ?? to.x,
    y: blendNumber(from.y, to.y, ctx.t) ?? to.y,
    w: blendNumber(from.w, to.w, ctx.t) ?? to.w,
    h: blendNumber(from.h, to.h, ctx.t) ?? to.h,
    z: blendNumber(from.z, to.z, ctx.t) ?? to.z,
    tilt: blendNumber(from.tilt, to.tilt, ctx.t) ?? to.tilt,
    yRotation: blendNumber(from.yRotation, to.yRotation, ctx.t) ?? to.yRotation,
  }),
};
