// Light Minimal theme — dark-background variant (PLACEHOLDER).
// @internal Aesthetic placeholder — production design pending. Do not use in shipped scenes.

import type { DiagramTheme } from '../types';
import { darkGlassTheme } from './darkGlass';

/**
 * Dark-background placeholder variant of the lightMinimal theme family.
 * @internal Aesthetic placeholder — production design pending. Do not use in shipped scenes.
 */
export const lightMinimalDarkTheme: DiagramTheme = {
  ...darkGlassTheme,
} as const;
