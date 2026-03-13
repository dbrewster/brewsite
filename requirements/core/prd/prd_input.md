---
title: "BrewSite Core — Input System"
doc_type: prd
status: active
owner: brewsite-product-manager
last_updated: 2026-03-13
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
---

# BrewSite Core — Input System

## 1. Overview

The Input system handles two distinct concerns: navigating between scenes (advancing and retreating through the composition) and dispatching named actions to widgets (camera orbit, dolly, diagram canvas interaction, carousel stepping). These two concerns are implemented as independent, composable subsystems that operate simultaneously without conflict.

**Scene navigation** is handled by composable input components and layout primitives:
- `ScrollStage` — full-page scroll drives scene progress via native `window.scrollY` with spring-physics inertia.
- `KeyboardInput` — focus management for keyboard navigation. Default keyboard bindings (`scene.next` on ArrowRight/ArrowDown, `scene.prev` on ArrowLeft/ArrowUp) are compiler-injected when no `<InputController>` is authored.
- `TimeInput` — wall-clock auto-advance with configurable duration, loop, and pause-when-hidden.
- `ControlledInput` — external `value` prop drives progress directly.

**Action input** is authored through the `<InputController>` and `<Action>` DSL components compiled into the `SceneTrack`. At runtime, `ActionInput` (a React component) reads the baked action spec and wires it to `ActionInputController`, which routes pointer, wheel, pinch, and keyboard events to registered named-action handlers on widgets.

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
3. The `wheelGuard` mechanism shall prevent scene navigation wheel events from firing while a `'camera.dolly'` action is in progress.
4. Each `InputActionSpec` shall route matching events to the handler registered for `type` on the current `ActionInputController`.
5. Custom action type strings (not in the named `InputActionType` set) shall be routed to handlers registered by consumer widgets or plugin extensions.
6. The `ActionInput` React component shall bridge compiled `<InputController>` DSL to the `ActionInputController` runtime. It renders no DOM — it is a pure React effect that reads the current spec from context and wires event listeners.
7. `KeyboardInput` shall provide focus management for keyboard events. Default keyboard navigation (`scene.next` on ArrowRight/ArrowDown, `scene.prev` on ArrowLeft/ArrowUp) is compiler-injected by the engine when no `<InputController>` is authored in any scene.
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
  | 'camera.dolly'      // wheel/pinch delta → CameraWidget dolly handler
  | 'camera.reset'      // key → CameraWidget reset handler
  | 'canvas.pan'        // pointer delta → canvas pan handler
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
      type="camera.dolly"
      maps={[{ kind: 'wheel' }, { kind: 'pinch' }]}
    />
    <Action
      type="camera.reset"
      maps={[{ kind: 'key', key: 'r' }]}
    />
    <Action
      type="canvas.pan"
      maps={[{ kind: 'pointer', event: 'drag', button: 'middle' }]}
    />
  </InputController>
</Scene>
```

### 7.5 ActionInputController (`input/ActionInputController.ts`)

```typescript
export class ActionInputController {
  constructor(element: HTMLElement, spec: SceneInputControllerSpec)

  registerHandler(actionType: InputActionType, handler: ActionHandler): () => void
  unregisterHandler(actionType: InputActionType): void
  setSpec(spec: SceneInputControllerSpec): void
  dispose(): void
}
```

`ActionInputController` is instantiated by the `ActionInput` React component. Its `setSpec()` method is called each frame tick with the current `SceneFrame.inputController` value, allowing the active action map to change as scenes transition without recreating the controller.

### 7.6 ActionInput Component (`player/ActionInput.tsx`)

```typescript
export function ActionInput(): null;
```

`ActionInput` is a null-rendering React component that bridges the compiled `<InputController>` DSL to the `ActionInputController` runtime. It:

1. Reads the current `SceneInputControllerSpec` from `EngineStateContext`.
2. Creates an `ActionInputController` bound to the canvas element.
3. Registers built-in action handlers for `camera.orbit`, `camera.dolly`, `camera.reset`, `canvas.pan`, `scene.next`, `scene.prev`, `carousel.next`, `carousel.prev`.
4. Calls `controller.setSpec()` on each tick.
5. Reads `ActionInputExtensionContext` to wire plugin-provided action handlers (e.g., `diagram-canvas.*` from `@brewsite/diagram`).
6. Disposes the controller on unmount.

### 7.7 Default Keyboard Navigation

When no scene in the composition authors an `<InputController>`, the compiler injects a default action spec:

```typescript
// Compiler-injected defaults (not authored in DSL)
[
  { id: '__default_next', type: 'scene.next', maps: [
    { kind: 'key', key: 'ArrowRight' },
    { kind: 'key', key: 'ArrowDown' },
  ]},
  { id: '__default_prev', type: 'scene.prev', maps: [
    { kind: 'key', key: 'ArrowLeft' },
    { kind: 'key', key: 'ArrowUp' },
  ]},
]
```

This ensures scenes are keyboard-navigable by default without any DSL authoring.

### 7.8 ActionInputExtensionContext

Plugin packages extend the action dispatch system via `ActionInputExtensionContext`:

```typescript
export type ActionInputExtension = {
  registerHandlers(controller: ActionInputController): () => void;
};

export const ActionInputExtensionContext = React.createContext<ActionInputExtension | null>(null);
```

`diagramPlugin.getActionInputExtension()` returns an extension that registers handlers for `diagram-canvas.move`, `diagram-canvas.rotate`, `diagram-canvas.reset`, and `diagram-canvas.focus` — routing them to `DiagramWidget.applyCanvasAction()`.

### 7.9 Scene Navigation Components

| Component | Purpose |
|---|---|
| `ScrollStage` | Full-page scroll layout. Drives progress from native `window.scrollY` with spring-physics inertia. Renders a sticky-canvas container. |
| `KeyboardInput` | Focus management for keyboard events. Does NOT own key-to-action routing — that is handled by `ActionInput` via compiled `InputActionSpec`. |
| `TimeInput` | Wall-clock auto-advance with configurable `duration`, `loop`, and `pauseWhenHidden`. Yields to user input. |
| `ControlledInput` | External `value` prop drives progress. Highest priority — overrides all other input. |

### 7.10 wheelGuard

When `'camera.dolly'` is the matched action for a wheel event, `ActionInputController` activates a wheel guard that prevents scroll-based scene navigation from also consuming the wheel delta. The guard activates on the first wheel event matching the dolly action and deactivates after a debounce timeout. This prevents the user from inadvertently advancing scenes while dollying the camera.

The guard is an internal mechanism — not part of the public API.

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

### 8.6 Action Spec Change Detection

`ActionInputController.setSpec()` is called every frame tick. It compares the incoming spec to the previously active spec using deep equality. If unchanged, `setSpec()` is a no-op — no event listener re-registration occurs.

### 8.7 Sticky Axis Lock

`InputPointerMap.lockAxis: 'sticky'` chooses the dominant axis early in a drag gesture (within `lockThreshold` pixels of movement) and locks to that axis until `pointerup`. This enables natural orbit control on trackpads where the user initiates a horizontal orbit gesture — vertical jitter is suppressed.

---

## 9. Breaking Change Assessment

**Semver impact: Major** — v2 removed `useEngineInput`, `useEngineScroll`, `EngineInputRegion`, `ScrollCaptureSection`, `ScrollInput`, `PointerInput`, `SceneNavInputMap`, and `InputModePolicy`. These are all breaking deletions documented in `MIGRATION.md`.

The current API surface (`InputActionType`, `InputActionSpec`, `InputActionMap`, `SceneInputControllerSpec`, `ActionInputController`, `ActionInput`, `KeyboardInput`, `TimeInput`, `ControlledInput`, `ScrollStage`) is stable.

Future breaking change risk:
- `InputActionType` is an open string union. Adding new named values is backward-compatible. Removing named values is a major change.
- `InputActionSpec.maps` using a discriminated union on `kind` is flexible — new `kind` values are additive.
- `ActionInputExtensionContext` is an internal API consumed by plugin packages. Changes are breaking for plugin authors but not for scene authors.

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

- `ActionInputController` has unit tests covering: action routing for drag, wheel, pinch, click, and key events; modifier key matching; `wheelGuard` activation/deactivation; `setSpec()` no-op on unchanged spec; sticky axis lock behavior.
- `InputController` and `Action` DSL compilation has unit tests covering: spec extraction, `type` validation, and invalid children warning.
- Default keyboard navigation injection is covered by a compiler test.
- At least one example scene in `apps/examples/` demonstrates `InputController` with `camera.orbit`, `camera.dolly`, and `camera.reset` actions configured.
- `InputActionSpec`, `InputActionType`, `InputActionMap`, `InputPointerMap`, `InputWheelMap`, `InputPinchMap`, `InputKeyMap`, `SceneInputControllerSpec`, and `ActionInputController` are all exported from `packages/core/src/index.ts`.
- `CHANGELOG.md` entry written for the release.
- `pnpm build:lib` passes with zero TypeScript errors.
- `pnpm test` passes for `@brewsite/core` with coverage targets met for all files in `src/input/`.
