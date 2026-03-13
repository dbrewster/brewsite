// ThemeBundle for the darkGlass family — dark/deep-glass aesthetic.

import type { ThemeBundle } from '../types';

import { darkGlassSceneTheme, darkGlassLightSceneTheme } from '../presets/scene/darkGlass';
import { darkGlassTheme as diagramDark }      from '../presets/diagram/darkGlass';
import { darkGlassLightTheme as diagramLight } from '../presets/diagram/darkGlassLight';
import { darkGlassChartTheme as chartDark }      from '../presets/chart/darkGlass';
import { darkGlassLightChartTheme as chartLight } from '../presets/chart/darkGlassLight';

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
