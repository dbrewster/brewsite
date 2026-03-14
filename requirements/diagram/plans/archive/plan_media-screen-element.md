---
title: "MediaScreen Element — WebGL Video/Stream Texture Screen"
doc_type: plan
status: superseded
owner: Toolkit Product
last_updated: 2026-03-13
change_history:
  - date: 2026-03-13
    author: Toolkit Product
    summary: "Initial plan. Defined MediaScreenWidget, stream registry, VideoTexture renderer, compile/transition spec, and example scenes."
  - date: 2026-03-13
    author: Toolkit Product
    summary: "Added browser capture utilities: useDisplayCapture hook (getDisplayMedia lifecycle), captureCanvasStream utility, and stopCaptureStream utility. Updated index.ts exports and example scene to use the hook."
---

# Plan: MediaScreen Element

## Goal

Add a new `<MediaScreen>` element to `@brewsite/diagram` that renders a live
`MediaStream` or a video file URL as a `THREE.VideoTexture` on a `MeshPhysicalMaterial`
plane. This gives you a true WebGL screen — full 3D rotation, depth compositing,
env-map reflections, clearcoat gloss, emissive self-illumination — with no DOM overlay.

Use cases:
- A video file playing on a 3D monitor (`src="/demo.mp4"`)
- A `navigator.mediaDevices.getDisplayMedia()` capture rendered in 3D
- A same-origin canvas app's `captureStream()` output in a carousel
- Any `MediaStream` the consumer creates (WebRTC, getUserMedia, etc.)

This is the medium-term complement to the CSS3DRenderer Screen upgrade. `<Screen>`
stays for interactive cross-origin websites (DOM, on-top); `<MediaScreen>` is for
content that needs full WebGL compositing.

---

## Architecture Overview

### The Stream Registry Problem

`MediaStream` is a live browser object — not serializable. The compiler pipeline
produces `SceneFrame[]` → `SceneTrack` (baked at page load). A `MediaStream` cannot
live in compiled state. Solution: a **static stream registry** on `MediaScreenWidget`.

```
Consumer code (React):
  MediaScreenWidget.registerStream('my-capture', stream);

Scene DSL:
  <MediaScreen id="s1" streamId="my-capture" ... />

Compiler:
  MediaScreenState { streamId: 'my-capture', ... }

Renderer:
  video.srcObject = MediaScreenWidget.streams.get('my-capture');
  texture = new THREE.VideoTexture(video);
```

For video files, no registry is needed:
```
  <MediaScreen id="s1" src="/demo.mp4" autoPlay loop muted ... />
```

The source type is determined by which prop is present (`src` vs `streamId`). Both are
mutually exclusive. The compiled state carries `sourceKind: 'video' | 'stream'` as a
discriminant.

### Rendering Architecture

`MediaScreenRenderer` creates:
- `THREE.PlaneGeometry(width, height)` — the screen surface
- `THREE.MeshPhysicalMaterial` — with `VideoTexture` as `map`, `clearcoat`, `emissive`
- Bezel group (shared `createBezel()` utility)
- Optional glow sprite (shared `createGlow()` utility)

The `<video>` element is created programmatically (never inserted into the DOM — it's
just a texture source). For `src` mode: `video.src = state.src`. For `stream` mode:
`video.srcObject = MediaScreenWidget.streams.get(state.streamId)`.

`THREE.VideoTexture` polls `video.readyState >= 2` each frame and uploads a new GPU
texture when a new video frame is available. The `renderer.render(scene, camera)` call
drives this automatically — no manual `texture.needsUpdate` needed.

---

## Files to Create

### `packages/diagram/src/elements/media-screen/types.ts` (NEW)

```typescript
// Contract layer for the MediaScreen element. No runtime, no Three.js, no React.
// MediaScreen renders a live video or MediaStream as a WebGL texture on a 3D plane.
// Fully supports 3D rotation, env-map reflections, clearcoat gloss, and depth compositing.

import type { BezelVariant } from '../_shared/bezelGeometry';

export type MediaScreenBezelVariant = BezelVariant;

/**
 * Source kind discriminant. Set by the compiler based on which DSL prop is present.
 */
export type MediaScreenSourceKind = 'video' | 'stream';

/**
 * Fully resolved state for a MediaScreen element.
 * Produced by compileMediaScreen() from MediaScreenDSL.
 */
export interface MediaScreenState {
  readonly id: string;

  /**
   * Source discriminant. 'video' when `src` is set; 'stream' when `streamId` is set.
   */
  readonly sourceKind: MediaScreenSourceKind;

  /**
   * Video file URL (e.g. '/demo.mp4', 'https://example.com/video.webm').
   * Only present when sourceKind === 'video'.
   * THREE.VideoTexture sources from a <video> element with this src.
   */
  readonly src: string | undefined;

  /**
   * Stream registry key for a MediaStream registered via
   * MediaScreenWidget.registerStream(id, stream).
   * Only present when sourceKind === 'stream'.
   */
  readonly streamId: string | undefined;

  /**
   * Whether the video element should autoplay.
   * Only relevant for sourceKind === 'video'. Default: true.
   * Note: browsers require `muted: true` for autoplay without user gesture.
   */
  readonly autoPlay: boolean;

  /**
   * Whether the video loops. Only relevant for sourceKind === 'video'. Default: true.
   */
  readonly loop: boolean;

  /**
   * Whether the video element is muted. Only relevant for sourceKind === 'video'.
   * Set to true to allow autoplay without user gesture. Default: true.
   */
  readonly muted: boolean;

  /** NVS horizontal center position [0..1]. Default: 0.5 */
  readonly nvsX: number;

  /** NVS vertical center position [0..1]. Default: 0.5 */
  readonly nvsY: number;

  /** World-space depth (Z) of the screen center. Default: 0 */
  readonly z: number;

  /**
   * World-space rotation in radians [x, y, z] (Euler XYZ order).
   * Full 3D rotation supported — this is a true WebGL mesh.
   * Default: [0, 0, 0]
   */
  readonly rotation: readonly [number, number, number];

  /** Uniform scale applied to both screen mesh and bezel. Default: 1 */
  readonly scale: number;

  /** NVS width fraction [0..1]. Default: 0.625 */
  readonly nvsWidth: number;

  /**
   * NVS height fraction [0..1]. If undefined, derives from width × 9/16.
   */
  readonly nvsHeight: number | undefined;

  /** Bezel frame visual style. Default: 'dark' */
  readonly bezel: MediaScreenBezelVariant;

  /** Bezel thickness in world units. Default: 0.3 */
  readonly bezelThickness: number;

  /** Overall opacity [0–1]. Default: 1 */
  readonly opacity: number;

  /**
   * Screen surface gloss [0–1].
   * Implemented as THREE.MeshPhysicalMaterial clearcoat.
   * Default: 0.5
   */
  readonly gloss: number;

  /** Clearcoat roughness [0–1]. Default: 0.05 (near-mirror surface). */
  readonly glossRoughness: number;

  /**
   * Faint emissive self-illumination to simulate a lit screen.
   * Applied as MeshPhysicalMaterial.emissiveIntensity. Default: 0.3
   * Higher than ImagePanel default because screens are typically brighter.
   */
  readonly selfIllumination: number;

  /** Whether to render a glow halo. Default: true */
  readonly glow: boolean;

  /** CSS hex glow color. Default: '#88ccff' */
  readonly glowColor: string;

  /** Glow size multiplier. Default: 1.4 */
  readonly glowScale: number;

  /** Glow opacity [0–1]. Default: 0.35 */
  readonly glowOpacity: number;

  /** Whether the element is rendered. Default: true */
  readonly enabled: boolean;
}

/** Raw DSL props from <MediaScreen> before compile.ts applies defaults. */
export interface MediaScreenDSL {
  readonly id: string;

  /**
   * Video file URL. Mutually exclusive with `streamId`.
   * When provided, sets sourceKind = 'video'.
   */
  readonly src?: string;

  /**
   * Stream registry key. Mutually exclusive with `src`.
   * Register the stream before mounting the scene:
   *   MediaScreenWidget.registerStream('key', stream)
   * When provided, sets sourceKind = 'stream'.
   */
  readonly streamId?: string;

  readonly autoPlay?: boolean;
  readonly loop?: boolean;
  readonly muted?: boolean;

  /** NVS center X [0..1]. Default: 0.5 */
  readonly x?: number;
  /** NVS center Y [0..1]. Default: 0.5 */
  readonly y?: number;
  /** World-space depth (Z). Default: 0 */
  readonly z?: number;
  /** NVS width fraction [0..1]. Default: 0.625 */
  readonly width?: number;
  /** NVS height fraction [0..1]. Derived from 16:9 if omitted. */
  readonly height?: number;
  readonly rotation?: readonly [number, number, number];
  readonly scale?: number;
  readonly bezel?: MediaScreenBezelVariant;
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

---

### `packages/diagram/src/elements/media-screen/dsl.tsx` (NEW)

```typescript
// Declarative DSL for the MediaScreen element.

import type { MediaScreenBezelVariant } from './types';

export interface MediaScreenProps {
  /** Unique element ID. Must be stable across scenes. */
  id: string;

  /**
   * Video file URL (mp4, webm, ogg).
   * Mutually exclusive with `streamId`.
   * Example: '/videos/product-demo.mp4'
   */
  src?: string;

  /**
   * Registry key for a live MediaStream. Register the stream before the scene mounts:
   *   MediaScreenWidget.registerStream('my-stream', mediaStream);
   * Mutually exclusive with `src`.
   */
  streamId?: string;

  /**
   * Auto-play the video. Requires `muted={true}` in most browsers.
   * Default: true
   */
  autoPlay?: boolean;

  /**
   * Loop the video. Default: true
   */
  loop?: boolean;

  /**
   * Mute the video element. Required for autoplay in most browsers.
   * Default: true
   */
  muted?: boolean;

  /** NVS center X [0..1]. Default: 0.5 */
  x?: number;
  /** NVS center Y [0..1]. Default: 0.5 */
  y?: number;
  /** World-space depth (Z). Default: 0 */
  z?: number;
  /** NVS width fraction [0..1]. Default: 0.625 */
  width?: number;
  /** NVS height fraction [0..1]. Derived from 16:9 if omitted. */
  height?: number;
  /** World-space rotation [x, y, z] in radians. Full 3D rotation supported. Default: [0,0,0] */
  rotation?: [number, number, number];
  /** Uniform scale. Default: 1 */
  scale?: number;
  /** Bezel style. Default: 'dark' */
  bezel?: MediaScreenBezelVariant;
  /** Bezel thickness in world units. Default: 0.3 */
  bezelThickness?: number;
  /** Opacity [0–1]. Default: 1 */
  opacity?: number;
  /** Screen gloss / clearcoat [0–1]. Default: 0.5 */
  gloss?: number;
  /** Clearcoat roughness [0–1]. Default: 0.05 */
  glossRoughness?: number;
  /** Emissive self-illumination. Default: 0.3 */
  selfIllumination?: number;
  /** Render glow halo. Default: true */
  glow?: boolean;
  /** Glow CSS hex color. Default: '#88ccff' */
  glowColor?: string;
  /** Glow size multiplier. Default: 1.4 */
  glowScale?: number;
  /** Glow opacity [0–1]. Default: 0.35 */
  glowOpacity?: number;
  /** Whether rendered. Default: true */
  enabled?: boolean;
}
```

---

### `packages/diagram/src/elements/media-screen/compile.ts` (NEW)

```typescript
// Pure compilation for MediaScreen: MediaScreenDSL → MediaScreenState.
// No Three.js. No DOM access. No side effects.

import type { MediaScreenDSL, MediaScreenState } from './types';
import type { FunctionalTransitionSpec } from '@brewsite/core';
import { blendNumber, blendOpacity, blendVec3, copyVec3, validateNVSScalar } from '@brewsite/core';

/**
 * Compiles MediaScreenDSL to MediaScreenState.
 * Validates that exactly one of `src` or `streamId` is provided (warns in dev otherwise).
 * All fields in the output are defined — no undefined values except nvsHeight.
 */
export function compileMediaScreen(dsl: MediaScreenDSL): MediaScreenState {
  const hasSrc = dsl.src !== undefined && dsl.src.length > 0;
  const hasStreamId = dsl.streamId !== undefined && dsl.streamId.length > 0;

  if (process.env.NODE_ENV !== 'production') {
    if (!hasSrc && !hasStreamId) {
      console.warn(
        `MediaScreen compileMediaScreen: <MediaScreen id="${dsl.id}"> has neither src nor streamId. ` +
        'The screen will render a black placeholder. Provide src="/video.mp4" or streamId="my-key".',
      );
    }
    if (hasSrc && hasStreamId) {
      console.warn(
        `MediaScreen compileMediaScreen: <MediaScreen id="${dsl.id}"> has both src and streamId. ` +
        'src takes precedence. Remove one.',
      );
    }
  }

  // src takes precedence over streamId when both are set.
  const sourceKind = hasSrc ? 'video' : 'stream';

  const nvsX = dsl.x ?? 0.5;
  const nvsY = dsl.y ?? 0.5;
  const nvsWidth = dsl.width ?? 0.625;
  const nvsHeight = dsl.height;

  if (process.env.NODE_ENV !== 'production') {
    validateNVSScalar(nvsX, 'nvsX', `<MediaScreen id="${dsl.id}">`);
    validateNVSScalar(nvsY, 'nvsY', `<MediaScreen id="${dsl.id}">`);
    validateNVSScalar(nvsWidth, 'nvsWidth', `<MediaScreen id="${dsl.id}">`);
    if (nvsHeight !== undefined) {
      validateNVSScalar(nvsHeight, 'nvsHeight', `<MediaScreen id="${dsl.id}">`);
    }
  }

  return {
    id: dsl.id,
    sourceKind,
    src: hasSrc ? dsl.src : undefined,
    streamId: !hasSrc && hasStreamId ? dsl.streamId : undefined,
    autoPlay: dsl.autoPlay ?? true,
    loop: dsl.loop ?? true,
    muted: dsl.muted ?? true,
    nvsX,
    nvsY,
    z: dsl.z ?? 0,
    nvsWidth,
    nvsHeight,
    rotation: dsl.rotation ?? [0, 0, 0],
    scale: dsl.scale ?? 1,
    bezel: dsl.bezel ?? 'dark',
    bezelThickness: dsl.bezelThickness ?? 0.3,
    opacity: dsl.opacity ?? 1,
    gloss: dsl.gloss ?? 0.5,
    glossRoughness: dsl.glossRoughness ?? 0.05,
    selfIllumination: dsl.selfIllumination ?? 0.3,
    glow: dsl.glow ?? true,
    glowColor: dsl.glowColor ?? '#88ccff',
    glowScale: dsl.glowScale ?? 1.4,
    glowOpacity: dsl.glowOpacity ?? 0.35,
    enabled: dsl.enabled ?? true,
  };
}

/**
 * Functional transition spec for MediaScreenState.
 * Position, rotation, scale, opacity, gloss, selfIllumination, glowOpacity are
 * continuously interpolated.
 * src, streamId, sourceKind, bezel, loop, muted, autoPlay step at midpoint
 * (cannot interpolate URLs or stream identities).
 */
export const functionalMediaScreenTransitionSpec: FunctionalTransitionSpec<MediaScreenState> = {
  exitFn: (from) => (ctx) => ({
    ...from,
    opacity: blendOpacity(from.opacity, 0, ctx.t) ?? 0,
  }),
  enterFn: (to) => (ctx) => ({
    ...to,
    opacity: blendOpacity(0, to.opacity, ctx.t) ?? to.opacity,
  }),
  interpolateFn: (from, to) => (ctx) => ({
    ...to,
    nvsX: blendNumber(from.nvsX, to.nvsX, ctx.t) ?? to.nvsX,
    nvsY: blendNumber(from.nvsY, to.nvsY, ctx.t) ?? to.nvsY,
    z: blendNumber(from.z, to.z, ctx.t) ?? to.z,
    nvsWidth: blendNumber(from.nvsWidth, to.nvsWidth, ctx.t) ?? to.nvsWidth,
    nvsHeight: from.nvsHeight !== undefined && to.nvsHeight !== undefined
      ? blendNumber(from.nvsHeight, to.nvsHeight, ctx.t) ?? to.nvsHeight
      : to.nvsHeight,
    rotation: blendVec3(copyVec3(from.rotation), copyVec3(to.rotation), ctx.t) ?? to.rotation,
    scale: blendNumber(from.scale, to.scale, ctx.t) ?? to.scale,
    opacity: blendOpacity(from.opacity, to.opacity, ctx.t) ?? to.opacity,
    gloss: blendNumber(from.gloss, to.gloss, ctx.t) ?? to.gloss,
    selfIllumination: blendNumber(from.selfIllumination, to.selfIllumination, ctx.t) ?? to.selfIllumination,
    glowOpacity: blendNumber(from.glowOpacity, to.glowOpacity, ctx.t) ?? to.glowOpacity,
    // Discrete: step at midpoint
    src: ctx.t < 0.5 ? from.src : to.src,
    streamId: ctx.t < 0.5 ? from.streamId : to.streamId,
    sourceKind: ctx.t < 0.5 ? from.sourceKind : to.sourceKind,
    bezel: ctx.t < 0.5 ? from.bezel : to.bezel,
    glow: ctx.t < 0.5 ? from.glow : to.glow,
    loop: ctx.t < 0.5 ? from.loop : to.loop,
    muted: ctx.t < 0.5 ? from.muted : to.muted,
    autoPlay: ctx.t < 0.5 ? from.autoPlay : to.autoPlay,
  }),
};
```

---

### `packages/diagram/src/elements/media-screen/render.ts` (NEW)

```typescript
// Three.js rendering for MediaScreenState.
// Creates a PlaneGeometry + MeshPhysicalMaterial + VideoTexture.
// No DOM overlay — pure WebGL.

import * as THREE from 'three';
import type { MediaScreenState } from './types';
import { createBezel, disposeBezel } from '../_shared/bezelGeometry';
import { createGlow, disposeGlowSprite } from '../_shared/glowSprite';

/**
 * World-space render input for MediaScreenRenderer.
 * Produced by MediaScreenWidget.apply() by converting NVS fields to world-space.
 * Never exported — internal to the media-screen element.
 */
export type MediaScreenRenderInput =
  Omit<MediaScreenState, 'nvsX' | 'nvsY' | 'z' | 'nvsWidth' | 'nvsHeight'> & {
  readonly position: readonly [number, number, number];
  readonly width: number;
  readonly height: number;
  /**
   * Live MediaStream resolved by the renderer from the stream registry.
   * Null if streamId is set but no stream has been registered yet.
   * Only used when sourceKind === 'stream'.
   */
  readonly resolvedStream: MediaStream | null;
};

type ScreenEntry = {
  group: THREE.Group;
  screenMesh: THREE.Mesh;
  bezelGroup: THREE.Group;
  glowSprite?: THREE.Sprite;
  video: HTMLVideoElement;
  texture: THREE.VideoTexture;
  lastState?: MediaScreenRenderInput;
};

export class MediaScreenRenderer {
  private screens = new Map<string, ScreenEntry>();

  update(state: MediaScreenRenderInput, scene: THREE.Scene): void {
    const prev = this.screens.get(state.id)?.lastState;
    let entry = this.screens.get(state.id);

    if (!entry) {
      entry = this.createScreen(state);
      this.screens.set(state.id, entry);
      scene.add(entry.group);
    }

    // ── Transform ──────────────────────────────────────────────────────────
    entry.group.position.set(state.position[0], state.position[1], state.position[2]);
    entry.group.rotation.set(state.rotation[0], state.rotation[1], state.rotation[2]);
    entry.group.scale.setScalar(state.scale);
    entry.group.visible = state.enabled;

    // ── Video source reconciliation ────────────────────────────────────────
    // 'video' mode: update src when it changes or video element is not yet playing.
    if (state.sourceKind === 'video') {
      if (state.src !== prev?.src) {
        entry.video.src = state.src ?? '';
        entry.video.load();
        if (state.autoPlay) entry.video.play().catch(() => {/* autoplay blocked */});
      }
      // Sync loop/muted in case they change between scenes.
      entry.video.loop = state.loop;
      entry.video.muted = state.muted;
    }

    // 'stream' mode: attach the stream when it becomes available or changes.
    if (state.sourceKind === 'stream') {
      const currentStream = entry.video.srcObject as MediaStream | null;
      if (state.resolvedStream !== null && state.resolvedStream !== currentStream) {
        entry.video.srcObject = state.resolvedStream;
        entry.video.play().catch(() => {/* stream play blocked */});
      } else if (state.resolvedStream === null && currentStream !== null) {
        entry.video.srcObject = null;
        entry.video.src = '';
      }
    }

    // ── Material ────────────────────────────────────────────────────────────
    const material = entry.screenMesh.material as THREE.MeshPhysicalMaterial;
    material.clearcoat = state.gloss;
    material.clearcoatRoughness = state.glossRoughness;
    material.emissiveIntensity = state.selfIllumination;
    material.opacity = state.opacity;
    material.transparent = state.opacity < 1;
    material.needsUpdate = true;

    // ── Geometry rebuild when dimensions change ─────────────────────────────
    if (state.width !== prev?.width || state.height !== prev?.height) {
      entry.screenMesh.geometry.dispose();
      entry.screenMesh.geometry = new THREE.PlaneGeometry(state.width, state.height);
    }

    // ── Bezel rebuild ───────────────────────────────────────────────────────
    if (!prev || state.bezel !== prev.bezel || state.bezelThickness !== prev.bezelThickness ||
        state.width !== prev.width || state.height !== prev.height) {
      disposeBezel(entry.bezelGroup);
      entry.group.remove(entry.bezelGroup);
      entry.bezelGroup = createBezel(state.bezel, state.width, state.height, state.bezelThickness);
      entry.group.add(entry.bezelGroup);
    }
    entry.bezelGroup.traverse((obj) => {
      const mat = (obj as THREE.Mesh).material;
      if (mat && 'opacity' in mat) {
        (mat as THREE.Material & { opacity: number; transparent: boolean }).opacity = state.opacity;
        (mat as THREE.Material & { opacity: number; transparent: boolean }).transparent = true;
      }
    });

    // ── Glow sprite ────────────────────────────────────────────────────────
    if (state.glow) {
      if (!entry.glowSprite || state.glowColor !== prev?.glowColor || state.glowScale !== prev?.glowScale) {
        if (entry.glowSprite) { disposeGlowSprite(entry.glowSprite); entry.group.remove(entry.glowSprite); }
        entry.glowSprite = createGlow(
          state.glowColor, state.width, state.height,
          state.glowScale, state.glowOpacity * state.opacity,
        );
        entry.group.add(entry.glowSprite);
      } else {
        entry.glowSprite.material.opacity = state.glowOpacity * state.opacity;
      }
    } else if (entry.glowSprite) {
      disposeGlowSprite(entry.glowSprite);
      entry.group.remove(entry.glowSprite);
      entry.glowSprite = undefined;
    }

    entry.lastState = state;
    // Inform Three.js that the VideoTexture should check for a new frame.
    entry.texture.needsUpdate = true;
  }

  dispose(screenId: string, scene: THREE.Scene): void {
    const entry = this.screens.get(screenId);
    if (!entry) return;
    scene.remove(entry.group);
    entry.screenMesh.geometry.dispose();
    entry.texture.dispose();
    (entry.screenMesh.material as THREE.Material).dispose();
    disposeBezel(entry.bezelGroup);
    if (entry.glowSprite) disposeGlowSprite(entry.glowSprite);
    // Detach video source and pause to release browser resources.
    entry.video.pause();
    entry.video.srcObject = null;
    entry.video.src = '';
    entry.video.load();
    this.screens.delete(screenId);
  }

  private createScreen(state: MediaScreenRenderInput): ScreenEntry {
    // ── Video element ────────────────────────────────────────────────────────
    // Never inserted into the DOM — used only as a VideoTexture source.
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous'; // required for canvas/texture use in some browsers
    video.playsInline = true;        // required for autoplay on iOS
    video.muted = state.muted;
    video.loop = state.loop;

    if (state.sourceKind === 'video' && state.src) {
      video.src = state.src;
      video.load();
      if (state.autoPlay) video.play().catch(() => {/* blocked */});
    } else if (state.sourceKind === 'stream' && state.resolvedStream) {
      video.srcObject = state.resolvedStream;
      video.play().catch(() => {/* blocked */});
    }

    // ── VideoTexture ─────────────────────────────────────────────────────────
    const texture = new THREE.VideoTexture(video);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = false; // never for video — no stable mip levels

    // ── MeshPhysicalMaterial ─────────────────────────────────────────────────
    const material = new THREE.MeshPhysicalMaterial({
      map: texture,
      roughness: 0.05,
      metalness: 0,
      clearcoat: state.gloss,
      clearcoatRoughness: state.glossRoughness,
      emissive: new THREE.Color(0x111111),
      emissiveIntensity: state.selfIllumination,
      transparent: true,
      opacity: state.opacity,
      side: THREE.FrontSide,
    });

    // ── PlaneGeometry + Mesh ────────────────────────────────────────────────
    const geometry = new THREE.PlaneGeometry(state.width, state.height);
    const screenMesh = new THREE.Mesh(geometry, material);

    // ── Bezel ───────────────────────────────────────────────────────────────
    const bezelGroup = createBezel(state.bezel, state.width, state.height, state.bezelThickness);

    const group = new THREE.Group();
    group.add(screenMesh, bezelGroup);

    return { group, screenMesh, bezelGroup, video, texture, lastState: state };
  }
}
```

**Key implementation notes**:
- `video.crossOrigin = 'anonymous'` — required to use video as a WebGL texture for
  cross-origin video files that send CORS headers. Same-origin videos always work.
- `video.playsInline = true` — prevents full-screen takeover on iOS.
- `THREE.VideoTexture` polls `video.readyState` each frame when the renderer renders
  the scene. Setting `texture.needsUpdate = true` in `update()` is belt-and-suspenders —
  `VideoTexture` already handles this internally when the video has new frames.
- `generateMipmaps = false` — video textures change every frame, mip generation is
  wasteful and causes flickering.
- `colorSpace = THREE.SRGBColorSpace` — video is typically encoded in sRGB. Without this,
  colors will appear washed out.
- Geometry is recreated when `width` or `height` changes. Height changes on scene
  transitions step at midpoint via the transition spec to avoid layout thrash.

---

### `packages/diagram/src/elements/media-screen/widget.ts` (NEW)

```typescript
// MediaScreenWidget — ISceneElement<MediaScreenState> + IRenderable.
// Static stream registry: call MediaScreenWidget.registerStream(id, stream)
// before rendering scenes that use <MediaScreen streamId="id">.

import * as THREE from 'three';
import type { IRenderable, ISceneElement, WidgetInitContext, WidgetRenderContext } from '@brewsite/core';
import { validateNVSScalar } from '@brewsite/core';
import type { MediaScreenProps } from './dsl';
import { compileMediaScreen, functionalMediaScreenTransitionSpec } from './compile';
import { MediaScreenRenderer } from './render';
import type { MediaScreenState } from './types';

/**
 * DSL stub — returns null (Three.js-only rendering).
 */
export function MediaScreen(_props: MediaScreenProps): null {
  return null;
}

export class MediaScreenWidget implements ISceneElement<MediaScreenState>, IRenderable<MediaScreenState> {
  readonly widgetId: string;
  readonly defaultState: MediaScreenState;
  readonly transitionSpec = functionalMediaScreenTransitionSpec;
  readonly DslComponent = MediaScreen;

  private renderer = new MediaScreenRenderer();
  private scene: THREE.Scene | null = null;

  // Stable world scale cache
  private cachedWorldScale: {
    nvsW: number; nvsH: number;
    worldW: number; worldH: number;
  } | null = null;

  // ── Static stream registry ───────────────────────────────────────────────
  /**
   * Thread-safe (single-threaded JS) map of registered MediaStreams.
   * Keyed by the `streamId` prop passed to <MediaScreen>.
   *
   * Call MediaScreenWidget.registerStream(id, stream) BEFORE the scene is rendered.
   * Call MediaScreenWidget.unregisterStream(id) when the stream is closed.
   *
   * @example
   * const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
   * MediaScreenWidget.registerStream('capture', stream);
   *
   * // In JSX:
   * <MediaScreen id="screen1" streamId="capture" />
   *
   * // On cleanup:
   * MediaScreenWidget.unregisterStream('capture');
   * stream.getTracks().forEach(t => t.stop());
   */
  private static readonly streamRegistry = new Map<string, MediaStream>();

  static registerStream(id: string, stream: MediaStream): void {
    MediaScreenWidget.streamRegistry.set(id, stream);
  }

  static unregisterStream(id: string): void {
    MediaScreenWidget.streamRegistry.delete(id);
  }

  static getStream(id: string): MediaStream | null {
    return MediaScreenWidget.streamRegistry.get(id) ?? null;
  }

  constructor(widgetId: string, defaultState: MediaScreenState) {
    this.widgetId = widgetId;
    this.defaultState = defaultState;
  }

  initialize({ scene }: WidgetInitContext): void {
    this.scene = scene as THREE.Scene;
  }

  apply(state: MediaScreenState, context: WidgetRenderContext): void {
    if (!this.scene) return;

    if (process.env.NODE_ENV !== 'production') {
      validateNVSScalar(state.nvsX, 'nvsX', `MediaScreenWidget(${this.widgetId})`);
      validateNVSScalar(state.nvsY, 'nvsY', `MediaScreenWidget(${this.widgetId})`);
      validateNVSScalar(state.nvsWidth, 'nvsWidth', `MediaScreenWidget(${this.widgetId})`);
      if (state.nvsHeight !== undefined) {
        validateNVSScalar(state.nvsHeight, 'nvsHeight', `MediaScreenWidget(${this.widgetId})`);
      }
    }

    const [worldX, worldY, worldZ] = context.coords.toWorld(state.nvsX, state.nvsY, state.z);

    // Stable world scale cache (immune to camera zoom)
    const nvsW = state.nvsWidth;
    const nvsH = state.nvsHeight ?? (nvsW * context.coords.canvasAspect * (9 / 16));
    const cached = this.cachedWorldScale;
    let worldW: number;
    let worldH: number;
    if (cached && cached.nvsW === nvsW && cached.nvsH === nvsH) {
      worldW = cached.worldW;
      worldH = cached.worldH;
    } else {
      [worldW, worldH] = context.coords.toWorldSize(nvsW, nvsH);
      this.cachedWorldScale = { nvsW, nvsH, worldW, worldH };
    }

    // Resolve stream from registry (null if not yet registered)
    const resolvedStream =
      state.sourceKind === 'stream' && state.streamId
        ? MediaScreenWidget.getStream(state.streamId)
        : null;

    this.renderer.update({
      ...state,
      position: [worldX, worldY, worldZ],
      width: worldW,
      height: worldH,
      resolvedStream,
    }, this.scene);
  }

  dispose(): void {
    if (!this.scene) return;
    this.renderer.dispose(this.widgetId, this.scene);
    this.scene = null;
    this.cachedWorldScale = null;
  }
}
```

**Key implementation notes**:
- `streamRegistry` is `static` on `MediaScreenWidget` — it is shared across all widget
  instances and persists for the lifetime of the page. This is intentional: streams
  outlive individual scene transitions.
- `registerStream` / `unregisterStream` / `getStream` are the consumer-facing API.
  Consumers call these from React `useEffect` (or equivalent lifecycle) in the host app.
- The renderer resolves the stream on every `apply()` tick. If the stream is not yet
  registered when the first tick runs, `resolvedStream` is null and the video element
  has no source — it renders as a black mesh. Once registered, the next tick attaches
  the stream. No polling is needed.

---

### `packages/diagram/src/elements/media-screen/index.ts` (NEW)

```typescript
// Public re-exports for the media-screen element module.

export type { MediaScreenState, MediaScreenDSL, MediaScreenBezelVariant, MediaScreenSourceKind } from './types';
export { MediaScreen, MediaScreenWidget } from './widget';
export { compileMediaScreen, functionalMediaScreenTransitionSpec } from './compile';
export { MediaScreenRenderer } from './render';
export type { MediaScreenProps } from './dsl';
```

---

## Browser Capture Utilities

The `MediaScreenWidget.registerStream()` API is intentionally low-level — it accepts
any `MediaStream` regardless of origin. But `getDisplayMedia()` has enough browser
quirks (user gesture requirement, `track.ended` event, `preferCurrentTab` syntax
differences, cleanup-on-unmount) that every consumer will write the same boilerplate.
These utilities eliminate that boilerplate without hiding the underlying mechanism.

Two files. No new dependencies.

---

### `packages/diagram/src/hooks/useDisplayCapture.ts` (NEW)

**Purpose**: React hook that manages the full `getDisplayMedia()` lifecycle: permission
request, stream registration, track-ended cleanup, unmount cleanup. The consumer gets
a one-call API: `const { startCapture } = useDisplayCapture('my-screen')`.

**Key behaviors**:
- `startCapture()` must be called from a user gesture (click/keypress). The hook does
  not call it automatically — the consumer controls when to trigger the permission dialog.
- When the user stops sharing via the browser's native "Stop sharing" button, the hook
  detects the `track.ended` event and sets `isCapturing: false` automatically.
- On React unmount, the stream is stopped and unregistered unconditionally.
- If `getDisplayMedia()` is unavailable (non-HTTPS, unsupported browser), `startCapture()`
  sets `error` and `isCapturing` stays false — no throw.
- `preferCurrentTab: true` is passed in Chrome 109+. In other browsers this option is
  ignored (it is in the `video` constraint object, not the top-level options, to avoid
  a `TypeError` on older Chrome).

```typescript
// packages/diagram/src/hooks/useDisplayCapture.ts
// React hook for getDisplayMedia() lifecycle with automatic MediaScreenWidget registration.
// No Three.js. No scene imports. Pure React + browser API.

import { useState, useEffect, useCallback, useRef } from 'react';
import { MediaScreenWidget } from '../elements/media-screen/widget';

export interface UseDisplayCaptureOptions {
  /**
   * Target capture surface hint. 'browser' = tab, 'window' = app window,
   * 'monitor' = full screen. Passed as `displaySurface` video constraint.
   * Chrome 107+. Other browsers may ignore it. Default: 'browser'.
   */
  displaySurface?: 'browser' | 'window' | 'monitor';

  /**
   * Frame rate cap for the capture stream. Default: 30.
   * Lower values reduce GPU upload cost for large screens.
   */
  frameRate?: number;

  /**
   * When true, Chrome 109+ pre-selects the current tab in the picker.
   * Reduces permission friction for "show this page" use cases.
   * Silently ignored on other browsers / older Chrome. Default: true.
   */
  preferCurrentTab?: boolean;
}

export interface UseDisplayCaptureResult {
  /**
   * Call this from a click handler (user gesture required by the browser).
   * Presents the browser's share picker. On approval, the stream is registered
   * under `streamId` and `isCapturing` becomes true.
   * On rejection or permission error, `error` is set and `isCapturing` stays false.
   */
  startCapture: () => Promise<void>;

  /**
   * Stop the active capture and release all tracks.
   * Unregisters the stream from MediaScreenWidget.
   * Safe to call when not capturing.
   */
  stopCapture: () => void;

  /** True while a capture stream is active. */
  isCapturing: boolean;

  /**
   * The most recent error from startCapture(), or null if none.
   * Typical values: DOMException('NotAllowedError') when user dismisses the picker,
   * Error('NotSupportedError') on non-HTTPS origins.
   */
  error: Error | null;
}

/**
 * Manages a getDisplayMedia() capture stream and registers it with MediaScreenWidget.
 *
 * @param streamId - The key passed to <MediaScreen streamId="...">. Must match exactly.
 * @param options  - Capture constraints and behavior options.
 *
 * @example
 * ```tsx
 * const { startCapture, stopCapture, isCapturing } = useDisplayCapture('demo-capture');
 *
 * return (
 *   <>
 *     <button onClick={startCapture} disabled={isCapturing}>Share tab</button>
 *     {isCapturing && <button onClick={stopCapture}>Stop</button>}
 *   </>
 * );
 * ```
 *
 * In the scene:
 * ```tsx
 * <MediaScreen id="screen1" streamId="demo-capture" x={0.5} y={0.5} width={0.7} />
 * ```
 */
export function useDisplayCapture(
  streamId: string,
  options?: UseDisplayCaptureOptions,
): UseDisplayCaptureResult {
  const [isCapturing, setIsCapturing] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  // Keep options in a ref so stopCapture closure is stable even if options change.
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const stopCapture = useCallback((): void => {
    if (!streamRef.current) return;
    streamRef.current.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    MediaScreenWidget.unregisterStream(streamId);
    setIsCapturing(false);
  }, [streamId]);

  const startCapture = useCallback(async (): Promise<void> => {
    setError(null);

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getDisplayMedia) {
      setError(new Error('getDisplayMedia is not supported in this environment.'));
      return;
    }

    // Stop any previous capture before starting a new one.
    stopCapture();

    try {
      const opts = optionsRef.current;
      const constraints: DisplayMediaStreamOptions = {
        video: {
          // NOTE: displaySurface and frameRate are MediaTrackConstraints, not top-level.
          // preferCurrentTab must be top-level for Chrome 109+ but is not in all type defs.
          displaySurface: opts?.displaySurface ?? 'browser',
          frameRate: { ideal: opts?.frameRate ?? 30 },
        } as MediaTrackConstraints,
        audio: false,
      };

      // preferCurrentTab: top-level option, Chrome 109+. Cast to unknown to avoid
      // TypeScript errors on browsers that don't include it in their type definitions.
      if (opts?.preferCurrentTab !== false) {
        (constraints as unknown as Record<string, unknown>)['preferCurrentTab'] = true;
      }

      const stream = await navigator.mediaDevices.getDisplayMedia(constraints);
      streamRef.current = stream;
      MediaScreenWidget.registerStream(streamId, stream);
      setIsCapturing(true);

      // When the user stops sharing via the browser's native "Stop sharing" button,
      // all tracks fire 'ended'. Listen on the first video track (always present).
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.addEventListener('ended', () => {
          // Stream was stopped externally — clean up without calling track.stop() again.
          streamRef.current = null;
          MediaScreenWidget.unregisterStream(streamId);
          setIsCapturing(false);
        }, { once: true });
      }
    } catch (err) {
      // NotAllowedError = user dismissed the picker. Not an app error per se,
      // but callers may want to show UI feedback.
      setError(err instanceof Error ? err : new Error(String(err)));
      setIsCapturing(false);
    }
  }, [streamId, stopCapture]);

  // Unconditional cleanup on unmount.
  useEffect(() => {
    return (): void => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        MediaScreenWidget.unregisterStream(streamId);
      }
    };
  }, [streamId]);

  return { startCapture, stopCapture, isCapturing, error };
}
```

---

### `packages/diagram/src/elements/media-screen/streamUtils.ts` (NEW)

**Purpose**: Two utility functions for same-origin canvas capture and manual stream
cleanup. No React dependency — safe to call from vanilla JS, Vue, Svelte, or a
non-component context.

```typescript
// packages/diagram/src/elements/media-screen/streamUtils.ts
// Utility functions for creating and stopping MediaScreen capture streams.
// No React. No Three.js. Pure browser API wrappers.

import { MediaScreenWidget } from './widget';

/**
 * Captures a same-origin HTMLCanvasElement as a live MediaStream and registers it
 * with MediaScreenWidget under the given streamId.
 *
 * Use this when the content you want to display is already rendered to a canvas
 * (e.g. a Chart.js chart, a PixiJS scene, an OffscreenCanvas animation, or any
 * canvas-based app). No browser permission dialog is shown.
 *
 * @param canvas   - The source canvas. Must be same-origin. Must not be tainted
 *                   by cross-origin images (throws SecurityError if so).
 * @param streamId - The key to use in <MediaScreen streamId="...">.
 * @param frameRate - Cap the capture frame rate. Default: 30. Lower = less GPU cost.
 * @returns The created MediaStream (call .getTracks().forEach(t => t.stop()) to stop).
 *
 * @example
 * ```typescript
 * const stream = captureCanvasStream(myCanvas, 'my-canvas', 30);
 * // Later, in a scene:
 * // <MediaScreen id="s1" streamId="my-canvas" />
 * // To stop:
 * stopCaptureStream('my-canvas', stream);
 * ```
 */
export function captureCanvasStream(
  canvas: HTMLCanvasElement,
  streamId: string,
  frameRate = 30,
): MediaStream {
  const stream = canvas.captureStream(frameRate);
  MediaScreenWidget.registerStream(streamId, stream);
  return stream;
}

/**
 * Stops a capture stream and unregisters it from MediaScreenWidget.
 *
 * Stops all tracks in the stream (releasing browser capture resources) and removes
 * the streamId entry from the registry. After this call, any <MediaScreen> using
 * this streamId will render a black mesh until a new stream is registered.
 *
 * @param streamId - The key to unregister from MediaScreenWidget.
 * @param stream   - The MediaStream to stop. Stops all contained tracks.
 *
 * @example
 * ```typescript
 * // On component unmount / scene teardown:
 * stopCaptureStream('my-canvas', stream);
 * ```
 */
export function stopCaptureStream(streamId: string, stream: MediaStream): void {
  stream.getTracks().forEach((t) => t.stop());
  MediaScreenWidget.unregisterStream(streamId);
}
```

---

### Tests for Capture Utilities

#### `packages/diagram/src/hooks/__tests__/useDisplayCapture.test.tsx` (NEW)

Tests use `vitest` + `@testing-library/react`. Mock `navigator.mediaDevices.getDisplayMedia`
at the `vi.stubGlobal` level so the hook's internals run against a realistic fake.

Test cases:

```typescript
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useDisplayCapture } from '../useDisplayCapture';
import { MediaScreenWidget } from '../../elements/media-screen/widget';

// Minimal fake MediaStream with stoppable tracks.
function makeFakeStream(): MediaStream {
  const track = {
    stop: vi.fn(),
    addEventListener: vi.fn((_event, handler) => { (track as any)._handler = handler; }),
  } as unknown as MediaStreamTrack;
  return {
    getTracks: () => [track],
    getVideoTracks: () => [track],
    _track: track,
  } as unknown as MediaStream;
}

describe('useDisplayCapture', () => {
  beforeEach(() => {
    vi.spyOn(MediaScreenWidget, 'registerStream').mockImplementation(() => {});
    vi.spyOn(MediaScreenWidget, 'unregisterStream').mockImplementation(() => {});
  });
  afterEach(() => { vi.restoreAllMocks(); });

  it('starts with isCapturing=false and no error', () => {
    const { result } = renderHook(() => useDisplayCapture('test-id'));
    expect(result.current.isCapturing).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('calls getDisplayMedia and registers stream on startCapture()', async () => {
    const fakeStream = makeFakeStream();
    vi.stubGlobal('navigator', {
      mediaDevices: { getDisplayMedia: vi.fn().mockResolvedValue(fakeStream) },
    });
    const { result } = renderHook(() => useDisplayCapture('cap'));
    await act(async () => { await result.current.startCapture(); });
    expect(MediaScreenWidget.registerStream).toHaveBeenCalledWith('cap', fakeStream);
    expect(result.current.isCapturing).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it('sets error and keeps isCapturing=false when getDisplayMedia rejects', async () => {
    vi.stubGlobal('navigator', {
      mediaDevices: {
        getDisplayMedia: vi.fn().mockRejectedValue(new DOMException('NotAllowedError')),
      },
    });
    const { result } = renderHook(() => useDisplayCapture('cap'));
    await act(async () => { await result.current.startCapture(); });
    expect(result.current.isCapturing).toBe(false);
    expect(result.current.error).toBeInstanceOf(Error);
  });

  it('stopCapture() stops tracks and unregisters stream', async () => {
    const fakeStream = makeFakeStream();
    vi.stubGlobal('navigator', {
      mediaDevices: { getDisplayMedia: vi.fn().mockResolvedValue(fakeStream) },
    });
    const { result } = renderHook(() => useDisplayCapture('cap'));
    await act(async () => { await result.current.startCapture(); });
    act(() => { result.current.stopCapture(); });
    expect((fakeStream._track as any).stop).toHaveBeenCalled();
    expect(MediaScreenWidget.unregisterStream).toHaveBeenCalledWith('cap');
    expect(result.current.isCapturing).toBe(false);
  });

  it('cleans up stream on unmount', async () => {
    const fakeStream = makeFakeStream();
    vi.stubGlobal('navigator', {
      mediaDevices: { getDisplayMedia: vi.fn().mockResolvedValue(fakeStream) },
    });
    const { result, unmount } = renderHook(() => useDisplayCapture('cap'));
    await act(async () => { await result.current.startCapture(); });
    unmount();
    expect((fakeStream._track as any).stop).toHaveBeenCalled();
    expect(MediaScreenWidget.unregisterStream).toHaveBeenCalledWith('cap');
  });

  it('sets error when getDisplayMedia is unavailable', async () => {
    vi.stubGlobal('navigator', { mediaDevices: undefined });
    const { result } = renderHook(() => useDisplayCapture('cap'));
    await act(async () => { await result.current.startCapture(); });
    expect(result.current.error?.message).toMatch(/not supported/i);
  });
});
```

#### `packages/diagram/src/elements/media-screen/__tests__/streamUtils.test.ts` (NEW)

```typescript
import { describe, it, expect, vi, afterEach } from 'vitest';
import { captureCanvasStream, stopCaptureStream } from '../streamUtils';
import { MediaScreenWidget } from '../widget';

function makeFakeCanvas(stream: MediaStream): HTMLCanvasElement {
  return { captureStream: vi.fn().mockReturnValue(stream) } as unknown as HTMLCanvasElement;
}

function makeFakeStream(): MediaStream {
  const track = { stop: vi.fn() } as unknown as MediaStreamTrack;
  return { getTracks: () => [track], _track: track } as unknown as MediaStream;
}

describe('captureCanvasStream', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('calls canvas.captureStream() with the provided fps', () => {
    const stream = makeFakeStream();
    const canvas = makeFakeCanvas(stream);
    vi.spyOn(MediaScreenWidget, 'registerStream').mockImplementation(() => {});
    captureCanvasStream(canvas, 'my-key', 20);
    expect(canvas.captureStream).toHaveBeenCalledWith(20);
  });

  it('registers the stream under the given streamId', () => {
    const stream = makeFakeStream();
    const canvas = makeFakeCanvas(stream);
    const spy = vi.spyOn(MediaScreenWidget, 'registerStream').mockImplementation(() => {});
    captureCanvasStream(canvas, 'my-key', 30);
    expect(spy).toHaveBeenCalledWith('my-key', stream);
  });

  it('returns the MediaStream', () => {
    const stream = makeFakeStream();
    const canvas = makeFakeCanvas(stream);
    vi.spyOn(MediaScreenWidget, 'registerStream').mockImplementation(() => {});
    const result = captureCanvasStream(canvas, 'k');
    expect(result).toBe(stream);
  });
});

describe('stopCaptureStream', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('stops all tracks', () => {
    const stream = makeFakeStream();
    vi.spyOn(MediaScreenWidget, 'unregisterStream').mockImplementation(() => {});
    stopCaptureStream('k', stream);
    expect((stream._track as any).stop).toHaveBeenCalled();
  });

  it('unregisters the streamId', () => {
    const stream = makeFakeStream();
    const spy = vi.spyOn(MediaScreenWidget, 'unregisterStream').mockImplementation(() => {});
    stopCaptureStream('k', stream);
    expect(spy).toHaveBeenCalledWith('k');
  });
});
```

---

## Files to Modify

### `packages/diagram/src/compiler/handlers.ts`

**Add** MediaScreen import and registration at the bottom of `registerDiagramHandlers()`:

```typescript
// Add imports at the top:
import { compileMediaScreen } from '../elements/media-screen/compile';
import type { MediaScreenDSL } from '../elements/media-screen/types';
import { MediaScreen } from '../elements/media-screen/widget';

// Add inside registerDiagramHandlers():
registerNode(MediaScreen, (node: ReactElement, api: CompileApi) => {
  const dsl = node.props as MediaScreenDSL;
  const state = compileMediaScreen(dsl);
  api.setWidgetState(String(dsl.id), state);
});
```

---

### `packages/diagram/src/index.ts`

**Add** a `MediaScreen element` section after the `Screen element` section, and add
the capture utilities to the `hooks` section:

```typescript
// ─── MediaScreen element ─────────────────────────────────────────────────────
export type {
  MediaScreenState, MediaScreenDSL, MediaScreenBezelVariant, MediaScreenSourceKind,
} from './elements/media-screen/types';
export type { MediaScreenProps } from './elements/media-screen/dsl';
export { MediaScreen, MediaScreenWidget } from './elements/media-screen/widget';
export { compileMediaScreen, functionalMediaScreenTransitionSpec } from './elements/media-screen/compile';
export { MediaScreenRenderer } from './elements/media-screen/render';
// Capture utilities — stream lifecycle helpers for getDisplayMedia and captureStream.
export { captureCanvasStream, stopCaptureStream } from './elements/media-screen/streamUtils';

// ─── Hooks ────────────────────────────────────────────────────────────────────
// (useDiagramTheme already exported above — add to the existing hooks section)
export { useDisplayCapture } from './hooks/useDisplayCapture';
export type { UseDisplayCaptureOptions, UseDisplayCaptureResult } from './hooks/useDisplayCapture';
```

---

## Test Files to Create

### `packages/diagram/src/elements/media-screen/__tests__/compile.test.ts` (NEW)

Write tests using the same pattern as `screen/__tests__/compile.test.ts`:

```typescript
import { describe, it, expect, vi, afterEach } from 'vitest';
import { compileMediaScreen } from '../compile';

afterEach(() => { vi.restoreAllMocks(); });

describe('compileMediaScreen', () => {
  it('defaults to NVS center 0.5, 0.5', () => {
    const state = compileMediaScreen({ id: 'ms', src: '/video.mp4' });
    expect(state.nvsX).toBe(0.5);
    expect(state.nvsY).toBe(0.5);
  });

  it('sets sourceKind to "video" when src is provided', () => {
    const state = compileMediaScreen({ id: 'ms', src: '/video.mp4' });
    expect(state.sourceKind).toBe('video');
    expect(state.src).toBe('/video.mp4');
    expect(state.streamId).toBeUndefined();
  });

  it('sets sourceKind to "stream" when streamId is provided', () => {
    const state = compileMediaScreen({ id: 'ms', streamId: 'my-stream' });
    expect(state.sourceKind).toBe('stream');
    expect(state.streamId).toBe('my-stream');
    expect(state.src).toBeUndefined();
  });

  it('src takes precedence over streamId when both provided', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const state = compileMediaScreen({ id: 'ms', src: '/video.mp4', streamId: 'key' });
    expect(state.sourceKind).toBe('video');
    expect(warnSpy).toHaveBeenCalled();
  });

  it('warns when neither src nor streamId is provided', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    compileMediaScreen({ id: 'ms' });
    expect(warnSpy).toHaveBeenCalled();
  });

  it('defaults autoPlay=true, loop=true, muted=true', () => {
    const state = compileMediaScreen({ id: 'ms', src: '/v.mp4' });
    expect(state.autoPlay).toBe(true);
    expect(state.loop).toBe(true);
    expect(state.muted).toBe(true);
  });

  it('defaults gloss=0.5, glossRoughness=0.05, selfIllumination=0.3', () => {
    const state = compileMediaScreen({ id: 'ms', src: '/v.mp4' });
    expect(state.gloss).toBe(0.5);
    expect(state.glossRoughness).toBe(0.05);
    expect(state.selfIllumination).toBe(0.3);
  });

  it('defaults glow=true, glowColor="#88ccff", glowScale=1.4', () => {
    const state = compileMediaScreen({ id: 'ms', src: '/v.mp4' });
    expect(state.glow).toBe(true);
    expect(state.glowColor).toBe('#88ccff');
    expect(state.glowScale).toBe(1.4);
  });

  it('respects large rotation values without warning', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const state = compileMediaScreen({ id: 'ms', src: '/v.mp4', rotation: [0, 1.2, 0] });
    expect(warnSpy).not.toHaveBeenCalled();
    expect(state.rotation[1]).toBe(1.2);
  });

  it('nvsHeight is undefined by default', () => {
    const state = compileMediaScreen({ id: 'ms', src: '/v.mp4' });
    expect(state.nvsHeight).toBeUndefined();
  });

  it('nvsWidth defaults to 0.625', () => {
    const state = compileMediaScreen({ id: 'ms', src: '/v.mp4' });
    expect(state.nvsWidth).toBe(0.625);
  });
});
```

### `packages/diagram/src/elements/media-screen/__tests__/functionalTransitionSpec.test.ts` (NEW)

Write tests following the same pattern as `screen/__tests__/functionalTransitionSpec.test.ts`:

Test cases to include:
- `exitFn` blends opacity to 0 at t=1
- `enterFn` blends opacity from 0 at t=0
- `interpolateFn` blends nvsX, nvsY, z, nvsWidth, rotation, scale, opacity, gloss,
  selfIllumination, glowOpacity continuously
- `interpolateFn` steps src at t=0.5 (discrete)
- `interpolateFn` steps streamId at t=0.5 (discrete)
- `interpolateFn` steps sourceKind at t=0.5 (discrete)
- `interpolateFn` steps bezel at t=0.5 (discrete)

---

## Example Scene

Create `apps/examples/src/core-showcase/scenes/scene-media-screen.tsx` demonstrating
all three source patterns: video file, canvas captureStream, and getDisplayMedia.

### Page component (`MediaScreenPage.tsx`)

The page component holds the capture state (hook) and wires it to the scene. The scene
DSL is stateless — it just declares `streamId` keys.

```tsx
// apps/examples/src/core-showcase/MediaScreenPage.tsx
import type { JSX } from 'react';
import { useEffect, useRef } from 'react';
import { ScenePlayer } from '@brewsite/core';
import {
  MediaScreenWidget,
  captureCanvasStream,
  stopCaptureStream,
  useDisplayCapture,
} from '@brewsite/diagram';
import { MediaScreenScene } from './scenes/scene-media-screen';

// ─── Canvas stream setup ──────────────────────────────────────────────────────
// Runs an animated canvas off-screen and exposes it as 'canvas-demo'.
// Represents the pattern for embedding your own canvas-based app as a screen.

function useAnimatedCanvasStream(streamId: string): void {
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 960;
    canvas.height = 540;
    const ctx = canvas.getContext('2d')!;
    let hue = 0;
    let rafId = 0;

    const draw = (): void => {
      hue = (hue + 0.4) % 360;
      ctx.fillStyle = `hsl(${hue}, 65%, 45%)`;
      ctx.fillRect(0, 0, 960, 540);
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.font = 'bold 52px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('Live Canvas Stream', 480, 250);
      ctx.font = '28px monospace';
      ctx.fillText(new Date().toLocaleTimeString(), 480, 310);
      rafId = requestAnimationFrame(draw);
    };
    draw();

    streamRef.current = captureCanvasStream(canvas, streamId, 30);

    return (): void => {
      cancelAnimationFrame(rafId);
      if (streamRef.current) stopCaptureStream(streamId, streamRef.current);
    };
  }, [streamId]);
}

// ─── Page component ───────────────────────────────────────────────────────────

export function MediaScreenPage(): JSX.Element {
  // Canvas stream starts automatically — no user gesture needed.
  useAnimatedCanvasStream('canvas-demo');

  // Display capture requires a button click — getDisplayMedia user gesture requirement.
  const { startCapture, stopCapture, isCapturing, error } = useDisplayCapture('display-capture', {
    displaySurface: 'browser',
    frameRate: 30,
    preferCurrentTab: true,
  });

  return (
    <div style={{ position: 'relative', width: '100%', height: '100vh' }}>
      <ScenePlayer scenes={[MediaScreenScene]} />

      {/* Capture controls — overlaid on the scene */}
      <div style={{
        position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)',
        display: 'flex', gap: 12, zIndex: 10,
      }}>
        {!isCapturing ? (
          <button onClick={startCapture} style={{ padding: '10px 20px', borderRadius: 8 }}>
            Share tab as screen
          </button>
        ) : (
          <button onClick={stopCapture} style={{ padding: '10px 20px', borderRadius: 8, background: '#c00', color: '#fff' }}>
            Stop sharing
          </button>
        )}
        {error && (
          <span style={{ color: '#f88', fontSize: 13, alignSelf: 'center' }}>
            {error.message.includes('NotAllowed') ? 'Permission denied' : error.message}
          </span>
        )}
      </div>
    </div>
  );
}
```

### Scene DSL (`scene-media-screen.tsx`)

```tsx
// apps/examples/src/core-showcase/scenes/scene-media-screen.tsx
import type { JSX } from 'react';
import { Scene, Camera, Lighting, Ambient, Floor, ProgressManager } from '@brewsite/core';
import { MediaScreen } from '@brewsite/diagram';

export const MediaScreenScene = (): JSX.Element => (
  <Scene id="media-screen-demo">
    <ProgressManager scrollUnits={200} />
    <Camera mode="world" position={[0, 0.5, 8]} target={[0, 0, 0]} fov={48} />
    <Lighting intensityScale={1.0}>
      <Ambient intensity={0.6} color="#d0e4ff" />
    </Lighting>
    <Floor variant="grid" />

    {/* Left: static video file — autoplay, loop, muted */}
    <MediaScreen
      id="video-screen"
      src="/videos/product-demo.mp4"
      autoPlay loop muted
      x={0.18} y={0.5}
      width={0.36}
      rotation={[0, 0.25, 0]}
      gloss={0.6}
      selfIllumination={0.4}
      bezel="dark"
    />

    {/* Center: live canvas captureStream — registered by useAnimatedCanvasStream */}
    <MediaScreen
      id="canvas-screen"
      streamId="canvas-demo"
      x={0.5} y={0.5}
      width={0.42}
      rotation={[0, 0, 0]}
      gloss={0.5}
      selfIllumination={0.5}
      bezel="chrome"
    />

    {/* Right: getDisplayMedia capture — black until user clicks "Share tab" */}
    <MediaScreen
      id="capture-screen"
      streamId="display-capture"
      x={0.82} y={0.5}
      width={0.36}
      rotation={[0, -0.25, 0]}
      gloss={0.4}
      selfIllumination={0.6}
      glowColor="#ff8844"
      bezel="dark"
    />
  </Scene>
);
```

**Notes on the three-panel layout**:
- Left panel: video file. Always plays. Represents the "product demo video" use case.
- Center panel: same-origin canvas. Always live. Represents the "embed your dashboard
  / chart / visualization" use case.
- Right panel: `getDisplayMedia`. Black mesh until user clicks the button. Represents
  the "mirror an external website / app" use case. This is the one that requires user
  permission — shown explicitly in the UI.

---

## Testing Strategy

### Unit tests (in `__tests__/`)

**compile.test.ts**: Full coverage of `compileMediaScreen()`. All tests described above.

**functionalTransitionSpec.test.ts**: Test all blend behaviors. Assert:
- Continuous properties interpolate linearly between extreme values.
- Discrete properties step at t=0.5.
- Use real `FunctionalTransitionSpec` closures — no mocking.

**streamUtils.test.ts**: All tests described in the Browser Capture Utilities section
above. No mocking of Three.js or the scene — pure browser API interaction.

**hooks/useDisplayCapture.test.tsx**: All tests described in the Browser Capture
Utilities section above. Uses `@testing-library/react` `renderHook`. Mocks
`navigator.mediaDevices.getDisplayMedia` via `vi.stubGlobal` — does not mock
`MediaScreenWidget` internals, verifies through the public `registerStream` /
`unregisterStream` spy calls.

### Integration tests (manual)

1. Run `apps/examples` with the new scene.
2. Verify video file autoplay with no console errors.
3. Verify canvas captureStream renders live content as a texture.
4. Tilt the screen to `rotation={[0, 0.6, 0]}` — verify no breaking.
5. Place in `<ViewLayout kind="carousel">` — verify depth compositing (other 3D objects
   occlude the screen mesh correctly, unlike `<Screen>` with CSS overlay).
6. Verify scene transition fade (`opacity` interpolation).
7. Verify glow color and gloss rendering.

### Typecheck

```bash
pnpm --filter @brewsite/diagram typecheck
pnpm --filter @brewsite/examples typecheck
```

Both must pass with no errors.

---

## Performance Notes for Implementors

- **`VideoTexture` update cost**: `THREE.VideoTexture` checks `video.readyState >= 2`
  each frame when Three.js calls `texture.update()` internally during `renderer.render()`.
  This is a fast in-engine check — no pixel data is copied unless a new frame is ready.
  GPU upload happens once per video frame (≤ 60x/sec for 60fps video).

- **Dynamic resolution**: Scene authors can cap effective resolution by not providing
  `nvsHeight` (defaults to 16:9 at `nvsWidth` fraction of viewport). For large screens,
  authors can set a smaller `nvsWidth` to reduce the texture display size.

- **Stream frame rate cap**: For `getDisplayMedia` / `captureStream`, pass a `frameRate`
  constraint to limit capture: `canvas.captureStream(20)` caps at 20fps. This is the
  consumer's responsibility — the toolkit renders whatever frames arrive.

- **Multiple MediaScreens**: Each has its own `<video>` element and `VideoTexture`. Two
  screens playing the same `src` load two separate decoders. For shared content, the
  consumer can pass the same `MediaStream` to multiple widgets via multiple `registerStream`
  keys pointing to the same stream object (stream tracks are shared).

---

## Breaking Changes

None. This is a net-new element. Existing `<Screen>`, `<ImagePanel>`, and `<Diagram>`
elements are unchanged.

---

## Implementation Order

1. Create `types.ts`.
2. Create `dsl.tsx`.
3. Create `compile.ts` + `__tests__/compile.test.ts`. Run tests — must pass.
4. Create `render.ts`.
5. Create `widget.ts`.
6. Create `streamUtils.ts` + `__tests__/streamUtils.test.ts`. Run tests — must pass.
7. Create `index.ts`.
8. Create `__tests__/functionalTransitionSpec.test.ts`. Run tests — must pass.
9. Create `packages/diagram/src/hooks/useDisplayCapture.ts`.
10. Create `packages/diagram/src/hooks/__tests__/useDisplayCapture.test.tsx`.
    Run tests — must pass.
    Note: `@testing-library/react` must be available as a devDependency. Check
    `packages/diagram/package.json`; add it if missing:
    `pnpm --filter @brewsite/diagram add -D @testing-library/react`
11. Modify `compiler/handlers.ts` — add `registerNode(MediaScreen, ...)`.
12. Modify `diagram/src/index.ts` — add all MediaScreen + hook exports.
13. Create `apps/examples/src/core-showcase/scenes/scene-media-screen.tsx`.
14. Create `apps/examples/src/core-showcase/MediaScreenPage.tsx`.
15. Wire `MediaScreenPage` into the examples app router.
16. Run `pnpm --filter @brewsite/diagram typecheck` — must pass.
17. Run `pnpm --filter @brewsite/diagram test` — must pass.
18. Run `pnpm --filter @brewsite/examples typecheck` — must pass.
19. Manual integration test in dev server: verify all three screen types render,
    verify "Stop sharing" cleanup, verify scene transition fade.
