---
title: "Model Transition Control — Feature Note"
doc_type: note
owner: Toolkit Product
status: draft
last_updated: 2026-03-01
---

# Model Transition Control — Feature Note for Architect

## The Problem

Right now every model transition — enter, exit, and interpolate — runs all blendable properties through a single linear `t` value that sweeps uniformly from 0 to 1 across the whole transition block. There is no way to:

1. **Control WHAT gets blended.** If you want a model to enter by fading in opacity only (no position slide, no material lerp), you can't. Everything blends together or nothing does.
2. **Control WHEN within the block each property blends.** If you want opacity to hold at zero for the first half of an enter block and then fade in over the second half, you can't express that. Timing is uniform.
3. **Apply non-linear easing.** The current `transitionT(i, frames.length)` is always linear. There is no easing hook.

This produces scenes that all feel the same: simultaneous, linear fades. We need per-property timing and easing to produce cinematic, differentiated transitions.

---

## How the System Currently Works (Architect Refresher)

The model package uses a `FunctionalTransitionSpec<SceneModelInstanceState>`:

```typescript
// packages/model/src/elements/model/compile.ts
export const functionalInstanceTransitionSpec: FunctionalTransitionSpec<SceneModelInstanceState> = {
  exitFn:        (from)       => (t) => applyModelExit(from, t),
  enterFn:       (to)         => (t) => applyModelEnter(to, t),
  interpolateFn: (from, to)   => (t) => applyModelInterpolate(from, to, t),
};
```

The outer functions are called once at compile time; the inner `(t) => T` closures are evaluated at runtime per frame. `t` is always `blockProgress` in `[0, 1]` (the compiler handles half-block remapping for exit/enter). Three entry points feed a single scalar down to `modelTransitionSpec` and `playbackTransitionSpec`, which in turn call the atomic blend helpers (`blendOpacity`, `blendVec3`, `blendNumber`, etc.).

The `applyModel*` functions currently map:

| Phase | Properties blended |
|---|---|
| `exit` | `model.opacity` (1→0), bodyPart opacities (→0), parts, playback animation `weight` (→0) |
| `enter` | `model.opacity` (0→1), bodyPart opacities (→target), parts, playback animation `weight` (→target) |
| `interpolate` | All visual props, material props, position/rotation/scale, animation (held at fromState until block end), motion commands/scenes/poses |

Everything in a given phase shares the same `t`. That's the core limitation.

---

## Proposed Feature: `<ModelTransition>` DSL Component

### Concept: Channels with Sub-Timing

Introduce the concept of a **transition channel** — a named group of properties that can be given its own `[start, end]` sub-window within the `[0, 1]` transition block, plus an optional ease function. Scene authors express this via a new `<ModelTransition>` child DSL component inside `<Model>`.

```tsx
// Scene DSL — authoring surface
<Model id="bot" type="bot">
  <ModelTransition
    enter={[
      { channel: 'opacity',   start: 0.4, end: 1.0, ease: easeOutCubic },
      { channel: 'transform', start: 0,   end: 0.6  },
    ]}
    exit={[
      { channel: 'opacity',   start: 0, end: 0.8, ease: easeInQuad },
    ]}
  />
  <Playback>
    <Animation clipName="idle" />
  </Playback>
</Model>
```

`start` and `end` are both `[0, 1]` fractions of the block for that phase. Properties not covered by any channel spec fall back to the current default behavior (linear, full-block sweep). The `ease` function is a standard `(t: number) => number` where both input and output are conceptually `[0, 1]` (overshoot is fine for spring effects).

---

## Proposed Channel Taxonomy

Keep coarse-grained channels — they map to meaningful semantic groups, not raw property names. This keeps the DSL readable and stable even if the underlying `SceneModelInstanceState` shape evolves.

| Channel | Properties it governs |
|---|---|
| `'opacity'` | `model.opacity`, bodyPart `opacity`, subpart `opacity`, part `opacity` |
| `'transform'` | `model.position`, `model.rotation`, `model.scale` |
| `'material'` | `model.metalness`, `model.roughness`, `model.metalnessMultiplier`, `model.roughnessMultiplier` |
| `'bodyParts'` | `model.bodyPartOverrides` — color, metalness, roughness (opacity covered by `'opacity'`) |
| `'parts'` | `model.parts` — position, rotation, scale, contained transform |
| `'animation'` | `playback.animation.weight` / enabled |
| `'motion'` | `playback.motion` commands, scenes, custom animations, pose groups |

When a channel is not listed in a phase's config, it gets the default behavior unchanged. When it IS listed but `start`/`end` are omitted, it defaults to `{ start: 0, end: 1, ease: linear }` — identical to today, so purely opt-in.

---

## Proposed Type Additions

### `packages/model/src/elements/model/types.ts`

```typescript
/** A pure easing function. Input and output are both conceptually [0, 1]. */
export type EaseFn = (t: number) => number;

/** Named semantic channel for model transition control. */
export type ModelTransitionChannel =
  | 'opacity'
  | 'transform'
  | 'material'
  | 'bodyParts'
  | 'parts'
  | 'animation'
  | 'motion';

/** Controls timing and easing for a single channel within a transition phase. */
export type ModelTransitionChannelSpec = {
  channel: ModelTransitionChannel;
  /** Fraction of the block at which this channel begins blending. Default: 0. */
  start?: number;
  /** Fraction of the block at which this channel finishes blending. Default: 1. */
  end?: number;
  /** Optional easing function applied to the channel's local t. Default: linear. */
  ease?: EaseFn;
};

/** Per-phase transition configuration for a model instance. */
export type ModelTransitionConfig = {
  enter?: ModelTransitionChannelSpec[];
  exit?: ModelTransitionChannelSpec[];
  interpolate?: ModelTransitionChannelSpec[];
};
```

### `packages/model/src/elements/model/types.ts` — `SceneModelInstanceState` amendment

Add an optional field that is passed through (not blended) by the transition spec:

```typescript
export type SceneModelInstanceState = {
  model: SceneModel;
  playback: ScenePlayback;
  enabled?: boolean;
  /**
   * Optional per-scene transition configuration compiled from <ModelTransition>.
   * Not blended — passed through from toState during all transition phases.
   * When absent, all channels use the default linear full-block behavior.
   */
  transitionConfig?: ModelTransitionConfig;
};
```

### `packages/model/src/elements/model/dsl.tsx` — new component

```typescript
export type ModelTransitionProps = {
  enter?: ModelTransitionChannelSpec[];
  exit?: ModelTransitionChannelSpec[];
  interpolate?: ModelTransitionChannelSpec[];
};

export const ModelTransition = (_props: ModelTransitionProps) => null;
```

---

## How compile.ts and the Functional Spec Adapt

### Channel timing resolution helper (pure, no imports)

```typescript
// In compile.ts
const resolveChannelT = (
  globalT: number,
  specs: ModelTransitionChannelSpec[] | undefined,
  channel: ModelTransitionChannel,
): number => {
  const spec = specs?.find((s) => s.channel === channel);
  if (!spec) return globalT; // default: linear, full block
  const start = spec.start ?? 0;
  const end = spec.end ?? 1;
  if (end <= start) return globalT >= end ? 1 : 0;
  const localT = Math.min(1, Math.max(0, (globalT - start) / (end - start)));
  return spec.ease ? spec.ease(localT) : localT;
};
```

### `applyModelExit` / `applyModelEnter` / `applyModelInterpolate` signature change

Each function gains an optional `channels` parameter:

```typescript
export const applyModelExit = (
  from: SceneModelInstanceState,
  t: number,
  channels?: ModelTransitionChannelSpec[],
): SceneModelInstanceState => ({
  ...from,
  model: modelTransitionSpec.exit(from.model, t, channels),
  playback: playbackTransitionSpec.exit(from.playback, t, channels),
  enabled: resolveChannelT(t, channels, 'opacity') >= 1 ? false : from.enabled,
  transitionConfig: from.transitionConfig,
});
```

`modelTransitionSpec.exit` similarly gains `channels` and replaces `blendOpacity(from.opacity ?? 1, 0, t)` with `blendOpacity(from.opacity ?? 1, 0, resolveChannelT(t, channels, 'opacity'))`, and so on for each channel group.

### Functional spec reads config from captured state

```typescript
export const functionalInstanceTransitionSpec: FunctionalTransitionSpec<SceneModelInstanceState> = {
  exitFn: (from) => {
    const channels = from.transitionConfig?.exit;
    return (t) => applyModelExit(from, t, channels);
  },
  enterFn: (to) => {
    const channels = to.transitionConfig?.enter;
    return (t) => applyModelEnter(to, t, channels);
  },
  interpolateFn: (from, to) => {
    // Incoming scene owns the interpolate config — consistent with entry-owns-transition principle
    const channels = to.transitionConfig?.interpolate;
    return (t) => applyModelInterpolate(from, to, t, channels);
  },
};
```

The outer function captures `channels` once. The inner closure is a pure `(t) => T`. No behavior change when `transitionConfig` is absent.

### `compile.ts` — ModelWidget DSL processing

`ModelWidget` already iterates DSL children to extract `Playback`, `Animation`, `Motion`, etc. It needs to additionally recognize `ModelTransition` children and compile them into `transitionConfig` on the `SceneModelInstanceState`. This is purely additive — existing scenes without `<ModelTransition>` produce `transitionConfig: undefined` and behave exactly as today.

---

## What Stays Out of Scope (For Now)

- **Per-bodyPart channel specs** — e.g., controlling `BodyPart id="head"` opacity timing independently. The coarse `'bodyParts'` channel covers the group. If per-part granularity is needed, that's a follow-on feature.
- **Spring/physics-based easing** — the `ease` function type is open; consumers can pass a spring function, but the toolkit doesn't ship built-in spring implementations. That lives in the consumer app or a future `@brewsite/easing` utility export.
- **Reverse on exit** — automatically reversing the enter curve on exit. Possible via the `ease` prop but not a first-class concept yet.
- **`<ModelTransition>` on `<BodyPart>` or `<ModelPart>` children** — sub-element transition control is a separate design problem.

---

## Backward Compatibility

This is a **fully additive, minor-version change**. No existing API changes:

- `SceneModelInstanceState` gains an optional `transitionConfig?: ModelTransitionConfig` field — existing deserialized states without it behave identically
- `applyModelExit/Enter/Interpolate` gain optional `channels?` parameters — all callers with no extra arg are unaffected
- `functionalInstanceTransitionSpec` behavior is unchanged when `transitionConfig` is absent
- `ModelTransition` is a new exported DSL component — no existing symbol changes

The only behavioral delta is on scenes that explicitly author a `<ModelTransition>` tag.

---

## Questions for the Architect to Resolve

1. **Channel enum vs. string literal type** — Should `ModelTransitionChannel` be a `const` enum (tree-shakable, inlineable) or a union of string literals (simpler, preferred in this codebase)? Current DSL type conventions suggest string literal union.

2. **`EaseFn` export location** — Should `EaseFn = (t: number) => number` live in `@brewsite/model/types` or be re-exported from `@brewsite/core/compiler/transitions`? If we ever want easing to be usable for non-model transitions (labels, diagram nodes), it belongs in core. But keep it in model for now to avoid premature abstraction.

3. **Interpolate channel ownership** — This note proposes `to.transitionConfig?.interpolate` drives interpolation (incoming scene owns it). Is there a use case where the OUTGOING scene's interpolate config should take precedence? If so, we need a merge strategy.

4. **DSL position: child vs. prop** — `<ModelTransition>` as a child component follows the established child DSL pattern (`<Playback>`, `<Motion>`, etc.). An alternative is `transition` as a prop on `<Model>` directly. The child approach is preferred because it keeps `ModelProps` narrow and allows future sub-transitions on child components. Confirm this direction.

5. **`instanceTransitionSpec` (the pre-baked path)** — Should the same channel-aware logic be applied to the discrete `ElementTransitionSpec` path as well, or only the `FunctionalTransitionSpec`? Since the functional path is preferred for new scenes, we may be able to skip the discrete path entirely, but that leaves the two specs asymmetric.

6. **Test strategy** — The `compile.ts` functions are pure. Channel timing tests should be straightforward interface-based stateful tests. Where should they live: alongside existing `ModelCompile.test.ts` in `__tests__/`, or a new `ModelTransition.test.ts`?
