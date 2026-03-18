// Convenience hook: resolves the current ChartTheme from the active theme context.
// Scene components use this to get the right chart theme without manual lookup.

import { useTheme } from '@brewsite/core';
import { resolveChartTheme } from '../themes/chartThemeRegistry';
import type { ChartTheme } from '../themes/types';

/**
 * Returns the ChartTheme resolved from the current SceneTheme context
 * (set by `<SceneEngine theme={{ family: '...', polarity: '...' }}>`).
 *
 * Returns undefined when no theme context is provided — callers should fall back
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
  const sceneTheme = useTheme();
  if (!sceneTheme) return undefined;
  const polarity = sceneTheme.colorMode;
  // Resolve using the default family — SceneTheme does not carry a family name.
  return resolveChartTheme('default', polarity);
}
