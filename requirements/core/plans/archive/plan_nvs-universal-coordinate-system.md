---
title: "NVS Universal Coordinate System — Full Architecture Plan"
doc_type: plan
owner: architect
status: completed
updated: 2026-03-09
amended: 2026-03-09
supersedes: plan_nvs-coordinate-normalization.md
---

# NVS Universal Coordinate System — Full Architecture Plan

## 0. Implementation Order

Tasks must be executed in the following order to avoid broken intermediate states:

**Phase 1 — Core (blocking):** Task 3 (`packages/core`) must complete first. All other
packages depend on the updated `WidgetRenderContext` type (which gains `coords:
NVSCoordService`) and the exported `createNVSCoordService()` factory (which tests use to
construct a real service without a full runtime). No other task can typecheck or pass
tests until this is done.

**Phase 2 — Parallel (unblocked once Phase 1 is complete):** Tasks 4, 5, 6, and 7 may
run concurrently:
- Task 4: `packages/diagram` — types, DSL, compiler, handlers
- Task 5: `packages/diagram` — widget, renderer, plugin, exports, canvas deletion
- Task 6: `packages/model` — NVS changes
- Task 7: `packages/charts` — NVS changes

Note: Tasks 4 and 5 are ordered (4 before 5) within the diagram stream because Task 5
depends on types produced in Task 4. Other pairs are independent.

**Phase 3 — Apps (after all package tasks complete):** Task 8 (`apps/examples`
migration) must run last — all package APIs must be stable before scenes are updated.

**Phase 4 — Verification:** Task 9 (architect verification) runs after Task 8.

---

## 1. Purpose and Scope

This plan establishes NVS ([0..1] Normalized Viewport Space) as the **sole coordinate
language** for all authored positions, sizes, and bounds across the entire BrewSite
toolkit — from DSL authoring through compiled state through widget apply(), up to the
moment each renderer converts to its native output format (CSS percentages for DOM
elements; Three.js world-space for geometry).

This plan supersedes `plan_nvs-coordinate-normalization.md` and extends its scope to:

- Remove `DiagramCanvas` as a DSL element and widget entirely
- Remove the private-scene / scissored-sub-viewport pattern for diagrams
- Inject a first-class `NVSCoordService` into every `WidgetRenderContext`
- Eliminate all intermediate coordinate systems (canvas-local, diagram-unit world-space)
- Add compile-time and render-time NVS bounds validation across all packages
- Establish a single-camera constraint enforced at the runtime level
- Convert `ChartState.bounds.width/height` from world-units to NVS fractions
- Replace ad-hoc camera setup for NVS scenes with a first-class `mode="nvsViewport"` camera mode

**Multiple diagrams per scene:** Multiple `<Diagram>` elements may coexist as siblings
inside a single `<Scene>`. Each has independent `x/y/w/h` NVS bounds, `tilt`, and `z`.
No container element is needed — they render as independent widgets in the same main
Three.js scene and are each registered separately with `diagramPlugin({ diagrams: [...] })`.

**What does NOT change:**
- Camera `position` and `target` props in `<Camera>` remain world-space. The camera is
  what creates the NVS reference frame; it cannot itself be expressed in NVS. The new
  `mode="nvsViewport"` provides a first-class shorthand for NVS-aligned camera setup
  (see §4.2) but does not change the world-space nature of the camera primitives.
- Lighting positions remain world-space (they modify the 3D scene, not the viewport).
- Floor element remains world-space.
- `TextBox` and all DOM overlays are already NVS — no changes.
- The label projection pipeline (world → NDC → DOM) remains as-is; labels follow
  3D-tracked bone positions which are computed at Three.js runtime.
- Bone/skeleton animation positions inside ModelWidget remain Three.js-local — this is
  inescapable (animated bone positions are not authored; they are computed by
  AnimationMixer from GLTF keyframes).

---

## 2. Architecture Decision Record

### ADR-1: Remove DiagramCanvas

**Decision:** The `<DiagramCanvas>` DSL element and `DiagramCanvasWidget` class are
removed. Diagrams render directly into the main Three.js scene using the single main
camera. Authors write `<Diagram>` directly inside `<Scene>`, with `x/y/w/h` NVS bounds
and `tilt` as direct props on `<Diagram>`.

**Rationale:** DiagramCanvas existed to solve three problems: (1) isolate diagram
geometry from the main camera via a private auto-fit camera, (2) apply a tilt transform
without affecting other scene elements, (3) render in a scissored NVS sub-viewport. All
three can be solved in the main scene: (1) the `NVSCoordService` converts NVS positions
to world using the single live camera — no auto-fit needed because scene authors configure
the camera; (2) tilt is a `THREE.Group.rotation` in the main scene; (3) the diagram's
`viewportBounds` is its NVS bounds, no scissoring required. Removing DiagramCanvas
eliminates ~700 lines of infrastructure, removes the only remaining `IExtraRenderPass`
implementor, and makes diagrams compositionally identical to models.

**Trade-off acknowledged:** Diagrams now render with the main perspective camera, which
introduces slight perspective distortion for diagrams placed off-center. Using a low-FOV
camera (10–20°) or the new `mode="nvsDefault"` camera (which positions the camera to
give a near-orthographic frustum for the NVS viewport) makes this imperceptible in
practice.

### ADR-2: Single Camera

The engine has exactly one `THREE.PerspectiveCamera`. There is no per-diagram private
camera. All `NVSCoordService.toWorld()` calls use this single camera. Scene authors
configure it via `<Camera>`.

For NVS-primary scenes (diagrams, charts, no 3D models), the new `mode="nvsViewport"`
provides a principled camera setup where the author declares a world scale (`worldScale`)
and a visible Z depth (`zRange`). The engine computes camera position and clip planes
from these two parameters. See §4.2 for the full specification.

**Why not expose camera position directly for NVS scenes:** Camera position and FOV are
coupled — changing either changes the visible world area, which changes the NVS→world
mapping for all elements. `worldScale` + `zRange` expose the two independent degrees of
freedom that actually matter to NVS-first scene authors (how large the world is, and how
deep the Z range is), without requiring them to reason about trigonometry.

### ADR-3: NVSCoordService injected into WidgetRenderContext

All widgets receive a live `coords: NVSCoordService` in their `WidgetRenderContext` each
frame. Widgets call `coords.toWorld()` and `coords.toWorldSize()` instead of stashing
camera references or using hardcoded aspect-ratio fallbacks. The engine computes this
service from the live camera and live canvas dimensions at the start of each tick.

### ADR-4: No intermediate coordinate systems in compiled state

All positions and sizes in compiled state are NVS [0..1]. The only exceptions are:
- `z` components for depth layering (world-space offset applied at render time)
- Camera `position`/`target` (world-space by definition)
- Lighting `position` fields (world-space, explicitly documented)
- Floor `position` (world-space, explicitly documented)

### ADR-5: Bounds validation at compile-time and render-time

Every NVS value emitted by the compiler is validated against [0..1] in development mode.
Compile-time validation runs during `compileDiagram`, `compileModel`, `compileChart`,
`compileCanvas`. Render-time validation runs in `apply()` as a dev-mode assertion.
Both emit `console.error` (not throw) with the offending field and value.

---

## 3. New Types and Interfaces (core)

### 3.1 `NVSCoordService`

**File:** `packages/core/src/widget/types.ts`

Add the following interface and integrate into `WidgetRenderContext`:

```typescript
/**
 * Per-frame coordinate conversion service injected by the engine into
 * WidgetRenderContext. Converts NVS [0..1] positions to Three.js world-space
 * using the live camera and live canvas dimensions.
 *
 * Widgets that place geometry in the main scene MUST use this service instead
 * of holding camera references or using hardcoded aspect-ratio constants.
 *
 * Available from the first apply() call onward. Guaranteed non-null.
 */
export interface NVSCoordService {
  /**
   * Convert NVS [0..1] viewport position to Three.js world-space XYZ.
   * Projects onto the world Z-plane at the given depth.
   * @param nvsX  Horizontal position [0=left, 1=right].
   * @param nvsY  Vertical position [0=top, 1=bottom].
   * @param z     World-space Z depth of the target plane. Default: 0 (look-at plane).
   */
  toWorld(nvsX: number, nvsY: number, z?: number): readonly [number, number, number];

  /**
   * Convert NVS width/height fractions to Three.js world-space units.
   * Based on the visible world size at z=0 (the camera look-at plane).
   * @param nvsW  Width as fraction of viewport [0..1].
   * @param nvsH  Height as fraction of viewport [0..1].
   */
  toWorldSize(nvsW: number, nvsH: number): readonly [number, number];

  /** Live canvas aspect ratio: width / height in CSS pixels. */
  readonly canvasAspect: number;

  /**
   * Visible world height at z=0 (the camera look-at plane).
   * Equals 2 * cameraDistance * tan(fov/2).
   */
  readonly visibleWorldHeight: number;

  /** Visible world width at z=0. Equals visibleWorldHeight * canvasAspect. */
  readonly visibleWorldWidth: number;

  /** Canvas width in CSS pixels. Updated each frame. */
  readonly viewportWidth: number;

  /** Canvas height in CSS pixels. Updated each frame. */
  readonly viewportHeight: number;
}

// WidgetRenderContext gains `coords`:
export type WidgetRenderContext<TExtra = unknown> = {
  clock: RealtimeClock;
  effectiveDeltaSeconds: number;
  globalProgress: number;
  variables: VariableStoreReader;
  extra: TExtra;
  tick?: SceneTrackTick | null;
  /** Live NVS → world coordinate conversion service. Never null after first apply(). */
  coords: NVSCoordService;
};
```

**`coords` is required, not optional.** This is a deliberate design choice: every widget
that calls `apply()` has access to a valid coord service from the first frame. Making it
optional would require every widget to guard against null and replicate fallback logic.

**Semver consequence for `@brewsite/core`:** Adding a required field to
`WidgetRenderContext` is a **breaking change** — any external code that constructs a
`WidgetRenderContext` literal directly (e.g., in custom widget unit tests) will fail to
typecheck after this change. `@brewsite/core` requires a **major version bump** on
release. All existing test fixtures that construct `WidgetRenderContext` must be updated
to include a `coords` value — use `createNVSCoordService()` (see §3.3) for this.

### 3.3 `createNVSCoordService()` — exported factory

**File:** `packages/core/src/layout/nvsCoordService.ts` *(new file)*

This factory constructs a real `NVSCoordService` from explicit inputs. It is the
canonical way to create a service instance for tests and for `RuntimeDriverImpl` itself.

```typescript
import * as THREE from 'three';
import type { NVSCoordService } from '../widget/types.js';

/**
 * Constructs a real NVSCoordService from a PerspectiveCamera and viewport dimensions.
 *
 * Use in RuntimeDriverImpl.tick() to build the per-frame service, and in unit tests
 * to build a service without bootstrapping a full runtime.
 *
 * @param camera         The scene's live PerspectiveCamera.
 * @param viewportWidth  Canvas width in CSS pixels.
 * @param viewportHeight Canvas height in CSS pixels.
 */
export function createNVSCoordService(
  camera: THREE.PerspectiveCamera,
  viewportWidth: number,
  viewportHeight: number,
): NVSCoordService {
  const fovRad = THREE.MathUtils.degToRad(camera.fov);
  const cameraDistance = camera.position.z; // assumes target z=0
  const visibleWorldHeight = 2 * cameraDistance * Math.tan(fovRad / 2);
  const canvasAspect = viewportWidth / Math.max(1, viewportHeight);
  const visibleWorldWidth = visibleWorldHeight * canvasAspect;

  return {
    toWorld(nvsX: number, nvsY: number, z: number = 0): readonly [number, number, number] {
      const worldX = (nvsX - 0.5) * visibleWorldWidth;
      const worldY = -(nvsY - 0.5) * visibleWorldHeight; // Y-flip: NVS 0=top, world Y+ up
      return [worldX, worldY, z] as const;
    },
    toWorldSize(nvsW: number, nvsH: number): readonly [number, number] {
      return [nvsW * visibleWorldWidth, nvsH * visibleWorldHeight] as const;
    },
    canvasAspect,
    visibleWorldHeight,
    visibleWorldWidth,
    viewportWidth,
    viewportHeight,
  };
}
```

Export from `packages/core/src/layout/index.ts`.

**Usage in `RuntimeDriverImpl.tick()`:** Replace the inline coord-service object
construction in §4.1 with a call to `createNVSCoordService(this.camera, this.viewportWidth,
this.viewportHeight)`.

**Usage in tests:** Construct a `THREE.PerspectiveCamera`, set position and fov, then
call `createNVSCoordService(camera, width, height)`. The result is a real
`NVSCoordService` with correct math — no mocking required.

### 3.2 `NVSBoundsError` (validation helper)

**File:** `packages/core/src/layout/nvsValidation.ts` *(new file)*

```typescript
/**
 * Validates that an NVS value is within [0..1].
 * Emits console.error in development; no-op in production.
 * Returns true if valid, false if out-of-range.
 */
export function validateNVSScalar(
  value: number,
  fieldName: string,
  context: string,
): boolean {
  if (process.env.NODE_ENV === 'production') return true;
  if (value < 0 || value > 1 || !Number.isFinite(value)) {
    console.error(
      `[NVS] Out-of-range: ${context} field "${fieldName}" = ${value}. ` +
      `Expected [0..1]. This will produce incorrect rendering.`,
    );
    return false;
  }
  return true;
}

/**
 * Validates an NVSRect: all fields in [0..1] and x+w ≤ 1, y+h ≤ 1.
 * Emits console.error in development for each violation found.
 */
export function validateNVSRect(rect: NVSRect, context: string): boolean {
  let ok = true;
  ok = validateNVSScalar(rect.x, 'x', context) && ok;
  ok = validateNVSScalar(rect.y, 'y', context) && ok;
  ok = validateNVSScalar(rect.w, 'w', context) && ok;
  ok = validateNVSScalar(rect.h, 'h', context) && ok;
  if (rect.x + rect.w > 1.0001) {
    console.error(`[NVS] ${context}: x+w = ${rect.x + rect.w} exceeds 1.`);
    ok = false;
  }
  if (rect.y + rect.h > 1.0001) {
    console.error(`[NVS] ${context}: y+h = ${rect.y + rect.h} exceeds 1.`);
    ok = false;
  }
  return ok;
}

/**
 * Validates a position [x, y, z]. Only x and y are NVS [0..1]; z is world-space.
 */
export function validateNVSPosition(
  pos: readonly [number, number, number],
  context: string,
): boolean {
  return (
    validateNVSScalar(pos[0], 'x', context) &&
    validateNVSScalar(pos[1], 'y', context)
  );
}
```

Export from `packages/core/src/layout/index.ts`.

---

## 4. Core Package Changes

### 4.1 `RuntimeDriverImpl` — inject NVSCoordService

**File:** `packages/core/src/runtime/RuntimeDriverImpl.ts`

In `initialize()`, store viewport dimensions as `this.viewportWidth` / `this.viewportHeight`
(currently done via a separate `setViewportSize()` call — confirm this already exists;
if not, add it).

In `tick()`, before dispatching `apply()` to renderables, compute and attach the service:

```typescript
// Compute visibleWorldHeight from live camera
const cam = this.camera;
const fovRad = THREE.MathUtils.degToRad(cam.fov);
const targetZ = 0; // default look-at plane
const cameraDistance = cam.position.z - targetZ;
const visibleWorldHeight = 2 * cameraDistance * Math.tan(fovRad / 2);
const canvasAspect = this.viewportWidth / Math.max(1, this.viewportHeight);
const visibleWorldWidth = visibleWorldHeight * canvasAspect;

const coordService: NVSCoordService = {
  toWorld: (nvsX, nvsY, z = 0) =>
    nvsToWorldWithCamera(nvsX, nvsY, cam, z),
  toWorldSize: (nvsW, nvsH) =>
    [nvsW * visibleWorldWidth, nvsH * visibleWorldHeight] as const,
  canvasAspect,
  visibleWorldHeight,
  visibleWorldWidth,
  viewportWidth: this.viewportWidth,
  viewportHeight: this.viewportHeight,
};
```

Pass `coordService` through the `WidgetRenderContext` constructed for each `apply()` call.

The `RuntimeDriverImpl` must already have access to `this.camera` (the shared main
camera). If it currently receives this in `initialize()`, store it as `this.camera`.
`viewportWidth` / `viewportHeight` are set via `setViewportSize(w, h)` called from
`useSceneEngine` ResizeObserver. These fields must be stored on the driver instance.

**Camera orientation constraint (document in JSDoc on `NVSCoordService`):**
`toWorld()` and `toWorldSize()` give exact results only when the camera is positioned on
the Z-axis looking straight toward `[0, 0, 0]` — i.e., `camera.position = [cx, cy, cameraZ]`
with no X/Y tilt and `camera.lookAt([cx, cy, 0])`. This is guaranteed for `mode="nvsViewport"`.

For orbit-mode cameras pointed at an angle, `toWorld(0.5, 0.5)` still maps correctly to
the camera's look-at point (the NVS center), but `toWorld(0, 0)` and `toWorld(1, 1)` are
approximate — the NVS grid is projected onto `z=0` as if the camera were axis-aligned. The
error grows with camera tilt angle and distance from center. For typical presentation scenes
with shallow-angle cameras this is imperceptible. For extreme camera angles, authors should
use world-space positioning instead of NVS.

Add this constraint as a `@remarks` block on `NVSCoordService.toWorld()` in `widget/types.ts`.

### 4.2 Camera element — add `mode="nvsViewport"`

This mode provides a principled, NVS-aligned camera setup. The author declares two
independent parameters; the engine derives all camera primitives from them.

**DSL:**
```tsx
<Camera
  mode="nvsViewport"
  worldScale={10}    // NVS [0..1] height = worldScale world units. Default: 10.
  zRange={5}         // Visible Z from z=-(zRange/2) to z=+(zRange/2). Default: worldScale/2.
/>
```

**Parameters:**

| Prop | Type | Default | Meaning |
|---|---|---|---|
| `worldScale` | `number` | `10` | How many world units the NVS vertical span [0..1] covers at `z=0`. Controls world scale and camera distance. |
| `zRange` | `number` | `worldScale / 2` | Total visible Z depth, centered on `z=0`. Content from `z = -(zRange/2)` to `z = +(zRange/2)` is visible. |

**Derived camera values (FOV fixed at 45°):**

```
cameraZ     = worldScale / (2 × tan(22.5°))   ≈ worldScale × 1.2071
near        = max(0.01,  cameraZ − zRange / 2)
far         = cameraZ + zRange / 2
position    = [0, 0, cameraZ]
target      = [0, 0, 0]
fov         = 45
```

**Example with defaults (`worldScale=10, zRange=5`):**
- `cameraZ ≈ 12.07`, `near ≈ 9.57`, `far ≈ 14.57`
- `visibleWorldHeight = 10`, `visibleWorldWidth ≈ 17.78` (at 16:9)
- Visible Z range: `z ∈ [-2.5, +2.5]`
- `NVS[0.5, 0.5]` → `world[0, 0, 0]` ✓

**Example with deeper Z (`worldScale=10, zRange=20`):**
- `near ≈ 2.07`, `far ≈ 22.07`
- Visible Z range: `z ∈ [-10, +10]` — suitable for deep diagram stacks

**Degenerate input handling (required in compile.ts):**

The `nvsViewport` compile case MUST guard against inputs that produce mathematically
invalid camera parameters. The following checks run unconditionally (not just in dev):

```typescript
// Guard: worldScale must be positive and finite
if (!Number.isFinite(worldScale) || worldScale <= 0) {
  console.error(
    `[Camera mode="nvsViewport"] worldScale must be a positive finite number, ` +
    `got ${worldScale}. Falling back to default worldScale=10.`,
  );
  worldScale = 10;
}

// Guard: zRange must be positive and finite
if (!Number.isFinite(resolvedZRange) || resolvedZRange <= 0) {
  console.error(
    `[Camera mode="nvsViewport"] zRange must be a positive finite number, ` +
    `got ${resolvedZRange}. Falling back to zRange=worldScale/2.`,
  );
  resolvedZRange = worldScale / 2;
}

// Guard: zRange > 2 * cameraZ means near would go negative — the camera is inside
// its own near plane. Clamp near to 0.01 (this is already in the formula above),
// but also warn the author so they understand the scene is clipping geometry.
const cameraZ = worldScale * 1.2071;
if (resolvedZRange > 2 * cameraZ) {
  console.warn(
    `[Camera mode="nvsViewport"] zRange=${resolvedZRange} exceeds 2 × cameraZ ` +
    `(${(2 * cameraZ).toFixed(2)}). near will be clamped to 0.01; ` +
    `front geometry (z > ${(cameraZ - 0.01).toFixed(2)}) will be clipped.`,
  );
}
```

These guards make the camera self-healing for accidental zero/negative inputs without
silently producing an invisible or inverted scene.

**File:** `packages/core/src/elements/camera/types.ts`

Add `'nvsViewport'` to `CameraMode`. Add `worldScale?: number` and `zRange?: number`
to the camera DSL props. Both are optional; defaults applied in compile step.

**File:** `packages/core/src/elements/camera/compile.ts`

Add `nvsViewport` case. Compile to a `CameraState` with `mode: 'world'` and the derived
values above. Example output for defaults:
```typescript
{
  mode: 'world',
  position: [0, 0, 12.07],
  target: [0, 0, 0],
  fov: 45,
  near: 0.01,
  far: 14.57,
}
```
The `nvsViewport` mode is fully resolved at compile time. The resulting `CameraState`
is identical in shape to a `mode="world"` state — no special runtime handling needed.

**File:** `packages/core/src/elements/camera/render.ts` (or `CameraWidget.ts`)

No changes needed: `nvsViewport` is already compiled to `mode="world"` before reaching
the render layer.

### 4.3 Remove `IExtraRenderPass` from `WidgetRegistry`

**File:** `packages/core/src/widget/WidgetRegistry.ts`

`getExtraRenderPassWidgets()` is currently called by `useSceneEngine` after the main
render pass. After DiagramCanvas removal this method will return an empty array on every
call. **Keep the interface and method in place** (do not remove) so that any future
widget that needs a post-render pass can still implement it without a breaking SDK
change. Add a JSDoc note: "Currently unused after DiagramCanvas removal (v2.x). Reserved
for future post-processing widgets."

Remove the `IExtraRenderPass` iteration from `useSceneEngine` if and only if no widget
registers it after this plan is complete. This is a cleanup step, not a blocking
requirement. Document as DEBT if deferred.

### 4.4 `nvsValidation.ts` — new file (per §3.2)

Add `validateNVSScalar`, `validateNVSRect`, `validateNVSPosition` to
`packages/core/src/layout/nvsValidation.ts` and export from
`packages/core/src/layout/index.ts`.

---

## 5. Diagram Package Changes

### 5.1 Remove `elements/diagram/canvas/` entirely

**Delete the following files:**
```
packages/diagram/src/elements/diagram/canvas/widget.ts
packages/diagram/src/elements/diagram/canvas/compile.ts
packages/diagram/src/elements/diagram/canvas/render.ts
packages/diagram/src/elements/diagram/canvas/types.ts
packages/diagram/src/elements/diagram/canvas/dsl.tsx
packages/diagram/src/elements/diagram/canvas/index.ts
packages/diagram/src/elements/diagram/canvas/compiler/pipeRouter.ts
packages/diagram/src/elements/diagram/canvas/compiler/  (directory)
```

**Delete the following types** (from whichever file they live in):
- `DiagramCanvasState`
- `DiagramCanvasDSL`
- `DiagramCanvasProps`
- `DiagramPipeState`
- `DiagramPipeDSL`
- `DiagramPipeProps`
- `PipeRoutingAlgorithm`
- `PipeLandingAlgorithm`
- `DiagramPipeDSL`

**Remove from public exports:**
- `packages/diagram/src/index.ts`: remove all `DiagramCanvas`, `DiagramPipe`, and
  canvas-related exports
- `packages/diagram/src/register.ts`: remove canvas handler registration call if separate

### 5.2 Update `DiagramState` to be the top-level widget state

**File:** `packages/diagram/src/elements/diagram/types.ts`

`DiagramState` currently has:
```typescript
viewportBounds: NVSRect;    // already correct — stays as the diagram's NVS region
tiltRotation: readonly [number, number, number];  // stays
```

**Add to `DiagramState`:**
```typescript
/**
 * World-space Z depth for the diagram's geometry plane. Default: 0.
 * Allows diagrams to be composited in front of or behind other scene elements.
 */
z: number;

/**
 * World-space scale multiplier applied to the geometry group. Default: 1.
 * Scales geometry after NVS → world conversion; does not affect NVS positions.
 */
scale: number;

/**
 * Camera-framing padding applied by the scene author. Default: 0.
 * Deprecated concept: this is now author responsibility via <Camera>. Remove entirely.
 */
// REMOVED: padding was only meaningful for DiagramCanvas auto-fit
```

**Remove from `DiagramState`:**
- `padding` — was auto-fit camera concept, no longer relevant
- Any canvas-level fields that were merged into DiagramState (check for any `canvasId` refs)

**`DiagramState` must also carry the interaction callback fields** previously on
`DiagramCanvasState`, for use by `DiagramWidget`'s click/hover handlers:
```typescript
/** Optional callback fired when a node is clicked. Assign after construction. */
onInteraction?: (event: DiagramInteractionEvent) => void;
```
This is set directly on the widget instance after construction (not part of compiled
state) — pattern unchanged from `DiagramCanvasWidget.onInteraction`.

### 5.3 Update `DiagramDSL` type and `<Diagram>` props

**File:** `packages/diagram/src/elements/diagram/types.ts`

Add `x/y/w/h/tilt/z/scale` to the `DiagramDSL` type. **Remove `viewportBounds`** — it is
replaced by `x/y/w/h` as the canonical authored form, so the two must not coexist:

```typescript
export type DiagramDSL = {
  readonly id: string;
  /** NVS left edge [0..1]. Default: 0. Replaces legacy viewportBounds.x. */
  readonly x?: number;
  /** NVS top edge [0..1]. Default: 0. Replaces legacy viewportBounds.y. */
  readonly y?: number;
  /** NVS width [0..1]. Default: 1. Replaces legacy viewportBounds.w. */
  readonly w?: number;
  /** NVS height [0..1]. Default: 1. Replaces legacy viewportBounds.h. */
  readonly h?: number;
  /** Pitch tilt in radians applied to diagram geometry group. Default: 0. */
  readonly tilt?: number;
  /** World-space Z depth of the diagram's geometry plane. Default: 0. */
  readonly z?: number;
  /** World-space geometry scale multiplier. Default: 1. */
  readonly scale?: number;
  // REMOVED: viewportBounds — use x/y/w/h props instead
  // REMOVED: tilt as Vec3 — now a scalar (pitch only). Y and Z rotation unsupported.
  readonly layout?: LayoutDSL;
  readonly nodes: readonly DiagramNodeDSL[];
  readonly edges: readonly DiagramEdgeDSL[];
  readonly groups: readonly DiagramGroupDSL[];
  readonly childrenOrder?: readonly string[];
  readonly exit?: DiagramExitDSL;
  readonly enter?: DiagramEnterDSL;
  readonly theme?: DiagramTheme;
};
```

**File:** `packages/diagram/src/elements/diagram/dsl.tsx`

Update `DiagramProps` to match:

```typescript
export interface DiagramProps {
  id: string;
  /** NVS left edge [0..1]. Default: 0. */
  x?: number;
  /** NVS top edge [0..1]. Default: 0. */
  y?: number;
  /** NVS width [0..1]. Default: 1. */
  w?: number;
  /** NVS height [0..1]. Default: 1. */
  h?: number;
  /** Pitch tilt in radians applied to diagram geometry. Default: 0. */
  tilt?: number;
  /** World-space Z depth of the diagram plane. Default: 0. */
  z?: number;
  /** World-space geometry scale. Default: 1. */
  scale?: number;
  /** Theme for nodes, edges, groups. */
  theme?: DiagramTheme;
  children?: ReactNode;
}
```

These props were previously on `<DiagramCanvas>`. The `<Diagram>` DSL used to have
`viewportBounds` (NVSRect) as a prop — that field is removed; authors now write
`x/y/w/h` directly. Any existing scene file using `viewportBounds={...}` on a Diagram
must be migrated to the `x/y/w/h` form.

**`DiagramDSL.tilt` is a scalar (pitch only).** The old `DiagramState.tiltRotation` was
a `readonly [number, number, number]` Vec3. The compile step sets
`tiltRotation: [dsl.tilt ?? 0, 0, 0]` — Y and Z rotation are not supported and were never
meaningfully used. `DiagramState.tiltRotation` stays as Vec3 for render compatibility; the
DSL surface exposes only the pitch scalar.

### 5.4 Update `compileDiagram` to emit validated NVS bounds

**File:** `packages/diagram/src/elements/diagram/compile.ts`

In `compileDiagram()`, the `dsl.viewportBounds` field (previously set from
`DiagramCanvas.x/y/w/h`) now comes from the Diagram's own `x/y/w/h` props.

Add to `compileDiagram()` output:
```typescript
return {
  id: dsl.id,
  viewportBounds: {
    x: dsl.x ?? 0,
    y: dsl.y ?? 0,
    w: dsl.w ?? 1,
    h: dsl.h ?? 1,
  },
  z: dsl.z ?? 0,
  scale: dsl.scale ?? 1,
  tiltRotation: [dsl.tilt ?? 0, 0, 0],
  nodes,
  edges,
  groups,
  exit: compileExitConfig(dsl.exit),
  enter: compileEnterConfig(dsl.enter),
  themeConfig: buildThemeRenderConfig(theme),
};
```

Add compile-time NVS validation:
```typescript
import { validateNVSRect } from '@brewsite/core';

// After computing viewportBounds:
if (process.env.NODE_ENV !== 'production') {
  validateNVSRect(viewportBounds, `<Diagram id="${dsl.id}">`);
}

// After normalizeToViewport, validate sampled node positions:
if (process.env.NODE_ENV !== 'production') {
  for (const node of nodes) {
    validateNVSPosition(node.position, `<Diagram id="${dsl.id}"> node "${node.id}"`);
  }
}
```

Edge control points: validate that all control points' x/y are in [0..1] after routing:
```typescript
if (process.env.NODE_ENV !== 'production') {
  for (const edge of edges) {
    for (const pt of edge.controlPoints) {
      if (pt[0] < -0.05 || pt[0] > 1.05 || pt[1] < -0.05 || pt[1] > 1.05) {
        console.warn(
          `[NVS] <Diagram id="${dsl.id}"> edge "${edge.id}" has control point ` +
          `[${pt[0].toFixed(3)}, ${pt[1].toFixed(3)}] outside [0..1]. ` +
          `Edge may render outside viewportBounds.`,
        );
      }
    }
  }
}
```

Note: edge control points use a warning (not error) with a small tolerance because
CatmullRom arcs can legitimately overshoot by a small amount.

### 5.5 Update `DiagramWidget` to render in main scene

**File:** `packages/diagram/src/elements/diagram/widget.ts`

> **NOTE — working-tree state:** `packages/diagram/src/elements/diagram/canvas/widget.ts`
> has unstaged changes in the working tree at the time this plan was written (visible in
> `git status`). The implementing bot MUST run `git diff packages/diagram/src/elements/diagram/canvas/widget.ts`
> before deleting the canvas directory (§5.1) to confirm the changes are either already
> superseded by this plan's deletions, or to salvage any useful logic before the file is
> removed. Do not `git checkout` or discard working-tree changes without reviewing them.

`DiagramWidget` is the widget class for the `<Diagram>` DSL element. It replaces
`DiagramCanvasWidget` as the top-level diagram widget. Currently there may be a
`DiagramWidget` that wraps compilation but doesn't render — this becomes the full widget.

**Interfaces implemented:**
```typescript
export class DiagramWidget implements
  ISceneElement<DiagramState>,
  IRenderable<DiagramState>,
  INVSBounded
```

Note: `IExtraRenderPass` is NOT implemented (no private scene). `ILoadable` is NOT
implemented unless icon/env-map loading is moved here (see §5.6).

**Constructor:** `constructor(widgetId: string, defaultState: DiagramState)`

**Private fields:**
```typescript
private scene: THREE.Scene | null = null;
private mainCamera: THREE.PerspectiveCamera | null = null;
private canvasElement: HTMLCanvasElement | null = null;
private diagramGroup: THREE.Group | null = null;
private lastState: DiagramState | null = null;
private readonly raycaster = new THREE.Raycaster();
private readonly ndc = new THREE.Vector2();
private clickHandler: ((e: MouseEvent) => void) | null = null;
private mouseMoveHandler: ((e: MouseEvent) => void) | null = null;
private mouseLeaveHandler: (() => void) | null = null;
public onInteraction: ((event: DiagramInteractionEvent) => void) | undefined;
```

**`initialize(context: WidgetInitContext)`:**
- Store `context.scene` as `this.scene`
- Store `context.camera` as `this.mainCamera` — used for raycasting
- Do NOT create a private scene or private camera
- Create the Three.js group that will hold diagram geometry:
  ```typescript
  this.diagramGroup = new THREE.Group();
  this.diagramGroup.name = `diagram:${this.widgetId}`;
  context.scene.add(this.diagramGroup);
  ```
- Store `context.renderer?.domElement` and register DOM event listeners (see §5.5b)
- Call `this.renderer.initialize(context.renderer)` to let DiagramRenderer load env maps

**`apply(state: DiagramState, context: WidgetRenderContext)`:**

Dev-mode validation:
```typescript
if (process.env.NODE_ENV !== 'production') {
  validateNVSRect(state.viewportBounds, `DiagramWidget(${this.widgetId})`);
}
```

Compute the group's world-space anchor point (center of viewportBounds):
```typescript
const cx = state.viewportBounds.x + state.viewportBounds.w / 2;
const cy = state.viewportBounds.y + state.viewportBounds.h / 2;
const [worldCX, worldCY, worldCZ] = context.coords.toWorld(cx, cy, state.z);
```

Apply tilt and scale to the group:
```typescript
this.diagramGroup.position.set(worldCX, worldCY, worldCZ);
this.diagramGroup.rotation.set(state.tiltRotation[0], state.tiltRotation[1], state.tiltRotation[2]);
this.diagramGroup.scale.setScalar(state.scale);
```

Pass state and coord service to the renderer:
```typescript
this.renderer.update(state, this.diagramGroup, context.coords);
```

**`mergeSnapshot(prev, next)`:**

Port directly from `DiagramCanvasWidget.mergeSnapshot()`. The ghost-node merge carries
forward `label`, `sublabel`, `shape`, `iconUrl`, `iconScale`, `sublabelColor`, `position`,
`size`, and `thickness` from the previous state for nodes that have an empty label or
`positionInherited=true` in the incoming state. This is what prevents nodes from
vanishing or resetting during cross-scene transitions.

`DiagramWidget` operates on a single `DiagramState` (not a `DiagramCanvasState` with a
`diagrams[]` array), so the merge logic simplifies to operating on `state.nodes` directly:

```typescript
mergeSnapshot(
  prev: DiagramState | undefined,
  next: DiagramState | undefined,
): DiagramState | undefined {
  if (!next || !prev) return next;
  let anyChanged = false;
  const mergedNodes = next.nodes.map((node): DiagramNodeState => {
    if (node.label !== undefined && !node.positionInherited) return node;
    const prevNode = prev.nodes.find((p) => p.id === node.id);
    if (!prevNode) return node;
    anyChanged = true;
    return {
      ...node,
      label:         node.label !== undefined ? node.label         : prevNode.label,
      sublabel:      node.label !== undefined ? node.sublabel      : prevNode.sublabel,
      shape:         node.label !== undefined ? node.shape         : prevNode.shape,
      iconUrl:       node.label !== undefined ? node.iconUrl       : prevNode.iconUrl,
      iconScale:     node.label !== undefined ? node.iconScale     : prevNode.iconScale,
      sublabelColor: node.label !== undefined ? node.sublabelColor : prevNode.sublabelColor,
      position:  node.positionInherited ? prevNode.position  : node.position,
      size:      node.positionInherited ? prevNode.size      : node.size,
      thickness: node.positionInherited ? prevNode.thickness : node.thickness,
      positionInherited: undefined,
    };
  });
  return anyChanged ? { ...next, nodes: mergedNodes } : next;
}
```

**`dispose()`:**
```typescript
// Remove DOM event listeners
if (this.canvasElement) {
  this.canvasElement.removeEventListener('click', this.clickHandler!);
  this.canvasElement.removeEventListener('mousemove', this.mouseMoveHandler!);
  this.canvasElement.removeEventListener('mouseleave', this.mouseLeaveHandler!);
  this.canvasElement = null;
}
this.scene?.remove(this.diagramGroup!);
this.renderer.dispose(this.widgetId, this.diagramGroup!);
this.diagramGroup = null;
this.scene = null;
this.mainCamera = null;
this.lastState = null;
clearDiagramFocusRegion(this.widgetId);
```

**`get nvsBounds()`:**
```typescript
return this.lastState?.viewportBounds ?? this.defaultState.viewportBounds;
```

### 5.5b `DiagramWidget` — ILoadable / EnvMapManager

**File:** `packages/diagram/src/elements/diagram/widget.ts`

`DiagramWidget` implements `ILoadable` to load the HDR environment map used for PBR
node materials. The `EnvMapManager` (currently owned by `DiagramRenderer`) must be
initialized with a renderer instance.

**Add `ILoadable` to the interface list:**
```typescript
export class DiagramWidget implements
  ISceneElement<DiagramState>,
  IRenderable<DiagramState>,
  ILoadable,
  INVSBounded
```

**`load(manifest: AssetManifest | null): Promise<void>`:**
```typescript
async load(manifest: AssetManifest | null): Promise<void> {
  await this.renderer.loadEnvMap(manifest);
}

get isLoaded(): boolean {
  return this.renderer.isEnvMapLoaded;
}
```

**`DiagramRenderer` changes for env map:**

Add `initialize(renderer: THREE.WebGLRenderer | undefined): void` — stores the renderer
reference for `EnvMapManager`. Add `loadEnvMap(manifest): Promise<void>` — triggers the
existing `EnvMapManager.load()` call with the stored renderer. Add `get isEnvMapLoaded`
accessor. These are the same operations currently performed inside `DiagramCanvasWidget`
at initialization time, just surfaced through `ILoadable` so the engine can track them
via `assetsReady`.

### 5.5c `DiagramWidget` — Interaction (click, hover, raycasting)

**File:** `packages/diagram/src/elements/diagram/widget.ts`

`DiagramWidget` handles click and hover interactions by raycasting against the diagram
geometry in the **main scene** using the **main camera**. This replaces the private-scene
raycasting in `DiagramCanvasWidget`.

**Key differences from `DiagramCanvasWidget`:**
- Uses `this.mainCamera` (stored from `WidgetInitContext.camera`) instead of private camera
- NDC is computed from the full viewport (not a sub-region), then intersected against
  `this.diagramGroup` children — the main camera's frustum already applies
- No `computeNdcForNvs()` offset needed; standard full-viewport NDC computation

**DOM event registration (in `initialize()`):**
```typescript
if (context.renderer?.domElement) {
  this.canvasElement = context.renderer.domElement;
  this.clickHandler = (e) => this.handleClick(e);
  this.mouseMoveHandler = (e) => this.handleMouseMove(e);
  this.mouseLeaveHandler = () => this.clearHover();
  this.canvasElement.addEventListener('click', this.clickHandler);
  this.canvasElement.addEventListener('mousemove', this.mouseMoveHandler);
  this.canvasElement.addEventListener('mouseleave', this.mouseLeaveHandler);
}
```

**NDC computation for main viewport:**
```typescript
private computeNdc(clientX: number, clientY: number): void {
  if (!this.canvasElement) return;
  const rect = this.canvasElement.getBoundingClientRect();
  this.ndc.set(
    ((clientX - rect.left) / rect.width) * 2 - 1,
    -((clientY - rect.top) / rect.height) * 2 + 1,
  );
}
```

**`handleClick`, `handleMouseMove`, `clearHover`:** Port directly from
`DiagramCanvasWidget`, replacing all `this.diagramScene` references with
`this.diagramGroup`, and `this.privateCamera` with `this.mainCamera`. The raycaster
intersects `this.renderer.getInteractionMeshes()` and
`this.renderer.getGroupInteractionMeshes()` which are children of `this.diagramGroup`.

**`onInteraction` callback:** Public field on the widget instance, identical pattern to
`DiagramCanvasWidget.onInteraction`. Fired on click for registered node meshes.

**Hover / emissive overrides:** Port `setNodeEmissiveOverride`, `setGroupNodesEmissive`,
`createHoverControls`, `transitionHover`, `buildGroupPath`, `groupDepth`,
`dispatchNodeHover`, `dispatchGroupHover` unchanged — these operate on `DiagramState`
directly and are not camera-dependent.

**`focusRegion`:** `clearDiagramFocusRegion`, `publishDiagramFocusCanvas`,
`publishDiagramFocusGroup` are called with `this.defaultState` (which has type
`DiagramState` instead of `DiagramCanvasState`). These functions must be updated to
accept `DiagramState` instead of `DiagramCanvasState`. Since `DiagramWidget` owns
exactly one diagram (its own ID), `publishDiagramFocusCanvas(this.defaultState)` is
equivalent to focusing the whole diagram; `publishDiagramFocusGroup(this.defaultState,
this.widgetId, groupId)` focuses a group within it.

**`theme.input` / `defaultInputActions`:** The `DiagramCanvasWidget` implemented
`IInputDefaultProvider` to inject orbit/pan/zoom actions from `canvasTheme.input`. These
are dropped. Diagram interaction is now purely click/hover; camera movement is the
responsibility of the scene's `<Camera>` element. Remove `IInputDefaultProvider` from
`DiagramWidget`'s interface list. Remove all `currentInputActions`, `getDefaultInputActions`,
`applyInputMove`, `applyInputRotate`, `handleMove`, `handleRotate`, `handleReset`,
`handleFocus`, `resetInputTransform`, `applyInputFocus`, `focusAll`, `focusMesh` methods.
These were specific to controlling the private camera; none apply to the main-scene model.

### 5.6 Update `DiagramRenderer`

**File:** `packages/diagram/src/elements/diagram/render.ts`

**Remove:**
- `canvasAspect` parameter from `update()` — replaced by `NVSCoordService`
- `setCanvasAspect()` method
- `nodeNvsToCanvasLocal()` function — replaced by coord service calls
- `nodeSizeToCanvasLocal()` function — replaced by coord service calls

**New signature for `update()`:**
```typescript
update(
  state: DiagramState,
  group: THREE.Group,   // the diagram's group in the main scene
  coords: NVSCoordService,
): void
```

**New coordinate conversion logic (replaces `nodeNvsToCanvasLocal`):**

The group is centered at `(cx, cy)` in world-space (NVS center of viewportBounds).
Each node's absolute NVS position:
```typescript
const absNvsX = state.viewportBounds.x + state.viewportBounds.w * nodeNvsX;
const absNvsY = state.viewportBounds.y + state.viewportBounds.h * nodeNvsY;
```

World position of node:
```typescript
const [worldX, worldY, _] = coords.toWorld(absNvsX, absNvsY, state.z);
const groupCenterWorld = coords.toWorld(
  state.viewportBounds.x + state.viewportBounds.w / 2,
  state.viewportBounds.y + state.viewportBounds.h / 2,
  state.z,
);
// Local position within group:
const localX = worldX - groupCenterWorld[0];
const localY = worldY - groupCenterWorld[1];
const localZ = nodeNvsZ;  // z is already world-space depth offset for layering
```

World size of node:
```typescript
const absNvsW = state.viewportBounds.w * nodeNvsW;
const absNvsH = state.viewportBounds.h * nodeNvsH;
const [worldW, worldH] = coords.toWorldSize(absNvsW, absNvsH);
```

Edge control points are converted identically: each `[x, y, z]` in `[0..1]` diagram NVS
is first mapped to absolute NVS (`vp.x + vp.w * x`, `vp.y + vp.h * y`), then to
world via `coords.toWorld()`, then to group-local by subtracting the group center.

**Tilt:** Applied via `this.diagramGroup.rotation` in `DiagramWidget.apply()`. The
DiagramRenderer does NOT apply any additional rotation to the group or to child geometry.

**Dev-mode render validation:**
```typescript
if (process.env.NODE_ENV !== 'production') {
  if (!Number.isFinite(localX) || !Number.isFinite(localY)) {
    console.error(
      `[DiagramRenderer] Non-finite position for node "${node.id}": ` +
      `localX=${localX}, localY=${localY}. ` +
      `Check camera setup and NVS coords.`,
    );
  }
}
```

### 5.7 Update `handlers.ts`

**File:** `packages/diagram/src/compiler/handlers.ts`

**Remove:**
- `registerNode(DiagramCanvas, ...)` handler entirely
- `registerNode(DiagramPipe, ...)` handler entirely
- All imports of canvas types

**Modify `registerNode(Diagram, ...)` handler:**

The `Diagram` handler previously compiled a `DiagramState` and then wrapped it in a
`DiagramCanvasState` via `compileCanvas()`. Now it compiles `DiagramState` directly and
calls `api.setWidgetState(dsl.id, diagramState)`.

```typescript
registerNode(Diagram, (node: ReactElement, api: CompileApi, helpers: CompileHelpers) => {
  const onWarn = makeWarnFn(api);
  const dsl = extractDiagramDSL(node, helpers, onWarn);

  // Warn if theme.input present — input now handled at DiagramWidget level
  if (dsl.theme?.input !== undefined) {
    onWarn('IGNORED_INPUT_CONFIG', `<Diagram id="${dsl.id}">: theme.input is not yet supported on standalone <Diagram>.`);
  }

  const diagramState = compileDiagram(dsl, undefined, onWarn);
  api.setWidgetState(dsl.id, diagramState);
});
```

**Add `x/y/w/h/tilt/z/scale` prop extraction to `extractDiagramDSL()`:**

These were previously on `DiagramCanvas`. They now come from the `<Diagram>` props and
are stored on `DiagramDSL`:
```typescript
return {
  id: String(props.id),
  x: props.x as number | undefined,
  y: props.y as number | undefined,
  w: props.w as number | undefined,
  h: props.h as number | undefined,
  tilt: typeof props.tilt === 'number' ? props.tilt : undefined,
  z: props.z as number | undefined,
  scale: props.scale as number | undefined,
  layout: layoutDSL,
  nodes,
  edges,
  groups,
  childrenOrder,
  exit: exitDSL,
  enter: enterDSL,
  theme,
};
```

### 5.8 Remove `DiagramCanvas` DSL stub

**File:** `packages/diagram/src/elements/diagram/widget.ts` (or wherever DSL stubs live)

Remove:
```typescript
export function DiagramCanvas(_props: DiagramCanvasProps): null { return null; }
export function DiagramPipe(_props: DiagramPipeProps): null { return null; }
```

### 5.9 Update `diagramPlugin`

**File:** `packages/diagram/src/plugin.ts`

`diagramPlugin({ canvases: string[] })` currently creates one `DiagramCanvasWidget` per
declared canvas ID. Replace with `diagramPlugin({ diagrams: string[] })` — creates one
`DiagramWidget` per declared diagram ID.

```typescript
export function diagramPlugin(options: { diagrams: string[] }): WidgetPlugin {
  return {
    register(registry: WidgetRegistry): void {
      for (const id of options.diagrams) {
        const defaultState = makeDefaultDiagramState(id);
        registry.register(new DiagramWidget(id, defaultState));
      }
    },
  };
}

function makeDefaultDiagramState(id: string): DiagramState {
  return {
    id,
    viewportBounds: { x: 0, y: 0, w: 1, h: 1 },
    tiltRotation: [0, 0, 0],
    z: 0,
    scale: 1,
    nodes: [],
    edges: [],
    groups: [],
    exit: undefined,
    enter: undefined,
    themeConfig: buildThemeRenderConfig(darkGlassTheme),
  };
}
```

### 5.10 Remove intermediate `nodeNvsToCanvasLocal` from edgeRouter

**File:** `packages/diagram/src/elements/diagram/compiler/edgeRouter.ts`

The edgeRouter currently operates on normalized NVS positions (after
`normalizeToViewport`). Verify (write test) that all control points output from
`routeEdges()` are in [0..1] diagram-local NVS. If any routing algorithm produces
out-of-bounds control points, clamp them with a warning.

The edgeRouter should have NO knowledge of aspect ratio or world-space. If `aspect` is
currently a parameter anywhere in edgeRouter, remove it.

### 5.11 Transition spec for `DiagramState`

**File:** `packages/diagram/src/elements/diagram/compile.ts`

`functionalDiagramTransitionSpec` currently blends `viewportBounds` and `tiltRotation`.
This is unchanged. `z` and `scale` are added as blendable fields:

```typescript
interpolateFn: (from, to) => (ctx) => {
  const t = ctx.t;
  // ... existing node/edge blending ...
  return {
    ...to,
    z: lerpNum(from.z, to.z, t),
    scale: lerpNum(from.scale, to.scale, t),
    viewportBounds: lerpNVSRect(from.viewportBounds, to.viewportBounds, t),
    tiltRotation: blendVec3(...) ?? to.tiltRotation,
    nodes: [...blended, ...fading],
    edges: [...blendedEdges, ...fadingEdges],
  };
},
```

Remove the `canvasAspect` computation that existed in the old
`functionalDiagramCanvasTransitionSpec`. It does not exist here.

---

## 6. Model Package Changes

### 6.1 `ModelWidget` — use `NVSCoordService`

**File:** `packages/model/src/elements/model/ModelWidget.ts`

**Remove:**
- `private cameraRef: THREE.Camera | null = null;` field
- All assignments to `this.cameraRef` (in `initialize()` and wherever camera is stashed)
- The `nvsToWorldAnalytic(...)` fallback call with hardcoded `12.07, 45, 16/9`

**In `apply(state, context)`:**
```typescript
// Before (remove):
const cam = this.cameraRef ?? undefined;
const worldPos = cam
  ? nvsToWorldWithCamera(state.model.nvsX, state.model.nvsY, cam, state.model.z)
  : nvsToWorldAnalytic(state.model.nvsX, state.model.nvsY, 0, 0, 12.07, 45, 16 / 9, state.model.z);

// After:
const worldPos = context.coords.toWorld(state.model.nvsX, state.model.nvsY, state.model.z);
```

**Dev-mode validation in `apply()`:**
```typescript
if (process.env.NODE_ENV !== 'production') {
  validateNVSScalar(state.model.nvsX, 'nvsX', `ModelWidget(${this.widgetId})`);
  validateNVSScalar(state.model.nvsY, 'nvsY', `ModelWidget(${this.widgetId})`);
}
```

**Model scale:** If model scale currently uses world units, assess whether it should use
an NVS-derived size. Current `scale` is a scalar multiplier — keep it as-is (it's a
relative scale, not an absolute position). Document it clearly.

### 6.2 `ModelWidget.compile.ts` — add NVS validation

**File:** `packages/model/src/elements/model/compile.ts`

After computing `nvsX` and `nvsY` from DSL props, add:
```typescript
if (process.env.NODE_ENV !== 'production') {
  validateNVSScalar(nvsX, 'nvsX', `<Model id="${dsl.id}">`);
  validateNVSScalar(nvsY, 'nvsY', `<Model id="${dsl.id}">`);
  validateNVSRect(nvsBounds, `<Model id="${dsl.id}">`);
}
```

---

## 7. Charts Package Changes

### 7.1 `ChartState.bounds` — convert `width`/`height` to NVS fractions

**File:** `packages/charts/src/elements/chart/types.ts`

Change `bounds.width` and `bounds.height` from world units to NVS fractions [0..1].
`bounds.depth` remains world-space (it is the 3D thickness of bars/geometry, not a
viewport dimension).

**Before:**
```typescript
bounds: { width: 4, height: 3, depth: 0.4 }  // world units
```

**After:**
```typescript
/**
 * Chart geometry dimensions.
 * width: NVS fraction of viewport width [0..1]. Default: nvsBounds.w.
 * height: NVS fraction of viewport height [0..1]. Default: nvsBounds.h.
 * depth: World-space thickness of 3D geometry (bars, areas). Default: 0.4.
 */
bounds: { width: number; height: number; depth: number }
// width ∈ [0..1] (NVS), height ∈ [0..1] (NVS), depth in world units
```

**Default value update in `DEFAULT_CHART_STATE`:**
```typescript
bounds: { width: 1.0, height: 1.0, depth: 0.4 },
```
(Full nvsBounds by default — chart fills its declared NVS region.)

**File:** `packages/charts/src/elements/chart/compile.ts`

Set `bounds.width = dsl.w ?? 1` and `bounds.height = dsl.h ?? 1` — the chart geometry
fills the declared NVS region unless the author overrides it. `bounds.depth` comes from
`dsl.bounds?.depth ?? 0.4`.

Add NVS validation:
```typescript
if (process.env.NODE_ENV !== 'production') {
  validateNVSScalar(state.bounds.width, 'bounds.width', `<Chart id="${dsl.id}">`);
  validateNVSScalar(state.bounds.height, 'bounds.height', `<Chart id="${dsl.id}">`);
  validateNVSRect(nvsBounds, `<Chart id="${dsl.id}">`);
}
```

### 7.2 `ChartWidget` — use `NVSCoordService` and NVS bounds

**File:** `packages/charts/src/elements/chart/ChartWidget.ts`

**Remove:**
- `private cameraRef` stash (if present)
- `nvsToWorldAnalytic(..., 12.07, 45, 16/9, ...)` fallback call

**In `apply(state, context)`:**
```typescript
// Center position from NVS coords:
const [wcx, wcy, wcz] = context.coords.toWorld(state.nvsX, state.nvsY, state.z);

// Geometry size from NVS fractions → world units:
const [worldW, worldH] = context.coords.toWorldSize(state.bounds.width, state.bounds.height);

// Corner position (bottom-left of chart geometry):
const worldPos = [
  wcx - worldW / 2,
  wcy - worldH / 2,
  wcz,
] as const;

// Pass world dimensions to renderer:
const renderInput = {
  ...state,
  bounds: { width: worldW, height: worldH, depth: state.bounds.depth },
  position: worldPos,
};
this.renderer.apply(renderInput, context);
```

The chart renderer receives world-space dimensions and position — it never sees NVS
fractions. The NVS→world conversion is fully contained in `apply()`.

**Dev-mode validation:**
```typescript
if (process.env.NODE_ENV !== 'production') {
  validateNVSScalar(state.nvsX, 'nvsX', `ChartWidget(${this.widgetId})`);
  validateNVSScalar(state.nvsY, 'nvsY', `ChartWidget(${this.widgetId})`);
  validateNVSScalar(state.bounds.width, 'bounds.width', `ChartWidget(${this.widgetId})`);
  validateNVSScalar(state.bounds.height, 'bounds.height', `ChartWidget(${this.widgetId})`);
}
```

### 7.3 Chart transition spec

**File:** `packages/charts/src/elements/chart/compile.ts`

The transition spec currently blends `bounds.width` and `bounds.height` as world-unit
scalars. After the change they are NVS fractions — blending logic is identical (lerp),
no functional change needed. Verify tests pass.

> **Migration note for transition authors:** Any scene that authors `bounds.width` or
> `bounds.height` directly in DSL or transition `enter`/`exit` overrides must reauthor
> those values from world-units to NVS fractions. Example: a chart previously authored
> with `bounds={{ width: 8.89, height: 5 }}` (world units at `worldScale=10`) becomes
> `bounds={{ width: 0.5, height: 0.5 }}` (NVS fractions). The implementing bot must
> search `apps/` for all `bounds={{ width:` usages and migrate them.

### 7.4 Chart DSL `bounds` prop

**File:** `packages/charts/src/elements/chart/types.ts`

Update `ChartDSL.bounds` documentation to clarify that `width` and `height` are NVS
fractions after this plan:
```typescript
readonly bounds?: {
  /** NVS width fraction [0..1]. Default: same as `w` prop (fills nvsBounds). */
  readonly width?: number;
  /** NVS height fraction [0..1]. Default: same as `h` prop (fills nvsBounds). */
  readonly height?: number;
  /** World-space 3D depth of chart geometry. Default: 0.4. */
  readonly depth?: number;
};
```

---

## 7b. Diagram Package — Additional Elements

### 7b.1 `ImagePanel` and `Screen` elements

**Files:**
- `packages/diagram/src/elements/image-panel/`
- `packages/diagram/src/elements/screen/`

Both elements have been read. Their current coordinate spaces are as follows:

**`ImagePanelState` (current, no type changes needed):**
- `nvsX`, `nvsY`: Already NVS [0..1] positions — no change needed.
- `nvsWidth`, `nvsHeight`: Already NVS [0..1] size fractions — no change needed.
- `z`: World-space depth — correct, stays as-is.
- `bezelThickness`: World-space units (border dimension, not a viewport fraction) — stays
  as-is. This is intentional: bezel thickness is a fixed aesthetic dimension, not
  viewport-relative.

**`ScreenState` (current, no type changes needed):**
- `nvsX`, `nvsY`: Already NVS [0..1] — no change needed.
- `nvsWidth`, `nvsHeight`: Already NVS [0..1] — no change needed.
- `z`: World-space depth — stays as-is.
- `bezelThickness`: World-space units — stays as-is (same reasoning as ImagePanel).

**Required changes for both elements (widget layer only):**

Both widgets currently stash a camera reference or use `nvsToWorldWithCamera` /
`nvsToWorldAnalytic` to convert NVS positions to world-space. Replace with
`context.coords`:

**`packages/diagram/src/elements/image-panel/widget.ts`:**
```typescript
// In apply(state, context):
// Remove: this.cameraRef stash and nvsToWorldWithCamera / nvsToWorldAnalytic call
// Add:
const [worldX, worldY] = context.coords.toWorld(state.nvsX, state.nvsY, state.z);
const [worldW, worldH_derived] = context.coords.toWorldSize(state.nvsWidth, state.nvsHeight ?? state.nvsWidth);
// Note: if nvsHeight is undefined, the renderer derives height from image aspect ratio
// at texture-load time — pass worldW to the renderer and let it compute worldH there.
// Pass worldX, worldY, worldW to the renderer as before; do not pass nvsX/nvsY.
```

**`packages/diagram/src/elements/screen/widget.ts`:**
```typescript
// In apply(state, context):
// Remove: this.cameraRef stash and nvsToWorldWithCamera / nvsToWorldAnalytic call
// Add:
const [worldX, worldY] = context.coords.toWorld(state.nvsX, state.nvsY, state.z);
const [worldW, worldH_derived] = context.coords.toWorldSize(state.nvsWidth, state.nvsHeight ?? state.nvsWidth);
// Pass worldX, worldY, worldW, worldH_derived to the renderer.
// The Screen renderer also needs worldW/worldH to size the iframe div in CSS pixels;
// it must convert from world-space back to CSS using context.coords.viewportWidth /
// context.coords.visibleWorldWidth: cssPx = worldW / visibleWorldWidth * viewportWidth
```

**Add compile-time NVS validation to both `compile.ts` files:**

`packages/diagram/src/elements/image-panel/compile.ts`:
```typescript
if (process.env.NODE_ENV !== 'production') {
  validateNVSScalar(nvsX, 'nvsX', `<ImagePanel id="${dsl.id}">`);
  validateNVSScalar(nvsY, 'nvsY', `<ImagePanel id="${dsl.id}">`);
  validateNVSScalar(nvsWidth, 'nvsWidth', `<ImagePanel id="${dsl.id}">`);
  if (nvsHeight !== undefined) {
    validateNVSScalar(nvsHeight, 'nvsHeight', `<ImagePanel id="${dsl.id}">`);
  }
}
```

`packages/diagram/src/elements/screen/compile.ts`:
```typescript
if (process.env.NODE_ENV !== 'production') {
  validateNVSScalar(nvsX, 'nvsX', `<Screen id="${dsl.id}">`);
  validateNVSScalar(nvsY, 'nvsY', `<Screen id="${dsl.id}">`);
  validateNVSScalar(nvsWidth, 'nvsWidth', `<Screen id="${dsl.id}">`);
  if (nvsHeight !== undefined) {
    validateNVSScalar(nvsHeight, 'nvsHeight', `<Screen id="${dsl.id}">`);
  }
}
```

**Add render-time NVS validation in both widget `apply()` methods:**
```typescript
if (process.env.NODE_ENV !== 'production') {
  validateNVSScalar(state.nvsX, 'nvsX', `ImagePanelWidget(${this.widgetId})`);
  validateNVSScalar(state.nvsY, 'nvsY', `ImagePanelWidget(${this.widgetId})`);
  validateNVSScalar(state.nvsWidth, 'nvsWidth', `ImagePanelWidget(${this.widgetId})`);
}
// (analogous for ScreenWidget)
```

### 7b.2 `lucid/` imports — canvas type references

**Status: moot.** The `packages/diagram/src/lucid/` directory does not exist. The Lucid
import utilities have not been implemented yet (or were never part of the published
package). There are no canvas-type references in `lucid/` to migrate.

**Implementing bot action:** Run the grep below as a safety check before deleting the
canvas directory, to ensure no other location has `lucid`-related canvas references:

```bash
grep -r "DiagramCanvas\|DiagramPipe\|canvasId\|DiagramCanvasState" packages/diagram/src/ \
  --include="*.ts" --include="*.tsx" -l
```

If this returns any hits outside the `canvas/` directory itself, fix them before
deletion. If the only hits are within `canvas/` (which will be deleted), no action is
needed.

---

## 7c. Breaking Change and Versioning

This plan makes **semver-major breaking changes** to `@brewsite/core`, `@brewsite/diagram`,
and `@brewsite/charts`. All three packages require a **major version bump** on release.

### Breaking changes by package

**`@brewsite/core`:**

| Change | Impact |
|---|---|
| `WidgetRenderContext` gains required field `coords: NVSCoordService` | Any code constructing a `WidgetRenderContext` literal (e.g., widget unit tests) fails to typecheck |
| `createNVSCoordService()` added to public API | Additive only — no breakage |

**`@brewsite/diagram`:**

| Change | Impact |
|---|---|
| Remove `<DiagramCanvas>` DSL element | All scene files must be migrated |
| Remove `DiagramCanvasState`, `DiagramCanvasDSL` | Any external code importing these types breaks |
| `diagramPlugin({ canvases: [...] })` → `diagramPlugin({ diagrams: [...] })` | All `widgetSetup.ts` files must be updated |
| Remove `<DiagramPipe>` | Cross-diagram pipe scenes must be reauthored |
| `DiagramDSL.viewportBounds` removed | Any direct DSL construction using this field breaks |

**`@brewsite/charts`:**

| Change | Impact |
|---|---|
| `ChartState.bounds.width/height` changed from world-units to NVS fractions [0..1] | Any code computing, asserting, or transitioning `bounds.width/height` as world-units breaks |

### Required MIGRATION.md files

**`packages/diagram/MIGRATION.md`** — document:
- The `<DiagramCanvas>` → `<Diagram>` migration pattern (with before/after code examples matching §8.1)
- The `canvases` → `diagrams` plugin option rename (with before/after matching §8.2)
- The `viewportBounds` → `x/y/w/h` prop migration
- The `<DiagramPipe>` removal and cross-diagram edge deferral (matching §8.3)

**`packages/charts/MIGRATION.md`** — document:
- The `bounds.width` / `bounds.height` semantic change from world-units to NVS fractions
- Migration formula: `nvsWidth = oldWorldWidth / visibleWorldWidth` where `visibleWorldWidth = worldScale * canvasAspect`
- Concrete example: `bounds={{ width: 8.89, height: 5 }}` at `worldScale=10, 16:9` → `bounds={{ width: 0.5, height: 0.5 }}`

Both `MIGRATION.md` files must exist and be non-empty before the plan is marked
complete. Add them to the §10 checklists.

---

## 8. App Updates — `apps/examples`

> **NOTE — partially-modified working tree:** At the time this plan was written, the
> following files already have unstaged changes in the working tree:
>
> - `apps/examples/src/brewflow-comparison/scenes/scene_bf_overview.tsx`
> - `apps/examples/src/brewflow-comparison/scenes/scene_dim1_audit.tsx`
> - `apps/examples/src/brewflow-comparison/scenes/scene_dim2_learning.tsx`
> - `apps/examples/src/brewflow-comparison/scenes/scene_dim3_context.tsx`
> - `apps/examples/src/brewflow-comparison/scenes/scene_dim4_coordination.tsx`
> - `apps/examples/src/brewflow-comparison/scenes/scene_dim5_restart.tsx`
> - `apps/examples/src/brewflow-comparison/scenes/scene_dim6_gating.tsx`
> - `apps/examples/src/brewflow-comparison/scenes/scene_dim7_safety.tsx`
> - `apps/examples/src/brewflow-comparison/scenes/scene_dim8_maturity.tsx`
> - `apps/examples/src/brewflow-comparison/scenes/scene_hero.tsx`
> - `apps/examples/src/brewflow-comparison/scenes/scene_summary.tsx`
>
> The implementing bot **MUST run `git diff apps/` before modifying any app scene file**.
> The existing working-tree changes may partially overlap with this plan's migrations
> (e.g., some `<DiagramCanvas>` may already be removed) or may contain author changes
> unrelated to this plan that must be preserved. Do not blindly apply the migration
> patterns in §8.1–8.4; inspect each file's current state first.

### 8.1 Update all scenes using `<DiagramCanvas>`

**All scene files in `apps/examples/src/` that contain `<DiagramCanvas>` must be
updated.** Run: `grep -rl "DiagramCanvas" apps/` to find them.

**Pattern for every occurrence:**

Before:
```tsx
<DiagramCanvas id="bfc-cf-canvas" x={0} y={0} w={1} h={0.66} tilt={-0.3} scale={1} theme={brewflowTheme}>
  <Diagram id="cf-overview">
    ...
  </Diagram>
</DiagramCanvas>
```

After:
```tsx
<Diagram id="cf-overview" x={0} y={0} w={1} h={0.66} tilt={-0.3} scale={1} theme={brewflowTheme}>
  ...
</Diagram>
```

When a single `<DiagramCanvas>` contained multiple `<Diagram>` children, each `<Diagram>`
gets the canvas-level `x/y/w/h/tilt/scale` props. If child diagrams had their own
`viewportBounds`, those remain on the child. (Note: multiple diagrams per canvas was
used for side-by-side layouts where each Diagram had its own `viewportBounds`.)

### 8.2 Update `widgetSetup.ts` files

**All `widgetSetup.ts` files** that call `diagramPlugin({ canvases: [...] })` must
change to `diagramPlugin({ diagrams: [...] })`.

Before:
```typescript
diagramPlugin({
  canvases: ['bfc-cf-canvas', 'bfc-bf-canvas', 'bfc-audit-canvas'],
})
```

After:
```typescript
diagramPlugin({
  diagrams: ['cf-overview', 'bf-overview', 'audit-cf'],
})
```

The IDs are the `<Diagram id="...">` IDs, not the former canvas IDs.

### 8.3 Remove `DiagramPipe` usages (if any)

Search: `grep -rl "DiagramPipe" apps/`

For each hit, apply the following rule:

- **Within-diagram connection** (`<DiagramPipe>` connects nodes that are both inside
  the same `<Diagram>`): Replace with a manually authored `<DiagramEdge>` inside that
  diagram's `edges` array. The edge routing and styling are specified directly on the
  `<DiagramEdge>` using the existing DSL.

- **Cross-diagram connection** (`<DiagramPipe>` connects nodes in different `<Diagram>`
  elements): Remove the JSX entirely and leave a comment in its place:
  ```tsx
  {/* TODO: cross-diagram pipe — awaiting multi-diagram composition plan */}
  ```
  Do not attempt to manually replicate a cross-diagram edge; the multi-diagram
  composition design is deferred to a future plan (§11).

### 8.4 Camera setup for diagram-only scenes

Scenes that previously relied on DiagramCanvas's auto-fit camera must now configure a
camera explicitly. For scenes showing only diagrams or charts with no 3D models:

```tsx
<Camera mode="nvsViewport" worldScale={10} zRange={5} />
```

`worldScale` controls the world size (NVS [0..1] = `worldScale` world units tall).
`zRange` controls the visible Z depth (content from `z=-(zRange/2)` to `z=+(zRange/2)`
is visible). Both have sensible defaults — `<Camera mode="nvsViewport" />` alone is
valid and uses `worldScale=10, zRange=5`.

For scenes that mix 3D models and diagrams, use an explicit world-space camera that
frames the model content. Diagrams authored in NVS will position correctly because the
`NVSCoordService` uses the live camera at render time, regardless of what mode it was
configured with. Example:
```tsx
<Camera mode="world" position={[0, 1, 8]} target={[0, 1, 0]} fov={35} />
```
In this case diagram nodes at NVS [0.5, 0.5] will appear at the world-center of the
camera's look-at frustum, which may or may not overlap with the model depending on the
scene composition. The author is responsible for ensuring the camera frames both.

---

## 9. Testing Strategy

### 9.1 New tests — `packages/core/src/layout/__tests__/nvsValidation.test.ts`

Test `validateNVSRect`, `validateNVSScalar`, `validateNVSPosition` with in-range and
out-of-range inputs. Assert `console.error` is called for violations. Use `vi.spyOn`.
Test that production build (`NODE_ENV=production`) skips validation.

### 9.2 New tests — `NVSCoordService` construction

**File:** `packages/core/src/runtime/__tests__/nvsCoordService.test.ts`

Construct a mock camera at `[0, 0, 12.07]` with `fov=45`, `aspect=16/9`.
Assert `coordService.toWorld(0.5, 0.5, 0)` returns approximately `[0, 0, 0]`.
Assert `coordService.toWorld(0, 0, 0)` returns approximately `[-8.89, 5, 0]`.
Assert `coordService.toWorldSize(1, 1)` returns approximately `[17.78, 10]`.
Assert `coordService.visibleWorldHeight` is approximately `10`.

### 9.3 New tests — `mode="nvsViewport"` camera compilation

**File:** `packages/core/src/elements/camera/__tests__/compile.test.ts`

For `worldScale=10, zRange=5`:
- Assert compiled `position ≈ [0, 0, 12.07]`
- Assert compiled `fov = 45`
- Assert compiled `near ≈ 9.57` (clamped to 0.01 minimum)
- Assert compiled `far ≈ 14.57`

For `worldScale=5, zRange=2`:
- Assert `cameraZ ≈ 6.035`, `near ≈ 5.035`, `far ≈ 7.035`

Assert that the output `CameraState.mode === 'world'` — nvsViewport is fully resolved
at compile time.

**Degenerate input tests (LOW-1):**

Use `vi.spyOn(console, 'error')` and `vi.spyOn(console, 'warn')` for these:

- `worldScale=0`: Assert `console.error` is called; assert fallback output uses
  `worldScale=10` (non-zero position/near/far).
- `worldScale=-5`: Assert `console.error` is called; assert fallback output is valid.
- `zRange > 2 * cameraZ` (e.g., `worldScale=10, zRange=30`): Assert `console.warn` is
  called with a message mentioning clipping; assert `near` is clamped to `0.01` and
  `far = cameraZ + zRange/2 ≈ 27.07`.
- `worldScale=0.001` (extremely small, effectively zero): Assert `console.error` or
  the output is still a valid (non-Infinity, non-NaN) `CameraState`.

For the degenerate cases, the output CameraState must always be a valid object with
finite numbers — no `Infinity`, `NaN`, or `undefined` values in any field.

### 9.3b Updated tests — `DiagramWidget` rendering

**File:** `packages/diagram/src/elements/diagram/__tests__/diagramWidget.test.ts`

Construct `DiagramWidget` with a test `DiagramState` containing known `viewportBounds`.
Call `initialize()` with a mock scene (use `runtime/mocks/` interface doubles).
Call `apply()` with a mock `WidgetRenderContext` that includes a real `NVSCoordService`
constructed from a known camera.
Assert:
- `diagramGroup.position` matches expected world coords for the viewportBounds center
- `diagramGroup.rotation.x` matches `state.tiltRotation[0]`
- Node meshes are children of the group at the expected local positions

**`dispose()` test (MEDIUM-2):**

In the same test file, add a dispose lifecycle test:
```typescript
it('dispose() removes group from scene and nulls all references', () => {
  const widget = new DiagramWidget('d1', makeDefaultDiagramState('d1'));
  const scene = new THREE.Scene();
  const mockContext = makeWidgetInitContext(scene); // use real THREE.Scene
  widget.initialize(mockContext);
  expect(scene.children).toHaveLength(1); // diagramGroup added

  widget.dispose();
  expect(scene.children).toHaveLength(0); // group removed
  // Calling dispose() a second time must not throw
  expect(() => widget.dispose()).not.toThrow();
});
```

Note: interaction/raycasting tests (`handleClick`, `handleMouseMove`) require DOM event
dispatch on a real `HTMLCanvasElement` and are render-layer concerns. They are **not**
required in this plan's unit test suite. The dispose test above is sufficient to verify
the DOM listener cleanup path runs without error.

### 9.3c `DiagramWidget.mergeSnapshot()` tests

**File:** `packages/diagram/src/elements/diagram/__tests__/diagramWidget.test.ts`

Add the following test cases in a `describe('mergeSnapshot')` block:

```typescript
// (a) prev=undefined: returns next unchanged
it('returns next when prev is undefined', () => {
  const next = makeState(['nodeA']);
  expect(mergeSnapshot(undefined, next)).toBe(next);
});

// (b) next=undefined: returns undefined
it('returns undefined when next is undefined', () => {
  expect(mergeSnapshot(makeState(['nodeA']), undefined)).toBeUndefined();
});

// (c) node with label set and positionInherited=false: node passes through unchanged
it('passes through node with label set and no positionInherited', () => {
  const prev = makeState([{ id: 'n1', label: 'Old', position: [0.2, 0.3, 0] }]);
  const next = makeState([{ id: 'n1', label: 'New', position: [0.5, 0.5, 0] }]);
  const result = mergeSnapshot(prev, next)!;
  expect(result.nodes[0].label).toBe('New');
  expect(result.nodes[0].position[0]).toBe(0.5);
});

// (d) node with label=undefined: inherits label and visual fields from prev
it('inherits label/shape/iconUrl from prev when label is undefined in next', () => {
  const prev = makeState([{ id: 'n1', label: 'Ghost', shape: 'circle' }]);
  const next = makeState([{ id: 'n1', label: undefined }]);
  const result = mergeSnapshot(prev, next)!;
  expect(result.nodes[0].label).toBe('Ghost');
  expect(result.nodes[0].shape).toBe('circle');
});

// (e) node with positionInherited=true: inherits position/size/thickness from prev
it('inherits position/size/thickness from prev when positionInherited=true', () => {
  const prev = makeState([{ id: 'n1', label: 'A', position: [0.1, 0.2, 0], size: [0.3, 0.15] }]);
  const next = makeState([{ id: 'n1', label: 'A', positionInherited: true }]);
  const result = mergeSnapshot(prev, next)!;
  expect(result.nodes[0].position[0]).toBeCloseTo(0.1);
  expect(result.nodes[0].size[0]).toBeCloseTo(0.3);
  expect(result.nodes[0].positionInherited).toBeUndefined();
});

// (f) node not in prev: node passes through from next unchanged
it('passes through next node not found in prev', () => {
  const prev = makeState([]);
  const next = makeState([{ id: 'n-new', label: 'Brand new' }]);
  const result = mergeSnapshot(prev, next)!;
  expect(result.nodes[0].label).toBe('Brand new');
});
```

Helper `makeState()` creates a minimal `DiagramState` with `nodes` set from the given
array, using default values for all other required fields. It must be typed as returning
`DiagramState` (no `any`).

### 9.3d `diagramPlugin` factory test

**File:** `packages/diagram/src/__tests__/plugin.test.ts` *(new file)*

```typescript
import { describe, it, expect } from 'vitest';
import { diagramPlugin } from '../plugin.js';
import { DiagramWidget } from '../elements/diagram/widget.js';
// Use real WidgetRegistry from @brewsite/core
import { WidgetRegistry } from '@brewsite/core';

describe('diagramPlugin', () => {
  it('registers one DiagramWidget per declared diagram ID', () => {
    const registry = new WidgetRegistry();
    const plugin = diagramPlugin({ diagrams: ['id-a', 'id-b'] });
    plugin.register(registry);

    const widgetA = registry.getWidget('id-a');
    const widgetB = registry.getWidget('id-b');

    expect(widgetA).toBeInstanceOf(DiagramWidget);
    expect(widgetB).toBeInstanceOf(DiagramWidget);
    expect(widgetA?.widgetId).toBe('id-a');
    expect(widgetB?.widgetId).toBe('id-b');
  });

  it('registers exactly the declared number of widgets', () => {
    const registry = new WidgetRegistry();
    diagramPlugin({ diagrams: ['x', 'y', 'z'] }).register(registry);
    expect(registry.getAllWidgets()).toHaveLength(3);
  });
});
```

Note: `WidgetRegistry.getWidget(id)` and `WidgetRegistry.getAllWidgets()` must be
accessible. If these methods are not currently public, the test should access registered
widgets via `registry.getWidgetForDslComponent(DiagramWidget.prototype.DslComponent)` or
an equivalent public API. Do not add test-only accessors to `WidgetRegistry`; use the
existing public interface.

### 9.4 Updated tests — `compileDiagram` NVS output

**File:** `packages/diagram/src/elements/diagram/__tests__/compile.test.ts`

Assert that all `DiagramNodeState.position[0]` and `[1]` are in [0..1] for both
auto-layout and manual-layout diagrams. Assert `viewportBounds` is in [0..1].

### 9.5 New tests — `ChartWidget` with NVS bounds

**File:** `packages/charts/src/elements/chart/__tests__/chartWidget.test.ts`

Construct a `ChartWidget` with `state.bounds = { width: 0.5, height: 0.4, depth: 0.4 }`.
Pass a real `NVSCoordService` from a known camera (`worldScale=10`).
Assert:
- `worldW ≈ 0.5 * 17.78 ≈ 8.89`
- `worldH ≈ 0.4 * 10.0 = 4.0`
- Renderer receives `bounds.width ≈ 8.89`, `bounds.height ≈ 4.0`

Assert that `bounds.depth = 0.4` passes through unchanged.

### 9.5b Regression tests — `ModelWidget` with `NVSCoordService`

**File:** `packages/model/src/elements/model/__tests__/modelWidget.test.ts`

Assert that after the camera-stash removal, `ModelWidget.apply()` produces the same
world-position for a given `nvsX/nvsY/z` as the old `nvsToWorldWithCamera()` call
with an equivalent camera. Use the same mock camera in both paths.

### 9.6 Typecheck passes

After all changes: `pnpm typecheck` must pass with zero errors across all packages.

---

## 10. Migration Checklist (for implementing bot)

The implementing bot MUST complete every item before marking this plan complete.

### Core (`packages/core`)
- [ ] Add `NVSCoordService` interface to `widget/types.ts`
- [ ] Add `coords: NVSCoordService` (required) to `WidgetRenderContext`
- [ ] Create `layout/nvsCoordService.ts` with `createNVSCoordService()` factory function (§3.3)
- [ ] Export `createNVSCoordService` from `layout/index.ts`
- [ ] Update `RuntimeDriverImpl.tick()` to call `createNVSCoordService()` and pass result in `WidgetRenderContext`
- [ ] Add `mode="nvsViewport"` with `worldScale` and `zRange` props to camera DSL
- [ ] Implement `nvsViewport` compile case with degenerate-input guards (§4.2) — derives `position`, `near`, `far`, `fov`; outputs `mode="world"` CameraState
- [ ] Confirm no changes needed in camera render/widget (nvsViewport resolved at compile)
- [ ] Create `layout/nvsValidation.ts` with `validateNVSScalar`, `validateNVSRect`, `validateNVSPosition`
- [ ] Export validation functions from `layout/index.ts`
- [ ] Keep `IExtraRenderPass` interface; add DEBT comment about unused status
- [ ] Update all existing test fixtures that construct `WidgetRenderContext` to include a `coords` field (use `createNVSCoordService()`)
- [ ] Tests: `nvsValidation.test.ts`, `nvsCoordService.test.ts`, camera `nvsViewport` compile test (including degenerate input cases from §9.3)
- [ ] `pnpm typecheck` passes

### Diagram (`packages/diagram`) — pre-conditions
- [ ] Run `grep -r "DiagramCanvas\|DiagramPipe\|canvasId\|DiagramCanvasState" packages/diagram/src/ --include="*.ts" --include="*.tsx" -l` and fix any hits outside `canvas/` directory before deleting canvas directory (§7b.2 — `lucid/` directory does not exist; this grep covers all remaining diagram source)
- [ ] Update `ImagePanelWidget` and `ScreenWidget` `apply()` to use `context.coords.toWorld()` / `context.coords.toWorldSize()` instead of camera stash (§7b.1 — no type changes, widget layer only)
- [ ] Add compile-time NVS validation to `image-panel/compile.ts` and `screen/compile.ts` (§7b.1)
- [ ] Add render-time NVS validation to `ImagePanelWidget.apply()` and `ScreenWidget.apply()` (§7b.1)
- [ ] Add `MIGRATION.md` to `packages/diagram/` documenting breaking changes (§7c)

### Diagram (`packages/diagram`) — types and DSL
- [ ] Add `x/y/w/h/tilt/z/scale` to `DiagramDSL` type in `types.ts`; remove `viewportBounds` field from `DiagramDSL`
- [ ] Add `x/y/w/h/tilt/z/scale` to `DiagramProps` in `dsl.tsx`
- [ ] Add `z: number` and `scale: number` to `DiagramState` type; remove `padding`
- [ ] Document `DiagramState.tiltRotation` as Vec3 set from scalar `tilt` (pitch only)
- [ ] Delete `DiagramCanvasState`, `DiagramCanvasDSL`, `DiagramPipeState`, `DiagramPipeDSL` types

### Diagram (`packages/diagram`) — compiler
- [ ] Update `compileDiagram` to read `x/y/w/h/tilt/z/scale` from DSL; emit `viewportBounds`, `z`, `scale` in `DiagramState`
- [ ] Add compile-time `validateNVSRect` for `viewportBounds` in `compileDiagram`
- [ ] Add compile-time node position NVS validation in `compileDiagram`
- [ ] Add edge control point range warning in `compileDiagram`
- [ ] Update `handlers.ts`: remove DiagramCanvas handler, remove DiagramPipe handler, update Diagram handler to call `api.setWidgetState(dsl.id, diagramState)` directly
- [ ] Add `x/y/w/h/tilt/z/scale` prop extraction to `extractDiagramDSL()`; remove `viewportBounds` extraction
- [ ] Verify `edgeRouter` has no `aspect` parameter; confirm all control points are [0..1] NVS (write test)
- [ ] Update `functionalDiagramTransitionSpec` to blend `z` and `scale`

### Diagram (`packages/diagram`) — widget and renderer
- [ ] Create/update `DiagramWidget` class implementing `ISceneElement`, `IRenderable`, `ILoadable`, `INVSBounded`
- [ ] `DiagramWidget.initialize()`: store `scene`, `mainCamera`, `renderer.domElement`; create `diagramGroup`; register DOM event handlers; call `renderer.initialize()`
- [ ] `DiagramWidget.apply()`: compute group world anchor via `coords.toWorld()`; apply tilt+scale to group; validate NVS bounds; pass state+coords to renderer; store `lastState`
- [ ] `DiagramWidget.mergeSnapshot()`: port ghost-node merge from `DiagramCanvasWidget` (§5.5 spec)
- [ ] `DiagramWidget.load()` / `isLoaded`: delegate to `DiagramRenderer.loadEnvMap()` (§5.5b)
- [ ] `DiagramWidget.dispose()`: remove DOM listeners; remove group from scene; call renderer dispose; clear focusRegion
- [ ] `DiagramWidget` interaction (§5.5c): port `handleClick`, `handleMouseMove`, `clearHover`, hover/emissive methods from `DiagramCanvasWidget` using main camera and full-viewport NDC
- [ ] Update `focusRegion` functions to accept `DiagramState` instead of `DiagramCanvasState`
- [ ] Drop `IInputDefaultProvider` and all camera-control methods (`applyInputMove`, `applyInputRotate`, `handleMove`, `handleRotate`, `handleReset`, `handleFocus`, `applyInputFocus`, `focusAll`, `focusMesh`)
- [ ] Update `DiagramRenderer.update()` signature to accept `NVSCoordService`; remove `canvasAspect` param and `setCanvasAspect()` method
- [ ] Replace `nodeNvsToCanvasLocal()` and `nodeSizeToCanvasLocal()` in `render.ts` with `coords.toWorld()` / `coords.toWorldSize()` calls (§5.6 spec)
- [ ] Add `DiagramRenderer.initialize(renderer)` for env map setup; add `loadEnvMap()` and `isEnvMapLoaded` accessor
- [ ] Add render-time NVS validation in `DiagramWidget.apply()`
- [ ] Remove DSL stubs `DiagramCanvas()`, `DiagramPipe()` from `widget.ts`

### Diagram (`packages/diagram`) — plugin and exports
- [ ] Update `diagramPlugin` to accept `{ diagrams: string[] }` instead of `{ canvases: string[] }`
- [ ] Delete `elements/diagram/canvas/` directory and all contents (review `git diff canvas/widget.ts` first per §5.5 note)
- [ ] Update public `index.ts` — remove all canvas/pipe exports
- [ ] Tests: `diagramWidget.test.ts` (apply + dispose per §9.3b), `mergeSnapshot` tests per §9.3c, `diagramPlugin` factory test per §9.3d, updated `compile.test.ts`, edge routing NVS test
- [ ] Migrate `apps/` `bounds.width/height` values from world-units to NVS fractions (§7.3 migration note)
- [ ] `pnpm typecheck` passes

### Model (`packages/model`)
- [ ] Remove `cameraRef` stash from `ModelWidget`
- [ ] Replace `nvsToWorldWithCamera` / `nvsToWorldAnalytic` call in `apply()` with `context.coords.toWorld()`
- [ ] Add NVS validation in `compile.ts`
- [ ] Update tests in `modelWidget.test.ts`
- [ ] `pnpm typecheck` passes

### Charts (`packages/charts`)
- [ ] Change `ChartState.bounds.width` and `.height` to NVS fractions in `types.ts`
- [ ] Update `DEFAULT_CHART_STATE.bounds` to `{ width: 1.0, height: 1.0, depth: 0.4 }`
- [ ] Update `compile.ts` to set `bounds.width = dsl.w ?? 1`, `bounds.height = dsl.h ?? 1`
- [ ] Update `ChartDSL.bounds` JSDoc to document NVS fractions
- [ ] Remove camera stash from `ChartWidget` (if present)
- [ ] Replace `nvsToWorldWithCamera` / `nvsToWorldAnalytic` fallback with `context.coords.toWorld()`
- [ ] Update `ChartWidget.apply()` to convert NVS bounds to world via `coords.toWorldSize()`
- [ ] Pass world-space dimensions to renderer (not NVS fractions)
- [ ] Add NVS validation in `compile.ts` and `apply()`
- [ ] Verify chart transition spec still blends correctly (values are now [0..1] instead of world-scale)
- [ ] Create `packages/charts/MIGRATION.md` documenting the `bounds.width/height` semantic change (§7c)
- [ ] Tests: `chartWidget.test.ts` with NVS bounds
- [ ] `pnpm typecheck` passes

### Apps (`apps/examples`)
- [ ] Run `git diff apps/` to review all 11 partially-modified scene files before applying migrations (§8 preamble — do not overwrite in-progress changes)
- [ ] Replace every `<DiagramCanvas>` with inline `<Diagram>` props (move x/y/w/h/tilt/scale to Diagram)
- [ ] Update all `widgetSetup.ts`: `canvases: [...]` → `diagrams: [...]` using `<Diagram id>` values
- [ ] For `<DiagramPipe>` usages: replace within-diagram connections with `<DiagramEdge>`; remove cross-diagram usages with `{/* TODO: cross-diagram pipe — awaiting multi-diagram composition plan */}` comment (§8.3)
- [ ] Add `<Camera mode="nvsViewport" />` to all diagram-only and chart-only scenes
- [ ] Verify scenes that mix models + diagrams still frame correctly with existing world-space camera
- [ ] `pnpm dev` runs without console errors for coordinate violations

---

## 11. Out of Scope (Deferred)

- **Cross-diagram pipes / cross-diagram edges:** `DiagramPipe` is removed. Cross-diagram
  connections are manually authored as `DiagramEdge` within a single diagram, or deferred
  to a future plan that redesigns multi-diagram composition. Multiple independent `<Diagram>`
  siblings in the same scene are fully supported — cross-diagram _connections_ are what
  is deferred.
- **Floor / Lighting NVS migration:** These remain world-space. NVS equivalents (e.g.,
  `nvsFloor`, `nvsLight`) are a future authoring-DX plan.
- **Branded `NVSCoord` TypeScript type:** As assessed in prior audit, the cost outweighs
  the benefit until the authoring API stabilizes. Deferred.
- **Dynamic diagram registration** (compiler auto-discovers `<Diagram>` IDs without
  explicit `diagramPlugin({ diagrams: [...] })` declaration): Deferred as a DX improvement.
- **`mode="nvsViewport"` on orthographic camera:** The current implementation uses a
  perspective camera at a computed distance. A true orthographic camera would eliminate
  any Z-depth perspective distortion for diagram/chart content. This is a future option
  if authors find the perspective distortion objectionable in practice.
- **`NVSCoordService` exact mapping for angled cameras:** `toWorld()` is exact only when
  the camera looks straight along -Z. For orbit/tilted cameras the NVS center maps
  correctly but edge positions are approximate. Improving this requires projecting NVS
  corners through the actual view frustum — deferred until a concrete need arises.
- **`applyInputFocus` / camera-level diagram focus via input actions:** Removed with
  `IInputDefaultProvider`. If diagram zoom/pan via scroll or drag is required in future,
  it should be implemented as a dedicated `<Camera mode="diagramFocus">` DSL concept
  rather than per-diagram camera controls.
