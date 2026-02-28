// Dark Glass theme — deep navy with polished metallic surfaces and subtle node glow.
// This is the package default theme. High visual impact for tech/architecture diagrams.

import type { DiagramTheme } from '../types';

/**
 * Dark Glass: the default diagram theme.
 * Deep navy nodes, polished PBR materials, subtle glow, environment IBL from
 * the bundled Radiance HDR. Optimised for dark-background presentation contexts.
 */
export const darkGlassTheme: DiagramTheme = {
  node: {
    defaultColor:             '#1a2240',
    defaultMetalness:          0.40,
    defaultRoughness:          0.30,
    defaultEmissiveIntensity:  0.10,
    defaultDepth:              0.28,
    cornerRadius:              0.06,
    glowIntensity:             0.15,
    defaultLabelColor:         '#e8eeff',
    defaultSublabelColor:      '#8ba4d4',
    labelSizeFactor:           1.0,
    sublabelSizeFactor:        1.0,
    defaultIconStyle:          'extruded',
  },
  edge: {
    defaultColor:         '#702dc6',
    defaultFlowColor:     '#53ec68',
    defaultFlowSpeed:     0.3,
    defaultFlowWidth:     0.2,
    defaultThickness:     0.065,
    defaultMetalness:     0.50,
    defaultRoughness:     0.30,
    routing:              'curved',
    landing:              'nearest-face',
    smoothness:           1.2,
    use3DArrows:          true,
  },
  group: {
    defaultColor:         '#0d1126',
    defaultBorderColor:   '#2a4080',
    defaultFillOpacity:   0.10,
    defaultBorderOpacity: 0.65,
  },
  environment: {
    envMapUrl:       '/assets/envmaps/diagram-default.hdr',
    envMapIntensity: 0.9,
    skyColor:        '#1a2a6c',
    horizonColor:    '#0a1030',
  },
  palette: ['#2a4fa0', '#1e7a5a', '#8a2a70', '#a06a20', '#2a8090'],
} as const;
