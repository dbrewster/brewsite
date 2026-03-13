// Named SceneTheme presets for canonical theme families and polarities.
// Consumers who need exact visual control can still provide custom SceneTheme objects.

import {
  SceneTheme,
  ThemeFamily,
  SceneThemeFloorGrid,
  SceneThemeFloor,
} from './types';

// Internal pair type — no longer exported from the public surface.
type SceneThemePair = { readonly dark: SceneTheme; readonly light: SceneTheme };

const defaultFontSize = {
  heading: 1.5,
  body: 1.0,
  label: 0.85,
  caption: 0.7,
  annotation: 0.6,
} as const;

const defaultLightFloorGridTheme = {
  spacing: 1,
  lineColor: '#2a3442',
  majorLineColor: '#445468',
  fillColor: '#eeeeee',
  lineOpacity: 0.15,
  fillOpacity: 1,
  majorEvery: 1,
} as SceneThemeFloorGrid;

const defaultDarkFloorGridTheme = {
  spacing: 1,
  lineColor: '#2a3442',
  majorLineColor: '#445468',
  fillColor: '#444444',
  lineOpacity: 0.15,
  fillOpacity: 1,
  majorEvery: 1,
} as SceneThemeFloorGrid;

const defaultFloorTheme = (isLight: boolean): SceneThemeFloor => ({
  // Matches floor geometry extent from +Z to -Z when centered at origin.
  negativeZExtent: 200,
  negativeZEdge: 'hard',
  negativeZFadeDistance: 24,
  grid: isLight ? defaultLightFloorGridTheme : defaultDarkFloorGridTheme,
});

const withFloorGridColors = (
  isLight: boolean,
  lineColor: string,
  majorLineColor: string,
  fillOpacity?: number,
): SceneThemeFloor => {
  const base = defaultFloorTheme(isLight);
  return {
    ...base,
    grid: {
      ...base.grid,
      lineColor,
      majorLineColor,
      ...(typeof fillOpacity === 'number' ? { fillOpacity } : {}),
    },
  };
};

const createFamilySceneTheme = ({
  colorMode,
  htmlFamily,
  backgroundFill,
  overlayGradient,
  floorLineColor,
  floorMajorLineColor,
  floorFillOpacity,
}: {
  colorMode: 'dark' | 'light';
  htmlFamily: string;
  backgroundFill: string;
  overlayGradient: string;
  floorLineColor: string;
  floorMajorLineColor: string;
  floorFillOpacity?: number;
}): SceneTheme => ({
  colorMode,
  font: {
    htmlFamily,
  },
  fontSize: defaultFontSize,
  background: {
    fill: { kind: 'gradient', value: backgroundFill },
    effects: {
      overlayGradient,
    },
  },
  floor: withFloorGridColors(colorMode === 'light', floorLineColor, floorMajorLineColor, floorFillOpacity),
});

/** Legacy generic dark scene preset. */
export const darkSceneTheme: SceneTheme = {
  colorMode: 'dark',
  font: {
    htmlFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  fontSize: defaultFontSize,
  background: {
    fill: { kind: 'color', value: '#0a0a14' },
  },
  floor: defaultFloorTheme(false),
};

/** Legacy generic light scene preset. */
export const lightSceneTheme: SceneTheme = {
  colorMode: 'light',
  font: {
    htmlFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  fontSize: defaultFontSize,
  background: {
    fill: { kind: 'color', value: '#f5f5f7' },
  },
  floor: defaultFloorTheme(true),
};

/** darkGlass family, dark polarity. */
export const darkGlassSceneTheme: SceneTheme = createFamilySceneTheme({
  colorMode: 'dark',
  htmlFamily: '"Sora", "Inter", sans-serif',
  backgroundFill: 'linear-gradient(180deg, #070504 0%, #130B08 100%)',
  overlayGradient: 'linear-gradient(180deg, rgba(227,106,46,0.14) 0%, rgba(122,31,45,0.10) 42%, rgba(0,0,0,0.30) 100%)',
  floorLineColor: '#3A2924',
  floorMajorLineColor: '#6B4338',
  floorFillOpacity: 0,
});

/** darkGlass family, light polarity. */
export const darkGlassLightSceneTheme: SceneTheme = createFamilySceneTheme({
  colorMode: 'light',
  htmlFamily: '"Sora", "Inter", sans-serif',
  backgroundFill: 'linear-gradient(180deg, #F8F3EF 0%, #EFE6DE 100%)',
  overlayGradient: 'linear-gradient(180deg, rgba(227,106,46,0.08) 0%, rgba(255,255,255,0) 52%, rgba(110,87,80,0.10) 100%)',
  floorLineColor: '#BFA99E',
  floorMajorLineColor: '#9A7569',
  floorFillOpacity: 0,
});

/** midnight family, dark polarity. */
export const midnightSceneTheme: SceneTheme = createFamilySceneTheme({
  colorMode: 'dark',
  htmlFamily: '"Manrope", "Source Sans 3", sans-serif',
  backgroundFill: 'linear-gradient(180deg, #0D0907 0%, #1A120D 100%)',
  overlayGradient: 'linear-gradient(180deg, rgba(226,163,58,0.12) 0%, rgba(0,0,0,0.28) 100%)',
  floorLineColor: '#4B3A29',
  floorMajorLineColor: '#7D603C',
  floorFillOpacity: 0,
});

/** midnight family, light polarity. */
export const midnightLightSceneTheme: SceneTheme = createFamilySceneTheme({
  colorMode: 'light',
  htmlFamily: '"Manrope", "Source Sans 3", sans-serif',
  backgroundFill: 'linear-gradient(180deg, #FAF6EE 0%, #F1E7D8 100%)',
  overlayGradient: 'linear-gradient(180deg, rgba(195,155,82,0.10) 0%, rgba(255,255,255,0) 55%, rgba(139,106,61,0.12) 100%)',
  floorLineColor: '#B99D77',
  floorMajorLineColor: '#9F7D52',
  floorFillOpacity: 0,
});

/** neonCyber family, dark polarity. */
export const neonCyberSceneTheme: SceneTheme = createFamilySceneTheme({
  colorMode: 'dark',
  htmlFamily: '"Space Grotesk", "Rajdhani", sans-serif',
  backgroundFill: 'linear-gradient(180deg, #02030D 0%, #09122A 100%)',
  overlayGradient: 'linear-gradient(180deg, rgba(138,61,255,0.16) 0%, rgba(0,231,255,0.08) 38%, rgba(0,0,0,0.28) 100%)',
  floorLineColor: '#2D2D66',
  floorMajorLineColor: '#6E55D1',
  floorFillOpacity: 0,
});

/** neonCyber family, light polarity. */
export const neonCyberLightSceneTheme: SceneTheme = createFamilySceneTheme({
  colorMode: 'light',
  htmlFamily: '"Space Grotesk", "Rajdhani", sans-serif',
  backgroundFill: 'linear-gradient(180deg, #F5F8FF 0%, #EAF2FF 100%)',
  overlayGradient: 'linear-gradient(180deg, rgba(138,61,255,0.08) 0%, rgba(0,231,255,0.06) 36%, rgba(30,47,90,0.08) 100%)',
  floorLineColor: '#A8B7E6',
  floorMajorLineColor: '#8097D5',
  floorFillOpacity: 0,
});

/** enterprise family, dark polarity. */
export const enterpriseSceneTheme: SceneTheme = createFamilySceneTheme({
  colorMode: 'dark',
  htmlFamily: '"IBM Plex Sans", "Inter", sans-serif',
  backgroundFill: 'linear-gradient(180deg, #0A1424 0%, #15253A 100%)',
  overlayGradient: 'linear-gradient(180deg, rgba(79,118,184,0.10) 0%, rgba(0,0,0,0.22) 100%)',
  floorLineColor: '#354A67',
  floorMajorLineColor: '#516C93',
  floorFillOpacity: 0,
});

/** enterprise family, light polarity. */
export const enterpriseLightSceneTheme: SceneTheme = createFamilySceneTheme({
  colorMode: 'light',
  htmlFamily: '"IBM Plex Sans", "Inter", sans-serif',
  backgroundFill: 'linear-gradient(180deg, #F3F6FA 0%, #E7EDF5 100%)',
  overlayGradient: 'linear-gradient(180deg, rgba(79,118,184,0.06) 0%, rgba(31,51,78,0.08) 100%)',
  floorLineColor: '#A0B1C6',
  floorMajorLineColor: '#7F95B2',
  floorFillOpacity: 0,
});

/** lightCanvas family, light polarity. */
export const lightCanvasSceneTheme: SceneTheme = createFamilySceneTheme({
  colorMode: 'light',
  htmlFamily: '"Plus Jakarta Sans", "Inter", sans-serif',
  backgroundFill: 'linear-gradient(180deg, #FFFFFF 0%, #F1F4F8 100%)',
  overlayGradient: 'linear-gradient(180deg, rgba(255,255,255,0.0) 0%, rgba(29,42,61,0.06) 100%)',
  floorLineColor: '#C4CCD8',
  floorMajorLineColor: '#9CAEC4',
  floorFillOpacity: 0,
});

/** lightCanvas family, dark polarity. */
export const lightCanvasDarkSceneTheme: SceneTheme = createFamilySceneTheme({
  colorMode: 'dark',
  htmlFamily: '"Plus Jakarta Sans", "Inter", sans-serif',
  backgroundFill: 'linear-gradient(180deg, #131923 0%, #1C2533 100%)',
  overlayGradient: 'linear-gradient(180deg, rgba(61,99,217,0.08) 0%, rgba(0,0,0,0.22) 100%)',
  floorLineColor: '#41516A',
  floorMajorLineColor: '#5D7194',
  floorFillOpacity: 0,
});

/** lightMinimal family, light polarity. */
export const lightMinimalSceneTheme: SceneTheme = createFamilySceneTheme({
  colorMode: 'light',
  htmlFamily: '"Inter", "Source Sans 3", sans-serif',
  backgroundFill: 'linear-gradient(180deg, #FFFFFF 0%, #F7F9FC 100%)',
  overlayGradient: 'linear-gradient(180deg, rgba(34,50,72,0.00) 0%, rgba(34,50,72,0.04) 100%)',
  floorLineColor: '#CAD2DF',
  floorMajorLineColor: '#AAB8CB',
  floorFillOpacity: 0,
});

/** lightMinimal family, dark polarity. */
export const lightMinimalDarkSceneTheme: SceneTheme = createFamilySceneTheme({
  colorMode: 'dark',
  htmlFamily: '"Inter", "Source Sans 3", sans-serif',
  backgroundFill: 'linear-gradient(180deg, #101317 0%, #191E24 100%)',
  overlayGradient: 'linear-gradient(180deg, rgba(127,174,234,0.05) 0%, rgba(0,0,0,0.20) 100%)',
  floorLineColor: '#4A5563',
  floorMajorLineColor: '#647488',
  floorFillOpacity: 0,
});

/** Registry of SceneTheme presets keyed by ThemeFamily and ThemePolarity. */
export const SCENE_THEME_PAIRS: Record<ThemeFamily, SceneThemePair> = {
  default:      { dark: enterpriseSceneTheme,      light: enterpriseLightSceneTheme },
  enterprise:   { dark: enterpriseSceneTheme,      light: enterpriseLightSceneTheme },
  darkGlass:    { dark: darkGlassSceneTheme,        light: darkGlassLightSceneTheme },
  midnight:     { dark: midnightSceneTheme,         light: midnightLightSceneTheme },
  neonCyber:    { dark: neonCyberSceneTheme,        light: neonCyberLightSceneTheme },
  lightCanvas:  { dark: lightCanvasDarkSceneTheme,  light: lightCanvasSceneTheme },
  lightMinimal: { dark: lightMinimalDarkSceneTheme, light: lightMinimalSceneTheme },
} as const;
