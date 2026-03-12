// Convenience hook: resolves the current ChartTheme from ThemeKeyContext.
// Scene components use this to get the right chart theme without manual lookup.

import { useThemeKey } from '@brewsite/core';
import { CHART_THEME_PAIRS } from '../themes/index';
import type { ChartTheme } from '../themes/types';

/**
 * Returns the ChartTheme resolved from the current ThemeKeyContext
 * (set by `<SceneEngine themeFamily="..." themePolarity="...">`).
 *
 * Returns null when no ThemeKeyContext is provided — callers should fall back
 * to an explicit theme prop or a hardcoded default.
 *
 * @example
 * ```tsx
 * const chartTheme = useChartTheme();
 * return <BarChart theme={chartTheme ?? fallbackTheme} ... />;
 * ```
 */
export function useChartTheme(): ChartTheme | undefined {
  const key = useThemeKey();
  if (!key) return undefined;
  return CHART_THEME_PAIRS[key.family]?.[key.polarity] ?? undefined;
}
