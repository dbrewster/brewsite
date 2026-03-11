// Light Canvas chart theme — warm neutral background, jewel-tone series, zero emissive.

// SHARED ACCENT PALETTE — must match packages/diagram/src/elements/diagram/themes/lightCanvas.ts
// Index 0–4: diagram node palette[0..4]; indices 0–7: chart series[0..7].color
// '#3355cc', '#1a9966', '#cc3355', '#cc8800', '#6644bb', '#0088aa', '#996622', '#448822'

import type { ChartTheme } from './types';

export const lightCanvasChartTheme: ChartTheme = {
  name: 'lightCanvas',
  series: [
    { color: '#3355cc', metalness: 0.02, roughness: 0.72, transmission: 0.0, emissiveIntensity: 0.0, depth: 0.18 },
    { color: '#1a9966', metalness: 0.02, roughness: 0.72, transmission: 0.0, emissiveIntensity: 0.0, depth: 0.18 },
    { color: '#cc3355', metalness: 0.02, roughness: 0.72, transmission: 0.0, emissiveIntensity: 0.0, depth: 0.18 },
    { color: '#cc8800', metalness: 0.02, roughness: 0.72, transmission: 0.0, emissiveIntensity: 0.0, depth: 0.18 },
    { color: '#6644bb', metalness: 0.02, roughness: 0.72, transmission: 0.0, emissiveIntensity: 0.0, depth: 0.18 },
    { color: '#0088aa', metalness: 0.02, roughness: 0.72, transmission: 0.0, emissiveIntensity: 0.0, depth: 0.18 },
    { color: '#996622', metalness: 0.02, roughness: 0.72, transmission: 0.0, emissiveIntensity: 0.0, depth: 0.18 },
    { color: '#448822', metalness: 0.02, roughness: 0.72, transmission: 0.0, emissiveIntensity: 0.0, depth: 0.18 },
  ],
  axis: {
    lineColor:     '#8090a0',
    lineOpacity:    0.85,
    tickOpacity:    0.80,
    labelColor:    '#18202c',
    labelOpacity:   0.94,
    fontSize:       0.05,
    tickLength:     0.08,
    gap:            0.18,
    titleFontSize:  0.055,
  },
  background: {
    planeColor:   '#f0f2f4',
    planeOpacity:  1.0,
    gridColor:    '#d8dce4',
  },
  legend: {
    textColor:   '#18202c',
    fontSize:     0.09,
    swatchSize:   0.08,
    spacing:      0.14,
    gap:          0.28,
    textOpacity:  1.0,
  },
  line: {
    shape:        'circle',
    smoothness:    0.5,
    subdivisions:  6,
  },
  pie: { tilt: -0.35 },
  interaction: {
    hoverColor:             '#1a3a99',
    hoverEmissiveIntensity:  0.15,
    selectedColor:          '#cc8800',
  },
  bar:          { padding: 0.22 },
  area:         { fillOpacity: 0.70 },
  gridlines:    { color: '#c0c8d4', opacity: 0.28, visible: false },
  dataLabels:   { fontSize: 0.044, color: '#18202c' },
  referenceLines: { defaultColor: '#cc3355', lineWidth: 0.004, lineOpacity: 0.80 },
};
