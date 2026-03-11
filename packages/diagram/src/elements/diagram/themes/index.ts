// Barrel re-export for all built-in DiagramTheme presets and theme utilities.

export { darkGlassTheme }    from './darkGlass';
export { midnightTheme }     from './midnight';
export { neonCyberTheme }    from './neonCyber';
export { enterpriseTheme }   from './enterprise';
export { lightCanvasTheme }  from './lightCanvas';
export { lightMinimalTheme } from './lightMinimal';
export { mergeTheme, withColorMode } from './mergeTheme';

import { darkGlassTheme }   from './darkGlass';
import { midnightTheme }    from './midnight';
import { neonCyberTheme }   from './neonCyber';
import { enterpriseTheme }  from './enterprise';
import { lightCanvasTheme } from './lightCanvas';
import { lightMinimalTheme } from './lightMinimal';
import type { DiagramThemeName } from '../types';
import type { DiagramTheme } from '../types';

/** All built-in diagram theme presets, keyed by name. */
export const DIAGRAM_THEMES: Record<DiagramThemeName, DiagramTheme> = {
  darkGlass:    darkGlassTheme,
  midnight:     midnightTheme,
  neonCyber:    neonCyberTheme,
  enterprise:   enterpriseTheme,
  lightCanvas:  lightCanvasTheme,
  lightMinimal: lightMinimalTheme,
} as const;
