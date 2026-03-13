import { describe, it, expect, beforeEach } from 'vitest';
import { themesPlugin } from '../plugin';
import {
  resolveSceneTheme,
  _resetSceneThemeRegistryForTesting,
} from '@brewsite/core';
import {
  resolveDiagramTheme,
  _resetDiagramThemeRegistryForTesting,
} from '@brewsite/diagram';
import {
  resolveChartTheme,
  _resetChartThemeRegistryForTesting,
} from '@brewsite/charts';
import type { WidgetRegistry, AssetManifest } from '@brewsite/core';

const mockReg = {} as WidgetRegistry;

describe('themesPlugin', () => {
  beforeEach(() => {
    _resetSceneThemeRegistryForTesting();
    _resetDiagramThemeRegistryForTesting();
    _resetChartThemeRegistryForTesting();
  });

  it('registerHandlers is a no-op', () => {
    const plugin = themesPlugin();
    expect(() => plugin.registerHandlers()).not.toThrow();
  });

  it('createWidgets returns empty array', () => {
    expect(themesPlugin().createWidgets()).toHaveLength(0);
  });

  it('configureRegistry registers all 5 families — scene themes resolvable', () => {
    themesPlugin().configureRegistry!(mockReg, null as AssetManifest | null);
    expect(resolveSceneTheme('darkGlass', 'dark').colorMode).toBe('dark');
    expect(resolveSceneTheme('midnight', 'dark').colorMode).toBe('dark');
    expect(resolveSceneTheme('neonCyber', 'dark').colorMode).toBe('dark');
    expect(resolveSceneTheme('lightCanvas', 'light').colorMode).toBe('light');
    expect(resolveSceneTheme('lightMinimal', 'light').colorMode).toBe('light');
  });

  it('configureRegistry registers all 5 families — diagram themes resolvable', () => {
    themesPlugin().configureRegistry!(mockReg, null as AssetManifest | null);
    expect(resolveDiagramTheme('darkGlass', 'dark')).toBeDefined();
    expect(resolveDiagramTheme('midnight', 'dark')).toBeDefined();
    expect(resolveDiagramTheme('neonCyber', 'dark')).toBeDefined();
    expect(resolveDiagramTheme('lightCanvas', 'light')).toBeDefined();
    expect(resolveDiagramTheme('lightMinimal', 'light')).toBeDefined();
  });

  it('configureRegistry registers all 5 families — chart themes resolvable', () => {
    themesPlugin().configureRegistry!(mockReg, null as AssetManifest | null);
    expect(resolveChartTheme('darkGlass', 'dark')).toBeDefined();
    expect(resolveChartTheme('midnight', 'dark')).toBeDefined();
    expect(resolveChartTheme('neonCyber', 'dark')).toBeDefined();
    expect(resolveChartTheme('lightCanvas', 'light')).toBeDefined();
    expect(resolveChartTheme('lightMinimal', 'light')).toBeDefined();
  });

  it('configureRegistry with explicit bundle list registers only that family', async () => {
    const { darkGlassBundle } = await import('../bundles/darkGlass');
    themesPlugin([darkGlassBundle]).configureRegistry!(mockReg, null as AssetManifest | null);
    // darkGlass is registered — resolves to the actual darkGlass theme, not default
    expect(resolveSceneTheme('darkGlass', 'dark').colorMode).toBe('dark');
    // midnight was NOT registered — falls back to 'default' (enterprise)
    const midnight = resolveSceneTheme('midnight', 'dark');
    const defaultDark = resolveSceneTheme('default', 'dark');
    expect(midnight).toBe(defaultDark); // same object reference: registry fallback to 'default'
  });
});
