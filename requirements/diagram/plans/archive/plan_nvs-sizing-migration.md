---
title: "Implementation Plan: Migrate Diagram Sizes from Content Units to NVS Fractions"
doc_type: plan
owner: Architect
status: complete
updated: 2026-03-19
---

# Plan: NVS Sizing Migration

## 1. Summary

Migrate all diagram layout props (`size`, `spacing`, `gap`, `margin`, `groupPadding`, `titleGap`) from content-unit values to NVS fractions. Layout algorithms work entirely in NVS space (Option C). The `normalizeToViewport()` pass is replaced with a center + uniform-scale-to-fit + Y-flip utility. Dense layouts that exceed [0..1] NVS are uniformly scaled to fit with a 2% margin — preserving aspect ratios. The `contentAspect` / `sizeScaleX` / `sizeScaleY` aspect-ratio correction in `render.ts` is eliminated. Single major-version bump.

## 2. Finalized NVS Default Values

### 2.1 Derivation Methodology

Current content-unit defaults map to NVS through `normalizeToViewport()`. For a representative 8-node grid diagram (4 columns × 2 rows, default `[4, 2]` nodes, `[2, 2]` spacing):

- Content span X: 4 nodes × 4w + 3 gaps × 2 = 22 → safeSpanX ≈ 22 (+ padding)
- Content span Y: 2 nodes × 2h + 1 gap × 2 = 6 → safeSpanY ≈ 6 (+ padding)
- NVS node width = 4 / 22 ≈ 0.18; NVS node height = 2 / 6 ≈ 0.33

The current pipeline distorts these values through per-axis-independent normalization, then corrects at render time. With NVS-native sizing, we author the values we *want* to see on screen. The 2:1 aspect ratio must be preserved.

After analyzing the representative diagrams in `apps/website/` and `apps/examples/`:
- ManualLayout scenes already use `[0.15, 0.15]` and `[0.18, 0.13]` for square-ish nodes
- The enterprise/darkGlass themes target medium-density (6-12 node) diagrams
- Nodes should be roughly 15% of viewport width, preserving 2:1 width:height ratio

### 2.2 Default Constants Table

| Constant | Old (content units) | New (NVS fractions) | Rationale |
|---|---|---|---|
| `theme.node.defaultSize` | `[4, 2]` | `[0.15, 0.08]` | ~15% viewport width, 2:1 aspect ratio. Comfortable for 6-12 node diagrams. |
| Grid `spacing` | `[2, 2]` | `[0.06, 0.06]` | ~40% of default node width — consistent visual gap |
| Hierarchical `spacing` | `[1.5, 1.5]` | `[0.045, 0.045]` | ~30% of node width — tighter for hierarchies |
| Flow `gap` | `2` | `0.06` | Same as grid column gap |
| `margin` | `[0, 0]` | `[0, 0]` | Unchanged — no default margin |
| `groupPadding` | `[1.5, 1.5, 1.5, 1.5]` | `[0.035, 0.035, 0.035, 0.035]` | ~23% of node width per side |
| `titleGap` | `1` | `0.025` | ~17% of node width |
| DarkGlass grid `spacing` | `[1, 1]` | `[0.04, 0.04]` | Proportionally tighter than enterprise |
| DarkGlass `titleGap` | `1` | `0.025` | Same |

### 2.3 Thickness Normalization Strategy

Thickness-type values (`node.thickness`, `edge.thickness`, `group.borderWidth`, `group.borderHeight`) stay as "visual weight" values — **not** NVS fractions. They are normalized by a fixed factor derived from the theme's default node size:

```typescript
// New: deterministic thickness normalization.
// Replaces the old `thickness / safeSpan` which depended on the layout bounding box.
// scaleFactor is 1.0 for typical diagrams; < 1.0 when scale-to-fit is active.
// This ensures dense diagrams get proportionally thinner elements as they scale down.
const thicknessNormFactor = scaleFactor / Math.max(defaultSize[0], defaultSize[1]);
// For defaultSize [0.15, 0.08], no scaling: 1.0 / 0.15 ≈ 6.667
// For defaultSize [0.15, 0.08], dense layout (scaleFactor = 0.593): 0.593 / 0.15 ≈ 3.953
```

`thicknessNormFactor` is returned from `normalizeToViewport()` and applied in `compileDiagram()` to `node.thickness`, `edge.thickness`, `group.borderWidth`, and `group.borderHeight`. The render path (`thicknessScale = Math.round(uniformWorldW * 10) / 10`) is unchanged.

---

## 3. Work Streams and Dependency Graph

```
Stream A: Types & Constants (no runtime deps)
    ↓
Stream B: Layout Algorithms (depends on A for constant values)
    ↓
Stream C: Compiler Pipeline (depends on B for layout output format)
    ↓
Stream D: Render Simplification (depends on C for contentAspect removal)
    ↓
Stream E: Consumer Migration + Tests (depends on C and D)
```

**Parallelism:** Streams A and B can start simultaneously. B uses the NVS constant values specified in this plan document (Section 2.2) — it does NOT depend on A's code output. The parallelism is safe because B reads values from the plan, not from A's committed constants files. Stream C requires A complete. Stream D requires C complete. Stream E can begin consumer file migration in parallel with D (since consumer changes are value-only), but test updates depend on C+D.

### 3.1 Stream Assignments (up to 5 devs)

| Stream | Dev | Files | Can Start After |
|---|---|---|---|
| A: Types & Constants | Dev 1 | 4 files | Immediately |
| B: Layout Algorithms | Dev 2 | 5 files | Immediately (uses new constants from A) |
| C: Compiler Pipeline | Dev 3 | 4 files | A complete |
| D: Render Simplification | Dev 4 | 1 file | C complete |
| E: Consumers + Tests + Docs | Dev 5 | ~25 files | C complete (values), D complete (test assertions) |

---

## 4. Stream A: Types & Constants

**Owner:** Dev 1
**Files to modify:**

### 4.1 `packages/diagram/src/elements/diagram/types.ts`

**Remove** the `contentAspect` field from `DiagramState`:

```typescript
// DELETE this field entirely:
// readonly contentAspect: number;
```

**Update** `DiagramThemeNodeConfig.defaultSize` JSDoc to document NVS semantics:

```typescript
/**
 * Default node size as NVS fractions [width, height].
 * width ∈ [0..1]: fraction of diagram viewport width.
 * height ∈ [0..1]: fraction of diagram viewport height.
 * Default: [0.15, 0.08] — 15% wide, 8% tall, 2:1 aspect ratio.
 */
readonly defaultSize: readonly [number, number];
```

### 4.2 `packages/diagram/src/elements/diagram/compiler/diagramLayoutConstants.ts`

**Replace entire file** with unified NVS constants:

```typescript
// Canonical source for diagram layout constants shared across compiler modules.
// All values are NVS fractions — unified across all layout modes.

/** Default group padding in NVS fractions [top, right, bottom, left]. */
export const DEFAULT_GROUP_PADDING: readonly [number, number, number, number] = [0.035, 0.035, 0.035, 0.035];

/** Default title gap in NVS fractions. */
export const DEFAULT_TITLE_GAP: number = 0.025;
```

The `DEFAULT_MANUAL_GROUP_PADDING` and `DEFAULT_MANUAL_TITLE_GAP` constants are **deleted** — they are no longer needed since all layout modes use the same NVS-fraction scale.

### 4.3 `packages/diagram/src/elements/diagram/compiler/layoutResolver.ts`

**Update** all default constants to NVS fractions:

```typescript
const DEFAULT_GRID_SPACING: readonly [number, number] = [0.06, 0.06];
const DEFAULT_HIERARCHICAL_SPACING: readonly [number, number] = [0.045, 0.045];
const DEFAULT_MARGIN: readonly [number, number] = [0, 0];
```

**Update** `DEFAULT_RESOLVED_GRID`:
```typescript
export const DEFAULT_RESOLVED_GRID: ResolvedGridLayout = {
  kind: 'grid',
  columns: 'auto',
  spacing: DEFAULT_GRID_SPACING,       // was [2, 2]
  margin: DEFAULT_MARGIN,
  groupPadding: DEFAULT_GROUP_PADDING,  // now unified NVS [0.035, ...]
  titleGap: DEFAULT_TITLE_GAP,         // now 0.025
  alignment: 'left',
  disconnected: 'next-to',
};
```

**Update** `DEFAULT_RESOLVED_HIERARCHICAL`:
```typescript
export const DEFAULT_RESOLVED_HIERARCHICAL: ResolvedHierarchicalLayout = {
  kind: 'hierarchical',
  direction: 'top-down',
  spacing: DEFAULT_HIERARCHICAL_SPACING,  // was [1.5, 1.5]
  margin: DEFAULT_MARGIN,
  groupPadding: DEFAULT_GROUP_PADDING,
  titleGap: DEFAULT_TITLE_GAP,
  alignment: 'center',
  disconnected: 'next-to',
};
```

**Update** `DEFAULT_RESOLVED_MANUAL` — now uses the same padding as all other layouts:
```typescript
export const DEFAULT_RESOLVED_MANUAL: ResolvedManualLayout = {
  kind: 'manual',
  groupPadding: DEFAULT_GROUP_PADDING,  // was DEFAULT_MANUAL_GROUP_PADDING
  titleGap: DEFAULT_TITLE_GAP,         // was DEFAULT_MANUAL_TITLE_GAP
};
```

**Update** `DEFAULT_RESOLVED_FLOW`:
```typescript
export const DEFAULT_RESOLVED_FLOW: ResolvedFlowLayout = {
  kind: 'flow',
  direction: 'top-down',
  gap: 0.06,                           // was 2
  groupPadding: DEFAULT_GROUP_PADDING,
  titleGap: DEFAULT_TITLE_GAP,
};
```

**Update** `ResolvedFlowLayout` JSDoc:
```typescript
/** Edge-to-edge gap between adjacent items in NVS fractions. Default: 0.06. */
readonly gap: number;
```

**Remove** the import of `DEFAULT_MANUAL_GROUP_PADDING` and `DEFAULT_MANUAL_TITLE_GAP`.

### 4.4 `packages/diagram/src/elements/diagram/dsl.tsx`

**Update** all JSDoc comments on layout props to reflect NVS units:

- `DiagramNodeProps.size`: Remove dual-unit documentation. New JSDoc:
  ```typescript
  /**
   * Node size as NVS fractions [width, height].
   * width ∈ [0..1]: fraction of diagram viewport width.
   * height ∈ [0..1]: fraction of diagram viewport height.
   * Example: [0.15, 0.08] = 15% wide, 8% tall.
   * Default: from theme (typically [0.15, 0.08]).
   */
  size?: [number, number];
  ```

- `GridLayoutProps.spacing`: `/** Gap between node footprints [colGap, rowGap] in NVS fractions. Default: [0.06, 0.06] */`
- `GridLayoutProps.margin`: `/** Per-node margin [h, v] in NVS fractions. Default: 0 */`
- `GridLayoutProps.groupPadding`: `/** Padding inside group boundary boxes in NVS fractions. Default: 0.035 (all sides) */`
- `GridLayoutProps.titleGap`: `/** Gap between group title and content in NVS fractions. Default: 0.025 */`
- `HierarchicalLayoutProps.spacing`: `/** Gap between node footprints in NVS fractions. Default: [0.045, 0.045] */`
- Same updates for `HierarchicalLayoutProps.margin`, `.groupPadding`, `.titleGap`
- `ManualLayoutProps.groupPadding`: `/** Padding inside group boundary boxes in NVS fractions. Default: 0.035 (all sides) */`
- `ManualLayoutProps.titleGap`: `/** Gap between group title and content in NVS fractions. Default: 0.025 */`
- `FlowLayoutProps.gap`: `/** Edge-to-edge gap between adjacent items in NVS fractions. Default: 0.06 */`
- Same updates for `FlowLayoutProps.groupPadding`, `.titleGap`

---

## 5. Stream B: Layout Algorithms

**Owner:** Dev 2
**Files to modify:**

The layout algorithms are coordinate-system-agnostic. The core logic (topological sort, grid row placement, flow sequencing) operates on relative positions computed from node footprints and gaps. The only change is the scale of default inputs.

### 5.1 `packages/diagram/src/elements/diagram/compiler/layout/gridLayout.ts`

**Change:** Update the `ensurePair` fallback from `[2, 2]` to `[0.06, 0.06]`:
```typescript
const safeSpacing = ensurePair(spacing, [0.06, 0.06]);  // was [2, 2]
```

**No other changes.** The algorithm operates on whatever numeric values it receives. Grid layout already works correctly with NVS-scale numbers.

### 5.2 `packages/diagram/src/elements/diagram/compiler/layout/hierarchicalLayout.ts`

**Change:** Update the `ensurePair` fallback from `[2, 2]` to `[0.045, 0.045]`:
```typescript
const safeSpacing = ensurePair(spacing, [0.045, 0.045]);  // was [2, 2]
```

**No other changes.** The topological sort and level assignment are purely graph-based. Band placement arithmetic works at any scale.

### 5.3 `packages/diagram/src/elements/diagram/compiler/layout/flowLayout.ts`

**No code changes needed.** Flow layout reads `layout.gap` directly from the resolved layout config, which will now contain NVS values. The algorithm has no hardcoded fallback constants.

### 5.4 `packages/diagram/src/elements/diagram/compiler/layout/bounds.ts`

**No code changes needed.** `computeBounds()` is pure arithmetic on positions and sizes. It is already coordinate-system-agnostic.

### 5.5 `packages/diagram/src/elements/diagram/compiler/layoutAlgorithms.ts`

**Change:** Update the default `defaultNodeSize` parameter from `[4, 2]` to `[0.15, 0.08]`:

In `resolveLayout()`:
```typescript
defaultNodeSize: readonly [number, number] = [0.15, 0.08],  // was [4, 2]
```

In `resolveLayoutWithGroups()`:
```typescript
defaultNodeSize: readonly [number, number] = [0.15, 0.08],  // was [4, 2]
```

---

## 6. Stream C: Compiler Pipeline

**Owner:** Dev 3
**Files to modify:**

### 6.1 `packages/diagram/src/elements/diagram/compiler/normalizeToViewport.ts`

**Replace the entire module** with a center + uniform-scale-to-fit + Y-flip utility. The new function:
1. Takes layout output positions (Cartesian Y-up) and sizes (already NVS)
2. Computes the bounding box of all node+group extents
3. If the bounding box exceeds [0..1] on either axis, uniformly scales **both positions and sizes** by the same factor to fit within `[0..1]` with a 2% margin per side (96% usable area)
4. Centers the layout within [0..1] NVS (both axes)
5. Flips Y: Cartesian Y-up → NVS Y-down

**Why uniform scale-to-fit is needed:** NVS-native layout algorithms produce positions and sizes in [0..1] space for "typical" diagrams (6-12 nodes). But dense layouts (e.g., 8 nodes in a single row: `8 × 0.15 + 7 × 0.06 = 1.62`) can exceed [0..1]. Without scale-to-fit, nodes would clip outside the viewport. The uniform scale factor preserves aspect ratios — all nodes shrink equally — and the 2% margin prevents edge-touching artifacts.

**The `_padding` parameter is removed** (breaking change, covered by the major version bump). The old parameter was an unused layout-padding pass-through. Callers must update their call sites — the compiler's `compile.ts` is the only internal caller and is updated in Stream C.

```typescript
// Pure coordinate transformation: layout Y-up positions → [0..1] NVS space.
// Uniformly scales dense layouts to fit, then centers and Y-flips.

import type { GroupBounds } from './groupCompiler';

type RawPosition = readonly [number, number, number];
type RawSize = readonly [number, number];

/** Margin per side when scale-to-fit is triggered. 2% = usable area is 96% of [0..1]. */
const SCALE_TO_FIT_MARGIN = 0.02;

/**
 * Output of normalizeToViewport(). All positions are in [0..1] NVS with Y-down.
 * Sizes may be uniformly scaled if the layout exceeded [0..1].
 * Group bounds are scaled, Y-flipped, and centered.
 */
export type NormalizeToViewportResult = {
  readonly normalizedPositions: Map<string, RawPosition>;
  readonly normalizedSizes: Map<string, RawSize>;
  readonly normalizedGroups: Map<string, GroupBounds>;
  /**
   * Uniform normalization divisor for thickness-type values.
   * Computed as 1 / max(defaultNodeSize[0], defaultNodeSize[1]).
   * When scale-to-fit is active, the factor is further multiplied by the scale.
   * The renderer multiplies thickness × thicknessScale to convert to world units.
   */
  readonly thicknessNormFactor: number;
};

/**
 * Centers layout output within [0..1] NVS, uniformly scales to fit if needed,
 * and flips Y axis.
 *
 * Layout algorithms produce positions in NVS-scale Cartesian Y-up space.
 * This function:
 * 1. Computes the bounding box of all node outer edges + group bounds
 * 2. If span exceeds 1.0 on either axis: uniformly scales ALL positions AND sizes
 *    by `usableArea / max(spanX, spanY)` — preserving aspect ratios
 * 3. Translates positions so the bounding box is centered in [0..1]
 * 4. Flips Y: Cartesian +Y (up) → NVS y=0 (top)
 *
 * @param nodes          Node list with NVS-scale positions (Cartesian Y-up)
 * @param groups         Group bounds map (Cartesian Y-up, GroupBounds.y = bottom)
 * @param defaultNodeSize Theme default node size — used for thickness normalization
 */
export function normalizeToViewport(
  nodes: ReadonlyArray<{ id: string; position: RawPosition; size: RawSize }>,
  groups: Map<string, GroupBounds>,
  defaultNodeSize: readonly [number, number] = [0.15, 0.08],
): NormalizeToViewportResult {
  // Step 1: Compute bounding box of all node outer edges + group bounds.
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const node of nodes) {
    const [px, py] = node.position;
    const [sw, sh] = node.size;
    minX = Math.min(minX, px - sw / 2);
    maxX = Math.max(maxX, px + sw / 2);
    minY = Math.min(minY, py - sh / 2);
    maxY = Math.max(maxY, py + sh / 2);
  }

  for (const bounds of groups.values()) {
    if (!Number.isFinite(bounds.x) || !Number.isFinite(bounds.y)) continue;
    if (bounds.w <= 0 && bounds.h <= 0) continue;
    minX = Math.min(minX, bounds.x);
    maxX = Math.max(maxX, bounds.x + bounds.w);
    minY = Math.min(minY, bounds.y);
    maxY = Math.max(maxY, bounds.y + bounds.h);
  }

  // Degenerate case: no nodes and no non-empty groups.
  if (!Number.isFinite(minX)) {
    return {
      normalizedPositions: new Map(),
      normalizedSizes: new Map(),
      normalizedGroups: new Map(),
      thicknessNormFactor: 1 / Math.max(defaultNodeSize[0], defaultNodeSize[1]),
    };
  }

  // Step 2: Determine uniform scale factor.
  // If the layout bounding box exceeds [0..1] on either axis, scale everything down
  // uniformly so it fits within the usable area (1.0 - 2 * margin per axis).
  const spanX = maxX - minX;
  const spanY = maxY - minY;
  const usableArea = 1.0 - 2 * SCALE_TO_FIT_MARGIN;  // 0.96
  const maxSpan = Math.max(spanX, spanY);
  const scaleFactor = maxSpan > usableArea ? usableArea / maxSpan : 1.0;

  // Step 3: Apply scale to all positions and sizes, compute new bounding box center.
  // Scale around the layout's center to keep relative positions intact.
  const layoutCenterX = (minX + maxX) / 2;
  const layoutCenterY = (minY + maxY) / 2;

  // After scaling, the new center in layout space is still (layoutCenterX, layoutCenterY).
  // We want to map this to NVS [0.5, 0.5].
  // For a point P: scaled_P = layoutCenter + (P - layoutCenter) * scaleFactor
  // Then: nvs_P = scaled_P + (0.5 - layoutCenter)
  // Simplified: nvs_P = (P - layoutCenter) * scaleFactor + 0.5

  // Step 4: Normalize positions (scale + center + Y-flip: Cartesian Y-up → NVS Y-down).
  const normalizedPositions = new Map<string, RawPosition>();
  const normalizedSizes = new Map<string, RawSize>();
  for (const node of nodes) {
    const [px, py, pz] = node.position;
    const nx = (px - layoutCenterX) * scaleFactor + 0.5;
    const ny = 1 - ((py - layoutCenterY) * scaleFactor + 0.5);  // Y-flip
    normalizedPositions.set(node.id, [nx, ny, pz]);
    // Scale sizes uniformly (only changes when scaleFactor < 1)
    normalizedSizes.set(node.id, [node.size[0] * scaleFactor, node.size[1] * scaleFactor]);
  }

  // Step 5: Normalize group bounds (scale + center + Y-flip).
  const normalizedGroups = new Map<string, GroupBounds>();
  for (const [groupId, bounds] of groups) {
    // Scale group position relative to layout center
    const scaledX = (bounds.x - layoutCenterX) * scaleFactor + 0.5;
    const cartesianTop = bounds.y + bounds.h;
    const scaledTop = (cartesianTop - layoutCenterY) * scaleFactor + 0.5;
    const nvsY = 1 - scaledTop;  // Y-flip
    const scaledW = bounds.w * scaleFactor;
    const scaledH = bounds.h * scaleFactor;
    normalizedGroups.set(groupId, {
      x: scaledX,
      y: nvsY,
      w: scaledW,
      h: scaledH,
      padding: bounds.padding,    // padding stays as authored NVS fraction
      titleGap: bounds.titleGap,  // titleGap stays as authored NVS fraction
    });
  }

  return {
    normalizedPositions,
    normalizedSizes,
    normalizedGroups,
    thicknessNormFactor: scaleFactor / Math.max(defaultNodeSize[0], defaultNodeSize[1]),
  };
}
```

**Key differences from old `normalizeToViewport()`:**
- Sizes are **not divided per-axis** by independent spans. When scaling is needed (dense layouts), both positions and sizes are scaled by the **same uniform factor** — preserving aspect ratios.
- The `_padding` parameter is **removed** (breaking change, covered by major bump). The old parameter was unused dead code.
- `contentAspect` is gone. Replaced by `thicknessNormFactor`.
- `safeSpan` is gone. Thickness normalization uses a fixed factor from theme defaults, adjusted by the scale-to-fit factor when active.
- When `scaleFactor === 1.0` (typical 6-12 node diagrams), the function is a trivial center + Y-flip with no data loss.
- When `scaleFactor < 1.0` (dense layouts), all geometry shrinks uniformly — the diagram looks correct but smaller, exactly like zooming out.
- Group `padding` and `titleGap` are NOT scaled — they remain as authored NVS fractions. This is intentional: padding is a visual property, not a layout-space measurement. If padding were scaled, dense diagrams would have vanishingly thin group borders.

### 6.2 `packages/diagram/src/elements/diagram/compile.ts`

This is the core orchestration file. Changes are substantial but mechanical.

**Remove imports:**
```typescript
// DELETE: import of safeSpan-related types is no longer needed
```

**Update `compileDiagram()`:**

1. **Remove `safeSpan` variable.** Replace with `thicknessNormFactor` from `normalizeToViewport()` result.

2. **Remove the ManualLayout special-case block** (lines 214-247). With NVS-native sizing, ManualLayout and auto-layout converge. The entire `if (rootLayout.kind !== 'manual') { ... } else { ... }` block simplifies to a single path:

```typescript
// Run layout algorithm → positions in NVS-scale Cartesian Y-up
const positions = resolveLayoutWithGroups(
  dsl.nodes, dsl.edges, dsl.groups,
  rootLayout, groupLayouts, sizeWithDepthMap, onWarn,
  dsl.childrenOrder ?? [], groupChildrenOrders,
  theme.node.defaultSize,
);

// Compute group bounds (NVS-scale Cartesian Y-up)
const groupBoundsMap = resolveGroupBoundsMap(dsl.groups, positions, sizeWithDepthMap, groupLayouts);

// ... (group center injection for edge routing — unchanged) ...

// Normalize: center + uniform-scale-to-fit + Y-flip
const { normalizedPositions, normalizedSizes, normalizedGroups, thicknessNormFactor } =
  normalizeToViewport(nodesPreNorm, groupBoundsMap, theme.node.defaultSize);
```

3. **Remove `contentAspect` variable** and its usage. The `DiagramState` return object no longer includes `contentAspect`.

4. **Update thickness normalization** — replace `/ safeSpan` with `* thicknessNormFactor`:

```typescript
// Node thickness:
thickness: node.thickness * thicknessNormFactor,

// Edge thickness:
return { ...compiled, thickness: compiled.thickness * thicknessNormFactor };

// Group borderWidth/borderHeight:
return {
  ...compiled,
  borderWidth: compiled.borderWidth * thicknessNormFactor,
  borderHeight: compiled.borderHeight * thicknessNormFactor,
};
```

5. **Remove the `MANUAL_LAYOUT_NODE_SIZE_SUSPICIOUS` warning block** (lines 252-263). With uniform NVS sizing, this check is no longer needed.

6. **Remove the ManualLayout `safeSpan` heuristic** (lines 230-246 — the `medianW` / `medianH` / `virtualSpanX` / `virtualSpanY` computation).

7. **Update `DiagramState` return** — remove `contentAspect`:
```typescript
return {
  id: dsl.id,
  viewportBounds,
  tiltRotation: [dsl.tilt ?? 0, 0, 0],
  z: dsl.z ?? 0,
  scale: dsl.scale ?? 1,
  // contentAspect: REMOVED
  nodes,
  edges,
  groups,
  exit: compileExitConfig(dsl.exit),
  enter: compileEnterConfig(dsl.enter),
  themeConfig: buildThemeRenderConfig(theme),
};
```

8. **Update `functionalDiagramTransitionSpec.interpolateFn`** — remove the `contentAspect` pass-through line:
```typescript
// DELETE: contentAspect: to.contentAspect,
```

### 6.3 `packages/diagram/src/elements/diagram/compiler/groupCompiler.ts`

**Update** `resolveGroupBoundsMap()` fallback constants:
```typescript
// In the cycle-guard return:
return { x: 0, y: 0, w: 0, h: 0, padding: DEFAULT_GROUP_PADDING, titleGap: DEFAULT_TITLE_GAP };

// In the group-not-found return:
const empty: GroupBounds = { x: 0, y: 0, w: 0, h: 0, padding: DEFAULT_GROUP_PADDING, titleGap: DEFAULT_TITLE_GAP };
```

These already import from `diagramLayoutConstants.ts` which will have NVS values after Stream A.

**No other changes.** `computeBounds()` and the padding arithmetic are coordinate-system-agnostic.

### 6.4 `packages/diagram/src/compiler/handlers.ts`

**Delete** the `contentAspect: 1.0` field from `makeDefaultDiagramState()` at line 247:

```typescript
// In makeDefaultDiagramState() (line 240), DELETE the contentAspect field:
function makeDefaultDiagramState(id: string): DiagramState {
  return {
    id,
    viewportBounds: { x: 0, y: 0, w: 1, h: 1 },
    tiltRotation: [0, 0, 0],
    z: 0,
    scale: 1,
    // contentAspect: 1.0,  ← DELETE THIS LINE
    nodes: [],
    edges: [],
    groups: [],
    exit: undefined,
    enter: undefined,
    themeConfig: buildThemeRenderConfig(defaultDiagramTheme),
  };
}
```

This function produces the `DiagramWidget.defaultState`. Since `DiagramState` no longer has `contentAspect` (removed in Stream A, types.ts), this line must be deleted or TypeScript will error. The diagram handler's `compileDiagram()` call also no longer returns `contentAspect`, so the round-trip is clean.

**Also remove** the `_padding` argument from the `normalizeToViewport()` call site if it appears in this file (it does not — `normalizeToViewport()` is only called from `compile.ts`). No other handler changes needed.

---

## 7. Stream D: Render Simplification

**Owner:** Dev 4
**Files to modify:**

### 7.1 `packages/diagram/src/elements/diagram/render.ts`

**Remove the entire aspect-ratio correction block** (lines 201-237):

```typescript
// DELETE: The entire sizeScaleX / sizeScaleY / aspectRatio / scaledWorldW / scaledWorldH computation.
```

**Replace** all uses of `scaledWorldW` / `scaledWorldH` with `uniformWorldW` / `uniformWorldH`:

The corrected code for the update() method after world-scale computation (lines 186-199 remain unchanged):

```typescript
// After computing uniformWorldW / uniformWorldH (lines 186-199, unchanged):

// thicknessScale uses uniformWorldW directly (no aspect correction).
const thicknessScale = Math.round(uniformWorldW * 10) / 10 || 0.1;
```

**Update all NVS→world conversions** to use `uniformWorldW` / `uniformWorldH` instead of `scaledWorldW` / `scaledWorldH`:

Groups (lines 259-312):
```typescript
const localGCX = (gcNvsX - 0.5) * uniformWorldW;    // was scaledWorldW
const localGCY = -(gcNvsY - 0.5) * uniformWorldH;   // was scaledWorldH
const worldGW = groupState.bounds.w * uniformWorldW;  // was scaledWorldW
const worldGH = groupState.bounds.h * uniformWorldH;  // was scaledWorldH
// Padding conversions:
const worldPadTop = groupState.bounds.padding[0] * uniformWorldH;    // was scaledWorldH
const worldPadRight = groupState.bounds.padding[1] * uniformWorldW;  // was scaledWorldW
const worldPadBottom = groupState.bounds.padding[2] * uniformWorldH; // was scaledWorldH
const worldPadLeft = groupState.bounds.padding[3] * uniformWorldW;   // was scaledWorldW
const worldTitleGap = groupState.bounds.titleGap * uniformWorldH;    // was scaledWorldH
```

Edges (lines 326-384):
```typescript
// In path command conversions:
(command.from[0] - 0.5) * uniformWorldW,     // was scaledWorldW
-(command.from[1] - 0.5) * uniformWorldH,    // was scaledWorldH
// ... same for all other command points ...

// In control point conversions:
const localCpX = (cp[0] - 0.5) * uniformWorldW;    // was scaledWorldW
const localCpY = -(cp[1] - 0.5) * uniformWorldH;   // was scaledWorldH
```

Nodes (lines 398-429):
```typescript
const localX = (nodeState.position[0] - 0.5) * uniformWorldW;    // was scaledWorldW
const localY = -(nodeState.position[1] - 0.5) * uniformWorldH;   // was scaledWorldH
const worldW = nodeState.size[0] * uniformWorldW;                  // was scaledWorldW
const worldH = nodeState.size[1] * uniformWorldH;                  // was scaledWorldH
```

**Remove** any references to `state.contentAspect` in the render file.

**Remove** the comments about aspect-ratio correction (lines 201-215).

---

## 8. Stream E: Consumer Migration + Tests + Docs

**Owner:** Dev 5
**Files to modify:**

### 8.1 Theme Files (12 files)

All theme files need `defaultSize` updated and layout config values updated. The complete per-theme conversion table follows.

**Conversion methodology:** The ratio between each theme's old content-unit spacing and the enterprise baseline `[2, 2]` is preserved. For example, darkGlass grid spacing `[1, 1]` is 50% of enterprise — so the NVS value is `[0.04, 0.04]` (50% of `[0.06, 0.06]`). The `manual.groupPadding: 1.5` that exists in all themes is a **latent bug** — 1.5 in NVS would be 150% of the viewport. All themes converge to the same NVS `groupPadding: 0.035`.

#### Complete Per-Theme Conversion Table

**Enterprise** (`enterprise.ts`):

| Property | Old (content units) | New (NVS) |
|---|---|---|
| `node.defaultSize` | `[4, 2]` | `[0.15, 0.08]` |
| `layout.grid.spacing` | `[2, 2]` | `[0.06, 0.06]` |
| `layout.grid.groupPadding` | `1.5` | `0.035` |
| `layout.grid.titleGap` | `0.75` | `0.025` |
| `layout.hierarchical.spacing` | `[1.5, 1.5]` | `[0.045, 0.045]` |
| `layout.hierarchical.groupPadding` | `1.5` | `0.035` |
| `layout.hierarchical.titleGap` | `0.75` | `0.025` |
| `layout.manual.groupPadding` | `1.5` (**BUG**) | `0.035` |
| `layout.manual.titleGap` | `0.75` | `0.025` |

**DarkGlass** (`darkGlass.ts`):

| Property | Old (content units) | New (NVS) |
|---|---|---|
| `node.defaultSize` | `[4, 2]` | `[0.15, 0.08]` |
| `layout.grid.spacing` | `[1, 1]` | `[0.04, 0.04]` |
| `layout.grid.groupPadding` | `1.5` | `0.035` |
| `layout.grid.titleGap` | `1` | `0.03` |
| `layout.hierarchical.spacing` | `[1.5, 1.5]` | `[0.045, 0.045]` |
| `layout.hierarchical.groupPadding` | `1.5` | `0.035` |
| `layout.hierarchical.titleGap` | `1` | `0.03` |
| `layout.manual.groupPadding` | `1.5` (**BUG**) | `0.035` |
| `layout.manual.titleGap` | `1` | `0.03` |

**NeonCyber** (`neonCyber.ts`):

| Property | Old (content units) | New (NVS) |
|---|---|---|
| `node.defaultSize` | `[4, 2]` | `[0.15, 0.08]` |
| `layout.grid.spacing` | `[2, 2]` | `[0.06, 0.06]` |
| `layout.grid.groupPadding` | `1.5` | `0.035` |
| `layout.grid.titleGap` | `0.75` | `0.025` |
| `layout.hierarchical.spacing` | `[1.5, 1.5]` | `[0.045, 0.045]` |
| `layout.hierarchical.groupPadding` | `1.5` | `0.035` |
| `layout.hierarchical.titleGap` | `0.75` | `0.025` |
| `layout.manual.groupPadding` | `1.5` (**BUG**) | `0.035` |
| `layout.manual.titleGap` | `0.75` | `0.025` |

**Midnight** (`midnight.ts`):

| Property | Old (content units) | New (NVS) |
|---|---|---|
| `node.defaultSize` | `[4, 2]` | `[0.15, 0.08]` |
| `layout.grid.spacing` | `[1.5, 1.5]` | `[0.05, 0.05]` |
| `layout.grid.groupPadding` | `1.5` | `0.035` |
| `layout.grid.titleGap` | `1` | `0.03` |
| `layout.hierarchical.spacing` | `[1.5, 1.5]` | `[0.045, 0.045]` |
| `layout.hierarchical.groupPadding` | `1.5` | `0.035` |
| `layout.hierarchical.titleGap` | `1` | `0.03` |
| `layout.manual.groupPadding` | `1.5` (**BUG**) | `0.035` |
| `layout.manual.titleGap` | `1` | `0.03` |

**LightMinimal** (`lightMinimal.ts`):

| Property | Old (content units) | New (NVS) |
|---|---|---|
| `node.defaultSize` | `[4, 2]` | `[0.15, 0.08]` |
| `layout.grid.spacing` | `[2, 2]` | `[0.06, 0.06]` |
| `layout.grid.groupPadding` | `1.5` | `0.035` |
| `layout.grid.titleGap` | `0.75` | `0.025` |
| `layout.hierarchical.spacing` | `[1.5, 1.5]` | `[0.045, 0.045]` |
| `layout.hierarchical.groupPadding` | `1.5` | `0.035` |
| `layout.hierarchical.titleGap` | `0.75` | `0.025` |
| `layout.manual.groupPadding` | `1.5` (**BUG**) | `0.035` |
| `layout.manual.titleGap` | `0.75` | `0.025` |

**LightCanvas** (`lightCanvas.ts`):

| Property | Old (content units) | New (NVS) |
|---|---|---|
| `node.defaultSize` | `[4, 2]` | `[0.15, 0.08]` |
| `layout.grid.spacing` | `[2, 2]` | `[0.06, 0.06]` |
| `layout.grid.groupPadding` | `1.5` | `0.035` |
| `layout.grid.titleGap` | `0.75` | `0.025` |
| `layout.hierarchical.spacing` | `[1.5, 1.5]` | `[0.045, 0.045]` |
| `layout.hierarchical.groupPadding` | `1.5` | `0.035` |
| `layout.hierarchical.titleGap` | `0.75` | `0.025` |
| `layout.manual.groupPadding` | `1.5` (**BUG**) | `0.035` |
| `layout.manual.titleGap` | `0.75` | `0.025` |

#### Summary of theme layout differences (NVS)

| Theme | Grid spacing | Hier spacing | titleGap |
|---|---|---|---|
| Enterprise | `[0.06, 0.06]` | `[0.045, 0.045]` | `0.025` |
| DarkGlass | `[0.04, 0.04]` | `[0.045, 0.045]` | `0.03` |
| NeonCyber | `[0.06, 0.06]` | `[0.045, 0.045]` | `0.025` |
| Midnight | `[0.05, 0.05]` | `[0.045, 0.045]` | `0.03` |
| LightMinimal | `[0.06, 0.06]` | `[0.045, 0.045]` | `0.025` |
| LightCanvas | `[0.06, 0.06]` | `[0.045, 0.045]` | `0.025` |

All themes share: `defaultSize: [0.15, 0.08]`, `groupPadding: 0.035` (all layout kinds), `margin: 0`.

**`packages/themes/src/presets/diagram/` (6 files):**

Same changes as above. These are the published `@brewsite/themes` copies. Apply the identical per-theme table.

**Light-mode variant files** (6 additional: `enterpriseLight.ts`, `darkGlassLight.ts`, `neonCyberLight.ts`, `midnightLight.ts`, `lightMinimalDark.ts`, `lightCanvasDark.ts`):

These import from their base themes and override only visual properties (colors, materials). If they don't override `defaultSize` or layout config, no changes needed. **Verify each file** — if any overrides `defaultSize`, update it.

### 8.2 Consumer Scene Files (auto-layout, content-unit values → NVS)

For each file, convert `size={[w, h]}` values from content units to NVS fractions. The conversion is **not a formula** — it's a re-authoring to achieve the same visual proportions. Use the default `[0.15, 0.08]` for "standard" nodes and scale proportionally for larger/smaller nodes.

**Conversion reference for common content-unit sizes:**

| Content Units | NVS Equivalent | Notes |
|---|---|---|
| `[4, 2]` (default) | Remove `size` prop (use theme default `[0.15, 0.08]`) | Standard node |
| `[3, 3]` | `[0.12, 0.12]` | Square, slightly smaller |
| `[3.5, 3.5]` | `[0.13, 0.13]` | Square medium |
| `[4, 3]` | `[0.15, 0.12]` | Slightly taller |
| `[4, 4]` | `[0.15, 0.15]` | Square, standard width |
| `[5, 2.5]` | `[0.18, 0.10]` | Wide |
| `[5, 3.5]` | `[0.18, 0.13]` | Wide, tall |
| `[5, 5]` | `[0.18, 0.18]` | Large square |
| `[6, 2.5]` | `[0.22, 0.10]` | Extra wide |
| `[8.8, 2.5]` | `[0.30, 0.10]` | Hero/title node |
| `[9, 2.5]` | `[0.32, 0.10]` | Hero/title node |
| `[12, 8]` | `[0.40, 0.30]` | Slide hero |

**Also convert layout prop values** (`spacing`, `gap`, `groupPadding`, `titleGap`) if explicitly overridden in any consumer file.

#### File-by-file migration table:

| File | Layout | Changes |
|---|---|---|
| `apps/examples/src/slides-demo/deck.tsx` | Grid/Hierarchical | ~15 nodes: convert `size` values per table above |
| `apps/examples/src/views/scenes/scene3-carousel.tsx` | Flow | ~13 nodes: `[5.0, 2.5]` → `[0.18, 0.10]`; `[8.8, 2.5]` → `[0.30, 0.10]` |
| `apps/examples/src/carousel-selection/scenes/scenePicker.tsx` | Hierarchical | 5 nodes: `[6, 2.5]` → `[0.22, 0.10]`; `[4, 2]` → remove size prop |
| `apps/examples/src/carousel-selection/scenes/sceneDiagramDetail.tsx` | — | 1 node: `[9, 2.5]` → `[0.32, 0.10]` |
| `apps/examples/src/input-showcase/scenes/scene2-camera-controls.tsx` | Flow | ~12 nodes: same as scene3-carousel.tsx |
| `apps/website/src/scenes/act1_act2/scene_01_core_intro.tsx` | Grid | 3 nodes: `[3, 3]` → `[0.12, 0.12]` |
| `apps/website/src/scenes/act1_act2/scene_02_core_baked.tsx` | Grid | 8 nodes: `[4, 3]` → `[0.15, 0.12]` |
| `apps/website/src/scenes/act5_act6/scene_02_arch_overview.tsx` | Hierarchical | 8 nodes: `[4, 3]` → `[0.15, 0.12]` |

**ManualLayout files — NO SIZE CHANGES (already NVS):**
- `apps/website/src/scenes/act5_act6/scene_01_simple_diagram.tsx`
- `apps/website/src/scenes/act5_act6/scene_03_arch_detail.tsx`
- `apps/website/src/scenes/act7/scene_02_combined.tsx`
- `apps/examples/src/core-showcase/scenes.tsx`
- `apps/examples/src/canvas-region/scenes/viewerScene.tsx`

### 8.3 Test Files

#### Test Inventory: Explicit Accounting

**Constraint:** Net test count must NOT decrease. Every deleted test must have a replacement that tests the equivalent contract in NVS terms.

##### Tests DELETED (old contract, no longer valid):

| File | Tests deleted | Reason |
|---|---|---|
| `normalizeToViewport.test.ts` | ALL (~6 tests) | Old tests assert per-axis-independent scaling. Entire file rewritten. |
| `compile.test.ts` | `describe('contentAspect')` block (~3 tests) | `contentAspect` field removed from `DiagramState` |
| `diagramRenderer.test.ts` | `contentAspect`/`sizeScaleX`/`sizeScaleY` tests (~5 tests) | Aspect correction removed from render path |

**Total deleted: ~14 tests**

##### Tests REWRITTEN (same contract, NVS values):

| File | Tests rewritten | What changes |
|---|---|---|
| `normalizeToViewport.test.ts` | 8 new tests (see below) | Replaces 6 deleted. Net +2. |
| `compile.test.ts` | Thickness normalization tests (~2 tests) | Assert `* thicknessNormFactor` instead of `/ safeSpan` |
| `compile.test.ts` | Node size output tests (~3 tests) | Assert NVS pass-through instead of content-unit division |
| `archDiagramEdgeRouting.test.ts` | Fixture node sizes | `[4, 2]` → `[0.15, 0.08]` in all test fixtures |
| `handlers.test.tsx` | Expected output assertions | Remove `contentAspect` from expected `DiagramState`, update node sizes |

##### Tests UPDATED (fixture-only changes, no logic change):

| File | Change |
|---|---|
| `functionalTransitionSpec.test.ts` | Remove `contentAspect` from `DiagramState` fixtures |
| `ghostNode.test.ts` | Remove `contentAspect` from `DiagramState` fixtures |
| `nvsBounds.test.ts` | Remove `contentAspect` from `DiagramState` fixtures |
| `diagramWidget.test.ts` | Remove `contentAspect` from mock `DiagramState` objects |
| `diagramPlugin.test.ts` | Remove `contentAspect` from test fixtures |
| `sceneTrackCompiler.test.ts` | Remove `contentAspect` from mock `DiagramState` objects if present |

##### Tests ADDED (new contract coverage):

| File | New tests | Coverage |
|---|---|---|
| `normalizeToViewport.test.ts` (rewrite) | 8 tests | Centering, Y-flip, scale-to-fit, thicknessNormFactor |
| `nvsLayoutIntegration.test.ts` (new file) | 8 tests | End-to-end NVS pipeline for all layout kinds |
| `compile.test.ts` | 2 tests | Scale-to-fit integration, thickness with scaleFactor |

**Total added: ~18 tests. Net change: +4 tests minimum.**

---

#### Detailed test specifications:

**`packages/diagram/src/elements/diagram/__tests__/normalizeToViewport.test.ts` (REWRITE — 8 tests):**

```typescript
describe('normalizeToViewport', () => {
  it('centers a single node at [0.5, 0.5] with Y-flip', () => {
    // Node at origin [0, 0, 0] with size [0.15, 0.08]
    // → centered at NVS [0.5, 0.5, 0]
  });

  it('passes sizes through unchanged when layout fits in [0..1]', () => {
    // Input size [0.15, 0.08] → output size [0.15, 0.08] (no scaling)
  });

  it('centers a multi-node layout symmetrically', () => {
    // Two nodes at [-0.1, 0] and [0.1, 0] → centered around [0.5, 0.5]
  });

  it('Y-flips group bounds correctly', () => {
    // Cartesian group at y=0.1 (bottom), h=0.2 → NVS y = top of group
  });

  it('computes thicknessNormFactor from defaultNodeSize', () => {
    // defaultNodeSize [0.15, 0.08] → factor = 1/0.15 ≈ 6.667
  });

  it('uniformly scales dense layouts that exceed [0..1]', () => {
    // 8 nodes in a row: total span = 1.62 → scaleFactor = 0.96/1.62 ≈ 0.593
    // All positions and sizes scaled by same factor
    // Verify: no position outside [0.02, 0.98] range
    // Verify: all sizes scaled by identical factor
    // Verify: aspect ratio of each node preserved (w/h ratio unchanged)
  });

  it('does not scale layouts that fit within [0..1]', () => {
    // 4 nodes in a 2×2 grid, total span = 0.72 → scaleFactor = 1.0
    // Positions centered, sizes unchanged
  });

  it('handles empty node list', () => {
    // Returns empty maps, thicknessNormFactor still computed
  });
});
```

**`packages/diagram/src/elements/diagram/__tests__/nvsLayoutIntegration.test.ts` (NEW FILE — 8 tests):**

End-to-end test that verifies `compileDiagram()` produces correct NVS output:

```typescript
describe('NVS layout integration', () => {
  it('grid layout produces centered NVS positions within [0..1]', () => {
    // 4 nodes, default sizes → all positions in [0..1], sizes ≈ theme default
  });

  it('hierarchical layout produces correct level spacing in NVS', () => {
    // 3-level hierarchy → verify inter-level Y gaps match NVS spacing
  });

  it('flow layout produces sequential NVS positions', () => {
    // 3 nodes top-down → verify Y positions increase (NVS Y-down) with gap
  });

  it('manual layout preserves explicit NVS positions', () => {
    // Explicit position [0.3, 0.7, 0] → output [0.3, 0.7, 0] (no scaling)
  });

  it('thickness uses fixed normalization factor', () => {
    // node.thickness = 0.5, defaultSize = [0.15, 0.08]
    // output thickness = 0.5 * (1/0.15) ≈ 3.333
  });

  it('dense grid triggers uniform scale-to-fit', () => {
    // 12 nodes in a 4×3 grid with default sizes
    // Verify: all positions in [0.02, 0.98], all sizes uniformly reduced
  });

  it('edge anchors align with node surfaces (no aspect distortion)', () => {
    // Two nodes at known positions → edge route anchors at nodeCenter ± size/2
  });

  it('scale-to-fit adjusts thicknessNormFactor proportionally', () => {
    // Dense layout where scaleFactor < 1 → thicknessNormFactor = scaleFactor / max(defaultSize)
    // Verify thickness output is proportionally smaller
  });
});
```

**`packages/diagram/src/elements/diagram/__tests__/compile.test.ts` (ADD 2 tests):**

```typescript
describe('scale-to-fit integration', () => {
  it('applies uniform scale when grid layout exceeds viewport', () => {
    // Create a DSL with 10 nodes in a single row (total NVS span > 1.0)
    // Verify: all node positions within [0..1], sizes uniformly reduced
  });

  it('thickness normalization accounts for scale factor', () => {
    // Dense layout with scaleFactor < 1 → thickness = raw * scaleFactor / maxDefaultSize
  });
});
```

#### Layout algorithm regression tests

The existing layout algorithm tests in `gridLayout.test.ts`, `hierarchicalLayout.test.ts`, and `flowLayout.test.ts` must be verified to still pass at NVS scale. These tests are coordinate-system-agnostic (they test relative positioning), but their fixture constants may use old content-unit defaults as `defaultNodeSize` parameters. **Update any `[4, 2]` default node size in test fixtures to `[0.15, 0.08]`**. The test assertions about relative positioning (node A is left of node B, level 1 is above level 2) remain valid — only the numeric scale changes.

#### Edge routing regression

`archDiagramEdgeRouting.test.ts` already operates at NVS scale. Update the fixture node sizes from content units to NVS fractions. The edge router is scale-invariant — the tests should pass with only fixture value changes. Add one new assertion:

```typescript
it('edge routing produces identical topology at NVS scale vs old content-unit scale', () => {
  // Verify: same node graph at NVS scale produces same edge path topology
  // (same sequence of commands: M, L, C, etc.) as the old scale
});
```

### 8.4 Documentation Updates

| File | Changes |
|---|---|
| `packages/claude-author/docs/guides/nvs-spatial-model.md` | Update sizing section: all diagram sizes are NVS fractions. Remove dual-system documentation. Add NVS sizing recipes. |
| `packages/claude-author/docs/guides/layout-spatial-awareness.md` | Update: all layout props are NVS fractions. |
| `packages/claude-author/docs/diagram/nodes-edges-groups.md` | Update: `size` documentation, remove content-unit references. |
| `packages/claude-author/docs/diagram/overview.md` | Update: sizing model description. |
| `packages/claude-author/docs/guides/common-gotchas.md` | Remove the "content units vs NVS" gotcha. Add: "all sizes are NVS fractions [0..1]". |

**NVS Sizing Recipes (add to spatial-awareness guide):**

```markdown
## NVS Node Sizing Recipes

| Recipe | Size | Use Case |
|---|---|---|
| Standard | `[0.15, 0.08]` | Default. 6-12 node diagrams. |
| Compact | `[0.10, 0.06]` | Dense diagrams (13+ nodes). |
| Hero | `[0.25, 0.14]` | Title/header nodes. |
| Wide | `[0.22, 0.10]` | Nodes with long labels. |
| Square | `[0.12, 0.12]` | Icon-heavy nodes, circle shapes. |
| Banner | `[0.35, 0.10]` | Full-width title bars. |
```

---

## 9. Verification Checklist

After all streams complete:

1. `pnpm typecheck` — passes (no `contentAspect` references remain)
2. `pnpm test` — passes (all test fixtures updated)
3. `pnpm build` — passes
4. `pnpm dev` — visual verification:
   - [ ] `apps/examples/` diagram scenes render correctly
   - [ ] `apps/website/` diagram scenes render correctly
   - [ ] Node aspect ratios are preserved (no distortion)
   - [ ] Edge anchors align with node surfaces
   - [ ] Group bounds enclose their children correctly
   - [ ] Thickness/border proportions look correct
   - [ ] ManualLayout diagrams are unchanged
   - [ ] Transitions between scenes with diagrams animate smoothly
   - [ ] Dense diagrams (12+ nodes) scale-to-fit correctly (no clipping, uniform shrink)
   - [ ] Scale-to-fit does NOT activate for typical 6-8 node diagrams
5. No console warnings about `MANUAL_LAYOUT_NODE_SIZE_SUSPICIOUS`
6. No console warnings about NVS validation failures

---

## 10. Files Changed Summary

### Modified (29 files):

**Compiler pipeline (5):**
- `packages/diagram/src/elements/diagram/compiler/normalizeToViewport.ts` — rewrite (center + uniform-scale-to-fit + Y-flip; `_padding` param removed)
- `packages/diagram/src/elements/diagram/compile.ts` — remove contentAspect, safeSpan, ManualLayout special-case; remove `_padding` arg from `normalizeToViewport()` call
- `packages/diagram/src/elements/diagram/compiler/diagramLayoutConstants.ts` — NVS constants
- `packages/diagram/src/elements/diagram/compiler/layoutResolver.ts` — NVS defaults
- `packages/diagram/src/compiler/handlers.ts` — delete `contentAspect: 1.0` from `makeDefaultDiagramState()`

**Layout algorithms (1):**
- `packages/diagram/src/elements/diagram/compiler/layoutAlgorithms.ts` — default parameter

**Layout algorithm internals (2):**
- `packages/diagram/src/elements/diagram/compiler/layout/gridLayout.ts` — fallback constant
- `packages/diagram/src/elements/diagram/compiler/layout/hierarchicalLayout.ts` — fallback constant

**Types and DSL (2):**
- `packages/diagram/src/elements/diagram/types.ts` — remove contentAspect
- `packages/diagram/src/elements/diagram/dsl.tsx` — JSDoc updates

**Rendering (1):**
- `packages/diagram/src/elements/diagram/render.ts` — remove aspect correction

**Themes (12):**
- `packages/diagram/src/elements/diagram/themes/{enterprise,darkGlass,neonCyber,midnight,lightMinimal,lightCanvas}.ts`
- `packages/themes/src/presets/diagram/{enterprise,darkGlass,neonCyber,midnight,lightMinimal,lightCanvas}.ts`

**Consumer scenes (8):**
- `apps/examples/src/slides-demo/deck.tsx`
- `apps/examples/src/views/scenes/scene3-carousel.tsx`
- `apps/examples/src/carousel-selection/scenes/scenePicker.tsx`
- `apps/examples/src/carousel-selection/scenes/sceneDiagramDetail.tsx`
- `apps/examples/src/input-showcase/scenes/scene2-camera-controls.tsx`
- `apps/website/src/scenes/act1_act2/scene_01_core_intro.tsx`
- `apps/website/src/scenes/act1_act2/scene_02_core_baked.tsx`
- `apps/website/src/scenes/act5_act6/scene_02_arch_overview.tsx`

**Tests (11):**
- `packages/diagram/src/elements/diagram/__tests__/normalizeToViewport.test.ts` — rewrite
- `packages/diagram/src/elements/diagram/__tests__/compile.test.ts`
- `packages/diagram/src/elements/diagram/__tests__/functionalTransitionSpec.test.ts`
- `packages/diagram/src/elements/diagram/__tests__/ghostNode.test.ts`
- `packages/diagram/src/elements/diagram/__tests__/nvsBounds.test.ts`
- `packages/diagram/src/elements/diagram/__tests__/diagramWidget.test.ts`
- `packages/diagram/src/elements/diagram/__tests__/diagramRenderer.test.ts`
- `packages/diagram/src/elements/diagram/__tests__/archDiagramEdgeRouting.test.ts`
- `packages/diagram/src/player/__tests__/diagramPlugin.test.ts`
- `packages/diagram/src/compiler/__tests__/handlers.test.tsx`
- `packages/core/src/compiler/__tests__/sceneTrackCompiler.test.ts`

**Docs (5):**
- `packages/claude-author/docs/guides/nvs-spatial-model.md`
- `packages/claude-author/docs/guides/layout-spatial-awareness.md`
- `packages/claude-author/docs/diagram/nodes-edges-groups.md`
- `packages/claude-author/docs/diagram/overview.md`
- `packages/claude-author/docs/guides/common-gotchas.md`

### New (1 file):
- `packages/diagram/src/elements/diagram/__tests__/nvsLayoutIntegration.test.ts`

### No changes needed:
- `packages/diagram/src/elements/diagram/compiler/edgeRouter.ts` — already operates on NVS positions
- `packages/diagram/src/elements/diagram/compiler/routingSpace.ts` — Y-flip is still needed
- `packages/diagram/src/elements/diagram/compiler/layout/bounds.ts` — coordinate-agnostic
- `packages/diagram/src/elements/diagram/compiler/layout/flowLayout.ts` — reads gap from config
- ManualLayout consumer files — already use NVS sizes

---

## 11. Risk Mitigation

| Risk | Mitigation |
|---|---|
| NVS default sizes produce visually wrong diagrams | Visual testing with all representative scenes before merge. The values in Section 2.2 are educated starting points — adjust based on dev server rendering. |
| Edge routing breaks with new coordinate scale | Edge router is scale-invariant (operates on NVS positions). The class of position/size mismatch bugs is *eliminated* by this migration. |
| Theme files in `@brewsite/themes` and `packages/diagram/themes` diverge | Dev 5 updates both sets in the same commit. CI typecheck catches any missed theme field. |
| `contentAspect` removal breaks external consumers | Major version bump. TypeScript compilation error is the correct signal for external consumers. |
| Thickness visual appearance changes | The `thicknessNormFactor` is calibrated to produce equivalent render-time values. The factor `1/0.15 ≈ 6.667` combined with typical `thicknessScale` values produces the same world-space extrusion as the old `1/safeSpan` path for medium-density diagrams. Verify with visual testing. |
| Dense layouts shrink unexpectedly via scale-to-fit | Scale-to-fit only activates when `max(spanX, spanY) > 0.96`. For typical 6-12 node diagrams this never triggers. When it does, the uniform scaling preserves aspect ratios — the diagram looks correct, just smaller. The 2% margin prevents edge artifacts. If a scene author wants a dense diagram without shrinking, they should use smaller `size` values (e.g., `[0.10, 0.06]` compact recipe). |
| Group padding/titleGap not scaled by scale-to-fit | Intentional — padding is a visual property. If padding were scaled, dense diagrams would have vanishing group borders. If this proves visually wrong, the fix is to optionally scale padding (additive, not breaking). |
