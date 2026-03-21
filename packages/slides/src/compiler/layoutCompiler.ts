// Pure: SlideLayout + available props → SlideRegion[]. No React, no Three.js.

import type { SlideLayout, SlideRegion } from '../types';
import type { SceneLength } from '@brewsite/core';

/**
 * Input for the layout compiler. Describes the layout variant and any
 * variant-specific configuration needed to compute NVS regions.
 */
export type LayoutInput = {
  layout: SlideLayout;
  hasTitle: boolean;
  overlayPosition?: 'top-left' | 'bottom-left' | 'top-right' | 'bottom-right' | 'center';
  /** Number of stats for big-number layout. Default: 1. */
  statCount?: number;
  /** Number of metric columns for metric-grid layout. Default: 3. */
  metricColumns?: number;
  /** Image position for image layout. Default: 'left'. */
  imagePosition?: 'left' | 'right';
  /** Number of comparison columns. */
  comparisonColumns?: number;
};

// NVS structural constants — fixed grid, not theme-configurable.
// Visual density (padding, gap) is controlled by --slide-* CSS vars at render time.
const TITLE_H = 0.18;
const GUTTER = 0.02;

/** Convert an NVS fraction [0..1] to a SceneLength percentage string. */
function pct(value: number): SceneLength {
  if (value === 0) return 0;
  return `${value * 100}%` as SceneLength;
}

/**
 * Returns the NVS region descriptors for each TextBox slot in the given layout.
 * IDs are stable (e.g. 'title', 'body', 'left', 'right') and are used as
 * TextBox widget IDs (prefixed with the slide key by deckCompiler.ts).
 *
 * Pure function: same inputs always produce the same output.
 */
export function compileLayout(input: LayoutInput): SlideRegion[] {
  const titleH = TITLE_H;
  const gutter = GUTTER;

  switch (input.layout) {
    case 'title': {
      return [{ id: 'title', x: 0, y: 0, w: pct(1), h: pct(1), layer: 1 }];
    }

    case 'section': {
      return [{ id: 'title', x: 0, y: 0, w: pct(1), h: pct(1), layer: 1 }];
    }

    case 'content': {
      const bodyY = titleH + gutter;
      const bodyH = 1 - bodyY - gutter;
      return [
        { id: 'title', x: 0, y: pct(gutter), w: pct(1), h: pct(titleH - gutter), layer: 1 },
        { id: 'body',  x: 0, y: pct(bodyY),  w: pct(1), h: pct(bodyH),           layer: 0 },
      ];
    }

    case 'two-column': {
      const colGap = gutter * 2;  // wider gap between columns
      const colW = (1 - colGap) / 2;
      const bodyY = input.hasTitle ? titleH + gutter : gutter;
      const bodyH = 1 - bodyY - gutter;
      const regions: SlideRegion[] = [
        { id: 'left',  x: 0,                   y: pct(bodyY), w: pct(colW), h: pct(bodyH), layer: 0 },
        { id: 'right', x: pct(colW + colGap),  y: pct(bodyY), w: pct(colW), h: pct(bodyH), layer: 0 },
      ];
      if (input.hasTitle) {
        regions.unshift({ id: 'title', x: 0, y: pct(gutter), w: pct(1), h: pct(titleH - gutter), layer: 1 });
      }
      return regions;
    }

    case 'image': {
      const imgW = 0.55;
      const textW = 1 - imgW - gutter;
      const isLeft = (input.imagePosition ?? 'left') === 'left';
      return [
        {
          id: 'image',
          x: isLeft ? 0 : pct(textW + gutter),
          y: 0, w: pct(imgW), h: pct(1),
          layer: 0,
        },
        {
          id: 'body',
          x: isLeft ? pct(imgW + gutter) : 0,
          y: pct(gutter), w: pct(textW), h: pct(1 - gutter * 2),
          layer: 0,
        },
      ];
    }

    case 'full-bleed': {
      const OVERLAY_W = 0.4;
      const OVERLAY_H = 0.3;
      const PAD = 0.04;
      const pos = input.overlayPosition ?? 'bottom-left';
      let x = 0, y = 0;
      if (pos === 'top-left')     { x = PAD; y = PAD; }
      if (pos === 'top-right')    { x = 1 - OVERLAY_W - PAD; y = PAD; }
      if (pos === 'bottom-left')  { x = PAD; y = 1 - OVERLAY_H - PAD; }
      if (pos === 'bottom-right') { x = 1 - OVERLAY_W - PAD; y = 1 - OVERLAY_H - PAD; }
      if (pos === 'center')       { x = (1 - OVERLAY_W) / 2; y = (1 - OVERLAY_H) / 2; }
      return [{ id: 'overlay', x: pct(x), y: pct(y), w: pct(OVERLAY_W), h: pct(OVERLAY_H), layer: 1 }];
    }

    case 'blank': {
      return [{ id: 'body', x: 0, y: 0, w: pct(1), h: pct(1), layer: 0 }];
    }

    case 'big-number': {
      const count = Math.max(1, Math.min(4, input.statCount ?? 1));
      const statGap = gutter;
      const statW = (1 - statGap * (count - 1)) / count;
      const statH = 0.5;
      const statY = (1 - statH) / 2;  // vertically centered
      const regions: SlideRegion[] = [];
      for (let i = 0; i < count; i++) {
        regions.push({
          id: `stat-${i}`,
          x: pct(i * (statW + statGap)),
          y: pct(statY),
          w: pct(statW),
          h: pct(statH),
          layer: 0,
        });
      }
      if (input.hasTitle) {
        regions.unshift({ id: 'title', x: 0, y: pct(gutter), w: pct(1), h: pct(titleH * 0.7), layer: 1 });
      }
      return regions;
    }

    case 'metric-grid': {
      const cols = input.metricColumns ?? 3;
      const colGap = gutter;
      const colW = (1 - colGap * (cols - 1)) / cols;
      const bodyY = input.hasTitle ? titleH + gutter : gutter;
      const bodyH = 1 - bodyY - gutter;
      const regions: SlideRegion[] = [];
      if (input.hasTitle) {
        regions.push({ id: 'title', x: 0, y: pct(gutter), w: pct(1), h: pct(titleH - gutter), layer: 1 });
      }
      for (let i = 0; i < cols; i++) {
        regions.push({
          id: `metric-${i}`,
          x: pct(i * (colW + colGap)),
          y: pct(bodyY),
          w: pct(colW),
          h: pct(bodyH),
          layer: 0,
        });
      }
      return regions;
    }

    case 'comparison': {
      const bodyY = titleH + gutter;
      const bodyH = 1 - bodyY - gutter;
      return [
        { id: 'title', x: 0, y: pct(gutter), w: pct(1), h: pct(titleH - gutter), layer: 1 },
        { id: 'body',  x: 0, y: pct(bodyY),  w: pct(1), h: pct(bodyH),           layer: 0 },
      ];
    }

    case 'quote': {
      const quoteH = 0.6;
      const quoteY = (1 - quoteH - 0.1) / 2;
      return [
        { id: 'quote',       x: pct(0.1), y: pct(quoteY),                    w: pct(0.8), h: pct(quoteH), layer: 1 },
        { id: 'attribution', x: pct(0.1), y: pct(quoteY + quoteH + gutter),  w: pct(0.8), h: pct(0.1),    layer: 0 },
      ];
    }

    case 'agenda': {
      const bodyY = titleH + gutter;
      const bodyH = 1 - bodyY - gutter;
      return [
        { id: 'title', x: 0, y: pct(gutter), w: pct(1), h: pct(titleH - gutter), layer: 1 },
        { id: 'body',  x: 0, y: pct(bodyY),  w: pct(1), h: pct(bodyH),           layer: 0 },
      ];
    }

    // Phase 1B+ layouts default to blank
    default:
      return [{ id: 'body', x: 0, y: 0, w: pct(1), h: pct(1), layer: 0 }];
  }
}
