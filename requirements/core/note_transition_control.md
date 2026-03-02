---
title: "Transition Control System — Core Architecture Note"
doc_type: note
owner: Toolkit Product
status: draft
last_updated: 2026-03-01
---

# Transition Control System — Core Architecture Note

## The Problem (Full Statement)

Three things are broken, in order of impact:

1. **WHEN is hardcoded.** Exit is always `bp ∈ [0, 0.5)`. Enter is always `bp ∈ [0.5, 1]`. Baked at compile time, no override at any level.

2. **WHAT has no selectivity.** You can't say "this transition only affects opacity, not transform." Every property in a closure gets the same `t` — all or nothing.

3. **HOW is a closed enum string.** The existing `transition.easing` on `<Scene>` names a curve from a hardcoded list, applied to the whole block at runtime. Wrong level, wrong mechanism.

The old `transition` property on `<Scene>`, `transitionEasings` on `SceneTrack`, and `getEasingFn` in `RuntimeDriver` are all removed. No backward compat. Designing correctly from scratch.

---

## The Governing Principle

**Core controls WHEN and WHO. Elements control WHAT.**

Core's job is to resolve — for each widget instance — a `TransitionContext` that answers: "for each named channel, what is the current `t`?" Core doesn't know what "opacity" or "transform" means; it just maps channel names to resolved `t` values. The element's closure decides what those channels do.

---

## The Design: `<Transition>` Groups

The authoring primitive is a `<Transition>` DSL component that declares:
- **Which channels** it applies to (by name — element-defined)
- **When** (a window within `[0, 1]` of the block)
- **How** (one ease function for all channels in the group)

Multiple `<Transition>` elements on a single widget are allowed. Each one is a **group**: a set of channels that share the same window and ease. This is CSS `transition: opacity 0.3s ease-out, transform 0.6s ease-in-out` — same mental model.

```tsx
<Model id="bot" type="bot">

  {/* Group 1: opacity exits fast with an ease-in */}
  <Transition
    channels={['opacity']}
    exit={{ window: [0, 0.3], ease: t => t * t }}
  />

  {/* Group 2: transform takes the whole enter window, with an ease-out */}
  <Transition
    channels={['transform']}
    enter={{ window: [0.4, 1.0], ease: t => 1 - (1 - t) ** 3 }}
  />

  {/* Group 3: animation weight gets the full default enter window */}
  <Transition
    channels={['animation']}
    enter={{ window: [0.5, 1.0] }}
  />

  {/* Channels not mentioned → widget defaultWindow → scene window → [0,0.5]/[0.5,1] */}

  <Playback><Animation clipName="idle" /></Playback>
</Model>
```

Channels not mentioned in any `<Transition>` fall through the same cascade: widget-type default → scene-level → hardcoded. So the simplest case (no `<Transition>` at all) is identical to today.

---

## Core Types

### `EaseFn` and `TransitionContext`

```typescript
// packages/core/src/compiler/transitions/transitionTypes.ts

/** A pure easing function. Input [0, 1] → output [0, 1]. */
export type EaseFn = (t: number) => number;

/**
 * Passed to every functional transition closure.
 * Replaces the bare `(t: number)` argument.
 */
export type TransitionContext = {
  /**
   * Get the resolved t for the named channel.
   * Applies the group's window and ease for this phase.
   * Returns the default t if the channel has no group assignment.
   */
  channel(name: string): number;

  /**
   * The default t — used for channels with no group assignment.
   * Comes from the phase's window + ease (or scene/spec/hardcoded fallback).
   */
  readonly t: number;
};
```

### `<Transition>` DSL Component

```typescript
export type TransitionPhase = {
  /** blockProgress range during which this group is active. */
  window?: [number, number];
  /** Ease applied within the window to all channels in this group. Default: linear. */
  ease?: EaseFn;
};

export type TransitionProps = {
  /**
   * Which element-defined channels this Transition applies to.
   * If omitted, this acts as the default group — applies to channels not
   * covered by any other <Transition> on the same element.
   */
  channels?: string[];

  /** Config for the exit phase (widget leaving). */
  exit?: TransitionPhase;

  /** Config for the enter phase (widget arriving). */
  enter?: TransitionPhase;

  /** Config for the interpolate phase (widget in both scenes). No window — always full block. */
  interpolate?: Pick<TransitionPhase, 'ease'>;
};

export const Transition = (_props: TransitionProps) => null;
```

### Updated `FunctionalTransitionSpec`

```typescript
export type TransitionWindow = {
  exit?:  [number, number];  // Widget-type default for exit. Fallback [0, 0.5].
  enter?: [number, number];  // Widget-type default for enter. Fallback [0.5, 1].
};

export type FunctionalTransitionSpec<T> = {
  exitFn:        (fromState: T)       => (ctx: TransitionContext) => T;
  enterFn:       (toState: T)         => (ctx: TransitionContext) => T;
  interpolateFn: (fromState: T, toState: T) => (ctx: TransitionContext) => T;

  /**
   * Optional widget-type default window.
   * Applied to channels with no <Transition> group assignment,
   * when no scene-level window is set.
   */
  defaultWindow?: TransitionWindow;
};
```

The discrete `ElementTransitionSpec` (pre-baked path) is left unchanged. It cannot benefit from the window system — document this as a known limitation. All new elements use the functional path.

---

## How Compiled State Carries `<Transition>` Config

Elements that accept `<Transition>` children compile them into a well-known field on their widget state. Core's compiler reads this field when building the closure wrappers.

```typescript
// A compiled representation of one <Transition> group
export type CompiledTransitionGroup = {
  channels?: string[];                        // undefined = default group
  exit?:        { window: [number, number]; ease?: EaseFn };
  enter?:       { window: [number, number]; ease?: EaseFn };
  interpolate?: { ease?: EaseFn };
};

// Duck-typed field — any widget state can carry this
export type WithTransitionConfig = {
  __transitionGroups?: CompiledTransitionGroup[];
};
```

In `ModelWidget`, collecting `<Transition>` children:

```typescript
const groups: CompiledTransitionGroup[] = [];
for (const child of children) {
  if (child.type === Transition) {
    const p = child.props as TransitionProps;
    groups.push({
      channels: p.channels,
      exit:        p.exit?.window  ? { window: p.exit.window,  ease: p.exit.ease  } : undefined,
      enter:       p.enter?.window ? { window: p.enter.window, ease: p.enter.ease } : undefined,
      interpolate: p.interpolate   ? { ease: p.interpolate.ease }                   : undefined,
    });
  }
}
if (groups.length > 0) {
  compiledState.__transitionGroups = groups;
}
```

`__transitionGroups` is passed through all blend functions unchanged — it is config metadata, not blendable state.

---

## How the Compiler Builds the Wrappers

### Step 1: Build the channel resolver factory

At compile time, when building the functional wrapper for a widget, the compiler constructs the channel lookup:

```typescript
// sceneTrackCompiler.ts — inside the functional path block

const groups = (toState as WithTransitionConfig)?.__transitionGroups ?? [];

// Build a channel-name → group index map
const channelGroupIndex = new Map<string, number>();
let defaultGroupIndex = -1;
for (let i = 0; i < groups.length; i++) {
  const g = groups[i]!;
  if (!g.channels) { defaultGroupIndex = i; continue; }
  for (const ch of g.channels) channelGroupIndex.set(ch, i);
}

// Resolve scene-level and spec-level fallback windows
const sceneExit  = toSnap.transitionWindow?.exit  ?? transitionSpec.defaultWindow?.exit  ?? [0, 0.5]  as [number, number];
const sceneEnter = toSnap.transitionWindow?.enter ?? transitionSpec.defaultWindow?.enter ?? [0.5, 1.0] as [number, number];

const makeExitResolver = (bp: number): TransitionContext => {
  // Compute default t first
  const [ds, de] = sceneExit;
  const dSpan = de - ds;
  const defaultT = dSpan <= 0 ? 1 : Math.min(1, Math.max(0, (bp - ds) / dSpan));
  const defaultGroup = defaultGroupIndex >= 0 ? groups[defaultGroupIndex] : undefined;
  const defaultEase = defaultGroup?.exit?.ease;
  const t = defaultEase ? defaultEase(defaultT) : defaultT;

  return {
    t,
    channel(name: string): number {
      const gi = channelGroupIndex.get(name) ?? defaultGroupIndex;
      if (gi < 0) return t;
      const g = groups[gi]!;
      const phase = g.exit;
      if (!phase) return t;  // Group has no exit config → use default
      const [s, e] = phase.window ?? sceneExit;
      const span = e - s;
      const localT = span <= 0 ? 1 : Math.min(1, Math.max(0, (bp - s) / span));
      return phase.ease ? phase.ease(localT) : localT;
    },
  };
};
// makeEnterResolver and makeInterpolateResolver are analogous
```

### Step 2: Build the closure

```typescript
if (inFrom) {
  const rawFn = transitionSpec.exitFn(fromState);
  // The exit window used for "is this widget active?" comes from the default group
  // or scene/spec fallback. Individual channels may be active for different windows,
  // but the widget is considered "present" as long as ANY channel is active.
  const [exitStart, exitEnd] = defaultGroup?.exit?.window ?? sceneExit;

  tBlock.widgetFns[widgetId] = {
    fn: (bp: number) => {
      if (bp >= exitEnd) return absentDefault;
      return rawFn(makeExitResolver(bp));
    },
    kind: 'exit',
  };
}
```

The key decision: **the widget's "absent" boundary** is driven by the default group's window (or scene/spec fallback). Individual channels within the closure may still be at `t = 0` after that boundary — the widget simply won't be evaluated anymore. This is clean: the widget lifetime is controlled by the default window; per-channel timing only matters while the widget is alive.

---

## Scene-Level Window (Block Default)

Scene-level config is kept, window only. No easing — easing now belongs at the instance level.

```typescript
// SceneTransitionConfig (replaces the old { easing: EasingName })
transition?: {
  exit?:  [number, number];  // Applies to all widgets without their own <Transition> group
  enter?: [number, number];
};
```

```tsx
<Scene id="scene-3" transition={{ exit: [0, 0.3], enter: [0.3, 1.0] }}>
  ...
</Scene>
```

---

## Named Presets

Plain config constants for common block-level patterns:

```typescript
// packages/core/src/compiler/transitions/transitionPresets.ts

export const TRANSITION_DEFAULT:     { exit: [number, number]; enter: [number, number] } = { exit: [0, 0.5],   enter: [0.5, 1.0]  };
export const TRANSITION_CROSSFADE:   { exit: [number, number]; enter: [number, number] } = { exit: [0, 1.0],   enter: [0, 1.0]    };
export const TRANSITION_SEQUENTIAL:  { exit: [number, number]; enter: [number, number] } = { exit: [0, 0.45],  enter: [0.55, 1.0] };
export const TRANSITION_EXIT_FIRST:  { exit: [number, number]; enter: [number, number] } = { exit: [0, 0.5],   enter: [0.65, 1.0] };
export const TRANSITION_CUT:         { exit: [number, number]; enter: [number, number] } = { exit: [0, 0],     enter: [1, 1]      };
```

Usage:
```tsx
<Scene id="scene-3" transition={TRANSITION_EXIT_FIRST}>...</Scene>

// Or per-instance with a preset:
<Model id="bot" type="bot">
  <Transition enter={{ window: TRANSITION_EXIT_FIRST.enter, ease: easeOutCubic }} />
</Model>
```

---

## Runtime Changes

**`RuntimeDriver` becomes simpler.** The easing lookup is removed entirely:

```typescript
// BEFORE:
const easingName = this.track?.transitionEasings?.[tick.sceneIndex];
const bp = easingName ? getEasingFn(easingName)(tick.blockProgress) : tick.blockProgress;
state = functionalWidget.fn(bp);

// AFTER:
state = functionalWidget.fn(tick.blockProgress);
```

The closure itself builds the `TransitionContext` from `blockProgress`. The runtime passes `blockProgress` raw, always — all timing logic is compile-time.

---

## What an Element's Updated Closure Looks Like

**Naïve migration (identical behavior to today):**
```typescript
exitFn: (from) => (ctx) => applyModelExit(from, ctx.t),
enterFn: (to)  => (ctx) => applyModelEnter(to, ctx.t),
```

**Selective channels (what the user actually wants):**
```typescript
exitFn: (from) => (ctx) => ({
  ...from,
  model: {
    ...from.model,
    opacity: blendOpacity(from.model.opacity ?? 1, 0, ctx.channel('opacity')),
    // position/rotation/scale NOT blended — not in the exit channels
    position: from.model.position,
    rotation: from.model.rotation,
    scale:    from.model.scale,
  },
  playback: {
    ...from.playback,
    animation: {
      ...from.playback.animation,
      weight: blendNumber(from.playback.animation.weight ?? 1, 0, ctx.channel('animation')),
    },
  },
  enabled: ctx.channel('opacity') >= 1 ? false : from.enabled,
  __transitionGroups: from.__transitionGroups,
}),
```

When the scene author writes:
```tsx
<Transition channels={['opacity']} exit={{ window: [0, 0.3], ease: t => t * t }} />
<Transition channels={['animation']} exit={{ window: [0, 0.5] }} />
```

The `ctx.channel('opacity')` call returns a value that runs 0→1 over the first 30% of the block with an ease-in-squared curve. `ctx.channel('animation')` runs 0→1 over the first 50% linearly. `ctx.channel('transform')` — not assigned to any group — returns `ctx.t` (the default exit window). The element closure controls whether it actually uses `ctx.channel('transform')` at all; if the element simply doesn't call it for position/rotation/scale, those properties never blend, regardless of what `t` would be.

This is the key insight: **the element decides which properties participate in blending by choosing which channel calls to use.** The scene author decides what timing and easing each channel gets. Neither knows about the other's internals.

---

## What Changes Where

### Core (`packages/core/src/`)

| File | Change |
|---|---|
| `compiler/transitions/transitionTypes.ts` | Add `EaseFn`, `TransitionContext`, `TransitionPhase`, `TransitionProps`, `CompiledTransitionGroup`, `WithTransitionConfig`. Update `FunctionalTransitionSpec` signatures. Add `TransitionWindow`. |
| `compiler/transitions/transitionPresets.ts` | New — named window constants. |
| `compiler/sceneTrackCompiler.ts` | Replace hardcoded `0.5` with cascade resolution + `makeResolver` factories. Remove `transitionEasings` collection (lines 431–434). |
| `compiler/sceneTrackTypes.ts` | Remove `transitionEasings` from `SceneTrack`. |
| `compiler/index.ts` | Export `Transition`, `TransitionProps`, `EaseFn`, presets. Remove `EasingName`. |
| `compiler/sceneTypes.ts` | Update `transition?` type to `{ exit?: [number, number]; enter?: [number, number] }`. |
| `runtime/RuntimeDriver.ts` | Remove easing lookup + `getEasingFn`. Simplify to `fn(tick.blockProgress)`. |

### Model (`packages/model/src/`)

| File | Change |
|---|---|
| `elements/model/types.ts` | Add `__transitionGroups?: CompiledTransitionGroup[]` to `SceneModelInstanceState`. |
| `elements/model/compile.ts` | Update closures to accept `TransitionContext`. Use `ctx.channel('opacity')` etc. Pass `__transitionGroups` through. |
| `elements/model/dsl.tsx` | Remove `ModelTransition` (superseded by core `<Transition>`). |
| `ModelWidget.ts` | Collect `<Transition>` children → compile to `__transitionGroups`. |

---

---

## Per-Package Adoption Guide

There are 10 elements across 4 packages that need to adopt this system. Before listing them individually, the key insight the user flagged: **some elements have hierarchical child groups**, and those child groups need to carry their own transition config independently of the parent. This is not a minor detail — it shapes how the `__transitionGroups` field propagates through the state tree.

---

### Structural Patterns

Every element falls into one of three structural patterns. The pattern determines how the element's blend functions consume `TransitionContext`.

---

#### Pattern 1 — Flat

Single widget state, single level of properties. The element's closure uses `ctx.channel(name)` directly for each top-level property group.

*Examples: Background, Floor, Environment, Chart, ImagePanel, Screen*

```typescript
// Closure:
exitFn: (from) => (ctx) => ({
  ...from,
  opacity: blendOpacity(from.opacity ?? 1, 0, ctx.channel('opacity')),
  position: from.position,  // 'transform' channel not called → holds position
})
```

---

#### Pattern 2 — Multi-Level (Flat Widget, Nested State)

Single widget state, but the state contains maps or arrays of sub-elements (body parts, lights, motion commands). The parent closure uses different channel calls for different depth levels. The sub-elements are **not** separately addressable from the DSL — there is no `<BodyPart>` containing `<Transition>` at scene-authoring time; the body part config is written at the model definition level.

*Examples: Model (body parts, motion), Lighting (light instances), Diagram (nodes, edges)*

```typescript
// Closure: different channel calls at different levels
exitFn: (from) => (ctx) => ({
  ...from,
  opacity:          blendOpacity(from.opacity ?? 1, 0, ctx.channel('opacity')),
  bodyPartOverrides: blendBodyOverrides(from.bodyPartOverrides, undefined,
                       ctx.channel('bodyParts')),  // sub-level channel
  playback: {
    animation: { weight: blendNumber(from.animation.weight ?? 1, 0, ctx.channel('animation')) }
  },
})
```

---

#### Pattern 3 — Container with Addressable Children

The element contains multiple **named child instances** (each with its own DSL identity), compiled into a keyed map in the parent state. Each child can declare its own `<Transition>` config in the scene DSL. The parent's blend function creates a **per-child `TransitionContext`** by reading each child's stored `__transitionGroups`.

*Examples: DiagramCanvas (contains multiple Diagram children), potentially Model with named ModelParts*

This is the hierarchically complex case. The child's compiled substate carries its own `__transitionGroups`, and the parent's blend function does:

```typescript
// Parent blend iterates child states:
for (const [childId, fromChild] of Object.entries(fromChildren)) {
  const toChild = toChildren[childId];

  // Build child-specific context from child's own __transitionGroups
  const childCtx = makeResolver(
    globalT,
    toChild?.__transitionGroups ?? fromChild.__transitionGroups,
    fallbackWindow,
  );

  blendedChildren[childId] = blendChildState(fromChild, toChild, childCtx);
}
```

The scene-authoring surface for a Pattern 3 element:

```tsx
<DiagramCanvas id="main">
  {/* Canvas-level transition — controls the whole canvas widget */}
  <Transition channels={['opacity']} enter={{ window: [0.3, 0.8], ease: easeOutCubic }} />

  {/* Child diagram 1 — stagger its node entrance */}
  <Diagram id="backend">
    <Transition channels={['nodes']} enter={{ window: [0.5, 1.0] }} />
    <Transition channels={['edges']} enter={{ window: [0.7, 1.0] }} />
  </Diagram>

  {/* Child diagram 2 — enters later */}
  <Diagram id="frontend">
    <Transition channels={['nodes']} enter={{ window: [0.6, 1.0] }} />
  </Diagram>
</DiagramCanvas>
```

The `<Transition>` on `<DiagramCanvas>` compiles into `diagramCanvasState.__transitionGroups`. The `<Transition>` on each `<Diagram>` child compiles into that diagram's compiled substate `__transitionGroups`. When the DiagramCanvas closure runs, it builds the canvas-level context from its own groups, then builds per-diagram contexts from each diagram child's groups.

**`makeResolver` needs to be exported from core** so element packages can call it in their own blend functions. The signature:

```typescript
// Export from packages/core/src/compiler/transitions/transitionTypes.ts
export declare function makeResolver(
  globalT:       number,
  groups:        CompiledTransitionGroup[] | undefined,
  fallbackWindow: [number, number],
): TransitionContext;
```

---

### `@brewsite/core` Elements

The 5 core elements all have both `ElementTransitionSpec` and `FunctionalTransitionSpec`. The discrete spec stays frozen; only the functional spec is updated.

---

#### Background

**Pattern:** 1 (Flat)

**Channel taxonomy:**

| Channel | Properties |
|---|---|
| `'opacity'` | `opacity` — the primary fade; also the crossfade opacity calculation |
| `'color'` | `color` — background solid color |
| `'image'` | `imageUrl`, `cssPosition`, `cssSize`, `cssRepeat` — content slots that currently switch at `t = 0.5` |
| `'position'` | `position` — 3D position of the background plane |

**Migration note:** The `imageUrl` currently hard-switches at `t = 0.5`. With `ctx.channel('image')`, the element closure can still switch at `t >= 0.5` but the scene author can now delay that threshold by adjusting the `'image'` channel window.

---

#### Camera

**Pattern:** 1 (Flat) — but camera is almost always in the interpolate path (present in both scenes). Exit/enter only toggle `enabled`.

**Channel taxonomy:**

| Channel | Properties |
|---|---|
| `'position'` | Camera descriptor position/target/orbit/path — the spatial aspect |
| `'lens'` | `fov`, `focalLength`, `filmGauge`, `near`, `far` — optical properties |
| `'post'` | `exposure` — post-processing |
| `'enabled'` | `enabled` toggle on enter/exit |

**Migration note:** Camera's interpolate path has rich Bezier/path/orbit blending logic. The `ctx.t` default covers this case. Channel control on camera is primarily useful when cross-fading between wildly different camera positions — e.g., easing only `'lens'` while `'position'` uses a different curve. Low-priority adoption.

---

#### Lighting

**Pattern:** 2 (Multi-Level) — lighting state contains arrays of point lights, spots, strands, and panels identified by ID.

**Channel taxonomy:**

| Channel | Properties |
|---|---|
| `'intensity'` | `ambient.intensity`, `directional.intensity`, per-light `intensity` — the primary fade |
| `'color'` | `ambient.color`, `directional.color`, per-light `color` |
| `'position'` | `directional.position`, per-light `position` |
| `'structure'` | Governs add/remove of light instances during interpolate. Controls when a new light appears vs. disappears. |

**Migration note:** Lighting's interpolate path has complex ID-keyed add/remove semantics (a light present in `toState` but absent from `fromState` fades in; the reverse fades out). The `'structure'` channel controls the timing of those additions/removals. This is medium-priority — most scenes don't need fine-grained lighting transition control.

---

#### Floor

**Pattern:** 1 (Flat) — very simple state.

**Channel taxonomy:**

| Channel | Properties |
|---|---|
| `'visibility'` | `enabled` toggle — the main thing floor does on transition |
| `'transform'` | `position`, `rotation`, `scale` — currently hard-switches at `t = 0.5`, not blended |
| `'surface'` | `surface` material properties |

**Migration note:** Floor currently does almost no blending — it just gates on `enabled`. The `'transform'` channel can now optionally blend position/rotation/scale if the scene author requests it. Low-priority adoption.

---

#### Environment

**Pattern:** 1 (Flat)

**Channel taxonomy:**

| Channel | Properties |
|---|---|
| `'intensity'` | `intensity` — HDR map exposure; the primary fade |
| `'source'` | `source` URL — currently hard-switches at `t = 0.5` |

**Migration note:** Same switch-at-0.5 pattern as Background's `imageUrl`. The `'source'` channel enables controlling when the HDR switches. Low-priority adoption.

---

### `@brewsite/model` Elements

One widget: `ModelWidget` / `SceneModelInstanceState`.

**Pattern:** 2 (Multi-Level)

**Channel taxonomy:**

| Channel | Properties |
|---|---|
| `'opacity'` | `model.opacity`, all `bodyPartOverrides` opacities, all `parts` opacities, all `subparts` opacities |
| `'transform'` | `model.position`, `model.rotation`, `model.scale` |
| `'material'` | `model.metalness`, `model.roughness`, `model.metalnessMultiplier`, `model.roughnessMultiplier` |
| `'bodyParts'` | `bodyPartOverrides` color, metalness, roughness (not opacity — that's `'opacity'`) |
| `'parts'` | `parts` position, rotation, scale, containedTransform |
| `'animation'` | `playback.animation.weight` / enabled |
| `'motion'` | `playback.motion` commands, scenes, customAnimations, pose groups |

**Migration note:** This is the highest-priority adoption. The model is the element that triggered this entire design. The `functionalInstanceTransitionSpec` already has all blend logic isolated in `applyModelExit/Enter/Interpolate` — it's a clean rename from `t` to `ctx.t` for the naïve migration, then gradual channel adoption. The earlier model note (`requirements/model/note_model_transition_control.md`) should be updated to reference this core mechanism and strip its now-superseded mechanism sections, keeping only the channel taxonomy table above.

**Note on `<ModelPart>` children:** Individual `<ModelPart id="sword">` children in the DSL are compiled into `SceneModelInstanceState.model.parts[id]`. If per-part transition config becomes needed, each `<ModelPart>` could carry its own `<Transition>` child compiling into `parts[id].__transitionGroups` — Pattern 3 territory. Defer until there is a concrete authoring need.

---

### `@brewsite/diagram` Elements

Four widgets: Diagram, DiagramCanvas, ImagePanel, Screen.

---

#### ImagePanel

**Pattern:** 1 (Flat)

**Channel taxonomy:**

| Channel | Properties |
|---|---|
| `'opacity'` | `opacity`, `glowOpacity` |
| `'transform'` | `position`, `rotation`, `scale` |
| `'surface'` | `gloss`, `selfIllumination` |
| `'content'` | `src`, `bezel` — currently hard-switches at `t = 0.5` |

---

#### Screen

**Pattern:** 1 (Flat)

**Channel taxonomy:**

| Channel | Properties |
|---|---|
| `'opacity'` | `opacity`, `glowOpacity` |
| `'transform'` | `position`, `rotation`, `scale` |
| `'content'` | `src`, `bezel`, `width`, `height` — currently hard-switches at `t = 0.5` |

---

#### Diagram

**Pattern:** 2 (Multi-Level) — state contains keyed maps of nodes, edges, and groups with ID-keyed add/remove/morph semantics.

**Channel taxonomy:**

| Channel | Properties |
|---|---|
| `'opacity'` | All node opacities, all edge opacities, all group opacities — the primary fade |
| `'layout'` | Node positions during interpolate |
| `'edges'` | Edge control points during interpolate |
| `'nodes'` | Node color, scale, label — non-positional node properties |
| `'groups'` | Group opacity, bounds |
| `'transform'` | Diagram root `position`, `rotation`, `scale` |

---

#### DiagramCanvas

**Pattern:** 3 (Container with Addressable Children) — contains multiple `<Diagram>` children by ID, each of which can carry its own `<Transition>` config.

**Channel taxonomy (canvas level):**

| Channel | Properties |
|---|---|
| `'opacity'` | Canvas-wide opacity applied as a multiplier over all children |
| `'transform'` | Canvas root `position`, `rotation`, `scale` |
| `'camera'` | Diagram orthographic camera position/zoom |
| `'pipes'` | Connection pipe opacities and control points |

**Child-level channels** are the Diagram channel taxonomy above, evaluated per `<Diagram>` child instance.

**Migration note:** DiagramCanvas is the most architecturally involved adoption. Its blend function must:
1. Build canvas-level `TransitionContext` from `canvasState.__transitionGroups` (canvas `<Transition>` children)
2. For each keyed child diagram, build a per-child `TransitionContext` from `childState.__transitionGroups` (diagram `<Transition>` children)
3. Pass the per-child context into the diagram blend functions

`makeResolver` (exported from core) is the key utility for step 2. This makes the pattern consistent: every container element calls `makeResolver(globalT, child.__transitionGroups, fallbackWindow)` to get the child's context.

---

### `@brewsite/charts` Elements

One widget: Chart.

**Pattern:** 1 (Flat)

**Channel taxonomy:**

| Channel | Properties |
|---|---|
| `'opacity'` | `opacity` — the primary fade |
| `'transform'` | `position`, `rotation`, `scale` |
| `'type'` | `type` — chart type; currently hard-switches at `t = 0.5` |

**Migration note:** Charts are currently very simple on the transition front. Low-priority adoption. The `'type'` channel enables controlling when the chart type switches (useful if you want to dissolve one type before revealing the next).

---

### Adoption Priority

Given the note that no backward compat is needed, all elements can be migrated in one pass. But if phased:

| Priority | Element | Why |
|---|---|---|
| **1 — Immediate** | Model | Triggered this design; website actively needs it |
| **1 — Immediate** | DiagramCanvas | Most complex pattern; validates the architecture |
| **2 — Soon** | Background | Frequently authored; `imageUrl` switch timing is a real pain point |
| **2 — Soon** | ImagePanel, Screen | Simple Pattern 1; quick wins |
| **2 — Soon** | Diagram | Unblocks per-diagram child transitions |
| **3 — Later** | Lighting | Medium complexity; no urgent authoring need |
| **3 — Later** | Camera | Mostly interpolate; low urgency |
| **3 — Later** | Environment, Floor, Chart | Simple but rarely transition-critical |

---

## Open Questions for the Architect

1. **Widget "absent" boundary when channels have different windows.** The current proposal: the default group (no `channels` prop) or the scene/spec fallback drives the "active vs absent" determination. Individual channels can be at `t = 0` at the start or `t = 1` before the block ends, but the widget is evaluated for the full default window. Is this right? Alternative: the widget is active as long as ANY channel has a non-trivial t. More flexible but more complex to implement.

2. **`<Transition>` with no `channels` prop.** This is the "default group" — it applies to any channel the element calls that isn't assigned to a named group. This is a clean escape hatch for "I just want to override the window for everything." Confirm this is the right fallback behavior.

3. **Multiple `<Transition>` elements — conflict resolution.** If two `<Transition>` elements both list `'opacity'` in their `channels`, which wins? Recommend: first one listed wins (document this). The compiler builds the lookup in order and skips duplicates.

4. **`ctx.channel()` for interpolate.** The interpolate phase is already the richest path (both scenes present, full `[0, 1]` block). Groups with no `interpolate` config specified — do they use `ctx.t` (the block progress), or do they pass-through with no blending override? Since interpolate always covers the full block, the "window" concept doesn't apply. Only `ease` is meaningful for interpolate. Recommend: `ctx.channel('name')` during interpolate applies only the group's ease (if any), with no windowing.

5. **`__transitionGroups` ownership during exit.** The `__transitionGroups` is read from `toState` (incoming scene) for enter/interpolate. For exit, the outgoing scene's config should drive it, meaning it should come from `fromState.__transitionGroups`. The compiler should read from the appropriate endpoint per phase. Confirm.

6. **Discrete path.** The `ElementTransitionSpec` pre-baked path's `mid` split stays as-is. This is a known, documented limitation. No one is using the discrete path for new elements.
