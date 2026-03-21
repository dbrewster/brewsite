// midnight DiagramTheme preset — light polarity variant.

import type { DiagramTheme } from '@brewsite/diagram';
import { midnightTheme } from './midnight';

export const midnightLightTheme: DiagramTheme = {
  ...midnightTheme,
  node: {
    ...midnightTheme.node,
    defaultColor: '#FFF9EE',
    defaultBoxColor: '#E5D4BF',
    defaultLabelColor: '#3A2A1B',
    defaultSublabelColor: '#7B664C',
    defaultThickness: '6.5%',
    defaultMetalness: 0.12,
    defaultRoughness: 0.58,
    defaultEmissiveIntensity: 0.01,
    nodeEnvMapIntensity: 0,
    defaultIconColor: '#1a1a3a',
    defaultBorderColor: '#D4C0A8',
  },
  edge: {
    ...midnightTheme.edge,
    defaultColor: '#A7793A',
    defaultFlowColor: '#C07A59',
    defaultFlowSpeed: 0.20,
    defaultMetalness: 0.18,
    defaultRoughness: 0.60,
    flowPulseIntensity: 0.46,
  },
  group: {
    ...midnightTheme.group,
    defaultColor: '#F2E6D5',
    defaultBorderColor: '#B58C5A',
    defaultBorderHeight: '5.5%',
    defaultLabelColor: '#3A2A1B',
    defaultEdgeLightColor: '#B58C5A',
    defaultBackColor: '#F0E8D8CC',
  },
  environment: {
    ...midnightTheme.environment,
    envMapUrl: 'none',
    envMapIntensity: 0,
    skyColor: '#FAF6EE',
    horizonColor: '#F1E7D8',
  },
} as const;
