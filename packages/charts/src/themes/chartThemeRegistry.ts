// Internal registry for ChartTheme presets keyed by theme family name.
// The 'default' and 'enterprise' pairs are pre-loaded at module init.
// Other families are registered by @brewsite/themes at app startup.

import type { ChartTheme } from './types';
import { enterpriseChartTheme } from './enterprise';
import { enterpriseLightChartTheme } from './enterpriseLight';

/** A light+dark pair of ChartTheme presets for a single theme family. */
export type ChartThemePairEntry = { dark: ChartTheme; light: ChartTheme };

const registry = new Map<string, ChartThemePairEntry>();

// Pre-load 'default' and 'enterprise' from the enterprise aesthetic.
registry.set('default',    { dark: enterpriseChartTheme, light: enterpriseLightChartTheme });
registry.set('enterprise', { dark: enterpriseChartTheme, light: enterpriseLightChartTheme });

/**
 * Registers a ChartTheme pair under the given family name.
 * Called by @brewsite/themes at app startup to populate the registry
 * beyond the built-in 'default' pair.
 */
export function registerChartThemePair(
  family: string,
  pair: ChartThemePairEntry,
): void {
  registry.set(family, pair);
}

/**
 * Resolves the ChartTheme for the given family and polarity.
 * Falls back to the 'default' pair if the requested family is not registered.
 */
export function resolveChartTheme(
  family: string,
  polarity: 'dark' | 'light',
): ChartTheme {
  const pair = registry.get(family) ?? registry.get('default')!;
  return pair[polarity];
}

/**
 * Resolves a ChartThemeName string or ChartTheme object to a concrete ChartTheme.
 * When given a string family name, resolves the dark polarity from the registry.
 * Falls back to the 'default' dark theme for unknown string names.
 *
 * Use this when the caller has a `ChartThemeName | ChartTheme` union and needs
 * a concrete theme object (e.g., inside ChartWidget.apply and ChartRenderer).
 */
export function resolveChartThemeValue(theme: string | ChartTheme): ChartTheme {
  if (typeof theme === 'object') return theme;
  return resolveChartTheme(theme, 'dark');
}

/**
 * Resets the registry to its initial state (only 'default' and 'enterprise' pre-loaded).
 * For use in tests only — never call in production code.
 * @internal
 */
export function _resetChartThemeRegistryForTesting(): void {
  registry.clear();
  registry.set('default',    { dark: enterpriseChartTheme, light: enterpriseLightChartTheme });
  registry.set('enterprise', { dark: enterpriseChartTheme, light: enterpriseLightChartTheme });
}
