// Midnight chart theme — light-background variant (PLACEHOLDER).
// @internal Aesthetic placeholder — production design pending. Do not use in shipped scenes.

import type { ChartTheme } from './types';
import { lightCanvasChartTheme } from './lightCanvas';

/**
 * Light-background placeholder variant of the midnight chart theme family.
 * @internal Aesthetic placeholder — production design pending. Do not use in shipped scenes.
 */
export const midnightLightChartTheme: ChartTheme = {
  ...lightCanvasChartTheme,
  name: 'midnight-light',
};
