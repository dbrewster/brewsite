---
title: Plan — @brewsite/core Cleanup
doc_type: plan
owner: engineering
status: complete
updated: 2026-03-07
---

# Plan — @brewsite/core Cleanup

## Overview

This plan addresses all 28 findings from the 2026-03-07 architectural and product review
(`requirements/core/notes/note_core-architectural-review-2026-03-07.md`). Changes are
organised into **six parallel work streams** that can be implemented simultaneously by up
to five developers. Two streams (S3 and S4) have a hard dependency on Stream 1.

**Two findings are already resolved in the current codebase:**
- Finding 18 (`ICameraInteractionDriver` export) — already exported via `elements/index.ts`.
- Finding 28 (`api.pushWarning()` in `CompileApi`) — already declared at line 12 of `compiler/sceneDslTypes.ts`.

**Semver impact:** All P1/P2 items are bundled into the next minor release (new interfaces,
renamed optional fields). P3/P4 items include one breaking removal (animejs presets) that
should accompany a major bump if any end-app consumers import from `@brewsite/core/hud/animejs`.

---

## Dependency Graph

```
S1 Type Contracts ──┬──► S3 Camera Architecture   (depends on S1 + S4.3.D)
                    └──► S4 Compiler & Registry    (depends on S1)

S4.3.D (WidgetRegistry.getAllWidgets) ──► S3 (useSceneEngine.ts isCameraHost lookup)

S2 API Surface      ────► independent except UseSceneEngineResult export (see §2.3)
S5 Input & Lighting ────► S5.1–5.4 independent; S5.5 blocked by S1 + S4
S6 Infrastructure   ────► independent, start immediately
```

S3 and S4 **must not start** until S1 is merged and its types are available.
S3's `useSceneEngine.ts` change also requires `WidgetRegistry.getAllWidgets()` from S4.3.D to
compile; in practice, implement S4.3.D (WidgetRegistry additions) in the first commit of the S3
PR batch, then proceed with S3.
S5.5 (`LightingWidget.setLightingOverrides`) **must not start** until S1 (ILightingOverride) and
S4.4 (plugin configureRegistry wiring) are merged.

**File ownership — no two streams touch the same file:**

| File | Stream |
|---|---|
| `widget/types.ts` | S1 |
| `compiler/sceneDslTypes.ts` | S1 |
| `elements/index.ts` | S2 |
| `src/index.ts` | S2 |
| `compiler/index.ts` | S2 |
| `player/index.ts` | S2 |
| `widget/index.ts` | S2 |
| `elements/camera/types.ts` | S3 |
| `elements/camera/CameraWidget.ts` | S3 |
| `player/useSceneEngine.ts` | S3 |
| `runtime/RuntimeDriver.ts` | S3 |
| `@brewsite/diagram` `canvas/widget.ts` | S3 |
| `@brewsite/diagram` `canvas/render.ts` | S3 |
| `@brewsite/diagram` `elements/diagram/widget.ts` | S3 |
| `@brewsite/diagram` `elements/image-panel/widget.ts` | S3 |
| `@brewsite/diagram` `elements/screen/widget.ts` | S3 |
| `@brewsite/charts` `elements/chart/ChartWidget.ts` | S3 |
| `packages/core/src/widget/WidgetPlugin.ts` | S5 |
| `compiler/sceneTrackCompiler.ts` | S4 |
| `player/EngineProvider.tsx` | S4 |
| `widget/WidgetRegistry.ts` | S4 |
| `player/plugins.ts` | S4 |
| `input/types.ts` | S5 |
| `input/ActionInputController.ts` | S5 |
| `elements/lighting/LightingWidget.ts` | S5 |
| `@brewsite/diagram` `compiler/handlers.ts` | S5 |
| `player/engineTypes.ts` | S6 |
| `player/EngineARContainer.tsx` | S6 |
| `player/ScenePlayerRegistry.ts` | S6 |
| `compiler/sceneTypes.ts` | S6 |
| `runtime/types.ts` | S6 |
| `elements/camera/cameraKeys.ts` | S6 |
| `hud/animejs/` directory | S6 |
| `player/CameraControlPanel.tsx` et al | S6 |
| `packages/core/package.json` | S6 |

---

## Stream 1 — Type Contract Formalization

**Findings:** 6 (partial), 7/20, 12 (partial), 14 (partial)
**Depends on:** nothing
**Unblocks:** S3, S4

### 1.1 `packages/core/src/widget/types.ts`

#### A. Add `camera?: PerspectiveCamera` to `WidgetInitContext`

Add import:
```ts
import type { PerspectiveCamera } from 'three';
```

Updated type:
```ts
export type WidgetInitContext = {
  scene: ThreeScene;
  widgetId: string;
  renderer?: WebGLRenderer;
  /**
   * THREE.PerspectiveCamera managed by the engine.
   * Injected once at widget initialization — replaces the __brewsite_camera
   * scene.userData key. Widgets that need the camera object (e.g. CameraWidget)
   * must save this reference in their initialize() implementation.
   */
  camera?: PerspectiveCamera;
};
```

#### B. Add `ICameraFocusTarget` interface

```ts
/**
 * Widget that accepts camera focus requests from peer widgets.
 *
 * Implemented by CameraWidget. DiagramCanvasWidget dispatches focus requests
 * via context.cameraFocusTarget?.requestFocus() rather than writing to
 * scene.userData['__brewsite_camera_focus'].
 *
 * RuntimeDriverImpl resolves the first registered ICameraFocusTarget from the
 * WidgetRegistry and injects it into AnimationTickContext before each tick.
 */
export interface ICameraFocusTarget extends IWidget {
  /**
   * Request a camera focus to a world-space position and target.
   *
   * When camera interaction is active: delegates to the interaction driver for
   * smooth motion. When not active: promotes to a camera override so authored
   * camera state does not overwrite the focus on the next apply().
   *
   * @param position  Camera world position [x, y, z].
   * @param target    Camera look-at target [x, y, z].
   * @param smooth    Animate (true) or snap (false). Default: true.
   */
  requestFocus(
    position: readonly [number, number, number],
    target: readonly [number, number, number],
    smooth?: boolean,
  ): void;
}
```

#### C. Add `ILightingOverride` interface

```ts
/**
 * Widget that can temporarily suppress core scene lighting.
 *
 * Implemented by DiagramCanvasWidget to disable core lights when the diagram
 * canvas is active and manages its own lighting via HDR environment maps.
 *
 * LightingWidget checks all registered ILightingOverride implementors in
 * apply() and skips Three.js light updates when any returns { disableAll: true }.
 * Replaces the direct setSceneLightEnabled() call from @brewsite/diagram.
 */
export interface ILightingOverride extends IWidget {
  /**
   * Returns the current lighting override request, or null if not overriding.
   * Called every frame inside LightingWidget.apply() — keep implementation cheap.
   * Return { disableAll: true } to suppress ALL core lights for this frame.
   */
  getLightingOverride(): { readonly disableAll: boolean } | null;

  /**
   * Called once by LightingWidget during configureRegistry to inject a per-light
   * control setter. Widgets that expose `DiagramHoverControls.setLightEnabled` to
   * scene authors (DiagramWidget, DiagramCanvasWidget) must implement this method
   * and store the setter for use in their hover callbacks.
   *
   * This replaces the direct `setSceneLightEnabled(scene, lightId, enabled)` call
   * that previously bypassed the widget contract.
   *
   * Optional: widgets that only use `getLightingOverride()` (all-or-nothing suppression)
   * do not need to implement this.
   */
  receiveLightController?(setter: (lightId: string, enabled: boolean) => void): void;
}
```

#### D. Add `resolvedState`, `cameraFocusTarget`, `cameraOverride` to `AnimationTickContext`

First, add a minimal camera override type that lives in `widget/types.ts` to avoid
importing from the elements layer:

```ts
/**
 * Typed replacement for the __brewsite_camera_override scene.userData key.
 * Set by useSceneEngine via RuntimeDriver.setCameraOverride().
 * Read by CameraWidget in onTick() from context.cameraOverride.
 */
export type RuntimeCameraOverride = {
  readonly enabled: boolean;
  readonly position: readonly [number, number, number];
  readonly target: readonly [number, number, number];
  readonly up?: readonly [number, number, number];
  readonly fov?: number;
  readonly near?: number;
  readonly far?: number;
  readonly exposure?: number;
};
```

Updated `AnimationTickContext`:

```ts
export type AnimationTickContext = {
  clock: RealtimeClock;
  effectiveDeltaSeconds: number;
  scene: ThreeScene;
  variables: VariableStore;
  tick: SceneTrackTick | null;
  track: SceneTrack | null;
  /**
   * The widget's fully resolved state for this tick.
   *
   * For FunctionalTransitionSpec widgets: RuntimeDriverImpl evaluates the closure
   * at tick.blockProgress and places the result here so IAnimationController
   * implementors do not need to re-implement the runtime's state resolution.
   *
   * CameraWidget uses this to avoid its current duplicate evaluation of
   * functionalBlock.widgetFns[widgetId].fn(tick.blockProgress).
   *
   * Typed as unknown; cast to TState inside the widget's onTick() body.
   * Null when the widget has no compiled state for this tick.
   */
  resolvedState: unknown;
  /**
   * The registered ICameraFocusTarget, if any.
   *
   * DiagramCanvasWidget uses this to request a camera focus on node
   * double-click, replacing the scene.userData['__brewsite_camera_focus'] write.
   * Also serves as an implicit signal that a Camera DSL element is active —
   * context.cameraFocusTarget !== undefined replaces the __brewsite_cam_enabled flag.
   *
   * Null when no widget implements ICameraFocusTarget.
   */
  cameraFocusTarget: ICameraFocusTarget | null;
  /**
   * Active camera override, if set by the player layer.
   *
   * Replaces the __brewsite_camera_override scene.userData key.
   * Set by useSceneEngine when it needs to bypass authored camera state
   * (e.g. after a DiagramCanvasWidget focus request in non-interaction mode).
   */
  cameraOverride: RuntimeCameraOverride | null;
  /**
   * Callback to promote a pending focus request to a camera override.
   *
   * Injected by RuntimeDriverImpl. CameraWidget calls this in onTick() when a
   * focus request arrives in non-interaction mode — the override is stored on the
   * driver so the next frame's cameraOverride field is populated immediately.
   *
   * Replaces the __brewsite_camera_override_pending scene.userData key that the
   * original plan accidentally introduced. No new bus keys are needed.
   */
  setCameraOverride: (override: RuntimeCameraOverride | null) => void;
};
```

#### E. Add `disableWhenAbsent` and `stateEquals` to `ISceneElement<TState>`

```ts
export interface ISceneElement<TState, TExtra = void> extends IWidget {
  readonly defaultState: TState;
  readonly transitionSpec: ElementTransitionSpec<TState> | FunctionalTransitionSpec<TState>;
  readonly DslComponent: React.ComponentType<any>; // intentional: see JSDoc
  compileExtra?(state: TState, context: CompileExtraContext): TExtra;
  readonly requiresTypeProp?: boolean;
  mergeSnapshot?(prev: TState | undefined, next: TState | undefined): TState | undefined;

  /**
   * When true, the compiler substitutes makeDisabledDefault(defaultState) —
   * a clone of defaultState with `enabled` forced to false — for scenes where
   * this widget is absent. When false or omitted, absent scenes use the raw
   * defaultState unchanged.
   *
   * Replaces the duck-typed `readonly useDefaultStateWhenAbsent = false` pattern.
   * The old field name was a double-negative that misrepresented the behaviour;
   * the new name states the intent directly.
   *
   * Default: false (raw defaultState used when widget is absent).
   *
   * Widgets that should be disabled when not present in a scene
   * (CameraWidget, LightingWidget, BackgroundWidget) declare:
   *   readonly disableWhenAbsent = true;
   */
  readonly disableWhenAbsent?: boolean;

  /**
   * Optional structural equality hook used by the compiler's delta-detection pass.
   *
   * When provided, replaces the JSON.stringify comparison in buildDelta().
   * This prevents false positives from non-deterministic key ordering and
   * eliminates O(n×k) serialization for widgets with large or complex state.
   *
   * @param a - Previous state.
   * @param b - Next state.
   * @returns true when the two states are functionally equivalent.
   */
  stateEquals?(a: TState, b: TState): boolean;
}
```

#### F. Rename `CompileExtraContext.sceneProgress` → `blockProgress`

```ts
export type CompileExtraContext = {
  /**
   * Block-level progress within the current transition block: 0 at block start,
   * 1 at block end. Renamed from `sceneProgress` (which was misleading — the
   * value was always block-level, not scene-level).
   *
   * BREAKING: any widget implementing compileExtra() must rename its usage.
   */
  blockProgress: number;
  globalProgress: number;
  prefersReducedMotion: boolean;
};
```

### 1.2 `packages/core/src/compiler/sceneDslTypes.ts`

**Finding 28 is already resolved.** `pushWarning` is declared at line 12. No change required.

### Stream 1 — Breaking Changes

| Change | Semver |
|---|---|
| `CompileExtraContext.sceneProgress` → `blockProgress` | **Major** (any `compileExtra` implementor must rename the field) |
| All other changes are additive optional fields | None |

### Stream 1 — Migration

- `@brewsite/diagram`: `DiagramWidget.compileExtra()` references `context.sceneProgress` → rename to `context.blockProgress`.
- Any custom widget in `apps/examples/` with `compileExtra()` → rename `sceneProgress` → `blockProgress`.
- **`packages/core/src/widget/__tests__/ISceneElementTExtra.test.ts:80`** — rename `sceneProgress: 0.5` → `blockProgress: 0.5` in the `CompileExtraContext` literal. This file is part of Stream 1's own test package and must be updated in the S1 PR.

### Stream 1 — Test Strategy

No new test files needed for pure type additions. Existing tests will catch compilation
errors. Add one compile-time check in a new test:

- `packages/core/src/widget/__tests__/typeContracts.test.ts` (new)
  - Create a minimal `ISceneElement` implementor with `disableWhenAbsent = true` and
    `stateEquals()` — verify it type-checks without errors.
  - Create a minimal `ICameraFocusTarget` implementor — verify `requestFocus()` signature.

---

## Stream 2 — Public API Surface Cleanup

**Findings:** 4 (partial), 5, 8, 13, 15, 16
**Depends on:** Nothing (runs in parallel with all other streams)

### 2.1 `packages/core/src/elements/index.ts`

**Remove** the following exports. Each is a render-layer internal, dead code, or wrong-layer
export. Downstream packages must not call these directly.

```ts
// REMOVE — render-layer internals (Three.js functions):
export { applyLighting, type LightingThreeRefs } from './lighting';
export { applyBackground, type BackgroundDomRefs } from './background';
export { applyEnvironment, type EnvironmentThreeRefs } from './environment';
export { applyFloor, type FloorThreeRefs } from './floor';
export { applyCamera } from './camera';

// REMOVE — lighting override functions (replaced by ILightingOverride in S5):
export { setSceneLightEnabled, isSceneLightEnabled, clearSceneLightOverrides } from './lighting';

// REMOVE — compile-time internal defaults (not public API):
export { DEFAULT_LIGHTING } from './lighting';
export { DEFAULT_BACKGROUND } from './background';
export { DEFAULT_ENVIRONMENT } from './environment';
export { DEFAULT_FLOOR } from './floor';
export { DEFAULT_CAMERA, DEFAULT_CAMERA_DESCRIPTOR } from './camera';

// REMOVE — dead legacy ElementTransitionSpec exports:
export { lightingTransitionSpec } from './lighting';
export { backgroundTransitionSpec } from './background';
export { environmentTransitionSpec } from './environment';
export { floorTransitionSpec } from './floor';
export { cameraTransitionSpec } from './camera';
```

**Keep** all DSL component, type, and FunctionalTransitionSpec exports. `ICameraInteractionDriver`
and `CameraInteractionDriverFactory` are already exported (Finding 18 already resolved — keep them).

After removals, the lighting section of `elements/index.ts` looks like:
```ts
// Lighting
export type {
  SceneLighting, SceneLightAmbient, SceneLightDirectional, /* ... */
} from './lighting';
export { Lighting, Ambient, Directional, GlowPoint, Point, Spot, LightStrand,
  Wave, Circle, Rectangle, Panel } from './lighting';
// DEFAULT_LIGHTING, applyLighting, setSceneLightEnabled, LightingThreeRefs removed.
```

Similarly for background, environment, floor, and camera sections.

### 2.2 `packages/core/src/compiler/index.ts`

**Remove** lines 23–24:
```ts
// REMOVE — TextBox is an overlay component, not a compiler concept:
export { TextBox } from '../elements/text-box';
export type { TextBoxProps } from '../elements/text-box';
```

`TextBox` and `TextBoxProps` are already exported from `elements/index.ts` (lines 56–57) and
flow through `src/index.ts` via `export * from './elements'`. Consumers already importing
`TextBox` from the root barrel are unaffected.

### 2.3 `packages/core/src/index.ts`

**Remove redundant direct re-exports** (already covered by `export * from './compiler'`):
```ts
// REMOVE lines 11-13:
export type { FunctionalTransitionSpec, ElementTransitionSpec }
  from './compiler/transitions/transitionTypes';
export { blendNumber, blendOpacity, blendVec3, blendColor, transitionT }
  from './compiler/transitions/transitionTypes';
export { registerNode } from './compiler/registry';
```

**Add missing public API items** (P1 — eliminates @brewsite/model deep sub-path imports):
```ts
// Add — eliminates @brewsite/model's four sub-path deep imports:
export type { AnimationTrack } from './runtime/types';
export type { Resolvable } from './compiler/sceneTypes';
export { getNodeHandler } from './compiler/registry';
export type { CompileWarning } from './compiler/sceneTrackTypes';

// Add — UseSceneEngineResult type (defined in S3, exported here):
export type { UseSceneEngineResult } from './player/useSceneEngine';
```

**IMPORTANT — Partial S3 dependency:** The `UseSceneEngineResult` export line MUST NOT be
added to `src/index.ts` or `player/index.ts` in the S2 PR. `UseSceneEngineResult` is defined
in `useSceneEngine.ts` (owned by S3). If S2 merges before S3, the TypeScript build will fail.
Strategy: commit all other S2 changes in the S2 PR; add the `UseSceneEngineResult` export
lines in the same PR as S3 (PR-3 batch), either as part of S3's `useSceneEngine.ts` commit
or as an addendum commit targeting `src/index.ts` and `player/index.ts`.

**Remove** the direct `SCENE_CAMERA_KEY` re-export on line 14 — it now flows through
`export * from './elements'` after S6 moves it to `elements/sceneKeys.ts`:
```ts
// REMOVE line 14 (after S6 adds SCENE_CAMERA_KEY to elements/index.ts):
export { SCENE_CAMERA_KEY } from './elements/camera';
```

### 2.4 `packages/core/src/player/index.ts`

**Mark dev-tool exports as deprecated** (full removal to `@brewsite/core/devtools` subpath
in S6 — keeping them here avoids a hard break for existing consumers):
```ts
// ─── Dev Tools (move to @brewsite/core/devtools; deprecated here) ─────────────
/** @deprecated Import from `@brewsite/core/devtools` instead. Will be removed in v3. */
export { CameraControlPanel } from './CameraControlPanel';
/** @deprecated Import from `@brewsite/core/devtools` instead. Will be removed in v3. */
export { CameraInteractionInfoDialog } from './CameraInteractionInfoDialog';
/** @deprecated Import from `@brewsite/core/devtools` instead. Will be removed in v3. */
export { SceneInspector } from './SceneInspector';
export type { SceneInspectorProps } from './SceneInspector';
```

**Add UseSceneEngineResult** (pending S3 defining the type):
**IMPORTANT: Do NOT include this export in the S2 PR. See §2.3 for the sequencing constraint.**
The type is defined in `useSceneEngine.ts` which is owned by S3. Add this line only in the
S3 PR batch, as a commit targeting `player/index.ts` (acceptable since S3 is the PR that
makes `useSceneEngine.ts` compilable with the new type exported).
```ts
export type { UseSceneEngineResult } from './useSceneEngine';
```

### 2.5 `packages/core/src/widget/index.ts`

**Remove duplicate `corePlugin` export** (Finding 11 of P2 from note):
```ts
// REMOVE — corePlugin already exported from player/index.ts which flows
// through src/index.ts via export * from './player'. Two paths for the same
// export create a conflict when both player/ and widget/ are re-exported.
export { corePlugin } from '../player/plugins';
export type { CorePluginOptions } from '../player/plugins';
```

### Stream 2 — Breaking Changes

| Change | Consumers affected | Semver |
|---|---|---|
| Remove `setSceneLightEnabled` | `@brewsite/diagram` (sole caller) — migrates to S5's ILightingOverride | **Major** |
| Remove `applyLighting`, `applyBackground`, `applyCamera`, `applyFloor`, `applyEnvironment` | No known downstream caller; render-layer internals | **Major** |
| Remove `DEFAULT_LIGHTING`, `DEFAULT_BACKGROUND`, `DEFAULT_CAMERA`, `DEFAULT_FLOOR`, `DEFAULT_ENVIRONMENT` | No known downstream caller | **Major** |
| Remove `lightingTransitionSpec`, `backgroundTransitionSpec`, `cameraTransitionSpec`, `floorTransitionSpec`, `environmentTransitionSpec` | Dead code — no downstream caller | Minor |
| Remove `TextBox` from `compiler/index.ts` | Any consumer importing TextBox via the compiler barrel | **Major** |
| Remove `registerNode`, `FunctionalTransitionSpec`, `ElementTransitionSpec` direct re-exports in `src/index.ts` | Non-breaking — still exported via `export * from './compiler'` | None |
| Add `AnimationTrack`, `Resolvable`, `getNodeHandler`, `CompileWarning` | Additive | None |

### Stream 2 — @brewsite/model Migration

| Old import path | New import path |
|---|---|
| `@brewsite/core/compiler/registry` (getNodeHandler) | `@brewsite/core` |
| `@brewsite/core/compiler/registry` (clearRegistry) | `@brewsite/core/testing` (added in S6) |
| `@brewsite/core/compiler/sceneTypes` (Resolvable) | `@brewsite/core` |
| `@brewsite/core/runtime/types` (AnimationTrack) | `@brewsite/core` |

All four sub-path deep imports in `packages/model/src/` are eliminated.

### Stream 2 — Test Strategy

- `packages/core/src/elements/__tests__/index.test.ts` — assert that render functions
  (`applyLighting`, etc.) are **not** exported from `@brewsite/core`. Use TypeScript import
  resolution test or vitest `expect(() => import(...)).rejects`.
- `packages/core/src/compiler/__tests__/registry.test.ts` — assert `getNodeHandler` is
  importable from `@brewsite/core` (barrel smoke test).
- No runtime behaviour changes; no new runtime tests needed.

---

## Stream 3 — Camera Architecture Decoupling

**Findings:** 1 (scene.userData bus), 2 (ICameraHost), 6 (implementation)
**Depends on:** Stream 1 + S4.3.D (WidgetRegistry.getAllWidgets)

### 3.1 `packages/core/src/elements/camera/types.ts`

**Add `ICameraHost` interface:**

```ts
/**
 * Interface that CameraWidget exposes to the player layer (useSceneEngine).
 *
 * Decouples useSceneEngine from the concrete CameraWidget class. The player
 * programs to this interface instead of importing CameraWidget directly,
 * eliminating the player→elements hard dependency.
 */
export interface ICameraHost {
  /**
   * Returns true when camera interaction is active AND the interaction driver
   * claims ALL wheel events. When true, useSceneEngine suppresses wheel-based
   * scene navigation (the wheelGuard).
   */
  isWheelClaimedByInteraction(): boolean;

  /**
   * Sets per-engine camera interaction defaults that apply when a scene does not
   * explicitly configure the interaction props (wheelLockIdleMs, polar limits, etc.).
   * Called once per registry construction by useSceneEngine.
   */
  setInteractionDefaults(defaults: CameraInteractionDefaults | null | undefined): void;
}
```

**Verify `CameraOverrideState`** (already defined, no change needed):
```ts
export type CameraOverrideState = {
  enabled: boolean;
  position: Vec3;
  target: Vec3;
  up?: Vec3;
  fov?: number;
  near?: number;
  far?: number;
  exposure?: number;
};
```

Note: `CameraOverrideState` and `RuntimeCameraOverride` (S1) are structurally compatible.
`CameraWidget` can use `RuntimeCameraOverride` from context.cameraOverride and cast to its
internal `CameraOverrideState` type, or align the two types to be identical.

### 3.2 `packages/core/src/elements/camera/CameraWidget.ts`

**Full set of changes:**

1. **Remove** the four `scene.userData` string constants:
   ```ts
   // REMOVE:
   const RENDERER_KEY = '__brewsite_renderer';
   const CAMERA_OVERRIDE_KEY = '__brewsite_camera_override';
   const CAMERA_FOCUS_KEY = '__brewsite_camera_focus';
   // KEEP (for now — used by useSceneEngine to inject the camera object,
   // but remove once useSceneEngine is updated in step 3.3):
   // const CAMERA_KEY = SCENE_CAMERA_KEY;  → will become unused after 3.3
   ```

2. **Add private fields:**
   ```ts
   private _pendingFocusOverride: RuntimeCameraOverride | null = null;
   ```

3. **Replace `readonly useDefaultStateWhenAbsent = false`** with:
   ```ts
   readonly disableWhenAbsent = true;
   ```

4. **Implement `IRenderable<SceneCamera>`, `ICameraHost`, and `ICameraFocusTarget`** on the
   class declaration:
   ```ts
   export class CameraWidget
     implements ISceneElement<SceneCamera>, IRenderable<SceneCamera>,
                IAnimationController, ICameraHost, ICameraFocusTarget
   ```
   **Rationale for `IRenderable<SceneCamera>`:** CameraWidget needs `initialize()` to be called
   by `RuntimeDriverImpl` to receive the Three.js camera object (previously retrieved via
   `scene.userData['__brewsite_camera']`). The cleanest way to hook into the `RuntimeDriverImpl`
   initialization pass is to implement the full `IRenderable` contract. The `apply()` method is
   a **documented no-op** — all camera logic remains in `onTick()` which already reads the
   compiled state. `dispose()` delegates to `exitInteractionMode()` (already implemented).
   This design is consistent with how all other core widgets implement IRenderable and removes
   the need for any new interface (`IInitializable` etc.) or duck-typed runtime checks.

5. **Add `initialize()` and no-op `apply()` methods:**
   ```ts
   /** IRenderable.initialize — receives Three.js camera/renderer at engine mount. */
   initialize(context: WidgetInitContext): void {
     if (context.camera) this.cameraRef = context.camera;
     if (context.renderer) {
       this.rendererRef = context.renderer;
       this.domElement = context.renderer.domElement;
     }
   }

   /**
    * IRenderable.apply — no-op.
    * CameraWidget drives itself via IAnimationController.onTick(), not apply().
    * onTick() reads context.resolvedState (from S1/S3.4) so compiled camera state
    * does not need to be re-read here.
    */
   apply(_state: SceneCamera, _context: WidgetRenderContext): void {}
   ```

5a. **Remove `__brewsite_cam_enabled` write from `onTick()`** (Issue 4 — missed in original plan):
   ```ts
   // REMOVE line 176:
   context.scene.userData['__brewsite_cam_enabled'] = true;
   ```
   The `__brewsite_cam_enabled` flag was read by `DiagramCanvasWidget` to detect whether a
   core Camera element is active. After S3, `DiagramCanvasWidget` uses
   `context.cameraFocusTarget !== null` for this check (S3.5 step 5) — the flag is no longer
   read and must be removed from the write side here.

6. **Implement `requestFocus()` from `ICameraFocusTarget`:**
   ```ts
   requestFocus(
     position: readonly [number, number, number],
     target: readonly [number, number, number],
     smooth = true,
   ): void {
     if (this.isInteractionActive && this.driver) {
       this.driver.setLookAt(position as Vec3, target as Vec3, smooth);
     } else if (this.cameraRef) {
       // Promote to pending override so authored camera state does not
       // overwrite the focus on the next apply().
       this._pendingFocusOverride = {
         enabled: true,
         position,
         target,
         up: [this.cameraRef.up.x, this.cameraRef.up.y, this.cameraRef.up.z],
         fov: this.cameraRef.fov,
         near: this.cameraRef.near,
         far: this.cameraRef.far,
       };
     }
   }
   ```

7. **Update `onTick()` to use context fields instead of userData:**
   ```ts
   onTick(context: AnimationTickContext): void {
     const camera = this.cameraRef; // from initialize(), not from scene.userData
     if (!camera) return;
     this.lastTick = context.tick;

     // Drain pending focus override via the typed context callback (no userData bus).
     // context.setCameraOverride is injected by RuntimeDriverImpl (S1 §1.1.D).
     // Calling it stores the override on the driver; the NEXT tick's context.cameraOverride
     // will be populated, which is immediately handled in the override path below.
     if (this._pendingFocusOverride) {
       context.setCameraOverride(this._pendingFocusOverride);
       this._pendingFocusOverride = null;
     }

     // Override path — use typed context.cameraOverride instead of userData:
     const override = context.cameraOverride;
     if (override?.enabled) {
       // ... apply override as before, using override fields
       return;
     }

     // Resolved state path — eliminates manual functional block re-evaluation:
     const state = (context.resolvedState as SceneCamera | undefined) ?? this.defaultState;
     const wantsInteraction = state.interaction?.enabled === true;
     // ... rest of tick logic unchanged, using `state`
   }
   ```
   The manual functional block resolution (lines 228–232 of current file):
   ```ts
   const functionalBlock = context.track?.transitionBlocks?.[tick.sceneIndex];
   const functionalWidget = functionalBlock?.widgetFns[this.widgetId];
   const state = functionalWidget
     ? (functionalWidget.fn(tick.blockProgress) as SceneCamera)
     : ((tick.state.widgets[this.widgetId] as SceneCamera | undefined) ?? this.defaultState);
   ```
   is entirely replaced by `context.resolvedState as SceneCamera | undefined`.

8. **Remove the re-export of `CUSTOM_NODE_HANDLER`** (line 36):
   ```ts
   // REMOVE: export { CUSTOM_NODE_HANDLER };
   ```
   Update `elements/camera/index.ts` to import `CUSTOM_NODE_HANDLER` directly from
   `'../../widget/WidgetRegistry'` rather than routing through `CameraWidget`.

### 3.3 `packages/core/src/player/useSceneEngine.ts`

1. **Remove concrete `CameraWidget` import**, replace with `ICameraHost` type guard:
   ```ts
   // REMOVE:
   import type { CameraWidget } from '../elements/camera/CameraWidget';
   import type { CameraOverrideState } from '../elements/camera/types';

   // ADD (type guard only — no concrete class import):
   import type { ICameraHost } from '../elements/camera/types';
   ```

2. **Add `ICameraHost` type guard** (inline in the file, or import from a new
   `elements/camera/typeGuards.ts` if preferred):
   ```ts
   const isCameraHost = (w: IWidget): w is ICameraHost =>
     typeof (w as ICameraHost).isWheelClaimedByInteraction === 'function';
   ```

3. **Replace direct `cameraWidget.*` calls** with registry-resolved calls:
   ```ts
   // BEFORE:
   const cameraWidget = widgetRegistry.get('camera') as CameraWidget | undefined;
   cameraWidget?.setInteractionDefaults(props.cameraInteractionDefaults);
   // ...
   const wheelClaimed = cameraWidget?.isWheelClaimedByInteraction() ?? false;

   // AFTER:
   // Resolve once after registry construction:
   const cameraHost = [...widgetRegistry.getAllWidgets()].find(isCameraHost) ?? null;
   cameraHost?.setInteractionDefaults(props.cameraInteractionDefaults);
   // ...
   const wheelClaimed = cameraHost?.isWheelClaimedByInteraction() ?? false;
   ```

4. **Remove ALL `scene.userData['__brewsite_*']` writes** — the file has SEVEN such writes
   across two separate `useEffect` blocks. All must be removed:

   ```ts
   // Block 1 — renderer useEffect (lines ~721, ~739):
   // REMOVE: sceneRef.current.userData['__brewsite_renderer'] = renderer;   (line ~721)
   // REMOVE: delete ...userData?.['__brewsite_renderer'];                    (line ~739)

   // Block 2 — camera/scene mount useEffect (lines ~774–813):
   // REMOVE: scene.userData['__brewsite_camera'] = camera;                  (line ~774)
   // REMOVE: scene.userData['__brewsite_renderer'] = rendererRef.current;   (line ~775)
   // REMOVE: scene.userData['__brewsite_camera_override'] = ...;            (line ~777)
   // REMOVE: delete ...userData?.['__brewsite_camera'];                     (line ~811)
   // REMOVE: delete ...userData?.['__brewsite_renderer'];                   (line ~812)
   // REMOVE: delete ...userData?.['__brewsite_camera_override'];            (line ~813)

   // ALSO REMOVE from useSceneEngine — camera override via userData:
   // scene.userData['__brewsite_camera_override'] = next;                   (line ~236)
   // delete ...userData?.['__brewsite_camera_override'];                    (line ~238)
   ```

   **Replacement:** All of the above become a single call:
   ```ts
   // ADD — inject camera/renderer into runtime at initialization time:
   runtimeDriver.initialize(scene, camera, renderer);

   // Camera override path — replace userData write with typed API:
   // BEFORE: scene.userData['__brewsite_camera_override'] = next;
   // AFTER:
   runtimeDriver.setCameraOverride(next ?? null);
   ```

   There must be **zero** `__brewsite_*` keys remaining in `useSceneEngine.ts` after S3.

5. **Export `UseSceneEngineResult` type:**
   ```ts
   /** The full return value of useSceneEngine(). Export allows consumers to type
    * a variable holding the engine object without calling the hook. */
   export type UseSceneEngineResult = ReturnType<typeof useSceneEngine>;
   ```
   Add this to the bottom of `useSceneEngine.ts` after the hook definition.

### 3.4 `packages/core/src/runtime/RuntimeDriver.ts`

**Changes to `RuntimeDriverImpl`:**

1. **Add `initialize(scene, camera, renderer)` method:**
   ```ts
   initialize(
     scene: ThreeScene,
     camera?: THREE.PerspectiveCamera,
     renderer?: WebGLRenderer,
   ): void {
     this.threeScene = scene;
     this.threeCamera = camera ?? null;

     // Resolve ICameraFocusTarget once — CameraWidget is the usual implementor.
     for (const widget of this.widgetRegistry.getAllWidgets()) {
       if (isCameraFocusTarget(widget)) {
         this.cameraFocusTarget = widget;
         break;
       }
     }

     // Initialize all IRenderable widgets (includes CameraWidget, which now implements
     // IRenderable<SceneCamera> with initialize() and a no-op apply() — see S3.2 step 5).
     for (const widget of this.widgetRegistry.getAllWidgets()) {
       if (isRenderable(widget)) {
         widget.initialize({ scene, widgetId: widget.widgetId, renderer, camera });
       }
     }
   }
   ```

2. **Add `setCameraOverride(override: RuntimeCameraOverride | null): void`** to
   `RuntimeDriverImpl` and the `RuntimeDriver` interface:
   ```ts
   setCameraOverride(override: RuntimeCameraOverride | null): void {
     this.cameraOverride = override;
   }
   ```

3. **Add private fields:**
   ```ts
   private threeCamera: THREE.PerspectiveCamera | null = null;
   private cameraFocusTarget: ICameraFocusTarget | null = null;
   private cameraOverride: RuntimeCameraOverride | null = null;
   ```

4. **Populate `resolvedState` per-widget in the tick loop:**
   ```ts
   // In tick() — before dispatching to IAnimationController.onTick():
   for (const controller of this.animationControllers) {
     const resolvedState = this.resolveWidgetState(controller.widgetId, currentTick);
     controller.onTick({
       clock,
       effectiveDeltaSeconds,
       scene: this.threeScene!,
       variables: this.variableStore,
       tick: currentTick,
       track: this.track,
       resolvedState,
       cameraFocusTarget: this.cameraFocusTarget,
       cameraOverride: this.cameraOverride,
       // Injected callback — CameraWidget calls this to promote a focus request to
       // an override without needing a scene.userData bus key (Issue A fix).
       setCameraOverride: (override) => { this.cameraOverride = override; },
     });
   }
   ```

5. **Add `resolveWidgetState(widgetId, tick)` private helper:**
   ```ts
   private resolveWidgetState(widgetId: string, tick: SceneTrackTick | null): unknown {
     if (!tick) return null;
     // Functional path: evaluate closure at blockProgress
     const tBlock = this.track?.transitionBlocks?.[tick.sceneIndex];
     const funcOverride = tBlock?.widgetFns[widgetId];
     if (funcOverride) return funcOverride.fn(tick.blockProgress);
     // Pre-baked path:
     return tick.state.widgets[widgetId] ?? null;
   }
   ```

6. **Add `RuntimeDriver` interface update in `runtime/types.ts`:**
   Add `initialize()` and `setCameraOverride()` to the `RuntimeDriver` interface:
   ```ts
   export type RuntimeDriver = {
     assetsReady: boolean;
     setAssetsReady(ready: boolean): void;
     setSceneTrack(track: SceneTrack): void;
     /** Initialize the runtime with the Three.js scene and optional camera/renderer. */
     initialize(
       scene: ThreeScene,
       camera?: PerspectiveCamera,
       renderer?: WebGLRenderer,
     ): void;
     /** Set or clear the active camera override. Called by useSceneEngine. */
     setCameraOverride(override: RuntimeCameraOverride | null): void;
     tick(options: { deltaSeconds: number; globalProgress: number; deltaProgress: number; wallTimeSeconds?: number }): void;
     collectRenderContributions(): RenderContribution;
     getCurrentTick(): SceneTrackTick | null;
     getWallTimeSeconds(): number;
     dispose(): void;
   };
   ```
   `RuntimeCameraOverride` is imported from `'../widget/types'`.

### 3.5 `packages/diagram/src/elements/diagram/canvas/widget.ts`

1. **Remove** the two `scene.userData` string constants:
   ```ts
   // REMOVE:
   const CAMERA_KEY = '__brewsite_camera';
   const CAMERA_FOCUS_KEY = '__brewsite_camera_focus';
   ```

2. **Remove** the `setSceneLightEnabled` import:
   ```ts
   // REMOVE:
   import { setSceneLightEnabled } from '@brewsite/core';
   ```

3. **Implement `ILightingOverride`** (interface added in S1):
   ```ts
   import type { ILightingOverride } from '@brewsite/core';

   export class DiagramCanvasWidget
     implements ISceneElement<DiagramCanvasState>, IRenderable<DiagramCanvasState>,
                IAnimationController, IInputDefaultProvider, INVSBounded,
                ILightingOverride  // ADD
   {
     private _lightController: ((lightId: string, enabled: boolean) => void) | null = null;

     getLightingOverride(): { disableAll: boolean } | null {
       return this.diagramIsActive ? { disableAll: true } : null;
     }

     /**
      * ILightingOverride.receiveLightController — stores the per-light setter injected
      * by LightingWidget during configureRegistry. Used by createHoverControls() so
      * that DiagramHoverControls.setLightEnabled() can toggle individual core lights
      * during node hover interactions without calling setSceneLightEnabled() directly.
      */
     receiveLightController(setter: (lightId: string, enabled: boolean) => void): void {
       this._lightController = setter;
     }
   }
   ```
   Where `this.diagramIsActive` is a boolean field set in `apply()` based on whether the
   diagram canvas is rendered this frame.

   **Update `createHoverControls()`** to use the injected setter instead of `setSceneLightEnabled`:
   ```ts
   // canvas/widget.ts createHoverControls():
   setLightEnabled: (lightId, enabled) => {
     this._lightController?.(lightId, enabled); // was: setSceneLightEnabled(this.scene!, lightId, enabled)
   },
   ```

4. **Replace `scene.userData[CAMERA_FOCUS_KEY]` write** with `context.cameraFocusTarget`:
   ```ts
   // BEFORE:
   context.scene.userData[CAMERA_FOCUS_KEY] = { position, target, smooth };

   // AFTER:
   context.cameraFocusTarget?.requestFocus(position, target, smooth);
   ```

5. **Replace `context.scene.userData[CAMERA_KEY]` check** for "camera is active":
   ```ts
   // BEFORE:
   const cameraIsActive = !!context.scene.userData[CAMERA_KEY];

   // AFTER:
   const cameraIsActive = context.cameraFocusTarget !== null;
   ```

### 3.6 `packages/diagram/src/elements/diagram/canvas/render.ts`

This file reads `scene.userData['__brewsite_camera']` directly at line 33, outside the widget
lifecycle. It is called by `DiagramCanvasWidget` (S3.5) which already saves the camera in
`initialize()`.

**Change:** Remove the direct `scene.userData` read. Instead, the render function must receive
the camera as an explicit parameter passed in from `DiagramCanvasWidget`.

```ts
// BEFORE (line 33):
const cam = scene.userData['__brewsite_camera'] as THREE.PerspectiveCamera | undefined;

// AFTER — add `camera?: THREE.PerspectiveCamera` param to the affected render function(s).
// DiagramCanvasWidget calls these functions with `this.cameraRef` from initialize().
export function renderDiagramScene(
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  // ... existing params
): void {
  // use `camera` directly, no userData read
}
```

Identify every render function in this file that reads `scene.userData['__brewsite_camera']`
and update each one to accept `camera` as an explicit parameter. Update call sites in
`DiagramCanvasWidget.apply()` / `onTick()` to pass `this.cameraRef`.

### 3.7 `packages/diagram/src/elements/diagram/widget.ts`

This file has TWO issues: camera reads AND a `setSceneLightEnabled` call.

**Camera reads — 3 locations (lines 147, 272, 304):**

```ts
// BEFORE:
const CAMERA_KEY = '__brewsite_camera'; // line 39
const cam = context.scene.userData[CAMERA_KEY] as THREE.PerspectiveCamera | undefined; // lines 147,272,304

// AFTER: add private field, populate in initialize():
private cameraRef: THREE.PerspectiveCamera | null = null;

initialize(context: WidgetInitContext): void {
  if (context.camera) this.cameraRef = context.camera;
  // existing initialize logic...
}
```

Replace all three `scene.userData[CAMERA_KEY]` reads with `this.cameraRef`. Remove the
`CAMERA_KEY` constant at line 39.

**`setSceneLightEnabled` call — line 372 (per-light hover control, NOT disableAll):**

**CORRECTION from original plan:** The `setSceneLightEnabled` call is NOT in `apply()` and is
NOT a "disable all lights when diagram is active" pattern. It lives inside
`createHoverControls()` which builds a `DiagramHoverControls` callback object passed to
interaction handlers. Scene authors call `event.controls.setLightEnabled('spotlight-1', false)`
to toggle individual lights during node hover events. This requires per-light granularity —
`ILightingOverride { disableAll }` alone is insufficient.

**Migration: implement `ILightingOverride` with `receiveLightController`:**

```ts
// BEFORE:
import { setSceneLightEnabled } from '@brewsite/core'; // line 14
// In createHoverControls():
setLightEnabled: (lightId, enabled) => {
  if (!this.scene) return;
  setSceneLightEnabled(this.scene, lightId, enabled); // line 372
},

// AFTER:
import type { ILightingOverride } from '@brewsite/core';

export class DiagramWidget
  implements ISceneElement<DiagramState>, IRenderable<DiagramState>,
             IAnimationController, ILightingOverride  // ADD
{
  private _lightController: ((lightId: string, enabled: boolean) => void) | null = null;

  /**
   * ILightingOverride.getLightingOverride — DiagramWidget does not suppress all
   * lights (it is not a full-screen canvas). Returns null — only the per-light
   * setter matters here.
   */
  getLightingOverride(): { disableAll: boolean } | null {
    return null;
  }

  /**
   * ILightingOverride.receiveLightController — stores the per-light setter injected
   * by LightingWidget during configureRegistry so createHoverControls can use it.
   */
  receiveLightController(setter: (lightId: string, enabled: boolean) => void): void {
    this._lightController = setter;
  }
}
```

**Update `createHoverControls()`:**
```ts
// In createHoverControls():
setLightEnabled: (lightId, enabled) => {
  this._lightController?.(lightId, enabled); // was: setSceneLightEnabled(this.scene, lightId, enabled)
},
```

Remove the `setSceneLightEnabled` import at line 14. `DiagramWidget` now implements
`ILightingOverride` solely to participate in the `receiveLightController` injection from
`LightingWidget`. Its `getLightingOverride()` returns `null` — it does not suppress all lights.

### 3.8 `packages/diagram/src/elements/image-panel/widget.ts`

Camera read at line 38: `const cam = this.scene.userData[CAMERA_KEY] as THREE.PerspectiveCamera | undefined;`

**Pattern** (identical to diagram/widget.ts):
```ts
// BEFORE:
const CAMERA_KEY = '__brewsite_camera'; // line 12

// AFTER: add field + initialize():
private cameraRef: THREE.PerspectiveCamera | null = null;

initialize(context: WidgetInitContext): void {
  if (context.camera) this.cameraRef = context.camera;
}
```

Replace the userData read at line 38 with `this.cameraRef`. Remove the `CAMERA_KEY` constant.

`ImagePanelWidget` must implement `IRenderable<ImagePanelState>` (add `initialize()` to the
class if not already present; it likely already has `apply()` and `dispose()`).

### 3.9 `packages/diagram/src/elements/screen/widget.ts`

Camera read at line 39: identical pattern to `image-panel/widget.ts` above.

Apply the same change: add `cameraRef`, populate in `initialize()`, replace `scene.userData`
read at line 39. Remove the `CAMERA_KEY` constant at line 13.

### 3.10 `packages/charts/src/elements/chart/ChartWidget.ts`

**Three camera reads (lines 106, 132, 177):**

```ts
// BEFORE:
import { SCENE_CAMERA_KEY } from '@brewsite/core'; // line 11
const cam = (this.scene.userData as Record<string, unknown>)[SCENE_CAMERA_KEY]; // lines 106,132,177
// Comment at line 176: "Camera is stored on scene.userData by CameraWidget"

// AFTER:
private cameraRef: THREE.PerspectiveCamera | null = null;

initialize(context: WidgetInitContext): void {
  if (context.camera) this.cameraRef = context.camera;
  // existing initialize logic...
}
```

Replace all three `scene.userData[SCENE_CAMERA_KEY]` reads with `this.cameraRef`.

`ChartWidget` must already implement `IRenderable` (it has `apply()` and `dispose()`). Confirm
it has an `initialize()` method — if not, add one. Remove the `SCENE_CAMERA_KEY` import.

The `SCENE_CAMERA_KEY` import from `@brewsite/core` can be removed entirely once the userData
pattern is eliminated. If `SCENE_CAMERA_KEY` is still needed for S6 reasons elsewhere in the
file, check — but the three camera-access uses are all replaced by `this.cameraRef`.

### Stream 3 — Breaking Changes

| Change | Impact | Semver |
|---|---|---|
| `scene.userData.__brewsite_*` keys removed | Any direct consumer reading these breaks. 5 downstream files in `@brewsite/diagram` and 1 in `@brewsite/charts` are migrated in this same stream. | **Major** (undocumented internal) |
| `CameraWidget` now implements `IRenderable<SceneCamera>` | No consumer-visible change; `initialize()` + no-op `apply()` added | None |
| `CameraWidget` no longer exported for use as a concrete type in `useSceneEngine` | Internal only; consumer-facing API unchanged | None |
| `AnimationTickContext` gains `resolvedState`, `cameraFocusTarget`, `cameraOverride` | Non-breaking additions (new required fields may break consumers who create `AnimationTickContext` directly — check mocks) | Minor |
| `RuntimeDriver` interface gains `initialize()` and `setCameraOverride()` | Any custom `RuntimeDriver` implementation must add these methods | **Major** (rare) |
| `setSceneLightEnabled` removed from `@brewsite/core` barrel (S2) | Both `canvas/widget.ts` (all-or-nothing suppression via `getLightingOverride()`) and `diagram/widget.ts` (per-light hover control via `receiveLightController?`) implement `ILightingOverride` — (S3.5, S3.7) | **Major** |

### Stream 3 — Test Strategy

- **`packages/core/src/elements/camera/__tests__/CameraWidget.test.ts`** — update:
  1. Replace all `context.scene.userData['__brewsite_*']` setup with typed context fields.
  2. Test `initialize({ scene, camera: mockCamera, renderer: mockRenderer })` — verify
     `this.cameraRef` is populated.
  3. Test `requestFocus([0,0,0], [1,0,0])` — when interaction active: verify
     `driver.setLookAt()` was called; when not active: verify `_pendingFocusOverride` set.
  4. Test `onTick()` with `context.resolvedState` populated — verify it uses the resolved
     state rather than manually evaluating the closure.
  5. Test `onTick()` with `context.cameraOverride.enabled = true` — verify applyCamera is
     called with override values.

- **`packages/core/src/runtime/__tests__/RuntimeDriver.test.ts`** — update:
  1. Test `setCameraOverride()` — verify the override appears in the `AnimationTickContext`
     passed to the next `onTick()` call.
  2. Test `resolveWidgetState()` — verify functional block closures are evaluated correctly.
  3. Test `cameraFocusTarget` injection — register a widget implementing `ICameraFocusTarget`,
     call `initialize()`, verify `context.cameraFocusTarget` points to it.

- **`packages/diagram/src/elements/diagram/canvas/__tests__/functionalTransitionSpec.test.ts`**
  — update: replace userData spy pattern with `context.cameraFocusTarget` mock.

- **`packages/diagram/src/elements/diagram/__tests__/DiagramWidget.test.ts`** — add:
  1. `initialize({ camera: mockCamera })` → `this.cameraRef` set; no userData read in `apply()`.
  2. `getLightingOverride()` returns `{ disableAll: true }` when diagram is active, `null` when not.

- **`packages/charts/src/elements/chart/__tests__/ChartWidget.test.ts`** — add:
  1. `initialize({ camera: mockCamera })` → subsequent `apply()` calls use `this.cameraRef`
     rather than reading `scene.userData`.
  2. Verify no `scene.userData` access after `initialize()` runs.

---

## Stream 4 — Compiler Internals & Registry

**Findings:** 3 (manifestUrl), 12 (implementation), 14 (implementation), 17 (freeze()), 27 (routing dedup)
**Depends on:** Stream 1

### 4.1 `packages/core/src/compiler/sceneTrackCompiler.ts`

#### A. Replace duck-typed `useDefaultStateWhenAbsent` with `disableWhenAbsent`

In `compileSceneTrack`, lines 441–442 (Step 3, per-widget loop):
```ts
// BEFORE (duck-typed cast):
const useDefaultWhenAbsent =
  (widget as { useDefaultStateWhenAbsent?: boolean }).useDefaultStateWhenAbsent !== false;
const absentDefault = useDefaultWhenAbsent ? defaultState : makeDisabledDefault(defaultState);

// AFTER (typed interface field from ISceneElement):
const absentDefault = widget.disableWhenAbsent === true
  ? makeDisabledDefault(defaultState)
  : defaultState;
```

Apply the identical replacement in **Step 4** (terminal frame fill, lines 549–553).

#### B. Use `ISceneElement.stateEquals` in delta detection

Replace `buildDelta()` with a version that accepts a per-widget equality function map:

```ts
type WidgetEqualsFnMap = Map<string, (a: unknown, b: unknown) => boolean>;

const buildDelta = (
  prev: SceneFrame | undefined,
  next: SceneFrame,
  equalsFns: WidgetEqualsFnMap,
): SceneFrameDelta => {
  if (!prev) return { widgets: next.widgets };
  if (serialize(prev.widgets) === serialize(next.widgets)) return {};

  // Per-widget equality for widgets that provide stateEquals():
  const prevWidgets = prev.widgets;
  const nextWidgets = next.widgets;
  const allIds = new Set([...Object.keys(prevWidgets), ...Object.keys(nextWidgets)]);
  let changed = false;
  for (const id of allIds) {
    const fn = equalsFns.get(id);
    if (fn) {
      const a = prevWidgets[id];
      const b = nextWidgets[id];
      if (a !== undefined && b !== undefined && !fn(a, b)) { changed = true; break; }
      if ((a === undefined) !== (b === undefined)) { changed = true; break; }
    } else {
      if (serialize(prevWidgets[id]) !== serialize(nextWidgets[id])) { changed = true; break; }
    }
  }
  return changed ? { widgets: nextWidgets } : {};
};
```

Build the `equalsFns` map once at the top of `compileSceneTrack`:
```ts
const widgetEqualsFns: WidgetEqualsFnMap = new Map();
for (const widget of widgetRegistry.getSceneElements()) {
  if (widget.stateEquals) {
    const eq = widget.stateEquals.bind(widget);
    widgetEqualsFns.set(widget.widgetId, (a, b) => eq(a as never, b as never));
  }
}
```

#### C. Rename `sceneProgress` → `blockProgress` in `compileExtra()` call (Step 5)

```ts
// BEFORE:
extras[widget.widgetId] = widget.compileExtra(state as never, {
  sceneProgress: frame.blockProgress,
  globalProgress: frame.progress,
  prefersReducedMotion: options.prefersReducedMotion ?? false,
});

// AFTER:
extras[widget.widgetId] = widget.compileExtra(state as never, {
  blockProgress: frame.blockProgress,  // renamed to match CompileExtraContext field
  globalProgress: frame.progress,
  prefersReducedMotion: options.prefersReducedMotion ?? false,
});
```

### 4.2 `packages/core/src/player/EngineProvider.tsx`

**Change: Make `manifestUrl` optional, remove model-domain validation**

1. In `EngineProviderProps`, change `manifestUrl: string` → `manifestUrl?: string`:
   ```ts
   /**
    * URL of the asset manifest JSON file.
    * @deprecated Pass manifestUrl directly to modelPlugin() instead.
    * EngineProvider should not need model-specific configuration.
    * This field will be removed in a future major release.
    */
   manifestUrl?: string;
   ```

2. In the manifest-fetch `useEffect`, guard on `props.manifestUrl`:
   ```ts
   useEffect(() => {
     if (!props.manifestUrl) return; // no manifest → skip fetch
     let cancelled = false;
     fetch(props.manifestUrl)
       .then((r) => r.json())
       .then((raw) => {
         if (cancelled) return;
         // Remove the model-domain validation: `!Array.isArray(m['models'])`.
         // Model plugin handles its own manifest validation in configureRegistry().
         setManifest(raw as AssetManifest);
       })
       .catch((e: unknown) => {
         if (cancelled) return;
         const err = e instanceof Error ? e : new Error(String(e));
         props.onError?.(err);
         props.onManifestError?.(err);
       });
     return () => { cancelled = true; };
   }, [props.manifestUrl]);
   ```

### 4.3 `packages/core/src/widget/WidgetRegistry.ts`

#### A. Add `freeze()` method

```ts
private frozen = false;

/**
 * Finalises the widget list and makes registration immutable.
 *
 * Call immediately before RuntimeDriverImpl.initialize() to enforce the widget
 * registration ordering contract. Once frozen, any call to register() or
 * registerTypeFactory() throws a descriptive error.
 *
 * Motivation: ChartWidgets are currently registered inside DSL node handlers
 * (which run during compileSceneTrack), after the driver is constructed.
 * freeze() makes this footgun explicit and surfaceable at development time.
 */
freeze(): void {
  this.frozen = true;
}
```

Add frozen checks to `register()` and `registerTypeFactory()`:
```ts
register(widget: IWidget): this {
  if (this.frozen) {
    throw new Error(
      `[WidgetRegistry] Cannot register widget "${widget.widgetId}" after freeze() ` +
      `has been called. Ensure all widgets are registered before compileSceneTrack().`,
    );
  }
  // ... existing logic
}

registerTypeFactory(component: unknown, factory: ...): this {
  if (this.frozen) {
    throw new Error(
      `[WidgetRegistry] Cannot registerTypeFactory after freeze() has been called.`,
    );
  }
  // ... existing logic
}
```

#### B. Extract `dispatchToWidget()` helper

The ~80-line routing logic duplicated between `register()` and `registerTypeFactory()` is
extracted to a private method:

```ts
private dispatchToWidget(
  node: ReactElement,
  api: CompileApi,
  helpers: CompileHelpers,
  widgetId: string,
  getOrCreateWidget: (props: Record<string, unknown>) => IWidget | undefined,
): void {
  const widget = getOrCreateWidget(node.props as Record<string, unknown>);
  if (!widget) return;

  if (hasCustomDslHandler(widget)) {
    widget[CUSTOM_NODE_HANDLER](node, api, helpers);
    return;
  }

  // Default: shallow-merge DSL props into widget state slot.
  const props = node.props as Record<string, unknown>;
  const resolved = helpers.resolveObjectValues(
    helpers.stripUndefinedDeep(props as Record<string, unknown>),
    api.context,
  );
  api.setWidgetState(widgetId, { ...(api.state.widgets[widgetId] as object ?? {}), ...resolved });
}
```

Both `register()` and `registerTypeFactory()` call `dispatchToWidget()` instead of
duplicating the routing logic inline.

#### C. Add type guards for new interfaces

```ts
import type { ICameraFocusTarget, ILightingOverride } from './types';

/** Type guard: returns true if widget implements ICameraFocusTarget. */
export const isCameraFocusTarget = (w: IWidget): w is ICameraFocusTarget =>
  typeof (w as ICameraFocusTarget).requestFocus === 'function';

/** Type guard: returns true if widget implements ILightingOverride. */
export const isLightingOverride = (w: IWidget): w is ILightingOverride =>
  typeof (w as ILightingOverride).getLightingOverride === 'function';
```

Export both type guards from `widget/index.ts`.

#### D. Add `getAllWidgets()` method

```ts
/** Returns all registered widgets as an iterable. Used by RuntimeDriverImpl
 *  and plugin factories to resolve interface implementors after construction. */
getAllWidgets(): IterableIterator<IWidget> {
  return this.widgets.values();
}
```

### 4.4 `packages/core/src/player/plugins.ts`

**Change: Wire ILightingOverride into LightingWidget after registry construction**

```ts
export const corePlugin = (options: CorePluginOptions = {}): WidgetPlugin => {
  const lightingWidget = new LightingWidget();
  const backgroundWidget = new BackgroundWidget();
  const environmentWidget = new EnvironmentWidget();
  const floorWidget = new FloorWidget();
  const cameraWidget = new CameraWidget();
  const sceneMetaWidget = new SceneMetaWidget(options.onSceneChange);

  return {
    registerHandlers() { registerCoreHandlers(); },

    createWidgets() {
      return [lightingWidget, backgroundWidget, environmentWidget,
              floorWidget, cameraWidget, sceneMetaWidget];
    },

    configureRegistry(reg) {
      // Resolve ILightingOverride widgets registered by other plugins (e.g. diagram).
      // Called after all plugins' createWidgets() have run.
      const overrideWidgets = [...reg.getAllWidgets()].filter(isLightingOverride);
      lightingWidget.setLightingOverrides(overrideWidgets);
    },
  };
};
```

### Stream 4 — Breaking Changes

| Change | Semver |
|---|---|
| `EngineProvider.manifestUrl` optional (was required) | Source-compatible; existing code unchanged | None |
| Remove model-specific manifest validation from EngineProvider | Behaviour change: invalid manifests no longer throw early | Minor |
| `WidgetRegistry.freeze()` — new method | Additive | None |
| `sceneProgress` → `blockProgress` in `compileExtra()` (compiles against S1 type change) | Compilation break for any `compileExtra` implementor | **Major** |
| Remove `useDefaultStateWhenAbsent` duck-typed cast | Internal; widgets with `disableWhenAbsent = true` continue to work | None |

### Stream 4 — @brewsite/model Migration

**`packages/model/src/elements/model/ModelWidget.ts:378`** — rename field:

```ts
// BEFORE:
readonly useDefaultStateWhenAbsent = false;

// AFTER:
readonly disableWhenAbsent = true;
```

**Note on value flip:** The old field was `useDefaultStateWhenAbsent = false` (meaning "do not
use the default state when absent" = disable the widget when absent). The new field is
`disableWhenAbsent = true` (meaning "disable when absent"). Both express the same intent.
The compiler check changes from `widget.useDefaultStateWhenAbsent !== false` to
`widget.disableWhenAbsent === true` (S4.1.A). This rename MUST ship in the same PR as S4 —
if `ModelWidget` still has `useDefaultStateWhenAbsent` after S4 merges, ModelWidget will
silently lose its disable-when-absent behaviour with no compile error.

### Stream 4 — Test Strategy

- **`packages/core/src/widget/__tests__/WidgetRegistry.test.ts`** — add:
  1. `freeze()` → subsequent `register()` throws with descriptive message.
  2. `dispatchToWidget()` regression: before and after refactor produce identical
     `CompileApi.state.widgets` mutations for the same input DSL node.
  3. `isCameraFocusTarget` type guard correctly identifies implementors.
  4. `isLightingOverride` type guard correctly identifies implementors.

- **`packages/core/src/compiler/__tests__/sceneTrackCompiler.test.ts`** — add:
  1. Widget with `disableWhenAbsent = true` → absent scenes get disabled default.
  2. Widget with `stateEquals()` → verify it is called during delta detection.
  3. `compileExtra()` called with `blockProgress` (not `sceneProgress`).

- **Rename in existing tests (same PR as S4):**
  - `packages/core/src/compiler/__tests__/sceneTrackCompiler.test.ts` lines 265, 276, 381:
    rename `useDefaultStateWhenAbsent: false` → `disableWhenAbsent: true` in all test
    fixtures. These will produce TypeScript errors after S1 removes the old field name,
    catching the regression before merge.

---

## Stream 5 — Input System & Lighting Abstraction

**Findings:** 4 (ILightingOverride — LightingWidget side), 11 (diagram-canvas.* actions)
**Depends on:**
- S5.1–5.3b: S5.1–5.2 are independent; S5.3a–S5.3b depend on S5.1–5.2 for the
  updated `ActionInputHandler` type (with `onUnknownAction`) — start these after S5.1 merges.
  S5.3a adds a method to `WidgetPlugin.ts` which is in core — no other stream dependency.
- **S5.5 (LightingWidget): blocked by S1** (for `ILightingOverride` type) **and S4.4** (for
  `corePlugin.configureRegistry()` wiring). Do NOT start S5.5 until both are merged.

Developers can begin S5.1–S5.3b immediately. S5.4 (diagram/canvas/defaultInputActions.ts) is
independent. S5.5 must wait.

### 5.1 `packages/core/src/input/types.ts`

**Make `InputActionType` an open string union:**

```ts
/**
 * Core-defined action types for the ActionInputController.
 *
 * `(string & {})` extends the union to accept any string literal, allowing
 * downstream packages (@brewsite/diagram) to define their own action types
 * (e.g. 'diagram-canvas.move') without modifying core.
 *
 * The diagram-canvas.* types that previously lived here have been removed;
 * they are now string literals owned by @brewsite/diagram.
 */
export type InputActionType =
  | 'camera.orbit'
  | 'camera.dolly'
  | 'camera.reset'
  | 'canvas.pan'
  | 'scene.next'
  | 'scene.prev'
  | (string & {}); // open union — allows downstream extension
```

**Remove `diagram-canvas.*` from `ActionInputHandler`:**

```ts
// BEFORE:
export type ActionInputHandler = {
  getSceneCount: () => number;
  onSceneStep: (direction: 1 | -1, stepScenes: number) => void;
  onCameraOrbit: (cameraId: string, dx: number, dy: number, speed: number) => void;
  onCameraDolly: (cameraId: string, delta: number, speed: number) => void;
  onCameraReset: (cameraId: string) => void;
  onDiagramCanvasMove: (canvasId: string, dx: number, dy: number, speed: number) => void;
  onDiagramCanvasRotate: (canvasId: string, dx: number, dy: number, speed: number) => void;
  onDiagramCanvasReset: (canvasId: string) => void;
  onDiagramCanvasFocus: (
    canvasId: string, clientX: number, clientY: number,
    focusCenter?: [number, number] | [number, number, number],
  ) => void;
};

// AFTER:
export type ActionInputHandler = {
  getSceneCount: () => number;
  onSceneStep: (direction: 1 | -1, stepScenes: number) => void;
  onCameraOrbit: (cameraId: string, dx: number, dy: number, speed: number) => void;
  onCameraDolly: (cameraId: string, delta: number, speed: number) => void;
  onCameraReset: (cameraId: string) => void;
  /**
   * Dispatches an action type not handled by core to any registered extension handler.
   * @brewsite/diagram provides its diagram-canvas.* handling via this callback.
   *
   * @param type      - The action type string (e.g. 'diagram-canvas.move').
   * @param canvasId  - The target canvas widget ID (from action.canvasId).
   * @param event     - The originating DOM event.
   * @param extra     - Additional action-spec fields (speed, focusCenter, etc.).
   */
  onUnknownAction?: (
    type: string,
    canvasId: string | undefined,
    event: PointerEvent | WheelEvent | KeyboardEvent | MouseEvent,
    extra: Record<string, unknown>,
  ) => void;
};
```

### 5.2 `packages/core/src/input/ActionInputController.ts`

**Remove dispatch cases for `diagram-canvas.*` and `canvas.pan`.**

In every pointer/wheel/key dispatch switch statement, remove:
```ts
// REMOVE all cases:
case 'diagram-canvas.move':
case 'diagram-canvas.rotate':
case 'diagram-canvas.reset':
case 'diagram-canvas.focus':
case 'canvas.pan': // undocumented alias — also remove
```

For each removed case, replace with a call to `handler.onUnknownAction?.()`:
```ts
default:
  handler.onUnknownAction?.(action.type, action.canvasId, event, {
    speed: action.speed,
    focusCenter: action.focusCenter,
    // include axis, stepScenes etc. as relevant
  });
  break;
```

Remove `warnedLegacyCameraId` and `warnedLegacyCanvasId` warn paths for
`LEGACY_CANVAS_ID = 'llm-canvas'` if they were only used for diagram-canvas dispatch.

### 5.3a `packages/core/src/widget/WidgetPlugin.ts` — Add `getActionInputExtension`

The PM correctly identified that the previous plan's reference to `diagramPlugin.wrapProvider()`
was wrong — `wrapProvider` is for React context providers, not for action handler extension.
The correct mechanism is a new optional method on `WidgetPlugin`.

**Add to `WidgetPlugin` interface:**

```ts
/**
 * Optional: returns extensions to the ActionInputHandler passed to ActionInputController.
 * Called by useSceneEngine after all plugins are initialized and the WidgetRegistry is
 * constructed. The returned partial is merged into the handler passed to useEngineInput.
 *
 * Use this to provide `onUnknownAction` handling for action types not built into core.
 * @brewsite/diagram uses this to handle 'diagram-canvas.*' action types.
 */
getActionInputExtension?(
  registry: WidgetRegistry,
): Partial<Pick<ActionInputHandler, 'onUnknownAction'>>;
```

This method is called once in `useSceneEngine.ts` (see S3.3 wiring) with the fully-populated
registry. The returned partial is merged into the `ActionInputHandler` callbacks passed to
`useEngineInput`.

**In `useSceneEngine.ts` (add to S3.3 change list):**

```ts
// Collect onUnknownAction from all plugins that provide it.
// Merge: last plugin wins per action type (plugins should own disjoint type namespaces).
const pluginActionExtensions: Partial<Pick<ActionInputHandler, 'onUnknownAction'>> =
  options.plugins
    .map(p => p.getActionInputExtension?.(options.widgetRegistry) ?? {})
    .reduce((acc, ext) => ({ ...acc, ...ext }), {});

// Pass to useEngineInput (replaces the removed onDiagramCanvas* callbacks):
const inputHandlerCallbacks: ActionInputHandler = {
  getSceneCount: () => options.scenes.length,
  onSceneStep: handleSceneStep,
  onCameraOrbit: handleCameraOrbit,
  onCameraDolly: handleCameraDolly,
  onCameraReset: handleCameraReset,
  onUnknownAction: pluginActionExtensions.onUnknownAction,
};
```

### 5.3b `packages/diagram/src/player/diagramPlugin.ts` — Implement `getActionInputExtension`

**Add to the object returned by `diagramPlugin()`:**

```ts
getActionInputExtension(registry: WidgetRegistry): Partial<Pick<ActionInputHandler, 'onUnknownAction'>> {
  return {
    onUnknownAction: (type, canvasId, event, extra) => {
      const canvas = canvasId
        ? (registry.get(canvasId) as DiagramCanvasWidget | undefined)
        : undefined;
      if (!canvas) return;

      switch (type) {
        case 'diagram-canvas.move':
          canvas.handleMove(event as PointerEvent, extra.speed as number | undefined);
          break;
        case 'diagram-canvas.rotate':
          canvas.handleRotate(event as PointerEvent, extra.speed as number | undefined);
          break;
        case 'diagram-canvas.reset':
          canvas.handleReset();
          break;
        case 'diagram-canvas.focus':
          canvas.handleFocus(
            event as PointerEvent,
            extra.focusCenter as [number, number] | [number, number, number] | undefined,
          );
          break;
      }
    },
  };
},
```

`registry.get(canvasId)` works because `DiagramCanvasWidget` instances are registered in
`createWidgets()` before `getActionInputExtension()` is called by `useSceneEngine`.

**Remove** the `handleDiagramCanvasMove`, `handleDiagramCanvasRotate`, `handleDiagramCanvasReset`,
`handleDiagramCanvasFocus` handlers from `useSceneEngine.ts` (currently lines 627–630). These
are replaced by the `onUnknownAction` path routed through `diagramPlugin.getActionInputExtension()`.

### 5.4 `packages/diagram/src/elements/diagram/canvas/defaultInputActions.ts`

The action type strings ('diagram-canvas.move' etc.) remain unchanged. Update any TypeScript
type assertions to use the open `InputActionType` union:

```ts
// No type assertion needed — 'diagram-canvas.move' is assignable to InputActionType
// via the (string & {}) member.
export const defaultDiagramInputActions: InputActionSpec[] = [
  { id: 'diagram-move', type: 'diagram-canvas.move', /* ... */ },
  { id: 'diagram-rotate', type: 'diagram-canvas.rotate', /* ... */ },
  { id: 'diagram-reset', type: 'diagram-canvas.reset', /* ... */ },
  { id: 'diagram-focus', type: 'diagram-canvas.focus', /* ... */ },
];
```

No structural changes needed.

### 5.5 `packages/core/src/elements/lighting/LightingWidget.ts`

**Add `setLightingOverrides()` method and apply check:**

```ts
private lightingOverrideWidgets: ILightingOverride[] = [];

/**
 * Called by corePlugin.configureRegistry() after all plugins' createWidgets() have run.
 * Does two things:
 * 1. Stores the ILightingOverride list for per-frame getLightingOverride() checks.
 * 2. Injects the per-light setter into any widget that implements receiveLightController?().
 *    This enables DiagramWidget / DiagramCanvasWidget hover callbacks to toggle individual
 *    core lights without importing setSceneLightEnabled() directly.
 */
setLightingOverrides(overrides: ILightingOverride[]): void {
  this.lightingOverrideWidgets = overrides;
  const setter = this.setLightEnabled.bind(this);
  for (const w of overrides) {
    w.receiveLightController?.(setter);
  }
}

/**
 * Per-light control entry point. Called via the injected setter in hover callbacks.
 * Applies a Three.js light enable/disable by light ID (existing logic from
 * setSceneLightEnabled, now owned by LightingWidget instead of a barrel function).
 */
private setLightEnabled(lightId: string, enabled: boolean): void {
  // Find the light by ID in the scene and set its visible/intensity state.
  // Mirrors the logic previously in setSceneLightEnabled() from render.ts.
  const light = this.scene?.getObjectByName(lightId);
  if (light) light.visible = enabled;
}

apply(state: SceneLighting, context: WidgetRenderContext): void {
  // Check if any peer widget is requesting full lighting suppression.
  // DiagramCanvasWidget returns { disableAll: true } when its canvas is active.
  const anyDisableAll = this.lightingOverrideWidgets.some(
    (w) => w.getLightingOverride()?.disableAll === true,
  );
  if (anyDisableAll) return; // skip all Three.js light updates this frame

  applyLighting(state, { scene: this.scene! });
}
```

**Note on `setLightEnabled` implementation:** The implementor must verify the exact mechanism
`setSceneLightEnabled()` uses to locate and disable lights (whether by `light.name`, a custom
`userData` property, or a scene-global light registry). Read `elements/lighting/render.ts`
to extract the exact logic before implementing `LightingWidget.setLightEnabled()`. The plan
intentionally uses `scene.getObjectByName(lightId)` as a placeholder — the actual lookup must
match the existing `setSceneLightEnabled` behaviour exactly.

### Stream 5 — Breaking Changes

| Change | Semver |
|---|---|
| `InputActionType` loses `diagram-canvas.*` as named members | String literals remain valid via `(string & {})` — any code comparing them still works | Minor |
| `ActionInputHandler` loses `onDiagramCanvas*` methods | Any custom `ActionInputHandler` that implements these must remove them | **Major** (if any consumer implements `ActionInputHandler` directly) |
| `setSceneLightEnabled` removed from public barrel (Stream 2) | `@brewsite/diagram` sole caller migrated to `ILightingOverride` (this stream) | **Major** (internal only) |

### Stream 5 — @brewsite/diagram Migration

| Old | New |
|---|---|
| `import { setSceneLightEnabled } from '@brewsite/core'` | Removed; `canvas/widget.ts` uses `ILightingOverride.getLightingOverride()` for all-or-nothing suppression; `diagram/widget.ts` uses `ILightingOverride.receiveLightController?()` for per-light hover control. Both done in S3. |
| `onDiagramCanvas*` in `ActionInputHandler` | Provide `onUnknownAction` callback in `diagramPlugin.ts` |

### Stream 5 — Test Strategy

- **`packages/core/src/input/__tests__/ActionInputController.test.ts`** — update:
  1. `'diagram-canvas.move'` action invokes `handler.onUnknownAction` with correct args.
  2. `'camera.orbit'` still routes to `handler.onCameraOrbit`.
  3. `'scene.next'` still routes to `handler.onSceneStep`.

- **`packages/diagram/src/player/__tests__/diagramPlugin.test.ts`** — add:
  1. `onUnknownAction('diagram-canvas.move', canvasId, event, { speed: 1 })` → correct canvas method called.
  2. Unknown canvas ID → no-op, no error thrown.

---

## Stream 6 — Infrastructure, Dead Code & Documentation

**Findings:** 9, 10, 13 (partial), 19, 21, 22, 23, 24, 25, 26
**Depends on:** Nothing (runs in parallel from day one)

### 6.1 Move AnimeJS HUD Presets to `apps/examples/`

**Delete from `packages/core/src/hud/animejs/`:**
- `transitions.tsx` — Fade, MidFade, SlideUp, SlideDown, ScrollOn, ScrollOff
- `useScrollTimeline.ts`
- `index.ts`
- `__tests__/transitions.test.tsx`
- `__tests__/useScrollTimeline.test.tsx`

**Delete from `packages/core/src/types/`:**
- `animejs.d.ts`

**Copy to `apps/examples/src/widgets/hud-animejs/`:**
- `transitions.tsx` (unchanged)
- `useScrollTimeline.ts` (unchanged; update import from `@brewsite/core/hud/animejs` → local)
- `index.ts` (re-export)

**Update `packages/core/package.json`:**
```json
{
  "dependencies": {
    // REMOVE "animejs": "..."
  }
}
```

**Note:** `hud/animejs/index.ts` is NOT re-exported from `hud/index.ts` (confirmed by the
barrel's own comment). Any consumer importing `@brewsite/core/hud/animejs` directly will
get a build error after this change. Document in CHANGELOG.

### 6.2 Dev Tools Subpath Export

**Create `packages/core/src/player/devtools.ts`:**
```ts
// @brewsite/core/devtools — internal development and debugging tools.
// These components are NOT part of the stable public API and may change between minor releases.
export { CameraControlPanel } from './CameraControlPanel';
export { CameraInteractionInfoDialog } from './CameraInteractionInfoDialog';
export { SceneInspector } from './SceneInspector';
export type { SceneInspectorProps } from './SceneInspector';
```

**Update `packages/core/package.json` `exports` field:**
```json
{
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    },
    "./devtools": {
      "import": "./dist/player/devtools.js",
      "types": "./dist/player/devtools.d.ts"
    }
  }
}
```

### 6.3 Testing Subpath Export

**Create `packages/core/src/testing.ts`:**
```ts
// @brewsite/core/testing — test utilities. NOT for production use.
// Import clearRegistry() here rather than deep-importing from the compiler.
export { clearRegistry } from './compiler/registry';
```

**Update `packages/core/package.json` `exports` field** (add alongside devtools):
```json
{
  "./testing": {
    "import": "./dist/testing.js",
    "types": "./dist/testing.d.ts"
  }
}
```

**@brewsite/model migration:**
```ts
// BEFORE:
import { clearRegistry } from '@brewsite/core/compiler/registry';
// AFTER:
import { clearRegistry } from '@brewsite/core/testing';
```

### 6.4 `packages/core/src/player/engineTypes.ts`

#### A. Deduplicate `CameraInteractionDefaults` (Finding 23)

Delete the duplicate type definition (lines 44–52) and replace with a re-export:
```ts
// REMOVE local definition.
// ADD re-export from canonical location:
export type { CameraInteractionDefaults } from '../elements/camera/types';
```

`useSceneEngine.ts` imports `CameraInteractionDefaults` from `'./engineTypes'` — this path
continues to work via re-export. No changes needed in `useSceneEngine.ts`.

#### B. Unify `EngineFrameState` and `EngineState` (Finding 24)

```ts
// BEFORE (two near-identical types):
export type EngineFrameState = {
  tickIndex: number; progress: number; sceneId: string;
  sceneIndex: number; sceneProgress: number;
  tick: SceneTrackTick | null;  // EngineFrameState has this
};
export type EngineState = {
  tickIndex: number; progress: number; sceneId: string;
  sceneIndex: number; sceneProgress: number;
  // EngineState lacks tick
};

// AFTER (unified):
export type EngineFrameState = {
  tickIndex: number;
  progress: number;
  sceneId: string;
  sceneIndex: number;
  sceneProgress: number;
  /** Current tick snapshot. Null before the engine's first frame. */
  tick?: SceneTrackTick | null;
};

/**
 * @deprecated Use EngineFrameState instead.
 * EngineState was a subset of EngineFrameState differing only in the absence
 * of the `tick` field. EngineFrameState now has `tick` as optional.
 */
export type EngineState = EngineFrameState;
```

### 6.5 `packages/core/src/player/EngineARContainer.tsx`

**Generalize `EngineARContainerContext` to `ViewportScaleContext` (Finding 21):**

```ts
/**
 * Viewport scaling context. Provided by EngineARContainer.
 *
 * Consumed by @brewsite/model's LabelPositioner to compute correct label
 * screen positions regardless of the enclosing layout component.
 *
 * Replaces EngineARContainerContext as the label-positioning contract so that
 * custom layouts (not just EngineARContainer) can provide it.
 */
export type ViewportScaleContextValue = {
  containerWidth: number;
  containerHeight: number;
  computedArHeight: number;
  referenceWidth: number;
  scaleMode: ScaleMode;
};

/** @deprecated Use ViewportScaleContext. Alias will be removed in v3. */
export type EngineARContainerContextValue = ViewportScaleContextValue;

export const ViewportScaleContext = createContext<ViewportScaleContextValue | null>(null);

/** @deprecated Use ViewportScaleContext. Alias will be removed in v3. */
export const EngineARContainerContext = ViewportScaleContext;
```

Export both `ViewportScaleContext` and `ViewportScaleContextValue` from `player/index.ts`.

**@brewsite/model migration:**
```ts
// BEFORE:
import { EngineARContainerContext, EngineARContainerContextValue } from '@brewsite/core';
// AFTER:
import { ViewportScaleContext, ViewportScaleContextValue } from '@brewsite/core';
// (EngineARContainerContext alias continues to work as a bridge)
```

### 6.6 `packages/core/src/player/ScenePlayerRegistry.ts`

**Add JSDoc to module-level singleton maps (Finding 22):**

```ts
/**
 * MODULE-LEVEL SINGLETON — SSR and multi-instance constraints.
 *
 * This Map lives at module scope and accumulates state across the entire JS
 * runtime lifetime (including across hot-module replacements and test runs).
 *
 * Constraints:
 * 1. SSR (Node.js): All concurrently running server requests share this Map.
 *    For stateless SSR, this is generally safe. Call unregisterSceneRuntime(id)
 *    at the end of each render to avoid memory leaks.
 * 2. Multiple EngineProvider instances on one page: each must have a unique `id`
 *    prop. If two providers share an id, the second registration overwrites the first.
 * 3. Tests: Call `clearRegistry()` from `@brewsite/core/testing` between test
 *    cases that mount EngineProvider to avoid state bleed across tests.
 *
 * Design rationale: the global registry enables useSceneEngineState(id) and
 * useSceneRuntime(id) to work from anywhere in the React tree without context
 * threading. This trade-off is intentional.
 */
const sceneRuntimeMap = new Map<string, SceneRuntimeState>();
```

### 6.7 `packages/core/src/compiler/sceneTypes.ts`

**Remove dead `SceneFrameState` alias (Finding 25, partial):**

```ts
// REMOVE line 5:
export type SceneFrameState = SceneFrame; // alias
```

Search for any consumer of `SceneFrameState` across all packages and update to use
`SceneFrame` directly. Expected: zero consumers (dead code).

### 6.8 `packages/core/src/runtime/types.ts`

**Remove dead `AnimationTrack` comment** and update JSDoc (Finding 25, partial):

`AnimationTrack` is used by `@brewsite/model` and is now exported from the public barrel
(Stream 2). Keep the type; update its JSDoc:

```ts
/**
 * A single GLTF animation track.
 * Consumed by @brewsite/model's animationTrackMapping.ts.
 *
 * Exported from @brewsite/core public barrel via src/index.ts.
 */
export type AnimationTrack = {
  targetName: string;
  property: 'position' | 'rotation' | 'scale' | 'component';
  componentType?: string;
  componentKey?: string;
  keyframes: Array<{ t: number; value: number | number[] }>;
};
```

**Audit `Vec3` duplicate (Finding 25, partial):**
`Vec3` is defined both here and in `math/index.ts` (via `elements/camera/types.ts`). The
`runtime/types.ts` definition (`[number, number, number]`) and `math/index.ts` are
structurally identical. Keep both (removing either creates a breaking change for consumers
that import it from `runtime/types`). Add a comment noting the duplicate:
```ts
/** Three-component vector. Structurally identical to Vec3 in math/. */
export type Vec3 = [number, number, number];
```

### 6.9 `packages/core/src/elements/camera/cameraKeys.ts`

Rename this file to `packages/core/src/elements/sceneKeys.ts` and add constants for all
core elements (Finding 26):

```ts
// Stable widget ID constants for all built-in @brewsite/core elements.
// Import from @brewsite/core — these flow through elements/index.ts.

/** Widget ID for the built-in CameraWidget. */
export const SCENE_CAMERA_KEY = 'camera';

/** Widget ID for the built-in LightingWidget. */
export const SCENE_LIGHTING_KEY = 'lighting';

/** Widget ID for the built-in BackgroundWidget. */
export const SCENE_BACKGROUND_KEY = 'background';

/** Widget ID for the built-in EnvironmentWidget. */
export const SCENE_ENVIRONMENT_KEY = 'environment';

/** Widget ID for the built-in FloorWidget. */
export const SCENE_FLOOR_KEY = 'floor';
```

Update `elements/camera/cameraKeys.ts` to re-export from the new location for backward
compatibility:
```ts
// Backward-compat re-export; import from '@brewsite/core' directly.
export { SCENE_CAMERA_KEY } from '../sceneKeys';
```

Update all internal imports of `SCENE_CAMERA_KEY` to use `'../sceneKeys'`.

Export from `elements/index.ts`:
```ts
export {
  SCENE_CAMERA_KEY, SCENE_LIGHTING_KEY, SCENE_BACKGROUND_KEY,
  SCENE_ENVIRONMENT_KEY, SCENE_FLOOR_KEY,
} from './sceneKeys';
```

### 6.10 `packages/core/src/widget/index.ts`

(Covered in Stream 2 section 2.5 — remove duplicate `corePlugin` export.)

### 6.11 Audit `ICameraActionTarget` (Finding 25, partial)

Search all packages for any widget that implements `ICameraActionTarget`
(`applyOrbit`, `applyDolly`, `applyReset`). If no live implementors exist (expected —
the note states "no widget implements it"), add `@deprecated` JSDoc and remove in the
next major release. Do NOT remove in this plan to avoid a potentially breaking change.

```ts
/**
 * @deprecated No built-in widget implements this interface. If your custom widget
 * uses ICameraActionTarget, migrate to ActionInputController's onUnknownAction callback
 * pattern. This interface will be removed in v3.
 */
export interface ICameraActionTarget extends IWidget {
  applyOrbit(dx: number, dy: number, speed: number): void;
  applyDolly(delta: number, speed: number): void;
  applyReset(): void;
}
```

### Stream 6 — Breaking Changes

| Change | Semver |
|---|---|
| Remove animejs from core + delete `hud/animejs/` | **Major** for any consumer importing from `@brewsite/core/hud/animejs` |
| `SceneFrameState` alias removed from `compiler/sceneTypes.ts` | Minor (dead code, no live consumers) |
| `EngineARContainerContext` → alias for `ViewportScaleContext` | Non-breaking (alias provided); @brewsite/model needs update | None now |
| `EngineState` → alias for `EngineFrameState` | Non-breaking (alias provided) | None now |

### Stream 6 — Test Strategy

- Verify animejs removal: `pnpm --filter @brewsite/core build` succeeds without animejs imports.
- Verify devtools subpath: create a type-check test file that imports from `@brewsite/core/devtools`.
- Verify testing subpath: update `packages/model/src/__tests__/handlers.test.ts` to import
  `clearRegistry` from `@brewsite/core/testing` and confirm it compiles.
- `packages/core/src/player/__tests__/EngineARContainer.test.tsx` — update to use `ViewportScaleContext`.

---

## Complete Findings-to-Stream Map

| # | Description | Priority | Stream | Status |
|---|---|---|---|---|
| 1 | scene.userData inter-widget bus | P1 CRITICAL | S3 | Required |
| 2 | Player imports concrete CameraWidget | P1 HIGH | S3 | Required |
| 3 | EngineProvider encodes model domain | P1 HIGH | S4 | Required |
| 4 | Render functions in elements/index.ts | P2 MEDIUM | S2 (remove) + S5 (ILightingOverride) | Required |
| 5 | TextBox in compiler/index.ts | P2 MEDIUM | S2 | Required |
| 6 | CameraWidget duplicates state resolution | P3 MEDIUM | S1 (type) + S3 (impl) | Required |
| 7 | sceneProgress naming mismatch | P4 LOW | S1 | Required |
| 8 | Dead ElementTransitionSpec exports | P2 | S2 | Required |
| 9 | AnimeJS HUD presets in core | P3 | S6 | Required |
| 10 | Dev tools in main bundle | P3 | S6 | Required |
| 11 | diagram-canvas.* action types in core | P2 | S5 | Required |
| 12 | useDefaultStateWhenAbsent naming | P3 MEDIUM | S1 (type) + S4 (impl) | Required |
| 13 | Dead types and aliases | P4 LOW | S2 + S6 | Required |
| 14 | Fragile serialize() delta detection | P4 LOW | S1 (type) + S4 (impl) | Required |
| 15 | Missing public API | P1 | S2 | Required |
| 16 | UseSceneEngineResult not exported | P1 | S3 (define) + S2 (export) | Required |
| 17 | WidgetRegistry.freeze() missing | P3 | S4 | Required |
| 18 | ICameraInteractionDriver not exported | P3 | **Already resolved** | No action |
| 19 | clearRegistry not in testing subpath | P3 | S6 | Required |
| 20 | sceneProgress (same as #7) | P4 | S1 | Required |
| 21 | EngineARContainerContext not generalised | P4 | S6 | Required |
| 22 | ScenePlayerRegistry undocumented singleton | P4 | S6 | Required |
| 23 | CameraInteractionDefaults duplicated | P4 | S6 | Required |
| 24 | EngineFrameState / EngineState near-identical | P4 | S6 | Required |
| 25 | Dead types removal | P4 | S2 + S6 | Required |
| 26 | Widget ID constants inconsistent | P4 | S6 | Required |
| 27 | WidgetRegistry routing logic duplicated | P4 | S4 | Required |
| 28 | api.pushWarning() missing from CompileApi | P4 | **Already resolved** | No action |

---

## Migration Guide Summary

### @brewsite/model

| Before | After |
|---|---|
| `import { getNodeHandler } from '@brewsite/core/compiler/registry'` | `import { getNodeHandler } from '@brewsite/core'` |
| `import { clearRegistry } from '@brewsite/core/compiler/registry'` | `import { clearRegistry } from '@brewsite/core/testing'` |
| `import type { Resolvable } from '@brewsite/core/compiler/sceneTypes'` | `import type { Resolvable } from '@brewsite/core'` |
| `import type { AnimationTrack } from '@brewsite/core/runtime/types'` | `import type { AnimationTrack } from '@brewsite/core'` |
| `EngineARContainerContext` import | `ViewportScaleContext` (alias kept, no hard break) |
| `readonly useDefaultStateWhenAbsent = false` in `ModelWidget.ts:378` | `readonly disableWhenAbsent = true` (must ship with S4 PR) |

### @brewsite/diagram

| Change | File | Action |
|---|---|---|
| `setSceneLightEnabled` removed from core barrel | `canvas/widget.ts` | Implement `ILightingOverride` with `getLightingOverride()` (disableAll) + `receiveLightController?` (hover setter) (S3.5) |
| `setSceneLightEnabled` removed from core barrel | `elements/diagram/widget.ts` | Implement `ILightingOverride` with `receiveLightController?` only — `getLightingOverride()` returns null (S3.7) |
| `scene.userData['__brewsite_camera_focus']` write | `canvas/widget.ts` | `context.cameraFocusTarget?.requestFocus(...)` (S3.5) |
| `scene.userData['__brewsite_camera']` read | `canvas/widget.ts` | `context.cameraFocusTarget !== null` (S3.5) |
| `scene.userData['__brewsite_camera']` read | `canvas/render.ts` | Pass camera as explicit parameter from widget (S3.6) |
| `scene.userData['__brewsite_camera']` read (3 locations) | `elements/diagram/widget.ts` | Save in `initialize()`, use `this.cameraRef` (S3.7) |
| `scene.userData['__brewsite_camera']` read | `elements/image-panel/widget.ts` | Save in `initialize()`, use `this.cameraRef` (S3.8) |
| `scene.userData['__brewsite_camera']` read | `elements/screen/widget.ts` | Save in `initialize()`, use `this.cameraRef` (S3.9) |
| `diagram-canvas.*` in `ActionInputController` removed | `player/diagramPlugin.ts` | Implement `getActionInputExtension()` (S5.3b) |
| `CompileExtraContext.sceneProgress` | any `compileExtra()` | Rename to `blockProgress` (S1 breaking) |

### @brewsite/charts

| Change | File | Action |
|---|---|---|
| `scene.userData[SCENE_CAMERA_KEY]` read (3 locations, lines 106, 132, 177) | `elements/chart/ChartWidget.ts` | Save camera in `initialize()`, use `this.cameraRef` (S3.10) |
| `import { SCENE_CAMERA_KEY }` removed | `elements/chart/ChartWidget.ts` | Remove import after replacing all 3 userData reads |

---

## Implementation Order (Suggested PR Sequence)

1. **PR-1:** Stream 1 (type contracts) — 1 developer, ~1 day
2. **PR-2:** Streams 2, 5, 6 in parallel — 3 developers, ~2 days
3. **PR-3:** Streams 3 and 4 in parallel (after PR-1 merges) — 2 developers, ~3 days
4. **PR-4:** Final integration — run full `pnpm build && pnpm test` across all packages
