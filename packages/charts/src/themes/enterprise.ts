// Enterprise chart theme — professional slate-blue palette, near-zero emissive, matte finish.

// SHARED ACCENT PALETTE — must match packages/diagram/src/elements/diagram/themes/enterprise.ts
// Index 0–4: diagram node palette[0..4]; indices 0–7: chart series[0..7].color
// '#3a5fa0', '#38766a', '#c87830', '#5a4e7a', '#2e7280', '#7a5c38', '#456040', '#7a3840'

import type { ChartTheme } from './types';

export const enterpriseChartTheme: ChartTheme = {
  name: 'enterprise',
  series: [
    { color: '#3a5fa0', metalness: 0.04, roughness: 0.62, transmission: 0.0, emissiveIntensity: 0.04, depth: 0.26 },
    { color: '#38766a', metalness: 0.04, roughness: 0.62, transmission: 0.0, emissiveIntensity: 0.04, depth: 0.26 },
    { color: '#c87830', metalness: 0.04, roughness: 0.62, transmission: 0.0, emissiveIntensity: 0.04, depth: 0.26 },
    { color: '#5a4e7a', metalness: 0.04, roughness: 0.62, transmission: 0.0, emissiveIntensity: 0.04, depth: 0.26 },
    { color: '#2e7280', metalness: 0.04, roughness: 0.62, transmission: 0.0, emissiveIntensity: 0.04, depth: 0.26 },
    { color: '#7a5c38', metalness: 0.04, roughness: 0.62, transmission: 0.0, emissiveIntensity: 0.04, depth: 0.26 },
    { color: '#456040', metalness: 0.04, roughness: 0.62, transmission: 0.0, emissiveIntensity: 0.04, depth: 0.26 },
    { color: '#7a3840', metalness: 0.04, roughness: 0.62, transmission: 0.0, emissiveIntensity: 0.04, depth: 0.26 },
  ],
  axis: {
    lineColor:     '#3a6aaa',
    lineOpacity:    0.90,
    tickOpacity:    0.85,
    labelColor:    '#e8f0ff',
    labelOpacity:   0.94,
    fontSize:       0.05,
    tickLength:     0.08,
    gap:            0.18,
    titleFontSize:  0.055,
  },
  background: {
    planeColor:   '#0f1e38',
    planeOpacity:  0.10,
    gridColor:    '#243d60',
  },
  legend: {
    textColor:   '#e8f0ff',
    fontSize:     0.09,
    swatchSize:   0.08,
    spacing:      0.14,
    gap:          0.28,
    textOpacity:  0.90,
  },
  line: {
    shape:        'line',
    smoothness:    0.0,
    subdivisions:  3,
  },
  pie: { tilt: -0.35 },
  interaction: {
    hoverColor:             '#6688cc',
    hoverEmissiveIntensity:  0.25,
    selectedColor:          '#c87830',
  },
  bar:          { padding: 0.25 },
  area:         { fillOpacity: 0.60 },
  gridlines:    { color: '#2a3d5a', opacity: 0.20, visible: false },
  dataLabels:   { fontSize: 0.045, color: '#e8f0ff' },
  referenceLines: { defaultColor: '#c87830', lineWidth: 0.004, lineOpacity: 0.80 },
};
