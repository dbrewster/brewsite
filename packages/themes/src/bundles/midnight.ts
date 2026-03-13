// ThemeBundle for the midnight family — deep indigo/dark blue aesthetic.

import type { ThemeBundle } from '../types';
import { midnightSceneTheme, midnightLightSceneTheme } from '@brewsite/core';
import { midnightTheme as diagramDark }      from '@brewsite/diagram';
import { midnightLightTheme as diagramLight } from '@brewsite/diagram';
import { midnightChartTheme as chartDark }      from '@brewsite/charts';
import { midnightLightChartTheme as chartLight } from '@brewsite/charts';

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
