---
title: "Feature Note: Migrate Diagram Node Sizes from Content Units to NVS Fractions"
doc_type: note
owner: Toolkit Product
status: implemented
updated: 2026-03-19
change_history:
  - date: 2026-03-19
    author: Toolkit PM (PM-1)
    summary: "Initial feature note created. Proposed Option D (boundary conversion) with phased migration."
  - date: 2026-03-19
    author: Toolkit PM (PM-2 review)
    summary: "Debate resolved: Option D rejected due to round-trip flaw. Option C adopted. All layout props migrate simultaneously in one major bump. Added thickness normalization strategy (Section 9b), edge control point analysis (Section 9c), ergonomics caveats for NVS defaults, and NVS equivalents table."
  - date: 2026-03-19
    author: Toolkit PM
    summary: "Marked as implemented. All streams complete, architect-verified, tests passing. Note: the thicknessNormFactor formula in the plan (Section 2.3) was inverted — plan said `scaleFactor / max(defaultNodeSize)` but the correct implementation uses `scaleFactor * max(defaultNodeSize)`. The plan formula would have produced ~200x oversized thickness values (dividing by 0.15 ≈ 6.67x instead of multiplying). The implementation correctly multiplies scaleFactor by the max default size dimension."
---

# Migrate Diagram Node Sizes from Content Units to NVS Fractions

## 1. Problem Statement

Today, `<DiagramNode size={...}>` uses two incompatible coordinate systems depending on the layout mode:

| Layout Mode | `size` units | Example | Normalization |
|---|---|---|---|
| GridLayout, HierarchicalLayout, FlowLayout | "Diagram content units" — arbitrary layout-space values | `size={[4, 2]}` | `normalizeToViewport()` divides by bounding-box span per-axis |
| ManualLayout | NVS fractions [0..1] | `size={[0.15, 0.15]}` | None — passed through unchanged |

Every other BrewSite element (Models, Charts, ImagePanels, Screens) sizes in NVS fractions uniformly, regardless of layout. Diagram is the only element with a dual-coordinate-system size prop.

### Concrete Problems

1. **Aspect ratio distortion.** `normalizeToViewport()` normalizes X and Y axes independently (`sw / safeSpanX`, `sh / safeSpanY`). A `size={[4, 2]}` node with `safeSpanX=20` and `safeSpanY=10` becomes NVS `[0.2, 0.2]` — a square, not the 2:1 rectangle the author intended. The `contentAspect` / `sizeScaleX` / `sizeScaleY` correction in `render.ts` exists solely to undo this distortion. This correction was recently patched (current git status shows changes) because it only applied to sizes, not positions, causing edge anchors to misalign.

2. **AI authoring confusion.** Bots frequently write `size={[0.15, 0.1]}` for auto-layout diagrams (treating it as NVS) or `size={[4, 2]}` for manual-layout diagrams (treating it as content units). The compile.ts already has a runtime warning (`MANUAL_LAYOUT_NODE_SIZE_SUSPICIOUS`) to catch the second case — proof the confusion is real and ongoing.

3. **Dual-meaning prop.** The `size` prop JSDoc in `dsl.tsx` must explain both systems with a warning that one set of defaults is "NOT safe" for the other mode. This is a DX red flag for a published SDK.

4. **Normalization complexity.** The entire `normalizeToViewport.ts` module (130 lines) exists to convert content-unit positions and sizes to NVS. If sizes were NVS from the start, this module could be substantially simplified or eliminated.

5. **Layout algorithms are content-unit-coupled.** All four layout algorithms (`gridLayout.ts`, `hierarchicalLayout.ts`, `flowLayout.ts`, `resolveLayoutWithGroups`) compute positions in content units and receive `defaultNodeSize: readonly [number, number] = [4, 2]` in content units. The spacing, gap, and margin props are also content units. This creates an inescapable coupling between the layout math and the normalization pass.

## 2. Current Pipeline: End-to-End Walkthrough

### Auto-Layout Path (Grid / Hierarchical / Flow)

```
DSL → compileDiagram() → layout algorithms → normalizeToViewport() → edge routing → DiagramState → render.ts
```

1. **DSL extraction** (`handlers.ts`): Extracts `DiagramNodeDSL` objects with `size?: [number, number]` in content units.

2. **Size resolution** (`compile.ts:132-137`): `dsl.nodes.forEach(node => { size = node.size ?? theme.node.defaultSize })`. Default is `[4, 2]` content units for all themes.

3. **Layout** (`resolveLayoutWithGroups` / `resolveLayout`): Receives node sizes in content units. Computes positions in content units (Cartesian Y-up). Uses sizes for footprint calculations, spacing placement, and group bounds.

4. **Group bounds** (`groupCompiler.ts`): `resolveGroupBoundsMap()` uses content-unit positions and sizes via `computeBounds()`. Padding is in content units (`DEFAULT_GROUP_PADDING = [1.5, 1.5, 1.5, 1.5]`).

5. **Normalization** (`normalizeToViewport.ts`): Computes bounding box of all node outer edges + group bounds. Adds padding. Normalizes each axis independently:
   ```typescript
   nx = (px - originX) / safeSpanX;
   ny = 1 - (py - originY) / safeSpanY;  // Y-flip
   normalizedSize = [sw / safeSpanX, sh / safeSpanY];
   ```
   Returns `contentAspect = safeSpanX / safeSpanY` for render-time correction.

6. **Thickness normalization** (`compile.ts:273`): `thickness: node.thickness / safeSpan` — converts thickness from content units to NVS fraction using max(spanX, spanY).

7. **Edge routing** (`edgeRouter.ts`): Operates on normalized NVS positions and sizes. Scale-invariant.

8. **Render** (`render.ts:200-237`): Computes `sizeScaleX` / `sizeScaleY` from `contentAspect` vs viewport aspect ratio. Applies correction to `uniformWorldW` / `uniformWorldH` to produce `scaledWorldW` / `scaledWorldH`. ALL NVS→world conversions use the corrected dimensions.

### Manual-Layout Path

```
DSL → compileDiagram() → positions passed through → edge routing → DiagramState → render.ts
```

1. Sizes are already NVS fractions. No normalization. `contentAspect = 1.0`.
2. `safeSpan` is computed as a virtual scale factor: `theme.node.defaultSize[0] / medianNvsWidth`.
3. No `sizeScaleX` / `sizeScaleY` correction needed (aspect ratio = 1:1).

## 3. What Would Change if Sizes Were Authored in NVS Directly

### Core Insight

If `<DiagramNode size={[0.15, 0.08]}>` meant "15% of diagram viewport width, 8% of height" in ALL layout modes, then:

1. **`normalizeToViewport()` would only normalize positions, not sizes.** Sizes are already in NVS.
2. **`contentAspect` distortion disappears.** With NVS sizes, both axes are already in the same [0..1] space. The per-axis independent normalization of sizes that causes the aspect ratio distortion goes away.
3. **`sizeScaleX` / `sizeScaleY` correction in `render.ts` is eliminated.** The render pass becomes: `worldW = nodeState.size[0] * uniformWorldW; worldH = nodeState.size[1] * uniformWorldH`. No correction needed.
4. **Layout algorithms must change.** They currently work in content-unit space and use content-unit sizes for footprint calculations. They must be updated to work in NVS space directly (Option C — see Section 5).

### Would Aspect Ratio Correction Still Be Needed?

**No — if node sizes are authored as NVS fractions.** The current `sizeScaleX`/`sizeScaleY` correction exists because `normalizeToViewport()` divides widths by `safeSpanX` and heights by `safeSpanY` independently, which distorts the aspect ratio when `safeSpanX ≠ safeSpanY`. If sizes bypass normalization entirely (they're already NVS), this distortion can't occur.

However, **position normalization still needs attention.** Positions produced by layout algorithms are in content units and must map to [0..1]. If we normalize positions per-axis independently, the relative placement of nodes would still reflect content-unit spacing ratios. But since the nodes' physical sizes are NVS fractions (viewport-relative), they'd render correctly regardless of position normalization distortion. The visual effect is that node spacing might not be perfectly isotropic — but that's already the case and is actually desirable (layout fills the viewport).

## 4. Impact on Spacing, Gap, Margin, and Group Padding

### Current State

| Prop | Unit | Consumed By |
|---|---|---|
| `spacing` (GridLayout, HierarchicalLayout) | Content units `[colGap, rowGap]`, default `[2, 2]` | Layout algorithms |
| `margin` (GridLayout, HierarchicalLayout) | Content units `[h, v]`, default `[0, 0]` | Layout algorithms |
| `gap` (FlowLayout) | Content units, default `2` | `resolveFlowLayout()` |
| `groupPadding` (auto-layout) | Content units `[T, R, B, L]`, default `[1.5, 1.5, 1.5, 1.5]` | `groupCompiler.ts` → normalized in `normalizeToViewport()` |
| `groupPadding` (ManualLayout) | NVS fractions, default `[0.025, 0.025, 0.025, 0.025]` | `groupCompiler.ts` (no normalization) |
| `titleGap` (auto-layout) | Content units, default `1` | `groupCompiler.ts` → normalized |
| `titleGap` (ManualLayout) | NVS fractions, default `0.025` | `groupCompiler.ts` (no normalization) |

### Must They Migrate Too?

**Yes — spacing/gap/margin must migrate in the same release as size.**

Three reasons compel simultaneous migration:

1. **Mixed-unit incoherence.** If sizes are NVS fractions but spacing remains content units, the DSL surface presents `<GridLayout spacing={[2, 2]}>` alongside `<DiagramNode size={[0.15, 0.08]}>`. The spacing-to-size ratio becomes unintuitive — "2 content units" has no obvious relationship to "0.15 NVS." This is a DX regression that replaces one form of confusion with another.

2. **Layout algorithms require consistent units.** `computeBounds()` in `bounds.ts` computes bounding boxes as `position[i] ± size[i]/2`. `resolveLayoutWithGroups()` calls `computeBounds([...allDescendantNodeIds], expandedPositions, sizes)` where positions and sizes must be in the same coordinate space. If we convert sizes to NVS while spacing remains content units, the layout pass uses content-unit spacing to position nodes but NVS sizes for footprints — producing incorrect bounding boxes. The only clean solution is to have all values in the same unit system.

3. **Deferring means two consecutive major bumps.** Spacing/gap/margin are public DSL props (`<GridLayout spacing={...}>`, `<FlowLayout gap={...}>`). Changing their unit semantics is a breaking change requiring another major version. Two major bumps in rapid succession is worse for consumers than one comprehensive migration.

**Group padding** already has a dual-default problem (auto-layout uses `[1.5, 1.5, 1.5, 1.5]` content units; ManualLayout uses `[0.025, 0.025, 0.025, 0.025]` NVS fractions). This split is eliminated by uniform NVS.

**Recommendation: Migrate all layout props (size, spacing, gap, margin, groupPadding, titleGap) to NVS fractions in a single major-version release.**

## 5. Impact on Group Bounds

Group bounds (`GroupBounds`) are computed from the union of child node positions + sizes, plus resolved padding:

```typescript
// groupCompiler.ts
const nodeBounds = computeBounds(group.nodeIds, positions, sizes);
// → padded by: x: base.x - pl, y: base.y - pb, w: base.w + pl + pr, h: base.h + pb + pt
```

If node sizes become NVS fractions but positions remain content units during layout, `computeBounds()` would be mixing coordinate systems — **this is the core layout challenge**.

### Options

**Option A: NVS sizes but content-unit positions during layout.** `computeBounds()` uses sizes to compute the bounding box: `px - sw/2` to `px + sw/2`. If `px` is in content units and `sw` is in NVS fractions, the bounds are nonsensical. **This doesn't work without conversion.**

**Option B: Convert NVS sizes to content units at the start of layout, then normalize everything back.** This is essentially the status quo with an extra layer of indirection. No benefit.

**Option C: Make the layout algorithms work entirely in NVS space.** Positions and sizes are all in [0..1]. Spacing/gap/margin are also NVS fractions. Layout produces final NVS positions directly. **No `normalizeToViewport()` needed.** This is the clean end-state and requires rewriting the layout algorithms and `normalizeToViewport`.

**~~Option D: Keep layout algorithms in their own unit space; treat node `size` on the DSL as NVS, and internally convert at the layout boundary.~~** **REJECTED.** Option D has a critical round-trip flaw: the NVS→content-unit scale factor at entry depends on the layout's bounding box, which is the *output* of the layout pass. The dependency is circular. Furthermore, even with an arbitrary synthetic scale factor, `normalizeToViewport()` normalizes sizes per-axis independently (`sw / safeSpanX`, `sh / safeSpanY`), so the round-trip `NVS → (× scale) → layout → normalizeToViewport → NVS` does NOT preserve the original NVS sizes unless `safeSpanX === safeSpanY === scale`. Modifying `normalizeToViewport()` to pass sizes through unchanged while still normalizing positions per-axis independently creates a position/size coordinate mismatch that breaks edge anchor alignment — the exact same class of bug recently patched in `render.ts` (lines 211-215). Option D is not a thin adapter; it requires nearly the same normalization rewrites as Option C.

**Recommendation: Option C.** Layout algorithms work entirely in NVS space. All DSL props (size, spacing, gap, margin, groupPadding) are NVS fractions. Layout produces NVS positions directly. `normalizeToViewport()` is replaced with a simpler `positionToNVS()` that only handles Y-flip and centering (no per-axis-independent size scaling). This is the only option that cleanly eliminates the aspect ratio distortion without introducing new coordinate mismatches.

### What Option C Requires

The layout algorithms themselves are not complex — `gridLayout.ts` is 145 lines, `hierarchicalLayout.ts` is 247 lines, `flowLayout.ts` is 88 lines. The core logic (topological sort, row placement, level assignment) is coordinate-system-agnostic — it produces *relative* positions from node footprints and gaps. Switching from content units to NVS fractions changes the scale of inputs and outputs but not the algorithm structure.

The key changes per algorithm:
1. **Input sizes** change from e.g. `[4, 2]` to `[0.15, 0.08]` — same arithmetic, smaller numbers.
2. **Spacing/gap** values change from e.g. `[2, 2]` to `[0.05, 0.05]` — same arithmetic, smaller numbers.
3. **Position output** is already in the same space as inputs — no normalization needed.
4. **`computeBounds()`** — unchanged, as positions and sizes are now in the same NVS space.
5. **`resolveGroupBoundsMap()`** — padding is now NVS fractions (unified with ManualLayout). No dual defaults.
6. **`normalizeToViewport()`** — replaced with a trivial Y-flip + centering pass for the layout output. Sizes pass through unchanged. No per-axis-independent scaling.
7. **`contentAspect`** — becomes always `1.0` (or removed). The render-time `sizeScaleX`/`sizeScaleY` correction is eliminated.

## 6. Consumer Impact Audit

### Files with explicit `size=` in auto-layout diagrams

**`apps/examples/`** (private, not published):
- `slides-demo/deck.tsx` — 6 nodes with `size={[3.5, 3.5]}`, `[4, 4]}` (content units, auto-layout)
- `views/scenes/scene3-carousel.tsx` — 13 nodes with `size={[5.0, 2.5]}` (content units, flow layout)
- `carousel-selection/scenes/scenePicker.tsx` — 5 nodes with `size={[6, 2.5]}`, `[4, 2]}` (content units, hierarchical layout)
- `carousel-selection/scenes/sceneDiagramDetail.tsx` — 1 node with `size={[9, 2.5]}` (content units)
- `input-showcase/scenes/scene2-camera-controls.tsx` — 12 nodes with `size={[5.0, 2.5]}` (content units)

**`apps/website/`** (private, not published):
- `act1_act2/scene_01_core_intro.tsx` — 3 nodes with `size={[3, 3]}` (content units, grid layout)
- `act1_act2/scene_02_core_baked.tsx` — 8 nodes with `size={[4, 3]}` (content units, grid layout)
- `act5_act6/scene_02_arch_overview.tsx` — 8 nodes with `size={[4, 3]}` (content units, hierarchical layout)

**`apps/website/`** (ManualLayout, already NVS):
- `act5_act6/scene_01_simple_diagram.tsx` — 4 nodes with `size={[0.15, 0.15]}` (NVS, manual layout)
- `act5_act6/scene_03_arch_detail.tsx` — 10 nodes with `size={[0.15, 0.15]}`, `[0.18, 0.13]}` (NVS, manual layout)
- `act7/scene_02_combined.tsx` — 4 nodes with `size={[0.15, 0.15]}` (NVS, manual layout)

**`apps/examples/` (ManualLayout, already NVS)**:
- `core-showcase/scenes.tsx` — ~10 nodes with NVS sizes

**`old_examples_do_no_use/`** — many nodes with content-unit sizes (via shared `S` constant). Not production.

**Test files** (`packages/diagram/src/player/__tests__/`):
- `sceneCfOverviewRouting.test.tsx` — ~20 nodes with content-unit sizes

**Published package defaults** (all themes):
- `theme.node.defaultSize = [4, 2]` in all 6 themes. This is the primary default and must change.

### Total files needing migration: ~12 active files, ~3 test files, 6 theme files

All are either private apps or internal tests. No external consumer code would be affected until the published `@brewsite/diagram` API default changes — which is a **major semver bump**.

## 7. Migration Path Analysis

### Option 1: Hard Cut (Major Version Bump)

- Change `theme.node.defaultSize` from `[4, 2]` to NVS fractions (e.g., `[0.18, 0.10]`).
- Update DSL prop documentation to state sizes are always NVS fractions.
- Update all consumer files in-tree.
- Publish as `@brewsite/diagram` next major.

**Pro:** Clean, simple, no legacy overhead.
**Con:** Major semver bump. All consumers must update `size` values. No gradual migration.

### Option 2: Adapter Layer with Deprecation

- Introduce a new prop name (e.g., `nvsSize` or make `size` polymorphic with a discriminator).
- At compile time, detect which unit system is in use (heuristic: values > 1.5 are likely content units).
- Emit deprecation warning for content-unit sizes.
- Remove content-unit support in the next major version.

**Pro:** Gradual migration. Non-breaking initially.
**Con:** Adds complexity to the compiler. Heuristic detection is fragile. Two code paths during the deprecation period.

### Option 3: Codemod

- Write a TypeScript codemod that converts `size={[w, h]}` values from content units to NVS fractions.
- The conversion factor is `1 / theme.node.defaultSize[0]` for width, `1 / theme.node.defaultSize[1]` for height — approximately `[w/20, h/10]` depending on the diagram's content span.

**Pro:** Automated migration.
**Con:** The conversion factor isn't knowable statically — it depends on the full diagram's bounding box at compile time. A codemod can only approximate using the theme default as a reference. This is inherently imprecise for diagrams where nodes have heterogeneous sizes.

### Decision: Option 1 (Hard Cut) — CONFIRMED

The consumer base is small and entirely in-tree. There are no published consumers using the `size` prop with content-unit values that we don't control. A clean major-version bump with in-tree migration is the lowest-risk, lowest-complexity path. Options 2 and 3 are rejected — no adapter layer, no codemod.

## 8. Impact on Theme Defaults

All 6 themes define `defaultSize: [4, 2] as const`:
- `darkGlass.ts`, `enterprise.ts`, `lightMinimal.ts`, `lightCanvas.ts`, `neonCyber.ts`, `midnight.ts`

These must change to NVS fractions. The right default depends on the typical diagram density:

| Diagram Type | Typical Node Count | Suggested Default NVS Size |
|---|---|---|
| Simple (3-5 nodes) | 3-5 | `[0.20, 0.12]` |
| Medium (6-12 nodes) | 6-12 | `[0.15, 0.08]` |
| Dense (13+ nodes) | 13+ | `[0.10, 0.06]` |

Since themes should work well for medium-density diagrams without requiring per-node overrides, **`[0.15, 0.08]`** is a starting candidate — approximately 15% of viewport width and 8% of viewport height. The 2:1 aspect ratio is preserved, which is important for text readability.

### Ergonomics Caveat

These values are **educated guesses that require visual testing** before committing. Concerns:

1. **Absolute rendering size depends on diagram viewport bounds.** If `<Diagram w={0.5} h={0.5}>`, a `size={[0.15, 0.08]}` node is 7.5% of screen width — potentially too small for label text. The default should work well for full-viewport diagrams (`w={1} h={1}`).

2. **NVS fractions are less intuitive for authoring than content units.** With content units, `[4, 2]` communicates "twice as wide as tall, medium-sized." With NVS fractions, `[0.15, 0.08]` communicates... a percentage. The proportional relationship between nodes is harder to eyeball. However, this is the same tradeoff that ManualLayout, Charts, ImagePanels, and Models all accepted — and those elements work fine.

3. **Per-theme variation is worth considering.** Enterprise themes (dense, data-heavy) might default to `[0.12, 0.06]`; marketing themes (simple, hero nodes) might default to `[0.20, 0.12]`. The theme already has `defaultSize` — different themes can set different defaults.

4. **AI authoring recipes are critical.** The `claude-author` docs should provide named "recipes" like: "standard node: `size={[0.15, 0.08]}`", "hero node: `size={[0.25, 0.14]}`", "compact node: `size={[0.10, 0.06]}`". This makes NVS sizing teachable.

The architect must validate the proposed defaults with the representative diagrams in `apps/examples/` and `apps/website/` before finalizing.

## 9. Simplification vs. Complication of Layout Algorithms

### What Simplifies
- **`normalizeToViewport.ts`** — replaced with a trivial Y-flip + centering utility. Per-axis-independent size scaling removed entirely. The ~130-line module shrinks to ~30 lines.
- **`render.ts`** — `sizeScaleX` / `sizeScaleY` / `contentAspect` correction eliminated (~30 lines). The `scaledWorldW`/`scaledWorldH` concept simplifies to `uniformWorldW`/`uniformWorldH` with no aspect correction.
- **`compile.ts`** — ManualLayout-specific `safeSpan` heuristic (`medianW`/`medianH` computation, lines 230-246) removed. ManualLayout and auto-layout paths converge.
- **`diagramLayoutConstants.ts`** — dual defaults eliminated. No more `DEFAULT_MANUAL_GROUP_PADDING` vs `DEFAULT_GROUP_PADDING`. One set of NVS-fraction defaults for all layout modes.
- **The `MANUAL_LAYOUT_NODE_SIZE_SUSPICIOUS` warning** (compile.ts:252-263) becomes unnecessary.
- **`layoutResolver.ts`** — `DEFAULT_RESOLVED_MANUAL` no longer needs special NVS-scale padding. All layout defaults use the same NVS-fraction scale.

### What Requires Modification
- **Four layout algorithm files** (`gridLayout.ts`, `hierarchicalLayout.ts`, `flowLayout.ts`, `bounds.ts`) — input scale changes from content units to NVS fractions. The algorithm logic is unchanged; only the default constants and input/output scale change.
- **`defaultNodeSize`** parameter throughout layout algorithms changes from `[4, 2]` to the NVS default (e.g., `[0.15, 0.08]`).
- **All layout default constants** — spacing, gap, margin, groupPadding — change from content units to NVS fractions.
- **`resolveGroupBoundsMap()`** — padding is now NVS fractions uniformly.

### Net Assessment
The algorithm structure is coordinate-system-agnostic — topological sort, grid row placement, flow sequencing all operate on relative positions computed from node footprints and gaps. Changing the scale of inputs and outputs is mechanical. The significant simplification is in the normalization and rendering layers, where the entire aspect ratio correction machinery is removed.

## 10. Semver Impact

**Major version bump required (`@brewsite/diagram` 1.0.0 → 2.0.0 or 0.x → next major).**

Breaking changes:
1. `theme.node.defaultSize` values change from content units to NVS fractions.
2. `<DiagramNode size={...}>` semantic changes from content units to NVS fractions for auto-layout modes.
3. `<GridLayout spacing={...}>`, `<HierarchicalLayout spacing={...}>`, `<FlowLayout gap={...}>`, `margin`, `groupPadding`, and `titleGap` all change from content units to NVS fractions.
4. `DiagramThemeNodeConfig.defaultSize` type annotation doesn't change (still `readonly [number, number]`) but the expected value range changes.
5. `DiagramThemeLayoutConfig` default values change (spacing, gap, margin, groupPadding, titleGap).
6. `contentAspect` field in `DiagramState` becomes `1.0` always (or removed).
7. `thickness` (node, edge) and `borderWidth`/`borderHeight` (group) normalization changes — see Section 9b.

### Migration Guide for External Consumers

```typescript
// Before (content units, auto-layout):
<DiagramNode id="api" size={[4, 2]} />

// After (NVS fractions):
<DiagramNode id="api" size={[0.15, 0.08]} />

// Manual-layout nodes: NO CHANGE (already NVS)
<DiagramNode id="api" position={[0.5, 0.5, 0]} size={[0.15, 0.08]} />
```

## 9b. Thickness Normalization

### Current State

Thickness-type values (`node.thickness`, `edge.thickness`, `group.borderWidth`, `group.borderHeight`) are authored in content units and normalized by `safeSpan`:

```typescript
// compile.ts:273
thickness: node.thickness / safeSpan
// compile.ts:367
thickness: compiled.thickness / safeSpan
// compile.ts:381-382
borderWidth: compiled.borderWidth / safeSpan
borderHeight: compiled.borderHeight / safeSpan
```

`render.ts` converts back to world units via `thicknessScale = Math.round(scaledWorldW * 10) / 10`.

### Must Thickness Migrate?

**Yes — thickness normalization must change in Phase 1**, because `safeSpan` (the normalization divisor) changes meaning or disappears when sizes become NVS.

However, thickness should NOT become an NVS-fraction prop. The authoring ergonomics of `thickness={0.3}` (visual weight in diagram units, where 0.3 is "thin card" and 0.6 is "chunky block") are significantly better than `thickness={0.008}` (0.8% of viewport height). Thickness describes the Z-depth extrusion of a 3D prism — it has no meaningful relationship to the viewport's X/Y dimensions.

**Recommendation: Keep thickness as a "visual weight" value with a fixed normalization factor.** Instead of dividing by the layout-dependent `safeSpan`, normalize by a constant derived from the theme's default node size. For example:

```typescript
// The normalization factor relates thickness values to the diagram's visual scale.
// With NVS sizes, the diagram's visual scale is defined by the default node size.
// A thickness of 0.4 with defaultSize [0.15, 0.08] should produce a proportional extrusion.
const thicknessNormFactor = 1 / Math.max(defaultSize[0], defaultSize[1]);
// → 1 / 0.15 ≈ 6.67 for the proposed default
```

This is deterministic, layout-independent, and preserves the existing authoring scale (0.2-0.8 range).

## 9c. Edge Control Points and Anchor Alignment

### Current State

The edge router (`edgeRouter.ts`) operates on normalized NVS positions and sizes. Edge anchor points are computed as `nodeCenter ± nodeSize/2`. The rendered node geometry is positioned and sized using `scaledWorldW`/`scaledWorldH` (aspect-corrected).

The recent patch (visible in git status, documented in `render.ts:211-215`) fixed a bug where `sizeScaleX`/`sizeScaleY` was applied to sizes but not positions, causing edge anchors to miss the rendered node surfaces.

### Impact of This Migration

With Option C (NVS-native layout), positions and sizes are both in true NVS space. The edge router's `nodeCenter ± nodeSize/2` computation operates on consistent coordinates. The render pass converts both positions and sizes using `uniformWorldW`/`uniformWorldH` (no aspect correction needed). **Edge anchor alignment is guaranteed by construction** — there is no sizeScale correction to get wrong.

This is a strict improvement: the entire class of position/size coordinate-mismatch bugs is structurally eliminated.

## 11. Open Questions

1. **~~Should spacing/gap/margin migrate simultaneously or in a follow-up?~~** RESOLVED: Migrate simultaneously. One major bump, not two. Mixed-unit intermediate state is incoherent and the consumer base is entirely in-tree.

2. **Should `contentAspect` be removed from `DiagramState` or kept as always-1.0?** Since this is a major version bump, removing it is the cleaner path. Any consumer reading it will see a TypeScript compilation error, which is better than silently using a value that no longer means anything.

3. **What are the right default NVS sizes?** The proposed `[0.15, 0.08]` needs visual testing. Different themes may warrant different defaults — dense enterprise diagrams vs. simple marketing diagrams. The 2:1 aspect ratio should be preserved. Per-theme variation should be considered.

4. **~~Should the layout algorithms (Option C) happen in this release or a follow-up?~~** RESOLVED: Option C is the only viable approach. Option D has a critical round-trip flaw (see Section 5). Layout algorithms must work in NVS in Phase 1.

5. **Will NVS sizes make AI authoring harder?** The original "AI confusion" problem was bots mixing content units and NVS fractions. With uniform NVS, that confusion is eliminated. However, a new challenge emerges: bots must reason about viewport fractions ("is 0.15 a good node width?") instead of relative proportions ("4 is twice as wide as 2"). The `claude-author` MCP docs and the spatial awareness guide must be updated with clear NVS sizing recipes and reference diagrams. AI guidance like "default nodes are 0.15 wide, hero nodes are 0.25 wide" is more actionable than "default nodes are 4 wide."

6. **What are the NVS equivalents for all layout default constants?** The architect must specify exact values. Starting reference:

| Content Unit Default | NVS Equivalent | Derivation |
|---|---|---|
| `defaultSize: [4, 2]` | `[0.15, 0.08]` | Visual testing needed |
| `spacing: [2, 2]` (grid) | `[0.06, 0.06]` | ~40% of node width |
| `spacing: [1.5, 1.5]` (hierarchical) | `[0.05, 0.05]` | ~33% of node width |
| `gap: 2` (flow) | `0.06` | ~40% of node width |
| `margin: [0, 0]` | `[0, 0]` | Unchanged |
| `groupPadding: [1.5, 1.5, 1.5, 1.5]` | `[0.04, 0.04, 0.04, 0.04]` | ~27% of node width |
| `titleGap: 1` | `0.025` | ~17% of node width |

These are approximations. The architect should derive them from visual testing with representative diagrams.

## 12. Recommendation

**Single major-version release. All layout props migrate to NVS simultaneously.**

### Scope

1. **Node `size`** — NVS fractions across all layout modes.
2. **Layout props** — `spacing`, `gap`, `margin`, `groupPadding`, `titleGap` — all NVS fractions.
3. **Theme defaults** — all 6 themes updated with NVS-fraction values for `defaultSize`, layout spacing, padding.
4. **Layout algorithms** — rewritten to work in NVS space directly (Option C). Algorithm structure unchanged; input/output scale changes.
5. **`normalizeToViewport()`** — replaced with a Y-flip + centering utility. Per-axis-independent size scaling removed.
6. **`render.ts`** — `sizeScaleX`/`sizeScaleY`/`contentAspect` correction removed. Positions and sizes use `uniformWorldW`/`uniformWorldH` directly.
7. **Thickness normalization** — stays as visual-weight values. Normalized by a fixed factor derived from theme default node size, not from layout-dependent `safeSpan`.
8. **`contentAspect`** — removed from `DiagramState` (major version allows this).
9. **Consumer files** — all in-tree files updated with NVS-fraction values.
10. **AI authoring docs** — `claude-author` spatial awareness guide and diagram docs updated with NVS sizing reference.
11. **Tests** — all test files updated; existing test coverage maintained.

### Implementation Approach

The architect should design this as a single atomic change. The key insight is that the layout algorithm structure is coordinate-system-agnostic — changing input/output scale is mechanical. The significant work is:

1. Deriving correct NVS default constants for each layout and theme.
2. Replacing `normalizeToViewport()` with a Y-flip + centering utility.
3. Removing the aspect ratio correction from `render.ts`.
4. Designing the thickness normalization strategy.
5. Updating all consumer files (quantified in Section 6: ~12 active files, ~3 test files, 6 theme files).
