// Layout algorithms extracted from compile.ts.
// Pure functions only — no Three.js, no React.

import type { DiagramNodeDSL, DiagramEdgeDSL } from '../types';

/**
 * Assigns [x, y, z] positions to nodes that have no explicit position.
 * For the 'grid' layout, places nodes left-to-right in rows of ~4 nodes.
 * For the 'hierarchical' layout, performs a topological sort on edges and assigns
 * depth levels as Y-axis bands.
 * For 'manual', all nodes must have explicit positions — throws on missing position.
 */
export function resolveLayout(
  nodes: ReadonlyArray<DiagramNodeDSL>,
  edges: ReadonlyArray<DiagramEdgeDSL>,
  layout: 'manual' | 'grid' | 'hierarchical',
  spacing: [number, number],
): Map<string, readonly [number, number, number]> {
  const positions = new Map<string, readonly [number, number, number]>();
  const missing: DiagramNodeDSL[] = [];

  nodes.forEach((node) => {
    if (node.position) {
      positions.set(node.id, node.position);
    } else {
      missing.push(node);
    }
  });

  if (layout === 'manual') {
    const nonGhostMissing = missing.filter((n) => !!n.label);
    if (nonGhostMissing.length > 0) {
      throw new Error(
        'Diagram layout is manual but one or more non-ghost nodes are missing positions. ' +
          'Ghost nodes (no label prop) may omit position — it will be inherited from the previous scene.',
      );
    }
    return positions;
  }

  if (missing.length === 0) {
    return positions;
  }

  const DEFAULT_NODE_SIZE: [number, number] = [4, 2];
  const maxWidth = Math.max(
    ...missing.map((node) => (node.size ?? DEFAULT_NODE_SIZE)[0]),
  );
  const maxHeight = Math.max(
    ...missing.map((node) => (node.size ?? DEFAULT_NODE_SIZE)[1]),
  );

  if (layout === 'grid') {
    const cols = 4;
    missing.forEach((node, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      const x = col * (maxWidth + spacing[0]);
      const y = -row * (maxHeight + spacing[1]);
      const z = node.position?.[2] ?? 0;
      positions.set(node.id, [x, y, z]);
    });
    return positions;
  }

  const nodeIds = nodes.map((node) => node.id);
  const inDegree = new Map<string, number>(nodeIds.map((id) => [id, 0]));
  const adjacency = new Map<string, string[]>();

  edges.forEach((edge) => {
    const from = edge.from;
    const to = edge.to;
    if (!adjacency.has(from)) {
      adjacency.set(from, []);
    }
    adjacency.get(from)!.push(to);
    if (inDegree.has(to)) {
      inDegree.set(to, (inDegree.get(to) ?? 0) + 1);
    }
  });

  const queue: string[] = [];
  inDegree.forEach((count, id) => {
    if (count === 0) {
      queue.push(id);
    }
  });

  const level = new Map<string, number>();
  const visitQueue = queue.length > 0 ? queue : [...nodeIds];

  while (visitQueue.length > 0) {
    const id = visitQueue.shift()!;
    if (!level.has(id)) {
      level.set(id, 0);
    }
    const neighbors = adjacency.get(id) ?? [];
    neighbors.forEach((neighbor) => {
      const nextLevel = (level.get(id) ?? 0) + 1;
      if (!level.has(neighbor) || nextLevel > (level.get(neighbor) ?? 0)) {
        level.set(neighbor, nextLevel);
      }
      const newDegree = (inDegree.get(neighbor) ?? 1) - 1;
      inDegree.set(neighbor, newDegree);
      if (newDegree === 0) {
        visitQueue.push(neighbor);
      }
    });
  }

  nodeIds.forEach((id) => {
    if (!level.has(id)) {
      level.set(id, 0);
    }
  });

  const levels = new Map<number, DiagramNodeDSL[]>();
  missing.forEach((node) => {
    const l = level.get(node.id) ?? 0;
    if (!levels.has(l)) {
      levels.set(l, []);
    }
    levels.get(l)!.push(node);
  });

  levels.forEach((levelNodes, l) => {
    const count = levelNodes.length;
    const totalWidth = count * maxWidth + (count - 1) * spacing[0];
    const startX = -totalWidth / 2 + maxWidth / 2;
    levelNodes.forEach((node, index) => {
      const x = startX + index * (maxWidth + spacing[0]);
      const y = -l * (maxHeight + spacing[1]);
      const z = node.position?.[2] ?? 0;
      positions.set(node.id, [x, y, z]);
    });
  });

  return positions;
}

/**
 * Computes the bounding box of a set of nodes (resolved positions + sizes).
 * Used by compileDiagram for the overall bounds and by compileGroup for group bounds.
 */
export function computeBounds(
  nodeIds: ReadonlyArray<string>,
  positions: Map<string, readonly [number, number, number]>,
  sizes: Map<string, readonly [number, number] | readonly [number, number, number]>,
): { x: number; y: number; w: number; h: number; minZ: number; maxZ: number } {
  if (nodeIds.length === 0) {
    return { x: 0, y: 0, w: 0, h: 0, minZ: 0, maxZ: 0 };
  }

  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  let minZ = Number.POSITIVE_INFINITY;
  let maxZ = Number.NEGATIVE_INFINITY;

  nodeIds.forEach((id) => {
    const position = positions.get(id);
    const size = sizes.get(id);
    if (!position || !size) {
      return;
    }
    const [x, y, z] = position;
    const [w, h] = size;
    const d = size.length > 2 ? size[2] ?? 0 : 0;
    minX = Math.min(minX, x - w / 2);
    maxX = Math.max(maxX, x + w / 2);
    minY = Math.min(minY, y - h / 2);
    maxY = Math.max(maxY, y + h / 2);
    minZ = Math.min(minZ, z - d / 2);
    maxZ = Math.max(maxZ, z + d / 2);
  });

  if (!Number.isFinite(minX) || !Number.isFinite(minY)) {
    return { x: 0, y: 0, w: 0, h: 0, minZ: 0, maxZ: 0 };
  }

  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY, minZ, maxZ };
}
