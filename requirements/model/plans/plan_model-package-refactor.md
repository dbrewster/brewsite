---
title: "@brewsite/model — Package Refactor: Simplification, NVS Alignment, Coverage & Example"
doc_type: plan
owner: Toolkit Architecture
status: ready
updated: 2026-03-13
---

# @brewsite/model — Package Refactor

## Overview

The model package is correct in its core design but has accumulated complexity that makes it difficult
to maintain, test, and understand. This plan addresses six specific failure modes:

1. **Oversized files** — `ModelWidget.ts` (920 lines), `compile.ts` (741 lines), `ModelRenderer.ts`
   (1202 lines). No file should exceed ~400 lines.
2. **CUSTOM_NODE_HANDLER embedded in constructor** — 200+ line handler closure lives inside the
   `ModelWidget` constructor alongside helper functions at module scope. Extract to a standalone
   module.
3. **`__authored` flag type-system bypass** — `__authored` is attached to `SceneModelInstanceState`
   using `as unknown as Record<...>` casts. Replace with a `WeakMap` — clean, no string-property
   pollution, no unsafe casts.
4. **NVS scale not viewport-relative** — `scale` is raw world units. Replace with viewport-relative
   semantics: `scale` is now always multiplied by `context.coords.visibleWorldHeight` at render
   time, matching how diagram sizes geometry.
5. **Branch coverage below 80%** — new modules need dedicated test files; existing gaps must be filled.
6. **No working model example** — the current `architecture` example only diagrams the model system;
   there is no running 3D model demonstration.

---

## Architecture Decisions

### A. `__authored` cleanup — WeakMap

The `__authored` string property attached to `SceneModelInstanceState` is necessary: scene-authoring
props that were NOT written in the DSL must not overwrite values carried from the previous scene.
The `mergeSnapshot` method relies on this per-field "was it authored?" signal.

The current implementation attaches `__authored` directly to state objects using
`as unknown as Record<...>` casts, which pollutes state objects and bypasses the type system.
Replace with a **module-level `WeakMap`** in `modelDslHandler.ts`:

```typescript
// modelDslHandler.ts

const authoredFlagsMap = new WeakMap<SceneModelInstanceState, ModelAuthoredFlags>();

/** @internal Write authored flags for a compiled state object. */
function setModelAuthoredFlags(state: SceneModelInstanceState, flags: ModelAuthoredFlags): void {
  authoredFlagsMap.set(state, flags);
}

/**
 * Retrieve authored flags for a compiled state object.
 * Returns undefined if the state was not produced by buildModelNodeHandler
 * (e.g., defaultState, or a state from outside compilation).
 */
export function getModelAuthoredFlags(state: SceneModelInstanceState): ModelAuthoredFlags | undefined {
  return authoredFlagsMap.get(state);
}
```

**Why WeakMap is safe here:** `mergeSnapshot` is called during the compilation pass with the
exact same object reference that `buildModelNodeHandler` passed to `api.setWidgetState(id, state)`.
The compiler stores and passes these references without copying them between handler invocation and
`mergeSnapshot` invocation. Object spreading in `applyModelExit/Enter/Interpolate` only happens at
runtime (inside the functional transition spec closures), which runs after compilation is complete —
`mergeSnapshot` is never called on a spread copy. The WeakMap therefore maintains valid entries
throughout the compilation lifetime.

No `CompiledModelState` type alias. No `as unknown as` casts anywhere in this module.

### B. ModelRenderer split — three focused classes

`ModelRenderer.ts` handles loading, material management, animation playback, pose overrides, and
part attachment. Extract the animation and material subsystems into separate manager classes that
own their own state. This preserves the encapsulation boundary without creating leaky pure-function
modules.

**New file structure:**
```
ModelRenderer.ts          # GLTF loading, scene management, apply() orchestrator (~450 lines)
ModelAnimationPlayer.ts   # AnimationMixer management, clip application, custom animations (~380 lines)
ModelMaterialManager.ts   # Material base caching, override application, disposal (~200 lines)
```

### C. Viewport-relative scale — `scale` semantics change

`SceneModel.scale` is redefined as a **viewport-relative factor**. The world-space scale
applied to the Three.js Object3D is always:

```
worldScale = scale * context.coords.visibleWorldHeight
```

This matches the diagram package's approach where all geometry sizes derive from
`coords.visibleWorldWidth/Height`. A value of `1.0` means the model's unit is exactly one
viewport-height tall in world space. A value of `0.06` is a typical human-figure scale
(~6% of viewport height).

**Breaking change:** Any existing consumer that authored `scale={0.18}` in world units must
re-calibrate. For the robot example, the old world-unit scale of `0.18` against a typical
camera setup with `visibleWorldHeight ≈ 3.0` corresponds to a new NVS scale of approximately
`0.06`. The implementing bot must determine the correct NVS scale for the robot by loading it
in the example scene and adjusting until it looks correct at the intended size.

**No dual `scale` / `nvsScale` fields.** There is only `scale: number`, and it is always
viewport-relative. Remove any references in this plan to an `nvsScale` field — that approach
was the backward-compatible version and is no longer needed.

### D. CUSTOM_NODE_HANDLER extraction

The handler function and all its helpers become `buildModelNodeHandler(config)` in
`modelDslHandler.ts`. `ModelWidget` constructor calls this factory and assigns the result to
`[CUSTOM_NODE_HANDLER]`. ModelWidget.ts imports `buildModelNodeHandler` and
`getModelAuthoredFlags` from `modelDslHandler.ts` — it no longer contains any handler logic.

---

## File Changes Summary

### Files to CREATE

| File | Responsibility | Target Lines |
|---|---|---|
| `packages/model/src/elements/model/modelBlend.ts` | Pure blend helpers for all transition interpolation | ~290 |
| `packages/model/src/elements/model/modelDslHandler.ts` | CUSTOM_NODE_HANDLER factory + DSL child helpers + WeakMap authored flags | ~420 |
| `packages/model/src/elements/model/ModelAnimationPlayer.ts` | AnimationMixer management, clip application, custom animations | ~380 |
| `packages/model/src/elements/model/ModelMaterialManager.ts` | Material base caching, override application, disposal | ~200 |
| `packages/model/src/elements/model/__tests__/modelBlend.test.ts` | Tests for all blend helpers | ~250 |
| `packages/model/src/elements/model/__tests__/modelDslHandler.test.ts` | Tests for handler builder and merge helpers | ~300 |
| `packages/model/src/elements/model/__tests__/ModelAnimationPlayer.test.ts` | Tests for animation player state machine | ~200 |
| `packages/model/src/elements/model/__tests__/ModelMaterialManager.test.ts` | Tests for material override application | ~200 |
| `apps/examples/src/model-showcase/ModelShowcasePage.tsx` | Route page | ~50 |
| `apps/examples/src/model-showcase/widgetSetup.ts` | Widget plugin setup | ~30 |
| `apps/examples/src/model-showcase/scenes/scene01_intro.tsx` | Scene 1: model fade-in, idle | ~50 |
| `apps/examples/src/model-showcase/scenes/scene02_animation.tsx` | Scene 2: animation playback | ~60 |
| `apps/examples/src/model-showcase/scenes/scene03_labels.tsx` | Scene 3: body part highlight + label | ~80 |
| `apps/examples/src/model-showcase/scenes/scene04_view.tsx` | Scene 4: model inside a `<View>` region | ~70 |
| `apps/examples/src/model-showcase/scenes/scene05_carousel.tsx` | Scene 5: three models in `<ViewLayout kind="carousel">`, each with a different animation | ~100 |
| `apps/examples/public/assets/model/manifest.json` | Asset manifest for robot + 3 animation clips | ~120 lines |

### Files to MODIFY

| File | Changes |
|---|---|
| `packages/model/src/elements/model/compile.ts` | Remove blend helpers (moved to `modelBlend.ts`); import from `modelBlend.ts`; **delete `instanceTransitionSpec`**; target ~360 lines |
| `packages/model/src/elements/model/ModelWidget.ts` | Remove all handler helper functions and CUSTOM_NODE_HANDLER closure body; import `buildModelNodeHandler`/`getModelAuthoredFlags`; remove `mergeBodyPartOverrides`/`mergeSubparts`/`mergeModelParts` (moved to `modelDslHandler.ts`); update `apply()` for viewport-relative scale; target ~300 lines |
| `packages/model/src/elements/model/ModelRenderer.ts` | Remove animation and material code; delegate to `ModelAnimationPlayer` and `ModelMaterialManager`; target ~450 lines |
| `packages/model/src/elements/model/types.ts` | Update `scale` JSDoc to document viewport-relative semantics (no structural change) |
| `packages/model/src/elements/model/dsl.tsx` | No changes (scale prop type is unchanged) |
| `packages/model/src/elements/model/index.ts` | Add `modelBlend.ts` exports where needed; do NOT export `modelDslHandler.ts` internals; remove `instanceTransitionSpec` from exports |
| `apps/examples/src/App.tsx` | Add `/model-showcase` route |
| `requirements/model/prd/prd_model.md` | Update for viewport-relative scale, removed `instanceTransitionSpec`, WeakMap authored flags, refactored internals, new example launch criteria |

---

## Phase 1 — File Splitting

### 1A. Create `modelBlend.ts`

**File:** `packages/model/src/elements/model/modelBlend.ts`

**Single responsibility:** Pure blend/interpolation helper functions for model state transitions.
No Three.js, no React, no side effects.

**Imports allowed:** `types.ts` from same directory; blend utilities from `@brewsite/core`.

**Contents — move from `compile.ts` verbatim:**

```typescript
// modelBlend.ts — Pure blend helpers for model state transitions.

import type {
  AxisRotation, AxisTranslation, BodyPartOverrideMap, CustomAnimation,
  ModelPartSpec, ModelSubpartSpec, MotionCommand, MotionScene, PoseGroup,
} from './types';
import { blendAxisRotation, blendAxisTranslation, blendColor, blendNumber, blendOpacity, blendVec3, resolveEnabledByOpacity } from '@brewsite/core';

const OPAQUE_OPACITY = 1;

// Private helpers (not exported):
// scaleAxisRotation(value, scale): scales an AxisRotation by a scalar
// scaleAxisTranslation(value, scale): scales an AxisTranslation by a scalar

// Exported helpers:
export function poseGroupTransition(from?: PoseGroup, to?: PoseGroup, t?: number): PoseGroup | undefined
export function blendBodyOverrides(from, to, tExit, tEnter, tFull): BodyPartOverrideMap | undefined
export function blendSubparts(from, to, tExit, tEnter, tFull): Partial<Record<string, ModelSubpartSpec>> | undefined
export function blendParts(from, to, tExit, tEnter, tFull): Record<string, ModelPartSpec> | undefined
export function blendPoseGroups(from, to, t): Partial<Record<string, PoseGroup>> | undefined  // previously private
export function blendCommands(from, to, tExit, tEnter, tFull): MotionCommand[]
export function blendMotionScenes(from, to, tExit, tEnter, tFull): MotionScene[]
export function blendCustomAnimations(from, to, tExit, tEnter, tFull): CustomAnimation[]
```

**Note:** `blendPoseGroups` was private in `compile.ts` but is exported here to enable testing.
All functions have explicit return types. No `any`.

Move all 8 blend functions and 2 private helpers from `compile.ts` to this file verbatim (no logic
changes). Update `compile.ts` to import from `./modelBlend`.

### 1B. Create `modelDslHandler.ts`

**File:** `packages/model/src/elements/model/modelDslHandler.ts`

**Single responsibility:** Factory function that builds the `CUSTOM_NODE_HANDLER` NodeHandler
for a ModelWidget instance, plus all DSL child traversal helpers and state merge helpers.

**Imports allowed:** `types.ts`, `modelBlend.ts`, label types from `../../labels/types`, DSL prop
types from `./dsl`, `@brewsite/core` compiler/widget types. No Three.js, no React component code,
no ModelRenderer, no ModelWidget class.

**Full exported API:**

```typescript
// modelDslHandler.ts — Factory for ModelWidget CUSTOM_NODE_HANDLER and merge utilities.

import type { ReactElement } from 'react';
import { isValidElement } from 'react';
import type { CompileApi, CompileHelpers, NodeHandler, SceneSnapshotContext, NVSRect } from '@brewsite/core';
import { validateNVSScalar, validateNVSRect } from '@brewsite/core';
import type { ... } from './types';
import type { ... } from './dsl';
import type { LabelProps } from '../../labels/dsl';
import type { LabelResolved } from '../../labels/types';
import { ... } from './modelBlend';

// ─── Authored flags — WeakMap storage ────────────────────────────────────────

/** @internal Per-field "was it explicitly authored?" flags for a compiled model state. */
export type ModelAuthoredFlags = {
  model?: {
    reset?: boolean; scale?: boolean; rotation?: boolean; opacity?: boolean;
    metalness?: boolean; roughness?: boolean;
    metalnessMultiplier?: boolean; roughnessMultiplier?: boolean;
  };
  enabled?: boolean;
  playback?: {
    reset?: boolean;
    animation?: Partial<Record<keyof SceneAnimation, boolean>>;
    motion?: { reset?: boolean; commands?: boolean; scenes?: boolean; customAnimations?: boolean };
  };
};

// WeakMap keyed on SceneModelInstanceState — no string-property pollution, no unsafe casts.
// Safe at compile time: mergeSnapshot receives the exact same object reference produced by
// buildModelNodeHandler. See Architecture Decision A for the full rationale.
const authoredFlagsMap = new WeakMap<SceneModelInstanceState, ModelAuthoredFlags>();

// No CompiledModelState type alias. SceneModelInstanceState is never augmented.

// ─── DSL child component references (passed in from ModelWidget) ───────────────

export type ModelDslComponents = {
  Model: React.ComponentType<any>;
  BodyParts: React.ComponentType<any>;
  BodyPart: React.ComponentType<any>;
  Pose: React.ComponentType<any>;
  ModelPart: React.ComponentType<any>;
  ContainedModel: React.ComponentType<any>;
  Subpart: React.ComponentType<any>;
  Playback: React.ComponentType<any>;
  Motion: React.ComponentType<any>;
  Animation: React.ComponentType<any>;
  Label: React.ComponentType<any>;
};

// ─── Handler config ───────────────────────────────────────────────────────────

export type ModelNodeHandlerConfig = {
  widgetId: string;
  defaultState: SceneModelInstanceState;
  components: ModelDslComponents;
};

// ─── Public helpers ───────────────────────────────────────────────────────────

/**
 * Retrieve authored flags attached to a compiled model state.
 * Returns undefined if the state was not produced by buildModelNodeHandler
 * (e.g., it is the defaultState or a state created outside compilation).
 */
export function getModelAuthoredFlags(state: SceneModelInstanceState): ModelAuthoredFlags | undefined;

/**
 * Merge body part override maps, applying reset semantics.
 * Exported for use by ModelWidget.mergeSnapshot() and testing.
 */
export function mergeBodyPartOverrides(
  prev?: BodyPartOverrideMap,
  next?: BodyPartOverrideMap,
): BodyPartOverrideMap | undefined;

/**
 * Merge subpart spec maps, applying reset semantics.
 */
export function mergeSubparts(
  prev?: Partial<Record<string, ModelSubpartSpec>>,
  next?: Partial<Record<string, ModelSubpartSpec>>,
): Partial<Record<string, ModelSubpartSpec>> | undefined;

/**
 * Merge model part spec maps, applying reset semantics with full field merging.
 */
export function mergeModelParts(
  prev?: Record<string, ModelPartSpec>,
  next?: Record<string, ModelPartSpec>,
): Record<string, ModelPartSpec> | undefined;

/**
 * Factory function that builds and returns the CUSTOM_NODE_HANDLER for a ModelWidget instance.
 * The returned NodeHandler:
 *   1. Resolves all props from <Model>, <BodyParts>, <BodyPart>, <Pose>, <ModelPart>,
 *      <Playback>, <Animation>, <Motion> children
 *   2. Computes nvsBounds via api.composeBounds(localBounds)
 *   3. Builds SceneModelInstanceState and attaches __authored flags
 *   4. Calls api.setWidgetState(widgetId, state)
 *
 * @param config - widgetId, defaultState, and DSL component references
 */
export function buildModelNodeHandler(config: ModelNodeHandlerConfig): NodeHandler;
```

**Implementation notes:**

- Move `applyBodyPartToOverrides`, `applyModelPartToOverrides`, `mergeBodyPartOverrides`,
  `mergeSubparts`, `mergeModelParts`, and the entire `CUSTOM_NODE_HANDLER` closure body from
  `ModelWidget.ts` verbatim into this file.
- Move `hasProp` and `isComponent` helpers into this file (they were module-scope in
  `ModelWidget.ts`).
- `buildModelNodeHandler(config)` returns the handler function. The handler is a closure over
  `config.widgetId`, `config.defaultState`, and `config.components`.
- Where the old code used bare references like `BodyParts`, `BodyPart`, etc., the new code uses
  `config.components.BodyParts`, `config.components.BodyPart`, etc.
- Authored flags are written via `authoredFlagsMap.set(state, authored)` immediately before
  `api.setWidgetState(widgetId, state)`. No type casting, no string properties on state.
- `getModelAuthoredFlags(state)` returns `authoredFlagsMap.get(state)`. Called by
  `ModelWidget.mergeSnapshot` — import it from `./modelDslHandler`.

### 1C. Slim `ModelWidget.ts`

**Target:** ~300 lines.

**Keep in `ModelWidget.ts`:**
- All DSL stub exports: `Model`, `ModelRouter`, `BodyParts`, `BodyPart`, `Pose`, `ModelPart`,
  `ContainedModel`, `Subpart`, `Playback`, `Motion`, `Animation`, `Label`, `Labels` — these remain
  co-located with the widget class (per the DSL stub co-location policy in the PRD).
- `ModelWidgetConfig` type
- `ModelAuthoredFlags` re-export: NO — keep it in `modelDslHandler.ts`. `ModelWidget` imports what
  it needs.
- The `ModelWidget` class with all its method implementations.

**Remove from `ModelWidget.ts`:**
- `applyBodyPartToOverrides` function (move to `modelDslHandler.ts`)
- `applyModelPartToOverrides` function (move to `modelDslHandler.ts`)
- `mergeBodyPartOverrides` function (move to `modelDslHandler.ts`)
- `mergeSubparts` function (move to `modelDslHandler.ts`)
- `mergeModelParts` function (move to `modelDslHandler.ts`)
- `hasProp` function (move to `modelDslHandler.ts`)
- `isComponent` function (move to `modelDslHandler.ts`)
- `ModelAuthoredFlags` type definition (move to `modelDslHandler.ts`)
- The entire CUSTOM_NODE_HANDLER closure body (replaced by `buildModelNodeHandler` call)

**Modified constructor:**
```typescript
constructor(
  config: ModelWidgetConfig,
  defaultStateOverride?: Partial<SceneModelInstanceState['model']>,
) {
  this.widgetId = config.widgetId ?? config.modelMeta.type;
  this.modelType = config.modelMeta.type;
  this.config = config;
  this.clipMeta = config.clipMeta;
  this.defaultState = createDefaultModelInstanceState(this.modelType, this.config.modelMeta.identity);
  if (defaultStateOverride) {
    this.defaultState.model = { ...this.defaultState.model, ...defaultStateOverride };
  }
  this.baseRotation = (this.config.modelMeta.baseRotation ?? null) as Vec3 | null;
  if (this.baseRotation) {
    this.defaultState.model.rotation = [0, 0, 0];
  }
  this.anchorTargets = config.modelMeta.anchorTargets ?? {};

  (this as unknown as Record<symbol, NodeHandler>)[CUSTOM_NODE_HANDLER] = buildModelNodeHandler({
    widgetId: this.widgetId,
    defaultState: this.defaultState,
    components: {
      Model, ModelRouter, BodyParts, BodyPart, Pose, ModelPart,
      ContainedModel, Subpart, Playback, Motion, Animation, Label,
    },
  });
}
```

**Modified `mergeSnapshot`:**
Replace all `(next as ... ).__authored` accesses with `getModelAuthoredFlags(next)` (imported
from `./modelDslHandler`). No casts needed — `getModelAuthoredFlags` accepts
`SceneModelInstanceState` directly and returns `ModelAuthoredFlags | undefined`.
Replace all `mergeBodyPartOverrides`, `mergeSubparts`, `mergeModelParts` calls with the imported
versions from `./modelDslHandler`.
Remove the `delete (merged as ...).__authored` line at the end of `mergeSnapshot` — there is
nothing to delete when using the WeakMap approach.

### 1D. Slim `compile.ts`

**Target:** ~380 lines.

**Changes:**
1. Add `import { blendBodyOverrides, blendSubparts, blendParts, blendCommands, blendMotionScenes, blendCustomAnimations, blendPoseGroups, poseGroupTransition } from './modelBlend';` at top.
2. Remove all blend helper functions that were moved to `modelBlend.ts`.
3. Keep: `resolveClipRangeSeconds`, `modelTransitionSpec`, `playbackTransitionSpec`,
   `applyModelExit`, `applyModelEnter`, `applyModelInterpolate`,
   `functionalInstanceTransitionSpec`, `CompiledAnimation`, `compileAnimation`,
   `createDefaultModelInstanceState`.
4. **Delete `instanceTransitionSpec`** — remove from this file entirely. Gone.

### 1E. Create `ModelAnimationPlayer.ts`

**File:** `packages/model/src/elements/model/ModelAnimationPlayer.ts`

**Single responsibility:** Owns the `THREE.AnimationMixer` and all animation clip management for
a single model instance.

**Imports allowed:** Three.js, `types.ts`, `_renderTypes.ts`, `compile.ts` (for `CompiledAnimation`),
`animationTrackMapping.ts`, `WidgetRenderContext` type from `@brewsite/core`. No React.

```typescript
// ModelAnimationPlayer.ts — AnimationMixer management and clip application for a model instance.

export class ModelAnimationPlayer {
  constructor(model: THREE.Group);

  /** Add animation clips (called after GLTF load and after loading additional clip GLBs). */
  addClips(clips: THREE.AnimationClip[]): void;

  /** Add a remapped clip after track name normalization. Key = clip name. */
  addRemappedClip(clipName: string, clip: THREE.AnimationClip): void;

  /** Apply animation state for this frame. Returns true if animation was applied. */
  apply(
    state: ModelRenderInstanceState,
    animation: CompiledAnimation | undefined,
    ctx: WidgetRenderContext | undefined,
    nodeByName: ReadonlyMap<string, THREE.Object3D>,
  ): void;

  /** Apply custom animations (procedural per-frame overlays). */
  applyCustomAnimations(
    customAnimations: CustomAnimation[],
    ctx: WidgetRenderContext | undefined,
    nodeByName: ReadonlyMap<string, THREE.Object3D>,
  ): void;

  /** Returns true if the animation should reset due to global progress change. */
  shouldResetOnProgress(globalProgress: number | undefined, signature: string): boolean;

  /** Stop all animations and release clips. */
  dispose(): void;
}
```

**Extract from `ModelRenderer.ts` into this class:**
- `mixer` field + `animationClips` + `activeClip` + `filteredClips` + `rangedClips` +
  `initialStartOffsets` + `lastAnimationSignature` + `lastGlobalProgress`
- `applyAnimation()` method
- `clearActiveAnimation()` method
- `getFilteredClip()` method
- `getRangedClip()` method
- `getInitialStartOffset()` method
- `getAnimationSignature()` method
- `shouldResetOnProgress()` method
- `applyCustomAnimations()` method

**Note on `remapClipTrackNames`:** this method needs `nodeByName`, `boneByName`, `meshByName` to
resolve valid targets. Move it to `ModelAnimationPlayer` with those maps passed as params, OR keep
it in `ModelRenderer` as a static method and call it before `addRemappedClip`. Prefer keeping in
`ModelRenderer` as a static helper since it reads from the model's node map, not from the player.

### 1F. Create `ModelMaterialManager.ts`

**File:** `packages/model/src/elements/model/ModelMaterialManager.ts`

**Single responsibility:** Caches original material properties and applies per-frame overrides.
No state management beyond the cache.

```typescript
// ModelMaterialManager.ts — Material base caching and override application.

type MaterialOverrides = {
  color?: string;
  opacity?: number;
  metalness?: number;
  roughness?: number;
};

export class ModelMaterialManager {
  /** Cache the original material properties. Call once when a mesh is added to the scene. */
  cacheMaterial(material: THREE.Material | THREE.Material[]): void;

  /**
   * Apply overrides on top of the cached base values.
   * Restores to base first, then applies delta.
   */
  applyOverrides(
    material: THREE.Material | THREE.Material[],
    overrides: MaterialOverrides,
  ): void;

  /** Dispose all materials in the cache. Call when the model is removed from the scene. */
  disposeMaterials(): void;

  /** Remove a specific material from the cache (e.g., when disposing a single mesh). */
  removeMaterial(material: THREE.Material | THREE.Material[]): void;
}
```

**Extract from `ModelRenderer.ts` into this class:**
- `materialBase: Map<string, MaterialBase>` field
- `cacheMaterialBase()` method (renamed `cacheMaterial`)
- `applyMaterialOverrides()` method (renamed `applyOverrides`)
- `disposeMaterial()` method (private helper, incorporated into `disposeMaterials`)

### 1G. Update `ModelRenderer.ts`

**Target:** ~450 lines.

**Changes:**
1. Instantiate `ModelAnimationPlayer` and `ModelMaterialManager` in `ingestModel()`.
2. Delegate animation operations to `this.animationPlayer.*`.
3. Delegate material operations to `this.materialManager.*`.
4. Remove all extracted methods.
5. Update `dispose()` to call `this.animationPlayer.dispose()` and
   `this.materialManager.disposeMaterials()`.

**ModelRenderer constructor signature is unchanged.**

---

## Phase 2 — NVS Scale (Breaking Change)

`scale` on `SceneModel` is redefined as a viewport-relative factor. No new field is added.

### 2A. `types.ts` — Update `scale` JSDoc

```typescript
export type SceneModel = {
  /**
   * Viewport-relative scale factor.
   * The world-space scale applied to the model's Object3D is:
   *   worldScale = scale * context.coords.visibleWorldHeight
   *
   * A value of 1.0 = model unit equals viewport height in world space.
   * A value of 0.06 is typical for a human figure (≈ 6% of viewport height).
   *
   * BREAKING CHANGE from pre-refactor: scale was previously a raw world-unit value.
   * Divide old world-unit values by the scene's visibleWorldHeight to obtain
   * the equivalent NVS scale.
   */
  scale: number;
  // ... rest of fields unchanged — no nvsScale field
};
```

No structural change to `SceneModel`. This is a JSDoc update plus a render-layer change.

### 2B. `dsl.tsx` — No change

`ModelProps.scale` already exists as `scale?: Resolvable<number>`. The prop type is unchanged;
only the semantics change.

### 2C. `compile.ts` — `modelTransitionSpec` unchanged

`blendNumber(from.scale, to.scale, t)` still interpolates scale correctly. No change needed.

### 2D. `ModelWidget.apply()` — Apply viewport-relative scale

```typescript
apply(state: SceneModelInstanceState, context: WidgetRenderContext): void {
  // ...existing NVS validation...
  const worldPos = context.coords.toWorld(state.model.nvsX, state.model.nvsY, state.model.z);

  const { nvsX: _nx, nvsY: _ny, z: _z, ...modelRest } = state.model;
  // scale is now viewport-relative: multiply by visible world height
  const worldScale = state.model.scale * context.coords.visibleWorldHeight;
  const renderInput: ModelRenderInput = {
    ...modelRest,
    scale: worldScale,
    position: worldPos as Vec3,
  };
  const animation = context.extra as CompiledAnimation | undefined;
  this.renderer.apply({ ...state, model: renderInput }, animation, context);
}
```

### 2E. Manifest identity `scale` value — recalibration required

The manifest `identity.model.scale` field must be updated to the new NVS-relative value.
The implementing bot must load the robot in the example and adjust `scale` until it matches
the intended visual size. A reasonable starting point: if the old value was `0.18` and the
scene's `visibleWorldHeight` is approximately `3.0`, the NVS-relative equivalent is
`0.18 / 3.0 ≈ 0.06`. Verify visually — do not assume this ratio.

Update the manifest template in section 5B with the calibrated value once determined.

---

## Phase 3 — `compile.ts` Cleanup

After Phase 1 moves the blend helpers, clean up the remaining `compile.ts`:

1. **Remove** `import { ..., blendVec3, blendColor, ... } from '@brewsite/core'` entries that are
   no longer needed directly in `compile.ts` (they are now used only in `modelBlend.ts`).
2. **Keep** `blendNumber`, `blendOpacity`, `blendVec3` imports in `compile.ts` since they are still
   used in `modelTransitionSpec` and `playbackTransitionSpec`.
3. **Delete `instanceTransitionSpec` entirely.** No deprecation warning, no backward compat shim.
   Remove the export from `compile.ts` and from `index.ts`. If any test file references it, delete
   those test cases — they tested the old `ElementTransitionSpec` batch-fill path that is no longer
   supported. The `functionalInstanceTransitionSpec` is the sole transition spec.
4. **Add** a comment block at the top of the file stating its single responsibility.

---

## Phase 4 — Test Coverage (>80% Branch Coverage)

### 4A. `modelBlend.test.ts`

**File:** `packages/model/src/elements/model/__tests__/modelBlend.test.ts`

Test strategy: pure function tests — real inputs, real outputs, no mocks.

```typescript
// Test cases required for >80% branch coverage:

describe('poseGroupTransition', () => {
  it('returns undefined when both from and to are undefined');
  it('interpolates when both from and to have values');
  it('scales down from-only on exit (t=0 keeps from, t=1 zeroes)');
  it('scales up to-only on enter (t=0 is zero, t=1 is to)');
});

describe('blendBodyOverrides', () => {
  it('returns undefined when both maps are empty/undefined');
  it('blends opacity when part exists in both maps');
  it('blends color, metalness, roughness when both present');
  it('fades out opacity when part exists only in from map (tExit)');
  it('fades in opacity when part exists only in to map (tEnter)');
  it('blends pose via poseGroupTransition');
});

describe('blendSubparts', () => {
  it('blends opacity + color when present in both');
  it('resolves enabled via resolveEnabledByOpacity when opacity transitions to 0');
  it('handles exit-only and enter-only subparts');
});

describe('blendParts', () => {
  it('blends position, rotation, scale, containedPosition via blendVec3/blendNumber');
  it('blends metalness, roughness');
  it('blends subparts recursively');
  it('handles exit-only parts with correct position defaults');
  it('handles enter-only parts with correct position defaults');
});

describe('blendCommands', () => {
  it('blends matched commands by groupId');
  it('fades out unmatched from-commands when tExit < 1');
  it('fades in unmatched to-commands when tEnter > 0');
  it('returns empty array when both inputs are empty');
});

describe('blendMotionScenes', () => {
  it('blends start/end times of matched scenes by id');
  it('uses tFull < 0.5 ease from from-scene, else from to-scene');
  it('carries unmatched from-scenes when tExit < 1');
  it('carries unmatched to-scenes when tEnter > 0');
});

describe('blendCustomAnimations', () => {
  it('blends weight of matched animations');
  it('picks apply fn from to when tFull >= 0.5');
  it('fades weight to 0 for exit-only animations');
  it('fades weight from 0 for enter-only animations');
});
```

### 4B. `modelDslHandler.test.ts`

**File:** `packages/model/src/elements/model/__tests__/modelDslHandler.test.ts`

Test strategy: build a real handler using `buildModelNodeHandler`, invoke it with real JSX elements
and a minimal real `CompileApi` / `CompileHelpers` implementation (no mocks for business logic).

```typescript
// Test fixture — minimal real CompileApi
function makeCompileApi(widgetId: string): { api: CompileApi; getState(): SceneModelInstanceState } {
  let stored: SceneModelInstanceState | null = null;
  return {
    api: {
      context: makeSceneSnapshotContext(),
      state: { widgets: {}, materialMetalnessMultiplier: 1, materialRoughnessMultiplier: 1 },
      setWidgetState: (_id, s) => { stored = s as SceneModelInstanceState; },
      composeBounds: (b) => b,  // identity — no parent view
      pushHudItem: () => {},
      pushLabel: () => {},
      setSceneMeta: () => {},
    } as CompileApi,
    getState: () => stored!,
  };
}

describe('buildModelNodeHandler', () => {
  it('produces SceneModelInstanceState with correct nvsX/nvsY from x/y/w/h props');
  it('produces nvsBounds with x/y/w/h from Model props');
  it('merges BodyPart overrides from <BodyParts> container');
  it('merges BodyPart overrides from direct <BodyPart> child');
  it('applies <Pose> children inside <BodyPart> with pitchPct/yawPct/rollPct');
  it('processes <Label> inside <BodyPart> and stores in labels array');
  it('processes <ModelPart> with <ContainedModel> child');
  it('processes <Playback> with <Animation> child — sets clipName, weight, enabled');
  it('processes <Playback> with <Motion> child — sets commands, scenes');
  it('attaches __authored flags with correct authored fields');
  it('respects reset=true on Model props');
  it('handles model enabled=false');
});

describe('mergeBodyPartOverrides', () => {
  it('returns undefined for empty inputs');
  it('deep-merges two maps without reset');
  it('resets a part when override.reset=true');
  it('applies poseReset correctly');
});

describe('mergeSubparts', () => {
  it('deep-merges subpart maps');
  it('resets a subpart when reset=true');
});

describe('mergeModelParts', () => {
  it('merges part specs with defaults for missing optional fields');
  it('resets a part when reset=true');
  it('preserves subparts from previous state when not reset');
});

describe('getModelAuthoredFlags', () => {
  it('returns undefined for state not produced by buildModelNodeHandler');
  it('returns authored flags attached during handler execution');
});
```

### 4C. Existing test files — gap coverage

After Phase 1 moves code, run coverage. Expected gaps to fill:

**`ModelCompile.test.ts`** — add cases for:
- `resolveClipRangeSeconds` with `clipRangeUnit: 'percent'` where value > 1 (divides by 100)
- `resolveClipRangeSeconds` with negative `clipEnd`
- `compileAnimation` when `clipMeta` is empty
- `compileAnimation` when `gltfUrl` is provided (no clipMeta needed)
- `applyModelExit` at t=0 and t=1 boundary
- `applyModelEnter` at t=0 (enabled check)
- `modelTransitionSpec.interpolate` with undefined optional fields

**`ModelWidget.test.ts`** — add cases for:
- `mergeSnapshot` with `prev=undefined` (first scene)
- `mergeSnapshot` with playback.reset=true
- `mergeSnapshot` with individual animation field authored flags
- `apply()` verifies world scale = `state.model.scale * context.coords.visibleWorldHeight`
- `load()` with missing contained model in manifest (warns, continues)

**`ModelRenderer.test.ts`** (after split) — add cases for `ModelAnimationPlayer`:
- Clip not found (returns without applying)
- `clipRepeat: false` sets `LoopOnce`
- `fadeIn > 0` calls `action.fadeIn()`
- Animation reset when `shouldResetOnProgress` returns true

### 4D. Coverage configuration check

Verify `vitest.config.ts` in `packages/model` includes the new files in the coverage
instrumentation pattern. Ensure `modelBlend.ts`, `modelDslHandler.ts`, `ModelAnimationPlayer.ts`,
`ModelMaterialManager.ts` are all covered. Render.ts and `ModelRenderer.ts` are excluded from
branch coverage (per project convention) since they require Three.js.

---

## Phase 5 — New Model Example

### 5A. Copy model assets

**Action: Copy (not move) from old examples:**
```bash
# Model
cp old_examples_do_no_use/public/assets/robot.no-normals.glb \
   apps/examples/public/assets/model/robot.no-normals.glb

# Animations — three clips, one per carousel panel plus the label scene
cp old_examples_do_no_use/public/assets/motion/chat-relax-f.glb \
   apps/examples/public/assets/model/motion/chat-relax-f.glb

cp old_examples_do_no_use/public/assets/motion/chat-talkandlaugh-f.glb \
   apps/examples/public/assets/model/motion/chat-talkandlaugh-f.glb

cp old_examples_do_no_use/public/assets/motion/chat-relax-m.glb \
   apps/examples/public/assets/model/motion/chat-relax-m.glb
```

All four files are read-only source — do not modify them.

### 5B. Create `apps/examples/public/assets/model/manifest.json`

This is a hand-crafted AssetManifest v2 for the robot example. The implementer must use the
`scripts/extract-model-metadata.mjs` script to generate the actual bone/mesh lists and identity
state, then paste the result here. The template below shows the required shape:

```json
{
  "version": 2,
  "models": [
    {
      "type": "Robot",
      "glb": "/examples/assets/model/robot.no-normals.glb",
      "bones": [],
      "meshes": [],
      "footOffsetY": -130,
      "baseRotation": [0, -1.5707963267948966, 0],
      "anchorTargets": {
        "Head": "CC_Base_Head"
      },
      "bodyParts": ["Head", "Eyes", "Chest"],
      "identity": {
        "model": {
          "scale": 0.18,
          "nvsX": 0.5,
          "nvsY": 0.5,
          "z": 0,
          "rotation": [0, 0, 0],
          "opacity": 1,
          "metalnessMultiplier": 1,
          "roughnessMultiplier": 1
        },
        "playback": {
          "motion": { "commands": [], "scenes": [] },
          "animation": { "enabled": false }
        },
        "nvsBounds": { "x": 0, "y": 0, "w": 1, "h": 1 }
      }
    }
  ],
  "animations": [
    {
      "type": "ChatRelaxF",
      "glb": "/examples/assets/model/motion/chat-relax-f.glb",
      "clipName": "chat-relax-f",
      "duration": 5.4,
      "clipStart": 0.1,
      "clipEnd": -0.8
    },
    {
      "type": "ChatTalkLaughF",
      "glb": "/examples/assets/model/motion/chat-talkandlaugh-f.glb",
      "clipName": "chat-talkandlaugh-f",
      "duration": 4.2,
      "clipStart": 0.1,
      "clipEnd": -0.5
    },
    {
      "type": "ChatRelaxM",
      "glb": "/examples/assets/model/motion/chat-relax-m.glb",
      "clipName": "chat-relax-m",
      "duration": 4.8,
      "clipStart": 0.1,
      "clipEnd": -0.6
    }
  ]
}
```

**Critical:** If `extract-model-metadata.mjs` does not exist or fails, create a minimal valid
manifest with `"bones": []` and `"meshes": []` — the runtime will function without them (they are
advisory metadata for the DSL generator, not used at runtime).

**Animation clip durations** in the template above are approximate from old example metadata.
The implementing bot must inspect each GLB to get exact durations, or read the `duration` value
emitted by `extract-model-metadata.mjs`. Incorrect durations cause clipping artifacts at the
animation loop boundary; they must be accurate.

The `identity` field MUST match `SceneModelInstanceState` exactly. Use the template above as the
baseline and adjust `scale` (0.18) and `footOffsetY` (-130) based on what the old examples used.

### 5C. Widget setup

**File:** `apps/examples/src/model-showcase/widgetSetup.ts`

```typescript
// widgetSetup.ts — Widget plugin setup for the model showcase example.

import { corePlugin, createDefaultWidgetRegistry } from '@brewsite/core';
import { modelPlugin } from '@brewsite/model';

export const modelShowcasePlugin = modelPlugin({
  manifestUrl: '/examples/assets/model/manifest.json',
});

export function createWidgets() {
  return createDefaultWidgetRegistry({});
}
```

### 5D. Scene files

All scenes use `<Scene duration={120}>` (120 scroll units = comfortable scroll per scene).

**File:** `apps/examples/src/model-showcase/scenes/scene01_intro.tsx`

```tsx
// scene01_intro.tsx — Robot fades in from below center, idle pose.

import { Scene } from '@brewsite/core';
import { Model } from '@brewsite/model';

export function scene01_intro() {
  return (
    <Scene duration={120}>
      <Model
        type="Robot"
        id="robot"
        scale={0.18}
        x={0.15} y={0} w={0.7} h={1}
        opacity={1}
        z={0}
      />
    </Scene>
  );
}
```

**File:** `apps/examples/src/model-showcase/scenes/scene02_animation.tsx`

```tsx
// scene02_animation.tsx — Robot plays chat-relax-f animation, shifted right.

import { Scene } from '@brewsite/core';
import { Model, Animation, Playback } from '@brewsite/model';

export function scene02_animation() {
  return (
    <Scene duration={120}>
      <Model
        type="Robot"
        id="robot"
        scale={0.18}
        x={0.25} y={0} w={0.5} h={1}
        opacity={1}
        z={0}
      >
        <Playback>
          <Animation
            enabled
            clipName="chat-relax-f"
            weight={1}
            fadeInSeconds={0.4}
            clipRepeat
          />
        </Playback>
      </Model>
    </Scene>
  );
}
```

**File:** `apps/examples/src/model-showcase/scenes/scene03_labels.tsx`

```tsx
// scene03_labels.tsx — Robot center, head highlighted in accent color with a label.

import { Scene, Hud, HudItem } from '@brewsite/core';
import { Model, BodyParts, BodyPart, Label, LabelItem } from '@brewsite/model';

export function scene03_labels() {
  return (
    <Scene duration={120}>
      <Model
        type="Robot"
        id="robot"
        scale={0.18}
        x={0.1} y={0} w={0.8} h={1}
        opacity={1}
        z={0}
      >
        <Playback>
          <Animation
            enabled
            clipName="chat-relax-f"
            weight={0.6}
            clipRepeat
          />
        </Playback>
        <BodyParts>
          <BodyPart id="Head" color="#7ffcff" opacity={1}>
            <Label
              id="head-label"
              text="Sensor Array"
              labelOffset={[0, 0.35, 0]}
            />
          </BodyPart>
        </BodyParts>
      </Model>
      <Hud>
        <HudItem id="labels">
          <LabelItem label={{ id: 'head-label', text: 'Sensor Array', targetPartId: 'Head' }} />
        </HudItem>
      </Hud>
    </Scene>
  );
}
```

**Note to implementer:** The `<LabelItem>` placement in `<Hud>` is how the label DOM node is
wired into the overlay system. The `LabelPositioner` registered by `modelPlugin` will find the
DOM node by `label.id` and update its position each frame. Verify this wiring against the current
`LabelItem.tsx` implementation — if `LabelItem` registers its own DOM node via `useEffect` and
`useLabelPositioner()`, then `<LabelItem>` can be placed anywhere in the tree, not necessarily
inside `<Hud>`. Confirm the actual contract and place accordingly.

---

**File:** `apps/examples/src/model-showcase/scenes/scene04_view.tsx`

Purpose: demonstrates that a `<Model>` correctly composes its NVS position into a parent `<View>`
region. The robot occupies the right two-thirds of the viewport; the left third is empty space,
making the region boundary visually obvious. The robot plays chat-relax-f to stay alive.

```tsx
// scene04_view.tsx — Model positioned inside a <View> region.
//
// The <View> defines a right-panel NVS region. The <Model> inside it authors
// x={0} y={0} w={1} h={1}, which composes with the View's content bounds so
// the model's NVS center resolves to the center of that region, not the full
// viewport. This confirms api.composeBounds() wiring is correct.

import { Scene, View } from '@brewsite/core';
import { Model, Animation, Playback } from '@brewsite/model';

export function scene04_view() {
  return (
    <Scene duration={120}>
      {/*
        View occupies right 60% of viewport, full height with a small top inset.
        padding={[0.05, 0.04]} = 5% top/bottom, 4% left/right.
      */}
      <View id="right-panel" x={0.38} y={0} w={0.62} h={1} padding={[0.05, 0.04]}>
        <Model
          type="Robot"
          id="robot"
          scale={0.18}
          x={0} y={0} w={1} h={1}
          opacity={1}
          z={0}
        >
          <Playback>
            <Animation
              enabled
              clipName="chat-relax-f"
              weight={0.7}
              fadeInSeconds={0.3}
              clipRepeat
            />
          </Playback>
        </Model>
      </View>
    </Scene>
  );
}
```

**Authoring note:** The robot's absolute NVS center is computed at compile time as:
- `absoluteX = view.contentBounds.x + (0 + 1/2) * view.contentBounds.w`
- `absoluteY = view.contentBounds.y + (0 + 1/2) * view.contentBounds.h`

With `x={0.38} w={0.62}` and `padding={[0.05, 0.04]}` the content bounds are approximately
`x ≈ 0.415, w ≈ 0.54`, so the robot centers at NVS x ≈ 0.685 — clearly right of center.
This is the intended visual: robot occupies the right two-thirds, leaving the left third clear.

---

**File:** `apps/examples/src/model-showcase/scenes/scene05_carousel.tsx`

Purpose: three robot instances in a `<ViewLayout kind="carousel">`, each playing a different
animation clip. The center panel (activeIndex={1}) is the featured robot. Left and right panels
are scaled down and recede in Z, demonstrating the carousel depth effect with living 3D content.

Each robot must have a **unique `id`** prop — they share the same `type="Robot"` manifest entry
but are independent `ModelWidget` instances with independent animation state.

The three animation clips used are the three copied in Phase 5A:
- Panel left (`robot-carousel-a`): `"chat-relax-f"` — relaxed idle
- Panel center (`robot-carousel-b`): `"chat-talkandlaugh-f"` — expressive talking
- Panel right (`robot-carousel-c`): `"chat-relax-m"` — alternate relaxed idle

```tsx
// scene05_carousel.tsx — Three robot instances in a carousel layout.
//
// ViewLayout kind="carousel" positions three Views in a linear fan:
//   - activeIndex=1 → center panel is robot-carousel-b
//   - inactiveScale=0.72 → side panels render at 72% scale
//   - zStep=9 → side panels pushed 9 world-units back in Z
//
// Each Model fills its View's content bounds (x=0 y=0 w=1 h=1).
// Views are sized w=0.38 h=0.88 — slightly taller than wide to give
// the robot vertical room. gap=0.03 separates them.
//
// Three distinct animation clips give each panel a unique character.

import { Scene, ViewLayout, View } from '@brewsite/core';
import { Model, Animation, Playback } from '@brewsite/model';

export function scene05_carousel() {
  return (
    <Scene duration={120}>
      <ViewLayout
        kind="carousel"
        activeIndex={1}
        inactiveScale={0.72}
        zStep={9}
        gap={0.03}
        y={0}
        h={1}
      >
        {/* Panel left — relaxed idle */}
        <View id="carousel-panel-a" w={0.38} h={0.88}>
          <Model
            type="Robot"
            id="robot-carousel-a"
            scale={0.18}
            x={0} y={0} w={1} h={1}
            opacity={1}
            z={0}
          >
            <Playback>
              <Animation
                enabled
                clipName="chat-relax-f"
                weight={1}
                fadeInSeconds={0.3}
                clipRepeat
              />
            </Playback>
          </Model>
        </View>

        {/* Panel center (active) — expressive talking animation */}
        <View id="carousel-panel-b" w={0.38} h={0.88}>
          <Model
            type="Robot"
            id="robot-carousel-b"
            scale={0.18}
            x={0} y={0} w={1} h={1}
            opacity={1}
            z={0}
          >
            <Playback>
              <Animation
                enabled
                clipName="chat-talkandlaugh-f"
                weight={1}
                fadeInSeconds={0.3}
                clipRepeat
              />
            </Playback>
          </Model>
        </View>

        {/* Panel right — alternate relaxed idle */}
        <View id="carousel-panel-c" w={0.38} h={0.88}>
          <Model
            type="Robot"
            id="robot-carousel-c"
            scale={0.18}
            x={0} y={0} w={1} h={1}
            opacity={1}
            z={0}
          >
            <Playback>
              <Animation
                enabled
                clipName="chat-relax-m"
                weight={1}
                fadeInSeconds={0.3}
                clipRepeat
              />
            </Playback>
          </Model>
        </View>
      </ViewLayout>
    </Scene>
  );
}
```

**Implementation notes for the carousel scene:**

1. **Three distinct ModelWidget instances** — the `typeFactory` in `plugin.ts` creates a separate
   `ModelWidget` for each unique `id` prop (`"robot-carousel-a"`, `"robot-carousel-b"`,
   `"robot-carousel-c"`). All three share the same manifest `ModelMeta` for type `"Robot"` but
   maintain independent animation mixers, animation state, and compiled state. No manual
   pre-registration is required.

2. **Scale inside Views** — the `scale={0.18}` on each Model is in world units (or NVS units
   if Phase 2 NVS scale is implemented). The ViewWidget applies a group-level scale multiplier
   on top of this for the carousel shrink effect. The two scales compose correctly: the robot is
   first sized to `scale`, then the whole View group is scaled by `inactiveScale^distance`.

3. **Animation playback in background panels** — all three AnimationMixers run every frame
   regardless of whether the panel is active. This is intentional: background robots should be
   visibly animating (just smaller and recessed), which makes the carousel feel alive. Do not
   gate animation on `activeIndex`.

4. **`id` uniqueness requirement** — `<Model id="robot">` used in scenes 1–4 is a different
   widget instance from `<Model id="robot-carousel-a/b/c">` in scene 5. The compiler looks up
   the widget by `id`, so reusing `"robot"` in the carousel would attach all three carousel
   panels to the same `ModelWidget`, breaking them. Always use unique `id` values across all
   models in the scene graph.

5. **View `w` and `h` as size hints** — Inside a `<ViewLayout>`, the `w` and `h` on `<View>`
   are size hints, not absolute positions. The layout manager centers the active view and fans
   the others out horizontally. Setting `w={0.38}` means each panel is 38% of the container
   width at scale 1.0 (the active panel); inactive panels shrink further by `inactiveScale`.

### 5E. Page component

**File:** `apps/examples/src/model-showcase/ModelShowcasePage.tsx`

```tsx
// ModelShowcasePage.tsx — Model showcase example page.

import type { JSX } from 'react';
import { ScenePlayer, corePlugin } from '@brewsite/core';
import { modelShowcasePlugin, createWidgets } from './widgetSetup';
import { scene01_intro } from './scenes/scene01_intro';
import { scene02_animation } from './scenes/scene02_animation';
import { scene03_labels } from './scenes/scene03_labels';
import { scene04_view } from './scenes/scene04_view';
import { scene05_carousel } from './scenes/scene05_carousel';

export default function ModelShowcasePage(): JSX.Element {
  return (
    <ScenePlayer
      plugins={[corePlugin(), modelShowcasePlugin]}
      getFrame={() => [
        scene01_intro(),       // Scene 1: idle fade-in
        scene02_animation(),   // Scene 2: animation playback
        scene03_labels(),      // Scene 3: body part highlight + label
        scene04_view(),        // Scene 4: model inside a View region
        scene05_carousel(),    // Scene 5: three-model carousel
      ]}
      style={{ width: '100vw', height: '100vh' }}
    />
  );
}
```

### 5F. Update `App.tsx`

Add the new route (lazy import):

```tsx
// In App.tsx — add alongside existing lazy imports:
const ModelShowcasePage = lazy(() => import('./model-showcase/ModelShowcasePage'));

// In <Routes>:
<Route path="/model-showcase" element={<ModelShowcasePage />} />
```

Add to the index list:
```tsx
<li><a href="/examples/model-showcase">Model Showcase — @brewsite/model</a></li>
```

---

## Phase 6 — Documentation Update

### 6A. Update `requirements/model/prd/prd_model.md`

Add the following to the relevant sections:

**Section 7 (API Design) — SceneModel:**
- Update `scale: number` JSDoc to document viewport-relative semantics (multiply by
  `coords.visibleWorldHeight`). Remove any mention of raw world units.
- Remove `instanceTransitionSpec` from the "Transition Functions" section entirely.
- Update the `ModelProps` interface to remove any reference to `nvsScale` — `scale` is the
  only scale prop.

**Section 7 (API Design) — ModelWidget Interface Summary:**
- Remove mention of `__authored` as type bypass. Replace with: "Authored flags are stored in
  a module-level WeakMap in `modelDslHandler.ts`. `SceneModelInstanceState` objects are clean."
- Note that `buildModelNodeHandler`, `getModelAuthoredFlags`, and `ModelAuthoredFlags` are
  internal to the package and not exported from the package barrel.

**Section 8 (Technical Considerations) — add "Module Structure" sub-section:**
```markdown
### Module Structure

| File | Responsibility |
|---|---|
| `types.ts` | State types and shape contracts |
| `dsl.tsx` | DSL prop interfaces |
| `modelBlend.ts` | Pure blend/interpolation helpers |
| `compile.ts` | Transition specs and animation compilation |
| `modelDslHandler.ts` | CUSTOM_NODE_HANDLER factory, DSL merge helpers, authored-flags WeakMap |
| `render.ts` | Stateless world-space transform application |
| `ModelMaterialManager.ts` | Material base caching and override application |
| `ModelAnimationPlayer.ts` | AnimationMixer management and clip application |
| `ModelRenderer.ts` | GLTF loading, scene management, apply() orchestrator |
| `ModelWidget.ts` | IWidget implementation — bridges compile state to render |
```

**Section 8 (Technical Considerations) — update "NVS Coordinate System" sub-section:**
Replace the existing paragraph with:
```markdown
### NVS Scale

`SceneModel.scale` is a viewport-relative factor. The world-space scale applied to the model's
Object3D is always: `worldScale = scale * context.coords.visibleWorldHeight`. A value of `0.06`
is typical for a human figure (≈ 6% of viewport height). This matches how diagram sizes geometry,
ensuring models appear at a consistent visual size across viewport dimensions.
```

**Section 13 (Launch Criteria):**
- Update: "`apps/examples/src/model-showcase/` exists with **5 scenes**: idle intro, animation,
  body part labels, model in a View, and a three-model carousel."
- Add: "Branch coverage for `packages/model/src` is ≥ 80% (excluding render.ts files)."
- Add: "`instanceTransitionSpec` does not appear anywhere in the codebase."

---

## Phase 7 — Build Verification

After implementing all phases, run these commands to verify:

```bash
# TypeScript — all packages
pnpm typecheck

# Tests — model package with coverage
pnpm --filter @brewsite/model vitest run --coverage

# Build — model package only
pnpm --filter @brewsite/model build:lib

# Full library build
pnpm build:lib

# Examples dev build
pnpm dev
```

**Pass criteria:**
- `pnpm typecheck` exits 0 with zero errors
- Model package branch coverage ≥ 80% (exclude `render.ts` files)
- `pnpm build:lib` exits 0
- Navigating to `/examples/model-showcase` shows a 3D robot scene
- Scene 1: robot fades in, idle
- Scene 2: robot animates (chat-relax-f)
- Scene 3: head highlighted with a tracked label
- Scene 4: robot visible in right-panel View only; left third of viewport is empty
- Scene 5: three robots in carousel, all animating independently with different clips
- `grep -r instanceTransitionSpec packages/model/` returns no results

---

## Implementation Order

The phases must be executed in this order due to dependencies:

1. **Phase 1A** (`modelBlend.ts`) — no dependencies; creates the shared blend utilities
2. **Phase 1B** (`modelDslHandler.ts`) — depends on `modelBlend.ts` existing
3. **Phase 1C** (`ModelWidget.ts` slim) — depends on `modelDslHandler.ts`
4. **Phase 1D** (`compile.ts` slim) — depends on `modelBlend.ts`; do after 1A
5. **Phase 1E** (`ModelAnimationPlayer.ts`) — can run in parallel with 1B–1D
6. **Phase 1F** (`ModelMaterialManager.ts`) — can run in parallel with 1B–1D
7. **Phase 1G** (`ModelRenderer.ts` update) — depends on 1E and 1F
8. **Phase 2** (NVS scale) — depends on all Phase 1 complete; touches types/dsl/handler/widget
9. **Phase 3** (compile.ts cleanup) — depends on Phase 1D and Phase 2
10. **Phase 4** (tests) — write tests in parallel with implementation; ensure they pass at end
11. **Phase 5** (example) — depends on Phases 1–3 complete; needs working ModelWidget
12. **Phase 6** (docs) — last; reflects final state of all changes
13. **Phase 7** (verification) — final gate

---

## DEBT Items Resolved by This Plan

| DEBT comment | Resolution |
|---|---|
| `// DEBT: Extract CUSTOM_NODE_HANDLER body into a standalone compileModelNode() function` | Resolved in Phase 1B (`buildModelNodeHandler`) |
| `// DEBT: Replace with WeakMap<> to avoid type-system bypass` | Resolved in Phase 1B (module-level `WeakMap` in `modelDslHandler.ts`) |
| `// DEBT: Extract generic blendArrayById<T>() to reduce duplication` | Partially resolved — functions moved to `modelBlend.ts`; `blendArrayById` generic is a future refactor (too risky to change interface in this PR) |
| `// DEBT: Add tests for configureRegistry error paths, fetchManifest non-ok HTTP, LabelPositionerSyncer` | Not resolved by this plan — tracked separately in `requirements/model/notes/` |
| `// DEBT: Expose bone root remap table as configurable via ModelMeta/LoadOptions` | Not resolved — tracked separately |

---

## What This Plan Does NOT Change

- `LabelPositioner`, `LabelItem`, `LabelPositionerContext` — no changes
- `plugin.ts` — no changes
- `handlers.ts` — no changes
- `metadata.ts` — no changes
- `animationTrackMapping.ts` — no changes
- `labels/` directory — no changes
- `compiler/labelCompiler.ts` — no changes
- `widget/types.ts` — no changes
- The `modelPlugin()` factory contract — no changes
- The manifest schema (`AssetManifest` v2) — no changes

## Breaking Changes Summary

| What changes | Old behavior | New behavior |
|---|---|---|
| `SceneModel.scale` semantics | Raw Three.js world-unit scalar | Viewport-relative: `worldScale = scale * coords.visibleWorldHeight` |
| `instanceTransitionSpec` export | Exported (deprecated) | Deleted entirely |
| `__authored` on state objects | String property on `SceneModelInstanceState` | `WeakMap` in `modelDslHandler.ts` — state objects are clean |
