// @internal — not part of the public API. Use @brewsite/themes bundles instead.
// Midnight chart theme — warm cinematic seriousness.

// SHARED ACCENT PALETTE — must match packages/diagram/src/elements/diagram/themes/midnight.ts
// '#E2A33A', '#D0634B', '#C39B52', '#4F8D7B', '#A86A8F', '#8B6A3D', '#6B8446', '#BE6B4A'

import type { ChartTheme } from './types';

export const midnightChartTheme: ChartTheme = {
  name: 'midnight',
  series: [
    { color: '#E2A33A', metalness: 0.08, roughness: 0.48, transmission: 0.0, emissiveIntensity: 0.28, depth: 0.22 },
    { color: '#D0634B', metalness: 0.08, roughness: 0.48, transmission: 0.0, emissiveIntensity: 0.24, depth: 0.22 },
    { color: '#C39B52', metalness: 0.08, roughness: 0.48, transmission: 0.0, emissiveIntensity: 0.22, depth: 0.22 },
    { color: '#4F8D7B', metalness: 0.08, roughness: 0.48, transmission: 0.0, emissiveIntensity: 0.20, depth: 0.22 },
    { color: '#A86A8F', metalness: 0.08, roughness: 0.48, transmission: 0.0, emissiveIntensity: 0.18, depth: 0.22 },
    { color: '#8B6A3D', metalness: 0.08, roughness: 0.48, transmission: 0.0, emissiveIntensity: 0.16, depth: 0.22 },
    { color: '#6B8446', metalness: 0.08, roughness: 0.48, transmission: 0.0, emissiveIntensity: 0.14, depth: 0.22 },
    { color: '#BE6B4A', metalness: 0.08, roughness: 0.48, transmission: 0.0, emissiveIntensity: 0.12, depth: 0.22 },
  ],
  axis: {
    lineColor: '#7D603C',
    lineOpacity: 0.88,
    tickOpacity: 0.82,
    labelColor: '#F0E4CF',
    labelOpacity: 0.94,
    fontSize: 0.05,
    tickLength: 0.08,
    gap: 0.18,
    titleFontSize: 0.065,
  },
  background: {
    planeColor: '#0D0907',
    planeOpacity: 0.0,
    gridColor: '#4B3A29',
  },
  legend: {
    textColor: '#F0E4CF',
    fontSize: 0.09,
    swatchSize: 0.08,
    spacing: 0.14,
    gap: 0.28,
    textOpacity: 0.95,
  },
  line: {
    shape: 'circle',
    smoothness: 0.70,
    subdivisions: 8,
  },
  pie: { tilt: 0 },
  interaction: {
    hoverColor: '#E2A33A',
    hoverEmissiveIntensity: 0.5,
    selectedColor: '#C39B52',
  },
  bar: { padding: 0.22 },
  area: { fillOpacity: 0.65 },
  gridlines: { color: '#4B3A29', opacity: 0.20, visible: false },
  dataLabels: { fontSize: 0.05, color: '#F0E4CF' },
  referenceLines: { defaultColor: '#D0634B', lineWidth: 0.005, lineOpacity: 0.85 },
  tooltip: {
    background: 'rgba(13,9,7,0.94)',
    blur: '8px',
    borderColor: 'rgba(226,163,58,0.30)',
    borderRadius: '6px',
    valueColor: '#F0E4CF',
    labelColor: 'rgba(240,228,207,0.65)',
    fontSize: 12,
    shadow: '0 4px 16px rgba(0,0,0,0.55)',
    padding: '8px 12px',
    maxWidth: 220,
    offsetX: 12,
    offsetY: -12,
  },
  projection: {
    color: '#E2A33A',
    emissiveIntensity: 0.85,
    beamWidth: 0.004,
    opacity: 0.88,
    dotRadius: 0.022,
    dotEmissiveIntensity: 1.10,
    animationDurationMs: 220,
  },
};
