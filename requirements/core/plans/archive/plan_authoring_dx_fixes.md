---
title: "Authoring DX Fixes — All 29 Issues from note_authoring_dx_gaps"
doc_type: plan
owner: brewsite-architect
status: complete
updated: 2026-02-28
---

# Authoring DX Fixes

This plan covers all 29 issues identified in `requirements/core/note_authoring_dx_gaps.md`, plus the 7 architect work items. It is organized into five implementation phases, ordered by dependencies and impact. Each section specifies exact file paths, complete TypeScript types, and precise code changes.

**Source note:** `requirements/core/note_authoring_dx_gaps.md`
**Total issues:** 29 (6 type holes, 8 silent failures, 9 API confusion, 6 missing capabilities)
**Architect work items:** A1–A7

---

## Implementation Order Summary

| Phase | Items | Description |
|---|---|---|
| 1 | A2, T1-3, T1-4, T1-6 | Foundation: canonical Vec3, one-line type fixes |
| 2 | A1 (= T1-1, T1-2, T1-5) | Resolvable\<T\> adoption across model DSL |
| 3 | A3, A4, T2-4, T2-5, T2-6 | Warning infrastructure + silent failure fixes |
| 4 | A5, T3-1, T3-2 | Input API redesigns |
| 5 | A6, A7, T3-3–T3-9, T2-7, T2-8, T4-2–T4-6 | Remaining capabilities, JSDoc, deprecations |

---

## Phase 1 — Foundation Type Fixes

These are one-to-three-line changes with no downstream risk. Do them first so Phase 2 can import from them.

---

### A2 — Unify `Vec3` to a single canonical definition

**Covers:** T3-7
**Rationale:** `packages/core/src/math/index.ts` already exports `Vec3 = [number, number, number]`. Three element modules re-declare it identically. Replace the local declarations with re-exports from the canonical source.

**Files to change:**

#### `packages/core/src/elements/model/types.ts`

Replace line 8:
```typescript
// BEFORE:
export type Vec3 = [number, number, number];

// AFTER:
export type { Vec3 } from '../../math';
```

No other changes to this file. All downstream imports of `Vec3` from `model/types.ts` continue to work — they receive the same type via re-export.

#### `packages/core/src/elements/camera/types.ts`

Find the local `Vec3` declaration (exact line varies — search for `type Vec3`) and replace with:
```typescript
export type { Vec3 } from '../../math';
```

If `camera/types.ts` does not currently re-export `Vec3`, simply import it:
```typescript
import type { Vec3 } from '../../math';
```
and use it in all downstream type definitions within that file.

#### `packages/core/src/elements/lighting/types.ts`

Same pattern as camera. Find local `Vec3` declaration and replace:
```typescript
export type { Vec3 } from '../../math';
```

#### `packages/diagram/src/elements/diagram/types.ts`

Check for a local `Vec3` declaration. If present, replace with:
```typescript
import type { Vec3 } from '@brewsite/core';
```
(or from `../../../../packages/core/src/math` via relative path if it's a workspace dependency)

The `@brewsite/core` package's public `index.ts` must re-export `Vec3` from `math/index.ts` if it doesn't already. Check `packages/core/src/index.ts` — if `Vec3` is not exported, add:
```typescript
export type { Vec3, Mat4, Quaternion } from './math';
```

**Dependency check:** `math/index.ts` imports nothing from elements or compiler. No circular dependency risk.

**Testing:** TypeScript `pnpm typecheck` passing is the acceptance criterion. No new unit tests needed — this is a structural re-typing.

---

### T1-3 — `LightingProps.children` should be `ReactNode`

**File:** `packages/core/src/elements/lighting/dsl.tsx`

Change line 106:
```typescript
// BEFORE:
export type LightingProps = {
  intensityScale?: Resolvable<number>;
  color?: Resolvable<string>;
  children?: ReactElement | ReactElement[];
};

// AFTER:
export type LightingProps = {
  intensityScale?: Resolvable<number>;
  color?: Resolvable<string>;
  /** Lighting sub-elements: `<Ambient>`, `<Directional>`, `<Point>`, `<GlowPoint>`, `<Spot>`, `<LightStrand>`, `<Panel>`. */
  children?: ReactNode;
};
```

`ReactNode` is already imported at line 5. No new import needed.

**Testing:** Compile a scene with `{condition && <Ambient intensity={1} color="#fff" />}` as a `<Lighting>` child — this must no longer type-error.

---

### T1-4 — Document why `ISceneElement.DslComponent` stays `any`

**File:** `packages/core/src/widget/types.ts`

Do **not** change the type. Add a JSDoc comment to explain the intentional `any`:

```typescript
/**
 * The DSL React component for this widget.
 *
 * Typed as `ComponentType<any>` because the registry is intentionally heterogeneous —
 * each registered widget has a different prop type for its DSL component. Narrowing to
 * `ComponentType<Record<string, unknown>>` would require a cast at every widget's
 * `DslComponent` assignment site (due to contravariance in function parameter types
 * under `strictFunctionTypes`), buying no real type safety at the boundary.
 *
 * Type safety for DSL props is enforced at each widget's own DSL component definition
 * (e.g., `LightingProps`, `ModelProps`), not at the registry level.
 */
readonly DslComponent: React.ComponentType<any>;
```

**Testing:** `pnpm typecheck` passes with no changes to any widget class.

---

### T1-6 — Make `FitBotHeightCameraProps.mode` required

**File:** `packages/core/src/elements/camera/dsl.tsx`

Change lines 41–48:
```typescript
// BEFORE:
/** Legacy fitBotHeight props for backward compatibility. */
export type FitBotHeightCameraProps = {
  mode?: 'fitBotHeight';
  targetId: string;
  targetHeight: number;
  framingHeightPct?: number;
  heightOffset?: number;
  distanceOffset?: number;
};

// AFTER:
/**
 * Auto-framing camera that fits the target model's height within the viewport.
 *
 * **Transition limitation:** Transitioning between `fitBotHeight` and `world`/`orbit`
 * cameras produces a hard cut at the midpoint — not a smooth interpolation. This is
 * because the world-space position is resolved at render time, not compile time.
 * For smooth camera transitions across modes, use `world` or `orbit` on both ends.
 */
export type FitBotHeightCameraProps = {
  mode: 'fitBotHeight';
  targetId: string;
  targetHeight: number;
  framingHeightPct?: number;
  heightOffset?: number;
  distanceOffset?: number;
};
```

**Breaking change migration:** After making this change, `pnpm typecheck` will fail on every `<Camera targetId="..." targetHeight={...}>` in `apps/examples/` that omits `mode`. The implementor must grep for this pattern and add `mode="fitBotHeight"`:

```bash
grep -r 'targetId=' apps/examples --include='*.tsx' -l
```

For each match, add `mode="fitBotHeight"` to the `<Camera>` props.

**Testing:** `pnpm typecheck` passes after migrating all usages.

---

## Phase 2 — `Resolvable<T>` Adoption Across the Model DSL

**Covers:** A1 (= T1-1, T1-2, T1-5)

This is the highest-impact fix: every function prop on the most-used element switches from `context: unknown` to the typed `SceneSnapshotContext`.

### Step 1: Define `Resolvable<T>` canonically

**File:** `packages/core/src/compiler/sceneTypes.ts`

Add after the existing imports and before `SceneFrameState`:
```typescript
/**
 * A prop value that can either be a plain value or a function that derives
 * the value from the current scene snapshot context.
 *
 * @example
 * // Plain value
 * <Model position={[0, 0, 0]} />
 *
 * // Context-derived value — runs once per scene compilation
 * <Model position={(ctx) => ctx.sceneIndex === 0 ? [0, 0, 0] : [2, 0, 0]} />
 */
export type Resolvable<T> = T | ((context: SceneSnapshotContext) => T);
```

This is the canonical location. All element DSL files import from here.

### Step 2: Rewrite `packages/core/src/elements/model/dsl.tsx`

Replace the entire file. Key changes:
1. Add import of `Resolvable` from `../../compiler/sceneTypes`
2. Add import of concrete motion types from `./types`
3. Replace all `T | ((context: unknown) => T)` with `Resolvable<T>`
4. Fix `MotionProps.commands/scenes/customAnimations` from `unknown` to concrete types
5. Fix `AnimationProps.reset/enabled` to `Resolvable<boolean>`

Complete rewritten file:

```typescript
/**
 * Model element DSL — React components for scene authoring.
 */

import type { ReactNode } from 'react';
import type { Resolvable } from '../../compiler/sceneTypes';
import type {
  AxisRotation,
  AxisTranslation,
  CustomAnimation,
  MotionCommand,
  MotionScene,
} from './types';

// ─── Shared primitive types ────────────────────────────────────────────────────

export type { Vec3 } from '../../math';

// ─── DSL Component Props ───────────────────────────────────────────────────────

export type ModelProps = {
  scale?: Resolvable<number>;
  position?: Resolvable<[number, number, number]>;
  rotation?: Resolvable<[number, number, number]>;
  opacity?: Resolvable<number>;
  metalness?: Resolvable<number>;
  roughness?: Resolvable<number>;
  metalnessMultiplier?: Resolvable<number>;
  roughnessMultiplier?: Resolvable<number>;
  enabled?: Resolvable<boolean>;
  reset?: Resolvable<boolean>;
  /**
   * The asset type key for this model instance (e.g., `'bot'`, `'server'`).
   * Must match a key in the asset manifest models array.
   */
  type: string;
  /**
   * Unique identifier for this model instance in the runtime widget registry.
   * Must match the widget ID used when registering the `ModelWidget` in `widgetSetup.ts`.
   * Also used as the `targetId` in camera descriptors (e.g., `<Camera targetId="bot">`).
   */
  id: string;
  children?: ReactNode;
};

export type BodyPartProps = {
  opacity?: Resolvable<number>;
  color?: Resolvable<string>;
  metalness?: Resolvable<number>;
  roughness?: Resolvable<number>;
  reset?: Resolvable<boolean>;
  children?: ReactNode;
};

export type BodyPartByIdProps = BodyPartProps & {
  id: string;
  targetKind?: 'bone' | 'mesh';
  /** When set, this bone ID is used for pose lookups (enables unified bone+mesh component). */
  boneId?: string;
  /** When set, this mesh ID is used for material lookups (enables unified bone+mesh component). */
  meshId?: string;
};

export type PoseProps = {
  rotate?: Resolvable<AxisRotation>;
  translate?: Resolvable<AxisTranslation>;
  reset?: Resolvable<boolean>;
  // Flat shortcuts — merged into rotate/translate objects at compilation
  yawPct?: Resolvable<number>;
  pitchPct?: Resolvable<number>;
  rollPct?: Resolvable<number>;
  xPct?: Resolvable<number>;
  yPct?: Resolvable<number>;
  zPct?: Resolvable<number>;
};

export type ModelPartProps = {
  id: string;
  anchor?: string;
  space?: 'local' | 'world';
  enabled?: Resolvable<boolean>;
  opacity?: Resolvable<number>;
  scale?: Resolvable<number>;
  position?: Resolvable<[number, number, number]>;
  rotation?: Resolvable<[number, number, number]>;
  reset?: Resolvable<boolean>;
  children?: ReactNode;
};

export type ContainedModelProps = {
  modelId: string;
  position?: Resolvable<[number, number, number]>;
  rotation?: Resolvable<[number, number, number]>;
  scale?: Resolvable<number>;
  children?: ReactNode;
};

export type SubpartProps = {
  id: string;
  enabled?: Resolvable<boolean>;
  opacity?: Resolvable<number>;
  color?: Resolvable<string>;
  metalness?: Resolvable<number>;
  roughness?: Resolvable<number>;
  reset?: Resolvable<boolean>;
  children?: ReactNode;
};

export type PlaybackProps = {
  reset?: Resolvable<boolean>;
  children?: ReactNode;
};

export type MotionProps = {
  reset?: Resolvable<boolean>;
  /** Motion commands for named bone groups (e.g., gaze direction, limb overrides). */
  commands?: MotionCommand[];
  /** Time-coded motion sequences with easing. Evaluated each frame at runtime. */
  scenes?: MotionScene[];
  /** Procedural per-frame animation functions applied as an overlay layer. */
  customAnimations?: CustomAnimation[];
};

export type AnimationProps = {
  reset?: Resolvable<boolean>;
  enabled?: Resolvable<boolean>;
  clipName?: string;
  gltfUrl?: string;
  gltfClipName?: string;
  fbxUrl?: string;
  fbxClipName?: string;
  fbxRetarget?: boolean;
  fadeInSeconds?: number;
  weight?: number;
  clipStart?: number;
  clipEnd?: number;
  clipRangeUnit?: 'seconds' | 'percent';
  clipRepeat?: boolean;
  /** Apply a start offset only the first time this animation starts. */
  clipStartOnce?: number;
  /** Trim N keyframes from the start of each animation track before playback. Useful for removing a T-pose frame. */
  trimStartKeyframes?: number;
  /** Trim N keyframes from the end of each animation track before playback. */
  trimEndKeyframes?: number;
  holdStartPose?: boolean;
  allowRotation?: boolean;
  allowScale?: boolean;
};

// ─── DSL Components (render as null — compilation happens in ModelWidget) ────

export const Model = (_props: ModelProps) => null;
export const ModelRouter = (_props: ModelProps) => null;
export const BodyParts = (_props: { children?: ReactNode }) => null;
export const BodyPart = (_props: BodyPartByIdProps) => null;
export const Pose = (_props: PoseProps) => null;
export const ModelPart = (_props: ModelPartProps) => null;
export const ContainedModel = (_props: ContainedModelProps) => null;
export const Subpart = (_props: SubpartProps) => null;
export const Playback = (_props: PlaybackProps) => null;
export const Motion = (_props: MotionProps) => null;
export const Animation = (_props: AnimationProps) => null;
```

**Note on T4-2:** `trimStartKeyframes` and `trimEndKeyframes` are included in this rewrite (they are already in `SceneAnimation` in `types.ts`). The compile handler must pass them through. Find the model animation compiler (in `packages/core/src/compiler/primitives/` or `ModelWidget.ts`) and ensure these fields are read from `AnimationProps` and written to `SceneAnimation`.

**Testing strategy:**
- `pnpm typecheck` — verifies no regressions
- All existing example scenes must still compile (the `context: unknown` form is structurally compatible — existing callbacks that accept `unknown` are assignable to functions accepting `SceneSnapshotContext`)
- Write a new test in `packages/core/src/elements/model/__tests__/ModelDslTypes.test.tsx` that verifies a function prop receives typed `SceneSnapshotContext`:

```typescript
// packages/core/src/elements/model/__tests__/ModelDslTypes.test.tsx
import { describe, it, expectTypeOf } from 'vitest';
import type { ModelProps } from '../dsl';
import type { SceneSnapshotContext } from '../../../compiler/sceneTypes';

describe('ModelProps Resolvable types', () => {
  it('position function prop receives SceneSnapshotContext', () => {
    type PositionFn = Extract<ModelProps['position'], Function>;
    expectTypeOf<Parameters<NonNullable<PositionFn>>[0]>().toEqualTypeOf<SceneSnapshotContext>();
  });

  it('MotionProps.commands is MotionCommand[] not unknown', () => {
    expectTypeOf<NonNullable<ModelProps['commands']>>().not.toBeAny();
  });
});
```

---

## Phase 3 — Warning Infrastructure and Silent Failure Fixes

### A3 — `FitBotHeight` `targetId` mismatch emits `console.warn`

**File:** `packages/core/src/elements/camera/render.ts`

Find the call site where `getTargetState(tick, descriptor.targetId)` returns null and the camera mode is `fitBotHeight`. Add the warning there. Search for the null-check guard that uses `getTargetState`.

The exact location is within the camera apply function, in a branch guarded by `descriptor.mode === 'fitBotHeight'` (or the absence of a mode — since `fitBotHeight` was previously the default). Add:

```typescript
const targetState = getTargetState(tick, descriptor.targetId);
if (targetState === null) {
  if (descriptor.targetId) {
    console.warn(
      `[CameraWidget] fitBotHeight camera could not find target widget "${descriptor.targetId}". ` +
      `Ensure a ModelWidget with widgetId="${descriptor.targetId}" is registered in widgetSetup.ts. ` +
      `Camera will hold its last position.`
    );
  }
  return; // existing no-op guard
}
```

This is Option B from the architect note — runtime warn, no compiler changes. Clean and minimal.

**Testing:**
```typescript
// packages/core/src/elements/camera/__tests__/CameraWidget.test.ts
it('emits console.warn when fitBotHeight targetId is not in tick state', () => {
  const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  // construct a tick with no widget state for 'bot'
  // apply camera with mode: 'fitBotHeight', targetId: 'bot'
  // assert warnSpy was called with message containing 'bot'
  warnSpy.mockRestore();
});
```

---

### A4 — `CompileWarning` type and surfacing pipeline

This fix has four sub-steps. The goal: replace the buried `console.warn` on missing widgets with a structured warning that the player can surface to `onCompileWarning`.

#### Sub-step 4a: Define `CompileWarning` type

**File:** `packages/core/src/compiler/sceneTrackTypes.ts`

Add after the `EasingName` re-export (near line 8), before `ClipMeta`:

```typescript
// ─── CompileWarning ───────────────────────────────────────────────────────────

/**
 * Identifies the category of a compile-time warning.
 * - `MISSING_WIDGET`: A DSL element referenced a widget ID not found in the registry.
 * - `DUPLICATE_WIDGET_ID`: Two widgets were registered with the same widgetId.
 * - `UNRESOLVED_REFERENCE`: A prop references an ID (e.g., targetId) that cannot be validated.
 */
export type CompileWarningCode =
  | 'MISSING_WIDGET'
  | 'DUPLICATE_WIDGET_ID'
  | 'UNRESOLVED_REFERENCE';

/**
 * A structured warning produced during DSL compilation.
 * Surfaced via `onCompileWarning` in `useSceneEngine` / `ScenePlayer`.
 */
export type CompileWarning = {
  code: CompileWarningCode;
  message: string;
  /** The widget ID involved, if applicable. */
  widgetId?: string;
  /** The 0-based scene index where the warning occurred, if applicable. */
  sceneIndex?: number;
};
```

Also add `warnings` to `SceneTrack`:

```typescript
export type SceneTrack = {
  ticks: SceneTrackTick[];
  tickStep: number;
  subTickCount: number;
  sceneWindows: SceneWindow[];
  transitionBlocks?: SceneTrackTransitionBlock[];
  transitionEasings?: Partial<Record<number, EasingName>>;
  /**
   * Warnings accumulated during compilation. Empty array if no issues.
   * Surfaced to the host via `onCompileWarning` in ScenePlayer/useSceneEngine.
   */
  warnings?: CompileWarning[];
};
```

#### Sub-step 4b: Add `pushWarning` to `CompileApi`

**File:** `packages/core/src/compiler/sceneDslTypes.ts`

Find the `CompileApi` type definition and add:
```typescript
export type CompileApi = {
  context: SceneSnapshotContext;
  state: SceneFrame;
  pushHudItem(item: HudItemDefinition): void;
  pushLabel(label: LabelResolved): void;
  setWidgetState(widgetId: string, state: unknown): void;
  setSceneMeta(meta: { id?: string; meta?: Record<string, JsonPrimitive> }): void;
  /**
   * Push a structured compile warning. Collected into SceneTrack.warnings.
   * Use instead of console.warn inside NodeHandler implementations.
   */
  pushWarning(warning: CompileWarning): void;
};
```

Import `CompileWarning` from `./sceneTrackTypes`.

#### Sub-step 4c: Accumulate warnings in `sceneTrackCompiler.ts`

**File:** `packages/core/src/compiler/sceneTrackCompiler.ts`

In `compileSceneTrack`:
1. Create a `const warnings: CompileWarning[] = []` at the top of the function
2. When constructing each scene's `CompileApi`, include `pushWarning: (w) => warnings.push(w)`
3. At the end, attach to the returned `SceneTrack`: `return { ...track, warnings: warnings.length > 0 ? warnings : undefined }`

The `resolveSceneFromDsl` function (in `sceneDslCompiler.ts`) constructs and passes `CompileApi` to handlers. Ensure the `pushWarning` implementation is passed through when constructing the api object there as well.

#### Sub-step 4d: Route missing-widget warning through `pushWarning`

**File:** `packages/core/src/widget/WidgetRegistry.ts`

In the routing handler installed by `register()` (lines 127–130), replace `console.warn`:

```typescript
// BEFORE:
console.warn(
  `[WidgetRegistry] No widget found for DSL component with id="${targetId ?? 'unset'}"`,
);
return;

// AFTER:
api.pushWarning({
  code: 'MISSING_WIDGET',
  message: `No registered widget found for DSL element with id="${targetId ?? 'unset'}". ` +
    `Ensure a widget with this ID is registered in widgetSetup.ts before this scene compiles.`,
  widgetId: targetId ?? undefined,
});
return;
```

#### Sub-step 4e: Throw on duplicate widget ID when `strict` mode is enabled

The codebase rule prohibits runtime environment flags. Rather than checking `process.env.NODE_ENV`, `WidgetRegistry` accepts an explicit `strict` constructor option. `createDefaultWidgetRegistry` passes `{ strict: true }` by default; hosts that need lenient behavior opt out explicitly.

**File:** `packages/core/src/widget/WidgetRegistry.ts`

Add a constructor with options:

```typescript
export type WidgetRegistryOptions = {
  /**
   * When true, registering a widget ID that is already registered throws an Error
   * rather than silently overwriting. Recommended for all development setups.
   * @default false
   */
  strict?: boolean;
};

export class WidgetRegistry {
  private widgets = new Map<string, IWidget>();
  private typeFactories = new Map<unknown, (props: Record<string, unknown>) => IWidget>();
  private readonly strict: boolean;

  constructor(options: WidgetRegistryOptions = {}) {
    this.strict = options.strict ?? false;
  }
  // ...
```

Change the duplicate-ID check in `register()`:

```typescript
// BEFORE:
register(widget: IWidget): this {
  if (this.widgets.has(widget.widgetId)) {
    console.warn(`[WidgetRegistry] "${widget.widgetId}" already registered. Overwriting.`);
  }

// AFTER:
register(widget: IWidget): this {
  if (this.widgets.has(widget.widgetId)) {
    const msg =
      `[WidgetRegistry] Widget ID "${widget.widgetId}" is already registered. ` +
      `Duplicate widget IDs cause the first widget to be silently replaced. ` +
      `Ensure each widget has a unique widgetId.`;
    if (this.strict) {
      throw new Error(msg);
    }
    console.warn(msg);
  }
```

**File:** `packages/core/src/player/defaultWidgets.ts` (or wherever `createDefaultWidgetRegistry` is defined)

Pass `strict: true` when constructing the registry:

```typescript
export function createDefaultWidgetRegistry(
  manifest: AssetManifest,
  options?: DefaultWidgetRegistryOptions,
): WidgetRegistry {
  const registry = new WidgetRegistry({ strict: true });
  // ...existing widget registrations...
}
```

This is fully config-driven at construction time with no implicit environment dependency. Hosts that build their own registry without `createDefaultWidgetRegistry` get lenient mode unless they opt in.

#### Sub-step 4f: Surface warnings in `useSceneEngine`

**File:** `packages/core/src/player/useSceneEngine.ts`

Add `onCompileWarning` to `UseSceneEngineOptions`:
```typescript
export type UseSceneEngineOptions = {
  // ...existing fields...
  /**
   * Called after each compilation if any warnings were accumulated.
   * Use this to surface missing-widget, unresolved-reference, and other
   * compile-time issues to your development tooling.
   */
  onCompileWarning?: (warnings: CompileWarning[]) => void;
};
```

Import `CompileWarning` from `../compiler/sceneTrackTypes`.

After the `compileSceneTrack(...)` call, add:
```typescript
if (track.warnings?.length && options.onCompileWarning) {
  options.onCompileWarning(track.warnings);
}
```

Also surface through `ScenePlayer.tsx` by forwarding `onCompileWarning` prop to `useSceneEngine`.

**Testing for A4:**
```typescript
// packages/core/src/compiler/__tests__/compileWarnings.test.ts
it('accumulates MISSING_WIDGET warning when DSL references unregistered widget', () => {
  const registry = new WidgetRegistry();
  // register a widget with DslComponent = Camera DSL
  // compile a scene that uses <Camera id="missing-cam" />
  // assert track.warnings contains a MISSING_WIDGET entry for 'missing-cam'
});

it('throws on duplicate widget registration when strict: true', () => {
  const registry = new WidgetRegistry({ strict: true });
  const w = { widgetId: 'test' } as IWidget;
  registry.register(w);
  expect(() => registry.register(w)).toThrow(/already registered/);
});

it('warns but does not throw on duplicate widget registration when strict is not set', () => {
  const registry = new WidgetRegistry();
  const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const w = { widgetId: 'test' } as IWidget;
  registry.register(w);
  expect(() => registry.register(w)).not.toThrow();
  expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('already registered'));
  warnSpy.mockRestore();
});
```

---

### T2-4 — `<LightStrand>` with no shape child warns

**File:** `packages/core/src/elements/lighting/LightingWidget.ts`

In the CUSTOM_NODE_HANDLER, in the `LightStrand` branch, at the `if (!shape)` fallback (around line 202), add the warning before the default shape assignment:

```typescript
if (!shape) {
  console.warn(
    `[LightStrand] No shape specified for strand "${resolved.id}". ` +
    `Provide <Wave>, <Circle>, or <Rectangle> as a child, or use the deprecated "curve" prop. ` +
    `Defaulting to a zero-amplitude wave — all lights will appear stacked at the same position.`
  );
  shape = {
    kind: 'wave',
    curve: {
      length: 10,
      yOffset: 0,
      z: 0,
      waveAmplitude: 0,
      waveFrequency: 1,
      depthAmplitude: 0,
      depthFrequency: 1,
      depthPhase: 0,
    },
  };
}
```

---

### T2-5 — Multiple `<Ambient>` elements warns

**File:** `packages/core/src/elements/lighting/LightingWidget.ts`

After the `ambients.push(...)` loop completes (after all children are processed), before the `ambients[0]` usage, add:

```typescript
if (ambients.length > 1) {
  console.warn(
    `[Lighting] ${ambients.length} <Ambient> elements found — only the first will be used. ` +
    `Combine them into a single <Ambient> with the desired intensity and color.`
  );
}
```

---

### T2-6 — Diagram layout elements outside parent emit errors

**Do not** add bespoke `registerNode` calls in `handlers.ts`. The codebase already has the correct mechanism for this: `IDslComposite.childDslComponents` with `topLevelError: true`. When `WidgetRegistry.register()` processes an `IDslComposite`, it automatically installs a throwing handler for any child component marked `topLevelError: true`. Using that mechanism keeps the protection owned by the widget, not scattered across the compiler file.

**File:** `packages/diagram/src/elements/diagram/widget.ts` (or wherever `DiagramWidget` is defined — the class implementing `IDslComposite`)

Add `GridLayout`, `HierarchicalLayout`, and `ManualLayout` to `childDslComponents` with `topLevelError: true`:

```typescript
import { GridLayout, HierarchicalLayout, ManualLayout } from './dsl';

readonly childDslComponents: IDslComposite['childDslComponents'] = [
  // ...existing entries (DiagramNode, DiagramEdge, etc.)...
  { component: GridLayout as React.ComponentType<unknown>, displayName: 'GridLayout', topLevelError: true },
  { component: HierarchicalLayout as React.ComponentType<unknown>, displayName: 'HierarchicalLayout', topLevelError: true },
  { component: ManualLayout as React.ComponentType<unknown>, displayName: 'ManualLayout', topLevelError: true },
];
```

`WidgetRegistry.register()` will then install the error handler automatically when `DiagramWidget` is registered, producing the message:
> `<GridLayout> must be used inside <Diagram>. It cannot appear at the top level of a scene.`

No changes needed to `handlers.ts`. No changes needed to `WidgetRegistry` — it already handles this case.

**Testing:**
```typescript
// packages/diagram/src/elements/diagram/__tests__/compile.test.ts
it('throws when <GridLayout> appears at scene top-level', () => {
  // compile a scene containing a top-level <GridLayout>
  // assert compilation throws with message containing 'GridLayout'
});
```

---

## Phase 4 — Input API Redesigns

### A5 — `<PointerMap event>` replaces `drag` / `click` booleans

**Covers:** T3-2

#### Step 1: Update `PointerMapProps`

**File:** `packages/core/src/compiler/blocks/inputController.tsx`

Replace `PointerMapProps`:
```typescript
export type PointerMapProps = {
  /**
   * The pointer event type to map to this action.
   * Use `'drag'` for drag interactions (default); `'click'` for tap/click interactions.
   * @default 'drag'
   */
  event?: 'drag' | 'click';
  /**
   * @deprecated Use `event="drag"` instead. Will be removed in a future major version.
   */
  drag?: boolean;
  /**
   * @deprecated Use `event="click"` instead. Will be removed in a future major version.
   */
  click?: boolean;
  button?: MouseButton;
  modifiers?: ModifierKey[];
  axis?: 'x' | 'y' | 'xy';
  lockAxis?: 'sticky' | 'free';
  lockThreshold?: number;
};
```

#### Step 2: Update `parseActionMap` to handle both APIs

In `parseActionMap`, replace the existing event determination logic:

```typescript
if (node.type === PointerMap) {
  const props = helpers.resolveObjectValues(node.props as PointerMapProps & Record<string, unknown>, api.context);

  // Determine event type — canonical `event` prop takes precedence over legacy booleans
  let eventType: 'drag' | 'click' = 'drag';
  if (typeof props.event === 'string') {
    eventType = props.event as 'drag' | 'click';
  } else if (props.click === true || props.drag === true) {
    console.warn(
      '[BrewSite] <PointerMap drag> and <PointerMap click> are deprecated. ' +
      'Use <PointerMap event="drag"> or <PointerMap event="click"> instead. ' +
      'The boolean props will be removed in a future major version.'
    );
    eventType = props.click === true ? 'click' : 'drag';
  }

  const map: InputPointerMap = {
    kind: 'pointer',
    event: eventType,
    button: props.button,
    modifiers: props.modifiers,
    axis: props.axis,
    lockAxis: props.lockAxis,
    lockThreshold: props.lockThreshold,
  };
  return map;
}
```

**No changes needed to `InputPointerMap` in `input/types.ts`** — its `event` field already accepts `'drag' | 'click'`.

**Testing:**
```typescript
// packages/core/src/compiler/__tests__/inputController.test.tsx
it('<PointerMap event="click"> compiles to click event', () => {
  // compile a scene with <PointerMap event="click"> and assert map.event === 'click'
});
it('<PointerMap click> emits deprecation warning and still compiles', () => {
  const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  // compile with legacy <PointerMap click />
  // assert warnSpy called, map.event === 'click'
  warnSpy.mockRestore();
});
```

---

### T3-1 — Deprecate `<KeyMap key>` and document `keyName`

**File:** `packages/core/src/compiler/blocks/inputController.tsx`

Update `KeyMapProps`:
```typescript
export type KeyMapProps = {
  /**
   * The canonical prop for the keyboard key value (e.g., `'ArrowRight'`, `'Escape'`, `' '`).
   * Corresponds to `KeyboardEvent.key`.
   *
   * Use this instead of the JSX `key` prop, which is React's reserved reconciliation prop.
   */
  keyName?: string;
  /**
   * @deprecated React's `key` prop is reserved and will not appear in `node.props`.
   * The compiler reads it via `node.key` as a fallback, but this is a non-obvious mechanism.
   * Use `keyName` instead for explicit, readable key binding.
   */
  key?: string;
  modifiers?: ModifierKey[];
};
```

In `parseActionMap`, add a deprecation warning when the `node.key` fallback is triggered:

```typescript
if (node.type === KeyMap) {
  const props = helpers.resolveObjectValues(node.props as KeyMapProps & Record<string, unknown>, api.context);
  const reactKey = typeof node.key === 'string'
    ? node.key.replace(/^\.\$/, '')
    : null;

  const usingKeyNameProp = typeof props.keyName === 'string' && props.keyName.length > 0;
  const usingKeyPropFallback = !usingKeyNameProp && typeof reactKey === 'string' && reactKey.length > 0;

  if (usingKeyPropFallback) {
    console.warn(
      `[BrewSite] <KeyMap key="${reactKey}"> uses React's reserved "key" prop as a fallback. ` +
      `Use <KeyMap keyName="${reactKey}"> instead for explicit, predictable behavior.`
    );
  }

  const resolvedKey =
    (usingKeyNameProp ? props.keyName : undefined) ??
    (typeof props.key === 'string' && props.key.length > 0 ? props.key : undefined) ??
    (reactKey && reactKey.length > 0 ? reactKey : undefined);

  if (!resolvedKey) {
    throw new Error('<KeyMap> requires a non-empty "keyName" prop.');
  }

  const map: InputKeyMap = {
    kind: 'key',
    key: resolvedKey,
    modifiers: props.modifiers,
  };
  return map;
}
```

---

## Phase 5 — Remaining Capabilities, JSDoc, and Deprecations

### A6 — Model `defaultState` override via `createDefaultWidgetRegistry`

**Covers:** T4-3

Decision: Use the `createDefaultWidgetRegistry` options approach. This avoids coupling the DSL to the widget construction and keeps `defaultState` at the registry-setup boundary where it belongs.

**File:** `packages/core/src/player/` — find `defaultWidgets.ts` or wherever `createDefaultWidgetRegistry` is defined.

Add an options parameter:
```typescript
import type { SceneModel } from '../elements/model/types';

export type DefaultWidgetRegistryOptions = {
  /**
   * Override the default (invisible/off-screen) state for specific model widgets.
   * Key = widgetId (must match the `id` prop on `<Model>` in your scenes).
   *
   * When a model is absent from a scene, these overrides determine its resting state
   * instead of the manifest's `identity` field. Useful for scenes where models
   * enter from a specific off-screen position rather than the manifest default.
   *
   * @example
   * createDefaultWidgetRegistry(manifest, {
   *   defaultModelStates: {
   *     bot: { position: [0, -5, 0], opacity: 0 }
   *   }
   * })
   */
  defaultModelStates?: Partial<Record<string, Partial<SceneModel>>>;
};

export function createDefaultWidgetRegistry(
  manifest: AssetManifest,
  options?: DefaultWidgetRegistryOptions,
): WidgetRegistry {
  // When constructing each ModelWidget, apply the override:
  // new ModelWidget(modelMeta, options?.defaultModelStates?.[modelMeta.id])
  // ...
}
```

**ModelWidget change:** Add an optional second parameter to the constructor:
```typescript
constructor(
  modelMeta: ModelMeta,
  defaultStateOverride?: Partial<SceneModel>,
) {
  // Merge override into defaultState:
  this.defaultState = {
    ...this.defaultState,
    ...defaultStateOverride,
  };
}
```

**Also document the manifest `identity` field** in `ModelProps.id` JSDoc (already included in Phase 2 rewrite above).

---

### A7 — `clipName` validation and codegen

**Covers:** T4-1

#### Short-term: Runtime warning in `ModelWidget.apply()`

**File:** `packages/core/src/elements/model/ModelWidget.ts`

Find the animation apply path where `clipName` is used. After the model's clips are loaded (i.e., when `isLoaded === true`), add:

```typescript
if (animState.clipName && this.loadedClips) {
  const knownClipNames = this.loadedClips.map((c) => c.name);
  if (!knownClipNames.includes(animState.clipName)) {
    console.warn(
      `[ModelWidget "${this.widgetId}"] Animation clip "${animState.clipName}" not found. ` +
      `Available clips: ${knownClipNames.join(', ')}`
    );
  }
}
```

This requires access to the list of loaded clip names. Store them as `private loadedClips: ClipMeta[] = []` during `load()`.

#### Long-term: Codegen for `ClipName` type

**File:** `scripts/gen-scene-dsl.mjs`

After the existing model type generation, add a section that generates a per-model `ClipName` union type. The manifest models array contains each model's clip metadata. Output format:

```typescript
// Generated clip name types — DO NOT EDIT BY HAND
export type BotClipName = 'ChatRelaxF' | 'WalkCycle' | 'Idle' | /* ... all clip names */;
export type ServerClipName = 'Spin' | 'Idle' | /* ... */;
```

These live in `apps/examples/generated/sceneDsl.generated.tsx`. They are consumer-side types — the library's `AnimationProps.clipName` stays as `string`. Consumers can assert: `<Animation clipName={clipName as BotClipName} />` or use the type for their own validation.

The codegen function iterates `manifest.models`, and for each model with a non-empty `clips` array, generates:
```javascript
const typeName = `${toPascalCase(model.type)}ClipName`;
const clipValues = model.clips.map(c => `'${c.name}'`).join(' | ');
output += `export type ${typeName} = ${clipValues};\n`;
```

---

### T2-7 — Document `transition.easing` limitation in JSDoc

**File:** `packages/core/src/compiler/sceneTrackTypes.ts`

Enhance the `transitionEasing` JSDoc on `SceneFrame`:

```typescript
/**
 * Easing curve for the transition INTO this scene (from the preceding scene).
 * Declared via `transition={{ easing: '...' }}` on the `<Scene>` DSL element.
 *
 * **Scope limitation:** This easing only applies to widgets that use
 * `FunctionalTransitionSpec` (e.g., Camera, Diagram elements). Widgets that use
 * `ElementTransitionSpec` (e.g., Model, Lighting, Background, Floor, Environment)
 * do NOT use this easing — their interpolation is pre-baked at compile time.
 *
 * To customize easing for `ElementTransitionSpec` widgets, modify their
 * `ElementTransitionSpec` implementation directly.
 *
 * Available easing names: 'linear' | 'easeIn' | 'easeOut' | 'easeInOut' | 'smoothstep'
 * (see `EasingName` type in `easingFunctions.ts`).
 */
transitionEasing?: EasingName;
```

Also add the same note to the `<Scene>` component props definition in `packages/core/src/compiler/sceneDslCompiler.ts` — find the `SceneProps` type or `transition` prop definition and add a matching JSDoc.

---

### T2-8 — Document `FitBotHeight` ↔ world camera transition hard cut

Already done in Phase 1 (T1-6) — the JSDoc was added to `FitBotHeightCameraProps` when `mode` was made required. No additional work needed.

---

### T3-3 — Distinguish `<GlowPoint>` from `<Point>` in JSDoc

**File:** `packages/core/src/elements/lighting/dsl.tsx`

Add JSDoc blocks to both types:

```typescript
/**
 * A standard Three.js `PointLight` that illuminates nearby geometry.
 *
 * Participates in shadow casting and material interactions (specular, diffuse).
 * More GPU-expensive than `<GlowPoint>` — each Point light adds a shadow map
 * and a per-fragment lighting calculation.
 *
 * Use when you need real scene illumination. For a visual glow effect without
 * lighting cost, use `<GlowPoint>` instead.
 */
export type PointProps = { ... };

/**
 * A sprite-based pseudo-light that renders as a visible glowing orb.
 *
 * Does NOT illuminate surfaces, cast shadows, or participate in material PBR calculations.
 * It is a visual effect only — a billboard sprite with a glow texture.
 *
 * Use for decorative light sources, UI indicators, or ambient atmosphere effects where
 * performance matters. For actual scene illumination, use `<Point>` instead.
 */
export type GlowPointProps = { ... };
```

---

### T3-4 — Add cross-reference between `<Diagram>` and `<DiagramCanvas>`

**File:** `packages/diagram/src/elements/diagram/dsl.tsx`

Find the `Diagram` component / its props type and add a JSDoc block:

```typescript
/**
 * A standalone 3D diagram element with nodes, edges, groups, and layout.
 *
 * Use `<Diagram>` for single-diagram scenes where no cross-diagram connections
 * (pipes) are required.
 *
 * **When to use `<DiagramCanvas>` instead:**
 * If your scene contains multiple diagrams that need to be visually connected
 * via pipes (arrows spanning from one diagram to another), use `<DiagramCanvas>`
 * as the container. `<DiagramCanvas>` manages a shared orthographic scene and
 * enables cross-diagram edge routing.
 *
 * @see DiagramCanvas — for multi-diagram scenes with cross-diagram pipes.
 */
```

---

### T3-5 — Validate `<DiagramCanvas id>` against registered widgets at compile time

**File:** `packages/diagram/src/compiler/handlers.ts`

In the `DiagramCanvas` node handler (or wherever `<DiagramCanvas>` is processed), add a registry validation:

```typescript
// The handler has access to `api.context` but not the registry directly.
// The registry reference must be passed into registerDiagramHandlers.
// If registerDiagramHandlers already takes a registry argument, use it here.
// Otherwise, add one.

export function registerDiagramHandlers(registry: WidgetRegistry): void {
  // ...existing registrations...

  registerNode(DiagramCanvas, (node, api, helpers) => {
    const props = node.props as DiagramCanvasProps;
    const canvasId = typeof props.id === 'string' ? props.id : undefined;

    if (canvasId) {
      const registered = registry.get(canvasId);
      if (!registered) {
        // Use pushWarning if A4 is implemented; otherwise console.warn
        api.pushWarning({
          code: 'MISSING_WIDGET',
          message:
            `<DiagramCanvas id="${canvasId}"> has no corresponding DiagramCanvasWidget registered. ` +
            `Call registry.register(new DiagramCanvasWidget({ widgetId: '${canvasId}' })) ` +
            `in your widgetSetup.ts before this scene renders.`,
          widgetId: canvasId,
        });
      }
    }
    // ... rest of existing handler ...
  });
}
```

**Note on `api.pushWarning`:** This is added in A4. If A4 is not yet implemented, use `console.warn` as a temporary measure and upgrade to `pushWarning` when A4 lands.

---

### T3-6 — Mark `LightStrand.curve` as deprecated

**File:** `packages/core/src/elements/lighting/dsl.tsx`

Update the `curve` prop JSDoc in `LightStrandProps`:

```typescript
export type LightStrandProps = {
  id: string;
  count: Resolvable<number>;
  intensity: Resolvable<number>;
  color: Resolvable<string>;
  position?: Resolvable<Vec3>;
  distance?: Resolvable<number>;
  decay?: Resolvable<number>;
  /**
   * @deprecated Use `<Wave>`, `<Circle>`, or `<Rectangle>` as children instead.
   * The child-component API is more expressive and composable. This prop will be
   * removed in a future major version.
   *
   * @example
   * // New API (preferred):
   * <LightStrand id="wave1" count={20} intensity={1} color="#fff">
   *   <Wave length={10} yOffset={2} z={0} waveAmplitude={0.5} waveFrequency={2}
   *         depthAmplitude={0.2} depthFrequency={1} depthPhase={0} />
   * </LightStrand>
   */
  curve?: Resolvable<SceneLightStrandCurve>;
  children?: ReactNode;
};
```

---

### T3-8 — `ModelProps.id` JSDoc (already handled in Phase 2)

The JSDoc for `ModelProps.id` was included in the Phase 2 `dsl.tsx` rewrite. No additional work needed.

---

### T3-9 — Document camera absence behavior

**File:** `packages/core/src/elements/camera/dsl.tsx`

Update the `CameraProps` JSDoc:

```typescript
/**
 * Full Camera DSL props. Combine a positioning descriptor with optional lens,
 * post-processing, and interaction configuration.
 *
 * **When absent from a scene:** The camera holds its last rendered position from the
 * previous scene — it does NOT reset to a default position. This enables smooth,
 * implicit camera continuity between scenes without requiring explicit camera state
 * in every scene.
 *
 * Include `<Camera>` in every scene where you need explicit camera placement or
 * where camera continuity from the previous scene is not desired.
 *
 * @example
 * // Scene with no <Camera> — camera holds its previous position from scene 1
 * <Scene id="scene2">
 *   <Model id="bot" type="bot" position={[0, 0, 0]} />
 *   // No <Camera> — camera stays at scene1's final camera position
 * </Scene>
 */
export type CameraProps = CameraDescriptorProps & {
  // ...
};
```

---

### T4-2 — `trimStartKeyframes` / `trimEndKeyframes` in `AnimationProps`

Already handled in Phase 2 — both props are included in the complete `AnimationProps` rewrite.

**Compile handler:** Find where `AnimationProps` is compiled into `SceneAnimation`. This is inside `ModelWidget.ts` (in the CUSTOM_NODE_HANDLER's animation branch, or in a `compileAnimation` helper). Ensure both `trimStartKeyframes` and `trimEndKeyframes` are read from props and assigned to the `SceneAnimation` state:

```typescript
const anim: SceneAnimation = {
  // ...existing fields...
  trimStartKeyframes: typeof props.trimStartKeyframes === 'number' ? props.trimStartKeyframes : undefined,
  trimEndKeyframes: typeof props.trimEndKeyframes === 'number' ? props.trimEndKeyframes : undefined,
};
```

---

### T4-4 — JSDoc for `metalnessMultiplier` / `roughnessMultiplier` on `<Scene>`

**File:** `packages/core/src/compiler/sceneDslCompiler.ts`

Find the `SceneProps` type definition (the props type for the `<Scene>` DSL component) and add JSDoc:

```typescript
/**
 * Multiplier applied to the base metalness value of all model materials in this scene.
 *
 * - `1.0` (default) = no change from the baked material value
 * - `> 1.0` = more metallic appearance
 * - `0.0` = fully non-metallic (matte)
 *
 * Applied uniformly to all models in the scene. For per-model metalness control,
 * use `metalness` on the individual `<Model>` element instead.
 */
metalnessMultiplier?: number;

/**
 * Multiplier applied to the base roughness value of all model materials in this scene.
 *
 * - `1.0` (default) = no change from the baked material value
 * - `> 1.0` = rougher appearance
 * - `0.0` = fully smooth / mirror-like
 *
 * Applied uniformly to all models in the scene. For per-model roughness control,
 * use `roughness` on the individual `<Model>` element instead.
 */
roughnessMultiplier?: number;
```

Also add the same JSDoc to `SceneFrame.materialMetalnessMultiplier` and `SceneFrame.materialRoughnessMultiplier` in `sceneTrackTypes.ts`.

---

### T4-5 — Transition semantics JSDoc on `ISceneElement.transitionSpec`

**File:** `packages/core/src/widget/types.ts`

Update the `transitionSpec` field:

```typescript
/**
 * Specifies how this widget's state transitions between adjacent scenes.
 *
 * **Three transition scenarios** (determined by widget presence in each scene):
 *
 * - **`exit`** — Widget present in scene N, absent from scene N+1.
 *   Fades from the last active state to the widget's `defaultState`.
 *   Active for the first half of the transition block (block progress 0 → 0.5).
 *
 * - **`enter`** — Widget absent from scene N, present in scene N+1.
 *   Fades from `defaultState` to the new scene's state.
 *   Active for the second half of the transition block (block progress 0.5 → 1).
 *
 * - **`interpolate`** — Widget present in both scenes.
 *   Smoothly interpolates from scene N's state to scene N+1's state.
 *   `t ∈ [0, 1]` maps linearly across the full transition block.
 *
 * **Two implementation strategies:**
 *
 * `ElementTransitionSpec<T>` — writes pre-baked values into `SceneTrackTick[]`
 * at compile time. O(blockSize) work at compile, O(1) at runtime. Use for most elements.
 *
 * `FunctionalTransitionSpec<T>` — stores closures evaluated lazily each frame.
 * Use when transition math benefits from lazy evaluation (camera paths, splines,
 * eased diagram layout transitions).
 *
 * Never mix both strategies for the same widget.
 *
 * @see ElementTransitionSpec in compiler/transitions/transitionTypes.ts
 * @see FunctionalTransitionSpec in compiler/transitions/transitionTypes.ts
 */
readonly transitionSpec: ElementTransitionSpec<TState> | FunctionalTransitionSpec<TState>;
```

---

### T4-6 — `<ManualLayout>` validation in both compilation passes

**File:** `packages/diagram/src/elements/diagram/compiler/` — the file that handles `ManualLayout` validation (likely `layoutResolver.ts` or `nodeCompiler.ts`).

Find the validation that throws when non-ghost nodes lack explicit positions. Currently it is guarded by `context.assetsReady`. Remove the guard:

```typescript
// BEFORE (guarded):
if (context.assetsReady) {
  for (const node of nodes) {
    if (!node.ghost && !hasExplicitPosition(node)) {
      throw new Error(`<ManualLayout> node "${node.id}" has no explicit position. ...`);
    }
  }
}

// AFTER (unguarded — runs in both passes):
for (const node of nodes) {
  if (!node.ghost && !hasExplicitPosition(node)) {
    throw new Error(
      `<ManualLayout> node "${node.id}" requires an explicit position. ` +
      `Set position={[x, y]} on the node, or mark it as ghost={true} to exclude it from layout validation.`
    );
  }
}
```

This ensures the error surfaces immediately on initial compilation, not just after `assetsReady` triggers a recompile. The validation logic itself (checking for explicit positions) does not depend on asset data, so removing the `assetsReady` guard is safe.

---

## Testing Strategy Summary

| Phase | Tests required |
|---|---|
| 1 (A2, T1-3, T1-4, T1-6) | `pnpm typecheck` passes across all packages |
| 2 (A1) | Type-level tests in `ModelDslTypes.test.tsx`; existing example scenes still compile |
| 3a (A3) | Unit test: `console.warn` fires when `targetId` not in tick state |
| 3b (A4) | Unit test: `CompileWarning` accumulated and returned; duplicate ID throws when `strict: true`; `new WidgetRegistry()` without options does not throw |
| 3c (T2-4) | Unit test: `console.warn` fires when no shape given to `LightStrand` |
| 3d (T2-5) | Unit test: `console.warn` fires when 2 `<Ambient>` elements present |
| 3e (T2-6) | Unit test: `<GridLayout>` at scene top-level throws |
| 4a (A5) | Unit tests for `<PointerMap event>` and deprecation warn for old form |
| 4b (T3-1) | Unit test for `keyName` canonical path + deprecation warn for `node.key` fallback |
| 5 | JSDoc and deprecation changes verified by `pnpm typecheck` |
| 5 (A6) | Unit test: `createDefaultWidgetRegistry` with `defaultModelStates` overrides widget `defaultState` |
| 5 (A7 short-term) | Unit test: `console.warn` fires from `ModelWidget.apply()` when `clipName` unrecognized |
| 5 (T4-6) | Unit test: `<ManualLayout>` without positions throws immediately (not just post-assetsReady) |

All new tests follow interface-based stateful test rules:
- Pure functions (compile handlers): real inputs → assert real output shape
- Widget tests: construct widget, call `apply()` with real compiled state, assert observable state
- No `vi.fn()` wrappers on internals — test the contract, not the implementation

Test files go in the `__tests__/` directory co-located with the code under test.

---

## Dependency Map

```
Phase 1 (A2, T1-3, T1-4, T1-6)
  └── Phase 2 (A1) depends on A2 complete (Vec3 import path change)
       └── Phase 3 (A4) depends on sceneTrackTypes.ts additions from A4a
            └── Phase 3 (T3-5) depends on A4 pushWarning being available
Phase 4 (A5, T3-1) — independent of Phase 3
Phase 5 — all independent of each other except:
  - A6 depends on ModelWidget constructor signature clarity from Phase 2
  - A7 short-term depends on Phase 2 (model types clear)
  - T4-6 independent
```

---

## Files Touched Summary

| File | Changes |
|---|---|
| `packages/core/src/math/index.ts` | Add `Vec3` re-export to `packages/core/src/index.ts` if missing |
| `packages/core/src/elements/model/types.ts` | Replace local `Vec3` with re-export from `../../math` |
| `packages/core/src/elements/camera/types.ts` | Replace local `Vec3` with re-export from `../../math` |
| `packages/core/src/elements/lighting/types.ts` | Replace local `Vec3` with re-export from `../../math` |
| `packages/diagram/src/elements/diagram/types.ts` | Import `Vec3` from `@brewsite/core` |
| `packages/core/src/elements/lighting/dsl.tsx` | T1-3 children→ReactNode; T3-3 JSDoc; T3-6 curve deprecated |
| `packages/core/src/widget/types.ts` | T1-4 JSDoc explaining intentional `any`; T4-5 transitionSpec JSDoc |
| `packages/core/src/elements/camera/dsl.tsx` | T1-6 mode required; T3-9 CameraProps JSDoc |
| `packages/core/src/compiler/sceneTypes.ts` | A1: add `Resolvable<T>` export |
| `packages/core/src/elements/model/dsl.tsx` | A1 full rewrite: Resolvable, concrete MotionProps types, T3-8 JSDoc, T4-2 trimKeyframes |
| `packages/core/src/compiler/sceneTrackTypes.ts` | A4a: CompileWarning type; SceneTrack.warnings; T2-7 transitionEasing JSDoc; T4-4 material multiplier JSDoc |
| `packages/core/src/compiler/sceneDslTypes.ts` | A4b: pushWarning on CompileApi |
| `packages/core/src/compiler/sceneTrackCompiler.ts` | A4c: accumulate warnings |
| `packages/core/src/widget/WidgetRegistry.ts` | A4d: pushWarning call; A4e: `WidgetRegistryOptions.strict` constructor option; throw on duplicate when `strict: true` |
| `packages/core/src/player/useSceneEngine.ts` | A4f: onCompileWarning prop |
| `packages/core/src/player/ScenePlayer.tsx` | A4f: forward onCompileWarning; A6: defaultModelStates prop |
| `packages/core/src/elements/camera/render.ts` | A3: console.warn on missing targetId |
| `packages/core/src/elements/lighting/LightingWidget.ts` | T2-4: no-shape warn; T2-5: multi-ambient warn |
| `packages/diagram/src/elements/diagram/widget.ts` | T2-6: add `GridLayout`, `HierarchicalLayout`, `ManualLayout` to `childDslComponents` with `topLevelError: true` |
| `packages/diagram/src/compiler/handlers.ts` | T3-5: DiagramCanvas id validation via `pushWarning` |
| `packages/diagram/src/elements/diagram/dsl.tsx` | T3-4: Diagram JSDoc |
| `packages/core/src/compiler/blocks/inputController.tsx` | A5: PointerMap event prop; T3-1: keyName JSDoc + warn |
| `packages/core/src/player/defaultWidgets.ts` | A4e: pass `strict: true` to `WidgetRegistry` constructor; A6: `DefaultWidgetRegistryOptions` type; `defaultModelStates` forwarding |
| `packages/core/src/elements/model/ModelWidget.ts` | A6: constructor override; A7 short-term: clipName warn; T4-2: trimKeyframes pass-through |
| `packages/core/src/compiler/sceneDslCompiler.ts` | T4-4: SceneProps JSDoc for multipliers |
| `packages/diagram/src/elements/diagram/compiler/` | T4-6: ManualLayout validation in both passes |
| `scripts/gen-scene-dsl.mjs` | A7 long-term: ClipName type generation |
| `apps/examples/generated/sceneDsl.generated.tsx` | A7 long-term: generated ClipName types |

---

## Implementation Notes for the Coding Agent

1. **Start with `pnpm typecheck` as your baseline.** Run it before any changes to confirm starting state. After each phase, verify it still passes.

2. **Phase 2 (model DSL rewrite) will be the most impactful.** After rewriting `dsl.tsx`, run `pnpm --filter @brewsite/examples typecheck` to catch any example scenes that break. They should not — `context: unknown` function props are structurally assignable to `context: SceneSnapshotContext` function props. If any break, they were already incorrect and need fixing.

3. **A4's `pushWarning` requires all call sites to be threaded through.** The `CompileApi` is constructed in `sceneTrackCompiler.ts` and passed down through `sceneDslCompiler.ts`. Both files need the `warnings` accumulator passed through. Do not silently swallow the `pushWarning` call — ensure it writes to the same `warnings[]` array that gets attached to the returned `SceneTrack`.

4. **T1-6 (mode required on FitBotHeight) will cause example type errors.** Run the grep command from Phase 1 and fix all usages before declaring Phase 1 complete.

5. **Do not change any `render.ts` files except for the A3 `console.warn` addition.** All other changes are in DSL, compile, or widget layers.

6. **`WidgetRegistry` strict mode (A4e) is intentionally opt-in via the constructor, not via `process.env`.** The architectural rule requires the toolkit to be config-driven. `createDefaultWidgetRegistry` passes `{ strict: true }` — hosts that build a custom registry get lenient mode by default and opt in explicitly. Do not add any `process.env.NODE_ENV` checks.

7. **T2-6 (layout elements at top level) must go through `DiagramWidget.childDslComponents`, not `handlers.ts`.** The `IDslComposite` mechanism is the correct ownership boundary — the widget declares its child constraints, not the compiler file. The `WidgetRegistry` installs the protective handler automatically.

8. **T4-6 (ManualLayout validation timing) should be tested against a scene that uses ManualLayout without pre-loading assets.** The test should confirm the throw happens on the first compilation pass, not just after `assetsReady` changes.