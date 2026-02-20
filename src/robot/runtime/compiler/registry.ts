import type {NodeHandler} from './sceneDslTypes';

export const nodeRegistry = new Map<unknown, NodeHandler>();
const nodeRegistryByName = new Map<string, NodeHandler>();

export const registerNode = (nodeType: unknown, handler: NodeHandler) => {
  nodeRegistry.set(nodeType, handler);
  if (typeof nodeType === 'function') {
    const typeName = (nodeType as { displayName?: string; name?: string }).displayName ?? (nodeType as { name?: string }).name;
    if (typeName) nodeRegistryByName.set(typeName, handler);
  }
};

export const getNodeHandler = (nodeType: unknown) => {
  const direct = nodeRegistry.get(nodeType);
  if (direct) return direct;
  if (typeof nodeType === 'function') {
    const typeName = (nodeType as { displayName?: string; name?: string }).displayName ?? (nodeType as { name?: string }).name;
    if (typeName) return nodeRegistryByName.get(typeName);
  }
  return undefined;
};

export const isPrimitiveComponent = (nodeType: unknown) =>
  Boolean(getNodeHandler(nodeType));
