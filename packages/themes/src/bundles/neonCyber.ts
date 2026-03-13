// ThemeBundle for the neonCyber family — high-contrast neon/cyberpunk aesthetic.

import type { ThemeBundle } from '../types';

import { neonCyberSceneTheme, neonCyberLightSceneTheme } from '../presets/scene/neonCyber';
import { neonCyberTheme as diagramDark }      from '../presets/diagram/neonCyber';
import { neonCyberLightTheme as diagramLight } from '../presets/diagram/neonCyberLight';
import { neonCyberChartTheme as chartDark }      from '../presets/chart/neonCyber';
import { neonCyberLightChartTheme as chartLight } from '../presets/chart/neonCyberLight';

const diagramDarkFull  = { ...diagramDark,  sceneTheme: neonCyberSceneTheme };
const diagramLightFull = { ...diagramLight, sceneTheme: neonCyberLightSceneTheme };
const chartDarkFull    = { ...chartDark,    sceneTheme: neonCyberSceneTheme };
const chartLightFull   = { ...chartLight,   sceneTheme: neonCyberLightSceneTheme };

/** Complete neonCyber ThemeBundle with scene/diagram/chart presets pre-wired. */
export const neonCyberBundle: ThemeBundle = {
  family: 'neonCyber',
  scene:   { dark: neonCyberSceneTheme,       light: neonCyberLightSceneTheme },
  diagram: { dark: diagramDarkFull,           light: diagramLightFull },
  chart:   { dark: chartDarkFull,             light: chartLightFull },
};
