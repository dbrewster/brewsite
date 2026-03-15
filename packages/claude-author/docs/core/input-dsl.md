---
title: Input DSL
doc_type: guide
owner: claude-author
status: active
updated: 2026-03-15
---

## Two Input Systems

BrewSite has two orthogonal input systems that work at different layers.

**1. Scene navigation input (player-level)** — Controls which scene is active and how the engine progress value changes. Provided by player components: `ScrollStage` for scroll-driven navigation, `TimeInput` for auto-advance, `ControlledInput` for external state, and `InputCoordinator` for wheel-inertia + keyboard navigation. These components live outside the DSL and are not authored inside `<Scene>`.

**2. Action-based input (DSL-level)** — Controls camera orbit/zoom/pan, carousel stepping, and custom interactions within a scene. Authored inside `<Scene>` via `<InputController>` and `<Action>` DSL components. At runtime, `InputCoordinator` reads the compiled action spec from the active tick and dispatches events to the engine.

These systems compose: you can have both a `ScrollStage` (scene navigation) and an `<InputController>` (camera orbit) active at the same time. The wheel waterfall in `InputCoordinator` prioritizes action-mapped wheel events over scroll navigation — a `<WheelMap>` on a camera zoom action prevents that wheel gesture from scrolling to the next scene.

---

## InputController DSL Component

`InputController` declares the action-based input configuration for a scene. Place it as a direct child of `<Scene>`. Only one `InputController` is allowed per scene.

```tsx
import { InputController, Action, PointerMap, WheelMap, KeyMap, PinchMap } from '@brewsite/core';

<Scene id="viewer">
  <InputController id="main" scope="canvas">
    <Action id="orbit" type="camera.orbit">
      <PointerMap event="drag" button="left" />
    </Action>
    <Action id="zoom" type="camera.zoom">
      <WheelMap />
      <PinchMap direction="both" />
    </Action>
  </InputController>
</Scene>
```

### InputControllerProps

| Prop | Type | Default | Description |
|---|---|---|---|
| `id` | `string` | `'main'` | Identifier for this controller spec. |
| `scope` | `'canvas' \| 'window'` | `'canvas'` | DOM scope for pointer/wheel event attachment. |

`InputController` compiles to a `SceneInputControllerSpec` stored at widget id `'__input_controller'` in the compiled tick state. `InputCoordinator` reads this spec each frame.

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
| `id` | `string` | Required. Unique within the parent `InputController`. |
| `type` | `InputActionType` | Required. Action type string. See InputActionType Values below. |
| `cameraId` | `string` | Target camera widget id for camera actions. Falls back to `primaryCameraId` on `SceneEngine`. |
| `canvasId` | `string` | Target canvas widget id for canvas-specific actions (used by diagram plugin extensions). |
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
  button="left"        // 'left' | 'middle' | 'right' — default: 'left'
  modifiers={['shift']}// modifier keys required
  axis="xy"            // 'x' | 'y' | 'xy' — which axis delta to pass
  lockAxis="sticky"    // 'sticky' | 'free' — axis arbitration for drag
  lockThreshold={2}    // min pixels before sticky lock commits
/>
```

| Prop | Type | Default | Description |
|---|---|---|---|
| `event` | `'drag' \| 'click'` | `'drag'` | Whether to match pointer drag or click. |
| `button` | `MouseButton` | `'left'` | Mouse button: `'left'`, `'middle'`, `'right'`. |
| `modifiers` | `ModifierKey[]` | — | Required modifier keys: `'alt'`, `'ctrl'`, `'meta'`, `'shift'`. |
| `axis` | `'x' \| 'y' \| 'xy'` | — | Axis filter applied to the drag delta. |
| `lockAxis` | `'sticky' \| 'free'` | — | Sticky: locks to dominant axis after `lockThreshold` pixels. |
| `lockThreshold` | `number` | `2` | Minimum movement before sticky axis commits. |

### WheelMap

Maps mouse wheel or trackpad scroll to an action.

```tsx
<WheelMap
  modifiers={['alt']}  // only match when Alt is held
  axis="y"             // 'x' | 'y' | 'xy'
  lockAxis="sticky"    // axis arbitration
/>
```

| Prop | Type | Default | Description |
|---|---|---|---|
| `modifiers` | `ModifierKey[]` | — | Required modifier keys. |
| `axis` | `'x' \| 'y' \| 'xy'` | — | Axis filter. |
| `lockAxis` | `'sticky' \| 'free'` | — | Sticky axis lock within a 180ms idle window. |

A `<WheelMap>` without modifiers matches all unmodified wheel events. When a wheel event matches a `WheelMap`, it is consumed — it does NOT also drive scene scroll. This is the mechanism for dedicating the scroll wheel to camera zoom instead of scene navigation.

### KeyMap

Maps a keyboard key to an action.

```tsx
<KeyMap keyName="ArrowRight" />
<KeyMap keyName="r" modifiers={['shift']} />
```

| Prop | Type | Description |
|---|---|---|
| `keyName` | `string` | Required. Value of `KeyboardEvent.key` (e.g., `'ArrowRight'`, `'r'`, `' '`). |
| `modifiers` | `ModifierKey[]` | Required modifier keys. |

Use `keyName`, not `key`. The `key` prop on JSX elements is React's special reconciliation prop; using it causes a deprecation warning and unreliable behavior.

Common `keyName` values: `'ArrowLeft'`, `'ArrowRight'`, `'ArrowUp'`, `'ArrowDown'`, `'Enter'`, `' '` (space), single character letters like `'r'`.

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

1. Attaches pointer/wheel/keyboard event listeners to the scroll container or canvas
2. Implements wheel inertia for scene scroll navigation
3. Reads the compiled `SceneInputControllerSpec` from each tick and dispatches actions to the engine (camera orbit, zoom, pan, reset; scene step; carousel step)
4. Implements a wheel priority waterfall: scrollable overlay content → ctrl+wheel pinch → WheelMap match → inertia scroll → browser default

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
| `target` | `HTMLElement \| null` | scroll container | DOM element receiving pointer/wheel events. |
| `keyboardTarget` | `HTMLElement \| Document \| Window \| null` | `document` | DOM element receiving keyboard events. |
| `pauseWhenHidden` | `PauseWhenHiddenOptions` | — | Pause rendering when stage visibility drops below threshold. |

`InputCoordinator` is required to enable keyboard arrow key navigation between scenes, wheel-inertia scene scrolling, and action-based camera control. Without it, nothing responds to user input.

---

## Complete Examples

### Camera Orbit and Zoom Scene

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

export function ProductViewerScene() {
  return (
    <Scene id="product-viewer">
      <Camera id="cam" mode="world" position={[0, 1, 3.5]} target={[0, 0.5, 0]} fov={40} />
      <Lighting>...</Lighting>
      <Background color="#111" />
      <Model id="product" type="ProductModel" x={0.5} y={0.5} w={0.7} h={0.8} />

      <InputController>
        <Action id="orbit" type="camera.orbit" cameraId="cam" speed={1.0}>
          <PointerMap event="drag" button="left" />
        </Action>

        <Action id="zoom" type="camera.zoom" cameraId="cam" speed={1.0}>
          <WheelMap />
          <PinchMap direction="both" />
        </Action>

        <Action id="pan" type="camera.pan" cameraId="cam" speed={0.8}>
          <PointerMap event="drag" button="right" />
          <PointerMap event="drag" button="left" modifiers={['shift']} />
        </Action>

        <Action id="reset" type="camera.reset" cameraId="cam">
          <KeyMap keyName="r" />
          <PointerMap event="click" button="middle" />
        </Action>
      </InputController>
    </Scene>
  );
}
```

### Scene Navigation with Keyboard

```tsx
<Scene id="slideshow">
  <InputController>
    <Action id="next" type="scene.next" stepScenes={1}>
      <KeyMap keyName="ArrowRight" />
      <KeyMap keyName=" " />
      <PointerMap event="click" button="left" />
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

### Carousel with Keyboard and Click

```tsx
<Scene id="carousel-scene" primaryCarouselId="feature-carousel">
  <ViewLayout id="feature-carousel" kind="carousel" activeIndex={0} inactiveScale={0.75} zStep={6} gap={0.04}>
    <View id="panel-a" w={0.4} h={0.85}><Model id="a" type="FeatureA" x={0} y={0} w={1} h={1} /></View>
    <View id="panel-b" w={0.4} h={0.85}><Model id="b" type="FeatureB" x={0} y={0} w={1} h={1} /></View>
    <View id="panel-c" w={0.4} h={0.85}><Model id="c" type="FeatureC" x={0} y={0} w={1} h={1} /></View>
  </ViewLayout>

  <InputController>
    <Action id="carousel-next" type="carousel.next" layoutId="feature-carousel">
      <KeyMap keyName="ArrowRight" />
    </Action>
    <Action id="carousel-prev" type="carousel.prev" layoutId="feature-carousel">
      <KeyMap keyName="ArrowLeft" />
    </Action>
  </InputController>
</Scene>
```

`primaryCarouselId` on the Scene enables `InputCoordinator`'s horizontal scroll routing to the carousel automatically via the `'__primary_carousel__'` sentinel.
