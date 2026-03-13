// Internal registry for DiagramTheme presets keyed by theme family name.
// The 'default' and 'enterprise' pairs are pre-loaded at module init from the enterprise preset.
// Other families are registered by @brewsite/themes at app startup.

import type { DiagramTheme } from './types';
import { defaultDiagramTheme } from './themes/enterprise';
import { defaultLightDiagramTheme } from './themes/enterpriseLight';

/** A pair of DiagramTheme presets for dark and light polarities. */
export type DiagramThemePair = { dark: DiagramTheme; light: DiagramTheme };

const registry = new Map<string, DiagramThemePair>();

// Pre-load 'default' and 'enterprise' from the enterprise aesthetic.
registry.set('default',    { dark: defaultDiagramTheme, light: defaultLightDiagramTheme });
registry.set('enterprise', { dark: defaultDiagramTheme, light: defaultLightDiagramTheme });

/**
 * Registers a DiagramTheme pair under the given family name.
 * Call this during app startup (before any scene compilation) to make
 * a theme family available to all diagram elements.
 */
export function registerDiagramThemePair(
  family: string,
  pair: DiagramThemePair,
): void {
  registry.set(family, pair);
}

/**
 * Resolves the DiagramTheme for the given family and polarity.
 * Falls back to 'default' if the family is not registered.
 */
export function resolveDiagramTheme(
  family: string,
  polarity: 'dark' | 'light',
): DiagramTheme {
  const pair = registry.get(family) ?? registry.get('default')!;
  return pair[polarity];
}

/**
 * Resets the registry to its initial state (only 'default' and 'enterprise' pre-loaded).
 * For use in tests only — never call in production code.
 * @internal
 */
export function _resetDiagramThemeRegistryForTesting(): void {
  registry.clear();
  registry.set('default',    { dark: defaultDiagramTheme, light: defaultLightDiagramTheme });
  registry.set('enterprise', { dark: defaultDiagramTheme, light: defaultLightDiagramTheme });
}
