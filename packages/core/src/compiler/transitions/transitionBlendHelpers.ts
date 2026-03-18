// Blend helper functions for interpolating widget state during transitions.
import type { MaterialApplication } from '../../widget/materialTypes';
import { lerp, lerpVec3, blendHexColors } from '../../math';
import { eulerToQuaternionXYZ, quaternionToEulerXYZ, slerpQuat } from './rotationMath';

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

/**
 * Blends two hex colors by interpolating RGB components.
 */
export const blendColor = (from?: string, to?: string, t?: number): string | undefined => {
  if (t === undefined) return to ?? from;
  return blendHexColors(from, to, t) ?? (to ?? from);
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
 * When includeAllKeys is true (default), all keys from both objects appear in the result.
 * When false, only blendable keys (numbers and colors present in both objects) appear.
 */
export const blendStyleValues = <T extends Record<string, StyleValue>>(
  from: T | undefined,
  to: T | undefined,
  t: number,
  includeAllKeys = true,
): T | undefined => {
  if (!from && !to) return undefined;

  const fromValues = (from ?? {}) as Record<string, StyleValue>;
  const toValues = (to ?? {}) as Record<string, StyleValue>;
  const result: Record<string, StyleValue> = includeAllKeys
    ? { ...fromValues, ...toValues }
    : {};

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
    } else if (!includeAllKeys && next !== undefined) {
      result[key] = next;
    }
  }

  return result as T;
};

/** Like blendStyleValues but only includes keys present in the target object. */
export const blendStyleValuesPartial = <T extends Record<string, StyleValue>>(
  from: T | undefined,
  to: T | undefined,
  t: number,
): T | undefined => blendStyleValues(from, to, t, false);

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

// ====================
// Material Application Blending
// ====================

/**
 * Blends two MaterialApplication objects at progress t.
 * Numeric fields lerp. String fields (tint) snap at t=0.5.
 * Undefined fields inherit from the target side.
 */
export const blendMaterialApplication = (
  from: MaterialApplication | undefined,
  to: MaterialApplication | undefined,
  t: number,
): MaterialApplication | undefined => {
  if (!from && !to) return undefined;
  if (!from) return to;
  if (!to) return from;

  return {
    colorMix: blendNumber(from.colorMix, to.colorMix, t),
    brightness: blendNumber(from.brightness, to.brightness, t),
    saturation: blendNumber(from.saturation, to.saturation, t),
    contrast: blendNumber(from.contrast, to.contrast, t),
    depthMix: blendNumber(from.depthMix, to.depthMix, t),
    roughnessMix: blendNumber(from.roughnessMix, to.roughnessMix, t),
    tint: blendColor(from.tint, to.tint, t),
    texScale: blendNumber(from.texScale, to.texScale, t),
    iridescence: blendNumber(from.iridescence, to.iridescence, t),
    iridescenceIOR: blendNumber(from.iridescenceIOR, to.iridescenceIOR, t),
    iridescenceThicknessRange:
      from.iridescenceThicknessRange && to.iridescenceThicknessRange
        ? [
            lerp(from.iridescenceThicknessRange[0], to.iridescenceThicknessRange[0], t),
            lerp(from.iridescenceThicknessRange[1], to.iridescenceThicknessRange[1], t),
          ] as const
        : from.iridescenceThicknessRange ?? to.iridescenceThicknessRange,
  };
};
