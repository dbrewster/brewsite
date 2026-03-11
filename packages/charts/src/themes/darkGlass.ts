// Dark Glass chart theme — deep navy, coherent blue-violet story, glass transmission.

// SHARED ACCENT PALETTE — must match packages/diagram/src/elements/diagram/themes/darkGlass.ts
// Index 0–4: diagram node palette[0..4]; indices 0–7: chart series[0..7].color
// '#4455aa', '#2266bb', '#7744cc', '#1188aa', '#335588', '#3dbccc', '#9966ff', '#44aadd'

import type { ChartTheme } from './types';

export const darkGlassChartTheme: ChartTheme = {
  name: 'darkGlass',
  series: [
    { color: '#4455aa', metalness: 0.2, roughness: 0.18, transmission: 0.28, emissiveIntensity: 0.40, depth: 0.30 },
    { color: '#2266bb', metalness: 0.2, roughness: 0.18, transmission: 0.28, emissiveIntensity: 0.36, depth: 0.30 },
    { color: '#7744cc', metalness: 0.2, roughness: 0.18, transmission: 0.28, emissiveIntensity: 0.32, depth: 0.30 },
    { color: '#1188aa', metalness: 0.2, roughness: 0.18, transmission: 0.28, emissiveIntensity: 0.28, depth: 0.30 },
    { color: '#335588', metalness: 0.2, roughness: 0.18, transmission: 0.28, emissiveIntensity: 0.26, depth: 0.30 },
    { color: '#3dbccc', metalness: 0.2, roughness: 0.18, transmission: 0.28, emissiveIntensity: 0.24, depth: 0.30 },
    { color: '#9966ff', metalness: 0.2, roughness: 0.18, transmission: 0.28, emissiveIntensity: 0.22, depth: 0.30 },
    { color: '#44aadd', metalness: 0.2, roughness: 0.18, transmission: 0.28, emissiveIntensity: 0.20, depth: 0.30 },
  ],
  axis: {
    lineColor:     '#5577bb',
    lineOpacity:    0.90,
    tickOpacity:    0.85,
    labelColor:    '#dce8ff',
    labelOpacity:   0.96,
    fontSize:       0.05,
    tickLength:     0.08,
    gap:            0.18,
    titleFontSize:  0.065,
  },
  background: {
    planeColor:   '#070b18',
    planeOpacity:  0.08,
    gridColor:    '#1a2545',
  },
  legend: {
    textColor:   '#dce8ff',
    fontSize:     0.09,
    swatchSize:   0.08,
    spacing:      0.14,
    gap:          0.28,
    textOpacity:  1.0,
  },
  line: {
    shape:        'circle',
    smoothness:    0.88,
    subdivisions:  10,
  },
  pie: { tilt: -0.35 },
  interaction: {
    hoverColor:             '#ffffff',
    hoverEmissiveIntensity:  0.6,
    selectedColor:          '#ffdd00',
  },
  bar:          { padding: 0.2 },
  area:         { fillOpacity: 0.7 },
  gridlines:    { color: '#2a3a60', opacity: 0.18, visible: false },
  dataLabels:   { fontSize: 0.05, color: '#dce8ff' },
  referenceLines: { defaultColor: '#7744cc', lineWidth: 0.005, lineOpacity: 0.85 },
};
