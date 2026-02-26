---
title: "3D SVG Icon Rendering for Diagram Nodes"
doc_type: plan
owner: brewflow-architect
status: complete
updated: 2026-02-25
---

# Plan: 3D SVG Icon Rendering for Diagram Nodes

## Overview

Replace the current flat (unlit, zero-depth) SVG icon rendering on diagram nodes with physically extruded 3D geometry. Icons that currently appear as paper-flat decals on node faces will instead pop out as layered physical slabs, respond to scene lighting, and give depth cues that match the three-dimensional quality of the rest of the diagram.

The upgrade is **backward compatible** — the default value of `iconStyle` is `'flat'`, preserving all existing scenes exactly.

No new npm packages are required. Three.js `SVGLoader` (already imported in `render.ts`), `ExtrudeGeometry`, and `MeshStandardMaterial` handle everything natively.

---

## Background: What Exists Today

### SVG Assets

24 SVG files live under `packages/diagram/public/assets/shapes/`:

- `aws/` — 14 icons (ec2, s3, lambda, rds, alb, cloudfront, vpc, ecs, eks, sqs, sns, api-gateway, elasticache, dynamodb)
- `gcp/` — 5 icons (compute-engine, cloud-run, bigquery, cloud-storage, pubsub)
- `azure/` — 1 icon (app-service)
- `flow/` — 4 icons (cloud, actor, document, queue)

All AWS icons share a **consistent two-path structure** proven by inspection of `ec2.svg` and `lambda.svg`:
1. **Path 0** — solid colored background rectangle (`fill="#ED7100"` for Compute, `fill="#FF4F8B"` for Lambda, etc.)
2. **Path 1** — white foreground icon paths (`fill="#FFFFFF"`)

GCP icons follow a similar layered structure with 2–3 colored fill paths. This painter's-order layering maps directly to Z-depth in the 3D extruded modes.

### Current Render Pipeline

`render.ts` → `loadIconObject(url, width, height)`:
- Uses `SVGLoader.createShapes(path)` → `THREE.ShapeGeometry` (flat)
- Materials: `MeshBasicMaterial` (unlit — zero response to scene lighting)
- Cache key: `${url}|${width}|${height}`
- Icon holder placed at `Z = state.depth / 2 + 0.01` (front face of box)
- Skips paths with `fill: 'none'`

The icon holder reload trigger in `updateNode` checks only `state.iconUrl` change.

### `compile.ts` / `types.ts` / `dsl.tsx` Relationship

`DiagramNodeDSL` props are spread directly into `DiagramNodeDSL` typed objects in `handlers.ts`:
```ts
nodes.push({ ...(gEl.props as DiagramNodeDSL), groupId: ... });
```
No changes to `handlers.ts` are needed — any new optional field added to `DiagramNodeDSL` and `DiagramNodeProps` is automatically passed through.

---

## Architecture

### New Module

```
packages/diagram/src/elements/diagram/shapes/svgIcon3D.ts  ← NEW
```

**Responsibility**: Pure Three.js utility. Accepts `SVGResult` (from SVGLoader callback) + options → returns a `THREE.Group` with extruded geometry. No React. No compile-layer imports.

**Dependency direction** (no violations): `render.ts` → `svgIcon3D.ts` → `three` only ✓

### Files Modified

| File | Change |
|------|--------|
| `packages/diagram/src/elements/diagram/shapes/svgIcon3D.ts` | **NEW** — core 3D builder |
| `packages/diagram/src/elements/diagram/types.ts` | Add `SvgIcon3DStyle` type + 2 fields to `DiagramNodeDSL` + 2 fields to `DiagramNodeState` |
| `packages/diagram/src/elements/diagram/compile.ts` | Add 2 defaults to `NODE_DEFAULTS`, 2 fields to `compileNode()` return |
| `packages/diagram/src/elements/diagram/dsl.tsx` | Add 2 props to `DiagramNodeProps` + import |
| `packages/diagram/src/elements/diagram/render.ts` | Import `buildSvgIcon3D`, update `loadIconObject` signature, cache key, and call site |
| `packages/diagram/src/elements/diagram/shapes/__tests__/svgIcon3D.test.ts` | **NEW** — unit tests |

---

## Detailed Implementation

---

### Step 1 — New File: `packages/diagram/src/elements/diagram/shapes/svgIcon3D.ts`

Create this file in its entirety. It is a pure module — no side effects, no global state, fully unit-testable.

```typescript
// Pure Three.js utility: converts SVGLoader output into extruded 3D icon geometry.
// Three.js only — no React, no compiler imports.

import * as THREE from 'three';
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Visual rendering style for 3D SVG icons on diagram node faces.
 *
 * - 'flat':     ShapeGeometry + MeshBasicMaterial (current behaviour, unchanged)
 * - 'extruded': All filled paths extruded to a uniform depth with MeshStandardMaterial.
 *               Clean, symmetric. Best for single-colour icons.
 * - 'layered':  Paths separated by Z offset in painter's order — path[0] is the deep
 *               background slab, path[N] is closest to the viewer. AWS/GCP icons use
 *               this naturally (coloured background rect + white foreground symbol).
 *               Most visually impactful.
 * - 'embossed': Shallow extrusion with wide bevel — "coin" / "medallion" aesthetic.
 *               Every path shares the same Z base; the chamfered rim dominates.
 */
export type SvgIcon3DStyle = 'flat' | 'extruded' | 'layered' | 'embossed';

/** Options controlling 3D icon geometry generation. */
export interface SvgIcon3DOptions {
  /** Target icon width in diagram units (icon will be scaled to fit). */
  width: number;
  /** Target icon height in diagram units. */
  height: number;
  /**
   * Maximum Z depth of the frontmost extruded layer, in diagram units.
   * At the default camera (25° elevation), 0.10–0.20 reads clearly without
   * making icons feel chunky.
   */
  maxDepth: number;
  /** Visual style. Must not be 'flat' — caller should use the existing flat path. */
  style: Exclude<SvgIcon3DStyle, 'flat'>;
  /**
   * PBR metalness for all extruded MeshStandardMaterial layers.
   * Should match or derive from the parent node's metalness.
   * Default: 0.15.
   */
  metalness?: number;
  /**
   * PBR roughness for all extruded MeshStandardMaterial layers.
   * Default: 0.45 — polished enough to read bevels, not a mirror.
   */
  roughness?: number;
}

// ─── Internal ─────────────────────────────────────────────────────────────────

/** Shape of path.userData.style as populated by SVGLoader. */
type SvgPathStyle = {
  fill?: string;
  fillOpacity?: string;
  stroke?: string;
  strokeOpacity?: string;
  strokeWidth?: string;
  strokeLinecap?: string;
  strokeLinejoin?: string;
};

/** Per-path extrusion parameters resolved from style + path index. */
interface LayerConfig {
  /** Z position of the path's back face in local icon space (diagram units). */
  zBase: number;
  /** Extrusion depth for this path (diagram units). Frontmost face = zBase + depth. */
  depth: number;
  /** Absolute bevel thickness in diagram units. */
  bevelThickness: number;
  /** Absolute bevel horizontal size in diagram units. */
  bevelSize: number;
  /** Bevel segment count. 3 = chamfer; 5 = rounded edge. */
  bevelSegments: number;
}

/**
 * Resolves per-layer extrusion config for a path by index.
 *
 * Depth strategy summary:
 *   'extruded': all paths same depth, same zBase=0. Simple but effective.
 *   'layered':  path[0] = deep background slab starting at Z=0; subsequent paths
 *               start progressively further forward, creating a physical stack.
 *   'embossed': all paths shallow, all at same zBase; heavy bevel dominates.
 */
function resolveLayerConfig(
  pathIndex: number,
  totalPaths: number,
  style: Exclude<SvgIcon3DStyle, 'flat'>,
  maxDepth: number,
): LayerConfig {
  switch (style) {
    case 'extruded':
      return {
        zBase: 0,
        depth: maxDepth * 0.65,
        bevelThickness: maxDepth * 0.06,
        bevelSize: maxDepth * 0.04,
        bevelSegments: 3,
      };

    case 'layered': {
      // Path 0 is the deep background plate; subsequent paths are raised slabs.
      // Front face of path[i] = zBase[i] + depth[i].
      // Background front face ≈ 0.50 * maxDepth.
      // Foreground front face ≈ 0.72 * maxDepth (sitting clearly above background).
      const zBase = pathIndex === 0 ? 0 : pathIndex * maxDepth * 0.36;
      const depth = pathIndex === 0
        ? maxDepth * 0.50
        : maxDepth * Math.max(0.22, 0.38 - pathIndex * 0.05);
      return {
        zBase,
        depth,
        bevelThickness: maxDepth * 0.05,
        bevelSize: maxDepth * 0.035,
        bevelSegments: 3,
      };
    }

    case 'embossed':
      // All paths at same zBase with a small step per layer (avoids z-fighting).
      // The wide bevel is the dominant visual feature.
      return {
        zBase: pathIndex * maxDepth * 0.06,
        depth: maxDepth * 0.28,
        bevelThickness: maxDepth * 0.18,
        bevelSize: maxDepth * 0.12,
        bevelSegments: 5,
      };
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Builds a THREE.Group from SVGLoader result data using ExtrudeGeometry.
 *
 * Each filled SVG path becomes one or more extruded meshes. Paths with
 * fill:'none' are skipped for extrusion but their strokes (if present) are
 * rendered as flat overlaid geometry at the frontmost layer Z.
 *
 * The returned group is centred at local [0, 0, 0] and scaled to fit within
 * options.width × options.height. Y-flip is applied (SVG is Y-down, Three.js
 * is Y-up). The group is ready to be attached to a node's iconHolder at
 * position [0, yOffset, depth/2 + 0.01].
 *
 * Caller is responsible for updating material opacity when node opacity
 * changes — traverse the group children and mutate material.opacity in-place.
 */
export function buildSvgIcon3D(
  svgData: { paths: ReturnType<SVGLoader['parse']>['paths'] },
  options: SvgIcon3DOptions,
): THREE.Group {
  const {
    width,
    height,
    maxDepth,
    style,
    metalness = 0.15,
    roughness = 0.45,
  } = options;

  const group = new THREE.Group();
  const paths = svgData.paths ?? [];

  // Only filled paths become geometry. Compute total count first for layering math.
  const filledPaths = paths.filter((path) => {
    const s = (path.userData as { style?: SvgPathStyle } | undefined)?.style;
    return s?.fill !== 'none' && s?.fill !== undefined && s?.fill !== '';
  });

  const totalPaths = filledPaths.length;
  if (totalPaths === 0) return group;

  filledPaths.forEach((path, pathIndex) => {
    const s = (path.userData as { style?: SvgPathStyle } | undefined)?.style;
    const fillColor = s?.fill ?? '#ffffff';
    const color = new THREE.Color(fillColor);
    const layer = resolveLayerConfig(pathIndex, totalPaths, style, maxDepth);

    const shapes = SVGLoader.createShapes(path);
    if (shapes.length === 0) return;

    const material = new THREE.MeshStandardMaterial({
      color,
      metalness,
      roughness,
      transparent: true,
      opacity: 1,
      depthWrite: true,
      side: THREE.FrontSide,
    });

    shapes.forEach((shape) => {
      const extrudeSettings: THREE.ExtrudeGeometryOptions = {
        depth: layer.depth,
        bevelEnabled: layer.bevelThickness > 0,
        bevelThickness: layer.bevelThickness,
        bevelSize: layer.bevelSize,
        bevelSegments: layer.bevelSegments,
        bevelOffset: 0,
      };

      const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
      const mesh = new THREE.Mesh(geometry, material);
      // zBase positions the back face; ExtrudeGeometry extrudes in +Z.
      mesh.position.z = layer.zBase;
      group.add(mesh);
    });

    // ── Stroke overlay ────────────────────────────────────────────────────────
    // For paths that carry both fill and stroke (uncommon in cloud icons but
    // present in some flow icons), render the stroke as a flat overlay on top
    // of the extrusion at the front face + epsilon.
    const strokeColor = s?.stroke;
    if (strokeColor && strokeColor !== 'none') {
      const strokeWidth = parseFloat(s?.strokeWidth ?? '1');
      if (strokeWidth > 0) {
        const strokeStyle = SVGLoader.getStrokeStyle(strokeWidth, strokeColor);
        const frontZ = layer.zBase + layer.depth + 0.002;
        path.subPaths.forEach((subPath) => {
          const pts2D = subPath.getPoints();
          if (pts2D.length < 2) return;
          const pts3D = pts2D.map((p) => new THREE.Vector3(p.x, p.y, 0));
          const strokeGeo = SVGLoader.pointsToStroke(pts3D, strokeStyle);
          if (!strokeGeo) return;
          const strokeMat = new THREE.MeshStandardMaterial({
            color: new THREE.Color(strokeColor),
            metalness: metalness * 0.5,
            roughness: roughness * 0.8,
            transparent: true,
            opacity: 1,
            depthWrite: false,
            side: THREE.DoubleSide,
          });
          const strokeMesh = new THREE.Mesh(strokeGeo, strokeMat);
          strokeMesh.position.z = frontZ;
          group.add(strokeMesh);
        });
      }
    }
  });

  // ── Fit to target size ────────────────────────────────────────────────────
  // SVG coordinate system is Y-down; Three.js is Y-up. Apply Y-flip.
  // Then scale to fit within width × height (preserving the Y-flip).
  group.scale.set(1, -1, 1);
  const box = new THREE.Box3().setFromObject(group);
  const size = new THREE.Vector3();
  box.getSize(size);
  if (size.x < 0.001 || size.y < 0.001) return group; // degenerate SVG guard
  const fitScale = Math.min(width / size.x, height / size.y);
  group.scale.set(fitScale, -fitScale, 1); // reapply scale with preserved Y-flip

  // Centre the group so local [0, 0] maps to the icon's visual centre.
  // Z is NOT centred — icon extrudes forward from Z=0 (the node front face).
  const box2 = new THREE.Box3().setFromObject(group);
  const center = new THREE.Vector3();
  box2.getCenter(center);
  group.position.set(-center.x, -center.y, 0);

  return group;
}
```

---

### Step 2 — `packages/diagram/src/elements/diagram/types.ts`

#### 2a. Add `SvgIcon3DStyle` type export

Insert immediately **after** the existing `DiagramOrientation` type (line 17) and **before** `DiagramPivot`:

```typescript
/**
 * Visual rendering style for 3D SVG icons on diagram node faces.
 * 'flat' preserves current behaviour (ShapeGeometry, unlit).
 * All other values produce extruded geometry using MeshStandardMaterial.
 */
export type SvgIcon3DStyle = 'flat' | 'extruded' | 'layered' | 'embossed';
```

#### 2b. Extend `DiagramNodeState` interface

After the existing `readonly iconScale: number;` field (line 180), add:

```typescript
  /**
   * 3D rendering style for the icon placed on this node's front face.
   * 'flat' uses the current ShapeGeometry + MeshBasicMaterial path.
   * 'extruded' / 'layered' / 'embossed' use ExtrudeGeometry + MeshStandardMaterial.
   * Default: 'flat'.
   */
  readonly iconStyle: SvgIcon3DStyle;

  /**
   * Maximum Z extrusion depth for 3D icon geometry, in diagram units.
   * Applies only when iconStyle !== 'flat'.
   * Default: 0.15.
   */
  readonly iconDepth: number;
```

#### 2c. Extend `DiagramNodeDSL` interface

After the existing `readonly iconScale?: number;` field (line 394), add:

```typescript
  /** 3D icon rendering style. Default: 'flat' (no change from current behaviour). */
  readonly iconStyle?: SvgIcon3DStyle;
  /** Max extrusion depth for 3D icon in diagram units. Default: 0.15. */
  readonly iconDepth?: number;
```

---

### Step 3 — `packages/diagram/src/elements/diagram/compile.ts`

#### 3a. Extend `NODE_DEFAULTS`

The existing import block already pulls from `'./types'` so no import changes are needed — `SvgIcon3DStyle` is automatically available since `types.ts` is already imported via:
```typescript
import type { ..., } from './types';
```

Add `SvgIcon3DStyle` to the existing import from `'./types'`. The current import is at line 4–19. Add `SvgIcon3DStyle` to that import.

In `NODE_DEFAULTS` (lines 52–70), add after `iconScale: 0.6,`:

```typescript
  iconStyle: 'flat' as SvgIcon3DStyle,
  iconDepth: 0.15,
```

#### 3b. Extend `compileNode()` return object

In the `compileNode()` return (lines 432–457), add after `iconScale: dsl.iconScale ?? NODE_DEFAULTS.iconScale,`:

```typescript
    iconStyle: dsl.iconStyle ?? NODE_DEFAULTS.iconStyle,
    iconDepth: dsl.iconDepth ?? NODE_DEFAULTS.iconDepth,
```

---

### Step 4 — `packages/diagram/src/elements/diagram/dsl.tsx`

#### 4a. Import `SvgIcon3DStyle`

The existing import at line 9 is:
```typescript
import type {
  DiagramEdgeStyle,
  DiagramArrowVariant,
  DiagramGroupVariant,
  DiagramOrientation,
  DiagramPivot,
  DiagramEasing,
} from './types';
```

Change to:
```typescript
import type {
  DiagramEdgeStyle,
  DiagramArrowVariant,
  DiagramGroupVariant,
  DiagramOrientation,
  DiagramPivot,
  DiagramEasing,
  SvgIcon3DStyle,
} from './types';
```

#### 4b. Extend `DiagramNodeProps`

After the existing `iconScale?: number;` prop (line 64), add:

```typescript
  /**
   * 3D rendering style for the icon on this node's front face.
   * Default: 'flat' — unchanged from current behaviour.
   * 'layered' is the most visually impactful for AWS/GCP cloud icons.
   */
  iconStyle?: SvgIcon3DStyle;
  /**
   * Max Z extrusion depth for 3D icon geometry in diagram units.
   * Default: 0.15. Sensible range: 0.05–0.25.
   */
  iconDepth?: number;
```

No change to the `DiagramNode` function body — it returns `null` and its props are read by the compiler via `el.props`.

---

### Step 5 — `packages/diagram/src/elements/diagram/render.ts`

This is the largest change. It touches: imports, `loadIconObject`, the icon reload trigger in `updateNode`, and the `loadIconObject` call site.

#### 5a. Imports

Add to the import block at the top of the file. After the existing Three.js and SVGLoader imports, add:

```typescript
import { buildSvgIcon3D } from './shapes/svgIcon3D';
import type { SvgIcon3DStyle } from './types';
```

#### 5b. Update `loadIconObject` signature and body

Replace the entire `loadIconObject` function (lines 101–164) with:

```typescript
const loadIconObject = (
  url: string,
  width: number,
  height: number,
  style: SvgIcon3DStyle,
  maxDepth: number,
  metalness: number,
  roughness: number,
): Promise<THREE.Object3D> => {
  const cacheKey = `${url}|${width}|${height}|${style}|${maxDepth}`;
  if (iconCache.has(cacheKey)) return iconCache.get(cacheKey)!;

  const promise = new Promise<THREE.Object3D>((resolve) => {
    if (url.toLowerCase().endsWith('.svg')) {
      if (style !== 'flat') {
        // ── 3D extruded path ───────────────────────────────────────────────
        svgLoader.load(
          url,
          (data) => {
            resolve(buildSvgIcon3D(data, { width, height, maxDepth, style, metalness, roughness }));
          },
          undefined,
          (err) => {
            console.warn(`[DiagramRenderer] Failed to load 3D SVG icon: ${url}`, err);
            resolve(new THREE.Group());
          },
        );
      } else {
        // ── Existing flat path (unchanged) ─────────────────────────────────
        svgLoader.load(
          url,
          (data) => {
            const group = new THREE.Group();
            const paths = data.paths ?? [];
            paths.forEach((path) => {
              const s = (path.userData as { style?: { fill?: string } } | undefined)?.style;
              const fillColor = s?.fill;
              if (fillColor === 'none') return;
              const color =
                fillColor && fillColor !== ''
                  ? new THREE.Color(fillColor)
                  : new THREE.Color(0xffffff);
              const material = new THREE.MeshBasicMaterial({
                color,
                transparent: true,
                depthWrite: false,
                side: THREE.DoubleSide,
              });
              const shapes = SVGLoader.createShapes(path);
              shapes.forEach((shape) => {
                const geometry = new THREE.ShapeGeometry(shape);
                const mesh = new THREE.Mesh(geometry, material);
                group.add(mesh);
              });
            });
            group.scale.set(1, -1, 1);
            const box = new THREE.Box3().setFromObject(group);
            const size = new THREE.Vector3();
            box.getSize(size);
            const scale = Math.min(
              width / Math.max(0.001, size.x),
              height / Math.max(0.001, size.y),
            );
            group.scale.set(scale, -scale, 1);
            box.setFromObject(group);
            const center = new THREE.Vector3();
            box.getCenter(center);
            group.position.set(-center.x, -center.y, 0);
            resolve(group);
          },
          undefined,
          (err) => {
            console.warn(`[DiagramRenderer] Failed to load SVG icon: ${url}`, err);
            resolve(new THREE.Group());
          },
        );
      }
    } else {
      // ── Texture (raster) path (unchanged) ─────────────────────────────────
      textureLoader.load(
        url,
        (texture) => {
          const geometry = new THREE.PlaneGeometry(width, height);
          const material = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            depthWrite: false,
          });
          const mesh = new THREE.Mesh(geometry, material);
          resolve(mesh);
        },
        undefined,
        (err) => {
          console.warn(`[DiagramRenderer] Failed to load texture icon: ${url}`, err);
          resolve(new THREE.Mesh());
        },
      );
    }
  });

  iconCache.set(cacheKey, promise);
  return promise;
};
```

**Note**: The flat SVG branch now also has an error handler (previously missing). Add this as a quality improvement while touching this code.

#### 5c. Update icon holder creation in `updateNode`

The current reload trigger (lines 501–523) checks only `iconUrl`. It must also check `iconStyle` and `iconDepth` to rebuild when those change, and must pass the new arguments to `loadIconObject`.

Replace lines 501–523 with:

```typescript
    if (state.iconUrl) {
      const needsIconRebuild =
        !entry.iconHolder ||
        entry.iconHolder.userData['iconUrl'] !== state.iconUrl ||
        entry.iconHolder.userData['iconStyle'] !== state.iconStyle ||
        entry.iconHolder.userData['iconDepth'] !== state.iconDepth;

      if (needsIconRebuild) {
        if (entry.iconHolder) {
          entry.group.remove(entry.iconHolder);
        }
        const holder = new THREE.Group();
        holder.userData['iconUrl'] = state.iconUrl;
        holder.userData['iconStyle'] = state.iconStyle;
        holder.userData['iconDepth'] = state.iconDepth;
        entry.iconHolder = holder;
        entry.group.add(holder);
        const iconWidth = state.size[0] * state.iconScale;
        const iconHeight = state.size[1] * state.iconScale;
        loadIconObject(
          state.iconUrl,
          iconWidth,
          iconHeight,
          state.iconStyle,
          state.iconDepth,
          state.metalness,
          state.roughness,
        ).then((obj) => {
          holder.clear();
          holder.add(obj);
        });
      }
      if (entry.iconHolder) {
        entry.iconHolder.position.set(0, state.size[1] * 0.2, state.depth / 2 + 0.01);
      }
    } else if (entry.iconHolder) {
      entry.group.remove(entry.iconHolder);
      entry.iconHolder = undefined;
    }
```

#### 5d. Icon opacity propagation (new concern for 3D styles)

Currently, opacity is propagated to the box materials only. For 3D icon styles, the icon group children also need opacity applied when the node fades.

In `updateNode`, after the opacity handling block (lines ~455–461), add:

```typescript
    // Propagate opacity to 3D icon materials if the icon uses MeshStandardMaterial.
    // Flat icons use MeshBasicMaterial; their opacity is already handled by depthWrite:false
    // and the parent group visibility. 3D icons need explicit opacity propagation.
    if (
      entry.iconHolder &&
      state.iconStyle !== 'flat' &&
      prev &&
      prev.opacity !== state.opacity
    ) {
      entry.iconHolder.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          const mat = child.material;
          if (Array.isArray(mat)) {
            (mat as THREE.MeshStandardMaterial[]).forEach((m) => {
              m.opacity = state.opacity;
              m.transparent = true;
            });
          } else if (mat instanceof THREE.MeshStandardMaterial) {
            (mat as THREE.MeshStandardMaterial).opacity = state.opacity;
            (mat as THREE.MeshStandardMaterial).transparent = true;
          }
        }
      });
    }
```

Place this block immediately after the existing material opacity block (after line ~462 where `mats.forEach((m) => { m.opacity = op; m.transparent = true; });`).

---

### Step 6 — New Test File: `packages/diagram/src/elements/diagram/shapes/__tests__/svgIcon3D.test.ts`

The tests exercise `resolveLayerConfig` (which is not exported — export it from `svgIcon3D.ts` for testing) and `buildSvgIcon3D` with synthetic SVGLoader data.

To enable testing, add this export to `svgIcon3D.ts` (it is a pure function with no side effects — safe to export):

```typescript
// Exported for unit testing only. Do not import this from outside the shapes/ directory.
export { resolveLayerConfig };
```

**Test file contents**:

```typescript
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { buildSvgIcon3D, resolveLayerConfig } from '../svgIcon3D';
import type { SvgIcon3DStyle } from '../../types';

// ─── resolveLayerConfig ────────────────────────────────────────────────────────

describe('resolveLayerConfig', () => {
  it('extruded: all paths get the same zBase=0', () => {
    const c0 = resolveLayerConfig(0, 3, 'extruded', 0.15);
    const c1 = resolveLayerConfig(1, 3, 'extruded', 0.15);
    const c2 = resolveLayerConfig(2, 3, 'extruded', 0.15);
    expect(c0.zBase).toBe(0);
    expect(c1.zBase).toBe(0);
    expect(c2.zBase).toBe(0);
    expect(c0.depth).toBeCloseTo(c1.depth, 10);
    expect(c0.depth).toBeGreaterThan(0);
  });

  it('layered: path[0] has zBase=0; subsequent paths have higher zBase', () => {
    const c0 = resolveLayerConfig(0, 3, 'layered', 0.15);
    const c1 = resolveLayerConfig(1, 3, 'layered', 0.15);
    const c2 = resolveLayerConfig(2, 3, 'layered', 0.15);
    expect(c0.zBase).toBe(0);
    expect(c1.zBase).toBeGreaterThan(c0.zBase);
    expect(c2.zBase).toBeGreaterThan(c1.zBase);
  });

  it('layered: frontmost face of path[1] is forward of path[0]', () => {
    const c0 = resolveLayerConfig(0, 2, 'layered', 0.15);
    const c1 = resolveLayerConfig(1, 2, 'layered', 0.15);
    const front0 = c0.zBase + c0.depth;
    const front1 = c1.zBase + c1.depth;
    expect(front1).toBeGreaterThan(front0);
  });

  it('embossed: bevelThickness is larger than extruded bevelThickness', () => {
    const embossed = resolveLayerConfig(0, 2, 'embossed', 0.15);
    const extruded = resolveLayerConfig(0, 2, 'extruded', 0.15);
    expect(embossed.bevelThickness).toBeGreaterThan(extruded.bevelThickness);
  });

  it('embossed: bevelSegments is 5 (smooth rim)', () => {
    const c = resolveLayerConfig(0, 1, 'embossed', 0.15);
    expect(c.bevelSegments).toBe(5);
  });

  it('all styles: depth scales proportionally with maxDepth', () => {
    const styles: Exclude<SvgIcon3DStyle, 'flat'>[] = ['extruded', 'layered', 'embossed'];
    styles.forEach((s) => {
      const small = resolveLayerConfig(0, 1, s, 0.10);
      const large = resolveLayerConfig(0, 1, s, 0.20);
      expect(large.depth).toBeCloseTo(small.depth * 2, 10);
    });
  });
});

// ─── buildSvgIcon3D ────────────────────────────────────────────────────────────

/** Builds a minimal synthetic SVGLoader 'paths' array with N filled paths. */
function makeFakePaths(fillColors: string[]): Parameters<typeof buildSvgIcon3D>[0]['paths'] {
  return fillColors.map((fill) => {
    // A simple square shape from (0,0) to (10,10) for each path.
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(10, 0);
    shape.lineTo(10, 10);
    shape.lineTo(0, 10);
    shape.closePath();

    return {
      // SVGLoader ShapePath duck-type: only what buildSvgIcon3D accesses.
      userData: { style: { fill, stroke: 'none', strokeWidth: '0' } },
      subPaths: [],
      // SVGLoader.createShapes expects a ShapePath; we provide a compatible stub.
      // For tests, we override createShapes globally (see below).
      color: new THREE.Color(fill),
    } as unknown as ReturnType<typeof import('three/examples/jsm/loaders/SVGLoader.js')['SVGLoader']['prototype']['parse']>['paths'][number];
  });
}

describe('buildSvgIcon3D', () => {
  // SVGLoader.createShapes is a static method that processes ShapePath objects.
  // In unit tests (Node/jsdom environment, no real SVG parser), we create
  // THREE.Shape objects directly and inject them via a compatible stub.
  // The approach: build real SVG paths using THREE.Shape, which SVGLoader.createShapes
  // can process when passed objects that satisfy the ShapePath contract.

  it('returns a THREE.Group', () => {
    const paths = makeFakePaths(['#ff0000', '#ffffff']);
    // buildSvgIcon3D calls SVGLoader.createShapes(path) internally.
    // With fake paths that don't have real subPaths, createShapes returns [].
    // The group will be empty — but the function must not throw.
    const group = buildSvgIcon3D({ paths }, {
      width: 1,
      height: 1,
      maxDepth: 0.15,
      style: 'extruded',
    });
    expect(group).toBeInstanceOf(THREE.Group);
  });

  it('returns empty group for zero paths without throwing', () => {
    const group = buildSvgIcon3D({ paths: [] }, {
      width: 1,
      height: 1,
      maxDepth: 0.15,
      style: 'layered',
    });
    expect(group).toBeInstanceOf(THREE.Group);
    expect(group.children.length).toBe(0);
  });

  it('uses ExtrudeGeometry (not ShapeGeometry) for non-flat styles', () => {
    // Build a proper THREE.Shape and use it via a THREE.ShapePath-compatible object.
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(10, 0);
    shape.lineTo(10, 10);
    shape.lineTo(0, 10);
    shape.closePath();

    // Provide a minimal path object that SVGLoader.createShapes will return shapes for.
    // SVGLoader.createShapes inspects ShapePath.subPaths, but we can satisfy it by
    // providing a shapes array directly via monkey-patching SVGLoader.createShapes
    // in this test scope.
    const { SVGLoader } = require('three/examples/jsm/loaders/SVGLoader.js');
    const origCreateShapes = SVGLoader.createShapes;
    SVGLoader.createShapes = () => [shape];

    const paths = makeFakePaths(['#ff4400']);
    const group = buildSvgIcon3D({ paths }, {
      width: 1,
      height: 1,
      maxDepth: 0.15,
      style: 'extruded',
    });

    SVGLoader.createShapes = origCreateShapes;

    expect(group.children.length).toBeGreaterThan(0);
    const mesh = group.children[0] as THREE.Mesh;
    expect(mesh.geometry).toBeInstanceOf(THREE.ExtrudeGeometry);
  });

  it('layered: path[1] mesh has higher position.z than path[0] mesh', () => {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(10, 0);
    shape.lineTo(10, 10);
    shape.lineTo(0, 10);
    shape.closePath();

    const { SVGLoader } = require('three/examples/jsm/loaders/SVGLoader.js');
    const origCreateShapes = SVGLoader.createShapes;
    SVGLoader.createShapes = () => [shape];

    const paths = makeFakePaths(['#ff4400', '#ffffff']);
    const group = buildSvgIcon3D({ paths }, {
      width: 1,
      height: 1,
      maxDepth: 0.15,
      style: 'layered',
    });

    SVGLoader.createShapes = origCreateShapes;

    expect(group.children.length).toBe(2);
    const z0 = (group.children[0] as THREE.Mesh).position.z;
    const z1 = (group.children[1] as THREE.Mesh).position.z;
    expect(z1).toBeGreaterThan(z0);
  });

  it('group is centred: position.x and position.y are non-NaN', () => {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(10, 0);
    shape.lineTo(10, 10);
    shape.lineTo(0, 10);
    shape.closePath();

    const { SVGLoader } = require('three/examples/jsm/loaders/SVGLoader.js');
    const origCreateShapes = SVGLoader.createShapes;
    SVGLoader.createShapes = () => [shape];

    const paths = makeFakePaths(['#ff4400']);
    const group = buildSvgIcon3D({ paths }, {
      width: 2,
      height: 2,
      maxDepth: 0.15,
      style: 'extruded',
    });

    SVGLoader.createShapes = origCreateShapes;

    expect(Number.isNaN(group.position.x)).toBe(false);
    expect(Number.isNaN(group.position.y)).toBe(false);
  });
});
```

---

## Error Handling

| Location | Condition | Handling |
|----------|-----------|----------|
| `loadIconObject` SVG load failure | Network error, malformed SVG, CORS | `console.warn` + resolve with empty `THREE.Group` (icon silently absent, node still renders correctly) |
| `loadIconObject` texture load failure | Same | `console.warn` + resolve with empty `THREE.Mesh` |
| `buildSvgIcon3D` — zero filled paths | SVG with only strokes | Returns empty `THREE.Group` immediately (no throw) |
| `buildSvgIcon3D` — degenerate bounding box (size < 0.001) | Invisible / zero-area shapes | Guard: returns group unscaled rather than dividing by near-zero |
| `resolveLayerConfig` — single path with `layered` style | `totalPaths === 1` | `layered` falls into the `pathIndex === 0` branch → background plate only. Looks like `extruded`. No special case needed. |

---

## Testing Strategy

Tests use **Vitest** in the Node environment. Three.js geometry constructors (`ExtrudeGeometry`, `BoxGeometry`, `Group`, `Mesh`) work fully in Node without a WebGL context. `SVGLoader.createShapes` is a static pure function that works in Node.

The `SVGLoader.createShapes` monkey-patching in test cases is intentional: the test cannot provide real SVG data (no DOM SVG parser in Node), so it injects pre-built `THREE.Shape` objects. This tests the geometry construction logic (`resolveLayerConfig` → `ExtrudeGeometry` mapping) without needing a full SVG parse stack.

Tests are co-located in `shapes/__tests__/svgIcon3D.test.ts`, matching the pattern of the existing `shapes/__tests__/geometryFactory.test.ts`.

Run tests:
```bash
pnpm --filter @brewsite/diagram vitest run src/elements/diagram/shapes/__tests__/svgIcon3D.test.ts
```

---

## Implementation Order

Execute in this exact order to avoid broken intermediate states:

1. **Create** `svgIcon3D.ts` — new file, no dependencies yet; can typecheck in isolation
2. **Modify** `types.ts` — add `SvgIcon3DStyle` export + fields to both interfaces
3. **Modify** `compile.ts` — add import for `SvgIcon3DStyle`, extend `NODE_DEFAULTS`, extend `compileNode()`
4. **Modify** `dsl.tsx` — add import for `SvgIcon3DStyle`, add 2 props to `DiagramNodeProps`
5. **Modify** `render.ts` — add imports, replace `loadIconObject`, update `updateNode`
6. **Create** `svgIcon3D.test.ts` — run tests to verify
7. **Run typecheck**: `pnpm --filter @brewsite/diagram typecheck`
8. **Run all diagram tests**: `pnpm --filter @brewsite/diagram test`

---

## Usage After Implementation

```tsx
// Unchanged — default 'flat' preserves all existing scenes
<DiagramNode id="ec2" shape="aws:ec2" label="Web Server" />

// Layered — best for AWS/GCP two-layer icons
<DiagramNode id="lambda" shape="aws:lambda" label="API Handler"
  iconStyle="layered" iconDepth={0.15} />

// Extruded — uniform depth, works well for GCP multi-colour icons
<DiagramNode id="bq" shape="gcp:bigquery" label="Analytics"
  iconStyle="extruded" iconDepth={0.12} />

// Embossed — medallion look, good as "hero" nodes in a scene
<DiagramNode id="s3" shape="aws:s3" label="Object Storage"
  iconStyle="embossed" iconDepth={0.20}
  metalness={0.25} roughness={0.35} />
```

---

## Out of Scope

- Changing the icon assets themselves (SVG files remain unchanged)
- Animating `iconStyle` or `iconDepth` between scenes (they are geometry-rebuild properties; interpolation would require pre-building both geometries and cross-fading, which is a future enhancement)
- Adding `iconStyle` / `iconDepth` to the `mergeSnapshot` interpolation logic — these are treated as instant-rebuild properties like `shape` (not as animatable floats like `opacity`)
- Adding `iconStyle` / `iconDepth` to `blendNumber` / `blendVec3` transitions

---

## Change History

| Date | Author | Change |
|------|--------|--------|
| 2026-02-25 | brewflow-architect | Initial plan |
