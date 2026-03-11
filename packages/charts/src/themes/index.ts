// Chart theme presets — re-exports only.
export { darkGlassChartTheme } from './darkGlass';
export { neonCyberChartTheme } from './neonCyber';
export { enterpriseChartTheme } from './enterprise';
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
import { neonCyberChartTheme } from './neonCyber';
import { enterpriseChartTheme } from './enterprise';
import { lightMinimalChartTheme } from './lightMinimal';

/** All built-in preset themes, keyed by name. Useful for dynamic theme switching. */
export const CHART_THEMES = {
  darkGlass: darkGlassChartTheme,
  neonCyber: neonCyberChartTheme,
  enterprise: enterpriseChartTheme,
  lightMinimal: lightMinimalChartTheme,
} as const;
