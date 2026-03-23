---
title: "SceneEmbed — First-Class Embedded Scene Component"
doc_type: plan
owner: architect
status: complete
updated: 2026-03-23
---

# SceneEmbed — First-Class Embedded Scene Component

## 1. Problem Statement

Embedding BrewSite scenes inline in pages (MDX, docs, marketing) requires assembling 4–6 low-level primitives (`SceneEngine`, `SceneCanvas`, `BackgroundLayer`, `EngineOverlayHost`, `ControlledInput`/`TimeInput`, plus manual `IntersectionObserver` logic). Every consumer re-invents the same concerns:

| Concern | DemoScene | InlineDemo | ScenePanel |
|---|---|---|---|
| Stable plugin reference | `useMemo` | Module-level const | `useMemo` |
| Auto-play | Own RAF loop → `ControlledInput` | None (external) | `TimeInput` |
| Visibility gating | `IntersectionObserver` → autoPlay toggle | None | `IntersectionObserver` → lazy mount |
| Controlled progress | `ControlledInput` (deprecated) | `ControlledInput` (deprecated) | N/A |
| Performance throttling | None | `qualityPreset: 'performance'` | `qualityPreset: 'balanced'` |
| Pause on off-screen | No (autoPlay toggle only) | No | No (lazy mount only) |
| `document.hidden` handling | No | No | No |

The three deprecated components (`SceneReel`, `ControlledInput`, `TimeInput`) each solve a piece of this puzzle but none solves it completely. The result is fragile, duplicated application code.

### Goals

1. A single `<SceneEmbed>` component in `@brewsite/core` that replaces `SceneReel`, absorbs `ControlledInput` and `TimeInput` functionality, and provides first-class visibility lifecycle management.
2. Flat, MDX-friendly prop API — no nested config objects for common cases.
3. Automatic pause/resume when off-screen (IntersectionObserver + `document.visibilitychange`).
4. Lazy mount/unmount mode for pages with many (6+) embeds, to respect browser WebGL context limits.
5. Delete `SceneReel`, `ControlledInput`, `TimeInput`, and `ControlledProgressContext` from the public API. No backward compatibility.

---

## 2. Public API Design

### 2.1 SceneEmbed Props

```typescript
// packages/core/src/player/SceneEmbed.tsx

import type { SceneEngineProps } from './SceneEngine';

/**
 * Explicitly picked subset of SceneEngineProps that SceneEmbed forwards.
 * Using Pick (not Omit) ensures new SceneEngineProps additions must
 * opt-in to SceneEmbed forwarding — preventing accidental API surface expansion.
 */
type ForwardedEngineProps = Pick<SceneEngineProps,
  | 'id'
  | 'plugins'
  | 'theme'
  | 'sceneTheme'
  | 'timingProfile'
  | 'loadPolicy'
  | 'defaultTransitionDuration'
  | 'defaultTransitionEasing'
  | 'primaryCameraId'
  | 'primaryCanvasActionTargetId'
  | 'cameraInteractionDefaults'
  | 'invalidateCacheToken'
  | 'maxAnimBoostPerFrame'
  | 'scrollSource'
  | 'onReady'
  | 'onError'
  | 'onWidgetError'
  | 'onCompileWarning'
>;

export interface SceneEmbedProps extends ForwardedEngineProps {
  // ── Layout ──────────────────────────────────────────────────────────────────
  /** CSS height of the embed container. Required. */
  height: number | string;
  /** CSS width. Default: '100%'. */
  width?: number | string;
  /** CSS class applied to the outer container div. */
  className?: string;

  // ── Auto-Play ───────────────────────────────────────────────────────────────
  /**
   * Auto-advance engine progress via wall-clock time.
   *
   * - `true` — auto-play with defaults (duration: 6s, loop: true).
   * - `AutoPlayConfig` — customize duration and loop behavior.
   * - `false` / omitted — no auto-play.
   *
   * Ignored when `progress` is provided (controlled mode takes precedence).
   * Disabled when `prefers-reduced-motion` media query matches.
   */
  autoPlay?: boolean | AutoPlayConfig;

  // ── Controlled Progress ─────────────────────────────────────────────────────
  /**
   * Externally controlled engine progress in the range [0, 1].
   *
   * When provided, overrides `autoPlay` and drives the engine directly.
   * Pass a static literal to pin to a frame. Pass a dynamic value from
   * React state for interactive scrubbing.
   */
  progress?: number;

  /**
   * Called when an internal input source (e.g., keyboard navigation)
   * requests a progress change. Only meaningful when `progress` is provided.
   * Wire to the same setState that feeds `progress`.
   */
  onProgressChange?: (progress: number) => void;

  // ── Interaction ─────────────────────────────────────────────────────────────
  /**
   * Enable pointer-based camera interaction (orbit, dolly, pan).
   * Default: false. When true, mounts an InputCoordinator inside the engine.
   */
  interactive?: boolean;

  // ── Visibility Lifecycle ────────────────────────────────────────────────────
  /**
   * Controls engine mount lifecycle and rendering behavior relative to
   * viewport visibility.
   *
   * - `'always'` — Mount immediately, run continuously. No visibility gating.
   *   Use for a single hero embed that should appear instantly.
   *
   * - `'autopause'` — Mount immediately. Pause the RAF loop when the embed
   *   scrolls out of view. Resume when it scrolls back. **Default.**
   *   Zero GPU cost when off-screen, zero remount cost when returning.
   *
   * - `'lazy'` — Defer engine mount until the embed nears the viewport.
   *   Unmount (dispose the WebGL context) when it scrolls far away.
   *   Use for pages with many (6+) embeds to stay within the browser's
   *   WebGL context limit (~8–16 per tab).
   */
  visibility?: 'always' | 'autopause' | 'lazy';

  /**
   * IntersectionObserver rootMargin for visibility detection.
   * Controls how far outside the viewport the embed is considered "near."
   * Default: '200px'. Only meaningful when visibility is 'autopause' or 'lazy'.
   */
  rootMargin?: string;

  // ── Content ─────────────────────────────────────────────────────────────────
  /**
   * Scene declarations (`<Scene>` components) and optionally EngineGate,
   * overlay content, or other engine children. SceneEmbed provides
   * SceneCanvas, BackgroundLayer, and EngineOverlayHost automatically —
   * do not include those in children.
   */
  children: ReactNode;
}

export interface AutoPlayConfig {
  /**
   * Total seconds to traverse from progress 0 to 1.
   * For multi-scene embeds, this is the total animation duration
   * across all scenes, not per-scene.
   * Default: 6.
   */
  duration?: number;
  /**
   * Loop back to progress 0 when reaching the end.
   * Default: true.
   */
  loop?: boolean;
}
```

### 2.2 MDX Usage Examples

```mdx
import { SceneEmbed } from '@brewsite/core';
import { HeroScene, DiagramScene, ModelScene } from './scenes';

# Product Overview

{/* Auto-play with defaults (6s total, loops) */}
<SceneEmbed height={400} autoPlay>
  <HeroScene />
</SceneEmbed>

{/* Custom auto-play duration, no loop */}
<SceneEmbed height={400} autoPlay={{ duration: 10, loop: false }}>
  <HeroScene />
  <FeatureScene />
</SceneEmbed>

{/* Pinned to a specific frame */}
<SceneEmbed height={300} progress={0.5}>
  <DiagramScene />
</SceneEmbed>

{/* Interactive 3D model (orbit/pan/zoom) */}
<SceneEmbed height={400} interactive>
  <ModelScene />
</SceneEmbed>

{/* Many embeds on one page — use lazy visibility */}
<SceneEmbed height={300} autoPlay visibility="lazy">
  <Scene1 />
</SceneEmbed>
<SceneEmbed height={300} autoPlay visibility="lazy">
  <Scene2 />
</SceneEmbed>
{/* ... repeat 10+ times safely ... */}
```

---

## 3. Internal Architecture

### 3.1 Component Decomposition

```
SceneEmbed (exported)
│
├── useVisibilityGate(containerRef, visibility, rootMargin)
│   Returns: { mounted, visible }
│
├── <div ref={containerRef}>                         ← outer container
│   └── {mounted && <SceneEmbedInner ... />}         ← conditional on gate
│
SceneEmbedInner (not exported, internal to SceneEmbed.tsx)
│
├── <SceneEngine ...forwarded props>
│   ├── {children}                                   ← Scene declarations
│   ├── <EmbedProgressDriver ... />                  ← auto-play or controlled
│   ├── <EmbedVisibilityPauser visible={visible} />  ← pause/resume RAF
│   ├── {interactive && <InputCoordinator />}
│   ├── <BackgroundLayer style={...} />
│   ├── <div style={canvasWrapper}>
│   │   └── <SceneCanvas style={...} />
│   ├── <EngineOverlayHost />
│   └── </SceneEngine>
```

**Design rationale:** `SceneEmbed` is the outer shell that owns the container div and visibility gate. `SceneEmbedInner` is an internal function component that lives inside the `SceneEngine` context tree — this is required because the progress driver and visibility pauser need access to `useSceneEngineContext()`.

### 3.2 File Map

| File | Responsibility | Exports |
|---|---|---|
| `player/SceneEmbed.tsx` | Main component + inner engine wrapper | `SceneEmbed`, `SceneEmbedProps`, `AutoPlayConfig` |
| `player/useVisibilityGate.ts` | IntersectionObserver + `visibilitychange` lifecycle hook | `useVisibilityGate`, `VisibilityGateResult`, `VisibilityMode` |
| `player/useAutoPlay.ts` | RAF-based wall-clock progress driver hook | `useAutoPlay`, `UseAutoPlayOptions` (internal only — not exported from `player/index.ts`) |
| `player/__tests__/SceneEmbed.test.tsx` | Component layout, prop forwarding, mode selection tests | — |
| `player/__tests__/useVisibilityGate.test.ts` | Visibility gate hook tests | — |
| `player/__tests__/useAutoPlay.test.ts` | Auto-play hook tests | — |

---

## 4. Module Specifications

### 4.1 `useVisibilityGate` Hook

**File:** `packages/core/src/player/useVisibilityGate.ts`

```typescript
// useVisibilityGate.ts — Viewport-aware mount/pause lifecycle hook.

export type VisibilityMode = 'always' | 'autopause' | 'lazy';

export interface VisibilityGateResult {
  /**
   * Whether the engine subtree should be mounted in the React tree.
   * - 'always' | 'autopause': always true.
   * - 'lazy': true once the container enters the extended viewport
   *   (rootMargin). Reverts to false when the container leaves the
   *   extended viewport (unmount threshold: 2× rootMargin).
   */
  readonly mounted: boolean;

  /**
   * Whether the embed is currently visible in the viewport.
   * Used to pause/resume the engine's RAF loop.
   * - 'always': always true.
   * - 'autopause' | 'lazy': true when the container intersects the
   *   viewport (with rootMargin), AND the document is not hidden.
   */
  readonly visible: boolean;
}

/**
 * Combines IntersectionObserver (scroll visibility) and
 * document.visibilitychange (tab switching) into a single
 * mount/visible state pair.
 *
 * @beta This hook is exported for advanced consumers building custom
 * embed layouts. The API may change in a future minor release.
 *
 * @param containerRef  Ref to the outer container element.
 * @param mode          Visibility lifecycle mode.
 * @param rootMargin    IntersectionObserver rootMargin. Default: '200px'.
 */
export function useVisibilityGate(
  containerRef: RefObject<HTMLElement | null>,
  mode: VisibilityMode,
  rootMargin?: string,
): VisibilityGateResult;
```

**Behavior matrix:**

| Mode | `mounted` initial | `mounted` changes | `visible` initial | `visible` source |
|---|---|---|---|---|
| `'always'` | `true` | Never | `true` | Always `true` |
| `'autopause'` | `true` | Never | `true` (optimistic) | IntersectionObserver ∧ !document.hidden |
| `'lazy'` | `false` | `true` when intersecting (rootMargin). `false` when not intersecting (after 500ms debounce). | `false` | IntersectionObserver ∧ !document.hidden |

**Initial `visible` state rationale:** For `'autopause'` mode, `visible` initializes to `true` (optimistic). The IntersectionObserver will immediately correct to `false` if the element is actually off-screen. This prevents a pause→resume flicker on above-the-fold embeds where the engine would otherwise be paused on mount then resumed ~1ms later when the observer fires.

**Implementation details:**

1. **IntersectionObserver setup** (modes `autopause` and `lazy`):
   - Create a **single** IntersectionObserver with `rootMargin` (default `'200px'`).
   - On intersection change: update an internal `isIntersecting` ref and re-derive `visible`.
   - For `'autopause'` mode: `mounted` is always `true`. Only `visible` changes.
   - For `'lazy'` mode: `mounted` tracks `isIntersecting`, but the transition from `mounted: true` → `mounted: false` is **debounced by 500ms** using `setTimeout`. If the element re-enters the viewport within 500ms, the timeout is cleared and `mounted` stays `true`. This prevents rapid mount/unmount cycling (WebGL context create/destroy) when scrolling near the boundary. The debounce applies only to `mounted` (expensive WebGL lifecycle), NOT to `visible` (cheap RAF pause/resume — must be immediate).

2. **`document.visibilitychange` listener** (modes `autopause` and `lazy`):
   - Listen for `visibilitychange` on `document`.
   - When `document.hidden` becomes `true`, set visible to `false`.
   - When `document.hidden` becomes `false`, re-evaluate from IntersectionObserver state.
   - Cleanup listener on unmount.

3. **State management:**
   - Use `useState` for `mounted` (drives React tree mount/unmount).
   - Use `useRef` + `useState` for `visible` (needs to re-render children to pass new visible prop, but must also be readable synchronously).
   - `visible = isIntersecting && !document.hidden`.

4. **Cleanup:** Disconnect observer, clear any pending debounce timeout, and remove event listeners in the effect cleanup.

**Not handled (out of scope for this hook):**
- `prefers-reduced-motion` — handled by the auto-play hook.
- Engine `pause()`/`resume()` — handled by `EmbedVisibilityPauser` component.

### 4.2 `useAutoPlay` Hook

**File:** `packages/core/src/player/useAutoPlay.ts`

```typescript
// useAutoPlay.ts — RAF-based wall-clock progress driver for auto-playing embeds.

export interface UseAutoPlayOptions {
  /** Total seconds from progress 0 → 1. Default: 6. */
  duration: number;
  /** Loop back to 0 when reaching 1. Default: true. */
  loop: boolean;
  /** Whether auto-play is currently active (not paused by visibility). */
  active: boolean;
}

/**
 * Drives engine progress via wall-clock time.
 * Must be called inside a SceneEngine context.
 *
 * When active:
 * - Runs a requestAnimationFrame loop.
 * - Computes delta from elapsed wall time.
 * - Advances engine.setProgress() each frame.
 * - Loops or stops at progress = 1 per options.
 *
 * When not active:
 * - RAF loop is cancelled.
 * - Timestamp is reset (no time jump on resume).
 *
 * When prefers-reduced-motion matches:
 * - Hook is a complete no-op regardless of `active`.
 */
export function useAutoPlay(options: UseAutoPlayOptions): void;
```

**Implementation details:**

1. **RAF loop:**
   - `useEffect` manages the lifecycle. Dependencies: `[active, engine]`.
   - When `active` is true, schedule `requestAnimationFrame(tick)`.
   - `tick(ts)`:
     - If `lastTimestamp` is null (first frame or just resumed), set `lastTimestamp = ts` and return (skip first frame to establish baseline).
     - `elapsed = (ts - lastTimestamp) / 1000`.
     - `lastTimestamp = ts`.
     - `delta = elapsed / duration`.
     - `current = engine.frameState.progress`.
     - `next = current + delta`.
     - If `next >= 1`: if `loop`, `next = next % 1`; else `next = 1`.
     - `engine.setProgress(Math.max(0, Math.min(1, next)))`.
   - Effect cleanup: `cancelAnimationFrame(rafId)`.

2. **Prop refs:**
   - `duration` and `loop` are captured in refs (not effect dependencies) so changing them mid-play doesn't restart the RAF loop.

3. **`prefers-reduced-motion`:**
   - Inside the `useEffect`, check `window.matchMedia('(prefers-reduced-motion: reduce)')`. If it matches, do not start the RAF loop.
   - Listen for changes to the media query via `matchMedia.addEventListener('change', ...)` (the preference can change at runtime via OS accessibility settings). When the preference activates mid-play, stop the RAF. When it deactivates, allow the RAF to resume (if `active` is still true).
   - The check must be inside the effect, not before hooks — conditional hook execution violates the Rules of Hooks.

4. **Timestamp reset on resume:**
   - When `active` transitions from `false` → `true`, the effect re-runs and `lastTimestamp` ref resets to `null`. This prevents a time jump (the paused duration is not counted).

### 4.3 `SceneEmbed` Component

**File:** `packages/core/src/player/SceneEmbed.tsx`

```typescript
// SceneEmbed.tsx — Self-contained embedded scene player.
// Composes SceneEngine + canvas + visibility lifecycle + progress driver
// into a single component optimized for inline page embedding.
```

**Internal structure:**

```typescript
export function SceneEmbed(props: SceneEmbedProps): ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);

  const visibility = props.visibility ?? 'autopause';
  const rootMargin = props.rootMargin ?? '200px';

  const { mounted, visible } = useVisibilityGate(containerRef, visibility, rootMargin);

  // ── Resolve container styles ────────────────────────────────────────────────
  const containerStyle: CSSProperties = {
    width: typeof props.width === 'number' ? `${props.width}px` : (props.width ?? '100%'),
    height: typeof props.height === 'number' ? `${props.height}px` : props.height,
    position: 'relative',
    overflow: 'hidden',
  };

  return (
    <div ref={containerRef} className={props.className} style={containerStyle}>
      {mounted && (
        <SceneEmbedInner
          visible={visible}
          autoPlay={props.autoPlay}
          progress={props.progress}
          onProgressChange={props.onProgressChange}
          interactive={props.interactive}
          // Forwarded engine props
          id={props.id}
          plugins={props.plugins}
          theme={props.theme}
          sceneTheme={props.sceneTheme}
          timingProfile={props.timingProfile}
          loadPolicy={props.loadPolicy}
          defaultTransitionDuration={props.defaultTransitionDuration}
          defaultTransitionEasing={props.defaultTransitionEasing}
          primaryCameraId={props.primaryCameraId}
          primaryCanvasActionTargetId={props.primaryCanvasActionTargetId}
          cameraInteractionDefaults={props.cameraInteractionDefaults}
          invalidateCacheToken={props.invalidateCacheToken}
          maxAnimBoostPerFrame={props.maxAnimBoostPerFrame}
          scrollSource={props.scrollSource}
          onReady={props.onReady}
          onError={props.onError}
          onWidgetError={props.onWidgetError}
          onCompileWarning={props.onCompileWarning}
        >
          {props.children}
        </SceneEmbedInner>
      )}
    </div>
  );
}
```

**`SceneEmbedInner`** (internal, not exported):

```typescript
interface SceneEmbedInnerProps extends ForwardedEngineProps {
  visible: boolean;
  autoPlay?: boolean | AutoPlayConfig;
  progress?: number;
  onProgressChange?: (progress: number) => void;
  interactive?: boolean;
  children: ReactNode;
}

function SceneEmbedInner(props: SceneEmbedInnerProps): ReactElement {
  return (
    <SceneEngine
      id={props.id}
      plugins={props.plugins}
      theme={props.theme}
      sceneTheme={props.sceneTheme}
      timingProfile={props.timingProfile}
      loadPolicy={props.loadPolicy}
      defaultTransitionDuration={props.defaultTransitionDuration}
      defaultTransitionEasing={props.defaultTransitionEasing}
      primaryCameraId={props.primaryCameraId}
      primaryCanvasActionTargetId={props.primaryCanvasActionTargetId}
      cameraInteractionDefaults={props.cameraInteractionDefaults}
      invalidateCacheToken={props.invalidateCacheToken}
      maxAnimBoostPerFrame={props.maxAnimBoostPerFrame}
      scrollSource={props.scrollSource}
      onReady={props.onReady}
      onError={props.onError}
      onWidgetError={props.onWidgetError}
      onCompileWarning={props.onCompileWarning}
    >
      {/* Scene declarations from consumer */}
      {props.children}

      {/* Progress driver — auto-play or controlled */}
      <EmbedProgressDriver
        autoPlay={props.autoPlay}
        progress={props.progress}
        onProgressChange={props.onProgressChange}
        visible={props.visible}
      />

      {/* Visibility-based RAF pausing */}
      <EmbedVisibilityPauser visible={props.visible} />

      {/* Optional camera interaction */}
      {props.interactive === true && <InputCoordinator />}

      {/* Infrastructure — always rendered */}
      <BackgroundLayer style={{ position: 'absolute', inset: 0, zIndex: 0 }} />
      <div style={{ position: 'absolute', inset: 0, zIndex: 1 }}>
        <SceneCanvas style={{ width: '100%', height: '100%' }} />
      </div>
      <EngineOverlayHost />
    </SceneEngine>
  );
}
```

**`EmbedProgressDriver`** (internal, same file):

Bridges the `autoPlay` / `progress` props to the engine. Exactly one mode is active at a time.

```typescript
function EmbedProgressDriver(props: {
  autoPlay?: boolean | AutoPlayConfig;
  progress?: number;
  onProgressChange?: (progress: number) => void;
  visible: boolean;
}): ReactElement | null {
  const engine = useSceneEngineContext();

  // ── Mode resolution ─────────────────────────────────────────────────────────
  // Controlled mode: progress prop takes precedence over autoPlay.
  const isControlled = props.progress !== undefined;

  // ── Controlled mode ─────────────────────────────────────────────────────────
  useLayoutEffect(() => {
    if (!isControlled) return;
    engine.setProgress(Math.max(0, Math.min(1, props.progress!)));
  }, [engine, isControlled, props.progress]);

  // ── Auto-play mode ──────────────────────────────────────────────────────────
  const autoPlayConfig = resolveAutoPlayConfig(props.autoPlay);
  const autoPlayActive = !isControlled && autoPlayConfig !== null && props.visible;

  useAutoPlay({
    duration: autoPlayConfig?.duration ?? 6,
    loop: autoPlayConfig?.loop ?? true,
    active: autoPlayActive,
  });

  return null; // Renderless component
}
```

**`EmbedVisibilityPauser`** (internal, same file):

Pauses/resumes the engine's RAF loop based on visibility.

```typescript
function EmbedVisibilityPauser(props: { visible: boolean }): null {
  const engine = useSceneEngineContext();

  useEffect(() => {
    if (props.visible) {
      engine.resume();
    } else {
      engine.pause();
    }
  }, [engine, props.visible]);

  return null;
}
```

**`resolveAutoPlayConfig`** (internal helper):

```typescript
function resolveAutoPlayConfig(
  autoPlay: boolean | AutoPlayConfig | undefined,
): AutoPlayConfig | null {
  if (autoPlay === undefined || autoPlay === false) return null;
  if (autoPlay === true) return { duration: 6, loop: true };
  return {
    duration: autoPlay.duration ?? 6,
    loop: autoPlay.loop ?? true,
  };
}
```

### 4.4 Precedence Rules

When multiple props are provided, the following precedence applies:

1. **`progress` wins over `autoPlay`**: If `progress` is defined, auto-play is disabled. Console warning if both are provided.
2. **`visibility='always'` disables pausing**: The RAF loop runs continuously regardless of viewport position.
3. **`prefers-reduced-motion` disables auto-play**: The embed renders its first frame and stays there. `progress` (controlled mode) still works.
4. **`interactive` is independent**: Camera interaction works alongside auto-play or controlled progress. Auto-play drives scene navigation; interaction drives camera orbit/dolly.

### 4.5 Prop Validation (Development Mode)

In `SceneEmbedInner`, add the following development-only warnings:

```typescript
if (process.env.NODE_ENV !== 'production') {
  if (props.progress !== undefined && props.autoPlay) {
    console.warn(
      '[BrewSite] <SceneEmbed> has both `progress` and `autoPlay` props. ' +
      '`progress` takes precedence; `autoPlay` is ignored.',
    );
  }
  if (props.onProgressChange !== undefined && props.progress === undefined) {
    console.warn(
      '[BrewSite] <SceneEmbed> has `onProgressChange` without `progress`. ' +
      'onProgressChange is only meaningful in controlled mode.',
    );
  }
}
```

---

## 5. Deletions and Migrations

Since we do not care about backward compatibility, the following are removed from the public API.

### 5.1 Files to Delete

| File | Reason |
|---|---|
| `packages/core/src/player/SceneReel.tsx` | Replaced by `SceneEmbed` |
| `packages/core/src/player/ControlledInput.tsx` | Absorbed into `EmbedProgressDriver` |
| `packages/core/src/player/TimeInput.tsx` | Absorbed into `useAutoPlay` |
| `packages/core/src/player/ControlledProgressContext.tsx` | Was only used by `ControlledInput` |
| `packages/core/src/player/__tests__/SceneReel.test.tsx` | Replaced by `SceneEmbed.test.tsx` |
| `packages/core/src/player/__tests__/ControlledInput.test.tsx` | Tests for deleted component |
| `packages/core/src/player/__tests__/TimeInput.test.tsx` | Tests for deleted component |

### 5.4 Comment References to Update

The following files contain comments that reference `SceneReel` by name. Update these comments to reference `SceneEmbed` instead:

| File | Lines | Nature of reference |
|---|---|---|
| `packages/core/src/player/InputCoordinator.tsx` | 45, 52, 64, 270 | Comments describing container ancestor discovery (e.g., "the SceneReel or ScrollStage div") |
| `packages/core/src/player/scrollSourceTypes.ts` | 30 | Comment: "Default for SceneReel / embedded contexts" |
| `packages/core/src/player/BackgroundLayer.tsx` | 2, 17 | Comments about BackgroundLayer usage context |
| `packages/core/src/player/useSceneEngine.ts` | 125, 132 | Comments referencing ControlledInput and TimeInput as callers of setProgress/advanceProgress |
| `packages/core/src/player/PluginInheritanceContext.tsx` | 1 | Comment references "SceneEngine zero-scene" with "SceneReel instances" |

### 5.2 Exports to Remove from `player/index.ts`

```diff
- export { SceneReel } from './SceneReel';
- export type { SceneReelProps } from './SceneReel';
- export { TimeInput } from './TimeInput';
- export type { TimeInputProps } from './TimeInput';
- export { ControlledInput } from './ControlledInput';
- export type { ControlledInputProps } from './ControlledInput';
+ export { SceneEmbed } from './SceneEmbed';
+ export type { SceneEmbedProps, AutoPlayConfig } from './SceneEmbed';
+ export { useVisibilityGate } from './useVisibilityGate';
+ export type { VisibilityGateResult, VisibilityMode } from './useVisibilityGate';
```

**Note:** `useAutoPlay` and `UseAutoPlayOptions` are intentionally NOT exported. The hook is tightly coupled to the engine context and has no standalone consumer use case. It remains internal to `SceneEmbed.tsx`. If consumer demand emerges, it can be exported in a future minor release.

`useVisibilityGate` IS exported because it is a pure DOM hook with zero engine dependencies — consumers building custom embed layouts (e.g., split-pane with manual EngineProvider composition) can use it for their own visibility management. Mark with `@beta` JSDoc tag.

### 5.5 Documentation Migrations

The following documentation files reference `SceneReel`, `ControlledInput`, and/or `TimeInput` and must be updated to use `SceneEmbed`:

| File | References | Action |
|---|---|---|
| `packages/claude-author/docs/guides/embedding-modes.md` | SceneReel, TimeInput, ControlledInput (code examples, descriptions) | Rewrite embedding mode examples to use SceneEmbed |
| `packages/claude-author/docs/guides/overview.md` | SceneReel | Update embedding mode description |
| `packages/claude-author/docs/guides/advanced-patterns.md` | SceneReel, ControlledInput (code examples) | Update to SceneEmbed + controlled progress |
| `packages/claude-author/docs/guides/common-gotchas.md` | SceneReel | Update layout gotcha references |
| `packages/claude-author/docs/core/input-dsl.md` | TimeInput, ControlledInput | Update input tier examples |
| `packages/claude-author/docs/guides/nvs-spatial-model.md` | SceneReel | Update height behavior references |
| `packages/claude-author/index/orama-index.json` | Indexed references to all three | Regenerate after doc updates (run the indexer) |
| `packages/core/README.md` | SceneReel, TimeInput (code examples) | Update embedding code examples to use SceneEmbed |

**Note:** `packages/core/CHANGELOG.md` and `packages/core/MIGRATION.md` contain historical references to these components. These should be left as-is (they document what changed, not the current API).

**This is critical:** The `@brewsite/claude-author` package powers the MCP server for AI-assisted scene authoring. Stale documentation will cause AI assistants to recommend deleted APIs.

### 5.3 Consumer Migrations

These files must be updated to use `SceneEmbed` instead of `SceneReel`/`ControlledInput`/`TimeInput`:

#### `apps/docs/src/demos/shared/DemoScene.tsx`

**Before:** 185 lines — SceneReel + ControlledInput + manual IntersectionObserver + manual RAF auto-play + custom DemoSceneControls.

**Decision:** DemoSceneControls is **preserved**. It is the primary interactive demo navigation surface for the docs site. Removing it would be a user-facing regression.

**After:**

```typescript
import {
  SceneEmbed,
  useEngineState,
  useEngineScrubber,
  type WidgetPlugin,
} from '@brewsite/core';
import { type JSX, type ReactNode, useMemo } from 'react';
import { createDemoWidgetSetup } from './demoSetup';

interface DemoSceneProps {
  children: ReactNode;
  sceneCount: number;
  height?: number;
  sceneDuration?: number;
  plugins?: WidgetPlugin[];
}

/**
 * DemoSceneControls — prev/next/play-pause/scrubber overlay.
 * Must be rendered inside SceneEmbed (requires engine context).
 */
function DemoSceneControls({
  sceneCount,
}: {
  sceneCount: number;
}): JSX.Element {
  const state = useEngineState();
  const { setProgress } = useEngineScrubber();

  const stepSize = 1 / Math.max(1, sceneCount);
  const currentScene = Math.min(
    sceneCount,
    Math.floor(state.progress * Math.max(1, sceneCount)) + 1,
  );

  const nextScene = (): void => {
    const next = Math.min(1, Math.round((state.progress + stepSize) / stepSize) * stepSize);
    setProgress(next);
  };

  const prevScene = (): void => {
    const next = Math.max(0, Math.round((state.progress - stepSize) / stepSize) * stepSize);
    setProgress(next);
  };

  return (
    <div className="demo-scene__controls">
      <button className="demo-btn" type="button" onClick={prevScene} disabled={state.progress <= 0}>
        ◀
      </button>
      <button className="demo-btn" type="button" onClick={nextScene} disabled={state.progress >= 0.999}>
        ▶
      </button>
      <div className="demo-progress">
        <input
          type="range"
          min={0}
          max={1}
          step={0.001}
          value={state.progress}
          onChange={(event) => setProgress(Number(event.target.value))}
          aria-label="Demo progress"
        />
      </div>
      <span className="demo-scene-label">
        {currentScene} / {Math.max(1, sceneCount)}
      </span>
    </div>
  );
}

export function DemoScene({
  children,
  sceneCount,
  height = 420,
  sceneDuration = 2500,
  plugins,
}: DemoSceneProps): JSX.Element {
  const totalDuration = Math.max(1, sceneCount) * (sceneDuration / 1000);
  const resolvedPlugins = useMemo(
    () => plugins ?? createDemoWidgetSetup(),
    [plugins],
  );

  return (
    <div className="demo-scene" style={{ height, overflow: 'hidden' }}>
      <SceneEmbed
        height={height}
        plugins={resolvedPlugins}
        autoPlay={{ duration: totalDuration, loop: true }}
        visibility="autopause"
      >
        {children}
        <DemoSceneControls sceneCount={sceneCount} />
      </SceneEmbed>
    </div>
  );
}
```

**Migration notes:**
- The manual IntersectionObserver + RAF auto-play + ControlledInput + prefersReducedMotion check are all replaced by SceneEmbed's built-in `autoPlay` + `visibility="autopause"` + useAutoPlay's reduced-motion handling.
- DemoSceneControls no longer needs `autoPlay`/`setAutoPlay`/`progress`/`onProgressChange` props — it reads state directly via `useEngineState()` and writes via `useEngineScrubber().setProgress()`.
- The play/pause toggle button is removed since auto-play is now managed by SceneEmbed's visibility lifecycle (pauses off-screen, resumes on-screen). If explicit play/pause is needed later, it can be reimplemented using `useEngineScrubber()`.
- The outer `<div className="demo-scene">` wrapper preserves the existing CSS class for styling.

#### `apps/docs/src/components/demo/InlineDemo.tsx`

**Before:** SceneReel + ControlledInput + module-level plugins + performance preset + decorative wrapper div.

**After:**

```typescript
const INLINE_DEMO_PLUGINS = [corePlugin()];

export function InlineDemo({
  children,
  height = 360,
  controlledProgress,
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
      <SceneEmbed
        height={height}
        plugins={INLINE_DEMO_PLUGINS}
        timingProfile={{ qualityPreset: 'performance' }}
        progress={controlledProgress}
        visibility="autopause"
      >
        {children}
      </SceneEmbed>
    </div>
  );
}
```

**Note:** The outer wrapper div preserves the decorative styling (border-radius, border, margin, background) from the original InlineDemo. SceneEmbed does not accept a `style` prop — `className` is the styling API. Decorative styling should be applied via a wrapper div or CSS class.

#### `apps/docs/src/components/ScenePanel.tsx`

**Before:** Manual IntersectionObserver lazy mount + SceneEngine + TimeInput + SceneCanvas.

**After:**

```typescript
export function ScenePanel({
  id,
  height,
  duration,
  plugins,
  children,
}: ScenePanelProps): JSX.Element {
  return (
    <SceneEmbed
      id={id}
      height={height ?? '480px'}
      plugins={plugins}
      timingProfile={{ qualityPreset: 'balanced' }}
      autoPlay={{ duration: duration ?? 3, loop: true }}
      visibility="lazy"
      onError={(err) => console.error(`[ScenePanel id="${id}"]`, err)}
    >
      {children}
    </SceneEmbed>
  );
}
```

#### `apps/examples/src/canvas-region/CanvasRegionPage.tsx`

**Before:** SceneReel + InputCoordinator per panel.

**After:**

```typescript
<SceneEmbed
  height={'100%'}
  plugins={plugins}
  theme={theme}
  timingProfile={{ fpsCap }}
  defaultTransitionDuration={500}
  interactive
>
  <def.Scene />
  <StatsOverlay />
</SceneEmbed>
```

**Migration notes:**
- `<InputCoordinator />` is replaced by `interactive` prop on SceneEmbed.
- `<def.Scene />` and `<StatsOverlay />` are passed as children.
- `defaultTransitionDuration` is forwarded via `ForwardedEngineProps` (included in the `Pick<SceneEngineProps, ...>` type in §2.1).

---

## 6. Dependency Direction Verification

| Importer | Imports from | Status |
|---|---|---|
| `SceneEmbed.tsx` | `SceneEngine`, `SceneCanvas`, `BackgroundLayer`, `EngineOverlayHost`, `InputCoordinator` (all from `player/`), `useVisibilityGate`, `useAutoPlay` | ✅ All within `player/` |
| `useVisibilityGate.ts` | `react` only | ✅ No engine/runtime imports |
| `useAutoPlay.ts` | `react`, `useSceneEngineContext` from `EngineContext` | ✅ Within `player/` |
| None of the new files | Three.js, `@brewsite/diagram`, `compiler/`, `runtime/` | ✅ No forbidden imports |

---

## 7. Implementation Sequence

Execute in this order. Each step must pass `pnpm --filter @brewsite/core typecheck` before proceeding.

### Step 1: Create `useVisibilityGate`

**File:** `packages/core/src/player/useVisibilityGate.ts`

Create the hook as specified in §4.1. This hook has zero dependencies on other new code and can be implemented and tested in isolation.

**Implementation notes:**
- The hook must handle the case where `IntersectionObserver` is not available (SSR, jsdom). In that case, default to `mounted: true, visible: true` (fully permissive fallback).
- The `document.visibilitychange` listener must be added only for modes other than `'always'`.
- For `'lazy'` mode, the unmount state change (`mounted: false`) should be _debounced_ by 500ms to prevent rapid mount/unmount cycling when the user scrolls back and forth across the boundary. Use `setTimeout` in the observer callback, cleared if the element re-enters before the timeout fires.

**Test file:** `packages/core/src/player/__tests__/useVisibilityGate.test.ts`

Tests (all use `vi.useFakeTimers()` and mock IntersectionObserver):

1. `'always'` mode: mounted=true, visible=true immediately. No observer created.
2. `'autopause'` mode: mounted=true always. visible=true initially (optimistic), becomes false when observer fires !isIntersecting.
3. `'autopause'` mode + document hidden: visible=false even when intersecting.
4. `'autopause'` mode + document unhidden: visible recovers to intersection state.
5. `'lazy'` mode: mounted=false initially. mounted=true when observer fires isIntersecting. visible tracks same.
6. `'lazy'` mode unmount: mounted reverts to false when observer fires !isIntersecting (after debounce).
7. `'lazy'` mode unmount debounce: if re-intersecting within 500ms, mounted stays true.
8. Cleanup: observers disconnected and event listeners removed on unmount.
9. SSR fallback: when IntersectionObserver is undefined, returns mounted=true, visible=true.

### Step 2: Create `useAutoPlay`

**File:** `packages/core/src/player/useAutoPlay.ts`

Create the hook as specified in §4.2.

**Implementation notes:**
- The RAF loop must be fully managed by a single `useEffect` with `[active, engine]` as dependencies.
- `duration` and `loop` must be captured in refs so mid-play changes don't restart the loop.
- The `prefers-reduced-motion` check must be reactive (listen for media query changes via `matchMedia.addEventListener('change', ...)`). When it activates mid-play, the RAF loop should stop. When it deactivates, it should resume.
- When `active` becomes false, the effect cleanup cancels the RAF. When `active` becomes true again, the effect re-runs and `lastTimestamp` ref is already null (reset in cleanup), preventing a time jump.

**Test file:** `packages/core/src/player/__tests__/useAutoPlay.test.ts`

Tests (mock `requestAnimationFrame`, `engine.setProgress`, `engine.frameState`):

1. When `active=false`, no RAF is scheduled.
2. When `active=true`, RAF is scheduled and `engine.setProgress` is called with increasing values.
3. Progress wraps to 0 when `loop=true` and progress reaches 1.
4. Progress clamps at 1 when `loop=false`.
5. Duration prop is respected: after `duration` seconds of wall time, progress reaches ~1.
6. Changing `active` from true→false cancels the RAF.
7. Changing `active` from false→true resets timestamp (no time jump).
8. `prefers-reduced-motion` = true: no RAF scheduled regardless of `active`.

### Step 3: Create `SceneEmbed`

**File:** `packages/core/src/player/SceneEmbed.tsx`

Create the full component as specified in §4.3.

**Implementation notes:**
- `SceneEmbedInner` must be a named function component (not inline JSX or arrow function assigned to a variable) so React DevTools shows a meaningful name.
- `EmbedProgressDriver`, `EmbedVisibilityPauser`, and `resolveAutoPlayConfig` are private functions in the same file (not exported).
- The development-mode prop validation (§4.5) must be guarded by `process.env.NODE_ENV !== 'production'` so it is tree-shaken in production builds.
- The `EngineOverlayHost` must be rendered with `passthroughPointerEvents` when `interactive` is false, so overlay content doesn't block non-interactive embeds from being scrolled past.

All engine config props are forwarded via `ForwardedEngineProps` (the `Pick<SceneEngineProps, ...>` type defined in §2.1). The implementing code should spread all forwarded props to `<SceneEngine>` — see the `SceneEmbedInner` code above for the full list.

**Test file:** `packages/core/src/player/__tests__/SceneEmbed.test.tsx`

Tests (jsdom environment, mock SceneEngine/SceneCanvas/BackgroundLayer):

1. Container div has correct width, height, position, overflow styles.
2. `visibility='always'`: engine subtree is immediately mounted.
3. `visibility='lazy'`: engine subtree is not mounted until visibility gate fires.
4. `autoPlay=true`: `EmbedProgressDriver` resolves to auto-play mode with duration=6, loop=true.
5. `autoPlay={{ duration: 10, loop: false }}`: config forwarded correctly.
6. `progress={0.5}`: controlled mode active, auto-play suppressed.
7. Both `progress` and `autoPlay` provided: console.warn in dev mode.
8. `interactive={true}`: InputCoordinator is rendered as a child.
9. `interactive` omitted: no InputCoordinator rendered.
10. Engine config props forwarded to SceneEngine correctly (all 16 ForwardedEngineProps).
11. Children are rendered inside SceneEngine context (before infrastructure components).
12. `EmbedVisibilityPauser`: `engine.pause()` called when `visible` becomes `false`; `engine.resume()` called when `visible` becomes `true`.
13. `EmbedProgressDriver`: when both `progress` and `autoPlay` are provided, `requestAnimationFrame` is NOT called (controlled mode suppresses auto-play).

### Step 4: Update `player/index.ts`

Remove old exports, add new exports as specified in §5.2.

### Step 5: Migrate Consumers

Update all files listed in §5.3 and §5.5. Each migration is a straightforward prop-mapping from the old API to the new API. Migrate consumers BEFORE deleting old files to avoid a broken intermediate state.

**Important:** Steps 5 and 6 must be completed in the same typecheck pass. Do not run `pnpm typecheck` between them.

### Step 6: Delete Old Files

Delete the files listed in §5.1:
- `packages/core/src/player/SceneReel.tsx`
- `packages/core/src/player/ControlledInput.tsx`
- `packages/core/src/player/TimeInput.tsx`
- `packages/core/src/player/ControlledProgressContext.tsx`
- `packages/core/src/player/__tests__/SceneReel.test.tsx`
- `packages/core/src/player/__tests__/ControlledInput.test.tsx`
- `packages/core/src/player/__tests__/TimeInput.test.tsx`

### Step 7: Verify

```bash
pnpm typecheck           # all packages must pass
pnpm test                # all packages must pass
pnpm build               # full build must succeed
```

---

## 8. Testing Strategy

### Unit Tests (interface-based, no mocks of internals)

| Module | Strategy |
|---|---|
| `useVisibilityGate` | Mock `IntersectionObserver` globally. Create a test harness that renders the hook with `renderHook`. Simulate observer callbacks. Assert `mounted`/`visible` state transitions per mode. |
| `useAutoPlay` | Mock `requestAnimationFrame` via `vi.useFakeTimers()`. Mock `engine` as a minimal object with `setProgress` (vi.fn) and `frameState: { progress: 0 }`. Advance timers. Assert `setProgress` call sequence. |
| `SceneEmbed` | Mock `SceneEngine`, `SceneCanvas`, `BackgroundLayer`, `EngineOverlayHost` as stub components (these involve WebGL which jsdom cannot support). Assert React tree structure, prop forwarding, and conditional rendering. |
| `EmbedVisibilityPauser` | Test that `engine.pause()` is called when `visible` changes to `false` and `engine.resume()` is called when `visible` changes to `true`. Can be tested as part of SceneEmbed tests or as a standalone renderless-component test. |
| `EmbedProgressDriver` | Test that when both `progress` and `autoPlay` are provided, the auto-play RAF is NOT scheduled (controlled mode suppresses auto-play). Verify `engine.setProgress` is called with the `progress` value in controlled mode. |

### Integration Tests (manual, not automated)

After implementation, verify in the dev app (`pnpm dev`):
1. Auto-play embed advances through scenes and loops.
2. Scrolling the embed off-screen pauses the animation (visible via browser FPS overlay).
3. Scrolling back resumes from where it left off (no time jump).
4. Switching browser tabs pauses (check `performance.now()` delta on resume).
5. `visibility="lazy"` embed does not create a WebGL context until scrolled near.
6. Page with 10+ `visibility="lazy"` embeds does not exceed WebGL context limit.
7. `interactive` embed allows orbit/dolly/pan.
8. `progress={0.5}` pins embed to mid-scene.
9. `prefers-reduced-motion` disables auto-play (test via Chrome DevTools emulation).

---

## 9. Edge Cases and Error Handling

| Scenario | Behavior |
|---|---|
| `height` not provided | TypeScript compiler error (required prop). |
| `plugins` not provided, no parent engine | SceneEngine logs `console.error` (existing behavior). |
| 0 `<Scene>` children | Engine mounts in zero-scene mode. Canvas shows background color. No error. |
| `autoPlay` with 0 scenes | Auto-play RAF runs but progress has no visual effect. No error. |
| `progress` > 1 or < 0 | Clamped to [0, 1] in `EmbedProgressDriver`. |
| `duration` ≤ 0 | Clamped to minimum 0.001 in `useAutoPlay` to prevent division by zero. |
| WebGL context lost | Engine's existing `webglcontextlost` handler pauses RuntimeLoop. On restore, `webglcontextrestored` resumes. No special handling needed in SceneEmbed. |
| `visibility="lazy"` + SSR | `useVisibilityGate` returns `mounted: true, visible: true` when IntersectionObserver is unavailable (SSR). Engine mounts immediately. Hydration then takes over. |
| Rapid mount/unmount (`lazy` mode) | 500ms debounce on `mounted: false` prevents thrashing. |
| `visibility="lazy"` + `progress` (controlled) | Engine won't mount until the element is visible. When it mounts, the `EmbedProgressDriver` will write the current `progress` value on its first `useLayoutEffect` — the engine picks up the correct frame. No special handling needed. |
| Auto-play resume after off-screen | When the embed re-enters the viewport, auto-play resumes **from where it left off** (current progress). There is no automatic reset to progress 0. This is an intentional behavior change from `TimeInput` (which defaulted `resetOnExit: true`). Resuming from current progress prevents jarring resets when users scroll back to an embed. |
| Nested SceneEmbed inside parent SceneEngine | SceneEmbed creates its own SceneEngine. If `plugins` is omitted, it inherits from the parent via `PluginInheritanceContext`. This works correctly. |

---

## 10. Non-Goals (Explicit Exclusions)

1. **Built-in progress bar / scrubber UI.** SceneEmbed is a headless embed container. Scrubber UI is the consumer's responsibility, buildable with `useEngineState()` + `useEngineScrubber()` inside the children.
2. **Aspect-ratio locking.** Use `EngineARContainer` as an outer wrapper if needed. May be added as a convenience prop in a follow-up.
3. **Poster/placeholder image.** The container div background is the placeholder. Custom placeholders can be achieved by rendering an `EngineGate` as a child.
4. **Server-side rendering of 3D content.** Three.js requires WebGL. SSR renders the container div only.
5. **Wiring the `ProgressManager autoAdvance` dead code.** That is a separate feature (the compiled `rawRate`/`maxRaw` values in SceneTrack have no runtime executor). Unrelated to this plan.
6. **ViewportScaleContext / AR container height override.** `SceneReel` read `ViewportScaleContext` to allow `EngineARContainer` to override the resolved height. No active consumers use this interaction. SceneEmbed does not support it. Consumers wanting AR behavior should wrap `SceneEmbed` with `EngineARContainer` as an outer element.
7. **Partial progress range (`max`).** `TimeInput` supported a `max` prop to limit auto-play to a sub-range (e.g., play only 0→0.5). This is omitted from SceneEmbed's `AutoPlayConfig`. The interaction with multi-scene embeds is confusing ("does max: 0.5 mean half the duration or stop at scene 2 of 4?"). Consumers needing sub-range playback should use controlled mode (`progress` prop) with their own timer logic.
