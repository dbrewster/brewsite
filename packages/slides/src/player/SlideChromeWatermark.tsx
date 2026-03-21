// Renders the master slide watermark chrome element from a SlideTemplate.

import React, { type CSSProperties, type ReactElement } from 'react';
import type { SlideTemplate } from '../types';

/** Props for the SlideChromeWatermark component. */
export type SlideChromeWatermarkProps = {
  template: SlideTemplate;
};

/**
 * Renders a centered watermark overlay on every slide (master chrome).
 * Uses text or image based on template configuration.
 */
export const SlideChromeWatermark = ({ template }: SlideChromeWatermarkProps): ReactElement | null => {
  const watermarkConfig = template.master?.watermark;
  if (!watermarkConfig) return null;

  const opacity = `var(--slide-watermark-opacity, ${watermarkConfig.opacity ?? 0.05})`;

  const baseStyle: CSSProperties = {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    pointerEvents: 'none',
    opacity: opacity as unknown as number,
  };

  if (watermarkConfig.image) {
    return (
      <div style={baseStyle} aria-hidden>
        <img
          src={watermarkConfig.image}
          alt=""
          style={{ maxWidth: '40%', maxHeight: '40%', objectFit: 'contain' }}
        />
      </div>
    );
  }

  if (watermarkConfig.text) {
    return (
      <div
        style={{
          ...baseStyle,
          fontSize: '6vw',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          color: 'var(--brewsite-text-muted, rgba(255,255,255,0.3))',
          userSelect: 'none',
        }}
        aria-hidden
      >
        {watermarkConfig.text}
      </div>
    );
  }

  return null;
};
SlideChromeWatermark.displayName = 'SlideChromeWatermark';
