---
title: "ProgressManager — Per-Scene Scroll Weighting and Input Curve"
doc_type: plan
owner: brewflow-architect
status: complete
updated: 2026-03-01
---

# ProgressManager — Implementation Plan

## 0. Background and Motivation

Every scene in a `<ScenePlayer>` today claims an equal share of the global scroll domain.
`pixelsPerScene` provides a single global pixel budget — it is a blunt instrument that
cannot express the reality of a mixed-weight scene sequence: a 400px cinematic act header
should not consume the same scroll depth as a 2400px content section the user needs to
read. There is also no mechanism for non-linear pacing within a scene's scroll window — no
way to say "play the 3D animation in the first 25% of scroll, then hold the final pose
while the reader finishes the content."

The PM note (`note_progress_manager.md`) described the solution. This plan provides the
complete implementation specification, answers the five open architect questions, and
includes the full test strategy.

---

## 1. Architect Decisions on Open Questions

### Q1 — Merge semantics granularity: full-spec or per-property?

**Decision: Full-spec carry-forward. `scrollUnits` and `fn` always travel together.**

`scrollUnits` and `fn` are semantically coupled. A curve calibrated for 2400px of scroll
becomes meaningless (or wrong) if applied to a scene that subsequently declares
`scrollUnits={400}`. If the values merged independently, an author changing `scrollUnits`
on a later scene might unknowingly inherit a `fn` written for a completely different
budget, producing unexpected pacing with no obvious cause.

Practical cost is low: the default `fn` is `t => t` (identity). Changing only
`scrollUnits` on a scene requires `<ProgressManager scrollUnits={N} />` — no `fn`
needed. The identity is re-declared implicitly because the default for the field is
identity. Changing only `fn` while keeping a prior `scrollUnits` requires declaring both
explicitly. This is the acceptable trade-off.

Store both fields as a single `ProgressManagerSpec` object on `SceneFrame`. The carry-
forward pass copies the entire object, never individual fields.

### Q2 — `fn` serialization and the compile cache

**Decision: Include `fn.toString()` in the cache key per scene.**

The scene track cache key is a content hash of the DSL. Function references produce a new
identity on every render, which would force a cache miss every time. `fn.toString()`
returns the function's source text, which is stable for inline arrow functions and named
function references across renders.

This is safe because `fn` must be a pure curve function — it must not close over external
mutable state (doing so would violate the `fn(0) === 0`, `fn(1) === 1` constraints or
produce non-deterministic output). The function validation step (Q5 below) guards against
pathological closures at compile time.

**Implementation:** In `sceneTrackCompiler.ts`, when building the cache key string,
for each scene that has a `progressManager.fn` declared, append `fn.toString()` to the
key segments. Scenes with no `<ProgressManager>` contribute nothing to the key (zero
overhead for the common case).

Do not attempt to serialize `fn` into `SceneTrack` itself. The `fn` reference lives in
the `ProgressManagerSpec` on `SceneFrame`, which is an in-memory structure. The compiled
`SceneTrack.progressProfile.segments[i].fn` holds a reference to the same function object.
This is correct — `SceneTrack` is never serialized to disk or transferred across workers.

### Q3 — Direct mode semantics: apply mapper or skip it?

**Decision: Apply the mapper in scroll mode and in direct mode (wheel/drag via
`ActionInputController`). Do NOT apply it in controlled-progress mode.**

In scroll mode and direct mode, `scrollUnits` expresses relative input effort — how much
user input is required to advance through a scene's transition. This applies equally to
scroll events and wheel/drag events. A cinematic cut with `scrollUnits={400}` should
respond to less wheel input than a content scene with `scrollUnits={2400}`. The `fn`
curve also applies in direct mode — a scene that dwells (fast animation, slow rest) should
behave consistently regardless of which input device drove it there.

In controlled-progress mode, the owner of the `controlledProgress` prop provides semantic
engine progress in `[0, 1]` space directly. They are not operating in raw input space.
Applying the mapper would require the owner to reason about the raw input domain, which
breaks the controlled-progress contract. The mapper is a translation layer between
physical input and engine progress; a controlled-progress owner has already crossed that
boundary.

The mapper is therefore applied in `useEngineScroll` (scroll mode) and in the direct-mode
return path of `useEngineInput` (wheel/drag), and explicitly skipped in the controlled-
progress return path.

### Q4 — Last-scene `<ProgressManager>` declaration: warn or silent ignore?

**Decision: Emit a compile warning via `onCompileWarning`. Do not silently ignore. Store
the value in `SceneFrame` but exclude it from the aggregation pass.**

Silent ignore is the wrong behavior. An author who declares `<ProgressManager
scrollUnits={2400} />` on the last scene made a mistake and expects it to do something.
Ignoring it silently leaves them debugging phantom behavior with no feedback.

The compile warning text must be actionable:

```
ProgressManager declared on the last scene ("<sceneId>") has no effect.
The last scene has no outgoing transition, so scrollUnits and fn are unused.
Remove the <ProgressManager> from this scene, or declare it on the
second-to-last scene if you want to control that transition's weight.
```

This warning is emitted through the existing `onCompileWarning` callback on `ScenePlayer`
and `EngineProvider`. It surfaces in the browser console during development and is
available to tooling. The value is stored in `SceneFrame.progressManager` as normal — the
aggregation pass simply skips scene N-1 when building segments, which is correct because
there is no segment i → N-1 → N.

### Q5 — `fn` validation at compile time: sample and warn?

**Decision: Yes. Sample `fn` at five points at compile time and emit actionable warnings
on constraint violations.**

The constraints `fn(0) === 0` and `fn(1) === 1` are hard requirements for scene
continuity. A violation causes a visible snap at a scene boundary — a direct product bug.
The monotonicity constraint prevents the animation from playing backward mid-transition.
All three are cheap to check (five function calls total) and catching them at compile time
prevents runtime artifacts that are difficult to diagnose.

**Validation implementation** (in the aggregation pass in `sceneTrackCompiler.ts`):

```typescript
function validateProgressFn(
  fn: (t: number) => number,
  sceneId: string,
  sceneIndex: number,
): CompileWarning[] {
  const warnings: CompileWarning[] = [];
  const tol = 0.001;

  const v0 = fn(0);
  if (Math.abs(v0) > tol) {
    warnings.push({
      code: 'PROGRESS_MANAGER',
      message: `ProgressManager fn on scene "${sceneId}" violates fn(0) === 0 (got ${v0.toFixed(4)}). ` +
               `Scene boundaries will snap. Ensure your curve starts at 0.`,
      sceneIndex,
    });
  }

  const v1 = fn(1);
  if (Math.abs(v1 - 1) > tol) {
    warnings.push({
      code: 'PROGRESS_MANAGER',
      message: `ProgressManager fn on scene "${sceneId}" violates fn(1) === 1 (got ${v1.toFixed(4)}). ` +
               `Scene boundaries will snap. Ensure your curve ends at 1.`,
      sceneIndex,
    });
  }

  // Monotonicity: sample at 0.25, 0.5, 0.75
  const samples = [fn(0.25), fn(0.5), fn(0.75)];
  if (samples[0] > samples[1] || samples[1] > samples[2]) {
    warnings.push({
      code: 'PROGRESS_MANAGER',
      message: `ProgressManager fn on scene "${sceneId}" is non-monotonic. ` +
               `The animation will play backward. Ensure fn is non-decreasing across [0, 1].`,
      sceneIndex,
    });
  }

  return warnings;
}
```

This runs once per scene that has a declared `fn`, at compile time only. Runtime cost:
zero (validation is not run in `SceneProgressMapper.remap`).

---

## 2. Data Model

### 2.1 `CompileWarningCode` addition

In `packages/core/src/compiler/sceneTrackTypes.ts`, add `'PROGRESS_MANAGER'` to the
existing union:

```typescript
export type CompileWarningCode =
  | 'MISSING_WIDGET'
  | 'DUPLICATE_WIDGET_ID'
  | 'UNRESOLVED_REFERENCE'
  | 'PROGRESS_MANAGER';   // ← new
```

### 2.2 `ProgressManagerSpec`

New type in `packages/core/src/compiler/sceneTrackTypes.ts`:

```typescript
/**
 * Per-scene scroll weight and input pacing curve.
 * Declared via <ProgressManager> DSL component inside <Scene>.
 * Stored on SceneFrame; consumed by the SceneProgressProfile aggregation pass.
 */
export type ProgressManagerSpec = {
  /**
   * Proportional scroll budget for this scene's outgoing transition.
   * Unitless — normalized across all scenes. A scene with scrollUnits={2400}
   * and a neighbor with scrollUnits={400} means the first transition window
   * is 6× wider in raw input space.
   * Must be > 0. Default: 1.
   */
  scrollUnits: number;

  /**
   * Pure curve function mapping raw local input progress [0..1] to
   * engine progress [0..1] within this scene's window.
   *
   * Hard constraints (validated at compile time):
   *   fn(0) === 0
   *   fn(1) === 1
   *   Monotonically non-decreasing (never goes backward)
   *
   * Default: t => t (identity / linear)
   */
  fn: (localT: number) => number;
};
```

### 2.3 `SceneFrame` addition

In `packages/core/src/compiler/sceneTrackTypes.ts`, add to the existing `SceneFrame` type:

```typescript
// Existing SceneFrame fields remain unchanged. Add:
progressManager?: ProgressManagerSpec;
```

`undefined` means "not declared on this scene." The aggregation pass resolves it via
carry-forward before building segments.

### 2.4 `SceneProgressSegment`

New type in `packages/core/src/compiler/sceneTrackTypes.ts`:

```typescript
/**
 * One segment per outgoing transition (N-1 segments for N scenes).
 * Segment i covers the transition from scene i to scene i+1.
 */
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
};
```

### 2.5 `SceneProgressProfile`

New type in `packages/core/src/compiler/sceneTrackTypes.ts`:

```typescript
/**
 * Aggregated scroll-weight profile for a compiled scene track.
 * Attached to SceneTrack only when at least one scene declares a non-default
 * <ProgressManager>. Absent when all scenes are uniform linear (zero overhead).
 */
export type SceneProgressProfile = {
  segments: SceneProgressSegment[];

  /**
   * True when all scrollUnits are equal AND all fn are the identity function.
   * When true, SceneProgressMapper is not instantiated — identity mapping applies.
   * Set to true by the aggregation pass when no <ProgressManager> was declared,
   * or when all declarations are equivalent to the default.
   */
  isUniform: boolean;
};
```

### 2.6 `SceneTrack` addition

In `packages/core/src/compiler/sceneTrackTypes.ts`, add to `SceneTrack`:

```typescript
// Existing SceneTrack fields remain unchanged. Add:

/**
 * Per-scene scroll weights and pacing curves.
 * Undefined when no <ProgressManager> was declared (identity mapping applies,
 * zero overhead). Never undefined when any scene declares a non-default spec.
 */
progressProfile?: SceneProgressProfile;
```

---

## 3. New DSL Component: `<ProgressManager>`

### 3.1 File location

`packages/core/src/compiler/primitives/progressManager.ts`

### 3.2 Full implementation

```typescript
// Compile-only metadata element. Declares per-scene scroll budget and pacing curve.
// Renders null. Registered via NodeHandler; consumed by sceneTrackCompiler aggregation pass.

import type { NodeHandler } from '../registry';
import { registerNode } from '../registry';
import { IDENTITY_FN } from '../../player/SceneProgressMapper';

export interface ProgressManagerProps {
  /**
   * Proportional scroll budget for this scene's outgoing transition.
   * Unitless — proportional across all scenes.
   * Must be > 0. Default: 1.
   */
  scrollUnits?: number;

  /**
   * Pure input pacing curve. Maps local raw input progress [0..1] to
   * local engine progress [0..1] within this scene's window.
   *
   * Constraints (compile-time validated):
   *   fn(0) === 0, fn(1) === 1, monotonically non-decreasing
   *
   * Default: t => t
   */
  fn?: (localT: number) => number;
}

/**
 * Declares per-scene scroll weight and input pacing curve.
 * Place inside a <Scene> to control how much of the scroll domain that
 * scene's outgoing transition consumes, and how raw input progress maps
 * to engine progress within that window.
 *
 * Carry-forward semantics: if omitted on a scene, the previous scene's
 * ProgressManager spec is inherited. The ultimate default is
 * { scrollUnits: 1, fn: t => t }, which preserves existing uniform behavior.
 *
 * @example
 * // Long content scene — 3× the scroll budget of a default scene
 * <Scene id="camera-docs">
 *   <ProgressManager
 *     scrollUnits={2400}
 *     fn={(t) => Math.min(1, t * 4)}  // animate in first 25% of scroll, then dwell
 *   />
 *   <Camera type="world" position={[2, 1.5, 6]} />
 * </Scene>
 */
export const ProgressManager = (_props: ProgressManagerProps): null => null;
ProgressManager.displayName = 'ProgressManager';

const progressManagerHandler: NodeHandler = (node, api) => {
  const props = node.props as ProgressManagerProps;
  const scrollUnits = props.scrollUnits !== undefined
    ? Math.max(0.001, props.scrollUnits)
    : 1;
  // Use the canonical IDENTITY_FN reference — not an inline arrow — so that
  // buildProgressProfile's reference-equality check (spec.fn === IDENTITY_FN)
  // correctly identifies this scene as uniform when no fn is declared.
  const fn = props.fn ?? IDENTITY_FN;

  api.state.progressManager = { scrollUnits, fn };
};

registerNode(ProgressManager, progressManagerHandler);
```

### 3.3 Export from `compiler/index.ts`

Add to the DSL authoring surface exports:

```typescript
export { ProgressManager } from './primitives/progressManager';
export type { ProgressManagerProps } from './primitives/progressManager';
```

---

## 4. Compiler Changes

### 4.1 `sceneTrackCompiler.ts` — Aggregation Pass

After all `SceneFrame[]` snapshots are produced and before the tick array is filled,
insert a new aggregation pass. This pass runs synchronously in the existing compiler
pipeline. It reads only `SceneFrame[i].progressManager` and writes
`SceneTrack.progressProfile`.

Add the following to `sceneTrackCompiler.ts`. The function is called from the main
compilation entry point, receiving the full `SceneFrame[]` array and returning the
`SceneProgressProfile` (or `undefined` if the feature is unused):

```typescript
import { IDENTITY_FN } from '../player/SceneProgressMapper';

const DEFAULT_PM_SPEC: ProgressManagerSpec = {
  scrollUnits: 1,
  fn: IDENTITY_FN,  // canonical reference — enables reference-equality in isUniform check
};

/**
 * Validates a ProgressManager fn at compile time.
 * Returns an array of CompileWarning (empty if valid).
 */
function validateProgressFn(
  fn: (t: number) => number,
  sceneId: string,
  sceneIndex: number,
): CompileWarning[] {
  const warnings: CompileWarning[] = [];
  const tol = 0.001;

  const v0 = fn(0);
  if (Math.abs(v0) > tol) {
    warnings.push({
      code: 'PROGRESS_MANAGER',
      message:
        `ProgressManager fn on scene "${sceneId}" violates fn(0) === 0 ` +
        `(got ${v0.toFixed(5)}). Scene boundaries will snap. ` +
        `Ensure your curve starts at 0.`,
      sceneIndex,
    });
  }

  const v1 = fn(1);
  if (Math.abs(v1 - 1) > tol) {
    warnings.push({
      code: 'PROGRESS_MANAGER',
      message:
        `ProgressManager fn on scene "${sceneId}" violates fn(1) === 1 ` +
        `(got ${v1.toFixed(5)}). Scene boundaries will snap. ` +
        `Ensure your curve ends at 1.`,
      sceneIndex,
    });
  }

  const s = [fn(0.25), fn(0.5), fn(0.75)];
  if (s[0] > s[1] + tol || s[1] > s[2] + tol) {
    warnings.push({
      code: 'PROGRESS_MANAGER',
      message:
        `ProgressManager fn on scene "${sceneId}" is non-monotonic ` +
        `(sampled values: ${s.map((v) => v.toFixed(4)).join(', ')}). ` +
        `The animation will play backward. Ensure fn is non-decreasing across [0, 1].`,
      sceneIndex,
    });
  }

  return warnings;
}

/**
 * Builds the SceneProgressProfile from compiled SceneFrames.
 * Returns undefined when the feature is unused (all defaults) — zero overhead path.
 * Emits compile warnings for last-scene declarations and invalid fn constraints.
 */
export function buildProgressProfile(
  frames: SceneFrame[],
  emitWarning: (w: CompileWarning) => void,
): SceneProgressProfile | undefined {
  const n = frames.length;
  if (n < 2) return undefined;  // 0 or 1 scenes: no transitions, no profile needed

  // Resolve each scene's spec via carry-forward
  const resolved: ProgressManagerSpec[] = [];
  let last = DEFAULT_PM_SPEC;
  for (let i = 0; i < n; i++) {
    const declared = frames[i].progressManager;
    if (declared !== undefined) {
      // SceneFrame.id is the field name — not sceneId.
      const sceneId = frames[i].id || `scene-${i}`;

      // Validate fn constraints
      const fnWarnings = validateProgressFn(declared.fn, sceneId, i);
      fnWarnings.forEach(emitWarning);

      // Warn on last-scene declaration
      if (i === n - 1) {
        emitWarning({
          code: 'PROGRESS_MANAGER',
          message:
            `ProgressManager declared on the last scene ("${sceneId}") has no effect. ` +
            `The last scene has no outgoing transition, so scrollUnits and fn are unused. ` +
            `Remove the <ProgressManager> from this scene, or declare it on the ` +
            `second-to-last scene if you want to control that transition's weight.`,
          sceneIndex: i,
        });
      }

      last = declared;
    }
    resolved.push(last);
  }

  // Check if all specs are effectively uniform (skip mapper construction).
  // IDENTITY_FN is the same reference used by the handler's default and DEFAULT_PM_SPEC,
  // so this check is correct for both "no <ProgressManager> declared" and
  // "<ProgressManager scrollUnits={N} />" (fn omitted → IDENTITY_FN assigned).
  const firstUnit = resolved[0].scrollUnits;
  const isUniform = resolved.every(
    (spec) => spec.scrollUnits === firstUnit && spec.fn === IDENTITY_FN,
  );

  if (isUniform) return undefined;  // identity mapping — no profile needed

  // Build segments (N-1 segments for N scenes, one per outgoing transition)
  const totalUnits = resolved
    .slice(0, n - 1)
    .reduce((sum, spec) => sum + spec.scrollUnits, 0);

  const segments: SceneProgressSegment[] = [];
  let rawCursor = 0;

  for (let i = 0; i < n - 1; i++) {
    const normalizedWeight = resolved[i].scrollUnits / totalUnits;
    const rawStart = rawCursor;
    const rawEnd = rawCursor + normalizedWeight;
    rawCursor = rawEnd;

    segments.push({
      sceneIndex: i,
      rawStart,
      rawEnd,
      engineStart: i / (n - 1),
      engineEnd: (i + 1) / (n - 1),
      fn: resolved[i].fn,
    });
  }

  return { segments, isUniform: false };
}
```

**Integration point:** In the main `compileSceneTrack` function (or equivalent entry
point in `sceneTrackCompiler.ts`), after all frames are compiled:

```typescript
const warnings: CompileWarning[] = [];
const progressProfile = buildProgressProfile(frames, (w) => warnings.push(w));
// ... existing tick-baking code ...
const sceneTrack: SceneTrack = {
  // ... existing fields ...
  progressProfile,
};
return { sceneTrack, warnings };
```

### 4.2 Cache key change in `sceneTrackCache.ts`

The content-hash cache key must include `fn.toString()` for any scene that declares a
`<ProgressManager>` with a non-default `fn`. Add to the key-building logic:

```typescript
// In the cache key builder, after existing frame fields:
for (let i = 0; i < frames.length; i++) {
  const pm = frames[i].progressManager;
  if (pm) {
    keyParts.push(`pm:${i}:units=${pm.scrollUnits}:fn=${pm.fn.toString()}`);
  }
}
```

This ensures that changing a `fn` definition invalidates the cache correctly. For scenes
with no `<ProgressManager>`, this loop adds nothing (zero key overhead).

---

## 5. `SceneProgressMapper`

### 5.1 File location

`packages/core/src/player/SceneProgressMapper.ts`

### 5.2 Full implementation

```typescript
// Pure utility class. No side effects, no mutable state. Fully testable in isolation.
// Instantiated once in useSceneEngine when sceneTrack.progressProfile is present.
// Called every frame via getGlobalProgress() (remap) and on user navigation (inverse).

import type { SceneProgressProfile, SceneProgressSegment } from '../compiler/sceneTrackTypes';

/**
 * Canonical identity function. Exported as a named const so that progressManager.ts
 * and sceneTrackCompiler.ts can import and share the exact same reference.
 * This makes the isUniform reference-equality check in buildProgressProfile correct:
 * a <ProgressManager scrollUnits={N} /> without a fn prop assigns IDENTITY_FN,
 * and the check spec.fn === IDENTITY_FN correctly identifies it as uniform.
 */
export const IDENTITY_FN = (t: number): number => t;

export class SceneProgressMapper {
  private readonly segments: readonly SceneProgressSegment[];

  constructor(profile: SceneProgressProfile) {
    this.segments = profile.segments;
  }

  /**
   * Maps raw input progress [0..1] to engine progress [0..1].
   * Hot path — called every frame. O(N) where N = scene count (linear scan).
   */
  remap(rawProgress: number): number {
    const p = Math.max(0, Math.min(1, rawProgress));
    const segs = this.segments;

    // Edge cases
    if (p <= 0) return 0;
    if (p >= 1) return 1;

    // Find the segment that contains p
    // Linear scan is correct — scene counts are always small (< 100 in practice)
    for (let i = 0; i < segs.length; i++) {
      const seg = segs[i];
      if (p <= seg.rawEnd || i === segs.length - 1) {
        const localT = (p - seg.rawStart) / (seg.rawEnd - seg.rawStart);
        const localEngine = seg.fn(Math.max(0, Math.min(1, localT)));
        return seg.engineStart + localEngine * (seg.engineEnd - seg.engineStart);
      }
    }

    return 1; // unreachable — satisfies TypeScript
  }

  /**
   * Maps engine progress [0..1] back to raw input progress [0..1].
   * Cold path — called only from scrollToProgress() on user navigation.
   * Uses binary search for non-identity fn. O(N * log(1/tolerance)).
   */
  inverse(engineProgress: number): number {
    const ep = Math.max(0, Math.min(1, engineProgress));
    if (ep <= 0) return 0;
    if (ep >= 1) return 1;

    const segs = this.segments;

    // Find the segment that contains ep in engine space
    for (let i = 0; i < segs.length; i++) {
      const seg = segs[i];
      if (ep <= seg.engineEnd || i === segs.length - 1) {
        // Normalize ep to local engine space [0..1]
        const localEngine = (ep - seg.engineStart) / (seg.engineEnd - seg.engineStart);

        // Invert fn: find localT such that fn(localT) ≈ localEngine
        let localT: number;
        if (seg.fn === SceneProgressMapper.IDENTITY_FN || isIdentityFn(seg.fn)) {
          localT = localEngine; // O(1) for identity
        } else {
          localT = binarySearchInverse(seg.fn, localEngine, 1e-5, 20);
        }

        // Denormalize back to raw input space
        return seg.rawStart + localT * (seg.rawEnd - seg.rawStart);
      }
    }

    return 1;
  }

  /** Reference to the canonical identity function for fast-path detection.
   *  Points to the module-level IDENTITY_FN export — same reference used by
   *  progressManager.ts and sceneTrackCompiler.ts for the isUniform check. */
  static readonly IDENTITY_FN = IDENTITY_FN;
}

/** Binary search for the input t such that fn(t) ≈ target, in [0..1]. */
function binarySearchInverse(
  fn: (t: number) => number,
  target: number,
  tolerance: number,
  maxIterations: number,
): number {
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < maxIterations; i++) {
    const mid = (lo + hi) / 2;
    const value = fn(mid);
    if (Math.abs(value - target) < tolerance) return mid;
    if (value < target) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/**
 * Cheap heuristic to detect if a function is behaviorally identity.
 * Samples three interior points. Used to skip binary search in the common case.
 * Not a proof — just a fast-path optimization.
 */
function isIdentityFn(fn: (t: number) => number): boolean {
  const tol = 0.0001;
  return (
    Math.abs(fn(0.25) - 0.25) < tol &&
    Math.abs(fn(0.5) - 0.5) < tol &&
    Math.abs(fn(0.75) - 0.75) < tol
  );
}
```

---

## 6. Player Layer Changes

### 6.1 `useEngineScroll.ts`

Add `progressMapper` option and apply it in `computeProgress` and `scrollToProgress`:

```typescript
// New option (add to UseEngineScrollOptions):
progressMapper?: SceneProgressMapper | null;

// In computeProgress():
const rawProgress = clamp01((scrollTop - regionTop) / maxScroll);
return progressMapper ? progressMapper.remap(rawProgress) : rawProgress;

// In scrollToProgress():
const rawTarget = progressMapper
  ? progressMapper.inverse(clamp01(next))
  : clamp01(next);
const targetScrollTop = regionTop + rawTarget * maxScroll;
window.scrollTo({ top: targetScrollTop, behavior: 'instant' });
```

### 6.2 `useEngineInput.ts`

Add `progressMapper` option. Forward it to `useEngineScroll` in scroll mode. Apply it
in direct mode (wheel/drag). Do NOT apply it in controlled-progress mode.

```typescript
// New option (add to UseEngineInputOptions):
progressMapper?: SceneProgressMapper | null;

// Direct mode return path (when hasSceneController):
return {
  progress: progressMapper ? progressMapper.remap(directProgress) : directProgress,
  scrollToProgress: (target) => {
    const raw = progressMapper ? progressMapper.inverse(clamp01(target)) : clamp01(target);
    setDirectProgressBoth(raw);
  },
  getGlobalProgress: () => {
    const raw = directProgressRef.current;
    return progressMapper ? progressMapper.remap(raw) : raw;
  },
};

// Controlled-progress return path — mapper NOT applied:
// (no change to existing controlled-progress code)
```

### 6.3 `useSceneEngine.ts`

Instantiate `SceneProgressMapper` after `sceneTrack` resolves. Pass to `useEngineInput`.

```typescript
const progressMapper = useMemo<SceneProgressMapper | null>(() => {
  if (!sceneTrack?.progressProfile || sceneTrack.progressProfile.isUniform) {
    return null; // identity — no mapper needed
  }
  return new SceneProgressMapper(sceneTrack.progressProfile);
}, [sceneTrack]);

// Pass to useEngineInput (add to existing options object):
// progressMapper,
```

The `scrollRegionHeightPx` calculation does **not** change. The mapper operates entirely
within the existing `[0..1]` raw domain. The spacer height determines the total raw
domain size; the mapper remaps proportionally within it. No spacer adjustment is needed.

---

## 7. `ScrollCaptureSection` (New Player Primitive)

This component enables an embedded canvas to capture the page's scroll while the user is
within its scroll range, then release naturally when complete. It uses a pure CSS sticky
mechanism — no scroll interception, no `preventDefault`, no scroll locking.

### 7.1 File location

`packages/core/src/player/ScrollCaptureSection.tsx`

### 7.2 Full implementation

```typescript
// Player-layer component. No compiler involvement.
// Creates the sticky-capture pattern: tall outer div + sticky inner stage.
// Pushes raw progress [0..1] into the engine via EngineContext.setRawProgress.

import { useRef, useEffect, type ReactNode } from 'react';
import { useEngineContext } from './EngineContext';

export interface ScrollCaptureSectionProps {
  /**
   * Total scroll budget in pixels. Controls how tall the outer div is.
   * Set this to the sum of all <ProgressManager scrollUnits> values
   * in the contained scenes (multiplied by pixelsPerUnit if desired).
   *
   * Example: two scenes with scrollUnits={2400} and scrollUnits={800}
   * → height={3200}
   */
  height: number;

  /**
   * CSS height of the sticky inner stage. Default: '100vh'.
   * Set to a fixed pixel value to embed the canvas at a specific height
   * rather than full-viewport.
   */
  stageHeight?: string | number;

  className?: string;
  stageClassName?: string;
  children: ReactNode;
}

export function ScrollCaptureSection({
  height,
  stageHeight = '100vh',
  className,
  stageClassName,
  children,
}: ScrollCaptureSectionProps) {
  const outerRef = useRef<HTMLDivElement>(null);
  const { setRawProgress } = useEngineContext();

  useEffect(() => {
    const outer = outerRef.current;
    if (!outer) return;

    const computeAndSet = () => {
      const rect = outer.getBoundingClientRect();
      // How far we've scrolled into the outer div (negative rect.top = scrolled past top)
      const scrolled = -rect.top;
      // Max scroll is outer height minus one viewport height (the stage height)
      const stageH = typeof stageHeight === 'number'
        ? stageHeight
        : window.innerHeight;  // treat '100vh' as window.innerHeight
      const maxScroll = outer.offsetHeight - stageH;
      if (maxScroll <= 0) return;  // outer not tall enough to scroll
      const raw = Math.max(0, Math.min(1, scrolled / maxScroll));
      setRawProgress(raw);
    };

    // Initialize on mount (user may have already scrolled past)
    computeAndSet();

    window.addEventListener('scroll', computeAndSet, { passive: true });
    window.addEventListener('resize', computeAndSet, { passive: true });

    return () => {
      window.removeEventListener('scroll', computeAndSet);
      window.removeEventListener('resize', computeAndSet);
    };
  }, [setRawProgress, stageHeight]);

  return (
    <div ref={outerRef} style={{ height }} className={className}>
      <div
        style={{
          position: 'sticky',
          top: 0,
          height: stageHeight,
          overflow: 'hidden',
        }}
        className={stageClassName}
      >
        {children}
      </div>
    </div>
  );
}
```

### 7.3 `EngineContext` addition

`setRawProgress` is a new push slot on the engine context. Add to `EngineContext`:

```typescript
// New field on the EngineContext value type:
setRawProgress: (raw: number) => void;
```

In `useSceneEngine.ts`, `setRawProgress` writes to the raw progress ref. In scroll mode
the engine already reads from `window.scrollY` — `setRawProgress` bypasses that and
provides the raw value directly, which then flows through the mapper and into the tick
sampler via the existing `getGlobalProgress` path.

The two input modes (scroll-from-window vs push-from-ScrollCaptureSection) are exclusive.
When `ScrollCaptureSection` is mounted and calling `setRawProgress`, the engine uses the
pushed value. The scroll listener in `useEngineScroll` is not attached when the engine is
in push mode (the engine context carries an `inputSource: 'scroll' | 'push'` flag that
`useEngineInput` uses to decide which listener to attach).

---

## 8. Files Affected

| File | Change |
|---|---|
| `packages/core/src/compiler/sceneTrackTypes.ts` | Add `ProgressManagerSpec`, `SceneProgressSegment`, `SceneProgressProfile`; add `progressManager?` to `SceneFrame`; add `progressProfile?` to `SceneTrack` |
| `packages/core/src/compiler/primitives/progressManager.ts` | **New file** — `ProgressManager` DSL component + NodeHandler |
| `packages/core/src/compiler/sceneTrackCompiler.ts` | Add `buildProgressProfile()` aggregation pass; call after frame compilation; emit warnings |
| `packages/core/src/compiler/sceneTrackCache.ts` | Include `pm.scrollUnits` and `pm.fn.toString()` in cache key per scene |
| `packages/core/src/compiler/index.ts` | Export `ProgressManager`, `ProgressManagerProps` |
| `packages/core/src/player/SceneProgressMapper.ts` | **New file** — pure mapper class |
| `packages/core/src/player/ScrollCaptureSection.tsx` | **New file** — sticky scroll capture primitive |
| `packages/core/src/player/useSceneEngine.ts` | Instantiate `SceneProgressMapper`; pass to `useEngineInput` |
| `packages/core/src/player/useEngineInput.ts` | Accept `progressMapper`; apply in direct mode; forward to scroll hook; skip in controlled-progress mode |
| `packages/core/src/player/useEngineScroll.ts` | Accept `progressMapper`; apply in `computeProgress`; invert in `scrollToProgress` |
| `packages/core/src/player/EngineContext.ts` | Add `setRawProgress`; add `inputSource` flag |
| `packages/core/src/player/index.ts` | Export `ScrollCaptureSection`, `ScrollCaptureSectionProps` |

No changes to: `sceneTrackSampler.ts`, `RuntimeDriver`, any widget, any element module,
`@brewsite/diagram`, any example app. The tick array remains uniform and unchanged.

---

## 9. Testing Strategy

All tests live in `__tests__/` directories co-located with the code under test.
All tests use real inputs and assert real outputs. No mocks, no spies, no `vi.fn()`.

### 9.1 `SceneProgressMapper.test.ts`

Location: `packages/core/src/player/__tests__/SceneProgressMapper.test.ts`

**Test cases:**

```typescript
// 1. Identity (all-default): remap(t) === t for all t
// 2. Uniform non-identity: two equal-weight scenes, custom fn
//    - remap(0) === 0
//    - remap(1) === 1
//    - remap(0.5) === fn(0.5) (mid-point of only segment)
// 3. Non-uniform weights: two scenes, scrollUnits=[3,1]
//    - Segment 0 covers raw [0..0.75], segment 1 covers [0.75..1]
//    - remap(0.375) should land at engineStart[0] + fn(0.5) * (engineEnd[0]-engineStart[0])
// 4. inverse(remap(t)) ≈ t for identity and non-identity fn
//    - Test at t=0, 0.1, 0.25, 0.5, 0.75, 0.9, 1
//    - Tolerance: 1e-4
// 5. Clamping: remap(-0.1) === 0, remap(1.1) === 1
// 6. Saturation fn (dwell pattern): fn = t => Math.min(1, t * 4)
//    - remap(0.25 * segmentWidth) should return ~1.0 (fully saturated)
//    - remap(0.5 * segmentWidth) should also return ~1.0 (held at pose)
// 7. Three-scene non-uniform: scrollUnits=[1, 3, 1] (middle scene is wider)
//    - Verify segment boundaries sum to 1.0
//    - Verify remap is monotonically non-decreasing across 100 samples
```

### 9.2 `buildProgressProfile.test.ts`

Location: `packages/core/src/compiler/__tests__/buildProgressProfile.test.ts`

**Test cases:**

```typescript
// 1. No ProgressManager declared → returns undefined
// 2. All scenes uniform (same scrollUnits, identity fn) → returns undefined
// 3. Single non-uniform scene (out of 3) → returns profile with correct segment weights
// 4. Last-scene declaration → emits warning with correct message, returns profile without last scene
// 5. fn(0) !== 0 → emits warning with correct message, profile still built
// 6. fn(1) !== 1 → emits warning with correct message, profile still built
// 7. Non-monotonic fn → emits warning, profile still built
// 8. Carry-forward: scene 0 has spec, scenes 1-3 do not → scenes 1-3 use scene 0's spec
// 9. Carry-forward override: scene 0 spec, scene 2 overrides → scene 1 uses scene 0's, scene 2+ uses scene 2's
// 10. scrollUnits < 0.001 → clamped to 0.001 without warning (silent clamp, not a user error)
// 11. Segment rawStart/rawEnd values sum to 1.0 within floating-point tolerance
// 12. engineStart[i] and engineEnd[i] match i/(N-1) formula exactly
```

### 9.3 `useSceneEngine.test.ts` additions

Add integration tests that exercise the mapper instantiation path:

```typescript
// 1. No ProgressManager → progressMapper is null → no mapper created
// 2. Non-uniform ProgressManager → progressMapper is SceneProgressMapper instance
// 3. Controlled-progress mode → mapper is not applied to progress value
//    (verify by setting controlledProgress=0.5, checking engine receives 0.5 exactly)
```

### 9.4 Cache key test

Location: `packages/core/src/compiler/__tests__/sceneTrackCache.test.ts`

```typescript
// 1. Two compilations with identical fn (same source text) → same cache key
// 2. Two compilations with different fn source → different cache key
// 3. No ProgressManager → same cache key as before this change (zero overhead)
// 4. Change scrollUnits only → different cache key
```

---

## 10. Authoring Examples

### Minimal: just control scroll budget

```tsx
<Scene id="act1-header">
  <ProgressManager scrollUnits={400} />    {/* short cinematic cut */}
  <Background color="#050510" />
  <Camera type="world" position={[0, 12, 35]} />
</Scene>

<Scene id="installation">
  <ProgressManager scrollUnits={2400} />   {/* long content section */}
  <Camera type="world" position={[0, 2, 8]} />
</Scene>
```

### Dwell pattern: animate fast, hold pose for reading

```tsx
<Scene id="camera-demo">
  <ProgressManager
    scrollUnits={2400}
    fn={(t) => Math.min(1, t * 4)}
    // 3D animation plays in first 25% of scroll (600px)
    // Remaining 1800px: pose held, user reads content
  />
  <Camera type="orbit" target={[0, 1, 0]} />
  <Model id="bot" src="robot" />
</Scene>
```

### Ease-in-out curve within a window

```tsx
<Scene id="features">
  <ProgressManager
    scrollUnits={1800}
    fn={(t) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t}  // easeInOutQuad
  />
  <Camera type="world" position={[2, 1.5, 6]} />
</Scene>
```

### Embedded canvas that captures scroll

```tsx
// Normal page content above...

<EngineProvider manifestUrl="/assets/demo.json">
  <Scene id="world-camera">
    <ProgressManager scrollUnits={2400} fn={(t) => Math.min(1, t * 4)} />
    <Camera type="world" position={[2, 1.5, 6]} />
    <Model id="bot" src="robot" />
  </Scene>

  <Scene id="orbit-camera">
    <ProgressManager scrollUnits={1600} fn={(t) => Math.min(1, t * 3)} />
    <Camera type="orbit" target={[0, 1, 0]} />
    <Model id="bot" src="robot" />
  </Scene>

  {/* Outer div: 4000px tall (sum of scrollUnits). Inner div: sticky. */}
  <ScrollCaptureSection height={4000}>
    <SceneCanvas style={{ width: '100%', height: '100%' }} />
  </ScrollCaptureSection>
</EngineProvider>

// Normal page content continues...
```

---

## 11. Key Invariants

1. **The tick array is unchanged.** `SceneTrack.ticks[]` remains a uniform flat array.
   The sampler is untouched. Only the mapping from raw input → engine progress changes.

2. **Zero overhead when unused.** `progressProfile` is `undefined` on `SceneTrack` when
   no `<ProgressManager>` is declared. `SceneProgressMapper` is never instantiated.
   `remap` and `inverse` are never called. No cost for existing consumers.

3. **The mapper is the only place non-linear progress exists.** Nothing downstream of
   `getGlobalProgress()` — the runtime driver, the tick sampler, widgets — knows or cares
   that progress was remapped.

4. **Controlled-progress mode is mapper-free.** A controlled-progress owner provides
   semantic engine progress directly. The mapper is never applied.

5. **Carry-forward is whole-spec.** `scrollUnits` and `fn` always travel together.
   There is no per-property merge.

6. **`fn.toString()` is the cache key for function values.** Functions must be pure
   curves with no external mutable dependencies. The compile-time validation step guards
   against pathological cases.

7. **Compile warnings are always emitted** for last-scene declarations, constraint
   violations in `fn`, and non-monotonic curves. Silent ignore is never acceptable.
