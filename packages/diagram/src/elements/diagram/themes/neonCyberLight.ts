// NeonCyber theme — light-background variant (PLACEHOLDER).
// @internal Aesthetic placeholder — production design pending. Do not use in shipped scenes.

import type { DiagramTheme } from '../types';
import { lightCanvasTheme } from './lightCanvas';

/**
 * Light-background placeholder variant of the neonCyber theme family.
 * @internal Aesthetic placeholder — production design pending. Do not use in shipped scenes.
 */
export const neonCyberLightTheme: DiagramTheme = {
  ...lightCanvasTheme,
} as const;
