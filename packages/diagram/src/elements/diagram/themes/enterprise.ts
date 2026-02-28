// Enterprise theme — professional blues, moderate polish, no glow. Slide-deck grade.

import type { DiagramTheme } from '../types';

/**
 * Enterprise: professional blue palette with moderate PBR polish.
 * No glow sprites. Curved routing. Suited for business presentations,
 * technical documentation, and slide decks.
 */
export const enterpriseTheme: DiagramTheme = {
  node: {
    defaultColor:             '#1e3a6e',
    defaultMetalness:          0.25,
    defaultRoughness:          0.45,
    defaultEmissiveIntensity:  0.06,
    defaultDepth:              0.32,
    cornerRadius:              0.05,
    glowIntensity:             0.0,
    defaultLabelColor:         '#ffffff',
    defaultSublabelColor:      '#a8c0e0',
    labelSizeFactor:           1.0,
    sublabelSizeFactor:        1.0,
    defaultIconStyle:          'flat',
  },
  edge: {
    defaultColor:         '#4a7abf',
    defaultFlowSpeed:     0.7,
    defaultFlowWidth:     0.18,
    defaultThickness:     0.070,
    defaultMetalness:     0.30,
    defaultRoughness:     0.50,
    routing:              'curved',
    landing:              'nearest-face',
    smoothness:           1.0,
    use3DArrows:          false,
  },
  group: {
    defaultColor:         '#0f1e3a',
    defaultBorderColor:   '#2a5090',
    defaultBorderWidth:   1.25,
    defaultBorderHeight:  1,
    defaultFillOpacity:   0.09,
    defaultBorderOpacity: 0.55,
  },
  environment: {
    envMapUrl:       '/assets/envmaps/diagram-default.hdr',
    envMapIntensity: 0.75,
    skyColor:        '#0a1530',
    horizonColor:    '#1e3060',
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
      spacing: [2, 2],
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
} as const;
