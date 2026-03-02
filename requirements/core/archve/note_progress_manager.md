---
title: "ProgressManager — Per-Scene Scroll Weighting and Input Curve"
doc_type: note
owner: Toolkit Product
status: draft
updated: 2026-02-28
---

# ProgressManager — Feature Note

## Purpose

This note describes the design of the `<ProgressManager>` DSL element for `@brewsite/core`.
It is intended for architect review before a formal implementation plan is written.

---

## Problem

Today, every scene in a `<ScenePlayer>` consumes an equal share of the global scroll
(or input) domain. This is fine for uniform cinematic sequences but wrong for narrative
or documentation layouts where different scenes have fundamentally different "reading
weights." A quick cinematic act-header cut should not consume the same scroll real estate
as a 3000px content panel the user needs to read. There is also no way to control the
input pacing curve within a scene's window — if you want the 3D animation to ease in
slowly at the start of a scene and race through the end, there is no mechanism for it
today other than `transition.easing`, which remaps the visual interpolation but not the
input mapping.

The existing `pixelsPerScene` option on `ScenePlayer` gives a single global pixel budget
per scene. It is a blunt instrument and does not scale to mixed-weight scene layouts.

---

## Solution: `<ProgressManager>`

`<ProgressManager>` is a new DSL child element, declared inside `<Scene>`, that gives each
scene two independent controls over how it consumes raw input progress:

1. **`scrollUnits`** — how much of the raw input domain this scene's outgoing transition
   claims relative to all other scenes.
2. **`fn`** — a curve that remaps local input progress `[0..1]` to local engine progress
   `[0..1]` within that scene's window, allowing non-linear pacing inside a single scene's
   scroll budget.

Neither property is required. Both carry forward via merge semantics (the same model used
by `<InputController>` today). When no `<ProgressManager>` has ever been declared, the
system behaves exactly as it does today — all scenes receive equal weight, all curves are
identity. Existing consumers require zero changes.

---

## Authoring Surface

```tsx
// Minimum: just control how much scroll this scene consumes
<Scene id="installation">
  <ProgressManager scrollUnits={2400} />
  <Camera type="world" position={[0, 2, 8]} />
  <Background color="#0a0a14" />
</Scene>

// Full: custom budget AND a custom curve within the window
<Scene id="features">
  <ProgressManager
    scrollUnits={1800}
    fn={(t) => easeInOutCubic(t)}
  />
  <Camera type="world" position={[2, 1, 6]} />
</Scene>

// Short cinematic — low budget, default linear curve
<Scene id="act2-header">
  <ProgressManager scrollUnits={400} />
  <Background color="#050510" />
</Scene>

// No ProgressManager — inherits previous scene's scrollUnits and fn via merge
<Scene id="outro">
  <Camera type="world" position={[0, 0, 10]} />
</Scene>
```

---

## The Two Properties

### `scrollUnits: number` (default: 1)

A positive number declaring how much of the total raw input domain this scene's outgoing
transition consumes. Units are proportional, not absolute pixels. The engine normalizes all
declared units across all scenes so they always sum to a [0..1] raw input domain.

A scene with `scrollUnits={2400}` and a neighbor with `scrollUnits={400}` means the first
scene's transition window is 6× wider in raw input space than the second. The concrete
pixel mapping is left to the consuming application — `ScenePlayer`'s `pixelsPerScene` prop
(or the engine's total scroll height calculation) controls how many physical pixels the
total raw domain spans. `scrollUnits` controls the proportional split.

`scrollUnits` declared on the **last scene** in the track has no effect and produces a
compile-time warning. The last scene has no outgoing transition.

### `fn: (localT: number) => number` (default: `t => t`)

A pure function that remaps input progress within the scene's window. The input `localT`
is the normalized position within this scene's raw scroll window: `0` at the start of the
window, `1` at the end. The output is the normalized engine progress within this scene's
engine window: `0` at the start of this scene's transition, `1` at the end.

**Hard constraints on `fn`:**

- `fn(0) === 0` — must start at 0
- `fn(1) === 1` — must end at 1
- Continuous — no jumps or discontinuities
- Monotonically non-decreasing — output never goes backward

The system does not validate these constraints at compile time. Violations produce
undefined behavior in the mapper. The constraint is the author's responsibility, and the
PRD should document this clearly. A developer-mode runtime validation step can be added
later.

**What `fn` enables:**

A curve that maps `0..0.5 → 0..0.9` and `0.5..1 → 0.9..1` means 50% of the scroll input
covers 90% of the 3D animation, and the remaining 50% of input covers only the last 10% of
the animation. The 3D scene slows dramatically in the second half of the scroll window —
effectively a "dwell" at the end of the scene without any discrete freeze zone.

This is fully continuous and fully invertible (assuming a strictly increasing `fn`). It
composes naturally with `transition.easing` on the same scene, which controls visual
interpolation pacing independent of scroll input pacing.

---

## Merge Semantics

`<ProgressManager>` follows the same carry-forward model as `<InputController>`. If scene N
declares a `<ProgressManager>`, its `scrollUnits` and `fn` are both stored in the compiled
`SceneFrame` for scene N. If scene N+1 does not declare a `<ProgressManager>`, the
compiler carries forward scene N's values. The ultimate default (when no scene has ever
declared one) is `{ scrollUnits: 1, fn: t => t }`.

This means an author can set a default at scene 0 and override only where needed, or
declare nothing at all to get the current uniform linear behavior.

---

## Data Model

### `ProgressManagerSpec` (new, lives in `sceneTrackTypes.ts`)

```typescript
export type ProgressManagerSpec = {
  scrollUnits: number;
  fn: (localT: number) => number;
};
```

This is the per-scene spec stored in `SceneFrame`:

```typescript
// Addition to SceneFrame (sceneTrackTypes.ts):
progressManager?: ProgressManagerSpec;
```

### `SceneProgressSegment` (new)

One segment per outgoing transition gap. There are N-1 segments for N scenes.

```typescript
export type SceneProgressSegment = {
  sceneIndex: number;     // scene i — this segment is the i → i+1 transition
  // Raw input window for this segment, in normalized [0..1] space
  rawStart: number;       // sum of normalizedWeight[0..i-1]
  rawEnd: number;         // rawStart + normalizedWeight[i]
  // Engine progress window (always uniform — the tick array is unchanged)
  engineStart: number;    // i / (sceneCount - 1)
  engineEnd: number;      // (i + 1) / (sceneCount - 1)
  // The pacing curve for this segment
  fn: (localT: number) => number;
};
```

### `SceneProgressProfile` (new, added to `SceneTrack`)

```typescript
export type SceneProgressProfile = {
  segments: SceneProgressSegment[];
  // Optimization flags — skip mapper construction entirely when unnecessary
  isUniform: boolean;    // true when all scrollUnits are equal AND all fn are identity
};

// Addition to SceneTrack (sceneTrackTypes.ts):
progressProfile?: SceneProgressProfile;
```

`progressProfile` is `undefined` when no scene has declared a `<ProgressManager>`. When
undefined, the engine uses identity mapping and the existing linear behavior is preserved
exactly.

---

## The SceneProgressMapper

A new pure utility class: `packages/core/src/player/SceneProgressMapper.ts`.

This class is instantiated once in `useSceneEngine` when `sceneTrack.progressProfile` is
present. It is passed down to the input layer. It has no side effects, holds no mutable
state, and is fully testable in isolation.

```typescript
export class SceneProgressMapper {
  constructor(private readonly profile: SceneProgressProfile) {}

  // Hot path — called every frame via getGlobalProgress()
  remap(rawProgress: number): number { ... }

  // Cold path — called only from scrollToProgress() (user navigation)
  inverse(engineProgress: number): number { ... }
}
```

### `remap` algorithm (hot path, called every frame)

```
1. Clamp rawProgress to [0..1]
2. Find segment i where rawStart_i <= rawProgress <= rawEnd_i
   (Linear scan is fine — scene counts are small, typically < 20)
3. Normalize to local:
     localT = (rawProgress - rawStart_i) / (rawEnd_i - rawStart_i)
4. Apply curve:
     localEngine = segment_i.fn(localT)
5. Denormalize to global engine progress:
     return engineStart_i + localEngine * (engineEnd_i - engineStart_i)
```

Edge cases: `rawProgress === 0` maps to segment 0, `localT = 0`. `rawProgress === 1` maps
to the last segment, `localT = 1`. Both produce `fn(0) = 0` and `fn(1) = 1` by constraint.

### `inverse` algorithm (cold path, called from `scrollToProgress`)

Used when programmatic navigation sets a target engine progress (e.g., clicking a sidebar
nav link that calls `scrollToProgress(scene.globalProgressStart)`). Must return the raw
input position that corresponds to that engine progress, accounting for the curve.

```
1. Clamp engineProgress to [0..1]
2. Find segment i where engineStart_i <= engineProgress <= engineEnd_i
3. Normalize to local engine:
     localEngine = (engineProgress - engineStart_i) / (engineEnd_i - engineStart_i)
4. Invert the curve to find localT:
     if fn is identity: localT = localEngine
     else: binary search on [0..1] for localT such that fn(localT) ≈ localEngine
           tolerance: 1e-5, max iterations: 20 (always converges for monotonic fn)
5. Denormalize back to raw:
     return rawStart_i + localT * (rawEnd_i - rawStart_i)
```

Binary search is acceptable here because `inverse` is never called in the render loop. It
is only called when the user clicks a navigation control or the engine programmatically
sets progress.

---

## Compiler Changes

### New DSL node handler: `<ProgressManager>`

A new `NodeHandler` registered in the same way as `<Background>`, `<Camera>`, etc.:

```typescript
// packages/core/src/compiler/primitives/progressManager.ts

export const ProgressManager = (props: {
  scrollUnits?: number;
  fn?: (localT: number) => number;
}): null => null;
ProgressManager.displayName = 'ProgressManager';

const progressManagerHandler: NodeHandler = (node, api) => {
  const props = node.props as {
    scrollUnits?: number;
    fn?: (localT: number) => number;
  };
  api.state.progressManager = {
    scrollUnits: Math.max(0.001, props.scrollUnits ?? 1),
    fn: props.fn ?? ((t: number) => t),
  };
};

registerNode(ProgressManager, progressManagerHandler);
```

The handler writes directly to `api.state.progressManager`. No widget slot is used. This
is compile-only metadata, not a runtime widget.

### `sceneTrackCompiler.ts` — new aggregation pass

After all scene snapshots are compiled and before the tick array is filled, a new pass
builds the `SceneProgressProfile`:

```
1. For each scene i (0..N-1):
   - Resolve progressManager via merge semantics:
     if snapshots[i].progressManager is defined, use it
     else use the last defined progressManager (searching backwards)
     else use default { scrollUnits: 1, fn: t => t }

2. Compute normalizedWeights for each outgoing transition (i = 0..N-2):
   totalUnits = sum(resolvedScrollUnits[0..N-2])
   normalizedWeight[i] = resolvedScrollUnits[i] / totalUnits

3. Build segments (i = 0..N-2):
   rawStart[0] = 0
   rawEnd[i] = rawStart[i] + normalizedWeight[i]
   rawStart[i+1] = rawEnd[i]
   engineStart[i] = i / (N-1)
   engineEnd[i] = (i+1) / (N-1)
   fn[i] = resolvedFn[i]

4. Determine isUniform:
   true if all normalizedWeights are equal AND all fn are identity (referential check)

5. If snapshots[N-1].progressManager is defined:
   emit compile warning: "ProgressManager on the last scene has no effect (no outgoing transition)"

6. If isUniform:
   do NOT attach progressProfile to SceneTrack (undefined = identity = current behavior)
   else:
   attach progressProfile to SceneTrack
```

The `isUniform` check ensures that the mapper is never instantiated for the common case
where no `<ProgressManager>` has been declared. Zero overhead for all existing consumers.

---

## Player Layer Changes

### `useSceneEngine.ts`

After `sceneTrack` is resolved:

```typescript
const progressMapper = useMemo(() => {
  if (!sceneTrack?.progressProfile) return null;
  return new SceneProgressMapper(sceneTrack.progressProfile);
}, [sceneTrack]);
```

The `scrollRegionHeightPx` calculation gains awareness of `scrollUnits`:

```typescript
const scrollRegionHeightPx = useMemo(() => {
  if (inputMode === 'direct') return Math.max(1, viewportHeight);

  const sceneCount = Math.max(1, options.scenes.length);
  const basePixels = options.pixelsPerScene !== undefined
    ? options.pixelsPerScene * sceneCount
    : Math.max(1, viewportHeight + (Math.max(0, sceneCount - 1) * blockSize));

  if (!sceneTrack?.progressProfile || sceneTrack.progressProfile.isUniform) {
    return basePixels;
  }

  // Non-uniform: scale each segment by its normalized weight
  // Total pixel budget stays the same; proportions change.
  // The mapper handles the non-linear mapping — the spacer just needs to be
  // tall enough that the raw [0..1] domain spans a usable scroll range.
  // No additional height calculation is needed here; the mapper remaps within
  // the existing raw domain.
  return basePixels;
}, [inputMode, options.pixelsPerScene, options.scenes.length, blockSize, viewportHeight, sceneTrack]);
```

**Important:** The `scrollRegionHeightPx` does NOT change with non-uniform weights. The
mapper handles the proportional split entirely within the existing [0..1] raw domain. The
spacer height determines the total raw domain size; the mapper remaps within it. This is
correct because the raw progress is always `scrollY / spacerHeight`, and the mapper takes
that [0..1] value and remaps it. No spacer adjustment is needed.

`progressMapper` is passed into `useEngineInput`:

```typescript
const { progress, scrollToProgress, getGlobalProgress } = useEngineInput({
  // ... existing options ...
  progressMapper,
});
```

### `useEngineInput.ts`

Receives `progressMapper?: SceneProgressMapper | null`. Passes it through to
`useEngineScroll` in scroll mode. Applies it in direct mode.

```typescript
// New option:
progressMapper?: SceneProgressMapper | null;
```

In scroll mode, `progressMapper` is forwarded to `useEngineScroll`. In direct mode
(ActionInputController), the mapper is applied to the accumulated `directProgress` before
it is returned:

```typescript
// Direct mode return path:
if (hasSceneController) {
  return {
    progress: progressMapper ? progressMapper.remap(directProgress) : directProgress,
    scrollToProgress: (target) => {
      const raw = progressMapper ? progressMapper.inverse(target) : target;
      setDirectProgressBoth(raw);
    },
    getGlobalProgress: () => {
      const raw = directProgressRef.current;
      return progressMapper ? progressMapper.remap(raw) : raw;
    },
  };
}
```

In controlled mode, the mapper is NOT applied. The controlled-progress owner provides
semantic engine progress directly. Applying the mapper would require the owner to reason
in raw input space, which is the wrong contract for programmatic control.

### `useEngineScroll.ts`

The mapper is applied in `computeProgress` and inverted in `scrollToProgress`:

```typescript
export type UseEngineScrollOptions = {
  scrollRegionRef: RefObject<HTMLElement | null>;
  scrollRegionHeightPx: number;
  progressMapper?: SceneProgressMapper | null;  // NEW
};

// In computeProgress:
const rawProgress = clamp01((scrollTop - regionTop) / maxScroll);
return progressMapper ? progressMapper.remap(rawProgress) : rawProgress;

// In scrollToProgress:
const rawTarget = progressMapper ? progressMapper.inverse(clamp01(next)) : clamp01(next);
const target = regionTop + rawTarget * maxScroll;
window.scrollTo({ top: target });
```

This is the only place the mapper touches `scrollY`. The `getGlobalProgress` ref holds the
mapped (engine) progress, which is correct because all downstream consumers — the runtime
driver, the tick sampler, the frame state — work in engine progress space.

---

## What Does Not Change

The following are explicitly unchanged:

- `SceneTrack.ticks[]` — remains a uniform flat array. The tick sampler is untouched.
- `sceneTrackSampler.ts` — untouched.
- `RuntimeDriver.tick()` — receives engine progress as always.
- All widget rendering — no widget is aware of the mapper.
- `ScenePlayer` public props — no new required props.
- All existing consumers — zero behavior change when no `<ProgressManager>` is declared.

---

## Key Invariants

1. The mapper is the **only** place non-linear progress exists. Nothing downstream of
   `getGlobalProgress()` knows or cares that the progress was remapped.

2. The tick array remains **uniform**. Changing tick spacing would break `O(1)` sampling
   and invalidate the content-hash cache. It must never change.

3. `fn(0) === 0` and `fn(1) === 1` are required for scene continuity. If either is
   violated, adjacent scenes will have a visible snap at their boundary.

4. Merge semantics apply to the **entire** `<ProgressManager>` value as a unit. You cannot
   merge `scrollUnits` from one scene and `fn` from another — the full spec carries forward
   together. If you want to change only `scrollUnits`, you must re-declare `fn` as well.

5. `progressProfile` is **undefined** (not present) on `SceneTrack` when the feature is
   unused. The mapper is **never instantiated** in that case. Existing consumers pay zero
   cost.

6. `SceneProgressMapper.remap()` is called **every frame** from the render loop via
   `getGlobalProgress()`. It must be O(N) where N = scene count. Linear scan over segments
   is acceptable; N is always small in practice.

7. `SceneProgressMapper.inverse()` is called only from `scrollToProgress()` — a
   user-triggered event. Binary search with 20 iterations is acceptable.

---

## Files Affected

| File | Change |
|---|---|
| `packages/core/src/compiler/sceneDslCompiler.ts` | Add `ProgressManager` component + handler; export from compiler index |
| `packages/core/src/compiler/sceneTrackCompiler.ts` | Add aggregation pass; build `SceneProgressProfile`; attach to `SceneTrack` |
| `packages/core/src/compiler/sceneTrackTypes.ts` | Add `ProgressManagerSpec`, `SceneProgressSegment`, `SceneProgressProfile`; add `progressManager?` to `SceneFrame`; add `progressProfile?` to `SceneTrack` |
| `packages/core/src/player/SceneProgressMapper.ts` | New file — pure mapper class |
| `packages/core/src/player/useSceneEngine.ts` | Create `SceneProgressMapper` from track; pass to `useEngineInput` |
| `packages/core/src/player/useEngineInput.ts` | Accept `progressMapper`; apply in direct mode; forward to scroll hook |
| `packages/core/src/player/useEngineScroll.ts` | Accept `progressMapper`; apply in `computeProgress`; invert in `scrollToProgress` |
| `packages/core/src/compiler/index.ts` | Export `ProgressManager` component |

No other files require changes. No new packages, dependencies, or peer deps.

---

## Open Questions for Architect Review

1. **Merge semantics granularity.** The note specifies that the full `ProgressManagerSpec`
   carries forward as a unit. Is there a case for per-property merge (carry `scrollUnits`
   independently of `fn`)? This would require storing them as two separate fields on
   `SceneFrame` rather than one object.

2. **`fn` serialization and caching.** The `sceneTrackCache` uses a content-hash key. A
   function reference in `SceneFrame.progressManager.fn` will always produce a cache miss
   since function identity changes on every render. The architect should determine whether
   the track cache key needs to exclude `progressManager.fn` (treating it as always-dirty)
   or whether the cache should be bypassed when a `fn` is declared.

3. **Direct mode semantics.** The note applies the mapper in direct mode (wheel/drag). This
   means the author's `scrollUnits` affects how much wheel/drag input is needed to advance
   through each scene. Confirm this is desirable, or whether direct mode should always use
   identity mapping.

4. **Last-scene warning.** The note specifies a compile warning when `<ProgressManager>` is
   declared on the last scene. Is a warning sufficient, or should the value be silently
   ignored without warning?

5. **`fn` validation.** The note leaves constraint validation to the author. Should the
   compiler sample `fn(0)` and `fn(1)` and emit a warning if they are not approximately 0
   and 1? This is cheap and would catch common mistakes early.