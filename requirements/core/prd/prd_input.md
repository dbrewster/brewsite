---
title: "BrewSite Core — Input System"
doc_type: prd
status: active
owner: brewsite-product-manager
last_updated: 2026-03-15
change_history:
  - date: 2026-02-28
    author: "Toolkit Product"
    summary: "Initial PRD created. Documents the full input system for @brewsite/core: SceneNavInputMap for scene navigation, InputController DSL for action-mapped input, ActionInputController runtime, useEngineInput hook, wheelGuard, keyboard defaults, and composability model."
  - date: 2026-03-02
    author: "Toolkit Product"
    summary: "Core customization unblocking implemented: inputModePolicy, ScrollSource, controlled-mode keyboard opt-in, ActionInputController idDefaults, and deprecation warnings for legacy implicit IDs."
  - date: 2026-03-07
    author: "Toolkit Product"
    summary: "Core cleanup: InputActionType is now a fully open string union. diagram-canvas.* types removed from core. canvas.focus removed. scene.next/scene.prev added."
  - date: 2026-03-09
    author: "Toolkit Product"
    summary: "v2 player API: useEngineInput, useEngineScroll, EngineInputRegion, ScrollCaptureSection, ScrollInput, PointerInput deleted. Input handled by composable components (ActionInput, KeyboardInput, TimeInput, ControlledInput) and ScrollStage."
  - date: 2026-03-12
    author: "Toolkit Product"
    summary: "Input unification: ActionInput replaces all pointer/wheel/key action routing. Default keyboard nav compiler-injected. ActionInputExtensionContext for plugin extensions. carousel.next/carousel.prev added."
  - date: 2026-03-13
    author: "Toolkit Product"
    summary: "Full PRD rewrite to match v2 codebase. Removed all references to deleted APIs (useEngineInput, EngineInputRegion, SceneNavInputMap, InputModePolicy, ScrollInput, PointerInput). Rewrote InputActionSpec with current type shape (id, type, maps[], cameraId, canvasId, focusCenter, speed, stepScenes, layoutId, stepSlides). Rewrote InputActionMap discriminated union (InputPointerMap, InputWheelMap, InputPinchMap, InputKeyMap with kind discriminant). Updated ActionInputController API. Documented ActionInput component, default keyboard navigation injection, ActionInputExtensionContext, and ScrollStage scroll handling."
  - date: 2026-03-15
    author: "Toolkit Product"
    summary: "Codebase alignment: InputActionType 'camera.dolly' renamed to 'camera.zoom', 'canvas.pan' renamed to 'camera.pan'. ActionInput and KeyboardInput replaced by InputCoordinator throughout. ActionInputController constructor updated to use getter function for spec with attach()/detach() lifecycle. ActionInputExtension updated to plain function type (NonNullable<ActionInputHandler['onUnknownAction']>). Default keyboard nav updated to ArrowDown/ArrowUp only (ArrowRight/ArrowLeft are carousel actions). Component table updated to reflect InputCoordinator replacing ActionInput and KeyboardInput."
---

# BrewSite Core — Input System

## 1. Overview

The Input system handles two distinct concerns: navigating between scenes (advancing and retreating through the composition) and dispatching named actions to widgets (camera orbit, dolly, diagram canvas interaction, carousel stepping). These two concerns are implemented as independent, composable subsystems that operate simultaneously without conflict.

**Scene navigation** is handled by composable input components and layout primitives:
- `ScrollStage` — full-page scroll drives scene progress via native `window.scrollY` with spring-physics inertia.
- `InputCoordinator` — unified input coordinator that replaces the former `ActionInput`, `KeyboardInput`, and `InertiaScrollSource` components. Handles action dispatch, keyboard navigation, inertia scroll, and focus management in a single null-rendering component with a priority waterfall for wheel events.
- `TimeInput` — wall-clock auto-advance with configurable duration, loop, and pause-when-hidden.
- `ControlledInput` — external `value` prop drives progress directly.

**Action input** is authored through the `<InputController>` and `<Action>` DSL components compiled into the `SceneTrack`. At runtime, `InputCoordinator` (a React component) reads the baked action spec from the current tick state and wires it to `ActionInputController`, which routes pointer, wheel, pinch, and keyboard events to registered named-action handlers on widgets.

Affects: `@brewsite/core`.

---

## 2. Problem Statement

BrewSite scenes are experienced in two fundamentally different contexts: full-page scroll-driven presentations (where the user scrolls a long page and the scene animates in response) and embedded canvas-local experiences (where a player is embedded in a product page and navigation is self-contained). Both patterns are common.

Additionally, 3D scenes with interactive diagrams require pointer-driven camera control — orbit, dolly, pan — that must coexist with scene navigation without conflict. A user dollying into a diagram should not accidentally advance to the next scene.

The Input system eliminates consumer duplication with a typed, composable API that handles these concerns explicitly.

---

## 3. Goals & Success Metrics

**Primary Goals:**
- Scene navigation is configured by composing input components under `SceneEngine` — no configuration objects, no mode enums.
- Camera orbit/dolly interactions configured through `InputController` DSL never accidentally trigger scene navigation.
- Default keyboard navigation works with zero configuration.
- All event listeners are cleaned up on unmount with no memory leaks.

**Success Metrics:**
- A developer unfamiliar with the toolkit can configure scroll navigation, keyboard navigation, and camera orbit input for a scene in under 20 minutes.
- Zero event listener leaks verified by browser devtools audit after mount/unmount cycle.
- The `wheelGuard` mechanism prevents scene advancement while the user is dollying the camera.

**Guardrail Metrics:**
- No change to `SceneInputControllerSpec` or `InputActionSpec` causes a major semver bump without a migration path.
- Existing `apps/examples/` scenes continue to function correctly after any input system change.

---

## 4. Non-Goals

- **Gamepad / controller input** — gamepad API support is not in scope.
- **Multi-touch gesture recognition beyond pinch** — two-finger rotation, three-finger swipe, and other complex gestures are not addressed.
- **Custom input bindings UI** — no toolkit-provided UI for remapping keys at runtime.
- **Input recording and playback** — no mechanism to record input sequences for testing or demos.
- **Focus management for accessibility** — ARIA focus handling and screen reader compatibility are a host application responsibility.
- **Pointer lock for orbit control** — pointer lock API is not used; delta-based orbit does not require it.

---

## 5. Consumer Stories

- As a toolkit consumer, I want to use standard page scroll to drive my scene animation so that visitors experience the content as a natural scroll journey.
- As a toolkit consumer, I want to embed a BrewSite player in a product page using `SceneReel` with `TimeInput` so that the animation is self-contained.
- As a toolkit consumer, I want arrow key navigation to work by default without any configuration.
- As a toolkit consumer, I want to configure camera orbit and dolly through DSL so that users can explore 3D diagrams interactively.
- As a toolkit consumer, I want camera orbit and page scroll navigation to never conflict.
- As a toolkit consumer, I want to define custom named actions in DSL and handle them in my consumer widgets.
- As a toolkit consumer, I want all event listeners to be cleaned up automatically when I unmount the player.

---

## 6. Functional Requirements

1. The `<InputController>` DSL component shall compile to a `SceneInputControllerSpec` stored in `SceneFrame.inputController` at each frame where the scene is active.
2. The `ActionInputController` shall read the compiled `SceneInputControllerSpec` at each tick and route events to registered action handlers.
3. The `wheelGuard` mechanism shall prevent scene navigation wheel events from firing while a `'camera.zoom'` action is in progress.
4. Each `InputActionSpec` shall route matching events to the handler registered for `type` on the current `ActionInputController`.
5. Custom action type strings (not in the named `InputActionType` set) shall be routed to handlers registered by consumer widgets or plugin extensions.
6. The `InputCoordinator` React component shall bridge compiled `<InputController>` DSL to the `ActionInputController` runtime. It renders no DOM — it is a pure React effect that reads the current spec from the tick state and wires event listeners. It also manages inertia scroll and carousel X-axis inertia when inside a `ScrollStage`.
7. Default keyboard navigation (`scene.next` on ArrowDown, `scene.prev` on ArrowUp, `carousel.next` on ArrowRight, `carousel.prev` on ArrowLeft) is compiler-injected by the engine when no `<InputController>` is authored in any scene.
8. Modifier key matching in `InputPointerMap.modifiers`, `InputWheelMap.modifiers`, and `InputKeyMap.modifiers` shall be evaluated from the event's `ctrlKey`, `metaKey`, `altKey`, and `shiftKey` properties.
9. `InputController` scope `'canvas'` shall attach listeners to the canvas element. Scope `'window'` shall attach listeners to the `window` object.
10. All wheel event listeners shall use `{ passive: false }` to allow `preventDefault()`. Pointer events use `{ passive: true }`.
11. Plugin packages shall extend action dispatch via `ActionInputExtensionContext`. `diagramPlugin.getActionInputExtension()` wires `diagram-canvas.*` actions to `DiagramWidget.applyCanvasAction()`.
12. Carousel actions (`carousel.next`, `carousel.prev`) shall target a `ViewLayout` by `layoutId` and advance by `stepSlides` slides (default 1).

---

## 7. API Design

### 7.1 InputActionType (`input/types.ts`)

```typescript
export type InputActionType =
  | 'camera.orbit'      // pointer delta → CameraWidget orbit handler
  | 'camera.zoom'       // wheel/pinch delta → CameraWidget zoom (dolly) handler
  | 'camera.pan'        // pointer delta → CameraWidget pan handler
  | 'camera.reset'      // key → CameraWidget reset handler
  | 'scene.next'        // advance to the next scene
  | 'scene.prev'        // retreat to the previous scene
  | 'carousel.next'     // advance carousel ViewLayout
  | 'carousel.prev'     // retreat carousel ViewLayout
  | (string & {});      // open union — downstream packages add their own action strings
```

The `(string & {})` pattern maintains TypeScript autocomplete for the named values while allowing arbitrary string literals. `@brewsite/diagram` defines its own `diagram-canvas.*` action strings (e.g. `'diagram-canvas.move'`, `'diagram-canvas.rotate'`, `'diagram-canvas.reset'`, `'diagram-canvas.focus'`) as local constants — these are not part of `@brewsite/core`'s named value set.

### 7.2 Input Action Map Types (`input/types.ts`)

```typescript
export type MouseButton = 'left' | 'middle' | 'right';

export type InputPointerMap = {
  kind: 'pointer';
  event: 'drag' | 'click';
  button?: MouseButton;            // default 'left'
  modifiers?: ModifierKey[];       // required modifiers; empty = no modifier required
  axis?: 'x' | 'y' | 'xy';       // constrain to axis; default 'xy'
  lockAxis?: 'sticky' | 'free';   // axis lock behavior for drag; default 'free'
  lockThreshold?: number;          // min pixels before sticky lock; default 2
};

export type InputWheelMap = {
  kind: 'wheel';
  modifiers?: ModifierKey[];
  axis?: 'x' | 'y' | 'xy';       // wheel axis to respond to; default 'xy'
  lockAxis?: 'sticky' | 'free';   // axis lock on dominant delta; default 'free'
};

export type InputPinchMap = {
  kind: 'pinch';
  direction?: 'in' | 'out' | 'both';  // default 'both'
  modifiers?: ModifierKey[];
  threshold?: number;              // min pinch delta pixels; default 1
};

export type InputKeyMap = {
  kind: 'key';
  key: string;                     // KeyboardEvent.key value (e.g. 'r', 'Escape')
  modifiers?: ModifierKey[];
};

export type InputActionMap = InputPointerMap | InputWheelMap | InputPinchMap | InputKeyMap;
```

### 7.3 Compiled Action Spec (`input/types.ts`)

```typescript
export type InputActionSpec = {
  id: string;                      // unique action identifier
  type: InputActionType;           // action type to dispatch
  cameraId?: string;               // target camera widget ID
  canvasId?: string;               // target canvas widget ID
  focusCenter?: [number, number] | [number, number, number]; // focus target for diagram-canvas.focus
  speed?: number;                  // speed multiplier for continuous actions
  stepScenes?: number;             // scenes to advance for scene.next/scene.prev
  layoutId?: string;               // target ViewLayout ID for carousel actions
  stepSlides?: number;             // slides per carousel step; default 1
  maps: InputActionMap[];          // one or more event maps that trigger this action
};

export type SceneInputControllerSpec = {
  id: string;                      // controller identifier
  scope: InputControllerScope;     // 'canvas' | 'window'
  actions: InputActionSpec[];
};
```

### 7.4 InputController DSL (`compiler/blocks/inputController.tsx`)

```typescript
export type InputControllerScope = 'canvas' | 'window';

export function InputController(props: { scope?: InputControllerScope; children: React.ReactNode }): null;
export function Action(props: ActionProps): null;
```

DSL usage:

```tsx
<Scene key="product-diagram">
  <InputController scope="canvas">
    <Action
      type="camera.orbit"
      maps={[{ kind: 'pointer', event: 'drag', button: 'left' }]}
    />
    <Action
      type="camera.zoom"
      maps={[{ kind: 'pinch', direction: 'both' }]}
    />
    <Action
      type="camera.pan"
      maps={[
        { kind: 'pointer', event: 'drag', button: 'left', modifiers: ['shift'], axis: 'xy' },
        { kind: 'pointer', event: 'drag', button: 'middle', axis: 'xy' },
      ]}
    />
    <Action
      type="camera.reset"
      maps={[{ kind: 'key', key: 'r' }]}
    />
  </InputController>
</Scene>
```

### 7.5 ActionInputController (`input/ActionInputController.ts`)

```typescript
export type ActionInputHandler = {
  getSceneCount: () => number;
  onSceneStep: (direction: 1 | -1, stepScenes: number) => void;
  onCameraOrbit: (cameraId: string, dx: number, dy: number, speed: number) => void;
  onCameraZoom: (cameraId: string, delta: number, speed: number) => void;
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

export type ActionInputControllerOptions = {
  idDefaults?: {
    cameraId: string;
    canvasId: string;
  };
  wheelLockIdleMs?: number;
  onUnclaimedWheel?: (event: WheelEvent) => void;
};

export class ActionInputController {
  constructor(
    target: HTMLElement | Window,
    getSpec: () => SceneInputControllerSpec | null,
    handler: ActionInputHandler,
    keyboardTarget?: HTMLElement | Document | Window,
    options?: ActionInputControllerOptions,
  )

  attach(): void
  detach(): void
  onActionFired(listener: ActionFiredListener): () => void
}
```

`ActionInputController` is instantiated by the `InputCoordinator` React component. The `getSpec` getter is called on each event to read the current `SceneInputControllerSpec` from the tick state, allowing the active action map to change as scenes transition without recreating the controller. The `handler` callback object routes dispatched actions to the engine. `attach()` registers all DOM event listeners; `detach()` removes them and clears internal state.

The `onUnclaimedWheel` option connects the wheel priority waterfall: when no `WheelMap` in the current spec claims a wheel event, the event is forwarded to the `InputCoordinator`'s inertia accumulator for scene scroll.

### 7.6 InputCoordinator Component (`player/InputCoordinator.tsx`)

```typescript
export interface InputCoordinatorProps {
  /** Inertia scroll sensitivity. Higher = faster scene scroll per wheel tick. Default: 0.01. */
  inertiaSensitivity?: number;
  /** Inertia decay factor per frame (0..1). Higher = more momentum. Default: 0.85. */
  inertiaDecay?: number;
  /** DOM element that receives pointer/wheel events. Defaults to ScrollStage container or canvas. */
  target?: HTMLElement | null;
  /** DOM element or document that receives keyboard events. Defaults to document. */
  keyboardTarget?: HTMLElement | Document | Window | null;
  /** Pause engine rendering when the stage falls below the visibility threshold. */
  pauseWhenHidden?: PauseWhenHiddenOptions;
}

export function InputCoordinator(props: InputCoordinatorProps): ReactElement | null;
```

`InputCoordinator` is a null-rendering React component that unifies all input concerns into a single component. It replaces the former `ActionInput`, `KeyboardInput`, and `InertiaScrollSource` components. It:

1. Reads the current `SceneInputControllerSpec` from `tick.state.widgets['__input_controller']` via a getter function passed to `ActionInputController`.
2. Creates an `ActionInputController` bound to the target element (ScrollStage container, or canvas as fallback).
3. Implements the `ActionInputHandler` interface, routing built-in action types (`camera.orbit`, `camera.zoom`, `camera.pan`, `camera.reset`, `scene.next`, `scene.prev`, `carousel.next`, `carousel.prev`) to the engine.
4. Reads `ActionInputExtensionContext` to wire plugin-provided `onUnknownAction` handlers (e.g., `diagram-canvas.*` from `@brewsite/diagram`).
5. When inside a `ScrollStage`, implements a Y-axis inertia scroll loop that converts unclaimed wheel events into scene progress with spring-physics momentum.
6. Implements X-axis inertia for horizontal wheel events, routed to carousel step actions via sticky axis arbitration.
7. Calls `controller.attach()` on mount and `controller.detach()` on unmount.

**Priority waterfall for wheel events:**
1. Scrollable overlay content -- yield to native DOM scroll.
2. `ctrl+wheel` with pinch maps -- dispatch pinch action.
3. `WheelMap` match -- dispatch action (scene scroll does NOT also fire).
4. Scroll driver registered -- accumulate for inertia (Y-axis) or carousel (X-axis).
5. Nothing matched -- browser default.

### 7.7 Default Input Spec

When no scene in the composition authors an `<InputController>`, the compiler injects a comprehensive default action spec via `createDefaultInputSpec()` from `input/defaultInputSpec.ts`:

```typescript
// Compiler-injected defaults (not authored in DSL)
[
  // Scene navigation (keyboard)
  { id: 'default-scene-next', type: 'scene.next', maps: [{ kind: 'key', key: 'ArrowDown' }] },
  { id: 'default-scene-prev', type: 'scene.prev', maps: [{ kind: 'key', key: 'ArrowUp' }] },

  // Camera orbit (pointer drag)
  { id: 'default-camera-orbit', type: 'camera.orbit', cameraId, maps: [
    { kind: 'pointer', event: 'drag', button: 'left', axis: 'xy' },
  ]},

  // Camera zoom (pinch)
  { id: 'default-camera-zoom', type: 'camera.zoom', cameraId, maps: [
    { kind: 'pinch', direction: 'both' },
  ]},

  // Camera pan (shift+drag or middle-button drag)
  { id: 'default-camera-pan', type: 'camera.pan', cameraId, maps: [
    { kind: 'pointer', event: 'drag', button: 'left', modifiers: ['shift'], axis: 'xy' },
    { kind: 'pointer', event: 'drag', button: 'middle', axis: 'xy' },
  ]},

  // Camera reset ('r' key)
  { id: 'default-camera-reset', type: 'camera.reset', cameraId, maps: [{ kind: 'key', key: 'r' }] },

  // Carousel navigation (keyboard) — uses '__primary_carousel__' sentinel layoutId
  { id: 'default-carousel-next', type: 'carousel.next', layoutId: '__primary_carousel__',
    maps: [{ kind: 'key', key: 'ArrowRight' }] },
  { id: 'default-carousel-prev', type: 'carousel.prev', layoutId: '__primary_carousel__',
    maps: [{ kind: 'key', key: 'ArrowLeft' }] },
]
```

This ensures scenes are keyboard-navigable, camera-interactive, and carousel-navigable by default without any DSL authoring. The `'__primary_carousel__'` sentinel layoutId is resolved at runtime by `InputCoordinator` to the current scene's `primaryCarouselId`. When no carousel exists, carousel actions are silent no-ops.

### 7.8 ActionInputExtensionContext

Plugin packages extend the action dispatch system via `ActionInputExtensionContext`:

```typescript
/** Merged onUnknownAction callback from all WidgetPlugin.getActionInputExtension() results. */
export type ActionInputExtension = NonNullable<ActionInputHandler['onUnknownAction']>;
// Equivalent to:
// (type: string, canvasId: string | undefined,
//  event: PointerEvent | WheelEvent | KeyboardEvent | MouseEvent,
//  extra: Record<string, unknown>) => void;

export const ActionInputExtensionContext = React.createContext<ActionInputExtension | null>(null);
```

`ActionInputExtension` is a plain function, not an object with `registerHandlers`. `SceneEngine` collects `getActionInputExtension()` from each registered plugin and merges all `onUnknownAction` handlers into a single function provided via this context. `InputCoordinator` passes this function as the `handler.onUnknownAction` to `ActionInputController`.

`diagramPlugin.getActionInputExtension()` returns an extension that handles `diagram-canvas.move`, `diagram-canvas.rotate`, `diagram-canvas.reset`, and `diagram-canvas.focus` — routing them to `DiagramWidget.applyCanvasAction()`.

### 7.9 Scene Navigation Components

| Component | Purpose |
|---|---|
| `ScrollStage` | Full-page scroll layout. Renders a tall container with a sticky-positioned inner viewport. |
| `InputCoordinator` | Unified input coordinator. Bridges compiled `<InputController>` DSL to `ActionInputController`, manages inertia scroll, carousel X-axis inertia, keyboard event routing, and pauseWhenHidden. Replaces former `ActionInput`, `KeyboardInput`, and `InertiaScrollSource`. |
| `TimeInput` | Wall-clock auto-advance with configurable `duration`, `loop`, and `pauseWhenHidden`. Yields to user input. |
| `ControlledInput` | External `value` prop drives progress. Highest priority — overrides all other input. |

### 7.10 wheelGuard

When `'camera.zoom'` (or any other action) is the matched action for a wheel event, `ActionInputController` claims the event via `preventDefault()` and does not forward it to the `onUnclaimedWheel` callback. This prevents scene scroll from also consuming the wheel delta. The wheel lock uses a sticky axis mechanism with a configurable idle timeout (`wheelLockIdleMs`, default 180ms) — once a wheel action is locked to a specific action and modifier signature, subsequent wheel events within the idle window continue dispatching to the same action without re-matching.

The wheel lock is an internal mechanism — not part of the public API.

---

## 8. Technical Considerations

### 8.1 Scroll Handling in ScrollStage

`ScrollStage` uses native browser scroll. It renders a tall container whose height is `pixelsPerScene * sceneCount`. `window.scrollY` is mapped to progress with spring-physics inertia for smooth scene transitions. The scroll layout uses a sticky-positioned inner container that holds the canvas and overlay.

### 8.2 Event Listener Passive Flags

Wheel events on the canvas require `{ passive: false }` to allow `preventDefault()` when the user is dollying the camera. This is a deliberate non-passive listener that browser devtools may flag as a performance warning — it is unavoidable for interactive dolly control.

Pointer events use `{ passive: true }`.

### 8.3 InputController DSL Compilation

`InputController` and `Action` are null-returning React functions. Their props are extracted by the compiler's node handler. The compiler traverses `InputController`'s children to extract `Action` specs and assembles a `SceneInputControllerSpec`, stored in `SceneFrame.inputController`.

### 8.4 ModifierKey Matching

Modifier key matching evaluates `event.ctrlKey || event.metaKey` for `'ctrl'` on macOS (where Cmd key is `metaKey`). `'ctrl'` in a modifier list matches the platform's primary modifier key.

### 8.5 Pinch-to-Dolly on Touch Devices

`InputPinchMap` is recognized through `pointerdown` / `pointermove` events on touch devices by tracking two simultaneous pointer IDs. The `ActionInputController` maintains a `Map<number, PointerEvent>` of active pointers. When two pointers are active and moving, it computes the distance change and dispatches an action event with `type: 'pinch'` and the distance delta. Single-pointer drag and two-pointer pinch are mutually exclusive within one gesture.

### 8.6 Action Spec Resolution

`ActionInputController` reads the spec via its `getSpec()` getter function on each input event (not per frame). The getter returns `null` when no tick has been produced yet. The controller does not store the spec — it evaluates the getter on demand. Event listeners are registered once via `attach()` and remain active for the controller's lifetime; only the action matching logic reads the current spec per event.

### 8.7 Sticky Axis Lock

`InputPointerMap.lockAxis: 'sticky'` chooses the dominant axis early in a drag gesture (within `lockThreshold` pixels of movement) and locks to that axis until `pointerup`. This enables natural orbit control on trackpads where the user initiates a horizontal orbit gesture — vertical jitter is suppressed.

---

## 9. Breaking Change Assessment

**Semver impact: Major** — v2 removed `useEngineInput`, `useEngineScroll`, `EngineInputRegion`, `ScrollCaptureSection`, `ScrollInput`, `PointerInput`, `SceneNavInputMap`, and `InputModePolicy`. These are all breaking deletions documented in `MIGRATION.md`.

The current API surface (`InputActionType`, `InputActionSpec`, `InputActionMap`, `SceneInputControllerSpec`, `ActionInputController`, `InputCoordinator`, `TimeInput`, `ControlledInput`, `ScrollStage`) is stable.

Future breaking change risk:
- `InputActionType` is an open string union. Adding new named values is backward-compatible. Removing named values is a major change.
- `InputActionSpec.maps` using a discriminated union on `kind` is flexible — new `kind` values are additive.
- `ActionInputExtensionContext` is consumed by plugin packages. The `ActionInputExtension` type changed from an object with `registerHandlers` to a plain function — this was a breaking change for plugin authors but not for scene authors.

---

## 10. Dependencies

- **React** (peer dependency): `React.useEffect`, `React.createContext`, `React.useContext`.
- **@brewsite/core internal**: `EngineStateContext`, `SceneTrackTick`, `SceneFrame`, `SceneInputControllerSpec`, `InputActionSpec`, compiler node handler registry, `CameraWidget`, `WidgetRegistry`.
- **No new external dependencies.**

---

## 11. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Non-passive wheel listener causes browser performance warning | DevTools noise; potential jank | Accept the warning; document it; unavoidable for interactive dolly |
| wheelGuard debounce timeout too short | Wheel dolly accidentally triggers scene advance | Default timeout is conservative; internal, not exposed |
| Ctrl/Meta normalization confuses consumers on Windows | Cmd-specific bindings broken | Document the normalization; expose `'meta'` for exclusive match |
| `setSpec()` deep equality check per frame | CPU cost | Action arrays are small (< 10 items); deep equality is cheap |
| Sticky axis lock threshold wrong for high-DPI displays | Orbit feels wrong | `lockThreshold` is configurable per action spec |
| Plugin extension context not provided | Plugin action handlers silently not registered | `ActionInput` logs a development warning when extension context is null and compiled spec contains unknown action types |

---

## 12. Open Questions

- Should `InputActionType` be a TypeScript `enum` rather than a string union? Current position: string union. Enum would be a breaking change.
- Should per-scene `pixelsPerScene` be supported in `ScrollStage`? Current: global only via prop. Per-scene scroll weights are handled by `ProgressManager` instead.
- Should `ActionInputController` be exposed as a public API for consumers who want imperative action handling? Currently internal.

---

## 13. Launch Criteria

- `ActionInputController` has unit tests covering: action routing for drag, wheel, pinch, click, and key events; modifier key matching; wheel lock activation/idle timeout; sticky axis lock behavior; `onUnclaimedWheel` callback invocation when no wheel map matches.
- `InputController` and `Action` DSL compilation has unit tests covering: spec extraction, `type` validation, and invalid children warning.
- Default keyboard navigation injection is covered by a compiler test.
- At least one example scene in `apps/examples/` demonstrates `InputController` with `camera.orbit`, `camera.zoom`, and `camera.reset` actions configured.
- `InputActionSpec`, `InputActionType`, `InputActionMap`, `InputPointerMap`, `InputWheelMap`, `InputPinchMap`, `InputKeyMap`, `SceneInputControllerSpec`, `ActionInputController`, and `InputCoordinator` are all exported from `packages/core/src/index.ts`.
- `CHANGELOG.md` entry written for the release.
- `pnpm build:lib` passes with zero TypeScript errors.
- `pnpm test` passes for `@brewsite/core` with coverage targets met for all files in `src/input/`.
