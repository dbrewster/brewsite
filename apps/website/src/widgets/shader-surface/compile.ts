// Pure compile-time defaults and transition spec for the shader surface widget.

import type { FunctionalTransitionSpec } from '@brewsite/core/compiler/transitions/transitionTypes';
import { blendNumber } from '@brewsite/core/compiler/transitions/transitionTypes';
import type { ShaderSurfaceState } from './types';

/** Default compiled state for the shader surface. */
export const DEFAULT_SHADER_SURFACE_STATE: ShaderSurfaceState = {
  enabled: false,
  kind: 'plane',
  x: 0.2,
  y: 0.3,
  w: 0.6,
  h: 0.4,
  z: 0,
  opacity: 0.4,
  palette: 'hero',
  edgeGlow: 0.2,
  distortion: 0.1,
  scanStrength: 0,
  reveal: 1,
};

/** Functional transition spec for the shader surface widget. */
export const shaderSurfaceTransitionSpec: FunctionalTransitionSpec<ShaderSurfaceState> = {
  exitFn: (from) => (ctx) => ({
    ...from,
    enabled: ctx.t < 1 && from.enabled,
    opacity: blendNumber(from.opacity, 0, ctx.t) ?? 0,
    reveal: blendNumber(from.reveal, 0, ctx.t) ?? 0,
  }),

  enterFn: (to) => (ctx) => ({
    ...to,
    enabled: ctx.t > 0 && to.enabled,
    opacity: blendNumber(0, to.opacity, ctx.t) ?? to.opacity,
    reveal: blendNumber(0, to.reveal, ctx.t) ?? to.reveal,
  }),

  interpolateFn: (from, to) => (ctx) => ({
    enabled: ctx.t < 0.5 ? from.enabled : to.enabled,
    kind: ctx.t < 0.5 ? from.kind : to.kind,
    x: blendNumber(from.x, to.x, ctx.t) ?? to.x,
    y: blendNumber(from.y, to.y, ctx.t) ?? to.y,
    w: blendNumber(from.w, to.w, ctx.t) ?? to.w,
    h: blendNumber(from.h, to.h, ctx.t) ?? to.h,
    z: blendNumber(from.z, to.z, ctx.t) ?? to.z,
    opacity: blendNumber(from.opacity, to.opacity, ctx.t) ?? to.opacity,
    palette: ctx.t < 0.5 ? from.palette : to.palette,
    edgeGlow: blendNumber(from.edgeGlow, to.edgeGlow, ctx.t) ?? to.edgeGlow,
    distortion: blendNumber(from.distortion, to.distortion, ctx.t) ?? to.distortion,
    scanStrength: blendNumber(from.scanStrength, to.scanStrength, ctx.t) ?? to.scanStrength,
    reveal: blendNumber(from.reveal, to.reveal, ctx.t) ?? to.reveal,
  }),
};
