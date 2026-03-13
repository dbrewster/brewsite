// Internal registry for DiagramTheme presets keyed by ThemeFamily.
// The 'default' pair is pre-loaded at module init from the enterprise preset.
// Other families are registered by @brewsite/themes at app startup.

import type { ThemeFamily } from '@brewsite/core';
import type { DiagramTheme } from './types';
import { enterpriseTheme } from './themes/enterprise';
import { enterpriseLightTheme } from './themes/enterpriseLight';

/** A pair of DiagramTheme presets for dark and light polarities. */
export type DiagramThemePair = { dark: DiagramTheme; light: DiagramTheme };

const registry = new Map<ThemeFamily, DiagramThemePair>();

// Pre-load 'default' from the enterprise aesthetic.
registry.set('default', {
  dark: enterpriseTheme,
  light: enterpriseLightTheme,
});

/**
 * Registers a DiagramTheme pair under the given ThemeFamily.
 * Call this during app startup (before any scene compilation) to make
 * a theme family available to all diagram elements.
 */
export function registerDiagramThemePair(
  family: ThemeFamily,
  pair: DiagramThemePair,
): void {
  registry.set(family, pair);
}

/**
 * Resolves the DiagramTheme for the given family and polarity.
 * Falls back to 'default' if the family is not registered.
 */
export function resolveDiagramTheme(
  family: ThemeFamily,
  polarity: 'dark' | 'light',
): DiagramTheme {
  const pair = registry.get(family) ?? registry.get('default')!;
  return pair[polarity];
}

/**
 * Resets the registry to its initial state (only 'default' pre-loaded).
 * For use in tests only — never call in production code.
 * @internal
 */
export function _resetDiagramThemeRegistryForTesting(): void {
  registry.clear();
  registry.set('default', {
    dark: enterpriseTheme,
    light: enterpriseLightTheme,
  });
}
