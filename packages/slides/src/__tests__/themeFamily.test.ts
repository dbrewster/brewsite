import { describe, it, expect } from 'vitest';
import type { ThemeFamily, ThemePolarity } from '@brewsite/core';
import { DECK_THEME_PAIRS, getDeckThemeForFamily, createDeckThemeForFamily } from '../themeFamily';

const FAMILIES: ThemeFamily[] = [
  'darkGlass',
  'midnight',
  'neonCyber',
  'enterprise',
  'lightCanvas',
  'lightMinimal',
];

const POLARITIES: ThemePolarity[] = ['dark', 'light'];

describe('DECK_THEME_PAIRS', () => {
  it('contains all canonical families', () => {
    for (const family of FAMILIES) {
      expect(DECK_THEME_PAIRS[family]).toBeDefined();
    }
  });

  it('contains both polarities for each family', () => {
    for (const family of FAMILIES) {
      for (const polarity of POLARITIES) {
        expect(DECK_THEME_PAIRS[family][polarity]).toBeDefined();
      }
    }
  });

  it('maps dark polarity to colorMode dark and light polarity to colorMode light', () => {
    for (const family of FAMILIES) {
      expect(DECK_THEME_PAIRS[family].dark.colorMode).toBe('dark');
      expect(DECK_THEME_PAIRS[family].light.colorMode).toBe('light');
    }
  });
});

describe('Theme family deck helpers', () => {
  it('getDeckThemeForFamily returns the shared preset object', () => {
    const theme = getDeckThemeForFamily('darkGlass', 'dark');
    expect(theme).toBe(DECK_THEME_PAIRS.darkGlass.dark);
  });

  it('createDeckThemeForFamily returns a cloned object graph', () => {
    const cloned = createDeckThemeForFamily('enterprise', 'light');
    const shared = DECK_THEME_PAIRS.enterprise.light;
    expect(cloned).not.toBe(shared);
    expect(cloned.colors).not.toBe(shared.colors);
    expect(cloned.colors.heading).toBe(shared.colors.heading);
  });

  it('darkGlass dark has expected accent and gradient', () => {
    const theme = getDeckThemeForFamily('darkGlass', 'dark');
    expect(theme.accentColor).toBe('#B33A2B');
    expect(theme.background.gradient).toBe('linear-gradient(180deg, #070504 0%, #130B08 100%)');
  });
});
