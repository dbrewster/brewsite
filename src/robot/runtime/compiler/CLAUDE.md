# Compiler Layer

**Role:** Pure compile-time pipeline. Transforms `SceneDefinition[]` + timeline config into a
pre-baked `SceneTrack` (lookup table). No Three.js. No React. No runtime imports.

---

## Two distinct audiences

This directory serves two different callers, and they access it differently:

**1. Scene authors (DSL authoring surface)**
Import from `compiler/index.ts`.
Exposes: `resolveSceneFromDsl`, `ResolvedScene`, and all DSL primitives (Scene, Lighting,
Background, Model, Transitions, etc.) + `annotationBlocks`.
**Do not add infrastructure types here.** The index is intentionally DSL-only.

**2. Infrastructure callers (compiler output consumers)**
Import directly from the internal files:
- `sceneTrackCompiler.ts` → `compileSceneTrack()`
- `sceneTrackTypes.ts` → `SceneTrack`, `SceneTrackTick`, `SceneWindow`, `CompiledAnimation`, etc.
- `sceneTrackSampler.ts` → `createSceneTrackSampler()`, `SceneTrackSampler`
- `sceneTrackCache.ts` → `useSceneTrackQuality`
- `sceneTypes.ts` → `SceneDefinition`, `SceneFrameContext`, `SceneTransition`, `SceneSource`, `SceneGroup`

---

## Output contract

`compileSceneTrack(options) → SceneTrack`

`SceneTrack` is a flat array of `SceneTrackTick` entries pre-baked at uniform intervals over
`0 → 1` global progress. Sampling is O(1) via `createSceneTrackSampler`.

**`SceneTrackTick` fields:**

| Field | Notes |
|---|---|
| `index` | Tick index in the array |
| `progress` | Global 0→1 |
| `sceneId` | Active scene id |
| `sceneIndex` | Active scene index |
| `sceneProgress` | Scene-local 0→1 |
| `state` | Full `SceneFrame` — the authoritative state |
| `deltaForward` | `SceneFrameDelta` to the next tick |
| `deltaBackward` | `SceneFrameDelta` from the previous tick |
| `annotationPrimitives` | `AnnotationResolved[]` for the annotations layer |
| `modelAnimations` | `Record<string, CompiledAnimation>` per model |

Always read from `tick.state` directly.

---

## Three compiler passes

1. **Base state pass** — resolves each scene at its end to compute the inherited base state for
   the next scene. Gives scenes their `context.baseState`.

2. **Auto-entry pass** — detects transitions with negative `start` values and pulls the scene's
   `entryStart` forward so the sampler knows the transition window begins before nominal scene start.

3. **Tick baking pass** — for every tick across `0 → 1`, determines the active scene, applies
   element transitions (enter/exit/interpolate), builds `deltaForward`/`deltaBackward`,
   compiles `annotationPrimitives`, and compiles `modelAnimations`.

---

## Directory structure

```
compiler/
  index.ts                 DSL-only public surface. Do not add infrastructure exports here.
  sceneTrackCompiler.ts    Main entry: compileSceneTrack(). Lean orchestrator — no per-element logic.
  sceneTrackTypes.ts       Output contract: SceneTrack, SceneTrackTick, SceneWindow, etc.
  sceneTrackSampler.ts     O(1) sampler. createSceneTrackSampler(track).sample(progress).
  sceneTrackCache.ts       Quality-tier caching. useSceneTrackQuality hook.
  sceneTypes.ts            Authoring types: SceneDefinition, SceneFrameContext, SceneTransition, SceneSource, SceneGroup.
  sceneDslCompiler.ts      Maps DSL JSX tree → SceneFrame (used by sceneTrackCompiler).
  sceneDslTypes.ts         Internal DSL node types.
  sceneUtils.ts            applySceneTransitions() — applies a scene's transitions to a frame.
  sceneDefaults.ts         Default values for scene state fields.
  registry.ts              Scene registry helpers.
  transitions/             Re-export barrels → elements/*/compile.ts (source of truth is in elements/)
  primitives/              Re-export barrels → elements/*/dsl.tsx (source of truth is in elements/)
  blocks/                  Higher-level DSL composition blocks (annotationBlocks).
  __tests__/               Compiler tests. These are the stability anchor — do not break them.
```

**Note on transitions/ and primitives/:** These directories contain one-liner re-exports for
import path compatibility. The canonical implementations are in `src/robot/elements/*/compile.ts`
and `src/robot/elements/*/dsl.tsx`. Prefer importing directly from `elements/` in new code.

---

## Scene authoring rules (summary)

- `id` must match a timeline stop id; `index` must match its stop position.
- Entry transitions (negative `start`) belong in the **incoming** scene's `transitions`, not the outgoing one.
- Use `context.baseState` for continuity. If ignoring it, specify the full state.
- No runtime logic (Three.js, animation math) in scene files — scenes are declarative state.
- Register in `sceneOrder.ts` and keep aligned with `robotTimeline.ts` stops.

---

## Element transition API

Per-element transitions are in `elements/{name}/compile.ts`. They export an `ElementTransitionSpec<T>`:

```ts
type ElementTransitionSpec<T> = {
  enter(to: T, context: TransitionContext): T;       // scene entering; only `to` state available
  exit(from: T, context: TransitionContext): T;      // scene leaving; only `from` state available
  interpolate(from: T, to: T, context: TransitionContext): T;  // both scenes active
};
```

`TransitionContext` carries `tExit`, `tEnter`, `tFull`, `progress`, and timing boundaries.
Do not collapse these to a single `t` — implementations use all three t-values.
