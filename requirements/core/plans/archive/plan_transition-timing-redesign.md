---
title: "Transition Timing Redesign — Named Transitions + exitStart Model"
doc_type: plan
owner: brewsite-architect
status: complete
updated: 2026-03-03
---

# Plan: Transition Timing Redesign — Named Transitions + exitStart Model

## Overview

This plan implements the transition timing redesign specified in
`requirements/core/notes/note_transition-timing-redesign.md` (status: verified, PM-2 sign-off).
It introduces a human-friendly authoring model for scene transitions via a scalar `exitStart` prop
and a `transition` string-name API (`"dissolve"` | `"crossfade"`), while removing five unused
library constants and fixing a broken system default.

### What Changes

| Area | Change |
|---|---|
| `transitionPresets.ts` | Add `TransitionName`, `SceneTransitionProp`, `resolveSceneTransition`; remove 5 `TRANSITION_*` constants |
| `sceneTrackTypes.ts` | Add `'TRANSITION_TIMING'` to `CompileWarningCode`; update `transitionWindow` JSDoc |
| `sceneDslCompiler.ts` | Update `<Scene>` props to discriminated union; call `resolveSceneTransition`; emit last-scene warning |
| `sceneTrackCompiler.ts` | Update hardcoded fallback defaults from `[0,0.5]`/`[0.5,1.0]` to `[0.8,0.9]`/`[0.9,1.0]` |
| `compiler/index.ts` | Remove 5 `TRANSITION_*` exports; add new type/function exports |
| Tests | Add `resolveSceneTransition` tests; update `functionalTransitions` tests; add `TRANSITION_TIMING` test |
| Apps | Migrate architecture scenes from `DISSOLVE_TO_BLACK`; migrate chart scenes from `FADE` |

### Semver Impact

**Major version bump required for `@brewsite/core`.** Two categories of breaking change:
1. **Removed exports** — `TRANSITION_DEFAULT`, `TRANSITION_CROSSFADE`, `TRANSITION_SEQUENTIAL`,
   `TRANSITION_EXIT_FIRST`, `TRANSITION_CUT`. Zero known consumers but breaking by semver definition.
2. **Changed default behavior** — scenes with no `transition` prop change from `exit:[0,0.5]/enter:[0.5,1.0]`
   to `exit:[0.8,0.9]/enter:[0.9,1.0]`. An observable visual change (improvement).

---

## Architectural Decisions — Open Questions from Spec Note

### Q1: `exitStart` Default Value
**Decision: `0.8`** (spec recommendation). Produces `exit:[0.8,0.9]`, `enter:[0.9,1.0]` — each fade is
10% of the transition block. This is correct for marketing scenes where content visibility is paramount:
the scene stays fully opaque for 80% of the block, then fades fast. The value is a named constant
`DEFAULT_EXIT_START = 0.8` and can be adjusted in a minor release after real-world validation.

### Q2: `"crossfade"` Visual Validation
**Decision: Include in MVP; flag for visual validation before declaring production-ready.** The math
(`exit:[0,1], enter:[0,1]`) is provably correct — opacity sum = 1 at every blockProgress frame.
Whether two simultaneous full-scene 3D setups look visually coherent is context-dependent.
Implementors must validate `"crossfade"` against a real diagram or model scene. If the visual result
is unacceptable, `"crossfade"` can be dropped from `TransitionName` in a follow-on without breaking
other users (dissolve and raw-window consumers are unaffected).

### Q3: `exitStart` on Last Scene Warning
**Decision: Implement.** Add `'TRANSITION_TIMING'` to `CompileWarningCode`. Emit from `sceneRootHandler`
when `props.exitStart !== undefined && api.context.sceneIndex === api.context.numScenes - 1`. Message:
`"exitStart on the last scene ('<id>') has no effect. There is no outgoing transition from the final scene."`
Pattern mirrors the existing `'PROGRESS_MANAGER'` last-scene warning in `buildProgressProfile`.

### Q4: `"cut"` Future Mechanism
**Decision: Not in scope.** `"cut"` is excluded from `TransitionName`. A future spec must define the
implementation mechanism (zero-tick transition block, compiler flag, or authoring convention). Add a
`// FUTURE: "cut" requires new architecture — see note_transition-timing-redesign.md Q4` comment
in `transitionPresets.ts` next to `TransitionName`.

### Q5: `resolveSceneTransition` Export Scope
**Decision: Export publicly from `compiler/index.ts`.** Useful for app-layer code constructing
`SceneFrame` objects directly (test harnesses, code generators). Documented as an advanced utility.
Standard scene authors do not need to call it — they use `exitStart` and `transition` props instead.

### Q6: `ElementTransitionSpec` Compatibility
**Decision: Document as known limitation; no code change.** `ElementTransitionSpec` pre-bakes
transitions with a hardcoded `mid = Math.floor(blockSize / 2)` split in `sceneTrackCompiler.ts:430`.
It does not read `transitionWindow` and will not respect `exitStart`. Update the JSDoc on
`FunctionalTransitionSpec.defaultWindow` and `SceneFrame.transitionWindow` to state this limitation.
All new renderable elements MUST use `FunctionalTransitionSpec`.

### Q7: Existing Compiler Test Breakage
**Decision: Update affected tests to pin their window values explicitly.** Tests in
`functionalTransitions.test.ts` that depend on the old system defaults (`[0,0.5]`/`[0.5,1.0]`)
must be updated. The "exit closure" test asserts at `bp=0.25` and `bp=0.5` — both fall outside the
new exit window `[0.8,0.9]` and will produce incorrect values. The "enter closure" test's
`bp=0.49` assertion coincidentally passes with new defaults but should also be pinned for
long-term stability. Fix: inject explicit `transitionWindow` into the raw `SceneFrame` returned by
`getFrame()`, decoupling these tests from the system default. Full test updates specified below.

---

## File Change Manifest

| File | Action | Reason |
|---|---|---|
| `packages/core/src/compiler/transitions/transitionPresets.ts` | Modify | Add 3 new exports; remove 5 constants |
| `packages/core/src/compiler/sceneTrackTypes.ts` | Modify | Add `'TRANSITION_TIMING'` warning code; update JSDoc |
| `packages/core/src/compiler/sceneDslCompiler.ts` | Modify | Scene props discriminated union; call `resolveSceneTransition`; last-scene warning |
| `packages/core/src/compiler/sceneTrackCompiler.ts` | Modify | Update 2 fallback default tuples |
| `packages/core/src/compiler/index.ts` | Modify | Remove 5 exports; add 3 new exports |
| `packages/core/src/compiler/__tests__/transitionTypes.test.ts` | Modify | Add `resolveSceneTransition` test suite |
| `packages/core/src/compiler/__tests__/functionalTransitions.test.ts` | Modify | Pin window values; update assertions |
| `packages/core/src/compiler/__tests__/compileWarnings.test.tsx` | Modify | Add `TRANSITION_TIMING` warning test |
| `apps/examples/src/architecture/widgetSetup.ts` | Modify | Remove `DISSOLVE_TO_BLACK` |
| `apps/examples/src/architecture/scenes/scene_core.tsx` | Modify | Replace `transition={DISSOLVE_TO_BLACK}` → `exitStart={0.9}` |
| `apps/examples/src/architecture/scenes/scene_diagram.tsx` | Modify | Replace `transition={DISSOLVE_TO_BLACK}` → `exitStart={0.9}` |
| `apps/examples/src/architecture/scenes/scene_model.tsx` | Modify | Replace `transition={DISSOLVE_TO_BLACK}` → `exitStart={0.9}` |
| `apps/examples/src/architecture/scenes/scene_charts.tsx` | Modify | Replace `transition={DISSOLVE_TO_BLACK}` → `exitStart={0.9}` |
| `apps/examples/src/chart/scenes/chartDemo.tsx` | Modify | Replace `FADE` constant with inline raw window |

**Files NOT changed:**
- `compiler/transitions/transitionTypes.ts` — no change (types, blends, quats all unchanged)
- `compiler/transitions/transitionResolver.ts` — no change (`makeResolver`, `makeSimpleContext` unchanged)
- `compiler/sceneTrackTypes.ts` (`TransitionWindow`) — `TransitionWindow` type unchanged
- Any `render.ts`, widget, or runtime files — `TransitionName` is resolved to `TransitionWindow` at
  compile time; the runtime never sees string transition names

---

## Detailed File Changes

### 1. `packages/core/src/compiler/transitions/transitionPresets.ts`

#### Remove (all 5 constant exports, lines 15–39 in current file)

```typescript
// DELETE these 5 exports entirely:
export const TRANSITION_CROSSFADE: TransitionWindow = { exit: [0, 0.5], enter: [0.5, 1] };
export const TRANSITION_DEFAULT: TransitionWindow = {};
export const TRANSITION_SEQUENTIAL: TransitionWindow = { exit: [0, 0.4], enter: [0.6, 1] };
export const TRANSITION_EXIT_FIRST: TransitionWindow = { exit: [0, 0.6], enter: [0.4, 1] };
export const TRANSITION_CUT: TransitionWindow = { exit: [0, 0], enter: [1, 1] };
```

#### Update file header comment
Change:
```typescript
// Named transition window presets and easing functions for scene authoring.
// Replaces the old EasingName string enum with first-class EaseFn constants.
```
To:
```typescript
// Named transition types, resolver function, and easing functions for scene authoring.
```

#### Add after the updated header comment and imports, BEFORE the `// Easing Functions` section

```typescript
// ====================
// Named Transition Types
// ====================

/**
 * Named transition types accepted by the <Scene transition="..."> prop.
 *
 * 'dissolve': Through-black transition. The outgoing scene holds at full opacity until exitStart,
 *             then fades to nothing. The incoming scene fades in symmetrically.
 *             This is the system default.
 *
 * 'crossfade': Equal-blend. Both scenes simultaneously visible across the full transition block.
 *              Outgoing opacity: 1→0, incoming opacity: 0→1. Sum = 1 at every blockProgress.
 *              No double-exposure zone. exitStart is ignored (enforced by TypeScript).
 *
 * FUTURE: 'cut' requires new architecture — zero-tick block or separate compiler path.
 * Not supported in MVP. See note_transition-timing-redesign.md Q4.
 */
export type TransitionName = 'dissolve' | 'crossfade';

/**
 * The value accepted by <Scene transition={...}>.
 * Either a named string (TransitionName) or a raw TransitionWindow escape hatch.
 * When using a raw TransitionWindow, exitStart is not applicable (enforced at TypeScript level
 * via the SceneTransitionProps discriminated union in sceneDslCompiler.ts).
 */
export type SceneTransitionProp = TransitionName | TransitionWindow;

/** Default blockProgress value at which the outgoing scene begins fading. */
const DEFAULT_EXIT_START = 0.8;

/**
 * Resolves a SceneTransitionProp + exitStart to a concrete TransitionWindow.
 * Pure function — no side effects. Called by the <Scene> node handler in sceneDslCompiler.ts.
 * The runtime never calls this function; the resolved window is stored on SceneFrame.transitionWindow.
 *
 * Resolution rules:
 * - undefined or 'dissolve':
 *     exitStart clamped to [0, 0.99] (prevents degenerate window where exitStart >= 1).
 *     mid = (exitStart + 1.0) / 2
 *     → exit: [exitStart, mid], enter: [mid, 1.0]
 *     Example (exitStart=0.8, default): exit:[0.8,0.9], enter:[0.9,1.0]
 *     Example (exitStart=0.9): exit:[0.9,0.95], enter:[0.95,1.0]  ← matches old DISSOLVE_TO_BLACK
 *
 * - 'crossfade':
 *     Equal-blend. exitStart is ignored.
 *     → exit: [0, 1], enter: [0, 1]
 *
 * - TransitionWindow (raw object):
 *     Pass through unchanged. exitStart is not applicable.
 *
 * @param prop      Named type, raw window, or undefined (defaults to 'dissolve').
 * @param exitStart Normalized blockProgress where outgoing scene starts fading. Only for 'dissolve'.
 *                  Default: 0.8. Clamped to [0, 0.99].
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
  // Raw TransitionWindow escape hatch — pass through unchanged.
  return prop;
}
```

The easing functions section (`easeLinear` through `easeOutQuart`) is **unchanged**.

---

### 2. `packages/core/src/compiler/sceneTrackTypes.ts`

#### Update `CompileWarningCode`

Locate (around line 22):
```typescript
export type CompileWarningCode =
  | 'MISSING_WIDGET'
  | 'DUPLICATE_WIDGET_ID'
  | 'UNRESOLVED_REFERENCE'
  | 'PROGRESS_MANAGER';
```

Change to:
```typescript
export type CompileWarningCode =
  | 'MISSING_WIDGET'
  | 'DUPLICATE_WIDGET_ID'
  | 'UNRESOLVED_REFERENCE'
  | 'PROGRESS_MANAGER'
  | 'TRANSITION_TIMING';
```

#### Update `SceneFrame.transitionWindow` JSDoc (around lines 213–223)

Replace the existing JSDoc comment on `transitionWindow` with:
```typescript
  /**
   * Transition window configuration governing THIS scene's fade behavior in both directions.
   * Set by the <Scene> node handler via resolveSceneTransition(props.transition, props.exitStart).
   * Always a concrete TransitionWindow by the time it reaches SceneFrame — string names are
   * resolved at compile time; the runtime never sees TransitionName values.
   *
   * exit  — controls when THIS scene fades out (when it is the departing scene in block N→N+1).
   *         Read as fromSnap.transitionWindow.exit during transition block N.
   * enter — controls when THIS scene fades in (when it is the arriving scene in block N-1→N).
   *         Read as toSnap.transitionWindow.enter during transition block N-1.
   *
   * Both fields are set from a single resolveSceneTransition() call on this scene's <Scene> node.
   * For 'dissolve' (the default), the windows are symmetric: exit:[exitStart, mid], enter:[mid, 1.0].
   *
   * IMPORTANT LIMITATION: Only affects widgets using FunctionalTransitionSpec.
   * Widgets using ElementTransitionSpec are pre-baked at compile time using a hardcoded
   * mid = Math.floor(blockSize / 2) split and do NOT read this field.
   * All new renderable elements should use FunctionalTransitionSpec.
   */
  transitionWindow?: TransitionWindow;
```

---

### 3. `packages/core/src/compiler/sceneDslCompiler.ts`

#### Add imports at top of file (after existing imports)

Add to the import block from `'./sceneTrackTypes'`:
```typescript
import type { CompileWarning, SceneFrame, TransitionWindow } from './sceneTrackTypes';
// (TransitionWindow is already imported — keep it for api.state.transitionWindow compatibility)
```

Add new import for the resolver:
```typescript
import { resolveSceneTransition } from './transitions/transitionPresets';
import type { SceneTransitionProp } from './transitions/transitionPresets';
```

#### Add `SceneTransitionProps` type (add before the `Scene` component export)

```typescript
/**
 * Discriminated union for <Scene> transition control props.
 *
 * Branch 1 (dissolve/default):
 *   transition?: 'dissolve'  — can be omitted; both resolve to dissolve-through-black.
 *   exitStart?: number       — blockProgress where the scene starts fading. Default: 0.8.
 *                              Higher = scene stays opaque longer. Range: [0, 0.99].
 *
 * Branch 2 (crossfade or raw window):
 *   transition: 'crossfade' | TransitionWindow  — required in this branch.
 *   exitStart?: never        — TypeScript compile error if exitStart is provided here.
 *                              exitStart is meaningless for crossfade and raw windows.
 *
 * Examples:
 *   <Scene id="s1" />                                       // dissolve, exitStart=0.8
 *   <Scene id="s1" exitStart={0.9} />                       // dissolve, exitStart=0.9
 *   <Scene id="s1" transition="dissolve" exitStart={0.7} /> // explicit dissolve
 *   <Scene id="s1" transition="crossfade" />                // crossfade
 *   <Scene id="s1" transition={{ exit:[0.7,1.0], enter:[0.0,0.3] }} />  // raw escape hatch
 */
type SceneTransitionProps =
  | { transition?: 'dissolve'; exitStart?: number }
  | { transition: 'crossfade' | TransitionWindow; exitStart?: never };
```

#### Update `Scene` component props signature

Before:
```typescript
export const Scene = (props: {
  id: string;
  meta?: Record<string, JsonPrimitive>;
  metalnessMultiplier?: number | ((context: SceneSnapshotContext) => number);
  roughnessMultiplier?: number | ((context: SceneSnapshotContext) => number);
  /**
   * Transition window for the incoming transition into this scene.
   * exit — sub-window within [0,1] where the outgoing scene fades out.
   * enter — sub-window within [0,1] where this scene fades in.
   * Only affects widgets using FunctionalTransitionSpec.
   */
  transition?: TransitionWindow;
  children?: React.ReactNode;
}): null => {
```

After:
```typescript
export const Scene = (props: {
  id: string;
  meta?: Record<string, JsonPrimitive>;
  /**
   * Multiplier applied to base metalness for all model materials in this scene.
   */
  metalnessMultiplier?: number | ((context: SceneSnapshotContext) => number);
  /**
   * Multiplier applied to base roughness for all model materials in this scene.
   */
  roughnessMultiplier?: number | ((context: SceneSnapshotContext) => number);
  children?: React.ReactNode;
} & SceneTransitionProps): null => {
```

#### Update `sceneRootHandler` — props type cast

The handler casts `node.props` to a plain object. Change the type of `transition` in that cast:

Before:
```typescript
const props = node.props as {
  id?: string;
  meta?: Record<string, JsonPrimitive>;
  metalnessMultiplier?: number | ((context: SceneSnapshotContext) => number);
  roughnessMultiplier?: number | ((context: SceneSnapshotContext) => number);
  transition?: TransitionWindow;
};
```

After:
```typescript
const props = node.props as {
  id?: string;
  meta?: Record<string, JsonPrimitive>;
  metalnessMultiplier?: number | ((context: SceneSnapshotContext) => number);
  roughnessMultiplier?: number | ((context: SceneSnapshotContext) => number);
  transition?: SceneTransitionProp;
  exitStart?: number;
};
```

#### Update `sceneRootHandler` — transition handling block

Before (around line 298):
```typescript
  if (props.transition) {
    api.state.transitionWindow = props.transition;
  }
```

After:
```typescript
  if (props.transition !== undefined || props.exitStart !== undefined) {
    api.state.transitionWindow = resolveSceneTransition(props.transition, props.exitStart);
  }

  // Warn when exitStart is declared on the last scene — it has no effect because there
  // is no outgoing transition block from the final scene.
  if (props.exitStart !== undefined && api.context.sceneIndex === api.context.numScenes - 1) {
    const lastSceneId = String(sceneId ?? 'unknown');
    api.pushWarning({
      code: 'TRANSITION_TIMING',
      message:
        `exitStart on the last scene ("${lastSceneId}") has no effect. ` +
        'There is no outgoing transition from the final scene.',
      sceneIndex: api.context.sceneIndex,
    });
  }
```

**Sequencing note:** `sceneId` is computed early in `sceneRootHandler` (before any `api.*` calls).
The warning block above must come after `sceneId` is computed and after `if (sceneId) api.setSceneMeta(...)`.
In the current file, the `if (props.transition)` block is at the end of prop handling, before `compileChildrenSeparated`.
Place the new transition + warning block in the same position — after `metalnessMultiplier` / `roughnessMultiplier`
handling and before the `compileChildrenSeparated` call.

**No other changes to this file.** The `resolveSceneFromDsl`, `ensureSceneRegistry`, `createApi`, and
`SceneRegistrationContext` usage are all unchanged.

---

### 4. `packages/core/src/compiler/sceneTrackCompiler.ts`

**One change only.** Locate lines 464–467:

```typescript
        const sceneExit: [number, number] =
          fromSnap.transitionWindow?.exit ?? specDefault?.exit ?? [0, 0.5];
        const sceneEnter: [number, number] =
          toSnap.transitionWindow?.enter ?? specDefault?.enter ?? [0.5, 1.0];
```

Change to:

```typescript
        // Fallback matches resolveSceneTransition('dissolve', 0.8):
        //   eos=0.8, mid=(0.8+1.0)/2=0.9 → exit:[0.8,0.9], enter:[0.9,1.0]
        // This path only fires for FunctionalTransitionSpec widgets with no scene-level
        // transitionWindow AND no defaultWindow on their spec. After the DSL-layer change,
        // most scenes resolve and store a transitionWindow at compile time.
        const sceneExit: [number, number] =
          fromSnap.transitionWindow?.exit ?? specDefault?.exit ?? [0.8, 0.9];
        const sceneEnter: [number, number] =
          toSnap.transitionWindow?.enter ?? specDefault?.enter ?? [0.9, 1.0];
```

**The `ElementTransitionSpec` path at line 430 (`mid = Math.floor(blockSize / 2)`) is intentionally
unchanged.** `ElementTransitionSpec` does not respect `transitionWindow` — this is the documented
limitation from Q6 above.

---

### 5. `packages/core/src/compiler/index.ts`

#### Remove the 5 constant exports

Locate the existing export block (around lines 41–54):
```typescript
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
```

Change to:
```typescript
export {
  easeLinear,
  easeOutCubic,
  easeOutExpo,
  easeInOutSine,
  easeInOutCubic,
  easeInSquared,
  easeOutQuart,
} from './transitions/transitionPresets';
```

#### Add new exports (add adjacent to the easing exports, with an updated comment)

Update the comment from:
```typescript
// Transition window presets and named easing functions for scene authoring.
```
To:
```typescript
// Named transition types, resolver function, and easing functions for scene authoring.
```

Add the new type and function exports immediately before the easing export block:
```typescript
export type { TransitionName, SceneTransitionProp } from './transitions/transitionPresets';
export { resolveSceneTransition } from './transitions/transitionPresets';
```

#### Full resulting state of the bottom of `compiler/index.ts`

After the change, the transition-related section of `compiler/index.ts` should read:
```typescript
// Transition control types — used in FunctionalTransitionSpec closures and DSL authoring.
export type {
  EaseFn,
  TransitionContext,
  CompiledTransitionGroup,
  WithTransitionConfig,
  TransitionPhase,
} from './transitions/transitionTypes';

// TransitionWindow lives in sceneTrackTypes (shared with SceneFrame.transitionWindow).
export type { TransitionWindow } from './sceneTrackTypes';

// makeResolver + makeSimpleContext — resolver for FunctionalTransitionSpec closures.
export { makeResolver, makeSimpleContext } from './transitions/transitionResolver';

// Named transition types, resolver function, and easing functions for scene authoring.
export type { TransitionName, SceneTransitionProp } from './transitions/transitionPresets';
export { resolveSceneTransition } from './transitions/transitionPresets';
export {
  easeLinear,
  easeOutCubic,
  easeOutExpo,
  easeInOutSine,
  easeInOutCubic,
  easeInSquared,
  easeOutQuart,
} from './transitions/transitionPresets';
```

---

## Test Strategy

### New tests: `resolveSceneTransition`

**File:** `packages/core/src/compiler/__tests__/transitionTypes.test.ts`

Add a new `describe('resolveSceneTransition', ...)` block. All cases must pass:

```typescript
import { resolveSceneTransition } from '../transitions/transitionPresets';
import type { TransitionWindow } from '../sceneTrackTypes';

describe('resolveSceneTransition', () => {
  describe('dissolve (default)', () => {
    it('undefined prop + undefined exitStart → exit:[0.8,0.9] enter:[0.9,1.0]', () => {
      const result = resolveSceneTransition(undefined, undefined);
      expect(result).toEqual({ exit: [0.8, 0.9], enter: [0.9, 1.0] });
    });

    it("explicit 'dissolve' + no exitStart → same as undefined", () => {
      expect(resolveSceneTransition('dissolve', undefined)).toEqual({ exit: [0.8, 0.9], enter: [0.9, 1.0] });
    });

    it('exitStart=0.7 → mid=0.85, exit:[0.7,0.85] enter:[0.85,1.0]', () => {
      const result = resolveSceneTransition(undefined, 0.7);
      expect(result.exit?.[0]).toBeCloseTo(0.7);
      expect(result.exit?.[1]).toBeCloseTo(0.85);
      expect(result.enter?.[0]).toBeCloseTo(0.85);
      expect(result.enter?.[1]).toBeCloseTo(1.0);
    });

    it('exitStart=0.9 → mid=0.95, exit:[0.9,0.95] enter:[0.95,1.0] — matches old DISSOLVE_TO_BLACK', () => {
      const result = resolveSceneTransition('dissolve', 0.9);
      expect(result.exit?.[0]).toBeCloseTo(0.9);
      expect(result.exit?.[1]).toBeCloseTo(0.95);
      expect(result.enter?.[0]).toBeCloseTo(0.95);
      expect(result.enter?.[1]).toBeCloseTo(1.0);
    });

    it('exitStart=0 → exit:[0,0.5] enter:[0.5,1.0] — not clamped, lower bound is 0', () => {
      const result = resolveSceneTransition(undefined, 0);
      expect(result.exit?.[0]).toBeCloseTo(0);
      expect(result.exit?.[1]).toBeCloseTo(0.5);
      expect(result.enter?.[0]).toBeCloseTo(0.5);
      expect(result.enter?.[1]).toBeCloseTo(1.0);
    });

    it('exitStart=1.0 → clamped to 0.99, mid=0.995', () => {
      const result = resolveSceneTransition(undefined, 1.0);
      expect(result.exit?.[0]).toBeCloseTo(0.99);
      expect(result.exit?.[1]).toBeCloseTo(0.995);
      expect(result.enter?.[0]).toBeCloseTo(0.995);
      expect(result.enter?.[1]).toBeCloseTo(1.0);
    });

    it('exitStart negative → clamped to 0', () => {
      const result = resolveSceneTransition(undefined, -0.5);
      expect(result.exit?.[0]).toBeCloseTo(0);
    });

    it('exitStart=1.5 → clamped to 0.99', () => {
      const result = resolveSceneTransition(undefined, 1.5);
      expect(result.exit?.[0]).toBeCloseTo(0.99);
    });
  });

  describe('crossfade', () => {
    it("'crossfade' → exit:[0,1] enter:[0,1]", () => {
      expect(resolveSceneTransition('crossfade', undefined)).toEqual({ exit: [0, 1], enter: [0, 1] });
    });

    it('crossfade ignores exitStart — always full-block windows', () => {
      // exitStart would be a TypeScript error; test runtime behavior for safety
      // @ts-expect-error — testing runtime behavior with invalid prop combination
      const result = resolveSceneTransition('crossfade', 0.7);
      expect(result).toEqual({ exit: [0, 1], enter: [0, 1] });
    });
  });

  describe('raw TransitionWindow escape hatch', () => {
    it('raw window passes through by reference', () => {
      const raw: TransitionWindow = { exit: [0.7, 1.0], enter: [0.0, 0.3] };
      const result = resolveSceneTransition(raw, undefined);
      expect(result).toBe(raw); // strict referential identity — no copy
    });

    it('raw window with only exit defined passes through', () => {
      const raw: TransitionWindow = { exit: [0.5, 0.8] };
      expect(resolveSceneTransition(raw, undefined)).toBe(raw);
    });

    it('raw empty window passes through', () => {
      const raw: TransitionWindow = {};
      expect(resolveSceneTransition(raw, undefined)).toBe(raw);
    });
  });
});
```

### Updated tests: `packages/core/src/compiler/__tests__/functionalTransitions.test.ts`

Two tests must be updated to use explicit `transitionWindow` values (injected via raw `SceneFrame`
returned by `getFrame()`), decoupling them from the system default.

**Test: "exit closure: active in first half, absent state in second half"**

The test currently asserts at `bp=0.25` (mid-window in old default `[0,0.5]`). After the default
changes to `[0.8,0.9]`, `bp=0.25` is before the exit window starts — the value stays at full state.
Fix by adding `transitionWindow: { exit: [0, 0.5] }` to the outgoing scene's raw frame.

Change from:
```typescript
it('exit closure: active in first half, absent state in second half', () => {
  const registry = new WidgetRegistry().register(makeTestWidget(widgetId, testFunctionalSpec));
  const scenes = [
    makeScene('s1', { value: 10, active: true }),
    makeScene('s2', undefined),
  ];
  // ... assertions using bp=0.25 and bp=0.5
```

To:
```typescript
it('exit closure with explicit window [0,0.5]: active until window end, absent after', () => {
  const registry = new WidgetRegistry().register(makeTestWidget(widgetId, testFunctionalSpec));
  // Inject explicit transitionWindow into s1's frame to decouple test from system defaults.
  const scenes: SceneDefinition[] = [
    {
      id: 's1',
      getFrame: (): SceneFrame => ({
        id: 's1',
        scrollProgress: 0,
        widgets: { [widgetId]: { value: 10, active: true } },
        transitionWindow: { exit: [0, 0.5] },
      }),
    },
    makeScene('s2', undefined),
  ];
  const track = compileTrack(scenes, registry);
  const fn = track.transitionBlocks?.[0]?.widgetFns[widgetId];
  expect(fn?.kind).toBe('exit');
  // Exit window [0, 0.5]. At bp=0 → t=0 → full state (value=10, active=true).
  expect(fn?.fn(0)).toEqual({ value: 10, active: true });
  // At bp=0.25 → within exit window → t=0.5 → partially faded (0 < value < 10).
  const quarter = fn?.fn(0.25) as TestState;
  expect(quarter.value).toBeGreaterThan(0);
  expect(quarter.value).toBeLessThan(10);
  expect(quarter.active).toBe(true);
  // At bp=0.5 → effectiveExitEnd=0.5 → absentDefault.
  expect(fn?.fn(0.5)).toEqual({ value: 0, active: false });
  // At bp=1 → still absentDefault.
  expect(fn?.fn(1)).toEqual({ value: 0, active: false });
});
```

**Test: "enter closure: absent state in first half, active in second half"**

The `bp=0`, `bp=0.49`, and `bp=1` assertions coincidentally pass with the new default `[0.9,1.0]`
enter window. However, the test should be made explicit for long-term stability:

Change from:
```typescript
it('enter closure: absent state in first half, active in second half', () => {
  const registry = new WidgetRegistry().register(makeTestWidget(widgetId, testFunctionalSpec));
  const scenes = [
    makeScene('s1', undefined),
    makeScene('s2', { value: 10, active: true }),
  ];
  // ... assertions using bp=0, bp=0.49, bp=1
```

To:
```typescript
it('enter closure with explicit window [0.5,1]: absent before window, active at end', () => {
  const registry = new WidgetRegistry().register(makeTestWidget(widgetId, testFunctionalSpec));
  // Inject explicit transitionWindow into s2's frame to decouple test from system defaults.
  const scenes: SceneDefinition[] = [
    makeScene('s1', undefined),
    {
      id: 's2',
      getFrame: (): SceneFrame => ({
        id: 's2',
        scrollProgress: 0,
        widgets: { [widgetId]: { value: 10, active: true } },
        transitionWindow: { enter: [0.5, 1] },
      }),
    },
  ];
  const track = compileTrack(scenes, registry);
  const fn = track.transitionBlocks?.[0]?.widgetFns[widgetId];
  expect(fn?.kind).toBe('enter');
  // Enter window [0.5, 1]. bp < effectiveEnterStart (0.5) → absentDefault.
  expect(fn?.fn(0)).toEqual({ value: 0, active: false });
  expect(fn?.fn(0.49)).toEqual({ value: 0, active: false });
  // At bp=1 → t=1 → full toState.
  expect(fn?.fn(1)).toEqual({ value: 10, active: true });
});
```

**Note on `SceneFrame` type import:** Add `import type { SceneFrame } from '../sceneTrackTypes';`
to the test file if not already present. The `getFrame()` return type must be typed as `SceneFrame`
(not `JSX.Element`) to use the raw path in `compileSceneTrack`.

### New test: `TRANSITION_TIMING` warning

**File:** `packages/core/src/compiler/__tests__/compileWarnings.test.tsx`

Add to the `describe('compile warnings', ...)` block:

```typescript
it('emits TRANSITION_TIMING warning when exitStart is on the last scene', () => {
  const registry = new WidgetRegistry();
  registry.register(new BoxWidget('w1'));

  const scenes: SceneDefinition[] = [
    {
      id: 'first',
      getFrame: () => (
        <Scene id="first">
          <Box id="w1" />
        </Scene>
      ),
    },
    {
      id: 'last',
      // exitStart on last scene — should emit TRANSITION_TIMING warning
      getFrame: () => (
        <Scene id="last" exitStart={0.9}>
          <Box id="w1" />
        </Scene>
      ),
    },
  ];

  const track = compileSceneTrack({
    scenes,
    widgetRegistry: registry,
    blockSize: 4,
  });

  const timingWarnings = track.warnings?.filter((w) => w.code === 'TRANSITION_TIMING') ?? [];
  expect(timingWarnings).toHaveLength(1);
  expect(timingWarnings[0]?.message).toContain('exitStart');
  expect(timingWarnings[0]?.message).toContain('last');
  expect(timingWarnings[0]?.sceneIndex).toBe(1);
});

it('does not emit TRANSITION_TIMING warning when exitStart is on a non-last scene', () => {
  const registry = new WidgetRegistry();
  registry.register(new BoxWidget('w1'));

  const scenes: SceneDefinition[] = [
    {
      id: 'first',
      getFrame: () => (
        <Scene id="first" exitStart={0.9}>
          <Box id="w1" />
        </Scene>
      ),
    },
    {
      id: 'last',
      getFrame: () => (
        <Scene id="last">
          <Box id="w1" />
        </Scene>
      ),
    },
  ];

  const track = compileSceneTrack({
    scenes,
    widgetRegistry: registry,
    blockSize: 4,
  });

  const timingWarnings = track.warnings?.filter((w) => w.code === 'TRANSITION_TIMING') ?? [];
  expect(timingWarnings).toHaveLength(0);
});
```

---

## App Migration Guide

### Migration 1: Architecture Scenes — `DISSOLVE_TO_BLACK` → `exitStart={0.9}`

**Math verification:**
`resolveSceneTransition('dissolve', 0.9)` → `eos=0.9`, `mid=(0.9+1.0)/2=0.95`
→ `{ exit: [0.9, 0.95], enter: [0.95, 1.0] }`

This is **exactly equal** to the old `DISSOLVE_TO_BLACK` constant value. The visual output is identical.

---

**File: `apps/examples/src/architecture/widgetSetup.ts`**

Remove lines 5–9 entirely:
```typescript
// DELETE:
// Dissolve to black: exit completes before enter begins — no overlap, clean black frame between scenes.
export const DISSOLVE_TO_BLACK = {
  exit:  [0.9, 0.95] as [number, number],
  enter: [0.95, 1.0] as [number, number],
};
```

The rest of the file (imports and `createArchitecturePlugins`) is unchanged.

---

**File: `apps/examples/src/architecture/scenes/scene_core.tsx`**

1. Remove the import line:
```typescript
// DELETE:
import { DISSOLVE_TO_BLACK } from '../widgetSetup';
```

2. Change the Scene element (around line 247):
```tsx
// Before:
<Scene id="arch-core" transition={DISSOLVE_TO_BLACK}>

// After:
<Scene id="arch-core" exitStart={0.9}>
```

---

**File: `apps/examples/src/architecture/scenes/scene_diagram.tsx`**

Same as `scene_core.tsx`:
1. Remove `import { DISSOLVE_TO_BLACK } from '../widgetSetup';`
2. Change `transition={DISSOLVE_TO_BLACK}` → `exitStart={0.9}` on the `<Scene id="arch-diagram">` element.

---

**File: `apps/examples/src/architecture/scenes/scene_model.tsx`**

Same as above:
1. Remove `import { DISSOLVE_TO_BLACK } from '../widgetSetup';`
2. Change `transition={DISSOLVE_TO_BLACK}` → `exitStart={0.9}` on the `<Scene id="arch-model">` element.

---

**File: `apps/examples/src/architecture/scenes/scene_charts.tsx`**

Same as above:
1. Remove `import { DISSOLVE_TO_BLACK } from '../widgetSetup';`
2. Change `transition={DISSOLVE_TO_BLACK}` → `exitStart={0.9}` on the `<Scene id="arch-charts">` element.

---

### Migration 2: Chart Demo — `FADE` constant → inline raw window

**Why not `"crossfade"`:**
`FADE = { exit: [0.7, 1.0], enter: [0.0, 0.3] }` produces a 40% double-exposure zone where both
charts are simultaneously at full opacity (exit ends at 1.0 while enter ends at 0.3). This is
intentional — a brief moment of two charts visible together for visual continuity. `"crossfade"`
(`exit:[0,1], enter:[0,1]`) produces a different visual — smooth equal blend, no double-exposure zone.
Keep the raw window to preserve the exact intended overlap behavior.

---

**File: `apps/examples/src/chart/scenes/chartDemo.tsx`**

1. Remove the `FADE` constant (lines 72–75):
```typescript
// DELETE:
const FADE = {
  exit:  [0.7, 1.0] as [number, number],
  enter: [0.0, 0.3] as [number, number],
};
```

2. Replace all four `transition={FADE}` usages with the inline window.
   There are exactly 4 occurrences: `chartDemoBar`, `chartDemoLine`, `chartDemoPie`, `chartDemoScatter`.

```tsx
// Before (all 4 scenes):
<Scene id="chart-demo-bar" transition={FADE}>
<Scene id="chart-demo-line" transition={FADE}>
<Scene id="chart-demo-pie" transition={FADE}>
<Scene id="chart-demo-scatter" transition={FADE}>

// After:
<Scene id="chart-demo-bar" transition={{ exit: [0.7, 1.0], enter: [0.0, 0.3] }}>
<Scene id="chart-demo-line" transition={{ exit: [0.7, 1.0], enter: [0.0, 0.3] }}>
<Scene id="chart-demo-pie" transition={{ exit: [0.7, 1.0], enter: [0.0, 0.3] }}>
<Scene id="chart-demo-scatter" transition={{ exit: [0.7, 1.0], enter: [0.0, 0.3] }}>
```

The comment above `chartDemoBar` ("Hold fully visible, fade out at end; new chart fades in at start.")
can be kept as-is — it still accurately describes the window behavior.

---

## Parallelization Map

With up to 5 developers, the work splits into 3 phases with some internal parallelism.

### Phase 1 — Fully independent (zero inter-developer dependencies)

All of these can be started simultaneously from the `main` branch:

**Dev-1: Core type changes + compiler fallback**
- `packages/core/src/compiler/sceneTrackTypes.ts` — add `'TRANSITION_TIMING'` to `CompileWarningCode`; update `transitionWindow` JSDoc
- `packages/core/src/compiler/sceneTrackCompiler.ts` — update 2 fallback default tuples only

**Dev-2: `transitionPresets.ts`**
- `packages/core/src/compiler/transitions/transitionPresets.ts` — remove 5 constants; add `TransitionName`, `SceneTransitionProp`, `resolveSceneTransition`

**Dev-3a: Architecture app migration (safe interim approach)**
- `apps/examples/src/architecture/widgetSetup.ts` — remove `DISSOLVE_TO_BLACK`
- All 4 architecture scene files — change `transition={DISSOLVE_TO_BLACK}` to
  `transition={{ exit: [0.9, 0.95], enter: [0.95, 1.0] }}` (raw window, identical visually)
  OR wait for Phase 2 to use `exitStart={0.9}` — both are correct.

**Dev-3b: Chart app migration (fully independent)**
- `apps/examples/src/chart/scenes/chartDemo.tsx` — remove `FADE`, inline raw window

### Phase 2 — Depends on Dev-2 (Phase 1) completing

**Dev-4: DSL layer + public API exports**
- `packages/core/src/compiler/sceneDslCompiler.ts` — update `Scene` props, handler, add warning
- `packages/core/src/compiler/index.ts` — update exports

Imports from `transitionPresets.ts`:
```typescript
import { resolveSceneTransition } from './transitions/transitionPresets';
import type { SceneTransitionProp } from './transitions/transitionPresets';
```
Dev-4 cannot start until Dev-2 has merged these exports.

**Dev-3a (if using `exitStart={0.9}`)**: If Dev-3a held off on the final migration to wait for
`exitStart` prop support, they can update from the interim raw window to `exitStart={0.9}` once
Dev-4 merges.

### Phase 3 — Depends on all Phase 1 + Phase 2 completing

**Dev-5: All test changes**
- `packages/core/src/compiler/__tests__/transitionTypes.test.ts` — add `resolveSceneTransition` suite
- `packages/core/src/compiler/__tests__/functionalTransitions.test.ts` — update 2 tests with explicit windows
- `packages/core/src/compiler/__tests__/compileWarnings.test.tsx` — add 2 `TRANSITION_TIMING` tests

Dev-5 depends on:
- Dev-1 (`TRANSITION_TIMING` warning code must exist before the warning test compiles)
- Dev-2 (`resolveSceneTransition` must exist before unit tests can import it)
- Dev-4 (DSL `exitStart` prop must exist before the warning integration test can use `<Scene exitStart={...}>`)

### Dependency graph

```
Dev-1 (sceneTrackTypes + sceneTrackCompiler)  ─────────────────────────────┐
Dev-2 (transitionPresets) ──────────────────→ Dev-4 (sceneDslCompiler + index) ──→ Dev-5 (tests)
Dev-3a (arch app migration)  ──────────────────────────────────────────────┘
Dev-3b (chart app migration) ─── independent, can merge at any time ────────────→ (done)
```

### Merge order (safe)
1. Dev-1, Dev-2, Dev-3b can merge in any order — all are non-overlapping files
2. Dev-4 merges after Dev-2
3. Dev-3a finalizes (switching to `exitStart={0.9}`) after Dev-4
4. Dev-5 merges after Dev-1 + Dev-4 are merged
5. Major version bump commit

### Verification checklist before major version bump
- [ ] `pnpm typecheck` passes in `packages/core`
- [ ] `pnpm test` passes in `packages/core` (all compiler tests green)
- [ ] `pnpm typecheck` passes in `apps/examples`
- [ ] No references to `TRANSITION_DEFAULT`, `TRANSITION_CROSSFADE`, `TRANSITION_SEQUENTIAL`,
      `TRANSITION_EXIT_FIRST`, `TRANSITION_CUT` remain in `packages/` or `apps/`
- [ ] `resolveSceneTransition(undefined, undefined)` returns `{ exit: [0.8, 0.9], enter: [0.9, 1.0] }`
- [ ] `resolveSceneTransition('dissolve', 0.9)` returns `{ exit: [0.9, 0.95], enter: [0.95, 1.0] }`
- [ ] `resolveSceneTransition('crossfade')` returns `{ exit: [0, 1], enter: [0, 1] }`
- [ ] Compiling a scene with `exitStart={0.9}` on the last scene produces a `TRANSITION_TIMING` warning
- [ ] `pnpm dev` shows architecture and chart demo scenes transitioning correctly
