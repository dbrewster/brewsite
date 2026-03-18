---
title: Input DSL
doc_type: guide
owner: claude-author
status: active
updated: 2026-03-18
---

## Two Input Systems

BrewSite has two orthogonal input systems that work at different layers.

**1. Scene navigation input (player-level)** — Controls which scene is active and how the engine progress value changes. Provided by player components: `ScrollStage` for scroll-driven navigation, `TimeInput` for auto-advance, `ControlledInput` for external state, and `InputCoordinator` for wheel-inertia + keyboard navigation. These components live outside the DSL and are not authored inside `<Scene>`.

**2. Action-based input (DSL-level)** — Controls camera orbit/zoom/pan, carousel stepping, and custom interactions within a scene. A comprehensive default input spec is always present (see Default Input Bindings below). Scene authors can customize by merging overrides via `<InputController>` and `<Action>` DSL components.

These systems compose: you can have both a `ScrollStage` (scene navigation) and custom `<InputController>` actions (camera orbit overrides) active at the same time. The "scroll is sacred" principle guarantees that plain scroll Y always drives scene navigation and plain scroll X always drives carousel navigation, regardless of what actions are configured.

---

## The "Scroll Is Sacred" Principle

Plain, unmodified scroll is unconditionally reserved for navigation:

- **Scroll Y** = scene navigation (always)
- **Scroll X** = carousel navigation (always, when `primaryCarouselId` is set)

No default action uses an unmodified `WheelMap`. Camera interactions use modifier+scroll (Cmd/Ctrl+scroll for orbit, Shift+scroll for pan), pinch gestures, and keyboard keys. Left drag is intentionally free — no default consumes it, keeping overlays and text selection unblocked.

---

## Default Input Bindings

Every scene gets a comprehensive set of input bindings by default, with no DSL required. The compiler merges these defaults with any scene-authored `<InputController>`.

| Action | Desktop | Mobile | Default Action ID |
|---|---|---|---|
| Scene scroll (Y) | Plain scroll Y | 1-finger swipe Y | (unclaimed wheel path) |
| Carousel scroll (X) | Plain scroll X | 1-finger swipe X | (unclaimed wheel path) |
| Camera orbit | Cmd/Ctrl + scroll | 2-finger drag | `default-camera-orbit` |
| Camera zoom | Pinch (trackpad) | 2-finger pinch | `default-camera-zoom` |
| Camera pan | Shift + scroll, middle-drag | 3-finger drag | `default-camera-pan` |
| Camera reset | R key | — | `default-camera-reset` |
| Scene next | ArrowDown | (via scroll) | `default-scene-next` |
| Scene prev | ArrowUp | (via scroll) | `default-scene-prev` |
| Carousel next | ArrowRight | (via swipe X) | `default-carousel-next` |
| Carousel prev | ArrowLeft | (via swipe X) | `default-carousel-prev` |

Most scenes need no `<InputController>` at all. The defaults provide scene navigation, camera control, and carousel navigation out of the box.

---

## Merge Mode (Default)

When a scene declares `<InputController>`, its actions **merge** with the defaults by matching on action `id`. This is the default behavior.

- Actions with an `id` matching a default action **replace** that default.
- Actions with a new `id` are **appended** to the defaults.
- Default actions not overridden are **preserved**.

This means you only declare what is different from the defaults.

### Example: Adding Left-Drag Orbit

The defaults use Cmd+scroll for orbit. To also enable left-drag orbit in a specific scene:

```tsx
<Scene id="product-viewer">
  <Camera mode="world" position={[0, 1.2, 4.5]} target={[0, 0.5, 0]} fov={40} />
  <Background color="#111" />
  <Model id="product" type="ProductModel" x={0.5} y={0.5} w={0.7} h={0.8} />

  <InputController scope="canvas">
    {/* New action — appended to defaults (id does not match any default) */}
    <Action id="drag-orbit" type="camera.orbit">
      <PointerMap event="drag" button="left" axis="xy" />
    </Action>
  </InputController>
</Scene>
```

All other defaults (Cmd+scroll orbit, Shift+scroll pan, pinch zoom, R reset, arrow key nav, carousel nav) remain active.

### Example: Overriding Default Carousel Actions

To override the default carousel actions with explicit `layoutId` and skip variants:

```tsx
<Scene id="carousel-scene" primaryCarouselId="feature-carousel">
  <InputController scope="canvas">
    {/* Override default carousel (same id = replaces default) */}
    <Action id="default-carousel-next" type="carousel.next" layoutId="feature-carousel">
      <KeyMap keyName="ArrowRight" />
      <PointerMap event="click" />
    </Action>
    <Action id="default-carousel-prev" type="carousel.prev" layoutId="feature-carousel">
      <KeyMap keyName="ArrowLeft" />
    </Action>
    {/* New actions — appended */}
    <Action id="carousel-skip-next" type="carousel.next" layoutId="feature-carousel" stepSlides={3}>
      <KeyMap keyName="ArrowRight" modifiers={['shift']} />
    </Action>
  </InputController>
</Scene>
```

### Example: Adding Skip-Step Scene Navigation

```tsx
<Scene id="long-scene">
  <InputController scope="canvas">
    {/* New skip actions — defaults for ArrowUp/ArrowDown scene nav are preserved */}
    <Action id="skip-next" type="scene.next" stepScenes={2}>
      <KeyMap keyName="ArrowDown" modifiers={['shift']} />
    </Action>
    <Action id="skip-prev" type="scene.prev" stepScenes={2}>
      <KeyMap keyName="ArrowUp" modifiers={['shift']} />
    </Action>
  </InputController>
</Scene>
```

---

## Replace Mode

Use `mode="replace"` for full control over every input binding. No defaults are merged. Only the actions you declare exist.

```tsx
<Scene id="demo-all-bindings">
  <InputController scope="window" mode="replace">
    <Action id="orbit" type="camera.orbit">
      <PointerMap event="drag" button="left" />
    </Action>
    <Action id="zoom" type="camera.zoom">
      <WheelMap />
      <PinchMap direction="both" />
    </Action>
    <Action id="reset" type="camera.reset">
      <KeyMap keyName="r" />
    </Action>
  </InputController>
</Scene>
```

An empty replace-mode controller disables all action-based input:

```tsx
<InputController mode="replace" />
```

Note: scroll-based scene navigation still works (it uses the unclaimed wheel path, not actions).

---

## InputController DSL Component

`InputController` declares the action-based input configuration for a scene. Place it as a direct child of `<Scene>`. Only one `InputController` is allowed per scene.

```tsx
import { InputController, Action, PointerMap, WheelMap, KeyMap, PinchMap } from '@brewsite/core';

<Scene id="viewer">
  <InputController scope="canvas" mode="merge">
    <Action id="orbit" type="camera.orbit">
      <PointerMap event="drag" button="left" />
    </Action>
    <Action id="zoom" type="camera.zoom">
      <PinchMap direction="both" />
    </Action>
  </InputController>
</Scene>
```

### InputControllerProps

| Prop | Type | Default | Description |
|---|---|---|---|
| `id` | `string` | `'main'` | Identifier for this controller spec. |
| `scope` | `'canvas' \| 'window'` | `'canvas'` | DOM scope for pointer/wheel event attachment. `'canvas'` attaches to the canvas container with keyboard focus-gated to the stage. `'window'` attaches pointer/wheel to `window` and keyboard to `document`. |
| `mode` | `'merge' \| 'replace'` | `'merge'` | How this spec combines with defaults. `'merge'` preserves unoverridden defaults. `'replace'` uses only declared actions. |

`InputController` compiles to a `SceneInputControllerSpec` stored at widget id `'__input_controller'` in the compiled tick state. The compiler merges it with `createDefaultInputSpec()` based on the `mode`.

**Carry-forward:** If scene N declares `<InputController>`, scene N+1 inherits that spec if N+1 has no `<InputController>`. The merge with defaults happens after carry-forward.

---

## Action Component

Each `<Action>` declares one type of interaction with one or more input maps. An `Action` must have at least one map child.

```tsx
<Action
  id="orbit"
  type="camera.orbit"
  cameraId="main-camera"
  speed={1.2}
>
  <PointerMap event="drag" button="left" />
  <PointerMap event="drag" button="left" modifiers={['shift']} axis="y" />
</Action>
```

### ActionProps

| Prop | Type | Description |
|---|---|---|
| `id` | `string` | Required. Unique within the parent `InputController`. Use a default action ID (e.g. `default-camera-orbit`) to override that default in merge mode. |
| `type` | `InputActionType` | Required. Action type string. See InputActionType Values below. |
| `cameraId` | `string` | Target camera widget id for camera actions. Falls back to `primaryCameraId` on `SceneEngine`. |
| `canvasId` | `string` | Target canvas widget id for canvas-specific actions (used by diagram plugin extensions). |
| `focusCenter` | `[number, number] \| [number, number, number]` | Focus center point for the action. 2D `[x, y]` or 3D `[x, y, z]` coordinates. |
| `speed` | `number` | Speed multiplier dispatched with the action. Default: `1`. |
| `stepScenes` | `number` | Number of scenes to advance per step for `scene.next`/`scene.prev`. Default: `1`. |
| `layoutId` | `string` | Target `ViewLayout` id for `carousel.next`/`carousel.prev`. Required for carousel actions. |
| `stepSlides` | `number` | Number of slides to advance per carousel step. Default: `1`. |

---

## InputActionType Values

The complete union of built-in action types (from `packages/core/src/input/types.ts`):

| Value | Description |
|---|---|
| `'camera.orbit'` | Rotate camera around its target. Dispatches `dx`/`dy` to `onCameraOrbit`. |
| `'camera.zoom'` | Zoom camera (dolly in/out). Dispatches `delta` to `onCameraZoom`. |
| `'camera.pan'` | Pan camera laterally. Dispatches `dx`/`dy` to `onCameraPan`. |
| `'camera.reset'` | Reset camera to its authored position. |
| `'scene.next'` | Advance to the next scene. Respects `stepScenes`. |
| `'scene.prev'` | Go to the previous scene. Respects `stepScenes`. |
| `'carousel.next'` | Advance the target carousel by `stepSlides`. Requires `layoutId`. |
| `'carousel.prev'` | Go back in the target carousel by `stepSlides`. Requires `layoutId`. |

The type union is open (`string & {}`), so downstream packages can define their own types (e.g., `'diagram-canvas.focus'` in `@brewsite/diagram`). These are handled via the `onUnknownAction` extension point in `ActionInputController`.

---

## Map Types

Each `<Action>` accepts one or more map children that declare which physical input triggers it.

### PointerMap

Maps pointer drag or click gestures to an action.

```tsx
<PointerMap
  event="drag"         // 'drag' | 'click'
  button="left"        // 'left' | 'middle' | 'right' -- default: 'left'
  modifiers={['shift']}// modifier keys required
  touches={2}          // exact touch point count (touch-only); omit for mouse/stylus
  axis="xy"            // 'x' | 'y' | 'xy' -- which axis delta to pass
  lockAxis="sticky"    // 'sticky' | 'free' -- axis arbitration for drag
  lockThreshold={2}    // min pixels before sticky lock commits
/>
```

| Prop | Type | Default | Description |
|---|---|---|---|
| `event` | `'drag' \| 'click'` | `'drag'` | Whether to match pointer drag or click. |
| `button` | `MouseButton` | `'left'` | Mouse button: `'left'`, `'middle'`, `'right'`. Ignored when `touches` is set. |
| `modifiers` | `ModifierKey[]` | — | Required modifier keys: `'alt'`, `'ctrl'`, `'meta'`, `'shift'`. |
| `touches` | `number` | — | Exact number of simultaneous touch points (touch-only). When omitted, the map matches mouse/stylus input only. When set, `button` is ignored. |
| `axis` | `'x' \| 'y' \| 'xy'` | — | Axis filter applied to the drag delta. |
| `lockAxis` | `'sticky' \| 'free'` | — | Sticky: locks to dominant axis after `lockThreshold` pixels. |
| `lockThreshold` | `number` | `2` | Minimum movement before sticky axis commits. |

**Touch matching:** `touches` means "exactly N fingers." `touches={2}` matches when exactly 2 fingers are tracked. When `touches` is undefined, the map matches single-pointer (mouse/stylus) events only. A finger settle window (80ms) allows additional fingers to arrive before committing. Higher `touches` values take priority when multiple maps match.

### WheelMap

Maps mouse wheel or trackpad scroll to an action.

```tsx
<WheelMap
  modifiers={['meta']} // only match when Cmd/Ctrl is held
  axis="xy"            // 'x' | 'y' | 'xy'
  lockAxis="sticky"    // axis arbitration
/>
```

| Prop | Type | Default | Description |
|---|---|---|---|
| `modifiers` | `ModifierKey[]` | — | Required modifier keys. |
| `axis` | `'x' \| 'y' \| 'xy'` | — | Axis filter. |
| `lockAxis` | `'sticky' \| 'free'` | — | Sticky: locks to the dominant axis after initial movement. Free: no axis lock. |

A `<WheelMap>` without modifiers matches **all** unmodified wheel events. When a wheel event matches a `WheelMap`, it is consumed — it does NOT also drive scene scroll. This is why the default input spec uses modifier-only `WheelMap` entries (meta for orbit, shift for pan) — plain scroll is never consumed.

**Important:** Adding an unmodified `<WheelMap>` (no modifiers) to an action will capture all scroll and prevent scene navigation for that scroll axis. This breaks the "scroll is sacred" principle. Only do this intentionally (e.g., in a single-scene canvas-region viewer where scene navigation is not needed).

### KeyMap

Maps a keyboard key to an action.

```tsx
<KeyMap keyName="ArrowRight" />
<KeyMap keyName="r" modifiers={['shift']} />
```

| Prop | Type | Required | Description |
|---|---|---|---|
| `keyName` | `string` | no | Value of `KeyboardEvent.key` (e.g., `'ArrowRight'`, `'r'`, `' '`). Optional in the type, but the compiler throws an error if empty or omitted. |
| `modifiers` | `ModifierKey[]` | no | Required modifier keys. |

Use `keyName`, not `key`. The `key` prop on JSX elements is React's special reconciliation prop; using it causes a deprecation warning and unreliable behavior.

Common `keyName` values: `'ArrowLeft'`, `'ArrowRight'`, `'ArrowUp'`, `'ArrowDown'`, `'Enter'`, `' '` (space), single character letters like `'r'`.

**Focus gating:** Keyboard events only fire when the `ScrollStage` container has focus (or contains the active element). The stage auto-focuses when the mouse enters it. On mobile, touch does not trigger auto-focus to avoid dismissing on-screen keyboards.

### PinchMap

Maps two-finger pinch gestures (touch) or ctrl+wheel (trackpad pinch simulation) to an action.

```tsx
<PinchMap
  direction="both"    // 'in' | 'out' | 'both'
  threshold={1}       // minimum pixel delta before dispatching
/>
```

| Prop | Type | Default | Description |
|---|---|---|---|
| `direction` | `'in' \| 'out' \| 'both'` | `'both'` | Which pinch direction to match. |
| `modifiers` | `ModifierKey[]` | — | Required modifier keys. |
| `threshold` | `number` | `1` | Minimum distance delta before dispatching. |

Trackpad pinch-to-zoom arrives as `ctrl+wheel` in browsers. When a `PinchMap` is configured for an action, `InputCoordinator` intercepts `ctrl+wheel` and routes it to that action instead of the wheel action waterfall.

---

## InputCoordinator (Player Level)

`InputCoordinator` is a null-rendering React component placed inside `ScrollStage` (or as a direct child of `SceneEngine`) that:

1. Attaches pointer/wheel/keyboard event listeners based on the compiled `scope` (canvas or window)
2. Implements wheel inertia for scene scroll navigation (Y-axis) and carousel navigation (X-axis)
3. Reads the compiled `SceneInputControllerSpec` from each tick and dispatches actions to the engine
4. Implements a wheel priority waterfall: scrollable overlay content -> ctrl+wheel pinch -> WheelMap match -> inertia scroll -> browser default
5. Classifies multi-touch gestures (1-finger scroll, 2-finger orbit, pinch zoom, 3-finger pan)

```tsx
<ScrollStage ...>
  ...
  <InputCoordinator
    inertiaSensitivity={0.01}
    inertiaDecay={0.85}
    pauseWhenHidden={{ threshold: 0.1 }}
  />
</ScrollStage>
```

| Prop | Type | Default | Description |
|---|---|---|---|
| `inertiaSensitivity` | `number` | `0.01` | Wheel scroll sensitivity. Higher = faster scene scroll. |
| `inertiaDecay` | `number` | `0.85` | Momentum decay per frame. Higher = more momentum after scroll. |
| `target` | `HTMLElement \| null` | scroll container | DOM element receiving pointer/wheel events. Overrides scope resolution. |
| `keyboardTarget` | `HTMLElement \| Document \| Window \| null` | `document` | DOM element receiving keyboard events. Overrides scope resolution. |
| `pauseWhenHidden` | `PauseWhenHiddenOptions` | — | Pause rendering when stage visibility drops below threshold. |

`InputCoordinator` is required to enable keyboard arrow key navigation between scenes, wheel-inertia scene scrolling, and action-based camera control. Without it, nothing responds to user input.

---

## Complete Examples

### Minimal Scene (No InputController Needed)

Most scenes need no `<InputController>` at all. The defaults provide everything:

```tsx
import { Background, Camera, Lighting, Scene } from '@brewsite/core';
import { Model } from '@brewsite/model';

export function ProductViewerScene() {
  return (
    <Scene id="product-viewer">
      <Camera mode="world" position={[0, 1, 3.5]} target={[0, 0.5, 0]} fov={40} />
      <Lighting>...</Lighting>
      <Background color="#111" />
      <Model id="product" type="ProductModel" x={0.5} y={0.5} w={0.7} h={0.8} />
      {/* No InputController needed — defaults provide:
          Cmd+scroll orbit, pinch zoom, Shift+scroll pan, R reset,
          arrow key scene/carousel nav, scroll Y/X navigation */}
    </Scene>
  );
}
```

### Merge Mode: Adding Left-Drag Orbit

```tsx
import {
  Action,
  Background,
  Camera,
  InputController,
  Lighting,
  PointerMap,
  Scene,
} from '@brewsite/core';
import { Model } from '@brewsite/model';

export function InteractiveViewerScene() {
  return (
    <Scene id="interactive-viewer">
      <Camera id="cam" mode="world" position={[0, 1, 3.5]} target={[0, 0.5, 0]} fov={40} />
      <Lighting>...</Lighting>
      <Background color="#111" />
      <Model id="product" type="ProductModel" x={0.5} y={0.5} w={0.7} h={0.8} />

      <InputController>
        {/* Adds left-drag orbit ON TOP of defaults */}
        <Action id="drag-orbit" type="camera.orbit" cameraId="cam">
          <PointerMap event="drag" button="left" />
        </Action>
        {/* Also add right-drag with slower speed */}
        <Action id="orbit-slow" type="camera.orbit" cameraId="cam" speed={0.6}>
          <PointerMap event="drag" button="right" />
        </Action>
      </InputController>
    </Scene>
  );
}
```

### Replace Mode: Full Custom Bindings

```tsx
import {
  Action,
  Background,
  Camera,
  InputController,
  KeyMap,
  Lighting,
  PinchMap,
  PointerMap,
  Scene,
  WheelMap,
} from '@brewsite/core';
import { Model } from '@brewsite/model';

export function FullCustomScene() {
  return (
    <Scene id="custom-bindings">
      <Camera id="cam" mode="world" position={[0, 1.5, 7]} target={[0, 0, 0]} fov={48} />
      <Lighting>...</Lighting>
      <Background color="#0a0a14" />
      <Model id="product" type="ProductModel" x={0.5} y={0.5} w={0.8} h={0.8} />

      {/* mode="replace" — no defaults, only these actions */}
      <InputController scope="canvas" mode="replace">
        <Action id="orbit" type="camera.orbit" cameraId="cam">
          <PointerMap event="drag" button="left" axis="xy" />
        </Action>
        <Action id="zoom" type="camera.zoom" cameraId="cam">
          <WheelMap axis="y" />
          <PinchMap direction="both" />
        </Action>
        <Action id="pan" type="camera.pan" cameraId="cam">
          <PointerMap event="drag" button="left" modifiers={['shift']} axis="xy" />
        </Action>
        <Action id="reset" type="camera.reset" cameraId="cam">
          <KeyMap keyName="r" />
        </Action>
        <Action id="next" type="scene.next">
          <KeyMap keyName="ArrowDown" />
        </Action>
        <Action id="prev" type="scene.prev">
          <KeyMap keyName="ArrowUp" />
        </Action>
      </InputController>
    </Scene>
  );
}
```

### Carousel with Keyboard and Click

```tsx
<Scene id="carousel-scene" primaryCarouselId="feature-carousel">
  <ViewLayout id="feature-carousel" kind="carousel" activeIndex={0} inactiveScale={0.75} zStep={6} gap={0.04}>
    <View id="panel-a" w={0.4} h={0.85}><Model id="a" type="FeatureA" x={0} y={0} w={1} h={1} /></View>
    <View id="panel-b" w={0.4} h={0.85}><Model id="b" type="FeatureB" x={0} y={0} w={1} h={1} /></View>
    <View id="panel-c" w={0.4} h={0.85}><Model id="c" type="FeatureC" x={0} y={0} w={1} h={1} /></View>
  </ViewLayout>

  {/* Override default carousel to add click-to-advance */}
  <InputController>
    <Action id="default-carousel-next" type="carousel.next" layoutId="feature-carousel">
      <KeyMap keyName="ArrowRight" />
      <PointerMap event="click" />
    </Action>
    <Action id="default-carousel-prev" type="carousel.prev" layoutId="feature-carousel">
      <KeyMap keyName="ArrowLeft" />
    </Action>
  </InputController>
</Scene>
```

Set `primaryCarouselId` on the `<Scene>` to enable the `'__primary_carousel__'` sentinel in input actions — this lets `InputCoordinator` route horizontal scroll to the carousel automatically.

### Scene Navigation with Keyboard

```tsx
<Scene id="slideshow">
  <InputController>
    <Action id="next" type="scene.next" stepScenes={1}>
      <KeyMap keyName="ArrowRight" />
      <KeyMap keyName=" " />
    </Action>
    <Action id="prev" type="scene.prev" stepScenes={1}>
      <KeyMap keyName="ArrowLeft" />
    </Action>
  </InputController>

  <Camera ... />
  <Background color="#0a0a14" />
  <Model ... />
</Scene>
```

When inside a `ScrollStage`, `scene.next`/`scene.prev` sync the scroll position via `ScrollNavigatorContext` rather than writing `engine.setProgress()` directly. This keeps the native scroll position in sync with the animated engine position.
