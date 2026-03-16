// Tests for themeResolve.ts — pure theme resolution with real inputs.

import { describe, it, expect } from 'vitest';
import { resolveThemedStyle, resolveThemedDepthAndGap } from '../themeResolve';
import { DEFAULT_CAROUSEL_SCRUBBER_STYLE } from '../compile';
import type { CarouselScrubberStyle } from '../types';
import type { SceneTheme } from '../../../theme/types';

/** Minimal SceneTheme with no carouselTray tokens. */
const bareTheme: SceneTheme = {
  colorMode: 'dark',
  font: { htmlFamily: 'Inter', webglUrl: '/fonts/Inter.woff' },
  fontSize: { heading: 1.5, body: 1.0, detail: 0.85 },
};

/** SceneTheme with full carouselTray tokens. */
const fullTheme: SceneTheme = {
  ...bareTheme,
  carouselTray: {
    color: '#ff0000',
    opacity: 0.9,
    accentColor: '#00ff00',
    metalness: 0.8,
    roughness: 0.2,
    edgeStyle: 'ridged',
    surfacePattern: 'crosshatch',
    surfaceIntensity: 0.5,
    surfaceMapUrl: '/theme-normal.png',
    depth: 0.5,
    gap: 0.05,
  },
};

// -- resolveThemedStyle -------------------------------------------------------

describe('resolveThemedStyle', () => {
  it('returns compiled style unchanged when theme is null', () => {
    const style = { ...DEFAULT_CAROUSEL_SCRUBBER_STYLE };
    const result = resolveThemedStyle(style, null);
    expect(result).toEqual(style);
  });

  it('returns compiled style unchanged when theme is undefined', () => {
    const style = { ...DEFAULT_CAROUSEL_SCRUBBER_STYLE };
    const result = resolveThemedStyle(style, undefined);
    expect(result).toEqual(style);
  });

  it('returns compiled style unchanged when theme has no carouselTray', () => {
    const style = { ...DEFAULT_CAROUSEL_SCRUBBER_STYLE };
    const result = resolveThemedStyle(style, bareTheme);
    expect(result).toEqual(style);
  });

  it('replaces default baseColor with theme color', () => {
    const style = { ...DEFAULT_CAROUSEL_SCRUBBER_STYLE };
    const result = resolveThemedStyle(style, fullTheme);
    expect(result.baseColor).toBe('#ff0000');
  });

  it('replaces default baseOpacity with theme opacity', () => {
    const style = { ...DEFAULT_CAROUSEL_SCRUBBER_STYLE };
    const result = resolveThemedStyle(style, fullTheme);
    expect(result.baseOpacity).toBe(0.9);
  });

  it('replaces default accentColor with theme accentColor', () => {
    const style = { ...DEFAULT_CAROUSEL_SCRUBBER_STYLE };
    const result = resolveThemedStyle(style, fullTheme);
    expect(result.accentColor).toBe('#00ff00');
  });

  it('replaces default metalness with theme metalness', () => {
    const style = { ...DEFAULT_CAROUSEL_SCRUBBER_STYLE };
    const result = resolveThemedStyle(style, fullTheme);
    expect(result.metalness).toBe(0.8);
  });

  it('replaces default roughness with theme roughness', () => {
    const style = { ...DEFAULT_CAROUSEL_SCRUBBER_STYLE };
    const result = resolveThemedStyle(style, fullTheme);
    expect(result.roughness).toBe(0.2);
  });

  it('replaces default edgeStyle with theme edgeStyle', () => {
    const style = { ...DEFAULT_CAROUSEL_SCRUBBER_STYLE };
    const result = resolveThemedStyle(style, fullTheme);
    expect(result.edgeStyle).toBe('ridged');
  });

  it('replaces default surfacePattern with theme surfacePattern', () => {
    const style = { ...DEFAULT_CAROUSEL_SCRUBBER_STYLE };
    const result = resolveThemedStyle(style, fullTheme);
    expect(result.surfacePattern).toBe('crosshatch');
  });

  it('replaces default surfaceIntensity with theme surfaceIntensity', () => {
    const style = { ...DEFAULT_CAROUSEL_SCRUBBER_STYLE };
    const result = resolveThemedStyle(style, fullTheme);
    expect(result.surfaceIntensity).toBe(0.5);
  });

  it('replaces default surfaceMapUrl with theme surfaceMapUrl', () => {
    const style = { ...DEFAULT_CAROUSEL_SCRUBBER_STYLE };
    const result = resolveThemedStyle(style, fullTheme);
    expect(result.surfaceMapUrl).toBe('/theme-normal.png');
  });

  it('DSL-explicit baseColor overrides theme', () => {
    const style: CarouselScrubberStyle = {
      ...DEFAULT_CAROUSEL_SCRUBBER_STYLE,
      baseColor: '#0000ff',
    };
    const result = resolveThemedStyle(style, fullTheme);
    expect(result.baseColor).toBe('#0000ff');
  });

  it('DSL-explicit metalness overrides theme', () => {
    const style: CarouselScrubberStyle = {
      ...DEFAULT_CAROUSEL_SCRUBBER_STYLE,
      metalness: 0.1,
    };
    const result = resolveThemedStyle(style, fullTheme);
    expect(result.metalness).toBe(0.1);
  });

  it('DSL-explicit edgeStyle overrides theme', () => {
    const style: CarouselScrubberStyle = {
      ...DEFAULT_CAROUSEL_SCRUBBER_STYLE,
      edgeStyle: 'smooth',
    };
    const result = resolveThemedStyle(style, fullTheme);
    expect(result.edgeStyle).toBe('smooth');
  });

  it('DSL-explicit surfacePattern overrides theme', () => {
    const style: CarouselScrubberStyle = {
      ...DEFAULT_CAROUSEL_SCRUBBER_STYLE,
      surfacePattern: 'grain',
    };
    const result = resolveThemedStyle(style, fullTheme);
    expect(result.surfacePattern).toBe('grain');
  });

  it('DSL-explicit surfaceIntensity overrides theme', () => {
    const style: CarouselScrubberStyle = {
      ...DEFAULT_CAROUSEL_SCRUBBER_STYLE,
      surfaceIntensity: 0.9,
    };
    const result = resolveThemedStyle(style, fullTheme);
    expect(result.surfaceIntensity).toBe(0.9);
  });

  it('DSL-explicit surfaceMapUrl overrides theme', () => {
    const style: CarouselScrubberStyle = {
      ...DEFAULT_CAROUSEL_SCRUBBER_STYLE,
      surfaceMapUrl: '/dsl-map.png',
    };
    const result = resolveThemedStyle(style, fullTheme);
    expect(result.surfaceMapUrl).toBe('/dsl-map.png');
  });

  it('partial theme tokens fill only their matching defaults', () => {
    const partialTheme: SceneTheme = {
      ...bareTheme,
      carouselTray: {
        color: '#aabbcc',
        metalness: 0.6,
      },
    };
    const style = { ...DEFAULT_CAROUSEL_SCRUBBER_STYLE };
    const result = resolveThemedStyle(style, partialTheme);

    expect(result.baseColor).toBe('#aabbcc');
    expect(result.metalness).toBe(0.6);
    // Non-specified theme fields remain at compiled defaults
    expect(result.baseOpacity).toBe(DEFAULT_CAROUSEL_SCRUBBER_STYLE.baseOpacity);
    expect(result.roughness).toBe(DEFAULT_CAROUSEL_SCRUBBER_STYLE.roughness);
    expect(result.edgeStyle).toBe(DEFAULT_CAROUSEL_SCRUBBER_STYLE.edgeStyle);
    expect(result.surfacePattern).toBe(DEFAULT_CAROUSEL_SCRUBBER_STYLE.surfacePattern);
  });
});

// -- resolveThemedDepthAndGap -------------------------------------------------

describe('resolveThemedDepthAndGap', () => {
  it('returns compiled values unchanged when theme is null', () => {
    const result = resolveThemedDepthAndGap(0.36, 0.02, null);
    expect(result).toEqual({ depth: 0.36, gap: 0.02 });
  });

  it('returns compiled values unchanged when theme is undefined', () => {
    const result = resolveThemedDepthAndGap(0.36, 0.02, undefined);
    expect(result).toEqual({ depth: 0.36, gap: 0.02 });
  });

  it('returns compiled values when theme has no carouselTray', () => {
    const result = resolveThemedDepthAndGap(0.36, 0.02, bareTheme);
    expect(result).toEqual({ depth: 0.36, gap: 0.02 });
  });

  it('replaces default depth with theme depth', () => {
    const result = resolveThemedDepthAndGap(0.36, 0.02, fullTheme);
    expect(result.depth).toBe(0.5);
  });

  it('replaces default gap with theme gap', () => {
    const result = resolveThemedDepthAndGap(0.36, 0.02, fullTheme);
    expect(result.gap).toBe(0.05);
  });

  it('DSL-explicit depth overrides theme', () => {
    const result = resolveThemedDepthAndGap(0.8, 0.02, fullTheme);
    expect(result.depth).toBe(0.8);
  });

  it('DSL-explicit gap overrides theme', () => {
    const result = resolveThemedDepthAndGap(0.36, 0.1, fullTheme);
    expect(result.gap).toBe(0.1);
  });

  it('both DSL-explicit values override theme', () => {
    const result = resolveThemedDepthAndGap(0.8, 0.1, fullTheme);
    expect(result).toEqual({ depth: 0.8, gap: 0.1 });
  });
});
