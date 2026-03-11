// Midnight chart theme — warm dark, amber-gold accent, matte geometry, low emissive.

// SHARED ACCENT PALETTE — must match packages/diagram/src/elements/diagram/themes/midnight.ts
// Index 0–4: diagram node palette[0..4]; indices 0–7: chart series[0..7].color
// '#d08c20', '#c24840', '#d4ac30', '#2e8870', '#c05578', '#8a6028', '#6a8430', '#b84530'

import type { ChartTheme } from './types';

export const midnightChartTheme: ChartTheme = {
  name: 'midnight',
  series: [
    { color: '#d08c20', metalness: 0.08, roughness: 0.48, transmission: 0.0, emissiveIntensity: 0.28, depth: 0.22 },
    { color: '#c24840', metalness: 0.08, roughness: 0.48, transmission: 0.0, emissiveIntensity: 0.24, depth: 0.22 },
    { color: '#d4ac30', metalness: 0.08, roughness: 0.48, transmission: 0.0, emissiveIntensity: 0.22, depth: 0.22 },
    { color: '#2e8870', metalness: 0.08, roughness: 0.48, transmission: 0.0, emissiveIntensity: 0.20, depth: 0.22 },
    { color: '#c05578', metalness: 0.08, roughness: 0.48, transmission: 0.0, emissiveIntensity: 0.18, depth: 0.22 },
    { color: '#8a6028', metalness: 0.08, roughness: 0.48, transmission: 0.0, emissiveIntensity: 0.16, depth: 0.22 },
    { color: '#6a8430', metalness: 0.08, roughness: 0.48, transmission: 0.0, emissiveIntensity: 0.14, depth: 0.22 },
    { color: '#b84530', metalness: 0.08, roughness: 0.48, transmission: 0.0, emissiveIntensity: 0.12, depth: 0.22 },
  ],
  axis: {
    lineColor:     '#6a5030',
    lineOpacity:    0.88,
    tickOpacity:    0.82,
    labelColor:    '#f0e8d8',
    labelOpacity:   0.94,
    fontSize:       0.05,
    tickLength:     0.08,
    gap:            0.18,
    titleFontSize:  0.065,
  },
  background: {
    planeColor:   '#0d0a07',
    planeOpacity:  0.0,
    gridColor:    '#1e1808',
  },
  legend: {
    textColor:   '#f0e8d8',
    fontSize:     0.09,
    swatchSize:   0.08,
    spacing:      0.14,
    gap:          0.28,
    textOpacity:  0.95,
  },
  line: {
    shape:        'circle',
    smoothness:    0.7,
    subdivisions:  8,
  },
  pie: { tilt: -0.35 },
  interaction: {
    hoverColor:             '#f0e8d8',
    hoverEmissiveIntensity:  0.5,
    selectedColor:          '#f0b030',
  },
  bar:          { padding: 0.22 },
  area:         { fillOpacity: 0.65 },
  gridlines:    { color: '#3a2c18', opacity: 0.20, visible: false },
  dataLabels:   { fontSize: 0.05, color: '#f0e8d8' },
  referenceLines: { defaultColor: '#f0b030', lineWidth: 0.005, lineOpacity: 0.85 },
};
