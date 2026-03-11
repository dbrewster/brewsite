// Unit tests for createChartTheme — theme factory with partial overrides.

import { describe, it, expect } from 'vitest';
import { createChartTheme } from '../createChartTheme';
import { darkGlassChartTheme } from '../darkGlass';
import { enterpriseChartTheme } from '../enterprise';
import type { ChartTheme } from '../types';

describe('createChartTheme', () => {
  it('string base resolves to the preset theme', () => {
    const result = createChartTheme('darkGlass');
    expect(result.name).toBe(darkGlassChartTheme.name);
    expect(result.series).toBe(darkGlassChartTheme.series);
    expect(result.axis).toBe(darkGlassChartTheme.axis);
    expect(result.background).toBe(darkGlassChartTheme.background);
    expect(result.legend).toBe(darkGlassChartTheme.legend);
    expect(result.line).toBe(darkGlassChartTheme.line);
    expect(result.pie).toBe(darkGlassChartTheme.pie);
    expect(result.interaction).toBe(darkGlassChartTheme.interaction);
  });

  it('ChartTheme object base passes through as-is when no overrides', () => {
    const custom: ChartTheme = {
      ...darkGlassChartTheme,
      name: 'custom',
    };
    const result = createChartTheme(custom);
    expect(result.name).toBe('custom');
    expect(result.series).toBe(custom.series);
    expect(result.axis).toBe(custom.axis);
  });

  it('series override with fewer entries than base wraps by modulo index', () => {
    const result = createChartTheme('darkGlass', {
      series: [{ color: '#ff0000' }],
    });
    // Should produce a 1-entry series array (length of overrides, not base)
    expect(result.series).toHaveLength(1);
    // The overridden field is applied
    expect(result.series[0]!.color).toBe('#ff0000');
    // Non-overridden fields inherited from base series[0]
    expect(result.series[0]!.metalness).toBe(darkGlassChartTheme.series[0]!.metalness);
    expect(result.series[0]!.roughness).toBe(darkGlassChartTheme.series[0]!.roughness);
  });

  it('axis partial override merges correctly', () => {
    const result = createChartTheme('darkGlass', {
      axis: { lineColor: '#ff0000', lineOpacity: 0.5 },
    });
    expect(result.axis.lineColor).toBe('#ff0000');
    expect(result.axis.lineOpacity).toBe(0.5);
    // Non-overridden fields stay from base
    expect(result.axis.labelColor).toBe(darkGlassChartTheme.axis.labelColor);
    expect(result.axis.labelOpacity).toBe(darkGlassChartTheme.axis.labelOpacity);
    expect(result.axis.tickOpacity).toBe(darkGlassChartTheme.axis.tickOpacity);
    expect(result.axis.fontSize).toBe(darkGlassChartTheme.axis.fontSize);
    expect(result.axis.tickLength).toBe(darkGlassChartTheme.axis.tickLength);
  });

  it('legend partial override merges correctly', () => {
    const result = createChartTheme('darkGlass', {
      legend: { textColor: '#00ff00', fontSize: 0.15 },
    });
    expect(result.legend.textColor).toBe('#00ff00');
    expect(result.legend.fontSize).toBe(0.15);
    expect(result.legend.swatchSize).toBe(darkGlassChartTheme.legend.swatchSize);
    expect(result.legend.spacing).toBe(darkGlassChartTheme.legend.spacing);
  });

  it('line partial override merges correctly', () => {
    const result = createChartTheme('darkGlass', {
      line: { shape: 'triangle', smoothness: 0.2, subdivisions: 10 },
    });
    expect(result.line.shape).toBe('triangle');
    expect(result.line.smoothness).toBe(0.2);
    expect(result.line.subdivisions).toBe(10);
  });

  it('interaction partial override merges correctly', () => {
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

  it('pie partial override merges correctly', () => {
    const result = createChartTheme('darkGlass', {
      pie: { tilt: 0.52 },
    });
    expect(result.pie.tilt).toBe(0.52);
  });

  it('inline ChartTheme object as base with partial overrides', () => {
    const custom: ChartTheme = {
      ...darkGlassChartTheme,
      name: 'myBrand',
      axis: { ...darkGlassChartTheme.axis, lineColor: '#111111' },
    };
    const result = createChartTheme(custom, {
      axis: { labelColor: '#222222' },
    });
    expect(result.name).toBe('myBrand');
    expect(result.axis.lineColor).toBe('#111111');
    expect(result.axis.labelColor).toBe('#222222');
  });

  it('name override replaces base name', () => {
    const result = createChartTheme('darkGlass', { name: 'brandTheme' });
    expect(result.name).toBe('brandTheme');
  });

  it('background partial override merges correctly', () => {
    const result = createChartTheme('darkGlass', {
      background: { planeColor: '#000000' },
    });
    expect(result.background.planeColor).toBe('#000000');
    expect(result.background.planeOpacity).toBe(darkGlassChartTheme.background.planeOpacity);
    expect(result.background.gridColor).toBe(darkGlassChartTheme.background.gridColor);
  });
});
