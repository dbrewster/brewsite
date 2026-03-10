// Pure helpers for DiagramTheme composition: deep-partial merging and colorMode overrides.

import type { DiagramTheme } from '../types';
import type { SceneColorMode } from '@brewsite/core';

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
 *   edge: { routing: 'flow', defaultColor: '#ff6b35' },
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

/**
 * Creates a new DiagramTheme by overriding `node.defaultLabelColor` and
 * `node.defaultSublabelColor` with colorMode-appropriate defaults.
 *
 * Use this when you want `sceneTheme.colorMode` to drive diagram label colors
 * while using a built-in preset. All four built-in presets (darkGlass, enterprise,
 * neonCyber, lightMinimal) have explicit label colors, so sceneTheme.colorMode
 * alone has no effect on label colors when using a preset directly.
 *
 * This function does NOT set `sceneTheme` — consumers who also need webglFontUrl
 * inheritance must set `theme.sceneTheme` separately.
 *
 * @param base - The base DiagramTheme (typically a preset).
 * @param colorMode - The scene color mode that should drive label colors.
 * @returns A new DiagramTheme with colorMode-derived label colors. Does not mutate `base`.
 *
 * @example
 * const myTheme = withColorMode(darkGlassTheme, 'dark');
 * // myTheme.node.defaultLabelColor === '#e8eeff' (light text on dark background)
 *
 * @example
 * const myTheme = withColorMode(lightMinimalTheme, 'light');
 * // myTheme.node.defaultLabelColor === '#1a1a2e' (dark text on light background)
 */
export function withColorMode(base: DiagramTheme, colorMode: SceneColorMode): DiagramTheme {
  const isDark = colorMode === 'dark';
  return {
    ...base,
    node: {
      ...base.node,
      defaultLabelColor:    isDark ? '#e8eeff' : '#1a1a2e',
      defaultSublabelColor: isDark ? '#b8c0e0' : '#4a4a6e',
    },
    group: {
      ...base.group,
      defaultLabelColor: isDark ? '#e8eeff' : '#1a1a2e',
    },
  };
}
