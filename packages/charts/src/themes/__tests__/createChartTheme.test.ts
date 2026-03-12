// Unit tests for createChartTheme — theme factory with partial overrides.

import { describe, it, expect } from 'vitest';
import { createChartTheme } from '../createChartTheme';
import { CHART_THEMES } from '../index';
import { darkGlassChartTheme } from '../darkGlass';
import { darkGlassLightChartTheme } from '../darkGlassLight';
import { enterpriseChartTheme } from '../enterprise';
import { enterpriseLightChartTheme } from '../enterpriseLight';
import { midnightChartTheme } from '../midnight';
import { midnightLightChartTheme } from '../midnightLight';
import { neonCyberChartTheme } from '../neonCyber';
import { neonCyberLightChartTheme } from '../neonCyberLight';
import { lightCanvasChartTheme } from '../lightCanvas';
import { lightCanvasDarkChartTheme } from '../lightCanvasDark';
import { lightMinimalChartTheme } from '../lightMinimal';
import { lightMinimalDarkChartTheme } from '../lightMinimalDark';
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
    expect(result.gridlines?.color).toBe('#6E55D1');
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

  it('createChartTheme("midnight", {}) series[0].color is #E2A33A', () => {
    const result = createChartTheme('midnight', {});
    expect(result.series[0]?.color).toBe('#E2A33A');
  });

  it('createChartTheme("lightCanvas", {}) returns theme with name "lightCanvas"', () => {
    const result = createChartTheme('lightCanvas', {});
    expect(result.name).toBe('lightCanvas');
  });

  it('createChartTheme("lightCanvas", {}) series[0].color is #3D63D9', () => {
    const result = createChartTheme('lightCanvas', {});
    expect(result.series[0]?.color).toBe('#3D63D9');
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

describe('All 12 preset themes: tooltip + projection tokens', () => {
  const allThemes = [
    darkGlassChartTheme, darkGlassLightChartTheme,
    midnightChartTheme, midnightLightChartTheme,
    neonCyberChartTheme, neonCyberLightChartTheme,
    enterpriseChartTheme, enterpriseLightChartTheme,
    lightCanvasChartTheme, lightCanvasDarkChartTheme,
    lightMinimalChartTheme, lightMinimalDarkChartTheme,
  ];

  for (const theme of allThemes) {
    it(`${theme.name}: tooltip tokens present and valid`, () => {
      expect(theme.tooltip).toBeDefined();
      expect(typeof theme.tooltip!.background).toBe('string');
      expect(typeof theme.tooltip!.maxWidth).toBe('number');
      expect(theme.tooltip!.offsetX).toBeGreaterThan(0);
    });

    it(`${theme.name}: projection tokens present and valid`, () => {
      expect(theme.projection).toBeDefined();
      expect(typeof theme.projection!.color).toBe('string');
      expect(theme.projection!.animationDurationMs).toBe(220);
      expect(theme.projection!.beamWidth).toBeGreaterThan(0);
    });
  }
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

  it('neonCyber series[0] emissiveIntensity is exactly 0.95', () => {
    expect(CHART_THEMES.neonCyber.series[0]!.emissiveIntensity).toBe(0.95);
  });

  it('neonCyber series[7] emissiveIntensity is exactly 0.58', () => {
    expect(CHART_THEMES.neonCyber.series[7]!.emissiveIntensity).toBe(0.58);
  });
});

describe('Stream A corrections: material and tooltip/projection token values', () => {
  // darkGlassLight material correction
  it('darkGlassLightChartTheme series[0].metalness is 0.10 (was 0.50)', () => {
    expect(darkGlassLightChartTheme.series[0]!.metalness).toBe(0.10);
  });

  it('darkGlassLightChartTheme series[0].roughness is 0.34 (was 0.14)', () => {
    expect(darkGlassLightChartTheme.series[0]!.roughness).toBe(0.34);
  });

  it('darkGlassLightChartTheme all series have metalness 0.10', () => {
    for (const s of darkGlassLightChartTheme.series) {
      expect(s.metalness).toBe(0.10);
    }
  });

  it('darkGlassLightChartTheme all series have roughness 0.34', () => {
    for (const s of darkGlassLightChartTheme.series) {
      expect(s.roughness).toBe(0.34);
    }
  });

  // midnight tooltip/projection correction (amber family, not blue)
  it('midnightChartTheme.projection.color is amber (#E2A33A), not blue', () => {
    expect(midnightChartTheme.projection!.color).toBe('#E2A33A');
  });

  it('midnightChartTheme.tooltip.borderColor contains amber family rgba values', () => {
    expect(midnightChartTheme.tooltip!.borderColor).toBe('rgba(226,163,58,0.30)');
  });

  it('midnightLightChartTheme.projection.color is amber (#A7793A), not blue', () => {
    expect(midnightLightChartTheme.projection!.color).toBe('#A7793A');
  });

  it('midnightLightChartTheme.tooltip.valueColor is warm (#3A2A1B), not blue', () => {
    expect(midnightLightChartTheme.tooltip!.valueColor).toBe('#3A2A1B');
  });

  // enterprise dark tooltip correction
  it('enterpriseChartTheme.tooltip.background is dark navy (not white)', () => {
    expect(enterpriseChartTheme.tooltip!.background).toBe('rgba(10,20,36,0.94)');
  });

  it('enterpriseChartTheme.tooltip.valueColor is light (#E3ECF8) for dark polarity', () => {
    expect(enterpriseChartTheme.tooltip!.valueColor).toBe('#E3ECF8');
  });

  it('enterpriseChartTheme.projection.opacity is 0.72', () => {
    expect(enterpriseChartTheme.projection!.opacity).toBe(0.72);
  });

  // lightCanvas tooltip/projection correction
  it('lightCanvasChartTheme.projection.color is blue (#3D63D9), not green', () => {
    expect(lightCanvasChartTheme.projection!.color).toBe('#3D63D9');
  });

  it('lightCanvasDarkChartTheme.projection.color is blue (#3D63D9), not green', () => {
    expect(lightCanvasDarkChartTheme.projection!.color).toBe('#3D63D9');
  });

  it('lightCanvasDarkChartTheme.tooltip.background is navy-tinted (not green-tinted)', () => {
    expect(lightCanvasDarkChartTheme.tooltip!.background).toBe('rgba(18,26,38,0.94)');
  });

  // lightMinimal tooltip/projection correction
  it('lightMinimalChartTheme.projection.color is pastel blue (#7FAEEA), not gray', () => {
    expect(lightMinimalChartTheme.projection!.color).toBe('#7FAEEA');
  });

  it('lightMinimalDarkChartTheme.projection.color is pastel blue (#7FAEEA), not gray', () => {
    expect(lightMinimalDarkChartTheme.projection!.color).toBe('#7FAEEA');
  });

  it('lightMinimalChartTheme.tooltip.valueColor is family-specific (#223248), not generic', () => {
    expect(lightMinimalChartTheme.tooltip!.valueColor).toBe('#223248');
  });

  it('lightMinimalDarkChartTheme.tooltip.valueColor is #E8EDF5', () => {
    expect(lightMinimalDarkChartTheme.tooltip!.valueColor).toBe('#E8EDF5');
  });

  // Regression: dark variants must not have white/light tooltip backgrounds
  it('No dark-polarity chart theme has a white tooltip background', () => {
    const darkThemes = [
      darkGlassChartTheme,
      midnightChartTheme,
      neonCyberChartTheme,
      enterpriseChartTheme,
      lightCanvasDarkChartTheme,
      lightMinimalDarkChartTheme,
    ];
    for (const theme of darkThemes) {
      expect(theme.tooltip!.background).not.toMatch(/rgba\(255,255,255/);
    }
  });

  // Regression: midnight must not have blue tooltip/projection
  it('midnightChartTheme.tooltip.borderColor does not contain blue channel values', () => {
    expect(midnightChartTheme.tooltip!.borderColor).not.toMatch(/107,155,255/);
    expect(midnightChartTheme.tooltip!.borderColor).not.toMatch(/79,100,200/);
  });

  // Challenge 3a: midnight light tooltip.borderColor amber assertion (PM-2 named this explicitly)
  it('midnightLightChartTheme.tooltip.borderColor is amber family, not blue', () => {
    expect(midnightLightChartTheme.tooltip!.borderColor).toBe('rgba(170,120,58,0.28)');
  });

  // Challenge 3b: cross-theme regression guard — no light-polarity theme should ever have
  // metalness > 0.20, which would produce dark mirror-like surfaces on light backgrounds.
  it('All light-polarity chart themes have series metalness ≤ 0.20 (regression guard)', () => {
    const lightThemes = [
      darkGlassLightChartTheme,
      midnightLightChartTheme,
      neonCyberLightChartTheme,
      enterpriseLightChartTheme,
      lightCanvasChartTheme,
      lightMinimalChartTheme,
    ];
    for (const theme of lightThemes) {
      for (const s of theme.series) {
        expect(s.metalness).toBeLessThanOrEqual(0.20);
      }
    }
  });
});
