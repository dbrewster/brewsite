// Renders the master slide footer chrome element from a SlideTemplate.

import React, { type CSSProperties, type ReactElement } from 'react';
import type { SlideTemplate, SlideLayout } from '../types';

/** Props for the SlideChromeFooter component. */
export type SlideChromeFooterProps = {
  template: SlideTemplate;
  currentIndex: number;
  totalSlides: number;
  currentLayout?: SlideLayout;
};

/** Position map for footer text alignment. */
const ALIGN_MAP: Record<string, CSSProperties['textAlign']> = {
  'bottom-left': 'left',
  'bottom-center': 'center',
  'bottom-right': 'right',
};

/**
 * Renders the footer bar on every slide (master chrome).
 * Shows optional text, page numbers, and date.
 */
export const SlideChromeFooter = ({
  template,
  currentIndex,
  totalSlides,
  currentLayout,
}: SlideChromeFooterProps): ReactElement | null => {
  const footerConfig = template.master?.footer;
  if (!footerConfig) return null;

  // Check layout exclusion
  if (currentLayout && footerConfig.excludeLayouts?.includes(currentLayout)) {
    return null;
  }

  const align = ALIGN_MAP[footerConfig.position ?? 'bottom-center'] ?? 'center';

  const style: CSSProperties = {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 'var(--slide-footer-height, 32px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: align === 'left' ? 'flex-start' : align === 'right' ? 'flex-end' : 'center',
    gap: '16px',
    padding: '0 16px',
    zIndex: 20,
    fontSize: '12px',
    color: 'var(--brewsite-text-muted, rgba(255,255,255,0.5))',
    pointerEvents: 'none',
  };

  const parts: string[] = [];
  if (footerConfig.text) parts.push(footerConfig.text);
  if (footerConfig.showDate) parts.push(new Date().toLocaleDateString());
  if (footerConfig.showPageNumbers) parts.push(`${currentIndex + 1} / ${totalSlides}`);

  if (parts.length === 0) return null;

  return (
    <div style={style} aria-hidden>
      {parts.map((part, i) => (
        <span key={i}>{part}</span>
      ))}
    </div>
  );
};
SlideChromeFooter.displayName = 'SlideChromeFooter';
