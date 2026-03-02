---
title: "Functional Runtime Transitions"
doc_type: plan
owner: brewflow-architect
status: active
updated: 2026-02-25
---

# Functional Runtime Transitions

## 0. Background and Motivation

The current compiler pre-bakes every transition frame as a discrete state snapshot. The
`ElementTransitionSpec<T>` interface hands each widget a slice of the flat `SceneTrackTick[]`
array and asks it to fill every slot. The runtime then does an O(1) lookup by rounding
`globalProgress` to the nearest tick index and calling `renderable.apply(prebakedState)`.

This model has two structural problems:

**Problem 1 — Easing fidelity is limited by oversampling.** The only way to make a
spring, bounce, or bezier-eased transition look smooth is to increase `OVERSAMPLING_RATE`,
which multiplies memory and compile time. A 10× oversampling rate is a tax paid on every
widget's transition to compensate for the discrete approximation.

**Problem 2 — Physics and non-trivial curves are impossible.** Spring simulations,
overshoot, and velocity-aware easing require evaluating a differential equation. Discrete
pre-baking cannot represent these without choosing a fixed framerate in advance, which is
wrong for scroll-driven playback where the user may seek at any rate.

**The observation that makes this tractable**: `tick.blockProgress` is already computed
for every tick — it is `posInBlock / (blockSize - 1) ∈ [0, 1]`. This is the exact `t`
value needed to evaluate a transition at any moment. The sampler does not need to change.

**Key insight from model/compile.ts**: The model element has already decomposed its
transition logic into pure `(state, t) → state` helpers:
`applyModelExit`, `applyModelEnter`, `applyModelInterpolate`. The current
`instanceTransitionSpec` is just a `for` loop over these helpers. Functional transitions
formalize this pattern as the primary API.

**What this plan does**: Adds `FunctionalTransitionSpec<T>` as an alternative to
`ElementTransitionSpec<T>`. Widgets may use either. The compiler stores closures for
functional widgets instead of filling discrete frame slots. The runtime evaluates these
closures at `tick.blockProgress`. Existing discrete specs are fully preserved.

---

## 1. Architecture Summary

### Data Flow Before This Plan
```
Compile time:  ElementTransitionSpec → fills SceneTrackTick[].state.widgets[id]
Runtime:       sampler.sample(p) → tick → tick.state.widgets[id] → apply(state)
```

### Data Flow After This Plan
```
Compile time:  FunctionalTransitionSpec → captures closure → stored in SceneTrack.transitionBlocks
               ElementTransitionSpec    → fills SceneTrackTick[].state.widgets[id]  (unchanged)

Runtime:       sampler.sample(p) → tick
               if transitionBlocks[tick.sceneIndex]?.widgetFns[widgetId] exists:
                 → fn(tick.blockProgress) → state → apply(state)   [NEW PATH]
               else:
                 → tick.state.widgets[widgetId] → apply(state)      [existing path]
```

The sampler is **unchanged**. The `tick.blockProgress` field already carries the
fractional `t`. No new sampling logic is required.

### Dependency Direction (unchanged, verified)
```
types.ts ← dsl.tsx ← compile.ts ← render.ts
                               ↑
                   transitionTypes.ts (compile-time only)
```
`FunctionalTransitionSpec` lives in `transitionTypes.ts`. It has no Three.js or React
imports. The runtime reads closures from `SceneTrack.transitionBlocks` — it does not
import `transitionTypes.ts`. The dependency direction is preserved.

---

## 2. New Type Contracts

### 2.1 `src/compiler/transitions/transitionTypes.ts` — ADD (no removals)

Insert after the existing `ElementTransitionSpec<T>` type. Do not modify `ElementTransitionSpec`.

```typescript
/**
 * Functional transition spec — closure-based alternative to ElementTransitionSpec.
 *
 * The compiler calls these once at compile time with the known endpoint states,
 * capturing them into closures. Each closure is stored in SceneTrack.transitionBlocks
 * and evaluated by the runtime at tick.blockProgress each frame.
 *
 * t semantics (same as transitionT in the discrete path):
 *   exitFn:        t = 0 → widget at fromState.  t = 1 → widget fully absent.
 *   enterFn:       t = 0 → widget fully absent.  t = 1 → widget at toState.
 *   interpolateFn: t = 0 → widget at fromState.  t = 1 → widget at toState.
 *
 * Half-block semantics are handled by the compiler wrapper (see sceneTrackCompiler.ts
 * §3.3). Widget authors write closures that expect t ∈ [0, 1] only.
 */
export type FunctionalTransitionSpec<T> = {
  /**
   * Widget is leaving (present in scene N, absent from N+1).
   * Called once with fromState. Returns a pure function of t ∈ [0, 1].
   * Active over the first half of the block (blockProgress ∈ [0, 0.5)).
   */
  exitFn: (fromState: T) => (t: number) => T;

  /**
   * Widget is arriving (absent from scene N, present in N+1).
   * Called once with toState. Returns a pure function of t ∈ [0, 1].
   * Active over the second half of the block (blockProgress ∈ [0.5, 1]).
   */
  enterFn: (toState: T) => (t: number) => T;

  /**
   * Widget present in both scenes.
   * Called once with (fromState, toState). Returns a pure function of t ∈ [0, 1].
   * Active over the full block (blockProgress ∈ [0, 1]).
   */
  interpolateFn: (fromState: T, toState: T) => (t: number) => T;
};

/**
 * Type guard: returns true if spec is a FunctionalTransitionSpec.
 * Used by the compiler to branch between discrete fill and closure capture.
 */
export const isFunctionalSpec = <T>(
  spec: ElementTransitionSpec<T> | FunctionalTransitionSpec<T>,
): spec is FunctionalTransitionSpec<T> => 'interpolateFn' in spec;
```

**No other changes to this file.** All blend helpers (`lerp`, `lerpVec3`,
`blendNumber`, `blendOpacity`, `blendVec3`, `blendColor`, `blendAxisRotation`,
`blendAxisTranslation`, `blendDistance`, `blendStyleValues`, `blendStyleValuesPartial`,
`resolveTransitionOpacity`, `resolveEnabledByOpacity`, `clamp01`, `mergeCssOpacity`,
`transitionT`) remain exactly as-is.

---

### 2.2 `src/compiler/sceneTrackTypes.ts` — ADD (no removals)

Insert after the existing `SceneFrameDelta` type block and before `SceneWindow`.

```typescript
// ─── Functional Transition Types ──────────────────────────────────────────────

/**
 * A compiled functional transition closure for one widget in one transition block.
 * fn accepts blockProgress ∈ [0, 1] (the same coordinate as SceneTrackTick.blockProgress).
 * Half-block remapping for exit/enter is applied by the compiler before this closure
 * is stored, so the caller (RuntimeDriver) passes blockProgress directly with no
 * additional transformation.
 */
export type FunctionalWidgetTransition = {
  /**
   * Evaluate this widget's state at blockProgress ∈ [0, 1].
   * For exit/enter closures: returns absentDefault when blockProgress is outside
   * the active half-block — the remapping is already baked into this closure.
   * For interpolate closures: maps blockProgress 0→1 to fromState→toState.
   */
  fn: (blockProgress: number) => unknown;
  /** Diagnostic tag — identifies which transition scenario produced this closure. */
  kind: 'exit' | 'enter' | 'interpolate';
};

/**
 * Functional transition overrides for one scene-to-scene transition block.
 * blockIndex N corresponds to the transition from scenes[N] to scenes[N+1].
 * Only present when at least one widget in that block uses FunctionalTransitionSpec.
 */
export type SceneTrackTransitionBlock = {
  blockIndex: number;
  widgetFns: Record<string, FunctionalWidgetTransition>;
};
```

Then extend `SceneTrack`:

```typescript
export type SceneTrack = {
  ticks: SceneTrackTick[];
  tickStep: number;
  subTickCount: number;
  sceneWindows: SceneWindow[];
  /**
   * Functional transition closures, indexed by block index (0 = scene 0→1 transition).
   * Present only when at least one widget uses FunctionalTransitionSpec.
   * Length ≤ numScenes - 1.
   */
  transitionBlocks?: SceneTrackTransitionBlock[];
};
```

**All other types in this file are unchanged**: `ClipMeta`, `SceneFrame`,
`SceneFrameDelta`, `SceneWindow`, `SceneTrackTick`.

---

### 2.3 `src/widget/types.ts` — WIDEN one field

Change line 14 from:
```typescript
readonly transitionSpec: ElementTransitionSpec<TState>;
```
to:
```typescript
readonly transitionSpec: ElementTransitionSpec<TState> | FunctionalTransitionSpec<TState>;
```

Add the import at the top of the file alongside the existing `ElementTransitionSpec` import:
```typescript
import type { ElementTransitionSpec, FunctionalTransitionSpec } from '../compiler/transitions/transitionTypes';
```

**No other changes to this file.** `isSceneElement()` in `WidgetRegistry.ts` checks
`'transitionSpec' in w` — functional spec objects also have this key, so the type guard
continues to work without modification.

---

## 3. Compiler Changes

### 3.1 File: `src/compiler/sceneTrackCompiler.ts`

**Add import** at the top alongside existing imports:
```typescript
import { isFunctionalSpec } from './transitions/transitionTypes';
import type { SceneTrackTransitionBlock } from './sceneTrackTypes';
```

**In `compileSceneTrack`**, after allocating `frames` (Step 2) and before Step 3, add:
```typescript
// Accumulates functional closures per block. Populated during Step 3 when a widget
// uses FunctionalTransitionSpec instead of filling discrete frames.
const transitionBlocks: SceneTrackTransitionBlock[] = [];
```

**Step 3 — replace the widget loop body** (the inner `for (const widget of ...)` loop).
The outer `for (let n = 0; n < numTransitions; n++)` loop structure is unchanged.

Current inner loop body:
```typescript
for (const widget of widgetRegistry.getSceneElements()) {
  const { widgetId, defaultState, transitionSpec } = widget;
  const useDefaultWhenAbsent =
    (widget as { useDefaultStateWhenAbsent?: boolean }).useDefaultStateWhenAbsent !== false;
  const absentDefault = useDefaultWhenAbsent ? defaultState : makeDisabledDefault(defaultState);
  const fromState = fromSnap.widgets[widgetId];
  const toState   = toSnap.widgets[widgetId];
  const inFrom    = fromState !== undefined;
  const inTo      = toState   !== undefined;

  if (inFrom && inTo) {
    transitionSpec.interpolate(block, widgetId, fromState as never, toState as never);
  } else if (inFrom) {
    transitionSpec.exit(block.slice(0, mid), widgetId, fromState as never);
    for (let i = mid; i < block.length; i++) {
      block[i]!.state.widgets[widgetId] = absentDefault;
    }
  } else if (inTo) {
    const firstHalfState = useDefaultWhenAbsent ? toState : absentDefault;
    for (let i = 0; i < mid; i++) {
      block[i]!.state.widgets[widgetId] = firstHalfState as never;
    }
    transitionSpec.enter(block.slice(mid), widgetId, toState as never);
  } else {
    for (const frame of block) {
      frame.state.widgets[widgetId] = absentDefault;
    }
  }
}
```

Replace with:
```typescript
for (const widget of widgetRegistry.getSceneElements()) {
  const { widgetId, defaultState, transitionSpec } = widget;
  const useDefaultWhenAbsent =
    (widget as { useDefaultStateWhenAbsent?: boolean }).useDefaultStateWhenAbsent !== false;
  const absentDefault = useDefaultWhenAbsent ? defaultState : makeDisabledDefault(defaultState);
  const fromState = fromSnap.widgets[widgetId];
  const toState   = toSnap.widgets[widgetId];
  const inFrom    = fromState !== undefined;
  const inTo      = toState   !== undefined;

  // ── Functional path ─────────────────────────────────────────────────────────
  // Widget uses FunctionalTransitionSpec: capture a closure instead of filling frames.
  // The closure wraps the author's t ∈ [0,1] function with half-block remapping so
  // the runtime may call fn(tick.blockProgress) with no further transformation.
  if (isFunctionalSpec(transitionSpec)) {
    if (!inFrom && !inTo) {
      // Absent from both scenes — no closure needed; fill frames discretely.
      for (const frame of block) {
        frame.state.widgets[widgetId] = absentDefault;
      }
      continue;
    }

    // Ensure a block entry exists for index n
    const tBlock: SceneTrackTransitionBlock = transitionBlocks[n] ?? { blockIndex: n, widgetFns: {} };
    transitionBlocks[n] = tBlock;

    if (inFrom && inTo) {
      const rawFn = transitionSpec.interpolateFn(fromState as never, toState as never);
      tBlock.widgetFns[widgetId] = {
        fn: (bp: number) => rawFn(bp),
        kind: 'interpolate',
      };
    } else if (inFrom) {
      const rawFn = transitionSpec.exitFn(fromState as never);
      tBlock.widgetFns[widgetId] = {
        // Active first half: blockProgress [0, 0.5) → t [0, 1). Second half → absentDefault.
        fn: (bp: number) => bp < 0.5 ? rawFn(bp * 2) : absentDefault,
        kind: 'exit',
      };
    } else {
      // inTo only
      const rawFn = transitionSpec.enterFn(toState as never);
      tBlock.widgetFns[widgetId] = {
        // Active second half: blockProgress [0.5, 1] → t [0, 1]. First half → absentDefault.
        fn: (bp: number) => bp >= 0.5 ? rawFn((bp - 0.5) * 2) : absentDefault,
        kind: 'enter',
      };
    }
    // Do NOT write to frame.state.widgets[widgetId] — left absent for runtime evaluation.
    continue;
  }

  // ── Discrete path (unchanged) ─────────────────────────────────────────────
  if (inFrom && inTo) {
    transitionSpec.interpolate(block, widgetId, fromState as never, toState as never);
  } else if (inFrom) {
    transitionSpec.exit(block.slice(0, mid), widgetId, fromState as never);
    for (let i = mid; i < block.length; i++) {
      block[i]!.state.widgets[widgetId] = absentDefault;
    }
  } else if (inTo) {
    const firstHalfState = useDefaultWhenAbsent ? toState : absentDefault;
    for (let i = 0; i < mid; i++) {
      block[i]!.state.widgets[widgetId] = firstHalfState as never;
    }
    transitionSpec.enter(block.slice(mid), widgetId, toState as never);
  } else {
    for (const frame of block) {
      frame.state.widgets[widgetId] = absentDefault;
    }
  }
}
```

**Step 5 — update widgetExtras compilation** to support functional widgets that also
implement `compileExtra`. The current Step 5 reads `frame.state.widgets[widget.widgetId]`
which will be `undefined` for functional widgets. Update to fall back to the closure:

```typescript
// ── Step 5: Compile widgetExtras via compileExtra() ─────────────────────────
for (const frame of frames) {
  const extras: Record<string, unknown> = {};
  for (const widget of widgetRegistry.getSceneElements()) {
    if (!widget.compileExtra) continue;

    // Prefer discrete state; fall back to evaluating the functional closure.
    let state: unknown = frame.state.widgets[widget.widgetId];
    if (state === undefined) {
      const tBlock = transitionBlocks[frame.sceneIndex];
      const funcOverride = tBlock?.widgetFns[widget.widgetId];
      if (funcOverride) {
        state = funcOverride.fn(frame.blockProgress);
      }
    }
    if (state === undefined) continue;

    extras[widget.widgetId] = widget.compileExtra(state as never, {
      sceneProgress: frame.blockProgress,
      globalProgress: frame.progress,
      clipMeta: options.clipMeta ?? [],
      prefersReducedMotion: options.prefersReducedMotion ?? false,
    });
  }
  if (Object.keys(extras).length > 0) frame.widgetExtras = extras;
}
```

**Step 7 (delta computation)** — unchanged. Functional widgets do not write to
`frame.state.widgets`, so their slots always appear identical across adjacent ticks in
the discrete state. The resulting empty deltas for those widget slots are correct —
delta compression has no meaning for runtime-evaluated state.

**Return value** — extend the returned `SceneTrack` to include `transitionBlocks`:

```typescript
return {
  ticks:            frames,
  tickStep,
  subTickCount:     totalFrames,
  sceneWindows,
  ...(transitionBlocks.length > 0 ? { transitionBlocks } : {}),
};
```

Only include `transitionBlocks` when non-empty to preserve backward compatibility with
tests and consumers that do not expect the field.

---

## 4. Runtime Changes

### 4.1 File: `src/runtime/RuntimeDriver.ts`

**Step 1: Store the track reference.**

Add a private field alongside `private sampler`:
```typescript
private track: SceneTrack | null = null;
```

In `setSceneTrack`:
```typescript
setSceneTrack(track: SceneTrack): void {
  this.sampler = createSceneTrackSampler(track);
  this.track = track;  // NEW: retained for transitionBlocks lookup
}
```

In `dispose`, clear it:
```typescript
dispose(): void {
  // ... existing widget disposal ...
  this.sampler = null;
  this.track   = null;  // NEW
  this.currentTick = null;
}
```

**Step 2: Update the tick loop** (Step 3 of the existing `tick()` method — renderable
application). Replace the inner `const state = ...` line:

Current:
```typescript
const state = tick.state.widgets[renderable.widgetId] ?? (
  this.widgetRegistry.getSceneElements().find(e => e.widgetId === renderable.widgetId)?.defaultState
);
```

Replace with:
```typescript
// Functional transitions take priority: evaluate closure at blockProgress.
// Falls back to pre-baked discrete state, then widget defaultState.
const functionalBlock  = this.track?.transitionBlocks?.[tick.sceneIndex];
const functionalWidget = functionalBlock?.widgetFns[renderable.widgetId];
const state = functionalWidget
  ? functionalWidget.fn(tick.blockProgress)
  : (tick.state.widgets[renderable.widgetId] ??
     this.widgetRegistry.getSceneElements()
       .find(e => e.widgetId === renderable.widgetId)?.defaultState);
```

**No other changes to `RuntimeDriver.ts`.** The `SceneTrackTick` shape, animation
controller tick loop, `getBoneWorldPositions()`, `getTargetColors()`, and all other
methods are unchanged.

**Performance note**: `transitionBlocks` is an array indexed by `tick.sceneIndex`
(an integer). The property access is O(1). `widgetFns` is a plain object keyed by
`widgetId` string — also O(1). The closure call itself is the cost of the transition
function body. This is equivalent to the CPU cost the compiler previously paid for a
single tick.

---

## 5. Widget Migration: Model Element

The model element is migrated first because it already has the functional form
partially implemented. The `applyModelExit`, `applyModelEnter`, and
`applyModelInterpolate` functions in `src/elements/model/compile.ts` ARE the functional
closures — they just need to be exposed as a `FunctionalTransitionSpec`.

### 5.1 File: `src/elements/model/compile.ts`

**Add import** for the new type:
```typescript
import type { ElementTransitionSpec, FunctionalTransitionSpec } from '../../compiler/transitions/transitionTypes';
```
(Replace the existing `ElementTransitionSpec`-only import.)

**Add `functionalInstanceTransitionSpec`** after the existing
`instanceTransitionSpec` declaration. Do NOT remove or modify `instanceTransitionSpec` —
it remains for backward compatibility during migration:

```typescript
/**
 * Functional form of the model instance transition spec.
 * Preferred over instanceTransitionSpec for new scenes — evaluates at runtime for
 * infinite easing fidelity without oversampling.
 */
export const functionalInstanceTransitionSpec: FunctionalTransitionSpec<SceneModelInstanceState> = {
  exitFn:        (from)       => (t) => applyModelExit(from, t),
  enterFn:       (to)         => (t) => applyModelEnter(to, t),
  interpolateFn: (from, to)   => (t) => applyModelInterpolate(from, to, t),
};
```

`applyModelExit`, `applyModelEnter`, `applyModelInterpolate` are already exported pure
functions. No changes to their implementations.

**In the ModelWidget class** (in `src/elements/model/render.ts` or wherever the widget
class is defined), change the `transitionSpec` property to use the functional spec:

Locate the line:
```typescript
readonly transitionSpec = instanceTransitionSpec;
```
Change to:
```typescript
readonly transitionSpec = functionalInstanceTransitionSpec;
```

Import `functionalInstanceTransitionSpec` instead of (or in addition to)
`instanceTransitionSpec` in that file.

The old `instanceTransitionSpec` stays in `compile.ts` as a named export for use in
tests and any external consumers. It is not deleted.

---

## 6. Widget Migration: Remaining Elements

Each element adds a `FunctionalTransitionSpec` export to its `compile.ts` and updates
its Widget class's `transitionSpec` property. The discrete spec is preserved but no
longer used by the widget class.

### 6.1 File: `src/elements/background/compile.ts`

**Add import** for `FunctionalTransitionSpec`.

**Add `functionalBackgroundTransitionSpec`**:

```typescript
export const functionalBackgroundTransitionSpec: FunctionalTransitionSpec<SceneBackground> = {
  exitFn: (from) => (t) => ({
    ...from,
    opacity: blendOpacity(from.opacity, 0, t),
  }),
  enterFn: (to) => (t) => ({
    ...to,
    opacity: blendOpacity(0, to.opacity, t),
  }),
  interpolateFn: (from, to) => (t) => ({
    imageUrl:    selectImageUrl(from.imageUrl, to.imageUrl, t),
    opacity:     crossFadeOpacity(from, to, t),
    position:    blendVec3(from.position, to.position, t),
    cssPosition: t < 0.5 ? from.cssPosition : to.cssPosition,
    cssSize:     t < 0.5 ? from.cssSize     : to.cssSize,
    cssRepeat:   t < 0.5 ? from.cssRepeat   : to.cssRepeat,
  }),
};
```

`selectImageUrl` and `crossFadeOpacity` are existing module-private helpers in
`background/compile.ts`. Verify they accept plain `number` for `t` — they should
already based on current usage. If they accept `TransitionContext` instead of `number`,
refactor them to accept `number` directly (the context field used is always `tFull`).

**Update `BackgroundWidget.ts`** — change `transitionSpec` property to
`functionalBackgroundTransitionSpec`.

---

### 6.2 File: `src/elements/lighting/compile.ts`

**Add import** for `FunctionalTransitionSpec`.

Verify that the existing module-private helpers `blendLightArray`, `blendSpots`,
`blendPanels` (or their equivalents) already accept `t: number` as their last argument.
If they accept `TransitionContext`, add a plain `t: number` overload or refactor — the
existing blend helpers in `transitionTypes.ts` (`blendNumber`, `blendColor`, etc.) all
already take `t: number`.

**Add `functionalLightingTransitionSpec`**:

```typescript
export const functionalLightingTransitionSpec: FunctionalTransitionSpec<SceneLighting> = {
  exitFn: (from) => (t) => applyLightingExit(from, t),
  enterFn: (to) => (t) => applyLightingEnter(to, t),
  interpolateFn: (from, to) => (t) => applyLightingInterpolate(from, to, t),
};
```

Where `applyLightingExit`, `applyLightingEnter`, `applyLightingInterpolate` are new
module-private helper functions extracted from the existing `lightingTransitionSpec`
body (same pattern as the model element). Extract these helpers before writing the
functional spec.

**Update `LightingWidget.ts`** — change `transitionSpec` to
`functionalLightingTransitionSpec`.

---

### 6.3 File: `src/elements/floor/compile.ts`

**Add import** for `FunctionalTransitionSpec`.

**Add `functionalFloorTransitionSpec`**:

```typescript
export const functionalFloorTransitionSpec: FunctionalTransitionSpec<SceneFloor> = {
  exitFn: (from) => (t) => ({
    textureUrl: from.textureUrl,
    enabled:    (from.enabled ?? true) && t < 1,
  }),
  enterFn: (to) => (t) => ({
    textureUrl: to.textureUrl,
    enabled:    (to.enabled ?? true) && t > 0,
  }),
  interpolateFn: (from, to) => (t) => ({
    textureUrl: t < 0.5 ? from.textureUrl : to.textureUrl,
    enabled:    ((from.enabled ?? true) && t < 1) || ((to.enabled ?? true) && t > 0),
  }),
};
```

Inspect `SceneFloor` in `src/elements/floor/types.ts` to confirm these are the only
fields. If additional fields exist (opacity, position, etc.), apply the same blend
pattern as the existing discrete spec.

**Update `FloorWidget.ts`** — change `transitionSpec` to
`functionalFloorTransitionSpec`.

---

### 6.4 File: `src/elements/environment/compile.ts`

**Add import** for `FunctionalTransitionSpec`.

**Add `functionalEnvironmentTransitionSpec`**:

```typescript
export const functionalEnvironmentTransitionSpec: FunctionalTransitionSpec<SceneEnvironment> = {
  exitFn: (from) => (t) => ({
    ...from,
    enabled:   (from.enabled ?? true) && t < 1,
    intensity: blendNumber(from.intensity, 0, t),
  }),
  enterFn: (to) => (t) => ({
    ...to,
    enabled:   (to.enabled ?? true) && t > 0,
    intensity: blendNumber(0, to.intensity, t),
  }),
  interpolateFn: (from, to) => (t) => {
    const bothEnabled = (from.enabled ?? true) && (to.enabled ?? true);
    return {
      url:       t < 0.5 ? from.url    : to.url,
      preset:    t < 0.5 ? from.preset : to.preset,
      enabled:   bothEnabled ? true : ((to.enabled ?? true) && t > 0) || ((from.enabled ?? true) && t < 1),
      intensity: blendNumber(from.intensity, to.intensity, t),
    };
  },
};
```

Inspect `SceneEnvironment` in `src/elements/environment/types.ts` to confirm all fields
are covered. Add any additional fields following the same discrete-switch-at-0.5 or
blend pattern as the existing spec.

**Update `EnvironmentWidget.ts`** — change `transitionSpec` to
`functionalEnvironmentTransitionSpec`.

---

### 6.5 File: `src/elements/camera/compile.ts`

**Add import** for `FunctionalTransitionSpec`.

Read `src/elements/camera/types.ts` to determine `SceneCamera` field types. Then:

1. Extract module-private helpers `applyCameraExit(from, t)`, `applyCameraEnter(to, t)`,
   `applyCameraInterpolate(from, to, t)` from the existing `cameraTransitionSpec` body,
   replacing any `TransitionContext` usage with plain `t: number`.

2. Add:
```typescript
export const functionalCameraTransitionSpec: FunctionalTransitionSpec<SceneCamera> = {
  exitFn:        (from)     => (t) => applyCameraExit(from, t),
  enterFn:       (to)       => (t) => applyCameraEnter(to, t),
  interpolateFn: (from, to) => (t) => applyCameraInterpolate(from, to, t),
};
```

**Update `CameraWidget.ts`** — change `transitionSpec` to
`functionalCameraTransitionSpec`.

---

## 7. Testing Strategy

All tests follow the project's **interface-based stateful test** philosophy. Tests
assert on observable contract outputs — not on which internal functions were called.

### 7.1 New test file: `src/compiler/__tests__/functionalTransitions.test.ts`

**Purpose**: Validate that the compiler correctly captures closures and that the runtime
correctly evaluates them.

**Test setup** (helper widgets):

```typescript
import { describe, it, expect } from 'vitest';
import { compileSceneTrack } from '../sceneTrackCompiler';
import type { FunctionalTransitionSpec } from '../transitions/transitionTypes';
import type { SceneDefinition } from '../sceneTypes';

// A minimal state type for testing.
type TestState = { value: number; active: boolean };

// A functional spec that linearly blends a numeric field.
const testFunctionalSpec: FunctionalTransitionSpec<TestState> = {
  exitFn:        (from)     => (t) => ({ value: from.value * (1 - t), active: t < 1 }),
  enterFn:       (to)       => (t) => ({ value: to.value * t,         active: t > 0 }),
  interpolateFn: (from, to) => (t) => ({ value: from.value + (to.value - from.value) * t, active: true }),
};

// A minimal widget conforming to ISceneElement
const makeTestWidget = (widgetId: string): ISceneElement<TestState> => ({
  widgetId,
  defaultState:   { value: 0, active: false },
  transitionSpec: testFunctionalSpec,
  DslComponent:   (() => null) as any,
});

// A minimal scene definition
const makeScene = (id: string, index: number, widgetState?: TestState): SceneDefinition => ({
  id,
  index,
  getFrame: () => ({
    id,
    scrollProgress: 0,
    widgets: widgetState ? { [widgetId]: widgetState } : {},
  }),
});
```

**Required test cases**:

1. **`transitionBlocks` is present when functional spec is used**
   - 2 scenes, widget in both, functional spec
   - Assert `track.transitionBlocks` is defined and has length 1
   - Assert `track.transitionBlocks[0].widgetFns[widgetId]` is defined with `kind: 'interpolate'`

2. **`transitionBlocks` is absent when only discrete specs are used**
   - 2 scenes, widget uses `ElementTransitionSpec`
   - Assert `track.transitionBlocks` is undefined

3. **Functional closure evaluates correctly at t=0 (interpolate)**
   - fromState `{ value: 10 }`, toState `{ value: 20 }`
   - Evaluate `track.transitionBlocks[0].widgetFns[widgetId].fn(0)`
   - Assert result: `{ value: 10, active: true }`

4. **Functional closure evaluates correctly at t=1 (interpolate)**
   - Same setup
   - Evaluate `fn(1.0)`
   - Assert result: `{ value: 20, active: true }`

5. **Functional closure evaluates correctly at midpoint (interpolate)**
   - Evaluate `fn(0.5)`
   - Assert result: `{ value: 15, active: true }`

6. **Exit closure: active in first half, absent state in second half**
   - Widget in scene 0 only, functional spec
   - `kind === 'exit'`
   - `fn(0.0)` → `{ value: 10, active: true }` (t=0 → fromState)
   - `fn(0.25)` → value between 10 and 0, active: true
   - `fn(0.5)` → `defaultState` (`{ value: 0, active: false }`) (second half starts)
   - `fn(1.0)` → `defaultState`

7. **Enter closure: absent state in first half, active in second half**
   - Widget in scene 1 only, functional spec
   - `kind === 'enter'`
   - `fn(0.0)` → `defaultState`
   - `fn(0.49)` → `defaultState`
   - `fn(0.5)` → `{ value: 0, active: false }` (t=0 → widget entering)
   - `fn(1.0)` → `{ value: toState.value, active: true }`

8. **Absent from both scenes — no closure, frame state is defaultState**
   - Widget in neither scene, functional spec
   - Assert `track.transitionBlocks?.[0]?.widgetFns[widgetId]` is undefined
   - Assert `track.ticks[0].state.widgets[widgetId]` equals `defaultState`

9. **`compileExtra` fires correctly for functional widgets**
   - Widget with functional spec AND `compileExtra` implementation
   - Assert `track.ticks[midTick].widgetExtras?.[widgetId]` is defined
   - Assert the extra value reflects the state at that tick's `blockProgress`
   - Specifically: at `blockProgress = 0.5`, `compileExtra` should receive the state
     produced by `fn(0.5)`, not `defaultState`

10. **Mixed mode: one functional widget + one discrete widget in same track**
    - Two widgets: `widgetA` with functional spec, `widgetB` with discrete spec
    - Both in both scenes
    - Assert `track.transitionBlocks[0].widgetFns['widgetA']` is defined
    - Assert `track.ticks[0].state.widgets['widgetB']` is defined (discrete, still baked)
    - Assert `track.ticks[0].state.widgets['widgetA']` is undefined (functional, not baked)

11. **blockProgress boundary: terminal tick has no functional override**
    - The terminal tick has `sceneIndex = lastSceneIndex`
    - There is no `transitionBlocks[lastSceneIndex]` (N blocks for N+1 scenes, blocks
      index 0..N-2)
    - Assert the terminal tick correctly falls through to the discrete state path

---

### 7.2 Update: `src/compiler/__tests__/sceneTrackCompiler.test.ts`

Add one new test group: **"functional spec integration"** that verifies the existing
discrete test cases are not broken when both spec types are mixed in the same track.

No changes to existing test cases — they all use discrete specs and must continue to pass.

---

### 7.3 Update: `src/elements/model/__tests__/ModelCompile.test.ts`

Add a test group for `functionalInstanceTransitionSpec`:

```typescript
describe('functionalInstanceTransitionSpec', () => {
  it('exit at t=0 returns fromState (no change)', () => {
    const fn = functionalInstanceTransitionSpec.exitFn(baseState);
    const result = fn(0);
    expect(result.model.opacity).toBe(baseState.model.opacity ?? 1);
    expect(result.enabled).toBe(baseState.enabled);
  });

  it('exit at t=1 returns fully disabled state', () => {
    const fn = functionalInstanceTransitionSpec.exitFn(baseState);
    const result = fn(1);
    expect(result.model.opacity).toBeCloseTo(0);
    expect(result.enabled).toBe(false);
  });

  it('enter at t=0 returns invisible/disabled state', () => {
    const fn = functionalInstanceTransitionSpec.enterFn(baseState);
    const result = fn(0);
    expect(result.model.opacity).toBeCloseTo(0);
  });

  it('enter at t=1 returns toState fully visible', () => {
    const fn = functionalInstanceTransitionSpec.enterFn(baseState);
    const result = fn(1);
    expect(result.model.opacity).toBeCloseTo(baseState.model.opacity ?? 1);
  });

  it('interpolate at t=0 returns fromState values', () => {
    const fn = functionalInstanceTransitionSpec.interpolateFn(fromState, toState);
    const result = fn(0);
    expect(result.model.position).toEqual(fromState.model.position);
  });

  it('interpolate at t=1 returns toState values', () => {
    const fn = functionalInstanceTransitionSpec.interpolateFn(fromState, toState);
    const result = fn(1);
    expect(result.model.position).toEqual(toState.model.position);
  });

  it('interpolate at t=0.5 blends position midpoint', () => {
    const fn = functionalInstanceTransitionSpec.interpolateFn(fromState, toState);
    const result = fn(0.5);
    const expectedX = (fromState.model.position[0] + toState.model.position[0]) / 2;
    expect(result.model.position[0]).toBeCloseTo(expectedX);
  });
});
```

These tests call the closures as pure functions. No mock, no frame array, no registry.
They test the contract of the functional spec in isolation.

---

### 7.4 Update: element compile tests for migrated elements

For each migrated element (background, lighting, floor, environment, camera), add or
update the compile test file to include a `functional spec` test group following the
same pattern as §7.3:
- `exitFn(from)(0)` → at-from-state assertion
- `exitFn(from)(1)` → fully-gone assertion
- `enterFn(to)(0)` → fully-absent assertion
- `enterFn(to)(1)` → at-to-state assertion
- `interpolateFn(from, to)(0)` → fromState assertion
- `interpolateFn(from, to)(1)` → toState assertion
- `interpolateFn(from, to)(0.5)` → midpoint blend assertion

These tests are located at:
- `src/elements/background/__tests__/BackgroundCompile.test.ts`
- `src/elements/lighting/__tests__/LightingCompile.test.ts`
- `src/elements/floor/__tests__/FloorCompile.test.ts`
- `src/elements/environment/__tests__/EnvironmentCompile.test.ts`
- `src/elements/camera/__tests__/CameraCompile.test.ts` (create if it doesn't exist)

---

### 7.5 RuntimeDriver integration test

**File**: `src/runtime/__tests__/RuntimeDriver.test.ts` (create if doesn't exist, or
add to existing runtime tests if present)

Test that the RuntimeDriver correctly evaluates functional closures during `tick()`:

```typescript
it('evaluates functional closure at tick.blockProgress', () => {
  // Create a track with one functional widget and one discrete widget.
  // Seed the track with a functional block at index 0.
  // Call driver.tick({ globalProgress: 0.5, ... })
  // Assert the functional widget's apply() received fn(0.5) result.
  // Assert the discrete widget's apply() received the pre-baked state.
});

it('falls back to discrete state when no functional block exists for that sceneIndex', () => {
  // The terminal tick (last scene, sceneIndex = numScenes - 1) has no transitionBlock.
  // Assert it uses tick.state.widgets[widgetId].
});

it('falls back to defaultState when widget is not in functionalBlock.widgetFns', () => {
  // A functional block exists for this block index, but not for this specific widget.
  // Assert it uses the pre-baked state (which was filled by discrete path or is defaultState).
});
```

Use a mock `IRenderable` that records the state passed to `apply()`. Use a real
`SceneTrack` constructed manually (no registry, no DSL — construct the ticks array
directly per the interface-based test philosophy).

---

## 8. Error Handling

### 8.1 Compiler-side

If `isFunctionalSpec` returns true but `exitFn`/`enterFn`/`interpolateFn` are missing,
TypeScript catches this at compile time via the `FunctionalTransitionSpec<T>` interface.
No runtime guard needed.

If a functional spec's closure throws during `compileExtra` evaluation (Step 5), the
compiler already has `console.warn` infrastructure — wrap the `compileExtra` call:
```typescript
try {
  extras[widget.widgetId] = widget.compileExtra(state as never, context);
} catch (err) {
  console.warn('[SceneTrackCompiler] compileExtra.failed', widget.widgetId, err);
}
```
This is consistent with how `RuntimeDriverImpl` wraps `renderable.apply()`.

### 8.2 Runtime-side

If a functional closure throws during evaluation in `RuntimeDriver.tick()`, it is caught
by the existing try/catch wrapping the renderable loop:
```typescript
try {
  const state = functionalWidget
    ? functionalWidget.fn(tick.blockProgress)
    : tick.state.widgets[renderable.widgetId] ?? defaultState;
  // ...
  renderable.apply(state as never, { ...renderCtx, extra });
} catch (e) {
  const err = e instanceof Error ? e : new Error(String(e));
  this.onError?.(err);
}
```
The existing error handler already forwards errors to `this.onError`. No additional
handling needed.

### 8.3 Edge cases

- **`blockProgress` at exactly 0.5 for exit closures**: `bp < 0.5` is false at exactly
  0.5, so the second-half `absentDefault` branch fires. This is consistent with the
  discrete path where `mid = Math.floor(blockSize / 2)` and the second half starts at
  `mid` (inclusive).
- **Single-tick tracks** (`blockSize === 1`, `totalFrames === 1`): No transitions exist.
  `transitionBlocks` will be empty. Not affected.
- **Two-scene track** (`numTransitions === 1`): One block with `blockIndex === 0`.
  `tick.sceneIndex` is always 0 for all ticks except the terminal. Works correctly.
- **`tick.blockProgress` at exactly 1.0**: Only occurs for the terminal tick. Its
  `sceneIndex` equals `scenes.length - 1`, and `transitionBlocks[scenes.length - 1]` is
  always `undefined` (blocks are indexed 0..numTransitions-1). Falls through to discrete.

---

## 9. Implementation Order

Run `pnpm typecheck && pnpm test` between each numbered step. Do not proceed to the next
step if either fails.

1. **Add `FunctionalTransitionSpec<T>` and `isFunctionalSpec` to `transitionTypes.ts`**
   (`src/compiler/transitions/transitionTypes.ts`). TypeScript should typecheck cleanly —
   this is additive only.

2. **Add `FunctionalWidgetTransition`, `SceneTrackTransitionBlock` to `sceneTrackTypes.ts`
   and extend `SceneTrack`** (`src/compiler/sceneTrackTypes.ts`). Additive. All existing
   consumers of `SceneTrack` continue to compile because `transitionBlocks` is optional.

3. **Widen `ISceneElement.transitionSpec` in `widget/types.ts`**. This widens the type —
   all existing widget implementations (discrete specs) remain valid. No widget
   implementation changes yet.

4. **Update `sceneTrackCompiler.ts`** — add `isFunctionalSpec` import, declare
   `transitionBlocks: SceneTrackTransitionBlock[]`, add functional branch in Step 3,
   update Step 5 to evaluate closures for `compileExtra`, include `transitionBlocks`
   in return value. All discrete specs still produce identical output. Run all existing
   compiler tests — they must pass unchanged.

5. **Update `RuntimeDriver.ts`** — add `private track: SceneTrack | null`, update
   `setSceneTrack`, update the state resolution in `tick()` Step 3, clear in `dispose`.
   Existing tests must pass. With no `transitionBlocks` on the track, the fallback path
   always fires — no behavioral change.

6. **Write new tests** at `src/compiler/__tests__/functionalTransitions.test.ts` per §7.1.
   Run `pnpm test` to verify the new path works end-to-end with a functional spec.

7. **Migrate Model element** — add `functionalInstanceTransitionSpec` to
   `src/elements/model/compile.ts`, update `transitionSpec` in the ModelWidget class.
   Add tests per §7.3. Run `pnpm test`.

8. **Migrate Background element** — add `functionalBackgroundTransitionSpec`, update
   widget class, add/update tests. Run `pnpm test`.

9. **Migrate Lighting element** — extract `applyLightingExit/Enter/Interpolate` helpers,
   add `functionalLightingTransitionSpec`, update widget class, add tests. Run `pnpm test`.

10. **Migrate Floor element** — add `functionalFloorTransitionSpec`, update widget class,
    add tests. Run `pnpm test`.

11. **Migrate Environment element** — add `functionalEnvironmentTransitionSpec`, update
    widget class, add tests. Run `pnpm test`.

12. **Migrate Camera element** — read `camera/types.ts` first, extract helpers, add
    `functionalCameraTransitionSpec`, update widget class, add/create tests.
    Run `pnpm test`.

13. **Add RuntimeDriver integration tests** per §7.5.

14. **`pnpm coverage`** — verify coverage targets are met for all modified files.
    Coverage instrumentation targets `src/robot/{model,scenes,runtime,elements}/**/*.ts`
    and excludes `render.ts` and barrel exports.

---

## 10. Constraints and Non-Goals

### Preserved without change
- `sceneTrackSampler.ts` — unchanged. `tick.blockProgress` is already computed.
- `sceneDslCompiler.ts` — unchanged.
- All `render.ts` files — unchanged. `apply(state)` still receives concrete state.
- All `dsl.tsx` files — unchanged. Authoring surface is not affected.
- `ElementTransitionSpec<T>` — not removed. Both spec types coexist indefinitely.
- All blend helpers in `transitionTypes.ts` — unchanged.
- `SceneTrackTick` shape — unchanged (no new fields on the tick itself).
- `RuntimeDriver` interface in `runtime/types.ts` — unchanged.

### Out of scope for this plan
- **Removing `oversampling_rate`**: Once all widgets are migrated, the oversampling
  value has no effect on functional widgets. Removing or reducing it is a separate
  plan. Do not touch `SceneTimeline`, `createSceneTimeline`, or the engine blockSize
  calculation as part of this work.
- **Physics/spring simulations**: This plan enables the pattern. Implementing specific
  physics curves (spring, bounce) is the responsibility of element authors writing
  `FunctionalTransitionSpec` closures. No spring library is introduced here.
- **Viewport-responsive transitions**: The `FunctionalTransitionSpec` closures are
  captured at compile time with the `SceneSnapshotContext.viewport` value available.
  If a closure needs viewport data, it must capture it from the compile-time context
  during `exitFn/enterFn/interpolateFn(from, to)` — the closure itself cannot read
  viewport at evaluation time. Full viewport-responsive support requires a different
  approach and is out of scope.
- **Lazy/deferred compilation**: All closures are captured at compile time, same as
  the current discrete baking. Dynamic recompilation is out of scope.
- **Deleting old discrete specs**: The `instanceTransitionSpec`,
  `backgroundTransitionSpec`, etc. remain as exported symbols. They are not deleted
  in this plan. Deletion is a separate cleanup plan once adoption is verified.
- **`deltaForward` / `deltaBackward` for functional widgets**: Deltas for functional
  widgets will always be empty (their state is not stored discretely). This is
  architecturally correct — deltas are optimization hints for partial state diffing.
  Nothing depends on delta correctness for functional widgets.

---

## 11. Future Considerations (documented, not implemented)

**Oversampling can be reduced to 1× after full migration.** Once all scene-rendering
widgets use `FunctionalTransitionSpec`, every transition is evaluated at exact
`blockProgress`. The `OVERSAMPLING_RATE` multiplier only affects how many discrete
frames are allocated per block. With functional evaluation, fewer ticks are needed
(one tick per visible frame of animation, not per oversampled subdivision). Memory
footprint and compile time will drop proportionally.

**`compileExtraFn` as a companion pattern.** If `compileExtra` needs to remain per-tick
(e.g., for animation clip index baking), it currently works via closure evaluation at
each tick position during compilation. If an element wants a more ergonomic API, a
future `compileExtraFn: (state: T, blockProgress: number) => TExtra` field on
`FunctionalTransitionSpec` could replace the dual-path in Step 5.

**Technical debt introduced**: The `isFunctionalSpec` check in Step 3 of the compiler
is an `'interpolateFn' in spec` duck-type check. This is a code smell — the union type
`ElementTransitionSpec<T> | FunctionalTransitionSpec<T>` is a leaky discriminated union.
A cleaner future design would use a tagged union: `{ kind: 'discrete', spec: ... } |
{ kind: 'functional', spec: ... }`. This is not worth the migration cost now; document
as known debt.
