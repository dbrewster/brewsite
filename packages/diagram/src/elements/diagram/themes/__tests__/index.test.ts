// Tests for the DIAGRAM_THEMES and DIAGRAM_THEME_PAIRS registries in themes/index.ts.

import { describe, it, expect } from 'vitest';
import { DIAGRAM_THEMES, DIAGRAM_THEME_PAIRS } from '../index';
import { SCENE_THEME_PAIRS } from '@brewsite/core';
import type { ThemeFamily } from '@brewsite/core';

describe('DIAGRAM_THEMES registry completeness', () => {
  it('DIAGRAM_THEMES contains exactly 6 keys', () => {
    expect(Object.keys(DIAGRAM_THEMES)).toHaveLength(6);
  });

  it('DIAGRAM_THEMES contains all canonical theme names', () => {
    expect(DIAGRAM_THEMES).toHaveProperty('darkGlass');
    expect(DIAGRAM_THEMES).toHaveProperty('midnight');
    expect(DIAGRAM_THEMES).toHaveProperty('neonCyber');
    expect(DIAGRAM_THEMES).toHaveProperty('enterprise');
    expect(DIAGRAM_THEMES).toHaveProperty('lightCanvas');
    expect(DIAGRAM_THEMES).toHaveProperty('lightMinimal');
  });

  it('DIAGRAM_THEMES.midnight is a valid DiagramTheme with expected node defaultColor', () => {
    expect(DIAGRAM_THEMES.midnight.node.defaultColor).toBe('#261A13');
  });

  it('DIAGRAM_THEMES.lightCanvas is a valid DiagramTheme with expected node defaultColor', () => {
    expect(DIAGRAM_THEMES.lightCanvas.node.defaultColor.toLowerCase()).toBe('#ffffff');
  });
});

const FAMILIES: ThemeFamily[] = [
  'darkGlass', 'midnight', 'neonCyber', 'enterprise', 'lightCanvas', 'lightMinimal',
];

describe('DIAGRAM_THEME_PAIRS', () => {
  it('contains all six theme families', () => {
    for (const family of FAMILIES) {
      expect(DIAGRAM_THEME_PAIRS[family]).toBeDefined();
    }
  });

  it('each dark entry has sceneTheme.colorMode === "dark"', () => {
    for (const family of FAMILIES) {
      expect(DIAGRAM_THEME_PAIRS[family].dark.sceneTheme?.colorMode).toBe('dark');
    }
  });

  it('each light entry has sceneTheme.colorMode === "light"', () => {
    for (const family of FAMILIES) {
      expect(DIAGRAM_THEME_PAIRS[family].light.sceneTheme?.colorMode).toBe('light');
    }
  });

  it('dark entry sceneTheme is the same object as SCENE_THEME_PAIRS[family].dark', () => {
    for (const family of FAMILIES) {
      expect(DIAGRAM_THEME_PAIRS[family].dark.sceneTheme).toBe(SCENE_THEME_PAIRS[family].dark);
    }
  });

  it('light entry sceneTheme is the same object as SCENE_THEME_PAIRS[family].light', () => {
    for (const family of FAMILIES) {
      expect(DIAGRAM_THEME_PAIRS[family].light.sceneTheme).toBe(SCENE_THEME_PAIRS[family].light);
    }
  });

  it('DIAGRAM_THEMES is unchanged — existing flat registry still works', () => {
    for (const family of FAMILIES) {
      expect(DIAGRAM_THEMES[family]).toBeDefined();
    }
  });
});
