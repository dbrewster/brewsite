// extractInteractionCallbacks.ts — Lightweight DSL callback extraction, decoupled from SceneTrack caching.

import { Children, isValidElement, type ReactElement } from 'react';
import type { SceneDefinition } from './sceneTypes';
import { InteractionCallbackRegistry } from './interactionCallbackRegistry';
import type { CarouselSelectHandler } from '../input/carouselSelectTypes';

// The ViewLayout DSL component reference — imported for identity comparison.
// This avoids a string-based displayName check.
import { ViewLayout } from './blocks/viewLayoutDsl';

/**
 * Minimal context used solely for JSX tree extraction.
 * The actual values are irrelevant — we only need the tree shape.
 */
const EXTRACTION_CONTEXT = {
  sceneIndex: 0,
  numScenes: 0,
  assetsReady: false,
  themeFamily: 'default' as const,
  themePolarity: 'dark' as const,
};

/**
 * Walks scene JSX trees and extracts interaction callbacks into a fresh registry.
 *
 * This function runs on every render, independent of the SceneTrack cache.
 * It ensures onSelect closures always reflect the latest React state,
 * avoiding the stale-closure bug that would occur if callbacks were cached
 * with the SceneTrack.
 *
 * Performance: O(n) where n is the number of JSX nodes across all scenes.
 * In practice this is very fast — scene trees are small (tens to low hundreds
 * of nodes) and we only inspect ViewLayout nodes.
 *
 * @param scenes - The scene definitions containing JSX getFrame() functions.
 * @returns A fresh InteractionCallbackRegistry with all onSelect handlers registered.
 */
export function extractInteractionCallbacks(
  scenes: ReadonlyArray<SceneDefinition>,
): InteractionCallbackRegistry {
  const registry = new InteractionCallbackRegistry();

  for (const scene of scenes) {
    const frame = scene.getFrame(EXTRACTION_CONTEXT);
    walkJsx(frame, registry);
  }

  return registry;
}

/**
 * Recursively walks a JSX tree looking for ViewLayout elements with onSelect.
 */
function walkJsx(node: unknown, registry: InteractionCallbackRegistry): void {
  if (!isValidElement(node)) return;

  const element = node as ReactElement<Record<string, unknown>>;

  // Check if this is a ViewLayout with kind='carousel' and onSelect
  if (element.type === ViewLayout) {
    const props = element.props;
    const onSelect = props.onSelect as CarouselSelectHandler | undefined;
    const layoutId = props.id as string | undefined;
    const kind = props.kind as string | undefined;

    if (onSelect && layoutId && kind === 'carousel') {
      registry.registerSelectHandler(layoutId, onSelect);
    }
  }

  // Recurse into children
  const children = (element.props as { children?: unknown }).children;
  if (children) {
    Children.forEach(children, (child) => walkJsx(child, registry));
  }
}
