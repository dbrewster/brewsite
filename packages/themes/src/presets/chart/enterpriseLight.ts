// Enterprise ChartTheme preset — light polarity variant.

import type { ChartTheme } from '@brewsite/charts';
import { enterpriseChartTheme } from './enterprise';

export const enterpriseLightChartTheme: ChartTheme = {
  ...enterpriseChartTheme,
  name: 'enterprise-light',
  series: [
    { color: '#4F76B8', metalness: 0.03, roughness: 0.56, transmission: 0.0, emissiveIntensity: 0.01, depth: 0.20 },
    { color: '#3F7F73', metalness: 0.03, roughness: 0.56, transmission: 0.0, emissiveIntensity: 0.01, depth: 0.20 },
    { color: '#C9843F', metalness: 0.03, roughness: 0.56, transmission: 0.0, emissiveIntensity: 0.01, depth: 0.20 },
    { color: '#6D5D8E', metalness: 0.03, roughness: 0.56, transmission: 0.0, emissiveIntensity: 0.01, depth: 0.20 },
    { color: '#3B7E8D', metalness: 0.03, roughness: 0.56, transmission: 0.0, emissiveIntensity: 0.01, depth: 0.20 },
    { color: '#8A6C47', metalness: 0.03, roughness: 0.56, transmission: 0.0, emissiveIntensity: 0.01, depth: 0.20 },
    { color: '#5A724E', metalness: 0.03, roughness: 0.56, transmission: 0.0, emissiveIntensity: 0.00, depth: 0.20 },
    { color: '#8B4A54', metalness: 0.03, roughness: 0.56, transmission: 0.0, emissiveIntensity: 0.00, depth: 0.20 },
  ],
  axis: {
    ...enterpriseChartTheme.axis,
    lineColor: '#7F95B2',
    labelColor: '#2A405F',
  },
  background: {
    planeColor: '#F3F6FA',
    planeOpacity: 0,
    gridColor: '#A0B1C6',
  },
  legend: {
    ...enterpriseChartTheme.legend,
    textColor: '#2A405F',
    textOpacity: 1.0,
  },
  interaction: {
    ...enterpriseChartTheme.interaction,
    hoverColor: '#5E7EA9',
    selectedColor: '#5E6E8E',
    hoverEmissiveIntensity: 0.12,
  },
  gridlines: { color: '#A0B1C6', opacity: 0.22, visible: false },
  dataLabels: { fontSize: 0.044, color: '#2A405F' },
  referenceLines: { defaultColor: '#5E6E8E', lineWidth: 0.004, lineOpacity: 0.80 },
  tooltip: {
    background: 'rgba(255,255,255,0.97)',
    blur: '4px',
    borderColor: 'rgba(79,118,184,0.22)',
    borderRadius: '6px',
    valueColor: '#1A2A4A',
    labelColor: 'rgba(26,42,74,0.55)',
    fontSize: 12,
    shadow: '0 2px 8px rgba(0,0,0,0.08)',
    padding: '8px 12px',
    maxWidth: 220,
    offsetX: 12,
    offsetY: -12,
  },
  projection: {
    color: '#3F7F73',
    emissiveIntensity: 0.5,
    beamWidth: 0.003,
    opacity: 0.7,
    dotRadius: 0.018,
    dotEmissiveIntensity: 0.8,
    animationDurationMs: 220,
  },
};
