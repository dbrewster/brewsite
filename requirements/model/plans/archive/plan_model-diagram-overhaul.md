---
title: "Implementation Plan: Model/Diagram Overhaul"
doc_type: plan
owner: architect
status: active
updated: 2026-03-08
revised: 2026-03-08 (PM-2 challenges 1–10 addressed)
---

# Implementation Plan: Model/Diagram Overhaul

## 1. Overview

### What Is Being Changed

This plan covers three interlocking sets of changes to `packages/diagram/src/`:

1. **Constant deduplication and renderConstants.ts** — `GROUP_RENDER_Z`, `GROUP_BORDER_PX_TO_UNITS`, and `DEFAULT_NODE_SIZE` each exist in multiple files with no enforcement. A new `renderConstants.ts` file centralizes the first two. `DEFAULT_NODE_SIZE` is consolidated in `nodeCompiler.ts` and imported by `layoutAlgorithms.ts`.

2. **Theme system completeness** — Seven hardcoded rendering constants are promoted to required `DiagramTheme` properties: `defaultSize`, `defaultIconScale`, `defaultIconDepthFactor`, `glowSpread`, `borderMetalness`, `borderRoughness`, `borderSideDarken`, `borderEdgeLineDarken`, `tubeRadialSegments`, `organicVariation`. All four preset themes (`darkGlass`, `enterprise`, `neonCyber`, `lightMinimal`) provide explicit values.

3. **Architecture cleanliness** — `TextRenderer.ts` (a 3-line hollow re-export) is deleted. `iconDepth` is renamed to `iconDepthFactor` (a fraction of `node.thickness`, making it coordinate-system-invariant). The `size` JSDoc default in `dsl.tsx` is corrected. `routeEdgeCurvedProfile` and `routeEdgeOrthogonal` constants are documented inline. A ManualLayout node-size sanity warning is added.

**No backward compatibility. No deprecation shims. No optional fallbacks for new required theme properties.** Consumers who do not update receive TypeScript compile errors — this is intentional.

### What Is Explicitly Out of Scope

- Node label ratio constants (`0.28`, `0.18` in `NodeRenderer.ts`) — `effectiveLabelSizeFactor` already covers theme-controlled scaling. Base ratios are internal layout tuning.
- Group label inset constants (`0.08`, `0.35`, `1.6`, `0.7`) in `GroupRenderer.ts` — not candidates per the four-condition principle.
- Edge segment count base values (`20`, `40`, `8×`) — see theme-exposure principle; `edgeSmoothness` already provides the override path.
- `routeEdgeCurvedProfile` 12-parameter tuning system — explicitly excluded; documentation added instead.
- `stub`/`ce` in `routeEdgeOrthogonal` — tightly coupled pair, excluded; documentation added.
- SVG icon 3D extrusion ratios (`extruded`, `layered`, `embossed` depth multipliers) — excluded; comment documentation added.
- Node side-face emissive multipliers (`0.05`, `0.02`) in `NodeRenderer.ts` — excluded.
- `LabelDefinition.labelOffset` units audit — open question, deferred.
- Model renderer (`ModelRenderer.ts`) world-space Z audit — deferred.
- `packages/model/src/` — no changes in this plan; model package was audited and found clean.
- `packages/core/`, `packages/charts/` — no changes.

---

## 2. New `renderConstants.ts` File

### Exact File Path

```
packages/diagram/src/elements/diagram/renderConstants.ts
```

**Architectural note:** This file is placed at the element root level — NOT inside `rendering/` — because both `compile.ts` and `compiler/groupCompiler.ts` need to import it. Importing from `rendering/` into the compile layer would violate the compile→render dependency direction. `renderConstants.ts` has zero runtime dependencies (no Three.js, no React, no imports of any kind) so importing it from the compile layer is architecturally safe.

### Exact Content

```typescript
// Shared rendering constants for the diagram element.
// Imported by both the compile layer and the rendering layer.
// No Three.js. No React. No imports.

/**
 * Z depth at which group fill planes render behind nodes.
 * Nodes are placed at z=0. Groups at z=-0.6 render behind them.
 *
 * ASSUMPTION: All nodes are at z=0 (the default). If a scene author
 * places nodes at z < -0.6, groups will occlude those nodes.
 * This value is an engine invariant — do NOT expose in DiagramTheme.
 */
export const GROUP_RENDER_Z = -0.6;

/**
 * Converts theme borderWidth (pixel-like author units) to diagram units
 * for the group border frame ExtrudeGeometry.
 * 0.4 means: 1 unit of borderWidth = 0.4 diagram units of frame width.
 *
 * This is a geometry calibration constant — do NOT expose in DiagramTheme.
 */
export const GROUP_BORDER_PX_TO_UNITS = 0.4;
```

### Files That Currently Define or Inline These Values (All Must Be Updated)

| File | Current form | Action |
|---|---|---|
| `compile.ts:32` | `const GROUP_BORDER_PX_TO_UNITS = 0.4` | Delete; add import from `./renderConstants` |
| `compile.ts:34` | `const GROUP_RENDER_Z = -0.6` | Delete; add import from `./renderConstants` |
| `compile.ts:301` | inline `-0.6` literal | Replace with `GROUP_RENDER_Z` |
| `compiler/groupCompiler.ts:48` | `const GROUP_BORDER_PX_TO_UNITS = 0.4` | Delete; add import from `../renderConstants` |
| `rendering/GroupRenderer.ts:10` | `private static readonly BORDER_PX_TO_UNITS = 0.4` | Delete static field; add import from `../renderConstants` — see constant deduplication section |
| `rendering/GroupRenderer.ts:148` | inline `-0.6` literal | Replace with `GROUP_RENDER_Z` from import |

---

## 3. Theme Type Changes (`types.ts`)

### File

`packages/diagram/src/elements/diagram/types.ts`

### 3.1 New Properties on `DiagramThemeNodeConfig`

Add these **required** (non-optional) properties:

```typescript
/**
 * Default node size [width, height] in diagram units for auto-layouts.
 * AutoLayout compilers read this when no explicit size is provided per-node.
 * ManualLayout consumers MUST always specify an explicit NVS size — this
 * default is not safe for ManualLayout where sizes are [0..1] fractions.
 * darkGlass default: [4, 2]
 */
readonly defaultSize: readonly [number, number];

/**
 * Default icon scale as a fraction of node face dimensions [0..1].
 * 1.0 = icon fills full node width; 0.6 = 60% of node width.
 * darkGlass default: 0.6
 */
readonly defaultIconScale: number;

/**
 * Default icon extrusion depth as a fraction of node thickness [0..1].
 * 0.5 = icon maximum Z depth is 50% of node.thickness.
 * This is coordinate-system-invariant (works correctly for both AutoLayout
 * and ManualLayout). Replaces the old absolute `iconDepth` value.
 * darkGlass default: 0.5
 */
readonly defaultIconDepthFactor: number;

/**
 * Glow sprite size as a multiple of the node bounding box [0.5..4].
 * 2.2 = glow is 2.2× the node footprint. Controls glow halo radius.
 * glowIntensity controls brightness; glowSpread controls spatial extent.
 * darkGlass default: 2.2. Set to 1.0 for no visible spread beyond node edge.
 */
readonly glowSpread: number;
```

### 3.2 New Properties on `DiagramThemeGroupConfig`

Add these **required** properties:

```typescript
/**
 * PBR metalness for the group border frame faces [0..1].
 * 0 = fully diffuse/plastic; 1 = fully metallic.
 * darkGlass default: 0.35
 * lightMinimal should use 0.08 to match its node material intent.
 */
readonly borderMetalness: number;

/**
 * PBR roughness for the group border frame faces [0..1].
 * 0 = mirror smooth; 1 = fully matte.
 * darkGlass default: 0.45
 * lightMinimal should use 0.60 to match its node material intent.
 */
readonly borderRoughness: number;

/**
 * Multiplier [0..1] applied to the border face color for side faces.
 * 0.4 = side faces are 40% as bright as front face (darkens sides).
 * For light themes, reduce to 0.7–0.8 to avoid over-darkening.
 * darkGlass default: 0.4
 */
readonly borderSideDarken: number;

/**
 * Multiplier [0..1] applied to the border wireframe edge color.
 * darkGlass default: 0.45
 * lightMinimal default: 0.75 (less darkening for light background).
 */
readonly borderEdgeLineDarken: number;
```

### 3.3 New Properties on `DiagramThemeEdgeConfig`

Add these **required** properties:

```typescript
/**
 * Number of radial cross-section polygon sides for TubeGeometry.
 * 8 = octagonal, 12 = smoother, 16 = near-circular.
 * Higher values are more expensive per edge. Typically 8–12.
 * darkGlass default: 8
 * neonCyber default: 12 (thicker edges benefit from more facets)
 */
readonly tubeRadialSegments: number;

/**
 * Magnitude of perpendicular offset for 'organic' edge routing.
 * Controls how much each organically-routed edge deviates from a
 * pure curved path. Offset = (deterministicSeed - 0.5) × organicVariation.
 * 0 = no deviation (same as 'curved'); 1.6 = moderate variation;
 * 3.0 = extreme variation. Value range [0..4] is predictable.
 * Only affects edges with routing='organic' (per-edge or theme default).
 * darkGlass default: 1.6
 * enterprise default: 0.8 (conservative variation)
 * neonCyber default: 2.0 (high variation for visual energy)
 */
readonly organicVariation: number;
```

### 3.4 Rename `iconDepth` → `iconDepthFactor` on `DiagramNodeDSL` and `DiagramNodeState`

In `DiagramNodeDSL` (around line 988):
```typescript
// REMOVE:
readonly iconDepth?: number;

// ADD:
/**
 * Override for the 3D icon extrusion depth as a fraction of node thickness [0..1].
 * 0.5 = icon extends 50% of node.thickness in Z. Coordinate-system-invariant.
 * Default: from theme (defaultIconDepthFactor, typically 0.5).
 */
readonly iconDepthFactor?: number;
```

In `DiagramNodeState` (around line 682):
```typescript
// REMOVE:
readonly iconDepth: number;

// ADD:
/**
 * 3D icon extrusion depth as a fraction of node thickness [0..1].
 * The renderer computes: maxDepthUnits = iconDepthFactor × state.thickness.
 */
readonly iconDepthFactor: number;
```

### 3.5 New Properties on `DiagramThemeRenderConfig`

These are derived at compile time in `themeResolver.ts` and carried on `DiagramState.themeConfig`. Add:

```typescript
/** Glow sprite size multiplier relative to node bounding box. Source: theme.node.glowSpread */
readonly nodeGlowSpread: number;

/** TubeGeometry radial segments for edge tubes. Source: theme.edge.tubeRadialSegments */
readonly edgeTubeRadialSegments: number;

/** Group border frame face metalness. Source: theme.group.borderMetalness */
readonly groupBorderMetalness: number;

/** Group border frame face roughness. Source: theme.group.borderRoughness */
readonly groupBorderRoughness: number;

/** Group border side-face color multiplier. Source: theme.group.borderSideDarken */
readonly groupBorderSideDarken: number;

/** Group border wireframe edge color multiplier. Source: theme.group.borderEdgeLineDarken */
readonly groupBorderEdgeLineDarken: number;
```

### 3.6 Remove Deprecated Type

In `types.ts`, find and delete the `DiagramPivot` type (lines 327–336) — it is marked `@deprecated` and has no runtime usages. The plan requirement prohibits `@deprecated` on still-present code; remove it entirely.

```typescript
// DELETE this entire block:
/**
 * @deprecated DiagramPivot is no longer used. Diagrams are positioned via viewportBounds.
 * Kept temporarily for backward compatibility during migration.
 */
export type DiagramPivot =
  | 'center'
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right';
```

---

## 4. Theme File Updates

Each theme must provide values for every new required property. No optional defaults.

### 4.1 `themes/darkGlass.ts`

Add to `node:`:
```typescript
defaultSize: [4, 2] as const,
defaultIconScale: 0.6,
defaultIconDepthFactor: 0.5,
glowSpread: 2.2,
```

Add to `group:`:
```typescript
borderMetalness: 0.35,
borderRoughness: 0.45,
borderSideDarken: 0.40,
borderEdgeLineDarken: 0.45,
```

Add to `edge:`:
```typescript
tubeRadialSegments: 8,
organicVariation: 1.6,
```

### 4.2 `themes/enterprise.ts`

Add to `node:`:
```typescript
defaultSize: [4, 2] as const,
defaultIconScale: 0.6,
defaultIconDepthFactor: 0.5,
glowSpread: 2.2,
```

Add to `group:`:
```typescript
borderMetalness: 0.20,
borderRoughness: 0.55,
borderSideDarken: 0.50,
borderEdgeLineDarken: 0.55,
```

Add to `edge:`:
```typescript
tubeRadialSegments: 8,
organicVariation: 0.8,
```

### 4.3 `themes/neonCyber.ts`

Add to `node:`:
```typescript
defaultSize: [4, 2] as const,
defaultIconScale: 0.6,
defaultIconDepthFactor: 0.5,
glowSpread: 2.8,
```
*(neonCyber has strong glow; a wider spread of 2.8 vs 2.2 reinforces the neon halo aesthetic)*

Add to `group:`:
```typescript
borderMetalness: 0.60,
borderRoughness: 0.20,
borderSideDarken: 0.35,
borderEdgeLineDarken: 0.40,
```
*(neonCyber nodes are highly metallic; border should match that energy)*

Add to `edge:`:
```typescript
tubeRadialSegments: 12,
organicVariation: 2.0,
```
*(neonCyber uses thicker-looking edges; 12 segments reduce visible faceting)*

### 4.4 `themes/lightMinimal.ts`

Add to `node:`:
```typescript
defaultSize: [4, 2] as const,
defaultIconScale: 0.6,
defaultIconDepthFactor: 0.5,
glowSpread: 2.2,
```
*(glowSpread is vestigial since glowIntensity: 0.0, but still required)*

Add to `group:`:
```typescript
borderMetalness: 0.08,
borderRoughness: 0.60,
borderSideDarken: 0.70,
borderEdgeLineDarken: 0.75,
```
*(lightMinimal has matte node materials, 0.08/0.60; border should match. Less darkening — 0.70/0.75 — avoids harsh contrast on a light background)*

Add to `edge:`:
```typescript
tubeRadialSegments: 8,
organicVariation: 1.2,
```

---

## 5. Constant Deduplication — Detailed Changes

### 5.1 `DEFAULT_NODE_SIZE` — Canonical Location: `compiler/nodeCompiler.ts`

**Current state:** Three independent `[4, 2]` definitions:
- `nodeCompiler.ts:23` — inline in `buildNodeDefaults` (will be removed once theme-sourced)
- `layoutAlgorithms.ts:27` — local `const DEFAULT_NODE_SIZE: readonly [number, number] = [4, 2]`
- `layoutAlgorithms.ts:~160` — second local definition in grid layout fallback

**After changes:**

In `nodeCompiler.ts`, the hardcoded `size: [4, 2]` in `buildNodeDefaults` is removed. The default comes from `theme.node.defaultSize`:
```typescript
export const buildNodeDefaults = (theme: DiagramTheme) => ({
  shape:                DEFAULT_NODE_SHAPE,
  size:                 theme.node.defaultSize,  // was: [4, 2] as [number, number]
  thickness:            theme.node.defaultThickness,
  // ... rest unchanged
  iconScale:            theme.node.defaultIconScale,     // was: 0.6
  iconStyle:            theme.node.defaultIconStyle,
  iconDepthFactor:      theme.node.defaultIconDepthFactor, // was: iconDepth: 0.15
});
```

Additionally, export a named constant for use by `layoutAlgorithms.ts` as a fallback (for the case where a node has no size and no theme — defensive only):
```typescript
/** Fallback node size in diagram units when neither DSL nor theme provide one. */
export const FALLBACK_NODE_SIZE: readonly [number, number] = [4, 2];
```

In `compiler/nodeCompiler.ts`, the `compileNode` function must also rename `iconDepth` → `iconDepthFactor`:
```typescript
// REMOVE:
iconDepth: dsl.iconDepth ?? nd.iconDepth,
// ADD:
iconDepthFactor: dsl.iconDepthFactor ?? nd.iconDepthFactor,
```

In `layoutAlgorithms.ts`:
- Remove both local `const DEFAULT_NODE_SIZE` definitions
- Import `FALLBACK_NODE_SIZE` from `./nodeCompiler`:
  ```typescript
  import { FALLBACK_NODE_SIZE } from './nodeCompiler';
  ```
- Replace all uses of `DEFAULT_NODE_SIZE` with `FALLBACK_NODE_SIZE`

**Correct fix — thread `defaultNodeSize` into layout algorithms (Option B):**

Layout algorithms operate on raw `DiagramNodeDSL[]` before `buildNodeDefaults` is applied. Using a static `FALLBACK_NODE_SIZE = [4, 2]` creates a hidden contract: `theme.node.defaultSize` MUST be `[4, 2]` or layout footprints will be computed at a different size than nodes are rendered, causing overlaps. This is unacceptable for a toolkit where consumers author custom themes.

**The fix:** Thread `defaultNodeSize` as an explicit parameter through the layout call chain. All four layout resolvers use `node.size ?? defaultNodeSize` for footprint computation.

**Changes to `layoutAlgorithms.ts`:**

Remove both local `const DEFAULT_NODE_SIZE` definitions from `resolveFlowLayout` (line 27) and `resolveLayout` (line 160).

Update `resolveFlowLayout` signature:
```typescript
export function resolveFlowLayout(
  nodes: ReadonlyArray<DiagramNodeDSL>,
  layout: ResolvedFlowLayout,
  childrenOrder: ReadonlyArray<string>,
  defaultNodeSize: readonly [number, number],  // ← NEW
): Map<string, readonly [number, number, number]>
```

Replace `const DEFAULT_NODE_SIZE: readonly [number, number] = [4, 2]` usage with the parameter.

Update `resolveLayout` signature:
```typescript
export function resolveLayout(
  nodes: ReadonlyArray<DiagramNodeDSL>,
  edges: ReadonlyArray<DiagramEdgeDSL>,
  layout: ResolvedLayout,
  onWarn?: DiagramWarnFn,
  childrenOrder?: ReadonlyArray<string>,
  defaultNodeSize: readonly [number, number] = [4, 2],  // ← NEW with fallback
): Map<string, readonly [number, number, number]>
```

Pass `defaultNodeSize` to `resolveFlowLayout` at its internal call site and use it for the inline grid/hierarchical node footprint computations (`node.size ?? defaultNodeSize`).

Update `resolveLayoutWithGroups` signature to accept and thread `defaultNodeSize`:
```typescript
export function resolveLayoutWithGroups(
  nodes: ReadonlyArray<DiagramNodeDSL>,
  edges: ReadonlyArray<DiagramEdgeDSL>,
  groups: ReadonlyArray<DiagramGroupDSL>,
  rootLayout: ResolvedLayout,
  groupLayouts: Map<string, ResolvedLayout>,
  sizes: Map<string, readonly [number, number, number]>,
  onWarn?: DiagramWarnFn,
  childrenOrder?: ReadonlyArray<string>,
  groupChildrenOrders?: Map<string, ReadonlyArray<string>>,
  defaultNodeSize: readonly [number, number] = [4, 2],  // ← NEW with fallback
): Map<string, readonly [number, number, number]>
```

Pass `defaultNodeSize` through to each `resolveLayout` / `resolveFlowLayout` call internally.

**Changes to `compile.ts`:**

Pass `theme.node.defaultSize` to `resolveLayoutWithGroups`:
```typescript
const positions = resolveLayoutWithGroups(
  dsl.nodes,
  dsl.edges,
  dsl.groups,
  rootLayout,
  groupLayouts,
  sizeWithDepthMap,
  onWarn,
  dsl.childrenOrder ?? [],
  groupChildrenOrders,
  theme.node.defaultSize,  // ← NEW
);
```

Also update the `sizeMap` construction in `compile.ts` (around lines 199–204) to use `theme.node.defaultSize` as fallback instead of the hardcoded `nd.size`:
```typescript
dsl.nodes.forEach((node) => {
  const size = node.size ?? theme.node.defaultSize;  // was: nd.size which was [4,2]
  // ...
});
```

**The `FALLBACK_NODE_SIZE` constant is no longer needed.** Do not export it. All layout paths receive the theme default explicitly. Remove it from the plan entirely.

### 5.2 `GROUP_BORDER_PX_TO_UNITS` — Canonical Location: `renderConstants.ts`

**Current state:**
- `compile.ts:32` — `const GROUP_BORDER_PX_TO_UNITS = 0.4`
- `compiler/groupCompiler.ts:48` — `const GROUP_BORDER_PX_TO_UNITS = 0.4` (private local)
- `rendering/GroupRenderer.ts:10` — `private static readonly BORDER_PX_TO_UNITS = 0.4`

**After changes:** All three deleted. All three files import `GROUP_BORDER_PX_TO_UNITS` from the appropriate relative path to `renderConstants.ts`.

- `compile.ts`: `import { GROUP_BORDER_PX_TO_UNITS, GROUP_RENDER_Z } from './renderConstants';`
- `compiler/groupCompiler.ts`: `import { GROUP_BORDER_PX_TO_UNITS } from '../renderConstants';`
- `rendering/GroupRenderer.ts`: `import { GROUP_BORDER_PX_TO_UNITS, GROUP_RENDER_Z } from '../renderConstants';`

### 5.3 `GROUP_RENDER_Z` — Canonical Location: `renderConstants.ts`

**Current state:**
- `compile.ts:34` — `const GROUP_RENDER_Z = -0.6` (named, used correctly at line 241)
- `compile.ts:301` — inline literal `-0.6` (separate code path for ManualLayout group centers)
- `rendering/GroupRenderer.ts:148` — inline literal `-0.6`

**After changes:** Named constant removed from compile.ts. Both inline literals replaced:
- `compile.ts:301`: `normalizedPositions.set(groupId, [..., GROUP_RENDER_Z]);`
- `rendering/GroupRenderer.ts:148`: `entry.group.position.set(centerX, centerY, GROUP_RENDER_Z);`

### 5.4 `GroupRenderer.ts` Static Constants — Deleted Entirely

The four static fields:
```typescript
private static readonly BORDER_PX_TO_UNITS = 0.4;
private static readonly BORDER_SIDE_DARKEN = 0.4;
private static readonly BORDER_METALNESS = 0.35;
private static readonly BORDER_ROUGHNESS = 0.45;
```

After changes:
- `BORDER_PX_TO_UNITS` → replaced by `GROUP_BORDER_PX_TO_UNITS` from import
- `BORDER_SIDE_DARKEN`, `BORDER_METALNESS`, `BORDER_ROUGHNESS` → replaced by theme values from `DiagramThemeRenderConfig`
- The hardcoded `0.45` scalar at lines 214 and 337 → replaced by `themeConfig.groupBorderEdgeLineDarken`

---

## 6. DSL Documentation Fix

### File: `packages/diagram/src/elements/diagram/dsl.tsx`

**Change 1: Fix `size` JSDoc default (line 78)**

Replace:
```typescript
/**
 * Node width and height as viewport fractions [w, h].
 * w ∈ [0..1]: fraction of diagram viewport width.
 * h ∈ [0..1]: fraction of diagram viewport height.
 * Default: [0.12, 0.10] (approximately a 2:1 node at 16:9 aspect).
 *
 * Note: when using auto-layout (GridLayout, HierarchicalLayout), size is still
 * in layout units — the layout algorithm normalizes them to [0..1] at compile time.
 * Only for ManualLayout should you author sizes in [0..1] NVS fractions directly.
 */
size?: [number, number];
```

With:
```typescript
/**
 * Node size [width, height].
 * For AutoLayout (GridLayout, HierarchicalLayout, FlowLayout): diagram units.
 * The layout algorithm normalizes positions+sizes to [0..1] NVS at compile time.
 * Default: [4, 2] (diagram units — from theme.node.defaultSize).
 *
 * For ManualLayout: [0..1] NVS fractions of the diagram viewport.
 * Example: [0.15, 0.08] = 15% wide, 8% tall of the canvas.
 * ManualLayout consumers MUST always specify an explicit size.
 * The [4, 2] default is in diagram units and is NOT safe for ManualLayout.
 */
size?: [number, number];
```

**Change 2: Rename `iconDepth` → `iconDepthFactor` in `DiagramNodeProps`**

Replace the `iconDepth` prop:
```typescript
// REMOVE:
/**
 * Max Z extrusion depth for 3D icon geometry in diagram units.
 * Default: 0.15. Sensible range: 0.05–0.25.
 */
iconDepth?: number;

// ADD:
/**
 * Override for 3D icon extrusion depth as a fraction of node thickness [0..1].
 * 0.5 = icon extends 50% of node.thickness in Z (coordinate-system-invariant).
 * Default: from theme (defaultIconDepthFactor, typically 0.5).
 * Sensible range: 0.2–0.8. Values > 1.0 cause the icon to protrude beyond the node face.
 */
iconDepthFactor?: number;
```

**Change 3: Update `iconScale` JSDoc**

Replace the `iconScale` prop JSDoc to reference the theme:
```typescript
/** Icon scale relative to node face [0–1]. Default: from theme (defaultIconScale, typically 0.6) */
iconScale?: number;
```

---

## 7. TextRenderer.ts Deletion

### Confirmation of Safety

`TextRenderer.ts` contains exactly 3 lines:
```typescript
// TextRenderer re-exported from @brewsite/core.
export { ensureText } from '@brewsite/core';
export type { TextWithLayout } from '@brewsite/core';
```

Import sites (the only two files that import from it):
- `rendering/NodeRenderer.ts:6` — `import { ensureText } from './TextRenderer';`
- `rendering/GroupRenderer.ts:4` — `import { ensureText } from './TextRenderer';`

`TextRenderer` is **not** re-exported from `packages/diagram/src/index.ts` (verified). It is not part of the package's public API.

### Action

1. Delete the file: `packages/diagram/src/elements/diagram/rendering/TextRenderer.ts`
2. In `rendering/NodeRenderer.ts`, change line 6:
   ```typescript
   // REMOVE: import { ensureText } from './TextRenderer';
   // ADD:
   import { ensureText } from '@brewsite/core';
   import type { TextWithLayout } from '@brewsite/core';
   ```
   *(Note: `TextWithLayout` is already imported from `'./types'` at line 3 in NodeRenderer. Verify the actual import and deduplicate — do not double-import `TextWithLayout`.)*
3. In `rendering/GroupRenderer.ts`, change line 4:
   ```typescript
   // REMOVE: import { ensureText } from './TextRenderer';
   // ADD:
   import { ensureText } from '@brewsite/core';
   ```
   *(GroupRenderer.ts already imports `TextWithLayout` from `'./types'` at line 2.)*

No aliasing. No phased removal.

---

## 8. `buildNodeDefaults` and `compileNode` Cleanup

### File: `compiler/nodeCompiler.ts`

The complete updated `buildNodeDefaults` function:
```typescript
export const buildNodeDefaults = (theme: DiagramTheme) => ({
  shape:                DEFAULT_NODE_SHAPE,
  size:                 theme.node.defaultSize,
  thickness:            theme.node.defaultThickness,
  color:                theme.node.defaultColor,
  metalness:            theme.node.defaultMetalness,
  roughness:            theme.node.defaultRoughness,
  emissiveIntensity:    theme.node.defaultEmissiveIntensity,
  cornerRadius:         theme.node.cornerRadius,
  labelColor:           theme.node.defaultLabelColor,
  sublabelColor:        theme.node.defaultSublabelColor,
  opacity:              1,
  clickable:            false,
  enabled:              true,
  iconScale:            theme.node.defaultIconScale,
  iconStyle:            theme.node.defaultIconStyle,
  iconDepthFactor:      theme.node.defaultIconDepthFactor,
});
```

The complete updated `compileNode` return value (relevant fields only):
```typescript
return {
  // ... all other fields unchanged ...
  iconScale: dsl.iconScale ?? nd.iconScale,
  iconStyle: dsl.iconStyle ?? nd.iconStyle,
  iconDepthFactor: dsl.iconDepthFactor ?? nd.iconDepthFactor,
  // ...
};
```

### ManualLayout Node Size Warning

In `compile.ts`, immediately after the ManualLayout branch (the `else` block after line 280), add a warning pass:

```typescript
// Warn when a ManualLayout diagram contains a node whose size dimension exceeds 1.5 —
// this almost always means an AutoLayout diagram-unit value was authored by mistake.
// (ManualLayout nodes are [0..1] NVS fractions; [4, 2] is never a valid NVS fraction.)
if (rootLayout.kind === 'manual' && onWarn) {
  for (const node of nodesPreNorm) {
    const [w, h] = node.size;
    if (w > 1.5 || h > 1.5) {
      onWarn(
        'MANUAL_LAYOUT_NODE_SIZE_SUSPICIOUS',
        `Diagram "${dsl.id}": node "${node.id}" has size [${w.toFixed(2)}, ${h.toFixed(2)}] in a ManualLayout diagram. ` +
        `ManualLayout sizes should be [0..1] NVS fractions. Did you mean to use an auto-layout?`,
      );
    }
  }
}
```

---

## 9. `themeResolver.ts` — `buildThemeRenderConfig` Update

### File: `compiler/themeResolver.ts`

The complete updated `buildThemeRenderConfig` function:

```typescript
export function buildThemeRenderConfig(theme: DiagramTheme): DiagramThemeRenderConfig {
  const labelScale   = theme.sceneTheme?.fontSize.label   ?? 1.0;
  const captionScale = theme.sceneTheme?.fontSize.caption ?? 1.0;

  return {
    envMapUrl:        theme.environment.envMapUrl,
    envMapIntensity:  theme.environment.envMapIntensity,
    skyColor:         theme.environment.skyColor,
    horizonColor:     theme.environment.horizonColor,
    nodeGlowIntensity: theme.node.glowIntensity,
    nodeGlowSpread:    theme.node.glowSpread,
    nodeCornerRadius:  theme.node.cornerRadius,
    use3DArrows:       theme.edge.use3DArrows,
    edgeSmoothness:    theme.edge.smoothness,
    edgeMetalness:     theme.edge.defaultMetalness,
    edgeRoughness:     theme.edge.defaultRoughness,
    edgeFlowSpeed:     theme.edge.defaultFlowSpeed,
    edgeFlowWidth:     theme.edge.defaultFlowWidth,
    edgeTubeRadialSegments: theme.edge.tubeRadialSegments,
    groupBorderMetalness:    theme.group.borderMetalness,
    groupBorderRoughness:    theme.group.borderRoughness,
    groupBorderSideDarken:   theme.group.borderSideDarken,
    groupBorderEdgeLineDarken: theme.group.borderEdgeLineDarken,
    fontUrl:           theme.node.fontUrl ?? theme.sceneTheme?.font.webglFontUrl,
    effectiveLabelSizeFactor:    theme.node.labelSizeFactor * labelScale,
    effectiveSublabelSizeFactor: theme.node.sublabelSizeFactor * captionScale,
  };
}
```

---

## 10. `compile.ts` — `organicVariation` Threading

### File: `packages/diagram/src/elements/diagram/compile.ts`

The call to `routeEdges` (around line 311) gains an `organicVariation` parameter:

```typescript
const normalizedControlPointsMap = routeEdges(
  edgesForRouting,
  normalizedPositions,
  normalizedSizeWithDepthMap,
  theme.edge.routing,
  theme.edge.landing,
  onWarn,
  theme.edge.organicVariation,  // ← NEW: passed to routeEdgeOrganic
);
```

---

## 11. `edgeRouter.ts` — `routeEdgeOrganic` + `routeEdges` Signature + Documentation

### File: `compiler/edgeRouter.ts`

**Change 1: `routeEdgeOrganic` accepts `organicVariation` parameter**

Current signature (approx line 349):
```typescript
export function routeEdgeOrganic(
  srcPos, srcSize, srcFace,
  dstPos, dstSize, dstFace,
  edgeId,
  srcAnchor?, dstAnchor?,
)
```

New signature (add `organicVariation: number = 1.6` as last positional param before optional anchors):
```typescript
export function routeEdgeOrganic(
  srcPos: Vec3, srcSize: NodeDimensions, srcFace: FaceId,
  dstPos: Vec3, dstSize: NodeDimensions, dstFace: FaceId,
  edgeId: string,
  organicVariation: number,
  srcAnchor?: Vec3,
  dstAnchor?: Vec3,
): ReadonlyArray<Vec3>
```

Replace the hardcoded `1.6` scalar (line 358):
```typescript
// BEFORE:
const offset = ((seed % 1000) / 1000 - 0.5) * 1.6;

// AFTER:
const offset = ((seed % 1000) / 1000 - 0.5) * organicVariation;
```

**Change 2: `routeEdges` function signature gains `organicVariation` parameter**

```typescript
export function routeEdges(
  edges: ReadonlyArray<EdgeRoutingInput>,
  positions: Map<string, Vec3>,
  sizes: Map<string, NodeDimensions>,
  defaultRouting: EdgeRoutingAlgorithm = 'curved',
  defaultLanding: EdgeLandingAlgorithm = 'nearest-face',
  onWarn?: DiagramWarnFn,
  organicVariation: number = 1.6,  // ← NEW with default preserving current behavior
): Map<string, ReadonlyArray<Vec3>>
```

**Change 3 (CRITICAL): Update the `'organic'` case call site INSIDE `routeEdges` (line 481)**

The internal dispatch at line 481 currently passes `fromAnchor, toAnchor` as positions 8 and 9. After inserting `organicVariation` at position 8, they shift to 9 and 10. This line **must** be updated or TypeScript emits a type error (Vec3 passed where number expected).

```typescript
// BEFORE (current line 481):
case 'organic': return routeEdgeOrganic(fromPos, fromSize, srcFace, toPos, toSize, dstFace, edgeId, fromAnchor, toAnchor);

// AFTER:
case 'organic': return routeEdgeOrganic(fromPos, fromSize, srcFace, toPos, toSize, dstFace, edgeId, organicVariation, fromAnchor, toAnchor);
```

Also search for a second `'organic'` case near line 505 (the face-group routing branch) and apply the identical update if found.

**Change 4: Add inline documentation to `routeEdgeCurvedProfile` parameters**

Find `routeEdgeCurvedProfile` (approx line 316) and add JSDoc to each literal in the options object:

```typescript
return routeCurvedWithEndpointNormals(srcCenter, dstCenter, srcNormal, dstNormal, {
  /**
   * Minimum distance below which endpoint normals are considered parallel —
   * prevents degenerate handles on nearly-coincident nodes.
   */
  epsilon: EDGE_EPSILON,
  /**
   * Minimum Bézier handle length as a fraction of node-to-node distance.
   * Prevents overly straight curves for very close nodes.
   */
  handleMin: 0.35,
  /**
   * Maximum Bézier handle length as a fraction of node-to-node distance.
   * Caps handles so long-range edges don't produce extreme loops.
   */
  handleMax: 4,
  /**
   * Linear scale factor mapping node-to-node distance to handle length.
   * handle = clamp(distance × handleFactor, handleMin, handleMax)
   */
  handleFactor: 0.28,
  /**
   * If true, replace the curved path with a straight line segment when the
   * src/dst faces permit it. Only allowed for top/bottom face pairs to avoid
   * visually ambiguous straight connections on side faces.
   */
  allowDirectSegment: !srcIsSide && !dstIsSide,
  /**
   * Node-to-node distance below which allowDirectSegment is applied.
   * Nodes farther apart than this always use the curved profile.
   */
  directDistanceThreshold: 0.6,
  /**
   * Dot-product alignment threshold for direct segment.
   * Both normals must point in near-opposite directions (cos(θ) > 0.97)
   * for the direct segment to engage. Prevents straight lines on diagonal faces.
   */
  directAlignmentThreshold: 0.97,
  /** Allow the source handle to exit perpendicular to a side face. */
  startPreferSide: renderProfile && srcIsSide,
  /** Allow the destination handle to exit perpendicular to a side face. */
  endPreferSide: renderProfile && dstIsSide,
  /**
   * Y-component fraction of node height below which a face-exit is treated
   * as "side-exiting" (horizontal). Prevents handle miscalculation when
   * nodes are nearly level horizontally.
   */
  sideVerticalRatioThreshold: 0.3,
  /**
   * Base vertical handle component added when a side face exits upward/downward.
   * Produces a gentle arc rather than a sharp kink for near-horizontal exits.
   */
  sideVerticalBase: 0.45,
  /**
   * Additional vertical handle component per unit of vertical node-to-node distance.
   * Scales the upward/downward arc proportionally to how far apart the nodes are.
   */
  sideVerticalFactor: 0.18,
  /**
   * Maximum vertical handle component for side-exiting faces.
   * Prevents runaway arcs on very tall diagrams.
   */
  sideVerticalMax: 3.2,
  /**
   * Minimum handle length for side-face exits when using the render profile.
   * Ensures a visible exit perpendicular to the node face even for close nodes.
   * 0 when not in render profile (routing-only pass uses shorter handles).
   */
  minSideHandle: renderProfile ? 0.95 : 0,
});
```

**Change 5: Add inline documentation to `routeEdgeOrthogonal` `stub` and `ce`**

Find `routeEdgeOrthogonal` (approx line 392–393) and add comments:

```typescript
// stub: Distance in diagram units the edge travels perpendicular to the node face
// before making its 90° turn. Controls how far the edge "stubs out" from the face.
// WARNING: stub and ce are tightly coupled. Increasing stub without proportionally
// increasing ce will make corner rounding look proportionally too small on long edges.
// Decreasing ce without decreasing stub produces jagged near-corners.
// These two must be adjusted together or not at all.
const stub = 0.8;

// ce: Corner epsilon in diagram units — the distance before and after the 90° turn
// point at which the curve starts and ends. Controls visual rounding of the corner.
// Rule: ce ≈ stub × 0.15 for visually consistent corner rounding across edge lengths.
const ce = 0.12;
```

---

## 12. Renderer Updates

### 12.1 `rendering/NodeRenderer.ts`

**Change 1: Replace hardcoded `2.2` with `themeConfig.nodeGlowSpread`**

Three occurrences of `2.2` (lines 202, 370, 378) must be replaced:

Line 202 (in `createEntry`):
```typescript
// BEFORE:
glow = createGlow(state.color, state.size[0], state.size[1], 2.2, ...);

// AFTER:
glow = createGlow(state.color, state.size[0], state.size[1], themeConfig.nodeGlowSpread, ...);
```

Line 370 (in `updateEntry`, glow creation branch):
```typescript
// BEFORE:
entry.glow = createGlow(state.color, state.size[0], state.size[1], 2.2, ...);

// AFTER:
entry.glow = createGlow(state.color, state.size[0], state.size[1], themeConfig.nodeGlowSpread, ...);
```

Line 378 (in `updateEntry`, glow resize branch):
```typescript
// BEFORE:
const [glowW, glowH] = computeGlowScale(state.size[0], state.size[1], 2.2);

// AFTER:
const [glowW, glowH] = computeGlowScale(state.size[0], state.size[1], themeConfig.nodeGlowSpread);
```

**Change 2: Rename `iconDepth` → `iconDepthFactor` in userData tracking and iconLoader call**

Lines 458, 467, 477 — replace `iconDepth` with `iconDepthFactor`:

```typescript
// Line 458 (change detection):
entry.iconHolder.userData['iconDepthFactor'] !== state.iconDepthFactor;

// Line 467 (userData storage):
holder.userData['iconDepthFactor'] = state.iconDepthFactor;

// Lines 476-477 (iconLoader call) — compute actual units:
// iconDepthFactor is a fraction of thickness; convert to diagram units for the loader.
const iconMaxDepth = state.iconDepthFactor * state.thickness;
this.iconLoader.load(
  state.iconUrl,
  iconWidth,
  iconHeight,
  state.iconStyle,
  iconMaxDepth,      // ← was: state.iconDepth
  state.metalness,
  state.roughness,
);
```

**Change 3: Fix `ensureText` import**

Replace:
```typescript
import { ensureText } from './TextRenderer';
```
With:
```typescript
import { ensureText } from '@brewsite/core';
```

`TextWithLayout` is already imported from `'./types'` — do not add a duplicate import.

### 12.2 `rendering/EdgeRenderer.ts`

**Change 1: Accept `tubeRadialSegments` in constructor**

Add a new constructor parameter:

```typescript
constructor(
  private readonly materialFactory: IEdgeMaterialFactory,
  private readonly use3DArrows: boolean = false,
  private readonly edgeSmoothness: number = 0.5,
  private readonly edgeMetalness: number = 0.3,
  private readonly edgeRoughness: number = 0.7,
  private readonly flowSpeed: number = 0.7,
  private readonly flowWidth: number = 0.18,
  private readonly tubeRadialSegments: number = 8,  // ← NEW
) {}
```

**Change 2: Replace hardcoded `8` with `this.tubeRadialSegments`**

Two occurrences (lines 92 and 143) in `createEntry` and `updateEntry`:

```typescript
// BEFORE:
new THREE.TubeGeometry(curve, segments, edge.thickness, 8, false)

// AFTER:
new THREE.TubeGeometry(curve, segments, edge.thickness, this.tubeRadialSegments, false)
```

**Change 3: Two `EdgeRenderer` construction call sites — both must be specified**

**Call site 1:** `packages/diagram/src/elements/diagram/render.ts:79` — the main diagram per-scene renderer.

```typescript
// BEFORE:
this.edgeRenderer = new EdgeRenderer(
  new EdgeMaterialFactory(),
  tc.use3DArrows,
  tc.edgeSmoothness,
  tc.edgeMetalness,
  tc.edgeRoughness,
  tc.edgeFlowSpeed,
  tc.edgeFlowWidth,
);

// AFTER:
this.edgeRenderer = new EdgeRenderer(
  new EdgeMaterialFactory(),
  tc.use3DArrows,
  tc.edgeSmoothness,
  tc.edgeMetalness,
  tc.edgeRoughness,
  tc.edgeFlowSpeed,
  tc.edgeFlowWidth,
  tc.edgeTubeRadialSegments,  // ← NEW
);
```

**Known limitation:** `EdgeRenderer` is constructed once on the first `update()` call and reused for all subsequent scenes. This is an existing design constraint shared with `use3DArrows`, `edgeSmoothness`, and other constructor params. If two consecutive diagram scenes use different themes with different `tubeRadialSegments` values (e.g., a `darkGlass` scene followed by a `neonCyber` scene with `tubeRadialSegments: 12`), the second scene will silently use the first scene's value. This is acceptable scope — fixing it requires a renderer-rebuild-on-theme-change mechanism that is outside this overhaul's scope. Document with an inline comment:

```typescript
// Note: EdgeRenderer is created once and reused for all scenes. Constructor params
// (including tubeRadialSegments) are frozen to the first rendered scene's themeConfig.
// If scenes use different themes with different tubeRadialSegments, only the first
// scene's value applies. A renderer-rebuild mechanism is needed to fix this fully.
this.edgeRenderer = new EdgeRenderer(...);
```

**Call site 2:** `packages/diagram/src/elements/diagram/canvas/render.ts:24` — the DiagramCanvas cross-diagram pipe renderer.

```typescript
// Current (NO CHANGE NEEDED — constructor still accepts defaults):
this.pipeRenderer = new EdgeRenderer(new EdgeMaterialFactory());
```

The canvas `pipeRenderer` renders cross-diagram pipe connectors, not per-diagram edges. It has no access to per-diagram `themeConfig` and always uses constructor defaults. With `tubeRadialSegments` defaulting to `8`, cross-diagram pipes continue to use 8-sided tube geometry. This is intentional — canvas pipes are a canvas-level concern, not a per-diagram-theme concern. Add a comment:

```typescript
// Canvas pipe renderer uses default EdgeRenderer construction (tubeRadialSegments=8).
// Cross-diagram pipes are not per-theme-styled; the default geometry is intentional.
this.pipeRenderer = new EdgeRenderer(new EdgeMaterialFactory());
```

Add `packages/diagram/src/elements/diagram/canvas/render.ts` to Stream C's file list for this comment addition. No functional change required.

**Stream C test file also includes `rendering/__tests__/EdgeRenderer.test.ts`** — the test currently constructs `EdgeRenderer` with `new EdgeRenderer(new EdgeMaterialFactory())` at line 32 and `new EdgeRenderer(new EdgeMaterialFactory(), true)` at line 106. Both continue to work with no changes because the new 8th parameter has a default value of `8`. However, add an explicit test case:

```typescript
it('uses themeConfig tubeRadialSegments instead of hardcoded 8', () => {
  const renderer = new EdgeRenderer(new EdgeMaterialFactory(), false, 0.5, 0.3, 0.7, 0.7, 0.18, 12);
  renderer.getOrCreate(makeEdge(), parent);
  const tube = entry.tube.geometry as THREE.TubeGeometry;
  expect(tube.parameters.radialSegments).toBe(12);
});
```

### 12.3 `rendering/GroupRenderer.ts`

**Change 1: Delete static constants**

Remove these four lines:
```typescript
private static readonly BORDER_PX_TO_UNITS = 0.4;
private static readonly BORDER_SIDE_DARKEN = 0.4;
private static readonly BORDER_METALNESS = 0.35;
private static readonly BORDER_ROUGHNESS = 0.45;
```

**Change 2: Import from `renderConstants.ts`**

Add at top of file:
```typescript
import { GROUP_BORDER_PX_TO_UNITS, GROUP_RENDER_Z } from '../renderConstants';
```

**Change 3: Fix inline -0.6 literal (line 148)**

```typescript
// BEFORE:
entry.group.position.set(centerX, centerY, -0.6);

// AFTER:
entry.group.position.set(centerX, centerY, GROUP_RENDER_Z);
```

**Change 4: Fix `BORDER_PX_TO_UNITS` reference (line 284)**

```typescript
// BEFORE:
const bw = Math.max(0.01, state.borderWidth * GroupRenderer.BORDER_PX_TO_UNITS);

// AFTER:
const bw = Math.max(0.01, state.borderWidth * GROUP_BORDER_PX_TO_UNITS);
```

**Change 5: Make `themeConfig` REQUIRED across all GroupRenderer methods**

The no-compat constraint prohibits silent fallbacks to old behavior. The `??` fallback pattern (`themeConfig?.groupBorderMetalness ?? 0.35`) is exactly a silent fallback — if `themeConfig` is absent, the border gets hardcoded 0.35, not a TypeScript error. This violates the constraint.

**Action:** Change `themeConfig` from optional to required in `getOrCreate`, `updateGroup`, and `createBorder`. Remove ALL `??` fallback patterns. Provide required types.

Updated `getOrCreate` signature:
```typescript
getOrCreate(
  state: DiagramGroupState,
  diagramId: string,
  parent: THREE.Object3D,
  themeConfig: DiagramThemeRenderConfig,  // was: themeConfig?: DiagramThemeRenderConfig
): GroupRenderEntry
```

Updated `createBorder` signature:
```typescript
private createBorder(
  state: DiagramGroupState,
  themeConfig: DiagramThemeRenderConfig,  // was: themeConfig?: DiagramThemeRenderConfig
): THREE.Group | undefined
```

Updated `updateGroup` signature:
```typescript
private updateGroup(
  entry: GroupRenderEntry,
  state: DiagramGroupState,
  themeConfig: DiagramThemeRenderConfig,  // was: themeConfig?: DiagramThemeRenderConfig
): void
```

Replace hardcoded static refs — no `??` fallbacks:
```typescript
// In faceMat creation:
metalness: themeConfig.groupBorderMetalness,
roughness: themeConfig.groupBorderRoughness,

// In sideMat creation:
color: new THREE.Color(state.borderColor).multiplyScalar(themeConfig.groupBorderSideDarken),
metalness: themeConfig.groupBorderMetalness,
roughness: themeConfig.groupBorderRoughness,
```

The hardcoded `0.45` scalars for `edgeLines` color (lines 214 and 337 in `updateGroup` and `createBorder`):
```typescript
// BEFORE:
edgeMat.color.set(new THREE.Color(state.borderColor).multiplyScalar(0.45));

// AFTER:
edgeMat.color.set(new THREE.Color(state.borderColor).multiplyScalar(themeConfig.groupBorderEdgeLineDarken));
```

The hardcoded `BORDER_SIDE_DARKEN` usage in `updateGroup` (line 204):
```typescript
// BEFORE (uses GroupRenderer.BORDER_SIDE_DARKEN which is being deleted):
mats[1].color.set(new THREE.Color(state.borderColor).multiplyScalar(GroupRenderer.BORDER_SIDE_DARKEN));

// AFTER:
mats[1].color.set(new THREE.Color(state.borderColor).multiplyScalar(themeConfig.groupBorderSideDarken));
```

The hardcoded `BORDER_SIDE_DARKEN` usage in `createBorder` (line 300) — `sideMat` construction:
```typescript
// BEFORE (sideMat in createBorder):
const sideMat = new THREE.MeshStandardMaterial({
  color: new THREE.Color(state.borderColor).multiplyScalar(GroupRenderer.BORDER_SIDE_DARKEN),
  opacity: state.borderOpacity,
  transparent: true,
  metalness: GroupRenderer.BORDER_METALNESS,
  roughness: GroupRenderer.BORDER_ROUGHNESS,
  // ...
});

// AFTER:
const sideMat = new THREE.MeshStandardMaterial({
  color: new THREE.Color(state.borderColor).multiplyScalar(themeConfig.groupBorderSideDarken),
  opacity: state.borderOpacity,
  transparent: true,
  metalness: themeConfig.groupBorderMetalness,
  roughness: themeConfig.groupBorderRoughness,
  // ...
});
```

Note: `BORDER_SIDE_DARKEN` appears at **two sites** — line 204 (`updateGroup`) and line 300 (`createBorder`). Both must change to `themeConfig.groupBorderSideDarken`. The `BORDER_METALNESS` and `BORDER_ROUGHNESS` static fields on the same line 300 block are also replaced with `themeConfig.groupBorderMetalness` and `themeConfig.groupBorderRoughness` respectively (same as faceMat in the block above).

**Verify call site in `render.ts`:** The `groupRenderer.getOrCreate(state, diagramId, parent, themeConfig)` call in `render.ts` already passes `themeConfig` (verified by reading the source). No change needed there.

**Test impact:** `GroupRenderer.test.ts` must be updated to always pass a complete `themeConfig` fixture to `getOrCreate`. Construct a minimal `DiagramThemeRenderConfig` test fixture:
```typescript
const testThemeConfig: DiagramThemeRenderConfig = {
  // ... existing required fields ...
  nodeGlowSpread: 2.2,
  edgeTubeRadialSegments: 8,
  groupBorderMetalness: 0.35,
  groupBorderRoughness: 0.45,
  groupBorderSideDarken: 0.40,
  groupBorderEdgeLineDarken: 0.45,
};
```
Any test that currently calls `getOrCreate(..., undefined)` or omits `themeConfig` will get a TypeScript error — update those tests to pass `testThemeConfig`.

**Change 6: Fix `ensureText` import**

Replace:
```typescript
import { ensureText } from './TextRenderer';
```
With:
```typescript
import { ensureText } from '@brewsite/core';
```

### 12.4 Excluded Constants Documentation Comments

Four sets of internal rendering constants are excluded from theme exposure (per the four-condition principle in the feature note). The plan requires documentation comments be added at each site so future contributors know why these are not theme-exposed.

**Change 1: `rendering/NodeRenderer.ts` — side-face emissive multipliers (lines 52–54)**

Add inline comments to the top/bottom emissive scalars:

```typescript
// Top-face sub-emissive: 0.05 gives a faint upward-light highlight calibrated to the
// default lighting rig (ambient + directional from above). Bottom: 0.02 is near-zero,
// producing an ambient shadow effect. These are aesthetic calibrations for the default
// node lighting setup — not theme-exposed (four-condition principle: they co-vary with
// scene lighting, which is not a diagram-element concern, and are not independently
// composable outside the node geometry context).
top.emissive = new THREE.Color(state.sideColor).multiplyScalar(0.05);
// ...
bottom.emissive = new THREE.Color(state.sideColor).multiplyScalar(0.02);
```

**Change 2: `rendering/NodeRenderer.ts` — label layout ratios (lines 393–397)**

Add inline comments above the label layout block:

```typescript
// Label layout ratios relative to contentH (node interior height after shape masking).
// 0.28 = label font-size base fraction of contentH (before theme labelSizeFactor scaling).
// 0.18 = sublabel font-size base fraction of contentH.
// 1.1  = line-height multiplier (10% leading above the font-size).
// 0.06 = vertical gap between label and sublabel as a fraction of contentH.
//
// These are internal geometry calibration ratios for the node face. Theme-level
// scaling is applied via effectiveLabelSizeFactor / effectiveSublabelSizeFactor
// (which are the supported customization path). The raw ratios are not theme-exposed —
// they co-vary with node geometry and troika-three-text rendering characteristics,
// and are not independently composable (four-condition principle).
const labelFontSize = contentH * 0.28 * (themeConfig.effectiveLabelSizeFactor ?? 1.0);
```

**Change 3: `rendering/GroupRenderer.ts` — group title label layout constants (lines 235–240)**

Add inline comments above the group title font-size block:

```typescript
// Group title label layout constants.
// 0.08 = label font-size as fraction of group height h (unclamped size: h × 0.08).
// 0.35 = minimum font-size floor in diagram units (prevents unreadably small labels).
// 1.6  = ceiling scale on availableHalfBand (max font-size proportional to title band).
//        Clamped: clamp(h × 0.08, 0.35, availableHalfBand × 1.6)
// 0.7  = horizontal inset from group border to label text edge (labelInsetX, diagram units).
//
// These are geometry calibration constants for the group title band. Theme scaling is
// applied via effectiveLabelSizeFactor. The raw ratios are not theme-exposed — they
// are calibrated together to keep labels proportional as groups scale in size and are
// not independently composable (four-condition principle).
const labelFontSize = Math.max(
  0.35,
  Math.min(state.bounds.h * 0.08, availableHalfBand * 1.6),
) * (themeConfig.effectiveLabelSizeFactor ?? 1.0);
const labelInsetX = 0.7;
```

**Change 4: `shapes/svgIcon3D.ts` — extrusion ratio multipliers**

Per architectural review, `svgIcon3D.ts` already contains comprehensive documentation on its extrusion ratios in `resolveLayerConfig`. No new comments needed. The plan acknowledges this — no action required for Stream C on this file.

**Stream assignment:** All three comment changes (Changes 1–3) are in `rendering/NodeRenderer.ts` and `rendering/GroupRenderer.ts`, which are Stream C files. Add these as step 6 in Stream C's "What to do" list.

---

## 13. `routeEdges` Call Site in `render.ts` / Widget

Wherever `EdgeRenderer` is constructed (likely in `render.ts` or `DiagramWidget`), the constructor call must pass `themeConfig.edgeTubeRadialSegments`. The developer implementing Stream C must:

1. Search for `new EdgeRenderer(` in `packages/diagram/src/elements/diagram/`
2. Add `themeConfig.edgeTubeRadialSegments` as the 8th argument

---

## 14. Scene Audit Task

### Search Scope

Grep `apps/examples/src/` for the following patterns:
- `iconDepth` — any explicit override on `<DiagramNode>` props (will need → `iconDepthFactor` rename)
- `iconScale` — note that this prop is still `iconScale` (unchanged on DSL), but verify no test fixtures use hardcoded `0.15` values for iconDepth-type values

### Findings From Pre-Plan Audit

Grep result on `iconDepth` in `apps/examples/`:
```
apps/examples/src/brewflow-sidecar/theme.ts:5:// iconDepth is NOT a theme-level property...
```
This is a comment, not actual usage. **No explicit `iconDepth` prop is used in any example scene.** Stream E scope is minimal.

### Files to Verify Visually After Landing

After all streams merge, run `pnpm dev` and visually verify:
- `apps/examples/src/diagram/` — all diagram scenes
- `apps/examples/src/lucid/` — Lucid import scenes
- Any scene using `organicVariation` routing or group borders

---

## 15. Work Streams

### Dependency Graph

```
Sub-A1 (types.ts + renderConstants.ts)
  ├── Sub-A2  [after Sub-A1 done]   themes + themeResolver + nodeCompiler + layoutAlgorithms + groupCompiler
  │     └── Sub-A3  [after Sub-A1 AND Sub-A2 done]   compile.ts only
  ├── Stream B  [fully independent]   edgeRouter.ts
  ├── Stream C  [after Sub-A1 done, parallel with Sub-A2+Sub-A3]   rendering layer
  ├── Stream D  [fully independent]   dsl.tsx + apps audit
  └── Stream E  [fully independent]   labels/types.ts
```

**Why Sub-A1 is the blocking prerequisite for everything:** `types.ts` defines `DiagramThemeRenderConfig`, `DiagramNodeState`, `DiagramNodeDSL`, `DiagramThemeNodeConfig`, etc. All downstream work in Sub-A2, Sub-A3, and Stream C reads these new/changed types. Without Sub-A1 merged (or available locally), every other stream gets TypeScript errors on the new `themeConfig.nodeGlowSpread`, `iconDepthFactor`, etc. references they write.

**Stream C and compile-time independence:** Stream C CANNOT be started from `main`. The developer writing Stream C must branch from Sub-A1 (i.e., work on a local branch that already includes Sub-A1's `types.ts` and `renderConstants.ts` changes). Running `pnpm --filter @brewsite/diagram typecheck` on a Stream C branch that starts from unmodified `main` will fail immediately with "Property 'nodeGlowSpread' does not exist on type 'DiagramThemeRenderConfig'" on every new render usage. Once Sub-A1 merges to main, Stream C can continue on its own branch cleanly.

---

### Sub-A1: Type Foundations (blocking prerequisite — must merge first)

**Scope:** Two files with zero cross-dependencies. These define the type contracts that everything else reads.

**Files:**
```
packages/diagram/src/elements/diagram/renderConstants.ts       ← CREATE
packages/diagram/src/elements/diagram/types.ts
```

**No test files** — `renderConstants.ts` is a pure constant export (no logic to test in isolation). `types.ts` is a type contract; type correctness is validated when downstream compilers pass typecheck.

**What to do:**
1. Create `renderConstants.ts` with exact content from Section 2
2. Update `types.ts` per Section 3: add required properties to `DiagramThemeNodeConfig`, `DiagramThemeGroupConfig`, `DiagramThemeEdgeConfig`; add all new fields to `DiagramThemeRenderConfig`; rename `iconDepth` → `iconDepthFactor` on `DiagramNodeDSL` and `DiagramNodeState`; delete `DiagramPivot`

**When Sub-A1 is merged to main, Sub-A2, Sub-A3, and Stream C are all unblocked.**

---

### Sub-A2: Theme Implementations + Compile-Layer Compilers (after Sub-A1)

**Scope:** All files that consume the updated types from Sub-A1. These are independent of each other within this sub-stream.

**Files:**
```
packages/diagram/src/elements/diagram/themes/darkGlass.ts
packages/diagram/src/elements/diagram/themes/enterprise.ts
packages/diagram/src/elements/diagram/themes/neonCyber.ts
packages/diagram/src/elements/diagram/themes/lightMinimal.ts
packages/diagram/src/elements/diagram/compiler/themeResolver.ts
packages/diagram/src/elements/diagram/compiler/nodeCompiler.ts
packages/diagram/src/elements/diagram/compiler/layoutAlgorithms.ts
packages/diagram/src/elements/diagram/compiler/groupCompiler.ts
```

**Test files (owned by Sub-A2):**
```
packages/diagram/src/elements/diagram/compiler/__tests__/themeResolver.test.ts
packages/diagram/src/elements/diagram/compiler/__tests__/transitionHelpers.test.ts
packages/diagram/src/elements/diagram/themes/__tests__/mergeTheme.test.ts
packages/diagram/src/elements/diagram/canvas/compiler/__tests__/pipeRouter.test.ts
```

**What to do:**
1. Update all four theme files per Section 4
2. Update `themeResolver.ts` per Section 9
3. Update `nodeCompiler.ts` per Section 8 (buildNodeDefaults — all three hardcoded values → theme props; compileNode `iconDepth` → `iconDepthFactor` rename; do NOT export FALLBACK_NODE_SIZE — eliminated by Option B)
4. Update `layoutAlgorithms.ts` per Section 5.1 (remove both local `DEFAULT_NODE_SIZE` definitions; add `defaultNodeSize: readonly [number, number]` parameter to `resolveFlowLayout`, `resolveLayout`, `resolveLayoutWithGroups`; replace all `DEFAULT_NODE_SIZE` usages with the parameter)
5. Update `groupCompiler.ts` per Section 5.2 (import `GROUP_BORDER_PX_TO_UNITS` from `../renderConstants`, remove local def)

**Test strategy (Sub-A2):**
- `themeResolver.test.ts`: Assert that `buildThemeRenderConfig` maps all new theme properties to the correct `DiagramThemeRenderConfig` fields. Use `darkGlassTheme` as input; assert `nodeGlowSpread: 2.2`, `edgeTubeRadialSegments: 8`, `groupBorderMetalness: 0.35`, etc.
- `transitionHelpers.test.ts`: Rename `iconDepth: 0.1` → `iconDepthFactor: 0.1` in all test fixtures (mechanical rename).
- `pipeRouter.test.ts`: Rename `iconDepth: 0.1` → `iconDepthFactor: 0.1` in all test fixtures.
- `mergeTheme.test.ts`: If this test constructs `DiagramTheme` objects directly, update fixtures to include all new required properties.

---

### Sub-A3: compile.ts Integration (after Sub-A1 AND Sub-A2)

**Scope:** `compile.ts` only. Depends on Sub-A1 (`renderConstants.ts`, updated types) and Sub-A2 (`layoutAlgorithms.ts` new signatures, `themeResolver.ts`, `nodeCompiler.ts`).

**Files:**
```
packages/diagram/src/elements/diagram/compile.ts
```

**Test files (owned by Sub-A3):**
```
packages/diagram/src/elements/diagram/__tests__/compile.test.ts
packages/diagram/src/elements/diagram/__tests__/normalizeToViewport.test.ts
```

**What to do:**
1. Remove local `const GROUP_RENDER_Z` and `const GROUP_BORDER_PX_TO_UNITS` definitions from `compile.ts`
2. Add import: `import { GROUP_RENDER_Z, GROUP_BORDER_PX_TO_UNITS } from './renderConstants';`
3. Replace inline `-0.6` literal at line 301 with `GROUP_RENDER_Z`
4. Add `theme.edge.organicVariation` as 7th arg to `routeEdges` call per Section 10
5. Add `theme.node.defaultSize` as last arg to `resolveLayoutWithGroups` call per Section 5.1
6. Update `sizeMap` construction to use `theme.node.defaultSize` as fallback per Section 5.1
7. Add ManualLayout node-size sanity warning per Section 8

**Test strategy (Sub-A3):**
- `compile.test.ts`: Add test asserting that a node compiled without explicit `size` receives `theme.node.defaultSize` (not `[4, 2]` literally). Add test asserting `iconDepthFactor` on compiled `DiagramNodeState` equals theme default. Add test asserting `organicVariation` is threaded to `routeEdges` (verify with a spy if needed). Add test for ManualLayout size warning (`onWarn` called when node size dimension > 1.5 in manual mode).
- `normalizeToViewport.test.ts`: No changes needed (this function does not touch `iconDepthFactor` or the new theme properties).

---

### Stream B: Edge Router (organicVariation + documentation)

**Scope:** `edgeRouter.ts` only — add `organicVariation` parameter, document all curve tuning literals.

**Files (disjoint from all other streams):**
```
packages/diagram/src/elements/diagram/compiler/edgeRouter.ts
```

**Test files (owned by Stream B):**
```
packages/diagram/src/elements/diagram/compiler/__tests__/edgeRouter.test.ts
```

**What to do:**
1. Update `routeEdgeOrganic` signature per Section 11 Change 1
2. Replace hardcoded `1.6` with `organicVariation` parameter per Section 11
3. Update `routeEdges` signature per Section 11 Change 2 (add `organicVariation: number = 1.6`)
4. Thread `organicVariation` to the `'organic'` case call site per Section 11
5. Add inline JSDoc to all parameters in `routeEdgeCurvedProfile` per Section 11 Change 3
6. Add inline comments to `stub` and `ce` per Section 11 Change 4

**Agreed function signature (coordinate with Sub-A3 / Stream D):**
```typescript
export function routeEdges(
  edges: ReadonlyArray<EdgeRoutingInput>,
  positions: Map<string, Vec3>,
  sizes: Map<string, NodeDimensions>,
  defaultRouting: EdgeRoutingAlgorithm = 'curved',
  defaultLanding: EdgeLandingAlgorithm = 'nearest-face',
  onWarn?: DiagramWarnFn,
  organicVariation: number = 1.6,
): Map<string, ReadonlyArray<Vec3>>
```

**Test strategy (Stream B):**
- `edgeRouter.test.ts`: Two existing direct calls to `routeEdgeOrganic` (at lines 219 and 228 in the current file) must each have `organicVariation` inserted as the 8th positional argument (before the optional `srcAnchor`/`dstAnchor`). Use `1.6` to preserve current behavior. Example:
  ```typescript
  // BEFORE (line 219):
  routeEdgeOrganic(fromPos, fromSize, 'right', toPos, toSize, 'left', 'edge-1', undefined, undefined)
  // AFTER:
  routeEdgeOrganic(fromPos, fromSize, 'right', toPos, toSize, 'left', 'edge-1', 1.6, undefined, undefined)
  ```
  Without this update, TypeScript reports a type error (Vec3 | undefined where number is expected). These are the only direct `routeEdgeOrganic` call sites in the test file.
- Add a new test exercising `routeEdges` with `defaultRouting: 'organic'` and a custom `organicVariation`. Assert that the returned control points for an organic edge differ from the `organicVariation: 0` case. Use a deterministic edge ID so the hash-based offset is predictable. No mocking needed — `routeEdges` is pure.
- Verify existing tests still pass by running `pnpm --filter @brewsite/diagram vitest run src/elements/diagram/compiler/__tests__/edgeRouter.test.ts`.

---

### Stream C: Rendering Layer Updates + TextRenderer Deletion

**Scope:** All Three.js rendering class changes. TextRenderer deletion and import site cleanup.

**Files (disjoint from all other streams):**
```
packages/diagram/src/elements/diagram/rendering/NodeRenderer.ts
packages/diagram/src/elements/diagram/rendering/EdgeRenderer.ts
packages/diagram/src/elements/diagram/rendering/GroupRenderer.ts
packages/diagram/src/elements/diagram/rendering/TextRenderer.ts  ← DELETE
```

**Test files (owned by Stream C):**
```
packages/diagram/src/elements/diagram/rendering/__tests__/NodeRenderer.test.ts
packages/diagram/src/elements/diagram/rendering/__tests__/GroupRenderer.test.ts
packages/diagram/src/elements/diagram/rendering/__tests__/EdgeRenderer.test.ts
```

**What to do:**
1. Delete `TextRenderer.ts`
2. Update `NodeRenderer.ts` per Section 12.1 (glowSpread, iconDepthFactor, ensureText import)
3. Update `EdgeRenderer.ts` per Section 12.2 (tubeRadialSegments constructor param)
4. Update `GroupRenderer.ts` per Section 12.3 (constants, imports, themeConfig required, ensureText import)
5. Find and update the `EdgeRenderer` constructor call sites (in `render.ts` AND `canvas/render.ts`) per Section 12.2 Change 3
6. Add excluded-constant documentation comments per Section 12.4: side-face emissive comments in `NodeRenderer.ts`, label ratio comments in `NodeRenderer.ts`, and group title label comments in `GroupRenderer.ts`

**Dependency note (IMPORTANT — read before starting):** Stream C CANNOT start from `main`. The developer MUST branch from Sub-A1 (i.e., start from a local state where `types.ts` and `renderConstants.ts` already include all Sub-A1 changes). Without Sub-A1, every `themeConfig.nodeGlowSpread`, `themeConfig.edgeTubeRadialSegments`, `themeConfig.groupBorderMetalness` reference in the new renderer code will fail typecheck immediately. Stream C can develop in parallel with Sub-A2 and Sub-A3 (since Stream C reads from `DiagramThemeRenderConfig` in types.ts, not from any Sub-A2 files). Once Sub-A1 merges to main, Stream C can merge independently of Sub-A2 and Sub-A3.

**Test strategy (Stream C):**
- Tests in `rendering/__tests__/` use real Three.js `WebGLRenderer` doubles or minimal test setups. The existing tests use interface-based doubles.
- `NodeRenderer.test.ts`: Update any fixture that sets `iconDepth` → `iconDepthFactor`. Add assertion that `iconLoader.load` is called with `iconDepthFactor * thickness` (not raw `iconDepthFactor`) when an icon is present.
- `GroupRenderer.test.ts`: Update fixtures to supply a `themeConfig` that includes the new border material fields. Assert that the `frameMesh` material's `metalness` matches `themeConfig.groupBorderMetalness` (not the hardcoded 0.35). Assert `group.position.z === GROUP_RENDER_Z`.
- `EdgeRenderer.test.ts`: Construct `EdgeRenderer` with a custom `tubeRadialSegments` (e.g., 12). Call `getOrCreate` with an edge. Assert the resulting `TubeGeometry.parameters.radialSegments === 12`.

---

### Stream D: DSL Documentation + Apps/Examples Audit

**Scope:** `dsl.tsx` JSDoc fixes, apps/examples scene audit for broken prop names.

**Files (disjoint from all other streams):**
```
packages/diagram/src/elements/diagram/dsl.tsx
apps/examples/src/**  (any files requiring updates)
```

**What to do:**
1. Apply all `dsl.tsx` changes per Section 6 (size JSDoc fix, iconDepth→iconDepthFactor rename, iconScale JSDoc update)
2. Grep `apps/examples/src/` for `iconDepth` prop on JSX elements (pattern: `iconDepth={`) — update any found to `iconDepthFactor`
3. Grep for `size={\[` patterns in ManualLayout diagrams — verify no node has size dimension > 1.5 that would incorrectly trigger the new warning
4. Visually verify all diagram scenes in the dev app after all streams merge

**Test strategy (Stream D):**
- `dsl.tsx` JSDoc changes have no unit tests (they are documentation). TypeScript `tsc --noEmit` will catch type errors if the prop rename is incomplete.
- After updating any `apps/examples/` files: run `pnpm typecheck` to verify no remaining `iconDepth` prop usage.
- No new test files needed.

---

### Stream E: LabelStyle.fontSize Documentation

**Scope:** Add JSDoc documentation to `LabelStyle.fontSize` in the model package's labels types.

**Files (disjoint from all other streams):**
```
packages/model/src/labels/types.ts
```

**What to do:**

Find `fontSize?: number | string` in `packages/model/src/labels/types.ts` and add the JSDoc:

```typescript
/**
 * Label font size.
 * - `number`: interpreted as pixels (e.g., `14` → `14px`).
 * - `string`: any valid CSS font-size value (e.g., `"1.2rem"`, `"150%"`).
 * Default: `12` (px).
 *
 * This type is intentionally `number | string` to match React's CSSProperties.fontSize.
 * Numeric values are handled by React's CSS-in-JS as `px`; strings are passed through as-is.
 * Do NOT narrow to `number` — string values are valid CSS and intentionally supported.
 */
fontSize?: number | string;
```

**Test strategy (Stream E):**
- Documentation-only change. No tests required. `pnpm typecheck` validates no regressions.

---

## 16. Verification Checklist

The architect will use this list in Phase 6 to verify 100% completion.

1. `renderConstants.ts` exists at `packages/diagram/src/elements/diagram/renderConstants.ts` with exactly `GROUP_RENDER_Z = -0.6` and `GROUP_BORDER_PX_TO_UNITS = 0.4`.
2. `compile.ts` contains no local definition of `GROUP_RENDER_Z` or `GROUP_BORDER_PX_TO_UNITS`.
3. `compile.ts` line 301 uses `GROUP_RENDER_Z` from import (not `-0.6` literal).
4. `compiler/groupCompiler.ts` contains no local `GROUP_BORDER_PX_TO_UNITS` definition; imports from `../renderConstants`.
5. `rendering/GroupRenderer.ts` contains no `private static readonly BORDER_PX_TO_UNITS/BORDER_SIDE_DARKEN/BORDER_METALNESS/BORDER_ROUGHNESS` fields; imports `GROUP_BORDER_PX_TO_UNITS` and `GROUP_RENDER_Z` from `../renderConstants`.
6. `rendering/GroupRenderer.ts` line 148 uses `GROUP_RENDER_Z` from import (not `-0.6` literal).
7. `DiagramThemeNodeConfig` has `defaultSize`, `defaultIconScale`, `defaultIconDepthFactor`, `glowSpread` — all required (not optional).
8. `DiagramThemeGroupConfig` has `borderMetalness`, `borderRoughness`, `borderSideDarken`, `borderEdgeLineDarken` — all required.
9. `DiagramThemeEdgeConfig` has `tubeRadialSegments`, `organicVariation` — both required.
10. `DiagramThemeRenderConfig` has `nodeGlowSpread`, `edgeTubeRadialSegments`, `groupBorderMetalness`, `groupBorderRoughness`, `groupBorderSideDarken`, `groupBorderEdgeLineDarken` — all present.
11. All four themes (`darkGlass`, `enterprise`, `neonCyber`, `lightMinimal`) pass TypeScript typecheck without `as const` escape hatches for the new required fields.
12. `DiagramNodeState.iconDepth` is gone; `DiagramNodeState.iconDepthFactor` exists as `readonly number`.
13. `DiagramNodeDSL.iconDepth` is gone; `DiagramNodeDSL.iconDepthFactor` exists as `readonly number | undefined`.
14. `DiagramNodeProps.iconDepth` is gone; `DiagramNodeProps.iconDepthFactor` exists in `dsl.tsx`.
15. `buildNodeDefaults` returns `iconScale: theme.node.defaultIconScale` and `iconDepthFactor: theme.node.defaultIconDepthFactor` (no hardcoded values).
16. `buildNodeDefaults` returns `size: theme.node.defaultSize` (no hardcoded `[4, 2]`).
17. `layoutAlgorithms.ts` has no local `DEFAULT_NODE_SIZE` constant. `resolveFlowLayout`, `resolveLayout`, and `resolveLayoutWithGroups` all accept a `defaultNodeSize: readonly [number, number]` parameter. `compile.ts` passes `theme.node.defaultSize` to `resolveLayoutWithGroups`. No `FALLBACK_NODE_SIZE` export exists in `nodeCompiler.ts`.
18. `buildThemeRenderConfig` maps all new theme properties to `DiagramThemeRenderConfig`.
19. `routeEdges` accepts `organicVariation: number = 1.6` as 7th parameter.
20. `routeEdgeOrganic` uses the `organicVariation` parameter instead of the `1.6` literal.
21. `compile.ts` passes `theme.edge.organicVariation` to `routeEdges`.
22. `routeEdgeCurvedProfile` has inline JSDoc on all 12 parameters.
23. `routeEdgeOrthogonal` has inline comments on `stub` and `ce` explaining their coupling.
24. `TextRenderer.ts` does not exist in the repository.
25. `NodeRenderer.ts` imports `ensureText` from `@brewsite/core`, not from `./TextRenderer`.
26. `GroupRenderer.ts` imports `ensureText` from `@brewsite/core`, not from `./TextRenderer`.
27. `NodeRenderer.ts` passes `state.iconDepthFactor * state.thickness` (not `state.iconDepth`) to `iconLoader.load`.
28. `NodeRenderer.ts` uses `themeConfig.nodeGlowSpread` in all three `createGlow`/`computeGlowScale` call sites.
29. `EdgeRenderer` constructor accepts `tubeRadialSegments: number` as 8th parameter with default 8.
30. `EdgeRenderer` uses `this.tubeRadialSegments` in both `TubeGeometry` constructor calls.
31. `GroupRenderer.getOrCreate`, `GroupRenderer.createBorder`, and `GroupRenderer.updateGroup` all accept `themeConfig: DiagramThemeRenderConfig` (required, not optional — no `?`). No `themeConfig?.` optional chaining exists on `themeConfig` itself anywhere in `GroupRenderer.ts`. The group title label font-size block uses `themeConfig.effectiveLabelSizeFactor ?? 1.0` (required themeConfig access, `?? 1.0` retained because `effectiveLabelSizeFactor` is `?: number` in `DiagramThemeRenderConfig`). No `??` fallbacks on the border material properties (`groupBorderMetalness`, `groupBorderRoughness`, `groupBorderSideDarken`, `groupBorderEdgeDarken`).
32. `GroupRenderer.createBorder` uses `themeConfig.groupBorderMetalness` and `themeConfig.groupBorderRoughness` (not `?? 0.35` / `?? 0.45`).
33. `GroupRenderer.updateGroup` (line 204) AND `GroupRenderer.createBorder` (line 300) both use `themeConfig.groupBorderSideDarken` — not `GroupRenderer.BORDER_SIDE_DARKEN`. The edge-line `0.45` scalar at lines 214 and 337 both use `themeConfig.groupBorderEdgeLineDarken`. No hardcoded scalars, no `??` fallbacks, no static field references anywhere in `GroupRenderer.ts`.
34. `dsl.tsx` `size` JSDoc says `Default: [4, 2]` (not `[0.12, 0.10]`).
35. `dsl.tsx` `iconDepth` prop is gone; `iconDepthFactor` prop exists with correct JSDoc.
36. `DiagramPivot` type is deleted from `types.ts`.
37. `packages/model/src/labels/types.ts` `fontSize` has the full JSDoc comment explaining `number | string`.
38. `pnpm --filter @brewsite/diagram typecheck` passes with zero errors.
39. `pnpm --filter @brewsite/diagram test` passes with zero failures.
40. `pnpm --filter @brewsite/core test` passes with zero failures (no regressions from upstream).
41. All diagram scenes in `apps/examples/` render correctly in the dev app with no visual regressions.
42. No `@deprecated` JSDoc is present on any code that still exists in the repository.
43. No `iconDepth` literal (as a property name, not a comment or string) exists anywhere in `packages/diagram/src/`.
44. No local definition of `GROUP_RENDER_Z`, `GROUP_BORDER_PX_TO_UNITS`, or `DEFAULT_NODE_SIZE` exists anywhere in `packages/diagram/src/` outside of `renderConstants.ts`. No `FALLBACK_NODE_SIZE` symbol exists anywhere in the codebase.
45. The `'organic'` case call site inside `routeEdges` (line 481 area) passes `organicVariation` as the 8th argument to `routeEdgeOrganic` — TypeScript compiles without error (Vec3 is not passed where number is expected).
46. `edgeRouter.test.ts` direct calls to `routeEdgeOrganic` (lines 219 and 228) have been updated to include `organicVariation` (e.g., `1.6`) as the 8th positional argument before the optional anchor params.
47. `canvas/render.ts` line 24 has an explanatory comment: "Canvas pipe renderer uses default EdgeRenderer construction (tubeRadialSegments=8). Cross-diagram pipes are not per-theme-styled; the default geometry is intentional."
48. `render.ts` EdgeRenderer construction has an explanatory comment about the frozen-on-first-update limitation (see Section 12.2 Known Limitation block).
49. `NodeRenderer.ts` lines 52–54 (side-face emissive multipliers) have inline documentation comments explaining why they are not theme-exposed (per Section 12.4 Change 1).
50. `NodeRenderer.ts` lines 393–397 (label layout ratios) have inline documentation comments explaining why they are not theme-exposed (per Section 12.4 Change 2).
51. `GroupRenderer.ts` lines 235–240 (group title label constants) have inline documentation comments explaining why they are not theme-exposed (per Section 12.4 Change 3).
52. `LabelStyle.fontSize` JSDoc in `packages/model/src/labels/types.ts` says "intentionally supported" (not "in active use").
53. `GroupRenderer.BORDER_SIDE_DARKEN` static field is gone. Grep for `BORDER_SIDE_DARKEN` in `packages/diagram/src/` returns zero matches. Both former usages (line 204 in `updateGroup` and line 300 in `createBorder`) use `themeConfig.groupBorderSideDarken`.
54. `GroupRenderer.BORDER_METALNESS` and `GroupRenderer.BORDER_ROUGHNESS` static fields are gone. Both `faceMat` and `sideMat` in `createBorder` use `themeConfig.groupBorderMetalness` and `themeConfig.groupBorderRoughness` (no `GroupRenderer.` static prefix anywhere).
55. Stream C was developed on a branch that included Sub-A1's `types.ts` and `renderConstants.ts` changes. The branch was NOT started from unmodified `main`. (Verified by confirming `pnpm --filter @brewsite/diagram typecheck` passed on the Stream C branch before merging Sub-A1.)
