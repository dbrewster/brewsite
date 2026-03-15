---
title: "Input Navigation Defaults, Refinements & InputHud"
doc_type: prd
status: reviewed
owner: Toolkit Product
last_updated: 2026-03-15
change_history:
  - date: 2026-03-14
    author: "Toolkit Product"
    summary: "Initial PRD created. Covers: default input spec factory, scroll-X carousel routing, camera.dolly → camera.zoom rename, arrow key direction alignment, animation duration for event-triggered navigation, pan handler implementation, primaryCarouselId on Scene DSL, and the new InputHud overlay component. Consolidates findings from input system audit and carousel navigation design session."
  - date: 2026-03-14
    author: "Toolkit Product"
    summary: "Major revision. Removed all backward compatibility hedging — this is a clean-break release. camera.dolly is deleted (not deprecated). onCameraPan is required (not optional). defaultTransitionDuration defaults to 400ms. All resolved open questions removed. Added IGroupOwner removal as part of this work. Added §8.8 Architectural Constraints for implementers. Expanded launch criteria to explicitly include example migration, docs updates, and IGroupOwner cleanup."
  - date: 2026-03-14
    author: "PM-1 Review"
    summary: "Validated against codebase. Corrections: (1) §2 canvas.pan clarified — the type 'canvas.pan' exists in InputActionType but falls through to onUnknownAction, not silently ignored; this is a rename to 'camera.pan' + new handler, not just implementation of an unimplemented action. (2) §2 removed stale ChartWidget freeze guard claim — ChartWidget does not implement IGroupOwner and has no freeze guard. (3) §7.8/§8.8 corrected resolveChildRoot location from 'corePlugin.ts' to 'plugins.ts'. (4) §7.3 added 'canvas.pan' to the removed types list — it is being replaced by 'camera.pan'. (5) §9 breaking changes table updated to include canvas.pan → camera.pan rename."
  - date: 2026-03-15
    author: "PM-2 Clarifications"
    summary: "Three consistency/completeness fixes to the ViewWidget opacity design: (1) §7.8 corrected — removed stale 'scene-level transitions only' language that contradicted §8.8.7 after team lead directive; updated ViewWidget stub comment to reflect Option A. (2) §8.8.7 — Option B hedge removed; Option A is now declared required because compile-time opacity is categorically incapable of encoding runtime activeIndex changes. Rationale spelled out. (3) §12 — new open question added: compiler must resolve ViewLayout→child element relationships to populate childWidgetIds in ViewState; architect must confirm feasibility and specify the ViewState type extension."
  - date: 2026-03-15
    author: "Team Lead Directive"
    summary: "ViewWidget opacity scope restored to include carousel slide visibility. The PM debate deferral to CarouselTrack PRD was reversed — carousel scenes would have a visible regression until CarouselTrack shipped, which is unacceptable. §8.8.7 updated: ViewWidget is responsible for both scene-transition opacity and runtime activeIndex carousel slide visibility. §4 Non-Goals: carousel slide visibility deferral removed. §11 Risks: updated to reflect full scope and Option B validation requirement. §13 Launch Criteria: carousel slide visibility added as launch gate."
  - date: 2026-03-14
    author: "PM-1 + PM-2 Debate"
    summary: "Five debate resolutions: (1) §8.8.7 ViewWidget opacity scope narrowed to scene transitions only — carousel slide visibility deferred to CarouselTrack PRD. Option B removed as 'preferred'; decision is architect's within the scene-transition-only scope. (2) §8.6 camera.pan implementation fixed — hardcoded world-Y replaced with camera.up for correct pan under tilted cameras. (3) §8.2/§8.8.2 TransitionAnimator ownership moved from InputCoordinator to engine/player layer — InputCoordinator signals intent via engine.beginTransition()/interruptTransition(), engine owns the animation RAF. (4) InputHud component scoped out of this major release — ships as follow-on minor. onActionFired API, platformKeys utilities, and formatModifier stay in this release as foundation. §7.9, §8.5, §8.7, §8.8.5-6 updated. Launch criteria adjusted. (5) §8.2 scroll-interrupt scope clarified — only scroll Y interrupts scene transition animation; scroll X (carousel) does not."
---

# Input Navigation Defaults, Refinements & InputHud

## 1. Overview

This PRD specifies a cohesive set of changes to the `@brewsite/core` input system that establish correct, natural defaults for all navigation modalities, fill implementation gaps, remove the broken `IGroupOwner` interface, and lay the foundation for `InputHud` — a reusable developer-facing overlay component (shipping as a follow-on minor release) that renders the active input bindings derived directly from the compiled `SceneInputControllerSpec`. This major release includes the `onActionFired` event API, `platformKeys` utilities, and `formatModifier` function that InputHud will consume.

This is a **clean-break release**. No deprecated symbols. No migration paths for removed APIs. All first-party examples and documentation are updated as part of this work.

Affects: `packages/core/src/input/`, `packages/core/src/compiler/`, `packages/core/src/player/`, `packages/core/src/widget/`, `packages/core/src/elements/view/`, `packages/screens/src/elements/media-screen/`, `apps/examples/`.

---

## 2. Problem Statement

The input system has solid infrastructure (typed maps, modifier matching, priority waterfall, sticky axis lock) but suffers from compounding gaps:

**No natural defaults.** The compiler injects only two keyboard bindings (`ArrowRight`/`ArrowDown` = scene.next, `ArrowLeft`/`ArrowUp` = scene.prev) when no `<InputController>` is authored. Horizontal scroll, pinch-to-zoom, Cmd+scroll, orbit, pan, carousel arrow keys, and reset are all absent unless the scene explicitly declares them. Every consumer pays for it.

**Scroll X is inert.** Horizontal trackpad swipe produces `deltaX` events that are completely discarded by `InputCoordinator`. Carousel navigation should be driven by scroll X as its primary gesture, mirroring how scroll Y drives scene navigation. There is no X-axis inertia system.

**Event-triggered navigation has no animation.** Pressing an arrow key or clicking a nav button instantly jumps to the next scene's final tick. The compiled `SceneTrack` already contains all intermediate frames — the engine just isn't traversing them. The result feels abrupt.

**`camera.dolly` is jargon.** Scene authors and product teams do not know what "dolly" means. The action type is `camera.zoom`.

**`canvas.pan` is misnamed and unhandled.** The action type `'canvas.pan'` exists in `InputActionType` but falls through to `onUnknownAction` (no dedicated handler). The action should be `'camera.pan'` — panning is a camera operation, not a canvas operation. `ActionInputHandler` has no `onCameraPan` method. This PRD renames `canvas.pan` → `camera.pan` and adds the required handler.

**`IGroupOwner` is architecturally broken.** The interface lets ViewWidget reparent a widget's Three.js Group for carousel transforms. But every widget that implements it also computes its own world position from NVS state in `apply()` — creating double-positioning. ViewState is not animated through transitions (passthrough in the compiler's Step 4.5), so everything snaps at scene boundaries. MediaScreenWidget implements `IGroupOwner` and has this double-positioning exposure. DiagramWidget proves the standard NVS compilation path works without `IGroupOwner`. The interface is a trap that creates bugs.

**The input binding display is always hand-crafted.** Every input showcase scene contains bespoke `Kbd` components, `BindingRow` components, and category headers — all disconnected from the actual compiled spec. A core component that derives its content from the live spec is needed.

---

## 3. Goals & Success Metrics

**Goals:**
- `createDefaultInputSpec()` provides a zero-configuration binding set that feels natural on Mac trackpad, Windows trackpad, and mouse
- Scroll Y drives scene navigation; scroll X drives carousel navigation — both by default, with no authoring required
- Arrow keys follow axis convention: ↑/↓ for scenes (vertical scroll axis), ←/→ for carousel (horizontal scroll axis)
- Event-triggered navigation (arrow keys, button click) animates through the compiled SceneTrack at 400ms ease-in-out by default
- `camera.zoom` is the only zoom action type (no `camera.dolly`)
- `camera.pan` is fully implemented
- `IGroupOwner` is removed from the SDK; all elements follow the standard NVS compilation pattern
- `onActionFired` event API on `ActionInputController` enables live binding indicators for the follow-on `InputHud` component
- `formatModifier` / `formatInputMap` / `detectPlatform` utilities replace ad-hoc `pk()` helpers in first-party examples
- All first-party examples demonstrate the default bindings naturally

**Success Metrics:**
- A new example scene with no `<InputController>` authored feels natural to a first-time user on Mac and Windows
- Arrow key animation: pressing ↓ from any scene produces a smooth 400ms ease-in-out traversal of the SceneTrack to the next scene's start
- `MediaScreenWidget` in carousel scenes no longer double-positions or snaps
- All `apps/examples/` scenes updated and functioning correctly

---

## 4. Non-Goals

- Gamepad or controller input
- Multi-touch beyond two-finger pinch (no three-finger swipe, rotation gesture)
- Custom key rebinding UI at runtime
- Input recording or playback
- Pointer lock for orbit
- Scroll X driving continuous carousel progress (scroll X → discrete carousel steps with animation; continuous carousel progress is part of the separate CarouselTrack compilation PRD)
- `InputHud` React component implementation — ships as a follow-on minor release. This major includes the foundation: `onActionFired` event API, `platformKeys` utilities, `formatModifier`/`formatInputMap`/`detectPlatform` exports. The component itself is purely additive and should not block the major release.
- Fixing ViewState transition animation (that is the CarouselTrack PRD's scope; this PRD removes the broken workaround)

---

## 5. Consumer Stories

- As a toolkit consumer, I want scroll Y to drive scene navigation and scroll X to drive carousel navigation by default, so that the first meaningful interaction on my page feels natural without any configuration.
- As a toolkit consumer, I want pressing ↓ to animate smoothly to the next scene — not snap instantly — so that keyboard navigation feels as polished as scroll navigation.
- As a toolkit consumer, I want to write `type="camera.zoom"` and have TypeScript autocomplete work, so I don't need to know what "dolly" means.
- As a toolkit consumer, I want to drop `<InputHud />` into my demo scene and have it automatically show every active binding derived from my compiled `<InputController>`, so I never maintain a separate binding reference card.
- As a toolkit consumer, I want the InputHud to highlight the binding row when I actually use that input, so users can discover camera controls interactively.
- As a toolkit consumer, I want to configure a transition duration once at the player level and have all event-triggered navigation use it, without modifying every scene.
- As a toolkit consumer, I want all elements to follow one positioning model (NVS compilation), so I don't encounter double-positioning bugs when using Views or carousels.

---

## 6. Functional Requirements

### Input Defaults

1. `createDefaultInputSpec(options?)` shall return a `SceneInputControllerSpec` with the standard binding set defined in §7.1.
2. The compiler shall inject `createDefaultInputSpec()` when no `<InputController>` is authored in any scene, unless `disableDefaultInputSpec` is set on `SceneEngine`.

### Scroll X → Carousel

3. `InputCoordinator` shall accumulate `deltaX` from unclaimed wheel events into a carousel X-inertia accumulator, separate from the existing `deltaY` scene inertia.
4. When the carousel X-accumulator crosses a signed threshold (configurable, default `±120` wheel units), `InputCoordinator` shall call `onCarouselStep` targeting `primaryCarouselId` (if set on the current scene) and reset the accumulator.
5. Axis arbitration on simultaneous `deltaX`/`deltaY` shall use sticky-first-axis semantics: the dominant axis on the first event of a gesture locks for `wheelLockIdleMs` (default 180 ms), preventing diagonal scroll from triggering both scene and carousel navigation.
6. `<Scene>` shall accept a `primaryCarouselId?: string` prop. The compiled `SceneFrame` shall store this value. `InputCoordinator` reads it each tick to target carousel X-inertia steps. When absent, carousel X-inertia is a no-op.

### Action Type Changes

7. `InputActionType` shall include `'camera.zoom'` and `'camera.pan'`. `'camera.dolly'` and `'canvas.pan'` are removed (`canvas.pan` is renamed to `camera.pan`). All references in first-party code are migrated.
8. `ActionInputHandler` shall include `onCameraZoom` (replaces `onCameraDolly`) and `onCameraPan` as required methods.

### Animation Duration

9. `SceneEngine` shall expose `defaultTransitionDuration: number` (ms, default `400`) and `defaultTransitionEasing: TransitionEasing` (default `'ease-in-out'`).
10. `ProgressManager` shall accept `transitionDuration?: number` (ms) and `transitionEasing?: TransitionEasing`. When set, these override the `SceneEngine` default for the outgoing transition from that scene.
11. When `onSceneStep` is called, the engine shall animate `currentProgress` toward `targetProgress` over the effective transition duration, sampling the SceneTrack on each RAF frame. If a new `onSceneStep` fires during animation, the target updates and animation continues from the current animated position. If the user scrolls on the Y axis (scene navigation) during animation, the animation is interrupted immediately. Scroll X (carousel navigation) does not interrupt scene transition animation — the axes are independent.

### IGroupOwner Removal

12. `IGroupOwner` shall be deleted from `packages/core/src/widget/types.ts`. The `isGroupOwner()` guard shall be deleted from `WidgetRegistry.ts`. Both shall be removed from barrel exports.
13. `ViewWidget.reparentChildren()` and `resolveChildRoot()` in `plugins.ts` shall be removed. ViewWidget retains its opacity/visibility application role.
14. `MediaScreenWidget` in `packages/screens/` shall remove `implements IGroupOwner`, remove `rootGroup`, and add its renderer geometry directly to `this.scene`. Position is computed from NVS state as it already does — the double-positioning is eliminated.

### InputHud Foundation (Component deferred to follow-on minor)

15. `ActionInputController` shall expose an `onActionFired(listener): () => void` subscription API that fires synchronously after every successful action dispatch. This enables the future `InputHud` live indicator.
16. `@brewsite/core` shall export `formatInputMap(map: InputActionMap, platform?: Platform): string`, `formatModifier(mod: ModifierKey, platform?: Platform): string`, and `detectPlatform(): Platform` from `packages/core/src/input/platformKeys.ts`. These replace the ad-hoc `pk()` helper in `apps/examples/`.
17. The `InputHud` React component (§7.9) is designed and specified in this PRD for reference but ships as a follow-on minor release. It is purely additive and has no breaking changes.

---

## 7. API Design

### 7.1 Default Input Spec — `createDefaultInputSpec()`

```typescript
// packages/core/src/input/defaultInputSpec.ts

export type DefaultInputSpecOptions = {
  /** Controller scope. Default: 'window'. */
  scope?: InputControllerScope;
  /** Primary camera ID for camera.* actions. Default: engine's primaryCameraId. */
  cameraId?: string;
};

export function createDefaultInputSpec(options?: DefaultInputSpecOptions): SceneInputControllerSpec;
```

The returned spec encodes the following binding set:

```
── Scene navigation ───────────────────────────────────────
ArrowDown           → scene.next
ArrowUp             → scene.prev
(Scroll Y is handled by InputCoordinator inertia, not this spec)

── Carousel navigation ────────────────────────────────────
ArrowRight          → carousel.next   (targets primaryCarouselId)
ArrowLeft           → carousel.prev   (targets primaryCarouselId)
(Scroll X is handled by InputCoordinator inertia, not this spec)

── Camera zoom ────────────────────────────────────────────
Pinch (trackpad)    → camera.zoom
Cmd + Scroll Y      → camera.zoom     (modifiers: ['meta'])

── Camera orbit ───────────────────────────────────────────
Ctrl + Scroll XY    → camera.orbit    (modifiers: ['ctrl'])
Meta + Left Drag    → camera.orbit    (modifiers: ['meta'])

── Camera pan ─────────────────────────────────────────────
Shift + Scroll XY   → camera.pan      (modifiers: ['shift'])

── Camera reset ───────────────────────────────────────────
R                   → camera.reset
```

**Arrow keys follow the scroll axis convention.** Vertical arrows (↑↓) for scenes (vertical scroll). Horizontal arrows (←→) for carousel (horizontal scroll). This is the correct default and the only supported default.

All `carousel.*` actions in the default spec use a sentinel `layoutId: '__primary_carousel__'`. At runtime, `InputCoordinator` resolves this sentinel to the `primaryCarouselId` from the current tick's `SceneFrame`. If no `primaryCarouselId` is set on the scene, these actions are silent no-ops.

### 7.2 Scene DSL — `primaryCarouselId`

```typescript
export type SceneProps = {
  // ... existing props ...

  /**
   * ID of the ViewLayout that receives horizontal scroll (scroll X) and
   * the default carousel arrow key bindings (← →).
   *
   * When absent, scroll X and carousel arrow keys are inert.
   */
  primaryCarouselId?: string;
};
```

The compiled `SceneFrame` stores `primaryCarouselId?: string` as a top-level field.

```tsx
<Scene id="product-tour" primaryCarouselId="product-carousel">
  <ViewLayout id="product-carousel" kind="carousel" activeIndex={0}>
    ...
  </ViewLayout>
</Scene>
```

### 7.3 InputActionType — `camera.dolly` Removed

```typescript
// packages/core/src/input/types.ts

export type InputActionType =
  | 'camera.orbit'
  | 'camera.zoom'       // replaces camera.dolly — no alias, no deprecation
  | 'camera.pan'        // replaces canvas.pan — pan is a camera op, not canvas
  | 'camera.reset'
  | 'scene.next'
  | 'scene.prev'
  | 'carousel.next'
  | 'carousel.prev'
  | (string & {});
```

`'camera.dolly'` is deleted. TypeScript will catch any remaining usage as a type error (since it's no longer in the named set; the open union still accepts it at runtime but autocomplete won't suggest it). All first-party code is migrated.

### 7.4 ActionInputHandler — `onCameraDolly` Removed, `onCameraPan` Required

```typescript
// packages/core/src/input/types.ts

export type ActionInputHandler = {
  getSceneCount(): number;
  onSceneStep(direction: 1 | -1, stepScenes: number): void;
  onCameraOrbit(cameraId: string, dx: number, dy: number, speed: number): void;
  onCameraZoom(cameraId: string, delta: number, speed: number): void;
  onCameraReset(cameraId: string): void;
  onCameraPan(cameraId: string, dx: number, dy: number, speed: number): void;
  onCarouselStep(layoutId: string, direction: 1 | -1, stepSlides: number): void;
  onUnknownAction?(
    type: string,
    canvasId: string | undefined,
    event: PointerEvent | WheelEvent | KeyboardEvent | MouseEvent,
    extra: Record<string, unknown>
  ): void;
};
```

`onCameraDolly` is removed. `onCameraZoom` replaces it. `onCameraPan` is required.

`onCameraPan` translates the camera's world position and target together in the camera's local XY plane (perpendicular to the view direction), preserving the orbit distance. `dx` and `dy` are viewport-relative deltas (same units as `onCameraOrbit`).

### 7.5 Animation Duration — `SceneEngine` Props & `ProgressManager`

```typescript
// packages/core/src/player/SceneEngine.tsx

export type TransitionEasing = 'ease-in-out' | 'ease-out' | 'ease-in' | 'linear';

export type SceneEngineProps = {
  // ... existing props ...

  /**
   * Duration (ms) for event-triggered navigation (arrow keys, onSceneStep calls).
   * Does not affect scroll-driven navigation. Default: 400.
   */
  defaultTransitionDuration?: number;

  /**
   * Easing curve for event-triggered navigation animation. Default: 'ease-in-out'.
   */
  defaultTransitionEasing?: TransitionEasing;
};
```

```typescript
// packages/core/src/compiler/primitives/progressManager.ts

export type ProgressManagerSpec = {
  // ... existing fields ...

  /**
   * Duration (ms) for the outgoing transition from this scene when triggered
   * by event-based navigation (arrow keys, onSceneStep). Overrides SceneEngine
   * defaultTransitionDuration for this specific scene transition.
   * Undefined = use player default (400ms).
   */
  transitionDuration?: number;

  /**
   * Easing for this scene's outgoing event-triggered transition.
   * Undefined = use player default ('ease-in-out').
   */
  transitionEasing?: TransitionEasing;
};
```

DSL usage:

```tsx
// Player-level default:
<SceneEngine defaultTransitionDuration={400} defaultTransitionEasing="ease-in-out">

// Per-scene override:
<ProgressManager transitionDuration={600} transitionEasing="ease-out" />

// Instant (opt out of animation for a specific scene):
<ProgressManager transitionDuration={0} />
```

### 7.6 TransitionAnimator (Internal Engine API)

Not public. Lives in `packages/core/src/player/transitionAnimator.ts`.

```typescript
export type TransitionAnimatorState = {
  fromProgress: number;
  toProgress: number;
  duration: number;
  elapsed: number;
  easing: TransitionEasing;
  active: boolean;
};

export function stepTransitionAnimator(
  state: TransitionAnimatorState,
  deltaMs: number
): { progress: number; done: boolean };

export function startTransition(
  current: number,
  target: number,
  duration: number,
  easing: TransitionEasing
): TransitionAnimatorState;

export function redirectTransition(
  state: TransitionAnimatorState,
  newTarget: number
): TransitionAnimatorState;
```

Behavior:
- `stepTransitionAnimator` advances `elapsed` by `deltaMs`, computes `t = easing(elapsed / duration)`, returns `lerp(fromProgress, toProgress, t)`
- `redirectTransition` starts a new animation from the current animated position to the new target
- When `active: false`, the engine uses `currentProgress` directly — no overhead

### 7.7 InputCoordinator — Carousel X-Inertia

New props on `InputCoordinator`:

```typescript
export type InputCoordinatorProps = {
  // ... existing props ...

  /**
   * Minimum accumulated deltaX (wheel units) before a carousel step fires.
   * Default: 120. Lower = more sensitive.
   */
  carouselXThreshold?: number;

  /**
   * Decay factor per frame for carousel X accumulator. Default: 0.75.
   * Lower than scene inertia decay — carousel steps should feel snappy.
   */
  carouselXDecay?: number;
};
```

Scroll X direction convention: **swipe left (negative deltaX) = carousel.next** (content advances left, revealing next slide). This matches native phone swipe and browser horizontal scroll conventions.

Internal behavior:

```
On unclaimed wheel event — axis arbitration:
1. Determine dominant axis (|deltaX| vs |deltaY|)
2. Apply sticky axis lock (wheelLockIdleMs): first axis wins for the gesture
3. Locked Y → add deltaY to scene inertia accumulator (existing behavior)
4. Locked X → add deltaX to carouselXAccumulator

In RAF loop:
- Apply carouselXDecay per frame
- If |carouselXAccumulator| >= carouselXThreshold:
    fire onCarouselStep(primaryCarouselId, direction, 1)
    reset accumulator (discrete step, not continuous)
```

### 7.8 IGroupOwner Removal

**Removed from SDK:**

```typescript
// DELETED from packages/core/src/widget/types.ts:
// export interface IGroupOwner extends IWidget { readonly rootGroup: Object3D; }

// DELETED from packages/core/src/widget/WidgetRegistry.ts:
// export function isGroupOwner(widget: IWidget): widget is IGroupOwner { ... }

// DELETED from packages/core/src/widget/index.ts:
// IGroupOwner export
// isGroupOwner export
```

**ViewWidget simplification:**

`ViewWidget.reparentChildren()` and the `resolveChildRoot` closure in `plugins.ts` are removed. ViewWidget no longer parents any child 3D objects. ViewWidget is responsible for **both** scene-level transition opacity (entrance/exit fades at scene boundaries) and carousel slide visibility (active/inactive opacity based on runtime `activeIndex` changes). See §8.8.7 for the required implementation approach.

The `resolveChildRoot` constructor parameter on ViewWidget is removed. ViewWidget becomes:

```typescript
export class ViewWidget implements IRenderable<ViewState> {
  readonly widgetId: string;
  // childWidgetIds populated by the compiler from ViewLayout→child relationships.
  // apply() uses these IDs to delegate opacity to each child widget (Option A).

  initialize(ctx: WidgetInitContext): void { ... }
  apply(state: ViewState, ctx: WidgetRenderContext): void { ... }
  dispose(): void { ... }
}
```

**MediaScreenWidget update:**

```typescript
// packages/screens/src/elements/media-screen/widget.ts
// BEFORE:
export class MediaScreenWidget implements ISceneElement<MediaScreenState>, IRenderable<MediaScreenState>, IGroupOwner {
  readonly rootGroup = new THREE.Group();
  // geometry added to rootGroup

// AFTER:
export class MediaScreenWidget implements ISceneElement<MediaScreenState>, IRenderable<MediaScreenState> {
  // geometry added directly to this.scene
  // position computed from NVS state — standard pattern, no double-positioning
```

### 7.9 InputHud Component (Deferred to Follow-on Minor Release)

```typescript
// packages/core/src/player/InputHud.tsx

export type InputHudPosition =
  | 'bottom-left'
  | 'bottom-right'
  | 'top-left'
  | 'top-right';

export type InputHudProps = {
  /** Corner anchor. Default: 'bottom-right'. */
  position?: InputHudPosition;

  /** Color theme. 'auto' follows the engine's active theme polarity. Default: 'auto'. */
  theme?: 'dark' | 'light' | 'auto';

  /** Compact mode: action names + primary binding only, no descriptions. Default: false. */
  compact?: boolean;

  /** Briefly highlights a binding row (300 ms) when that action fires. Default: true. */
  showLiveIndicator?: boolean;

  /**
   * Include the implicit scroll-axis bindings in the display (scroll Y → scenes,
   * scroll X → carousel). The HUD infers these from whether ScrollStage is mounted
   * and primaryCarouselId is set. Default: true.
   */
  showImplicitScrollBindings?: boolean;

  style?: React.CSSProperties;
  className?: string;
};

export function InputHud(props?: InputHudProps): JSX.Element | null;
```

**Rendering model:**

`InputHud` reads from engine context:
- Current `SceneInputControllerSpec` from `tick.state.widgets['__input_controller']`
- `tick.state.primaryCarouselId` (to conditionally show scroll X binding)
- Engine theme polarity (for `theme='auto'`)

Groups actions by type prefix:

| Prefix | Group label |
|---|---|
| `scene.*` | Navigation |
| `carousel.*` | Carousel |
| `camera.*` | Camera |
| `canvas.*` | Canvas |
| Anything else | Actions |

Rendered layout:

```
┌─────────────────────────────────┐
│  Controls                   [×] │
├─────────────────────────────────┤
│  NAVIGATION                     │
│  Scroll ↕          Scenes       │
│  ↓ / ↑             Next / Prev  │
├─────────────────────────────────┤
│  CAROUSEL                       │
│  Scroll ↔          Slides       │
│  → / ←             Next / Prev  │
├─────────────────────────────────┤
│  CAMERA                         │
│  Pinch             Zoom         │
│  ⌘ + Scroll        Zoom         │
│  ⌃ + Scroll        Orbit        │
│  ⇧ + Scroll        Pan          │
│  R                 Reset        │
└─────────────────────────────────┘
```

The `[×]` button collapses to a `⌨` icon. Collapsed state persists in `localStorage` (key configurable via `storageKey` prop, default `'brewsite:input-hud:collapsed'`).

**Live indicator:** `ActionInputController` gains a typed `onActionFired(listener)` subscription. `InputHud` subscribes via `useEffect`. When an action fires, the corresponding row highlights for 300 ms.

`InputCoordinator` exposes the controller instance via `ActionInputControllerContext` so `InputHud` can reach it without prop drilling.

### 7.10 Platform Key Formatting Utility

```typescript
// packages/core/src/input/platformKeys.ts

export type Platform = 'mac' | 'windows' | 'linux';

export function detectPlatform(): Platform;

export function formatInputMap(map: InputActionMap, platform?: Platform): string;
// Examples:
//   { kind: 'key', key: 'r' } → 'R'
//   { kind: 'key', key: 'ArrowDown', modifiers: ['shift'] } → '⇧ ↓' (mac) / 'Shift + ↓' (win)
//   { kind: 'wheel', modifiers: ['meta'] } → '⌘ Scroll' (mac) / 'Win + Scroll' (win)
//   { kind: 'pinch' } → 'Pinch'
//   { kind: 'pointer', event: 'drag', button: 'left' } → 'Left Drag'

export function formatModifier(mod: ModifierKey, platform?: Platform): string;
// 'meta' → '⌘' (mac) / 'Win' (win)
// 'ctrl' → '⌃' (mac) / 'Ctrl' (win)
// 'alt'  → '⌥' (mac) / 'Alt' (win)
// 'shift' → '⇧' (mac) / 'Shift' (win)
```

Replaces the ad-hoc `pk()` helper in `apps/examples/`. All input showcase scenes migrate to `formatModifier` from `@brewsite/core`.

---

## 8. Technical Considerations

### 8.1 Default Spec Injection at Compile Time

The current compiler injects two arrow-key bindings. It will now call `createDefaultInputSpec()` and inject the full spec. The injected spec stores `layoutId: '__primary_carousel__'` for carousel actions. At runtime, `InputCoordinator` resolves this sentinel:

```typescript
const effectiveLayoutId = layoutId === '__primary_carousel__'
  ? engineRef.current.frameState.tick?.state.primaryCarouselId ?? null
  : layoutId;
if (!effectiveLayoutId) return;
```

This sentinel approach avoids the compiler needing to know `primaryCarouselId` at injection time.

### 8.2 Transition Animator Integration

The `TransitionAnimator` state lives in the engine/player layer, not in `InputCoordinator`. The engine's own RAF loop drives the progress animation. `InputCoordinator` signals navigation intent via `engine.beginTransition(from, to, duration, easing)` when `onSceneStep` is called, and signals `engine.interruptTransition()` when scroll Y input is detected.

This separation is important: the inertia accumulator is genuinely input state (unresolved scroll delta), but transition animation is resolved player state (autonomous progress advancement). They belong in different layers.

Coexistence rules:

- **Scroll Y > animation > idle.** If the user scrolls on the Y axis (scene navigation) during a transition, `InputCoordinator` calls `engine.interruptTransition()` and scroll takes over immediately. No blending. Scroll X (carousel) does **not** interrupt scene transition animation — the axes are independent.
- **Arrow during animation**: `engine.redirectTransition(newTarget)` is called from current animated progress to the new target. No jarring reversal.
- **Duration = 0**: Bypass the animator entirely. `engine.setProgress(target)` directly.
- **Programmatic seekTo**: Because the animator lives in the engine, programmatic `seekTo(sceneId)` calls can use the same `beginTransition` / `interruptTransition` API without reaching into the input layer.

### 8.3 `ProgressManager.transitionDuration` Compilation

`transitionDuration` and `transitionEasing` are added to `ProgressManagerSpec` (stored in `SceneFrame.progressManager`). They are **not** baked into the `SceneTrack` tick array — they are read at runtime when the outgoing transition from that scene is triggered by an event. Resolution order:

1. `tick.state.progressManager?.transitionDuration` (scene override)
2. `SceneEngine` prop `defaultTransitionDuration`
3. `400` (the engine default)

### 8.4 X-Scroll Axis Arbitration

The priority waterfall for a wheel event:

1. Scrollable content check → native scroll
2. Ctrl+wheel → pinch dispatch (existing)
3. `ActionInputController.dispatchWheel()` → explicit `WheelMap` actions
4. **Unclaimed X-delta** → carousel X accumulator ← new
5. **Unclaimed Y-delta** → scene inertia accumulator ← existing
6. Nothing matched → browser default

Steps 4 and 5 only fire if step 3 did not claim the event. A scene declaring `<WheelMap axis="x" />` for a custom action consumes X-delta before the carousel accumulator sees it.

The axis arbitration lock:

```typescript
type InertiaAxisLock = {
  axis: 'x' | 'y' | null;
  lastEventMs: number;
};
```

First unclaimed wheel event of a gesture: lock to `|deltaX| > |deltaY| ? 'x' : 'y'`. Lock persists for `wheelLockIdleMs`. Subsequent events feed only the locked axis accumulator.

### 8.5 Action Event Emission (Foundation for InputHud)

`ActionInputController` gains a minimal typed event emitter. This ships in the major release as foundation for the deferred `InputHud` component and is useful to any consumer that needs to react to action dispatches.

```typescript
type ActionFiredListener = (actionId: string, type: InputActionType) => void;

class ActionInputController {
  onActionFired(listener: ActionFiredListener): () => void;  // returns unsubscribe
}
```

This is an internal, synchronous callback list — not a heavyweight pub/sub system. The emitter fires after every successful action dispatch. The future `InputHud` component will subscribe in `useEffect` and trigger a CSS animation on the matching row.

### 8.6 `camera.pan` Implementation

`onCameraPan(cameraId, dx, dy, speed)` translates the camera in its local XY plane:

```typescript
const forward = target.clone().sub(position).normalize();
const up = camera.up.clone().normalize();  // use camera's actual up — correct for tilted/rolled rigs
const right = forward.clone().cross(up).normalize();

const panDelta = right.multiplyScalar(-dx * speed * panSensitivity)
  .add(up.multiplyScalar(dy * speed * panSensitivity));

engine.applyCameraPan(cameraId, panDelta);
```

**Important:** The `up` vector must come from `camera.up`, not a hardcoded `(0, 1, 0)`. A hardcoded world-Y produces incorrect vertical pan when the camera is pitched (common for model inspection) and breaks entirely for non-standard camera rigs with rolled `up` vectors.

`panSensitivity` is an internal constant (`0.005` NVS units per pixel initially). `engine.applyCameraPan` translates both `camera.position` and `camera.target` by `panDelta`, preserving orbit distance.

### 8.7 Bundle Impact

| Module | Size (gzip) | Dependencies | Release |
|---|---|---|---|
| `createDefaultInputSpec()` | ~0.5 KB | Pure data, no Three.js | This major |
| `TransitionAnimator` | ~0.8 KB | Pure math, no Three.js | This major |
| `platformKeys.ts` | ~0.5 KB | Pure functions | This major |
| `onActionFired` listener | ~0.2 KB | None | This major |
| **Total new code (major)** | **~2 KB** | All tree-shakeable | |
| `InputHud` | ~4–6 KB | React (peer dep) | Follow-on minor |

All modules tree-shake cleanly — consumers who don't import them pay nothing.

### 8.8 Architectural Constraints for Implementers

These constraints are non-negotiable. The implementing engineer and architect must follow them:

1. **`createDefaultInputSpec()` is a pure function.** No side effects, no imports from Three.js, no React. It returns a plain `SceneInputControllerSpec` object. It lives in `packages/core/src/input/`, not in the compiler or player layer.

2. **`TransitionAnimator` is a pure function module.** All functions are `(state, input) → output`. No classes, no RAF ownership, no React. The animator state and RAF integration live in the **engine/player layer** (not InputCoordinator). The engine's RAF loop calls `stepTransitionAnimator` each frame when a transition is active. InputCoordinator signals intent via `engine.beginTransition()` and `engine.interruptTransition()` — it does not hold or step animator state. The animator has no knowledge of the input system, the DOM, or Three.js.

3. **The inertia X accumulator mirrors the Y accumulator structurally.** Same ref pattern, same RAF-loop integration point, same decay model. Do not introduce a separate RAF loop for X-inertia. Both accumulators are stepped in the same frame callback.

4. **`InertiaAxisLock` is a single shared lock** between X and Y inertia — not two independent locks. One gesture cannot drive both accumulators simultaneously.

5. **`InputHud` (deferred) renders via React portal** to `document.body`. It does not require placement inside `EngineOverlayHost`. This makes it trivial for consumers to add — just `<InputHud />` anywhere inside `<SceneEngine>`. It reads engine state from context, not from props. (Design constraint for the follow-on minor.)

6. **`ActionInputController.onActionFired` is a synchronous callback list.** Max 10 listeners. No async. No event queuing. Fire-and-forget. If no listeners, the emission is a no-op (zero overhead). Ships in this major as foundation for InputHud and general consumer use.

7. **`ViewWidget` after IGroupOwner removal: full opacity responsibility, Option A required.** ViewWidget is responsible for **both** (a) scene-level transition opacity (entrance/exit fades at scene boundaries) and (b) carousel slide visibility (active/inactive opacity based on runtime `activeIndex` changes when the user navigates carousel slides). The current `applyOpacity` traverses `this.group.traverse(...)` which worked because children were reparented. After removal, a new mechanism is required.

   **Option A is required.** Option B (compile-time `composeOpacity`) is categorically insufficient for carousel slide visibility — compile-time data cannot encode runtime `activeIndex` changes driven by user gestures. There is nothing to validate; it is a timing impossibility.

   **Required mechanism (Option A):** The compiler resolves `ViewLayout` → child element relationships at compile time and stores `childWidgetIds: string[]` in the compiled `ViewState`. At runtime, ViewWidget's `apply()` receives the current `ViewState` (which includes the active `activeIndex` for carousel layouts) and calls `engine.applyWidgetOpacity(childId, opacity)` for each child — showing the active slide, hiding inactive ones, and applying scene-transition fade values. The `childWidgetIds` list is populated by the compiler, not by runtime registration, consistent with the NVS compilation pattern.

   Open question on `childWidgetIds` population: see §12.

8. **MediaScreenWidget geometry goes directly on `this.scene`**, not on a root group. The renderer's `update()` method receives `this.scene` (or a container created in `initialize`) instead of `this.rootGroup`. Position is computed from NVS state every tick — the standard pattern.

9. **All first-party examples that currently use `camera.dolly` must be migrated to `camera.zoom`.** All scenes using `ArrowRight`/`ArrowLeft` for scene navigation must be migrated to `ArrowDown`/`ArrowUp`. All scenes demonstrating carousels should add `primaryCarouselId` on `<Scene>`. The `pk()` helper in `apps/examples/src/input-showcase/platformKeys.ts` is deleted and replaced with `formatModifier` imports from `@brewsite/core`.

10. **The existing `prd_input.md` must be updated** to reflect the new `InputActionType` (no `camera.dolly`), the new `ActionInputHandler` shape (no `onCameraDolly`, required `onCameraPan`, `onCameraZoom` replaces `onCameraDolly`), the new default keyboard injection (full spec, not just two bindings), and the `IGroupOwner` removal from the widget SDK surface.

---

## 9. Breaking Change Assessment

**Semver impact: Major** — clean break, no migration shims.

| Change | Type |
|---|---|
| `'camera.dolly'` removed from `InputActionType` named values | Removed symbol |
| `'canvas.pan'` renamed to `'camera.pan'` in `InputActionType` | Renamed symbol |
| `onCameraDolly` removed from `ActionInputHandler` | Removed method |
| `onCameraZoom` replaces `onCameraDolly` on `ActionInputHandler` | Renamed method |
| `onCameraPan` added as required on `ActionInputHandler` | New required method |
| `IGroupOwner` deleted from widget SDK | Removed interface |
| `isGroupOwner()` deleted from `WidgetRegistry` | Removed function |
| `defaultTransitionDuration` defaults to `400` (was instant) | Behavioral change |
| Arrow key defaults: ↓=next/↑=prev (was →=next/←=prev) | Behavioral change |
| `MediaScreenWidget` no longer implements `IGroupOwner` | Changed class shape |

All first-party code is migrated as part of this work. Consumer code that uses `camera.dolly`, `onCameraDolly`, or `IGroupOwner` will get TypeScript compile errors — clear and immediate.

---

## 10. Dependencies

- No new external dependencies
- `InputHud` uses React (existing peer dependency)
- `TransitionAnimator` is pure TypeScript math — no Three.js, no React
- `formatInputMap` / `formatModifier` are pure functions — no dependencies

---

## 11. Risks & Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Transition animator conflicts with scroll inertia | Jarring jump | Scroll interrupts animation immediately — scroll always wins |
| Carousel X-scroll fires on pages with horizontal scroll containers | Accidentally advances carousel | Scrollable-content check in `InputCoordinator` applies to X-axis; scrollable containers capture X-scroll before inertia |
| `panSensitivity` constant feels wrong across FOVs | Pan too fast/slow | Expose `panSensitivity` as prop on `InputCoordinator`; calibrate against model showcase |
| ViewWidget opacity after IGroupOwner removal | Scene transition fade and/or carousel slide visibility breaks | Architect selects Option A or B in §8.8.7; if Option B, must validate it can propagate runtime `activeIndex` changes to child opacity — if it cannot, Option A is required |
| MediaScreenWidget regression in carousel scenes | Positioning breaks differently | Explicit test: carousel scene with MediaScreen panels, verify no double-positioning |

---

## 12. Open Questions

1. **`childWidgetIds` population: compiler vs. runtime registration.** Option A requires ViewWidget to hold `childWidgetIds: string[]` so it can delegate opacity to each child. The preferred approach is compile-time: the compiler resolves `ViewLayout` → child element relationships from the DSL tree and stores them in the compiled `ViewState`. This is consistent with the NVS pattern and keeps ViewWidget stateless at init. The alternative — child widgets registering themselves with ViewWidget at `initialize()` — introduces runtime coupling and ordering dependencies. The architect must confirm the compiler can resolve these relationships and specify what the `ViewState` type extension looks like.

2. **`InputHud` content for plugin action types (deferred — follow-on minor).** When a scene uses `diagram-canvas.move` or other plugin action strings, what label does InputHud display? Current position: show the raw action type string (e.g., "diagram-canvas.move" → "Move"). The prefix stripping and label generation should be documented for plugin authors. This is a minor DX decision — does not block this major release or the follow-on InputHud minor.

---

## 13. Launch Criteria

### Core implementation (this major release)
- [ ] `createDefaultInputSpec()` exported from `@brewsite/core`; compiler injects it when no `<InputController>` is authored
- [ ] `SceneFrame` stores `primaryCarouselId?: string`; `<Scene primaryCarouselId="...">` compiles correctly
- [ ] `InputCoordinator` accumulates `deltaX`; carousel X-inertia fires `onCarouselStep` for `primaryCarouselId` when threshold crossed
- [ ] Axis arbitration (sticky X vs Y lock) covered by unit tests
- [ ] `'camera.zoom'` replaces `'camera.dolly'` in `InputActionType`; `'camera.pan'` replaces `'canvas.pan'`; `onCameraZoom` replaces `onCameraDolly` in `ActionInputHandler`
- [ ] `onCameraPan` implemented using `camera.up` (not hardcoded world-Y) in `ActionInputHandler`
- [ ] `TransitionAnimator` is a pure function module; animator state lives in engine/player layer; `engine.beginTransition()` / `engine.interruptTransition()` API exposed
- [ ] `TransitionAnimator` has unit tests: step math, redirect, easing curves, scroll-Y-interruption behavior (scroll X does not interrupt)
- [ ] `SceneEngine` accepts `defaultTransitionDuration` (default 400) / `defaultTransitionEasing` (default 'ease-in-out'); `ProgressManager` accepts per-scene override
- [ ] `IGroupOwner` and `isGroupOwner()` deleted from `@brewsite/core` widget SDK
- [ ] `ViewWidget` simplified: `reparentChildren` and `resolveChildRoot` removed; opacity/visibility correctly applied for both scene-level transitions AND runtime carousel slide visibility (`activeIndex` changes)
- [ ] `MediaScreenWidget` updated: `IGroupOwner` removed, geometry added directly to scene
- [ ] `ActionInputController.onActionFired()` subscription API exported (foundation for InputHud)
- [ ] `formatInputMap`, `formatModifier`, `detectPlatform` exported from `@brewsite/core`

### Examples and documentation
- [ ] All `apps/examples/` scenes migrated from `camera.dolly` → `camera.zoom` and `canvas.pan` → `camera.pan`
- [ ] All `apps/examples/` scenes migrated from `ArrowRight`/`ArrowLeft` scene nav → `ArrowDown`/`ArrowUp`
- [ ] `apps/examples/` `pk()` helper deleted; all usages replaced with `formatModifier` from `@brewsite/core`
- [ ] At least one example scene uses `<Scene primaryCarouselId="...">` with scroll X + default arrow keys for carousel
- [ ] Carousel example scenes with `MediaScreenWidget` tested for correct positioning (no double-positioning, no snap)
- [ ] `requirements/core/prd/prd_input.md` updated to reflect all API changes
- [ ] `packages/core/README.md` updated: new `SceneEngine` props, `camera.zoom` action type, `camera.pan`, `defaultTransitionDuration`
- [ ] `CHANGELOG.md` entry written: `camera.dolly` removal, `canvas.pan` → `camera.pan`, `IGroupOwner` removal, arrow key default change, `defaultTransitionDuration`, scroll X carousel, `onActionFired` API, `platformKeys` utilities

### Follow-on minor (InputHud)
- [ ] `InputHud` component exported; renders from live `SceneInputControllerSpec`; groups by category; platform-aware labels; live indicator fires on action
- [ ] At least one example scene uses `<InputHud />` instead of hand-crafted binding cards
- [ ] Input showcase hand-crafted binding cards (`Kbd`, `BindingRow`) replaced with `<InputHud />` or `formatInputMap` calls

### Quality gates
- [ ] `pnpm typecheck` passes for all packages
- [ ] `pnpm test` passes for `@brewsite/core` and `@brewsite/screens`
- [ ] `pnpm build` succeeds
- [ ] Coverage targets met for `src/input/`, `src/player/`, `src/widget/`
