// lightMinimal SceneTheme presets — minimal light/pastel aesthetic.

import type { SceneTheme } from '@brewsite/core';

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
  },
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
  },
};
