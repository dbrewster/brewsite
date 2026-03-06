// Tests for @brewsite/slides DSL components.
// Verifies that compile-time markers return null and have correct displayNames.
// Verifies that rendered text primitives (Heading, Body, BulletList, NumberedList) render correctly.

import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  Slide,
  TitleLayout,
  TitleBodyLayout,
  TwoColumnLayout,
  FullBleedLayout,
  BlankLayout,
  SlideContent,
  Heading,
  Body,
  BulletList,
  NumberedList,
} from '../dsl';

// ─── DSL null-returning components ────────────────────────────────────────────

describe('DSL compile-time marker components', () => {
  it('Slide returns null', () => {
    const result = Slide({});
    expect(result).toBeNull();
  });

  it('Slide has correct displayName', () => {
    expect(Slide.displayName).toBe('Slide');
  });

  it('TitleLayout returns null', () => {
    const result = TitleLayout({ title: 'Hello' });
    expect(result).toBeNull();
  });

  it('TitleLayout has correct displayName', () => {
    expect(TitleLayout.displayName).toBe('TitleLayout');
  });

  it('TitleBodyLayout returns null', () => {
    const result = TitleBodyLayout({ title: 'Hello' });
    expect(result).toBeNull();
  });

  it('TitleBodyLayout has correct displayName', () => {
    expect(TitleBodyLayout.displayName).toBe('TitleBodyLayout');
  });

  it('TwoColumnLayout returns null', () => {
    const result = TwoColumnLayout({ left: null, right: null });
    expect(result).toBeNull();
  });

  it('TwoColumnLayout has correct displayName', () => {
    expect(TwoColumnLayout.displayName).toBe('TwoColumnLayout');
  });

  it('FullBleedLayout returns null', () => {
    const result = FullBleedLayout({});
    expect(result).toBeNull();
  });

  it('FullBleedLayout has correct displayName', () => {
    expect(FullBleedLayout.displayName).toBe('FullBleedLayout');
  });

  it('BlankLayout returns null', () => {
    const result = BlankLayout({});
    expect(result).toBeNull();
  });

  it('BlankLayout has correct displayName', () => {
    expect(BlankLayout.displayName).toBe('BlankLayout');
  });

  it('SlideContent returns null', () => {
    const result = SlideContent({});
    expect(result).toBeNull();
  });

  it('SlideContent has correct displayName', () => {
    expect(SlideContent.displayName).toBe('SlideContent');
  });
});

// ─── Text primitive rendering ─────────────────────────────────────────────────

describe('Heading', () => {
  it('renders an h2 by default', () => {
    const html = renderToStaticMarkup(<Heading>Test Title</Heading>);
    expect(html).toContain('<h2');
    expect(html).toContain('Test Title');
  });

  it('renders h1 when level=1', () => {
    const html = renderToStaticMarkup(<Heading level={1}>Top Heading</Heading>);
    expect(html).toContain('<h1');
    expect(html).toContain('Top Heading');
  });

  it('renders h3 when level=3', () => {
    const html = renderToStaticMarkup(<Heading level={3}>Sub</Heading>);
    expect(html).toContain('<h3');
  });

  it('applies custom color override', () => {
    const html = renderToStaticMarkup(<Heading color="#ff0000">Red</Heading>);
    expect(html).toContain('#ff0000');
  });

  it('uses CSS variable for color when no override', () => {
    const html = renderToStaticMarkup(<Heading>Default</Heading>);
    expect(html).toContain('var(--slide-color-heading)');
  });

  it('has correct displayName', () => {
    expect(Heading.displayName).toBe('Heading');
  });
});

describe('Body', () => {
  it('renders a <p> element', () => {
    const html = renderToStaticMarkup(<Body>Some body text</Body>);
    expect(html).toContain('<p');
    expect(html).toContain('Some body text');
  });

  it('uses CSS variables for styling', () => {
    const html = renderToStaticMarkup(<Body>text</Body>);
    expect(html).toContain('var(--slide-color-body)');
    expect(html).toContain('var(--brewsite-font-family)');
  });

  it('has correct displayName', () => {
    expect(Body.displayName).toBe('Body');
  });
});

describe('BulletList', () => {
  it('renders all items when no visibleCount', () => {
    const html = renderToStaticMarkup(
      <BulletList items={['Alpha', 'Beta', 'Gamma']} />,
    );
    expect(html).toContain('Alpha');
    expect(html).toContain('Beta');
    expect(html).toContain('Gamma');
  });

  it('respects visibleCount — shows only first N items', () => {
    const html = renderToStaticMarkup(
      <BulletList items={['Alpha', 'Beta', 'Gamma']} visibleCount={2} />,
    );
    expect(html).toContain('Alpha');
    expect(html).toContain('Beta');
    expect(html).not.toContain('Gamma');
  });

  it('renders arrow bullet style', () => {
    const html = renderToStaticMarkup(
      <BulletList items={['Step 1']} bulletStyle="arrow" />,
    );
    expect(html).toContain('→');
  });

  it('renders checkmark bullet style', () => {
    const html = renderToStaticMarkup(
      <BulletList items={['Done']} bulletStyle="checkmark" />,
    );
    expect(html).toContain('✓');
  });

  it('renders no bullet marker for none style', () => {
    const html = renderToStaticMarkup(
      <BulletList items={['Item']} bulletStyle="none" />,
    );
    // The bullet span should not be rendered for 'none'
    expect(html).not.toContain('•');
    expect(html).not.toContain('→');
    expect(html).not.toContain('✓');
  });

  it('renders disc bullet by default', () => {
    const html = renderToStaticMarkup(<BulletList items={['Item']} />);
    expect(html).toContain('•');
  });

  it('has correct displayName', () => {
    expect(BulletList.displayName).toBe('BulletList');
  });
});

describe('NumberedList', () => {
  it('renders all items with sequential numbers', () => {
    const html = renderToStaticMarkup(
      <NumberedList items={['First', 'Second', 'Third']} />,
    );
    expect(html).toContain('First');
    expect(html).toContain('Second');
    expect(html).toContain('Third');
    expect(html).toContain('1.');
    expect(html).toContain('2.');
    expect(html).toContain('3.');
  });

  it('respects visibleCount', () => {
    const html = renderToStaticMarkup(
      <NumberedList items={['First', 'Second', 'Third']} visibleCount={1} />,
    );
    expect(html).toContain('First');
    expect(html).not.toContain('Second');
    expect(html).not.toContain('Third');
  });

  it('has correct displayName', () => {
    expect(NumberedList.displayName).toBe('NumberedList');
  });
});

// ─── Type discriminator checks ────────────────────────────────────────────────

describe('Component identity checks (used by deckCompiler.ts)', () => {
  it('Slide function reference is stable for identity comparison', () => {
    // deckCompiler.ts uses `element.type === Slide` for identification
    expect(typeof Slide).toBe('function');
    const ref = Slide;
    expect(ref).toBe(Slide);
  });

  it('all layout component references are distinct', () => {
    const components = [TitleLayout, TitleBodyLayout, TwoColumnLayout, FullBleedLayout, BlankLayout];
    const unique = new Set(components);
    expect(unique.size).toBe(5);
  });
});
