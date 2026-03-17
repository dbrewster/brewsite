---
title: "NVS→World Mapping Instability Under Camera Zoom/Orbit/Pan"
doc_type: note
owner: core
status: resolved
updated: 2026-03-15
change_history:
  - date: 2026-03-15
    author: "Toolkit Product"
    summary: "Marked resolved. The fix implemented Option A (pin NVS to compiled camera state). createNVSCoordService now accepts NVSCameraParams (pure math, no Three.js) instead of a live THREE.PerspectiveCamera. RuntimeDriverImpl computes NVS at Step 3.5 from compiled camera state, before animation controllers apply interaction overrides. All symptoms eliminated."
  - date: 2026-03-15
    author: "Toolkit Product"
    summary: "Initial bug report documenting the instability, root cause analysis, and three proposed fix options."
---

# NVS→World Mapping Instability Under Camera Zoom/Orbit/Pan

## Status: RESOLVED

This issue has been fully resolved. The fix is described in the Resolution section below.

## Problem (Historical)

All NVS-positioned content (Views, ViewLayouts, Charts, Diagrams, CarouselScrubber) shifted, scaled, or tore when the user zoomed, orbited, or panned the camera. This was because `NVSCoordService.toWorld()` recomputed world positions every frame using the **live camera position**, not the compiled scene's intended camera position.

## Root Cause (Historical)

`packages/core/src/layout/nvsCoordService.ts` previously accepted a live `THREE.PerspectiveCamera` and read `camera.position.z` directly:

```typescript
// OLD (deleted):
const cameraDistance = camera.position.z; // assumed target z=0
const visibleWorldHeight = 2 * cameraDistance * Math.tan(fovRad / 2);
```

When the user zoomed (applyCameraDolly moved camera.position.z), `visibleWorldWidth/Height` changed proportionally. Every NVS coordinate mapped to a different world position each frame.

## Resolution

The fix implemented **Option A: Pin NVS to Compiled Camera State**, with additional improvements:

### API Change

`createNVSCoordService` no longer accepts a `THREE.PerspectiveCamera`. It accepts a pure-math `NVSCameraParams` object:

```typescript
export type NVSCameraParams = {
  distance: number;    // camera distance to target in world units
  fovDeg: number;      // vertical FOV in degrees
  centerX?: number;    // world-space X of viewport center (default 0)
  centerY?: number;    // world-space Y of viewport center (default 0)
};

createNVSCoordService(camera: NVSCameraParams, viewportWidth: number, viewportHeight: number): NVSCoordService
```

A companion function extracts these params from compiled camera state:

```typescript
resolveNVSParamsFromCameraState(state: SceneCamera): NVSCameraParams | null
```

Both are exported from `@brewsite/core` via the layout barrel.

### Behavioral Changes

1. **NVS positions are stable under camera interaction** — zooming, orbiting, and panning no longer shift NVS-positioned content. The NVS mapping uses the scene author's compiled camera state, not the live Three.js camera.

2. **Distance calculation uses full 3D distance** — not just `camera.position.z`. Orbit-mode cameras with non-zero azimuth produce correct NVS mappings.

3. **NVS center follows camera target** — `toWorld(0.5, 0.5)` maps to the camera's look-at target point, not hardcoded `(0, 0, 0)`. For `nvsViewport` cameras (target at origin), this is identical to the old behavior.

4. **No Three.js dependency** — `nvsCoordService.ts` no longer imports Three.js. Test code can construct NVS services without any Three.js scaffolding.

5. **Tick ordering change** — NVS is now computed at Step 3.5 in the RuntimeDriverImpl tick sequence (from compiled camera state), before animation controllers (Step 4). CameraWidget.onTick() interaction overrides do not affect NVS.

### All Symptoms Eliminated

- Carousel ring distortion on zoom: fixed (NVS mapping is stable).
- Visual tearing during orbit/pan: fixed (distance is full 3D, not just Z component).
- Pan-induced lateral shift: fixed (NVS center uses compiled target, not live camera position).
- CarouselScrubber tray mismatch: fixed (stable world-space footprint).

## Related Files

- `packages/core/src/layout/nvsCoordService.ts` — the coordinate service (updated API)
- `packages/core/src/runtime/RuntimeDriver.ts` — NVS computed at Step 3.5 from compiled camera state
- `packages/core/src/elements/view/ViewWidget.ts` — uses `ctx.coords.toWorld()` (unchanged consumer)
- `packages/core/src/elements/carousel-scrubber/render.ts` — uses NVS (unchanged consumer)
- `packages/charts/src/elements/chart/render.ts` — uses NVS (unchanged consumer)
- `packages/diagram/src/elements/diagram/widget.ts` — uses NVS (unchanged consumer)
