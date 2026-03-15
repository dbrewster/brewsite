---
title: "Remove IGroupOwner from ChartWidget — Live NVS Position for Smooth Transition Animation"
doc_type: plan
status: ready
owner: Toolkit Product
last_updated: 2026-03-14
change_history:
  - date: 2026-03-14
    author: "Toolkit Product (TPM)"
    summary: "Initial plan authored. Scope: remove IGroupOwner from ChartWidget, simplify apply() and onTick(), update tests to cover new live-position behavior."
---

# Plan: Remove IGroupOwner from ChartWidget

## Problem

Charts inside `<View>` elements snap their position at scene transitions instead of animating smoothly. The root cause is a two-part mismatch:

1. `ChartWidget` implements `IGroupOwner`, which exposes `rootGroup = this.chartRenderer.chartGroup`. The core plugin's `reconcileCompiledTrack` discovers this, and `ViewWidget` reparents the chart's Three.js group into its own group and drives it with delta transforms (position, scale, Z). `ChartWidget.apply()` detects reparenting and freezes `frozenWorldPos`/`frozenWorldW`/`frozenWorldH` so it does not double-position the chart.

2. `ViewState` is not an `ISceneElement`, so the compiler copies it unchanged (via `passthroughWidgets`) into every tick of the transition block. `ViewWidget` therefore holds the FROM scene's position for the entire transition, then snaps to the TO scene position at the scene boundary.

The frozen-position guard in `ChartWidget` was introduced to prevent double-positioning under the ViewWidget group. But because ViewWidget itself cannot animate during transitions, the combination produces a snap.

`DiagramWidget` does not implement `IGroupOwner`. It computes absolute world position from `state.nvsX/nvsY/z` on every tick. The `interpolateFn` in `functionalChartTransitionSpec` already blends `nvsX`, `nvsY`, `z`, `bounds.width`, `bounds.height`, and `opacity` — the same fields `DiagramWidget` relies on. The fix is to make `ChartWidget` behave identically.

## Solution Summary

Remove `IGroupOwner` from `ChartWidget`. Charts compute absolute world position from interpolated `state.nvsX/nvsY/z` every tick, exactly as `DiagramWidget` does. Because `ChartWidget` no longer has a `rootGroup` getter, `isGroupOwner()` returns false for charts, and the core plugin's `resolveChildRoot` will never reparent a chart's group. No core plugin or ViewWidget changes are required.

The `cachedWorldScale` optimization (caching world-space `width/height` keyed on NVS bounds) is unrelated to reparenting and must be preserved — it prevents redundant `toWorldSize()` calls during steady-state ticks.

## Semver Impact

**Patch**. `IGroupOwner` was never part of `@brewsite/charts`' public API surface. `ChartWidget` is an internal class; consumers interact with it only through DSL props and the chartPlugin. No consumer-facing types or exports change.

---

## Files to Modify

### File 1: `packages/charts/src/elements/chart/ChartWidget.ts`

This is the only production source file that changes. All modifications are removals and simplifications — no new logic is introduced.

#### 1a. Remove `IGroupOwner` from the `implements` list

Current line 84:
```typescript
export class ChartWidget
  implements
    ISceneElement<ChartState>,
    IRenderable<ChartState>,
    IAnimationController,
    IDslComposite,
    ILoadable,
    INVSBounded,
    IGroupOwner
```

Replace with:
```typescript
export class ChartWidget
  implements
    ISceneElement<ChartState>,
    IRenderable<ChartState>,
    IAnimationController,
    IDslComposite,
    ILoadable,
    INVSBounded
```

#### 1b. Remove `IGroupOwner` from the import block

Current import at lines 11–25:
```typescript
import type {
  ISceneElement,
  IRenderable,
  IAnimationController,
  IDslComposite,
  ILoadable,
  INVSBounded,
  IGroupOwner,
  NVSCoordService,
  NVSRect,
  WidgetInitContext,
  WidgetRenderContext,
  AnimationTickContext,
  AssetManifest,
} from '@brewsite/core';
```

Replace with:
```typescript
import type {
  ISceneElement,
  IRenderable,
  IAnimationController,
  IDslComposite,
  ILoadable,
  INVSBounded,
  NVSCoordService,
  NVSRect,
  WidgetInitContext,
  WidgetRenderContext,
  AnimationTickContext,
  AssetManifest,
} from '@brewsite/core';
```

#### 1c. Remove the `IGroupOwner` section and `rootGroup` getter

Remove lines 128–133 in their entirety:
```typescript
  // ── IGroupOwner ───────────────────────────────────────────────────────────

  /** Root Three.js Group — exposed for ViewWidget to re-parent this chart into a View Group. */
  get rootGroup(): THREE.Group {
    return this.chartRenderer.chartGroup;
  }
```

#### 1d. Remove the five `ViewWidget reparent guard` private fields

Remove lines 205–229 in their entirety:
```typescript
  // ── ViewWidget reparent guard ──────────────────────────────────────────

  /**
   * Frozen world-space position from first apply().
   * When chartGroup is reparented into a ViewWidget group, this frozen value
   * is used instead of recomputing absolute world coords each tick.
   * ViewWidget's delta transform is the sole source of movement.
   */
  private frozenWorldPos: readonly [number, number, number] | null = null;

  /** Frozen world-space width from first apply(). */
  private frozenWorldW: number | null = null;

  /** Frozen world-space height from first apply(). */
  private frozenWorldH: number | null = null;

  /**
   * True when frozenWorldPos was captured during an invisible (opacity=0) absentDefault
   * state. A provisional freeze is replaced on the next visible (opacity>0) apply so
   * charts don't permanently lock to the full-viewport absentDefault bounds.
   */
  private frozenWorldPosIsProvisional = false;

  /** True once chartGroup has been reparented out of the scene root. */
  private isReparented = false;
```

#### 1e. Simplify `apply()` — remove the reparent guard block and simplify effectivePos/effectiveW/effectiveH

The entire `apply()` method, from the world-scale cache block onward, must be rewritten as follows. The inline data registration section (lines 322–353) is unchanged. The comment block preceding `computedPos` is updated to remove the frozen-position commentary.

Replace from the stable world scale comment (line 359) through the `effectivePos`/`effectiveW`/`effectiveH` block (line 418) with:

```typescript
    // ── Stable world scale (locked to NVS bounds, immune to camera zoom) ──
    // Cache world-space dimensions and only recompute when the NVS bounds change
    // (scene transition / View layout), NOT when the camera zooms. This ensures
    // charts are fixed 3D objects that scale naturally with the camera.
    const cached = this.cachedWorldScale;
    let worldW: number;
    let worldH: number;
    if (cached && cached.nvsW === state.bounds.width && cached.nvsH === state.bounds.height) {
      worldW = cached.worldW;
      worldH = cached.worldH;
    } else {
      [worldW, worldH] = ctx.coords.toWorldSize(state.bounds.width, state.bounds.height);
      this.cachedWorldScale = {
        nvsW: state.bounds.width, nvsH: state.bounds.height,
        worldW, worldH,
      };
    }

    // Chart content starts at group-local (0, 0) and extends to (worldW, worldH).
    // Subtract half-bounds to center it on the NVS position.
    // Position is always computed live from interpolated state.nvsX/nvsY/z so that
    // interpolateFn blending of these fields produces smooth scene transition animation.
    const effectivePos: readonly [number, number, number] = [
      wcx - worldW / 2,
      wcy - worldH / 2,
      wcz,
    ];
    const effectiveW = worldW;
    const effectiveH = worldH;
```

Note: the `const [wcx, wcy, wcz] = ctx.coords.toWorld(state.nvsX, state.nvsY, state.z);` line at line 357 is unchanged — it remains immediately before the cache block.

The block that immediately follows (`const renderInput: ChartRenderInput = { ... }`) is unchanged.

#### 1f. Simplify `onTick()` — remove the reparented branch in the heatmap section

Replace lines 476–489 (the reparented position guard in the heatmap block):

```typescript
    // Use frozen position/size when reparented (same guard as apply()).
    let worldPos: readonly [number, number, number];
    let heatW: number;
    let heatH: number;
    if (this.isReparented && this.frozenWorldPos) {
      worldPos = this.frozenWorldPos;
      heatW = this.frozenWorldW!;
      heatH = this.frozenWorldH!;
    } else {
      const [wcx, wcy, wcz] = this.lastCoords.toWorld(state.nvsX, state.nvsY, state.z);
      const cws = this.cachedWorldScale;
      heatW = cws?.worldW ?? this.lastCoords.toWorldSize(state.bounds.width, state.bounds.height)[0];
      heatH = cws?.worldH ?? this.lastCoords.toWorldSize(state.bounds.width, state.bounds.height)[1];
      worldPos = [wcx - heatW / 2, wcy - heatH / 2, wcz];
    }
```

With the simplified, always-live version:

```typescript
    let worldPos: readonly [number, number, number];
    let heatW: number;
    let heatH: number;
    const [wcx, wcy, wcz] = this.lastCoords.toWorld(state.nvsX, state.nvsY, state.z);
    const cws = this.cachedWorldScale;
    heatW = cws?.worldW ?? this.lastCoords.toWorldSize(state.bounds.width, state.bounds.height)[0];
    heatH = cws?.worldH ?? this.lastCoords.toWorldSize(state.bounds.width, state.bounds.height)[1];
    worldPos = [wcx - heatW / 2, wcy - heatH / 2, wcz];
```

The comment on line 475 (`// Use frozen position/size when reparented (same guard as apply()).`) is removed along with the guard.

#### 1g. Simplify `dispose()` — remove resets of the removed fields

Remove these five lines from `dispose()` (lines 519–523):
```typescript
    this.frozenWorldPos = null;
    this.frozenWorldW = null;
    this.frozenWorldH = null;
    this.frozenWorldPosIsProvisional = false;
    this.isReparented = false;
```

The `this.cachedWorldScale = null;` line (line 518) is unchanged — it is part of the scale cache optimization and must stay.

#### 1h. Final state of the class declaration comment block

Update the JSDoc on the class (lines 66–76) to remove the `IGroupOwner` reference. The revised JSDoc:

```typescript
/**
 * Widget for a single 3D chart element.
 *
 * Implements:
 * - ISceneElement<ChartState> — DSL component + transition spec
 * - IRenderable<ChartState> — Three.js lifecycle (initialize, apply, dispose)
 * - IAnimationController — heatmap time-slice animation tick + entry animation
 * - IDslComposite — routes child DSL components
 * - ILoadable — async data fetch before first tick
 * - INVSBounded — NVS region for interaction hit testing
 */
```

---

### File 2: `packages/charts/src/elements/chart/__tests__/ChartWidget.test.ts`

#### 2a. Remove the `ViewWidget reparent guard` describe block

The entire `describe('ViewWidget reparent guard (double-positioning fix)', ...)` block (lines 390–471) tests behavior that no longer exists. Remove it completely.

This block contains three tests:
- `'freezes position after reparent — uses first-tick values when chartGroup parent changes'`
- `'updates position normally when NOT reparented (no ViewWidget group)'`
- `'dispose resets frozen state so next lifecycle starts fresh'`

All three test the `isReparented`/`frozenWorldPos` mechanism. They are replaced by the new tests described in section 2b.

#### 2b. Add replacement tests covering live-position behavior

Add a new `describe` block after the `ViewWidget reparent guard` block is removed. Insert it in place of the removed block (between the `nvsBounds` tests ending at line 341 and the `getCamera` test at line 473):

```typescript
describe('live NVS position computation (no reparent guard)', () => {
  it('apply() always recomputes position from current state.nvsX/nvsY on every call', () => {
    const rendererDouble = new ChartRendererDouble();
    const rWidget = new ChartWidget('live-chart', store, undefined, rendererDouble as never);
    const scene = new THREE.Scene();
    rWidget.initialize({ scene, renderer: null, camera: null } as unknown as WidgetInitContext);

    const coords = makeCoords();
    const ctx = { coords } as unknown as WidgetRenderContext;

    const state1 = makeState({ nvsX: 0.5, nvsY: 0.5, z: 0 });
    rWidget.apply(state1, ctx);
    const pos1 = rendererDouble.lastInput!.position;

    const state2 = makeState({ nvsX: 0.3, nvsY: 0.4, z: -5 });
    rWidget.apply(state2, ctx);
    const pos2 = rendererDouble.lastInput!.position;

    // Position must change when NVS coords change — no freezing
    expect(pos2).not.toEqual(pos1);
  });

  it('apply() recomputes position even when chartGroup is reparented into an external group', () => {
    const rendererDouble = new ChartRendererDouble();
    const rWidget = new ChartWidget('rp-chart', store, undefined, rendererDouble as never);
    const scene = new THREE.Scene();
    rWidget.initialize({ scene, renderer: null, camera: null } as unknown as WidgetInitContext);

    const coords = makeCoords();
    const ctx = { coords } as unknown as WidgetRenderContext;

    // First apply at nvsX=0.5
    rWidget.apply(makeState({ nvsX: 0.5, nvsY: 0.5, z: 0 }), ctx);
    const pos1 = rendererDouble.lastInput!.position;

    // Simulate reparent: move chartGroup into an external group (as ViewWidget would do)
    const externalGroup = new THREE.Group();
    scene.add(externalGroup);
    externalGroup.add(rendererDouble.chartGroup);

    // Second apply with different NVS — position must still update (no frozen guard)
    rWidget.apply(makeState({ nvsX: 0.15, nvsY: 0.5, z: -15 }), ctx);
    const pos2 = rendererDouble.lastInput!.position;

    expect(pos2).not.toEqual(pos1);
  });

  it('interpolated nvsX/nvsY produces proportionally correct world position', () => {
    const rendererDouble = new ChartRendererDouble();
    const rWidget = new ChartWidget('interp-chart', store, undefined, rendererDouble as never);
    rWidget.initialize(makeInitCtx());

    const coords = makeCoords();
    const ctx = { coords } as unknown as WidgetRenderContext;

    // Apply at nvsX=0.3 — midpoint between 0.1 and 0.5 simulates t=0.5 interpolation
    const state = makeState({ nvsX: 0.3, nvsY: 0.5 });
    rWidget.apply(state, ctx);

    const [wcx] = coords.toWorld(0.3, 0.5, 0);
    const [worldW] = coords.toWorldSize(state.bounds.width, state.bounds.height);
    expect(rendererDouble.lastInput!.position[0]).toBeCloseTo(wcx - worldW / 2, 3);
  });

  it('dispose does not leave any frozen position state — next lifecycle starts clean', () => {
    const rendererDouble = new ChartRendererDouble();
    const rWidget = new ChartWidget('reset-chart', store, undefined, rendererDouble as never);
    const scene = new THREE.Scene();
    rWidget.initialize({ scene, renderer: null, camera: null } as unknown as WidgetInitContext);

    const coords = makeCoords();
    const ctx = { coords } as unknown as WidgetRenderContext;

    rWidget.apply(makeState({ nvsX: 0.5, nvsY: 0.5, z: 0 }), ctx);
    rWidget.dispose();

    const scene2 = new THREE.Scene();
    rWidget.initialize({ scene: scene2, renderer: null, camera: null } as unknown as WidgetInitContext);
    rWidget.apply(makeState({ nvsX: 0.7, nvsY: 0.3, z: 5 }), ctx);

    const [wcx, wcy] = coords.toWorld(0.7, 0.3, 5);
    const [ww, wh] = coords.toWorldSize(1, 1);
    expect(rendererDouble.lastInput!.position[0]).toBeCloseTo(wcx - ww / 2, 3);
    expect(rendererDouble.lastInput!.position[1]).toBeCloseTo(wcy - wh / 2, 3);
  });
});
```

#### 2c. Verify the `cachedWorldScale` tests remain intact

The following existing tests do NOT reference reparenting and must remain unchanged:
- `'apply() centers chart group on NVS world position by subtracting half worldW/worldH'` (line 344)
- `'apply() with NVS fraction bounds (0.5, 0.4) produces correct world-space group position'` (line 360)
- `'apply() with bounds={width:0.5, height:0.4} sends worldW≈8.89, worldH≈4.0 to renderer'` (line 372)

These tests exercise the world-position computation and bounds threading — both of which are preserved in the new implementation.

---

### File 3: `packages/charts/src/elements/chart/__tests__/renderMorphContext.test.ts`

No changes required. This file tests `ChartRenderer` directly — it never references `ChartWidget`, `isReparented`, `frozenWorldPos`, or `chartGroup.parent`. It tests morph context resolution and empty-data passthrough, which are unaffected by this change.

Confirm this by inspection: the file constructs `ChartRenderer` directly (line 120: `const renderer = new ChartRenderer(store)`), not `ChartWidget`. No `THREE.Group.parent` manipulation appears anywhere.

---

## What Does Not Change

| Component | Reason |
|---|---|
| `functionalChartTransitionSpec.interpolateFn` in `compile.ts` | Already blends `nvsX`, `nvsY`, `z`, `bounds.width`, `bounds.height`, `opacity`, `_morphT`. No changes needed — this is the mechanism that makes smooth animation work. |
| `packages/core/src/plugin.ts` — `reconcileCompiledTrack` / `resolveChildRoot` | Uses `isGroupOwner(child)` to decide reparenting. Since `ChartWidget` no longer satisfies that interface, charts are automatically excluded. The check is a runtime interface test — no code change needed. |
| `ViewWidget` | Still reparents any widget that IS a `IGroupOwner`. Charts will no longer be reparented. No change needed. |
| `chartPlugin.ts` | Registers `ChartWidget` instances; does not reference `IGroupOwner`. No change needed. |
| `compile.ts` | Pure compilation; no Three.js or rendering concerns. No change needed. |
| `render.ts` | `ChartRenderer` owns the Three.js group. Its API is unchanged. |
| `types.ts`, `dsl.tsx`, `index.ts` | No public API changes. |
| `renderMorphContext.test.ts` | See File 3 above — no changes needed. |

---

## Implementation Sequence

Perform in this order to keep the build green throughout:

1. Edit `ChartWidget.ts` — remove all five items (class implements, import, rootGroup getter, private fields, apply() guard block, onTick() guard branch, dispose() resets). The TypeScript compiler will catch any missed reference.
2. Run `pnpm --filter @brewsite/charts typecheck` — must pass with zero errors before touching tests.
3. Edit `ChartWidget.test.ts` — remove the `ViewWidget reparent guard` describe block, add the replacement `live NVS position computation` describe block.
4. Run `pnpm --filter @brewsite/charts test` — all tests must pass.
5. Run `pnpm typecheck` from the repo root — confirms no cross-package type regressions.
6. Run `pnpm test` from the repo root — full suite must be green.

---

## Testing Strategy

### Unit tests (automated, `packages/charts/src/elements/chart/__tests__/ChartWidget.test.ts`)

| Test | What it verifies |
|---|---|
| `apply() always recomputes position from current state.nvsX/nvsY on every call` | No freeze after first tick; position changes when NVS coords change. |
| `apply() recomputes position even when chartGroup is reparented into an external group` | The reparenting no longer triggers the freeze guard; position continues to track state. |
| `interpolated nvsX/nvsY produces proportionally correct world position` | The numeric mapping from NVS to world space is correct after simplification. |
| `dispose does not leave any frozen position state — next lifecycle starts clean` | Dispose + re-initialize works correctly without stale frozen fields. |
| All existing `cachedWorldScale` tests | World-space sizing remains correct; the cache optimization is intact. |
| All existing lifecycle tests (initialize, apply, dispose, interactive, ILoadable, heatmap, entry animation, accessors, inline dedup, live override) | No regressions — unrelated behavior is preserved. |

### TypeScript type-check (automated)

`pnpm --filter @brewsite/charts typecheck` must complete with zero errors. The key check is that removing `IGroupOwner` from the `implements` list and removing `rootGroup` does not produce any type errors elsewhere in the package (it should not — no internal code calls `widget.rootGroup`).

### Manual integration check (developer-run)

Run the examples app (`pnpm dev`) and navigate to any scene containing a `<BarChart>` or other chart inside a `<View>`. Scroll through a transition that crosses scene boundaries. The chart must animate its position smoothly across the transition rather than snapping.

---

## Edge Cases and Risks

### Risk: `cachedWorldScale` validity during rapid NVS changes

The cache is keyed on `state.bounds.width` and `state.bounds.height`. During a transition, `interpolateFn` blends `bounds.width` and `bounds.height` — so the cache key changes every tick during a transition. This means `toWorldSize()` is called every tick during a cross-scene transition. This is acceptable: the same behavior occurs today for the non-reparented path, and it matches how `DiagramWidget` operates. Cache hits resume in steady state.

No action required. This is pre-existing behavior, not a regression introduced by this change.

### Risk: Chart positioned incorrectly when scene has no transition window

When a chart exists in only one of two adjacent scenes (absent in the other), `exitFn`/`enterFn` handle the opacity fade. These functions do not touch `nvsX`/`nvsY`/`bounds` — those fields stay at the scene's compiled values. Position is stable; this is correct behavior. No action required.

### Risk: Double-positioning if another system reparents the chart group

The reparent guard was designed specifically for `ViewWidget`. Now that charts compute absolute world position every tick, any future group reparenting by another system would compound transforms. This is the correct outcome: the `IGroupOwner` contract was the explicit opt-in for delta-transform management. Future elements that want group-based management from a container must explicitly implement `IGroupOwner`. Charts no longer opt in.

If `ViewWidget` is ever needed to contain charts again (e.g., for a clipping use case), the correct fix is to make `ViewState` an `ISceneElement` so the compiler can interpolate it — not to reintroduce `IGroupOwner` on `ChartWidget`.

### Risk: Heatmap slice position drift during transition

The heatmap `onTick()` path now also reads live `state.nvsX/nvsY/z` from `this.lastState`. `this.lastState` is set at the start of `apply()` each frame. Because `apply()` is called on every tick (before `onTick()`), `this.lastState` always holds the interpolated state for the current frame. The heatmap slice position will track the interpolated NVS position correctly during transitions.

No action required.
