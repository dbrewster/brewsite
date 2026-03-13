// @internal — not part of the public API. Use @brewsite/themes bundles instead.
// Neon Cyber chart theme — light polarity variant.

import type { ChartTheme } from './types';
import { neonCyberChartTheme } from './neonCyber';

export const neonCyberLightChartTheme: ChartTheme = {
  ...neonCyberChartTheme,
  name: 'neonCyber-light',
  series: [
    { color: '#8A3DFF', metalness: 0.10, roughness: 0.20, transmission: 0.0, emissiveIntensity: 0.08, depth: 0.18 },
    { color: '#00E7FF', metalness: 0.10, roughness: 0.20, transmission: 0.0, emissiveIntensity: 0.07, depth: 0.18 },
    { color: '#C260FF', metalness: 0.10, roughness: 0.20, transmission: 0.0, emissiveIntensity: 0.06, depth: 0.18 },
    { color: '#11C9E8', metalness: 0.10, roughness: 0.20, transmission: 0.0, emissiveIntensity: 0.05, depth: 0.18 },
    { color: '#5B2CE6', metalness: 0.10, roughness: 0.20, transmission: 0.0, emissiveIntensity: 0.05, depth: 0.18 },
    { color: '#5EE8FF', metalness: 0.10, roughness: 0.20, transmission: 0.0, emissiveIntensity: 0.04, depth: 0.18 },
    { color: '#A96BFF', metalness: 0.10, roughness: 0.20, transmission: 0.0, emissiveIntensity: 0.04, depth: 0.18 },
    { color: '#1AAFD1', metalness: 0.10, roughness: 0.20, transmission: 0.0, emissiveIntensity: 0.03, depth: 0.18 },
  ],
  axis: {
    ...neonCyberChartTheme.axis,
    lineColor: '#8097D5',
    labelColor: '#2A3E70',
  },
  background: {
    planeColor: '#F5F8FF',
    planeOpacity: 0,
    gridColor: '#A8B7E6',
  },
  legend: {
    ...neonCyberChartTheme.legend,
    textColor: '#2A3E70',
  },
  interaction: {
    ...neonCyberChartTheme.interaction,
    hoverColor: '#11C9E8',
    selectedColor: '#6C54BF',
    hoverEmissiveIntensity: 0.25,
  },
  line: {
    ...neonCyberChartTheme.line,
    smoothness: 0.72,
  },
  gridlines: { color: '#8097D5', opacity: 0.16, visible: false, dashSize: 0.03, gapSize: 0.02 },
  dataLabels: { fontSize: 0.046, color: '#2A3E70' },
  referenceLines: { defaultColor: '#6C54BF', lineWidth: 0.004, lineOpacity: 0.85 },
  tooltip: {
    background: 'rgba(240,248,255,0.95)',
    blur: '6px',
    borderColor: 'rgba(138,61,255,0.3)',
    borderRadius: '4px',
    valueColor: '#3A0090',
    labelColor: 'rgba(58,0,144,0.55)',
    fontSize: 12,
    shadow: '0 2px 10px rgba(138,61,255,0.15)',
    padding: '8px 12px',
    maxWidth: 220,
    offsetX: 12,
    offsetY: -12,
  },
  projection: {
    color: '#8A3DFF',
    emissiveIntensity: 0.7,
    beamWidth: 0.005,
    opacity: 0.8,
    dotRadius: 0.024,
    dotEmissiveIntensity: 1.0,
    animationDurationMs: 220,
  },
};
