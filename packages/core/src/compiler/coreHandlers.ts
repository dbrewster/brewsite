// Centralized registration of all built-in core DSL NodeHandlers.
// Called by corePlugin().registerHandlers() — not at module scope.

import { registerNode, getNodeHandler } from './registry';
import { Scene, sceneRootHandler } from './sceneDslCompiler';
import { ensureInputControllerRegistry } from './blocks/inputController';
import { ProgressManager, progressManagerHandler } from './primitives/progressManager';
import { Transition } from './blocks/transition';
import { View } from './blocks/viewDsl';
import { ViewLayout } from './blocks/viewLayoutDsl';
import { viewHandler, viewLayoutHandler } from './blocks/viewHandlers';

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

  if (!getNodeHandler(Scene)) {
    registerNode(Scene, sceneRootHandler);
  }
  ensureInputControllerRegistry();
  if (!getNodeHandler(ProgressManager)) {
    registerNode(ProgressManager, progressManagerHandler);
  }
  if (!getNodeHandler(Transition)) {
    // No-op: <Transition> children are consumed by parent widget CUSTOM_NODE_HANDLERs.
    // This guard prevents "unregistered DSL component" warnings when Transition appears
    // in unexpected positions.
    registerNode(Transition, (_node, _api, _helpers) => {});
  }
  if (!getNodeHandler(View)) {
    registerNode(View, viewHandler);
  }
  if (!getNodeHandler(ViewLayout)) {
    registerNode(ViewLayout, viewLayoutHandler);
  }
}

/**
 * For testing only — resets the registration guard so tests can call
 * registerCoreHandlers() in isolation.
 */
export function resetCoreHandlerRegistrationForTesting(): void {
  coreHandlersRegistered = false;
}
