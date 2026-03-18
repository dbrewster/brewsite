---
title: "BrewSite Diagram — ImagePanel and Screen Elements"
doc_type: prd
status: deprecated
owner: brewsite-product-manager
last_updated: 2026-03-17
change_history:
  - date: 2026-03-02
    author: "Toolkit Product"
    summary: "Initial PRD created. Comprehensive documentation of the @brewsite/diagram ImagePanel and Screen elements as implemented."
  - date: 2026-03-13
    author: "Toolkit Product"
    summary: >
      Screen, ImagePanel, and bezelGeometry have been extracted from @brewsite/diagram
      into the new @brewsite/screens package (v0.1.0). All three elements — Screen,
      MediaScreen (new), and ImagePanel — now live in @brewsite/screens and are registered
      via screensPlugin(). bezelGeometry was moved to @brewsite/screens/_shared/. glowSprite.ts
      was retained in @brewsite/diagram (used internally by NodeRenderer; not a public export).
      This PRD is now deprecated. The authoritative reference is
      requirements/screens/prd/prd_screens-package.md.
  - date: 2026-03-17
    author: "Toolkit Product"
    summary: "Audit confirmed: deprecation notice is accurate. @brewsite/screens package and its PRD (requirements/screens/prd/prd_screens-package.md) exist. No content changes needed."
---

> **Deprecated.** Screen and ImagePanel were moved to `@brewsite/screens` in v0.1.0 (2026-03-13).
> This document is retained for historical reference only.
> The authoritative PRD is [`requirements/screens/prd/prd_screens-package.md`](../../screens/prd/prd_screens-package.md).

# BrewSite Diagram — ImagePanel and Screen Elements

## Overview

`ImagePanel` and `Screen` are companion 3D presentation elements in `@brewsite/diagram`. Both render a flat rectangular surface in world space with an optional bezel frame and glow halo, following the mandatory element module pattern (`types.ts → dsl.tsx → compile.ts → render.ts → {Name}Widget.ts → index.ts`). `ImagePanel` displays a static image loaded from a URL using `THREE.TextureLoader` — it is a fully WebGL object and supports arbitrary 3D rotation and lighting. `Screen` overlays a live interactive DOM `<iframe>` onto the scene, backed by a Three.js bezel frame that tracks the iframe's world-space position each frame via CSS projection. Both elements are part of `@brewsite/diagram`; `@brewsite/core` has no knowledge of either.

## Problem Statement

Marketing scenes frequently need to show product screenshots, UI mockups, and live product demos alongside 3D diagram content. Without dedicated elements, consumers must implement custom Three.js planes and DOM iframe projection from scratch. The implementation details — `MeshPhysicalMaterial` clearcoat for gloss, iframe-to-screen-space projection math, bezel frame construction, glow sprite additive blending — are non-trivial and produce inconsistent results without a shared abstraction. `ImagePanel` and `Screen` provide these as first-class toolkit elements with a clean DSL, compile-time defaults, and fully managed render lifecycle.

## Goals & Success Metrics

**Primary metrics:**
- Consumers can display a product screenshot in 3D with gloss, bezel, and glow using only a `<ImagePanel src="..." />` declaration and a registered `ImagePanelWidget`.
- Consumers can display a live product website in 3D using only a `<Screen src="..." />` declaration and a registered `ScreenWidget`.
- Both elements transition smoothly (opacity fade, position interpolation) between scenes with no consumer-authored animation code.

**Guardrail metrics:**
- No Three.js import in `image-panel/types.ts`, `image-panel/dsl.tsx`, `image-panel/compile.ts` or `screen/types.ts`, `screen/dsl.tsx`, `screen/compile.ts`.
- `ScreenWidget.dispose()` removes the iframe DOM element and releases the bezel Three.js geometry without memory leaks.
- `compileScreen()` emits `console.warn` at compile time (not render time) when any rotation axis exceeds `SCREEN_ROTATION_WARNING_THRESHOLD_RAD` (0.1 rad).

## Non-Goals

- `ImagePanel` does not support animated image sequences or video. For video content, a consumer-authored widget using `<video>` as a texture source is required.
- `Screen` does not provide interactivity pass-through to the Three.js scene beneath it. The iframe captures pointer events; the WebGL canvas does not receive them while the iframe is visible.
- Neither element participates in the `DiagramCanvas` coordinate system. Both render in world space directly, not canvas-local space.
- The elements do not perform image preloading or CDN management. `ImagePanelRenderer` calls `THREE.TextureLoader` at initialization time; consumers are responsible for ensuring the asset URL is reachable.
- Bezel geometry does not support rounded corners. All bezel variants use rectangular `THREE.BoxGeometry` segments constructed by `_shared/bezelGeometry.ts`.

## Consumer Stories

- As a toolkit consumer, I want to display a product screenshot in 3D with a realistic screen-like finish (clearcoat gloss, self-illumination, glow halo) using a single DSL declaration.
- As a toolkit consumer, I want the image height to be inferred from the loaded image's aspect ratio so that I do not need to know the image dimensions at authoring time.
- As a toolkit consumer, I want to tilt the image panel at any angle without visual artifacts, because it is a WebGL mesh and rotation is unconstrained.
- As a toolkit consumer, I want to display a live product website in a 3D bezel frame so that viewers can see the application running during a scene.
- As a toolkit consumer, I want to receive a compile-time warning if I set a Screen rotation that will misalign the iframe with the bezel.
- As a toolkit consumer, I want both elements to fade in and out between scenes using the standard SceneTrack transition model.

## Functional Requirements

1. `ImagePanelWidget` must implement `ISceneElement<ImagePanelState>` and `IRenderable<ImagePanelState>`. It does not implement `ILoadable` — texture loading is handled internally by `ImagePanelRenderer` on first render, not in a separate load phase.
2. `ImagePanelState.height` may be `undefined`. When `undefined`, `ImagePanelRenderer` derives the height from the loaded texture's aspect ratio: `height = width / (imageWidth / imageHeight)`.
3. `compileImagePanel()` must not set a default for `height` — if `dsl.height` is absent, `state.height` is `undefined`.
4. `compileScreen()` must set a default for `height` (7.5 world units, 16:9 at default width 12). Screen height is never `undefined`.
5. `compileScreen()` shall emit `console.warn` when `Math.abs(rotation[i]) > SCREEN_ROTATION_WARNING_THRESHOLD_RAD` for any axis `i`. This fires at compile time, before the first render.
6. `ScreenWidget.initialize()` shall create a shared overlay `<div>` as a sibling of the WebGL canvas (using `data-brewsite-screen-overlay` attribute) and reuse it across all `ScreenWidget` instances in the same page.
7. `ScreenWidget.dispose()` shall remove the managed iframe from the overlay div and dispose the Three.js bezel group. It shall not remove the shared overlay div.
8. Bezel geometry for both elements shall be constructed by `_shared/bezelGeometry.ts:createBezel()` and disposed by `disposeBezel()`.
9. Glow sprites for both elements shall use `THREE.AdditiveBlending` and the shared glow texture from `_shared/glowSprite.ts:createGlowTexture()`. The shared texture must not be disposed by individual widget disposal.
10. `functionalImagePanelTransitionSpec.interpolateFn` shall interpolate `position`, `rotation`, `scale`, `opacity`, `gloss`, `selfIllumination`, and `glowOpacity`. The `src` and `bezel` fields shall step at `t = 0.5`.
11. `functionalScreenTransitionSpec.interpolateFn` shall interpolate `position`, `rotation`, `scale`, `opacity`, and `glowOpacity`. The `src`, `bezel`, `width`, and `height` fields shall step at `t = 0.5` (width/height cannot be smoothly resized on an iframe).
12. `ImagePanel` supports any rotation freely — no compile-time warning is emitted regardless of rotation values.

## API Design

### ImagePanel DSL and Props

```typescript
// packages/diagram/src/elements/image-panel/dsl.tsx

export interface ImagePanelProps {
  /** Unique ID. Must be stable across scenes. */
  id: string;
  /**
   * Public asset URL for the image (PNG, JPG, WebP).
   * Loaded via THREE.TextureLoader at render time.
   * Example: '/screenshots/dashboard-dark.webp'
   */
  src: string;
  /** World-space position [x, y, z]. Default: [0, 0, 0] */
  position?: [number, number, number];
  /**
   * World-space rotation in radians [x, y, z].
   * Fully supported — this is pure WebGL. Tilt freely.
   * Default: [0, 0, 0]
   */
  rotation?: [number, number, number];
  /** Uniform scale. Default: 1 */
  scale?: number;
  /** Panel width in world units. Default: 12 */
  width?: number;
  /**
   * Panel height in world units.
   * If omitted, height is derived from the loaded image's aspect ratio.
   * Provide this when the aspect ratio is known at author time to prevent
   * layout shift before the texture loads.
   */
  height?: number;
  /** Bezel frame style. Default: 'dark' */
  bezel?: ImagePanelBezelVariant;
  /** Bezel border thickness in world units. Default: 0.3 */
  bezelThickness?: number;
  /** Overall panel + bezel opacity [0–1]. Default: 1 */
  opacity?: number;
  /**
   * Surface gloss (MeshPhysicalMaterial clearcoat) [0–1].
   * 0 = matte surface, 1 = mirror-like. Recommended: 0.4–0.7 for screen look.
   * Default: 0.5
   */
  gloss?: number;
  /**
   * Clearcoat roughness [0–1]. Lower = sharper specular reflections.
   * Default: 0.05
   */
  glossRoughness?: number;
  /**
   * Faint self-illumination to simulate a lit screen [0–1].
   * Applied as MeshPhysicalMaterial.emissiveIntensity.
   * Set to 0 for photographs or non-illuminated prints. Default: 0.15
   */
  selfIllumination?: number;
  /** Whether to render a glow halo. Default: true */
  glow?: boolean;
  /** Glow color (CSS hex). Default: '#88ccff' */
  glowColor?: string;
  /** Glow size multiplier relative to panel size. Default: 1.4 */
  glowScale?: number;
  /** Glow sprite opacity [0–1]. Default: 0.35 */
  glowOpacity?: number;
  /** Whether rendered. Default: true */
  enabled?: boolean;
}

/**
 * Renders a static image as a physical 3D floating panel in world space.
 * The image is a WebGL texture on a MeshPhysicalMaterial plane.
 * Fully supports tilt, lighting, and reflections.
 * For a live interactive website, use <Screen>.
 */
export function ImagePanel(_props: ImagePanelProps): null;
```

### ImagePanel Compiled State

```typescript
// packages/diagram/src/elements/image-panel/types.ts

export type ImagePanelBezelVariant = 'none' | 'thin' | 'dark' | 'light' | 'chrome';

export interface ImagePanelState {
  readonly id: string;
  readonly src: string;
  readonly position: readonly [number, number, number];
  readonly rotation: readonly [number, number, number];
  readonly scale: number;
  readonly width: number;
  /**
   * Explicit panel height override in world units.
   * undefined = derived from texture aspect ratio after load.
   */
  readonly height: number | undefined;
  readonly bezel: ImagePanelBezelVariant;
  readonly bezelThickness: number;
  readonly opacity: number;
  /** MeshPhysicalMaterial clearcoat value [0–1]. Default: 0.5 */
  readonly gloss: number;
  /** Clearcoat roughness [0–1]. Default: 0.05 */
  readonly glossRoughness: number;
  /** MeshPhysicalMaterial.emissiveIntensity [0–1]. Default: 0.15 */
  readonly selfIllumination: number;
  readonly glow: boolean;
  readonly glowColor: string;
  readonly glowScale: number;
  readonly glowOpacity: number;
  readonly enabled: boolean;
}

export interface ImagePanelDSL {
  readonly id: string;
  readonly src: string;
  readonly position?: readonly [number, number, number];
  readonly rotation?: readonly [number, number, number];
  readonly scale?: number;
  readonly width?: number;
  readonly height?: number;
  readonly bezel?: ImagePanelBezelVariant;
  readonly bezelThickness?: number;
  readonly opacity?: number;
  readonly gloss?: number;
  readonly glossRoughness?: number;
  readonly selfIllumination?: number;
  readonly glow?: boolean;
  readonly glowColor?: string;
  readonly glowScale?: number;
  readonly glowOpacity?: number;
  readonly enabled?: boolean;
}
```

### ImagePanel Compile Function

```typescript
// packages/diagram/src/elements/image-panel/compile.ts

/**
 * Compiles an ImagePanelDSL into a fully resolved ImagePanelState.
 * height is left undefined when not specified — ImagePanelRenderer
 * derives it from the loaded texture's aspect ratio.
 *
 * Defaults:
 *   position: [0, 0, 0]     rotation: [0, 0, 0]   scale: 1
 *   width: 12                height: undefined       bezel: 'dark'
 *   bezelThickness: 0.3      opacity: 1             gloss: 0.5
 *   glossRoughness: 0.05     selfIllumination: 0.15 glow: true
 *   glowColor: '#88ccff'     glowScale: 1.4         glowOpacity: 0.35
 *   enabled: true
 */
export function compileImagePanel(dsl: ImagePanelDSL): ImagePanelState;

/**
 * Functional transition spec for ImagePanelState.
 * Continuously interpolated: position, rotation, scale, opacity,
 *   gloss, selfIllumination, glowOpacity.
 * Steps at t=0.5: src, bezel, glow.
 */
export const functionalImagePanelTransitionSpec: FunctionalTransitionSpec<ImagePanelState>;
```

### ImagePanel Widget

```typescript
// packages/diagram/src/elements/image-panel/widget.ts

export class ImagePanelWidget
  implements ISceneElement<ImagePanelState>, IRenderable<ImagePanelState>
{
  readonly widgetId: string;
  readonly defaultState: ImagePanelState;
  readonly transitionSpec: FunctionalTransitionSpec<ImagePanelState>;
  readonly DslComponent: typeof ImagePanel;

  constructor(widgetId: string, defaultState: ImagePanelState);

  initialize(context: WidgetInitContext): void;

  /**
   * Calls ImagePanelRenderer.update(state, scene).
   * ImagePanelRenderer manages texture loading, panel mesh, bezel group,
   * and glow sprite lifecycle internally.
   */
  apply(state: ImagePanelState, context: WidgetRenderContext): void;

  dispose(): void;
}
```

---

### Screen DSL and Props

```typescript
// packages/diagram/src/elements/screen/dsl.tsx

export interface ScreenProps {
  /** Unique ID. Must be stable across scenes. */
  id: string;
  /**
   * URL for the iframe src attribute.
   * Must not have X-Frame-Options: DENY or Content-Security-Policy:
   * frame-ancestors 'none' on the target server.
   * Best used with your own product URLs or localhost dev servers.
   */
  src: string;
  /** World-space position [x, y, z]. Default: [0, 0, 0] */
  position?: [number, number, number];
  /**
   * World-space rotation in radians [x, y, z].
   * Keep near [0, 0, 0] — the iframe is a flat DOM rectangle and
   * cannot tilt with the Three.js bezel.
   * Values above ~0.1 rad will visibly misalign the iframe with the bezel.
   * compile.ts emits console.warn when |rotation[i]| > 0.1 for any axis.
   * For tilted content, use <ImagePanel> instead.
   * Default: [0, 0, 0]
   */
  rotation?: [number, number, number];
  /** Uniform scale. Default: 1 */
  scale?: number;
  /** Screen content width in world units. Default: 12 */
  width?: number;
  /** Screen content height in world units. Default: 7.5 (16:9 at width 12) */
  height?: number;
  /** Bezel frame style. Default: 'dark' */
  bezel?: ScreenBezelVariant;
  /** Bezel thickness in world units. Default: 0.3 */
  bezelThickness?: number;
  /** Opacity for bezel, glow, and iframe div [0–1]. Default: 1 */
  opacity?: number;
  /** Whether to render a glow halo. Default: true */
  glow?: boolean;
  /** Glow color (CSS hex). Default: '#88ccff' */
  glowColor?: string;
  /** Glow size multiplier relative to screen size. Default: 1.4 */
  glowScale?: number;
  /** Glow sprite opacity [0–1]. Default: 0.35 */
  glowOpacity?: number;
  /**
   * Whether the screen is active. When false, the WebGL bezel and glow
   * are hidden and the iframe div is display:none (src does not load).
   * Default: true
   */
  enabled?: boolean;
}

/**
 * Renders a live interactive website inside a physical 3D bezel frame.
 * The website is a real <iframe> element — click, scroll, and interact normally.
 * The bezel and glow are Three.js objects that track the screen world position.
 * For static image content, use <ImagePanel> instead.
 */
export function Screen(_props: ScreenProps): null;
```

### Screen Compiled State

```typescript
// packages/diagram/src/elements/screen/types.ts

export type ScreenBezelVariant = 'none' | 'thin' | 'dark' | 'light' | 'chrome';

export interface ScreenState {
  readonly id: string;
  readonly src: string;
  readonly position: readonly [number, number, number];
  readonly rotation: readonly [number, number, number];
  readonly scale: number;
  readonly width: number;
  /** Always explicit — no aspect ratio inference for iframes. Default: 7.5 */
  readonly height: number;
  readonly bezel: ScreenBezelVariant;
  readonly bezelThickness: number;
  readonly opacity: number;
  readonly glow: boolean;
  readonly glowColor: string;
  readonly glowScale: number;
  readonly glowOpacity: number;
  readonly enabled: boolean;
}

export interface ScreenDSL {
  readonly id: string;
  readonly src: string;
  readonly position?: readonly [number, number, number];
  readonly rotation?: readonly [number, number, number];
  readonly scale?: number;
  readonly width?: number;
  readonly height?: number;
  readonly bezel?: ScreenBezelVariant;
  readonly bezelThickness?: number;
  readonly opacity?: number;
  readonly glow?: boolean;
  readonly glowColor?: string;
  readonly glowScale?: number;
  readonly glowOpacity?: number;
  readonly enabled?: boolean;
}
```

### Screen Compile Function

```typescript
// packages/diagram/src/elements/screen/compile.ts

export const SCREEN_ROTATION_WARNING_THRESHOLD_RAD = 0.1;

/**
 * Compiles a ScreenDSL into a fully resolved ScreenState.
 * Emits console.warn at compile time if Math.abs(rotation[i]) >
 * SCREEN_ROTATION_WARNING_THRESHOLD_RAD for any axis.
 *
 * Defaults:
 *   position: [0, 0, 0]     rotation: [0, 0, 0]   scale: 1
 *   width: 12                height: 7.5            bezel: 'dark'
 *   bezelThickness: 0.3      opacity: 1             glow: true
 *   glowColor: '#88ccff'     glowScale: 1.4         glowOpacity: 0.35
 *   enabled: true
 */
export function compileScreen(dsl: ScreenDSL): ScreenState;

/**
 * Functional transition spec for ScreenState.
 * Continuously interpolated: position, rotation, scale, opacity, glowOpacity.
 * Steps at t=0.5: src, bezel, width, height.
 * (width/height cannot be smoothly resized on an iframe — step at midpoint.)
 */
export const functionalScreenTransitionSpec: FunctionalTransitionSpec<ScreenState>;
```

### Screen Widget

```typescript
// packages/diagram/src/elements/screen/widget.ts

export class ScreenWidget
  implements ISceneElement<ScreenState>, IRenderable<ScreenState>
{
  readonly widgetId: string;
  readonly defaultState: ScreenState;
  readonly transitionSpec: FunctionalTransitionSpec<ScreenState>;
  readonly DslComponent: typeof Screen;

  constructor(widgetId: string, defaultState: ScreenState);

  /**
   * Creates or reuses the shared overlay div (data-brewsite-screen-overlay)
   * as a sibling of the WebGL canvas. Initializes ScreenRenderer with the
   * overlay container.
   */
  initialize(context: WidgetInitContext): void;

  /**
   * Calls ScreenRenderer.update(state, scene, camera, canvasRect).
   * ScreenRenderer computes the screen-space position of the WebGL mesh and
   * applies the matching CSS transform to the iframe div.
   */
  apply(state: ScreenState, context: WidgetRenderContext): void;

  /** Removes iframe from DOM, disposes Three.js bezel geometry. */
  dispose(): void;
}
```

---

### Shared Geometry Utilities

```typescript
// packages/diagram/src/elements/_shared/bezelGeometry.ts

export type BezelVariant = 'none' | 'thin' | 'dark' | 'light' | 'chrome';

/**
 * Creates a bezel group: four BoxGeometry segments arranged as a rectangular
 * frame around a content area of (contentWidth × contentHeight).
 *
 * Variant material presets:
 *   'dark'   — #111111, metalness 0.8, roughness 0.3
 *   'light'  — #e0e0e0, metalness 0.4, roughness 0.4
 *   'chrome' — #888888, metalness 0.95, roughness 0.05
 *   'thin'   — uses dark material; effectiveThickness = thickness × 0.4
 *   'none'   — returns empty THREE.Group
 *
 * BEZEL_DEPTH = 0.25 (fixed Z depth of the bezel segments).
 */
export function createBezel(
  variant: BezelVariant,
  contentWidth: number,
  contentHeight: number,
  thickness: number,
): THREE.Group;

/**
 * Disposes all GPU resources (geometries + materials) owned by a bezel group.
 * Callers are responsible for removing the group from its parent before or
 * after calling this function.
 */
export function disposeBezel(group: THREE.Group): void;
```

```typescript
// packages/diagram/src/elements/_shared/glowSprite.ts

/**
 * Returns a module-cached THREE.CanvasTexture: 128×128 radial gradient
 * (white opaque center → white transparent edge).
 * Must not be disposed by individual widget instances.
 */
export function createGlowTexture(): THREE.CanvasTexture;

/**
 * Creates a glow halo Sprite with AdditiveBlending.
 * Sprite dimensions are computed by computeGlowScale().
 * Sprite is positioned at z = -0.1 (slightly behind the panel).
 */
export function createGlow(
  color: string,
  contentWidth: number,
  contentHeight: number,
  spread: number,
  opacity: number,
): THREE.Sprite;

/**
 * Computes glow sprite dimensions.
 * Uses additive halo expansion based on the shorter side, preventing
 * stretched halos on ultra-wide panels.
 * glowW = contentWidth + 2 × (minSide × (spread - 1) × 0.5)
 * glowH = contentHeight + 2 × (minSide × (spread - 1) × 0.5)
 */
export function computeGlowScale(
  contentWidth: number,
  contentHeight: number,
  spread: number,
): readonly [number, number];

/**
 * Disposes only the SpriteMaterial owned by this sprite instance.
 * The shared glow texture (createGlowTexture) is NOT disposed here.
 */
export function disposeGlowSprite(sprite: THREE.Sprite): void;
```

### Widget Registration Pattern

```typescript
// In consumer's widgetSetup.ts, before ScenePlayer mounts:

import { WidgetRegistry } from '@brewsite/core';
import {
  ImagePanelWidget, compileImagePanel,
  ScreenWidget, compileScreen,
} from '@brewsite/diagram';

const registry = new WidgetRegistry();

registry.register(
  new ImagePanelWidget(
    'product-screenshot',
    compileImagePanel({ id: 'product-screenshot', src: '' }),
  ),
);

registry.register(
  new ScreenWidget(
    'product-demo',
    compileScreen({ id: 'product-demo', src: '' }),
  ),
);
```

### Authoring Examples

```tsx
// ImagePanel — tilted screenshot with gloss and glow
<ImagePanel
  id="product-screenshot"
  src="/images/dashboard-dark.webp"
  position={[0, 0, 0]}
  rotation={[0, 0.2, 0]}
  width={10}
  bezel="chrome"
  gloss={0.6}
  selfIllumination={0.2}
  glow
  glowColor="#4488ff"
  glowScale={1.5}
/>

// Screen — live product at near-front-facing orientation
<Screen
  id="product-demo"
  src="https://app.example.com/demo"
  position={[0, 0, 0]}
  rotation={[0, 0.05, 0]}
  width={12}
  height={7.5}
  bezel="dark"
  glow
  glowColor="#88ccff"
/>
```

## Technical Considerations

### ImagePanel Rendering Architecture

`ImagePanelRenderer` (in `image-panel/render.ts`) manages the full lifecycle of Three.js objects for a single panel instance keyed by `widgetId`:

1. **Panel mesh** — `THREE.PlaneGeometry(width, effectiveHeight)` with `THREE.MeshPhysicalMaterial`. `clearcoat` is set to `gloss`, `clearcoatRoughness` to `glossRoughness`, `emissiveIntensity` to `selfIllumination`. The `map` uniform is the loaded texture.
2. **Texture loading** — `THREE.TextureLoader.load(src)` is called when `src` changes or when the renderer is first created. On load completion, if `height` was undefined, the renderer sets `PlaneGeometry` height from `texture.image.width / texture.image.height`. The scene is not blocked while the texture loads — the panel renders as a dark surface until load completes.
3. **Bezel frame** — `createBezel(bezel, width, effectiveHeight, bezelThickness)` from `_shared/bezelGeometry.ts`. Disposed and recreated when `bezel` or `bezelThickness` changes.
4. **Glow sprite** — `createGlow(glowColor, width, effectiveHeight, glowScale, glowOpacity)` from `_shared/glowSprite.ts`. Material properties updated in place when `glowColor`, `glowScale`, or `glowOpacity` change.

The renderer's `update()` method handles change detection for each structural property (src, width, height, bezel, bezelThickness) and rebuilds affected objects as needed. Opacity, position, rotation, scale, and material properties are updated in place without object recreation.

### Screen Rendering Architecture

`ScreenRenderer` (in `screen/render.ts`) manages:

1. **Bezel frame** — same `createBezel` path as ImagePanel. Three.js bezel group positioned at `state.position` with `state.rotation` and `state.scale`.
2. **Glow sprite** — same `createGlow` path as ImagePanel.
3. **Iframe DOM element** — a `<div style="position:absolute; pointer-events:auto">` containing an `<iframe>` is created inside the shared overlay container (`data-brewsite-screen-overlay`). On each `update()` call, `ScreenRenderer` projects the screen's world-space center to screen (CSS pixel) space using the Three.js camera matrices and the canvas `getBoundingClientRect()`. The iframe div receives matching `left`, `top`, `width`, `height` CSS properties. This is applied every frame.
4. **Opacity synchronization** — `state.opacity` applies to both the WebGL bezel material opacity and the iframe div's CSS `opacity`, keeping them in sync during fade transitions.
5. **Enabled state** — when `enabled === false`, the bezel and glow are set to `visible = false` and the iframe div is `display:none`. When `enabled === true`, they are restored.

### Overlay Container Management

`ScreenWidget.initialize()` calls `ensureOverlayContainer()` which:

1. Finds the parent element of the WebGL canvas (`renderer.domElement.parentElement`).
2. Queries for an existing `[data-brewsite-screen-overlay]` div.
3. If found, returns it. If not, creates it with `position: absolute; inset: 0; pointer-events: none; z-index: 3` and appends it to the parent. The overlay div has `pointer-events: none` so that it does not block WebGL canvas interactions except through the individually `pointer-events: auto` iframe divs.

This pattern supports multiple `ScreenWidget` instances in the same scene sharing the same overlay container.

### Discrete vs. Continuous Transition Fields

The transition specs draw a deliberate line between fields that can be interpolated and fields that cannot:

**ImagePanel continuously interpolated:** `position`, `rotation`, `scale`, `opacity`, `gloss`, `selfIllumination`, `glowOpacity`.
**ImagePanel stepped at t=0.5:** `src` (URLs cannot be blended), `bezel` (material variant), `glow` (boolean).

**Screen continuously interpolated:** `position`, `rotation`, `scale`, `opacity`, `glowOpacity`.
**Screen stepped at t=0.5:** `src`, `bezel`, `width`, `height`. Width and height step rather than interpolate because smoothly resizing an iframe causes layout reflow on every frame, which is prohibitively expensive and produces visually poor results.

### Bezel Default Thickness

Both elements use `bezelThickness: 0.3` as the default. The `bezelGeometry.ts` `createBezel` function applies a modifier for the `'thin'` variant: `effectiveThickness = thickness × 0.4`. The authored `bezelThickness` is always the starting value — the thin modifier is applied inside `createBezel`, not in the compile function. This means `ImagePanelState.bezelThickness = 0.3` for the default `'dark'` variant produces a frame 0.3 units wide, while `'thin'` with the same authored value produces a frame 0.12 units wide.

### Glow Sprite Texture Caching

`createGlowTexture()` returns a module-level cached `THREE.CanvasTexture`. The first call generates the 128×128 radial gradient canvas; subsequent calls return the same texture object. Individual widget instances share this texture via `SpriteMaterial.map`. Disposing a `SpriteMaterial` (via `disposeGlowSprite`) does not dispose the shared texture — only the material is owned per-instance.

## Breaking Change Assessment

**Semver impact: minor** (new features, no existing public API modified).

This is the initial implementation of both elements. No existing `@brewsite/diagram` consumer API changes. Consumers adding these elements must:

1. Import `ImagePanelWidget`/`ScreenWidget` and the corresponding compile functions from `@brewsite/diagram`.
2. Register one widget instance per element id before `ScenePlayer` mounts.
3. Import `./register.ts` from `@brewsite/diagram` to wire the DSL node handlers.

## Dependencies

- `@brewsite/core`: `FunctionalTransitionSpec`, `ISceneElement`, `IRenderable`, `blendNumber`, `blendVec3`, `blendOpacity`, `WidgetInitContext`, `WidgetRenderContext`.
- `packages/diagram/src/elements/_shared/bezelGeometry.ts`: `createBezel`, `disposeBezel`, `BezelVariant`.
- `packages/diagram/src/elements/_shared/glowSprite.ts`: `createGlow`, `createGlowTexture`, `computeGlowScale`, `disposeGlowSprite`.
- Three.js (render layer only): `THREE.PlaneGeometry`, `THREE.MeshPhysicalMaterial`, `THREE.TextureLoader`, `THREE.Sprite`, `THREE.SpriteMaterial`, `THREE.AdditiveBlending`, `THREE.WebGLRenderer`.

No new peer dependencies are introduced. Three.js is already a peer dependency of `@brewsite/diagram`.

## Risks & Mitigations

**Risk: Iframe X-Frame-Options blocking** — Many production URLs block iframe embedding. Consumers who author a `<Screen src="https://external-site.com" />` will see a blank iframe at runtime with no clear error in the Three.js scene.
**Mitigation:** DSL comment and README documentation are explicit about the X-Frame-Options constraint. No runtime fallback (e.g., a "blocked" overlay) is provided — this is consumer-responsibility territory.

**Risk: Glow texture cache leak** — The module-level cached `THREE.CanvasTexture` in `glowSprite.ts` is never disposed. On a page with multiple scene reloads, the same canvas texture object persists in GPU memory.
**Mitigation:** The glow texture is a small 128×128 canvas. The one-time allocation is intentional and acceptable. The JSDoc on `disposeGlowSprite` explicitly documents that the shared texture is not disposed.

**Risk: Screen iframe layout reflow on resize** — Changing `width` or `height` between scenes causes a DOM reflow. By stepping these fields at `t = 0.5` rather than interpolating, the reflow occurs once mid-transition rather than every frame.
**Mitigation:** Behavior is documented in the transition spec. Consumers who need smooth resize should use `scale` instead of `width`/`height` changes between scenes.

**Risk: ImagePanel height undefined on first render** — Before the texture loads, the panel renders with `height = undefined`. The renderer must handle this gracefully.
**Mitigation:** `ImagePanelRenderer` uses a fallback height equal to `width` (1:1 aspect ratio) for the initial plane geometry, then rebuilds the geometry when the texture loads and the true aspect ratio is known.

## Open Questions

None. Both elements are fully implemented and all design decisions are resolved.

## Launch Criteria

- `compileImagePanel` and `compileScreen` have unit test coverage in `image-panel/__tests__/compile.test.ts` and `screen/__tests__/compile.test.ts` asserting default resolution and rotation warning behavior.
- `_shared/bezelGeometry.ts` and `_shared/glowSprite.ts` have unit tests covering `computeGlowScale` and `createBezel` variant dispatch.
- At least one example in `apps/examples/` demonstrates both elements in a scene.
- All exported types and classes (`ImagePanelState`, `ImagePanelWidget`, `compileImagePanel`, `ScreenState`, `ScreenWidget`, `compileScreen`, `ImagePanelBezelVariant`, `ScreenBezelVariant`) are present in `packages/diagram/src/index.ts`.
- CHANGELOG entry written for `@brewsite/diagram`.
