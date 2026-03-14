---
title: "MediaScreen Demo Page — apps/examples Implementation Plan"
doc_type: plan
status: ready
owner: Toolkit Architect
last_updated: 2026-03-13
change_history:
  - date: 2026-03-13
    author: Toolkit Architect
    summary: Initial plan
---

# MediaScreen Demo Page — Implementation Plan

## 1. Goal

Create a demo page at route `/media-screen-demo` in `apps/examples` that demonstrates all three `MediaScreen` source modes side-by-side:

1. **Video File** — `<MediaScreen src="...">` with a looping MP4
2. **Canvas Capture** — `captureCanvasStream()` feeding a live `<canvas>` animation into a `<MediaScreen streamId="...">`
3. **Display Capture** — `useDisplayCapture()` hook with Start/Stop buttons feeding a screen share into a `<MediaScreen streamId="...">`

This is the first working reference for `@brewsite/screens` and validates the full `screensPlugin()` integration path.

## 2. Files to Create

| # | Path | Purpose |
|---|------|---------|
| 1 | `apps/examples/src/media-screen-demo/scenes/mediaScreenScene.tsx` | Single scene DSL with three `<MediaScreen>` elements |
| 2 | `apps/examples/src/media-screen-demo/CanvasAnimation.tsx` | Standalone `<canvas>` component with animated gradient + timestamp |
| 3 | `apps/examples/src/media-screen-demo/widgetSetup.ts` | Plugin factory: `corePlugin()` + `screensPlugin()` |
| 4 | `apps/examples/src/media-screen-demo/MediaScreenDemoPage.tsx` | Page component with `SceneEngine`, canvas animation, overlay controls |

### Files to Modify

| # | Path | Change |
|---|------|--------|
| 5 | `apps/examples/src/App.tsx` | Add lazy import + `<Route>` + index link |

### No New Assets Required

The demo uses a publicly-hosted test video URL instead of committing binary assets. See Section 5 for the specific URL.

## 3. Scene DSL — `mediaScreenScene.tsx`

The scene uses NVS coordinates (0–1 range). Three screens are arranged in a horizontal row. Each screen is 0.24 NVS wide (roughly 24% of the viewport width). The `z` prop is world-space depth.

```tsx
// Single-scene DSL for the MediaScreen demo — three panels in a row.
import type { JSX } from 'react';
import {
  Scene,
  Camera,
  Lighting,
  Ambient,
  Directional,
  Background,
  TextBox,
} from '@brewsite/core';
import { MediaScreen } from '@brewsite/screens';

export const MediaScreenScene = (): JSX.Element => (
  <Scene id="ms-demo">
    <Camera mode="world" position={[0, 0.3, 5]} target={[0, 0, 0]} fov={50} />
    <Lighting intensityScale={1}>
      <Ambient intensity={0.4} color="#1a1a40" />
      <Directional intensity={1.2} color="#8090ff" position={[0, 8, 10]} />
      <Directional intensity={0.5} color="#4060ff" position={[-6, 3, 8]} />
    </Lighting>
    <Background color="#06081a" />

    {/* Panel 1 — Video File (left) */}
    <MediaScreen
      id="video-file"
      src="https://www.w3schools.com/html/mov_bbb.mp4"
      autoPlay
      loop
      muted
      x={0.2}
      y={0.5}
      z={0}
      width={0.24}
      bezel="dark"
      bezelThickness={0.03}
      gloss={0.4}
      selfIllumination={0.8}
      glow
      glowColor="#4488ff"
      glowOpacity={0.3}
    />

    {/* Panel 2 — Canvas Capture (center) */}
    <MediaScreen
      id="canvas-demo"
      streamId="canvas-demo"
      x={0.5}
      y={0.5}
      z={0}
      width={0.24}
      bezel="dark"
      bezelThickness={0.03}
      gloss={0.4}
      selfIllumination={0.8}
      glow
      glowColor="#44ff88"
      glowOpacity={0.3}
    />

    {/* Panel 3 — Display Capture (right) */}
    <MediaScreen
      id="display-demo"
      streamId="display-demo"
      x={0.8}
      y={0.5}
      z={0}
      width={0.24}
      bezel="dark"
      bezelThickness={0.03}
      gloss={0.4}
      selfIllumination={0.8}
      glow
      glowColor="#ff6644"
      glowOpacity={0.3}
    />

    {/* ── Labels under each screen ───────────────────────────────────── */}
    <TextBox id="label-video" x={0.1} y={0.82} w={0.2} h={0.08}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100%', textAlign: 'center',
      }}>
        <span style={{
          fontSize: 'clamp(10px, 1.2vw, 13px)',
          color: 'rgba(150, 180, 255, 0.8)',
          fontFamily: 'system-ui, sans-serif',
          letterSpacing: '0.05em',
        }}>
          Video File
        </span>
      </div>
    </TextBox>

    <TextBox id="label-canvas" x={0.4} y={0.82} w={0.2} h={0.08}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100%', textAlign: 'center',
      }}>
        <span style={{
          fontSize: 'clamp(10px, 1.2vw, 13px)',
          color: 'rgba(150, 255, 180, 0.8)',
          fontFamily: 'system-ui, sans-serif',
          letterSpacing: '0.05em',
        }}>
          Canvas Capture
        </span>
      </div>
    </TextBox>

    <TextBox id="label-display" x={0.7} y={0.82} w={0.2} h={0.08}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100%', textAlign: 'center',
      }}>
        <span style={{
          fontSize: 'clamp(10px, 1.2vw, 13px)',
          color: 'rgba(255, 160, 130, 0.8)',
          fontFamily: 'system-ui, sans-serif',
          letterSpacing: '0.05em',
        }}>
          Display Capture
        </span>
      </div>
    </TextBox>
  </Scene>
);
```

**Key design notes:**
- NVS x positions: `0.2` (left), `0.5` (center), `0.8` (right) — evenly spaced across the viewport.
- NVS `width={0.24}` — each screen takes ~24% of the viewport width. Height is auto-calculated from aspect ratio (16:9 default in the renderer).
- `bezelThickness={0.03}` — thin bezel (NVS-scaled by the renderer, the bezel depth constant is in world space).
- Each screen gets a distinct `glowColor` to visually distinguish the panels: blue for video, green for canvas, orange for display capture.
- Camera at `[0, 0.3, 5]` with `fov={50}` frames all three screens in a gallery view.
- Dark background (`#06081a`) for good contrast with the self-illuminated screens.

## 4. Canvas Animation Component — `CanvasAnimation.tsx`

A self-contained React component that renders an animated gradient with a timestamp overlay onto a `<canvas>` element. On mount, it calls `captureCanvasStream` to register the canvas stream. On unmount, it calls `stopCaptureStream` to clean up.

```tsx
// CanvasAnimation — animated <canvas> that feeds Panel 2 via captureCanvasStream.
import { useEffect, useRef, type JSX } from 'react';
import { captureCanvasStream, stopCaptureStream } from '@brewsite/screens';

const STREAM_ID = 'canvas-demo';
const WIDTH = 640;
const HEIGHT = 360;

export function CanvasAnimation(): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Register the canvas stream for the MediaScreen widget
    streamRef.current = captureCanvasStream(canvas, STREAM_ID, 30);

    let frameId = 0;

    function draw(): void {
      const t = performance.now() * 0.001; // seconds

      // Rotating gradient background
      const cx = WIDTH / 2;
      const cy = HEIGHT / 2;
      const angle = t * 0.5;
      const r = Math.max(WIDTH, HEIGHT) * 0.7;
      const x0 = cx + Math.cos(angle) * r;
      const y0 = cy + Math.sin(angle) * r;
      const x1 = cx - Math.cos(angle) * r;
      const y1 = cy - Math.sin(angle) * r;

      const grad = ctx!.createLinearGradient(x0, y0, x1, y1);
      const hue1 = (t * 30) % 360;
      const hue2 = (hue1 + 120) % 360;
      const hue3 = (hue1 + 240) % 360;
      grad.addColorStop(0, `hsl(${hue1}, 70%, 40%)`);
      grad.addColorStop(0.5, `hsl(${hue2}, 80%, 50%)`);
      grad.addColorStop(1, `hsl(${hue3}, 70%, 40%)`);

      ctx!.fillStyle = grad;
      ctx!.fillRect(0, 0, WIDTH, HEIGHT);

      // Floating circles
      for (let i = 0; i < 5; i++) {
        const ox = cx + Math.cos(t * (0.3 + i * 0.2) + i * 1.2) * (WIDTH * 0.3);
        const oy = cy + Math.sin(t * (0.4 + i * 0.15) + i * 0.8) * (HEIGHT * 0.3);
        const radius = 20 + Math.sin(t + i) * 10;
        ctx!.beginPath();
        ctx!.arc(ox, oy, radius, 0, Math.PI * 2);
        ctx!.fillStyle = `hsla(${(hue1 + i * 60) % 360}, 60%, 70%, 0.35)`;
        ctx!.fill();
      }

      // Timestamp overlay
      const now = new Date();
      const timeStr = now.toLocaleTimeString([], { hour12: false, fractionalSecondDigits: 1 } as Intl.DateTimeFormatOptions);
      ctx!.font = 'bold 28px system-ui, sans-serif';
      ctx!.textAlign = 'center';
      ctx!.textBaseline = 'bottom';
      ctx!.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx!.shadowColor = 'rgba(0, 0, 0, 0.5)';
      ctx!.shadowBlur = 6;
      ctx!.fillText(timeStr, cx, HEIGHT - 20);
      ctx!.shadowBlur = 0;

      // "LIVE" badge
      ctx!.font = 'bold 12px system-ui, sans-serif';
      ctx!.textAlign = 'left';
      ctx!.textBaseline = 'top';
      ctx!.fillStyle = '#ff4444';
      ctx!.beginPath();
      ctx!.arc(22, 22, 5, 0, Math.PI * 2);
      ctx!.fill();
      ctx!.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx!.fillText('LIVE', 32, 15);

      frameId = requestAnimationFrame(draw);
    }

    frameId = requestAnimationFrame(draw);

    return (): void => {
      cancelAnimationFrame(frameId);
      if (streamRef.current) {
        stopCaptureStream(STREAM_ID, streamRef.current);
        streamRef.current = null;
      }
    };
  }, []);

  // The canvas is visually hidden — its output goes to the 3D scene via captureCanvasStream.
  // position:absolute + opacity:0 keeps it in the DOM for captureStream but invisible.
  return (
    <canvas
      ref={canvasRef}
      width={WIDTH}
      height={HEIGHT}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: 1,
        height: 1,
        opacity: 0,
        pointerEvents: 'none',
      }}
    />
  );
}
```

**Key design notes:**
- The canvas is hidden (`opacity: 0`, 1px visual size) but remains in the DOM so `captureStream()` works.
- `captureCanvasStream(canvas, 'canvas-demo', 30)` registers the stream with `MediaScreenWidget.registerStream` under the same key used in the scene DSL's `streamId="canvas-demo"`.
- `stopCaptureStream('canvas-demo', stream)` is called on unmount — note this function requires both the `streamId` and the `stream` reference (per the actual API in `streamUtils.ts`).
- The animation is self-contained — its own `requestAnimationFrame` loop, independent of the BrewSite engine tick.
- Content: rotating gradient + floating circles + timestamp + "LIVE" badge — clearly demonstrates that the screen shows a live, updating source.

## 5. Video Asset Strategy

**Use a publicly-hosted test video URL.** This avoids committing binary assets to the repo.

**URL:** `https://www.w3schools.com/html/mov_bbb.mp4`

This is a ~700KB MP4 clip from Big Buck Bunny (Creative Commons), widely used for HTML5 video testing. It is hosted on a public CDN, loads via CORS-friendly headers, and works with Three.js `VideoTexture`.

**Fallback:** If the external URL causes CORS issues at runtime with Three.js VideoTexture (unlikely for this host, but possible), the scene author should replace it with a locally committed file at `apps/examples/public/videos/demo-loop.mp4`. Any short (5–15s) looping MP4 works. The plan proceeds with the external URL as default.

## 6. Widget Setup — `widgetSetup.ts`

```typescript
// Plugin factory for the MediaScreen demo — core + screens only.
import type { WidgetPlugin } from '@brewsite/core';
import { corePlugin } from '@brewsite/core';
import { screensPlugin } from '@brewsite/screens';

export function createMediaScreenDemoPlugins(): { plugins: WidgetPlugin[] } {
  return {
    plugins: [corePlugin(), screensPlugin()],
  };
}
```

No theme plugin, no diagram plugin — this demo is purely `core` + `screens`.

## 7. Page Component — `MediaScreenDemoPage.tsx`

```tsx
// MediaScreen Demo — demonstrates all three MediaScreen source modes.
import type { JSX } from 'react';
import { useMemo, useState } from 'react';
import {
  BackgroundLayer,
  EngineOverlayHost,
  InputCoordinator,
  SceneCanvas,
  SceneEngine,
  ScrollStage,
} from '@brewsite/core';
import { useDisplayCapture } from '@brewsite/screens';
import { createMediaScreenDemoPlugins } from './widgetSetup';
import { MediaScreenScene } from './scenes/mediaScreenScene';
import { CanvasAnimation } from './CanvasAnimation';

// ── Display capture controls (must be inside SceneEngine for hook access) ────

function DisplayCaptureControls(): JSX.Element {
  const { startCapture, stopCapture, isCapturing, error } = useDisplayCapture(
    'display-demo',
    { displaySurface: 'browser', frameRate: 30 },
  );

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 32,
        right: 32,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: 8,
        zIndex: 10,
      }}
    >
      {!isCapturing ? (
        <button
          type="button"
          onClick={() => void startCapture()}
          style={{
            padding: '10px 20px',
            background: 'rgba(255, 100, 68, 0.85)',
            color: '#fff',
            border: '1px solid rgba(255, 140, 100, 0.6)',
            borderRadius: 6,
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'system-ui, sans-serif',
            backdropFilter: 'blur(8px)',
          }}
        >
          Start Screen Capture
        </button>
      ) : (
        <button
          type="button"
          onClick={stopCapture}
          style={{
            padding: '10px 20px',
            background: 'rgba(60, 60, 80, 0.85)',
            color: '#fff',
            border: '1px solid rgba(120, 120, 150, 0.5)',
            borderRadius: 6,
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'system-ui, sans-serif',
            backdropFilter: 'blur(8px)',
          }}
        >
          Stop Capture
        </button>
      )}
      {error && (
        <div
          style={{
            padding: '6px 12px',
            background: 'rgba(200, 40, 40, 0.8)',
            color: '#fff',
            borderRadius: 4,
            fontSize: 11,
            maxWidth: 260,
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          {error.message}
        </div>
      )}
    </div>
  );
}

// ── Title overlay ────────────────────────────────────────────────────────────

function TitleOverlay(): JSX.Element {
  return (
    <div
      style={{
        position: 'absolute',
        top: 20,
        left: 0,
        right: 0,
        textAlign: 'center',
        zIndex: 10,
        pointerEvents: 'none',
      }}
    >
      <h1
        style={{
          fontSize: 'clamp(14px, 2vw, 20px)',
          fontWeight: 600,
          color: 'rgba(200, 220, 255, 0.85)',
          fontFamily: 'system-ui, sans-serif',
          margin: 0,
          letterSpacing: '0.04em',
        }}
      >
        MediaScreen Demo
      </h1>
      <p
        style={{
          fontSize: 'clamp(10px, 1.2vw, 13px)',
          color: 'rgba(150, 170, 200, 0.6)',
          fontFamily: 'JetBrains Mono, monospace',
          margin: '4px 0 0',
        }}
      >
        @brewsite/screens
      </p>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function MediaScreenDemoPage(): JSX.Element {
  const { plugins } = useMemo(() => createMediaScreenDemoPlugins(), []);

  return (
    <div style={{ height: '100vh', overflow: 'hidden', background: '#06081a' }}>
      <SceneEngine plugins={plugins}>
        {/* Scene declaration */}
        <MediaScreenScene />

        {/* Canvas + scroll layout */}
        <ScrollStage scrollHeightMode="scene-count" pixelsPerScene={100}>
          <BackgroundLayer style={{ position: 'absolute', inset: 0, zIndex: 0 }} />
          <SceneCanvas style={{ position: 'absolute', inset: 0, zIndex: 1 }} />
          <EngineOverlayHost passthroughPointerEvents />
          <InputCoordinator />
        </ScrollStage>

        {/* Hidden canvas for Panel 2 — stream registered via captureCanvasStream */}
        <CanvasAnimation />

        {/* HTML overlays — positioned over the 3D canvas */}
        <TitleOverlay />
        <DisplayCaptureControls />
      </SceneEngine>
    </div>
  );
}
```

**Key design notes:**

### ScrollStage Configuration
- Uses `ScrollStage` with `pixelsPerScene={100}` — a single scene with minimal scroll travel. The scene is essentially static; the user interacts with the capture button and the canvas animation, not a scroll timeline.
- No `EngineARContainer` — the canvas fills the full viewport (same pattern as `CoreShowcasePage`).
- `EngineOverlayHost passthroughPointerEvents` ensures pointer events reach the canvas for any future input actions while still rendering TextBox overlays.

### Display Capture Controls
- `DisplayCaptureControls` uses `useDisplayCapture('display-demo')` which returns `{ startCapture, stopCapture, isCapturing, error }`.
- The `startCapture` callback must be called from a click handler (browser requires user gesture for `getDisplayMedia`).
- The button is positioned `absolute` bottom-right, outside the 3D canvas, as HTML overlay. This satisfies the user-gesture requirement.
- Error state (e.g., user denied permission, API unavailable) is displayed inline below the button.
- **Important:** `useDisplayCapture` does NOT need to be inside `SceneEngine` — it's a standalone hook that calls `MediaScreenWidget.registerStream` statically. However, placing it inside `SceneEngine` keeps the component tree organized and ensures cleanup happens when the page unmounts.

### Canvas Animation
- `<CanvasAnimation />` is rendered inside `SceneEngine` but outside `ScrollStage`. It creates a hidden `<canvas>` element whose stream feeds Panel 2.
- The component is self-contained with its own rAF loop.

### Title Overlay
- Fixed HTML positioned over the canvas with `pointerEvents: 'none'`.
- Shows "MediaScreen Demo" and "@brewsite/screens" subtitle.

## 8. Route Registration — `App.tsx` Changes

Add one lazy import and one `<Route>` to `apps/examples/src/App.tsx`:

### Add lazy import (after the existing lazy imports, around line 12):

```typescript
const MediaScreenDemoPage = lazy(() => import('./media-screen-demo/MediaScreenDemoPage'));
```

### Add Route (after the existing routes, before the index route):

```tsx
<Route path="/media-screen-demo" element={<MediaScreenDemoPage />} />
```

### Add index link (in the `<ul>` list on the index page):

```tsx
<li><a href="/examples/media-screen-demo">MediaScreen Demo — @brewsite/screens</a></li>
```

## 9. Implementation Order

1. **Create `apps/examples/src/media-screen-demo/` directory.**

2. **Create `widgetSetup.ts`** — Plugin factory. This is the simplest file and has no dependencies on other new files.

3. **Create `scenes/mediaScreenScene.tsx`** — The scene DSL. Imports from `@brewsite/core` and `@brewsite/screens` only.

4. **Create `CanvasAnimation.tsx`** — The animated canvas component. Imports `captureCanvasStream` and `stopCaptureStream` from `@brewsite/screens`.

5. **Create `MediaScreenDemoPage.tsx`** — The page component. Imports from widgetSetup, scenes, and CanvasAnimation.

6. **Modify `App.tsx`** — Add the lazy import, route, and index link.

7. **Verify** — Run `pnpm dev` and navigate to `/examples/media-screen-demo`. Confirm:
   - Panel 1 (left) plays the video loop with blue glow.
   - Panel 2 (center) shows the animated gradient with green glow and a "LIVE" badge + timestamp.
   - Panel 3 (right) starts dark/black. Clicking "Start Screen Capture" opens the browser permission dialog. After granting, the screen share appears with orange glow. "Stop Capture" ends the session.
   - All three bezels, glosses, and glow effects render correctly.
   - The title bar and labels appear over the 3D canvas.

## 10. Testing

**No unit tests are required.** Scene files and page components in `apps/examples/` are demo code, not published library code. They are validated by visual inspection during development. The underlying `@brewsite/screens` package already has its own test suite covering `compileMediaScreen`, `captureCanvasStream`, and `stopCaptureStream`.

## 11. Dependency Verification

`@brewsite/screens` is already listed in `apps/package.json`:
```json
"@brewsite/screens": "workspace:*"
```

No `pnpm add` step is needed.

## 12. Corrections to Feature Note

The feature note (`note_media-screen-demo.md`) contains several inaccuracies that this plan corrects:

1. **Coordinate system.** The note suggests `x=-1.8, 0, 1.8` and `width=1.4, height=0.9` — these are world coordinates. The `<MediaScreen>` DSL uses NVS coordinates (0–1 range) for `x`, `y`, `width`, and `height`. This plan uses `x={0.2, 0.5, 0.8}` and `width={0.24}`.

2. **Bezel variant.** The note says `bezel="rounded"`. The actual `BezelVariant` type is `'none' | 'thin' | 'dark' | 'light' | 'chrome'`. This plan uses `bezel="dark"`.

3. **`inputMode="direct"`.** This prop does not exist in the `SceneEngine` or `ScrollStage` API. For a static single-scene demo, we use `ScrollStage` with `pixelsPerScene={100}` (minimal scroll travel). The scene is effectively static.

4. **`stopCaptureStream` signature.** The note says `stopCaptureStream('canvas-demo')` with one argument. The actual signature is `stopCaptureStream(streamId: string, stream: MediaStream)` — it requires both the ID and the stream reference. The `CanvasAnimation` component stores the stream in a ref for cleanup.
