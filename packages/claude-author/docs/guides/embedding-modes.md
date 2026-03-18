---
title: Embedding Modes
doc_type: guide
owner: claude-author
status: active
updated: 2026-03-15
---

## Scroll-Driven Mode

The canvas sticks to the viewport while the user scrolls a tall spacer div. Scroll position drives engine progress (0→1). This is the canonical landing-page mode.

**Required components:** `SceneEngine` → `ScrollStage` → `BackgroundLayer` + `SceneCanvas` + `EngineOverlayHost` + `InputCoordinator`

`ScrollStage` renders a native scroll container with a tall content spacer. The sticky inner stage contains the canvas. `InputCoordinator` intercepts wheel events and drives inertia-based scroll, and also handles keyboard navigation and action-based camera input.

### ScrollStage Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `scrollHeightMode` | `'scene-count' \| 'scroll-units'` | `'scene-count'` | How total scroll height is computed |
| `pixelsPerScene` | `number` | `1200` | Pixels per scene when using `scene-count` mode |
| `pixelsPerScrollUnit` | `number` | `1` | Pixels per scroll unit when using `scroll-units` mode |
| `scrollHeightPx` | `number` | — | Exact override; ignores mode calculation |
| `stageHeight` | `string \| number` | auto | Explicit height for the sticky stage region |
| `className` | `string` | — | CSS class on the outer scroll container div |
| `style` | `CSSProperties` | — | Inline styles merged onto the outer scroll container |
| `stageClassName` | `string` | — | CSS class on the inner sticky stage div |
| `stageStyle` | `CSSProperties` | — | Inline styles merged onto the inner sticky stage div |

Use `scrollHeightMode="scroll-units"` with `ProgressManager.scrollUnits` to give some scenes more scroll travel than others.

### Complete Example

```tsx
import {
  BackgroundLayer,
  corePlugin,
  EngineOverlayHost,
  InputCoordinator,
  SceneCanvas,
  SceneEngine,
  ScrollStage,
} from '@brewsite/core';
import { Scene01Hero } from './scenes/scene01_hero';
import { Scene02Features } from './scenes/scene02_features';

function LandingPage() {
  const plugins = useMemo(() => [corePlugin()], []);

  return (
    <div style={{ height: '100vh', overflow: 'hidden' }}>
      <SceneEngine plugins={plugins}>

        {/* Scene declarations — live outside ScrollStage */}
        <Scene01Hero />
        <Scene02Features />

        {/* Scroll container */}
        <ScrollStage scrollHeightMode="scene-count" pixelsPerScene={1200}>
          <BackgroundLayer style={{ position: 'absolute', inset: 0, zIndex: 0 }} />
          <SceneCanvas style={{ position: 'absolute', inset: 0, zIndex: 1 }} />
          <EngineOverlayHost />
          <InputCoordinator inertiaSensitivity={0.01} inertiaDecay={0.85} />
        </ScrollStage>

      </SceneEngine>
    </div>
  );
}
```

**Important:** Scene declarations (`<Scene01Hero />`, `<Scene02Features />`) are placed as children of `<SceneEngine>` but outside `<ScrollStage>`. They render null and register their DSL with the engine via React context. The canvas and scroll stage can be siblings.

### InputCoordinator Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `inertiaSensitivity` | `number` | `0.01` | Wheel scroll sensitivity. Higher = faster. |
| `inertiaDecay` | `number` | `0.85` | Momentum decay per frame. Higher = more momentum. |
| `target` | `HTMLElement \| null` | scroll container | DOM element receiving pointer/wheel events |
| `keyboardTarget` | `HTMLElement \| Document \| Window \| null` | `document` | DOM element receiving keyboard events |
| `pauseWhenHidden` | `PauseWhenHiddenOptions` | — | Pause rendering when stage leaves viewport |

---

## Embedded Player Mode

Fixed-size container that auto-advances via wall-clock time. Best for docs pages, presentations, blog posts, and embeds that play automatically.

`SceneReel` is a convenience wrapper that composes `SceneEngine` + `SceneCanvas` + `BackgroundLayer` + `EngineOverlayHost` into a single sized, overflow-hidden container. You provide scene declarations and input components as children.

### SceneReel Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `height` | `string \| number` | required | CSS height of the container |
| `width` | `string \| number` | `'100%'` | CSS width of the container |
| `className` | `string` | — | CSS class on the outer container div |
| `plugins` | `WidgetPlugin[]` | — | Forwarded to `SceneEngine` |
| `id` | `string` | — | Engine registry id |
| `timingProfile` | `SceneEngineProps['timingProfile']` | — | Timing profile forwarded to `SceneEngine` |
| `primaryCameraId` | `string` | — | Widget id of the primary camera |
| `primaryCanvasActionTargetId` | `string` | — | Widget id for action input |
| `cameraInteractionDefaults` | `SceneEngineProps['cameraInteractionDefaults']` | — | Default camera interaction config |
| `invalidateCacheToken` | `number \| string` | — | Cache invalidation token forwarded to engine |
| `maxAnimBoostPerFrame` | `number` | — | Max animation boost per frame |
| `theme` | `SceneEngineProps['theme']` | — | Active theme for this engine |
| `sceneTheme` | `SceneEngineProps['sceneTheme']` | — | Direct SceneTheme injection |
| `scrollSource` | `SceneEngineProps['scrollSource']` | — | Scroll source for viewport-relative lifecycle |
| `defaultTransitionDuration` | `SceneEngineProps['defaultTransitionDuration']` | `400` | Duration (ms) for programmatic scene transitions |
| `defaultTransitionEasing` | `SceneEngineProps['defaultTransitionEasing']` | — | Easing for programmatic scene transitions |
| `onReady` | `() => void` | — | Called when assets are ready |
| `onError` | `(err: Error) => void` | — | Error handler |
| `onWidgetError` | `(widgetId: string, error: Error) => void` | — | Per-widget error handler |
| `onCompileWarning` | `SceneEngineProps['onCompileWarning']` | — | Compile warning callback |
| `children` | `ReactNode` | — | Scene declarations, input components, overlay content |

### TimeInput Props

> **Deprecated.** `TimeInput` has no known consumers in current packages or apps and will be removed in a future version. Use `InputCoordinator` with `ProgressManager` `autoAdvance` instead (see replacement pattern below).

| Prop | Type | Default | Description |
|---|---|---|---|
| `duration` | `number` | required | Seconds to advance engine progress from 0 to `max` |
| `max` | `number` | `1.0` | Maximum engine progress to advance to |
| `loop` | `boolean` | `false` | Loop back to 0 when `max` is reached |
| `resetOnExit` | `boolean` | `true` | Reset to 0 when element leaves viewport |
| `pauseWhenHidden` | `PauseWhenHiddenOptions` | — | Pause when element leaves viewport |

**Recommended replacement** -- use `ProgressManager` with `autoAdvance` inside each scene and `InputCoordinator` for input handling:

```tsx
import { corePlugin, SceneReel, InputCoordinator, Scene, ProgressManager } from '@brewsite/core';

function EmbeddedDemo() {
  const plugins = useMemo(() => [corePlugin()], []);

  return (
    <SceneReel height={450} width="100%" plugins={plugins}>
      <Scene id="intro">
        <ProgressManager autoAdvance={{ duration: 8, max: 1.0 }} />
        {/* ... scene content */}
      </Scene>
      <InputCoordinator />
    </SceneReel>
  );
}
```

### Legacy Example (using deprecated TimeInput)

```tsx
import { corePlugin, SceneReel, TimeInput } from '@brewsite/core';
import { Scene01Intro } from './scenes/scene01_intro';
import { Scene02Detail } from './scenes/scene02_detail';

function EmbeddedDemo() {
  const plugins = useMemo(() => [corePlugin()], []);

  return (
    <SceneReel height={450} width="100%" plugins={plugins}>
      <Scene01Intro />
      <Scene02Detail />
      <TimeInput duration={8} loop />
    </SceneReel>
  );
}
```

`SceneReel` provides `SceneCanvas`, `BackgroundLayer`, and `EngineOverlayHost` automatically — do not add them as children. Add scene declarations and input components only.

---

## Programmatic / Controlled Mode

External UI (buttons, tabs, step indicators) drives which scene is active. Use `useGoToScene()` for the most common case, or `ControlledInput` when you need full two-way sync between engine progress and external state.

### useGoToScene

```tsx
function useGoToScene(): (idOrIndex: string | number) => void
```

Returns a stable callback. Accepts a scene `id` string or a zero-based numeric index. When inside a `ScrollStage`, it syncs the scroll position. In all other modes, it writes `engine.setProgress()` directly.

### ControlledInput Props

| Prop | Type | Description |
|---|---|---|
| `value` | `number` | Normalized engine progress [0, 1]. Drives the engine on every render. |
| `onChange` | `(progress: number) => void` | Called when another input attempts to change progress (e.g. keyboard). |
| `children` | `ReactNode` | Optional — keyboard/button inputs that need the onChange context. |

### Complete Example with Nav Buttons

```tsx
import {
  corePlugin,
  ControlledInput,
  EngineOverlayHost,
  SceneCanvas,
  SceneEngine,
  useGoToScene,
} from '@brewsite/core';
import { Scene01 } from './scenes/scene01';
import { Scene02 } from './scenes/scene02';
import { Scene03 } from './scenes/scene03';

// Nav button must be inside SceneEngine to call useGoToScene
function SceneNavButtons() {
  const goTo = useGoToScene();
  return (
    <div style={{ position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)',
                  display: 'flex', gap: 8 }}>
      <button onClick={() => goTo(0)}>Intro</button>
      <button onClick={() => goTo(1)}>Features</button>
      <button onClick={() => goTo(2)}>Closing</button>
    </div>
  );
}

function PresentationPlayer() {
  const [progress, setProgress] = useState(0);
  const plugins = useMemo(() => [corePlugin()], []);

  return (
    <div style={{ width: 960, height: 540, position: 'relative' }}>
      <SceneEngine plugins={plugins}>
        <Scene01 />
        <Scene02 />
        <Scene03 />

        <ControlledInput value={progress} onChange={setProgress} />
        <SceneCanvas style={{ position: 'absolute', inset: 0 }} />
        <EngineOverlayHost>
          <SceneNavButtons />
        </EngineOverlayHost>
      </SceneEngine>
    </div>
  );
}
```

`ControlledInput` is the highest priority input tier — it calls `engine.setProgress()` via `useLayoutEffect` on every render, ensuring no one-frame lag.

---

## Canvas Region Mode

A self-contained 3D viewport with no scene sequencing — just a single "scene" (or a fixed scene) with camera orbit/zoom/pan enabled. Use this for interactive product viewers, inline 3D illustrations, or any context where you want the user to freely explore a 3D scene.

Use `SceneReel` for the layout and add an `InputCoordinator` for action-based camera control. Default input bindings provide Cmd/Ctrl+scroll orbit, pinch zoom, Shift+scroll pan, and R key reset automatically. No `<InputController>` is needed for the common case.

### Complete Example (Using Defaults)

```tsx
import { corePlugin, InputCoordinator, SceneReel } from '@brewsite/core';
import { modelPlugin } from '@brewsite/model';
import { ProductViewerScene } from './scenes/product_viewer';

function ProductViewer() {
  const plugins = useMemo(() => [
    corePlugin(),
    modelPlugin({ manifestUrl: '/assets/manifest.json' }),
  ], []);

  return (
    <SceneReel
      height={500}
      plugins={plugins}
      primaryCameraId="main-camera"
    >
      <ProductViewerScene />
      <InputCoordinator />
    </SceneReel>
  );
}

// In ProductViewerScene — no InputController needed:
function ProductViewerScene() {
  return (
    <Scene id="product-viewer">
      <Camera id="main-camera" mode="world" position={[0, 1, 3]} target={[0, 0.5, 0]} />
      <Lighting>...</Lighting>
      <Background color="#111" />
      <Model id="product" type="ProductModel" x={0.5} y={0.5} w={0.8} h={0.8} />
      {/* Defaults provide: Cmd+scroll orbit, pinch zoom, Shift+scroll pan, R reset */}
    </Scene>
  );
}
```

### With Left-Drag Orbit (Merge Override)

For a canvas-region viewer where left-drag orbit and wheel zoom are desired (overriding the "scroll is sacred" principle since there is no scene navigation):

```tsx
function ProductViewerScene() {
  return (
    <Scene id="product-viewer">
      <Camera id="main-camera" mode="world" position={[0, 1, 3]} target={[0, 0.5, 0]} />
      <Lighting>...</Lighting>
      <Background color="#111" />
      <Model id="product" type="ProductModel" x={0.5} y={0.5} w={0.8} h={0.8} />
      <InputController>
        {/* Add left-drag orbit (appended to defaults) */}
        <Action id="drag-orbit" type="camera.orbit">
          <PointerMap event="drag" button="left" />
        </Action>
        {/* Override default zoom to add wheel (ok since single scene, no scroll nav needed) */}
        <Action id="default-camera-zoom" type="camera.zoom">
          <WheelMap />
          <PinchMap direction="both" />
        </Action>
      </InputController>
    </Scene>
  );
}
```

`primaryCameraId` on `SceneReel` is forwarded to `SceneEngine` and tells `InputCoordinator` which camera to target when `cameraId` is omitted from an `<Action>`.

---

## Choosing a Mode

Ask these questions in order:

1. **Should the user scroll to progress through scenes?** → Scroll-driven mode (`ScrollStage` + `InputCoordinator`)
2. **Should it play automatically without user interaction?** → Embedded player mode (`SceneReel` + `InputCoordinator` with `ProgressManager` `autoAdvance`)
3. **Does external UI (buttons, tabs, routing) control which scene is shown?** → Programmatic mode (`SceneReel` or raw `SceneEngine` + `useGoToScene` / `ControlledInput`)
4. **Is it a single interactive 3D region with no scene progression?** → Canvas region mode (`SceneReel` + `InputController` in DSL)
