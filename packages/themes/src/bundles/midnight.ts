// ThemeBundle for the midnight family — deep indigo/dark blue aesthetic.

import type { ThemeBundle } from '../types';

import { midnightSceneTheme, midnightLightSceneTheme } from '../presets/scene/midnight';
import { midnightTheme as diagramDark }      from '../presets/diagram/midnight';
import { midnightLightTheme as diagramLight } from '../presets/diagram/midnightLight';
import { midnightChartTheme as chartDark }      from '../presets/chart/midnight';
import { midnightLightChartTheme as chartLight } from '../presets/chart/midnightLight';

const diagramDarkFull  = { ...diagramDark,  sceneTheme: midnightSceneTheme };
const diagramLightFull = { ...diagramLight, sceneTheme: midnightLightSceneTheme };
const chartDarkFull    = { ...chartDark,    sceneTheme: midnightSceneTheme };
const chartLightFull   = { ...chartLight,   sceneTheme: midnightLightSceneTheme };

/** Complete midnight ThemeBundle with scene/diagram/chart presets pre-wired. */
export const midnightBundle: ThemeBundle = {
  family: 'midnight',
  scene:   { dark: midnightSceneTheme,        light: midnightLightSceneTheme },
  diagram: { dark: diagramDarkFull,           light: diagramLightFull },
  chart:   { dark: chartDarkFull,             light: chartLightFull },
};
