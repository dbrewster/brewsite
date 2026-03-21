// darkGlass DiagramTheme preset — light polarity variant.

import type { DiagramTheme } from '@brewsite/diagram';
import { darkGlassTheme } from './darkGlass';

export const darkGlassLightTheme: DiagramTheme = {
  ...darkGlassTheme,
  node: {
    ...darkGlassTheme.node,
    defaultColor: '#FFF9F5',
    defaultBoxColor: '#E2D4CA',
    defaultLabelColor: '#2B1F1A',
    defaultSublabelColor: '#6E5750',
    defaultThickness: '6%',
    defaultMetalness: 0.08,
    defaultRoughness: 0.65,
    nodeEnvMapIntensity: 0,
    defaultEmissiveIntensity: 0.02,
    glowIntensity: 0.0,
    defaultIconColor: '#735e58',
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
    defaultBorderHeight: '5.5%',
    defaultLabelColor: '#2B1F1A',
    defaultEdgeLightColor: '#B89F92',
    defaultBackColor: '#F2EAE2CC',
  },
  environment: {
    ...darkGlassTheme.environment,
    envMapUrl: 'none',
    envMapIntensity: 0,
    skyColor: '#F8F3EF',
    horizonColor: '#EFE6DE',
  },
} as const;
