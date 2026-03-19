// Compile-time type tests for @brewsite/slides type contracts.
// These tests confirm all interfaces are correctly shaped by using them with real
// TypeScript values — if types are wrong, the file fails to compile.

import { describe, it, expect } from 'vitest';
import type {
  SlideLayout,
  SlideTransition,
  DeckTheme,
  ResolvedDeckTheme,
  SlideRegion,
  SlideSpec,
  DeckSpec,
  SlidePlayerHandle,
  PrintOptions,
  SlideNavigationConfig,
  ProgressStyle,
} from '../types';

describe('SlideLayout', () => {
  it('accepts all valid variants', () => {
    const layouts: SlideLayout[] = ['title', 'title-body', 'two-column', 'full-bleed', 'blank'];
    expect(layouts).toHaveLength(5);
  });
});

describe('SlideTransition', () => {
  it('accepts all valid variants', () => {
    const transitions: SlideTransition[] = ['dissolve', 'none'];
    expect(transitions).toHaveLength(2);
  });
});

describe('ProgressStyle', () => {
  it('accepts all valid variants', () => {
    const styles: ProgressStyle[] = ['dots', 'bar', 'numbers', 'none'];
    expect(styles).toHaveLength(4);
  });
});

describe('DeckTheme', () => {
  it('accepts a fully specified theme', () => {
    const theme: DeckTheme = {
      fonts: { heading: 'Inter, sans-serif', body: 'Georgia', mono: 'Menlo' },
      colorMode: 'dark',
      accentColor: '#6b48ff',
      background: { color: '#0a0a14', gradient: 'linear-gradient(180deg, #000, #111)' },
      colors: {
        heading: '#ffffff',
        body: '#cccccc',
        surface: '#1a1a2e',
        muted: '#888888',
      },
      spacing: { slide: '10%', stack: '2rem' },
      border: { radius: '0.75rem' },
    };
    expect(theme.colorMode).toBe('dark');
    expect(theme.fonts.heading).toBe('Inter, sans-serif');
  });

  it('accepts a minimal theme (no optional fields)', () => {
    const theme: DeckTheme = {
      fonts: { heading: 'system-ui' },
      colorMode: 'light',
      background: { color: '#ffffff' },
      colors: {
        heading: '#000000',
        body: '#333333',
        surface: '#f0f0f0',
        muted: '#999999',
      },
      spacing: { slide: '8%', stack: '1.5rem' },
    };
    expect(theme.colorMode).toBe('light');
    expect(theme.fonts.body).toBeUndefined();
    expect(theme.border).toBeUndefined();
    expect(theme.accentColor).toBeUndefined();
  });
});

describe('SlideRegion', () => {
  it('has all required fields with correct types', () => {
    const region: SlideRegion = {
      id: 'title',
      x: 0,
      y: 0,
      w: 1,
      h: 0.2,
      layer: 1,
    };
    expect(region.id).toBe('title');
    expect(typeof region.x).toBe('number');
    expect(typeof region.y).toBe('number');
    expect(typeof region.w).toBe('number');
    expect(typeof region.h).toBe('number');
    expect(typeof region.layer).toBe('number');
  });
});

describe('SlideSpec', () => {
  it('has all required fields', () => {
    const spec: SlideSpec = {
      key: 'intro',
      layout: 'title-body',
      transition: 'dissolve',
      notes: 'Talk about the problem',
      scrollUnits: 400,
      regions: [{ id: 'title', x: 0, y: 0, w: 1, h: 0.18, layer: 1 }],
      title: 'Introduction',
      hasAnimatedList: false,
      totalBullets: 0,
    };
    expect(spec.key).toBe('intro');
    expect(spec.hasAnimatedList).toBe(false);
  });

  it('allows undefined notes and title', () => {
    const spec: SlideSpec = {
      key: 'blank',
      layout: 'blank',
      transition: 'none',
      notes: undefined,
      scrollUnits: 100,
      regions: [],
      title: undefined,
      hasAnimatedList: false,
      totalBullets: 0,
    };
    expect(spec.notes).toBeUndefined();
    expect(spec.title).toBeUndefined();
  });
});

describe('PrintOptions', () => {
  it('accepts all page size variants', () => {
    const opt1: PrintOptions = { pageSize: 'letter', includeNotes: false };
    const opt2: PrintOptions = { pageSize: 'a4', includeNotes: true };
    const opt3: PrintOptions = { pageSize: '16x9', includeNotes: false };
    expect(opt1.pageSize).toBe('letter');
    expect(opt2.includeNotes).toBe(true);
    expect(opt3.pageSize).toBe('16x9');
  });
});

describe('SlideNavigationConfig', () => {
  it('accepts empty object (all optional)', () => {
    const config: SlideNavigationConfig = {};
    expect(config.keyboard).toBeUndefined();
  });

  it('accepts fully specified config', () => {
    const config: SlideNavigationConfig = {
      keyboard: true,
      pointer: false,
      touch: true,
      wheel: false,
      scope: 'canvas',
    };
    expect(config.scope).toBe('canvas');
    expect(config.wheel).toBe(false);
  });
});

describe('SlidePlayerHandle interface shape', () => {
  it('can be implemented as a conforming object', () => {
    const handle: SlidePlayerHandle = {
      goTo: (_index: number) => undefined,
      next: () => undefined,
      prev: () => undefined,
      captureSlideSnapshots: (): Promise<Map<string, string>> => Promise.resolve(new Map()),
    };
    expect(typeof handle.goTo).toBe('function');
    expect(typeof handle.next).toBe('function');
    expect(typeof handle.prev).toBe('function');
    expect(typeof handle.captureSlideSnapshots).toBe('function');
  });
});

describe('ResolvedDeckTheme', () => {
  it('extends DeckTheme with sceneTheme and cssVars', () => {
    // Construct a minimal ResolvedDeckTheme — if type is wrong, this won't compile
    const resolved: ResolvedDeckTheme = {
      fonts: { heading: 'Inter', body: 'Georgia', mono: 'Menlo' },
      colorMode: 'light',
      accentColor: '#000000',
      background: { color: '#fff', gradient: undefined },
      colors: { heading: '#000', body: '#333', surface: '#f0f0f0', muted: '#999' },
      spacing: { slide: '8%', stack: '1.5rem' },
      border: { radius: '0.5rem' },
      sceneTheme: {
        colorMode: 'light',
        font: { htmlFamily: 'Inter' },
        fontSize: {
          heading: 2.4,
          body: 1.0,
          label: 1.0,
          caption: 1.0,
          annotation: 0.7,
        },
      },
      cssVars: { '--slide-padding': '8%' },
    };
    expect(resolved.sceneTheme.colorMode).toBe('light');
    expect(resolved.cssVars['--slide-padding']).toBe('8%');
  });
});
