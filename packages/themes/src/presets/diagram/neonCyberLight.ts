// neonCyber DiagramTheme preset — light polarity variant.

import type { DiagramTheme } from '@brewsite/diagram';
import { neonCyberTheme } from './neonCyber';

export const neonCyberLightTheme: DiagramTheme = {
  ...neonCyberTheme,
  node: {
    ...neonCyberTheme.node,
    defaultColor: '#F8FBFF',
    defaultBoxColor: '#D4E2F8',
    defaultLabelColor: '#1E2F5A',
    defaultSublabelColor: '#516498',
    defaultMetalness: 0.08,
    defaultRoughness: 0.55,
    nodeEnvMapIntensity: 0,
    defaultEmissiveIntensity: 0.03,
    glowIntensity: 0.06,
    defaultIconColor: '#0a2a30',
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
    defaultEdgeLightColor: '#8EA0D8',
  },
  environment: {
    ...neonCyberTheme.environment,
    envMapUrl: 'none',
    envMapIntensity: 0,
    skyColor: '#F5F8FF',
    horizonColor: '#EAF2FF',
  },
} as const;
