// Layout algorithms extracted from compile.ts.
// Pure functions only — no Three.js, no React.

import type { DiagramNodeDSL, DiagramEdgeDSL, DiagramGroupDSL } from '../types';
import { GROUP_PADDING } from './groupConstants';

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

  // Compute per-level max heights so the gap between adjacent level edges is
  // always exactly spacing[1], regardless of how different item heights are.
  // Include explicit nodes so anchor levels derived from explicit positions
  // still respect the correct vertical spacing.
  const levelMaxH = new Map<number, number>();
  nodes.forEach((node) => {
    const l = level.get(node.id) ?? 0;
    const h = (node.size ?? DEFAULT_NODE_SIZE)[1];
    levelMaxH.set(l, Math.max(levelMaxH.get(l) ?? 0, h));
  });

  // levelCenterY[l] is the Y center for all nodes at level l.
  // Anchor the hierarchy to an explicit level when possible so auto-placed
  // nodes align with authored coordinates instead of drifting above them.
  const levelCenterY = new Map<number, number>();
  const allLevelKeys = [...new Set(nodeIds.map((id) => level.get(id) ?? 0))].sort((a, b) => a - b);

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
  const anchorY = anchorNodes.length > 0
    ? anchorNodes.reduce((sum, n) => sum + (n.position?.[1] ?? 0), 0) / anchorNodes.length
    : 0;

  const anchorIndex = allLevelKeys.indexOf(anchorLevel);
  if (anchorIndex === -1) {
    // Fallback: if for some reason the anchor level is absent, default to 0.
    levelCenterY.set(minMissingLevel, 0);
  } else {
    levelCenterY.set(anchorLevel, anchorY);
    // Walk downward (higher levels) from the anchor.
    for (let i = anchorIndex + 1; i < allLevelKeys.length; i += 1) {
      const prevL = allLevelKeys[i - 1];
      const currL = allLevelKeys[i];
      const prevH = levelMaxH.get(prevL) ?? 0;
      const currH = levelMaxH.get(currL) ?? 0;
      const prevCenter = levelCenterY.get(prevL)!;
      levelCenterY.set(currL, prevCenter - prevH / 2 - spacing[1] - currH / 2);
    }
    // Walk upward (lower levels) from the anchor.
    for (let i = anchorIndex - 1; i >= 0; i -= 1) {
      const nextL = allLevelKeys[i + 1];
      const currL = allLevelKeys[i];
      const nextH = levelMaxH.get(nextL) ?? 0;
      const currH = levelMaxH.get(currL) ?? 0;
      const nextCenter = levelCenterY.get(nextL)!;
      levelCenterY.set(currL, nextCenter + nextH / 2 + spacing[1] + currH / 2);
    }
  }

  levels.forEach((levelNodes, l) => {
    const count = levelNodes.length;
    const totalWidth = count * maxWidth + (count - 1) * spacing[0];
    const startX = -totalWidth / 2 + maxWidth / 2;
    levelNodes.forEach((node, index) => {
      const x = startX + index * (maxWidth + spacing[0]);
      const y = levelCenterY.get(l) ?? 0;
      const z = node.position?.[2] ?? 0;
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
 * group skips the auto-layout pass entirely; its absoluteCenter is used to pin the
 * synthetic block so parent layouts respect the author's manual coordinate choices.
 */
export function resolveLayoutWithGroups(
  nodes: ReadonlyArray<DiagramNodeDSL>,
  edges: ReadonlyArray<DiagramEdgeDSL>,
  groups: ReadonlyArray<DiagramGroupDSL>,
  layout: 'manual' | 'grid' | 'hierarchical',
  spacing: [number, number],
  sizes: Map<string, readonly [number, number] | readonly [number, number, number]>,
): Map<string, readonly [number, number, number]> {
  if (layout === 'manual' || groups.length === 0) {
    return resolveLayout(nodes, edges, layout, spacing);
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
      // Determine this group's layout algorithm and spacing.
      // At this point `layout` is narrowed to 'grid' | 'hierarchical' (manual early-returned).
      const groupLayout: 'grid' | 'hierarchical' = group.layout ?? layout;
      const groupSpacing: [number, number] = group.layoutSpacing
        ? [group.layoutSpacing[0], group.layoutSpacing[1]]
        : spacing;

      // Build virtual layout nodes: direct members + synthetic child-group blocks.
      // If a child group is all-explicit, pin its synthetic block at its absoluteCenter
      // so the auto-layout for this group respects the explicit children's positions.
      const virtualNodes: DiagramNodeDSL[] = [...directMemberNodes];
      for (const childGroup of childGroups) {
        const childInfo = groupInfoMap.get(childGroup.id);
        if (!childInfo) continue; // should not happen with correct topological order
        virtualNodes.push({
          id: groupNodeId(childGroup.id),
          label: groupNodeId(childGroup.id),
          size: [childInfo.size[0], childInfo.size[1]],
          position: childInfo.allExplicit
            ? [childInfo.absoluteCenter[0], childInfo.absoluteCenter[1], childInfo.absoluteCenter[2]]
            : undefined,
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
      const rawLocalPositions = resolveLayout(virtualNodes, virtualEdges, groupLayout, groupSpacing);

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

    const paddedW = bounds.w + GROUP_PADDING * 2;
    const paddedH = bounds.h + GROUP_PADDING * 2;

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
  // All-explicit groups are pinned to their absoluteCenter so the top-level layout
  // does not relocate manually-positioned content.
  for (const group of topLevelGroups) {
    const info = groupInfoMap.get(group.id);
    if (!info) continue;
    const id = groupNodeId(group.id);
    topLevelLayoutNodes.push({
      id,
      label: id,
      size: [info.size[0], info.size[1]],
      position: info.allExplicit
        ? [info.absoluteCenter[0], info.absoluteCenter[1], info.absoluteCenter[2]]
        : undefined,
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

  const topLevelPositions = resolveLayout(topLevelLayoutNodes, topLevelEdges, layout, spacing);

  // ─── Combine all positions ───────────────────────────────────────────────────

  const finalPositions = new Map<string, readonly [number, number, number]>();

  // 1. Explicit positions (highest priority — never overwritten).
  nodes.forEach((n) => {
    if (n.position) finalPositions.set(n.id, n.position);
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
