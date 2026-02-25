// Compiles HudItemDefinition[] into HudItemResolved[] for a single scene tick.
// Currently a pass-through filter; the dedicated function is the stable seam for
// future defaulting, merging, or style-resolution logic.

import type { HudItemDefinition, HudItemResolved, HudPhase } from '../hud/types';

export type CompileHudOptions = {
  sceneId?: string;
  phase?: HudPhase;
};

/**
 * Compiles a scene's hudItems into resolved HUD primitives.
 * Items with enabled === false are excluded.
 * Returns an empty array for undefined or empty input.
 */
export const compileHudItems = (
  items: HudItemDefinition[] | undefined,
  options?: CompileHudOptions,
): HudItemResolved[] => {
  if (!items || items.length === 0) return [];
  const sceneId = options?.sceneId ?? 'scene';
  const phase = options?.phase;
  return items
    .filter((item) => item.enabled !== false)
    .map((item, index) => ({
      ...item,
      phase,
      instanceId: `${sceneId}:${item.id}:${index}`,
    }));
};
