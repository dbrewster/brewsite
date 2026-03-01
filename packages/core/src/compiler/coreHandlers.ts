// Centralized registration of all built-in core DSL NodeHandlers.
// Called by corePlugin().registerHandlers() — not at module scope.

import { registerNode, getNodeHandler } from './registry';
import { Scene, sceneRootHandler } from './sceneDslCompiler';
import { ensureInputControllerRegistry } from './blocks/inputController';
import { ProgressManager, progressManagerHandler } from './primitives/progressManager';
import { Label, Labels } from '../labels/dsl';

let coreHandlersRegistered = false;

/**
 * Registers all built-in core DSL NodeHandlers.
 * Idempotent — safe to call multiple times.
 * Must be called before any scene compilation begins.
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

  // Temporary protective guards for Label/Labels at the top-level DSL.
  // In Phase 4, these registrations move to @brewsite/model's registerModelHandlers().
  if (!getNodeHandler(Label)) {
    registerNode(Label, () => {
      throw new Error('<Label> must be nested under <BodyPart> or <Subpart>.');
    });
  }
  if (!getNodeHandler(Labels)) {
    registerNode(Labels, () => {
      throw new Error('<Labels> is not supported. Use <Label> under <BodyPart> or <Subpart>.');
    });
  }
}

/**
 * For testing only — resets the registration guard so tests can call
 * registerCoreHandlers() in isolation.
 */
export function resetCoreHandlerRegistrationForTesting(): void {
  coreHandlersRegistered = false;
}
