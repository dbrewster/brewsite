---
title: Advanced Scene Authoring Patterns
doc_type: guide
owner: claude-author
status: active
updated: 2026-03-21
---

## Multi-Scene Sequences

Scene-to-scene transitions are entirely declarative. To get a smooth transition between scenes, give the same widget the same `id` in both scenes. The compiler detects matching IDs and bakes the interpolation into the `SceneTrack`.

**What transitions automatically:**
- `<Camera>` — position, target, FOV, exposure always interpolate
- `<Lighting>` — `intensityScale` and per-light `intensity` interpolate; colors switch at midpoint
- `<Background>` — `opacity` interpolates; `color`/`gradient` switches at midpoint
- `<Environment>` — `intensity` interpolates; `source` switches at midpoint
- Any widget with a matching `id` — position (NVS x/y/w/h), opacity, and widget-specific numeric fields

**What produces a hard cut:**
- Switching camera mode (e.g. `world` → `fitBotHeight`)
- Elements that appear in only one scene get entry/exit fade transitions

**Timing:** Transition duration is controlled by the `<ProgressManager scrollUnits={n}>` in the incoming scene and the global `defaultTransitionDuration` on `<SceneEngine>`.

**Good multi-scene pattern — camera push + model shift:**

```tsx
// Scene 1 — model centered, camera back
export function Scene1() {
  return (
    <Scene id="intro">
      <ProgressManager scrollUnits={1200} />
      <Camera mode="world" position={[0, 1.5, 7.0]} target={[0, 1.0, 0]} fov={50} />
      <Lighting intensityScale={1.0}>
        <Ambient intensity={0.7} color="#d0e4ff" />
        <Directional intensity={1.0} color="#ffffff" position={[3, 8, 6]} />
      </Lighting>
      <Background color="#030510" />
      <Model type="Robot" id="robot" scale={0.06} x={"50%"} y={"0%"} w={"50%"} h={"100%"} />
    </Scene>
  );
}

// Scene 2 — same robot id (smooth morph), camera pushed in, model shifted left
export function Scene2() {
  return (
    <Scene id="detail">
      <ProgressManager scrollUnits={1200} />
      {/* Camera moves from [0,1.5,7] to [1.5,1.3,3.5] with eased interpolation */}
      <Camera
        mode="world"
        position={[1.5, 1.3, 3.5]}
        target={[0.5, 1.1, 0]}
        fov={38}
        transitionIn={{ type: 'eased', ease: 'easeInOut' }}
      />
      <Lighting intensityScale={1.2}>
        <Ambient intensity={0.5} color="#c0d8ff" />
        <Directional intensity={1.3} color="#ffffff" position={[3, 8, 6]} />
      </Lighting>
      <Background color="#040812" />
      {/* Same id "robot" — NVS x/y/w/h and opacity all interpolate */}
      <Model type="Robot" id="robot" scale={0.06} x={"25%"} y={"0%"} w={"50%"} h={"100%"} />
    </Scene>
  );
}
```

---

## ViewLayout and Carousel

`<View>` and `<ViewLayout>` are spatial composition primitives. They define NVS regions that child elements compose within.

### `<View>` — a positioned region

`<View>` creates a named NVS region. Children placed inside it receive a scoped NVS coordinate system: `x=0 y=0 w=1 h=1` fills the view, not the full viewport.

```tsx
import { View } from '@brewsite/core';

// Right 60% panel, full height, with 5% padding on all sides
<View id="right-panel" x={"40%"} y={"0%"} w={"60%"} h={"100%"} padding={["5%", "4%"]}>
  <Model type="Robot" id="robot" scale={0.06} x={"0%"} y={"0%"} w={"100%"} h={"100%"} />
  {/* TextBox inside View is also relative to the View's bounds */}
  <TextBox id="caption" x={"5%"} y={"88%"} w={"90%"} h={"10%"}>
    <p style={{ color: 'white', margin: 0 }}>Caption</p>
  </TextBox>
</View>
```

**`<View>` props:**

| Prop | Type | Description |
|---|---|---|
| `id` | `string` | Required stable ID |
| `x` | `SceneLength` | NVS x position. Ignored inside a ViewLayout |
| `y` | `SceneLength` | NVS y position. Ignored inside a ViewLayout |
| `w` | `SceneLength` | NVS width. Used as size hint inside ViewLayout |
| `h` | `SceneLength` | NVS height. Used as size hint inside ViewLayout |
| `padding` | `RegionPadding` | Inset padding. Uniform: `"5%"`. [vertical, horizontal]: `["5%", "4%"]`. Full: `[top, right, bottom, left]` |
| `children` | `ReactNode` | One renderable DSL element (plus optional TextBox/overlay content) |

---

### `<ViewLayout>` — multi-view arrangement

`<ViewLayout>` positions multiple `<View>` children according to a layout policy. The `kind` prop selects the policy.

**`kind="stack"` — row or column arrangement:**

```tsx
<ViewLayout kind="stack" direction="horizontal" gap={"4%"} x={"0%"} y={"0%"} w={"100%"} h={"100%"}>
  <View id="panel-a" w={"33%"} h={"100%"}>
    <BarChart id="chart-a" x={"0%"} y={"0%"} w={"100%"} h={"100%"} ... />
  </View>
  <View id="panel-b" w={"33%"} h={"100%"}>
    <BarChart id="chart-b" x={"0%"} y={"0%"} w={"100%"} h={"100%"} ... />
  </View>
  <View id="panel-c" w={"33%"} h={"100%"}>
    <BarChart id="chart-c" x={"0%"} y={"0%"} w={"100%"} h={"100%"} ... />
  </View>
</ViewLayout>
```

**`kind="carousel"` — linear fan with perspective depth:**

The active view is centered at the front. Inactive views scale down and move back in Z.

```tsx
<ViewLayout
  kind="carousel"
  activeIndex={1}         // 0-indexed: 0=left, 1=center, 2=right
  inactiveScale={0.72}    // inactive panels at 72% scale
  zStep={9}               // side panels 9 world units back in Z
  gap={"3%"}              // NVS gap between panels
  y={"0%"}
  h={"100%"}
>
  <View id="panel-a" w={"38%"} h={"88%"}>
    <Model type="Robot" id="robot-a" scale={0.06} x={"0%"} y={"0%"} w={"100%"} h={"100%"} />
  </View>
  <View id="panel-b" w={"38%"} h={"88%"}>
    <Model type="Robot" id="robot-b" scale={0.06} x={"0%"} y={"0%"} w={"100%"} h={"100%"} />
  </View>
  <View id="panel-c" w={"38%"} h={"88%"}>
    <Model type="Robot" id="robot-c" scale={0.06} x={"0%"} y={"0%"} w={"100%"} h={"100%"} />
  </View>
</ViewLayout>
```

**Carousel cycling across scenes** — change `activeIndex` in each scene to animate the carousel advancing:

```tsx
// Scene A — panel B active
<Scene id="carousel-1">
  <ViewLayout kind="carousel" activeIndex={0} inactiveScale={0.75} zStep={8} gap={"4%"} h={"100%"}>
    <View id="panel-a" w={"36%"} h={"90%"}><Diagram id="d-a" ... /></View>
    <View id="panel-b" w={"36%"} h={"90%"}><Diagram id="d-b" ... /></View>
    <View id="panel-c" w={"36%"} h={"90%"}><Diagram id="d-c" ... /></View>
  </ViewLayout>
</Scene>

// Scene B — panel C active (carousel rotates forward)
<Scene id="carousel-2">
  <ViewLayout kind="carousel" activeIndex={1} inactiveScale={0.75} zStep={8} gap={"4%"} h={"100%"}>
    <View id="panel-a" w={"36%"} h={"90%"}><Diagram id="d-a" ... /></View>
    <View id="panel-b" w={"36%"} h={"90%"}><Diagram id="d-b" ... /></View>
    <View id="panel-c" w={"36%"} h={"90%"}><Diagram id="d-c" ... /></View>
  </ViewLayout>
</Scene>
```

**Loop carousel** (`loop={true}`) — views wrap in an elliptical ring. The active view sits at the front center; others distribute evenly around the ellipse:

```tsx
<ViewLayout
  kind="carousel"
  loop={true}
  activeIndex={0}
  zStep={6}
  spread={0.7}      // ellipse width as fraction of container [0..1]
  fadeMin={0.4}     // farthest-back views at 40% opacity
  h={"100%"}
>
  <View id="v1" w={"35%"} h={"85%"}>{/* content */}</View>
  <View id="v2" w={"35%"} h={"85%"}>{/* content */}</View>
  <View id="v3" w={"35%"} h={"85%"}>{/* content */}</View>
  <View id="v4" w={"35%"} h={"85%"}>{/* content */}</View>
</ViewLayout>
```

**`<ViewLayout>` props summary:**

| Prop | Type | Default | Description |
|---|---|---|---|
| `id` | `string` | auto | Optional stable ID |
| `kind` | `'stack' \| 'carousel'` | — | Required layout policy |
| `x` | `SceneLength` | `"0%"` | NVS x of layout container |
| `y` | `SceneLength` | `"0%"` | NVS y of layout container |
| `w` | `SceneLength` | `"100%"` | NVS width of layout container |
| `h` | `SceneLength` | `"100%"` | NVS height of layout container |
| `gap` | `SceneLength` | `"0%"` | NVS gap between views |
| `direction` | `'horizontal' \| 'vertical'` | `'horizontal'` | Stack direction (stack only) |
| `activeIndex` | `number` | 0 | Active view index (carousel only) |
| `inactiveScale` | `number` | 0.75 | Inactive view scale (carousel only) |
| `zStep` | `number` | 0 | World-space Z depth (carousel only) |
| `loop` | `boolean` | `false` | Wrap in elliptical ring (carousel only) |
| `spread` | `number` | auto | Ellipse width fraction (carousel + loop only) |
| `fadeMin` | `number` | 1.0 | Minimum opacity for back views (carousel + loop only) |

---

## Programmatic Navigation

### useGoToScene

Jump directly to a scene by ID or index. Works in any mode (scroll, inertia, controlled).

```tsx
import { useGoToScene } from '@brewsite/core';

function SceneNavigator() {
  const goTo = useGoToScene();

  return (
    <div style={{ position: 'absolute', bottom: '2%', left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 8 }}>
      <button onClick={() => goTo('hero')}>Intro</button>
      <button onClick={() => goTo('detail')}>Detail</button>
      <button onClick={() => goTo(2)}>Scene 3</button>
    </div>
  );
}
```

In scroll mode, `useGoToScene` syncs `window.scrollY` via `ScrollNavigatorContext` so the scroll position stays in sync with the engine. In other modes it calls `engine.setProgress()` directly.

The hook must be called inside a `<SceneEngine>` subtree.

---

### ControlledInput

`ControlledInput` drives engine progress from an external React state value. Use it when you want a custom progress source — a slider, a step-by-step wizard, or an external scroll hook.

```tsx
import { ControlledInput, useCurrentScene } from '@brewsite/core';
import { useState } from 'react';

function PresentationPage() {
  const [progress, setProgress] = useState(0);
  const numScenes = 5;

  return (
    <SceneEngine plugins={plugins}>
      <Scene1 />
      <Scene2 />
      <Scene3 />
      <Scene4 />
      <Scene5 />

      {/* ControlledInput writes progress to the engine on every render */}
      <ControlledInput value={progress} onChange={setProgress} />

      <ScrollStage>
        <SceneCanvas ... />
        <EngineOverlayHost />
      </ScrollStage>

      {/* Step buttons outside the engine */}
      <StepButtons
        onBack={() => setProgress(Math.max(0, progress - 1 / (numScenes - 1)))}
        onForward={() => setProgress(Math.min(1, progress + 1 / (numScenes - 1)))}
      />
    </SceneEngine>
  );
}
```

`ControlledInput` is highest-priority — it overrides all other input sources. `onChange` is called when keyboard or other inputs attempt to change progress, so you can keep your external state in sync.

---

## Plugin Registration and Nesting

Every `<SceneEngine>` requires a `plugins` prop that wires the widget registry.

**Standard setup — all four packages:**

```tsx
import { corePlugin } from '@brewsite/core';
import { modelPlugin } from '@brewsite/model';
import { diagramPlugin } from '@brewsite/diagram';
import { chartPlugin } from '@brewsite/charts';

const plugins = [
  corePlugin(),
  modelPlugin({ manifestUrl: '/assets/model/manifest.json' }),
  diagramPlugin(),
  chartPlugin(),
];

<SceneEngine plugins={plugins} theme={{ family: 'darkGlass', polarity: 'dark' }}>
  {/* scenes */}
</SceneEngine>
```

**Plugin descriptions:**
- `corePlugin()` — required. Provides `Camera`, `Lighting`, `Background`, `Environment`, `Floor`, `SceneMeta`, `SpotlightRig` widgets and all core DSL handlers.
- `modelPlugin({ manifestUrl })` — provides `Model`, `Label` widgets. Fetches the asset manifest at `manifestUrl`.
- `diagramPlugin()` — provides `Diagram` and related widgets.
- `chartPlugin()` — provides `BarChart`, `LineChart`, `PieChart`, etc.

**Plugin inheritance — nested engines:**

For multi-panel pages where one root `<SceneEngine>` provides context and child engines run individual scenes, the child engines inherit plugins from the nearest ancestor:

```tsx
// Root engine — zero scenes, provides plugins via PluginInheritanceContext
<SceneEngine plugins={sharedPlugins}>
  {/* Panel A — inherits plugins from root; no plugins prop needed */}
  <SceneEngine id="panel-a">
    <SceneA />
    <SceneCanvas ... />
    <EngineOverlayHost />
  </SceneEngine>

  {/* Panel B — also inherits */}
  <SceneEngine id="panel-b">
    <SceneB />
    <SceneCanvas ... />
    <EngineOverlayHost />
  </SceneEngine>
</SceneEngine>
```

When a child engine has its own `plugins` prop, that takes precedence over inherited plugins.

---

## Scene Progress Hooks

All progress hooks must be called inside a `<SceneEngine>` subtree.

### useSceneProgress

Returns the current scene's local progress `[0, 1]` — how far the user has scrolled through the currently active scene.

```tsx
import { useSceneProgress } from '@brewsite/core';

function ProgressBar() {
  const progress = useSceneProgress(); // 0 at scene start, 1 at scene end

  return (
    <div style={{ position: 'absolute', bottom: 0, left: 0, height: 3, background: '#4080ff', width: `${progress * 100}%` }} />
  );
}
```

Use for in-scene animations driven by scroll position — element reveals, counter tick-ups, progress indicators.

---

### useCurrentScene

Returns `{ id: string; index: number }` — the active scene's string ID and zero-based index.

```tsx
import { useCurrentScene } from '@brewsite/core';

function BreadcrumbNav() {
  const { id, index } = useCurrentScene();

  const sceneLabels: Record<string, string> = {
    'hero': 'Introduction',
    'features': 'Features',
    'pricing': 'Pricing',
  };

  return (
    <nav style={{ position: 'fixed', top: 20, left: 32 }}>
      <span style={{ color: 'rgba(180,210,255,0.7)', fontSize: '0.75rem' }}>
        {index + 1} / 5 — {sceneLabels[id] ?? id}
      </span>
    </nav>
  );
}
```

---

### useEngineState

Returns live engine state from the nearest ancestor `<SceneEngine>`. Provides `{ tickIndex, progress, sceneId, sceneIndex, sceneProgress }`.

```tsx
import { useEngineState } from '@brewsite/core';

function DebugOverlay() {
  const state = useEngineState();

  return (
    <pre style={{ position: 'fixed', top: 50, right: 20, color: 'lime', fontSize: 11 }}>
      {JSON.stringify(state, null, 2)}
    </pre>
  );
}
```

When called with a string `id`, reads from a named engine in the global registry — useful for cross-tree communication:

```tsx
const snapshot = useEngineState('panel-a'); // returns SceneEngineSnapshot | null
```

---

## EngineARContainer / Contained Scenes

`EngineARContainer` locks the canvas to a fixed aspect ratio and injects the `--scene-scale` CSS custom property for proportional text sizing.

Use it when:
- You need the scene to maintain a specific aspect ratio (e.g. 16:9 or 1:1) regardless of the viewport shape
- You want `--scene-scale` for proportional text in `TextBox` content
- You are building a slide-deck-style presentation

```tsx
import { EngineARContainer } from '@brewsite/core';

<ScrollStage scrollHeightMode="scene-count" pixelsPerScene={800}>
  <EngineARContainer
    aspectRatio={16 / 9}      // fixed AR. Default: 16/9
    referenceWidth={1920}     // pixel width at --scene-scale = 1.0. Default: 1920
    scaleMode="fit-width"     // how the AR container fits in its parent
  >
    <BackgroundLayer style={{ position: 'absolute', inset: 0, zIndex: 0 }} />
    <SceneCanvas style={{ position: 'absolute', inset: 0, zIndex: 1 }} />
    <EngineOverlayHost />
  </EngineARContainer>
  <InputCoordinator />
</ScrollStage>
```

**`scaleMode` values:**

| Mode | Behavior |
|---|---|
| `'fit-width'` | Width fills parent; height is derived from AR. Default |
| `'fit-height'` | Height fills parent; width is derived from AR |
| `'contain'` | Both axes fit; shorter axis letterboxes |
| `'cover'` | Both axes fill; content that exceeds bounds clips |

**`--scene-scale`:** injected on every resize as `containerWidth / referenceWidth`. Use in TextBox content for proportional font sizing:

```tsx
<TextBox id="title" x={"4%"} y={"10%"} w={"50%"} h={"15%"}>
  <h1 style={{ fontSize: `calc(2.5rem * var(--scene-scale, 1))` }}>
    Scaled Heading
  </h1>
</TextBox>
```

**1:1 aspect ratio example** (from the ViewDemoPage):

```tsx
<EngineARContainer aspectRatio={9 / 9} scaleMode="fit-width">
  <BackgroundLayer style={{ position: 'absolute', inset: 0, zIndex: 0 }} />
  <SceneCanvas style={{ position: 'absolute', inset: 0, zIndex: 1 }} />
  <EngineOverlayHost />
</EngineARContainer>
```

`ViewportScaleContext` (formerly `EngineARContainerContext`) is provided by `EngineARContainer` and consumed by `@brewsite/model`'s `LabelPositioner` to compute label screen positions regardless of the enclosing layout.
