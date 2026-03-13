// Interface-based stateful tests for sceneThemeRegistry.
// Tests the resolve/register/fallback contract — not internal implementation details.

import { beforeEach, describe, it, expect } from 'vitest';
import {
  registerSceneThemePair,
  resolveSceneTheme,
  _resetSceneThemeRegistryForTesting,
} from '../sceneThemeRegistry';
import { defaultSceneTheme, defaultLightSceneTheme } from '../presets';
import type { SceneTheme } from '../types';

// Test-only theme objects — distinct references to verify registration.
const testDarkTheme: SceneTheme = {
  colorMode: 'dark',
  font: { htmlFamily: 'Test-Dark, sans-serif' },
  fontSize: { heading: 1.5, body: 1.0, label: 0.85, caption: 0.7, annotation: 0.6 },
};
const testLightTheme: SceneTheme = {
  colorMode: 'light',
  font: { htmlFamily: 'Test-Light, sans-serif' },
  fontSize: { heading: 1.5, body: 1.0, label: 0.85, caption: 0.7, annotation: 0.6 },
};

describe('sceneThemeRegistry', () => {
  beforeEach(() => {
    _resetSceneThemeRegistryForTesting();
  });

  it('resolves "default" dark without any registration', () => {
    const theme = resolveSceneTheme('default', 'dark');
    expect(theme.colorMode).toBe('dark');
  });

  it('resolves "default" light without any registration', () => {
    const theme = resolveSceneTheme('default', 'light');
    expect(theme.colorMode).toBe('light');
  });

  it('default dark theme is defaultSceneTheme by reference', () => {
    const theme = resolveSceneTheme('default', 'dark');
    expect(theme).toBe(defaultSceneTheme);
  });

  it('default light theme is defaultLightSceneTheme by reference', () => {
    const theme = resolveSceneTheme('default', 'light');
    expect(theme).toBe(defaultLightSceneTheme);
  });

  it('enterprise dark theme is defaultSceneTheme by reference (alias)', () => {
    const theme = resolveSceneTheme('enterprise', 'dark');
    expect(theme).toBe(defaultSceneTheme);
  });

  it('falls back to default for an unregistered family', () => {
    // darkGlass is not registered after reset — should fall back to default
    const theme = resolveSceneTheme('darkGlass', 'dark');
    expect(theme).toBeDefined();
    expect(theme.colorMode).toBe('dark');
    expect(theme).toBe(defaultSceneTheme);
  });

  it('registered family overrides the fallback', () => {
    registerSceneThemePair('darkGlass', {
      dark: testDarkTheme,
      light: testLightTheme,
    });
    const theme = resolveSceneTheme('darkGlass', 'dark');
    expect(theme).toBe(testDarkTheme);
  });

  it('registered family light polarity resolves correctly', () => {
    registerSceneThemePair('darkGlass', {
      dark: testDarkTheme,
      light: testLightTheme,
    });
    const theme = resolveSceneTheme('darkGlass', 'light');
    expect(theme).toBe(testLightTheme);
  });

  it('unregistered family after reset falls back again', () => {
    registerSceneThemePair('darkGlass', {
      dark: testDarkTheme,
      light: testLightTheme,
    });
    _resetSceneThemeRegistryForTesting();
    // After reset, darkGlass is no longer registered — falls back to default
    const theme = resolveSceneTheme('darkGlass', 'dark');
    expect(theme).toBe(defaultSceneTheme);
  });

  it('registering "default" overwrites the pre-loaded pair', () => {
    registerSceneThemePair('default', {
      dark: testDarkTheme,
      light: testLightTheme,
    });
    const theme = resolveSceneTheme('default', 'dark');
    expect(theme).toBe(testDarkTheme);
  });
});
