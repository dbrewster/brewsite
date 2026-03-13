// Unit tests for chartThemeRegistry — pre-loaded defaults and registration lifecycle.

import { describe, it, expect, beforeEach } from 'vitest';
import {
  registerChartThemePair,
  resolveChartTheme,
  resolveChartThemeValue,
  _resetChartThemeRegistryForTesting,
} from '../chartThemeRegistry';
import { enterpriseChartTheme } from '../enterprise';
import { enterpriseLightChartTheme } from '../enterpriseLight';
import type { ChartTheme } from '../types';

describe('chartThemeRegistry — pre-loaded defaults', () => {
  beforeEach(() => {
    _resetChartThemeRegistryForTesting();
  });

  it("resolveChartTheme('default', 'dark') returns the enterprise theme", () => {
    const theme = resolveChartTheme('default', 'dark');
    expect(theme).toBe(enterpriseChartTheme);
  });

  it("resolveChartTheme('default', 'light') returns the enterprise light theme", () => {
    const theme = resolveChartTheme('default', 'light');
    expect(theme).toBe(enterpriseLightChartTheme);
  });

  it("resolveChartTheme('enterprise', 'dark') returns the enterprise theme", () => {
    const theme = resolveChartTheme('enterprise', 'dark');
    expect(theme).toBe(enterpriseChartTheme);
  });

  it("resolveChartTheme('enterprise', 'light') returns the enterprise light theme", () => {
    const theme = resolveChartTheme('enterprise', 'light');
    expect(theme).toBe(enterpriseLightChartTheme);
  });

  it('falls back to default dark theme for an unregistered family name', () => {
    const theme = resolveChartTheme('nonexistent', 'dark');
    expect(theme).toBe(enterpriseChartTheme);
  });

  it('falls back to default light theme for an unregistered family name', () => {
    const theme = resolveChartTheme('nonexistent', 'light');
    expect(theme).toBe(enterpriseLightChartTheme);
  });
});

describe('chartThemeRegistry — registerChartThemePair', () => {
  beforeEach(() => {
    _resetChartThemeRegistryForTesting();
  });

  it('registered theme is returned for the registered family name', () => {
    const customDark: ChartTheme = { ...enterpriseChartTheme, name: 'custom-dark' };
    const customLight: ChartTheme = { ...enterpriseLightChartTheme, name: 'custom-light' };
    registerChartThemePair('custom', { dark: customDark, light: customLight });

    expect(resolveChartTheme('custom', 'dark')).toBe(customDark);
    expect(resolveChartTheme('custom', 'light')).toBe(customLight);
  });

  it('registering same family twice overwrites the previous entry', () => {
    const first: ChartTheme = { ...enterpriseChartTheme, name: 'first' };
    const second: ChartTheme = { ...enterpriseChartTheme, name: 'second' };
    registerChartThemePair('overwrite', { dark: first, light: first });
    registerChartThemePair('overwrite', { dark: second, light: second });

    expect(resolveChartTheme('overwrite', 'dark')).toBe(second);
  });

  it('default and enterprise entries remain after registering another family', () => {
    const custom: ChartTheme = { ...enterpriseChartTheme, name: 'extra' };
    registerChartThemePair('extra', { dark: custom, light: custom });

    expect(resolveChartTheme('default', 'dark')).toBe(enterpriseChartTheme);
    expect(resolveChartTheme('enterprise', 'dark')).toBe(enterpriseChartTheme);
  });
});

describe('chartThemeRegistry — _resetChartThemeRegistryForTesting', () => {
  it('reset clears registered families and restores default+enterprise', () => {
    const custom: ChartTheme = { ...enterpriseChartTheme, name: 'registered' };
    registerChartThemePair('registered', { dark: custom, light: custom });

    _resetChartThemeRegistryForTesting();

    // Registered family is gone — falls back to default
    expect(resolveChartTheme('registered', 'dark')).toBe(enterpriseChartTheme);
    // Defaults are back
    expect(resolveChartTheme('default', 'dark')).toBe(enterpriseChartTheme);
    expect(resolveChartTheme('enterprise', 'dark')).toBe(enterpriseChartTheme);
  });
});

describe('resolveChartThemeValue', () => {
  beforeEach(() => {
    _resetChartThemeRegistryForTesting();
  });

  it('returns the object directly when given a ChartTheme object', () => {
    const custom: ChartTheme = { ...enterpriseChartTheme, name: 'custom' };
    expect(resolveChartThemeValue(custom)).toBe(custom);
  });

  it('resolves a registered family name string to the dark polarity', () => {
    expect(resolveChartThemeValue('enterprise')).toBe(enterpriseChartTheme);
  });

  it('falls back to default dark for an unregistered family name string', () => {
    expect(resolveChartThemeValue('unregistered')).toBe(enterpriseChartTheme);
  });
});
