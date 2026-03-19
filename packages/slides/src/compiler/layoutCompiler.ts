// Pure: SlideLayout + available props → SlideRegion[]. No React, no Three.js.

import type { SlideLayout, SlideRegion } from '../types';

type LayoutInput = {
  layout: SlideLayout;
  hasTitle: boolean;
  overlayPosition?: 'top-left' | 'bottom-left' | 'top-right' | 'bottom-right' | 'center';
};

const TITLE_H = 0.18;   // 18% of slide height for title bar
const GUTTER = 0.02;    // 2% gutter between title and body
const COL_GAP = 0.04;   // 4% gap between two columns

/**
 * Returns the NVS region descriptors for each TextBox slot in the given layout.
 * IDs are stable (e.g. 'title', 'body', 'left', 'right') and are used as
 * TextBox widget IDs (prefixed with the slide key by deckCompiler.ts).
 *
 * Pure function: same inputs always produce the same output.
 */
export function compileLayout(input: LayoutInput): SlideRegion[] {
  const { layout, hasTitle, overlayPosition } = input;

  switch (layout) {
    case 'title': {
      return [{
        id: 'title',
        x: 0, y: 0, w: 1, h: 1,
        layer: 1,
      }];
    }

    case 'title-body': {
      const bodyY = TITLE_H + GUTTER;
      const bodyH = 1 - bodyY - GUTTER;
      return [
        { id: 'title', x: 0, y: GUTTER, w: 1, h: TITLE_H - GUTTER, layer: 1 },
        { id: 'body',  x: 0, y: bodyY,  w: 1, h: bodyH,             layer: 0 },
      ];
    }

    case 'two-column': {
      const colW = (1 - COL_GAP) / 2;
      const bodyY = hasTitle ? TITLE_H + GUTTER : GUTTER;
      const bodyH = 1 - bodyY - GUTTER;
      const regions: SlideRegion[] = [
        { id: 'left',  x: 0,              y: bodyY, w: colW, h: bodyH, layer: 0 },
        { id: 'right', x: colW + COL_GAP, y: bodyY, w: colW, h: bodyH, layer: 0 },
      ];
      if (hasTitle) {
        regions.unshift({ id: 'title', x: 0, y: GUTTER, w: 1, h: TITLE_H - GUTTER, layer: 1 });
      }
      return regions;
    }

    case 'full-bleed': {
      const OVERLAY_W = 0.4;
      const OVERLAY_H = 0.3;
      const PAD = 0.04;
      const pos = overlayPosition ?? 'bottom-left';
      let x = 0, y = 0;
      if (pos === 'top-left')     { x = PAD; y = PAD; }
      if (pos === 'top-right')    { x = 1 - OVERLAY_W - PAD; y = PAD; }
      if (pos === 'bottom-left')  { x = PAD; y = 1 - OVERLAY_H - PAD; }
      if (pos === 'bottom-right') { x = 1 - OVERLAY_W - PAD; y = 1 - OVERLAY_H - PAD; }
      if (pos === 'center')       { x = (1 - OVERLAY_W) / 2; y = (1 - OVERLAY_H) / 2; }
      return [{ id: 'overlay', x, y, w: OVERLAY_W, h: OVERLAY_H, layer: 1 }];
    }

    case 'blank': {
      // Full-size region — the author's children fill the entire slide.
      return [{ id: 'body', x: 0, y: 0, w: 1, h: 1, layer: 0 }];
    }

    default:
      return [];
  }
}
