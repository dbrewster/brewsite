---
title: "Viewport Coordinate Normalization — Architecture Review"
doc_type: note
owner: architect
status: draft
updated: 2026-03-05
---

# Viewport Coordinate Normalization — Architecture Review

A comprehensive survey of how viewport X, Y coordinates are specified, compiled, and rendered
across every widget type in `packages/core/src/`, plus blast-radius analysis across
`@brewsite/diagram`, `@brewsite/model`, and `@brewsite/charts`.

---

## TL;DR

The NVS (Normalized Viewport Space) coordinate system is **already fully implemented** across
all four packages. It satisfies the requested spec:

- `x`, `y` always `[0..1]` normalized space
- Origin always top-left corner
- Formally typed (`NVSRect`, `NVSPosition`, `INVSBounded`) and tested

What is **not** implemented — and what is the focus of this note — is:

1. A **NVS ↔ Three.js world-space bridge utility** (no canonical `nvsToWorld` / `worldToNvs` function exists)
2. A **normalization scale / zoom level parameter** for 3D elements placed via NVS
3. A **local [0..1] sub-space contract** for group/composite children in the diagram element

This note documents the current state precisely, explains the exact gaps, and proposes the
minimal design additions needed to close them.

---

## 1. Current State Audit

### 1.1 NVS — Already the Canonical 2D Positioning System

**`NVSRect` and related types** live in `packages/core/src/layout/types.ts`:

```typescript
// core/src/layout/types.ts
export interface NVSRect {
  x: number;   // left edge in [0, 1], 0 = left, 1 = right
  y: number;   // top edge in [0, 1], 0 = top, 1 = bottom
  w: number;   // width in [0, 1]
  h: number;   // height in [0, 1]
}

export interface NVSPosition {
  x: number;
  y: number;
}

export interface INVSBounded {
  readonly nvsBounds: NVSRect;
}
```

Origin is **top-left**. Both axes run `[0..1]`. This is precisely the desired spec.

These types are re-exported from `@brewsite/core`'s widget index (`core/src/widget/index.ts:27`)
and are available to all packages.

---

### 1.2 TextBox Element — Purely NVS, DOM Layer

**File:** `packages/core/src/elements/text-box/dsl.tsx`

```typescript
export interface TextBoxProps {
  x: number;   // NVS x position [0=left, 1=right]
  y: number;   // NVS y position [0=top, 1=bottom]
  w: number;   // NVS width [0..1]
  h: number;   // NVS height [0..1]
  layer?: number;
  overflow?: 'hidden' | 'visible';
}
```

Renders as:
```tsx
<div style={{
  position: 'absolute',
  left: `${x * 100}%`,
  top:  `${y * 100}%`,
  width:  `${w * 100}%`,
  height: `${h * 100}%`,
}} />
```

**Coordinate system:** NVS, top-left origin.
**Defined in:** `dsl.tsx` (this element has no compile.ts, render.ts, or Widget; it IS the runtime component).
**Note:** As of the current git status, `compile.ts`, `TextBoxWidget.ts`, and `types.ts` for text-box
have been deleted. The element is now a pure React component with no compiler integration —
it does not pass through the `SceneTrack`. TextBox content is not animated via the compiler;
it is directly included as JSX in scene overlay children.

---

### 1.3 Camera Element — Pure World Space (Vec3)

**File:** `packages/core/src/elements/camera/types.ts`

The camera uses **raw Three.js world-space coordinates** exclusively. No NVS involvement.

| Mode | Coordinates |
|---|---|
| `world` | `position: Vec3`, `target: Vec3` — explicit world-space |
| `orbit` | `target: Vec3`, `azimuth: number` (radians), `polar: number` (radians), `distance: number` (world units) |
| `fitBotHeight` | `targetId: string` + framing params — implicit, resolved at render time |
| `fitFloorDepth` | Floor plane params — implicit, resolved at render time |

**Lens:** `fov?: number` (degrees, default 45), `focalLength?: number` (mm), `near/far` (world units).
**Default state** (`compile.ts:30`): `enabled: false`, `lens.fov: 45`.

**Coordinate system:** World space (Vec3), radians, world units.
**No NVS involvement.** This is correct — camera position is inherently 3D.

---

### 1.4 Lighting Element — Pure World Space (Vec3)

**File:** `packages/core/src/elements/lighting/types.ts`

All light types use `position: Vec3` in raw world coordinates:

```typescript
type SceneLightDirectional = { position: Vec3; ... }
type SceneLightPoint       = { position: Vec3; ... }
type SceneLightGlowPoint   = { position: Vec3; ... }
type SceneLightStrand      = { position?: Vec3; shape: SceneLightStrandShape; ... }
type SceneLightSpot        = { position: Vec3; target: Vec3; ... }
type SceneLightPanel       = { origin: Vec3; rows: number; cols: number; spacing: Vec3; ... }
```

**Coordinate system:** World space (Vec3).
**No NVS involvement.** This is correct — lights illuminate 3D geometry.

---

### 1.5 Floor Element — Pure World Space (Vec3)

**File:** `packages/core/src/elements/floor/types.ts`

```typescript
type SceneFloor = {
  enabled: boolean;
  position?: [number, number, number];   // world-space Vec3
  rotation?: [number, number, number];   // Euler XYZ radians
  rotationRelative?: [number, number, number];
  scale?: number;
  surface?: FloorSurface;
}
```

**Coordinate system:** World space (Vec3) + Euler radians.
**No NVS involvement.** Correct — it's a 3D plane.

---

### 1.6 Environment Element — No Positional Coordinates

**File:** `packages/core/src/elements/environment/types.ts`

```typescript
type SceneEnvironment = {
  enabled: boolean;
  intensity: number;
  source?: EnvironmentSource;  // url only, no position
}
```

**No positioning coordinates at all.** Environment maps apply globally via IBL.

---

### 1.7 Background Element — CSS Strings (Not NVS)

**File:** `packages/core/src/elements/background/types.ts`

```typescript
type SceneBackground = {
  imageUrl?: string;
  opacity: number;
  color?: string;
  gradient?: string;
  position?: Vec3;       // ← world-space Vec3 (unusual for a DOM element; see note below)
  cssPosition?: string;  // raw CSS e.g. 'center top'
  cssSize?: string;      // raw CSS e.g. 'cover'
  cssRepeat?: string;
  cssFilter?: string;
  overlayGradient?: string;
  backdropFilter?: string;
}
```

**Coordinate system:** Raw CSS strings, with an oddly-present `position: Vec3` field
(not clear if this Vec3 is used; the DOM background is not a 3D object).

**Inconsistency:** Background is a DOM element. It should not use Vec3 for any meaningful
positional purpose. `cssPosition` / `cssSize` are raw CSS and are NOT NVS — this is the
one DOM element that bypasses NVS.

**Impact:** Minor. Background is always fullscreen; sub-region background placement is not
a use case in any current scene.

---

### 1.8 ModelWidget — NVS Ownership Declaration + World-Space Positioning

**File:** `packages/model/src/elements/model/types.ts`

```typescript
type SceneModel = {
  scale: number;
  position: Vec3;   // world-space
  rotation: Vec3;   // Euler XYZ radians
  opacity?: number;
  ...
};

type SceneModelInstanceState = {
  model: SceneModel;
  playback: ScenePlayback;
  enabled?: boolean;
  labels?: LabelResolved[];
  nvsBounds: NVSRect;   // ← NVS ownership declaration
};
```

**DSL props** (`packages/model/src/elements/model/dsl.tsx`):
```typescript
/** NVS x-coordinate of the model left edge [0, 1]. Default: 0 */
x?: number;
y?: number;
w?: number;
h?: number;
```

These map to `SceneModelInstanceState.nvsBounds` at compile time.

**Two separate concerns:**
1. `model.position: Vec3` — where the 3D model sits in world space
2. `nvsBounds: NVSRect` — what portion of the 2D viewport this model occupies
   (used by `LabelPositioner` for projection scoping; used by `INVSBounded` for engine queries)

**These are independent.** An author sets the model's world-space position separately from its
NVS ownership bounds. The NVS bounds must manually agree with the camera framing.

---

### 1.9 DiagramCanvasWidget — NVS Ownership + World-Space Canvas + Diagram Units

**Files:** `packages/diagram/src/elements/diagram/canvas/types.ts`,
`packages/diagram/src/elements/diagram/types.ts`

Three nested coordinate systems:

| Layer | Coordinate System | Type |
|---|---|---|
| Canvas in world | World space (Vec3) | `DiagramCanvasState.position/rotation/scale` |
| Diagram in canvas | Canvas-local Vec3 | `DiagramState.position/rotation/scale` |
| Node in diagram | Diagram-local (diagram units) | `DiagramNodeState.position: [x, y, z]` |
| Group in diagram | Diagram-local (diagram units) | `DiagramGroupState.bounds: {x, y, w, h}` |
| Group edge lights | Group-local space | `DiagramGroupEdgeLightState.position: Vec3` |
| Canvas NVS | NVS ownership declaration | `DiagramCanvasState.nvsBounds: NVSRect` |

**DSL props for canvas** (`DiagramCanvasDSL`):
```typescript
position?: readonly [number, number, number];  // world-space Vec3
rotation?: readonly [number, number, number];
scale?: number;
x?: number;  // NVS ownership [0, 1]
y?: number;
w?: number;
h?: number;
```

**Diagram units:** 1 diagram unit ≈ 1 world unit (before canvas scale). Node positions are
in diagram-local XY space; z is used for depth-layering within the diagram. These are NOT
normalized — they are raw layout coordinates in diagram-unit space.

**computeNdcForNvs** (`canvas/widget.ts:48`): Maps pointer position to NDC using nvsBounds.
This is the NVS → NDC bridge for raycasting. Correctly implements:
```typescript
x: (subX / regionWidth) * 2 - 1,
y: -(subY / regionHeight) * 2 + 1,
```
Y inversion is correct (screen Y down → Three.js NDC Y up).

---

### 1.10 ChartWidget — NVS Ownership + World-Space Position

**File:** `packages/charts/src/elements/chart/types.ts`

```typescript
type ChartState = {
  position: readonly [number, number, number];  // world-space Vec3
  rotation: readonly [number, number, number];
  bounds: { width: number; height: number; depth: number };  // world units
  nvsBounds: NVSRect;  // ownership declaration
  ...
};
```

Same dual-concern pattern as ModelWidget: `position` is world-space; `nvsBounds` is the
2D viewport ownership declaration.

`ChartWidget.apply()` uses `nvsBounds` to compute the click region for interactive charts:
```typescript
const regionLeft   = nvsBounds.x * rect.width;
const regionTop    = nvsBounds.y * rect.height;
const regionWidth  = nvsBounds.w * rect.width;
const regionHeight = nvsBounds.h * rect.height;
```

---

### 1.11 ImagePanel and Screen — Pure World Space

**File:** `packages/diagram/src/elements/image-panel/types.ts`,
`packages/diagram/src/elements/screen/types.ts`

```typescript
interface ImagePanelState {
  position: readonly [number, number, number];  // world-space Vec3
  rotation: readonly [number, number, number];  // Euler XYZ radians
  scale: number;
  width: number;   // world units
  height: number | undefined;  // world units
  ...
}

interface ScreenState {
  position: readonly [number, number, number];  // world-space Vec3
  rotation: readonly [number, number, number];
  scale: number;
  width: number;   // world units (comment: "Default: 12")
  height: number;  // world units (comment: "Default: 7.5 for 16:9")
  ...
}
```

**Coordinate system:** World space exclusively. No NVS involvement.

**Note:** Screen's `width: 12` and `height: 7.5` are hardcoded world-unit defaults matching
the 16:9 aspect ratio. There is no NVS-aware sizing. An author must know the camera distance
and FOV to size a screen appropriately.

---

### 1.12 LabelPositioner — NVS-Aware world→screen Projection

**File:** `packages/model/src/player/LabelPositioner.ts`

The `projectToScreen` function is the **only existing NVS ↔ world bridge** in the codebase:

```typescript
// world → NDC → NVS pixel
x = nvsBounds.x * containerWidth  + (vec.x * 0.5 + 0.5) * nvsBounds.w * containerWidth
y = nvsBounds.y * containerHeight + (-vec.y * 0.5 + 0.5) * nvsBounds.h * containerHeight
```

This is the inverse of `computeNdcForNvs`. Both implement the same mapping; together they
constitute the full round-trip:

```
NVS pointer → NDC (computeNdcForNvs, for raycasting)
world → NDC → NVS pixel (projectToScreen, for label positioning)
```

**Neither function is exported as a utility.** `computeNdcForNvs` is exported from
`canvas/widget.ts`; `projectToScreen` is private to `LabelPositioner.ts`. There is no
shared utility module for these transformations.

---

## 2. AR Container Analysis

**File:** `packages/core/src/player/EngineARContainer.tsx`

`EngineARContainer` is the coordinate system foundation. Its geometry:

```
┌── outer div (100% × 100% of parent) ─────────────────────────────────┐
│ ┌── inner div (AR-locked) ─────────────────────────────────────────┐ │
│ │  position: relative / absolute (centered for contain/fit-height) │ │
│ │  width:  containerW px                                           │ │
│ │  height: containerH px = containerW / aspectRatio               │ │
│ │                                                                  │ │
│ │  NVS (0,0) here                                     NVS (1,0)  │ │
│ │                                                                  │ │
│ │  NVS (0,1) here                                     NVS (1,1)  │ │
│ └──────────────────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────────────┘
```

Key properties:
- **Aspect ratio:** default 16/9, configurable via `aspectRatio` prop
- **Reference width:** default 1920px, defines scale=1.0 for `--scene-scale` CSS variable
- **`--scene-scale`:** injected as `containerW / referenceWidth` on every resize
- **`computedArHeight`:** derived from outer width only (not the scroll spacer's inflated height)
- **Scale modes:** `fit-width` (default), `fit-height`, `contain`, `cover`

The AR-locked inner div is the **reference frame for all NVS coordinates**. The Three.js
WebGLRenderer fills this div at 100% width and height. `EngineOverlayHost` is a sibling with
`position: absolute; inset: 0` — it occupies the same pixel rectangle.

**AR and coordinate mapping:**

The AR container does NOT do any world-space coordinate computation. It only manages the
2D pixel dimensions of the rendering surface. The relationship between the AR container
and Three.js world space is mediated entirely by the camera's FOV and aspect ratio.

The Three.js renderer's own aspect ratio is set to match `containerW / containerH` =
`aspectRatio`. This means the camera's horizontal FOV is:

```
hFOV = 2 * atan(tan(vFOV/2) * aspectRatio)
```

At 45° vFOV and 16:9 AR: `hFOV ≈ 2 * atan(0.4142 * 1.778) ≈ 2 * atan(0.736) ≈ 72.5°`

---

## 3. Three.js Origin Mapping

Three.js NDC (Normalized Device Coordinates): `x ∈ [-1, 1]`, `y ∈ [-1, 1]`, center = (0, 0).
NVS: `x ∈ [0, 1]`, `y ∈ [0, 1]`, top-left = (0, 0).

**Three.js uses a Y-up, right-handed coordinate system.** NDC `y = +1` is the top of the
screen. NVS `y = 0` is also the top. Y axes are opposite between screen (CSS) and Three.js.

**NDC ↔ NVS conversion formulas** (as used in the codebase):

```typescript
// NVS pixel → NDC (computeNdcForNvs in canvas/widget.ts)
ndcX = (pointerX - regionLeft) / regionWidth * 2 - 1
ndcY = -((pointerY - regionTop) / regionHeight * 2 - 1)
     = -(subY / regionHeight * 2 - 1)

// NDC → NVS pixel (projectToScreen in LabelPositioner.ts)
screenX = regionLeft + (ndcX * 0.5 + 0.5) * regionWidth
screenY = regionTop  + (-ndcY * 0.5 + 0.5) * regionHeight
```

These are exact inverses. Y inversion is correctly handled in both.

### FOV / Camera Setup and World-Space Scale

Default camera: `PerspectiveCamera`, default `fov = 45°` (vertical FOV, as per `compile.ts:34`).

At vertical FOV `θ` and camera at distance `d` from a plane at the target Z:

```
visible_height_world = 2 * d * tan(θ/2)

For θ = 45°:  visible_height = 2 * d * tan(22.5°) ≈ 2 * d * 0.4142 ≈ 0.8284 * d
For 16:9 AR:  visible_width  = visible_height * (16/9) ≈ 1.4730 * d
```

NVS [0..1] on Y axis maps to visible_height_world:
```
nvsY = 0 → world Y = +visible_height / 2   (top of screen = positive world Y)
nvsY = 0.5 → world Y = 0                   (center)
nvsY = 1 → world Y = -visible_height / 2   (bottom of screen = negative world Y)
```

NVS [0..1] on X axis maps to visible_width_world:
```
nvsX = 0 → world X = -visible_width / 2    (left of screen = negative world X)
nvsX = 0.5 → world X = 0                   (center)
nvsX = 1 → world X = +visible_width / 2    (right of screen = positive world X)
```

**The "normalization scale"** at a given camera distance `d` and `fov = 45°` is:
```
normScale = visible_height = 0.8284 * d
```

A value of `normScale = 10` means the AR container's height corresponds to 10 world units.
At 16:9 AR, width = 17.78 world units. At this scale:
- NVS (0.5, 0.5) → world (0, 0, 0) (assuming camera looks at origin from +Z)
- NVS (0, 0) → world (-8.89, 5, 0)
- NVS (1, 1) → world (+8.89, -5, 0)

**No utility function exists to perform this calculation.** Authors must compute it manually
or derive it from the DiagramCanvas `onTick` framing logic (which uses the same formula with
a 1.2x padding factor at `canvas/widget.ts:204`).

### Camera Coordinate Direction Convention

The engine uses the standard Three.js right-handed coordinate system:
- **+X**: right
- **+Y**: up
- **+Z**: toward camera (camera looks down -Z by default)

Camera in the `fitBotHeight` mode (`render.ts:155`) places the camera at
`(targetPos[0], targetPos[1] + yOffset, targetPos[2] + distance + zOffset)` and looks at
`(targetPos[0], targetPos[1], targetPos[2])` — confirming camera is along +Z.

---

## 4. Widget Group / Composite Space

### Current State

There is no LOCAL [0..1] sub-space concept for composite widgets today.

**DiagramCanvas:** Contains child `DiagramState` objects positioned in canvas-local Vec3 space.
Node positioning within each diagram is in diagram units (world-unit-scale integers/floats).

```
DiagramCanvasState
  .position: Vec3             ← canvas in world space
  .scale: number
  .diagrams: DiagramState[]
    .position: Vec3           ← diagram in canvas-local space
    .scale: number
    .bounds: { x, y, w, h }  ← diagram extent in diagram units (NOT normalized)
    .nodes: DiagramNodeState[]
      .position: [x, y, z]   ← node in diagram-local space (diagram units)
    .groups: DiagramGroupState[]
      .bounds: { x, y, w, h, padding, titleGap }  ← group extent in diagram units
    DiagramGroupEdgeLightState
      .position: Vec3         ← GROUP-LOCAL space
```

Diagram units are not normalized. A diagram with 4 columns × 3 rows at default spacing
(node size 2×1, spacing 2) spans roughly 16×7 diagram units. The `DiagramState.bounds`
captures this as raw coordinates.

**There is no "group local [0..1]" space** — groups are axis-aligned bounding boxes in
diagram-unit space.

### What "Local [0..1] Group Sub-Space" Would Mean

If a group declared a local [0..1] sub-space, child positions would be expressed as fractions
of the group's extent:

```
groupNvsX = (nodeX - group.bounds.x) / group.bounds.w
groupNvsY = (nodeY - group.bounds.y) / group.bounds.h
```

This would allow placing a node at "70% across, 30% down within group G" without knowing
the group's world-space extent. However, this would break the layout algorithms
(grid, hierarchical, flow) which resolve absolute diagram-unit positions and then compute
group bounds from them — not the other way around.

The current data flow is:
```
layout algorithm → absolute node positions → group bounds computed from node positions
```

A local [0..1] group sub-space would require:
```
group bounds specified first → node positions as fractions of group bounds
```

This is a fundamentally different authoring model and would require new DSL and new layout
algorithms. The existing algorithms cannot be trivially adapted.

**Assessment:** Group local [0..1] sub-space is a significant design change to the diagram
element, not a simple normalization. It is architecturally feasible but would require:
1. A new DSL surface for explicit group sizing
2. New layout algorithms that work from group-defined extents
3. Migration of all existing diagram scenes

---

## 5. Proposed Normalization Model

The NVS system is the normalization model, and it already satisfies the stated requirements
for 2D overlay positioning. The remaining gaps are infrastructure missing around it.

### 5.1 What Is Already Correct

| Element | Positioning | Correct? |
|---|---|---|
| `TextBox` | NVS `[0..1]`, top-left origin | ✓ |
| `ModelWidget.nvsBounds` | NVS `[0..1]`, top-left origin | ✓ |
| `ChartWidget.nvsBounds` | NVS `[0..1]`, top-left origin | ✓ |
| `DiagramCanvasWidget.nvsBounds` | NVS `[0..1]`, top-left origin | ✓ |
| `computeNdcForNvs` | NVS → NDC correctly (Y inverted) | ✓ |
| `projectToScreen` (LabelPositioner) | world → NDC → NVS pixel correctly | ✓ |
| NDC ↔ NVS formulas | Both are exact inverses, Y handled | ✓ |

### 5.2 Gap 1: No Shared NVS ↔ World-Space Bridge Utility

**What is missing:**
A utility module (e.g., `core/src/layout/nvsWorldBridge.ts`) exporting:

```typescript
/**
 * Converts an NVS position to Three.js world-space coordinates at a given depth (Z plane).
 * Assumes a standard PerspectiveCamera looking down -Z at the target.
 *
 * @param nvsX       NVS x in [0, 1]
 * @param nvsY       NVS y in [0, 1]
 * @param targetZ    World-space Z plane of the output point (default 0)
 * @param camera     Three.js PerspectiveCamera (must have correct matrix)
 * @returns          World-space [x, y, z] coordinate
 */
export function nvsToWorld(
  nvsX: number,
  nvsY: number,
  targetZ: number,
  camera: THREE.PerspectiveCamera,
): Vec3;

/**
 * Projects a world-space point to NVS coordinates using the given camera.
 * Returns NVS coordinates in [0, 1]. Points behind the camera or outside
 * the frustum may return values outside [0, 1].
 *
 * @param worldPos   World-space [x, y, z]
 * @param camera     Three.js PerspectiveCamera
 * @returns          NVS position {x, y}
 */
export function worldToNvs(worldPos: Vec3, camera: THREE.PerspectiveCamera): NVSPosition;
```

**Implementation note:** These functions go in `core/src/layout/` alongside `types.ts`.
They import Three.js only in a dedicated file (`core/src/layout/nvsWorldBridge.ts` — permitted
since layout utilities may have Three.js deps). Both `nvsToWorld` and `worldToNvs` are
pure functions of their inputs (no global state).

**For compile-time use (no camera available):** A pure-math version that accepts explicit
camera parameters:

```typescript
/**
 * Converts NVS to world space analytically (no Three.js camera object needed).
 * Assumes a standard camera looking straight down -Z at a target centered at worldCX/worldCY
 * at the given distance, with the given vertical FOV.
 *
 * @param nvsX       NVS x in [0, 1]
 * @param nvsY       NVS y in [0, 1]
 * @param worldCX    World X of the camera look-at center (default 0)
 * @param worldCY    World Y of the camera look-at center (default 0)
 * @param distance   Camera distance from target plane (world units)
 * @param vFovDeg    Vertical FOV in degrees (default 45)
 * @param aspectRatio Width/height ratio (default 16/9)
 * @returns          World-space [x, y, 0] at the target Z plane
 */
export function nvsToWorldAnalytic(
  nvsX: number,
  nvsY: number,
  worldCX: number,
  worldCY: number,
  distance: number,
  vFovDeg: number,
  aspectRatio: number,
): Vec3 {
  const h = 2 * distance * Math.tan((vFovDeg * Math.PI / 180) / 2);
  const w = h * aspectRatio;
  return [
    worldCX + (nvsX - 0.5) * w,
    worldCY - (nvsY - 0.5) * h,   // Y-flip: NVS y=0 is top, world +Y is up
    0,
  ];
}
```

This is the missing math that every author who places a 3D object at an NVS-declared position
must currently compute by hand.

---

### 5.3 Gap 2: No Normalization Scale (Zoom Level) DSL Concept

**The problem:** When an author declares `<DiagramCanvas x={0.1} y={0.1} w={0.8} h={0.8}>`
they know what NVS region the canvas owns. But there is no DSL prop for "how much world space
does this NVS region span at the center" — the author still needs to set the camera manually
to match.

**Proposed addition:** A `normalizationScale` or `worldHeight` prop on elements that combine
3D world-space content with an NVS ownership declaration:

```typescript
interface DiagramCanvasDSL {
  // ... existing props
  /**
   * World-space height visible at the NVS bounds center.
   * When set, DiagramCanvasWidget auto-computes camera distance from this value
   * and the active camera FOV (default 45°). Authors specify "I want the NVS
   * region to show worldHeight world units vertically" without manual camera math.
   *
   * worldHeight = 2 * distance * tan(vFOV/2)
   * distance   = worldHeight / (2 * tan(vFOV/2))
   *
   * For worldHeight = 10 at FOV 45°: distance ≈ 12.07 world units
   *
   * When absent, the existing auto-framing from DiagramCanvasWidget.onTick is used.
   */
  worldHeight?: number;
}
```

This is a low-complexity addition that removes the last manual camera math requirement
for diagram authors. The equivalent for `Model` and `Chart` would be delivered separately.

---

### 5.4 Gap 3: Group / Composite Local [0..1] Sub-Space

**Assessment:** As documented in Section 4, the diagram element's node positioning is in
diagram units (absolute, not normalized). A group local [0..1] sub-space requires a
fundamentally different authoring model that reverses the data flow.

**Recommendation:** Do not add group local NVS to the existing diagram element. Instead:

1. For new composite element types (e.g., a future "Layout" widget), design them from the
   start with a local [0..1] sub-space for child positioning.
2. For the existing diagram element, add a `DiagramGroupNvs` compile helper that:
   - Accepts absolute node positions and group bounds
   - Returns a normalized position within the group
   - Use this for tooling and authoring queries only, not for runtime state

Example helper type (informational, for tooling):
```typescript
/** Converts a node's diagram-local position to a position [0..1] within its group. */
function nodeToGroupNvs(
  node: DiagramNodeState,
  group: DiagramGroupState,
): NVSPosition {
  return {
    x: (node.position[0] - group.bounds.x) / group.bounds.w,
    y: (node.position[1] - group.bounds.y) / group.bounds.h,
  };
}
```

This is a derived computation, not a state representation.

---

### 5.5 Migration Path from Current State to Proposed State

No migration needed for most of the codebase. NVS is already fully in place.

The additions are purely **additive** — new utilities, not replacements:

| Addition | Files Affected | Breaking Change? |
|---|---|---|
| `nvsToWorldAnalytic()` | New file `core/src/layout/nvsWorldBridge.ts` | No |
| `nvsToWorld()` (Three.js) | Same file | No |
| `worldToNvs()` | Same file | No |
| `worldHeight` prop on `DiagramCanvasDSL` | `canvas/types.ts`, `canvas/compile.ts` | No (optional prop) |
| Export bridge from `core/src/layout/index.ts` | `core/src/layout/index.ts` | No |

**Background `position: Vec3` cleanup:** The `SceneBackground.position: Vec3` field has no
clear function for a CSS-positioned DOM element. It should be audited and either:
- Removed (if render.ts ignores it)
- Documented precisely (if it drives a CSS transform)
- Replaced with a CSS string equivalent

This is a separate cleanup task, not part of the normalization model.

---

## 6. Risk Assessment

### 6.1 If NVS Normalization Is Applied to 3D Element Positioning

The question "should lights/cameras/models use NVS instead of Vec3?" is answered definitively:
**No.** NVS is a 2D viewport decomposition system. 3D objects are positioned in 3D space.
These are different problems with different right answers. Forcing 3D positioning into NVS
would require knowing the camera FOV at author time, which is circular (the camera IS a 3D
element being positioned).

The correct mental model is:
- **NVS declares "what viewport area does this widget own"** — for camera framing, raycasting, label projection
- **Vec3 declares "where is this object in 3D space"** — for Three.js rendering

These are complementary, not competing. Both are needed. Neither replaces the other.

### 6.2 Blast Radius of the Proposed Additions (Section 5)

**`nvsWorldBridge.ts`** — additive only, no existing code changes. Zero blast radius.

**`worldHeight` on `DiagramCanvasDSL`** — optional prop with no effect when absent. Zero
blast radius on existing scenes. Only affects DiagramCanvasWidget.onTick framing logic when
present.

**Group local [0..1] sub-space** — explicitly deferred. Not proposed as a code change.

### 6.3 Packages Affected by Current NVS System

| Package | NVS Usage | Known Limitations |
|---|---|---|
| `@brewsite/core` | `NVSRect`, `INVSBounded`, `TextBox`, `EngineARContainer` | None |
| `@brewsite/diagram` | `DiagramCanvasState.nvsBounds`, `computeNdcForNvs`, `DiagramCanvasWidget.nvsBounds` | None |
| `@brewsite/charts` | `ChartState.nvsBounds`, `ChartWidget.nvsBounds`, click-region scoping | None |
| `@brewsite/model` | `SceneModelInstanceState.nvsBounds`, `ModelWidget.nvsBounds`, `LabelPositioner` | See `note_nvs-known-limitations.md` (Limitations 1 and 2) |

### 6.4 Existing Known Issues

**Limitation 1 (model):** `LabelPositionerSyncer` does not re-fire when `nvsBounds` changes
without a resize. Fix: add `widget?.nvsBounds` to dependency array. See `note_nvs-known-limitations.md`.

**Limitation 2 (model):** Multi-model scenes where models have distinct NVS sub-regions produce
incorrect label projections. Fix requires per-widget `LabelPositioner`. Deferred.

**Background `position: Vec3`:** Ambiguous field on a DOM element. Needs audit.

---

## 7. Summary Table: All Elements and Their Coordinate Systems

| Element | X/Y Positioning | Coordinate System | Origin | Range | NVS? |
|---|---|---|---|---|---|
| `TextBox` | `x`, `y`, `w`, `h` | NVS | top-left | [0, 1] | ✓ Yes |
| `Camera` (world) | `position`, `target` | World space Vec3 | arbitrary | unbounded | ✗ |
| `Camera` (orbit) | `target`, `azimuth`, `polar`, `distance` | Spherical world space | arbitrary | radians/units | ✗ |
| `Camera` (fitBotHeight) | `targetId`, `framingHeightPct` | Implicit world space | model position | [0..1] frac | Partial |
| `Lighting` (all types) | `position: Vec3` | World space Vec3 | arbitrary | unbounded | ✗ |
| `Floor` | `position: Vec3` | World space Vec3 | arbitrary | unbounded | ✗ |
| `Environment` | (none) | n/a | n/a | n/a | ✗ |
| `Background` | `cssPosition: string` | Raw CSS | CSS-defined | CSS units | ✗ |
| `ModelWidget` | `model.position: Vec3` (3D) + `nvsBounds: NVSRect` (ownership) | Dual | arbitrary / top-left | unbounded / [0,1] | Partial |
| `DiagramCanvas` | `position: Vec3` (world) + `nvsBounds: NVSRect` (ownership) | Dual | arbitrary / top-left | unbounded / [0,1] | Partial |
| `DiagramNode` | `position: [x, y, z]` | Diagram-local units | diagram pivot | diagram units | ✗ |
| `DiagramGroup` | `bounds: {x, y, w, h}` | Diagram-local units | diagram pivot | diagram units | ✗ |
| `DiagramGroupEdgeLight` | `position: Vec3` | Group-local units | group center | group units | ✗ |
| `ImagePanel` | `position: Vec3` | World space Vec3 | arbitrary | unbounded | ✗ |
| `Screen` | `position: Vec3` | World space Vec3 | arbitrary | unbounded | ✗ |
| `ChartWidget` | `position: Vec3` (3D) + `nvsBounds: NVSRect` (ownership) | Dual | arbitrary / top-left | unbounded / [0,1] | Partial |
| Labels | projected from world via `LabelPositioner` + `nvsBounds` | Derived NVS pixels | top-left | container px | Derived |

**"Partial" means:** the widget declares an NVS ownership region but its 3D content is
positioned in separate world-space coordinates that must manually agree with the camera framing.

---

## 8. Canonical NVS ↔ NDC ↔ World Formulas (Reference)

These are the authoritative conversion formulas used and implied throughout the codebase:

```
NVS (x ∈ [0,1], y ∈ [0,1], origin top-left)
NDC (x ∈ [-1,1], y ∈ [-1,1], origin center, +Y up)
World (x, y, z — Three.js right-handed, +Y up, camera default looks -Z)

NVS → NDC:
  ndcX = nvsX * 2 - 1
  ndcY = -(nvsY * 2 - 1) = 1 - nvsY * 2

NDC → NVS:
  nvsX = (ndcX + 1) / 2
  nvsY = (-ndcY + 1) / 2

NVS → World (analytic, camera at [cx, cy, cz+d] looking at [cx, cy, cz], fov θ, AR):
  h = 2 * d * tan(θ/2)         (visible world height at target plane)
  w = h * AR                   (visible world width)
  worldX = cx + (nvsX - 0.5) * w
  worldY = cy - (nvsY - 0.5) * h   (Y-flip: NVS top → world positive Y)

World → NVS (analytic, same camera):
  nvsX = (worldX - cx) / w + 0.5
  nvsY = -(worldY - cy) / h + 0.5

NDC → NVS pixel (within nvsBounds sub-region):
  screenX = nvsBounds.x * cW + (ndcX * 0.5 + 0.5) * nvsBounds.w * cW
  screenY = nvsBounds.y * cH + (-ndcY * 0.5 + 0.5) * nvsBounds.h * cH
  where cW = container width in pixels, cH = container height in pixels

NVS pixel → NDC (within nvsBounds sub-region, for raycasting):
  regionLeft = nvsBounds.x * cW
  regionTop  = nvsBounds.y * cH
  regionW    = nvsBounds.w * cW
  regionH    = nvsBounds.h * cH
  ndcX = (pointerX - regionLeft) / regionW * 2 - 1
  ndcY = -((pointerY - regionTop) / regionH * 2 - 1)
```

These formulas should be extracted into a shared utility module to prevent
implementation divergence across `LabelPositioner`, `computeNdcForNvs`, and future code.
