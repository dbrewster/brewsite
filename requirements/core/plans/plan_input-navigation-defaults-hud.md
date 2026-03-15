---
title: "Input Navigation Defaults, Refinements & InputHud Foundation"
doc_type: plan
owner: Toolkit Architecture
status: draft
updated: 2026-03-14
---

# Plan: Input Navigation Defaults, Refinements & InputHud Foundation

This plan implements the full feature described in `requirements/core/notes/prd_input-navigation-defaults-hud.md`. It covers five parallel implementation streams (A–E) plus one sequential integration stream (F). Each stream touches **zero overlapping files** with any other stream so up to 5 developers can work concurrently.

---

## Table of Contents

1. [Stream Summary & File Ownership](#1-stream-summary--file-ownership)
2. [Stream A — Pure Function Modules](#2-stream-a--pure-function-modules)
3. [Stream B — Input Type & ActionInputController Changes](#3-stream-b--input-type--actioninputcontroller-changes)
4. [Stream C — IGroupOwner Removal & IViewChild Introduction](#4-stream-c--igroupowner-removal--iviewchild-introduction)
5. [Stream D — Compiler, Engine & InputCoordinator Changes](#5-stream-d--compiler-engine--inputcoordinator-changes)
6. [Stream E — InputHud Foundation (Deferred Rendering)](#6-stream-e--inputhud-foundation-deferred-rendering)
7. [Stream F — apps/examples Migration](#7-stream-f--appsexamples-migration)
8. [Breaking Changes Summary](#8-breaking-changes-summary)
9. [Test Strategy](#9-test-strategy)
10. [Dependency Graph](#10-dependency-graph)

---

## 1. Stream Summary & File Ownership

| Stream | Description | Blocked By | Files Owned |
|--------|-------------|------------|-------------|
| **A** | Pure function modules: `defaultInputSpec`, `platformKeys`, `transitionAnimator` | None | 3 new files in `packages/core/src/input/` |
| **B** | Input type renames (`camera.dolly`→`camera.zoom`, `canvas.pan`→`camera.pan`), `ActionInputHandler` move, `onActionFired` subscription | None | `input/types.ts`, `input/ActionInputController.ts`, `input/index.ts` |
| **C** | `IGroupOwner` removal, `IViewChild` introduction, ViewWidget simplification, MediaScreenWidget migration, plugins.ts update | None | `widget/types.ts`, `widget/WidgetRegistry.ts`, `widget/index.ts`, `elements/view/ViewWidget.ts`, `player/plugins.ts`, `packages/screens/src/elements/media-screen/widget.ts` |
| **D** | Compiler extensions (`primaryCarouselId`, `transitionDuration`/`transitionEasing`), `useSceneEngine` transition API, `SceneEngine` props, InputCoordinator X-inertia + axis arbitration + carousel sentinel, CameraWidget pan, RuntimeDriverImpl widget-object tracking | **A** + **B** | `compiler/*`, `player/useSceneEngine.ts`, `player/SceneEngine.tsx`, `player/InputCoordinator.tsx`, `player/engineTypes.ts`, `player/index.ts`, `elements/camera/CameraWidget.ts`, `runtime/RuntimeDriverImpl.ts` |
| **E** | InputHud foundation: `onActionFired` event type, data model, deferred component stub | **B** | `hud/InputHud.tsx` (new), `hud/inputHudTypes.ts` (new) |
| **F** | apps/examples migration to new APIs | **All** | `apps/examples/**` |

---

## 2. Stream A — Pure Function Modules

### 2.1 `packages/core/src/input/defaultInputSpec.ts` (NEW)

**Single responsibility:** Factory function returning the standard `SceneInputControllerSpec` with all default bindings.

```typescript
// defaultInputSpec.ts — Pure factory for the standard input binding set.

import type { SceneInputControllerSpec, InputActionSpec } from './types';

/**
 * Default input controller widget ID.
 * Must match INPUT_CONTROLLER_WIDGET_ID from compiler/blocks/inputController.tsx.
 */
export const DEFAULT_INPUT_CONTROLLER_ID = 'input-controller';

/**
 * Sentinel layoutId used for carousel actions in the default spec.
 * At runtime, InputCoordinator resolves this to the current scene's
 * `primaryCarouselId`. When no `primaryCarouselId` is set, the action
 * is a silent no-op.
 *
 * This sentinel approach means the default spec is always identical
 * regardless of whether a carousel exists — the compiler does not need
 * to know `primaryCarouselId` at injection time.
 */
export const PRIMARY_CAROUSEL_SENTINEL = '__primary_carousel__';

/**
 * Returns the standard SceneInputControllerSpec with all default bindings.
 *
 * This is the binding set injected by the compiler when no <InputController>
 * is declared in a scene. Scene authors can override individual actions by
 * declaring their own <InputController> with a subset of these actions.
 *
 * The spec always includes carousel actions using the sentinel layoutId.
 * At runtime, InputCoordinator resolves the sentinel to `primaryCarouselId`.
 * When no carousel exists, the carousel actions are silent no-ops.
 *
 * @param options.cameraId — Widget ID of the primary camera. Default: 'camera'.
 * @param options.canvasId — Widget ID of the primary action-input canvas. Default: undefined.
 */
export function createDefaultInputSpec(options?: {
  cameraId?: string;
  canvasId?: string;
}): SceneInputControllerSpec {
  const cameraId = options?.cameraId ?? 'camera';

  const actions: InputActionSpec[] = [
    // ── Scene navigation (keyboard) ──
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

    // ── Camera orbit (pointer drag) ──
    {
      id: 'default-camera-orbit',
      type: 'camera.orbit',
      cameraId,
      maps: [{ kind: 'pointer', event: 'drag', button: 'left', axis: 'xy' }],
    },

    // ── Camera zoom (pinch + wheel) ──
    {
      id: 'default-camera-zoom',
      type: 'camera.zoom',
      cameraId,
      maps: [
        { kind: 'pinch', direction: 'both' },
      ],
    },

    // ── Camera pan (pointer drag + shift) ──
    {
      id: 'default-camera-pan',
      type: 'camera.pan',
      cameraId,
      maps: [
        { kind: 'pointer', event: 'drag', button: 'left', modifiers: ['shift'], axis: 'xy' },
        { kind: 'pointer', event: 'drag', button: 'middle', axis: 'xy' },
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
    // Always present using sentinel layoutId. InputCoordinator resolves the
    // sentinel to primaryCarouselId at runtime. No-op when no carousel exists.
    {
      id: 'default-carousel-next',
      type: 'carousel.next',
      layoutId: PRIMARY_CAROUSEL_SENTINEL,
      maps: [{ kind: 'key', key: 'ArrowRight' }],
    },
    {
      id: 'default-carousel-prev',
      type: 'carousel.prev',
      layoutId: PRIMARY_CAROUSEL_SENTINEL,
      maps: [{ kind: 'key', key: 'ArrowLeft' }],
    },
  ];

  return {
    id: DEFAULT_INPUT_CONTROLLER_ID,
    scope: 'canvas',
    actions,
  };
}
```

**Test file:** `packages/core/src/input/__tests__/defaultInputSpec.test.ts`

Tests:
- Returns a valid `SceneInputControllerSpec` with the expected `id` and `scope`.
- Contains all expected action types: `scene.next`, `scene.prev`, `camera.orbit`, `camera.zoom`, `camera.pan`, `camera.reset`, `carousel.next`, `carousel.prev`.
- Carousel actions always use `PRIMARY_CAROUSEL_SENTINEL` as `layoutId`.
- Custom `cameraId` propagates to all camera-related actions.
- All actions have non-empty `maps` arrays.
- The spec is always identical regardless of options (sentinel approach — no conditional carousel inclusion).

---

### 2.2 `packages/core/src/input/platformKeys.ts` (NEW)

**Single responsibility:** Platform detection and modifier-key formatting utilities.

```typescript
// platformKeys.ts — Platform detection and modifier-key formatting utilities.

import type { ModifierKey, KeyCombo } from './types';
import type { InputActionMap, InputActionSpec } from './types';

export type Platform = 'mac' | 'windows' | 'linux' | 'unknown';

/**
 * Detects the current platform from the navigator object.
 * Returns 'unknown' in SSR or when navigator is unavailable.
 */
export function detectPlatform(): Platform {
  if (typeof navigator === 'undefined') return 'unknown';
  const ua = navigator.userAgent ?? '';
  const platform = (navigator as { userAgentData?: { platform?: string } }).userAgentData?.platform
    ?? navigator.platform ?? '';
  if (/mac/i.test(platform)) return 'mac';
  if (/win/i.test(platform) || /win/i.test(ua)) return 'windows';
  if (/linux/i.test(platform) || /linux/i.test(ua)) return 'linux';
  return 'unknown';
}

/** Human-readable modifier labels per platform. */
const MODIFIER_LABELS: Record<Platform, Record<ModifierKey, string>> = {
  mac:     { alt: '⌥', ctrl: '⌃', meta: '⌘', shift: '⇧' },
  windows: { alt: 'Alt', ctrl: 'Ctrl', meta: 'Win', shift: 'Shift' },
  linux:   { alt: 'Alt', ctrl: 'Ctrl', meta: 'Super', shift: 'Shift' },
  unknown: { alt: 'Alt', ctrl: 'Ctrl', meta: 'Meta', shift: 'Shift' },
};

/** Human-readable key labels for special keys. */
const KEY_LABELS: Record<string, Record<Platform, string>> = {
  ArrowUp:    { mac: '↑', windows: '↑', linux: '↑', unknown: '↑' },
  ArrowDown:  { mac: '↓', windows: '↓', linux: '↓', unknown: '↓' },
  ArrowLeft:  { mac: '←', windows: '←', linux: '←', unknown: '←' },
  ArrowRight: { mac: '→', windows: '→', linux: '→', unknown: '→' },
  ' ':        { mac: 'Space', windows: 'Space', linux: 'Space', unknown: 'Space' },
  Enter:      { mac: '↩', windows: 'Enter', linux: 'Enter', unknown: 'Enter' },
  Escape:     { mac: 'Esc', windows: 'Esc', linux: 'Esc', unknown: 'Esc' },
  Backspace:  { mac: '⌫', windows: 'Backspace', linux: 'Backspace', unknown: 'Backspace' },
  Delete:     { mac: '⌦', windows: 'Del', linux: 'Del', unknown: 'Del' },
  Tab:        { mac: '⇥', windows: 'Tab', linux: 'Tab', unknown: 'Tab' },
};

/**
 * Formats a single modifier key for the given platform.
 * Example: formatModifier('meta', 'mac') → '⌘'
 */
export function formatModifier(mod: ModifierKey, platform?: Platform): string {
  const p = platform ?? detectPlatform();
  return MODIFIER_LABELS[p][mod];
}

/**
 * Formats a key name for human display.
 * Example: formatKey('ArrowUp', 'mac') → '↑', formatKey('r', 'mac') → 'R'
 */
export function formatKey(key: string, platform?: Platform): string {
  const p = platform ?? detectPlatform();
  const label = KEY_LABELS[key]?.[p];
  if (label) return label;
  // Single character keys are uppercased for display.
  if (key.length === 1) return key.toUpperCase();
  return key;
}

/**
 * Formats a full key combo (modifiers + key) for human display.
 * Example: formatKeyCombo({ key: 'r', modifiers: ['meta'] }, 'mac') → '⌘R'
 */
export function formatKeyCombo(
  combo: { key: string; modifiers?: ModifierKey[] },
  platform?: Platform,
): string {
  const p = platform ?? detectPlatform();
  const modParts = (combo.modifiers ?? []).map((m) => formatModifier(m, p));
  const keyPart = formatKey(combo.key, p);
  // Mac uses no separator between modifiers and key; others use '+'.
  const separator = p === 'mac' ? '' : '+';
  return [...modParts, keyPart].join(separator);
}

/**
 * Formats an InputActionMap for human display.
 * Returns a human-readable string describing the input gesture.
 *
 * Examples:
 *   { kind: 'key', key: 'ArrowDown' } → '↓'
 *   { kind: 'pointer', event: 'drag', button: 'left' } → 'Left Drag'
 *   { kind: 'pinch', direction: 'both' } → 'Pinch'
 *   { kind: 'wheel' } → 'Scroll'
 */
export function formatInputMap(map: InputActionMap, platform?: Platform): string {
  const p = platform ?? detectPlatform();
  const modPrefix = ('modifiers' in map && map.modifiers && map.modifiers.length > 0)
    ? map.modifiers.map((m) => formatModifier(m, p)).join(p === 'mac' ? '' : '+') + (p === 'mac' ? '' : '+')
    : '';

  switch (map.kind) {
    case 'key':
      return modPrefix + formatKey(map.key, p);
    case 'pointer': {
      const button = map.button ?? 'left';
      const buttonLabel = button === 'left' ? 'Left' : button === 'middle' ? 'Middle' : 'Right';
      const event = map.event === 'drag' ? 'Drag' : 'Click';
      return modPrefix + `${buttonLabel} ${event}`;
    }
    case 'wheel':
      return modPrefix + 'Scroll';
    case 'pinch':
      return modPrefix + 'Pinch';
  }
}
```

**Test file:** `packages/core/src/input/__tests__/platformKeys.test.ts`

Tests:
- `detectPlatform()` returns 'unknown' when navigator is undefined.
- `formatModifier('meta', 'mac')` → `'⌘'`.
- `formatModifier('ctrl', 'windows')` → `'Ctrl'`.
- `formatKey('ArrowUp', 'mac')` → `'↑'`.
- `formatKey('r', 'mac')` → `'R'`.
- `formatKeyCombo({ key: 'r', modifiers: ['meta'] }, 'mac')` → `'⌘R'`.
- `formatKeyCombo({ key: 'r', modifiers: ['ctrl'] }, 'windows')` → `'Ctrl+R'`.
- `formatInputMap` for each kind: key, pointer drag, pointer click, wheel, pinch.
- Mac uses no separator; Windows/Linux use `+`.

---

### 2.3 `packages/core/src/input/transitionAnimator.ts` (NEW)

**Single responsibility:** Pure functions for computing programmatic navigation transition progress.

The `TransitionAnimator` is **not a class** — it is a set of pure functions that operate on a `TransitionAnimatorState` ref owned by `useSceneEngine`. This keeps the animation math testable without React.

```typescript
// transitionAnimator.ts — Pure functions for programmatic scene-transition animation.

/**
 * Easing function type.
 * Accepts t ∈ [0, 1], returns eased value ∈ [0, 1].
 */
export type TransitionEasing = (t: number) => number;

/** Built-in easing: cubic ease-in-out. */
export function easeInOut(t: number): number {
  return t < 0.5
    ? 4 * t * t * t
    : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/** Built-in easing: linear (identity). */
export function easeLinear(t: number): number {
  return t;
}

/**
 * Mutable state for a single in-flight transition.
 * Owned by the engine layer (useSceneEngine) via a React ref.
 * TransitionAnimator functions read and write this state.
 */
export type TransitionAnimatorState = {
  /** True when a transition animation is actively running. */
  active: boolean;
  /** Engine progress at transition start. */
  fromProgress: number;
  /** Engine progress at transition end. */
  toProgress: number;
  /** Wall-clock timestamp (ms) when the transition started. */
  startTime: number;
  /** Duration in ms. */
  durationMs: number;
  /** Easing function. */
  easing: TransitionEasing;
};

/** Default transition duration in milliseconds. */
export const DEFAULT_TRANSITION_DURATION_MS = 400;

/** Default transition easing function. */
export const DEFAULT_TRANSITION_EASING: TransitionEasing = easeInOut;

/**
 * Creates an initial (inactive) TransitionAnimatorState.
 */
export function createTransitionAnimatorState(): TransitionAnimatorState {
  return {
    active: false,
    fromProgress: 0,
    toProgress: 0,
    startTime: 0,
    durationMs: DEFAULT_TRANSITION_DURATION_MS,
    easing: DEFAULT_TRANSITION_EASING,
  };
}

/**
 * Begins a new transition animation.
 * Mutates `state` in place. If a transition is already active, it is interrupted
 * and the new transition starts from the current interpolated progress.
 *
 * @param state — Mutable TransitionAnimatorState ref.
 * @param fromProgress — Current engine progress (used as start).
 * @param toProgress — Target engine progress.
 * @param nowMs — Current wall-clock time (performance.now()).
 * @param durationMs — Transition duration. Uses DEFAULT_TRANSITION_DURATION_MS if omitted.
 * @param easing — Easing function. Uses DEFAULT_TRANSITION_EASING if omitted.
 */
export function beginTransition(
  state: TransitionAnimatorState,
  fromProgress: number,
  toProgress: number,
  nowMs: number,
  durationMs?: number,
  easing?: TransitionEasing,
): void {
  state.active = true;
  state.fromProgress = fromProgress;
  state.toProgress = toProgress;
  state.startTime = nowMs;
  state.durationMs = durationMs ?? DEFAULT_TRANSITION_DURATION_MS;
  state.easing = easing ?? DEFAULT_TRANSITION_EASING;
}

/**
 * Interrupts an active transition.
 * The engine progress stays at whatever value getTransitionProgress() last returned.
 * Mutates `state` in place.
 */
export function interruptTransition(state: TransitionAnimatorState): void {
  state.active = false;
}

/**
 * Redirects an active transition to a new target without restarting the easing curve.
 * If no transition is active, this starts a new transition from `currentProgress`.
 *
 * Use case: User presses ArrowDown twice quickly — the first transition is in-flight,
 * the second redirect extends the target by one more scene boundary.
 *
 * @param state — Mutable TransitionAnimatorState ref.
 * @param currentProgress — Current interpolated progress (from last getTransitionProgress).
 * @param newToProgress — New target progress.
 * @param nowMs — Current wall-clock time.
 * @param durationMs — Duration for the remaining transition. Reuses state.durationMs if omitted.
 * @param easing — Easing for the remaining transition. Reuses state.easing if omitted.
 */
export function redirectTransition(
  state: TransitionAnimatorState,
  currentProgress: number,
  newToProgress: number,
  nowMs: number,
  durationMs?: number,
  easing?: TransitionEasing,
): void {
  state.active = true;
  state.fromProgress = currentProgress;
  state.toProgress = newToProgress;
  state.startTime = nowMs;
  state.durationMs = durationMs ?? state.durationMs;
  state.easing = easing ?? state.easing;
}

/**
 * Evaluates the current transition progress at the given wall-clock time.
 * Returns the interpolated engine progress, or null if no transition is active.
 *
 * When the transition completes (elapsed >= durationMs), this returns toProgress
 * and sets state.active = false.
 *
 * @param state — Mutable TransitionAnimatorState ref.
 * @param nowMs — Current wall-clock time (performance.now()).
 * @returns Interpolated engine progress ∈ [0, 1], or null if inactive.
 */
export function getTransitionProgress(
  state: TransitionAnimatorState,
  nowMs: number,
): number | null {
  if (!state.active) return null;

  const elapsed = nowMs - state.startTime;
  if (elapsed >= state.durationMs) {
    state.active = false;
    return state.toProgress;
  }

  const rawT = elapsed / state.durationMs;
  const easedT = state.easing(rawT);
  return state.fromProgress + (state.toProgress - state.fromProgress) * easedT;
}
```

**Test file:** `packages/core/src/input/__tests__/transitionAnimator.test.ts`

Tests:
- `createTransitionAnimatorState()` returns inactive state with correct defaults.
- `beginTransition` + `getTransitionProgress` at t=0 returns `fromProgress`.
- `beginTransition` + `getTransitionProgress` at t=durationMs returns `toProgress` and sets `active = false`.
- `getTransitionProgress` at t=durationMs/2 with `easeLinear` returns midpoint.
- `getTransitionProgress` with `easeInOut` returns non-linear midpoint.
- `interruptTransition` makes `getTransitionProgress` return null.
- `redirectTransition` changes target without restarting from original fromProgress.
- `beginTransition` while active (interrupt + restart) uses currentProgress as fromProgress.
- `getTransitionProgress` when inactive returns null.

---

## 3. Stream B — Input Type & ActionInputController Changes

### 3.1 `packages/core/src/input/types.ts`

**Changes:**

1. **Rename `InputActionType` members:**
   - `'camera.dolly'` → `'camera.zoom'`
   - `'canvas.pan'` → `'camera.pan'`

2. **Move `ActionInputHandler` type from `ActionInputController.ts` to `types.ts`.**

3. **Add `onCameraPan` and `onCameraZoom` to `ActionInputHandler`; remove `onCameraDolly`.**

Updated `InputActionType`:

```typescript
export type InputActionType =
  | 'camera.orbit'
  | 'camera.zoom'      // was 'camera.dolly'
  | 'camera.pan'       // was 'canvas.pan'
  | 'camera.reset'
  | 'scene.next'
  | 'scene.prev'
  | 'carousel.next'
  | 'carousel.prev'
  | (string & {}); // open union — allows downstream extension
```

New `ActionInputHandler` type (moved from `ActionInputController.ts`):

```typescript
/**
 * Handler interface dispatched by ActionInputController.
 * Implemented by InputCoordinator (or equivalent player-layer coordinator).
 */
export type ActionInputHandler = {
  getSceneCount: () => number;
  onSceneStep: (direction: 1 | -1, stepScenes: number) => void;
  onCameraOrbit: (cameraId: string, dx: number, dy: number, speed: number) => void;
  /** Renamed from onCameraDolly. Applies zoom delta to the target camera. */
  onCameraZoom: (cameraId: string, delta: number, speed: number) => void;
  /** New. Applies pan delta to the target camera, using camera.up for correct axis. */
  onCameraPan: (cameraId: string, dx: number, dy: number, speed: number) => void;
  onCameraReset: (cameraId: string) => void;
  onCarouselStep: (layoutId: string, direction: 1 | -1, stepSlides: number) => void;
  onUnknownAction?: (
    type: string,
    canvasId: string | undefined,
    event: PointerEvent | WheelEvent | KeyboardEvent | MouseEvent,
    extra: Record<string, unknown>,
  ) => void;
};
```

### 3.2 `packages/core/src/input/ActionInputController.ts`

**Changes:**

1. **Remove `ActionInputHandler` type definition** (moved to `types.ts`). Import it instead.

2. **Rename all `'camera.dolly'` string literals to `'camera.zoom'`** in `dispatchPinch`, `dispatchDrag`, `dispatchWheel`.

3. **Rename `onCameraDolly` calls to `onCameraZoom`** in `dispatchPinch`, `dispatchDrag`, `dispatchWheel`.

4. **Add `'camera.pan'` dispatch** in `dispatchDrag` and `dispatchWheel`:

   ```typescript
   case 'camera.pan':
     this.handler.onCameraPan(this.resolveCameraId(action), filtered.dx, filtered.dy, speed);
     return;
   ```

   This goes in both `dispatchDrag` and `dispatchWheel` switch statements, before the `default` case.

5. **Rename `'canvas.pan'` → `'camera.pan'`** in case statements (there are currently no explicit `'canvas.pan'` cases, so this is just ensuring the string literal used in dispatch is `'camera.pan'`).

6. **Add `onActionFired` subscription API:**

   ```typescript
   /**
    * Callback signature for action-fired events.
    * Invoked synchronously after every action dispatch.
    */
   export type ActionFiredListener = (
     actionType: string,
     actionId: string,
     detail: ActionFiredDetail,
   ) => void;

   export type ActionFiredDetail = {
     cameraId?: string;
     canvasId?: string;
     layoutId?: string;
     direction?: 1 | -1;
     dx?: number;
     dy?: number;
     delta?: number;
     speed?: number;
   };
   ```

   Add to `ActionInputController`:

   ```typescript
   private readonly actionFiredListeners: ActionFiredListener[] = [];

   /** Subscribe to all dispatched actions. Returns an unsubscribe function. */
   onActionFired(listener: ActionFiredListener): () => void {
     this.actionFiredListeners.push(listener);
     return () => {
       const idx = this.actionFiredListeners.indexOf(listener);
       if (idx >= 0) this.actionFiredListeners.splice(idx, 1);
     };
   }

   private fireActionEvent(
     actionType: string,
     actionId: string,
     detail: ActionFiredDetail,
   ): void {
     for (const listener of this.actionFiredListeners) {
       listener(actionType, actionId, detail);
     }
   }
   ```

   Then add `this.fireActionEvent(...)` calls at the end of every dispatch method (`dispatchDrag`, `dispatchWheel`, `dispatchKey`, `dispatchClick`, `dispatchPinch`, `dispatchCarousel`).

   Example for `dispatchCarousel`:
   ```typescript
   private dispatchCarousel(action: InputActionSpec): void {
     if (!action.layoutId) { /* existing warn */ return; }
     const direction: 1 | -1 = action.type === 'carousel.next' ? 1 : -1;
     this.handler.onCarouselStep(action.layoutId, direction, this.actionStepSlides(action));
     this.fireActionEvent(action.type, action.id, {
       layoutId: action.layoutId,
       direction,
     });
   }
   ```

7. **Clear listeners on `detach()`:**

   ```typescript
   detach(): void {
     // ... existing cleanup ...
     this.actionFiredListeners.length = 0;
   }
   ```

### 3.3 `packages/core/src/input/index.ts`

**Changes:**

1. Add exports for new types: `ActionInputHandler`, `ActionFiredListener`, `ActionFiredDetail`.
2. Verify existing exports still work after `ActionInputHandler` moves from `ActionInputController.ts` to `types.ts`.

**Test file:** `packages/core/src/input/__tests__/ActionInputController.test.ts`

Tests for Stream B changes:
- `camera.zoom` action dispatches `onCameraZoom` (not `onCameraDolly`).
- `camera.pan` action dispatches `onCameraPan` with correct dx/dy.
- `onActionFired` listener receives every dispatched action with correct type, id, and detail.
- `onActionFired` unsubscribe stops delivery.
- `detach()` clears all listeners.
- Pinch dispatches `camera.zoom` (not `camera.dolly`).

---

## 4. Stream C — IGroupOwner Removal & IViewChild Introduction

### 4.1 `packages/core/src/widget/types.ts`

**Changes:**

1. **Delete `IGroupOwner` interface** (lines 272–274).

2. **Add `IViewChild` interface** in its place:

   ```typescript
   /**
    * Widget that accepts view-level opacity from ViewWidget.
    *
    * Implement this when a widget owns 3D content (meshes, sprites, text)
    * that should fade in/out as part of a ViewLayout carousel transition
    * or scene-level opacity animation.
    *
    * ViewWidget calls applyViewOpacity() on every child widget that implements
    * IViewChild. Widgets that do NOT implement IViewChild are not affected by
    * ViewWidget opacity — they remain fully opaque.
    */
   export interface IViewChild extends IWidget {
     /**
      * Applies the view-level opacity to this widget's 3D content.
      * Called by ViewWidget.apply() whenever opacity changes.
      *
      * @param opacity — Value in [0, 1]. 0 = fully transparent, 1 = fully opaque.
      *
      * Implementation notes:
      * - Set material.opacity and material.transparent on all owned meshes/sprites.
      * - Set object.visible = (opacity > 0) on root objects to avoid GPU cost.
      * - Cache the last-applied value to short-circuit when unchanged.
      */
     applyViewOpacity(opacity: number): void;
   }
   ```

### 4.2 `packages/core/src/widget/WidgetRegistry.ts`

**Changes:**

1. **Remove `isGroupOwner` type guard function** and its import of `IGroupOwner`.

2. **Add `isViewChild` type guard function:**

   ```typescript
   import type { IViewChild } from './types';

   /** Type guard: widget implements IViewChild (view-level opacity delegation). */
   export function isViewChild(widget: IWidget): widget is IViewChild {
     return 'applyViewOpacity' in widget && typeof (widget as IViewChild).applyViewOpacity === 'function';
   }
   ```

### 4.3 `packages/core/src/widget/index.ts`

**Changes:**

1. Remove `IGroupOwner` export.
2. Remove `isGroupOwner` export.
3. Add `IViewChild` export.
4. Add `isViewChild` export.

### 4.4 `packages/core/src/elements/view/ViewWidget.ts`

**Complete rewrite.** The new ViewWidget does NOT own a THREE.Group, does NOT reparent children, and does NOT traverse the scene graph for opacity. Instead, it resolves child widgets from the registry and calls `applyViewOpacity()` on those that implement `IViewChild`.

> **Note for implementers:** ViewWidget is instantiated once per View, not once per carousel. A carousel with 3 slides has 3 independent ViewWidget instances, each receiving its own `ViewState.opacity` computed by the layout resolver. `state.opacity` already encodes both scene-transition fade and carousel slide visibility — do not add `activeIndex` handling to ViewWidget's `apply()`. The carousel's `activeIndex` is resolved upstream by `InputCoordinator.onCarouselStep`, which re-runs `resolveLayout()` and patches each View's `ViewState.opacity` via `engine.patchWidgetStates()`. ViewWidget simply delegates whatever `state.opacity` it receives.

```typescript
// ViewWidget — IRenderable<ViewState> that applies delta transforms and opacity
// to child widgets via IViewChild, without reparenting or group ownership.

import * as THREE from 'three';
import type { IRenderable, IViewChild, IWidget, WidgetInitContext, WidgetRenderContext } from '../../widget/types';
import { isViewChild } from '../../widget/WidgetRegistry';
import type { ViewState } from '../../compiler/viewTypes';

/**
 * IRenderable widget for ViewLayout carousel repositioning.
 *
 * Created lazily by corePlugin.reconcileCompiledTrack.
 *
 * Key change from previous implementation: no THREE.Group, no reparenting.
 * Position/scale transforms are applied as deltas to each child widget's
 * root Object3D. Opacity is delegated via IViewChild.applyViewOpacity().
 */
export class ViewWidget implements IRenderable<ViewState> {
  readonly widgetId: string;
  private scene: THREE.Scene | null = null;

  /** Compile-time View center in NVS coords — captured on first apply(). */
  private originalNvsCenter: { x: number; y: number } | null = null;
  /** Compile-time scale — captured on first apply(). */
  private originalScale: number | null = null;
  /** Compile-time Z — captured on first apply(). */
  private originalZ: number | null = null;
  /** Last opacity value — for short-circuiting. */
  private lastAppliedOpacity: number | null = null;

  /** Resolved IViewChild widgets, populated lazily. */
  private viewChildren: IViewChild[] = [];
  private resolvedChildren = false;

  /** Child widget IDs from compiled state. */
  private childWidgetIds: readonly string[] = [];

  /**
   * Callback to look up a child widget by ID.
   * Passed at construction time by corePlugin's reconcileCompiledTrack.
   */
  private readonly resolveChildWidget: (widgetId: string) => IWidget | undefined;

  /**
   * Callback to look up a child widget's root THREE.Object3D for positioning.
   * This is NOT IGroupOwner — it uses the runtime's widget-to-object mapping.
   */
  private readonly resolveChildObject: (widgetId: string) => THREE.Object3D | null;

  /**
   * Per-child original world positions, captured on first apply for delta computation.
   */
  private childOriginalPositions = new Map<string, THREE.Vector3>();

  constructor(
    viewId: string,
    resolveChildWidget: (widgetId: string) => IWidget | undefined,
    resolveChildObject: (widgetId: string) => THREE.Object3D | null,
  ) {
    this.widgetId = viewId;
    this.resolveChildWidget = resolveChildWidget;
    this.resolveChildObject = resolveChildObject;
  }

  initialize({ scene }: WidgetInitContext): void {
    this.scene = scene;
  }

  apply(state: ViewState, ctx: WidgetRenderContext): void {
    // Lazy resolve children on first apply with childWidgetIds.
    if (!this.resolvedChildren && state.childWidgetIds.length > 0) {
      this.childWidgetIds = state.childWidgetIds;
      this.resolveViewChildren();
    }

    // Capture original center, scale, Z on first valid apply.
    if (!this.originalNvsCenter) {
      this.originalNvsCenter = {
        x: state.bounds.x + state.bounds.w / 2,
        y: state.bounds.y + state.bounds.h / 2,
      };
    }
    if (this.originalScale === null) {
      this.originalScale = state.scale;
    }
    if (this.originalZ === null) {
      this.originalZ = state.z;
    }

    const scaleRatio = state.scale / this.originalScale;

    // Compute world-space delta from NVS center shift.
    const newCenterNvs = {
      x: state.bounds.x + state.bounds.w / 2,
      y: state.bounds.y + state.bounds.h / 2,
    };
    const [newCx, newCy] = ctx.coords.toWorld(newCenterNvs.x, newCenterNvs.y, 0);
    const [oldCx, oldCy] = ctx.coords.toWorld(
      this.originalNvsCenter.x,
      this.originalNvsCenter.y,
      0,
    );

    // Apply delta position and scale to each child object.
    const deltaX = newCx - oldCx * scaleRatio;
    const deltaY = newCy - oldCy * scaleRatio;
    const deltaZ = state.z - this.originalZ;

    for (const childId of this.childWidgetIds) {
      const obj = this.resolveChildObject(childId);
      if (!obj) continue;

      // Capture original position on first encounter.
      if (!this.childOriginalPositions.has(childId)) {
        this.childOriginalPositions.set(childId, obj.position.clone());
      }
      const orig = this.childOriginalPositions.get(childId)!;

      obj.position.set(
        orig.x * scaleRatio + deltaX,
        orig.y * scaleRatio + deltaY,
        orig.z + deltaZ,
      );
      obj.scale.set(scaleRatio, scaleRatio, 1);
      obj.visible = state.opacity > 0;
    }

    // Delegate opacity to IViewChild widgets.
    if (state.opacity !== this.lastAppliedOpacity) {
      for (const child of this.viewChildren) {
        child.applyViewOpacity(state.opacity);
      }
      this.lastAppliedOpacity = state.opacity;
    }
  }

  dispose(): void {
    this.scene = null;
    this.viewChildren = [];
    this.resolvedChildren = false;
    this.originalNvsCenter = null;
    this.originalScale = null;
    this.originalZ = null;
    this.lastAppliedOpacity = null;
    this.childOriginalPositions.clear();
  }

  // ── Private ──────────────────────────────────────────────────────────────

  private resolveViewChildren(): void {
    this.viewChildren = [];
    for (const childId of this.childWidgetIds) {
      const widget = this.resolveChildWidget(childId);
      if (widget && isViewChild(widget)) {
        this.viewChildren.push(widget);
      }
    }
    this.resolvedChildren = true;
  }
}
```

**IMPORTANT DESIGN NOTE:** The ViewWidget constructor now takes **two** callbacks:
- `resolveChildWidget: (widgetId: string) => IWidget | undefined` — for IViewChild opacity.
- `resolveChildObject: (widgetId: string) => THREE.Object3D | null` — for position/scale deltas.

The `resolveChildObject` replaces the old `resolveChildRoot` (which used `IGroupOwner.rootGroup`). The implementation in `plugins.ts` must provide a different mechanism for resolving a widget's root Object3D — see §4.5.

### 4.5 `packages/core/src/player/plugins.ts`

**Changes:**

1. **Remove `isGroupOwner` import** (line 12). Replace with `isViewChild` if needed (it's not needed here — ViewWidget imports it directly).

2. **Update `reconcileCompiledTrack`** to construct ViewWidget with the new two-callback signature:

```typescript
reconcileCompiledTrack(registry: WidgetRegistry, track: SceneTrack): void {
  for (const tick of track.ticks) {
    for (const [widgetId, state] of Object.entries(tick.state.widgets)) {
      if (isViewStateLike(state) && !registry.get(widgetId)) {
        const resolveChildWidget = (childId: string) => registry.get(childId);

        const resolveChildObject = (childId: string): THREE.Object3D | null => {
          const child = registry.get(childId);
          if (!child) return null;
          // Use IRenderable's scene graph object if available.
          // The RuntimeDriverImpl stores initialized widget roots in a map
          // keyed by widgetId — we access it via the registry's getWidgetObject() method.
          return registry.getWidgetObject(childId) ?? null;
        };

        const viewWidget = new ViewWidget(widgetId, resolveChildWidget, resolveChildObject);
        registry.register(viewWidget);
      }
    }
  }
},
```

**IMPORTANT:** This requires `WidgetRegistry.getWidgetObject(widgetId)` — a new method that returns the root `THREE.Object3D` for an initialized `IRenderable` widget. This is populated by `RuntimeDriverImpl` during `initialize()`.

**Add to `WidgetRegistry`** (in the same Stream C file ownership):

```typescript
// In WidgetRegistry class body:
private widgetObjects = new Map<string, THREE.Object3D>();

/** Stores the root Object3D created during IRenderable.initialize(). */
setWidgetObject(widgetId: string, obj: THREE.Object3D): void {
  this.widgetObjects.set(widgetId, obj);
}

/** Returns the root Object3D for an initialized IRenderable widget, or undefined. */
getWidgetObject(widgetId: string): THREE.Object3D | undefined {
  return this.widgetObjects.get(widgetId);
}

/** Clears widget object mapping (called during dispose). */
clearWidgetObject(widgetId: string): void {
  this.widgetObjects.delete(widgetId);
}
```

**Note on `RuntimeDriverImpl` integration:** The `RuntimeDriverImpl` must call `registry.setWidgetObject(widgetId, rootObject)` during `IRenderable.initialize()`. However, `RuntimeDriverImpl` lives in `runtime/` which is Stream D territory. To avoid cross-stream conflicts, the `WidgetRegistry` method additions are in Stream C, but the `RuntimeDriverImpl` call site changes are in Stream D. Stream D is blocked on Stream C, so this ordering works.

### 4.6 `packages/screens/src/elements/media-screen/widget.ts`

**Changes:**

1. **Remove `IGroupOwner` implementation.** Remove `readonly rootGroup = new THREE.Group()`.
2. **Add `IViewChild` implementation.** Add `applyViewOpacity(opacity: number): void`.
3. **Update imports:** Remove `IGroupOwner` from `@brewsite/core`, add `IViewChild`.

The widget currently adds its geometry to `this.rootGroup` and the `rootGroup` is added to the scene. After removing IGroupOwner:
- Add geometry directly to the scene (via `scene.add(this.mesh)` in `initialize()`).
- Implement `applyViewOpacity`:

```typescript
applyViewOpacity(opacity: number): void {
  // Apply opacity to all materials on the screen mesh.
  if (this.mesh) {
    this.mesh.visible = opacity > 0;
    const materials = Array.isArray(this.mesh.material)
      ? this.mesh.material
      : [this.mesh.material];
    for (const mat of materials) {
      mat.opacity = opacity;
      mat.transparent = opacity < 1;
    }
  }
  // Apply to bezel, gloss, glow if they exist.
  if (this.bezelMesh) {
    this.bezelMesh.visible = opacity > 0;
    if (this.bezelMesh.material) {
      (this.bezelMesh.material as THREE.Material & { opacity: number; transparent: boolean }).opacity = opacity;
      (this.bezelMesh.material as THREE.Material & { transparent: boolean }).transparent = opacity < 1;
    }
  }
  // ... similar for other owned sub-meshes
}
```

**Test file:** `packages/core/src/elements/view/__tests__/ViewWidget.test.ts`

Tests:
- Construct ViewWidget with mock resolvers.
- `apply()` with opacity 0.5 calls `applyViewOpacity(0.5)` on IViewChild children.
- `apply()` with unchanged opacity does NOT call `applyViewOpacity` again (short-circuit).
- `apply()` correctly computes delta position from NVS center shift.
- `dispose()` clears all internal state.

**Test file:** `packages/core/src/widget/__tests__/WidgetRegistry.test.ts` (extend existing)

Tests:
- `isViewChild` returns true for a widget implementing `applyViewOpacity`.
- `isViewChild` returns false for a widget without `applyViewOpacity`.
- `getWidgetObject` returns stored object after `setWidgetObject`.
- `getWidgetObject` returns undefined for unknown widgetId.

---

## 5. Stream D — Compiler, Engine & InputCoordinator Changes

**Blocked on:** Stream A (imports `createDefaultInputSpec`, `TransitionAnimator`), Stream B (imports updated `ActionInputHandler`, `InputActionType`).

### 5.1 Compiler Changes

#### 5.1.1 `packages/core/src/compiler/sceneTrackTypes.ts`

**Add to `SceneFrame`** (after `progressManager?`):

```typescript
/**
 * Widget ID of the primary carousel ViewLayout for this scene.
 * Set via <Scene primaryCarouselId="..."> DSL prop.
 * Used at runtime to resolve the carousel sentinel '__primary_carousel__'
 * in InputCoordinator.
 */
primaryCarouselId?: string;
```

**Add to `ProgressManagerSpec`** (after `animationTimeScale?`):

```typescript
/**
 * Default transition duration (ms) for programmatic scene navigation
 * (arrow keys, scene.next/prev) within this scene's context.
 * Overrides the engine-level defaultTransitionDuration when set.
 * Undefined = use engine default (400ms).
 */
transitionDuration?: number;

/**
 * Default transition easing for programmatic scene navigation.
 * Overrides the engine-level defaultTransitionEasing when set.
 * Undefined = use engine default (easeInOut).
 */
transitionEasing?: TransitionEasing;
```

**Add to `SceneProgressSegment`** (after `autoAdvance?`):

```typescript
/**
 * Per-scene transition duration override (ms).
 * Read by InputCoordinator to determine animation speed for scene.next/prev.
 */
transitionDuration?: number;

/**
 * Per-scene transition easing override.
 */
transitionEasing?: TransitionEasing;
```

**Add import** at top of file:

```typescript
import type { TransitionEasing } from '../input/transitionAnimator';
```

#### 5.1.2 `packages/core/src/compiler/sceneDslCompiler.ts`

**Add `primaryCarouselId` to Scene props** (in the scene root handler's props type):

```typescript
primaryCarouselId?: string;
```

**Propagate to SceneFrame** in `createSceneRootHandler`:

```typescript
if (props.primaryCarouselId) {
  api.state.primaryCarouselId = props.primaryCarouselId;
}
```

#### 5.1.3 `packages/core/src/compiler/primitives/progressManager.ts`

**Add `transitionDuration` and `transitionEasing` to `ProgressManagerProps`:**

```typescript
transitionDuration?: number;
transitionEasing?: TransitionEasing;
```

**Propagate to `ProgressManagerSpec`** in the handler:

```typescript
if (props.transitionDuration !== undefined) {
  spec.transitionDuration = props.transitionDuration;
}
if (props.transitionEasing !== undefined) {
  spec.transitionEasing = props.transitionEasing;
}
```

#### 5.1.4 `packages/core/src/compiler/sceneTrackCompiler.ts`

**Changes to `buildProgressProfile`:**

When building `SceneProgressSegment[]`, propagate `transitionDuration` and `transitionEasing` from the resolved `ProgressManagerSpec`:

```typescript
// Inside the segment construction loop:
const segment: SceneProgressSegment = {
  sceneIndex: i,
  rawStart,
  rawEnd,
  engineStart,
  engineEnd,
  fn: spec.fn,
  // ... existing autoAdvance ...
  transitionDuration: spec.transitionDuration,
  transitionEasing: spec.transitionEasing,
};
```

**Changes to default input spec injection** (lines ~418–445):

Replace the current hardcoded 2-key-binding default with a call to `createDefaultInputSpec()`:

```typescript
import { createDefaultInputSpec } from '../input/defaultInputSpec';

// In the default input injection section:
// Instead of building a minimal spec inline, use the factory.
// Carousel actions use the sentinel layoutId — no need to scan frames
// for primaryCarouselId at compile time. Resolution happens at runtime
// in InputCoordinator.
const defaultSpec = createDefaultInputSpec({
  cameraId: primaryCameraId,
  canvasId: primaryCanvasActionTargetId,
});
```

### 5.2 SceneEngine & useSceneEngine Changes

#### 5.2.1 `packages/core/src/player/engineTypes.ts`

**No changes needed** beyond what's already there. The `TransitionEasing` type is imported from `transitionAnimator.ts` where needed.

#### 5.2.2 `packages/core/src/player/SceneEngine.tsx`

**Add two new props to `SceneEngineProps`:**

```typescript
/**
 * Default transition duration (ms) for programmatic scene navigation.
 * Used when no per-scene transitionDuration is declared via ProgressManager.
 * Default: 400.
 */
defaultTransitionDuration?: number;

/**
 * Default transition easing for programmatic scene navigation.
 * Used when no per-scene transitionEasing is declared via ProgressManager.
 * Default: easeInOut from transitionAnimator.ts.
 */
defaultTransitionEasing?: TransitionEasing;
```

**Pass to `useSceneEngine`:**

```typescript
const engine = useSceneEngine({
  // ... existing props ...
  defaultTransitionDuration: props.defaultTransitionDuration,
  defaultTransitionEasing: props.defaultTransitionEasing,
});
```

#### 5.2.3 `packages/core/src/player/useSceneEngine.ts`

**Changes:**

1. **Add `TransitionAnimatorState` ref:**

   ```typescript
   import {
     createTransitionAnimatorState,
     beginTransition,
     interruptTransition,
     redirectTransition,
     getTransitionProgress,
     DEFAULT_TRANSITION_DURATION_MS,
     DEFAULT_TRANSITION_EASING,
     type TransitionAnimatorState,
     type TransitionEasing,
   } from '../input/transitionAnimator';

   // Inside useSceneEngine:
   const transitionRef = useRef<TransitionAnimatorState>(createTransitionAnimatorState());
   ```

2. **Add transition API functions** (exposed on the engine object):

   ```typescript
   const handleBeginTransition = useCallback((
     targetProgress: number,
     durationMs?: number,
     easing?: TransitionEasing,
   ) => {
     const currentProgress = progressRef.current;
     beginTransition(
       transitionRef.current,
       currentProgress,
       Math.max(0, Math.min(1, targetProgress)),
       performance.now(),
       durationMs ?? options.defaultTransitionDuration ?? DEFAULT_TRANSITION_DURATION_MS,
       easing ?? options.defaultTransitionEasing ?? DEFAULT_TRANSITION_EASING,
     );
   }, [options.defaultTransitionDuration, options.defaultTransitionEasing]);

   const handleInterruptTransition = useCallback(() => {
     interruptTransition(transitionRef.current);
   }, []);

   const handleRedirectTransition = useCallback((
     newTargetProgress: number,
     durationMs?: number,
     easing?: TransitionEasing,
   ) => {
     const currentProgress = progressRef.current;
     redirectTransition(
       transitionRef.current,
       currentProgress,
       Math.max(0, Math.min(1, newTargetProgress)),
       performance.now(),
       durationMs,
       easing,
     );
   }, []);
   ```

3. **Integrate transition into RAF loop:**

   In the existing RAF callback, before applying the final progress, check if a transition is active:

   ```typescript
   // Inside the RAF tick function:
   const transitionProgress = getTransitionProgress(transitionRef.current, performance.now());
   if (transitionProgress !== null) {
     // Transition overrides inertia/scroll progress.
     setProgressInternal(transitionProgress);
   }
   ```

4. **Rename `applyCameraDolly` to `applyCameraZoom`:**

   Find the existing camera dispatch method that handles dolly and rename it:
   ```typescript
   // was: applyCameraDolly(cameraId, delta, speed)
   // now:
   const applyCameraZoom = useCallback((cameraId: string, delta: number, speed: number) => {
     // ... existing dolly logic (calls cameraWidget.dolly or camera-controls.dolly) ...
   }, [/* deps */]);
   ```

5. **Add `applyCameraPan`:**

   ```typescript
   const applyCameraPan = useCallback((cameraId: string, dx: number, dy: number, speed: number) => {
     const cameraWidget = widgetRegistry.get(cameraId);
     if (!cameraWidget) return;
     // CameraWidget exposes a pan method that uses camera.up for correct axis.
     if ('applyCameraPan' in cameraWidget) {
       (cameraWidget as { applyCameraPan: (dx: number, dy: number, speed: number) => void })
         .applyCameraPan(dx, dy, speed);
     }
   }, [widgetRegistry]);
   ```

6. **Expose on engine return value:**

   ```typescript
   return {
     // ... existing ...
     beginTransition: handleBeginTransition,
     interruptTransition: handleInterruptTransition,
     redirectTransition: handleRedirectTransition,
   };
   ```

### 5.3 InputCoordinator Changes

#### `packages/core/src/player/InputCoordinator.tsx`

This is the largest change in Stream D. The InputCoordinator must:

1. **Update `ActionInputHandler` references** to use the renamed methods (`onCameraZoom` instead of `onCameraDolly`, add `onCameraPan`).

2. **Add X-inertia accumulator** for horizontal scroll → carousel.

3. **Add axis arbitration** (`InertiaAxisLock`).

4. **Resolve carousel sentinel** `'__primary_carousel__'`.

5. **Wire transition API** for programmatic scene navigation.

#### 5.3.1 Axis Arbitration

```typescript
/**
 * Shared axis lock between X-inertia (carousel) and Y-inertia (scene scroll).
 * Only one axis accumulates at a time. The lock is chosen by the first
 * significant wheel delta after idle, and held until both axes go idle.
 */
type InertiaAxisLock = 'x' | 'y' | null;
```

State:
```typescript
const axisLockRef = useRef<InertiaAxisLock>(null);
const xInertiaVelocityRef = useRef(0);
const xInertiaDeltaRef = useRef(0);
const AXIS_LOCK_THRESHOLD = 4; // px delta to choose axis
const AXIS_LOCK_IDLE_MS = 200; // ms of no wheel events to release lock
const lastWheelTimestampRef = useRef(0);
```

In the `onUnclaimedWheel` handler (the callback passed to `ActionInputController` as `onUnclaimedWheel`):

```typescript
const onUnclaimedWheel = useCallback((e: WheelEvent) => {
  const now = Date.now();
  const idleSinceLastWheel = now - lastWheelTimestampRef.current > AXIS_LOCK_IDLE_MS;
  lastWheelTimestampRef.current = now;

  // Release axis lock after idle period.
  if (idleSinceLastWheel) {
    axisLockRef.current = null;
  }

  // Choose axis on first significant delta.
  if (axisLockRef.current === null) {
    if (Math.abs(e.deltaX) > AXIS_LOCK_THRESHOLD || Math.abs(e.deltaY) > AXIS_LOCK_THRESHOLD) {
      axisLockRef.current = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? 'x' : 'y';
    }
  }

  if (axisLockRef.current === 'y') {
    // Existing Y-inertia path (scene scroll).
    // IMPORTANT: If a programmatic transition is active, interrupt it immediately.
    // This prevents a tug-of-war where the transition reasserts progress each tick.
    if (transitionRef.current.active) {
      engine.interruptTransition();
    }
    yInertiaDeltaRef.current += e.deltaY;
  } else if (axisLockRef.current === 'x') {
    // X-inertia path (carousel scroll).
    // X-scroll does NOT interrupt Y-axis transitions — they are orthogonal.
    xInertiaDeltaRef.current += e.deltaX;
  }
  // If still null (below threshold), discard.
}, []);
```

#### 5.3.2 X-Inertia Tick

In the RAF loop, after the existing Y-inertia `computeInertiaStep` call:

```typescript
// X-inertia for carousel
if (xInertiaDeltaRef.current !== 0 || xInertiaVelocityRef.current !== 0) {
  const xResult = computeInertiaStep(
    xInertiaVelocityRef.current,
    xInertiaDeltaRef.current,
    CAROUSEL_INERTIA_SENSITIVITY,  // tuning constant, e.g. 0.0003
    CAROUSEL_INERTIA_DECAY,        // tuning constant, e.g. 0.92
    0, // carousel doesn't use progress clamping — threshold-based step instead
  );
  xInertiaDeltaRef.current = 0;
  xInertiaVelocityRef.current = xResult.velocity;

  // Accumulate position. When it crosses a threshold, fire carousel step.
  xInertiaAccumulatorRef.current += xResult.velocity;
  const CAROUSEL_STEP_THRESHOLD = 0.015; // tuning constant
  if (Math.abs(xInertiaAccumulatorRef.current) >= CAROUSEL_STEP_THRESHOLD) {
    const direction: 1 | -1 = xInertiaAccumulatorRef.current > 0 ? 1 : -1;
    const carouselId = resolvePrimaryCarouselId();
    if (carouselId) {
      engine.onCarouselStep(carouselId, direction, 1);
    }
    xInertiaAccumulatorRef.current = 0;
  }
}
```

#### 5.3.3 Carousel Sentinel Resolution

```typescript
import { PRIMARY_CAROUSEL_SENTINEL } from '../input/defaultInputSpec';

function resolvePrimaryCarouselId(): string | null {
  // Read from current tick's SceneFrame state.
  const tick = engine.getCurrentTick();
  if (!tick) return null;
  // primaryCarouselId is stored on SceneFrame, which is on SceneTrackTick.
  return tick.state.primaryCarouselId ?? null;
}

// In the ActionInputHandler.onCarouselStep:
onCarouselStep: (layoutId, direction, stepSlides) => {
  const resolvedId = layoutId === PRIMARY_CAROUSEL_SENTINEL
    ? resolvePrimaryCarouselId()
    : layoutId;
  if (!resolvedId) {
    console.warn('[InputCoordinator] Cannot resolve carousel sentinel — no primaryCarouselId on current scene.');
    return;
  }
  engine.onCarouselStep(resolvedId, direction, stepSlides);
},
```

#### 5.3.4 Programmatic Scene Navigation via Transition

Replace the current immediate-progress-set in `onSceneStep` with transition-based navigation:

```typescript
onSceneStep: (direction, stepScenes) => {
  // Cancel any active inertia — programmatic navigation takes over.
  yInertiaVelocityRef.current = 0;
  yInertiaDeltaRef.current = 0;

  const currentSceneIndex = engine.getCurrentSceneIndex();
  const targetSceneIndex = Math.max(
    0,
    Math.min(engine.getSceneCount() - 1, currentSceneIndex + direction * stepScenes),
  );
  if (targetSceneIndex === currentSceneIndex) return;

  // Compute target progress from the scene track's progress profile.
  const targetProgress = engine.getSceneStartProgress(targetSceneIndex);

  // Read per-scene transition overrides from the progress profile.
  const segment = engine.getProgressSegment(currentSceneIndex);
  const durationMs = segment?.transitionDuration ?? undefined;
  const easing = segment?.transitionEasing ?? undefined;

  // If a transition is already active (e.g. rapid arrow key presses),
  // redirect to the new target from the current animated position.
  // This avoids jarring reversal — the easing curve continues smoothly.
  // If no transition is active, begin a fresh transition.
  if (transitionRef.current.active) {
    engine.redirectTransition(targetProgress, durationMs, easing);
  } else {
    engine.beginTransition(targetProgress, durationMs, easing);
  }
},
```

### 5.4 Player Exports

#### `packages/core/src/player/index.ts`

Add exports:
```typescript
export type { TransitionEasing } from '../input/transitionAnimator';
```

### 5.5 Compiler DSL Exports

#### `packages/core/src/compiler/index.ts`

**No changes.** The `primaryCarouselId` prop is added to the Scene component handler via `sceneDslCompiler.ts` — it's a pass-through prop, not a new DSL component.

---

## 6. Stream E — InputHud Foundation (Deferred Rendering)

The InputHud component is deferred to a future release per the PRD (§7.9). This stream only establishes the **data model and event plumbing**, not the rendered component.

### 6.1 `packages/core/src/hud/inputHudTypes.ts` (NEW)

```typescript
// inputHudTypes.ts — Data model for the InputHud overlay (deferred rendering).

import type { InputActionMap, InputActionSpec } from '../input/types';

/**
 * One displayable action hint in the InputHud.
 * Describes what the user can do and how to trigger it.
 */
export type InputHudHint = {
  /** Action ID from InputActionSpec. */
  actionId: string;
  /** Human-readable action type. */
  actionType: string;
  /** Human-readable input trigger descriptions (one per map). */
  triggers: string[];
  /** The original maps, for custom rendering. */
  maps: InputActionMap[];
};

/**
 * Full InputHud state for one frame.
 * Built from the current SceneInputControllerSpec + platform detection.
 */
export type InputHudState = {
  /** All action hints, sorted by action type for stable ordering. */
  hints: InputHudHint[];
  /** Detected platform (for key label rendering). */
  platform: 'mac' | 'windows' | 'linux' | 'unknown';
};
```

### 6.2 `packages/core/src/hud/InputHud.tsx` (NEW — stub)

```typescript
// InputHud.tsx — Deferred InputHud component. Stub for future rendering.
// This file establishes the component contract. Rendering is not implemented yet.

import type { InputHudState } from './inputHudTypes';

export type InputHudProps = {
  state: InputHudState;
  visible?: boolean;
};

/**
 * InputHud — Renders an overlay showing available input actions.
 *
 * DEFERRED: This component returns null. It is a placeholder for future
 * implementation. The data model (InputHudState) and event plumbing
 * (onActionFired from ActionInputController) are implemented in this release.
 */
export const InputHud = (_props: InputHudProps): null => {
  return null;
};
```

**Test file:** `packages/core/src/hud/__tests__/inputHudTypes.test.ts`

Tests:
- Type-level tests: verify `InputHudHint` and `InputHudState` compile correctly with expected shapes.
- Build an `InputHudState` from a `createDefaultInputSpec()` result using `formatInputMap()` — verify all actions produce non-empty trigger strings.

---

## 7. Stream F — apps/examples Migration

**Blocked on:** All other streams.

### 7.1 Changes Required

1. **Replace all `'camera.dolly'` string literals with `'camera.zoom'`** in scene files.
2. **Replace all `'canvas.pan'` string literals with `'camera.pan'`** in scene files.
3. **Replace `onCameraDolly` handler references with `onCameraZoom`** in any custom handlers.
4. **Remove any `IGroupOwner` imports/implementations** from custom widgets.
5. **Add `IViewChild` implementations** to any custom widgets that were using `IGroupOwner` for carousel opacity.
6. **Test all example scenes** to verify rendering, carousel, camera, and navigation still work.

### 7.2 File List

Search for affected files:

```bash
pnpm --filter @brewsite/examples grep -r "camera.dolly\|canvas.pan\|IGroupOwner\|isGroupOwner\|onCameraDolly"
```

Expected files:
- `apps/examples/src/core-showcase/widgetSetup.ts`
- `apps/examples/src/diagram/widgetSetup.ts`
- Any custom widget files in `apps/examples/src/widgets/`

Each file gets the mechanical string replacements listed above.

---

## 8. Breaking Changes Summary

| Change | Migration |
|--------|-----------|
| `'camera.dolly'` → `'camera.zoom'` in `InputActionType` | Find-and-replace in DSL `<Action type="camera.dolly">` → `<Action type="camera.zoom">` |
| `'canvas.pan'` → `'camera.pan'` in `InputActionType` | Find-and-replace in DSL `<Action type="canvas.pan">` → `<Action type="camera.pan">` |
| `ActionInputHandler.onCameraDolly` → `onCameraZoom` | Rename in handler implementations |
| `ActionInputHandler.onCameraPan` added (required) | Implement in all handler implementations |
| `IGroupOwner` interface removed | Replace with `IViewChild` |
| `isGroupOwner()` type guard removed | Replace with `isViewChild()` |
| `ViewWidget` constructor signature changed | Only affects `corePlugin` internals — not a public API |

---

## 9. Test Strategy

### Stream A Tests

| Module | Test File | Strategy |
|--------|-----------|----------|
| `defaultInputSpec.ts` | `input/__tests__/defaultInputSpec.test.ts` | Pure function: call with various options, assert returned spec shape |
| `platformKeys.ts` | `input/__tests__/platformKeys.test.ts` | Pure function: pass explicit platform, assert formatted strings |
| `transitionAnimator.ts` | `input/__tests__/transitionAnimator.test.ts` | Pure state machine: create state, call begin/get/interrupt/redirect, assert progress values |

### Stream B Tests

| Module | Test File | Strategy |
|--------|-----------|----------|
| `ActionInputController` | `input/__tests__/ActionInputController.test.ts` | Extend existing tests: verify renamed dispatch, new `camera.pan` dispatch, `onActionFired` subscription |

### Stream C Tests

| Module | Test File | Strategy |
|--------|-----------|----------|
| `ViewWidget` | `elements/view/__tests__/ViewWidget.test.ts` | Construct with mock resolvers, call apply(), verify `applyViewOpacity` called on IViewChild children |
| `WidgetRegistry` | `widget/__tests__/WidgetRegistry.test.ts` | Test `isViewChild`, `getWidgetObject`/`setWidgetObject`/`clearWidgetObject` |

### Stream D Tests

| Module | Test File | Strategy |
|--------|-----------|----------|
| `sceneTrackCompiler` default spec | `compiler/__tests__/sceneTrackCompiler.test.ts` | Compile a scene with no InputController → verify default spec matches `createDefaultInputSpec()` output |
| `sceneDslCompiler` primaryCarouselId | `compiler/__tests__/sceneDslCompiler.test.ts` | Compile `<Scene primaryCarouselId="carousel-1">` → verify `frame.primaryCarouselId === 'carousel-1'` |
| `ProgressManager` transitionDuration | `compiler/__tests__/progressManager.test.ts` | Compile `<ProgressManager transitionDuration={600}>` → verify spec.transitionDuration === 600 |
| `InputCoordinator` X-inertia | `player/__tests__/InputCoordinator.test.tsx` | Simulate wheel events with deltaX, verify carousel step fires after threshold crossed |
| `InputCoordinator` axis arbitration | `player/__tests__/InputCoordinator.test.tsx` | Simulate mixed deltaX/deltaY wheel events, verify only one axis accumulates at a time (sticky lock) |
| `InputCoordinator` axis lock release | `player/__tests__/InputCoordinator.test.tsx` | Simulate wheel idle > 200ms, verify axis lock resets and next wheel chooses fresh axis |
| `InputCoordinator` carousel sentinel | `player/__tests__/InputCoordinator.test.tsx` | Set `primaryCarouselId` on scene frame, fire carousel action with sentinel layoutId, verify resolved to actual ID |
| `InputCoordinator` carousel sentinel missing | `player/__tests__/InputCoordinator.test.tsx` | Fire carousel action with sentinel when no `primaryCarouselId` set, verify console.warn and no crash |
| `InputCoordinator` scroll-Y interrupts transition | `player/__tests__/InputCoordinator.test.tsx` | Begin transition via `onSceneStep`, simulate Y-axis wheel event, verify `interruptTransition()` called and transition.active becomes false |
| `InputCoordinator` scroll-X does NOT interrupt transition | `player/__tests__/InputCoordinator.test.tsx` | Begin transition via `onSceneStep`, simulate X-axis wheel event, verify transition remains active |
| `InputCoordinator` onSceneStep beginTransition | `player/__tests__/InputCoordinator.test.tsx` | Call `onSceneStep(1, 1)` from idle, verify `beginTransition` called with correct target progress |
| `InputCoordinator` onSceneStep redirectTransition | `player/__tests__/InputCoordinator.test.tsx` | Call `onSceneStep(1, 1)` while transition is active, verify `redirectTransition` called (not interrupt+begin) |

### Stream E Tests

| Module | Test File | Strategy |
|--------|-----------|----------|
| `inputHudTypes` | `hud/__tests__/inputHudTypes.test.ts` | Type-level compilation test + build InputHudState from real default spec |

### All Streams

Run after all streams merge:
```bash
pnpm typecheck        # Full monorepo type check
pnpm test             # Full test suite
pnpm build            # Full build
```

---

## 10. Dependency Graph

```
Stream A (pure functions)     ──┐
                                ├──→ Stream D (compiler + engine + coordinator)
Stream B (input types)        ──┤                                              ──→ Stream F (examples)
                                ├──→ Stream E (InputHud foundation)             ──┘
Stream C (widget + view)      ──┘
```

- **A, B, C** are fully independent and can be implemented in parallel.
- **D** depends on A + B (imports new types and functions). Also depends on C for `getWidgetObject` on WidgetRegistry.
- **E** depends on B (imports `ActionFiredListener` type).
- **F** depends on all streams (uses the final API surface).

---

## Appendix A: CameraWidget.applyCameraPan Design

The CameraWidget must expose an `applyCameraPan(dx, dy, speed)` method. This method must use `camera.up` (not hardcoded world-Y) to compute the correct pan direction. Implementation:

```typescript
// In CameraWidget (packages/core/src/elements/camera/CameraWidget.ts):

applyCameraPan(dx: number, dy: number, speed: number): void {
  if (!this.controls) return;
  // camera-controls provides truck(dx, dy, enableTransition) which pans
  // along the camera's local X and Y axes (respecting camera.up).
  const scaledDx = dx * speed * 0.002; // tuning factor
  const scaledDy = dy * speed * 0.002;
  this.controls.truck(scaledDx, scaledDy, false);
}
```

This is a **Stream D** addition since it touches `CameraWidget.ts` which is in the player/elements layer. Stream D owns all player-layer changes.

---

## Appendix B: RuntimeDriverImpl Changes (Stream D)

The `RuntimeDriverImpl` must call `registry.setWidgetObject()` when initializing `IRenderable` widgets:

```typescript
// In RuntimeDriverImpl.initializeWidgets() or equivalent:
for (const widget of renderableWidgets) {
  // After calling widget.initialize({ scene }):
  // The widget's root object is typically the first child added to the scene
  // during initialize(). For widgets that add directly to the scene, we need
  // a different approach.
  //
  // DESIGN DECISION: Each IRenderable widget that needs to participate in
  // ViewWidget positioning should expose its root Object3D. This is done via
  // a new optional `getRootObject(): THREE.Object3D | null` method on IRenderable,
  // OR by convention where the widget stores its root in a known field.
  //
  // For this release, we use duck-typing: if the widget has a `rootObject`
  // property, we store it. This avoids changing the IRenderable interface.
  if ('rootObject' in widget && widget.rootObject instanceof THREE.Object3D) {
    registry.setWidgetObject(widget.widgetId, widget.rootObject);
  }
}
```

**Alternative (simpler):** Since the only consumer of `getWidgetObject` is ViewWidget, and ViewWidget only needs it for position/scale deltas, we can have each widget that participates in Views expose a `rootObject` readonly property. This is a lighter-weight contract than a full interface method.

Widgets that need this:
- `MediaScreenWidget` (packages/screens) — already has geometry it adds to scene; expose it as `rootObject`.
- Any future diagram/chart widget used inside ViewLayout.

---

## Appendix C: SceneTrackTick State Extension

The `SceneTrackTick.state` object (type `SceneFrame`) already has the `primaryCarouselId` field after §5.1.1. The InputCoordinator reads it via `engine.getCurrentTick().state.primaryCarouselId`. No additional runtime data structures are needed.

However, `SceneTrackTick` does not directly embed `SceneFrame` — it has its own `state` shape. Verify that `primaryCarouselId` propagates through the tick baking pass in `sceneTrackCompiler.ts`. The baking pass copies `SceneFrame` fields into `SceneTrackTick.state` — confirm that `primaryCarouselId` is included in the copy.

If the baking pass uses spread (`{ ...frame }`), it will automatically include the new field. If it cherry-picks fields, add `primaryCarouselId` to the pick list.

---

## Appendix D: ViewWidget Opacity — Option A Feasibility Confirmation

This appendix answers the three questions raised in §12 OQ #1 of the feature note and by PM-2 during plan debate.

### D.1 Option A is feasible. Option B is categorically ruled out.

**Why Option B fails:** Option B composes opacity at compile time via `composeOpacity()` in `childApi.ts`. Carousel slide visibility depends on `activeIndex`, which changes at runtime when the user swipes. Compile-time data cannot encode runtime gesture state. There is no design path for Option B.

**Option A works because:**
- `ViewState.opacity` is already computed per-scene by the compiler (see `viewHandlers.ts` line 154). For scene transitions, the `FunctionalTransitionSpec` interpolates `ViewState.opacity` from 1→0 (exit) and 0→1 (enter). For carousel layouts, the compiler sets `opacity` based on distance from `activeIndex` (active slide = 1.0, inactive = `fadeMin` or 0).
- At runtime, when `onCarouselStep` fires, the **existing runtime state-patching mechanism** handles it (see §D.6 below). No new runtime infrastructure is needed.

### D.2 `ViewState` type — no extension needed

The existing `ViewState` type (in `compiler/viewTypes.ts`) already has everything needed:

```typescript
export type ViewState = {
  readonly id: string;
  readonly bounds: NVSRect;
  readonly padding: NormalizedPadding;
  readonly contentBounds: NVSRect;
  readonly layer: number;
  readonly scale: number;
  readonly z: number;
  readonly opacity: number;         // ← scene-transition AND carousel opacity
  readonly layoutId?: string;
  readonly childWidgetIds: readonly string[];  // ← already populated by compiler
};
```

- **`opacity`** already encodes both scene-transition fade and carousel slide visibility. The compiler computes it from `composeOpacity(viewOpacity)` where `viewOpacity` comes from the layout resolver (active slide = 1.0, inactive = fadeMin). During scene transitions, the `FunctionalTransitionSpec` for ViewWidget interpolates the full `ViewState` including `opacity`.
- **`childWidgetIds`** is already populated by the compiler. See D.3 below.
- **`activeIndex`** does NOT need to be on `ViewState`. It lives on `ViewLayoutState.layoutConfig` (type `ViewLayoutConfig`). The layout resolver reads it and computes per-view opacity/scale/z. ViewWidget only needs the resolved values.

### D.3 Compiler-based `childWidgetIds` population — already implemented

The compiler already resolves `ViewLayout` → child element ID relationships. Here is the existing pipeline:

1. **`viewHandlers.ts:viewHandler`** (the View NodeHandler) creates a scoped child API via `createChildApi()` from `compiler/childApi.ts`.
2. **`createChildApi()`** overrides `setWidgetState()` to push each child widget ID into `childWidgetIds: string[]` as the child DSL nodes are compiled.
3. After `helpers.compileChildren(node, childApi)` returns, the handler reads `childApi.childWidgetIds` and stores it on `ViewState`:
   ```typescript
   const viewState: ViewState = {
     id,
     bounds: composedBounds,
     padding,
     contentBounds,
     layer,
     scale,
     z: zOffset,
     opacity: viewOpacity,
     layoutId,
     childWidgetIds: childApi.childWidgetIds,  // ← populated during child compilation
   };
   api.setWidgetState(id, viewState);
   ```
4. **No lazy registration issues.** Widget IDs are assigned by the DSL author (via `id` prop) or generated deterministically by the widget constructor. The compiler processes the full DSL tree synchronously — all child widgets are compiled before the parent View handler reads `childWidgetIds`. There are no ordering dependencies.

**Conclusion:** OQ #1 is resolved. The compiler already populates `childWidgetIds` correctly. No new compiler work is needed for this.

### D.4 Opacity delegation mechanism — ViewWidget calls IViewChild directly

ViewWidget does **NOT** use `engine.applyWidgetOpacity()` or any new `RuntimeDriver` method. Instead:

1. ViewWidget resolves child widgets from the registry via `resolveChildWidget(childId)` callback (provided at construction by `corePlugin.reconcileCompiledTrack`).
2. It checks `isViewChild(widget)` for each child.
3. It calls `widget.applyViewOpacity(state.opacity)` directly on each IViewChild.

This keeps the opacity delegation **widget-to-widget** with no new runtime infrastructure. The registry lookup is O(1) (hash map). The delegation happens inside `ViewWidget.apply()`, which is already called every tick by the runtime.

**Why not a RuntimeDriver method?** Adding `applyWidgetOpacity` to RuntimeDriver would create a second state-application path that competes with the normal `widget.apply(state)` cycle. ViewWidget already has the child IDs and the target opacity — it should apply them directly. This is consistent with the existing pattern where widgets coordinate with each other through the registry (e.g., LightingWidget resolves ILightingOverride widgets).

### D.5 Both opacity scenarios handled

| Scenario | How opacity reaches ViewWidget | How opacity reaches child meshes |
|----------|-------------------------------|----------------------------------|
| **Scene transition fade** | `FunctionalTransitionSpec` interpolates `ViewState.opacity` from 1→0 (exit) or 0→1 (enter). ViewWidget receives interpolated value in `apply()`. | ViewWidget calls `child.applyViewOpacity(state.opacity)` on each IViewChild. |
| **Carousel slide visibility** | `InputCoordinator.onCarouselStep` patches `ViewState.opacity` per-View via `engine.patchWidgetStates()` (see §D.6). Active slide gets opacity=1.0, inactive slides get fadeMin/0. ViewWidget receives patched state in next `apply()`. | Same: ViewWidget calls `child.applyViewOpacity(state.opacity)`. |
| **Both combined** (scene transition of a carousel scene) | The interpolated ViewState includes the carousel-computed opacity. If the active slide has opacity 1.0 and the scene is at 50% exit, the interpolated opacity is 0.5. Inactive slides start at 0 and stay at 0. | Same mechanism. |

### D.6 Carousel Runtime State-Patching — Already Implemented

The carousel runtime mechanism **already exists** in `InputCoordinator.tsx` (lines 210–305). No new runtime infrastructure is needed. Here is the full existing pipeline:

1. **`InputCoordinator.onCarouselStep(layoutId, direction, stepSlides)`** is called when the user triggers a carousel action (keyboard arrow, X-inertia scroll, etc.).

2. **Read current state:** The handler reads `ViewLayoutState` from the current tick's `state.widgets[layoutId]`. It reads the current `activeIndex` from `VariableStore` (namespace `'carousel'`, key `${layoutId}.activeIndex`), falling back to the compiled value.

3. **Compute new index:** `rawNext = currentIndex + direction * stepSlides`, with loop wrapping or boundary clamping per `config.loop`.

4. **Write to VariableStore:** `variableStore.set('carousel', '${layoutId}.activeIndex', newIndex)`.

5. **Re-run layout resolver:** Calls `resolveLayout(updatedConfig, layoutState.bounds, childSizeHints)` with the updated `activeIndex`. This produces new per-View `bounds`, `scale`, `z`, and **`opacity`** values — the same layout resolver that runs at compile time.

6. **Build state patches:** For each child View, constructs a patched `ViewState` with the new `bounds`, `contentBounds`, `layer`, `scale`, `z`, and `opacity`. Also patches the `ViewLayoutState` with the updated `layoutConfig`.

7. **Apply patches:** Calls `engine.patchWidgetStates(patches)`. This calls `RuntimeDriverImpl.setWidgetStatePatches()`, which overrides the compiled SceneTrack state for subsequent ticks.

8. **ViewWidget receives updated state:** On the next `apply()` call (same frame or next frame), each ViewWidget receives its patched `ViewState` with the updated `opacity`. Active slide ViewWidget gets `opacity: 1.0`, inactive slide ViewWidgets get `opacity: fadeMin` or `0`. ViewWidget then delegates via `child.applyViewOpacity(state.opacity)`.

**Key point:** This is NOT "recompilation" — it is a runtime state patch using the same `resolveLayout()` function the compiler uses. The SceneTrack is not recompiled. Only the affected widget states are patched in the RuntimeDriverImpl's overlay map.

**What this plan changes:** The only difference from the existing carousel mechanism is HOW opacity reaches the 3D meshes. Previously, `ViewWidget` owned a `THREE.Group` and traversed all descendant materials. After this plan, `ViewWidget` calls `IViewChild.applyViewOpacity()` on each child widget. The carousel state-patching pipeline (steps 1–7 above) is completely unchanged.

**Files involved:** All in `player/InputCoordinator.tsx` (Stream D) — already in the plan's file ownership table. No changes needed to the carousel handler beyond the existing rename (`onCameraDolly` → `onCameraZoom`).
