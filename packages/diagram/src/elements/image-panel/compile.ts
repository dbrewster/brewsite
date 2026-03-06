// Pure compilation for ImagePanel element: ImagePanelDSL → ImagePanelState.
// No Three.js. No React. No side effects.

import type { ImagePanelDSL, ImagePanelState } from './types';
import type { FunctionalTransitionSpec } from '@brewsite/core';
import { blendNumber, blendOpacity, blendVec3 } from '@brewsite/core';

const toMutableVec3 = (value: readonly [number, number, number]): [number, number, number] => [
  value[0],
  value[1],
  value[2],
];

/**
 * Compiles an ImagePanelDSL into a fully resolved ImagePanelState by applying defaults.
 * All fields in the output are defined — no undefined values except nvsHeight.
 *
 * Position is expressed as NVS fractions (nvsX, nvsY); world-space conversion
 * happens in ImagePanelWidget.apply() using the live camera.
 */
export function compileImagePanel(dsl: ImagePanelDSL): ImagePanelState {
  return {
    id: dsl.id,
    src: dsl.src,
    nvsX: dsl.x ?? 0.5,
    nvsY: dsl.y ?? 0.5,
    z: dsl.z ?? 0,
    nvsWidth: dsl.width ?? 0.6,
    nvsHeight: dsl.height,
    rotation: dsl.rotation ?? [0, 0, 0],
    scale: dsl.scale ?? 1,
    bezel: dsl.bezel ?? 'dark',
    bezelThickness: dsl.bezelThickness ?? 0.3,
    opacity: dsl.opacity ?? 1,
    gloss: dsl.gloss ?? 0.5,
    glossRoughness: dsl.glossRoughness ?? 0.05,
    selfIllumination: dsl.selfIllumination ?? 0.15,
    glow: dsl.glow ?? true,
    glowColor: dsl.glowColor ?? '#88ccff',
    glowScale: dsl.glowScale ?? 1.4,
    glowOpacity: dsl.glowOpacity ?? 0.35,
    enabled: dsl.enabled ?? true,
  };
}

/**
 * Functional transition spec for ImagePanelState.
 * NVS position (nvsX, nvsY, z), nvsWidth, nvsHeight, rotation, scale, and opacity
 * are continuously interpolated. Discrete properties (src, bezel, glow) step at midpoint.
 */
export const functionalImagePanelTransitionSpec: FunctionalTransitionSpec<ImagePanelState> = {
  exitFn: (from) => (ctx) => ({
    ...from,
    opacity: blendOpacity(from.opacity, 0, ctx.t) ?? 0,
  }),
  enterFn: (to) => (ctx) => ({
    ...to,
    opacity: blendOpacity(0, to.opacity, ctx.t) ?? to.opacity,
  }),
  interpolateFn: (from, to) => (ctx) => ({
    ...to,
    nvsX: (blendNumber(from.nvsX, to.nvsX, ctx.t) ?? to.nvsX),
    nvsY: (blendNumber(from.nvsY, to.nvsY, ctx.t) ?? to.nvsY),
    z: (blendNumber(from.z, to.z, ctx.t) ?? to.z),
    nvsWidth: (blendNumber(from.nvsWidth, to.nvsWidth, ctx.t) ?? to.nvsWidth),
    nvsHeight: from.nvsHeight !== undefined && to.nvsHeight !== undefined
      ? (blendNumber(from.nvsHeight, to.nvsHeight, ctx.t) ?? to.nvsHeight)
      : to.nvsHeight,
    rotation: blendVec3(toMutableVec3(from.rotation), toMutableVec3(to.rotation), ctx.t) ?? to.rotation,
    scale: blendNumber(from.scale, to.scale, ctx.t) ?? to.scale,
    opacity: blendOpacity(from.opacity, to.opacity, ctx.t) ?? to.opacity,
    gloss: blendNumber(from.gloss, to.gloss, ctx.t) ?? to.gloss,
    selfIllumination: blendNumber(from.selfIllumination, to.selfIllumination, ctx.t) ?? to.selfIllumination,
    glowOpacity: blendNumber(from.glowOpacity, to.glowOpacity, ctx.t) ?? to.glowOpacity,
    // Discrete properties: step at midpoint
    src: ctx.t < 0.5 ? from.src : to.src,
    bezel: ctx.t < 0.5 ? from.bezel : to.bezel,
    glow: ctx.t < 0.5 ? from.glow : to.glow,
  }),
};
