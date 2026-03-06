// packages/slides/src/player/SlidePrintLayout.tsx
// Print layout: renders one page per slide with WebGL canvas snapshot + optional notes.
// Does NOT capture snapshots itself — that is SlidePlayer.captureSlideSnapshots() (Stream E).

import React, { type CSSProperties, type ReactElement } from 'react';
import type { DeckSpec, PrintOptions } from '../types';

/** Props for SlidePrintLayout. */
export type SlidePrintLayoutProps = {
  /**
   * Map from 0-based slide index to PNG data URL.
   * Produced by SlidePlayerHandle.captureSlideSnapshots() then keyed by index.
   */
  snapshots: Map<number, string>;
  /** Compiled deck specification providing slide metadata (title, notes). */
  deck: DeckSpec;
  /** Print rendering options. */
  printOptions: PrintOptions;
};

/** CSS page dimensions indexed by PrintOptions.pageSize. */
const PAGE_DIMENSIONS: Record<PrintOptions['pageSize'], CSSProperties> = {
  'letter': { width: '11in', height: '8.5in' },   // landscape
  'a4': { width: '297mm', height: '210mm' },        // landscape
  '16x9': { width: '16in', height: '9in' },
};

/** CSS @page size string for each pageSize. */
const PAGE_CSS_SIZE: Record<PrintOptions['pageSize'], string> = {
  'letter': 'letter landscape',
  'a4': 'a4 landscape',
  '16x9': '16in 9in landscape',
};

/**
 * Renders a printable layout with one page per slide.
 * Each page shows a snapshot image and optionally the speaker notes.
 *
 * Usage:
 *   const handle = useRef<SlidePlayerHandle>(null);
 *   const snapshots = await handle.current.captureSlideSnapshots();
 *   // Build a Map<number, string> from the Map<string, string> returned:
 *   const indexedSnapshots = new Map(deck.slides.map((s, i) => [i, snapshots.get(s.key) ?? '']));
 *   <SlidePrintLayout snapshots={indexedSnapshots} deck={deck} printOptions={{ pageSize: '16x9', includeNotes: true }} />
 */
export const SlidePrintLayout = ({ snapshots, deck, printOptions }: SlidePrintLayoutProps): ReactElement => {
  const { pageSize, includeNotes } = printOptions;
  const pageDims = PAGE_DIMENSIONS[pageSize];
  const cssSize = PAGE_CSS_SIZE[pageSize];

  const pageStyle: CSSProperties = {
    ...pageDims,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    boxSizing: 'border-box',
    pageBreakAfter: 'always',
    breakAfter: 'page',
  };

  return (
    <>
      <style>{`
        @media print {
          body { margin: 0; }
          .slide-print-page { page-break-after: always; break-after: page; }
          .slide-print-notes { font-size: 0.75rem; padding: 0.5rem 1rem; background: #f5f5f5; }
        }
        @page {
          size: ${cssSize};
          margin: 0;
        }
      `}</style>
      {deck.slides.map((slide, i) => {
        const snapshot = snapshots.get(i);
        const imageHeight = includeNotes ? '85%' : '100%';

        return (
          <div
            key={slide.key}
            className="slide-print-page"
            data-slide-key={slide.key}
            data-slide-index={i}
            style={pageStyle}
          >
            {snapshot
              ? (
                <img
                  src={snapshot}
                  alt={slide.title ?? `Slide ${i + 1}`}
                  style={{ width: '100%', height: imageHeight, objectFit: 'contain', display: 'block', flexShrink: 0 }}
                />
              )
              : (
                <div style={{ width: '100%', height: imageHeight, background: '#eee', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ color: '#999', fontSize: '0.875rem' }}>{slide.title ?? `Slide ${i + 1}`}</span>
                </div>
              )
            }
            {includeNotes && slide.notes && (
              <div className="slide-print-notes" style={{ flex: 1, overflow: 'hidden', lineHeight: 1.4, fontSize: '0.75rem', padding: '0.5rem 1rem', background: '#f5f5f5' }}>
                <strong>Notes:</strong> {slide.notes}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
};
SlidePrintLayout.displayName = 'SlidePrintLayout';
