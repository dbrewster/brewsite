/**
 * Lighting element compilation.
 */

import type { SceneLighting } from './types';
import type { ElementTransitionSpec } from '../../compiler/transitions/transitionTypes';
import { blendColor, blendNumber, blendVec3, transitionT } from '../../compiler/transitions/transitionTypes';

const blendLightArray = <T extends { intensity: number; color: string; position: [number, number, number] }>(
  from: T[] | undefined,
  to: T[] | undefined,
  t: number,
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
        intensity: blendNumber(prev.intensity, next.intensity, t) ?? next.intensity,
        color: blendColor(prev.color, next.color, t) ?? next.color,
        position: blendVec3(prev.position, next.position, t) ?? next.position,
      } as T);
      continue;
    }
    if (prev) {
      result.push({
        ...prev,
        intensity: blendNumber(prev.intensity, 0, t) ?? 0,
      } as T);
      continue;
    }
    if (next) {
      result.push({
        ...next,
        intensity: blendNumber(0, next.intensity, t) ?? next.intensity,
      } as T);
    }
  }
  return result.length > 0 ? result : undefined;
};

const blendSpots = (
  from: SceneLighting['spots'],
  to: SceneLighting['spots'],
  t: number,
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
        intensity: blendNumber(prev.intensity, next.intensity, t) ?? next.intensity,
        color: blendColor(prev.color, next.color, t) ?? next.color,
        position: blendVec3(prev.position, next.position, t) ?? next.position,
        target: blendVec3(prev.target, next.target, t) ?? next.target,
        angle: blendNumber(prev.angle, next.angle, t) ?? next.angle,
        penumbra: blendNumber(prev.penumbra, next.penumbra, t) ?? next.penumbra,
        distance: blendNumber(prev.distance, next.distance, t) ?? next.distance,
        decay: blendNumber(prev.decay, next.decay, t) ?? next.decay,
      });
      continue;
    }
    if (prev) {
      result.push({
        ...prev,
        intensity: blendNumber(prev.intensity, 0, t) ?? 0,
      });
      continue;
    }
    if (next) {
      result.push({
        ...next,
        intensity: blendNumber(0, next.intensity, t) ?? next.intensity,
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
  t: number,
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
        origin: blendVec3(prev.origin, next.origin, t) ?? next.origin,
        rows: blendNumber(prev.rows, next.rows, t) ?? next.rows,
        cols: blendNumber(prev.cols, next.cols, t) ?? next.cols,
        spacing: blendVec3(prev.spacing, next.spacing, t) ?? next.spacing,
        intensity: blendNumber(prev.intensity, next.intensity, t) ?? next.intensity,
        distance: blendNumber(prev.distance, next.distance, t) ?? next.distance,
        decay: blendNumber(prev.decay, next.decay, t) ?? next.decay,
        color: blendColor(prev.color, next.color, t) ?? next.color,
        matrix: blendPanelMatrix(prev.matrix, next.matrix, t) ?? next.matrix,
      });
      byId.delete(prev.id);
      continue;
    }
    result.push({
      ...prev,
      intensity: blendNumber(prev.intensity, 0, t) ?? 0,
    });
  }
  for (const next of byId.values()) {
    result.push({
      ...next,
      intensity: blendNumber(0, next.intensity, t) ?? next.intensity,
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

export const applyLightingExit = (from: SceneLighting, t: number): SceneLighting => ({
  ...from,
  ambient: {
    intensity: blendNumber(from.ambient.intensity, 0, t) ?? 0,
    color: from.ambient.color,
  },
  directional: {
    ...from.directional,
    intensity: blendNumber(from.directional.intensity, 0, t) ?? 0,
  },
  points: blendLightArray(from.points, undefined, t),
  spots: blendSpots(from.spots, undefined, t),
  panels: blendPanels(from.panels, undefined, t),
  intensityScale: blendNumber(from.intensityScale, 0, t) ?? 0,
});

export const applyLightingEnter = (to: SceneLighting, t: number): SceneLighting => ({
  ...to,
  ambient: {
    intensity: blendNumber(0, to.ambient.intensity, t) ?? to.ambient.intensity,
    color: to.ambient.color,
  },
  directional: {
    ...to.directional,
    intensity: blendNumber(0, to.directional.intensity, t) ?? to.directional.intensity,
  },
  points: blendLightArray(undefined, to.points, t),
  spots: blendSpots(undefined, to.spots, t),
  panels: blendPanels(undefined, to.panels, t),
  intensityScale: blendNumber(0, to.intensityScale, t) ?? to.intensityScale,
});

export const applyLightingInterpolate = (from: SceneLighting, to: SceneLighting, t: number): SceneLighting => ({
  ...from,
  ...to,
  ambient: {
    intensity: blendNumber(from.ambient.intensity, to.ambient.intensity, t) ?? to.ambient.intensity,
    color: blendColor(from.ambient.color, to.ambient.color, t) ?? to.ambient.color,
  },
  directional: {
    intensity: blendNumber(from.directional.intensity, to.directional.intensity, t) ?? to.directional.intensity,
    color: blendColor(from.directional.color, to.directional.color, t) ?? to.directional.color,
    position: blendVec3(from.directional.position, to.directional.position, t) ?? to.directional.position,
  },
  points: blendLightArray(from.points, to.points, t) ?? to.points,
  spots: blendSpots(from.spots, to.spots, t) ?? to.spots,
  panels: blendPanels(from.panels, to.panels, t) ?? to.panels,
  intensityScale: blendNumber(from.intensityScale, to.intensityScale, t) ?? to.intensityScale,
  color: blendColor(from.color, to.color, t) ?? to.color,
});

export const lightingTransitionSpec: ElementTransitionSpec<SceneLighting> = {
  exit: (frames, widgetId, fromState) => {
    for (let i = 0; i < frames.length; i++) {
      const t = transitionT(i, frames.length);
      frames[i]!.state.widgets[widgetId] = applyLightingExit(fromState, t);
    }
  },
  enter: (frames, widgetId, toState) => {
    for (let i = 0; i < frames.length; i++) {
      const t = transitionT(i, frames.length);
      frames[i]!.state.widgets[widgetId] = applyLightingEnter(toState, t);
    }
  },
  interpolate: (frames, widgetId, fromState, toState) => {
    for (let i = 0; i < frames.length; i++) {
      const t = transitionT(i, frames.length);
      frames[i]!.state.widgets[widgetId] = applyLightingInterpolate(fromState, toState, t);
    }
  },
};
