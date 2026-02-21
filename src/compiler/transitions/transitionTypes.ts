import type { SceneTrackTick } from '../sceneTrackTypes';

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
// Math Utilities
// ====================

export const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export const lerpVec3 = (
  a: [number, number, number],
  b: [number, number, number],
  t: number,
): [number, number, number] => [
  lerp(a[0], b[0], t),
  lerp(a[1], b[1], t),
  lerp(a[2], b[2], t),
];

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

  return {
    yawPct: blendNumber(from?.yawPct, to?.yawPct, t),
    pitchPct: blendNumber(from?.pitchPct, to?.pitchPct, t),
    rollPct: blendNumber(from?.rollPct, to?.rollPct, t),
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
