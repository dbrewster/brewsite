// Renders all resolved HUD items from the current tick into the DOM overlay layer.

import type { ReactElement } from 'react';
import type { HudItemResolved } from './types';
import { HudItem } from './HudItem';

export type HudOverlayProps = {
  /** The hudPrimitives from the current SceneTrackTick. Pass [] when tick is null. */
  items: HudItemResolved[];
};

/**
 * Maps a tick's hudPrimitives into a flat set of HudItem components.
 * Renders as a React Fragment — no wrapping element.
 */
export const HudOverlay = ({ items }: HudOverlayProps): ReactElement => {
  return (
    <>
      {items.map((item) => (
        <HudItem key={item.instanceId ?? item.id} item={item} />
      ))}
    </>
  );
};
