// Light minimal chart theme — white/light background, pastel palette, minimal metalness.

// SHARED ACCENT PALETTE — must match packages/diagram/src/elements/diagram/themes/lightMinimal.ts
// Index 0–4: diagram node palette[0..4]; indices 0–7: chart series[0..7].color
// (lightMinimal does not define a node palette[] array; these are the chart series colors only)
// '#93c5fd', '#c4b5fd', '#86efac', '#fca5a5', '#fde68a', '#67e8f9', '#d9f99d', '#fed7aa'

import type { ChartTheme } from './types';

export const lightMinimalChartTheme: ChartTheme = {
  name: 'lightMinimal',
  series: [
    { color: '#93c5fd', metalness: 0.0, roughness: 0.8, transmission: 0.0, emissiveIntensity: 0.0, depth: 0.16 },
    { color: '#c4b5fd', metalness: 0.0, roughness: 0.8, transmission: 0.0, emissiveIntensity: 0.0, depth: 0.16 },
    { color: '#86efac', metalness: 0.0, roughness: 0.8, transmission: 0.0, emissiveIntensity: 0.0, depth: 0.16 },
    { color: '#fca5a5', metalness: 0.0, roughness: 0.8, transmission: 0.0, emissiveIntensity: 0.0, depth: 0.16 },
    { color: '#fde68a', metalness: 0.0, roughness: 0.8, transmission: 0.0, emissiveIntensity: 0.0, depth: 0.16 },
    { color: '#67e8f9', metalness: 0.0, roughness: 0.8, transmission: 0.0, emissiveIntensity: 0.0, depth: 0.16 },
    { color: '#d9f99d', metalness: 0.0, roughness: 0.8, transmission: 0.0, emissiveIntensity: 0.0, depth: 0.16 },
    { color: '#fed7aa', metalness: 0.0, roughness: 0.8, transmission: 0.0, emissiveIntensity: 0.0, depth: 0.16 },
  ],
  axis: {
    lineColor: '#cbd5e1',
    lineOpacity: 0.9,
    tickOpacity: 0.82,
    labelColor: '#475569',
    labelOpacity: 0.94,
    fontSize: 0.12,
    tickLength: 0.08,
    gap: 0.18,
    titleFontSize: 0.052,
  },
  background: {
    planeColor: '#ffffff',
    planeOpacity: 1.0,
    gridColor: '#f1f5f9',
  },
  legend: {
    textColor: '#333344',
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
    tilt: -0.35,
  },
  interaction: {
    hoverColor: '#1144ee',
    hoverEmissiveIntensity: 0.2,
    selectedColor: '#ee4400',
  },
  bar: { padding: 0.22 },
  area: { fillOpacity: 0.72 },
  gridlines: { color: '#b0b8c0', opacity: 0.25, visible: false },
  dataLabels: { fontSize: 0.044, color: '#222233' },
  referenceLines: { defaultColor: '#cc4400', lineWidth: 0.004, lineOpacity: 0.8 },
};
