// Pure compilation for MediaScreen element: MediaScreenDSL → MediaScreenState.
// No Three.js. No React. No side effects.
import type { MediaScreenDSL, MediaScreenState } from './types';
import type { FunctionalTransitionSpec } from '@brewsite/core';
import { blendNumber, blendOpacity, blendVec3, copyVec3, validateNVSScalar } from '@brewsite/core';

/**
 * Compiles a MediaScreenDSL into a fully resolved MediaScreenState by applying defaults.
 * Warns in dev mode when both src and streamId are set, or when neither is set.
 */
export function compileMediaScreen(dsl: MediaScreenDSL): MediaScreenState {
  const hasSrc = Boolean(dsl.src?.length);
  const hasStreamId = Boolean(dsl.streamId?.length);

  if (process.env.NODE_ENV !== 'production') {
    // Skip source-presence warning for disabled placeholders (e.g. initial widget registration).
    if (!hasSrc && !hasStreamId && dsl.enabled !== false)
      console.warn(`<MediaScreen id="${dsl.id}">: no src or streamId. Will render black.`);
    if (hasSrc && hasStreamId)
      console.warn(`<MediaScreen id="${dsl.id}">: both src and streamId set. src takes precedence.`);
  }

  const sourceKind = hasSrc ? 'video' : 'stream';
  const nvsX = dsl.x ?? 0.5;
  const nvsY = dsl.y ?? 0.5;
  const nvsWidth = dsl.width ?? 0.625;
  const nvsHeight = dsl.height;

  if (process.env.NODE_ENV !== 'production') {
    validateNVSScalar(nvsX, 'nvsX', `<MediaScreen id="${dsl.id}">`);
    validateNVSScalar(nvsY, 'nvsY', `<MediaScreen id="${dsl.id}">`);
    validateNVSScalar(nvsWidth, 'nvsWidth', `<MediaScreen id="${dsl.id}">`);
    if (nvsHeight !== undefined)
      validateNVSScalar(nvsHeight, 'nvsHeight', `<MediaScreen id="${dsl.id}">`);
  }

  return {
    id: dsl.id,
    sourceKind,
    src: hasSrc ? dsl.src : undefined,
    streamId: !hasSrc && hasStreamId ? dsl.streamId : undefined,
    autoPlay: dsl.autoPlay ?? true,
    loop: dsl.loop ?? true,
    muted: dsl.muted ?? true,
    nvsX, nvsY,
    z: dsl.z ?? 0,
    nvsWidth, nvsHeight,
    rotation: dsl.rotation ?? [0, 0, 0],
    scale: dsl.scale ?? 1,
    bezel: dsl.bezel ?? 'dark',
    bezelThickness: dsl.bezelThickness ?? 0.3,
    opacity: dsl.opacity ?? 1,
    gloss: dsl.gloss ?? 0.5,
    glossRoughness: dsl.glossRoughness ?? 0.05,
    selfIllumination: dsl.selfIllumination ?? 0.3,
    glow: dsl.glow ?? true,
    glowColor: dsl.glowColor ?? '#88ccff',
    glowScale: dsl.glowScale ?? 1.4,
    glowOpacity: dsl.glowOpacity ?? 0.35,
    enabled: dsl.enabled ?? true,
  };
}

/**
 * Functional transition spec for MediaScreenState.
 * NVS position, dimensions, rotation, scale, opacity, gloss, selfIllumination, and
 * glowOpacity are continuously interpolated. Discrete fields step at midpoint (t=0.5).
 */
export const functionalMediaScreenTransitionSpec: FunctionalTransitionSpec<MediaScreenState> = {
  exitFn: (from) => (ctx) => ({ ...from, opacity: blendOpacity(from.opacity, 0, ctx.t) ?? 0 }),
  enterFn: (to) => (ctx) => ({ ...to, opacity: blendOpacity(0, to.opacity, ctx.t) ?? to.opacity }),
  interpolateFn: (from, to) => (ctx) => ({
    ...to,
    nvsX: blendNumber(from.nvsX, to.nvsX, ctx.t) ?? to.nvsX,
    nvsY: blendNumber(from.nvsY, to.nvsY, ctx.t) ?? to.nvsY,
    z: blendNumber(from.z, to.z, ctx.t) ?? to.z,
    nvsWidth: blendNumber(from.nvsWidth, to.nvsWidth, ctx.t) ?? to.nvsWidth,
    nvsHeight: from.nvsHeight !== undefined && to.nvsHeight !== undefined
      ? blendNumber(from.nvsHeight, to.nvsHeight, ctx.t) ?? to.nvsHeight
      : to.nvsHeight,
    rotation: blendVec3(copyVec3(from.rotation), copyVec3(to.rotation), ctx.t) ?? to.rotation,
    scale: blendNumber(from.scale, to.scale, ctx.t) ?? to.scale,
    opacity: blendOpacity(from.opacity, to.opacity, ctx.t) ?? to.opacity,
    gloss: blendNumber(from.gloss, to.gloss, ctx.t) ?? to.gloss,
    selfIllumination: blendNumber(from.selfIllumination, to.selfIllumination, ctx.t) ?? to.selfIllumination,
    glowOpacity: blendNumber(from.glowOpacity, to.glowOpacity, ctx.t) ?? to.glowOpacity,
    // Discrete — step at midpoint
    src: ctx.t < 0.5 ? from.src : to.src,
    streamId: ctx.t < 0.5 ? from.streamId : to.streamId,
    sourceKind: ctx.t < 0.5 ? from.sourceKind : to.sourceKind,
    bezel: ctx.t < 0.5 ? from.bezel : to.bezel,
    glow: ctx.t < 0.5 ? from.glow : to.glow,
    loop: ctx.t < 0.5 ? from.loop : to.loop,
    muted: ctx.t < 0.5 ? from.muted : to.muted,
    autoPlay: ctx.t < 0.5 ? from.autoPlay : to.autoPlay,
  }),
};
