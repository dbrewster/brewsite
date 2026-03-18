// interactionCallbackRegistry.ts — Side-channel for DSL callbacks that cannot be baked into SceneTrack.

import type { CarouselSelectHandler } from '../input/carouselSelectTypes';

/**
 * Registry for interaction callbacks extracted from DSL during compilation.
 *
 * Lifecycle: created fresh on every render by `extractInteractionCallbacks()`.
 * Stored in a `useRef` in `useSceneEngine`. InputCoordinator reads from the ref.
 * NOT cached with the SceneTrack — closures must always reflect current React state.
 *
 * Thread-safe by construction: only one compilation runs at a time, and the
 * registry is consumed by a single InputCoordinator instance.
 */
export class InteractionCallbackRegistry {
  private readonly selectHandlers = new Map<string, CarouselSelectHandler>();

  /**
   * Register a carousel selection handler for a layout.
   * Called by viewLayoutHandler during compilation when onSelect prop is present.
   *
   * @param layoutId - The ViewLayout's stable identity.
   * @param handler - The onSelect callback from DSL props.
   */
  registerSelectHandler(layoutId: string, handler: CarouselSelectHandler): void {
    this.selectHandlers.set(layoutId, handler);
  }

  /**
   * Look up the carousel selection handler for a layout.
   * Returns undefined if no onSelect was declared for this layout.
   */
  getSelectHandler(layoutId: string): CarouselSelectHandler | undefined {
    return this.selectHandlers.get(layoutId);
  }

  /**
   * Returns true if any selection handlers are registered.
   * Used by InputCoordinator to skip selection logic entirely when no handlers exist.
   */
  hasAnySelectHandlers(): boolean {
    return this.selectHandlers.size > 0;
  }

  /** Clears all registered handlers. Called on recompilation. */
  clear(): void {
    this.selectHandlers.clear();
  }
}
