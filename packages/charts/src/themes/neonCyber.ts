// Neon cyber chart theme — black background, high emissive, neon green/magenta palette.

import type { ChartTheme } from './types';

export const neonCyberChartTheme: ChartTheme = {
  name: 'neonCyber',
  series: [
    { color: '#39ff14', metalness: 0.1, roughness: 0.05, transmission: 0.0, emissiveIntensity: 0.9, depth: 0.25 },
    { color: '#ff2d78', metalness: 0.1, roughness: 0.05, transmission: 0.0, emissiveIntensity: 0.9, depth: 0.25 },
    { color: '#00f5ff', metalness: 0.1, roughness: 0.05, transmission: 0.0, emissiveIntensity: 0.85, depth: 0.25 },
    { color: '#ffff00', metalness: 0.1, roughness: 0.05, transmission: 0.0, emissiveIntensity: 0.8, depth: 0.25 },
    { color: '#ff7700', metalness: 0.1, roughness: 0.05, transmission: 0.0, emissiveIntensity: 0.85, depth: 0.25 },
    { color: '#cc00ff', metalness: 0.1, roughness: 0.05, transmission: 0.0, emissiveIntensity: 0.9, depth: 0.25 },
    { color: '#00ff66', metalness: 0.1, roughness: 0.05, transmission: 0.0, emissiveIntensity: 0.85, depth: 0.25 },
    { color: '#ff0055', metalness: 0.1, roughness: 0.05, transmission: 0.0, emissiveIntensity: 0.9, depth: 0.25 },
  ],
  axis: {
    lineColor: '#45ff93',
    lineOpacity: 0.95,
    tickOpacity: 0.92,
    labelColor: '#39ff14',
    labelOpacity: 1.0,
    fontSize: 0.12,
    tickLength: 0.08,
    gap: 0.18,
  },
  background: {
    planeColor: '#000000',
    planeOpacity: 1.0,
    gridColor: '#0d0d1a',
  },
  legend: {
    textColor: '#00ff9d',
    fontSize: 0.09,
    swatchSize: 0.08,
    spacing: 0.14,
    gap: 0.28,
  },
  line: {
    shape: 'hexagon',
    smoothness: 0.82,
    subdivisions: 7,
  },
  pie: {
    tilt: -0.35,
  },
  interaction: {
    hoverColor: '#ffffff',
    hoverEmissiveIntensity: 1.2,
    selectedColor: '#ff00ff',
  },
};
