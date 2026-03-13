// Unit tests for createChartTheme — theme factory with partial overrides.

import { describe, it, expect, beforeEach } from 'vitest';
import { createChartTheme } from '../createChartTheme';
import { enterpriseChartTheme } from '../enterprise';
import { enterpriseLightChartTheme } from '../enterpriseLight';
import {
  registerChartThemePair,
  _resetChartThemeRegistryForTesting,
} from '../chartThemeRegistry';
import type { ChartTheme } from '../types';

// A fake 'darkGlass'-like theme used as a base for override tests.
// Uses distinct values so we can verify override logic clearly.
const fakeDarkGlassTheme: ChartTheme = {
  name: 'darkGlass',
  series: [
    { color: '#B33A2B', metalness: 0.18, roughness: 0.12, transmission: 0.14, emissiveIntensity: 0.34, depth: 0.24 },
    { color: '#E36A2E', metalness: 0.18, roughness: 0.12, transmission: 0.14, emissiveIntensity: 0.40, depth: 0.24 },
    { color: '#7A1F2D', metalness: 0.18, roughness: 0.12, transmission: 0.14, emissiveIntensity: 0.30, depth: 0.24 },
    { color: '#2E4F7A', metalness: 0.18, roughness: 0.12, transmission: 0.14, emissiveIntensity: 0.20, depth: 0.24 },
    { color: '#5A2C1D', metalness: 0.18, roughness: 0.12, transmission: 0.14, emissiveIntensity: 0.22, depth: 0.24 },
    { color: '#FF8A3D', metalness: 0.18, roughness: 0.12, transmission: 0.14, emissiveIntensity: 0.44, depth: 0.24 },
    { color: '#8F3B4A', metalness: 0.18, roughness: 0.12, transmission: 0.14, emissiveIntensity: 0.24, depth: 0.24 },
    { color: '#1E3554', metalness: 0.18, roughness: 0.12, transmission: 0.14, emissiveIntensity: 0.18, depth: 0.24 },
  ],
  axis: {
    lineColor: '#6B4338', lineOpacity: 0.90, tickOpacity: 0.85,
    labelColor: '#F0E4DA', labelOpacity: 0.96, fontSize: 0.05,
    tickLength: 0.08, gap: 0.18, titleFontSize: 0.065,
  },
  background: { planeColor: '#070504', planeOpacity: 0.00, gridColor: '#3A2924' },
  legend: { textColor: '#F0E4DA', fontSize: 0.09, swatchSize: 0.08, spacing: 0.14, gap: 0.28, textOpacity: 1.0 },
  line: { shape: 'circle', smoothness: 0.82, subdivisions: 10 },
  pie: { tilt: 0 },
  interaction: { hoverColor: '#FF8A3D', hoverEmissiveIntensity: 0.6, selectedColor: '#E36A2E' },
  bar: { padding: 0.20 },
  area: { fillOpacity: 0.95 },
  gridlines: { color: '#3A2924', opacity: 0.18, visible: false },
  dataLabels: { fontSize: 0.05, color: '#F0E4DA' },
  referenceLines: { defaultColor: '#7A1F2D', lineWidth: 0.005, lineOpacity: 0.85 },
  tooltip: {
    background: 'rgba(28,16,10,0.92)', blur: '8px',
    borderColor: 'rgba(227,106,46,0.3)', borderRadius: '6px',
    valueColor: '#F0E4DA', labelColor: 'rgba(240,228,218,0.65)',
    fontSize: 12, shadow: '0 4px 16px rgba(0,0,0,0.5)',
    padding: '8px 12px', maxWidth: 220, offsetX: 12, offsetY: -12,
  },
  projection: {
    color: '#E36A2E', emissiveIntensity: 0.8, beamWidth: 0.004,
    opacity: 0.85, dotRadius: 0.022, dotEmissiveIntensity: 1.1, animationDurationMs: 220,
  },
};

describe('createChartTheme — ChartTheme object base (no overrides)', () => {
  it('ChartTheme object base passes through as-is when no overrides', () => {
    const result = createChartTheme(fakeDarkGlassTheme);
    expect(result.name).toBe(fakeDarkGlassTheme.name);
    expect(result.series).toBe(fakeDarkGlassTheme.series);
    expect(result.axis).toBe(fakeDarkGlassTheme.axis);
    expect(result.background).toBe(fakeDarkGlassTheme.background);
    expect(result.legend).toBe(fakeDarkGlassTheme.legend);
    expect(result.line).toBe(fakeDarkGlassTheme.line);
    expect(result.pie).toBe(fakeDarkGlassTheme.pie);
    expect(result.interaction).toBe(fakeDarkGlassTheme.interaction);
  });
});

describe('createChartTheme — string base resolves via registry', () => {
  beforeEach(() => {
    _resetChartThemeRegistryForTesting();
    registerChartThemePair('darkGlass', { dark: fakeDarkGlassTheme, light: fakeDarkGlassTheme });
  });

  it('string base resolves to the preset theme from registry', () => {
    const result = createChartTheme('darkGlass');
    expect(result.name).toBe(fakeDarkGlassTheme.name);
    expect(result.series).toBe(fakeDarkGlassTheme.series);
    expect(result.axis).toBe(fakeDarkGlassTheme.axis);
  });

  it('series override with fewer entries than base wraps by modulo index', () => {
    const result = createChartTheme('darkGlass', {
      series: [{ color: '#ff0000' }],
    });
    expect(result.series).toHaveLength(1);
    expect(result.series[0]!.color).toBe('#ff0000');
    expect(result.series[0]!.metalness).toBe(fakeDarkGlassTheme.series[0]!.metalness);
    expect(result.series[0]!.roughness).toBe(fakeDarkGlassTheme.series[0]!.roughness);
  });

  it('axis partial override merges correctly', () => {
    const result = createChartTheme('darkGlass', {
      axis: { lineColor: '#ff0000', lineOpacity: 0.5 },
    });
    expect(result.axis.lineColor).toBe('#ff0000');
    expect(result.axis.lineOpacity).toBe(0.5);
    expect(result.axis.labelColor).toBe(fakeDarkGlassTheme.axis.labelColor);
    expect(result.axis.labelOpacity).toBe(fakeDarkGlassTheme.axis.labelOpacity);
    expect(result.axis.tickOpacity).toBe(fakeDarkGlassTheme.axis.tickOpacity);
    expect(result.axis.fontSize).toBe(fakeDarkGlassTheme.axis.fontSize);
    expect(result.axis.tickLength).toBe(fakeDarkGlassTheme.axis.tickLength);
  });

  it('legend partial override merges correctly', () => {
    const result = createChartTheme('darkGlass', {
      legend: { textColor: '#00ff00', fontSize: 0.15 },
    });
    expect(result.legend.textColor).toBe('#00ff00');
    expect(result.legend.fontSize).toBe(0.15);
    expect(result.legend.swatchSize).toBe(fakeDarkGlassTheme.legend.swatchSize);
    expect(result.legend.spacing).toBe(fakeDarkGlassTheme.legend.spacing);
  });

  it('line partial override merges correctly', () => {
    const result = createChartTheme('darkGlass', {
      line: { shape: 'triangle', smoothness: 0.2, subdivisions: 10 },
    });
    expect(result.line.shape).toBe('triangle');
    expect(result.line.smoothness).toBe(0.2);
    expect(result.line.subdivisions).toBe(10);
  });

  it('pie partial override merges correctly', () => {
    const result = createChartTheme('darkGlass', {
      pie: { tilt: 0.52 },
    });
    expect(result.pie.tilt).toBe(0.52);
  });

  it('background partial override merges correctly', () => {
    const result = createChartTheme('darkGlass', {
      background: { planeColor: '#000000' },
    });
    expect(result.background.planeColor).toBe('#000000');
    expect(result.background.planeOpacity).toBe(fakeDarkGlassTheme.background.planeOpacity);
    expect(result.background.gridColor).toBe(fakeDarkGlassTheme.background.gridColor);
  });

  it('bar partial override merges correctly', () => {
    const result = createChartTheme('darkGlass', {
      bar: { padding: 0.35 },
    });
    expect(result.bar?.padding).toBe(0.35);
  });

  it('bar tokens pass through unchanged when no override', () => {
    const result = createChartTheme('darkGlass');
    expect(result.bar?.padding).toBe(fakeDarkGlassTheme.bar?.padding);
  });

  it('area partial override merges correctly', () => {
    const result = createChartTheme('darkGlass', {
      area: { fillOpacity: 0.5 },
    });
    expect(result.area?.fillOpacity).toBe(0.5);
  });

  it('gridlines partial override merges correctly', () => {
    const result = createChartTheme('darkGlass', {
      gridlines: { color: '#ff0000', opacity: 0.3, visible: true },
    });
    expect(result.gridlines?.color).toBe('#ff0000');
    expect(result.gridlines?.opacity).toBe(0.3);
    expect(result.gridlines?.visible).toBe(true);
  });

  it('gridlines partial override preserves unoverridden fields', () => {
    const result = createChartTheme('darkGlass', {
      gridlines: { opacity: 0.5 },
    });
    expect(result.gridlines?.color).toBe(fakeDarkGlassTheme.gridlines?.color);
    expect(result.gridlines?.opacity).toBe(0.5);
  });

  it('dataLabels partial override merges correctly', () => {
    const result = createChartTheme('darkGlass', {
      dataLabels: { fontSize: 0.06, color: '#ff4400' },
    });
    expect(result.dataLabels?.fontSize).toBe(0.06);
    expect(result.dataLabels?.color).toBe('#ff4400');
  });

  it('referenceLines partial override merges correctly', () => {
    const result = createChartTheme('darkGlass', {
      referenceLines: { defaultColor: '#00ff00', lineOpacity: 1.0 },
    });
    expect(result.referenceLines?.defaultColor).toBe('#00ff00');
    expect(result.referenceLines?.lineOpacity).toBe(1.0);
    expect(result.referenceLines?.lineWidth).toBe(fakeDarkGlassTheme.referenceLines?.lineWidth);
  });

  it('axis titleFontSize override merges correctly', () => {
    const result = createChartTheme('darkGlass', {
      axis: { titleFontSize: 0.1 },
    });
    expect(result.axis.titleFontSize).toBe(0.1);
    expect(result.axis.lineColor).toBe(fakeDarkGlassTheme.axis.lineColor);
    expect(result.axis.fontSize).toBe(fakeDarkGlassTheme.axis.fontSize);
  });
});

describe('createChartTheme — inline ChartTheme object as base', () => {
  it('ChartTheme object with overrides merges correctly', () => {
    const custom: ChartTheme = {
      ...fakeDarkGlassTheme,
      name: 'myBrand',
      axis: { ...fakeDarkGlassTheme.axis, lineColor: '#111111' },
    };
    const result = createChartTheme(custom, {
      axis: { labelColor: '#222222' },
    });
    expect(result.name).toBe('myBrand');
    expect(result.axis.lineColor).toBe('#111111');
    expect(result.axis.labelColor).toBe('#222222');
  });

  it('name override replaces base name', () => {
    const result = createChartTheme(fakeDarkGlassTheme, { name: 'brandTheme' });
    expect(result.name).toBe('brandTheme');
  });
});

describe('createChartTheme — enterprise base from registry', () => {
  beforeEach(() => {
    _resetChartThemeRegistryForTesting();
  });

  it("createChartTheme('enterprise', {}) resolves correctly", () => {
    const result = createChartTheme('enterprise', {});
    expect(result.name).toBe('enterprise');
    expect(result.series).toHaveLength(8);
  });

  it('interaction partial override merges correctly on enterprise', () => {
    const result = createChartTheme('enterprise', {
      interaction: { hoverColor: '#ff00ff' },
    });
    expect(result.interaction.hoverColor).toBe('#ff00ff');
    expect(result.interaction.hoverEmissiveIntensity).toBe(
      enterpriseChartTheme.interaction.hoverEmissiveIntensity,
    );
    expect(result.interaction.selectedColor).toBe(
      enterpriseChartTheme.interaction.selectedColor,
    );
  });

  it('dataLabels pass through unchanged when no override on enterprise', () => {
    const result = createChartTheme('enterprise');
    expect(result.dataLabels?.fontSize).toBe(enterpriseChartTheme.dataLabels?.fontSize);
    expect(result.dataLabels?.color).toBe(enterpriseChartTheme.dataLabels?.color);
  });

  it('legend textOpacity override merges correctly on enterprise', () => {
    const result = createChartTheme('enterprise', {
      legend: { textOpacity: 0.6 },
    });
    expect(result.legend.textOpacity).toBe(0.6);
    expect(result.legend.textColor).toBe(enterpriseChartTheme.legend.textColor);
    expect(result.legend.fontSize).toBe(enterpriseChartTheme.legend.fontSize);
  });
});

describe('default and enterprise chart themes — token values', () => {
  it('enterpriseChartTheme has 8 series', () => {
    expect(enterpriseChartTheme.series).toHaveLength(8);
  });

  it('enterpriseLightChartTheme has 8 series', () => {
    expect(enterpriseLightChartTheme.series).toHaveLength(8);
  });

  it('enterpriseChartTheme tooltip tokens present and valid', () => {
    expect(enterpriseChartTheme.tooltip).toBeDefined();
    expect(typeof enterpriseChartTheme.tooltip!.background).toBe('string');
    expect(typeof enterpriseChartTheme.tooltip!.maxWidth).toBe('number');
    expect(enterpriseChartTheme.tooltip!.offsetX).toBeGreaterThan(0);
  });

  it('enterpriseChartTheme projection tokens present and valid', () => {
    expect(enterpriseChartTheme.projection).toBeDefined();
    expect(typeof enterpriseChartTheme.projection!.color).toBe('string');
    expect(enterpriseChartTheme.projection!.animationDurationMs).toBe(220);
    expect(enterpriseChartTheme.projection!.beamWidth).toBeGreaterThan(0);
  });

  it('enterpriseChartTheme.tooltip.background is dark navy', () => {
    expect(enterpriseChartTheme.tooltip!.background).toBe('rgba(10,20,36,0.94)');
  });

  it('enterpriseChartTheme.tooltip.valueColor is light for dark polarity', () => {
    expect(enterpriseChartTheme.tooltip!.valueColor).toBe('#E3ECF8');
  });

  it('enterpriseChartTheme.projection.opacity is 0.72', () => {
    expect(enterpriseChartTheme.projection!.opacity).toBe(0.72);
  });

  it('enterpriseLightChartTheme all series have metalness <= 0.20', () => {
    for (const s of enterpriseLightChartTheme.series) {
      expect(s.metalness).toBeLessThanOrEqual(0.20);
    }
  });
});
