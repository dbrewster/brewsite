// Enterprise theme — light polarity variant.

import type { DiagramTheme } from '../types';
import { enterpriseTheme } from './enterprise';

export const enterpriseLightTheme: DiagramTheme = {
  ...enterpriseTheme,
  node: {
    ...enterpriseTheme.node,
    defaultColor: '#FFFFFF',
    defaultBoxColor: '#E8EEF6',
    defaultLabelColor: '#1F334E',
    defaultSublabelColor: '#5A6D86',
    defaultMetalness: 0.08,
    defaultRoughness: 0.62,
    defaultEmissiveIntensity: 0.0,
  },
  edge: {
    ...enterpriseTheme.edge,
    defaultColor: '#5E7EA9',
    defaultFlowColor: '#5A8A92',
    defaultFlowSpeed: 0.04,
    defaultMetalness: 0.08,
    defaultRoughness: 0.60,
    flowPulseIntensity: 0.22,
  },
  group: {
    ...enterpriseTheme.group,
    defaultColor: '#E8EEF6',
    defaultBorderColor: '#8BA0BA',
    defaultLabelColor: '#1F334E',
  },
  environment: {
    ...enterpriseTheme.environment,
    envMapIntensity: 0.11,
    skyColor: '#F3F6FA',
    horizonColor: '#E7EDF5',
  },
} as const;
