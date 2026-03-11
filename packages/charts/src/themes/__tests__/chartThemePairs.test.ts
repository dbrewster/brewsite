import { describe, it, expect } from 'vitest';
import { CHART_THEME_PAIRS, CHART_THEMES } from '../index';
import { SCENE_THEME_PAIRS } from '@brewsite/core';
import type { ThemeFamily } from '@brewsite/core';

const FAMILIES: ThemeFamily[] = [
  'darkGlass', 'midnight', 'neonCyber', 'enterprise', 'lightCanvas', 'lightMinimal',
];

describe('CHART_THEME_PAIRS', () => {
  it('contains all six theme families', () => {
    for (const family of FAMILIES) {
      expect(CHART_THEME_PAIRS[family]).toBeDefined();
    }
  });

  it('each dark entry has sceneTheme.colorMode === "dark"', () => {
    for (const family of FAMILIES) {
      expect(CHART_THEME_PAIRS[family].dark.sceneTheme?.colorMode).toBe('dark');
    }
  });

  it('each light entry has sceneTheme.colorMode === "light"', () => {
    for (const family of FAMILIES) {
      expect(CHART_THEME_PAIRS[family].light.sceneTheme?.colorMode).toBe('light');
    }
  });

  it('dark entry sceneTheme is the same object as SCENE_THEME_PAIRS[family].dark', () => {
    for (const family of FAMILIES) {
      expect(CHART_THEME_PAIRS[family].dark.sceneTheme).toBe(SCENE_THEME_PAIRS[family].dark);
    }
  });

  it('light entry sceneTheme is the same object as SCENE_THEME_PAIRS[family].light', () => {
    for (const family of FAMILIES) {
      expect(CHART_THEME_PAIRS[family].light.sceneTheme).toBe(SCENE_THEME_PAIRS[family].light);
    }
  });

  it('each dark entry has a valid series array with at least 1 entry', () => {
    for (const family of FAMILIES) {
      expect(CHART_THEME_PAIRS[family].dark.series.length).toBeGreaterThan(0);
    }
  });

  it('CHART_THEMES unchanged — flat registry still has 6 entries', () => {
    expect(Object.keys(CHART_THEMES)).toHaveLength(6);
  });
});
