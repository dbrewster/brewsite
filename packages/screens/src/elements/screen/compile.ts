// Pure compilation for Screen element: ScreenDSL → ScreenState.
// No Three.js. No DOM access.

import type { ScreenDSL, ScreenState } from './types';
import type { FunctionalTransitionSpec } from '@brewsite/core';
import { blendNumber, blendOpacity, blendVec3, copyVec3, resolveToNVS, isUniformUnit, resolveAngle } from '@brewsite/core';

/**
 * Compiles a ScreenDSL into a fully resolved ScreenState by applying defaults.
 * All fields in the output are defined — no undefined values except nvsHeight.
 *
 * Position is expressed as NVS fractions (nvsX, nvsY); world-space conversion
 * happens in ScreenWidget.apply() using the live camera.
 *
 * Full 3D rotation is supported via CSS3DRenderer. No rotation warnings are emitted.
 */
export function compileScreen(dsl: ScreenDSL): ScreenState {
  const nvsX = dsl.x !== undefined ? resolveToNVS(dsl.x) : 0.5;
  const nvsY = dsl.y !== undefined ? resolveToNVS(dsl.y) : 0.5;
  const nvsWidth = dsl.width !== undefined ? resolveToNVS(dsl.width) : 0.625;
  const nvsHeight = dsl.height !== undefined ? resolveToNVS(dsl.height) : undefined;
  const uniformSizing = dsl.width !== undefined ? isUniformUnit(dsl.width) : false;

  const rotation: readonly [number, number, number] = dsl.rotation !== undefined
    ? [resolveAngle(dsl.rotation[0]), resolveAngle(dsl.rotation[1]), resolveAngle(dsl.rotation[2])]
    : [0, 0, 0];

  return {
    id: dsl.id,
    src: dsl.src,
    nvsX,
    nvsY,
    z: dsl.z ?? 0,
    nvsWidth,
    nvsHeight,
    rotation,
    scale: dsl.scale ?? 1,
    bezel: dsl.bezel ?? 'dark',
    bezelThickness: dsl.bezelThickness ?? 0.3,
    opacity: dsl.opacity ?? 1,
    glow: dsl.glow ?? true,
    glowColor: dsl.glowColor ?? '#88ccff',
    glowScale: dsl.glowScale ?? 1.4,
    glowOpacity: dsl.glowOpacity ?? 0.35,
    enabled: dsl.enabled ?? true,
    uniformSizing,
  };
}

/**
 * Functional transition spec for ScreenState.
 * NVS position (nvsX, nvsY, z), nvsWidth/nvsHeight, scale, and opacity are continuously
 * interpolated. src, bezel, and width/height step at midpoint (cannot interpolate URLs
 * or iframe resize without layout thrash).
 */
export const functionalScreenTransitionSpec: FunctionalTransitionSpec<ScreenState> = {
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
    nvsWidth: ctx.t < 0.5 ? from.nvsWidth : to.nvsWidth,
    nvsHeight: ctx.t < 0.5 ? from.nvsHeight : to.nvsHeight,
    rotation: blendVec3(copyVec3(from.rotation), copyVec3(to.rotation), ctx.t) ?? to.rotation,
    scale: blendNumber(from.scale, to.scale, ctx.t) ?? to.scale,
    opacity: blendOpacity(from.opacity, to.opacity, ctx.t) ?? to.opacity,
    glowOpacity: blendNumber(from.glowOpacity, to.glowOpacity, ctx.t) ?? to.glowOpacity,
    // Discrete properties: step at midpoint
    src: ctx.t < 0.5 ? from.src : to.src,
    bezel: ctx.t < 0.5 ? from.bezel : to.bezel,
  }),
};
