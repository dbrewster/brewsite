---
title: Embedding Modes
doc_type: guide
owner: claude-author
status: active
updated: 2026-03-23
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

`SceneEmbed` is a self-contained embedded scene player that composes `SceneEngine` + `SceneCanvas` + `BackgroundLayer` + `EngineOverlayHost` + visibility lifecycle management + auto-play into a single component. Provide scene declarations as children.

### SceneEmbed Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `height` | `string \| number` | required | CSS height of the container |
| `width` | `string \| number` | `'100%'` | CSS width of the container |
| `className` | `string` | — | CSS class on the outer container div |
| `autoPlay` | `boolean \| AutoPlayConfig` | — | Auto-advance via wall-clock time. `true` = 6s loop. Object for custom config. Ignored when `progress` is provided. Disabled when `prefers-reduced-motion` matches. |
| `progress` | `number` | — | Externally controlled engine progress [0, 1]. Overrides `autoPlay`. |
| `onProgressChange` | `(progress: number) => void` | — | Called when internal input requests a progress change (controlled mode only). |
| `interactive` | `boolean` | `false` | Enable pointer-based camera interaction (orbit, dolly, pan). |
| `visibility` | `'always' \| 'autopause' \| 'lazy'` | `'autopause'` | Engine lifecycle relative to viewport. `'always'` = no gating. `'autopause'` = pause RAF when off-screen. `'lazy'` = defer mount until near viewport, unmount when far away. |
| `rootMargin` | `string` | `'200px'` | IntersectionObserver rootMargin for visibility detection. |
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
| `loadPolicy` | `SceneEngineProps['loadPolicy']` | — | Scene asset loading strategy |
| `onReady` | `() => void` | — | Called when assets are ready |
| `onError` | `(err: Error) => void` | — | Error handler |
| `onWidgetError` | `(widgetId: string, error: Error) => void` | — | Per-widget error handler |
| `onCompileWarning` | `SceneEngineProps['onCompileWarning']` | — | Compile warning callback |
| `children` | `ReactNode` | — | Scene declarations and overlay content |

### AutoPlayConfig

| Field | Type | Default | Description |
|---|---|---|---|
| `duration` | `number` | `6` | Total seconds to traverse from progress 0 to 1 (across all scenes). |
| `loop` | `boolean` | `true` | Loop back to progress 0 when reaching the end. |

### Basic Auto-Play Example

```tsx
import { corePlugin, SceneEmbed } from '@brewsite/core';
import { Scene01Intro } from './scenes/scene01_intro';
import { Scene02Detail } from './scenes/scene02_detail';

function EmbeddedDemo() {
  const plugins = useMemo(() => [corePlugin()], []);

  return (
    <SceneEmbed height={450} autoPlay plugins={plugins}>
      <Scene01Intro />
      <Scene02Detail />
    </SceneEmbed>
  );
}
```

### Custom Auto-Play Duration

```tsx
<SceneEmbed height={450} autoPlay={{ duration: 10, loop: false }} plugins={plugins}>
  <HeroScene />
  <FeatureScene />
</SceneEmbed>
```

`SceneEmbed` provides `SceneCanvas`, `BackgroundLayer`, and `EngineOverlayHost` automatically — do not add them as children. Add scene declarations only.

### Visibility Modes

For pages with many embeds (6+), use `visibility="lazy"` to stay within browser WebGL context limits:

```tsx
<SceneEmbed height={300} autoPlay visibility="lazy" plugins={plugins}>
  <Scene1 />
</SceneEmbed>
<SceneEmbed height={300} autoPlay visibility="lazy" plugins={plugins}>
  <Scene2 />
</SceneEmbed>
{/* ...repeat safely */}
```

- `'always'` — Mount immediately, run continuously. Use for a single hero embed.
- `'autopause'` (default) — Mount immediately. Pause RAF when off-screen. Zero GPU cost when not visible.
- `'lazy'` — Defer mount until near viewport. Unmount when far away. Use for many-embed pages.

---

## Programmatic / Controlled Mode

External UI (buttons, tabs, step indicators) drives which scene is active. Use `useGoToScene()` for the most common case, or `SceneEmbed` with the `progress` prop when you need full two-way sync between engine progress and external state.

### useGoToScene

```tsx
function useGoToScene(): (idOrIndex: string | number) => void
```

Returns a stable callback. Accepts a scene `id` string or a zero-based numeric index. When inside a `ScrollStage`, it syncs the scroll position. In all other modes, it writes `engine.setProgress()` directly.

### SceneEmbed Controlled Props

| Prop | Type | Description |
|---|---|---|
| `progress` | `number` | Normalized engine progress [0, 1]. Drives the engine directly. Overrides `autoPlay`. |
| `onProgressChange` | `(progress: number) => void` | Called when an internal input (e.g. keyboard) requests a progress change. Wire to the same `setState` that feeds `progress`. |

### Complete Example with Nav Buttons

```tsx
import {
  corePlugin,
  SceneEmbed,
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
    <SceneEmbed
      height={540}
      plugins={plugins}
      progress={progress}
      onProgressChange={setProgress}
    >
      <Scene01 />
      <Scene02 />
      <Scene03 />
      <SceneNavButtons />
    </SceneEmbed>
  );
}
```

When `progress` is provided, `SceneEmbed` calls `engine.setProgress()` via `useLayoutEffect` on every render, ensuring no one-frame lag.

---

## Canvas Region Mode

A self-contained 3D viewport with no scene sequencing — just a single "scene" (or a fixed scene) with camera orbit/zoom/pan enabled. Use this for interactive product viewers, inline 3D illustrations, or any context where you want the user to freely explore a 3D scene.

Use `SceneEmbed` with `interactive` for the layout and camera control. Default input bindings provide Cmd/Ctrl+scroll orbit, pinch zoom, Shift+scroll pan, and R key reset automatically. No `<InputController>` is needed for the common case.

### Complete Example (Using Defaults)

```tsx
import { corePlugin, SceneEmbed } from '@brewsite/core';
import { modelPlugin } from '@brewsite/model';
import { ProductViewerScene } from './scenes/product_viewer';

function ProductViewer() {
  const plugins = useMemo(() => [
    corePlugin(),
    modelPlugin({ manifestUrl: '/assets/manifest.json' }),
  ], []);

  return (
    <SceneEmbed
      height={500}
      plugins={plugins}
      primaryCameraId="main-camera"
      interactive
    >
      <ProductViewerScene />
    </SceneEmbed>
  );
}

// In ProductViewerScene — no InputController needed:
function ProductViewerScene() {
  return (
    <Scene id="product-viewer">
      <Camera id="main-camera" mode="world" position={[0, 1, 3]} target={[0, 0.5, 0]} />
      <Lighting>...</Lighting>
      <Background color="#111" />
      <Model id="product" type="ProductModel" x={"50%"} y={"50%"} w={"80%"} h={"80%"} />
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
      <Model id="product" type="ProductModel" x={"50%"} y={"50%"} w={"80%"} h={"80%"} />
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

`primaryCameraId` on `SceneEmbed` is forwarded to `SceneEngine` and tells `InputCoordinator` which camera to target when `cameraId` is omitted from an `<Action>`.

---

## Slide Deck Mode

A presentation deck with slide-to-slide navigation (keyboard, pointer, touch). Best for corporate presentations, pitch decks, and data-driven slide shows.

`SlidePlayer` from `@brewsite/slides` renders inside a parent `<SceneEngine>`. It compiles `<Slide>` children into `<Scene>` elements and wires all navigation automatically — no `InputController`, `ScrollStage`, or manual engine setup required.

**Required components:** `SceneEngine` (with `corePlugin()` + `slidesPlugin()`) → `SlidePlayer` → `<Slide>` children

### Complete Example

```tsx
import { SceneEngine, corePlugin } from '@brewsite/core';
import {
  SlidePlayer, Slide, TitleSlide, ContentSlide, BigNumberSlide,
  Body, BulletList, slidesPlugin, compactSlideTheme,
} from '@brewsite/slides';

function QuarterlyDeck() {
  return (
    <SceneEngine plugins={[corePlugin(), slidesPlugin()]}>
      <SlidePlayer slideTheme={compactSlideTheme} transition="dissolve">
        <Slide key="title">
          <TitleSlide title="Q4 Results" subtitle="Acme Corporation" />
        </Slide>
        <Slide key="revenue">
          <BigNumberSlide
            title="Revenue"
            stats={[
              { value: '$12.4M', label: 'Total Revenue', trend: '+18%', trendDirection: 'up' },
              { value: '847', label: 'Customers', trend: '+24%', trendDirection: 'up' },
            ]}
          />
        </Slide>
        <Slide key="details" notes="Walk through each principle.">
          <ContentSlide title="Key Principles">
            <BulletList
              items={['Revenue growth accelerating', 'Customer retention at 95%', 'New markets opened']}
              animateEntrance
            />
          </ContentSlide>
        </Slide>
      </SlidePlayer>
    </SceneEngine>
  );
}
```

`SlidePlayer` provides: keyboard navigation (arrow keys, Space, Enter, Home/End), pointer navigation (click next, right-click prev), touch swipe, fullscreen toggle (F key), progress indicator, and slide transitions — all pre-wired. Configure via `navigation`, `progressIndicator`, and `transition` props.

Three independent customization axes:
- **SceneTheme** (on `SceneEngine`) — colors, fonts, spacing
- **SlideTheme** (on `SlidePlayer.slideTheme`) — animation timing, content density, typography scale
- **SlideTemplate** (on `SlidePlayer.template`) — corporate chrome: logos, footers, watermarks

For full documentation, search for `slides-overview`.

---

## Choosing a Mode

Ask these questions in order:

1. **Is this a slide deck / presentation?** → Slide deck mode (`SceneEngine` + `SlidePlayer` from `@brewsite/slides`)
2. **Should the user scroll to progress through scenes?** → Scroll-driven mode (`ScrollStage` + `InputCoordinator`)
3. **Should it play automatically without user interaction?** → Embedded player mode (`SceneEmbed` with `autoPlay`)
4. **Does external UI (buttons, tabs, routing) control which scene is shown?** → Programmatic mode (`SceneEmbed` with `progress` prop, or raw `SceneEngine` + `useGoToScene`)
5. **Is it a single interactive 3D region with no scene progression?** → Canvas region mode (`SceneEmbed` with `interactive`)
