// midnight SceneTheme presets — warm cinematic tone with bronze/amber authority.

import type { SceneTheme, SceneThemeHighlightPalette } from '@brewsite/core';

// -- Highlight palettes tuned for the midnight family --

const midnightDarkHighlights: SceneThemeHighlightPalette = {
  primary: {
    color: '#D4A040',
    mode: 'holographic',
    intensity: 0.5,
    blendMode: 'additive',
    backdropOpacity: 0.7,
    backdropColor: '#000000',
  },
  secondary: {
    color: '#A08050',
    mode: 'holographic',
    intensity: 0.45,
    blendMode: 'additive',
    backdropOpacity: 0.7,
    backdropColor: '#000000',
  },
  tertiary: {
    color: '#C07848',
    mode: 'glow',
    intensity: 0.45,
    blendMode: 'additive',
    backdropOpacity: 0.7,
    backdropColor: '#000000',
  },
  error: {
    color: '#CC3322',
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
    intensity: 0.5,
    blendMode: 'additive',
    backdropOpacity: 0.7,
    backdropColor: '#000000',
  },
  success: {
    color: '#44AA66',
    mode: 'glow',
    intensity: 0.45,
    blendMode: 'additive',
    backdropOpacity: 0.7,
    backdropColor: '#000000',
  },
  info: {
    color: '#B89050',
    mode: 'glow',
    intensity: 0.4,
    blendMode: 'additive',
    backdropOpacity: 0.7,
    backdropColor: '#000000',
  },
};

const midnightLightHighlights: SceneThemeHighlightPalette = {
  primary: {
    color: '#A07828',
    mode: 'holographic',
    intensity: 0.35,
    blendMode: 'normal',
    backdropOpacity: 0.7,
    backdropColor: '#e8e4e0',
  },
  secondary: {
    color: '#7A6040',
    mode: 'holographic',
    intensity: 0.3,
    blendMode: 'normal',
    backdropOpacity: 0.7,
    backdropColor: '#e8e4e0',
  },
  tertiary: {
    color: '#8A5A30',
    mode: 'glow',
    intensity: 0.32,
    blendMode: 'normal',
    backdropOpacity: 0.7,
    backdropColor: '#e8e4e0',
  },
  error: {
    color: '#AA2218',
    mode: 'holographic',
    intensity: 0.4,
    blendMode: 'normal',
    backdropOpacity: 0.7,
    backdropColor: '#e8e4e0',
    smoke: true,
  },
  warning: {
    color: '#AA7A18',
    mode: 'holographic',
    intensity: 0.35,
    blendMode: 'normal',
    backdropOpacity: 0.7,
    backdropColor: '#e8e4e0',
  },
  success: {
    color: '#2A7A44',
    mode: 'glow',
    intensity: 0.32,
    blendMode: 'normal',
    backdropOpacity: 0.7,
    backdropColor: '#e8e4e0',
  },
  info: {
    color: '#8A6838',
    mode: 'glow',
    intensity: 0.28,
    blendMode: 'normal',
    backdropOpacity: 0.7,
    backdropColor: '#e8e4e0',
  },
};

/** midnight family, dark polarity. */
export const midnightSceneTheme: SceneTheme = {
  colorMode: 'dark',
  font: {
    htmlFamily: '"Manrope", "Source Sans 3", sans-serif',
  },
  fontSize: {
    heading: 1.5,
    body: 1.0,
    label: 0.85,
    caption: 0.7,
    annotation: 0.6,
  },
  background: {
    fill: { kind: 'gradient', value: 'linear-gradient(180deg, #0D0907 0%, #1A120D 100%)' },
    effects: {
      overlayGradient: 'linear-gradient(180deg, rgba(226,163,58,0.12) 0%, rgba(0,0,0,0.28) 100%)',
    },
  },
  floor: {
    negativeZExtent: 200,
    negativeZEdge: 'hard',
    negativeZFadeDistance: 24,
    grid: {
      spacing: 1,
      lineColor: '#4B3A29',
      majorLineColor: '#7D603C',
      fillColor: '#444444',
      lineOpacity: 0.15,
      fillOpacity: 0,
      majorEvery: 1,
    },
  },
  carouselTray: {
    color: '#1E150F',
    opacity: 0.82,
    accentColor: '#E2A33A',
    metalness: 0.3,
    roughness: 0.5,
    edgeStyle: 'knurled',
    surfacePattern: 'brushed',
    surfaceIntensity: 0.30,
    surfaceMaterial: 'dark-marble',
    materialApplication: { colorMix: 0.5, brightness: 0.7, saturation: 0.8 },
  },
  highlightPalette: midnightDarkHighlights,
  accentColor: '#E2A33A',
  textColors: {
    primary: '#F2E7D4',
    secondary: '#BCA180',
    muted: '#7B664C',
    surface: '#261A13',
  },
};

/** midnight family, light polarity. */
export const midnightLightSceneTheme: SceneTheme = {
  colorMode: 'light',
  font: {
    htmlFamily: '"Manrope", "Source Sans 3", sans-serif',
  },
  fontSize: {
    heading: 1.5,
    body: 1.0,
    label: 0.85,
    caption: 0.7,
    annotation: 0.6,
  },
  background: {
    fill: { kind: 'gradient', value: 'linear-gradient(180deg, #FAF6EE 0%, #F1E7D8 100%)' },
    effects: {
      overlayGradient: 'linear-gradient(180deg, rgba(195,155,82,0.10) 0%, rgba(255,255,255,0) 55%, rgba(139,106,61,0.12) 100%)',
    },
  },
  floor: {
    negativeZExtent: 200,
    negativeZEdge: 'hard',
    negativeZFadeDistance: 24,
    grid: {
      spacing: 1,
      lineColor: '#B99D77',
      majorLineColor: '#9F7D52',
      fillColor: '#eeeeee',
      lineOpacity: 0.15,
      fillOpacity: 0,
      majorEvery: 1,
    },
  },
  carouselTray: {
    color: '#EDE2D0',
    opacity: 0.88,
    accentColor: '#C39B52',
    metalness: 0.35,
    roughness: 0.42,
    edgeStyle: 'knurled',
    surfacePattern: 'brushed',
    surfaceIntensity: 0.18,
    surfaceMaterial: 'dark-marble',
    materialApplication: { colorMix: 0.35, brightness: 1.0 },
  },
  highlightPalette: midnightLightHighlights,
  accentColor: '#A7793A',
  textColors: {
    primary: '#3A2A1B',
    secondary: '#7B664C',
    muted: '#BCA180',
    surface: '#FFF9EE',
  },
};
