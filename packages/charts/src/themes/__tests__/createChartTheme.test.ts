// Unit tests for createChartTheme — theme factory with partial overrides.

import { describe, it, expect } from 'vitest';
import { createChartTheme } from '../createChartTheme';
import { CHART_THEMES } from '../index';
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

  it('bar partial override merges correctly', () => {
    const result = createChartTheme('darkGlass', {
      bar: { padding: 0.35 },
    });
    expect(result.bar?.padding).toBe(0.35);
  });

  it('bar tokens pass through unchanged when no override', () => {
    const result = createChartTheme('darkGlass');
    expect(result.bar?.padding).toBe(darkGlassChartTheme.bar?.padding);
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
    const result = createChartTheme('neonCyber', {
      gridlines: { opacity: 0.5 },
    });
    // color and dashSize from neonCyber base preserved
    expect(result.gridlines?.color).toBe('#7b2dff');
    expect(result.gridlines?.dashSize).toBe(0.03);
    expect(result.gridlines?.gapSize).toBe(0.02);
    expect(result.gridlines?.opacity).toBe(0.5);
  });

  it('dataLabels partial override merges correctly', () => {
    const result = createChartTheme('enterprise', {
      dataLabels: { fontSize: 0.06, color: '#ff4400' },
    });
    expect(result.dataLabels?.fontSize).toBe(0.06);
    expect(result.dataLabels?.color).toBe('#ff4400');
  });

  it('dataLabels pass through unchanged when no override', () => {
    const result = createChartTheme('enterprise');
    expect(result.dataLabels?.fontSize).toBe(enterpriseChartTheme.dataLabels?.fontSize);
    expect(result.dataLabels?.color).toBe(enterpriseChartTheme.dataLabels?.color);
  });

  it('referenceLines partial override merges correctly', () => {
    const result = createChartTheme('darkGlass', {
      referenceLines: { defaultColor: '#00ff00', lineOpacity: 1.0 },
    });
    expect(result.referenceLines?.defaultColor).toBe('#00ff00');
    expect(result.referenceLines?.lineOpacity).toBe(1.0);
    // lineWidth inherited from base
    expect(result.referenceLines?.lineWidth).toBe(darkGlassChartTheme.referenceLines?.lineWidth);
  });

  it('legend textOpacity override merges correctly', () => {
    const result = createChartTheme('enterprise', {
      legend: { textOpacity: 0.6 },
    });
    expect(result.legend.textOpacity).toBe(0.6);
    // Other legend fields inherited
    expect(result.legend.textColor).toBe(enterpriseChartTheme.legend.textColor);
    expect(result.legend.fontSize).toBe(enterpriseChartTheme.legend.fontSize);
  });

  it('axis titleFontSize override merges correctly', () => {
    const result = createChartTheme('darkGlass', {
      axis: { titleFontSize: 0.1 },
    });
    expect(result.axis.titleFontSize).toBe(0.1);
    // Other axis fields inherited
    expect(result.axis.lineColor).toBe(darkGlassChartTheme.axis.lineColor);
    expect(result.axis.fontSize).toBe(darkGlassChartTheme.axis.fontSize);
  });
});

describe('new theme names midnight and lightCanvas', () => {
  it('createChartTheme("midnight", {}) returns theme with name "midnight"', () => {
    const result = createChartTheme('midnight', {});
    expect(result.name).toBe('midnight');
  });

  it('createChartTheme("midnight", {}) has 8 series', () => {
    const result = createChartTheme('midnight', {});
    expect(result.series).toHaveLength(8);
  });

  it('createChartTheme("midnight", {}) series[0].color is #d08c20', () => {
    const result = createChartTheme('midnight', {});
    expect(result.series[0]?.color).toBe('#d08c20');
  });

  it('createChartTheme("lightCanvas", {}) returns theme with name "lightCanvas"', () => {
    const result = createChartTheme('lightCanvas', {});
    expect(result.name).toBe('lightCanvas');
  });

  it('createChartTheme("lightCanvas", {}) series[0].color is #3355cc', () => {
    const result = createChartTheme('lightCanvas', {});
    expect(result.series[0]?.color).toBe('#3355cc');
  });

  it('createChartTheme("lightCanvas", {}) series[0].emissiveIntensity is 0.0', () => {
    const result = createChartTheme('lightCanvas', {});
    expect(result.series[0]?.emissiveIntensity).toBe(0.0);
  });

  it('createChartTheme("midnight", { series: [{ color: "#ff0000" }] }) overrides series[0] color', () => {
    const result = createChartTheme('midnight', { series: [{ color: '#ff0000' }] });
    expect(result.series[0]?.color).toBe('#ff0000');
  });
});

describe('CHART_THEMES registry completeness', () => {
  it('CHART_THEMES contains exactly 6 keys', () => {
    expect(Object.keys(CHART_THEMES)).toHaveLength(6);
  });

  it('CHART_THEMES.midnight resolves to midnightChartTheme', () => {
    expect(CHART_THEMES.midnight).toBeDefined();
    expect(CHART_THEMES.midnight.name).toBe('midnight');
  });

  it('CHART_THEMES.lightCanvas resolves to lightCanvasChartTheme', () => {
    expect(CHART_THEMES.lightCanvas).toBeDefined();
    expect(CHART_THEMES.lightCanvas.name).toBe('lightCanvas');
  });

  it('CHART_THEMES contains all 6 canonical keys', () => {
    expect(CHART_THEMES).toHaveProperty('darkGlass');
    expect(CHART_THEMES).toHaveProperty('midnight');
    expect(CHART_THEMES).toHaveProperty('neonCyber');
    expect(CHART_THEMES).toHaveProperty('enterprise');
    expect(CHART_THEMES).toHaveProperty('lightCanvas');
    expect(CHART_THEMES).toHaveProperty('lightMinimal');
  });
});

describe('neonCyber stepped emissive intensities', () => {
  it('neonCyber chart theme series emissive intensities are stepped (not uniform)', () => {
    const theme = CHART_THEMES.neonCyber;
    expect(theme.series[0]!.emissiveIntensity).toBeGreaterThan(theme.series[7]!.emissiveIntensity);
  });

  it('neonCyber series[0] emissiveIntensity is exactly 0.90', () => {
    expect(CHART_THEMES.neonCyber.series[0]!.emissiveIntensity).toBe(0.90);
  });

  it('neonCyber series[7] emissiveIntensity is exactly 0.62', () => {
    expect(CHART_THEMES.neonCyber.series[7]!.emissiveIntensity).toBe(0.62);
  });
});
