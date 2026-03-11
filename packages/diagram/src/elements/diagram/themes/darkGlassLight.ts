// Dark Glass theme — light-background variant (PLACEHOLDER).
// @internal Aesthetic placeholder — production design pending. Do not use in shipped scenes.

// SHARED ACCENT PALETTE — must match packages/charts/src/themes/darkGlassLight.ts
// Placeholder uses lightCanvas palette: '#3355cc', '#1a9966', '#cc3355', '#cc8800', '#6644bb'

import type { DiagramTheme } from '../types';
import { lightCanvasTheme } from './lightCanvas';

/**
 * Light-background placeholder variant of the darkGlass theme family.
 * @internal Aesthetic placeholder — production design pending. Do not use in shipped scenes.
 * Uses lightCanvasTheme as structural stand-in; aesthetics are incorrect for darkGlass family.
 */
export const darkGlassLightTheme: DiagramTheme = {
  ...lightCanvasTheme,
} as const;
