// darkGlass SceneTheme presets — obsidian/burgundy control-room look with ember accents.

import type { SceneTheme, SceneThemeHighlightPalette } from '@brewsite/core';

// -- Highlight palettes tuned for the darkGlass family --

const darkGlassDarkHighlights: SceneThemeHighlightPalette = {
  primary: {
    color: '#E06828',
    mode: 'holographic',
    intensity: 0.55,
    blendMode: 'additive',
    backdropOpacity: 0.7,
    backdropColor: '#000000',
  },
  secondary: {
    color: '#C04A4A',
    mode: 'holographic',
    intensity: 0.45,
    blendMode: 'additive',
    backdropOpacity: 0.7,
    backdropColor: '#000000',
  },
  tertiary: {
    color: '#D4A040',
    mode: 'glow',
    intensity: 0.5,
    blendMode: 'additive',
    backdropOpacity: 0.7,
    backdropColor: '#000000',
  },
  error: {
    color: '#BB2222',
    mode: 'holographic',
    intensity: 0.6,
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
    color: '#38AA6E',
    mode: 'glow',
    intensity: 0.5,
    blendMode: 'additive',
    backdropOpacity: 0.7,
    backdropColor: '#000000',
  },
  info: {
    color: '#D08848',
    mode: 'glow',
    intensity: 0.45,
    blendMode: 'additive',
    backdropOpacity: 0.7,
    backdropColor: '#000000',
  },
};

const darkGlassLightHighlights: SceneThemeHighlightPalette = {
  primary: {
    color: '#B85520',
    mode: 'holographic',
    intensity: 0.38,
    blendMode: 'normal',
    backdropOpacity: 0.7,
    backdropColor: '#e8e4e0',
  },
  secondary: {
    color: '#8A3535',
    mode: 'holographic',
    intensity: 0.32,
    blendMode: 'normal',
    backdropOpacity: 0.7,
    backdropColor: '#e8e4e0',
  },
  tertiary: {
    color: '#A07828',
    mode: 'glow',
    intensity: 0.35,
    blendMode: 'normal',
    backdropOpacity: 0.7,
    backdropColor: '#e8e4e0',
  },
  error: {
    color: '#991818',
    mode: 'holographic',
    intensity: 0.42,
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
    color: '#227A4A',
    mode: 'glow',
    intensity: 0.35,
    blendMode: 'normal',
    backdropOpacity: 0.7,
    backdropColor: '#e8e4e0',
  },
  info: {
    color: '#A06838',
    mode: 'glow',
    intensity: 0.3,
    blendMode: 'normal',
    backdropOpacity: 0.7,
    backdropColor: '#e8e4e0',
  },
};

/** darkGlass family, dark polarity. */
export const darkGlassSceneTheme: SceneTheme = {
  colorMode: 'dark',
  font: {
    htmlFamily: '"Sora", "Inter", sans-serif',
  },
  fontSize: {
    heading: 1.5,
    body: 1.0,
    label: 0.85,
    caption: 0.7,
    annotation: 0.6,
  },
  background: {
    fill: { kind: 'gradient', value: 'linear-gradient(180deg, #070504 0%, #130B08 100%)' },
    effects: {
      overlayGradient: 'linear-gradient(180deg, rgba(227,106,46,0.14) 0%, rgba(122,31,45,0.10) 42%, rgba(0,0,0,0.30) 100%)',
    },
  },
  floor: {
    negativeZExtent: 200,
    negativeZEdge: 'hard',
    negativeZFadeDistance: 24,
    grid: {
      spacing: 1,
      lineColor: '#3A2924',
      majorLineColor: '#6B4338',
      fillColor: '#444444',
      lineOpacity: 0.15,
      fillOpacity: 0,
      majorEvery: 1,
    },
  },
  carouselTray: {
    color: '#0A0608',
    opacity: 0.92,
    accentColor: '#E36A2E',
    metalness: 0.6,
    roughness: 0.1,
    edgeStyle: 'smooth',
    surfacePattern: 'grain',
    surfaceIntensity: 0.10,
    surfaceMaterial: 'obsidian',
    materialApplication: { colorMix: 0.7, brightness: 0.5, saturation: 0.6, depthMix: 0.8 },
  },
  highlightPalette: darkGlassDarkHighlights,
  accentColor: '#B33A2B',
  textColors: {
    primary: '#F2E6DE',
    secondary: '#B79B8F',
    muted: '#6E5750',
    surface: '#1E1412',
  },
};

/** darkGlass family, light polarity. */
export const darkGlassLightSceneTheme: SceneTheme = {
  colorMode: 'light',
  font: {
    htmlFamily: '"Sora", "Inter", sans-serif',
  },
  fontSize: {
    heading: 1.5,
    body: 1.0,
    label: 0.85,
    caption: 0.7,
    annotation: 0.6,
  },
  background: {
    fill: { kind: 'gradient', value: 'linear-gradient(180deg, #F8F3EF 0%, #EFE6DE 100%)' },
    effects: {
      overlayGradient: 'linear-gradient(180deg, rgba(227,106,46,0.08) 0%, rgba(255,255,255,0) 52%, rgba(110,87,80,0.10) 100%)',
    },
  },
  floor: {
    negativeZExtent: 200,
    negativeZEdge: 'hard',
    negativeZFadeDistance: 24,
    grid: {
      spacing: 1,
      lineColor: '#BFA99E',
      majorLineColor: '#9A7569',
      fillColor: '#eeeeee',
      lineOpacity: 0.15,
      fillOpacity: 0,
      majorEvery: 1,
    },
  },
  carouselTray: {
    color: '#EDE3DB',
    opacity: 0.90,
    accentColor: '#C4704A',
    metalness: 0.2,
    roughness: 0.4,
    edgeStyle: 'smooth',
    surfacePattern: 'grain',
    surfaceIntensity: 0.12,
    surfaceMaterial: 'onyx',
    materialApplication: { colorMix: 0.4, brightness: 1.1 },
  },
  highlightPalette: darkGlassLightHighlights,
  accentColor: '#E36A2E',
  textColors: {
    primary: '#2B1F1A',
    secondary: '#6E5750',
    muted: '#B79B8F',
    surface: '#FFF9F5',
  },
};
