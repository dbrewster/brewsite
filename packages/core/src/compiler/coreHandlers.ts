// Centralized registration of all built-in core DSL NodeHandlers.
// Called by corePlugin().registerHandlers() — not at module scope.

import { registerNode } from './registry';
import { Scene, createSceneRootHandler } from './sceneDslCompiler';
import { ensureInputControllerRegistry } from './blocks/inputController';
import { ProgressManager, progressManagerHandler } from './primitives/progressManager';
import { Transition } from './blocks/transition';
import { View } from './blocks/viewDsl';
import { ViewLayout } from './blocks/viewLayoutDsl';
import { viewHandler, viewLayoutHandler } from './blocks/viewHandlers';
import { CarouselScrubber, carouselScrubberNodeHandler } from '../elements/carousel-scrubber/CarouselScrubberWidget';
import { CarouselTray } from '../elements/carousel-scrubber/dsl';
import { Highlight } from '../elements/carousel-scrubber/highlightDsl';

let coreHandlersRegistered = false;

/**
 * Registers all built-in core DSL NodeHandlers.
 * Idempotent — safe to call multiple times.
 * Must be called before any scene compilation begins.
 *
 * Note: Label/Labels guard handlers are now registered by @brewsite/model's
 * registerModelHandlers(), not here.
 * Note: <Transition> is registered here as a no-op guard handler so it compiles
 * without warnings when used as a direct child of <Scene>. Widget-level
 * CUSTOM_NODE_HANDLERs collect and process <Transition> children themselves.
 */
export function registerCoreHandlers(): void {
  if (coreHandlersRegistered) return;
  coreHandlersRegistered = true;

  // Factory pattern — inject viewHandler and DSL component refs into scene root handler.
  // This avoids a circular import between sceneDslCompiler.ts and viewHandlers.ts.
  registerNode(Scene, createSceneRootHandler({ viewHandler, View, ViewLayout }), { category: 'ambient' });
  ensureInputControllerRegistry();
  registerNode(ProgressManager, progressManagerHandler, { category: 'ambient' });
  // No-op: <Transition> children are consumed by parent widget CUSTOM_NODE_HANDLERs.
  // This guard prevents "unregistered DSL component" warnings when Transition appears
  // in unexpected positions.
  registerNode(Transition, (_node, _api, _helpers) => {}, { category: 'ambient' });
  // Category is 'ambient' by convention; constraint enforcement matches View/ViewLayout
  // by type reference, not category.
  registerNode(View, viewHandler, { category: 'ambient' });
  registerNode(ViewLayout, viewLayoutHandler, { category: 'ambient' });
  // 'ambient' category: the scrubber manages its own 3D world positioning
  // and must not be forced inside a <View> when <ViewLayout> is present.
  registerNode(CarouselScrubber, carouselScrubberNodeHandler, { category: 'ambient' });
  // No-op: <CarouselTray> is consumed by viewLayoutHandler as a child component.
  // This guard prevents "unregistered DSL component" warnings.
  registerNode(CarouselTray, (_node, _api, _helpers) => {}, { category: 'ambient' });
  // No-op: <Highlight> is consumed by viewLayoutHandler as a child component.
  // This guard prevents "unregistered DSL component" warnings.
  registerNode(Highlight, (_node, _api, _helpers) => {}, { category: 'ambient' });
}

/**
 * For testing only — resets the registration guard so tests can call
 * registerCoreHandlers() in isolation.
 */
export function resetCoreHandlerRegistrationForTesting(): void {
  coreHandlersRegistered = false;
}
