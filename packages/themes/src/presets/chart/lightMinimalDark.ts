// lightMinimal ChartTheme preset — dark polarity variant.

import type { ChartTheme } from '@brewsite/charts';
import { lightMinimalChartTheme } from './lightMinimal';

export const lightMinimalDarkChartTheme: ChartTheme = {
  ...lightMinimalChartTheme,
  name: 'lightMinimal-dark',
  series: [
    { color: '#7FAEEA', metalness: 0.02, roughness: 0.76, transmission: 0.0, emissiveIntensity: 0.03, depth: 0.16 },
    { color: '#AFA0EA', metalness: 0.02, roughness: 0.76, transmission: 0.0, emissiveIntensity: 0.03, depth: 0.16 },
    { color: '#7FD8A2', metalness: 0.02, roughness: 0.76, transmission: 0.0, emissiveIntensity: 0.02, depth: 0.16 },
    { color: '#EAA0A0', metalness: 0.02, roughness: 0.76, transmission: 0.0, emissiveIntensity: 0.02, depth: 0.16 },
    { color: '#EAD98E', metalness: 0.02, roughness: 0.76, transmission: 0.0, emissiveIntensity: 0.02, depth: 0.16 },
    { color: '#78D5E3', metalness: 0.02, roughness: 0.76, transmission: 0.0, emissiveIntensity: 0.01, depth: 0.16 },
    { color: '#B9E38C', metalness: 0.02, roughness: 0.76, transmission: 0.0, emissiveIntensity: 0.01, depth: 0.16 },
    { color: '#F0C8A2', metalness: 0.02, roughness: 0.76, transmission: 0.0, emissiveIntensity: 0.01, depth: 0.16 },
  ],
  axis: {
    ...lightMinimalChartTheme.axis,
    lineColor: '#647488',
    labelColor: '#DEE5F0',
  },
  background: {
    planeColor: '#101317',
    planeOpacity: 0,
    gridColor: '#4A5563',
  },
  legend: {
    ...lightMinimalChartTheme.legend,
    textColor: '#DEE5F0',
  },
  interaction: {
    ...lightMinimalChartTheme.interaction,
    hoverColor: '#7FAEEA',
    selectedColor: '#AFA0EA',
    hoverEmissiveIntensity: 0.16,
  },
  gridlines: { color: '#4A5563', opacity: 0.20, visible: false },
  dataLabels: { fontSize: 0.044, color: '#DEE5F0' },
  referenceLines: { defaultColor: '#AFA0EA', lineWidth: 0.004, lineOpacity: 0.8 },
  tooltip: {
    background: 'rgba(16,16,18,0.94)',
    blur: '6px',
    borderColor: 'rgba(127,174,234,0.20)',
    borderRadius: '4px',
    valueColor: '#E8EDF5',
    labelColor: 'rgba(232,237,245,0.55)',
    fontSize: 12,
    shadow: '0 4px 16px rgba(0,0,0,0.40)',
    padding: '8px 12px',
    maxWidth: 220,
    offsetX: 12,
    offsetY: -12,
  },
  projection: {
    color: '#7FAEEA',
    emissiveIntensity: 0.40,
    beamWidth: 0.003,
    opacity: 0.62,
    dotRadius: 0.016,
    dotEmissiveIntensity: 0.65,
    animationDurationMs: 220,
  },
};
