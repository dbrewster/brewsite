---
title: "Input System Overhaul — Unified, Testable, Mobile-Ready"
doc_type: plan
owner: core
status: complete
updated: 2026-03-15
---

# Input System Overhaul

## Problem Statement

The current input system has accumulated multiple critical defects that make it unreliable for authors and users:

### Bugs Found During Audit

1. **`scope` field is dead code.** `SceneInputControllerSpec.scope` is compiled from the DSL (`scope="canvas"` vs `scope="window"`) and stored in the widget state, but **neither `InputCoordinator` nor `ActionInputController` ever reads it.** The controller always attaches to whichever DOM element `InputCoordinator` resolves as `targetEl`. Scene 7 ("All Maps") advertises `scope="window"` but it behaves identically to `scope="canvas"`.

2. **X-axis scroll for carousel doesn't work reliably.** The X-inertia carousel system in `InputCoordinator` relies on the "unclaimed wheel" waterfall — but carousel scenes (scenes 4–5) declare their own `<InputController>` with only `KeyMap` entries and no `WheelMap` for carousel actions. Since these scenes' `WheelMap` is absent, **wheel events fall through to onUnclaimedWheel**, which then applies axis arbitration. However, on desktop trackpads where deltaX and deltaY arrive simultaneously, the sticky axis lock (200ms window, 3px threshold) frequently locks to Y first, making X-scroll feel broken. On mice without horizontal scroll wheels, there is no way to generate deltaX at all.

3. **Scenes override the default input spec entirely.** When any scene declares `<InputController>`, the compiler skips default injection for ALL scenes. But each scene's InputController only declares its own subset of bindings. Scenes 4–5 declare carousel keys + scene nav keys + pinch zoom, but **no orbit, no pan, no wheel zoom** — losing the defaults the user expects. The "all or nothing" injection logic at line 430 of `sceneTrackCompiler.ts` means custom scenes must redundantly redeclare every binding.

4. **Mobile Y-scroll is too slow.** The touch sensitivity scale is `2.5` and the inertia sensitivity is scene-configurable (0.06 in the showcase). The product of these with the scroll unit math means mobile swipes advance ~50% slower than equivalent desktop wheel gestures. There is no separate mobile sensitivity calibration.

5. **No mobile story for orbit/pan/reset.** The `note_touch-gesture-modifiers.md` documents a proposed `touches` field for multi-finger gesture mapping, but none of it is implemented. On mobile, orbit, pan, and camera reset are completely inaccessible.

6. **Keyboard input is haphazard.** `keyboardTarget` defaults to `document` in `InputCoordinator`, which means key events fire regardless of whether the BrewSite canvas has focus or is even visible. When multiple BrewSite instances exist on a page, all of them process the same keydown events. There is no focus-gating.

7. **Orbit and pan cause "tearing."** `ActionInputController.handlePointerMove` calls `e.preventDefault()` for active drags, but does NOT call `setPointerCapture` reliably when the target is `window`. When the user drags outside the canvas, events are lost, causing velocity discontinuities that manifest as visual tearing in the Three.js render.

8. **No wheel map for carousel in the default spec.** `createDefaultInputSpec()` includes keyboard carousel (← →) but no `WheelMap` for horizontal scroll. The X-inertia system in InputCoordinator handles this via the unclaimed wheel path, but the intent is opaque and the axis arbitration is fragile.

9. **InputCoordinator is a 642-line monolith.** It owns: inertia physics, axis arbitration, carousel step logic (65 lines of layout recomputation), touch event handling, keyboard guard installation, scroll source registration, pause-when-hidden integration, and ActionInputController wiring. This violates single-responsibility and is untestable in isolation.

10. **No visual carousel scrubber.** Authors have no way to show a draggable scroll indicator for carousels. The only UI affordance is keyboard hints in overlay text.

---

## Architecture

### Design Principles

1. **Scroll is sacred.** Scroll Y = ALWAYS scene transition. Scroll X = ALWAYS carousel navigation (when carousel present). No default action uses WheelMap. This is unconditional and cannot be accidentally overridden. Camera actions use pointer drag, modifier+drag, pinch, and keyboard — never plain scroll.
2. **Merge, don't replace.** When a scene declares `<InputController>`, its actions should MERGE with the defaults, not replace them. Actions with matching `id` override the default; new actions are added. This eliminates the "all or nothing" problem.
3. **Scope actually works.** `scope="window"` attaches pointer/wheel to `window`; `scope="canvas"` attaches to the canvas container.
4. **Single-finger touch = scroll/carousel. Multi-finger = camera.** This is the only natural mobile mapping. Implement the `touches` field on `PointerMap`.
5. **Focus-gated keyboard input.** Keyboard events only fire when the BrewSite stage element has focus or contains the active element. `tabIndex={0}` on the stage container.
6. **Decompose InputCoordinator.** Extract pure, testable modules for: inertia physics, axis arbitration, carousel stepping, touch gesture classification.
7. **3D carousel scrubber.** A new `CarouselScrubber` element rendered in the Three.js scene, driven by the carousel's `activeIndex` and `childCount`.

### Module Decomposition

#### New Files

| File | Responsibility |
|---|---|
| `input/inertiaAccumulator.ts` | Pure inertia math: accumulate deltas, decay velocity, emit progress. Extracted from InputCoordinator's RAF loop. Replaces inline refs. |
| `input/axisArbiter.ts` | Pure axis-lock state machine: given (dx, dy, timestamp), returns locked axis. Replaces inline axis arbitration. |
| `input/touchGestureClassifier.ts` | Classifies multi-touch gestures: single-finger-scroll, two-finger-drag, two-finger-pinch, three-finger-drag. Returns gesture intent. |
| `input/carouselStepper.ts` | Pure carousel index computation: given (currentIndex, direction, step, count, loop) → newIndex. Extracted from InputCoordinator's 65-line handleCarouselStep. |
| `input/inputSpecMerger.ts` | Merges a scene-declared InputControllerSpec with the default spec. Actions with matching `id` replace; new actions are added; removed actions (explicitly) are deleted. |
| `input/scopeResolver.ts` | Given scope + available DOM elements, returns {pointerTarget, keyboardTarget}. Implements the scope="canvas" vs scope="window" contract. |
| `elements/carousel-scrubber/types.ts` | CarouselScrubberState: layoutId, activeIndex, childCount, orientation, style options. |
| `elements/carousel-scrubber/dsl.tsx` | `<CarouselScrubber>` DSL component. |
| `elements/carousel-scrubber/compile.ts` | Pure compiler: reads ViewLayout state, emits scrubber widget state. |
| `elements/carousel-scrubber/render.ts` | Three.js rendering: track bar + grab handle. Responds to pointer drag for direct scrubbing. |
| `elements/carousel-scrubber/CarouselScrubberWidget.ts` | IWidget + IRenderable + ISceneElement implementation. |
| `elements/carousel-scrubber/index.ts` | Re-exports. |

**Note:** The `CarouselScrubber` is a **core element** (lives in `packages/core/src/elements/`), not a diagram element, because carousel is a core layout concept.

**Widget registration:** `CarouselScrubberWidget` is registered in `createDefaultWidgetRegistry()` in `packages/core/src/player/createDefaultWidgetRegistry.ts`, alongside the existing core widgets (Camera, Lighting, Background, etc.). It is NOT opt-in — it is available by default. Its `NodeHandler` is registered in `ensureCoreHandlerRegistry()` in `packages/core/src/compiler/coreHandlers.ts`.

#### Public vs Internal Exports

**Public exports (from `packages/core/src/input/index.ts` and `packages/core/src/index.ts`):**
- `mergeInputSpecs`, `InputSpecMergeMode` — consumers building custom compiler integrations may need these.
- `computeCarouselStep`, `CarouselStepInput` — useful for custom carousel widgets.
- `resolveInputTargets`, `ResolvedTargets` — useful for custom input coordinators.
- `TouchGestureIntent` — useful for custom touch handling.

**Internal only (NOT exported from package index):**
- `InertiaAccumulatorState`, `InertiaAccumulatorConfig`, `feedDelta`, `tickClamped`, `tickUnclamped`, `resetMomentum`, `setProgress` — internal to InputCoordinator's RAF loop.
- `AxisArbiterState`, `AxisArbiterConfig`, `arbiterFeed`, `arbiterIdleCheck` — internal to InputCoordinator.
- `TouchClassifierState`, `TouchClassifierConfig`, `classifyTouch`, `resetClassifier` — internal to InputCoordinator.
- `createAxisArbiterState`, `createTouchClassifierState`, `createInertiaState` — internal factory functions.

#### Modified Files

| File | Changes |
|---|---|
| `input/types.ts` | Add `touches?: number` to `InputPointerMap`. Add `TouchGestureIntent` type. Add `mergeMode?: 'merge' \| 'replace'` to `SceneInputControllerSpec`. |
| `input/defaultInputSpec.ts` | Add touch fallbacks (`touches: 2` for orbit, `touches: 3` for pan). Add WheelMap for carousel (axis: 'x', lockAxis: 'sticky'). |
| `input/ActionInputController.ts` | Support `touches` matching in pointer maps. Multi-touch drag via centroid. Gesture classifier integration. Scope-aware target switching. |
| `compiler/sceneTrackCompiler.ts` | Replace "any scene has InputController → skip all defaults" with per-scene merge logic via `inputSpecMerger`. |
| `compiler/blocks/inputController.tsx` | Support `merge` mode (default) vs `replace` mode on `<InputController>`. |
| `player/InputCoordinator.tsx` | Decompose into orchestrator that wires extracted modules. ~200 lines target (from 642). |
| `player/ScrollStage.tsx` | Add `tabIndex={0}` to the scroll container div. Auto-focus on pointer enter. |

### Detailed Design

#### 1. Input Spec Merging (`input/inputSpecMerger.ts`)

```typescript
// input/inputSpecMerger.ts — Pure merge of scene input spec with defaults.

import type { SceneInputControllerSpec, InputActionSpec } from './types';

export type InputSpecMergeMode = 'merge' | 'replace';

/**
 * Merges a scene-authored input spec with the default spec.
 *
 * 'merge' mode (default):
 * - Scene actions with an `id` matching a default action REPLACE that default.
 * - Scene actions with a new `id` are APPENDED.
 * - Default actions not overridden are PRESERVED.
 * - The `scope` field from the scene spec takes precedence.
 *
 * 'replace' mode:
 * - Scene spec completely replaces defaults (current behavior, opt-in only).
 */
export function mergeInputSpecs(
  defaults: SceneInputControllerSpec,
  scene: SceneInputControllerSpec,
  mode: InputSpecMergeMode,
): SceneInputControllerSpec {
  if (mode === 'replace') return scene;

  const mergedActions: InputActionSpec[] = [];
  const sceneActionIds = new Set(scene.actions.map(a => a.id));

  // 1. Keep defaults that aren't overridden
  for (const defaultAction of defaults.actions) {
    if (!sceneActionIds.has(defaultAction.id)) {
      mergedActions.push(defaultAction);
    }
  }

  // 2. Add all scene actions (these override defaults with same id)
  for (const sceneAction of scene.actions) {
    mergedActions.push(sceneAction);
  }

  return {
    id: scene.id,
    scope: scene.scope,
    actions: mergedActions,
  };
}
```

**Impact:** Scenes 4 and 5 currently declare only carousel + scene-nav + pinch. After merge, they automatically get orbit, pan, wheel zoom, and camera reset from defaults. Authors only need to declare what's DIFFERENT.

#### 2. Scope Resolution (`input/scopeResolver.ts`)

```typescript
// input/scopeResolver.ts — Resolves scope to DOM targets.

import type { InputControllerScope } from './types';

export type ResolvedTargets = {
  pointerTarget: HTMLElement | Window;
  keyboardTarget: HTMLElement | Document;
};

/**
 * Resolves the input controller scope to concrete DOM elements.
 *
 * 'canvas': pointer events on canvasContainer, keyboard on stageContainer (focus-gated).
 * 'window': pointer events on window, keyboard on document.
 */
export function resolveInputTargets(
  scope: InputControllerScope,
  canvasContainer: HTMLElement | null,
  stageContainer: HTMLElement | null,
): ResolvedTargets {
  if (scope === 'window') {
    return {
      pointerTarget: window,
      keyboardTarget: document,
    };
  }

  // scope === 'canvas' (default)
  return {
    pointerTarget: canvasContainer ?? window,
    keyboardTarget: stageContainer ?? document,
  };
}
```

**Changes in InputCoordinator:** Read `spec.scope` every time the spec changes. Recreate the `ActionInputController` with the correct targets. This is the critical missing link that makes `scope="window"` actually work.

**Props override scope:** If the consumer passes explicit `target` or `keyboardTarget` props to `<InputCoordinator>`, those take precedence over scope resolution. The priority is: explicit prop > scope resolution > fallback. This preserves backward compatibility for any existing custom wiring.

**Non-ScrollStage keyboard gating:** When `scope="canvas"` and there is no `ScrollStage` (e.g., bare `SceneReel`), `stageContainer` is null. `resolveInputTargets` falls back to `canvasContainer` for pointer events and `document` for keyboard. In this case, focus-gating is NOT active (same as current behavior). Focus-gating requires a `ScrollStage` container with `tabIndex={0}`. This is acceptable because non-scroll players are typically full-viewport and don't have multi-instance conflicts.

#### 3. Inertia Accumulator (`input/inertiaAccumulator.ts`)

```typescript
// input/inertiaAccumulator.ts — Stateful inertia integrator, extracted from InputCoordinator.

import { computeInertiaStep, computeUnclampedInertiaStep } from '../player/scrollInertia';

export type InertiaAccumulatorConfig = {
  sensitivity: number;
  decay: number;
};

export type InertiaAccumulatorState = {
  velocity: number;
  pendingDelta: number;
  progress: number;
};

export function createInertiaState(initialProgress?: number): InertiaAccumulatorState {
  return { velocity: 0, pendingDelta: 0, progress: initialProgress ?? 0 };
}

/**
 * Feeds a raw delta (e.g., wheel deltaY or touch dy) into the accumulator.
 * Deltas are batched until tick() is called.
 */
export function feedDelta(state: InertiaAccumulatorState, delta: number): void {
  state.pendingDelta += delta;
}

/**
 * Advances the inertia simulation by one frame.
 * Returns true if progress changed (caller should emit).
 * Clamps progress to [0, 1].
 */
export function tickClamped(
  state: InertiaAccumulatorState,
  config: InertiaAccumulatorConfig,
): boolean {
  const result = computeInertiaStep(
    state.velocity,
    state.pendingDelta,
    config.sensitivity / 1000.0,
    config.decay,
    state.progress,
  );
  state.pendingDelta = 0;
  const changed = result.progress !== state.progress;
  state.velocity = result.velocity;
  state.progress = result.progress;
  return changed;
}

/**
 * Advances the inertia simulation without clamping (for carousel X-axis).
 * Returns the progress delta since last tick.
 */
export function tickUnclamped(
  state: InertiaAccumulatorState,
  config: InertiaAccumulatorConfig,
): number {
  const prev = state.progress;
  const result = computeUnclampedInertiaStep(
    state.velocity,
    state.pendingDelta,
    config.sensitivity,
    config.decay,
    state.progress,
  );
  state.pendingDelta = 0;
  state.velocity = result.velocity;
  state.progress = result.progress;
  return state.progress - prev;
}

/**
 * Resets velocity and pending delta (e.g., on programmatic scrollTo).
 */
export function resetMomentum(state: InertiaAccumulatorState): void {
  state.velocity = 0;
  state.pendingDelta = 0;
}

/**
 * Sets progress directly and resets momentum.
 */
export function setProgress(state: InertiaAccumulatorState, progress: number): void {
  state.progress = progress;
  resetMomentum(state);
}
```

**Test strategy:** Pure functions. Pass real deltas, assert velocity decay and progress advancement. Test boundary clamping. Test resetMomentum. No mocks needed.

#### 4. Axis Arbiter (`input/axisArbiter.ts`)

```typescript
// input/axisArbiter.ts — Sticky axis-lock state machine for wheel/touch arbitration.

export type AxisLock = 'none' | 'x' | 'y';

export type AxisArbiterState = {
  lock: AxisLock;
  lastEventTimestamp: number;
};

export type AxisArbiterConfig = {
  /** Minimum pixel delta before committing to an axis. */
  lockThreshold: number;
  /** Idle time in ms before axis lock resets. */
  resetIdleMs: number;
};

export const DEFAULT_AXIS_ARBITER_CONFIG: AxisArbiterConfig = {
  lockThreshold: 3,
  resetIdleMs: 200,
};

export function createAxisArbiterState(): AxisArbiterState {
  return { lock: 'none', lastEventTimestamp: 0 };
}

/**
 * Feeds a delta pair into the arbiter. Returns the current axis lock.
 * If the arbiter is unlocked and the delta exceeds the threshold, locks to the dominant axis.
 * If the arbiter has been idle for longer than resetIdleMs, resets first.
 */
export function arbiterFeed(
  state: AxisArbiterState,
  absDx: number,
  absDy: number,
  timestamp: number,
  config: AxisArbiterConfig,
): AxisLock {
  // Reset if idle
  if (state.lock !== 'none' && (timestamp - state.lastEventTimestamp) > config.resetIdleMs) {
    state.lock = 'none';
  }
  state.lastEventTimestamp = timestamp;

  // Commit to axis if unlocked and delta exceeds threshold
  if (state.lock === 'none') {
    if (absDx >= config.lockThreshold || absDy >= config.lockThreshold) {
      state.lock = absDx >= absDy ? 'x' : 'y';
    }
  }

  return state.lock;
}

/**
 * Checks if the arbiter should be reset due to idle time, without feeding new deltas.
 * Called from the RAF loop to ensure locks expire even without new events.
 */
export function arbiterIdleCheck(
  state: AxisArbiterState,
  timestamp: number,
  config: AxisArbiterConfig,
): void {
  if (state.lock !== 'none' && (timestamp - state.lastEventTimestamp) > config.resetIdleMs) {
    state.lock = 'none';
  }
}
```

**Test strategy:** Pure state machine. Feed sequences of (dx, dy, timestamp), assert lock transitions. Test idle reset. Test threshold edge cases. No mocks.

#### 5. Carousel Stepper (`input/carouselStepper.ts`)

```typescript
// input/carouselStepper.ts — Pure carousel index computation.

export type CarouselStepInput = {
  currentIndex: number;
  direction: 1 | -1;
  step: number;
  childCount: number;
  loop: boolean;
};

/**
 * Computes the new carousel index after stepping.
 * Returns null if the index didn't change (clamped at boundary, empty carousel).
 */
export function computeCarouselStep(input: CarouselStepInput): number | null {
  if (input.childCount === 0) return null;

  const rawNext = input.currentIndex + input.direction * input.step;
  let newIndex: number;

  if (input.loop) {
    newIndex = ((rawNext % input.childCount) + input.childCount) % input.childCount;
  } else {
    newIndex = Math.max(0, Math.min(input.childCount - 1, rawNext));
  }

  if (newIndex === input.currentIndex) return null;
  return newIndex;
}
```

**Test strategy:** Pure function. Test loop/non-loop, boundary clamping, step sizes, empty carousel. ~15 test cases. Zero mocks.

#### 6. Touch Gesture Classifier (`input/touchGestureClassifier.ts`)

```typescript
// input/touchGestureClassifier.ts — Classifies multi-touch gestures.

export type TouchGestureIntent =
  | 'scroll'          // 1-finger vertical swipe
  | 'carousel-swipe'  // 1-finger horizontal swipe
  | 'drag-2'          // 2-finger drag (orbit)
  | 'pinch'           // 2-finger pinch (zoom)
  | 'drag-3'          // 3-finger drag (pan)
  | 'undecided';      // not enough data yet

export type TouchClassifierConfig = {
  /** Pixels of movement before classifying 1-finger as X vs Y. */
  axisLockThreshold: number;
  /** Pixels of distance change before classifying 2-finger as pinch vs drag. */
  pinchVsDragThreshold: number;
  /** Max ms to wait for additional fingers before committing. */
  fingerSettleMs: number;
};

export const DEFAULT_TOUCH_CLASSIFIER_CONFIG: TouchClassifierConfig = {
  axisLockThreshold: 8,
  pinchVsDragThreshold: 10,
  fingerSettleMs: 80,
};

export type TouchClassifierState = {
  intent: TouchGestureIntent;
  fingerCount: number;
  startTimestamp: number;
  /** For 1-finger: cumulative displacement for axis determination. */
  cumulativeDx: number;
  cumulativeDy: number;
  /** For 2-finger: initial inter-finger distance. */
  initialDistance: number | null;
  /** For 2-finger: current inter-finger distance. */
  currentDistance: number | null;
};

export function createTouchClassifierState(): TouchClassifierState {
  return {
    intent: 'undecided',
    fingerCount: 0,
    startTimestamp: 0,
    cumulativeDx: 0,
    cumulativeDy: 0,
    initialDistance: null,
    currentDistance: null,
  };
}

export function resetClassifier(state: TouchClassifierState): void {
  state.intent = 'undecided';
  state.fingerCount = 0;
  state.cumulativeDx = 0;
  state.cumulativeDy = 0;
  state.initialDistance = null;
  state.currentDistance = null;
}

/**
 * Updates the classifier with new finger count and movement data.
 * Returns the current gesture intent.
 */
export function classifyTouch(
  state: TouchClassifierState,
  fingerCount: number,
  dx: number,
  dy: number,
  interFingerDistance: number | null,
  timestamp: number,
  config: TouchClassifierConfig,
): TouchGestureIntent {
  // If already classified, sticky (don't change mid-gesture)
  if (state.intent !== 'undecided') return state.intent;

  // Track finger count changes
  if (fingerCount !== state.fingerCount) {
    state.fingerCount = fingerCount;
    state.startTimestamp = timestamp;
    state.cumulativeDx = 0;
    state.cumulativeDy = 0;
    if (interFingerDistance !== null) {
      state.initialDistance = interFingerDistance;
    }
  }

  // 3 fingers: always drag-3 (pan)
  if (fingerCount >= 3) {
    state.intent = 'drag-3';
    return state.intent;
  }

  // 2 fingers: pinch vs drag
  if (fingerCount === 2) {
    state.currentDistance = interFingerDistance;
    if (state.initialDistance !== null && interFingerDistance !== null) {
      const distanceDelta = Math.abs(interFingerDistance - state.initialDistance);
      if (distanceDelta >= config.pinchVsDragThreshold) {
        state.intent = 'pinch';
        return state.intent;
      }
    }
    // If movement without significant distance change, it's a 2-finger drag
    state.cumulativeDx += Math.abs(dx);
    state.cumulativeDy += Math.abs(dy);
    const totalMovement = state.cumulativeDx + state.cumulativeDy;
    if (totalMovement >= config.axisLockThreshold) {
      state.intent = 'drag-2';
      return state.intent;
    }
    return 'undecided';
  }

  // 1 finger: scroll vs carousel-swipe
  if (fingerCount === 1) {
    state.cumulativeDx += Math.abs(dx);
    state.cumulativeDy += Math.abs(dy);
    if (state.cumulativeDx >= config.axisLockThreshold || state.cumulativeDy >= config.axisLockThreshold) {
      state.intent = state.cumulativeDx >= state.cumulativeDy ? 'carousel-swipe' : 'scroll';
      return state.intent;
    }
    return 'undecided';
  }

  return 'undecided';
}
```

**Test strategy:** Pure state machine. Feed sequences of touch events, assert classification. Test finger count transitions, pinch vs drag disambiguation, axis lock. ~20 test cases.

#### 7. Multi-Touch Pointer Support in ActionInputController

Add `touches?: number` to `InputPointerMap` (already in types proposal). In `handlePointerDown`:

```typescript
// When pointerType === 'touch' and touches field is set on a map:
// 1. Track touch in touchPoints (already done)
// 2. After finger settle window (80ms), check touchPoints.size against map.touches
// 3. If match, begin drag from centroid of all tracked touches
// 4. Compute drag delta from centroid movement on subsequent pointermove events

private touchCentroid(): { x: number; y: number } | null {
  if (this.touchPoints.size === 0) return null;
  let sumX = 0, sumY = 0;
  for (const pt of this.touchPoints.values()) {
    sumX += pt.x;
    sumY += pt.y;
  }
  return { x: sumX / this.touchPoints.size, y: sumY / this.touchPoints.size };
}
```

**Semantics:** `touches` means "exactly N fingers." `touches: 2` matches when exactly 2 fingers are tracked. When `touches` is undefined, the map matches single-pointer (mouse/stylus) events only — this is backward compatible with current behavior where touch `pointerdown` returns early.

**Finger settle:** When a new finger arrives, the controller waits up to `fingerSettleMs` (80ms, from `TouchClassifierConfig`) before committing to a finger count. During the settle window, no drag events are dispatched. If a third finger arrives within the window, the match rechecks. After the window expires or movement exceeds `axisLockThreshold`, the finger count is committed and the best-matching drag action begins.

**Button field:** When `touches` is set, the `button` field is ignored (touch events report button=0 regardless).

**Priority matching:** `touches` count acts like modifier count — higher finger count wins when multiple maps match. A `touches: 3` map beats a `touches: 2` map.

**iOS 3-finger caveat:** iOS reserves 3-finger gestures for system actions (undo/redo on iPad, multitasking swipe). The 3-finger pan mapping may be unreliable on iOS. The plan includes it as the default, but scene authors can override `default-camera-pan` to use a different gesture if needed. A future iteration may add a `long-press-then-drag` alternative for mobile pan.

#### 8. Focus-Gated Keyboard Input

```typescript
// In ScrollStage.tsx:
// Add tabIndex={0} to the outer container div
// Add onPointerEnter auto-focus behavior (mouse only)

<div
  ref={containerRef}
  tabIndex={0}
  onPointerEnter={(e) => {
    // Only auto-focus on mouse hover, not touch tap.
    // On mobile, touch pointerenter would dismiss on-screen keyboards.
    if (e.pointerType !== 'mouse') return;
    if (document.activeElement !== e.currentTarget &&
        !e.currentTarget.contains(document.activeElement)) {
      e.currentTarget.focus({ preventScroll: true });
    }
  }}
  style={{
    outline: 'none', // suppress focus ring
    // ... existing styles
  }}
>
```

In `InputCoordinator`, when `scope="canvas"`, keyboard events listen on the stage container (which now has tabIndex). This means keyboard input only fires when the stage has focus, preventing cross-instance conflicts.

#### 9. InputCoordinator Decomposition

After extracting the pure modules, InputCoordinator becomes:

```
InputCoordinator (~200 lines)
├── Creates InertiaAccumulatorState (Y-axis scroll)
├── Creates InertiaAccumulatorState (X-axis carousel)
├── Creates AxisArbiterState
├── Creates TouchClassifierState
├── Reads spec.scope → calls resolveInputTargets()
├── Wires ActionInputController with resolved targets
├── Wires touch handlers that delegate to TouchGestureClassifier
├── RAF loop:
│   ├── tickClamped(yInertia) → emitProgress
│   ├── tickUnclamped(xInertia) → computeCarouselStep → patchWidgetStates
│   └── arbiterIdleCheck
├── onUnclaimedWheel:
│   ├── arbiterFeed → route to Y or X inertia accumulator
└── Carousel step → computeCarouselStep + resolveLayout + patchWidgetStates
```

All carousel layout recomputation stays in InputCoordinator (it needs engine context), but the pure index math is delegated to `carouselStepper.ts`.

#### 10. Default Input Spec — Complete

**Design principle:** Scroll Y = ALWAYS scene transition. Scroll X = ALWAYS carousel navigation. Never override scroll for camera control. Camera actions use pointer drag + modifiers, pinch, and keyboard — never wheel.

This eliminates every scroll-related conflict in one stroke:
- No WheelMap in ANY default action (so unclaimed wheel ALWAYS falls to inertia accumulators)
- Y inertia → scene scroll (always)
- X inertia → carousel navigation (always, when primaryCarouselId is set)
- Camera orbit/zoom/pan use drag, modifier+drag, pinch, and keyboard only

```typescript
export function createDefaultInputSpec(options?: DefaultInputSpecOptions): SceneInputControllerSpec {
  const cameraId = options?.cameraId ?? 'camera';

  const actions: InputActionSpec[] = [
    // ── Scene navigation (keyboard) ──
    // Scroll Y is handled by the unclaimed-wheel → inertia path (ALWAYS).
    // Arrow keys provide discrete scene stepping.
    {
      id: 'default-scene-next',
      type: 'scene.next',
      maps: [{ kind: 'key', key: 'ArrowDown' }],
    },
    {
      id: 'default-scene-prev',
      type: 'scene.prev',
      maps: [{ kind: 'key', key: 'ArrowUp' }],
    },

    // ── Camera orbit (Cmd/Ctrl+scroll + 2-finger touch) ──
    // Desktop: Cmd+scroll (Meta modifier). Touch: 2-finger drag.
    // Left drag is intentionally FREE — no default consumes it.
    // This keeps overlays, text selection, and future interactions unblocked.
    {
      id: 'default-camera-orbit',
      type: 'camera.orbit',
      cameraId,
      maps: [
        { kind: 'wheel', modifiers: ['meta'], axis: 'xy' },
        { kind: 'pointer', event: 'drag', touches: 2, axis: 'xy' },
      ],
    },

    // ── Camera zoom (pinch only) ──
    // Pinch (touch or trackpad) for zoom. No plain wheel — scroll is sacred.
    {
      id: 'default-camera-zoom',
      type: 'camera.zoom',
      cameraId,
      maps: [
        { kind: 'pinch', direction: 'both' },
      ],
    },

    // ── Camera pan (Shift+scroll + middle-drag + 3-finger touch) ──
    // Desktop: Shift+scroll. Touch: 3-finger drag.
    {
      id: 'default-camera-pan',
      type: 'camera.pan',
      cameraId,
      maps: [
        { kind: 'wheel', modifiers: ['shift'], axis: 'xy' },
        { kind: 'pointer', event: 'drag', button: 'middle', axis: 'xy' },
        { kind: 'pointer', event: 'drag', touches: 3, axis: 'xy' },
      ],
    },

    // ── Camera reset ('r' key) ──
    {
      id: 'default-camera-reset',
      type: 'camera.reset',
      cameraId,
      maps: [{ kind: 'key', key: 'r' }],
    },

    // ── Carousel navigation (keyboard) ──
    // Scroll X is handled by the unclaimed-wheel → X-inertia path (ALWAYS).
    // Arrow keys provide discrete stepping.
    {
      id: 'default-carousel-next',
      type: 'carousel.next',
      layoutId: PRIMARY_CAROUSEL_SENTINEL,
      maps: [
        { kind: 'key', key: 'ArrowRight' },
      ],
    },
    {
      id: 'default-carousel-prev',
      type: 'carousel.prev',
      layoutId: PRIMARY_CAROUSEL_SENTINEL,
      maps: [
        { kind: 'key', key: 'ArrowLeft' },
      ],
    },
  ];

  return {
    id: DEFAULT_INPUT_CONTROLLER_ID,
    scope: 'canvas',
    actions,
  };
}
```

**Key design decisions:**

1. **Plain scroll is ALWAYS navigation.** No unmodified WheelMap in any default action. Plain wheel events fall through to `onUnclaimedWheel` → axis arbiter → Y-inertia (scene scroll) or X-inertia (carousel). This is unconditional.

2. **Camera uses modifier+scroll, not drag.** Cmd+scroll = orbit. Shift+scroll = pan. This keeps left-drag completely free — overlays, text selection, and future interactive elements work without input conflicts. Pinch = zoom (no modifier needed since it's a distinct gesture).

3. **Touch uses finger count.** 1-finger = scroll/carousel. 2-finger drag = orbit. 3-finger drag = pan. Pinch = zoom. This is the natural mobile escalation.

**Full input map summary (desktop + mobile):**

| Action | Desktop | Mobile |
|---|---|---|
| Scene scroll (Y) | Plain scroll Y | 1-finger swipe Y |
| Carousel (X) | Plain scroll X | 1-finger swipe X |
| Camera orbit | ⌘/Ctrl + scroll | 2-finger drag |
| Camera zoom | Pinch (trackpad) | 2-finger pinch |
| Camera pan | Shift + scroll | 3-finger drag |
| Camera reset | R key | (double-tap, future) |
| Scene next/prev | ↑ / ↓ keys | (via scroll) |
| Carousel next/prev | ← / → keys | (via swipe X) |

**Consequence for carousel scenes:** "Scroll X rotates carousel" is now true by default. No special InputController needed.

**Consequence for camera scenes:** Scene 2 (Camera Controls) previously used left-drag for orbit and WheelMap for dolly. After the change, Cmd+scroll orbits and pinch zooms. Authors who want left-drag orbit add it explicitly as a merge override:
```tsx
<InputController scope="canvas">
  {/* Opt-in: left-drag orbit (consumes left drag — no text selection in overlays) */}
  <Action id="drag-orbit" type="camera.orbit">
    <PointerMap event="drag" button="left" axis="xy" />
  </Action>
</InputController>
```

#### 11. Compiler Merge Logic

**Type change:** Add `mergeMode?: 'merge' | 'replace'` as an explicit optional field on `SceneInputControllerSpec` in `input/types.ts`. No `_` prefix, no type casting — it's a first-class field on the spec type. The `inputControllerHandler` in `inputController.tsx` reads `props.mode` and writes it to `spec.mergeMode`.

In `sceneTrackCompiler.ts`, the existing carry-forward loop (lines 412–424) runs FIRST, unchanged. Then replace the default injection block (lines 426–435) with merge logic:

```typescript
// Carry-forward already ran above — each snapshot has either its own spec,
// an inherited spec from a previous scene, or undefined.

// Now merge each scene's spec with the defaults.
const defaultSpec = createDefaultInputSpec();
for (const snapshot of snapshots) {
  const sceneSpec = snapshot.widgets[INPUT_CONTROLLER_WIDGET_ID] as SceneInputControllerSpec | undefined;
  if (sceneSpec) {
    // Scene has a spec (declared or carried forward) — merge with defaults.
    const mergeMode = sceneSpec.mergeMode ?? 'merge';
    snapshot.widgets[INPUT_CONTROLLER_WIDGET_ID] = mergeInputSpecs(defaultSpec, sceneSpec, mergeMode);
  } else {
    // No spec at all — use defaults as-is.
    snapshot.widgets[INPUT_CONTROLLER_WIDGET_ID] = defaultSpec;
  }
}
```

**Carry-forward behavior:** The existing carry-forward logic (where scene N's `<InputController>` is inherited by scene N+1 if N+1 has no `<InputController>`) is PRESERVED. The merge happens AFTER carry-forward. This means: if scene 1 declares a custom action, scenes 2+ inherit that action (via carry-forward) and it gets merged with defaults. A custom action declared once persists across all subsequent scenes unless explicitly overridden. The carry-forward loop in `sceneTrackCompiler.ts` (lines 412–424) runs BEFORE the merge loop.

The `<InputController>` DSL component gains an optional `mode` prop:

```tsx
<InputController scope="canvas" mode="merge">  {/* default, can be omitted */}
<InputController scope="canvas" mode="replace"> {/* opt-in: full override */}
```

**Disabling all input:** `<InputController mode="replace">` with an empty body (no `<Action>` children) produces a spec with zero actions. This effectively disables all camera/carousel/scene-nav input for that scene. Scroll-based scene navigation still works (it's unclaimed wheel → inertia, not an action).

#### 12. Mobile Touch Sensitivity

Add a `touchSensitivityScale` prop to `InputCoordinator`:

```typescript
export interface InputCoordinatorProps {
  inertiaSensitivity?: number;
  inertiaDecay?: number;
  /** Scale factor for touch deltas relative to wheel. Default: 3.5 (was 2.5). */
  touchSensitivityScale?: number;
  // ... existing props
}
```

The default is raised from 2.5 to 3.5 to compensate for the smaller per-event deltas on touch. This is exposed as a prop so authors can tune for their content.

#### 13. CarouselScrubber Element

A new element module following the standard pattern:

**`elements/carousel-scrubber/types.ts`:**

```typescript
/** State for the 3D carousel scrubber indicator. */
export type CarouselScrubberState = {
  /** ViewLayout ID this scrubber tracks. */
  layoutId: string;
  /** Current active index in the carousel. */
  activeIndex: number;
  /** Total number of carousel children. */
  childCount: number;
  /** Whether the carousel loops. */
  loop: boolean;
  /** Visual orientation of the scrubber. */
  orientation: 'horizontal' | 'vertical';
  /** Position in normalized viewport coordinates. */
  position: { x: number; y: number; z: number };
  /** Width of the scrubber track in world units. */
  trackWidth: number;
  /** Visual style. */
  style: CarouselScrubberStyle;
};

export type CarouselScrubberStyle = {
  /** Track color. */
  trackColor: string;
  /** Track opacity. */
  trackOpacity: number;
  /** Handle color. */
  handleColor: string;
  /** Handle glow color. */
  handleGlowColor: string;
  /** Handle width as fraction of segment. */
  handleWidthFraction: number;
  /** Height (depth) of the track in world units. */
  trackHeight: number;
  /** Corner radius of the track. */
  trackRadius: number;
};
```

**Rendering concept:**

The scrubber renders as a horizontal (or vertical) 3D bar at the base of the carousel:
- **Track**: A rounded-rectangle `ExtrudeGeometry` with a translucent glass material, positioned at the bottom of the viewport.
- **Handle**: A smaller rounded-rectangle that slides along the track, with emissive glow. Position = `(activeIndex / (childCount - 1)) * trackWidth`.
- **Interaction**: `pointerdown` on the handle starts a drag. `pointermove` computes the nearest index from the drag position and fires `onCarouselStep` through the `VariableStore`. This makes it a direct-manipulation affordance.
- **Dots**: Small sphere/circle indicators at each index position along the track, with the active one highlighted.
- **Animation**: Handle position transitions smoothly via `lerp` in the `apply()` method.

**DSL usage:**

```tsx
<Scene id="my-carousel-scene" primaryCarouselId="my-layout">
  <ViewLayout id="my-layout" kind="carousel" loop activeIndex={0}>
    {/* ... views ... */}
  </ViewLayout>
  <CarouselScrubber
    layoutId="my-layout"
    position={[0, -0.8, 3]}
    trackWidth={4}
    orientation="horizontal"
    style={{ trackColor: '#1a2a40', handleColor: '#5090e0' }}
  />
</Scene>
```

---

## ALL Example Updates

After the overhaul, update ALL examples across the entire repo to use merge mode and consistent defaults. The goal: every example gets orbit, pan, zoom, reset, scene nav, and carousel nav automatically. Scenes only declare what's DIFFERENT from the defaults.

### Complete Inventory of InputController Usage

Every file in the repo that declares `<InputController>` is listed below, with its current state and the required change.

---

### A. `apps/examples/src/input-showcase/` — Input Showcase (7 scenes)

**Page: `InputShowcasePage.tsx`**
- Uses `ScrollStage` + `InputCoordinator` with `inertiaSensitivity={0.06}`.
- **Change:** Standardize sensitivity to the project default (see §Sensitivity Defaults below).

**Scene 1 (`scene1-welcome.tsx`):** Currently declares orbit-less InputController with scene.next (ArrowDown, Click, WheelMap), scene.prev (ArrowUp), pinch zoom.
- **Missing:** orbit, pan, reset, carousel nav.
- **Change:** REMOVE `<InputController>` entirely. Defaults provide scene nav (ArrowUp/Down), orbit, zoom, pan, reset, carousel nav. The Click → scene.next binding is non-standard and should be removed (it conflicts with carousel click in other scenes).

**Scene 2 (`scene2-camera-controls.tsx`):** Currently declares orbit (left drag), orbit-mod (right/meta drag, speed=0.8), dolly (wheel + pinch), dolly-precision (ctrl+wheel, speed=0.25), reset (R + meta+click), scene nav (ArrowUp/Down).
- **Missing:** pan, carousel nav.
- **Change:** Use merge mode. This scene teaches camera controls, so it adds left-drag orbit as an opt-in on top of the defaults (which provide Cmd+scroll orbit). Only declare CUSTOM additions:
  ```tsx
  <InputController scope="canvas">
    {/* Opt-in: left-drag orbit for this teaching scene */}
    <Action id="drag-orbit" type="camera.orbit">
      <PointerMap event="drag" button="left" axis="xy" />
    </Action>
    {/* Additional: right-drag slower orbit */}
    <Action id="orbit-slow" type="camera.orbit" speed={0.8}>
      <PointerMap event="drag" button="right" axis="xy" />
    </Action>
    {/* Additional: meta+click reset */}
    <Action id="meta-reset" type="camera.reset">
      <PointerMap event="click" modifiers={['meta']} />
    </Action>
  </InputController>
  ```
  Defaults provide: Cmd+scroll orbit, Shift+scroll pan, pinch zoom, R reset, scene nav (arrows + scroll Y), carousel (arrows + scroll X). Plain scroll always navigates scenes.

**Scene 3A/3B (`scene3-scene-navigation.tsx`):** Currently declares scene.next (ArrowDown, Click, WheelMap), scene.prev (ArrowUp), skip-next/skip-prev (Shift+Arrow, stepScenes=2), pinch zoom.
- **Missing:** orbit, pan, reset, carousel nav.
- **Change:** Use merge mode. Remove Click→scene.next (non-standard) and WheelMap→scene.next (scroll already does this via inertia — no need to double-bind). Only declare the skip-step variants:
  ```tsx
  <InputController scope="canvas">
    <Action id="skip-next" type="scene.next" stepScenes={2}>
      <KeyMap keyName="ArrowDown" modifiers={['shift']} />
    </Action>
    <Action id="skip-prev" type="scene.prev" stepScenes={2}>
      <KeyMap keyName="ArrowUp" modifiers={['shift']} />
    </Action>
  </InputController>
  ```

**Scene 4 (`scene4-ring-carousel.tsx`):** Currently declares carousel.next (ArrowRight + Click), carousel.next-skip (Shift+Right, stepSlides=2), carousel.prev (ArrowLeft), carousel.prev-skip (Shift+Left), scene nav, pinch zoom. `primaryCarouselId` set.
- **Missing:** orbit, pan, wheel zoom, reset.
- **Change:** Use merge mode. Only declare the carousel overrides (explicit layoutId, skip variants, click→next):
  ```tsx
  <InputController scope="canvas">
    <Action id="default-carousel-next" type="carousel.next" layoutId={LAYOUT_ID} stepSlides={1}>
      <KeyMap keyName="ArrowRight" />
      <PointerMap event="click" />
    </Action>
    <Action id="carousel-next-skip" type="carousel.next" layoutId={LAYOUT_ID} stepSlides={2}>
      <KeyMap keyName="ArrowRight" modifiers={['shift']} />
    </Action>
    <Action id="default-carousel-prev" type="carousel.prev" layoutId={LAYOUT_ID} stepSlides={1}>
      <KeyMap keyName="ArrowLeft" />
    </Action>
    <Action id="carousel-prev-skip" type="carousel.prev" layoutId={LAYOUT_ID} stepSlides={2}>
      <KeyMap keyName="ArrowLeft" modifiers={['shift']} />
    </Action>
  </InputController>
  ```
  Note: Using `id="default-carousel-next"` overrides the default carousel action (which uses sentinel layoutId) with one that targets the explicit layoutId. Orbit, pan, zoom, reset, scene nav all come free.

**Scene 5 (`scene5-linear-carousel.tsx`):** Similar to scene 4 but with stepSlides=2 default and stepSlides=1 shift variant.
- **Change:** Same pattern as scene 4, with different step sizes.

**Scene 6 (`scene6-scrollable-text.tsx`):** Currently declares orbit, dolly (ctrl+wheel + pinch), reset, scene nav. Missing pan and carousel.
- **Change:** REMOVE `<InputController>` entirely. Since the new defaults never use WheelMap for camera, plain scroll always goes to scene nav, and the scrollable TextBox overlay is handled by the `isOverScrollableContent` check in ActionInputController (yield to native DOM scroll when cursor is over scrollable content). Ctrl+wheel zoom can be added as a merge override if needed, but is optional.

**Scene 7 (`scene7-all-maps.tsx`):** Currently declares scope="window" with full orbit/zoom/pan/reset/carousel/scene nav, including speed variants and multi-step.
- **Change:** Use `mode="replace"` since this scene intentionally demonstrates every possible binding. This is the one scene that should NOT merge with defaults.

---

### B. `apps/examples/src/canvas-region/` — Canvas Region Viewer

**File: `scenes/viewerScene.tsx`**
- Currently declares orbit, dolly (wheel + pinch), pan (shift+drag), reset (R). No scene nav.
- **Comment in file says:** "the compiler-injected default only covers keyboard scene navigation, not pointer/wheel camera actions."
- **This comment is wrong after the merge change** — defaults now include all camera actions.
- **Change:** REMOVE `<InputController>` entirely. The single-scene viewer gets orbit, zoom, pan, reset from defaults. Scene nav is a no-op (single scene). Update the comment.

---

### C. `apps/examples/src/media-screen-demo/` — Media Screen Demo

**File: `scenes/mediaScreenScene.tsx`**
- Currently declares `scope="window"` with only carousel.next (ArrowRight) and carousel.prev (ArrowLeft). `primaryCarouselId` set.
- **Missing:** orbit, zoom, pan, reset, scene nav.
- **Change:** REMOVE `<InputController>`. This is a single-scene demo — defaults provide carousel nav (ArrowLeft/Right via sentinel resolved to primaryCarouselId), plus all camera actions. The scope doesn't matter for a single scene.

**Page: `MediaScreenDemoPage.tsx`**
- Uses `InputCoordinator` with no custom props (defaults).
- **Change:** None needed at page level.

---

### D. `apps/examples/src/views/` — Views Demo

**File: `scenes/scene3-carousel.tsx`**
- **CarouselScene1–4:** Declare `ViewLayout kind="carousel"` with static `activeIndex` per scene. NO `<InputController>`, NO `primaryCarouselId`. These are non-interactive — users cannot navigate between carousel views.
- **Change:** Add `primaryCarouselId` to each `<Scene>` pointing to the ViewLayout id. This makes the default carousel keyboard bindings (← →) functional. The carousel's `activeIndex` from the DSL still sets the initial position per scene, but now users can also navigate within a scene. No `<InputController>` needed — defaults handle it.
- **CarouselScene (interactive):** Declares `primaryCarouselId="demo-carousel"` + `<InputController scope="canvas">` with carousel.next (ArrowRight + Click), carousel.prev (ArrowLeft).
- **Missing:** orbit, zoom, pan, reset.
- **Change:** REMOVE `<InputController>`. Set `primaryCarouselId` on the `<Scene>` (already set). Defaults provide carousel nav via sentinel + all camera actions + scene nav. The Click → carousel.next binding is lost (non-default), but this is acceptable — click is not a standard carousel gesture.

**File: `scenes/scene6-linear-carousel.tsx`**
- **LinearCarouselScene1–3:** Declare `ViewLayout kind="carousel"` with static `activeIndex` per scene. NO `<InputController>`, NO `primaryCarouselId`. Currently non-interactive.
- **Change:** Add `primaryCarouselId` to each `<Scene>` pointing to the ViewLayout id. Default keyboard carousel bindings become functional.

### D2. `apps/examples/src/model-showcase/` — Model Showcase

**File: `scenes/scene05_carousel.tsx`**
- **Scene05Carousel:** Declares `ViewLayout kind="carousel"` with `activeIndex={1}`. NO `<InputController>`, NO `primaryCarouselId`. The robot carousel is static — users see only the middle panel.
- **Change:** Add `primaryCarouselId` to the `<Scene>`. Default carousel bindings allow users to browse all three robots with ← →.

---

### E. `apps/examples/src/core-showcase/` — Core Showcase

**File: `scenes.tsx` (Scene 12 — InputScene)**
- Currently declares orbit (left drag), dolly (wheel), reset (R key). No pan, no scene nav, no carousel.
- **Purpose:** Teaches InputController by showing it in action. The diagram in this scene literally shows "Drag → orbit", "Wheel → zoom", "'r' → reset" as nodes.
- **Change:** This scene is pedagogical — it demonstrates how `<InputController>` works. It should keep its `<InputController>` block with `mode="replace"` because the point is to show exactly what's declared. But update the TextBox caption to mention that merge mode is the default and this scene uses replace for demonstration.

**Page: `CoreShowcasePage.tsx`**
- Uses `InputCoordinator` with `inertiaSensitivity={0.008} inertiaDecay={0.85}`.
- **Change:** Standardize to project default sensitivity.

---

### F. `apps/docs/src/demos/core/` — Docs Demos

**File: `InputActionsDemo.demo.tsx`**
- Currently declares orbit (left drag), dolly (wheel), reset (right-click). Uses `type="camera.dolly"` which is **legacy** (should be `camera.zoom`).
- **Change:** Fix action type to `camera.zoom`. Use `mode="replace"` for the demo since it teaches InputController explicitly. Update the CODE string constant to match.

---

### G. `apps/docs/src/pages/core/` — Docs Pages (path: `apps/docs/src/`)

Note: `apps/docs/` is a separate docs app in the monorepo (NOT `apps/examples/`). It contains demo components and documentation pages.

**Files:** `SceneDsl.tsx`, `ProgressManager.tsx`, `ApiReference.tsx`, `Actions.tsx`, `Registry.tsx`, `CameraElement.tsx`
- These reference `<InputController>` in documentation text/code samples only — no live scene code.
- **Change:** Update code examples in documentation to show merge mode as the default pattern. Add a note about `mode="replace"` for full control.

---

### H. `apps/website/` — Production Website

The website app declares NO `<InputController>` in any scene and relies entirely on compiler-injected defaults. After the default spec change:

- Camera orbit changes from left-drag to ⌘/Ctrl+scroll.
- Camera pan changes from Shift+left-drag to Shift+scroll.
- Left drag is now free (no longer consumed by orbit).
- Touch support (2-finger orbit, pinch zoom) is new.
- Carousel navigation via scroll X is available (if any scene sets `primaryCarouselId`).

**Change:** Verify all scenes in `apps/website/src/scenes/` work correctly with the new defaults. No code changes expected — the website benefits from the improved defaults. Add to the Phase 6 manual test list.

| File | Action |
|---|---|
| `apps/website/src/scenes/**/*.tsx` | Manual test — verify orbit (⌘+scroll), pan (Shift+scroll), zoom (pinch), scene nav (scroll Y) all work |

---

### Sensitivity Defaults

All example pages currently have inconsistent `inertiaSensitivity` values:

| Page | Current | New |
|---|---|---|
| CoreShowcasePage | 0.008 | 0.012 |
| ChartDemoPage | 0.010 | 0.012 |
| InputShowcasePage | 0.06 | 0.012 |
| ModelShowcasePage | 0.010 | 0.012 |
| ViewDemoPage | 0.010 | 0.012 |
| MediaScreenDemoPage | (default 0.01) | 0.012 |
| CanvasRegionPage | (default) | (default) |

Standardize to `0.012` across all `ScrollStage`-based pages. This is the middle ground that works for both dense content (core showcase) and sparse content (charts). Pages that need faster/slower scroll can override.

The `inertiaDecay` stays at `0.85` (already consistent).

---

### Summary: Files to Modify in Phase 6

| File | Action |
|---|---|
| `apps/examples/src/input-showcase/scenes/scene1-welcome.tsx` | Remove `<InputController>` block |
| `apps/examples/src/input-showcase/scenes/scene2-camera-controls.tsx` | Simplify to merge mode (3 custom actions only) |
| `apps/examples/src/input-showcase/scenes/scene3-scene-navigation.tsx` | Simplify to merge mode (2 skip actions only) |
| `apps/examples/src/input-showcase/scenes/scene4-ring-carousel.tsx` | Simplify to merge mode (4 carousel actions + scrubber) |
| `apps/examples/src/input-showcase/scenes/scene5-linear-carousel.tsx` | Simplify to merge mode (4 carousel actions + scrubber) |
| `apps/examples/src/input-showcase/scenes/scene6-scrollable-text.tsx` | Remove `<InputController>` entirely (scroll is sacred; overlay scroll handled by waterfall) |
| `apps/examples/src/input-showcase/scenes/scene7-all-maps.tsx` | Add `mode="replace"` (keep full override) |
| `apps/examples/src/input-showcase/InputShowcasePage.tsx` | Standardize sensitivity to 0.012 |
| `apps/examples/src/canvas-region/scenes/viewerScene.tsx` | Remove `<InputController>` block entirely |
| `apps/examples/src/media-screen-demo/scenes/mediaScreenScene.tsx` | Remove `<InputController>` block entirely |
| `apps/examples/src/views/scenes/scene3-carousel.tsx` | Remove `<InputController>` from `CarouselScene`; add `primaryCarouselId` to CarouselScene1–4 |
| `apps/examples/src/views/scenes/scene6-linear-carousel.tsx` | Add `primaryCarouselId` to LinearCarouselScene1–3 |
| `apps/examples/src/model-showcase/scenes/scene05_carousel.tsx` | Add `primaryCarouselId` to Scene05Carousel |
| `apps/examples/src/core-showcase/scenes.tsx` | Add `mode="replace"` to InputScene; update caption |
| `apps/examples/src/core-showcase/CoreShowcasePage.tsx` | Standardize sensitivity to 0.012 |
| `apps/examples/src/chart/ChartDemoPage.tsx` | Standardize sensitivity to 0.012 |
| `apps/examples/src/model-showcase/ModelShowcasePage.tsx` | Standardize sensitivity to 0.012 |
| `apps/examples/src/views/ViewDemoPage.tsx` | Standardize sensitivity to 0.012 |
| `apps/examples/src/media-screen-demo/MediaScreenDemoPage.tsx` | Add explicit sensitivity 0.012 |
| `apps/docs/src/demos/core/InputActionsDemo.demo.tsx` | Fix `camera.dolly` → `camera.zoom`; add `mode="replace"` |
| `apps/docs/src/pages/core/Actions.tsx` | Update code samples for merge mode |
| `apps/docs/src/pages/core/SceneDsl.tsx` | Update code samples for merge mode |
| `apps/docs/src/pages/core/ApiReference.tsx` | Update code samples for merge mode |
| All overlay TextBox controls references | Update to match actual bindings post-merge |

---

## Implementation Sequence

### Phase 1: Pure Modules (no breaking changes)
1. `input/carouselStepper.ts` + tests
2. `input/axisArbiter.ts` + tests
3. `input/inertiaAccumulator.ts` + tests
4. `input/inputSpecMerger.ts` + tests
5. `input/scopeResolver.ts` + tests

### Phase 2: Compiler Integration (merge logic with CURRENT default spec)
6. Add `mergeMode` field to `SceneInputControllerSpec` type
7. Add `mode` prop to `<InputController>` DSL, write to `spec.mergeMode`
8. Update `sceneTrackCompiler.ts` to use `mergeInputSpecs` (after carry-forward loop)
9. Verify all existing scenes still compile correctly with current defaults + merge

### Phase 3: New Default Spec + Touch + Scope
10. Update `createDefaultInputSpec` with new input map (⌘+scroll orbit, Shift+scroll pan, pinch zoom, no left-drag orbit)
11. Add `touches` field to `InputPointerMap` type
12. Update `ActionInputController` for multi-touch drag (centroid, finger settle)
13. `input/touchGestureClassifier.ts` + tests
14. Implement scope resolution in `InputCoordinator`
15. Focus-gating on `ScrollStage` (tabIndex, pointerType=mouse auto-focus)
16. Add touch fallbacks to default spec (touches: 2 for orbit, touches: 3 for pan)
17. Raise touch sensitivity default

### Phase 4: InputCoordinator Decomposition
18. Refactor `InputCoordinator` to use extracted modules
19. Verify all examples still work
20. Update InputCoordinator tests

### Phase 5: Carousel Scrubber
21. `elements/carousel-scrubber/` full module (types, dsl, compile, render, widget)
22. Register in `createDefaultWidgetRegistry()` and `ensureCoreHandlerRegistry()`
23. Add to carousel scenes (input-showcase 4, 5, 7 + views scene3 + media-screen)

### Phase 6: ALL Example Updates
24. Remove unnecessary `<InputController>` blocks from scenes that only redeclare defaults:
    - `canvas-region/scenes/viewerScene.tsx` — remove entirely
    - `media-screen-demo/scenes/mediaScreenScene.tsx` — remove entirely
    - `views/scenes/scene3-carousel.tsx` (CarouselScene) — remove entirely
    - `input-showcase/scenes/scene1-welcome.tsx` — remove entirely
    - `input-showcase/scenes/scene6-scrollable-text.tsx` — remove entirely (scroll sacred; overlay handled by waterfall)
25. Simplify merge-mode scenes (keep only custom overrides):
    - `input-showcase/scenes/scene2-camera-controls.tsx` — 3 custom actions (orbit-mod, ctrl+wheel zoom, meta+click reset)
    - `input-showcase/scenes/scene3-scene-navigation.tsx` — 2 skip actions (shift+arrow)
    - `input-showcase/scenes/scene4-ring-carousel.tsx` — 4 carousel actions (explicit layoutId + skip variants)
    - `input-showcase/scenes/scene5-linear-carousel.tsx` — 4 carousel actions (different step sizes)
26. Add `mode="replace"` to pedagogical scenes:
    - `input-showcase/scenes/scene7-all-maps.tsx` — full override demo
    - `core-showcase/scenes.tsx` (InputScene) — teaching scene
    - `docs/demos/core/InputActionsDemo.demo.tsx` — fix `camera.dolly` → `camera.zoom`
27. Standardize sensitivity across ALL page-level components to `0.012` / `0.85`:
    - `CoreShowcasePage.tsx`, `ChartDemoPage.tsx`, `InputShowcasePage.tsx`
    - `ModelShowcasePage.tsx`, `ViewDemoPage.tsx`, `MediaScreenDemoPage.tsx`
28. Update all overlay TextBox controls references to match actual post-merge bindings
29. Update docs pages code samples: `Actions.tsx`, `SceneDsl.tsx`, `ApiReference.tsx`
30. Manual test on desktop (Chrome, Firefox, Safari) and mobile (iOS Safari, Android Chrome)
31. Verify `apps/website/` works with new defaults (no code changes expected)

---

## Test Plan

| Module | Test file | Strategy | Est. cases |
|---|---|---|---|
| `carouselStepper.ts` | `packages/core/src/input/__tests__/carouselStepper.test.ts` | Pure function: loop/non-loop, boundaries, step sizes | 12 |
| `axisArbiter.ts` | `packages/core/src/input/__tests__/axisArbiter.test.ts` | Pure state machine: lock transitions, idle reset, threshold | 10 |
| `inertiaAccumulator.ts` | `packages/core/src/input/__tests__/inertiaAccumulator.test.ts` | Pure: feed deltas, tick, verify decay and clamping | 15 |
| `inputSpecMerger.ts` | `packages/core/src/input/__tests__/inputSpecMerger.test.ts` | Pure: merge/replace modes, override by id, append new | 12 |
| `scopeResolver.ts` | `packages/core/src/input/__tests__/scopeResolver.test.ts` | Pure: canvas vs window scope, null fallbacks | 6 |
| `touchGestureClassifier.ts` | `packages/core/src/input/__tests__/touchGestureClassifier.test.ts` | Pure: finger sequences, pinch/drag disambiguation | 20 |
| `ActionInputController` (updated) | `packages/core/src/input/__tests__/ActionInputController.test.ts` (extend) | Add `touches` matching, centroid drag | 8 |
| `sceneTrackCompiler` (merge) | `packages/core/src/compiler/__tests__/sceneTrackCompiler.test.ts` (extend) | Verify merge vs replace, default injection, carry-forward + merge | 6 |
| `InputCoordinator` (decomposed) | `packages/core/src/player/__tests__/InputCoordinator.test.tsx` (extend) | Integration: scope switching, touch routing | 8 |

**Total: ~97 new test cases**, all interface-based and stateful. No mocks for pure modules.

---

## Risk Mitigation

1. **Backward compatibility for merge behavior.** Merge mode is the new default, but existing scenes that declare `<InputController>` without `mode` prop get merge behavior. Since merge adds defaults that weren't there before, this changes behavior. **Mitigation:** The defaults added are universally expected (orbit, pan, zoom). Scenes that explicitly redeclare these actions override the defaults via id matching. The `mode="replace"` escape hatch exists for edge cases. **For published `@brewsite/core` consumers:** This is a behavioral change in a minor release. The CHANGELOG must document it prominently and explain `mode="replace"` for consumers who want the old behavior.

1b. **Default input map change (⌘+scroll orbit replaces left-drag orbit).** This is the single most visible behavioral change. Every existing deployment using defaults currently has left-drag orbit. After this change, orbit requires ⌘/Ctrl+scroll. **Mitigation:** Phase this separately from the merge logic. Phase 2 ships merge with the CURRENT default spec. Phase 3 ships the new default spec as a separate step. This reduces blast radius and makes regression bisection trivial. The plan's Phase 2 and Phase 3 are ordered accordingly.

2. **Touch gesture ambiguity.** Two-finger gestures could be pinch or drag. **Mitigation:** The touch gesture classifier uses a 10px distance-change threshold before committing to pinch. If fingers move together (distance stable), it's drag. This matches native iOS gesture behavior.

3. **Focus stealing.** Auto-focus on hover could interfere with forms or other interactive elements on the page. **Mitigation:** Auto-focus only fires for `pointerType === 'mouse'` (not touch). Only fires if the stage container doesn't already contain the focused element. `preventScroll: true` prevents scroll jumps.

3b. **iOS 3-finger gesture conflict.** iOS reserves 3-finger gestures for system actions (undo/redo on iPad, multitasking swipe). The `touches: 3` pan mapping may be unreliable. **Mitigation:** The 3-finger mapping is a best-effort default. Scene authors can override `default-camera-pan` to use a different gesture. Camera pan is a secondary interaction — the primary mobile experience (scroll, carousel, pinch zoom) works with 1–2 fingers only.

4. **Performance.** Extracting modules adds function call overhead in the RAF loop. **Mitigation:** All extracted functions are leaf functions with no allocations in the hot path. The overhead is negligible compared to Three.js rendering.
