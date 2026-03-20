// Enterprise theme — light polarity variant.

import type { DiagramTheme } from '../types';
import { enterpriseTheme } from './enterprise';

export const enterpriseLightTheme: DiagramTheme = {
  ...enterpriseTheme,
  node: {
    ...enterpriseTheme.node,
    defaultColor: '#dcdce6',
    defaultBoxColor: '#D5DFED',
    defaultLabelColor: '#1F334E',
    defaultSublabelColor: '#5A6D86',
    defaultMetalness: 0.08,
    defaultRoughness: 0.62,
    defaultEmissiveIntensity: 0.0,
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
    defaultBackColor: '#E8EEF6CC',
  },
  environment: {
    ...enterpriseTheme.environment,
    envMapIntensity: 0.11,
    skyColor: '#F3F6FA',
    horizonColor: '#E7EDF5',
  },
} as const;

/** Default light DiagramTheme — enterprise aesthetic. Used as the pre-loaded registry fallback. */
export const defaultLightDiagramTheme: DiagramTheme = enterpriseLightTheme;
