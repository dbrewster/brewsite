// darkGlass SceneTheme presets — obsidian/burgundy control-room look with ember accents.

import type { SceneTheme } from '@brewsite/core';

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
};
