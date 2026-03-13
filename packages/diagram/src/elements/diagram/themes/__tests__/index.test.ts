// Tests for the diagram theme defaults and registry.

import { describe, it, expect, beforeEach } from 'vitest';
import {
  enterpriseTheme,
  enterpriseLightTheme,
  defaultDiagramTheme,
  defaultLightDiagramTheme,
  registerDiagramThemePair,
  resolveDiagramTheme,
  _resetDiagramThemeRegistryForTesting,
} from '../index';
import type { DiagramTheme } from '../../types';

describe('default diagram theme exports', () => {
  it('defaultDiagramTheme is the enterprise theme by reference', () => {
    expect(defaultDiagramTheme).toBe(enterpriseTheme);
  });

  it('defaultLightDiagramTheme is the enterprise light theme by reference', () => {
    expect(defaultLightDiagramTheme).toBe(enterpriseLightTheme);
  });

  it('defaultDiagramTheme has expected node defaultColor', () => {
    expect(enterpriseTheme.node.defaultColor).toBe('#172029FF');
  });

  it('enterpriseLightTheme has light node colors', () => {
    expect(enterpriseLightTheme.node.defaultLabelColor).toBe('#1F334E');
  });
});

describe('diagram theme registry', () => {
  const testDark: DiagramTheme = {
    ...enterpriseTheme,
    node: { ...enterpriseTheme.node, defaultColor: '#111111' },
  } as DiagramTheme;
  const testLight: DiagramTheme = {
    ...enterpriseLightTheme,
    node: { ...enterpriseLightTheme.node, defaultColor: '#ffffff' },
  } as DiagramTheme;

  beforeEach(() => {
    _resetDiagramThemeRegistryForTesting();
  });

  it('resolves "default" dark to defaultDiagramTheme', () => {
    expect(resolveDiagramTheme('default', 'dark')).toBe(defaultDiagramTheme);
  });

  it('resolves "default" light to defaultLightDiagramTheme', () => {
    expect(resolveDiagramTheme('default', 'light')).toBe(defaultLightDiagramTheme);
  });

  it('resolves "enterprise" dark to defaultDiagramTheme (alias)', () => {
    expect(resolveDiagramTheme('enterprise', 'dark')).toBe(defaultDiagramTheme);
  });

  it('falls back to default for an unregistered family', () => {
    const theme = resolveDiagramTheme('darkGlass', 'dark');
    expect(theme).toBe(defaultDiagramTheme);
  });

  it('registered family overrides the fallback', () => {
    registerDiagramThemePair('darkGlass', { dark: testDark, light: testLight });
    expect(resolveDiagramTheme('darkGlass', 'dark')).toBe(testDark);
  });

  it('registered family light polarity resolves correctly', () => {
    registerDiagramThemePair('darkGlass', { dark: testDark, light: testLight });
    expect(resolveDiagramTheme('darkGlass', 'light')).toBe(testLight);
  });
});
