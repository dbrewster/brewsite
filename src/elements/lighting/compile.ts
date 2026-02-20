/**
 * Lighting element compilation.
 */

import type { SceneLighting } from './types';
import type { ElementTransitionSpec, TransitionContext } from '../../compiler/transitions/transitionTypes';
import { blendColor, blendNumber, blendVec3 } from '../../compiler/transitions/transitionTypes';

const blendLightArray = <T extends { intensity: number; color: string; position: [number, number, number] }>(
  from: T[] | undefined,
  to: T[] | undefined,
  tExit: number,
  tEnter: number,
  tFull: number,
): T[] | undefined => {
  const max = Math.max(from?.length ?? 0, to?.length ?? 0);
  if (max === 0) return undefined;
  const result: T[] = [];
  for (let i = 0; i < max; i += 1) {
    const prev = from?.[i];
    const next = to?.[i];
    if (!prev && !next) continue;
    if (prev && next) {
      result.push({
        ...next,
        intensity: blendNumber(prev.intensity, next.intensity, tFull) ?? next.intensity,
        color: blendColor(prev.color, next.color, tFull) ?? next.color,
        position: blendVec3(prev.position, next.position, tFull) ?? next.position,
      } as T);
      continue;
    }
    if (prev) {
      result.push({
        ...prev,
        intensity: blendNumber(prev.intensity, 0, tExit) ?? 0,
      } as T);
      continue;
    }
    if (next) {
      result.push({
        ...next,
        intensity: blendNumber(0, next.intensity, tEnter) ?? next.intensity,
      } as T);
    }
  }
  return result.length > 0 ? result : undefined;
};

const blendSpots = (
  from: SceneLighting['spots'],
  to: SceneLighting['spots'],
  tExit: number,
  tEnter: number,
  tFull: number,
) => {
  const max = Math.max(from?.length ?? 0, to?.length ?? 0);
  if (max === 0) return undefined;
  const result: NonNullable<SceneLighting['spots']> = [];
  for (let i = 0; i < max; i += 1) {
    const prev = from?.[i];
    const next = to?.[i];
    if (!prev && !next) continue;
    if (prev && next) {
      result.push({
        ...next,
        intensity: blendNumber(prev.intensity, next.intensity, tFull) ?? next.intensity,
        color: blendColor(prev.color, next.color, tFull) ?? next.color,
        position: blendVec3(prev.position, next.position, tFull) ?? next.position,
        target: blendVec3(prev.target, next.target, tFull) ?? next.target,
        angle: blendNumber(prev.angle, next.angle, tFull) ?? next.angle,
        penumbra: blendNumber(prev.penumbra, next.penumbra, tFull) ?? next.penumbra,
        distance: blendNumber(prev.distance, next.distance, tFull) ?? next.distance,
        decay: blendNumber(prev.decay, next.decay, tFull) ?? next.decay,
      });
      continue;
    }
    if (prev) {
      result.push({
        ...prev,
        intensity: blendNumber(prev.intensity, 0, tExit) ?? 0,
      });
      continue;
    }
    if (next) {
      result.push({
        ...next,
        intensity: blendNumber(0, next.intensity, tEnter) ?? next.intensity,
      });
    }
  }
  return result.length > 0 ? result : undefined;
};

const blendPanelMatrix = (from?: number[], to?: number[], t?: number) => {
  if (!from && !to) return undefined;
  if (!from || !to || t === undefined) return to ?? from;
  const max = Math.max(from.length, to.length);
  const result: number[] = [];
  for (let i = 0; i < max; i += 1) {
    const prev = from[i] ?? 0;
    const next = to[i] ?? 0;
    result.push(blendNumber(prev, next, t) ?? next);
  }
  return result;
};

const blendPanels = (
  from: SceneLighting['panels'],
  to: SceneLighting['panels'],
  tExit: number,
  tEnter: number,
  tFull: number,
) => {
  const max = Math.max(from?.length ?? 0, to?.length ?? 0);
  if (max === 0) return undefined;
  const result: NonNullable<SceneLighting['panels']> = [];
  const byId = new Map<string, NonNullable<SceneLighting['panels']>[number]>();
  for (const panel of to ?? []) {
    byId.set(panel.id, panel);
  }
  for (const prev of from ?? []) {
    const next = byId.get(prev.id);
    if (next) {
      result.push({
        ...prev,
        ...next,
        origin: blendVec3(prev.origin, next.origin, tFull) ?? next.origin,
        rows: blendNumber(prev.rows, next.rows, tFull) ?? next.rows,
        cols: blendNumber(prev.cols, next.cols, tFull) ?? next.cols,
        spacing: blendVec3(prev.spacing, next.spacing, tFull) ?? next.spacing,
        intensity: blendNumber(prev.intensity, next.intensity, tFull) ?? next.intensity,
        distance: blendNumber(prev.distance, next.distance, tFull) ?? next.distance,
        decay: blendNumber(prev.decay, next.decay, tFull) ?? next.decay,
        color: blendColor(prev.color, next.color, tFull) ?? next.color,
        matrix: blendPanelMatrix(prev.matrix, next.matrix, tFull) ?? next.matrix,
      });
      byId.delete(prev.id);
      continue;
    }
    result.push({
      ...prev,
      intensity: blendNumber(prev.intensity, 0, tExit) ?? 0,
    });
  }
  for (const next of byId.values()) {
    result.push({
      ...next,
      intensity: blendNumber(0, next.intensity, tEnter) ?? next.intensity,
    });
  }
  return result.length > 0 ? result : undefined;
};

export const DEFAULT_LIGHTING: SceneLighting = {
  ambient: { intensity: 1, color: '#ffffff' },
  directional: { intensity: 1, color: '#ffffff', position: [10, 10, 10] },
  points: [],
  spots: [],
  panels: [],
  intensityScale: 1,
  color: '#ffffff',
};

export const lightingTransitionSpec: ElementTransitionSpec<SceneLighting> = {
  exit: (from: SceneLighting, context: TransitionContext): SceneLighting => ({
    ...from,
    ambient: {
      intensity: blendNumber(from.ambient.intensity, 0, context.tExit) ?? 0,
      color: from.ambient.color,
    },
    directional: {
      ...from.directional,
      intensity: blendNumber(from.directional.intensity, 0, context.tExit) ?? 0,
    },
    points: blendLightArray(from.points, undefined, context.tExit, context.tEnter, context.tFull),
    spots: blendSpots(from.spots, undefined, context.tExit, context.tEnter, context.tFull),
    panels: blendPanels(from.panels, undefined, context.tExit, context.tEnter, context.tFull),
    intensityScale: blendNumber(from.intensityScale, 0, context.tExit) ?? 0,
  }),
  enter: (to: SceneLighting, context: TransitionContext): SceneLighting => ({
    ...to,
    ambient: {
      intensity: blendNumber(0, to.ambient.intensity, context.tEnter) ?? to.ambient.intensity,
      color: to.ambient.color,
    },
    directional: {
      ...to.directional,
      intensity: blendNumber(0, to.directional.intensity, context.tEnter) ?? to.directional.intensity,
    },
    points: blendLightArray(undefined, to.points, context.tExit, context.tEnter, context.tFull),
    spots: blendSpots(undefined, to.spots, context.tExit, context.tEnter, context.tFull),
    panels: blendPanels(undefined, to.panels, context.tExit, context.tEnter, context.tFull),
    intensityScale: blendNumber(0, to.intensityScale, context.tEnter) ?? to.intensityScale,
  }),
  interpolate: (from: SceneLighting, to: SceneLighting, context: TransitionContext): SceneLighting => ({
    ...from,
    ...to,
    ambient: {
      intensity: blendNumber(from.ambient.intensity, to.ambient.intensity, context.tFull) ?? to.ambient.intensity,
      color: blendColor(from.ambient.color, to.ambient.color, context.tFull) ?? to.ambient.color,
    },
    directional: {
      intensity: blendNumber(from.directional.intensity, to.directional.intensity, context.tFull) ?? to.directional.intensity,
      color: blendColor(from.directional.color, to.directional.color, context.tFull) ?? to.directional.color,
      position: blendVec3(from.directional.position, to.directional.position, context.tFull) ?? to.directional.position,
    },
    points: blendLightArray(from.points, to.points, context.tExit, context.tEnter, context.tFull) ?? to.points,
    spots: blendSpots(from.spots, to.spots, context.tExit, context.tEnter, context.tFull) ?? to.spots,
    panels: blendPanels(from.panels, to.panels, context.tExit, context.tEnter, context.tFull) ?? to.panels,
    intensityScale: blendNumber(from.intensityScale, to.intensityScale, context.tFull) ?? to.intensityScale,
    color: blendColor(from.color, to.color, context.tFull) ?? to.color,
  }),
};
