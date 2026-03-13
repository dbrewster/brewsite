---
title: "@brewsite/screens — New Package: Screen, MediaScreen, ImagePanel"
doc_type: plan
status: ready
owner: Toolkit Product
last_updated: 2026-03-13
change_history:
  - date: 2026-03-13
    author: Toolkit Product + Architect + PM
    summary: >
      Amended after architect + PM review. 9 fixes applied:
      (1) CSS3DScene → THREE.Scene (CSS3DScene does not exist in Three.js).
      (2) glowSprite.ts stays in diagram (NodeRenderer imports it); only bezelGeometry deleted.
      (3) Removed await import() from sync ScreenWidget.initialize().
      (4) Removed duplicate registerNode(Screen) drafting artifact in plugin.ts.
      (5) Typed api as CompileApi in configureRegistry handlers.
      (6) Corrected apps/examples migration — no current usages exist.
      (7) MediaScreen lazy default uses enabled:false to suppress dev warning.
      (8) Added static _clearRegistryForTest() for test isolation.
      (9) Deferred MediaScreen demo page to follow-up task.
  - date: 2026-03-13
    author: Toolkit Product
    summary: >
      Combined and supersedes plan_screen-css3d-upgrade.md and plan_media-screen-element.md.
      Extracts Screen (with CSS3DRenderer upgrade), MediaScreen (new VideoTexture element),
      and ImagePanel from @brewsite/diagram into a new @brewsite/screens package.
      Uses the WidgetPlugin factory pattern (screensPlugin) with lazy widget creation.
      bezelGeometry and glowSprite are copied into the new package; bezelGeometry removed
      from diagram (glowSprite retained — used by NodeRenderer).
---

# Plan: @brewsite/screens Package

## Goal

Extract `Screen`, `ImagePanel`, and the new `MediaScreen` element out of
`@brewsite/diagram` into a dedicated `@brewsite/screens` package. Simultaneously:

1. **Upgrade `Screen`** from a flat CSS overlay to `CSS3DRenderer` + `CSS3DObject`,
   enabling full 3D rotation and carousel placement.
2. **Add `MediaScreen`** — a true WebGL `VideoTexture` screen for video files and
   live `MediaStream` sources (including `getDisplayMedia()` captures).
3. **Clean up `@brewsite/diagram`** so it contains only diagram primitives (nodes,
   edges, groups, canvas). No panel/screen concepts remain there.

**Supersedes**: `plan_screen-css3d-upgrade.md` and `plan_media-screen-element.md`.
Archive both after this plan is implemented.

---

## Motivation

`@brewsite/diagram` currently bundles `Screen` and `ImagePanel` alongside diagram
elements. These are conceptually different (display panels vs. relational diagrams),
carry Three.js `examples/jsm` dependencies (`CSS3DRenderer`) that diagram doesn't need,
and add ~800 lines to a package that otherwise has a clean, focused API surface.

The correct dependency graph:

```
@brewsite/core               — engine, no rendering opinions
  ├── @brewsite/diagram      — Diagram, DiagramNode, DiagramEdge, DiagramCanvas
  ├── @brewsite/screens      — Screen, MediaScreen, ImagePanel  ← NEW
  ├── @brewsite/model        — GLTF models + labels
  └── @brewsite/charts       — 3D charts
```

No cross-dependencies between leaf packages. Each depends only on `@brewsite/core`.

---

## Design Decisions

### Plugin pattern: lazy widget creation (no upfront ID enumeration)
`diagramPlugin` requires consumers to declare every diagram ID upfront:
`diagramPlugin({ diagrams: ['my-diagram'] })`. This is a known design debt.
`screensPlugin` avoids this: widgets are created lazily inside `configureRegistry`
node handlers the first time a DSL node with a given ID is compiled.
Consumers just add `screensPlugin()` to their plugins array — no IDs needed.

### bezelGeometry + glowSprite: copy, not share
Both utilities are copied from `@brewsite/diagram` into `packages/screens/src/elements/_shared/`.
After the move, only `bezelGeometry.ts` is deleted from `@brewsite/diagram` (no remaining
diagram code imports it). `glowSprite.ts` **must remain** in `@brewsite/diagram` because
`packages/diagram/src/elements/diagram/rendering/NodeRenderer.ts` imports `createGlow`,
`computeGlowScale`, and `disposeGlowSprite` from `../../_shared/glowSprite`.
~100 lines total per copy — duplication cost is negligible, dependency isolation is worth it.

### CSS3DRenderer initialization: per-canvas singleton in widget (not plugin-level)
`ScreenWidget.initialize()` acquires a `CSS3DContext` from a module-level map keyed by
canvas parent element (via `css3dSetup.ts`). `ScreenWidget` implements `IExtraRenderPass`
to drive `css3DRenderer.render()` each frame. Reference counting in `css3dSetup.ts`
ensures cleanup when all Screen widgets are disposed.
This is equivalent to plugin-level init but requires no changes to `WidgetPlugin` and
keeps the CSS3D lifecycle co-located with the widget that needs it.

### MediaStream registry: static on MediaScreenWidget
`MediaStream` is a live browser object — not serializable. `MediaScreenWidget` holds
a `static` registry: `registerStream(id, stream)` / `unregisterStream(id)`.
The compiler stores the `streamId` key; the renderer resolves the live stream at tick time.

### registerNode is last-write-wins
`registry.ts` uses `Map.set()` — calling `registerNode` twice for the same component
overwrites the handler. `configureRegistry` (which has the registry closure) is called
after `registerHandlers`, so its `registerNode` calls take precedence. This is the
same pattern used by `chartPlugin`.

---

## Files Overview

### Files to CREATE in `packages/screens/`

```
packages/screens/
  package.json
  tsconfig.json
  tsconfig.build.json
  vitest.config.ts
  src/
    elements/
      _shared/
        bezelGeometry.ts              (copy + update imports)
        glowSprite.ts                 (copy + update imports)
        __tests__/
          bezelGeometry.test.ts       (copy from diagram)
          glowSprite.test.ts          (copy from diagram)
      image-panel/
        types.ts                      (copy from diagram)
        dsl.tsx                       (copy from diagram)
        compile.ts                    (copy — update @brewsite/core imports only)
        render.ts                     (copy — update _shared import paths)
        widget.ts                     (copy — update import paths)
        index.ts                      (copy — update import paths)
        __tests__/
          compile.test.ts             (copy from diagram)
          functionalTransitionSpec.test.ts (copy from diagram)
      screen/
        css3dSetup.ts                 (NEW — CSS3DRenderer singleton management)
        types.ts                      (copy from diagram — update rotation docs)
        dsl.tsx                       (copy from diagram — update rotation docs)
        compile.ts                    (copy from diagram — remove rotation warning)
        render.ts                     (NEW — CSS3DObject-based, replaces old approach)
        widget.ts                     (NEW — implements IExtraRenderPass)
        index.ts                      (new)
        __tests__/
          compile.test.ts             (updated — remove rotation warning tests)
          functionalTransitionSpec.test.ts (copy from diagram)
          css3dSetup.test.ts          (NEW)
      media-screen/
        types.ts                      (NEW)
        dsl.tsx                       (NEW)
        compile.ts                    (NEW)
        render.ts                     (NEW)
        widget.ts                     (NEW — includes static stream registry)
        streamUtils.ts                (NEW)
        index.ts                      (NEW)
        __tests__/
          compile.test.ts             (NEW)
          functionalTransitionSpec.test.ts (NEW)
          streamUtils.test.ts         (NEW)
    hooks/
      useDisplayCapture.ts            (NEW)
      __tests__/
        useDisplayCapture.test.tsx    (NEW)
    plugin.ts                         (NEW — screensPlugin() factory)
    index.ts                          (NEW — public barrel)
```

### Files to REMOVE from `packages/diagram/src/`

```
elements/_shared/bezelGeometry.ts                ← deleted (no remaining diagram imports)
elements/_shared/__tests__/bezelGeometry.test.ts ← deleted
elements/image-panel/                            ← entire directory deleted
elements/screen/                                 ← entire directory deleted
```

**KEEP in diagram:** `elements/_shared/glowSprite.ts` and
`elements/_shared/__tests__/glowSprite.test.ts` — `NodeRenderer.ts` imports from glowSprite.

### Files to MODIFY in `packages/diagram/src/`

```
compiler/handlers.ts    — remove ImagePanel + Screen registrations
index.ts                — remove ImagePanel + Screen exports + _shared
register.ts             — no change (registerDiagramHandlers still called)
```

---

## New Package Configuration Files

### `packages/screens/package.json`

```json
{
  "name": "@brewsite/screens",
  "version": "0.1.0",
  "private": false,
  "type": "module",
  "main": "./dist/index.js",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "default": "./dist/index.js"
    }
  },
  "files": ["dist", "LICENSE", "README.md"],
  "scripts": {
    "build": "tsc -p tsconfig.build.json",
    "build:lib": "tsc -p tsconfig.build.json",
    "typecheck": "tsc --noEmit -p tsconfig.json",
    "test": "vitest run --passWithNoTests",
    "test:watch": "vitest",
    "coverage": "vitest run --coverage"
  },
  "peerDependencies": {
    "@brewsite/core": "workspace:*",
    "react": "^19.2.4",
    "react-dom": "^19.2.4",
    "three": "^0.183.1"
  },
  "devDependencies": {
    "@testing-library/react": "^16.3.2",
    "@types/react": "^19.2.14",
    "@types/react-dom": "^19.2.3",
    "@types/three": "^0.183.1",
    "@vitejs/plugin-react": "^4.7.0",
    "@vitest/coverage-v8": "^2.1.9",
    "jsdom": "^24.0.0",
    "typescript": "^5.9.3",
    "vitest": "^2.1.9"
  }
}
```

No `dependencies` block — no runtime deps beyond peers. `three/examples/jsm` is part
of the `three` peer, not a separate package.

### `packages/screens/tsconfig.json`

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@brewsite/core": ["../core/src/index.ts"]
    },
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": false,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist", "**/__tests__/**", "**/*.test.*"]
}
```

### `packages/screens/tsconfig.build.json`

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "composite": true,
    "noEmit": false,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": false,
    "outDir": "dist",
    "rootDir": "src",
    "paths": {
      "@brewsite/core": ["../core/dist/index.d.ts"]
    }
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist", "**/__tests__/**", "**/*.test.*"]
}
```

### `packages/screens/vitest.config.ts`

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@brewsite/core/compiler/registry': resolve(__dirname, '../core/src/compiler/registry.ts'),
      '@brewsite/core/compiler/transitions/transitionTypes': resolve(
        __dirname, '../core/src/compiler/transitions/transitionTypes.ts',
      ),
      '@brewsite/core': resolve(__dirname, '../core/src/index.ts'),
    },
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/__tests__/**/*.test.{ts,tsx}'],
    poolOptions: { forks: { singleFork: true, isolate: true } },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json'],
      reportsDirectory: './coverage',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/__tests__/**',
        'src/**/render.ts',
        'src/**/index.ts',
        'src/**/types.ts',
        'src/plugin.ts',
      ],
    },
  },
});
```

Note: environment is `jsdom` (not `node`) because `useDisplayCapture` tests use
`renderHook` from `@testing-library/react` and `ScreenWidget` touches `document`.

---

## Shared Utilities (Copy from diagram, update imports)

### `src/elements/_shared/bezelGeometry.ts`

Copy verbatim from `packages/diagram/src/elements/_shared/bezelGeometry.ts`.
No import changes needed — it only imports `three`.

### `src/elements/_shared/glowSprite.ts`

Copy verbatim from `packages/diagram/src/elements/_shared/glowSprite.ts`.
No import changes needed — it only imports `three`.

### `src/elements/_shared/__tests__/bezelGeometry.test.ts`
### `src/elements/_shared/__tests__/glowSprite.test.ts`

Copy verbatim from diagram's `__tests__/` directory. No changes needed.

---

## ImagePanel Element (Move from diagram, update import paths only)

### `src/elements/image-panel/types.ts`
Copy from `packages/diagram/src/elements/image-panel/types.ts`.
Update: `import type { BezelVariant } from '../_shared/bezelGeometry';` — path unchanged.

### `src/elements/image-panel/dsl.tsx`
Copy verbatim. Import path for `ImagePanelBezelVariant` unchanged.

### `src/elements/image-panel/compile.ts`
Copy from diagram. Update one import:
```typescript
// OLD:
import { blendNumber, blendOpacity, blendVec3, copyVec3, validateNVSScalar } from '@brewsite/core';
// NEW: same — @brewsite/core is the peer, path stays the same
```
No import path changes needed (everything comes from `@brewsite/core` or local `./types`).

### `src/elements/image-panel/render.ts`
Copy from diagram. Update internal import:
```typescript
// OLD (diagram path):
import { createBezel, disposeBezel } from '../_shared/bezelGeometry';
import { createGlow, disposeGlowSprite } from '../_shared/glowSprite';
// NEW (screens path — same relative structure):
import { createBezel, disposeBezel } from '../_shared/bezelGeometry';
import { createGlow, disposeGlowSprite } from '../_shared/glowSprite';
```
Identical relative paths — no changes needed.

### `src/elements/image-panel/widget.ts`
Copy from diagram. Update imports:
```typescript
// Remove: import type { ImagePanelProps } from './dsl'; (already there)
// All @brewsite/core imports stay the same.
// Internal relative imports stay the same.
```
No path changes needed.

### `src/elements/image-panel/index.ts`
Copy verbatim from diagram.

### `src/elements/image-panel/__tests__/compile.test.ts`
### `src/elements/image-panel/__tests__/functionalTransitionSpec.test.ts`
Copy verbatim from diagram. No changes — no diagram-specific imports.

---

## Screen Element (Move from diagram + CSS3DRenderer upgrade)

### `src/elements/screen/css3dSetup.ts` (NEW)

Module-level CSS3DRenderer singleton management. One `CSS3DRenderer` + `THREE.Scene`
per canvas parent element, reference-counted across ScreenWidget instances.

```typescript
// css3dSetup.ts
// CSS3DRenderer singleton: one instance per canvas parent element.
// Reference-counted — disposes when the last ScreenWidget using it is disposed.

import * as THREE from 'three';
import { CSS3DRenderer } from 'three/examples/jsm/renderers/CSS3DRenderer.js';

export type CSS3DContext = {
  renderer: CSS3DRenderer;
  scene: THREE.Scene;
  lastWebGLFrame: number;
};

const contextMap = new Map<HTMLElement, CSS3DContext>();
const refCounts = new Map<HTMLElement, number>();

/**
 * Returns (creating if necessary) the CSS3DContext for the given canvas parent.
 * Inserts the CSS3DRenderer's div as the last child of canvasParent so it
 * renders on top of the WebGL canvas (z-stacking via DOM order).
 */
function getOrCreate(canvasParent: HTMLElement): CSS3DContext {
  const existing = contextMap.get(canvasParent);
  if (existing) return existing;

  const renderer = new CSS3DRenderer();
  renderer.domElement.style.cssText =
    'position:absolute;inset:0;pointer-events:none;overflow:hidden;';
  canvasParent.appendChild(renderer.domElement);

  const ctx: CSS3DContext = { renderer, scene: new THREE.Scene(), lastWebGLFrame: -1 };
  contextMap.set(canvasParent, ctx);
  return ctx;
}

/** Acquire a CSS3DContext for the given canvas parent. Increments ref count. */
export function acquireCSS3DContext(canvasParent: HTMLElement): CSS3DContext {
  const ctx = getOrCreate(canvasParent);
  refCounts.set(canvasParent, (refCounts.get(canvasParent) ?? 0) + 1);
  return ctx;
}

/** Release a CSS3DContext. When ref count reaches 0, disposes and removes the renderer. */
export function releaseCSS3DContext(canvasParent: HTMLElement): void {
  const count = (refCounts.get(canvasParent) ?? 1) - 1;
  if (count <= 0) {
    contextMap.get(canvasParent)?.renderer.domElement.remove();
    contextMap.delete(canvasParent);
    refCounts.delete(canvasParent);
  } else {
    refCounts.set(canvasParent, count);
  }
}

/**
 * Renders the CSS3D scene for the given canvas parent.
 * Guarded by WebGL frame counter — renders at most once per WebGL frame.
 * Pass renderer.info.render.frame as webglFrame.
 */
export function renderCSS3DContext(
  canvasParent: HTMLElement,
  camera: THREE.PerspectiveCamera,
  webglFrame: number,
  viewportWidth: number,
  viewportHeight: number,
): void {
  const ctx = contextMap.get(canvasParent);
  if (!ctx) return;
  if (ctx.lastWebGLFrame === webglFrame) return;
  ctx.lastWebGLFrame = webglFrame;
  ctx.renderer.setSize(viewportWidth, viewportHeight);
  ctx.renderer.render(ctx.scene, camera);
}
```

### `src/elements/screen/types.ts`

Copy from diagram. Update the `rotation` field JSDoc on `ScreenState` and `ScreenDSL`:

```typescript
// REMOVE this block:
/**
 * World-space rotation in radians [x, y, z].
 * IMPORTANT: The iframe is a flat 2D DOM rectangle. Rotation values above ~0.1
 * radians on any axis will cause the iframe to visibly misalign with the bezel.
 * compile.ts emits a console.warn if |rotation[i]| > 0.15 for any axis.
 * For tilted image content, use <ImagePanel> instead.
 * Default: [0, 0, 0]
 */

// REPLACE with:
/**
 * World-space rotation in radians [x, y, z] (Euler XYZ order).
 * Full 3D rotation supported via CSS3DRenderer — suitable for carousel layouts
 * and angled perspective views. For a static image, use <ImagePanel>.
 * For a live video or MediaStream with full WebGL depth compositing, use <MediaScreen>.
 * Default: [0, 0, 0]
 */
```

Also update the file header comment to reference `@brewsite/screens` instead of any
diagram-specific path.

### `src/elements/screen/dsl.tsx`

Copy from diagram. Update the `rotation` prop JSDoc to match the types.ts update above.
Remove the "Values above ~0.15 rad will visibly misalign" warning language.

### `src/elements/screen/compile.ts`

Copy from diagram. Make these changes:
1. **Delete** `SCREEN_ROTATION_WARNING_THRESHOLD_RAD` constant.
2. **Delete** the rotation warning `if` block and its `console.warn`.
3. **Delete** the `// DEBT: Replace console.warn...` comment.
4. All other logic is identical.

`functionalScreenTransitionSpec` is unchanged.

### `src/elements/screen/render.ts` (NEW — replaces the absolute-position overlay)

CSS3DObject-based renderer. Takes a `THREE.Scene` (for the CSS3D layer) in the
constructor instead of an `HTMLDivElement` overlay container.

```typescript
// render.ts — CSS3DRenderer-based Screen rendering.
// WebGL bezel (THREE.Group) + CSS3DObject iframe for perspective-correct 3D placement.

import * as THREE from 'three';
import { CSS3DObject } from 'three/examples/jsm/renderers/CSS3DRenderer.js';
import type { ScreenState } from './types';
import { createBezel, disposeBezel } from '../_shared/bezelGeometry';
import { createGlow, disposeGlowSprite } from '../_shared/glowSprite';

/**
 * World-space render input. NVS fields are resolved to world-space by ScreenWidget.
 * css3DScale encodes the conversion: IFRAME_REFERENCE_WIDTH_PX → worldWidth world units.
 */
export type ScreenRenderInput =
  Omit<ScreenState, 'nvsX' | 'nvsY' | 'z' | 'nvsWidth' | 'nvsHeight'> & {
  readonly position: readonly [number, number, number];
  readonly width: number;
  readonly height: number;
  /** Uniform scale to apply to CSS3DObject: worldWidth * pixPerWorldUnit / REFERENCE_PX */
  readonly css3DScale: number;
};

/** Fixed pixel budget for the iframe div. Scale converts this to world-space size. */
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
  private css3DScene: THREE.Scene;

  constructor(css3DScene: THREE.Scene) {
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

    // ── WebGL bezel transform ────────────────────────────────────────────────
    entry.group.position.set(state.position[0], state.position[1], state.position[2]);
    entry.group.rotation.set(state.rotation[0], state.rotation[1], state.rotation[2]);
    entry.group.scale.setScalar(state.scale);
    entry.group.visible = state.enabled;

    // ── CSS3DObject transform (mirrors bezel exactly) ────────────────────────
    entry.css3DObject.position.set(state.position[0], state.position[1], state.position[2]);
    entry.css3DObject.rotation.set(state.rotation[0], state.rotation[1], state.rotation[2]);
    entry.css3DObject.scale.setScalar(state.css3DScale);
    entry.css3DObject.visible = state.enabled;

    // Update iframe div height for current aspect ratio
    const refH = Math.round(IFRAME_REFERENCE_WIDTH_PX * state.height / Math.max(0.001, state.width));
    entry.iframeDiv.style.height = `${refH}px`;

    // ── Bezel rebuild on geometry change ─────────────────────────────────────
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

    // ── Glow sprite ───────────────────────────────────────────────────────────
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

    // ── Iframe enabled / src ─────────────────────────────────────────────────
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
    const group = new THREE.Group();
    const bezelGroup = createBezel(state.bezel, state.width, state.height, state.bezelThickness);
    group.add(bezelGroup);

    const refH = Math.round(IFRAME_REFERENCE_WIDTH_PX * state.height / Math.max(0.001, state.width));
    const iframeDiv = document.createElement('div');
    iframeDiv.style.cssText = `width:${IFRAME_REFERENCE_WIDTH_PX}px;height:${refH}px;pointer-events:auto;overflow:hidden;border:none;`;
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

### `src/elements/screen/widget.ts` (NEW)

Implements `IExtraRenderPass`. Uses `css3DScale` derived from `context.coords`.

```typescript
// ScreenWidget — ISceneElement<ScreenState> + IRenderable + IExtraRenderPass.
// CSS3DRenderer provides perspective-correct iframe placement at any rotation.

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

const IFRAME_REFERENCE_WIDTH_PX = 1024;

export function Screen(_props: ScreenProps): null { return null; }

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

  private cachedWorldScale: { nvsW: number; nvsH: number; worldW: number; worldH: number } | null = null;

  constructor(widgetId: string, defaultState: ScreenState) {
    this.widgetId = widgetId;
    this.defaultState = defaultState;
  }

  initialize({ scene, renderer, camera }: WidgetInitContext): void {
    this.scene = scene as THREE.Scene;
    this.webglRenderer = (renderer as THREE.WebGLRenderer) ?? null;
    this.camera = (camera as THREE.PerspectiveCamera) ?? null;

    const parent = (renderer as THREE.WebGLRenderer)?.domElement?.parentElement ?? null;
    if (!parent) {
      // Fallback for test environments — no visible rendering, no CSS3D needed.
      this.renderer = new ScreenRenderer(new THREE.Scene());
      return;
    }
    this.canvasParent = parent;
    const ctx = acquireCSS3DContext(parent);
    this.renderer = new ScreenRenderer(ctx.scene);
  }

  apply(state: ScreenState, context: WidgetRenderContext): void {
    if (!this.scene || !this.renderer) return;

    if (process.env.NODE_ENV !== 'production') {
      validateNVSScalar(state.nvsX, 'nvsX', `ScreenWidget(${this.widgetId})`);
      validateNVSScalar(state.nvsY, 'nvsY', `ScreenWidget(${this.widgetId})`);
      validateNVSScalar(state.nvsWidth, 'nvsWidth', `ScreenWidget(${this.widgetId})`);
      if (state.nvsHeight !== undefined)
        validateNVSScalar(state.nvsHeight, 'nvsHeight', `ScreenWidget(${this.widgetId})`);
    }

    const [worldX, worldY, worldZ] = context.coords.toWorld(state.nvsX, state.nvsY, state.z);

    const nvsW = state.nvsWidth;
    const nvsH = state.nvsHeight ?? (nvsW * context.coords.canvasAspect * (9 / 16));
    const cached = this.cachedWorldScale;
    let worldW: number, worldH: number;
    if (cached && cached.nvsW === nvsW && cached.nvsH === nvsH) {
      worldW = cached.worldW; worldH = cached.worldH;
    } else {
      [worldW, worldH] = context.coords.toWorldSize(nvsW, nvsH);
      this.cachedWorldScale = { nvsW, nvsH, worldW, worldH };
    }

    // css3DScale: IFRAME_REFERENCE_WIDTH_PX (CSS pixels) → worldW (world units)
    const pixPerWorldUnit = context.coords.viewportHeight / context.coords.visibleWorldHeight;
    const css3DScale = state.scale * worldW * pixPerWorldUnit / IFRAME_REFERENCE_WIDTH_PX;

    this.renderer.update({
      ...state,
      position: [worldX, worldY, worldZ],
      width: worldW,
      height: worldH,
      css3DScale,
    }, this.scene);
  }

  /** IExtraRenderPass — called by useSceneEngine after renderer.render(scene, camera). */
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

**Note on `initialize()` fallback**: In test environments without a real canvas parent,
`initialize()` creates a plain `THREE.Scene` for the `ScreenRenderer`. This is synchronous
and requires no dynamic import. The production path (with a real `canvasParent`) acquires
a CSS3DContext via `acquireCSS3DContext()` as normal.

### `src/elements/screen/index.ts`

```typescript
export type { ScreenState, ScreenDSL, ScreenBezelVariant } from './types';
export type { ScreenProps } from './dsl';
export { Screen, ScreenWidget } from './widget';
export { compileScreen, functionalScreenTransitionSpec } from './compile';
export { ScreenRenderer } from './render';
```

### `src/elements/screen/__tests__/compile.test.ts`

Copy from diagram. Apply these changes:
- **Remove** the three rotation warning tests (`emits console.warn when rotation Y/X exceeds...`,
  `does NOT warn for rotation values below 0.15 radians`).
- **Add** this test:
  ```typescript
  it('compiles large rotation values without warning', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const state = compileScreen({ id: 'screen', src: 'https://example.com', rotation: [0, 1.0, 0] });
    expect(warnSpy).not.toHaveBeenCalled();
    expect(state.rotation[1]).toBe(1.0);
  });
  ```

### `src/elements/screen/__tests__/functionalTransitionSpec.test.ts`

Copy verbatim from diagram. No changes.

### `src/elements/screen/__tests__/css3dSetup.test.ts` (NEW)

```typescript
import { describe, it, expect, vi, afterEach } from 'vitest';
import { acquireCSS3DContext, releaseCSS3DContext } from '../css3dSetup';

// CSS3DRenderer imports real DOM manipulation — mock it for unit tests.
vi.mock('three/examples/jsm/renderers/CSS3DRenderer.js', () => ({
  CSS3DRenderer: vi.fn(() => ({
    domElement: document.createElement('div'),
    setSize: vi.fn(),
    render: vi.fn(),
  })),
  CSS3DObject: vi.fn(() => ({})),
}));

describe('css3dSetup', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('acquireCSS3DContext creates a renderer and appends its div to the parent', () => {
    const parent = document.createElement('div');
    const ctx = acquireCSS3DContext(parent);
    expect(ctx).toBeDefined();
    expect(parent.children.length).toBe(1);
  });

  it('second acquire on same parent returns the same context', () => {
    const parent = document.createElement('div');
    const ctx1 = acquireCSS3DContext(parent);
    const ctx2 = acquireCSS3DContext(parent);
    expect(ctx1).toBe(ctx2);
    expect(parent.children.length).toBe(1);
  });

  it('releaseCSS3DContext does not remove renderer until ref count reaches 0', () => {
    const parent = document.createElement('div');
    acquireCSS3DContext(parent);
    acquireCSS3DContext(parent);
    releaseCSS3DContext(parent);
    expect(parent.children.length).toBe(1); // still there
    releaseCSS3DContext(parent);
    expect(parent.children.length).toBe(0); // now removed
  });
});
```

---

## MediaScreen Element (New)

### `src/elements/media-screen/types.ts`

```typescript
// Contract layer for MediaScreen. No runtime, no Three.js, no React.
import type { BezelVariant } from '../_shared/bezelGeometry';

export type MediaScreenBezelVariant = BezelVariant;
export type MediaScreenSourceKind = 'video' | 'stream';

export interface MediaScreenState {
  readonly id: string;
  readonly sourceKind: MediaScreenSourceKind;
  readonly src: string | undefined;
  readonly streamId: string | undefined;
  readonly autoPlay: boolean;
  readonly loop: boolean;
  readonly muted: boolean;
  readonly nvsX: number;
  readonly nvsY: number;
  readonly z: number;
  readonly rotation: readonly [number, number, number];
  readonly scale: number;
  readonly nvsWidth: number;
  readonly nvsHeight: number | undefined;
  readonly bezel: MediaScreenBezelVariant;
  readonly bezelThickness: number;
  readonly opacity: number;
  readonly gloss: number;
  readonly glossRoughness: number;
  readonly selfIllumination: number;
  readonly glow: boolean;
  readonly glowColor: string;
  readonly glowScale: number;
  readonly glowOpacity: number;
  readonly enabled: boolean;
}

export interface MediaScreenDSL {
  readonly id: string;
  readonly src?: string;
  readonly streamId?: string;
  readonly autoPlay?: boolean;
  readonly loop?: boolean;
  readonly muted?: boolean;
  readonly x?: number;
  readonly y?: number;
  readonly z?: number;
  readonly width?: number;
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

### `src/elements/media-screen/dsl.tsx`

```typescript
import type { MediaScreenBezelVariant } from './types';

export interface MediaScreenProps {
  id: string;
  /**
   * Video file URL (mp4, webm). Mutually exclusive with `streamId`.
   * @example src="/videos/demo.mp4"
   */
  src?: string;
  /**
   * Registry key for a live MediaStream.
   * Register before scene renders: `MediaScreenWidget.registerStream('key', stream)`
   * Mutually exclusive with `src`.
   */
  streamId?: string;
  autoPlay?: boolean;
  loop?: boolean;
  muted?: boolean;
  x?: number;
  y?: number;
  z?: number;
  width?: number;
  height?: number;
  rotation?: [number, number, number];
  scale?: number;
  bezel?: MediaScreenBezelVariant;
  bezelThickness?: number;
  opacity?: number;
  gloss?: number;
  glossRoughness?: number;
  selfIllumination?: number;
  glow?: boolean;
  glowColor?: string;
  glowScale?: number;
  glowOpacity?: number;
  enabled?: boolean;
}
```

### `src/elements/media-screen/compile.ts`

```typescript
import type { MediaScreenDSL, MediaScreenState } from './types';
import type { FunctionalTransitionSpec } from '@brewsite/core';
import { blendNumber, blendOpacity, blendVec3, copyVec3, validateNVSScalar } from '@brewsite/core';

export function compileMediaScreen(dsl: MediaScreenDSL): MediaScreenState {
  const hasSrc = Boolean(dsl.src?.length);
  const hasStreamId = Boolean(dsl.streamId?.length);

  if (process.env.NODE_ENV !== 'production') {
    if (!hasSrc && !hasStreamId)
      console.warn(`<MediaScreen id="${dsl.id}">: no src or streamId. Will render black.`);
    if (hasSrc && hasStreamId)
      console.warn(`<MediaScreen id="${dsl.id}">: both src and streamId set. src takes precedence.`);
  }

  const sourceKind = hasSrc ? 'video' : 'stream';
  const nvsX = dsl.x ?? 0.5;
  const nvsY = dsl.y ?? 0.5;
  const nvsWidth = dsl.width ?? 0.625;
  const nvsHeight = dsl.height;

  if (process.env.NODE_ENV !== 'production') {
    validateNVSScalar(nvsX, 'nvsX', `<MediaScreen id="${dsl.id}">`);
    validateNVSScalar(nvsY, 'nvsY', `<MediaScreen id="${dsl.id}">`);
    validateNVSScalar(nvsWidth, 'nvsWidth', `<MediaScreen id="${dsl.id}">`);
    if (nvsHeight !== undefined)
      validateNVSScalar(nvsHeight, 'nvsHeight', `<MediaScreen id="${dsl.id}">`);
  }

  return {
    id: dsl.id,
    sourceKind,
    src: hasSrc ? dsl.src : undefined,
    streamId: !hasSrc && hasStreamId ? dsl.streamId : undefined,
    autoPlay: dsl.autoPlay ?? true,
    loop: dsl.loop ?? true,
    muted: dsl.muted ?? true,
    nvsX, nvsY,
    z: dsl.z ?? 0,
    nvsWidth, nvsHeight,
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

export const functionalMediaScreenTransitionSpec: FunctionalTransitionSpec<MediaScreenState> = {
  exitFn: (from) => (ctx) => ({ ...from, opacity: blendOpacity(from.opacity, 0, ctx.t) ?? 0 }),
  enterFn: (to) => (ctx) => ({ ...to, opacity: blendOpacity(0, to.opacity, ctx.t) ?? to.opacity }),
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
    // Discrete — step at midpoint
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

### `src/elements/media-screen/render.ts`

```typescript
// Three.js rendering for MediaScreenState — pure WebGL, no DOM overlay.
// PlaneGeometry + MeshPhysicalMaterial + VideoTexture.

import * as THREE from 'three';
import type { MediaScreenState } from './types';
import { createBezel, disposeBezel } from '../_shared/bezelGeometry';
import { createGlow, disposeGlowSprite } from '../_shared/glowSprite';

export type MediaScreenRenderInput =
  Omit<MediaScreenState, 'nvsX' | 'nvsY' | 'z' | 'nvsWidth' | 'nvsHeight'> & {
  readonly position: readonly [number, number, number];
  readonly width: number;
  readonly height: number;
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

    entry.group.position.set(state.position[0], state.position[1], state.position[2]);
    entry.group.rotation.set(state.rotation[0], state.rotation[1], state.rotation[2]);
    entry.group.scale.setScalar(state.scale);
    entry.group.visible = state.enabled;

    if (state.sourceKind === 'video') {
      if (state.src !== prev?.src) {
        entry.video.src = state.src ?? '';
        entry.video.load();
        if (state.autoPlay) entry.video.play().catch(() => {});
      }
      entry.video.loop = state.loop;
      entry.video.muted = state.muted;
    }

    if (state.sourceKind === 'stream') {
      const current = entry.video.srcObject as MediaStream | null;
      if (state.resolvedStream && state.resolvedStream !== current) {
        entry.video.srcObject = state.resolvedStream;
        entry.video.play().catch(() => {});
      } else if (!state.resolvedStream && current) {
        entry.video.srcObject = null;
        entry.video.src = '';
      }
    }

    const mat = entry.screenMesh.material as THREE.MeshPhysicalMaterial;
    mat.clearcoat = state.gloss;
    mat.clearcoatRoughness = state.glossRoughness;
    mat.emissiveIntensity = state.selfIllumination;
    mat.opacity = state.opacity;
    mat.transparent = state.opacity < 1;
    mat.needsUpdate = true;
    entry.texture.needsUpdate = true;

    if (state.width !== prev?.width || state.height !== prev?.height) {
      entry.screenMesh.geometry.dispose();
      entry.screenMesh.geometry = new THREE.PlaneGeometry(state.width, state.height);
    }

    if (!prev || state.bezel !== prev.bezel || state.bezelThickness !== prev.bezelThickness ||
        state.width !== prev.width || state.height !== prev.height) {
      disposeBezel(entry.bezelGroup);
      entry.group.remove(entry.bezelGroup);
      entry.bezelGroup = createBezel(state.bezel, state.width, state.height, state.bezelThickness);
      entry.group.add(entry.bezelGroup);
    }
    entry.bezelGroup.traverse((obj) => {
      const m = (obj as THREE.Mesh).material;
      if (m && 'opacity' in m) {
        (m as THREE.Material & { opacity: number; transparent: boolean }).opacity = state.opacity;
        (m as THREE.Material & { opacity: number; transparent: boolean }).transparent = true;
      }
    });

    if (state.glow) {
      if (!entry.glowSprite || state.glowColor !== prev?.glowColor || state.glowScale !== prev?.glowScale) {
        if (entry.glowSprite) { disposeGlowSprite(entry.glowSprite); entry.group.remove(entry.glowSprite); }
        entry.glowSprite = createGlow(state.glowColor, state.width, state.height,
          state.glowScale, state.glowOpacity * state.opacity);
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
  }

  dispose(id: string, scene: THREE.Scene): void {
    const entry = this.screens.get(id);
    if (!entry) return;
    scene.remove(entry.group);
    entry.screenMesh.geometry.dispose();
    entry.texture.dispose();
    (entry.screenMesh.material as THREE.Material).dispose();
    disposeBezel(entry.bezelGroup);
    if (entry.glowSprite) disposeGlowSprite(entry.glowSprite);
    entry.video.pause();
    entry.video.srcObject = null;
    entry.video.src = '';
    entry.video.load();
    this.screens.delete(id);
  }

  private createScreen(state: MediaScreenRenderInput): ScreenEntry {
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.playsInline = true;
    video.muted = state.muted;
    video.loop = state.loop;

    if (state.sourceKind === 'video' && state.src) {
      video.src = state.src;
      video.load();
      if (state.autoPlay) video.play().catch(() => {});
    } else if (state.sourceKind === 'stream' && state.resolvedStream) {
      video.srcObject = state.resolvedStream;
      video.play().catch(() => {});
    }

    const texture = new THREE.VideoTexture(video);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;

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

    const geometry = new THREE.PlaneGeometry(state.width, state.height);
    const screenMesh = new THREE.Mesh(geometry, material);
    const bezelGroup = createBezel(state.bezel, state.width, state.height, state.bezelThickness);
    const group = new THREE.Group();
    group.add(screenMesh, bezelGroup);

    return { group, screenMesh, bezelGroup, video, texture, lastState: state };
  }
}
```

### `src/elements/media-screen/widget.ts`

```typescript
import * as THREE from 'three';
import type { IRenderable, ISceneElement, WidgetInitContext, WidgetRenderContext } from '@brewsite/core';
import { validateNVSScalar } from '@brewsite/core';
import type { MediaScreenProps } from './dsl';
import { compileMediaScreen, functionalMediaScreenTransitionSpec } from './compile';
import { MediaScreenRenderer } from './render';
import type { MediaScreenState } from './types';

export function MediaScreen(_props: MediaScreenProps): null { return null; }

export class MediaScreenWidget implements ISceneElement<MediaScreenState>, IRenderable<MediaScreenState> {
  readonly widgetId: string;
  readonly defaultState: MediaScreenState;
  readonly transitionSpec = functionalMediaScreenTransitionSpec;
  readonly DslComponent = MediaScreen;

  private renderer = new MediaScreenRenderer();
  private scene: THREE.Scene | null = null;
  private cachedWorldScale: { nvsW: number; nvsH: number; worldW: number; worldH: number } | null = null;

  // ── Static stream registry ───────────────────────────────────────────────
  private static readonly streamRegistry = new Map<string, MediaStream>();

  /**
   * Register a live MediaStream under a key used in <MediaScreen streamId="key">.
   * Call before or while the scene is rendering. Registration takes effect on the
   * next tick (within one frame).
   */
  static registerStream(id: string, stream: MediaStream): void {
    MediaScreenWidget.streamRegistry.set(id, stream);
  }

  /**
   * Unregister a stream. The MediaScreen will render black on the next tick.
   * Also stop the stream tracks: `stream.getTracks().forEach(t => t.stop())`.
   */
  static unregisterStream(id: string): void {
    MediaScreenWidget.streamRegistry.delete(id);
  }

  static getStream(id: string): MediaStream | null {
    return MediaScreenWidget.streamRegistry.get(id) ?? null;
  }

  /**
   * Clear the static stream registry. Test-only — ensures test isolation.
   * Must be called in afterEach() for any test that calls registerStream().
   */
  static _clearRegistryForTest(): void {
    if (process.env.NODE_ENV !== 'production') {
      MediaScreenWidget.streamRegistry.clear();
    }
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
      if (state.nvsHeight !== undefined)
        validateNVSScalar(state.nvsHeight, 'nvsHeight', `MediaScreenWidget(${this.widgetId})`);
    }

    const [worldX, worldY, worldZ] = context.coords.toWorld(state.nvsX, state.nvsY, state.z);

    const nvsW = state.nvsWidth;
    const nvsH = state.nvsHeight ?? (nvsW * context.coords.canvasAspect * (9 / 16));
    const cached = this.cachedWorldScale;
    let worldW: number, worldH: number;
    if (cached && cached.nvsW === nvsW && cached.nvsH === nvsH) {
      worldW = cached.worldW; worldH = cached.worldH;
    } else {
      [worldW, worldH] = context.coords.toWorldSize(nvsW, nvsH);
      this.cachedWorldScale = { nvsW, nvsH, worldW, worldH };
    }

    const resolvedStream = state.sourceKind === 'stream' && state.streamId
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

### `src/elements/media-screen/streamUtils.ts`

```typescript
// Utility functions for creating and stopping capture streams.
// No React. No Three.js.

import { MediaScreenWidget } from './widget';

/**
 * Captures a same-origin canvas as a live MediaStream and registers it
 * with MediaScreenWidget. No browser permission dialog.
 *
 * @param canvas    Source canvas. Must be same-origin and untainted.
 * @param streamId  Key used in <MediaScreen streamId="...">.
 * @param frameRate Cap the capture FPS (default: 30).
 * @returns The created MediaStream.
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
 * Stops all tracks in a stream and unregisters it from MediaScreenWidget.
 * Call on cleanup (component unmount, scene teardown).
 */
export function stopCaptureStream(streamId: string, stream: MediaStream): void {
  stream.getTracks().forEach((t) => t.stop());
  MediaScreenWidget.unregisterStream(streamId);
}
```

### `src/elements/media-screen/index.ts`

```typescript
export type { MediaScreenState, MediaScreenDSL, MediaScreenBezelVariant, MediaScreenSourceKind } from './types';
export type { MediaScreenProps } from './dsl';
export { MediaScreen, MediaScreenWidget } from './widget';
export { compileMediaScreen, functionalMediaScreenTransitionSpec } from './compile';
export { MediaScreenRenderer } from './render';
export { captureCanvasStream, stopCaptureStream } from './streamUtils';
```

### `src/elements/media-screen/__tests__/compile.test.ts`

Full test suite for `compileMediaScreen`. Required test cases:

- Defaults to NVS center 0.5, 0.5
- Sets `sourceKind = 'video'` when `src` is provided
- Sets `sourceKind = 'stream'` when `streamId` is provided
- `src` takes precedence when both are provided (warns)
- Warns when neither `src` nor `streamId` is provided
- Defaults `autoPlay=true, loop=true, muted=true`
- Defaults `gloss=0.5, glossRoughness=0.05, selfIllumination=0.3`
- Defaults `glow=true, glowColor='#88ccff', glowScale=1.4`
- Compiles large rotation values without warning
- `nvsHeight` is undefined by default
- `nvsWidth` defaults to 0.625

### `src/elements/media-screen/__tests__/functionalTransitionSpec.test.ts`

Tests for `functionalMediaScreenTransitionSpec`. Required assertions:
- `exitFn` blends opacity to 0 at t=1
- `enterFn` blends opacity from 0 at t=0
- `interpolateFn` blends `nvsX, nvsY, z, nvsWidth, rotation, scale, opacity, gloss,
  selfIllumination, glowOpacity` continuously
- `interpolateFn` steps `src, streamId, sourceKind, bezel, glow, loop, muted, autoPlay`
  at t < 0.5 → `from` value, t >= 0.5 → `to` value

### `src/elements/media-screen/__tests__/streamUtils.test.ts`

Tests: `captureCanvasStream` calls `canvas.captureStream(fps)` and registers stream;
returns the stream. `stopCaptureStream` stops all tracks and unregisters.
Use `vi.spyOn(MediaScreenWidget, 'registerStream')` / `unregisterStream`.

---

## Hooks

### `src/hooks/useDisplayCapture.ts`

```typescript
// React hook for getDisplayMedia() lifecycle with automatic MediaScreenWidget registration.

import { useState, useEffect, useCallback, useRef } from 'react';
import { MediaScreenWidget } from '../elements/media-screen/widget';

export interface UseDisplayCaptureOptions {
  /** 'browser' = current tab, 'window' = app window, 'monitor' = full screen. Default: 'browser'. */
  displaySurface?: 'browser' | 'window' | 'monitor';
  /** Frame rate cap. Default: 30. */
  frameRate?: number;
  /** Chrome 109+: pre-select current tab in picker. Default: true. */
  preferCurrentTab?: boolean;
}

export interface UseDisplayCaptureResult {
  /** Call from a click handler — browser requires a user gesture. */
  startCapture: () => Promise<void>;
  /** Stop capture and release the stream. Safe to call when not capturing. */
  stopCapture: () => void;
  isCapturing: boolean;
  error: Error | null;
}

export function useDisplayCapture(
  streamId: string,
  options?: UseDisplayCaptureOptions,
): UseDisplayCaptureResult {
  const [isCapturing, setIsCapturing] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
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
    stopCapture();
    try {
      const opts = optionsRef.current;
      const constraints: DisplayMediaStreamOptions = {
        video: {
          displaySurface: opts?.displaySurface ?? 'browser',
          frameRate: { ideal: opts?.frameRate ?? 30 },
        } as MediaTrackConstraints,
        audio: false,
      };
      if (opts?.preferCurrentTab !== false)
        (constraints as unknown as Record<string, unknown>)['preferCurrentTab'] = true;

      const stream = await navigator.mediaDevices.getDisplayMedia(constraints);
      streamRef.current = stream;
      MediaScreenWidget.registerStream(streamId, stream);
      setIsCapturing(true);

      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.addEventListener('ended', () => {
          streamRef.current = null;
          MediaScreenWidget.unregisterStream(streamId);
          setIsCapturing(false);
        }, { once: true });
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      setIsCapturing(false);
    }
  }, [streamId, stopCapture]);

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

### `src/hooks/__tests__/useDisplayCapture.test.tsx`

Required test cases (use `renderHook` + `act` from `@testing-library/react`):
- Initial state: `isCapturing=false`, `error=null`
- `startCapture()` calls `getDisplayMedia`, registers stream, sets `isCapturing=true`
- `startCapture()` sets `error` when `getDisplayMedia` rejects (NotAllowedError)
- `stopCapture()` stops tracks and calls `unregisterStream`
- Component unmount stops tracks and unregisters
- `getDisplayMedia` unavailable: sets error, keeps `isCapturing=false`
- Track `ended` event sets `isCapturing=false` and calls `unregisterStream`

Mock pattern:
```typescript
vi.stubGlobal('navigator', {
  mediaDevices: { getDisplayMedia: vi.fn().mockResolvedValue(fakeStream) }
});
vi.spyOn(MediaScreenWidget, 'registerStream').mockImplementation(() => {});
vi.spyOn(MediaScreenWidget, 'unregisterStream').mockImplementation(() => {});
```

---

## Plugin Factory

### `src/plugin.ts`

```typescript
// screensPlugin — WidgetPlugin factory for @brewsite/screens.
// Lazy widget creation: no upfront ID enumeration required.
// All three element types are registered and auto-created on first DSL compile.

import type { ReactElement } from 'react';
import type { WidgetPlugin, WidgetRegistry, CompileApi, CompileHelpers } from '@brewsite/core';
import { registerNode } from '@brewsite/core';
import { Screen, ScreenWidget } from './elements/screen/widget';
import { ImagePanel, ImagePanelWidget } from './elements/image-panel/widget';
import { MediaScreen, MediaScreenWidget } from './elements/media-screen/widget';
import { compileScreen } from './elements/screen/compile';
import { compileImagePanel } from './elements/image-panel/compile';
import { compileMediaScreen } from './elements/media-screen/compile';
import type { ScreenDSL } from './elements/screen/types';
import type { ImagePanelDSL } from './elements/image-panel/types';
import type { MediaScreenDSL } from './elements/media-screen/types';

/**
 * WidgetPlugin for @brewsite/screens.
 *
 * Registers Screen, MediaScreen, and ImagePanel DSL handlers.
 * Widget instances are created lazily on first compile encounter — no ID
 * enumeration needed. Just add screensPlugin() to your plugins array.
 *
 * @example
 * plugins={[corePlugin(), screensPlugin()]}
 *
 * // In scene DSL:
 * <Screen id="s1" src="https://example.com" x={0.5} y={0.5} />
 * <MediaScreen id="s2" src="/demo.mp4" x={0.5} y={0.5} />
 * <ImagePanel id="p1" src="/mockup.png" x={0.5} y={0.5} rotation={[0, 0.2, 0]} />
 */
export function screensPlugin(): WidgetPlugin {
  return {
    createWidgets(): [] {
      // Widgets are created lazily inside configureRegistry node handlers.
      return [];
    },

    registerHandlers(): void {
      // No-op: handlers are registered with registry closure in configureRegistry.
      // registerNode is last-write-wins (Map.set) — configureRegistry calls take precedence.
    },

    configureRegistry(registry: WidgetRegistry): void {
      registerNode(Screen, (node: ReactElement, api: CompileApi, _helpers: CompileHelpers) => {
        const dsl = node.props as ScreenDSL;
        if (!registry.get(dsl.id)) {
          registry.register(new ScreenWidget(dsl.id, compileScreen({ id: dsl.id, src: '', enabled: false })));
        }
        api.setWidgetState(dsl.id, compileScreen(dsl));
      });

      registerNode(MediaScreen, (node: ReactElement, api: CompileApi, _helpers: CompileHelpers) => {
        const dsl = node.props as MediaScreenDSL;
        if (!registry.get(dsl.id)) {
          registry.register(new MediaScreenWidget(dsl.id, compileMediaScreen({ id: dsl.id, enabled: false })));
        }
        api.setWidgetState(dsl.id, compileMediaScreen(dsl));
      });

      registerNode(ImagePanel, (node: ReactElement, api: CompileApi, _helpers: CompileHelpers) => {
        const dsl = node.props as ImagePanelDSL;
        if (!registry.get(dsl.id)) {
          registry.register(new ImagePanelWidget(dsl.id, compileImagePanel({ id: dsl.id, src: '', enabled: false })));
        }
        api.setWidgetState(dsl.id, compileImagePanel(dsl));
      });
    },
  };
}
```

Default states use `enabled: false` so widgets are visually inert before the first
compiled state arrives. This also prevents `compileMediaScreen({ id })` from emitting
a dev-mode `console.warn` about missing `src`/`streamId` (amendment #7).

---

## Public Barrel

### `src/index.ts`

```typescript
// @brewsite/screens — Screen, MediaScreen, and ImagePanel elements for the BrewSite toolkit.
// Handler registration is NOT automatic — use screensPlugin() with EngineProvider.

// ─── Plugin ───────────────────────────────────────────────────────────────────
export { screensPlugin } from './plugin';

// ─── Screen element ───────────────────────────────────────────────────────────
export type { ScreenState, ScreenDSL, ScreenBezelVariant } from './elements/screen/types';
export type { ScreenProps } from './elements/screen/dsl';
export { Screen, ScreenWidget } from './elements/screen/widget';
export { compileScreen, functionalScreenTransitionSpec } from './elements/screen/compile';
export { ScreenRenderer } from './elements/screen/render';

// ─── MediaScreen element ──────────────────────────────────────────────────────
export type {
  MediaScreenState, MediaScreenDSL, MediaScreenBezelVariant, MediaScreenSourceKind,
} from './elements/media-screen/types';
export type { MediaScreenProps } from './elements/media-screen/dsl';
export { MediaScreen, MediaScreenWidget } from './elements/media-screen/widget';
export { compileMediaScreen, functionalMediaScreenTransitionSpec } from './elements/media-screen/compile';
export { MediaScreenRenderer } from './elements/media-screen/render';
export { captureCanvasStream, stopCaptureStream } from './elements/media-screen/streamUtils';

// ─── ImagePanel element ───────────────────────────────────────────────────────
export type { ImagePanelState, ImagePanelDSL, ImagePanelBezelVariant } from './elements/image-panel/types';
export type { ImagePanelProps } from './elements/image-panel/dsl';
export { ImagePanel, ImagePanelWidget } from './elements/image-panel/widget';
export { compileImagePanel, functionalImagePanelTransitionSpec } from './elements/image-panel/compile';
export { ImagePanelRenderer } from './elements/image-panel/render';

// ─── Hooks ────────────────────────────────────────────────────────────────────
export { useDisplayCapture } from './hooks/useDisplayCapture';
export type { UseDisplayCaptureOptions, UseDisplayCaptureResult } from './hooks/useDisplayCapture';
```

---

## @brewsite/diagram — Modifications

### `packages/diagram/src/compiler/handlers.ts`

**Remove** the following:
1. Import of `compileImagePanel` and `ImagePanelDSL`
2. Import of `compileScreen` and `ScreenDSL`
3. Import of `ImagePanel` from `../elements/image-panel/widget`
4. Import of `Screen` from `../elements/screen/widget`
5. The `registerNode(ImagePanel, ...)` block (lines 314–318)
6. The `registerNode(Screen, ...)` block (lines 320–324)

Result: `registerDiagramHandlers()` registers only the Diagram-related nodes
(`DiagramNode`, `DiagramEdge`, `DiagramGroup`, `DiagramExit`, `DiagramEnter`,
`GridLayout`, `HierarchicalLayout`, `ManualLayout`, `FlowLayout`, `Diagram`).

### `packages/diagram/src/index.ts`

**Remove** the following sections entirely:

```typescript
// ─── ImagePanel element ──────────────────────────────────────────────────────
export type { ImagePanelState, ImagePanelDSL, ImagePanelBezelVariant } from './elements/image-panel/types';
export { ImagePanel, ImagePanelWidget } from './elements/image-panel/widget';
export { compileImagePanel, functionalImagePanelTransitionSpec } from './elements/image-panel/compile';
export { ImagePanelRenderer } from './elements/image-panel/render';

// ─── Screen element ──────────────────────────────────────────────────────────
export type { ScreenState, ScreenDSL, ScreenBezelVariant } from './elements/screen/types';
export { Screen, ScreenWidget } from './elements/screen/widget';
export { compileScreen, functionalScreenTransitionSpec } from './elements/screen/compile';
export { ScreenRenderer } from './elements/screen/render';
```

### `packages/diagram/src/register.ts`

**No change.** `registerDiagramHandlers()` is called here as before; after the
`handlers.ts` edit above it will only register diagram-related nodes.

### Files to DELETE from `packages/diagram/src/`

```
elements/_shared/bezelGeometry.ts                ← deleted (no remaining diagram imports)
elements/_shared/__tests__/bezelGeometry.test.ts ← deleted
elements/image-panel/     (entire directory)
elements/screen/          (entire directory)
```

**KEEP:** `elements/_shared/glowSprite.ts` and `elements/_shared/__tests__/glowSprite.test.ts`
— `NodeRenderer.ts` imports `createGlow`, `computeGlowScale`, `disposeGlowSprite` from it.

Run `pnpm --filter @brewsite/diagram typecheck` after deletions to confirm nothing
in the remaining diagram code imports from deleted paths.

---

## Workspace & Build Configuration

### `pnpm-workspace.yaml`

No changes needed. The workspace already includes `packages/*` which will auto-discover
`packages/screens/`.

After creating the new package, run:
```bash
pnpm install
```
This links `@brewsite/screens` as a workspace package and creates the symlink in
`node_modules`.

### `turbo.json`

No changes needed. All tasks (`build`, `build:lib`, `typecheck`, `test`, `coverage`)
are defined at the root level and apply to all packages discovered by pnpm.

### `scripts/publish-core-diagram.mjs`

This script publishes the library packages. It needs to be updated to include
`@brewsite/screens`. Open the file and add `'packages/screens'` to the list of
packages being published. The exact change depends on the script's current structure
— find the array of package paths and add the new entry.

---

## apps/examples — Migration

### Current state: no existing usages

**No apps currently import `Screen`, `ScreenWidget`, `ImagePanel`, or `ImagePanelWidget`
from `@brewsite/diagram`.** No import migration is needed at this time.

If any new usages are added before this plan executes, grep to find and update them:
```bash
grep -r "from '@brewsite/diagram'" apps/examples/src/ | grep -E "Screen|ImagePanel"
```

### Add `@brewsite/screens` to apps/examples devDependencies

Add the workspace dependency so future example pages can use the screens package:

```bash
pnpm --filter @brewsite/examples add -D @brewsite/screens
```

Or manually add to `apps/examples/package.json`:
```json
"dependencies": {
  "@brewsite/screens": "workspace:*"
}
```

### MediaScreen demo page — DEFERRED

The MediaScreen example page (`MediaScreenPage.tsx` with three-panel layout: video file,
canvas stream, getDisplayMedia) is **deferred to a follow-up task**. All MediaScreen code,
tests, and hooks ship in v0.1, but the demo page requires real browser integration testing
with video files and permission dialogs that should not block the package release.

When the demo page is implemented, it should use `screensPlugin()` in the plugin array
and demonstrate all three source modes (video URL, canvas capture, display capture).

---

## Testing Strategy

### Per-element unit tests (in `packages/screens/src/`)

| File | What to test |
|---|---|
| `image-panel/__tests__/compile.test.ts` | All defaults, explicit values, nvsHeight undefined |
| `image-panel/__tests__/functionalTransitionSpec.test.ts` | Blend and step behaviors |
| `screen/__tests__/compile.test.ts` | Defaults, no rotation warning, explicit values |
| `screen/__tests__/css3dSetup.test.ts` | Ref counting, singleton behavior, cleanup |
| `screen/__tests__/functionalTransitionSpec.test.ts` | Blend and step behaviors |
| `media-screen/__tests__/compile.test.ts` | src/streamId precedence, defaults, warnings |
| `media-screen/__tests__/functionalTransitionSpec.test.ts` | Blend and step behaviors |
| `media-screen/__tests__/streamUtils.test.ts` | captureCanvasStream, stopCaptureStream |
| `hooks/__tests__/useDisplayCapture.test.tsx` | Full lifecycle: start, stop, unmount, errors |

All tests use real function calls with real inputs and assert real outputs. No mocking
of Three.js internals. `@testing-library/react` for hook tests. `vi.stubGlobal` for
`navigator.mediaDevices`.

**Static registry test isolation**: Any test file that calls
`MediaScreenWidget.registerStream()` **must** call
`MediaScreenWidget._clearRegistryForTest()` in `afterEach` to prevent state bleed
between tests. This applies to `streamUtils.test.ts` and `useDisplayCapture.test.tsx`.

### Typecheck passes

```bash
pnpm --filter @brewsite/screens typecheck    # must pass
pnpm --filter @brewsite/diagram typecheck    # must pass after deletions
pnpm --filter @brewsite/examples typecheck   # must pass after import migration
```

### Manual integration tests

1. A `<Screen>` in a `<ViewLayout kind="carousel">` rotates correctly with the carousel.
2. `<Screen rotation={[0, 0.4, 0]}>` renders iframe foreshortened at ~23° Y rotation.
3. `<MediaScreen src="/video.mp4">` plays video on a tilted 3D mesh.
4. `<MediaScreen streamId="capture">` renders black until stream registered, then live.
5. `useDisplayCapture` button triggers browser picker; stopping sharing updates UI.
6. `<ImagePanel>` renders and transitions identically to before the move.
7. Dispose: navigating away removes iframe from DOM, CSS3DRenderer container removed
   when last ScreenWidget is disposed.

---

## Implementation Order

1. **Create package scaffold**: `packages/screens/package.json`, `tsconfig.json`,
   `tsconfig.build.json`, `vitest.config.ts`.
2. **Run `pnpm install`** to link the workspace package.
3. **Copy and verify `_shared/`**: Copy `bezelGeometry.ts` + `glowSprite.ts` + tests.
   Run `pnpm --filter @brewsite/screens test` — shared tests must pass.
4. **Copy `ImagePanel`**: All 6 source files + 2 tests. Update import paths.
   Run tests.
5. **Create `Screen` element**: `css3dSetup.ts`, updated `types.ts`, `dsl.tsx`,
   `compile.ts`, new `render.ts`, new `widget.ts`, `index.ts`. Write tests.
   Run tests.
6. **Create `MediaScreen` element**: All 7 source files + 3 test files.
   Run tests.
7. **Create `useDisplayCapture` hook + tests**. Run tests.
8. **Create `plugin.ts` + `index.ts`**.
9. **Run `pnpm --filter @brewsite/screens typecheck`** — must pass.
10. **Run `pnpm --filter @brewsite/screens test`** — all tests must pass.
11. **Modify `@brewsite/diagram`**:
    - Edit `handlers.ts` (remove Screen + ImagePanel registrations).
    - Edit `index.ts` (remove exports).
    - Delete `elements/_shared/bezelGeometry.ts` + its test (NOT glowSprite — NodeRenderer needs it).
    - Delete `elements/image-panel/` (entire directory).
    - Delete `elements/screen/` (entire directory).
12. **Run `pnpm --filter @brewsite/diagram typecheck`** — must pass.
13. **Run `pnpm --filter @brewsite/diagram test`** — must pass.
14. **`apps/examples`**: No current usages of Screen/ImagePanel from diagram exist.
    Add `@brewsite/screens` as a devDependency (`pnpm --filter @brewsite/examples add -D @brewsite/screens`).
15. **Run `pnpm --filter @brewsite/examples typecheck`** — must pass.
16. **Update `scripts/publish-core-diagram.mjs`** to include `@brewsite/screens`.
17. **Full `pnpm build`** at root — all packages must build.
18. **Manual integration test** in dev server (`pnpm dev`).
19. **Archive** `plan_screen-css3d-upgrade.md` and `plan_media-screen-element.md`
    by moving them to `requirements/diagram/plans/archive/`.
20. *(Follow-up)* **Create MediaScreen demo page** in `apps/examples/` — deferred from v0.1.
