// Light minimal chart theme — white/light background, pastel palette, minimal metalness.

import type { ChartTheme } from './types';

export const lightMinimalChartTheme: ChartTheme = {
  name: 'lightMinimal',
  series: [
    { color: '#93c5fd', metalness: 0.0, roughness: 0.8, transmission: 0.0, emissiveIntensity: 0.0, depth: 0.2 },
    { color: '#c4b5fd', metalness: 0.0, roughness: 0.8, transmission: 0.0, emissiveIntensity: 0.0, depth: 0.2 },
    { color: '#86efac', metalness: 0.0, roughness: 0.8, transmission: 0.0, emissiveIntensity: 0.0, depth: 0.2 },
    { color: '#fca5a5', metalness: 0.0, roughness: 0.8, transmission: 0.0, emissiveIntensity: 0.0, depth: 0.2 },
    { color: '#fde68a', metalness: 0.0, roughness: 0.8, transmission: 0.0, emissiveIntensity: 0.0, depth: 0.2 },
    { color: '#67e8f9', metalness: 0.0, roughness: 0.8, transmission: 0.0, emissiveIntensity: 0.0, depth: 0.2 },
    { color: '#d9f99d', metalness: 0.0, roughness: 0.8, transmission: 0.0, emissiveIntensity: 0.0, depth: 0.2 },
    { color: '#fed7aa', metalness: 0.0, roughness: 0.8, transmission: 0.0, emissiveIntensity: 0.0, depth: 0.2 },
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
};
