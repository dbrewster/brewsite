// Compile-time type tests for @brewsite/slides type contracts.
// These tests confirm all interfaces are correctly shaped by using them with real
// TypeScript values — if types are wrong, the file fails to compile.

import { describe, it, expect } from 'vitest';
import type {
  SlideLayout,
  SlideTransition,
  SlideTheme,
  SlideTemplate,
  BrandAsset,
  ResolvedSlideConfig,
  EntranceType,
  SlideRegionEntrance,
  ComparisonCellValue,
  SlideRegion,
  SlideSpec,
  DeckSpec,
  SlidePlayerHandle,
  PrintOptions,
  SlideNavigationConfig,
  ProgressStyle,
} from '../types';

describe('SlideLayout', () => {
  it('accepts all 19 valid variants', () => {
    const layouts: SlideLayout[] = [
      'title', 'section', 'content', 'two-column', 'image', 'full-bleed', 'blank',
      'big-number', 'metric-grid', 'comparison', 'quote', 'agenda',
      'timeline', 'process', 'team', 'closing', 'bento', 'dashboard', 'matrix',
    ];
    expect(layouts).toHaveLength(19);
  });
});

describe('SlideTransition', () => {
  it('accepts all 9 valid variants', () => {
    const transitions: SlideTransition[] = [
      'dissolve', 'cut', 'fade', 'push-left', 'push-right',
      'push-up', 'push-down', 'zoom-in', 'zoom-out',
    ];
    expect(transitions).toHaveLength(9);
  });
});

describe('EntranceType', () => {
  it('accepts all 7 valid variants', () => {
    const entrances: EntranceType[] = [
      'fadeIn', 'slideUp', 'slideDown', 'slideLeft', 'slideRight', 'grow', 'none',
    ];
    expect(entrances).toHaveLength(7);
  });
});

describe('SlideRegionEntrance', () => {
  it('accepts empty object', () => {
    const entrance: SlideRegionEntrance = {};
    expect(entrance.stagger).toBeUndefined();
  });

  it('accepts fully specified config', () => {
    const entrance: SlideRegionEntrance = {
      title: 'fadeIn',
      body: 'slideUp',
      left: 'slideLeft',
      right: 'slideRight',
      stagger: 0.1,
    };
    expect(entrance.stagger).toBe(0.1);
  });
});

describe('ProgressStyle', () => {
  it('accepts all valid variants', () => {
    const styles: ProgressStyle[] = ['dots', 'bar', 'numbers', 'none'];
    expect(styles).toHaveLength(4);
  });
});

describe('SlideTheme', () => {
  it('accepts a fully specified theme', () => {
    const theme: SlideTheme = {
      timing: {
        transitionDuration: '300ms',
        entranceDuration: 0.3,
        entranceDistance: '24px',
        staggerDelay: 0.08,
        countUpDuration: 0.6,
      },
      density: {
        contentPadding: '48px',
        contentGap: '16px',
        titleHeight: 0.18,
        gutter: 0.02,
      },
      typography: {
        headingScale: 1.2,
        bodyScale: 1.1,
        captionScale: 1.0,
      },
      components: {
        cardBorderWidth: '1px',
        timelineConnectorWidth: '2px',
        timelineDotSize: '12px',
        progressRingSize: '64px',
        progressRingThickness: '4px',
      },
    };
    expect(theme.timing.transitionDuration).toBe('300ms');
  });
});

describe('SlideTemplate', () => {
  it('accepts a fully specified template', () => {
    const template: SlideTemplate = {
      name: 'Corporate',
      brand: {
        logo: { src: '/logo.svg', alt: 'Logo' },
        wordmark: { src: '/wordmark.svg' },
        icon: { src: '/icon.svg', aspectRatio: '1/1' },
      },
      master: {
        logo: { asset: 'logo', position: 'top-left', size: '40px', opacity: 0.8 },
        footer: { text: '© 2026', showPageNumbers: true, position: 'bottom-right' },
        watermark: { text: 'Draft', opacity: 0.1 },
      },
      defaultTransition: 'dissolve',
      defaultProgressIndicator: 'dots',
    };
    expect(template.name).toBe('Corporate');
  });

  it('accepts a minimal template', () => {
    const template: SlideTemplate = { name: 'Minimal' };
    expect(template.name).toBe('Minimal');
  });
});

describe('BrandAsset', () => {
  it('accepts required and optional fields', () => {
    const asset: BrandAsset = { src: '/logo.svg', alt: 'Logo', aspectRatio: '16/9' };
    expect(asset.src).toBe('/logo.svg');
  });
});

describe('ResolvedSlideConfig', () => {
  it('has slideTheme and cssVars', () => {
    const config: ResolvedSlideConfig = {
      slideTheme: {
        timing: {
          transitionDuration: '300ms',
          entranceDuration: 0.3,
          entranceDistance: '24px',
          staggerDelay: 0.08,
          countUpDuration: 0.6,
        },
        density: { contentPadding: '48px', contentGap: '16px', titleHeight: 0.18, gutter: 0.02 },
        typography: { headingScale: 1.2, bodyScale: 1.1, captionScale: 1.0 },
        components: {
          cardBorderWidth: '1px',
          timelineConnectorWidth: '2px',
          timelineDotSize: '12px',
          progressRingSize: '64px',
          progressRingThickness: '4px',
        },
      },
      cssVars: { '--slide-content-padding': '48px' },
    };
    expect(config.cssVars['--slide-content-padding']).toBe('48px');
  });
});

describe('ComparisonCellValue', () => {
  it('accepts check variant', () => {
    const cell: ComparisonCellValue = { kind: 'check', value: true };
    expect(cell.kind).toBe('check');
  });

  it('accepts text variant', () => {
    const cell: ComparisonCellValue = { kind: 'text', value: 'Yes' };
    expect(cell.kind).toBe('text');
  });

  it('accepts number variant', () => {
    const cell: ComparisonCellValue = { kind: 'number', value: 42 };
    expect(cell.kind).toBe('number');
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
  });
});

describe('SlideSpec', () => {
  it('has all required fields', () => {
    const spec: SlideSpec = {
      key: 'intro',
      layout: 'content',
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
      transition: 'cut',
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

describe('DeckSpec', () => {
  it('has slides and transition but no theme', () => {
    const deck: DeckSpec = {
      slides: [],
      transition: 'dissolve',
    };
    expect(deck.slides).toHaveLength(0);
    expect(deck.transition).toBe('dissolve');
    expect('theme' in deck).toBe(false);
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
    expect(typeof handle.captureSlideSnapshots).toBe('function');
  });
});
