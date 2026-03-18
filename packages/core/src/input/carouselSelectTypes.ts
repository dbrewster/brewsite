// carouselSelectTypes.ts — Type contracts for carousel selection events.

/**
 * Source that triggered a carousel selection event.
 * - 'pointer': mouse click or touch tap within carousel bounds.
 * - 'keyboard': Enter or Space key while carousel has keyboard focus.
 * - 'programmatic': selection triggered via code (e.g., clearCarouselSelection).
 */
export type CarouselSelectSource = 'pointer' | 'keyboard' | 'programmatic';

/**
 * Rich event dispatched when a carousel item is selected.
 * Modeled after DOM Event with a custom preventDefault().
 *
 * When preventDefault() is called, the event does NOT propagate to the
 * ActionInputController's normal click dispatch waterfall. This allows
 * consumers to handle selection exclusively (e.g., navigate to a scene)
 * without also triggering any PointerMap click actions.
 */
export type CarouselSelectEvent = {
  /** 0-based index of the selected (focused) carousel item. */
  readonly index: number;

  /** Widget ID of the selected View (from ViewLayout.viewIds[index]). */
  readonly viewId: string;

  /** Widget ID of the ViewLayout that fired this event. */
  readonly layoutId: string;

  /** Number of child views in the carousel. */
  readonly childCount: number;

  /**
   * NVS (Normalized Viewport Space, [0..1]) pointer position at the moment of selection.
   * Null for keyboard and programmatic sources.
   * Consistent with ViewLayout bounds and View bounds coordinate system.
   */
  readonly position: { readonly x: number; readonly y: number } | null;

  /** What triggered this selection. */
  readonly source: CarouselSelectSource;

  /**
   * Call to prevent the event from propagating to the normal
   * ActionInputController click dispatch waterfall.
   */
  preventDefault(): void;

  /** True after preventDefault() has been called. */
  readonly defaultPrevented: boolean;
};

/**
 * Handler type for carousel selection events.
 * Stored in the InteractionCallbackRegistry, keyed by layoutId.
 */
export type CarouselSelectHandler = (event: CarouselSelectEvent) => void;

/**
 * Factory function to create a CarouselSelectEvent instance.
 * Used by InputCoordinator when dispatching selection events.
 */
export function createCarouselSelectEvent(
  index: number,
  viewId: string,
  layoutId: string,
  childCount: number,
  position: { x: number; y: number } | null,
  source: CarouselSelectSource,
): CarouselSelectEvent {
  let _defaultPrevented = false;
  return {
    index,
    viewId,
    layoutId,
    childCount,
    position,
    source,
    preventDefault() { _defaultPrevented = true; },
    get defaultPrevented() { return _defaultPrevented; },
  };
}
