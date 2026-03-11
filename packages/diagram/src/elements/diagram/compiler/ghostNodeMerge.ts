// ghostNodeMerge.ts — pure ghost node state merge logic extracted from widget.ts.

import type { DiagramNodeState, DiagramState } from '../types';

/**
 * Merges ghost-node properties from `prev` into `next`.
 *
 * A node is a ghost when `node.label === undefined`. Ghost nodes inherit visual
 * identity (label, sublabel, shape, iconUrl, iconScale, sublabelColor) from the
 * matching node in `prev`. Nodes with `positionInherited === true` additionally
 * inherit position, size, and thickness.
 *
 * Returns `next` unchanged if no merging is needed (avoids unnecessary allocation).
 * Returns `undefined` if `next` is `undefined`.
 */
export function mergeGhostNodeSnapshot(
  prev: DiagramState | undefined,
  next: DiagramState | undefined,
): DiagramState | undefined {
  if (!next) return next;
  if (!prev) return next;

  let anyChanged = false;
  const mergedNodes = next.nodes.map((node): DiagramNodeState => {
    // Fully-declared node: no merge needed.
    if (node.label !== undefined && !node.positionInherited) return node;

    const prevNode = prev.nodes.find((p) => p.id === node.id);
    if (!prevNode) return node;

    anyChanged = true;
    return {
      ...node,
      // Visual identity (ghost nodes only — when label is undefined).
      label:         node.label !== undefined ? node.label         : prevNode.label,
      sublabel:      node.label !== undefined ? node.sublabel      : prevNode.sublabel,
      shape:         node.label !== undefined ? node.shape         : prevNode.shape,
      iconUrl:       node.label !== undefined ? node.iconUrl       : prevNode.iconUrl,
      iconScale:     node.label !== undefined ? node.iconScale     : prevNode.iconScale,
      sublabelColor: node.label !== undefined ? node.sublabelColor : prevNode.sublabelColor,
      // Layout geometry (only when DSL omitted position entirely).
      position:  node.positionInherited ? prevNode.position  : node.position,
      size:      node.positionInherited ? prevNode.size      : node.size,
      thickness: node.positionInherited ? prevNode.thickness : node.thickness,
      // Clear the flag — the state is now fully resolved.
      positionInherited: undefined,
    };
  });

  // Avoid allocating a new state object when nothing actually changed.
  return anyChanged ? { ...next, nodes: mergedNodes } : next;
}
