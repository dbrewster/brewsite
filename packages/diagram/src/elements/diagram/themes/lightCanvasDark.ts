// Light Canvas theme — dark-background variant (PLACEHOLDER).
// @internal Aesthetic placeholder — production design pending. Do not use in shipped scenes.

// SHARED ACCENT PALETTE — must match packages/charts/src/themes/lightCanvasDark.ts
// Placeholder uses darkGlass palette: '#4455aa', '#2266bb', '#7744cc', '#1188aa', '#335588'

import type { DiagramTheme } from '../types';
import { darkGlassTheme } from './darkGlass';

/**
 * Dark-background placeholder variant of the lightCanvas theme family.
 * @internal Aesthetic placeholder — production design pending. Do not use in shipped scenes.
 */
export const lightCanvasDarkTheme: DiagramTheme = {
  ...darkGlassTheme,
} as const;
