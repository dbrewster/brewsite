// Centralized registration of all built-in core DSL NodeHandlers.
// Called by corePlugin().registerHandlers() — not at module scope.

import { registerNode, getNodeHandler } from './registry';
import { Scene, sceneRootHandler } from './sceneDslCompiler';
import { ensureInputControllerRegistry } from './blocks/inputController';
import { ProgressManager, progressManagerHandler } from './primitives/progressManager';

let coreHandlersRegistered = false;

/**
 * Registers all built-in core DSL NodeHandlers.
 * Idempotent — safe to call multiple times.
 * Must be called before any scene compilation begins.
 *
 * Note: Label/Labels guard handlers are now registered by @brewsite/model's
 * registerModelHandlers(), not here.
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
}

/**
 * For testing only — resets the registration guard so tests can call
 * registerCoreHandlers() in isolation.
 */
export function resetCoreHandlerRegistrationForTesting(): void {
  coreHandlersRegistered = false;
}
