// Neon Cyber chart theme — electric violet primary, laser cyan secondary, stepped emissive.

// SHARED ACCENT PALETTE — must match packages/diagram/src/elements/diagram/themes/neonCyber.ts
// Index 0–4: diagram node palette[0..4]; indices 0–7: chart series[0..7].color
// '#7b2dff', '#00eeff', '#b855ff', '#00ccdd', '#5020cc', '#44ddee', '#9944ff', '#00aacc'

import type { ChartTheme } from './types';

export const neonCyberChartTheme: ChartTheme = {
  name: 'neonCyber',
  series: [
    { color: '#7b2dff', metalness: 0.12, roughness: 0.08, transmission: 0.0, emissiveIntensity: 0.90, depth: 0.22 },
    { color: '#00eeff', metalness: 0.12, roughness: 0.08, transmission: 0.0, emissiveIntensity: 0.85, depth: 0.22 },
    { color: '#b855ff', metalness: 0.12, roughness: 0.08, transmission: 0.0, emissiveIntensity: 0.82, depth: 0.22 },
    { color: '#00ccdd', metalness: 0.12, roughness: 0.08, transmission: 0.0, emissiveIntensity: 0.78, depth: 0.22 },
    { color: '#5020cc', metalness: 0.12, roughness: 0.08, transmission: 0.0, emissiveIntensity: 0.74, depth: 0.22 },
    { color: '#44ddee', metalness: 0.12, roughness: 0.08, transmission: 0.0, emissiveIntensity: 0.70, depth: 0.22 },
    { color: '#9944ff', metalness: 0.12, roughness: 0.08, transmission: 0.0, emissiveIntensity: 0.66, depth: 0.22 },
    { color: '#00aacc', metalness: 0.12, roughness: 0.08, transmission: 0.0, emissiveIntensity: 0.62, depth: 0.22 },
  ],
  axis: {
    lineColor:     '#7b2dff',
    lineOpacity:    0.90,
    tickOpacity:    0.88,
    labelColor:    '#b090ff',
    labelOpacity:   1.0,
    fontSize:       0.05,
    tickLength:     0.08,
    gap:            0.18,
    titleFontSize:  0.06,
  },
  background: {
    planeColor:   '#030610',
    planeOpacity:  1.0,
    gridColor:    '#0a0a1e',
  },
  legend: {
    textColor:   '#b090ff',
    fontSize:     0.09,
    swatchSize:   0.08,
    spacing:      0.14,
    gap:          0.28,
    textOpacity:  1.0,
  },
  line: {
    shape:        'hexagon',
    smoothness:    0.82,
    subdivisions:  7,
  },
  pie: { tilt: -0.35 },
  interaction: {
    hoverColor:             '#ffffff',
    hoverEmissiveIntensity:  1.2,
    selectedColor:          '#00eeff',
  },
  bar:          { padding: 0.15 },
  area:         { fillOpacity: 0.65 },
  gridlines:    { color: '#7b2dff', opacity: 0.12, visible: false, dashSize: 0.03, gapSize: 0.02 },
  dataLabels:   { fontSize: 0.048, color: '#b090ff' },
  referenceLines: { defaultColor: '#00eeff', lineWidth: 0.005, lineOpacity: 0.9 },
};
