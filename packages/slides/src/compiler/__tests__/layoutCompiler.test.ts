// Tests for compileLayout() — one test per layout variant.

import { describe, it, expect } from 'vitest';
import { compileLayout } from '../layoutCompiler';
import type { SceneLength } from '@brewsite/core';

/** Mirror the production pct() helper so assertions match exactly. */
function pct(value: number): SceneLength {
  if (value === 0) return 0;
  return `${value * 100}%` as SceneLength;
}

/** Parse a SceneLength back to an NVS fraction for numeric comparisons. */
function nvs(v: SceneLength): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'string' && v.endsWith('%')) return parseFloat(v) / 100;
  return Number(v);
}

describe('compileLayout', () => {
  // ─── title ──────────────────────────────────────────────────────────────────

  describe('title layout', () => {
    it('returns a single full-viewport region', () => {
      const regions = compileLayout({ layout: 'title', hasTitle: true });
      expect(regions).toHaveLength(1);
      expect(regions[0]).toMatchObject({ id: 'title', x: 0, y: 0, w: pct(1), h: pct(1), layer: 1 });
    });

    it('returns same result when hasTitle is false', () => {
      const regions = compileLayout({ layout: 'title', hasTitle: false });
      expect(regions).toHaveLength(1);
      expect(regions[0]!.id).toBe('title');
    });
  });

  // ─── section ────────────────────────────────────────────────────────────────

  describe('section layout', () => {
    it('returns a single full-viewport region', () => {
      const regions = compileLayout({ layout: 'section', hasTitle: true });
      expect(regions).toHaveLength(1);
      expect(regions[0]).toMatchObject({ id: 'title', x: 0, y: 0, w: pct(1), h: pct(1), layer: 1 });
    });
  });

  // ─── content ────────────────────────────────────────────────────────────────

  describe('content layout', () => {
    it('returns two regions: title and body', () => {
      const regions = compileLayout({ layout: 'content', hasTitle: true });
      expect(regions).toHaveLength(2);
      expect(regions.find((r) => r.id === 'title')).toBeDefined();
      expect(regions.find((r) => r.id === 'body')).toBeDefined();
    });

    it('title region spans full width at correct NVS position', () => {
      const regions = compileLayout({ layout: 'content', hasTitle: true });
      const title = regions.find((r) => r.id === 'title')!;
      expect(title.x).toBe(0);
      expect(title.w).toBe(pct(1));
      expect(title.y).toBe(pct(0.02));
      expect(title.h).toBe(pct(0.18 - 0.02));
      expect(title.layer).toBe(1);
    });

    it('body is positioned below the title with gutter', () => {
      const regions = compileLayout({ layout: 'content', hasTitle: true });
      const title = regions.find((r) => r.id === 'title')!;
      const body = regions.find((r) => r.id === 'body')!;
      expect(nvs(body.y)).toBeCloseTo(0.20); // titleH + gutter = 0.18 + 0.02
      expect(nvs(body.y)).toBeGreaterThan(nvs(title.y) + nvs(title.h));
      expect(body.w).toBe(pct(1));
      expect(body.layer).toBe(0);
    });

    it('body fills remaining space minus bottom gutter', () => {
      const regions = compileLayout({ layout: 'content', hasTitle: true });
      const body = regions.find((r) => r.id === 'body')!;
      // bodyH = 1 - 0.20 - 0.02 = 0.78
      expect(nvs(body.h)).toBeCloseTo(0.78);
    });
  });

  // ─── two-column ─────────────────────────────────────────────────────────────

  describe('two-column layout with title', () => {
    it('returns three regions: title, left, right', () => {
      const regions = compileLayout({ layout: 'two-column', hasTitle: true });
      expect(regions).toHaveLength(3);
      expect(regions.find((r) => r.id === 'title')).toBeDefined();
      expect(regions.find((r) => r.id === 'left')).toBeDefined();
      expect(regions.find((r) => r.id === 'right')).toBeDefined();
    });

    it('title spans full width', () => {
      const regions = compileLayout({ layout: 'two-column', hasTitle: true });
      const title = regions.find((r) => r.id === 'title')!;
      expect(title.w).toBe(pct(1));
    });

    it('left and right columns have equal width', () => {
      const regions = compileLayout({ layout: 'two-column', hasTitle: true });
      const left = regions.find((r) => r.id === 'left')!;
      const right = regions.find((r) => r.id === 'right')!;
      expect(nvs(left.w)).toBeCloseTo(nvs(right.w));
    });

    it('right column starts after left column with a gap', () => {
      const regions = compileLayout({ layout: 'two-column', hasTitle: true });
      const left = regions.find((r) => r.id === 'left')!;
      const right = regions.find((r) => r.id === 'right')!;
      expect(nvs(right.x)).toBeGreaterThan(nvs(left.x) + nvs(left.w));
    });

    it('uses double gutter for column gap', () => {
      const regions = compileLayout({ layout: 'two-column', hasTitle: true });
      const left = regions.find((r) => r.id === 'left')!;
      const right = regions.find((r) => r.id === 'right')!;
      const gap = nvs(right.x) - (nvs(left.x) + nvs(left.w));
      expect(gap).toBeCloseTo(0.04); // gutter * 2
    });

    it('columns are below the title', () => {
      const regions = compileLayout({ layout: 'two-column', hasTitle: true });
      const title = regions.find((r) => r.id === 'title')!;
      const left = regions.find((r) => r.id === 'left')!;
      expect(nvs(left.y)).toBeGreaterThan(nvs(title.y) + nvs(title.h));
    });
  });

  describe('two-column layout without title', () => {
    it('returns two regions: left and right only', () => {
      const regions = compileLayout({ layout: 'two-column', hasTitle: false });
      expect(regions).toHaveLength(2);
      expect(regions.find((r) => r.id === 'title')).toBeUndefined();
      expect(regions.find((r) => r.id === 'left')).toBeDefined();
      expect(regions.find((r) => r.id === 'right')).toBeDefined();
    });

    it('columns start higher than when there is a title', () => {
      const withTitle = compileLayout({ layout: 'two-column', hasTitle: true });
      const withoutTitle = compileLayout({ layout: 'two-column', hasTitle: false });
      const leftWithTitle = withTitle.find((r) => r.id === 'left')!;
      const leftNoTitle = withoutTitle.find((r) => r.id === 'left')!;
      expect(nvs(leftNoTitle.y)).toBeLessThan(nvs(leftWithTitle.y));
    });
  });

  // ─── image ──────────────────────────────────────────────────────────────────

  describe('image layout', () => {
    it('returns two regions: image and body', () => {
      const regions = compileLayout({ layout: 'image', hasTitle: false });
      expect(regions).toHaveLength(2);
      expect(regions.find((r) => r.id === 'image')).toBeDefined();
      expect(regions.find((r) => r.id === 'body')).toBeDefined();
    });

    it('image region is 55% wide by default', () => {
      const regions = compileLayout({ layout: 'image', hasTitle: false });
      const image = regions.find((r) => r.id === 'image')!;
      expect(nvs(image.w)).toBeCloseTo(0.55);
      expect(image.h).toBe(pct(1));
    });

    it('defaults to image on the left', () => {
      const regions = compileLayout({ layout: 'image', hasTitle: false });
      const image = regions.find((r) => r.id === 'image')!;
      const body = regions.find((r) => r.id === 'body')!;
      expect(image.x).toBe(0);
      expect(nvs(body.x)).toBeCloseTo(0.55 + 0.02); // imgW + gutter
    });

    it('places image on the right when imagePosition is right', () => {
      const regions = compileLayout({ layout: 'image', hasTitle: false, imagePosition: 'right' });
      const image = regions.find((r) => r.id === 'image')!;
      const body = regions.find((r) => r.id === 'body')!;
      expect(body.x).toBe(0);
      expect(nvs(image.x)).toBeGreaterThan(nvs(body.x) + nvs(body.w));
    });

    it('body text region accounts for gutter padding', () => {
      const regions = compileLayout({ layout: 'image', hasTitle: false });
      const body = regions.find((r) => r.id === 'body')!;
      expect(nvs(body.y)).toBeCloseTo(0.02);
      expect(nvs(body.h)).toBeCloseTo(0.96); // 1 - gutter * 2
    });
  });

  // ─── full-bleed ─────────────────────────────────────────────────────────────

  describe('full-bleed layout', () => {
    it('returns one overlay region', () => {
      const regions = compileLayout({ layout: 'full-bleed', hasTitle: false });
      expect(regions).toHaveLength(1);
      expect(regions[0]!.id).toBe('overlay');
    });

    it('defaults to bottom-left when overlayPosition is not specified', () => {
      const regions = compileLayout({ layout: 'full-bleed', hasTitle: false });
      const overlay = regions[0]!;
      expect(nvs(overlay.x)).toBeCloseTo(0.04);
      expect(nvs(overlay.y)).toBeGreaterThan(0.5);
    });

    it('positions overlay at top-left when specified', () => {
      const regions = compileLayout({ layout: 'full-bleed', hasTitle: false, overlayPosition: 'top-left' });
      const overlay = regions[0]!;
      expect(nvs(overlay.x)).toBeCloseTo(0.04);
      expect(nvs(overlay.y)).toBeCloseTo(0.04);
    });

    it('positions overlay at top-right when specified', () => {
      const regions = compileLayout({ layout: 'full-bleed', hasTitle: false, overlayPosition: 'top-right' });
      const overlay = regions[0]!;
      expect(nvs(overlay.x)).toBeCloseTo(1 - 0.4 - 0.04);
      expect(nvs(overlay.y)).toBeCloseTo(0.04);
    });

    it('positions overlay at bottom-right when specified', () => {
      const regions = compileLayout({ layout: 'full-bleed', hasTitle: false, overlayPosition: 'bottom-right' });
      const overlay = regions[0]!;
      expect(nvs(overlay.x)).toBeCloseTo(1 - 0.4 - 0.04);
      expect(nvs(overlay.y)).toBeCloseTo(1 - 0.3 - 0.04);
    });

    it('positions overlay at center when specified', () => {
      const regions = compileLayout({ layout: 'full-bleed', hasTitle: false, overlayPosition: 'center' });
      const overlay = regions[0]!;
      expect(nvs(overlay.x)).toBeCloseTo(0.3);
      expect(nvs(overlay.y)).toBeCloseTo(0.35);
    });

    it('overlay region has layer 1', () => {
      const regions = compileLayout({ layout: 'full-bleed', hasTitle: false });
      expect(regions[0]!.layer).toBe(1);
    });
  });

  // ─── blank ──────────────────────────────────────────────────────────────────

  describe('blank layout', () => {
    it('returns a single full-size body region', () => {
      const regions = compileLayout({ layout: 'blank', hasTitle: false });
      expect(regions).toHaveLength(1);
      expect(regions[0]).toEqual({ id: 'body', x: 0, y: 0, w: pct(1), h: pct(1), layer: 0 });
    });

    it('returns a single full-size body region even with hasTitle', () => {
      const regions = compileLayout({ layout: 'blank', hasTitle: true });
      expect(regions).toHaveLength(1);
      expect(regions[0]!.id).toBe('body');
    });
  });

  // ─── big-number ─────────────────────────────────────────────────────────────

  describe('big-number layout', () => {
    it('returns 1 stat region by default', () => {
      const regions = compileLayout({ layout: 'big-number', hasTitle: false });
      expect(regions).toHaveLength(1);
      expect(regions[0]!.id).toBe('stat-0');
    });

    it('returns 2 stat regions when statCount is 2', () => {
      const regions = compileLayout({ layout: 'big-number', hasTitle: false, statCount: 2 });
      expect(regions).toHaveLength(2);
      expect(regions[0]!.id).toBe('stat-0');
      expect(regions[1]!.id).toBe('stat-1');
    });

    it('returns 3 stat regions when statCount is 3', () => {
      const regions = compileLayout({ layout: 'big-number', hasTitle: false, statCount: 3 });
      expect(regions).toHaveLength(3);
    });

    it('returns 4 stat regions when statCount is 4', () => {
      const regions = compileLayout({ layout: 'big-number', hasTitle: false, statCount: 4 });
      expect(regions).toHaveLength(4);
    });

    it('clamps statCount to min 1', () => {
      const regions = compileLayout({ layout: 'big-number', hasTitle: false, statCount: 0 });
      expect(regions).toHaveLength(1);
    });

    it('clamps statCount to max 4', () => {
      const regions = compileLayout({ layout: 'big-number', hasTitle: false, statCount: 10 });
      expect(regions).toHaveLength(4);
    });

    it('stat regions are vertically centered', () => {
      const regions = compileLayout({ layout: 'big-number', hasTitle: false, statCount: 1 });
      const stat = regions[0]!;
      expect(nvs(stat.h)).toBeCloseTo(0.5);
      expect(nvs(stat.y)).toBeCloseTo(0.25); // (1 - 0.5) / 2
    });

    it('stat regions have equal width with gaps', () => {
      const regions = compileLayout({ layout: 'big-number', hasTitle: false, statCount: 3 });
      const widths = regions.map((r) => nvs(r.w));
      expect(widths[0]).toBeCloseTo(widths[1]!);
      expect(widths[1]).toBeCloseTo(widths[2]!);
    });

    it('adds title region when hasTitle is true', () => {
      const regions = compileLayout({ layout: 'big-number', hasTitle: true, statCount: 2 });
      expect(regions).toHaveLength(3); // title + 2 stats
      expect(regions[0]!.id).toBe('title');
      expect(regions[0]!.layer).toBe(1);
    });

    it('title region height is 70% of standard title height', () => {
      const regions = compileLayout({ layout: 'big-number', hasTitle: true, statCount: 1 });
      const title = regions.find((r) => r.id === 'title')!;
      expect(nvs(title.h)).toBeCloseTo(0.18 * 0.7);
    });
  });

  // ─── metric-grid ────────────────────────────────────────────────────────────

  describe('metric-grid layout', () => {
    it('returns 3 metric columns by default with title', () => {
      const regions = compileLayout({ layout: 'metric-grid', hasTitle: true });
      expect(regions).toHaveLength(4); // title + 3 metrics
      expect(regions[0]!.id).toBe('title');
      expect(regions[1]!.id).toBe('metric-0');
      expect(regions[2]!.id).toBe('metric-1');
      expect(regions[3]!.id).toBe('metric-2');
    });

    it('returns 4 metric columns when metricColumns is 4', () => {
      const regions = compileLayout({ layout: 'metric-grid', hasTitle: false, metricColumns: 4 });
      expect(regions).toHaveLength(4);
      expect(regions[3]!.id).toBe('metric-3');
    });

    it('metric columns have equal width', () => {
      const regions = compileLayout({ layout: 'metric-grid', hasTitle: false, metricColumns: 3 });
      const widths = regions.map((r) => nvs(r.w));
      expect(widths[0]).toBeCloseTo(widths[1]!);
      expect(widths[1]).toBeCloseTo(widths[2]!);
    });

    it('metric columns are positioned below title when hasTitle is true', () => {
      const regions = compileLayout({ layout: 'metric-grid', hasTitle: true });
      const title = regions.find((r) => r.id === 'title')!;
      const metric0 = regions.find((r) => r.id === 'metric-0')!;
      expect(nvs(metric0.y)).toBeGreaterThan(nvs(title.y) + nvs(title.h));
    });

    it('metric columns start at gutter when hasTitle is false', () => {
      const regions = compileLayout({ layout: 'metric-grid', hasTitle: false });
      const metric0 = regions.find((r) => r.id === 'metric-0')!;
      expect(nvs(metric0.y)).toBeCloseTo(0.02);
    });
  });

  // ─── comparison ─────────────────────────────────────────────────────────────

  describe('comparison layout', () => {
    it('returns two regions: title and body', () => {
      const regions = compileLayout({ layout: 'comparison', hasTitle: true });
      expect(regions).toHaveLength(2);
      expect(regions[0]!.id).toBe('title');
      expect(regions[1]!.id).toBe('body');
    });

    it('has same region geometry as content layout', () => {
      const comparison = compileLayout({ layout: 'comparison', hasTitle: true });
      const content = compileLayout({ layout: 'content', hasTitle: true });
      expect(comparison).toEqual(content);
    });
  });

  // ─── quote ──────────────────────────────────────────────────────────────────

  describe('quote layout', () => {
    it('returns two regions: quote and attribution', () => {
      const regions = compileLayout({ layout: 'quote', hasTitle: false });
      expect(regions).toHaveLength(2);
      expect(regions[0]!.id).toBe('quote');
      expect(regions[1]!.id).toBe('attribution');
    });

    it('quote region is horizontally centered with 10% margin', () => {
      const regions = compileLayout({ layout: 'quote', hasTitle: false });
      const quote = regions.find((r) => r.id === 'quote')!;
      expect(nvs(quote.x)).toBeCloseTo(0.1);
      expect(nvs(quote.w)).toBeCloseTo(0.8);
    });

    it('quote region is 60% tall', () => {
      const regions = compileLayout({ layout: 'quote', hasTitle: false });
      const quote = regions.find((r) => r.id === 'quote')!;
      expect(nvs(quote.h)).toBeCloseTo(0.6);
    });

    it('attribution is below the quote region', () => {
      const regions = compileLayout({ layout: 'quote', hasTitle: false });
      const quote = regions.find((r) => r.id === 'quote')!;
      const attribution = regions.find((r) => r.id === 'attribution')!;
      expect(nvs(attribution.y)).toBeGreaterThan(nvs(quote.y) + nvs(quote.h));
    });

    it('attribution has 10% height', () => {
      const regions = compileLayout({ layout: 'quote', hasTitle: false });
      const attribution = regions.find((r) => r.id === 'attribution')!;
      expect(nvs(attribution.h)).toBeCloseTo(0.1);
    });

    it('quote has layer 1, attribution has layer 0', () => {
      const regions = compileLayout({ layout: 'quote', hasTitle: false });
      const quote = regions.find((r) => r.id === 'quote')!;
      const attribution = regions.find((r) => r.id === 'attribution')!;
      expect(quote.layer).toBe(1);
      expect(attribution.layer).toBe(0);
    });
  });

  // ─── agenda ─────────────────────────────────────────────────────────────────

  describe('agenda layout', () => {
    it('returns two regions: title and body', () => {
      const regions = compileLayout({ layout: 'agenda', hasTitle: true });
      expect(regions).toHaveLength(2);
      expect(regions[0]!.id).toBe('title');
      expect(regions[1]!.id).toBe('body');
    });

    it('has same region geometry as content layout', () => {
      const agenda = compileLayout({ layout: 'agenda', hasTitle: true });
      const content = compileLayout({ layout: 'content', hasTitle: true });
      expect(agenda).toEqual(content);
    });
  });

  // ─── unknown / default ──────────────────────────────────────────────────────

  describe('unknown layout', () => {
    it('returns fallback blank region for unknown layout', () => {
      // Cast to bypass type checking for unknown layout string
      const regions = compileLayout({ layout: 'unknown-future' as never, hasTitle: false });
      expect(regions).toHaveLength(1);
      expect(regions[0]).toEqual({ id: 'body', x: 0, y: 0, w: pct(1), h: pct(1), layer: 0 });
    });
  });

  // ─── NVS coordinate sanity ──────────────────────────────────────────────────

  describe('NVS coordinate constraints', () => {
    const allLayouts = [
      { layout: 'title' as const, hasTitle: true },
      { layout: 'section' as const, hasTitle: true },
      { layout: 'content' as const, hasTitle: true },
      { layout: 'two-column' as const, hasTitle: true },
      { layout: 'two-column' as const, hasTitle: false },
      { layout: 'image' as const, hasTitle: false },
      { layout: 'full-bleed' as const, hasTitle: false },
      { layout: 'blank' as const, hasTitle: false },
      { layout: 'big-number' as const, hasTitle: false, statCount: 2 },
      { layout: 'metric-grid' as const, hasTitle: true, metricColumns: 3 },
      { layout: 'comparison' as const, hasTitle: true },
      { layout: 'quote' as const, hasTitle: false },
      { layout: 'agenda' as const, hasTitle: true },
    ];

    it.each(allLayouts)('all regions for $layout have coordinates in [0, 1]', (input) => {
      const regions = compileLayout(input);
      for (const r of regions) {
        const x = nvs(r.x);
        const y = nvs(r.y);
        const w = nvs(r.w);
        const h = nvs(r.h);
        expect(x).toBeGreaterThanOrEqual(0);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(w).toBeGreaterThan(0);
        expect(h).toBeGreaterThan(0);
        expect(x + w).toBeLessThanOrEqual(1.001); // small tolerance for float math
        expect(y + h).toBeLessThanOrEqual(1.001);
      }
    });
  });
});
