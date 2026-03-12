// Midnight chart theme — light polarity variant.

import type { ChartTheme } from './types';
import { midnightChartTheme } from './midnight';

export const midnightLightChartTheme: ChartTheme = {
  ...midnightChartTheme,
  name: 'midnight-light',
  series: [
    { color: '#E2A33A', metalness: 0.06, roughness: 0.40, transmission: 0.0, emissiveIntensity: 0.03, depth: 0.18 },
    { color: '#D0634B', metalness: 0.06, roughness: 0.40, transmission: 0.0, emissiveIntensity: 0.03, depth: 0.18 },
    { color: '#C39B52', metalness: 0.06, roughness: 0.40, transmission: 0.0, emissiveIntensity: 0.02, depth: 0.18 },
    { color: '#4F8D7B', metalness: 0.06, roughness: 0.40, transmission: 0.0, emissiveIntensity: 0.02, depth: 0.18 },
    { color: '#A86A8F', metalness: 0.06, roughness: 0.40, transmission: 0.0, emissiveIntensity: 0.02, depth: 0.18 },
    { color: '#8B6A3D', metalness: 0.06, roughness: 0.40, transmission: 0.0, emissiveIntensity: 0.02, depth: 0.18 },
    { color: '#6B8446', metalness: 0.06, roughness: 0.40, transmission: 0.0, emissiveIntensity: 0.01, depth: 0.18 },
    { color: '#BE6B4A', metalness: 0.06, roughness: 0.40, transmission: 0.0, emissiveIntensity: 0.01, depth: 0.18 },
  ],
  axis: {
    ...midnightChartTheme.axis,
    lineColor: '#9F7D52',
    labelColor: '#4A3723',
  },
  background: {
    planeColor: '#FAF6EE',
    planeOpacity: 0,
    gridColor: '#B99D77',
  },
  legend: {
    ...midnightChartTheme.legend,
    textColor: '#4A3723',
  },
  interaction: {
    ...midnightChartTheme.interaction,
    hoverColor: '#A7793A',
    selectedColor: '#8B6A3D',
    hoverEmissiveIntensity: 0.15,
  },
  gridlines: { color: '#B99D77', opacity: 0.22, visible: false },
  dataLabels: { fontSize: 0.046, color: '#4A3723' },
  referenceLines: { defaultColor: '#8B6A3D', lineWidth: 0.004, lineOpacity: 0.80 },
  tooltip: {
    background: 'rgba(250,246,238,0.96)',
    blur: '6px',
    borderColor: 'rgba(170,120,58,0.28)',
    borderRadius: '6px',
    valueColor: '#3A2A1B',
    labelColor: 'rgba(58,42,27,0.58)',
    fontSize: 12,
    shadow: '0 2px 10px rgba(0,0,0,0.10)',
    padding: '8px 12px',
    maxWidth: 220,
    offsetX: 12,
    offsetY: -12,
  },
  projection: {
    color: '#A7793A',
    emissiveIntensity: 0.55,
    beamWidth: 0.004,
    opacity: 0.75,
    dotRadius: 0.020,
    dotEmissiveIntensity: 0.85,
    animationDurationMs: 220,
  },
};
