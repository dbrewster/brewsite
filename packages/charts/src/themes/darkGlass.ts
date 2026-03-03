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
    lineColor: '#334155',
    labelColor: '#94a3b8',
    fontSize: 0.12,
    tickLength: 0.08,
  },
  background: {
    planeColor: '#0f172a',
    planeOpacity: 0.85,
    gridColor: '#1e293b',
  },
  legend: {
    textColor: '#d0e8ff',
    fontSize: 0.09,
    swatchSize: 0.08,
    spacing: 0.14,
  },
  interaction: {
    hoverColor: '#ffffff',
    hoverEmissiveIntensity: 0.6,
    selectedColor: '#ffdd00',
  },
};
