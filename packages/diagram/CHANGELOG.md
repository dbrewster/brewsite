# @brewsite/diagram Changelog

## [Unreleased] — Major

### Breaking Changes

#### DiagramCanvas: NVS Sub-Viewport Model

`DiagramCanvas` has been redesigned from a hidden-camera-takeover element to a proper NVS-primary scissored sub-viewport. This is a **breaking change** — all scenes using `<DiagramCanvas>` must be migrated.

**Removed props:**
- `position` — world-space XYZ translation. Removed entirely. Use child `<Diagram position={...}>` for diagram-local positioning.
- `rotation` — world-space Euler XYZ rotation. Removed entirely. Use `tilt` for pitch (X-axis) rotation.

**New props:**
- `tilt` (`number`, default `0`) — pitch rotation of the diagram geometry group in radians. Replaces the X component of the old `rotation` prop. Negative values tilt the top edge away from the viewer.
- `padding` (`number`, default `0.1`) — fractional framing inset for the auto-fit private camera. `0` = tight crop; `0.1` = 10% margin.
- `x`, `y`, `w`, `h` (`number`, default `0 / 0 / 1 / 1`) — NVS placement coordinates (top-left origin, `[0, 1]`). These are the same coordinates used by `TextBox` and `Hud` elements.

**Migration:**

```tsx
// Before
<DiagramCanvas id="c" position={[0, 1, -4]} rotation={[-0.3, 0, 0]} scale={1.1}>

// After
<DiagramCanvas id="c" tilt={-0.3} scale={1.1}>
// x/y/w/h default to 0/0/1/1 (fullscreen) — omit them for a fullscreen canvas
```

Notes:
- The Y and Z components of the old `rotation` prop had no meaningful effect on diagram appearance and are not replaced.
- The `position` prop had no effect in the NVS model and is not replaced. To offset diagram content within the canvas, adjust child `<Diagram position={...}>` props.

#### DiagramCanvas: Scissored Sub-Viewport Rendering

Each `DiagramCanvas` now renders in its own scissored WebGL sub-viewport with an isolated depth buffer, via the new `IExtraRenderPass` interface in `@brewsite/core`. The render pass executes after the main scene render pass and clears depth only — the diagram composites over the main scene color without disturbing the main camera.

This means:
- Multiple `DiagramCanvas` elements in the same scene are fully independent and do not interfere with each other or the main scene camera.
- The `Camera` widget no longer affects diagram rendering.
- Core scene lights no longer affect the diagram sub-viewport. `DiagramCanvasWidget` no longer implements `ILightingOverride`.

#### DiagramCanvas: Private Scene and Camera

Each `DiagramCanvas` now creates its own `THREE.Scene` and `THREE.PerspectiveCamera(FOV=45)`. Diagram geometry lives exclusively in the private scene. The auto-fit camera frames the geometry bounding box every frame using the `padding` prop as a pullback margin.

`canvasAspect` is now computed from the actual NVS bounds and the renderer size at runtime. The `DEFAULT_CANVAS_ASPECT` export (`16/9`) has been **removed**.

#### DiagramCanvasWidget: Removed Interfaces

`DiagramCanvasWidget` no longer implements:
- `IAnimationController` — `tickPriority` and `onTick()` are removed. Camera framing runs in `apply()`.
- `ILightingOverride` — `getLightingOverride()` is removed.

`DiagramCanvasWidget` now implements `IExtraRenderPass` (from `@brewsite/core`).

### What Stays the Same

- `scale`, `theme`, `pipeRouting`, `pipeLanding`, `focusCenter` props: unchanged.
- Child `<Diagram>` `position` / `rotation` / `scale` props: unchanged (diagram-local space).
- `DiagramPipe`, cross-diagram pipe routing, and all pipe props: unchanged.
- `diagramPlugin()` auto-registration: unchanged.
- Ghost-node `mergeSnapshot` behavior: unchanged.
- Interaction callbacks (`onInteraction`, hover events): unchanged.
- All other exported elements (`ImagePanel`, `Screen`, etc.): unchanged.
