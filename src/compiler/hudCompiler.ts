// Compiles HudItemDefinition[] into HudItemResolved[] for a single scene tick.
// Currently a pass-through filter; the dedicated function is the stable seam for
// future defaulting, merging, or style-resolution logic.

import type { HudItemDefinition, HudItemResolved } from '../hud/types';

/**
 * Compiles a scene's hudItems into resolved HUD primitives.
 * Items with enabled === false are excluded.
 * Returns an empty array for undefined or empty input.
 */
export const compileHudItems = (
  items: HudItemDefinition[] | undefined,
): HudItemResolved[] => {
  if (!items || items.length === 0) return [];
  return items.filter((item) => item.enabled !== false);
};
