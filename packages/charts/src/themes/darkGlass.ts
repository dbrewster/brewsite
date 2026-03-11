// Dark glass chart theme — dark background, translucent glass bars, cyan/blue palette.

import type { ChartTheme } from './types';

export const darkGlassChartTheme: ChartTheme = {
  name: 'darkGlass',
  series: [
    { color: '#00d4ff', metalness: 0.2, roughness: 0.15, transmission: 0.3, emissiveIntensity: 0.4, depth: 0.3 },
    { color: '#6c63ff', metalness: 0.2, roughness: 0.15, transmission: 0.3, emissiveIntensity: 0.35, depth: 0.3 },
    { color: '#00ff88', metalness: 0.15, roughness: 0.2, transmission: 0.25, emissiveIntensity: 0.4, depth: 0.3 },
    { color: '#ff6b6b', metalness: 0.2, roughness: 0.15, transmission: 0.3, emissiveIntensity: 0.35, depth: 0.3 },
    { color: '#ffd93d', metalness: 0.15, roughness: 0.2, transmission: 0.2, emissiveIntensity: 0.3, depth: 0.3 },
    { color: '#4ecdc4', metalness: 0.2, roughness: 0.15, transmission: 0.3, emissiveIntensity: 0.35, depth: 0.3 },
    { color: '#a78bfa', metalness: 0.2, roughness: 0.15, transmission: 0.3, emissiveIntensity: 0.35, depth: 0.3 },
    { color: '#fb923c', metalness: 0.15, roughness: 0.2, transmission: 0.25, emissiveIntensity: 0.3, depth: 0.3 },
  ],
  axis: {
    lineColor: '#7fb2ff',
    lineOpacity: 0.96,
    tickOpacity: 0.9,
    labelColor: '#d7e7ff',
    labelOpacity: 0.98,
    fontSize: .05,
    tickLength: 0.08,
    gap: 0.18,
    titleFontSize: 0.065,
  },
  background: {
    planeColor: '#0f172a',
    planeOpacity: 0.1,
    gridColor: '#1e293b',
  },
  legend: {
    textColor: '#d0e8ff',
    fontSize: 0.09,
    swatchSize: 0.08,
    spacing: 0.14,
    gap: 0.28,
    textOpacity: 1.0,
  },
  line: {
    shape: 'circle',
    smoothness: 0.88,
    subdivisions: 10,
  },
  pie: {
    tilt: -0.35,
  },
  interaction: {
    hoverColor: '#ffffff',
    hoverEmissiveIntensity: 0.6,
    selectedColor: '#ffdd00',
  },
  bar: { padding: 0.2 },
  area: { fillOpacity: 0.7},
  gridlines: { color: '#4a6080', opacity: 0.18, visible: false },
  dataLabels: { fontSize: 0.05, color: '#e0e8ff' },
  referenceLines: { defaultColor: '#ff8844', lineWidth: 0.005, lineOpacity: 0.85 },
};
