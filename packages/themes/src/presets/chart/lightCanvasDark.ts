// lightCanvas ChartTheme preset — dark polarity variant.

import type { ChartTheme } from '@brewsite/charts';
import { lightCanvasChartTheme } from './lightCanvas';

export const lightCanvasDarkChartTheme: ChartTheme = {
  ...lightCanvasChartTheme,
  name: 'lightCanvas-dark',
  series: [
    { color: '#3D63D9', metalness: 0.18, roughness: 0.34, transmission: 0.0, emissiveIntensity: 0.06, depth: 0.20 },
    { color: '#1E9A6F', metalness: 0.18, roughness: 0.34, transmission: 0.0, emissiveIntensity: 0.05, depth: 0.20 },
    { color: '#D64566', metalness: 0.18, roughness: 0.34, transmission: 0.0, emissiveIntensity: 0.05, depth: 0.20 },
    { color: '#D2911F', metalness: 0.18, roughness: 0.34, transmission: 0.0, emissiveIntensity: 0.04, depth: 0.20 },
    { color: '#7357C7', metalness: 0.18, roughness: 0.34, transmission: 0.0, emissiveIntensity: 0.04, depth: 0.20 },
    { color: '#1D93AE', metalness: 0.18, roughness: 0.34, transmission: 0.0, emissiveIntensity: 0.03, depth: 0.20 },
    { color: '#A06D2F', metalness: 0.18, roughness: 0.34, transmission: 0.0, emissiveIntensity: 0.03, depth: 0.20 },
    { color: '#4E8F3A', metalness: 0.18, roughness: 0.34, transmission: 0.0, emissiveIntensity: 0.02, depth: 0.20 },
  ],
  axis: {
    ...lightCanvasChartTheme.axis,
    lineColor: '#5D7194',
    labelColor: '#E8EEF7',
  },
  background: {
    planeColor: '#131923',
    planeOpacity: 0,
    gridColor: '#41516A',
  },
  legend: {
    ...lightCanvasChartTheme.legend,
    textColor: '#E8EEF7',
  },
  interaction: {
    ...lightCanvasChartTheme.interaction,
    hoverColor: '#3D63D9',
    selectedColor: '#7357C7',
    hoverEmissiveIntensity: 0.28,
  },
  gridlines: { color: '#41516A', opacity: 0.24, visible: false },
  dataLabels: { fontSize: 0.046, color: '#E8EEF7' },
  referenceLines: { defaultColor: '#7357C7', lineWidth: 0.004, lineOpacity: 0.80 },
  tooltip: {
    background: 'rgba(18,26,38,0.94)',
    blur: '8px',
    borderColor: 'rgba(61,99,217,0.28)',
    borderRadius: '6px',
    valueColor: '#E8EEF7',
    labelColor: 'rgba(232,238,247,0.62)',
    fontSize: 12,
    shadow: '0 4px 16px rgba(0,0,0,0.40)',
    padding: '8px 12px',
    maxWidth: 220,
    offsetX: 12,
    offsetY: -12,
  },
  projection: {
    color: '#3D63D9',
    emissiveIntensity: 0.70,
    beamWidth: 0.003,
    opacity: 0.80,
    dotRadius: 0.018,
    dotEmissiveIntensity: 1.00,
    animationDurationMs: 220,
  },
};
