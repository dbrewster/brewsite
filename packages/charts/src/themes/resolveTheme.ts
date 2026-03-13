// Utility for resolving ChartThemeName | ChartTheme → concrete ChartTheme.

import { darkGlassChartTheme }         from './darkGlass';
import { darkGlassLightChartTheme }    from './darkGlassLight';
import { midnightChartTheme }          from './midnight';
import { midnightLightChartTheme }     from './midnightLight';
import { neonCyberChartTheme }         from './neonCyber';
import { neonCyberLightChartTheme }    from './neonCyberLight';
import { enterpriseChartTheme }        from './enterprise';
import { enterpriseLightChartTheme }   from './enterpriseLight';
import { lightCanvasChartTheme }       from './lightCanvas';
import { lightCanvasDarkChartTheme }   from './lightCanvasDark';
import { lightMinimalChartTheme }      from './lightMinimal';
import { lightMinimalDarkChartTheme }  from './lightMinimalDark';
import type { ChartTheme, ChartThemeName } from './types';

// DEBT: Consolidate FULL_THEME_MAP, PRESET_MAP (createChartTheme.ts), and CHART_THEMES (index.ts) into single source
/** Complete map of all 12 built-in theme presets — used by resolveChartTheme(). */
const FULL_THEME_MAP: Record<string, ChartTheme> = {
  darkGlass:         darkGlassChartTheme,
  darkGlassLight:    darkGlassLightChartTheme,
  midnight:          midnightChartTheme,
  midnightLight:     midnightLightChartTheme,
  neonCyber:         neonCyberChartTheme,
  neonCyberLight:    neonCyberLightChartTheme,
  enterprise:        enterpriseChartTheme,
  enterpriseLight:   enterpriseLightChartTheme,
  lightCanvas:       lightCanvasChartTheme,
  lightCanvasDark:   lightCanvasDarkChartTheme,
  lightMinimal:      lightMinimalChartTheme,
  lightMinimalDark:  lightMinimalDarkChartTheme,
};

/**
 * Resolves a ChartThemeName string or ChartTheme object to a concrete ChartTheme.
 * Falls back to darkGlassChartTheme for unknown string names.
 */
export function resolveChartTheme(theme: ChartThemeName | ChartTheme): ChartTheme {
  if (typeof theme === 'object') return theme;
  return FULL_THEME_MAP[theme] ?? darkGlassChartTheme;
}
