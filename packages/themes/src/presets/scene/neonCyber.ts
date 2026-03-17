// neonCyber SceneTheme presets — high-contrast neon/cyberpunk aesthetic.

import type { SceneTheme } from '@brewsite/core';

/** neonCyber family, dark polarity. */
export const neonCyberSceneTheme: SceneTheme = {
  colorMode: 'dark',
  font: {
    htmlFamily: '"Space Grotesk", "Rajdhani", sans-serif',
  },
  fontSize: {
    heading: 1.5,
    body: 1.0,
    label: 0.85,
    caption: 0.7,
    annotation: 0.6,
  },
  background: {
    fill: { kind: 'gradient', value: 'linear-gradient(180deg, #02030D 0%, #09122A 100%)' },
    effects: {
      overlayGradient: 'linear-gradient(180deg, rgba(138,61,255,0.16) 0%, rgba(0,231,255,0.08) 38%, rgba(0,0,0,0.28) 100%)',
    },
  },
  floor: {
    negativeZExtent: 200,
    negativeZEdge: 'hard',
    negativeZFadeDistance: 24,
    grid: {
      spacing: 1,
      lineColor: '#2D2D66',
      majorLineColor: '#6E55D1',
      fillColor: '#444444',
      lineOpacity: 0.15,
      fillOpacity: 0,
      majorEvery: 1,
    },
  },
  carouselTray: {
    color: '#0C0C30',
    opacity: 0.80,
    accentColor: '#8A3DFF',
    metalness: 0.3,
    roughness: 0.45,
    edgeStyle: 'ridged',
    surfacePattern: 'crosshatch',
    surfaceIntensity: 0.5,
    surfaceMaterial: 'copper',
    materialApplication: { colorMix: 0.6, iridescence: 0.2, brightness: .3, iridescenceIOR: 0.8 },
  },
};

/** neonCyber family, light polarity. */
export const neonCyberLightSceneTheme: SceneTheme = {
  colorMode: 'light',
  font: {
    htmlFamily: '"Space Grotesk", "Rajdhani", sans-serif',
  },
  fontSize: {
    heading: 1.5,
    body: 1.0,
    label: 0.85,
    caption: 0.7,
    annotation: 0.6,
  },
  background: {
    fill: { kind: 'gradient', value: 'linear-gradient(180deg, #F5F8FF 0%, #EAF2FF 100%)' },
    effects: {
      overlayGradient: 'linear-gradient(180deg, rgba(138,61,255,0.08) 0%, rgba(0,231,255,0.06) 36%, rgba(30,47,90,0.08) 100%)',
    },
  },
  floor: {
    negativeZExtent: 200,
    negativeZEdge: 'hard',
    negativeZFadeDistance: 24,
    grid: {
      spacing: 1,
      lineColor: '#A8B7E6',
      majorLineColor: '#8097D5',
      fillColor: '#eeeeee',
      lineOpacity: 0.15,
      fillOpacity: 0,
      majorEvery: 1,
    },
  },
  carouselTray: {
    color: '#C0C8E0',
    opacity: 0.88,
    accentColor: '#6E55D1',
    metalness: 0.35,
    roughness: 0.35,
    surfacePattern: 'crosshatch',
    surfaceIntensity: 0.50,
    surfaceMaterial: 'gold',
    materialApplication: { colorMix: 0.6, brightness: 0.85, saturation: 1.4, iridescence: 0.75 },
  },
};
