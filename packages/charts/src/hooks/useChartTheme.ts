// Convenience hook: resolves the current ChartTheme from ThemeKeyContext.
// Scene components use this to get the right chart theme without manual lookup.

import { useThemeKey } from '@brewsite/core';
import { resolveChartTheme } from '../themes/chartThemeRegistry';
import type { ChartTheme } from '../themes/types';

/**
 * Returns the ChartTheme resolved from the current ThemeKeyContext
 * (set by `<SceneEngine themeFamily="..." themePolarity="...">`).
 *
 * Returns undefined when no ThemeKeyContext is provided — callers should fall back
 * to an explicit theme prop or a hardcoded default.
 *
 * Named family presets (darkGlass, midnight, etc.) are available after
 * @brewsite/themes has registered them at app startup via themesPlugin().
 *
 * @example
 * ```tsx
 * const chartTheme = useChartTheme();
 * // chartTheme is now always a resolved ChartTheme object or undefined.
 * ```
 */
export function useChartTheme(): ChartTheme | undefined {
  const key = useThemeKey();
  if (!key) return undefined;
  return resolveChartTheme(key.family, key.polarity);
}
