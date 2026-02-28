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
    defaultDepth:              0.20,
    cornerRadius:              0.08,
    glowIntensity:             0.0,
    defaultLabelColor:         '#1a2240',
    defaultSublabelColor:      '#4a5a80',
    labelSizeFactor:           1.0,
    sublabelSizeFactor:        1.0,
    defaultIconStyle:          'flat',
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
  },
  group: {
    defaultColor:         '#dce8f8',
    defaultBorderColor:   '#8090c0',
    defaultBorderWidth:   1.25,
    defaultBorderHeight:  1,
    defaultFillOpacity:   0.35,
    defaultBorderOpacity: 0.60,
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
