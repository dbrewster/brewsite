---
title: "MediaScreen Demo Page for apps/examples"
doc_type: note
owner: Toolkit Product
status: draft
updated: 2026-03-13
---

# MediaScreen Demo Page

## Problem Statement

The `@brewsite/screens` package ships three elements (`Screen`, `MediaScreen`, `ImagePanel`), a `useDisplayCapture` hook, and `captureCanvasStream` / `stopCaptureStream` utilities — but there is no working example that demonstrates the `MediaScreen` element. Without a demo page, developers integrating `<MediaScreen>` have no reference for:

1. How to wire `screensPlugin()` into a `SceneEngine` plugin array.
2. How the three `MediaScreen` source modes work: video URL (`src`), canvas capture (`streamId` + `captureCanvasStream`), and display capture (`streamId` + `useDisplayCapture`).
3. What the visual result looks like — bezel, gloss, glow, self-illumination — across different source types.
4. How browser permission prompts interact with the `useDisplayCapture` lifecycle.

This demo was explicitly deferred during the `@brewsite/screens` package implementation (see `plan_screens-package.md`, step 19: "MediaScreen demo page — DEFERRED"). It is now the next deliverable.

## Proposed Solution

Add a new example page at `apps/examples/src/media-screen-demo/` with route `/media-screen-demo`. The page demonstrates all three `MediaScreen` source modes in a single scene with three screen panels.

### Page Structure

```
apps/examples/src/media-screen-demo/
  MediaScreenDemoPage.tsx    — Page component (lazy-loaded from App.tsx)
  widgetSetup.ts             — Plugin factory: corePlugin() + screensPlugin()
  scenes/
    mediaScreenScene.tsx     — Single scene DSL with three <MediaScreen> elements
  CanvasAnimation.tsx        — Small React component that renders an animated <canvas>
```

### The Three Panels

**Panel 1 — Video File (`src` prop)**
- Uses `<MediaScreen id="video-file" src="/videos/demo-loop.mp4" autoPlay loop muted ... />`
- Demonstrates the simplest integration path: a looping MP4 file as a WebGL texture.
- The video file must be placed in `apps/examples/public/videos/demo-loop.mp4`. Any short (5–15s) looping video works. A simple screen recording, abstract animation, or stock footage clip is fine — the content is secondary to demonstrating the rendering.

**Panel 2 — Canvas Capture (`captureCanvasStream` + `streamId`)**
- A `<canvas>` element in the DOM renders a simple procedural animation (e.g., rotating gradient, bouncing particles, or a clock). This is the `CanvasAnimation` component.
- On mount, `captureCanvasStream(canvasRef.current, 'canvas-demo', { frameRate: 30 })` registers the stream with the static `MediaScreenWidget` registry.
- The scene DSL uses `<MediaScreen id="canvas-demo" streamId="canvas-demo" ... />`.
- On unmount, `stopCaptureStream('canvas-demo')` cleans up.
- This panel demonstrates real-time canvas-to-WebGL without any user interaction or permission prompt.

**Panel 3 — Display Capture (`useDisplayCapture` + `streamId`)**
- Uses the `useDisplayCapture('display-demo')` hook.
- Before capture starts, the screen shows a static placeholder state (enabled but no stream — the renderer should show a blank/dark screen or a subtle "Click to share" text in the HUD overlay).
- A floating button (positioned via CSS, outside the 3D canvas) calls `startCapture()` on click. The browser's native permission dialog appears.
- Once granted, the screen live-streams the selected display/window/tab.
- A second button calls `stopCapture()` to end the session.
- The scene DSL uses `<MediaScreen id="display-demo" streamId="display-demo" ... />`.
- This panel demonstrates the full `useDisplayCapture` lifecycle including the user-gesture requirement, permission UX, and cleanup.

### Scene Layout

A single scene with all three `<MediaScreen>` elements arranged in a row:

| Position | Panel | x | y | z |
|----------|-------|---|---|---|
| Left | Video File | -1.8 | 0 | 0 |
| Center | Canvas Capture | 0 | 0 | 0 |
| Right | Display Capture | 1.8 | 0 | 0 |

All three screens use:
- `width={1.4}` `height={0.9}` (16:10-ish aspect, comfortable fit)
- `bezel="rounded"` `bezelThickness={0.03}`
- `gloss={0.4}` `selfIllumination={0.8}`
- `glow` enabled with a subtle blue tint

Camera positioned at `[0, 0.2, 4.5]` looking at origin, giving a gallery view of the three screens.

The scene uses `inputMode="direct"` (no scroll — the user interacts with the capture button, not a scroll timeline). A single static scene is sufficient; there is no need for scene transitions in this demo.

### Plugin Wiring

`widgetSetup.ts`:
```typescript
import type { WidgetPlugin } from '@brewsite/core';
import { corePlugin } from '@brewsite/core';
import { screensPlugin } from '@brewsite/screens';

export function createMediaScreenDemoPlugins(): { plugins: WidgetPlugin[] } {
  return {
    plugins: [corePlugin(), screensPlugin()],
  };
}
```

No theme is required unless the page also uses diagram elements. Core + screens is the minimal plugin set.

### App.tsx Integration

Add the lazy import and route following the existing pattern:

```typescript
const MediaScreenDemoPage = lazy(() => import('./media-screen-demo/MediaScreenDemoPage'));
// ...
<Route path="/media-screen-demo" element={<MediaScreenDemoPage />} />
```

Add a link to the index page list:
```html
<li><a href="/examples/media-screen-demo">MediaScreen Demo — @brewsite/screens</a></li>
```

### HUD Overlay Content

The page should use `EngineOverlayHost` with minimal overlay content:
- A title bar: "MediaScreen Demo — @brewsite/screens"
- Labels under each screen identifying the source mode: "Video File", "Canvas Capture", "Display Capture"
- The "Start/Stop Capture" buttons for Panel 3, positioned below the right screen

This overlay content is standard HTML/CSS positioned over the 3D canvas — not HUD items compiled into the scene timeline.

## Key Design Decisions

1. **Single scene, no scroll.** This demo is about the `MediaScreen` element and its source modes, not scene transitions or timeline choreography. A static `inputMode="direct"` scene keeps focus on the screens themselves and avoids the complexity of baking stream registration into a timeline.

2. **Canvas animation is self-contained.** The `CanvasAnimation` component owns its own `<canvas>` element, animation loop (`requestAnimationFrame`), and cleanup. It does not depend on the BrewSite engine tick. This keeps the demo simple and avoids coupling the canvas animation to the scene lifecycle.

3. **Display capture buttons live outside the 3D canvas.** The `useDisplayCapture` hook returns `startCapture` / `stopCapture` callbacks and `isCapturing` / `error` state. The buttons calling these must be in the React tree (for the user-gesture requirement), rendered as HTML overlay — not as a 3D element. Position them as fixed/absolute UI below the right screen panel.

4. **No `<Screen>` (CSS3D) in this demo.** This page demonstrates `MediaScreen` (WebGL VideoTexture) specifically. The `<Screen>` element (CSS3DRenderer iframe) has different constraints (no 3D compositing, DOM overlay) and warrants its own demo page if needed.

5. **Video asset is a placeholder.** The demo video does not need to be a real product asset. A 5–15 second looping clip (abstract animation, screen recording, stock footage) placed in `public/videos/` is sufficient. If no video asset is available at implementation time, the architect should specify how to generate or source one (e.g., a programmatically-generated MP4, or a Creative Commons clip). Alternatively, the video panel can use a publicly-hosted test video URL to avoid committing binary assets.

## Open Questions

1. **Video asset strategy.** Should the demo commit a small MP4 to `apps/examples/public/videos/`, or reference an external URL? Committing keeps the demo self-contained but adds binary bloat to the repo. An external URL avoids bloat but introduces a network dependency and potential CORS issues with `VideoTexture`. **Recommendation:** Commit a small (< 2 MB) looping clip. The examples app is private and not published to npm, so the binary cost is acceptable.

2. **Browser compatibility messaging.** `getDisplayMedia` requires HTTPS in production and a secure context. The Vite dev server serves over `localhost` which qualifies. Should the demo include a visible warning if the API is unavailable (e.g., non-secure context)? The `useDisplayCapture` hook already sets an `error` state — the demo should surface `error.message` next to the capture button. No additional detection logic needed.

3. **Canvas animation content.** The `CanvasAnimation` component needs to render something visually interesting enough to demonstrate that it's a live capture (not a static image). Suggestions: animated gradient with a timestamp overlay, simple particle system, or a rotating color wheel. The architect should specify the exact animation to avoid subjective back-and-forth during implementation.

4. **`@brewsite/screens` dependency in examples.** Confirm that `@brewsite/screens` has already been added to `apps/examples/package.json` as part of the screens package implementation. If not, the plan must include `pnpm --filter @brewsite/examples add @brewsite/screens` as a prerequisite step.

5. **Input mode and camera.** The note specifies `inputMode="direct"` for a static scene. Confirm whether the current `SceneEngine` / `InputCoordinator` supports a single-scene direct-mode configuration without a `ScrollStage`. If a `ScrollStage` wrapper is required even for direct mode, the architect must account for that in the page layout.
