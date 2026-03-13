// childApi.ts — Factory for a scoped child CompileApi that inherits from a parent
// but overrides composeBounds, composeZ, and composeOpacity for nested view regions.

import type { CompileApi } from './sceneDslTypes';
import type { NVSRect } from '../layout/types';
import { composeBoundsIntoParent } from '../layout/regionNormalize';

/**
 * Creates a child CompileApi that delegates to the parent but overrides composeBounds
 * to compose local coordinates into the given parentContentBounds, composeZ to
 * accumulate Z offsets, and composeOpacity to multiply through opacity scales.
 *
 * Used by viewHandler to create scoped compilation contexts for view children.
 * The child api delegates pushOverlay to the parent so overlay nodes bubble up
 * to the scene root.
 */
export function createChildApi(
  parentApi: CompileApi,
  parentContentBounds: NVSRect,
  zOffset: number = 0,
  opacityScale: number = 1,
): CompileApi & { readonly childWidgetIds: string[] } {
  const childWidgetIds: string[] = [];
  return {
    ...parentApi,
    composeBounds: (localRect: NVSRect): NVSRect => {
      const composed = composeBoundsIntoParent(localRect, parentContentBounds);
      return parentApi.composeBounds(composed);
    },
    composeZ: (localZ: number): number => parentApi.composeZ(localZ + zOffset),
    composeOpacity: (localOpacity: number): number =>
      parentApi.composeOpacity(localOpacity * opacityScale),
    setWidgetState: (widgetId: string, state: unknown): void => {
      childWidgetIds.push(widgetId);
      parentApi.setWidgetState(widgetId, state);
    },
    childWidgetIds,
  };
}
