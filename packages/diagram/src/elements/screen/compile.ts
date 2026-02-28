// Pure compilation for Screen element: ScreenDSL → ScreenState.
// No Three.js. No React. No DOM access.

import type { ScreenDSL, ScreenState } from './types';
import type { FunctionalTransitionSpec } from '@brewsite/core';
import { blendNumber, blendOpacity, blendVec3 } from '@brewsite/core';

export const SCREEN_ROTATION_WARNING_THRESHOLD_RAD = 0.1;

const toMutableVec3 = (value: readonly [number, number, number]): [number, number, number] => [
  value[0],
  value[1],
  value[2],
];

/**
 * Compiles a ScreenDSL into a fully resolved ScreenState by applying defaults.
 * All fields in the output are defined — no undefined values.
 *
 * Side effect: emits console.warn if any rotation axis exceeds
 * SCREEN_ROTATION_WARNING_THRESHOLD_RAD radians,
 * because the iframe overlay cannot meaningfully tilt with the WebGL bezel.
 */
export function compileScreen(dsl: ScreenDSL): ScreenState {
  const rotation = dsl.rotation ?? [0, 0, 0];
  if (
    Math.abs(rotation[0]) > SCREEN_ROTATION_WARNING_THRESHOLD_RAD ||
    Math.abs(rotation[1]) > SCREEN_ROTATION_WARNING_THRESHOLD_RAD ||
    Math.abs(rotation[2]) > SCREEN_ROTATION_WARNING_THRESHOLD_RAD
  ) {
    console.warn(
      `Screen compileScreen: rotation ${rotation.join(', ')} may misalign the iframe overlay. ` +
        'Use <ImagePanel> for tilted content.',
    );
  }

  return {
    id: dsl.id,
    src: dsl.src,
    position: dsl.position ?? [0, 0, 0],
    rotation,
    scale: dsl.scale ?? 1,
    width: dsl.width ?? 12,
    height: dsl.height ?? 7.5,
    bezel: dsl.bezel ?? 'dark',
    bezelThickness: dsl.bezelThickness ?? 0.3,
    opacity: dsl.opacity ?? 1,
    glow: dsl.glow ?? true,
    glowColor: dsl.glowColor ?? '#88ccff',
    glowScale: dsl.glowScale ?? 1.4,
    glowOpacity: dsl.glowOpacity ?? 0.35,
    enabled: dsl.enabled ?? true,
  };
}

/**
 * Functional transition spec for ScreenState.
 * Position, scale, and opacity are continuously interpolated (opacity drives both
 * the WebGL bezel and the iframe CSS opacity simultaneously).
 * src and bezel step at t=0.5 — URLs and variants cannot be interpolated.
 *
 * Note: height and width are not interpolated (no smooth resize of the iframe).
 * They step at t=0.5. To animate a resize, change only position/scale.
 */
export const functionalScreenTransitionSpec: FunctionalTransitionSpec<ScreenState> = {
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
    glowOpacity: blendNumber(from.glowOpacity, to.glowOpacity, t) ?? to.glowOpacity,
    // Discrete properties: step at midpoint
    src: t < 0.5 ? from.src : to.src,
    bezel: t < 0.5 ? from.bezel : to.bezel,
    width: t < 0.5 ? from.width : to.width,
    height: t < 0.5 ? from.height : to.height,
  }),
};
