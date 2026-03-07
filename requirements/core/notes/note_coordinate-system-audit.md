---
title: Coordinate System & Camera Settings Audit
doc_type: note
owner: architect
status: active
updated: 2026-03-07
---

# Coordinate System & Camera Settings Audit

Audit of the [0..1] NVS migration completeness, enforcement strategy options, and camera calibration issues across `@brewsite/core` and `@brewsite/diagram`.

---

## Architecture context

The codebase runs two coordinate systems in parallel by design:

- **NVS (Normalized Viewport Space)**: [0..1] values for viewport layout — `NVSRect`, `NVSPosition`, model `nvsX/nvsY`, `DiagramCanvasDSL.x/y/w/h`, `DiagramCanvasState.nvsBounds`. The canonical conversion layer is `layout/nvsWorldBridge.ts`.
- **World space**: Raw Three.js units for 3D positions. Intentionally not normalized — positions are relative to the camera's look-at volume.

The [0..1] migration was targeted at the **viewport layout layer** (what screen region something occupies), not at all 3D world-space coordinates. The model element is the reference implementation: `SceneModel.nvsX/nvsY` carry full JSDoc `[0..1]` range documentation; `.z` is explicitly labeled "World-space Z depth."

---

## Migration completeness table

| Element | X/Y Position | Z | NVS coverage | Notes |
|---------|-------------|---|--------------|-------|
| `@brewsite/model` SceneModel | ✅ `nvsX/nvsY` [0..1] w/ JSDoc | ✅ raw `z` labeled | Complete | Reference pattern |
| DiagramCanvasDSL | ✅ `x/y/w/h` in nvsBounds [0..1] | N/A | Complete | |
| Camera `nvsTarget` | ✅ [0..1] documented | N/A | Complete | Optional override |
| Camera core descriptors | ✅ Raw world, explicitly labeled | ✅ Labeled | Complete (intentional) | World-space by design |
| Floor `position` | ❌ Raw world, no comment, no NVS field | ❌ Same | Gap | |
| All light `position` fields | ❌ Raw world, no comment | ❌ Same | Gap | |
| `fitFloorDepth` defaults | ❌ Magic constants (+50, 5000) | ❌ Same | Legacy gap | v1 compat |
| Camera `far: 2000` default | N/A | ❌ Large-world calibration | Inconsistency | Depth precision risk |

---

## Gap 1 — Floor position undocumented
**Files**: `elements/floor/types.ts:7`, `elements/floor/dsl.tsx:9`

```typescript
position?: [number, number, number];
```

No JSDoc, no coordinate-space annotation. No NVS equivalent provided. A scene author whose model is at `nvsX=0.3, nvsY=0.5` has no way to co-locate the floor without resolving the NVS → world mapping manually.

**Fix**: Add `/** World-space position [x, y, z]. Typically [0, 0, 0]. */`

---

## Gap 2 — Lighting position fields undocumented
**File**: `elements/lighting/types.ts:14–16, 19–21, 29–31, 57–58, 65–66, 105–106`

All light `position: Vec3` fields (directional, point, glow-point, spot, panel origin, panel spacing) carry no coordinate-space comment. Camera types explicitly say "world space" — lighting types do not.

**Fix**: Add `/** World-space position. */` to each positional Vec3 field.

---

## Gap 3 — Default directional light at `[10, 10, 10]`
**File**: `elements/lighting/compile.ts:292`

```typescript
directionals: [{ id: 'directional-0', intensity: 1, color: '#ffffff', position: [10, 10, 10] }],
```

Implicitly documents a "world scale of ~10 units." For a directional light the direction matters more than position, so this is semantically fine — but the convention is not explained.

---

## Gap 4 — Camera `far: 2000` default wastes depth precision
**File**: `elements/camera/compile.ts:33`

```typescript
lens: { fov: 45, near: 0.1, far: 2000 },
```

For a 1-unit world (model height ≈ 1, camera distance ≈ 3.5 from `fitBotHeight`), `near/far = 0.1/2000 = 0.00005`. Objects at `z=0` occupy <1% of the depth buffer. Depth-fighting risk for surfaces close together in Z.

**Fix**: `far: 100` — recovers 20× depth precision, no visual impact. `near: 0.01` eliminates near-clip pop during close-focus.

---

## Gap 5 — `fitFloorDepth` default `cameraY = floorY + 50`
**File**: `elements/camera/render.ts:187`

```typescript
const cameraY = desc.cameraY ?? desc.floorY + 50;
```

`+50` is a v1 constant calibrated for a large (100+ unit) world. If `floorY = 0`, camera sits at y=50 — 50× the expected world scale. Content appears far below the horizon.

**Fix**: Require explicit `cameraY`, or derive: `desc.floorY + (desc.floorZMax - desc.floorZMin) * 0.4`. Document as legacy.

---

## Gap 6 — `solveCameraZForFloor` search range
**File**: `elements/camera/render.ts:57–61`

```typescript
let lo = zMax + 1;
let hi = zMax + 5000;
```

Search domain `[zMax+1, zMax+5000]`. For a [0..1] world with `floorZMax ≈ 1`, searches `[2, 5001]` — 5000× the expected scale. The bisection converges in 30 iterations regardless, but can settle on a camera position thousands of units out.

**Fix**: `hi = zMax + Math.max(10, (zMax - zMin) * 20)` — scales with scene extent.

---

## Gap 7 — Floor geometry 400×400 undocumented
**File**: `elements/floor/render.ts:90`

```typescript
const geometry = new THREE.PlaneGeometry(400, 400);
```

Intentionally large (ensures plane extends past any camera frustum), but completely undocumented.

**Fix**: Add comment: `// Intentionally large — must extend beyond maximum camera frustum extent.`

---

## Gap 8 — Shadow camera constants undocumented
**File**: `elements/lighting/render.ts:25–27`

```typescript
const DIRECTIONAL_SHADOW_RANGE = 260;
const DIRECTIONAL_SHADOW_NEAR = 0.5;
const DIRECTIONAL_SHADOW_FAR = 600;
```

520×520 world-unit shadow volume at 256px → 0.5px/unit density. Generous for 1-unit content but calibrated for a large-world scene. No documentation.

---

## Camera settings issues (Task 3 detail)

### Core camera — `packages/core/src/elements/camera/`

| Issue | File | Line | Severity | Fix |
|-------|------|------|----------|-----|
| `far: 2000` default | `compile.ts` | 33 | Medium — depth precision | Change to `far: 100` |
| `near: 0.1` default | `compile.ts` | 33 | Low | Change to `near: 0.01` |
| `fitFloorDepth cameraY + 50` | `render.ts` | 187 | High for [0..1] world | Document as legacy; derive from scene extent |
| `solveCameraZForFloor hi=zMax+5000` | `render.ts` | 61 | Medium | Scale with scene extent |
| No `minDistance`/`maxDistance` defaults | `types.ts` | 222–225 | Medium (UX) | Document recommended values |
| `minDistance`/`maxDistance` not applied when unset | `CameraControlsDriver.ts` | 158–161 | Medium | camera-controls defaults to 0/Infinity |

**`fitFloorDepth` note**: This mode is v1 legacy. The only safe usage today is to supply `cameraY` explicitly. The `+50` default is actively misleading for any scene calibrated for 1-unit world scale.

**Frustum check**: Objects at `x=0.5, y=0.5, z=0` (NVS center) are always in-frustum by definition of `nvsToWorldAnalytic`. The gap is depth precision, not visibility. A `far: 100` default does not change what is visible; it redistributes depth buffer precision to the range that matters.

### DiagramCanvas camera — `packages/diagram/src/elements/diagram/canvas/widget.ts`

**Auto-framing formula (line 175–179)** is mathematically correct:
```typescript
const dist = effectiveState.scale / (2 * Math.tan(fovRad / 2));
```
For `scale=1, fov=45°`: `dist ≈ 1.21`. Correctly fills vertical FOV with canvas height. No issue.

However, the diagram canvas does not set `near`/`far` — it inherits whatever the engine camera has. Fixing `far: 2000` in core (Gap 4) automatically fixes the diagram canvas.

**Interactive orbit limits**: When `interaction.enabled = true` in a diagram scene, `minDistance`/`maxDistance` are author-responsibility with no guardrail or documented guidance.

---

## Enforcement strategy (ranked)

### Rank 1 — JSDoc `@range [0..1]` (do immediately)
Apply the `SceneModel.nvsX/nvsY` pattern to every NVS-typed field. Zero mechanical enforcement, but foundational — enables reviewer spotting and IDE tooltips. Cost: ~1 hour.

### Rank 2 — Contract tests on compile output (this sprint, best ROI)
```typescript
// nvsBounds must always be in [0..1]
expect(state.nvsBounds.x + state.nvsBounds.w).toBeLessThanOrEqual(1);
expect(state.model.nvsX).toBeGreaterThanOrEqual(0);
expect(state.model.nvsX).toBeLessThanOrEqual(1);
```
Catches regressions in CI. Aligns with the project's "test the contract, not the implementation" philosophy.

### Rank 3 — Runtime assertions in compile entry points (this sprint)
```typescript
if (process.env.NODE_ENV !== 'production') {
  if (nvsBounds.x + nvsBounds.w > 1) {
    console.error(`[DiagramCanvas] nvsBounds out of [0..1]: ${JSON.stringify(nvsBounds)}`);
  }
}
```
Surfaces bad values immediately during development. Aligns with hard rule #6 (`console.warn`/`console.error` for unexpected states).

### Rank 4 — Branded TypeScript types (deferred)
`type NVSCoord = number & { readonly __nvsBrand: unique symbol }` gives compile-time prevention. Deferred because: every scene file literal needs a cast, the type cannot enforce the range (only the label), and it cannot distinguish NVS from `opacity`/`framingHeightPct`/transition `t`. Revisit when the authoring API is stable.

### Rank 5 — ESLint custom rule (not recommended)
Heuristic-only, fragile (misses computed values), expensive to maintain. Not recommended.

| Strategy | Mechanical enforcement | Cost | Recommended |
|----------|----------------------|------|-------------|
| JSDoc @range | None | Trivial | ✅ Immediately |
| Contract tests | Regression | Low | ✅ This sprint |
| Runtime assertions | Debug-time | Low | ✅ This sprint |
| Branded types | Compile-time | High | Deferred |
| ESLint rule | Heuristic | High | Not recommended |
