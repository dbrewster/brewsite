// Pure helper for deep-partial theme overrides.

import type { DiagramTheme } from '../types';

/**
 * Utility type for deep-partial objects.
 * @internal — used by mergeTheme signature only.
 */
type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends ReadonlyArray<infer U>
    ? ReadonlyArray<U>
    : T[P] extends object
    ? DeepPartial<T[P]>
    : T[P];
};

/**
 * Produces a new DiagramTheme by merging `overrides` (deep-partial) onto `base`.
 * Nested objects are merged recursively. Arrays and primitives are replaced (not merged).
 * Neither `base` nor `overrides` is mutated.
 *
 * @example
 * const myTheme = mergeTheme(darkGlassTheme, {
 *   node: { defaultColor: '#2a1a40' },
 *   edge: { routing: 'orthogonal', defaultColor: '#ff6b35' },
 * });
 */
export function mergeTheme(base: DiagramTheme, overrides: DeepPartial<DiagramTheme>): DiagramTheme {
  return deepMerge(base, overrides) as DiagramTheme;
}

function deepMerge<T extends object>(base: T, overrides: DeepPartial<T>): T {
  const result = { ...base } as Record<string, unknown>;
  for (const key of Object.keys(overrides) as Array<keyof typeof overrides>) {
    const overrideVal = overrides[key];
    if (overrideVal === undefined) continue;
    const baseVal = base[key as keyof T];
    if (
      overrideVal !== null &&
      typeof overrideVal === 'object' &&
      !Array.isArray(overrideVal) &&
      baseVal !== null &&
      typeof baseVal === 'object' &&
      !Array.isArray(baseVal)
    ) {
      result[key as string] = deepMerge(
        baseVal as object,
        overrideVal as DeepPartial<typeof baseVal>,
      );
    } else {
      result[key as string] = overrideVal;
    }
  }
  return result as T;
}
