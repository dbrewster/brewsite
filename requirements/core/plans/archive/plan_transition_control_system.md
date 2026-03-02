---
title: "Transition Control System — Implementation Plan"
doc_type: plan
owner: Toolkit Architect
status: complete
updated: 2026-03-02
---

# Transition Control System — Implementation Plan

## Summary

This is a **breaking, no-backward-compat** rewrite of the transition timing and easing system across all four BrewSite packages. The old `transition.easing` string enum on `<Scene>`, `SceneTrack.transitionEasings`, and `RuntimeDriver.getEasingFn` are removed entirely. The new system gives scene authors per-channel timing and easing control via a `<Transition>` DSL component on any renderable element.

**Governing principle (from the note):** Core controls WHEN and WHO. Elements control WHAT. Core resolves a `TransitionContext` per widget per tick. The element's closure decides what its channels do.

**Scope:** 4 packages × ~20 files. No new packages. No new runtime concepts beyond `TransitionContext`. The `ElementTransitionSpec` (discrete/pre-baked path) is left frozen — documented limitation.

---

## Package Dependency Direction (unchanged, verified)

```
@brewsite/diagram  ──imports──▶  @brewsite/core
@brewsite/model    ──imports──▶  @brewsite/core
@brewsite/charts   ──imports──▶  @brewsite/core
```

All new types flow from `@brewsite/core`. External packages import `TransitionContext`, `CompiledTransitionGroup`, `WithTransitionConfig`, `EaseFn`, and `makeResolver` from `@brewsite/core`.

---

## Files Overview

### New files
| File | Package | Purpose |
|---|---|---|
| `compiler/blocks/transition.tsx` | core | `<Transition>` DSL component + `TransitionProps` type |
| `compiler/transitions/transitionPresets.ts` | core | Named window constants + named `EaseFn` constants |

### Modified files (core)
| File | Changes |
|---|---|
| `compiler/transitions/transitionTypes.ts` | Add `EaseFn`, `TransitionContext`, `TransitionPhase`, `TransitionProps`, `CompiledTransitionGroup`, `WithTransitionConfig`, `TransitionWindow`; update `FunctionalTransitionSpec` signatures. **Pure types only — no runtime functions.** |
| `compiler/transitions/transitionResolver.ts` | **New** — exports `makeResolver` runtime function. Imports types from `transitionTypes.ts`. |
| `compiler/sceneTrackTypes.ts` | Replace `SceneFrame.transitionEasing` with `transitionWindow`; remove `SceneTrack.transitionEasings`; remove `EasingName` re-export |
| `compiler/sceneTrackCompiler.ts` | Replace hardcoded `0.5` split with resolver factories; remove `transitionEasings` collection; pass `TransitionContext` to closures |
| `compiler/sceneDslCompiler.ts` | Update `Scene` props `transition?` type; update `sceneRootHandler` to write `transitionWindow`; remove `EasingName` import |
| `compiler/coreHandlers.ts` | Register `Transition` with no-op handler (makes it a "primitive" so the compiler doesn't call it as a function) |
| `compiler/index.ts` | Export `Transition`, `TransitionProps`, `EaseFn`, presets; remove `EasingName` |
| `runtime/RuntimeDriver.ts` | Remove easing lookup; pass `tick.blockProgress` directly to `fn()`; remove `getEasingFn` import |
| `compiler/transitions/easingFunctions.ts` | **Delete** — move named easing function bodies to `transitionPresets.ts` |

### Modified files (model)
| File | Changes |
|---|---|
| `elements/model/types.ts` | Add `__transitionGroups?: CompiledTransitionGroup[]` to `SceneModelInstanceState` |
| `elements/model/compile.ts` | Update `applyModelExit`, `applyModelEnter`, `applyModelInterpolate` to accept `TransitionContext` instead of `t: number`; update `functionalInstanceTransitionSpec` signatures |
| `elements/model/ModelWidget.ts` | Collect `<Transition>` children in `CUSTOM_NODE_HANDLER`; compile to `__transitionGroups`; add `Transition` to `childDslComponents` |

### Modified files (diagram)
| File | Changes |
|---|---|
| `elements/image-panel/compile.ts` | Update `functionalImagePanelTransitionSpec` signatures |
| `elements/image-panel/types.ts` | Add `__transitionGroups?: CompiledTransitionGroup[]` |
| `elements/screen/compile.ts` | Update functional transition spec signatures |
| `elements/screen/types.ts` | Add `__transitionGroups?: CompiledTransitionGroup[]` |
| `elements/diagram/compile.ts` | Update `applyDiagramExit`, `applyDiagramEnter`, diagram interpolate blend; accept `TransitionContext` |
| `elements/diagram/types.ts` | Add `__transitionGroups?: CompiledTransitionGroup[]` to `DiagramState` |
| `elements/diagram/canvas/compile.ts` | Update canvas transition spec; build per-child `TransitionContext` from child `__transitionGroups` |
| `elements/diagram/canvas/types.ts` | Add `__transitionGroups?: CompiledTransitionGroup[]` to `DiagramCanvasState` |
| `elements/diagram/widget.ts` | Collect `<Transition>` children; compile to `__transitionGroups` |
| `elements/diagram/canvas/widget.ts` | Collect `<Transition>` children; compile to `__transitionGroups` |

### Modified files (charts)
| File | Changes |
|---|---|
| `elements/chart/compile.ts` | Update `functionalChartTransitionSpec` signatures |
| `elements/chart/types.ts` | Add `__transitionGroups?: CompiledTransitionGroup[]` to `ChartState` |
| `elements/chart/ChartWidget.ts` | Collect `<Transition>` children; compile to `__transitionGroups` |

---

## Phase 1 — Core Type Foundation

### 1.1 — `compiler/transitions/transitionTypes.ts`

Add the following types and the `makeResolver` function. Keep all existing exports unchanged — this file grows, nothing is removed (types for the old system are removed in 1.3 when `EasingName` goes away, but all blend utilities stay).

**New types to add:**

```typescript
// packages/core/src/compiler/transitions/transitionTypes.ts

/** A pure easing function. Input [0, 1] → output [0, 1]. */
export type EaseFn = (t: number) => number;

/**
 * Passed to every functional transition closure instead of bare `(t: number)`.
 * Replaces the scalar t contract from the pre-v2 FunctionalTransitionSpec.
 */
export type TransitionContext = {
  /**
   * Get the resolved t for the named channel.
   * Applies the group's window and ease for this phase.
   * Falls back to ctx.t if the channel has no group assignment.
   */
  channel(name: string): number;

  /**
   * The default t — used for channels with no group assignment.
   * Derived from the default group (or scene/spec/hardcoded fallback) window + ease.
   */
  readonly t: number;

  /**
   * The raw blockProgress ∈ [0, 1] for this tick.
   * Container elements (Pattern 3) use this to build per-child TransitionContexts
   * by calling makeResolver(ctx.bp, child.__transitionGroups, fallbackWindow, phase).
   */
  readonly bp: number;
};

/** Per-phase config on a <Transition> group. */
export type TransitionPhase = {
  /** blockProgress window during which this group is active. Omit to use default. */
  window?: [number, number];
  /** Ease applied within the window. Default: linear. */
  ease?: EaseFn;
};

/** Widget-type default window — applied when no scene-level window is set. */
export type TransitionWindow = {
  exit?:  [number, number];
  enter?: [number, number];
};

/**
 * A compiled <Transition> group as stored in widget state.
 * Produced by element CUSTOM_NODE_HANDLERs during DSL compilation.
 */
export type CompiledTransitionGroup = {
  /** Which channels this group applies to. Undefined = default group (catches unassigned channels). */
  channels?: string[];
  exit?:        { window: [number, number]; ease?: EaseFn };
  enter?:       { window: [number, number]; ease?: EaseFn };
  interpolate?: { ease?: EaseFn };
};

/**
 * Duck-typed field present on any widget state that carries <Transition> config.
 * Passed through blend functions unchanged — it is config metadata, not blendable state.
 */
export type WithTransitionConfig = {
  __transitionGroups?: CompiledTransitionGroup[];
};
```

**Updated `FunctionalTransitionSpec`:**

```typescript
export type FunctionalTransitionSpec<T> = {
  exitFn:        (fromState: T)             => (ctx: TransitionContext) => T;
  enterFn:       (toState: T)               => (ctx: TransitionContext) => T;
  interpolateFn: (fromState: T, toState: T) => (ctx: TransitionContext) => T;

  /**
   * Optional widget-type default window.
   * Applied to channels with no <Transition> group assignment when no scene-level
   * window is declared. Fallback: [0, 0.5] for exit, [0.5, 1.0] for enter.
   */
  defaultWindow?: TransitionWindow;
};
```

**`makeResolver` moves to a new file — see Phase 1.1b below. Do not add it to `transitionTypes.ts`.**

---

### 1.1b — `compiler/transitions/transitionResolver.ts` (new file)

`transitionTypes.ts` is a pure-types file. `makeResolver` is a runtime function and belongs in its own file.

```typescript
// packages/core/src/compiler/transitions/transitionResolver.ts
import { clamp01 } from './transitionTypes';
import type { TransitionContext, CompiledTransitionGroup, EaseFn } from './transitionTypes';

/**
 * Builds a TransitionContext for a given blockProgress + compiled groups.
 *
 * @param bp - Raw blockProgress ∈ [0, 1].
 * @param groups - Compiled <Transition> groups from __transitionGroups (or undefined).
 * @param fallbackWindow - Resolved fallback window for this phase [start, end].
 * @param phase - Which phase we are building a context for.
 *
 * Context semantics:
 *   ctx.t     — default t after window + ease (default group or fallback)
 *   ctx.bp    — raw blockProgress (passed through for container element use)
 *   ctx.channel(name) — per-channel t after that channel's group window + ease
 */
export function makeResolver(
  bp: number,
  groups: CompiledTransitionGroup[] | undefined,
  fallbackWindow: [number, number],
  phase: 'exit' | 'enter' | 'interpolate',
): TransitionContext {
  const gs = groups ?? [];

  // Build channel → group index map; identify the default group index.
  const channelGroupIndex = new Map<string, number>();
  let defaultGroupIndex = -1;
  for (let i = 0; i < gs.length; i++) {
    const g = gs[i]!;
    if (!g.channels) { defaultGroupIndex = i; continue; }
    for (const ch of g.channels) {
      if (!channelGroupIndex.has(ch)) channelGroupIndex.set(ch, i); // first wins
    }
  }

  const defaultGroup = defaultGroupIndex >= 0 ? gs[defaultGroupIndex] : undefined;

  // Compute default t from the default group's phase config (if any) or fallback.
  const defPhaseConfig =
    phase === 'exit'        ? defaultGroup?.exit
    : phase === 'enter'     ? defaultGroup?.enter
    : defaultGroup?.interpolate;

  // For exit/enter: use the group's declared window, or fallback.
  // For interpolate: window concept does not apply — only ease.
  const effectiveWindow: [number, number] =
    phase !== 'interpolate' && defPhaseConfig && 'window' in defPhaseConfig
      ? (defPhaseConfig as { window: [number, number]; ease?: EaseFn }).window
      : fallbackWindow;

  const [ws, we] = effectiveWindow;
  const wSpan = we - ws;
  const rawT = wSpan <= 0 ? 1 : clamp01((bp - ws) / wSpan);
  const t = defPhaseConfig?.ease ? defPhaseConfig.ease(rawT) : rawT;

  return {
    t,
    bp,
    channel(name: string): number {
      const gi = channelGroupIndex.get(name) ?? defaultGroupIndex;
      if (gi < 0) return t; // no group → use default t

      const g = gs[gi]!;
      const gPhaseConfig =
        phase === 'exit'        ? g.exit
        : phase === 'enter'     ? g.enter
        : g.interpolate;

      if (!gPhaseConfig) return t; // group has no config for this phase → use default

      if (phase === 'interpolate') {
        // Interpolate: only ease applies (no windowing).
        return gPhaseConfig.ease ? gPhaseConfig.ease(rawT) : rawT;
      }

      // Exit/enter: apply the group's own window (or fallback if unset).
      const [gs_, ge_] =
        (gPhaseConfig as { window?: [number, number]; ease?: EaseFn }).window ?? fallbackWindow;
      const gSpan = ge_ - gs_;
      const gRawT = gSpan <= 0 ? 1 : clamp01((bp - gs_) / gSpan);
      return (gPhaseConfig as { ease?: EaseFn }).ease
        ? (gPhaseConfig as { ease?: EaseFn }).ease!(gRawT)
        : gRawT;
    },
  };
}

export { makeResolver };
```

**`isFunctionalSpec` type guard** — no change needed. It already checks `'interpolateFn' in spec`, which remains correct.

### 1.2 — `compiler/blocks/transition.tsx` (new file)

```typescript
// DSL component for per-channel transition control.
// Processed by element CUSTOM_NODE_HANDLERs, never by the global registry.

import type { EaseFn } from '../transitions/transitionTypes';

export type TransitionPhase = {
  window?: [number, number];
  ease?: EaseFn;
};

export type TransitionProps = {
  /**
   * Which element-defined channels this Transition applies to.
   * When omitted, this is the "default group" — applies to any channel
   * that is not covered by another <Transition> on the same element.
   */
  channels?: string[];
  /** Config for the exit phase (widget leaving). */
  exit?: TransitionPhase;
  /** Config for the enter phase (widget arriving). */
  enter?: TransitionPhase;
  /** Config for the interpolate phase. Only ease is meaningful — no window. */
  interpolate?: Pick<TransitionPhase, 'ease'>;
};

/** DSL component. Renders null — processed by its parent element's CUSTOM_NODE_HANDLER. */
export const Transition = (_props: TransitionProps): null => null;
Transition.displayName = 'Transition';
```

**Note:** `TransitionPhase` is defined in both `transitionTypes.ts` (as the canonical contract type) and locally in `TransitionProps` for DSL authoring. They are the same shape. The DSL file imports `EaseFn` from `transitionTypes.ts` and defines its own `TransitionPhase` locally. Do not import `TransitionPhase` from `transitionTypes.ts` into `transition.tsx` since `dsl` layers may not import from type layers that also have runtime exports — however since `transitionTypes.ts` is a pure-types file it's fine to import from it.

Revised: `transition.tsx` imports `TransitionPhase` directly from `transitionTypes.ts`.

```typescript
import type { EaseFn, TransitionPhase } from '../transitions/transitionTypes';

export type TransitionProps = {
  channels?: string[];
  exit?: TransitionPhase;
  enter?: TransitionPhase;
  interpolate?: Pick<TransitionPhase, 'ease'>;
};

export const Transition = (_props: TransitionProps): null => null;
Transition.displayName = 'Transition';
```

### 1.3 — `compiler/transitions/transitionPresets.ts` (new file)

Named window presets (block-level patterns) and named `EaseFn` constants (replacing the old `EasingName` enum values).

```typescript
// packages/core/src/compiler/transitions/transitionPresets.ts
// Named transition window constants and easing functions.
// Import these in scene files or <Transition> ease props.

import type { EaseFn } from './transitionTypes';

// ─── Window Presets (block-level) ────────────────────────────────────────────

/** Default: exit first half, enter second half. The hardcoded baseline. */
export const TRANSITION_DEFAULT = {
  exit:  [0, 0.5]  as [number, number],
  enter: [0.5, 1.0] as [number, number],
};

/** Both scenes overlap for the full block. */
export const TRANSITION_CROSSFADE = {
  exit:  [0, 1.0]  as [number, number],
  enter: [0, 1.0]  as [number, number],
};

/** Exit and enter with a gap between them. */
export const TRANSITION_SEQUENTIAL = {
  exit:  [0, 0.45]  as [number, number],
  enter: [0.55, 1.0] as [number, number],
};

/** Exit finishes before enter starts — old scene out, new scene in. */
export const TRANSITION_EXIT_FIRST = {
  exit:  [0, 0.5]  as [number, number],
  enter: [0.65, 1.0] as [number, number],
};

/** Hard cut — no cross-fade. */
export const TRANSITION_CUT = {
  exit:  [0, 0]   as [number, number],
  enter: [1, 1]   as [number, number],
};

// ─── Named Easing Functions ───────────────────────────────────────────────────
// These replace the old EasingName string enum.
// Pass these directly to <Transition ease={easeOutCubic} /> or as inline lambdas.

export const easeLinear: EaseFn = (t) => t;
export const easeOutCubic: EaseFn = (t) => 1 - Math.pow(1 - t, 3);
export const easeOutExpo: EaseFn = (t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t));
export const easeInOutSine: EaseFn = (t) => -(Math.cos(Math.PI * t) - 1) / 2;
export const easeInOutCubic: EaseFn = (t) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
export const easeInSquared: EaseFn = (t) => t * t;
export const easeOutQuart: EaseFn = (t) => 1 - Math.pow(1 - t, 4);
```

### 1.4 — Delete `compiler/transitions/easingFunctions.ts`

This file exports `EasingName` (the string enum) and `getEasingFn`. Both are being removed. After Phase 2 (RuntimeDriver) is updated, this file has no importers and can be deleted.

**Before deleting:** ensure no code in the repo imports from `easingFunctions.ts`. The importers are:
- `packages/core/src/compiler/sceneTrackTypes.ts` (re-exports `EasingName`) → updated in Phase 2
- `packages/core/src/compiler/sceneDslCompiler.ts` (imports `EasingName`) → updated in Phase 2
- `packages/core/src/runtime/RuntimeDriver.ts` (imports `getEasingFn`) → updated in Phase 3

---

## Phase 2 — Scene Infrastructure (Core)

### 2.1 — `compiler/sceneTrackTypes.ts`

**Remove:**
- `import type { EasingName } from './transitions/easingFunctions'`
- `export type { EasingName } from './transitions/easingFunctions'`
- `transitionEasing?: EasingName` from `SceneFrame`
- `transitionEasings?: Partial<Record<number, EasingName>>` from `SceneTrack`

**Add to `SceneFrame`:**
```typescript
/**
 * Per-block default transition window for this scene's incoming transition.
 * Declared via `transition={{ exit: [0, 0.3], enter: [0.3, 1.0] }}` on `<Scene>`.
 * Applies to all widgets that lack their own <Transition> group.
 */
transitionWindow?: {
  exit?:  [number, number];
  enter?: [number, number];
};
```

The `SceneTrack.transitionBlocks` field stays unchanged — it already carries the functional closures.

### 2.2 — `compiler/sceneDslCompiler.ts`

**Remove:**
- `import type { EasingName } from './transitions/easingFunctions'`

**Update `Scene` component props:**
```typescript
// BEFORE:
transition?: { easing?: EasingName };

// AFTER:
transition?: {
  exit?:  [number, number];
  enter?: [number, number];
};
```

**Update `sceneRootHandler`:**
```typescript
// BEFORE:
if (props.transition?.easing) {
  api.state.transitionEasing = props.transition.easing;
}

// AFTER:
if (props.transition) {
  api.state.transitionWindow = {
    ...(props.transition.exit  ? { exit:  props.transition.exit  } : {}),
    ...(props.transition.enter ? { enter: props.transition.enter } : {}),
  };
}
```

### 2.3 — `compiler/coreHandlers.ts`

Register `<Transition>` with a no-op handler. This makes it a "primitive component" (`isPrimitiveComponent` returns `true`), preventing the compiler from calling it as a function during `expandNode`. Any `<Transition>` that appears outside an element handler is silently dropped.

```typescript
import { Transition } from './blocks/transition';

// In registerCoreHandlers():
if (!getNodeHandler(Transition)) {
  registerNode(Transition, (_node, _api, _helpers) => {
    // No-op: <Transition> is consumed by its parent element's CUSTOM_NODE_HANDLER.
    // At the scene level it is meaningless and silently dropped.
  });
}
```

### 2.4 — `compiler/index.ts`

```typescript
// ADD exports:
export { Transition } from './blocks/transition';
export type { TransitionProps } from './blocks/transition';
export type { EaseFn, TransitionContext, CompiledTransitionGroup, WithTransitionConfig, TransitionWindow } from './transitions/transitionTypes';
export { makeResolver } from './transitions/transitionResolver';
export {
  TRANSITION_DEFAULT,
  TRANSITION_CROSSFADE,
  TRANSITION_SEQUENTIAL,
  TRANSITION_EXIT_FIRST,
  TRANSITION_CUT,
  easeLinear,
  easeOutCubic,
  easeOutExpo,
  easeInOutSine,
  easeInOutCubic,
  easeInSquared,
  easeOutQuart,
} from './transitions/transitionPresets';

// REMOVE exports:
// EasingName — deleted
```

---

## Phase 3 — Compiler: `sceneTrackCompiler.ts`

This is the most complex change. The functional transition path must be rewritten to build resolver factories instead of hardcoded half-block splits.

### 3.1 — Remove `transitionEasings` collection

Remove lines that collect `transitionEasings`:
```typescript
// DELETE these lines entirely (currently around lines 418-434):
const transitionEasings: Partial<Record<number, EasingName>> = {};
// ...
const incomingEasing = toSnap.transitionEasing;
if (incomingEasing) {
  transitionEasings[n] = incomingEasing;
}
```

Remove from the return value:
```typescript
// REMOVE:
...(Object.keys(transitionEasings).length > 0 ? { transitionEasings } : {}),
```

### 3.2 — New functional path implementation

Replace the entire functional path block (currently lines 451–487) with:

```typescript
// ── Functional path ─────────────────────────────────────────────────────────
if (isFunctionalSpec(transitionSpec)) {
  if (!inFrom && !inTo) {
    for (const frame of block) {
      frame.state.widgets[widgetId] = absentDefault;
    }
    continue;
  }

  const tBlock: SceneTrackTransitionBlock =
    transitionBlocks[n] ?? { blockIndex: n, widgetFns: {} };
  transitionBlocks[n] = tBlock;

  // Resolve scene-level window. Falls back to spec-level defaultWindow, then hardcoded.
  // Exit: read from fromSnap (outgoing scene declares how it exits).
  // Enter: read from toSnap (incoming scene declares how it enters).
  const specDefaultWindow = transitionSpec.defaultWindow;
  const sceneExit:  [number, number] =
    fromSnap.transitionWindow?.exit  ?? specDefaultWindow?.exit  ?? [0, 0.5];
  const sceneEnter: [number, number] =
    toSnap.transitionWindow?.enter   ?? specDefaultWindow?.enter ?? [0.5, 1.0];

  if (inFrom && inTo) {
    // INTERPOLATE — widget present in both scenes.
    // __transitionGroups from toState (incoming scene's authoring drives enter/interpolate).
    const groups = (toState as WithTransitionConfig).__transitionGroups;
    const rawFn = transitionSpec.interpolateFn(fromState as never, toState as never);
    tBlock.widgetFns[widgetId] = {
      fn: (bp: number) => rawFn(makeResolver(bp, groups, [0, 1], 'interpolate')),
      kind: 'interpolate',
    };
  } else if (inFrom) {
    // EXIT — widget leaving. __transitionGroups from fromState (outgoing scene drives exit).
    const groups = (fromState as WithTransitionConfig).__transitionGroups;
    const rawFn = transitionSpec.exitFn(fromState as never);

    // Determine the "active boundary" for this widget.
    // The default group's exit window end (or scene/spec/hardcoded fallback) sets when
    // the widget transitions to absentDefault.
    const defaultGroupIndex = groups?.findIndex((g) => !g.channels) ?? -1;
    const defaultGroup = defaultGroupIndex >= 0 ? groups![defaultGroupIndex] : undefined;
    const effectiveExitEnd = defaultGroup?.exit?.window?.[1] ?? sceneExit[1];

    tBlock.widgetFns[widgetId] = {
      fn: (bp: number) => {
        if (bp >= effectiveExitEnd) return absentDefault;
        return rawFn(makeResolver(bp, groups, sceneExit, 'exit'));
      },
      kind: 'exit',
    };
  } else {
    // ENTER — widget arriving. __transitionGroups from toState (incoming scene's authoring).
    const groups = (toState as WithTransitionConfig).__transitionGroups;
    const rawFn = transitionSpec.enterFn(toState as never);

    // Determine the "active boundary" for this widget.
    const defaultGroupIndex = groups?.findIndex((g) => !g.channels) ?? -1;
    const defaultGroup = defaultGroupIndex >= 0 ? groups![defaultGroupIndex] : undefined;
    const effectiveEnterStart = defaultGroup?.enter?.window?.[0] ?? sceneEnter[0];

    tBlock.widgetFns[widgetId] = {
      fn: (bp: number) => {
        if (bp < effectiveEnterStart) return absentDefault;
        return rawFn(makeResolver(bp, groups, sceneEnter, 'enter'));
      },
      kind: 'enter',
    };
  }
  continue;
}
```

### 3.3 — Required imports in sceneTrackCompiler.ts

Add:
```typescript
import type { WithTransitionConfig } from './transitions/transitionTypes';
import { makeResolver } from './transitions/transitionResolver';
```

Remove:
```typescript
import type { EasingName } from './sceneTrackTypes'; // no longer needed
```

---

## Phase 4 — Runtime: `RuntimeDriver.ts`

### 4.1 — Simplify `tick()` functional widget evaluation

**Before:**
```typescript
if (functionalWidget) {
  const easingName = this.track?.transitionEasings?.[tick.sceneIndex];
  const bp = easingName
    ? getEasingFn(easingName)(tick.blockProgress)
    : tick.blockProgress;
  state = functionalWidget.fn(bp);
}
```

**After:**
```typescript
if (functionalWidget) {
  state = functionalWidget.fn(tick.blockProgress);
}
```

### 4.2 — Remove import

```typescript
// REMOVE:
import { getEasingFn } from '../compiler/transitions/easingFunctions';
```

---

## Phase 5 — Model Package Adoption

### 5.1 — `elements/model/types.ts`

Add `__transitionGroups` to `SceneModelInstanceState`:

```typescript
import type { CompiledTransitionGroup } from '@brewsite/core/compiler/transitions/transitionTypes';

export type SceneModelInstanceState = {
  model: SceneModel;
  playback: ScenePlayback;
  enabled?: boolean;
  labels?: import('../../labels/types').LabelResolved[];
  /**
   * Compiled <Transition> groups for this instance.
   * Set by ModelWidget CUSTOM_NODE_HANDLER during DSL compilation.
   * Consumed by sceneTrackCompiler to build TransitionContext resolvers.
   * Passed through all blend functions unchanged (not blended).
   */
  __transitionGroups?: CompiledTransitionGroup[];
};
```

### 5.2 — `elements/model/compile.ts`

Update `applyModelExit`, `applyModelEnter`, `applyModelInterpolate` to accept `TransitionContext`:

```typescript
import type { TransitionContext } from '@brewsite/core/compiler/transitions/transitionTypes';

export const applyModelExit = (
  from: SceneModelInstanceState,
  ctx: TransitionContext,
): SceneModelInstanceState => ({
  ...from,
  __transitionGroups: undefined,  // Consumed at compile time. Strip at runtime.
  model: modelTransitionSpec.exit(from.model, ctx),
  playback: playbackTransitionSpec.exit(from.playback, ctx),
  enabled: ctx.channel('opacity') >= 1 ? false : from.enabled,
});

export const applyModelEnter = (
  to: SceneModelInstanceState,
  ctx: TransitionContext,
): SceneModelInstanceState => ({
  ...to,
  __transitionGroups: undefined,  // Consumed at compile time. Strip at runtime.
  model: modelTransitionSpec.enter(to.model, ctx),
  playback: playbackTransitionSpec.enter(to.playback, ctx),
  enabled: ctx.channel('opacity') > 0 ? (to.enabled ?? true) : to.enabled,
});

export const applyModelInterpolate = (
  from: SceneModelInstanceState,
  to: SceneModelInstanceState,
  ctx: TransitionContext,
): SceneModelInstanceState => ({
  ...from,
  ...to,
  __transitionGroups: undefined,  // Consumed at compile time. Strip at runtime.
  model: modelTransitionSpec.interpolate(from.model, to.model, ctx),
  playback: playbackTransitionSpec.interpolate(from.playback, to.playback, ctx),
  enabled: (to.enabled ?? from.enabled ?? true) && ctx.t < 1,
});
```

**Update `modelTransitionSpec` helpers to accept `TransitionContext`:**

`modelTransitionSpec.exit(from, ctx)` now uses:
- `ctx.channel('opacity')` for opacity blend
- `ctx.channel('transform')` for position/rotation/scale (note: in the naïve migration these simply use `ctx.t`, see channel taxonomy)
- `ctx.channel('bodyParts')` for bodyPartOverrides opacity
- `ctx.channel('parts')` for parts opacity
- `ctx.channel('animation')` for animation weight
- `ctx.channel('motion')` for motion commands

For the initial migration, implement using `ctx.t` for all channels (naïve migration — identical behavior to today). The channel-selective version is enabled when the scene author explicitly adds `<Transition>` children.

Naïve migration pattern:
```typescript
// modelTransitionSpec.exit - naïve migration
exit: (from: SceneModel, ctx: TransitionContext): SceneModel => ({
  ...from,
  position: from.position,
  rotation: from.rotation,
  scale: from.scale,
  opacity: blendOpacity(from.opacity ?? 1, 0, ctx.channel('opacity')),
  enabled: ctx.channel('opacity') >= 1 ? false : from.enabled,
  bodyPartOverrides: blendBodyOverrides(
    from.bodyPartOverrides, undefined,
    ctx.channel('opacity'),   // exit t for opacity within bodyPartOverrides
    0,
    ctx.channel('opacity'),
  ),
  parts: blendParts(from.parts, undefined, ctx.channel('opacity'), 0, ctx.channel('opacity')),
}),
```

**Update `functionalInstanceTransitionSpec`:**
```typescript
export const functionalInstanceTransitionSpec: FunctionalTransitionSpec<SceneModelInstanceState> = {
  exitFn:        (from) => (ctx) => applyModelExit(from, ctx),
  enterFn:       (to)   => (ctx) => applyModelEnter(to, ctx),
  interpolateFn: (from, to) => (ctx) => applyModelInterpolate(from, to, ctx),
};
```

**Keep `instanceTransitionSpec` (discrete path) unchanged** — it still uses `t: number` internally via `applyModelExit(state, mockCtxFromT(t))`. Actually: since `applyModelExit` now takes `TransitionContext`, the discrete spec needs a `makeSimpleContext(t)` helper:

```typescript
// Internal helper for the discrete path only.
// Creates a TransitionContext where every channel returns the same t.
const makeSimpleContext = (t: number): TransitionContext => ({
  t,
  bp: t,
  channel: () => t,
});

export const instanceTransitionSpec: ElementTransitionSpec<SceneModelInstanceState> = {
  exit: (frames, widgetId, fromState) => {
    for (let i = 0; i < frames.length; i++) {
      const t = transitionT(i, frames.length);
      frames[i]!.state.widgets[widgetId] = applyModelExit(fromState, makeSimpleContext(t));
    }
  },
  // ... enter, interpolate analogous
};
```

### 5.3 — `elements/model/ModelWidget.ts`

**In the `CUSTOM_NODE_HANDLER`:**

After walking children (after the existing `for (const child of children)` loop), add:

```typescript
import { Transition } from '@brewsite/core/compiler/blocks/transition';
import type { TransitionProps } from '@brewsite/core/compiler/blocks/transition';
import type { CompiledTransitionGroup } from '@brewsite/core/compiler/transitions/transitionTypes';

// After walking all children, collect <Transition> groups:
const transitionGroups: CompiledTransitionGroup[] = [];
for (const child of children) {
  if (!isValidElement(child)) continue;
  const el = child as ReactElement;
  if (!isComponent(el, Transition)) continue;
  const p = el.props as TransitionProps;
  const group: CompiledTransitionGroup = {};
  if (p.channels) group.channels = p.channels;
  if (p.exit) {
    group.exit = {
      window: p.exit.window ?? [0, 0.5],
      ...(p.exit.ease ? { ease: p.exit.ease } : {}),
    };
  }
  if (p.enter) {
    group.enter = {
      window: p.enter.window ?? [0.5, 1.0],
      ...(p.enter.ease ? { ease: p.enter.ease } : {}),
    };
  }
  if (p.interpolate?.ease) {
    group.interpolate = { ease: p.interpolate.ease };
  }
  if (group.exit || group.enter || group.interpolate || group.channels !== undefined) {
    transitionGroups.push(group);
  }
}

// Attach to state if any groups were found:
const state: SceneModelInstanceState = {
  model: { ... },
  playback: { ... },
  // ...
  ...(transitionGroups.length > 0 ? { __transitionGroups: transitionGroups } : {}),
};
```

**Important:** `__transitionGroups` must be preserved through `mergeSnapshot`. Add it to the `merged` object in `mergeSnapshot`:
```typescript
const merged: SceneModelInstanceState = {
  model: mergedModel,
  playback: { motion: mergedMotion, animation: mergedAnimation },
  enabled: authored?.enabled ? next.enabled : base.enabled,
  ...(next.__transitionGroups ? { __transitionGroups: next.__transitionGroups } : {}),
};
```

**Add `Transition` to `childDslComponents`:**
```typescript
{ component: Transition as React.ComponentType<unknown>, displayName: 'Transition', topLevelError: false },
```

---

## Phase 6 — Diagram Package Adoption

### 6.1 — Pattern 1 Elements: `ImagePanel` and `Screen`

Both follow the identical naïve migration pattern.

**`elements/image-panel/types.ts`** — add:
```typescript
import type { CompiledTransitionGroup } from '@brewsite/core';
// Add to ImagePanelState:
__transitionGroups?: CompiledTransitionGroup[];
```

**`elements/image-panel/compile.ts`** — update transition spec:
```typescript
import type { TransitionContext } from '@brewsite/core';
// Channel taxonomy for ImagePanel:
//   'opacity'   → opacity, glowOpacity
//   'transform' → position, rotation, scale
//   'surface'   → gloss, selfIllumination
//   'content'   → src, bezel (currently switches at t=0.5; with 'content' channel the author can control this)

export const functionalImagePanelTransitionSpec: FunctionalTransitionSpec<ImagePanelState> = {
  exitFn: (from) => (ctx: TransitionContext) => ({
    ...from,
    opacity:     blendOpacity(from.opacity, 0, ctx.channel('opacity')) ?? 0,
    glowOpacity: blendOpacity(from.glowOpacity, 0, ctx.channel('opacity')) ?? 0,
    position:    toMutableVec3(blendVec3(from.position, from.position, ctx.channel('transform')) ?? from.position),
    __transitionGroups: undefined,  // Consumed at compile time. Strip at runtime.
  }),
  enterFn: (to) => (ctx: TransitionContext) => ({
    ...to,
    opacity:     blendOpacity(0, to.opacity, ctx.channel('opacity')) ?? to.opacity,
    glowOpacity: blendOpacity(0, to.glowOpacity, ctx.channel('opacity')) ?? to.glowOpacity,
    __transitionGroups: undefined,  // Consumed at compile time. Strip at runtime.
  }),
  interpolateFn: (from, to) => (ctx: TransitionContext) => ({
    ...from,
    ...to,
    position:    toMutableVec3(blendVec3(from.position, to.position, ctx.channel('transform')) ?? to.position),
    rotation:    toMutableVec3(blendVec3(from.rotation, to.rotation, ctx.channel('transform')) ?? to.rotation),
    scale:       blendNumber(from.scale, to.scale, ctx.channel('transform')) ?? to.scale,
    opacity:     blendOpacity(from.opacity, to.opacity, ctx.channel('opacity')) ?? to.opacity,
    glowOpacity: blendOpacity(from.glowOpacity, to.glowOpacity, ctx.channel('opacity')) ?? to.glowOpacity,
    // 'content' channel controls when src/bezel switches
    src:    ctx.channel('content') < 0.5 ? from.src  : to.src,
    bezel:  ctx.channel('content') < 0.5 ? from.bezel : to.bezel,
    __transitionGroups: undefined,  // Consumed at compile time. Strip at runtime.
  }),
};
```

Apply the same pattern to `elements/screen/compile.ts` with its channel taxonomy (`'opacity'`, `'transform'`, `'content'`).

**Widgets** (`image-panel/widget.ts`, `screen/widget.ts`): Add `<Transition>` child collection using the same pattern as `ModelWidget` (see Phase 5.3). `__transitionGroups` must be collected in the widget's `CUSTOM_NODE_HANDLER` or simple `NodeHandler`. Since these elements may not use `CUSTOM_NODE_HANDLER`, the `NodeHandler` must iterate children for `<Transition>` elements.

If the widget uses a simple `NodeHandler`, add child traversal for `<Transition>`:
```typescript
// In the NodeHandler for ImagePanel/Screen:
const transitionGroups = collectTransitionGroups(helpers.collectChildren(node));
if (transitionGroups.length > 0) {
  compiledState.__transitionGroups = transitionGroups;
}
```

Extract a shared helper `collectTransitionGroups(children: unknown[]): CompiledTransitionGroup[]` in a shared location (e.g., `elements/_shared/transitionUtils.ts` in `@brewsite/diagram`) or inline in each widget.

### 6.2 — Pattern 2 Element: `Diagram`

**`elements/diagram/types.ts`** — add `__transitionGroups?: CompiledTransitionGroup[]` to `DiagramState`.

**`elements/diagram/compile.ts`** — update `applyDiagramExit`, `applyDiagramEnter`, and the interpolate blend to accept `TransitionContext`.

Channel taxonomy for Diagram (see note):
- `'opacity'` → all node/edge/group opacities
- `'layout'` → node positions (interpolate)
- `'edges'` → edge control points (interpolate)
- `'nodes'` → node color, scale, label
- `'groups'` → group opacity, bounds
- `'transform'` → root position/rotation/scale

Naïve migration for exit/enter: use `ctx.channel('opacity')` for the opacity fade; all other properties use `ctx.t`.

```typescript
export function applyDiagramExit(from: DiagramState, ctx: TransitionContext): DiagramState {
  const tOpacity = ctx.channel('opacity');
  // ... apply opacity fade using tOpacity; positions unchanged
  return {
    ...from,
    nodes: from.nodes.map((n) => ({ ...n, opacity: blendOpacity(n.opacity ?? 1, 0, tOpacity) })),
    edges: from.edges.map((e) => ({ ...e, opacity: blendOpacity(e.opacity ?? 1, 0, tOpacity) })),
    groups: from.groups.map((g) => ({ ...g, opacity: blendOpacity(g.opacity ?? 1, 0, tOpacity) })),
    __transitionGroups: undefined,  // Consumed at compile time. Strip at runtime.
  };
}
```

**`elements/diagram/widget.ts`**: Add `<Transition>` child collection.

### 6.3 — Pattern 3 Container: `DiagramCanvas`

This is the most architecturally significant change.

**`elements/diagram/canvas/types.ts`** — add `__transitionGroups?: CompiledTransitionGroup[]` to `DiagramCanvasState`.

**`elements/diagram/canvas/compile.ts`** — the canvas functional transition spec must:
1. Build a canvas-level `TransitionContext` from `canvasState.__transitionGroups`
2. For each keyed child diagram, build a per-child `TransitionContext` from `childState.__transitionGroups` using `makeResolver` from core
3. Pass per-child contexts into the diagram blend functions

```typescript
import { makeResolver } from '@brewsite/core/compiler/transitions/transitionResolver';

export const functionalDiagramCanvasTransitionSpec: FunctionalTransitionSpec<DiagramCanvasState> = {
  interpolateFn: (from, to) => (canvasCtx: TransitionContext) => {
    // Canvas-level channels: opacity, transform, camera, pipes
    // Per-child diagram blending:
    const blendedDiagrams: Record<string, DiagramState> = {};
    const fromDiagrams = from.diagrams ?? {};
    const toDiagrams   = to.diagrams   ?? {};
    const allIds = new Set([...Object.keys(fromDiagrams), ...Object.keys(toDiagrams)]);

    for (const id of allIds) {
      const fromChild = fromDiagrams[id];
      const toChild   = toDiagrams[id];

      // Child-level fallback window: use canvas-level sceneEnter (passed through canvasCtx.bp)
      const childFallbackWindow: [number, number] = [0, 1];
      const childGroups = toChild?.__transitionGroups ?? fromChild?.__transitionGroups;
      const childCtx = makeResolver(canvasCtx.bp, childGroups, childFallbackWindow, 'interpolate');

      if (fromChild && toChild) {
        blendedDiagrams[id] = blendDiagramStates(fromChild, toChild, childCtx);
      } else if (fromChild) {
        blendedDiagrams[id] = applyDiagramExit(fromChild, childCtx);
      } else if (toChild) {
        blendedDiagrams[id] = applyDiagramEnter(toChild, childCtx);
      }
    }

    return {
      ...from,
      ...to,
      diagrams: blendedDiagrams,
      opacity: blendOpacity(from.opacity, to.opacity, canvasCtx.channel('opacity')) ?? to.opacity,
      // ... other canvas-level channels
      __transitionGroups: undefined,  // Consumed at compile time. Strip at runtime.
    };
  },
  exitFn: (from) => (ctx: TransitionContext) => {
    // Canvas exit: fade opacity, pass through each child with exit context
    const childFallbackWindow: [number, number] = [0, 0.5];
    const blendedDiagrams: Record<string, DiagramState> = {};
    for (const [id, child] of Object.entries(from.diagrams ?? {})) {
      const childCtx = makeResolver(ctx.bp, child.__transitionGroups, childFallbackWindow, 'exit');
      blendedDiagrams[id] = applyDiagramExit(child, childCtx);
    }
    return {
      ...from,
      opacity: blendOpacity(from.opacity ?? 1, 0, ctx.channel('opacity')) ?? 0,
      diagrams: blendedDiagrams,
      __transitionGroups: undefined,  // Consumed at compile time. Strip at runtime.
    };
  },
  enterFn: (to) => (ctx: TransitionContext) => {
    // Canvas enter: fade opacity, pass through each child with enter context
    const childFallbackWindow: [number, number] = [0.5, 1.0];
    const blendedDiagrams: Record<string, DiagramState> = {};
    for (const [id, child] of Object.entries(to.diagrams ?? {})) {
      const childCtx = makeResolver(ctx.bp, child.__transitionGroups, childFallbackWindow, 'enter');
      blendedDiagrams[id] = applyDiagramEnter(child, childCtx);
    }
    return {
      ...to,
      opacity: blendOpacity(0, to.opacity ?? 1, ctx.channel('opacity')) ?? to.opacity,
      diagrams: blendedDiagrams,
      __transitionGroups: undefined,  // Consumed at compile time. Strip at runtime.
    };
  },
};
```

**`elements/diagram/canvas/widget.ts`**: Collect `<Transition>` children at the canvas level. Each `<Diagram>` child's widget handler must also collect its own `<Transition>` children and compile them into `childDiagramState.__transitionGroups`.

The DSL authoring surface:
```tsx
<DiagramCanvas id="main">
  <Transition channels={['opacity']} enter={{ window: [0.3, 0.8], ease: easeOutCubic }} />
  <Diagram id="backend">
    <Transition channels={['nodes']} enter={{ window: [0.5, 1.0] }} />
    <Transition channels={['edges']} enter={{ window: [0.7, 1.0] }} />
  </Diagram>
  <Diagram id="frontend">
    <Transition channels={['nodes']} enter={{ window: [0.6, 1.0] }} />
  </Diagram>
</DiagramCanvas>
```

The canvas widget's handler iterates canvas-level `<Transition>` children → `canvasState.__transitionGroups`.
Each `<Diagram>` child's handler iterates its `<Transition>` children → `childDiagramState.__transitionGroups`.

---

## Phase 7 — Charts Package Adoption

### 7.1 — `elements/chart/types.ts`

Add `__transitionGroups?: CompiledTransitionGroup[]` to `ChartState`.

### 7.2 — `elements/chart/compile.ts`

Channel taxonomy: `'opacity'`, `'transform'`, `'type'` (see note).

```typescript
export const functionalChartTransitionSpec: FunctionalTransitionSpec<ChartState> = {
  exitFn: (from: ChartState) => (ctx: TransitionContext): ChartState => ({
    ...from,
    opacity: blendOpacity(from.opacity, 0, ctx.channel('opacity')) ?? 0,
    __transitionGroups: undefined,  // Consumed at compile time. Strip at runtime.
  }),
  enterFn: (to: ChartState) => (ctx: TransitionContext): ChartState => ({
    ...to,
    opacity: blendOpacity(0, to.opacity, ctx.channel('opacity')) ?? to.opacity,
    __transitionGroups: undefined,  // Consumed at compile time. Strip at runtime.
  }),
  interpolateFn: (from: ChartState, to: ChartState) => (ctx: TransitionContext): ChartState => ({
    ...from,
    ...to,
    opacity:   blendOpacity(from.opacity, to.opacity, ctx.channel('opacity')) ?? to.opacity,
    position:  blendVec3(from.position, to.position, ctx.channel('transform')) ?? to.position,
    rotation:  blendVec3(from.rotation, to.rotation, ctx.channel('transform')) ?? to.rotation,
    // 'type' channel controls when chart type switches:
    type:      ctx.channel('type') < 0.5 ? from.type : to.type,
    __transitionGroups: undefined,  // Consumed at compile time. Strip at runtime.
  }),
};
```

### 7.3 — `elements/chart/ChartWidget.ts`

Collect `<Transition>` children in the chart handler. Same pattern as other widgets.

---

## Phase 8 — Core Elements Naïve Migration

The 5 core elements (Background, Camera, Lighting, Floor, Environment) each have both `ElementTransitionSpec` (discrete) and `FunctionalTransitionSpec`. Only the functional spec is updated.

For each element:
1. Add `__transitionGroups?: CompiledTransitionGroup[]` to its state type
2. Update the `FunctionalTransitionSpec` closures from `(t: number) => T` to `(ctx: TransitionContext) => T`
3. Use `ctx.channel('opacity')` (or appropriate channel name) instead of `t` directly
4. Pass `__transitionGroups` through in the returned state

All five are low-priority but should be included in the initial pass to eliminate TypeScript errors (since `FunctionalTransitionSpec` now requires `TransitionContext`, all implementations must be updated).

**Background** — channels: `'opacity'`, `'color'`, `'image'`, `'position'`

```typescript
// In background/compile.ts — add FunctionalTransitionSpec:
export const functionalBackgroundTransitionSpec: FunctionalTransitionSpec<SceneBackground> = {
  exitFn: (from) => (ctx) => ({
    ...from,
    opacity: blendOpacity(from.opacity, 0, ctx.channel('opacity')),
    __transitionGroups: undefined,  // Consumed at compile time. Strip at runtime.
  }),
  enterFn: (to) => (ctx) => ({
    ...to,
    opacity: blendOpacity(0, to.opacity, ctx.channel('opacity')),
    __transitionGroups: undefined,  // Consumed at compile time. Strip at runtime.
  }),
  interpolateFn: (from, to) => (ctx) => ({
    imageUrl: ctx.channel('image') < 0.5 ? from.imageUrl : to.imageUrl,
    opacity:  crossFadeOpacity(from, to, ctx.channel('opacity')),
    color:    ctx.channel('color') < 0.5 ? from.color : to.color,
    position: blendVec3(from.position, to.position, ctx.channel('position')) ?? to.position,
    __transitionGroups: undefined,  // Consumed at compile time. Strip at runtime.
  }),
};
```

**Note:** `BackgroundWidget` currently uses `backgroundTransitionSpec` (discrete). The functional spec is new. `BackgroundWidget.transitionSpec` should be updated to point to `functionalBackgroundTransitionSpec` for elements that choose the functional path. If `BackgroundWidget` currently uses the discrete spec, leave it unchanged for this pass and document it — it will fail to compile if the `FunctionalTransitionSpec` type changes the closure signature but the widget's spec is `ElementTransitionSpec` which is unaffected.

Actually — re-reading: `ElementTransitionSpec` is NOT changed. `FunctionalTransitionSpec` IS changed. So any widget using `ElementTransitionSpec` is unaffected. The compile errors only occur on widgets whose `transitionSpec` is typed as `FunctionalTransitionSpec<T>` — those closures must be updated.

**Elements using `FunctionalTransitionSpec` (confirmed from code):**
- `ModelWidget` → `functionalInstanceTransitionSpec`
- `ImagePanel` → `functionalImagePanelTransitionSpec`
- `Screen` → functional spec
- `DiagramCanvas` → functional spec
- `Diagram` → functional spec (from `compile.ts`)
- `ChartWidget` → `functionalChartTransitionSpec`

**Elements using `ElementTransitionSpec` (unaffected):**
- `Background` → `backgroundTransitionSpec` (discrete, NO change needed)
- `Camera`, `Lighting`, `Floor`, `Environment` — confirm before deciding

Check each widget's `transitionSpec` assignment. If it's `ElementTransitionSpec`, skip for now.

Scan pattern: look for `isFunctionalSpec` or `FunctionalTransitionSpec` references in each compile file to confirm which path each element uses. This is a build-time check that will surface TypeScript errors for any missed migration.

---

## Phase 9 — Tests

### 9.1 — New test: `compiler/transitions/__tests__/makeResolver.test.ts` (core)

```typescript
import { describe, it, expect } from 'vitest';
import { makeResolver } from '../transitionResolver';
import type { CompiledTransitionGroup } from '../transitionTypes';

describe('makeResolver', () => {
  it('returns ctx.t = linear through full window when no groups', () => {
    const ctx = makeResolver(0.25, undefined, [0, 0.5], 'exit');
    expect(ctx.t).toBeCloseTo(0.5);  // 0.25 / 0.5 = 0.5
    expect(ctx.bp).toBe(0.25);
  });

  it('ctx.channel() returns ctx.t for unknown channel', () => {
    const ctx = makeResolver(0.5, undefined, [0, 1], 'exit');
    expect(ctx.channel('opacity')).toBe(ctx.t);
  });

  it('named channel uses its group window', () => {
    const groups: CompiledTransitionGroup[] = [
      { channels: ['opacity'], exit: { window: [0, 0.3] } },
    ];
    const ctx = makeResolver(0.15, groups, [0, 0.5], 'exit');
    // opacity: 0.15 / 0.3 = 0.5
    expect(ctx.channel('opacity')).toBeCloseTo(0.5);
    // ctx.t uses fallback window: 0.15 / 0.5 = 0.3
    expect(ctx.t).toBeCloseTo(0.3);
  });

  it('default group overrides ctx.t computation', () => {
    const groups: CompiledTransitionGroup[] = [
      { exit: { window: [0, 0.3] } },  // default group (no channels)
    ];
    const ctx = makeResolver(0.15, groups, [0, 0.5], 'exit');
    // ctx.t uses default group window: 0.15 / 0.3 = 0.5
    expect(ctx.t).toBeCloseTo(0.5);
  });

  it('ease is applied within the window', () => {
    const ease = (t: number) => t * t;
    const groups: CompiledTransitionGroup[] = [
      { channels: ['opacity'], exit: { window: [0, 1], ease } },
    ];
    const ctx = makeResolver(0.5, groups, [0, 1], 'exit');
    // raw t = 0.5, after ease: 0.25
    expect(ctx.channel('opacity')).toBeCloseTo(0.25);
  });

  it('interpolate phase uses ease but ignores window on channels', () => {
    const groups: CompiledTransitionGroup[] = [
      { channels: ['opacity'], interpolate: { ease: (t) => t * t } },
    ];
    const ctx = makeResolver(0.5, groups, [0, 1], 'interpolate');
    // For interpolate, fallbackWindow determines rawT: 0.5 / 1 = 0.5; then ease: 0.25
    expect(ctx.channel('opacity')).toBeCloseTo(0.25);
  });

  it('first matching group wins on channel conflict', () => {
    const groups: CompiledTransitionGroup[] = [
      { channels: ['opacity'], exit: { window: [0, 0.3] } },
      { channels: ['opacity'], exit: { window: [0, 0.8] } },  // second — should lose
    ];
    const ctx = makeResolver(0.15, groups, [0, 1], 'exit');
    // First group wins: 0.15 / 0.3 = 0.5
    expect(ctx.channel('opacity')).toBeCloseTo(0.5);
  });
});
```

### 9.2 — Update all existing `functionalTransitionSpec.test.ts` files

These tests currently call the closure with a scalar `t`:
```typescript
const result = functionalImagePanelTransitionSpec.exitFn(state)(0);   // OLD
```

They must be updated to pass a `TransitionContext`:
```typescript
import { makeResolver } from '@brewsite/core/compiler/transitions/transitionResolver';

const ctx0 = makeResolver(0, undefined, [0, 1], 'exit');   // t=0 equivalent
const ctx1 = makeResolver(1, undefined, [0, 1], 'exit');   // t=1 equivalent
const result = functionalImagePanelTransitionSpec.exitFn(state)(ctx0);  // NEW
```

**Files to update:**
- `packages/diagram/src/elements/image-panel/__tests__/functionalTransitionSpec.test.ts`
- `packages/diagram/src/elements/screen/__tests__/functionalTransitionSpec.test.ts`
- `packages/diagram/src/elements/diagram/__tests__/functionalTransitionSpec.test.ts`
- `packages/diagram/src/elements/diagram/canvas/__tests__/functionalTransitionSpec.test.ts`
- `packages/model/src/elements/model/__tests__/ModelCompile.test.ts` (any tests that call applyModelExit/Enter/Interpolate with t directly)

### 9.3 — New test: `elements/model/__tests__/TransitionGroups.test.ts` (model)

Tests that `<Transition>` children in a `<Model>` DSL node compile to `__transitionGroups` correctly.

```typescript
describe('ModelWidget <Transition> compilation', () => {
  it('compiles a single <Transition> with channels into __transitionGroups', () => {
    // Build a mock DSL node with <Transition channels={['opacity']} exit={{ window: [0, 0.3] }} />
    // Run through CUSTOM_NODE_HANDLER
    // Assert state.__transitionGroups[0].channels === ['opacity']
    // Assert state.__transitionGroups[0].exit.window deepEquals [0, 0.3]
  });

  it('a <Transition> with no channels prop creates the default group', () => {
    // Assert state.__transitionGroups[0].channels === undefined
  });

  it('__transitionGroups is preserved through mergeSnapshot', () => {
    // Assert that mergeSnapshot carries __transitionGroups from next state
  });
});
```

### 9.4 — `compiler/__tests__/sceneTrackCompiler.test.ts` (core) — update/add

Add tests for:
- Exit closure uses `fromState.__transitionGroups` (not `toState`)
- Enter closure uses `toState.__transitionGroups`
- Scene-level `transitionWindow` is read from `toSnap.transitionWindow`
- Active boundary for exit uses default group's window end

### 9.5 — `compiler/transitions/__tests__/transitionPresets.test.ts` (core)

Simple sanity checks on preset window values and named easing functions:
```typescript
it('easeOutCubic(0) === 0', () => expect(easeOutCubic(0)).toBe(0));
it('easeOutCubic(1) === 1', () => expect(easeOutCubic(1)).toBe(1));
it('TRANSITION_DEFAULT matches expected windows', () => {
  expect(TRANSITION_DEFAULT.exit).toEqual([0, 0.5]);
  expect(TRANSITION_DEFAULT.enter).toEqual([0.5, 1.0]);
});
```

---

## Phase 10 — Website Scene Updates

The website scenes currently use `transition={{ easing: 'easeOutCubic' }}` (and similar) on `<Scene>`. These must be migrated to the new syntax.

**Search for occurrences:**
```bash
grep -r "transition=" apps/website/src/scenes/ --include="*.tsx"
```

**Migration pattern:**
```tsx
// BEFORE:
<Scene id="scene-3" transition={{ easing: 'easeOutCubic' }}>

// AFTER (using preset + inline ease on a per-widget <Transition>):
<Scene id="scene-3" transition={TRANSITION_EXIT_FIRST}>
  {/* or per-widget: */}
  <Model id="bot" type="bot">
    <Transition channels={['opacity']} enter={{ window: [0.5, 1.0], ease: easeOutCubic }} />
  </Model>
</Scene>
```

For scenes that just want a different timing without channel selectivity, use the `<Scene transition={...}>` prop with a preset or custom window.

---

## Open Question Resolutions

The following open questions from the note are resolved in this plan:

**Q1 — Widget "absent" boundary:**
**Resolution:** The default group's phase window end (for exit) or start (for enter) drives the boundary. If no default group exists, the scene/spec/hardcoded fallback drives it. This is cleanest and requires no per-channel scan. A widget is "present" for the full default window regardless of whether individual channels are still transitioning.

**Q2 — `<Transition>` with no `channels` prop:**
**Resolution:** Confirmed as the "default group" — it overrides the default t (window + ease) for all channels that are not explicitly assigned to a named group. This is the correct fallback behavior and matches the CSS `transition:` mental model.

**Q3 — Multiple `<Transition>` elements conflict resolution:**
**Resolution:** First one listed wins. In `makeResolver`, the channel-to-group index map is built in order and `if (!channelGroupIndex.has(ch)) channelGroupIndex.set(ch, i)` skips duplicates. Document this in `TransitionProps.channels` JSDoc.

**Q4 — `ctx.channel()` for interpolate:**
**Resolution:** During interpolate, `ctx.channel('name')` applies only the group's `ease` (if any) to the raw t derived from the full `[0, 1]` window. No windowing is applied — only easing is meaningful for interpolate. Documented in `makeResolver`.

**Q5 — `__transitionGroups` ownership during exit:**
**Resolution:** Exit reads `fromState.__transitionGroups`; enter and interpolate read `toState.__transitionGroups`. This is implemented in Phase 3 of `sceneTrackCompiler.ts`.

**Q6 — Discrete path:**
**Resolution:** `ElementTransitionSpec` stays unchanged. The `mid`-split stays as-is. This is a documented, known limitation. `ElementTransitionSpec` cannot benefit from the window/channel system without a full redesign. No plans to change this.

---

## Breaking Changes

Consumers of `@brewsite/core`, `@brewsite/model`, `@brewsite/diagram`, `@brewsite/charts` who use:

1. `transition={{ easing: 'easeOutCubic' }}` on `<Scene>` → must migrate to `transition={{ exit: [...], enter: [...] }}` and move easing to per-element `<Transition>` children.
2. `EasingName` type import → remove; use `EaseFn` (inline lambda or named constant from `transitionPresets`).
3. Custom widgets implementing `FunctionalTransitionSpec<T>` → closures must change from `(t: number) => T` to `(ctx: TransitionContext) => T`. Naïve migration: replace `t` with `ctx.t`.
4. `SceneTrack.transitionEasings` access (player-level or test code) → remove; field no longer exists.
5. `SceneFrame.transitionEasing` access (player-level or test code) → rename to `transitionWindow`.

---

## Implementation Order

Strict dependency order must be followed since TypeScript errors cascade across packages:

1. **Phase 1** (core types) — must be first; everything else depends on it
2. **Phase 2** (scene infrastructure) — depends on Phase 1
3. **Phase 3** (sceneTrackCompiler) — depends on Phases 1 and 2
4. **Phase 4** (RuntimeDriver) — depends on Phase 1 (remove import); independent of 2-3
5. **Phase 5** (model) — depends on Phase 1; can start once Phase 1 is done
6. **Phase 6** (diagram) — depends on Phases 1 and 5 (calls applyDiagramExit which now takes `TransitionContext`)
7. **Phase 7** (charts) — depends on Phase 1; independent of 5-6
8. **Phase 8** (core element naïve migration) — depends on Phase 1; TypeScript errors will show any missed functional specs
9. **Phase 9** (tests) — all phases must be done first; run `pnpm typecheck` after each phase
10. **Phase 10** (website scenes) — last; depends on all library phases being complete and compilable

---

## Verification Checklist

After implementation, verify:

- [ ] `pnpm typecheck` passes with zero errors across all packages
- [ ] `pnpm test` passes with zero failures across all packages
- [ ] `grep -r "EasingName" packages/ --include="*.ts" --include="*.tsx"` returns no results
- [ ] `grep -r "transitionEasing" packages/ --include="*.ts" --include="*.tsx"` returns no results
- [ ] `grep -r "getEasingFn" packages/ --include="*.ts" --include="*.tsx"` returns no results
- [ ] `grep -r "transitionEasings" packages/ --include="*.ts" --include="*.tsx"` returns no results
- [ ] `grep -r "(t: number) => " packages/core/src/compiler/transitions/transitionTypes.ts` — FunctionalTransitionSpec closures use `TransitionContext`, not scalar `t`
- [ ] A test scene with `<Transition channels={['opacity']} exit={{ window: [0, 0.3], ease: t => t * t }} />` on a model produces a visually fast opacity exit over 30% of the block
- [ ] A scene with no `<Transition>` children is behaviorally identical to the pre-migration baseline (default windows `[0, 0.5]` and `[0.5, 1.0]`, linear)
