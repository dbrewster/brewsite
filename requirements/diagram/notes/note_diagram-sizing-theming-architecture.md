---
title: "Diagram Element: Sizing, Theming, and Architecture Audit"
doc_type: note
owner: product
status: draft
updated: 2026-03-08
---

# Diagram Element: Sizing, Theming, and Architecture Audit

This note captures the findings from a full source read of `packages/diagram/src/`. It is the
input to a planned cleanup/enhancement PRD. Every claim cites exact file paths and constant
values so the architect can write a plan without further research.

---

## 1. Coordinate System Overview

The diagram pipeline has three coordinate spaces:

| Space | Who uses it | Y orientation |
|---|---|---|
| **Diagram units** | Layout algorithms (auto-layout only) | Cartesian Y-up |
| **NVS [0..1]** | Compiler output, edge routing, group bounds | Y-down (y=0 top) |
| **Canvas-local** | Three.js scene (render.ts, all renderers) | Y-up (Y-flip applied) |

The transition points:
1. `compile.ts → normalizeToViewport()` — maps diagram-unit positions/sizes to NVS
2. `render.ts → nodeNvsToCanvasLocal() / nodeSizeToCanvasLocal()` — maps NVS to canvas-local

**Critical exception**: `thickness` (node Z-depth) is never normalized. It passes through the
entire pipeline as a raw diagram-unit value and is treated as a canvas-world-unit depth in the
renderer. This is documented with a comment ("thickness stays in canvas world units") but
creates an asymmetry: at render time a `DiagramNodeState` has `size` in canvas-local units and
`thickness` in diagram units.

---

## 2. Problem 1 — Sizing & Spacing

### 2.1 Default Node Size

**Where**: `nodeCompiler.ts:23` — `size: [4, 2] as [number, number]`

This is in **diagram units** and is correct for auto-layout (it is divided by the layout span
in `normalizeToViewport`). The comment in `nodeCompiler.ts` explicitly warns that ManualLayout
authors **must** specify explicit sizes in `[0..1] NVS fractions` since this default is never
safe for ManualLayout.

**Problem**: The same `[4, 2]` constant is independently duplicated in `layoutAlgorithms.ts:27`
as a local `DEFAULT_NODE_SIZE`. If the default changes, both must be updated.

### 2.2 Layout Algorithm Spacing Constants

These are in **diagram units** (pre-normalization). After normalization they scale to the
correct proportion, so they do not need to be in NVS fractions.

| Constant | Value | File | Line | Assessment |
|---|---|---|---|---|
| `DEFAULT_GROUP_PADDING_NORMALIZED` | `[1.5, 1.5, 1.5, 1.5]` | `layoutResolver.ts` | 84 | Correct for auto-layout — represents ~15% of span |
| `DEFAULT_TITLE_GAP` | `1` | `layoutResolver.ts` | 88 | Correct |
| `DEFAULT_MANUAL_GROUP_PADDING` | `[0.025, 0.025, 0.025, 0.025]` | `layoutResolver.ts` | 87 | Correct — 2.5% NVS per side |
| `DEFAULT_MANUAL_TITLE_GAP` | `0.025` | `layoutResolver.ts` | 90 | Correct — 2.5% NVS |
| `DEFAULT_GRID_SPACING` | `[2, 2]` | `layoutResolver.ts` | 91 | Correct |
| `DEFAULT_HIERARCHICAL_SPACING` | `[1.5, 1.5]` | `layoutResolver.ts` | 92 | Correct |
| `DEFAULT_FLOW_GAP` | `2` | `layoutResolver.ts` | 129 | Correct |

### 2.3 Edge Routing Constants — Calibration Concerns

Edge routing runs **after** `normalizeToViewport`, so all constants are in NVS [0..1] space.
Node-to-node NVS distances for typical diagrams (4–20 nodes) are roughly 0.1–0.5 NVS.

| Constant | Value | File | Line | Assessment |
|---|---|---|---|---|
| `EDGE_EPSILON` | `0.06` | `edgeRouter.ts` | 26 | ⚠️ 60% of a 0.1-NVS node width. High for dense layouts. |
| `MIN_PORT_PITCH` | `0.35` | `edgeRouter.ts` | 27 | ⚠️ 35% of NVS height — very large port spacing minimum |
| `OBSTACLE_PADDING` | `0.2` | `edgeRouter.ts` | 30 | ⚠️ Expands every node obstacle by 20% of viewport — too large for tight diagrams |
| Orthogonal `stub` | `0.8` | `edgeRouter.ts` | 392 | ⚠️ 80% of the NVS range per stub. Orthogonal routes extend far past adjacent nodes in dense diagrams |
| Curved `handleMin` | `0.35` | `edgeRouter.ts` | 319 | ⚠️ For node distances of 0.1–0.2 NVS the handle always clamps to this minimum, producing too-tight curves |
| Curved `minSideHandle` | `0.95` | `edgeRouter.ts` | 330 | ⚠️ Passed to `curveKernel.ts` which floors `startHandle`/`endHandle` at this value whenever `srcFace`/`dstFace` is left or right in render mode (the default). For nodes 0.1 NVS apart, `handleFactor * dist = 0.028`, clamped by `handleMin` to `0.35`, then clamped again to `0.95` — the control point extends 9.5× the inter-node gap. Active on all default `routeEdgeCurved` calls. |
| Curved `handleMax` | `4` | `edgeRouter.ts` | 320 | Effectively unreachable in [0..1] NVS space (would require nodes 14+ NVS apart). Benign but confusing |
| Curved `handleFactor` | `0.28` | `edgeRouter.ts` | 321 | ✓ Scale-relative |
| `END_TOUCH_TOLERANCE_T` | `0.03` | `edgeRouter.ts` | 31 | ✓ A fraction of edge UV, scale-invariant |

**Summary**: The routing constants appear calibrated for a pre-NVS coordinate system where
inter-node distances were 1–5 units rather than 0.1–0.5. The most impactful miscalibrations
are `minSideHandle = 0.95` (curved, render mode), `stub = 0.8` (orthogonal),
`EDGE_EPSILON = 0.06`, `OBSTACLE_PADDING = 0.2`, and `handleMin = 0.35`. `minSideHandle`
is the worst case: it applies a second floor on top of `handleMin`, meaning for any left/right
face edge in render mode the Bézier handle distance is forced to at least 95% of the NVS range
regardless of node proximity.

### 2.4 Theme Default Sizes

These live in theme files and are used as defaults passed into `buildNodeDefaults()`. They are
applied **before** normalization for thickness (which is exempt from normalization), and are
used as-is by renderers for non-layout properties.

| Property | darkGlass | enterprise | neonCyber | lightMinimal | Units |
|---|---|---|---|---|---|
| `node.defaultThickness` | 0.28 | 0.32 | 0.22 | 0.20 | Canvas-world units (not normalized) |
| `node.cornerRadius` | 0.06 | 0.05 | 0.04 | 0.08 | Canvas-world units (not normalized) |
| `edge.defaultThickness` | 0.065 | 0.070 | 0.055 | 0.060 | NVS units (used as tube radius post-normalization) |
| `group.defaultBorderWidth` | 0.5 | 1.25 | 1.75 | 1.25 | "Pixel-like" — multiplied by `GROUP_BORDER_PX_TO_UNITS = 0.4` |
| `group.defaultBorderHeight` | 0.5 | 1.0 | 1.0 | 1.0 | Canvas-world units (not normalized) |

**`node.defaultThickness` is in canvas-world units but is expressed in diagram-unit-sized values.** For a diagram with 10 nodes where each node ends up at ~0.08 NVS height in canvas-local units, a thickness of 0.28 produces nodes that are 3× as thick as they are tall. This is the primary symptom of the thickness-normalization mismatch.

**`node.cornerRadius` has the same issue.** A cornerRadius of 0.06 canvas-world units may be
significant at small canvas sizes but invisible at large ones, or vice versa.

### 2.5 Node Renderer Internal Layout Constants

These run in **canvas-local space** after NVS conversion and are scale-relative fractions of
node content dimensions. They do not need coordination with NVS.

| Constant | Value | File | Line | Assessment |
|---|---|---|---|---|
| Label font size | `contentH * 0.28` | `NodeRenderer.ts` | 393 | ✓ Scale-relative |
| Sublabel font size | `contentH * 0.18` | `NodeRenderer.ts` | 394 | ✓ Scale-relative |
| Line gap | `contentH * 0.06` | `NodeRenderer.ts` | 397 | ✓ Scale-relative |
| Sublabel Y (no icon) | `-contentH * 0.22` | `NodeRenderer.ts` | 399 | ✓ Scale-relative |
| Label Y (sublabel, no icon) | `contentH * 0.1` | `NodeRenderer.ts` | 410 | ✓ Scale-relative |
| Icon center Y | `contentH * 0.2` | `NodeRenderer.ts` | 402–403 | ✓ Scale-relative |
| Icon-to-text gap | `contentH * 0.08` | `NodeRenderer.ts` | 404 | ✓ Scale-relative |
| Text wrapping width | `contentW * 0.85` | `NodeRenderer.ts` | 420, 437 | ✓ Scale-relative |
| Text Z offset addend | `0.02` | `NodeRenderer.ts` | 424, 441 | ⚠️ Absolute canvas units — not scale-relative |
| Glow spread multiplier | `2.2` | `NodeRenderer.ts` | 202, 369 | ✓ Scale-relative (multiplier on node dimensions) |
| Glow Z offset | `-0.1` | `glowSprite.ts` | 69 | ⚠️ Absolute canvas units |

### 2.6 Group Renderer Internal Layout Constants

| Constant | Value | File | Line | Assessment |
|---|---|---|---|---|
| Group Z | `-0.6` | `GroupRenderer.ts` | 148 | ⚠️ Absolute canvas units — must sync with `compile.ts:34` |
| Label min font size | `0.35` | `GroupRenderer.ts` | 236 | ⚠️ Absolute canvas units |
| Label inset X | `0.7` | `GroupRenderer.ts` | 240 | ⚠️ Absolute canvas units |
| Label font formula | `bounds.h * 0.08` | `GroupRenderer.ts` | 238 | ✓ Scale-relative |
| Label font band factor | `1.6` | `GroupRenderer.ts` | 238 | ✓ Scale-relative |

### 2.7 Sync-Required Constants

These exist in multiple files with explicit "Keep in sync" comments. They represent coupling
between the compile layer and the render layer.

| Constant | Value | Files | Lines |
|---|---|---|---|
| `GROUP_BORDER_PX_TO_UNITS` | `0.4` | `compile.ts`, `groupCompiler.ts`, `GroupRenderer.ts` | 32, 48, 10 |
| `GROUP_RENDER_Z` | `-0.6` | `compile.ts`, `GroupRenderer.ts`, `render.ts` | 34, 148, 138 |

The `compile.ts` version of both has explicit "Keep in sync" comments but the constants are
not exported from a canonical location — each file defines its own local copy.

---

## 3. Problem 2 — Theming Completeness

### 3.1 What the Theme Currently Controls

`DiagramTheme` exposes the following configurable properties:

**Node** (`DiagramThemeNodeConfig`): `defaultColor`, `defaultMetalness`, `defaultRoughness`,
`defaultEmissiveIntensity`, `defaultThickness`, `cornerRadius`, `glowIntensity`,
`defaultLabelColor`, `defaultSublabelColor`, `fontUrl` (optional), `labelSizeFactor`,
`sublabelSizeFactor`, `defaultIconStyle`. — **13 properties**

**Edge** (`DiagramThemeEdgeConfig`): `defaultColor`, `defaultFlowColor` (optional),
`defaultFlowSpeed`, `defaultFlowWidth`, `defaultThickness`, `defaultMetalness`,
`defaultRoughness`, `routing`, `landing`, `smoothness`, `use3DArrows`. — **11 properties**

**Group** (`DiagramThemeGroupConfig`): `defaultColor`, `defaultBorderColor`,
`defaultBorderWidth`, `defaultBorderHeight`, `defaultFillOpacity`, `defaultBorderOpacity`,
`defaultBorderEmissiveColor` (optional), `defaultBorderEmissiveIntensity` (optional). — **6–8 properties**

**Environment** (`DiagramThemeEnvironmentConfig`): `envMapUrl`, `envMapIntensity`,
`skyColor`, `horizonColor`. — **4 properties**

**Layout** (`DiagramThemeLayoutConfig`): Full grid/hierarchical/manual/flow spacing defaults.

### 3.2 What the Theme Cannot Control — Missing Properties

The following properties are hardcoded in renderer or compiler files and cannot be set via `DiagramTheme`:

#### Missing from `DiagramThemeNodeConfig`

| Missing Property | Hardcoded Value | File | Line | Description |
|---|---|---|---|---|
| `iconDepth` | `0.15` | `nodeCompiler.ts` | 37 | Default 3D icon extrusion depth |
| `glowSpread` | `2.2` | `NodeRenderer.ts` | 202, 369 | Glow halo size multiplier relative to node dimensions |
| `sideColorDarkenFactor` | `-0.15` | `nodeCompiler.ts` | 75 | How much darker the node side faces are vs. front face |
| `borderColorLightenFactor` | `0.25` | `nodeCompiler.ts` | 76 | How much lighter the auto-derived border color is vs. front face |
| `labelFontSizeBase` | `0.28` | `NodeRenderer.ts` | 393 | Base coefficient: `contentH * labelFontSizeBase * labelSizeFactor` |
| `sublabelFontSizeBase` | `0.18` | `NodeRenderer.ts` | 394 | Base coefficient: `contentH * sublabelFontSizeBase * sublabelSizeFactor` |

#### Missing from `DiagramThemeGroupConfig`

| Missing Property | Hardcoded Value | File | Line | Description |
|---|---|---|---|---|
| `defaultLabelColor` | `'#ffffff'` | `GroupRenderer.ts` | 245 | Group title label color — always white, never themed |
| `labelSizeFactor` | implicit 1.0 | `GroupRenderer.ts` | 239 | No per-group label size factor (uses `effectiveLabelSizeFactor` from SceneTheme but not group-specific) |
| `borderMetalness` | `0.35` | `GroupRenderer.ts` | 13 | PBR metalness for group border frames |
| `borderRoughness` | `0.45` | `GroupRenderer.ts` | 14 | PBR roughness for group border frames |
| `borderSideDarken` | `0.40` | `GroupRenderer.ts` | 11 | Multiplier for border side-face darkening |
| `borderEdgeDarken` | `0.45` | `GroupRenderer.ts` | 214 | Multiplier for border edge-line wireframe darkening |

#### Missing from `DiagramThemeEdgeConfig`

| Missing Property | Hardcoded Value | File | Line | Description |
|---|---|---|---|---|
| `flowPulseIntensity` | `0.9` | `EdgeRenderer.ts` | 352 | Peak brightness of flow pulse animation |

#### Missing from `DiagramThemeRenderConfig` (the compile-time baked config struct)

`DiagramThemeRenderConfig` in `types.ts:246–285` is the struct baked at compile time and
passed to renderers. It is currently missing:
- `nodeGlowSpread` — only `nodeGlowIntensity` is carried; the spread multiplier is hardcoded
- `nodeIconDepth` — not carried; baked per-node in `DiagramNodeState`

### 3.3 SceneTheme Integration Gaps

`DiagramTheme` accepts an optional `sceneTheme: SceneTheme`. The integration is:
- `sceneTheme.font.webglFontUrl` → `DiagramThemeRenderConfig.fontUrl` (fallback chain only)
- `sceneTheme.fontSize.label` × `theme.node.labelSizeFactor` → `effectiveLabelSizeFactor`
- `sceneTheme.fontSize.caption` × `theme.node.sublabelSizeFactor` → `effectiveSublabelSizeFactor`

**`sceneTheme.accentColor` is never read anywhere in `packages/diagram/src/`.** It is defined
on `SceneTheme` (`core/src/theme/types.ts:155`) as driving "diagram node palette defaults" but
there is no code in the diagram package that reads this field. The `palette` array on
`DiagramTheme` is independent.

**`sceneTheme.colorMode` has no automatic effect on diagram label colors.** The theme types
documentation acknowledges this: "built-in presets all have explicit `defaultLabelColor` values,
so `sceneTheme.colorMode` has NO effect on label colors when using a preset directly." The
`withColorMode()` helper in `mergeTheme.ts` exists to address this, but must be explicitly
called by consumers.

### 3.4 `fontUrl` Placement

`fontUrl` lives on `DiagramThemeNodeConfig` despite applying diagram-wide (to all troika
text, including group labels). The comment in `types.ts:67` acknowledges this:
> "This field is diagram-wide despite its placement on the `node` sub-config. Promotion to
> `DiagramTheme` root level is planned for v2."

This is a known API regret. There is no v2 wait — it is being moved now. The field on
`DiagramThemeNodeConfig` is deleted; `DiagramTheme.fontUrl` becomes the canonical location.

### 3.5 Preset Theme Gaps

All four preset themes (`darkGlass`, `enterprise`, `neonCyber`, `lightMinimal`) omit:
- `fontUrl` — all rely on troika's built-in font
- `borderEmissiveColor` / `borderEmissiveIntensity` — optional fields, left undefined (groups have no emissive borders by default)
- `palette` — `enterprise` and `lightMinimal` have no `palette` field

The `enterprise` theme (`enterprise.ts:36`) also omits `defaultFlowColor`, leaving it to
fall back to the edge `defaultColor` (`#4a7abf`). This is intentional behavior but is
inconsistent with `darkGlass` which sets an explicit `defaultFlowColor` (`#53ec68`).

### 3.6 `withColorMode()` Is Only Half-Wired

`withColorMode()` in `mergeTheme.ts` overrides node label colors (`defaultLabelColor`,
`defaultSublabelColor`) based on `SceneColorMode`. It is the recommended path for light/dark
color mode support. However:

1. `DiagramThemeGroupConfig` has no `defaultLabelColor` field (finding 4.7). Even if a consumer
   calls `withColorMode()`, group title labels remain hardcoded white. The utility does not fix
   group label visibility on light themes — that requires adding `defaultLabelColor` to
   `DiagramThemeGroupConfig` and extending `withColorMode()` to set it.

2. `withColorMode()` must be called explicitly — it is not applied automatically when
   `sceneTheme.colorMode` is set. The preset themes do not call it internally, so color mode
   produces no effect unless consumers know to call it themselves.

### 3.7 `mergeTheme` Missing from `themes/index.ts` Barrel

`mergeTheme` and `withColorMode()` are exported from:
- `src/index.ts` (package root) ✓
- `elements/diagram/index.ts` ✓

But not from `elements/diagram/themes/index.ts`. Consumers importing themes directly from the
themes barrel cannot reach `mergeTheme`. Minor inconsistency — fix the barrel to include both.

---

## 4. Problem 3 — Architecture

### 4.1 Constant Duplication and Sync Requirements

#### GROUP_BORDER_PX_TO_UNITS — 3 independent copies

The conversion factor from "border width in display units" to "canvas-world border width" is
defined independently in three files:
- `compile.ts:32` — `const GROUP_BORDER_PX_TO_UNITS = 0.4;` (with "Keep in sync" comment)
- `groupCompiler.ts:48` — `const GROUP_BORDER_PX_TO_UNITS = 0.4;` (local constant)
- `GroupRenderer.ts:10` — `private static readonly BORDER_PX_TO_UNITS = 0.4;`

The compile.ts comment says "Keep in sync with GroupRenderer border width conversion." The
three values must always be identical or group border sizing will be wrong: the compiler uses
this to compute edge-routing positions around groups, and the renderer uses it to determine
actual group border width in the scene.

#### GROUP_RENDER_Z — 3 independent copies

The Z-coordinate at which group planes are rendered is defined in:
- `compile.ts:34` — `const GROUP_RENDER_Z = -0.6;` (with "Keep in sync" comment)
- `GroupRenderer.ts:148` — `entry.group.position.set(centerX, centerY, -0.6);` (literal)
- `render.ts:138` — `const localGY = 0.5 - ... - localY;` (implicit in the formula at line 138, and the `normalizedPositions.set(groupId, [..., -0.6])` at `compile.ts:241`)

If the Z depth changes, all three must be updated. The literal in `GroupRenderer.ts:148` is
particularly easy to miss.

#### DEFAULT_NODE_SIZE — 2 independent copies

- `nodeCompiler.ts:23` — `size: [4, 2] as [number, number]`
- `layoutAlgorithms.ts:27` — local `const DEFAULT_NODE_SIZE: readonly [number, number] = [4, 2];` declared inside the `resolveFlowLayout` function body, not at module scope

The function-local scope limits the risk to `resolveFlowLayout` specifically, but the values must still be kept in sync. Changing `nodeCompiler.ts` without updating `layoutAlgorithms.ts` would leave `resolveFlowLayout` operating with stale node size defaults.

#### Default group padding — 5 independent copies with a value inconsistency

- `groupConstants.ts:3` — `export const DEFAULT_GROUP_PADDING = 1.5;` (scalar, not imported by any active consumer)
- `layoutResolver.ts:84` — `const DEFAULT_GROUP_PADDING_NORMALIZED = [1.5, 1.5, 1.5, 1.5]` (tuple; name is misleading — these are diagram units, not NVS fractions)
- `layoutResolver.ts:88` — `const DEFAULT_TITLE_GAP = 1;` (title gap canonical value)
- `groupCompiler.ts:162` — `{ x: 0, y: 0, w: 0, h: 0, padding: [1.5, 1.5, 1.5, 1.5] as const, titleGap: 0.75 }` (literal in cycle-detection fallback path)
- `groupCompiler.ts:167` — `{ x: 0, y: 0, w: 0, h: 0, padding: [1.5, 1.5, 1.5, 1.5], titleGap: 0.75 }` (literal in group-not-found fallback path)

**The two `groupCompiler.ts` fallbacks hardcode `titleGap: 0.75`, but `DEFAULT_TITLE_GAP = 1` in
`layoutResolver.ts:88`. This is a value inconsistency, not just a duplication.** Any diagram
with a cycle dependency or a programmatically generated group ID that doesn't resolve will render
with a 25% smaller title gap than every other code path. The discrepancy is silent — no error,
no warning.

### 4.2 Compiler-Renderer Coupling

`compile.ts` imports geometry knowledge that belongs to the renderer layer:
- It references `GROUP_BORDER_PX_TO_UNITS` to compute group entry points for edge routing
  (`compile.ts:32–46`). The compiler needs to know the renderer's border geometry model to
  correctly route edges that terminate at group boundaries.
- It references `GROUP_RENDER_Z` to set group center positions for edge routing
  (`compile.ts:34`, `compile.ts:241`).

This coupling is structurally necessary (the compiler must know where edges physically attach)
but the values should come from a single shared constants module rather than being duplicated.

### 4.3 DiagramRenderer Lazy Sub-Renderer Initialization

`DiagramRenderer.update()` (`render.ts:77–89`) initializes `nodeRenderer`, `edgeRenderer`, and
`groupRenderer` on the first call via null-checks. All three are typed as `RendererType | null`
and are null-checked on every subsequent frame. This is a pattern smell: the renderers have no
reason to be deferred — they should be constructed in `DiagramRenderer`'s constructor.

The current pattern also means the constructor parameters for `EdgeRenderer` (`use3DArrows`,
`edgeSmoothness`, `edgeMetalness`, `edgeRoughness`, `edgeFlowSpeed`, `edgeFlowWidth`) cannot
be updated after the first render tick without disposing the renderer and re-creating it —
which means theme changes that affect edge rendering cannot be applied to an already-live
renderer instance.

### 4.4 Missing Shared Geometry Spec Type

`DiagramNodeState` carries `{shape, size, thickness, cornerRadius}` to fully specify a node's
geometry. `geometryFactory.createShapeGeometry()` accepts the same four parameters but as
loose function arguments. There is no canonical `NodeGeometrySpec` type that:
- acts as a data-only struct for the geometry inputs
- is shared between `DiagramNodeState`, `geometryFactory`, and `NodeRenderer`
- makes the compile→render geometry contract explicit

Instead, the contract is implicit through `DiagramNodeState` and reconstructed from its fields
at each call site.

### 4.5 ROUTING_WEIGHTS is Completely Opaque

`edgeRouter.ts:54–73` defines `ROUTING_WEIGHTS` — a large nested object of penalty weights for
the face-scoring and port-assignment algorithms. These weights determine routing quality
significantly: how aggressively routes avoid obstacles (`obstacleHits: 1_000`), how strongly
alignment is enforced (`alignment: 100`), port edge-repulsion (`edgeRepulsion: 600`).

These weights are:
- Not exported
- Not configurable via `DiagramTheme`
- Not documented beyond inline variable names
- Not tunable per-diagram

Exposing even a subset (e.g., obstacle avoidance weight, port load balance weight) via
`DiagramThemeEdgeConfig` would let authors control routing quality/behavior without touching
the source.

### 4.6 `iconDepth` Not in Theme

The default icon extrusion depth (`0.15`) is in `buildNodeDefaults()` (`nodeCompiler.ts:37`)
but `DiagramThemeNodeConfig` has no `defaultIconDepth` field. Consumers cannot change the
default icon depth via theme — they must set `iconDepth` per-node.

### 4.7 Group Label Color is Hardcoded White

`GroupRenderer.ts:245`:
```typescript
ensureText(entry.label, state.label, '#ffffff', ...);
```
The group title label color is always `'#ffffff'`. There is no `defaultLabelColor` in
`DiagramThemeGroupConfig` and `DiagramGroupState` carries no `labelColor` field. This means
group labels are invisible on light-background themes (`lightMinimalTheme`).

### 4.8 Dead Code to Delete

There is no backward-compatibility requirement. All of the following must be deleted outright —
no `@deprecated` tags, no aliases, no "kept for migration" stubs.

#### `DiagramPivot` type

`types.ts:327–336`. No longer used. Diagrams are positioned via `viewportBounds`. Delete the
type definition and remove the export from `elements/diagram/index.ts`. No callers exist in the
package.

#### `createRoundedBorderGeometry`

`geometryFactory.ts:146–160`. The replacement `createShapeOutlineGeometry` handles all shapes
and is already in use everywhere. Delete `createRoundedBorderGeometry` and its export.

#### `groupConstants.ts`

Contains a single constant (`DEFAULT_GROUP_PADDING = 1.5`) that is not imported by any file
that actually uses it (`layoutResolver.ts` and `groupCompiler.ts` define their own copies).
Delete the file. The value lives on in `layoutResolver.ts` as the canonical definition after
the constant consolidation in action item 3.

### 4.9 Group Edge Light Types Missing from Package Public API

The following types are exported from `elements/diagram/index.ts` but absent from the package
root `src/index.ts`. Consumers importing from `@brewsite/diagram` cannot use any of them for
type annotations:

| Type | `elements/diagram/index.ts` line |
|---|---|
| `DiagramGroupSide` | 16 |
| `DiagramGroupEdgeLightColorResolver` | 35 |
| `DiagramGroupEdgeLightState` | 36 |
| `DiagramGroupEdgeLightsState` | 37 |
| `DiagramGroupEdgeLightsDSL` | 38 |

All five must be added to `src/index.ts` together — adding only `DiagramGroupEdgeLightState`
(as was previously planned) leaves the other four unreachable from the package public API.

### 4.10 `TextRenderer.ts` Is a Two-Line Re-Export

`rendering/TextRenderer.ts` re-exports `ensureText` and `TextWithLayout` from `@brewsite/core`.
This is purely a path aliasing convenience — no logic is added. The only benefit is avoiding a
cross-package import in `NodeRenderer.ts` and `GroupRenderer.ts`. This is acceptable but adds
an indirection layer with no functional purpose.

### 4.11 Thickness / Normalization Asymmetry

At render time in `DiagramRenderer.update()`, the conversion for nodes is:
```typescript
const convertedNode: DiagramNodeState = {
  ...nodeState,
  position: [canvasPos[0] - localX, canvasPos[1] - localY, canvasPos[2]],
  size: canvasSize,
  // thickness stays in canvas world units (unchanged)
};
```
`size` is scaled by `vp.w * aspect` and `vp.h` (canvas scaling). `thickness` is passed
unchanged. The comment calls these "canvas world units" but they are actually still in the
original diagram-unit range. For a diagram with wide spacing (`grid.spacing = [2, 2]`) a
normalized node size might be 0.12 × 0.06 NVS → 0.21 × 0.06 canvas-local (at 16:9 aspect).
With `thickness = 0.28`, the node is 4.7× deeper than it is tall. At `grid.spacing = [1, 1]`
the same node might be 0.42 × 0.12 canvas-local and `thickness = 0.28` is still proportionally
large (2.3× height).

**Root cause**: `thickness` needs a rendering-level normalization step that converts from
"diagram-relative depth" to "canvas-local proportional depth," or it needs to be authored as a
fraction of node height in the theme rather than as an absolute diagram-unit value.

---

## 5. Summary of Action Items

These are concrete gaps identified. This list is the input to the architect's plan.

**Backward compatibility policy**: None. There are no deprecated-but-kept symbols, no
migration aliases, no "breaking change, needs migration path" hedging. Anything being replaced
is deleted. Anything wrong is fixed directly.

### High Priority (correctness — fix now)

1. **Edge routing constant recalibration** (`edgeRouter.ts`, `curveKernel.ts`): Six constants
   are too large for [0..1] NVS space — calibrated for a pre-NVS system where inter-node
   distances were 1–5 units rather than 0.1–0.5. Apply these corrections:
   - `EDGE_EPSILON` (line 26): `0.06 → 0.012`
   - `MIN_PORT_PITCH` (line 27): `0.35 → 0.05`
   - `OBSTACLE_PADDING` (line 30): `0.2 → 0.03`
   - Orthogonal `stub` (line 392): `0.8 → 0.12`
   - Curved `handleMin` (line 319): `0.35 → 0.06`
   - Curved `minSideHandle` (line 330): `0.95 → 0.12` — this is the worst case; it applies
     a second clamp on top of `handleMin` for left/right-face edges in render mode (the default
     for all `routeEdgeCurved` calls), forcing Bézier handles to at least 95% of the NVS range.
     At `0.12` it matches the proposed `handleMin` correction and removes the double-floor.
   These are estimates — the architect must validate against rendered diagrams with 4, 10, and
   20-node layouts and adjust. The `handleMax = 4` can be reduced to `1.5` (still unreachable
   in practice but less confusing).

2. **Group label color** (`GroupRenderer.ts:245`): Delete the hardcoded `'#ffffff'`. Add
   `defaultLabelColor: string` to `DiagramThemeGroupConfig`. Add `labelColor: string` to
   `DiagramGroupState`. Propagate in `compileGroup()` and all four preset theme files.
   Without this fix, `lightMinimalTheme` has invisible group labels.

3. **Sync-required constant deduplication**: Create
   `elements/diagram/compiler/diagramRenderConstants.ts` exporting `GROUP_BORDER_PX_TO_UNITS`
   and `GROUP_RENDER_Z`. Delete the local copies in `compile.ts`, `groupCompiler.ts`, and
   `GroupRenderer.ts`. All three import from the new shared module.

4. **Delete `DiagramPivot` type**: Remove from `types.ts:327–336` and remove its export from
   `elements/diagram/index.ts`. No callers anywhere in the package.

5. **Delete `createRoundedBorderGeometry`**: Remove from `geometryFactory.ts:146–160`. The
   replacement `createShapeOutlineGeometry` handles all shapes and is already used everywhere.

6. **Delete `groupConstants.ts`**: The file's one constant is not imported anywhere useful.
   Delete the file. The canonical value is exported from `diagramLayoutConstants.ts` (created in item 12); `layoutResolver.ts` imports from there.

### Medium Priority (API completeness — fix now, no migration required)

7. **`fontUrl` promotion**: Move `fontUrl` from `DiagramThemeNodeConfig` to `DiagramTheme`
   root level. This was already acknowledged as an API regret ("Promotion to DiagramTheme root
   level is planned for v2") — there is no v2 wait, do it now. Update `themeResolver.ts`,
   all four theme presets, and any consumer call sites. The field on `DiagramThemeNodeConfig`
   is deleted; there is no alias.

8. **Theme: add `defaultIconDepth`** to `DiagramThemeNodeConfig`. Delete the hardcoded `0.15`
   default in `buildNodeDefaults()` (`nodeCompiler.ts:37`). Update all four theme presets with
   an explicit value.

9. **Theme: add group border PBR properties** to `DiagramThemeGroupConfig`:
   - `borderMetalness: number` (currently `0.35` in `GroupRenderer.ts:13`)
   - `borderRoughness: number` (currently `0.45` in `GroupRenderer.ts:14`)
   - `borderSideDarken: number` (currently `0.40` in `GroupRenderer.ts:11`)
   Remove the class constants. Update all four theme presets.

10. **Theme: add `nodeGlowSpread`** to `DiagramThemeNodeConfig`. Delete the hardcoded `2.2`
    in `NodeRenderer.ts:202` and `369`. Propagate through `DiagramThemeRenderConfig` (add
    `nodeGlowSpread` field) and `themeResolver.ts`. Update all four theme presets.

11. **Theme: add `edgeFlowPulseIntensity`** to `DiagramThemeEdgeConfig`. Delete the hardcoded
    `0.9` in `EdgeRenderer.ts:352`. Propagate through `DiagramThemeRenderConfig` and
    `themeResolver.ts`. Update all four theme presets.

12. **Shared diagram constants module**: Consolidate the group padding duplication into a single
    source of truth. Create `elements/diagram/compiler/diagramLayoutConstants.ts` exporting:
    - `DEFAULT_NODE_SIZE: readonly [number, number] = [4, 2]`
    - `DEFAULT_GROUP_PADDING: readonly [number, number, number, number] = [1.5, 1.5, 1.5, 1.5]`
    - `DEFAULT_TITLE_GAP: number = 1`
    Delete `compiler/groupConstants.ts`. Update `layoutAlgorithms.ts:27` (currently function-local
    const inside `resolveFlowLayout`) to import from this module. Update `layoutResolver.ts:84`
    and `groupCompiler.ts:162,167` to import instead of duplicating literals. Fix both
    `groupCompiler.ts` fallbacks to use `titleGap: DEFAULT_TITLE_GAP` (value `1`), removing
    the silent inconsistency with `titleGap: 0.75` in the cycle-detection and group-not-found paths.

### Low Priority (cleanup and public API fixes)

13. **`DiagramRenderer` lazy initialization**: Change `nodeRenderer`, `edgeRenderer`,
    `groupRenderer` from `Type | null` to fully initialized in the constructor. The `EdgeRenderer`
    constructor args (`use3DArrows`, etc.) must come from a constructor argument or a default
    config passed at construction time, not from the first `update()` call's `themeConfig`.

14. **Export group edge light types from package root** `src/index.ts`. All five are already
    exported from `elements/diagram/index.ts` but absent from the package root — consumers
    cannot use any of them for type annotations when importing from `@brewsite/diagram`. Add:
    `DiagramGroupSide`, `DiagramGroupEdgeLightColorResolver`, `DiagramGroupEdgeLightState`,
    `DiagramGroupEdgeLightsState`, `DiagramGroupEdgeLightsDSL`.

15. **`sceneTheme.accentColor`**: The field is defined in `SceneTheme` as "drives diagram node
    palette defaults" but `@brewsite/diagram` never reads it. Either implement it (use as
    `palette[0]` default when `DiagramTheme.palette` is absent) or remove the field from
    `SceneTheme` in `@brewsite/core`. Do not leave it as a documented-but-ignored contract.

16. **`TextRenderer.ts` indirection**: This is a judgment call for the architect. The two-line
    re-export file (`rendering/TextRenderer.ts`) adds a path-aliasing layer with no logic.
    Consider removing it and having `NodeRenderer.ts` and `GroupRenderer.ts` import directly
    from `@brewsite/core`.
