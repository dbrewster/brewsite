// Enterprise chart theme — neutral grey background, muted blue palette, minimal emissive.

import type { ChartTheme } from './types';

export const enterpriseChartTheme: ChartTheme = {
  name: 'enterprise',
  series: [
    { color: '#3b82f6', metalness: 0.05, roughness: 0.6, transmission: 0.0, emissiveIntensity: 0.05, depth: 0.25 },
    { color: '#64748b', metalness: 0.05, roughness: 0.6, transmission: 0.0, emissiveIntensity: 0.05, depth: 0.25 },
    { color: '#06b6d4', metalness: 0.05, roughness: 0.55, transmission: 0.0, emissiveIntensity: 0.05, depth: 0.25 },
    { color: '#8b5cf6', metalness: 0.05, roughness: 0.6, transmission: 0.0, emissiveIntensity: 0.05, depth: 0.25 },
    { color: '#10b981', metalness: 0.05, roughness: 0.6, transmission: 0.0, emissiveIntensity: 0.05, depth: 0.25 },
    { color: '#f59e0b', metalness: 0.05, roughness: 0.6, transmission: 0.0, emissiveIntensity: 0.05, depth: 0.25 },
    { color: '#ef4444', metalness: 0.05, roughness: 0.6, transmission: 0.0, emissiveIntensity: 0.05, depth: 0.25 },
    { color: '#84cc16', metalness: 0.05, roughness: 0.6, transmission: 0.0, emissiveIntensity: 0.05, depth: 0.25 },
  ],
  axis: {
    lineColor: '#cbd5e1',
    labelColor: '#475569',
    fontSize: 0.12,
    tickLength: 0.08,
  },
  background: {
    planeColor: '#f8fafc',
    planeOpacity: 1.0,
    gridColor: '#e2e8f0',
  },
  legend: {
    textColor: '#444466',
    fontSize: 0.09,
    swatchSize: 0.08,
    spacing: 0.14,
  },
  interaction: {
    hoverColor: '#2255cc',
    hoverEmissiveIntensity: 0.3,
    selectedColor: '#ff6600',
  },
};
