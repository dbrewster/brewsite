---
title: "Fix: HierarchicalLayout direction='top-down' incorrect when DiagramGroup is present"
doc_type: plan
owner: bug-architect
status: ready
updated: 2026-03-03
---

# Plan: Fix HierarchicalLayout + DiagramGroup Direction Bug

## Summary

When a `<Diagram>` uses `<HierarchicalLayout direction="top-down">` and contains a `<DiagramGroup>` child alongside standalone nodes connected via cross-group edges, the visual layout appears to run left-to-right instead of top-down. This plan describes the exact root cause, the fix, and the scene revert.

---

## Root Cause

**File:** `packages/diagram/src/elements/diagram/compiler/layoutAlgorithms.ts`
**Lines:** 776–803 (connection affinity refinement block)

### What is happening

After the hierarchical level assignment (BFS topological sort) places the three top-level entities correctly:
- `in-episodic` → level 0, Y=0 (top)
- `__group__::g1` → level 1, Y≈-8 (middle)
- `out-neo` → level 2, Y≈-16 (bottom)

…the **connection affinity refinement** phase adjusts standalone node secondary-axis (X for top-down) positions. The bug is a two-part defect in this phase:

### Defect 1 — One-directional edge handling (the main bug)

The affinity loop (lines 776–793) only processes edges where `edge.from` is an **ungrouped node**:

```typescript
edges.forEach((edge) => {
  if (topLevelGroupByDescendant.has(edge.from)) return;  // ← skips group→ungrouped
  if (topLevelSynthIdForGroup.has(edge.from)) return;    // ← skips group→ungrouped
  const toGroupId = getTopLevelGroupIdForEndpoint(edge.to);
  if (!toGroupId) return;
  ...
```

**Edge `in-episodic → s1`** is processed: `in-episodic` (ungrouped) shifts to align with `s1`'s local X position within the group. `s1` sits at the far **left** edge of the 7-node horizontal grid row (local X ≈ −10.5). `in-episodic` is therefore moved to **X ≈ −10.5**.

**Edge `s7 → out-neo`** is **silently skipped**: `s7` is inside the group so the first guard fires. `out-neo` receives no affinity refinement and stays at **X = 0**.

Result:
- `in-episodic`: [−10.5, 0, 0] — far left, at top
- Group center: [0, −8, 0] — center, at middle
- Group nodes span X ≈ −13 … +10 across the middle band
- `out-neo`: [0, −16, 0] — center, at bottom

The 7-node horizontal pipeline runs visually left-to-right through the scene (s1 at far left aligns with in-episodic; s7 at upper-right of group, out-neo at center-bottom). Despite the Y-axis ordering being correct, the **dominant visual direction is horizontal** because in-episodic is pulled to the far left by an overly aggressive affinity shift.

### Defect 2 — Mean-based multi-edge affinity (secondary issue)

When a standalone node connects to **multiple** nodes inside a group, the current code uses the arithmetic **mean** of all endpoint X positions as the affinity target. The user's design intent is **closest-edge-wins**: among all edges from a standalone node into a group, use the endpoint whose absolute secondary position is **closest to the standalone node's natural (pre-affinity) position**. When distances are equal, DSL declaration order (edge index) is the tiebreaker.

Mean-based affinity produces incorrect alignment when endpoints are spread across a wide group. Closest-edge-wins minimises displacement, keeping the standalone node as close to its natural position as possible while still reflecting its actual connection point.

---

## Fix Specification

All changes are confined to the connection affinity refinement block in `resolveLayoutWithGroups` inside `layoutAlgorithms.ts`.

### 1. Define an affinity candidate type (add near top of file, below existing imports)

```typescript
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
```

### 2. Replace the affinity refinement block (lines 740–803)

Replace the entire `if (rootLayout.kind === 'hierarchical') { ... }` block with the following:

```typescript
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

  // Apply closest-edge-wins with DSL-order tiebreaker.
  affinityTargets.forEach((candidates, nodeId) => {
    const pos = topLevelPositions.get(nodeId);
    if (!pos || candidates.length === 0) return;
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
```

### What changes between old and new code

| Aspect | Before | After |
|---|---|---|
| Edge directions handled | `ungrouped → group` only | Both `ungrouped → group` AND `group → ungrouped` |
| Multi-edge strategy | Arithmetic mean of all targets | Closest endpoint to natural position |
| Tiebreaker | None (indeterminate) | DSL edge declaration order (edgeIndex) |
| `out-neo` in somniocortex scenario | Stays at X=0 (no refinement applied) | Shifts to align with `s7`'s absolute X |
| `in-episodic` in somniocortex scenario | Shifts to `s1`'s absolute X (unchanged for single edge) | Same — single-edge closest = only option |
| Affinity helper functions | Defined inside the if-block as closures | Extracted as named `addAffinityCandidate` helper |

---

## File Changes

### Primary fix

**`packages/diagram/src/elements/diagram/compiler/layoutAlgorithms.ts`**

1. Add `AffinityCandidate` type definition after the `GroupInfo` type definition (around line 408).
2. Replace the entire `if (rootLayout.kind === 'hierarchical') { ... }` affinity block (lines 740–803) with the new implementation above.
3. Remove the two standalone helper functions `getTopLevelGroupIdForEndpoint` and `getEndpointLocalCrossAxis` that were previously defined as closures inside the block and replace them with the new implementations embedded in the rewritten block (as shown above).

**No other files in `packages/diagram/src/` require changes.**

---

## Test Strategy

**File:** `packages/diagram/src/elements/diagram/compiler/__tests__/layoutAlgorithms.test.ts`

Add a new `describe` block: `'resolveLayoutWithGroups — HierarchicalLayout top-down + DiagramGroup'`

### Test 1 — Primary axis: top node is above group, group is above bottom node

```typescript
it('top-down: in-episodic above group, group above out-neo with cross-group edges', () => {
  // in-episodic → s1 (inside group) → ... → s7 (inside group) → out-neo
  // Root: hierarchical top-down. Group: GridLayout (columns=4).
  // All nodes have no explicit positions.
  const nodes = [
    makeNode('in-episodic', { size: [7, 2.8] }),
    makeNode('s1', { size: [5, 2.8] }),
    makeNode('s2', { size: [5, 2.8] }),
    makeNode('s3', { size: [5, 2.8] }),
    makeNode('s4', { size: [5, 2.8] }),
    makeNode('s5', { size: [5, 2.8] }),
    makeNode('s6', { size: [5, 2.8] }),
    makeNode('s7', { size: [5, 2.8] }),
    makeNode('out-neo', { size: [7, 2.8] }),
  ];
  const groups = [
    makeGroup('g1', ['s1', 's2', 's3', 's4', 's5', 's6', 's7'], {
      layout: { kind: 'grid', columns: 4 },
    }),
  ];
  const edges = [
    makeEdge('in-episodic', 's1'),
    makeEdge('s1', 's2'), makeEdge('s2', 's3'), makeEdge('s3', 's4'),
    makeEdge('s4', 's5'), makeEdge('s5', 's6'), makeEdge('s6', 's7'),
    makeEdge('s7', 'out-neo'),
  ];
  const sizes = new Map(nodes.map((n) => [n.id, n.size ?? [4, 2]] as [string, [number, number]]));
  const groupLayouts = resolveGroupLayouts(groups, hierarchical());
  const positions = resolveLayoutWithGroups(nodes, edges, groups, hierarchical(), groupLayouts, sizes);

  const yIn = positions.get('in-episodic')![1];
  const yOut = positions.get('out-neo')![1];
  // Group center Y = mean of all group member Y values.
  const groupMemberYs = ['s1','s2','s3','s4','s5','s6','s7'].map((id) => positions.get(id)![1]);
  const yGroup = groupMemberYs.reduce((s, v) => s + v, 0) / groupMemberYs.length;

  // Primary assertion: top-down ordering is preserved.
  expect(yIn).toBeGreaterThan(yGroup);
  expect(yGroup).toBeGreaterThan(yOut);
});
```

### Test 2 — Symmetric secondary-axis: both entry and exit nodes are affinity-aligned

```typescript
it('top-down: both entry node (→ group) and exit node (← group) receive affinity alignment', () => {
  const nodes = [
    makeNode('entry'),
    makeNode('a', { size: [4, 2] }),
    makeNode('b', { size: [4, 2] }),
    makeNode('c', { size: [4, 2] }),
    makeNode('exit'),
  ];
  const groups = [makeGroup('g1', ['a', 'b', 'c'], { layout: { kind: 'grid', columns: 3 } })];
  const edges = [
    makeEdge('entry', 'a'),  // entry → left end of group
    makeEdge('c', 'exit'),   // right end of group → exit
  ];
  const sizes = new Map(nodes.map((n) => [n.id, n.size ?? [4, 2]] as [string, [number, number]]));
  const groupLayouts = resolveGroupLayouts(groups, hierarchical());
  const positions = resolveLayoutWithGroups(nodes, edges, groups, hierarchical(), groupLayouts, sizes);

  // 'a' is at the far left of the grid row — entry should shift left toward it.
  // 'c' is at the far right of the grid row — exit should shift right toward it.
  // Specifically: entry.X should be near a.X, and exit.X should be near c.X.
  const entryX = positions.get('entry')![0];
  const exitX  = positions.get('exit')![0];
  const aX     = positions.get('a')![0];
  const cX     = positions.get('c')![0];

  expect(Math.abs(entryX - aX)).toBeLessThan(0.5);
  expect(Math.abs(exitX - cX)).toBeLessThan(0.5);

  // Primary ordering preserved.
  expect(positions.get('entry')![1]).toBeGreaterThan(positions.get('exit')![1]);
});
```

### Test 3 — Closest-edge-wins for multi-edge into group

```typescript
it('closest-edge-wins: when two edges enter a group at different X, uses the closer one', () => {
  // node 'src' connects to 'left' (far left of group) AND 'mid' (center of group).
  // 'src' natural X = 0. 'left' absolute X is further away than 'mid' absolute X.
  // → closest wins = mid. src should be near mid's X, not left's X, and not the mean.
  const nodes = [
    makeNode('src'),
    makeNode('left', { size: [4, 2] }),
    makeNode('mid',  { size: [4, 2] }),
    makeNode('right', { size: [4, 2] }),
  ];
  const groups = [makeGroup('g1', ['left', 'mid', 'right'], { layout: { kind: 'grid', columns: 3 } })];
  const edges = [
    makeEdge('src', 'left'),   // edgeIndex 0 — far left of group
    makeEdge('src', 'mid'),    // edgeIndex 1 — center of group (closer to src natural X=0)
  ];
  const sizes = new Map(nodes.map((n) => [n.id, n.size ?? [4, 2]] as [string, [number, number]]));
  const groupLayouts = resolveGroupLayouts(groups, hierarchical());
  const positions = resolveLayoutWithGroups(nodes, edges, groups, hierarchical(), groupLayouts, sizes);

  const srcX  = positions.get('src')![0];
  const midX  = positions.get('mid')![0];
  const leftX = positions.get('left')![0];

  // 'closest wins': src should be closer to mid than to left.
  expect(Math.abs(srcX - midX)).toBeLessThan(Math.abs(srcX - leftX));
});
```

### Test 4 — DSL order tiebreaker for equal-distance edges

```typescript
it('DSL order tiebreaker: when two candidates are equidistant, uses the first-declared edge', () => {
  // Group has two nodes symmetrically placed at ±offset from center.
  // src connects to both. Both are equidistant from src's natural X=0.
  // DSL order: left-node edge first, right-node edge second.
  // Expected: src aligns with left-node (earlier in DSL).
  const leftOffset  = -5;
  const rightOffset =  5;
  const nodes = [
    makeNode('src'),
    makeNode('left-node',  { position: [leftOffset,  0, 0] as [number, number, number] }),
    makeNode('right-node', { position: [rightOffset, 0, 0] as [number, number, number] }),
  ];
  const groups = [makeGroup('g1', ['left-node', 'right-node'])];
  const edges = [
    makeEdge('src', 'left-node'),   // edgeIndex 0 (DSL-first)
    makeEdge('src', 'right-node'),  // edgeIndex 1 (DSL-second)
  ];
  const sizes = new Map(nodes.map((n) => [n.id, n.size ?? [4, 2]] as [string, [number, number]]));
  const groupLayouts = resolveGroupLayouts(groups, hierarchical());
  const positions = resolveLayoutWithGroups(nodes, edges, groups, hierarchical(), groupLayouts, sizes);

  const srcX      = positions.get('src')![0];
  const leftNodeX = positions.get('left-node')![0];

  // Should align with the DSL-first edge endpoint (left-node).
  expect(Math.abs(srcX - leftNodeX)).toBeLessThan(0.5);
});
```

---

## Scene Revert: `apps/examples/src/brewflow-memory/scenes/scene_somniocortex.tsx`

The scene was patched to use `<ManualLayout/>` with explicit coordinates as a workaround. After the library fix lands, revert it to use the intended declarative structure.

### Target DSL structure

```tsx
<Diagram id="somno-diagram" pivot="center">
  <HierarchicalLayout direction="top-down" spacing={[3, 4]} />

  <DiagramNode id="in-episodic" label="EpisodicStore" sublabel="raw episodes"
               size={[7, 2.8]} color="#101828" />

  <DiagramGroup id="pipeline-stages">
    <GridLayout columns={4} spacing={[1.5, 2]} />
    <DiagramNode id="s1" label="1. Select"   sublabel="salience · recency · triggers"
                 size={[5, 2.8]} color="#121a30" />
    <DiagramNode id="s2" label="2. Extract"  sublabel="LLM-assisted · candidates only · prompt editable"
                 size={[5, 2.8]} color="#121a30" />
    <DiagramNode id="s3" label="3. Cluster"  sublabel="cross-episode grouping · prevents overfitting"
                 size={[5, 2.8]} color="#121a30" />
    <DiagramNode id="s4" label="4. Propose"  sublabel="typed structured records · full provenance"
                 size={[5, 2.8]} color="#141c35" />
    <DiagramNode id="s5" label="5. Validate" sublabel="deterministic validators only · LLM role ends here"
                 size={[5, 2.8]} color="#141c35" glow={{ intensity: 0.1 }} />
    <DiagramNode id="s6" label="6. Decide"   sublabel="evidence-weighted · contradictions → review"
                 size={[5, 2.8]} color="#141c35" />
    <DiagramNode id="s7" label="7. Publish"  sublabel="versioned delta → Neocortex · audit record"
                 size={[5, 2.8]} color="#151e38" glow={{ intensity: 0.15 }} />
  </DiagramGroup>

  <DiagramNode id="out-neo" label="Neocortex" sublabel="validated cards"
               size={[7, 2.8]} color="#101828" glow={{ intensity: 0.12 }} />

  {/* Cross-group edges — drive hierarchical level assignment */}
  <DiagramEdge from="in-episodic" to="s1"      flow="forward" color="#5070b0" />
  <DiagramEdge from="s1" to="s2"               flow="forward" color="#5070b0" />
  <DiagramEdge from="s2" to="s3"               flow="forward" color="#5070b0" />
  <DiagramEdge from="s3" to="s4"               flow="forward" color="#5070b0" />
  <DiagramEdge from="s4" to="s5"               flow="forward" color="#5070b0" />
  <DiagramEdge from="s5" to="s6"               flow="forward" color="#5070b0" />
  <DiagramEdge from="s6" to="s7"               flow="forward" color="#5070b0" />
  <DiagramEdge from="s7" to="out-neo"          flow="forward" color="#5070b0" />
</Diagram>
```

**Key differences from the ManualLayout workaround:**
- `<ManualLayout />` is removed; `<HierarchicalLayout direction="top-down" spacing={[3, 4]} />` drives automatic vertical placement
- All explicit `position={...}` props are removed from nodes
- `s1`–`s7` are inside `<DiagramGroup id="pipeline-stages">` with `<GridLayout columns={4} />`
- `in-episodic` and `out-neo` are standalone (not in any group)
- Cross-group edges (`in-episodic → s1` and `s7 → out-neo`) drive top-level hierarchical ordering

**Camera and canvas settings remain unchanged** — the existing camera position [0, 5, 28] and `rotation={[config.diagramRotationX, 0, 0]}` are appropriate for viewing the top-down layout.

---

## Implementation Order

1. Add `AffinityCandidate` type to `layoutAlgorithms.ts`
2. Replace the affinity refinement block in `resolveLayoutWithGroups`
3. Run `pnpm --filter @brewsite/diagram test` — all existing tests must pass
4. Add the four new tests to `layoutAlgorithms.test.ts`
5. Run tests again — all four new tests must pass
6. Revert `scene_somniocortex.tsx` to the HierarchicalLayout + DiagramGroup structure
7. Run `pnpm typecheck` to verify no type errors

---

## What is NOT changing

- The BFS topological sort for level assignment — this is correct and not the root cause
- The `resolveLayout` function itself — it correctly respects `direction` prop
- The `groupLayouts` resolution — grid vs hierarchical inheritance is correct
- The intra-group layout pass — groups compute correct local positions
- The top-level position assignment — Y values for in-episodic / group / out-neo are correct

The bug is **exclusively in the post-layout affinity refinement** that adjusts secondary-axis (X) positions of standalone nodes relative to their connected group endpoints.
