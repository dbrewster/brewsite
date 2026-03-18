// registry.ts — NodeHandler registration, lookup, and category storage.
// The category map enforces the Scene view constraint at compile time.

import type { NodeHandler, NodeHandlerCategory, RegisterNodeOptions } from './sceneDslTypes';

/** Composite entry combining a handler with its optional category. */
type RegistryEntry = {
  readonly handler: NodeHandler;
  readonly category: NodeHandlerCategory | undefined;
};

const nodeRegistry = new Map<unknown, RegistryEntry>();
const nodeRegistryByName = new Map<string, RegistryEntry>();

/** Extracts the display name or function name from a component reference. */
const getComponentDisplayName = (component: unknown): string | undefined => {
  if (typeof component !== 'function') return undefined;
  return (component as { displayName?: string; name?: string }).displayName
    ?? (component as { name?: string }).name;
};

export const registerNode = (
  component: unknown,
  handler: NodeHandler,
  options?: RegisterNodeOptions,
): void => {
  const entry: RegistryEntry = { handler, category: options?.category };
  nodeRegistry.set(component, entry);
  const name = getComponentDisplayName(component);
  if (name) {
    nodeRegistryByName.set(name, entry);
  }
};

export const getNodeHandler = (component: unknown): NodeHandler | undefined => {
  const entry = nodeRegistry.get(component);
  if (entry) return entry.handler;
  const name = getComponentDisplayName(component);
  if (name) return nodeRegistryByName.get(name)?.handler;
  return undefined;
};

/**
 * Returns the NodeHandlerCategory for a registered component.
 * Returns 'spatial' (the default) for any component that is registered but
 * has no explicit category set, or for any unregistered component.
 */
export const getHandlerCategory = (component: unknown): NodeHandlerCategory => {
  const entry = nodeRegistry.get(component);
  if (entry?.category) return entry.category;
  const name = getComponentDisplayName(component);
  if (name) {
    const namedEntry = nodeRegistryByName.get(name);
    if (namedEntry?.category) return namedEntry.category;
  }
  return 'spatial';
};

export const isPrimitiveComponent = (component: unknown): boolean =>
  Boolean(getNodeHandler(component));

export const clearRegistry = (): void => {
  nodeRegistry.clear();
  nodeRegistryByName.clear();
};
