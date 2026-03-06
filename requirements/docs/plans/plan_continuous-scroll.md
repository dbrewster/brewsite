---
title: "Continuous Natural-Scroll Docs — Implementation Plan"
doc_type: plan
owner: brewsite-architect
status: draft
updated: 2026-03-05
---

# Continuous Natural-Scroll Docs — Implementation Plan

## 0. Context and Scope

This plan converts the docs app (`apps/docs/`) from a single sticky-canvas + absolute-positioned overlay architecture to a standard web document where 3D scene panels are inline block elements between real HTML prose sections. The change is a big-bang migration: old code is deleted wholesale.

Two toolkit deliverables in `@brewsite/core` must land before the docs rewrite begins. They are fully independent of each other and can be implemented in parallel.

**Primary reference:** `requirements/docs/notes/note_continuous-scroll.md` — all product decisions are recorded there.

---

## 1. Parallelization Overview

```
Phase 1 (core toolkit — no docs work until this is merged)
  ├── Stream A: RuntimeLoop.pause()/resume()        [core only — no conflicts with B]
  └── Stream B: EngineProvider viewport-relative    [core only — no conflicts with A]

Phase 2 (docs app rewrite — all streams after Phase 1)
  ├── Stream C: DocsLayout (root layout + CSS)       [no conflicts with D/E/F/G]
  ├── Stream D: ScenePanel, ActHeader, ProseBlock    [no conflicts with C/E/F/G]
  ├── Stream E: NavContext + DocsSidebar             [no conflicts with C/D/F/G]
  ├── Stream F: Scene DSL migration (all scene files)[no conflicts with C/D/E/G]
  └── Stream G: Dead code deletion                  [no conflicts with C/D/E/F]
```

**File ownership per stream — zero shared-file conflicts:**

| Stream | Exclusively owns |
|---|---|
| A | `packages/core/src/runtime/RuntimeLoop.ts`, `packages/core/src/player/useSceneEngine.ts`, `packages/core/src/runtime/__tests__/RuntimeLoop.test.ts` |
| B | `packages/core/src/player/engineTypes.ts`, `packages/core/src/player/useViewportRelativeScroll.ts` (new), `packages/core/src/player/EngineProvider.tsx`, `packages/core/src/player/index.ts`, `packages/core/src/player/__tests__/useViewportRelativeScroll.test.ts` (new) |
| C | `apps/docs/src/layout/DocsLayout.tsx` (new), `apps/docs/src/App.tsx`, `apps/docs/src/routes.tsx`, `apps/docs/src/style/layout.css`, `apps/docs/src/style/variables.css` |
| D | `apps/docs/src/components/ScenePanel.tsx` (new), `apps/docs/src/components/ActHeader.tsx` (new), `apps/docs/src/components/ProseBlock.tsx` (new) |
| E | `apps/docs/src/nav/NavContext.tsx` (new), `apps/docs/src/nav/types.ts`, `apps/docs/src/nav/docs-nav.ts`, `apps/docs/src/components/layout/DocsSidebar.tsx` |
| F | Every file in `apps/docs/src/scenes/**/*.tsx`, `apps/docs/src/scenes/index.ts`, `apps/docs/src/scenes/sceneUtils.ts` |
| G | `apps/docs/src/components/content/DocPanel.tsx` (delete), `apps/docs/src/components/content/DemoProgressProvider.tsx` (delete), `apps/docs/src/scenes/acts/**` (delete all), `apps/docs/src/components/demo/InlineDemo.tsx` (simplify) |

---

## 2. Phase 1, Stream A — `RuntimeLoop.pause()` / `resume()`

**Owner file:** `packages/core/src/runtime/RuntimeLoop.ts`

### 2.1 New private state fields

Add these private fields to the `RuntimeLoop` class body, immediately after the existing `private errorLogged = false`:

```typescript
private isPaused = false;
private canvas: HTMLCanvasElement | null = null;
```

### 2.2 New public methods

Add all three methods after the existing `stop()` method:

```typescript
/**
 * Suspends the RAF loop without resetting engine state. Idempotent.
 * Safe to call when already paused, stopped, or before start().
 */
pause(): void {
  if (this.isPaused) return;
  this.isPaused = true;
  if (this.rafId !== null) {
    this.clock.cancelFrame(this.rafId);
    this.rafId = null;
  }
}

/**
 * Resumes the RAF loop after pause(). Idempotent.
 * No-op if the loop is not running or not paused.
 */
resume(): void {
  if (!this.isPaused) return;
  this.isPaused = false;
  if (!this.running) return;
  const step = (nowMs: number) => {
    if (!this.running || this.isPaused) return;
    this.step(nowMs);
    this.rafId = this.clock.requestFrame(step);
  };
  this.rafId = this.clock.requestFrame(step);
}

/**
 * Registers a canvas element to receive webglcontextlost / webglcontextrestored
 * event listeners that auto-pause and auto-resume the loop respectively.
 * Pass null to remove the current canvas and its listeners.
 * Safe to call multiple times; previous listeners are always removed first.
 */
setCanvas(canvas: HTMLCanvasElement | null): void {
  if (this.canvas !== null) {
    this.canvas.removeEventListener('webglcontextlost', this.handleContextLost, false);
    this.canvas.removeEventListener('webglcontextrestored', this.handleContextRestored, false);
    this.canvas = null;
  }
  if (canvas !== null) {
    this.canvas = canvas;
    canvas.addEventListener('webglcontextlost', this.handleContextLost, false);
    canvas.addEventListener('webglcontextrestored', this.handleContextRestored, false);
  }
}
```

### 2.3 New private event-handler arrow functions

Add these as private class fields (arrow functions bind `this` at construction time, safe for use as event listener callbacks):

```typescript
private readonly handleContextLost = (e: Event): void => {
  e.preventDefault(); // required by the WEBGL_lose_context spec to allow restoration
  this.pause();
};

private readonly handleContextRestored = (): void => {
  // Three.js WebGLRenderer (r158+) automatically rebuilds its internal WebGL state
  // (programs, textures, geometries) on webglcontextrestored via its own internal
  // listener registered at construction time. No caller-facing API is required.
  // BrewSite only needs to restart the tick loop.
  this.resume();
};
```

### 2.4 Modify `start()`

The `step` closure inside `start()` must check `isPaused`. Replace the existing `start()` implementation:

```typescript
start(): void {
  if (this.running) return;
  this.running = true;
  this.isPaused = false; // clear any stale pause state from before start
  const step = (nowMs: number) => {
    if (!this.running || this.isPaused) return; // ← add isPaused check
    this.step(nowMs);
    this.rafId = this.clock.requestFrame(step);
  };
  this.rafId = this.clock.requestFrame(step);
}
```

### 2.5 Modify `stop()`

`stop()` must clear `isPaused` and remove canvas listeners:

```typescript
stop(): void {
  this.running = false;
  this.isPaused = false; // clear pause state so a subsequent start() is clean
  if (this.rafId !== null) {
    this.clock.cancelFrame(this.rafId);
    this.rafId = null;
  }
  this.lastMs = null;
  this.fpsAccumulatorMs = 0;
  this.setCanvas(null); // remove canvas event listeners
}
```

### 2.6 Changes to `useSceneEngine.ts`

`useSceneEngine.ts` must expose `setControlledProgress`, `pause`, and `resume` on its result type, and wire `runtimeLoop.setCanvas()` when the canvas ref changes.

**In `UseSceneEngineResult` type**, add three new members:

```typescript
/**
 * Directly updates the engine's controlled progress [0..1] without a React re-render.
 * Use in scroll or pointer event handlers where React state updates are too expensive.
 * Only meaningful when the engine is in controlled-progress mode.
 */
setControlledProgress: (p: number) => void;

/** Pauses the RuntimeLoop RAF cycle. Delegates to RuntimeLoop.pause(). */
pause: () => void;

/** Resumes the RuntimeLoop RAF cycle after pause(). Delegates to RuntimeLoop.resume(). */
resume: () => void;
```

**In the `useSceneEngine` hook body**, where the result object is constructed and returned, add:

```typescript
setControlledProgress: useCallback((p: number) => {
  // Update the same ref that getGlobalProgress() reads.
  // Bypasses React render cycle — safe to call in passive scroll handlers.
  controlledProgressRef.current = p;
}, []),

pause: useCallback(() => {
  runtimeLoopRef.current?.pause();
}, []),

resume: useCallback(() => {
  runtimeLoopRef.current?.resume();
}, []),
```

Where `controlledProgressRef` is the existing internal ref that stores the effective controlled progress (verify exact name in source — the ref used by `getGlobalProgress` when in controlled mode).

**Also in `useSceneEngine`**, inside the `setCanvasRef` callback (or wherever `engine.setCanvasRef` is handled), add:

```typescript
// After registering canvas with renderer:
runtimeLoopRef.current?.setCanvas(el); // el is the canvas element, null on unregister
```

This wires the RuntimeLoop's canvas event listeners whenever a canvas is attached or detached.

### 2.7 Test file: `packages/core/src/runtime/__tests__/RuntimeLoop.test.ts`

This file is **new** (does not currently exist). Use vitest with `vi.useFakeTimers()` and a synthetic `RuntimeLoopClock` (the existing `RuntimeLoopClock` interface already supports fake clock injection).

**Required test cases:**

```typescript
describe('RuntimeLoop.pause()/resume()', () => {
  it('pause() cancels the pending RAF and sets isPaused', () => {
    // Create loop with fake clock. start() it. Assert rafId is queued.
    // Call pause(). Assert RAF was cancelled (spy on clock.cancelFrame).
    // Assert loop.isPaused === true (via introspection or by calling step() and
    // asserting driver.tick was NOT called).
  });

  it('pause() is idempotent — calling twice does not double-cancel', () => {
    // start(), pause(), pause() — no error, cancelFrame called exactly once.
  });

  it('resume() restarts the RAF loop when running and paused', () => {
    // start(), pause(), resume() — clock.requestFrame called again.
    // step() after resume should call driver.tick.
  });

  it('resume() is a no-op when not paused', () => {
    // start() without pause() — resume() does nothing extra.
  });

  it('resume() is a no-op when not running', () => {
    // Never called start(). pause() then resume() — no RAF queued.
  });

  it('stop() clears isPaused state', () => {
    // start(), pause(), stop(), start() — loop runs again normally.
  });
});

describe('RuntimeLoop.setCanvas()', () => {
  it('registers webglcontextlost listener that calls pause()', () => {
    const canvas = document.createElement('canvas');
    const loop = new RuntimeLoop({ driver: fakeDriver, getGlobalProgress: () => 0, clock: fakeClock });
    loop.start();
    loop.setCanvas(canvas);

    // Dispatch webglcontextlost
    const event = new Event('webglcontextlost', { cancelable: true });
    canvas.dispatchEvent(event);

    // Loop should now be paused
    // Assert driver.tick is not called in subsequent steps
    expect(event.defaultPrevented).toBe(true); // e.preventDefault() was called
  });

  it('registers webglcontextrestored listener that calls resume()', () => {
    const canvas = document.createElement('canvas');
    const loop = new RuntimeLoop({ driver: fakeDriver, getGlobalProgress: () => 0, clock: fakeClock });
    loop.start();
    loop.setCanvas(canvas);

    // Lose context, then restore
    canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
    canvas.dispatchEvent(new Event('webglcontextrestored'));

    // Loop should be running again
    // Assert driver.tick is called in next step
  });

  it('setCanvas(null) removes event listeners', () => {
    const canvas = document.createElement('canvas');
    const loop = new RuntimeLoop({ ... });
    loop.start();
    loop.setCanvas(canvas);
    loop.setCanvas(null); // remove

    // Dispatch webglcontextlost — loop should NOT pause (no listener)
    canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
    // Assert loop is still running
  });

  it('setCanvas() with a new canvas removes old listeners first', () => {
    const canvas1 = document.createElement('canvas');
    const canvas2 = document.createElement('canvas');
    const loop = new RuntimeLoop({ ... });
    loop.start();
    loop.setCanvas(canvas1);
    loop.setCanvas(canvas2); // switches to canvas2

    // Dispatch on canvas1 — no effect (listener removed)
    canvas1.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
    // Loop still running

    // Dispatch on canvas2 — pauses
    canvas2.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
    // Loop paused
  });
});
```

---

## 3. Phase 1, Stream B — `EngineProvider scrollSource: 'viewport-relative'`

### 3.1 File: `packages/core/src/player/engineTypes.ts`

Add the new scroll source variant. The existing file already imports `RefObject` from `react`. Add after the existing `ScrollSource` type:

```typescript
/**
 * Viewport-relative scroll source configuration.
 * When used as EngineProvider's scrollSource, the engine computes progress
 * from how far the user has scrolled through the containerRef element,
 * and manages WebGL context acquisition/release via IntersectionObserver.
 */
export type ViewportRelativeScrollSource = {
  readonly kind: 'viewport-relative';
  /**
   * Ref to the outer container element of the ScenePanel.
   * offsetHeight and getBoundingClientRect() are called on this element
   * on every window scroll event to compute progress.
   */
  readonly containerRef: RefObject<HTMLElement | null>;
  /**
   * Ref to the <canvas> element managed by SceneCanvas inside this panel.
   * Used to acquire/release the WEBGL_lose_context extension for GPU budget
   * management as the panel enters and exits the viewport.
   */
  readonly canvasRef: RefObject<HTMLCanvasElement | null>;
};
```

Extend `ScrollSource`:

```typescript
export type ScrollSource =
  | 'window'
  | { kind: 'element'; elementRef: RefObject<HTMLElement | null> }
  | ViewportRelativeScrollSource;
```

Add a new derived type for internal use (keeps `useEngineScroll` and `useSceneEngine` unaware of the new variant):

```typescript
/**
 * Subset of ScrollSource that useSceneEngine and useEngineScroll understand.
 * ViewportRelativeScrollSource is intercepted by EngineProvider before being
 * passed to useSceneEngine — useSceneEngine never sees it.
 */
export type EngineInternalScrollSource = Exclude<ScrollSource, ViewportRelativeScrollSource>;
```

### 3.2 New file: `packages/core/src/player/useViewportRelativeScroll.ts`

This hook encapsulates two responsibilities for viewport-relative EngineProvider panels:
1. Computes per-panel scroll progress by listening to `window` scroll events.
2. Manages the WebGL context lifecycle using `IntersectionObserver` and `WEBGL_lose_context`.

Create this file at `packages/core/src/player/useViewportRelativeScroll.ts` with the complete implementation below. No other file may be imported from here except React and `engineTypes.ts`.

```typescript
// Viewport-relative scroll progress + WebGL context lifecycle for inline ScenePanels.
// Called from EngineProvider when scrollSource.kind === 'viewport-relative'.

import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import type { ViewportRelativeScrollSource } from './engineTypes';

export type UseViewportRelativeScrollOptions = {
  /**
   * The viewport-relative scroll source, or null when the EngineProvider is not
   * in viewport-relative mode. When null, this hook is a no-op.
   */
  source: ViewportRelativeScrollSource | null;
  /**
   * Callback invoked on every window scroll event with the new per-panel progress [0..1].
   * Should be a stable function reference (e.g., created by useCallback or stored in a ref).
   * Bypasses React state to avoid re-renders on every scroll event.
   */
  onProgress: ((progress: number) => void) | null;
};

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

function computePanelProgress(containerEl: HTMLElement): number {
  const panelHeight = containerEl.offsetHeight;
  const viewportH = window.innerHeight;
  const maxScroll = panelHeight - viewportH;
  if (maxScroll <= 0) {
    // Panel shorter than viewport — no traversal window. Always terminal state.
    return 1;
  }
  const panelTop = containerEl.getBoundingClientRect().top + window.scrollY;
  const scrolled = window.scrollY - panelTop;
  return clamp01(scrolled / maxScroll);
}

/**
 * Manages scroll progress and WebGL context lifecycle for a viewport-relative ScenePanel.
 *
 * Scroll progress: passive window scroll listener computes progress and calls onProgress().
 * Context lifecycle: IntersectionObserver (rootMargin: '200px') calls loseContext() on
 * panel exit and restoreContext() on re-entry. RuntimeLoop.pause()/resume() are triggered
 * by the resulting webglcontextlost/webglcontextrestored events on the canvas element.
 *
 * Both effects are no-ops when source === null.
 */
export function useViewportRelativeScroll(options: UseViewportRelativeScrollOptions): void {
  const { source, onProgress } = options;

  // Stable ref to the onProgress callback. Avoids scroll effect re-running
  // when the callback changes identity across renders.
  const onProgressRef = useRef<((p: number) => void) | null>(null);
  onProgressRef.current = onProgress;

  // Hold the WEBGL_lose_context extension across renders so restoreContext()
  // can be called on the same extension object that loseContext() was called on.
  const extRef = useRef<WEBGL_lose_context | null>(null);

  // Tracks whether the panel's context has been acquired at least once.
  // First intersection is a no-op (engine acquires context normally via SceneCanvas).
  // Only subsequent intersections after a deliberate loseContext() call need restoreContext().
  const initializedRef = useRef(false);

  // — Scroll progress listener —————————————————————————————————————————————————
  useEffect(() => {
    const containerRef = source?.containerRef ?? null;
    if (!containerRef) return;

    const onScroll = () => {
      const el = containerRef.current;
      if (!el) return;
      onProgressRef.current?.(computePanelProgress(el));
    };

    const onResize = () => {
      const el = containerRef.current;
      if (!el) return;
      onProgressRef.current?.(computePanelProgress(el));
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize, { passive: true });

    // Compute initial progress synchronously on mount (user may already be scrolled in).
    const el = containerRef.current;
    if (el) onProgressRef.current?.(computePanelProgress(el));

    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
    };
  // source?.containerRef is a stable RefObject — safe as a dependency.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source?.containerRef]);

  // — WebGL context lifecycle (IntersectionObserver) ——————————————————————————
  useEffect(() => {
    const canvasRef = source?.canvasRef ?? null;
    if (!canvasRef) return;

    // canvasRef.current is populated by the time this effect runs because
    // SceneCanvas's forwardRef effect runs before EngineProvider's effects
    // (React effects fire children-before-parent).
    const canvas = canvasRef.current;
    if (!canvas) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;

        if (entry.isIntersecting) {
          if (!initializedRef.current) {
            // First intersection: EngineProvider + SceneCanvas acquire the
            // WebGL context through normal initialization. Nothing to do here.
            initializedRef.current = true;
          } else {
            // Re-entry: context was deliberately lost on exit. Restore it.
            // The webglcontextrestored event fires on the canvas element, which
            // RuntimeLoop listens for via setCanvas() to call resume().
            extRef.current?.restoreContext();
          }
        } else {
          if (initializedRef.current) {
            // Exit: acquire the WEBGL_lose_context extension and explicitly
            // release the GPU slot. The webglcontextlost event fires on the
            // canvas element, which RuntimeLoop listens for via setCanvas()
            // to call pause(). e.preventDefault() in that handler allows
            // subsequent restoration.
            const gl = canvas.getContext('webgl2');
            extRef.current = gl?.getExtension('WEBGL_lose_context') ?? null;
            extRef.current?.loseContext();
          }
        }
      },
      {
        // Start restoration 200px before the panel enters the viewport.
        // This gives the engine time to reinitialize before the canvas is visible.
        rootMargin: '200px',
      },
    );

    observer.observe(canvas);
    return () => observer.disconnect();
  // source?.canvasRef is a stable RefObject — safe as a dependency.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source?.canvasRef]);
}
```

### 3.3 Changes to `packages/core/src/player/EngineProvider.tsx`

**Three changes required:**

**Change 1** — Import the new hook and type at the top of the file:

```typescript
import { useViewportRelativeScroll } from './useViewportRelativeScroll';
import type { ViewportRelativeScrollSource, EngineInternalScrollSource } from './engineTypes';
```

**Change 2** — Inside the `EngineProvider` function body, before the `useSceneEngine` call, add:

```typescript
// Detect viewport-relative scroll source.
const vpScrollSource: ViewportRelativeScrollSource | null =
  props.scrollSource?.kind === 'viewport-relative' ? props.scrollSource : null;
```

**Change 3** — After the `useSceneEngine` call (which now returns `engine` including `setControlledProgress`), wire viewport-relative scroll:

```typescript
// Wire viewport-relative scroll + context lifecycle.
// useViewportRelativeScroll is always called unconditionally (React rules of hooks);
// it is a no-op when vpScrollSource is null.
useViewportRelativeScroll({
  source: vpScrollSource,
  onProgress: vpScrollSource ? engine.setControlledProgress : null,
});
```

**Change 4** — In the `useSceneEngine` call, filter out the `viewport-relative` source:

```typescript
const engine = useSceneEngine({
  // ... all existing props ...
  // EngineInternalScrollSource: strip viewport-relative before passing to useSceneEngine.
  // Viewport-relative progress is fed via setControlledProgress, not useEngineScroll.
  scrollSource: vpScrollSource ? undefined : (props.scrollSource as EngineInternalScrollSource | undefined),
  // When in viewport-relative mode, external controlledProgress prop is ignored.
  // Progress comes via engine.setControlledProgress() from useViewportRelativeScroll.
  controlledProgress: vpScrollSource ? undefined : props.controlledProgress,
  // ... all other existing props unchanged ...
});
```

### 3.4 Changes to `packages/core/src/player/index.ts`

Add the following exports after the existing hook exports:

```typescript
export { useViewportRelativeScroll } from './useViewportRelativeScroll';
export type { UseViewportRelativeScrollOptions } from './useViewportRelativeScroll';
export type { ViewportRelativeScrollSource, EngineInternalScrollSource } from './engineTypes';
```

### 3.5 Test file: `packages/core/src/player/__tests__/useViewportRelativeScroll.test.ts`

This file is **new**. Use vitest with jsdom environment. Mock `IntersectionObserver`, `window.scrollY`, `element.getBoundingClientRect()`, and `element.offsetHeight`.

**Setup pattern:**

```typescript
// Mock IntersectionObserver
let intersectionCallback: IntersectionObserverCallback | null = null;
const mockObserver = {
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
};
vi.stubGlobal('IntersectionObserver', vi.fn((cb: IntersectionObserverCallback) => {
  intersectionCallback = cb;
  return mockObserver;
}));

// Helper to fire intersection event
function fireIntersection(isIntersecting: boolean): void {
  intersectionCallback?.([{ isIntersecting } as IntersectionObserverEntry], mockObserver as unknown as IntersectionObserver);
}

// Helper to set scroll position
function setScrollY(value: number): void {
  Object.defineProperty(window, 'scrollY', { value, writable: true });
}
```

**Required test cases:**

```typescript
describe('useViewportRelativeScroll — scroll progress', () => {
  it('calls onProgress with 0 when scrollY is at panel top', () => {
    // containerEl: offsetHeight=1500, getBoundingClientRect().top=0
    // window.innerHeight=768, panelTop=0
    // maxScroll = 1500 - 768 = 732
    // scrollY=0 → progress=0
  });

  it('calls onProgress with 1 when scrollY is at panel bottom', () => {
    // scrollY = panelTop + maxScroll → progress=1
  });

  it('calls onProgress with 0.5 at midpoint', () => {
    // scrollY = panelTop + maxScroll*0.5 → progress=0.5
  });

  it('clamps progress to [0,1] — negative scrollY produces 0', () => {
    // scrollY < panelTop → progress=0
  });

  it('returns progress=1 (terminal state) when panel shorter than viewport', () => {
    // offsetHeight=500, innerHeight=768 → maxScroll<=0 → returns 1
  });

  it('fires onProgress on scroll event', () => {
    // Set up hook via renderHook. Assert onProgress not called initially.
    // Dispatch scroll event. Assert onProgress called once.
  });

  it('fires onProgress on resize event', () => {
    // Dispatch resize event. Assert onProgress called.
  });

  it('fires onProgress synchronously on mount with initial position', () => {
    // scrollY already at midpoint before hook mounts.
    // Assert onProgress called with correct value immediately after mount.
  });

  it('is a no-op when source is null', () => {
    // source=null, onProgress=null. No scroll listener added.
    // window.dispatchEvent('scroll'). onProgress never called.
  });
});

describe('useViewportRelativeScroll — context lifecycle', () => {
  it('does not call restoreContext on first intersection (initializedRef=false)', () => {
    // Mount hook with canvas. Fire isIntersecting=true.
    // extRef.current?.restoreContext should NOT be called.
  });

  it('sets initializedRef=true on first intersection', () => {
    // After first isIntersecting=true, subsequent exit+re-entry calls restoreContext.
  });

  it('calls loseContext on intersection exit after first initialization', () => {
    // Fire isIntersecting=true (init). Fire isIntersecting=false.
    // Assert canvas.getContext('webgl2') called. Assert ext.loseContext() called.
  });

  it('calls restoreContext on re-entry after loseContext', () => {
    // Fire isIntersecting=true (init). Fire isIntersecting=false (lose).
    // Fire isIntersecting=true (restore). Assert ext.restoreContext() called.
  });

  it('creates IntersectionObserver with rootMargin 200px', () => {
    // Assert IntersectionObserver was constructed with { rootMargin: '200px' }.
  });

  it('disconnects IntersectionObserver on unmount', () => {
    // Unmount hook. Assert mockObserver.disconnect() called.
  });

  it('is a no-op when canvasRef is null', () => {
    // source=null. No IntersectionObserver created.
  });
});
```

---

## 4. Phase 2, Stream C — DocsLayout (Root Layout Rewrite)

**Depends on:** Phase 1 complete (both A and B).

### 4.1 Delete file: `apps/docs/src/components/layout/DocsApp.tsx`

This file is replaced by `DocsLayout.tsx`. All EngineProvider usage moves to individual `ScenePanel` components. Delete the file entirely.

### 4.2 New file: `apps/docs/src/layout/DocsLayout.tsx`

This component is the single continuous document root. It imports `NavProvider` (Stream E), `DocsSidebar` (Stream E), `ActHeader`/`ProseBlock`/`ScenePanel` (Stream D), and all scene DSL components (Stream F). It is the authoritative source of doc content ordering.

The following is the **structural template** — Stream C implements the skeleton, with each scene's prose content filled in as part of Stream F (scene migration). Stream C provides the `/* PROSE: ... */` comment placeholders for each section; Stream F fills them.

```tsx
// apps/docs/src/layout/DocsLayout.tsx
// Single continuous document div — the complete BrewSite docs page.

import { type JSX, useMemo } from 'react';
import { corePlugin } from '@brewsite/core';
import type { WidgetPlugin } from '@brewsite/core';
import { NavProvider } from '../nav/NavContext';
import { DocsSidebar } from '../components/layout/DocsSidebar';
import { ActHeader } from '../components/ActHeader';
import { ProseBlock } from '../components/ProseBlock';
import { ScenePanel } from '../components/ScenePanel';

// Scene DSL imports (two-scene versions — owned by Stream F)
import { SceneWhatIsBrewSitePanel } from '../scenes/content/getting-started/sceneWhatIsBrewSite';
import { SceneInstallationPanel } from '../scenes/content/getting-started/sceneInstallation';
import { SceneQuickStartPanel } from '../scenes/content/getting-started/sceneQuickStart';
import { SceneConceptsPanel } from '../scenes/content/getting-started/sceneConcepts';
import { SceneSceneDslPanel } from '../scenes/content/scene-authoring/sceneSceneDsl';
import { SceneMultiScenePanel } from '../scenes/content/scene-authoring/sceneMultiScene';
import { SceneTransitionsPanel } from '../scenes/content/scene-authoring/sceneTransitions';
import { SceneProgressManagerPanel } from '../scenes/content/scene-authoring/sceneProgressManager';
import { SceneCameraPanel } from '../scenes/content/elements/sceneCamera';
import { SceneLightingPanel } from '../scenes/content/elements/sceneLighting';
import { SceneBackgroundPanel } from '../scenes/content/elements/sceneBackground';
import { SceneEnvironmentPanel } from '../scenes/content/elements/sceneEnvironment';
import { SceneFloorPanel } from '../scenes/content/elements/sceneFloor';
import { SceneHudPanel } from '../scenes/content/overlay-content/sceneHud';
import { SceneHudAnimejsPanel } from '../scenes/content/overlay-content/sceneHudAnimejs';
import { SceneInputNavigationPanel } from '../scenes/content/input/sceneInputNavigation';
import { SceneInputActionsPanel } from '../scenes/content/input/sceneInputActions';
import { ScenePlayerPanel } from '../scenes/content/player-hooks/scenePlayer';
import { SceneHooksPanel } from '../scenes/content/player-hooks/sceneHooks';
import { SceneWidgetSdkPanel } from '../scenes/content/widget-sdk/sceneWidgetSdk';
import { SceneCustomWidgetPanel } from '../scenes/content/widget-sdk/sceneCustomWidget';
import { SceneVariableStorePanel } from '../scenes/content/widget-sdk/sceneVariableStore';
import { SceneWidgetRegistryPanel } from '../scenes/content/widget-sdk/sceneWidgetRegistry';
import { SceneApiReferencePanel } from '../scenes/content/reference/sceneApiReference';
import { SceneTimelinePanel } from '../scenes/content/reference/sceneTimeline';

// Module-level stable plugin list — shared across all ScenePanels on this page.
// Must be module-level (not inside a component) to be referentially stable.
// All panels use the same corePlugin instance with identical options.
const DOCS_PLUGINS: WidgetPlugin[] = [corePlugin()];

const MANIFEST_URL = '/scene-manifest.json';

export function DocsLayout(): JSX.Element {
  return (
    <NavProvider>
      <div style={{ display: 'flex', minHeight: '100vh' }}>
        <DocsSidebar />

        <main className="docs-main">
          {/* ── Act 1: Getting Started ──────────────────────────────────── */}
          <ActHeader id="act-getting-started" title="Getting Started" />

          <ProseBlock id="what-is-brewsite-prose">
            {/* PROSE: Stream F fills this with the WhatIsBrewSite prose content */}
          </ProseBlock>

          <ScenePanel
            id="scene-what-is-brewsite"
            height="calc(100vh + 400px)"
            plugins={DOCS_PLUGINS}
            manifestUrl={MANIFEST_URL}
          >
            <SceneWhatIsBrewSitePanel />
          </ScenePanel>

          <ProseBlock id="installation-prose">
            {/* PROSE: Stream F */}
          </ProseBlock>

          <ScenePanel
            id="scene-installation"
            height="calc(100vh + 400px)"
            plugins={DOCS_PLUGINS}
            manifestUrl={MANIFEST_URL}
          >
            <SceneInstallationPanel />
          </ScenePanel>

          <ProseBlock id="quick-start-prose">
            {/* PROSE: Stream F */}
          </ProseBlock>

          <ScenePanel
            id="scene-quick-start"
            height="calc(100vh + 600px)"
            plugins={DOCS_PLUGINS}
            manifestUrl={MANIFEST_URL}
          >
            <SceneQuickStartPanel />
          </ScenePanel>

          <ProseBlock id="concepts-prose">
            {/* PROSE: Stream F */}
          </ProseBlock>

          <ScenePanel
            id="scene-concepts"
            height="calc(100vh + 400px)"
            plugins={DOCS_PLUGINS}
            manifestUrl={MANIFEST_URL}
          >
            <SceneConceptsPanel />
          </ScenePanel>

          {/* ── Act 2: Scene Authoring ───────────────────────────────────── */}
          <ActHeader id="act-scene-authoring" title="Scene Authoring" />

          <ProseBlock id="scene-dsl-prose">{/* PROSE: Stream F */}</ProseBlock>
          <ScenePanel id="scene-scene-dsl" height="calc(100vh + 600px)" plugins={DOCS_PLUGINS} manifestUrl={MANIFEST_URL}>
            <SceneSceneDslPanel />
          </ScenePanel>

          <ProseBlock id="multi-scene-prose">{/* PROSE: Stream F */}</ProseBlock>
          <ScenePanel id="scene-multi-scene" height="calc(100vh + 600px)" plugins={DOCS_PLUGINS} manifestUrl={MANIFEST_URL}>
            <SceneMultiScenePanel />
          </ScenePanel>

          <ProseBlock id="transitions-prose">{/* PROSE: Stream F */}</ProseBlock>
          <ScenePanel id="scene-transitions" height="calc(100vh + 600px)" plugins={DOCS_PLUGINS} manifestUrl={MANIFEST_URL}>
            <SceneTransitionsPanel />
          </ScenePanel>

          <ProseBlock id="progress-manager-prose">{/* PROSE: Stream F */}</ProseBlock>
          <ScenePanel id="scene-progress-manager" height="calc(100vh + 400px)" plugins={DOCS_PLUGINS} manifestUrl={MANIFEST_URL}>
            <SceneProgressManagerPanel />
          </ScenePanel>

          {/* ── Act 3: Elements ──────────────────────────────────────────── */}
          <ActHeader id="act-elements" title="Elements" />

          <ProseBlock id="camera-prose">{/* PROSE: Stream F */}</ProseBlock>
          <ScenePanel id="scene-camera" height="calc(100vh + 600px)" plugins={DOCS_PLUGINS} manifestUrl={MANIFEST_URL}>
            <SceneCameraPanel />
          </ScenePanel>

          <ProseBlock id="lighting-prose">{/* PROSE: Stream F */}</ProseBlock>
          <ScenePanel id="scene-lighting" height="calc(100vh + 600px)" plugins={DOCS_PLUGINS} manifestUrl={MANIFEST_URL}>
            <SceneLightingPanel />
          </ScenePanel>

          <ProseBlock id="background-prose">{/* PROSE: Stream F */}</ProseBlock>
          <ScenePanel id="scene-background" height="calc(100vh + 400px)" plugins={DOCS_PLUGINS} manifestUrl={MANIFEST_URL}>
            <SceneBackgroundPanel />
          </ScenePanel>

          <ProseBlock id="environment-prose">{/* PROSE: Stream F */}</ProseBlock>
          <ScenePanel id="scene-environment" height="calc(100vh + 400px)" plugins={DOCS_PLUGINS} manifestUrl={MANIFEST_URL}>
            <SceneEnvironmentPanel />
          </ScenePanel>

          <ProseBlock id="floor-prose">{/* PROSE: Stream F */}</ProseBlock>
          <ScenePanel id="scene-floor" height="calc(100vh + 400px)" plugins={DOCS_PLUGINS} manifestUrl={MANIFEST_URL}>
            <SceneFloorPanel />
          </ScenePanel>

          {/* ── Act 4: Overlay Content ───────────────────────────────────── */}
          <ActHeader id="act-overlay-content" title="Overlay Content" />

          <ProseBlock id="hud-prose">{/* PROSE: Stream F */}</ProseBlock>
          <ScenePanel id="scene-hud" height="calc(100vh + 600px)" plugins={DOCS_PLUGINS} manifestUrl={MANIFEST_URL}>
            <SceneHudPanel />
          </ScenePanel>

          <ProseBlock id="hud-animejs-prose">{/* PROSE: Stream F */}</ProseBlock>
          <ScenePanel id="scene-hud-animejs" height="calc(100vh + 400px)" plugins={DOCS_PLUGINS} manifestUrl={MANIFEST_URL}>
            <SceneHudAnimejsPanel />
          </ScenePanel>

          {/* ── Act 5: Input ─────────────────────────────────────────────── */}
          <ActHeader id="act-input" title="Input" />

          <ProseBlock id="input-navigation-prose">{/* PROSE: Stream F */}</ProseBlock>
          <ScenePanel id="scene-input-navigation" height="calc(100vh + 400px)" plugins={DOCS_PLUGINS} manifestUrl={MANIFEST_URL}>
            <SceneInputNavigationPanel />
          </ScenePanel>

          <ProseBlock id="input-actions-prose">{/* PROSE: Stream F */}</ProseBlock>
          <ScenePanel id="scene-input-actions" height="calc(100vh + 600px)" plugins={DOCS_PLUGINS} manifestUrl={MANIFEST_URL}>
            <SceneInputActionsPanel />
          </ScenePanel>

          {/* ── Act 6: Player & Hooks ────────────────────────────────────── */}
          <ActHeader id="act-player-hooks" title="Player &amp; Hooks" />

          <ProseBlock id="player-prose">{/* PROSE: Stream F */}</ProseBlock>
          <ScenePanel id="scene-player" height="calc(100vh + 400px)" plugins={DOCS_PLUGINS} manifestUrl={MANIFEST_URL}>
            <ScenePlayerPanel />
          </ScenePanel>

          <ProseBlock id="hooks-prose">{/* PROSE: Stream F */}</ProseBlock>
          <ScenePanel id="scene-hooks" height="calc(100vh + 600px)" plugins={DOCS_PLUGINS} manifestUrl={MANIFEST_URL}>
            <SceneHooksPanel />
          </ScenePanel>

          {/* ── Act 7: Widget SDK ────────────────────────────────────────── */}
          <ActHeader id="act-widget-sdk" title="Widget SDK" />

          <ProseBlock id="widget-sdk-prose">{/* PROSE: Stream F */}</ProseBlock>
          <ScenePanel id="scene-widget-sdk" height="calc(100vh + 400px)" plugins={DOCS_PLUGINS} manifestUrl={MANIFEST_URL}>
            <SceneWidgetSdkPanel />
          </ScenePanel>

          <ProseBlock id="custom-widget-prose">{/* PROSE: Stream F */}</ProseBlock>
          <ScenePanel id="scene-custom-widget" height="calc(100vh + 400px)" plugins={DOCS_PLUGINS} manifestUrl={MANIFEST_URL}>
            <SceneCustomWidgetPanel />
          </ScenePanel>

          <ProseBlock id="variable-store-prose">{/* PROSE: Stream F */}</ProseBlock>
          <ScenePanel id="scene-variable-store" height="calc(100vh + 600px)" plugins={DOCS_PLUGINS} manifestUrl={MANIFEST_URL}>
            <SceneVariableStorePanel />
          </ScenePanel>

          <ProseBlock id="widget-registry-prose">{/* PROSE: Stream F */}</ProseBlock>
          <ScenePanel id="scene-widget-registry" height="calc(100vh + 400px)" plugins={DOCS_PLUGINS} manifestUrl={MANIFEST_URL}>
            <SceneWidgetRegistryPanel />
          </ScenePanel>

          {/* ── Act 8: Reference ─────────────────────────────────────────── */}
          <ActHeader id="act-reference" title="Reference" />

          <ProseBlock id="api-reference-prose">{/* PROSE: Stream F */}</ProseBlock>
          <ScenePanel id="scene-api-reference" height="calc(100vh + 400px)" plugins={DOCS_PLUGINS} manifestUrl={MANIFEST_URL}>
            <SceneApiReferencePanel />
          </ScenePanel>

          <ProseBlock id="timeline-prose">{/* PROSE: Stream F */}</ProseBlock>
          <ScenePanel id="scene-timeline" height="calc(100vh + 400px)" plugins={DOCS_PLUGINS} manifestUrl={MANIFEST_URL}>
            <SceneTimelinePanel />
          </ScenePanel>
        </main>
      </div>
    </NavProvider>
  );
}
```

### 4.3 Changes to `apps/docs/src/App.tsx` (or `routes.tsx`)

Read the current `App.tsx` and `routes.tsx` to understand how `DocsApp` is mounted. Replace all references to `DocsApp` with `DocsLayout`. The docs route should render `<DocsLayout />` directly. No `EngineProvider` wrapper at the route level — each `ScenePanel` is its own `EngineProvider`.

Remove the deep-link hash scroll effect that was in `DocsApp.tsx`. In the new design, the browser handles `#section-id` anchors natively because `id` attributes are real HTML ids on DOM elements.

### 4.4 CSS changes: `apps/docs/src/style/layout.css`

Remove all sticky-canvas layout rules. Replace with:

```css
/* Continuous scroll layout — no sticky canvas, no overflow tricks */
.docs-main {
  flex: 1;
  min-width: 0;
  /* Normal block flow — no position, no overflow, no height constraints */
}

/* docs-sidebar remains sticky as before */
.docs-sidebar {
  position: sticky;
  top: 0;
  height: 100vh;
  overflow-y: auto;
  flex-shrink: 0;
  width: 240px;
}
```

Remove any CSS that was supporting:
- The sticky canvas column (`position: sticky` on the canvas wrapper div)
- `EngineInputRegion` fill-container behavior (no longer used at the docs root level)
- `DocPanel` absolute positioning (`.doc-panel`, `.doc-panel--slide-in`, etc.)
- Any `overflow: hidden` that would break sticky positioning inside ScenePanels

---

## 5. Phase 2, Stream D — ScenePanel, ActHeader, ProseBlock Components

**Depends on:** Phase 1 complete (both A and B). Independent of streams C, E, F, G.

### 5.1 New file: `apps/docs/src/components/ScenePanel.tsx`

```tsx
// Block-level 3D scene panel in normal document flow.
// Each ScenePanel owns its EngineProvider and WebGL context lifecycle.

import { useEffect, useRef, type JSX, type ReactNode } from 'react';
import { EngineProvider, SceneCanvas } from '@brewsite/core';
import type { WidgetPlugin } from '@brewsite/core';

export interface ScenePanelProps {
  /**
   * The HTML id for this panel. Used as the anchor target for sidebar nav
   * and native browser anchor links (e.g., /docs#scene-what-is-brewsite).
   */
  id: string;

  /**
   * CSS height string. Must be >= 100vh for scroll animation to occur.
   * Recommended values:
   *   - 'calc(100vh + 200px)'  — short entry animation only
   *   - 'calc(100vh + 400px)'  — standard: animate in + dwell (recommended)
   *   - 'calc(100vh + 600px)'  — multi-step or slow demo
   * A development warning is emitted if height resolves below window.innerHeight.
   */
  height: string;

  /** WidgetPlugin array for this panel's EngineProvider. */
  plugins: WidgetPlugin[];

  /** Asset manifest URL. Default: '/scene-manifest.json'. */
  manifestUrl?: string;

  /** Scene DSL children (<Scene> declarations). Must contain at minimum 2 scenes. */
  children: ReactNode;
}

/**
 * ScenePanel — a fixed-height block element in normal document flow containing
 * a real <canvas> for 3D scene rendering.
 *
 * WebGL context lifecycle: IntersectionObserver (via EngineProvider viewport-relative
 * scroll source) acquires context on intersection entry and releases it via
 * WEBGL_lose_context on exit. At any moment only 1–2 visible panels hold live
 * GPU contexts — Safari's ~8-context limit is never approached regardless of
 * how many panels the page contains.
 *
 * Progress: scroll progress is computed from how far the user has scrolled
 * through the panel's scroll window (panelHeight - viewportHeight). Panels
 * shorter than the viewport show terminal state (progress=1) at all times.
 *
 * Constraint: must contain at minimum 2 <Scene> children. A single-scene
 * SceneTrack compiles to 1 tick (terminal state only) — scroll animation
 * requires a transition between at least 2 scenes.
 */
export function ScenePanel({
  id,
  height,
  plugins,
  manifestUrl = '/scene-manifest.json',
  children,
}: ScenePanelProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Development warning: panel shorter than viewport has no scroll window.
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') {
      const el = containerRef.current;
      if (el && el.offsetHeight < window.innerHeight) {
        console.warn(
          `[ScenePanel] id="${id}" height resolves to ${el.offsetHeight}px, which is less than ` +
          `window.innerHeight (${window.innerHeight}px). The panel has no scroll traversal window — ` +
          `it will always show the terminal pose (progress=1). ` +
          `Use height="calc(100vh + Npx)" to create a scroll window of Npx.`,
        );
      }
    }
  }, [id]);

  return (
    <div
      ref={containerRef}
      id={id}
      style={{
        // position: relative allows position: sticky on SceneCanvas to work.
        // Do NOT add overflow: hidden — that breaks position: sticky on children.
        position: 'relative',
        height,
      }}
    >
      <EngineProvider
        manifestUrl={manifestUrl}
        plugins={plugins}
        quality="balanced"
        scrollSource={{
          kind: 'viewport-relative',
          containerRef,
          canvasRef,
        }}
        onError={(err) => console.error(`[ScenePanel id="${id}"]`, err)}
      >
        {children}

        {/*
          SceneCanvas is position:sticky so it remains visible while the user
          scrolls through the panel's extra height (the scroll window).
          height:100vh ensures it fills exactly the viewport while sticky.

          The ref is forwarded to the <canvas> DOM element inside SceneCanvas,
          enabling useViewportRelativeScroll to manage the WEBGL_lose_context
          lifecycle on this canvas.
        */}
        <SceneCanvas
          ref={canvasRef}
          style={{
            position: 'sticky',
            top: 0,
            width: '100%',
            height: '100vh',
          }}
        />
      </EngineProvider>
    </div>
  );
}
```

**Critical CSS constraint:** The outer `<div>` must NOT have `overflow: hidden`. `overflow: hidden` on an ancestor breaks `position: sticky` on descendants — the sticky canvas would not remain visible while scrolling. The outer div needs only `position: relative` and `height`.

### 5.2 New file: `apps/docs/src/components/ActHeader.tsx`

CSS-only full-width section separator. No EngineProvider, no WebGL, zero GPU cost.

```tsx
// CSS-only act header — no WebGL, no EngineProvider.
// Real HTML element with id for native anchor links.

import { type JSX } from 'react';

export interface ActHeaderProps {
  /**
   * Real HTML id for native anchor links (/docs#act-getting-started).
   * Also used by NavContext for sidebar active section detection.
   */
  id: string;
  title: string;
}

export function ActHeader({ id, title }: ActHeaderProps): JSX.Element {
  return (
    <section
      id={id}
      className="act-header"
      aria-label={`Act: ${title}`}
    >
      <div className="act-header__inner">
        <h2 className="act-header__title">{title}</h2>
      </div>
    </section>
  );
}
```

Add to `apps/docs/src/style/layout.css`:

```css
.act-header {
  width: 100%;
  padding: 80px 48px 60px;
  background: var(--bg-act-header, linear-gradient(180deg, var(--bg-primary) 0%, var(--bg-secondary) 100%));
  border-bottom: 1px solid var(--border-subtle);
}

.act-header__inner {
  max-width: 960px;
  margin: 0 auto;
}

.act-header__title {
  font-size: var(--font-size-3xl);
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--text-primary);
  margin: 0;
}
```

### 5.3 New file: `apps/docs/src/components/ProseBlock.tsx`

Real HTML documentation content in normal document flow. The `id` is a real HTML id — anchor links work natively.

```tsx
// Real HTML prose section in document flow.
// id attribute enables native anchor links.

import { type JSX, type ReactNode } from 'react';

export interface ProseBlockProps {
  /**
   * Real HTML id — enables native anchor links (/docs#installation-prose).
   * Registered with NavContext on mount for sidebar active section detection.
   */
  id: string;
  children: ReactNode;
  className?: string;
}

export function ProseBlock({ id, children, className }: ProseBlockProps): JSX.Element {
  return (
    <section
      id={id}
      className={`prose-block${className ? ` ${className}` : ''}`}
    >
      <div className="prose-block__content">
        {children}
      </div>
    </section>
  );
}
```

Add to `apps/docs/src/style/layout.css`:

```css
.prose-block {
  padding: 64px 48px;
  max-width: 960px;
  margin: 0 auto;
}

.prose-block__content {
  /* Standard prose typography */
  font-size: var(--font-size-base);
  line-height: 1.7;
  color: var(--text-primary);
}

.prose-block__content h1 {
  font-size: var(--font-size-3xl);
  font-weight: 700;
  margin: 0 0 16px;
}

.prose-block__content h2 {
  font-size: var(--font-size-2xl);
  font-weight: 600;
  margin: 40px 0 12px;
}

.prose-block__content p {
  margin: 0 0 16px;
  color: var(--text-secondary);
}

.prose-block__content code {
  font-family: var(--font-mono);
  font-size: 0.875em;
  background: var(--bg-code-inline);
  padding: 2px 5px;
  border-radius: 3px;
}
```

---

## 6. Phase 2, Stream E — NavContext and Sidebar Rewrite

**Depends on:** Phase 1 complete. Independent of C, D, F, G.

### 6.1 New file: `apps/docs/src/nav/NavContext.tsx`

```tsx
// Navigation context: section registration, active-section detection via
// IntersectionObserver, and scrollToSection() with optional within-panel progress.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type JSX,
  type ReactNode,
  type RefObject,
} from 'react';

export type NavContextValue = {
  /**
   * Called by ProseBlock and ScenePanel on mount to register their id and ref
   * so NavContext can observe them for active-section detection.
   */
  register: (id: string, ref: RefObject<HTMLElement | null>) => void;

  /** Called on unmount to stop observing the element. */
  unregister: (id: string) => void;

  /** The id of the section currently most visible in the upper-middle viewport. */
  activeSectionId: string | null;

  /**
   * Scrolls the viewport to bring the given section into view.
   *
   * @param id    - The section id (must have been registered via register()).
   * @param progress - Optional [0..1] within-panel progress offset.
   *   When omitted: scrolls to the panel top (progress=0).
   *   When provided: calculates targetY such that the panel sits at the
   *   given fraction of its scroll window.
   *   Formula: targetY = panelTop + clamp01(progress) * max(0, panelHeight - viewportHeight)
   */
  scrollToSection: (id: string, progress?: number) => void;
};

const NavContext = createContext<NavContextValue | null>(null);

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

export function NavProvider({ children }: { children: ReactNode }): JSX.Element {
  const registrations = useRef(new Map<string, RefObject<HTMLElement | null>>());
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // IntersectionObserver for active section detection.
  // rootMargin: '-20% 0px -60% 0px' creates a detection band in the upper-middle
  // portion of the viewport. A section is "active" when >50% of it falls in this band.
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.intersectionRatio > 0.5) {
            const id = (entry.target as HTMLElement).dataset['navId'];
            if (id) {
              setActiveSectionId(id);
            }
          }
        }
      },
      {
        root: null, // viewport
        rootMargin: '-20% 0px -60% 0px',
        threshold: [0, 0.5, 1],
      },
    );
    observerRef.current = observer;

    // Re-observe any elements that registered before the observer was created.
    for (const [id, ref] of registrations.current.entries()) {
      const el = ref.current;
      if (el) {
        el.dataset['navId'] = id;
        observer.observe(el);
      }
    }

    return () => observer.disconnect();
  }, []);

  const register = useCallback((id: string, ref: RefObject<HTMLElement | null>) => {
    registrations.current.set(id, ref);
    const el = ref.current;
    if (el && observerRef.current) {
      el.dataset['navId'] = id;
      observerRef.current.observe(el);
    }
  }, []);

  const unregister = useCallback((id: string) => {
    const ref = registrations.current.get(id);
    const el = ref?.current;
    if (el && observerRef.current) {
      observerRef.current.unobserve(el);
    }
    registrations.current.delete(id);
  }, []);

  const scrollToSection = useCallback((id: string, progress?: number) => {
    const ref = registrations.current.get(id);
    const el = ref?.current;
    if (!el) {
      console.warn(`[NavContext] scrollToSection: id="${id}" not registered.`);
      return;
    }

    if (progress === undefined) {
      // Simple top-of-section navigation — let the browser handle it.
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }

    // Within-panel navigation: compute the target scrollY that places the panel
    // at the given progress fraction of its scroll window.
    // panelTop is computed from live element measurement — handles any layout reflow.
    const panelTop = el.getBoundingClientRect().top + window.scrollY;
    const maxScroll = Math.max(0, el.offsetHeight - window.innerHeight);
    const targetY = panelTop + clamp01(progress) * maxScroll;
    window.scrollTo({ top: targetY, behavior: 'smooth' });
  }, []);

  const value = useMemo(
    (): NavContextValue => ({ register, unregister, activeSectionId, scrollToSection }),
    [register, unregister, activeSectionId, scrollToSection],
  );

  return <NavContext.Provider value={value}>{children}</NavContext.Provider>;
}

export function useNavContext(): NavContextValue {
  const ctx = useContext(NavContext);
  if (!ctx) {
    throw new Error('[useNavContext] must be called inside <NavProvider>.');
  }
  return ctx;
}
```

### 6.2 Rewritten file: `apps/docs/src/nav/types.ts`

Replace the entire file:

```typescript
// Navigation type contracts for the continuous-scroll docs layout.
// scrollOffset is removed — active section detection and scrolling are
// now computed at runtime from live element measurements via NavContext.

export interface NavItem {
  label: string;
  /** DOM element id to pass to scrollToSection(). Must match the id on the ProseBlock or ScenePanel. */
  id: string;
  /**
   * Optional within-panel progress [0..1] for multi-step demos.
   * When set, scrollToSection(id, progress) positions the panel at this
   * fraction of its scroll window rather than the panel top.
   */
  progress?: number;
}

export interface NavSection {
  title: string;
  /** DOM element id of the ActHeader for this section. Used for active group detection. */
  actId?: string;
  items: NavItem[];
}
```

### 6.3 Rewritten file: `apps/docs/src/nav/docs-nav.ts`

Delete `SCENE_SCROLL_REGISTRY`, `TOTAL_SCROLL_HEIGHT`, and `SCENE_SCROLL_OFFSETS` entirely. Replace the file with:

```typescript
// Sidebar navigation configuration for the continuous-scroll docs layout.
//
// DELETED:
//   SCENE_SCROLL_REGISTRY   — scroll budget registry (replaced by live IntersectionObserver)
//   TOTAL_SCROLL_HEIGHT      — sum of all scrollUnits (no longer meaningful)
//   SCENE_SCROLL_OFFSETS     — precomputed pixel offsets (replaced by scrollToSection())
//
// Navigation now uses DOM element ids + NavContext.scrollToSection(id, progress?).

import type { NavSection } from './types';

export const docsNav: NavSection[] = [
  {
    title: 'Getting Started',
    actId: 'act-getting-started',
    items: [
      { label: 'What is BrewSite Core?', id: 'scene-what-is-brewsite' },
      { label: 'Installation',           id: 'scene-installation' },
      { label: 'Quick Start',            id: 'scene-quick-start' },
      { label: 'Core Concepts',          id: 'scene-concepts' },
    ],
  },
  {
    title: 'Scene Authoring',
    actId: 'act-scene-authoring',
    items: [
      { label: 'Scene DSL',              id: 'scene-scene-dsl' },
      { label: 'Multi-Scene Sequences',  id: 'scene-multi-scene' },
      { label: 'Transitions & Easing',   id: 'scene-transitions' },
      { label: 'ProgressManager',        id: 'scene-progress-manager' },
    ],
  },
  {
    title: 'Elements',
    actId: 'act-elements',
    items: [
      { label: 'Camera',                 id: 'scene-camera' },
      { label: 'Lighting',               id: 'scene-lighting' },
      { label: 'Background',             id: 'scene-background' },
      { label: 'Environment',            id: 'scene-environment' },
      { label: 'Floor',                  id: 'scene-floor' },
    ],
  },
  {
    title: 'Overlay Content',
    actId: 'act-overlay-content',
    items: [
      { label: 'Scene Overlay',          id: 'scene-hud' },
      { label: 'Anime.js Presets',       id: 'scene-hud-animejs' },
    ],
  },
  {
    title: 'Input',
    actId: 'act-input',
    items: [
      { label: 'Scene Navigation',       id: 'scene-input-navigation' },
      { label: 'Input Actions',          id: 'scene-input-actions' },
    ],
  },
  {
    title: 'Player & Hooks',
    actId: 'act-player-hooks',
    items: [
      { label: 'ScenePlayer & EngineProvider', id: 'scene-player' },
      { label: 'Hooks Reference',              id: 'scene-hooks' },
    ],
  },
  {
    title: 'Widget SDK',
    actId: 'act-widget-sdk',
    items: [
      { label: 'Overview',               id: 'scene-widget-sdk' },
      { label: 'Custom Widget',          id: 'scene-custom-widget' },
      { label: 'VariableStore',          id: 'scene-variable-store' },
      { label: 'Widget Registry',        id: 'scene-widget-registry' },
    ],
  },
  {
    title: 'Reference',
    actId: 'act-reference',
    items: [
      { label: 'API Reference',          id: 'scene-api-reference' },
      { label: 'Timeline & Math',        id: 'scene-timeline' },
    ],
  },
];
```

### 6.4 Rewritten file: `apps/docs/src/components/layout/DocsSidebar.tsx`

Replace the entire file. No longer reads from `useSceneEngineState('docs')` or `SCENE_SCROLL_OFFSETS`.

```tsx
// Docs sidebar — reads active section from NavContext, not from engine registry.
// Sidebar is outside any EngineProvider — uses NavContext for all engine-independent nav.

import { type JSX } from 'react';
import { useNavContext } from '../../nav/NavContext';
import { docsNav } from '../../nav/docs-nav';
import type { NavSection, NavItem } from '../../nav/types';

export function DocsSidebar(): JSX.Element {
  const { activeSectionId, scrollToSection } = useNavContext();

  return (
    <aside className="docs-sidebar">
      <div className="docs-sidebar__brand">
        <span className="doc-header__brand">BrewSite</span>
        <span style={{ color: 'var(--text-secondary)', marginLeft: 4, fontWeight: 400 }}>
          Docs
        </span>
      </div>

      {docsNav.map((section: NavSection) => (
        <div key={section.title} className="nav-section">
          <div className="nav-section__title">{section.title}</div>
          {section.items.map((item: NavItem) => (
            <button
              key={item.id}
              type="button"
              className={`nav-item nav-item--button${
                activeSectionId === item.id ? ' nav-item--active' : ''
              }`}
              onClick={() => scrollToSection(item.id, item.progress)}
              aria-current={activeSectionId === item.id ? 'page' : undefined}
            >
              {item.label}
            </button>
          ))}
        </div>
      ))}
    </aside>
  );
}
```

---

## 7. Phase 2, Stream F — Scene DSL Migration

**Depends on:** Phase 1 complete. Independent of C, D, E, G.

Stream F owns all files in `apps/docs/src/scenes/**/*.tsx` and `apps/docs/src/scenes/index.ts`.

### 7.1 Core migration pattern

Each existing content scene file follows the **old pattern**:

```tsx
// OLD — single scene, DocPanel overlay, scrollUnits:
export function SceneWhatIsBrewSite(): JSX.Element {
  return (
    <Scene key="scene-what-is-brewsite" id="scene-what-is-brewsite">
      <ProgressManager scrollUnits={2400} fn={DWELL_FN} />
      <Camera mode="world" position={[0, 1.8, 8]} target={[0, 0.8, 0]} fov={40} />
      <Background color="#0d0f1a" />
      <Lighting>...</Lighting>
      <Floor enabled><FloorPhysical opacity={0.35} /></Floor>
      <WhatIsBrewSiteContent />   {/* ← DocPanel overlay — DELETE */}
    </Scene>
  );
}
```

The new pattern is a **two-scene export** (`*Panel` suffix, no `key` prop needed on Scene):

```tsx
// NEW — two scenes, no DocPanel, no scrollUnits
import { JSX } from 'react';
import { Scene, Camera, Lighting, Ambient, Directional, Background, Floor, FloorPhysical, ProgressManager } from '@brewsite/core';
import { DWELL_FN } from '../../sceneUtils';

export function SceneWhatIsBrewSitePanel(): JSX.Element {
  return (
    <>
      {/* Base state: camera approaching (start of panel scroll window) */}
      <Scene id="scene-what-is-brewsite-base">
        <Camera mode="world" position={[0, 3, 12]} target={[0, 1, 0]} fov={50} />
        <Background color="#0a0a14" />
        <Lighting>
          <Ambient color="#4466ff" intensity={0.3} />
          <Directional color="#ffffff" intensity={1.2} position={[4, 10, 6]} />
        </Lighting>
        <Floor enabled>
          <FloorPhysical opacity={0.2} metalness={0.4} roughness={0.6} />
        </Floor>
      </Scene>

      {/* Arrived state: reading position (end of panel scroll window) */}
      {/* DWELL_FN: animation plays in first 25% of scroll window, then holds */}
      <Scene id="scene-what-is-brewsite-arrived">
        <ProgressManager fn={DWELL_FN} />
        {/* scrollUnits is NOT specified — it has no effect in viewport-relative mode */}
        <Camera mode="world" position={[0, 1.8, 8]} target={[0, 0.8, 0]} fov={40} />
        <Background color="#0d0f1a" />
        <Lighting>
          <Ambient color="#4466ff" intensity={0.4} />
          <Directional color="#ffffff" intensity={1.6} position={[4, 10, 6]} />
        </Lighting>
        <Floor enabled>
          <FloorPhysical opacity={0.35} metalness={0.4} roughness={0.6} />
        </Floor>
      </Scene>
    </>
  );
}
```

**Rules for every scene migration:**

1. The export function name changes from `SceneFoo` to `SceneFooPanel`.
2. Every scene gets a `base` scene and an `arrived` scene (minimum 2 scenes — compiler hard constraint).
3. The `base` scene state is the camera/lighting/etc. for the beginning of the animation (approaching pose).
4. The `arrived` scene has `<ProgressManager fn={DWELL_FN} />` (no `scrollUnits` — irrelevant in viewport-relative mode). It is the reading pose.
5. All `DocPanel` children are removed from scene files. Prose content moves to `ProseBlock` sections in `DocsLayout`.
6. The `WhatIsBrewSiteContent` (and equivalent) functions are deleted from scene files.
7. The `key` prop on `<Scene>` is removed (not needed; ids are unique per panel).
8. Import `DemoProgressProvider` is deleted from any scene file that used it.

### 7.2 Delete: act scene files

The act scenes (`apps/docs/src/scenes/acts/*.tsx`) are replaced by CSS-only `<ActHeader>` components. **Delete all files** in `apps/docs/src/scenes/acts/`:

- `actElements.tsx`
- `actGettingStarted.tsx`
- `actHero.tsx`
- `actInput.tsx`
- `actOverlayContent.tsx`
- `actPlayerHooks.tsx`
- `actReference.tsx`
- `actSceneAuthoring.tsx`
- `actWidgetSdk.tsx`

Also delete the hero scene if it exists as a separate file — the docs hero becomes a `ProseBlock` + first `ScenePanel` in `DocsLayout`.

### 7.3 ProgressManager in per-panel mode

`<ProgressManager scrollUnits={N}>` is meaningless in viewport-relative mode because there is no global scroll budget to allocate. The `scrollUnits` prop is silently ignored when the engine receives progress from `setControlledProgress` (viewport-relative mode bypasses the `SceneProgressMapper`).

**Only these ProgressManager props remain meaningful in viewport-relative panels:**
- `fn` — pacing curve. Use `DWELL_FN` on the `arrived` scene for the standard 25% animation / 75% dwell pattern.
- `autoAdvance` — still functional if the panel should auto-play when the user stops scrolling.
- `animationTimeScale` — still functional for animation speed during scroll.

**Never write `scrollUnits` in new scene files.** If you see it in a scene being migrated, omit it.

**For multi-step panels (3+ scenes)**, relative `scrollUnits` values DO allocate the panel's scroll window proportionally among steps via the existing `SceneProgressMapper`. Example:

```tsx
// 3-step demo: step 1 gets 33% of the scroll window, steps 2+3 get 33% each
<Scene id="demo-step-1">
  <ProgressManager fn={DWELL_FN} scrollUnits={1} />
  ...
</Scene>
<Scene id="demo-step-2">
  <ProgressManager fn={DWELL_FN} scrollUnits={1} />
  ...
</Scene>
<Scene id="demo-step-3">
  <ProgressManager fn={DWELL_FN} scrollUnits={1} />
  ...
</Scene>
```

In this case, `scrollUnits` is used for relative allocation only, not for global pixel budget. The panel's `height` prop determines the total scroll window.

### 7.4 Updated file: `apps/docs/src/scenes/index.ts`

Remove all act scene exports. Rename all content scene exports to the new `*Panel` convention:

```typescript
// Export only content scene DSL functions — no act scenes (those are CSS-only now).
export { SceneWhatIsBrewSitePanel } from './content/getting-started/sceneWhatIsBrewSite';
export { SceneInstallationPanel } from './content/getting-started/sceneInstallation';
export { SceneQuickStartPanel } from './content/getting-started/sceneQuickStart';
export { SceneConceptsPanel } from './content/getting-started/sceneConcepts';
export { SceneSceneDslPanel } from './content/scene-authoring/sceneSceneDsl';
export { SceneMultiScenePanel } from './content/scene-authoring/sceneMultiScene';
export { SceneTransitionsPanel } from './content/scene-authoring/sceneTransitions';
export { SceneProgressManagerPanel } from './content/scene-authoring/sceneProgressManager';
export { SceneCameraPanel } from './content/elements/sceneCamera';
export { SceneLightingPanel } from './content/elements/sceneLighting';
export { SceneBackgroundPanel } from './content/elements/sceneBackground';
export { SceneEnvironmentPanel } from './content/elements/sceneEnvironment';
export { SceneFloorPanel } from './content/elements/sceneFloor';
export { SceneHudPanel } from './content/overlay-content/sceneHud';
export { SceneHudAnimejsPanel } from './content/overlay-content/sceneHudAnimejs';
export { SceneInputNavigationPanel } from './content/input/sceneInputNavigation';
export { SceneInputActionsPanel } from './content/input/sceneInputActions';
export { ScenePlayerPanel } from './content/player-hooks/scenePlayer';
export { SceneHooksPanel } from './content/player-hooks/sceneHooks';
export { SceneWidgetSdkPanel } from './content/widget-sdk/sceneWidgetSdk';
export { SceneCustomWidgetPanel } from './content/widget-sdk/sceneCustomWidget';
export { SceneVariableStorePanel } from './content/widget-sdk/sceneVariableStore';
export { SceneWidgetRegistryPanel } from './content/widget-sdk/sceneWidgetRegistry';
export { SceneApiReferencePanel } from './content/reference/sceneApiReference';
export { SceneTimelinePanel } from './content/reference/sceneTimeline';
```

### 7.5 `apps/docs/src/scenes/sceneUtils.ts`

Keep `DWELL_FN`. No changes needed to this file.

---

## 8. Phase 2, Stream G — Dead Code Deletion

**Depends on:** Phase 1 complete. Independent of C, D, E, F.

### 8.1 Files to delete

| File | Reason |
|---|---|
| `apps/docs/src/components/content/DocPanel.tsx` | Replaced by `<ProseBlock>` in document flow |
| `apps/docs/src/components/content/DemoProgressProvider.tsx` | No global engine → no global sceneProgress to derive from |
| `apps/docs/src/scenes/acts/actElements.tsx` | Replaced by `<ActHeader>` (CSS-only) |
| `apps/docs/src/scenes/acts/actGettingStarted.tsx` | Same |
| `apps/docs/src/scenes/acts/actHero.tsx` | Same |
| `apps/docs/src/scenes/acts/actInput.tsx` | Same |
| `apps/docs/src/scenes/acts/actOverlayContent.tsx` | Same |
| `apps/docs/src/scenes/acts/actPlayerHooks.tsx` | Same |
| `apps/docs/src/scenes/acts/actReference.tsx` | Same |
| `apps/docs/src/scenes/acts/actSceneAuthoring.tsx` | Same |
| `apps/docs/src/scenes/acts/actWidgetSdk.tsx` | Same |
| `apps/docs/src/components/layout/DocsApp.tsx` | Replaced by `DocsLayout.tsx` (owned by Stream C) |

Delete the `apps/docs/src/scenes/acts/` directory after removing all files.

### 8.2 Simplify `apps/docs/src/components/demo/InlineDemo.tsx`

`InlineDemo` is kept but simplified. In the new architecture, full 3D demonstrations are `<ScenePanel>` blocks in document flow. `InlineDemo` serves only as a small embedded demo widget in prose — driven by a static `controlledProgress` or left at 0. Remove the `controlledProgress` prop driven by `DemoProgressProvider` (which is deleted).

Simplified `InlineDemo`:

```tsx
// Small embedded 3D demo for prose sections.
// Progress is static (defaults to 0 — shows base state).
// For animated scroll-driven demos, use <ScenePanel> instead of InlineDemo.

import { type JSX, type ReactNode } from 'react';
import { corePlugin, EngineProvider, EngineInputRegion, SceneCanvas } from '@brewsite/core';

// Module-level stable plugin list.
const INLINE_DEMO_PLUGINS = [corePlugin()];

interface InlineDemoProps {
  children: ReactNode;
  height?: number;
  /** Static progress [0..1] for the demo. Default: 0 (base state). */
  controlledProgress?: number;
  manifestUrl?: string;
}

export function InlineDemo({
  children,
  height = 360,
  controlledProgress = 0,
  manifestUrl = '/scene-manifest.json',
}: InlineDemoProps): JSX.Element {
  return (
    <div
      style={{
        height,
        borderRadius: 8,
        overflow: 'hidden',
        border: '1px solid rgba(255,255,255,0.1)',
        margin: '20px 0',
        background: 'var(--bg-demo)',
      }}
    >
      <EngineProvider
        manifestUrl={manifestUrl}
        plugins={INLINE_DEMO_PLUGINS}
        quality="performance"
        controlledProgress={controlledProgress}
      >
        {children}
        <EngineInputRegion fillContainer>
          <SceneCanvas style={{ width: '100%', height: '100%' }} />
        </EngineInputRegion>
      </EngineProvider>
    </div>
  );
}
```

`InlineDemo` retains its own `EngineProvider` (static controlled mode). It does NOT use `scrollSource: 'viewport-relative'` — it is a small embedded widget, not a full scroll-driven panel. To avoid contributing to the browser's context limit, the `quality="performance"` setting is intentional (30fps, smaller GPU footprint). Inline demos in prose that need to be scroll-driven should be converted to a `<ScenePanel>` in `DocsLayout` instead.

---

## 9. Dependency Sequencing

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ PHASE 1 (parallel — no shared files)                                        │
│                                                                             │
│  Stream A ──────────────────────────────────────────────────────────────►  │
│  RuntimeLoop.pause()/resume(), useSceneEngine.ts, RuntimeLoop.test.ts       │
│                                                                             │
│  Stream B ──────────────────────────────────────────────────────────────►  │
│  engineTypes.ts, useViewportRelativeScroll.ts, EngineProvider.tsx,          │
│  player/index.ts, useViewportRelativeScroll.test.ts                         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
              │ (both A and B must be merged before Phase 2 begins)
              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ PHASE 2 (parallel — no shared files, all depend on Phase 1)                 │
│                                                                             │
│  Stream C ──────────────────────────────────────────────────────────────►  │
│  DocsLayout.tsx, App.tsx, routes.tsx, layout.css                            │
│                                                                             │
│  Stream D ──────────────────────────────────────────────────────────────►  │
│  ScenePanel.tsx, ActHeader.tsx, ProseBlock.tsx                              │
│                                                                             │
│  Stream E ──────────────────────────────────────────────────────────────►  │
│  NavContext.tsx, nav/types.ts, docs-nav.ts, DocsSidebar.tsx                 │
│                                                                             │
│  Stream F ──────────────────────────────────────────────────────────────►  │
│  All scenes/**/*.tsx, scenes/index.ts                                       │
│                                                                             │
│  Stream G ──────────────────────────────────────────────────────────────►  │
│  Delete dead files, simplify InlineDemo.tsx                                 │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
              │ (all streams merged — integration + smoke test)
              ▼
         DONE: docs app runs on new architecture
```

**Integration prerequisite (before Phase 2 streams can compile):**
- Stream D's `ScenePanel` imports `EngineProvider` with `scrollSource.kind === 'viewport-relative'` — requires Stream B.
- Stream D's `ScenePanel` indirectly triggers `RuntimeLoop.setCanvas()` — requires Stream A.
- Streams C, E, F, G have no direct imports from Stream A or B (they import only from `@brewsite/core` published interface, which is unchanged from their perspective).

---

## 10. Testing Strategy Per Stream

### Stream A tests
**File:** `packages/core/src/runtime/__tests__/RuntimeLoop.test.ts`

All tests use a synthetic `RuntimeLoopClock` with controllable `requestFrame`/`cancelFrame` (no real RAF). Use `vi.fn()` for clock methods. The test double `RuntimeDriver` records `tick()` calls.

| Test scenario | Assertion |
|---|---|
| `pause()` cancels RAF | `clock.cancelFrame` spy called once |
| `pause()` idempotent | `clock.cancelFrame` called exactly once across two pause() calls |
| `resume()` re-queues RAF when running+paused | `clock.requestFrame` called again after resume() |
| `resume()` no-op when not paused | `clock.requestFrame` call count unchanged |
| `resume()` no-op when not running | No RAF queued |
| `stop()` clears isPaused | Subsequent `start()` + step works normally |
| `setCanvas()` pauses on `webglcontextlost` | Dispatch `webglcontextlost` on canvas → verify next `step()` call does not invoke `driver.tick()` |
| `setCanvas()` resumes on `webglcontextrestored` | Dispatch lost + restored → verify `driver.tick()` is called again |
| `setCanvas(null)` removes listeners | Lost event after `setCanvas(null)` — no pause |
| `setCanvas()` switches canvas cleanly | Old canvas events ignored, new canvas events handled |
| `webglcontextlost` calls `e.preventDefault()` | Verify `event.defaultPrevented === true` |

### Stream B tests
**File:** `packages/core/src/player/__tests__/useViewportRelativeScroll.test.ts`

Use `renderHook` from `@testing-library/react`. Mock `IntersectionObserver` globally. Mock `window.scrollY`, `window.innerHeight`, `element.offsetHeight`, `element.getBoundingClientRect()`.

| Test scenario | Assertion |
|---|---|
| Returns immediately when source is null | `onProgress` never called; no IntersectionObserver created |
| Correct progress at panel top (scrollY = panelTop) | `onProgress(0)` |
| Correct progress at panel bottom | `onProgress(1)` |
| Correct progress at midpoint | `onProgress(0.5)` |
| Progress clamped to [0,1] | Negative scroll → 0; over-scroll → 1 |
| Sub-viewport panel → progress=1 | `offsetHeight < innerHeight` → `onProgress(1)` |
| `onProgress` called on `scroll` event | Fire `window.dispatchEvent(new Event('scroll'))` |
| `onProgress` called on `resize` event | Fire `window.dispatchEvent(new Event('resize'))` |
| `onProgress` called synchronously on mount | onProgress called before any events dispatched |
| First IntersectionObserver entry → does NOT call restoreContext | Mock ext; fire entry; assert `ext.restoreContext` not called |
| Exit after init → calls `loseContext` | Fire entry, then exit; assert `ext.loseContext` called |
| Re-entry → calls `restoreContext` | Full cycle: entry, exit, re-entry; assert `ext.restoreContext` called once |
| IntersectionObserver rootMargin is '200px' | Assert constructor was called with `{ rootMargin: '200px' }` |
| IntersectionObserver disconnected on unmount | `mockObserver.disconnect()` called |

---

## 11. Known Risks and Notes

### 11.1 Involuntary GPU context loss
`WEBGL_lose_context.loseContext()` is explicit and deterministic. However, `webglcontextlost` can also fire involuntarily from GPU driver resets, iOS tab-backgrounding memory pressure, or browser-imposed context limits being exceeded concurrently. The `RuntimeLoop.setCanvas()` listener handles both cases identically — the event source does not matter. Note: Three.js WebGL resource re-upload on `webglcontextrestored` is not guaranteed to succeed on all driver/platform combinations. Visible stalls may occur on restoration after involuntary loss.

### 11.2 Safari sticky + overflow constraint
The `ScenePanel` outer div must never have `overflow: hidden`. Adding it would break `position: sticky` on the `SceneCanvas` child, causing the canvas to scroll out of view during the panel's scroll window. Enforce this in code review.

### 11.3 Two-scene minimum
The `sceneTrackCompiler` produces exactly 1 tick for a single-scene engine. This tick always shows the terminal pose (`sceneProgress=1`). A `ScenePanel` with only one `<Scene>` will show the terminal pose regardless of scroll position — no animation occurs. Enforce 2-scene minimum in content review, not code. `ScenePanel` does not enforce this at runtime because it cannot inspect the compiled SceneTrack.

### 11.4 `useSceneEngine.ts` — `controlledProgressRef` name
Stream B specifies adding `setControlledProgress` which writes to `controlledProgressRef.current`. The implementer must verify the exact name of this ref in the existing `useSceneEngine.ts` source (the file is 50KB; the ref name may differ). The behavior contract is clear: `setControlledProgress(p)` must write `p` into the same ref that `getGlobalProgress()` returns, bypassing the scroll mapper. Look for the ref used in the `controlledProgress` prop handling code path.

### 11.5 InlineDemo context budget
Each `InlineDemo` creates its own WebGL context. In the new design, `InlineDemo` is NOT subject to the `useViewportRelativeScroll` lifecycle management. If a ProseBlock section contains many InlineDemos that are simultaneously in the DOM, they can consume multiple context slots. Keep InlineDemo usage minimal — prefer `ScenePanel` for animated content.

### 11.6 `SceneCanvas` ref forwarding timing
`SceneCanvas` forwards its ref via `useEffect`, not during the React commit phase ref assignment. Therefore `canvasRef.current` is populated after `SceneCanvas`'s `useEffect` runs. Since `SceneCanvas` is a child of `EngineProvider`, React fires its effects before EngineProvider's effects (children-before-parents). `useViewportRelativeScroll`'s IntersectionObserver setup effect (called from inside EngineProvider) runs after SceneCanvas's ref-forwarding effect, so `canvasRef.current` is guaranteed to be populated when the IntersectionObserver observes it.

### 11.7 `EngineProvider` `plugins` prop stability
Each `ScenePanel` receives `DOCS_PLUGINS` from a module-level constant. This ensures the plugins array is referentially stable across renders. If `ScenePanel` users construct plugin arrays inline or inside a component, they must wrap them in `useMemo`. `ScenePanel`'s API documentation should note this. The `DocsLayout` uses a module-level constant, so it is correct.
