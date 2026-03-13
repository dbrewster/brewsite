// Light Canvas theme — dark polarity variant.

import type { DiagramTheme } from '../types';
import { lightCanvasTheme } from './lightCanvas';

export const lightCanvasDarkTheme: DiagramTheme = {
  ...lightCanvasTheme,
  node: {
    ...lightCanvasTheme.node,
    defaultColor: '#232F40',
    defaultBoxColor: '#3A4D65',
    defaultLabelColor: '#E8EEF7',
    defaultSublabelColor: '#A8B4C4',
    defaultMetalness: 0.16,
    defaultRoughness: 0.42,
    defaultEmissiveIntensity: 0.02,
  },
  edge: {
    ...lightCanvasTheme.edge,
    defaultColor: '#3D63D9',
    defaultFlowColor: '#1D93AE',
    defaultFlowSpeed: 0.24,
    defaultMetalness: 0.16,
    defaultRoughness: 0.44,
    flowPulseIntensity: 0.30,
  },
  group: {
    ...lightCanvasTheme.group,
    defaultColor: '#2E3C4F',
    defaultBorderColor: '#566A86',
    defaultLabelColor: '#E8EEF7',
  },
  environment: {
    ...lightCanvasTheme.environment,
    envMapIntensity: 0.35,
    skyColor: '#131923',
    horizonColor: '#1C2533',
  },
} as const;
