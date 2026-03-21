---
title: HUD and Overlay System Reference
doc_type: reference
owner: claude-author
status: active
updated: 2026-03-21
---

## HUD System Overview

The HUD system renders HTML content as a DOM overlay on top of the Three.js canvas. It is distinct from 3D labels (which are world-space Three.js objects in `@brewsite/model`). HUD content is normal React/HTML — use it for slide titles, navigation hints, annotation panels, code blocks, score counters, or any UI that must stay crisp and 2D regardless of camera angle.

**How it works:**
1. Non-DSL React elements inside `<Scene>` (elements not registered as widget handlers) are collected by the compiler as a `sceneOverlay`.
2. `EngineOverlayHost` reads the current `sceneOverlay` from the engine each frame and renders it in a `position: absolute; inset: 0` div above the canvas.
3. When the scene changes, `EngineOverlayHost` swaps the overlay and applies an entry animation (`brewsite-overlay-enter` fade-in).

The primary scene authoring tool for HUD content is `<TextBox>` — a component that positions a `position: absolute` div at NVS coordinates. Any React JSX children inside a `<TextBox>` are normal HTML.

---

## EngineOverlayHost

`EngineOverlayHost` is the player-level component that mounts the HUD rendering surface. It must be a sibling of `SceneCanvas` inside the canvas container.

```tsx
import { EngineOverlayHost } from '@brewsite/core';

// Minimal setup:
<SceneCanvas style={{ position: 'absolute', inset: 0, zIndex: 1 }} />
<EngineOverlayHost />

// With pointer passthrough (overlay doesn't intercept mouse events):
<EngineOverlayHost passthroughPointerEvents />

// With persistent children that survive scene transitions (e.g. tooltip hosts):
<EngineOverlayHost passthroughPointerEvents>
  <ChartTooltipHost />
</EngineOverlayHost>
```

The outer `SceneEngine` container must have `position: relative` so the `inset: 0` positioning works.

**Props:**

| Prop | Type | Default | Description |
|---|---|---|---|
| `className` | `string` | — | CSS class applied to the overlay container div |
| `passthroughPointerEvents` | `boolean` | `false` | When `true`, `pointer-events: none` on the overlay — events pass through to canvas. Individual children can re-enable with `style={{ pointerEvents: 'auto' }}` |
| `overlayTransition` | `{ enabled?: boolean; durationMs?: number; easing?: string }` | enabled, 200ms, ease-out | Controls scene-change fade animation for overlay content |
| `children` | `ReactNode` | — | Persistent children rendered outside the scene-keyed container. They survive scene transitions without remounting |

**Theme injection:** When `SceneEngine` has a `theme` prop, `EngineOverlayHost` injects CSS custom properties onto the overlay div:
- `--brewsite-font-family`
- `--brewsite-font-size-heading/body/label/caption/annotation`
- `--brewsite-color-mode` — the active color mode (`'dark'` or `'light'`)
- `--brewsite-text-primary`, `--brewsite-text-secondary`
- `--brewsite-background-color`, `--brewsite-surface-elevated`, `--brewsite-border-subtle`
- `--brewsite-radius-base`

CSS classes added: `bw-theme-{family}` (e.g. `bw-theme-darkGlass`), `bw-dark` or `bw-light`.

The overlay container has `zIndex: 10`. Ensure the `SceneCanvas` uses a lower `zIndex` (e.g. `zIndex: 1`) so the overlay renders above the canvas.

---

## HUD DSL Components

### `<TextBox>`

`<TextBox>` is the primary tool for positioning HTML overlay content in NVS coordinates. It renders a `position: absolute` div at the given NVS bounds.

```tsx
import { TextBox } from '@brewsite/core';

// Inside a <Scene>:
<Scene id="my-scene">
  <Camera mode="world" position={[0, 1.5, 5]} target={[0, 1, 0]} fov={45} />
  <Background color="#0a0a14" />

  {/* TextBox at top-left quadrant */}
  <TextBox key="title" x={"4%"} y={"6%"} w={"45%"} h={"20%"}>
    <h2 style={{ color: '#ffffff', margin: 0, fontSize: '2rem' }}>
      Scene Title
    </h2>
    <p style={{ color: 'rgba(255,255,255,0.65)', margin: '4px 0 0' }}>
      Subtitle or description text
    </p>
  </TextBox>
</Scene>
```

**TextBox Props:**

| Prop | Type | Required | Description |
|---|---|---|---|
| `x` | `SceneLength` | yes | NVS x position. `"0%"` = left edge, `"100%"` = right edge |
| `y` | `SceneLength` | yes | NVS y position. `"0%"` = top edge, `"100%"` = bottom edge |
| `w` | `SceneLength` | yes | NVS width, e.g. `"50%"` |
| `h` | `SceneLength` | yes | NVS height, e.g. `"100%"` |
| `layer` | `number` | no | CSS z-index (default 0) |
| `overflow` | `'hidden' \| 'visible'` | no | Content overflow. Default `'hidden'` |
| `id` | `string` | no | Optional id (also used for React key) |
| `children` | `ReactNode` | no | Any React content |

`<TextBox>` is not a DSL widget — it is not compiled into `SceneTrack` state. It is collected as overlay content and rendered directly by `EngineOverlayHost`. **Always give TextBox elements a React `key` prop** to help React reconcile correctly.

---

### `<TextBox>` inside `<View>`

`<TextBox>` inside a `<View>` is positioned relative to the View's content bounds, not the full viewport. The compiler wraps it in a positioned container div matching the View's NVS region, so `x={"0%"} y={"0%"} w={"100%"} h={"100%"}` fills the View, not the page.

```tsx
<View id="right-panel" x={"50%"} y={"0%"} w={"50%"} h={"100%"}>
  {/* Model fills the view */}
  <Model type="Robot" id="robot" x={"0%"} y={"0%"} w={"100%"} h={"100%"} />

  {/* TextBox is also relative to right-panel bounds */}
  <TextBox key="caption" x={"5%"} y={"85%"} w={"90%"} h={"12%"}>
    <p style={{ color: 'white', margin: 0, fontSize: '0.9rem' }}>
      Caption inside the view
    </p>
  </TextBox>
</View>
```

---

### Arbitrary JSX in scenes

Any non-widget React component placed directly inside a `<Scene>` is treated as overlay content. You are not limited to `<TextBox>` — you can place any JSX:

```tsx
<Scene id="my-scene">
  <Camera ... />
  <Background ... />

  {/* Custom React component — rendered as overlay */}
  <MyAnnotationPanel key="annotations" />

  {/* Inline JSX — rendered as overlay */}
  <div key="badge" style={{ position: 'absolute', top: '5%', right: '3%' }}>
    <span style={{ background: '#4080ff', borderRadius: 4, padding: '4px 10px', color: '#fff' }}>
      Beta
    </span>
  </div>
</Scene>
```

Give all overlay elements React `key` props. The compiler collects them into a `React.Fragment`; missing keys produce React list-key warnings.

---

## HUD Positioning

HUD content uses NVS (Normalized Viewport Space):
- `x={"0%"}` → left edge of the canvas
- `x={"100%"}` → right edge
- `y={"0%"}` → top edge
- `y={"100%"}` → bottom edge

`<TextBox x={"0%"} y={"0%"} w={"100%"} h={"100%"}>` fills the entire canvas. All positions are percentages of the rendered canvas size — they are aspect-ratio-independent.

For content not using `<TextBox>`, use `position: absolute` with percentage-based `left`/`top`/`width`/`height` values, since the `EngineOverlayHost` container has `position: absolute; inset: 0`.

You can also place React content inside `<SceneEngine>` but outside `<ScrollStage>` / `<EngineOverlayHost>` and use `position: fixed` for chrome that should float over everything:

```tsx
<SceneEngine plugins={plugins}>
  {/* Scenes */}
  <MyScene />

  {/* Canvas */}
  <ScrollStage>
    <SceneCanvas ... />
    <EngineOverlayHost />
  </ScrollStage>

  {/* Fixed chrome — uses useCurrentScene() or useSceneProgress() */}
  <TopNavBar />     {/* position: fixed — always visible */}
  <ProgressDots />  {/* position: fixed */}
</SceneEngine>
```

Components inside `<SceneEngine>` (anywhere in its subtree) can call engine hooks like `useCurrentScene()`, `useSceneProgress()`, and `useEngineState()`.

---

## HUD Transitions

When the scene changes, `EngineOverlayHost` re-mounts the overlay content (using `key={sceneId}` on the inner wrapper div). This triggers a CSS `@keyframes brewsite-overlay-enter` fade animation (opacity: 0 → 1).

**Default:** 200ms ease-out fade on every scene change. Customizable:

```tsx
<EngineOverlayHost
  overlayTransition={{
    enabled: true,
    durationMs: 350,
    easing: 'ease-in-out',
  }}
/>
```

To disable the animation entirely:

```tsx
<EngineOverlayHost overlayTransition={{ enabled: false }} />
```

**Persistent children** (passed as `children` to `EngineOverlayHost`) are rendered outside the keyed wrapper and do not participate in the scene-change fade. Use this for overlays that must persist across scenes without remounting — tooltip hosts, progress bars, navigation dots:

```tsx
<EngineOverlayHost passthroughPointerEvents>
  {/* These survive scene transitions without remounting */}
  <ChartTooltipHost />
  <ProgressDots />
</EngineOverlayHost>
```

---

## Complete HUD Example

A full scene with a title overlay, description block, and a badge — all positioned with NVS coordinates.

```tsx
import { Scene, Camera, Lighting, Ambient, Directional, Background, TextBox, View } from '@brewsite/core';
import { Model } from '@brewsite/model';

export function HeroScene() {
  return (
    <Scene id="hero">
      <Camera mode="world" position={[0, 1.2, 4.5]} target={[0, 1.0, 0]} fov={45} />
      <Lighting intensityScale={1.0}>
        <Ambient intensity={0.7} color="#d0e4ff" />
        <Directional intensity={1.0} color="#ffffff" position={[3, 8, 6]} />
      </Lighting>
      <Background color="#030510" />

      {/* Model occupies right 55% */}
      <View id="model-area" x={"42%"} y={"0%"} w={"55%"} h={"100%"}>
        <Model type="Robot" id="robot" scale={0.06} x={"0%"} y={"0%"} w={"100%"} h={"100%"} />
      </View>

      {/* Headline — top-left */}
      <TextBox key="headline" x={"4%"} y={"12%"} w={"40%"} h={"18%"}>
        <h1 style={{
          margin: 0,
          fontFamily: 'var(--brewsite-font-family, sans-serif)',
          fontSize: 'clamp(1.5rem, 3vw, 2.5rem)',
          fontWeight: 700,
          color: '#ffffff',
          lineHeight: 1.1,
        }}>
          Meet the Robot
        </h1>
      </TextBox>

      {/* Body copy */}
      <TextBox key="body" x={"4%"} y={"32%"} w={"38%"} h={"30%"}>
        <p style={{
          margin: 0,
          fontFamily: 'var(--brewsite-font-family, sans-serif)',
          fontSize: '1rem',
          color: 'rgba(255,255,255,0.65)',
          lineHeight: 1.65,
        }}>
          Built for interactive 3D marketing scenes.
          Smooth camera transitions, physics-accurate lighting,
          and declarative scene authoring.
        </p>
      </TextBox>

      {/* Badge — top right */}
      <TextBox key="badge" x={"86%"} y={"6%"} w={"12%"} h={"6%"} layer={5}>
        <div style={{
          background: 'rgba(64, 128, 255, 0.25)',
          border: '1px solid rgba(64, 128, 255, 0.5)',
          borderRadius: 6,
          padding: '4px 12px',
          color: '#a0c0ff',
          fontSize: '0.75rem',
          fontWeight: 600,
          textAlign: 'center',
          lineHeight: 1.5,
        }}>
          v2.0
        </div>
      </TextBox>
    </Scene>
  );
}
```

In the page layout:

```tsx
<SceneEngine plugins={plugins} theme={{ family: 'darkGlass', polarity: 'dark' }}>
  <HeroScene />

  <ScrollStage scrollHeightMode="scene-count" pixelsPerScene={1200}>
    <BackgroundLayer style={{ position: 'absolute', inset: 0, zIndex: 0 }} />
    <SceneCanvas style={{ position: 'absolute', inset: 0, zIndex: 1 }} />
    <EngineOverlayHost passthroughPointerEvents />
    <InputCoordinator />
  </ScrollStage>
</SceneEngine>
```
