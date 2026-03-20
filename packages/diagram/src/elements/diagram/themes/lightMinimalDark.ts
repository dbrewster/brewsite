// @internal — not part of the public API. Use @brewsite/themes bundles instead.
// Light Minimal theme — dark polarity variant.

import type { DiagramTheme } from '../types';
import { lightMinimalTheme } from './lightMinimal';

export const lightMinimalDarkTheme: DiagramTheme = {
  ...lightMinimalTheme,
  node: {
    ...lightMinimalTheme.node,
    defaultColor: '#252C35',
    defaultBoxColor: '#3C4856',
    defaultLabelColor: '#E8EDF5',
    defaultSublabelColor: '#A8B2C2',
    defaultMetalness: 0.14,
    defaultRoughness: 0.52,
    defaultEmissiveIntensity: 0.01,
    defaultBorderColor: '#4E5A68',
  },
  edge: {
    ...lightMinimalTheme.edge,
    defaultColor: '#7FAEEA',
    defaultFlowColor: '#78D5E3',
    defaultFlowSpeed: 0.12,
    defaultMetalness: 0.12,
    defaultRoughness: 0.54,
    flowPulseIntensity: 0.18,
  },
  group: {
    ...lightMinimalTheme.group,
    defaultColor: '#2F3945',
    defaultBorderColor: '#54606E',
    defaultLabelColor: '#E8EDF5',
    defaultBackColor: '#252C35CC',
  },
  environment: {
    ...lightMinimalTheme.environment,
    envMapIntensity: 0.10,
    skyColor: '#101317',
    horizonColor: '#191E24',
  },
} as const;
