// ThemeBundle — the complete cross-package theme data for a single family.

import type { ThemeFamily, SceneTheme } from '@brewsite/core';
import type { DiagramTheme } from '@brewsite/diagram';
import type { ChartTheme } from '@brewsite/charts';

/**
 * The complete set of theme data across all packages for a single theme family.
 * Bundles a scene, diagram, and chart theme pair (dark + light) under one object.
 * Used by `themesPlugin` to register all families at app startup.
 */
export interface ThemeBundle {
  readonly family: ThemeFamily;
  readonly scene: {
    readonly dark: SceneTheme;
    readonly light: SceneTheme;
  };
  readonly diagram: {
    readonly dark: DiagramTheme;
    readonly light: DiagramTheme;
  };
  readonly chart: {
    readonly dark: ChartTheme;
    readonly light: ChartTheme;
  };
}
