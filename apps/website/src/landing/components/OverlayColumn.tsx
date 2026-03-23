// Centered mobile-first content column for scene overlays.

import type { JSX } from 'react';

/** Props for the OverlayColumn layout component. */
export type OverlayColumnProps = {
  readonly align?: 'center' | 'left';
  readonly vertical?: 'center' | 'bottom' | 'top';
  readonly tone?: 'cool' | 'warm';
  readonly children: React.ReactNode;
};

/**
 * Render the centered mobile-first content column used by scene overlays.
 * Width constrained with responsive max-width; content centered on mobile.
 */
export function OverlayColumn({
  align = 'center',
  vertical = 'center',
  tone = 'cool',
  children,
}: OverlayColumnProps): JSX.Element {
  const shellClass = [
    'scene-shell',
    vertical === 'bottom' && 'scene-shell--bottom',
    vertical === 'top' && 'scene-shell--top',
  ]
    .filter(Boolean)
    .join(' ');

  const columnClass = [
    'overlay-column',
    align === 'left' && 'overlay-column--left',
    tone === 'warm' && 'overlay-column--warm',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={shellClass}>
      <div className={columnClass}>{children}</div>
    </div>
  );
}
