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
 * All fields in the output are defined — no undefined values.
 */
export function compileImagePanel(dsl: ImagePanelDSL): ImagePanelState {
  return {
    id: dsl.id,
    src: dsl.src,
    position: dsl.position ?? [0, 0, 0],
    rotation: dsl.rotation ?? [0, 0, 0],
    scale: dsl.scale ?? 1,
    width: dsl.width ?? 12,
    height: dsl.height,
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
 * Position, rotation, scale, and opacity are all continuously interpolated.
 * Discrete properties (src, bezel, gloss) step at t=0.5 — you cannot meaningfully
 * interpolate an image URL or a bezel material variant.
 */
export const functionalImagePanelTransitionSpec: FunctionalTransitionSpec<ImagePanelState> = {
  exitFn: (from) => (t) => ({
    ...from,
    opacity: blendOpacity(from.opacity, 0, t) ?? 0,
  }),
  enterFn: (to) => (t) => ({
    ...to,
    opacity: blendOpacity(0, to.opacity, t) ?? to.opacity,
  }),
  interpolateFn: (from, to) => (t) => ({
    ...to,
    position: blendVec3(toMutableVec3(from.position), toMutableVec3(to.position), t) ?? to.position,
    rotation: blendVec3(toMutableVec3(from.rotation), toMutableVec3(to.rotation), t) ?? to.rotation,
    scale: blendNumber(from.scale, to.scale, t) ?? to.scale,
    opacity: blendOpacity(from.opacity, to.opacity, t) ?? to.opacity,
    gloss: blendNumber(from.gloss, to.gloss, t) ?? to.gloss,
    selfIllumination: blendNumber(from.selfIllumination, to.selfIllumination, t) ?? to.selfIllumination,
    glowOpacity: blendNumber(from.glowOpacity, to.glowOpacity, t) ?? to.glowOpacity,
    // Discrete properties: step at midpoint
    src: t < 0.5 ? from.src : to.src,
    bezel: t < 0.5 ? from.bezel : to.bezel,
    glow: t < 0.5 ? from.glow : to.glow,
  }),
};
