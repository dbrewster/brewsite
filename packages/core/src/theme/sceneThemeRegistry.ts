// Internal registry for SceneTheme presets keyed by ThemeFamily.
// The 'default' pair is pre-loaded at module init; other families are
// registered by @brewsite/themes at app startup.

import type { SceneTheme, ThemeFamily } from './types';
import { enterpriseSceneTheme, enterpriseLightSceneTheme } from './presets';

/** A light+dark pair of SceneTheme presets for a single ThemeFamily. */
type SceneThemePair = { dark: SceneTheme; light: SceneTheme };

const registry = new Map<ThemeFamily, SceneThemePair>();

// Pre-load 'default' using the enterprise aesthetic (no external dependency).
registry.set('default', {
  dark: enterpriseSceneTheme,
  light: enterpriseLightSceneTheme,
});

/**
 * Register a SceneTheme pair for a given theme family.
 * Called by @brewsite/themes at app startup to populate the registry
 * beyond the built-in 'default' pair.
 */
export function registerSceneThemePair(
  family: ThemeFamily,
  pair: SceneThemePair,
): void {
  registry.set(family, pair);
}

/**
 * Resolve a SceneTheme for the given family and polarity.
 * Falls back to the 'default' pair if the requested family is not registered.
 */
export function resolveSceneTheme(
  family: ThemeFamily,
  polarity: 'dark' | 'light',
): SceneTheme {
  const pair = registry.get(family) ?? registry.get('default')!;
  return pair[polarity];
}

/**
 * Resets the registry to its initial state (only 'default' pre-loaded).
 * For use in tests only — never call in production code.
 * @internal
 */
export function _resetSceneThemeRegistryForTesting(): void {
  registry.clear();
  registry.set('default', {
    dark: enterpriseSceneTheme,
    light: enterpriseLightSceneTheme,
  });
}
