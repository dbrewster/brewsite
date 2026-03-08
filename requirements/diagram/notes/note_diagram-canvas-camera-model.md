---
title: "DiagramCanvas Camera Model — Problem Note"
doc_type: note
owner: product
status: draft
updated: 2026-03-08
---

# DiagramCanvas Camera Model — Problem Note

## Executive Summary

`DiagramCanvas` currently implements a hidden camera takeover that overrides the scene `Camera` widget on every frame. Simultaneously, its DSL exposes two partially-overlapping placement systems — 3D world-space transforms (`position`, `rotation`, `scale`) and NVS viewport bounds (`x`, `y`, `w`, `h`) — that do not compose coherently. The result is a split camera model that silently breaks `<Camera>` declarations, requires implicit knowledge to author correctly, and does not fit cleanly into the 0..1 NVS layout system that governs all other screen-space elements (`TextBox`, `Hud`, etc.).

**Direction confirmed**: `DiagramCanvas` will use NVS coordinates for placement, exactly like `TextBox`. Backward compatibility with the current `position`/`rotation`/`scale` camera-hint API is not required. This is a clean-break redesign.

This note documents the problem, the confirmed target model (Option C), the key decisions resolved during PM-PM review, and the immediate actions required before the full redesign ships.

---

## 1. How the Current System Actually Works

### 1.1 The Hidden Camera Takeover

`DiagramCanvasWidget.apply()` (`packages/diagram/src/elements/diagram/canvas/widget.ts`, line 191–199) runs on every tick:

```ts
// Deterministic camera setup: position camera so the [0..1] canvas height fills the view.
// Yields to Camera widget when a user-authored camera is active (cameraFocusTarget present).
const cam = this.cameraRef;
if (cam && !this._cameraFocusTarget) {
  const [cpx, cpy, cpz] = effectiveState.position;
  const fovRad = THREE.MathUtils.degToRad(cam.fov > 0 ? cam.fov : 45);
  const dist = effectiveState.scale / (2 * Math.tan(fovRad / 2));
  cam.position.set(cpx, cpy, cpz + dist);
  cam.lookAt(cpx, cpy, cpz);
}
```

This repositions the scene's shared perspective camera every frame based on the canvas `scale` and `position`. The `<Camera>` DSL element the scene author declares is rendered inert unless `_cameraFocusTarget` is set (which only occurs during interactive focus actions via `ActionInputController`).

**Consequence**: Any `<Camera mode="world" position={[0, 8, 32]} ...>` in a scene containing a `DiagramCanvas` has zero effect on rendering. This is silent. The scene in `scene_architecture.tsx` declares a Camera at position `[0, 8, 32]` that is completely overridden.

### 1.2 The Dual Placement API

`DiagramCanvasDSL` exposes two orthogonal placement systems simultaneously:

**3D world-space props** (used by current scenes):
```ts
readonly position?: readonly [number, number, number]; // secretly: camera target point
readonly rotation?: readonly [number, number, number]; // 3D tilt of diagram group
readonly scale?: number;                               // secretly: camera pullback distance
```

**NVS viewport bounds** (layout and raycasting only):
```ts
readonly x?: number;  // left edge of canvas region [0..1]
readonly y?: number;  // top edge of canvas region [0..1]
readonly w?: number;  // width of canvas region [0..1]
readonly h?: number;  // height of canvas region [0..1]
```

The NVS bounds today do NOT cause scissored rendering. The diagram renders through the full shared scene camera into the full canvas. `nvsBounds` only influences:
1. The per-diagram `canvasAspect` calculation: `(nvsBounds.w / nvsBounds.h) * engineAspect` — affecting node proportions.
2. Pointer event NDC remapping in `computeNdcForNvs()` — so clicks land on the right node in a sub-region.

This is the core defect: the NVS contract says "declare your position in 0..1 screen-space and you will render there." DiagramCanvas does not honor this contract.

### 1.3 What Actually Works Today

All three example scenes share the same empirically-tuned global constants:

```ts
export const config = {
  diagramScale: 1,
  diagramRotationX: -.3,
  diagramTop: .1,
}
```

These values were found by trial and error and encoded as shared constants because the relationship between `position`, `scale`, `fov`, and actual screen coverage is not analytically knowable from the DSL. This is a direct symptom of the broken API.

---

## 2. Why This is Broken

### 2.1 Camera ownership is invisible and silent

When a scene has both `<Camera>` and `<DiagramCanvas>`, the DiagramCanvas wins silently. No warning, no error. Scene authors who add `<Camera>` to control 3D elements alongside a diagram discover it has no effect only by visual inspection.

### 2.2 `position`, `rotation`, `scale` do not mean what they appear to mean

In every other element, `position` means "where the object lives in 3D world space." In `DiagramCanvasState`, `position` is the camera look-at target, `scale` is the camera pullback distance input, and `rotation` is the only prop that transforms the object in the conventional sense.

### 2.3 The NVS bounds and world transforms don't compose

If a scene author wants the diagram to fill only the right half of the screen (`x=0.5, w=0.5`), they must independently update both `nvsBounds` (for raycasting and aspect) and `position.x` (to shift the camera look-at target). These two knobs must be kept in sync manually with no type-system enforcement.

### 2.4 The NVS layout contract is broken

`TextBox` and `Hud` occupy NVS rects exclusively — `{x, y, w, h}` is authoritative for placement and rendering. DiagramCanvas claims to participate in this system but its actual screen placement is controlled by the camera takeover, not its NVS values. This violates the NVS contract.

---

## 3. The Confirmed Target Model (Option C)

**Option C is confirmed**: DiagramCanvas is a screen-region element with its own private camera, isolated from the scene Camera, with an optional 3D geometry tilt.

1. **NVS bounds are the primary and sole placement authority.** `{x, y, w, h}` declares which region of the viewport the diagram occupies. Parallel to `TextBox`. This is not a hint — it drives actual rendering.

2. **The diagram renders only within its NVS region**, via a scissored sub-viewport render pass with its own depth buffer. This is what makes NVS-primary meaningful: the diagram cannot bleed outside its declared bounds, and the shared scene renders into the remaining viewport unaffected.

3. **The diagram has its own perspective camera** that auto-fits to content within its NVS region. Authors never specify camera distance or FOV.

4. **`tilt`** (replaces `rotation.x`) is an optional pitch in radians applied to the diagram geometry before the internal camera frames it. This preserves the 3D tilt aesthetic. The perspective camera still auto-fits to the tilted geometry.

5. **The scene Camera governs everything else.** 3D models, floor, environment, lighting — all driven by `<Camera>`. DiagramCanvas renders in a separate pass. The two rendering systems are explicitly isolated.

6. **`position` is removed.** It was a camera-look-at-target disguised as object position. In the new model, diagram placement is entirely determined by NVS bounds.

7. **`scale` means world-space geometry scale only.** See section 4.2.

### 3.1 The Proposed Authoring Surface

```tsx
// DiagramCanvas occupies the top 58% of the screen.
// Tilted back 17 degrees. Internal camera auto-fits to content.
// Scene Camera governs models/environment — completely unaffected.

<DiagramCanvas
  id="my-canvas"
  x={0} y={0} w={1} h={0.58}     // NVS bounds: authoritative screen placement
  tilt={-0.3}                      // Optional: pitch tilt in radians (default: 0)
  theme={brewflowTheme}
>
  <Diagram id="my-diagram">
    ...
  </Diagram>
</DiagramCanvas>

<TextBox x={0} y={0.58} w={1} h={0.42}>
  ...
</TextBox>
```

---

## 4. Key Design Decisions (Resolved)

### 4.1 Orthographic vs Perspective Internal Camera

**Decision: Keep perspective.** The tilt depth cue (`tilt={-0.3}`) that makes diagrams feel embedded in a 3D world requires perspective foreshortening. The current auto-framing formula (`dist = contentHeight / (2 * tan(fov/2))`) is preserved, applied against the bounding box of the tilted content geometry.

### 4.2 `scale` Semantics

**Decision: `scale` is world-space geometry scale only.** The auto-fit camera responds to it naturally — larger geometry, camera backs up proportionally. No `zoom` prop is needed in V1. Framing tightness is controlled by a `padding` prop (fractional inset, default `0.1`) that expresses how much breathing room the auto-fit adds around the content bounding box. These are independent concepts:

- `scale` — how big the geometry is in world space. Affects node proportions and pipe routing.
- `padding` — how tight the camera frames the content. `0` = tight crop, `0.1` = 10% margin, `0.2` = loose.

`scale` is not removed because it has a real meaning: it controls the world-space size of the diagram group, which affects `canvasAspect` and pipe routing. Authors who want all diagrams to look the same regardless of node count use `scale`; authors who want the camera to crop tightly at varying sizes use `padding`.

### 4.3 Scissored Sub-Viewport is V1

**The scissored sub-viewport render pass is V1 of the redesign, not a future optimization.** This is what it means for DiagramCanvas to be NVS-primary:

- Diagram is rendered in a separate render pass with `renderer.setScissor(...)` and `renderer.setViewport(...)` matching the NVS bounds converted to pixel coordinates.
- The diagram has its own depth buffer (via a render target), isolated from the main scene depth buffer.
- The main scene renders first; the diagram render pass composites on top within its scissored region.
- Interaction raycasting already uses `computeNdcForNvs()` — this continues to work correctly with no changes.

If V1 keeps a shared scene camera with no scissoring, DiagramCanvas still renders across the full viewport, NVS bounds are still secondary, and the camera takeover is still implicit. That is not a redesign. The entire point of making NVS bounds authoritative is that the diagram renders where the bounds say it renders.

### 4.4 Mixed Scenes (3D Model + Diagram) — Supported

**Decision: Mixed scenes are a supported configuration.** The scissored sub-viewport architecture makes this clean:

- Main render pass: full viewport, scene Camera, 3D models + environment + lighting.
- Diagram render pass: scissored to `nvsBounds`, private perspective camera, diagram geometry only.
- The two passes share no depth buffer. A GLTF model at z=5 cannot intersect diagram nodes — they are in separate depth contexts. The z-buffer problem that exists in the current shared-scene architecture is eliminated.

The correct authoring pattern for a mixed scene:

```tsx
<Scene id="mixed">
  <Camera mode="world" position={[0, 5, 20]} target={[0, 0, 0]} fov={52} />
  <Model src="architecture.glb" position={[2, 0, 0]} />   {/* rendered by scene Camera */}

  <DiagramCanvas id="diagram" x={0} y={0} w={0.45} h={0.7} tilt={-0.15} theme={myTheme}>
    <Diagram id="d1">...</Diagram>
  </DiagramCanvas>

  <TextBox x={0.45} y={0} w={0.55} h={1}>...</TextBox>   {/* HTML overlay, unaffected */}
</Scene>
```

The 3D model occupies the right side of the screen at whatever screen position the scene Camera projects it to. The diagram is scissored to the left 45% of the viewport. There is no conflict.

---

## 5. Immediate Action: Compile-Time Warning

Regardless of when the full V1 redesign ships, a compile-time warning must be added immediately to address the silent breakage. This is a one-file change in the compiler.

**Target**: The compiler handler that processes scene DSL nodes (most likely `packages/diagram/src/compiler/handlers.ts` or the scene compiler in `packages/core/src/compiler/`).

**Behavior**: When a compiled scene's node list contains both a `Camera` element and a `DiagramCanvas` element, emit a `console.warn`:

```
[DiagramCanvas] Scene "${sceneId}" declares both a <Camera> and a <DiagramCanvas id="${canvasId}">.
DiagramCanvas owns the scene camera and overrides any <Camera> declaration.
Your <Camera> has no effect. Remove it, or wait for the DiagramCanvas NVS redesign.
```

This ships as a patch release, independent of the full redesign. It directly resolves the complaint "a Camera change had zero effect on diagram rendering" by making the override visible.

---

## 6. Breaking Change Assessment

**This is a major version bump.** Backward compatibility is not required.

The following DSL props are removed without deprecation:
- `position` — was a camera look-at target disguised as object position. Removed entirely. Screen placement is now fully determined by NVS bounds `{x, y, w, h}`.
- `rotation` — was a world-space Euler rotation. Replaced by `tilt` (scalar, radians, pitch only). The full 3-axis rotation was never used in practice — all real scenes only set `rotation.x`.

The following DSL props are preserved with unchanged semantics:
- `x`, `y`, `w`, `h` — NVS bounds. Same meaning, now authoritative for rendering.
- `scale` — world-space geometry scale. Same meaning, camera pullback side-effect removed.
- `theme`, `pipeRouting`, `pipeLanding`, `focusCenter`, `id` — unchanged.

New DSL props added in V1:
- `tilt` — pitch in radians (replaces `rotation[0]`).
- `padding` — auto-fit framing inset, fractional (default `0.1`).

Scene migration is straightforward: replace `rotation={[rotX, 0, 0]}` with `tilt={rotX}`, delete `position={[...]}`, and set `{x, y, w, h}` to match the intended screen region. The `config.diagramTop` nudge encoded as `position.y` should be absorbed into `y` (shift the NVS top edge up) or expressed as a `tilt` adjustment.

---

## 7. Constraints the Current Code Assumes

Any implementation must respect these existing constraints:

1. **`canvasAspect` must come from NVS bounds**: `DiagramRenderer.setCanvasAspect(canvasAspect)` receives `(nvsBounds.w / nvsBounds.h) * engineAspect`. This drives node layout proportions and pipe routing. Must stay correct.

2. **Raycasting uses `computeNdcForNvs()`**: Remaps pointer coordinates to NDC within the NVS sub-region. Already correct in the sub-viewport model — no changes needed.

3. **`ILightingOverride`**: The canvas disables all core lights when active. Diagrams manage their own HDR lighting via environment maps. Must remain true regardless of render pass structure.

4. **`_cameraFocusTarget` (interactive focus)**: The `focusMesh` and `focusAll` focus actions drive the scene camera to zoom in on a group. In the new model, the diagram's private camera is the focus target. `ICameraFocusTarget` must be wired to the diagram's private camera, not the shared scene camera.

5. **`inputTranslation` and `inputRotation` offsets**: Accumulated in the widget and applied on top of compiled state each frame. These offset the diagram group transform within the sub-viewport. Must continue to work.

6. **`DEFAULT_CANVAS_ASPECT` in pipe routing**: Cross-diagram pipe geometry uses a hard-coded canvas aspect for control point computation. This is currently decoupled from `nvsBounds`. In the new model, the pipe router should receive the actual `canvasAspect` derived from `nvsBounds` — this is a correctness fix, not a constraint to preserve.

7. **`scale=1` is the practical default**: The auto-fit camera responds to geometry scale. With `scale=1` and `padding=0.1`, the diagram should frame similarly to today's `scale=1` with the current auto-framing formula.

---

## 8. Open Questions

The PM-PM discussion has resolved the primary architecture questions. Remaining open questions are implementation-scoped and owned by the architect:

1. **Render pass ordering**: Does the main scene render first, then the diagram composites on top? Or does each DiagramCanvas have an independent Z-order prop for scenes where a diagram should appear behind other elements?

2. **Multiple DiagramCanvas instances**: Two DiagramCanvases in one scene, each in a different NVS region. Are they rendered in separate passes with separate depth buffers, or in a single shared diagram pass? The current `DiagramCanvasWidget` model suggests one widget per canvas — separate passes is the natural extension.

3. **`focusAll` / `focusMesh` with private camera**: Interactive focus currently calls `_cameraFocusTarget?.requestFocus(...)` which targets the shared scene camera. With a private diagram camera, `ICameraFocusTarget` must be an interface over the diagram's internal camera. Does this interface already generalize, or does it need extension?

4. **NVS bounds at compile time vs runtime**: NVS bounds are currently compiled into `DiagramCanvasState` and treated as static. Interactive pan (`applyInputMove`) offsets the diagram group, not the NVS bounds. In the new model, pan should probably translate the diagram geometry within the scissored viewport. Confirm this is the right behavior and that it does not require `nvsBounds` to be mutable at runtime.

---

## 9. Appendix: Current Code Flow (Reference)

```
Scene DSL compiled → DiagramCanvasState {
  id, position, rotation, scale,   // world-space (camera model inputs — BEING REMOVED)
  nvsBounds: { x, y, w, h },       // viewport layout (raycasting + aspect — BECOMING AUTHORITATIVE)
  diagrams[], pipes[]
}

DiagramCanvasWidget.apply(state):
  effectiveState = merge state + inputTranslation + inputRotation
  if (cam && !cameraFocusTarget):
    dist = scale / (2 * tan(fov/2))
    cam.position.set(pos.x, pos.y, pos.z + dist)  // ← OVERRIDES SCENE CAMERA — BEING REMOVED
    cam.lookAt(pos)
  canvasAspect = (nvsBounds.w / nvsBounds.h) * cam.aspect
  DiagramCanvasRenderer.update(effectiveState, scene, cam)
    → sets canvasGroup.position/rotation/scale from effectiveState
    → passes canvasAspect to each DiagramRenderer
```

**Target flow:**

```
Scene DSL compiled → DiagramCanvasState {
  id,
  tilt,                            // pitch in radians, applied to diagram group geometry
  scale,                           // world-space geometry scale only
  padding,                         // auto-fit framing inset
  nvsBounds: { x, y, w, h },       // authoritative screen placement — drives scissor rect
  diagrams[], pipes[]
}

DiagramCanvasWidget.apply(state):
  effectiveState = merge state + inputTranslation (group offset within sub-viewport)
  scissorRect = nvsBounds → pixel coordinates
  renderer.setScissor(scissorRect)
  privateCamera = auto-fit to content bounding box with padding
  DiagramCanvasRenderer.update(effectiveState, scissorRenderTarget, privateCamera)
    → sets canvasGroup.rotation from tilt
    → sets canvasGroup.scale from scale
    → passes canvasAspect = (nvsBounds.w / nvsBounds.h) * engineAspect to each DiagramRenderer
```
