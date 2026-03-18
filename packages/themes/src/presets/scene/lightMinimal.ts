// lightMinimal SceneTheme presets — minimal light/pastel aesthetic.

import type { SceneTheme, SceneThemeHighlightPalette } from '@brewsite/core';

// -- Highlight palettes tuned for the lightMinimal family --

const lightMinimalLightHighlights: SceneThemeHighlightPalette = {
  primary: {
    color: '#4070A8',
    mode: 'holographic',
    intensity: 0.28,
    blendMode: 'normal',
    backdropOpacity: 0.7,
    backdropColor: '#e8e4e0',
  },
  secondary: {
    color: '#6080A0',
    mode: 'holographic',
    intensity: 0.25,
    blendMode: 'normal',
    backdropOpacity: 0.7,
    backdropColor: '#e8e4e0',
  },
  tertiary: {
    color: '#3A8888',
    mode: 'glow',
    intensity: 0.28,
    blendMode: 'normal',
    backdropOpacity: 0.7,
    backdropColor: '#e8e4e0',
  },
  error: {
    color: '#AA2828',
    mode: 'holographic',
    intensity: 0.35,
    blendMode: 'normal',
    backdropOpacity: 0.7,
    backdropColor: '#e8e4e0',
    smoke: true,
  },
  warning: {
    color: '#997018',
    mode: 'holographic',
    intensity: 0.28,
    blendMode: 'normal',
    backdropOpacity: 0.7,
    backdropColor: '#e8e4e0',
  },
  success: {
    color: '#2A7A50',
    mode: 'glow',
    intensity: 0.28,
    blendMode: 'normal',
    backdropOpacity: 0.7,
    backdropColor: '#e8e4e0',
  },
  info: {
    color: '#3068A0',
    mode: 'glow',
    intensity: 0.25,
    blendMode: 'normal',
    backdropOpacity: 0.7,
    backdropColor: '#e8e4e0',
  },
};

const lightMinimalDarkHighlights: SceneThemeHighlightPalette = {
  primary: {
    color: '#6098C8',
    mode: 'holographic',
    intensity: 0.42,
    blendMode: 'additive',
    backdropOpacity: 0.7,
    backdropColor: '#000000',
  },
  secondary: {
    color: '#8098B0',
    mode: 'holographic',
    intensity: 0.38,
    blendMode: 'additive',
    backdropOpacity: 0.7,
    backdropColor: '#000000',
  },
  tertiary: {
    color: '#50A0A0',
    mode: 'glow',
    intensity: 0.42,
    blendMode: 'additive',
    backdropOpacity: 0.7,
    backdropColor: '#000000',
  },
  error: {
    color: '#CC3838',
    mode: 'holographic',
    intensity: 0.5,
    blendMode: 'additive',
    backdropOpacity: 0.7,
    backdropColor: '#000000',
    smoke: true,
  },
  warning: {
    color: '#C89828',
    mode: 'holographic',
    intensity: 0.42,
    blendMode: 'additive',
    backdropOpacity: 0.7,
    backdropColor: '#000000',
  },
  success: {
    color: '#3A9960',
    mode: 'glow',
    intensity: 0.42,
    blendMode: 'additive',
    backdropOpacity: 0.7,
    backdropColor: '#000000',
  },
  info: {
    color: '#5088BB',
    mode: 'glow',
    intensity: 0.38,
    blendMode: 'additive',
    backdropOpacity: 0.7,
    backdropColor: '#000000',
  },
};

/** lightMinimal family, light polarity. */
export const lightMinimalSceneTheme: SceneTheme = {
  colorMode: 'light',
  font: {
    htmlFamily: '"Inter", "Source Sans 3", sans-serif',
  },
  fontSize: {
    heading: 1.5,
    body: 1.0,
    label: 0.85,
    caption: 0.7,
    annotation: 0.6,
  },
  background: {
    fill: { kind: 'gradient', value: 'linear-gradient(180deg, #FFFFFF 0%, #F7F9FC 100%)' },
    effects: {
      overlayGradient: 'linear-gradient(180deg, rgba(34,50,72,0.00) 0%, rgba(34,50,72,0.04) 100%)',
    },
  },
  floor: {
    negativeZExtent: 200,
    negativeZEdge: 'hard',
    negativeZFadeDistance: 24,
    grid: {
      spacing: 1,
      lineColor: '#CAD2DF',
      majorLineColor: '#AAB8CB',
      fillColor: '#eeeeee',
      lineOpacity: 0.15,
      fillOpacity: 0,
      majorEvery: 1,
    },
  },
  carouselTray: {
    color: '#E8EBF0',
    opacity: 0.92,
    accentColor: '#AAB8CB',
    metalness: 0.04,
    roughness: 0.82,
    edgeStyle: 'matte',
    surfacePattern: 'none',
    surfaceIntensity: 0,
    surfaceMaterial: 'white-marble',
    materialApplication: { colorMix: 0.15, brightness: 1.2, saturation: 0.2, depthMix: 0.2 },
  },
  highlightPalette: lightMinimalLightHighlights,
};

/** lightMinimal family, dark polarity. */
export const lightMinimalDarkSceneTheme: SceneTheme = {
  colorMode: 'dark',
  font: {
    htmlFamily: '"Inter", "Source Sans 3", sans-serif',
  },
  fontSize: {
    heading: 1.5,
    body: 1.0,
    label: 0.85,
    caption: 0.7,
    annotation: 0.6,
  },
  background: {
    fill: { kind: 'gradient', value: 'linear-gradient(180deg, #101317 0%, #191E24 100%)' },
    effects: {
      overlayGradient: 'linear-gradient(180deg, rgba(127,174,234,0.05) 0%, rgba(0,0,0,0.20) 100%)',
    },
  },
  floor: {
    negativeZExtent: 200,
    negativeZEdge: 'hard',
    negativeZFadeDistance: 24,
    grid: {
      spacing: 1,
      lineColor: '#4A5563',
      majorLineColor: '#647488',
      fillColor: '#444444',
      lineOpacity: 0.15,
      fillOpacity: 0,
      majorEvery: 1,
    },
  },
  carouselTray: {
    color: '#1C2128',
    opacity: 0.78,
    accentColor: '#647488',
    metalness: 0.12,
    roughness: 0.68,
    edgeStyle: 'matte',
    surfacePattern: 'none',
    surfaceIntensity: 0,
    surfaceMaterial: 'white-marble',
    materialApplication: { colorMix: 0.25, brightness: 1.1, saturation: 0.3, depthMix: 0.3 },
  },
  highlightPalette: lightMinimalDarkHighlights,
};
