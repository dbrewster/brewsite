// Tests for resolveSlideConfig() — merge with defaults, CSS variable output.

import { describe, it, expect } from 'vitest';
import { resolveSlideConfig } from '../themeCompiler';
import {
  defaultSlideTheme,
  compactSlideTheme,
  cinematicSlideTheme,
  minimalSlideTheme,
} from '../../theme';

describe('resolveSlideConfig', () => {
  describe('defaults', () => {
    it('uses defaultSlideTheme values when no argument is provided', () => {
      const result = resolveSlideConfig();
      expect(result.slideTheme.timing.transitionDuration).toBe('300ms');
      expect(result.slideTheme.density.contentPadding).toBe('48px');
      expect(result.slideTheme.typography.headingScale).toBe(1.2);
      expect(result.slideTheme.components.cardBorderWidth).toBe('1px');
    });

    it('fills all timing fields from defaults', () => {
      const result = resolveSlideConfig();
      expect(result.slideTheme.timing).toEqual(defaultSlideTheme.timing);
    });

    it('fills all density fields from defaults', () => {
      const result = resolveSlideConfig();
      expect(result.slideTheme.density).toEqual(defaultSlideTheme.density);
    });

    it('fills all typography fields from defaults', () => {
      const result = resolveSlideConfig();
      expect(result.slideTheme.typography).toEqual(defaultSlideTheme.typography);
    });

    it('fills all component fields from defaults', () => {
      const result = resolveSlideConfig();
      expect(result.slideTheme.components).toEqual(defaultSlideTheme.components);
    });
  });

  describe('partial overrides', () => {
    it('merges partial timing overrides, preserving defaults', () => {
      const result = resolveSlideConfig({
        timing: { transitionDuration: '500ms' },
      } as Partial<import('../../types').SlideTheme>);
      expect(result.slideTheme.timing.transitionDuration).toBe('500ms');
      expect(result.slideTheme.timing.entranceDuration).toBe(0.3);
    });

    it('merges partial density overrides', () => {
      const result = resolveSlideConfig({
        density: { contentPadding: '32px' },
      } as Partial<import('../../types').SlideTheme>);
      expect(result.slideTheme.density.contentPadding).toBe('32px');
      expect(result.slideTheme.density.contentGap).toBe('16px');
    });

    it('merges partial typography overrides', () => {
      const result = resolveSlideConfig({
        typography: { headingScale: 1.5 },
      } as Partial<import('../../types').SlideTheme>);
      expect(result.slideTheme.typography.headingScale).toBe(1.5);
      expect(result.slideTheme.typography.bodyScale).toBe(1.1);
    });
  });

  describe('CSS variable output', () => {
    it('produces --slide-transition-duration from timing', () => {
      const result = resolveSlideConfig();
      expect(result.cssVars['--slide-transition-duration']).toBe('300ms');
    });

    it('produces --slide-entrance-duration as string', () => {
      const result = resolveSlideConfig();
      expect(result.cssVars['--slide-entrance-duration']).toBe('0.3');
    });

    it('produces --slide-entrance-distance', () => {
      const result = resolveSlideConfig();
      expect(result.cssVars['--slide-entrance-distance']).toBe('24px');
    });

    it('produces --slide-stagger-delay', () => {
      const result = resolveSlideConfig();
      expect(result.cssVars['--slide-stagger-delay']).toBe('0.08');
    });

    it('produces --slide-count-up-duration', () => {
      const result = resolveSlideConfig();
      expect(result.cssVars['--slide-count-up-duration']).toBe('0.6');
    });

    it('produces --slide-content-padding from density', () => {
      const result = resolveSlideConfig();
      expect(result.cssVars['--slide-content-padding']).toBe('48px');
    });

    it('produces --slide-content-gap', () => {
      const result = resolveSlideConfig();
      expect(result.cssVars['--slide-content-gap']).toBe('16px');
    });

    it('produces --slide-title-height as string', () => {
      const result = resolveSlideConfig();
      expect(result.cssVars['--slide-title-height']).toBe('0.18');
    });

    it('produces --slide-gutter', () => {
      const result = resolveSlideConfig();
      expect(result.cssVars['--slide-gutter']).toBe('0.02');
    });

    it('produces --slide-heading-scale', () => {
      const result = resolveSlideConfig();
      expect(result.cssVars['--slide-heading-scale']).toBe('1.2');
    });

    it('produces --slide-body-scale', () => {
      const result = resolveSlideConfig();
      expect(result.cssVars['--slide-body-scale']).toBe('1.1');
    });

    it('produces --slide-caption-scale', () => {
      const result = resolveSlideConfig();
      expect(result.cssVars['--slide-caption-scale']).toBe('1');
    });

    it('produces --slide-card-border-width', () => {
      const result = resolveSlideConfig();
      expect(result.cssVars['--slide-card-border-width']).toBe('1px');
    });

    it('produces --slide-timeline-connector-width', () => {
      const result = resolveSlideConfig();
      expect(result.cssVars['--slide-timeline-connector-width']).toBe('2px');
    });

    it('produces --slide-timeline-dot-size', () => {
      const result = resolveSlideConfig();
      expect(result.cssVars['--slide-timeline-dot-size']).toBe('12px');
    });

    it('produces --slide-progress-ring-size', () => {
      const result = resolveSlideConfig();
      expect(result.cssVars['--slide-progress-ring-size']).toBe('64px');
    });

    it('produces --slide-progress-ring-thickness', () => {
      const result = resolveSlideConfig();
      expect(result.cssVars['--slide-progress-ring-thickness']).toBe('4px');
    });
  });

  describe('named presets resolve correctly', () => {
    it('compact preset resolves with its values', () => {
      const result = resolveSlideConfig(compactSlideTheme);
      expect(result.slideTheme.timing.transitionDuration).toBe('200ms');
      expect(result.slideTheme.density.contentPadding).toBe('32px');
      expect(result.cssVars['--slide-transition-duration']).toBe('200ms');
    });

    it('cinematic preset resolves with its values', () => {
      const result = resolveSlideConfig(cinematicSlideTheme);
      expect(result.slideTheme.timing.transitionDuration).toBe('500ms');
      expect(result.slideTheme.density.contentPadding).toBe('64px');
      expect(result.cssVars['--slide-transition-duration']).toBe('500ms');
    });

    it('minimal preset resolves with its values', () => {
      const result = resolveSlideConfig(minimalSlideTheme);
      expect(result.slideTheme.timing.transitionDuration).toBe('250ms');
      expect(result.slideTheme.timing.staggerDelay).toBe(0);
      expect(result.cssVars['--slide-stagger-delay']).toBe('0');
    });

    it('default preset resolves with default values', () => {
      const result = resolveSlideConfig(defaultSlideTheme);
      expect(result.slideTheme).toEqual(defaultSlideTheme);
    });
  });
});
