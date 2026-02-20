export type TransitionContext = {
  tExit: number;
  tEnter: number;
  tFull: number;
  progress: number;
  exitStart: number;
  exitEnd: number;
  enterStart: number;
  enterEnd: number;
};

export type ElementTransitionSpec<T> = {
  exit: (from: T, context: TransitionContext) => T;
  enter: (to: T, context: TransitionContext) => T;
  interpolate: (from: T, to: T, context: TransitionContext) => T;
};

export const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export const lerpVec3 = (
  a: [number, number, number],
  b: [number, number, number],
  t: number,
) => [
  lerp(a[0], b[0], t),
  lerp(a[1], b[1], t),
  lerp(a[2], b[2], t),
] as [number, number, number];

export const blendNumber = (from?: number, to?: number, t?: number) => {
  if (typeof from !== 'number' && typeof to !== 'number') return undefined;
  if (typeof from !== 'number') return to;
  if (typeof to !== 'number') return from;
  return lerp(from, to, t ?? 0);
};

export const blendDistance = (from?: number, to?: number, t?: number) => {
  if (typeof from !== 'number' && typeof to !== 'number') return undefined;
  if (typeof from !== 'number') return to;
  if (typeof to !== 'number') return from;
  const fromFinite = Number.isFinite(from);
  const toFinite = Number.isFinite(to);
  if (fromFinite && toFinite) return lerp(from, to, t ?? 0);
  if (!fromFinite && !toFinite) return from;
  return (t ?? 0) < 0.5 ? from : to;
};

export const blendOpacity = (from?: number, to?: number, t?: number) => {
  if (typeof from !== 'number' && typeof to !== 'number') return undefined;
  const safeFrom = typeof from === 'number' ? from : 0;
  const safeTo = typeof to === 'number' ? to : 0;
  return lerp(safeFrom, safeTo, t ?? 0);
};

export const blendVec3 = (
  from?: [number, number, number],
  to?: [number, number, number],
  t?: number,
) => {
  if (!from && !to) return undefined;
  if (!from) return to;
  if (!to) return from;
  return lerpVec3(from, to, t ?? 0);
};

const hexToRgb = (value?: string) => {
  if (!value || !value.startsWith('#')) return null;
  const normalized = value.length === 4
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

const rgbToHex = (rgb: { r: number; g: number; b: number }) =>
  `#${[rgb.r, rgb.g, rgb.b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')}`;

export const blendColor = (from?: string, to?: string, t?: number) => {
  const a = hexToRgb(from);
  const b = hexToRgb(to);
  if (!a || !b || t === undefined) return to ?? from;
  return rgbToHex({
    r: lerp(a.r, b.r, t),
    g: lerp(a.g, b.g, t),
    b: lerp(a.b, b.b, t),
  });
};

export const blendAxisRotation = (
  from?: { yawPct?: number; pitchPct?: number; rollPct?: number },
  to?: { yawPct?: number; pitchPct?: number; rollPct?: number },
  t?: number,
) => {
  if (!from && !to) return undefined;
  return {
    yawPct: blendNumber(from?.yawPct, to?.yawPct, t),
    pitchPct: blendNumber(from?.pitchPct, to?.pitchPct, t),
    rollPct: blendNumber(from?.rollPct, to?.rollPct, t),
  };
};

export const blendAxisTranslation = (
  from?: { xPct?: number; yPct?: number; zPct?: number },
  to?: { xPct?: number; yPct?: number; zPct?: number },
  t?: number,
) => {
  if (!from && !to) return undefined;
  return {
    xPct: blendNumber(from?.xPct, to?.xPct, t),
    yPct: blendNumber(from?.yPct, to?.yPct, t),
    zPct: blendNumber(from?.zPct, to?.zPct, t),
  };
};

export const mergeCssOpacity = (
  css: Record<string, string | number> | undefined,
  opacity: number | undefined,
) => {
  if (opacity === undefined) return css;
  return { ...(css ?? {}), opacity };
};

type StyleValue = string | number | boolean | Record<string, string | number | boolean> | undefined;

const isNumber = (value: StyleValue): value is number => typeof value === 'number' && Number.isFinite(value);

export const blendStyleValues = <T extends Record<string, StyleValue>>(
  from: T | undefined,
  to: T | undefined,
  t: number,
) => {
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
    } else if (typeof prev === 'string' && typeof next === 'string' && prev.startsWith('#') && next.startsWith('#')) {
      result[key] = blendColor(prev, next, t);
    }
  }
  return result as T;
};

export const blendStyleValuesPartial = <T extends Record<string, StyleValue>>(
  from: T | undefined,
  to: T | undefined,
  t: number,
) => {
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
    } else if (typeof prev === 'string' && typeof next === 'string' && prev.startsWith('#') && next.startsWith('#')) {
      result[key] = blendColor(prev, next, t);
    }
  }
  return result as T;
};

export const resolveTransitionOpacity = (opacity?: number, enabled?: boolean) => {
  if (typeof opacity === 'number') return opacity;
  if (enabled === false) return 0;
  return 1;
};

export const resolveEnabledByOpacity = (opacity: number | undefined, fallback = true) =>
  typeof opacity === 'number' ? opacity > 0 : fallback;
