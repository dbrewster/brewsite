// DEBT: This file should be split into types-only, blend helpers, and math primitives
import type { SceneTrackTick, TransitionWindow } from '../sceneTrackTypes';
import { clamp01 as _clamp01, lerp as _lerp, lerpVec3 as _lerpVec3 } from '../../math';

// Compiler transition contract — batch-fill model.
// The compiler calls exactly one method per widget per transition block.
// The widget writes frame.state.widgets[widgetId] for every frame in its slice.

/**
 * Computes the normalized progress scalar for frame i within a slice of length len.
 * Use this inside enter/exit/interpolate loops.
 * Returns 1 when len === 1 (single-frame edge case).
 */
export const transitionT = (i: number, len: number): number => (len > 1 ? i / (len - 1) : 1);

export type ElementTransitionSpec<T> = {
  /**
   * Widget is leaving (present in scene N, absent from scene N+1).
   * frames is the first half of the transition block.
   * Write frames[i].state.widgets[widgetId] for every i in [0, frames.length).
   * Use transitionT(i, frames.length) for normalized 0→1 progress.
   */
  exit: (frames: SceneTrackTick[], widgetId: string, fromState: T) => void;

  /**
   * Widget is arriving (absent from scene N, present in scene N+1).
   * frames is the second half of the transition block.
   * Write frames[i].state.widgets[widgetId] for every i in [0, frames.length).
   * Use transitionT(i, frames.length) for normalized 0→1 progress.
   */
  enter: (frames: SceneTrackTick[], widgetId: string, toState: T) => void;

  /**
   * Widget is present in both scenes.
   * frames is the full transition block.
   * Write frames[i].state.widgets[widgetId] for every i in [0, frames.length).
   * Use transitionT(i, frames.length) for normalized 0→1 progress.
   */
  interpolate: (frames: SceneTrackTick[], widgetId: string, fromState: T, toState: T) => void;
};

// ====================
// Transition Control Types
// ====================

/**
 * A pure easing function that maps t ∈ [0, 1] → [0, 1].
 * Must satisfy f(0) = 0 and f(1) = 1.
 */
export type EaseFn = (t: number) => number;

/**
 * A single transition phase configuration (exit or enter window + easing).
 * The window defines the active sub-range within the block's [0, 1] progress.
 * bp is normalized within the window before easing is applied.
 */
export type TransitionPhase = {
  /** Active sub-window within block progress. bp is clamped to this range then normalized to [0,1]. */
  window?: [number, number];
  /** Easing applied after window normalization. */
  ease?: EaseFn;
};

/**
 * Per-channel transition group compiled from <Transition> DSL children.
 * A group without channels is the "default group" — applies to all channels
 * not claimed by a named group. First default group wins.
 * Named channel groups override the default for their specific properties.
 */
export type CompiledTransitionGroup = {
  /** Channel names this group controls. Absent = default group (applies to all unclaimed channels). */
  channels?: string[];
  /** Exit phase config for this group's channels. */
  exit?: TransitionPhase;
  /** Enter phase config for this group's channels. */
  enter?: TransitionPhase;
  /** Interpolate phase config. Only ease is supported for interpolate (no window). */
  interpolate?: Pick<TransitionPhase, 'ease'>;
};

/**
 * Mixin added to compiled widget state when <Transition> DSL children are present.
 * Contains EaseFn closures — not structuredClone-safe; must be stripped before cloning.
 */
export type WithTransitionConfig = {
  __transitionGroups?: CompiledTransitionGroup[];
};

/**
 * Runtime context passed to FunctionalTransitionSpec closures.
 * Provides per-channel normalized progress and the raw block progress.
 *
 * ctx.t  — normalized progress for the default group (window + ease applied).
 *           Equivalent to the old scalar t parameter.
 * ctx.bp — raw blockProgress ∈ [0, 1] before any window normalization.
 * ctx.channel(name) — normalized progress for the named channel's group.
 *                     Falls back to ctx.t if no group claims this channel.
 */
export interface TransitionContext {
  /** Default normalized progress, [0,1]. Derived from the default group's window + ease. */
  readonly t: number;
  /** Raw block progress, [0,1], as passed by the compiler wrapper. */
  readonly bp: number;
  /**
   * Returns normalized progress for a named property channel.
   * Uses the CompiledTransitionGroup that claims this channel name.
   * Falls back to ctx.t if no group claims this channel.
   */
  channel(name: string): number;
}

/**
 * Functional transition spec — closure-based alternative to ElementTransitionSpec.
 *
 * The compiler calls these once at compile time with the known endpoint states,
 * capturing them into closures. Each closure is stored in SceneTrack.transitionBlocks
 * and evaluated by the runtime at tick.blockProgress each frame.
 *
 * TransitionContext semantics (analogous to the old scalar t):
 *   exitFn:        ctx.t = 0 → widget at fromState.  ctx.t = 1 → widget fully absent.
 *   enterFn:       ctx.t = 0 → widget fully absent.  ctx.t = 1 → widget at toState.
 *   interpolateFn: ctx.t = 0 → widget at fromState.  ctx.t = 1 → widget at toState.
 *
 * Window/ease semantics are handled by makeResolver in transitionResolver.ts.
 * Widget authors write closures that expect ctx.t ∈ [0, 1] only.
 * Use ctx.channel('channelName') for per-property control when <Transition> children are present.
 */
export type FunctionalTransitionSpec<T> = {
  /**
   * Widget is leaving (present in scene N, absent from N+1).
   * Called once with fromState. Returns a closure accepting TransitionContext.
   * Active over the exit window of the block.
   */
  exitFn: (fromState: T) => (ctx: TransitionContext) => T;

  /**
   * Widget is arriving (absent from scene N, present in scene N+1).
   * Called once with toState. Returns a closure accepting TransitionContext.
   * Active over the enter window of the block.
   */
  enterFn: (toState: T) => (ctx: TransitionContext) => T;

  /**
   * Widget present in both scenes.
   * Called once with (fromState, toState). Returns a closure accepting TransitionContext.
   * Active over the full block (blockProgress ∈ [0, 1]).
   */
  interpolateFn: (fromState: T, toState: T) => (ctx: TransitionContext) => T;

  /**
   * Optional default window spec for this widget type.
   * Overridden by scene-level transition config on <Scene transition={...}>.
   * When absent, compiler-level system defaults apply.
   */
  defaultWindow?: TransitionWindow;
};

/**
 * Type guard: returns true if spec is a FunctionalTransitionSpec.
 * Used by the compiler to branch between discrete fill and closure capture.
 */
export const isFunctionalSpec = <T>(
  spec: ElementTransitionSpec<T> | FunctionalTransitionSpec<T>,
): spec is FunctionalTransitionSpec<T> => 'interpolateFn' in spec;

// ====================
// Math Utilities — re-exported from canonical math module
// ====================

export { clamp01, lerp, lerpVec3 } from '../../math';
const clamp01 = _clamp01;
const lerp = _lerp;
const lerpVec3 = _lerpVec3;

// ====================
// Quaternion Utilities
// ====================

type Quaternion = { x: number; y: number; z: number; w: number };

const clampUnit = (value: number): number => Math.max(-1, Math.min(1, value));

const normalizeQuat = (q: Quaternion): Quaternion => {
  const len = Math.hypot(q.x, q.y, q.z, q.w) || 1;
  return { x: q.x / len, y: q.y / len, z: q.z / len, w: q.w / len };
};

const eulerToQuaternionXYZ = (x: number, y: number, z: number): Quaternion => {
  const hx = x * 0.5;
  const hy = y * 0.5;
  const hz = z * 0.5;
  const sx = Math.sin(hx);
  const cx = Math.cos(hx);
  const sy = Math.sin(hy);
  const cy = Math.cos(hy);
  const sz = Math.sin(hz);
  const cz = Math.cos(hz);

  return {
    x: sx * cy * cz - cx * sy * sz,
    y: cx * sy * cz + sx * cy * sz,
    z: cx * cy * sz - sx * sy * cz,
    w: cx * cy * cz + sx * sy * sz,
  };
};

const quaternionToEulerXYZ = (q: Quaternion): [number, number, number] => {
  const qq = normalizeQuat(q);
  const sinrCosp = 2 * (qq.w * qq.x + qq.y * qq.z);
  const cosrCosp = 1 - 2 * (qq.x * qq.x + qq.y * qq.y);
  const x = Math.atan2(sinrCosp, cosrCosp);

  const sinp = 2 * (qq.w * qq.y - qq.z * qq.x);
  const y = Math.asin(clampUnit(sinp));

  const sinyCosp = 2 * (qq.w * qq.z + qq.x * qq.y);
  const cosyCosp = 1 - 2 * (qq.y * qq.y + qq.z * qq.z);
  const z = Math.atan2(sinyCosp, cosyCosp);

  return [x, y, z];
};

const slerpQuat = (from: Quaternion, to: Quaternion, t: number): Quaternion => {
  let cosHalfTheta = from.x * to.x + from.y * to.y + from.z * to.z + from.w * to.w;
  let toQ = to;
  if (cosHalfTheta < 0) {
    cosHalfTheta = -cosHalfTheta;
    toQ = { x: -to.x, y: -to.y, z: -to.z, w: -to.w };
  }

  if (cosHalfTheta > 0.9995) {
    return normalizeQuat({
      x: lerp(from.x, toQ.x, t),
      y: lerp(from.y, toQ.y, t),
      z: lerp(from.z, toQ.z, t),
      w: lerp(from.w, toQ.w, t),
    });
  }

  const halfTheta = Math.acos(cosHalfTheta);
  const sinHalfTheta = Math.sqrt(1 - cosHalfTheta * cosHalfTheta);
  const ratioA = Math.sin((1 - t) * halfTheta) / sinHalfTheta;
  const ratioB = Math.sin(t * halfTheta) / sinHalfTheta;
  return {
    x: from.x * ratioA + toQ.x * ratioB,
    y: from.y * ratioA + toQ.y * ratioB,
    z: from.z * ratioA + toQ.z * ratioB,
    w: from.w * ratioA + toQ.w * ratioB,
  };
};

// ====================
// Blend Functions
// ====================

/**
 * Blends two optional numbers with lerp.
 * If both are undefined, returns undefined.
 * If one is undefined, returns the other.
 * If both are defined, returns lerp(from, to, t).
 */
export const blendNumber = (from?: number, to?: number, t?: number): number | undefined => {
  if (typeof from !== 'number' && typeof to !== 'number') return undefined;
  if (typeof from !== 'number') return to;
  if (typeof to !== 'number') return from;
  return lerp(from, to, t ?? 0);
};

/**
 * Blends two optional distances.
 * Handles infinite distances by picking based on t threshold.
 */
export const blendDistance = (from?: number, to?: number, t?: number): number | undefined => {
  if (typeof from !== 'number' && typeof to !== 'number') return undefined;
  if (typeof from !== 'number') return to;
  if (typeof to !== 'number') return from;

  const fromFinite = Number.isFinite(from);
  const toFinite = Number.isFinite(to);

  if (fromFinite && toFinite) return lerp(from, to, t ?? 0);
  if (!fromFinite && !toFinite) return from;
  return (t ?? 0) < 0.5 ? from : to;
};

/**
 * Blends two optional opacities.
 * Treats undefined as 0.
 */
export const blendOpacity = (from?: number, to?: number, t?: number): number | undefined => {
  if (typeof from !== 'number' && typeof to !== 'number') return undefined;
  const safeFrom = typeof from === 'number' ? from : 0;
  const safeTo = typeof to === 'number' ? to : 0;
  return lerp(safeFrom, safeTo, t ?? 0);
};

/**
 * Blends two optional Vec3 values.
 */
export const blendVec3 = (
  from?: [number, number, number],
  to?: [number, number, number],
  t?: number,
): [number, number, number] | undefined => {
  if (!from && !to) return undefined;
  if (!from) return to;
  if (!to) return from;
  return lerpVec3(from, to, t ?? 0);
};

// ====================
// Color Blending
// ====================

const hexToRgb = (value?: string): { r: number; g: number; b: number } | null => {
  if (!value || !value.startsWith('#')) return null;

  const normalized =
    value.length === 4
      ? `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}`
      : value;

  const int = Number.parseInt(normalized.slice(1), 16);
  if (Number.isNaN(int)) return null;

  return {
    r: (int >> 16) & 255,
    g: (int >> 8) & 255,
    b: int & 255,
  };
};

const rgbToHex = (rgb: { r: number; g: number; b: number }): string =>
  `#${[rgb.r, rgb.g, rgb.b]
    .map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0'))
    .join('')}`;

/**
 * Blends two hex colors by interpolating RGB components.
 */
export const blendColor = (from?: string, to?: string, t?: number): string | undefined => {
  const a = hexToRgb(from);
  const b = hexToRgb(to);

  if (!a || !b || t === undefined) return to ?? from;

  return rgbToHex({
    r: lerp(a.r, b.r, t),
    g: lerp(a.g, b.g, t),
    b: lerp(a.b, b.b, t),
  });
};

// ====================
// Motion Blending
// ====================

/**
 * Blends two optional axis rotation specs.
 */
export const blendAxisRotation = (
  from?: { yawPct?: number; pitchPct?: number; rollPct?: number },
  to?: { yawPct?: number; pitchPct?: number; rollPct?: number },
  t?: number,
): { yawPct?: number; pitchPct?: number; rollPct?: number } | undefined => {
  if (!from && !to) return undefined;

  if (!from) return to;
  if (!to) return from;

  const hasYaw = typeof from.yawPct === 'number' || typeof to.yawPct === 'number';
  const hasPitch = typeof from.pitchPct === 'number' || typeof to.pitchPct === 'number';
  const hasRoll = typeof from.rollPct === 'number' || typeof to.rollPct === 'number';
  if (!hasYaw && !hasPitch && !hasRoll) return undefined;

  const fromEuler: [number, number, number] = [
    from.pitchPct ?? 0,
    from.yawPct ?? 0,
    from.rollPct ?? 0,
  ];
  const toEuler: [number, number, number] = [
    to.pitchPct ?? 0,
    to.yawPct ?? 0,
    to.rollPct ?? 0,
  ];
  const qFrom = eulerToQuaternionXYZ(fromEuler[0], fromEuler[1], fromEuler[2]);
  const qTo = eulerToQuaternionXYZ(toEuler[0], toEuler[1], toEuler[2]);
  const qBlend = slerpQuat(qFrom, qTo, t ?? 0);
  const [x, y, z] = quaternionToEulerXYZ(qBlend);

  return {
    ...(hasYaw ? { yawPct: y } : {}),
    ...(hasPitch ? { pitchPct: x } : {}),
    ...(hasRoll ? { rollPct: z } : {}),
  };
};

/**
 * Blends two optional axis translation specs.
 */
export const blendAxisTranslation = (
  from?: { xPct?: number; yPct?: number; zPct?: number },
  to?: { xPct?: number; yPct?: number; zPct?: number },
  t?: number,
): { xPct?: number; yPct?: number; zPct?: number } | undefined => {
  if (!from && !to) return undefined;

  return {
    xPct: blendNumber(from?.xPct, to?.xPct, t),
    yPct: blendNumber(from?.yPct, to?.yPct, t),
    zPct: blendNumber(from?.zPct, to?.zPct, t),
  };
};

// ====================
// CSS/Style Blending
// ====================

/**
 * Merges CSS with opacity.
 */
export const mergeCssOpacity = (
  css: Record<string, string | number> | undefined,
  opacity: number | undefined,
): Record<string, string | number> | undefined => {
  if (opacity === undefined) return css;
  return { ...(css ?? {}), opacity };
};

type StyleValue = string | number | boolean | Record<string, string | number | boolean> | undefined;

const isNumber = (value: StyleValue): value is number => typeof value === 'number' && Number.isFinite(value);

/**
 * Blends two style value objects by interpolating numbers and colors.
 * For missing keys in either object, uses the other object's value.
 */
export const blendStyleValues = <T extends Record<string, StyleValue>>(
  from: T | undefined,
  to: T | undefined,
  t: number,
): T | undefined => {
  if (!from && !to) return undefined;

  const fromValues = (from ?? {}) as Record<string, StyleValue>;
  const toValues = (to ?? {}) as Record<string, StyleValue>;
  const result: Record<string, StyleValue> = { ...fromValues, ...toValues };

  const keys = new Set([...Object.keys(fromValues), ...Object.keys(toValues)]);

  for (const key of keys) {
    const prev = fromValues[key];
    const next = toValues[key];

    if (isNumber(prev) && isNumber(next)) {
      result[key] = lerp(prev, next, t);
    } else if (
      typeof prev === 'string' &&
      typeof next === 'string' &&
      prev.startsWith('#') &&
      next.startsWith('#')
    ) {
      result[key] = blendColor(prev, next, t);
    }
  }

  return result as T;
};

/**
 * Like blendStyleValues but only includes keys that were in the target object.
 */
export const blendStyleValuesPartial = <T extends Record<string, StyleValue>>(
  from: T | undefined,
  to: T | undefined,
  t: number,
): T | undefined => {
  if (!from && !to) return undefined;

  const fromValues = (from ?? {}) as Record<string, StyleValue>;
  const toValues = (to ?? {}) as Record<string, StyleValue>;
  const result: Record<string, StyleValue> = {};

  const keys = new Set([...Object.keys(fromValues), ...Object.keys(toValues)]);

  for (const key of keys) {
    const prev = fromValues[key];
    const next = toValues[key];

    if (isNumber(prev) && isNumber(next)) {
      result[key] = lerp(prev, next, t);
    } else if (
      typeof prev === 'string' &&
      typeof next === 'string' &&
      prev.startsWith('#') &&
      next.startsWith('#')
    ) {
      result[key] = blendColor(prev, next, t);
    }
  }

  return result as T;
};

// ====================
// Opacity Resolution
// ====================

/**
 * Resolves opacity from explicit value or enabled state.
 */
export const resolveTransitionOpacity = (opacity?: number, enabled?: boolean): number => {
  if (typeof opacity === 'number') return opacity;
  if (enabled === false) return 0;
  return 1;
};

/**
 * Determines if something is enabled based on opacity value.
 */
export const resolveEnabledByOpacity = (opacity: number | undefined, fallback = true): boolean =>
  typeof opacity === 'number' ? opacity > 0 : fallback;
