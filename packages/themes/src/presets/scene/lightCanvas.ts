// lightCanvas SceneTheme presets — clean light/white canvas aesthetic.

import type { SceneTheme } from '@brewsite/core';

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
};
