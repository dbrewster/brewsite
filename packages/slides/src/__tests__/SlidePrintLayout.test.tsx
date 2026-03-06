// Tests for SlidePrintLayout component.
// Uses renderToStaticMarkup (node environment — no DOM required).
// Tests correct page count and notes visibility based on PrintOptions.

import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SlidePrintLayout } from '../player/SlidePrintLayout';
import type { DeckSpec, SlideSpec, PrintOptions } from '../types';

/** Creates a minimal SlideSpec for testing. */
function makeSlide(key: string, title?: string, notes?: string): SlideSpec {
  return {
    key,
    layout: 'title-body',
    transition: 'dissolve',
    notes,
    scrollUnits: 400,
    regions: [],
    title,
    hasAnimatedList: false,
    totalBullets: 0,
  };
}

/** Creates a minimal DeckSpec for testing. */
function makeDeck(slides: SlideSpec[]): DeckSpec {
  return {
    slides,
    // theme is not used during rendering; cast to unknown to satisfy type without full construction
    theme: {} as unknown as DeckSpec['theme'],
    transition: 'dissolve',
  };
}

const THREE_SLIDES = [
  makeSlide('s1', 'Introduction', 'Opening remarks here.'),
  makeSlide('s2', 'Content', undefined),
  makeSlide('s3', 'Conclusion', 'Final thoughts.'),
];

const SNAPSHOTS_3: Map<number, string> = new Map([
  [0, 'data:image/png;base64,AAA=='],
  [1, 'data:image/png;base64,BBB=='],
  [2, 'data:image/png;base64,CCC=='],
]);

const PRINT_OPTIONS_WITH_NOTES: PrintOptions = { pageSize: '16x9', includeNotes: true };
const PRINT_OPTIONS_NO_NOTES: PrintOptions = { pageSize: '16x9', includeNotes: false };

describe('SlidePrintLayout', () => {
  // ─── Page count ───────────────────────────────────────────────────────────────

  it('renders exactly one page per slide for a 3-slide deck', () => {
    const deck = makeDeck(THREE_SLIDES);
    const html = renderToStaticMarkup(
      <SlidePrintLayout snapshots={SNAPSHOTS_3} deck={deck} printOptions={PRINT_OPTIONS_NO_NOTES} />,
    );
    // Match the class attribute value, not the CSS rule (which also contains 'slide-print-page')
    const pageMatches = html.match(/class="slide-print-page"/g);
    expect(pageMatches).toHaveLength(3);
  });

  it('renders the correct data-slide-key for each page', () => {
    const deck = makeDeck(THREE_SLIDES);
    const html = renderToStaticMarkup(
      <SlidePrintLayout snapshots={SNAPSHOTS_3} deck={deck} printOptions={PRINT_OPTIONS_NO_NOTES} />,
    );
    expect(html).toContain('data-slide-key="s1"');
    expect(html).toContain('data-slide-key="s2"');
    expect(html).toContain('data-slide-key="s3"');
  });

  // ─── Snapshot images ─────────────────────────────────────────────────────────

  it('renders snapshot <img> elements for slides that have snapshots', () => {
    const deck = makeDeck(THREE_SLIDES);
    const html = renderToStaticMarkup(
      <SlidePrintLayout snapshots={SNAPSHOTS_3} deck={deck} printOptions={PRINT_OPTIONS_NO_NOTES} />,
    );
    const imgMatches = html.match(/<img/g);
    expect(imgMatches).toHaveLength(3);
    expect(html).toContain('src="data:image/png;base64,AAA=="');
    expect(html).toContain('src="data:image/png;base64,BBB=="');
    expect(html).toContain('src="data:image/png;base64,CCC=="');
  });

  it('renders a placeholder div when a slide has no snapshot', () => {
    const deck = makeDeck(THREE_SLIDES);
    const partialSnapshots = new Map([[0, 'data:image/png;base64,AAA==']]);
    const html = renderToStaticMarkup(
      <SlidePrintLayout snapshots={partialSnapshots} deck={deck} printOptions={PRINT_OPTIONS_NO_NOTES} />,
    );
    // Only 1 img — slides 1 and 2 have no snapshot
    const imgMatches = html.match(/<img/g);
    expect(imgMatches).toHaveLength(1);
  });

  it('uses slide title as alt text for snapshot image', () => {
    const deck = makeDeck(THREE_SLIDES);
    const html = renderToStaticMarkup(
      <SlidePrintLayout snapshots={SNAPSHOTS_3} deck={deck} printOptions={PRINT_OPTIONS_NO_NOTES} />,
    );
    expect(html).toContain('alt="Introduction"');
    expect(html).toContain('alt="Content"');
    expect(html).toContain('alt="Conclusion"');
  });

  // ─── Notes visibility ────────────────────────────────────────────────────────

  it('renders speaker notes when includeNotes=true', () => {
    const deck = makeDeck(THREE_SLIDES);
    const html = renderToStaticMarkup(
      <SlidePrintLayout snapshots={SNAPSHOTS_3} deck={deck} printOptions={PRINT_OPTIONS_WITH_NOTES} />,
    );
    expect(html).toContain('Opening remarks here.');
    expect(html).toContain('Final thoughts.');
    // slide s2 has no notes — should not render a notes block
  });

  it('does not render notes when includeNotes=false', () => {
    const deck = makeDeck(THREE_SLIDES);
    const html = renderToStaticMarkup(
      <SlidePrintLayout snapshots={SNAPSHOTS_3} deck={deck} printOptions={PRINT_OPTIONS_NO_NOTES} />,
    );
    expect(html).not.toContain('Opening remarks here.');
    expect(html).not.toContain('Final thoughts.');
  });

  it('does not render notes section for slides with no notes even when includeNotes=true', () => {
    const deck = makeDeck(THREE_SLIDES);
    const html = renderToStaticMarkup(
      <SlidePrintLayout snapshots={SNAPSHOTS_3} deck={deck} printOptions={PRINT_OPTIONS_WITH_NOTES} />,
    );
    // s2 has no notes — only 2 notes sections should appear (s1 and s3)
    // Match class attribute value, not the CSS rule reference
    const notesMatches = html.match(/class="slide-print-notes"/g);
    expect(notesMatches).toHaveLength(2);
  });

  // ─── @page CSS ────────────────────────────────────────────────────────────────

  it('includes @page CSS rule in the output', () => {
    const deck = makeDeck(THREE_SLIDES);
    const html = renderToStaticMarkup(
      <SlidePrintLayout snapshots={SNAPSHOTS_3} deck={deck} printOptions={PRINT_OPTIONS_NO_NOTES} />,
    );
    expect(html).toContain('@page');
  });

  it('uses letter landscape page size when pageSize=letter', () => {
    const deck = makeDeck(THREE_SLIDES);
    const html = renderToStaticMarkup(
      <SlidePrintLayout snapshots={SNAPSHOTS_3} deck={deck} printOptions={{ pageSize: 'letter', includeNotes: false }} />,
    );
    expect(html).toContain('letter');
  });

  // ─── Single slide deck ────────────────────────────────────────────────────────

  it('renders correctly for a single-slide deck', () => {
    const deck = makeDeck([makeSlide('only', 'Only Slide', 'One note.')]);
    const snapshots = new Map([[0, 'data:image/png;base64,AAA==']]);
    const html = renderToStaticMarkup(
      <SlidePrintLayout snapshots={snapshots} deck={deck} printOptions={PRINT_OPTIONS_WITH_NOTES} />,
    );
    const pageMatches = html.match(/class="slide-print-page"/g);
    expect(pageMatches).toHaveLength(1);
    expect(html).toContain('One note.');
  });
});
