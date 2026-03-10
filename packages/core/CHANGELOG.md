# @brewsite/core Changelog

## [2.0.0] — 2026-03-09

### Breaking Changes

This release introduces the Composable Player Architecture. All v1 player components and hooks
that dealt with scroll/input configuration on `EngineProvider` have been removed in favour of
explicit composable primitives. See [MIGRATION.md](./MIGRATION.md) for upgrade instructions.

#### Deleted exports (no compatibility shims)

- `EngineProvider` — replaced by `SceneEngine`
- `EngineInputRegion` — replaced by `ScrollStage` + `ScrollInput` (scroll mode) or `SceneReel` (embedded mode)
- `ScrollCaptureSection` — replaced by `ScrollStage`
- `useEngineScroll` / `UseEngineScrollOptions` / `UseEngineScrollResult` — internalized in `ScrollInput`
- `useEngineInput` / `UseEngineInputOptions` / `UseEngineInputResult` — internalized in input components
- `InputModePolicy` type — no replacement; input mode is determined by which components are rendered
- `ScrollSource` type — replaced by `IScrollSource` / `ScrollSourceProp`
- `useSceneEngineState(id)` — replaced by `useEngineState(id)` (unified hook)
- `engine.scrollToProgress(p)` — replaced by `engine.setProgress(p)` / `useGoToScene()`

#### `useEngineScrubber` — options argument removed

The options object (`{ scrollToProgress, getGlobalProgress }`) is removed. The hook now reads
engine context directly. See MIGRATION.md for the upgrade path.

### New Features

- `SceneEngine` — pure context provider replacing `EngineProvider`
- `ScrollStage` — DOM layout helper for the full-page sticky-canvas pattern
- `BackgroundLayer` — wires `engine.setBackgroundRef` to a positioned div
- `SceneReel` — convenience wrapper for embedded/docs/slides use cases
- `ScrollInput` — scroll-driven progress (inertia, window, element, `IScrollSource`)
- `TimeInput` — wall-clock auto-advance
- `KeyboardInput` — arrow key + space scene navigation
- `PointerInput` — click-to-advance and hover-to-scrub
- `ControlledInput` — externally controlled progress (highest priority)
- `useGoToScene()` — programmatic scene navigation with scroll source sync
- `useEngineState(id?)` — unified hook (local context or global registry)
- `useNativeScrollSource()` — hidden native scroll container as `IScrollSource`
- `IScrollSource` / `ScrollSourceProp` — custom scroll source interface
- `SceneCanvas engineId` prop — allows `SceneCanvas` outside the engine's React subtree
- Plugin inheritance via `PluginInheritanceContext` — zero-scene root engine for app-level hoisting

---

## [Unreleased] — Pre-Release API Hardening

This release completes the API surface cleanup required before `@brewsite/core` is published publicly. It removes several legacy abstractions that were present from early development and replaces them with composable primitives. All removals have direct migration paths described below.

---

### Breaking Changes

#### 9. Five `TRANSITION_*` constant exports removed; `exitStart` and named transitions added

Five named transition window constants have been removed from `@brewsite/core`. They were unused in the known codebase but are breaking changes by semver definition. The `<Scene>` transition API has been redesigned with a simpler, author-friendly model.

**Removed exports:**
- `TRANSITION_DEFAULT`
- `TRANSITION_CROSSFADE`
- `TRANSITION_SEQUENTIAL`
- `TRANSITION_EXIT_FIRST`
- `TRANSITION_CUT`

**Added exports:**
- `TransitionName` — `'dissolve' | 'crossfade'`
- `SceneTransitionProp` — `TransitionName | TransitionWindow`
- `resolveSceneTransition(prop, exitStart?)` — pure resolver function

**`<Scene>` prop changes:**

The `transition` prop now accepts a `TransitionName` string or raw `TransitionWindow`. A new `exitStart` scalar prop controls the through-black timing for dissolve transitions. A TypeScript discriminated union enforces that `exitStart` is only valid with `"dissolve"` (or when `transition` is absent).

```tsx
// Before — old raw window pattern required internal coordinate knowledge
const DISSOLVE_TO_BLACK = { exit: [0.9, 0.95] as [number, number], enter: [0.95, 1.0] as [number, number] };
<Scene id="hero" transition={DISSOLVE_TO_BLACK} />

// After — express the same timing with a single scalar
<Scene id="hero" exitStart={0.9} />

// Crossfade: both scenes simultaneously visible across the full transition block
<Scene id="features" transition="crossfade" />

// Raw escape hatch still available for custom overlap behavior
<Scene id="charts" transition={{ exit: [0.7, 1.0], enter: [0.0, 0.3] }} />
```

**Default behavior change:** Scenes with no `transition` prop previously used `exit: [0, 0.5] / enter: [0.5, 1.0]` — which fades the outgoing scene from the very first frame. The new default is `"dissolve"` with `exitStart=0.8`, producing `exit: [0.8, 0.9] / enter: [0.9, 1.0]`. Scene content is now visible for 80% of the transition block before fading. This is a visual improvement but is an observable breaking change.

**Migration guide:**

| Old pattern | New pattern |
|---|---|
| `transition={TRANSITION_DEFAULT}` or no `transition` | Remove the prop (new default is visually improved dissolve) |
| `transition={TRANSITION_CROSSFADE}` | `transition="crossfade"` |
| `transition={TRANSITION_SEQUENTIAL}` | `transition={{ exit: [0, 0.4], enter: [0.6, 1] }}` (raw window) |
| `transition={TRANSITION_EXIT_FIRST}` | `transition={{ exit: [0, 0.6], enter: [0.4, 1] }}` (raw window) |
| `transition={TRANSITION_CUT}` | `<ProgressManager scrollUnits={50} />` for near-instant transitions |
| Local `DISSOLVE_TO_BLACK = { exit: [0.9, 0.95], enter: [0.95, 1.0] }` | `exitStart={0.9}` |

**`resolveSceneTransition` math reference:**
```typescript
// 'dissolve' with exitStart=0.9:
// eos=0.9, mid=(0.9+1.0)/2=0.95
// → { exit: [0.9, 0.95], enter: [0.95, 1.0] }

// 'crossfade' (equal-blend, opacity sums to 1 at every frame):
// → { exit: [0, 1], enter: [0, 1] }
```

---

#### 1. `ScenePlayer` removed

`ScenePlayer` and `ScenePlayerProps` have been deleted. The component conflated engine configuration, page layout decisions, and dev tooling into a single prop surface, making it impossible to support non-trivial layouts without forking or re-implementing.

**Before:**
```tsx
import { ScenePlayer, corePlugin } from '@brewsite/core';
import { modelPlugin } from '@brewsite/model';

export default function Page() {
  return (
    <ScenePlayer
      manifestUrl="/manifest.json"
      plugins={[corePlugin(), modelPlugin(manifest)]}
      quality="balanced"
      pixelsPerScene={800}
      onSceneChange={handleSceneChange}
      placeholder={<Spinner />}
    >
      <Scene id="intro">...</Scene>
      <Scene id="detail">...</Scene>
    </ScenePlayer>
  );
}
```

**After:**
```tsx
import {
  EngineProvider, EngineGate, EngineInputRegion,
  SceneCanvas, EngineOverlayHost, corePlugin,
} from '@brewsite/core';
import { modelPlugin } from '@brewsite/model';

export default function Page() {
  const plugins = useMemo(
    () => [corePlugin({ onSceneChange: handleSceneChange }), modelPlugin(manifest)],
    [handleSceneChange],
  );

  return (
    <EngineProvider
      id="my-player"
      manifestUrl="/manifest.json"
      plugins={plugins}
      quality="balanced"
      pixelsPerScene={800}
    >
      <Scene id="intro">...</Scene>
      <Scene id="detail">...</Scene>

      <EngineGate placeholder={<Spinner />}>
        <EngineInputRegion>
          <SceneCanvas />
          <EngineOverlayHost />
        </EngineInputRegion>
      </EngineGate>
    </EngineProvider>
  );
}
```

`EngineInputRegion` and `SceneCanvas` read engine state from `EngineContext` internally — no `engine` prop is required or accepted.

---

#### 2. `EngineScrollRegion` removed

`EngineScrollRegion` and `EngineScrollRegionProps` have been deleted.

> **Migration is NOT 1:1.** `EngineScrollRegion` rendered the Three.js canvas inline via `engine.setCanvasRef`. `EngineInputRegion` does **not** render a canvas — that is `SceneCanvas`'s responsibility. Every migration site must add `<SceneCanvas />` as an explicit child.

**Before:**
```tsx
import { EngineScrollRegion } from '@brewsite/core';

<EngineScrollRegion engine={engine} className={cls}>
  <MyOverlay />
</EngineScrollRegion>
```

**After:**
```tsx
import { EngineInputRegion, SceneCanvas } from '@brewsite/core';

<EngineInputRegion className={cls}>
  <SceneCanvas />
  <MyOverlay />
</EngineInputRegion>
```

`EngineInputRegion` reads engine state from `EngineContext` internally — no `engine` prop required.

---

#### 3. `createDefaultWidgetRegistry()` removed

`createDefaultWidgetRegistry` and `DefaultWidgetRegistryOptions` have been deleted. The plugin system (`corePlugin()` / `modelPlugin()`) is the canonical way to configure the engine.

**Before:**
```tsx
import { createDefaultWidgetRegistry } from '@brewsite/core';

<EngineProvider
  manifestUrl="/manifest.json"
  widgetSetup={(manifest) => createDefaultWidgetRegistry(manifest)}
>
```

or

```tsx
const registry = createDefaultWidgetRegistry(manifest);
```

**After:**
```tsx
import { corePlugin } from '@brewsite/core';
import { modelPlugin } from '@brewsite/model';

<EngineProvider
  manifestUrl="/manifest.json"
  plugins={[corePlugin(), modelPlugin(manifest)]}
>
```

`corePlugin()` registers the core widgets (Lighting, Background, Environment, Floor, Camera, SceneMeta). `modelPlugin()` from `@brewsite/model` registers the model and label widgets. Pass both together to replicate the previous `createDefaultWidgetRegistry` behavior.

---

#### 4. `widgetSetup` prop removed from `EngineProvider`

The `widgetSetup` prop on `EngineProvider` has been removed. Use the `plugins` prop instead.

**Before:**
```tsx
<EngineProvider
  manifestUrl="/manifest.json"
  widgetSetup={(manifest: AssetManifest) => createDefaultWidgetRegistry(manifest)}
>
```

**After:**
```tsx
<EngineProvider
  manifestUrl="/manifest.json"
  plugins={[corePlugin(), modelPlugin(manifest)]}
>
```

If your `widgetSetup` function used `manifest` to conditionally configure model loading, pass `manifest` directly to `modelPlugin(manifest)` instead.

---

#### 5. `onSceneChange` prop removed from `EngineProvider`

The `onSceneChange` prop on `EngineProvider` has been removed. Pass it to `corePlugin()` instead.

> **Stability requirement:** The `plugins` array prop must be a stable reference across renders. An unstable array recreates the widget registry on every render, restarting asset loading. Wrap in `useMemo` or define at module scope.

**Before:**
```tsx
<EngineProvider
  manifestUrl="/manifest.json"
  plugins={[corePlugin(), modelPlugin(manifest)]}
  onSceneChange={handleSceneChange}
>
```

**After:**
```tsx
// Stable via useMemo:
const plugins = useMemo(
  () => [corePlugin({ onSceneChange: handleSceneChange }), modelPlugin(manifest)],
  [handleSceneChange],
);

<EngineProvider
  manifestUrl="/manifest.json"
  plugins={plugins}
>
```

If `handleSceneChange` is defined inline, wrap it in `useCallback` first to ensure reference stability.

---

#### 6. `nextSceneTrackCacheToken()` removed

`nextSceneTrackCacheToken` has been removed from the public API. It was a trivial helper (`(prev) => prev + 1`) that consumers can implement inline.

**Before:**
```tsx
import { nextSceneTrackCacheToken } from '@brewsite/core';

const [token, setToken] = useState(0);
const refresh = () => setToken(nextSceneTrackCacheToken);
```

**After:**
```tsx
const [token, setToken] = useState(0);
const refresh = () => setToken(t => t + 1);

<EngineProvider invalidateCacheToken={token} ...>
```

---

#### 7. `compiler/primitives/` import paths removed

The barrel files under `@brewsite/core/compiler/primitives/` have been deleted. These were dead code — the actual elements (`Lighting`, `Background`, `Camera`, etc.) are already exported from the top-level `@brewsite/core` package.

**Before:**
```tsx
import { Lighting, Ambient } from '@brewsite/core/compiler/primitives/Lighting';
import { Background } from '@brewsite/core/compiler/primitives/Background';
import { Camera } from '@brewsite/core/compiler/primitives/Camera';
```

**After:**
```tsx
import { Lighting, Ambient, Background, Camera } from '@brewsite/core';
```

---

#### 8. `SceneProgressMapper` no longer exported

`SceneProgressMapper` is an internal coordinate-mapping utility used by the engine. It has been removed from the public API. It was never intended for external use. If you imported it, you should not have been depending on it — contact the team if you have a use case that requires access to progress mapping internals.

---

### New Additions

#### `EngineGate`

A new component that gates rendering until the engine has produced its first frame. Use it to replace `ScenePlayer`'s built-in `placeholder` prop behavior.

```tsx
import { EngineGate } from '@brewsite/core';

<EngineProvider ...>
  <EngineGate placeholder={<Spinner />}>
    <EngineInputRegion>
      <SceneCanvas />
      <EngineOverlayHost />
    </EngineInputRegion>
  </EngineGate>
</EngineProvider>
```

`EngineGate` renders `placeholder` (or nothing if omitted) until `tickIndex >= 0`. Must be placed inside an `<EngineProvider>` tree.

---

#### `ISceneLifecycle`

A new optional widget interface for responding to scene transitions at runtime.

```typescript
import type { ISceneLifecycle } from '@brewsite/core';

class MyWidget implements IRenderable<MyState>, ISceneLifecycle {
  onSceneExit(sceneId: string, sceneIndex: number): void {
    this.accumulator = 0;
  }
  onSceneEnter(sceneId: string, sceneIndex: number): void {
    this.startTime = Date.now();
  }
}
```

Both methods fire synchronously during the tick loop at scene boundaries. `onSceneExit` fires before `onSceneEnter`. Errors in lifecycle hooks are logged as warnings but do not blacklist the widget from rendering.

---

#### `IHasCustomDslHandler` and `hasCustomDslHandler`

A typed interface and type guard for widgets that override default DSL node routing. Replaces the previous pattern of unsafe symbol casts.

```typescript
import { IHasCustomDslHandler, CUSTOM_NODE_HANDLER, hasCustomDslHandler } from '@brewsite/core';

class CameraWidget implements ISceneElement<SceneCamera>, IHasCustomDslHandler {
  readonly [CUSTOM_NODE_HANDLER]: NodeHandler = (node, api, helpers) => {
    // custom prop transformation
  };
}

// Type guard usage:
if (hasCustomDslHandler(widget)) {
  widget[CUSTOM_NODE_HANDLER](node, api, helpers);
}
```

---

#### `isSceneLifecycle`

Type guard for `ISceneLifecycle`:

```typescript
import { isSceneLifecycle } from '@brewsite/core';

if (isSceneLifecycle(widget)) {
  widget.onSceneEnter(sceneId, sceneIndex);
}
```

---

#### `AssetManifest` (now public)

`AssetManifest` is now formally exported from `@brewsite/core`. Previously it was accessible but not explicitly documented as a public type.

```typescript
import type { AssetManifest } from '@brewsite/core';
```

The canonical definition lives in `widget/types.ts`. `@brewsite/model` extends this type with model-specific fields.

---

#### `IRenderable<TState, TExtra>` — type parameter added

`IRenderable` now accepts a second generic parameter `TExtra` (default `unknown`) that types the `extra` field in `WidgetRenderContext`. This is an additive, non-breaking change — existing `IRenderable<TState>` implementations are unaffected.

**Before:**
```typescript
class MyWidget implements IRenderable<MyState> {
  apply(state: MyState, ctx: WidgetRenderContext): void {
    const extra = ctx.extra as MyExtra; // manual cast required
  }
}
```

**After (optional upgrade):**
```typescript
class MyWidget implements IRenderable<MyState, MyExtra> {
  apply(state: MyState, ctx: WidgetRenderContext<MyExtra>): void {
    const extra = ctx.extra; // typed as MyExtra — no cast needed
  }
}
```

---

### Internal Changes (no consumer impact)

- `IDENTITY_FN` moved from `player/SceneProgressMapper.ts` to `compiler/identityFn.ts` to fix a layer boundary violation. `SceneProgressMapper` re-exports it for backwards compatibility at the internal import level.
- `applyErroredWidgets` are now cleared on scene change, allowing widgets that fail during `apply()` to recover when a new scene starts. Widgets that fail during `load()` or `initialize()` remain permanently blacklisted for the session.
- `clearCache()` no longer called on `EngineProvider` unmount — the global scene track cache is now shared safely across multiple engine instances.
- `CameraControlsDriver` split from `elements/camera/render.ts` into its own file for maintainability.
- `SceneMetaWidget` is no longer wired directly from `EngineProvider`. Scene change callbacks must flow through `corePlugin({ onSceneChange })`.
