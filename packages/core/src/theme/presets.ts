// Default SceneTheme presets — enterprise aesthetic, used as the built-in fallback.
// Named presets (darkGlass, midnight, etc.) live in @brewsite/themes.

import {
  SceneTheme,
  SceneThemeFloorGrid,
  SceneThemeFloor,
} from './types';

const defaultFontSize = {
  heading: 1.5,
  body: 1.0,
  label: 0.85,
  caption: 0.7,
  annotation: 0.6,
} as const;

const defaultDarkFloorGridTheme: SceneThemeFloorGrid = {
  spacing: 1,
  lineColor: '#354A67',
  majorLineColor: '#516C93',
  fillColor: '#444444',
  lineOpacity: 0.15,
  fillOpacity: 0,
  majorEvery: 1,
};

const defaultLightFloorGridTheme: SceneThemeFloorGrid = {
  spacing: 1,
  lineColor: '#A0B1C6',
  majorLineColor: '#7F95B2',
  fillColor: '#eeeeee',
  lineOpacity: 0.15,
  fillOpacity: 0,
  majorEvery: 1,
};

const defaultDarkFloorTheme: SceneThemeFloor = {
  negativeZExtent: 200,
  negativeZEdge: 'hard',
  negativeZFadeDistance: 24,
  grid: defaultDarkFloorGridTheme,
};

const defaultLightFloorTheme: SceneThemeFloor = {
  negativeZExtent: 200,
  negativeZEdge: 'hard',
  negativeZFadeDistance: 24,
  grid: defaultLightFloorGridTheme,
};

/** Default scene theme — enterprise aesthetic, dark polarity. Used as the built-in fallback. */
export const defaultSceneTheme: SceneTheme = {
  colorMode: 'dark',
  font: {
    htmlFamily: '"IBM Plex Sans", "Inter", sans-serif',
  },
  fontSize: defaultFontSize,
  background: {
    fill: { kind: 'gradient', value: 'linear-gradient(180deg, #0A1424 0%, #15253A 100%)' },
    effects: {
      overlayGradient: 'linear-gradient(180deg, rgba(79,118,184,0.10) 0%, rgba(0,0,0,0.22) 100%)',
    },
  },
  floor: defaultDarkFloorTheme,
};

/** Default scene theme — enterprise aesthetic, light polarity. Used as the built-in fallback. */
export const defaultLightSceneTheme: SceneTheme = {
  colorMode: 'light',
  font: {
    htmlFamily: '"IBM Plex Sans", "Inter", sans-serif',
  },
  fontSize: defaultFontSize,
  background: {
    fill: { kind: 'gradient', value: 'linear-gradient(180deg, #F3F6FA 0%, #E7EDF5 100%)' },
    effects: {
      overlayGradient: 'linear-gradient(180deg, rgba(79,118,184,0.06) 0%, rgba(31,51,78,0.08) 100%)',
    },
  },
  floor: defaultLightFloorTheme,
};

/**
 * Enterprise-named aliases for the default presets.
 * Used internally by sceneThemeRegistry.ts to pre-load the enterprise family.
 * @internal
 */
export const enterpriseSceneTheme: SceneTheme = defaultSceneTheme;
export const enterpriseLightSceneTheme: SceneTheme = defaultLightSceneTheme;
