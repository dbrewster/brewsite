// Tests for SlideTransitionWrapper component and resolveTransitionClass helper.
// Uses renderToStaticMarkup (node environment — no DOM required).
// Tests correct CSS class applied per transition type.

import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SlideTransitionWrapper, resolveTransitionClass } from '../player/SlideTransitionWrapper';

// ─── resolveTransitionClass (pure function) ────────────────────────────────────

describe('resolveTransitionClass', () => {
  it('returns empty string for transition=none', () => {
    expect(resolveTransitionClass('none', false)).toBe('');
  });

  it('returns empty string for transition=none even when active=true', () => {
    expect(resolveTransitionClass('none', true)).toBe('');
  });

  it('returns base class for transition=dissolve, active=false', () => {
    expect(resolveTransitionClass('dissolve', false)).toBe('slide-transition--dissolve');
  });

  it('returns base + active modifier for transition=dissolve, active=true', () => {
    expect(resolveTransitionClass('dissolve', true)).toBe('slide-transition--dissolve slide-transition--dissolve--active');
  });
});

// ─── SlideTransitionWrapper (rendered component) ──────────────────────────────

describe('SlideTransitionWrapper', () => {
  it('renders children inside a div', () => {
    const html = renderToStaticMarkup(
      <SlideTransitionWrapper transition="none">
        <span>content</span>
      </SlideTransitionWrapper>,
    );
    expect(html).toContain('<div');
    expect(html).toContain('content');
  });

  it('applies no class for transition=none', () => {
    const html = renderToStaticMarkup(
      <SlideTransitionWrapper transition="none">
        <span>content</span>
      </SlideTransitionWrapper>,
    );
    // No className attribute should be present when class is empty
    expect(html).not.toContain('slide-transition--');
  });

  it('applies dissolve class for transition=dissolve, active=false', () => {
    const html = renderToStaticMarkup(
      <SlideTransitionWrapper transition="dissolve">
        <span>content</span>
      </SlideTransitionWrapper>,
    );
    expect(html).toContain('class="slide-transition--dissolve"');
  });

  it('applies dissolve active class for transition=dissolve, active=true', () => {
    const html = renderToStaticMarkup(
      <SlideTransitionWrapper transition="dissolve" active>
        <span>content</span>
      </SlideTransitionWrapper>,
    );
    expect(html).toContain('slide-transition--dissolve');
    expect(html).toContain('slide-transition--dissolve--active');
  });

  it('sets data-transition attribute to the transition type', () => {
    const html = renderToStaticMarkup(
      <SlideTransitionWrapper transition="dissolve">
        <span>content</span>
      </SlideTransitionWrapper>,
    );
    expect(html).toContain('data-transition="dissolve"');
  });

  it('sets data-transition="none" for transition=none', () => {
    const html = renderToStaticMarkup(
      <SlideTransitionWrapper transition="none">
        <span>content</span>
      </SlideTransitionWrapper>,
    );
    expect(html).toContain('data-transition="none"');
  });

  it('merges additional className prop with transition class', () => {
    const html = renderToStaticMarkup(
      <SlideTransitionWrapper transition="dissolve" className="extra-class">
        <span>content</span>
      </SlideTransitionWrapper>,
    );
    expect(html).toContain('slide-transition--dissolve');
    expect(html).toContain('extra-class');
  });

  it('applies inline style when provided', () => {
    const html = renderToStaticMarkup(
      <SlideTransitionWrapper transition="none" style={{ opacity: 0 }}>
        <span>content</span>
      </SlideTransitionWrapper>,
    );
    expect(html).toContain('opacity');
  });

  it('renders without className attribute when transition=none and no extra className', () => {
    const html = renderToStaticMarkup(
      <SlideTransitionWrapper transition="none">
        <span>content</span>
      </SlideTransitionWrapper>,
    );
    // Should not have an empty class=""
    expect(html).not.toContain('class=""');
  });
});
