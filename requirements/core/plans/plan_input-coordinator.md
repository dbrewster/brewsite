---
title: "InputCoordinator: Unified Input Handler"
doc_type: plan
owner: architect
status: complete
updated: 2026-03-13
---

# InputCoordinator: Unified Input Handler

## Objective

Replace the parallel, competing `ActionInput` + `InertiaScrollSource` + `KeyboardInput` trio with a single `InputCoordinator` component that owns all DOM event registration and applies an explicit priority waterfall. Eliminates wheel event ownership conflicts, native-scroll-vs-action-key races, and the confusion of three separate components that must be composed correctly to avoid bugs.

## Root Cause

`ActionInputController` (via `ActionInput`) and `InertiaScrollSource` both attach independent wheel event listeners. No coordination exists between them. When a `WheelMap` action matches (e.g., `camera.dolly`), both fire: the camera dollies AND the scene scroll accumulates. This is the core conflict.

Additionally, `ScrollStage` uses `overflowY: auto` even when a custom scroll source is active, so arrow keys trigger native scroll on the container, racing with `ActionInputController`'s document-level keydown handler.

`KeyboardInput` renders `position: absolute; inset: 0; pointer-events: auto` which intercepts pointer hit-tests above the canvas. Since `ActionInput` attaches to the canvas (not the container), events that hit `KeyboardInput` never reach the canvas listener.

## Design

### Priority waterfall (wheel events, evaluated once, first match wins)
```
1. Is cursor over scrollable overlay content not at its boundary?
   → yield to native DOM (no preventDefault, no accumulation)

2. Is this ctrl+wheel with pinch maps in current spec?
   → dispatch pinch action, preventDefault, return

3. Does current spec have a WheelMap that matches (no ctrl or with matching modifiers)?
   → dispatch action, preventDefault, return — scene scroll does NOT also happen

4. Is a scroll driver registered (inside ScrollStage)?
   → accumulate for inertia, preventDefault, return

5. Nothing matched → browser default (zoom on ctrl+wheel, etc.)
```

### Attachment point
- **Pointer, wheel, click** → `ScrollStage` container div (from `ScrollRegionContext`), falling back to `engine.canvasRef.current`. Attaching to the container rather than the canvas means events from `KeyboardInput`'s overlay div bubble correctly without needing to target the canvas specifically.
- **Keyboard** → `document`, always.

### ScrollStage overflow
When a custom source is registered (`customSource !== null`), set `overflowY: hidden` on the container. This prevents arrow keys from triggering native scroll on a container that isn't being driven by native scroll. One-line change.

### WheelMap exclusivity
If a `WheelMap` matches the current spec, the inertia accumulator does NOT fire. The scene author is explicitly claiming wheel for their action. To have both dolly and scene scroll, the author must use modifier keys (e.g., `<WheelMap axis="y" modifiers={['ctrl']} />` for dolly, leaving plain wheel to scene scroll).

### Scrollable content (horizontal + vertical)
The scrollable-ancestor walk checks BOTH axes:
- `scrollHeight > clientHeight` + `overflowY: auto|scroll` for vertical
- `scrollWidth > clientWidth` + `overflowX: auto|scroll` for horizontal

Walk from `event.target` up to the container. If a scrollable element has room to scroll in the wheel's direction, yield.

---

## Files

### CREATE: `packages/core/src/player/InputCoordinator.tsx`

Single null-rendering component replacing ActionInput + InertiaScrollSource + KeyboardInput.

```typescript
// InputCoordinator.tsx — Unified input coordinator.
// Single DOM attachment point with an explicit priority waterfall.
// Replaces ActionInput, InertiaScrollSource, and KeyboardInput.
```

**Props interface:**
```typescript
export interface InputCoordinatorProps {
  /**
   * Inertia scroll sensitivity. Higher = faster scene scroll per wheel tick.
   * Only applies when inside a ScrollStage. Default: 0.01.
   */
  inertiaSensitivity?: number;

  /**
   * Inertia decay factor per frame (0..1). Higher = more momentum.
   * Only applies when inside a ScrollStage. Default: 0.85.
   */
  inertiaDecay?: number;

  /**
   * DOM element that receives pointer/wheel events.
   * Defaults to the ScrollStage container if available, otherwise engine.canvasRef.
   */
  target?: HTMLElement | null;

  /**
   * DOM element or document that receives keyboard events.
   * Defaults to document.
   */
  keyboardTarget?: HTMLElement | Document | Window | null;

  /**
   * Pause engine rendering when the stage falls below the visibility threshold.
   * Uses IntersectionObserver on the scroll container or canvas.
   */
  pauseWhenHidden?: PauseWhenHiddenOptions;
}
```

**Implementation structure:**

```
useSceneEngineContext()        → engineRef (stable closure)
useContext(ActionInputExtensionContext)
useContext(ScrollNavigatorContext) → scrollNavigatorRef
useContext(ScrollRegionContext)    → scrollRegion (for container ref)
useContext(ScrollDriverContext)    → to register IScrollSource

// ── Inertia state ─────────────────────────────────────────────────────
velocityRef: useRef(0)
pendingWheelDeltaRef: useRef(0)
subscribersRef: useRef(Set<(rawProgress) => void>)
rawProgressRef: useRef(0)

// ── IScrollSource (registered only when inside ScrollStage) ───────────
const source = useMemo<IScrollSource>(() => ({
  subscribe(onProgress) {
    subscribersRef.current.add(onProgress);
    onProgress(rawProgressRef.current);
    return () => subscribersRef.current.delete(onProgress);
  },
  scrollTo(rawProgress) {
    velocityRef.current = 0;
    pendingWheelDeltaRef.current = 0;
    emitProgress(rawProgress);
  },
}), [emitProgress])

useEffect: register source via scrollDriver.setSource(source), cleanup with setSource(null)

// ── RAF inertia loop ──────────────────────────────────────────────────
useEffect: requestAnimationFrame loop that calls computeInertiaStep() each frame,
           emits progress when it changes. Always running (no deps). Cleanup: cancelAnimationFrame.

// ── ActionInputController ─────────────────────────────────────────────
useEffect([props.target, props.keyboardTarget, pluginExtension, scrollRegion]):
  1. Resolve targetEl = props.target ?? scrollRegion?.containerRef.current ?? engine.canvasRef.current
  2. getSpec() closure reads __input_controller from current tick
  3. Build ActionInputHandler with onSceneStep, onCameraOrbit, onCameraDolly, onCameraReset,
     onCarouselStep, onUnknownAction — exact same implementations as current ActionInput.tsx
  4. Construct ActionInputController(targetEl, getSpec, handler, keyboardTarget, {
       idDefaults,
       onUnclaimedWheel: (e) => { pendingWheelDeltaRef.current += e.deltaY; e.preventDefault(); }
     })
  5. controller.attach()
  6. Cleanup: controller.detach()

// ── pauseWhenHidden ────────────────────────────────────────────────────
containerRef = scrollRegion?.containerRef ?? engineCanvasRef (as fallback)
usePauseWhenHidden(containerRef, props.pauseWhenHidden, onPauseChange)
onPauseChange pauses engine via engine.setPaused() — check if this method exists on engine,
if not, use engine.setProgress as a no-op (the pause feature was only advisory).

// ── sceneTrack change effect (clear patches on recompile) ─────────────
Same as in ActionInput.tsx — clears patchWidgetStates on sceneTrack change.

return null;
```

**The `onUnclaimedWheel` callback connects the waterfall's step 4 to the inertia accumulator.**
The waterfall itself lives inside `ActionInputController.handleWheel` (see below).

**emitProgress helper:**
```typescript
const emitProgress = useCallback((rawProgress: number): void => {
  rawProgressRef.current = clamp01(rawProgress);
  // Also sync the ScrollStage container's scrollTop so the native scroll
  // position reflects the programmatic position (needed for snapshots).
  const container = scrollRegion?.containerRef.current;
  if (container && scrollRegion) {
    const maxScroll = Math.max(0, scrollRegion.scrollHeightPx - container.clientHeight);
    container.scrollTop = rawProgressRef.current * maxScroll;
  }
  subscribersRef.current.forEach((cb) => cb(rawProgressRef.current));
}, [scrollRegion]);
```

---

### MODIFY: `packages/core/src/input/ActionInputController.ts`

**Add to `ActionInputControllerOptions`:**
```typescript
export type ActionInputControllerOptions = {
  idDefaults?: { cameraId: string; canvasId: string; };
  wheelLockIdleMs?: number;
  /**
   * Called when a wheel event is not claimed by any WheelMap in the current spec.
   * InputCoordinator passes its inertia accumulator here to implement the
   * priority waterfall: action maps win over scene scroll.
   */
  onUnclaimedWheel?: (event: WheelEvent) => void;
};
```

**Store in constructor:** `this.onUnclaimedWheel = options?.onUnclaimedWheel ?? null;`
Add `private readonly onUnclaimedWheel: ((event: WheelEvent) => void) | null;`

**Add private method `isOverScrollableContent`:**
```typescript
private isOverScrollableContent(e: WheelEvent): boolean {
  const container = this.target instanceof HTMLElement ? this.target : null;
  let el = e.target as HTMLElement | null;
  while (el && el !== container) {
    // Vertical scroll check (cheap property read first)
    if (el.scrollHeight > el.clientHeight) {
      const style = getComputedStyle(el);
      if (style.overflowY === 'auto' || style.overflowY === 'scroll') {
        const atTop = el.scrollTop <= 0 && e.deltaY < 0;
        const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 1 && e.deltaY > 0;
        if (!atTop && !atBottom) return true;
      }
    }
    // Horizontal scroll check
    if (el.scrollWidth > el.clientWidth) {
      const style = getComputedStyle(el);
      if (style.overflowX === 'auto' || style.overflowX === 'scroll') {
        const atLeft = el.scrollLeft <= 0 && e.deltaX < 0;
        const atRight = el.scrollLeft + el.clientWidth >= el.scrollWidth - 1 && e.deltaX > 0;
        if (!atLeft && !atRight) return true;
      }
    }
    el = el.parentElement;
  }
  return false;
}
```

**Modify `handleWheel`:**
Add the scrollable check at the very top:
```typescript
private handleWheel(e: WheelEvent): void {
  // [Waterfall step 1] Yield to scrollable overlay content.
  if (this.isOverScrollableContent(e)) return; // no preventDefault

  const spec = this.resolveSpec();
  if (!spec) {
    // No spec; fall through to unclaimed handler (scene scroll).
    this.onUnclaimedWheel?.(e);
    return;
  }

  // [Waterfall step 2] ctrl+wheel pinch (existing logic unchanged) ...

  // [Waterfall step 3] WheelMap match (existing logic) ...
  if (!best) {
    // [Waterfall step 4] No action claimed it — fall through to scroll.
    this.onUnclaimedWheel?.(e);
    return;
  }

  // Action claimed the event.
  e.preventDefault();
  // ... (existing dispatchWheel logic unchanged)
}
```

The existing scrollable-ancestor check in `InertiaScrollSource` is removed (it moves here, authoritatively).

---

### MODIFY: `packages/core/src/player/ScrollStage.tsx`

One change: toggle `overflowY` based on `customSource`.

In the container div's style object, change:
```typescript
// BEFORE:
overflowY: 'auto',

// AFTER:
overflowY: customSource ? 'hidden' : 'auto',
```

This prevents the container from accepting native keyboard scroll when a programmatic source owns progress. No other changes to ScrollStage.

---

### MODIFY: `packages/core/src/player/StageScrollSources.tsx`

Remove `InertiaScrollSource` entirely — it moves into `InputCoordinator`.
Keep `CustomScrollSource` and `ElementScrollSource` — these remain valid for non-inertia use cases.
Keep the `useRegisterScrollSource` internal hook.

Update file comment accordingly.

---

### MODIFY: `packages/core/src/player/index.ts`

Remove exports:
- `ActionInput`, `ActionInputProps`
- `InertiaScrollSource`, `InertiaScrollSourceProps`
- `KeyboardInput`, `KeyboardInputProps`

Add exports:
- `InputCoordinator`, `InputCoordinatorProps`

Keep `CustomScrollSource`, `ElementScrollSource` (with their prop types).

---

### DELETE: `packages/core/src/player/ActionInput.tsx`

Remove file entirely. No shim. Call sites migrate to `InputCoordinator`.

### DELETE: `packages/core/src/player/KeyboardInput.tsx`

Remove file entirely. `pauseWhenHidden` functionality moves into `InputCoordinator`. No shim.

---

### RENAME+UPDATE: `packages/core/src/player/__tests__/ActionInput.test.tsx`

Rename to `InputCoordinator.test.tsx`. Update:
- Import `InputCoordinator` instead of `ActionInput`
- Add `ScrollDriverContext` + `ScrollRegionContext` providers to test wrappers
- Verify waterfall: wheel event that matches WheelMap → action fires, NOT scroll accumulator
- Verify waterfall: wheel event with no WheelMap → `onProgress` subscriber called
- Keep existing keyboard nav and carousel step tests (update import only)

---

## Call Site Migration

Pattern: replace `<ActionInput /> + <InertiaScrollSource ...> + <KeyboardInput />` with `<InputCoordinator .../>`.

**With inertia scroll (most common):**
```tsx
// BEFORE
<ActionInput />
<KeyboardInput />
<InertiaScrollSource inertiaSensitivity={0.010} inertiaDecay={0.82} />

// AFTER
<InputCoordinator inertiaSensitivity={0.010} inertiaDecay={0.82} />
```

**Action-only (no inertia, no ScrollStage):**
```tsx
// BEFORE
<ActionInput />
<KeyboardInput />

// AFTER
<InputCoordinator />
```

### Files to migrate

All inside `ScrollStage` children or equivalent:

1. `apps/examples/src/input-showcase/InputShowcasePage.tsx` — has ActionInput + InertiaScrollSource
2. `apps/examples/src/chart/ChartDemoPage.tsx` — has ActionInput + KeyboardInput + InertiaScrollSource
3. `apps/examples/src/views/ViewDemoPage.tsx` — has ActionInput + KeyboardInput + InertiaScrollSource
4. `apps/examples/src/core-showcase/CoreShowcasePage.tsx` — has ActionInput + InertiaScrollSource
5. `apps/examples/src/architecture/ArchitecturePage.tsx` — has ActionInput + KeyboardInput
6. `apps/examples/src/brewflow-multiuser/MultiUserPage.tsx` — has ActionInput
7. `apps/examples/src/brewflow-comparison/ComparisonPage.tsx` — has ActionInput
8. `apps/examples/src/whiteboard-arch/WhiteboardArchPage.tsx` — has ActionInput
9. `apps/examples/src/brewflow-sidecar/SidecarNotePage.tsx` — has ActionInput
10. `apps/examples/src/core-showcase/overlays.tsx` — has ActionInput
11. `apps/examples/src/brewflow-memory/MemorySubsystemPage.tsx` — has ActionInput
12. `apps/website/src/landing/LandingPage.tsx` — has ActionInput

In each file:
- Remove `ActionInput`, `InertiaScrollSource`, `KeyboardInput` from imports
- Add `InputCoordinator` to imports
- Replace the JSX as above
- Preserve existing `inertiaSensitivity`/`inertiaDecay` values as props on `InputCoordinator`

---

## onSceneStep / onCarouselStep (copy from ActionInput.tsx)

The `handler` object inside `InputCoordinator`'s `useEffect` is identical to the one in `ActionInput.tsx`. Copy verbatim. Do not extract — the handler closes over refs and contexts that are already co-located.

---

## TypeScript constraints

- No `any`. No `as` casts to silence errors.
- `emitProgress` must be `useCallback` with `scrollRegion` in its deps.
- `scrollSource` must be `useMemo` with `emitProgress` in its deps.
- The `IScrollSource` registration `useEffect` must list `[scrollDriver, scrollSource]` in deps.
- The RAF loop `useEffect` must have `[emitProgress]` in deps — sensitivity and decay are read from refs per-frame, not re-subscribed.
- `ActionInputControllerOptions.onUnclaimedWheel` is optional (`?`). Existing callers unaffected.

---

## Testing strategy

### `InputCoordinator.test.tsx`

Interface-based stateful tests. Use real `ActionInputController` via the component (no mocking internals). Provide minimal engine mock and real DOM elements.

Tests:
1. **Keyboard nav**: dispatch keydown `ArrowRight` → `engine.advanceProgress` called (or `scrollNavigator.scrollTo` if scroll context present)
2. **WheelMap exclusive**: when spec has `WheelMap` on `camera.dolly`, wheel event → `engine.applyCameraDolly` called; `onProgress` subscriber NOT called (inertia not accumulated)
3. **Wheel fallback to inertia**: when spec has no `WheelMap`, wheel event → `onProgress` subscriber called with non-zero progress change
4. **Scrollable content guard**: wheel event over an element with `overflowY: auto` and room to scroll → neither camera nor inertia fire
5. **Carousel step**: `ArrowRight` with `carousel.next` spec → `engine.patchWidgetStates` called with updated layout

### `ActionInputController.test.ts`

Add two tests:
1. `isOverScrollableContent` yielding when over scrollable ancestor
2. `onUnclaimedWheel` called when no WheelMap matches

---

## Execution sequence

1. Modify `ActionInputController.ts` (add `onUnclaimedWheel`, `isOverScrollableContent`)
2. Create `InputCoordinator.tsx`
3. Update `StageScrollSources.tsx` (remove `InertiaScrollSource`)
4. Update `ScrollStage.tsx` (overflow toggle)
5. Update `index.ts` (swap exports)
6. Delete `ActionInput.tsx` and `KeyboardInput.tsx`
7. Migrate all 12 call sites
8. Rename + update `ActionInput.test.tsx` → `InputCoordinator.test.tsx`
9. Run `pnpm --filter @brewsite/core typecheck` and `pnpm --filter @brewsite/core test`
10. Fix any remaining type errors across the monorepo
11. Run full `pnpm typecheck` to catch cross-package issues
