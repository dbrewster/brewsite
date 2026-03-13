// @internal — not part of the public API. Use @brewsite/themes bundles instead.
// Light Minimal chart theme — documentation-first light presentation.

// SHARED ACCENT PALETTE — must match packages/diagram/src/elements/diagram/themes/lightMinimal.ts
// '#7FAEEA', '#AFA0EA', '#7FD8A2', '#EAA0A0', '#EAD98E', '#78D5E3', '#B9E38C', '#F0C8A2'

import type { ChartTheme } from './types';

export const lightMinimalChartTheme: ChartTheme = {
  name: 'lightMinimal',
  series: [
    { color: '#7FAEEA', metalness: 0.0, roughness: 0.80, transmission: 0.0, emissiveIntensity: 0.0, depth: 0.16 },
    { color: '#AFA0EA', metalness: 0.0, roughness: 0.80, transmission: 0.0, emissiveIntensity: 0.0, depth: 0.16 },
    { color: '#7FD8A2', metalness: 0.0, roughness: 0.80, transmission: 0.0, emissiveIntensity: 0.0, depth: 0.16 },
    { color: '#EAA0A0', metalness: 0.0, roughness: 0.80, transmission: 0.0, emissiveIntensity: 0.0, depth: 0.16 },
    { color: '#EAD98E', metalness: 0.0, roughness: 0.80, transmission: 0.0, emissiveIntensity: 0.0, depth: 0.16 },
    { color: '#78D5E3', metalness: 0.0, roughness: 0.80, transmission: 0.0, emissiveIntensity: 0.0, depth: 0.16 },
    { color: '#B9E38C', metalness: 0.0, roughness: 0.80, transmission: 0.0, emissiveIntensity: 0.0, depth: 0.16 },
    { color: '#F0C8A2', metalness: 0.0, roughness: 0.80, transmission: 0.0, emissiveIntensity: 0.0, depth: 0.16 },
  ],
  axis: {
    lineColor: '#AAB8CB',
    lineOpacity: 0.9,
    tickOpacity: 0.82,
    labelColor: '#2A3A50',
    labelOpacity: 0.94,
    fontSize: 0.12,
    tickLength: 0.08,
    gap: 0.18,
    titleFontSize: 0.052,
  },
  background: {
    planeColor: '#FFFFFF',
    planeOpacity: 0,
    gridColor: '#CAD2DF',
  },
  legend: {
    textColor: '#2A3A50',
    fontSize: 0.09,
    swatchSize: 0.08,
    spacing: 0.14,
    gap: 0.28,
    textOpacity: 1.0,
  },
  line: {
    shape: 'circle',
    smoothness: 0.42,
    subdivisions: 5,
  },
  pie: {
    tilt: 0,
  },
  interaction: {
    hoverColor: '#6A94CD',
    hoverEmissiveIntensity: 0.2,
    selectedColor: '#8C82CA',
  },
  bar: { padding: 0.22 },
  area: { fillOpacity: 0.72 },
  gridlines: { color: '#CAD2DF', opacity: 0.25, visible: false },
  dataLabels: { fontSize: 0.044, color: '#2A3A50' },
  referenceLines: { defaultColor: '#8C82CA', lineWidth: 0.004, lineOpacity: 0.8 },
  tooltip: {
    background: 'rgba(255,255,255,0.97)',
    blur: '',
    borderColor: 'rgba(127,174,234,0.22)',
    borderRadius: '4px',
    valueColor: '#223248',
    labelColor: 'rgba(34,50,72,0.50)',
    fontSize: 12,
    shadow: '0 1px 6px rgba(0,0,0,0.08)',
    padding: '8px 12px',
    maxWidth: 220,
    offsetX: 12,
    offsetY: -12,
  },
  projection: {
    color: '#7FAEEA',
    emissiveIntensity: 0.30,
    beamWidth: 0.003,
    opacity: 0.55,
    dotRadius: 0.016,
    dotEmissiveIntensity: 0.50,
    animationDurationMs: 220,
  },
};
