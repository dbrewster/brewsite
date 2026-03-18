---
title: Creating Custom Components
doc_type: guide
owner: claude-author
status: active
updated: 2026-03-16
---

## The Element Module Pattern — Six Files, Hard Boundaries

Every renderable concept in BrewSite follows a six-file module pattern with strict import boundaries. The files are created in dependency order: innermost layer first, integration surface last.

```
types.ts → dsl.tsx → compile.ts → render.ts → {Name}Widget.ts → index.ts
```

| File | Purpose | Allowed imports | Forbidden imports |
|---|---|---|---|
| `types.ts` | State and style type contracts | Nothing external | Three.js, React, runtime, other elements |
| `dsl.tsx` | DSL authoring surface (null-returning component + props type) | `types.ts`, `@brewsite/core` DSL types | Three.js, runtime, widget internals |
| `compile.ts` | Pure state resolution + transition spec | `types.ts`, `transitionTypes` from core | Three.js, React, `render.ts` |
| `render.ts` | Three.js application layer | `types.ts`, Three.js, pure helper modules | React, `compile.ts`, compiler internals |
| `{Name}Widget.ts` | Widget class implementing `IWidget` sub-interfaces | `types.ts`, `render.ts`, `compile.ts`, `IWidget` interfaces | Direct React rendering |
| `index.ts` | Re-exports only | All sibling files | No new logic |

Violating these boundaries is an architectural bug. If `render.ts` imports from `compile.ts`, or `compile.ts` imports Three.js, the module structure is broken.

## types.ts — The Contract Comes First

`types.ts` defines the compiled state type and any supporting style/enum types. It imports nothing from Three.js, React, or runtime modules. This is the contract that every other file in the module depends on.

```typescript
// CarouselScrubber element types -- interface contracts only.

export type CarouselTrayEdgeStyle = 'smooth' | 'knurled' | 'ridged' | 'matte';

export type CarouselScrubberStyle = {
  /** Tray base color. Default: '#2C3E55'. */
  baseColor: string;
  /** Tray base opacity. Default: 0.6. */
  baseOpacity: number;
  /** Accent/highlight color. Default: '#5090e0'. */
  accentColor: string;
  /** Material metalness [0-1]. Default: 0.4. */
  metalness: number;
  /** Material roughness [0-1]. Default: 0.55. */
  roughness: number;
  /** Front-edge surface treatment. Default: 'knurled'. */
  edgeStyle: CarouselTrayEdgeStyle;
};

export type CarouselScrubberState = {
  layoutId: string;
  activeIndex: number;
  childCount: number;
  loop: boolean;
  style: CarouselScrubberStyle;
  showBase: boolean;
  trayDepth: number;
  gap: number;
  nvsBounds: { x: number; y: number; w: number; h: number };
};
```

Every field in the state type must be fully concrete (no `undefined`, no optionals). The compiled state is what the widget receives every frame. Optional DSL props are resolved to concrete defaults in `compile.ts`.

## dsl.tsx — The Authoring Surface

The DSL component is a null-returning stub function. It is a marker for the compiler, not a React renderer. The compiler's NodeHandler reads props from the React element; the component itself does nothing at runtime.

```typescript
// CarouselTray — DSL child component for ViewLayout carousel tray.

import type { CarouselScrubberStyle } from './types';

/** Props for the <CarouselTray> DSL component. */
export type CarouselTrayProps = {
  /** Tray base color. Default: '#2C3E55'. */
  color?: string;
  /** Tray base opacity [0..1]. Default: 0.6. */
  opacity?: number;
  /** Accent color for tray highlights. Default: '#5090e0'. */
  accentColor?: string;
  /** Depth (thickness) of the tray in world units. Default: 0.36. */
  depth?: number;
};

/** Null-returning DSL stub. Consumed by viewLayoutHandler, not rendered directly. */
export const CarouselTray = (_props: CarouselTrayProps): null => null;
CarouselTray.displayName = 'CarouselTray';
```

`displayName` is required. The compiler uses it for warning messages when the component appears in an unexpected position. Props are all optional because defaults come from theme resolution and `compile.ts`.

## Registering a NodeHandler — How the Compiler Sees Your Component

Every DSL component must have a registered NodeHandler. Without one, the component compiles to nothing (a silent bug). Register in `coreHandlers.ts` (for core elements) or your package's `handlers.ts`:

```typescript
import { registerNode } from './registry';
import { CarouselScrubber, carouselScrubberNodeHandler } from '../elements/carousel-scrubber/CarouselScrubberWidget';

// Inside registerCoreHandlers():
registerNode(CarouselScrubber, carouselScrubberNodeHandler, { category: 'ambient' });
```

The NodeHandler signature:

```typescript
type NodeHandler = (
  node: ReactElement,
  api: CompileApi,
  helpers: CompileHelpers,
) => void;
```

A handler reads `node.props`, resolves state, and writes via `api.setWidgetState(widgetId, state)`. It is a pure function: no Three.js, no side effects beyond `api.state` writes.

```typescript
export const carouselScrubberNodeHandler: NodeHandler = (node, api, helpers): void => {
  const props = node.props as CarouselScrubberProps;
  const widgetId = props.id;
  if (!widgetId) return;

  // Read sibling state from api.state.widgets to derive metadata
  const layoutState = api.state.widgets[resolvedProps.layoutId] as ViewLayoutState | undefined;

  const state = compileCarouselScrubber(resolvedProps, activeIndex, childCount, loop);
  api.setWidgetState(widgetId, state);
};
```

The third argument to `registerNode` sets the category. Use `{ category: 'spatial' }` (default) for elements that must live inside Views. Use `{ category: 'ambient' }` for elements that position themselves (Camera, Lighting, CarouselScrubber).

## Theme Resolution at Compile Time — The Correct Pattern

Resolve theme values in the NodeHandler using `api.context.themeFamily` and `api.context.themePolarity`. Call `resolveSceneTheme(family, polarity)` from `theme/sceneThemeRegistry` to get the full `SceneTheme` object. Bake themed values into the compiled state.

```typescript
import { resolveSceneTheme } from '../../theme/sceneThemeRegistry';

// Inside your NodeHandler:
const sceneTheme = resolveSceneTheme(api.context.themeFamily, api.context.themePolarity);
const trayTheme = sceneTheme.carouselTray;

// Priority: DSL props > theme values > compiled defaults
const trayState = compileCarouselScrubber({
  id: trayWidgetId,
  layoutId,
  style: {
    baseColor: trayProps.color ?? trayTheme?.color,
    baseOpacity: trayProps.opacity ?? trayTheme?.opacity,
    accentColor: trayProps.accentColor ?? trayTheme?.accentColor,
  },
}, activeIndex, childCount, isLoop, containerBounds);
api.setWidgetState(trayWidgetId, trayState);
```

Do NOT read theme from `scene.userData` at render time. The `scene.userData.__brewsite_scene_theme` reference uses `Object.is` equality in React effects. The theme registry returns the same constant object reference for the same `family + polarity` pair, so a `useEffect` with `[sceneTheme]` dependency silently skips when toggling back to a previously-seen polarity. The carousel tray, diagrams, and charts all resolve theme at compile time for this reason.

When the active theme changes, scene components re-render with new theme props, the compiler re-runs, and the compiled track is rebuilt with new theme-resolved state. The widget receives the new state via `apply()` on the next frame.

## compile.ts — Pure State Resolution

`compile.ts` contains the default style constant, default state constant, the compile function, and the transition spec. No Three.js, no React, no side effects.

```typescript
import type { CarouselScrubberState, CarouselScrubberStyle } from './types';
import type { FunctionalTransitionSpec } from '../../compiler/transitions/transitionTypes';
import { blendNumber, blendColor } from '../../compiler/transitions/transitionTypes';

export const DEFAULT_CAROUSEL_SCRUBBER_STYLE: CarouselScrubberStyle = {
  baseColor: '#1E2F44',
  baseOpacity: 0.82,
  accentColor: '#5090e0',
  metalness: 0.35,
  roughness: 0.6,
  edgeStyle: 'knurled',
};

export function compileCarouselScrubber(
  props: CarouselScrubberProps,
  activeIndex: number,
  childCount: number,
  loop: boolean,
  nvsBounds?: { x: number; y: number; w: number; h: number },
): CarouselScrubberState {
  // Strip undefined values before merging — undefined from a spread
  // would overwrite the default, breaking "is this explicitly set?" checks.
  const definedStyle: Partial<CarouselScrubberStyle> = {};
  if (props.style) {
    for (const [k, v] of Object.entries(props.style)) {
      if (v !== undefined) {
        (definedStyle as Record<string, unknown>)[k] = v;
      }
    }
  }

  const style: CarouselScrubberStyle = {
    ...DEFAULT_CAROUSEL_SCRUBBER_STYLE,
    ...definedStyle,
  };

  return {
    layoutId: props.layoutId,
    activeIndex,
    childCount,
    loop,
    style,
    showBase: props.showBase ?? true,
    trayDepth: props.trayDepth ?? 0.36,
    gap: props.gap ?? 0.02,
    nvsBounds: nvsBounds ?? { x: 0, y: 0, w: 1, h: 1 },
  };
}
```

The `definedStyle` pattern is critical. When DSL props are spread into the style object, unset optional props produce `{ baseColor: undefined }`. Without filtering, the spread `{ ...DEFAULT, ...{ baseColor: undefined } }` overwrites the default with `undefined`. Always strip undefined entries before merging.

## Choosing a Transition Spec — ElementTransitionSpec vs FunctionalTransitionSpec

Use `FunctionalTransitionSpec<T>` when your state has numeric fields that interpolate smoothly (opacity, position, color). The spec returns closure functions that the engine calls at each tick with `t` in `[0, 1]`.

```typescript
export const carouselScrubberTransitionSpec: FunctionalTransitionSpec<CarouselScrubberState> = {
  exitFn: (from) => ({ t }) => ({
    ...from,
    style: {
      ...from.style,
      baseOpacity: blendNumber(from.style.baseOpacity, 0, t) ?? 0,
    },
  }),
  enterFn: (to) => ({ t }) => ({
    ...to,
    style: {
      ...to.style,
      baseOpacity: blendNumber(0, to.style.baseOpacity, t) ?? to.style.baseOpacity,
    },
  }),
  interpolateFn: (from, to) => ({ t }) => ({
    layoutId: t < 0.5 ? from.layoutId : to.layoutId,
    activeIndex: blendNumber(from.activeIndex, to.activeIndex, t) ?? to.activeIndex,
    childCount: t < 0.5 ? from.childCount : to.childCount,
    loop: t < 0.5 ? from.loop : to.loop,
    style: blendStyle(from.style, to.style, t),
    showBase: t < 0.5 ? from.showBase : to.showBase,
    // ... remaining fields
  }),
};
```

Use `blendNumber` for numeric fields, `blendColor` for hex color strings. Discrete fields (booleans, enums, string IDs) flip at `t < 0.5`: use `from` in the first half, `to` in the second half.

Use `ElementTransitionSpec<T>` (batch-fill model) when you need to write state directly into each `SceneTrackTick` in a slice at compile time. This is used by elements where the transition behavior is complex or data-dependent (e.g., diagram node layout animations). Most simple elements use `FunctionalTransitionSpec`.

## render.ts — The Three.js Layer

`render.ts` is the only file that imports Three.js. It receives compiled state and applies it to the scene.

```typescript
import * as THREE from 'three';
import type { CarouselScrubberState, CarouselScrubberStyle } from './types';
import type { NVSCoordService } from '../../widget/types';

export type CarouselScrubberCache = {
  root: THREE.Group;
  base: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial> | null;
  lastGeoKey: string;
  lastStyleKey: string;
};

const CACHE_KEY = '__brewsite_carousel_scrubber';

export function getOrCreateCache(scene: THREE.Scene, widgetId: string): CarouselScrubberCache {
  const key = `${CACHE_KEY}_${widgetId}`;
  const existing = scene.userData[key] as CarouselScrubberCache | undefined;
  if (existing) return existing;

  const root = new THREE.Group();
  root.name = `CarouselScrubber_${widgetId}`;
  scene.add(root);

  const cache: CarouselScrubberCache = { root, base: null, lastGeoKey: '', lastStyleKey: '' };
  scene.userData[key] = cache;
  return cache;
}
```

The cache pattern stores Three.js objects on `scene.userData` keyed by widget ID. Use a geometry key string for change detection instead of tracking individual fields:

```typescript
const geoKey = computeGeometryKey(geoParams);
const needsRecreate = !cache.base || cache.lastGeoKey !== geoKey;
```

Resource management in `dispose()` is mandatory. Dispose every geometry, material, and texture. Remove objects from the scene. Delete the cache entry:

```typescript
export function disposeCarouselScrubber(scene: THREE.Scene, cache: CarouselScrubberCache, widgetId: string): void {
  if (cache.base) {
    cache.root.remove(cache.base);
    cache.base.geometry.dispose();
    cache.base.material.dispose();
  }
  scene.remove(cache.root);
  delete scene.userData[`${CACHE_KEY}_${widgetId}`];
}
```

Style values in `state.style` are already theme-resolved at compile time. Do not add render-time theme resolution in `render.ts` or `applyCarouselScrubber`. The compiled state IS the final style.

The coordinate mapping after `-pi/2` X rotation: Shape Y maps to World -Z. Positive shape Y values recede from the camera. For parabolic shapes, `k * x^2` is positive at the edges, which becomes negative world Z (away from camera) after rotation.

## Extracting Testable Pure Modules from render.ts

Split complex render logic into pure modules with zero Three.js imports. These are testable with plain unit tests (no scene, no WebGL):

```
geometry.ts    — Pure shape generators and geometry math (ShapePoint arrays, bevel radius, geometry key)
trayPosition.ts — Pure world-space position computation (TrayCoordService abstraction)
themeResolve.ts — Pure style merge (DSL override > theme > default precedence)
```

`geometry.ts` exports `generateEllipsePoints`, `generateParabolicPoints`, `computeBevelRadius`, `computeGeometryKey` — all pure functions that take numbers and return numbers or point arrays. Zero Three.js.

`trayPosition.ts` defines a `TrayCoordService` interface that abstracts `NVSCoordService`:

```typescript
export type TrayCoordService = {
  toWorld(nvsX: number, nvsY: number, nvsZ: number): readonly [number, number, number];
  toWorldSize(nvsW: number, nvsH: number): readonly [number, number];
  visibleWorldHeight: number;
};
```

Tests construct a plain object implementing this interface. No Three.js camera or renderer needed.

`render.ts` becomes a slim orchestrator that calls these pure functions and converts their output into Three.js objects. The pure modules hold the testable logic; `render.ts` holds the Three.js wiring.

## {Name}Widget.ts — The Widget Class

The widget class implements `IWidget` sub-interfaces and bridges compiled state to the render layer. Choose which interfaces to implement based on your element's needs:

| Interface | When to implement |
|---|---|
| `ISceneElement<TState>` | Always. Provides `defaultState`, `transitionSpec`, `DslComponent`. |
| `IRenderable<TState>` | When your element creates Three.js objects. Provides `initialize`, `apply`, `dispose`. |
| `ILoadable` | When your element needs async asset loading (GLTF models, textures). |
| `IAnimationController` | When your element runs per-tick animation (e.g., model playback). Opt into the per-frame tick loop. |
| `IVariableProvider` | When your element exposes reactive state to other widgets via the VariableStore. |
| `IDslComposite` | When your widget's DSL component has children that need custom compilation. |
| `ISceneLifecycle` | When your widget needs scene enter/leave callbacks to reset per-scene state or restart animations. |
| `ICameraActionTarget` | **Deprecated.** Camera action response. Migrate to ActionInputController's onUnknownAction callback. |
| `IRendererLifecycle` | When your widget manages GPU resources (loaders, render targets) tied to a specific WebGLRenderer instance. |
| `IRenderContributor` | When your widget contributes named 3D world positions or per-target color overrides after each rendered frame. |
| `IContainedRenderable` | When your widget's rootObject should be parented to a named attachment point on another widget's scene graph. |
| `IAttachmentHost` | When your widget exposes named Three.js Object3D attachment points for other widgets to parent into. |
| `IViewChild` | When your widget should receive view-level opacity from ViewWidget (e.g., carousel fade transitions). |
| `IInputDefaultProvider` | When your widget provides default input action bindings from its compiled state. |
| `ICameraFocusTarget` | When your widget accepts camera focus requests from peer widgets. Implemented by CameraWidget. |
| `ILightingOverride` | When your widget can temporarily suppress core scene lighting (e.g., diagram canvas with its own HDR lighting). |
| `IExtraRenderPass` | When your widget needs additional WebGL render passes after the main scene pass (e.g., scissored sub-viewport). |

The lifecycle: `initialize()` creates Three.js objects. `apply()` is called every frame with the compiled state. `dispose()` releases all resources.

`mergeSnapshot` controls what happens when your widget's scene exits. Return `{ ...prev, showBase: false }` to hide the element rather than keeping stale state visible:

```typescript
mergeSnapshot(
  prev: CarouselScrubberState | undefined,
  next: CarouselScrubberState | undefined,
): CarouselScrubberState | undefined {
  if (!prev && !next) return undefined;
  // Without this, the tray from a previous scene remains visible as a ghost.
  if (!next && prev) return { ...prev, showBase: false };
  if (!prev) return next;
  return { ...prev, ...next };
}
```

Dynamic widget creation via `reconcileCompiledTrack`: when DSL instances have unique IDs (like `{layoutId}__tray`), the widget does not exist at plugin registration time. Use `reconcileCompiledTrack` to scan the compiled track and lazily create widget instances:

```typescript
reconcileCompiledTrack(registry: WidgetRegistry, track: SceneTrack): void {
  for (const tick of track.ticks) {
    for (const [widgetId, state] of Object.entries(tick.state.widgets)) {
      if (isCarouselScrubberStateLike(state) && !registry.get(widgetId)) {
        registry.register(new CarouselScrubberWidget(widgetId));
      }
    }
  }
}
```

## Living Inside a View — composeBounds, composeZ, composeOpacity

If your element is spatial (positioned in NVS space), its NodeHandler must call `api.composeBounds(localBounds)` to transform local NVS coordinates into the parent View's coordinate space.

```typescript
// In your NodeHandler:
const localBounds: NVSRect = { x: props.x ?? 0, y: props.y ?? 0, w: props.w ?? 1, h: props.h ?? 1 };
const bounds = api.composeBounds(localBounds);
const z = api.composeZ(props.z ?? 0);
const opacity = api.composeOpacity(props.opacity ?? 1);

api.setWidgetState(widgetId, { ...state, bounds, z, opacity });
```

`composeBounds` maps `[0..1]` local coordinates into the parent View's content bounds. When the element is a direct Scene child (no parent View), `composeBounds` returns the local rect unchanged. When nested inside Views, each level chains its transformation.

`composeZ` accumulates Z offsets from nested Views. `composeOpacity` multiplies through nested opacity values (a child at 0.8 inside a view at 0.5 resolves to 0.4).

Without these calls, your element ignores the parent coordinate context. It renders at absolute viewport coordinates regardless of which View contains it.

## Root-Level vs View-Level Elements

Root-level (ambient) elements: `Camera`, `Lighting`, `Background`, `Floor`, `InputController`, `ProgressManager`, `CarouselScrubber`. These are always direct Scene children and manage their own world positioning. Register with `{ category: 'ambient' }`.

Spatial elements: `Chart`, `Diagram`, `Model`, `ImagePanel`, `Screen`. These must live inside Views when multiple spatial elements exist in a scene. Register with `{ category: 'spatial' }` (the default).

The auto-wrap rule: when a scene has exactly one spatial element and no explicit `<View>` wrappers, the compiler auto-wraps it in an implicit full-screen View with ID `__scene_root__`. This is transparent to the element — it receives composed bounds as if a `<View id="__scene_root__" x={0} y={0} w={1} h={1}>` were authored.

When a scene has multiple spatial elements without Views, the compiler emits an error and skips them. When spatial elements coexist with explicit Views, the compiler emits an error.

Your new element is spatial by default. If it should be ambient (like CarouselScrubber, which computes its own world position from carousel layout data), register it as `{ category: 'ambient' }`.

## Plugin Registration — Making Your Widget Available

Create a `WidgetPlugin` with `registerHandlers()`, `createWidgets()`, and optionally `reconcileCompiledTrack()`:

```typescript
import type { WidgetPlugin } from '../widget/WidgetPlugin';
import { registerCoreHandlers } from '../compiler/coreHandlers';
import { CarouselScrubberWidget, isCarouselScrubberStateLike } from '../elements/carousel-scrubber/CarouselScrubberWidget';

export function corePlugin(): WidgetPlugin {
  return {
    createWidgets() {
      // Return singleton widget instances for known ambient widgets
      return [lightingWidget, backgroundWidget, cameraWidget, /* ... */];
    },
    registerHandlers() {
      // Calls registerNode() for each DSL component
      registerCoreHandlers();
    },
    reconcileCompiledTrack(registry, track) {
      // Scan track for duck-typed state and lazily create widgets
      for (const tick of track.ticks) {
        for (const [widgetId, state] of Object.entries(tick.state.widgets)) {
          if (isCarouselScrubberStateLike(state) && !registry.get(widgetId)) {
            registry.register(new CarouselScrubberWidget(widgetId));
          }
        }
      }
    },
  };
}
```

`registerHandlers` calls `registerNode()` for each DSL component. `createWidgets` returns widget instances that are registered into the `WidgetRegistry`. `reconcileCompiledTrack` handles dynamic widgets whose IDs are only known after compilation. Pass your plugin to `<SceneEngine plugins={[corePlugin(), myPlugin()]}>`.

## Testing Each Layer

`compile.ts` tests: pass real inputs, assert real outputs. No mocks, no `vi.fn()`.

```typescript
it('merges DSL style over defaults', () => {
  const state = compileCarouselScrubber(
    { id: 'test', layoutId: 'layout', style: { baseColor: '#ff0000' } },
    0, 3, false,
  );
  expect(state.style.baseColor).toBe('#ff0000');
  expect(state.style.metalness).toBe(0.35); // default preserved
});
```

Pure geometry/position modules: test math with exact assertions.

```typescript
it('computes bevel radius clamped to 0.06', () => {
  expect(computeBevelRadius(1.0)).toBe(0.06);
  expect(computeBevelRadius(0.1)).toBe(0.025);
});
```

Theme resolution: test DSL override > theme > default precedence.

```typescript
it('DSL value overrides theme value', () => {
  const result = resolveThemedStyle(
    { ...DEFAULT, baseColor: '#custom' },
    { carouselTray: { color: '#theme' } } as SceneTheme,
  );
  expect(result.baseColor).toBe('#custom');
});
```

Transition spec: call the closure at `t=0`, `t=0.5`, `t=1`, assert interpolated values.

```typescript
it('interpolates opacity from 0 to target at t=0.5', () => {
  const fn = spec.enterFn({ ...defaultState, style: { ...defaultStyle, baseOpacity: 0.8 } });
  const result = fn({ t: 0.5 });
  expect(result.style.baseOpacity).toBeCloseTo(0.4);
});
```

Widget tests: construct, call `apply()` with real state, assert observable effects on Three.js objects. Tests live in `__tests__/` co-located with the source.

## The CarouselTray as a Complete Reference Implementation

The carousel scrubber at `packages/core/src/elements/carousel-scrubber/` is the canonical example of the element module pattern after restructuring. File listing:

| File | Lines | Responsibility |
|---|---|---|
| `types.ts` | 79 | State and style type contracts (zero imports) |
| `dsl.tsx` | 52 | Null-returning DSL stub component and props type |
| `compile.ts` | 151 | Default constants, compile function, transition spec |
| `render.ts` | 481 | Three.js cache, geometry creation, frame application, dispose |
| `geometry.ts` | 246 | Pure shape generators extracted from render.ts (zero Three.js) |
| `trayPosition.ts` | 107 | Pure world-space position math with TrayCoordService abstraction |
| `themeResolve.ts` | 60 | Pure theme merge (DSL > theme > default precedence) |
| `surfaceTexture.ts` | 324 | Procedural normal map generation (render-adjacent, uses Canvas 2D) |
| `CarouselScrubberWidget.ts` | 155 | Widget class, NodeHandler, duck-type guard, mergeSnapshot |
| `index.ts` | 16 | Re-exports only |

Theme is resolved at compile time in `viewHandlers.ts`, not at render time. Pure math is extracted into `geometry.ts` and `trayPosition.ts` for testability. The widget uses `reconcileCompiledTrack` for dynamic creation because each carousel layout produces a unique widget ID.
