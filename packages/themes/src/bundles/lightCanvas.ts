// ThemeBundle for the lightCanvas family — clean light/white canvas aesthetic.
// Note: lightCanvasTheme/lightCanvasSceneTheme are the LIGHT polarity;
//       lightCanvasDarkTheme/lightCanvasDarkSceneTheme are the DARK polarity.

import type { ThemeBundle } from '../types';
import { lightCanvasSceneTheme, lightCanvasDarkSceneTheme } from '@brewsite/core';
import { lightCanvasTheme as diagramLight }     from '@brewsite/diagram';
import { lightCanvasDarkTheme as diagramDark }   from '@brewsite/diagram';
import { lightCanvasChartTheme as chartLight }   from '@brewsite/charts';
import { lightCanvasDarkChartTheme as chartDark } from '@brewsite/charts';

const diagramDarkFull  = { ...diagramDark,  sceneTheme: lightCanvasDarkSceneTheme };
const diagramLightFull = { ...diagramLight, sceneTheme: lightCanvasSceneTheme };
const chartDarkFull    = { ...chartDark,    sceneTheme: lightCanvasDarkSceneTheme };
const chartLightFull   = { ...chartLight,   sceneTheme: lightCanvasSceneTheme };

/** Complete lightCanvas ThemeBundle with scene/diagram/chart presets pre-wired. */
export const lightCanvasBundle: ThemeBundle = {
  family: 'lightCanvas',
  scene:   { dark: lightCanvasDarkSceneTheme, light: lightCanvasSceneTheme },
  diagram: { dark: diagramDarkFull,           light: diagramLightFull },
  chart:   { dark: chartDarkFull,             light: chartLightFull },
};
