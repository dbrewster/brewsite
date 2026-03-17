---
title: "Composable Player Architecture (v2)"
doc_type: prd
status: accepted
owner: Toolkit Product
last_updated: 2026-03-09
change_history:
  - date: 2026-03-09
    author: Toolkit Product
    summary: >
      Initial PRD. Defines the v2 player API decomposition: SceneEngine, ScrollStage,
      input primitive components, SceneReel, BrewSiteProvider, VisibilityGate, and
      SceneNav. Documents full deprecation path for EngineProvider, EngineInputRegion,
      ScenePlayer, and ScrollCaptureSection. This is a planned major-version (v2) change.
  - date: 2026-03-09
    author: Toolkit Product
    summary: >
      Resolved Open Question 1. Added IScrollSource interface as the extension point for
      custom scroll position providers. Updated ScrollInput.source prop to accept
      IScrollSource in addition to built-in shorthands. Added useNativeScrollSource hook
      for hidden-scroll-region pattern. Documented Lenis / third-party library integration
      pattern. Added IScrollSource to new exports list.
  - date: 2026-03-09
    author: Toolkit Product (PM-1/PM-2 debate round 1)
    summary: >
      Simplification pass. Removed SceneNav (hooks cover the use case), VisibilityGate
      component (merged into pauseWhenHidden prop on each input component), SceneReelRegistry
      singleton (keyboard-auto mode removed), and BrewSiteProvider (replaced by SceneEngine
      zero-scene mode for plugin hoisting). Rewrote SceneReel to accept input components as
      children — removed the ReelInputMode type union entirely. Updated all usage patterns,
      §6 FRs, §7 API design, §8.7, §10, §11 risks, §12 open questions, and §13 launch criteria.
  - date: 2026-03-09
    author: Toolkit Product
    summary: >
      Removed all backward compatibility constraints. No shims, no deprecation wrappers.
      Old components (EngineProvider, EngineInputRegion, ScenePlayer, ScrollCaptureSection)
      are deleted; apps are migrated. Hook API is open for improvement. Success criteria
      reframed around API quality and minimal surface area, not migration ease.
      Rewrote §9 (Breaking Change Assessment → Clean-Cut Migration). Updated §3 guardrails,
      §6 FRs 17 and 21, §8.2, and §13 launch criteria accordingly.
  - date: 2026-03-09
    author: Toolkit Product
    summary: >
      Implementation complete and verified. Status changed from draft to accepted.
      All components (SceneEngine, ScrollStage, SceneReel, BackgroundLayer, ScrollInput,
      TimeInput, KeyboardInput, PointerInput, ControlledInput), hooks (useEngineState,
      useGoToScene, useNativeScrollSource), and types (IScrollSource, ScrollSourceProp)
      are shipped. All v1 symbols (EngineProvider, EngineInputRegion, ScenePlayer,
      ScrollCaptureSection, useEngineScroll, useEngineInput, useSceneEngineState) are
      deleted. All apps migrated. MIGRATION.md published.
---

## 1. Overview

This PRD defines the v2 architecture for the `@brewsite/core` player layer — the surface that
consumers use to embed and drive animated 3D scenes. The redesign decomposes the current
monolithic `EngineProvider` + `EngineInputRegion` into clearly separated primitives:

- **`SceneEngine`** — pure logic provider (replaces `EngineProvider`)
- **`SceneCanvas`** — WebGL rendering surface (unchanged role, minor additions)
- **`ScrollStage`** — DOM layout helper for the full-page sticky-canvas pattern (replaces `EngineInputRegion`)
- **Input components** — `ScrollInput`, `TimeInput`, `KeyboardInput`, `PointerInput`, `ControlledInput`
- **`pauseWhenHidden` prop** — input components self-gate via `IntersectionObserver` when configured
- **`SceneReel`** — layout wrapper for embedded/docs/slides use cases (engine + canvas + background + overlay)
- **`SceneEngine` zero-scene mode** — plugin hoisting at app/page level; nested engines inherit plugins

This change also introduces first-class support for embedded, inline animations (`SceneReel`)
alongside the existing full-page marketing experience, and replaces the DOM-scroll-region
inertia model with a spring-physics integrator that requires no DOM scroll infrastructure.

Affects: `@brewsite/core` (player layer only). The compiler, widget SDK, element modules,
and all sub-packages (`@brewsite/diagram`, `@brewsite/model`, `@brewsite/charts`) are
unaffected at the architecture level.

---

## 2. Problem Statement

The current `EngineProvider` + `EngineInputRegion` pair was designed for a single use case:
a full-page sticky-canvas marketing experience where the WebGL canvas IS the page and scroll
IS scene progression. This assumption is now baked into every layer of the player API:

- `EngineProvider` owns scroll geometry (tall spacer height), input mode policy, and plugin
  configuration simultaneously — three unrelated concerns on one component.
- `EngineInputRegion` fuses DOM layout (sticky container), focus management (keyboard capture),
  scroll-mode vs. direct-mode branching, and the background DOM layer into one component with
  no clean decomposition point.
- Embedding multiple independent animations on one page (docs use case) requires awkward
  workarounds and produces N full-page engine instances that compete for scroll.
- The inertia model requires a real DOM scroll region, which forces consumers to accept
  BrewSite-owned page geometry even when they want to control their own layout.
- There is no clean way to have an engine provider live above a layout split (e.g., sidebar
  nav + main canvas in separate DOM subtrees) without the current `id`-based registry
  workaround.
- `ScenePlayer` (the convenience wrapper) cannot be adapted for the embedded/docs case without
  adding more props and branching logic to an already-large API surface.

The result: any use case beyond full-page marketing requires consumers to fight the API rather
than compose it.

---

## 3. Goals & Success Metrics

**Primary goals:**
- A consumer can embed N independent animated reels on one page with one line each: `<SceneReel>`.
- A consumer can build a complex layout (engine above sidebar + canvas in separate DOM branches)
  with no workarounds or registry hacks.
- The full-page marketing pattern is supported idiomatically by the new API.
- There is no DOM scroll region in the default path — inertia is provided by a spring integrator.

**Success metrics:**
- Integration step count for the embedded reel use case: ≤ 3 lines (SceneReel + scenes + canvas).
- TypeScript prop surfaces: `SceneEngine` props count ≤ 50% of current `EngineProvider` props
  (scroll/input props moved to their respective components).
- Bundle size delta for the new input component tree: ≤ +2 KB gzipped over current.
- All new components covered by interface-based stateful tests.
- API can be learned and used correctly from README alone — no prior EngineProvider knowledge required.

**Guardrail metrics:**
- No breaking change to the compiler, widget SDK, element DSL, or sub-package public APIs.
  (This change is scoped to the player layer only; compiler and widget SDK are unaffected.)

---

## 4. Non-Goals

- Changes to the compiler pipeline, SceneTrack model, or ProgressManager.
- Changes to any widget SDK interfaces (IWidget, ISceneElement, etc.).
- Changes to element modules (Camera, Lighting, Background, etc.).
- Changes to `@brewsite/diagram`, `@brewsite/model`, or `@brewsite/charts` public APIs.
- A general-purpose virtual scroll / docs content loader — that is a consuming-app concern.
- CSS scroll-driven animations (`animation-timeline`) integration — not viable cross-browser
  and cannot drive Three.js.
- Server-side rendering changes — SSR policy remains as defined in EngineProvider today.

---

## 5. Consumer Stories

1. **As a toolkit consumer building a docs page**, I want to drop a `<SceneReel>` into my
   article content so that a 3D animation plays when the user scrolls to it, without
   configuring scroll regions or engine plumbing.

2. **As a toolkit consumer building a slide deck**, I want a full-screen canvas driven by
   keyboard navigation, using one concise component tree.

3. **As a toolkit consumer building a docs sidebar + canvas layout**, I want to declare the
   engine once above both the sidebar nav and the main canvas area so that both can consume
   engine state without a registry workaround.

4. **As a toolkit consumer building a full-page marketing page**, I want the current
   full-page sticky-canvas pattern to continue working with a minimal rename/refactor.

5. **As a toolkit consumer**, I want trackpad inertia to feel natural without needing to
   configure a DOM scroll region — it should just work.

6. **As a toolkit consumer**, I want to configure plugins once above multiple `<SceneReel>`
   instances so that I do not repeat the plugin array on every engine.

7. **As a toolkit consumer**, I want a reel's input to pause automatically when the reel
   scrolls out of view, without wrapping it in a separate component.

---

## 6. Functional Requirements

1. `SceneEngine` shall be a pure React context provider with zero DOM output.
2. `SceneEngine` shall accept `<Scene>` components as children and compile them into a
   `SceneTrack` exactly as `EngineProvider` does today.
3. `SceneEngine` shall be placeable at any level of the React tree; any number may coexist
   on one page independently.
4. `SceneCanvas` shall render a WebGL canvas sized by its parent, unchanged from today.
5. `ScrollStage` shall create the tall-spacer + sticky-stage DOM structure, computing scroll
   region height from the engine's compiled `SceneTrack` (via `SceneEngineContext`).
6. `ScrollInput` shall drive engine progress from `window.scrollY` (or a configured element
   ref) when paired with `ScrollStage`, and shall optionally drive progress via a spring-decay
   inertia integrator from wheel events when used without `ScrollStage`.
7. `TimeInput` shall drive engine progress via wall-clock auto-advance with configurable
   duration, loop, and reset-on-exit behavior.
8. `KeyboardInput` shall capture keyboard events for scene navigation and shall own focus
   management (tabIndex, onPointerDown focus capture) previously handled by `EngineInputRegion`.
9. `PointerInput` shall support `click` mode (advance on click) and `hover` mode (scrub on
   hover).
10. `ControlledInput` shall accept an external `value` prop and drive engine progress directly,
    replacing the `controlledProgress` prop on `EngineProvider`.
11. Input components (`ScrollInput`, `TimeInput`, `KeyboardInput`, `PointerInput`) shall
    accept a `pauseWhenHidden` prop (`{ x?: number; y?: number }`) that uses
    `IntersectionObserver` to pause the component when its nearest positioned ancestor falls
    below the specified intersection threshold. `ControlledInput` does not support this prop.
12. `SceneReel` shall compose `SceneEngine` + `SceneCanvas` + `BackgroundLayer` +
    `EngineOverlayHost` into a sized, overflow-hidden container. Input components are
    provided by consumers as children — `SceneReel` does not own or configure input mode.
13. `SceneEngine` shall support zero scenes as valid (config-only / plugin-hoisting mode).
    A `SceneEngine` with no `<Scene>` children produces an empty compiled track and provides
    plugin configuration to all nested `SceneEngine` and `SceneReel` instances that omit
    their own `plugins` prop. This replaces the need for a separate `BrewSiteProvider`.
14. Multiple input components may coexist under one `SceneEngine`; `ControlledInput` has
    highest priority, user-initiated input (keyboard, pointer, scroll gesture) has next
    priority, and `TimeInput` (auto-advance) has lowest priority and yields to user input.
15. `EngineProvider`, `EngineInputRegion`, `ScenePlayer`, and `ScrollCaptureSection` are
    deleted. No compatibility shims are provided. `apps/examples/` and `apps/website/` are
    migrated to the v2 API as part of this release. `MIGRATION.md` documents the v1→v2
    translation for external consumers.
16. `EngineARContainer` shall remain unchanged.
17. `EngineGate` shall remain unchanged.
18. `EngineOverlayHost` shall remain unchanged.
19. The hook API is evaluated for simplification. `useEngineScroll` and `useEngineInput`
    are deleted (replaced by input components). Remaining hooks (`useCurrentScene`,
    `useSceneProgress`, `useSceneEngineState`, `useEngineState`, `useSceneRuntime`,
    `useEngineScrubber`) are retained pending debate review — changes are permitted where
    they produce a cleaner API.

---

## 7. API Design

### 7.1 App-level plugin hoisting (`SceneEngine` zero-scene mode)

`SceneEngine` supports zero scenes as valid (config-only mode). A root-level `SceneEngine`
with no `<Scene>` children produces an empty compiled track and a running engine that provides
plugin configuration to all nested `SceneEngine` and `SceneReel` instances. Nested instances
that omit their own `plugins` prop inherit from the nearest ancestor `SceneEngine` context.

No separate `BrewSiteProvider` export is needed. One component type — `SceneEngine` — serves
both the config-only role and the scene-running role.

```tsx
// App root — SceneEngine with no scenes; just plugin config
<SceneEngine plugins={[corePlugin(), modelPlugin({ manifestUrl: '/manifest.json' }), diagramPlugin()]}>
  <App />   {/* SceneReel and SceneEngine instances inside inherit plugins */}
</SceneEngine>

// Anywhere in the tree — plugins prop omitted; inherited from root
<SceneReel height={400}>
  <Scene id="demo">...</Scene>
  <TimeInput duration={6} loop />
  <SceneCanvas />
</SceneReel>
```

Plugin resolution order for any `SceneEngine` or `SceneReel`:
1. Own `plugins` prop if set → use as-is (overrides ancestor).
2. Nearest ancestor `SceneEngine` context if no own `plugins` → inherit.
3. Neither → `console.error` and use empty plugin list.

---

### 7.2 `SceneEngine` (replaces `EngineProvider`)

```tsx
interface SceneEngineProps {
  /** Registers engine state in the global registry for cross-tree useSceneEngineState(id). */
  id?: string;

  /**
   * Widget plugins. Overrides ancestor SceneEngine plugin context when set.
   * Required if no ancestor SceneEngine provides plugins via zero-scene mode.
   */
  plugins?: WidgetPlugin[];

  timingProfile?: EngineTimingProfile;

  /** The widget id of the camera to use as the primary scene camera. */
  primaryCameraId?: string;

  /** The widget id of the canvas that receives action-based camera input (orbit, dolly, focus). */
  primaryCanvasActionTargetId?: string;

  cameraInteractionDefaults?: CameraInteractionDefaults;

  /**
   * Increment to force recompilation of the SceneTrack when scene DSL
   * hasn't structurally changed but content has (e.g., dynamic asset URLs).
   */
  invalidateCacheToken?: number | string;

  /** Max animation-seconds that may advance in a single frame tick during fast scroll/input.
   *  Prevents runaway animation during fast gesture sweeps. */
  maxAnimBoostPerFrame?: number;

  sceneTheme?: SceneTheme;

  onReady?: () => void;
  onError?: (error: Error) => void;
  onWidgetError?: (widgetId: string, error: Error) => void;
  onCompileWarning?: (warnings: CompileWarning[]) => void;

  /** All children — <Scene> declarations, layout, overlay hosts, input components, siblings. */
  children: ReactNode;
}
```

**Props removed from `EngineProvider` that do NOT appear on `SceneEngine`** — they move to the
components that own those concerns:

| Old `EngineProvider` prop | Moves to |
|---|---|
| `scrollSource` | `ScrollInput` |
| `scrollHeightMode` | `ScrollStage` |
| `pixelsPerScrollUnit` | `ScrollStage` |
| `pixelsPerScene` | `ScrollStage` |
| `scrollHeightPx` | `ScrollStage` |
| `inputModePolicy` | Removed — replaced by explicit input components |
| `controlledProgress` | `ControlledInput` |
| `onControlledProgressChange` | `ControlledInput` |
| `enableKeyboardInControlledMode` | `KeyboardInput` |
| `controlledInputMap` | `KeyboardInput` |
| `inputMap` | `KeyboardInput` / `ScrollInput` |
| `manifestUrl` | Removed — was already deprecated; pass to `modelPlugin()` |
| `fpsCap` | Folded into `timingProfile.fpsCap` — was already duplicated |
| `framesPerTick` | Folded into `timingProfile.blockSize` — was already duplicated |
| `quality` | Folded into `timingProfile.qualityPreset` — was already duplicated |

---

### 7.3 `SceneCanvas` (unchanged role, minor additions)

```tsx
interface SceneCanvasProps {
  className?: string;
  style?: CSSProperties;

  /**
   * Binds this canvas to a specific named engine when SceneCanvas is not a
   * descendant of the target SceneEngine in the React tree.
   * Reads from ScenePlayerRegistry by id.
   * For standard usage (canvas inside engine provider), omit this prop.
   */
  engineId?: string;
}
```

`SceneCanvas` itself does not own the background layer div — that is the responsibility of
the containing `ScrollStage` or `SceneReel`. Consumers using raw `SceneEngine` +`SceneCanvas`
in custom layouts must provide their own background layer or accept that the `<Background>`
element will render to a div they supply (see §7.4 background layer note).

---

### 7.4 `ScrollStage` (replaces `EngineInputRegion` scroll mode + `ScrollCaptureSection`)

`ScrollStage` is the DOM layout component for the full-page sticky-canvas pattern. It:
1. Creates the tall outer div (scroll spacer) at the correct height computed from the
   engine's compiled SceneTrack.
2. Creates the `position: sticky; top: 0` inner stage.
3. Provides the background DOM layer (the `engine.setBackgroundRef` div) at z-index 0.
4. Renders children at z-index 1.
5. Sets `overscrollBehavior: none` on the outer container.

```tsx
interface ScrollStageProps {
  /**
   * How the scroll region height is computed from the compiled SceneTrack.
   *
   * 'scene-count'  — height = pixelsPerScene × sceneCount (default)
   * 'scroll-units' — height = totalScrollUnits × pixelsPerScrollUnit
   */
  scrollHeightMode?: 'scene-count' | 'scroll-units';

  /** Pixels per scene when scrollHeightMode='scene-count'. Default: 1200. */
  pixelsPerScene?: number;

  /** Pixels per scroll unit when scrollHeightMode='scroll-units'. Default: 1. */
  pixelsPerScrollUnit?: number;

  /**
   * Exact scroll region height in pixels. Overrides all automatic calculations.
   * Use when an external system (e.g., sidebar with precomputed scene offsets)
   * must stay in sync with window.scrollY.
   */
  scrollHeightPx?: number;

  /**
   * Height of the sticky stage. Default: '100vh'.
   * Set to a pixel value for embedded players with a fixed parent height.
   */
  stageHeight?: string | number;

  className?: string;
  stageClassName?: string;
  children: ReactNode;
}
```

**Background layer note:** `ScrollStage` (and `SceneReel` internally) provides a background
div wired to `engine.setBackgroundRef`. For custom layouts using raw `SceneEngine` +
`SceneCanvas` without `ScrollStage`, consumers must render a `<BackgroundLayer>` component
(or equivalent div) to enable the `<Background>` element. `BackgroundLayer` is a new minimal
export — `position: absolute; inset: 0; z-index: 0` — that wires `engine.setBackgroundRef`.

```tsx
// BackgroundLayer — new minimal export
// Required in custom layouts that use the <Background> DSL element.
<BackgroundLayer />
```

---

### 7.5 Input Components

All input components consume `SceneEngineContext` and drive engine progress directly. They
render no visible DOM (they may render a focus-capture div). Multiple input components may
coexist under one `SceneEngine`; priority is: `ControlledInput` > user-initiated gesture
> `TimeInput`.

#### `IScrollSource` (new interface — exported)

The extension point for custom scroll position providers. Any object implementing this
interface can be passed as `source` to `ScrollInput` (and to `SceneReel` when
`input.mode='scroll'`).

```ts
interface IScrollSource {
  /**
   * Subscribe to raw progress updates [0, 1].
   * The callback is called whenever the scroll position changes.
   * Returns an unsubscribe function; called on cleanup.
   */
  subscribe(onProgress: (rawProgress: number) => void): () => void;

  /**
   * Optional. Programmatically set the scroll position.
   * Called by goToScene(), scrollToProgress(), and any internal engine
   * navigation. If omitted, programmatic navigation is a no-op for this source.
   */
  scrollTo?(rawProgress: number): void;
}
```

The three built-in scroll modes are `IScrollSource` implementations under the hood.
Consumers may implement `IScrollSource` to wrap any scroll library (Lenis, Virtual Scroll,
a hidden native scroll region, etc.) and pass it directly to `ScrollInput`.

---

#### `ScrollInput`

```tsx
/**
 * Source type for ScrollInput.
 *
 * 'inertia'       — spring-decay velocity integrator on wheel events.
 *                   No DOM scroll region needed. Default for SceneReel scroll mode.
 * 'window'        — reads window.scrollY. Must be paired with ScrollStage.
 * { elementRef }  — reads element.scrollTop. Must be paired with ScrollStage.
 * IScrollSource   — custom implementation. Full control over progress production
 *                   and programmatic scroll. Use for Lenis, hidden native scroll
 *                   regions, or any other scroll provider.
 */
type ScrollSourceProp =
  | 'inertia'
  | 'window'
  | { elementRef: RefObject<HTMLElement | null> }
  | IScrollSource;

interface ScrollInputProps {
  /**
   * The scroll source. Default: 'inertia'.
   * Use 'window' with ScrollStage for the full-page marketing pattern.
   * Use 'inertia' or a custom IScrollSource for embedded / docs / reel contexts.
   */
  source?: ScrollSourceProp;

  // ── Inertia options (apply when source='inertia') ──────────────────────────

  /** Spring decay factor per frame at ~60fps. Default: 0.88. */
  inertiaDecay?: number;

  /** Wheel delta multiplier for the spring integrator. Default: 0.0003. */
  inertiaSensitivity?: number;

  /** Key bindings for scroll-amount-per-keypress. */
  inputMap?: SceneNavInputMap;

  /**
   * Pause scroll input when the nearest positioned ancestor falls below this
   * IntersectionObserver threshold. Inertia mode: zeroes velocity on pause.
   * Default: undefined (no visibility gating).
   */
  pauseWhenHidden?: { x?: number; y?: number };
}
```

**When `source='window'`:** reads `window.scrollY`, maps through `SceneProgressMapper`
to engine progress. Must be paired with `ScrollStage`. This is the full-page marketing path.

**When `source='inertia'` (default):** captures wheel events via a focus-capture div, applies
the spring-decay integrator, drives progress directly. No `ScrollStage` needed. This is the
default embedded context.

**When `source` is an `IScrollSource`:** `ScrollInput` calls `source.subscribe()` in a
`useEffect`, forwarding progress values to the engine each time the callback fires.
Programmatic navigation (`ControlledInput`, etc.) calls `source.scrollTo()` if present.

---

#### `useNativeScrollSource` (new hook — exported)

For consumers who want native browser scroll physics (OS-level momentum curves, rubber-band
on iOS Safari, accessibility scroll actions) without a visible tall spacer div. Creates and
manages a hidden off-screen scroll container. Returns an `IScrollSource` and a ref to attach
to the hidden div.

```tsx
interface UseNativeScrollSourceOptions {
  /** Total scroll distance in pixels. Update when scene count or scrollUnits change. */
  heightPx: number;
}

interface UseNativeScrollSourceResult {
  /** Pass to ScrollInput source prop. */
  source: IScrollSource;
  /** Attach to the hidden scroll container div. */
  ref: RefObject<HTMLDivElement>;
}

function useNativeScrollSource(options: UseNativeScrollSourceOptions): UseNativeScrollSourceResult;

// Usage:
const { source, ref } = useNativeScrollSource({ heightPx: totalScrollUnits });

// Render the hidden scroll region anywhere in the tree (outside layout flow):
<div
  ref={ref}
  style={{
    position: 'fixed', top: 0, left: -1, width: 1, height: '100vh',
    overflowY: 'scroll', pointerEvents: 'none',
  }}
  aria-hidden="true"
>
  <div style={{ height: totalScrollUnits }} />
</div>

// Wire to the engine:
<SceneEngine>
  <Scene id="hero">...</Scene>
  <ScrollInput source={source} />
  <SceneCanvas />
</SceneEngine>
```

The hidden div captures native scroll events from the OS (forwarded via `wheel` event
listeners on `window`). This gives identical physics to a visible scroll region while
keeping BrewSite out of the page layout.

---

#### Custom source example — wrapping Lenis

```ts
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

// Then:
const source = useLenisSource(lenis, TOTAL_SCROLL_PX);
<ScrollInput source={source} />
```

---

#### `TimeInput`

```tsx
interface TimeInputProps {
  /** Seconds to traverse the full scene sequence from progress 0 to `max`. Required. */
  duration: number;

  /** Maximum progress fraction to advance to. Default: 1.0. */
  max?: number;

  /** Loop back to 0 when max is reached. Default: false. */
  loop?: boolean;

  /**
   * Reset progress to 0 when pauseWhenHidden triggers (element leaves viewport).
   * Default: true.
   */
  resetOnExit?: boolean;

  /**
   * Pause auto-advance after user interaction (scroll, click, keyboard).
   * User must re-engage to resume. Default: false.
   */
  pauseOnInteraction?: boolean;

  /**
   * Pause time-based advance when the nearest positioned ancestor falls below this
   * IntersectionObserver threshold. Default: undefined (no visibility gating).
   */
  pauseWhenHidden?: { x?: number; y?: number };
}
```

`TimeInput` is the time-based equivalent of `ProgressManager.autoAdvance` but at the player
level rather than the per-scene DSL level. When both `TimeInput` and `ProgressManager.autoAdvance`
are present, `ProgressManager.autoAdvance` takes per-scene precedence for its declared scenes;
`TimeInput` governs scenes that declare no `autoAdvance`.

---

#### `KeyboardInput`

```tsx
interface KeyboardInputProps {
  /** Key bindings for prev/next navigation. Default: arrow keys + space. */
  inputMap?: SceneNavInputMap;

  /**
   * When true, renders a focus-capture div (tabIndex={-1}, onPointerDown focus)
   * to receive keyboard events on click. Default: true.
   * Set to false if the parent already manages focus.
   */
  manageFocus?: boolean;

  /**
   * Release keyboard focus and stop responding to key events when the nearest
   * positioned ancestor falls below this IntersectionObserver threshold.
   * Default: undefined (no visibility gating).
   */
  pauseWhenHidden?: { x?: number; y?: number };
}
```

`KeyboardInput` assumes the focus management that `EngineInputRegion` previously provided
via `tabIndex={-1}` and `onPointerDown`.

---

#### `PointerInput`

```tsx
interface PointerInputProps {
  /** 'click' — advance to next scene on click. 'hover' — scrub progress on hover. */
  mode: 'click' | 'hover';

  /**
   * For hover mode: pixels of horizontal hover movement that correspond to
   * one full scene advancement. Default: 200.
   */
  sensitivity?: number;

  /** For click mode: wrap back to scene 0 after last scene. Default: false. */
  loop?: boolean;

  /**
   * Stop responding to pointer events when the nearest positioned ancestor falls below
   * this IntersectionObserver threshold. Default: undefined (no visibility gating).
   */
  pauseWhenHidden?: { x?: number; y?: number };
}
```

---

#### `ControlledInput`

```tsx
interface ControlledInputProps {
  /** Normalized engine progress [0, 1]. Drives the engine directly each frame. */
  value: number;

  /**
   * Called when the engine internally sets progress (e.g., prev/next keyboard
   * shortcuts when keyboard input is also present). Wire to the state setter
   * that feeds `value`.
   */
  onChange?: (p: number) => void;
}
```

Replaces the `controlledProgress` / `onControlledProgressChange` props on `EngineProvider`.

---

### 7.6 Visibility gating (via `pauseWhenHidden` prop)

There is no `VisibilityGate` component. Visibility gating is a `pauseWhenHidden` prop on
each input component that needs it (`ScrollInput`, `TimeInput`, `KeyboardInput`,
`PointerInput`). Each component manages its own `IntersectionObserver` instance, observing
its nearest positioned ancestor.

```ts
// Shared prop shape — appears on ScrollInput, TimeInput, KeyboardInput, PointerInput:
pauseWhenHidden?: {
  x?: number;  // fraction of width visible. Default: 0.0
  y?: number;  // fraction of height visible. Default: 0.8
};
```

Behavior per component:
- `TimeInput`: pauses advance; resets to 0 if `resetOnExit=true`.
- `ScrollInput` (inertia mode): zeroes velocity on hide.
- `KeyboardInput`: releases focus on hide.
- `PointerInput`: stops responding to events on hide.
- `ControlledInput`: no `pauseWhenHidden` (externally driven; always active).

---

### 7.7 `SceneReel` (new)

The convenience wrapper for embedded/docs/slides use cases. Provides the sized, positioned
container (`position: relative; overflow: hidden`) plus `SceneEngine` context, `SceneCanvas`,
`BackgroundLayer`, and `EngineOverlayHost`. **Input is not configured by `SceneReel`** —
consumers compose input components as children directly, retaining full control over input
type and `pauseWhenHidden` behavior.

```tsx
interface SceneReelProps {
  // ── Layout ──────────────────────────────────────────────────────────────────

  /** CSS width of the reel container. Default: '100%'. */
  width?: string | number;

  /**
   * CSS height of the reel container. Required.
   * '100vh' for full-screen; a pixel or percent value for embedded.
   */
  height: string | number;

  className?: string;

  // ── Engine config ───────────────────────────────────────────────────────────

  /**
   * Widget plugins. Overrides ancestor SceneEngine plugin context when set.
   * Required if no ancestor SceneEngine provides plugins via zero-scene mode.
   */
  plugins?: WidgetPlugin[];

  /** Registers this reel's engine in the global registry. */
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
   * <Scene> components, input components (ScrollInput, TimeInput, KeyboardInput,
   * PointerInput, ControlledInput), and optionally EngineGate / overlay content.
   */
  children: ReactNode;
}
```

**What `SceneReel` renders internally:**

```tsx
// SceneReel internal expansion (informational):
<div style={{ width, height, position: 'relative', overflow: 'hidden' }}>
  <SceneEngine id={id} plugins={resolvedPlugins} {...engineProps}>
    {children}  {/* includes <Scene>s and input components */}
    <BackgroundLayer />
    <SceneCanvas />
    <EngineOverlayHost />
  </SceneEngine>
</div>
```

The `HudOverlay` content declared in scene DSL is rendered by `EngineOverlayHost` as today.

---

### 7.8 Navigation sidebars — use hooks directly

`SceneNav` is not a toolkit export. Consumers building sidebar nav or progress indicators
use the existing hooks directly:

```tsx
// Sidebar nav using hooks:
const { sceneId, sceneIndex } = useCurrentScene();
const { progress, sceneProgress } = useSceneProgress();
// Navigate programmatically via engine context:
const engine = useSceneEngineContext();
engine.goToScene('overview');  // or engine.goToScene(0)
```

This pattern is documented in the `apps/examples/` complex-layout example. The hooks provide
everything `SceneNav` would have provided; no wrapper component is needed.

---

### 7.9 `BackgroundLayer` (new minimal export)

For consumers building custom layouts with raw `SceneEngine` + `SceneCanvas` who want the
`<Background>` DSL element to work.

```tsx
interface BackgroundLayerProps {
  className?: string;
  style?: CSSProperties;
}

// Renders a div with engine.setBackgroundRef wired.
// Consumers must position this behind SceneCanvas (z-index or DOM order).
<BackgroundLayer style={{ position: 'absolute', inset: 0, zIndex: 0 }} />
```

---

### 7.11 Usage patterns by use case

#### Full-page marketing (current primary use case)

```tsx
<SceneEngine plugins={[corePlugin()]}>
  <Scene id="hero">
    <ProgressManager scrollUnits={2000} />
    ...
  </Scene>
  <Scene id="features">
    <ProgressManager scrollUnits={1200} />
    ...
  </Scene>

  <ScrollStage scrollHeightMode="scroll-units" pixelsPerScrollUnit={1}>
    <BackgroundLayer style={{ position: 'absolute', inset: 0, zIndex: 0 }} />
    <SceneCanvas />
    <ScrollInput source="window" />
    <EngineOverlayHost />
  </ScrollStage>
</SceneEngine>
```

#### Embedded reel in a docs page

```tsx
<article>
  <h1>How it works</h1>
  <p>Explanation text...</p>

  <SceneReel height={480}>
    <Scene id="step-1">...</Scene>
    <Scene id="step-2">...</Scene>
    <Scene id="step-3">...</Scene>
    <PointerInput mode="click" pauseWhenHidden={{ y: 0.9 }} />
  </SceneReel>

  <p>More text...</p>
</article>
```

#### Auto-playing ambient loop

```tsx
<SceneReel height={300}>
  <Scene id="ambient">...</Scene>
  <TimeInput duration={6} loop pauseWhenHidden={{ y: 0.5 }} />
</SceneReel>
```

#### Slide deck (full-screen, keyboard-driven)

```tsx
<SceneReel height="100vh" width="100vw">
  <Scene id="slide-1">...</Scene>
  <Scene id="slide-2">...</Scene>
  <Scene id="slide-3">...</Scene>
  <KeyboardInput pauseWhenHidden={{ y: 0.5 }} />
</SceneReel>
```

#### Complex docs layout: engine above sidebar + canvas

```tsx
// Sidebar nav component using hooks directly (no SceneNav wrapper needed):
function DocsSidebar() {
  const { sceneId } = useCurrentScene();
  const engine = useSceneEngineContext();
  // engine.compiledScenes gives the scene list from the compiled track
  return (
    <nav>
      {engine.compiledScenes.map(s => (
        <button key={s.id} onClick={() => engine.goToScene(s.id)}
          data-active={s.id === sceneId}>
          {s.id}
        </button>
      ))}
    </nav>
  );
}

<SceneEngine id="docs-main" plugins={[corePlugin(), diagramPlugin()]}>
  <Scene id="overview">...</Scene>
  <Scene id="detail">...</Scene>

  <DocsLayout
    sidebar={<DocsSidebar />}
    main={
      <div style={{ position: 'relative', height: '100vh' }}>
        <BackgroundLayer style={{ position: 'absolute', inset: 0, zIndex: 0 }} />
        <SceneCanvas />
        <ScrollInput source="inertia" />
        <KeyboardInput />
        <EngineOverlayHost />
      </div>
    }
  />
</SceneEngine>
```

#### App-level plugin hoisting

```tsx
// Root SceneEngine — zero scenes, just plugin config
<SceneEngine plugins={[corePlugin(), modelPlugin({ manifestUrl: '/manifest.json' }), diagramPlugin()]}>
  <App />
</SceneEngine>

// Anywhere in the tree — plugins inherited from root SceneEngine
<SceneReel height={400}>
  <Scene id="demo">...</Scene>
  <PointerInput mode="click" />
</SceneReel>
```

---

## 8. Technical Considerations

### 8.1 SceneEngine internals

`SceneEngine` is a thin wrapper around the existing `useSceneEngine` hook plus the context
providers currently in `EngineProvider`. The internal structure is essentially unchanged —
the hook drives compilation, the RAF loop, and widget dispatch. What changes is that scroll
and input configuration is no longer passed to `useSceneEngine` as props; instead, the input
components write directly to the engine context via the existing `setRawProgress` / progress
push mechanisms.

The `inputMode` field currently on the engine state (`engine.inputMode`) becomes unnecessary
since input mode is now determined by which input components are present, not by a policy
enum. This is an internal change only.

### 8.2 Input component protocol

All input components use the existing `useSceneEngineContext()` hook to access the engine.
They write progress via:
- `engine.setRawProgress(raw)` for absolute position updates (scroll, controlled)
- `engine.advanceRawProgress(delta)` for incremental updates (keyboard, inertia, time)

This is already how `useEngineScroll` and `useEngineInput` work internally. The input
components are React wrappers around the same logic, moved from hooks to components so they
can be placed in the component tree declaratively.

`useEngineScroll` and `useEngineInput` are **deleted**. Their logic moves into `ScrollInput` /
`KeyboardInput` / `PointerInput` internally. No compatibility export is retained.

### 8.3 Spring inertia integrator

`ScrollInput` with `inertia=true` runs a velocity accumulator in the engine's RAF loop:

```ts
// Per-frame in the RAF loop (inside ScrollInput's useEffect):
velocity += pendingWheelDelta * inertiaSensitivity;
pendingWheelDelta = 0;
rawProgress += velocity;
velocity *= inertiaDecay;   // e.g. 0.88 per frame
rawProgress = clamp01(rawProgress);
engine.setRawProgress(rawProgress);
```

`onWheel` (passive) accumulates into `pendingWheelDelta`. The RAF loop drains it. This
produces trackpad-like glide behavior. `inertiaDecay=0.88` gives approximately 400ms
glide-to-stop at 60fps — tunable via prop.

### 8.4 ScrollStage and scroll region height computation

`ScrollStage` reads `SceneEngineContext` for the compiled `SceneTrack` (specifically the
`scrollUnits` profile) to compute `scrollRegionHeightPx`. This is the same computation
currently in `useSceneEngine` — it moves to `ScrollStage` since `SceneEngine` no longer
knows about scroll geometry.

For the `scrollHeightMode='scroll-units'` case, the compiled `SceneTrack.progressProfile`
contains the total `scrollUnits` sum. `ScrollStage` multiplies by `pixelsPerScrollUnit`.

### 8.5 Background layer

The `<Background>` element widget writes CSS properties to a DOM div via `engine.setBackgroundRef`.
This ref must be wired to a div in the render tree. `ScrollStage` and `SceneReel` both wire
this automatically. For raw `SceneEngine` + `SceneCanvas` layouts, consumers must render
`<BackgroundLayer>` explicitly. If `engine.setBackgroundRef` is never wired, the `<Background>`
element falls back silently (no crash; background CSS simply has no target).

### 8.6 EngineARContainer

`EngineARContainer` is unaffected by this change. It wraps its children in a fixed-AR
container and provides `EngineARContainerContext` for height computation. `ScrollStage` reads
`EngineARContainerContext` (as `EngineInputRegion` does today) to use `computedArHeight`
instead of `100vh` when inside an AR container.

### 8.7 Plugin inheritance chain

Plugin resolution order (for any `SceneEngine` or `SceneReel`):
1. Own `plugins` prop if set → use as-is (overrides ancestor).
2. Nearest ancestor `SceneEngine` context if no own `plugins` → use inherited plugins.
3. Neither → `console.error` and use empty plugin list.

The `SceneEngine` context already exists for the engine state (`EngineContext`). Plugin
config is added as a secondary slot on the same context — no new context type needed. A
root-level `SceneEngine` with zero scenes provides the plugin config without running any
animation logic (empty compiled track; RAF loop runs but does nothing at zero progress).

### 8.8 Multiple input components under one SceneEngine

When multiple input components coexist, priority is determined by write recency with a
priority tier:

| Tier | Components | Behavior |
|---|---|---|
| 1 (highest) | `ControlledInput` | Always wins — external value read every frame |
| 2 | User-initiated: `KeyboardInput`, `PointerInput`, `ScrollInput` (gesture) | Wins over time; disables `TimeInput` for its scene per `pauseOnInteraction` config |
| 3 (lowest) | `TimeInput` | Yields to any user-initiated input |

For tier-2 components coexisting (e.g., `KeyboardInput` + `PointerInput`): last write wins
per-frame. No conflict in practice since user can only do one thing at a time.

### 8.9 SSR behavior

`SceneEngine` maintains the same SSR policy as `EngineProvider` today: contexts provide
default values on server; engine internals (Three.js, RAF loop) are guarded by
`typeof window !== 'undefined'`. `SceneCanvas` renders null on server. `ScrollStage` renders
its children with a placeholder height on server (zero scroll region height until client
hydration). All input components render null on server.

### 8.10 `EngineGate` compatibility

`EngineGate` reads `EngineStateContext` which is provided by `SceneEngine` (same as
`EngineProvider` today). No change needed.

---

## 9. Clean-Cut Migration

**Semver impact: MAJOR (v2.0.0)**

This is a clean-cut replacement. No compatibility shims. Old components are deleted; apps
are migrated. The goal is the right API — migration of `apps/examples/` and `apps/website/`
is part of the release scope.

### Deleted exports

| Deleted export | Replacement |
|---|---|
| `EngineProvider` | `SceneEngine` |
| `EngineInputRegion` | `ScrollStage` (scroll mode) or bare div with `BackgroundLayer` (direct mode) |
| `ScenePlayer` | `SceneReel` |
| `ScrollCaptureSection` | `ScrollStage` + `ScrollInput source='window'` |
| `useEngineScroll` | `ScrollInput` component |
| `useEngineInput` | `KeyboardInput` / `PointerInput` components |
| `InputModePolicy` type | Removed — use explicit input components |
| `manifestUrl` prop | Pass directly to `modelPlugin({ manifestUrl })` |
| `fpsCap`, `framesPerTick`, `quality` flat props | Use `timingProfile` object |

### Migration example

**v1:**
```tsx
<EngineProvider
  plugins={[corePlugin()]}
  scrollHeightMode="scroll-units"
  pixelsPerScrollUnit={1}
  inputMap={myKeyMap}
>
  <Scene id="hero">...</Scene>
  <EngineInputRegion>
    <SceneCanvas />
    <EngineOverlayHost />
  </EngineInputRegion>
</EngineProvider>
```

**v2:**
```tsx
<SceneEngine plugins={[corePlugin()]}>
  <Scene id="hero">...</Scene>
  <ScrollStage scrollHeightMode="scroll-units" pixelsPerScrollUnit={1}>
    <BackgroundLayer style={{ position: 'absolute', inset: 0, zIndex: 0 }} />
    <SceneCanvas />
    <ScrollInput source="window" />
    <KeyboardInput inputMap={myKeyMap} />
    <EngineOverlayHost />
  </ScrollStage>
</SceneEngine>
```

`MIGRATION.md` at `packages/core/MIGRATION.md` documents the full translation for all
deleted components with copy-paste examples covering every v1 configuration pattern.

---

## 10. Dependencies

- No new external library dependencies.
- Spring inertia integrator is pure JS — no library needed.
- `IScrollSource` is a zero-dependency interface. Third-party scroll library wrappers
  (Lenis, etc.) are authored by consumers — no adapter code ships in the toolkit.
- `IntersectionObserver` is used by the `pauseWhenHidden` prop on input components. Available
  in all modern browsers (Chrome 51+, Firefox 55+, Safari 12.1+). No polyfill needed.
- No internal `SceneReelRegistry` singleton. No `VisibilityGate` component. Visibility gating
  is decentralized into each input component via `pauseWhenHidden`.

---

## 11. Risks & Mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| Spring inertia feel differs from native scroll inertia — users notice | Medium | Make `inertiaDecay` and `inertiaSensitivity` tunable. Document recommended values for different use cases. Provide a scroll-feel playground in examples app. |
| Multiple `ScrollInput` + `TimeInput` priority behavior is unclear to consumers | Low | Comprehensive priority table in docs. Console.warn when conflicting tier-2 inputs are configured without explicit `pauseOnInteraction`. |
| Plugin inheritance via root `SceneEngine` zero-scene mode may surprise consumers who don't expect an empty engine to affect the tree | Low | Log a debug-mode message on engine mount naming the inherited plugins. Make zero-scene mode explicit in README. |
| `pauseWhenHidden` with multiple input components creates N independent IntersectionObserver instances on the same element — minor overhead | Low | Components observe the same nearest positioned ancestor; browsers coalesce observers on the same element. Acceptable. |
| `SceneReel` passes `BackgroundLayer` and `EngineOverlayHost` by default — consumers who don't use `<Background>` DSL or HUD overlays get dead DOM nodes | Low | Background div is zero-cost when no Background element is mounted. EngineOverlayHost renders null when no HUD content is declared. |

---

## 12. Open Questions

1. **`ProgressManager.autoAdvance` vs `TimeInput` coexistence**: If a scene declares
   `<ProgressManager autoAdvance={...}>` AND the parent `SceneEngine` has a `<TimeInput>`,
   whose config wins for that scene? Current proposal: `ProgressManager.autoAdvance` takes
   per-scene precedence; `TimeInput` governs scenes that declare none. Needs explicit
   documentation and test coverage.

2. **`SceneEngine` zero-scene mode + programmatic navigation**: `engine.goToScene()` is
   called by consumers building sidebar nav (see §7.9 navigation pattern). The exact shape
   of this method on the engine context needs to be specified: `goToScene(idOrIndex: string
   | number): void`. In scroll mode, this performs `ScrollInput.source.scrollTo()` if the
   current source supports it. Needs validation with `ScrollStage` + `ScrollInput source='window'`.

3. **`EngineARContainer` + `SceneReel` interaction**: If `SceneReel` is placed inside
   `EngineARContainer`, should the reel's height be derived from the AR container's computed
   height? `SceneReel` should read `EngineARContainerContext` for `computedArHeight` and use
   it instead of the `height` prop when non-zero. Needs verification in the implementation plan.

4. **`ControlledInput` + `KeyboardInput` coexistence**: When both are present, `KeyboardInput`
   calls `onChange` on `ControlledInput` so the external state updates — is this the right
   model? Alternatively, `KeyboardInput` could write directly to `engine` and `ControlledInput`
   would then be overridden on the next render. The `onChange` callback model is cleaner.
   **Recommendation: `KeyboardInput` calls `ControlledInput`'s `onChange`** — requires
   that consumers wire both.

5. **Hook consolidation**: `useEngineState` (reads local context) and `useSceneEngineState(id)`
   (reads global registry by id) serve similar roles. Should these be unified into a single
   `useEngineState(id?)` where the id is optional? A unified hook would reduce the exported
   hook count by one with no loss of capability. Evaluate before implementation.

---

## 13. Launch Criteria

- [ ] All new components and interfaces (`SceneEngine`, `ScrollStage`, `ScrollInput`,
      `TimeInput`, `KeyboardInput`, `PointerInput`, `ControlledInput`, `SceneReel`,
      `BackgroundLayer`, `IScrollSource`, `useNativeScrollSource`) implemented and exported.
- [ ] `pauseWhenHidden` prop implemented on `ScrollInput`, `TimeInput`, `KeyboardInput`,
      `PointerInput` with `IntersectionObserver`. Tests cover threshold detection,
      pause/resume, and `resetOnExit` behavior.
- [ ] Spring inertia integrator in `ScrollInput` has unit tests covering decay, sensitivity,
      and clamping at boundaries.
- [ ] `EngineProvider`, `EngineInputRegion`, `ScenePlayer`, `ScrollCaptureSection`,
      `useEngineScroll`, `useEngineInput` are deleted from the codebase.
- [ ] `MIGRATION.md` at `packages/core/MIGRATION.md` documents the v1→v2 translation for
      all deleted components with copy-paste examples covering every v1 config pattern.
- [ ] `packages/core/README.md` rewritten for the v2 API (no references to v1 components).
- [ ] `apps/examples/` migrated to v2 API. Contains at minimum:
      - Full-page marketing pattern (`SceneEngine` + `ScrollStage` + `ScrollInput source='window'`)
      - Embedded reel pattern (`SceneReel` + `PointerInput mode='click'`)
      - Auto-play loop (`SceneReel` + `TimeInput` with `pauseWhenHidden`)
      - Slide deck (`SceneReel` + `KeyboardInput` with `pauseWhenHidden`)
      - Complex layout with sidebar nav (using `useCurrentScene` + `useSceneEngineContext`)
      - App-level plugin hoisting via root `SceneEngine` zero-scene mode
      - Custom `IScrollSource` example demonstrating `useNativeScrollSource`
- [ ] `apps/website/` migrated to v2 API — all existing scene pages updated.
- [ ] `apps/docs/` migrated to v2 API — all pages, demos, and inline code examples updated to use the new component names and patterns.
- [ ] All open questions in §12 resolved and documented.
- [ ] TypeScript strict mode: zero new type errors in packages and apps.
- [ ] `pnpm test` passes for all packages.
- [ ] `pnpm typecheck` passes for all packages.
- [ ] CHANGELOG entry written for `@brewsite/core` v2.0.0.
- [ ] Peer dependency declaration for React and Three.js unchanged.
