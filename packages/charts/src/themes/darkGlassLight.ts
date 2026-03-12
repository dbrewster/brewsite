// Dark Glass chart theme — light polarity variant.

import type { ChartTheme } from './types';
import { darkGlassChartTheme } from './darkGlass';

export const darkGlassLightChartTheme: ChartTheme = {
  ...darkGlassChartTheme,
  name: 'darkGlass-light',
  series: [
    { color: '#B33A2B', metalness: 0.10, roughness: 0.34, transmission: 0.02, emissiveIntensity: 0.04, depth: 0.18 },
    { color: '#E36A2E', metalness: 0.10, roughness: 0.34, transmission: 0.02, emissiveIntensity: 0.05, depth: 0.18 },
    { color: '#7A1F2D', metalness: 0.10, roughness: 0.34, transmission: 0.02, emissiveIntensity: 0.03, depth: 0.18 },
    { color: '#2E4F7A', metalness: 0.10, roughness: 0.34, transmission: 0.02, emissiveIntensity: 0.02, depth: 0.18 },
    { color: '#5A2C1D', metalness: 0.10, roughness: 0.34, transmission: 0.02, emissiveIntensity: 0.02, depth: 0.18 },
    { color: '#FF8A3D', metalness: 0.10, roughness: 0.34, transmission: 0.02, emissiveIntensity: 0.06, depth: 0.18 },
    { color: '#8F3B4A', metalness: 0.10, roughness: 0.34, transmission: 0.02, emissiveIntensity: 0.02, depth: 0.18 },
    { color: '#1E3554', metalness: 0.10, roughness: 0.34, transmission: 0.02, emissiveIntensity: 0.01, depth: 0.18 },
  ],
  axis: {
    ...darkGlassChartTheme.axis,
    lineColor: '#9A7569',
    labelColor: '#2B1F1A',
  },
  background: {
    planeColor: '#F8F3EF',
    planeOpacity: 0,
    gridColor: '#BFA99E',
  },
  legend: {
    ...darkGlassChartTheme.legend,
    textColor: '#2B1F1A',
  },
  interaction: {
    ...darkGlassChartTheme.interaction,
    hoverColor: '#E36A2E',
    selectedColor: '#9F4637',
    hoverEmissiveIntensity: 0.2,
  },
  bar: { padding: 0.20 },
  area: { fillOpacity: 0.95 },
  gridlines: { color: '#BFA99E', opacity: 0.20, visible: false },
  dataLabels: { fontSize: 0.05, color: '#2B1F1A' },
  referenceLines: { defaultColor: '#8F3B4A', lineWidth: 0.004, lineOpacity: 0.80 },
  tooltip: {
    background: 'rgba(252,246,240,0.95)',
    blur: '6px',
    borderColor: 'rgba(179,58,43,0.25)',
    borderRadius: '6px',
    valueColor: '#3A1A10',
    labelColor: 'rgba(58,26,16,0.6)',
    fontSize: 12,
    shadow: '0 2px 10px rgba(0,0,0,0.12)',
    padding: '8px 12px',
    maxWidth: 220,
    offsetX: 12,
    offsetY: -12,
  },
  projection: {
    color: '#B33A2B',
    emissiveIntensity: 0.6,
    beamWidth: 0.004,
    opacity: 0.75,
    dotRadius: 0.022,
    dotEmissiveIntensity: 0.9,
    animationDurationMs: 220,
  },
};
