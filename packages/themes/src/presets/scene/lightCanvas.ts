// lightCanvas SceneTheme presets — clean light/white canvas aesthetic.

import type { SceneTheme, SceneThemeHighlightPalette } from '@brewsite/core';

// -- Highlight palettes tuned for the lightCanvas family --

const lightCanvasLightHighlights: SceneThemeHighlightPalette = {
  primary: {
    color: '#3060B0',
    mode: 'holographic',
    intensity: 0.32,
    blendMode: 'normal',
    backdropOpacity: 0.7,
    backdropColor: '#e8e4e0',
  },
  secondary: {
    color: '#5A7090',
    mode: 'holographic',
    intensity: 0.28,
    blendMode: 'normal',
    backdropOpacity: 0.7,
    backdropColor: '#e8e4e0',
  },
  tertiary: {
    color: '#2A8080',
    mode: 'glow',
    intensity: 0.32,
    blendMode: 'normal',
    backdropOpacity: 0.7,
    backdropColor: '#e8e4e0',
  },
  error: {
    color: '#BB2828',
    mode: 'holographic',
    intensity: 0.38,
    blendMode: 'normal',
    backdropOpacity: 0.7,
    backdropColor: '#e8e4e0',
    smoke: true,
  },
  warning: {
    color: '#AA8010',
    mode: 'holographic',
    intensity: 0.32,
    blendMode: 'normal',
    backdropOpacity: 0.7,
    backdropColor: '#e8e4e0',
  },
  success: {
    color: '#228850',
    mode: 'glow',
    intensity: 0.32,
    blendMode: 'normal',
    backdropOpacity: 0.7,
    backdropColor: '#e8e4e0',
  },
  info: {
    color: '#2868A8',
    mode: 'glow',
    intensity: 0.28,
    blendMode: 'normal',
    backdropOpacity: 0.7,
    backdropColor: '#e8e4e0',
  },
};

const lightCanvasDarkHighlights: SceneThemeHighlightPalette = {
  primary: {
    color: '#5090D0',
    mode: 'holographic',
    intensity: 0.48,
    blendMode: 'additive',
    backdropOpacity: 0.7,
    backdropColor: '#000000',
  },
  secondary: {
    color: '#7A9AB8',
    mode: 'holographic',
    intensity: 0.42,
    blendMode: 'additive',
    backdropOpacity: 0.7,
    backdropColor: '#000000',
  },
  tertiary: {
    color: '#44AAAA',
    mode: 'glow',
    intensity: 0.48,
    blendMode: 'additive',
    backdropOpacity: 0.7,
    backdropColor: '#000000',
  },
  error: {
    color: '#DD3838',
    mode: 'holographic',
    intensity: 0.55,
    blendMode: 'additive',
    backdropOpacity: 0.7,
    backdropColor: '#000000',
    smoke: true,
  },
  warning: {
    color: '#D4A030',
    mode: 'holographic',
    intensity: 0.48,
    blendMode: 'additive',
    backdropOpacity: 0.7,
    backdropColor: '#000000',
  },
  success: {
    color: '#3AAA68',
    mode: 'glow',
    intensity: 0.48,
    blendMode: 'additive',
    backdropOpacity: 0.7,
    backdropColor: '#000000',
  },
  info: {
    color: '#4488CC',
    mode: 'glow',
    intensity: 0.42,
    blendMode: 'additive',
    backdropOpacity: 0.7,
    backdropColor: '#000000',
  },
};

/** lightCanvas family, light polarity. */
export const lightCanvasSceneTheme: SceneTheme = {
  colorMode: 'light',
  font: {
    htmlFamily: '"Plus Jakarta Sans", "Inter", sans-serif',
  },
  fontSize: {
    heading: 1.5,
    body: 1.0,
    label: 0.85,
    caption: 0.7,
    annotation: 0.6,
  },
  background: {
    fill: { kind: 'gradient', value: 'linear-gradient(180deg, #FFFFFF 0%, #F1F4F8 100%)' },
    effects: {
      overlayGradient: 'linear-gradient(180deg, rgba(255,255,255,0.0) 0%, rgba(29,42,61,0.06) 100%)',
    },
  },
  floor: {
    negativeZExtent: 200,
    negativeZEdge: 'hard',
    negativeZFadeDistance: 24,
    grid: {
      spacing: 1,
      lineColor: '#C4CCD8',
      majorLineColor: '#9CAEC4',
      fillColor: '#eeeeee',
      lineOpacity: 0.15,
      fillOpacity: 0,
      majorEvery: 1,
    },
  },
  carouselTray: {
    color: '#E0E6EE',
    opacity: 0.90,
    accentColor: '#3D63D9',
    metalness: 0.08,
    roughness: 0.72,
    edgeStyle: 'matte',
    surfacePattern: 'none',
    surfaceIntensity: 0,
    surfaceMaterial: 'light-marble',
    materialApplication: { colorMix: 0.2, brightness: 1.2, saturation: 0.4 },
  },
  highlightPalette: lightCanvasLightHighlights,
};

/** lightCanvas family, dark polarity. */
export const lightCanvasDarkSceneTheme: SceneTheme = {
  colorMode: 'dark',
  font: {
    htmlFamily: '"Plus Jakarta Sans", "Inter", sans-serif',
  },
  fontSize: {
    heading: 1.5,
    body: 1.0,
    label: 0.85,
    caption: 0.7,
    annotation: 0.6,
  },
  background: {
    fill: { kind: 'gradient', value: 'linear-gradient(180deg, #131923 0%, #1C2533 100%)' },
    effects: {
      overlayGradient: 'linear-gradient(180deg, rgba(61,99,217,0.08) 0%, rgba(0,0,0,0.22) 100%)',
    },
  },
  floor: {
    negativeZExtent: 200,
    negativeZEdge: 'hard',
    negativeZFadeDistance: 24,
    grid: {
      spacing: 1,
      lineColor: '#41516A',
      majorLineColor: '#5D7194',
      fillColor: '#444444',
      lineOpacity: 0.15,
      fillOpacity: 0,
      majorEvery: 1,
    },
  },
  carouselTray: {
    color: '#1E2838',
    opacity: 0.80,
    accentColor: '#5D7194',
    metalness: 0.18,
    roughness: 0.62,
    edgeStyle: 'matte',
    surfacePattern: 'grain',
    surfaceIntensity: 0.15,
    surfaceMaterial: 'light-marble',
    materialApplication: { colorMix: 0.3, brightness: 1.1, saturation: 0.5 },
  },
  highlightPalette: lightCanvasDarkHighlights,
};
