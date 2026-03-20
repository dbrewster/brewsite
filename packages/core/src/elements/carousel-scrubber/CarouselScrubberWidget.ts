// CarouselScrubberWidget — ISceneElement + IRenderable for the 3D carousel scrubber.
// Uses a standalone NodeHandler (registered in coreHandlers) and reconcileCompiledTrack
// for dynamic widget creation (each DSL instance has a unique id prop).

import type * as React from 'react';
import type * as THREE from 'three';
import type {
  ISceneElement,
  IRenderable,
  WidgetInitContext,
  WidgetRenderContext,
} from '../../widget/types';
import type { WidgetRegistry } from '../../widget/WidgetRegistry';
import type { NodeHandler } from '../../compiler/sceneDslTypes';
import type { CarouselScrubberState, ViewHighlightConfig } from './types';
import type { CarouselScrubberProps } from './dsl';
import type { ViewLayoutState } from '../../compiler/viewTypes';
import type { CarouselLayoutConfig } from '../../layout/regionTypes';
import {
  DEFAULT_CAROUSEL_SCRUBBER_STATE,
  carouselScrubberTransitionSpec,
  compileCarouselScrubber,
} from './compile';
import type { CarouselScrubberCache } from './render';
import {
  getOrCreateCache,
  applyCarouselScrubber,
  disposeCarouselScrubber,
} from './render';

/** DSL stub component — renders null; all output is Three.js via apply(). */
export const CarouselScrubber = (_props: CarouselScrubberProps): null => null;
CarouselScrubber.displayName = 'CarouselScrubber';

/**
 * NodeHandler for the CarouselScrubber DSL component.
 *
 * Reads props, resolves ViewLayout state for activeIndex/childCount/loop,
 * and writes compiled CarouselScrubberState keyed by the `id` prop.
 * Registered in coreHandlers.ts via registerNode().
 */
export const carouselScrubberNodeHandler: NodeHandler = (node, api, helpers): void => {
  const props = node.props as CarouselScrubberProps;
  const widgetId = props.id;
  if (!widgetId) return;

  const resolvedProps: CarouselScrubberProps = {
    id: widgetId,
    layoutId: helpers.resolveValue(props.layoutId, api.context),
    showBase: helpers.resolveValue(props.showBase, api.context),
    gap: helpers.resolveValue(props.gap, api.context),
    style: props.style
      ? helpers.resolveObjectValues(props.style as Record<string, unknown>, api.context) as CarouselScrubberProps['style']
      : undefined,
  };

  // Read ViewLayout state to extract carousel metadata.
  const layoutState = api.state.widgets[resolvedProps.layoutId] as ViewLayoutState | undefined;
  let activeIndex = 0;
  let childCount = 0;
  let loop = false;

  if (layoutState) {
    childCount = layoutState.viewIds.length;
    const config = layoutState.layoutConfig as CarouselLayoutConfig | undefined;
    if (config && config.kind === 'carousel') {
      activeIndex = config.activeIndex;
      loop = config.loop ?? false;
    }
  }

  const state = compileCarouselScrubber(resolvedProps, activeIndex, childCount, loop);
  api.setWidgetState(widgetId, state);
};

/**
 * Duck-type guard for CarouselScrubberState.
 * Checks structural fields without instanceof.
 */
export function isCarouselScrubberStateLike(state: unknown): state is CarouselScrubberState {
  if (!state || typeof state !== 'object') return false;
  const s = state as Record<string, unknown>;
  return (
    typeof s['layoutId'] === 'string' &&
    typeof s['activeIndex'] === 'number' &&
    typeof s['childCount'] === 'number' &&
    typeof s['loop'] === 'boolean' &&
    typeof s['showBase'] === 'boolean' &&
    typeof s['gap'] === 'number' &&
    s['style'] !== undefined
  );
}

/**
 * CarouselScrubberWidget — manages a 3D rounded-rectangle tray platform
 * that sits beneath a ViewLayout carousel.
 *
 * Created dynamically by reconcileCompiledTrack when CarouselScrubberState is
 * detected in the compiled SceneTrack. Each DSL instance has a unique widgetId
 * derived from the `id` prop.
 */
export class CarouselScrubberWidget
  implements
    ISceneElement<CarouselScrubberState>,
    IRenderable<CarouselScrubberState>
{
  readonly widgetId: string;

  // -- ISceneElement ----------------------------------------------------------

  readonly defaultState: CarouselScrubberState = DEFAULT_CAROUSEL_SCRUBBER_STATE;
  readonly transitionSpec = carouselScrubberTransitionSpec;
  readonly DslComponent = CarouselScrubber as React.ComponentType<CarouselScrubberProps>;

  mergeSnapshot(
    prev: CarouselScrubberState | undefined,
    next: CarouselScrubberState | undefined,
  ): CarouselScrubberState | undefined {
    if (!prev && !next) return undefined;
    // When the tray's carousel layout is not present in the next scene,
    // set showBase: false to hide the tray. Without this guard, the
    // last-known state from the previous scene persists through the
    // transition merge, and the tray disc remains visible as a "ghost"
    // on scenes that do not use its carousel layout. This is the standard
    // pattern for any widget that should disappear when its scene exits:
    // return a state that makes the widget invisible rather than returning
    // prev unchanged (which would keep stale visuals rendered).
    if (!next && prev) return { ...prev, showBase: false, viewHighlights: [] };
    if (!prev) return next;
    return { ...prev, ...next };
  }

  // -- Constructor ------------------------------------------------------------

  private registry: WidgetRegistry | null;

  constructor(widgetId: string, registry?: WidgetRegistry) {
    this.widgetId = widgetId;
    this.registry = registry ?? null;
  }

  // -- Programmatic highlight API ---------------------------------------------

  /**
   * Runtime highlight overrides — merged with compiled highlights each frame.
   * Keyed by viewId. Set via setHighlight() / clearHighlight().
   */
  private runtimeHighlights = new Map<string, ViewHighlightConfig>();

  /**
   * Programmatically highlight a view. Takes effect on the next render frame.
   * Multiple views can be highlighted simultaneously with different configs.
   * Overrides any compiled highlight for the same viewId.
   *
   * @example
   * const widget = registry.get('myLayout__tray') as CarouselScrubberWidget;
   * widget.setHighlight({ viewId: 'chart-3', mode: 'holographic', color: '#ff0000' });
   */
  setHighlight(config: ViewHighlightConfig): void {
    this.runtimeHighlights.set(config.viewId, config);
  }

  /**
   * Remove a programmatic highlight from a view.
   */
  clearHighlight(viewId: string): void {
    this.runtimeHighlights.delete(viewId);
  }

  /**
   * Remove all programmatic highlights.
   */
  clearAllHighlights(): void {
    this.runtimeHighlights.clear();
  }

  /**
   * Returns the current runtime highlights (read-only snapshot).
   */
  getHighlights(): ReadonlyMap<string, ViewHighlightConfig> {
    return this.runtimeHighlights;
  }

  // -- IRenderable ------------------------------------------------------------

  private threeScene: THREE.Scene | null = null;
  private cache: CarouselScrubberCache | null = null;

  initialize({ scene }: WidgetInitContext): void {
    this.threeScene = scene as THREE.Scene;
    this.cache = getOrCreateCache(scene as THREE.Scene, this.widgetId);
  }

  apply(state: CarouselScrubberState, ctx: WidgetRenderContext): void {
    if (!this.cache || !this.threeScene) return;

    // Hide ghost tray widgets that have no active layout.
    // During transitions a tray widget can persist with empty layoutId
    // and default style — if not hidden it overlaps the real tray mesh
    // causing z-fighting interference patterns.
    // No early return here — applyCarouselScrubber handles the
    // childCount === 0 / layoutId === '' case and properly disposes
    // highlight meshes that are parented to the scene (not cache.root).

    const materialLoader = this.registry?.getMaterialLoader();
    const materialManifest = this.registry?.getMaterialManifest() ?? undefined;
    // Pass the current tick's widget states so followView highlights can
    // look up live view bounds at render time.
    const tickWidgetStates = ctx.tick?.state?.widgets ?? null;
    applyCarouselScrubber(
      state,
      this.cache,
      this.threeScene,
      ctx.coords,
      materialLoader,
      materialManifest,
      tickWidgetStates,
      this.runtimeHighlights.size > 0 ? this.runtimeHighlights : null,
      this.registry,
    );
  }

  dispose(): void {
    if (this.threeScene && this.cache) {
      disposeCarouselScrubber(this.threeScene, this.cache, this.widgetId);
    }
    this.threeScene = null;
    this.cache = null;
  }
}
