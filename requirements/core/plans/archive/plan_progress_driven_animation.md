---
title: "Progress-Driven Animation — Auto-Advance, Animation Time Scale, and Synchronized Clock"
doc_type: plan
owner: brewsite-architect
status: complete
updated: 2026-03-01
---

# Progress-Driven Animation — Auto-Advance, Animation Time Scale, and Synchronized Clock

## Table of Contents

1. [Background and Motivation](#1-background-and-motivation)
2. [Architecture Decisions on Open Questions](#2-architecture-decisions-on-open-questions)
3. [Data Model — New and Updated Types](#3-data-model--new-and-updated-types)
4. [Feature A: Auto-Advance](#4-feature-a-auto-advance)
5. [Feature B: Animation Time Scale](#5-feature-b-animation-time-scale)
6. [Feature C: Synchronized Real-Time Clock](#6-feature-c-synchronized-real-time-clock)
7. [ProgressManager DSL Changes](#7-progressmanager-dsl-changes)
8. [buildProgressProfile Changes](#8-buildprogressprofile-changes)
9. [RuntimeLoop Changes](#9-runtimeloop-changes)
10. [RuntimeDriverImpl Changes](#10-runtimedriverimpl-changes)
11. [useEngineScroll Changes](#11-useenginescroll-changes)
12. [useEngineInput Changes](#12-useengineinput-changes)
13. [useSceneEngine — Auto-Advance State Machine](#13-usesceneengine--auto-advance-state-machine)
14. [Widget Authoring Contract and Migration Guide](#14-widget-authoring-contract-and-migration-guide)
15. [Hero Screen Migration](#15-hero-screen-migration)
16. [Coordination with plan_core_modularization.md](#16-coordination-with-plan_core_modularizationmd)
17. [Testing Strategy](#17-testing-strategy)
18. [Files Affected](#18-files-affected)
19. [Implementation Sequence](#19-implementation-sequence)

---

## 1. Background and Motivation

### The Two-Loop Problem

`RuntimeLoop` drives every RAF frame with two independent values:

```
deltaSeconds    = wall clock elapsed        → feeds AnimationMixer.update()
globalProgress  = scroll position [0..1]   → feeds SceneTrack sampler
```

These values are passed to `driver.tick()` independently and have no influence on each other. A widget either responds to time (continuous, always running) or to progress (frozen when the user is not scrolling). There is no mechanism for:

- Progress advancing automatically while the user is idle (auto-advance)
- Animation speed accelerating in response to scroll velocity
- A formal, synchronized clock available to all widgets under a clear contract

### Concrete Manifestation: The Hero Screen

The hero scene's overlay text (`scene_00_hero.tsx` / `hero.css`) uses CSS `@keyframes` with fixed `animation-delay: 3.6s, 3.9s, 4.2s`. These timers start on page mount and are completely decoupled from BrewSite's `globalProgress`:

- User scrolls before 3.6s: overlay is invisible; the animation has not fired
- User scrolls after 4.2s: overlay is already at full opacity; no entrance visible
- User sits idle: overlay plays nicely, then the user must scroll to advance

The root cause is mixing two animation systems in the same scene. The CSS `@keyframes` approach is wrong here — the overlay should be authored as BrewSite overlay content driven by `blockProgress`, so that both time (via auto-advance) and scroll drive the same reveal.

### The Unifying Formula

```
effectiveDeltaSeconds = max(deltaSeconds, min(deltaProgress × animationTimeScale, MAX_ANIM_BOOST_PER_FRAME))
```

- **Idle** (`deltaProgress = 0`): `effectiveDelta = deltaSeconds` — animation at 1×, real-time
- **Scrolling** (`deltaProgress > 0`): `effectiveDelta` is boosted proportionally — animation accelerates with scroll speed
- **Auto-advancing** (`deltaProgress` is small, from `deltaSeconds × rawRate`): boost is negligible — animation plays at approximately real-time

All three features run inside the existing single `RuntimeLoop` at 60fps. No second RAF loop. No new timers.

---

## 2. Architecture Decisions on Open Questions

### Q1 — Auto-Advance in ScrollCaptureSection Mode

**Decision:** Introduce `scrollToRawProgress(raw: number)` on `UseEngineScrollResult` and thread it through `UseEngineInputResult`. Auto-advance uses a unified internal `advanceToRawProgress(raw: number)` function in `useSceneEngine.ts` that routes by `inputSource`:

- In scroll mode (`inputSource === 'scroll'`): calls `scrollToRawProgress(raw)` which computes the target `window.scrollY` position from the raw value and calls `window.scrollTo` — bypassing the mapper entirely
- In push mode (`inputSource === 'push'`): calls `setRawProgress(raw)` directly

This replaces the PM's suggestion of calling `scrollToProgress()` from auto-advance, which would have done a wasteful raw→engine→raw round-trip through the mapper. Auto-advance works directly in raw input space.

**Scroll detection for `pauseOnScroll`:** An `isProgrammaticScrollRef` flag (set to `true` before `window.scrollTo` is called, cleared via `queueMicrotask` after) prevents auto-advance-triggered scroll events from updating `lastUserScrollTimeRef`. The `useEngineScroll` hook accepts an optional `onUserScroll?: () => void` callback (in its options object) that fires only when the scroll event was NOT triggered programmatically. `useSceneEngine` passes this callback to update `lastUserScrollTimeRef`.

### Q2 — `deltaProgress` Sign on Backward Navigation

**Decision:** Resolved. Use `Math.max(0, globalProgress - prevGlobalProgress)` in `RuntimeLoop`. `effectiveDeltaSeconds` only boosts on forward progress. Backward navigation always uses `deltaSeconds` (1× real-time). This is the correct and intentional behavior — backward scroll should not accelerate animations.

### Q3 — Tick Order Safety

**Decision:** Resolved. The tick order change (sampling before animation controllers) is safe. Audit of all `IAnimationController` implementations confirms that `CameraWidget.onTick` reads from `context.tick` (the sampled tick) for scene state, not from a stale previous tick. `ModelWidget` does not implement `IAnimationController` — it is `IRenderable` only. `DiagramCanvasWidget` is in `@brewsite/diagram` and uses the sampled tick for canvas state. No known widget relies on animation controllers running before sampling. This is a behavioral change but requires only a minor version bump.

### Q4 — Multiple EngineProvider Instances

**Decision:** Resolved. `autoAdvancePausedRef` is a `useRef` inside `useSceneEngine`. Instance-scoped by construction — each `EngineProvider` subtree creates its own `useSceneEngine` instance with its own refs. There is no global auto-advance state.

### Q5 — Compile Warning for `autoAdvance` on Last Scene

**Decision:** Yes. Emit `PROGRESS_MANAGER` warning using the identical pattern to the existing last-scene `scrollUnits` warning. Message must be actionable and include the scene id.

### Q6 — `maxBoostPerFrame` Configurability

**Decision:** Hardcoded constant `MAX_ANIM_BOOST_PER_FRAME = 0.2` (seconds) in `RuntimeDriverImpl`. This equals 12× real-time per frame at 60fps — a reasonable cap that prevents programmatic jumps from producing multi-second animation artifacts. Not exposed as a DSL prop in this plan.

### Additional Architect Decision: `autoAdvance` Field Validation

Add to `buildProgressProfile` alongside the existing `scrollUnits` and `fn` validations:
- `duration <= 0` → emit `PROGRESS_MANAGER` warning, auto-advance spec is stored but will never fire because `rawRate` would be non-positive
- `max <= 0 || max > 1` → emit `PROGRESS_MANAGER` warning
- `autoAdvance` on last scene → emit `PROGRESS_MANAGER` warning (same as `scrollUnits` on last scene)

### Additional Architect Decision: `isUniform` Check Update

The `isUniform` short-circuit path in `buildProgressProfile` must be `false` when ANY scene has `autoAdvance` or `animationTimeScale`. These features require the `progressProfile` to be present on `SceneTrack` — the profile is what `useSceneEngine.onAfterTick` reads to discover auto-advance parameters and what `RuntimeDriverImpl.tick` reads for `animationTimeScale`.

---

## 3. Data Model — New and Updated Types

### 3.1 New: `AutoAdvanceSpec`

Add to `packages/core/src/compiler/sceneTrackTypes.ts`:

```typescript
/**
 * Per-scene auto-advance configuration. When set, wall-clock time advances
 * rawProgress automatically while the user is idle.
 *
 * Carry-forward semantics: same as ProgressManagerSpec — the last declared
 * spec carries forward to scenes that omit <ProgressManager>. Declare
 * autoAdvance={undefined} to explicitly clear auto-advance.
 */
export type AutoAdvanceSpec = {
  /**
   * Seconds to traverse the scene window from rawStart to rawStart + (max × segmentWidth)
   * while the user is idle. Must be > 0.
   * This is the primary authoring knob: "play this scene in N seconds while idle."
   */
  duration: number;
  /**
   * Fraction of the scene's raw input window where auto-advance stops.
   * Must be in (0, 1]. Default: 1.0 (play through the full window).
   * Set to 0.80 to auto-advance through the first 80%, requiring the user to
   * scroll for the final 20%.
   */
  max: number;
  /**
   * When true, auto-advance pauses while the user is scrolling and resumes
   * after 200ms of scroll inactivity. Default: true.
   */
  pauseOnScroll: boolean;
};
```

### 3.2 Updated: `ProgressManagerSpec`

```typescript
export type ProgressManagerSpec = {
  /**
   * Proportional scroll budget for this scene's outgoing transition.
   * Unitless — normalized across all scenes.
   * Must be > 0. Default: 1.
   */
  scrollUnits: number;

  /**
   * Pure curve function mapping raw local input progress [0..1] to
   * local engine progress [0..1] within this scene's window.
   * Default: t => t (identity / linear).
   */
  fn: (localT: number) => number;

  /**
   * Auto-advance config. Undefined = no auto-advance for this scene's window.
   * Carry-forward: if a previous scene declared autoAdvance and this scene
   * omits <ProgressManager>, the spec (including autoAdvance) carries forward.
   * Use autoAdvance={undefined} to explicitly clear.
   */
  autoAdvance?: AutoAdvanceSpec;

  /**
   * Total animation-seconds that play when the user scrolls through this scene's
   * full raw input window in one smooth pass. Undefined = no boost (1× real-time always).
   * Recommended range: 2–12. Values > 20 may produce jarring jumps; the
   * MAX_ANIM_BOOST_PER_FRAME cap (0.2s) mitigates programmatic navigation jumps.
   *
   * Formula: effectiveDelta = max(deltaSeconds, min(deltaProgress × animationTimeScale, 0.2))
   */
  animationTimeScale?: number;
};
```

### 3.3 Updated: `SceneProgressSegment`

```typescript
export type SceneProgressSegment = {
  /** Source scene index (0-based). */
  sceneIndex: number;
  /** Start of this segment in normalized raw input space [0..1]. */
  rawStart: number;
  /** End of this segment in normalized raw input space [0..1]. */
  rawEnd: number;
  /** Start of this segment in normalized engine progress space [0..1]. */
  engineStart: number;
  /** End of this segment in normalized engine progress space [0..1]. */
  engineEnd: number;
  /**
   * Input pacing curve for this segment.
   * Input: localT in [0..1] (normalized position within rawStart..rawEnd).
   * Output: local engine progress in [0..1] (normalized within engineStart..engineEnd).
   */
  fn: (localT: number) => number;

  /**
   * Pre-computed auto-advance values. Only present when the source scene
   * declared autoAdvance. Pre-computing avoids division in the RAF hot path.
   *
   * rawRate  = (spec.max × segmentWidth) / spec.duration
   * maxRaw   = rawStart + spec.max × segmentWidth
   * segmentWidth = rawEnd - rawStart
   */
  autoAdvance?: {
    /** Pre-computed advance rate in raw-progress per second. */
    rawRate: number;
    /** Pre-computed ceiling: auto-advance stops when getRawProgress() >= maxRaw. */
    maxRaw: number;
    pauseOnScroll: boolean;
  };

  /**
   * Animation time scale factor for this scene.
   * Passed to RuntimeDriverImpl.tick() to boost effectiveDeltaSeconds
   * proportionally to deltaProgress.
   * Undefined = no boost (always 1× real-time).
   */
  animationTimeScale?: number;
};
```

### 3.4 New: `RealtimeClock`

Add to `packages/core/src/runtime/types.ts`:

```typescript
/**
 * Synchronized real-time clock. Identical values reach every widget every frame.
 * wallTimeSeconds is derived from performance.now() once per frame at the top of
 * RuntimeLoop.runStep() — it never drifts or backlogs after tab hide/show.
 *
 * NEVER use a private `this.localTime += deltaSeconds` accumulator inside a widget.
 * It drifts between widgets (different start times) and backlogs when a hidden tab
 * becomes visible. Use clock.wallTimeSeconds for phase-coherent oscillations.
 */
export type RealtimeClock = {
  /**
   * Absolute seconds since page load (performance.now() / 1000).
   * Use for: ambient oscillations, procedural animations, phase offsets.
   * Example: Math.sin(clock.wallTimeSeconds * Math.PI * 2 * 0.5) → 0.5 Hz oscillation
   */
  wallTimeSeconds: number;
  /**
   * Real-time elapsed since last frame (~0.0167s at 60fps).
   * Unaffected by scroll, effectiveDeltaSeconds, or animationTimeScale.
   * Use for: physics integration, particle simulation, smooth increment-based effects.
   */
  deltaSeconds: number;
};
```

### 3.5 Updated: `AnimationTickContext`

In `packages/core/src/widget/types.ts`, replace the existing `AnimationTickContext` type:

```typescript
export type AnimationTickContext = {
  /**
   * Synchronized real-time clock. Same values every widget sees every frame.
   * Use clock.wallTimeSeconds for ambient oscillations.
   * Use clock.deltaSeconds for physics / real-time increment-based effects.
   */
  clock: RealtimeClock;
  /**
   * Scroll-velocity-boosted delta for AnimationMixer.update().
   * Equals clock.deltaSeconds when idle. Increases proportionally to scroll speed
   * when animationTimeScale is declared on the scene.
   *
   * Rule: pass this to AnimationMixer.update(). Use clock.deltaSeconds for physics.
   */
  effectiveDeltaSeconds: number;
  scene: ThreeScene;
  variables: VariableStore;
  tick: SceneTrackTick | null;
  track: SceneTrack | null;
  // REMOVED: deltaSeconds — use clock.deltaSeconds or effectiveDeltaSeconds
  // REMOVED: wallTimeSeconds — use clock.wallTimeSeconds
};
```

### 3.6 Updated: `WidgetRenderContext`

In `packages/core/src/widget/types.ts`, replace the existing `WidgetRenderContext` type:

```typescript
export type WidgetRenderContext = {
  /**
   * Synchronized real-time clock. Same values every widget sees every frame.
   * Use clock.wallTimeSeconds for ambient oscillations.
   * Use clock.deltaSeconds for physics / real-time increment-based effects.
   */
  clock: RealtimeClock;
  /**
   * Scroll-velocity-boosted delta. Use for effects that should accelerate with scroll.
   * Rule: pass this to AnimationMixer.update(). Use clock.deltaSeconds for physics.
   */
  effectiveDeltaSeconds: number;
  globalProgress: number;
  variables: VariableStoreReader;
  extra: unknown;
  tick?: SceneTrackTick | null;
  // REMOVED: deltaSeconds — use clock.deltaSeconds or effectiveDeltaSeconds
  // REMOVED: wallTimeSeconds — use clock.wallTimeSeconds
};
```

### 3.7 Updated: `RuntimeDriver.tick()` Signature

In `packages/core/src/runtime/types.ts`, update the `tick` method on the `RuntimeDriver` interface:

```typescript
/** Advance the runtime by one frame. */
tick(options: {
  deltaSeconds: number;
  globalProgress: number;
  /**
   * Non-negative forward progress delta this frame.
   * Computed by RuntimeLoop as Math.max(0, currentGlobalProgress - prevGlobalProgress).
   * Zero on the first frame, zero on backward navigation.
   * Used by RuntimeDriverImpl to compute effectiveDeltaSeconds via animationTimeScale.
   */
  deltaProgress: number;
  wallTimeSeconds?: number;
}): void;
```

### 3.8 `UseSceneEngineResult` Addition

Add to the `UseSceneEngineResult` type in `packages/core/src/player/useSceneEngine.ts`:

```typescript
/**
 * Pause or resume auto-advance for all scenes in this engine instance.
 * Instance-scoped — does not affect other EngineProvider instances on the same page.
 *
 * Use case: pause when a modal, tooltip, or overlay is open.
 * @example
 * useEffect(() => {
 *   engine.setAutoAdvancePaused(isModalOpen);
 * }, [isModalOpen]);
 */
setAutoAdvancePaused(paused: boolean): void;
```

### 3.9 `UseEngineScrollResult` Additions

Add to `UseEngineScrollResult` in `packages/core/src/player/useEngineScroll.ts`:

```typescript
/**
 * Returns the pre-mapper raw scroll progress [0..1].
 * Unlike getGlobalProgress() which returns the post-mapper (engine) progress,
 * this returns the raw scroll fraction before the SceneProgressMapper is applied.
 * Used by auto-advance to read and write in the correct space.
 */
getRawProgress(): number;

/**
 * Advances window.scrollY to the position corresponding to the given raw progress value.
 * Bypasses the mapper entirely — raw input space, not engine progress space.
 * Used by auto-advance to avoid the raw→engine→raw round-trip through the mapper.
 *
 * Marks the scroll as programmatic so onUserScroll is NOT fired for this event.
 */
scrollToRawProgress(raw: number): void;
```

New option added to `UseEngineScrollOptions`:

```typescript
/**
 * Called when a genuine user scroll event fires (NOT when auto-advance calls
 * window.scrollTo). Used by useSceneEngine to update lastUserScrollTimeRef
 * for the pauseOnScroll debounce.
 */
onUserScroll?: () => void;
```

### 3.10 `UseEngineInputResult` Additions

Add to `UseEngineInputResult` in `packages/core/src/player/useEngineInput.ts`:

```typescript
getRawProgress(): number;
scrollToRawProgress(raw: number): void;
```

New option added to `UseEngineInputOptions`:

```typescript
/**
 * Called when a genuine user scroll event fires (NOT programmatic scroll from auto-advance).
 * Threaded directly to useEngineScroll's onUserScroll option.
 */
onUserScroll?: () => void;
```

---

## 4. Feature A: Auto-Advance

### 4.1 What It Does

When the user is idle and a scene declares `autoAdvance`, wall-clock time automatically advances `rawProgress` at a configurable rate, up to an optional ceiling. When the user scrolls, user input takes over seamlessly. When the user stops scrolling, auto-advance resumes from wherever progress stopped.

In scroll mode, `window.scrollY` physically advances — the user can see the scroll bar moving, providing a natural "auto-play" cue. In push mode (`ScrollCaptureSection`), `rawProgressPushRef` is updated directly.

### 4.2 DSL Authoring

```tsx
<Scene id="website-hero-00">
  <ProgressManager
    scrollUnits={1800}
    autoAdvance={{
      duration: 8,           // seconds to advance from 0 to max while idle (required)
      max: 0.80,             // stop auto-advancing at 80% of this scene's window (default: 1.0)
      pauseOnScroll: true,   // pause when user scrolls; resume after 200ms idle (default: true)
    }}
    animationTimeScale={3}
  />
  {/* ... */}
</Scene>
```

`duration` is the primary authoring knob. `"play this scene in N seconds while idle"` is more intuitive than a raw rate because the author thinks in wall-clock seconds.

Internal conversion: `rawRate = (max × segmentWidth) / duration`, where `segmentWidth = segment.rawEnd - segment.rawStart`. This is pre-computed at compile time in `buildProgressProfile` so the RAF hot path does no division.

Carry-forward semantics: `autoAdvance` is part of `ProgressManagerSpec` and carries forward like `scrollUnits` and `fn`. A scene with no `<ProgressManager>` inherits the previous scene's full spec, including `autoAdvance`. Declare `<ProgressManager autoAdvance={undefined} />` to explicitly clear.

### 4.3 Imperative API

```typescript
// Available via useEngineContext() or returned directly by useSceneEngine():
engine.setAutoAdvancePaused(true);   // freeze auto-advance immediately
engine.setAutoAdvancePaused(false);  // resume from where it stopped
```

### 4.4 Implementation Location

Auto-advance state lives in `useSceneEngine`. The integration point is the `onAfterTick` callback that `useSceneEngine` provides to `RuntimeLoop`. After each frame:

1. Read current scene's `autoAdvance` spec from `sceneTrack.progressProfile.segments[currentTick.sceneIndex].autoAdvance`
2. Check: is `autoAdvancePausedRef.current` true? If so, bail.
3. Check `pauseOnScroll`: is `Date.now() - lastUserScrollTimeRef.current < 200`? If so, bail.
4. Check ceiling: is `getRawProgress() >= autoAdvance.maxRaw`? If so, bail.
5. Compute `deltaRaw = deltaSeconds × autoAdvance.rawRate`
6. Call `advanceToRawProgress(clamp(currentRaw + deltaRaw, 0, autoAdvance.maxRaw))`

`advanceToRawProgress` routes to `scrollToRawProgress` (scroll mode) or `setRawProgress` (push mode) based on `inputSource`.

---

## 5. Feature B: Animation Time Scale

### 5.1 What It Does

When the user scrolls, GLTF animation mixers run faster in proportion to how fast progress is moving. When idle, mixers run at 1× real-time. The formula ensures animation never pauses:

```typescript
const animationTimeScale = segment?.animationTimeScale ?? 0;
const rawBoost = deltaProgress * animationTimeScale;
const cappedBoost = Math.min(rawBoost, MAX_ANIM_BOOST_PER_FRAME);  // 0.2s hard cap
const effectiveDeltaSeconds = Math.max(deltaSeconds, cappedBoost);
```

### 5.2 Tick Order Change

**Current (wrong for this feature):**
1. Tick animation controllers (`IAnimationController.onTick`) — uses `deltaSeconds` from last frame
2. Sample SceneTrack — determines current scene
3. Apply renderable widgets

**New (correct):**
1. Sample SceneTrack — O(1) lookup, determines current scene and its `animationTimeScale`
2. Compute `effectiveDeltaSeconds` from `deltaProgress × animationTimeScale`
3. Tick animation controllers — uses `effectiveDeltaSeconds`
4. Apply renderable widgets

Sampling is O(1) via `sceneTrackSampler`. Moving it first is also architecturally correct — animation controllers and renderables should both operate on the current scene's declared state, not the previous frame's stale sample.

### 5.3 `deltaProgress` in the Tick Contract

`RuntimeLoop` tracks `prevGlobalProgress` between frames and computes:

```typescript
const deltaProgress = Math.max(0, globalProgress - this.prevGlobalProgress);
this.prevGlobalProgress = globalProgress;
```

This is passed to `driver.tick()` as a new required field. Backward navigation produces `deltaProgress = 0` (no boost). The first frame produces `deltaProgress = 0` (no previous progress to diff against).

---

## 6. Feature C: Synchronized Real-Time Clock

### 6.1 The Problem

Multiple widgets want time-driven ambient animations (NeonSign pulse, procedural shaders). Today they receive `wallTimeSeconds` as a flat field on their context. Widget authors may reach for `this.localTime += deltaSeconds` instead, which:

- Drifts between widgets (different start times)
- Breaks on tab hide/show (`deltaSeconds` backlogs when a hidden tab becomes visible)
- Does not express the "real-time, unaffected by scroll" contract clearly

### 6.2 The Fix: `clock: RealtimeClock` in All Tick Contexts

`clock.wallTimeSeconds` is computed from `performance.now() / 1000` once per frame at the top of `RuntimeLoop.runStep()`. All widgets see the same value every frame. An oscillation at `Math.sin(clock.wallTimeSeconds × 2π × 0.5)` resumes at exactly the right phase after a hidden tab becomes visible, because it uses absolute time — not an accumulated delta.

### 6.3 NeonSign Specifically

The NeonSign computes `Math.sin(wallTimeSeconds * 1.7) * 0.06` in `render.ts` via `NeonSignRenderer.update(state, wallTimeSeconds)`. After this change, `NeonSignWidget.apply` passes `context.clock.wallTimeSeconds` instead of `context.wallTimeSeconds`. Behavior is identical — the NeonSign's pulse remains real-time, synchronized with the single RAF clock, and completely unaffected by `effectiveDeltaSeconds` or auto-advance.

---

## 7. ProgressManager DSL Changes

**File: `packages/core/src/compiler/primitives/progressManager.ts`**

### 7.1 Updated `ProgressManagerProps` Interface

```typescript
export interface ProgressManagerProps {
  /**
   * Proportional scroll budget for this scene's outgoing transition.
   * Unitless — proportional across all scenes. Must be > 0. Default: 1.
   */
  scrollUnits?: number;

  /**
   * Pure input pacing curve. Maps local raw input progress [0..1] to
   * local engine progress [0..1] within this scene's window.
   * Constraints (compile-time validated): fn(0) === 0, fn(1) === 1, monotonically non-decreasing.
   * Default: t => t
   */
  fn?: (localT: number) => number;

  /**
   * Auto-advance configuration. When set, wall-clock time advances this scene's
   * outgoing transition progress automatically while the user is idle.
   *
   * Carry-forward semantics: auto-advance is part of the full ProgressManagerSpec
   * and carries forward to scenes that omit <ProgressManager>. Declare
   * autoAdvance={undefined} to explicitly clear auto-advance.
   *
   * @example
   * // Auto-advances through 80% of the scene window in 8 seconds while idle
   * autoAdvance={{ duration: 8, max: 0.80, pauseOnScroll: true }}
   */
  autoAdvance?: {
    /** Seconds to traverse the scene window from 0 to max while idle. Required. Must be > 0. */
    duration: number;
    /** Fraction of scene window to auto-advance through. Default: 1.0. Must be in (0, 1]. */
    max?: number;
    /** Pause while user scrolls; resume after 200ms idle. Default: true. */
    pauseOnScroll?: boolean;
  };

  /**
   * Animation time scale factor. Total animation-seconds that play when the user
   * scrolls through this scene's full raw input window in one smooth pass.
   * Animations run at 1× real-time when idle regardless of this value.
   * Undefined = no boost (always 1× real-time). Recommended range: 2–12.
   */
  animationTimeScale?: number;
}
```

### 7.2 Updated Handler

The handler must be updated to store `autoAdvance` and `animationTimeScale` on `api.state.progressManager`. The complete handler replaces the current one:

```typescript
const progressManagerHandler: NodeHandler = (node, api) => {
  const props = node.props as ProgressManagerProps;
  const scrollUnits = props.scrollUnits !== undefined
    ? Math.max(0.001, props.scrollUnits)
    : 1;
  // Use canonical IDENTITY_FN reference — enables reference-equality check in isUniform
  const fn = props.fn ?? IDENTITY_FN;

  const spec: ProgressManagerSpec = { scrollUnits, fn };

  if (props.autoAdvance !== undefined) {
    spec.autoAdvance = {
      duration: props.autoAdvance.duration,
      max: props.autoAdvance.max ?? 1.0,
      pauseOnScroll: props.autoAdvance.pauseOnScroll ?? true,
    };
  }

  if (props.animationTimeScale !== undefined) {
    spec.animationTimeScale = props.animationTimeScale;
  }

  api.state.progressManager = spec;
};
```

The `ProgressManager` React component signature is unchanged (still returns `null`). Its JSDoc must be updated to describe the new props.

---

## 8. buildProgressProfile Changes

**File: `packages/core/src/compiler/sceneTrackCompiler.ts`**

Three changes to `buildProgressProfile`:

### 8.1 Updated `isUniform` Check

The fast-path short-circuit must account for `autoAdvance` and `animationTimeScale`. A profile with either field is NOT uniform — the `SceneProgressProfile` must be present on `SceneTrack` for the player and driver layers to access auto-advance and animationTimeScale at runtime.

Replace the current `isUniform` check:

```typescript
// Current (incomplete — misses autoAdvance and animationTimeScale):
const isUniform = resolved.every(
  (spec) => spec.scrollUnits === firstUnit && spec.fn === IDENTITY_FN,
);

// New (correct):
const firstUnit = resolved[0]?.scrollUnits ?? 1;
const isUniform = resolved.every(
  (spec) =>
    spec.scrollUnits === firstUnit &&
    spec.fn === IDENTITY_FN &&
    spec.autoAdvance === undefined &&
    spec.animationTimeScale === undefined,
);
```

### 8.2 New `autoAdvance` Validation

Add to the per-scene validation block, immediately after `validateProgressFn` is called. This runs only when `declared !== undefined` (same guard as the existing fn validation):

```typescript
// Validate autoAdvance fields
if (declared.autoAdvance !== undefined) {
  if (declared.autoAdvance.duration <= 0) {
    emitWarning({
      code: 'PROGRESS_MANAGER',
      message:
        `ProgressManager autoAdvance.duration on scene "${sceneId}" must be > 0 ` +
        `(got ${declared.autoAdvance.duration}). Auto-advance will not fire for this scene. ` +
        `Use a positive value such as duration: 8.`,
      sceneIndex: i,
    });
  }
  const max = declared.autoAdvance.max ?? 1.0;
  if (max <= 0 || max > 1) {
    emitWarning({
      code: 'PROGRESS_MANAGER',
      message:
        `ProgressManager autoAdvance.max on scene "${sceneId}" must be in (0, 1] ` +
        `(got ${max}). Use 0.8 to auto-advance through 80% of the scene window.`,
      sceneIndex: i,
    });
  }
  if (i === n - 1) {
    emitWarning({
      code: 'PROGRESS_MANAGER',
      message:
        `ProgressManager autoAdvance declared on the last scene ("${sceneId}") has no effect. ` +
        `The last scene has no outgoing transition window. ` +
        `Remove autoAdvance from this scene, or declare it on the second-to-last scene.`,
      sceneIndex: i,
    });
  }
}
```

Note: the existing last-scene warning for `scrollUnits` fires for any `ProgressManager` declaration on the last scene. The new `autoAdvance` last-scene warning is separate and only fires when `autoAdvance` is specifically declared. Both may fire simultaneously if `scrollUnits` is also declared.

### 8.3 Pre-Computed AutoAdvance Fields in Segment Building Loop

Replace the current segment-building loop:

```typescript
// Build segments (N-1 segments for N scenes, one per outgoing transition)
const totalUnits = resolved
  .slice(0, n - 1)
  .reduce((sum, spec) => sum + spec.scrollUnits, 0);

const segments: SceneProgressSegment[] = [];
let rawCursor = 0;

for (let i = 0; i < n - 1; i++) {
  const spec = resolved[i]!;
  const normalizedWeight = spec.scrollUnits / totalUnits;
  const rawStart = rawCursor;
  const rawEnd = rawCursor + normalizedWeight;
  rawCursor = rawEnd;
  const segWidth = rawEnd - rawStart;

  const seg: SceneProgressSegment = {
    sceneIndex: i,
    rawStart,
    rawEnd,
    engineStart: i / (n - 1),
    engineEnd: (i + 1) / (n - 1),
    fn: spec.fn,
  };

  if (spec.autoAdvance !== undefined) {
    const max = spec.autoAdvance.max;
    seg.autoAdvance = {
      rawRate: (max * segWidth) / spec.autoAdvance.duration,
      maxRaw: rawStart + max * segWidth,
      pauseOnScroll: spec.autoAdvance.pauseOnScroll,
    };
  }

  if (spec.animationTimeScale !== undefined) {
    seg.animationTimeScale = spec.animationTimeScale;
  }

  segments.push(seg);
}
```

The `DEFAULT_PM_SPEC` constant remains unchanged. No changes are needed outside `buildProgressProfile`.

---

## 9. RuntimeLoop Changes

**File: `packages/core/src/runtime/RuntimeLoop.ts`**

### 9.1 Type Changes

Update `RuntimeLoopOptions.onAfterTick` callback signature:

```typescript
// Old:
onAfterTick?: (frame: RuntimeFrame) => void;

// New:
onAfterTick?: (options: { deltaSeconds: number; globalProgress: number }) => void;
```

`RuntimeFrame` is still used internally for the `step`/`stepImmediate` public methods. The `onAfterTick` callback only needs `deltaSeconds` and `globalProgress` — the auto-advance state machine in `useSceneEngine` reads `deltaSeconds` and `globalProgress` from this callback. It does not need `nowMs` or `wallTimeSeconds` (those are read from the driver directly).

### 9.2 New Private Field

```typescript
private prevGlobalProgress: number = 0;
```

### 9.3 Updated `runStep`

In `runStep()`, before calling `driver.tick()`:

```typescript
const globalProgress = this.getGlobalProgress();

// Compute forward-only delta progress. Zero on first frame (no prevGlobalProgress yet).
// Zero on backward navigation (Math.max(0, ...)).
const deltaProgress = Math.max(0, globalProgress - this.prevGlobalProgress);
this.prevGlobalProgress = globalProgress;

// ... existing perf tracking setup ...

this.driver.tick({
  deltaSeconds,
  globalProgress,
  deltaProgress,       // NEW field
  wallTimeSeconds: this.wallTimeSeconds,
});

// ... then onAfterTick:
if (this.onAfterTick) {
  this.onAfterTick({ deltaSeconds, globalProgress });  // NEW signature
}
```

The `prevGlobalProgress` update MUST happen before `driver.tick()` is called so that if `tick()` throws (caught by the error guard), `prevGlobalProgress` is still updated correctly for the next frame.

### 9.4 No Change to Existing Tests

The existing `RuntimeLoop` tests use the old `onAfterTick` signature (`frame.wallTimeSeconds`). These tests must be updated in Step 12 (testing). See Section 17.2 for the concrete test cases to add.

---

## 10. RuntimeDriverImpl Changes

**File: `packages/core/src/runtime/RuntimeDriver.ts`**

### 10.1 New Constant

Add at module scope, before the class definition:

```typescript
/**
 * Maximum animation-seconds that can be added per frame from animationTimeScale.
 * Caps the boost so that programmatic navigation jumps (e.g., NavMenu "Scene 5" from "Scene 1")
 * do not produce multi-second animation jumps in a single frame.
 * 0.2s = 12× real-time at 60fps.
 */
const MAX_ANIM_BOOST_PER_FRAME = 0.2;
```

### 10.2 Import Addition

Add `RealtimeClock` import from `./types`:

```typescript
import type { RuntimeDriver as IRuntimeDriver, RealtimeClock } from './types';
```

### 10.3 Updated `tick()` Method

The complete new `tick()` method body. This replaces the existing method entirely:

```typescript
tick(options: {
  deltaSeconds: number;
  globalProgress: number;
  deltaProgress: number;
  wallTimeSeconds?: number;
}): void {
  const { deltaSeconds, globalProgress, deltaProgress, wallTimeSeconds = 0 } = options;
  this.wallTimeSeconds = wallTimeSeconds;

  if (!this.threeScene || !this.sampler) return;

  // ── Step 1: Sample SceneTrack ────────────────────────────────────────────
  // O(1) lookup. Must run before animation controllers so they receive
  // effectiveDeltaSeconds computed from the current scene's animationTimeScale.
  const tick = this.sampler.sample(globalProgress);
  this.currentTick = tick;

  // ── Step 2: Compute effectiveDeltaSeconds ────────────────────────────────
  // animationTimeScale is stored on the segment for the outgoing transition
  // from the current scene. Zero when not declared (no boost).
  const animationTimeScale =
    this.track?.progressProfile?.segments[tick.sceneIndex]?.animationTimeScale ?? 0;
  const rawBoost = deltaProgress * animationTimeScale;
  const cappedBoost = Math.min(rawBoost, MAX_ANIM_BOOST_PER_FRAME);
  // effectiveDeltaSeconds is always >= deltaSeconds: the floor ensures animation
  // never drops below real-time even with animationTimeScale declared.
  const effectiveDeltaSeconds = Math.max(deltaSeconds, cappedBoost);

  // ── Step 3: Build synchronized clock ────────────────────────────────────
  // wallTimeSeconds is from performance.now() / 1000, computed once per frame
  // in RuntimeLoop.runStep(). All widgets receive the same value this frame.
  const clock: RealtimeClock = { wallTimeSeconds, deltaSeconds };

  // ── Step 4: Tick animation controllers (was Step 1 before this change) ──
  const animCtx: AnimationTickContext = {
    clock,
    effectiveDeltaSeconds,
    scene: this.threeScene,
    variables: this.variableStore,
    tick,
    track: this.track,
  };
  for (const controller of this.animationControllers) {
    if (this.erroredWidgets.has(controller.widgetId)) continue;
    try {
      controller.onTick(animCtx);
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      this.erroredWidgets.add(controller.widgetId);
      this.onWidgetError?.(controller.widgetId, err);
    }
  }

  // ── Step 5: Apply renderable widgets ────────────────────────────────────
  const renderCtx: WidgetRenderContext = {
    clock,
    effectiveDeltaSeconds,
    globalProgress,
    variables: this.variableStore,
    extra: undefined as unknown,
    tick,
  };
  for (const renderable of this.renderables) {
    if (this.erroredWidgets.has(renderable.widgetId)) continue;
    try {
      const functionalBlock = this.track?.transitionBlocks?.[tick.sceneIndex];
      const functionalWidget = functionalBlock?.widgetFns[renderable.widgetId];
      let state: unknown;
      if (functionalWidget) {
        const easingName = this.track?.transitionEasings?.[tick.sceneIndex];
        const bp = easingName
          ? getEasingFn(easingName)(tick.blockProgress)
          : tick.blockProgress;
        state = functionalWidget.fn(bp);
      } else {
        state =
          tick.state.widgets[renderable.widgetId] ??
          this.defaultStateById.get(renderable.widgetId);
      }
      const extra = tick.widgetExtras?.[renderable.widgetId];
      renderable.apply(state as never, { ...renderCtx, extra });
    } catch (e) {
      this.erroredWidgets.add(renderable.widgetId);
      const err = e instanceof Error ? e : new Error(String(e));
      this.onWidgetError?.(renderable.widgetId, err);
    }
  }
}
```

The `import type { AnimationTickContext, WidgetRenderContext }` lines at the top of `RuntimeDriver.ts` are already present via the existing widget type imports. Add `RealtimeClock` to the import from `./types`.

---

## 11. useEngineScroll Changes

**File: `packages/core/src/player/useEngineScroll.ts`**

### 11.1 Updated Options Type

```typescript
export type UseEngineScrollOptions = {
  scrollRegionRef: RefObject<HTMLElement | null>;
  scrollRegionHeightPx: number;
  progressMapper?: SceneProgressMapper | null;
  /**
   * Called when a genuine user scroll event fires (NOT when auto-advance calls
   * window.scrollTo). Used by useSceneEngine to update lastUserScrollTimeRef
   * for the pauseOnScroll debounce.
   */
  onUserScroll?: () => void;
};
```

### 11.2 Updated Result Type

```typescript
export type UseEngineScrollResult = {
  progress: number;
  scrollToProgress: (next: number) => void;
  getGlobalProgress: () => number;
  /** Pre-mapper raw scroll progress [0..1]. Used by auto-advance. */
  getRawProgress(): number;
  /**
   * Advances window.scrollY to the position corresponding to the given raw progress value.
   * Bypasses the mapper. Marks the scroll as programmatic so onUserScroll is not called.
   */
  scrollToRawProgress(raw: number): void;
};
```

### 11.3 Implementation Changes

The hook needs two new refs and revised internals. The complete updated hook:

```typescript
export const useEngineScroll = (options: UseEngineScrollOptions): UseEngineScrollResult => {
  const { scrollRegionRef, scrollRegionHeightPx, progressMapper } = options;
  const [progress, setProgress] = useState(0);
  const progressRef = useRef(0);       // stores post-mapper (engine) progress
  const rawProgressRef = useRef(0);    // stores pre-mapper raw scroll progress — NEW
  const isProgrammaticScrollRef = useRef(false);  // true while window.scrollTo is in-flight — NEW

  // Compute both raw and mapped progress from current scroll position
  const computeProgress = useCallback((): { raw: number; mapped: number } => {
    if (typeof window === 'undefined') return { raw: 0, mapped: 0 };
    const el = scrollRegionRef.current;
    if (!el) return { raw: 0, mapped: 0 };
    const rect = el.getBoundingClientRect();
    const scrollTop = window.scrollY || window.pageYOffset || 0;
    const regionTop = scrollTop + rect.top;
    const viewportHeight = window.innerHeight || 1;
    const maxScroll = Math.max(1, scrollRegionHeightPx - viewportHeight);
    const raw = clamp01((scrollTop - regionTop) / maxScroll);
    const mapped = progressMapper ? progressMapper.remap(raw) : raw;
    return { raw, mapped };
  }, [scrollRegionHeightPx, scrollRegionRef, progressMapper]);

  const update = useCallback(() => {
    const { raw, mapped } = computeProgress();
    if (Math.abs(mapped - progressRef.current) < 1e-5) return;
    rawProgressRef.current = raw;
    progressRef.current = mapped;
    setProgress(mapped);
  }, [computeProgress]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    update();
    const onScroll = () => {
      // Only fire onUserScroll when the scroll is genuine (not from auto-advance).
      if (!isProgrammaticScrollRef.current) {
        options.onUserScroll?.();
      }
      update();
    };
    const onResize = () => update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
    };
  // options.onUserScroll is intentionally excluded from deps — it is a callback ref pattern.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [update]);

  const scrollToProgress = useCallback(
    (next: number) => {
      if (typeof window === 'undefined') return;
      const el = scrollRegionRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const scrollTop = window.scrollY || window.pageYOffset || 0;
      const regionTop = scrollTop + rect.top;
      const viewportHeight = window.innerHeight || 1;
      const maxScroll = Math.max(1, scrollRegionHeightPx - viewportHeight);
      const rawTarget = progressMapper
        ? progressMapper.inverse(clamp01(next))
        : clamp01(next);
      window.scrollTo({ top: regionTop + rawTarget * maxScroll });
    },
    [scrollRegionHeightPx, scrollRegionRef, progressMapper],
  );

  // NEW: scroll to a raw (pre-mapper) progress position.
  // Used by auto-advance to bypass the mapper entirely.
  const scrollToRawProgress = useCallback(
    (raw: number) => {
      if (typeof window === 'undefined') return;
      const el = scrollRegionRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const scrollTop = window.scrollY || window.pageYOffset || 0;
      const regionTop = scrollTop + rect.top;
      const viewportHeight = window.innerHeight || 1;
      const maxScroll = Math.max(1, scrollRegionHeightPx - viewportHeight);
      const clamped = Math.max(0, Math.min(1, raw));
      // Mark as programmatic BEFORE window.scrollTo so the scroll event
      // handler sees the flag when it fires.
      isProgrammaticScrollRef.current = true;
      window.scrollTo({ top: regionTop + clamped * maxScroll });
      // Clear the flag after the current microtask queue drains (after scroll event).
      queueMicrotask(() => {
        isProgrammaticScrollRef.current = false;
      });
    },
    [scrollRegionHeightPx, scrollRegionRef],
  );

  const getGlobalProgress = useCallback(() => progressRef.current, []);
  const getRawProgress = useCallback(() => rawProgressRef.current, []);  // NEW

  return { progress, scrollToProgress, getGlobalProgress, getRawProgress, scrollToRawProgress };
};
```

Note: `options.onUserScroll` is treated as a callback ref (always reads current value from `options`) rather than a dependency to avoid rebuilding the scroll listener on every render when the callback changes. This matches the pattern used by `onControlledProgressChangeRef` in `useEngineInput`.

---

## 12. useEngineInput Changes

**File: `packages/core/src/player/useEngineInput.ts`**

### 12.1 Updated Options Type

Add `onUserScroll` to `UseEngineInputOptions`:

```typescript
/**
 * Called when a genuine user scroll event fires (NOT when auto-advance calls
 * window.scrollTo). Threaded to useEngineScroll's onUserScroll option.
 */
onUserScroll?: () => void;
```

### 12.2 Updated Result Type

```typescript
export type UseEngineInputResult = {
  progress: number;
  scrollToProgress: (next: number) => void;
  getGlobalProgress: () => number;
  /** Pre-mapper raw progress [0..1]. Used by auto-advance. */
  getRawProgress(): number;
  /**
   * Advances to the given raw progress value, bypassing the mapper.
   * In scroll mode: calls window.scrollTo. In direct mode: sets directProgressRef.
   */
  scrollToRawProgress(raw: number): void;
};
```

### 12.3 Implementation Changes

1. Thread `onUserScroll` to `useEngineScroll`:

```typescript
const scrollResult = useEngineScroll({
  scrollRegionRef,
  scrollRegionHeightPx,
  progressMapper,
  onUserScroll: options.onUserScroll,  // NEW
});
```

2. Extract the new methods from `scrollResult`:

```typescript
const scrollToRawProgressStable = scrollResult.scrollToRawProgress;
const getRawProgressFromScroll = scrollResult.getRawProgress;
```

3. In the controlled-progress return path (no change — controlled mode has no raw scroll concept):

```typescript
if (options.controlledProgress !== undefined) {
  return {
    progress: options.controlledProgress,
    scrollToProgress: scrollToControlledProgress,
    getGlobalProgress: getControlledProgress,
    getRawProgress: getControlledProgress,         // controlled mode: raw = mapped (no mapper)
    scrollToRawProgress: scrollToControlledProgress,  // controlled mode: raw = mapped
  };
}
```

4. In the `hasSceneController` (direct mode) return path:

```typescript
if (hasSceneController) {
  const mappedDirectProgress = progressMapper
    ? progressMapper.remap(directProgress)
    : directProgress;

  const scrollToDirectMapped = (target: number) => {
    const raw = progressMapper ? progressMapper.inverse(clamp01(target)) : clamp01(target);
    setDirectProgressBoth(raw);
  };

  const getDirectMapped = () => {
    const raw = directProgressRef.current;
    return progressMapper ? progressMapper.remap(raw) : raw;
  };

  // NEW: raw scroll in direct mode is the directProgressRef value (pre-mapper)
  const getDirectRaw = () => directProgressRef.current;
  const scrollToDirectRaw = (raw: number) => {
    setDirectProgressBoth(raw);  // setDirectProgressBoth already clamps to [0,1]
  };

  return {
    progress: mappedDirectProgress,
    scrollToProgress: scrollToDirectMapped,
    getGlobalProgress: getDirectMapped,
    getRawProgress: getDirectRaw,          // NEW
    scrollToRawProgress: scrollToDirectRaw,  // NEW
  };
}

// Scroll mode: delegate entirely to scrollResult
return scrollResult;
```

---

## 13. useSceneEngine — Auto-Advance State Machine

**File: `packages/core/src/player/useSceneEngine.ts`**

### 13.1 New Refs

Add inside `useSceneEngine`, near the existing `rawProgressPushRef` and `inputSource` state:

```typescript
// ─── Auto-advance state ───────────────────────────────────────────────────────
const autoAdvancePausedRef = useRef(false);
const lastUserScrollTimeRef = useRef(0);
```

### 13.2 `setAutoAdvancePaused`

```typescript
const setAutoAdvancePaused = useCallback((paused: boolean) => {
  autoAdvancePausedRef.current = paused;
}, []);
```

### 13.3 Updated `useEngineInput` Call

Pass `onUserScroll` to update `lastUserScrollTimeRef`:

```typescript
const handleUserScroll = useCallback(() => {
  lastUserScrollTimeRef.current = Date.now();
}, []);

const {
  progress: inputProgress,
  scrollToProgress: inputScrollToProgress,
  getGlobalProgress: inputGetGlobalProgress,
  getRawProgress,          // NEW
  scrollToRawProgress,     // NEW
} = useEngineInput({
  scrollRegionRef,
  scrollRegionHeightPx,
  sceneCount: options.scenes.length,
  canvasRef: canvasElementRef,
  inputMap: options.inputMap,
  wheelGuard,
  inputControllerSpec,
  controlledProgress: options.controlledProgress,
  onControlledProgressChange: options.onControlledProgressChange,
  progressMapper,
  onUserScroll: handleUserScroll,    // NEW
  onCameraOrbit: handleCameraOrbit,
  onCameraDolly: handleCameraDolly,
  onCameraReset: handleCameraReset,
  onDiagramCanvasMove: handleDiagramCanvasMove,
  onDiagramCanvasRotate: handleDiagramCanvasRotate,
  onDiagramCanvasReset: handleDiagramCanvasReset,
  onDiagramCanvasFocus: handleDiagramCanvasFocus,
});
```

### 13.4 `advanceToRawProgress` — Unified Raw Progress Setter

```typescript
/**
 * Advances rawProgress to the given value via the correct mechanism for the
 * current input source. Called exclusively by the auto-advance state machine.
 *
 * Does NOT go through the mapper — raw input space only.
 * Correctly handles both scroll mode (window.scrollTo) and push mode (setRawProgress).
 */
const advanceToRawProgress = useCallback(
  (raw: number) => {
    if (inputSource === 'push') {
      // Push mode: ScrollCaptureSection owns the scroll. Update rawProgressPushRef directly.
      setRawProgress(raw);
    } else {
      // Scroll mode: advance window.scrollY to match the raw progress position.
      // scrollToRawProgress marks the scroll as programmatic so onUserScroll is not fired.
      scrollToRawProgress(raw);
    }
  },
  [inputSource, setRawProgress, scrollToRawProgress],
);
```

### 13.5 Updated RuntimeLoop Construction in `useEffect`

The `onAfterTick` callback signature changes. The loop construction block (inside the `useEffect` that depends on `[sceneTrack, getGlobalProgress, ...]`) must be updated:

```typescript
const loop = new RuntimeLoop({
  driver,
  getGlobalProgress,
  render: () => {
    renderer.render(scene, camera);
    const tick = driver.getCurrentTick();
    if (options.labelPositioner && tick) {
      // NOTE: driver.collectRenderContributions() is the API from plan_core_modularization.md
      // Phase 2. Both plans must land in the same release — see Section 16.
      const contributions = driver.collectRenderContributions();
      options.labelPositioner.update(
        tick.labelPrimitives ?? [],
        camera,
        contributions.namedPositions ?? new Map(),
        contributions.targetColors,
      );
    }
  },
  onAfterTick: ({ deltaSeconds }) => {     // NEW signature — receives { deltaSeconds, globalProgress }
    frameDriver.handleTick(driver.getCurrentTick());

    // ── Auto-advance state machine ──────────────────────────────────────────
    // Bail if manually paused
    if (autoAdvancePausedRef.current) return;

    // Bail if no progress profile (no ProgressManager declared with autoAdvance)
    const profile = sceneTrack?.progressProfile;
    if (!profile) return;

    // Bail if we don't have a current tick yet
    const currentTick = driver.getCurrentTick();
    if (!currentTick) return;

    // Look up this scene's auto-advance spec (pre-computed at compile time)
    const segment = profile.segments[currentTick.sceneIndex];
    if (!segment?.autoAdvance) return;

    const { autoAdvance } = segment;

    // Respect pauseOnScroll: 200ms idle debounce
    if (autoAdvance.pauseOnScroll) {
      const timeSinceScroll = Date.now() - lastUserScrollTimeRef.current;
      if (timeSinceScroll < 200) return;
    }

    // Don't advance past the ceiling
    const currentRaw = getRawProgress();
    if (currentRaw >= autoAdvance.maxRaw) return;

    // Compute the advance for this frame
    const deltaRaw = deltaSeconds * autoAdvance.rawRate;
    const newRaw = Math.min(currentRaw + deltaRaw, autoAdvance.maxRaw);

    // Only advance if there's a meaningful change (prevents float noise)
    if (newRaw > currentRaw + 1e-7) {
      advanceToRawProgress(newRaw);
    }
  },
  fpsCap: options.fpsCap,
});
```

Note: `sceneTrack`, `autoAdvancePausedRef`, `lastUserScrollTimeRef`, `getRawProgress`, and `advanceToRawProgress` are all captured via closure. `sceneTrack` is captured from the outer scope where it is React state. When `sceneTrack` changes, the `useEffect` re-runs and creates a new `RuntimeLoop` with an updated closure.

### 13.6 Updated Return Value

Add `setAutoAdvancePaused` to the returned object and the `UseSceneEngineResult` type:

```typescript
// Add to UseSceneEngineResult type:
setAutoAdvancePaused: (paused: boolean) => void;

// Add to the return object:
return {
  // ... existing fields ...
  setAutoAdvancePaused,  // NEW
};
```

---

## 14. Widget Authoring Contract and Migration Guide

### 14.1 Migration Table

Every widget that currently reads `context.deltaSeconds` or `context.wallTimeSeconds` must update to the new field locations:

| Animation type | Before (removed) | After (correct) |
|---|---|---|
| GLTF AnimationMixer | `context.deltaSeconds` | `context.effectiveDeltaSeconds` |
| Ambient oscillation | `context.wallTimeSeconds` | `context.clock.wallTimeSeconds` |
| Physics / increment | `context.deltaSeconds` | `context.clock.deltaSeconds` |
| Real-time widget clock | `context.wallTimeSeconds` | `context.clock.wallTimeSeconds` |
| Camera controls update | `context.deltaSeconds` | `context.effectiveDeltaSeconds` |

### 14.2 Specific Files Requiring Widget Updates

**`packages/core/src/elements/camera/CameraWidget.ts`**

Line 248 currently: `this.driver.update(context.deltaSeconds);`

Must become: `this.driver.update(context.effectiveDeltaSeconds);`

The camera's `camera-controls` update benefits from `effectiveDeltaSeconds` because fast scrolling should also advance the camera's damping/inertia proportionally. This prevents the camera lagging behind during fast scroll sequences.

**`apps/website/src/widgets/neon-sign/NeonSignWidget.ts`**

Line 71 currently: `this.renderer?.update(state, context.wallTimeSeconds);`

Must become: `this.renderer?.update(state, context.clock.wallTimeSeconds);`

The `NeonSignRenderer.update(state, wallTimeSeconds)` method signature is unchanged — the renderer itself already receives `wallTimeSeconds` as a parameter and uses it for the pulse oscillation. Only the widget's `apply` method changes how it obtains the value.

**`packages/core/src/elements/camera/__tests__/CameraWidget.test.ts`**

The `makeTickCtx` helper at line 83 currently constructs `AnimationTickContext` with flat `deltaSeconds` and `wallTimeSeconds` fields. It must be updated to use the new shape:

```typescript
// Old:
const makeTickCtx = (tick, scene): AnimationTickContext => ({
  deltaSeconds: 0.016,
  wallTimeSeconds: 0,
  scene,
  variables: new VariableStore(),
  tick,
  track: null,
});

// New:
const makeTickCtx = (tick: SceneTrackTick, scene: ThreeScene): AnimationTickContext => ({
  clock: { wallTimeSeconds: 0, deltaSeconds: 0.016 },
  effectiveDeltaSeconds: 0.016,
  scene,
  variables: new VariableStore(),
  tick,
  track: null,
});
```

**`packages/core/src/runtime/mocks/widgetMocks.ts`**

The `createMockAnimationController` double stores and exposes `lastCtx: AnimationTickContext | null`. After the type change, the `AnimationTickContext` shape changes — no code change needed in the mock itself (it just stores the context), but any test that reads `lastCtx.deltaSeconds` or `lastCtx.wallTimeSeconds` must update to `lastCtx.clock.deltaSeconds` and `lastCtx.clock.wallTimeSeconds`.

The `createMockRenderable` double stores `WidgetRenderContext` indirectly (via `_ctx` in `apply`). If any test reads context values from the captured context, update those reads.

**`packages/diagram/src/elements/diagram/canvas/DiagramCanvasWidget.ts`** (if it uses `context.deltaSeconds` or `context.wallTimeSeconds` in `onTick`)

Run `grep -r "context\.deltaSeconds\|context\.wallTimeSeconds" packages/diagram/src/` to identify all sites. Update each to `context.effectiveDeltaSeconds` (for animation-related uses) or `context.clock.deltaSeconds` / `context.clock.wallTimeSeconds`.

### 14.3 Why `effectiveDeltaSeconds` for Camera Controls

The `camera-controls` library uses its `update(deltaSeconds)` parameter for smooth damping and inertia. When the user scrolls through scenes quickly, the camera should also respond quickly — passing `effectiveDeltaSeconds` achieves natural coupling between scroll speed and camera response speed. When idle (auto-advance), `effectiveDeltaSeconds = deltaSeconds`, so camera behavior is identical to current.

---

## 15. Hero Screen Migration

This migration is a prerequisite for auto-advance to work correctly on the hero scene. Without it, the overlay timing is divorced from `blockProgress` and auto-advance has no visible effect on the overlay content.

### 15.1 Scene File Changes

**File: `apps/website/src/scenes/act0/scene_00_hero.tsx`**

Add `<ProgressManager>` import from `@brewsite/core`:

```tsx
import { Scene, Camera, Lighting, Ambient, Directional, Floor, FloorMirror, ProgressManager } from '@brewsite/core';
```

Add `<ProgressManager>` inside `<Scene id="website-hero-00">`:

```tsx
<ProgressManager
  scrollUnits={1800}
  autoAdvance={{ duration: 8, max: 0.80, pauseOnScroll: true }}
  animationTimeScale={3}
/>
```

The `HeroSection` component currently renders the tagline, package badges, and scroll indicator via CSS `@keyframes`. After migration, these elements should use BrewSite's HUD animation system or be driven by `blockProgress` through the overlay mechanism.

**Concrete approach for the hero overlay content:**

The `HeroSection` component (`apps/website/src/landing/hero/HeroSection.tsx`) renders `.hero-content--below-sign` (tagline + badges) and the `ScrollIndicator`. These must accept a `blockProgress` prop or read it from context and use it to trigger entrance animations instead of CSS delays.

The `<Fade>` / `<SlideUp>` presets from `@brewsite/core/hud/animejs` respond to `sceneProgress` but do not currently accept `startAt`/`endAt` props — those are not part of their API. Since `scene_00_hero.tsx` is an app-level scene (not toolkit code), the correct approach is to read `blockProgress` directly from `useSceneProgress()` and drive inline opacity, which requires no toolkit changes.

**Concrete implementation:**

```tsx
// In apps/website/src/scenes/act0/scene_00_hero.tsx:
import { useSceneProgress } from '@brewsite/core';

// Inside the scene overlay content:
function HeroFade({
  children,
  start,   // blockProgress at which fade begins
  end,     // blockProgress at which fade completes
}: {
  children: React.ReactNode;
  start: number;
  end: number;
}) {
  const p = useSceneProgress();
  const opacity = Math.max(0, Math.min(1, (p - start) / (end - start)));
  return <div style={{ opacity }}>{children}</div>;
}

// Usage in the scene overlay:
<HeroFade start={0.35} end={0.55}>
  <div className="hero-content--below-sign">
    <h2 className="hero-tagline">Author in JSX, ship to any surface</h2>
    <div className="hero-packages">
      <span className="hero-package-badge">@brewsite/core</span>
      <span className="hero-package-badge">@brewsite/diagram</span>
    </div>
  </div>
</HeroFade>
<HeroFade start={0.50} end={0.65}>
  <ScrollIndicator />
</HeroFade>
```

`start: 0.35` means the fade begins when `blockProgress` reaches 0.35. With `autoAdvance: { duration: 8, max: 0.80 }`, `blockProgress = 0.35` is reached at `8 × 0.35 / 0.80 = 3.5 seconds` — matching the original `animation-delay: 3.6s` intent.

`HeroFade` is a small private component local to `scene_00_hero.tsx`. It owns exactly one concern: mapping a `[start, end]` blockProgress window to opacity. No toolkit changes are needed. If a `startAt`/`endAt` API on the toolkit `<Fade>` preset becomes useful across multiple scenes, that can be a separate additive toolkit enhancement tracked independently.

### 15.2 CSS Changes

**File: `apps/website/src/landing/hero/hero.css`**

Remove the CSS `@keyframes`-based animation declarations from the hero-specific overlay elements. Specifically, remove:

```css
/* REMOVE these three declarations: */
.hero-tagline {
  opacity: 0;
  animation: fade-up 0.8s ease-out 3.6s forwards;  /* REMOVE this line */
}

.hero-packages {
  opacity: 0;
  animation: fade-up 0.8s ease-out 3.9s forwards;  /* REMOVE this line */
}

.scroll-indicator {
  animation: fade-up 0.6s ease-out 4.2s both;  /* REMOVE this line */
}
```

Keep all other CSS including the `@keyframes fade-up` definition itself if it is used elsewhere, the `@keyframes arrow-bounce` definition, and all layout/positioning rules. The `opacity: 0` initial state on `.hero-tagline` and `.hero-packages` must also be removed or the JS-driven fade will have no effect.

Keep: `.scroll-indicator__arrow { animation: arrow-bounce ... }` — this is a decorative repeating animation that does not need to sync with scroll.

---

## 16. Coordination with plan_core_modularization.md

**REQUIRED: These two plans MUST land in the same release.**

This plan introduces breaking changes to `AnimationTickContext` and `WidgetRenderContext` — two types that every `IAnimationController` and `IRenderable` widget implementor uses. The modularization plan (`plan_core_modularization.md`) introduces `IRenderable.rootObject: THREE.Object3D` as a new required field on `IRenderable`, which also breaks every `IRenderable` implementor.

| This Plan | Modularization Plan Phase 1 |
|---|---|
| `AnimationTickContext` removes `deltaSeconds`/`wallTimeSeconds`, adds `clock`/`effectiveDeltaSeconds` | `IRenderable` adds `rootObject: THREE.Object3D` as required |
| `WidgetRenderContext` removes `deltaSeconds`/`wallTimeSeconds`, adds `clock`/`effectiveDeltaSeconds` | Same widgets broken |
| Breaking for all `IAnimationController` + `IRenderable` implementors | Breaking for all `IRenderable` implementors |

Shipping separately means widget authors (external consumers of `@brewsite/core`) must update their widgets twice. Shipping together means one breaking change batch with a single major/minor version bump and one migration guide.

**Action required before implementation begins:** Confirm with PM and modularization plan owner that both plans will be batched into the same release. If the modularization plan is deferred, this plan can ship independently, but the widget migration guide must be standalone.

**Coordination point:** The modularization plan is currently `status: draft`. This plan is also `status: draft`. Neither should advance to `status: in-progress` without confirming the release batching decision.

---

## 17. Testing Strategy

All tests use Vitest with Node environment unless noted. No `any`, no `unknown` without justification comment. Test doubles implement real interfaces with observable state.

### 17.1 `buildProgressProfile` Additions

**File: `packages/core/src/compiler/__tests__/buildProgressProfile.test.ts`**

Add to the existing `describe('buildProgressProfile')` block:

```typescript
// ─── autoAdvance validation tests ─────────────────────────────────────────

describe('autoAdvance validation', () => {
  it('13. autoAdvance.duration <= 0 → emits PROGRESS_MANAGER warning', () => {
    const frames = [
      makeFrame('a', {
        scrollUnits: 1,
        fn: IDENTITY_FN,
        autoAdvance: { duration: 0, max: 1.0, pauseOnScroll: true },
      }),
      makeFrame('b'),
    ];
    const { warnings } = collectWarnings(frames);
    const pmWarnings = warnings.filter((w) => w.code === 'PROGRESS_MANAGER');
    expect(pmWarnings.some((w) => w.message.includes('duration') && w.message.includes('must be > 0'))).toBe(true);
    expect(pmWarnings[0]?.sceneIndex).toBe(0);
  });

  it('14. autoAdvance.duration negative → emits PROGRESS_MANAGER warning', () => {
    const frames = [
      makeFrame('a', {
        scrollUnits: 1,
        fn: IDENTITY_FN,
        autoAdvance: { duration: -5, max: 1.0, pauseOnScroll: true },
      }),
      makeFrame('b'),
    ];
    const { warnings } = collectWarnings(frames);
    expect(warnings.some((w) => w.code === 'PROGRESS_MANAGER' && w.message.includes('duration'))).toBe(true);
  });

  it('15. autoAdvance.max = 0 → emits PROGRESS_MANAGER warning', () => {
    const frames = [
      makeFrame('a', {
        scrollUnits: 1,
        fn: IDENTITY_FN,
        autoAdvance: { duration: 5, max: 0, pauseOnScroll: true },
      }),
      makeFrame('b'),
    ];
    const { warnings } = collectWarnings(frames);
    expect(warnings.some((w) => w.code === 'PROGRESS_MANAGER' && w.message.includes('max') && w.message.includes('(0, 1]'))).toBe(true);
  });

  it('16. autoAdvance.max > 1 → emits PROGRESS_MANAGER warning', () => {
    const frames = [
      makeFrame('a', {
        scrollUnits: 1,
        fn: IDENTITY_FN,
        autoAdvance: { duration: 5, max: 1.5, pauseOnScroll: true },
      }),
      makeFrame('b'),
    ];
    const { warnings } = collectWarnings(frames);
    expect(warnings.some((w) => w.code === 'PROGRESS_MANAGER' && w.message.includes('max'))).toBe(true);
  });

  it('17. autoAdvance on last scene → emits PROGRESS_MANAGER warning', () => {
    const frames = [
      makeFrame('a'),
      makeFrame('last', {
        scrollUnits: 1,
        fn: IDENTITY_FN,
        autoAdvance: { duration: 5, max: 0.8, pauseOnScroll: true },
      }),
    ];
    const { warnings } = collectWarnings(frames);
    // Expect the autoAdvance-specific last-scene warning (in addition to any scrollUnits warning)
    const aaWarnings = warnings.filter((w) => w.code === 'PROGRESS_MANAGER' && w.message.includes('autoAdvance'));
    expect(aaWarnings.length).toBeGreaterThanOrEqual(1);
    expect(aaWarnings[0]?.sceneIndex).toBe(1);
  });

  it('18. Valid autoAdvance: rawRate pre-computed correctly', () => {
    // 2 scenes: segment 0 spans rawStart=0, rawEnd=1.0 (only one segment, totalUnits=1, weight=1)
    // spec: duration=8, max=0.8
    // rawRate = (0.8 × 1.0) / 8 = 0.1
    const frames = [
      makeFrame('a', {
        scrollUnits: 1,
        fn: IDENTITY_FN,
        autoAdvance: { duration: 8, max: 0.8, pauseOnScroll: true },
      }),
      makeFrame('b'),
    ];
    const { profile, warnings } = collectWarnings(frames);
    const pmWarnings = warnings.filter((w) => w.code === 'PROGRESS_MANAGER');
    // No validation warnings for a valid spec
    expect(pmWarnings).toHaveLength(0);
    expect(profile).not.toBeUndefined();
    const seg = profile!.segments[0]!;
    expect(seg.autoAdvance).not.toBeUndefined();
    // segWidth = 1.0 (sole segment, uniform weights, BUT autoAdvance is declared → not uniform → profile exists)
    // rawRate = (0.8 × 1.0) / 8 = 0.1
    expect(seg.autoAdvance!.rawRate).toBeCloseTo(0.1, 10);
    expect(seg.autoAdvance!.pauseOnScroll).toBe(true);
  });

  it('19. Valid autoAdvance: maxRaw pre-computed correctly', () => {
    // 3 scenes: segment 0 gets 75% of raw space, segment 1 gets 25%.
    // Segment 0: rawStart=0, rawEnd=0.75, max=0.8
    // maxRaw = 0 + 0.8 × 0.75 = 0.6
    const frames = [
      makeFrame('a', {
        scrollUnits: 3,
        fn: IDENTITY_FN,
        autoAdvance: { duration: 5, max: 0.8, pauseOnScroll: false },
      }),
      makeFrame('b', { scrollUnits: 1, fn: IDENTITY_FN }),
      makeFrame('c'),
    ];
    const { profile } = collectWarnings(frames);
    expect(profile).not.toBeUndefined();
    const seg0 = profile!.segments[0]!;
    expect(seg0.autoAdvance).not.toBeUndefined();
    // rawStart=0, segWidth=0.75, max=0.8 → maxRaw = 0 + 0.8 × 0.75 = 0.6
    expect(seg0.autoAdvance!.maxRaw).toBeCloseTo(0.6, 10);
    expect(seg0.autoAdvance!.pauseOnScroll).toBe(false);
    // Segment 1 has no autoAdvance (only scene 'a' declared it, scene 'b' overrides with no autoAdvance)
    expect(profile!.segments[1]!.autoAdvance).toBeUndefined();
  });

  it('20. animationTimeScale stored on segment correctly', () => {
    const frames = [
      makeFrame('a', { scrollUnits: 1, fn: IDENTITY_FN, animationTimeScale: 6 }),
      makeFrame('b'),
    ];
    const { profile } = collectWarnings(frames);
    expect(profile).not.toBeUndefined();
    expect(profile!.segments[0]!.animationTimeScale).toBe(6);
  });

  it('21. isUniform = false when any scene has autoAdvance', () => {
    // Both scenes have the same scrollUnits and IDENTITY_FN, but autoAdvance is declared.
    // The profile must NOT short-circuit to undefined.
    const frames = [
      makeFrame('a', {
        scrollUnits: 1,
        fn: IDENTITY_FN,
        autoAdvance: { duration: 8, max: 0.8, pauseOnScroll: true },
      }),
      makeFrame('b', { scrollUnits: 1, fn: IDENTITY_FN }),
    ];
    const { profile } = collectWarnings(frames);
    // If isUniform were true, profile would be undefined — this verifies the fix.
    expect(profile).not.toBeUndefined();
    expect(profile!.isUniform).toBe(false);
  });

  it('22. isUniform = false when any scene has animationTimeScale', () => {
    const frames = [
      makeFrame('a', { scrollUnits: 1, fn: IDENTITY_FN, animationTimeScale: 4 }),
      makeFrame('b', { scrollUnits: 1, fn: IDENTITY_FN }),
    ];
    const { profile } = collectWarnings(frames);
    expect(profile).not.toBeUndefined();
    expect(profile!.isUniform).toBe(false);
  });
});
```

### 17.2 `RuntimeLoop` Additions

**File: `packages/core/src/runtime/__tests__/RuntimeLoop.test.ts`**

The existing `makeDriver()` helper must update its `tick()` signature to accept `deltaProgress`:

```typescript
// Updated makeDriver to accept the new tick signature.
// NOTE: getBoneWorldPositions() and getTargetColors() are removed by
// plan_core_modularization.md Phase 2 and replaced with collectRenderContributions().
// Both plans land in the same release, so the mock uses the post-modularization API.
const makeDriver = (): RuntimeDriver & { ticks: number; lastDeltaProgress: number } => ({
  ticks: 0,
  lastDeltaProgress: -1,
  assetsReady: false,
  setAssetsReady() {},
  setSceneTrack() {},
  tick(opts) {
    this.ticks += 1;
    this.lastDeltaProgress = opts.deltaProgress;
  },
  collectRenderContributions() { return { namedPositions: new Map(), targetColors: new Map() }; },
  getCurrentTick() { return null; },
  getWallTimeSeconds() { return 0; },
  dispose() {},
});
```

Add new test cases:

```typescript
describe('deltaProgress computation', () => {
  it('23. first frame: deltaProgress = globalProgress (prevGlobalProgress starts at 0)', () => {
    const driver = makeDriver();
    const loop = new RuntimeLoop({
      driver,
      getGlobalProgress: () => 0.5,
      fixedDeltaSeconds: 0.016,
      clock: { now: () => 0, requestFrame: () => 0, cancelFrame: () => {} },
    });
    loop.step(0);
    // First frame: prevGlobalProgress is 0, globalProgress is 0.5
    // deltaProgress = Math.max(0, 0.5 - 0) = 0.5
    // Actually: prevGlobalProgress starts at 0, so deltaProgress = 0.5 on first frame.
    // This is correct — the first frame is treated as a forward advance from 0.
    expect(driver.lastDeltaProgress).toBe(0.5);
  });

  it('24. deltaProgress correctly computed from consecutive globalProgress values', () => {
    const driver = makeDriver();
    let progress = 0.2;
    const loop = new RuntimeLoop({
      driver,
      getGlobalProgress: () => progress,
      fixedDeltaSeconds: 0.016,
      clock: { now: () => 0, requestFrame: () => 0, cancelFrame: () => {} },
    });
    loop.step(0);    // frame 1: progress=0.2, delta=0.2
    progress = 0.35;
    loop.step(16);   // frame 2: progress=0.35, delta=0.15
    expect(driver.lastDeltaProgress).toBeCloseTo(0.15, 10);
  });

  it('25. deltaProgress is 0 when globalProgress goes backward', () => {
    const driver = makeDriver();
    let progress = 0.5;
    const loop = new RuntimeLoop({
      driver,
      getGlobalProgress: () => progress,
      fixedDeltaSeconds: 0.016,
      clock: { now: () => 0, requestFrame: () => 0, cancelFrame: () => {} },
    });
    loop.step(0);    // frame 1: progress=0.5
    progress = 0.3;  // backward
    loop.step(16);   // frame 2: delta = Math.max(0, 0.3 - 0.5) = 0
    expect(driver.lastDeltaProgress).toBe(0);
  });

  it('26. onAfterTick receives { deltaSeconds, globalProgress }', () => {
    const driver = makeDriver();
    let capturedDelta = -1;
    let capturedProgress = -1;
    const loop = new RuntimeLoop({
      driver,
      getGlobalProgress: () => 0.7,
      fixedDeltaSeconds: 0.033,
      onAfterTick: ({ deltaSeconds, globalProgress }) => {
        capturedDelta = deltaSeconds;
        capturedProgress = globalProgress;
      },
      clock: { now: () => 0, requestFrame: () => 0, cancelFrame: () => {} },
    });
    loop.step(0);
    expect(capturedDelta).toBeCloseTo(0.033, 10);
    expect(capturedProgress).toBeCloseTo(0.7, 10);
  });
});
```

Note on test 23: `prevGlobalProgress` initializes to `0`. On the first frame with `globalProgress = 0.5`, `deltaProgress = Math.max(0, 0.5 - 0) = 0.5`. This is intentional — the first frame is treated as a forward advance from rest. In practice, when a page loads with the scene already scrolled, this produces a one-frame boost which is capped by `MAX_ANIM_BOOST_PER_FRAME`.

### 17.3 `RuntimeDriverImpl` Additions

**File: `packages/core/src/runtime/__tests__/RuntimeDriver.test.ts`**

Add after existing tests:

```typescript
describe('effectiveDeltaSeconds and clock', () => {
  it('27. effectiveDeltaSeconds equals deltaSeconds when deltaProgress is 0 (idle)', async () => {
    // Widget records the effectiveDeltaSeconds it received
    const capturedDeltas: number[] = [];
    const widget: IAnimationController = {
      widgetId: 'test-ctrl',
      onTick(ctx) {
        capturedDeltas.push(ctx.effectiveDeltaSeconds);
      },
    };

    const registry = new WidgetRegistry();
    registry.register(widget);
    const driver = new RuntimeDriverImpl({
      widgetRegistry: registry,
      variableStore: new VariableStore(),
      manifest: null,
    });

    const scene = new THREE.Scene();
    await driver.initialize(scene);

    const track = makeEmptySceneTrack();
    // Add animationTimeScale to segment 0
    track.progressProfile = {
      segments: [{ sceneIndex: 0, rawStart: 0, rawEnd: 1, engineStart: 0, engineEnd: 1, fn: (t) => t, animationTimeScale: 10 }],
      isUniform: false,
    };
    driver.setSceneTrack(track);

    // Tick with deltaProgress = 0 (idle)
    driver.tick({ deltaSeconds: 0.016, globalProgress: 0, deltaProgress: 0, wallTimeSeconds: 1 });

    // effectiveDeltaSeconds should equal deltaSeconds (max(0.016, min(0 × 10, 0.2)) = 0.016)
    expect(capturedDeltas[0]).toBeCloseTo(0.016, 10);
  });

  it('28. effectiveDeltaSeconds is boosted by animationTimeScale when scrolling', async () => {
    const capturedDeltas: number[] = [];
    const widget: IAnimationController = {
      widgetId: 'test-ctrl',
      onTick(ctx) { capturedDeltas.push(ctx.effectiveDeltaSeconds); },
    };
    const registry = new WidgetRegistry();
    registry.register(widget);
    const driver = new RuntimeDriverImpl({
      widgetRegistry: registry,
      variableStore: new VariableStore(),
      manifest: null,
    });
    const scene = new THREE.Scene();
    await driver.initialize(scene);

    const track = makeEmptySceneTrack();
    track.progressProfile = {
      segments: [{ sceneIndex: 0, rawStart: 0, rawEnd: 1, engineStart: 0, engineEnd: 1, fn: (t) => t, animationTimeScale: 10 }],
      isUniform: false,
    };
    driver.setSceneTrack(track);

    // deltaProgress = 0.02, animationTimeScale = 10 → rawBoost = 0.2
    // cappedBoost = min(0.2, 0.2) = 0.2 (exactly at cap)
    // effectiveDelta = max(0.016, 0.2) = 0.2
    driver.tick({ deltaSeconds: 0.016, globalProgress: 0, deltaProgress: 0.02, wallTimeSeconds: 1 });
    expect(capturedDeltas[0]).toBeCloseTo(0.2, 10);
  });

  it('29. effectiveDeltaSeconds capped at MAX_ANIM_BOOST_PER_FRAME (0.2)', async () => {
    const capturedDeltas: number[] = [];
    const widget: IAnimationController = {
      widgetId: 'test-ctrl',
      onTick(ctx) { capturedDeltas.push(ctx.effectiveDeltaSeconds); },
    };
    const registry = new WidgetRegistry();
    registry.register(widget);
    const driver = new RuntimeDriverImpl({
      widgetRegistry: registry,
      variableStore: new VariableStore(),
      manifest: null,
    });
    const scene = new THREE.Scene();
    await driver.initialize(scene);

    const track = makeEmptySceneTrack();
    track.progressProfile = {
      segments: [{ sceneIndex: 0, rawStart: 0, rawEnd: 1, engineStart: 0, engineEnd: 1, fn: (t) => t, animationTimeScale: 100 }],
      isUniform: false,
    };
    driver.setSceneTrack(track);

    // deltaProgress = 0.5, animationTimeScale = 100 → rawBoost = 50 (huge jump)
    // cappedBoost = min(50, 0.2) = 0.2
    // effectiveDelta = max(0.016, 0.2) = 0.2
    driver.tick({ deltaSeconds: 0.016, globalProgress: 0, deltaProgress: 0.5, wallTimeSeconds: 1 });
    expect(capturedDeltas[0]).toBeCloseTo(0.2, 10);
  });

  it('30. clock.wallTimeSeconds matches wallTimeSeconds option', async () => {
    const capturedClocks: Array<{ wallTimeSeconds: number; deltaSeconds: number }> = [];
    const widget: IAnimationController = {
      widgetId: 'test-ctrl',
      onTick(ctx) { capturedClocks.push({ ...ctx.clock }); },
    };
    const registry = new WidgetRegistry();
    registry.register(widget);
    const driver = new RuntimeDriverImpl({ widgetRegistry: registry, variableStore: new VariableStore(), manifest: null });
    const scene = new THREE.Scene();
    await driver.initialize(scene);
    driver.setSceneTrack(makeEmptySceneTrack());

    driver.tick({ deltaSeconds: 0.016, globalProgress: 0, deltaProgress: 0, wallTimeSeconds: 42.5 });

    expect(capturedClocks[0]?.wallTimeSeconds).toBeCloseTo(42.5, 10);
    expect(capturedClocks[0]?.deltaSeconds).toBeCloseTo(0.016, 10);
  });

  it('31. sampling happens before animation controllers (tick order)', async () => {
    // Verify that when onTick is called, currentTick has already been sampled.
    // We track the sceneIndex received by the controller and verify it matches
    // what the sampler would return for the given globalProgress.
    const capturedSceneIndexes: number[] = [];
    const widget: IAnimationController = {
      widgetId: 'test-ctrl',
      onTick(ctx) {
        // ctx.tick is the sampled tick — sceneIndex should be valid
        capturedSceneIndexes.push(ctx.tick?.sceneIndex ?? -1);
      },
    };
    const registry = new WidgetRegistry();
    registry.register(widget);
    const driver = new RuntimeDriverImpl({ widgetRegistry: registry, variableStore: new VariableStore(), manifest: null });
    const scene = new THREE.Scene();
    await driver.initialize(scene);

    const track = makeEmptySceneTrack();
    driver.setSceneTrack(track);

    // globalProgress = 0 → sceneIndex should be 0
    driver.tick({ deltaSeconds: 0.016, globalProgress: 0, deltaProgress: 0, wallTimeSeconds: 0 });
    expect(capturedSceneIndexes[0]).toBe(0);

    // globalProgress = 1 → sceneIndex should reflect the last scene
    driver.tick({ deltaSeconds: 0.016, globalProgress: 1, deltaProgress: 0, wallTimeSeconds: 0 });
    expect(capturedSceneIndexes[1]).toBeGreaterThanOrEqual(0);
  });
});
```

### 17.4 Auto-Advance State Machine

**File: `packages/core/src/player/__tests__/autoAdvance.test.ts`** — new file

This test requires `vi.useFakeTimers()` because `Date.now()` is used for the 200ms scroll debounce. The state machine lives in `useSceneEngine` which is a React hook — test it via a lightweight in-process simulation rather than a full React render:

```typescript
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * The auto-advance state machine is embedded in useSceneEngine's onAfterTick callback.
 * We test it by extracting the pure logic into a testable function and asserting its behavior.
 *
 * The state machine logic in onAfterTick:
 * 1. Bail if autoAdvancePausedRef.current
 * 2. Bail if no progressProfile
 * 3. Bail if segment has no autoAdvance
 * 4. Bail if pauseOnScroll and timeSinceScroll < 200
 * 5. Bail if currentRaw >= autoAdvance.maxRaw
 * 6. Compute newRaw = currentRaw + deltaSeconds × rawRate, clamped to maxRaw
 * 7. Call advanceToRawProgress(newRaw) if newRaw > currentRaw + 1e-7
 *
 * We test this by simulating the state machine directly.
 */

// Extracted state machine logic (mirrors the onAfterTick implementation)
type AutoAdvanceState = {
  paused: boolean;
  lastUserScrollTimeMs: number;
  getCurrentRaw: () => number;
  advancedToValues: number[];
};

type AutoAdvanceSegment = {
  rawRate: number;
  maxRaw: number;
  pauseOnScroll: boolean;
};

const runAutoAdvanceTick = (
  state: AutoAdvanceState,
  segment: AutoAdvanceSegment | undefined,
  deltaSeconds: number,
): void => {
  if (state.paused) return;
  if (!segment) return;

  if (segment.pauseOnScroll) {
    const timeSinceScroll = Date.now() - state.lastUserScrollTimeMs;
    if (timeSinceScroll < 200) return;
  }

  const currentRaw = state.getCurrentRaw();
  if (currentRaw >= segment.maxRaw) return;

  const deltaRaw = deltaSeconds * segment.rawRate;
  const newRaw = Math.min(currentRaw + deltaRaw, segment.maxRaw);

  if (newRaw > currentRaw + 1e-7) {
    state.advancedToValues.push(newRaw);
  }
};

describe('auto-advance state machine', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('32. advances rawProgress when not paused and no recent scroll', () => {
    vi.setSystemTime(2000);  // 2 seconds since epoch
    const state: AutoAdvanceState = {
      paused: false,
      lastUserScrollTimeMs: 0,  // scrolled 2000ms ago — well past the 200ms debounce
      getCurrentRaw: () => 0.1,
      advancedToValues: [],
    };
    const segment: AutoAdvanceSegment = { rawRate: 0.1, maxRaw: 0.8, pauseOnScroll: true };

    runAutoAdvanceTick(state, segment, 0.016);

    expect(state.advancedToValues).toHaveLength(1);
    expect(state.advancedToValues[0]).toBeCloseTo(0.1 + 0.016 * 0.1, 10);
  });

  it('33. does NOT advance when setAutoAdvancePaused(true)', () => {
    vi.setSystemTime(2000);
    const state: AutoAdvanceState = {
      paused: true,   // explicitly paused
      lastUserScrollTimeMs: 0,
      getCurrentRaw: () => 0.1,
      advancedToValues: [],
    };
    const segment: AutoAdvanceSegment = { rawRate: 0.1, maxRaw: 0.8, pauseOnScroll: true };

    runAutoAdvanceTick(state, segment, 0.016);

    expect(state.advancedToValues).toHaveLength(0);
  });

  it('34. does NOT advance within 200ms of user scroll when pauseOnScroll=true', () => {
    vi.setSystemTime(1000);
    const state: AutoAdvanceState = {
      paused: false,
      lastUserScrollTimeMs: 950,  // scrolled 50ms ago
      getCurrentRaw: () => 0.1,
      advancedToValues: [],
    };
    const segment: AutoAdvanceSegment = { rawRate: 0.1, maxRaw: 0.8, pauseOnScroll: true };

    runAutoAdvanceTick(state, segment, 0.016);

    expect(state.advancedToValues).toHaveLength(0);
  });

  it('35. DOES advance within 200ms of scroll when pauseOnScroll=false', () => {
    vi.setSystemTime(1000);
    const state: AutoAdvanceState = {
      paused: false,
      lastUserScrollTimeMs: 950,  // scrolled 50ms ago
      getCurrentRaw: () => 0.1,
      advancedToValues: [],
    };
    const segment: AutoAdvanceSegment = {
      rawRate: 0.1,
      maxRaw: 0.8,
      pauseOnScroll: false,   // explicitly opt-out
    };

    runAutoAdvanceTick(state, segment, 0.016);

    expect(state.advancedToValues).toHaveLength(1);
  });

  it('36. stops at maxRaw ceiling and does not advance past it', () => {
    vi.setSystemTime(2000);
    const state: AutoAdvanceState = {
      paused: false,
      lastUserScrollTimeMs: 0,
      getCurrentRaw: () => 0.799,   // just below ceiling
      advancedToValues: [],
    };
    const segment: AutoAdvanceSegment = { rawRate: 0.1, maxRaw: 0.8, pauseOnScroll: true };

    runAutoAdvanceTick(state, segment, 1.0);  // large delta: would overshoot to 0.899

    expect(state.advancedToValues).toHaveLength(1);
    expect(state.advancedToValues[0]).toBeCloseTo(0.8, 10);  // clamped to maxRaw
  });

  it('37. does NOT advance when already at maxRaw', () => {
    vi.setSystemTime(2000);
    const state: AutoAdvanceState = {
      paused: false,
      lastUserScrollTimeMs: 0,
      getCurrentRaw: () => 0.8,   // exactly at ceiling
      advancedToValues: [],
    };
    const segment: AutoAdvanceSegment = { rawRate: 0.1, maxRaw: 0.8, pauseOnScroll: true };

    runAutoAdvanceTick(state, segment, 0.016);

    expect(state.advancedToValues).toHaveLength(0);
  });

  it('38. does NOT advance when segment has no autoAdvance', () => {
    vi.setSystemTime(2000);
    const state: AutoAdvanceState = {
      paused: false,
      lastUserScrollTimeMs: 0,
      getCurrentRaw: () => 0.1,
      advancedToValues: [],
    };

    runAutoAdvanceTick(state, undefined, 0.016);  // no segment

    expect(state.advancedToValues).toHaveLength(0);
  });

  it('39. resumes advancing after 200ms of scroll inactivity', () => {
    vi.setSystemTime(1000);
    const state: AutoAdvanceState = {
      paused: false,
      lastUserScrollTimeMs: 900,  // scrolled 100ms ago — paused
      getCurrentRaw: () => 0.1,
      advancedToValues: [],
    };
    const segment: AutoAdvanceSegment = { rawRate: 0.1, maxRaw: 0.8, pauseOnScroll: true };

    runAutoAdvanceTick(state, segment, 0.016);
    expect(state.advancedToValues).toHaveLength(0);  // still paused

    vi.setSystemTime(1300);  // 400ms later
    state.advancedToValues.length = 0;

    runAutoAdvanceTick(state, segment, 0.016);
    expect(state.advancedToValues).toHaveLength(1);  // resumed
  });
});
```

### 17.5 Widget Context Migration Verification

No new test files are needed for the context shape change itself. The change is verified by the TypeScript compiler — if any widget test constructs `AnimationTickContext` or `WidgetRenderContext` with the old shape, `tsc` or the Vitest type-check pass will fail.

Concretely, `packages/core/src/elements/camera/__tests__/CameraWidget.test.ts` must be updated (see Section 14.2). Run `pnpm --filter @brewsite/core typecheck` after Step 8 in the implementation sequence to catch all sites.

---

## 18. Files Affected

| File | Change Type | Summary |
|---|---|---|
| `packages/core/src/compiler/sceneTrackTypes.ts` | Edit | New `AutoAdvanceSpec` type; add `autoAdvance?` and `animationTimeScale?` to `ProgressManagerSpec`; add pre-computed `autoAdvance?` and `animationTimeScale?` to `SceneProgressSegment` |
| `packages/core/src/compiler/primitives/progressManager.ts` | Edit | Add `autoAdvance` and `animationTimeScale` to `ProgressManagerProps` interface and `progressManagerHandler` |
| `packages/core/src/compiler/sceneTrackCompiler.ts` | Edit | `buildProgressProfile`: updated `isUniform` check, `autoAdvance` validation, pre-computed segment fields |
| `packages/core/src/runtime/types.ts` | Edit | **Dual change — both plans in one edit.** This plan: new `RealtimeClock` type; add `deltaProgress` to `RuntimeDriver.tick()`. `plan_core_modularization.md` Phase 2: remove `getBoneWorldPositions()`/`getTargetColors()` from `RuntimeDriver` interface; add `collectRenderContributions(): RenderContribution`. An implementer applying both plans sequentially must ensure neither edit clobbers the other — apply all changes in a single pass to this file. |
| `packages/core/src/runtime/RuntimeLoop.ts` | Edit | New `prevGlobalProgress` field; `deltaProgress` computation; updated `onAfterTick` callback signature |
| `packages/core/src/runtime/RuntimeDriver.ts` | Edit | `MAX_ANIM_BOOST_PER_FRAME` constant; full `tick()` rewrite with new order, `effectiveDeltaSeconds`, `clock` |
| `packages/core/src/widget/types.ts` | Edit | `AnimationTickContext`: remove `deltaSeconds`/`wallTimeSeconds`, add `clock`/`effectiveDeltaSeconds`; `WidgetRenderContext`: same |
| `packages/core/src/player/useEngineScroll.ts` | Edit | New `rawProgressRef`, `isProgrammaticScrollRef`; updated `computeProgress`; new `getRawProgress`, `scrollToRawProgress`; `onUserScroll` option |
| `packages/core/src/player/useEngineInput.ts` | Edit | Add `onUserScroll` to options; thread `getRawProgress`/`scrollToRawProgress` from scroll result; new members in result type |
| `packages/core/src/player/useSceneEngine.ts` | Edit | New `autoAdvancePausedRef`, `lastUserScrollTimeRef`; `setAutoAdvancePaused`; `advanceToRawProgress`; updated `useEngineInput` call; auto-advance state machine in `onAfterTick`; updated `UseSceneEngineResult` type |
| `packages/core/src/runtime/mocks/widgetMocks.ts` | Edit | No structural change needed; tests using `lastCtx.deltaSeconds` must update to `lastCtx.clock.deltaSeconds` — verify all callers |
| `packages/core/src/elements/camera/CameraWidget.ts` | Edit | Line 248: `context.deltaSeconds` → `context.effectiveDeltaSeconds` |
| `packages/core/src/elements/camera/__tests__/CameraWidget.test.ts` | Edit | Update `makeTickCtx` helper to new `AnimationTickContext` shape |
| `apps/website/src/widgets/neon-sign/NeonSignWidget.ts` | Edit | Line 71: `context.wallTimeSeconds` → `context.clock.wallTimeSeconds` |
| `packages/diagram/src/elements/diagram/canvas/DiagramCanvasWidget.ts` | Edit | Update any `context.deltaSeconds`/`context.wallTimeSeconds` usages (audit first with grep) |
| `apps/website/src/scenes/act0/scene_00_hero.tsx` | Edit | Add `ProgressManager` import and element; update overlay content approach |
| `apps/website/src/landing/hero/hero.css` | Edit | Remove `animation-delay` rules from `.hero-tagline`, `.hero-packages`, `.scroll-indicator` |
| `packages/core/src/compiler/__tests__/buildProgressProfile.test.ts` | Edit | Add test cases 13–22 (new `describe('autoAdvance validation')` block) |
| `packages/core/src/runtime/__tests__/RuntimeLoop.test.ts` | Edit | Update `makeDriver()` signature; add test cases 23–26 |
| `packages/core/src/runtime/__tests__/RuntimeDriver.test.ts` | Edit | Add test cases 27–31 |
| `packages/core/src/player/__tests__/autoAdvance.test.ts` | New | Test cases 32–39 (auto-advance state machine) |

**No changes to:** `SceneTrack.ticks[]` structure, `sceneTrackSampler.ts`, `ScenePlayer` public props, `EngineContext.tsx` (picks up `UseSceneEngineResult` changes automatically), `@brewsite/diagram` package public API (only `DiagramCanvasWidget` internals if they use deprecated context fields).

---

## 19. Implementation Sequence

Implement in this order. After each step, run `pnpm --filter @brewsite/core typecheck` to catch type errors before they compound. After Steps 6 and 8, also run `pnpm --filter @brewsite/core test`.

**Step 1 — Data model types**

Edit `packages/core/src/compiler/sceneTrackTypes.ts`:
- Add `AutoAdvanceSpec` type (Section 3.1)
- Add `autoAdvance?` and `animationTimeScale?` to `ProgressManagerSpec` (Section 3.2)
- Add `autoAdvance?` and `animationTimeScale?` to `SceneProgressSegment` (Section 3.3)

Edit `packages/core/src/runtime/types.ts`:
- Add `RealtimeClock` type (Section 3.4)
- Add `deltaProgress: number` to `RuntimeDriver.tick()` signature (Section 3.7)

**Step 2 — `progressManager.ts` handler**

Edit `packages/core/src/compiler/primitives/progressManager.ts`:
- Add `autoAdvance` and `animationTimeScale` to `ProgressManagerProps` (Section 7.1)
- Replace `progressManagerHandler` with the updated version (Section 7.2)
- Update JSDoc on `ProgressManager` component

**Step 3 — `buildProgressProfile` changes + tests**

Edit `packages/core/src/compiler/sceneTrackCompiler.ts`:
- Update `isUniform` check (Section 8.1)
- Add `autoAdvance` validation block (Section 8.2)
- Replace segment-building loop with pre-computation version (Section 8.3)

Edit `packages/core/src/compiler/__tests__/buildProgressProfile.test.ts`:
- Add test cases 13–22 (Section 17.1)

Run: `pnpm --filter @brewsite/core vitest run src/compiler/__tests__/buildProgressProfile.test.ts`

**Step 4 — `RuntimeLoop` changes**

Edit `packages/core/src/runtime/RuntimeLoop.ts`:
- Add `prevGlobalProgress` field (Section 9.2)
- Update `runStep` with `deltaProgress` computation and new `onAfterTick` signature (Section 9.3)

**Step 5 — `RuntimeDriverImpl` changes**

Edit `packages/core/src/runtime/RuntimeDriver.ts`:
- Add `MAX_ANIM_BOOST_PER_FRAME` constant (Section 10.1)
- Add `RealtimeClock` to imports (Section 10.2)
- Replace `tick()` method with new implementation (Section 10.3)

At this point, TypeScript will report errors in all files that pass the old `tick()` options shape (missing `deltaProgress`) and all widget files using the old context shapes. This is expected — Step 6 fixes the context types, Steps 7 and 8 fix the widget files.

**Step 6 — `widget/types.ts` context shape changes**

Edit `packages/core/src/widget/types.ts`:
- Replace `AnimationTickContext` (Section 3.5)
- Replace `WidgetRenderContext` (Section 3.6)
- Add `RealtimeClock` import from `../runtime/types`

**Step 7 — All widget `onTick`/`apply` updates**

For each file listed below, apply the migration described in Section 14:

- `packages/core/src/elements/camera/CameraWidget.ts` — line 248: `context.deltaSeconds` → `context.effectiveDeltaSeconds`
- `apps/website/src/widgets/neon-sign/NeonSignWidget.ts` — line 71: `context.wallTimeSeconds` → `context.clock.wallTimeSeconds`
- `packages/diagram/src/elements/diagram/canvas/DiagramCanvasWidget.ts` — audit with `grep "context\.\(deltaSeconds\|wallTimeSeconds\)"`, update each site
- `packages/core/src/elements/camera/__tests__/CameraWidget.test.ts` — update `makeTickCtx` helper (Section 14.2)

Run: `pnpm --filter @brewsite/core typecheck && pnpm --filter @brewsite/diagram typecheck`

**Step 8 — `RuntimeLoop` and `RuntimeDriverImpl` tests**

Edit `packages/core/src/runtime/__tests__/RuntimeLoop.test.ts`:
- Update `makeDriver()` to new `tick()` signature
- Update existing test that uses old `onAfterTick` signature (`frame.wallTimeSeconds`)
- Add test cases 23–26 (Section 17.2)

Edit `packages/core/src/runtime/__tests__/RuntimeDriver.test.ts`:
- Add test cases 27–31 (Section 17.3)

Run: `pnpm --filter @brewsite/core test`

**Step 9 — `useEngineScroll` changes**

Edit `packages/core/src/player/useEngineScroll.ts`:
- Update options type with `onUserScroll` (Section 11.1)
- Update result type with `getRawProgress`, `scrollToRawProgress` (Section 11.2)
- Implement full hook changes (Section 11.3)

**Step 10 — `useEngineInput` changes**

Edit `packages/core/src/player/useEngineInput.ts`:
- Add `onUserScroll` to options (Section 12.1)
- Update result type (Section 12.2)
- Thread new methods and options (Section 12.3)

**Step 11 — `useSceneEngine` auto-advance state machine**

Edit `packages/core/src/player/useSceneEngine.ts`:
- Add new refs (Section 13.1)
- Add `setAutoAdvancePaused` (Section 13.2)
- Update `useEngineInput` call (Section 13.3)
- Add `advanceToRawProgress` (Section 13.4)
- Update `RuntimeLoop` construction in `useEffect` (Section 13.5)
- Update `UseSceneEngineResult` type and return value (Section 13.6)

Run: `pnpm --filter @brewsite/core typecheck`

**Step 12 — Auto-advance tests**

Create `packages/core/src/player/__tests__/autoAdvance.test.ts`:
- Implement test cases 32–39 (Section 17.4)

Run: `pnpm --filter @brewsite/core vitest run src/player/__tests__/autoAdvance.test.ts`

**Step 13 — Full test suite**

Run: `pnpm --filter @brewsite/core test && pnpm --filter @brewsite/diagram test`

All tests must pass before proceeding to Step 14.

**Step 14 — Hero screen migration**

Edit `apps/website/src/scenes/act0/scene_00_hero.tsx`:
- Add `ProgressManager` to imports
- Add `<ProgressManager scrollUnits={1800} autoAdvance={{ duration: 8, max: 0.80, pauseOnScroll: true }} animationTimeScale={3} />` inside `<Scene>`
- Update overlay content to use `blockProgress`-driven animations (Section 15.1)

Edit `apps/website/src/landing/hero/hero.css`:
- Remove `animation-delay` declarations from `.hero-tagline`, `.hero-packages`, `.scroll-indicator` (Section 15.2)

Run: `pnpm dev` and visually verify that:
1. Hero overlay content appears at `blockProgress ≈ 0.35` (approximately 3.5 seconds of idle time)
2. Scrolling advances the overlay correctly (not CSS-driven)
3. Auto-advance stops at `blockProgress = 0.80`
4. User scroll overrides auto-advance immediately
5. Auto-advance resumes after 200ms of scroll inactivity
