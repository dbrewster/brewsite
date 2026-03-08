---
title: Coordinate System Audit — Implementation Plan
doc_type: plan
owner: architect
status: complete
updated: 2026-03-08
---

# Coordinate System Audit — Implementation Plan

Implements all 13 gap items identified in `requirements/core/notes/note_coordinate-system-audit.md`.
No architectural changes — this plan is documentation, defaults, algorithm fixes, and test additions only.

---

## Prerequisites

Read `requirements/core/notes/note_coordinate-system-audit.md` before starting any stream.
No package.json changes. No new files. No new exports. No API surface changes.

---

## Parallel Work Streams

The 13 items are grouped into 5 streams that share no files, enabling up to 5 developers to work simultaneously.

| Stream | Items | Files Owned |
|--------|-------|-------------|
| A | Gaps 1, 2, 8 | `floor/types.ts`, `floor/dsl.tsx`, `lighting/types.ts`, `lighting/render.ts` |
| B | Gaps 3, 4, 9, 11 | `lighting/compile.ts`, `camera/compile.ts`, `camera/types.ts`† |
| C | Gaps 5, 6 | `camera/render.ts`, `camera/render.test.ts`, `camera/types.ts`† |
| D | Gaps 7, 10 | `floor/render.ts`, `camera/CameraControlsDriver.ts` |
| E | Gaps 12, 13 | `diagram/__tests__/nvsBounds.test.ts`, `diagram/canvas/compile.ts` |

† `camera/types.ts` is a shared file between Stream B and Stream C — see [File Conflict Resolution](#file-conflict-resolution). All changes to `camera/types.ts` from both streams must be committed by one designated developer.

**Dependency order**: Streams A–D can run fully in parallel. Stream E depends on no other stream but must be self-contained (it adds tests that exercise existing compile behaviour and new compile guards).

---

## Stream A — Documentation: Floor types, Lighting types, Shadow constants

**Files**: `packages/core/src/elements/floor/types.ts`, `packages/core/src/elements/floor/dsl.tsx`, `packages/core/src/elements/lighting/types.ts`, `packages/core/src/elements/lighting/render.ts`

No logic changes. JSDoc annotations only.

---

### A-1 · Gap 1 — Floor `position` JSDoc in `types.ts`

**File**: `packages/core/src/elements/floor/types.ts`
**Line**: 7

**Current**:
```typescript
  position?: [number, number, number];
```

**Replace with**:
```typescript
  /**
   * World-space position [x, y, z]. Typically [0, 0, 0].
   * Not NVS — these are raw Three.js world-space units, not [0..1] viewport fractions.
   * To co-locate the floor with a model placed at `nvsX`/`nvsY`, call
   * `nvsToWorldAnalytic()` from `@brewsite/core` to resolve the model's world position first.
   */
  position?: [number, number, number];
```

---

### A-2 · Gap 1 — Floor `position` JSDoc in `dsl.tsx`

**File**: `packages/core/src/elements/floor/dsl.tsx`
**Line**: 9

**Current**:
```typescript
  position?: [number, number, number];
```

**Replace with**:
```typescript
  /**
   * World-space position [x, y, z]. Typically [0, 0, 0] — the floor sits at the scene origin.
   * Not NVS — values are raw Three.js world-space units.
   * To co-locate with a model at `nvsX`/`nvsY`, use `nvsToWorldAnalytic()` from
   * `@brewsite/core` to resolve the model's world position before setting this field.
   */
  position?: [number, number, number];
```

---

### A-3 · Gap 2 — Lighting `position` JSDoc in `types.ts`

**File**: `packages/core/src/elements/lighting/types.ts`

Apply the following 8 individual edits, each targeting a specific field. All are documentation-only.

#### A-3a · `SceneLightDirectional.position` (line 18)

**Current**:
```typescript
  position: Vec3;
```
*(inside `SceneLightDirectional`, after `color: string;` on line 17)*

**Replace with**:
```typescript
  /**
   * World-space position. For directional lights, only the direction from origin to this
   * position matters — Three.js normalises it internally, so the magnitude does not affect
   * intensity or shadow frustum. The default `[10, 10, 10]` places the key light above-right-front.
   */
  position: Vec3;
```

#### A-3b · `SceneLightPoint.position` (line 25)

**Current**:
```typescript
  position: Vec3;
```
*(inside `SceneLightPoint`, after `color: string;` on line 24)*

**Replace with**:
```typescript
  /** World-space position of the point light source. */
  position: Vec3;
```

#### A-3c · `SceneLightGlowPoint.position` (line 32)

**Current**:
```typescript
  position: Vec3;
```
*(inside `SceneLightGlowPoint`, after `color: string;` on line 31)*

**Replace with**:
```typescript
  /** World-space position of the glow-point light source. */
  position: Vec3;
```

#### A-3d · `SceneLightStrandCircle.offset` (line 61)

**Current**:
```typescript
  offset?: Vec3;
```
*(inside `SceneLightStrandCircle`, after `axis?: LightStrandAxis;` on line 60)*

**Replace with**:
```typescript
  /** World-space position offset applied to the circle strand's geometric centre. */
  offset?: Vec3;
```

#### A-3e · `SceneLightStrandRectangle.offset` (line 69)

**Current**:
```typescript
  offset?: Vec3;
```
*(inside `SceneLightStrandRectangle`, after `axis?: LightStrandAxis;` on line 68)*

**Replace with**:
```typescript
  /** World-space position offset applied to the rectangle strand's geometric centre. */
  offset?: Vec3;
```

#### A-3f · `SceneLightStrand.position` (line 82)

**Current**:
```typescript
  position?: Vec3;
```
*(inside `SceneLightStrand`, after `color: string;` on line 81)*

**Replace with**:
```typescript
  /** World-space position offset applied to the strand shape's origin. */
  position?: Vec3;
```

#### A-3g · `SceneLightSpot.position` and `.target` (lines 92–93)

**Current**:
```typescript
  position: Vec3;
  target: Vec3;
```
*(inside `SceneLightSpot`, after `color: string;` on line 91)*

**Replace with**:
```typescript
  /** World-space position of the spotlight source. */
  position: Vec3;
  /** World-space point the spotlight aims at. */
  target: Vec3;
```

#### A-3h · `SceneLightPanel.origin` and `.spacing` (lines 102, 105)

**Current**:
```typescript
  origin: Vec3;
  rows: number;
  cols: number;
  spacing: Vec3;
```
*(inside `SceneLightPanel`, lines 102–105)*

**Replace with**:
```typescript
  /** World-space position of the top-left panel light (grid origin). */
  origin: Vec3;
  rows: number;
  cols: number;
  /** World-space step vector between adjacent panel lights in the grid. */
  spacing: Vec3;
```

---

### A-4 · Gap 8 — Shadow camera constants JSDoc in `render.ts`

**File**: `packages/core/src/elements/lighting/render.ts`
**Lines**: 25–27

**Current**:
```typescript
const DIRECTIONAL_SHADOW_RANGE = 260;
const DIRECTIONAL_SHADOW_NEAR = 0.5;
const DIRECTIONAL_SHADOW_FAR = 600;
```

**Replace with**:
```typescript
/**
 * Half-extent (world units) of the directional light's orthographic shadow-camera frustum.
 * Produces a 520×520 world-unit shadow volume at 256px → ~0.5 px/unit texel density.
 * This was calibrated for large-world scenes (geometry up to ~200 units from origin).
 * For 1-unit scenes, reducing this to 5–10 will recover ~50× shadow resolution.
 */
const DIRECTIONAL_SHADOW_RANGE = 260;
/** Shadow camera near plane. Set low to avoid clipping the light-source geometry itself. */
const DIRECTIONAL_SHADOW_NEAR = 0.5;
/**
 * Shadow camera far plane. Must exceed DIRECTIONAL_SHADOW_RANGE * √3 (≈ 450 for range=260)
 * to avoid clipping shadows from geometry on the frustum diagonal.
 */
const DIRECTIONAL_SHADOW_FAR = 600;
```

---

## Stream B — Camera and lighting compile defaults + type JSDoc

**Files**: `packages/core/src/elements/lighting/compile.ts`, `packages/core/src/elements/camera/compile.ts`, `packages/core/src/elements/camera/types.ts`

---

### B-1 · Gap 3 — Default directional light position comment in `lighting/compile.ts`

**File**: `packages/core/src/elements/lighting/compile.ts`
**Line**: 292

**Current** (line 292 is inside `DEFAULT_LIGHTING`, which spans lines 290–299):
```typescript
  directionals: [{ id: 'directional-0', intensity: 1, color: '#ffffff', position: [10, 10, 10] }],
```

**Replace with** (add a comment on the line immediately above):
```typescript
  // position [10, 10, 10]: world-scale of ~10 units. For directional lights, only the
  // direction from origin matters (Three.js normalises the position vector). This places
  // the key light above-right-front, matching the standard three-point lighting convention.
  directionals: [{ id: 'directional-0', intensity: 1, color: '#ffffff', position: [10, 10, 10] }],
```

---

### B-2 · Gap 4 — Camera `near`/`far` defaults in `camera/compile.ts`

**File**: `packages/core/src/elements/camera/compile.ts`
**Line**: 33

**Current**:
```typescript
  lens: { fov: 45, near: 0.1, far: 2000 },
```

**Replace with**:
```typescript
  // near: 0.01 — eliminates near-clip pop during close-focus transitions in 1-unit worlds.
  // far: 100  — recovers ~20× depth-buffer precision vs. the previous far=2000 default.
  //             Objects at z=0 in a 3.5-unit camera distance occupy >3% of the depth range
  //             (vs. <0.005% with far=2000). No visual impact for content within 100 units.
  lens: { fov: 45, near: 0.01, far: 100 },
```

> **Rationale**: `near/far` ratio was `0.1/2000 = 0.00005`. New ratio `0.01/100 = 0.0001` — 20× improvement. The DiagramCanvas camera inherits this value and benefits automatically (audit note lines 163–165).
>
> **Safety**: This is a default change. Any scene that explicitly sets `<Camera far={N} />` in DSL is unaffected — the compiled value overrides the default. Scenes that do not set `far` explicitly now use 100. A visual verification step is included in the checklist (item 7) to confirm no clipping occurs in example scenes before merging.

---

### B-3 · Gap 9 — `minDistance`/`maxDistance` JSDoc in `camera/types.ts`

**File**: `packages/core/src/elements/camera/types.ts`
**Lines**: 222–225

**Current**:
```typescript
  /** Minimum camera distance from target. */
  minDistance?: number;
  /** Maximum camera distance from target. */
  maxDistance?: number;
```

**Replace with**:
```typescript
  /**
   * Minimum camera distance from the orbit target, in world units.
   * When unset, a runtime guardrail applies a default of `0.1` to prevent the camera
   * from passing through the scene origin.
   * @remarks For a 1-unit world (model height ≈ 1, natural camera distance ≈ 3.5 units):
   *   a recommended minimum is `0.1`. Set explicitly if the scene requires tighter limits.
   */
  minDistance?: number;
  /**
   * Maximum camera distance from the orbit target, in world units.
   * When unset, a runtime guardrail applies a default of `50` to prevent infinite zoom-out.
   * @remarks For a 1-unit world (model height ≈ 1, natural camera distance ≈ 3.5 units):
   *   a recommended maximum is `20` (≈ 5.7× the natural camera distance).
   *   Set explicitly if the scene has content spread over a wider area.
   */
  maxDistance?: number;
```

---

### B-4 · Gap 11 — `nvsTarget` `[0..1]` range annotation in `camera/types.ts`

**File**: `packages/core/src/elements/camera/types.ts`
**Lines**: 34–39 (inside `WorldSpaceCamera`)

**Current**:
```typescript
  /**
   * Optional NVS-space look-at override [x, y].
   * If set, overrides the world-space target X,Y at render time.
   * The target Z is taken from `target[2]`.
   * Allows viewport-fraction targeting without knowing world units.
   */
  nvsTarget?: readonly [number, number];
```

**Replace with**:
```typescript
  /**
   * Optional NVS-space look-at override [x, y].
   * Both components are in [0, 1] (Normalized Viewport Space):
   *   x=0 is the viewport left edge; x=1 is the right edge.
   *   y=0 is the viewport top edge; y=1 is the bottom edge.
   * If set, overrides the world-space target X,Y at render time.
   * The target Z is taken from `target[2]`.
   */
  nvsTarget?: readonly [number, number];
```

---

## Stream C — Camera render algorithmic fixes

**Files**: `packages/core/src/elements/camera/render.ts`, `packages/core/src/elements/camera/__tests__/render.test.ts`, `packages/core/src/elements/camera/types.ts`†

† `camera/types.ts` is shared with Stream B — see File Conflict Resolution. Apply all `camera/types.ts` edits from B-3, B-4, and C-2 together in one commit.

**Pre-flight (required before touching `render.ts`)**: Run the following grep and record the result in your PR description:

```bash
grep -rn "fitFloorDepth" apps/
```

Confirmed result as of 2026-03-07: **zero live scene usages** of `fitFloorDepth` in `apps/examples/`. The only matches in `apps/` are documentation strings in `apps/docs/` (JSX template literals and prop-table rows). No running scene will be affected by C-2. If this grep returns any new live scene usage when you run it, update that scene to supply `cameraY` explicitly before applying C-2, and document the change in your PR.

---

### C-1 · Gap 6 — `solveCameraZForFloor` search range

**File**: `packages/core/src/elements/camera/render.ts`
**Lines**: 57–58

**Current**:
```typescript
  let lo = zMax + 1;
  let hi = zMax + 5000;
```

**Replace with**:
```typescript
  let lo = zMax + 1;
  // Scale the search upper bound with scene Z extent rather than a fixed 5000-unit constant.
  // For a 1-unit world (zMax≈1, zMin≈0):  hi = 1 + max(10, 20)   = 21.
  // For a 100-unit world (zMax≈100, zMin≈-100): hi = 100 + max(10, 4000) = 4100.
  // The bisection converges in 30 iterations regardless of range; the fix prevents
  // the solver from returning a camera position thousands of units out for small worlds.
  let hi = zMax + Math.max(10, (zMax - zMin) * 20);
```

---

### C-2 · Gap 5 — `fitFloorDepth` legacy `cameraY` default

**File**: `packages/core/src/elements/camera/render.ts`
**Line**: 187

**Current**:
```typescript
    const cameraY = desc.cameraY ?? desc.floorY + 50;
```

**Replace with**:
```typescript
    // LEGACY: The old `+ 50` constant was calibrated for 100+ unit worlds (v1). For a
    // 1-unit world (floorY=0), that placed the camera 50 units above the floor — 50×
    // the expected scene scale, making content appear far below the horizon.
    // New default: derive from the floor Z extent, matching how solveCameraZForFloor
    // scales its search domain. Always supply `cameraY` explicitly for predictable results.
    const cameraY = desc.cameraY ?? (desc.floorY + (desc.floorZMax - desc.floorZMin) * 0.4);
```

Also add a JSDoc annotation to `FitFloorDepthCamera.cameraY` in `packages/core/src/elements/camera/types.ts` (line 95):

> **Note to Stream B developer**: This JSDoc change in `camera/types.ts` is owned by Stream C (not Stream B), because it directly describes a behaviour change in `render.ts`. Co-ordinate with Stream B developer to avoid a conflict on `camera/types.ts`. The recommended approach: Stream B commits first, Stream C applies the additional `cameraY` JSDoc as a follow-up commit, or both developers resolve it together before either commits.

**File**: `packages/core/src/elements/camera/types.ts`
**Lines**: 94–95 (inside `FitFloorDepthCamera`)

**Current**:
```typescript
  cameraX?: number;
  cameraY?: number;
```

**Replace with**:
```typescript
  cameraX?: number;
  /**
   * Camera Y position in world space. When omitted, the runtime derives a default from
   * `floorY + (floorZMax - floorZMin) * 0.4` to produce a scene-extent-relative height.
   *
   * @deprecated Supply `cameraY` explicitly. The auto-derived fallback is a best-effort
   * heuristic; `fitFloorDepth` mode is a v1 legacy API and is not calibrated for
   * 1-unit world scenes. Prefer `mode: 'world'` for new scenes.
   */
  cameraY?: number;
```

> **File conflict note**: `camera/types.ts` is touched by both Stream B (B-3, B-4) and Stream C (C-2 JSDoc on `cameraY`). Developers must sequence their commits or coordinate a single commit covering all `camera/types.ts` changes. Assign one developer to own the final `camera/types.ts` state incorporating all of B-3, B-4, and C-2.

---

### C-3 · Regression tests for C-1 and C-2

**File**: `packages/core/src/elements/camera/__tests__/render.test.ts`
**Location**: Append after the last existing `describe` block (currently ending at line 204).

The `render.test.ts` file already uses `THREE.PerspectiveCamera` without a WebGL context — this pattern is established by the existing tests. The new tests follow the same convention.

```typescript
// ─── fitFloorDepth — cameraY derivation (Gap 5 / C-2 regression) ────────────

describe('applyCamera fitFloorDepth — cameraY derivation', () => {
  it('derives cameraY = floorY + (floorZMax - floorZMin) * 0.4 when cameraY is not supplied', () => {
    const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 100);
    const state: SceneCamera = {
      enabled: true,
      descriptor: { mode: 'fitFloorDepth', floorY: 0, floorZMin: 0, floorZMax: 1 },
    };
    applyCamera(state, { camera, tick: makeTickDouble() });
    // Expected: floorY + (floorZMax - floorZMin) * 0.4 = 0 + 1 * 0.4 = 0.4
    // Verifies the old legacy `floorY + 50` default is no longer used.
    expect(camera.position.y).toBeCloseTo(0.4, 3);
  });

  it('uses a non-zero floorY as the base for the derivation', () => {
    const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 100);
    const state: SceneCamera = {
      enabled: true,
      descriptor: { mode: 'fitFloorDepth', floorY: 2, floorZMin: 0, floorZMax: 5 },
    };
    applyCamera(state, { camera, tick: makeTickDouble() });
    // Expected: 2 + (5 - 0) * 0.4 = 2 + 2.0 = 4.0
    expect(camera.position.y).toBeCloseTo(4.0, 3);
  });

  it('respects explicit cameraY when supplied, overriding derivation', () => {
    const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 100);
    const state: SceneCamera = {
      enabled: true,
      descriptor: { mode: 'fitFloorDepth', floorY: 0, floorZMin: 0, floorZMax: 1, cameraY: 2 },
    };
    applyCamera(state, { camera, tick: makeTickDouble() });
    expect(camera.position.y).toBeCloseTo(2, 3);
  });
});

// ─── fitFloorDepth — bisection solver sanity (Gap 6 / C-1 regression) ────────

describe('applyCamera fitFloorDepth — bisection solver sanity', () => {
  it('1-unit floor extent converges to a reasonable camera Z (not thousands of units out)', () => {
    // For floorZMax=1, zMin=0: old hi=5001, new hi=21.
    // In both cases the bisection finds a physically-sensible camera position,
    // but this test documents and regression-protects the expected range.
    const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 100);
    const state: SceneCamera = {
      enabled: true,
      descriptor: {
        mode: 'fitFloorDepth',
        floorY: 0, floorZMin: 0, floorZMax: 1,
        cameraY: 0.4,  // supply explicitly so this test isolates C-1 not C-2
      },
    };
    applyCamera(state, { camera, tick: makeTickDouble() });
    // Camera Z must be past the far edge of the floor (zMax=1) but not absurdly far.
    expect(camera.position.z).toBeGreaterThan(1);
    expect(camera.position.z).toBeLessThan(50);
  });

  it('10-unit floor extent converges to a reasonable camera Z', () => {
    const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 200);
    const state: SceneCamera = {
      enabled: true,
      descriptor: {
        mode: 'fitFloorDepth',
        floorY: 0, floorZMin: 0, floorZMax: 10,
        cameraY: 4.0,
      },
    };
    applyCamera(state, { camera, tick: makeTickDouble() });
    expect(camera.position.z).toBeGreaterThan(10);
    expect(camera.position.z).toBeLessThan(200);
  });
});
```

---

## Stream D — Floor render comment + CameraControlsDriver guardrail

**Files**: `packages/core/src/elements/floor/render.ts`, `packages/core/src/elements/camera/CameraControlsDriver.ts`

---

### D-1 · Gap 7 — Floor geometry size comment in `floor/render.ts`

**File**: `packages/core/src/elements/floor/render.ts`
**Line**: 90

**Current**:
```typescript
  const geometry = new THREE.PlaneGeometry(400, 400);
```

**Replace with**:
```typescript
  // Intentionally large — must extend beyond maximum camera frustum extent.
  // 400×400 world units covers scenes calibrated within a ±200 unit world.
  const geometry = new THREE.PlaneGeometry(400, 400);
```

---

### D-2 · Gap 10 — `minDistance`/`maxDistance` guardrail in `CameraControlsDriver.ts`

**File**: `packages/core/src/elements/camera/CameraControlsDriver.ts`
**Lines**: 158–159

**Current**:
```typescript
    if (config.minDistance !== undefined) cc.minDistance = config.minDistance;
    if (config.maxDistance !== undefined) cc.maxDistance = config.maxDistance;
```

**Replace with**:
```typescript
    // Apply author-specified limits or sensible guardrail defaults.
    // camera-controls uses 0 and Infinity when these are not set, which causes the camera
    // to clip through the scene origin (minDistance=0) and allows infinite zoom-out (maxDistance=Infinity).
    // Authors who need tighter or wider bounds should set minDistance/maxDistance explicitly on
    // the <Camera> DSL element — the recommended values are documented on the types.
    cc.minDistance = config.minDistance ?? 0.1;
    cc.maxDistance = config.maxDistance ?? 50;
```

---

## Stream E — NVS contract tests and runtime dev-mode guard

**Files**: `packages/diagram/src/elements/diagram/__tests__/nvsBounds.test.ts`, `packages/diagram/src/elements/diagram/canvas/compile.ts`

Both changes are self-contained and depend only on the existing `compileCanvas` function signature.

---

### E-1 · Gap 13 — Runtime dev-mode guard in `canvas/compile.ts`

**File**: `packages/diagram/src/elements/diagram/canvas/compile.ts`
**Location**: Inside `compileCanvas()`, after the `nvsBounds` object is constructed (lines 184–189) and before the `return` statement (line 191).

**Current** (lines 184–191):
```typescript
  const nvsBounds: NVSRect = {
    x: dsl.x ?? 0,
    y: dsl.y ?? 0,
    w: dsl.w ?? 1,
    h: dsl.h ?? 1,
  };

  return {
```

**Replace with**:
```typescript
  const nvsBounds: NVSRect = {
    x: dsl.x ?? 0,
    y: dsl.y ?? 0,
    w: dsl.w ?? 1,
    h: dsl.h ?? 1,
  };

  if (process.env.NODE_ENV !== 'production') {
    const { x, y, w, h } = nvsBounds;
    if (x < 0 || y < 0 || w <= 0 || h <= 0 || x + w > 1 || y + h > 1) {
      console.error(
        `[DiagramCanvas] nvsBounds out of [0..1]: ${JSON.stringify(nvsBounds)}. ` +
          `DiagramCanvas id="${dsl.id}". All components must satisfy: ` +
          `x≥0, y≥0, w>0, h>0, x+w≤1, y+h≤1.`,
      );
    }
  }

  return {
```

---

### E-2 · Gap 12 — NVS contract tests in `nvsBounds.test.ts`

**File**: `packages/diagram/src/elements/diagram/__tests__/nvsBounds.test.ts`

#### E-2a · Update import line (line 4)

**Current**:
```typescript
import { describe, it, expect } from 'vitest';
```

**Replace with**:
```typescript
import { describe, it, expect, vi } from 'vitest';
```

#### E-2b · Append two new `describe` blocks at the end of the file (after line 154)

Add the following after the last closing `});` of the existing `computeNdcForNvs` describe block:

```typescript
// ─── compileCanvas — nvsBounds within [0..1] for valid inputs ────────────────

describe('compileCanvas — nvsBounds contract: valid inputs stay within [0..1]', () => {
  it('fullscreen default { x:0, y:0, w:1, h:1 } satisfies x≥0, y≥0, x+w≤1, y+h≤1', () => {
    const state = compileCanvas({ id: 'c' }, [], []);
    expect(state.nvsBounds.x).toBeGreaterThanOrEqual(0);
    expect(state.nvsBounds.y).toBeGreaterThanOrEqual(0);
    expect(state.nvsBounds.w).toBeGreaterThan(0);
    expect(state.nvsBounds.h).toBeGreaterThan(0);
    expect(state.nvsBounds.x + state.nvsBounds.w).toBeLessThanOrEqual(1);
    expect(state.nvsBounds.y + state.nvsBounds.h).toBeLessThanOrEqual(1);
  });

  it('right-half { x:0.5, y:0, w:0.5, h:1 } satisfies x+w≤1 and y+h≤1', () => {
    const state = compileCanvas({ id: 'c', x: 0.5, y: 0, w: 0.5, h: 1 }, [], []);
    expect(state.nvsBounds.x + state.nvsBounds.w).toBeLessThanOrEqual(1);
    expect(state.nvsBounds.y + state.nvsBounds.h).toBeLessThanOrEqual(1);
  });

  it('top-left quarter { x:0, y:0, w:0.5, h:0.5 } satisfies x+w≤1 and y+h≤1', () => {
    const state = compileCanvas({ id: 'c', x: 0, y: 0, w: 0.5, h: 0.5 }, [], []);
    expect(state.nvsBounds.x + state.nvsBounds.w).toBeLessThanOrEqual(1);
    expect(state.nvsBounds.y + state.nvsBounds.h).toBeLessThanOrEqual(1);
  });

  it('bottom-right quarter { x:0.5, y:0.5, w:0.5, h:0.5 } satisfies x+w≤1 and y+h≤1', () => {
    const state = compileCanvas({ id: 'c', x: 0.5, y: 0.5, w: 0.5, h: 0.5 }, [], []);
    expect(state.nvsBounds.x + state.nvsBounds.w).toBeLessThanOrEqual(1);
    expect(state.nvsBounds.y + state.nvsBounds.h).toBeLessThanOrEqual(1);
  });
});

// ─── compileCanvas — dev-mode guard fires console.error for out-of-range nvsBounds ─

describe('compileCanvas — dev-mode guard fires console.error for out-of-range nvsBounds', () => {
  it('fires for x + w > 1 (right edge overflows viewport)', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    compileCanvas({ id: 'overflow-x', x: 0.7, w: 0.6 }, [], []);
    expect(spy).toHaveBeenCalledOnce();
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining('[DiagramCanvas] nvsBounds out of [0..1]'),
    );
    spy.mockRestore();
  });

  it('fires for y + h > 1 (bottom edge overflows viewport)', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    compileCanvas({ id: 'overflow-y', y: 0.8, h: 0.5 }, [], []);
    expect(spy).toHaveBeenCalledOnce();
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining('[DiagramCanvas] nvsBounds out of [0..1]'),
    );
    spy.mockRestore();
  });

  it('fires for negative x', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    compileCanvas({ id: 'neg-x', x: -0.1 }, [], []);
    expect(spy).toHaveBeenCalledOnce();
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining('[DiagramCanvas] nvsBounds out of [0..1]'),
    );
    spy.mockRestore();
  });

  it('fires for negative y', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    compileCanvas({ id: 'neg-y', y: -0.1 }, [], []);
    expect(spy).toHaveBeenCalledOnce();
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining('[DiagramCanvas] nvsBounds out of [0..1]'),
    );
    spy.mockRestore();
  });

  it('fires for w <= 0 (zero-width canvas)', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    compileCanvas({ id: 'zero-w', w: 0 }, [], []);
    expect(spy).toHaveBeenCalledOnce();
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining('[DiagramCanvas] nvsBounds out of [0..1]'),
    );
    spy.mockRestore();
  });

  it('fires for h <= 0 (zero-height canvas)', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    compileCanvas({ id: 'zero-h', h: 0 }, [], []);
    expect(spy).toHaveBeenCalledOnce();
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining('[DiagramCanvas] nvsBounds out of [0..1]'),
    );
    spy.mockRestore();
  });

  it('does NOT fire for valid fullscreen bounds { x:0, y:0, w:1, h:1 }', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    compileCanvas({ id: 'valid-fullscreen' }, [], []);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('does NOT fire for valid sub-region { x:0.25, y:0.25, w:0.5, h:0.5 }', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    compileCanvas({ id: 'valid-quarter', x: 0.25, y: 0.25, w: 0.5, h: 0.5 }, [], []);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('includes the DiagramCanvas id in the error message', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    compileCanvas({ id: 'my-canvas', x: 1.5 }, [], []);
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining('id="my-canvas"'),
    );
    spy.mockRestore();
  });
});
```

---

## File Conflict Resolution

`packages/core/src/elements/camera/types.ts` is modified by both Stream B (B-3 `minDistance/maxDistance`, B-4 `nvsTarget`) and Stream C (C-2 `cameraY` on `FitFloorDepthCamera`). This is the only file conflict.

**Resolution strategy**: Assign one developer to own `camera/types.ts` and apply all three edits (B-3, B-4, C-2) in a single commit. That developer takes on the complete set of `camera/types.ts` changes from both streams. The remaining Stream B changes (`lighting/compile.ts`, `camera/compile.ts`) and Stream C changes (`camera/render.ts`) are unambiguously single-file and can proceed independently.

---

## Verification Checklist

After all streams are complete, verify the following before closing this plan:

1. **Typecheck passes**: `pnpm typecheck` exits 0 with no errors.
2. **Core tests pass**: `pnpm --filter @brewsite/core test` exits 0.
3. **Diagram tests pass**: `pnpm --filter @brewsite/diagram test` exits 0 — including the 13 new assertions added in Stream E (4 valid-input contract tests + 9 dev-mode guard tests).
4. **Core render tests pass**: `pnpm --filter @brewsite/core vitest run src/elements/camera/__tests__/render.test.ts` exits 0 — including the 5 new `fitFloorDepth` regression tests added in Stream C.
5. **No new exports**: `git diff --stat` on `index.ts` barrel files shows zero changes.
6. **Gap 4 near/far confirmed**: `grep -n "near: 0.01" packages/core/src/elements/camera/compile.ts` returns line 33.
7. **Gap 4 visual verification**: Run `pnpm dev` and open every example scene in `apps/examples/`. Confirm no geometry is clipped or missing compared to the `main` branch before this change. Pay particular attention to any scene using `<Camera far={...}>` overrides — if a scene explicitly sets `far` to a value > 100 it will continue using its override and is not affected. Scenes without explicit `far` now use 100.
8. **Gap 6 search range confirmed**: `grep -n "Math.max(10" packages/core/src/elements/camera/render.ts` returns line 58.
9. **Gap 10 guardrail confirmed**: `grep -n "cc.minDistance = " packages/core/src/elements/camera/CameraControlsDriver.ts` returns a line without `!== undefined`.
10. **Gap 13 guard confirmed**: `grep -n "NODE_ENV" packages/diagram/src/elements/diagram/canvas/compile.ts` returns a match.

---

## Gap Coverage Index

| Gap | Stream | Section | File(s) |
|-----|--------|---------|---------|
| 1 — Floor `position` JSDoc | A | A-1, A-2 | `floor/types.ts`, `floor/dsl.tsx` |
| 2 — Lighting `position` JSDoc | A | A-3a–h | `lighting/types.ts` |
| 3 — Default directional `[10,10,10]` comment | B | B-1 | `lighting/compile.ts` |
| 4 — Camera `far`/`near` defaults | B | B-2 | `camera/compile.ts` |
| 5 — `fitFloorDepth` `cameraY + 50` | C | C-2, C-3 | `camera/render.ts`, `camera/types.ts`, `camera/render.test.ts` |
| 6 — `solveCameraZForFloor` search range | C | C-1, C-3 | `camera/render.ts`, `camera/render.test.ts` |
| 7 — Floor geometry 400×400 comment | D | D-1 | `floor/render.ts` |
| 8 — Shadow camera constants JSDoc | A | A-4 | `lighting/render.ts` |
| 9 — `minDistance`/`maxDistance` JSDoc | B | B-3 | `camera/types.ts` |
| 10 — `minDistance`/`maxDistance` guardrail | D | D-2 | `CameraControlsDriver.ts` |
| 11 — NVS `@range` sweep | B | B-4 | `camera/types.ts` |
| 12 — NVS contract tests | E | E-2 | `nvsBounds.test.ts` |
| 13 — Runtime dev-mode guard | E | E-1 | `canvas/compile.ts` |
