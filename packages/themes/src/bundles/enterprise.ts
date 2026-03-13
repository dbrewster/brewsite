// ThemeBundle for the enterprise family — board-ready clarity, restrained motion.

import type { ThemeBundle } from '../types';

import { enterpriseSceneTheme, enterpriseLightSceneTheme } from '../presets/scene/enterprise';
import { enterpriseTheme as diagramDark } from '../presets/diagram/enterprise';
import { enterpriseLightTheme as diagramLight } from '../presets/diagram/enterpriseLight';
import { enterpriseChartTheme as chartDark } from '../presets/chart/enterprise';
import { enterpriseLightChartTheme as chartLight } from '../presets/chart/enterpriseLight';

// Wire sceneTheme into diagram and chart themes at bundle assembly time.
const diagramDarkFull  = { ...diagramDark,  sceneTheme: enterpriseSceneTheme };
const diagramLightFull = { ...diagramLight, sceneTheme: enterpriseLightSceneTheme };
const chartDarkFull    = { ...chartDark,    sceneTheme: enterpriseSceneTheme };
const chartLightFull   = { ...chartLight,   sceneTheme: enterpriseLightSceneTheme };

/** Complete enterprise ThemeBundle with scene/diagram/chart presets pre-wired. */
export const enterpriseBundle: ThemeBundle = {
  family: 'enterprise',
  scene:   { dark: enterpriseSceneTheme,   light: enterpriseLightSceneTheme },
  diagram: { dark: diagramDarkFull,        light: diagramLightFull },
  chart:   { dark: chartDarkFull,          light: chartLightFull },
};
