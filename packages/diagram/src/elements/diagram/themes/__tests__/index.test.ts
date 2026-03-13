// Tests for the diagram themeRegistry (registerDiagramThemePair, resolveDiagramTheme).

import { describe, it, expect, beforeEach } from 'vitest';
import {
  registerDiagramThemePair,
  resolveDiagramTheme,
  _resetDiagramThemeRegistryForTesting,
} from '../index';
import { darkGlassTheme } from '../darkGlass';
import { darkGlassLightTheme } from '../darkGlassLight';
import { enterpriseTheme } from '../enterprise';
import { enterpriseLightTheme } from '../enterpriseLight';

beforeEach(() => {
  _resetDiagramThemeRegistryForTesting();
});

describe('resolveDiagramTheme — default family', () => {
  it('resolves dark polarity to enterpriseTheme by default', () => {
    const result = resolveDiagramTheme('default', 'dark');
    expect(result).toBe(enterpriseTheme);
  });

  it('resolves light polarity to enterpriseLightTheme by default', () => {
    const result = resolveDiagramTheme('default', 'light');
    expect(result).toBe(enterpriseLightTheme);
  });

  it('falls back to default when family is not registered', () => {
    const result = resolveDiagramTheme('darkGlass', 'dark');
    expect(result).toBe(enterpriseTheme);
  });
});

describe('registerDiagramThemePair', () => {
  it('registered dark theme is returned by resolveDiagramTheme', () => {
    registerDiagramThemePair('darkGlass', { dark: darkGlassTheme, light: darkGlassLightTheme });
    expect(resolveDiagramTheme('darkGlass', 'dark')).toBe(darkGlassTheme);
  });

  it('registered light theme is returned by resolveDiagramTheme', () => {
    registerDiagramThemePair('darkGlass', { dark: darkGlassTheme, light: darkGlassLightTheme });
    expect(resolveDiagramTheme('darkGlass', 'light')).toBe(darkGlassLightTheme);
  });

  it('overwriting a family replaces the prior registration', () => {
    registerDiagramThemePair('darkGlass', { dark: darkGlassTheme, light: darkGlassLightTheme });
    registerDiagramThemePair('darkGlass', { dark: enterpriseTheme, light: enterpriseLightTheme });
    expect(resolveDiagramTheme('darkGlass', 'dark')).toBe(enterpriseTheme);
  });

  it('registering one family does not affect resolution of another', () => {
    registerDiagramThemePair('darkGlass', { dark: darkGlassTheme, light: darkGlassLightTheme });
    // 'midnight' is still unregistered — falls back to default
    expect(resolveDiagramTheme('midnight', 'dark')).toBe(enterpriseTheme);
  });
});

describe('_resetDiagramThemeRegistryForTesting', () => {
  it('removes registered families after reset', () => {
    registerDiagramThemePair('darkGlass', { dark: darkGlassTheme, light: darkGlassLightTheme });
    _resetDiagramThemeRegistryForTesting();
    // darkGlass is gone — falls back to default
    expect(resolveDiagramTheme('darkGlass', 'dark')).toBe(enterpriseTheme);
  });

  it('default pair is still available after reset', () => {
    _resetDiagramThemeRegistryForTesting();
    expect(resolveDiagramTheme('default', 'dark')).toBe(enterpriseTheme);
    expect(resolveDiagramTheme('default', 'light')).toBe(enterpriseLightTheme);
  });
});
