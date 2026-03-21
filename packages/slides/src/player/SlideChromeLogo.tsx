// Renders the master slide logo chrome element from a SlideTemplate.

import React, { type CSSProperties, type ReactElement } from 'react';
import type { SlideTemplate, SlideLayout } from '../types';

/** Props for the SlideChromeLogo component. */
export type SlideChromeLogoProps = {
  template: SlideTemplate;
  currentLayout?: SlideLayout;
};

/** Position map for CSS absolute placement. */
const POSITION_STYLES: Record<string, CSSProperties> = {
  'top-left': { top: '12px', left: '12px' },
  'top-right': { top: '12px', right: '12px' },
  'bottom-left': { bottom: 'calc(var(--slide-footer-height, 0px) + 12px)', left: '12px' },
  'bottom-right': { bottom: 'calc(var(--slide-footer-height, 0px) + 12px)', right: '12px' },
};

/**
 * Renders the branded logo on every slide (master chrome).
 * Hides itself on excluded layouts.
 */
export const SlideChromeLogo = ({ template, currentLayout }: SlideChromeLogoProps): ReactElement | null => {
  const logoConfig = template.master?.logo;
  if (!logoConfig) return null;

  // Check layout exclusion
  if (currentLayout && logoConfig.excludeLayouts?.includes(currentLayout)) {
    return null;
  }

  // Resolve brand asset
  const assetKey = logoConfig.asset;
  const asset = template.brand?.[assetKey];
  if (!asset) return null;

  const posStyle = POSITION_STYLES[logoConfig.position] ?? POSITION_STYLES['top-left']!;

  const style: CSSProperties = {
    position: 'absolute',
    zIndex: 20,
    ...posStyle,
    width: 'var(--slide-logo-size, 40px)',
    height: 'auto',
    opacity: logoConfig.opacity ?? 1,
    pointerEvents: 'none',
  };

  return (
    <img
      src={asset.src}
      alt={asset.alt ?? ''}
      style={style}
      aria-hidden
    />
  );
};
SlideChromeLogo.displayName = 'SlideChromeLogo';
