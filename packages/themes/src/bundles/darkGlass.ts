// ThemeBundle for the darkGlass family — dark/deep-glass aesthetic.

import type { ThemeBundle } from '../types';

// Scene presets
import { darkGlassSceneTheme, darkGlassLightSceneTheme } from '@brewsite/core';

// Diagram presets
import { darkGlassTheme as diagramDark }      from '@brewsite/diagram';
import { darkGlassLightTheme as diagramLight } from '@brewsite/diagram';

// Chart presets
import { darkGlassChartTheme as chartDark }      from '@brewsite/charts';
import { darkGlassLightChartTheme as chartLight } from '@brewsite/charts';

// Wire sceneTheme into diagram and chart themes at bundle assembly time.
const diagramDarkFull  = { ...diagramDark,  sceneTheme: darkGlassSceneTheme };
const diagramLightFull = { ...diagramLight, sceneTheme: darkGlassLightSceneTheme };
const chartDarkFull    = { ...chartDark,    sceneTheme: darkGlassSceneTheme };
const chartLightFull   = { ...chartLight,   sceneTheme: darkGlassLightSceneTheme };

/** Complete darkGlass ThemeBundle with scene/diagram/chart presets pre-wired. */
export const darkGlassBundle: ThemeBundle = {
  family: 'darkGlass',
  scene:   { dark: darkGlassSceneTheme,      light: darkGlassLightSceneTheme },
  diagram: { dark: diagramDarkFull,          light: diagramLightFull },
  chart:   { dark: chartDarkFull,            light: chartLightFull },
};
