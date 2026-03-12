// Neon Cyber chart theme — electric signal intelligence.

// SHARED ACCENT PALETTE — must match packages/diagram/src/elements/diagram/themes/neonCyber.ts
// '#8A3DFF', '#00E7FF', '#C260FF', '#11C9E8', '#5B2CE6', '#5EE8FF', '#A96BFF', '#1AAFD1'

import type { ChartTheme } from './types';

export const neonCyberChartTheme: ChartTheme = {
  name: 'neonCyber',
  series: [
    { color: '#8A3DFF', metalness: 0.12, roughness: 0.08, transmission: 0.0, emissiveIntensity: 0.95, depth: 0.22 },
    { color: '#00E7FF', metalness: 0.12, roughness: 0.08, transmission: 0.0, emissiveIntensity: 0.88, depth: 0.22 },
    { color: '#C260FF', metalness: 0.12, roughness: 0.08, transmission: 0.0, emissiveIntensity: 0.82, depth: 0.22 },
    { color: '#11C9E8', metalness: 0.12, roughness: 0.08, transmission: 0.0, emissiveIntensity: 0.76, depth: 0.22 },
    { color: '#5B2CE6', metalness: 0.12, roughness: 0.08, transmission: 0.0, emissiveIntensity: 0.71, depth: 0.22 },
    { color: '#5EE8FF', metalness: 0.12, roughness: 0.08, transmission: 0.0, emissiveIntensity: 0.66, depth: 0.22 },
    { color: '#A96BFF', metalness: 0.12, roughness: 0.08, transmission: 0.0, emissiveIntensity: 0.62, depth: 0.22 },
    { color: '#1AAFD1', metalness: 0.12, roughness: 0.08, transmission: 0.0, emissiveIntensity: 0.58, depth: 0.22 },
  ],
  axis: {
    lineColor: '#6E55D1',
    lineOpacity: 0.90,
    tickOpacity: 0.88,
    labelColor: '#D8CCFF',
    labelOpacity: 1.0,
    fontSize: 0.05,
    tickLength: 0.08,
    gap: 0.18,
    titleFontSize: 0.06,
  },
  background: {
    planeColor: '#02030D',
    planeOpacity: 0,
    gridColor: '#2D2D66',
  },
  legend: {
    textColor: '#D8CCFF',
    fontSize: 0.09,
    swatchSize: 0.08,
    spacing: 0.14,
    gap: 0.28,
    textOpacity: 1.0,
  },
  line: {
    shape: 'hexagon',
    smoothness: 0.82,
    subdivisions: 7,
  },
  pie: { tilt: -0.35 },
  interaction: {
    hoverColor: '#00E7FF',
    hoverEmissiveIntensity: 1.2,
    selectedColor: '#C260FF',
  },
  bar: { padding: 0.15 },
  area: { fillOpacity: 0.65 },
  gridlines: { color: '#6E55D1', opacity: 0.12, visible: false, dashSize: 0.03, gapSize: 0.02 },
  dataLabels: { fontSize: 0.048, color: '#D8CCFF' },
  referenceLines: { defaultColor: '#8A3DFF', lineWidth: 0.005, lineOpacity: 0.9 },
  tooltip: {
    background: 'rgba(8,0,28,0.94)',
    blur: '10px',
    borderColor: 'rgba(0,231,255,0.4)',
    borderRadius: '4px',
    valueColor: '#00E7FF',
    labelColor: 'rgba(216,204,255,0.65)',
    fontSize: 12,
    shadow: '0 0 16px rgba(0,231,255,0.2)',
    padding: '8px 12px',
    maxWidth: 220,
    offsetX: 12,
    offsetY: -12,
  },
  projection: {
    color: '#00E7FF',
    emissiveIntensity: 1.2,
    beamWidth: 0.005,
    opacity: 0.9,
    dotRadius: 0.024,
    dotEmissiveIntensity: 1.4,
    animationDurationMs: 220,
  },
};
