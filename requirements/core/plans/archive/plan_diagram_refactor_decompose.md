---
title: "Diagram Package: Renderer & Compiler Decomposition"
doc_type: plan
owner: brewflow-architect
status: complete
updated: 2026-02-26
---

# Diagram Package: Renderer & Compiler Decomposition

## 1. Executive Summary

The `packages/diagram` rendering and compilation pipeline has accumulated two monolithic files that violate single-responsibility and make the code untestable in isolation:

- `src/elements/diagram/render.ts` — **1,303 lines** — a single `DiagramRenderer` class responsible for node geometry, edge tubes, group fills, text, icons, environment maps, interaction registration, and texture caching.
- `src/elements/diagram/compile.ts` — **1,109 lines** — layout, routing, node/edge/group compilation, theme resolution, and full transition interpolation logic, with the transition logic nearly copy-pasted again in `canvas/compile.ts` (434 lines).

Beyond the size problems, there are **ten concrete bugs** that must be fixed as part of this refactoring:

1. **S-curve edges** — `routeEdgeCurved` produces S-shaped curves whenever source and destination faces have anti-parallel normals (e.g., api's left face → ecs's right face). This is the primary visual defect in scene 0.
2. **Aggressive `nearestFace` threshold** — picks horizontal (left/right) faces too eagerly for diagonal connections; the 45° cutoff should be relaxed to ~35°.
3. **Canvas pipe attachment ignores X/Z rotation** — `sideAttachmentPoint` only applies the diagram's Y-rotation when computing its local X-axis in canvas space.
4. **Module-level global interaction registries** — `diagramInteractionRegistry` and `diagramInteractionLookup` are module-level singletons consumed by **both** `DiagramWidget` and `DiagramCanvasWidget`; incorrect for multi-diagram scenes and untestable.
5. **Duplicate interpolation logic** — `functionalDiagramTransitionSpec.interpolateFn` is ~110 lines copied verbatim into `functionalDiagramCanvasTransitionSpec.interpolateFn`.
6. **Duplicate pipe rendering** — `canvas/render.ts` re-implements the entire edge tube + arrow rendering that already exists in `render.ts`.
7. **Pipe transitions lose side-attachment** — `canvas/compile.ts` `interpolateFn` re-routes pipes with no face normals, reverting from side-face attachment to center-to-center arc on every scrolled transition.
8. **Canvas `onTick` framing ignores rotation** — `DiagramCanvasWidget.onTick` computes world-space framing bounds using only scale and translation, ignoring the canvas and diagram rotation matrices. The camera frames the wrong region for any rotated canvas.
9. **Module-level caches never cleared** — `envMapCache` and `iconCache` in `render.ts` are module-level `Map`s that are never disposed, leaking GPU texture memory and SVG promise objects across the entire session.
10. **`computeBounds` Z extent uses center positions** — `minZ`/`maxZ` are node center Z values, not `center ± depth/2`, underestimating the true Z extent of the diagram. Camera auto-framing and any depth-dependent code receives stale Z bounds.

This plan specifies **exactly how to fix all of the above** with full type interfaces, file paths, algorithm corrections, and test coverage.

---

## 2. Precise Bug Analysis

### 2.1 S-Curve Edge Routing

**Location:** `src/elements/diagram/compile.ts`, function `routeEdgeCurved` (line ~424).

**Root cause:** When edge source and destination faces have anti-parallel normals (dot product = −1), the stub control points push the curve _away from the target_ on both sides, creating an S-curve:

```
api(left face, normal=[-1,0,0]) ──stub──> [−3.3, −4, 0]
                                                         \
                                                          S-curve
                                                         /
ecs(right face, normal=[+1,0,0]) ──stub──> [−1.7, −8, 0]
```

The two guide points cross each other in XY, producing an ugly bend. **Affected edges in the arch overview**: api→ecs, api→lambda, ecs→rds, ecs→cache, ecs→s3.

**Fix — anti-parallel arc path:** Detect anti-parallel normals via dot-product test. When `dotNormals < −0.3`, instead of using face-perpendicular stubs, compute a perpendicular-to-edge arc:

```typescript
// In routeEdgeCurved, after computing start/end:
const dotNormals = srcNormal[0]*dstNormal[0] + srcNormal[1]*dstNormal[1] + srcNormal[2]*dstNormal[2];
if (dotNormals < -0.3) {
  // Anti-parallel: both stubs push the control points APART → S-curve.
  // Instead, bow the curve perpendicular to the edge direction in XY.
  const midX = (start[0] + end[0]) / 2;
  const midY = (start[1] + end[1]) / 2;
  const edgeDx = end[0] - start[0];
  const edgeDy = end[1] - start[1];
  const edgeLen = Math.sqrt(edgeDx * edgeDx + edgeDy * edgeDy) || 1;
  // Perpendicular to edge direction (rotated 90° CCW)
  const perpX = -edgeDy / edgeLen;
  const perpY =  edgeDx / edgeLen;
  // Bow amount: 20% of distance, max 1.5 diagram units
  const bow = Math.min(1.5, dist * 0.20);
  return [start, [midX + perpX * bow, midY + perpY * bow, start[2]], end];
}
```

This produces a clean 3-point arc that bows to one side without crossing.

**Same fix applies to `routePipe`** in `canvas/compile.ts` — identical problem for cross-diagram pipes with anti-parallel face normals.

### 2.2 `nearestFace` Threshold Too Strict

**Location:** `compile.ts` line ~362.

**Root cause:** `if (ady >= adx * 1.0 && ady >= adz * 1.0)` — the `1.0` multiplier means top/bottom face only wins when vertical displacement is ≥ horizontal displacement (45° threshold). For a node diagonally below-left at 40° from horizontal, horizontal face is selected, triggering the S-curve.

**Fix:** Change multiplier to `0.7`, shifting the threshold to ~35° from horizontal:

```typescript
// Before:
if (ady >= adx * 1.0 && ady >= adz * 1.0) return dy >= 0 ? 'top' : 'bottom';
// After:
if (ady >= adx * 0.7 && ady >= adz * 0.7) return dy >= 0 ? 'top' : 'bottom';
```

This means: if the target is more than ~35° above or below horizontal, attach to the top/bottom face. For the `api→ecs` case (dx=−5, dy=−4, ady/adx=0.8 > 0.7), this selects **bottom** for api and **top** for ecs — matching face normals → proper CatmullRom arc instead of S-curve.

### 2.3 Canvas `sideAttachmentPoint` Ignores X/Z Rotation

**Location:** `canvas/compile.ts`, `sideAttachmentPoint` function (line ~62).

**Root cause:**
```typescript
const ry = diagramRotation[1]; // only Y rotation
const localXinCanvas: Vec3 = [Math.cos(ry), 0, -Math.sin(ry)];
```

When `diagramRotation = [−π/4, 0, 0]` (X-axis tilt), the function returns `[1, 0, 0]` instead of the correct rotated X-axis.

**Fix:** Apply full XYZ Euler rotation matrix (intrinsic XYZ order, matching Three.js `Euler` default):

```typescript
function rotateXYZ(v: Vec3, rx: number, ry: number, rz: number): Vec3 {
  // Rotation matrix R = Rz · Ry · Rx (intrinsic XYZ → extrinsic ZYX)
  const cx = Math.cos(rx), sx = Math.sin(rx);
  const cy = Math.cos(ry), sy = Math.sin(ry);
  const cz = Math.cos(rz), sz = Math.sin(rz);
  return [
    (cy * cz) * v[0] + (sx * sy * cz - cx * sz) * v[1] + (cx * sy * cz + sx * sz) * v[2],
    (cy * sz) * v[0] + (sx * sy * sz + cx * cz) * v[1] + (cx * sy * sz - sx * cz) * v[2],
    (-sy)     * v[0] + (sx * cy)                * v[1] + (cx * cy)                * v[2],
  ];
}

// In sideAttachmentPoint:
const [rx, ry, rz] = diagramRotation;
const localXinCanvas = rotateXYZ([1, 0, 0], rx, ry, rz);
```

### 2.4 Module-Level Global Interaction Registries

**Location:** `render.ts` lines 13–14 (exported globals); consumed in `widget.ts` lines 210–216 and in `canvas/widget.ts` lines 17–19, 190–195.

```typescript
// render.ts — module-level globals
export const diagramInteractionRegistry = new Set<THREE.Mesh>();
export const diagramInteractionLookup = new Map<THREE.Mesh, { diagramId: string; nodeId: string }>();

// canvas/widget.ts — also imports and uses them directly
import { diagramInteractionRegistry, diagramInteractionLookup } from '../render';
// ...
const intersects = this.raycaster.intersectObjects(Array.from(diagramInteractionRegistry), false);
const info = diagramInteractionLookup.get(hit.object as THREE.Mesh);
```

**Problem:** Both `DiagramWidget` and `DiagramCanvasWidget` consume the same singleton. When both widget types are live in the same scene, the raycast fires against the combined mesh pool of every registered diagram — including diagrams owned by the other widget. Both widgets have an `ownsDiagram` / `info.diagramId !== this.widgetId` guard to discard foreign hits, but this makes every click O(all clickable meshes in all live diagrams). The registry also never shrinks until `dispose()` is called, so any geometry rebuilds that create new mesh objects leave the old meshes as stale entries.

Additionally, the module-level location makes the registry untestable: tests share state across test cases unless the module is manually reset between runs.

**Fix:** Replace with instance-scoped `InteractionRegistry` class. Each `DiagramRenderer` owns one registry instance. `DiagramWidget` and `DiagramCanvasWidget` reach the registry through `this.renderer.interactionRegistry`. See §4.2 and §6.1.

### 2.5 Duplicate Interpolation Logic

**Location:** `compile.ts` interpolateFn (lines ~1036–1108) is ~80 lines of node/edge blending logic that is **character-for-character duplicated** in `canvas/compile.ts` interpolateFn (lines ~313–379).

**Fix:** Extract `blendDiagramNodes`, `blendDiagramEdges`, and `rerouteLiveEdges` helpers to `compiler/transitionHelpers.ts`. Both specs import from there. See §5.3.

### 2.6 Duplicate Pipe Rendering

**Location:** `canvas/render.ts` `createPipe`/`updatePipe`/`disposePipe` (lines ~97–178) duplicates the EdgeEntry tube + material lifecycle from `render.ts` `createEdge`/`updateEdge`/`disposeEdge`.

**Fix:** Extract `EdgeRenderer` class from `render.ts`. `DiagramCanvasRenderer` uses the same `EdgeRenderer` for pipes. See §4.4.

### 2.7 Pipe Transitions Lose Side-Attachment

**Location:** `canvas/compile.ts`, `functionalDiagramCanvasTransitionSpec.interpolateFn`, lines ~400–422.

**Root cause:** At compile time, `compilePipe` calls `sideAttachmentPoint` to get face-specific attachment points and normals, then passes them to `routePipe(from, to, fromNormal, toNormal)`. During a live transition, the `interpolateFn` re-routes pipes with:

```typescript
// canvas/compile.ts interpolateFn — both blended and fading pipe branches:
const liveControlPoints = (fromPos && toPos)
  ? routePipe(fromPos, toPos)   // ← no normals passed
  : toPipe.controlPoints;
```

`routePipe` without normals falls through to the "legacy elevated midpoint arc" branch — a simple arc through a Y-elevated midpoint that ignores face geometry entirely. Every time the user scrolls between canvas scenes, each pipe visually pops from its correct side-face routing to a different center-to-center arc shape for the duration of the transition, then snaps back.

**Fix:** During `interpolateFn`, reconstruct the side-attachment normals from the live canvas-local node positions using the same `sideAttachmentPoint` logic used at compile time. This requires the `interpolateFn` to have access to node sizes and diagram rotations (which are already present in the interpolated diagram states). Pipe re-routing in `transitionHelpers.ts` should accept optional attachment parameters and compute them when available.

Specifically, add a `rerouteLivePipes` helper to `canvas/compiler/pipeRouter.ts`:

```typescript
/**
 * Re-routes a set of pipes using live canvas-local node positions, preserving
 * the side-attachment logic used at compile time. Called every frame during
 * canvas transitions so pipes track their endpoint nodes.
 */
export function rerouteLivePipes(
  pipes: ReadonlyArray<DiagramPipeState>,
  diagrams: ReadonlyArray<DiagramState>,  // interpolated diagram states with live positions
  routing: PipeRoutingAlgorithm,
  landing: PipeLandingAlgorithm,
): Map<string, ReadonlyArray<Vec3>>;
```

`canvas/compile.ts` `interpolateFn` calls `rerouteLivePipes` in place of the bare `routePipe(fromPos, toPos)` calls.

### 2.8 Canvas `onTick` Framing Ignores Rotation

**Location:** `canvas/widget.ts`, `DiagramCanvasWidget.onTick`, lines ~86–110.

**Root cause:** The camera auto-framing computes world-space bounds by applying only scale and translation:

```typescript
const wx0 = (b.x * diagram.scale + dpx) * cs + cpx;
const wy0 = (b.y * diagram.scale + dpy) * cs + cpy;
```

Neither the canvas rotation (`state.rotation`) nor any individual diagram rotation (`diagram.rotation`) is applied. The arch overview canvas has `rotation={[-π/4, 0, 0]}`, which means the rendered diagram is tilted 45° around the X-axis. The auto-framing camera is positioned as if the canvas is flat, so it frames the wrong Y/Z region — typically cutting off the bottom of the tilted diagram or leaving excessive empty space at the top.

**Fix:** Transform the bounds corners through the full canvas rotation matrix before computing the framing extent. Use the same `rotateXYZ` utility introduced in §2.3 / `pipeRouter.ts`:

```typescript
// For each diagram, transform all 4 XY corners by (diagram rotation then canvas rotation)
// to get canvas-world-space corners, then compute the AABB of those corners.
// Use the AABB to drive cam.position.set() and cam.lookAt().
```

The camera should look at the AABB center and be backed out far enough to frame the full AABB diagonal. `DiagramWidget.onTick` (single diagram, no canvas rotation) has the same latent issue and should receive the same fix: apply `diagram.rotation` before computing the framing bounds.

### 2.9 Module-Level Caches Never Cleared

**Location:** `render.ts` lines 66 and 124.

```typescript
/** Module-level cache: HDR URL → loaded THREE.Texture */
const envMapCache = new Map<string, THREE.Texture>();

const iconCache = new Map<string, Promise<THREE.Object3D>>();
```

**Problem:** Both maps are module-level and never cleared. `DiagramRenderer.dispose()` does not touch either. In a long-running SPA that:
- Loads multiple different HDR environment maps (e.g., user navigates to a scene using `neonCyberTheme` then back to `darkGlassTheme`), or
- Renders diagrams with many distinct SVG icon shapes, or
- Hot-reloads with Vite during development

...GPU textures accumulate in `envMapCache` and unresolved SVG loader promises accumulate in `iconCache`. The textures are never passed to `THREE.Texture.dispose()`, so GPU memory is never reclaimed.

Additionally, if an SVG load fails and the promise resolves to `new THREE.Group()` (the error fallback), that empty group is cached and will be returned on every subsequent load of the same URL — permanently suppressing the icon even after a fix is deployed, until the module is re-loaded.

**Fix:** `EnvMapManager` and `IconLoader` (see §4.8, §4.9) make these instance-level rather than module-level, and both expose `disposeAll()` called from `DiagramRenderer.dispose()`. The `sharedIconLoader` singleton in `IconLoader.ts` is the single application-level cache — its `disposeAll()` is called once on page teardown, not on every diagram dispose.

Additionally, the failed-load cache entry bug is fixed in `IconLoader.ts` by **not caching error results**: if the SVG load promise rejects or returns an empty group, delete the cache key so the next render attempt retries the fetch.

### 2.10 Minor Issues

These are lower-severity issues that should be fixed during the refactoring since the relevant code is being touched anyway.

**`stubLen` dead code in `sideAttachmentPoint`** — `canvas/compile.ts` line ~89 computes `stubLen = halfW + 0.5 * diagramScale` then suppresses the unused-variable warning with `void stubLen`. The stub distance was intended to define the guide point offset but was never wired up; `routePipe` computes its own stub independently. Remove the dead variable and the misleading comment. No functional change; clarifies intent.

**`computeBounds` Z extent uses center positions** — `compile.ts`, function `computeBounds` (line ~257). The function sets `minZ = Math.min(minZ, z)` and `maxZ = Math.max(maxZ, z)` using node center Z, not `z - depth/2` and `z + depth/2`. The resulting `bounds.minZ`/`bounds.maxZ` are underestimates of the true rendered Z extent. Fix by accounting for node depth:

```typescript
// In computeBounds, replace:
minZ = Math.min(minZ, z);
maxZ = Math.max(maxZ, z);
// With (requires sizes map to carry depth as third element, which sizeWithDepthMap already does):
const d = sizes instanceof Map ? (sizes.get(id)?.[2] ?? 0) : 0;
minZ = Math.min(minZ, z - d / 2);
maxZ = Math.max(maxZ, z + d / 2);
```

Since `compileDiagram` already builds `sizeWithDepthMap` with `[w, h, depth]`, the calling code can pass that map instead of the 2D `sizeMap` for Z-accurate bounds. Update `computeBounds` signature to accept `Map<string, readonly [number, number] | readonly [number, number, number]>` and use the optional third element when present.

---

## 3. New File Structure

```
packages/diagram/src/elements/diagram/
├── types.ts                        ← UNCHANGED
├── dsl.tsx                         ← UNCHANGED
├── compile.ts                      ← REFACTORED: orchestrator only (~250 lines)
├── render.ts                       ← REFACTORED: orchestrator only (~100 lines)
├── widget.ts                       ← MINOR: replace global imports with InteractionRegistry
├── index.ts                        ← MINOR: add new barrel exports
│
├── compiler/                       ← NEW directory
│   ├── edgeRouter.ts               ← EXTRACTED + FIXED: routing algorithms (~320 lines)
│   ├── layoutAlgorithms.ts         ← EXTRACTED: grid + hierarchical layout (~140 lines)
│   ├── nodeCompiler.ts             ← EXTRACTED: compileNode, buildNodeDefaults (~90 lines)
│   ├── groupCompiler.ts            ← EXTRACTED: compileGroup, computeBounds (~90 lines)
│   ├── themeResolver.ts            ← EXTRACTED: buildThemeRenderConfig, buildEdgeDefaults (~60 lines)
│   ├── transitionHelpers.ts        ← NEW: shared node/edge blend logic (~180 lines)
│   └── __tests__/
│       ├── edgeRouter.test.ts      ← NEW: comprehensive routing tests
│       ├── layoutAlgorithms.test.ts ← MOVED from compile.test.ts
│       └── transitionHelpers.test.ts ← NEW
│
├── rendering/                      ← NEW directory
│   ├── types.ts                    ← NEW: NodeRenderEntry, EdgeRenderEntry, GroupRenderEntry
│   ├── InteractionRegistry.ts      ← NEW: instance-scoped click tracking
│   ├── TextRenderer.ts             ← EXTRACTED: ensureText utility
│   ├── IconLoader.ts               ← EXTRACTED + FIXED: SVG/raster icon loading
│   ├── EdgeMaterialFactory.ts      ← EXTRACTED: material + dash/dot texture factory
│   ├── EnvMapManager.ts            ← EXTRACTED: HDR environment map loading
│   ├── NodeRenderer.ts             ← EXTRACTED: node create/update/dispose
│   ├── EdgeRenderer.ts             ← EXTRACTED: edge tube create/update/dispose (shared)
│   ├── GroupRenderer.ts            ← EXTRACTED: group fill/border create/update/dispose
│   └── __tests__/
│       ├── InteractionRegistry.test.ts ← NEW
│       ├── EdgeMaterialFactory.test.ts ← NEW
│       ├── NodeRenderer.test.ts        ← NEW
│       ├── EdgeRenderer.test.ts        ← NEW
│       └── GroupRenderer.test.ts       ← NEW
│
└── canvas/
    ├── types.ts                    ← UNCHANGED
    ├── dsl.tsx                     ← UNCHANGED
    ├── compile.ts                  ← REFACTORED: uses transitionHelpers + rerouteLivePipes (~220 lines)
    ├── render.ts                   ← REFACTORED: uses EdgeRenderer, no duplication (~80 lines)
    ├── widget.ts                   ← MINOR: replace global registry imports + fix onTick framing
    ├── index.ts                    ← UNCHANGED
    └── compiler/                   ← NEW directory
        ├── pipeRouter.ts           ← EXTRACTED + FIXED: sideAttachmentPoint (full rotation), routePipe (arc fix), rerouteLivePipes
        └── __tests__/
            └── pipeRouter.test.ts  ← NEW: rotation fix + anti-parallel arc + rerouteLivePipes
```

---

## 4. Rendering Sub-Module Specifications

### 4.1 `rendering/types.ts`

Single responsibility: internal render entry types for the rendering layer. No Three.js imports needed (types only reference Three.js types via `import type`).

```typescript
// Internal render-layer data structures. Not exported from package public API.

import type * as THREE from 'three';
import type { Text } from 'troika-three-text';
import type { DiagramNodeState, DiagramEdgeState, DiagramGroupState } from '../types';

/** Extended Text type for troika layout properties not in official types. */
export type TextWithLayout = Text & {
  textAlign?: string;
  overflowWrap?: string;
  whiteSpace?: string;
  lineHeight?: number;
  textRenderInfo?: { blockBounds?: [number, number, number, number] };
};

/**
 * Live Three.js objects for one diagram node.
 * Owned by NodeRenderer; created once and mutated in-place across ticks.
 */
export type NodeRenderEntry = {
  group: THREE.Group;
  boxMesh: THREE.Mesh;
  /** Sharp edges border (hidden when cornerRadius > 0). */
  border: THREE.LineSegments;
  /** Rounded-corner LineLoop (only when cornerRadius > 0). */
  roundedBorder?: THREE.LineLoop;
  /** Additive glow sprite (only when glowIntensity > 0). */
  glow?: THREE.Sprite;
  label: TextWithLayout;
  sublabel?: TextWithLayout;
  iconHolder?: THREE.Group;
  diagramId: string;
  /**
   * 6 = BoxGeometry (sharp corners); 2 = ExtrudeGeometry (rounded).
   * Tracked to detect geometry-type transitions across state updates.
   */
  materialCount: 2 | 6;
  lastState?: DiagramNodeState;
};

/**
 * Live Three.js objects for one diagram edge (tube + optional arrowheads).
 * Also used for DiagramPipes at the canvas level.
 */
export type EdgeRenderEntry = {
  group: THREE.Group;
  tube: THREE.Mesh;
  arrowStart?: THREE.Mesh;
  arrowEnd?: THREE.Mesh;
  lastState?: DiagramEdgeState;
};

/**
 * Live Three.js objects for one diagram group (fill plane + border + label).
 */
export type GroupRenderEntry = {
  group: THREE.Group;
  fill: THREE.Mesh;
  border: THREE.LineSegments;
  label: TextWithLayout;
  lastState?: DiagramGroupState;
};
```

### 4.2 `rendering/InteractionRegistry.ts`

Single responsibility: instance-scoped tracking of clickable node meshes. No module-level state.

```typescript
// Instance-scoped interaction registry for clickable diagram nodes.
// Replaces the module-level global Set/Map that caused cross-diagram ambiguity.

import type * as THREE from 'three';

export interface IInteractionRegistry {
  /** Register mesh as clickable for a given diagram node. */
  register(mesh: THREE.Mesh, diagramId: string, nodeId: string): void;
  /** Unregister mesh (call on node disposal). */
  unregister(mesh: THREE.Mesh): void;
  /** Reverse-lookup: mesh → {diagramId, nodeId}. */
  lookup(mesh: THREE.Mesh): { diagramId: string; nodeId: string } | undefined;
  /** All registered meshes — used as raycast targets. */
  readonly meshes: ReadonlySet<THREE.Mesh>;
  /** Remove all registrations (called on renderer dispose). */
  clear(): void;
}

export class InteractionRegistry implements IInteractionRegistry {
  private readonly _meshes = new Set<THREE.Mesh>();
  private readonly _map = new Map<THREE.Mesh, { diagramId: string; nodeId: string }>();

  register(mesh: THREE.Mesh, diagramId: string, nodeId: string): void {
    this._meshes.add(mesh);
    this._map.set(mesh, { diagramId, nodeId });
  }

  unregister(mesh: THREE.Mesh): void {
    this._meshes.delete(mesh);
    this._map.delete(mesh);
  }

  lookup(mesh: THREE.Mesh): { diagramId: string; nodeId: string } | undefined {
    return this._map.get(mesh);
  }

  get meshes(): ReadonlySet<THREE.Mesh> {
    return this._meshes;
  }

  clear(): void {
    this._meshes.clear();
    this._map.clear();
  }
}
```

**Test:** `rendering/__tests__/InteractionRegistry.test.ts`
- Register mesh → lookup returns correct {diagramId, nodeId}
- Unregister mesh → lookup returns undefined, meshes set shrinks
- clear() → meshes and map both empty
- Same mesh registered twice: second registration overwrites first (Map semantics)
- Multiple meshes from multiple diagrams coexist correctly

### 4.3 `rendering/TextRenderer.ts`

Single responsibility: efficiently update troika `Text` objects, calling `sync()` only when layout-affecting properties change.

```typescript
// Utility for updating troika Text objects with minimal sync() calls.
// sync() triggers the SDF pipeline — extremely expensive if called every frame.

import type { TextWithLayout } from './types';

/**
 * Updates a troika Text object and calls sync() only when layout-affecting
 * properties have changed. Opacity is a material uniform — update directly,
 * no sync() needed.
 *
 * @param text      The troika Text object to update.
 * @param value     New text content.
 * @param color     Hex color string.
 * @param baseFontSize  Desired font size in diagram units.
 * @param opacity   Current opacity (applied without sync).
 * @param maxWidth  Optional max width for wrapping/shrink.
 * @param shrinkToFit  If true, reduce fontSize to fit within maxWidth.
 */
export function ensureText(
  text: TextWithLayout,
  value: string,
  color: string,
  baseFontSize: number,
  opacity: number,
  maxWidth?: number,
  shrinkToFit?: boolean,
): void { /* implementation unchanged from render.ts */ }
```

**No external state.** All methods are pure stateless utilities operating on the `text` object passed in.

### 4.4 `rendering/EdgeRenderer.ts`

Single responsibility: create, update, and dispose Three.js tube+arrow geometry for a single edge or pipe. Shared between `DiagramRenderer` (for intra-diagram edges) and `DiagramCanvasRenderer` (for cross-diagram pipes) to eliminate the current code duplication.

```typescript
// Create/update/dispose Three.js tube+arrow geometry for diagram edges and canvas pipes.
// Shared between DiagramRenderer and DiagramCanvasRenderer.

import * as THREE from 'three';
import type { EdgeRenderEntry } from './types';
import type { IEdgeMaterialFactory } from './EdgeMaterialFactory';

/** Minimal state contract accepted by EdgeRenderer — covers both DiagramEdgeState and DiagramPipeState. */
export type EdgeLike = {
  id: string;
  controlPoints: ReadonlyArray<readonly [number, number, number]>;
  thickness: number;
  color: string;
  opacity: number;
  style?: 'solid' | 'dashed' | 'dotted';
  arrowStart?: string;
  arrowEnd?: string;
};

export class EdgeRenderer {
  private readonly entries = new Map<string, EdgeRenderEntry>();

  constructor(
    private readonly materialFactory: IEdgeMaterialFactory,
    private readonly use3DArrows: boolean = false,
    private readonly edgeSmoothness: number = 0.5,
    private readonly edgeMetalness: number = 0.3,
    private readonly edgeRoughness: number = 0.7,
  ) {}

  /**
   * Get-or-create an EdgeRenderEntry for the given edge state.
   * Mutates the existing entry in-place if it exists; creates a new one if not.
   * Adds the entry's group to `parent` on creation.
   * Returns the updated entry.
   */
  getOrCreate(edge: EdgeLike, parent: THREE.Object3D): EdgeRenderEntry { /* ... */ }

  /** Remove and dispose a single edge by id. */
  dispose(edgeId: string, parent: THREE.Object3D): void { /* ... */ }

  /** Dispose all edges. */
  disposeAll(parent: THREE.Object3D): void { /* ... */ }

  /** Return ids of all currently tracked edges. */
  get ids(): ReadonlySet<string> { /* ... */ }

  private createEntry(edge: EdgeLike): EdgeRenderEntry { /* ... */ }
  private updateEntry(entry: EdgeRenderEntry, edge: EdgeLike): void { /* ... */ }
  private disposeEntry(entry: EdgeRenderEntry): void { /* ... */ }
}
```

**Key design notes:**
- `EdgeLike` is a minimal interface accepted by both `DiagramEdgeState` and `DiagramPipeState` — no need for union types.
- The `materialFactory` dependency is injected, making `EdgeRenderer` unit-testable with a fake factory.
- `use3DArrows`, `edgeSmoothness`, `edgeMetalness`, `edgeRoughness` come from `DiagramThemeRenderConfig` and are set at construction time; `DiagramRenderer` creates an `EdgeRenderer` per diagram with the correct theme config.

**Test:** `rendering/__tests__/EdgeRenderer.test.ts`
- Uses `createFakeEdgeMaterialFactory()` that returns real `THREE.MeshStandardMaterial` instances
- `getOrCreate` with no prior entry → group added to parent
- `getOrCreate` again with same id → no duplicate group added to parent
- `getOrCreate` with changed `controlPoints` → geometry disposed and rebuilt
- `getOrCreate` with changed `color` only → material disposed and rebuilt, geometry unchanged
- `dispose(id)` → entry removed, group removed from parent
- `disposeAll` → all entries cleared

### 4.5 `rendering/NodeRenderer.ts`

Single responsibility: manage Three.js objects for diagram nodes. Holds an entry map and a reference to shared `IconLoader` and `InteractionRegistry`.

```typescript
import * as THREE from 'three';
import type { NodeRenderEntry, TextWithLayout } from './types';
import type { DiagramNodeState, DiagramThemeRenderConfig } from '../types';
import type { IIconLoader } from './IconLoader';
import type { IInteractionRegistry } from './InteractionRegistry';
import { ensureText } from './TextRenderer';
import { createShapeGeometry, createRoundedBorderGeometry } from '../shapes/geometryFactory';
import { createGlow, disposeGlowSprite } from '../../_shared/glowSprite';
import { Text } from 'troika-three-text';

export class NodeRenderer {
  private readonly entries = new Map<string, NodeRenderEntry>();

  constructor(
    private readonly iconLoader: IIconLoader,
    private readonly registry: IInteractionRegistry,
  ) {}

  /** key(diagramId, nodeId) → namespaced Map key */
  private key(diagramId: string, nodeId: string): string {
    return `${diagramId}::${nodeId}`;
  }

  /**
   * Ensure the node entry for (diagramId, nodeState.id) is current.
   * Creates entry if absent, updates in-place if present.
   * Adds the group to `parent` on first creation only.
   */
  getOrCreate(
    nodeState: DiagramNodeState,
    diagramId: string,
    themeConfig: DiagramThemeRenderConfig,
    parent: THREE.Object3D,
  ): NodeRenderEntry { /* ... */ }

  /** Remove and dispose a single node. */
  dispose(nodeId: string, diagramId: string, parent: THREE.Object3D): void { /* ... */ }

  /** Remove and dispose all nodes for a given diagram. */
  disposeAllForDiagram(diagramId: string, parent: THREE.Object3D): void { /* ... */ }

  private createEntry(state: DiagramNodeState, diagramId: string, tc: DiagramThemeRenderConfig): NodeRenderEntry { /* ... */ }
  private updateEntry(entry: NodeRenderEntry, state: DiagramNodeState, diagramId: string, tc: DiagramThemeRenderConfig): void { /* ... */ }
  private disposeEntry(entry: NodeRenderEntry): void { /* ... */ }
}
```

**Test:** `rendering/__tests__/NodeRenderer.test.ts`
- Provide a stub `IIconLoader` that resolves immediately with `new THREE.Group()`
- Provide a real `InteractionRegistry` instance
- `getOrCreate` with `clickable=true` → mesh registered in registry
- `dispose` → mesh unregistered from registry
- `getOrCreate` with changed `shape` → boxMesh geometry rebuilt
- `getOrCreate` with changed `opacity` → material opacity updated, no geometry rebuild
- `disposeAllForDiagram` → all entries for that diagramId removed, registry cleared for those meshes

### 4.6 `rendering/GroupRenderer.ts`

Single responsibility: manage Three.js fill plane + border lines for groups.

```typescript
import * as THREE from 'three';
import type { GroupRenderEntry } from './types';
import type { DiagramGroupState } from '../types';
import { ensureText } from './TextRenderer';
import { Text } from 'troika-three-text';

export class GroupRenderer {
  private readonly entries = new Map<string, GroupRenderEntry>();

  getOrCreate(state: DiagramGroupState, diagramId: string, parent: THREE.Object3D): GroupRenderEntry { /* ... */ }
  dispose(groupId: string, diagramId: string, parent: THREE.Object3D): void { /* ... */ }
  disposeAllForDiagram(diagramId: string, parent: THREE.Object3D): void { /* ... */ }
}
```

### 4.7 `rendering/EdgeMaterialFactory.ts`

Single responsibility: create Three.js materials for edges, own dash/dot texture cache.

```typescript
// Material and pattern texture factory for diagram edges.
import * as THREE from 'three';

export interface IEdgeMaterialFactory {
  createMaterial(
    color: string,
    opacity: number,
    style: 'solid' | 'dashed' | 'dotted',
    metalness: number,
    roughness: number,
  ): THREE.Material;
  /** Dispose all cached textures. */
  disposeTextures(): void;
}

export class EdgeMaterialFactory implements IEdgeMaterialFactory {
  private dashTexture: THREE.CanvasTexture | null = null;
  private dotTexture: THREE.CanvasTexture | null = null;

  createMaterial(color, opacity, style, metalness, roughness): THREE.Material { /* ... */ }
  disposeTextures(): void { /* ... */ }

  private getDashTexture(): THREE.CanvasTexture { /* ... */ }
  private getDotTexture(): THREE.CanvasTexture { /* ... */ }
}
```

**Key change:** Dash/dot textures are now **instance-level** (per factory), not module-level globals. The factory is created once per `DiagramRenderer` (or once shared at widget level), so textures are still cached efficiently within a session.

**Test:** `rendering/__tests__/EdgeMaterialFactory.test.ts`
- `createMaterial('solid')` → returns `MeshStandardMaterial` with no `map`
- `createMaterial('dashed')` → returns material with `map` set
- `createMaterial('dotted')` → returns material with a different `map`
- Two calls with `'dashed'` → same texture instance (no duplicate canvas creation)
- `disposeTextures()` → textures set to null (next call recreates)

### 4.8 `rendering/EnvMapManager.ts`

Single responsibility: load HDR environment maps and apply to Three.js scene.

```typescript
// Loads and caches HDR environment maps; applies to THREE.Scene.
import * as THREE from 'three';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';

export class EnvMapManager {
  private readonly cache = new Map<string, THREE.Texture>();
  private readonly loader = new RGBELoader();
  private lastAppliedUrl: string | null | 'none' = null;

  /**
   * Apply environment to scene from url.
   * - url is a string: loads HDR (cached after first load)
   * - url === 'none': sets scene.environment = null
   * - url === null: leaves scene.environment unchanged
   * Subsequent calls with the same url are no-ops.
   */
  apply(scene: THREE.Scene, url: string | 'none' | null, intensity: number): void { /* ... */ }

  /** Dispose all cached textures. */
  disposeAll(): void { /* ... */ }
}
```

### 4.9 `rendering/IconLoader.ts`

Single responsibility: async icon loading with shared application-level cache.

```typescript
// Async SVG/raster icon loader with module-level cache.
import * as THREE from 'three';
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';
import type { SvgIcon3DStyle } from '../types';
import { buildSvgIcon3D } from '../shapes/svgIcon3D';

export interface IIconLoader {
  load(
    url: string,
    width: number,
    height: number,
    style: SvgIcon3DStyle,
    maxDepth: number,
    metalness: number,
    roughness: number,
  ): Promise<THREE.Object3D>;
  disposeAll(): void;
}

/** Singleton exported for shared use across DiagramRenderer instances in same app. */
export const sharedIconLoader: IIconLoader = new IconLoaderImpl();

class IconLoaderImpl implements IIconLoader {
  private readonly cache = new Map<string, Promise<THREE.Object3D>>();
  private readonly svgLoader = new SVGLoader();
  private readonly textureLoader = new THREE.TextureLoader();

  load(url, width, height, style, maxDepth, metalness, roughness): Promise<THREE.Object3D> { /* ... */ }
  disposeAll(): void { this.cache.clear(); }
}
```

**Key design:** The `sharedIconLoader` singleton is application-scoped (same module instance = same cache), so icons are not re-fetched across multiple diagrams in the same session. Tests can substitute their own `IIconLoader` stub.

### 4.10 Refactored `render.ts` (Orchestrator)

After extraction, `render.ts` is reduced to ~100 lines — a thin orchestrator:

```typescript
// Three.js rendering for DiagramState.
// Orchestrates NodeRenderer, EdgeRenderer, GroupRenderer, EnvMapManager.

import * as THREE from 'three';
import type { DiagramState } from './types';
import { NodeRenderer } from './rendering/NodeRenderer';
import { EdgeRenderer } from './rendering/EdgeRenderer';
import { GroupRenderer } from './rendering/GroupRenderer';
import { EdgeMaterialFactory } from './rendering/EdgeMaterialFactory';
import { EnvMapManager } from './rendering/EnvMapManager';
import { InteractionRegistry } from './rendering/InteractionRegistry';
import { sharedIconLoader } from './rendering/IconLoader';

export class DiagramRenderer {
  private diagramGroups = new Map<string, THREE.Group>();
  private lastState = new Map<string, DiagramState>();
  private readonly envMapManager = new EnvMapManager();

  // Sub-renderers created lazily when first diagram state is applied.
  // Each DiagramRenderer owns its own InteractionRegistry (instance-scoped).
  readonly interactionRegistry = new InteractionRegistry();
  private nodeRenderer: NodeRenderer | null = null;
  private edgeRenderer: EdgeRenderer | null = null;
  private groupRenderer: GroupRenderer | null = null;

  update(state: DiagramState, parent: THREE.Object3D): void {
    const tc = state.themeConfig;
    // Lazy-init sub-renderers with correct theme config
    if (!this.nodeRenderer) {
      this.nodeRenderer = new NodeRenderer(sharedIconLoader, this.interactionRegistry);
      this.edgeRenderer = new EdgeRenderer(
        new EdgeMaterialFactory(),
        tc.use3DArrows, tc.edgeSmoothness, tc.edgeMetalness, tc.edgeRoughness,
      );
      this.groupRenderer = new GroupRenderer();
    }
    // ... create/update diagram root group, apply transform ...
    // ... remove stale entries ...
    // ... delegate to sub-renderers in order: groups → edges → nodes ...
    // ... call envMapManager.apply() if url changed ...
  }

  dispose(diagramId: string, parent: THREE.Object3D): void {
    // ... remove root group, delegate dispose to sub-renderers ...
    this.interactionRegistry.clear();
    this.envMapManager.disposeAll();
  }
}

// NO module-level registry exports — widget uses renderer.interactionRegistry directly.
```

---

## 5. Compiler Sub-Module Specifications

### 5.1 `compiler/edgeRouter.ts`

Extracted from `compile.ts`. Contains all routing logic with the two bug fixes applied.

**Exports:**
```typescript
// Face types
export type FaceId = 'left' | 'right' | 'top' | 'bottom' | 'front' | 'back';
export type Vec3 = readonly [number, number, number];
export type NodeDimensions = readonly [number, number, number]; // [w, h, d]

// Public API
export function nearestFace(origin: Vec3, target: Vec3): FaceId;
export function getFaceCenter(pos: Vec3, size: NodeDimensions, face: FaceId): Vec3;
export function getFaceNormal(face: FaceId): Vec3;
export function resolveFaces(
  srcPos: Vec3, srcSize: NodeDimensions,
  dstPos: Vec3, dstSize: NodeDimensions,
  landing: EdgeLandingAlgorithm,
  fromPort?: DiagramEdgePort,
  toPort?: DiagramEdgePort,
): { srcFace: FaceId; dstFace: FaceId };
export function routeEdgeCurved(srcPos, srcSize, srcFace, dstPos, dstSize, dstFace): ReadonlyArray<Vec3>;
export function routeEdgeOrthogonal(srcPos, srcSize, srcFace, dstPos, dstSize, dstFace): ReadonlyArray<Vec3>;
export function routeEdgeStraight(srcPos, srcSize, srcFace, dstPos, dstSize, dstFace): ReadonlyArray<Vec3>;
export function routeEdgeOrganic(srcPos, srcSize, srcFace, dstPos, dstSize, dstFace, edgeId): ReadonlyArray<Vec3>;
export function routeEdges(
  edges: ReadonlyArray<EdgeRoutingInput>,
  positions: Map<string, Vec3>,
  sizes: Map<string, NodeDimensions>,
  defaultRouting?: EdgeRoutingAlgorithm,
  defaultLanding?: EdgeLandingAlgorithm,
): Map<string, ReadonlyArray<Vec3>>;
```

**Critical implementation changes:**
1. `nearestFace`: change threshold from `1.0` to `0.7` (see §2.2)
2. `routeEdgeCurved`: add anti-parallel normal detection and arc fallback (see §2.1)

### 5.2 `compiler/layoutAlgorithms.ts`

Extracted from `compile.ts`. No changes to logic.

**Exports:**
```typescript
export function resolveLayout(
  nodes: ReadonlyArray<DiagramNodeDSL>,
  edges: ReadonlyArray<DiagramEdgeDSL>,
  layout: 'manual' | 'grid' | 'hierarchical',
  spacing: [number, number],
): Map<string, readonly [number, number, number]>;

export function computeBounds(
  nodeIds: ReadonlyArray<string>,
  positions: Map<string, readonly [number, number, number]>,
  sizes: Map<string, readonly [number, number]>,
): { x: number; y: number; w: number; h: number; minZ: number; maxZ: number };
```

### 5.3 `compiler/transitionHelpers.ts`

**NEW file** that eliminates the ~110-line duplication between `compile.ts` and `canvas/compile.ts`.

```typescript
// Shared node/edge blending utilities for diagram transition specs.
// Used by both functionalDiagramTransitionSpec and functionalDiagramCanvasTransitionSpec.

import type { DiagramNodeState, DiagramEdgeState } from '../types';
import type { EdgeRoutingAlgorithm, EdgeLandingAlgorithm } from '../types';
import { blendOpacity, blendVec3 } from '@brewsite/core';
import { routeEdges } from './edgeRouter';

type Vec3 = readonly [number, number, number];
type NodeDimensions = readonly [number, number, number];

/**
 * Blend two sets of nodes at interpolation progress t.
 * - Nodes present in both: lerp position + opacity
 * - New nodes (in toNodes only): fade in
 * - Fading nodes (in fromNodes only): fade out
 *
 * Returns [blendedNodes, fadingNodes] as two separate arrays so the caller
 * can pass both to rerouteLiveEdges.
 */
export function blendDiagramNodes(
  fromNodes: ReadonlyArray<DiagramNodeState>,
  toNodes: ReadonlyArray<DiagramNodeState>,
  t: number,
): { blended: DiagramNodeState[]; fading: DiagramNodeState[] };

/**
 * Build the live position + size maps from the full set of active nodes
 * (blended + fading). Used as input to rerouteLiveEdges.
 */
export function buildLiveNodeMaps(
  nodes: ReadonlyArray<DiagramNodeState>,
): {
  positions: Map<string, Vec3>;
  sizes: Map<string, NodeDimensions>;
};

/**
 * Re-route a combined set of current and fading edges using live node positions.
 * Returns a Map<edgeId, controlPoints> that callers attach to each edge state.
 *
 * This is called every frame during transitions to keep tube geometry tracking
 * its moving endpoint nodes.
 */
export function rerouteLiveEdges(
  toEdges: ReadonlyArray<DiagramEdgeState>,
  fromEdges: ReadonlyArray<DiagramEdgeState>,
  toEdgeIds: Set<string>,
  livePositions: Map<string, Vec3>,
  liveSizes: Map<string, NodeDimensions>,
  defaultRouting?: EdgeRoutingAlgorithm,
  defaultLanding?: EdgeLandingAlgorithm,
): Map<string, ReadonlyArray<Vec3>>;

/**
 * Blend two sets of edges using live control points from rerouteLiveEdges.
 * Returns [blendedEdges, fadingEdges].
 */
export function blendDiagramEdges(
  fromEdges: ReadonlyArray<DiagramEdgeState>,
  toEdges: ReadonlyArray<DiagramEdgeState>,
  liveControlPoints: Map<string, ReadonlyArray<Vec3>>,
  t: number,
): { blended: DiagramEdgeState[]; fading: DiagramEdgeState[] };
```

**Test:** `compiler/__tests__/transitionHelpers.test.ts`
- `blendDiagramNodes` at t=0: blended nodes have fromNode positions; fading nodes have full opacity
- `blendDiagramNodes` at t=1: blended nodes have toNode positions; fading nodes have opacity=0
- `blendDiagramNodes` with node only in to: appears with opacity=0 at t=0, full opacity at t=1
- `rerouteLiveEdges`: returns empty controlPoints for edges with missing node references
- `blendDiagramEdges` at t=0: blended edges have fromEdge opacity; at t=1: toEdge opacity

### 5.4 `compiler/nodeCompiler.ts`

Extracted from `compile.ts`. No logic changes.

**Exports:**
```typescript
export function buildNodeDefaults(theme: DiagramTheme): NodeDefaults;
export function buildEdgeDefaults(theme: DiagramTheme): EdgeDefaults;
export function buildGroupDefaults(theme: DiagramTheme): GroupDefaults;

export function compileNode(
  dsl: DiagramNodeDSL,
  position: readonly [number, number, number],
  groupId: string | undefined,
  theme: DiagramTheme,
  positionInherited?: boolean,
): DiagramNodeState;

export function compileEdge(
  dsl: DiagramEdgeDSL,
  controlPoints: ReadonlyArray<readonly [number, number, number]>,
  index: number,
  theme: DiagramTheme,
): DiagramEdgeState;
```

### 5.5 `compiler/groupCompiler.ts`

Extracted from `compile.ts`. No logic changes.

**Exports:**
```typescript
export function compileGroup(
  dsl: DiagramGroupDSL,
  positions: Map<string, readonly [number, number, number]>,
  sizes: Map<string, readonly [number, number]>,
  theme: DiagramTheme,
): DiagramGroupState;
```

### 5.6 `compiler/themeResolver.ts`

Extracted from `compile.ts`. No logic changes.

**Exports:**
```typescript
export function buildThemeRenderConfig(theme: DiagramTheme): DiagramThemeRenderConfig;
export function compileExitConfig(dsl: DiagramExitDSL | undefined): DiagramExitConfig | null;
export function compileEnterConfig(dsl: DiagramEnterDSL | undefined): DiagramEnterConfig | null;
```

### 5.7 Refactored `compile.ts` (Orchestrator)

After extraction, `compile.ts` shrinks to ~250 lines:
- `applyEasing` (stays here — used by exit/enter)
- `compilePivotOffset` (stays here — used only by `compileDiagram`)
- `compileDiagram` (orchestrator: calls all the extracted functions)
- `functionalDiagramTransitionSpec` (uses `transitionHelpers`)
- `applyDiagramExit`, `applyDiagramEnter` (stays here — used by canvas compile too)
- Re-exports: `routeEdges` from `compiler/edgeRouter.ts` (for backward compat)
- Re-exports: `resolveLayout`, `computeBounds` from `compiler/layoutAlgorithms.ts`

### 5.8 `canvas/compile.ts` — Remove Duplication

Refactor `functionalDiagramCanvasTransitionSpec.interpolateFn` (~115 lines) to use `transitionHelpers`:

```typescript
// Before: 115 lines of inline node/edge blending logic per-diagram
// After: delegate to blendDiagramNodes, rerouteLiveEdges, blendDiagramEdges
interpolateFn: (from, to) => (t) => {
  const fromDiagramMap = new Map(from.diagrams.map((d) => [d.id, d]));

  const interpolatedDiagrams = to.diagrams.map((toDiagram) => {
    const fromDiagram = fromDiagramMap.get(toDiagram.id);
    if (!fromDiagram) return applyDiagramEnter(toDiagram, t);

    const { blended, fading } = blendDiagramNodes(fromDiagram.nodes, toDiagram.nodes, t);
    const { positions, sizes } = buildLiveNodeMaps([...blended, ...fading]);
    const toEdgeIds = new Set(toDiagram.edges.map((e) => e.id));
    const livePoints = rerouteLiveEdges(toDiagram.edges, fromDiagram.edges, toEdgeIds, positions, sizes);
    const { blended: blendedEdges, fading: fadingEdges } = blendDiagramEdges(
      fromDiagram.edges, toDiagram.edges, livePoints, t,
    );

    return {
      ...toDiagram,
      position: blendVec3(toMut(fromDiagram.position), toMut(toDiagram.position), t) ?? toDiagram.position,
      rotation: blendVec3(toMut(fromDiagram.rotation), toMut(toDiagram.rotation), t) ?? toDiagram.rotation,
      scale: blendNumber(fromDiagram.scale, toDiagram.scale, t) ?? toDiagram.scale,
      nodes: [...blended, ...fading],
      edges: [...blendedEdges, ...fadingEdges],
    };
  });
  // ... fading diagrams, pipe blending (unchanged) ...
},
```

### 5.9 Canvas Pipe Router Fix — `sideAttachmentPoint`

Move `sideAttachmentPoint` and `routePipe` into `canvas/compiler/pipeRouter.ts`.

**Fix `sideAttachmentPoint`** to apply full XYZ rotation (see §2.3). Full implementation:

```typescript
// canvas/compiler/pipeRouter.ts
// Pipe routing utilities for cross-diagram connections.

type Vec3 = readonly [number, number, number];

/**
 * Apply a standard Three.js Euler XYZ rotation to a vector.
 * Produces the correct canvas-local direction for the diagram's local axes.
 */
function rotateXYZ(v: Vec3, rx: number, ry: number, rz: number): Vec3 {
  const cx = Math.cos(rx), sx = Math.sin(rx);
  const cy = Math.cos(ry), sy = Math.sin(ry);
  const cz = Math.cos(rz), sz = Math.sin(rz);
  return [
    (cy * cz) * v[0] + (sx * sy * cz - cx * sz) * v[1] + (cx * sy * cz + sx * sz) * v[2],
    (cy * sz) * v[0] + (sx * sy * sz + cx * cz) * v[1] + (cx * sy * sz - sx * cz) * v[2],
    (   -sy ) * v[0] + (sx * cy             ) * v[1] + (cx * cy             ) * v[2],
  ];
}

export function sideAttachmentPoint(
  nodeLocalPos: Vec3,
  nodeSize: readonly [number, number],
  nodeDepth: number,
  diagramPos: Vec3,
  diagramScale: number,
  diagramRotation: Vec3,          // [rx, ry, rz] — all three axes
  targetDiagramPos: Vec3,
): { point: Vec3; normal: Vec3 } {
  const cx = nodeLocalPos[0] * diagramScale + diagramPos[0];
  const cy = nodeLocalPos[1] * diagramScale + diagramPos[1];
  const cz = nodeLocalPos[2] * diagramScale + diagramPos[2];

  // Full rotation: apply XYZ Euler to the diagram's local [1,0,0] axis
  const [rx, ry, rz] = diagramRotation;
  const localXinCanvas = rotateXYZ([1, 0, 0], rx, ry, rz);

  const tx = targetDiagramPos[0];
  const side = tx > cx ? 1 : -1;
  const halfW = (nodeSize[0] / 2) * diagramScale;

  const px = cx + localXinCanvas[0] * side * halfW;
  const py = cy + localXinCanvas[1] * side * halfW;
  const pz = cz + localXinCanvas[2] * side * halfW;
  const normal: Vec3 = [
    localXinCanvas[0] * side,
    localXinCanvas[1] * side,
    localXinCanvas[2] * side,
  ];
  return { point: [px, py, pz], normal };
}

/**
 * Route a pipe with the anti-parallel arc fix (same fix as routeEdgeCurved).
 */
export function routePipe(
  from: Vec3,
  to: Vec3,
  fromNormal?: Vec3,
  toNormal?: Vec3,
  routing: PipeRoutingAlgorithm = 'curved',
): ReadonlyArray<Vec3> {
  if (routing === 'straight') return [from, to];

  const dist = Math.sqrt(
    (to[0] - from[0]) ** 2 + (to[1] - from[1]) ** 2 + (to[2] - from[2]) ** 2,
  );
  const stub = Math.min(3.0, dist * 0.20);

  if (fromNormal && toNormal) {
    const dotNormals = fromNormal[0]*toNormal[0] + fromNormal[1]*toNormal[1] + fromNormal[2]*toNormal[2];
    if (dotNormals < -0.3) {
      // Anti-parallel: bow perpendicular to edge direction (same fix as edgeRouter)
      const midX = (from[0] + to[0]) / 2;
      const midY = (from[1] + to[1]) / 2;
      const edgeDx = to[0] - from[0], edgeDy = to[1] - from[1];
      const edgeLen = Math.sqrt(edgeDx*edgeDx + edgeDy*edgeDy) || 1;
      const perpX = -edgeDy / edgeLen, perpY = edgeDx / edgeLen;
      const bow = Math.min(1.5, dist * 0.20);
      return [from, [midX + perpX * bow, midY + perpY * bow, from[2]], to];
    }
    // Parallel/convergent: use face-exit arc
    const g1: Vec3 = [from[0] + fromNormal[0]*stub, from[1] + fromNormal[1]*stub, from[2] + fromNormal[2]*stub];
    const g2: Vec3 = [to[0]   + toNormal[0]  *stub, to[1]   + toNormal[1]  *stub, to[2]   + toNormal[2]  *stub];
    return [from, g1, g2, to];
  }

  // No normals — elevated midpoint arc (legacy fallback)
  const arcH = Math.max(0.5, dist * 0.15);
  const midX = (from[0] + to[0]) / 2;
  const midY = (from[1] + to[1]) / 2 + arcH;
  const midZ = (from[2] + to[2]) / 2;
  const ctrl1: Vec3 = [from[0] + (midX - from[0]) * 0.5, from[1] + (midY - from[1]) * 0.5, from[2] + (midZ - from[2]) * 0.5];
  const ctrl2: Vec3 = [midX + (to[0] - midX) * 0.5, midY + (to[1] - midY) * 0.5, midZ + (to[2] - midZ) * 0.5];
  return [from, ctrl1, ctrl2, to];
}
```

---

## 6. Widget Changes

### 6.1 `widget.ts` — Replace Global Interaction Imports

**Before:**
```typescript
import {
  DiagramRenderer,
  diagramInteractionRegistry,
  diagramInteractionLookup,
} from './render';
// ...
const targets = Array.from(diagramInteractionRegistry);
const info = diagramInteractionLookup.get(mesh);
```

**After:**
```typescript
import { DiagramRenderer } from './render';
// renderer.interactionRegistry is the instance-scoped registry
// ...
const targets = Array.from(this.renderer.interactionRegistry.meshes);
const info = this.renderer.interactionRegistry.lookup(mesh);
```

No other changes to `widget.ts`.

### 6.2 `canvas/widget.ts` — Fix Global Registry + onTick Framing

**Change 1: Replace global registry imports** (same pattern as §6.1, applied to `DiagramCanvasWidget`)

```typescript
// Before:
import { diagramInteractionRegistry, diagramInteractionLookup } from '../render';
// ...
const intersects = this.raycaster.intersectObjects(Array.from(diagramInteractionRegistry), false);
const info = diagramInteractionLookup.get(hit.object as THREE.Mesh);
const ownsDiagram = this.lastState?.diagrams.some((d) => d.id === info.diagramId) ?? false;

// After:
// Each child DiagramRenderer in DiagramCanvasRenderer owns its own registry.
// DiagramCanvasWidget reaches them via renderer.getInteractionMeshes() — a new
// method on DiagramCanvasRenderer that aggregates meshes from all child renderers.
const intersects = this.raycaster.intersectObjects(
  Array.from(this.renderer.getInteractionMeshes()),
  false,
);
const info = this.renderer.lookupInteraction(hit.object as THREE.Mesh);
```

Add to `DiagramCanvasRenderer`:
```typescript
/** Aggregated set of all clickable meshes across all child DiagramRenderers. */
getInteractionMeshes(): ReadonlySet<THREE.Mesh> {
  const all = new Set<THREE.Mesh>();
  for (const dr of this.diagramRenderers.values()) {
    for (const m of dr.interactionRegistry.meshes) all.add(m);
  }
  return all;
}

/** Look up diagramId+nodeId for a mesh across all child renderers. */
lookupInteraction(mesh: THREE.Mesh): { diagramId: string; nodeId: string } | undefined {
  for (const dr of this.diagramRenderers.values()) {
    const info = dr.interactionRegistry.lookup(mesh);
    if (info) return info;
  }
  return undefined;
}
```

**Change 2: Fix `onTick` camera framing to account for rotation**

The fixed implementation transforms all four corners of each diagram's XY bounding box through the combined diagram + canvas rotation before computing the AABB. Use the `rotateXYZ` utility from `canvas/compiler/pipeRouter.ts`:

```typescript
onTick(context: AnimationTickContext): void {
  // ... (camera yield guard unchanged) ...

  const [crx, cry, crz] = state.rotation; // canvas rotation
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

  for (const diagram of state.diagrams) {
    const { bounds: b } = diagram;
    const ds = diagram.scale;
    const [drx, dry, drz] = diagram.rotation;
    const [dpx, dpy, dpz] = diagram.position;
    const cs = state.scale;
    const [cpx, cpy, cpz] = state.position;

    // Four XY corners of this diagram's bounds in diagram-local space
    const corners: Vec3[] = [
      [b.x,         b.y,         0],
      [b.x + b.w,   b.y,         0],
      [b.x,         b.y + b.h,   0],
      [b.x + b.w,   b.y + b.h,   0],
    ];

    for (const corner of corners) {
      // 1. Apply diagram scale + translation → diagram-local to canvas-local
      const cx = corner[0] * ds + dpx;
      const cy = corner[1] * ds + dpy;
      const cz = corner[2] * ds + dpz;
      // 2. Apply diagram rotation (around its own origin)
      const [rx1, ry1, rz1] = rotateXYZ([cx, cy, cz], drx, dry, drz);
      // 3. Apply canvas scale + translation
      const wx = rx1 * cs + cpx;
      const wy = ry1 * cs + cpy;
      const wz = rz1 * cs + cpz;
      // 4. Apply canvas rotation
      const [wx2, wy2] = rotateXYZ([wx, wy, wz], crx, cry, crz);
      minX = Math.min(minX, wx2); maxX = Math.max(maxX, wx2);
      minY = Math.min(minY, wy2); maxY = Math.max(maxY, wy2);
    }
  }

  const worldCX = (minX + maxX) / 2;
  const worldCY = (minY + maxY) / 2;
  const maxDim = Math.max(maxX - minX, maxY - minY);
  const dist = (maxDim / (2 * Math.tan((45 * Math.PI / 180) / 2))) * 1.2;
  cam.position.set(worldCX, worldCY + dist * 0.3, state.position[2] + dist);
  cam.lookAt(worldCX, worldCY, state.position[2]);
}
```

Apply the same rotation-aware framing to `DiagramWidget.onTick` (single diagram case), where `diagram.rotation` is applied to the bounds corners before computing the AABB.

---

## 7. Test Strategy

### 7.1 New Test Files

All tests use **Vitest**, Node environment, no real timers, no browser APIs. Three.js objects are real instances (no mocks), but icon loader and env map loader are interface stubs.

#### `compiler/__tests__/edgeRouter.test.ts`

```typescript
// CRITICAL: verifies the two routing bug fixes

describe('nearestFace', () => {
  it('selects bottom when target is below-left at 39° from horizontal', () => {
    // api [0,-4] → ecs [-5,-8]: angle = atan(4/5) ≈ 39° from horizontal
    // With new threshold 0.7: ady=4 >= adx*0.7=3.5 → should return bottom
    expect(nearestFace([0,-4,0], [-5,-8,0])).toBe('bottom');
  });
  it('selects top when target is above-left at 39°', () => {
    expect(nearestFace([0,-4,0], [-5,0,0])).toBe('top');  // dy=4, dx=5, 4>=3.5 → top
  });
  it('selects left when target is directly left (no vertical component)', () => {
    expect(nearestFace([0,0,0], [-5,0,0])).toBe('left');
  });
  it('selects top/bottom for steep diagonals (greater than 45°)', () => {
    expect(nearestFace([0,0,0], [-3,-5,0])).toBe('bottom'); // ady=5 >= adx*0.7=2.1
  });
});

describe('routeEdgeCurved — anti-parallel arc fix', () => {
  it('does NOT produce S-curve for left→right face connection', () => {
    // api (left face, normal [-1,0,0]) → ecs (right face, normal [+1,0,0])
    const pts = routeEdgeCurved(
      [0,-4,0], [4,2,0.4] as NodeDimensions, 'left',
      [-5,-8,0], [4,2,0.4] as NodeDimensions, 'right',
    );
    // Anti-parallel fix: returns 3 points (start, midArc, end)
    expect(pts).toHaveLength(3);
    // The arc midpoint should be offset perpendicular, not between stubs
    const [start, arc, end] = pts;
    // Verify arc bows away from the direct line (not S-shaped)
    const directMidX = (start[0] + end[0]) / 2;
    const directMidY = (start[1] + end[1]) / 2;
    expect(Math.abs(arc[0] - directMidX) + Math.abs(arc[1] - directMidY)).toBeGreaterThan(0.1);
  });

  it('returns 4 points for convergent faces (top→bottom, normal arc)', () => {
    const pts = routeEdgeCurved(
      [0,2,0], [4,2,0.4] as NodeDimensions, 'bottom',
      [0,-1,0], [4,2,0.4] as NodeDimensions, 'top',
    );
    // Normal case: dotNormals = dot([0,-1],[0,1]) = -1 → actually anti-parallel!
    // bottom normal [0,-1,0] vs top normal [0,1,0] → dot = -1 → arc fix applies
    expect(pts).toHaveLength(3);
  });

  it('returns 4 points for same-side connection (left→left, dot=+1)', () => {
    // Same direction normals — this is a parallel case, not anti-parallel
    // dot([-1,0,0], [-1,0,0]) = 1 → standard cubic Bezier
    const pts = routeEdgeCurved(
      [0,0,0], [4,2,0.4] as NodeDimensions, 'left',
      [-8,0,0], [4,2,0.4] as NodeDimensions, 'left',
    );
    expect(pts).toHaveLength(4);
  });
});

describe('routeEdgeOrthogonal', () => {
  it('routes H→H as Z-shape via midY', () => {
    const pts = routeEdgeOrthogonal(
      [0,0,0], [4,2,0.4] as NodeDimensions, 'right',
      [6,4,0], [4,2,0.4] as NodeDimensions, 'left',
    );
    expect(pts.length).toBeGreaterThanOrEqual(6);
    // All segments should be either horizontal or vertical (no diagonals in XY)
    for (let i = 0; i < pts.length - 1; i++) {
      const dx = Math.abs(pts[i+1][0] - pts[i][0]);
      const dy = Math.abs(pts[i+1][1] - pts[i][1]);
      expect(Math.min(dx, dy)).toBeLessThan(0.01); // one axis should be ~0
    }
  });
});
```

#### `compiler/__tests__/layoutAlgorithms.test.ts`

Move existing layout tests from `diagram/__tests__/compile.test.ts` here. No new logic needed.

#### `compiler/__tests__/transitionHelpers.test.ts`

```typescript
describe('blendDiagramNodes', () => {
  it('lerps position at t=0.5 for nodes present in both scenes', () => { /* ... */ });
  it('fades in new nodes from opacity=0 at t=0', () => { /* ... */ });
  it('fades out removed nodes toward opacity=0 at t=1', () => { /* ... */ });
});

describe('rerouteLiveEdges', () => {
  it('returns empty array for self-loop edges', () => { /* ... */ });
  it('returns fallback [0,0,0]→[0,0,0] for edges with missing nodes', () => { /* ... */ });
  it('recomputes control points when node positions change', () => { /* ... */ });
});

describe('blendDiagramEdges', () => {
  it('blends opacity for edges in both scenes', () => { /* ... */ });
  it('attaches live control points from rerouteLiveEdges result', () => { /* ... */ });
});
```

#### `rendering/__tests__/InteractionRegistry.test.ts`

```typescript
describe('InteractionRegistry', () => {
  it('register and lookup returns correct info', () => { /* ... */ });
  it('unregister removes from meshes and map', () => { /* ... */ });
  it('clear empties both collections', () => { /* ... */ });
  it('registering same mesh twice: second wins', () => { /* ... */ });
  it('meshes ReadonlySet reflects current state', () => { /* ... */ });
});
```

#### `rendering/__tests__/EdgeMaterialFactory.test.ts`

```typescript
describe('EdgeMaterialFactory', () => {
  it('solid style → MeshStandardMaterial with no map', () => { /* ... */ });
  it('dashed style → material with texture map set', () => { /* ... */ });
  it('dotted style → material with different texture map', () => { /* ... */ });
  it('two dashed calls → same texture instance', () => { /* ... */ });
  it('disposeTextures → next call recreates texture', () => { /* ... */ });
});
```

#### `rendering/__tests__/EdgeRenderer.test.ts`

```typescript
describe('EdgeRenderer', () => {
  let factory: IEdgeMaterialFactory;
  let renderer: EdgeRenderer;
  let parent: THREE.Group;

  beforeEach(() => {
    factory = new EdgeMaterialFactory();
    renderer = new EdgeRenderer(factory);
    parent = new THREE.Group();
  });

  it('getOrCreate adds group to parent on first call', () => { /* ... */ });
  it('getOrCreate same id → no duplicate in parent.children', () => { /* ... */ });
  it('controlPoints change → geometry disposed and rebuilt', () => { /* ... */ });
  it('color change only → material disposed and rebuilt, geometry unchanged', () => { /* ... */ });
  it('dispose removes group from parent', () => { /* ... */ });
  it('disposeAll clears all entries', () => { /* ... */ });
  it('edge with < 2 control points → group.visible = false', () => { /* ... */ });
});
```

#### `rendering/__tests__/NodeRenderer.test.ts`

```typescript
describe('NodeRenderer', () => {
  it('clickable node → mesh registered in InteractionRegistry', () => { /* ... */ });
  it('non-clickable node → mesh NOT registered', () => { /* ... */ });
  it('dispose → mesh removed from registry', () => { /* ... */ });
  it('shape change → boxMesh geometry rebuilt', () => { /* ... */ });
  it('opacity change only → material opacity updated, geometry unchanged', () => { /* ... */ });
  it('disposeAllForDiagram → all that diagram\'s entries removed', () => { /* ... */ });
});
```

#### `rendering/__tests__/EnvMapManager.test.ts`

```typescript
describe('EnvMapManager', () => {
  it('apply() with same URL twice → loader called only once (cache hit)', () => { /* ... */ });
  it('apply() with url="none" → scene.environment set to null', () => { /* ... */ });
  it('apply() with url=null → scene.environment left unchanged', () => { /* ... */ });
  it('disposeAll() → cache cleared; next apply() re-fetches', () => { /* ... */ });
});
```

#### `rendering/__tests__/IconLoader.test.ts`

```typescript
describe('IconLoader — failed load cache eviction', () => {
  it('failed SVG load → cache entry deleted; subsequent call retries', () => {
    // Provide a mock SVGLoader that rejects on first call, succeeds on second
    // First load attempt: rejects → cache entry must NOT be retained
    // Second load attempt: succeeds → returns correct Object3D
  });
  it('successful load → result cached; second call returns same promise', () => { /* ... */ });
  it('disposeAll() → cache cleared', () => { /* ... */ });
});
```

#### `canvas/compiler/__tests__/pipeRouter.test.ts`

```typescript
describe('sideAttachmentPoint — full rotation fix', () => {
  it('zero rotation → returns canonical left/right face point', () => { /* ... */ });
  it('X rotation [-π/4] → local X-axis tilted into Z; attachment point has Z component', () => {
    // diagramRotation = [-Math.PI/4, 0, 0]
    // localXinCanvas should be [1, 0, 0] rotated by -45° around X → [1, 0, 0]
    // (X-axis is unchanged by X-rotation — only Y and Z mix)
    // Actually: rotateXYZ([1,0,0], -π/4, 0, 0) = [cos0*cos0, cos0*sin0, sin0] = [1, 0, 0]
    // For Y-rotation of π/4: rotateXYZ([1,0,0], 0, π/4, 0) = [cos(π/4), 0, -sin(π/4)]
    // This test verifies Y-rotation case produces correct tilted X-axis
    const result = sideAttachmentPoint(
      [0, 0, 0], [4, 2], 0.4,
      [0, 0, 0], 1,
      [0, Math.PI / 4, 0],  // Y-rotation of 45°
      [10, 0, 0],           // target is to the right
    );
    expect(result.normal[0]).toBeCloseTo(Math.cos(Math.PI / 4));
    expect(result.normal[2]).toBeCloseTo(-Math.sin(Math.PI / 4));
  });
  it('previously broken: Y-only approximation vs full matrix differ for X-rotation', () => {
    // Confirm old Y-only code would return [1,0,0] for X-rotation,
    // new full-matrix code returns correct axis
    const [rx, ry, rz] = [-Math.PI / 4, 0, 0];
    const oldApprox: Vec3 = [Math.cos(ry), 0, -Math.sin(ry)]; // [1,0,0]
    const correct = rotateXYZ([1, 0, 0], rx, ry, rz);         // [1, 0, 0] — same for X-rot!
    // Note: pure X-rotation doesn't change the X-axis direction, but combined rotations do.
    // Test with combined rotation: [rx=-π/4, ry=π/6, rz=0]
    const oldCombined: Vec3 = [Math.cos(Math.PI/6), 0, -Math.sin(Math.PI/6)];
    const newCombined = rotateXYZ([1, 0, 0], -Math.PI/4, Math.PI/6, 0);
    // Y component should differ (old approx has Y=0, correct has Y≠0 due to X tilt)
    expect(newCombined[1]).not.toBeCloseTo(0);
    expect(oldCombined[1]).toBeCloseTo(0);
  });
});

describe('routePipe — anti-parallel arc fix', () => {
  it('anti-parallel normals (left→right) → 3-point arc, not S-curve', () => { /* ... */ });
  it('convergent normals (facing each other) → 4-point arc', () => { /* ... */ });
  it('straight routing → returns exactly [from, to]', () => { /* ... */ });
  it('no normals → elevated midpoint fallback', () => { /* ... */ });
});

describe('rerouteLivePipes', () => {
  it('pipe with valid from/to nodes → computes side-attachment points', () => { /* ... */ });
  it('pipe with missing from node → returns empty controlPoints, warns', () => { /* ... */ });
  it('returns same number of entries as input pipes', () => { /* ... */ });
});
```

---

## 8. Canvas Renderer Simplification

After `EdgeRenderer` extraction, `canvas/render.ts` becomes:

```typescript
// Three.js rendering for DiagramCanvasState.
// Orchestrates child DiagramRenderers and pipe EdgeRenderer.

import * as THREE from 'three';
import type { DiagramCanvasState, DiagramPipeState } from './types';
import { DiagramRenderer } from '../render';
import { EdgeRenderer } from '../rendering/EdgeRenderer';
import { EdgeMaterialFactory } from '../rendering/EdgeMaterialFactory';

export class DiagramCanvasRenderer {
  private canvasGroup: THREE.Group | null = null;
  private pipeRoot: THREE.Group | null = null;
  private diagramRenderers = new Map<string, DiagramRenderer>();
  // Pipes use the shared EdgeRenderer — no more duplicated createPipe/updatePipe
  private pipeRenderer: EdgeRenderer | null = null;

  update(state: DiagramCanvasState, scene: THREE.Scene): void {
    if (!this.canvasGroup) {
      this.canvasGroup = new THREE.Group();
      this.canvasGroup.name = `canvas:${state.id}`;
      this.pipeRoot = new THREE.Group();
      this.pipeRoot.name = `canvas:${state.id}:pipes`;
      this.canvasGroup.add(this.pipeRoot);
      scene.add(this.canvasGroup);
      this.pipeRenderer = new EdgeRenderer(new EdgeMaterialFactory());
    }
    // ... apply canvas transform ...
    // ... manage diagramRenderers (unchanged) ...
    // Pipes: delegate to pipeRenderer
    const activePipeIds = new Set(state.pipes.map((p) => p.id));
    for (const id of this.pipeRenderer!.ids) {
      if (!activePipeIds.has(id)) this.pipeRenderer!.dispose(id, this.pipeRoot!);
    }
    for (const pipe of state.pipes) {
      this.pipeRenderer!.getOrCreate(pipe, this.pipeRoot!);
    }
  }

  dispose(canvasId: string, scene: THREE.Scene): void {
    // ... dispose diagramRenderers ...
    this.pipeRenderer?.disposeAll(this.pipeRoot ?? new THREE.Group());
    // ... remove canvas group from scene ...
  }
}
```

`canvas/render.ts` reduces from **179 lines to ~80 lines** with zero duplication.

---

## 9. Public API (`index.ts`) Changes

The package's `src/index.ts` has no visible API change — all internal restructuring is hidden behind the same exports. Two additions:

1. Export `InteractionRegistry` and `IInteractionRegistry` from `rendering/InteractionRegistry.ts` — useful for consumers who need to integrate click handling.
2. Export `routeEdges` from `compiler/edgeRouter.ts` (was previously exported from `compile.ts` as a re-export — keep it re-exported from `compile.ts` for backward compat, no change needed).

---

## 10. Migration Sequence

This refactoring must be **non-breaking at every commit**. Implement in this exact order:

### Step 1 — Bug Fixes First (Isolated, Testable)

1. Add `compiler/__tests__/edgeRouter.test.ts` with failing test cases for the two bugs.
2. Extract `nearestFace`, `routeEdges`, and all routing functions into `compiler/edgeRouter.ts` with the two fixes applied.
3. Update `compile.ts` to import from `compiler/edgeRouter.ts` (re-export for backward compat).
4. Verify all existing `compile.test.ts` tests still pass. New routing tests should now pass.

### Step 2 — Shared Transition Helpers

1. Write `compiler/transitionHelpers.ts` with `blendDiagramNodes`, `blendDiagramEdges`, `rerouteLiveEdges`.
2. Add `compiler/__tests__/transitionHelpers.test.ts`.
3. Refactor `functionalDiagramTransitionSpec.interpolateFn` in `compile.ts` to use the helpers.
4. Refactor `functionalDiagramCanvasTransitionSpec.interpolateFn` in `canvas/compile.ts` to use the same helpers.
5. Verify existing transition spec tests still pass.

### Step 3 — Canvas Pipe Router Fix

1. Create `canvas/compiler/pipeRouter.ts` with the fixed `sideAttachmentPoint`, `routePipe` (arc fix), and `rerouteLivePipes`.
2. Update `canvas/compile.ts` to import from `pipeRouter.ts`, replacing the inline `sideAttachmentPoint` and the bare `routePipe(fromPos, toPos)` calls in `interpolateFn` with `rerouteLivePipes`.
3. Add tests: `canvas/compiler/__tests__/pipeRouter.test.ts` covering rotation fix, anti-parallel arc fix, and `rerouteLivePipes`.

### Step 4 — Remaining Compile Extractions

1. Extract `compiler/layoutAlgorithms.ts`.
2. Extract `compiler/nodeCompiler.ts`.
3. Extract `compiler/groupCompiler.ts`.
4. Extract `compiler/themeResolver.ts`.
5. Update `compile.ts` imports. All existing tests must pass.

### Step 5 — Rendering Layer Extraction

1. Create `rendering/types.ts`.
2. Create `rendering/InteractionRegistry.ts` with tests.
3. Create `rendering/TextRenderer.ts` (extracted `ensureText`).
4. Create `rendering/EdgeMaterialFactory.ts` with tests.
5. Create `rendering/EnvMapManager.ts`.
6. Create `rendering/IconLoader.ts`.
7. Create `rendering/EdgeRenderer.ts` with tests.
8. Create `rendering/NodeRenderer.ts` with tests.
9. Create `rendering/GroupRenderer.ts` with tests.

### Step 6 — Refactor DiagramRenderer

1. Refactor `render.ts` to orchestrate the new sub-renderers.
2. Remove `diagramInteractionRegistry` and `diagramInteractionLookup` module-level exports.
3. Update `widget.ts` to use `this.renderer.interactionRegistry` (§6.1 changes).
4. Verify widget-level interaction tests pass.

### Step 7 — Refactor DiagramCanvasRenderer + Fix Canvas Widget

1. Refactor `canvas/render.ts` to use `EdgeRenderer` for pipes.
2. Add `getInteractionMeshes()` and `lookupInteraction()` to `DiagramCanvasRenderer`.
3. Remove the duplicate `createPipe`/`updatePipe`/`disposePipe` methods.
4. Update `canvas/widget.ts`: replace global registry imports (§6.2 Change 1) and fix `onTick` rotation-aware framing (§6.2 Change 2).
5. Apply the same rotation-aware framing fix to `DiagramWidget.onTick` in `widget.ts`.
6. Verify canvas-level tests pass.

### Step 8 — Minor Fixes

1. Fix `computeBounds` in `compiler/groupCompiler.ts` to accept 3D sizes and account for depth in Z extent (§2.10).
2. Remove the dead `stubLen` variable from `canvas/compiler/pipeRouter.ts` (it was never in the extracted version, but verify it's absent).
3. Verify `EnvMapManager.disposeAll()` and `IconLoader.disposeAll()` are called from `DiagramRenderer.dispose()`.
4. Verify failed-load cache eviction in `IconLoader` (§2.9 fix: don't cache error results).

### Step 9 — Cleanup

1. Remove now-empty helper functions from `render.ts` and `compile.ts`.
2. Update `src/index.ts` barrel with any new public exports.
3. Run `pnpm typecheck` and `pnpm test` across the full workspace.

---

## 11. Invariants to Preserve

- `compile.ts` remains the **public import path** for `compileDiagram`, `routeEdges`, `resolveLayout`, `computeBounds` — they are re-exported from sub-modules, not removed.
- `render.ts` remains the **public import path** for `DiagramRenderer` — its internal composition is hidden.
- `canvas/compile.ts` remains the public path for `compileCanvas`, `compilePipe`, `functionalDiagramCanvasTransitionSpec`.
- `canvas/render.ts` remains the public path for `DiagramCanvasRenderer`.
- `src/index.ts` API surface is **additive only** — no existing exports removed.
- All Three.js is confined to `render.ts` (and `rendering/*.ts`) — no Three.js in `compiler/*.ts`.
- `compiler/*.ts` files have no React imports.
- `rendering/*.ts` files have no React imports.
- Tests do not use `vi.fn()` for module-level functions — use real instances with interface substitution.

---

## 12. Success Criteria

### Code Quality
- [ ] `pnpm --filter @brewsite/diagram typecheck` passes with zero errors
- [ ] `pnpm --filter @brewsite/diagram test` passes with all existing tests green
- [ ] New test files: minimum 60 new test cases across the new modules
- [ ] No `any` types added; all new code is strict TypeScript
- [ ] `render.ts` ≤ 120 lines (from 1,303)
- [ ] `compile.ts` ≤ 260 lines (from 1,109)
- [ ] `canvas/render.ts` ≤ 90 lines (from 179)
- [ ] `canvas/compile.ts` ≤ 230 lines (from 434)

### Bug Regression Tests (all were RED before, GREEN after)
- [ ] **§2.1** — `routeEdgeCurved` left→right connection returns 3-point arc, not 4-point S-curve
- [ ] **§2.2** — `nearestFace` returns `bottom` for `api→ecs` diagonal (39° from horizontal)
- [ ] **§2.3** — `sideAttachmentPoint` with combined X+Y rotation produces non-zero Y-component on local X-axis
- [ ] **§2.4** — `InteractionRegistry` correctly isolates meshes per instance; no module-level state
- [ ] **§2.7** — `rerouteLivePipes` produces same attachment points as compile-time `compilePipe` (side-attachment preserved)
- [ ] **§2.8** — Canvas `onTick` framing with Y-rotation produces different bounds than without rotation
- [ ] **§2.9** — Failed icon load does not persist in cache; second call retries the fetch
- [ ] **§2.9** — `EnvMapManager.disposeAll()` clears internal cache map
- [ ] **§2.10** — `computeBounds` with depth=1.0 nodes at z=0 returns `minZ=-0.5`, `maxZ=0.5`

### Module-Level Global State
- [ ] `diagramInteractionRegistry` and `diagramInteractionLookup` deleted from `render.ts`
- [ ] Neither `widget.ts` nor `canvas/widget.ts` imports from the deleted globals
- [ ] `envMapCache` and `iconCache` module-level `Map`s deleted from `render.ts`

### Visual Verification
- [ ] Scene 0 (arch overview): api→ecs and api→lambda edges produce smooth arcs, not S-curves
- [ ] Pipes between diagrams remain correctly side-attached during scroll transitions (no popping to center-to-center arc)
- [ ] Camera correctly frames the tilted canvas in scene 0 without clipping diagram edges
