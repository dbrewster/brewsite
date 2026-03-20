---
title: "NVS Thickness Migration — Remaining Content-Unit Props"
doc_type: plan
owner: architect
status: complete
updated: 2026-03-19
---

# NVS Thickness Migration — Remaining Content-Unit Props

## Background

The recent NVS sizing migration converted node `size` and layout `gap`/`spacing` to NVS fractions. Five dimensional props remain in an opaque "content-unit" coordinate system. Their current pipeline applies two or three opaque multipliers between the authored value and the final world-unit result. Authors have no intuition for what values to type.

This plan migrates all five props to NVS fractions so that every dimensional prop in the diagram element uses the same coordinate system: **fraction of the diagram viewport**.

## Props to Migrate

| # | Prop | DSL type | State type | Current unit | Current theme range |
|---|------|----------|------------|--------------|---------------------|
| 1 | Node `thickness` | `DiagramNodeDSL.thickness` | `DiagramNodeState.thickness` | Content units | 0.22 - 1.4 |
| 2 | Edge `thickness` | `DiagramEdgeDSL.thickness` | `DiagramEdgeState.thickness` | Content units | 0.055 - 0.070 |
| 3 | Group `borderWidth` | `DiagramThemeGroupConfig.defaultBorderWidth` | `DiagramGroupState.borderWidth` | Content units | 0.25 - 1.75 |
| 4 | Group `borderHeight` | `DiagramThemeGroupConfig.defaultBorderHeight` | `DiagramGroupState.borderHeight` | Content units | 0.7 - 1.0 |
| 5 | Node `cornerRadius` | `DiagramNodeDSL.cornerRadius` | `DiagramNodeState.cornerRadius` | Content units (raw, no conversion) | 0.04 - 0.09 |

## Current Pipeline Analysis

### Node thickness, edge thickness, group borderWidth, group borderHeight

```
authored_value
  × thicknessNormFactor (compile.ts)     → NVS fraction (stored in compiled state)
  × thicknessScale (render.ts)           → world units (passed to Three.js)
```

Where:
- `thicknessNormFactor = scaleFactor × max(defaultNodeSize[0], defaultNodeSize[1])`
- For typical layouts: `scaleFactor = 1.0`, `max(0.15, 0.08) = 0.15`
- `thicknessNormFactor = 0.15` (standard case)
- `thicknessScale = Math.round(uniformWorldW × 10) / 10` (quantized uniformWorldW)

### Group borderWidth — additional multiplier

```
authored_value
  × thicknessNormFactor (compile.ts:303)  → NVS fraction
  × thicknessScale (render.ts:262)        → world units
  × GROUP_BORDER_PX_TO_UNITS (GroupRenderer.ts:424, = 0.4) → final world border width
```

Triple conversion. The 0.4 constant has no documented origin.

### Node cornerRadius — no conversion at all

```
authored_value (theme.node.cornerRadius, e.g. 0.06)
  → nodeCompiler.ts:66 passes through as-is
  → DiagramNodeState.cornerRadius
  → render.ts passes through as-is (no multiplication by uniformWorldW or thicknessScale)
  → createShapeGeometry(shape, worldSize, worldThickness, cornerRadius)
```

**Bug:** `createShapeGeometry` receives `size` and `thickness` in world units but `cornerRadius` in content units. The cornerRadius is used directly alongside world-unit dimensions. At typical viewport sizes (uniformWorldW ~ 10-15), a cornerRadius of 0.06 is negligible compared to worldW ~ 1.5, producing barely-visible rounding. The current visual result is only acceptable because theme values were hand-tuned to look reasonable at common viewport sizes.

## Design Decision: What Does "NVS Fraction" Mean for Thickness?

**Decision: Fraction of diagram viewport width (uniformWorldW).**

Justification:
1. **Consistency with existing NVS model.** Node `size[0]` is fraction of viewport width; node `size[1]` is fraction of viewport height. Thickness (Z-depth) has no natural viewport axis, but using viewport width provides a single reference dimension.
2. **Already the implicit pipeline.** The current compile/render pipeline already converts `compiled_thickness × uniformWorldW` to get world units. Making the authored value equal to the NVS fraction eliminates `thicknessNormFactor` — the pipeline becomes: `authored_nvs × uniformWorldW = world_units`.
3. **Author mental model.** "thickness 0.075 means the node is 7.5% of the viewport width deep." This is concrete and predictable.
4. **Alternative rejected: fraction of node height.** While "40% as deep as it is tall" is intuitive, it couples thickness to per-node size, making theme defaults size-dependent and breaking the invariant that theme values produce consistent visual density regardless of node size.

### cornerRadius Reference Dimension

**Decision: Fraction of viewport width (uniformWorldW), same as thickness.**

The renderer will convert `cornerRadius × uniformWorldW` alongside `size` and `thickness`. This fixes the current coordinate-system mismatch.

## Migration Math

### Common Formula

For props currently multiplied by `thicknessNormFactor` only (node thickness, edge thickness, group borderHeight):

```
new_nvs = old_content_unit × thicknessNormFactor
        = old_content_unit × 0.15
```

For group borderWidth (which additionally goes through `GROUP_BORDER_PX_TO_UNITS = 0.4`):

```
new_nvs = old_content_unit × thicknessNormFactor × GROUP_BORDER_PX_TO_UNITS
        = old_content_unit × 0.15 × 0.4
        = old_content_unit × 0.06
```

For cornerRadius (currently passed raw, but needs to produce the same visual as if it were a world unit in the current coordinate mismatch — the authored value IS effectively already in pseudo-world units at the current typical uniformWorldW):

```
new_nvs = old_content_unit / uniformWorldW_at_default_viewport
```

However, cornerRadius is currently NOT multiplied by any factor — it is raw. Since `createShapeGeometry` receives it alongside world-unit size/thickness, the effective visual fraction is:

```
effective_visual_fraction = old_cornerRadius / (node_size_world)
```

For default node (size [0.15, 0.08], uniformWorldW ~10): worldW = 1.5, worldH = 0.8.
cornerRadius 0.06 on a worldW=1.5, worldH=0.8 node is `0.06 / min(1.5, 0.8) = 0.075` of the smaller dimension.

Since the new system will convert `cornerRadius_nvs × uniformWorldW` to world units, we need:
```
new_nvs × uniformWorldW = old_value
new_nvs = old_value / uniformWorldW
```

But uniformWorldW varies with viewport! The current system's visual result is viewport-dependent — cornerRadius looks different at different viewport sizes. The migration should pick a reference scale that matches the most common viewing condition. Since we want the NVS value to be viewport-invariant (that's the whole point), we accept that the visual result after migration is slightly different at extreme viewport sizes. The reference is irrelevant — we just need `new_nvs × uniformWorldW` to equal the old raw value at the "design" viewport.

**Practical approach for cornerRadius:** Since the old value was passed raw and was effectively "world units" at whatever viewport the theme was tuned for, and since `thicknessNormFactor = 0.15` is the factor that converts other content-unit values into NVS, we apply the same factor:

```
new_nvs_cornerRadius = old_cornerRadius × 0.15
```

This is NOT mathematically rigorous — it's a pragmatic choice that produces NVS-proportional corner radii consistent with how size and thickness are already NVS-proportional. The visual result will be very close to the original at typical viewport sizes because the original values were tuned for the same implicit scale.

### Theme Value Migration Tables

#### Node defaultThickness

| Theme | Old (content units) | New NVS (old × 0.15) | Visual: % of viewport width |
|-------|--------------------:|----------------------:|----------------------------:|
| darkGlass | 1.0 | 0.150 | 15.0% |
| enterprise | 0.5 | 0.075 | 7.5% |
| neonCyber | 0.22 | 0.033 | 3.3% |
| lightMinimal | 0.30 | 0.045 | 4.5% |
| lightCanvas | 0.5 | 0.075 | 7.5% |
| midnight | 1.4 | 0.210 | 21.0% |

#### Edge defaultThickness

| Theme | Old (content units) | New NVS (old × 0.15) | Visual: % of viewport width |
|-------|--------------------:|----------------------:|----------------------------:|
| darkGlass | 0.065 | 0.00975 | ~1.0% |
| enterprise | 0.070 | 0.01050 | ~1.1% |
| neonCyber | 0.055 | 0.00825 | ~0.8% |
| lightMinimal | 0.060 | 0.00900 | ~0.9% |
| lightCanvas | 0.055 | 0.00825 | ~0.8% |
| midnight | 0.060 | 0.00900 | ~0.9% |

#### Group defaultBorderWidth

The current pipeline is: `authored × thicknessNormFactor × thicknessScale × GROUP_BORDER_PX_TO_UNITS`.
The new pipeline will be: `authored_nvs × thicknessScale` (world units, used directly by GroupRenderer).

```
new_nvs = old × 0.15 × 0.4 = old × 0.06
```

| Theme | Old (content units) | New NVS (old × 0.06) | Visual: % of viewport width |
|-------|--------------------:|----------------------:|----------------------------:|
| darkGlass | 0.25 | 0.0150 | 1.5% |
| enterprise | 0.25 | 0.0150 | 1.5% |
| neonCyber | 1.75 | 0.1050 | 10.5% |
| lightMinimal | 1.25 | 0.0750 | 7.5% |
| lightCanvas | 1.25 | 0.0750 | 7.5% |
| midnight | 0.25 | 0.0150 | 1.5% |

#### Group defaultBorderHeight

| Theme | Old (content units) | New NVS (old × 0.15) | Visual: % of viewport width |
|-------|--------------------:|----------------------:|----------------------------:|
| darkGlass | 0.7 | 0.105 | 10.5% |
| enterprise | 1.0 | 0.150 | 15.0% |
| neonCyber | 1.0 | 0.150 | 15.0% |
| lightMinimal | 1.0 | 0.150 | 15.0% |
| lightCanvas | 1.0 | 0.150 | 15.0% |
| midnight | 0.7 | 0.105 | 10.5% |

#### Node cornerRadius

| Theme | Old (raw content units) | New NVS (old × 0.15) | Visual: % of viewport width |
|-------|------------------------:|----------------------:|----------------------------:|
| darkGlass | 0.06 | 0.0090 | 0.9% |
| enterprise | 0.05 | 0.0075 | 0.75% |
| neonCyber | 0.04 | 0.0060 | 0.6% |
| lightMinimal | 0.08 | 0.0120 | 1.2% |
| lightCanvas | 0.09 | 0.0135 | 1.35% |
| midnight | 0.06 | 0.0090 | 0.9% |

## Implementation Plan

### Phase 1: Remove thicknessNormFactor from Compile Pipeline

The compile pipeline currently multiplies authored content-unit values by `thicknessNormFactor`. After migration, authored values ARE already NVS fractions — no multiplication needed. The `thicknessNormFactor` return from `normalizeToViewport()` is eliminated.

**However**, `thicknessNormFactor` also reflects `scaleFactor` (scale-to-fit). When the layout exceeds [0..1] and `scaleFactor < 1.0`, thickness and related props must scale down proportionally. The new system must preserve this behavior.

**Decision:** Keep `scaleFactor` in the normalize output (rename from `thicknessNormFactor` to `scaleFactor`). Multiply only by `scaleFactor` — not by `max(defaultNodeSize)`. When scaleFactor = 1.0, no multiplication occurs. When scaleFactor < 1.0, all dimensional props scale down uniformly.

### Phase 2: Remove GROUP_BORDER_PX_TO_UNITS from Render Pipeline

The `GROUP_BORDER_PX_TO_UNITS = 0.4` constant in GroupRenderer.ts is eliminated. Theme values already encode the correct NVS fraction after migration. The GroupRenderer receives borderWidth in world units (after render.ts multiplies by thicknessScale) and uses it directly.

### Phase 3: Add cornerRadius Conversion in Render Pipeline

render.ts currently converts `thickness` from NVS to world units via `× thicknessScale`. It must also convert `cornerRadius` the same way:

```typescript
cornerRadius: nodeState.cornerRadius * thicknessScale,
```

### File Changes

#### `packages/diagram/src/elements/diagram/compiler/normalizeToViewport.ts`

- Rename `thicknessNormFactor` to `scaleFactor` in the return type `NormalizeToViewportResult`.
- Change computation: `return { ..., scaleFactor }` where `scaleFactor` is the existing uniform scale factor (currently `usableArea / maxSpan` when maxSpan > usableArea, else 1.0). Remove the `× max(defaultNodeSize)` multiplier.
- Remove `defaultNodeSize` parameter (no longer needed for thickness normalization; still needed if used elsewhere — check). Actually, `defaultNodeSize` is still passed to `normalizeToViewport` but only used in the degenerate (no-nodes) case. Keep the parameter for that edge case but change the degenerate return to `scaleFactor: 1.0`.

**Before:**
```typescript
thicknessNormFactor: scaleFactor * Math.max(defaultNodeSize[0], defaultNodeSize[1]),
```

**After:**
```typescript
scaleFactor,
```

Update the return type:
```typescript
export type NormalizeToViewportResult = {
  readonly normalizedPositions: Map<string, RawPosition>;
  readonly normalizedSizes: Map<string, RawSize>;
  readonly normalizedGroups: Map<string, GroupBounds>;
  /** Uniform scale factor applied when layout exceeded [0..1]. 1.0 when no scale-down needed. */
  readonly scaleFactor: number;
};
```

#### `packages/diagram/src/elements/diagram/compile.ts`

Update all references from `thicknessNormFactor` to `scaleFactor`:

**Line 207 (destructure):**
```typescript
const { normalizedPositions, normalizedSizes, normalizedGroups, scaleFactor } =
  normalizeToViewport(nodesPreNorm, groupBoundsMap, theme.node.defaultSize);
```

**Line 220 (node thickness):**
```typescript
thickness: node.thickness * scaleFactor,
```

**Line 290 (edge thickness):**
```typescript
return { ...compiled, thickness: compiled.thickness * scaleFactor };
```

**Lines 303-304 (group borderWidth/borderHeight):**
```typescript
borderWidth: compiled.borderWidth * scaleFactor,
borderHeight: compiled.borderHeight * scaleFactor,
```

**Lines 176-178 (group bounds pre-normalization, border width for edge routing):**
Remove the `× GROUP_BORDER_PX_TO_UNITS` multiplication. The theme `defaultBorderWidth` is now in NVS fractions. The border width used for group size computation in pre-normalization space must be in the same coordinate system as positions/sizes. Since pre-normalization positions are in layout units (NVS-scale), and borderWidth is now NVS, this works directly.

**Before (line 178):**
```typescript
: Math.max(0, groupDefaults.borderWidth * GROUP_BORDER_PX_TO_UNITS);
```

**After:**
```typescript
: Math.max(0, groupDefaults.borderWidth);
```

Remove the import of `GROUP_BORDER_PX_TO_UNITS` from compile.ts.

#### `packages/diagram/src/elements/diagram/render.ts`

**Line 385 (node thickness → world units):**
No change needed — already multiplies by `thicknessScale`.

**Lines 262-263 (group borderWidth/borderHeight → world units):**
No change needed — already multiplies by `thicknessScale`.

**Line 334 (edge thickness → world units):**
No change needed — already multiplies by `thicknessScale`.

**Add cornerRadius conversion (within node conversion block, ~line 379-386):**

**Before:**
```typescript
const convertedNode: DiagramNodeState = {
  ...nodeState,
  position: [localX, localY, localZ],
  size: [worldW, worldH],
  thickness: nodeState.thickness * thicknessScale,
};
```

**After:**
```typescript
const convertedNode: DiagramNodeState = {
  ...nodeState,
  position: [localX, localY, localZ],
  size: [worldW, worldH],
  thickness: nodeState.thickness * thicknessScale,
  cornerRadius: nodeState.cornerRadius * thicknessScale,
};
```

#### `packages/diagram/src/elements/diagram/rendering/GroupRenderer.ts`

**Line 424:**

**Before:**
```typescript
const bw = Math.max(0.01, state.borderWidth * GROUP_BORDER_PX_TO_UNITS);
```

**After:**
```typescript
const bw = Math.max(0.01, state.borderWidth);
```

Remove the import of `GROUP_BORDER_PX_TO_UNITS` from GroupRenderer.ts.

#### `packages/diagram/src/elements/diagram/compiler/groupCompiler.ts`

**Line 95 (compileEdgeLights borderWidthUnits):**

**Before:**
```typescript
const borderWidthUnits = Math.max(0, borderWidth * GROUP_BORDER_PX_TO_UNITS);
```

**After:**
```typescript
const borderWidthUnits = Math.max(0, borderWidth);
```

Remove the import of `GROUP_BORDER_PX_TO_UNITS` from groupCompiler.ts.

#### `packages/diagram/src/elements/diagram/compiler/transitionHelpers.ts`

**Line 74 (rerouteLiveEdges borderWidthUnits):**

**Before:**
```typescript
: Math.max(0, group.borderWidth * GROUP_BORDER_PX_TO_UNITS);
```

**After:**
```typescript
: Math.max(0, group.borderWidth);
```

Remove the import of `GROUP_BORDER_PX_TO_UNITS` from transitionHelpers.ts.

#### `packages/diagram/src/elements/diagram/constants.ts`

**Delete** the `GROUP_BORDER_PX_TO_UNITS` export. If no other imports remain (check `NODE_RENDER_Z_OFFSET` and `GROUP_RENDER_Z` — those stay), remove only that single line.

**Before:**
```typescript
export const GROUP_BORDER_PX_TO_UNITS: number = 0.4;
```

**After:** Line deleted.

#### Theme Files — `packages/diagram/src/elements/diagram/themes/*.ts` (6 files)

Each theme file must update 5 values. Changes per theme:

**darkGlass.ts:**
```typescript
// node
defaultThickness: 0.150,     // was 1
cornerRadius: 0.009,         // was 0.06
// edge
defaultThickness: 0.00975,   // was 0.065
// group
defaultBorderWidth: 0.015,   // was 0.25
defaultBorderHeight: 0.105,  // was 0.7
```

**enterprise.ts:**
```typescript
// node
defaultThickness: 0.075,     // was 0.5
cornerRadius: 0.0075,        // was 0.05
// edge
defaultThickness: 0.0105,    // was 0.070
// group
defaultBorderWidth: 0.015,   // was 0.25
defaultBorderHeight: 0.150,  // was 1.0
```

**neonCyber.ts:**
```typescript
// node
defaultThickness: 0.033,     // was 0.22
cornerRadius: 0.006,         // was 0.04
// edge
defaultThickness: 0.00825,   // was 0.055
// group
defaultBorderWidth: 0.105,   // was 1.75
defaultBorderHeight: 0.150,  // was 1.0
```

**lightMinimal.ts:**
```typescript
// node
defaultThickness: 0.045,     // was 0.30
cornerRadius: 0.012,         // was 0.08
// edge
defaultThickness: 0.009,     // was 0.060
// group
defaultBorderWidth: 0.075,   // was 1.25
defaultBorderHeight: 0.150,  // was 1.0
```

**lightCanvas.ts:**
```typescript
// node
defaultThickness: 0.075,     // was 0.5
cornerRadius: 0.0135,        // was 0.09
// edge
defaultThickness: 0.00825,   // was 0.055
// group
defaultBorderWidth: 0.075,   // was 1.25
defaultBorderHeight: 0.150,  // was 1.0
```

**midnight.ts:**
```typescript
// node
defaultThickness: 0.210,     // was 1.4
cornerRadius: 0.009,         // was 0.06
// edge
defaultThickness: 0.009,     // was 0.060
// group
defaultBorderWidth: 0.015,   // was 0.25
defaultBorderHeight: 0.105,  // was 0.7
```

#### Theme Files — `packages/themes/src/presets/diagram/*.ts` (6 files)

The `@brewsite/themes` package has duplicated theme files that must be updated with the exact same values. Files:

- `packages/themes/src/presets/diagram/darkGlass.ts`
- `packages/themes/src/presets/diagram/enterprise.ts`
- `packages/themes/src/presets/diagram/neonCyber.ts`
- `packages/themes/src/presets/diagram/lightMinimal.ts`
- `packages/themes/src/presets/diagram/lightCanvas.ts`
- `packages/themes/src/presets/diagram/midnight.ts`

Apply the identical value changes as the corresponding `packages/diagram/src/elements/diagram/themes/*.ts` files listed above.

#### `packages/diagram/src/elements/diagram/types.ts` — JSDoc Updates

**DiagramThemeNodeConfig.defaultThickness (line 62-65):**

**Before:**
```typescript
/**
 * Default physical thickness of node prism boxes in diagram units.
 * 0.28 = card-like, 0.6 = block-like.
 */
readonly defaultThickness: number;
```

**After:**
```typescript
/**
 * Default physical thickness (Z-depth) of node prism boxes as an NVS fraction
 * of the diagram viewport width.
 * 0.033 = card-like (neonCyber), 0.075 = standard block (enterprise), 0.210 = deep block (midnight).
 */
readonly defaultThickness: number;
```

**DiagramThemeNodeConfig.cornerRadius (line 67-71):**

**Before:**
```typescript
/**
 * Corner radius in diagram units for rect-like shapes.
 * 0 = sharp BoxGeometry (legacy); > 0 = rounded box geometry.
 * Ignored for non-rect shapes (cylinder, oval, hexagon, etc.).
 */
readonly cornerRadius: number;
```

**After:**
```typescript
/**
 * Corner radius as an NVS fraction of the diagram viewport width.
 * Converted to world units in render.ts alongside size and thickness.
 * 0 = sharp BoxGeometry; > 0 = rounded box geometry.
 * Ignored for non-rect shapes (cylinder, oval, hexagon, etc.).
 */
readonly cornerRadius: number;
```

**DiagramThemeEdgeConfig.defaultThickness (line 163):**

**Before:**
```typescript
/** Default tube radius in diagram units */
readonly defaultThickness: number;
```

**After:**
```typescript
/** Default tube radius as an NVS fraction of the diagram viewport width. */
readonly defaultThickness: number;
```

**DiagramThemeGroupConfig.defaultBorderWidth (line 237):**

**Before:**
```typescript
/** Default border width in pixels for group outlines. */
readonly defaultBorderWidth: number;
```

**After:**
```typescript
/** Default border width as an NVS fraction of the diagram viewport width. */
readonly defaultBorderWidth: number;
```

**DiagramThemeGroupConfig.defaultBorderHeight (line 239):**

**Before:**
```typescript
/** Default border height (depth on Z axis) for 3D group outlines. */
readonly defaultBorderHeight: number;
```

**After:**
```typescript
/** Default border height (Z-depth) as an NVS fraction of the diagram viewport width. */
readonly defaultBorderHeight: number;
```

**DiagramNodeState.thickness (line 776-779):**

**Before:**
```typescript
/**
 * Physical thickness of the 3D prism box in diagram units — how far it protrudes
 * toward the camera. NOT the same as z-axis depth layering (use `position[2]` for that).
 * Recommended defaults: 0.4 for standard nodes, 0.8 for hero/expanded nodes.
 */
readonly thickness: number;
```

**After:**
```typescript
/**
 * Physical thickness of the 3D prism box as an NVS fraction of the diagram
 * viewport width. Converted to world units by render.ts (× uniformWorldW).
 * NOT the same as z-axis depth layering (use `position[2]` for that).
 */
readonly thickness: number;
```

**DiagramNodeState.cornerRadius (line 808-814):**

**Before:**
```typescript
/**
 * Corner radius in diagram units for rect-like shapes.
 * 0 = sharp BoxGeometry. > 0 = rounded box via ExtrudeGeometry.
 * Only applies to flow:rect and other box-based shapes.
 * Default: 0.06.
 */
readonly cornerRadius: number;
```

**After:**
```typescript
/**
 * Corner radius as an NVS fraction of the diagram viewport width.
 * Converted to world units by render.ts (× uniformWorldW).
 * 0 = sharp BoxGeometry. > 0 = rounded box via ExtrudeGeometry.
 * Only applies to rect and other box-based shapes.
 */
readonly cornerRadius: number;
```

**DiagramEdgeState.thickness (line 986-989):**

**Before:**
```typescript
/**
 * Tube geometry radius in diagram units.
 * Recommended: 0.04 for standard edges, 0.07 for highlighted/emphasized edges.
 */
readonly thickness: number;
```

**After:**
```typescript
/**
 * Tube geometry radius as an NVS fraction of the diagram viewport width.
 * Converted to world units by render.ts (× uniformWorldW).
 */
readonly thickness: number;
```

**DiagramGroupState.borderWidth (line 1089):**

**Before:**
```typescript
/** Border width in pixels */
readonly borderWidth: number;
```

**After:**
```typescript
/** Border width as an NVS fraction of the diagram viewport width. */
readonly borderWidth: number;
```

**DiagramGroupState.borderHeight (line 1091):**

**Before:**
```typescript
/** Border height/depth in diagram units */
readonly borderHeight: number;
```

**After:**
```typescript
/** Border height (Z-depth) as an NVS fraction of the diagram viewport width. */
readonly borderHeight: number;
```

**DiagramNodeDSL.thickness (line 1260):**
No JSDoc currently. Add:
```typescript
/** Node prism Z-depth as an NVS fraction of diagram viewport width. Overrides theme default. */
readonly thickness?: number;
```

**DiagramNodeDSL.cornerRadius (line 1284-1285):**

**Before:**
```typescript
/** Corner radius in diagram units. Overrides theme default (theme.node.cornerRadius). */
readonly cornerRadius?: number;
```

**After:**
```typescript
/** Corner radius as an NVS fraction of diagram viewport width. Overrides theme default. */
readonly cornerRadius?: number;
```

**DiagramEdgeDSL.thickness (line 1330):**
No JSDoc currently. Add:
```typescript
/** Tube radius as an NVS fraction of diagram viewport width. Overrides theme default. */
readonly thickness?: number;
```

**DiagramThemeRenderConfig.nodeCornerRadius (line 429-430):**

**Before:**
```typescript
/** Corner radius in diagram units for rect nodes. 0 = BoxGeometry */
readonly nodeCornerRadius: number;
```

**After:**
```typescript
/** Corner radius as NVS fraction. render.ts converts to world units. 0 = BoxGeometry */
readonly nodeCornerRadius: number;
```

### Scene Files Requiring Value Updates

The following scene files override `thickness` on diagram nodes or edges and need migrated values.

#### `apps/examples/src/slides-demo/deck.tsx`

Node thickness overrides (all `thickness={0.2}` and `thickness={0.3}`):

| Line | Old | New (old × 0.15) |
|------|----:|------------------:|
| 287 | 0.2 | 0.030 |
| 290 | 0.2 | 0.030 |
| 294 | 0.2 | 0.030 |
| 295 | 0.2 | 0.030 |
| 296 | 0.2 | 0.030 |
| 300 | 0.2 | 0.030 |
| 303 | 0.2 | 0.030 |
| 550 | 0.2 | 0.030 |
| 551 | 0.2 | 0.030 |
| 552 | 0.2 | 0.030 |
| 556 | 0.3 | 0.045 |

Edge thickness override:

| Line | Old | New (old × 0.15) |
|------|----:|------------------:|
| 309 | 0.07 | 0.0105 |

#### `apps/website/src/scenes/act5_act6/scene_03_arch_detail.tsx`

Node thickness override:

| Line | Old | New (old × 0.15) |
|------|----:|------------------:|
| 49 | 0.8 | 0.120 |

#### Files NOT requiring changes

- `apps/examples/src/Lights.tsx` line 281: `thickness={36}` — this is `TimelineWidget.thickness` (px height of scrubber UI), not a diagram prop.
- `apps/examples/src/input-showcase/InputShowcasePage.tsx` line 72: `thickness={40}` — same, `TimelineWidget.thickness`.
- No scene files override `cornerRadius` — all rely on theme defaults.
- No scene files override group `borderWidth` or `borderHeight` — these are theme-only.

### `packages/claude-author/` Documentation Updates

Grep the docs directory for references to "diagram units", "content units", "thickness", and "cornerRadius" in the claude-author documentation. Update any authored guidance to reference NVS fractions.

Specific files to check:
- `packages/claude-author/docs/diagram/nodes-edges-groups.md`
- `packages/claude-author/docs/guides/nvs-spatial-model.md`
- `packages/claude-author/docs/guides/common-gotchas.md`

## Test Strategy

### `packages/diagram/src/elements/diagram/compiler/__tests__/normalizeToViewport.test.ts`

- **Update existing tests** that assert `thicknessNormFactor` to assert `scaleFactor` instead.
- **Add test:** When scaleFactor is 1.0, `scaleFactor` returns 1.0 (no multiplication by defaultNodeSize).
- **Add test:** When layout exceeds [0..1], `scaleFactor` returns the correct uniform downscale factor.

### `packages/diagram/src/elements/diagram/__tests__/compile.test.ts`

- **Update existing assertions** on `node.thickness`, `edge.thickness`, `group.borderWidth`, `group.borderHeight` to expect NVS values (new theme defaults × scaleFactor).
- **Add test:** Node thickness equals `dsl.thickness × scaleFactor` when scaleFactor < 1.0.
- **Add test:** Edge thickness equals `(dsl.thickness ?? theme.edge.defaultThickness) × scaleFactor`.
- **Add test:** Group borderWidth and borderHeight are `theme_default × scaleFactor` (no GROUP_BORDER_PX_TO_UNITS multiplication).
- **Add test:** cornerRadius passes through from theme/DSL without modification (cornerRadius is not multiplied by scaleFactor in compile — it is converted in render.ts only).

### `packages/diagram/src/elements/diagram/__tests__/diagramRenderer.test.ts`

- **Add test:** Converted node includes `cornerRadius: nodeState.cornerRadius × thicknessScale`.
- **Verify** that edge and group borderWidth/borderHeight conversion assertions pass without `GROUP_BORDER_PX_TO_UNITS`.

### `packages/diagram/src/elements/diagram/__tests__/functionalTransitionSpec.test.ts`

- **Update** any transition interpolation tests that assert thickness/borderWidth values. The interpolated values should now be NVS fractions, not content units.

### `packages/diagram/src/elements/diagram/compiler/__tests__/groupCompiler.test.ts`

- **Update** edge light position tests that use `GROUP_BORDER_PX_TO_UNITS` — the borderWidth parameter to `compileEdgeLights` is now NVS-direct.

### `packages/diagram/src/elements/diagram/compiler/__tests__/layoutAlgorithms.test.ts`

- No direct changes expected — layout algorithms produce positions, not thickness values.

### `packages/diagram/src/elements/diagram/shapes/__tests__/geometryFactory.test.ts`

- No changes needed — `createShapeGeometry` takes world-unit values. The migration changes happen upstream (render.ts converts NVS to world before calling the factory).

## Execution Order

1. Update `normalizeToViewport.ts` — rename return field, remove defaultNodeSize multiplier.
2. Update `compile.ts` — rename usages, remove GROUP_BORDER_PX_TO_UNITS import and multiplication.
3. Update `render.ts` — add cornerRadius conversion in node block.
4. Update `GroupRenderer.ts` — remove GROUP_BORDER_PX_TO_UNITS multiplication.
5. Update `groupCompiler.ts` — remove GROUP_BORDER_PX_TO_UNITS multiplication.
6. Update `transitionHelpers.ts` — remove GROUP_BORDER_PX_TO_UNITS multiplication.
7. Delete `GROUP_BORDER_PX_TO_UNITS` from `constants.ts`.
8. Update all 12 theme files (6 in diagram, 6 in themes package).
9. Update `types.ts` JSDoc.
10. Update scene files (deck.tsx, scene_03_arch_detail.tsx).
11. Update claude-author documentation.
12. Update all tests.
13. Run full test suite: `pnpm test`.
14. Run typecheck: `pnpm typecheck`.
15. Visual verification: `pnpm dev` and check all example diagrams render identically to before.

## Risk Assessment

- **Visual regression is the primary risk.** The migration math is deterministic but floating-point precision means values like `0.00975` (edge thickness) may round differently than the old pipeline at certain viewport sizes. Mitigation: `thicknessScale` quantization (already in render.ts) masks sub-0.1 differences.
- **cornerRadius is the highest-risk prop** because it currently has no conversion at all. Adding `× thicknessScale` will change the effective world-unit radius. The theme values are computed to produce the same result at `thicknessScale ≈ uniformWorldW`, but at very different viewport sizes the proportional rounding will behave differently than the old fixed-world-unit radius. This is a correctness improvement (viewport-invariant behavior), but may surprise authors who had tuned cornerRadius for a specific viewport.
- **GROUP_BORDER_PX_TO_UNITS removal** changes the code path for edge light positioning (groupCompiler.ts) and transition re-routing (transitionHelpers.ts). Both must be verified with visual testing on diagrams that have edge lights and group border transitions.
