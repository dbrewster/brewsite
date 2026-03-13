// Tests for chartThemeRegistry — registry-based chart theme resolution.

import { describe, it, expect, beforeEach } from 'vitest';
import {
  resolveChartTheme,
  registerChartThemePair,
  _resetChartThemeRegistryForTesting,
} from '../chartThemeRegistry';
import { enterpriseChartTheme } from '../enterprise';
import { enterpriseLightChartTheme } from '../enterpriseLight';
import { darkGlassChartTheme } from '../darkGlass';
import { darkGlassLightChartTheme } from '../darkGlassLight';
import type { ChartTheme } from '../types';

const darkGlassPair = { dark: darkGlassChartTheme, light: darkGlassLightChartTheme };

describe('chartThemeRegistry — default pre-load', () => {
  beforeEach(() => {
    _resetChartThemeRegistryForTesting();
  });

  it('resolves dark polarity to enterpriseChartTheme for "default" family', () => {
    const theme = resolveChartTheme('default', 'dark');
    expect(theme).toBe(enterpriseChartTheme);
  });

  it('resolves light polarity to enterpriseLightChartTheme for "default" family', () => {
    const theme = resolveChartTheme('default', 'light');
    expect(theme).toBe(enterpriseLightChartTheme);
  });

  it('falls back to "default" dark for an unregistered family', () => {
    const theme = resolveChartTheme('darkGlass', 'dark');
    expect(theme).toBe(enterpriseChartTheme);
  });

  it('falls back to "default" light for an unregistered family', () => {
    const theme = resolveChartTheme('darkGlass', 'light');
    expect(theme).toBe(enterpriseLightChartTheme);
  });
});

describe('chartThemeRegistry — registerChartThemePair', () => {
  beforeEach(() => {
    _resetChartThemeRegistryForTesting();
  });

  it('registered family resolves its dark theme', () => {
    registerChartThemePair('darkGlass', darkGlassPair);
    expect(resolveChartTheme('darkGlass', 'dark')).toBe(darkGlassChartTheme);
  });

  it('registered family resolves its light theme', () => {
    registerChartThemePair('darkGlass', darkGlassPair);
    expect(resolveChartTheme('darkGlass', 'light')).toBe(darkGlassLightChartTheme);
  });

  it('registering one family does not affect another', () => {
    registerChartThemePair('darkGlass', darkGlassPair);
    // 'midnight' is still unregistered — should fall back to 'default'
    expect(resolveChartTheme('midnight', 'dark')).toBe(enterpriseChartTheme);
  });

  it('re-registering a family overwrites the previous pair', () => {
    const customTheme: ChartTheme = { ...darkGlassChartTheme, name: 'custom-override' };
    registerChartThemePair('darkGlass', darkGlassPair);
    registerChartThemePair('darkGlass', { dark: customTheme, light: customTheme });
    expect(resolveChartTheme('darkGlass', 'dark')).toBe(customTheme);
  });

  it('default family can be overridden', () => {
    const customTheme: ChartTheme = { ...enterpriseChartTheme, name: 'custom-default' };
    registerChartThemePair('default', { dark: customTheme, light: customTheme });
    expect(resolveChartTheme('default', 'dark')).toBe(customTheme);
  });
});

describe('chartThemeRegistry — _resetChartThemeRegistryForTesting', () => {
  it('restores default after a custom registration', () => {
    registerChartThemePair('darkGlass', darkGlassPair);
    _resetChartThemeRegistryForTesting();
    // After reset, darkGlass falls back to default
    expect(resolveChartTheme('darkGlass', 'dark')).toBe(enterpriseChartTheme);
  });

  it('restores "default" entry after it was overwritten', () => {
    const customTheme: ChartTheme = { ...enterpriseChartTheme, name: 'custom-default' };
    registerChartThemePair('default', { dark: customTheme, light: customTheme });
    _resetChartThemeRegistryForTesting();
    expect(resolveChartTheme('default', 'dark')).toBe(enterpriseChartTheme);
  });
});
