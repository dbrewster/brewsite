---
title: "Compiler Batch-Fill Transition Model"
doc_type: plan
owner: brewflow-architect
status: active
updated: 2026-02-20
---

# Compiler Batch-Fill Transition Model

## Overview

This plan replaces the existing three-pass `compileSceneTrack` implementation with a
discrete batch-fill model. Scenes are state snapshots — each scene is evaluated exactly
once to produce a set of widget states. The space between adjacent scenes is a contiguous
block of pre-baked frames. Each widget fills its own portion of that block by implementing
three methods: `enter`, `exit`, and `interpolate`. The compiler decides which method to
call based solely on whether the widget appears in scene N, scene N+1, or both. The
**runtime is completely unchanged**.

Think of it like the index card animation trick: draw a card for stance 1, draw a card for
stance 2, fill in all the cards in between. The widget draws its own in-between cards.

---

## Section 1: Architecture Document Updates

**File:** `requirements/prd/prd_architecture.md`

### 1.1 Replace §6.1 "Three Compiler Passes"

Replace the existing three-pass description with:

```
The compiler operates in two steps:

Step 1 — Scene Snapshot Evaluation
  Each scene's DSL is evaluated exactly once, producing a SceneSnapshot: a map of
  widgetId → authored state. Widgets not explicitly authored in the scene are absent
  from the snapshot. No sceneProgress variation, no inheritance from prior scenes.

Step 2 — Transition Block Baking
  For each adjacent pair (scene N, scene N+1), a contiguous block of frames is
  allocated:

    blockSize = numSubTicks * numFramesPerSubTick

  The compiler inspects snapshot[N] and snapshot[N+1] for each widget:

    present in both    → widget.transitionSpec.interpolate(fullBlock, widgetId, fromState, toState)
    present in N only  → widget.transitionSpec.exit(firstHalf, widgetId, fromState)
    present in N+1 only→ widget.transitionSpec.enter(secondHalf, widgetId, toState)
    present in neither → widget fills its own defaultState for all frames in the block

  The last scene contributes a single terminal frame (+1) with no outbound transition.

Total frame count:
  totalFrames = (numScenes - 1) * blockSize + 1

The compiler never decides what a frame looks like. It only decides which method to call
and what state to pass. The widget owns the frame output entirely.
```

### 1.2 Replace §6.4 "ElementTransitionSpec"

```
ElementTransitionSpec<T> defines three batch-fill methods. Each method receives a frame
slice (already trimmed to the appropriate range) and writes the widget's computed state
into frame.state.widgets[widgetId] for every frame in the slice.

  exit(frames: SceneFrame[], widgetId: string, fromState: T): void
    Widget is leaving (in scene N, absent from scene N+1).
    frames = first half of the transition block (the exit zone).
    Recommended t = i / (frames.length - 1), going 0 → 1 through the zone.
    At t=0 the widget is fully visible; at t=1 it is fully gone.

  enter(frames: SceneFrame[], widgetId: string, toState: T): void
    Widget is arriving (absent from scene N, present in scene N+1).
    frames = second half of the transition block (the enter zone).
    Recommended t = i / (frames.length - 1), going 0 → 1 through the zone.
    At t=0 the widget is invisible; at t=1 it has fully arrived at toState.

  interpolate(frames: SceneFrame[], widgetId: string, fromState: T, toState: T): void
    Widget is present in both scenes.
    frames = the full transition block.
    Recommended t = i / (frames.length - 1), going 0 → 1 across the full block.
    At t=0 the widget is at fromState; at t=1 it is at toState.

TransitionContext is removed. Each widget computes its own progress scalar from the
frame index and slice length. All existing blend helpers (blendNumber, blendVec3,
blendColor, etc.) are unchanged — they continue to accept a plain numeric t.
```

### 1.3 Update §5.2 "SceneTrackTick"

Replace the type listing with:

```typescript
type SceneTrackTick = {
  index: number;          // global frame index in the flat array
  progress: number;       // global [0, 1] — position in the full timeline
  sceneId: string;        // id of scene N (the "from" scene for this block)
  sceneIndex: number;     // index of scene N
  blockProgress: number;  // [0, 1] within this transition block
                          // 0 = at scene N's authored state
                          // 1 = at scene N+1's authored state
  state: SceneFrame;
  deltaForward: SceneFrameDelta;
  deltaBackward: SceneFrameDelta;
  annotationPrimitives?: AnnotationResolved[];
  labelPrimitives?: LabelResolved[];
  widgetExtras?: Record<string, unknown>;
};
```

`sceneProgress` is renamed to `blockProgress`. The semantics change: it now describes
position within a transition block, not within a scene's DSL evaluation range.

Update `SceneWindow` — remove `entryStart`:

```typescript
type SceneWindow = {
  id: string;     // scene N's id
  index: number;  // N
  start: number;  // normalized [0,1] progress of this block's first frame
  end: number;    // normalized [0,1] progress of this block's last frame (inclusive)
};
```

### 1.4 §7.1 Frame Tick Sequence

No changes. The runtime is unchanged.

---

## Section 2: Compiler Overhaul

### 2.1 New `ElementTransitionSpec` Interface

**File:** `src/compiler/transitions/transitionTypes.ts`

Remove `TransitionContext` entirely. Replace `ElementTransitionSpec` with:

```typescript
// Compiler transition contract — batch-fill model.
// The compiler calls exactly one method per widget per transition block.
// The widget writes frame.state.widgets[widgetId] for every frame in its slice.
import type { SceneFrame } from '../sceneTrackTypes';

/**
 * Computes the normalized progress scalar for frame i within a slice of length len.
 * Use this inside enter/exit/interpolate loops.
 * Returns 1 when len === 1 (single-frame edge case).
 */
export const transitionT = (i: number, len: number): number =>
  len > 1 ? i / (len - 1) : 1;

export type ElementTransitionSpec<T> = {
  /**
   * Widget is leaving (present in scene N, absent from scene N+1).
   * frames is the first half of the transition block.
   * Write frames[i].state.widgets[widgetId] for every i in [0, frames.length).
   * Use transitionT(i, frames.length) for normalized 0→1 progress.
   */
  exit(frames: SceneFrame[], widgetId: string, fromState: T): void;

  /**
   * Widget is arriving (absent from scene N, present in scene N+1).
   * frames is the second half of the transition block.
   * Write frames[i].state.widgets[widgetId] for every i in [0, frames.length).
   * Use transitionT(i, frames.length) for normalized 0→1 progress.
   */
  enter(frames: SceneFrame[], widgetId: string, toState: T): void;

  /**
   * Widget is present in both scenes.
   * frames is the full transition block.
   * Write frames[i].state.widgets[widgetId] for every i in [0, frames.length).
   * Use transitionT(i, frames.length) for normalized 0→1 progress.
   */
  interpolate(frames: SceneFrame[], widgetId: string, fromState: T, toState: T): void;
};
```

All blend helpers (`lerp`, `lerpVec3`, `blendNumber`, `blendOpacity`, `blendVec3`,
`blendColor`, `blendAxisRotation`, `blendAxisTranslation`, `blendDistance`,
`blendStyleValues`, `blendStyleValuesPartial`, `resolveTransitionOpacity`,
`resolveEnabledByOpacity`, `clamp01`, `mergeCssOpacity`) remain in this file unchanged.

### 2.2 Updated `SceneTrackTick` and `SceneWindow`

**File:** `src/compiler/sceneTrackTypes.ts`

- Rename field `sceneProgress` → `blockProgress` on `SceneTrackTick`.
- Remove `entryStart` from `SceneWindow`.
- No other structural changes. `SceneFrame`, `SceneFrameDelta`, `SceneTrack`,
  `ClipMeta`, `AnnotationResolved`, `LabelResolved` are all unchanged.

### 2.3 Simplified `SceneDefinition`

**File:** `src/compiler/sceneTypes.ts`

Remove from `SceneDefinition`:
- `entryLead?: number` — no longer used (no entry lead window)
- `entryStart?: number` — no longer used
- `transitions?: SceneTransition[]` — no longer used

Remove the `SceneTransition` type entirely from this file.

`SceneDefinition` after:

```typescript
export type SceneDefinition = {
  id: string;
  index: number;
  meta?: Record<string, JsonPrimitive>;
  getFrame: (context: SceneFrameContext) => ReactNode | SceneFrame;
};
```

Replace `SceneFrameContext` with a minimal `SceneSnapshotContext`. The old type carried
compiler-internal state (`baseState`, `nextState`, `sceneStart`, `sceneEnd`, `timeline`,
`sceneProgress`) that was only meaningful during the old multi-pass evaluation. None of
those fields have meaning when a scene is evaluated as a static snapshot.

```typescript
export type SceneSnapshotContext = {
  /** 0-based index of this scene in the scene array. */
  sceneIndex: number;
  /** Total number of scenes. */
  numScenes: number;
  /** Whether model/texture assets have finished loading. */
  assetsReady: boolean;
  /** Runtime variable store — for variable-driven DSL content. */
  variables?: VariableStoreReader;
  /** Viewport dimensions — for viewport-responsive DSL layout. */
  viewport?: { width: number; height: number; aspectRatio: number };
};
```

Update `SceneDefinition.getFrame` signature:

```typescript
getFrame: (context: SceneSnapshotContext) => ReactNode | SceneFrame;
```

Delete `SceneFrameContext` entirely. Update all scene files in `examples/` and any
other `getFrame` implementations to use `SceneSnapshotContext`. Scene files that were
reading `context.sceneProgress` to vary widget state within a scene must be updated —
that pattern is not supported in the new model (scenes are static snapshots).

`SceneGroup` is also simplified — remove its `timeline` field:

```typescript
export type SceneGroup = {
  id: string;
  scenes: SceneDefinition[];
};
```

### 2.4 New `compileSceneTrack` Algorithm

**File:** `src/compiler/sceneTrackCompiler.ts` — complete rewrite.

```typescript
// One-line responsibility: orchestrates scene snapshot evaluation and transition
// block baking into a flat pre-baked SceneTrack array.

import type { WidgetRegistry } from '../widget/WidgetRegistry';
import type { SceneDefinition } from './sceneTypes';
import type { SceneTrack, SceneTrackTick, SceneWindow, SceneFrame } from './sceneTrackTypes';
import { resolveSceneFromDsl } from './sceneDslCompiler';
import { compileAnnotations } from './annotationCompiler';
import { compileLabels } from './labelCompiler';

export type CompileSceneTrackOptions = {
  scenes: SceneDefinition[];
  widgetRegistry: WidgetRegistry;
  /**
   * Number of frames per transition block.
   * blockSize = numSubTicks * numFramesPerSubTick from the engine layer.
   */
  blockSize: number;
  clipMeta?: ClipMeta[];
  prefersReducedMotion?: boolean;
};

export const compileSceneTrack = (options: CompileSceneTrackOptions): SceneTrack => {
  const { scenes, widgetRegistry, blockSize } = options;
  const numTransitions = scenes.length - 1;
  const totalFrames = numTransitions * blockSize + 1;
  const tickStep = totalFrames > 1 ? 1 / (totalFrames - 1) : 1;

  // ── Step 1: Evaluate each scene's DSL once at sceneProgress = 0 ─────────────
  // Each snapshot maps widgetId → authored state for widgets present in that scene.
  // Widgets absent from the scene are NOT in the snapshot — they are not inherited.
  const snapshots: SceneFrame[] = scenes.map((scene, i) => {
    const context = {
      progress: scenes.length > 1 ? i / (scenes.length - 1) : 0,
      sceneProgress: 0,
      globalProgress: scenes.length > 1 ? i / (scenes.length - 1) : 0,
      assetsReady: true,
    };
    const raw = scene.getFrame(context);
    if (raw && typeof raw === 'object' && '$$typeof' in raw) {
      // JSX path — resolve through DSL compiler
      const { frame } = resolveSceneFromDsl(raw, context, widgetRegistry);
      return frame;
    }
    // Pre-compiled SceneFrame path
    if (isSceneFrame(raw)) return raw;
    throw new Error(`Scene "${scene.id}" getFrame must return a JSX element or SceneFrame`);
  });

  // ── Step 2: Allocate the flat frame array ────────────────────────────────────
  // Each frame starts with an empty widgets map. Widgets fill their own slots.
  const frames: SceneTrackTick[] = Array.from({ length: totalFrames }, (_, globalIdx) => {
    // Determine which block this frame belongs to
    const blockIdx   = Math.min(Math.floor(globalIdx / blockSize), numTransitions - 1);
    const posInBlock = globalIdx - blockIdx * blockSize;
    const bp         = blockSize > 1 ? posInBlock / (blockSize - 1) : 0;
    const scene      = scenes[blockIdx] ?? scenes[scenes.length - 1];
    return {
      index:         globalIdx,
      progress:      totalFrames > 1 ? globalIdx / (totalFrames - 1) : 0,
      sceneId:       scene.id,
      sceneIndex:    scene.index,
      blockProgress: bp,
      state:         { id: scene.id, scrollProgress: bp, widgets: {} },
      deltaForward:  {},
      deltaBackward: {},
    };
  });

  // Fix the last frame: it belongs to the final scene at blockProgress = 0
  const lastTick = frames[totalFrames - 1];
  const lastScene = scenes[scenes.length - 1];
  if (lastTick && lastScene) {
    lastTick.sceneId       = lastScene.id;
    lastTick.sceneIndex    = lastScene.index;
    lastTick.blockProgress = 0;
    lastTick.state.id      = lastScene.id;
  }

  // ── Step 3: Fill each transition block via widget batch methods ──────────────
  for (let n = 0; n < numTransitions; n++) {
    const blockStart  = n * blockSize;
    const block       = frames.slice(blockStart, blockStart + blockSize);
    const mid         = Math.floor(blockSize / 2);
    const fromSnap    = snapshots[n];
    const toSnap      = snapshots[n + 1];

    if (!fromSnap || !toSnap) continue;

    for (const widget of widgetRegistry.getSceneElements()) {
      const { widgetId, defaultState, transitionSpec } = widget;
      const fromState = fromSnap.widgets[widgetId];
      const toState   = toSnap.widgets[widgetId];
      const inFrom    = fromState !== undefined;
      const inTo      = toState   !== undefined;

      if (inFrom && inTo) {
        // Widget present in both scenes — interpolate across the full block
        transitionSpec.interpolate(block, widgetId, fromState as never, toState as never);

      } else if (inFrom) {
        // Widget leaving — exit in first half, defaultState in second half
        transitionSpec.exit(block.slice(0, mid), widgetId, fromState as never);
        for (let i = mid; i < block.length; i++) {
          block[i]!.state.widgets[widgetId] = defaultState;
        }

      } else if (inTo) {
        // Widget arriving — defaultState in first half, enter in second half
        for (let i = 0; i < mid; i++) {
          block[i]!.state.widgets[widgetId] = defaultState;
        }
        transitionSpec.enter(block.slice(mid), widgetId, toState as never);

      } else {
        // Widget absent from both scenes — fill with defaultState
        for (const frame of block) {
          frame.state.widgets[widgetId] = defaultState;
        }
      }
    }
  }

  // ── Step 4: Fill the terminal frame (+1) ────────────────────────────────────
  const terminalTick = frames[totalFrames - 1];
  const terminalSnap = snapshots[scenes.length - 1];
  if (terminalTick && terminalSnap) {
    for (const widget of widgetRegistry.getSceneElements()) {
      terminalTick.state.widgets[widget.widgetId] =
        terminalSnap.widgets[widget.widgetId] ?? widget.defaultState;
    }
  }

  // ── Step 5: Compile widgetExtras via compileExtra() ─────────────────────────
  // compileExtra() is called per-frame for widgets that implement it.
  for (const frame of frames) {
    const extras: Record<string, unknown> = {};
    for (const widget of widgetRegistry.getSceneElements()) {
      if (!widget.compileExtra) continue;
      const state = frame.state.widgets[widget.widgetId];
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

  // ── Step 6: Compile annotations and labels ───────────────────────────────────
  // These live on SceneFrame directly and are compiled per-frame from the snapshot.
  // Labels and annotations are drawn from the active scene's snapshot.
  const warnOnce = new Set<string>();
  for (const frame of frames) {
    const snap = snapshots[frame.sceneIndex] ?? snapshots[snapshots.length - 1];
    if (!snap) continue;
    if (snap.annotations?.length) {
      frame.annotationPrimitives = compileAnnotations(frame.state, snap, warnOnce);
    }
    if (snap.labels?.length) {
      frame.labelPrimitives = compileLabels(snap.labels, { sceneProgress: frame.blockProgress });
    }
  }

  // ── Step 7: Compute forward/backward deltas ──────────────────────────────────
  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i]!;
    const prev  = frames[i - 1];
    const next  = frames[i + 1];
    frame.deltaForward  = buildDelta(prev?.state, frame.state);
    frame.deltaBackward = buildDelta(next?.state, frame.state);
  }

  // ── Assemble SceneWindows ────────────────────────────────────────────────────
  const sceneWindows: SceneWindow[] = scenes.map((scene, i) => ({
    id:    scene.id,
    index: scene.index,
    start: totalFrames > 1 ? (i * blockSize) / (totalFrames - 1) : 0,
    end:   totalFrames > 1
      ? Math.min(((i + 1) * blockSize) / (totalFrames - 1), 1)
      : 1,
  }));

  return {
    ticks:        frames,
    tickStep,
    subTickCount: totalFrames,
    sceneWindows,
  };
};
```

`buildDelta` and `serialize` helpers are extracted as module-private functions in the
same file — same logic as today.

`isSceneFrame` guard function is also module-private.

### 2.5 Files to Delete

Remove all imports of these files, then delete them:

- `src/compiler/sceneUtils.ts` — `applySceneTransitions()` has no callers in the new model
- `src/compiler/sceneDefaults.ts` — `createBaseSceneState()` has no callers in the new model

### 2.6 Files to Modify

- `src/compiler/transitions/transitionTypes.ts` — Replace `ElementTransitionSpec` + remove `TransitionContext` per §2.1
- `src/compiler/sceneTrackTypes.ts` — Rename `sceneProgress` → `blockProgress`; remove `SceneWindow.entryStart`
- `src/compiler/sceneTypes.ts` — Remove `SceneTransition`, `entryLead`, `entryStart`, `transitions`; replace `SceneFrameContext` with `SceneSnapshotContext`; remove `timeline` from `SceneGroup` per §2.3
- `src/compiler/sceneTrackCompiler.ts` — Complete rewrite per §2.4
- `src/compiler/sceneDslCompiler.ts` — Replace `SceneFrameContext` with `SceneSnapshotContext` throughout
- `src/player/useSceneEngine.ts` — Compute `blockSize` and pass to `compileSceneTrack`; remove `SceneTimeline` usage from compiler call site
- `src/timeline/index.ts` — `SceneTimeline` and `createSceneTimeline` may be removed entirely if the player no longer uses them for compiler input; audit usage before deleting
- All scene files in `examples/simple/scenes/` — update `getFrame` signatures from `SceneFrameContext` to `SceneSnapshotContext`

### 2.7 Compiler Tests

**Files to rewrite** (the old test assertions are for the old algorithm):

- `src/compiler/__tests__/sceneTrackCompiler.test.ts`
- `src/compiler/__tests__/sceneTrackCompiler.branches.test.tsx`
- `src/compiler/__tests__/sceneTrackCompiler.extra.test.tsx`
- `src/compiler/__tests__/sceneTrackCompiler.interpolate.test.tsx`
- `src/compiler/__tests__/sceneTrackSampler.test.ts` — update `SceneTrackTick` stubs:
  rename `sceneProgress` → `blockProgress`

**Test cases for the new `compileSceneTrack`:**

```typescript
// Helper: minimal SceneDefinition
const makeScene = (id: string, index: number, widgetStates: Record<string, unknown>): SceneDefinition => ({
  id,
  index,
  getFrame: () => ({ id, scrollProgress: 0, widgets: widgetStates }),
});
```

Required test cases:

1. **Array size — 2 scenes, blockSize=4**: `totalFrames === 5`.
2. **Array size — 3 scenes, blockSize=4**: `totalFrames === 9`.
3. **Widget in both scenes**: `interpolate` receives a slice of length `blockSize`.
   First frame state equals `fromState` (t=0), last frame equals `toState` (t=1) for
   an identity-interpolating spec.
4. **Widget in scene N only (exit)**: frames `[0, mid)` filled by `exit`; frames
   `[mid, blockSize)` contain `widget.defaultState`.
5. **Widget in scene N+1 only (enter)**: frames `[0, mid)` contain `widget.defaultState`;
   frames `[mid, blockSize)` filled by `enter`.
6. **Widget in neither scene**: all frames in block contain `widget.defaultState`.
7. **Terminal frame**: last frame holds the last scene's authored states.
8. **blockProgress**: frame at block position 0 has `blockProgress === 0`;
   frame at block position `blockSize-1` has `blockProgress === 1`.
9. **compileExtra**: widget implementing `compileExtra` produces `widgetExtras` entries.
10. **Delta computation**: adjacent frames with identical widget state produce empty delta;
    frames with different state produce a populated `deltaForward.widgets`.

---

## Section 3: Widget Implementation Changes

For every widget, the `transitionSpec` in `compile.ts` is rewritten from the
single-state-returning signature to the batch-fill signature. The blend math is
**completely unchanged** — only the calling convention changes.

**Universal pattern** every widget follows:

```typescript
import { transitionT } from '../../compiler/transitions/transitionTypes';

const myTransitionSpec: ElementTransitionSpec<MyState> = {
  exit(frames, widgetId, fromState) {
    for (let i = 0; i < frames.length; i++) {
      const t = transitionT(i, frames.length);
      frames[i]!.state.widgets[widgetId] = computeExitState(fromState, t);
    }
  },
  enter(frames, widgetId, toState) {
    for (let i = 0; i < frames.length; i++) {
      const t = transitionT(i, frames.length);
      frames[i]!.state.widgets[widgetId] = computeEnterState(toState, t);
    }
  },
  interpolate(frames, widgetId, fromState, toState) {
    for (let i = 0; i < frames.length; i++) {
      const t = transitionT(i, frames.length);
      frames[i]!.state.widgets[widgetId] = computeInterpolateState(fromState, toState, t);
    }
  },
};
```

`t` replaces `context.tExit` in `exit`, `context.tEnter` in `enter`, and `context.tFull`
in `interpolate`. All calls to blend helpers (blendNumber, blendVec3, etc.) pass `t`
directly — the helpers are unchanged.

---

### 3.1 ModelWidget

**File:** `src/elements/model/compile.ts`

**Current behaviour:**
- `exit(from, ctx)`: scales `model.scale` to `0.001`, fades animation weights to 0,
  scales body part overrides to 0. Uses `ctx.tExit`.
- `enter(to, ctx)`: scales `model.scale` from `0.001` to target, fades animation weights
  in, scales body part overrides in. Uses `ctx.tEnter`.
- `interpolate(from, to, ctx)`: blends `model.position`, `rotation`, `scale`,
  `metalness`, `roughness`, body part overrides, animation weights, motion
  commands/scenes/poses. Uses `ctx.tFull` for most paths; `ctx.tExit` when
  `to.model.enabled === false` (hiding the model).

**Changes:**

Extract three private helper functions from the existing spec body:

```typescript
const applyModelExit        = (from: SceneModelInstanceState, t: number): SceneModelInstanceState
const applyModelEnter       = (to:   SceneModelInstanceState, t: number): SceneModelInstanceState
const applyModelInterpolate = (from: SceneModelInstanceState, to: SceneModelInstanceState, t: number): SceneModelInstanceState
```

These contain the existing logic verbatim, with every `context.tExit` → `t`,
`context.tEnter` → `t`, `context.tFull` → `t`.

For `applyModelInterpolate`: the existing check
`to.model.enabled === false ? ctx.tExit : ctx.tFull` becomes simply `t`. The exit/enter
distinction is now encoded in which method the compiler calls — `interpolate` always
receives the full range.

`instanceTransitionSpec` then calls these helpers inside the frame loop per the
universal pattern above.

`modelTransitionSpec` and `playbackTransitionSpec` (internal helpers) are updated to
accept plain `t: number` instead of `TransitionContext`. Every `context.tFull` reference
in those helpers becomes the `t` parameter.

**Test file:** `src/elements/model/__tests__/ModelCompile.test.ts`

Update all test cases that construct `TransitionContext` objects — replace with plain
`t: number` calls to the extracted `applyModel*` helpers. Existing blend assertions
remain valid.

---

### 3.2 LightingWidget

**File:** `src/elements/lighting/compile.ts`

**Current behaviour:**
- `exit(from, ctx)`: fades `ambient.intensity` and `directional.intensity` to 0,
  fades out point/spot/panel arrays. Uses `ctx.tExit`.
- `enter(to, ctx)`: fades in ambient/directional from 0, fades in all light arrays.
  Uses `ctx.tEnter`.
- `interpolate(from, to, ctx)`: blends all light properties by index (points, spots)
  or by ID (panels, using matrix interpolation). Uses `ctx.tFull`.

**Changes:**

Extract three private helpers:

```typescript
const applyLightingExit        = (from: SceneLighting, t: number): SceneLighting
const applyLightingEnter       = (to:   SceneLighting, t: number): SceneLighting
const applyLightingInterpolate = (from: SceneLighting, to: SceneLighting, t: number): SceneLighting
```

`blendLightArray`, `blendSpots`, `blendPanels` already accept `t: number` — they are
unchanged. Remove the `TransitionContext` parameter from their signatures where it
currently appears; pass `t` directly.

`lightingTransitionSpec` calls helpers inside the frame loop per the universal pattern.

**Test file:** `src/elements/lighting/__tests__/LightingCompile.test.ts`
`src/elements/lighting/__tests__/LightingWidgetDsl.test.tsx` — no changes needed
(tests the DSL layer, not the transition spec).

---

### 3.3 BackgroundWidget

**File:** `src/elements/background/compile.ts`

**Current behaviour:**
- `exit(from, ctx)`: `opacity = blendOpacity(from.opacity, 0, ctx.tExit)`.
- `enter(to, ctx)`: `opacity = blendOpacity(0, to.opacity, ctx.tEnter)`.
- `interpolate(from, to, ctx)`: crossfade — if `imageUrl` differs, fade out
  first image then fade in new image using `crossFadeOpacity`; if same image, blend
  opacity directly. Switches `imageUrl` at `tFull < 0.5`. Uses `ctx.tFull`.

**Changes:**

The `crossFadeOpacity` and `selectImageUrl` helpers are unchanged. They already accept
plain `t: number`. Remove `TransitionContext` from their signatures.

New spec implementation:

```typescript
exit(frames, widgetId, fromState) {
  for (let i = 0; i < frames.length; i++) {
    const t = transitionT(i, frames.length);
    frames[i]!.state.widgets[widgetId] = {
      ...fromState,
      opacity: blendOpacity(fromState.opacity, 0, t),
    };
  }
},
enter(frames, widgetId, toState) {
  for (let i = 0; i < frames.length; i++) {
    const t = transitionT(i, frames.length);
    frames[i]!.state.widgets[widgetId] = {
      ...toState,
      opacity: blendOpacity(0, toState.opacity, t),
    };
  }
},
interpolate(frames, widgetId, fromState, toState) {
  for (let i = 0; i < frames.length; i++) {
    const t = transitionT(i, frames.length);
    frames[i]!.state.widgets[widgetId] = {
      imageUrl:    selectImageUrl(fromState.imageUrl, toState.imageUrl, t),
      opacity:     crossFadeOpacity(fromState, toState, t),
      position:    blendVec3(fromState.position, toState.position, t),
      cssPosition: t < 0.5 ? fromState.cssPosition : toState.cssPosition,
      cssSize:     t < 0.5 ? fromState.cssSize     : toState.cssSize,
      cssRepeat:   t < 0.5 ? fromState.cssRepeat   : toState.cssRepeat,
    };
  }
},
```

---

### 3.4 FloorWidget

**File:** `src/elements/floor/compile.ts`

**Current behaviour:**
- `exit(from, ctx)`: `enabled: from.enabled && ctx.tExit < 1`.
- `enter(to, ctx)`: `enabled: to.enabled && ctx.tEnter > 0`.
- `interpolate(from, to, ctx)`:
  `enabled: (from.enabled && tFull < 1) || (to.enabled && tFull > 0)`.
  `textureUrl`: switches at `tFull < 0.5`.

**Changes:**

`ctx.tExit` → `t`, `ctx.tEnter` → `t`, `ctx.tFull` → `t`. Direct translation:

```typescript
exit(frames, widgetId, fromState) {
  for (let i = 0; i < frames.length; i++) {
    const t = transitionT(i, frames.length);
    frames[i]!.state.widgets[widgetId] = {
      textureUrl: fromState.textureUrl,
      enabled:    fromState.enabled && t < 1,
    };
  }
},
enter(frames, widgetId, toState) {
  for (let i = 0; i < frames.length; i++) {
    const t = transitionT(i, frames.length);
    frames[i]!.state.widgets[widgetId] = {
      textureUrl: toState.textureUrl,
      enabled:    toState.enabled && t > 0,
    };
  }
},
interpolate(frames, widgetId, fromState, toState) {
  for (let i = 0; i < frames.length; i++) {
    const t = transitionT(i, frames.length);
    frames[i]!.state.widgets[widgetId] = {
      textureUrl: t < 0.5 ? fromState.textureUrl : toState.textureUrl,
      enabled:    (fromState.enabled && t < 1) || (toState.enabled && t > 0),
    };
  }
},
```

No helpers to update. This widget has no existing test for its transition spec; add one
as part of this work (see §3.6 test notes).

---

### 3.5 EnvironmentWidget

**File:** `src/elements/environment/compile.ts`

**Current behaviour:**
- `exit(from, ctx)`: `enabled: ctx.tExit < 1 && from.enabled`,
  `intensity: blendNumber(from.intensity, 0, ctx.tExit)`.
- `enter(to, ctx)`: `enabled: ctx.tEnter > 0 && to.enabled`,
  `intensity: blendNumber(0, to.intensity, ctx.tEnter)`.
- `interpolate(from, to, ctx)`:
  `enabled`: complex boolean using `tFull`.
  `intensity`: `blendNumber(from.intensity, to.intensity, ctx.tFull)`.
  `url`/`preset`: switch at `tFull < 0.5`.

**Changes:**

Direct `ctx.tExit`/`ctx.tEnter`/`ctx.tFull` → `t` translation:

```typescript
exit(frames, widgetId, fromState) {
  for (let i = 0; i < frames.length; i++) {
    const t = transitionT(i, frames.length);
    frames[i]!.state.widgets[widgetId] = {
      ...fromState,
      enabled:   t < 1 && fromState.enabled,
      intensity: blendNumber(fromState.intensity, 0, t),
    };
  }
},
enter(frames, widgetId, toState) {
  for (let i = 0; i < frames.length; i++) {
    const t = transitionT(i, frames.length);
    frames[i]!.state.widgets[widgetId] = {
      ...toState,
      enabled:   t > 0 && toState.enabled,
      intensity: blendNumber(0, toState.intensity, t),
    };
  }
},
interpolate(frames, widgetId, fromState, toState) {
  for (let i = 0; i < frames.length; i++) {
    const t = transitionT(i, frames.length);
    const enabled = (fromState.enabled && toState.enabled)
      ? true
      : (t > 0 && toState.enabled) || (t < 1 && fromState.enabled);
    frames[i]!.state.widgets[widgetId] = {
      url:       t < 0.5 ? fromState.url     : toState.url,
      preset:    t < 0.5 ? fromState.preset  : toState.preset,
      enabled,
      intensity: blendNumber(fromState.intensity, toState.intensity, t),
    };
  }
},
```

---

### 3.6 Labels

**File:** `src/labels/compile.ts`

Labels are not an `ISceneElement` widget. They live in `SceneFrame.labels` as
`LabelDefinition[]` and are compiled per-frame by `compileLabels()` in the compiler's
Step 6 loop. No `transitionSpec` changes are needed.

**What changes:**

`compileLabels(labels, context)` receives a minimal context with `sceneProgress`
(now sourced from `frame.blockProgress`). No signature change needed — the function
already accepts a plain context object; just pass `{ sceneProgress: frame.blockProgress }`.

Any existing `labelTransitionSpec` object in `src/labels/compile.ts` can be deleted —
it is not called by the new compiler and has no call site.

---

### 3.7 New Transition Spec Tests

For each widget, the transition spec helpers are now pure functions of `(state, t)`.
They are independently testable without a frame array.

Add or update tests for `applyModelExit`, `applyModelEnter`, `applyModelInterpolate`,
`applyLightingExit`, etc., asserting correct blend output at `t=0`, `t=0.5`, `t=1`.

These tests do NOT need a frame array — call the helpers directly and assert on the
returned state object. This matches the project's interface-based stateful test philosophy.

---

## Section 4: Implementation Order

Implement strictly in this order. Run `pnpm typecheck && pnpm test` between each step.

1. **Update `ElementTransitionSpec` and remove `TransitionContext`**
   (`src/compiler/transitions/transitionTypes.ts`). All widget `compile.ts` files will
   have type errors — expected and resolved in later steps.

2. **Update `SceneTrackTick`** (`sceneProgress` → `blockProgress`) and `SceneWindow`
   (remove `entryStart`). Fix all references to `sceneProgress` on ticks
   (`src/compiler/__tests__/sceneTrackSampler.test.ts` and any other stub construction
   sites). `pnpm typecheck` must pass.

3. **Simplify `SceneDefinition`** — remove `SceneTransition`, `entryLead`, `entryStart`,
   `transitions`. Fix all scene files in `examples/` that use these fields.

4. **Rewrite `compileSceneTrack`** per §2.4. Delete `sceneUtils.ts` and
   `sceneDefaults.ts` after removing their importers. Compiler tests will fail until
   step 5.

5. **Rewrite compiler tests** per §2.7. `pnpm test` must pass for compiler suite.

6. **Rewrite each widget's `transitionSpec`** — one widget at a time, in order:
   Background → Floor → Environment → Lighting → Model. Run `pnpm test` after each.

7. **Remove `labelTransitionSpec`** from `src/labels/compile.ts` if it exists.

8. **Update `src/player/useSceneEngine.ts`** — compute `blockSize` and pass to
   `compileSceneTrack`. Remove `SceneTimeline` dependency from the compiler call site.

9. **`pnpm coverage`** — verify coverage targets are met for all modified files.

---

## Section 5: Constraints and Non-Goals

- **Runtime is unchanged.** `RuntimeDriverImpl`, `sceneTrackSampler.ts`,
  `IRenderable.apply()`, `IAnimationController.onTick()` — no modifications.
- **No functional/physics-based transitions.** Transitions are fully pre-baked.
  Time-based motion (e.g., "walk off stage left") belongs in `IAnimationController`.
  That is a separate future plan.
- **No within-scene sceneProgress variation.** Scenes are discrete snapshots evaluated
  at a single point. In-scene scroll-driven animation is out of scope for this plan.
- **Annotations are not transitionally animated.** `annotationPrimitives` and
  `compileAnnotations()` continue to work from the active scene's snapshot per frame.
- **`compileExtra()` is preserved** on `ISceneElement` and is called after baking.
- **No changes to `IRenderable`, `IDslComposite`, `ILoadable`, or any `render.ts` files.**
- **Blend helper functions are unchanged.** `blendNumber`, `blendVec3`, `blendColor`,
  etc. — same signatures, same behaviour, same file location.
