/**
 * Lighting element compilation.
 */

import type { SceneLighting } from './types';
import type {
  ElementTransitionSpec,
  FunctionalTransitionSpec,
} from '../../compiler/transitions/transitionTypes';
import { blendColor, blendNumber, blendVec3, transitionT } from '../../compiler/transitions/transitionTypes';

const blendLightArray = <T extends { id?: string; intensity: number; color: string; position: [number, number, number] }>(
  from: T[] | undefined,
  to: T[] | undefined,
  t: number,
): T[] | undefined => {
  const fromMap = new Map<string, T>();
  const toMap = new Map<string, T>();
  for (let i = 0; i < (from?.length ?? 0); i += 1) {
    const prev = from?.[i];
    if (!prev) continue;
    fromMap.set(prev.id ?? `idx-${i}`, prev);
  }
  for (let i = 0; i < (to?.length ?? 0); i += 1) {
    const next = to?.[i];
    if (!next) continue;
    toMap.set(next.id ?? `idx-${i}`, next);
  }
  if (fromMap.size === 0 && toMap.size === 0) return undefined;
  const result: T[] = [];
  const ids = new Set<string>([...fromMap.keys(), ...toMap.keys()]);
  for (const id of ids) {
    const prev = fromMap.get(id);
    const next = toMap.get(id);
    if (!prev && !next) continue;
    if (prev && next) {
      result.push({
        ...next,
        id: next.id ?? prev.id ?? id,
        intensity: blendNumber(prev.intensity, next.intensity, t) ?? next.intensity,
        color: blendColor(prev.color, next.color, t) ?? next.color,
        position: blendVec3(prev.position ?? [0, 0, 0], next.position ?? [0, 0, 0], t) ?? next.position ?? prev.position,
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
  const fromMap = new Map<string, NonNullable<SceneLighting['spots']>[number]>();
  const toMap = new Map<string, NonNullable<SceneLighting['spots']>[number]>();
  for (let i = 0; i < (from?.length ?? 0); i += 1) {
    const prev = from?.[i];
    if (!prev) continue;
    fromMap.set(prev.id ?? `idx-${i}`, prev);
  }
  for (let i = 0; i < (to?.length ?? 0); i += 1) {
    const next = to?.[i];
    if (!next) continue;
    toMap.set(next.id ?? `idx-${i}`, next);
  }
  if (fromMap.size === 0 && toMap.size === 0) return undefined;
  const result: NonNullable<SceneLighting['spots']> = [];
  const ids = new Set<string>([...fromMap.keys(), ...toMap.keys()]);
  for (const id of ids) {
    const prev = fromMap.get(id);
    const next = toMap.get(id);
    if (!prev && !next) continue;
    if (prev && next) {
      result.push({
        ...next,
        id: next.id ?? prev.id ?? id,
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

const blendGlowPoint = (
  from: SceneLighting['glowPoint'],
  to: SceneLighting['glowPoint'],
  t: number,
): SceneLighting['glowPoint'] | undefined => {
  if (!from && !to) return undefined;
  if (from && to) {
    return {
      id: to.id ?? from.id,
      intensity: blendNumber(from.intensity, to.intensity, t) ?? to.intensity,
      color: blendColor(from.color, to.color, t) ?? to.color,
      position: blendVec3(from.position, to.position, t) ?? to.position,
      distance: blendNumber(from.distance, to.distance, t) ?? to.distance,
      decay: blendNumber(from.decay, to.decay, t) ?? to.decay,
    };
  }
  if (from) {
    return {
      ...from,
      intensity: blendNumber(from.intensity, 0, t) ?? 0,
    };
  }
  return {
    ...to!,
    intensity: blendNumber(0, to!.intensity, t) ?? to!.intensity,
  };
};

const blendLightStrands = (
  from: SceneLighting['lightStrands'],
  to: SceneLighting['lightStrands'],
  t: number,
) => {
  const blendShape = (
    prev: NonNullable<SceneLighting['lightStrands']>[number]['shape'],
    next: NonNullable<SceneLighting['lightStrands']>[number]['shape'],
  ): NonNullable<SceneLighting['lightStrands']>[number]['shape'] => {
    if (prev.kind === 'wave' && next.kind === 'wave') {
      const prevLength = prev.curve.length ?? prev.curve.width ?? 0;
      const nextLength = next.curve.length ?? next.curve.width ?? 0;
      return {
        kind: 'wave',
        curve: {
          length: blendNumber(prevLength, nextLength, t) ?? nextLength,
          width: next.curve.width,
          yOffset: blendNumber(prev.curve.yOffset, next.curve.yOffset, t) ?? next.curve.yOffset,
          z: blendNumber(prev.curve.z, next.curve.z, t) ?? next.curve.z,
          waveAmplitude: blendNumber(prev.curve.waveAmplitude, next.curve.waveAmplitude, t) ?? next.curve.waveAmplitude,
          waveFrequency: blendNumber(prev.curve.waveFrequency, next.curve.waveFrequency, t) ?? next.curve.waveFrequency,
          depthAmplitude: blendNumber(prev.curve.depthAmplitude, next.curve.depthAmplitude, t) ?? next.curve.depthAmplitude,
          depthFrequency: blendNumber(prev.curve.depthFrequency, next.curve.depthFrequency, t) ?? next.curve.depthFrequency,
          depthPhase: blendNumber(prev.curve.depthPhase, next.curve.depthPhase, t) ?? next.curve.depthPhase,
        },
      };
    }
    if (prev.kind === 'circle' && next.kind === 'circle') {
      return {
        kind: 'circle',
        radius: blendNumber(prev.radius, next.radius, t) ?? next.radius,
        axis: t < 0.5 ? prev.axis : next.axis,
        offset: blendVec3(prev.offset ?? [0, 0, 0], next.offset ?? [0, 0, 0], t) ?? next.offset ?? prev.offset,
      };
    }
    if (prev.kind === 'rectangle' && next.kind === 'rectangle') {
      return {
        kind: 'rectangle',
        width: blendNumber(prev.width, next.width, t) ?? next.width,
        height: blendNumber(prev.height, next.height, t) ?? next.height,
        axis: t < 0.5 ? prev.axis : next.axis,
        offset: blendVec3(prev.offset ?? [0, 0, 0], next.offset ?? [0, 0, 0], t) ?? next.offset ?? prev.offset,
      };
    }
    return t < 0.5 ? prev : next;
  };

  const max = Math.max(from?.length ?? 0, to?.length ?? 0);
  if (max === 0) return undefined;
  const result: NonNullable<SceneLighting['lightStrands']> = [];
  const byId = new Map<string, NonNullable<SceneLighting['lightStrands']>[number]>();
  for (const strand of to ?? []) {
    byId.set(strand.id, strand);
  }
  for (const prev of from ?? []) {
    const next = byId.get(prev.id);
    if (next) {
      result.push({
        ...prev,
        ...next,
        count: blendNumber(prev.count, next.count, t) ?? next.count,
        intensity: blendNumber(prev.intensity, next.intensity, t) ?? next.intensity,
        color: blendColor(prev.color, next.color, t) ?? next.color,
        position: blendVec3(prev.position ?? [0, 0, 0], next.position ?? [0, 0, 0], t) ?? next.position ?? prev.position,
        distance: blendNumber(prev.distance, next.distance, t) ?? next.distance,
        decay: blendNumber(prev.decay, next.decay, t) ?? next.decay,
        shape: blendShape(prev.shape, next.shape),
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
  lightStrands: [],
  points: [],
  spots: [],
  panels: [],
  intensityScale: 1,
  color: '#ffffff',
};

export const applyLightingExit = (from: SceneLighting, t: number): SceneLighting => ({
  ...from,
  ambient: {
    id: from.ambient.id,
    intensity: blendNumber(from.ambient.intensity, 0, t) ?? 0,
    color: from.ambient.color,
  },
  directional: {
    id: from.directional.id,
    ...from.directional,
    intensity: blendNumber(from.directional.intensity, 0, t) ?? 0,
  },
  glowPoint: blendGlowPoint(from.glowPoint, undefined, t),
  lightStrands: blendLightStrands(from.lightStrands, undefined, t),
  points: blendLightArray(from.points, undefined, t),
  spots: blendSpots(from.spots, undefined, t),
  panels: blendPanels(from.panels, undefined, t),
  intensityScale: blendNumber(from.intensityScale, 0, t) ?? 0,
});

export const applyLightingEnter = (to: SceneLighting, t: number): SceneLighting => ({
  ...to,
  ambient: {
    id: to.ambient.id,
    intensity: blendNumber(0, to.ambient.intensity, t) ?? to.ambient.intensity,
    color: to.ambient.color,
  },
  directional: {
    id: to.directional.id,
    ...to.directional,
    intensity: blendNumber(0, to.directional.intensity, t) ?? to.directional.intensity,
  },
  glowPoint: blendGlowPoint(undefined, to.glowPoint, t),
  lightStrands: blendLightStrands(undefined, to.lightStrands, t),
  points: blendLightArray(undefined, to.points, t),
  spots: blendSpots(undefined, to.spots, t),
  panels: blendPanels(undefined, to.panels, t),
  intensityScale: blendNumber(0, to.intensityScale, t) ?? to.intensityScale,
});

export const applyLightingInterpolate = (from: SceneLighting, to: SceneLighting, t: number): SceneLighting => ({
  ...from,
  ...to,
  ambient: {
    id: to.ambient.id ?? from.ambient.id,
    intensity: blendNumber(from.ambient.intensity, to.ambient.intensity, t) ?? to.ambient.intensity,
    color: blendColor(from.ambient.color, to.ambient.color, t) ?? to.ambient.color,
  },
  directional: {
    id: to.directional.id ?? from.directional.id,
    intensity: blendNumber(from.directional.intensity, to.directional.intensity, t) ?? to.directional.intensity,
    color: blendColor(from.directional.color, to.directional.color, t) ?? to.directional.color,
    position: blendVec3(from.directional.position, to.directional.position, t) ?? to.directional.position,
  },
  glowPoint: blendGlowPoint(from.glowPoint, to.glowPoint, t) ?? to.glowPoint,
  lightStrands: blendLightStrands(from.lightStrands, to.lightStrands, t) ?? to.lightStrands,
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

export const functionalLightingTransitionSpec: FunctionalTransitionSpec<SceneLighting> = {
  exitFn: (from) => (t) => applyLightingExit(from, t),
  enterFn: (to) => (t) => applyLightingEnter(to, t),
  interpolateFn: (from, to) => (t) => applyLightingInterpolate(from, to, t),
};
