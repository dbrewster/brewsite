// Tests for compileLayout() — one test per layout variant.

import { describe, it, expect } from 'vitest';
import { compileLayout } from '../layoutCompiler';

describe('compileLayout', () => {
  describe('title layout', () => {
    it('returns a single full-viewport region', () => {
      const regions = compileLayout({ layout: 'title', hasTitle: true });
      expect(regions).toHaveLength(1);
      expect(regions[0]).toMatchObject({ id: 'title', x: 0, y: 0, w: 1, h: 1, layer: 1 });
    });

    it('returns same result when hasTitle is false (layout always fills viewport)', () => {
      const regions = compileLayout({ layout: 'title', hasTitle: false });
      expect(regions).toHaveLength(1);
      expect(regions[0]!.id).toBe('title');
    });
  });

  describe('title-body layout', () => {
    it('returns two regions: title and body', () => {
      const regions = compileLayout({ layout: 'title-body', hasTitle: true });
      expect(regions).toHaveLength(2);
      const title = regions.find((r) => r.id === 'title');
      const body = regions.find((r) => r.id === 'body');
      expect(title).toBeDefined();
      expect(body).toBeDefined();
    });

    it('title region spans full width', () => {
      const regions = compileLayout({ layout: 'title-body', hasTitle: true });
      const title = regions.find((r) => r.id === 'title')!;
      expect(title.x).toBe(0);
      expect(title.w).toBe(1);
    });

    it('body is positioned below the title', () => {
      const regions = compileLayout({ layout: 'title-body', hasTitle: true });
      const title = regions.find((r) => r.id === 'title')!;
      const body = regions.find((r) => r.id === 'body')!;
      expect(body.y).toBeGreaterThan(title.y + title.h);
    });

    it('title has higher layer than body', () => {
      const regions = compileLayout({ layout: 'title-body', hasTitle: true });
      const title = regions.find((r) => r.id === 'title')!;
      const body = regions.find((r) => r.id === 'body')!;
      expect(title.layer).toBeGreaterThan(body.layer);
    });

    it('body spans full width', () => {
      const regions = compileLayout({ layout: 'title-body', hasTitle: true });
      const body = regions.find((r) => r.id === 'body')!;
      expect(body.x).toBe(0);
      expect(body.w).toBe(1);
    });
  });

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
      expect(title.w).toBe(1);
    });

    it('left and right columns have equal width', () => {
      const regions = compileLayout({ layout: 'two-column', hasTitle: true });
      const left = regions.find((r) => r.id === 'left')!;
      const right = regions.find((r) => r.id === 'right')!;
      expect(left.w).toBeCloseTo(right.w);
    });

    it('right column starts after left column with a gap', () => {
      const regions = compileLayout({ layout: 'two-column', hasTitle: true });
      const left = regions.find((r) => r.id === 'left')!;
      const right = regions.find((r) => r.id === 'right')!;
      expect(right.x).toBeGreaterThan(left.x + left.w);
    });

    it('columns are below the title', () => {
      const regions = compileLayout({ layout: 'two-column', hasTitle: true });
      const title = regions.find((r) => r.id === 'title')!;
      const left = regions.find((r) => r.id === 'left')!;
      expect(left.y).toBeGreaterThan(title.y + title.h);
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
      expect(leftNoTitle.y).toBeLessThan(leftWithTitle.y);
    });
  });

  describe('full-bleed layout', () => {
    it('returns one overlay region', () => {
      const regions = compileLayout({ layout: 'full-bleed', hasTitle: false });
      expect(regions).toHaveLength(1);
      expect(regions[0]!.id).toBe('overlay');
    });

    it('defaults to bottom-left when overlayPosition is not specified', () => {
      const regions = compileLayout({ layout: 'full-bleed', hasTitle: false });
      const overlay = regions[0]!;
      // bottom-left: x = PAD (0.04), y = 1 - OVERLAY_H - PAD
      expect(overlay.x).toBeCloseTo(0.04);
      expect(overlay.y).toBeGreaterThan(0.5);
    });

    it('positions overlay at top-left when specified', () => {
      const regions = compileLayout({ layout: 'full-bleed', hasTitle: false, overlayPosition: 'top-left' });
      const overlay = regions[0]!;
      expect(overlay.x).toBeCloseTo(0.04);
      expect(overlay.y).toBeCloseTo(0.04);
    });

    it('positions overlay at center when specified', () => {
      const regions = compileLayout({ layout: 'full-bleed', hasTitle: false, overlayPosition: 'center' });
      const overlay = regions[0]!;
      // center: x = (1 - 0.4) / 2 = 0.3, y = (1 - 0.3) / 2 = 0.35
      expect(overlay.x).toBeCloseTo(0.3);
      expect(overlay.y).toBeCloseTo(0.35);
    });

    it('overlay region has layer 1', () => {
      const regions = compileLayout({ layout: 'full-bleed', hasTitle: false });
      expect(regions[0]!.layer).toBe(1);
    });
  });

  describe('blank layout', () => {
    it('returns a single full-size body region', () => {
      const regions = compileLayout({ layout: 'blank', hasTitle: false });
      expect(regions).toHaveLength(1);
      expect(regions[0]).toEqual({ id: 'body', x: 0, y: 0, w: 1, h: 1, layer: 0 });
    });

    it('returns a single full-size body region even with hasTitle', () => {
      const regions = compileLayout({ layout: 'blank', hasTitle: true });
      expect(regions).toHaveLength(1);
      expect(regions[0]!.id).toBe('body');
    });
  });
});
