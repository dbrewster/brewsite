// Barrel re-export for all built-in DiagramTheme presets and theme utilities.

export { darkGlassTheme }      from './darkGlass';
export { midnightTheme }       from './midnight';
export { neonCyberTheme }      from './neonCyber';
export { enterpriseTheme }     from './enterprise';
export { lightCanvasTheme }    from './lightCanvas';
export { lightMinimalTheme }   from './lightMinimal';
export { darkGlassLightTheme }   from './darkGlassLight';
export { midnightLightTheme }    from './midnightLight';
export { neonCyberLightTheme }   from './neonCyberLight';
export { enterpriseLightTheme }  from './enterpriseLight';
export { lightCanvasDarkTheme }  from './lightCanvasDark';
export { lightMinimalDarkTheme } from './lightMinimalDark';
export { mergeTheme, withColorMode } from './mergeTheme';

import { darkGlassTheme }      from './darkGlass';
import { midnightTheme }       from './midnight';
import { neonCyberTheme }      from './neonCyber';
import { enterpriseTheme }     from './enterprise';
import { lightCanvasTheme }    from './lightCanvas';
import { lightMinimalTheme }   from './lightMinimal';
import { darkGlassLightTheme }   from './darkGlassLight';
import { midnightLightTheme }    from './midnightLight';
import { neonCyberLightTheme }   from './neonCyberLight';
import { enterpriseLightTheme }  from './enterpriseLight';
import { lightCanvasDarkTheme }  from './lightCanvasDark';
import { lightMinimalDarkTheme } from './lightMinimalDark';

import type { DiagramThemeName, DiagramTheme } from '../types';
import type { ThemeFamily } from '@brewsite/core';
import { SCENE_THEME_PAIRS } from '@brewsite/core';

/** All built-in diagram theme presets, keyed by name. Unchanged from pre-overhaul. */
export const DIAGRAM_THEMES: Record<DiagramThemeName, DiagramTheme> = {
  darkGlass:    darkGlassTheme,
  midnight:     midnightTheme,
  neonCyber:    neonCyberTheme,
  enterprise:   enterpriseTheme,
  lightCanvas:  lightCanvasTheme,
  lightMinimal: lightMinimalTheme,
} as const;

/** Pair type for DIAGRAM_THEME_PAIRS entries. */
export type DiagramThemePair = {
  readonly dark: DiagramTheme;
  readonly light: DiagramTheme;
};

// Internal pair entries — spread preset + inject pre-wired sceneTheme from SCENE_THEME_PAIRS.
// Using spread (not mergeTheme) because sceneTheme is a top-level DiagramTheme field.
const _darkGlassDark: DiagramTheme    = { ...darkGlassTheme,    sceneTheme: SCENE_THEME_PAIRS.darkGlass.dark };
const _darkGlassLight: DiagramTheme   = { ...darkGlassLightTheme, sceneTheme: SCENE_THEME_PAIRS.darkGlass.light };
const _midnightDark: DiagramTheme     = { ...midnightTheme,     sceneTheme: SCENE_THEME_PAIRS.midnight.dark };
const _midnightLight: DiagramTheme    = { ...midnightLightTheme, sceneTheme: SCENE_THEME_PAIRS.midnight.light };
const _neonCyberDark: DiagramTheme    = { ...neonCyberTheme,    sceneTheme: SCENE_THEME_PAIRS.neonCyber.dark };
const _neonCyberLight: DiagramTheme   = { ...neonCyberLightTheme, sceneTheme: SCENE_THEME_PAIRS.neonCyber.light };
const _enterpriseDark: DiagramTheme   = { ...enterpriseTheme,   sceneTheme: SCENE_THEME_PAIRS.enterprise.dark };
const _enterpriseLight: DiagramTheme  = { ...enterpriseLightTheme, sceneTheme: SCENE_THEME_PAIRS.enterprise.light };
const _lightCanvasDark: DiagramTheme  = { ...lightCanvasDarkTheme, sceneTheme: SCENE_THEME_PAIRS.lightCanvas.dark };
const _lightCanvasLight: DiagramTheme = { ...lightCanvasTheme,  sceneTheme: SCENE_THEME_PAIRS.lightCanvas.light };
const _lightMinimalDark: DiagramTheme = { ...lightMinimalDarkTheme, sceneTheme: SCENE_THEME_PAIRS.lightMinimal.dark };
const _lightMinimalLight: DiagramTheme= { ...lightMinimalTheme, sceneTheme: SCENE_THEME_PAIRS.lightMinimal.light };

/**
 * Registry of DiagramTheme presets keyed by ThemeFamily and ThemePolarity.
 * Each entry has `sceneTheme` pre-wired from SCENE_THEME_PAIRS — no manual wiring needed.
 *
 * Usage:
 * ```ts
 * const diagramTheme = DIAGRAM_THEME_PAIRS['darkGlass']['dark']; // DiagramTheme with sceneTheme set
 * ```
 */
export const DIAGRAM_THEME_PAIRS: Record<ThemeFamily, DiagramThemePair> = {
  darkGlass:    { dark: _darkGlassDark,    light: _darkGlassLight },
  midnight:     { dark: _midnightDark,     light: _midnightLight },
  neonCyber:    { dark: _neonCyberDark,    light: _neonCyberLight },
  enterprise:   { dark: _enterpriseDark,   light: _enterpriseLight },
  lightCanvas:  { dark: _lightCanvasDark,  light: _lightCanvasLight },
  lightMinimal: { dark: _lightMinimalDark, light: _lightMinimalLight },
} as const;
