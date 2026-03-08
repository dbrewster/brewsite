// Neon Cyber theme — near-black backgrounds, saturated neon accents, strong glow.
// Orthogonal routing by default for a structured "circuit board" look.

import type { DiagramTheme } from '../types';

/**
 * Neon Cyber: dark backgrounds with electric neon accent colours.
 * Orthogonal routing + 3D arrows by default. Strong node glow.
 * Best for dark-room demo contexts and "system architecture" decks.
 */
export const neonCyberTheme: DiagramTheme = {
  node: {
    defaultColor:             '#0a0e1a',
    defaultMetalness:          0.55,
    defaultRoughness:          0.20,
    defaultEmissiveIntensity:  0.22,
    defaultThickness:          0.22,
    cornerRadius:              0.04,
    glowIntensity:             0.55,
    defaultLabelColor:         '#00ffcc',
    defaultSublabelColor:      '#80ffe6',
    labelSizeFactor:           1.0,
    sublabelSizeFactor:        1.0,
    defaultIconStyle:          'extruded',
    defaultSize:               [4, 2] as const,
    defaultIconScale:          0.6,
    defaultIconDepthFactor:    0.5,
    defaultIconDepth:          0.15,
    glowSpread:                2.8,
    sideColorDarkenFactor:     -0.15,
    borderColorLightenFactor:  0.25,
    labelFontSizeBase:         0.28,
    sublabelFontSizeBase:      0.18,
  },
  edge: {
    defaultColor:         '#00ccff',
    defaultFlowSpeed:     0.8,
    defaultFlowWidth:     0.16,
    defaultThickness:     0.055,
    defaultMetalness:     0.70,
    defaultRoughness:     0.15,
    routing:              'orthogonal',
    landing:              'nearest-face',
    smoothness:           1.0,
    use3DArrows:          true,
    tubeRadialSegments:   12,
    organicVariation:     2.0,
    flowPulseIntensity:   0.9,
  },
  group: {
    defaultColor:         '#050810',
    defaultBorderColor:   '#00ccff',
    defaultBorderWidth:   1.75,
    defaultBorderHeight:  1,
    defaultFillOpacity:   0.07,
    defaultBorderOpacity: 0.80,
    defaultLabelColor:    '#00ffcc',
    borderMetalness:      0.60,
    borderRoughness:      0.20,
    borderSideDarken:     0.35,
    borderEdgeDarken:     0.40,
  },
  environment: {
    envMapUrl:       '/assets/envmaps/diagram-default.hdr',
    envMapIntensity: 0.6,
    skyColor:        '#001020',
    horizonColor:    '#002040',
  },
  layout: {
    defaultKind: 'grid',
    grid: {
      columns: 'auto',
      spacing: [2, 2],
      margin: 0,
      groupPadding: 1.5,
      titleGap: 0.75,
      alignment: 'left',
      disconnected: 'next-to',
    },
    hierarchical: {
      direction: 'top-down',
      spacing: [1.5, 1.5],
      margin: 0,
      groupPadding: 1.5,
      titleGap: 0.75,
      alignment: 'center',
      disconnected: 'next-to',
    },
    manual: {
      groupPadding: 1.5,
      titleGap: 0.75,
    },
  },
  palette: ['#00ffcc', '#00ccff', '#cc00ff', '#ff6600', '#00ff66'],
} as const;
