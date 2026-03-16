// Enterprise SceneTheme presets — board-ready strategic clarity.

import type { SceneTheme } from '@brewsite/core';

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
    color: '#1E2F44',
    opacity: 0.82,
    accentColor: '#5090e0',
    metalness: 0.35,
    roughness: 0.6,
    edgeStyle: 'knurled',
    surfacePattern: 'brushed',
    surfaceIntensity: 0.25,
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
  },
};
