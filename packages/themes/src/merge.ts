// mergeThemeBundle — produces a new ThemeBundle by merging deep-partial overrides.

import type { ThemeBundle } from './types';
import { mergeTheme } from '@brewsite/diagram';
import { createChartTheme } from '@brewsite/charts';
import type { SceneTheme } from '@brewsite/core';
import type { DiagramTheme } from '@brewsite/diagram';
import type { ChartTheme, ChartThemeOverrides } from '@brewsite/charts';

type DeepPartial<T> = T extends object
  ? { [P in keyof T]?: DeepPartial<T[P]> }
  : T;

/**
 * Deep-partial overrides for each slice of a ThemeBundle.
 * Each slice (scene, diagram, chart) can be independently overridden
 * for dark and/or light polarities.
 */
export type ThemeBundleOverrides = {
  readonly scene?: {
    readonly dark?: DeepPartial<SceneTheme>;
    readonly light?: DeepPartial<SceneTheme>;
  };
  readonly diagram?: {
    readonly dark?: DeepPartial<DiagramTheme>;
    readonly light?: DeepPartial<DiagramTheme>;
  };
  readonly chart?: {
    readonly dark?: Partial<ChartThemeOverrides>;
    readonly light?: Partial<ChartThemeOverrides>;
  };
};

/**
 * Produces a new ThemeBundle by merging overrides onto a base bundle.
 * All three slices (scene, diagram, chart) can be independently overridden
 * for dark and/or light polarities. The base bundle is not mutated.
 *
 * @example
 * const brandBundle = mergeThemeBundle(bundles.darkGlass, {
 *   scene: {
 *     dark: { background: { fill: { kind: 'color', value: '#0d0d1a' } } },
 *   },
 *   diagram: {
 *     dark: { node: { defaultColor: '#1a1030' } },
 *   },
 * });
 */
export function mergeThemeBundle(
  base: ThemeBundle,
  overrides: ThemeBundleOverrides = {},
): ThemeBundle {
  const sceneDark: SceneTheme  = overrides.scene?.dark
    ? deepMergeSceneTheme(base.scene.dark, overrides.scene.dark)
    : base.scene.dark;
  const sceneLight: SceneTheme = overrides.scene?.light
    ? deepMergeSceneTheme(base.scene.light, overrides.scene.light)
    : base.scene.light;

  const diagramDark: DiagramTheme  = overrides.diagram?.dark
    ? mergeTheme(base.diagram.dark,  overrides.diagram.dark  as Parameters<typeof mergeTheme>[1])
    : base.diagram.dark;
  const diagramLight: DiagramTheme = overrides.diagram?.light
    ? mergeTheme(base.diagram.light, overrides.diagram.light as Parameters<typeof mergeTheme>[1])
    : base.diagram.light;

  const chartDark: ChartTheme  = overrides.chart?.dark
    ? createChartTheme(base.chart.dark,  overrides.chart.dark)
    : base.chart.dark;
  const chartLight: ChartTheme = overrides.chart?.light
    ? createChartTheme(base.chart.light, overrides.chart.light)
    : base.chart.light;

  return {
    family: base.family,
    scene:   { dark: sceneDark,   light: sceneLight },
    diagram: { dark: diagramDark, light: diagramLight },
    chart:   { dark: chartDark,   light: chartLight },
  };
}

// Simple deep-merge for SceneTheme (plain object, no arrays that need special handling)
function deepMergeSceneTheme(base: SceneTheme, overrides: DeepPartial<SceneTheme>): SceneTheme {
  return deepMerge(base, overrides) as SceneTheme;
}

function deepMerge<T extends object>(base: T, overrides: DeepPartial<T>): T {
  const result = { ...base } as Record<string, unknown>;
  for (const key of Object.keys(overrides)) {
    const val = (overrides as Record<string, unknown>)[key];
    if (val === undefined) continue;
    const baseVal = (base as Record<string, unknown>)[key];
    if (
      val !== null &&
      typeof val === 'object' &&
      !Array.isArray(val) &&
      baseVal !== null &&
      typeof baseVal === 'object' &&
      !Array.isArray(baseVal)
    ) {
      result[key] = deepMerge(baseVal as object, val as DeepPartial<object>);
    } else {
      result[key] = val;
    }
  }
  return result as T;
}
