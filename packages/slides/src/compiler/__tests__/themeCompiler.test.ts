// Tests for compileDeckTheme() — merge with defaults, SceneTheme derivation, CSS vars.

import { describe, it, expect } from 'vitest';
import { compileDeckTheme } from '../themeCompiler';
import { defaultDeckTheme } from '../../theme';

describe('compileDeckTheme', () => {
  describe('defaults', () => {
    it('uses defaultDeckTheme values when no argument is provided', () => {
      const result = compileDeckTheme();
      expect(result.colorMode).toBe(defaultDeckTheme.colorMode);
      expect(result.fonts.heading).toBe(defaultDeckTheme.fonts.heading);
      expect(result.background.color).toBe(defaultDeckTheme.background.color);
    });

    it('populates all required colors from defaults', () => {
      const result = compileDeckTheme();
      expect(result.colors.heading).toBe(defaultDeckTheme.colors.heading);
      expect(result.colors.body).toBe(defaultDeckTheme.colors.body);
      expect(result.colors.surface).toBe(defaultDeckTheme.colors.surface);
      expect(result.colors.muted).toBe(defaultDeckTheme.colors.muted);
    });

    it('populates spacing defaults', () => {
      const result = compileDeckTheme();
      expect(result.spacing.slide).toBe(defaultDeckTheme.spacing.slide);
      expect(result.spacing.stack).toBe(defaultDeckTheme.spacing.stack);
    });
  });

  describe('SceneTheme derivation', () => {
    it('maps colorMode to sceneTheme.colorMode', () => {
      const result = compileDeckTheme({ colorMode: 'dark' });
      expect(result.sceneTheme.colorMode).toBe('dark');
    });

    it('maps accentColor to sceneTheme.accentColor', () => {
      const result = compileDeckTheme({ accentColor: '#ff0000' });
      expect(result.sceneTheme.accentColor).toBe('#ff0000');
    });

    it('maps fonts.heading to sceneTheme.font.htmlFamily', () => {
      const result = compileDeckTheme({ fonts: { heading: 'Inter, sans-serif' } });
      expect(result.sceneTheme.font.htmlFamily).toBe('Inter, sans-serif');
    });

    it('populates all required fontSize scale fields', () => {
      const result = compileDeckTheme();
      expect(result.sceneTheme.fontSize.heading).toBeGreaterThan(1);
      expect(result.sceneTheme.fontSize.body).toBe(1.0);
      expect(result.sceneTheme.fontSize.label).toBeGreaterThan(0);
      expect(result.sceneTheme.fontSize.caption).toBeGreaterThan(0);
      expect(result.sceneTheme.fontSize.annotation).toBeGreaterThan(0);
    });

    it('uses default font family when fonts.heading is not overridden', () => {
      const result = compileDeckTheme();
      expect(result.sceneTheme.font.htmlFamily).toBe(defaultDeckTheme.fonts.heading);
    });
  });

  describe('CSS variable map', () => {
    it('produces --slide-padding from spacing.slide', () => {
      const result = compileDeckTheme();
      expect(result.cssVars['--slide-padding']).toBe(defaultDeckTheme.spacing.slide);
    });

    it('produces --slide-gap from spacing.stack', () => {
      const result = compileDeckTheme();
      expect(result.cssVars['--slide-gap']).toBe(defaultDeckTheme.spacing.stack);
    });

    it('produces --slide-color-heading', () => {
      const result = compileDeckTheme({ colors: { heading: '#abc123', body: '#000', surface: '#fff', muted: '#999' } });
      expect(result.cssVars['--slide-color-heading']).toBe('#abc123');
    });

    it('produces --slide-color-body', () => {
      const result = compileDeckTheme();
      expect(result.cssVars['--slide-color-body']).toBe(defaultDeckTheme.colors.body);
    });

    it('produces --slide-color-surface', () => {
      const result = compileDeckTheme();
      expect(result.cssVars['--slide-color-surface']).toBe(defaultDeckTheme.colors.surface);
    });

    it('produces --slide-color-muted', () => {
      const result = compileDeckTheme();
      expect(result.cssVars['--slide-color-muted']).toBe(defaultDeckTheme.colors.muted);
    });

    it('produces --slide-border-radius from border.radius', () => {
      const result = compileDeckTheme({ border: { radius: '1rem' } });
      expect(result.cssVars['--slide-border-radius']).toBe('1rem');
    });

    it('uses fallback border radius when border is not provided', () => {
      const result = compileDeckTheme();
      expect(result.cssVars['--slide-border-radius']).toBeDefined();
    });

    it('does NOT include --slide-font-body when fonts.body is absent', () => {
      const result = compileDeckTheme();
      expect(result.cssVars['--slide-font-body']).toBeUndefined();
    });

    it('includes --slide-font-body when fonts.body is provided', () => {
      const result = compileDeckTheme({ fonts: { heading: 'Inter', body: 'Georgia, serif' } });
      expect(result.cssVars['--slide-font-body']).toBe('Georgia, serif');
    });

    it('does NOT include --slide-font-mono when fonts.mono is absent', () => {
      const result = compileDeckTheme();
      expect(result.cssVars['--slide-font-mono']).toBeUndefined();
    });

    it('includes --slide-font-mono when fonts.mono is provided', () => {
      const result = compileDeckTheme({ fonts: { heading: 'Inter', mono: 'JetBrains Mono' } });
      expect(result.cssVars['--slide-font-mono']).toBe('JetBrains Mono');
    });

    it('includes --slide-bg-gradient when background.gradient is provided', () => {
      const result = compileDeckTheme({ background: { color: '#000', gradient: 'linear-gradient(#000, #111)' } });
      expect(result.cssVars['--slide-bg-gradient']).toBe('linear-gradient(#000, #111)');
    });

    it('does NOT include --slide-bg-gradient when absent', () => {
      const result = compileDeckTheme();
      expect(result.cssVars['--slide-bg-gradient']).toBeUndefined();
    });
  });

  describe('deep merge', () => {
    it('merges partial colors, preserving unoverridden defaults', () => {
      const result = compileDeckTheme({
        colors: { heading: '#custom', body: '#b', surface: '#s', muted: '#m' },
      });
      expect(result.colors.heading).toBe('#custom');
      // other fields come from defaults
      expect(result.colors.body).toBe('#b');
    });

    it('merges partial fonts, preserving defaults', () => {
      const result = compileDeckTheme({ fonts: { heading: 'Custom Font' } });
      expect(result.fonts.heading).toBe('Custom Font');
      // body/mono remain undefined (not in defaults either)
      expect(result.fonts.body).toBeUndefined();
    });

    it('overriding colorMode to dark gives dark sceneTheme', () => {
      const result = compileDeckTheme({ colorMode: 'dark' });
      expect(result.sceneTheme.colorMode).toBe('dark');
      expect(result.colorMode).toBe('dark');
    });
  });
});
