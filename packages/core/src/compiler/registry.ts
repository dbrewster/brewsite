import type { NodeHandler } from './sceneDslTypes';

const nodeRegistry = new Map<unknown, NodeHandler>();
const nodeRegistryByName = new Map<string, NodeHandler>();

export const registerNode = (component: unknown, handler: NodeHandler): void => {
  nodeRegistry.set(component, handler);
  if (typeof component === 'function') {
    const name = (component as { displayName?: string; name?: string }).displayName
      ?? (component as { name?: string }).name;
    if (name) nodeRegistryByName.set(name, handler);
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

export const isPrimitiveComponent = (component: unknown): boolean =>
  Boolean(getNodeHandler(component));

export const clearRegistry = (): void => {
  nodeRegistry.clear();
  nodeRegistryByName.clear();
};
