// Midnight theme — light-background variant (PLACEHOLDER).
// @internal Aesthetic placeholder — production design pending. Do not use in shipped scenes.

// SHARED ACCENT PALETTE — must match packages/charts/src/themes/midnightLight.ts
// Placeholder uses lightCanvas palette: '#3355cc', '#1a9966', '#cc3355', '#cc8800', '#6644bb'

import type { DiagramTheme } from '../types';
import { lightCanvasTheme } from './lightCanvas';

/**
 * Light-background placeholder variant of the midnight theme family.
 * @internal Aesthetic placeholder — production design pending. Do not use in shipped scenes.
 */
export const midnightLightTheme: DiagramTheme = {
  ...lightCanvasTheme,
} as const;
