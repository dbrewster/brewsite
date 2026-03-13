// Light Canvas chart theme — premium editorial light mode.

// SHARED ACCENT PALETTE — must match packages/diagram/src/elements/diagram/themes/lightCanvas.ts
// '#3D63D9', '#1E9A6F', '#D64566', '#D2911F', '#7357C7', '#1D93AE', '#A06D2F', '#4E8F3A'

import type { ChartTheme } from './types';

export const lightCanvasChartTheme: ChartTheme = {
  name: 'lightCanvas',
  series: [
    { color: '#3D63D9', metalness: 0.20, roughness: 0.32, transmission: 0.0, emissiveIntensity: 0.0, depth: 0.18 },
    { color: '#1E9A6F', metalness: 0.20, roughness: 0.32, transmission: 0.0, emissiveIntensity: 0.0, depth: 0.18 },
    { color: '#D64566', metalness: 0.20, roughness: 0.32, transmission: 0.0, emissiveIntensity: 0.0, depth: 0.18 },
    { color: '#D2911F', metalness: 0.20, roughness: 0.32, transmission: 0.0, emissiveIntensity: 0.0, depth: 0.18 },
    { color: '#7357C7', metalness: 0.20, roughness: 0.32, transmission: 0.0, emissiveIntensity: 0.0, depth: 0.18 },
    { color: '#1D93AE', metalness: 0.20, roughness: 0.32, transmission: 0.0, emissiveIntensity: 0.0, depth: 0.18 },
    { color: '#A06D2F', metalness: 0.20, roughness: 0.32, transmission: 0.0, emissiveIntensity: 0.0, depth: 0.18 },
    { color: '#4E8F3A', metalness: 0.20, roughness: 0.32, transmission: 0.0, emissiveIntensity: 0.0, depth: 0.18 },
  ],
  axis: {
    lineColor: '#9CAEC4',
    lineOpacity: 0.85,
    tickOpacity: 0.80,
    labelColor: '#1F2D41',
    labelOpacity: 0.94,
    fontSize: 0.05,
    tickLength: 0.08,
    gap: 0.18,
    titleFontSize: 0.055,
  },
  background: {
    planeColor: '#FFFFFF',
    planeOpacity: 0,
    gridColor: '#C4CCD8',
  },
  legend: {
    textColor: '#1F2D41',
    fontSize: 0.09,
    swatchSize: 0.08,
    spacing: 0.14,
    gap: 0.28,
    textOpacity: 1.0,
  },
  line: {
    shape: 'circle',
    smoothness: 0.5,
    subdivisions: 6,
  },
  pie: { tilt: 0 },
  interaction: {
    hoverColor: '#4768C9',
    hoverEmissiveIntensity: 0.15,
    selectedColor: '#D2911F',
  },
  bar: { padding: 0.22 },
  area: { fillOpacity: 0.95 },
  gridlines: { color: '#C4CCD8', opacity: 0.28, visible: false },
  dataLabels: { fontSize: 0.044, color: '#1F2D41' },
  referenceLines: { defaultColor: '#5F62AE', lineWidth: 0.004, lineOpacity: 0.80 },
  tooltip: {
    background: 'rgba(255,255,255,0.96)',
    blur: '4px',
    borderColor: 'rgba(61,99,217,0.22)',
    borderRadius: '6px',
    valueColor: '#1A2A4A',
    labelColor: 'rgba(26,42,74,0.55)',
    fontSize: 12,
    shadow: '0 2px 8px rgba(0,0,0,0.08)',
    padding: '8px 12px',
    maxWidth: 220,
    offsetX: 12,
    offsetY: -12,
  },
  projection: {
    color: '#3D63D9',
    emissiveIntensity: 0.50,
    beamWidth: 0.003,
    opacity: 0.70,
    dotRadius: 0.018,
    dotEmissiveIntensity: 0.80,
    animationDurationMs: 220,
  },
};
