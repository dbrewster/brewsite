---
title: Common Gotchas
doc_type: guide
owner: claude-author
status: active
updated: 2026-03-21
---

## Entry Transition on the Wrong Scene

**Symptom:** Elements appear/disappear abruptly instead of fading. Transitions seem to fire at the wrong moment or not at all.

**Cause:** Authoring `transition` or `<Transition>` children on the *outgoing* scene instead of the *incoming* scene.

**Rule:** The incoming scene owns its own arrival. The `transition` prop on `<Scene id="scene-two">` controls how elements enter when navigating TO scene-two. The outgoing scene (scene-one) has no concept of "my exit."

**Wrong:**
```tsx
// Authoring crossfade on scene-one when you want it to appear when scene-two arrives
<Scene id="scene-one" transition="crossfade">
  <Model id="hero" opacity={1} ... />
</Scene>
<Scene id="scene-two">
  <Model id="hero" opacity={0} ... />
</Scene>
```

**Correct:**
```tsx
<Scene id="scene-one">
  <Model id="hero" opacity={1} ... />
</Scene>
// This crossfade controls how scene-two's elements blend IN
<Scene id="scene-two" transition="crossfade">
  <Model id="hero" opacity={1} ... />
</Scene>
```

---

## Three.js Import in a Scene or DSL File

**Symptom:** Build errors, TypeScript errors, or accidental Three.js version mismatches. If no immediate error, the element module architecture is compromised and future changes will be harder.

**Cause:** Importing `three` or any Three.js class (Vector3, Object3D, etc.) in a scene file, DSL component, or compile-time code.

**Rule:** Three.js is confined exclusively to `render.ts` files inside element modules. Scene files are pure JSX state declarations. Compiler code is pure transformations. No Three.js anywhere else.

**Wrong:**
```tsx
import * as THREE from 'three'; // NEVER in a scene file
import { Vector3 } from 'three'; // NEVER

function MyScene() {
  const pos = new Vector3(1, 2, 3); // NEVER
  return <Scene id="s1"><Model position={[pos.x, pos.y, pos.z]} /></Scene>;
}
```

**Correct:**
```tsx
// Just use unit strings in scene files
function MyScene() {
  return <Scene id="s1"><Model x={"50%"} y={"40%"} w={"60%"} h={"80%"} /></Scene>;
}
```

---

## Animation Math in Scene Files

**Symptom:** Scenes work at compile time but produce wrong output, or you're computing easing/interpolation values manually in JSX props.

**Cause:** Treating scene files as imperative animation code. Calling `Math.sin(t)`, computing lerp values, or writing time-dependent logic in scene JSX.

**Rule:** Scenes are state snapshots. They describe what things look like, not how things animate. All animation math lives in widget compile/render code. You declare the endpoint states; the compiler handles interpolation between scenes.

**Wrong:**
```tsx
// DO NOT compute animation values in scene files
const t = someProgress; // where does this come from?
const opacity = Math.sin(t * Math.PI); // animation math doesn't belong here

function BadScene() {
  return (
    <Scene id="s1">
      <Model opacity={opacity} ... />  {/* wrong approach */}
    </Scene>
  );
}
```

**Correct:**
```tsx
// Declare the state for this scene. The compiler handles transitions.
function GoodScene() {
  return (
    <Scene id="s1">
      <Model opacity={1} ...>
        <Transition enter={{ window: [0.6, 1.0], ease: easeOutCubic }} />
      </Model>
    </Scene>
  );
}
```

---

## NVS Y-Axis Direction

**Symptom:** Elements appear at the wrong vertical position. Something intended for the bottom appears at the top.

**Cause:** Assuming Y=0 is the bottom of the screen (standard 3D Y-up convention). In NVS, Y=0 is the TOP.

**Rule:** NVS Y-axis matches CSS: `y={"0%"}` is top edge, `y={"100%"}` is bottom edge. The internal conversion to Three.js world coordinates applies the Y-flip automatically.

**Wrong:**
```tsx
// Intending to place something near the bottom — this puts it near the TOP
<Model id="footer-model" x={"50%"} y={"10%"} w={"80%"} h={"20%"} />
```

**Correct:**
```tsx
// Near the bottom: high Y value
<Model id="footer-model" x={"50%"} y={"80%"} w={"80%"} h={"20%"} />
```

---

## Forgetting to Register Plugins

**Symptom:** Nothing renders. No 3D scene appears. No error — just a blank canvas.

**Cause:** `<SceneEngine>` was given no `plugins` prop, or `corePlugin()` was not included.

**Rule:** `plugins` is required on every `SceneEngine`. At minimum, include `corePlugin()`. Add `modelPlugin(...)` for GLTF models. Add `diagramPlugin` for diagrams.

**Wrong:**
```tsx
// Missing plugins — nothing will render
<SceneEngine>
  <MyScene />
  <SceneCanvas />
</SceneEngine>
```

**Correct:**
```tsx
import { corePlugin } from '@brewsite/core';
import { modelPlugin } from '@brewsite/model';

const plugins = useMemo(() => [
  corePlugin(),
  modelPlugin({ manifestUrl: '/assets/manifest.json' }),
], []);

<SceneEngine plugins={plugins}>
  <MyScene />
  <SceneCanvas />
</SceneEngine>
```

Also make sure `useMemo` wraps the plugins array to avoid re-registering on every render.

---

## Using CSS `position` on `SceneCanvas`

**Symptom:** Canvas is positioned incorrectly or overlaps other elements unexpectedly.

**Cause:** Adding `position: absolute` or `position: relative` directly to the `SceneCanvas` `style` prop at the wrong level.

**Rule:** `SceneCanvas` renders a `div` wrapper containing a `canvas`. Its default `style` passes through to the outer div. To position the canvas within a container, use a `position: relative` parent div and set the canvas to fill it. Do not try to NVS-position the canvas element itself.

**Common pattern:**
```tsx
// Outer container is position:relative; canvas fills it absolutely
<div style={{ position: 'relative', width: '100%', height: '100%' }}>
  <BackgroundLayer style={{ position: 'absolute', inset: 0, zIndex: 0 }} />
  <SceneCanvas style={{ position: 'absolute', inset: 0, zIndex: 1 }} />
  <EngineOverlayHost />
</div>
```

`ScrollStage` and `SceneReel` handle this layout automatically.

---

## Scene ID Collisions

**Symptom:** One scene's content visually overwrites another. Animations on one scene affect a different scene. Strange flicker.

**Cause:** Two `<Scene>` elements declared in the same `SceneEngine` with the same `id` string.

**Rule:** Scene `id` props must be unique within one `SceneEngine`. The compiler uses the id to key frames; duplicates cause the second to silently overwrite the first.

**Wrong:**
```tsx
<SceneEngine ...>
  <Scene id="intro">...</Scene>
  <Scene id="intro">...</Scene>  {/* collision — same id */}
</SceneEngine>
```

**Correct:**
```tsx
<SceneEngine ...>
  <Scene id="intro">...</Scene>
  <Scene id="features">...</Scene>
</SceneEngine>
```

---

## Missing Required Props on Elements

**Symptom:** TypeScript error, runtime error, or the element doesn't appear.

**Cause:** Common omissions:
- `<Model>` missing `type` — type is required and must match a registered model name in the manifest
- `<Action>` missing `id` — the compiler throws `<Action> requires a non-empty "id" prop`
- `<KeyMap>` missing `keyName` — the compiler throws `<KeyMap> requires a non-empty "keyName" prop`
- `<Action>` with zero child map components — must have at least one `<PointerMap>`, `<WheelMap>`, `<PinchMap>`, or `<KeyMap>`
- `<Scene>` missing `id` — causes a console warning and unpredictable frame keying

**Rule:** Always provide `id` on `<Scene>` and `<Action>`. Always provide `type` on `<Model>`. Always add at least one map child to `<Action>`. Use `keyName` not `key` on `<KeyMap>`.

---

## Import Path Mistakes

**Symptom:** TypeScript can't find the symbol, or you accidentally import a non-public internal.

**Cause:** Importing from the wrong package or from an internal file path.

**Rule:** Import only from package root entry points. Never reach into `src/` paths of a package.

**Wrong:**
```tsx
import { Scene } from '@brewsite/core/src/compiler/sceneDslCompiler'; // internal path
import { Model } from '@brewsite/core'; // Model is in @brewsite/model, not core
import { corePlugin } from '@brewsite/diagram'; // corePlugin is in @brewsite/core
```

**Correct:**
```tsx
import { Scene, ProgressManager, corePlugin, SceneEngine } from '@brewsite/core';
import { Model, modelPlugin } from '@brewsite/model';
import { Diagram, diagramPlugin } from '@brewsite/diagram';
import { chartPlugin } from '@brewsite/charts';
```

**Package map:**
- `@brewsite/core` — scene DSL (`Scene`, `View`, `ViewLayout`, `InputController`, `Action`, `Transition`, `ProgressManager`), lighting, camera, background, environment, floor, all player components
- `@brewsite/model` — `Model`, `Playback`, `Animation`, `LabelItem`, `LabelPositioner`, `modelPlugin`
- `@brewsite/diagram` — `Diagram`, `DiagramCanvas`, `ImagePanel`, `Screen`, `diagramPlugin`
- `@brewsite/charts` — chart elements, `chartPlugin`

---

## Theme Resolution at Render Time Instead of Compile Time

**Symptom:** Theme changes appear to work on the first toggle but stop updating when toggling back to a previously-seen polarity. The element gets stuck on the old theme colors even though the rest of the scene updates correctly.

**Cause:** Reading theme from `scene.userData.__brewsite_scene_theme` at render time. The scene theme registry (`resolveSceneTheme`) returns the same constant object reference for a given `family + polarity` pair. When toggling polarity back to a previously-visited value, React effects with `[sceneTheme]` deps use `Object.is` comparison and silently skip because the object reference is the same as before.

**Rule:** Resolve theme at compile time in the NodeHandler using `resolveSceneTheme(api.context.themeFamily, api.context.themePolarity)`. Bake themed values into the compiled state. When the theme changes, scene components re-render, the compiler re-runs, and the widget receives fresh state via `apply()`.

**Wrong:**
```typescript
// In render.ts or applyMyWidget():
const theme = scene.userData.__brewsite_scene_theme as SceneTheme;
const color = theme?.myElement?.color ?? '#default';
mesh.material.color.set(color);
```

**Correct:**
```typescript
// In the NodeHandler (viewHandlers.ts or your handlers.ts):
const sceneTheme = resolveSceneTheme(api.context.themeFamily, api.context.themePolarity);
const elementTheme = sceneTheme.myElement;
const state = compileMyElement({
  color: dslProps.color ?? elementTheme?.color,
  // ... priority: DSL props > theme values > compiled defaults
});
api.setWidgetState(widgetId, state);

// In render.ts — just use state.color directly, already theme-resolved:
mesh.material.color.set(state.color);
```

The carousel tray, diagrams, and charts all follow this compile-time pattern.

---

## Ghost Widgets from mergeSnapshot Returning Stale State

**Symptom:** A widget from a previous scene remains visible as a "ghost" on a scene that does not use it. The element persists through scene transitions and never disappears.

**Cause:** The widget's `mergeSnapshot()` returns `prev` unchanged when `next` is `undefined`. The runtime merges `prev` into the transition, so the widget keeps its last-known visible state indefinitely.

**Rule:** When `next` is `undefined` (the widget's scene is exiting and no new scene declares it), return a state that hides the element. Set `showBase: false`, `opacity: 0`, `visible: false`, or whatever makes the widget invisible in `apply()`.

**Wrong:**
```typescript
mergeSnapshot(prev, next) {
  if (!prev) return next;
  if (!next) return prev; // Ghost! Stale state persists.
  return { ...prev, ...next };
}
```

**Correct:**
```typescript
mergeSnapshot(prev, next) {
  if (!prev && !next) return undefined;
  if (!next && prev) return { ...prev, showBase: false }; // Hide on exit
  if (!prev) return next;
  return { ...prev, ...next };
}
```

---

## Node Too Small for Icon + Label + Sublabel

**Symptom:** Icon appears tiny or label text is unreadable. The node looks cramped with all content squeezed together.

**Cause:** The node's `size` is too small to fit an icon, label, and sublabel. The fit-to-content layout automatically scales down the icon to prevent overflow, but very small nodes produce unreadable results.

**Rule:** Use the standard recipe sizes as a floor. For icon + label + sublabel rectangles, `["15u", "8u"]` is the standard starting point. For circles/hexagons use `["12u", "12u"]` (square). For very content-rich nodes, increase height to `["15u", "10u"]` or more. See the full sizing table in [layout-spatial-awareness.md](./layout-spatial-awareness.md).

**Wrong:**
```tsx
// Too small — icon will be scaled down to near-invisible
<DiagramNode id="svc" label="Service" sublabel="v2.1" icon="tech:docker" size={["5u", "3u"]} />
```

**Correct:**
```tsx
// Standard size for icon + label + sublabel rectangle
<DiagramNode id="svc" label="Service" sublabel="v2.1" icon="tech:docker" size={["15u", "8u"]} />
```

---

## Using Bare Numbers Instead of Unit Strings for Diagram Values

**Symptom:** TypeScript errors or unexpected layout results because you used bare numbers like `0.15` instead of unit strings like `"15u"` for node sizes, gap, spacing, or thickness.

**Cause:** All diagram dimensional props — node `size`, `thickness`, `cornerRadius`, edge `thickness`, group `borderWidth`/`borderHeight`, and layout `gap`/`spacing` — now require **`SceneLength` unit strings** (e.g. `"15u"`, `"8u"`, `"50%"`). Bare fractional numbers are no longer accepted.

**Rule:** All dimensional values must use explicit unit strings. The standard node size is `["15u", "8u"]`. Standard node thickness ranges from `"3.3u"` (thin card) to `"21u"` (deep block). Standard edge thickness ranges from `"0.8u"` to `"1.1u"`. Standard cornerRadius ranges from `"0.6u"` to `"1.4u"`.

**Wrong:**
```tsx
// Bare numbers — no longer accepted
<Diagram id="d1" x={0.1} y={0.1} w={0.8} h={0.8}>
  <GridLayout columns={3} />
  <DiagramNode id="n1" label="API" size={[0.15, 0.08]} thickness={0.075} />  {/* wrong — bare numbers */}
</Diagram>
```

**Correct:**
```tsx
// SceneLength unit strings
<Diagram id="d1" x={"10%"} y={"10%"} w={"80%"} h={"80%"}>
  <GridLayout columns={3} />
  <DiagramNode id="n1" label="API" size={["15u", "8u"]} thickness={"7.5u"} />  {/* unit strings */}
</Diagram>
```

---

## Square Nodes Need Equal Width and Height

**Symptom:** A node intended to be square renders as a rectangle.

**Cause:** Using unequal width and height values in the `size` prop. After the aspect ratio correction, `size={["12u", "12u"]}` renders as a true square, and `size={["15u", "8u"]}` renders as a rectangle.

**Rule:** For square nodes, always use equal width and height: `size={["12u", "12u"]}`. For rectangular nodes, use different values: `size={["15u", "8u"]}`.

**Wrong:**
```tsx
// Intended to be square but renders as rectangle
<DiagramNode id="icon-node" shape="circle" size={["15u", "8u"]} />
```

**Correct:**
```tsx
// Equal dimensions = square (or true circle for circle shape)
<DiagramNode id="icon-node" shape="circle" size={["12u", "12u"]} />
```

---

## Using Excessively Large Gap or Spacing Values

**Symptom:** Diagram nodes appear tiny — much smaller than the authored `size` values suggest. A node with `size={["15u", "8u"]}` renders at a fraction of its expected size.

**Cause:** The `gap` or `spacing` value is excessively large (e.g., `gap={"90u"}` or `spacing={["24u", "11u"]}`). When the total of all item sizes + gaps exceeds the viewport, the `normalizeToViewport` pass uniformly scales everything down to fit, shrinking nodes far below their authored size.

**Rule:** All layout spacing props (`gap`, `spacing`, `margin`, `groupPadding`, `titleGap`) use `SceneLength` unit strings. FlowLayout default gap is `"6u"`. GridLayout default spacing is `["6u", "6u"]`. The total of all item sizes + gaps along the flow axis should fit within the viewport to avoid automatic scale-down.

**Wrong:**
```tsx
{/* gap="90u" is enormous — layout overflows, everything scales down */}
<Diagram id="d1" x={"0%"} y={"0%"} w={"100%"} h={"100%"}>
  <FlowLayout direction="top-down" gap={"90u"} />
  <DiagramNode id="a" label="Service A" size={["15u", "8u"]} />
  <DiagramNode id="b" label="Service B" size={["15u", "8u"]} />
</Diagram>
```

**Correct:**
```tsx
{/* gap="6u" is standard — layout fits, nodes render at authored size */}
<Diagram id="d1" x={"0%"} y={"0%"} w={"100%"} h={"100%"}>
  <FlowLayout direction="top-down" gap={"6u"} />
  <DiagramNode id="a" label="Service A" size={["15u", "8u"]} />
  <DiagramNode id="b" label="Service B" size={["15u", "8u"]} />
</Diagram>
```

---

## Missing composeBounds Call Makes Element Ignore View Positioning

**Symptom:** A spatial element renders at fixed viewport coordinates regardless of which `<View>` contains it. Moving the View or resizing it has no effect on the element's position.

**Cause:** The element's NodeHandler does not call `api.composeBounds(localBounds)` to transform local NVS coordinates into the parent View's coordinate space.

**Rule:** Every spatial element's NodeHandler must call `api.composeBounds()`, `api.composeZ()`, and `api.composeOpacity()` to participate in the View coordinate chain. Without these calls, the element uses raw local coordinates that ignore all parent Views and ViewLayouts.

**Wrong:**
```typescript
// NodeHandler that ignores View context:
const bounds = { x: props.x ?? 0, y: props.y ?? 0, w: props.w ?? 1, h: props.h ?? 1 };
api.setWidgetState(widgetId, { ...state, bounds }); // Raw local coords
```

**Correct:**
```typescript
// NodeHandler that composes into parent View:
const localBounds = { x: props.x ?? 0, y: props.y ?? 0, w: props.w ?? 1, h: props.h ?? 1 };
const bounds = api.composeBounds(localBounds);
const z = api.composeZ(props.z ?? 0);
const opacity = api.composeOpacity(props.opacity ?? 1);
api.setWidgetState(widgetId, { ...state, bounds, z, opacity });
```

---

## Slide Layout Children Are Not React Renders

**Symptom:** Content passed as children to a layout component (e.g., `<ContentSlide>`) doesn't appear, or appears unstyled outside the slide region.

**Cause:** Layout components (`<ContentSlide>`, `<TitleSlide>`, etc.) return `null` — they are compiled by the deck compiler, not rendered as React components. Children are extracted during compilation and placed into the computed NVS regions.

**Rule:** Layout components are DSL stubs. Place text primitives (`<Heading>`, `<BulletList>`, `<Body>`) or graphics components (`<StatCard>`, `<Timeline>`) as children. Do not wrap them in custom `<div>` containers with positioning — the layout compiler handles positioning.

**Wrong:**
```tsx
<Slide key="data">
  <ContentSlide title="Revenue">
    <div style={{ position: 'absolute', top: 100 }}>  {/* Don't position manually */}
      <StatCard value="$12M" label="Revenue" />
    </div>
  </ContentSlide>
</Slide>
```

**Correct:**
```tsx
<Slide key="data">
  <ContentSlide title="Revenue">
    <StatCard value="$12M" label="Revenue" />  {/* Layout compiler handles positioning */}
  </ContentSlide>
</Slide>
```

---

## SceneTheme vs SlideTheme Confusion

**Symptom:** Changing `slideTheme` doesn't affect colors or fonts. Changing `SceneTheme` doesn't affect animation timing or content density.

**Cause:** Mixing up the three customization axes.

**Rule:** `SceneTheme` (on `<SceneEngine>`) controls colors, fonts, spacing — all `--brewsite-*` CSS variables. `SlideTheme` (on `<SlidePlayer slideTheme={...}>`) controls timing, density, typography scale — all `--slide-*` CSS variables. `SlideTemplate` (on `<SlidePlayer template={...}>`) controls corporate branding. They are independent — each controls a different concern.

**Wrong:**
```tsx
// Expecting slideTheme to change colors — it won't
<SlidePlayer slideTheme={createSlideTheme({ /* no color fields exist here */ })}>
```

**Correct:**
```tsx
// Colors come from SceneTheme on the parent SceneEngine
<SceneEngine theme="darkGlass" plugins={[corePlugin(), slidesPlugin()]}>
  {/* Timing/density come from SlideTheme on SlidePlayer */}
  <SlidePlayer slideTheme={compactSlideTheme}>
    ...
  </SlidePlayer>
</SceneEngine>
```

---

## Using sceneDsl Without Camera or Lighting

**Symptom:** 3D content (diagrams, charts, models) inside a slide via `sceneDsl` appears black, unlit, or positioned incorrectly.

**Cause:** The `sceneDsl` prop injects 3D elements into the scene, but SlidePlayer does not provide default Camera or Lighting. Without them, the 3D content has no viewpoint and no illumination.

**Rule:** Always include `<Camera>` and `<Lighting>` inside `sceneDsl` when adding 3D content to a slide.

**Wrong:**
```tsx
<Slide key="arch" sceneDsl={<Diagram id="arch"><DiagramNode id="api" label="API" /></Diagram>}>
  <ContentSlide title="Architecture"><Body>Our system.</Body></ContentSlide>
</Slide>
```

**Correct:**
```tsx
<Slide key="arch" sceneDsl={
  <>
    <Camera mode="world" position={[0, 1.5, 5]} target={[0, 0.5, 0]} />
    <Lighting><Ambient intensity={0.8} /></Lighting>
    <Diagram id="arch"><DiagramNode id="api" label="API" size={["15u", "8u"]} /></Diagram>
  </>
}>
  <ContentSlide title="Architecture"><Body>Our system.</Body></ContentSlide>
</Slide>
```

---

## Graphics Components Must Be Inside Layout Children

**Symptom:** A `<StatCard>` or `<Timeline>` placed directly inside `<Slide>` (not inside a layout component) doesn't appear, or renders as raw overlay content outside slide regions.

**Cause:** Graphics components are real React components, but they must be placed as children of a layout component (`<ContentSlide>`, `<BigNumberSlide>`, etc.) so the deck compiler places them into the correct NVS region.

**Rule:** Always wrap graphics components in a layout. Use `<BlankSlide>` for full manual control.

**Wrong:**
```tsx
<Slide key="stats">
  <StatCard value="99.9%" label="Uptime" />  {/* Not inside a layout — won't be positioned */}
</Slide>
```

**Correct:**
```tsx
<Slide key="stats">
  <ContentSlide title="Performance">
    <StatCard value="99.9%" label="Uptime" />  {/* Inside a layout — positioned correctly */}
  </ContentSlide>
</Slide>
```

---

## SlideTheme Timing Values Are Progress Fractions, Not Milliseconds

**Symptom:** Setting `entranceDuration: 300` on a `SlideTheme` causes elements to never appear (the animation window extends from 0% to 30,000% of progress — effectively infinite).

**Cause:** `SlideTheme.timing.entranceDuration`, `.staggerDelay`, and `.countUpDuration` are progress fractions [0-1], not milliseconds. `0.3` means "30% of the slide's progress window."

**Rule:** Use values between 0 and 1 for all `SlideTheme.timing` fields except `transitionDuration` (which IS a CSS time string like `'300ms'`).

**Wrong:**
```tsx
createSlideTheme({ timing: { entranceDuration: 300 } })  // 300 is not a valid progress fraction
```

**Correct:**
```tsx
createSlideTheme({ timing: { entranceDuration: 0.3 } })  // Entrance completes at 30% progress
```

---

## 3D Element in Layout Slot Doesn't Render

**Symptom:** A 3D element (e.g., `<BarChart>`, `<Diagram>`) passed as a layout slot child doesn't appear in the WebGL canvas. It either renders as an empty HTML region or doesn't render at all.

**Cause:** The 3D element is wrapped inside a custom React component. The deck compiler's smart layout routing inspects the top-level element type via `getNodeHandler()`. If the 3D element is nested inside a wrapper component, the compiler sees the wrapper (which has no registered NodeHandler) and routes it as HTML content to a `<TextBox>`.

**Rule:** 3D DSL elements must be **direct children** of the layout slot. Fragment wrappers (`<>...</>`) are fine — the compiler expands one level of fragments. But custom React component wrappers are opaque to the classifier.

**Wrong:**
```tsx
function MyChart() {
  return <BarChart id="rev" x={"0%"} y={"0%"} w={"100%"} h={"100%"} data={chartData} />;
}

<ContentSlide title="Revenue">
  <MyChart />  {/* Compiler sees MyChart, not BarChart — routed as HTML */}
</ContentSlide>
```

**Correct:**
```tsx
<ContentSlide title="Revenue">
  <BarChart id="rev" x={"0%"} y={"0%"} w={"100%"} h={"100%"} data={chartData} />
</ContentSlide>
```

If you must use a wrapper for organization, pass the 3D element via a prop or use `sceneDsl` instead.

---

## All Slides Load Upfront Even with loadPolicy

**Symptom:** You set `loadPolicy` on `SlidePlayer` or passed it as a prop somewhere, but all slide assets still load eagerly on mount.

**Cause:** `loadPolicy` is a prop on `<SceneEngine>`, not on `<SlidePlayer>`. `SlidePlayer` renders inside a parent `SceneEngine` context — it does not own the engine lifecycle.

**Rule:** Set `loadPolicy` on the parent `<SceneEngine>`.

**Wrong:**
```tsx
{/* loadPolicy is not a SlidePlayer prop — this has no effect */}
<SceneEngine plugins={[corePlugin(), slidesPlugin()]}>
  <SlidePlayer loadPolicy={{ eager: [0], preloadAhead: 1 }}>
    ...
  </SlidePlayer>
</SceneEngine>
```

**Correct:**
```tsx
<SceneEngine
  plugins={[corePlugin(), slidesPlugin()]}
  loadPolicy={{ eager: [0], preloadAhead: 1 }}
>
  <SlidePlayer>
    ...
  </SlidePlayer>
</SceneEngine>
```

`SceneLoadPolicy` controls which scenes load eagerly (blocking `assetsReady`) and how many scenes ahead to preload in the background. When omitted, all ILoadable widgets load upfront (backward-compatible default).

---

## Entrance Animation Without scrollUnits

**Symptom:** Entrance animations (`entrance` prop on layouts, `animateEntrance` on `<BulletList>`) fire instantly instead of revealing progressively as the user navigates.

**Cause:** The slide has no scroll budget — `sceneProgress` jumps from 0 to 1 on entry.

**Rule:** Entrance animations are driven by `sceneProgress`. For them to be visible, the slide needs a scroll budget. The default `scrollUnits` for non-title slides is 400, which provides enough progress range. Title slides default to 100 (fast pass-through). If you override `scrollUnits` to a very small value, entrance animations will fire too quickly to see.

**Wrong:**
```tsx
<Slide key="data" scrollUnits={1}>  {/* Too small — entrance animations invisible */}
  <ContentSlide title="Data" entrance={{ body: 'slideUp' }}>
    <BulletList items={['A', 'B', 'C']} animateEntrance />
  </ContentSlide>
</Slide>
```

**Correct:**
```tsx
<Slide key="data" scrollUnits={400}>  {/* Default — enough progress for visible animations */}
  <ContentSlide title="Data" entrance={{ body: 'slideUp' }}>
    <BulletList items={['A', 'B', 'C']} animateEntrance />
  </ContentSlide>
</Slide>
```
