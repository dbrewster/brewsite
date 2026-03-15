---
title: "@brewsite/screens Package"
doc_type: prd
owner: Toolkit Product
status: current
updated: 2026-03-15
version_history:
  - version: "0.1.0"
    date: 2026-03-13
    summary: >
      Initial release. Extracted Screen (CSS3DRenderer iframe) and ImagePanel from
      @brewsite/diagram. Added new MediaScreen (WebGL VideoTexture + live MediaStream)
      element. Introduced screensPlugin() lazy WidgetPlugin factory and useDisplayCapture
      hook. bezelGeometry moved to package-local _shared/; glowSprite retained in diagram
      (used internally by NodeRenderer).
  - version: "0.1.0-fix"
    date: 2026-03-15
    summary: >
      PRD codebase alignment audit. Fixed Screen rendering architecture: uses CSS3DRenderer
      (not CSS pixel projection), full 3D rotation IS supported. Removed rotation constraint
      claims and console.warn for rotation. Fixed positioning: all three elements use NVS
      fractions (nvsX, nvsY, nvsWidth, nvsHeight) not world-unit position/width/height.
      Fixed shared overlay: uses CSS3DRenderer div from acquireCSS3DContext(), not a
      data-brewsite-screen-overlay div. Updated all prop tables and code examples.
---

# @brewsite/screens Package

## Overview

`@brewsite/screens` is a published BrewSite toolkit package that provides three 3D display surface elements — `<Screen>`, `<MediaScreen>`, and `<ImagePanel>` — along with the `screensPlugin()` registration factory and the `useDisplayCapture` hook. The package sits on top of `@brewsite/core` and is independent of `@brewsite/diagram`, `@brewsite/model`, and `@brewsite/charts`. Its primary consumer is any BrewSite scene author who needs to embed live websites, video content, or static image mockups as physical 3D objects in a marketing or demo scene.

## Problem Statement

Before this package, `Screen` and `ImagePanel` lived inside `@brewsite/diagram`. Consumers who only needed a product screenshot or an iframe screen in a scene were forced to take the entire diagram package as a dependency — including Three.js diagram geometry, layout algorithms, theme resolution, and icon registries. The footprint was disproportionate to the use case. Additionally, no first-class video or screen capture element existed anywhere in the toolkit, leaving consumers to build ad-hoc `<video>` texture solutions with no shared lifecycle management.

## Goals & Success Metrics

**Primary metrics:**
- Consumers can add a video or screen-capture element to a scene without depending on `@brewsite/diagram`.
- `screensPlugin()` registers all three elements with zero upfront widget enumeration — a single plugin line is the complete setup.
- `useDisplayCapture` manages the full `getDisplayMedia()` lifecycle, including user-gesture gating and automatic stream cleanup on unmount.

**Guardrail metrics:**
- `@brewsite/screens` does not import from `@brewsite/diagram`, `@brewsite/model`, or `@brewsite/charts`.
- No Three.js in `types.ts`, `dsl.tsx`, or `compile.ts` for any element.
- `MediaScreenWidget.dispose()` stops the video element and releases the `THREE.VideoTexture` without GPU memory leaks.

## Non-Goals

- `@brewsite/screens` does not provide `DiagramCanvas` integration. All three elements render in world space, not canvas-local space.
- No audio support for `MediaScreen`. The `muted` prop defaults to `true` for autoplay compatibility; unmuted playback requires a direct consumer gesture.
- No rounded bezel corners. All bezel variants use rectangular `THREE.BoxGeometry` segments.
- `Screen` does not support interaction pass-through to the Three.js scene beneath it. The iframe captures pointer events while it is visible.
- Image preloading, CDN management, and asset optimization are consumer responsibilities.
- `MediaScreen` does not support multiple simultaneous streams on one widget. One widget plays one source at a time.

## Consumer Stories

- As a toolkit consumer, I want to embed a live product website in a 3D bezel frame using a single DSL declaration so that viewers can interact with the application during a scene.
- As a toolkit consumer, I want to display a product video (or live screen capture) as a WebGL texture on a 3D panel so that I can compose it alongside other 3D elements with correct depth, lighting, and glow.
- As a toolkit consumer, I want to show a product screenshot at any tilt angle with gloss and glow so that the image panel feels physically present in the scene.
- As a toolkit consumer, I want to register all three screen element types with a single `screensPlugin()` call so that I do not need to enumerate widget IDs upfront.
- As a toolkit consumer, I want a hook that manages the `getDisplayMedia()` lifecycle — including user gesture gating, track-ended cleanup, and unmount safety — so that I do not write this boilerplate myself.
- As a toolkit consumer, I want `<Screen>` to support full 3D rotation via CSS3DRenderer so that I can create carousel layouts and angled perspective views of live websites.

## Functional Requirements

1. `screensPlugin()` must register `Screen`, `MediaScreen`, and `ImagePanel` DSL node handlers via `configureRegistry`. Widget instances must be created lazily on first compile encounter — no ID enumeration is required from the consumer.
2. `<Screen>` must render a live interactive `<iframe>` element as a `CSS3DObject` placed in a shared `CSS3DRenderer` scene. The `CSS3DRenderer` is acquired via `acquireCSS3DContext()` from `css3dSetup.ts`, which creates a singleton `CSS3DRenderer` instance per canvas parent element with reference counting. Full 3D rotation is supported — the iframe tilts in 3D space via CSS3D transforms.
3. `compileScreen()` must apply NVS validation in development mode using `validateNVSScalar()` for `nvsX`, `nvsY`, and `nvsWidth`. No rotation warnings are emitted — full 3D rotation is supported.
4. `<MediaScreen>` must support two mutually exclusive source modes: a video file URL (`src`) and a live `MediaStream` referenced by registry key (`streamId`).
5. `MediaScreenWidget.registerStream(key, stream)` and `MediaScreenWidget.unregisterStream(key)` must be static methods that accept `MediaStream` objects from any source (file, camera, display capture).
6. `useDisplayCapture(streamId, options?)` must: call `navigator.mediaDevices.getDisplayMedia()` only in response to a user gesture (consumer calls `startCapture()` from a click handler); automatically call `unregisterStream` when the video track ends or the component unmounts; expose `isCapturing`, `error`, `startCapture`, and `stopCapture`.
7. `<ImagePanel>` must infer panel height from the loaded texture's aspect ratio when `height` is not specified in the DSL. The panel renders at a 1:1 fallback height until the texture loads.
8. `ScreenWidget.initialize()` must acquire a `CSS3DContext` via `acquireCSS3DContext(canvasParent)`. The `CSS3DContext` contains a `CSS3DRenderer` instance, a `THREE.Scene` for CSS3D objects, and a frame-deduplication counter. Multiple `ScreenWidget` instances on the same page share this context via reference counting. On dispose, `releaseCSS3DContext()` decrements the ref count and removes the CSS3D renderer's DOM element when the last widget is disposed.
9. All three elements must use `bezelGeometry.ts` (`createBezel` / `disposeBezel`) from `elements/_shared/` for bezel frame construction.
10. All three elements must participate in the `SceneTrack` transition model via `FunctionalTransitionSpec`. Continuously interpolated fields and stepped fields are specified per-element (see API Design).

## API Design

### Package Installation

```bash
pnpm add @brewsite/screens
```

Peer dependencies: `@brewsite/core`, `react`, `react-dom`, `three`.

### Dependency Graph

```
@brewsite/core
      ↑
@brewsite/screens   (independent of diagram / model / charts)
```

### Plugin Registration

The single required setup step — add `screensPlugin()` to your `plugins` array alongside `corePlugin()`:

```tsx
import { ScenePlayer, corePlugin } from '@brewsite/core';
import { screensPlugin } from '@brewsite/screens';

<ScenePlayer
  scenes={scenes}
  plugins={[corePlugin(), screensPlugin()]}
/>
```

Widget instances are created lazily on first DSL compilation. There is no upfront widget enumeration or `registry.register()` call needed.

### `<Screen>` — Live Interactive Website

Renders a live `<iframe>` as a `CSS3DObject` in 3D space, backed by a Three.js bezel + glow. The iframe is a real DOM element positioned in 3D via `CSS3DRenderer`; users can click, scroll, and type normally. Full 3D rotation is supported.

```tsx
import { Screen } from '@brewsite/screens';

<Screen
  id="product-demo"
  src="https://app.example.com/demo"
  x={0.5}
  y={0.5}
  z={0}
  rotation={[0, 0.2, 0]}   // full 3D rotation supported via CSS3DRenderer
  width={0.625}
  bezel="dark"
  glow
  glowColor="#88ccff"
/>
```

**Key props:**

| Prop | Type | Default | Notes |
|------|------|---------|-------|
| `id` | `string` | required | Stable across scenes |
| `src` | `string` | required | iframe URL |
| `x` | `number` | `0.5` | NVS horizontal center [0..1] |
| `y` | `number` | `0.5` | NVS vertical center [0..1] |
| `z` | `number` | `0` | World-space depth |
| `rotation` | `[x,y,z]` rad | `[0,0,0]` | Full 3D rotation via CSS3DRenderer |
| `scale` | `number` | `1` | |
| `width` | `number` | `0.625` | NVS width fraction [0..1] |
| `height` | `number` | `undefined` | NVS height fraction [0..1]; derived from 16:9 if omitted |
| `bezel` | `ScreenBezelVariant` | `'dark'` | `'none' \| 'thin' \| 'dark' \| 'light' \| 'chrome'` |
| `bezelThickness` | `number` | `0.3` | World units |
| `opacity` | `number` | `1` | Applies to bezel + iframe |
| `glow` | `boolean` | `true` | |
| `glowColor` | `string` | `'#88ccff'` | CSS hex |
| `glowScale` | `number` | `1.4` | Relative to screen size |
| `glowOpacity` | `number` | `0.35` | |
| `enabled` | `boolean` | `true` | `false` hides bezel + sets iframe `display:none` |

**Transition behavior:**
- Continuously interpolated: `nvsX`, `nvsY`, `z`, `rotation`, `scale`, `opacity`, `glowOpacity`
- Stepped at `t=0.5`: `src`, `bezel`, `nvsWidth`, `nvsHeight`

### `<MediaScreen>` — Video File or Live MediaStream

Renders video content (file or live stream) as a `THREE.VideoTexture` on a `MeshPhysicalMaterial` plane with bezel and glow. Fully rotatable — this is pure WebGL.

```tsx
import { MediaScreen } from '@brewsite/screens';

// Video file
<MediaScreen
  id="product-video"
  src="/videos/demo.mp4"
  x={0.5}
  y={0.5}
  width={10}
  autoPlay
  loop
  muted
  bezel="dark"
  gloss={0.5}
  glow
/>

// Live MediaStream (via useDisplayCapture or any stream source)
<MediaScreen
  id="screen-capture"
  streamId="capture-stream"
  x={0.5}
  y={0.5}
  width={12}
  glow
/>
```

**Key props:**

| Prop | Type | Default | Notes |
|------|------|---------|-------|
| `id` | `string` | required | Stable across scenes |
| `src` | `string` | — | Video file URL. Mutually exclusive with `streamId` |
| `streamId` | `string` | — | Registry key for a live `MediaStream`. Mutually exclusive with `src` |
| `x` | `number` | `0.5` | Normalized viewport X (0–1) |
| `y` | `number` | `0.5` | Normalized viewport Y (0–1) |
| `z` | `number` | `0` | World-space Z |
| `width` | `number` | `0.5` | NVS width fraction [0..1] |
| `height` | `number` | `undefined` | NVS height fraction [0..1]; inferred from video aspect ratio if omitted |
| `rotation` | `[x,y,z]` rad | `[0,0,0]` | Fully supported — pure WebGL |
| `scale` | `number` | `1` | |
| `autoPlay` | `boolean` | `true` | |
| `loop` | `boolean` | `true` | |
| `muted` | `boolean` | `true` | Required for autoplay in most browsers |
| `bezel` | `MediaScreenBezelVariant` | `'dark'` | Same variants as Screen/ImagePanel |
| `bezelThickness` | `number` | `0.3` | |
| `opacity` | `number` | `1` | |
| `gloss` | `number` | `0.5` | `MeshPhysicalMaterial.clearcoat` [0–1] |
| `glossRoughness` | `number` | `0.05` | `clearcoatRoughness` |
| `selfIllumination` | `number` | `0.15` | `emissiveIntensity` — simulates a lit screen |
| `glow` | `boolean` | `true` | |
| `glowColor` | `string` | `'#88ccff'` | |
| `glowScale` | `number` | `1.4` | |
| `glowOpacity` | `number` | `0.35` | |
| `enabled` | `boolean` | `true` | |

**Registering a stream manually** (outside of `useDisplayCapture`):

```ts
import { MediaScreenWidget } from '@brewsite/screens';

// From any MediaStream source (camera, WebRTC, canvas.captureStream(), etc.)
MediaScreenWidget.registerStream('my-stream', mediaStream);

// In scene DSL:
<MediaScreen id="feed" streamId="my-stream" x={0.5} y={0.5} />

// Cleanup:
MediaScreenWidget.unregisterStream('my-stream');
```

**Transition behavior:**
- Continuously interpolated: `position`, `rotation`, `scale`, `opacity`, `gloss`, `selfIllumination`, `glowOpacity`
- Stepped at `t=0.5`: `src`, `streamId`, `bezel`

### `<ImagePanel>` — Static Image with Gloss and Glow

Renders a static image as a `MeshPhysicalMaterial` plane in world space. Fully rotatable — pure WebGL. Height is inferred from the loaded image's aspect ratio when not specified.

```tsx
import { ImagePanel } from '@brewsite/screens';

<ImagePanel
  id="product-screenshot"
  src="/images/dashboard-dark.webp"
  x={0.5}
  y={0.5}
  z={0}
  rotation={[0, 0.2, 0]}
  width={0.6}
  bezel="chrome"
  gloss={0.6}
  selfIllumination={0.2}
  glow
  glowColor="#4488ff"
  glowScale={1.5}
/>
```

**Key props:**

| Prop | Type | Default | Notes |
|------|------|---------|-------|
| `id` | `string` | required | Stable across scenes |
| `src` | `string` | required | Image URL (PNG, JPG, WebP) |
| `x` | `number` | `0.5` | NVS horizontal center [0..1] |
| `y` | `number` | `0.5` | NVS vertical center [0..1] |
| `z` | `number` | `0` | World-space depth |
| `rotation` | `[x,y,z]` rad | `[0,0,0]` | Fully supported — pure WebGL. Tilt freely |
| `scale` | `number` | `1` | |
| `width` | `number` | `0.6` | NVS width fraction [0..1] |
| `height` | `number` | `undefined` | NVS height fraction [0..1]; inferred from texture aspect ratio when omitted |
| `bezel` | `ImagePanelBezelVariant` | `'dark'` | `'none' \| 'thin' \| 'dark' \| 'light' \| 'chrome'` |
| `bezelThickness` | `number` | `0.3` | World units |
| `opacity` | `number` | `1` | |
| `gloss` | `number` | `0.5` | `MeshPhysicalMaterial.clearcoat` [0–1] |
| `glossRoughness` | `number` | `0.05` | `clearcoatRoughness` |
| `selfIllumination` | `number` | `0.15` | `emissiveIntensity` |
| `glow` | `boolean` | `true` | |
| `glowColor` | `string` | `'#88ccff'` | |
| `glowScale` | `number` | `1.4` | |
| `glowOpacity` | `number` | `0.35` | |
| `enabled` | `boolean` | `true` | |

**`height` inference:** When `height` is omitted, `ImagePanelRenderer` uses a 1:1 fallback based on `nvsWidth` until the texture loads, then rebuilds the plane geometry with the correct aspect ratio derived from the loaded texture. Provide `height` explicitly when the aspect ratio is known at authoring time to prevent layout shift.

**Transition behavior:**
- Continuously interpolated: `position`, `rotation`, `scale`, `opacity`, `gloss`, `selfIllumination`, `glowOpacity`
- Stepped at `t=0.5`: `src`, `bezel`, `glow`

### `useDisplayCapture` Hook

Manages the full `getDisplayMedia()` lifecycle. Call `startCapture()` from a click handler (browser requires a user gesture). The hook registers the captured stream under `streamId` in `MediaScreenWidget`'s static registry. The stream is automatically unregistered when the video track ends natively or when the component unmounts.

```tsx
import { useDisplayCapture, MediaScreen } from '@brewsite/screens';

function CaptureButton() {
  const { startCapture, stopCapture, isCapturing, error } = useDisplayCapture(
    'screen-capture',
    {
      displaySurface: 'browser',  // 'browser' | 'window' | 'monitor'
      frameRate: 30,
      preferCurrentTab: true,     // Chrome 109+: pre-selects current tab in picker
    }
  );

  return (
    <button onClick={isCapturing ? stopCapture : startCapture}>
      {isCapturing ? 'Stop capture' : 'Share screen'}
    </button>
  );
}

// In scene DSL, reference the same streamId:
<MediaScreen id="screen-feed" streamId="screen-capture" x={0.5} y={0.5} width={12} />
```

**Hook interface:**

```typescript
function useDisplayCapture(
  streamId: string,
  options?: UseDisplayCaptureOptions,
): UseDisplayCaptureResult;

interface UseDisplayCaptureOptions {
  /** 'browser' | 'window' | 'monitor'. Default: 'browser' */
  displaySurface?: 'browser' | 'window' | 'monitor';
  /** Frame rate cap. Default: 30 */
  frameRate?: number;
  /** Chrome 109+: pre-select current tab in picker. Default: true */
  preferCurrentTab?: boolean;
}

interface UseDisplayCaptureResult {
  /** Call from a click handler — browser requires a user gesture */
  startCapture: () => Promise<void>;
  /** Stop capture and release the stream. Safe to call when not capturing */
  stopCapture: () => void;
  isCapturing: boolean;
  error: Error | null;
}
```

### Exported Symbols

```typescript
// Plugin
export { screensPlugin } from '@brewsite/screens';

// Screen element
export type { ScreenState, ScreenDSL, ScreenBezelVariant } from '@brewsite/screens';
export type { ScreenProps } from '@brewsite/screens';
export { Screen, ScreenWidget } from '@brewsite/screens';
export { compileScreen, functionalScreenTransitionSpec } from '@brewsite/screens';
export { ScreenRenderer } from '@brewsite/screens';

// MediaScreen element
export type { MediaScreenState, MediaScreenDSL, MediaScreenBezelVariant, MediaScreenSourceKind } from '@brewsite/screens';
export type { MediaScreenProps } from '@brewsite/screens';
export { MediaScreen, MediaScreenWidget } from '@brewsite/screens';
export { compileMediaScreen, functionalMediaScreenTransitionSpec } from '@brewsite/screens';
export { MediaScreenRenderer } from '@brewsite/screens';
export { captureCanvasStream, stopCaptureStream } from '@brewsite/screens';

// ImagePanel element
export type { ImagePanelState, ImagePanelDSL, ImagePanelBezelVariant } from '@brewsite/screens';
export type { ImagePanelProps } from '@brewsite/screens';
export { ImagePanel, ImagePanelWidget } from '@brewsite/screens';
export { compileImagePanel, functionalImagePanelTransitionSpec } from '@brewsite/screens';
export { ImagePanelRenderer } from '@brewsite/screens';

// Hook
export { useDisplayCapture } from '@brewsite/screens';
export type { UseDisplayCaptureOptions, UseDisplayCaptureResult } from '@brewsite/screens';
```

## Technical Considerations

### Rendering Architecture

**`<Screen>`** uses `CSS3DRenderer` from Three.js (`three/examples/jsm/renderers/CSS3DRenderer.js`). The iframe is wrapped in a `CSS3DObject` and placed in a dedicated `THREE.Scene` managed by the `CSS3DContext`. Full 3D rotation is supported — the CSS3DRenderer applies CSS 3D transforms to match the Three.js camera perspective.

A shared `CSS3DContext` (containing a `CSS3DRenderer` instance, a `THREE.Scene`, and a frame-deduplication counter) is acquired via `acquireCSS3DContext(canvasParent)` from `css3dSetup.ts`. The CSS3DRenderer's DOM element is appended as the last child of the canvas parent with `position:absolute; inset:0; pointer-events:none; overflow:hidden`. Multiple `ScreenWidget` instances on the same page share this context via reference counting. Individual iframe elements within the CSS3DObject have `pointer-events: auto`. The `renderCSS3DContext()` function renders at most once per WebGL frame, guarded by a frame counter comparison.

**`<MediaScreen>`** uses a `THREE.VideoTexture` on a `MeshPhysicalMaterial` plane — the same material path as `<ImagePanel>`. When the source is a file URL, a managed `<video>` element is created with `crossOrigin = 'anonymous'`. When the source is a `MediaStream`, the video element's `srcObject` is set from the static stream registry keyed by `streamId`.

**`<ImagePanel>`** uses `THREE.TextureLoader` for static images. Height is deferred: the plane is initialized at width×width (1:1) and rebuilt with the correct aspect ratio after the texture's `onLoad` callback fires.

### Bezel System

All three elements share `_shared/bezelGeometry.ts`. `createBezel(variant, contentWidth, contentHeight, thickness)` returns a `THREE.Group` of four `BoxGeometry` segments arranged as a rectangular frame. The `'thin'` variant applies `effectiveThickness = thickness × 0.4` internally. Disposal is via `disposeBezel(group)`, which disposes all child geometries and materials.

Glow sprites use `_shared/glowSprite.ts`. The 128×128 radial gradient canvas texture is module-level cached and shared across all widget instances. Individual `SpriteMaterial` instances are owned per-widget and disposed per-widget; the shared texture is never disposed.

### Build

`@brewsite/screens` builds with `tsc` only (same as `@brewsite/diagram`). No Vite build. Output: `dist/index.js` (ESM), `dist/index.d.ts`.

### Peer Dependencies

| Dependency | Version |
|-----------|---------|
| `@brewsite/core` | `workspace:*` |
| `react` | `^19.2.4` |
| `react-dom` | `^19.2.4` |
| `three` | `^0.183.1` |

No additional runtime dependencies beyond core and Three.js.

## Migration Guide: Upgrading from `@brewsite/diagram`

If you previously imported `Screen` or `ImagePanel` from `@brewsite/diagram`, those exports have been removed. Update your imports and plugin registration:

**Before:**
```typescript
import { Screen, ScreenWidget, compileScreen, ImagePanel, ImagePanelWidget, compileImagePanel } from '@brewsite/diagram';
import { diagramPlugin } from '@brewsite/diagram';

// Manual widget registration required:
registry.register(new ScreenWidget('my-screen', compileScreen({ id: 'my-screen', src: '' })));
registry.register(new ImagePanelWidget('my-panel', compileImagePanel({ id: 'my-panel', src: '' })));

<ScenePlayer plugins={[corePlugin(), diagramPlugin()]} />
```

**After:**
```typescript
import { Screen, ImagePanel } from '@brewsite/screens';
import { screensPlugin } from '@brewsite/screens';

// No manual registration needed — screensPlugin() handles it lazily:
<ScenePlayer plugins={[corePlugin(), screensPlugin()]} />
```

DSL usage is unchanged — `<Screen>`, `<ImagePanel>`, and their props are identical.

If you use `@brewsite/diagram` alongside `@brewsite/screens`, install both packages. The `diagramPlugin()` and `screensPlugin()` are independent — add both to the `plugins` array.

## Breaking Change Assessment

**Semver impact for `@brewsite/diagram`: major (v0.x minor in pre-1.0 — treated as minor per current versioning practice).**

The following symbols were removed from `@brewsite/diagram`'s public API:
- `Screen`, `ScreenWidget`, `ScreenProps`, `ScreenState`, `ScreenDSL`, `ScreenBezelVariant`, `compileScreen`, `functionalScreenTransitionSpec`, `ScreenRenderer`
- `ImagePanel`, `ImagePanelWidget`, `ImagePanelProps`, `ImagePanelState`, `ImagePanelDSL`, `ImagePanelBezelVariant`, `compileImagePanel`, `functionalImagePanelTransitionSpec`, `ImagePanelRenderer`

**Migration:** update import paths from `@brewsite/diagram` to `@brewsite/screens` and replace manual widget registration with `screensPlugin()`.

`@brewsite/screens` v0.1.0 itself introduces no breaking changes (initial release).

## Risks & Mitigations

**Risk: iframe X-Frame-Options blocking.** Many production URLs block iframe embedding. A blank screen with no error is the result.
**Mitigation:** DSL JSDoc and this document are explicit about the constraint. Consumers should use `<Screen>` only with URLs they control or localhost dev servers.

**Risk: `getDisplayMedia()` browser support.** Not supported in Safari on iOS or in non-secure origins.
**Mitigation:** `useDisplayCapture` checks for `navigator.mediaDevices?.getDisplayMedia` and sets `error` state if unavailable, rather than throwing. Consumers gate the capture UI behind this check.

**Risk: MediaStream widget race condition.** If `MediaScreenWidget.registerStream()` is called after the widget has already been initialized for a scene, the video texture must swap sources.
**Mitigation:** `MediaScreenRenderer` watches `streamId` changes and swaps `video.srcObject` in place. The `THREE.VideoTexture` handles the source swap without GPU texture recreation.

**Risk: Screen iframe reflow on `width`/`height` change.** Animating `width` or `height` interpolation on an iframe causes DOM reflow on every frame.
**Mitigation:** `functionalScreenTransitionSpec` steps `width` and `height` at `t=0.5` rather than interpolating. Consumers who need smooth resize should use `scale` instead.

**Risk: Glow texture GPU leak.** The module-level `CanvasTexture` in `glowSprite.ts` is never disposed.
**Mitigation:** The 128×128 canvas texture is a one-time 64 KB allocation. The intentional non-disposal is documented in the `disposeGlowSprite` JSDoc.

## Open Questions

None. All design decisions are resolved.

## Launch Criteria

- `compileScreen`, `compileMediaScreen`, and `compileImagePanel` have unit tests asserting default resolution and NVS validation behavior.
- `_shared/bezelGeometry.ts` and `_shared/glowSprite.ts` have unit tests covering `computeGlowScale` and `createBezel` variant dispatch.
- `useDisplayCapture` exports are present in `packages/screens/src/index.ts`.
- All exported types and classes are present in `packages/screens/src/index.ts`.
- Package builds cleanly with `tsc -p tsconfig.build.json`.
- At least one example in `apps/examples/` demonstrates `MediaScreen` in a scene.
- `prd_screens-package.md` (this document) is current.
