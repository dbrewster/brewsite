// Topological (edge-driven) hierarchical layout algorithm for diagram nodes.

import type { DiagramNodeDSL, DiagramEdgeDSL } from '../../types';
import type { ResolvedHierarchicalLayout } from '../layoutResolver';

const isFiniteNumber = (value: number): boolean => Number.isFinite(value);

const ensurePair = (
  pair: readonly [number, number],
  fallback: readonly [number, number],
): readonly [number, number] => ([
  isFiniteNumber(pair[0]) ? pair[0] : fallback[0],
  isFiniteNumber(pair[1]) ? pair[1] : fallback[1],
]);

/**
 * Assigns [x, y, z] positions for a hierarchical (edge-driven) layout.
 * Performs a topological sort on edges and assigns depth levels as axis bands.
 * Nodes with explicit positions are preserved; remaining nodes are auto-placed.
 * Returns a Map from node ID to Cartesian [x, y, z] position in diagram units (Y-up).
 */
export function resolveHierarchicalLayout(
  nodes: ReadonlyArray<DiagramNodeDSL>,
  edges: ReadonlyArray<DiagramEdgeDSL>,
  layout: ResolvedHierarchicalLayout,
  defaultNodeSize: readonly [number, number],
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

  if (missing.length === 0) {
    return positions;
  }

  const { spacing, margin: rawMargin, alignment, disconnected, direction } = layout;
  const safeSpacing = ensurePair(spacing, [2, 2]);
  const margin = ensurePair(rawMargin, [0, 0]);

  const nodeIds = nodes.map((node) => node.id);
  const inDegree = new Map<string, number>(nodeIds.map((id) => [id, 0]));
  const adjacency = new Map<string, string[]>();

  edges.forEach((edge) => {
    const from = edge.from;
    const to = edge.to;
    // Only include edges fully inside the current node set.
    // External endpoints can otherwise inflate in-degree for reachable nodes and
    // collapse level assignment into a flat level-0 fallback.
    if (!inDegree.has(from) || !inDegree.has(to)) return;
    if (!adjacency.has(from)) {
      adjacency.set(from, []);
    }
    adjacency.get(from)!.push(to);
    inDegree.set(to, (inDegree.get(to) ?? 0) + 1);
  });

  const connectedNodeIds = new Set<string>();
  edges.forEach((e) => { connectedNodeIds.add(e.from); connectedNodeIds.add(e.to); });
  const isDisconnected = (id: string): boolean => !connectedNodeIds.has(id);

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

  const maxLevel = level.size > 0 ? Math.max(...level.values()) : 0;
  if (disconnected === 'after') {
    missing.forEach((node) => {
      if (isDisconnected(node.id)) {
        level.set(node.id, maxLevel + 1);
      }
    });
  } else {
    nodeIds.forEach((id) => {
      if (!level.has(id)) {
        level.set(id, 0);
      }
    });
  }

  const levels = new Map<number, DiagramNodeDSL[]>();
  missing.forEach((node) => {
    const l = level.get(node.id) ?? 0;
    if (!levels.has(l)) {
      levels.set(l, []);
    }
    levels.get(l)!.push(node);
  });

  const allLevelKeys = [...new Set(nodeIds.map((id) => level.get(id) ?? 0))].sort((a, b) => a - b);
  const isPrimary = direction === 'left-right';

  const levelMaxPrimaryHalf = new Map<number, number>();
  const levelSecondaryDimByNode = new Map<string, number>();
  nodes.forEach((node) => {
    const l = level.get(node.id) ?? 0;
    const [w, h] = node.size ?? defaultNodeSize;
    const primaryHalf = isPrimary ? (w / 2 + margin[0]) : (h / 2 + margin[1]);
    const secondaryDim = isPrimary ? (h + 2 * margin[1]) : (w + 2 * margin[0]);
    levelMaxPrimaryHalf.set(l, Math.max(levelMaxPrimaryHalf.get(l) ?? 0, primaryHalf));
    levelSecondaryDimByNode.set(node.id, secondaryDim);
  });

  // levelCenterPrimary[l] is the center for all nodes at level l on the primary axis.
  // Anchor the hierarchy to an explicit level when possible so auto-placed
  // nodes align with authored coordinates instead of drifting away.
  const levelCenterPrimary = new Map<number, number>();

  const explicitNodes = nodes.filter((n) => !!n.position);
  const explicitLevels = explicitNodes.map((n) => level.get(n.id) ?? 0);
  const minMissingLevel = Math.min(...missing.map((n) => level.get(n.id) ?? 0));

  let anchorLevel = minMissingLevel;
  if (explicitNodes.length > 0) {
    const eligible = explicitNodes.filter((n) => (level.get(n.id) ?? 0) <= minMissingLevel);
    if (eligible.length > 0) {
      anchorLevel = Math.max(...eligible.map((n) => level.get(n.id) ?? 0));
    } else {
      anchorLevel = Math.min(...explicitLevels);
    }
  }

  const anchorNodes = explicitNodes.filter((n) => (level.get(n.id) ?? 0) === anchorLevel);
  const anchorPrimary = anchorNodes.length > 0
    ? anchorNodes.reduce((sum, n) => sum + (n.position?.[isPrimary ? 0 : 1] ?? 0), 0) / anchorNodes.length
    : 0;

  const anchorIndex = allLevelKeys.indexOf(anchorLevel);
  if (anchorIndex === -1) {
    levelCenterPrimary.set(minMissingLevel, 0);
  } else {
    levelCenterPrimary.set(anchorLevel, anchorPrimary);
    const levelGap = isPrimary ? safeSpacing[0] : safeSpacing[1];
    for (let i = anchorIndex + 1; i < allLevelKeys.length; i += 1) {
      const prevL = allLevelKeys[i - 1];
      const currL = allLevelKeys[i];
      const prevH = levelMaxPrimaryHalf.get(prevL) ?? 0;
      const currH = levelMaxPrimaryHalf.get(currL) ?? 0;
      const prevCenter = levelCenterPrimary.get(prevL)!;
      const sign = isPrimary ? 1 : -1;
      levelCenterPrimary.set(currL, prevCenter + sign * (prevH + levelGap + currH));
    }
    for (let i = anchorIndex - 1; i >= 0; i -= 1) {
      const nextL = allLevelKeys[i + 1];
      const currL = allLevelKeys[i];
      const nextH = levelMaxPrimaryHalf.get(nextL) ?? 0;
      const currH = levelMaxPrimaryHalf.get(currL) ?? 0;
      const nextCenter = levelCenterPrimary.get(nextL)!;
      const sign = isPrimary ? 1 : -1;
      levelCenterPrimary.set(currL, nextCenter - sign * (nextH + levelGap + currH));
    }
  }

  const getLevelSecondaryWidth = (
    levelNodes: DiagramNodeDSL[],
    secGap: number,
  ): number => {
    const dims = levelNodes.map((node) => levelSecondaryDimByNode.get(node.id) ?? defaultNodeSize[isPrimary ? 1 : 0]);
    return dims.reduce((sum, d) => sum + d, 0) + Math.max(0, levelNodes.length - 1) * secGap;
  };

  const getWidestLevelWidth = (
    levelsMap: Map<number, DiagramNodeDSL[]>,
    secGap: number,
  ): number => {
    let widest = 0;
    levelsMap.forEach((lvlNodes) => {
      const w = getLevelSecondaryWidth(lvlNodes, secGap);
      if (w > widest) widest = w;
    });
    return widest;
  };

  levels.forEach((levelNodes, l) => {
    const count = levelNodes.length;
    const secGap = isPrimary ? safeSpacing[1] : safeSpacing[0];
    const totalSecWidth = getLevelSecondaryWidth(levelNodes, secGap);
    const widestLevelWidth = getWidestLevelWidth(levels, secGap);

    let levelAlignOffset = 0;
    if (alignment === 'center') levelAlignOffset = -totalSecWidth / 2;
    else if (alignment === 'left') levelAlignOffset = -widestLevelWidth / 2;
    else if (alignment === 'right') levelAlignOffset = widestLevelWidth / 2 - totalSecWidth;

    levelNodes.forEach((node, index) => {
      const primaryVal = levelCenterPrimary.get(l) ?? 0;
      let secVal: number;
      if (alignment === 'fill' && count > 1) {
        secVal = -widestLevelWidth / 2 + index * (widestLevelWidth / (count - 1));
      } else if (alignment === 'fill' && count === 1) {
        secVal = 0;
      } else {
        const firstNode = levelNodes[0];
        const firstDim = firstNode
          ? (levelSecondaryDimByNode.get(firstNode.id) ?? defaultNodeSize[isPrimary ? 1 : 0])
          : 0;
        if (index === 0) {
          secVal = levelAlignOffset + firstDim / 2;
        } else {
          const prevNode = levelNodes[index - 1]!;
          const prevDim = levelSecondaryDimByNode.get(prevNode.id) ?? defaultNodeSize[isPrimary ? 1 : 0];
          const currDim = levelSecondaryDimByNode.get(node.id) ?? defaultNodeSize[isPrimary ? 1 : 0];
          const prevNodePos = positions.get(prevNode.id);
          const prevSecVal = prevNodePos ? (isPrimary ? prevNodePos[1] : prevNodePos[0]) : levelAlignOffset + firstDim / 2;
          secVal = prevSecVal + prevDim / 2 + secGap + currDim / 2;
        }
      }
      const z = node.position?.[2] ?? 0;
      const [x, y] = isPrimary ? [primaryVal, secVal] : [secVal, primaryVal];
      positions.set(node.id, [x, y, z]);
    });
  });

  return positions;
}
