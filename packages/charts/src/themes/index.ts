// Chart theme presets — re-exports only.
export { darkGlassChartTheme } from './darkGlass';
export { midnightChartTheme } from './midnight';
export { neonCyberChartTheme } from './neonCyber';
export { enterpriseChartTheme } from './enterprise';
export { lightCanvasChartTheme } from './lightCanvas';
export { lightMinimalChartTheme } from './lightMinimal';
export { createChartTheme } from './createChartTheme';
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

import { darkGlassChartTheme } from './darkGlass';
import { midnightChartTheme } from './midnight';
import { neonCyberChartTheme } from './neonCyber';
import { enterpriseChartTheme } from './enterprise';
import { lightCanvasChartTheme } from './lightCanvas';
import { lightMinimalChartTheme } from './lightMinimal';
import type { ChartThemeName } from './types';
import type { ChartTheme } from './types';

/** All built-in preset themes, keyed by name. Useful for dynamic theme switching. */
export const CHART_THEMES: Record<ChartThemeName, ChartTheme> = {
  darkGlass:    darkGlassChartTheme,
  midnight:     midnightChartTheme,
  neonCyber:    neonCyberChartTheme,
  enterprise:   enterpriseChartTheme,
  lightCanvas:  lightCanvasChartTheme,
  lightMinimal: lightMinimalChartTheme,
} as const;
