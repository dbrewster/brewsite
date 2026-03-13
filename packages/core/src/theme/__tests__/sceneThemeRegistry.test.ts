// Interface-based stateful tests for sceneThemeRegistry.
// Tests the resolve/register/fallback contract — not internal implementation details.

import { beforeEach, describe, it, expect } from 'vitest';
import {
  registerSceneThemePair,
  resolveSceneTheme,
  _resetSceneThemeRegistryForTesting,
} from '../sceneThemeRegistry';
import { darkGlassSceneTheme, darkGlassLightSceneTheme, enterpriseSceneTheme, enterpriseLightSceneTheme } from '../presets';

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

  it('default dark theme is enterpriseSceneTheme by reference', () => {
    const theme = resolveSceneTheme('default', 'dark');
    expect(theme).toBe(enterpriseSceneTheme);
  });

  it('default light theme is enterpriseLightSceneTheme by reference', () => {
    const theme = resolveSceneTheme('default', 'light');
    expect(theme).toBe(enterpriseLightSceneTheme);
  });

  it('falls back to default for an unregistered family', () => {
    // darkGlass is not registered after reset — should fall back to default
    const theme = resolveSceneTheme('darkGlass', 'dark');
    expect(theme).toBeDefined();
    expect(theme.colorMode).toBe('dark');
    // Should be the default (enterprise) aesthetic
    expect(theme).toBe(enterpriseSceneTheme);
  });

  it('registered family overrides the fallback', () => {
    registerSceneThemePair('darkGlass', {
      dark: darkGlassSceneTheme,
      light: darkGlassLightSceneTheme,
    });
    const theme = resolveSceneTheme('darkGlass', 'dark');
    expect(theme).toBe(darkGlassSceneTheme);
  });

  it('registered family light polarity resolves correctly', () => {
    registerSceneThemePair('darkGlass', {
      dark: darkGlassSceneTheme,
      light: darkGlassLightSceneTheme,
    });
    const theme = resolveSceneTheme('darkGlass', 'light');
    expect(theme).toBe(darkGlassLightSceneTheme);
  });

  it('unregistered family after reset falls back again', () => {
    registerSceneThemePair('darkGlass', {
      dark: darkGlassSceneTheme,
      light: darkGlassLightSceneTheme,
    });
    _resetSceneThemeRegistryForTesting();
    // After reset, darkGlass is no longer registered — falls back to default
    const theme = resolveSceneTheme('darkGlass', 'dark');
    expect(theme).toBe(enterpriseSceneTheme);
  });

  it('registering "default" overwrites the pre-loaded pair', () => {
    registerSceneThemePair('default', {
      dark: darkGlassSceneTheme,
      light: darkGlassLightSceneTheme,
    });
    const theme = resolveSceneTheme('default', 'dark');
    expect(theme).toBe(darkGlassSceneTheme);
  });
});
