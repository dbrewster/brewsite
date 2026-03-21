---
title: "Scene Unit System — CSS-Inspired Spatial Units for BrewSite"
doc_type: plan
owner: architect
status: complete
updated: 2026-03-21
---

# Scene Unit System

## Problem

All spatial values in BrewSite are bare `number` types interpreted as NVS fractions (0..1). This causes:

1. **Aspect ratio distortion**: `size={[0.15, 0.15]}` produces a rectangle on non-square viewports because `0.15 * viewportWidth ≠ 0.15 * viewportHeight`.
2. **No way to express intent**: Authors cannot distinguish "15% of viewport width" from "a consistent visual distance" from "15% of parent container."
3. **Implicit unit semantics**: The same `number` type means different things in different contexts (NVS position, NVS size, world units, degrees, ratios).

## Solution

Introduce a CSS-inspired unit system where DSL-authored spatial values require explicit units. Bare numbers (except `0`) become illegal at the DSL authoring surface. A single unit resolution module in `@brewsite/core` converts authored string values to NVS fractions at compile time. Compiled state remains `number` — the transition system and render layer never see unit strings.

## Scope Boundary

**Rule: Only NVS-authored DSL values get `SceneLength`. World-space values stay `number`/`Vec3`. Authored angles get `SceneAngle`. Dimensionless values stay `number`.**

| Category | Gets unit types? | Examples |
|----------|-----------------|----------|
| NVS-authored sizes/positions | **Yes** → `SceneLength` | diagram node size/position, chart bounds, screen/model NVS positions, View bounds, TextBox x/y/w/h, layout gaps/padding/spacing, theme NVS defaults |
| Authored angles | **Yes** → `SceneAngle` | camera orbit azimuth/polar/fov, diagram tilt, floor rotation, spotlight angle, texture rotation |
| World-space values | **No** — stays `number`/`Vec3` | lighting positions, floor position, camera world position/target, spotlight-rig center/target/radius/height/distance, camera min/maxDistance, model z, edge path commands |
| Compiled/computed values | **No** — stays `number` | `DiagramNodeState.size`, `DiagramEdgePathCommand`, all `*State` types |
| Dimensionless values | **No** — stays `number` | opacity, metalness, roughness, intensity, scale multipliers, iconScale, glowSpread, flowWidth, labelSizeFactor, sublabelSizeFactor, beamOpacity, smoothness, all ratios and multipliers |
| `NVSRect` (internal type) | **No** — stays `{ x: number; y: number; w: number; h: number }` | Used by models, charts, diagrams, views — compiled/internal |

## Unit Types

### Spatial Units

| Unit | Syntax | Meaning | Resolution |
|------|--------|---------|------------|
| **u** | `"0.15u"` | Scene unit — uniform, aspect-ratio-preserving | SIZES: `value/100 * min(visibleWorldW, visibleWorldH)`. POSITIONS: equivalent to `%` (per-axis). |
| **%** | `"50%"` | Percentage of parent/viewport axis | Per-axis: `value/100 * visibleWorldW` for X, `value/100 * visibleWorldH` for Y. |
| **vw** | `"15vw"` | Percentage of viewport width | `value/100 * visibleWorldWidth` (both axes) |
| **vh** | `"15vh"` | Percentage of viewport height | `value/100 * visibleWorldHeight` (both axes) |

**Critical rule**: `u` produces uniform (vmin-based) world-space values ONLY when applied to SIZE properties. For POSITION properties, `u` is equivalent to `%` (per-axis NVS fraction). This means `position={["50u", "50u"]}` and `position={["50%", "50%"]}` compile to the same NVS values.

### Angle Units

| Unit | Syntax | Resolution |
|------|--------|------------|
| **deg** | `"45deg"` | `value * (Math.PI / 180)` → radians |
| **rad** | `"0.78rad"` | `value` (passthrough) |

### Zero

`0` is legal without a unit (like CSS). `"0%"`, `"0u"`, `"0vw"`, `"0vh"`, `"0deg"`, `"0rad"` are also legal. All are equivalent to `0`.

### Dimensionless

Values that are ratios, multipliers, or counts remain bare `number` types: `opacity`, `metalness`, `roughness`, `intensity`, `scale` (as a multiplier), `iconScale`, `glowSpread`, `labelSizeFactor`, `sublabelSizeFactor`, `beamOpacity`, `flowWidth`, `smoothness`, `count`, etc.

## TypeScript Types

```typescript
// packages/core/src/units/types.ts
// Pure types only — no Three.js, no React, no runtime imports.

/** A spatial value with explicit units. */
export type SceneLength = `${number}u` | `${number}%` | `${number}vw` | `${number}vh` | 0;

/** An angle value with explicit units. */
export type SceneAngle = `${number}deg` | `${number}rad` | 0;

/** A 2D spatial value (e.g., size, position). */
export type SceneSize2 = readonly [SceneLength, SceneLength];

/** A 3D spatial value (e.g., position with Z). */
export type ScenePosition3 = readonly [SceneLength, SceneLength, SceneLength];

/**
 * Layout padding — follows CSS shorthand.
 * Unifies with the existing RegionPadding type in layout/regionTypes.ts.
 * RegionPadding is replaced by ScenePadding — no duplication.
 */
export type ScenePadding =
  | SceneLength
  | readonly [SceneLength, SceneLength]
  | readonly [SceneLength, SceneLength, SceneLength]
  | readonly [SceneLength, SceneLength, SceneLength, SceneLength];

/** Parsed unit value — output of parse(), input of resolve(). */
export type ParsedLength = { readonly value: number; readonly unit: 'u' | '%' | 'vw' | 'vh' };
export type ParsedAngle = { readonly value: number; readonly unit: 'deg' | 'rad' };
```

## Resolution Context

```typescript
// packages/core/src/units/resolve.ts
// Imports only from units/types.ts. No Three.js, no React.

import type { NVSCoordService } from '../widget/types';

/**
 * Constructs a UnitContext from the existing NVSCoordService.
 * This is the bridge — UnitContext wraps NVSCoordService, it does not replace it.
 */
export function unitContextFromCoords(coords: NVSCoordService): UnitContext;

export type UnitContext = {
  /** min(visibleWorldWidth, visibleWorldHeight) — the vmin reference. */
  readonly uniformScale: number;
  /** Viewport width in world units. */
  readonly visibleWorldWidth: number;
  /** Viewport height in world units. */
  readonly visibleWorldHeight: number;
};

/**
 * Resolves a SceneLength to an NVS fraction (not world units).
 * Used in compile.ts to convert DSL values to compiled state numbers.
 *
 * For `u` values:
 *   - Positions: returns value/100 (same as %, per-axis)
 *   - Sizes: returns value/100 (same numeric value, but the caller must
 *     set uniformSizing=true on the compiled state so the renderer
 *     uses vmin instead of per-axis scaling)
 *
 * For `%` values: returns value/100
 * For `vw` values: returns value/100
 * For `vh` values: returns value/100
 */
export function resolveToNVS(value: SceneLength): number;

/**
 * Returns true if the given SceneLength value uses the `u` unit.
 * Used by compile.ts to determine the uniformSizing flag value.
 */
export function isUniformUnit(value: SceneLength): boolean;

/**
 * Resolves a SceneAngle to radians.
 */
export function resolveAngle(value: SceneAngle): number;
```

**Implementation note**: `resolveToNVS()`, `isUniformUnit()`, and `resolveAngle()` are pure string→number functions that import only from `units/types.ts`. `unitContextFromCoords()` imports `NVSCoordService` from `widget/types`. Consider splitting into `resolve.ts` (pure functions) and `bridge.ts` (NVSCoordService integration) to keep the pure module maximally importable.

## The `uniformSizing` Flag — Compile-to-Render Bridge

### Problem

`"15u"` means "15% of vmin" — the same world-space length on both axes. But NVS fractions are per-axis: `nvsW * visibleWorldW ≠ nvsH * visibleWorldH` on non-square viewports. The render layer must know whether to use per-axis or uniform (vmin) scaling.

### Solution

A `uniformSizing: boolean` flag on compiled state types. One flag per element (not per-field).

```typescript
// In DiagramNodeState (compiled state — stays number):
interface DiagramNodeState {
  readonly size: readonly [number, number];       // NVS fractions (unchanged)
  readonly thickness: number;                      // NVS fraction (unchanged)
  readonly cornerRadius: number;                   // NVS fraction (unchanged)
  readonly borderWidth: number;                    // NVS fraction (unchanged)
  readonly borderHeight: number;                   // NVS fraction (unchanged)
  readonly iconDepth: number;                      // NVS fraction (unchanged)
  /** When true, all size-like fields use vmin scaling. When false, per-axis (existing). */
  readonly uniformSizing: boolean;                 // NEW
  // ... rest unchanged
}
```

### Compile-time behavior

```typescript
// In compileDiagram node handler:
const sizeW = resolveToNVS(dsl.size[0]);  // "15u" → 0.15
const sizeH = resolveToNVS(dsl.size[1]);  // "15u" → 0.15
const uniformSizing = isUniformUnit(dsl.size[0]); // true for u, false for %/vw/vh
```

**Mixed-unit tuples are a compile error**: `size={["15u", "10%"]}` throws at compile time. Both components must use the same unit family (`u` vs `%`/`vw`/`vh`). Validated in the NodeHandler, not at the TypeScript type level (better error messages).

**Flag-setting rules** (how the compile layer determines `uniformSizing`):
- If ANY size-like DSL prop on the element uses `u`, the flag is `true`.
- If ALL size-like DSL props use `%`/`vw`/`vh`, the flag is `false`.
- Mixed props (`size` uses `u`, `thickness` uses `%`) → compile warning + flag is `true` (uniform wins).
- If no size-like DSL props are provided (all use theme defaults), the flag inherits from the theme's default unit type.

### Render-time behavior

```typescript
// In widget apply() method:
if (node.uniformSizing) {
  const uniform = Math.min(coords.visibleWorldWidth, coords.visibleWorldHeight);
  worldW = node.size[0] * uniform;
  worldH = node.size[1] * uniform;
  worldThickness = node.thickness * uniform;
  worldCornerRadius = node.cornerRadius * uniform;
  // ... all size-like fields use uniform
} else {
  [worldW, worldH] = coords.toWorldSize(node.size[0], node.size[1]);
  worldThickness = node.thickness * coords.visibleWorldWidth; // existing behavior
  worldCornerRadius = node.cornerRadius * coords.visibleWorldWidth; // existing behavior
}
```

### Transition behavior

- The transition system interpolates `size[0]`, `size[1]`, `thickness`, etc. as numbers — unchanged.
- The `uniformSizing` flag is NOT interpolated — it's a boolean carried from endpoint states.
- **Transition merge rule**: When two adjacent scenes have different `uniformSizing` values for the same widget, the flag from the TARGET (entering) scene is used for the entire transition block. This produces correct visual results for the destination state.
- **Default**: `uniformSizing: false` — preserves existing per-axis behavior for all current scenes.

### Which compiled state types get the flag

| Compiled State Type | Gets `uniformSizing`? | Size-like fields affected |
|---|---|---|
| `DiagramNodeState` | Yes | `size`, `thickness`, `cornerRadius`, `borderWidth`, `borderHeight`, `iconDepth` |
| `DiagramGroupState` | Yes | `bounds` (w, h), `borderWidth`, `borderHeight` |
| `DiagramEdgeState` | Yes | `thickness` |
| `ChartState` | Yes | `bounds.width`, `bounds.height` |
| `ScreenState` | Yes | `nvsWidth`, `nvsHeight`, `bezelThickness` |
| `ImagePanelState` | Yes | `nvsWidth`, `nvsHeight`, `bezelThickness` |
| `MediaScreenState` | Yes | `nvsWidth`, `nvsHeight`, `bezelThickness` |

## Complete Prop Classification

### Diagram (`packages/diagram/src/elements/diagram/types.ts`)

| Prop | Current Type | New DSL Type | Compiled State | Classification |
|------|-------------|-------------|----------------|----------------|
| `DiagramNodeDSL.size` | `[number, number]` | `SceneSize2` | `[number, number]` (NVS) | `SceneLength` |
| `DiagramNodeDSL.position` | `[number, number, number]` | `ScenePosition3` | `[number, number, number]` (NVS) | `SceneLength` |
| `DiagramNodeDSL.thickness` | `number` | `SceneLength` | `number` (NVS) | `SceneLength` |
| `DiagramNodeDSL.cornerRadius` | `number` | `SceneLength` | `number` (NVS) | `SceneLength` |
| `DiagramNodeDSL.borderWidth` | `number` | `SceneLength` | `number` (NVS) | `SceneLength` |
| `DiagramNodeDSL.borderHeight` | `number` | `SceneLength` | `number` (NVS) | `SceneLength` |
| `DiagramNodeDSL.iconDepth` | `number` | `SceneLength` | `number` (NVS) | `SceneLength` |
| `DiagramNodeDSL.labelPadding` | `number` | `number` | `number` | dimensionless (0-1 fraction of content height) |
| `DiagramNodeDSL.opacity` | `number` | `number` | `number` | dimensionless |
| `DiagramNodeDSL.metalness` | `number` | `number` | `number` | dimensionless |
| `DiagramNodeDSL.roughness` | `number` | `number` | `number` | dimensionless |
| `DiagramNodeDSL.iconScale` | `number` | `number` | `number` | dimensionless (0-1 fraction) |
| `DiagramEdgeDSL.thickness` | `number` | `SceneLength` | `number` (NVS) | `SceneLength` |
| `DiagramEdgeDSL.flowTurnRadius` | `number` | `SceneLength` | `number` (NVS) | `SceneLength` |
| `DiagramEdgeDSL.flowFaceStub` | `number` | `SceneLength` | `number` (NVS) | `SceneLength` |
| `DiagramEdgeDSL.flowBundleStrength` | `number` | `number` | `number` | dimensionless multiplier |
| `DiagramEdgeDSL.flowTargetApproachBias` | `number` | `number` | `number` | dimensionless multiplier |
| `DiagramEdgeDSL.opacity` | `number` | `number` | `number` | dimensionless |
| `DiagramDSL.tilt` | `number` | `SceneAngle` | `number` (radians) | `SceneAngle` |
| `DiagramDSL.x, y` | `number` | `SceneLength` | `number` (NVS) | `SceneLength` |
| `DiagramDSL.w, h` | `number` | `SceneLength` | `number` (NVS) | `SceneLength` |
| `DiagramDSL.z` | `number` | `number` | `number` | world-space (stays `number`) |
| `DiagramDSL.scale` | `number` | `number` | `number` | dimensionless multiplier |
| Layout `spacing` | `[number, number]` | `SceneSize2` | `[number, number]` (NVS) | `SceneLength` |
| Layout `gap` | `number` | `SceneLength` | `number` (NVS) | `SceneLength` |
| Layout `groupPadding` | `LayoutPadding` | `ScenePadding` | `LayoutPadding` (NVS numbers) | `SceneLength` |
| Layout `titleGap` | `number` | `SceneLength` | `number` (NVS) | `SceneLength` |
| Layout `margin` | `number \| [number, number]` | `SceneLength \| SceneSize2` | `number \| [number, number]` (NVS) | `SceneLength` |
| `DiagramEdgePathCommand` coords | `[number, number, number]` | `[number, number, number]` | `[number, number, number]` | compiled/computed (stays `number`) |
| `DiagramExitDSL.to` | `[number, number, number]` | `ScenePosition3` | `[number, number, number]` (NVS) | `SceneLength` (DSL-authored exit target) |
| `DiagramEnterDSL.from` | `[number, number, number]` | `ScenePosition3` | `[number, number, number]` (NVS) | `SceneLength` (DSL-authored enter source) |
| `DiagramGroupEdgeLightsDSL.density` | `number` | `number` | `number` | dimensionless (lights per unit) |
| `DiagramGroupEdgeLightsDSL.zOffset` | `number` | `number` | `number` | world-space (stays `number`) |
| `DiagramGroupEdgeLightsDSL.intensity` | `number` | `number` | `number` | dimensionless |
| `DiagramGroupEdgeLightsDSL.distance` | `number` | `number` | `number` | world-space (stays `number`) |

### Diagram Themes

| Theme Field | Current | New Type | Classification |
|---|---|---|---|
| `node.defaultSize` | `[number, number]` | `SceneSize2` | `SceneLength` |
| `node.defaultThickness` | `number` | `SceneLength` | `SceneLength` |
| `node.cornerRadius` | `number` | `SceneLength` | `SceneLength` |
| `node.defaultIconDepth` | `number` | `SceneLength` | `SceneLength` |
| `node.defaultNodeBorderWidth` | `number` | `SceneLength` | `SceneLength` |
| `node.defaultNodeBorderHeight` | `number` | `SceneLength` | `SceneLength` |
| `node.defaultLabelPadding` | `number` | `number` | dimensionless |
| `node.labelSizeFactor` | `number` | `number` | dimensionless multiplier |
| `node.sublabelSizeFactor` | `number` | `number` | dimensionless multiplier |
| `node.defaultIconScale` | `number` | `number` | dimensionless |
| `node.glowIntensity` | `number` | `number` | dimensionless |
| `node.glowSpread` | `number` | `number` | dimensionless multiplier |
| `edge.defaultThickness` | `number` | `SceneLength` | `SceneLength` |
| `edge.flowTurnRadius` | `number` | `SceneLength` | `SceneLength` |
| `edge.flowFaceStub` | `number` | `SceneLength` | `SceneLength` |
| `edge.flowObstaclePadding` | `number` | `SceneLength` | `SceneLength` |
| `edge.flowUnderpassDepth` | `number` | `SceneLength` | `SceneLength` |
| `edge.flowUnderpassClearance` | `number` | `SceneLength` | `SceneLength` |
| `edge.organicVariation` | `number` | `number` | dimensionless multiplier |
| `edge.smoothness` | `number` | `number` | dimensionless multiplier |
| `group.defaultBorderWidth` | `number` | `SceneLength` | `SceneLength` |
| `group.defaultBorderHeight` | `number` | `SceneLength` | `SceneLength` |
| `layout.grid.spacing` | `[number, number]` | `SceneSize2` | `SceneLength` |
| `layout.grid.margin` | `number \| [number, number]` | `SceneLength \| SceneSize2` | `SceneLength` |
| `layout.grid.groupPadding` | `LayoutPadding` | `ScenePadding` | `SceneLength` |
| `layout.grid.titleGap` | `number` | `SceneLength` | `SceneLength` |
| (Same pattern for `hierarchical`, `manual`, `flow` layout defaults) | | | |

### Chart (`packages/charts/src/`)

| Prop | Current | New DSL Type | Compiled State | Classification |
|------|---------|-------------|----------------|----------------|
| Chart DSL `x` (nvsX) | `number` | `SceneLength` | `number` (NVS) | `SceneLength` |
| Chart DSL `y` (nvsY) | `number` | `SceneLength` | `number` (NVS) | `SceneLength` |
| Chart DSL `z` | `number` | `number` | `number` | world-space (stays `number`) |
| Chart DSL `width` | `number` | `SceneLength` | `number` (NVS) | `SceneLength` |
| Chart DSL `height` | `number` | `SceneLength` | `number` (NVS) | `SceneLength` |
| `bounds.depth` | `number` | `number` | `number` | world-space (stays `number`) |
| `rotation` | `[number, number, number]` | `[SceneAngle, SceneAngle, SceneAngle]` | `[number, number, number]` (radians) | `SceneAngle` |
| `nvsBounds` | `NVSRect` | `NVSRect` | `NVSRect` | internal (stays `number`) |
| `opacity` | `number` | `number` | `number` | dimensionless |

### Chart Themes (`packages/charts/src/themes/types.ts`)

| Token | Current | New Type | Classification |
|---|---|---|---|
| `axis.fontSize` | `number` | `number` | world-space (stays `number`) |
| `axis.tickLength` | `number` | `number` | world-space (stays `number`) |
| `axis.gap` | `number` | `number` | world-space (stays `number`) |
| `axis.titleFontSize` | `number` | `number` | world-space (stays `number`) |
| `legend.fontSize` | `number` | `number` | world-space (stays `number`) |
| `legend.swatchSize` | `number` | `number` | world-space (stays `number`) |
| `legend.spacing` | `number` | `number` | world-space (stays `number`) |
| `legend.gap` | `number` | `number` | world-space (stays `number`) |
| `gridlines.dashSize` | `number` | `number` | world-space (stays `number`) |
| `gridlines.gapSize` | `number` | `number` | world-space (stays `number`) |
| `dataLabels.fontSize` | `number` | `number` | world-space (stays `number`) |
| `tooltip.*` | various | various | CSS pixels (stays `number`) |

**Note**: Chart theme spatial tokens are world-space values used inside the chart's own coordinate system (after NVS→world conversion). They stay `number`.

### Screen / Image-Panel / MediaScreen (`packages/screens/src/`)

| Prop | Current | New DSL Type | Compiled State | Classification |
|------|---------|-------------|----------------|----------------|
| `ScreenDSL.x` | `number` | `SceneLength` | `number` (NVS) | `SceneLength` |
| `ScreenDSL.y` | `number` | `SceneLength` | `number` (NVS) | `SceneLength` |
| `ScreenDSL.z` | `number` | `number` | `number` | world-space (stays `number`) |
| `ScreenDSL.width` | `number` | `SceneLength` | `number` (NVS) | `SceneLength` |
| `ScreenDSL.height` | `number` | `SceneLength` | `number` (NVS) | `SceneLength` |
| `ScreenDSL.rotation` | `[number, number, number]` | `[SceneAngle, SceneAngle, SceneAngle]` | `[number, number, number]` (radians) | `SceneAngle` |
| `ScreenDSL.bezelThickness` | `number` | `number` | `number` | world-space (stays `number`) |
| `ScreenDSL.scale` | `number` | `number` | `number` | dimensionless |
| `ScreenDSL.opacity` | `number` | `number` | `number` | dimensionless |
| `ImagePanelDSL.*` | (same pattern as Screen) | | | |
| `MediaScreenDSL.*` | (same pattern as Screen) | | | |

### Model (`packages/model/src/`)

| Prop | Current | New DSL Type | Compiled State | Classification |
|------|---------|-------------|----------------|----------------|
| `SceneModel.nvsX` | `number` | `SceneLength` | `number` (NVS) | `SceneLength` |
| `SceneModel.nvsY` | `number` | `SceneLength` | `number` (NVS) | `SceneLength` |
| `SceneModel.z` | `number` | `number` | `number` | world-space (stays `number`) |
| `SceneModel.scale` | `number` | `number` | `number` | dimensionless multiplier |
| `SceneModel.rotation` | `Vec3` | `[SceneAngle, SceneAngle, SceneAngle]` | `Vec3` (radians) | `SceneAngle` |
| `SceneModel.opacity` | `number` | `number` | `number` | dimensionless |
| `ModelPartSpec.position` | `Vec3` | `Vec3` | `Vec3` | world-space (stays `Vec3`) |
| `ModelPartSpec.rotation` | `Vec3` | `Vec3` | `Vec3` | world-space (stays `Vec3`) |
| `ModelPartSpec.scale` | `number` | `number` | `number` | dimensionless |
| `ModelPartSpec.containedPosition` | `Vec3` | `Vec3` | `Vec3` | world-space (stays `Vec3`) |
| `ModelPartSpec.containedRotation` | `Vec3` | `Vec3` | `Vec3` | world-space (stays `Vec3`) |
| `LabelDefinition.labelOffset` | `[number, number, number]` | `[number, number, number]` | `[number, number, number]` | world-space (stays `number`) |
| `nvsBounds` | `NVSRect` | `NVSRect` | `NVSRect` | internal (stays `number`) |

### Camera (`packages/core/src/elements/camera/types.ts`)

| Prop | Current | New DSL Type | Compiled State | Classification |
|------|---------|-------------|----------------|----------------|
| `OrbitCamera.azimuth` | `number` (radians) | `SceneAngle` | `number` (radians) | `SceneAngle` |
| `OrbitCamera.polar` | `number` (radians) | `SceneAngle` | `number` (radians) | `SceneAngle` |
| `OrbitCamera.distance` | `number` (world) | `number` | `number` | world-space (stays `number`) |
| `OrbitCamera.target` | `Vec3` | `Vec3` | `Vec3` | world-space (stays `Vec3`) |
| `OrbitCamera.nvsTarget` | `[number, number]` | `[SceneLength, SceneLength]` | `[number, number]` (NVS) | `SceneLength` |
| `WorldSpaceCamera.position` | `Vec3` | `Vec3` | `Vec3` | world-space (stays `Vec3`) |
| `WorldSpaceCamera.target` | `Vec3` | `Vec3` | `Vec3` | world-space (stays `Vec3`) |
| `WorldSpaceCamera.nvsTarget` | `[number, number]` | `[SceneLength, SceneLength]` | `[number, number]` (NVS) | `SceneLength` |
| `CameraLens.fov` | `number` (degrees) | `SceneAngle` | `number` (radians) | `SceneAngle` |
| `CameraLens.near` | `number` (world) | `number` | `number` | world-space (stays `number`) |
| `CameraLens.far` | `number` (world) | `number` | `number` | world-space (stays `number`) |
| `FitBotHeightCamera.*` | `number` (world) | `number` | `number` | world-space (stays `number`) — legacy |
| `FitFloorDepthCamera.*` | `number` (world) | `number` | `number` | world-space (stays `number`) — legacy |
| `TrackpadCameraConfig.minDistance` | `number` (world) | `number` | `number` | world-space (stays `number`) |
| `TrackpadCameraConfig.maxDistance` | `number` (world) | `number` | `number` | world-space (stays `number`) |
| `TrackpadCameraConfig.minPolarAngle` | `number` (radians) | `SceneAngle` | `number` (radians) | `SceneAngle` |
| `TrackpadCameraConfig.maxPolarAngle` | `number` (radians) | `SceneAngle` | `number` (radians) | `SceneAngle` |
| `CameraTransitionInterpolation.cp1, cp2` | `Vec3` | `Vec3` | `Vec3` | world-space (stays `Vec3`) |

### Lighting (`packages/core/src/elements/lighting/types.ts`)

| Prop | Current | New DSL Type | Classification |
|------|---------|-------------|----------------|
| `SceneLightSpot.angle` | `number` (radians) | `SceneAngle` | `SceneAngle` |
| `SceneLightStrandCurve.depthPhase` | `number` (radians) | `SceneAngle` | `SceneAngle` |
| All `position` props | `Vec3` | `Vec3` | world-space (stays `Vec3`) |
| All `distance`, `length`, `radius`, `width`, `height`, `yOffset`, `z`, `waveAmplitude`, `depthAmplitude` | `number` (world) | `number` | world-space (stays `number`) |
| `intensity`, `decay`, `penumbra` | `number` | `number` | dimensionless |
| `SceneLightPanel.origin` | `Vec3` | `Vec3` | world-space (stays `Vec3`) |
| `SceneLightPanel.spacing` | `Vec3` | `Vec3` | world-space (stays `Vec3`) |

### Floor (`packages/core/src/elements/floor/types.ts`)

| Prop | Current | New DSL Type | Classification |
|------|---------|-------------|----------------|
| `position` | `[number, number, number]` | `[number, number, number]` | world-space (stays `number`) |
| `rotation` | `[number, number, number]` | `[SceneAngle, SceneAngle, SceneAngle]` | `SceneAngle` |
| `rotationRelative` | `[number, number, number]` | `[SceneAngle, SceneAngle, SceneAngle]` | `SceneAngle` |
| `textureRotation` | `number` (radians) | `SceneAngle` | `SceneAngle` |
| `scale` | `number` (world) | `number` | world-space (stays `number`) |
| `negativeZExtent` | `number` (world) | `number` | world-space (stays `number`) |
| `negativeZFadeDistance` | `number` (world) | `number` | world-space (stays `number`) |
| `gridCellSize` | `number` (world) | `number` | world-space (stays `number`) |

### SpotlightRig (`packages/core/src/elements/spotlight-rig/types.ts`)

| Prop | Current | New DSL Type | Classification |
|------|---------|-------------|----------------|
| `angle` | `number` (radians) | `SceneAngle` | `SceneAngle` |
| `phase` | `number` (radians) | `SceneAngle` | `SceneAngle` |
| `speed` | `number` (rad/sec) | `number` | dimensionless (rate, stays `number`) |
| `radius` | `number` (world) | `number` | world-space (stays `number`) |
| `height` | `number` (world) | `number` | world-space (stays `number`) |
| `targetY` | `number` (world) | `number` | world-space (stays `number`) |
| `distance` | `number` (world) | `number` | world-space (stays `number`) |
| `haloSize` | `number` (world) | `number` | world-space (stays `number`) |
| `center` | `Vec3Tuple` | `Vec3Tuple` | world-space (stays `number`) |
| `target` | `Vec3Tuple \| null` | `Vec3Tuple \| null` | world-space (stays `number`) |

### CarouselScrubber (`packages/core/src/elements/carousel-scrubber/types.ts`)

| Prop | Current | New DSL Type | Classification |
|------|---------|-------------|----------------|
| `trayDepth` | `number` (world) | `number` | world-space (stays `number`) |
| `gap` | `number` (world) | `number` | world-space (stays `number`) |
| `outerMargin` | `number` (NVS) | `SceneLength` | `SceneLength` |
| `beamHeight` | `number` (world) | `number` | world-space (stays `number`) |
| `zOffset` | `number` (world) | `number` | world-space (stays `number`) |
| `nvsBounds` | `NVSRect` | `NVSRect` | internal (stays `number`) |
| `viewExtent` | `NVSRect` | `NVSRect` | internal (stays `number`) |

### View / ViewLayout (`packages/core/src/compiler/viewTypes.ts`)

| Prop | Current | New DSL Type | Compiled State | Classification |
|------|---------|-------------|----------------|----------------|
| `View.x` | `number` (NVS) | `SceneLength` | `number` (NVS) | `SceneLength` |
| `View.y` | `number` (NVS) | `SceneLength` | `number` (NVS) | `SceneLength` |
| `View.w` | `number` (NVS) | `SceneLength` | `number` (NVS) | `SceneLength` |
| `View.h` | `number` (NVS) | `SceneLength` | `number` (NVS) | `SceneLength` |
| `StackLayoutConfig.gap` | `number` (NVS) | `SceneLength` | `number` (NVS) | `SceneLength` |

### TextBox (`packages/core/src/elements/text-box/dsl.tsx`)

| Prop | Current | New DSL Type | Classification |
|------|---------|-------------|----------------|
| `x` | `number` (NVS) | `SceneLength` | `SceneLength` |
| `y` | `number` (NVS) | `SceneLength` | `SceneLength` |
| `w` | `number` (NVS) | `SceneLength` | `SceneLength` |
| `h` | `number` (NVS) | `SceneLength` | `SceneLength` |

### HUD (`packages/core/src/hud/`)

| Prop | Current | New DSL Type | Classification |
|------|---------|-------------|----------------|
| `HudItem.x` | `number` (0-1) | `SceneLength` | `SceneLength` |
| `HudItem.y` | `number` (0-1) | `SceneLength` | `SceneLength` |

### Slides (`packages/slides/src/`)

| Prop | Current | New DSL Type | Classification |
|------|---------|-------------|----------------|
| `SlideRegion.x, y, w, h` | `number` (NVS) | `SceneLength` | `SceneLength` |
| `SlideTheme.density.titleHeight` | `number` (NVS) | `SceneLength` | `SceneLength` |
| `SlideTheme.density.gutter` | `number` (NVS) | `SceneLength` | `SceneLength` |
| CSS string values (`entranceDistance`, `contentPadding`) | `string` | `string` | CSS (stays `string`) |

## `Resolvable<T>` Interaction

Many DSL props use `Resolvable<T>` for dynamic values. After migration:
- `Resolvable<number>` for spatial props becomes `Resolvable<SceneLength>`.
- This means `SceneLength | ((context: SceneSnapshotContext) => SceneLength)`.
- Functions that return spatial values must now return `SceneLength` strings.
- The `resolveValue()` helper in `CompileHelpers` resolves the `Resolvable` wrapper first, then the unit parser resolves the `SceneLength` string to an NVS number.

## Migration Strategy

### Approach

Hard break with semver major + codemod script + migration guide. No deprecation period.

**Rationale**: TypeScript's type system catches all bare-number usage at compile time. There are zero runtime surprises. The codemod handles mechanical migration. A deprecation period would double compile-layer complexity for zero safety benefit.

### Codemod Script

The codemod script in `scripts/` uses AST transformation (ts-morph or jscodeshift) with a per-prop classification mapping:

```typescript
// Codemod prop classification (drives automated transform)
const propClassification = {
  // Sizes → "u" unit
  'DiagramNode.size': 'u',
  'DiagramNode.thickness': 'u',
  'DiagramNode.cornerRadius': 'u',
  'DiagramNode.borderWidth': 'u',
  'DiagramNode.borderHeight': 'u',
  'DiagramNode.iconDepth': 'u',
  'DiagramEdge.thickness': 'u',
  'DiagramEdge.flowTurnRadius': 'u',
  'DiagramEdge.flowFaceStub': 'u',
  'Screen.width': 'u',
  'Screen.height': 'u',
  'ImagePanel.width': 'u',
  'ImagePanel.height': 'u',
  // ...

  // Positions → "%" (convert 0..1 to percentage)
  'DiagramNode.position': '%',
  'Diagram.x': '%',
  'Diagram.y': '%',
  'Diagram.w': '%',
  'Diagram.h': '%',
  'Screen.x': '%',
  'Screen.y': '%',
  'View.x': '%',
  'View.y': '%',
  'View.w': '%',
  'View.h': '%',
  // ...

  // Angles → "rad" (preserve existing radian values)
  'Diagram.tilt': 'rad',
  'OrbitCamera.azimuth': 'rad',
  'OrbitCamera.polar': 'rad',
  'CameraLens.fov': 'deg', // special: fov is already in degrees
  'Floor.rotation': 'rad',
  'SpotlightRig.angle': 'rad',
  // ...
};
```

**Manual migration required for**: `Resolvable<>` function values that return bare numbers. The codemod flags these with a `// TODO: migrate to SceneLength` comment.

### Migration Guide

The plan requires a migration guide document (`docs/migration/unit-system.md`) covering:
1. What changed and why (problem statement + solution summary)
2. How to run the codemod (`pnpm migrate:units`)
3. Manual migration rules for `Resolvable<>` functions
4. The `uniformSizing` behavior change
5. Before/after examples for each element type

## Implementation Sequence (Phased)

### Phase 0: Unit Module (additive, non-breaking minor)

| Step | What | Package | Risk |
|------|------|---------|------|
| 1 | Create `units/` module: `types.ts`, `parse.ts`, `resolve.ts`, `index.ts` | `@brewsite/core` | Low — additive |
| 2 | Implement `unitContextFromCoords()` bridge to `NVSCoordService` | `@brewsite/core` | Low — additive |
| 3 | Replace `RegionPadding` with `ScenePadding` (alias for backward compat) | `@brewsite/core` | Low |
| 4 | Export all unit types from `@brewsite/core/index.ts` | `@brewsite/core` | Low — additive |
| 5 | Full unit tests for parser, resolver, `resolveAngle` | `@brewsite/core` | — |

### Phase 1: Diagram + Chart (semver major)

| Step | What | Package | Risk |
|------|------|---------|------|
| 6 | Update `DiagramNodeDSL`, `DiagramEdgeDSL`, `DiagramGroupDSL`, `DiagramDSL` types | `@brewsite/diagram` | **High — breaks all diagrams** |
| 7 | Add `uniformSizing` to `DiagramNodeState`, `DiagramGroupState`, `DiagramEdgeState` | `@brewsite/diagram` | High |
| 8 | Update `compileDiagram` to parse `SceneLength` → NVS, set `uniformSizing` flag | `@brewsite/diagram` | High — core pipeline |
| 9 | Update diagram `render.ts` to branch on `uniformSizing` | `@brewsite/diagram` | High — rendering change |
| 10 | Update all 6 diagram theme presets (`darkGlass`, `enterprise`, `neonCyber`, `lightMinimal`, `midnight`, `lightCanvas`) | `@brewsite/diagram` | Medium |
| 11 | Update chart DSL types + `compileChart` + `ChartWidget` | `@brewsite/charts` | Medium |
| 12 | Write codemod script with prop classification mapping | `scripts/` | Medium |
| 13 | Run codemod on all scene files | `apps/` | Mechanical |

### Phase 2: Remaining Elements (same major)

| Step | What | Package | Risk |
|------|------|---------|------|
| 14 | Update `ScreenDSL`, `ImagePanelDSL`, `MediaScreenDSL` types + compile + render | `@brewsite/screens` | Medium |
| 15 | Update model DSL types (`SceneModel` nvsX/nvsY, rotation) + compile | `@brewsite/model` | Medium |
| 16 | Update `View`/`ViewLayout` DSL types + compile | `@brewsite/core` | Medium |
| 17 | Update `TextBox` props | `@brewsite/core` | Low |
| 18 | Update `CarouselScrubber` `outerMargin` | `@brewsite/core` | Low |
| 19 | Update HUD item types | `@brewsite/core` | Low |
| 20 | Update slides `SlideRegion`, theme density values | `@brewsite/slides` | Low |
| 21 | Update camera angle props (`SceneAngle` for orbit, fov, polar limits) | `@brewsite/core` | Medium |
| 22 | Update floor rotation props (`SceneAngle`) | `@brewsite/core` | Low |
| 23 | Update spotlight-rig angle/phase props (`SceneAngle`) | `@brewsite/core` | Low |
| 24 | Update lighting angle props (`SceneAngle` for spot angle, depthPhase) | `@brewsite/core` | Low |
| 25 | Run codemod on remaining scene files | `apps/` | Mechanical |
| 26 | Update `@brewsite/claude-author` docs | `packages/claude-author/` | Low |
| 27 | Update `create-brewsite` templates | `packages/create-brewsite/` | Low |
| 28 | Write migration guide | `docs/` | Low |

## Testing Strategy

### Unit Module Tests (`packages/core/src/units/__tests__/`)

**Parser tests (`parse.test.ts`)**:
- Valid spatial: `"0.15u"` → `{ value: 0.15, unit: 'u' }`, `"50%"` → `{ value: 50, unit: '%' }`, `"15vw"`, `"15vh"`
- Valid angle: `"45deg"` → `{ value: 45, unit: 'deg' }`, `"0.78rad"` → `{ value: 0.78, unit: 'rad' }`
- Zero: `0` → `{ value: 0, unit: 'u' }`, `"0u"`, `"0%"`, `"0deg"` — all equivalent
- Negative: `"-5u"` → `{ value: -5, unit: 'u' }`, `"-10%"` — valid (positions can be negative)
- Large values: `"200vw"`, `"999vh"` — valid (off-screen positions)
- Float variants: `"15.5u"`, `".5u"`, `"0.001u"` — all valid
- Scientific notation: `"1e2u"` — valid or error (decide: error — not CSS-like)
- Invalid: `"15"` (bare number string) → error, `"15px"` → error, `""` → error, `"abc"` → error
- Whitespace: `" 15u "` → error (no tolerance — CSS-like strict parsing)

**Resolver tests (`resolve.test.ts`)**:
- `resolveToNVS("15u")` → `0.15`
- `resolveToNVS("50%")` → `0.50`
- `resolveToNVS("15vw")` → `0.15`
- `resolveToNVS("15vh")` → `0.15`
- `resolveToNVS(0)` → `0`
- `isUniformUnit("15u")` → `true`
- `isUniformUnit("15%")` → `false`
- `isUniformUnit("15vw")` → `false`
- `resolveAngle("45deg")` → `Math.PI / 4`
- `resolveAngle("0.78rad")` → `0.78`
- `resolveAngle(0)` → `0`

**UnitContext bridge tests**:
- `unitContextFromCoords(mockCoordService)` produces correct `uniformScale = min(W, H)`

### Compile Integration Tests

**Diagram compile test** (`packages/diagram/src/elements/diagram/__tests__/unitCompile.test.ts`):
- `DiagramNodeDSL` with `size: ["15u", "15u"]` compiles to `DiagramNodeState.size = [0.15, 0.15]` with `uniformSizing = true`
- `DiagramNodeDSL` with `size: ["15%", "10%"]` compiles to `size = [0.15, 0.10]` with `uniformSizing = false`
- `DiagramNodeDSL` with `size: ["15u", "10%"]` throws compile error
- `DiagramNodeDSL` with `thickness: "0.025u"` compiles to `thickness = 0.025` with `uniformSizing = true`
- `DiagramDSL` with `tilt: "15deg"` compiles to `tiltRotation[0]` = correct radians

**Chart compile test** (`packages/charts/src/elements/chart/__tests__/unitCompile.test.ts`):
- Chart DSL with `width: "60%"` compiles to `bounds.width = 0.60` with `uniformSizing = false`

**Theme resolution test**:
- Theme preset with `defaultSize: ["0.12u", "0.08u"]` flows through `themeResolver` → `compileDiagram` → correct NVS values with `uniformSizing = true`

### Render Integration Tests

**`uniformSizing` flag render test**:
- On 16:9 viewport: node with `size=[0.15, 0.15], uniformSizing=true` → `worldW = worldH = 0.15 * min(W, H)` (square)
- On 16:9 viewport: node with `size=[0.15, 0.15], uniformSizing=false` → `worldW ≠ worldH` (rectangle, existing behavior)
- On 4:3 viewport: same test — uniform produces square, per-axis produces rectangle

### Transition Tests

- Two adjacent scenes with same node, both `uniformSizing=true`: `interpolateFn` at `t=0.5` produces correct midpoint sizes, flag remains `true`
- Two adjacent scenes where scene A has `uniformSizing=true` and scene B has `uniformSizing=false`: flag for transition block = `false` (target scene wins)

### Backward Compatibility / Codemod Tests

- Codemod transforms `size={[0.15, 0.15]}` → `size={["0.15u", "0.15u"]}`
- Codemod transforms `position={[0.5, 0.3, 0]}` → `position={["50%", "30%", "0u"]}`
- Codemod transforms `tilt={0.15}` → `tilt={"0.15rad"}`
- Codemod flags `Resolvable<number>` functions with TODO comments

### Regression Tests

- **Compiled state snapshot comparison**: For each test scene, capture the compiled NVS values BEFORE migration (bare numbers) and AFTER migration (with unit strings). The NVS fractions must be identical for `%`-typed values. For `u`-typed values on a 16:9 viewport, the compiled NVS fractions are the same but the rendered world sizes differ (this is the intentional fix).
- Golden file comparison for compiled `DiagramNodeState[]` output on reference scenes.

### FOV Double-Conversion Guard

`CameraLens.fov` is currently authored in degrees and stored in degrees in compiled state. `resolveAngle("45deg")` returns radians. The camera compile layer must NOT double-convert (degrees → radians → radians). Test: `fov: "45deg"` compiles to `fov: 45` (degrees) in `CameraLens`, not `Math.PI/4`. The `SceneAngle` → compiled `number` conversion for FOV specifically should use the raw degree value, not `resolveAngle()`.

## Future Enhancements

1. **`baseUnit` configuration**: Scene-level `baseUnit` multiplier for design-system scaling (`1u = baseUnit% of vmin`). Deferred because the `u` unit is already aspect-ratio-preserving without it; authors use smaller numbers for smaller elements. Adding `baseUnit` later is non-breaking (add prop to `Scene`, multiply in `resolveLength`, default `1.0`).
2. **`calc()` support**: `"calc(100vw - 5u)"` — requires expression parsing, defer to later.
3. **Container-relative units**: `"50cw"` / `"50ch"` (like CSS container query units) — for sizing relative to a group/diagram viewport instead of the scene viewport.
4. **`fr` units**: For grid layout distribution — `"1fr"`, `"2fr"` within `GridLayout`.
5. **Media query props**: `<Diagram layout={viewport.isPortrait ? flowTD : gridAuto}>` — reactive layout based on viewport aspect ratio.

## Resolved Design Decisions

These were open questions in the draft. Resolved through architectural review:

**Q1: Compile-time vs render-time resolution?**
**Answer**: Compile-time to NVS fractions. Strings are parsed in DSL NodeHandlers → converted to NVS fractions in `compile.ts` → baked into `SceneTrack` as `number`. The render layer converts NVS→world using `NVSCoordService` as today. The `uniformSizing` flag tells the renderer whether to use vmin or per-axis scaling. This preserves viewport independence, avoids recompilation on resize, and keeps the transition system unchanged.

**Q2: NVS as intermediate representation?**
**Answer**: Yes. Compiled state remains NVS fractions (numbers). The `uniformSizing` boolean flag is the only metadata added to compiled state. The renderer branches on this flag to choose vmin vs per-axis world conversion.

**Q3: Backward compatibility period?**
**Answer**: Hard break with semver major. TypeScript's type system catches all bare-number usage at compile time. The codemod script handles mechanical migration. A migration guide documents edge cases (`Resolvable<>` functions, `uniformSizing` behavior). No deprecation period — it would double compile-layer complexity for zero safety benefit.
