---
title: "@brewsite/screens — ImagePanel, Screen, and MediaScreen"
doc_type: note
owner: claude-author
status: active
updated: 2026-03-21
---

## Package Clarification

`ImagePanel`, `Screen`, and `MediaScreen` are **not** part of `@brewsite/diagram`. They live in `@brewsite/screens`. The CLAUDE.md workspace overview mentions `@brewsite/diagram` handles "screen elements" but the actual DSL components ship separately.

Install:

```bash
pnpm add @brewsite/screens
```

Register `screensPlugin()` in your `SceneEngine` plugins array:

```tsx
import { screensPlugin } from '@brewsite/screens';

const plugins = [corePlugin(), screensPlugin()];
```

No widget pre-declaration needed. All three element types (`Screen`, `MediaScreen`, `ImagePanel`) create widgets lazily on first DSL compile encounter.

---

## ImagePanel Element

`<ImagePanel>` renders a static image (PNG, JPG, WebP) as a physical 3D floating frame with WebGL bezel, clearcoat gloss, optional glow, and PBR lighting. It is fully Three.js — tilt, rotation, and physical materials are fully supported. Use this for screenshots, mockups, photographs, and UI previews.

```tsx
interface ImagePanelProps {
  id: string;               // Required. Unique, stable across scenes.
  src: string;              // Public asset URL. E.g. '/screenshots/dashboard.png'
  x?: SceneLength;          // NVS horizontal center. Default: "50%"
  y?: SceneLength;          // NVS vertical center. Default: "50%"
  z?: number;               // World-space depth. Default: 0
  width?: SceneLength;      // NVS width fraction. Default: "60%"
  height?: SceneLength;     // NVS height fraction. Derived from aspect ratio if omitted.
  rotation?: [SceneAngle, SceneAngle, SceneAngle]; // Euler [x, y, z]. Default: [0, 0, 0]
  scale?: number;           // Uniform scale. Default: 1
  bezel?: ImagePanelBezelVariant; // 'none' | 'thin' | 'dark' | 'light' | 'chrome'. Default: 'dark'
  bezelThickness?: number;  // World units. Default: 0.3
  opacity?: number;         // Overall opacity [0–1]. Default: 1
  gloss?: number;           // MeshPhysicalMaterial clearcoat [0–1]. Default: 0.5
  glossRoughness?: number;  // Clearcoat roughness [0–1]. Default: 0.05
  selfIllumination?: number; // Emissive intensity to simulate lit screen [0–1]. Default: 0.15
  glow?: boolean;           // Render glow halo sprite. Default: true
  glowColor?: string;       // CSS hex. Default: '#88ccff'
  glowScale?: number;       // Multiplier relative to panel size. Default: 1.4
  glowOpacity?: number;     // Glow sprite opacity [0–1]. Default: 0.35
  enabled?: boolean;        // Whether rendered. Default: true
}
```

**NVS positioning:** `x` and `y` are the center point of the panel, not the top-left corner. `x={"50%"}, y={"50%"}` centers the panel in the viewport. The `width` prop is a `SceneLength` (e.g. `width={"60%"}` = 60% of viewport width). Height derives from image aspect ratio unless explicitly set.

**Rotation:** A Y-axis tilt gives a natural perspective feel:

```tsx
<ImagePanel
  id="app-screenshot"
  src="/screenshots/dashboard.png"
  x={"55%"}
  y={"50%"}
  width={"55%"}
  rotation={[0, "-0.25rad", 0]}  // slight Y tilt
  bezel="dark"
  gloss={0.5}
  glow
  glowColor="#88ccff"
  glowOpacity={0.3}
/>
```

**For photographs (non-illuminated):** Set `selfIllumination={0}` and `glow={false}`:

```tsx
<ImagePanel
  id="product-photo"
  src="/photos/product.jpg"
  x={"50%"}
  y={"50%"}
  width={"50%"}
  bezel="none"
  gloss={0.2}
  selfIllumination={0}
  glow={false}
/>
```

**For screen mockups (fully lit look):**

```tsx
<ImagePanel
  id="saas-mockup"
  src="/mockups/app-ui.png"
  x={"50%"}
  y={"50%"}
  width={"65%"}
  bezel="chrome"
  bezelThickness={0.04}
  gloss={0.7}
  glossRoughness={0.02}
  selfIllumination={0.4}
  glow
  glowColor="#aaddff"
  glowOpacity={0.4}
/>
```

**Complete ImagePanel scene:**

```tsx
import type { JSX } from 'react';
import {
  Scene, ProgressManager, Camera, Lighting, Ambient, Directional, Background,
} from '@brewsite/core';
import { ImagePanel } from '@brewsite/screens';

export const SceneProductScreenshot = (): JSX.Element => (
  <Scene id="product-screenshot">
    <ProgressManager scrollUnits={1200} />
    <Camera mode="world" position={[0, 0, 8]} target={[0, 0, 0]} fov={50} />
    <Lighting intensityScale={1}>
      <Ambient intensity={0.4} color="#1a1a40" />
      <Directional intensity={1.2} color="#8090ff" position={[0, 8, 10]} />
      <Directional intensity={0.5} color="#4060ff" position={[-6, 3, 8]} />
    </Lighting>
    <Background color="#06081a" />

    <ImagePanel
      id="dashboard-screenshot"
      src="/screenshots/dashboard.png"
      x={"50%"}
      y={"50%"}
      width={"70%"}
      rotation={[0, "-0.15rad", 0]}
      bezel="dark"
      bezelThickness={0.03}
      gloss={0.55}
      selfIllumination={0.25}
      glow
      glowColor="#6699ff"
      glowOpacity={0.3}
    />
  </Scene>
);
```

---

## Screen Element

`<Screen>` renders a live interactive website in 3D space via a CSS3DObject iframe. The website is fully interactive — the user can scroll and click inside it. Full 3D rotation is supported via CSS3DRenderer.

Use `<Screen>` when you want to embed a live product URL or localhost dev server inside your 3D scene. Do not use `<Screen>` for static images — use `<ImagePanel>`. For video or live MediaStream, use `<MediaScreen>`.

**Limitation:** The target URL must not send `X-Frame-Options: DENY` or `Content-Security-Policy: frame-ancestors 'none'`. Works best with your own application URLs and localhost.

```tsx
interface ScreenProps {
  id: string;               // Required. Unique, stable across scenes.
  src: string;              // URL loaded in the iframe.
  x?: SceneLength;          // NVS horizontal center. Default: "50%"
  y?: SceneLength;          // NVS vertical center. Default: "50%"
  z?: number;               // World-space depth. Default: 0
  width?: SceneLength;      // NVS width fraction. Default: "62.5%"
  height?: SceneLength;     // NVS height fraction. Defaults to width × 9/16.
  rotation?: [SceneAngle, SceneAngle, SceneAngle]; // Euler [x, y, z]. Default: [0, 0, 0]
  scale?: number;           // Uniform scale. Default: 1
  bezel?: ScreenBezelVariant; // 'none' | 'thin' | 'dark' | 'light' | 'chrome'. Default: 'dark'
  bezelThickness?: number;  // World units. Default: 0.3
  opacity?: number;         // Bezel, glow, and iframe div opacity [0–1]. Default: 1
  glow?: boolean;           // Default: true
  glowColor?: string;       // Default: '#88ccff'
  glowScale?: number;       // Default: 1.4
  glowOpacity?: number;     // Default: 0.35
  enabled?: boolean;        // Default: true
}
```

**Note:** `<Screen>` uses CSS3DRenderer for the iframe — it composites using CSS transforms, not WebGL depth. The bezel and glow are WebGL objects, but the iframe content itself is a CSS3D element. This means the iframe does not correctly occlude or get occluded by WebGL geometry at the pixel level. For fully composited depth, use `<MediaScreen>` with `streamId`.

```tsx
<Screen
  id="product-demo"
  src="https://app.example.com/demo"
  x={"50%"}
  y={"50%"}
  width={"60%"}
  bezel="dark"
  bezelThickness={0.03}
  glow
  glowColor="#88ccff"
  glowOpacity={0.3}
/>
```

---

## MediaScreen Element

`<MediaScreen>` renders a video file or live `MediaStream` as a physical 3D screen with WebGL compositing (full depth buffer support). Use this for product demo videos, canvas captures, and display captures.

```tsx
interface MediaScreenProps {
  id: string;
  src?: string;             // Video file URL (mp4, webm). Mutually exclusive with streamId.
  streamId?: string;        // Registry key for a live MediaStream. Mutually exclusive with src.
  autoPlay?: boolean;       // Auto-play video on load. Default: true
  loop?: boolean;           // Loop video playback. Default: true
  muted?: boolean;          // Mute video audio. Default: true (important for browser autoplay policies)
  x?: SceneLength;          // NVS center X. Default: "50%"
  y?: SceneLength;          // NVS center Y. Default: "50%"
  z?: number;               // World-space depth. Default: 0
  width?: SceneLength;      // NVS width fraction. Default: "62.5%"
  height?: SceneLength;     // NVS height fraction. Derived from aspect ratio if omitted.
  rotation?: [SceneAngle, SceneAngle, SceneAngle]; // Euler [x, y, z]. Default: [0, 0, 0]
  scale?: number;           // Uniform scale. Default: 1
  bezel?: MediaScreenBezelVariant; // 'none' | 'thin' | 'dark' | 'light' | 'chrome'. Default: 'dark'
  bezelThickness?: number;  // World units. Default: 0.3
  opacity?: number;         // [0–1]. Default: 1
  gloss?: number;           // MeshPhysicalMaterial clearcoat [0–1]. Default: 0.5
  glossRoughness?: number;  // Clearcoat roughness [0–1]. Default: 0.05
  selfIllumination?: number; // Emissive intensity [0–1]. Default: 0.3
  glow?: boolean;           // Render glow halo sprite. Default: true
  glowColor?: string;       // CSS hex. Default: '#88ccff'
  glowScale?: number;       // Multiplier relative to screen size. Default: 1.4
  glowOpacity?: number;     // Glow sprite opacity [0–1]. Default: 0.35
  enabled?: boolean;        // Whether rendered. Default: true
}
```

**Video file playback:**

```tsx
<MediaScreen
  id="demo-video"
  src="/videos/product-demo.mp4"
  autoPlay
  loop
  muted
  x={"50%"}
  y={"50%"}
  width={"65%"}
  bezel="dark"
  bezelThickness={0.03}
  gloss={0.4}
  selfIllumination={0.8}
  glow
  glowColor="#4488ff"
  glowOpacity={0.3}
/>
```

**Live MediaStream (canvas capture, display capture):** Use `captureCanvasStream(canvas, streamId, frameRate?)` to capture a same-origin canvas and auto-register it with `MediaScreenWidget`. The function takes three arguments: the canvas element, the stream ID key (matching `<MediaScreen streamId="...">`), and an optional frame rate (default: 30). It returns the created `MediaStream`. No separate `MediaScreenWidget.registerStream` call is needed — `captureCanvasStream` handles registration internally.

```tsx
import { captureCanvasStream } from '@brewsite/screens';

// In your app bootstrap:
const canvasEl = document.getElementById('my-canvas') as HTMLCanvasElement;
const stream = captureCanvasStream(canvasEl, 'my-canvas-stream', 30); // auto-registers

// In the scene DSL:
<MediaScreen
  id="canvas-screen"
  streamId="my-canvas-stream"
  x={"50%"}
  y={"50%"}
  width={"50%"}
  bezel="dark"
  glow
  glowColor="#44ff88"
  glowOpacity={0.3}
/>
```

For display capture (user selects a screen/window via browser API), use the `useDisplayCapture` hook:

```tsx
import { useDisplayCapture } from '@brewsite/screens';
import { MediaScreenWidget } from '@brewsite/screens';

function MyApp() {
  const { stream, start } = useDisplayCapture();

  useEffect(() => {
    if (stream) MediaScreenWidget.registerStream('display', stream);
  }, [stream]);

  return <button onClick={start}>Share screen</button>;
}
```

**`muted` default and browser autoplay:** `muted` defaults to `true`. This is important because most browsers block autoplay of unmuted video. If you set `muted={false}`, the browser may prevent `autoPlay` from working until the user interacts with the page. Keep `muted={true}` (the default) for reliable autoplay behavior.

**`stopCaptureStream(streamId, stream)` — cleanup function:**

When tearing down a canvas capture (e.g. on component unmount or scene teardown), call `stopCaptureStream` to stop all tracks and unregister the stream from `MediaScreenWidget`:

```tsx
import { captureCanvasStream, stopCaptureStream } from '@brewsite/screens';

// Setup:
const stream = captureCanvasStream(canvasEl, 'my-stream', 30);

// Cleanup (e.g. in useEffect return, or scene teardown):
stopCaptureStream('my-stream', stream);
```

`stopCaptureStream` takes two arguments:
- `streamId: string` — the same key used in `captureCanvasStream` and `<MediaScreen streamId="...">`
- `stream: MediaStream` — the `MediaStream` instance returned by `captureCanvasStream`

It calls `stream.getTracks().forEach(t => t.stop())` and then `MediaScreenWidget.unregisterStream(streamId)`.

---

## Using ImagePanel and Screen in Carousels

All three element types (`ImagePanel`, `Screen`, `MediaScreen`) are spatial elements in the BrewSite constraint model. When placing more than one spatial element as direct `<Scene>` children, wrap each in a `<View>` inside a `<ViewLayout>`.

```tsx
import {
  Scene, Camera, Lighting, Ambient, Directional, Background,
  ViewLayout, View, InputController, Action, KeyMap,
} from '@brewsite/core';
import { ImagePanel } from '@brewsite/screens';

const CAROUSEL_ID = 'screenshots-carousel';

export const SceneScreenshotCarousel = () => (
  <Scene id="screenshots">
    <Camera mode="world" position={[0, 0.3, 5]} target={[0, 0, 0]} fov={50} />
    <Lighting intensityScale={1}>
      <Ambient intensity={0.4} color="#1a1a40" />
      <Directional intensity={1.2} color="#8090ff" position={[0, 8, 10]} />
    </Lighting>
    <Background color="#06081a" />

    {/* Default carousel bindings (ArrowRight/Left + scroll X) work automatically
        when primaryCarouselId is set. Override here to use explicit layoutId: */}
    <InputController>
      <Action id="default-carousel-next" type="carousel.next" layoutId={CAROUSEL_ID} stepSlides={1}>
        <KeyMap keyName="ArrowRight" />
      </Action>
      <Action id="default-carousel-prev" type="carousel.prev" layoutId={CAROUSEL_ID} stepSlides={1}>
        <KeyMap keyName="ArrowLeft" />
      </Action>
    </InputController>

    <ViewLayout id={CAROUSEL_ID} kind="carousel">
      <View id="panel-1">
        <ImagePanel
          id="screenshot-1"
          src="/screenshots/overview.png"
          x={"50%"}
          y={"50%"}
          width={"65%"}
          bezel="dark"
          gloss={0.55}
          selfIllumination={0.25}
          glow
          glowColor="#6699ff"
          glowOpacity={0.3}
        />
      </View>

      <View id="panel-2">
        <ImagePanel
          id="screenshot-2"
          src="/screenshots/analytics.png"
          x={"50%"}
          y={"50%"}
          width={"65%"}
          bezel="dark"
          gloss={0.55}
          selfIllumination={0.25}
          glow
          glowColor="#66ff99"
          glowOpacity={0.3}
        />
      </View>

      <View id="panel-3">
        <ImagePanel
          id="screenshot-3"
          src="/screenshots/settings.png"
          x={"50%"}
          y={"50%"}
          width={"65%"}
          bezel="dark"
          gloss={0.55}
          selfIllumination={0.25}
          glow
          glowColor="#ff9966"
          glowOpacity={0.3}
        />
      </View>
    </ViewLayout>
  </Scene>
);
```

The same pattern applies to `<Screen>` and `<MediaScreen>` panels — wrap each in a `<View>` when multiple spatial elements appear in the same scene. A single `<ImagePanel>`, `<Screen>`, or `<MediaScreen>` as the only spatial child of `<Scene>` does not need a `<View>` wrapper (the compiler auto-wraps it).

**Plugin setup for screens:**

```tsx
import { corePlugin } from '@brewsite/core';
import { screensPlugin } from '@brewsite/screens';

const plugins = [corePlugin(), screensPlugin()];
// No diagramPlugin() needed unless you also have <Diagram> elements.
```
