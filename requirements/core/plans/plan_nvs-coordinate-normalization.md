---
title: "NVS Coordinate Normalization — Implementation Plan"
doc_type: plan
owner: architect
status: active
updated: 2026-03-06
---

# NVS Coordinate Normalization — Implementation Plan

## 1. Overview

All spatial X, Y coordinates across `@brewsite/core`, `@brewsite/diagram`, `@brewsite/model`, and `@brewsite/charts` are normalized to **[0..1] viewport space** (NVS). Origin is **top-left**: `x=0, y=0` = top-left corner; `x=1, y=1` = bottom-right corner. Z keeps the current convention (world-space depth or diagram depth-layering). The only exception is content inside a `<TextBox>` (DOM layout — already NVS, no change).

**What this fixes permanently:**
- Diagram node positions are now predictable without running the compiler
- DiagramExit offsets are no longer magic numbers
- Multi-diagram stacking uses declared viewport bounds, not guessed Y offsets
- Model/chart/image-panel/screen positions are unambiguous viewport fractions
- Auto-framing camera logic is eliminated (it made coordinate semantics runtime-dependent)

**Scope boundary:**
- Camera `position` and `target` stay world-space — the camera IS the world-space coordinate origin. A new `nvsTarget` optional prop is added for NVS-relative targeting.
- Lighting, Floor, Environment: stay world-space. They illuminate/modify the 3D scene and are not viewport-relative elements.
- DiagramCanvas `position`, `rotation`, `scale`: stay world-space. The canvas is a 3D object placed in the scene.

---

## 2. Coordinate Model Specification

### 2.1 The [0..1] NVS Model

```
x ∈ [0, 1]   0 = left edge of the AR-locked container
              1 = right edge
y ∈ [0, 1]   0 = top edge of the AR-locked container
              1 = bottom edge
z             world-space depth (unchanged convention)
              For diagram nodes: relative depth layering (positive = closer to camera)
```

This is identical to the existing `NVSRect` and `TextBox` coordinate system.

### 2.2 Z Coordinate — Current Behavior Preserved

| Context | Z convention |
|---|---|
| Diagram node `position[2]` | Depth layering within diagram (0 = flat, positive = closer to camera). Unchanged. |
| DiagramCanvas `position[2]` | World-space Z of the canvas plane. Unchanged. |
| Model `z` prop (new) | World-space depth of the model center. Replaces `position[2]`. |
| Chart `z` prop (new) | World-space depth of the chart center. Replaces `position[2]`. |
| ImagePanel `z` prop (new) | World-space depth of panel center. Replaces `position[2]`. |
| Screen `z` prop (new) | World-space depth of screen center. Replaces `position[2]`. |

### 2.3 NVS → Three.js World-Space Formula

The engine AR container establishes the NVS reference frame. At a given camera distance `d` from the look-at plane, vertical FOV `θ`, and aspect ratio `AR`:

```
h   = 2 * d * tan(θ / 2)          // visible world height at the look-at plane
w   = h * AR                       // visible world width

NVS → World (camera at [cx, cy, cz+d] looking at [cx, cy, cz]):
  worldX = cx + (nvsX - 0.5) * w
  worldY = cy - (nvsY - 0.5) * h  // Y-flip: NVS y=0 → world +Y (top of screen)
  worldZ = cz                      // the look-at plane

World → NVS (same camera):
  nvsX = (worldX - cx) / w + 0.5
  nvsY = -(worldY - cy) / h + 0.5
```

For `θ = 45°, d = 12.07, AR = 16/9`:
- `h ≈ 10.0` world units (camera distance chosen so world height = 10)
- `w ≈ 17.78` world units
- NVS (0.5, 0.5) → world (0, 0, 0)
- NVS (0, 0) → world (-8.89, 5, 0)
- NVS (1, 1) → world (8.89, -5, 0)

### 2.4 NDC ↔ NVS (reference, unchanged)

```
NVS → NDC:  ndcX = nvsX * 2 - 1;   ndcY = 1 - nvsY * 2
NDC → NVS:  nvsX = (ndcX + 1) / 2;  nvsY = (-ndcY + 1) / 2
```

### 2.5 Diagram Node NVS — The Normalization Pass

Layout algorithms produce positions in diagram units (integers/floats, Cartesian, Y-up). After layout resolution, a normalization pass converts all positions and sizes to [0..1]:

```
// Step 1: Compute raw bounding box of all node outer edges
minX = min over nodes of (pos[0] - size[0]/2)
maxX = max over nodes of (pos[0] + size[0]/2)
minY = min over nodes of (pos[1] - size[1]/2)
maxY = max over nodes of (pos[1] + size[1]/2)

// Step 2: Apply padding (expand bounding box by padding on all sides)
padding = resolvedLayout.groupPadding[0]  // top/bottom same as left/right for normalization
spanX = (maxX - minX) + 2 * padding
spanY = (maxY - minY) + 2 * padding
originX = minX - padding
originY = minY - padding   // NOTE: originY is bottom-left in Cartesian

// Step 3: Normalize each node position (with Y-flip: Cartesian Y-up → NVS Y-down)
normalizedX = (pos[0] - originX) / spanX
normalizedY = 1 - (pos[1] + size[1]/2 - originY) / spanY  // top edge of node → NVS Y
// OR for node center (what's stored in position[1]):
normalizedY_center = 1 - (pos[1] - originY) / spanY

// Step 4: Normalize each node size
normalizedW = size[0] / spanX
normalizedH = size[1] / spanY

// Step 5: Normalize group bounds (GroupBounds.x is left edge, .y is BOTTOM edge in Cartesian)
// After normalization:
nvsGroupX = (bounds.x - originX) / spanX                      // left edge → NVS x
nvsGroupY = 1 - (bounds.y + bounds.h - originY) / spanY       // Cartesian top → NVS y
nvsGroupW = bounds.w / spanX
nvsGroupH = bounds.h / spanY
// padding also normalized:
nvsPaddingTop    = bounds.padding[0] / spanY
nvsPaddingRight  = bounds.padding[1] / spanX
nvsPaddingBottom = bounds.padding[2] / spanY
nvsPaddingLeft   = bounds.padding[3] / spanX
nvsGroupTitleGap = bounds.titleGap / spanY
```

### 2.6 Diagram Viewport → World Space (in DiagramRenderer)

Given a node at NVS position `[nx, ny, nz]` within a diagram that occupies `viewportBounds: NVSRect` within a canvas:

```
// Canvas-local position (canvas center at origin, canvasScale = world units per canvas height)
canvasAspect = (nvsBounds.w / nvsBounds.h) * engineAspect   // computed at render time
vpX = viewportBounds.x + viewportBounds.w * nx              // compound: node within diagram, diagram within canvas
vpY = viewportBounds.y + viewportBounds.h * ny
localX = (vpX - 0.5) * canvasAspect                         // canvas-local X (-canvasAspect/2 to +canvasAspect/2)
localY = -(vpY - 0.5)                                        // canvas-local Y (Y-flip, -0.5 to +0.5)
localZ = nz                                                  // depth layering unchanged

// World space (canvasGroup has position=canvas.position, scale=canvas.scale)
// localX/Y are in canvas-local units (0..1 range before scale applied)
// After canvasGroup.scale.setScalar(canvasScale): world = canvas.position + localXYZ * canvasScale
```

For node size in world space:
```
worldSizeX = nx_size * viewportBounds.w * canvasAspect * canvas.scale
worldSizeY = ny_size * viewportBounds.h * canvas.scale
```

---

## 3. Shared Infrastructure — Must Land First

### 3.1 New File: `packages/core/src/layout/nvsWorldBridge.ts`

This file is the canonical NVS ↔ world-space bridge. It has NO Three.js dependency in its analytic form; Three.js-aware variants are in the same file.

**Complete file content:**

```typescript
// Canonical NVS ↔ Three.js world-space bridge utilities.
// Pure math functions for use in compile.ts files (analytic),
// and Three.js-aware functions for use in render.ts / widget files.

import type { Vec3 } from '../math/types';
import type { NVSPosition } from './types';

/**
 * Converts NVS (x ∈ [0,1], y ∈ [0,1], origin top-left) to Three.js world-space
 * analytically (no camera object needed). Assumes a camera looking straight
 * down -Z at a look-at center, with the given parameters.
 *
 * Formula:
 *   h = 2 * distance * tan(vFovDeg * PI / 360)
 *   w = h * aspectRatio
 *   worldX = cx + (nvsX - 0.5) * w
 *   worldY = cy - (nvsY - 0.5) * h   // Y-flip: NVS y=0 is top, world +Y is up
 *
 * @param nvsX        NVS x in [0, 1]
 * @param nvsY        NVS y in [0, 1]
 * @param cx          World X of the camera look-at center (default 0)
 * @param cy          World Y of the camera look-at center (default 0)
 * @param distance    Camera distance from the look-at plane (world units)
 * @param vFovDeg     Vertical FOV in degrees (default 45)
 * @param aspectRatio Width/height ratio (default 16/9)
 * @param targetZ     World Z of the output point (default 0 = look-at plane)
 * @returns           World-space [x, y, z]
 */
export function nvsToWorldAnalytic(
  nvsX: number,
  nvsY: number,
  cx: number = 0,
  cy: number = 0,
  distance: number,
  vFovDeg: number = 45,
  aspectRatio: number = 16 / 9,
  targetZ: number = 0,
): Vec3 {
  const h = 2 * distance * Math.tan((vFovDeg * Math.PI) / 360);
  const w = h * aspectRatio;
  return [
    cx + (nvsX - 0.5) * w,
    cy - (nvsY - 0.5) * h,
    targetZ,
  ];
}

/**
 * Converts world-space to NVS analytically (inverse of nvsToWorldAnalytic).
 * Returns NVS position. Values outside [0,1] indicate off-screen.
 */
export function worldToNvsAnalytic(
  worldX: number,
  worldY: number,
  cx: number = 0,
  cy: number = 0,
  distance: number,
  vFovDeg: number = 45,
  aspectRatio: number = 16 / 9,
): NVSPosition {
  const h = 2 * distance * Math.tan((vFovDeg * Math.PI) / 360);
  const w = h * aspectRatio;
  return {
    x: (worldX - cx) / w + 0.5,
    y: -(worldY - cy) / h + 0.5,
  };
}

/**
 * Computes visible world dimensions at a given camera setup.
 * Returns { worldWidth, worldHeight } at the look-at plane.
 */
export function computeWorldDimensions(
  distance: number,
  vFovDeg: number = 45,
  aspectRatio: number = 16 / 9,
): { worldWidth: number; worldHeight: number } {
  const worldHeight = 2 * distance * Math.tan((vFovDeg * Math.PI) / 360);
  return { worldWidth: worldHeight * aspectRatio, worldHeight };
}

/**
 * Converts NVS position to world-space using a live Three.js PerspectiveCamera.
 * Assumes the camera looks along -Z from its current position.
 * Uses the camera's actual fov, aspect, and position for the conversion.
 *
 * Import THREE separately in render.ts files that use this function.
 *
 * @param nvsX      NVS x in [0, 1]
 * @param nvsY      NVS y in [0, 1]
 * @param camera    THREE.PerspectiveCamera with correct matrix
 * @param targetZ   World Z of the output point (default 0)
 * @returns         World-space [x, y, z]
 */
export function nvsToWorldWithCamera(
  nvsX: number,
  nvsY: number,
  camera: { fov: number; aspect: number; position: { x: number; y: number; z: number } },
  targetZ: number = 0,
): Vec3 {
  const d = camera.position.z - targetZ;
  return nvsToWorldAnalytic(
    nvsX,
    nvsY,
    camera.position.x,
    camera.position.y,
    d,
    camera.fov,
    camera.aspect,
    targetZ,
  );
}

/**
 * Projects a world-space point to NVS using a live Three.js PerspectiveCamera.
 * Points behind the camera or outside the frustum return values outside [0, 1].
 */
export function worldToNvsWithCamera(
  worldX: number,
  worldY: number,
  worldZ: number,
  camera: { fov: number; aspect: number; position: { x: number; y: number; z: number } },
): NVSPosition {
  const d = camera.position.z - worldZ;
  return worldToNvsAnalytic(
    worldX,
    worldY,
    camera.position.x,
    camera.position.y,
    d,
    camera.fov,
    camera.aspect,
  );
}
```

### 3.2 Update `packages/core/src/layout/index.ts`

Add exports:
```typescript
export { nvsToWorldAnalytic, worldToNvsAnalytic, nvsToWorldWithCamera, worldToNvsWithCamera, computeWorldDimensions } from './nvsWorldBridge';
```

### 3.3 Update `packages/core/src/index.ts`

Add to public exports (layout section):
```typescript
export { nvsToWorldAnalytic, worldToNvsAnalytic, nvsToWorldWithCamera, worldToNvsWithCamera, computeWorldDimensions } from './layout';
```

---

## 4. Diagram Package Changes

This is the largest change. It affects 10+ files in `packages/diagram/src/elements/diagram/`.

### 4.1 `packages/diagram/src/elements/diagram/types.ts`

**DiagramNodeState — before:**
```typescript
interface DiagramNodeState {
  position: readonly [number, number, number];  // diagram units, Cartesian Y-up
  size: readonly [number, number];              // diagram units
  thickness: number;                            // diagram units
  // ...
}
```

**DiagramNodeState — after:**
```typescript
interface DiagramNodeState {
  /**
   * Node center position in diagram viewport space.
   * position[0] = x ∈ [0..1]: 0 = left edge, 1 = right edge.
   * position[1] = y ∈ [0..1]: 0 = top edge, 1 = bottom edge (Y is DOWN, NVS convention).
   * position[2] = z: relative depth layering in diagram units (unchanged).
   */
  position: readonly [number, number, number];
  /**
   * Node size as viewport fractions.
   * size[0] = w ∈ [0..1]: fraction of diagram viewport width.
   * size[1] = h ∈ [0..1]: fraction of diagram viewport height.
   */
  size: readonly [number, number];
  /**
   * Physical thickness in diagram canvas units — how far the node protrudes toward camera.
   * Unchanged — still in canvas world units (not normalized).
   */
  thickness: number;
  // ... all other fields unchanged
}
```

**DiagramState — before:**
```typescript
interface DiagramState {
  position: readonly [number, number, number];  // canvas-local units
  rotation: readonly [number, number, number];  // Euler XYZ radians
  scale: number;
  pivot: DiagramPivot;
  bounds: { x: number; y: number; w: number; h: number };  // diagram units
  nodes: ReadonlyArray<DiagramNodeState>;
  edges: ReadonlyArray<DiagramEdgeState>;
  groups: ReadonlyArray<DiagramGroupState>;
  exit: DiagramExitConfig | undefined;
  enter: DiagramEnterConfig | undefined;
  themeConfig: DiagramThemeRenderConfig;
  id: string;
}
```

**DiagramState — after:**
```typescript
interface DiagramState {
  /**
   * Viewport bounds within the parent DiagramCanvas's NVS region.
   * Declares what portion of the canvas this diagram occupies.
   * { x, y, w, h } in [0..1] fractions of the canvas NVS region.
   * Default: { x: 0, y: 0, w: 1, h: 1 } (full canvas).
   */
  viewportBounds: NVSRect;
  /**
   * 3D tilt rotation (Euler XYZ radians) for dramatic perspective effects.
   * Default: [0, 0, 0] (flat, facing camera).
   * Replaces the previous rotation prop.
   */
  tiltRotation: readonly [number, number, number];
  // REMOVED: position (use viewportBounds)
  // REMOVED: rotation (use tiltRotation)
  // REMOVED: scale (controlled via DiagramCanvas.scale)
  // REMOVED: pivot (origin is always top-left in NVS)
  // REMOVED: bounds (always { x: 0, y: 0, w: 1, h: 1 } after normalization; redundant)
  nodes: ReadonlyArray<DiagramNodeState>;
  edges: ReadonlyArray<DiagramEdgeState>;
  groups: ReadonlyArray<DiagramGroupState>;
  exit: DiagramExitConfig | undefined;
  enter: DiagramEnterConfig | undefined;
  themeConfig: DiagramThemeRenderConfig;
  id: string;
}
```

**DiagramGroupState.bounds — before:**
```typescript
// GroupBounds (used as DiagramGroupState.bounds):
type GroupBounds = {
  x: number;      // diagram units, left edge
  y: number;      // diagram units, bottom edge (Cartesian Y-up)
  w: number;      // diagram units
  h: number;      // diagram units
  padding: readonly [number, number, number, number];  // diagram units [top,right,bottom,left]
  titleGap: number;  // diagram units
};
```

**DiagramGroupState.bounds — after:**
```typescript
// GroupBounds (normalized):
type GroupBounds = {
  x: number;      // [0..1] NVS, left edge
  y: number;      // [0..1] NVS, top edge (Y-DOWN after flip)
  w: number;      // [0..1] fraction of diagram viewport width
  h: number;      // [0..1] fraction of diagram viewport height
  padding: readonly [number, number, number, number];  // normalized fractions [top,right,bottom,left]
  titleGap: number;  // normalized fraction of diagram viewport height
};
```

**DiagramExitConfig / DiagramEnterConfig — before:**
```typescript
type DiagramExitConfig = {
  to?: readonly [number, number, number];   // canvas-local space (diagram units * scale + position)
  scaleTo?: number;
  fade?: boolean;
  easing: DiagramEasing;
};
type DiagramEnterConfig = {
  from?: readonly [number, number, number]; // canvas-local space
  scaleFrom?: number;
  fade?: boolean;
  easing: DiagramEasing;
};
```

**DiagramExitConfig / DiagramEnterConfig — after:**
```typescript
type DiagramExitConfig = {
  /**
   * Target viewport position at end of exit animation, in [0..1] space.
   * Values outside [0..1] move off-screen.
   * Example: to={[0.5, 2, 0]} exits 1 full viewport height below center.
   * Example: to={[-1, 0.5, 0]} exits 1 full viewport width to the left.
   */
  to?: readonly [number, number, number];   // [0..1] NVS, values outside [0..1] = off-screen
  // scaleTo removed (diagram scale is now canvas-controlled)
  fade?: boolean;
  easing: DiagramEasing;
};
type DiagramEnterConfig = {
  /**
   * Source viewport position at start of enter animation, in [0..1] space.
   */
  from?: readonly [number, number, number];  // [0..1] NVS, values outside [0..1] = off-screen
  // scaleFrom removed
  fade?: boolean;
  easing: DiagramEasing;
};
```

**Remove from types.ts:**
- `DiagramPivot` type (no longer needed — always top-left)

### 4.2 `packages/diagram/src/elements/diagram/dsl.tsx`

**DiagramProps — before:**
```typescript
interface DiagramProps {
  id: string;
  pivot?: DiagramPivot;              // 'center' | 'top-left' | etc.
  position?: [number, number, number]; // canvas-local Vec3
  rotation?: [number, number, number]; // Euler XYZ radians
  scale?: number;
  theme?: DiagramTheme;
  children?: React.ReactNode;
}
```

**DiagramProps — after:**
```typescript
interface DiagramProps {
  id: string;
  /**
   * Viewport bounds within the parent DiagramCanvas's NVS region.
   * { x, y, w, h } in [0..1] fractions of the canvas NVS region.
   * Default: { x: 0, y: 0, w: 1, h: 1 } (full canvas).
   *
   * For side-by-side diagrams:
   *   left:  viewportBounds={{ x: 0,   y: 0, w: 0.5, h: 1 }}
   *   right: viewportBounds={{ x: 0.5, y: 0, w: 0.5, h: 1 }}
   */
  viewportBounds?: NVSRect;
  /**
   * 3D tilt rotation in Euler XYZ radians.
   * Default: [0, 0, 0] (flat, facing camera).
   */
  tilt?: [number, number, number];
  theme?: DiagramTheme;
  children?: React.ReactNode;
  // REMOVED: pivot, position, rotation, scale
}
```

**DiagramNodeProps — update JSDoc only (no prop changes except position/size semantics):**
```typescript
interface DiagramNodeProps {
  // ...
  /**
   * Node position in diagram viewport space [x, y, z].
   * x ∈ [0..1]: 0 = left edge of diagram viewport, 1 = right edge.
   * y ∈ [0..1]: 0 = top edge of diagram viewport, 1 = bottom edge.
   * z: depth layering in diagram canvas units (unchanged).
   *
   * When using <GridLayout>, <HierarchicalLayout>, or <FlowLayout>,
   * omit this prop — the layout engine assigns positions automatically.
   * Specify only when using <ManualLayout>.
   *
   * To place a node at screen center: position={[0.5, 0.5, 0]}.
   * To place at top-left quarter: position={[0.25, 0.25, 0]}.
   *
   * Note: authored position values for ManualLayout nodes must be
   * in [0..1] NVS space. Values outside [0..1] render off-screen.
   */
  position?: [number, number, number];
  /**
   * Node width and height as viewport fractions [w, h].
   * w ∈ [0..1]: fraction of diagram viewport width.
   * h ∈ [0..1]: fraction of diagram viewport height.
   * Default: [0.12, 0.10] (approximately a 2:1 node at 16:9 aspect).
   *
   * For an aspect-ratio-correct square in a 16:9 viewport: h ≈ w * (16/9).
   *
   * Note: these props are in viewport fractions, NOT the old layout units.
   * The layout algorithms (spacing, groupPadding, etc.) still use layout units
   * internally and are normalized to [0..1] by the compiler.
   */
  size?: [number, number];
}
```

**DiagramExitProps / DiagramEnterProps:**
```typescript
interface DiagramExitProps {
  /**
   * Target position in diagram viewport space at end of exit.
   * [0..1] in x and y. Values outside [0..1] move off-screen.
   * Example: to={[0.5, 2, 0]} exits 1 viewport height below center.
   * Example: to={[-1, 0.5, 0]} exits 1 viewport width to the left.
   */
  to?: [number, number, number];
  fade?: boolean;
  easing?: DiagramEasing;
}

interface DiagramEnterProps {
  /**
   * Source position in diagram viewport space at start of enter.
   */
  from?: [number, number, number];
  fade?: boolean;
  easing?: DiagramEasing;
}
```

### 4.3 `packages/diagram/src/elements/diagram/compile.ts`

**Add `normalizeToViewport()` function:**

```typescript
type RawPosition = readonly [number, number, number];
type RawSize = readonly [number, number];

/**
 * Converts all node positions and sizes from diagram-unit Cartesian space
 * to [0..1] NVS space after layout algorithms have assigned absolute positions.
 *
 * Also normalizes group bounds from diagram units to [0..1] NVS.
 *
 * The Y axis is FLIPPED: Cartesian +Y (up) → NVS y=0 (top).
 *
 * @param nodes     Node list with diagram-unit positions (after pivot offset applied)
 * @param groups    Group list with diagram-unit GroupBounds
 * @param padding   The resolved padding in diagram units (used for bounding-box expansion)
 * @returns         { normalizedNodes, normalizedGroups } with [0..1] positions/sizes
 */
function normalizeToViewport(
  nodes: ReadonlyArray<{ id: string; position: RawPosition; size: RawSize; thickness: number }>,
  groups: Map<string, GroupBounds>,
  padding: number,
): {
  normalizedPositions: Map<string, RawPosition>;
  normalizedSizes: Map<string, RawSize>;
  normalizedGroups: Map<string, GroupBounds>;
} {
  // Step 1: Compute bounding box of all node outer edges
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const node of nodes) {
    const [px, py] = node.position;
    const [sw, sh] = node.size;
    minX = Math.min(minX, px - sw / 2);
    maxX = Math.max(maxX, px + sw / 2);
    minY = Math.min(minY, py - sh / 2);
    maxY = Math.max(maxY, py + sh / 2);
  }

  // Degenerate case: no nodes
  if (!Number.isFinite(minX)) {
    return {
      normalizedPositions: new Map(),
      normalizedSizes: new Map(),
      normalizedGroups: new Map(),
    };
  }

  // Step 2: Expand by padding
  const spanX = (maxX - minX) + 2 * padding;
  const spanY = (maxY - minY) + 2 * padding;
  const originX = minX - padding;
  const originY = minY - padding;  // BOTTOM of diagram in Cartesian

  // Guard against degenerate diagrams
  const safeSpanX = spanX > 0 ? spanX : 1;
  const safeSpanY = spanY > 0 ? spanY : 1;

  // Step 3: Normalize node positions (with Y-flip)
  const normalizedPositions = new Map<string, RawPosition>();
  const normalizedSizes = new Map<string, RawSize>();
  for (const node of nodes) {
    const [px, py, pz] = node.position;
    const [sw, sh] = node.size;
    const nx = (px - originX) / safeSpanX;
    const ny = 1 - (py - originY) / safeSpanY;   // Y-flip: Cartesian up → NVS down
    normalizedPositions.set(node.id, [nx, ny, pz]);
    normalizedSizes.set(node.id, [sw / safeSpanX, sh / safeSpanY]);
  }

  // Step 4: Normalize group bounds (bounds.x = left, bounds.y = BOTTOM in Cartesian)
  const normalizedGroups = new Map<string, GroupBounds>();
  for (const [groupId, bounds] of groups) {
    const nvsX = (bounds.x - originX) / safeSpanX;
    const cartesianTop = bounds.y + bounds.h;
    const nvsY = 1 - (cartesianTop - originY) / safeSpanY;  // Y-flip
    const nvsW = bounds.w / safeSpanX;
    const nvsH = bounds.h / safeSpanY;
    const [pt, pr, pb, pl] = bounds.padding;
    normalizedGroups.set(groupId, {
      x: nvsX,
      y: nvsY,
      w: nvsW,
      h: nvsH,
      padding: [pt / safeSpanY, pr / safeSpanX, pb / safeSpanY, pl / safeSpanX],
      titleGap: bounds.titleGap / safeSpanY,
    });
  }

  return { normalizedPositions, normalizedSizes, normalizedGroups };
}
```

**Modify `compileDiagram()` — replace pivot+bounds block with normalization:**

```typescript
export function compileDiagram(
  dsl: DiagramDSL,
  fallbackTheme: DiagramTheme = darkGlassTheme,
  onWarn?: DiagramWarnFn,
): DiagramState {
  // ... (existing: resolve layout, sizeMap, positions from layout algorithms) ...

  // REMOVED: compilePivotOffset — pivot concept eliminated
  // REMOVED: const pivot = dsl.pivot ?? 'center';
  // REMOVED: const [ox, oy, oz] = compilePivotOffset(rawBounds, pivot); + loop

  // Resolve group bounds map (still in diagram units at this point)
  const groupBoundsMap = resolveGroupBoundsMap(dsl.groups, positions, sizeWithDepthMap, groupLayouts);

  // Route edges (still in diagram units — routing math unchanged)
  const controlPointsMap = routeEdges(/* same args */);

  // Compile nodes with diagram-unit positions (temporary)
  const nodesPreNorm = dsl.nodes.map((node) => {
    const positionFromMap = positions.get(node.id);
    const position: readonly [number, number, number] = positionFromMap ?? [0, 0, 0];
    const groupId = node.groupId ?? groupMap.get(node.id);
    return compileNode(node, position, groupId, theme, positionFromMap === undefined);
  });

  // Normalize: convert diagram-unit positions/sizes to [0..1] NVS.
  // ManualLayout nodes are ALREADY authored in [0..1] NVS after migration —
  // do NOT run normalizeToViewport() on them. Doing so would re-normalize
  // [0..1] values against a [0..1] bounding box + a meaningless 1.5-unit padding,
  // causing node positions to drift from their authored values.
  let normalizedPositions: Map<string, RawPosition>;
  let normalizedSizes: Map<string, RawSize>;
  let normalizedGroups: Map<string, GroupBounds>;

  if (rootLayout.kind !== 'manual') {
    // Auto-layout: nodes have diagram-unit positions from layout algorithms → normalize to [0..1].
    const resolvedPadding = (rootLayout as ResolvedBaseLayout).groupPadding[0];
    ({ normalizedPositions, normalizedSizes, normalizedGroups } = normalizeToViewport(
      nodesPreNorm,
      groupBoundsMap,
      resolvedPadding,
    ));
  } else {
    // ManualLayout: positions are [0..1] NVS as authored. Pass through without normalization.
    // groupBoundsMap bounds are derived from node positions (already [0..1]), so also pass through.
    normalizedPositions = new Map(nodesPreNorm.map((n) => [n.id, n.position]));
    normalizedSizes = new Map(nodesPreNorm.map((n) => [n.id, n.size]));
    // IMPLEMENTATION NOTE: resolveGroupBoundsMap() must treat ManualLayout node positions
    // as NVS (Y-down, origin top-left), NOT Cartesian Y-up. GroupBounds.y must be the
    // NVS TOP edge (smallest Y value, since Y increases downward in NVS).
    // Test: a group containing a node at NVS y=0.8 must produce bounds.y < 0.8 (see §12.8).
    normalizedGroups = groupBoundsMap;
  }

  // Apply normalized positions/sizes to nodes
  const nodes = nodesPreNorm
    .map((node) => ({
      ...node,
      position: normalizedPositions.get(node.id) ?? node.position,
      size: normalizedSizes.get(node.id) ?? node.size,
    }))
    .sort((a, b) => a.position[2] - b.position[2]);

  // Re-route edges with normalized positions (edge routing math is scale-invariant)
  // Edge control points must also be normalized
  const normalizedSizeWithDepthMap = new Map<string, readonly [number, number, number]>();
  for (const [id, norm] of normalizedSizes) {
    const originalDepth = sizeWithDepthMap.get(id)?.[2] ?? 0.4;
    normalizedSizeWithDepthMap.set(id, [norm[0], norm[1], originalDepth]);
  }
  // Also add group entries for edge routing targets
  for (const [groupId, normBounds] of normalizedGroups) {
    normalizedPositions.set(groupId, [normBounds.x + normBounds.w / 2, normBounds.y + normBounds.h / 2, -0.6]);
    normalizedSizeWithDepthMap.set(groupId, [normBounds.w, normBounds.h, 0.01]);
  }

  const normalizedControlPointsMap = routeEdges(
    edgesForRouting,
    normalizedPositions,
    normalizedSizeWithDepthMap,
    theme.edge.routing,
    theme.edge.landing,
    onWarn,
  );

  const edges = dsl.edges.map((edge, index) => {
    const id = edge.id ?? `${edge.from}-${edge.to}-${index}`;
    const controlPoints = normalizedControlPointsMap.get(id) ?? [];
    return compileEdge(edge, controlPoints, index, theme);
  });

  const groups = dsl.groups
    .map((group) => {
      const bounds = normalizedGroups.get(group.id);
      if (!bounds) return null;
      return compileGroup(group, bounds, theme);
    })
    .filter((g): g is NonNullable<typeof g> => !!g)
    .sort(/* same depth+area sort */);

  // DiagramState no longer has position/rotation/scale/pivot/bounds
  // viewportBounds comes from the DSL prop (compiled in compileCanvas, not here)
  return {
    id: dsl.id,
    viewportBounds: dsl.viewportBounds ?? { x: 0, y: 0, w: 1, h: 1 },
    tiltRotation: dsl.tilt ?? [0, 0, 0],
    nodes,
    edges,
    groups,
    exit: compileExitConfig(dsl.exit),
    enter: compileEnterConfig(dsl.enter),
    themeConfig: buildThemeRenderConfig(theme),
  };
}
```

**Remove `compilePivotOffset()` entirely.**

**Update `applyDiagramExit()` and `applyDiagramEnter()`:**
- Remove `position`, `scale` interpolation (diagram no longer has position/scale)
- Keep `fade` and `nodes`/`edges` interpolation
- The `to`/`from` vectors are now in [0..1] NVS viewport space, but they're applied as offsets to `viewportBounds` via a translation effect
- New interpretation: `exitConfig.to = [nvsX, nvsY, z]` means translate the diagram's viewport center to this NVS position at exit:

```typescript
export function applyDiagramExit(diagram: DiagramState, t: number): DiagramState {
  const config = diagram.exit;
  if (!config) {
    return { ...diagram, nodes: fadeNodesOut(diagram.nodes, t), edges: fadeEdgesOut(diagram.edges, t) };
  }
  const et = applyEasing(t, config.easing);

  // Translate viewportBounds center toward config.to
  let viewportBounds = diagram.viewportBounds;
  if (config.to) {
    const cx = diagram.viewportBounds.x + diagram.viewportBounds.w / 2;
    const cy = diagram.viewportBounds.y + diagram.viewportBounds.h / 2;
    const tx = cx + (config.to[0] - cx) * et;
    const ty = cy + (config.to[1] - cy) * et;
    viewportBounds = {
      x: tx - diagram.viewportBounds.w / 2,
      y: ty - diagram.viewportBounds.h / 2,
      w: diagram.viewportBounds.w,
      h: diagram.viewportBounds.h,
    };
  }

  const nodes = config.fade ? fadeNodesOut(diagram.nodes, et) : diagram.nodes;
  const edges = config.fade ? fadeEdgesOut(diagram.edges, et) : diagram.edges;
  return { ...diagram, viewportBounds, nodes, edges };
}
```

**Similarly for `applyDiagramEnter()` — translate from `config.from` to `diagram.viewportBounds`.**

**Update `functionalDiagramTransitionSpec.interpolateFn`:**
- Remove `position`, `rotation`, `scale` blending (these fields are gone)
- Add `viewportBounds` blending:
```typescript
viewportBounds: {
  x: lerpNum(from.viewportBounds.x, to.viewportBounds.x, t),
  y: lerpNum(from.viewportBounds.y, to.viewportBounds.y, t),
  w: lerpNum(from.viewportBounds.w, to.viewportBounds.w, t),
  h: lerpNum(from.viewportBounds.h, to.viewportBounds.h, t),
},
tiltRotation: blendVec3([...from.tiltRotation], [...to.tiltRotation], t) ?? to.tiltRotation,
```

### 4.4 `packages/diagram/src/elements/diagram/render.ts` (DiagramRenderer)

**Signature change:**
```typescript
// BEFORE:
update(state: DiagramState, parent: THREE.Object3D): void

// AFTER:
update(state: DiagramState, parent: THREE.Object3D, canvasState: DiagramCanvasState): void
```

**Core change — replace position/rotation/scale root group with viewport-to-world conversion:**

```typescript
update(state: DiagramState, parent: THREE.Object3D, canvasState: DiagramCanvasState): void {
  // ...
  const root = this.diagramGroups.get(state.id)!;

  // Compute the canvas aspect ratio at render time.
  // canvasState provides nvsBounds; the engine AR is read from the parent scene camera.
  // We pass canvasAspect down from DiagramCanvasRenderer (it has access to the camera).
  // The canvas root group has: position = canvas.position, scale = canvas.scale.
  // In canvas-local space, the range is:
  //   X: [-canvasAspect/2, +canvasAspect/2] (canvas width in canvas units)
  //   Y: [-0.5, +0.5] (canvas height in canvas units; scale handles world conversion)

  const vp = state.viewportBounds;  // { x, y, w, h } in [0..1] canvas NVS
  const canvasAspect = this._canvasAspect;  // set by DiagramCanvasRenderer before calling update()

  // Diagram root position = center of viewport bounds in canvas-local space
  const vpCX = vp.x + vp.w / 2;
  const vpCY = vp.y + vp.h / 2;
  const localX = (vpCX - 0.5) * canvasAspect;  // canvas-local X
  const localY = -(vpCY - 0.5);                 // canvas-local Y (Y-flip)

  root.position.set(localX, localY, 0);
  // Apply tilt rotation
  root.rotation.set(state.tiltRotation[0], state.tiltRotation[1], state.tiltRotation[2]);
  // NO uniform scale — the diagram root stays at canvas-local scale
  // Node positions [0..1] within the diagram get further converted in nodeToCanvasLocal()

  // ... render nodes, edges, groups with converted positions ...
}
```

**Add `nodeToCanvasLocal()` helper:**
```typescript
/**
 * Converts a node NVS position [0..1] within a diagram viewport
 * to canvas-local coordinates (center-origin, Y-up, before canvas.scale applied).
 *
 * @param nvsPos     Node [0..1] position within diagram
 * @param vp         Diagram viewportBounds within canvas [0..1]
 * @param aspect     Canvas aspect ratio (canvasWidth/canvasHeight in canvas units)
 */
function nodeNvsToCanvasLocal(
  nvsPos: readonly [number, number, number],
  vp: NVSRect,
  aspect: number,
): readonly [number, number, number] {
  // Map node [0..1] → diagram viewport [0..1] → canvas [0..1] → canvas-local
  const vpX = vp.x + vp.w * nvsPos[0];
  const vpY = vp.y + vp.h * nvsPos[1];
  const localX = (vpX - 0.5) * aspect;
  const localY = -(vpY - 0.5);   // Y-flip
  return [localX, localY, nvsPos[2]];
}

/**
 * Converts a node NVS size [w, h] fractions to canvas-local units.
 */
function nodeSizeToCanvasLocal(
  nvsSize: readonly [number, number],
  vp: NVSRect,
  aspect: number,
): readonly [number, number] {
  return [nvsSize[0] * vp.w * aspect, nvsSize[1] * vp.h];
}
```

**In `DiagramRenderer.update()`, convert all node states before passing to NodeRenderer:**
```typescript
for (const nodeState of state.nodes) {
  const canvasLocalPos = nodeNvsToCanvasLocal(nodeState.position, state.viewportBounds, this._canvasAspect);
  const canvasLocalSize = nodeSizeToCanvasLocal(nodeState.size, state.viewportBounds, this._canvasAspect);

  // Create a converted node state with world-ready coordinates
  const convertedNode: DiagramNodeState = {
    ...nodeState,
    position: canvasLocalPos,
    size: canvasLocalSize,
    // thickness stays in canvas world units (unchanged)
  };
  this.nodeRenderer!.getOrCreate(convertedNode, state.id, tc, root);
}
```

**For edges — convert control points from [0..1] NVS to canvas-local BEFORE passing to EdgeRenderer:**

Control points are produced by `routeEdges()` using normalized [0..1] positions. They are NOT yet in canvas-local space. EdgeRenderer uses control points directly as Three.js local coordinates (relative to the canvas group), so conversion is mandatory.

```typescript
for (const edgeState of state.edges) {
  const convertedEdge: DiagramEdgeState = {
    ...edgeState,
    controlPoints: edgeState.controlPoints.map((cp) =>
      nodeNvsToCanvasLocal(cp, state.viewportBounds, this._canvasAspect),
    ),
  };
  this.edgeRenderer!.getOrCreate(convertedEdge, state.id, tc, root);
}
```

This replaces the previous plan comment that EdgeRenderer "needs no changes." **EdgeRenderer itself is unchanged** — the conversion happens here in DiagramRenderer before the state is passed down. The Stream 3 task for EdgeRenderer changes from "VERIFY no changes needed" to "VERIFY EdgeRenderer itself needs no changes (conversion happens in DiagramRenderer.update() above)".

**For groups — convert group bounds to canvas-local BEFORE passing to GroupRenderer:**

Critical sign convention: GroupRenderer.updateGroup() computes `centerX = bounds.x + bounds.w/2; centerY = bounds.y + bounds.h/2` and calls `group.position.set(centerX, centerY, -0.6)`. Canvas-local Y is Y-up (+Y = top, -Y = bottom). To make `bounds.y + bounds.h/2` equal the correct canvas-local center Y, `bounds.y` must be the canvas-local **BOTTOM edge** (not the NVS top edge).

Derivation for a group at NVS `[y_nvs, y_nvs + h_nvs]`:
- Canvas-local bottom = `0.5 - (y_nvs + h_nvs)`  (Y-flip from NVS top edge)
- GroupRenderer centerY = `bottom + h/2 = 0.5 - y_nvs - h_nvs + h_nvs/2 = 0.5 - y_nvs - h_nvs/2` ✓
- This equals `-(y_nvs + h_nvs/2 - 0.5)` = canvas-local Y of NVS center ✓

```typescript
for (const groupState of state.groups) {
  const nvsHalfW = groupState.bounds.w / 2;
  const nvsHalfH = groupState.bounds.h / 2;
  const localW = groupState.bounds.w * this._canvasAspect * state.viewportBounds.w;
  const localH = groupState.bounds.h * state.viewportBounds.h;
  const localHalfW = localW / 2;
  const localHalfH = localH / 2;

  // bounds.x = canvas-local LEFT edge (not center)
  // bounds.y = canvas-local BOTTOM edge (not NVS top) — required by GroupRenderer's centerY formula
  const localX = (state.viewportBounds.x + state.viewportBounds.w * groupState.bounds.x - 0.5) * this._canvasAspect;
  const localY = 0.5 - (state.viewportBounds.y + state.viewportBounds.h * (groupState.bounds.y + groupState.bounds.h));

  // Rescale edge light positions from NVS-group-local space to canvas-local space.
  // compileEdgeLights() computed positions using halfW/halfH in [0..1] NVS fractions.
  // GroupRenderer places lights as group-local THREE.js coordinates (canvas-local units).
  // Scale: position[0] * (canvasHalfW / nvsHalfW), position[1] * (canvasHalfH / nvsHalfH).
  const convertedEdgeLights: DiagramGroupEdgeLightsState | undefined = groupState.edgeLights && nvsHalfW > 0 && nvsHalfH > 0
    ? {
        ...groupState.edgeLights,
        lights: groupState.edgeLights.lights.map((light) => ({
          ...light,
          position: [
            light.position[0] * (localHalfW / nvsHalfW),
            light.position[1] * (localHalfH / nvsHalfH),
            light.position[2],  // Z (border height offset) stays in canvas world units
          ] as readonly [number, number, number],
        })),
      }
    : groupState.edgeLights;

  const convertedGroup: DiagramGroupState = {
    ...groupState,
    bounds: {
      x: localX,           // canvas-local LEFT edge
      y: localY,           // canvas-local BOTTOM edge (Y-up) — NOT the NVS top
      w: localW,
      h: localH,
      padding: [
        groupState.bounds.padding[0] * state.viewportBounds.h,  // top — vertical fraction → canvas units
        groupState.bounds.padding[1] * state.viewportBounds.w * this._canvasAspect,  // right
        groupState.bounds.padding[2] * state.viewportBounds.h,  // bottom
        groupState.bounds.padding[3] * state.viewportBounds.w * this._canvasAspect,  // left
      ] as readonly [number, number, number, number],
      titleGap: groupState.bounds.titleGap * state.viewportBounds.h,
    },
    edgeLights: convertedEdgeLights,
  };
  this.groupRenderer!.getOrCreate(convertedGroup, state.id, root, tc);
}
```

Note: GroupRenderer.updateGroup() does `centerX = bounds.x + bounds.w/2; centerY = bounds.y + bounds.h/2`. With `bounds.y` = canvas-local BOTTOM and `bounds.h` = canvas-local height, `centerY = localY + localH/2` correctly positions the group at the NVS center. ✓

**Add `setCanvasAspect(aspect: number): void` method to `DiagramRenderer`:**
```typescript
private _canvasAspect: number = 16 / 9;
setCanvasAspect(aspect: number): void { this._canvasAspect = aspect; }
```

### 4.5 `packages/diagram/src/elements/diagram/canvas/render.ts` (DiagramCanvasRenderer)

**Add canvas aspect computation and propagate to DiagramRenderer:**

```typescript
update(state: DiagramCanvasState, scene: THREE.Scene): void {
  // ...
  this.canvasGroup.position.set(state.position[0], state.position[1], state.position[2]);
  this.canvasGroup.rotation.set(state.rotation[0], state.rotation[1], state.rotation[2]);
  this.canvasGroup.scale.setScalar(state.scale);

  // Compute canvas aspect ratio from scene camera and nvsBounds
  const cam = scene.userData['__brewsite_camera'] as THREE.PerspectiveCamera | undefined;
  const engineAspect = cam?.aspect ?? 16 / 9;
  const canvasAspect = (state.nvsBounds.w / state.nvsBounds.h) * engineAspect;

  // ...
  for (const diagramState of state.diagrams) {
    if (!this.diagramRenderers.has(diagramState.id)) {
      this.diagramRenderers.set(diagramState.id, new DiagramRenderer());
    }
    const dr = this.diagramRenderers.get(diagramState.id)!;
    dr.setCanvasAspect(canvasAspect);  // NEW: propagate aspect before update
    dr.update(diagramState, this.canvasGroup, state);  // pass canvasState
  }
  // ...
}
```

### 4.6 `packages/diagram/src/elements/diagram/canvas/compile.ts`

**`nodeToCanvasSpace()` — must be updated for pipe routing since diagram no longer has position/scale/rotation:**

The pipe router (`compilePipe`) calls `nodeToCanvasSpace(nodePos, diagramPos, diagramScale, diagramRotation)` to convert a node's diagram-local position to canvas-local space. After the change, the diagram has `viewportBounds` and `tiltRotation` instead.

```typescript
// BEFORE:
function nodeToCanvasSpace(nodeLocalPos: Vec3, diagramPos: Vec3, diagramScale: number, diagramRotation: Vec3): Vec3 {
  const scaled = [nodeLocalPos[0] * diagramScale, ...];
  const rotated = rotateXYZ(scaled, ...);
  return [rotated[0] + diagramPos[0], ...];
}

// AFTER:
function nodeNvsToCanvasLocal(
  nodeNvsPos: Vec3,
  viewportBounds: NVSRect,
  tiltRotation: Vec3,
  canvasAspect: number,
): Vec3 {
  const vpX = viewportBounds.x + viewportBounds.w * nodeNvsPos[0];
  const vpY = viewportBounds.y + viewportBounds.h * nodeNvsPos[1];
  const localX = (vpX - 0.5) * canvasAspect;
  const localY = -(vpY - 0.5);   // Y-flip
  const localZ = nodeNvsPos[2];
  return rotateXYZ([localX, localY, localZ], tiltRotation[0], tiltRotation[1], tiltRotation[2]);
}
```

**`compilePipe()` — update to use new conversion:**
```typescript
// Instead of:
nodeToCanvasSpace(fromNode.position, fromDiagram.position, fromDiagram.scale, fromDiagram.rotation)
// Use:
nodeNvsToCanvasLocal(fromNode.position, fromDiagram.viewportBounds, fromDiagram.tiltRotation, DEFAULT_CANVAS_ASPECT)
```

**Problem:** `compilePipe()` runs at compile time (no camera available) so it needs a default canvas aspect. Use `16/9` as the default. This is a known approximation — pipes are re-routed at runtime if needed via `rerouteLivePipes`.

**Add `DEFAULT_CANVAS_ASPECT = 16 / 9` constant in `canvas/compile.ts`.**

**Node size for pipe attachment needs canvas-local conversion too:**
```typescript
// Node size in canvas-local for attachment point computation:
const nodeLocalSize: readonly [number, number, number] = [
  fromNode.size[0] * fromDiagram.viewportBounds.w * DEFAULT_CANVAS_ASPECT,
  fromNode.size[1] * fromDiagram.viewportBounds.h,
  fromNode.thickness,
];
```

**`transitionHelpers.ts` — `rerouteLivePipes()` must use the new conversion:**
The `rerouteLivePipes` function uses `nodeToCanvasSpace`. Update it to call `nodeNvsToCanvasLocal`. The `DEFAULT_CANVAS_ASPECT` is used here too (runtime re-routing also lacks camera access).

### 4.7 `packages/diagram/src/elements/diagram/canvas/widget.ts` (DiagramCanvasWidget)

**Remove `onTick` auto-framing. Replace with deterministic camera setup.**

```typescript
// REMOVE the entire onTick method body (lines 143-207 in current widget.ts).
// Replace with a no-op OR remove IAnimationController implementation entirely
// since it was only needed for auto-framing.

// OPTION A: Remove IAnimationController from implements list entirely.
// OPTION B: Keep a stub for the focus orbit system:
onTick(_context: AnimationTickContext): void {
  // Auto-framing removed. Camera is set deterministically in apply().
  // Interactive zoom-to-group is handled via applyInputFocus() → focusMesh()/focusAll().
}
```

**Add deterministic camera setup in `apply()`:**

```typescript
apply(state: DiagramCanvasState, _ctx: WidgetRenderContext): void {
  this.currentInputActions = state.defaultInputActions;
  if (!this.scene) return;

  // Set up the diagram canvas camera deterministically based on canvas.scale and fov.
  const cam = this.scene.userData['__brewsite_camera'] as THREE.PerspectiveCamera | undefined;
  const rawCamState = /* check if user Camera widget is active -- same logic as before */;
  const cameraActive = /* same check as before */;

  if (!cameraActive && cam) {
    // Camera is not authored → set deterministic position based on canvas.scale
    // dist = canvas.scale / (2 * tan(FOV/2)) — framing the [0..1] canvas height in view
    const fovRad = THREE.MathUtils.degToRad(cam.fov || 45);
    const dist = state.scale / (2 * Math.tan(fovRad / 2));
    const [cpx, cpy, cpz] = state.position;
    cam.position.set(cpx, cpy, cpz + dist);
    cam.lookAt(cpx, cpy, cpz);
  }

  // ... rest of apply (effectiveState construction, renderer.update) ...
}
```

**Update `focusAll()` — remove the bounds-scanning loop that scanned `diagram.bounds`:**
```typescript
// BEFORE: scans diagram.bounds (diagram units)
// AFTER: the canvas extent is now fixed by canvas.scale and viewportBounds
// focusAll uses the canvas bounding box in world-space:
private focusAll(cam: THREE.PerspectiveCamera, focusCenter?: /* ... */): void {
  if (!this.scene || !this.lastState) return;
  const state = this.lastState;
  const [cpx, cpy, cpz] = state.position;
  // Full canvas in canvas-local: X ∈ [-aspect/2, aspect/2], Y ∈ [-0.5, 0.5]
  // In world: multiply by canvas.scale
  const cam2 = this.scene.userData['__brewsite_camera'] as THREE.PerspectiveCamera | undefined;
  const engineAspect = cam2?.aspect ?? 16 / 9;
  const canvasAspect = (state.nvsBounds.w / state.nvsBounds.h) * engineAspect;
  const worldW = canvasAspect * state.scale;
  const worldH = state.scale;
  // ... rest of focus logic using worldW/worldH bounding box ...
}
```

### 4.8 `packages/diagram/src/elements/diagram/canvas/types.ts` (DiagramCanvasState)

No new fields needed. `DiagramCanvasState` remains unchanged. Canvas aspect is computed at render time.

**`DiagramPipeState.controlPoints`** — the JSDoc comment update:
```typescript
// BEFORE: "Control points in canvas-local space."
// AFTER: "Control points in canvas-local space (center-origin, canvasScale world units per unit)."
```

**`DiagramState` reference in `DiagramCanvasState.diagrams`** — automatically updated since DiagramState changes.

### 4.9 `packages/diagram/src/elements/diagram/compiler/transitionHelpers.ts`

**`blendDiagramNodes()`** — unchanged (blends positions via `blendVec3`, works for [0..1] too).

**`buildLiveNodeMaps()`** — unchanged.

**`rerouteLiveEdges()`** — unchanged (takes positions and sizes as-is, passes to routeEdges). After normalization, positions are [0..1] and sizes are [0..1] fractions — routeEdges is scale-invariant.

**`rerouteLivePipes()`** — must update to use `nodeNvsToCanvasLocal`:
```typescript
// Import nodeNvsToCanvasLocal from canvas/compile.ts or a shared location
// Replace nodeToCanvasSpace calls with nodeNvsToCanvasLocal
```

---

## 5. Canvas DSL and Handlers

### 5.1 `packages/diagram/src/elements/diagram/canvas/dsl.tsx`

**DiagramProps in dsl.tsx** — already has `position?: readonly [number, number, number]` on the canvas Diagram component. Replace with:
```typescript
// DiagramCanvas child Diagram props:
viewportBounds?: NVSRect;   // { x, y, w, h } in [0..1] canvas-local
tilt?: [number, number, number];
// REMOVE: position, rotation, scale, pivot
```

### 5.2 `packages/diagram/src/compiler/handlers.ts`

The diagram DSL handler that compiles `<Diagram>` inside `<DiagramCanvas>` currently extracts `position`, `rotation`, `scale`, `pivot` from the JSX props and calls `compileDiagram()`.

**Update to extract `viewportBounds` and `tilt`:**
```typescript
// Extract from JSX props:
const viewportBounds: NVSRect = props.viewportBounds ?? { x: 0, y: 0, w: 1, h: 1 };
const tilt: [number, number, number] = props.tilt ?? [0, 0, 0];

// Pass to compileDiagram:
const dsl: DiagramDSL = {
  ...extractedDsl,
  viewportBounds,
  tilt,
  // REMOVE: position, rotation, scale, pivot
};
```

**`DiagramDSL` type** — update to include `viewportBounds?: NVSRect` and `tilt?: [number, number, number]`, remove `position`, `rotation`, `scale`, `pivot`.

---

## 6. ImagePanel and Screen Changes

### 6.1 `packages/diagram/src/elements/image-panel/types.ts`

**`ImagePanelState` — before:**
```typescript
interface ImagePanelState {
  position: readonly [number, number, number];  // world-space Vec3
  width: number;    // world units
  height: number | undefined;  // world units
  // ...
}
```

**`ImagePanelState` — after:**
```typescript
interface ImagePanelState {
  /**
   * NVS horizontal center position [0..1]. 0 = left edge, 1 = right edge.
   * Converted to world-space X at render time using the active camera.
   */
  nvsX: number;
  /**
   * NVS vertical center position [0..1]. 0 = top edge, 1 = bottom edge.
   * Converted to world-space Y at render time (Y-flip applied in render layer).
   */
  nvsY: number;
  /**
   * World-space depth (Z) of the panel center. Default: 0.
   * Kept as world-space because it controls the 3D depth position.
   */
  z: number;
  /**
   * NVS width fraction [0..1] — fraction of the AR container width.
   * Converted to world-space width at render time.
   */
  nvsWidth: number;
  /**
   * NVS height fraction [0..1] — fraction of the AR container height.
   * If undefined, derived from nvsWidth × image aspect ratio at texture load time.
   */
  nvsHeight: number | undefined;
  rotation: readonly [number, number, number];  // Euler XYZ radians (unchanged)
  scale: number;                                // Unchanged — multiplied on top of NVS sizing
  // ... all other fields unchanged (bezel, gloss, etc.)
}
```

**`ImagePanelDSL` — after:**
```typescript
interface ImagePanelDSL {
  // position replaced with:
  x?: number;        // NVS center X [0..1], default 0.5
  y?: number;        // NVS center Y [0..1], default 0.5
  z?: number;        // world-space depth, default 0
  width?: number;    // NVS width fraction [0..1], default 0.5
  height?: number;   // NVS height fraction [0..1], optional (derived from aspect ratio)
  // REMOVE: position?: readonly [number, number, number]
  rotation?: readonly [number, number, number];
  scale?: number;
  // ... rest unchanged
}
```

### 6.2 `packages/diagram/src/elements/image-panel/compile.ts`

```typescript
export function compileImagePanel(dsl: ImagePanelDSL): ImagePanelState {
  return {
    id: dsl.id,
    src: dsl.src,
    nvsX: dsl.x ?? 0.5,
    nvsY: dsl.y ?? 0.5,
    z: dsl.z ?? 0,
    nvsWidth: dsl.width ?? 0.5,
    nvsHeight: dsl.height,
    rotation: dsl.rotation ?? [0, 0, 0],
    scale: dsl.scale ?? 1,
    // ... rest unchanged
  };
}
```

**Transition spec** — update `interpolateFn` to blend `nvsX`, `nvsY`, `z`, `nvsWidth`, `nvsHeight`:
```typescript
interpolateFn: (from, to) => (ctx) => ({
  ...to,
  nvsX: lerpNum(from.nvsX, to.nvsX, ctx.t),
  nvsY: lerpNum(from.nvsY, to.nvsY, ctx.t),
  z: lerpNum(from.z, to.z, ctx.t),
  nvsWidth: lerpNum(from.nvsWidth, to.nvsWidth, ctx.t),
  nvsHeight: from.nvsHeight !== undefined && to.nvsHeight !== undefined
    ? lerpNum(from.nvsHeight, to.nvsHeight, ctx.t)
    : to.nvsHeight,
  opacity: blendOpacity(from.opacity, to.opacity, ctx.t) ?? to.opacity,
  // ...
}),
```

### 6.3 `packages/diagram/src/elements/image-panel/render.ts` (ImagePanelRenderer / widget.ts)

**In `widget.ts` ImagePanelWidget.apply():**
```typescript
apply(state: ImagePanelState, _ctx: WidgetRenderContext): void {
  // Derive world-space position from NVS + camera
  const cam = this.scene?.userData['__brewsite_camera'] as THREE.PerspectiveCamera | undefined;
  const worldPos = cam
    ? nvsToWorldWithCamera(state.nvsX, state.nvsY, cam, state.z)
    : nvsToWorldAnalytic(state.nvsX, state.nvsY, 0, 0, 12.07, 45, 16/9, state.z);

  // Derive world dimensions from NVS fractions + camera
  let worldWidth: number;
  let worldHeight: number | undefined;
  if (cam) {
    const { worldWidth: ww, worldHeight: wh } = computeWorldDimensionsFromCamera(cam, state.z);
    worldWidth = state.nvsWidth * ww;
    worldHeight = state.nvsHeight !== undefined ? state.nvsHeight * wh : undefined;
  } else {
    const { worldWidth: ww, worldHeight: wh } = computeWorldDimensions(12.07, 45, 16/9);
    worldWidth = state.nvsWidth * ww;
    worldHeight = state.nvsHeight !== undefined ? state.nvsHeight * wh : undefined;
  }

  this.renderer.update({
    ...state,
    position: worldPos,
    width: worldWidth,
    height: worldHeight,
  });
}
```

**Add `computeWorldDimensionsFromCamera()` in `nvsWorldBridge.ts`:**
```typescript
export function computeWorldDimensionsFromCamera(
  camera: { fov: number; aspect: number; position: { z: number } },
  targetZ: number = 0,
): { worldWidth: number; worldHeight: number } {
  const d = camera.position.z - targetZ;
  return computeWorldDimensions(d, camera.fov, camera.aspect);
}
```

The actual `render.ts` file of ImagePanel continues to accept world-space `position` and `width`/`height` — the render layer is unchanged. The conversion happens in the widget layer.

### 6.4 `packages/diagram/src/elements/screen/types.ts` and `compile.ts`

Identical pattern to ImagePanel:
- Replace `position: readonly [number, number, number]` → `nvsX, nvsY, z`
- Replace `width: number; height: number` → `nvsWidth: number; nvsHeight: number`
- Compile: `nvsX = dsl.x ?? 0.5; nvsY = dsl.y ?? 0.5; z = dsl.z ?? 0`
- Widget applies NVS → world conversion before passing to renderer

**DSL props:**
```typescript
interface ScreenDSL {
  x?: number;      // NVS center X [0..1], default 0.5
  y?: number;      // NVS center Y [0..1], default 0.5
  z?: number;      // world-space depth, default 0
  width?: number;  // NVS width fraction [0..1], default 0.625 (10/16 of viewport width = 12/19.2 ref)
  height?: number; // NVS height fraction [0..1], default ~0.390625 (7.5/19.2 ref for 16:9)
  // REMOVE: position?: readonly [number, number, number]
  // ... rest unchanged
}
```

Default NVS dimensions for Screen (derived from old defaults `width=12, height=7.5` at `worldWidth≈17.78`):
```
nvsWidth  default = 0.625    (12 / 17.78 * 0.925 ≈ 0.625, adjusted for typical scene)
nvsHeight default = undefined (derived from width × image aspect ratio = 16/9)
```

---

## 7. Model Package Changes

### 7.1 `packages/model/src/elements/model/types.ts`

**`SceneModel` — before:**
```typescript
type SceneModel = {
  scale: number;
  position: Vec3;   // world-space [x, y, z]
  rotation: Vec3;
  // ...
};
```

**`SceneModel` — after:**
```typescript
type SceneModel = {
  scale: number;
  /**
   * NVS horizontal center position [0..1]. 0 = left, 1 = right.
   * Converted to world X at render time using the active camera.
   * Default: center of nvsBounds = (nvsBounds.x + nvsBounds.w / 2).
   */
  nvsX: number;
  /**
   * NVS vertical center position [0..1]. 0 = top, 1 = bottom.
   * Default: center of nvsBounds = (nvsBounds.y + nvsBounds.h / 2).
   */
  nvsY: number;
  /**
   * World-space Z depth of the model center. Default: 0.
   */
  z: number;
  rotation: Vec3;   // Unchanged — Euler XYZ radians
  // ... all other fields unchanged
};
```

**`SceneModelInstanceState`** — unchanged (nvsBounds already present).

### 7.2 `packages/model/src/elements/model/dsl.tsx`

**Before:** `position?: Vec3`
**After:** Remove `position` prop. The model center in X,Y = center of its NVS bounds (`x + w/2, y + h/2`). Add `z?: number` for world-space depth.

```typescript
interface ModelDSLProps {
  // NVS bounds (already present as x, y, w, h):
  x?: number;   // NVS bounds left edge [0..1]
  y?: number;   // NVS bounds top edge [0..1]
  w?: number;   // NVS bounds width [0..1]
  h?: number;   // NVS bounds height [0..1]
  /** World-space depth of model center. Default: 0 */
  z?: number;
  // REMOVE: position?: Vec3
  // ... rest unchanged
}
```

### 7.3 `packages/model/src/elements/model/compile.ts`

**`compileModel()` or equivalent:** Derive `nvsX, nvsY` from bounds:
```typescript
// BEFORE:
model: { position: dsl.position ?? [0, 0, 0], ... }

// AFTER:
const nx = dsl.x !== undefined && dsl.w !== undefined
  ? dsl.x + dsl.w / 2
  : (dsl.x ?? 0) + (dsl.w ?? 1) / 2;
const ny = dsl.y !== undefined && dsl.h !== undefined
  ? dsl.y + dsl.h / 2
  : (dsl.y ?? 0) + (dsl.h ?? 1) / 2;

model: { nvsX: nx, nvsY: ny, z: dsl.z ?? 0, ... }
```

### 7.4 `packages/model/src/elements/model/ModelWidget.ts`

**Architectural decision — no `_worldPosition` on `SceneModel`.**

`SceneModel` (the compiled state type) stores NVS coordinates. `ModelRenderer` still consumes world-space position. These are different data shapes: the widget is the translation layer. The solution is a private `ModelRenderInput` type, local to `ModelWidget.ts`, that is never exported and never touches `types.ts`.

**Add `ModelRenderInput` type to `packages/model/src/elements/model/ModelWidget.ts`:**
```typescript
// Private to ModelWidget — not exported, not in types.ts, not in index.ts.
// ModelRenderer accepts this in place of SceneModel (drop-in: same fields except
// nvsX/nvsY/z replaced by position: Vec3).
type ModelRenderInput = Omit<SceneModel, 'nvsX' | 'nvsY' | 'z'> & {
  readonly position: Vec3;
};
```

**Update `ModelRenderer` to accept `ModelRenderInput` instead of `SceneModel`:**
- File: `packages/model/src/elements/model/ModelRenderer.ts`
- Change `apply(model: SceneModel, ...)` signature to `apply(model: ModelRenderInput, ...)`
- No other changes — ModelRenderer already uses `model.position` for Three.js placement.
- `ModelRenderInput` is importable by `ModelRenderer` from `ModelWidget.ts` (same directory), OR
  better: define it in a private `_renderTypes.ts` file alongside the renderer — never re-exported from `index.ts`.

**`apply()` in `ModelWidget.ts`:**
```typescript
apply(state: SceneModelInstanceState, _ctx: WidgetRenderContext): void {
  const cam = this.scene?.userData['__brewsite_camera'] as THREE.PerspectiveCamera | undefined;
  const worldPos = cam
    ? nvsToWorldWithCamera(state.model.nvsX, state.model.nvsY, cam, state.model.z)
    : nvsToWorldAnalytic(state.model.nvsX, state.model.nvsY, 0, 0, 12.07, 45, 16/9, state.model.z);

  // Translate compiled NVS state to the renderer's world-space input type.
  const { nvsX: _nx, nvsY: _ny, z: _z, ...modelRest } = state.model;
  const renderInput: ModelRenderInput = { ...modelRest, position: worldPos };
  this.renderer.apply({ ...state, model: renderInput });
}
```

The key constraint is met: `types.ts` has no world-space position on `SceneModel`. `compile.ts` has no Three.js. `ModelRenderer` has a stable API (world-space position, same as before). `ModelWidget.ts` is the translation boundary.

### 7.5 Transition spec update (`packages/model/src/elements/model/compile.ts`)

Update the `ElementTransitionSpec` to interpolate `nvsX, nvsY, z` instead of `position: Vec3`:
```typescript
// In interpolate():
nvsX: lerpNum(from.model.nvsX, to.model.nvsX, t),
nvsY: lerpNum(from.model.nvsY, to.model.nvsY, t),
z: lerpNum(from.model.z, to.model.z, t),
// REMOVE: position interpolation
```

---

## 8. Charts Package Changes

### 8.1 `packages/charts/src/elements/chart/types.ts`

**`ChartState` — before:**
```typescript
type ChartState = {
  position: readonly [number, number, number];  // world-space Vec3
  bounds: { width: number; height: number; depth: number };  // world units
  nvsBounds: NVSRect;
  // ...
};
```

**`ChartState` — after:**
```typescript
type ChartState = {
  /**
   * NVS center position [0..1]. Derived from nvsBounds center at compile time.
   * nvsX = nvsBounds.x + nvsBounds.w / 2
   * nvsY = nvsBounds.y + nvsBounds.h / 2
   * Converted to world-space X,Y at render time.
   */
  nvsX: number;
  nvsY: number;
  /** World-space depth. Replaces position[2]. Default: 0. */
  z: number;
  /**
   * Chart physical size in world units (relative to the chart itself, not viewport).
   * These are unchanged — they control the 3D chart geometry proportions.
   */
  bounds: { width: number; height: number; depth: number };
  nvsBounds: NVSRect;  // unchanged — ownership declaration
  // REMOVE: position: readonly [number, number, number]
  // ...
};
```

**`DEFAULT_CHART_STATE`:**
```typescript
export const DEFAULT_CHART_STATE: ChartState = {
  nvsX: 0.5,
  nvsY: 0.5,
  z: 0,
  bounds: { width: 4, height: 3, depth: 0.4 },
  nvsBounds: { x: 0, y: 0, w: 1, h: 1 },
  // ...
};
```

**`ChartDSL`** — remove `position`, keep `x, y, w, h` (already present for nvsBounds). Add `z?: number`.

### 8.2 `packages/charts/src/elements/chart/compile.ts`

```typescript
// BEFORE:
position: dsl.position ?? DEFAULT_CHART_STATE.position,

// AFTER:
nvsX: (dsl.x ?? 0) + (dsl.w ?? 1) / 2,
nvsY: (dsl.y ?? 0) + (dsl.h ?? 1) / 2,
z: dsl.z ?? 0,
```

### 8.3 `packages/charts/src/elements/chart/ChartWidget.ts`

**`apply()` — same NVS → world conversion pattern:**
```typescript
apply(state: ChartState, _ctx: WidgetRenderContext): void {
  const cam = this.scene?.userData['__brewsite_camera'] as THREE.PerspectiveCamera | undefined;
  const worldPos = cam
    ? nvsToWorldWithCamera(state.nvsX, state.nvsY, cam, state.z)
    : nvsToWorldAnalytic(state.nvsX, state.nvsY, 0, 0, 12.07, 45, 16/9, state.z);

  this.renderer.update({
    ...state,
    worldPosition: worldPos,
  });
}
```

The chart click-region scoping (which uses `nvsBounds`) is unchanged.

---

## 9. Camera — Optional NVS Target

The camera `position` and `target` stay world-space. This is non-negotiable: the camera IS the coordinate origin for everything else. However, to allow authors to specify a camera look-at point in NVS terms, add an optional `nvsTarget` prop to camera types:

**`packages/core/src/elements/camera/types.ts`:**
```typescript
// Add to camera orbit and world modes:
/**
 * NVS [x, y] override for the camera look-at center.
 * When set, overrides target[0] and target[1] with NVS-derived world coordinates.
 * target[2] (world Z) is still used.
 * Requires CameraWidget.apply() to read the current engineAR from the renderer.
 */
nvsTarget?: readonly [number, number];
```

**`packages/core/src/elements/camera/render.ts`:**
When `state.nvsTarget` is set, compute world X,Y from NVS using the camera's own FOV and current distance to the target Z:
```typescript
if (state.nvsTarget) {
  // Camera is looking at nvsTarget in NVS space
  // We need the world extents at the target Z plane
  const targetZ = state.target?.[2] ?? 0;
  const dist = Math.abs(state.position?.[2] ?? 12) - targetZ;
  const worldXY = nvsToWorldAnalytic(state.nvsTarget[0], state.nvsTarget[1], 0, 0, dist, state.fov ?? 45, ar);
  resolvedTarget = [worldXY[0], worldXY[1], targetZ];
}
```

---

## 10. Scene Migration Guide

### 10.1 Diagram Manual Layout Node Positions

For all `<DiagramNode position={[x, y, z]}>` in `<ManualLayout>` scenes, positions must be converted from diagram units to [0..1] NVS.

**Conversion algorithm (run per diagram):**

```
Given: a list of (id, position, size) for all nodes in the diagram

1. Collect all authored positions and sizes (in diagram units)
2. Apply the existing pivot offset (if pivot="center", shift all positions by -center)
3. Compute bounding box:
   minX = min(pos[0] - size[0]/2)
   maxX = max(pos[0] + size[0]/2)
   minY = min(pos[1] - size[1]/2)
   maxY = max(pos[1] + size[1]/2)
4. padding = 1.5 (the default groupPadding in diagram units)
5. spanX = (maxX - minX) + 2 * 1.5
   spanY = (maxY - minY) + 2 * 1.5
   originX = minX - 1.5
   originY = minY - 1.5  (Cartesian bottom)
6. For each node:
   new_x = (pos[0] - originX) / spanX
   new_y = 1 - (pos[1] - originY) / spanY  ← Y-FLIP (Cartesian Y-up → NVS Y-down)
   new_w = size[0] / spanX
   new_h = size[1] / spanY
7. Replace: position={[pos[0], pos[1], z]} → position={[new_x, new_y, z]}
            size={[w, h]} → size={[new_w, new_h]}
```

**Example: whiteboard diagram node `position={[-27, 4, 0]} size={[5, 4]}`:**

First, collect all whiteboard nodes. The full whiteboard has positions ranging approximately:
- X: [-27, +52] → span ≈ 79 diagram units
- Y: [-15, +20] → span ≈ 35 diagram units (including group padding)

With pivot="center", positions are already centered. After applying the formula (assuming bounding box min/max from the full whiteboard diagram):
```
// Full whiteboard approximate bounds (from diagram.tsx):
// Nodes span roughly X: -27 to +53, Y: -15 to +21
// After padding 1.5: spanX≈83, spanY≈40, originX≈-28.5, originY≈-16.5

// Node: id="peas" position=[-27, 4, 0] size=[5, 4]
new_x = (-27 - (-28.5)) / 83 = 1.5 / 83 ≈ 0.018
new_y = 1 - (4 - (-16.5)) / 40 = 1 - 20.5/40 ≈ 0.49
new_w = 5 / 83 ≈ 0.060
new_h = 4 / 40 = 0.100
```

**The developer bot migration process:**
1. Open each ManualLayout scene file
2. Collect all node positions and sizes from the `<Diagram>` block
3. Compute the diagram's overall bounding box (accounting for pivot="center" offset)
4. Apply the conversion formula to each node
5. Round to 4 decimal places
6. Remove `pivot="center"` from `<Diagram>`
7. Replace `position={[...]}` and `size={[...]}` with converted values

### 10.2 Diagram Position → viewportBounds

For each `<Diagram position={[x, y, z]}>` inside a `<DiagramCanvas>`, replace with `viewportBounds`:

**Common pattern — two vertical diagrams stacked:**
```tsx
// BEFORE:
<DiagramCanvas id="canvas" position={[0, 0, 0]} scale={config.diagramScale}>
  <Diagram id="top" pivot="center" position={[0, 6, 0]}>...</Diagram>
  <Diagram id="bottom" pivot="center" position={[0, -5, 0]}>...</Diagram>
</DiagramCanvas>

// AFTER:
<DiagramCanvas id="canvas" position={[0, 0, 0]} scale={config.diagramScale}>
  <Diagram id="top" viewportBounds={{ x: 0, y: 0, w: 1, h: 0.5 }}>...</Diagram>
  <Diagram id="bottom" viewportBounds={{ x: 0, y: 0.5, w: 1, h: 0.5 }}>...</Diagram>
</DiagramCanvas>
```

For single-diagram canvases (the majority of scenes): no change needed — default viewportBounds is `{x:0,y:0,w:1,h:1}`.

### 10.3 DiagramExit / DiagramEnter Conversion

```tsx
// BEFORE (exits 50 diagram units below center — magic number):
<DiagramExit to={[0, -50, 0]} />

// AFTER (exits 1 full viewport height below — clear semantics):
<DiagramExit to={[0.5, 2, 0]} />

// Common exit patterns:
// Off bottom: to={[0.5, 2, 0]}     (2 = 1 viewport height below bottom edge)
// Off top:    to={[0.5, -1, 0]}    (-1 = 1 viewport height above top edge)
// Off left:   to={[-1, 0.5, 0]}
// Off right:  to={[2, 0.5, 0]}
```

### 10.4 Model/Chart Position Migration

```tsx
// Model BEFORE:
<Model id="robot" x={0.1} y={0.1} w={0.8} h={0.8} position={[0, 0, 0]} />
// Model AFTER:
<Model id="robot" x={0.1} y={0.1} w={0.8} h={0.8} z={0} />

// Chart BEFORE:
<Chart id="bar" x={0.5} y={0.2} w={0.45} h={0.7} position={[3, -1.5, 0]} bounds={{width:4,height:3}} />
// Chart AFTER:
<Chart id="bar" x={0.5} y={0.2} w={0.45} h={0.7} z={0} bounds={{width:4,height:3}} />
// (The NVS center derives world X,Y; bounds.width/height stays for chart geometry size)
```

### 10.5 ImagePanel / Screen Migration

```tsx
// ImagePanel BEFORE:
<ImagePanel id="panel" position={[0, 0, 0]} width={12} height={7.5} />
// ImagePanel AFTER:
<ImagePanel id="panel" x={0.5} y={0.5} width={0.6} z={0} />
// (width=0.6 = 60% of viewport width; height derived from image aspect ratio)

// Screen BEFORE:
<Screen id="screen" position={[0, 0, 0]} width={12} height={7.5} />
// Screen AFTER:
<Screen id="screen" x={0.5} y={0.5} width={0.625} z={0} />
```

### 10.6 Files Requiring Migration

**Diagram — ManualLayout node positions:**
- `apps/examples/src/whiteboard-arch/diagram.tsx` — ~60+ nodes
- `apps/examples/src/brewflow-sidecar/scenes/scene_architecture.tsx` — 2 diagrams with ManualLayout

**Diagram — `<Diagram position>` → viewportBounds:**

Run this command to get the definitive file list at migration time (count may differ if new files have been added):
```bash
grep -r "<Diagram " apps/ --include="*.tsx" -l | xargs grep -l "position="
```
Expected: ~34 files at time of writing. Treat the grep output as the authoritative list.

**Diagram — DiagramExit/Enter:**
```bash
grep -r "DiagramExit\|DiagramEnter" apps/ --include="*.tsx" -l
```
Expected: ~16 files.

**Model — remove `position` prop:**
```bash
grep -r "<Model " apps/ --include="*.tsx" -l | xargs grep -l "position="
```

**Chart, ImagePanel, Screen — remove `position` prop:**
```bash
grep -r "position=" apps/ --include="*.tsx" -l
```

**DiagramCanvas — remove explicit Camera needed for auto-framing:**
- Most `<Camera mode="world">` settings alongside `<DiagramCanvas>` can be removed
- Review each canvas scene to determine if the camera was authored for diagram framing (remove) or for a separate visual effect (keep)

**`apps/examples/src/slides-demo/` and `packages/slides/` — OUT OF SCOPE.**

These are new/untracked work-in-progress items. They are NOT migrated as part of this plan. If either uses diagram, model, chart, image-panel, or screen elements, those elements must be authored in NVS coordinates from the start (not with old world-space APIs). The developer implementing Stream 5 does not need to touch these paths.

---

## 11. Developer Work Streams

5 parallel work streams with explicit file ownership and dependency ordering.

### Stream 1: Infrastructure (must complete first — blocks Streams 2–5)

**Developer:** 1
**Files:**
1. `packages/core/src/layout/nvsWorldBridge.ts` — CREATE (new file)
2. `packages/core/src/layout/index.ts` — UPDATE (add exports)
3. `packages/core/src/index.ts` — UPDATE (add bridge exports)

**Sequence:** All three files in order, no parallelism within stream.
**Output dependency:** All other streams import from nvsWorldBridge.ts.
**Done when:** `pnpm --filter @brewsite/core typecheck` passes with the new exports visible.

---

### Stream 2: Diagram Types + Compile (depends on Stream 1)

**Developer:** 2
**Files:**
1. `packages/diagram/src/elements/diagram/types.ts` — UPDATE (DiagramState, DiagramNodeState, DiagramGroupState.bounds, DiagramExitConfig, DiagramEnterConfig; remove DiagramPivot)
2. `packages/diagram/src/elements/diagram/dsl.tsx` — UPDATE (DiagramProps, DiagramNodeProps, DiagramExitProps JSDoc)
3. `packages/diagram/src/elements/diagram/compile.ts` — UPDATE (add normalizeToViewport, remove compilePivotOffset, update compileDiagram, update applyDiagramExit/Enter, update functionalDiagramTransitionSpec)
4. `packages/diagram/src/elements/diagram/compiler/groupCompiler.ts` — UPDATE (GroupBounds type comment only; normalization happens in compile.ts)
5. `packages/diagram/src/elements/diagram/compiler/transitionHelpers.ts` — UPDATE (rerouteLivePipes call signature if needed)

**Sequence:** types.ts → dsl.tsx → compile.ts → groupCompiler.ts → transitionHelpers.ts
**Done when:** `pnpm --filter @brewsite/diagram typecheck` passes on diagram compile files.

---

### Stream 3: Diagram Renderers + Canvas (depends on Stream 2)

**Developer:** 3
**Files:**
1. `packages/diagram/src/elements/diagram/render.ts` — UPDATE (DiagramRenderer signature, nodeToCanvasLocal, setCanvasAspect)
2. `packages/diagram/src/elements/diagram/rendering/GroupRenderer.ts` — UPDATE (updateGroup uses new canvas-local bounds)
3. `packages/diagram/src/elements/diagram/rendering/EdgeRenderer.ts` — VERIFY (EdgeRenderer itself needs no changes; control point conversion from [0..1] NVS → canvas-local happens in DiagramRenderer.update() before passing edges down — see §4.4)
4. `packages/diagram/src/elements/diagram/canvas/compile.ts` — UPDATE (nodeNvsToCanvasLocal, nodeToCanvasSpace → nodeNvsToCanvasLocal, compilePipe)
5. `packages/diagram/src/elements/diagram/canvas/render.ts` — UPDATE (canvasAspect computation, DiagramRenderer.setCanvasAspect call)
6. `packages/diagram/src/elements/diagram/canvas/widget.ts` — UPDATE (remove auto-framing onTick, add deterministic camera setup in apply, update focusAll)
7. `packages/diagram/src/elements/diagram/canvas/compiler/pipeRouter.ts` — UPDATE (nodeNvsToCanvasLocal usage)
8. `packages/diagram/src/compiler/handlers.ts` — UPDATE (extract viewportBounds, tilt instead of position/rotation/scale/pivot from JSX props)

**Sequence:** render.ts → GroupRenderer.ts → canvas/compile.ts → canvas/render.ts → canvas/widget.ts → pipeRouter.ts → handlers.ts
**Done when:** `pnpm --filter @brewsite/diagram typecheck` passes on all diagram files.

---

### Stream 4: ImagePanel, Screen, Charts (depends on Stream 1; concurrent with Streams 2–3)

**Developer:** 4
**Files:**
1. `packages/diagram/src/elements/image-panel/types.ts` — UPDATE
2. `packages/diagram/src/elements/image-panel/compile.ts` — UPDATE
3. `packages/diagram/src/elements/image-panel/widget.ts` — UPDATE (NVS → world conversion in apply)
4. `packages/diagram/src/elements/image-panel/dsl.tsx` — UPDATE (remove position, add x,y,z,width/height as NVS)
5. `packages/diagram/src/elements/screen/types.ts` — UPDATE
6. `packages/diagram/src/elements/screen/compile.ts` — UPDATE
7. `packages/diagram/src/elements/screen/widget.ts` — UPDATE
8. `packages/diagram/src/elements/screen/dsl.tsx` — UPDATE
9. `packages/charts/src/elements/chart/types.ts` — UPDATE
10. `packages/charts/src/elements/chart/compile.ts` — UPDATE
11. `packages/charts/src/elements/chart/ChartWidget.ts` — UPDATE (NVS → world in apply)
12. `packages/charts/src/elements/chart/dsl.tsx` — UPDATE (add z, remove position)

**Sequence:** types → compile → dsl → widget for each element.
**Done when:** `pnpm --filter @brewsite/diagram typecheck && pnpm --filter @brewsite/charts typecheck` passes.

---

### Stream 5: Model Package + Scene Migration (depends on Streams 1–4)

**Developer:** 5
**Files:**
1. `packages/model/src/elements/model/types.ts` — UPDATE (SceneModel: nvsX, nvsY, z; remove position)
2. `packages/model/src/elements/model/compile.ts` — UPDATE (derive nvsX, nvsY from bounds)
3. `packages/model/src/elements/model/dsl.tsx` — UPDATE (remove position, add z)
4. `packages/model/src/elements/model/ModelWidget.ts` — UPDATE (NVS → world in apply)
5. `packages/model/src/elements/model/ModelRenderer.ts` — VERIFY (may need to accept _worldPosition field)
6. `apps/examples/src/whiteboard-arch/diagram.tsx` — MIGRATE (60+ nodes)
7. `apps/examples/src/whiteboard-arch/scenes/*.tsx` (7 files) — MIGRATE (remove position refs, update exit/enter)
8. `apps/examples/src/brewflow-sidecar/scenes/scene_architecture.tsx` — MIGRATE
9. All files with `<Diagram position=` — MIGRATE (viewportBounds). Get definitive list with: `grep -r "<Diagram " apps/ --include="*.tsx" -l | xargs grep -l "position="`
10. All files with `DiagramExit/DiagramEnter` — MIGRATE (NVS exit coords). List: `grep -r "DiagramExit\|DiagramEnter" apps/ --include="*.tsx" -l`
11. All files with `<Model position=` — MIGRATE (remove position, add z)
12. All files with `<Chart position=`, `<ImagePanel position=`, `<Screen position=` — MIGRATE
13. **Do NOT touch `apps/examples/src/slides-demo/` or `packages/slides/`** — out of scope; new work must use NVS from the start

**Sequence:** packages first (model types → compile → widget), then apps migration.
**Done when:** `pnpm dev` starts without TypeScript errors and all scenes render correctly.

---

### Dependency Graph

```
Stream 1: nvsWorldBridge.ts
          ↓
Stream 2: diagram types + compile
          ↓
Stream 3: diagram renderers + canvas   ←── concurrent with Stream 4
Stream 4: image-panel + screen + charts
          ↓
Stream 5: model package + scene migration (unblocks after Streams 1-4)
```

Streams 3 and 4 can proceed in parallel once Stream 2 completes (they touch different files).

---

## 12. Test Strategy

### 12.1 Infrastructure Tests

**File:** `packages/core/src/__tests__/nvsWorldBridge.test.ts`

```typescript
import { nvsToWorldAnalytic, worldToNvsAnalytic, computeWorldDimensions } from '../layout/nvsWorldBridge';

describe('nvsToWorldAnalytic', () => {
  it('maps center [0.5, 0.5] to world origin [0, 0, 0]', () => {
    const result = nvsToWorldAnalytic(0.5, 0.5, 0, 0, 10, 45, 16/9, 0);
    expect(result[0]).toBeCloseTo(0, 5);
    expect(result[1]).toBeCloseTo(0, 5);
    expect(result[2]).toBe(0);
  });

  it('maps top-left [0, 0] to negative-X, positive-Y world', () => {
    const result = nvsToWorldAnalytic(0, 0, 0, 0, 10, 45, 16/9, 0);
    expect(result[0]).toBeLessThan(0);  // left → negative world X
    expect(result[1]).toBeGreaterThan(0);  // top → positive world Y
  });

  it('maps bottom-right [1, 1] to positive-X, negative-Y world', () => {
    const result = nvsToWorldAnalytic(1, 1, 0, 0, 10, 45, 16/9, 0);
    expect(result[0]).toBeGreaterThan(0);
    expect(result[1]).toBeLessThan(0);
  });

  it('is the exact inverse of worldToNvsAnalytic', () => {
    const nvs = { x: 0.3, y: 0.7 };
    const world = nvsToWorldAnalytic(nvs.x, nvs.y, 0, 0, 12, 45, 16/9, 0);
    const backToNvs = worldToNvsAnalytic(world[0], world[1], 0, 0, 12, 45, 16/9);
    expect(backToNvs.x).toBeCloseTo(nvs.x, 5);
    expect(backToNvs.y).toBeCloseTo(nvs.y, 5);
  });

  it('applies correct Y-flip (NVS y=0 top → world positive Y)', () => {
    const top = nvsToWorldAnalytic(0.5, 0, 0, 0, 10, 45, 1, 0);
    const bottom = nvsToWorldAnalytic(0.5, 1, 0, 0, 10, 45, 1, 0);
    expect(top[1]).toBeGreaterThan(0);     // top → positive world Y
    expect(bottom[1]).toBeLessThan(0);     // bottom → negative world Y
    expect(top[1]).toBeCloseTo(-bottom[1], 5);  // symmetric
  });
});

describe('computeWorldDimensions', () => {
  it('returns correct world height at d=12.07, fov=45', () => {
    const { worldHeight } = computeWorldDimensions(12.07, 45, 1);
    expect(worldHeight).toBeCloseTo(10.0, 1);
  });
});
```

### 12.2 Diagram Normalization Tests

**File:** `packages/diagram/src/elements/diagram/__tests__/normalizeToViewport.test.ts`

```typescript
import { compileDiagram } from '../compile';
import type { DiagramDSL } from '../types';

const minimalDSL = (nodes: DiagramDSL['nodes']): DiagramDSL => ({
  id: 'test',
  nodes,
  edges: [],
  groups: [],
  layout: { kind: 'manual' },
  childrenOrder: [],
});

describe('normalizeToViewport via compileDiagram', () => {
  it('single node at center → position [0.5, 0.5, z]', () => {
    const dsl = minimalDSL([{ id: 'a', position: [0, 0, 0], size: [4, 2] }]);
    const result = compileDiagram(dsl);
    const node = result.nodes[0]!;
    expect(node.position[0]).toBeCloseTo(0.5, 3);
    expect(node.position[1]).toBeCloseTo(0.5, 3);
  });

  it('two horizontally separated nodes: left has x<0.5, right has x>0.5', () => {
    const dsl = minimalDSL([
      { id: 'left', position: [-5, 0, 0], size: [4, 2] },
      { id: 'right', position: [5, 0, 0], size: [4, 2] },
    ]);
    const result = compileDiagram(dsl);
    const leftNode = result.nodes.find((n) => n.id === 'left')!;
    const rightNode = result.nodes.find((n) => n.id === 'right')!;
    expect(leftNode.position[0]).toBeLessThan(0.5);
    expect(rightNode.position[0]).toBeGreaterThan(0.5);
  });

  it('Y-flip: node at top (positive Cartesian Y) gets NVS y < 0.5', () => {
    const dsl = minimalDSL([
      { id: 'top', position: [0, 5, 0], size: [4, 2] },
      { id: 'bottom', position: [0, -5, 0], size: [4, 2] },
    ]);
    const result = compileDiagram(dsl);
    const topNode = result.nodes.find((n) => n.id === 'top')!;
    const bottomNode = result.nodes.find((n) => n.id === 'bottom')!;
    expect(topNode.position[1]).toBeLessThan(0.5);     // top → NVS y < 0.5
    expect(bottomNode.position[1]).toBeGreaterThan(0.5);  // bottom → NVS y > 0.5
  });

  it('all node positions are within [0, 1]', () => {
    const dsl = minimalDSL([
      { id: 'a', position: [-10, 8, 0], size: [4, 2] },
      { id: 'b', position: [0, 0, 0], size: [4, 2] },
      { id: 'c', position: [10, -8, 0], size: [4, 2] },
    ]);
    const result = compileDiagram(dsl);
    for (const node of result.nodes) {
      // Center position [0..1] (outer edges may be slightly outside due to size/2)
      expect(node.position[0]).toBeGreaterThanOrEqual(0);
      expect(node.position[0]).toBeLessThanOrEqual(1);
      expect(node.position[1]).toBeGreaterThanOrEqual(0);
      expect(node.position[1]).toBeLessThanOrEqual(1);
    }
  });

  it('DiagramState has viewportBounds not position/rotation/scale', () => {
    const result = compileDiagram(minimalDSL([{ id: 'a', position: [0, 0, 0], size: [4, 2] }]));
    expect(result).toHaveProperty('viewportBounds');
    expect(result).not.toHaveProperty('position');
    expect(result).not.toHaveProperty('scale');
    expect(result).not.toHaveProperty('pivot');
  });

  it('pivot is ignored — same output regardless of dsl.pivot', () => {
    const base = minimalDSL([{ id: 'a', position: [3, 2, 0], size: [2, 1] }]);
    const result1 = compileDiagram({ ...base, pivot: 'center' as any });
    const result2 = compileDiagram({ ...base, pivot: 'top-left' as any });
    // pivot field removed from DiagramState, positions come from normalization only
    expect(result1.nodes[0]!.position[0]).toBeCloseTo(result2.nodes[0]!.position[0], 3);
  });
});
```

### 12.3 DiagramExit / DiagramEnter Tests

**File:** `packages/diagram/src/elements/diagram/__tests__/compile.test.ts` (update existing)

```typescript
describe('applyDiagramExit', () => {
  it('translates viewportBounds toward exit.to at t=1', () => {
    const diagram = compileDiagram(/* ... */);
    const exitDiagram = { ...diagram, exit: { to: [0.5, 2, 0] as any, fade: false, easing: 'linear' as any } };
    const result = applyDiagramExit(exitDiagram, 1);
    const centerY = result.viewportBounds.y + result.viewportBounds.h / 2;
    expect(centerY).toBeCloseTo(2, 3);  // fully moved to y=2 (off-screen below)
  });

  it('at t=0, viewportBounds is unchanged', () => {
    const diagram = compileDiagram(/* ... */);
    const exitDiagram = { ...diagram, exit: { to: [0.5, 2, 0] as any, fade: false, easing: 'linear' as any } };
    const result = applyDiagramExit(exitDiagram, 0);
    expect(result.viewportBounds).toEqual(diagram.viewportBounds);
  });
});
```

### 12.4 ImagePanel Compile Tests

**File:** `packages/diagram/src/elements/image-panel/__tests__/compile.test.ts` (update existing)

```typescript
import { compileImagePanel } from '../compile';

describe('compileImagePanel', () => {
  it('defaults to NVS center 0.5, 0.5', () => {
    const state = compileImagePanel({ id: 'p', src: '/img.png' });
    expect(state.nvsX).toBe(0.5);
    expect(state.nvsY).toBe(0.5);
    expect(state.z).toBe(0);
  });

  it('respects explicit NVS x, y', () => {
    const state = compileImagePanel({ id: 'p', src: '/img.png', x: 0.2, y: 0.8, z: -2 });
    expect(state.nvsX).toBe(0.2);
    expect(state.nvsY).toBe(0.8);
    expect(state.z).toBe(-2);
  });

  it('has no position property', () => {
    const state = compileImagePanel({ id: 'p', src: '/img.png' });
    expect(state).not.toHaveProperty('position');
  });
});
```

### 12.5 Chart Compile Tests

**File:** `packages/charts/src/elements/chart/__tests__/compile.test.ts` (update existing)

```typescript
describe('compileChart', () => {
  it('derives nvsX, nvsY from x,y,w,h props', () => {
    const state = compileChart({ x: 0.2, y: 0.1, w: 0.5, h: 0.6, type: 'bar' }, null, [], [], null);
    expect(state.nvsX).toBeCloseTo(0.2 + 0.5 / 2, 5);  // 0.45
    expect(state.nvsY).toBeCloseTo(0.1 + 0.6 / 2, 5);  // 0.40
  });

  it('defaults to center when no x,y specified', () => {
    const state = compileChart({ type: 'bar' }, null, [], [], null);
    expect(state.nvsX).toBe(0.5);
    expect(state.nvsY).toBe(0.5);
  });

  it('has no position property', () => {
    const state = compileChart({ type: 'bar' }, null, [], [], null);
    expect(state).not.toHaveProperty('position');
  });
});
```

### 12.6 Model Compile Tests

**File:** `packages/model/src/elements/model/__tests__/ModelCompile.test.ts` (update existing)

```typescript
describe('model nvsX/nvsY from bounds', () => {
  it('center of x=0.2 y=0.1 w=0.5 h=0.6 is [0.45, 0.40]', () => {
    const state = compileModelDsl({ x: 0.2, y: 0.1, w: 0.5, h: 0.6 });
    expect(state.model.nvsX).toBeCloseTo(0.45, 5);
    expect(state.model.nvsY).toBeCloseTo(0.40, 5);
  });

  it('model has no position property', () => {
    const state = compileModelDsl({ x: 0, y: 0, w: 1, h: 1 });
    expect(state.model).not.toHaveProperty('position');
  });
});
```

### 12.8 Auto-Layout Normalization Test

**File:** `packages/diagram/src/elements/diagram/__tests__/normalizeToViewport.test.ts` (extend existing)

Auto-layout (GridLayout, HierarchicalLayout) paths run `normalizeToViewport()`. Verify their output is in [0..1]:

```typescript
describe('normalizeToViewport — auto-layout path', () => {
  it('GridLayout produces all node positions in [0, 1]', () => {
    const dsl: DiagramDSL = {
      id: 'grid-test',
      nodes: [
        { id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' },
      ],
      edges: [],
      groups: [],
      layout: { kind: 'grid', columns: 2 },
      childrenOrder: ['a', 'b', 'c', 'd'],
    };
    const result = compileDiagram(dsl);
    for (const node of result.nodes) {
      expect(node.position[0]).toBeGreaterThanOrEqual(0);
      expect(node.position[0]).toBeLessThanOrEqual(1);
      expect(node.position[1]).toBeGreaterThanOrEqual(0);
      expect(node.position[1]).toBeLessThanOrEqual(1);
      // NVS sizes are fractions of diagram span
      expect(node.size[0]).toBeGreaterThan(0);
      expect(node.size[0]).toBeLessThanOrEqual(1);
      expect(node.size[1]).toBeGreaterThan(0);
      expect(node.size[1]).toBeLessThanOrEqual(1);
    }
  });

  it('ManualLayout node at [0.5, 0.5] passes through unchanged', () => {
    const dsl = minimalDSL([{ id: 'center', position: [0.5, 0.5, 0], size: [0.2, 0.15] }]);
    const result = compileDiagram(dsl);
    const node = result.nodes[0]!;
    expect(node.position[0]).toBeCloseTo(0.5, 5);
    expect(node.position[1]).toBeCloseTo(0.5, 5);
    expect(node.size[0]).toBeCloseTo(0.2, 5);
    expect(node.size[1]).toBeCloseTo(0.15, 5);
  });

  it('ManualLayout node at [0.1, 0.9] passes through — not re-normalized', () => {
    const dsl = minimalDSL([
      { id: 'tl', position: [0.1, 0.1, 0], size: [0.1, 0.1] },
      { id: 'br', position: [0.9, 0.9, 0], size: [0.1, 0.1] },
    ]);
    const result = compileDiagram(dsl);
    const tl = result.nodes.find((n) => n.id === 'tl')!;
    const br = result.nodes.find((n) => n.id === 'br')!;
    // If normalization ran incorrectly, tl.x would drift from 0.1 to ~0.5
    expect(tl.position[0]).toBeCloseTo(0.1, 5);
    expect(br.position[0]).toBeCloseTo(0.9, 5);
  });

  it('ManualLayout group bounds.y is the NVS TOP edge of the group (not Cartesian bottom)', () => {
    // ManualLayout node positions are already Y-flipped [0..1] (NVS, Y-down).
    // A group containing a node at NVS y=0.8 (near bottom) should have group bounds
    // with y < 0.8 — i.e., the group top is above the node center.
    // This confirms GroupBounds.y = NVS top edge (consistent with Y-down NVS convention),
    // NOT the Cartesian bottom edge convention used in pre-normalization diagram units.
    // If `resolveGroupBoundsMap()` incorrectly treats ManualLayout positions as
    // Cartesian Y-up, `bounds.y` would be incorrect (Cartesian bottom < node Y = wrong).
    const dslWithGroup: DiagramDSL = {
      id: 'g-test',
      nodes: [{ id: 'a', position: [0.5, 0.8, 0], size: [0.1, 0.1] }],
      edges: [],
      groups: [{ id: 'g1', nodeIds: ['a'], label: 'G' }],
      layout: { kind: 'manual' },
      childrenOrder: ['a'],
    };
    const result = compileDiagram(dslWithGroup);
    const group = result.groups[0]!;
    // Group top (bounds.y) must be above (less than) the node center NVS y=0.8
    expect(group.bounds.y).toBeLessThan(0.8);
    // Group bottom (bounds.y + bounds.h) must be below (greater than) node center
    expect(group.bounds.y + group.bounds.h).toBeGreaterThan(0.8);
  });
});
```

### 12.9 Edge Control Point Canvas-Local Conversion Test

**File:** `packages/diagram/src/elements/diagram/__tests__/diagramRenderer.test.ts` (new file)

This tests that edge control points passed to EdgeRenderer are in canvas-local space, not [0..1] NVS:

```typescript
import { DiagramRenderer } from '../render';
import type { DiagramState, DiagramEdgeState } from '../types';

// Use a real DiagramRenderer with a minimal DiagramState having a known edge.
// Verify the edge's control points received by the (mocked) EdgeRenderer
// are in canvas-local space, not the original [0..1] NVS.

describe('DiagramRenderer edge control point conversion', () => {
  it('converts edge control points from [0..1] NVS to canvas-local', () => {
    const renderer = new DiagramRenderer();
    const capturedEdges: DiagramEdgeState[] = [];
    // Inject a spy EdgeRenderer that captures what it receives
    (renderer as any).edgeRenderer = {
      getOrCreate: (edge: DiagramEdgeState) => { capturedEdges.push(edge); },
      dispose: () => {},
    };
    (renderer as any)._canvasAspect = 16 / 9;

    const state: DiagramState = {
      id: 'test',
      viewportBounds: { x: 0, y: 0, w: 1, h: 1 },
      tiltRotation: [0, 0, 0],
      nodes: [],
      edges: [{
        id: 'e1',
        from: 'a', to: 'b',
        // Control point at [0..1] NVS center
        controlPoints: [[0.5, 0.5, 0]],
        // ... required fields
      } as DiagramEdgeState],
      groups: [],
      exit: undefined, enter: undefined,
      themeConfig: {} as any,
    };

    renderer.update(state, new THREE.Group() as any, {} as any);

    expect(capturedEdges.length).toBe(1);
    const cp = capturedEdges[0]!.controlPoints[0]!;
    // NVS [0.5, 0.5] should map to canvas-local [0, 0] (center)
    expect(cp[0]).toBeCloseTo(0, 5);  // canvas-local X = (0.5 - 0.5) * aspect = 0
    expect(cp[1]).toBeCloseTo(0, 5);  // canvas-local Y = -(0.5 - 0.5) = 0
  });

  it('NVS [0, 0] control point maps to canvas-local top-left', () => {
    // NVS [0, 0] → canvas-local X = (0 - 0.5) * (16/9) ≈ -0.889, Y = -(0 - 0.5) = 0.5
    // (Verified against nodeNvsToCanvasLocal formula)
  });
});
```

### 12.10 Group Center Placement Test

**File:** `packages/diagram/src/elements/diagram/__tests__/diagramRenderer.test.ts` (extend)

Tests that the group THREE.Group position is at the correct canvas-local center:

```typescript
describe('DiagramRenderer group center placement', () => {
  it('group at NVS [x=0.2, y=0.3, w=0.6, h=0.4] has canvas-local center at [0, 0]', () => {
    // NVS center: (0.2+0.3, 0.3+0.2) = (0.5, 0.5)
    // Canvas-local center: ((0.5 - 0.5) * aspect, -(0.5 - 0.5)) = (0, 0)
    const capturedGroups: any[] = [];
    const renderer = new DiagramRenderer();
    (renderer as any).groupRenderer = {
      getOrCreate: (group: any) => { capturedGroups.push(group); return {}; },
      dispose: () => {},
    };
    (renderer as any)._canvasAspect = 16 / 9;

    const groupBounds = { x: 0.2, y: 0.3, w: 0.6, h: 0.4,
      padding: [0, 0, 0, 0] as any, titleGap: 0 };

    // Run update with a state containing one group
    // ... (setup minimal DiagramState with one group)

    const passed = capturedGroups[0]!;
    // GroupRenderer's centerX = passed.bounds.x + passed.bounds.w / 2
    // GroupRenderer's centerY = passed.bounds.y + passed.bounds.h / 2
    const centerX = passed.bounds.x + passed.bounds.w / 2;
    const centerY = passed.bounds.y + passed.bounds.h / 2;
    // NVS center (0.5, 0.5) → canvas-local (0, 0)
    expect(centerX).toBeCloseTo(0, 5);
    expect(centerY).toBeCloseTo(0, 5);
  });

  it('group center is never above its NVS top edge in canvas-local Y', () => {
    // Groups where NVS y=0.1 (near top) should have canvas-local center Y = +0.4 (below top)
    // i.e., centerY < (canvas-local top = 0.4 for NVS y=0.1)
    // This ensures the sign convention is correct: center is inside the group bounds.
  });
});
```

### 12.7 FunctionalTransitionSpec Tests — Update Existing

All existing `functionalTransitionSpec.test.ts` files (for diagram, image-panel, screen, canvas) must be updated:
- Remove assertions on `position`, `scale` properties that no longer exist
- Add assertions on `viewportBounds`, `nvsX`/`nvsY` interpolation
- Assert `t=0` returns from-state properties, `t=1` returns to-state properties

---

## 13. Scrolling / Bounds Bug Fixes

### 13.1 DiagramCanvasWidget — Camera Conflict Resolution

**Bug:** Auto-framing onTick runs even when `<Camera>` widget is active, sometimes overriding camera with incorrect values during transitions.

**Fix:** The auto-framing block is fully removed. Replaced with deterministic camera setup. No timing conflict possible.

### 13.2 DiagramPipe Re-routing at Runtime

**Bug:** `rerouteLivePipes` in canvas compile uses a fixed `DEFAULT_CANVAS_ASPECT = 16/9` during compile time. For non-standard AR setups, pipes may be slightly misaligned.

**Known limitation:** Pipe control points are computed at compile time with a default AR. Runtime re-routing during transitions also uses this default. This is acceptable — the visual difference for non-standard ARs is minor, and pipes are re-routed dynamically during transitions. Document in JSDoc.

### 13.3 `LabelPositionerSyncer` — nvsBounds Dependency

**Existing bug** (from `note_nvs-known-limitations.md`): `LabelPositionerSyncer` does not re-fire when `nvsBounds` changes without a resize.

**Fix:** This is in `packages/model/src/player/LabelPositioner.ts` — add `widget?.nvsBounds` to the `useEffect` dependency array. File path: `packages/model/src/player/LabelPositioner.ts` (or wherever `LabelPositionerSyncer` is defined).

This is a separate fix that should be applied in Stream 5 alongside model changes.

### 13.4 Background `position: Vec3` Audit

**Finding:** `SceneBackground.position: Vec3` in `packages/core/src/elements/background/types.ts` is unused in `render.ts` (Background is a CSS DOM element). The field serves no purpose.

**Fix:** Remove `position?: Vec3` from `SceneBackground` type. If it exists in any DSL prop files, remove it. This is a cleanup, not a functional change. Apply in Stream 1 as part of infrastructure.

---

## 14. Verification Checklist

### TypeScript — zero errors

```bash
pnpm build:lib        # tsc builds for all packages — must pass
pnpm typecheck        # explicit typecheck via turbo — must pass
```

### Tests — all pass

```bash
pnpm test             # all test suites — must pass with no failures
pnpm coverage         # instrumented run — confirm new tests have coverage
```

### Per-package verification

```bash
pnpm --filter @brewsite/core test
pnpm --filter @brewsite/diagram test
pnpm --filter @brewsite/model test
pnpm --filter @brewsite/charts test
```

### Visual QA — run dev server

```bash
pnpm dev
```

Verify each of these scenes visually renders correctly (no missing/misplaced elements):

| Scene | Key checks |
|---|---|
| Whiteboard arch | All ~60 nodes visible, groups aligned, edges connecting |
| Brewflow sidecar architecture | Two stacked diagrams (claude-flow, sidecar), pipes if any |
| Any brewflow scene with DiagramExit | Exit animation moves diagram off-screen cleanly |
| Architecture demo (diagram scene) | Grid-layout diagram fills canvas correctly |
| Chart demo | Charts positioned at center of viewport |
| Image panel scenes | Panels centered at declared NVS position |
| Model scenes | Models positioned at NVS center of declared bounds |

### Coordinate sanity checks

1. A `<DiagramNode position={[0.5, 0.5, 0]}>` in ManualLayout appears at screen center
2. A `<DiagramNode position={[0, 0, 0]}>` appears at top-left of the diagram canvas viewport
3. A `<DiagramNode position={[1, 1, 0]}>` appears at bottom-right
4. `<DiagramExit to={[0.5, 2, 0]}>` slides the diagram off the bottom of the canvas
5. A `<Chart x={0.5} y={0.5} w={0.5} h={0.5}>` appears in the right half of the viewport

### NVS bridge sanity check (manual)

Open browser console in dev mode and verify:
```javascript
// These should be exported and accessible for debugging:
import { nvsToWorldAnalytic } from '@brewsite/core';
nvsToWorldAnalytic(0.5, 0.5, 0, 0, 12.07, 45, 16/9);
// → [0, 0, 0]  (center maps to world origin)
nvsToWorldAnalytic(0, 0, 0, 0, 12.07, 45, 16/9);
// → [-8.89..., 5.0..., 0]  (top-left)
```

---

## 15. Open Questions Resolved

| Question (from notes) | Resolution |
|---|---|
| Camera target — NVS or world? | Camera position/target stay world-space. Optional `nvsTarget` prop added. |
| canvasAspect source | Computed at render time from camera.aspect + canvas nvsBounds. Not stored in DiagramCanvasState. |
| Lighting positions — NVS? | Stays world-space. Lights illuminate 3D geometry; NVS would make them camera-dependent. |
| DiagramCanvas position — NVS? | Stays world-space. Canvas is a 3D object; its placement in the scene is world-space. |
| Group local [0..1] sub-space | Deferred (unchanged from previous assessment). Groups get [0..1] bounds within the diagram's normalized space, but there's no intra-group local NVS. |
| DEFAULT_CANVAS_ASPECT for compile time | 16/9 used as default. Noted as an approximation for non-16:9 setups; runtime re-routing corrects pipes. |
| Model position vs nvsBounds center | NVS X,Y of model = center of its nvsBounds. No separate world-space position[0,1]. |

---

## 16. Files That DO NOT Change

These files are explicitly out of scope:

- `packages/core/src/elements/camera/types.ts` — camera position/target stay world-space (except adding optional `nvsTarget`)
- `packages/core/src/elements/lighting/types.ts` — all light positions stay world-space
- `packages/core/src/elements/floor/types.ts` — floor position stays world-space
- `packages/core/src/elements/environment/types.ts` — no positions
- `packages/core/src/elements/background/types.ts` — CSS strings (remove unused Vec3 position field only)
- `packages/core/src/elements/text-box/dsl.tsx` — already NVS, no change
- `packages/core/src/compiler/` — compiler pipeline is coordinate-agnostic
- `packages/core/src/runtime/` — runtime is coordinate-agnostic
- `packages/core/src/widget/types.ts` — widget SDK interfaces are coordinate-agnostic
- `packages/core/src/hud/` — HUD system (already NVS-positioned DOM elements)
- `packages/core/src/input/` — input controllers
- `packages/model/src/player/LabelPositioner.ts` — bug fix only (nvsBounds dependency); no coordinate changes
- `packages/diagram/src/elements/diagram/shapes/` — geometry factories (scale-invariant)
- `packages/diagram/src/elements/diagram/themes/` — theme configs (no coordinates)
- `packages/diagram/src/lucid/` — Lucid import (separate investigation needed)
