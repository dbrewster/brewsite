// React context for the active theme family + polarity key.
// Provides a single source of truth so chart/diagram/scene components can auto-resolve
// their package-specific theme without explicit props.

import { createContext, useContext } from 'react';
import type { ThemeFamily, ThemePolarity } from './types';

/**
 * The active theme key: a (family, polarity) pair that all packages can
 * resolve against their own THEME_PAIRS registries.
 */
export interface ThemeKey {
  readonly family: ThemeFamily;
  readonly polarity: ThemePolarity;
}

/**
 * React context carrying the player-level ThemeKey.
 * Default value is null (no key — widgets fall back to their own defaults).
 */
export const ThemeKeyContext = createContext<ThemeKey | null>(null);

/**
 * Returns the current ThemeKey from context, or null if none is provided.
 * Does NOT throw — ThemeKeyContext is purely opt-in.
 *
 * Usage in scene components:
 * ```tsx
 * const key = useThemeKey();
 * const chartTheme = key ? CHART_THEME_PAIRS[key.family][key.polarity] : fallback;
 * ```
 */
export const useThemeKey = (): ThemeKey | null => useContext(ThemeKeyContext);
