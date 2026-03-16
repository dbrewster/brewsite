---
title: Common Gotchas
doc_type: guide
owner: claude-author
status: active
updated: 2026-03-15
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
// Just use plain numbers/arrays in scene files
function MyScene() {
  return <Scene id="s1"><Model x={0.5} y={0.4} w={0.6} h={0.8} /></Scene>;
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

**Rule:** NVS Y-axis matches CSS: `y={0}` is top edge, `y={1}` is bottom edge. The internal conversion to Three.js world coordinates applies the Y-flip automatically.

**Wrong:**
```tsx
// Intending to place something near the bottom — this puts it near the TOP
<Model id="footer-model" x={0.5} y={0.1} w={0.8} h={0.2} />
```

**Correct:**
```tsx
// Near the bottom: high Y value
<Model id="footer-model" x={0.5} y={0.8} w={0.8} h={0.2} />
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
import { ChartWidget, chartsPlugin } from '@brewsite/charts';
```

**Package map:**
- `@brewsite/core` — scene DSL (`Scene`, `View`, `ViewLayout`, `InputController`, `Action`, `Transition`, `ProgressManager`), lighting, camera, background, environment, floor, all player components
- `@brewsite/model` — `Model`, `Playback`, `Animation`, `LabelItem`, `LabelPositioner`, `modelPlugin`
- `@brewsite/diagram` — `Diagram`, `DiagramCanvas`, `ImagePanel`, `Screen`, `diagramPlugin`
- `@brewsite/charts` — chart elements, `chartsPlugin`

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
