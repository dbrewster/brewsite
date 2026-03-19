// Layout orchestration — dispatches to per-algorithm modules and resolves group layouts.
// Pure functions only — no Three.js, no React.

import type { DiagramNodeDSL, DiagramEdgeDSL, DiagramGroupDSL, DiagramWarnFn } from '../types';
import {
  DEFAULT_RESOLVED_GRID,
} from './layoutResolver';

import type { ResolvedLayout, ResolvedGridLayout, ResolvedHierarchicalLayout, ResolvedFlowLayout } from './layoutResolver';

// Re-export the four algorithm functions for backwards compatibility with existing callers.
export { computeBounds } from './layout/bounds';
export { resolveFlowLayout } from './layout/flowLayout';
export { resolveGridLayout } from './layout/gridLayout';
export { resolveHierarchicalLayout } from './layout/hierarchicalLayout';

import { computeBounds } from './layout/bounds';
import { resolveFlowLayout } from './layout/flowLayout';
import { resolveGridLayout } from './layout/gridLayout';
import { resolveHierarchicalLayout } from './layout/hierarchicalLayout';

/**
 * Assigns [x, y, z] positions to nodes that have no explicit position.
 * Dispatches to the appropriate algorithm based on layout.kind.
 * For 'flow', places items in declaration order along a single axis with edge-to-edge gap.
 * For 'grid', places nodes left-to-right in rows.
 * For 'hierarchical', performs a topological sort on edges and assigns depth levels.
 * For 'manual', all nodes must have explicit positions — warns on missing position.
 */
export function resolveLayout(
  nodes: ReadonlyArray<DiagramNodeDSL>,
  edges: ReadonlyArray<DiagramEdgeDSL>,
  layout: ResolvedLayout,
  onWarn?: DiagramWarnFn,
  childrenOrder?: ReadonlyArray<string>,
  defaultNodeSize: readonly [number, number] = [0.15, 0.08],
): Map<string, readonly [number, number, number]> {
  const layoutKind = (layout as { kind?: string }).kind;
  if (layoutKind !== 'manual' && layoutKind !== 'grid' && layoutKind !== 'hierarchical' && layoutKind !== 'flow') {
    // DEBT: Replace console.warn with onWarn callback for side-effect-free compilation
    console.warn(`Diagram resolveLayout: unknown layout kind "${String(layoutKind)}". Falling back to default grid.`);
    return resolveLayout(nodes, edges, DEFAULT_RESOLVED_GRID, onWarn);
  }

  if (layout.kind === 'flow') {
    return resolveFlowLayout(nodes, layout as ResolvedFlowLayout, childrenOrder ?? nodes.map((n) => n.id), defaultNodeSize);
  }

  if (layout.kind === 'grid') {
    return resolveGridLayout(nodes, edges, layout as ResolvedGridLayout, defaultNodeSize);
  }

  if (layout.kind === 'hierarchical') {
    return resolveHierarchicalLayout(nodes, edges, layout as ResolvedHierarchicalLayout, defaultNodeSize);
  }

  // 'manual' layout: preserve explicit positions, warn on missing.
  const positions = new Map<string, readonly [number, number, number]>();
  const missing: DiagramNodeDSL[] = [];
  nodes.forEach((node) => {
    if (node.position) {
      positions.set(node.id, node.position);
    } else {
      missing.push(node);
    }
  });

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
  defaultNodeSize: readonly [number, number] = [0.15, 0.08],
): Map<string, readonly [number, number, number]> {
  if (rootLayout.kind === 'manual' || groups.length === 0) {
    return resolveLayout(nodes, edges, rootLayout, onWarn, rootChildrenOrder, defaultNodeSize);
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
      const rawLocalPositions = resolveLayout(virtualNodes, virtualEdges, groupLayout, onWarn, remappedGroupOrder, defaultNodeSize);

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
  const topLevelPositions = resolveLayout(topLevelLayoutNodes, topLevelEdges, rootLayout, onWarn, remappedRootOrder, defaultNodeSize);

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
