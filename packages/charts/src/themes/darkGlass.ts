// @internal — not part of the public API. Use @brewsite/themes bundles instead.
// Dark Glass chart theme — obsidian glass with ember highlights.

// SHARED ACCENT PALETTE — must match packages/diagram/src/elements/diagram/themes/darkGlass.ts
// '#B33A2B', '#E36A2E', '#7A1F2D', '#2E4F7A', '#5A2C1D', '#FF8A3D', '#8F3B4A', '#1E3554'

import type { ChartTheme } from './types';

export const darkGlassChartTheme: ChartTheme = {
  name: 'darkGlass',
  series: [
    { color: '#B33A2B', metalness: 0.18, roughness: 0.12, transmission: 0.14, emissiveIntensity: 0.34, depth: 0.24 },
    { color: '#E36A2E', metalness: 0.18, roughness: 0.12, transmission: 0.14, emissiveIntensity: 0.40, depth: 0.24 },
    { color: '#7A1F2D', metalness: 0.18, roughness: 0.12, transmission: 0.14, emissiveIntensity: 0.30, depth: 0.24 },
    { color: '#2E4F7A', metalness: 0.18, roughness: 0.12, transmission: 0.14, emissiveIntensity: 0.20, depth: 0.24 },
    { color: '#5A2C1D', metalness: 0.18, roughness: 0.12, transmission: 0.14, emissiveIntensity: 0.22, depth: 0.24 },
    { color: '#FF8A3D', metalness: 0.18, roughness: 0.12, transmission: 0.14, emissiveIntensity: 0.44, depth: 0.24 },
    { color: '#8F3B4A', metalness: 0.18, roughness: 0.12, transmission: 0.14, emissiveIntensity: 0.24, depth: 0.24 },
    { color: '#1E3554', metalness: 0.18, roughness: 0.12, transmission: 0.14, emissiveIntensity: 0.18, depth: 0.24 },
  ],
  axis: {
    lineColor: '#6B4338',
    lineOpacity: 0.90,
    tickOpacity: 0.85,
    labelColor: '#F0E4DA',
    labelOpacity: 0.96,
    fontSize: 0.05,
    tickLength: 0.08,
    gap: 0.18,
    titleFontSize: 0.065,
  },
  background: {
    planeColor: '#070504',
    planeOpacity: 0.00,
    gridColor: '#3A2924',
  },
  legend: {
    textColor: '#F0E4DA',
    fontSize: 0.09,
    swatchSize: 0.08,
    spacing: 0.14,
    gap: 0.28,
    textOpacity: 1.0,
  },
  line: {
    shape: 'circle',
    smoothness: 0.82,
    subdivisions: 10,
  },
  pie: { tilt: 0 },
  interaction: {
    hoverColor: '#FF8A3D',
    hoverEmissiveIntensity: 0.6,
    selectedColor: '#E36A2E',
  },
  bar: { padding: 0.20 },
  area: { fillOpacity: 0.95 },
  gridlines: { color: '#3A2924', opacity: 0.18, visible: false },
  dataLabels: { fontSize: 0.05, color: '#F0E4DA' },
  referenceLines: { defaultColor: '#7A1F2D', lineWidth: 0.005, lineOpacity: 0.85 },
  tooltip: {
    background: 'rgba(28,16,10,0.92)',
    blur: '8px',
    borderColor: 'rgba(227,106,46,0.3)',
    borderRadius: '6px',
    valueColor: '#F0E4DA',
    labelColor: 'rgba(240,228,218,0.65)',
    fontSize: 12,
    shadow: '0 4px 16px rgba(0,0,0,0.5)',
    padding: '8px 12px',
    maxWidth: 220,
    offsetX: 12,
    offsetY: -12,
  },
  projection: {
    color: '#E36A2E',
    emissiveIntensity: 0.8,
    beamWidth: 0.004,
    opacity: 0.85,
    dotRadius: 0.022,
    dotEmissiveIntensity: 1.1,
    animationDurationMs: 220,
  },
};
