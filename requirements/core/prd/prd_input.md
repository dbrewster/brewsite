---
title: "BrewSite Core — Input System"
doc_type: prd
status: active
owner: Toolkit Product
last_updated: 2026-03-23
change_history:
  - date: 2026-03-23
    author: "Toolkit Product"
    summary: "SceneEmbed replaces SceneReel, ControlledInput, TimeInput. Updated Section 1 overview and Section 7 input tier descriptions. ControlledInput and TimeInput are deleted exports. SceneEmbed manages progress driving internally. InputCoordinator remains the input component for custom SceneEngine layouts and is mounted internally by SceneEmbed when interactive=true."
  - date: 2026-03-18
    author: "Toolkit Product"
    summary: "Carousel selection region: documented carousel selection dispatch in ActionInputController (Section 7.7) and InputCoordinator (Section 7.8). Added `carousel.select` as an implicit action. Pointer click and keyboard Enter/Space within carousel bounds dispatch `CarouselSelectEvent` to the `onSelect` handler registered via `<ViewLayout onSelect={...}>`. When `event.preventDefault()` is called, the normal click dispatch waterfall is suppressed. New types: `CarouselSelectEvent`, `CarouselSelectHandler`, `CarouselSelectSource`."
  - date: 2026-03-17
    author: "Toolkit Product"
    summary: "v1 release readiness audit: removed deprecated PointerMapProps.drag, PointerMapProps.click, and KeyMapProps.key fields. PointerMap event is specified via the 'event' prop. KeyMap keys are specified via the 'keys' prop (avoiding conflict with React's reserved 'key' prop)."
  - date: 2026-03-17
    author: "Toolkit Product"
    summary: "Codebase alignment: removed touchSensitivityScale from InputCoordinatorProps (does not exist in code). Removed touchGestureClassifier.ts file references (file does not exist; touch gesture classification is inline in InputCoordinator). Fixed modifier matching description: ctrlKey maps to 'ctrl' and metaKey maps to 'meta' independently with no platform-specific Cmd-as-Ctrl mapping."
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
    summary: "Full PRD rewrite to match v2 codebase. Removed all references to deleted APIs (useEngineInput, EngineInputRegion, SceneNavInputMap, InputModePolicy, ScrollInput, PointerInput). Rewrote InputActionSpec with current type shape. Rewrote InputActionMap discriminated union. Updated ActionInputController API. Documented ActionInput component, default keyboard navigation injection, ActionInputExtensionContext, and ScrollStage scroll handling."
  - date: 2026-03-15
    author: "Toolkit Product"
    summary: "Codebase alignment: InputActionType 'camera.dolly' renamed to 'camera.zoom', 'canvas.pan' renamed to 'camera.pan'. ActionInput and KeyboardInput replaced by InputCoordinator throughout. ActionInputController constructor updated to use getter function for spec with attach()/detach() lifecycle. ActionInputExtension updated to plain function type. Default keyboard nav updated to ArrowDown/ArrowUp only (ArrowRight/ArrowLeft are carousel actions). Component table updated to reflect InputCoordinator replacing ActionInput and KeyboardInput."
  - date: 2026-03-15
    author: "Toolkit Product"
    summary: "Input system overhaul (Phases 1-4, 6) complete. Major PRD rewrite: (1) 'Scroll is sacred' — plain scroll Y/X always drives scene/carousel navigation, no default action uses WheelMap. (2) Default input map redesigned — Cmd+scroll orbit, Shift+scroll pan, pinch zoom, left drag free. (3) Merge mode — InputController merges with defaults by action id; mode='replace' for full override. (4) Touch support — touches field on PointerMap, 2-finger orbit, 3-finger pan. (5) Focus gating — ScrollStage has tabIndex={0}, auto-focus on mouse hover, keyboard events gated to focused stage. (6) Scope resolution — scope='canvas' and scope='window' now correctly resolve DOM targets. (7) InputCoordinator decomposed into pure testable modules (inertiaAccumulator, axisArbiter, carouselStepper, touchGestureClassifier, inputSpecMerger, scopeResolver)."
---

# BrewSite Core — Input System

## 1. Overview

The Input system handles two distinct concerns: navigating between scenes (advancing and retreating through the composition) and dispatching named actions to widgets (camera orbit, zoom, pan, carousel stepping, and custom interactions). These two concerns are implemented as independent, composable subsystems that operate simultaneously without conflict.

The system is built on a foundational design principle: **scroll is sacred.** Plain scroll Y always drives scene navigation. Plain scroll X always drives carousel navigation. No default action consumes unmodified scroll. Camera interactions use modifier+scroll, pinch, and keyboard exclusively.

**Scene navigation** is handled by composable input components, layout primitives, and the `SceneEmbed` convenience component:
- `ScrollStage` — full-page scroll drives scene progress via native `window.scrollY` with spring-physics inertia. Has `tabIndex={0}` for keyboard focus gating.
- `InputCoordinator` — unified input coordinator that handles action dispatch, keyboard navigation, inertia scroll, carousel X-axis inertia, touch gesture classification, and focus management. Implements a priority waterfall for wheel events.
- `SceneEmbed` — self-contained embedded player that manages progress driving internally via `autoPlay` (wall-clock auto-advance) or `progress` (external controlled progress). Mounts `InputCoordinator` internally when `interactive` is set.

**Action input** is authored through the `<InputController>` and `<Action>` DSL components compiled into the `SceneTrack`. The compiler merges scene-authored actions with a comprehensive default input spec. At runtime, `InputCoordinator` reads the baked action spec from the current tick state and wires it to `ActionInputController`, which routes pointer, wheel, pinch, and keyboard events to registered named-action handlers on widgets.

Affects: `@brewsite/core`.

---

## 2. Problem Statement

BrewSite scenes are experienced in two fundamentally different contexts: full-page scroll-driven presentations and embedded canvas-local experiences. Both require reliable scene navigation.

Additionally, 3D scenes with interactive diagrams require pointer-driven camera control — orbit, zoom, pan — that must coexist with scene navigation without conflict. A user zooming into a diagram should not accidentally advance to the next scene. Conversely, plain scroll should always navigate between scenes regardless of what camera actions are configured.

On mobile, touch gestures must map naturally to both navigation and camera control without requiring modifier keys or complex input choreography.

The Input system solves these with a typed, composable API where plain scroll is unconditionally reserved for navigation, and camera/canvas interactions are explicitly gated behind modifiers, pinch gestures, or multi-finger touch.

---

## 3. Goals & Success Metrics

**Primary Goals:**
- Plain scroll Y always drives scene navigation. Plain scroll X always drives carousel navigation. No exceptions.
- Camera orbit/zoom/pan interactions never conflict with scroll navigation in the default configuration.
- Scene authors can customize input with minimal DSL by merging custom actions with comprehensive defaults.
- Default keyboard navigation, camera control, and carousel navigation work with zero configuration.
- Mobile touch gestures (1-finger scroll, 2-finger orbit, pinch zoom, 3-finger pan) work out of the box.
- Keyboard events are focus-gated to the active stage, preventing cross-instance conflicts.
- All event listeners are cleaned up on unmount with no memory leaks.

**Success Metrics:**
- A developer unfamiliar with the toolkit can configure scroll navigation, keyboard navigation, and camera control in under 10 minutes.
- Zero event listener leaks verified by browser devtools audit after mount/unmount cycle.
- No scene that uses the default input spec ever has a scroll-vs-camera conflict.
- Mobile scenes are navigable with 1-finger swipe and camera-controllable with 2-finger gestures without any DSL configuration.

**Guardrail Metrics:**
- No change to `SceneInputControllerSpec` or `InputActionSpec` causes a major semver bump without a migration path.
- Existing `apps/examples/` scenes continue to function correctly after any input system change.

---

## 4. Non-Goals

- **Gamepad / controller input** — gamepad API support is not in scope.
- **Multi-touch gesture recognition beyond pinch** — two-finger rotation and other complex gestures are not addressed.
- **Custom input bindings UI** — no toolkit-provided UI for remapping keys at runtime.
- **Input recording and playback** — no mechanism to record input sequences for testing or demos.
- **Focus management for accessibility** — ARIA focus handling and screen reader compatibility are a host application responsibility.
- **Pointer lock for orbit control** — pointer lock API is not used; delta-based orbit does not require it.

---

## 5. Consumer Stories

- As a toolkit consumer, I want plain scroll to always navigate between scenes so that visitors never get stuck because a camera action consumed the scroll.
- As a toolkit consumer, I want default camera control (orbit, zoom, pan, reset) to work without any `<InputController>` DSL, so I can focus on scene content.
- As a toolkit consumer, I want to override specific default bindings by declaring `<Action>` elements with matching `id` values, while keeping all other defaults.
- As a toolkit consumer, I want `mode="replace"` when I need full control over every input binding for a teaching or demonstration scene.
- As a toolkit consumer, I want carousel navigation (scroll X + arrow keys) to work by default when I set `primaryCarouselId` on my scene.
- As a toolkit consumer, I want mobile visitors to orbit the camera with 2-finger drag and zoom with pinch without any extra configuration.
- As a toolkit consumer, I want keyboard events to only fire when the BrewSite stage has focus, so that multiple instances on a page do not conflict.
- As a toolkit consumer, I want all event listeners to be cleaned up automatically when I unmount the player.
- As a toolkit consumer, I want to respond to pointer clicks and keyboard Enter/Space on carousel items via an `onSelect` callback on `<ViewLayout>`, so I can build interactive product selectors and drill-down carousels.

---

## 6. Functional Requirements

1. **Scroll is sacred.** The default input spec contains no unmodified `WheelMap` on any action. Unmodified wheel events always fall through to the inertia scroll system: Y-axis for scene navigation, X-axis for carousel navigation. This is unconditional and cannot be accidentally overridden by the default spec.
2. The `<InputController>` DSL component compiles to a `SceneInputControllerSpec` stored in `SceneFrame.inputController`. The compiler merges this spec with `createDefaultInputSpec()` using the spec's `mergeMode` field (default: `'merge'`).
3. In merge mode, actions from the scene spec with an `id` matching a default action replace that default. Actions with a new `id` are appended. Default actions not overridden are preserved. The `scope` field from the scene spec takes precedence.
4. In replace mode (`mode="replace"` on `<InputController>`), the scene spec completely replaces defaults. An empty replace-mode controller disables all action-based input for that scene.
5. The carry-forward mechanism is preserved: if scene N declares `<InputController>`, scene N+1 inherits that spec if N+1 has no `<InputController>`. Merge with defaults happens after carry-forward.
6. The `ActionInputController` reads the spec via its `getSpec()` getter function on each input event. Event listeners are registered once via `attach()` and remain active for the controller's lifetime.
7. The `wheelGuard` mechanism prevents scene navigation wheel events from firing while a modifier+scroll action (orbit, pan) is in progress.
8. Modifier key matching maps `event.ctrlKey` to `'ctrl'` and `event.metaKey` to `'meta'` independently. There is no platform-specific Cmd-as-Ctrl mapping — `'ctrl'` matches only `ctrlKey`, and `'meta'` matches only `metaKey`. To match the platform modifier on macOS (Cmd), use `'meta'` in the modifier list. To match Ctrl on all platforms, use `'ctrl'`.
9. `InputController` scope `'canvas'` attaches pointer/wheel listeners to the canvas container and keyboard listeners to the stage container (focus-gated). Scope `'window'` attaches pointer/wheel to `window` and keyboard to `document`.
10. All wheel event listeners use `{ passive: false }` to allow `preventDefault()`. Pointer events use `{ passive: true }`.
11. Plugin packages extend action dispatch via `ActionInputExtensionContext`. `diagramPlugin.getActionInputExtension()` wires `diagram-canvas.*` actions to `DiagramWidget.applyCanvasAction()`.
12. Carousel actions (`carousel.next`, `carousel.prev`) target a `ViewLayout` by `layoutId` and advance by `stepSlides` slides (default 1). The `'__primary_carousel__'` sentinel is resolved at runtime by `InputCoordinator` to the current scene's `primaryCarouselId`.
13. `ScrollStage` has `tabIndex={0}` on its outer container. On mouse `pointerenter` (not touch), the stage auto-focuses with `{ preventScroll: true }`. The `outline` is suppressed. Keyboard events only fire when the stage has focus or contains the active element.
14. The `touches` field on `InputPointerMap` specifies the exact number of simultaneous touch points required. When omitted, the map matches mouse/stylus only (backward compatible). When set, `button` is ignored.
15. Multi-touch pointer drag computes centroid movement from all tracked touch points. A finger settle window (80ms) allows additional fingers to arrive before committing to a finger count.
16. Default keyboard navigation (`scene.next` on ArrowDown, `scene.prev` on ArrowUp, `carousel.next` on ArrowRight, `carousel.prev` on ArrowLeft) is always present in the merged default spec.
17. When a pointer `click` event occurs within carousel bounds, `ActionInputController` shall resolve the clicked view index via hit testing and dispatch a `CarouselSelectEvent` to the `onSelect` handler registered on the `<ViewLayout>`. If the handler calls `event.preventDefault()`, the click does not propagate to the normal `PointerMap` click dispatch waterfall. Keyboard Enter and Space keys within a focused carousel follow the same dispatch path with `source: 'keyboard'`.
18. The `InteractionCallbackRegistry` (a React ref on `useSceneEngine`) stores `onSelect` handlers keyed by `layoutId`. Handlers are extracted from the JSX tree at compile time by `extractInteractionCallbacks()` and are not baked into the `SceneTrack`.

---

## 7. API Design

### 7.1 InputActionType (`input/types.ts`)

```typescript
export type InputActionType =
  | 'camera.orbit'      // pointer/wheel delta -> CameraWidget orbit handler
  | 'camera.zoom'       // pinch delta -> CameraWidget zoom (dolly) handler
  | 'camera.pan'        // pointer/wheel delta -> CameraWidget pan handler
  | 'camera.reset'      // key -> CameraWidget reset handler
  | 'scene.next'        // advance to the next scene
  | 'scene.prev'        // retreat to the previous scene
  | 'carousel.next'     // advance carousel ViewLayout
  | 'carousel.prev'     // retreat carousel ViewLayout
  | (string & {});      // open union -- downstream packages add their own action strings
```

The `(string & {})` pattern maintains TypeScript autocomplete for the named values while allowing arbitrary string literals. `@brewsite/diagram` defines its own `diagram-canvas.*` action strings as local constants.

### 7.2 Input Action Map Types (`input/types.ts`)

```typescript
export type MouseButton = 'left' | 'middle' | 'right';

export type InputPointerMap = {
  kind: 'pointer';
  event: 'drag' | 'click';
  button?: MouseButton;            // default 'left'; ignored when touches is set
  modifiers?: ModifierKey[];       // required modifiers; empty = no modifier required
  touches?: number;                // exact touch point count (touch only); omit for mouse/stylus
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
export type InputSpecMergeMode = 'merge' | 'replace';

export type InputActionSpec = {
  id: string;                      // unique action identifier (used for merge matching)
  type: InputActionType;           // action type to dispatch
  cameraId?: string;               // target camera widget ID
  canvasId?: string;               // target canvas widget ID
  focusCenter?: [number, number] | [number, number, number];
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
  mergeMode?: InputSpecMergeMode;  // how this spec merges with defaults; default 'merge'
};
```

### 7.4 InputController DSL (`compiler/blocks/inputController.tsx`)

```typescript
export type InputControllerScope = 'canvas' | 'window';

export function InputController(props: {
  scope?: InputControllerScope;
  mode?: InputSpecMergeMode;       // 'merge' (default) or 'replace'
  children: React.ReactNode;
}): null;

export function Action(props: ActionProps): null;
```

DSL usage — merge mode (default):

```tsx
<Scene key="product-diagram">
  {/* Only declare what differs from defaults. All other defaults are preserved. */}
  <InputController scope="canvas">
    {/* Override default orbit to add left-drag */}
    <Action id="default-camera-orbit" type="camera.orbit"
      maps={[
        { kind: 'wheel', modifiers: ['meta'], axis: 'xy' },
        { kind: 'pointer', event: 'drag', button: 'left' },
        { kind: 'pointer', event: 'drag', touches: 2, axis: 'xy' },
      ]}
    />
  </InputController>
</Scene>
```

DSL usage — replace mode:

```tsx
<Scene key="demo-all-bindings">
  {/* Full override — no defaults are merged. Only these actions exist. */}
  <InputController scope="window" mode="replace">
    <Action type="camera.orbit"
      maps={[{ kind: 'pointer', event: 'drag', button: 'left' }]}
    />
    <Action type="camera.zoom"
      maps={[{ kind: 'wheel' }, { kind: 'pinch', direction: 'both' }]}
    />
  </InputController>
</Scene>
```

### 7.5 Default Input Spec (`input/defaultInputSpec.ts`)

The default spec is injected by the compiler and merged with any scene-authored `<InputController>`. It embodies the "scroll is sacred" principle.

| Action | ID | Desktop Binding | Mobile Binding |
|---|---|---|---|
| Scene scroll (Y) | (unclaimed wheel path) | Plain scroll Y | 1-finger swipe Y |
| Carousel scroll (X) | (unclaimed wheel path) | Plain scroll X | 1-finger swipe X |
| Camera orbit | `default-camera-orbit` | Cmd/Ctrl + scroll | 2-finger drag |
| Camera zoom | `default-camera-zoom` | Pinch (trackpad) | 2-finger pinch |
| Camera pan | `default-camera-pan` | Shift + scroll, middle-drag | 3-finger drag |
| Camera reset | `default-camera-reset` | R key | -- |
| Scene next | `default-scene-next` | ArrowDown | (via scroll) |
| Scene prev | `default-scene-prev` | ArrowUp | (via scroll) |
| Carousel next | `default-carousel-next` | ArrowRight | (via swipe X) |
| Carousel prev | `default-carousel-prev` | ArrowLeft | (via swipe X) |

Key design properties:
- **No unmodified WheelMap in any action.** Plain wheel always falls through to inertia scroll.
- **Left drag is free.** No default action consumes unmodified left drag, keeping overlays, text selection, and future interactive elements unblocked.
- **Touch uses finger count.** 1-finger = scroll/carousel, 2-finger drag = orbit, 2-finger pinch = zoom, 3-finger drag = pan.

### 7.6 Input Spec Merger (`input/inputSpecMerger.ts`)

```typescript
export function mergeInputSpecs(
  defaults: SceneInputControllerSpec,
  scene: SceneInputControllerSpec,
  mode: InputSpecMergeMode,
): SceneInputControllerSpec;
```

In `'merge'` mode: default actions not overridden by a scene action with the same `id` are preserved. Scene actions override or append. In `'replace'` mode: the scene spec is returned as-is.

### 7.7 ActionInputController (`input/ActionInputController.ts`)

```typescript
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

`ActionInputController` is instantiated by `InputCoordinator`. The `getSpec` getter is called on each event to read the current `SceneInputControllerSpec` from the tick state. `attach()` registers all DOM event listeners; `detach()` removes them. The `onUnclaimedWheel` callback connects the wheel priority waterfall.

### 7.8 InputCoordinator Component (`player/InputCoordinator.tsx`)

```typescript
export interface InputCoordinatorProps {
  inertiaSensitivity?: number;        // default: 0.01
  inertiaDecay?: number;              // default: 0.85
  target?: HTMLElement | null;
  keyboardTarget?: HTMLElement | Document | Window | null;
  pauseWhenHidden?: PauseWhenHiddenOptions;
}

export function InputCoordinator(props: InputCoordinatorProps): ReactElement | null;
```

`InputCoordinator` is a null-rendering React component that unifies all input concerns. It:

1. Reads the current `SceneInputControllerSpec` from `tick.state.widgets['__input_controller']`.
2. Resolves DOM targets based on `spec.scope` via `resolveInputTargets()`.
3. Creates an `ActionInputController` with the resolved targets.
4. Routes built-in action types to the engine.
5. Reads `ActionInputExtensionContext` for plugin-provided `onUnknownAction` handlers.
6. Manages Y-axis inertia scroll (scene navigation) and X-axis inertia (carousel navigation) for unclaimed wheel events.
7. Delegates to pure extracted modules: `inertiaAccumulator`, `axisArbiter`, `carouselStepper`.

**Priority waterfall for wheel events:**
1. Scrollable overlay content -- yield to native DOM scroll.
2. `ctrl+wheel` with pinch maps -- dispatch pinch action.
3. `WheelMap` match with matching modifiers -- dispatch action (scene scroll does NOT also fire).
4. Scroll driver registered -- accumulate for inertia (Y-axis) or carousel (X-axis) via axis arbiter.
5. Nothing matched -- browser default.

### 7.9 Scope Resolution (`input/scopeResolver.ts`)

```typescript
export type ResolvedTargets = {
  pointerTarget: HTMLElement | Window;
  keyboardTarget: HTMLElement | Document;
};

export function resolveInputTargets(
  scope: InputControllerScope,
  canvasContainer: HTMLElement | null,
  stageContainer: HTMLElement | null,
): ResolvedTargets;
```

- `scope="canvas"`: pointer events on `canvasContainer`, keyboard on `stageContainer` (focus-gated via `tabIndex={0}`).
- `scope="window"`: pointer events on `window`, keyboard on `document`.
- Explicit `target` / `keyboardTarget` props on `InputCoordinator` override scope resolution.

### 7.10 Touch Gesture Classifier

```typescript
export type TouchGestureIntent =
  | 'scroll'          // 1-finger vertical swipe
  | 'carousel-swipe'  // 1-finger horizontal swipe
  | 'drag-2'          // 2-finger drag (orbit)
  | 'pinch'           // 2-finger pinch (zoom)
  | 'drag-3'          // 3-finger drag (pan)
  | 'undecided';
```

Conceptual state machine that classifies multi-touch gestures. Touch gesture classification is handled inline within `InputCoordinator` rather than as a standalone extracted module. 1-finger swipe is axis-arbitrated to scroll or carousel-swipe. 2-finger gestures are disambiguated as pinch (inter-finger distance change) or drag (centroid translation). 3+ fingers are always drag-3 (pan).

### 7.11 ActionInputExtensionContext

```typescript
export type ActionInputExtension = NonNullable<ActionInputHandler['onUnknownAction']>;
export const ActionInputExtensionContext = React.createContext<ActionInputExtension | null>(null);
```

`SceneEngine` collects `getActionInputExtension()` from each registered plugin and merges all `onUnknownAction` handlers into a single function. `InputCoordinator` passes this as `handler.onUnknownAction` to `ActionInputController`.

### 7.12 Scene Navigation Components

| Component | Purpose |
|---|---|
| `ScrollStage` | Full-page scroll layout. Renders a tall container with a sticky-positioned inner viewport. Has `tabIndex={0}` for keyboard focus gating; auto-focuses on mouse hover. |
| `InputCoordinator` | Unified input coordinator. Bridges compiled `<InputController>` DSL to `ActionInputController`, manages inertia scroll, carousel X-axis inertia, touch gesture classification, keyboard event routing, scope resolution, and pauseWhenHidden. |
| `SceneEmbed` (autoPlay) | Wall-clock auto-advance with configurable duration and loop. Pauses when off-screen. Disabled when `prefers-reduced-motion` matches. |
| `SceneEmbed` (progress) | External `progress` prop drives engine progress directly. Highest priority — overrides autoPlay. |

### 7.13 Extracted Pure Modules

The following pure, testable modules were extracted from `InputCoordinator` to reduce complexity and enable isolated unit testing:

| Module | Responsibility |
|---|---|
| `input/inertiaAccumulator.ts` | Stateful inertia math: accumulate deltas, decay velocity, emit progress. |
| `input/axisArbiter.ts` | Sticky axis-lock state machine for wheel/touch X vs Y arbitration. |
| `input/carouselStepper.ts` | Pure carousel index computation with loop/clamp behavior. |
| Touch gesture classification | Multi-touch gesture classification (scroll, carousel-swipe, drag-2, pinch, drag-3) is handled inline within `InputCoordinator`. |
| `input/inputSpecMerger.ts` | Merges scene input spec with default spec by action `id`. |
| `input/scopeResolver.ts` | Resolves `scope` field to concrete DOM target elements. |

---

## 8. Technical Considerations

### 8.1 Scroll Handling in ScrollStage

`ScrollStage` uses native browser scroll. It renders a tall container whose height is `pixelsPerScene * sceneCount`. `window.scrollY` is mapped to progress with spring-physics inertia for smooth scene transitions. The scroll layout uses a sticky-positioned inner container that holds the canvas and overlay. The stage has `tabIndex={0}` with `outline: 'none'` and auto-focuses on mouse `pointerenter` (not touch, to avoid dismissing on-screen keyboards).

### 8.2 Event Listener Passive Flags

Wheel events on the canvas require `{ passive: false }` to allow `preventDefault()` when a modifier+scroll action is consuming the wheel. This is a deliberate non-passive listener that browser devtools may flag — it is unavoidable for camera control.

Pointer events use `{ passive: true }`.

### 8.3 InputController DSL Compilation

`InputController` and `Action` are null-returning React functions. The compiler's node handler extracts props from children to assemble a `SceneInputControllerSpec` stored in `SceneFrame.inputController`. The `mode` prop on `InputController` is written to `spec.mergeMode`. After carry-forward, every scene's spec is merged with `createDefaultInputSpec()` using `mergeInputSpecs()`.

### 8.4 ModifierKey Matching

Modifier key matching maps each DOM event modifier flag to a distinct modifier name: `event.altKey` -> `'alt'`, `event.ctrlKey` -> `'ctrl'`, `event.metaKey` -> `'meta'`, `event.shiftKey` -> `'shift'`. There is no platform-specific merging — `'ctrl'` matches only `ctrlKey` and `'meta'` matches only `metaKey`. On macOS, the Cmd key fires `metaKey`, so use `'meta'` in the modifier list to match it. The matching function requires that the set of pressed modifiers exactly equals the set of required modifiers (no extra, no missing).

### 8.5 Touch Gesture Handling

Multi-touch gestures are classified by touch gesture classification logic within `InputCoordinator`. When a `PointerMap` has `touches: N`, it matches when exactly N touch points are active. The `ActionInputController` tracks a `Map<number, PointerEvent>` of active pointers. When `touches` count matches, it computes drag delta from the centroid of all tracked touch points.

A finger settle window (80ms from `TouchClassifierConfig.fingerSettleMs`) allows additional fingers to arrive before committing. During settle, no drag events are dispatched. After the window expires or movement exceeds the axis lock threshold, the finger count is committed.

iOS 3-finger gestures may conflict with system actions (undo/redo on iPad). The `touches: 3` pan mapping is best-effort. Scene authors can override `default-camera-pan` with an alternative gesture if needed.

### 8.6 Action Spec Resolution

`ActionInputController` reads the spec via its `getSpec()` getter function on each input event (not per frame). The getter returns `null` when no tick has been produced yet. Event listeners are registered once via `attach()` and remain active for the controller's lifetime; only the action matching logic reads the current spec per event.

### 8.7 Sticky Axis Lock

`InputPointerMap.lockAxis: 'sticky'` chooses the dominant axis early in a drag gesture (within `lockThreshold` pixels of movement) and locks to that axis until `pointerup`. The axis arbiter in `axisArbiter.ts` implements the same mechanism for wheel events with a configurable idle timeout.

### 8.8 Focus Gating

When `scope="canvas"` and the player is inside a `ScrollStage`, keyboard events listen on the stage container (which has `tabIndex={0}`). Keyboard input only fires when the stage has focus, preventing cross-instance conflicts when multiple BrewSite players exist on a page.

When there is no `ScrollStage` (e.g., `SceneEmbed` or bare `SceneEngine`), keyboard events fall back to `document` and focus-gating is not active. This is acceptable because non-scroll players are typically full-viewport or embedded.

---

## 9. Breaking Change Assessment

**Semver impact: Minor** — The merge behavior, new default input map, focus gating, and touch support are additive. Existing scenes that declare `<InputController>` without `mode` get merge behavior by default, which adds defaults that were not previously present. This is a behavioral change but not an API-level breaking change.

**Behavioral changes requiring documentation:**
- Default camera orbit changed from left-drag to Cmd/Ctrl+scroll (desktop) and 2-finger drag (mobile). Existing deployments relying on left-drag orbit from defaults must add an explicit left-drag action or use `mode="replace"`.
- Keyboard events are now focus-gated in `ScrollStage`. A stage that does not have focus will not respond to keyboard input.
- `scope="window"` now actually works (previously was dead code).

**Escape hatch:** `mode="replace"` restores the old behavior of full override.

Future breaking change risk:
- `InputActionType` is an open string union. Adding named values is backward-compatible.
- `InputActionSpec.maps` using a discriminated union on `kind` is flexible — new `kind` values are additive.
- `mergeMode` and `touches` are optional fields — no existing code breaks.

---

## 10. Dependencies

- **React** (peer dependency): `React.useEffect`, `React.createContext`, `React.useContext`.
- **@brewsite/core internal**: `EngineStateContext`, `SceneTrackTick`, `SceneFrame`, `SceneInputControllerSpec`, `InputActionSpec`, compiler node handler registry, `CameraWidget`, `WidgetRegistry`.
- **No new external dependencies.**

---

## 11. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Non-passive wheel listener causes browser performance warning | DevTools noise; potential jank | Accept the warning; document it; unavoidable for camera control |
| Default input map change surprises existing consumers | Left-drag orbit no longer works by default | CHANGELOG documents the change; `mode="replace"` escape hatch; explicit left-drag orbit is a one-line merge override |
| Focus stealing on hover interferes with page forms | Unexpected focus changes | Auto-focus only fires for `pointerType === 'mouse'`, only when stage does not already contain focused element, uses `preventScroll: true` |
| iOS 3-finger gesture conflict | Pan gesture unreliable on iPad | 3-finger is best-effort; authors can override `default-camera-pan`; primary interactions (1-2 finger) are unaffected |
| Touch gesture classifier misclassifies | Pinch-vs-drag ambiguity | 10px distance-change threshold before committing; matches native iOS gesture behavior |
| Merge mode adds unexpected defaults | Scene gets orbit/zoom it did not intend | Authors can use `mode="replace"` for full control; merged defaults are universally expected behaviors |
| Plugin extension context not provided | Plugin action handlers silently not registered | `InputCoordinator` logs a development warning when compiled spec contains unknown action types and extension context is null |

---

## 12. Open Questions

- Should `InputActionType` be a TypeScript `enum` rather than a string union? Current position: string union. Enum would be a breaking change.
- Should per-scene `pixelsPerScene` be supported in `ScrollStage`? Current: global only via prop. Per-scene scroll weights are handled by `ProgressManager` instead.
- Should `ActionInputController` be exposed as a public API for consumers who want imperative action handling? Currently internal.

---

## 13. Launch Criteria

- `ActionInputController` has unit tests covering: action routing for drag, wheel, pinch, click, and key events; modifier key matching; wheel lock activation/idle timeout; sticky axis lock behavior; `onUnclaimedWheel` callback invocation; `touches` matching and centroid drag.
- `InputController` and `Action` DSL compilation has unit tests covering: spec extraction, `type` validation, merge mode propagation, and invalid children warning.
- Default input spec has unit tests verifying: no unmodified WheelMap, no left-drag pointer, meta+wheel orbit, shift+wheel pan, pinch zoom, 2-finger touch orbit, 3-finger touch pan.
- Pure extracted modules (`inertiaAccumulator`, `axisArbiter`, `carouselStepper`, `inputSpecMerger`, `scopeResolver`) each have comprehensive unit tests.
- Default keyboard navigation injection and merge with scene-authored specs are covered by compiler tests.
- At least one example scene in `apps/examples/` demonstrates merge mode with custom overrides alongside defaults.
- `InputActionSpec`, `InputActionType`, `InputActionMap`, `InputPointerMap`, `InputWheelMap`, `InputPinchMap`, `InputKeyMap`, `SceneInputControllerSpec`, `InputSpecMergeMode`, `ActionInputController`, and `InputCoordinator` are all exported from `packages/core/src/index.ts`.
- `CHANGELOG.md` entry written for the release.
- `pnpm build:lib` passes with zero TypeScript errors.
- `pnpm test` passes for `@brewsite/core` with coverage targets met for all files in `src/input/`.
