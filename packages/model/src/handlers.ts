// DSL NodeHandler registration for @brewsite/model DSL components.

import { registerNode, getNodeHandler } from '@brewsite/core';
import { Label, Labels } from './labels/dsl';
// Model DSL components are handled via CUSTOM_NODE_HANDLER on ModelWidget instances.
// Label guard handlers are registered here to produce clear error messages.

let modelHandlersRegistered = false;

/**
 * Registers DSL NodeHandlers for all @brewsite/model DSL components.
 * Idempotent — safe to call multiple times.
 *
 * Must be called before any scene that uses <Model>, <Label>, or related
 * components is compiled. Call via modelPlugin().registerHandlers() or
 * explicitly from registerModelHandlers() before WidgetRegistry creation.
 */
export function registerModelHandlers(): void {
  if (modelHandlersRegistered) return;
  modelHandlersRegistered = true;

  // Protective top-level guards for label DSL components.
  // These throw if <Label> or <Labels> appears outside of a <BodyPart>/<Subpart>.
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
  // Model DSL routing (ModelRouter, BodyPart, BodyParts, etc.) is registered
  // via CUSTOM_NODE_HANDLER on each ModelWidget instance, not here. The
  // WidgetRegistry.registerTypeFactory() call in modelPlugin installs the
  // routing handler on first ModelRouter encounter.
}

export function resetModelHandlerRegistrationForTesting(): void {
  modelHandlersRegistered = false;
}
