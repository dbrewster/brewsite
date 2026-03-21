// Tests for SlideTransitionWrapper component and resolveTransitionClass helper.
// Uses renderToStaticMarkup (node environment — no DOM required).
// Tests correct CSS class applied per transition type.

import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SlideTransitionWrapper, resolveTransitionClass } from '../player/SlideTransitionWrapper';

// ─── resolveTransitionClass (pure function) ────────────────────────────────────

describe('resolveTransitionClass', () => {
  it('returns empty string for transition=cut', () => {
    expect(resolveTransitionClass('cut', false)).toBe('');
  });

  it('returns empty string for transition=cut even when active=true', () => {
    expect(resolveTransitionClass('cut', true)).toBe('');
  });

  it('returns base class for transition=dissolve, active=false', () => {
    expect(resolveTransitionClass('dissolve', false)).toBe('slide-transition--dissolve');
  });

  it('returns base + active modifier for transition=dissolve, active=true', () => {
    expect(resolveTransitionClass('dissolve', true)).toBe('slide-transition--dissolve slide-transition--dissolve--active');
  });

  it('maps fade to dissolve class', () => {
    expect(resolveTransitionClass('fade', false)).toBe('slide-transition--dissolve');
    expect(resolveTransitionClass('fade', true)).toBe('slide-transition--dissolve slide-transition--dissolve--active');
  });

  it('returns push-left class for push-left transition', () => {
    expect(resolveTransitionClass('push-left', false)).toBe('slide-transition--push-left');
    expect(resolveTransitionClass('push-left', true)).toBe('slide-transition--push-left slide-transition--push-left--active');
  });

  it('returns push-right class for push-right transition', () => {
    expect(resolveTransitionClass('push-right', false)).toBe('slide-transition--push-right');
  });

  it('returns push-up class for push-up transition', () => {
    expect(resolveTransitionClass('push-up', false)).toBe('slide-transition--push-up');
  });

  it('returns push-down class for push-down transition', () => {
    expect(resolveTransitionClass('push-down', false)).toBe('slide-transition--push-down');
  });

  it('returns zoom-in class for zoom-in transition', () => {
    expect(resolveTransitionClass('zoom-in', false)).toBe('slide-transition--zoom-in');
    expect(resolveTransitionClass('zoom-in', true)).toBe('slide-transition--zoom-in slide-transition--zoom-in--active');
  });

  it('returns zoom-out class for zoom-out transition', () => {
    expect(resolveTransitionClass('zoom-out', false)).toBe('slide-transition--zoom-out');
    expect(resolveTransitionClass('zoom-out', true)).toBe('slide-transition--zoom-out slide-transition--zoom-out--active');
  });
});

// ─── SlideTransitionWrapper (rendered component) ──────────────────────────────

describe('SlideTransitionWrapper', () => {
  it('renders children inside a div', () => {
    const html = renderToStaticMarkup(
      <SlideTransitionWrapper transition="cut">
        <span>content</span>
      </SlideTransitionWrapper>,
    );
    expect(html).toContain('<div');
    expect(html).toContain('content');
  });

  it('applies no class for transition=cut', () => {
    const html = renderToStaticMarkup(
      <SlideTransitionWrapper transition="cut">
        <span>content</span>
      </SlideTransitionWrapper>,
    );
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

  it('sets data-transition="cut" for transition=cut', () => {
    const html = renderToStaticMarkup(
      <SlideTransitionWrapper transition="cut">
        <span>content</span>
      </SlideTransitionWrapper>,
    );
    expect(html).toContain('data-transition="cut"');
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
      <SlideTransitionWrapper transition="cut" style={{ opacity: 0 }}>
        <span>content</span>
      </SlideTransitionWrapper>,
    );
    expect(html).toContain('opacity');
  });

  it('renders without className attribute when transition=cut and no extra className', () => {
    const html = renderToStaticMarkup(
      <SlideTransitionWrapper transition="cut">
        <span>content</span>
      </SlideTransitionWrapper>,
    );
    expect(html).not.toContain('class=""');
  });
});
