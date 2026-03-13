// Chart theme module — re-exports the default preset and registry utilities.
// Named presets (darkGlass, midnight, etc.) live in @brewsite/themes.

export { enterpriseChartTheme, defaultChartTheme } from './enterprise';
export { enterpriseLightChartTheme, defaultLightChartTheme } from './enterpriseLight';
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

export {
  registerChartThemePair,
  resolveChartTheme,
  _resetChartThemeRegistryForTesting,
} from './chartThemeRegistry';
export type { ChartThemePairEntry } from './chartThemeRegistry';

import { enterpriseChartTheme } from './enterprise';
import type { ChartThemeName, ChartTheme } from './types';

/**
 * Built-in preset themes keyed by canonical name.
 * Only 'default' and 'enterprise' are available in @brewsite/charts.
 * Named families (darkGlass, midnight, etc.) are registered via @brewsite/themes.
 */
export const CHART_THEMES: Partial<Record<ChartThemeName, ChartTheme>> = {
  enterprise: enterpriseChartTheme,
} as const;

/** @deprecated Use registerChartThemePair / resolveChartTheme instead. */
export type ChartThemePair = {
  readonly dark: ChartTheme;
  readonly light: ChartTheme;
};
