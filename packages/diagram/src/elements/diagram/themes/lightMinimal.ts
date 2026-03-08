// Light Minimal theme — white/light backgrounds, high contrast, no IBL.
// Suited for documentation, diagrams in white-background contexts.

import type { DiagramTheme } from '../types';

/**
 * Light Minimal: light backgrounds, dark text, subtle styling.
 * No environment map (IBL disabled). Orthogonal routing for clean layout.
 * Best for documentation contexts and light-background presentation slides.
 */
export const lightMinimalTheme: DiagramTheme = {
  node: {
    defaultColor:             '#eef2fc',
    defaultMetalness:          0.08,
    defaultRoughness:          0.60,
    defaultEmissiveIntensity:  0.0,
    defaultThickness:          0.20,
    cornerRadius:              0.08,
    glowIntensity:             0.0,
    defaultLabelColor:         '#1a2240',
    defaultSublabelColor:      '#4a5a80',
    labelSizeFactor:           1.0,
    sublabelSizeFactor:        1.0,
    defaultIconStyle:          'flat',
    defaultSize:               [4, 2] as const,
    defaultIconScale:          0.6,
    defaultIconDepthFactor:    0.5,
    defaultIconDepth:          0.10,
    glowSpread:                2.2,
    sideColorDarkenFactor:     -0.10,
    borderColorLightenFactor:  0.20,
    labelFontSizeBase:         0.28,
    sublabelFontSizeBase:      0.18,
  },
  edge: {
    defaultColor:         '#3060b0',
    defaultFlowSpeed:     0.7,
    defaultFlowWidth:     0.18,
    defaultThickness:     0.060,
    defaultMetalness:     0.10,
    defaultRoughness:     0.60,
    routing:              'orthogonal',
    landing:              'nearest-face',
    smoothness:           1.0,
    use3DArrows:          false,
    tubeRadialSegments:   8,
    organicVariation:     1.2,
    flowPulseIntensity:   0.9,
  },
  group: {
    defaultColor:         '#dce8f8',
    defaultBorderColor:   '#8090c0',
    defaultBorderWidth:   1.25,
    defaultBorderHeight:  1,
    defaultFillOpacity:   0.35,
    defaultBorderOpacity: 0.60,
    defaultLabelColor:    '#1a2240',
    borderMetalness:      0.08,
    borderRoughness:      0.60,
    borderSideDarken:     0.70,
    borderEdgeDarken:     0.75,
  },
  environment: {
    envMapUrl:       'none',
    envMapIntensity: 0,
    skyColor:        '#ffffff',
    horizonColor:    '#e0e8f8',
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
} as const;
