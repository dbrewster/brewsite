// Pure compile-time defaults and transition spec for the PostFX widget.

import type { FunctionalTransitionSpec } from '@brewsite/core/compiler/transitions/transitionTypes';
import { blendNumber } from '@brewsite/core/compiler/transitions/transitionTypes';
import type { PostFxState } from './types';

/** Default compiled state for post-processing effects. */
export const DEFAULT_POST_FX_STATE: PostFxState = {
  enabled: false,
  bloomStrength: 0.3,
  bloomRadius: 0.4,
  bloomThreshold: 0.85,
  vignetteStrength: 0.3,
  gradeMix: 0,
  quality: 'high',
};

/** Functional transition spec for the PostFX widget. */
export const postFxTransitionSpec: FunctionalTransitionSpec<PostFxState> = {
  exitFn: (from) => (ctx) => ({
    ...from,
    enabled: ctx.t < 1 && from.enabled,
    bloomStrength: blendNumber(from.bloomStrength, 0, ctx.t) ?? 0,
    vignetteStrength: blendNumber(from.vignetteStrength, 0, ctx.t) ?? 0,
    gradeMix: blendNumber(from.gradeMix, 0, ctx.t) ?? 0,
  }),

  enterFn: (to) => (ctx) => ({
    ...to,
    enabled: ctx.t > 0 && to.enabled,
    bloomStrength: blendNumber(0, to.bloomStrength, ctx.t) ?? to.bloomStrength,
    vignetteStrength: blendNumber(0, to.vignetteStrength, ctx.t) ?? to.vignetteStrength,
    gradeMix: blendNumber(0, to.gradeMix, ctx.t) ?? to.gradeMix,
  }),

  interpolateFn: (from, to) => (ctx) => ({
    enabled: ctx.t < 0.5 ? from.enabled : to.enabled,
    bloomStrength: blendNumber(from.bloomStrength, to.bloomStrength, ctx.t) ?? to.bloomStrength,
    bloomRadius: blendNumber(from.bloomRadius, to.bloomRadius, ctx.t) ?? to.bloomRadius,
    bloomThreshold: blendNumber(from.bloomThreshold, to.bloomThreshold, ctx.t) ?? to.bloomThreshold,
    vignetteStrength: blendNumber(from.vignetteStrength, to.vignetteStrength, ctx.t) ?? to.vignetteStrength,
    gradeMix: blendNumber(from.gradeMix, to.gradeMix, ctx.t) ?? to.gradeMix,
    quality: ctx.t < 0.5 ? from.quality : to.quality,
  }),
};
