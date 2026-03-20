// @internal — not part of the public API. Use @brewsite/themes bundles instead.
// Dark Glass theme — light polarity variant.

import type { DiagramTheme } from '../types';
import { darkGlassTheme } from './darkGlass';

export const darkGlassLightTheme: DiagramTheme = {
  ...darkGlassTheme,
  node: {
    ...darkGlassTheme.node,
    defaultColor: '#FFF9F5',
    defaultBoxColor: '#E2D4CA',
    defaultLabelColor: '#2B1F1A',
    defaultSublabelColor: '#6E5750',
    defaultMetalness: 0.40,
    defaultRoughness: 0.46,
    defaultEmissiveIntensity: 0.02,
    glowIntensity: 0.0,
    defaultBorderColor: '#D4C0B4',
  },
  edge: {
    ...darkGlassTheme.edge,
    defaultColor: '#B33A2B',
    defaultFlowColor: '#C96A3F',
    defaultFlowSpeed: 0.24,
    defaultMetalness: 0.26,
    defaultRoughness: 0.52,
    flowPulseIntensity: 0.58,
  },
  group: {
    ...darkGlassTheme.group,
    defaultColor: '#F4EAE3',
    defaultBorderColor: '#B89F92',
    defaultLabelColor: '#2B1F1A',
  },
  environment: {
    ...darkGlassTheme.environment,
    envMapIntensity: 0.18,
    skyColor: '#F8F3EF',
    horizonColor: '#EFE6DE',
  },
} as const;
