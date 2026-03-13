// Internal registry for ChartTheme presets keyed by ThemeFamily.
// The 'default' pair is pre-loaded at module init from the enterprise preset.
// Other families are registered by @brewsite/themes at app startup.

import type { ThemeFamily } from '@brewsite/core';
import type { ChartTheme } from './types';
import { enterpriseChartTheme } from './enterprise';
import { enterpriseLightChartTheme } from './enterpriseLight';

/** A dark/light pair of ChartTheme presets for a single ThemeFamily. */
type ChartThemePair = { dark: ChartTheme; light: ChartTheme };

const registry = new Map<ThemeFamily, ChartThemePair>();

// Pre-load 'default' from the enterprise aesthetic.
registry.set('default', {
  dark: enterpriseChartTheme,
  light: enterpriseLightChartTheme,
});

/**
 * Registers a dark/light ChartTheme pair for a given ThemeFamily.
 * Called by @brewsite/themes at app startup to make bundled presets available.
 */
export function registerChartThemePair(
  family: ThemeFamily,
  pair: ChartThemePair,
): void {
  registry.set(family, pair);
}

/**
 * Resolves a ChartTheme for the given ThemeFamily and polarity.
 * Falls back to the 'default' pair if the family has not been registered.
 */
export function resolveChartTheme(
  family: ThemeFamily,
  polarity: 'dark' | 'light',
): ChartTheme {
  const pair = registry.get(family) ?? registry.get('default')!;
  return pair[polarity];
}

/**
 * Resets the registry to its initial state (only 'default' pre-loaded).
 * For use in tests only — never call in production code.
 * @internal
 */
export function _resetChartThemeRegistryForTesting(): void {
  registry.clear();
  registry.set('default', {
    dark: enterpriseChartTheme,
    light: enterpriseLightChartTheme,
  });
}
