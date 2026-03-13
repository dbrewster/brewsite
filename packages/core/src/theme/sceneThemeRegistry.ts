// Internal registry for SceneTheme presets keyed by theme family name.
// The 'default' and 'enterprise' pairs are pre-loaded at module init;
// other families are registered by @brewsite/themes at app startup.

import type { SceneTheme } from './types';
import { enterpriseSceneTheme, enterpriseLightSceneTheme } from './presets';

/** A light+dark pair of SceneTheme presets for a single theme family. */
type SceneThemePair = { dark: SceneTheme; light: SceneTheme };

const registry = new Map<string, SceneThemePair>();

// Pre-load 'default' and 'enterprise' using the enterprise aesthetic (no external dependency).
registry.set('default',    { dark: enterpriseSceneTheme, light: enterpriseLightSceneTheme });
registry.set('enterprise', { dark: enterpriseSceneTheme, light: enterpriseLightSceneTheme });

/**
 * Register a SceneTheme pair for a given theme family name.
 * Called by @brewsite/themes at app startup to populate the registry
 * beyond the built-in 'default' pair.
 */
export function registerSceneThemePair(
  family: string,
  pair: SceneThemePair,
): void {
  registry.set(family, pair);
}

/**
 * Resolve a SceneTheme for the given family and polarity.
 * Falls back to the 'default' pair if the requested family is not registered.
 */
export function resolveSceneTheme(
  family: string,
  polarity: 'dark' | 'light',
): SceneTheme {
  const pair = registry.get(family) ?? registry.get('default')!;
  return pair[polarity];
}

/**
 * Resolves the family name for a SceneTheme by reference equality lookup
 * across all registered pairs. Returns undefined for custom (non-registry) themes.
 * Used by EngineOverlayHost to derive CSS class names from the active theme.
 */
export function resolveSceneThemeFamilyByRef(theme: SceneTheme): string | undefined {
  for (const [family, pair] of registry) {
    if (pair.dark === theme || pair.light === theme) {
      return family;
    }
  }
  return undefined;
}

/**
 * Resets the registry to its initial state (only 'default' and 'enterprise' pre-loaded).
 * For use in tests only — never call in production code.
 * @internal
 */
export function _resetSceneThemeRegistryForTesting(): void {
  registry.clear();
  registry.set('default',    { dark: enterpriseSceneTheme, light: enterpriseLightSceneTheme });
  registry.set('enterprise', { dark: enterpriseSceneTheme, light: enterpriseLightSceneTheme });
}
