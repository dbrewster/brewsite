// @internal — not part of the public API. Use @brewsite/themes bundles instead.
// Neon Cyber theme — light polarity variant.

import type { DiagramTheme } from '../types';
import { neonCyberTheme } from './neonCyber';

export const neonCyberLightTheme: DiagramTheme = {
  ...neonCyberTheme,
  node: {
    ...neonCyberTheme.node,
    defaultColor: '#F8FBFF',
    defaultBoxColor: '#D4E2F8',
    defaultLabelColor: '#1E2F5A',
    defaultSublabelColor: '#516498',
    defaultMetalness: 0.28,
    defaultRoughness: 0.32,
    defaultEmissiveIntensity: 0.03,
    glowIntensity: 0.06,
    defaultBorderColor: '#C0D0E8',
  },
  edge: {
    ...neonCyberTheme.edge,
    defaultColor: '#6C54BF',
    defaultFlowColor: '#11C9E8',
    defaultFlowSpeed: 0.65,
    defaultMetalness: 0.30,
    defaultRoughness: 0.34,
    flowPulseIntensity: 0.86,
  },
  group: {
    ...neonCyberTheme.group,
    defaultColor: '#EAF2FF',
    defaultBorderColor: '#8EA0D8',
    defaultLabelColor: '#1E2F5A',
    defaultBackColor: '#E8F0FFCC',
  },
  environment: {
    ...neonCyberTheme.environment,
    envMapIntensity: 0.19,
    skyColor: '#F5F8FF',
    horizonColor: '#EAF2FF',
  },
} as const;
