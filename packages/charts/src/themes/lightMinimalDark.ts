// Light Minimal chart theme — dark-background variant (PLACEHOLDER).
// @internal Aesthetic placeholder — production design pending. Do not use in shipped scenes.

import type { ChartTheme } from './types';
import { darkGlassChartTheme } from './darkGlass';

/**
 * Dark-background placeholder variant of the lightMinimal chart theme family.
 * @internal Aesthetic placeholder — production design pending. Do not use in shipped scenes.
 */
export const lightMinimalDarkChartTheme: ChartTheme = {
  ...darkGlassChartTheme,
  name: 'lightMinimal-dark',
};
