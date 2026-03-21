// Enterprise SceneTheme presets — board-ready strategic clarity.

import type { SceneTheme, SceneThemeHighlightPalette } from '@brewsite/core';

// -- Highlight palettes tuned for the enterprise family --

const enterpriseDarkHighlights: SceneThemeHighlightPalette = {
  primary: {
    color: '#4A88D0',
    mode: 'holographic',
    intensity: 0.5,
    blendMode: 'additive',
    backdropOpacity: 0.7,
    backdropColor: '#000000',
  },
  secondary: {
    color: '#a359d5',
    mode: 'holographic',
    intensity: 0.45,
    blendMode: 'additive',
    backdropOpacity: 0.7,
    backdropColor: '#000000',
  },
  tertiary: {
    color: '#5aa085',
    mode: 'glow',
    intensity: 0.6,
    blendMode: 'additive',
    backdropOpacity: 0.7,
    backdropColor: '#000000',
  },
  error: {
    color: '#CC3333',
    mode: 'holographic',
    intensity: 0.6,
    blendMode: 'additive',
    backdropOpacity: 0.7,
    backdropColor: '#000000',
    smoke: true,
  },
  warning: {
    color: '#D49520',
    mode: 'holographic',
    intensity: 0.5,
    blendMode: 'additive',
    backdropOpacity: 0.7,
    backdropColor: '#000000',
  },
  success: {
    color: '#3AAA7A',
    mode: 'glow',
    intensity: 0.5,
    blendMode: 'additive',
    backdropOpacity: 0.7,
    backdropColor: '#000000',
  },
  info: {
    color: '#5090D0',
    mode: 'glow',
    intensity: 0.45,
    blendMode: 'additive',
    backdropOpacity: 0.7,
    backdropColor: '#000000',
  },
};

const enterpriseLightHighlights: SceneThemeHighlightPalette = {
  primary: {
    color: '#2A5EA0',
    mode: 'holographic',
    intensity: 0.35,
    blendMode: 'normal',
    backdropOpacity: 0.7,
    backdropColor: '#e8e4e0',
  },
  secondary: {
    color: '#4A6E90',
    mode: 'holographic',
    intensity: 0.3,
    blendMode: 'normal',
    backdropOpacity: 0.7,
    backdropColor: '#e8e4e0',
  },
  tertiary: {
    color: '#2A7A7A',
    mode: 'glow',
    intensity: 0.35,
    blendMode: 'normal',
    backdropOpacity: 0.7,
    backdropColor: '#e8e4e0',
  },
  error: {
    color: '#B02222',
    mode: 'holographic',
    intensity: 0.4,
    blendMode: 'normal',
    backdropOpacity: 0.7,
    backdropColor: '#e8e4e0',
    smoke: true,
  },
  warning: {
    color: '#B07A10',
    mode: 'holographic',
    intensity: 0.35,
    blendMode: 'normal',
    backdropOpacity: 0.7,
    backdropColor: '#e8e4e0',
  },
  success: {
    color: '#1E7A55',
    mode: 'glow',
    intensity: 0.35,
    blendMode: 'normal',
    backdropOpacity: 0.7,
    backdropColor: '#e8e4e0',
  },
  info: {
    color: '#2868A8',
    mode: 'glow',
    intensity: 0.3,
    blendMode: 'normal',
    backdropOpacity: 0.7,
    backdropColor: '#e8e4e0',
  },
};

/** Enterprise family, dark polarity. */
export const enterpriseSceneTheme: SceneTheme = {
  colorMode: 'dark',
  font: {
    htmlFamily: '"IBM Plex Sans", "Inter", sans-serif',
  },
  fontSize: {
    heading: 1.5,
    body: 1.0,
    label: 0.85,
    caption: 0.7,
    annotation: 0.6,
  },
  background: {
    fill: { kind: 'gradient', value: 'linear-gradient(180deg, #0A1424 0%, #15253A 100%)' },
    effects: {
      overlayGradient: 'linear-gradient(180deg, rgba(79,118,184,0.10) 0%, rgba(0,0,0,0.22) 100%)',
    },
  },
  floor: {
    negativeZExtent: 200,
    negativeZEdge: 'hard',
    negativeZFadeDistance: 24,
    grid: {
      spacing: 1,
      lineColor: '#354A67',
      majorLineColor: '#516C93',
      fillColor: '#444444',
      lineOpacity: 0.15,
      fillOpacity: 0,
      majorEvery: 1,
    },
  },
  carouselTray: {
    // color: '#1E2F44',
    opacity: 1,
    accentColor: '#0a172b',
    metalness: 0.35,
    roughness: 0.6,
    surfaceIntensity: 0.25,
    surfaceMaterial: 'steel',
    materialApplication: { colorMix: 0.5, brightness: .2, saturation: 0.7 },
  },
  highlightPalette: enterpriseDarkHighlights,
  accentColor: '#4F76B8',
  textColors: {
    primary: '#E5EEFA',
    secondary: '#A8B8CF',
    muted: '#5A6D86',
    surface: '#1E324F',
  },
};

/** Enterprise family, light polarity. */
export const enterpriseLightSceneTheme: SceneTheme = {
  colorMode: 'light',
  font: {
    htmlFamily: '"IBM Plex Sans", "Inter", sans-serif',
  },
  fontSize: {
    heading: 1.5,
    body: 1.0,
    label: 0.85,
    caption: 0.7,
    annotation: 0.6,
  },
  background: {
    fill: { kind: 'gradient', value: 'linear-gradient(180deg, #F3F6FA 0%, #E7EDF5 100%)' },
    effects: {
      overlayGradient: 'linear-gradient(180deg, rgba(79,118,184,0.06) 0%, rgba(31,51,78,0.08) 100%)',
    },
  },
  floor: {
    negativeZExtent: 200,
    negativeZEdge: 'hard',
    negativeZFadeDistance: 24,
    grid: {
      spacing: 1,
      lineColor: '#A0B1C6',
      majorLineColor: '#7F95B2',
      fillColor: '#eeeeee',
      lineOpacity: 0.15,
      fillOpacity: 0,
      majorEvery: 1,
    },
  },
  carouselTray: {
    color: '#D0DAE4',
    opacity: 0.88,
    accentColor: '#3A6DB5',
    metalness: 0.25,
    roughness: 0.55,
    edgeStyle: 'knurled',
    surfacePattern: 'brushed',
    surfaceIntensity: 0.15,
    surfaceMaterial: 'steel',
    materialApplication: { colorMix: 0.35, brightness: 1.2 },
  },
  highlightPalette: enterpriseLightHighlights,
  accentColor: '#5E7EA9',
  textColors: {
    primary: '#1F334E',
    secondary: '#5A6D86',
    muted: '#A8B8CF',
    surface: '#FFFFFF',
  },
};
