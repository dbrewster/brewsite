---
title: "Screen Element — CSS3DRenderer Upgrade"
doc_type: plan
status: ready
owner: Toolkit Product
last_updated: 2026-03-13
---

# Plan: Screen Element — CSS3DRenderer Upgrade

## Goal

Replace the current flat CSS absolute-positioning approach with Three.js `CSS3DRenderer`
+ `CSS3DObject` so that `<Screen>` iframes participate in real 3D perspective space.
After this plan, a `<Screen>` can be rotated to any angle (including carousel Y-spins of
±30–60°), placed in a `<ViewLayout kind="carousel">`, and still have its iframe content
appear correctly foreshortened to match the WebGL bezel.

No `@brewsite/core` changes are required — `WidgetInitContext.camera` already exists.

---

## Background & Constraints

- The current implementation positions an `<iframe>` with `position: absolute` CSS pixels
  aligned to the projected center of the bezel. Max useful rotation ≈ 0.1 rad before
  misalignment becomes obvious.
- `CSS3DRenderer` (Three.js `examples/jsm`) renders DOM elements with full 4×4 matrix
  perspective transforms. Both `WebGLRenderer` and `CSS3DRenderer` share the same camera,
  so world positions align exactly.
- **Z-layering**: The CSS3D div is placed ON TOP of the WebGL canvas (higher z-index),
  matching the current approach. The bezel (rendered in WebGL) is visible at the
  screen edges. The iframe content fills the transparent inner content area.
  This means other WebGL objects cannot visually occlude the iframe — that is a known,
  accepted trade-off. `MediaScreen` (Plan 2) solves this via true WebGL texture.
- **Sizing**: CSS3DObject divs have a natural pixel size set at creation. A uniform scale
  is applied so the div fills `worldWidth × worldHeight` world units. This scale is
  recomputed every `apply()` tick from `context.coords.viewportHeight` /
  `context.coords.visibleWorldHeight`.
- `IExtraRenderPass` is already implemented end-to-end in the player. After
  `renderer.render(scene, camera)` completes, `useSceneEngine.ts` calls
  `pass.renderPass(renderer, w, h)` on all registered `IExtraRenderPass` widgets.
  `ScreenWidget` will implement this interface to drive `css3DRenderer.render()`.
- `three/examples/jsm/renderers/CSS3DRenderer.js` is importable — the SVGLoader import
  pattern is already used in `diagram/src/elements/diagram/shapes/svgIcon3D.ts`.
- Only one `CSS3DRenderer` + `CSS3DScene` must exist per canvas parent element.
  A module-level singleton map keyed by `HTMLElement` (the canvas's `parentElement`)
  ensures this regardless of how many `ScreenWidget` instances exist.

---

## Files to Create

### `packages/diagram/src/elements/screen/css3dSetup.ts` (NEW)

**Purpose**: Module-level singleton that creates and manages one `CSS3DRenderer` +
`CSS3DScene` pair per unique canvas parent element. Ensures `css3DRenderer.render()` is
called at most once per animation frame even when multiple ScreenWidgets are registered.

```typescript
// css3dSetup.ts
// CSS3DRenderer singleton management — one instance per canvas parent.
// No React, no Three.js scene/widget imports.

import { CSS3DRenderer, CSS3DScene } from 'three/examples/jsm/renderers/CSS3DRenderer.js';
import type { PerspectiveCamera } from 'three';

type CSS3DContext = {
  renderer: CSS3DRenderer;
  scene: CSS3DScene;
  lastWebGLFrame: number; // guards against rendering twice per WebGL frame
};

const contextMap = new Map<HTMLElement, CSS3DContext>();

/**
 * Returns (creating if necessary) the CSS3DContext for the given canvas parent.
 * The CSS3D div is inserted as the LAST child of `canvasParent` so it sits on
 * top of the WebGL canvas (same stacking as the current iframe overlay).
 */
export function getOrCreateCSS3DContext(canvasParent: HTMLElement): CSS3DContext {
  const existing = contextMap.get(canvasParent);
  if (existing) return existing;

  const renderer = new CSS3DRenderer();
  renderer.domElement.style.cssText =
    'position:absolute;inset:0;pointer-events:none;overflow:hidden;';
  canvasParent.appendChild(renderer.domElement);

  const scene = new CSS3DScene();
  const ctx: CSS3DContext = { renderer, scene, lastWebGLFrame: -1 };
  contextMap.set(canvasParent, ctx);
  return ctx;
}

/**
 * Renders the CSS3D scene for the given canvas parent, but only once per
 * WebGL render frame. Pass `renderer.info.render.frame` as `webglFrame`.
 * If the frame counter has not advanced, the call is a no-op.
 */
export function renderCSS3DContext(
  canvasParent: HTMLElement,
  camera: PerspectiveCamera,
  webglFrame: number,
  viewportWidth: number,
  viewportHeight: number,
): void {
  const ctx = contextMap.get(canvasParent);
  if (!ctx) return;
  if (ctx.lastWebGLFrame === webglFrame) return; // already rendered this frame
  ctx.lastWebGLFrame = webglFrame;
  ctx.renderer.setSize(viewportWidth, viewportHeight);
  ctx.renderer.render(ctx.scene, camera);
}

/**
 * Removes the CSS3DRenderer container from the DOM and cleans up the context.
 * Called when the last ScreenWidget using this context is disposed.
 * A reference counter per context tracks active widget count.
 */
const refCounts = new Map<HTMLElement, number>();

export function acquireCSS3DContext(canvasParent: HTMLElement): CSS3DContext {
  const ctx = getOrCreateCSS3DContext(canvasParent);
  refCounts.set(canvasParent, (refCounts.get(canvasParent) ?? 0) + 1);
  return ctx;
}

export function releaseCSS3DContext(canvasParent: HTMLElement): void {
  const count = (refCounts.get(canvasParent) ?? 1) - 1;
  if (count <= 0) {
    const ctx = contextMap.get(canvasParent);
    ctx?.renderer.domElement.remove();
    contextMap.delete(canvasParent);
    refCounts.delete(canvasParent);
  } else {
    refCounts.set(canvasParent, count);
  }
}
```

**Implementation notes**:
- `CSS3DRenderer.domElement` has `position: absolute; inset: 0` — covers the full canvas
  parent. It is inserted AFTER the canvas element in the DOM, so it sits on top
  (same as the current `OVERLAY_ATTR` div).
- `pointer-events: none` on the container. Individual iframe wrappers set
  `pointer-events: auto` (same as current pattern).
- `setSize(w, h)` is called every frame inside `renderCSS3DContext` — it is idempotent
  when size has not changed.

---

## Files to Modify

### `packages/diagram/src/elements/screen/render.ts`

**Replace entirely.** Remove the `syncIframeToBezel` method and the `overlayContainer`
constructor parameter. The renderer now works with `CSS3DObject` exclusively.

```typescript
// render.ts
// Three.js + CSS3D rendering for ScreenState.
// WebGL bezel + CSS3DObject iframe with full 3D perspective.

import * as THREE from 'three';
import { CSS3DObject, CSS3DScene } from 'three/examples/jsm/renderers/CSS3DRenderer.js';
import type { ScreenState } from './types';
import { createBezel, disposeBezel } from '../_shared/bezelGeometry';
import { createGlow, disposeGlowSprite } from '../_shared/glowSprite';

/**
 * World-space render input for ScreenRenderer.
 * Produced by ScreenWidget.apply() by converting NVS fields to world-space.
 * Never exported — internal to the screen element.
 */
export type ScreenRenderInput = Omit<ScreenState, 'nvsX' | 'nvsY' | 'z' | 'nvsWidth' | 'nvsHeight'> & {
  readonly position: readonly [number, number, number];
  readonly width: number;
  readonly height: number;
  /** Scale factor = worldWidth * pixelsPerWorldUnit / IFRAME_REFERENCE_WIDTH_PX */
  readonly css3DScale: number;
};

/** Fixed iframe reference resolution. Actual display size is controlled via css3DScale. */
const IFRAME_REFERENCE_WIDTH_PX = 1024;

type ScreenEntry = {
  group: THREE.Group;
  bezelGroup: THREE.Group;
  glowSprite?: THREE.Sprite;
  css3DObject: CSS3DObject;
  iframeDiv: HTMLDivElement;
  iframe: HTMLIFrameElement;
  lastState?: ScreenRenderInput;
};

export class ScreenRenderer {
  private screens = new Map<string, ScreenEntry>();
  private css3DScene: CSS3DScene;

  constructor(css3DScene: CSS3DScene) {
    this.css3DScene = css3DScene;
  }

  update(state: ScreenRenderInput, scene: THREE.Scene): void {
    let entry = this.screens.get(state.id);
    if (!entry) {
      entry = this.createScreen(state);
      this.screens.set(state.id, entry);
      scene.add(entry.group);
      this.css3DScene.add(entry.css3DObject);
    }

    // ── WebGL bezel transform ───────────────────────────────────────────────
    entry.group.position.set(state.position[0], state.position[1], state.position[2]);
    entry.group.rotation.set(state.rotation[0], state.rotation[1], state.rotation[2]);
    entry.group.scale.setScalar(state.scale);
    entry.group.visible = state.enabled;

    // ── CSS3DObject transform (mirrors bezel exactly) ───────────────────────
    entry.css3DObject.position.set(state.position[0], state.position[1], state.position[2]);
    entry.css3DObject.rotation.set(state.rotation[0], state.rotation[1], state.rotation[2]);
    entry.css3DObject.scale.setScalar(state.css3DScale);
    entry.css3DObject.visible = state.enabled;

    // ── Update iframe div height for current aspect ratio ───────────────────
    const refHeight = Math.round(IFRAME_REFERENCE_WIDTH_PX * state.height / Math.max(0.001, state.width));
    entry.iframeDiv.style.height = `${refHeight}px`;

    // ── Bezel rebuild on geometry change ────────────────────────────────────
    const prev = entry.lastState;
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

    // ── Glow sprite ─────────────────────────────────────────────────────────
    if (state.glow) {
      if (!entry.glowSprite || state.glowColor !== prev?.glowColor || state.glowScale !== prev?.glowScale) {
        if (entry.glowSprite) {
          disposeGlowSprite(entry.glowSprite);
          entry.group.remove(entry.glowSprite);
        }
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

    // ── Iframe opacity + enabled ─────────────────────────────────────────────
    entry.iframeDiv.style.opacity = String(state.opacity);
    entry.css3DObject.visible = state.enabled;
    if (!state.enabled) {
      entry.iframe.src = 'about:blank';
    } else if (state.src !== prev?.src || prev?.enabled === false) {
      entry.iframe.src = state.src;
    }

    entry.lastState = state;
  }

  dispose(screenId: string, scene: THREE.Scene): void {
    const entry = this.screens.get(screenId);
    if (!entry) return;
    scene.remove(entry.group);
    this.css3DScene.remove(entry.css3DObject);
    disposeBezel(entry.bezelGroup);
    if (entry.glowSprite) disposeGlowSprite(entry.glowSprite);
    this.screens.delete(screenId);
  }

  private createScreen(state: ScreenRenderInput): ScreenEntry {
    // ── WebGL bezel ─────────────────────────────────────────────────────────
    const group = new THREE.Group();
    const bezelGroup = createBezel(state.bezel, state.width, state.height, state.bezelThickness);
    group.add(bezelGroup);

    // ── CSS3D iframe ─────────────────────────────────────────────────────────
    // The iframe div is sized at IFRAME_REFERENCE_WIDTH_PX × computed height.
    // css3DObject.scale converts this pixel size to the correct world-space size.
    const refHeight = Math.round(IFRAME_REFERENCE_WIDTH_PX * state.height / Math.max(0.001, state.width));
    const iframeDiv = document.createElement('div');
    iframeDiv.style.cssText = `
      width: ${IFRAME_REFERENCE_WIDTH_PX}px;
      height: ${refHeight}px;
      pointer-events: auto;
      overflow: hidden;
      border: none;
    `;
    const iframe = document.createElement('iframe');
    iframe.style.cssText = `width:100%;height:100%;border:none;display:block;`;
    iframe.src = state.src;
    iframeDiv.appendChild(iframe);

    const css3DObject = new CSS3DObject(iframeDiv);
    css3DObject.scale.setScalar(state.css3DScale);

    return { group, bezelGroup, css3DObject, iframeDiv, iframe, lastState: state };
  }
}
```

**Key design decisions**:
- `ScreenRenderer` constructor now takes `CSS3DScene` instead of `HTMLDivElement`.
- No more `syncIframeToBezel()` — the CSS3DObject transform does all positioning.
- No more `NVSCoordService` or `canvasRect` parameters in `update()` — the CSS3DRenderer
  handles projection internally.
- `css3DScale` is computed in the widget layer (it depends on `context.coords`) and
  passed as part of `ScreenRenderInput`.

---

### `packages/diagram/src/elements/screen/widget.ts`

**Full replacement.**

```typescript
// ScreenWidget — ISceneElement<ScreenState> + IRenderable + IExtraRenderPass.
// Uses CSS3DRenderer for perspective-correct iframe placement in 3D.

import * as THREE from 'three';
import type {
  IRenderable, ISceneElement, IExtraRenderPass,
  WidgetInitContext, WidgetRenderContext,
} from '@brewsite/core';
import { validateNVSScalar } from '@brewsite/core';
import type { ScreenProps } from './dsl';
import { functionalScreenTransitionSpec } from './compile';
import { ScreenRenderer } from './render';
import type { ScreenState } from './types';
import { acquireCSS3DContext, releaseCSS3DContext, renderCSS3DContext } from './css3dSetup';

/**
 * Reference width used for the iframe div. Keep consistent with render.ts.
 * The CSS3DObject scale converts this pixel budget to the correct world size.
 */
const IFRAME_REFERENCE_WIDTH_PX = 1024;

export function Screen(_props: ScreenProps): null {
  return null;
}

export class ScreenWidget
  implements ISceneElement<ScreenState>, IRenderable<ScreenState>, IExtraRenderPass
{
  readonly widgetId: string;
  readonly defaultState: ScreenState;
  readonly transitionSpec = functionalScreenTransitionSpec;
  readonly DslComponent = Screen;

  private renderer: ScreenRenderer | null = null;
  private scene: THREE.Scene | null = null;
  private webglRenderer: THREE.WebGLRenderer | null = null;
  private camera: THREE.PerspectiveCamera | null = null;
  private canvasParent: HTMLElement | null = null;

  // Stable world scale cache — immune to camera zoom
  private cachedWorldScale: {
    nvsW: number; nvsH: number;
    worldW: number; worldH: number;
  } | null = null;

  constructor(widgetId: string, defaultState: ScreenState) {
    this.widgetId = widgetId;
    this.defaultState = defaultState;
  }

  initialize({ scene, renderer, camera }: WidgetInitContext): void {
    this.scene = scene as THREE.Scene;
    this.webglRenderer = (renderer as THREE.WebGLRenderer) ?? null;
    this.camera = (camera as THREE.PerspectiveCamera) ?? null;

    const canvas = (renderer as THREE.WebGLRenderer)?.domElement ?? null;
    const parent = canvas?.parentElement ?? null;
    if (!parent) {
      // Fallback: create a detached renderer (will not display, but avoids null errors)
      const fallbackScene = { add: () => {}, remove: () => {} } as unknown as import('three/examples/jsm/renderers/CSS3DRenderer.js').CSS3DScene;
      this.renderer = new ScreenRenderer(fallbackScene);
      return;
    }
    this.canvasParent = parent;
    const css3DCtx = acquireCSS3DContext(parent);
    this.renderer = new ScreenRenderer(css3DCtx.scene);
  }

  apply(state: ScreenState, context: WidgetRenderContext): void {
    if (!this.scene || !this.renderer) return;

    if (process.env.NODE_ENV !== 'production') {
      validateNVSScalar(state.nvsX, 'nvsX', `ScreenWidget(${this.widgetId})`);
      validateNVSScalar(state.nvsY, 'nvsY', `ScreenWidget(${this.widgetId})`);
      validateNVSScalar(state.nvsWidth, 'nvsWidth', `ScreenWidget(${this.widgetId})`);
      if (state.nvsHeight !== undefined) {
        validateNVSScalar(state.nvsHeight, 'nvsHeight', `ScreenWidget(${this.widgetId})`);
      }
    }

    const [worldX, worldY, worldZ] = context.coords.toWorld(state.nvsX, state.nvsY, state.z);

    // Stable world scale cache
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

    // css3DScale: converts IFRAME_REFERENCE_WIDTH_PX → worldW world units.
    // Recomputed every frame because viewportHeight / visibleWorldHeight can change
    // when the viewport resizes.
    const pixelsPerWorldUnit = context.coords.viewportHeight / context.coords.visibleWorldHeight;
    const css3DScale = state.scale * worldW * pixelsPerWorldUnit / IFRAME_REFERENCE_WIDTH_PX;

    this.renderer.update({
      ...state,
      position: [worldX, worldY, worldZ],
      width: worldW,
      height: worldH,
      css3DScale,
    }, this.scene);
  }

  /**
   * IExtraRenderPass implementation.
   * Called by useSceneEngine AFTER renderer.render(scene, camera) each frame.
   * Renders the CSS3D scene once per WebGL frame (guarded by frame counter).
   */
  renderPass(renderer: THREE.WebGLRenderer, viewportWidth: number, viewportHeight: number): void {
    if (!this.canvasParent || !this.camera) return;
    renderCSS3DContext(
      this.canvasParent,
      this.camera,
      renderer.info.render.frame,
      viewportWidth,
      viewportHeight,
    );
  }

  dispose(): void {
    if (!this.scene || !this.renderer) return;
    this.renderer.dispose(this.widgetId, this.scene);
    if (this.canvasParent) releaseCSS3DContext(this.canvasParent);
    this.scene = null;
    this.renderer = null;
    this.canvasParent = null;
    this.camera = null;
    this.cachedWorldScale = null;
  }
}
```

**Key implementation notes**:
- `initialize()` receives `camera?: PerspectiveCamera` from `WidgetInitContext` — store it
  for use in `renderPass()`.
- `IExtraRenderPass.renderPass()` is called by `useSceneEngine.ts` after each WebGL frame.
  `renderer.info.render.frame` is the WebGL frame counter — used to ensure CSS3D renders
  exactly once per WebGL frame across multiple ScreenWidget instances.
- `acquireCSS3DContext` / `releaseCSS3DContext` provide reference counting so the
  CSS3DRenderer is removed from the DOM when all Screen widgets are disposed.
- `css3DScale` encodes the conversion from pixel space (1024 ref width) to world space.

---

### `packages/diagram/src/elements/screen/compile.ts`

**Modify**: Remove the rotation warning. With CSS3DRenderer, full 3D rotation is
supported. Remove `SCREEN_ROTATION_WARNING_THRESHOLD_RAD` and the `console.warn` block.
Update the JSDoc on `rotation` in `ScreenState` and `ScreenDSL` types to remove the
"values above 0.15 rad" warning language.

Specifically:
1. Delete `SCREEN_ROTATION_WARNING_THRESHOLD_RAD` constant.
2. Delete the rotation warning `if` block in `compileScreen()`.
3. Remove the `DEBT` comment about replacing `console.warn`.
4. Update the `rotation` field JSDoc in `ScreenState` and `ScreenDSL` (in types.ts) to
   say "supports full 3D rotation via CSS3DRenderer" instead of the flat-DOM warning.

---

### `packages/diagram/src/elements/screen/types.ts`

**Modify**: Update rotation docs on `ScreenState.rotation` and `ScreenDSL.rotation`:

Old:
```typescript
/**
 * World-space rotation in radians [x, y, z].
 * IMPORTANT: The iframe is a flat 2D DOM rectangle. Rotation values above ~0.1
 * radians on any axis will cause the iframe to visibly misalign with the bezel.
 * compile.ts emits a console.warn if |rotation[i]| > 0.15 for any axis.
 * For tilted image content, use <ImagePanel> instead.
 * Default: [0, 0, 0]
 */
```

New:
```typescript
/**
 * World-space rotation in radians [x, y, z] (Euler XYZ order).
 * Supports full 3D rotation via CSS3DRenderer — suitable for carousel layouts
 * and angled perspective views. For a static image instead of a live website,
 * use <ImagePanel>. For a live video or MediaStream with full WebGL compositing
 * (occlusion, reflections), use <MediaScreen>.
 * Default: [0, 0, 0]
 */
```

---

## Files to Modify — Tests

### `packages/diagram/src/elements/screen/__tests__/compile.test.ts`

**Remove** these two tests (the rotation warning is deleted from compile.ts):
- `'emits console.warn when rotation Y exceeds 0.15 radians'`
- `'emits console.warn when rotation X exceeds 0.15 radians'`
- `'does NOT warn for rotation values below 0.15 radians'`

**Add** a new test asserting rotation values above 0.15 rad compile without warning:
```typescript
it('compiles large rotation values without warning', () => {
  const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  const state = compileScreen({ id: 'screen', src: 'https://example.com', rotation: [0, 1.0, 0] });
  expect(warnSpy).not.toHaveBeenCalled();
  expect(state.rotation[1]).toBe(1.0);
});
```

### `packages/diagram/src/elements/screen/__tests__/functionalTransitionSpec.test.ts`

No changes required.

---

## Example Scene Update

Update or add to `apps/examples/src/input-showcase/scenes/` a new scene demonstrating
a tilted `<Screen>` in a carousel:

```tsx
// scene-screens-carousel.tsx (new file in input-showcase)
<Scene id="screens-carousel">
  <Camera mode="world" position={[0, 0.5, 7]} target={[0, 0, 0]} fov={48} />
  <ViewLayout id="screen-carousel-layout" kind="carousel" loop activeIndex={0} spread={0.6} zStep={8}>
    <View id="sv1" w={0.55} h={0.45}>
      <Screen id="s1" x={0.5} y={0.5} width={1} rotation={[0, 0, 0]} src="https://threejs.org" />
    </View>
    <View id="sv2" w={0.55} h={0.45}>
      <Screen id="s2" x={0.5} y={0.5} width={1} rotation={[0, 0, 0]} src="https://vitejs.dev" />
    </View>
  </ViewLayout>
</Scene>
```

The `<Screen>` elements inside `<View>` will rotate as the carousel spins — the CSS3D
transforms keep the iframe perspective-correct at any angle.

---

## Testing Strategy

### Unit tests
- `compile.test.ts`: verify rotation values compile without warnings (updated above).
- `css3dSetup.test.ts` (new): test `acquireCSS3DContext` / `releaseCSS3DContext` reference
  counting. Use a jsdom HTMLDivElement as `canvasParent`. Assert that:
  - Second acquire on same parent returns same context.
  - Release after 2 acquires does not remove the renderer.
  - Release after last acquire removes the renderer's domElement.
- `render.test.ts` (new): test `ScreenRenderer.update()` with a mock CSS3DScene and mock
  THREE.Scene. Assert that `css3DScene.add` is called on first update, that the
  css3DObject's position/rotation are set correctly, and that `dispose()` calls
  `css3DScene.remove`.

### Integration
- Manually verify in `apps/examples` that a `<Screen>` inside a `<ViewLayout kind="carousel">`
  shows perspective-correct iframe rotation.
- Manually verify that `rotation={[0, 0.4, 0]}` (≈23°) renders the iframe correctly
  foreshortened.
- Verify that disposing a scene removes the iframe from the DOM and the CSS3DScene.

---

## Migration / Breaking Changes

**Zero breaking changes.** The DSL props are unchanged. The only user-visible change is:
- The rotation warning in `compile.ts` is removed (previously a console.warn).
- `SCREEN_ROTATION_WARNING_THRESHOLD_RAD` is removed from the exported API of
  `compile.ts` — this was not in `index.ts` exports and is not a public API.

---

## Dependency Notes

`CSS3DRenderer` is part of `three/examples/jsm`. Since `three` is a peer dependency at
`^0.183.1` and JSM imports already work (see `SVGLoader` usage in
`packages/diagram/src/elements/diagram/shapes/svgIcon3D.ts`), no new dependencies are
required. `@types/three` already covers the JSM types.

---

## Implementation Order

1. Create `css3dSetup.ts` with the singleton management functions.
2. Rewrite `render.ts` using `CSS3DObject`.
3. Rewrite `widget.ts` implementing `IExtraRenderPass`.
4. Remove rotation warning from `compile.ts` and update `types.ts` JSDoc.
5. Update `compile.test.ts` tests.
6. Write `css3dSetup.test.ts` unit tests.
7. Write `render.test.ts` unit tests.
8. Run `pnpm --filter @brewsite/diagram typecheck` — must pass.
9. Run `pnpm --filter @brewsite/diagram test` — must pass.
10. Manually verify carousel demo scene.
