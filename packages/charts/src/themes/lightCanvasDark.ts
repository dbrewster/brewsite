// Light Canvas chart theme — dark-background variant (PLACEHOLDER).
// @internal Aesthetic placeholder — production design pending. Do not use in shipped scenes.

// SHARED ACCENT PALETTE — must match packages/diagram/src/elements/diagram/themes/lightCanvasDark.ts
// Placeholder uses darkGlass palette: '#4455aa', '#2266bb', '#7744cc', '#1188aa', '#335588'

import type { ChartTheme } from './types';
import { darkGlassChartTheme } from './darkGlass';

/**
 * Dark-background placeholder variant of the lightCanvas chart theme family.
 * @internal Aesthetic placeholder — production design pending. Do not use in shipped scenes.
 */
export const lightCanvasDarkChartTheme: ChartTheme = {
  ...darkGlassChartTheme,
  name: 'lightCanvas-dark',
};
