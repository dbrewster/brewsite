---
title: "Progress-Driven Animation — Auto-Advance, Animation Time Scale, and Synchronized Clock"
doc_type: note
owner: Toolkit Product
status: draft
updated: 2026-03-01
---

# Progress-Driven Animation

## Purpose

This note describes three tightly related features that bridge BrewSite's two currently
independent execution loops — scroll-driven progress and wall-clock time — into a unified,
composable model. It is intended for architect review before a formal implementation plan
is written.

---

## The Problem: Two Loops That Don't Talk

The `RuntimeLoop` drives every RAF frame with two independent values:

```
deltaSeconds    = wall clock elapsed         → feeds AnimationMixer.update()
globalProgress  = scroll position [0..1]     → feeds SceneTrack sampler
```

These values are passed to `driver.tick()` independently and have no influence on each
other. A widget either responds to time (continuous, always running) or to progress
(frozen when the user isn't scrolling). There is no mechanism for:

- Progress advancing automatically while the user is idle (auto-play)
- Animation speed accelerating in response to scroll velocity
- A formal, synchronized clock available to all widgets under a clear contract

### Concrete manifestation: the website hero screen

The hero scene's overlay text (`scene_00_hero.tsx`) uses CSS `@keyframes` with fixed
`animation-delay: 3.6s, 3.9s, 4.2s`. These timers start on page mount and are completely
decoupled from BrewSite's `globalProgress`. Result:

- User scrolls before 3.6s → overlay is invisible; the animation has not fired
- User scrolls after 4.2s → overlay is already at full opacity; no entrance visible
- User sits idle → overlay plays nicely, then the user must scroll to advance

The root cause is mixing two animation systems in the same scene. The CSS `@keyframes`
approach is wrong here — the overlay should be authored as BrewSite overlay content
driven by `blockProgress`, so that both time (via auto-advance) and scroll drive the
same reveal. See the migration note at the end of this document.

---

## Three Features, One Unified Model

### The math that connects them

```
effectiveDeltaSeconds = max(deltaSeconds, min(deltaProgress × animationTimeScale, maxBoostPerFrame))
```

- **Idle** (`deltaProgress = 0`): `effectiveDelta = deltaSeconds` — animation at 1×, real-time
- **Scrolling** (`deltaProgress > 0`): `effectiveDelta` is boosted proportionally — animation
  accelerates with scroll speed
- **Auto-advancing** (`deltaProgress` is small, from idle time-to-progress conversion): boost
  is negligible — animation still plays at approximately real-time

These three features compose cleanly:
1. **Auto-advance** produces `deltaProgress` from `deltaSeconds × rate` when idle
2. **Animation time scale** uses `deltaProgress` (from any source) to boost animation mixers
3. **Synchronized clock** provides a clean, explicit `clock` object to all widgets so that
   ambient/idle animations are always coherent, regardless of scroll state

None of the three requires a separate RAF loop. All three run inside the existing single
`RuntimeLoop` at 60fps.

---

## Feature A: Auto-Advance

### What it does

When the user is idle (not scrolling) and a scene declares `autoAdvance`, wall-clock time
automatically advances `rawProgress` at a configurable rate, up to an optional ceiling.
When the user scrolls, user input takes over seamlessly. When the user stops scrolling,
auto-advance resumes from wherever progress stopped.

### DSL

```tsx
<Scene id="website-hero-00">
  <ProgressManager
    scrollUnits={1800}
    autoAdvance={{
      duration: 8,           // seconds to advance from 0 to max while idle (required)
      max: 0.80,             // stop auto-advancing at 80% of this scene's window (default: 1.0)
      pauseOnScroll: true,   // pause when user scrolls; resume on idle (default: true)
    }}
  />
  {/* ... */}
</Scene>
```

`duration` is the primary authoring knob: "play this scene in N seconds while the user
is idle." It is more intuitive than a raw `rate` because the author thinks in wall-clock
seconds, not in normalized progress units.

Internally: `rawRate = (max × segmentWidth) / duration` where `segmentWidth` is the
normalized raw input window for this scene (`segment.rawEnd - segment.rawStart`).

`max` defaults to 1.0, meaning auto-advance plays through the entire scene window. Set it
lower to ensure the user must scroll to see the scene's second half (e.g., auto-advance
shows the tagline, but the user must scroll to advance to the next scene).

Merge semantics: same as the rest of `<ProgressManager>` — full spec carries forward as a
unit. A scene with no `<ProgressManager>` inherits the previous scene's spec, including
`autoAdvance`. Declare `<ProgressManager autoAdvance={undefined} />` to explicitly clear
auto-advance for a scene.

### Imperative API

```typescript
// On EngineContext / UseSceneEngineResult — works inside and outside EngineProvider tree:
engine.setAutoAdvancePaused(true);   // freeze auto-advance immediately
engine.setAutoAdvancePaused(false);  // resume from where it stopped

// Use case: pause when a modal or overlay is open
useEffect(() => {
  engine.setAutoAdvancePaused(isModalOpen);
}, [isModalOpen]);
```

`pauseOnScroll: true` is implemented by the engine calling `setAutoAdvancePaused(true)`
when scroll input is detected, and `setAutoAdvancePaused(false)` after a 200ms idle
debounce. The same mechanism is exposed imperatively so application code can drive it
from any external event.

### Implementation location

Auto-advance state lives in `useEngineInput` / `useSceneEngine` — the input/progress
layer that already owns `rawProgress` and `scrollToProgress`. It does NOT live in
`RuntimeLoop` because `RuntimeLoop` only reads `getGlobalProgress()` and knows nothing
about raw vs mapped progress.

The integration point is the existing `onAfterTick` callback provided by `useSceneEngine`
to `RuntimeLoop`. After each tick, `onAfterTick` receives `{ deltaSeconds, globalProgress }`.
At this point, the auto-advance logic:

1. Reads current scene's `autoAdvance` spec from `sceneTrack.progressProfile.segments[sceneIndex]`
2. Checks: is auto-advance active? Is it paused? Has the user scrolled recently?
3. If advancing: computes `deltaRaw = deltaSeconds × rawRate`, clamps to `maxRaw`, calls
   `scrollToProgress(rawProgress + deltaRaw)` (or `setRawProgress` in `ScrollCaptureSection` mode)

**Scroll detection for `pauseOnScroll`**: maintain `lastUserScrollMs = Date.now()` in a ref
updated by the scroll event listener already attached in `useEngineScroll`. If
`Date.now() - lastUserScrollMs < 200`, the user is considered scrolling.

**Important**: `scrollToProgress` in scroll mode calls `window.scrollTo()`. Auto-advance
calls it too — this is correct and intentional. The page scroll position advances slowly
while idle, giving the user a familiar scroll-bar-moving-on-its-own cue that the scene
is auto-playing.

### Requires: `getRawProgress()` on the scroll hook

`useEngineScroll` currently only exposes `getGlobalProgress()` (post-mapper). Auto-advance
needs to read and write `rawProgress` (pre-mapper) to work correctly with `SceneProgressMapper`.
Add `getRawProgress(): number` to `UseEngineScrollResult` and `useEngineInput`.

---

## Feature B: Animation Time Scale

### What it does

When the user scrolls (or when auto-advance nudges `rawProgress`), GLTF animation mixers
run faster in proportion to how fast progress is moving. When the user is idle, mixers run
at 1× real-time. The formula ensures animation never pauses — `deltaSeconds` is always
the floor.

### DSL

```tsx
<Scene id="model-demo">
  <ProgressManager
    scrollUnits={2000}
    animationTimeScale={6}
    // Total animation-seconds consumed when scrolling 0→1 through this scene's window.
    // At normal scroll speed (~5s to traverse), animations run ~1.2× real-time.
    // At fast scroll, animations run faster. At idle, animations run at 1× real-time.
  />
  <Robot id="hero-bot">
    <Playback>
      <Animation clipName="walk-cycle" enabled weight={1} />
    </Playback>
  </Robot>
</Scene>
```

`animationTimeScale` units: total animation-seconds that play when the user scrolls
from `rawStart` to `rawEnd` of this scene's window in a single smooth pass. Recommended
range: 2–12. Values above 20 risk jarring acceleration at fast scroll speeds (mitigated
by `maxBoostPerFrame`).

Scene-wide, not per-model. See rationale in the "Design Decisions" section below.

### The formula

```typescript
// Computed in RuntimeDriverImpl.tick() after sampling (see tick order change):
const animationTimeScale = currentSegment?.animationTimeScale ?? 0;
const rawBoost = deltaProgress * animationTimeScale;
const cappedBoost = Math.min(rawBoost, MAX_ANIM_BOOST_PER_FRAME);  // default: 0.2s
const effectiveDeltaSeconds = Math.max(deltaSeconds, cappedBoost);
```

`MAX_ANIM_BOOST_PER_FRAME = 0.2s` (12× real-time per frame at 60fps) caps the boost so
that programmatic navigation (NavMenu clicking "Scene 5" from "Scene 1") doesn't produce
a multi-second animation jump in a single frame. The cap is a constant in the driver for
now; it can become configurable later if needed.

### Implementation: `deltaProgress` in the tick contract

`RuntimeLoop` tracks `prevGlobalProgress` between frames and computes:

```typescript
const deltaProgress = Math.max(0, globalProgress - this.prevGlobalProgress);
this.prevGlobalProgress = globalProgress;
```

`deltaProgress` is passed to `driver.tick()` as a new field:

```typescript
// Updated RuntimeDriver.tick() signature:
tick(options: {
  deltaSeconds: number;
  globalProgress: number;
  deltaProgress: number;       // NEW — computed by RuntimeLoop each frame
  wallTimeSeconds?: number;
}): void;
```

The driver computes `effectiveDeltaSeconds` internally after sampling, and uses it when
dispatching to `IAnimationController.onTick()`.

### Tick order change: sampling before animation controllers

Currently `driver.tick()` runs animation controllers BEFORE sampling the SceneTrack.
This must change. `effectiveDeltaSeconds` depends on the current scene's
`animationTimeScale`, which comes from the sampled segment. The correct tick order is:

**Current (wrong for this feature):**
1. Tick animation controllers (`IAnimationController.onTick()`) — uses `deltaSeconds`
2. Sample SceneTrack — determines current scene
3. Apply renderable widgets

**New (correct):**
1. Sample SceneTrack — O(1) lookup, determines current scene and its `animationTimeScale`
2. Compute `effectiveDeltaSeconds` from `deltaProgress × animationTimeScale`
3. Tick animation controllers — uses `effectiveDeltaSeconds`
4. Apply renderable widgets

Sampling is O(1) and cheap. Moving it first is correct both for this feature and
architecturally — the animation controllers and renderables should both operate on the
current scene's declared state, not the previous frame's.

This is a behavioral change to `RuntimeDriverImpl.tick()` and must be flagged clearly.
Widgets that relied on animation controllers running before the sampler (none known)
would break. This is a minor version change, not a major one — no public API changes.

---

## Feature C: Synchronized Real-Time Clock

### The problem

Multiple widgets want time-driven ambient animations (NeonSign pulse, particle effects,
procedural shaders, breathing cycles). Today they receive `wallTimeSeconds` via their
render context. This works but is implicit and underdocumented. Widget authors building
new ambient effects may reach for `this.localTime += deltaSeconds` instead, which:

- Drifts between widgets (different start times)
- Breaks on tab hide/show (`deltaSeconds` backlogs when a hidden tab becomes visible again)
- Doesn't express the "real-time, unaffected by scroll" contract clearly

### The fix: a formal `clock` object in all tick contexts

Introduce a `RealtimeClock` type and nest it in both `AnimationTickContext` and
`WidgetRenderContext`:

```typescript
/**
 * Synchronized real-time clock. Same values are seen by every widget every frame.
 * Use this for ambient animations, oscillations, and idle effects.
 * Never use a private this.localTime += deltaSeconds accumulator — it drifts and
 * breaks on tab hide/show.
 */
export type RealtimeClock = {
  /**
   * Absolute wall-clock time in seconds since page load.
   * Use for: sin/cos oscillations, sawtooth patterns, phase offsets between widgets.
   * Example: sin(clock.wallTimeSeconds * Math.PI * 2 * 0.5)  → 0.5 Hz oscillation
   */
  wallTimeSeconds: number;

  /**
   * Real-time elapsed since last frame, in seconds. Always ~0.0167 at 60fps.
   * Unaffected by scroll, effectiveDeltaSeconds, or animationTimeScale.
   * Use for: physics integration, particle simulation, smooth increment-based effects.
   */
  deltaSeconds: number;
};

// Updated AnimationTickContext:
export type AnimationTickContext = {
  clock: RealtimeClock;                // real-time, synchronized, unaffected by scroll
  effectiveDeltaSeconds: number;       // scroll-boosted; use for AnimationMixer.update()
  scene: ThreeScene;
  variables: VariableStore;
  tick: SceneTrackTick | null;
  track: SceneTrack | null;
};

// Updated WidgetRenderContext:
export type WidgetRenderContext<TExtra = unknown> = {
  clock: RealtimeClock;                // real-time clock for ambient effects
  effectiveDeltaSeconds: number;       // scroll-boosted delta
  globalProgress: number;
  variables: VariableStore;
  extra: TExtra;
  tick: SceneTrackTick;
};
```

`clock` replaces the current flat `deltaSeconds` and `wallTimeSeconds` fields on both
contexts. `effectiveDeltaSeconds` is the new scroll-boosted value alongside it.

### Widget authoring contract (new canonical rule)

| Animation type | Use | Example |
|---|---|---|
| Ambient oscillation | `clock.wallTimeSeconds` | `sin(clock.wallTimeSeconds * freq)` |
| Physics / increment | `clock.deltaSeconds` | `this.velocity += gravity * clock.deltaSeconds` |
| GLTF animation mixer | `effectiveDeltaSeconds` | `mixer.update(effectiveDeltaSeconds)` |
| Widget-internal custom | `clock.wallTimeSeconds` | NeonSign pulse, procedural shaders |

**Tab visibility safety**: `clock.wallTimeSeconds = nowMs / 1000` picks up continuously
from wherever time is — no delta accumulation, no backlog when tabs are hidden. An
oscillation at `sin(clock.wallTimeSeconds × 2π × 0.5)` resumes at exactly the right
phase. A `localTime` accumulator would have jumped forward by the tab's hidden duration.

### NeonSign widget specifically

The NeonSign computes `sin(wallTimeSeconds * 1.7) * 0.06` in `render.ts` (in the
`apply()` call, via `WidgetRenderContext`). After this change, it uses
`ctx.clock.wallTimeSeconds` instead. Behavior: **identical**. The NeonSign's pulse is
and remains real-time, synchronized with the single RAF clock, and completely unaffected
by `effectiveDeltaSeconds` or auto-advance.

---

## Composition: All Three Features Together

```tsx
<Scene id="website-hero-00">
  <ProgressManager
    scrollUnits={1800}
    autoAdvance={{ duration: 8, max: 0.80, pauseOnScroll: true }}
    animationTimeScale={4}
  />
  {/* ... */}
</Scene>
```

**While idle:**
- `autoAdvance` fires: `deltaProgress ≈ deltaSeconds × 0.80 × segmentWidth / 8` → tiny
- `animBoost = tiny × 4` → negligible (< `deltaSeconds`)
- `effectiveDeltaSeconds = deltaSeconds` → all animations play at 1× real-time ✓
- `rawProgress` slowly increases → hero overlay content drives via `blockProgress` ✓

**User scrolls at moderate speed** (traverses scene window in ~6s):
- `deltaProgress ≈ 0.003/frame`
- `animBoost = 0.003 × 4 = 0.012s`
- `effectiveDeltaSeconds = max(0.017, 0.012) = 0.017` → still essentially real-time
- For `animationTimeScale = 20` (high): `0.003 × 20 = 0.06s` → ~3.5× real-time ✓

**User swipes fast** (traverse in ~1s):
- `deltaProgress ≈ 0.017/frame`
- `animBoost = 0.017 × 4 = 0.068s` → ~4× real-time
- Capped at `maxBoostPerFrame = 0.2s` if `animationTimeScale` is higher ✓

**Nav link jump** (instantaneous, `deltaProgress = 0.35`):
- `animBoost = 0.35 × 4 = 1.4s` → capped to `0.2s` by `maxBoostPerFrame` ✓

**Stopping scroll:**
- `deltaProgress = 0`
- `effectiveDeltaSeconds = deltaSeconds` → immediately back to real-time ✓
- If `pauseOnScroll: false`, `autoAdvance` resumes from current position ✓

---

## Design Decisions

### Why `duration` not `rate`

`rate` (progress per second) requires the author to reason about normalized [0..1]
progress space and how a scene's `scrollUnits` affects the effective rate. `duration`
(seconds) is a direct statement: "play this in N seconds while idle." The system converts
to the appropriate raw rate internally using the segment's normalized width.

### Why `animationTimeScale` is scene-wide, not per-model

`animationTimeScale` is a statement about **temporal character of the scene**, not about
an individual animation clip. Multiple models in a scene (meeting scene: 30 models) must
respond coherently — per-model settings would desynchronize them with no benefit.

Widgets that manage their own time (NeonSign via `clock.wallTimeSeconds`) are
automatically unaffected — they never consult `effectiveDeltaSeconds`. No per-widget
opt-out prop is needed today. If an edge case emerges (a specific model that must NOT
respond to scroll speed), add `<Model animationTimeScale={false}>` as an escape hatch
at that point, not preemptively.

### Why no separate RAF loop for real-time widgets

A second RAF loop would run at a slightly different cadence than `RuntimeLoop`, causing
frame-to-frame desync between scroll-driven and time-driven renders. `clock.wallTimeSeconds`
is computed from `performance.now()` once per frame at the top of `RuntimeLoop.runStep()`
and passed to every widget. All widgets see the same value. Synchronization is guaranteed
at zero additional cost.

### Why auto-advance lives in the input/progress layer, not RuntimeLoop

`RuntimeLoop` only reads `getGlobalProgress()` (engine/post-mapper progress). Auto-advance
must write to `rawProgress` (pre-mapper) so that `SceneProgressMapper` correctly translates
it to engine progress. The input/progress layer (`useEngineInput` / `useEngineScroll`)
owns `rawProgress` and `scrollToProgress`, so auto-advance belongs there.
`RuntimeLoop` provides the tick cadence via `onAfterTick`; the player layer does the work.

---

## Data Model Changes

### `ProgressManagerSpec` additions

```typescript
export type ProgressManagerSpec = {
  scrollUnits: number;
  fn: (localT: number) => number;
  autoAdvance?: {
    duration: number;        // seconds to traverse 0→max while idle
    max: number;             // default 1.0; fraction of scene window
    pauseOnScroll: boolean;  // default true
  };
  animationTimeScale?: number;  // total anim-seconds for scrolling 0→1; undefined = 1× always
};
```

### `SceneProgressSegment` additions

```typescript
export type SceneProgressSegment = {
  sceneIndex: number;
  rawStart: number;
  rawEnd: number;
  engineStart: number;
  engineEnd: number;
  fn: (localT: number) => number;
  // NEW:
  autoAdvance?: {
    rawRate: number;         // pre-computed: (max × (rawEnd - rawStart)) / duration
    maxRaw: number;          // pre-computed: rawStart + max × (rawEnd - rawStart)
    pauseOnScroll: boolean;
  };
  animationTimeScale?: number;
};
```

`rawRate` and `maxRaw` are pre-computed at compile time (in `buildProgressProfile`) so
the auto-advance hot path does no division.

### `RealtimeClock` (new type, `packages/core/src/runtime/types.ts`)

```typescript
export type RealtimeClock = {
  wallTimeSeconds: number;
  deltaSeconds: number;
};
```

### `AnimationTickContext` changes (`packages/core/src/widget/types.ts`)

Remove flat `deltaSeconds` and `wallTimeSeconds`. Add `clock: RealtimeClock` and
`effectiveDeltaSeconds: number`.

### `WidgetRenderContext` changes (`packages/core/src/widget/types.ts`)

Same: remove flat `deltaSeconds` and `wallTimeSeconds`. Add `clock: RealtimeClock` and
`effectiveDeltaSeconds: number`.

### `RuntimeDriver.tick()` signature change (`packages/core/src/runtime/types.ts`)

```typescript
tick(options: {
  deltaSeconds: number;
  globalProgress: number;
  deltaProgress: number;       // NEW
  wallTimeSeconds?: number;
}): void;
```

### `UseSceneEngineResult` additions (`packages/core/src/player/useSceneEngine.ts`)

```typescript
setAutoAdvancePaused(paused: boolean): void;
```

### `UseEngineScrollResult` additions (`packages/core/src/player/useEngineScroll.ts`)

```typescript
getRawProgress(): number;   // pre-mapper raw progress
```

---

## Files Affected

| File | Change |
|---|---|
| `packages/core/src/compiler/sceneTrackTypes.ts` | Add `autoAdvance?` and `animationTimeScale?` to `ProgressManagerSpec`; add pre-computed fields to `SceneProgressSegment` |
| `packages/core/src/compiler/sceneTrackCompiler.ts` | `buildProgressProfile` computes `rawRate`, `maxRaw` per segment |
| `packages/core/src/runtime/types.ts` | Add `RealtimeClock`; add `deltaProgress` to `RuntimeDriver.tick()` signature |
| `packages/core/src/runtime/RuntimeDriver.ts` | Change tick order (sample first); compute `effectiveDeltaSeconds`; pass `clock` to contexts; remove flat `deltaSeconds`/`wallTimeSeconds` from contexts |
| `packages/core/src/runtime/RuntimeLoop.ts` | Track `prevGlobalProgress`; compute `deltaProgress`; pass to `driver.tick()` |
| `packages/core/src/widget/types.ts` | Add `RealtimeClock` to `AnimationTickContext` and `WidgetRenderContext`; add `effectiveDeltaSeconds` to both; remove flat fields |
| `packages/core/src/player/useEngineScroll.ts` | Expose `getRawProgress()` |
| `packages/core/src/player/useEngineInput.ts` | Thread `getRawProgress()` through |
| `packages/core/src/player/useSceneEngine.ts` | Add auto-advance state machine in `onAfterTick`; expose `setAutoAdvancePaused()` |
| `packages/core/src/player/EngineContext.tsx` | Add `setAutoAdvancePaused()` to context value type |
| `packages/core/src/compiler/primitives/progressManager.ts` | Add `autoAdvance` and `animationTimeScale` to `ProgressManagerProps` and handler |
| All `IAnimationController` widgets | Update `onTick()` to use `context.effectiveDeltaSeconds` for mixer; `context.clock.deltaSeconds` for real-time effects |
| All `IRenderable` widgets using time | Update `apply()` to use `context.clock.wallTimeSeconds` |
| `packages/core/src/runtime/mocks/` | Update test doubles for new `tick()` signature and context shapes |
| `apps/website/src/widgets/neon-sign/render.ts` | Update to `ctx.clock.wallTimeSeconds` |

**No changes to:** `SceneTrack.ticks[]`, `sceneTrackSampler.ts`, `ScenePlayer` public props,
`@brewsite/diagram`, any scene DSL files (except website hero migration below).

---

## Hero Screen Migration

Independently of auto-advance, the hero screen's overlay should be migrated from CSS
`@keyframes` to BrewSite overlay content. This is the prerequisite that makes
auto-advance actually work for the hero — otherwise the overlay timing is still divorced
from `blockProgress`.

**Replace** `hero.css` `animation-delay: 3.6s, 3.9s, 4.2s` on `.hero-content--below-sign`
with BrewSite `<Fade>` / `<SlideUp>` wrappers on the overlay divs inside `scene_00_hero.tsx`.
These presets respond to `blockProgress`, which is now driven by either scroll or
auto-advance interchangeably.

The `ScrollIndicator` CSS animation (`fade-up` at 4.2s) should similarly be replaced with
a `<Fade>` wrapper at a `blockProgress` threshold that matches the original timing intent.

After migration, the hero scene `<ProgressManager>` looks like:

```tsx
<ProgressManager
  scrollUnits={1800}
  autoAdvance={{ duration: 8, max: 0.80, pauseOnScroll: true }}
  animationTimeScale={3}
/>
```

And the overlay content uses BrewSite animation presets:

```tsx
<Fade duration={600}>
  <div className="hero-content--below-sign">
    <h2>Author in JSX, ship to any surface</h2>
    {/* badges */}
  </div>
</Fade>
<Fade duration={400} delay={200}>
  <ScrollIndicator />
</Fade>
```

The CSS `animation-delay` values (3.6s, 4.2s) are no longer needed — the `<Fade>` presets
fire when `blockProgress` enters the transition, which is now driven by auto-advance
timing (`duration: 8, max: 0.80` → the reveal happens at `blockProgress ≈ 0.4`, which is
`8 × 0.4 = 3.2 seconds` into idle playback — close to the original 3.6s timing).

---

## Open Questions for Architect Review

1. **Auto-advance and `ScrollCaptureSection` mode**: In `ScrollCaptureSection` mode,
   `setRawProgress(raw)` is used instead of `window.scrollTo()`. The auto-advance path
   calls `scrollToProgress()` today. Does the auto-advance logic need to be aware of which
   scroll mode is active, or can it always go through a unified `setProgress(raw)` abstraction?

2. **`deltaProgress` sign on backward navigation**: If the user scrolls backward
   (returning to a previous scene), `deltaProgress` is negative. Should `effectiveDeltaSeconds`
   respond to backward progress (i.e., `abs(deltaProgress)`)? Or should backward navigation
   always use `deltaSeconds` (1× real-time)? Symmetric behavior (abs) is simpler but
   may feel odd on reverse scroll. Asymmetric (no boost on backward) is more deliberate.
   Recommendation: use `Math.max(0, deltaProgress)` — forward scroll boosts, backward
   does not.

3. **Tick order change and existing widget behavior**: Moving SceneTrack sampling to step 1
   means animation controllers now receive the state of the scene they're currently in,
   not the scene they were in last frame. Are there any known `IAnimationController`
   widgets that relied on the old order for transition blending? The architect should audit
   `ModelWidget`, `CameraWidget`, and `DiagramCanvasWidget`.

4. **`autoAdvance` and multiple `SceneCanvas` instances**: If two `EngineProvider`
   instances are on the same page, each has independent auto-advance state. This is correct.
   Confirm that `setAutoAdvancePaused()` is scoped to the engine instance, not global.

5. **Compile warning for `autoAdvance` on last scene**: Like `scrollUnits`, `autoAdvance`
   on the last scene has no effect (no outgoing transition window). Emit `PROGRESS_MANAGER`
   compile warning.

6. **`maxBoostPerFrame` configurability**: Start as a hardcoded constant (`0.2s`). If use
   cases emerge where authors need more or less headroom, expose as an optional
   `<ProgressManager maxAnimBoostPerFrame={n}>` prop. Do not pre-build this.
