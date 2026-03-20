// Enterprise DiagramTheme preset — light polarity variant.

import type { DiagramTheme } from '@brewsite/diagram';
import { enterpriseTheme } from './enterprise';

export const enterpriseLightTheme: DiagramTheme = {
  ...enterpriseTheme,
  node: {
    ...enterpriseTheme.node,
    defaultColor: '#dcdce6',
    defaultBoxColor: '#D5DFED',
    defaultLabelColor: '#1F334E',
    defaultSublabelColor: '#5A6D86',
    defaultMetalness: 0.06,
    defaultRoughness: 0.65,
    nodeEnvMapIntensity: 0,
    defaultEmissiveIntensity: 0.0,
    defaultIconColor: '#1e3a5f',
    defaultBorderColor: '#B8C4D4',
  },
  edge: {
    ...enterpriseTheme.edge,
    defaultColor: '#5E7EA9',
    defaultFlowColor: '#b84ef4',
    defaultFlowSpeed: 0.24,
    defaultMetalness: 0.28,
    defaultRoughness: 0.60,
    flowPulseIntensity: 0.62,
  },
  group: {
    ...enterpriseTheme.group,
    defaultColor: '#E8EEF6',
    defaultBorderColor: '#8BA0BA',
    defaultLabelColor: '#1F334E',
    defaultEdgeLightColor: '#8BA0BA',
    defaultBackColor: '#E8EEF6CC',
  },
  environment: {
    ...enterpriseTheme.environment,
    envMapUrl: 'none',
    envMapIntensity: 0,
    skyColor: '#F3F6FA',
    horizonColor: '#E7EDF5',
  },
} as const;
