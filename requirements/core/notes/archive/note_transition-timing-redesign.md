---
title: "Transition Timing Redesign — Named Transitions + exitStart Model"
doc_type: note
owner: brewsite-pm
status: implemented
updated: 2026-03-03
change_history:
  - date: 2026-03-03
    author: PM-1
    summary: "Initial spec written. Proposed endOfScene scalar, named transitions (dissolve/crossfade/cut), and complexity reduction via constant removal."
  - date: 2026-03-03
    author: PM-1 (incorporating PM-2 review + team-lead user feedback)
    summary: "Renamed endOfScene→exitStart for precision. Dropped 'cut' from MVP (window system cannot implement it cleanly). Fixed 'crossfade' windows to exit:[0,1]/enter:[0,1] (provably correct equal-blend; original guess produced double-exposure). Fixed TypeScript to discriminated union to prevent exitStart with raw windows. Committed to major semver bump. Added Scene Boundary Semantics section per user request. Fixed chart demo migration to use escape hatch, not 'crossfade'. Removed PM-2 Review section; changes incorporated."
  - date: 2026-03-03
    author: PM-2
    summary: "PM-2 sign-off. All critical concerns resolved: 'cut' dropped, crossfade fixed to equal-blend math verified against compiler, exitStart lower-bound clamp confirmed. Status verified."
  - date: 2026-03-03
    author: PM-1
    summary: "Status updated to implemented. Plan authored by architect, reviewed and approved by PM-1 with JSDoc correction applied. Full implementation verified by architect. All breaking changes shipped in major version bump."
---

# Transition Timing Redesign — Named Transitions + exitStart Model

## Current State

### What the System Does Today

Scene transitions are controlled by a `TransitionWindow` object on the `<Scene>` DSL element:

```typescript
// sceneTrackTypes.ts
export type TransitionWindow = {
  exit?: [number, number];   // sub-window of blockProgress [0,1] where outgoing fades out
  enter?: [number, number];  // sub-window of blockProgress [0,1] where incoming fades in
};
```

```tsx
<Scene id="scene-1" transition={{ exit: [0.8, 0.9], enter: [0.9, 1.0] }}>
```

`blockProgress` runs 0→1 across the transition between scene N and scene N+1. The `transition` prop writes to `SceneFrame.transitionWindow`, which `sceneTrackCompiler` reads to build the `makeResolver` factory for `FunctionalTransitionSpec` widgets. The compiler resolves active windows via a cascade:

```typescript
// sceneTrackCompiler.ts:465
const sceneExit: [number, number] =
  fromSnap.transitionWindow?.exit ?? specDefault?.exit ?? [0, 0.5];
const sceneEnter: [number, number] =
  toSnap.transitionWindow?.enter ?? specDefault?.enter ?? [0.5, 1.0];
```

The library exports five named window constants in `transitionPresets.ts`:

| Constant | Exit | Enter |
|---|---|---|
| `TRANSITION_DEFAULT` | `{}` | `{}` |
| `TRANSITION_CROSSFADE` | `[0, 0.5]` | `[0.5, 1]` |
| `TRANSITION_SEQUENTIAL` | `[0, 0.4]` | `[0.6, 1]` |
| `TRANSITION_EXIT_FIRST` | `[0, 0.6]` | `[0.4, 1]` |
| `TRANSITION_CUT` | `[0, 0]` | `[1, 1]` |

### What Files Implement This

| File | Role |
|---|---|
| `packages/core/src/compiler/transitions/transitionTypes.ts` | `TransitionWindow`, `FunctionalTransitionSpec`, `TransitionContext` |
| `packages/core/src/compiler/transitions/transitionPresets.ts` | Named constants + easing functions |
| `packages/core/src/compiler/transitions/transitionResolver.ts` | `makeResolver()` factory |
| `packages/core/src/compiler/sceneTrackTypes.ts` | `TransitionWindow` on `SceneFrame` |
| `packages/core/src/compiler/sceneTrackCompiler.ts` | Cascade resolution; hardcoded defaults `[0, 0.5]`/`[0.5, 1.0]` |
| `packages/core/src/compiler/sceneDslCompiler.ts` | Scene node handler writes `api.state.transitionWindow = props.transition` |
| `packages/core/src/compiler/blocks/transition.tsx` | Per-widget `<Transition>` DSL component |
| `packages/core/src/compiler/index.ts` | Public exports |

### What Is Wrong

**Problem 1: The system default is cinematically broken.**

The hardcoded fallback `[0, 0.5]` / `[0.5, 1.0]` starts fading the outgoing scene at `blockProgress = 0` — the very first frame of the transition. Scene content is never fully opaque during the transition block. This looks bad in practice.

Every real-world scene in the codebase overrides this default. The architecture demo defines `DISSOLVE_TO_BLACK = { exit: [0.9, 0.95], enter: [0.95, 1.0] }` as a local constant. The chart demo defines `FADE = { exit: [0.7, 1.0], enter: [0.0, 0.3] }` locally. The five library-level named presets are not used anywhere in the codebase.

**Problem 2: The DSL exposes an internal coordinate system.**

`transition={{ exit: [0.8, 0.9], enter: [0.9, 1.0] }}` requires authors to understand `blockProgress` as an internal implementation concept. There is no authoring-friendly abstraction — no way to say "keep this scene opaque for most of the transition, then fade quickly" without deriving window values by hand.

**Problem 3: No string-literal API.**

There is no `transition="dissolve"` API. Named presets exist as imported constants but they still expose the raw coordinate system and require an import statement.

---

## Scene Boundary Semantics

This section documents a fundamental architecture point that is not obvious from the code alone, and is required context for understanding the `exitStart` model.

### Scenes Have No Internal Timeline

A scene in this architecture is a **single static snapshot**. The DSL compiler evaluates each `<Scene>` once and produces a `SceneFrame` — a flat record of widget states at a single point. There is no "scene progress" or "in-scene animation time." All time-domain behavior lives in the transition block.

### The Transition Block Is the Time Domain

For N scenes, there are N−1 transition blocks. Block `i` covers the transition from scene `i` to scene `i+1`. `blockProgress` runs 0→1 across this block. This is the only progress coordinate that exists during a transition.

Within block `i`, `blockProgress` represents:
- `0`: the outgoing scene (scene `i`) in its full static state — nothing has changed yet
- `exitStart` (e.g. `0.8`): the outgoing scene begins fading
- `mid` (e.g. `0.9`): the midpoint — black frame, nothing visible
- `1.0`: the incoming scene (scene `i+1`) fully visible

### Scene Visibility Spans Two Blocks

A scene is visible across parts of **two** transition blocks:
1. **The previous block** (block `i−1`): scene `i` fades in during the enter window. By `blockProgress = 1.0` of block `i−1`, scene `i` is fully visible.
2. **Its own block** (block `i`): scene `i` holds at full opacity from `blockProgress = 0` to `exitStart`, then fades out.

The `transition` and `exitStart` props on `<Scene id="scene-i">` control the **exit** — the timing of scene `i` fading out in block `i`. They do **not** control scene `i`'s entry, which is determined by the midpoint math from block `i−1`.

### Scene Boundary: `Sc(i), bp=1` Is Not the Same as `Sc(i+1), bp=0`

These two ticks have adjacent global indices in the `SceneTrack` array and are visually identical — both show scene `i+1` at full opacity. But they are not the same moment:

- **`Sc(i), bp=1`**: The last tick of block `i`. `sceneId = "scene-i"`. The functional transition closure for block `i` is evaluated with `blockProgress = 1.0`. For the enter path, this produces `enterFn(toState)(ctx at t=1) = toState` — scene `i+1` fully visible.

- **`Sc(i+1), bp=0`**: The first tick of block `i+1`. `sceneId = "scene-(i+1)"`. Scene `i+1` is now showing its own static snapshot. If it has an outgoing transition (to scene `i+2`), that transition is at `blockProgress = 0` — nothing has started fading.

The visual content at these two ticks is the same. The metadata (`sceneId`, `sceneIndex`, `blockProgress`, which `transitionBlocks` entry is active) is different. They are the seam between two transition blocks.

**Consequence for authors**: the `exitStart` prop on `<Scene id="scene-2">` does not affect when scene 2 appears. It only affects when scene 2 starts disappearing. The moment when scene 2 first becomes fully visible is determined by the `exitStart` of scene 1 (via the midpoint: `mid = (scene1.exitStart + 1) / 2`).

### First and Last Scene Edge Cases

- **First scene** (`<Scene id="scene-0">`): has no incoming transition. The `transition` and `exitStart` props only control the transition OUT of scene 0. They have no effect on how scene 0 first appears (it is rendered immediately at full opacity from the start).
- **Last scene**: has no outgoing transition. `transition` and `exitStart` on the last scene have no effect. The compiler already emits a `PROGRESS_MANAGER` warning for `<ProgressManager>` on the last scene; analogous behavior applies here — the props are silently ignored with a compile warning recommended.

---

## Proposed Model

### Core Change: `exitStart` Prop

The primary authoring improvement is a single normalized scalar prop `exitStart` on `<Scene>`. It declares the `blockProgress` value at which the outgoing scene begins fading. Default: `0.8`.

- From `blockProgress = 0` to `exitStart`: scene is fully opaque.
- From `exitStart` to `mid = (exitStart + 1) / 2`: scene fades to nothing.
- At `mid`: nothing visible — complete black/transparency.
- From `mid` to `1.0`: incoming scene fades in.

With `exitStart = 0.8`:
- Scene opaque: `[0, 0.8]`
- Outgoing fades: exit window `[0.8, 0.9]`
- Black frame: `blockProgress = 0.9`
- Incoming fades: enter window `[0.9, 1.0]`

This is the dissolve-through-black model. **It is the correct default for a marketing scene toolkit** — scene content should be visible as long as possible before yielding.

### Named Transitions

The `transition` prop on `<Scene>` accepts a string name alongside the existing raw `TransitionWindow` escape hatch.

```tsx
// Default: dissolve with exitStart=0.8 — no props needed
<Scene id="scene-1" />

// Dissolve with custom timing: scene stays opaque longer
<Scene id="scene-1" exitStart={0.7} />

// Explicit dissolve name + custom timing (equivalent to above)
<Scene id="scene-1" transition="dissolve" exitStart={0.7} />

// Crossfade: both scenes visible simultaneously, equal blend
<Scene id="scene-1" transition="crossfade" />

// Raw window: escape hatch for custom timing (exitStart not valid here)
<Scene id="scene-1" transition={{ exit: [0.7, 1.0], enter: [0.0, 0.3] }} />
```

**Named transition types (MVP — 2 types):**

| Name | Description | Effective Windows |
|---|---|---|
| `"dissolve"` | Through-black. Scene opaque until `exitStart`, then exits to black, then incoming fades in. Default and recommended. | exit: `[exitStart, mid]`, enter: `[mid, 1.0]` where `mid = (exitStart + 1) / 2` |
| `"crossfade"` | Equal-blend. Both scenes visible simultaneously throughout the transition block. Outgoing fades 1→0 while incoming fades 0→1. Opacity sums to 1 at every frame. | exit: `[0, 1]`, enter: `[0, 1]` |

`"dissolve"` is the new system default. `exitStart` is ignored for `"crossfade"` (enforced at the TypeScript level — see below).

**Why `"cut"` is not in MVP scope:** A true instant hard cut cannot be expressed via the window system. With `exit:[0,0]`, `effectiveExitEnd = 0`, so the outgoing widget is absent for the entire transition block starting at `bp=0`. With `enter:[1,1]`, `effectiveEnterStart = 1`, so the incoming widget is absent until the final frame. The actual behavior is: blank screen for the entire transition block duration, then snap to incoming on the last frame. This is not a cut — the blank duration depends on the block's scroll width. A true cut requires a zero-length transition block or a new compiler path. Authors wanting a near-instant transition should use a very small `scrollUnits` value (e.g., `<ProgressManager scrollUnits={50} />`) with the default `"dissolve"`. `"cut"` is scoped as a future feature requiring new architecture.

### TypeScript API

```typescript
// Named transition types (MVP)
export type TransitionName = 'dissolve' | 'crossfade';

// Scene-level transition prop — union of string name and raw window escape hatch
export type SceneTransitionProp = TransitionName | TransitionWindow;

// Discriminated union on <Scene> props prevents exitStart with non-dissolve transitions.
// exitStart is only valid when transition is absent (defaults to "dissolve") or "dissolve".
// Using exitStart with "crossfade" or a raw TransitionWindow is a TypeScript compile error.
export type SceneTransitionProps =
  | { transition?: 'dissolve'; exitStart?: number }
  | { transition: 'crossfade' | TransitionWindow; exitStart?: never };
```

The `exitStart` value is clamped to `[0, 0.99]` in the resolution function to prevent degenerate windows where `exitStart >= 1`.

### Resolution Function

```typescript
// packages/core/src/compiler/transitions/transitionPresets.ts

const DEFAULT_EXIT_START = 0.8;

/**
 * Resolves a named or raw SceneTransitionProp + exitStart to a TransitionWindow.
 * Pure function. Called by the <Scene> node handler in sceneDslCompiler.
 *
 * exitStart is only meaningful for 'dissolve' and is ignored for 'crossfade'.
 * exitStart is clamped to [0, 0.99] to prevent degenerate windows.
 */
export function resolveSceneTransition(
  prop: SceneTransitionProp | undefined,
  exitStart?: number,
): TransitionWindow {
  if (!prop || prop === 'dissolve') {
    const eos = Math.min(Math.max(exitStart ?? DEFAULT_EXIT_START, 0), 0.99);
    const mid = (eos + 1.0) / 2;
    return { exit: [eos, mid], enter: [mid, 1.0] };
  }
  if (prop === 'crossfade') {
    // True equal-blend crossfade: both scenes fade simultaneously across the full block.
    // At any blockProgress bp: outgoing opacity = (1 - bp), incoming opacity = bp.
    // Opacity sums to 1 throughout. No double-exposure zone.
    return { exit: [0, 1], enter: [0, 1] };
  }
  // Raw TransitionWindow escape hatch — pass through unchanged
  return prop;
}
```

### DSL Example — What LLM Scene Authors Write

An LLM authoring scenes needs to know two things:
1. No `transition` prop needed for the standard dissolve-through-black.
2. To hold the scene longer before fading, add `exitStart={0.9}` (higher = later fade start).

```tsx
// Minimal: default dissolve. Scene opaque until 80%, then fades to black.
<Scene id="scene-1">
  <ProgressManager scrollUnits={2000} />
  <Background color="#0a0a0f" />
  <Camera position={[0, 2, 8]} target={[0, 0, 0]} />
</Scene>

// Hold longer: scene stays fully opaque until 90% of transition block.
// Equivalent to the architecture demo's DISSOLVE_TO_BLACK pattern.
<Scene id="scene-2" exitStart={0.9}>
  <ProgressManager scrollUnits={1500} />
  <Background color="#0f0a1a" />
</Scene>

// Crossfade: 3D content from both scenes is simultaneously visible.
// Useful when scenes share world-space assets and a smooth visual blend is preferred.
<Scene id="scene-3" transition="crossfade">
  <ProgressManager scrollUnits={800} />
  <Camera position={[2, 1, 6]} target={[0, 0, 0]} />
</Scene>
```

### Per-Widget `<Transition>` Component (No Change)

The per-element `<Transition>` DSL component and the raw `TransitionWindow` channel-level control system are **unchanged**. They remain the power-user API for fine-grained per-property transition timing:

```tsx
<Model id="hero" src="...">
  <Transition
    channels={['opacity']}
    exit={{ window: [0.8, 0.95], ease: easeOutCubic }}
    enter={{ window: [0.9, 1.0], ease: easeOutCubic }}
  />
</Model>
```

The scene-level `transition`/`exitStart` props set block-level defaults that per-widget `<Transition>` channel groups override.

---

## Complexity Reduction

The genuine authoring improvement is `exitStart`: authors express "how long the scene should stay before fading" directly, without deriving `blockProgress` window coordinates by hand. This replaces the need for locally-defined constant objects like `DISSOLVE_TO_BLACK` and eliminates the need to understand the internal coordinate system for the common case.

As a secondary cleanup, five library-level exports are removed because they are unused across the entire codebase (no examples, no production site, no known consumers):

| Symbol | Current Location | Action |
|---|---|---|
| `TRANSITION_DEFAULT` | `transitionPresets.ts` | Remove. Equivalent to omitting the prop. |
| `TRANSITION_CROSSFADE` | `transitionPresets.ts` | Remove. Replaced by `transition="crossfade"`. |
| `TRANSITION_SEQUENTIAL` | `transitionPresets.ts` | Remove. No use case found. |
| `TRANSITION_EXIT_FIRST` | `transitionPresets.ts` | Remove. No use case found. |
| `TRANSITION_CUT` | `transitionPresets.ts` | Remove. `"cut"` is not in MVP scope. |

**Kept (no change):**

- `TransitionWindow` type — retained as the raw escape hatch.
- `<Transition>` per-widget DSL component — unchanged.
- `makeResolver` — unchanged.
- `FunctionalTransitionSpec.defaultWindow` — unchanged (widget-level fallback in cascade).
- All easing functions (`easeLinear`, `easeOutCubic`, etc.) — unchanged; used by per-widget `<Transition>` channel groups.

---

## Migration

### Scenes Using Library Preset Constants

None of the five library constants (`TRANSITION_CROSSFADE`, `TRANSITION_SEQUENTIAL`, `TRANSITION_EXIT_FIRST`, `TRANSITION_DEFAULT`, `TRANSITION_CUT`) are used in the codebase. No migration needed.

### Architecture Scenes Using `DISSOLVE_TO_BLACK`

`DISSOLVE_TO_BLACK = { exit: [0.9, 0.95], enter: [0.95, 1.0] }` is a locally-defined constant. These scenes continue to work — raw `TransitionWindow` objects remain valid. For idiomatic migration:

```tsx
// Before
import { DISSOLVE_TO_BLACK } from '../widgetSetup';
<Scene id="arch-core" transition={DISSOLVE_TO_BLACK}>

// After — equivalent: exitStart=0.9 → mid=0.95 → exit:[0.9,0.95], enter:[0.95,1.0]
<Scene id="arch-core" exitStart={0.9}>
```

The local `DISSOLVE_TO_BLACK` constant and its import can be deleted from `widgetSetup.ts`.

### Chart Demo Using `FADE`

`FADE = { exit: [0.7, 1.0], enter: [0.0, 0.3] }` produces a 40% double-exposure overlap zone where both scenes are simultaneously at full opacity. This is an intentional design choice (both chart types visible at once for continuity). `"crossfade"` is not a migration path — it uses different windows (`exit:[0,1], enter:[0,1]`) and produces a smooth equal-blend with no double-exposure zone.

```tsx
// Before
const FADE = { exit: [0.7, 1.0], enter: [0.0, 0.3] };
<Scene id="chart-demo-bar" transition={FADE}>

// After — keep the raw window to preserve the exact intended overlap behavior
<Scene id="chart-demo-bar" transition={{ exit: [0.7, 1.0], enter: [0.0, 0.3] }}>
```

No simplification is possible here without changing the visual. Keep the raw window and delete the local `FADE` constant.

### Scenes With No `transition` Prop (Default Change)

Scenes that omit `transition` currently get exit `[0, 0.5]` / enter `[0.5, 1.0]`. After this change they get `"dissolve"` with `exitStart=0.8` (exit `[0.8, 0.9]` / enter `[0.9, 1.0]`). This is a **behavior change** — scene content will fade later and faster than before. In practice this improves all unlabeled scenes since the old default was visually broken.

---

## Implementation Details

### Files to Change

| File | Change |
|---|---|
| `packages/core/src/compiler/transitions/transitionPresets.ts` | Add `TransitionName` type and `resolveSceneTransition()` function. Remove the five named constants. |
| `packages/core/src/compiler/sceneDslCompiler.ts` | Update `<Scene>` node handler to accept `SceneTransitionProps` (discriminated union). Resolve to `TransitionWindow` via `resolveSceneTransition()` before writing `api.state.transitionWindow`. |
| `packages/core/src/compiler/sceneTrackCompiler.ts` | Update hardcoded fallback defaults (lines 465–467) from `[0, 0.5]`/`[0.5, 1.0]` to `[0.8, 0.9]`/`[0.9, 1.0]` (matching `dissolve` with `exitStart=0.8`). |
| `packages/core/src/compiler/index.ts` | Export `TransitionName`, `SceneTransitionProp`, `resolveSceneTransition`. Remove the five named constant exports. |

`SceneFrame.transitionWindow` (typed as `TransitionWindow`) does not change. The string name is resolved to a `TransitionWindow` at compile time by the DSL handler. The runtime never sees `TransitionName`.

### Compiler Resolution in `sceneDslCompiler`

```typescript
// Before
if (props.transition) {
  api.state.transitionWindow = props.transition;
}

// After
if (props.transition !== undefined || props.exitStart !== undefined) {
  api.state.transitionWindow = resolveSceneTransition(props.transition, props.exitStart);
}
```

### Fallback Default in `sceneTrackCompiler`

```typescript
// Before
const sceneExit: [number, number] =
  fromSnap.transitionWindow?.exit ?? specDefault?.exit ?? [0, 0.5];
const sceneEnter: [number, number] =
  toSnap.transitionWindow?.enter ?? specDefault?.enter ?? [0.5, 1.0];

// After — match resolveSceneTransition('dissolve', 0.8): mid = 0.9
const sceneExit: [number, number] =
  fromSnap.transitionWindow?.exit ?? specDefault?.exit ?? [0.8, 0.9];
const sceneEnter: [number, number] =
  toSnap.transitionWindow?.enter ?? specDefault?.enter ?? [0.9, 1.0];
```

This fallback only applies to `FunctionalTransitionSpec` widgets with no scene-level `transitionWindow` AND no `defaultWindow` on their spec. After the DSL-layer change, most scenes will have an explicit `transitionWindow` compiled in.

### Semver Impact

**Major version bump.** Two categories of breaking change:

1. **Removed exports**: `TRANSITION_DEFAULT`, `TRANSITION_CROSSFADE`, `TRANSITION_SEQUENTIAL`, `TRANSITION_EXIT_FIRST`, `TRANSITION_CUT`. Removing published symbols is a breaking change by semver definition regardless of actual adoption. Since all five are unused in the known codebase, the blast radius is zero — but the version bump is still required for correctness.

2. **Changed default behavior**: Scenes with no `transition` prop produce visually different output (fade timing changes). This is an observable breaking change even for consumers who don't use the library constants.

No staged release. Both changes ship in the same major version bump. The additions (`TransitionName`, `exitStart`, `resolveSceneTransition`) are bundled into the same major release.

---

## Open Questions

1. **`exitStart` default value.** Proposed default is `0.8`. This yields exit `[0.8, 0.9]` and enter `[0.9, 1.0]` — each transition half is 10% of the block. Consider:
   - `0.7`: 15% exit window, 15% enter window — more breathing room per fade.
   - `0.8`: tight fades, content-heavy. Recommended.
   - `0.9`: matches `DISSOLVE_TO_BLACK` exactly (very tight, like a snap-cut with a brief dip to black).
   The architect and engineer should validate against a live scene before locking this default.

2. **`"crossfade"` visual validation.** The windows `exit:[0,1], enter:[0,1]` are mathematically correct (opacity sum = 1, no double-exposure). But in a 3D scene, rendering two simultaneous full-scene setups (different cameras, different lighting, different geometry) may look unexpected even if the math is right. The architect should validate against a real scene before shipping `"crossfade"`. If the visual is unacceptable in practice, `"crossfade"` can be held back to a minor follow-on.

3. **`exitStart` on last scene.** If a scene author adds `exitStart={0.9}` to the last scene, the prop has no effect (there is no next scene). The compiler should emit a `CompileWarning` with code `TRANSITION_TIMING` (new code) analogous to the existing `PROGRESS_MANAGER` last-scene warning. The warning message: `"exitStart on the last scene ('<id>') has no effect. There is no outgoing transition from the final scene."` Same pattern as the ProgressManager warning.

4. **`"cut"` — future mechanism.** A true hard cut is out of this spec's scope. A follow-on spec should define what "cut" means architecturally: options include (a) a zero-tick transition block (requires `SceneTrack` changes), (b) a compiler flag that writes `absentDefault` for exit widgets and `toState` for enter widgets at all frames without a fade, or (c) authoring convention (`scrollUnits={1}` + very small default). Until that spec exists, `"cut"` is not a `TransitionName` value.

5. **`resolveSceneTransition` export scope.** The function is used internally by the compiler. It is useful for testing and for app-layer code constructing `SceneFrame` objects directly. Recommend: export it from the public API, documented as an advanced utility.

6. **Discrete path (`ElementTransitionSpec`) compatibility.** The `ElementTransitionSpec` pre-baked path uses the hardcoded `mid = Math.floor(blockSize / 2)` split (`sceneTrackCompiler.ts:430`). It does not read `transitionWindow` and will not respect `exitStart`. This is a known, documented limitation — `FunctionalTransitionSpec` widgets only. Document clearly. All new elements should use `FunctionalTransitionSpec`.

7. **Existing compiler test breakage.** The system default change from `[0, 0.5]/[0.5, 1.0]` to `[0.8, 0.9]/[0.9, 1.0]` will break any compiler test that compiles a scene without an explicit `transition` prop and then asserts on specific tick opacity values. The engineer must audit `packages/core/src/compiler/__tests__/` and update affected tests.
