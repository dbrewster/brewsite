---
title: "BrewSite Core — Input System"
doc_type: prd
status: active
owner: brewsite-product-manager
last_updated: 2026-03-07
change_history:
  - date: 2026-03-07
    author: "Toolkit Product"
    summary: "Core cleanup: InputActionType is now a fully open string union. The diagram-canvas.* action types (diagram-canvas.move, diagram-canvas.rotate, diagram-canvas.reset, diagram-canvas.focus) have been removed from core's InputActionType and are now string literals owned and dispatched by @brewsite/diagram. The canvas.focus named value has been removed from core's union (diagram-canvas.focus in @brewsite/diagram replaces it). Two new named values added: 'scene.next' and 'scene.prev' for programmatic scene navigation. ActionInputController no longer contains diagram-canvas.* dispatch logic — that lives in @brewsite/diagram. The canvas.pan undocumented alias remains in core as a documented named value."
  - date: 2026-03-02
    author: "Toolkit Product"
    summary: "Core customization unblocking implemented: inputModePolicy (auto/prefer-scroll/prefer-direct), ScrollSource (window or element ref), controlled-mode keyboard opt-in, ActionInputController idDefaults (primary camera/canvas), and deprecation warnings for legacy implicit IDs."
  - date: 2026-02-28
    author: "Toolkit Product"
    summary: "Initial PRD created. Documents the full input system for @brewsite/core: SceneNavInputMap for scene navigation, InputController DSL for action-mapped input, ActionInputController runtime, useEngineInput hook, wheelGuard, keyboard defaults, and composability model."
---

# BrewSite Core — Input System

## 1. Overview

The Input system handles two distinct concerns: navigating between scenes (advancing and retreating through the scroll-driven composition) and dispatching named actions to widgets (camera orbit, dolly, custom consumer-defined effects). These two concerns are implemented as independent, composable subsystems that can operate simultaneously without conflict.

The first subsystem, **scene navigation**, is configured through `SceneNavInputMap` — a typed configuration object passed to `useEngineInput`. It maps wheel, drag, swipe, click, and keyboard events to scene advancement and retreat, operating in either scroll mode (synchronized with page scroll position) or direct mode (canvas-local pointer events with no scroll spacer).

The second subsystem, **action input**, is authored through the `InputController` and `Action` DSL components compiled into the `SceneTrack`. At runtime, `ActionInputController` reads the baked action map and routes pointer, wheel, pinch, and keyboard events to registered named-action handlers on widgets.

Affects: `@brewsite/core`.

---

## 2. Problem Statement

BrewSite scenes are designed to be experienced in two fundamentally different contexts: full-page scroll-driven presentations (where the user scrolls a long page and the scene animates in response) and embedded canvas-local experiences (where a player is embedded in a product page and navigation is self-contained). Both patterns are common, and neither is universally correct.

Additionally, 3D scenes with interactive diagrams require pointer-driven camera control — orbit, dolly, pan — that must coexist with scene navigation without conflict. A user dollying into a diagram should not accidentally advance to the next scene. A user scrolling down the page should not inadvertently orbit the camera.

Without a well-designed input system that handles these concerns explicitly, every consumer who embeds a BrewSite scene implements custom event handling: re-inventing scroll-to-progress mapping, writing conflict detection between camera interaction and navigation, and manually managing event listener cleanup. The Input system eliminates this duplication with a typed, composable API that handles the common cases without preventing customization.

---

## 3. Goals & Success Metrics

**Primary Goals:**
- A consumer can configure scroll-driven scene navigation in scroll mode or direct mode with a single typed configuration object.
- Camera orbit/dolly interactions configured through `InputController` DSL never accidentally trigger scene navigation.
- All event listeners are properly cleaned up on player unmount with no memory leaks.
- Keyboard navigation defaults work out of the box with no configuration.

**Success Metrics:**
- A developer unfamiliar with the toolkit can configure scroll navigation, keyboard navigation, and camera orbit input for a scene in under 20 minutes using only TypeScript types and the examples app.
- Zero event listener leaks verified by a manual browser devtools audit after mount/unmount cycle.
- The `wheelGuard` mechanism demonstrably prevents scene advancement while the user is dollying the camera.
- `useEngineInput` hook returns a stable `cleanup` function reference that does not change between renders.

**Guardrail Metrics:**
- No change to `SceneNavInputMap`, `SceneInputControllerSpec`, or `InputActionSpec` causes a major semver bump without a migration path.
- Existing `apps/examples/` scenes with input configuration continue to function correctly after any input system change.

---

## 4. Non-Goals

- **Gamepad / controller input** — gamepad API support is not in scope for the initial input system.
- **Multi-touch gesture recognition beyond pinch** — two-finger rotation, three-finger swipe, and other complex gestures are not addressed.
- **Custom input bindings UI** — no toolkit-provided UI for remapping keys or buttons at runtime.
- **Input recording and playback** — no mechanism to record input sequences for testing or demos.
- **Focus management for accessibility** — ARIA focus handling and screen reader compatibility are not addressed by the input system; they are a host application responsibility.
- **Mobile-specific swipe navigation configuration** — the `SwipeConfig` type provides basic threshold tuning, but comprehensive mobile UX optimization (inertia scrolling, rubber-band effects) is not in scope.
- **Pointer lock for orbit control** — pointer lock API is not used; delta-based orbit does not require it.

---

## 5. Consumer Stories

- As a toolkit consumer, I want to use standard page scroll to drive my scene animation so that visitors experience the content as a natural scroll journey.
- As a toolkit consumer, I want to embed a BrewSite player in a product page without hijacking the page scroll so that the canvas-local experience is self-contained.
- As a toolkit consumer, I want arrow key navigation to work by default without any configuration so that keyboard users can navigate scenes.
- As a toolkit consumer, I want to configure camera orbit and dolly through DSL so that users can explore 3D diagrams interactively.
- As a toolkit consumer, I want camera orbit and page scroll navigation to never conflict so that the experience is predictable.
- As a toolkit consumer, I want to define custom named actions in DSL and handle them in my consumer widgets so that I can extend input behavior without forking the toolkit.
- As a toolkit consumer, I want all event listeners to be cleaned up automatically when I unmount the player so that I do not debug memory leaks from abandoned listeners.

---

## 6. Functional Requirements

1. `useEngineInput` shall attach event listeners according to the provided `SceneNavInputMap` configuration and return a `cleanup()` function that removes all listeners when called.
2. In scroll mode, `useEngineInput` shall inject a spacer element with height `pixelsPerScene * numScenes` into the DOM and map `window.scrollY` to scene progress.
3. In direct mode, `useEngineInput` shall attach wheel and pointer listeners to the canvas element only and shall not inject any spacer element.
4. The `SceneNavInputMap.keys` configuration shall default to `{ next: ['ArrowRight', 'Period'], prev: ['ArrowLeft', 'Comma'], first: ['Home'], last: ['End'] }` when not specified and keyboard navigation is not explicitly disabled.
5. The `InputController` DSL component shall compile to a `SceneInputControllerSpec` stored in `SceneFrame.inputController` at each frame where the scene is active.
6. The `ActionInputController` shall read `SceneFrame.inputController` at each tick and register event handlers for each `Action` declared.
7. The `wheelGuard` mechanism shall prevent scene navigation wheel events from firing while an `'camera.dolly'` action is in progress; the guard shall activate on the first wheel event matching the dolly action and deactivate when the wheel idle timeout expires.
8. Each `InputActionSpec` shall route matching events to the handler registered for `onAction` on the current `ActionInputController`.
9. Custom `onAction` strings (not in `InputActionType`) shall be routed to handlers registered by consumer widgets via `ActionInputController.registerHandler(actionType, handler)`.
10. The `EngineInputRegion` component shall wrap the canvas and attach all necessary DOM event listeners for the `ActionInputController`.
11. Modifier key matching in `PointerMap.key` and `WheelMap.key` shall be evaluated from the event's `ctrlKey`, `metaKey`, `altKey`, and `shiftKey` properties. `'none'` means no modifier key is pressed.
12. `InputController` scope `'canvas'` shall attach listeners to the canvas element. Scope `'window'` shall attach listeners to the `window` object.
13. The `DragConfig.axis` setting shall restrict scene navigation to the specified axis: `'y'` responds only to vertical drag, `'x'` only to horizontal, `'both'` to either.
14. All event listeners registered by `useEngineInput` and `ActionInputController` shall use `{ passive: false }` for wheel events to allow `preventDefault()` when needed, and `{ passive: true }` for pointer events that do not require prevention.

---

## 7. API Design

### 7.1 Scene Navigation Types (`input/types.ts`)

```typescript
export type SceneNavMode = 'scroll' | 'direct';

export interface WheelConfig {
  sensitivity?: number;       // scene progress delta per wheel pixel; default 0.001
  threshold?: number;         // minimum delta before registering input; default 0
}

export interface DragConfig {
  axis?: 'x' | 'y' | 'both'; // drag axis that drives navigation; default 'y'
  sensitivity?: number;       // scene progress delta per drag pixel; default 0.005
  threshold?: number;         // minimum drag distance before registering; default 4
  invert?: boolean;           // invert drag direction; default false
}

export interface SwipeConfig {
  sensitivity?: number;       // velocity multiplier for swipe recognition; default 1
  threshold?: number;         // minimum pointer velocity (px/ms) to count as swipe; default 0.5
}

export interface ClickConfig {
  advanceOnClick?: boolean;   // any click on the canvas advances one scene; default false
}

export interface SceneNavKeys {
  next?: string[];            // KeyboardEvent.key values; default ['ArrowRight', 'Period']
  prev?: string[];            // default ['ArrowLeft', 'Comma']
  first?: string[];           // default ['Home']
  last?: string[];            // default ['End']
}

export interface SceneNavInputMap {
  mode?: SceneNavMode;        // default 'scroll'
  wheel?: WheelConfig | false;    // false disables wheel navigation
  drag?: DragConfig | false;      // false disables drag navigation
  swipe?: SwipeConfig | false;    // false disables swipe navigation
  click?: ClickConfig | false;    // false disables click navigation
  keys?: SceneNavKeys | false;    // false disables keyboard navigation
  pixelsPerScene?: number;        // scroll height per scene in px (scroll mode only); default 800
}
```

### 7.2 InputNavigationHandler Interface (`input/types.ts`)

```typescript
export interface InputNavigationHandler {
  onProgress: (delta: number) => void;    // additive delta to current progress
  onJumpToScene: (index: number) => void; // jump to exact scene index
  getProgress: () => number;              // current progress [0, numScenes]
  getSceneCount: () => number;            // total number of scenes
}
```

The `ScenePlayer` passes a conforming `InputNavigationHandler` to `useEngineInput`. This decouples the input system from the player's specific state management.

### 7.3 useEngineInput Hook (`input/useEngineInput.ts`)

```typescript
export interface UseEngineInputOptions {
  handlers: InputNavigationHandler;
  config?: SceneNavInputMap;
  canvasRef: React.RefObject<HTMLElement>;
  wheelGuardRef?: React.MutableRefObject<boolean>;
}

export interface UseEngineInputResult {
  cleanup: () => void;
}

export function useEngineInput(options: UseEngineInputOptions): UseEngineInputResult
```

`useEngineInput` is called once in `ScenePlayer` and its cleanup is registered with `useEffect`'s return function. It does not re-register listeners on re-render unless `config` changes (referential equality check).

### 7.4 InputController DSL (`compiler/blocks/inputController.tsx`)

```typescript
export type InputControllerScope = 'canvas' | 'window';

export interface InputControllerProps {
  scope?: InputControllerScope;   // default 'canvas'
  children: React.ReactNode;      // must be <Action> elements only
}

export function InputController(props: InputControllerProps): null

export interface ActionProps {
  drag?: PointerMap;
  click?: PointerMap;
  wheel?: WheelMap;
  pinch?: PinchMap;
  key?: KeyMap;
  onAction: InputActionType;
}

export function Action(props: ActionProps): null
```

DSL usage:

```tsx
<Scene id="product-diagram">
  <InputController scope="canvas">
    <Action
      drag={{ button: 0 }}
      onAction="camera.orbit"
    />
    <Action
      wheel={{ key: 'none' }}
      onAction="camera.dolly"
    />
    <Action
      drag={{ button: 1 }}
      onAction="camera.pan"
    />
    <Action
      key={{ code: 'KeyR' }}
      onAction="camera.reset"
    />
    <Action
      click={{ button: 0, key: 'ctrl' }}
      onAction="canvas.focus"
    />
  </InputController>
</Scene>
```

### 7.5 Event Map Types (`input/types.ts`)

```typescript
export type ModifierKey = 'ctrl' | 'meta' | 'alt' | 'shift' | 'none';

export interface PointerMap {
  button?: 0 | 1 | 2;       // MouseEvent.button; default 0
  key?: ModifierKey;         // required modifier; default 'none'
}

export interface WheelMap {
  key?: ModifierKey;         // required modifier; default 'none'
  axis?: 'x' | 'y' | 'both'; // wheel axis to respond to; default 'both'
}

export interface PinchMap {
  minDistance?: number;      // minimum touch point separation to activate; default 10
}

export interface KeyMap {
  code: string;              // KeyboardEvent.code value (e.g., 'KeyR', 'Space')
  key?: ModifierKey;         // required modifier; default 'none'
}
```

### 7.6 InputActionType (`input/types.ts`)

```typescript
export type InputActionType =
  | 'camera.orbit'  // pointer delta → CameraWidget orbit handler
  | 'camera.dolly'  // wheel/pinch delta → CameraWidget dolly handler
  | 'camera.reset'  // key → CameraWidget reset handler
  | 'canvas.pan'    // pointer delta → canvas pan handler
  | 'scene.next'    // advance to the next scene
  | 'scene.prev'    // retreat to the previous scene
  | (string & {}); // open union — downstream packages add their own action strings
```

The `(string & {})` pattern maintains TypeScript autocomplete for the named values while allowing arbitrary string literals for consumer-defined actions. `@brewsite/diagram` defines its own `diagram-canvas.*` action strings (e.g. `'diagram-canvas.move'`, `'diagram-canvas.rotate'`, `'diagram-canvas.reset'`, `'diagram-canvas.focus'`) as local constants — these are not part of `@brewsite/core`'s named value set.

### 7.7 Compiled Action Spec Types (`input/types.ts`)

```typescript
export interface InputActionSpec {
  drag?: PointerMap;
  click?: PointerMap;
  wheel?: WheelMap;
  pinch?: PinchMap;
  key?: KeyMap;
  onAction: InputActionType;
}

export interface SceneInputControllerSpec {
  scope: InputControllerScope;
  actions: InputActionSpec[];
}
```

### 7.8 ActionInputController (`input/ActionInputController.ts`)

```typescript
export type ActionHandler = (event: ActionEvent) => void;

export interface ActionEvent {
  type: 'drag' | 'click' | 'wheel' | 'pinch' | 'key';
  delta?: Vec2;              // pointer delta for drag; wheel delta for wheel
  scale?: number;            // pinch scale factor
  position?: Vec2;           // pointer screen position for click
  rawEvent: Event;           // original DOM event for advanced use cases
}

export class ActionInputController {
  constructor(
    element: HTMLElement,
    spec: SceneInputControllerSpec
  )

  registerHandler(actionType: InputActionType, handler: ActionHandler): () => void
  unregisterHandler(actionType: InputActionType): void
  setSpec(spec: SceneInputControllerSpec): void   // called each tick to update from SceneTrack
  setWheelGuard(guard: React.MutableRefObject<boolean>): void
  dispose(): void
}
```

`ActionInputController` is instantiated once per `EngineInputRegion` mount. Its `setSpec()` method is called each frame tick with the current `SceneFrame.inputController` value, allowing the active action map to change as scenes transition without recreating the controller or re-attaching DOM listeners.

### 7.9 EngineInputRegion Component (`player/EngineInputRegion.tsx`)

```typescript
export interface EngineInputRegionProps {
  children: React.ReactNode;
  onAction?: (event: ActionEvent) => void;  // optional catch-all for consumer interception
}

export function EngineInputRegion(props: EngineInputRegionProps): React.ReactElement
```

`EngineInputRegion` wraps the canvas element and manages the `ActionInputController` lifecycle. It reads the current `SceneFrame.inputController` from `EngineStateContext` and calls `controller.setSpec()` each tick.

### 7.10 wheelGuard

```typescript
// Internal ref passed from ScenePlayer to both useEngineInput and ActionInputController
const wheelGuardRef = React.useRef<boolean>(false);
```

When `'camera.dolly'` is the matched action for a wheel event, `ActionInputController` sets `wheelGuardRef.current = true` and starts a 300ms debounce timer. On timer expiry, it sets `wheelGuardRef.current = false`. `useEngineInput`'s wheel handler checks `wheelGuardRef.current` before advancing scenes — if `true`, the wheel delta is consumed by the dolly action and does not also advance the scene.

The guard is a `ref` (not state) so that checking it in an event handler closure captures the mutable value without stale closure issues.

---

## 8. Technical Considerations

### 8.1 Scroll Mode Spacer

In scroll mode, `useEngineInput` injects a `div` spacer element into the DOM after the player's container. The spacer height is `pixelsPerScene * numScenes`. `window.scrollY` is mapped to progress using:

```typescript
const progress = window.scrollY / (pixelsPerScene * (numScenes - 1));
```

The spacer is removed in the cleanup function. If the host application controls scroll restoration (e.g., SPA routing), the consumer must call `window.scrollTo(0, 0)` on route change; the toolkit does not manage scroll position restoration.

### 8.2 Event Listener Passive Flags

Wheel events on the canvas require `{ passive: false }` to allow `preventDefault()` when the user is dollying the camera. Without `preventDefault()`, the browser may also scroll the page while the user is performing a camera dolly. This is a deliberate non-passive listener that the browser's devtools may flag as a performance warning; the warning is acceptable and expected for interactive 3D scenes.

All pointer events use `{ passive: true }` since BrewSite does not call `preventDefault()` on pointer events.

### 8.3 InputController DSL Compilation

The `InputController` and `Action` components are null-returning React functions. Their props are extracted by the compiler's node handler for `'InputController'` and `'Action'` node types. The compiler traverses the `InputController`'s `children` to extract `Action` specs and assembles a `SceneInputControllerSpec`, which is stored in `SceneFrame.inputController`.

The compiler validates that:
- All `InputController` children are `Action` elements (emits a warning for unrecognized children).
- Each `Action` specifies exactly one of `drag`, `click`, `wheel`, `pinch`, or `key`.
- `onAction` is a non-empty string.

### 8.4 SceneInputControllerSpec Change Detection

`ActionInputController.setSpec()` is called every frame tick with the current spec. To avoid unnecessary event listener re-registration, the implementation compares the incoming spec to the previously active spec using deep equality. If the spec has not changed (same scope, same action array), `setSpec()` is a no-op.

### 8.5 ModifierKey Matching

Modifier key matching evaluates `event.ctrlKey || event.metaKey` for `'ctrl'` on macOS (where Cmd key is `metaKey`). This is intentional platform normalization — `'ctrl'` in a `PointerMap` or `WheelMap` matches the platform's primary modifier key, not specifically the Ctrl key. Scene authors should use `'ctrl'` to mean "use the platform modifier" and `'meta'` only when they specifically need the Windows key or Cmd key exclusive of Ctrl.

### 8.6 Pinch-to-Dolly on Touch Devices

`PinchMap` is recognized through `pointerdown` / `pointermove` events on touch devices by tracking two simultaneous pointer IDs. The `ActionInputController` maintains a `Map<number, PointerEvent>` of active pointer events. When two pointers are active and moving, it computes the distance change between them and dispatches an `ActionEvent` with `type: 'pinch'` and `scale` equal to the ratio of current to initial distance. Single-pointer drag and two-pointer pinch are mutually exclusive within one gesture.

### 8.7 Direct Mode and Scroll Conflict

In direct mode, `useEngineInput` does not inject a scroll spacer and does not listen to `window.scroll`. Instead, wheel events on the canvas element advance scenes if no `wheelGuard` is active. This is appropriate for embedded players in longer pages where the user should be able to scroll past the player without the player consuming the scroll.

The consumer must ensure the host page's scroll container does not also capture wheel events from the canvas. If the canvas is inside a scrollable div, both the div's scroll and the BrewSite direct-mode handler will fire. The consumer is responsible for setting `overflow: hidden` on the canvas container if direct mode is the intended interaction model.

### 8.8 Compiler Pipeline Integration

`InputController` and `Action` are registered in the compiler's node handler registry alongside `Scene`, `Model`, `Camera`, and other DSL nodes. The handler is registered in `compiler/index.ts` as part of the built-in handler set. No changes to the compiler's core pipeline are required — these handlers follow the same registered-handler pattern as all other DSL nodes.

---

## 9. Breaking Change Assessment

**Semver impact: Minor** for initial introduction of the full input system.

No existing public API is modified. `SceneNavInputMap`, `InputNavigationHandler`, `useEngineInput`, `InputController`, `Action`, `SceneInputControllerSpec`, `InputActionSpec`, `InputActionType`, `ActionInputController`, and `EngineInputRegion` are all new exports.

Future breaking change risk:

- `InputActionType` is an open string union. Adding new named values to the union is backward-compatible. Removing named values is a major change. The current set (`camera.orbit`, `camera.dolly`, `camera.reset`, `canvas.pan`, `scene.next`, `scene.prev`) is deliberately small; new actions should be added conservatively. The `canvas.focus` value was removed and replaced by `diagram-canvas.focus` in `@brewsite/diagram` — any consumer that was listening for `canvas.focus` must migrate.
- `SceneNavInputMap` adding new optional fields is backward-compatible. Removing or renaming existing fields is a major change.
- `ActionEvent.rawEvent` typed as `Event` (not the specific event subtype) leaves room to narrow this type in a future minor release by making `rawEvent` a discriminated union keyed by `ActionEvent.type`. This is a backward-compatible narrowing.
- The `wheelGuard` mechanism is an internal ref pattern. It is not part of the public API. Consumers cannot configure the guard timeout (300ms). If this timeout needs to be configurable in the future, adding an optional `dollyGuardTimeout` field to `SceneNavInputMap` is a minor additive change.

---

## 10. Dependencies

- **React** (peer dependency): `React.useRef`, `React.useEffect`, `React.MutableRefObject`, `React.RefObject`.
- **@brewsite/core internal**: `EngineStateContext`, `SceneTrackTick`, `SceneFrame`, `SceneInputControllerSpec`, `InputActionSpec`, compiler node handler registry, `CameraWidget`, `WidgetRegistry`.
- **No new external dependencies.**

---

## 11. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Non-passive wheel listener causes browser performance warning | DevTools noise; potential jank | Accept the warning; document it in README; it is unavoidable for interactive dolly control |
| Scroll spacer not removed on unmount | Page layout broken after player unmount | Assert spacer removal in cleanup tests; use `useEffect` cleanup guarantee |
| wheelGuard debounce timeout too short | Wheel dolly accidentally triggers scene advance | Default 300ms is conservative; expose `dollyGuardTimeout` as a future minor additive option |
| Ctrl/Meta normalization confuses consumers on Windows | Cmd-specific bindings broken | Document the normalization; expose `'meta'` as an explicit ModifierKey for Cmd/Win key exclusive use |
| `setSpec()` deep equality check is expensive with large action arrays | Unnecessary CPU cost per frame | Action arrays are small (< 10 items); deep equality is cheap; profile before optimizing |
| Two pointer events from same touch source create false pinch | Unintended dolly on multi-touch screens | Track pointer IDs strictly; require `pointerType === 'touch'` for pinch recognition |
| Direct mode wheel events propagate to page scroll | Consumer page scrolls while user dollies camera | Provide `stopPropagation()` guidance in README; do not call `preventDefault()` on page scroll-capable elements without explicit consumer opt-in |

---

## 12. Open Questions

- Should `SceneNavInputMap.pixelsPerScene` be configurable per scene (different scenes have different scroll distances) or globally only? Current position: global only. Per-scene scroll distances would require a variable-height spacer and more complex scroll mapping logic. Deferred.
- Should the `EngineScrollRegion` component be merged with `EngineInputRegion` into a single `EngineInteractionRegion`? The two are currently separate because scroll mode and direct mode have different DOM requirements. Merging them would reduce the consumer's integration surface. This is an API ergonomics question that should be evaluated after seeing consumer integration patterns.
- Should `InputActionType` be a TypeScript `enum` rather than a string union? Enums provide better autocomplete in some editors and prevent typo-based bugs. However, string unions are more ergonomic for the open extension case (`(string & {})`). Current position: string union. Enum would be a future breaking change if adopted.
- Should the `ActionInputController` be exposed as a public API for consumers who want to configure action handlers outside the widget system? Currently it is an internal implementation detail. If consumers need imperative access to the action controller (e.g., for A/B testing different action bindings), a `useActionController()` hook would be the appropriate additive API.

---

## 13. Launch Criteria

- `useEngineInput` has unit tests covering: scroll mode progress mapping from `scrollY` values, direct mode wheel delta to progress conversion, keyboard navigation for all default bindings, and cleanup function removes all listeners.
- `ActionInputController` has unit tests covering: action routing for drag, wheel, pinch, click, and key events; modifier key matching for all `ModifierKey` values; `wheelGuard` activation and deactivation; and `setSpec()` no-op on unchanged spec.
- `InputController` and `Action` DSL compilation has unit tests covering: spec extraction, `onAction` validation, and invalid children warning.
- Wheel guard integration test: verifies that a wheel event matching `'camera.dolly'` prevents the scene navigation wheel handler from firing.
- At least one example scene in `apps/examples/` demonstrates `InputController` with `camera.orbit`, `camera.dolly`, and `camera.reset` actions configured.
- `SceneNavInputMap`, `InputNavigationHandler`, `useEngineInput`, `InputController`, `Action`, `InputActionSpec`, `InputActionType`, `ActionEvent`, `SceneInputControllerSpec`, `EngineInputRegion`, and `EngineScrollRegion` are all exported from `packages/core/src/index.ts`.
- `packages/core/README.md` documents both input subsystems with usage examples for scroll mode and direct mode.
- `CHANGELOG.md` entry written for the release.
- `pnpm build:lib` passes with zero TypeScript errors.
- `pnpm test` passes for `@brewsite/core` with coverage targets met for all files in `src/input/`.
