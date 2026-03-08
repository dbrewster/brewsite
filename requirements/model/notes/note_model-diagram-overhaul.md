---
title: "Model/Diagram Overhaul: Sizing, Theming, and Architecture"
doc_type: note
owner: pm-1
status: draft
updated: 2026-03-08
---

# Model/Diagram Overhaul: Sizing, Theming, and Architecture

## 1. Problem Statement

Three interlocking issues degrade the quality of the diagram and model elements as the toolkit matures. **No backward compatibility is required for any change in this overhaul. All deprecated code must be removed. There are no deprecation shims, migration wrappers, or legacy fallback paths.**

**Sizing calibration:** The engine world coordinate system was normalized to `0..1` NVS space. The diagram element uses a dual coordinate system — AutoLayout uses diagram units (Cartesian, renormalized to `[0..1]` NVS after layout), while ManualLayout requires direct `[0..1]` NVS fractions. The DSL `dsl.tsx` documents both cases correctly at lines 80-82. However, the JSDoc `Default` example for the `size` prop documents `[0.12, 0.10]` (a ManualLayout-appropriate NVS value) while the actual code default in `nodeCompiler.ts` is `[4, 2]` (diagram units for AutoLayout). This mismatch will mislead consumers about which coordinate space they are in. Additionally, several default values (`iconScale`, `iconDepth`) are hardcoded rather than theme-sourced, and the same constant is duplicated across files with "keep in sync" comments.

**Theme system completeness:** The diagram theme system (`DiagramTheme`) covers most visual properties for nodes, edges, and groups. However, a significant set of rendering constants — border materials, rendering Z depths, glow spread, icon extrusion ratios, edge tube quality, and organic routing variation — are hardcoded in rendering classes and cannot be expressed by any theme. These are LAF decisions that theme authors should own.

**Architecture cleanliness:** Several violations of the module pattern, unnecessary constant duplication, and boundary ambiguities exist between `compile.ts`, `render.ts`, and the rendering sub-classes. These cause subtle maintenance hazards and limit testability.

---

## 2. Research Findings

### 2.1 Sizing Calibration Findings

#### 2.1.1 Wrong JSDoc Default for `size` Prop (CONCRETE BUG)

**File:** `packages/diagram/src/elements/diagram/dsl.tsx`, line 78

```ts
/**
 * Node width and height as viewport fractions [w, h].
 * ...
 * Default: [0.12, 0.10] (approximately a 2:1 node at 16:9 aspect).
 *
 * Note: when using auto-layout (GridLayout, HierarchicalLayout), size is still
 * in layout units — the layout algorithm normalizes them to [0..1] at compile time.
 * Only for ManualLayout should you author sizes in [0..1] NVS fractions directly.
 */
size?: [number, number];
```

The dual-coordinate documentation at lines 80-82 is correct and complete. The bug is the `Default: [0.12, 0.10]` example on line 78. That is a ManualLayout-space NVS value. The actual code default in `nodeCompiler.ts:23` is `[4, 2]` — a diagram-unit AutoLayout value. A consumer reading this JSDoc will have the wrong mental model of which space they are in AND what the fallback size actually is.

**Fix required:** Update the JSDoc default to `[4, 2]` with a clarification that this is a diagram-unit value applying only for AutoLayout. ManualLayout consumers must always provide explicit sizes.

#### 2.1.2 Default Node Size — Duplicated Constant (Three Locations)

**Files:**
- `packages/diagram/src/elements/diagram/compiler/nodeCompiler.ts`, line 23: `size: [4, 2] as [number, number]`
- `packages/diagram/src/elements/diagram/compiler/layoutAlgorithms.ts`, line 27: `const DEFAULT_NODE_SIZE: readonly [number, number] = [4, 2]` (flow layout)
- `packages/diagram/src/elements/diagram/compiler/layoutAlgorithms.ts`, ~line 160: same constant in grid layout fallback

Three independent definitions of `[4, 2]`. Any change to the default node size requires updating all three. No enforcement.

#### 2.1.3 Hardcoded Group Z Placement — Three Occurrences, Two with Sync Comment

**Files:**
- `packages/diagram/src/elements/diagram/compile.ts`, line 34: `const GROUP_RENDER_Z = -0.6` (named constant, correct)
- `packages/diagram/src/elements/diagram/compile.ts`, line 241: `positions.set(groupId, [centerX, centerY, GROUP_RENDER_Z])` — uses the named constant correctly
- `packages/diagram/src/elements/diagram/compile.ts`, line 301: `normalizedPositions.set(groupId, [..., normBounds.y + normBounds.h / 2, -0.6])` — **inline literal, separate from the named constant**
- `packages/diagram/src/elements/diagram/rendering/GroupRenderer.ts`, line 148: `entry.group.position.set(centerX, centerY, -0.6)` — **inline literal in the renderer**

The named constant in `compile.ts` is used correctly at line 241. The problem is the two additional inline `-0.6` literals: one in `compile.ts:301` (a separate code path for ManualLayout group position post-pass) and one in `GroupRenderer.ts:148`. These three occurrences must remain equal but have no enforcement.

#### 2.1.4 Group Border Width Conversion — Duplicated Constant with Sync Comment

**Files:**
- `packages/diagram/src/elements/diagram/compile.ts`, line 32: `const GROUP_BORDER_PX_TO_UNITS = 0.4`
- `packages/diagram/src/elements/diagram/rendering/GroupRenderer.ts`, line 10: `private static readonly BORDER_PX_TO_UNITS = 0.4`

The comment in `compile.ts` says "Keep in sync with GroupRenderer border width conversion." This is an acknowledged sync hazard with no type-level enforcement.

#### 2.1.5 Node Defaults Not Theme-Sourced

**File:** `packages/diagram/src/elements/diagram/compiler/nodeCompiler.ts`, lines 35 and 37

```ts
iconScale: 0.6,
iconDepth: 0.15,
```

`iconScale` (60% of node size) and `iconDepth` (0.15 diagram units) are hardcoded defaults not sourced from the theme. All other defaults in `buildNodeDefaults` come from the theme. This inconsistency means theme authors cannot control icon rendering defaults.

Additionally, `iconDepth: 0.15` carries the same dual-coordinate ambiguity as node size. For AutoLayout diagrams it is interpreted as 0.15 diagram units (reasonable). For ManualLayout diagrams where nodes are sized in `[0..1]` NVS — e.g., `size: [0.2, 0.1]` — a literal `iconDepth` of 0.15 would be larger than the node itself. The value must be made coordinate-system-invariant.

#### 2.1.6 Model Package — What Was Verified

Research verified the following in `packages/model/src/`:

- **`SceneModel.nvsX`, `SceneModel.nvsY`** (`types.ts:206-214`): Explicitly documented as NVS `[0..1]`. `0 = left/top, 1 = right/bottom`. Correct.
- **`SceneModel.scale`** (`types.ts:200`): Dimensionless scalar applied to 3D model geometry. Not a world-coordinate value. Correct.
- **`SceneModel.z`** (`types.ts:215`): "World-space Z depth." This is depth in scene coordinates, distinct from the NVS plane. The compile.ts default state factory (`createDefaultModelInstanceState`) does not hardcode a Z value — it clones the `identity` state. No sizing calibration issue found in the compile layer.
- **`SceneModelInstanceState.nvsBounds`** (`types.ts:240`): Fullscreen default is `{x:0,y:0,w:1,h:1}` (line 653 of compile.ts) — correct for normalized space.
- **`LabelDefinition.labelOffset`** (`labels/types.ts:39`): Type is `[number, number, number]`. The units of this offset are not documented anywhere in the label type definitions. Whether these are world units, NVS units, or pixel offsets is unclear from type inspection alone.

**Not verified:** The model renderer's 3D positioning math (`ModelRenderer.ts`) was not fully audited. The compile layer appears clean; the render layer uses `applyModelTransform` from `render.ts` but the internal world-space math was not traced. See Open Question 4.

---

### 2.2 Theme System Completeness Findings

The current `DiagramTheme` type covers:
- Node: color, metalness, roughness, emissiveIntensity, thickness, cornerRadius, glowIntensity, label/sublabel colors, labelSizeFactor, sublabelSizeFactor, iconStyle
- Edge: color, flowColor, flowSpeed, flowWidth, thickness, metalness, roughness, routing, landing, smoothness, use3DArrows
- Group: color, borderColor, borderWidth, borderHeight, fillOpacity, borderOpacity, borderEmissiveColor, borderEmissiveIntensity
- Environment: envMapUrl, envMapIntensity, skyColor, horizonColor
- Layout: defaultKind, grid/hierarchical/manual sub-configs
- Palette: readonly string array

#### 2.2.1 NOT in Theme: Group Border Material Properties

**File:** `packages/diagram/src/elements/diagram/rendering/GroupRenderer.ts`, lines 10–13

```ts
private static readonly BORDER_SIDE_DARKEN = 0.4;
private static readonly BORDER_METALNESS = 0.35;
private static readonly BORDER_ROUGHNESS = 0.45;
```

- `BORDER_METALNESS` (0.35) and `BORDER_ROUGHNESS` (0.45): The PBR properties of the group border frame are hardcoded. `lightMinimal` has node metalness of 0.08; the group border's 0.35 metalness is visually inconsistent with that theme's matte intent.
- `BORDER_SIDE_DARKEN` (0.4): Darkening scalar on side faces. For light themes, 40% darkening may be far too aggressive.
- `0.45` scalar at lines 214 and 337: `new THREE.Color(state.borderColor).multiplyScalar(0.45)` — hardcoded darkening for the wireframe edge lines of the border. Same problem.

#### 2.2.2 NOT in Theme: Icon Scale and Icon Depth Defaults

**File:** `packages/diagram/src/elements/diagram/compiler/nodeCompiler.ts`, lines 35 and 37

`iconScale: 0.6` and `iconDepth: 0.15` are not sourced from theme. Covered in 2.1.5.

#### 2.2.3 NOT in Theme: Icon 3D Extrusion Ratios

**File:** `packages/diagram/src/elements/diagram/shapes/svgIcon3D.ts`, lines 80–145 (approx)

Depth multipliers for each icon style are hardcoded:
- `extruded`: `depth: maxDepth * 0.65`, `bevelThickness: maxDepth * 0.06`, `bevelSize: maxDepth * 0.04`, `bevelSegments: 3`
- `layered`: path 0 depth `maxDepth * 0.50`, per-path depth `max(0.22, 0.38 - pathIndex * 0.05)`, `zBase: pathIndex * maxDepth * 0.36`
- `embossed`: `depth: maxDepth * 0.35`

None overridable via theme. A high-contrast or thick-geometry theme has no override path.

#### 2.2.4 NOT in Theme: Node Label Size Ratios

**File:** `packages/diagram/src/elements/diagram/rendering/NodeRenderer.ts`, lines 393–397

```ts
const labelFontSize = contentH * 0.28 * (themeConfig.effectiveLabelSizeFactor ?? 1.0);
const sublabelFontSize = contentH * 0.18 * (themeConfig.effectiveSublabelSizeFactor ?? 1.0);
const labelLine = labelFontSize * 1.1;
const sublabelLine = sublabelFontSize * 1.1;
const lineGap = contentH * 0.06;
```

The base ratios (0.28, 0.18, 1.1, 0.06) are hardcoded. `effectiveLabelSizeFactor` and `effectiveSublabelSizeFactor` are theme-controlled multipliers that scale these bases. The `2.2` glow sprite spread multiplier (lines 202, 370, 378) controls how much larger the glow is than the node bounding box — `glowIntensity` controls brightness only.

#### 2.2.5 NOT in Theme: Group Label Size and Inset

**File:** `packages/diagram/src/elements/diagram/rendering/GroupRenderer.ts`, lines 235–240

```ts
const labelFontSize = Math.max(
  0.35,
  Math.min(state.bounds.h * 0.08, availableHalfBand * 1.6),
) * (themeConfig?.effectiveLabelSizeFactor ?? 1.0);
const labelInsetX = 0.7;
```

- `0.08` (group height fraction for font size), `0.35` (minimum font size floor), `1.6` (band multiplier), `labelInsetX = 0.7` (horizontal inset) — none theme-configurable.

#### 2.2.6 NOT in Theme: Edge Tube Radial Segments

**File:** `packages/diagram/src/elements/diagram/rendering/EdgeRenderer.ts`, line 92

```ts
new THREE.TubeGeometry(curve, segments, edge.thickness, 8, false)
```

`radialSegments = 8` gives octagonal tube cross-sections. For thick edges this reads visually coarse. Not theme-configurable.

#### 2.2.7 NOT in Theme: Edge Segment Count Base Values

**File:** `packages/diagram/src/elements/diagram/rendering/EdgeRenderer.ts`, lines 84–87

```ts
const segments = Math.max(
  20,
  Math.round((points.length === 4 ? 40 : edge.controlPoints.length * 8) * this.edgeSmoothness),
);
```

Base values (20 minimum, 40 for Bezier, 8× per control point) are hardcoded. `edgeSmoothness` multiplies but cannot change the base.

#### 2.2.8 NOT in Theme: Organic Routing Variation Magnitude

**File:** `packages/diagram/src/elements/diagram/compiler/edgeRouter.ts`, line 358

```ts
const offset = ((seed % 1000) / 1000 - 0.5) * 1.6;
```

The `1.6` scalar controls how much perpendicular variation `organic` routing adds. No theme property controls this.

#### 2.2.9 NOT in Theme: Node Side-Face Emissive Multipliers

**File:** `packages/diagram/src/elements/diagram/rendering/NodeRenderer.ts`, lines 52–54

```ts
top.emissive = new THREE.Color(state.sideColor).multiplyScalar(0.05);
bottom.emissive = new THREE.Color(state.sideColor).multiplyScalar(0.02);
```

Faint emissive tints on top/bottom faces of the full 6-material BoxGeometry path — not theme-configurable.

---

### 2.3 Architecture Cleanliness Findings

#### 2.3.1 Constant Duplication Across Module Boundaries

| Constant | Location | Value | Problem |
|---|---|---|---|
| `GROUP_RENDER_Z` | `compile.ts:34` (named) | `-0.6` | Canonical definition |
| `GROUP_RENDER_Z` | `compile.ts:301` (inline) | `-0.6` | Separate literal, not using named constant |
| `GROUP_RENDER_Z` | `GroupRenderer.ts:148` (inline) | `-0.6` | Separate literal, different file |
| `GROUP_BORDER_PX_TO_UNITS` | `compile.ts:32` (named) | `0.4` | Canonical definition |
| `GROUP_BORDER_PX_TO_UNITS` | `GroupRenderer.ts:10` (named) | `0.4` | Duplicate definition, different file |

The comment on `compile.ts:31` ("Keep in sync with GroupRenderer border width conversion") explicitly acknowledges the hazard.

#### 2.3.2 Module Pattern — `compile.ts` Owns Rendering-Layer Constants

`compile.ts` is a pure transformation pipeline with no Three.js, no React. Yet it defines `GROUP_RENDER_Z = -0.6` and `GROUP_BORDER_PX_TO_UNITS = 0.4` — constants that are fundamentally about the rendering layer's 3D stacking decisions. A pure compiler should not own these. They belong either in `GroupRenderer.ts` or in a shared `renderConstants.ts` module that only the rendering layer imports.

#### 2.3.3 `TextRenderer.ts` Is a Hollow Re-export

**File:** `packages/diagram/src/elements/diagram/rendering/TextRenderer.ts`

```ts
export { ensureText } from '@brewsite/core';
export type { TextWithLayout } from '@brewsite/core';
```

Three lines. Zero diagram-specific logic. Creates a false impression of local ownership. Should be deleted; callers import directly from `@brewsite/core`.

#### 2.3.4 `buildNodeDefaults` Inconsistently Mixes Theme and Hardcoded Values

**File:** `packages/diagram/src/elements/diagram/compiler/nodeCompiler.ts`, lines 18–38

```ts
export const buildNodeDefaults = (theme: DiagramTheme) => ({
  shape:                DEFAULT_NODE_SHAPE,
  size:                 [4, 2] as [number, number],     // hardcoded
  thickness:            theme.node.defaultThickness,    // theme
  color:                theme.node.defaultColor,        // theme
  ...
  iconScale:            0.6,                            // hardcoded
  iconStyle:            theme.node.defaultIconStyle,    // theme
  iconDepth:            0.15,                           // hardcoded
});
```

`size`, `iconScale`, and `iconDepth` are hardcoded while all other defaults are theme-sourced. The pattern communicates that all defaults should come from the theme — but three break the pattern without comment.

#### 2.3.5 `routeEdgeCurvedProfile` — 12+ Undocumented Magic Constants

**File:** `packages/diagram/src/elements/diagram/compiler/edgeRouter.ts`, lines 316–331

```ts
return routeCurvedWithEndpointNormals(srcCenter, dstCenter, srcNormal, dstNormal, {
  epsilon: EDGE_EPSILON,
  handleMin: 0.35,
  handleMax: 4,
  handleFactor: 0.28,
  allowDirectSegment: !srcIsSide && !dstIsSide,
  directDistanceThreshold: 0.6,
  directAlignmentThreshold: 0.97,
  startPreferSide: renderProfile && srcIsSide,
  endPreferSide: renderProfile && dstIsSide,
  sideVerticalRatioThreshold: 0.3,
  sideVerticalBase: 0.45,
  sideVerticalFactor: 0.18,
  sideVerticalMax: 3.2,
  minSideHandle: renderProfile ? 0.95 : 0,
});
```

All inlined as literals with no documentation. These represent accumulated visual tuning. Any change requires understanding the interdependencies of all 12+ parameters simultaneously.

#### 2.3.6 `routeEdgeOrthogonal` — Inlined, Undocumented, Coupled Constants

**File:** `packages/diagram/src/elements/diagram/compiler/edgeRouter.ts`, lines 392–393

```ts
const stub = 0.8;
const ce = 0.12;
```

`stub` = distance the edge extends perpendicular from the node face before turning. `ce` = corner epsilon for 90° turn geometry. These two are tightly coupled — `stub` controls when a corner occurs and `ce` controls the rounding of that corner. They cannot be changed independently without producing inconsistent geometry.

---

## 3. Proposed Solutions

### 3.1 Sizing Calibration

#### 3.1.1 Fix JSDoc Default for `size`

**File:** `packages/diagram/src/elements/diagram/dsl.tsx`, line 78

Change `Default: [0.12, 0.10]` to `Default: [4, 2] (diagram units for auto-layouts; ManualLayout consumers must always specify an explicit NVS size)`. The dual-coordinate documentation at lines 80-82 stays unchanged.

Add a runtime warning in `compile.ts` when a ManualLayout diagram contains a node with either size dimension > 1.5 — this is almost certainly an auto-layout value authored by mistake. Threshold of 1.5 gives headroom for legitimate large-node ManualLayout scenes while catching the `[4, 2]` mistake.

#### 3.1.2 Consolidate `DEFAULT_NODE_SIZE` to One Location

Extract to a named constant in `packages/diagram/src/elements/diagram/compiler/nodeCompiler.ts`. Import it in `layoutAlgorithms.ts`. Remove all local `DEFAULT_NODE_SIZE` definitions in `layoutAlgorithms.ts`.

Move the constant to theme: `DiagramThemeNodeConfig` gains `defaultSize: [number, number]` (required, no optional — the theme must declare a default). AutoLayout reads `theme.node.defaultSize`. ManualLayout consumers are unaffected.

#### 3.1.3 Consolidate Group Z and Border Constants

**Fix:** Create `packages/diagram/src/elements/diagram/rendering/renderConstants.ts` as the single source:

```ts
/** Z depth at which group planes render, behind nodes at z=0. */
export const GROUP_RENDER_Z = -0.6;
/** Converts theme borderWidth (pixel-like) to diagram units for extrusion geometry. */
export const GROUP_BORDER_PX_TO_UNITS = 0.4;
```

Remove both constants from `compile.ts`. `compile.ts` imports from `renderConstants.ts` for the values it needs during the group position/size computation. `GroupRenderer.ts` imports from `renderConstants.ts` for the rendering layer. This resolves the sync hazard without exposing these as theme properties (see Decision A).

Fix the inline `-0.6` literal in `compile.ts:301` to use `GROUP_RENDER_Z` from `renderConstants.ts`.

Fix the inline `-0.6` literal in `GroupRenderer.ts:148` to use `GROUP_RENDER_Z` from `renderConstants.ts`.

#### 3.1.4 Add `defaultIconScale` and `defaultIconDepth` to Theme

Add to `DiagramThemeNodeConfig`:
```ts
defaultIconScale: number;   // default 0.6 in darkGlassTheme, enterprise, etc.
defaultIconDepth: number;   // default 0.15 (in diagram units for AutoLayout)
```

These are required properties in the new theme. All four preset themes must be updated. `buildNodeDefaults` sources both from `theme.node`.

Separately, fix the coordinate-system ambiguity of `iconDepth` per Decision F.

---

### 3.2 Theme System Completeness

#### 3.2.1 Add Group Border Material Properties to Theme

Add to `DiagramThemeGroupConfig`:
```ts
borderMetalness: number;       // darkGlass: 0.35
borderRoughness: number;       // darkGlass: 0.45
borderSideDarken: number;      // darkGlass: 0.4 (scalar on side face color)
borderEdgeLineDarken: number;  // darkGlass: 0.45 (scalar on border wireframe edges)
```

Required properties — all four preset themes must set values. `GroupRenderer.ts` reads from `DiagramThemeRenderConfig` (add to `buildThemeRenderConfig` output).

**lightMinimal implication:** `borderMetalness` and `borderRoughness` should match the node material intent. `lightMinimal` should set `borderMetalness: 0.08, borderRoughness: 0.60` to be consistent with its node materials.

#### 3.2.2 Add Glow Spread to Theme

Add to `DiagramThemeNodeConfig`:
```ts
glowSpread: number;   // darkGlass: 2.2 (glow sprite size as multiple of node bounding box)
```

Required. `NodeRenderer.ts` uses `themeConfig.nodeGlowSpread` instead of the hardcoded `2.2`.

#### 3.2.3 Add Edge Tube Quality to Theme

Add to `DiagramThemeEdgeConfig`:
```ts
tubeRadialSegments: number;   // darkGlass: 8 (cross-section polygon sides; higher = smoother)
```

Required. `EdgeRenderer.ts` constructor receives this value via the theme compile path.

#### 3.2.4 Add `organic` Routing Variation to Theme

Add to `DiagramThemeEdgeConfig`:
```ts
organicVariation: number;   // darkGlass: 1.6 (perpendicular offset magnitude)
```

Required. `edgeRouter.ts` reads from the theme config passed to `compileDiagram`.

#### 3.2.5 Label Size Ratios — Keep as Documented Constants

The hardcoded node label ratios (0.28, 0.18, 0.06) in `NodeRenderer.ts` are not candidates for theme exposure. The existing `effectiveLabelSizeFactor` and `effectiveSublabelSizeFactor` already provide scaling control. The base ratios are an internal layout algorithm, and exposing them creates a foot-gun (changing 0.28 to 0.40 overflows labels). Add documenting comments to the constants and defer theme exposure unless a concrete consumer requirement emerges.

---

### 3.3 Architecture Cleanliness

#### 3.3.1 Delete `TextRenderer.ts`

Delete `packages/diagram/src/elements/diagram/rendering/TextRenderer.ts`. Update all imports in `NodeRenderer.ts` and `GroupRenderer.ts` to import `ensureText` and `TextWithLayout` directly from `@brewsite/core`. No aliasing, no phased removal.

#### 3.3.2 Document Curve Tuning Constants

Add inline documentation to `routeEdgeCurvedProfile` explaining each of the 12 tuning parameters: what visual property it controls, which direction increases/decreases the effect, and known interaction effects with adjacent parameters. Same for `stub` and `ce` in `routeEdgeOrthogonal` — document why they are coupled and what breaks if only one changes.

These constants are NOT candidates for theme exposure (see Decision C).

#### 3.3.3 `LabelStyle.fontSize` — Documentation Only

**`fontSize?: number | string` is correct and should not be narrowed.**

`LabelItem.tsx:27` assigns `label.style?.fontSize ?? 12` directly to a `CSSProperties` object. React's `CSSProperties.fontSize` is intentionally `number | string`: numeric values are rendered as `px` by React's CSS-in-JS handling, and string values like `"1.2rem"` or `"150%"` are valid CSS passed through as-is. Narrowing to `number` would remove valid functionality.

The only gap is documentation. Add a JSDoc comment to `LabelStyle.fontSize` in `labels/types.ts`:

```ts
/**
 * Label font size.
 * - `number`: interpreted as pixels (e.g., `14` → `14px`).
 * - `string`: any valid CSS font-size value (e.g., `"1.2rem"`, `"150%"`).
 * Default: `12` (px).
 */
fontSize?: number | string;
```

#### 3.3.4 Consolidate `DEFAULT_NODE_SIZE`

Covered by 3.1.2 — single location in `nodeCompiler.ts`, imported in `layoutAlgorithms.ts`.

---

## 4. Key Design Decisions

### Decision A: `GROUP_RENDER_Z` — `renderConstants.ts`, Not Theme

**Recommendation: `renderConstants.ts` only. Do not expose in `DiagramTheme`.**

`GROUP_RENDER_Z` is a 3D rendering implementation detail — it controls which Z slice the group fill plane occupies relative to nodes (which are at z ≈ 0). This is not a design property. A scene author should not need to know what Z value keeps groups behind nodes. Theme properties describe visual design intent; group Z stacking is an engine invariant.

Exposing it as `theme.group.renderZ` creates a footgun: consumers who set `renderZ = 0` get groups occluding nodes with no diagnostic. The sync hazard is resolved purely by engineering — single source in `renderConstants.ts`, imported by both layers.

`GROUP_BORDER_PX_TO_UNITS` follows the same reasoning: it is a unit-conversion factor for border geometry, not a design choice. Also goes in `renderConstants.ts` only.

### Decision B: Default Node Size Must Be Theme-Required

**Recommendation: `theme.node.defaultSize: [number, number]` — required, not optional.**

With no backward compatibility required, theme properties should be correct, not backward-compatible. All four preset themes set an explicit default size. The auto-layout default is the only use case (ManualLayout scenes always provide explicit sizes). Removing the triple-duplicate constant and routing through the theme eliminates the sync hazard and gives theme authors control over their diagram's default node proportions.

### Decision C: Theme-Exposure Principle for Rendering Constants

**Principle:** A rendering constant deserves theme exposure when ALL FOUR conditions hold:
1. **Single named design intent** — a theme author thinks about it as one independent design property
2. **Isolated effect** — changing it does not require co-adjusting other constants to maintain visual coherence
3. **Theme differentiation** — different themes would plausibly want different values
4. **Safe value range** — the renderer behaves predictably and visibly across its range (no hidden cliffs)

Applied:

| Constant | (1) | (2) | (3) | (4) | Expose? |
|---|---|---|---|---|---|
| `organicVariation` (1.6) | ✓ "how wiggly" | ✓ linear scalar | ✓ neonCyber high, enterprise low | ✓ 0=none, 3=extreme | **Yes** |
| `stub` (0.8) | ✓ "stub length before turn" | ✗ coupled to `ce` | ✓ | ✓ | **No** |
| `ce` (0.12) | ✗ algorithm geometry term | ✗ coupled to `stub` | ✗ | ✗ | **No** |
| 12 curve params | ✗ interdependent tuning system | ✗ | ✗ | ✗ | **No** |
| `ROUTING_WEIGHTS` (14 values) | ✗ | ✗ | ✗ | ✗ | **No** |

`stub` and `ce` fail condition (2): changing `stub` without adjusting `ce` produces geometry where the corner rounding is proportionally wrong. They are a tightly coupled pair that must move together, making independent theme exposure unsafe.

The non-exposed constants must receive documenting comments (section 3.3.2) so future engineers understand what not to change naively.

### Decision D: Label Size Ratios — Not for Theme

**Recommendation: No for this phase.** `effectiveLabelSizeFactor` and `effectiveSublabelSizeFactor` already provide theme-controlled scaling. The 0.28/0.18 base ratios are internal layout algorithm tuning. Setting 0.28 → 0.40 makes labels overflow their nodes. Documenting comments, not theme exposure.

### Decision E: Delete `TextRenderer.ts` — Unconditional

**Recommendation: Delete.** No phased removal, no aliasing. It is three lines of re-exports. Import directly from `@brewsite/core`.

### Decision F: `iconDepth` Coordinate Ambiguity — Migrate to `iconDepthFactor`

**Problem:** `iconDepth: 0.15` is in diagram units for AutoLayout. For ManualLayout nodes authored in `[0..1]` NVS, a 0.15 depth can exceed node height entirely.

**Recommendation:** Replace `iconDepth` with `iconDepthFactor: number` — a fraction of node thickness (e.g., `0.5` = 50% of `node.thickness`). This is coordinate-system-invariant.

**Migration requirement (no compat — scenes must update):** This is a semantic rename that changes the value space. Any authored scene that sets an explicit `iconDepth` on a `<DiagramNode>` must be migrated to set `iconDepthFactor` instead. The architect's implementation plan must include:
- The conversion formula from old `iconDepth` to new `iconDepthFactor` given a typical `node.thickness`
- A TypeScript error for any consumer still using `iconDepth` (remove the old prop from `DiagramNodeProps` and `DiagramNodeState`)
- A search of `apps/examples/` for explicit `iconDepth` usage to audit what needs updating

The DSL default (`theme.node.defaultIconDepth` → now `theme.node.defaultIconDepthFactor`) should be `0.5` for typical node thickness values.

---

## 5. Open Questions

1. **ManualLayout nodes with size > 1.5:** Does any scene in `apps/examples/` or any known consumer scene use ManualLayout with node sizes larger than 1.5? The proposed runtime warning at that threshold needs to be safe.

2. **What is the visual intent of `GROUP_RENDER_Z = -0.6`?** Is the guarantee "behind nodes at z=0" or "behind any node at any z"? Nodes can have non-zero `position[2]`. If a scene author places nodes at z=-0.5, groups at z=-0.6 would render *in front* of them. The value should be documented with its assumptions.

3. **`LabelDefinition.labelOffset` units:** The type is `[number, number, number]` with no unit documentation. Are these world-space units, NVS fractions, or screen pixels? The label positioning system in `LabelPositioner.ts` must be audited to determine the actual unit and then the type should be documented.

4. **Model renderer `SceneModel.z` calibration:** The compile layer for models is clean. The rendering layer (`ModelRenderer.ts`) applies `applyModelTransform` from `render.ts`. Whether world-space Z positioning of models is correctly calibrated to the current `[0..1]` NVS scene coordinate system was not verified. An explicit audit is needed before claiming the model package is fully calibrated.

5. **What is the Three.js version pinned by `@brewsite/core`?** Changes to `tubeRadialSegments` need to confirm the `TubeGeometry` constructor signature is stable at that version.

6. **Is `TextRenderer.ts` re-exported from any public package index?** Check `packages/diagram/src/index.ts`. If it is, the export must be removed (not aliased — the no-compat constraint applies).

7. **`lightMinimal` group border intent:** With `borderMetalness` and `borderRoughness` becoming theme-required, what should `lightMinimal` specify for these? The recommendation is to match node material intent (0.08/0.60), but this needs design confirmation — the current 0.35 may have been intentional for visual pop on a light background.

---

## 6. Constraints

The implementation must not violate these constraints. Note: **no backward compatibility is required**. No deprecated code, no shims, no migration wrappers, no legacy fallback paths.

1. **All existing tests pass or are updated.** The compiler is heavily tested via `__tests__/compile.test.ts`, `normalizeToViewport.test.ts`, `edgeRouter.test.ts`, and others. Tests that test old behavior must be updated to test new behavior — not preserved alongside new tests.

2. **All four preset themes must be updated.** `darkGlass`, `enterprise`, `neonCyber`, `lightMinimal` — all must be updated to include every new required theme property. No optional defaults that silently fall through to old behavior.

3. **`compile.ts` must remain pure.** No Three.js imports, no React imports. Importing `renderConstants.ts` (which is pure TypeScript constants with no runtime dependencies) is acceptable.

4. **`@brewsite/diagram` must not import from packages other than `@brewsite/core`.** No new peer dependencies unless explicitly justified.

5. **All diagram scenes in `apps/examples/` must be visually audited after landing.** Run the dev app and verify all diagram scenes after any sizing or theme changes.

6. **All deprecated code is removed, not deprecated.** The old `iconDepth` prop on `DiagramNodeProps` and `DiagramNodeState` must be deleted. The old `TextRenderer.ts` file must be deleted. Any deprecated shape variants (e.g., `flow:*` legacy names in `shapeVariants.ts`) must be removed. No `@deprecated` JSDoc on still-present code.

7. **Scene authors must explicitly migrate.** The `iconDepthFactor` rename and any other semantic-change to authored DSL props requires TypeScript compile errors at old call sites (property removed, not deprecated). There is no silent fallback.
