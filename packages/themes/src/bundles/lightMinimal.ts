// ThemeBundle for the lightMinimal family — minimal light/pastel aesthetic.
// Note: lightMinimalTheme/lightMinimalSceneTheme are the LIGHT polarity;
//       lightMinimalDarkTheme/lightMinimalDarkSceneTheme are the DARK polarity.

import type { ThemeBundle } from '../types';

import { lightMinimalSceneTheme, lightMinimalDarkSceneTheme } from '../presets/scene/lightMinimal';
import { lightMinimalTheme as diagramLight }     from '../presets/diagram/lightMinimal';
import { lightMinimalDarkTheme as diagramDark }   from '../presets/diagram/lightMinimalDark';
import { lightMinimalChartTheme as chartLight }   from '../presets/chart/lightMinimal';
import { lightMinimalDarkChartTheme as chartDark } from '../presets/chart/lightMinimalDark';

const diagramDarkFull  = { ...diagramDark,  sceneTheme: lightMinimalDarkSceneTheme };
const diagramLightFull = { ...diagramLight, sceneTheme: lightMinimalSceneTheme };
const chartDarkFull    = { ...chartDark,    sceneTheme: lightMinimalDarkSceneTheme };
const chartLightFull   = { ...chartLight,   sceneTheme: lightMinimalSceneTheme };

/** Complete lightMinimal ThemeBundle with scene/diagram/chart presets pre-wired. */
export const lightMinimalBundle: ThemeBundle = {
  family: 'lightMinimal',
  scene:   { dark: lightMinimalDarkSceneTheme, light: lightMinimalSceneTheme },
  diagram: { dark: diagramDarkFull,            light: diagramLightFull },
  chart:   { dark: chartDarkFull,              light: chartLightFull },
};
