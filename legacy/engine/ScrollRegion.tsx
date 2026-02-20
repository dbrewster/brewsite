import type { Ref } from 'react';

type ScrollRegionProps = {
  ref: Ref<HTMLDivElement>;
  heightPx: number;
};

/**
 * Thin scroll-spacer div. Place inside the scroll container to set the scroll height.
 * Pointer events disabled — it exists only to drive scroll position.
 */
export const ScrollRegion = ({ ref, heightPx }: ScrollRegionProps) => (
  <div
    ref={ref}
    aria-hidden="true"
    className="robot-scroll-region"
    style={{ height: `${heightPx}px`, pointerEvents: 'none' }}
  />
);
