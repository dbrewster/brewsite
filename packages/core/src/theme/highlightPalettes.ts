// Default highlight palettes for dark and light scene polarities.
// Theme presets in @brewsite/themes can override individual series.

import type { SceneThemeHighlightPalette } from './types';

/**
 * Default highlight palette for dark-polarity scenes.
 * Uses additive blending — colors are bright, designed to glow against dark backgrounds.
 */
export const darkHighlightPalette: SceneThemeHighlightPalette = {
  primary: {
    color: '#5090e0',
    mode: 'holographic',
    intensity: 0.5,
    blendMode: 'additive',
    backdropOpacity: 0.7,
    backdropColor: '#000000',
  },
  secondary: {
    color: '#8A6EDB',
    mode: 'holographic',
    intensity: 0.45,
    blendMode: 'additive',
    backdropOpacity: 0.7,
    backdropColor: '#000000',
  },
  tertiary: {
    color: '#4ECDC4',
    mode: 'glow',
    intensity: 0.6,
    blendMode: 'additive',
    backdropOpacity: 0.7,
    backdropColor: '#000000',
  },
  error: {
    color: '#FF4444',
    mode: 'holographic',
    intensity: 0.6,
    blendMode: 'additive',
    backdropOpacity: 0.7,
    backdropColor: '#000000',
    smoke: true,
  },
  warning: {
    color: '#FFB020',
    mode: 'holographic',
    intensity: 0.5,
    blendMode: 'additive',
    backdropOpacity: 0.7,
    backdropColor: '#000000',
  },
  success: {
    color: '#44CC66',
    mode: 'glow',
    intensity: 0.6,
    blendMode: 'additive',
    backdropOpacity: 0.7,
    backdropColor: '#000000',
  },
  info: {
    color: '#44AAFF',
    mode: 'glow',
    intensity: 0.5,
    blendMode: 'additive',
    backdropOpacity: 0.7,
    backdropColor: '#000000',
  },
};

/**
 * Default highlight palette for light-polarity scenes.
 * Uses normal blending — colors are deeper/saturated, designed as tinted
 * overlays that contrast against light backgrounds without washing out.
 */
export const lightHighlightPalette: SceneThemeHighlightPalette = {
  primary: {
    color: '#2060B0',
    mode: 'holographic',
    intensity: 0.35,
    blendMode: 'normal',
    backdropOpacity: 0.7,
    backdropColor: '#e8e4e0',
  },
  secondary: {
    color: '#6B4EAA',
    mode: 'holographic',
    intensity: 0.3,
    blendMode: 'normal',
    backdropOpacity: 0.7,
    backdropColor: '#e8e4e0',
  },
  tertiary: {
    color: '#1A9E90',
    mode: 'glow',
    intensity: 0.4,
    blendMode: 'normal',
    backdropOpacity: 0.7,
    backdropColor: '#e8e4e0',
  },
  error: {
    color: '#CC2222',
    mode: 'holographic',
    intensity: 0.4,
    blendMode: 'normal',
    backdropOpacity: 0.7,
    backdropColor: '#e8e4e0',
    smoke: true,
  },
  warning: {
    color: '#CC8800',
    mode: 'holographic',
    intensity: 0.35,
    blendMode: 'normal',
    backdropOpacity: 0.7,
    backdropColor: '#e8e4e0',
  },
  success: {
    color: '#228844',
    mode: 'glow',
    intensity: 0.4,
    blendMode: 'normal',
    backdropOpacity: 0.7,
    backdropColor: '#e8e4e0',
  },
  info: {
    color: '#2266BB',
    mode: 'glow',
    intensity: 0.35,
    blendMode: 'normal',
    backdropOpacity: 0.7,
    backdropColor: '#e8e4e0',
  },
};
