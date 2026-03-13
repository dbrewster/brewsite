// themesPlugin — WidgetPlugin that registers ThemeBundles into per-package registries.

import type { WidgetPlugin, WidgetRegistry, AssetManifest } from '@brewsite/core';
import { registerSceneThemePair } from '@brewsite/core';
import { registerDiagramThemePair } from '@brewsite/diagram';
import { registerChartThemePair } from '@brewsite/charts';
import type { ThemeBundle } from './types';

// All named bundles — imported so tree-shaking works when an explicit list is given.
import { enterpriseBundle }   from './bundles/enterprise';
import { darkGlassBundle }    from './bundles/darkGlass';
import { midnightBundle }     from './bundles/midnight';
import { neonCyberBundle }    from './bundles/neonCyber';
import { lightCanvasBundle }  from './bundles/lightCanvas';
import { lightMinimalBundle } from './bundles/lightMinimal';

const ALL_BUNDLES: ThemeBundle[] = [
  enterpriseBundle,
  darkGlassBundle,
  midnightBundle,
  neonCyberBundle,
  lightCanvasBundle,
  lightMinimalBundle,
];

function registerBundle(bundle: ThemeBundle): void {
  registerSceneThemePair(bundle.family, { dark: bundle.scene.dark, light: bundle.scene.light });
  registerDiagramThemePair(bundle.family, { dark: bundle.diagram.dark, light: bundle.diagram.light });
  registerChartThemePair(bundle.family, { dark: bundle.chart.dark, light: bundle.chart.light });
}

/**
 * WidgetPlugin that registers theme bundles into the per-package registries.
 *
 * @param bundles - Optional explicit list of ThemeBundle objects to register.
 *   When omitted, ALL six named family bundles are registered (enterprise, darkGlass,
 *   midnight, neonCyber, lightCanvas, lightMinimal). Pass an explicit array for bundle-size-
 *   conscious apps that only use one or two themes.
 *
 * @example
 * // Register all bundles (common case):
 * plugins={[corePlugin(), diagramPlugin({...}), themesPlugin()]}
 *
 * @example
 * // Register only darkGlass for a size-conscious deployment:
 * import { bundles } from '@brewsite/themes';
 * plugins={[corePlugin(), diagramPlugin({...}), themesPlugin([bundles.darkGlass])]}
 */
export function themesPlugin(bundles?: ThemeBundle[]): WidgetPlugin {
  const toRegister = bundles ?? ALL_BUNDLES;

  return {
    createWidgets(): [] {
      return [];
    },
    registerHandlers(): void {
      // No DSL handlers — themes are pure data.
    },
    configureRegistry(_registry: WidgetRegistry, _manifest: AssetManifest | null): void {
      for (const bundle of toRegister) {
        registerBundle(bundle);
      }
    },
  };
}
