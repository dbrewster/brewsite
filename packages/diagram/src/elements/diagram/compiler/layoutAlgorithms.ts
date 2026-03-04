// Layout algorithms extracted from compile.ts.
// Pure functions only — no Three.js, no React.

import type { DiagramNodeDSL, DiagramEdgeDSL, DiagramGroupDSL, DiagramWarnFn } from '../types';
import {
  DEFAULT_RESOLVED_GRID,
} from './layoutResolver';
import type { ResolvedLayout, ResolvedGridLayout, ResolvedHierarchicalLayout, ResolvedFlowLayout } from './layoutResolver';

/**
 * Assigns [x, y, z] positions to all items in declaration order along a single axis.
 * Items are placed edge-to-edge with `layout.gap` empty space between adjacent footprints.
 * Secondary axis is always 0 (center-aligned).
 *
 * Items with explicit positions are preserved. The cursor advances past their footprint
 * so that subsequent auto-placed items maintain correct edge-to-edge spacing.
 *
 * Items present in `nodes` but absent from `childrenOrder` are appended defensively
 * in node-array order (handles old compiled data without childrenOrder).
 */
export function resolveFlowLayout(
  nodes: ReadonlyArray<DiagramNodeDSL>,
  layout: ResolvedFlowLayout,
  childrenOrder: ReadonlyArray<string>,
): Map<string, readonly [number, number, number]> {
  const positions = new Map<string, readonly [number, number, number]>();
  const DEFAULT_NODE_SIZE: readonly [number, number] = [4, 2];
  const isTopDown = layout.direction !== 'left-right';
  const gap = layout.gap;

  const nodeById = new Map<string, DiagramNodeDSL>(nodes.map((n) => [n.id, n]));

  // Seed explicit positions.
  for (const n of nodes) {
    if (n.position) positions.set(n.id, n.position);
  }

  // Build ordered list: childrenOrder filtered to ids present in this level, then append any missing.
  const nodeIdSet = new Set<string>(nodes.map((n) => n.id));
  const orderedIds: string[] = childrenOrder.filter((id) => nodeIdSet.has(id));
  // Defensive: append any ids present in nodes but absent from childrenOrder (O(n), not O(n²)).
  const orderedIdSet = new Set<string>(orderedIds);
  for (const n of nodes) {
    if (!orderedIdSet.has(n.id)) {
      orderedIds.push(n.id);
      orderedIdSet.add(n.id);
    }
  }

  // Place items sequentially.
  // trailingEdge = the primary-axis coordinate of the TRAILING edge of the last auto-placed item.
  // top-down: trailing edge is the bottom edge (most negative Y value reached).
  // left-right: trailing edge is the right edge (most positive X value reached).
  let trailingEdge = 0;
  let firstAutoItem = true;

  for (const id of orderedIds) {
    const node = nodeById.get(id);
    if (!node) continue;

    const [w, h] = node.size ?? DEFAULT_NODE_SIZE;
    const primarySize = isTopDown ? h : w;
    const halfPrimary = primarySize / 2;

    if (node.position) {
      // Explicit position: preserve it and skip auto-placement.
      // Do not update trailingEdge; explicit items are assumed placed by the author.
      continue;
    }

    let center: number;
    if (firstAutoItem) {
      // First auto-placed item is centered at the primary-axis origin.
      center = 0;
      firstAutoItem = false;
    } else {
      // Subsequent items: leading edge = trailingEdge ± gap, center = leading ± half.
      if (isTopDown) {
        center = trailingEdge - gap - halfPrimary;
      } else {
        center = trailingEdge + gap + halfPrimary;
      }
    }

    // Update trailing edge for the next item.
    trailingEdge = isTopDown
      ? center - halfPrimary   // bottom edge (most negative Y)
      : center + halfPrimary;  // right edge (most positive X)

    const x = isTopDown ? 0 : center;
    const y = isTopDown ? center : 0;
    positions.set(id, [x, y, 0]);
  }

  return positions;
}

/**
 * Assigns [x, y, z] positions to nodes that have no explicit position.
 * For the 'grid' layout, places nodes left-to-right in rows of ~4 nodes.
 * For the 'hierarchical' layout, performs a topological sort on edges and assigns
 * depth levels as Y-axis bands.
 * For 'flow', places items in declaration order along a single axis with edge-to-edge gap.
 * For 'manual', all nodes must have explicit positions — throws on missing position.
 */
export function resolveLayout(
  nodes: ReadonlyArray<DiagramNodeDSL>,
  edges: ReadonlyArray<DiagramEdgeDSL>,
  layout: ResolvedLayout,
  onWarn?: DiagramWarnFn,
  childrenOrder?: ReadonlyArray<string>,
): Map<string, readonly [number, number, number]> {
  const layoutKind = (layout as { kind?: string }).kind;
  if (layoutKind !== 'manual' && layoutKind !== 'grid' && layoutKind !== 'hierarchical' && layoutKind !== 'flow') {
    console.warn(`Diagram resolveLayout: unknown layout kind "${String(layoutKind)}". Falling back to default grid.`);
    return resolveLayout(nodes, edges, DEFAULT_RESOLVED_GRID, onWarn);
  }

  if (layout.kind === 'flow') {
    return resolveFlowLayout(nodes, layout as ResolvedFlowLayout, childrenOrder ?? nodes.map((n) => n.id));
  }

  const isFiniteNumber = (value: number): boolean => Number.isFinite(value);
  const ensurePair = (
    pair: readonly [number, number],
    fallback: readonly [number, number],
  ): readonly [number, number] => ([
    isFiniteNumber(pair[0]) ? pair[0] : fallback[0],
    isFiniteNumber(pair[1]) ? pair[1] : fallback[1],
  ]);
  const positions = new Map<string, readonly [number, number, number]>();
  const missing: DiagramNodeDSL[] = [];

  nodes.forEach((node) => {
    if (node.position) {
      positions.set(node.id, node.position);
    } else {
      missing.push(node);
    }
  });

  if (layout.kind === 'manual') {
    const nonGhostMissing = missing.filter((n) => n.label !== undefined);
    if (nonGhostMissing.length > 0) {
      const ids = nonGhostMissing.map((n) => `"${n.id}"`).join(', ');
      onWarn?.(
        'MISSING_LAYOUT_POSITION',
        `ManualLayout: ${nonGhostMissing.length} non-ghost node(s) have no explicit position: ${ids}. ` +
          `Add position={[x, y, z]} to each, or switch to <GridLayout> / <HierarchicalLayout> ` +
          `to auto-compute positions. Ghost nodes (label prop absent) may omit position safely.`,
      );
    }
    return positions;
  }

  if (missing.length === 0) {
    return positions;
  }

  const DEFAULT_NODE_SIZE: [number, number] = [4, 2];

  if (layout.kind === 'grid') {
    const { spacing, margin: rawMargin, columns: rawColumns, alignment, disconnected } = layout as ResolvedGridLayout;
    const safeSpacing = ensurePair(spacing, [2, 2]);
    const safeMargin = ensurePair(rawMargin, [0, 0]);
    const resolvedCols = rawColumns === 'auto' || rawColumns === undefined ? 4 : rawColumns;
    const cols = !Number.isFinite(resolvedCols) || resolvedCols <= 0 ? 4 : resolvedCols;
    const margin = safeMargin;

    const connectedNodeIds = new Set<string>();
    edges.forEach((e) => { connectedNodeIds.add(e.from); connectedNodeIds.add(e.to); });
    const orderedMissing = disconnected === 'after'
      ? [
          ...missing.filter((n) => connectedNodeIds.has(n.id)),
          ...missing.filter((n) => !connectedNodeIds.has(n.id)),
        ]
      : missing;

    const rowCount = Math.ceil(orderedMissing.length / cols);
    const nodeSizeById = new Map<string, readonly [number, number]>(
      orderedMissing.map((node) => [
        node.id,
        (node.size ?? DEFAULT_NODE_SIZE) as readonly [number, number],
      ]),
    );
    const effectiveSizeById = new Map<string, readonly [number, number]>(
      orderedMissing.map((node) => {
        const [w, h] = nodeSizeById.get(node.id) ?? DEFAULT_NODE_SIZE;
        return [node.id, [w + 2 * margin[0], h + 2 * margin[1]] as const];
      }),
    );

    const rowHeights: number[] = [];
    const rowWidths: number[] = [];
    for (let r = 0; r < rowCount; r += 1) {
      const rowNodes = orderedMissing.slice(r * cols, (r + 1) * cols);
      const rowEffectiveWidths = rowNodes.map((n) => (effectiveSizeById.get(n.id) ?? DEFAULT_NODE_SIZE)[0]);
      const rowEffectiveHeights = rowNodes.map((n) => (effectiveSizeById.get(n.id) ?? DEFAULT_NODE_SIZE)[1]);
      const rowWidth = rowEffectiveWidths.reduce((sum, w) => sum + w, 0) +
        Math.max(0, rowNodes.length - 1) * safeSpacing[0];
      const rowHeight = rowEffectiveHeights.length > 0 ? Math.max(...rowEffectiveHeights) : 0;
      rowWidths.push(rowWidth);
      rowHeights.push(rowHeight);
    }

    const widestRowWidth = rowWidths.length > 0 ? Math.max(...rowWidths) : 0;
    const rowCenterY: number[] = [];
    for (let r = 0; r < rowCount; r += 1) {
      if (r === 0) {
        rowCenterY.push(0);
        continue;
      }
      const prevY = rowCenterY[r - 1] ?? 0;
      const prevHeight = rowHeights[r - 1] ?? 0;
      const currentHeight = rowHeights[r] ?? 0;
      rowCenterY.push(prevY - (prevHeight / 2 + safeSpacing[1] + currentHeight / 2));
    }

    orderedMissing.forEach((node, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      const rowNodes = orderedMissing.slice(row * cols, (row + 1) * cols);
      const rowWidth = rowWidths[row] ?? 0;

      let rowOffset = 0;
      if (alignment === 'center') {
        rowOffset = (widestRowWidth - rowWidth) / 2;
      } else if (alignment === 'right') {
        rowOffset = widestRowWidth - rowWidth;
      } else if (alignment === 'fill' && rowNodes.length > 1) {
        const fillStep = widestRowWidth / (rowNodes.length - 1);
        const x = col * fillStep + rowOffset;
        const y = rowCenterY[row] ?? 0;
        const z = node.position?.[2] ?? 0;
        positions.set(node.id, [x, y, z]);
        return;
      }
      if (alignment === 'fill' && rowNodes.length === 1) {
        rowOffset = (widestRowWidth - rowWidth) / 2;
        const x = rowOffset + rowWidth / 2;
        const y = rowCenterY[row] ?? 0;
        const z = node.position?.[2] ?? 0;
        positions.set(node.id, [x, y, z]);
        return;
      }

      let x = rowOffset;
      for (let i = 0; i <= col; i += 1) {
        const currentNode = rowNodes[i];
        if (!currentNode) break;
        const currentSize = effectiveSizeById.get(currentNode.id) ?? DEFAULT_NODE_SIZE;
        if (i === 0) {
          x += currentSize[0] / 2;
        } else {
          const prevNode = rowNodes[i - 1]!;
          const prevSize = effectiveSizeById.get(prevNode.id) ?? DEFAULT_NODE_SIZE;
          x += prevSize[0] / 2 + safeSpacing[0] + currentSize[0] / 2;
        }
      }
      const y = rowCenterY[row] ?? 0;
      const z = node.position?.[2] ?? 0;
      positions.set(node.id, [x, y, z]);
    });
    return positions;
  }

  const { spacing, margin: rawMargin, alignment, disconnected, direction } = layout as ResolvedHierarchicalLayout;
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
    const [w, h] = node.size ?? DEFAULT_NODE_SIZE;
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
    const dims = levelNodes.map((node) => levelSecondaryDimByNode.get(node.id) ?? DEFAULT_NODE_SIZE[isPrimary ? 1 : 0]);
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
          ? (levelSecondaryDimByNode.get(firstNode.id) ?? DEFAULT_NODE_SIZE[isPrimary ? 1 : 0])
          : 0;
        if (index === 0) {
          secVal = levelAlignOffset + firstDim / 2;
        } else {
          const prevNode = levelNodes[index - 1]!;
          const prevDim = levelSecondaryDimByNode.get(prevNode.id) ?? DEFAULT_NODE_SIZE[isPrimary ? 1 : 0];
          const currDim = levelSecondaryDimByNode.get(node.id) ?? DEFAULT_NODE_SIZE[isPrimary ? 1 : 0];
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

const GROUP_NODE_PREFIX = '__group__::';

const groupNodeId = (groupId: string): string => `${GROUP_NODE_PREFIX}${groupId}`;

/**
 * Resolved layout info for a single group after its internal layout has been computed.
 * localPositions maps every descendant node id (direct members + all nested descendants)
 * to a position relative to this group's center.
 */
type GroupInfo = {
  /** All descendant node ids (direct + recursive children). */
  readonly allDescendantNodeIds: ReadonlySet<string>;
  /** Positions of all descendant nodes, relative to this group's own center [0,0,0]. */
  readonly localPositions: Map<string, readonly [number, number, number]>;
  /** Padded bounding box size [w, h] — used when this group is a block in a parent layout. */
  readonly size: readonly [number, number];
  /**
   * True when every descendant node had an explicit DSL position (no auto-layout was run).
   * When true, absoluteCenter is the pre-normalization bounding-box center in diagram space,
   * and can be used to pin synthetic blocks when this group appears in a parent layout.
   * This preserves manual diagram layouts where the author has positioned every node.
   */
  readonly allExplicit: boolean;
  /**
   * Bounding-box center in diagram space, before normalization.
   * Only valid/meaningful when allExplicit is true.
   */
  readonly absoluteCenter: readonly [number, number, number];
};

/**
 * A secondary-axis alignment candidate for a standalone node.
 * Produced from cross-group edges in both directions during affinity refinement.
 */
type AffinityCandidate = {
  /** Absolute secondary-axis position of the group endpoint this edge connects to. */
  readonly refinedCrossAxis: number;
  /** Index of the originating edge in the original dsl.edges array — used as DSL-order tiebreaker. */
  readonly edgeIndex: number;
};

/**
 * Returns all node ids belonging to the given group or any of its nested descendants,
 * using a memoised DFS.
 */
function collectAllDescendantNodeIds(
  groupId: string,
  groupById: Map<string, DiagramGroupDSL>,
  memo: Map<string, Set<string>>,
): Set<string> {
  const cached = memo.get(groupId);
  if (cached) return cached;
  const group = groupById.get(groupId);
  if (!group) {
    memo.set(groupId, new Set());
    return new Set();
  }
  const ids = new Set<string>(group.nodeIds);
  for (const childId of group.childGroupIds ?? []) {
    for (const nodeId of collectAllDescendantNodeIds(childId, groupById, memo)) {
      ids.add(nodeId);
    }
  }
  memo.set(groupId, ids);
  return ids;
}

/**
 * Returns groups in bottom-up topological order (leaves first, parents last).
 * Uses DFS post-order on the childGroupIds tree so that when we process a parent
 * group, all its children have already been processed.
 */
function topologicalSortGroups(groups: ReadonlyArray<DiagramGroupDSL>): DiagramGroupDSL[] {
  const groupById = new Map(groups.map((g) => [g.id, g]));
  const result: DiagramGroupDSL[] = [];
  const visited = new Set<string>();

  const visit = (groupId: string): void => {
    if (visited.has(groupId)) return;
    visited.add(groupId);
    const group = groupById.get(groupId);
    if (!group) return;
    for (const childId of group.childGroupIds ?? []) {
      visit(childId);
    }
    result.push(group);
  };

  groups.forEach((g) => visit(g.id));
  return result;
}

/**
 * Group-aware layout resolver with full nested group support.
 *
 * Algorithm (bottom-up, one pass per group level):
 * 1. Sort groups topologically — leaves (innermost) first, roots last.
 * 2. For each group bottom-up:
 *    a. Collect its direct member nodes and already-resolved child group infos.
 *    b. Build virtual layout inputs: direct nodes + synthetic `__group__::id` blocks
 *       sized to each child group's padded bounds.
 *    c. Intra-group edges: edges where both endpoints are descendants of this group
 *       (or direct child-group ids). Endpoints are remapped through synthetic child-group
 *       nodes as appropriate so that an edge like `from="g-child"` is treated as pointing
 *       at the child group's synthetic block rather than a missing node.
 *    d. Run resolveLayout with the group's own layout/spacing overrides (or diagram defaults).
 *    e. Expand synthetic group positions back to actual descendant node positions.
 *    f. Normalize all positions to this group's center.
 *    g. Store GroupInfo { allDescendantNodeIds, localPositions, size, allExplicit, absoluteCenter }.
 * 3. Build the top-level layout: top-level groups as synthetic blocks + ALL ungrouped nodes.
 *    Edge endpoints are resolved through topLevelSynthIdForGroup (any nested group id maps to
 *    its top-level group's synthetic block) so that edges like `from="api" to="inner-group"`
 *    correctly drive the hierarchical level assignment.
 * 4. Combine: group local positions translated by top-level group center + explicit positions.
 *
 * Edge endpoint rules:
 * - A `from`/`to` value may be a node id OR a group id (at any nesting depth).
 * - Group id endpoints are resolved to the appropriate synthetic block at layout time.
 * - Self-loops and duplicate virtual edges are de-duplicated and silently dropped.
 *
 * Explicit positions are always preserved and never overwritten.
 * When every descendant of a group has an explicit position (allExplicit = true), the
 * group skips the intra-group auto-layout pass and preserves local relative coordinates.
 * Parent layouts still place the group block, so parent spacing/alignment is respected.
 */
export function resolveLayoutWithGroups(
  nodes: ReadonlyArray<DiagramNodeDSL>,
  edges: ReadonlyArray<DiagramEdgeDSL>,
  groups: ReadonlyArray<DiagramGroupDSL>,
  rootLayout: ResolvedLayout,
  groupLayouts: Map<string, ResolvedLayout>,
  sizes: Map<string, readonly [number, number] | readonly [number, number, number]>,
  onWarn?: DiagramWarnFn,
  rootChildrenOrder?: ReadonlyArray<string>,
  groupChildrenOrders?: Map<string, ReadonlyArray<string>>,
): Map<string, readonly [number, number, number]> {
  if (rootLayout.kind === 'manual' || groups.length === 0) {
    return resolveLayout(nodes, edges, rootLayout, onWarn, rootChildrenOrder);
  }

  const groupById = new Map(groups.map((g) => [g.id, g]));
  const nodesById = new Map(nodes.map((n) => [n.id, n]));

  // Precompute all-descendant-node-ids for every group (memoised).
  const descendantMemo = new Map<string, Set<string>>();
  groups.forEach((g) => collectAllDescendantNodeIds(g.id, groupById, descendantMemo));

  // Process groups bottom-up.
  const sortedGroups = topologicalSortGroups(groups);
  const groupInfoMap = new Map<string, GroupInfo>();

  for (const group of sortedGroups) {
    const allDescendantNodeIds = descendantMemo.get(group.id) ?? new Set<string>();
    const directMemberNodes = group.nodeIds
      .map((id) => nodesById.get(id))
      .filter((n): n is DiagramNodeDSL => !!n);
    const childGroups = (group.childGroupIds ?? [])
      .map((id) => groupById.get(id))
      .filter((g): g is DiagramGroupDSL => !!g);

    // Detect whether every descendant has an explicit DSL position.
    // When true we skip the layout pass entirely and use the actual diagram-space
    // positions directly — this is essential for manually-authored scenes where the
    // author has placed every node at a specific coordinate.
    const directAllExplicit = directMemberNodes.every((n) => !!n.position);
    const childrenAllExplicit = childGroups.every(
      (cg) => groupInfoMap.get(cg.id)?.allExplicit ?? false,
    );
    const isAllExplicit = directAllExplicit && childrenAllExplicit;

    let expandedPositions: Map<string, readonly [number, number, number]>;

    if (isAllExplicit) {
      // ── All-explicit fast path ──────────────────────────────────────────────
      // Build diagram-space positions directly from the DSL without running layout.
      // For direct nodes: use the explicit position as-is.
      // For child groups: un-normalize each child's localPositions using its absoluteCenter
      //   so positions are back in diagram (absolute) space.
      expandedPositions = new Map();
      directMemberNodes.forEach((n) => expandedPositions.set(n.id, n.position!));
      for (const childGroup of childGroups) {
        const childInfo = groupInfoMap.get(childGroup.id)!;
        const [cx, cy, cz] = childInfo.absoluteCenter;
        childInfo.localPositions.forEach((localPos, nodeId) => {
          expandedPositions.set(nodeId, [
            localPos[0] + cx,
            localPos[1] + cy,
            localPos[2] + cz,
          ]);
        });
      }
    } else {
      // ── Auto-layout path ────────────────────────────────────────────────────
      const groupLayout = groupLayouts.get(group.id) ?? rootLayout;

      // Build virtual layout nodes: direct members + synthetic child-group blocks.
      const virtualNodes: DiagramNodeDSL[] = [...directMemberNodes];
      for (const childGroup of childGroups) {
        const childInfo = groupInfoMap.get(childGroup.id);
        if (!childInfo) continue; // should not happen with correct topological order
        virtualNodes.push({
          id: groupNodeId(childGroup.id),
          label: groupNodeId(childGroup.id),
          size: [childInfo.size[0], childInfo.size[1]],
        });
      }

      // Build intra-group virtual edges. An edge qualifies if both endpoints are either:
      //   (a) a node that is a descendant of this group, or
      //   (b) a direct child group id (edges may reference groups by id as endpoints).
      // Endpoints are remapped through synthetic child-group nodes where appropriate.
      const childGroupIdSet = new Set(childGroups.map((cg) => cg.id));
      const immediateChildGroupByDescendant = new Map<string, string>();
      for (const childGroup of childGroups) {
        const childDescendants = descendantMemo.get(childGroup.id) ?? new Set<string>();
        childDescendants.forEach((nodeId) =>
          immediateChildGroupByDescendant.set(nodeId, childGroup.id),
        );
      }

      const seenVirtualEdges = new Set<string>();
      const virtualEdges: DiagramEdgeDSL[] = [];
      for (const edge of edges) {
        const fromIsDescendant = allDescendantNodeIds.has(edge.from);
        const toIsDescendant = allDescendantNodeIds.has(edge.to);
        const fromIsChildGroup = childGroupIdSet.has(edge.from);
        const toIsChildGroup = childGroupIdSet.has(edge.to);
        if (!fromIsDescendant && !fromIsChildGroup) continue;
        if (!toIsDescendant && !toIsChildGroup) continue;
        // If the endpoint IS a child group id, route it directly to that synthetic block.
        const fromChildGroup = fromIsChildGroup
          ? edge.from
          : immediateChildGroupByDescendant.get(edge.from);
        const toChildGroup = toIsChildGroup
          ? edge.to
          : immediateChildGroupByDescendant.get(edge.to);
        const fromId = fromChildGroup ? groupNodeId(fromChildGroup) : edge.from;
        const toId = toChildGroup ? groupNodeId(toChildGroup) : edge.to;
        if (fromId === toId) continue;
        const key = `${fromId}→${toId}`;
        if (seenVirtualEdges.has(key)) continue;
        seenVirtualEdges.add(key);
        virtualEdges.push({ from: fromId, to: toId });
      }

      // Run layout on virtual nodes.
      const groupOrder = groupChildrenOrders?.get(group.id);
      const remappedGroupOrder = groupOrder?.map((id) =>
        childGroupIdSet.has(id) ? groupNodeId(id) : id,
      );
      const rawLocalPositions = resolveLayout(virtualNodes, virtualEdges, groupLayout, onWarn, remappedGroupOrder);

      // Expand: translate synthetic child-group positions into actual descendant node positions.
      expandedPositions = new Map();
      rawLocalPositions.forEach((pos, id) => {
        if (id.startsWith(GROUP_NODE_PREFIX)) {
          const childGroupId = id.slice(GROUP_NODE_PREFIX.length);
          const childInfo = groupInfoMap.get(childGroupId);
          if (!childInfo) return;
          childInfo.localPositions.forEach((localPos, nodeId) => {
            expandedPositions.set(nodeId, [
              localPos[0] + pos[0],
              localPos[1] + pos[1],
              localPos[2] + pos[2],
            ]);
          });
        } else {
          expandedPositions.set(id, pos);
        }
      });
    }

    // Normalize: shift all positions so this group's content center is at [0,0,0].
    // The pre-normalization center is stored as absoluteCenter for use by parent groups.
    const bounds = computeBounds([...allDescendantNodeIds], expandedPositions, sizes);
    const centerX = bounds.x + bounds.w / 2;
    const centerY = bounds.y + bounds.h / 2;
    const localPositions = new Map<string, readonly [number, number, number]>();
    expandedPositions.forEach((pos, id) => {
      localPositions.set(id, [pos[0] - centerX, pos[1] - centerY, pos[2]]);
    });

    const gl = groupLayouts.get(group.id) ?? rootLayout;
    const [pt, pr, pb, pl] = gl.groupPadding;
    const paddedW = bounds.w + pl + pr;
    const paddedH = bounds.h + pb + pt;

    groupInfoMap.set(group.id, {
      allDescendantNodeIds,
      localPositions,
      size: [paddedW, paddedH],
      allExplicit: isAllExplicit,
      absoluteCenter: [centerX, centerY, 0],
    });
  }

  // ─── Top-level pass ─────────────────────────────────────────────────────────

  // Collect all node ids that belong to any top-level group (or its nested descendants).
  const topLevelGroups = groups.filter((g) => !g.parentId);
  const allGroupedNodeIds = new Set<string>();
  topLevelGroups.forEach((g) => {
    const info = groupInfoMap.get(g.id);
    if (info) info.allDescendantNodeIds.forEach((id) => allGroupedNodeIds.add(id));
  });

  const topLevelLayoutNodes: DiagramNodeDSL[] = [];
  const topLevelLayoutNodeIds = new Set<string>();

  // Synthetic blocks for each top-level group.
  for (const group of topLevelGroups) {
    const info = groupInfoMap.get(group.id);
    if (!info) continue;
    const id = groupNodeId(group.id);
    topLevelLayoutNodes.push({
      id,
      label: id,
      size: [info.size[0], info.size[1]],
    });
    topLevelLayoutNodeIds.add(id);
  }

  // All ungrouped nodes — both explicit (pinned) and auto-layout — participate in the
  // top-level layout graph. Including explicit nodes is essential so that edges between
  // pinned anchor nodes and auto-layout groups drive hierarchical level assignment.
  // Explicit positions are preserved unchanged by resolveLayout.
  nodes.forEach((node) => {
    if (allGroupedNodeIds.has(node.id)) return;
    topLevelLayoutNodes.push(node);
    topLevelLayoutNodeIds.add(node.id);
  });

  // Build two remapping structures for top-level edge resolution:
  //   topLevelGroupByDescendant: nodeId → top-level groupId (for nodes inside groups)
  //   topLevelSynthIdForGroup:   any groupId → its synthetic block id at the top level
  // Together these allow edges to reference groups by id directly as endpoints,
  // e.g. <DiagramEdge from="api" to="input-filters"/> where input-filters is a nested group.
  const topLevelGroupByDescendant = new Map<string, string>();
  topLevelGroups.forEach((g) => {
    const info = groupInfoMap.get(g.id);
    if (info) info.allDescendantNodeIds.forEach((id) => topLevelGroupByDescendant.set(id, g.id));
  });

  const topLevelSynthIdForGroup = new Map<string, string>();
  const registerGroupTopLevel = (groupId: string, topLevelId: string): void => {
    topLevelSynthIdForGroup.set(groupId, groupNodeId(topLevelId));
    const g = groupById.get(groupId);
    for (const childId of g?.childGroupIds ?? []) {
      registerGroupTopLevel(childId, topLevelId);
    }
  };
  topLevelGroups.forEach((g) => registerGroupTopLevel(g.id, g.id));

  /** Resolve any edge endpoint (node id, group id, node-inside-group) to the id used
   *  in the top-level layout graph. Returns the original id if no remapping applies. */
  const resolveTopLevelEndpoint = (id: string): string => {
    const groupForNode = topLevelGroupByDescendant.get(id);
    if (groupForNode) return groupNodeId(groupForNode);
    const synthId = topLevelSynthIdForGroup.get(id);
    if (synthId) return synthId;
    return id; // ungrouped node or unknown — pass through
  };

  const seenTopLevelEdges = new Set<string>();
  const topLevelEdges: DiagramEdgeDSL[] = [];
  edges.forEach((edge) => {
    const fromId = resolveTopLevelEndpoint(edge.from);
    const toId = resolveTopLevelEndpoint(edge.to);
    if (fromId === toId) return;
    if (!topLevelLayoutNodeIds.has(fromId) || !topLevelLayoutNodeIds.has(toId)) return;
    const key = `${fromId}→${toId}`;
    if (seenTopLevelEdges.has(key)) return;
    seenTopLevelEdges.add(key);
    topLevelEdges.push({ from: fromId, to: toId });
  });

  const remappedRootOrder = rootChildrenOrder?.map((id) =>
    topLevelGroups.some((g) => g.id === id) ? groupNodeId(id) : id,
  );
  const topLevelPositions = resolveLayout(topLevelLayoutNodes, topLevelEdges, rootLayout, onWarn, remappedRootOrder);

  // ─── Connection affinity refinement (hierarchical only) ──────────────────────
  // Adjusts standalone node secondary-axis positions so they align with their
  // actual connection points inside groups, rather than the group center.
  //
  // Design rules:
  //   a) Closest edge wins — among all edges connecting a standalone node to/from
  //      a group, use the endpoint whose absolute secondary position is closest
  //      to the standalone node's current (pre-affinity) secondary position.
  //   b) DSL order tiebreaker — when two candidates are equidistant, prefer the
  //      edge that was declared first in the DSL (lower edgeIndex).
  //
  // Both directions are handled:
  //   - ungrouped → group (e.g. in-episodic → s1 inside g1)
  //   - group → ungrouped (e.g. s7 inside g1 → out-neo)
  if (rootLayout.kind === 'hierarchical') {
    const isLR = (rootLayout as ResolvedHierarchicalLayout).direction === 'left-right';
    const affinityTargets = new Map<string, AffinityCandidate[]>();

    const getTopLevelGroupIdForEndpoint = (endpointId: string): string | null => {
      const byNode = topLevelGroupByDescendant.get(endpointId);
      if (byNode) return byNode;
      const synthId = topLevelSynthIdForGroup.get(endpointId);
      if (!synthId || !synthId.startsWith(GROUP_NODE_PREFIX)) return null;
      return synthId.slice(GROUP_NODE_PREFIX.length);
    };

    const getEndpointLocalCrossAxis = (topLevelGroupId: string, endpointId: string): number | null => {
      const groupInfo = groupInfoMap.get(topLevelGroupId);
      if (!groupInfo) return null;

      // Direct node endpoint: read its local cross-axis position within the group.
      const nodeLocal = groupInfo.localPositions.get(endpointId);
      if (nodeLocal) return isLR ? nodeLocal[1] : nodeLocal[0];

      // Group-id endpoint: approximate by mean cross-axis of all descendant nodes.
      const descendantNodeIds = descendantMemo.get(endpointId);
      if (!descendantNodeIds || descendantNodeIds.size === 0) return 0;
      let sum = 0;
      let count = 0;
      descendantNodeIds.forEach((nodeId) => {
        const lp = groupInfo.localPositions.get(nodeId);
        if (!lp) return;
        sum += isLR ? lp[1] : lp[0];
        count += 1;
      });
      if (count === 0) return 0;
      return sum / count;
    };

    const addAffinityCandidate = (
      standaloneNodeId: string,
      groupId: string,
      groupEndpointId: string,
      edgeIndex: number,
    ): void => {
      const groupBlockPos = topLevelPositions.get(groupNodeId(groupId));
      if (!groupBlockPos) return;
      const groupBlockCrossAxis = isLR ? groupBlockPos[1] : groupBlockPos[0];
      const localCrossAxis = getEndpointLocalCrossAxis(groupId, groupEndpointId);
      if (localCrossAxis === null) return;
      const refinedCrossAxis = groupBlockCrossAxis + localCrossAxis;
      if (!affinityTargets.has(standaloneNodeId)) affinityTargets.set(standaloneNodeId, []);
      affinityTargets.get(standaloneNodeId)!.push({ refinedCrossAxis, edgeIndex });
    };

    edges.forEach((edge, edgeIndex) => {
      const fromIsGrouped =
        topLevelGroupByDescendant.has(edge.from) ||
        topLevelSynthIdForGroup.has(edge.from);
      const toIsGrouped =
        topLevelGroupByDescendant.has(edge.to) ||
        topLevelSynthIdForGroup.has(edge.to);

      // Direction A: standalone node → group node/id
      if (!fromIsGrouped && toIsGrouped) {
        const toGroupId = getTopLevelGroupIdForEndpoint(edge.to);
        if (toGroupId && topLevelPositions.has(edge.from)) {
          addAffinityCandidate(edge.from, toGroupId, edge.to, edgeIndex);
        }
      }

      // Direction B: group node/id → standalone node
      if (fromIsGrouped && !toIsGrouped) {
        const fromGroupId = getTopLevelGroupIdForEndpoint(edge.from);
        if (fromGroupId && topLevelPositions.has(edge.to)) {
          addAffinityCandidate(edge.to, fromGroupId, edge.from, edgeIndex);
        }
      }
    });

    // Build primary-axis buckets: map each primary-axis value to the standalone node IDs
    // that sit at that hierarchical level. Used to detect sole-node levels below.
    const standaloneNodesByPrimaryLevel = new Map<number, string[]>();
    topLevelPositions.forEach((pos, id) => {
      if (id.startsWith(GROUP_NODE_PREFIX)) return;
      // Round to 2 decimal places to tolerate floating-point imprecision in level values.
      const primaryVal = Math.round((isLR ? pos[0] : pos[1]) * 100) / 100;
      if (!standaloneNodesByPrimaryLevel.has(primaryVal)) {
        standaloneNodesByPrimaryLevel.set(primaryVal, []);
      }
      standaloneNodesByPrimaryLevel.get(primaryVal)!.push(id);
    });

    // Apply closest-edge-wins with DSL-order tiebreaker.
    // Guard: skip affinity when the node is alone at its hierarchical level AND has only
    // one cross-group edge. A lone node with a single connection naturally centers over
    // the group; forcing it to align to that specific group endpoint (which may be at the
    // far edge of a wide group) creates diagonal left-to-right visual artifacts even when
    // direction="top-down". Affinity is still applied when:
    //   (a) candidates.length > 1 — node has multiple edges into the group, or
    //   (b) peersAtLevel.length > 1 — multiple standalone nodes share this level and need
    //       to be spatially differentiated from each other.
    affinityTargets.forEach((candidates, nodeId) => {
      const pos = topLevelPositions.get(nodeId);
      if (!pos || candidates.length === 0) return;

      const primaryVal = Math.round((isLR ? pos[0] : pos[1]) * 100) / 100;
      const peersAtLevel = standaloneNodesByPrimaryLevel.get(primaryVal) ?? [];
      if (candidates.length <= 1 && peersAtLevel.length <= 1) return;

      const currentCrossAxis = isLR ? pos[1] : pos[0];

      // Find the candidate whose absolute secondary position is closest to the
      // node's current (pre-affinity) secondary position.
      // On equal distance, prefer the candidate with the lower edgeIndex (DSL order).
      let best = candidates[0]!;
      for (let i = 1; i < candidates.length; i++) {
        const cand = candidates[i]!;
        const bestDist = Math.abs(best.refinedCrossAxis - currentCrossAxis);
        const candDist = Math.abs(cand.refinedCrossAxis - currentCrossAxis);
        if (
          candDist < bestDist ||
          (candDist === bestDist && cand.edgeIndex < best.edgeIndex)
        ) {
          best = cand;
        }
      }

      const [x, y, z] = pos;
      topLevelPositions.set(nodeId, isLR ? [x, best.refinedCrossAxis, z] : [best.refinedCrossAxis, y, z]);
    });
  }

  // ─── Combine all positions ───────────────────────────────────────────────────

  const finalPositions = new Map<string, readonly [number, number, number]>();

  // 1. Preserve explicit positions for ungrouped nodes only.
  // Grouped explicit coordinates act as local positions; parent layout determines
  // the group block placement and thus the final global positions.
  nodes.forEach((n) => {
    if (n.position && !allGroupedNodeIds.has(n.id)) finalPositions.set(n.id, n.position);
  });

  // 2. Top-level group descendants: translate local positions by group center.
  topLevelGroups.forEach((group) => {
    const groupCenterPos = topLevelPositions.get(groupNodeId(group.id));
    if (!groupCenterPos) return;
    const info = groupInfoMap.get(group.id);
    if (!info) return;
    info.localPositions.forEach((localPos, nodeId) => {
      if (!finalPositions.has(nodeId)) {
        finalPositions.set(nodeId, [
          localPos[0] + groupCenterPos[0],
          localPos[1] + groupCenterPos[1],
          localPos[2] + groupCenterPos[2],
        ]);
      }
    });
  });

  // 3. Ungrouped auto-positioned nodes.
  topLevelPositions.forEach((pos, id) => {
    if (!id.startsWith(GROUP_NODE_PREFIX) && !finalPositions.has(id)) {
      finalPositions.set(id, pos);
    }
  });

  return finalPositions;
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
