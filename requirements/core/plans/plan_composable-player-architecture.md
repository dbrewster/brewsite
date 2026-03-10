---
title: "Composable Player Architecture v2 — Implementation Plan"
doc_type: plan
owner: Toolkit Architect
status: ready-for-implementation
updated: 2026-03-09
---

## 1. Overview

This plan implements the Composable Player Architecture v2 as specified in
`requirements/core/notes/prd_composable-player-architecture.md`. It is a **MAJOR version
(v2.0.0)** change to `@brewsite/core`. The compiler, widget SDK, element modules, and all
sub-packages (`@brewsite/diagram`, `@brewsite/model`, `@brewsite/charts`) are **unaffected**.

### What this plan implements

New components:
- `SceneEngine` — replaces `EngineProvider`
- `ScrollStage` — replaces `EngineInputRegion` (scroll mode) + `ScrollCaptureSection`
- `BackgroundLayer` — new minimal background wiring component
- `ScrollInput` — new input component (scroll/inertia progress driving)
- `TimeInput` — new input component (time-based auto-advance)
- `KeyboardInput` — new input component (keyboard scene navigation)
- `PointerInput` — new input component (click/hover progress driving)
- `ControlledInput` — new input component (externally controlled progress)
- `SceneReel` — new convenience wrapper for embedded/docs/slides use cases

New hooks:
- `useNativeScrollSource` — creates a hidden native scroll region returning `IScrollSource`
- `useGoToScene` — programmatic scene navigation with optional scroll source sync
- `useEngineState(id?)` — unified replacement for `useEngineState()` + `useSceneEngineState(id)`

New shared internal hooks (not exported):
- `usePauseWhenHidden` — shared `IntersectionObserver` logic for input component visibility gating

New contexts (internal):
- `PluginInheritanceContext` — enables `SceneEngine` zero-scene plugin inheritance
- `ScrollRegionContext` — `ScrollStage` → `ScrollInput source='window'` communication
- `ControlledProgressContext` — `ControlledInput` → `KeyboardInput` onChange wiring

Modified files:
- `packages/core/src/player/useSceneEngine.ts` — remove scroll/input props; add new engine context methods
- `packages/core/src/player/engineTypes.ts` — update `UseSceneEngineOptions`, remove `InputModePolicy`/`ScrollSource`
- `packages/core/src/player/SceneCanvas.tsx` — add `engineId` prop; minor style cleanup
- `packages/core/src/player/EngineContext.tsx` — update error message
- `packages/core/src/player/EngineStateContext.ts` — update error message
- `packages/core/src/player/useEngineScrubber.ts` — update options to use engine context directly
- `packages/core/src/player/index.ts` — update all exports
- `packages/core/src/player/ScenePlayerRegistry.ts` — update warning messages from "EngineProvider" to "SceneEngine"
- `packages/core/MIGRATION.md` — new; documents v1→v2 translation

Deleted files:
- `packages/core/src/player/EngineProvider.tsx`
- `packages/core/src/player/EngineInputRegion.tsx`
- `packages/core/src/player/ScrollCaptureSection.tsx`
- `packages/core/src/player/useEngineScroll.ts`
- `packages/core/src/player/useEngineInput.ts`
- `packages/core/src/player/effectiveInputSpec.ts`
- `packages/core/src/player/__tests__/useEngineScroll.test.tsx`
- `packages/core/src/player/__tests__/useEngineInput.test.tsx`
- `packages/core/src/player/__tests__/effectiveInputSpec.test.ts`

App migrations (no package boundary changes):
- `apps/examples/src/` — every `*Page.tsx` file using `EngineProvider`/`EngineInputRegion`
- `apps/website/src/landing/LandingPage.tsx` and inner layout
- `apps/docs/src/demos/shared/DemoScene.tsx` and all demo files

---

## 2. New Type Definitions

### 2.1 `IScrollSource` (exported)

File: `packages/core/src/player/scrollSourceTypes.ts`

```typescript
// scrollSourceTypes.ts — IScrollSource interface and ScrollSourceProp union.

import type { RefObject } from 'react';

/**
 * Extension point for custom scroll position providers (Lenis, Virtual Scroll,
 * hidden native scroll regions, etc.). Implement this interface and pass it to
 * ScrollInput.source to take full control over progress production and programmatic scroll.
 */
export interface IScrollSource {
  /**
   * Subscribe to raw progress updates [0, 1].
   * Called whenever the scroll position changes.
   * Must return an unsubscribe function; called on cleanup.
   */
  subscribe(onProgress: (rawProgress: number) => void): () => void;

  /**
   * Optional. Programmatically set the scroll position by raw progress [0, 1].
   * Called by useGoToScene() when this source is active.
   * If omitted, programmatic navigation is a no-op for this source.
   */
  scrollTo?(rawProgress: number): void;
}

/**
 * The source prop accepted by ScrollInput.
 *
 * 'inertia'      — Spring-decay velocity integrator on wheel events. No DOM scroll region.
 *                  Default for SceneReel / embedded contexts.
 * 'window'       — Reads window.scrollY. Must be paired with ScrollStage.
 * { elementRef } — Reads element.scrollTop. Must be paired with ScrollStage.
 * IScrollSource  — Custom implementation; full control over progress and programmatic scroll.
 */
export type ScrollSourceProp =
  | 'inertia'
  | 'window'
  | { elementRef: RefObject<HTMLElement | null> }
  | IScrollSource;
```

### 2.2 `PauseWhenHiddenOptions`

Defined in `packages/core/src/player/usePauseWhenHidden.ts` (internal hook, not exported):

```typescript
export type PauseWhenHiddenOptions = {
  /** Fraction of width that must be visible. Default: 0.0 */
  x?: number;
  /** Fraction of height that must be visible. Default: 0.8 */
  y?: number;
};
```

### 2.3 `UseNativeScrollSourceOptions` + `UseNativeScrollSourceResult`

File: `packages/core/src/player/useNativeScrollSource.ts`

```typescript
export interface UseNativeScrollSourceOptions {
  /** Total scroll distance in pixels. Update when scene count or scroll units change. */
  heightPx: number;
}

export interface UseNativeScrollSourceResult {
  /** Pass to ScrollInput source prop. */
  source: IScrollSource;
  /** Attach to the hidden scroll container div (consumers render it off-screen). */
  ref: RefObject<HTMLDivElement | null>;
}
```

### 2.4 Updated `UseSceneEngineOptions` (internal)

`UseSceneEngineOptions` loses all scroll/input-related fields. New shape:

```typescript
export type UseSceneEngineOptions = {
  scenes: InternalSceneSpec[];
  widgetRegistry: WidgetRegistry;
  manifest: AssetManifest | null;
  timingProfile?: EngineTimingProfile;
  primaryCameraId?: string;
  primaryCanvasActionTargetId?: string;
  maxAnimBoostPerFrame?: number;
  cameraInteractionDefaults?: CameraInteractionDefaults;
  invalidateCacheToken?: number | string;
  onReady?: () => void;
  onError?: (error: Error) => void;
  onWidgetError?: (widgetId: string, error: Error) => void;
  onCompileWarning?: (warnings: CompileWarning[]) => void;
};
```

Removed fields (vs. current): `scrollSource`, `scrollHeightMode`, `pixelsPerScrollUnit`,
`pixelsPerScene`, `scrollHeightPx`, `inputModePolicy`, `inputMap`, `controlledProgress`,
`onControlledProgressChange`, `enableKeyboardInControlledMode`, `controlledInputMap`.

### 2.5 Updated `UseSceneEngineResult` (internal / context value)

`UseSceneEngineResult` gains new methods and drops scroll-related fields:

> **⚠ Naming convention for progress-write methods — read before implementing any input component:**
>
> `setRawProgress(raw)` takes a **raw scroll-space progress value** [0, 1] and passes it
> through the `SceneProgressMapper` if one exists. Use this for scroll-based inputs
> (`ScrollInput source='window'` and `source={elementRef}`) where the input produces a raw
> scroll fraction that the mapper must remap to engine progress.
>
> `setProgress(mapped)` takes a value already in **engine progress space** [0, 1] and
> bypasses the mapper entirely. Use this for all non-scroll inputs: inertia, keyboard, time,
> pointer, and controlled. These inputs work directly in engine progress space — no mapping
> is needed because they are not derived from a scroll position.
>
> The naming reflects the **caller's perspective**: scroll inputs provide a raw scroll
> position; all other inputs provide engine progress directly. Wiring them backwards
> (using `setRawProgress` for inertia, or `setProgress` for window-scroll) will produce
> silent incorrect behavior in `scroll-units` mode where the mapper is non-identity.

```typescript
export type UseSceneEngineResult = {
  // ── Frame state (unchanged) ──────────────────────────────────────────────────
  frameState: EngineFrameState;
  progress: number;

  // ── Asset state (unchanged) ──────────────────────────────────────────────────
  variableStore: VariableStore;

  // ── Canvas wiring (unchanged) ────────────────────────────────────────────────
  setCanvasRef(el: HTMLCanvasElement | null): void;
  setViewportSize(w: number, h: number): void;
  setBackgroundRef: RefObject<HTMLDivElement | null>;

  // ── Progress control (MODIFIED: new methods added) ───────────────────────────
  // See naming convention note above before using any of these methods.
  /**
   * Write raw (pre-mapper) scroll-space progress [0, 1].
   * Used ONLY by ScrollInput source='window' and source={elementRef}.
   * Goes through SceneProgressMapper if one exists (scroll-units mode).
   * DO NOT use this for inertia, keyboard, time, pointer, or controlled inputs.
   */
  setRawProgress(raw: number): void;

  /**
   * NEW: Write post-mapper engine progress [0, 1] directly, bypassing the
   * SceneProgressMapper. Used by ControlledInput, inertia mode, keyboard, time,
   * and pointer inputs that operate in engine progress space rather than scroll space.
   */
  setProgress(mapped: number): void;

  /**
   * NEW: Advance engine progress by a signed delta in engine progress space [−1..+1].
   * Clamps result to [0, 1]. Used by TimeInput and keyboard step navigation.
   * Equivalent to setProgress(currentProgress + delta).
   */
  advanceProgress(delta: number): void;

  // ── Compiled scene info (NEW) ─────────────────────────────────────────────────
  /**
   * The compiled SceneTrack. Null until the first compile completes.
   * ScrollStage reads this for scroll height computation.
   */
  sceneTrack: SceneTrack | null;

  /**
   * Number of compiled scenes. 0 until compile completes.
   */
  sceneCount: number;

  /**
   * Ordered list of compiled scenes (id + index). Used by sidebar nav and useGoToScene.
   * Empty array until compile completes.
   */
  compiledScenes: ReadonlyArray<{ id: string; index: number }>;

  /**
   * The SceneProgressMapper derived from the compiled track's progressProfile.
   * Null when all scenes have equal scroll weight (identity mapping).
   * Used by ScrollInput source='window' and useGoToScene for scroll navigation.
   */
  progressMapper: SceneProgressMapper | null;

  // ── Global registry (unchanged) ──────────────────────────────────────────────
  debug?: {
    assetsReady: boolean;
    viewport: { width: number; height: number };
  };

  // ── REMOVED fields (vs. current) ─────────────────────────────────────────────
  // scrollRegionRef — ScrollStage owns this now
  // scrollRegionHeightPx — ScrollStage computes this now
  // inputMode — no longer needed; determined by which input components are present
  // scrollToProgress — deprecated; use engine.setProgress() or useGoToScene()
};
```

### 2.6 `ScrollRegionContextValue` (internal)

```typescript
// Internal: provided by ScrollStage, consumed by ScrollInput source='window'.
type ScrollRegionContextValue = {
  readonly containerRef: RefObject<HTMLDivElement | null>;
  readonly scrollHeightPx: number;
};
```

### 2.7 `ControlledProgressContextValue` (internal)

```typescript
// Internal: provided by ControlledInput, consumed by KeyboardInput.
type ControlledProgressContextValue = {
  readonly onChange: ((progress: number) => void) | undefined;
};
```

### 2.8 `ScrollNavigatorContextValue` (internal)

```typescript
// Internal: provided by ScrollInput when source='window' or source={elementRef}.
// Consumed by useGoToScene() to perform scroll-position sync on programmatic navigation.
type ScrollNavigatorContextValue = {
  readonly scrollTo: (rawProgress: number) => void;
};
```

### 2.9 Cleaned-up `engineTypes.ts`

```typescript
// engineTypes.ts — after cleanup (removes InputModePolicy, ScrollSource)

import type { ReactElement } from 'react';
import type { SceneTrackTick } from '../compiler/sceneTrackTypes';

export type EngineFrameState = {
  tickIndex: number;
  progress: number;
  sceneId: string;
  sceneIndex: number;
  sceneProgress: number;
  tick?: SceneTrackTick | null;
};

/** @deprecated Use EngineFrameState. Will be removed in v3. */
export type EngineState = EngineFrameState;

export type { CameraInteractionDefaults } from '../elements/camera/types';

export type InternalSceneSpec = {
  readonly sceneKey: string;
  readonly contentKey: string;
  readonly element: ReactElement;
};

export type EngineTimingProfile = {
  blockSize?: number;
  qualityPreset?: 'performance' | 'balanced' | 'high';
  fpsCap?: number;
};
```

`InputModePolicy` and `ScrollSource` types are **deleted**. No replacement exports — these
concepts move into the input components themselves.

---

## 3. New Components

### 3.1 `SceneEngine` (replaces `EngineProvider`)

**File:** `packages/core/src/player/SceneEngine.tsx`

**Responsibility:** Pure React context provider with zero DOM output. Owns plugin wiring,
scene compilation, RAF loop, and context provision. Replaces `EngineProvider` completely.

**Prop interface:**

```typescript
export interface SceneEngineProps {
  /**
   * Registers this engine in the global registry for useSceneEngineState(id) /
   * useSceneRuntime(id). Optional; omit for anonymous engines.
   */
  id?: string;

  /**
   * Widget plugins. Required unless a parent SceneEngine (zero-scene mode)
   * already provides plugins via PluginInheritanceContext.
   * When omitted, inherits from the nearest ancestor SceneEngine context.
   * When both own and inherited are present, own props wins.
   */
  plugins?: WidgetPlugin[];

  timingProfile?: EngineTimingProfile;

  /** Widget id of the primary scene camera. */
  primaryCameraId?: string;

  /** Widget id of the canvas that receives action-based input (orbit, dolly, focus). */
  primaryCanvasActionTargetId?: string;

  cameraInteractionDefaults?: CameraInteractionDefaults;

  /**
   * Increment to force SceneTrack recompilation when DSL hasn't changed
   * structurally but content has (e.g., dynamic asset URLs).
   */
  invalidateCacheToken?: number | string;

  /** Cap on animation-seconds that may advance in a single frame. Default: 2. */
  maxAnimBoostPerFrame?: number;

  /** Scene theme token set for cross-package visual styling. */
  sceneTheme?: SceneTheme;

  onReady?: () => void;
  onError?: (error: Error) => void;
  onWidgetError?: (widgetId: string, error: Error) => void;
  onCompileWarning?: (warnings: CompileWarning[]) => void;

  /**
   * All children — <Scene> declarations, input components, layout, overlay hosts.
   * Zero <Scene> children is valid (config-only / plugin-hoisting mode).
   */
  children: ReactNode;
}
```

**Internal state:**

```typescript
const [scenes, setScenes] = useState<InternalSceneSpec[]>([]);
const [manifest, setManifest] = useState<AssetManifest | null>(null);
// Registered plugin array (resolved from props or inherited context)
const resolvedPlugins: WidgetPlugin[] = /* see plugin resolution below */;
```

**Plugin resolution logic:**

```typescript
// Read inherited plugins from nearest ancestor SceneEngine
const inheritedPlugins = useContext(PluginInheritanceContext);

const resolvedPlugins = useMemo(() => {
  if (props.plugins) return props.plugins; // own prop wins
  if (inheritedPlugins) return inheritedPlugins; // inherit from ancestor
  console.error(
    '[BrewSite] <SceneEngine> requires a `plugins` prop or a parent <SceneEngine> ' +
    'providing plugins via zero-scene mode. Pass plugins={[corePlugin(), ...]}.',
  );
  return [];
}, [props.plugins, inheritedPlugins]);
```

**Registry wiring:** Same scene registration mechanism as `EngineProvider` today.
`SceneRegistrationContext` is provided. Scenes register via their `<Scene>` component's
`useEffect`. On each render, registered elements are diffed by serialized JSX key.

**`useSceneEngine` invocation:**

```typescript
const engine = useSceneEngine({
  scenes,
  widgetRegistry,
  manifest,
  timingProfile: props.timingProfile,
  primaryCameraId: props.primaryCameraId,
  primaryCanvasActionTargetId: props.primaryCanvasActionTargetId,
  maxAnimBoostPerFrame: props.maxAnimBoostPerFrame,
  cameraInteractionDefaults: props.cameraInteractionDefaults,
  invalidateCacheToken: props.invalidateCacheToken,
  onReady: props.onReady,
  onError: props.onError,
  onWidgetError: props.onWidgetError,
  onCompileWarning: props.onCompileWarning,
});
```

**Global registry push:** Same as `EngineProvider.tsx` today (push to `ScenePlayerRegistry`
on every state change via `setSceneRuntimeState` and `setEngineSnapshot`). No change to this
pattern.

**Context provision order** (outermost to innermost):

```tsx
<ThemeContext.Provider value={props.sceneTheme ?? null}>
  <SceneRegistrationContext.Provider value={registrationContextValue}>
    <VariableStoreContext.Provider value={engine.variableStore}>
      <PluginInheritanceContext.Provider value={resolvedPlugins}>
        {/* Plugin wrapProvider chain (innermost first, outermost last) */}
        <EngineStateContext.Provider value={engineState}>
          <EngineContext.Provider value={engine}>
            {props.children}
          </EngineContext.Provider>
        </EngineStateContext.Provider>
      </PluginInheritanceContext.Provider>
    </VariableStoreContext.Provider>
  </SceneRegistrationContext.Provider>
</ThemeContext.Provider>
```

Plugin `wrapProvider` chain applied in reverse plugin order (same as `EngineProvider`).

**SSR policy:** Identical to `EngineProvider` — contexts provide defaults on server; Three.js
and RAF loop are guarded by `typeof window !== 'undefined'`.

**Render output:** No DOM elements. Context providers only.

---

### 3.2 `ScrollStage` (replaces `EngineInputRegion` scroll mode + `ScrollCaptureSection`)

**File:** `packages/core/src/player/ScrollStage.tsx`

**Responsibility:** DOM layout helper for the full-page sticky-canvas pattern. Creates the
tall outer spacer div (scroll region) and the `position: sticky; top: 0` inner stage. Reads
`EngineARContainerContext` (if inside `EngineARContainer`) for AR-derived stage height.

**Prop interface:**

```typescript
export interface ScrollStageProps {
  /**
   * How scroll region height is computed.
   * 'scene-count'  — height = pixelsPerScene × sceneCount (default)
   * 'scroll-units' — height = totalScrollUnits × pixelsPerScrollUnit
   */
  scrollHeightMode?: 'scene-count' | 'scroll-units';

  /** Pixels per scene when scrollHeightMode='scene-count'. Default: 1200. */
  pixelsPerScene?: number;

  /** Pixels per scroll unit when scrollHeightMode='scroll-units'. Default: 1. */
  pixelsPerScrollUnit?: number;

  /**
   * Exact scroll region height in pixels. Overrides all automatic calculation.
   * Use when an external system must stay in sync with window.scrollY.
   */
  scrollHeightPx?: number;

  /**
   * CSS height of the sticky stage. Default: '100vh'.
   * Set to a pixel value for fixed-parent-height embedding.
   */
  stageHeight?: string | number;

  className?: string;
  stageClassName?: string;
  children: ReactNode;
}
```

**Scroll height computation:**

```typescript
const engine = useSceneEngineContext();
const arCtx = useContext(EngineARContainerContext);

const scrollRegionHeightPx = useMemo((): number => {
  // 1. Explicit override takes priority
  if (props.scrollHeightPx != null) return props.scrollHeightPx;

  // 2. Scroll-units mode: read from compiled track's progressProfile
  if (props.scrollHeightMode === 'scroll-units') {
    const totalScrollUnits = engine.sceneTrack?.progressProfile?.totalScrollUnits ?? 0;
    const ppu = props.pixelsPerScrollUnit ?? 1;
    return totalScrollUnits * ppu;
  }

  // 3. Scene-count mode (default): pixels per scene × scene count
  const pps = props.pixelsPerScene ?? 1200;
  return pps * Math.max(1, engine.sceneCount);
}, [
  props.scrollHeightPx, props.scrollHeightMode, props.pixelsPerScrollUnit,
  props.pixelsPerScene, engine.sceneTrack, engine.sceneCount,
]);
```

**Stage height computation (mirrors `EngineInputRegion` today):**

```typescript
const stickyHeight: string =
  arCtx.computedArHeight > 0
    ? `${arCtx.computedArHeight}px`
    : typeof props.stageHeight === 'number'
      ? `${props.stageHeight}px`
      : (props.stageHeight ?? '100vh');
```

**Context provided:**

```typescript
// ScrollRegionContext — consumed by ScrollInput source='window'
const containerRef = useRef<HTMLDivElement | null>(null);
const scrollRegionContextValue = useMemo(
  () => ({ containerRef, scrollHeightPx: scrollRegionHeightPx }),
  [scrollRegionHeightPx],
);
```

**Render structure:**

```tsx
<ScrollRegionContext.Provider value={scrollRegionContextValue}>
  {/* Tall outer div — the scroll spacer */}
  <div
    ref={containerRef}
    className={props.className}
    style={{
      position: 'relative',
      height: scrollRegionHeightPx,
      overscrollBehavior: 'none',
    }}
  >
    {/* Sticky inner stage */}
    <div
      className={props.stageClassName}
      style={{
        position: 'sticky',
        top: 0,
        width: '100%',
        height: stickyHeight,
        overflow: 'hidden',
      }}
    >
      {props.children}
    </div>
  </div>
</ScrollRegionContext.Provider>
```

**Key behavioral contracts:**
- On mount, reads `engine.sceneCount` immediately. If 0 (engine not yet compiled), renders
  with height 0 until the first compile fires a re-render.
- `scrollRegionHeightPx` re-derives whenever `engine.sceneTrack` changes (which triggers a
  re-render via the existing `useState(scenes)` in `SceneEngine`).
- Does NOT attach scroll listeners. That is `ScrollInput`'s responsibility.
- Does NOT provide the background div. `BackgroundLayer` is a separate child component.

---

### 3.3 `BackgroundLayer` (new)

**File:** `packages/core/src/player/BackgroundLayer.tsx`

**Responsibility:** Wires `engine.setBackgroundRef` to a positioned div. Required in custom
layouts that use `<Background>` DSL element outside of `ScrollStage` or `SceneReel`.

```typescript
export interface BackgroundLayerProps {
  className?: string;
  style?: CSSProperties;
}

export function BackgroundLayer({ className, style }: BackgroundLayerProps): ReactElement {
  const engine = useSceneEngineContext();
  return (
    <div
      ref={engine.setBackgroundRef}
      className={className}
      style={{
        backgroundPosition: 'center',
        backgroundSize: 'cover',
        backgroundRepeat: 'no-repeat',
        pointerEvents: 'none',
        ...style,
      }}
    />
  );
}
```

**Usage note:** Place behind `SceneCanvas` (lower z-index or earlier in DOM order).
`ScrollStage` and `SceneReel` provide a pre-wired `BackgroundLayer` internally — consumers
only need to render this explicitly in raw `SceneEngine` + `SceneCanvas` layouts.

---

### 3.4 `SceneCanvas` (modified)

**File:** `packages/core/src/player/SceneCanvas.tsx` (modified in-place)

**Changes from current:**
1. Add `engineId?: string` prop — allows `SceneCanvas` to bind to a named engine from the
   global registry when it is not a descendant of that engine in the React tree.
2. When `engineId` is provided, read the engine from `ScenePlayerRegistry` via
   `useSceneEngineState(engineId)` and look up the canvas API from a secondary canvas-binding
   registry (see note below).
3. Remove `fillContainer` prop if present (it was on `EngineInputRegion`, not `SceneCanvas`).

**`engineId` implementation note:** When `engineId` is set, `SceneCanvas` cannot use
`useSceneEngineContext()` (wrong engine). Instead, `SceneEngine` exposes a method
`registerCanvasCallback(canvasEl)` on the global registry. `SceneCanvas` with `engineId` calls
this. Implementation: add a `canvasBinding` slot to `ScenePlayerRegistry` keyed by engine id.
`SceneEngine` registers a stable `setCanvasRef` callback on mount. `SceneCanvas` with
`engineId` reads and calls it.

**Prop interface (updated):**

```typescript
export interface SceneCanvasProps extends CanvasHTMLAttributes<HTMLCanvasElement> {
  /**
   * Optional loading placeholder rendered while assets are loading (tickIndex < 0).
   */
  placeholder?: ReactElement;

  /**
   * Bind this canvas to a named engine when SceneCanvas is not a descendant of
   * the target SceneEngine. Reads from ScenePlayerRegistry by id.
   * For standard usage (canvas inside engine provider), omit this prop.
   */
  engineId?: string;
}
```

The existing canvas registration (`setCanvasRef`), ResizeObserver, and forwarded ref behavior
are **unchanged**.

---

### 3.5 `ScrollInput`

**File:** `packages/core/src/player/ScrollInput.tsx`

**Responsibility:** Drives engine progress from a scroll source. Renders no visible DOM
(renders a zero-size div as focus/event capture anchor in inertia mode, nothing in window/element/IScrollSource modes).

**Prop interface:**

```typescript
export interface ScrollInputProps {
  /**
   * The scroll source. Default: 'inertia'.
   * - 'window': reads window.scrollY. Must be paired with ScrollStage.
   * - { elementRef }: reads element.scrollTop. Must be paired with ScrollStage.
   * - 'inertia': spring-decay integrator on wheel events. No ScrollStage needed.
   * - IScrollSource: custom implementation.
   */
  source?: ScrollSourceProp;

  // ── Inertia options (apply only when source='inertia') ───────────────────────

  /**
   * Spring decay factor per frame at ~60fps. Range: [0.5, 0.99].
   * Lower = faster stop. Default: 0.88 (≈400ms glide-to-stop at 60fps).
   */
  inertiaDecay?: number;

  /**
   * Wheel delta multiplier for the spring integrator.
   * Lower = less sensitive (good for high-DPI trackpads). Default: 0.0003.
   */
  inertiaSensitivity?: number;

  /** Key bindings for page-up/page-down scene step navigation. Optional. */
  inputMap?: SceneNavInputMap;

  /**
   * Pause scroll input (and zero inertia velocity) when the nearest positioned
   * ancestor falls below this IntersectionObserver threshold.
   */
  pauseWhenHidden?: PauseWhenHiddenOptions;
}
```

**Internal state:**

```typescript
const velocityRef = useRef(0);
const pendingWheelDeltaRef = useRef(0);
const rawProgressRef = useRef(0);
const isPausedRef = useRef(false);
```

**Inertia mode implementation (spring integrator):**

```typescript
// Wheel event accumulator — runs on wheel events (passive)
const onWheel = useCallback((e: WheelEvent) => {
  if (isPausedRef.current) return;
  pendingWheelDeltaRef.current += e.deltaY;
}, []);

// Per-frame integrator — runs inside a useEffect RAF loop
// This effect is set up once; the RAF loop runs for the component lifetime.
const rafRef = useRef<number>(0);
useEffect(() => {
  const tick = () => {
    if (!isPausedRef.current) {
      const sensitivity = props.inertiaSensitivity ?? 0.0003;
      const decay = props.inertiaDecay ?? 0.88;

      velocityRef.current += pendingWheelDeltaRef.current * sensitivity;
      pendingWheelDeltaRef.current = 0;

      if (Math.abs(velocityRef.current) > 0.00001) {
        rawProgressRef.current = Math.max(0, Math.min(1,
          rawProgressRef.current + velocityRef.current,
        ));
        velocityRef.current *= decay;
        // Clamp velocity to zero at boundaries to prevent stuck state
        if (rawProgressRef.current <= 0 || rawProgressRef.current >= 1) {
          velocityRef.current = 0;
        }
        engine.setProgress(rawProgressRef.current); // inertia operates in engine space
      }
    }
    rafRef.current = requestAnimationFrame(tick);
  };
  rafRef.current = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(rafRef.current);
}, [engine]); // engine is a stable ref; effect runs once
```

Wheel event attachment: `window.addEventListener('wheel', onWheel, { passive: true })` in a
`useEffect`.

**Window/element source mode implementation:**

```typescript
// Reads ScrollRegionContext provided by ScrollStage
const scrollRegion = useContext(ScrollRegionContext);

useEffect(() => {
  if (source !== 'window' && !(typeof source === 'object' && 'elementRef' in source)) return;
  if (!scrollRegion) {
    console.error(
      '[BrewSite] <ScrollInput source="window"> must be used inside <ScrollStage>.',
    );
    return;
  }

  const computeProgress = (): number => {
    const el = scrollRegion.containerRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    const scrollTop = source === 'window'
      ? (window.scrollY || window.pageYOffset || 0)
      : (source as { elementRef: RefObject<HTMLElement | null> }).elementRef.current?.scrollTop ?? 0;
    const viewportHeight = source === 'window' ? window.innerHeight : /* element clientHeight */ 1;
    const regionTop = scrollTop + rect.top;
    const maxScroll = Math.max(1, scrollRegion.scrollHeightPx - viewportHeight);
    return Math.max(0, Math.min(1, (scrollTop - regionTop) / maxScroll));
  };

  const update = () => {
    if (isPausedRef.current) return;
    const raw = computeProgress();
    engine.setRawProgress(raw); // goes through SceneProgressMapper for scroll-units mode
  };

  update(); // initialize immediately
  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update, { passive: true });
  return () => {
    window.removeEventListener('scroll', update);
    window.removeEventListener('resize', update);
  };
}, [source, scrollRegion, engine]);
```

**`ScrollNavigatorContext` provision:**

`ScrollInput source='window'` provides `ScrollNavigatorContext` so `useGoToScene()` can
navigate via scroll position:

```typescript
const scrollNavigatorValue = useMemo(() => ({
  scrollTo: (rawProgress: number) => {
    const region = scrollRegion?.containerRef.current;
    if (!region) return;
    const rect = region.getBoundingClientRect();
    const scrollTop = window.scrollY || 0;
    const regionTop = scrollTop + rect.top;
    const maxScroll = Math.max(1, (scrollRegion?.scrollHeightPx ?? 0) - window.innerHeight);
    window.scrollTo({ top: regionTop + rawProgress * maxScroll, behavior: 'smooth' });
  },
}), [scrollRegion]);

// Wrap children (or just provide context at scroll input level)
return (
  <ScrollNavigatorContext.Provider value={scrollNavigatorValue}>
    {null /* no DOM output for window/element mode */}
  </ScrollNavigatorContext.Provider>
);
```

**IScrollSource custom mode:**

```typescript
useEffect(() => {
  if (!isIScrollSource(source)) return;
  const unsubscribe = source.subscribe((rawProgress) => {
    if (!isPausedRef.current) engine.setRawProgress(rawProgress);
  });
  return unsubscribe;
}, [source, engine]);
```

**`pauseWhenHidden` via `usePauseWhenHidden` hook:**

```typescript
const containerDivRef = useRef<HTMLDivElement | null>(null);
usePauseWhenHidden(containerDivRef, props.pauseWhenHidden, (hidden) => {
  isPausedRef.current = hidden;
  if (hidden) {
    velocityRef.current = 0; // zero velocity on hide
    pendingWheelDeltaRef.current = 0;
  }
});
```

**Render output:**

```tsx
// Inertia mode: render a zero-size div as anchor for IntersectionObserver
if (resolvedSourceType === 'inertia') {
  return <div ref={containerDivRef} style={{ position: 'absolute', width: 0, height: 0 }} />;
}
// Window/element/IScrollSource modes: wrap context only (or null)
return (
  <ScrollNavigatorContext.Provider value={scrollNavigatorValue}>
    <div ref={containerDivRef} style={{ position: 'absolute', width: 0, height: 0 }} />
  </ScrollNavigatorContext.Provider>
);
```

---

### 3.6 `TimeInput`

**File:** `packages/core/src/player/TimeInput.tsx`

**Responsibility:** Drives engine progress via wall-clock auto-advance. Lowest-priority input
tier — yields when user interaction is detected.

**Prop interface:**

```typescript
export interface TimeInputProps {
  /** Seconds to traverse engine progress from 0 to `max`. Required. */
  duration: number;

  /** Maximum engine progress to advance to. Default: 1.0. */
  max?: number;

  /** Loop back to 0 when max is reached. Default: false. */
  loop?: boolean;

  /**
   * Reset engine progress to 0 when pauseWhenHidden triggers (element leaves viewport).
   * Default: true.
   */
  resetOnExit?: boolean;

  /**
   * Pause auto-advance after user interaction (scroll wheel, keyboard, pointer).
   * Resume requires another user interaction or resetOnExit restart. Default: false.
   */
  pauseOnInteraction?: boolean;

  /**
   * Pause time-based advance when the nearest positioned ancestor falls below this
   * IntersectionObserver threshold.
   */
  pauseWhenHidden?: PauseWhenHiddenOptions;
}
```

**Internal state:**

```typescript
const isPausedByHiddenRef = useRef(false);
const isPausedByInteractionRef = useRef(false);
const lastTimestampRef = useRef<number | null>(null);
const containerDivRef = useRef<HTMLDivElement | null>(null);
```

**Per-frame logic (RAF loop):**

```typescript
const tick = (ts: number) => {
  rafRef.current = requestAnimationFrame(tick);
  const paused = isPausedByHiddenRef.current || isPausedByInteractionRef.current;
  if (paused) {
    lastTimestampRef.current = null; // reset so next resume doesn't jump
    return;
  }
  if (lastTimestampRef.current === null) {
    lastTimestampRef.current = ts;
    return;
  }
  const elapsed = (ts - lastTimestampRef.current) / 1000; // seconds
  lastTimestampRef.current = ts;
  const max = props.max ?? 1.0;
  const delta = elapsed / props.duration;
  const current = engine.frameState.progress; // read current engine progress
  let next = current + delta;

  if (next >= max) {
    if (props.loop) {
      next = next % max;
    } else {
      next = max;
      // Stop advancing at max (RAF loop continues for future resetOnExit)
      lastTimestampRef.current = null;
    }
  }
  engine.setProgress(Math.max(0, Math.min(max, next)));
};
```

**`pauseWhenHidden` wiring:**

```typescript
usePauseWhenHidden(containerDivRef, props.pauseWhenHidden, (hidden) => {
  isPausedByHiddenRef.current = hidden;
  if (hidden && (props.resetOnExit ?? true)) {
    engine.setProgress(0);
    lastTimestampRef.current = null;
  }
});
```

**Render output:** Zero-size anchor div only.

---

### 3.7 `KeyboardInput`

**File:** `packages/core/src/player/KeyboardInput.tsx`

**Responsibility:** Captures keyboard events for scene navigation. Owns focus management
(tabIndex, onPointerDown focus capture) previously in `EngineInputRegion`.

**Prop interface:**

```typescript
export interface KeyboardInputProps {
  /** Key bindings. Default: arrow keys + space. */
  inputMap?: SceneNavInputMap;

  /**
   * Renders a focus-capture div (tabIndex={-1}) to receive keyboard events on click.
   * Default: true. Set false if parent already manages focus.
   */
  manageFocus?: boolean;

  /**
   * Pause keyboard navigation when the nearest positioned ancestor falls below
   * this IntersectionObserver threshold.
   */
  pauseWhenHidden?: PauseWhenHiddenOptions;
}
```

**Focus management div (when `manageFocus=true`):**

```tsx
<div
  ref={containerDivRef}
  tabIndex={-1}
  onPointerDown={(e) => {
    const el = e.currentTarget;
    if (typeof el.focus === 'function') el.focus({ preventScroll: true });
  }}
  style={{
    position: 'absolute',
    inset: 0,
    outline: 'none',
    pointerEvents: 'auto',
  }}
/>
```

**Keyboard event attachment:**

```typescript
useEffect(() => {
  const el = (props.manageFocus ?? true)
    ? containerDivRef.current
    : window;
  if (!el) return;

  const onKeyDown = (e: KeyboardEvent) => {
    if (isPausedRef.current) return;
    // Use InputController for key handling (reuse existing class)
    // OnScroll delta maps to engine.advanceProgress(delta / sceneCount)
    // OnJumpToScene maps to engine.setProgress(index / (sceneCount - 1))
  };

  el.addEventListener('keydown', onKeyDown);
  return () => el.removeEventListener('keydown', onKeyDown);
}, [props.manageFocus, engine, props.inputMap]);
```

**`InputController` reuse:**

`KeyboardInput` uses the existing `InputController` class (from `packages/core/src/input/`)
with a keys-only config:

```typescript
const ctrl = new InputController(
  attachTarget,
  {
    mode: 'scroll',
    wheel: false,
    drag: false,
    swipe: false,
    click: false,
    keys: props.inputMap?.keys,
  },
  {
    onScroll: (delta) => {
      // InputController.onScroll fires for each key-repeat tick. `delta` is a
      // raw signed value whose magnitude is determined by InputController internals
      // and is NOT guaranteed to equal 1/(N-1). Do NOT add delta directly to progress.
      // Instead, derive the canonical one-scene step from engine.sceneCount so the
      // result is always exactly `1/(sceneCount - 1)` per keypress, matching the test
      // contract in §14.6 items 1 and 2.
      if (isPausedRef.current) return;
      const direction = delta > 0 ? 1 : delta < 0 ? -1 : 0;
      if (direction === 0) return;
      const step = engine.sceneCount > 1 ? direction / (engine.sceneCount - 1) : direction;
      const target = Math.max(0, Math.min(1, engine.frameState.progress + step));
      // If ControlledInput is present, call its onChange; else set directly
      if (controlledCtx?.onChange) {
        controlledCtx.onChange(target);
      } else {
        engine.setProgress(target);
      }
    },
    onJumpToScene: (index) => {
      if (isPausedRef.current) return;
      const progress = engine.sceneCount > 1 ? index / (engine.sceneCount - 1) : 0;
      if (controlledCtx?.onChange) {
        controlledCtx.onChange(progress);
      } else {
        engine.setProgress(progress);
      }
    },
    getProgress: () => engine.frameState.progress,
    getSceneCount: () => engine.sceneCount,
  },
);
```

**`ControlledInput` interop:**

```typescript
// Reads ControlledProgressContext — provided by ControlledInput if present in the tree
const controlledCtx = useContext(ControlledProgressContext);
// If onChange is present, KeyboardInput calls it instead of engine.setProgress
```

**Render output:** Focus-capture div (when `manageFocus=true`) or null.

---

### 3.8 `PointerInput`

**File:** `packages/core/src/player/PointerInput.tsx`

**Responsibility:** Click-to-advance or hover-to-scrub pointer input.

**Prop interface:**

```typescript
export interface PointerInputProps {
  /** 'click' — advance one scene on click. 'hover' — scrub progress on cursor X position. */
  mode: 'click' | 'hover';

  /**
   * For hover mode: pixels of horizontal cursor movement spanning one full scene.
   * Default: 200.
   */
  sensitivity?: number;

  /** For click mode: wrap back to scene 0 after last scene. Default: false. */
  loop?: boolean;

  /**
   * Stop responding to pointer events when the nearest positioned ancestor falls below
   * this IntersectionObserver threshold.
   */
  pauseWhenHidden?: PauseWhenHiddenOptions;
}
```

**Click mode implementation:**

```typescript
const handleClick = useCallback(() => {
  if (isPausedRef.current) return;
  const { progress, sceneCount } = engine;
  const step = sceneCount > 1 ? 1 / (sceneCount - 1) : 1;
  let next = progress + step;
  if (next > 1) {
    next = props.loop ? 0 : 1;
  }
  engine.setProgress(next);
}, [engine, props.loop]);
```

**Hover mode implementation:**

```typescript
const handleMouseMove = useCallback((e: MouseEvent) => {
  if (isPausedRef.current) return;
  const containerEl = containerDivRef.current;
  if (!containerEl) return;
  const rect = containerEl.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const sensitivity = props.sensitivity ?? 200;
  // Map x position across container width to [0, 1]
  const progress = Math.max(0, Math.min(1, x / Math.max(sensitivity, rect.width)));
  engine.setProgress(progress);
}, [engine, props.sensitivity]);
```

**Render output:** Transparent overlay div covering the canvas area (position: absolute;
inset: 0; cursor: pointer for click mode, crosshair for hover mode).

---

### 3.9 `ControlledInput`

**File:** `packages/core/src/player/ControlledInput.tsx`

**Responsibility:** Drives engine progress from an external `value` prop (highest priority
input tier). Provides `ControlledProgressContext` so `KeyboardInput` can call `onChange`.

**Prop interface:**

```typescript
export interface ControlledInputProps {
  /** Normalized engine progress [0, 1]. Drives the engine directly each render. */
  value: number;

  /**
   * Called when another input component (e.g., KeyboardInput) attempts to change
   * the controlled progress. Wire to the same state setter that feeds `value`.
   */
  onChange?: (progress: number) => void;
}
```

**Progress write (on every render):**

```typescript
// Write controlled value to engine before first paint — highest priority, always wins.
// useLayoutEffect fires synchronously after DOM mutations and before the browser paints,
// eliminating the one-frame lag that useEffect (post-paint) would produce.
// Writing to an external store during React render is not used here — doing so in a
// render body causes infinite re-renders in strict mode. useLayoutEffect is the
// correct React pattern for "must take effect before next paint."
const engine = useSceneEngineContext();
useLayoutEffect(() => {
  engine.setProgress(Math.max(0, Math.min(1, props.value)));
}, [engine, props.value]);
```

**`ControlledProgressContext` provision:**

```typescript
const controlledCtxValue = useMemo(
  () => ({ onChange: props.onChange }),
  [props.onChange],
);

return (
  <ControlledProgressContext.Provider value={controlledCtxValue}>
    {null}
  </ControlledProgressContext.Provider>
);
```

**Render output:** No DOM. Context provider only.

---

### 3.10 `SceneReel` (new)

**File:** `packages/core/src/player/SceneReel.tsx`

**Responsibility:** Convenience wrapper for embedded/docs/slides use cases. Composes
`SceneEngine` + `SceneCanvas` + `BackgroundLayer` + `EngineOverlayHost` into a sized,
overflow-hidden container. Input components are consumer-provided children.

**Prop interface:**

```typescript
export interface SceneReelProps {
  // ── Layout ──────────────────────────────────────────────────────────────────
  /** CSS width. Default: '100%'. */
  width?: string | number;
  /** CSS height. Required. */
  height: string | number;
  className?: string;

  // ── Engine config (all forwarded to SceneEngine) ─────────────────────────────
  plugins?: WidgetPlugin[];
  id?: string;
  timingProfile?: EngineTimingProfile;
  primaryCameraId?: string;
  primaryCanvasActionTargetId?: string;
  cameraInteractionDefaults?: CameraInteractionDefaults;
  invalidateCacheToken?: number | string;
  maxAnimBoostPerFrame?: number;
  sceneTheme?: SceneTheme;

  // ── Lifecycle ───────────────────────────────────────────────────────────────
  onReady?: () => void;
  onError?: (error: Error) => void;
  onWidgetError?: (widgetId: string, error: Error) => void;
  onCompileWarning?: (warnings: CompileWarning[]) => void;

  // ── Content ─────────────────────────────────────────────────────────────────
  /**
   * <Scene> components, input components, and optionally EngineGate or overlay content.
   * SceneReel adds SceneCanvas, BackgroundLayer, and EngineOverlayHost automatically.
   */
  children: ReactNode;
}
```

**`EngineARContainerContext` interop:**

`SceneReel` reads `EngineARContainerContext` to use AR-derived height when nested inside
`EngineARContainer`:

```typescript
const arCtx = useContext(EngineARContainerContext);
const resolvedHeight = arCtx.computedArHeight > 0
  ? `${arCtx.computedArHeight}px`
  : typeof props.height === 'number'
    ? `${props.height}px`
    : props.height;
```

**Render structure:**

```tsx
<div
  className={props.className}
  style={{
    width: typeof props.width === 'number' ? `${props.width}px` : (props.width ?? '100%'),
    height: resolvedHeight,
    position: 'relative',
    overflow: 'hidden',
  }}
>
  <SceneEngine
    id={props.id}
    plugins={props.plugins}  // undefined = inherit from ancestor SceneEngine
    timingProfile={props.timingProfile}
    primaryCameraId={props.primaryCameraId}
    primaryCanvasActionTargetId={props.primaryCanvasActionTargetId}
    cameraInteractionDefaults={props.cameraInteractionDefaults}
    invalidateCacheToken={props.invalidateCacheToken}
    maxAnimBoostPerFrame={props.maxAnimBoostPerFrame}
    sceneTheme={props.sceneTheme}
    onReady={props.onReady}
    onError={props.onError}
    onWidgetError={props.onWidgetError}
    onCompileWarning={props.onCompileWarning}
  >
    {/* Consumer Scene declarations and input components */}
    {props.children}

    {/* Reel-provided infrastructure (always rendered) */}
    <BackgroundLayer style={{ position: 'absolute', inset: 0, zIndex: 0 }} />
    <div style={{ position: 'absolute', inset: 0, zIndex: 1 }}>
      <SceneCanvas style={{ width: '100%', height: '100%' }} />
    </div>
    <EngineOverlayHost />
  </SceneEngine>
</div>
```

---

## 4. New Hooks

### 4.1 `usePauseWhenHidden` (internal, not exported)

**File:** `packages/core/src/player/usePauseWhenHidden.ts`

```typescript
/**
 * Shared hook for input component visibility gating via IntersectionObserver.
 * Observes the element at `ref`, calls `onPauseChange(true)` when intersection
 * falls below threshold, `onPauseChange(false)` when it recovers.
 *
 * @param ref         Ref to the element to observe (usually the input component's anchor div)
 * @param options     Threshold options. Undefined = no observer (hook is a no-op).
 * @param onPauseChange  Called with `true` on hide, `false` on show.
 */
export function usePauseWhenHidden(
  ref: RefObject<HTMLElement | null>,
  options: PauseWhenHiddenOptions | undefined,
  onPauseChange: (paused: boolean) => void,
): void {
  useEffect(() => {
    if (!options) return;
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;

    const threshold = [options.y ?? 0.8]; // y threshold maps to rootMargin
    // Note: IntersectionObserver thresholds are by area fraction by default.
    // For x/y independent thresholds, we approximate via rootMargin.
    // Full x/y independent gating is an approximation; this is acceptable per PRD §11.

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        const isHidden = !entry.isIntersecting || entry.intersectionRatio < (options.y ?? 0.8);
        onPauseChange(isHidden);
      },
      { threshold: options.y ?? 0.8 },
    );

    observer.observe(el);
    return () => observer.disconnect();
    // onPauseChange intentionally not in deps — use a stable callback at call site
  }, [ref, options?.x, options?.y]);
}
```

**Important:** Call sites must pass a stable `onPauseChange` callback (e.g., a `useCallback`
or a plain function that only writes to a ref).

### 4.2 `useNativeScrollSource` (exported)

**File:** `packages/core/src/player/useNativeScrollSource.ts`

Creates a hidden off-screen scroll container that produces native OS scroll physics.

```typescript
export function useNativeScrollSource(
  options: UseNativeScrollSourceOptions,
): UseNativeScrollSourceResult {
  const divRef = useRef<HTMLDivElement | null>(null);
  const subscribersRef = useRef<Set<(raw: number) => void>>(new Set());
  const heightPx = options.heightPx;

  const source: IScrollSource = useMemo(() => ({
    subscribe(onProgress) {
      subscribersRef.current.add(onProgress);
      return () => subscribersRef.current.delete(onProgress);
    },
    scrollTo(rawProgress) {
      const div = divRef.current;
      if (!div) return;
      div.scrollTop = rawProgress * Math.max(1, heightPx - window.innerHeight);
    },
  }), [heightPx]);

  useEffect(() => {
    const div = divRef.current;
    if (!div) return;

    const onScroll = () => {
      const max = Math.max(1, heightPx - window.innerHeight);
      const raw = Math.max(0, Math.min(1, div.scrollTop / max));
      subscribersRef.current.forEach((cb) => cb(raw));
    };

    div.addEventListener('scroll', onScroll, { passive: true });
    return () => div.removeEventListener('scroll', onScroll);
  }, [heightPx]);

  return { source, ref: divRef };
}
```

**Usage pattern:**

```tsx
const { source, ref: hiddenDivRef } = useNativeScrollSource({ heightPx: TOTAL_SCROLL_PX });

// Render the hidden scroll div off-screen:
<div
  ref={hiddenDivRef}
  style={{
    position: 'fixed', top: 0, left: -1, width: 1, height: '100vh',
    overflowY: 'scroll', pointerEvents: 'none',
  }}
  aria-hidden="true"
>
  <div style={{ height: TOTAL_SCROLL_PX }} />
</div>

// Wire to engine:
<SceneEngine plugins={[...]}>
  <Scene id="s1">...</Scene>
  <ScrollInput source={source} />
  <SceneCanvas />
</SceneEngine>
```

### 4.3 `useGoToScene` (exported)

**File:** `packages/core/src/player/useGoToScene.ts`

```typescript
/**
 * Returns a stable function for programmatic scene navigation.
 * In scroll mode (ScrollInput source='window'), syncs window.scrollY via ScrollNavigatorContext.
 * In all other modes, calls engine.setProgress() directly.
 */
export function useGoToScene(): (idOrIndex: string | number) => void {
  const engine = useSceneEngineContext();
  const scrollNavigator = useContext(ScrollNavigatorContext); // null when no window ScrollInput

  return useCallback((idOrIndex: string | number) => {
    let targetIndex: number;
    if (typeof idOrIndex === 'string') {
      const scene = engine.compiledScenes.find((s) => s.id === idOrIndex);
      if (!scene) {
        console.warn(`[useGoToScene] Scene "${idOrIndex}" not found in compiled scenes.`);
        return;
      }
      targetIndex = scene.index;
    } else {
      targetIndex = idOrIndex;
    }

    const targetProgress = engine.sceneCount > 1
      ? Math.max(0, Math.min(1, targetIndex / (engine.sceneCount - 1)))
      : 0;

    if (scrollNavigator?.scrollTo && engine.progressMapper) {
      // In scroll mode with a mapper: invert to raw scroll space then scroll
      const rawProgress = engine.progressMapper.inverse(targetProgress);
      scrollNavigator.scrollTo(rawProgress);
    } else if (scrollNavigator?.scrollTo) {
      // In scroll mode without mapper: progress == raw
      scrollNavigator.scrollTo(targetProgress);
    } else {
      // Direct/inertia/controlled mode: write engine progress directly
      engine.setProgress(targetProgress);
    }
  }, [engine, scrollNavigator]);
}
```

### 4.4 `useEngineState(id?)` — unified hook (replaces two hooks)

**File:** `packages/core/src/player/useEngineState.ts` (new file replacing the export in `EngineStateContext.ts`)

Resolves Open Question 5 from the PRD: unifies `useEngineState()` (local context) and
`useSceneEngineState(id)` (global registry) into a single hook.

```typescript
/**
 * Returns live engine state.
 *
 * Without id: reads from the nearest ancestor SceneEngine context.
 *             Throws if not inside a SceneEngine.
 * With id:    reads from the global registry. Returns null when the engine is not mounted.
 *             Works from anywhere in the React tree (no ancestor requirement).
 *
 * Updates on every frame tick.
 */
export function useEngineState(): EngineFrameState;
export function useEngineState(id: string): SceneEngineSnapshot | null;
export function useEngineState(id?: string): EngineFrameState | SceneEngineSnapshot | null {
  // Local context path (no id)
  const localState = useContext(EngineStateContext);
  const globalState = useSyncExternalStore(
    id
      ? (cb) => subscribeEngineSnapshot(id, cb)
      : () => () => {}, // no-op subscription when no id
    id ? () => getEngineSnapshot(id) : () => null,
    () => null,
  );

  if (id !== undefined) {
    return globalState;
  }
  if (!localState) {
    throw new Error('[useEngineState] must be called inside a <SceneEngine> when no id is provided.');
  }
  return localState;
}
```

`useSceneEngineState(id)` is **deleted** from the public API. `useEngineState(id)` with an id
argument replaces it with identical behavior.

### 4.5 Updated `useEngineScrubber`

**File:** `packages/core/src/player/useEngineScrubber.ts` (modified)

`useEngineScrubber` options change to accept engine context directly instead of raw callbacks:

```typescript
export type UseEngineScrubberOptions = {
  // In the new API, useEngineScrubber calls engine.setProgress() internally.
  // No external callback needed.
};

export type UseEngineScrubberResult = {
  isScrubbing: boolean;
  startScrub: () => void;
  stopScrub: () => void;
  setProgress: (next: number) => void;
};

export function useEngineScrubber(): UseEngineScrubberResult {
  const engine = useSceneEngineContext();
  const [isScrubbing, setIsScrubbing] = useState(false);

  const startScrub = useCallback(() => setIsScrubbing(true), []);
  const stopScrub = useCallback(() => setIsScrubbing(false), []);
  const setProgress = useCallback((next: number) => {
    engine.setProgress(Math.max(0, Math.min(1, next)));
  }, [engine]);

  return { isScrubbing, startScrub, stopScrub, setProgress };
}
```

The old `UseEngineScrubberOptions` (`scrollToProgress` + `getGlobalProgress`) is removed.
`useEngineScrubber` now reads engine state from context directly.

---

## 5. Modified Files

### 5.1 `packages/core/src/player/useSceneEngine.ts`

**Changes:**
1. **Remove** the import and call to `useEngineInput` (the entire `useEngineInput` call is deleted).
2. **Remove** from `UseSceneEngineOptions`: `scrollSource`, `scrollHeightMode`, `pixelsPerScrollUnit`,
   `pixelsPerScene`, `scrollHeightPx`, `inputModePolicy`, `inputMap`, `controlledProgress`,
   `onControlledProgressChange`, `enableKeyboardInControlledMode`, `controlledInputMap`.
3. **Remove** from the returned `UseSceneEngineResult`: `scrollRegionRef`, `scrollRegionHeightPx`,
   `inputMode`, `scrollToProgress`. Also remove `setRawProgress` exposure (it was previously
   passed to `useEngineInput` internally — now input components receive it directly via context).
4. **Add** to the returned result:
   - `setProgress(mapped: number): void` — writes engine progress bypassing the mapper.
     Implementation: `progressRef.current = clamp01(mapped); setFrameState(...)`.
   - `advanceProgress(delta: number): void` — equivalent to
     `setProgress(clamp01(progressRef.current + delta))`.
   - `sceneTrack: SceneTrack | null` — expose the compiled track directly.
   - `sceneCount: number` — `sceneTrack?.scenes.length ?? 0`.
   - `compiledScenes: ReadonlyArray<{ id: string; index: number }>` — derived from
     `sceneTrack?.scenes ?? []`.
   - `progressMapper: SceneProgressMapper | null` — expose the mapper instance.
5. **Remove** the `buildEffectiveInputSpec` call and all auto-advance state related to
   `ProgressManager.autoAdvance`. Wait — actually `ProgressManager.autoAdvance` is a
   per-scene concern implemented inside `RuntimeDriverImpl`. Do NOT remove auto-advance
   from the runtime. Only remove the player-level auto-advance state machine (the
   `pausedOnUserScrollRef`, `autoAdvancingRef` etc. from the `useSceneEngine` body).
6. **Keep** all engine initialization, RAF loop, compilation, and widget dispatch logic unchanged.

**After changes, `useSceneEngine` will accept:**

```typescript
type UseSceneEngineOptions = {
  scenes: InternalSceneSpec[];
  widgetRegistry: WidgetRegistry;
  manifest: AssetManifest | null;
  timingProfile?: EngineTimingProfile;
  primaryCameraId?: string;
  primaryCanvasActionTargetId?: string;
  maxAnimBoostPerFrame?: number;
  cameraInteractionDefaults?: CameraInteractionDefaults;
  invalidateCacheToken?: number | string;
  onReady?: () => void;
  onError?: (error: Error) => void;
  onWidgetError?: (widgetId: string, error: Error) => void;
  onCompileWarning?: (warnings: CompileWarning[]) => void;
};
```

**Backward compatibility note on `setRawProgress`:** Keep `setRawProgress` on the engine
context. It is the correct API for `ScrollInput source='window'` and `source={elementRef}`.
It goes through the `SceneProgressMapper` when the mapper exists (scroll-units mode). In
engine context, `setRawProgress(raw)` has this exact behavior:

```typescript
const setRawProgress = useCallback((raw: number) => {
  const clamped = clamp01(raw);
  rawProgressRef.current = clamped;
  const mapped = progressMapperRef.current
    ? progressMapperRef.current.remap(clamped)
    : clamped;
  progressRef.current = mapped;
  // frameState is updated on next RAF tick; no setFrameState call here
}, []);
```

Add `setProgress` (bypasses mapper):

```typescript
const setProgress = useCallback((mapped: number) => {
  const clamped = clamp01(mapped);
  progressRef.current = clamped;
  // Also set rawProgressRef to the inverse so subsequent setRawProgress calls
  // in the same frame don't clobber this value
  rawProgressRef.current = progressMapperRef.current
    ? progressMapperRef.current.inverse(clamped)
    : clamped;
}, []);
```

Add `advanceProgress`:

```typescript
const advanceProgress = useCallback((delta: number) => {
  setProgress(clamp01(progressRef.current + delta));
}, [setProgress]);
```

### 5.2 `packages/core/src/player/engineTypes.ts`

Delete: `InputModePolicy`, `ScrollSource`.
Keep: `EngineFrameState`, `EngineState` (deprecated), `InternalSceneSpec`, `EngineTimingProfile`,
re-export of `CameraInteractionDefaults`.

### 5.3 `packages/core/src/player/EngineContext.tsx`

Update error message:
```typescript
// Before: 'must be used inside <EngineProvider>'
// After:  'must be used inside <SceneEngine>'
```

### 5.4 `packages/core/src/player/EngineStateContext.ts`

Update error message:
```typescript
// Before: 'must be used inside <EngineProvider>'
// After:  'must be used inside <SceneEngine>'
```

### 5.5 `packages/core/src/player/ScenePlayerRegistry.ts` (modified twice — two streams)

**Stream 1 changes:** Update warning messages and JSDoc:
- `'No <EngineProvider id="...">'` → `'No <SceneEngine id="...">'`
- Update all JSDoc comments that reference `EngineProvider` to reference `SceneEngine`.

**Stream 2 changes (sequenced after Stream 1):** Add a canvas-binding slot for the `SceneCanvas engineId` prop.

The canvas-binding registry stores a `setCanvasRef` callback per engine id, allowing a
`<SceneCanvas engineId="x">` outside the provider's React subtree to register itself:

```typescript
// Types added to ScenePlayerRegistry.ts:
type CanvasBindingEntry = {
  setCanvasRef: (el: HTMLCanvasElement | null) => void;
  setViewportSize: (w: number, h: number) => void;
};

// Module-level Map (same pattern as states and listeners):
const canvasBindings = new Map<string, CanvasBindingEntry>();

// New exports added to ScenePlayerRegistry.ts:

/** Called by SceneEngine on mount when it has an id prop. */
export const registerCanvasBinding = (id: string, entry: CanvasBindingEntry): void => {
  canvasBindings.set(id, entry);
};

/** Called by SceneEngine on unmount. */
export const unregisterCanvasBinding = (id: string): void => {
  canvasBindings.delete(id);
};

/** Called by SceneCanvas when engineId prop is set. Returns null if engine not mounted yet. */
export const getCanvasBinding = (id: string): CanvasBindingEntry | null =>
  canvasBindings.get(id) ?? null;
```

**`SceneEngine` integration (Stream 2):** In `SceneEngine.tsx`, when `props.id` is set,
call `registerCanvasBinding(props.id, { setCanvasRef: engine.setCanvasRef, setViewportSize: engine.setViewportSize })`
in a `useEffect` on mount, and `unregisterCanvasBinding(props.id)` on unmount.

**`SceneCanvas` integration (Stream 2):** When `props.engineId` is set, `SceneCanvas`
polls `getCanvasBinding(props.engineId)` via a `useEffect` with a `requestAnimationFrame`
retry loop until the binding is available, then calls `binding.setCanvasRef(el)` and
`binding.setViewportSize(w, h)` from its `ResizeObserver`. When `engineId` is not set,
behavior is unchanged (reads from `useSceneEngineContext()` as today).

### 5.6 `packages/core/src/player/index.ts`

See §13 for the complete new export surface.

---

## 6. Deleted Files

The following files are **deleted** with no compatibility shims:

| File | Replacement |
|---|---|
| `player/EngineProvider.tsx` | `player/SceneEngine.tsx` |
| `player/EngineInputRegion.tsx` | `player/ScrollStage.tsx` + `player/BackgroundLayer.tsx` |
| `player/ScrollCaptureSection.tsx` | `player/ScrollStage.tsx` + `<ScrollInput source="window">` |
| `player/useEngineScroll.ts` | `player/ScrollInput.tsx` (logic internalized) |
| `player/useEngineInput.ts` | `player/ScrollInput.tsx` + `player/KeyboardInput.tsx` |
| `player/effectiveInputSpec.ts` | No longer needed (input mode is now explicit) |
| `player/__tests__/useEngineScroll.test.tsx` | `player/__tests__/ScrollInput.test.tsx` |
| `player/__tests__/useEngineInput.test.tsx` | `player/__tests__/KeyboardInput.test.tsx` |
| `player/__tests__/effectiveInputSpec.test.ts` | No replacement |

---

## 7. `IScrollSource` Interface — Full Specification

`IScrollSource` is defined in `packages/core/src/player/scrollSourceTypes.ts` (§2.1).

**Consumption by `ScrollInput`:**

`ScrollInput` detects the source type via runtime checks:

```typescript
function isIScrollSource(source: ScrollSourceProp): source is IScrollSource {
  return (
    typeof source === 'object' &&
    !('elementRef' in source) &&
    typeof (source as IScrollSource).subscribe === 'function'
  );
}
```

When `isIScrollSource(source)` is true:
- On mount: `source.subscribe((raw) => engine.setRawProgress(raw))` — stores unsubscribe fn
- On unmount: calls the returned unsubscribe fn
- On programmatic navigation (via `useGoToScene`): calls `source.scrollTo(rawProgress)` if defined

**Consumers implementing `IScrollSource` (e.g., Lenis wrapper):**

```typescript
// apps/examples/src/some-page/useLenisSource.ts
function useLenisSource(lenis: Lenis, maxScrollPx: number): IScrollSource {
  return useMemo(() => ({
    subscribe(onProgress) {
      const handler = ({ scroll }: { scroll: number }) => {
        onProgress(Math.max(0, Math.min(1, scroll / maxScrollPx)));
      };
      lenis.on('scroll', handler);
      return () => lenis.off('scroll', handler);
    },
    scrollTo(rawProgress) {
      lenis.scrollTo(rawProgress * maxScrollPx, { immediate: true });
    },
  }), [lenis, maxScrollPx]);
}
```

---

## 8. Spring Inertia Integrator

**Algorithm:** Exponential velocity decay ("critically-damped spring" approximation).

**State:** Two mutable refs per `ScrollInput` instance:
- `velocityRef: number` — current velocity in engine-progress-per-frame units
- `pendingWheelDeltaRef: number` — accumulated wheel delta since last RAF tick

**Update frequency:** Every `requestAnimationFrame` tick (approximately 60fps).

**Algorithm (per frame):**

```typescript
// Step 1: Apply accumulated wheel delta to velocity
velocity += pendingWheelDelta * inertiaSensitivity;
pendingWheelDelta = 0;

// Step 2: Decay velocity
velocity *= inertiaDecay;

// Step 3: Advance progress
if (Math.abs(velocity) > 1e-5) {
  rawProgress = Math.max(0, Math.min(1, rawProgress + velocity));
  engine.setProgress(rawProgress);
}

// Step 4: Clamp velocity at boundaries to prevent stuck positive/negative accumulation
if (rawProgress <= 0 || rawProgress >= 1) {
  velocity = 0;
}
```

**Default parameters:**
- `inertiaDecay = 0.88` — approximately 400ms glide-to-stop at 60fps
  (velocity halves every ~5.5 frames: `0.88^5.5 ≈ 0.5`)
- `inertiaSensitivity = 0.0003` — one page height of wheel delta (≈3000px) = 0.9 progress units

**Pause behavior:** When `pauseWhenHidden` triggers, zeroes both `velocity` and
`pendingWheelDelta` to prevent pent-up motion on resume.

**Wheel event attachment:**

```typescript
useEffect(() => {
  if (source !== 'inertia') return;
  const el = window; // always window; DOM element targeting is an anti-pattern for inertia
  const handler = (e: WheelEvent) => {
    if (isPausedRef.current) return;
    pendingWheelDeltaRef.current += e.deltaY;
  };
  el.addEventListener('wheel', handler, { passive: true });
  return () => el.removeEventListener('wheel', handler);
}, [source]);
```

The wheel listener is **passive** — no preventDefault. This means `ScrollInput` in inertia
mode does NOT prevent native page scroll. If the page has no other scrollable content,
this is fine. If it does, consumers should wrap the engine in a `position: fixed` container.

---

## 9. `pauseWhenHidden` Implementation

**Shared internal hook:** `usePauseWhenHidden(ref, options, onPauseChange)` (§4.1).

**Per-component observer setup:**

Each input component creates its own `IntersectionObserver` observing its anchor div ref.
The anchor div is `position: absolute; width: 0; height: 0` — `IntersectionObserver` observes
its **nearest scrollable ancestor** (the positioned parent). This is the intended behavior:
the component observes the container it's in, not itself.

**Per-component behavior on pause:**

| Component | On hide (`paused = true`) | On show (`paused = false`) |
|---|---|---|
| `ScrollInput` (inertia) | Zero velocity + pendingDelta | Resume (no action) |
| `ScrollInput` (window/element) | Ignore scroll events | Resume listening |
| `ScrollInput` (IScrollSource) | Ignore subscribe callbacks | Resume listening |
| `TimeInput` | Pause advance; if `resetOnExit=true`, call `engine.setProgress(0)` | Resume advance |
| `KeyboardInput` | Release focus (blur); ignore key events | No auto-refocus |
| `PointerInput` | Ignore pointer events | Resume |
| `ControlledInput` | Not applicable — no `pauseWhenHidden` prop | — |

**Multiple components sharing the same `pauseWhenHidden` threshold:**

Each component runs its own `IntersectionObserver`. The browser coalesces observers on the
same root element — no meaningful overhead. Per PRD §11 (risks), this is acceptable.

**Threshold semantics:**

The `PauseWhenHiddenOptions` has `x` (horizontal fraction) and `y` (vertical fraction).
The `IntersectionObserver` threshold is set to `options.y ?? 0.8` — meaning 80% of the
component's height must be visible before it becomes active. The `x` field is currently
informational (horizontal intersection is not independently configurable via browser APIs).
A future enhancement could use `rootMargin` for horizontal gating, but this is not required
for v2.

---

## 10. `SceneReel` Composition

`SceneReel` is NOT a thin alias for `EngineProvider`. It is a fully composed component:

```
SceneReel
├── <div style={{ position: relative; overflow: hidden; width; height }}>
│   └── SceneEngine (all engine props forwarded; plugins= resolved from prop or ancestor)
│       ├── {props.children} — <Scene>s, <ScrollInput>, <TimeInput>, <KeyboardInput>, etc.
│       ├── BackgroundLayer (position: absolute; inset: 0; z-index: 0)
│       ├── <div style={{ position: absolute; inset: 0; z-index: 1 }}>
│       │   └── SceneCanvas (width: 100%; height: 100%)
│       └── EngineOverlayHost
```

**What `SceneReel` provides automatically:**
- Sized container (`position: relative; overflow: hidden`)
- `SceneEngine` with plugin inheritance support
- `BackgroundLayer` (enables `<Background>` DSL element)
- `SceneCanvas` sized to fill the container
- `EngineOverlayHost` (enables HUD overlays)
- `EngineARContainerContext` interop for `height` resolution

**What `SceneReel` does NOT provide:**
- Input components — consumer must add `<ScrollInput>`, `<TimeInput>`, `<KeyboardInput>`,
  `<PointerInput>`, or `<ControlledInput>` as children.
- `ScrollStage` — `SceneReel` is not for the full-page marketing pattern. For that, use
  `SceneEngine` + `ScrollStage` + `ScrollInput source="window"` directly.

**Plugin resolution in `SceneReel`:**

`SceneReel` passes `plugins={props.plugins}` to `SceneEngine`. When `props.plugins` is
undefined, `SceneEngine` inherits from the nearest ancestor `SceneEngine` via
`PluginInheritanceContext`. This is the primary path for the app-level plugin hoisting pattern.

---

## 11. `SceneEngine` Zero-Scene Mode

A `SceneEngine` with no `<Scene>` children is **valid**. It compiles an empty `SceneTrack`
(zero scenes), provides plugin configuration to all nested engines, and keeps the RAF loop
running (doing nothing at progress=0).

**`PluginInheritanceContext`:**

```typescript
// packages/core/src/player/PluginInheritanceContext.tsx
export const PluginInheritanceContext = createContext<WidgetPlugin[] | null>(null);
```

`SceneEngine` always provides this context with the resolved plugin array:

```tsx
<PluginInheritanceContext.Provider value={resolvedPlugins}>
  {/* ... rest of context providers ... */}
</PluginInheritanceContext.Provider>
```

**Plugin resolution for any nested `SceneEngine` or `SceneReel`:**

```typescript
const inheritedPlugins = useContext(PluginInheritanceContext);
const resolvedPlugins = useMemo(() => {
  if (props.plugins) return props.plugins;    // 1. Own props win
  if (inheritedPlugins) return inheritedPlugins; // 2. Inherited from nearest ancestor
  console.error('[BrewSite] No plugins found...');
  return [];
}, [props.plugins, inheritedPlugins]);
```

**Typical pattern (app root):**

```tsx
// Root layout — no scenes; provides plugins for all nested reels
<SceneEngine plugins={[corePlugin(), modelPlugin({ manifestUrl }), diagramPlugin()]}>
  <App />
</SceneEngine>

// Anywhere nested:
<SceneReel height={400}>   {/* plugins inherited automatically */}
  <Scene id="demo">...</Scene>
  <TimeInput duration={4} loop pauseWhenHidden={{ y: 0.5 }} />
</SceneReel>
```

---

## 12. App Migration

### 12.1 Migration pattern for full-page scroll apps

**Pattern: `EngineProvider` + `EngineARContainer` + `EngineInputRegion` (majority of examples app)**

```tsx
// BEFORE (v1):
<EngineProvider plugins={plugins} pixelsPerScene={N} inputModePolicy="prefer-scroll">
  <Scenes />
  <EngineARContainer aspectRatio={16/9} scaleMode="fit-width" referenceWidth={1920}>
    <EngineInputRegion>
      <SceneCanvas />
      <EngineOverlayHost />
    </EngineInputRegion>
  </EngineARContainer>
</EngineProvider>

// AFTER (v2):
<SceneEngine plugins={plugins}>
  <Scenes />
  <EngineARContainer aspectRatio={16/9} scaleMode="fit-width" referenceWidth={1920}>
    <ScrollStage scrollHeightMode="scene-count" pixelsPerScene={N}>
      <BackgroundLayer style={{ position: 'absolute', inset: 0, zIndex: 0 }} />
      <SceneCanvas />
      <ScrollInput source="window" />
      <KeyboardInput />
      <EngineOverlayHost />
    </ScrollStage>
  </EngineARContainer>
</SceneEngine>
```

**Pattern: `EngineProvider` + direct `EngineInputRegion` (no AR container)**

```tsx
// AFTER (v2):
<SceneEngine plugins={plugins}>
  <Scenes />
  <ScrollStage scrollHeightMode="scene-count" pixelsPerScene={N}>
    <BackgroundLayer style={{ position: 'absolute', inset: 0, zIndex: 0 }} />
    <SceneCanvas />
    <ScrollInput source="window" />
    <KeyboardInput />
    <EngineOverlayHost />
  </ScrollStage>
</SceneEngine>
```

**Pattern: `EngineProvider` with `scrollHeightPx` (exact pixel height)**

```tsx
// AFTER (v2):
<ScrollStage scrollHeightPx={TOTAL_SCROLL_HEIGHT}>
  ...
</ScrollStage>
```

**Pattern: `EngineProvider` with `scrollHeightMode="scroll-units"`**

```tsx
// AFTER (v2):
<ScrollStage scrollHeightMode="scroll-units" pixelsPerScrollUnit={1}>
  ...
</ScrollStage>
```

**Pattern: `EngineProvider` with `controlledProgress` (docs DemoScene)**

```tsx
// BEFORE (v1):
const [progress, setProgress] = useState(0);
<EngineProvider
  plugins={resolvedPlugins}
  controlledProgress={progress}
  onControlledProgressChange={setProgress}
>
  {children}
  <EngineInputRegion fillContainer>
    <SceneCanvas />
    <DemoControls />
  </EngineInputRegion>
</EngineProvider>

// AFTER (v2):
const [progress, setProgress] = useState(0);
<SceneReel height={height} plugins={resolvedPlugins}>
  {children}
  <ControlledInput value={progress} onChange={setProgress} />
  {/* DemoControls is positioned as overlay via EngineOverlayHost or absolute div */}
</SceneReel>
// Note: DemoScene controls UI moves to a sibling/overlay div over SceneCanvas
// (SceneReel provides SceneCanvas internally).
// DemoSceneControls calls engine.setProgress() directly via useSceneEngineContext().
```

**Pattern: `EngineProvider` with `quality` / `fpsCap` / `framesPerTick` flat props**

```tsx
// BEFORE (v1):
<EngineProvider quality="high" fpsCap={60} framesPerTick={4} ...>

// AFTER (v2):
<SceneEngine timingProfile={{ qualityPreset: 'high', fpsCap: 60, blockSize: 4 }} ...>
```

---

### 12.2 `apps/examples/src/` — file-by-file migration

Each page component in `apps/examples/src/` follows one of the patterns above.
Apply the same transformation to all:

| File | Current pattern | v2 migration |
|---|---|---|
| `architecture/ArchitecturePage.tsx` | EP + AR + EIR | SceneEngine + AR + ScrollStage + ScrollInput + KeyboardInput |
| `brewflow-comparison/BrewflowComparisonPage.tsx` | EP + AR + EIR | SceneEngine + AR + ScrollStage + ScrollInput + KeyboardInput |
| `brewflow-memory/MemorySubsystemPage.tsx` | EP + AR + EIR (pixelsPerScene) | SceneEngine + AR + ScrollStage (scene-count, pixelsPerScene=TOTAL/N) + ScrollInput + KeyboardInput |
| `brewflow-multiuser/BrewflowMultiuserPage.tsx` | EP + AR + EIR | same pattern |
| `brewflow-sidecar/BrewflowSidecarPage.tsx` | EP + AR + EIR | same pattern |
| `chart/ChartDemoPage.tsx` | EP + AR + EIR | same pattern |
| `whiteboard-arch/WhiteboardArchPage.tsx` | EP + AR + EIR | same pattern |

**Each widgetSetup.ts file is unchanged** — `createXxxPlugins()` functions return
`WidgetPlugin[]` which is identical in v2. The `plugins` prop still accepts `WidgetPlugin[]`.

**Remove `pixelsPerScene`, `inputModePolicy` from every `EngineProvider` call. Move to `ScrollStage`.**

---

### 12.3 `apps/website/src/landing/LandingPage.tsx` migration

```tsx
// BEFORE:
function WebsiteLayout({ loadError }) {
  const engine = useSceneEngineContext();
  return (
    <div style={{ position: 'relative' }}>
      {/* loading/error overlays ... */}
      <EngineInputRegion>
        <SceneCanvas style={{ width: '100%', height: '100%' }} />
        <EngineOverlayHost />
      </EngineInputRegion>
    </div>
  );
}

export default function LandingPage() {
  const plugins = useMemo(() => createWebsitePlugins(MANIFEST_URL), []);
  return (
    <EngineProvider
      id="website-flow-player"
      manifestUrl={MANIFEST_URL}
      plugins={plugins}
      quality={isMobile ? 'balanced' : 'high'}
      pixelsPerScene={1400}
      onError={...}
    >
      {websiteFlowScenes}
      <NavMenu />
      <WebsiteLayout loadError={loadError} />
    </EngineProvider>
  );
}

// AFTER:
function WebsiteLayout({ loadError }) {
  const engine = useSceneEngineContext();
  const isLoading = engine.frameState.tickIndex < 0;
  return (
    <ScrollStage scrollHeightMode="scene-count" pixelsPerScene={1400}>
      {/* loading/error overlays — same as before, position: absolute z-index: 100 */}
      <BackgroundLayer style={{ position: 'absolute', inset: 0, zIndex: 0 }} />
      <SceneCanvas style={{ width: '100%', height: '100%' }} />
      <ScrollInput source="window" />
      <KeyboardInput />
      <EngineOverlayHost />
    </ScrollStage>
  );
}

export default function LandingPage() {
  const [loadError, setLoadError] = useState<Error | null>(null);
  const plugins = useMemo(() => createWebsitePlugins(MANIFEST_URL), []);
  return (
    <SceneEngine
      id="website-flow-player"
      plugins={plugins}
      timingProfile={{ qualityPreset: isMobile ? 'balanced' : 'high' }}
      onError={(err) => { setLoadError(err); console.error(...); }}
      onWidgetError={...}
      onCompileWarning={...}
    >
      {websiteFlowScenes}
      <NavMenu />
      <WebsiteLayout loadError={loadError} />
    </SceneEngine>
  );
}
```

**Note:** `manifestUrl` is removed from `SceneEngine`. It was already deprecated on `EngineProvider`.
`createWebsitePlugins(MANIFEST_URL)` already passes manifestUrl to `modelPlugin({ manifestUrl })`.
No change needed to `widgetSetup.ts`.

---

### 12.3.1 `apps/website/src/` — complete file-by-file migration table

The following table covers every non-generated, non-scene-DSL file in `apps/website/src/`.
Scene DSL files (`scenes/act*/scene_*.tsx`) are compiled by the scene compiler which is
**unaffected** by this change — those files require zero modifications.

| File | Requires migration? | Details |
|---|---|---|
| `landing/LandingPage.tsx` | **Yes** | Documented in §12.3 above: `EngineProvider` → `SceneEngine`; `WebsiteLayout` inner function migrated to use `ScrollStage` + `ScrollInput` + `KeyboardInput`. |
| `landing/nav/NavMenu.tsx` | **Yes** | Uses `engine.scrollToProgress()` (deleted in v2) and `engine.sceneIds` (removed from engine context). **Migration:** Replace `engine.scrollToProgress(progress)` with the `useGoToScene()` hook call: `const goToScene = useGoToScene(); goToScene(sceneId)`. Remove `engine.sceneIds` lookup — use `engine.compiledScenes.find(s => s.id === sceneId)?.index` for the index, then pass that index to `goToScene`. The `useCurrentScene()` import is unchanged. |
| `landing/hero/ScrollIndicator.tsx` | No change required | Imports `useEngineState` from `@brewsite/core`. The unified `useEngineState()` (no-id variant) is still exported with the same name and the same local-context behavior. No API change. |
| `landing/hero/HeroSection.tsx` | No change required | Pure structural component — wraps `HeroBezel` and `ScrollIndicator`. No engine imports. |
| `landing/hero/HeroBezel.tsx` | No change required | Pure CSS/HTML decorative component. No engine imports. |
| `App.tsx` | No change required | React Router wrapper that renders `<LandingPage />`. No engine imports. |
| `widgetSetup.ts` | No change required | Returns `WidgetPlugin[]` via `createWebsitePlugins(manifestUrl)`. Plugin API is unchanged in v2. |
| `widgets/neon-sign/dsl.tsx` | No change required | Custom widget DSL stub. Widget SDK is unaffected by this change. |
| `scenes/websiteFlow.tsx` | No change required | Assembles scene DSL `<Scene>` elements into an array. No player-layer imports. |
| `scenes/act*/scene_*.tsx` | No change required | Scene DSL files. The compiler is unaffected. |
| `generated/*.generated.tsx` | No change required | Auto-generated DSL type stubs. Re-run `gen:scene-dsl` only if `siteResources.ts` changes, which it does not. |

**`NavMenu.tsx` migration code:**

```tsx
// BEFORE (v1):
import { useCurrentScene, useSceneEngineContext } from '@brewsite/core';

function NavMenu(): JSX.Element {
  const { id: currentSceneId } = useCurrentScene();
  const engine = useSceneEngineContext();

  const handleNavClick = useCallback((sceneId: string) => {
    close();
    const index = engine.sceneIds.findIndex((id) => id === sceneId);
    if (index < 0) return;
    const progress = index / Math.max(1, engine.sceneCount - 1);
    engine.scrollToProgress(progress);
  }, [close, engine]);
  ...
}

// AFTER (v2):
import { useCurrentScene, useGoToScene } from '@brewsite/core';

function NavMenu(): JSX.Element {
  const { id: currentSceneId } = useCurrentScene();
  const goToScene = useGoToScene();

  const handleNavClick = useCallback((sceneId: string) => {
    close();
    goToScene(sceneId); // useGoToScene resolves by id directly
  }, [close, goToScene]);
  ...
}
```

---

### 12.4 `apps/docs/src/demos/shared/DemoScene.tsx` migration

`DemoScene` uses `EngineProvider` with `controlledProgress` + `EngineInputRegion fillContainer`.
Migrate to `SceneReel` + `ControlledInput`:

```tsx
// AFTER:
export function DemoScene({
  children, sceneCount, height = 420, sceneDuration = 2500, plugins,
}: DemoSceneProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [autoPlay, setAutoPlay] = useState(false);
  const [progress, setProgress] = useState(0);

  const resolvedPlugins = useMemo(
    () => plugins ?? createDemoWidgetSetup(),
    [plugins],
  );

  useEffect(() => {
    if (prefersReducedMotion || !containerRef.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry) setAutoPlay(entry.isIntersecting); },
      { threshold: 0.4 },
    );
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="demo-scene" ref={containerRef} style={{ height, overflow: 'hidden' }}>
      <SceneReel height={height} plugins={resolvedPlugins}>
        {children}
        <ControlledInput value={progress} onChange={setProgress} />
        {/* DemoSceneControls is now an absolutely-positioned overlay */}
        <DemoSceneControls
          sceneCount={sceneCount}
          sceneDuration={sceneDuration}
          autoPlay={autoPlay}
          setAutoPlay={setAutoPlay}
          progress={progress}
          onProgressChange={setProgress}
        />
      </SceneReel>
    </div>
  );
}
```

`DemoSceneControls` is updated to:
- Accept `progress` and `onProgressChange` props instead of calling `engine.scrollToProgress`
- Call `onProgressChange(next)` for prev/next/scrubber actions
- The auto-play RAF loop calls `onProgressChange(elapsed / totalDuration)` directly

```tsx
function DemoSceneControls({ progress, onProgressChange, ... }) {
  // Auto-play RAF loop — no engine context needed
  useEffect(() => {
    if (!autoPlay) return;
    const tick = (ts: number) => {
      if (startTimeRef.current === 0) startTimeRef.current = ts;
      const elapsed = (ts - startTimeRef.current) % totalDuration;
      onProgressChange(elapsed / totalDuration);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [autoPlay, onProgressChange, totalDuration]);

  // Prev/next navigation:
  const nextScene = () => {
    setAutoPlay(false);
    onProgressChange(Math.min(1, Math.round((progress + stepSize) / stepSize) * stepSize));
  };
  // ...
}
```

**All other docs demo files** (`BasicSceneDemo.demo.tsx`, `MultiSceneDemo.demo.tsx`, etc.)
that use `DemoScene` require no changes — they only pass `children` and `sceneCount`.

**Docs page files** (`Installation.tsx`, `QuickStart.tsx`, etc.) that contain inline code
examples showing `EngineProvider` / `EngineInputRegion` usage — update the example strings
to show v2 API. These are documentation strings, not live code.

---

### 12.5 `useEngineScrubber` migration

`useEngineScrubber` had an options object in v1. In v2 the options type is removed entirely;
the hook reads engine context directly and must be called inside a `<SceneEngine>` tree.
This is a **breaking change for any external consumer** that passes options.

**The MIGRATION.md file (Stream 4, item 7) must include the following entry:**

```markdown
## useEngineScrubber

The options object has been removed. The hook now reads the engine context directly
and requires no arguments. Call it as a plain hook inside a `<SceneEngine>` descendant.

### Before (v1)
```typescript
const engine = useSceneEngineContext();
const { isScrubbing, startScrub, stopScrub, setProgress } = useEngineScrubber({
  scrollToProgress: (p) => { engine.scrollToProgress(p); },
  getGlobalProgress: () => engine.progress,
});
```

### After (v2)
```typescript
// No options — hook reads engine context automatically.
// Must be called inside a <SceneEngine> tree.
const { isScrubbing, startScrub, stopScrub, setProgress } = useEngineScrubber();
// setProgress(p) calls engine.setProgress(p) internally.
```
```

**This migration pattern must appear in both `MIGRATION.md` and in the v2 `README.md`**
under the "Hooks" reference section so external consumers can find it without reading
the full migration guide.

---

## 13. Export Surface — New `packages/core/src/player/index.ts`

Complete new export list (additions marked `[NEW]`, removals are simply absent):

```typescript
// ─── Core Engine ──────────────────────────────────────────────────────────────
export { SceneEngine } from './SceneEngine';                           // [NEW]
export type { SceneEngineProps } from './SceneEngine';                  // [NEW]

// ─── Layout Components ────────────────────────────────────────────────────────
export { SceneCanvas } from './SceneCanvas';
export type { SceneCanvasProps } from './SceneCanvas';
export { ScrollStage } from './ScrollStage';                            // [NEW]
export type { ScrollStageProps } from './ScrollStage';                  // [NEW]
export { BackgroundLayer } from './BackgroundLayer';                    // [NEW]
export type { BackgroundLayerProps } from './BackgroundLayer';          // [NEW]
export { SceneReel } from './SceneReel';                                // [NEW]
export type { SceneReelProps } from './SceneReel';                      // [NEW]

// ─── Input Components ─────────────────────────────────────────────────────────
export { ScrollInput } from './ScrollInput';                            // [NEW]
export type { ScrollInputProps } from './ScrollInput';                  // [NEW]
export { TimeInput } from './TimeInput';                                // [NEW]
export type { TimeInputProps } from './TimeInput';                      // [NEW]
export { KeyboardInput } from './KeyboardInput';                        // [NEW]
export type { KeyboardInputProps } from './KeyboardInput';              // [NEW]
export { PointerInput } from './PointerInput';                          // [NEW]
export type { PointerInputProps } from './PointerInput';                // [NEW]
export { ControlledInput } from './ControlledInput';                    // [NEW]
export type { ControlledInputProps } from './ControlledInput';          // [NEW]

// ─── Scroll Source ────────────────────────────────────────────────────────────
export type { IScrollSource, ScrollSourceProp } from './scrollSourceTypes';  // [NEW]
export { useNativeScrollSource } from './useNativeScrollSource';        // [NEW]
export type {
  UseNativeScrollSourceOptions,
  UseNativeScrollSourceResult,
} from './useNativeScrollSource';                                        // [NEW]

// ─── Unchanged Components ─────────────────────────────────────────────────────
export { EngineOverlayHost } from './EngineOverlayHost';
export type { EngineOverlayHostProps } from './EngineOverlayHost';
export { EngineARContainer } from './EngineARContainer';
export type {
  EngineARContainerProps, ScaleMode, ViewportScaleContextValue, EngineARContainerContextValue,
} from './EngineARContainer';
export { ViewportScaleContext, EngineARContainerContext } from './EngineARContainer';
export { computeContainerDims } from './EngineARContainer';
export { EngineGate } from './EngineGate';
export type { EngineGateProps } from './EngineGate';

// ─── Hooks ────────────────────────────────────────────────────────────────────
export { useSceneEngine } from './useSceneEngine';
export type { UseSceneEngineResult } from './useSceneEngine';
export { useEngineState } from './useEngineState';                      // [NEW unified hook]
export { useEngineScrubber } from './useEngineScrubber';
export type { UseEngineScrubberResult } from './useEngineScrubber';
export { useSceneProgress } from './useSceneProgress';
export { useCurrentScene } from './useCurrentScene';
export { useSceneRuntime } from './useSceneRuntime';
export type { SceneRuntimeState } from './ScenePlayerRegistry';
export { useSceneEngineContext, EngineContext } from './EngineContext';
export { useGoToScene } from './useGoToScene';                          // [NEW]

// ─── Plugin System ────────────────────────────────────────────────────────────
export { corePlugin } from './plugins';
export type { CorePluginOptions } from './plugins';

// ─── Types ────────────────────────────────────────────────────────────────────
export type { EngineFrameState, EngineState } from './engineTypes';
export type { EngineTimingProfile, InternalSceneSpec } from './engineTypes';
export type { SceneEngineSnapshot } from './ScenePlayerRegistry';

// ─── UI Components (stable public API) ────────────────────────────────────────
export { TimelineWidget } from './TimelineWidget';
export type { TimelineWidgetProps, TimelineTickStyle, TimelineTheme } from './TimelineWidgetTypes';

// ─── Dev Tools ────────────────────────────────────────────────────────────────
export { CameraControlPanel } from './CameraControlPanel';
export { CameraInteractionInfoDialog } from './CameraInteractionInfoDialog';
export { SceneInspector } from './SceneInspector';
export type { SceneInspectorProps } from './SceneInspector';

// ─── REMOVED from v1 (not re-exported, not shim-exported): ───────────────────
// EngineProvider, EngineInputRegion, ScrollCaptureSection
// useEngineScroll, useEngineInput, UseEngineScrollOptions, UseEngineInputOptions
// InputModePolicy, ScrollSource
// useSceneEngineState (replaced by useEngineState(id))
```

---

## 14. Testing Strategy

All tests follow interface-based stateful tests: real inputs → real output assertions. No
mocking of internals. Use `@testing-library/react` for component tests.

### 14.1 `BackgroundLayer` tests

**File:** `packages/core/src/player/__tests__/BackgroundLayer.test.tsx`

**What to cover:**
1. Renders a `div` with `engine.setBackgroundRef` wired — verify the rendered div's ref is set
   to the engine's `setBackgroundRef` (observe via `engine.setBackgroundRef.current` after mount).
2. Applies default styles: `backgroundPosition: 'center'`, `backgroundSize: 'cover'`,
   `backgroundRepeat: 'no-repeat'`, `pointerEvents: 'none'`.
3. Merges consumer `style` prop over defaults — e.g., `style={{ position: 'absolute', inset: 0 }}`
   appears in the rendered element alongside the default styles.
4. Applies `className` prop to the rendered div.
5. Throws (or renders nothing safely) when mounted outside `<SceneEngine>` —
   `useSceneEngineContext()` throws; verify the error is caught and the component
   does not produce a silent no-op.

**Test approach:** Mount `<SceneEngine plugins={[...]}><BackgroundLayer /></SceneEngine>`.
Use `screen.getByRole('presentation')` or `container.firstChild` to assert the div.
Assert `engine.setBackgroundRef.current` is the rendered div element.

---

### 14.2 `SceneEngine` tests

**File:** `packages/core/src/player/__tests__/SceneEngine.test.tsx`

**What to cover:**
1. Renders without DOM output — verify no visible HTML elements in the render tree.
2. Provides `EngineContext` — a child `useSceneEngineContext()` returns a non-null engine.
3. Plugin resolution: own `plugins` prop overrides ancestor `PluginInheritanceContext`.
4. Plugin resolution: omitted `plugins` prop inherits from parent `SceneEngine` context.
5. Plugin resolution: no plugins anywhere → `console.error` is called.
6. Zero-scene mode: `SceneEngine` with no `<Scene>` children mounts without error;
   `engine.sceneCount === 0`.
7. `onCompileWarning` is called when a scene has compile warnings.

**Test approach:** Mount with `render(<SceneEngine plugins={[...]}><TestConsumer /></SceneEngine>)`.
`TestConsumer` reads from `useSceneEngineContext()` and exposes values via `data-` attributes
or a `ref` callback for assertions.

---

### 14.3 `ScrollStage` tests

**File:** `packages/core/src/player/__tests__/ScrollStage.test.tsx`

**What to cover:**
1. **Scene-count mode (default):** `scrollRegionHeightPx = pixelsPerScene × sceneCount`.
   Mount `<SceneEngine>` with 3 compiled scenes; wrap with `<ScrollStage pixelsPerScene={400}>`;
   assert the outer spacer div has `height: 1200px` (3 × 400).
2. **Scene-count default `pixelsPerScene`:** When `pixelsPerScene` is omitted, defaults to 1200.
   With 2 scenes: outer div height = 2400px.
3. **Scroll-units mode:** `scrollRegionHeightPx = totalScrollUnits × pixelsPerScrollUnit`.
   Provide a mock `engine.sceneTrack.progressProfile.totalScrollUnits = 5000`; mount with
   `<ScrollStage scrollHeightMode="scroll-units" pixelsPerScrollUnit={2}>`;
   assert outer div height = 10000px.
4. **Explicit `scrollHeightPx` overrides all calculation:** Mount with
   `<ScrollStage scrollHeightPx={99999}>` regardless of scene count; assert height = 99999px.
5. **Sticky inner stage renders:** Inner div has `position: sticky`, `top: 0`,
   `overflow: hidden`, and `height: 100vh` (default `stageHeight`).
6. **Custom `stageHeight`:** When `stageHeight={480}`, inner div has `height: 480px`.
7. **Provides `ScrollRegionContext`:** A child consumer of `ScrollRegionContext` receives
   `{ containerRef, scrollHeightPx }` with the correct `scrollHeightPx` value.
8. **`EngineARContainerContext` interop:** When `computedArHeight = 640`, the inner stage
   div has `height: 640px` regardless of `stageHeight` prop.
9. **Children are rendered inside the sticky stage.**

**Test approach:** Mount `<SceneEngine plugins={[...]}><ScrollStage ...><ChildConsumer /></ScrollStage></SceneEngine>`.
Simulate `engine.sceneCount` and `engine.sceneTrack` via a test double that returns controlled
values. Assert computed heights via `container.querySelector` and `getComputedStyle` or
inline style inspection.

---

### 14.4 `ScrollInput` tests

**File:** `packages/core/src/player/__tests__/ScrollInput.test.tsx`

**What to cover:**
1. **Inertia mode:** wheel events accumulate in `pendingWheelDelta`; RAF tick decays velocity
   and calls `engine.setProgress()`; at boundaries, velocity zeroes.
2. **Inertia mode:** `pauseWhenHidden` pauses input and zeroes velocity.
3. **IScrollSource mode:** subscribe callback is called on mount; `engine.setRawProgress(raw)`
   is called with the value emitted by the source; unsubscribe is called on unmount.
4. **Window mode:** requires `ScrollRegionContext` — logs error when not inside `ScrollStage`.

**Test approach for inertia:** Mount `<SceneEngine><ScrollInput source="inertia" /></SceneEngine>`.
Spy on `engine.setProgress` via `useSceneEngineContext()` inside a test consumer. Fire fake
wheel events. Advance fake RAF via `vi.useFakeTimers()`.

**Test approach for IScrollSource:** Create a real `IScrollSource` double with controllable
emit:

```typescript
class TestScrollSource implements IScrollSource {
  private subscriber: ((raw: number) => void) | null = null;
  subscribe(cb: (raw: number) => void) {
    this.subscriber = cb;
    return () => { this.subscriber = null; };
  }
  emit(raw: number) { this.subscriber?.(raw); }
}
```

Mount with the test source; call `source.emit(0.5)`; assert `engine.setRawProgress(0.5)` was called.

### 14.5 `TimeInput` tests

**File:** `packages/core/src/player/__tests__/TimeInput.test.tsx`

**What to cover:**
1. Progress advances by `elapsed / duration` per frame.
2. `loop=true` wraps back to 0 at `max`.
3. `loop=false` clamps at `max`.
4. `pauseWhenHidden` pauses advance.
5. `resetOnExit=true` resets progress to 0 when hidden.
6. `resetOnExit=false` does not reset on hide.

**Test approach:** Use `vi.useFakeTimers()` + `vi.advanceTimersByTime()` to advance the RAF
loop. Assert `engine.setProgress()` call values.

### 14.6 `KeyboardInput` tests

**File:** `packages/core/src/player/__tests__/KeyboardInput.test.tsx`

**What to cover:**
1. Arrow right / space → calls `engine.setProgress(current + 1/(N-1))`.
2. Arrow left → calls `engine.setProgress(current - 1/(N-1))`.
3. When `ControlledProgressContext.onChange` is present, calls `onChange` instead of engine.
4. `manageFocus=true` renders a focusable div; focus on pointer down.
5. `pauseWhenHidden` stops responding to key events.

**Test approach:** Mount `<SceneEngine><KeyboardInput /></SceneEngine>`. Fire keyboard events
via `fireEvent.keyDown()`. Assert engine state changes.

### 14.7 `PointerInput` tests

**File:** `packages/core/src/player/__tests__/PointerInput.test.tsx`

**What to cover:**
1. Click mode: click → advance one scene.
2. Click mode: `loop=true` → wraps from last scene to 0.
3. Hover mode: mouse position at 50% width → engine.setProgress(0.5).
4. `pauseWhenHidden` stops responding to events.

### 14.8 `ControlledInput` tests

**File:** `packages/core/src/player/__tests__/ControlledInput.test.tsx`

**What to cover:**
1. Mounts and calls `engine.setProgress(value)` on mount.
2. When `value` prop changes, calls `engine.setProgress(newValue)`.
3. Provides `ControlledProgressContext` with the given `onChange`.
4. A `KeyboardInput` sibling reads `ControlledProgressContext` and calls `onChange` on key events.

### 14.9 `SceneReel` tests

**File:** `packages/core/src/player/__tests__/SceneReel.test.tsx`

**What to cover:**
1. Renders a container div with the specified `width` and `height`.
2. Renders `SceneCanvas` and `EngineOverlayHost` automatically.
3. Children (including `<Scene>`) are forwarded to the inner `SceneEngine`.
4. `plugins` prop forwarded to `SceneEngine`; omitted `plugins` inherits from parent.
5. `EngineARContainerContext` `computedArHeight` overrides `height` when non-zero.

### 14.10 `useNativeScrollSource` tests

**File:** `packages/core/src/player/__tests__/useNativeScrollSource.test.ts`

**What to cover:**
1. `subscribe` callback is called with raw progress on scroll.
2. `scrollTo(raw)` sets `div.scrollTop` proportionally.
3. Unsubscribe removes the subscriber.
4. Multiple subscribers are all called.

### 14.11 `useGoToScene` tests

**File:** `packages/core/src/player/__tests__/useGoToScene.test.tsx`

**What to cover:**
1. Navigation by id → calls `engine.setProgress(targetProgress)`.
2. Navigation by index → calls `engine.setProgress(targetProgress)`.
3. Unknown id → `console.warn`; no engine call.
4. When `ScrollNavigatorContext` is present → calls `source.scrollTo(rawProgress)`.

### 14.12 `useEngineState` tests

**File:** `packages/core/src/player/__tests__/useEngineState.test.tsx`

**What to cover:**
1. No id → reads from nearest `EngineStateContext`; throws when not in tree.
2. With id → reads from global registry; returns null when not mounted.
3. Updates live when the engine ticks (via registry subscription).

### 14.13 Spring integrator unit test

**File:** `packages/core/src/player/__tests__/scrollInertia.test.ts`

Tests the pure spring math functions extracted into a standalone module
`packages/core/src/player/scrollInertia.ts`:

```typescript
// scrollInertia.ts — pure functions, testable without DOM
export function computeInertiaStep(
  velocity: number,
  pendingDelta: number,
  inertiaSensitivity: number,
  inertiaDecay: number,
  currentProgress: number,
): { velocity: number; progress: number } {
  const newVelocity = (velocity + pendingDelta * inertiaSensitivity) * inertiaDecay;
  const newProgress = Math.max(0, Math.min(1, currentProgress + newVelocity));
  const clampedVelocity = (newProgress <= 0 || newProgress >= 1) ? 0 : newVelocity;
  return { velocity: clampedVelocity, progress: newProgress };
}
```

Tests:
1. Velocity decays by `inertiaDecay` factor each step.
2. Progress clamps at boundaries; velocity zeroes at boundary.
3. `pendingDelta` is applied once then zeroed (caller responsibility).
4. At `decay=0.88`, velocity halves in approximately 5.5 steps.

---

## 15. Work Streams

Five independent work streams with exclusive file ownership. No two streams touch the same
file simultaneously. Streams 2–4 can start only after Stream 1 is complete; Streams 2 and 3
are fully parallel with each other; Stream 4 requires completion of both 2 and 3; Stream 5
requires Stream 4.

---

### Stream 1 — Engine Context & Types (prerequisite for all other streams)

**Complexity:** High — touches the core hook, all context types, and establishes the API
boundary that all other streams depend on.

**Exclusive file ownership:**
- `packages/core/src/player/useSceneEngine.ts` (modified)
- `packages/core/src/player/engineTypes.ts` (modified)
- `packages/core/src/player/PluginInheritanceContext.tsx` (new)
- `packages/core/src/player/ScrollRegionContext.tsx` (new)
- `packages/core/src/player/ControlledProgressContext.tsx` (new)
- `packages/core/src/player/ScrollNavigatorContext.tsx` (new)
- `packages/core/src/player/scrollInertia.ts` (new — pure functions extracted from inertia)
- `packages/core/src/player/scrollSourceTypes.ts` (new — IScrollSource, ScrollSourceProp)
- `packages/core/src/player/usePauseWhenHidden.ts` (new — internal shared hook)
- `packages/core/src/player/EngineContext.tsx` (modified — error message update)
- `packages/core/src/player/EngineStateContext.ts` (modified — error message update)
- `packages/core/src/player/ScenePlayerRegistry.ts` (modified — warning message updates)
- `packages/core/src/player/__tests__/scrollInertia.test.ts` (new)

**What to implement:**
1. Modify `useSceneEngine.ts` per §5.1 — remove scroll/input options; add `setProgress`,
   `advanceProgress`, `sceneTrack`, `sceneCount`, `compiledScenes`, `progressMapper` to result.
2. Modify `engineTypes.ts` per §5.2 — delete `InputModePolicy`, `ScrollSource`.
3. Create four new context files: `PluginInheritanceContext`, `ScrollRegionContext`,
   `ControlledProgressContext`, `ScrollNavigatorContext` — each is ≤15 lines.
4. Create `scrollSourceTypes.ts` with `IScrollSource` and `ScrollSourceProp` (§2.1).
5. Create `scrollInertia.ts` with `computeInertiaStep` pure function.
6. Create `usePauseWhenHidden.ts` internal hook (§4.1).
7. Update error messages in `EngineContext.tsx`, `EngineStateContext.ts`, `ScenePlayerRegistry.ts`.

**Dependency provides to other streams:**
- `UseSceneEngineResult` shape (streams 2, 3, 4 read this)
- `PluginInheritanceContext` (streams 2, 4 need this)
- `ScrollRegionContext` (stream 3 needs this for ScrollInput)
- `ControlledProgressContext` (stream 3 needs this for ControlledInput + KeyboardInput)
- `ScrollNavigatorContext` (stream 3 + hook in stream 4 need this)
- `IScrollSource`, `ScrollSourceProp` (stream 3 needs this)
- `usePauseWhenHidden` (stream 3 needs this)
- `scrollInertia.ts` (stream 3 needs this)

---

### Stream 2 — Layout Components (parallel with Stream 3)

**Complexity:** Medium — new components with clear scope, no novel algorithms.

**Exclusive file ownership:**
- `packages/core/src/player/SceneEngine.tsx` (new)
- `packages/core/src/player/ScrollStage.tsx` (new)
- `packages/core/src/player/BackgroundLayer.tsx` (new)
- `packages/core/src/player/SceneCanvas.tsx` (modified)
- `packages/core/src/player/ScenePlayerRegistry.ts` (modified again — add canvas binding registry slot per §5.5)
- `packages/core/src/player/__tests__/SceneEngine.test.tsx` (new)
- `packages/core/src/player/__tests__/ScrollStage.test.tsx` (new)
- `packages/core/src/player/__tests__/BackgroundLayer.test.tsx` (new)

**What to implement:**
1. `SceneEngine.tsx` (§3.1) — plugin resolution, scene registration, context provision.
2. `ScrollStage.tsx` (§3.2) — scroll height computation, sticky DOM layout, provides `ScrollRegionContext`.
3. `BackgroundLayer.tsx` (§3.3) — tiny component wiring `engine.setBackgroundRef`.
4. Modify `SceneCanvas.tsx` (§3.4) — add `engineId` prop; add canvas binding registry slot per §5.5 to `ScenePlayerRegistry.ts`.
5. Tests for `BackgroundLayer` (§14.1), `SceneEngine` (§14.2), `ScrollStage` (§14.3).

**Important:** `SceneEngine.tsx` imports from `PluginInheritanceContext` (Stream 1 output).
`ScrollStage.tsx` imports from `ScrollRegionContext` (Stream 1 output). Begin after Stream 1's
context files are created.

**Sequencing constraint:** Depends on Stream 1 for all four new context files and the
updated `UseSceneEngineResult` type.

---

### Stream 3 — Input Components (parallel with Stream 2)

**Complexity:** High — five new components with diverse behavior patterns, spring physics,
IntersectionObserver, keyboard handling, and context interop.

**Exclusive file ownership:**
- `packages/core/src/player/ScrollInput.tsx` (new)
- `packages/core/src/player/TimeInput.tsx` (new)
- `packages/core/src/player/KeyboardInput.tsx` (new)
- `packages/core/src/player/PointerInput.tsx` (new)
- `packages/core/src/player/ControlledInput.tsx` (new)
- `packages/core/src/player/useNativeScrollSource.ts` (new)
- `packages/core/src/player/__tests__/ScrollInput.test.tsx` (new)
- `packages/core/src/player/__tests__/TimeInput.test.tsx` (new)
- `packages/core/src/player/__tests__/KeyboardInput.test.tsx` (new)
- `packages/core/src/player/__tests__/PointerInput.test.tsx` (new)
- `packages/core/src/player/__tests__/ControlledInput.test.tsx` (new)
- `packages/core/src/player/__tests__/useNativeScrollSource.test.ts` (new)

**What to implement:**
1. `ScrollInput.tsx` (§3.5) — inertia mode, window mode, element mode, IScrollSource mode.
   Uses `scrollInertia.ts` (Stream 1) and `ScrollRegionContext` (Stream 1) and `usePauseWhenHidden` (Stream 1).
2. `TimeInput.tsx` (§3.6) — RAF-based time advance with pause/reset.
3. `KeyboardInput.tsx` (§3.7) — reuses `InputController` class with keys-only config. Reads
   `ControlledProgressContext` (Stream 1).
4. `PointerInput.tsx` (§3.8) — click and hover modes.
5. `ControlledInput.tsx` (§3.9) — provides `ControlledProgressContext` (Stream 1).
6. `useNativeScrollSource.ts` (§4.2) — hidden scroll region pattern.
7. Tests for all (§14.4–14.10).

**Sequencing constraint:** Depends on Stream 1 for `IScrollSource`, `ScrollSourceProp`,
`ScrollRegionContext`, `ControlledProgressContext`, `ScrollNavigatorContext`, `usePauseWhenHidden`,
`scrollInertia.ts`, and updated `UseSceneEngineResult`.

---

### Stream 4 — SceneReel, Hooks, Exports & Deletions (requires Streams 2 + 3)

**Complexity:** Medium — assembly of already-built components plus hook consolidation and deletions.

**Exclusive file ownership:**
- `packages/core/src/player/SceneReel.tsx` (new)
- `packages/core/src/player/useGoToScene.ts` (new)
- `packages/core/src/player/useEngineState.ts` (new — unified hook)
- `packages/core/src/player/useEngineScrubber.ts` (modified)
- `packages/core/src/player/index.ts` (modified — final export surface)
- **Deleted files** (perform deletions):
  - `packages/core/src/player/EngineProvider.tsx`
  - `packages/core/src/player/EngineInputRegion.tsx`
  - `packages/core/src/player/ScrollCaptureSection.tsx`
  - `packages/core/src/player/useEngineScroll.ts`
  - `packages/core/src/player/useEngineInput.ts`
  - `packages/core/src/player/effectiveInputSpec.ts`
  - `packages/core/src/player/__tests__/useEngineScroll.test.tsx`
  - `packages/core/src/player/__tests__/useEngineInput.test.tsx`
  - `packages/core/src/player/__tests__/effectiveInputSpec.test.ts`
- `packages/core/src/player/__tests__/SceneReel.test.tsx` (new)
- `packages/core/src/player/__tests__/useGoToScene.test.tsx` (new)
- `packages/core/src/player/__tests__/useEngineState.test.tsx` (new)
- `packages/core/MIGRATION.md` (new)
- `packages/core/README.md` (modified — rewrite for v2 API)
- `packages/core/CHANGELOG.md` (modified — add v2.0.0 entry)

**What to implement:**
1. `SceneReel.tsx` (§3.10) — composes `SceneEngine` + layout + `SceneCanvas` + `BackgroundLayer`
   + `EngineOverlayHost`.
2. `useGoToScene.ts` (§4.3) — programmatic navigation with optional scroll source sync.
3. `useEngineState.ts` (§4.4) — unified hook replacing `useEngineState()` and `useSceneEngineState(id)`.
4. Modify `useEngineScrubber.ts` (§4.5) — update options to remove external callbacks.
5. Update `index.ts` (§13) — new export surface.
6. Perform all deletions.
7. Write `packages/core/MIGRATION.md` (v1→v2 translation guide, including all patterns from §12
   and the `useEngineScrubber` migration from §12.5).
8. Rewrite `packages/core/README.md` for the v2 API — remove all references to `EngineProvider`,
   `EngineInputRegion`, `ScenePlayer`, `ScrollCaptureSection`, `useEngineScroll`, `useEngineInput`.
   Document the v2 component hierarchy with a quick-start for each major pattern:
   - Full-page marketing (`SceneEngine` + `ScrollStage` + `ScrollInput source="window"`)
   - Embedded reel (`SceneReel` + `PointerInput` or `TimeInput`)
   - Slide deck (`SceneReel` + `KeyboardInput`)
   - Complex layout with sidebar nav (`SceneEngine` + bare layout + `useGoToScene`)
   - App-level plugin hoisting (root `SceneEngine` zero-scene mode)
9. Add `v2.0.0` entry to `packages/core/CHANGELOG.md` documenting:
   - **Breaking:** deleted exports (`EngineProvider`, `EngineInputRegion`, `ScenePlayer`,
     `ScrollCaptureSection`, `useEngineScroll`, `useEngineInput`, `InputModePolicy`,
     `ScrollSource`, `useSceneEngineState`)
   - **New:** all new exports (`SceneEngine`, `ScrollStage`, `BackgroundLayer`, `SceneReel`,
     `ScrollInput`, `TimeInput`, `KeyboardInput`, `PointerInput`, `ControlledInput`,
     `IScrollSource`, `useNativeScrollSource`, `useGoToScene`, unified `useEngineState(id?)`)
   - **Changed:** `useEngineScrubber` (options type removed — see MIGRATION.md)
   - **Pointer:** `See packages/core/MIGRATION.md for v1→v2 translation of every deleted component.`
10. Tests for SceneReel, useGoToScene, useEngineState (§14.9–14.12).

**Sequencing constraint:** Depends on Streams 2 (SceneEngine is available to import) and
3 (all input components available for export). Can begin as soon as both complete.

---

### Stream 5 — App Migration (requires Stream 4)

**Complexity:** Low per file, high in total volume.

**Exclusive file ownership:**
- All `apps/examples/src/**/*.tsx` and `apps/examples/src/**/*.ts` files
- All `apps/website/src/**/*.tsx` and `apps/website/src/**/*.ts` files
- All `apps/docs/src/**/*.tsx` and `apps/docs/src/**/*.ts` files

**What to implement:**
1. Migrate all `apps/examples/src/*/` page components per §12.2 pattern.
2. Migrate `apps/website/src/landing/LandingPage.tsx` per §12.3.
3. Migrate `apps/docs/src/demos/shared/DemoScene.tsx` per §12.4.
4. Update inline code example strings in docs page components to show v2 API.
5. Run `pnpm typecheck` for all three apps; fix any residual type errors.
6. Run `pnpm test` across all packages; fix any test failures from import changes.

**No widgetSetup.ts files require changes** — `createXxxPlugins()` patterns are
identical in v2.

**Sequencing constraint:** Requires Stream 4 to be complete (all new exports available in
`packages/core/src/player/index.ts`).

---

## Appendix A: Stream Dependency Graph

```
Stream 1: Engine Context & Types
         │
         ├──────────────────────────────────┐
         ▼                                  ▼
Stream 2: Layout Components        Stream 3: Input Components
         │                                  │
         └──────────────────────────────────┘
                        │
                        ▼
            Stream 4: SceneReel, Hooks, Exports, Deletions
                        │
                        ▼
                Stream 5: App Migration
```

---

## Appendix B: Open Questions Resolved

Per PRD §12:

1. **`ProgressManager.autoAdvance` vs `TimeInput` coexistence:** `ProgressManager.autoAdvance`
   governs per-scene auto-advance inside the RuntimeDriver. `TimeInput` governs global
   player-level advance. Both can coexist: `TimeInput` reads `engine.frameState.progress`
   and advances from current position; `ProgressManager.autoAdvance` advances from the
   scene's internal progress. If both are active for the same scene, the RuntimeDriver's
   advance and `TimeInput`'s advance both apply in the same RAF frame — the last write wins.
   Consumers should not combine both mechanisms for the same scene.
   **Document in `MIGRATION.md`.**

2. **`engine.goToScene()` in scroll mode:** Resolved via `useGoToScene()` hook (§4.3).
   `goToScene` is not on the engine context directly — use the hook. In scroll mode with
   `ScrollNavigatorContext` available, the hook calls `source.scrollTo()`. Consumers
   using sidebar nav call `useGoToScene()`.

3. **`EngineARContainer` + `SceneReel` interaction:** `SceneReel` reads `EngineARContainerContext`
   for `computedArHeight` (§3.10). When non-zero, overrides the `height` prop. Verified by
   `SceneReel.test.tsx` test §14.9.5.

4. **`ControlledInput` + `KeyboardInput` coexistence:** `KeyboardInput` reads
   `ControlledProgressContext` (provided by `ControlledInput`) and calls `onChange` when
   present (§3.7, §3.9). Consumers must wire `onChange` on `ControlledInput` if they want
   `KeyboardInput` to update the controlled state.

5. **Hook consolidation:** Resolved — `useEngineState(id?)` is the unified hook (§4.4).
   `useSceneEngineState(id)` is deleted. `useEngineState()` (no id) reads local context.
   `useEngineState(id)` (with id) reads global registry.
