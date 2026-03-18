---
title: Scene DSL
doc_type: guide
owner: claude-author
status: active
updated: 2026-03-18
---

## Scene Component

`Scene` is the root DSL element. Every scene in a `SceneEngine` must be wrapped in a `<Scene>` with a unique `id`. Scenes render null — they register their compiled state with the engine via React context.

```tsx
import { Scene } from '@brewsite/core';

function Scene01Hero(): JSX.Element {
  return (
    <Scene id="hero">
      <Camera ... />
      <Lighting>...</Lighting>
      <Background color="#0a0a14" />
      <Model id="product" type="ProductHero" x={0.5} y={0.5} w={0.7} h={0.9} />
    </Scene>
  );
}
```

### Scene Props

| Prop | Type | Description |
|---|---|---|
| `id` | `string` | Unique identifier within one engine. Recommended. If omitted, the compiler falls back to the React `key` prop. If neither is present, a warning is logged and a default `'scene'` id is used. Explicitly setting `id` is strongly recommended for stable scene identity. |
| `transition` | `'dissolve' \| 'crossfade' \| TransitionWindow` | Transition type for entering this scene. Default: `'dissolve'`. |
| `exitStart` | `number` | Block progress [0, 0.99] at which the outgoing scene begins fading. Default: `0.8`. Only valid when `transition` is `'dissolve'` or omitted — providing `exitStart` with `'crossfade'` or a `TransitionWindow` is a TypeScript compile error. |
| `meta` | `Record<string, JsonPrimitive>` | Arbitrary metadata attached to the compiled frame. |
| `primaryCarouselId` | `string` | Widget id of the primary carousel layout for this scene. Enables the `'__primary_carousel__'` sentinel in carousel actions. |
| `metalnessMultiplier` | `number` | Multiplier applied to base metalness for all model materials in this scene. |
| `roughnessMultiplier` | `number` | Multiplier applied to base roughness for all model materials in this scene. |

### Scene Sequencing Rules

- Scenes render in declaration order. The first `<Scene>` in the engine is scene index 0.
- All scenes within one `SceneEngine` share a single compiled `SceneTrack`.
- Entry transitions belong to the incoming scene (`transition` prop on the scene being entered). See `transitions` guide.
- `exitStart` on the last scene has no effect — there is no outgoing transition from the final scene. The compiler warns you.

### Multi-Scene Example

```tsx
function MyScenesPage() {
  const plugins = useMemo(() => [corePlugin()], []);
  return (
    <SceneEngine plugins={plugins}>
      {/* Scene 1 — default dissolve */}
      <Scene id="intro">
        <Camera mode="world" position={[0, 1, 4]} target={[0, 0.5, 0]} />
        <Background color="#0a0a14" />
      </Scene>

      {/* Scene 2 — crossfade entry */}
      <Scene id="features" transition="crossfade">
        <Camera mode="world" position={[0, 1.5, 5]} target={[0, 0.5, 0]} />
        <Background color="#0d0d20" />
      </Scene>

      {/* Scene 3 — dissolve, late exit */}
      <Scene id="closing" transition="dissolve" exitStart={0.9}>
        <Background color="#030510" />
      </Scene>

      <ScrollStage scrollHeightMode="scene-count" pixelsPerScene={1200}>
        <SceneCanvas style={{ position: 'absolute', inset: 0 }} />
        <EngineOverlayHost />
        <InputCoordinator />
      </ScrollStage>
    </SceneEngine>
  );
}
```

---

## ProgressManager

`ProgressManager` declares per-scene scroll weight, auto-advance, animation time scale, and programmatic transition overrides. Place it as a direct child of `<Scene>`.

```tsx
import { ProgressManager, Scene } from '@brewsite/core';

<Scene id="hero">
  <ProgressManager
    scrollUnits={1800}
    autoAdvance={{ duration: 8, max: 0.80, pauseOnScroll: true }}
    animationTimeScale={3}
    transitionDuration={600}
  />
  ...
</Scene>
```

### ProgressManager Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `scrollUnits` | `number` | `1` | Proportional scroll budget. Unitless — relative to all scenes. `scrollUnits={2}` = twice the scroll travel. Values <= 0 are silently clamped to 0.001. |
| `fn` | `(localT: number) => number` | identity | Input pacing curve mapping local raw progress to engine progress. Must satisfy `fn(0)=0`, `fn(1)=1`, monotonically non-decreasing. |
| `animationTimeScale` | `number` | — | Total animation-seconds played when user scrolls through this scene's full window in one pass. Useful range: 2–12. |
| `autoAdvance` | `{ duration: number; max?: number; pauseOnScroll?: boolean }` | — | Automatically advance the scene on a wall-clock timer while the user is idle. |
| `transitionDuration` | `number` | engine default (400ms) | Duration in ms for programmatic (keyboard/button) transitions *from* this scene. |
| `transitionEasing` | `TransitionEasing` | cubic ease-in-out | Easing for programmatic transitions from this scene. |

**Carry-forward semantics:** If a scene omits `<ProgressManager>`, it inherits the previous scene's spec. The ultimate default is `{ scrollUnits: 1, fn: identity }`.

### scrollUnits and Scroll Travel

When `ScrollStage` uses `scrollHeightMode="scroll-units"`, the total scroll height is proportional to the sum of all `scrollUnits` values. A scene with `scrollUnits={1800}` gets 1800px of scroll travel when `pixelsPerScrollUnit=1`. Scenes with more scroll units require more scrolling to progress through, which gives slower-paced reveals.

```tsx
<Scene id="hero">
  <ProgressManager scrollUnits={1800} />  {/* long scroll — slow reveal */}
</Scene>

<Scene id="feature">
  <ProgressManager scrollUnits={600} />   {/* short scroll — quick transition */}
</Scene>
```

Use `scrollHeightMode="scroll-units"` with `pixelsPerScrollUnit` to control the exact pixels-per-unit relationship.

---

## View and ViewLayout

`View` and `ViewLayout` are spatial composition elements for creating contained regions and multi-panel layouts.

### View

`View` creates a named NVS subregion. Elements inside a `View` author in the View's local NVS space (0,0 = View's top-left, 1,1 = View's bottom-right).

```tsx
import { View } from '@brewsite/core';

<Scene id="split-layout">
  {/* Right panel: x=0.4 to x=1.0, full height */}
  <View id="right-panel" x={0.4} y={0} w={0.6} h={1} padding={[0.05, 0.04]}>
    <Model id="robot" type="Robot" x={0} y={0} w={1} h={1} />
  </View>
</Scene>
```

### View Props

| Prop | Type | Description |
|---|---|---|
| `id` | `string` | Required. Stable view identity. |
| `x` | `number` | NVS x position [0..1]. Ignored when inside a `ViewLayout`. |
| `y` | `number` | NVS y position [0..1]. Ignored when inside a `ViewLayout`. |
| `w` | `number` | NVS width [0..1]. Size hint when inside a `ViewLayout`. |
| `h` | `number` | NVS height [0..1]. Size hint when inside a `ViewLayout`. |
| `padding` | `RegionPadding` | Padding inset. `[topBottom, leftRight]` or `[top, right, bottom, left]` as fractions of View dimensions. |
| `children` | `ReactNode` | Exactly one renderable DSL element. |

### ViewLayout

`ViewLayout` arranges multiple `View` children using a layout policy.

```tsx
import { View, ViewLayout } from '@brewsite/core';

<ViewLayout kind="stack" direction="horizontal" x={0} y={0} w={1} h={1} gap={0.02}>
  <View id="panel-a" w={0.5} h={1}>
    <Model id="model-a" type="ProductA" x={0} y={0} w={1} h={1} />
  </View>
  <View id="panel-b" w={0.5} h={1}>
    <Model id="model-b" type="ProductB" x={0} y={0} w={1} h={1} />
  </View>
</ViewLayout>
```

### ViewLayout Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `id` | `string` | auto-generated | Stable layout identity. |
| `kind` | `ViewLayoutKind` | required | Layout policy: `'stack'` or `'carousel'`. |
| `x` | `number` | `0` | NVS x position of the layout container. |
| `y` | `number` | `0` | NVS y position of the layout container. |
| `w` | `number` | `1` | NVS width of the layout container. |
| `h` | `number` | `1` | NVS height of the layout container. |
| `gap` | `number` | — | NVS gap between views. |

**Stack-specific:**

| Prop | Type | Default | Description |
|---|---|---|---|
| `direction` | `'horizontal' \| 'vertical'` | `'horizontal'` | Stack direction. |

**Carousel-specific:**

| Prop | Type | Default | Description |
|---|---|---|---|
| `activeIndex` | `number` | `0` | Zero-indexed active view. |
| `inactiveScale` | `number` | `0.75` | Scale factor for inactive panels. |
| `zStep` | `number` | `0` | World-space Z depth per position. Pushes side panels back. |
| `loop` | `boolean` | `false` | Views wrap in an elliptical ring instead of a linear fan. |
| `spread` | `number` | auto | Horizontal spread of the loop ellipse [0..1]. |
| `fadeMin` | `number` | `1.0` | Minimum opacity for farthest-back views when `loop=true`. |

### Carousel Example

```tsx
<Scene id="product-carousel" primaryCarouselId="main-carousel">
  <ViewLayout
    id="main-carousel"
    kind="carousel"
    activeIndex={1}
    inactiveScale={0.72}
    zStep={9}
    gap={0.03}
    y={0} h={1}
  >
    <View id="panel-left" w={0.38} h={0.88}>
      <Model id="model-a" type="ProductA" x={0} y={0} w={1} h={1} />
    </View>
    <View id="panel-center" w={0.38} h={0.88}>
      <Model id="model-b" type="ProductB" x={0} y={0} w={1} h={1} />
    </View>
    <View id="panel-right" w={0.38} h={0.88}>
      <Model id="model-c" type="ProductC" x={0} y={0} w={1} h={1} />
    </View>
  </ViewLayout>

  {/* No InputController needed — defaults provide ArrowRight/ArrowLeft carousel nav
      and horizontal scroll carousel via the __primary_carousel__ sentinel.
      Override only if you need custom bindings like click-to-advance: */}
  <InputController>
    <Action id="default-carousel-next" type="carousel.next" layoutId="main-carousel">
      <KeyMap keyName="ArrowRight" />
      <PointerMap event="click" button="right" />
    </Action>
    <Action id="default-carousel-prev" type="carousel.prev" layoutId="main-carousel">
      <KeyMap keyName="ArrowLeft" />
    </Action>
  </InputController>
</Scene>
```

Set `primaryCarouselId` on the `<Scene>` to enable the `'__primary_carousel__'` sentinel in input actions — this lets `InputCoordinator` route horizontal scroll and default ArrowRight/ArrowLeft keys to the carousel automatically. In most cases, setting `primaryCarouselId` alone is sufficient and no `<InputController>` is needed.

---

## HUD System

BrewSite does not have a separate HUD DSL system. HTML overlay content is authored directly as JSX children inside `<Scene>` — any non-DSL JSX inside a Scene is treated as overlay content and rendered by `EngineOverlayHost`.

```tsx
<Scene id="intro">
  <Camera ... />
  <Background color="#0a0a14" />
  <Model id="hero" type="Robot" ... />

  {/* HTML overlay — appears above the 3D canvas */}
  <div key="title" style={{ position: 'absolute', top: '10%', left: '5%' }}>
    <h1 style={{ color: 'white', fontSize: 48 }}>Hello World</h1>
    <p style={{ color: 'rgba(255,255,255,0.7)' }}>Subheading text</p>
  </div>
</Scene>
```

Overlay elements must have a `key` prop. If an element has an `id` prop but no `key`, the compiler will use `id` as the React key automatically. In development, missing keys produce compile warnings.

`EngineOverlayHost` renders the current scene's overlay content and animates the opacity on scene change (`brewsite-overlay-enter` keyframe, 200ms ease-out by default). You can disable or customize this transition:

```tsx
<EngineOverlayHost overlayTransition={{ enabled: false }} />
// or
<EngineOverlayHost overlayTransition={{ durationMs: 400, easing: 'ease-in-out' }} />
```

`EngineOverlayHost` also accepts children that persist across scene changes (not remounted on scene transitions). These are rendered *outside* the keyed overlay wrapper:

```tsx
<EngineOverlayHost>
  {/* This persists and never remounts, even during scene changes */}
  <PersistentTooltipHost />
</EngineOverlayHost>
```

### Using CSS Variables for Scaled Text

When `EngineARContainer` is in use, the `--scene-scale` CSS property is injected. Use it for text that scales with the canvas:

```tsx
<div key="label" style={{
  position: 'absolute',
  top: '15%',
  left: '5%',
  fontSize: 'calc(48px * var(--scene-scale, 1))',
  color: 'white',
}} />
```
