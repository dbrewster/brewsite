// Dark Glass chart theme — light-background variant (PLACEHOLDER).
// @internal Aesthetic placeholder — production design pending. Do not use in shipped scenes.

// SHARED ACCENT PALETTE — must match packages/diagram/src/elements/diagram/themes/darkGlassLight.ts
// Placeholder uses lightCanvas palette: '#3355cc', '#1a9966', '#cc3355', '#cc8800', '#6644bb'

import type { ChartTheme } from './types';
import { lightCanvasChartTheme } from './lightCanvas';

/**
 * Light-background placeholder variant of the darkGlass chart theme family.
 * @internal Aesthetic placeholder — production design pending. Do not use in shipped scenes.
 */
export const darkGlassLightChartTheme: ChartTheme = {
  ...lightCanvasChartTheme,
  name: 'darkGlass-light',
};
