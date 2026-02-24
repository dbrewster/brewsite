// Renders a single resolved HUD item as a positioned DOM container.

import type { ReactElement } from 'react';
import type { HudItemResolved } from './types';

export type HudItemProps = {
  item: HudItemResolved;
};

/**
 * Renders a single HUD item as a div with data-hud-id, className, and style.
 * Returns null when enabled === false (already filtered by compiler, but defensive).
 * All layout/positioning is CSS-owned by the consuming application.
 */
export const HudItem = ({ item }: HudItemProps): ReactElement | null => {
  if (item.enabled === false) return null;
  return (
    <div
      data-hud-id={item.id}
      className={item.className}
      style={item.style}
    >
      {item.node}
    </div>
  );
};
