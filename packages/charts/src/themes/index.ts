// Chart theme presets — re-exports only.
export { darkGlassChartTheme }    from './darkGlass';
export { midnightChartTheme }     from './midnight';
export { neonCyberChartTheme }    from './neonCyber';
export { enterpriseChartTheme }   from './enterprise';
export { lightCanvasChartTheme }  from './lightCanvas';
export { lightMinimalChartTheme } from './lightMinimal';
export { darkGlassLightChartTheme }    from './darkGlassLight';
export { midnightLightChartTheme }     from './midnightLight';
export { neonCyberLightChartTheme }    from './neonCyberLight';
export { enterpriseLightChartTheme }   from './enterpriseLight';
export { lightCanvasDarkChartTheme }   from './lightCanvasDark';
export { lightMinimalDarkChartTheme }  from './lightMinimalDark';
export { createChartTheme }       from './createChartTheme';
export type { ChartThemeOverrides } from './createChartTheme';
export type {
  ChartTheme,
  ChartThemeName,
  ChartSeriesMaterialTokens,
  ChartAxisTokens,
  ChartBackgroundTokens,
  ChartLegendTokens,
  ChartPieTokens,
  ChartInteractionTokens,
} from './types';

import { darkGlassChartTheme }    from './darkGlass';
import { midnightChartTheme }     from './midnight';
import { neonCyberChartTheme }    from './neonCyber';
import { enterpriseChartTheme }   from './enterprise';
import { lightCanvasChartTheme }  from './lightCanvas';
import { lightMinimalChartTheme } from './lightMinimal';
import { darkGlassLightChartTheme }    from './darkGlassLight';
import { midnightLightChartTheme }     from './midnightLight';
import { neonCyberLightChartTheme }    from './neonCyberLight';
import { enterpriseLightChartTheme }   from './enterpriseLight';
import { lightCanvasDarkChartTheme }   from './lightCanvasDark';
import { lightMinimalDarkChartTheme }  from './lightMinimalDark';

import type { ChartThemeName, ChartTheme } from './types';
import type { ThemeFamily } from '@brewsite/core';
import { SCENE_THEME_PAIRS } from '@brewsite/core';

/** All built-in preset themes, keyed by name. Unchanged from pre-overhaul. */
export const CHART_THEMES: Record<ChartThemeName, ChartTheme> = {
  darkGlass:    darkGlassChartTheme,
  midnight:     midnightChartTheme,
  neonCyber:    neonCyberChartTheme,
  enterprise:   enterpriseChartTheme,
  lightCanvas:  lightCanvasChartTheme,
  lightMinimal: lightMinimalChartTheme,
} as const;

/** Pair type for CHART_THEME_PAIRS entries. */
export type ChartThemePair = {
  readonly dark: ChartTheme;
  readonly light: ChartTheme;
};

// Internal pair entries — spread preset + inject pre-wired sceneTheme.
const _darkGlassDark: ChartTheme    = { ...darkGlassChartTheme,    sceneTheme: SCENE_THEME_PAIRS.darkGlass.dark };
const _darkGlassLight: ChartTheme   = { ...darkGlassLightChartTheme, sceneTheme: SCENE_THEME_PAIRS.darkGlass.light };
const _midnightDark: ChartTheme     = { ...midnightChartTheme,     sceneTheme: SCENE_THEME_PAIRS.midnight.dark };
const _midnightLight: ChartTheme    = { ...midnightLightChartTheme, sceneTheme: SCENE_THEME_PAIRS.midnight.light };
const _neonCyberDark: ChartTheme    = { ...neonCyberChartTheme,    sceneTheme: SCENE_THEME_PAIRS.neonCyber.dark };
const _neonCyberLight: ChartTheme   = { ...neonCyberLightChartTheme, sceneTheme: SCENE_THEME_PAIRS.neonCyber.light };
const _enterpriseDark: ChartTheme   = { ...enterpriseChartTheme,   sceneTheme: SCENE_THEME_PAIRS.enterprise.dark };
const _enterpriseLight: ChartTheme  = { ...enterpriseLightChartTheme, sceneTheme: SCENE_THEME_PAIRS.enterprise.light };
const _lightCanvasDark: ChartTheme  = { ...lightCanvasDarkChartTheme, sceneTheme: SCENE_THEME_PAIRS.lightCanvas.dark };
const _lightCanvasLight: ChartTheme = { ...lightCanvasChartTheme,  sceneTheme: SCENE_THEME_PAIRS.lightCanvas.light };
const _lightMinimalDark: ChartTheme = { ...lightMinimalDarkChartTheme, sceneTheme: SCENE_THEME_PAIRS.lightMinimal.dark };
const _lightMinimalLight: ChartTheme= { ...lightMinimalChartTheme, sceneTheme: SCENE_THEME_PAIRS.lightMinimal.light };

/**
 * Registry of ChartTheme presets keyed by ThemeFamily and ThemePolarity.
 * Each entry has `sceneTheme` pre-wired from SCENE_THEME_PAIRS — no manual wiring needed.
 *
 * Usage:
 * ```ts
 * const chartTheme = CHART_THEME_PAIRS['lightCanvas']['dark']; // ChartTheme with sceneTheme set
 * ```
 */
export const CHART_THEME_PAIRS: Record<ThemeFamily, ChartThemePair> = {
  darkGlass:    { dark: _darkGlassDark,    light: _darkGlassLight },
  midnight:     { dark: _midnightDark,     light: _midnightLight },
  neonCyber:    { dark: _neonCyberDark,    light: _neonCyberLight },
  enterprise:   { dark: _enterpriseDark,   light: _enterpriseLight },
  lightCanvas:  { dark: _lightCanvasDark,  light: _lightCanvasLight },
  lightMinimal: { dark: _lightMinimalDark, light: _lightMinimalLight },
} as const;
