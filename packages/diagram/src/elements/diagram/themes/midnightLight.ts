// @internal — not part of the public API. Use @brewsite/themes bundles instead.
// Midnight theme — light polarity variant.

import type { DiagramTheme } from '../types';
import { midnightTheme } from './midnight';

export const midnightLightTheme: DiagramTheme = {
  ...midnightTheme,
  node: {
    ...midnightTheme.node,
    defaultColor: '#FFF9EE',
    defaultBoxColor: '#E5D4BF',
    defaultLabelColor: '#3A2A1B',
    defaultSublabelColor: '#7B664C',
    defaultMetalness: 0.12,
    defaultRoughness: 0.58,
    defaultEmissiveIntensity: 0.01,
    nodeEnvMapIntensity: 0,
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
    defaultLabelColor: '#3A2A1B',
    defaultBackColor: '#F0E8D8CC',
  },
  environment: {
    ...midnightTheme.environment,
    envMapIntensity: 0.14,
    skyColor: '#FAF6EE',
    horizonColor: '#F1E7D8',
  },
} as const;
