// midnight SceneTheme presets — warm cinematic tone with bronze/amber authority.

import type { SceneTheme } from '@brewsite/core';

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
  },
};
