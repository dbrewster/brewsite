---
title: "DiagramCanvas NVS Model"
doc_type: prd
status: deprecated
owner: Toolkit Product
last_updated: 2026-03-09
change_history:
  - date: 2026-03-09
    author: "Toolkit Product"
    summary: "DEPRECATED: Superseded by the NVS Universal Coordinate System implementation. DiagramCanvas has been removed from @brewsite/diagram. This draft document's scissored sub-viewport model was an intermediate design step; the final implementation places diagrams directly in the main scene via DiagramWidget + NVSCoordService."
  - date: 2026-03-08
    author: "Toolkit Product (PM-1 + PM-2)"
    summary: "Initial PRD created from note_diagram-canvas-camera-model.md. Defines clean-break redesign: NVS-primary placement, scissored sub-viewport rendering, private perspective camera with auto-fit, removal of position/rotation in favor of tilt + nvsBounds. Two product stances confirmed: fixed render order (main scene first, diagrams on top), pan clipped at NVS boundary."
---

# DiagramCanvas NVS Model

## 1. Overview

This PRD redesigns the placement and rendering model for `DiagramCanvas` in `@brewsite/diagram`. The current model uses a hidden camera takeover that overrides the scene `Camera` widget, exposing a confusing dual-API of 3D world-space transforms (`position`, `rotation`, `scale`) alongside NVS viewport bounds (`x`, `y`, `w`, `h`) that do not compose coherently.

The new model makes `DiagramCanvas` NVS-primary: its `{x, y, w, h}` bounds are the sole placement authority, matching the contract of `TextBox` and `Hud`. The diagram renders exclusively within its declared NVS region via a scissored sub-viewport pass with its own private perspective camera that auto-fits to content. The scene `Camera` governs 3D elements exclusively. The two rendering systems are explicitly isolated.

This is a clean-break redesign. Backward compatibility with the current `position`/`rotation`/`scale` camera-hint API is not required.

Affected packages: `@brewsite/diagram` (primary), `@brewsite/core` (compiler warning, `ICameraFocusTarget` interface review).

---

## 2. Problem Statement

### 2.1 The Hidden Camera Takeover

`DiagramCanvasWidget.apply()` repositions the shared scene perspective camera every frame using `scale / (2 * tan(fov/2))` as the pullback distance. Any `<Camera>` the scene author declares is silently nullified. Three production scenes (`scene_architecture.tsx`, `scene_cls_theory.tsx`, `scene_bf_overview.tsx`) declare `<Camera>` elements that have zero effect on rendering. No warning is emitted.

### 2.2 Misnamed Props

`position` on `DiagramCanvasDSL` is not an object position — it is a camera look-at target. `scale` is not just geometry scale — it is the camera pullback distance input. `rotation` is the only prop that transforms the object in the conventional sense. These semantics are undiscoverable from the type signatures.

### 2.3 The NVS Contract Is Broken

`TextBox` and `Hud` occupy NVS rects exclusively — `{x, y, w, h}` is authoritative for placement and rendering. `DiagramCanvas` claims to participate in this system but its actual screen placement is controlled by the camera takeover, not its NVS values. Authors who set `x=0.5, w=0.5` to place the diagram in the right half of the screen must also manually adjust `position.x` to shift the camera look-at target, with no type-system enforcement of coherence.

### 2.4 Layout Is Empirically Tuned

All production scenes converge to the same global `config` constants (`diagramScale: 1`, `diagramRotationX: -0.3`, `diagramTop: 0.1`) because the relationship between `position`, `scale`, `fov`, and actual screen coverage is not analytically knowable from the DSL. These values were found by trial and error.

---

## 3. Goals & Success Metrics

**Primary goals:**
- Scene authors can place a `DiagramCanvas` using `{x, y, w, h}` NVS coordinates with the same mental model as `TextBox`. No camera math required.
- A `<Camera>` in a scene with a `<DiagramCanvas>` governs 3D elements without interference. Mixed scenes (3D model + diagram) work correctly.
- The diagram renders only within its declared NVS bounds. No bleed into adjacent screen regions.

**Success metrics:**
- Zero `config` shim needed to author a correctly-placed diagram scene.
- `<Camera>` + `<DiagramCanvas>` coexistence produces correct independent rendering, verified by a render test.
- Raycasting (click/hover on nodes) remains correct for sub-region placements.
- TypeScript types for `DiagramCanvasDSL` make the old `position`/`rotation` props unavailable — incorrect authoring is a compile error.

**Guardrail metrics:**
- `canvasAspect` calculation (`(nvsBounds.w / nvsBounds.h) * engineAspect`) produces identical results before and after — node proportions unchanged.
- Cross-diagram pipe routing is unaffected.
- Interactive pan, rotate, reset, and focus actions continue to work.

---

## 4. Non-Goals

- **Configurable render Z-order for diagrams.** Diagrams always composite on top of the main 3D scene within their NVS bounds. No Z-order prop in V1.
- **Per-diagram camera override.** Authors do not configure the diagram's internal camera. FOV and distance are always auto-fit.
- **Scene Camera governing diagram framing.** The scene `Camera` never affects how diagram content is framed. Diagram camera isolation is a hard constraint, not an option.
- **Full 3-axis rotation.** Only pitch (`tilt`) is supported. Yaw and roll are not exposed.
- **Backward compatibility.** The `position` and `rotation` props are removed without deprecation. All existing scenes must be migrated.
- **Layout primitives** that automatically split NVS space between `DiagramCanvas` and `TextBox`. Authors specify NVS rects independently.

---

## 5. Consumer Stories

- As a toolkit consumer, I want to declare `<DiagramCanvas x={0} y={0} w={1} h={0.55}>` and have the diagram render in the top 55% of the screen, so that I can use NVS coordinates for layout without thinking about camera distance or FOV.
- As a toolkit consumer, I want to declare `<Camera mode="world" ...>` alongside `<DiagramCanvas>` and have the camera govern my 3D model while the diagram renders independently in its NVS region, so that I can build mixed scenes without one element overriding the other.
- As a toolkit consumer, I want the diagram to clip at its declared NVS boundary when I pan beyond the content edges, so that the diagram behaves as a bounded region consistent with the NVS contract.
- As a toolkit consumer, I want the TypeScript compiler to reject `position` and `rotation` props on `DiagramCanvas`, so that I author placement correctly by construction.
- As a toolkit consumer, I want `tilt={-0.3}` to pitch the diagram geometry backward for a 3D aesthetic without having to compute the camera distance that produces the desired screen coverage.

---

## 6. Functional Requirements

1. `DiagramCanvasDSL` must not expose `position` or `rotation` props. Authors who pass these props receive a TypeScript compile error.
2. `DiagramCanvasDSL` must expose `x`, `y`, `w`, `h` as the sole placement primitives. Defaults: `x=0, y=0, w=1, h=1` (fullscreen).
3. `DiagramCanvasDSL` must expose `tilt?: number` — pitch rotation in radians applied to the diagram group geometry. Default: `0`.
4. `DiagramCanvasDSL` must expose `padding?: number` — fractional framing inset applied by the auto-fit camera. `0` = tight crop; `0.1` = 10% margin around content bounding box. Default: `0.1`.
5. `DiagramCanvasDSL` must expose `scale?: number` — world-space geometry scale, same as today. Default: `1`. The auto-fit camera responds to geometry scale naturally.
6. The diagram must render exclusively within the pixel region corresponding to its NVS bounds. Content outside this region must be scissor-clipped.
7. The diagram's private perspective camera must auto-fit to the bounding box of the tilted diagram geometry, respecting `padding`. Authors must never specify camera distance or FOV.
8. The main scene render pass (full viewport, scene Camera, 3D elements) must complete before any DiagramCanvas render pass. Multiple DiagramCanvas instances render in declaration order on top of the main pass. This order is fixed and not configurable in V1.
9. Each DiagramCanvas render pass must use an isolated depth buffer. 3D scene elements and diagram geometry must not share a depth buffer.
10. A `<Camera>` element in the same scene as a `<DiagramCanvas>` must have zero effect on diagram framing and zero conflict with diagram rendering.
11. Interactive pan (`diagram-canvas.move` action) must translate diagram geometry within the scissored viewport. Content translated outside the NVS boundary is scissor-clipped. The auto-fit camera does not follow pan — it is fixed to the static content bounding box.
12. Interactive focus actions (`focusMesh`, `focusAll`) must operate on the diagram's private camera, not the shared scene camera.
13. Raycasting for node click and hover must remain correct for any sub-region placement using the existing `computeNdcForNvs()` logic.
14. `canvasAspect` passed to each child `DiagramRenderer` must equal `(nvsBounds.w / nvsBounds.h) * engineAspect`. This calculation is unchanged.

---

## 7. API Design

### 7.1 `DiagramCanvasDSL` (updated)

```ts
/** Raw DSL props from <DiagramCanvas> in the new NVS model. */
export interface DiagramCanvasDSL {
  readonly id: string;

  // ── Placement (NVS coordinates, top-left origin) ──────────────────────────
  /** NVS x-coordinate of the canvas left edge [0, 1]. Default: 0 */
  readonly x?: number;
  /** NVS y-coordinate of the canvas top edge [0, 1]. Default: 0 */
  readonly y?: number;
  /** NVS width of the canvas [0, 1]. Default: 1 */
  readonly w?: number;
  /** NVS height of the canvas [0, 1]. Default: 1 */
  readonly h?: number;

  // ── Geometry ──────────────────────────────────────────────────────────────
  /**
   * Pitch tilt applied to the diagram group geometry in radians.
   * Negative values tilt the top edge away from the viewer (the typical 3D effect).
   * Default: 0 (flat, facing camera).
   */
  readonly tilt?: number;
  /**
   * World-space uniform geometry scale. The auto-fit camera responds naturally —
   * larger geometry, camera backs up proportionally. Default: 1.
   */
  readonly scale?: number;
  /**
   * Fractional framing inset applied by the auto-fit camera around the content
   * bounding box. 0 = tight crop, 0.1 = 10% margin. Default: 0.1.
   */
  readonly padding?: number;

  // ── Other ─────────────────────────────────────────────────────────────────
  readonly theme?: DiagramTheme;
  readonly pipeRouting?: PipeRoutingAlgorithm;
  readonly pipeLanding?: PipeLandingAlgorithm;
  readonly focusCenter?: readonly [number, number] | readonly [number, number, number];
  /**
   * Default input actions derived from theme.input at compile time.
   * Consumed by DiagramCanvasWidget.getDefaultInputActions() at runtime.
   * Undefined when no theme.input is configured on the canvas.
   */
  readonly defaultInputActions?: ReadonlyArray<InputActionSpec>;
}
```

### 7.2 `DiagramCanvasState` (updated)

```ts
export interface DiagramCanvasState {
  readonly id: string;

  /** NVS bounds — authoritative for scissor rect and aspect ratio. */
  readonly nvsBounds: NVSRect;

  /**
   * Pitch tilt in radians applied to the canvas group geometry.
   * Default: 0.
   */
  readonly tilt: number;

  /** World-space uniform geometry scale. Default: 1. */
  readonly scale: number;

  /**
   * Fractional framing inset for the auto-fit camera. Default: 0.1.
   */
  readonly padding: number;

  readonly focusCenter?: readonly [number, number] | readonly [number, number, number];
  readonly diagrams: ReadonlyArray<DiagramState>;
  readonly pipes: ReadonlyArray<DiagramPipeState>;
  readonly defaultInputActions?: ReadonlyArray<InputActionSpec>;
}
```

### 7.3 Example Scene (before → after)

**Before (current, broken):**
```tsx
<Camera mode="world" position={[0, 8, 32]} target={[0, 0, 0]} fov={54} />  {/* silently ignored */}

<DiagramCanvas
  id="bf-arch"
  position={[0, config.diagramTop, 0]}         // secretly: camera look-at target
  rotation={[config.diagramRotationX, 0, 0]}   // secretly: pitch tilt
  scale={config.diagramScale}                   // secretly: camera pullback distance
  theme={brewflowTheme}
>
```

**After (new model):**
```tsx
<Camera mode="world" position={[0, 8, 32]} target={[0, 0, 0]} fov={54} />  {/* governs 3D elements */}

<DiagramCanvas
  id="bf-arch"
  x={0} y={0} w={1} h={0.58}    // NVS bounds: where the diagram renders
  tilt={-0.3}                    // pitch tilt in radians
  theme={brewflowTheme}
>
```

### 7.4 Mixed Scene Example

```tsx
<Scene id="architecture">
  {/* Scene Camera governs the 3D model — unaffected by DiagramCanvas */}
  <Camera mode="world" position={[4, 3, 18]} target={[4, 0, 0]} fov={52} />
  <Model src="server-rack.glb" position={[4, -1, 0]} />

  {/* DiagramCanvas renders in its own pass, scissored to left 45% */}
  <DiagramCanvas id="arch-diagram" x={0} y={0} w={0.45} h={0.7} tilt={-0.15} theme={myTheme}>
    <Diagram id="d1">...</Diagram>
  </DiagramCanvas>

  {/* TextBox fills the bottom strip */}
  <TextBox x={0} y={0.7} w={1} h={0.3}>...</TextBox>
</Scene>
```

---

## 8. Technical Considerations

### 8.1 Scissored Sub-Viewport Rendering

The `DiagramCanvasWidget` must issue a separate WebGL render pass for each canvas:

1. **Main pass**: `renderer.setScissorTest(false)`, `renderer.setViewport(fullViewport)`. Render scene with scene Camera. 3D models, environment, lighting, floor.
2. **Diagram passes** (in declaration order): For each `DiagramCanvasWidget`:
   - Convert `nvsBounds` to pixel coordinates: `{ left: x*W, top: (1-y-h)*H, width: w*W, height: h*H }` (WebGL origin is bottom-left).
   - `renderer.setScissorTest(true)`, `renderer.setScissor(pixelRect)`, `renderer.setViewport(pixelRect)`.
   - Clear depth buffer only (not color — diagram composites on top of main scene color).
   - Render diagram scene graph with private perspective camera.
   - `renderer.setScissorTest(false)`.

Each diagram render pass uses `renderer.setRenderTarget(null)` (default framebuffer) with scissor providing isolation. A separate `THREE.WebGLRenderTarget` per canvas is not required — scissor + depth clear is sufficient for correct isolation.

### 8.2 Private Perspective Camera — Auto-Fit

The diagram's private camera is a `THREE.PerspectiveCamera` with a fixed FOV (45° is a reasonable default — matches the current implicit default). On each `apply()`, the camera auto-fits to the axis-aligned bounding box of the diagram group after tilt is applied:

```ts
// Pseudo-code for auto-fit:
const box = new THREE.Box3().setFromObject(diagramGroup);
const center = box.getCenter(new THREE.Vector3());
const size = box.getSize(new THREE.Vector3());
const maxDim = Math.max(size.x / canvasAspect, size.y);
const dist = (maxDim / 2 / Math.tan(fov_rad / 2)) * (1 + padding);
privateCamera.position.set(center.x, center.y, center.z + dist);
privateCamera.lookAt(center);
```

The current `focusMesh` / `focusAll` focus logic targets the shared scene camera via `ICameraFocusTarget`. In the new model, focus targets the private camera. `ICameraFocusTarget.requestFocus()` must be called on a focus target backed by the private camera, not the scene camera. The architect must verify whether `ICameraFocusTarget` as currently defined generalizes, or whether a diagram-scoped focus interface is needed.

**Note on auto-fit approximation**: The formula `Math.max(size.x / canvasAspect, size.y)` selects the fitting dimension using the vertical FOV for both the horizontal and vertical cases. For wide canvas aspects this is a slight over-approximation — the camera backs up a bit further than the tightest correct fit. This is acceptable in V1; the `padding` prop absorbs the visual difference. The architect should note this is approximate and not attempt to correct it in V1.

### 8.3 Render Order — Fixed (V1 Decision)

Render order is not configurable. The product default is:
1. Main scene pass (full viewport, scene Camera).
2. Each DiagramCanvas pass, scissored to NVS bounds, in declaration order.

Diagrams always composite on top of the 3D scene within their NVS bounds. If a diagram's NVS region overlaps a 3D model on screen, the diagram wins. This is expected: NVS regions do not express depth. A Z-order prop is explicitly out of scope for V1.

### 8.4 Pan Behavior — Clipped at NVS Boundary (V1 Decision)

Interactive pan (`diagram-canvas.move` action) accumulates `inputTranslation` and applies it as an offset to the diagram group's position. The auto-fit camera does not follow the pan — it is fixed to the static (unpanned) content bounding box. Content that translates outside the NVS bounds is scissor-clipped at the boundary.

This is the correct and expected behavior: `DiagramCanvas` is a bounded NVS region. Authors who need a larger diagram than the NVS region can accommodate should use a smaller diagram or a larger NVS rect, not rely on pan to reveal off-screen content without clipping.

**Behavioral change from current model**: In the current model, pan moves the shared camera look-at target, which scrolls the view — content remains centered and the camera follows. In the new model, pan translates diagram geometry while the private camera stays fixed to the original content bounding box. The effect is that content moves *away from center* rather than the view scrolling. This is a deliberate product decision; the architect should document it in the plan so it is not reported as a regression during QA.

### 8.5 `canvasAspect` — Unchanged

`DiagramRenderer.setCanvasAspect(canvasAspect)` continues to receive `(nvsBounds.w / nvsBounds.h) * engineAspect`. This calculation is unchanged. Node proportions and pipe routing are unaffected.

### 8.6 `ILightingOverride` — Verify and Remove

`DiagramCanvasWidget.getLightingOverride()` currently returns `{ disableAll: true }` to prevent core lights from washing out diagram HDR rendering in the shared scene. In the scissored model, the diagram has its own render pass and renders against its own scene graph — core lights don't reach it. The `ILightingOverride` implementation on `DiagramCanvasWidget` may become dead code. The architect must verify and remove the interface implementation from `DiagramCanvasWidget` if it is no longer needed.

### 8.7 Raycasting

`computeNdcForNvs()` already remaps pointer coordinates to NDC within the NVS sub-region. This logic is correct in the new model and requires no changes. The raycaster continues to use the diagram's private camera (which it should already be doing via `this.cameraRef` — in the new model this reference points to the private camera rather than the shared scene camera).

### 8.8 Multiple DiagramCanvas Instances

Each `DiagramCanvasWidget` owns its private camera and issues its own render pass. Two canvases in the same scene produce two scissored passes after the main scene pass. They are fully independent. The `WidgetRegistry` dispatch order determines declaration order.

### 8.9 `DEFAULT_CANVAS_ASPECT` in Pipe Routing

Cross-diagram pipe geometry currently uses a hard-coded `DEFAULT_CANVAS_ASPECT` for control point computation. In the new model, the compiler has the actual `nvsBounds` at compile time and can compute the correct `canvasAspect`. The pipe router should receive the actual canvas aspect. This is a correctness fix included in V1.

---

## 9. Breaking Change Assessment

**Semver impact: major version bump.**

### Removed DSL props (breaking — compile error for consumers)

| Prop | Previous semantic | Replacement |
|---|---|---|
| `position` | Camera look-at target (disguised as object position) | Removed. Use `x`, `y`, `w`, `h` for placement. |
| `rotation` | World-space Euler XYZ rotation | Removed. Use `tilt` for pitch-only rotation. |

### Changed DSL props (semantic change — same prop name)

| Prop | Previous semantic | New semantic |
|---|---|---|
| `scale` | World-space geometry scale AND implicit camera pullback distance input | World-space geometry scale only. Camera pullback side effect removed. |

### New DSL props

| Prop | Semantic |
|---|---|
| `tilt` | Pitch rotation in radians applied to diagram geometry. Replaces `rotation[0]`. |
| `padding` | Auto-fit framing inset, fractional. Default `0.1`. |

### Changed `DiagramCanvasState` fields

| Field | Change |
|---|---|
| `position` | **Removed** from compiled state. |
| `rotation` | **Removed** from compiled state. |
| `tilt` | **Added** (`number`). |
| `padding` | **Added** (`number`). |

### Scene migration

For each scene using `DiagramCanvas`:

```tsx
// Remove:
position={[px, py, pz]}
rotation={[rx, 0, 0]}

// Replace rotation[0] with:
tilt={rx}

// Add NVS placement matching intended screen region:
x={0} y={0} w={1} h={0.55}
```

The `config.diagramTop` nudge (`position.y = 0.1`) was compensating for the camera look-at being slightly above center. In the new model, `tilt` alone controls the 3D angle; use the `y` NVS coordinate to shift the top edge of the diagram region if needed.

---

## 10. Dependencies

- `THREE.WebGLRenderer` scissor/viewport API — available in Three.js r140+. No new peer dependency.
- `THREE.PerspectiveCamera` — already in use. No change.
- `ICameraFocusTarget` interface in `@brewsite/core` — may need extension for diagram-scoped focus. Architect review required.
- Compiler handler in `packages/diagram/src/compiler/handlers.ts` — updated to drop `position`/`rotation` compilation and produce `tilt`/`padding` in `DiagramCanvasState`.

---

## 11. Risks & Mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| Auto-fit camera produces different framing than current for `scale=1, tilt=-0.3` | Medium | Verify against reference scenes during implementation. Tune default FOV and `padding` default to match current visual output. |
| Scissor rect pixel rounding at fractional NVS values | Low | Apply `Math.round()` to all pixel conversions. Add a test for sub-pixel NVS values. |
| `focusMesh` / `focusAll` broken if `ICameraFocusTarget` is wired to shared scene camera | Medium | Architect must wire focus to private camera before merge. Covered in launch criteria. |
| `ILightingOverride` removal breaks lighting if core lights DO reach the diagram pass | Low | Architect confirms isolation in the new render pass model. If core lights reach the diagram, `ILightingOverride` remains. |
| `DEFAULT_CANVAS_ASPECT` pipe routing divergence in multi-canvas scenes | Medium | Pass actual `canvasAspect` from `nvsBounds` to pipe router at compile time. Covered by correctness fix in section 8.9. |

---

## 12. Open Questions

The following are implementation-scoped questions owned by the architect — not product decisions:

1. **`ICameraFocusTarget` generalization**: Does the existing interface generalize to a diagram-scoped private camera, or does it need a new diagram-specific variant? (Section 8.2)

2. **Multiple canvas instances, single vs multiple render targets**: Two canvases in one scene both use scissored passes against the default framebuffer. If their NVS regions overlap, render order determines which wins. Is this acceptable, or should overlapping regions be validated at compile time?

3. **`ILightingOverride` dead code**: Architect verifies and removes `getLightingOverride()` and `receiveLightController()` from `DiagramCanvasWidget` if core lights do not reach the diagram render pass.

---

## 13. Launch Criteria

The following must all be true before this ships:

- [ ] `DiagramCanvasDSL` and `DiagramCanvasState` no longer contain `position` or `rotation`. TypeScript rejects these props at the consumer call site.
- [ ] `tilt` and `padding` are exported from `@brewsite/diagram` and documented in `packages/diagram/README.md`.
- [ ] Scissored sub-viewport rendering is implemented. A diagram at `x=0.5, w=0.5` renders only in the right half of the screen — verified visually and by a render integration test.
- [ ] Mixed scene test: a scene with `<Camera>`, a `<Model>`, and a `<DiagramCanvas>`. Both the model and the diagram render correctly. The model is not affected by the diagram camera. The diagram is not affected by the scene Camera.
- [ ] Interactive focus (`focusMesh`, `focusAll`) operates on the diagram's private camera and produces correct framing.
- [ ] Raycasting (click, hover) is correct for sub-region placements (`x=0.3, w=0.4`).
- [ ] All three example scenes (`scene_architecture.tsx`, `scene_cls_theory.tsx`, `scene_bf_overview.tsx`) are migrated to the new DSL. `config.diagramScale/Top/RotationX` are removed.
- [ ] The compile-time warning for `<Camera>` + `<DiagramCanvas>` coexistence (patch action, described below) is superseded by this redesign making the conflict impossible.
- [ ] Cross-diagram pipe routing passes actual `canvasAspect` derived from `nvsBounds` to the pipe router. The `DEFAULT_CANVAS_ASPECT` hard-code is removed.
- [ ] CHANGELOG entry written for the major version bump.
- [ ] `packages/diagram/README.md` updated with the new `DiagramCanvas` authoring example.

---

## Appendix: Immediate Patch Action (Pre-Redesign)

Before the full V1 redesign ships, add a compile-time warning to address silent breakage in existing scenes.

**Location**: The compiler handler that processes scene DSL nodes (most likely `packages/diagram/src/compiler/handlers.ts` or the core scene compiler).

**Behavior**: When a compiled scene's node list contains both a `Camera` node and a `DiagramCanvas` node, emit:

```
console.warn(
  `[DiagramCanvas] Scene "${sceneId}" declares both <Camera> and <DiagramCanvas id="${canvasId}">. ` +
  `DiagramCanvas overrides the scene camera and ignores the <Camera> declaration. ` +
  `Your <Camera> has no effect on this scene.`
);
```

This ships as a patch release. It is superseded when the full NVS redesign ships and the conflict becomes architecturally impossible.
