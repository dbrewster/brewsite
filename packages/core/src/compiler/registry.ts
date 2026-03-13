// registry.ts — NodeHandler registration, lookup, and category storage.
// The category map enforces the Scene view constraint at compile time.

import type { NodeHandler, NodeHandlerCategory, RegisterNodeOptions } from './sceneDslTypes';

const nodeRegistry = new Map<unknown, NodeHandler>();
const nodeRegistryByName = new Map<string, NodeHandler>();

// Parallel map stores the category for each registered component.
// Components not present default to 'spatial' (the safe default).
const nodeCategoryRegistry = new Map<unknown, NodeHandlerCategory>();
const nodeCategoryRegistryByName = new Map<string, NodeHandlerCategory>();

export const registerNode = (
  component: unknown,
  handler: NodeHandler,
  options?: RegisterNodeOptions,
): void => {
  nodeRegistry.set(component, handler);
  if (options?.category) {
    nodeCategoryRegistry.set(component, options.category);
  }
  if (typeof component === 'function') {
    const name = (component as { displayName?: string; name?: string }).displayName
      ?? (component as { name?: string }).name;
    if (name) {
      nodeRegistryByName.set(name, handler);
      if (options?.category) {
        nodeCategoryRegistryByName.set(name, options.category);
      }
    }
  }
};

export const getNodeHandler = (component: unknown): NodeHandler | undefined => {
  if (nodeRegistry.has(component)) return nodeRegistry.get(component);
  if (typeof component === 'function') {
    const name = (component as { displayName?: string; name?: string }).displayName
      ?? (component as { name?: string }).name;
    if (name) return nodeRegistryByName.get(name);
  }
  return undefined;
};

/**
 * Returns the NodeHandlerCategory for a registered component.
 * Returns 'spatial' (the default) for any component that is registered but
 * has no explicit category set, or for any unregistered component.
 */
export const getHandlerCategory = (component: unknown): NodeHandlerCategory => {
  if (nodeCategoryRegistry.has(component)) {
    return nodeCategoryRegistry.get(component)!;
  }
  if (typeof component === 'function') {
    const name = (component as { displayName?: string; name?: string }).displayName
      ?? (component as { name?: string }).name;
    if (name && nodeCategoryRegistryByName.has(name)) {
      return nodeCategoryRegistryByName.get(name)!;
    }
  }
  return 'spatial';
};

export const isPrimitiveComponent = (component: unknown): boolean =>
  Boolean(getNodeHandler(component));

export const clearRegistry = (): void => {
  nodeRegistry.clear();
  nodeRegistryByName.clear();
  nodeCategoryRegistry.clear();
  nodeCategoryRegistryByName.clear();
};
