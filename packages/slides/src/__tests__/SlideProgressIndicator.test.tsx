// Tests for SlideProgressIndicator component.
// Uses renderToStaticMarkup (node environment — no DOM required).
// Tests each ProgressStyle variant with real prop inputs.

import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SlideProgressIndicator } from '../player/SlideProgressIndicator';
import type { SlideNavigationState } from '../player/useSlideNavigation';

/** Creates a minimal SlideNavigationState for testing. */
function makeNav(current: number, total: number): SlideNavigationState {
  return {
    current,
    total,
    goTo: vi.fn(),
    next: vi.fn(),
    prev: vi.fn(),
  };
}

describe('SlideProgressIndicator', () => {
  // ─── style='none' ────────────────────────────────────────────────────────────

  it('renders nothing for style=none', () => {
    const nav = makeNav(0, 3);
    const result = SlideProgressIndicator({ nav, style: 'none' });
    expect(result).toBeNull();
  });

  // ─── style='dots' ────────────────────────────────────────────────────────────

  it('renders one button per slide for style=dots', () => {
    const nav = makeNav(1, 3);
    const html = renderToStaticMarkup(<SlideProgressIndicator nav={nav} style="dots" />);
    // 3 buttons for 3 slides
    const buttonMatches = html.match(/<button/g);
    expect(buttonMatches).toHaveLength(3);
  });

  it('renders active dot with wider width for current slide', () => {
    const nav = makeNav(0, 3);
    const html = renderToStaticMarkup(<SlideProgressIndicator nav={nav} style="dots" />);
    // Current slide (index 0) has width 1.25rem; others have 0.625rem
    expect(html).toContain('1.25rem');
  });

  it('includes aria-label on each dot button', () => {
    const nav = makeNav(0, 2);
    const html = renderToStaticMarkup(<SlideProgressIndicator nav={nav} style="dots" />);
    expect(html).toContain('aria-label="Go to slide 1"');
    expect(html).toContain('aria-label="Go to slide 2"');
  });

  it('positions dots at bottom center (absolute, bottom 2%, left 50%)', () => {
    const nav = makeNav(0, 3);
    const html = renderToStaticMarkup(<SlideProgressIndicator nav={nav} style="dots" />);
    expect(html).toContain('position:absolute');
    expect(html).toContain('bottom:2%');
    expect(html).toContain('left:50%');
  });

  // ─── style='numbers' ─────────────────────────────────────────────────────────

  it('renders current/total fraction for style=numbers', () => {
    const nav = makeNav(1, 5);
    const html = renderToStaticMarkup(<SlideProgressIndicator nav={nav} style="numbers" />);
    // current + 1 = 2, total = 5 → "2 / 5"
    expect(html).toContain('2');
    expect(html).toContain('/');
    expect(html).toContain('5');
  });

  it('shows slide 1 of N for the first slide', () => {
    const nav = makeNav(0, 4);
    const html = renderToStaticMarkup(<SlideProgressIndicator nav={nav} style="numbers" />);
    expect(html).toContain('1');
    expect(html).toContain('4');
  });

  it('positions numbers at bottom right', () => {
    const nav = makeNav(0, 3);
    const html = renderToStaticMarkup(<SlideProgressIndicator nav={nav} style="numbers" />);
    expect(html).toContain('position:absolute');
    expect(html).toContain('bottom:2%');
    expect(html).toContain('right:3%');
  });

  // ─── style='bar' ─────────────────────────────────────────────────────────────

  it('renders progress bar for style=bar', () => {
    const nav = makeNav(0, 4);
    const html = renderToStaticMarkup(<SlideProgressIndicator nav={nav} style="bar" />);
    // Outer track bar at top
    expect(html).toContain('position:absolute');
    expect(html).toContain('top:0');
    expect(html).toContain('left:0');
    // Filled inner bar with explicit width percentage
    expect(html).toMatch(/width:\d+(\.\d+)?%/);
  });

  it('renders bar at 100% width for a single-slide deck', () => {
    const nav = makeNav(0, 1);
    const html = renderToStaticMarkup(<SlideProgressIndicator nav={nav} style="bar" />);
    expect(html).toContain('width:100%');
  });

  it('renders bar at 25% for first of 4 slides', () => {
    const nav = makeNav(0, 4);
    const html = renderToStaticMarkup(<SlideProgressIndicator nav={nav} style="bar" />);
    expect(html).toContain('width:25%');
  });

  it('renders bar at 75% for third of 4 slides', () => {
    const nav = makeNav(2, 4);
    const html = renderToStaticMarkup(<SlideProgressIndicator nav={nav} style="bar" />);
    expect(html).toContain('width:75%');
  });
});
