---
title: "Authoring DX Gap Analysis — @brewsite/core and @brewsite/diagram"
doc_type: note
owner: brewsite-product-manager
status: active
updated: 2026-02-28
---

# Authoring DX Gap Analysis

This note documents every friction point, silent failure, confusing API, and missing capability found during a deep read of the scene authoring surface of `@brewsite/core` and `@brewsite/diagram`. Issues are organized by severity tier. Each issue includes the exact file involved so the architect can locate the code immediately.

Issues are scoped to the **authoring surface only** — DSL components, prop types, type ergonomics, compile-time validation, and runtime feedback visible to a scene author. Implementation details below `render.ts` are out of scope.

---

## Tier 1 — Type Holes

TypeScript gives the author zero guidance. These are the highest-priority fixes because they make the entire function-prop authoring pattern useless or misleading.

---

### T1-1 — Model DSL uses `context: unknown` in all function props

**File:** `packages/core/src/elements/model/dsl.tsx` lines 21–33

Every resolvable prop on `ModelProps` (and its nested sub-component types `BodyPartProps`, `MotionProps`, `PlaybackProps`, etc.) accepts `(context: unknown) => T`. Authors get no IntelliSense inside function props — they cannot access `context.sceneIndex`, `context.viewport`, `context.assetsReady`, or any other field without a manual `as SceneSnapshotContext` cast.

The Lighting DSL does this correctly:
```typescript
// packages/core/src/elements/lighting/dsl.tsx
type Resolvable<T> = T | ((context: SceneSnapshotContext) => T);
```

**Fix:** Adopt the same `Resolvable<T>` pattern across all model DSL prop types.

---

### T1-2 — `MotionProps.commands`, `.scenes`, `.customAnimations` typed as `unknown`

**File:** `packages/core/src/elements/model/dsl.tsx` lines 104–109

```typescript
export type MotionProps = {
  reset?: boolean | ((context: unknown) => boolean);
  commands?: unknown;
  scenes?: unknown;
  customAnimations?: unknown;
};
```

The three most powerful motion authoring props have no type at all. The actual types (`MotionCommand[]`, `MotionScene[]`, `CustomAnimation[]`) are defined in `types.ts` but never referenced from the DSL props type.

**Fix:** Replace `unknown` with the concrete types from `types.ts`.

---

### T1-3 — `LightingProps.children` typed as `ReactElement | ReactElement[]` not `ReactNode`

**File:** `packages/core/src/elements/lighting/dsl.tsx` lines 103–107

```typescript
children?: ReactElement | ReactElement[];
```

Conditional JSX (`{condition && <Ambient />}`) type-errors because `false` is not a `ReactElement`. This breaks the most common conditional authoring pattern.

**Fix:** Change to `children?: ReactNode`.

---

### T1-4 — `ISceneElement.DslComponent` is `React.ComponentType<any>`

**File:** `packages/core/src/widget/types.ts` line 15

The registry stores all DSL components as `ComponentType<any>`, erasing the specific prop types of each widget's DSL component. Type-checking is lost for all widget DSL props at the registry level.

**Fix:** Do not change the type. Under `--strictFunctionTypes`, `React.ComponentType<P>` is contravariant in `P`. That means `ComponentType<LightingProps>` is not assignable to `ComponentType<Record<string, unknown>>` because a function accepting `LightingProps` does not accept arbitrary `Record<string, unknown>`. Narrowing to `Record<string, unknown>` would break every existing widget class assignment without a cast, and those casts would buy nothing — the registry is intentionally heterogeneous and cannot be made uniformly type-safe at the container level.

**Correct fix:** Leave the type as `ComponentType<any>` and add a JSDoc comment explaining the deliberate choice:

```typescript
/**
 * The DSL React component for this widget. Typed as ComponentType<any> because the
 * registry is intentionally heterogeneous — each widget has a different prop type.
 * Type safety is enforced at the individual widget's DSL component definition, not here.
 */
readonly DslComponent: React.ComponentType<any>;
```

This is honest, doesn't create fake safety, and generates no noise at widget implementation sites.

---

### T1-5 — `AnimationProps.reset` and `enabled` are plain `boolean`, not resolvable

**File:** `packages/core/src/elements/model/dsl.tsx` lines 111–131

Every other prop on `ModelProps` supports the function form. `<Animation enabled reset>` props do not. An author who writes `enabled={(ctx) => ctx.assetsReady}` gets a TypeScript error that looks like a toolkit bug.

**Fix:** Change to `enabled?: Resolvable<boolean>; reset?: Resolvable<boolean>`.

---

### T1-6 — `FitBotHeightCameraProps.mode` is optional while all other camera modes require it

**File:** `packages/core/src/elements/camera/dsl.tsx` lines 40–48

`mode?: 'fitBotHeight'` is optional; `WorldSpaceCameraProps.mode: 'world'` is required. The asymmetry is confusing and allows writing `<Camera targetId="bot" targetHeight={2} />` without a `mode` prop — valid TypeScript, ambiguous intent.

**Fix:** Make `mode: 'fitBotHeight'` required to match the other descriptor types.

---

## Tier 2 — Silent Failures

Wrong authoring input produces no error and no warning at any level visible to the author. These are high-impact because the author has no way to discover the problem without runtime inspection.

---

### T2-1 — `FitBotHeight targetId` mismatch is a complete silent no-op

**File:** `packages/core/src/elements/camera/render.ts` lines 28–31 (lookup), `packages/core/src/elements/camera/compile.ts` line 139 (no-op guard)

`<Camera descriptor={{ mode: 'fitBotHeight', targetId: 'bot', targetHeight: 2 }}>` with a wrong `targetId` produces zero compile error, zero runtime warning. The camera stays at its previous Three.js position. The silence is absolute.

**Fix:** Validate `targetId` against registered model widget IDs at compile time (in the scene DSL compiler), or emit `console.warn` at render time when `getTargetState` returns null.

---

### T2-2 — Duplicate widget IDs: `console.warn` then silent overwrite

**File:** `packages/core/src/widget/WidgetRegistry.ts` lines 65–68

Two `ModelWidget` instances registered with the same `widgetId` produces a `console.warn` and silently overwrites — the first widget never renders. Especially subtle because `ModelWidget.widgetId` defaults to `modelMeta.type` when not explicitly set, making collisions easy when using the same model type twice.

**Fix:** Throw in development mode; warn in production. The `onWidgetError` callback is now available for non-fatal routing.

---

### T2-3 — `<Model>` with no matching registered widget: `console.warn` not throw

**File:** `packages/core/src/widget/WidgetRegistry.ts` lines 127–130

A `<Model id="bot">` with no registered widget for `"bot"` compiles successfully — the element is silently dropped and the scene track has no model state. The warning is a `console.warn` buried in the browser console with no propagation to `onWidgetError`.

**Fix:** Route the missing-widget warning through `onWidgetError` so hosts can surface it.

---

### T2-4 — `<LightStrand>` with no shape child produces invisible lights

**File:** `packages/core/src/elements/lighting/LightingWidget.ts` lines 202–215

`<LightStrand count={10} intensity={1} />` with no `<Wave>`, `<Circle>`, `<Rectangle>`, or `curve` prop silently defaults to a zero-amplitude wave — all lights stack at the same world position and are invisible.

**Fix:** Emit `console.warn('[LightStrand] No shape specified. Provide <Wave>, <Circle>, or <Rectangle> as a child, or a curve prop.')` when the fallback is triggered.

---

### T2-5 — Multiple `<Ambient>` elements: only the first is used

**File:** `packages/core/src/elements/lighting/LightingWidget.ts` lines 86–100

The compiler collects all `<Ambient>` elements into an array but uses only `[0]`. Extra ambient elements are silently dropped. An author expecting additive or layered ambient lighting is confused.

**Fix:** Emit `console.warn` when more than one `<Ambient>` is found. Long-term: support additive ambient stacking.

---

### T2-6 — Diagram sub-elements outside their parent: silently ignored

**File:** `packages/diagram/src/elements/diagram/dsl.tsx` lines 97–103

`<DiagramNode>`, `<DiagramEdge>`, `<GridLayout>`, `<HierarchicalLayout>`, and `<ManualLayout>` used outside `<Diagram>` or `<DiagramGroup>` are silently dropped. The `topLevelError` protection via `IDslComposite` exists for `DiagramCanvasWidget` children but is not applied to layout elements.

**Fix:** Use the existing `IDslComposite.childDslComponents` mechanism — do not add bespoke `registerNode` calls in `handlers.ts`. `WidgetRegistry.register()` already installs the protective handler automatically when it sees `topLevelError: true`. Adding bespoke handlers in `handlers.ts` creates a second code path for something the SDK handles uniformly, and places ownership of the widget's child contract outside the widget itself.

The correct fix is to add the layout components to `DiagramCanvasWidget.childDslComponents` (or the equivalent widget that owns the `<Diagram>` tree):

```typescript
readonly childDslComponents: IDslComposite['childDslComponents'] = [
  { component: DiagramNode,         displayName: 'DiagramNode',         topLevelError: true },
  { component: DiagramEdge,         displayName: 'DiagramEdge',         topLevelError: true },
  { component: DiagramGroup,        displayName: 'DiagramGroup',        topLevelError: true },
  { component: GridLayout,          displayName: 'GridLayout',          topLevelError: true },
  { component: HierarchicalLayout,  displayName: 'HierarchicalLayout',  topLevelError: true },
  { component: ManualLayout,        displayName: 'ManualLayout',        topLevelError: true },
  { component: Enter,               displayName: 'Enter',               topLevelError: true },
  { component: Exit,                displayName: 'Exit',                topLevelError: true },
];
```

The widget declares what its children are; the registry enforces it. This is the designed ownership model.

---

### T2-7 — `<Scene transition={{ easing }}>` is a no-op for `ElementTransitionSpec` widgets

**File:** `packages/core/src/compiler/sceneTrackTypes.ts` lines 44–47

The `transition.easing` prop only affects `FunctionalTransitionSpec` widgets. The prop type has no JSDoc explaining this. Authors setting easing on scenes full of standard model or lighting transitions (which use `ElementTransitionSpec`) will see no change.

**Fix:** Add a JSDoc comment to the `transition` prop in `sceneDslCompiler.ts` Scene props. Long-term: apply easing to `ElementTransitionSpec` interpolation as well.

---

### T2-8 — `FitBotHeight` ↔ world/orbit camera transition is a hard cut at 50%

**File:** `packages/core/src/elements/camera/compile.ts` lines 139–145

Transitioning from a `fitBotHeight` camera to a `world` or `orbit` camera (or vice versa) snaps at the transition midpoint — no interpolation. The behavior is an inline comment in `compile.ts` with no author-facing documentation. An author who sets up a reveal shot that goes from auto-framing to a fixed angle will see an unexpected snap.

**Fix:** Document this limitation in the `FitBotHeightCamera` type JSDoc. Consider computing the world-space resolved position from `fitBotHeight` at compile time (requires model bounding box at compile time, which is available from manifest metadata).

---

## Tier 3 — API Confusion

Correct usage is unclear, inconsistent, or requires knowledge that is not visible at the authoring surface.

---

### T3-1 — `<KeyMap key="ArrowRight">` silently uses React's reconciliation key

**File:** `packages/core/src/compiler/blocks/inputController.tsx` lines 60–64, 113–119

`key` is React's reserved prop — it never appears in `node.props`. The compiler works around this by reading `node.key` as a fallback, but the `keyName` prop exists specifically to avoid the collision. Neither prop has a JSDoc explaining the relationship. An author who writes `<KeyMap key="ArrowRight" />` gets the correct behavior via a non-obvious mechanism; an author who writes `<KeyMap keyName="ArrowRight" />` also gets the correct behavior via the explicit path.

**Fix:** Deprecate the `key` prop workaround. Document `keyName` prominently as the correct prop. Add a `console.warn` when `key` is used without `keyName`.

---

### T3-2 — `<PointerMap drag click>` has silent implicit precedence

**File:** `packages/core/src/compiler/blocks/inputController.tsx` lines 85–98

`click` takes precedence over `drag` when both are set. Writing `<PointerMap drag click />` activates click mode silently. The API should be a single `event="drag" | "click"` discriminant, not two booleans.

**Fix:** Replace `drag?: boolean; click?: boolean` with `event?: 'drag' | 'click'` (defaulting to `'drag'`). Backward compat via deprecation warnings on the boolean forms.

---

### T3-3 — `GlowPoint` vs `Point` — identical-looking props, completely different implementations

**File:** `packages/core/src/elements/lighting/dsl.tsx` lines 23–35

`<GlowPoint>` is a sprite-based pseudo-light. `<Point>` is a standard Three.js `PointLight`. They have nearly identical props (`intensity`, `color`, `position`). Nothing in the component names or prop types indicates this distinction. An author choosing between them has no guidance.

**Fix:** Add JSDoc to both components explaining the implementation difference and when each is appropriate.

---

### T3-4 — `<Diagram>` vs `<DiagramCanvas>` — when to use which is undocumented at the authoring level

**File:** `packages/diagram/src/elements/diagram/dsl.tsx` and `packages/diagram/src/elements/diagram/canvas/dsl.tsx`

`<Diagram>` is a standalone 3D diagram. `<DiagramCanvas>` is a multi-diagram container that enables cross-diagram pipes. The distinction is only documented in `<DiagramCanvas>`'s JSDoc, not in `<Diagram>`'s. There is no cross-reference between them.

**Fix:** Add JSDoc to `<Diagram>`: "For single-diagram scenes. For multiple diagrams or diagram-to-diagram pipes, use `<DiagramCanvas>`."

---

### T3-5 — `<DiagramCanvas id>` must match a separately registered widget — no type enforcement

**File:** `packages/diagram/src/elements/diagram/canvas/dsl.tsx` lines 7–13

Same coupling problem as `<Model id>`. The `id` prop JSDoc says "The DiagramCanvasWidget must be registered with this exact id in widgetSetup.ts" — but this is only visible if the author reads the type definition. There is no validation, no helpful error when they diverge.

**Fix:** In `registerDiagramHandlers` (now auto-called), validate at compile time that any `<DiagramCanvas id="x">` in a scene has a corresponding registered `DiagramCanvasWidget` with `widgetId === 'x'`.

---

### T3-6 — `<LightStrand curve={...}>` vs `<LightStrand><Wave /></LightStrand>` — two authoring paths with no preference stated

**File:** `packages/core/src/elements/lighting/dsl.tsx` lines 48–62, `LightingWidget.ts` lines 186–215

The `curve` prop is the old API; child shape elements are the new API. Neither is marked deprecated or preferred. Authors who look at examples using child shapes won't know the `curve` prop exists; authors who find `curve` in the types won't know child shapes are preferred.

**Fix:** Mark `curve` as `@deprecated` in `LightStrandProps`. Add JSDoc: "Use `<Wave>`, `<Circle>`, or `<Rectangle>` as children instead."

---

### T3-7 — `Vec3` defined independently in model, camera, and lighting modules

**File:** `packages/core/src/elements/model/types.ts` line 8, `packages/core/src/elements/camera/types.ts` line 4, `packages/core/src/elements/lighting/types.ts` line 5

Three structurally identical `[number, number, number]` type aliases with no shared canonical export. IDE "go to definition" returns three results. Imports from one module cannot be cleanly used as the other without a cast, even though they are identical.

**Fix:** Define `Vec3` once in `packages/core/src/math/types.ts` and re-export from each element module.

---

### T3-8 — `<Model id>` coupling to `widgetId` has no type enforcement

**File:** `packages/core/src/player/defaultWidgets.ts` lines 21–33, `packages/core/src/widget/WidgetRegistry.ts`

`<Model id="primary" type="bot">` requires that a widget registered in the registry has `widgetId === 'primary'`. There is no type-level enforcement. Camera and Lighting avoid this entirely by using hardcoded `widgetId`s with no `id` prop on their DSL components — the better pattern.

**Fix:** For the default registry's factory pattern, the `id` from the DSL automatically becomes the `widgetId` — this is already correct. Document this in the `ModelProps.id` JSDoc: "This value becomes the widget ID in the runtime registry. It must match the model type key in the asset manifest."

---

### T3-9 — Camera `enabled: false` default state is undocumented

**File:** `packages/core/src/elements/camera/compile.ts` lines 29–33

When no `<Camera>` element is present in a scene, `CameraWidget`'s default state is `enabled: false`, and the camera is not repositioned — it stays at its last Three.js position from the previous scene. This behavior enables smooth scene continuity, but it is nowhere documented. An author who omits `<Camera>` from a scene expecting a default world position will be confused.

**Fix:** Add JSDoc to `CameraProps`: "When absent from a scene, the camera holds its last rendered position. Include `<Camera>` in every scene to explicitly control camera placement."

---

## Tier 4 — Missing Capabilities

Features that authors would reasonably expect to exist but don't.

---

### T4-1 — `clipName` has no validation against manifest clip names

**File:** `packages/core/src/elements/model/dsl.tsx` `AnimationProps.clipName?: string`

Valid clip names depend on what's in the asset manifest, but the prop is an unvalidated `string`. A typo in `clipName` is a runtime failure — the animation simply doesn't play, with a warning buried in the AnimationMixer output.

**Fix (short-term):** Emit `console.warn` from `ModelWidget.apply()` when `clipName` doesn't match any loaded clip. **Fix (long-term):** Use codegen to produce a typed `ClipName` enum from the manifest, similar to how `sceneDsl.generated.tsx` produces typed model component names.

---

### T4-2 — `trimStartKeyframes` / `trimEndKeyframes` not in `AnimationProps`

**File:** `packages/core/src/elements/model/types.ts` lines 172–175, `packages/core/src/elements/model/dsl.tsx` lines 111–131

These two `SceneAnimation` fields exist in the runtime type but have no corresponding props in `AnimationProps`. Authors who need to trim animation keyframes (e.g., to remove a T-pose frame) cannot do so via the DSL.

**Fix:** Add `trimStartKeyframes?: number; trimEndKeyframes?: number` to `AnimationProps`.

---

### T4-3 — Model `defaultState` is manifest-driven and invisible from DSL

**File:** `packages/core/src/elements/model/ModelWidget.ts` line 404

When a model is absent from a scene, its default position/scale/opacity come from `modelMeta.identity` in the asset manifest. Authors cannot see or override this from the DSL — they must edit the manifest JSON. This makes the "off" state of a model opaque.

**Fix:** Allow `defaultState` to be declared on the model's DSL component: `<Model id="bot" defaultPosition={[0, -10, 0]} />`, which overrides the manifest default for that scene group. Alternatively, document the manifest `identity` field prominently in the `ModelProps.id` JSDoc.

---

### T4-4 — `metalnessMultiplier` and `roughnessMultiplier` on `<Scene>` have no JSDoc

**File:** `packages/core/src/compiler/sceneDslCompiler.ts` lines 164–172 (Scene props definition)

Two scene-level material multipliers that silently affect all models in the scene. No documentation on what they do, what range is valid, or how they interact with per-model `metalness` and `roughness` props.

**Fix:** Add JSDoc explaining: what range is meaningful (1.0 = no change, >1.0 = more metallic/rough), that they multiply the model's baked material value, and that they apply to all models in the scene uniformly.

---

### T4-5 — Transition semantics (enter/exit/interpolate) are not documented at the authoring surface

**File:** `packages/core/src/compiler/transitions/transitionTypes.ts`

The coordinate system for transition specs is documented only in the implementation file. Nothing in any DSL component's JSDoc explains when `enter` vs `exit` vs `interpolate` fires, what `t ∈ [0,1]` means in each case, or that exit occupies the first half of the block while enter occupies the second half.

**Fix:** Add a JSDoc block to `ISceneElement.transitionSpec` in `widget/types.ts` explaining the three modes with concrete examples.

---

### T4-6 — `<ManualLayout>` validation throw fires at recompile time, not initial compile

**File:** `packages/diagram/src/elements/diagram/compiler/` (ManualLayout validation)

`<ManualLayout>` throws when non-ghost nodes lack explicit positions. Because the DSL recompiles when `assetsReady` changes, an author may author a correct-looking scene and then encounter the throw only after the manifest loads and triggers recompilation. The throw timing is confusing — it looks like an asset load error, not an authoring error.

**Fix:** Run ManualLayout validation in both compilation passes (before and after `assetsReady`), so the error is visible immediately, not just on recompile.

---

## Issue Count Summary (Round 1)

| Tier | Count | Description |
|------|-------|-------------|
| T1 — Type holes | 6 | TypeScript gives wrong or no feedback |
| T2 — Silent failures | 8 | Wrong input, no error, no warning |
| T3 — API confusion | 9 | Correct usage is unclear or inconsistent |
| T4 — Missing capabilities | 6 | Expected features that don't exist |
| **Total** | **29** | |

See `note_authoring_dx_gaps_round2.md` for 14 additional issues found in a second pass (T4-7 through T6-5).

---

## Recommended Implementation Order (Round 1 items)

### Highest priority
1. **T1-1** (Model `context: unknown`) — affects every function prop on the most-used element
2. **T1-2** (MotionProps `unknown` fields) — blocks all procedural animation authoring
3. **T2-1** (FitBotHeight targetId silent no-op) — most dangerous silent failure
4. **T2-3** (Missing widget: warn not throw) — surfaces common setup mistakes
5. **T1-3** (LightingProps children type) — one-line fix, breaks common pattern
6. **T3-1** (KeyMap.key collision) — active footgun
7. **T3-2** (PointerMap drag/click) — confusing but lower frequency

### Medium priority
8. **T4-2** (trimStartKeyframes in DSL) — small addition, real need
9. **T4-1** (clipName validation) — runtime warn minimum; codegen typed union long-term

### Lower priority
10. All remaining T3/T4 items — JSDoc, deprecations, minor type improvements

---

## Architect Work Items

The following items require architectural design before implementation. They are not straightforward fixes — each touches module boundaries, data types, or cross-package contracts. The architect should produce a plan for each before the implementing agent begins.

---

### A1 — Adopt `Resolvable<T>` pattern across all model DSL types

**Covers:** T1-1, T1-5

**Scope:** `packages/core/src/elements/model/dsl.tsx` and all sub-component prop types it defines.

**Design questions for architect:**
- Define `Resolvable<T>` in a shared location (proposed: `packages/core/src/compiler/sceneTypes.ts` or a new `packages/core/src/compiler/dslTypes.ts`) and import it from all element DSL files — or define it locally per element?
- The model DSL has many nested component types (`BodyPartProps`, `PoseProps`, `MotionProps`, `PlaybackProps`, etc.). Determine which props on each should become `Resolvable<T>` vs remain concrete (not all props benefit from context functions — e.g., `id: string` should stay plain).
- `MotionProps.commands`, `.scenes`, `.customAnimations` need concrete types too (T1-2). The architect should define the typed equivalents and verify they match what the compiler's `resolveObjectValues` actually processes.
- Ensure the `context: unknown` form in existing example scenes still compiles via a deprecation shim or simply continues working (structural compatibility check).

**Files affected:**
- `packages/core/src/elements/model/dsl.tsx` — all prop type definitions
- `packages/core/src/elements/model/types.ts` — `MotionCommand`, `MotionScene`, `CustomAnimation` types (confirm these are the correct imported types)
- `packages/core/src/compiler/` — wherever `Resolvable<T>` is canonically defined

---

### A2 — Unify `Vec3` to a single canonical definition

**Covers:** T3-7

**Scope:** `packages/core/src/math/`, all element `types.ts` files.

**Design questions for architect:**
- `packages/core/src/math/` already exists with math utilities. Does `Vec3` belong there as a type export, or in a dedicated `packages/core/src/types/primitives.ts`?
- Each element's `types.ts` currently re-declares `Vec3` locally. After the canonical definition is established, each should re-export from the canonical source. Confirm this does not create circular dependency issues (math → elements is fine; elements → math needs verification against the current dependency graph).
- The `@brewsite/diagram` package also uses Vec3 in its types. Determine whether diagram should import from core's canonical location or continue its own declaration.

**Files affected:**
- `packages/core/src/math/` — add `Vec3`, `Mat4`, `Quaternion` as exported types (they may already exist as local types in `math.ts`)
- `packages/core/src/elements/model/types.ts`, `camera/types.ts`, `lighting/types.ts` — replace local declarations with import
- `packages/diagram/src/elements/diagram/types.ts` — evaluate import vs local

---

### A3 — `FitBotHeight targetId` compile-time validation

**Covers:** T2-1

**Scope:** `packages/core/src/compiler/sceneDslCompiler.ts`, `packages/core/src/elements/camera/`.

**Design questions for architect:**
- The compiler currently has no cross-widget awareness — it processes each DSL element in isolation. Validating `targetId` requires knowing which model widget IDs have been registered. Two approaches:
  - **Option A (compile-time):** Pass a list of registered widget IDs through `SceneSnapshotContext` or a new `CompileContext` field. Camera handler checks `targetId` against this list. Pro: catches error at compile time. Con: requires changing `SceneSnapshotContext` shape (breaking change) or a new compile-time context field.
  - **Option B (runtime warn):** In `CameraWidget.apply()` / `render.ts`, when `getTargetState` returns null for a non-null `targetId`, emit `console.warn` with the exact widgetId that was not found. Pro: no compiler changes. Con: error appears at runtime not compile time.
- Recommend Option B as the minimum viable fix and design Option A as a future enhancement once `CompileContext` is formalized.

**Files affected (Option B):**
- `packages/core/src/elements/camera/render.ts` — add warn at the null-return site

---

### A4 — Route missing-widget warnings through `onWidgetError`; strict mode on `WidgetRegistry`

**Covers:** T2-3, T2-2

**Scope:** `packages/core/src/widget/WidgetRegistry.ts`, compiler DSL dispatch path, `packages/core/src/runtime/RuntimeDriverImpl.ts`.

**Design questions for architect:**

**Part A — Duplicate widget ID (T2-2):**
Do not use `process.env.NODE_ENV` to decide throw vs warn. The codebase rule explicitly forbids runtime environment flags — the toolkit must be config-driven at construction time. Instead, make `WidgetRegistry` accept a `strict` option:

```typescript
export class WidgetRegistry {
  constructor(private readonly options: { strict?: boolean } = {}) {}

  register(widget: IWidget): this {
    if (this.widgets.has(widget.widgetId)) {
      const msg = `[WidgetRegistry] Widget ID "${widget.widgetId}" already registered. Duplicate IDs cause the first widget to be silently replaced.`;
      if (this.options.strict) {
        throw new Error(msg);
      }
      console.warn(msg);
    }
    // ...
  }
}
```

`createDefaultWidgetRegistry` passes `{ strict: true }` by convention. Custom registries constructed without `createDefaultWidgetRegistry` get the lenient default. This is fully config-driven, gives hosts explicit control, and requires no environment flags.

**Part B — Missing widget for DSL element (T2-3):**
`WidgetRegistry` emits `console.warn` when a DSL element has no registered handler — this happens at compile time (inside `compileSceneTrack`), not at runtime. `onWidgetError` is a runtime callback; the layers are structurally separate. The architect should define `CompileWarning` and specify how warnings surface from the compiler to the player:

- `compileSceneTrack` returns `{ track: SceneTrack, warnings: CompileWarning[] }` (or attaches `warnings?` to `SceneTrack`)
- `useSceneEngine` reads warnings post-compilation and pipes them to a new `onCompileWarning?: (warnings: CompileWarning[]) => void` prop on `ScenePlayer`
- This does not change the compiler's core contract — warnings are additive output

**Files affected:**
- `packages/core/src/widget/WidgetRegistry.ts` — add `strict` constructor option; use it in `register()`
- `packages/core/src/player/defaultWidgets.ts` — pass `{ strict: true }` to `WidgetRegistry` constructor
- `packages/core/src/compiler/sceneTrackTypes.ts` — define `CompileWarning` type; add `warnings?` to `SceneTrack`
- `packages/core/src/compiler/sceneTrackCompiler.ts` — accumulate and attach warnings
- `packages/core/src/player/useSceneEngine.ts` — read and pipe warnings post-compilation
- `packages/core/src/player/ScenePlayer.tsx` — add `onCompileWarning?` prop

---

### A5 — `<PointerMap event="drag" | "click">` API redesign

**Covers:** T3-2

**Scope:** `packages/core/src/compiler/blocks/inputController.tsx`, `packages/core/src/input/types.ts`.

**Design questions for architect:**
- Replacing `drag?: boolean; click?: boolean` with `event?: 'drag' | 'click'` is a breaking change to `PointerMapProps`. The architect should specify the migration path: add `event` as the canonical prop, keep `drag`/`click` as deprecated aliases that emit `console.warn`, remove in a future major version.
- Confirm that the runtime `InputActionSpec` type (which stores the compiled pointer map) only needs the `event` field changed — there should be no cascading changes to `ActionInputController`.
- Ensure the `event` default (`'drag'`) matches the existing implicit default (when neither `drag` nor `click` is set, the current code produces `'drag'`).

**Files affected:**
- `packages/core/src/compiler/blocks/inputController.tsx` — `PointerMapProps` type, compile handler
- `packages/core/src/input/types.ts` — `PointerMap` runtime type if it changes

---

### A6 — DSL-level model `defaultState` override

**Covers:** T4-3

**Scope:** `packages/core/src/elements/model/dsl.tsx`, `ModelWidget.ts`, compiler model handler.

**Design questions for architect:**
- The current `defaultState` for a model comes from `modelMeta.identity` at `ModelWidget` construction time. The proposed fix allows `<Model id="bot" defaultPosition={[0, -10, 0]} />` to override this.
- The challenge: `ModelWidget.defaultState` is set at construction time, before any scene is compiled. Scene-level default overrides would need to be stored differently — either as a per-scene-group override or as a post-construction mutation.
- Alternative approach: rather than `defaultState` being on `<Model>`, make it a `<SceneGroup>`-level default map: `<ScenePlayer defaultStates={{ bot: { position: [0,-10,0] } }}>`. This keeps the concept at the group level and avoids mutating widget state.
- Architect should evaluate both approaches, consider whether `defaultState` overrides need to be per-scene or per-group, and specify the type shape.

**Files affected:**
- `packages/core/src/elements/model/dsl.tsx` — `ModelProps` additions (if approach 1)
- `packages/core/src/elements/model/ModelWidget.ts` — `defaultState` resolution (both approaches)
- `packages/core/src/player/ScenePlayer.tsx` — new `defaultStates` prop (if approach 2)

---

### A7 — `clipName` typed validation via codegen

**Covers:** T4-1

**Scope:** `scripts/gen-scene-dsl.mjs`, `apps/examples/generated/`, `packages/core/src/elements/model/dsl.tsx`.

**Design questions for architect:**
- The short-term fix (runtime `console.warn` on unrecognized `clipName`) belongs in `ModelWidget`. This requires no architectural design — just a lookup against the loaded clips.
- The long-term fix (typed `ClipName` generated from the manifest) requires the codegen script to output a type union: `export type ClipName = 'ChatRelaxF' | 'WalkCycle' | ...`. `AnimationProps.clipName` would then become `clipName?: ClipName`.
- The architect should specify: (a) where the generated `ClipName` type lives in the generated file, (b) how `AnimationProps` imports it without creating a dependency from `@brewsite/core` on generated consumer code (it cannot — the type must be generic `string` in the library; the consumer can apply their own `ClipName` type via TypeScript's nominal widening or module augmentation), (c) the exact codegen output format.
- This is a consumer-side codegen enhancement, not a change to the published library types.

**Files affected:**
- `scripts/gen-scene-dsl.mjs` — add `ClipName` type to output
- `apps/examples/generated/sceneDsl.generated.tsx` — receives new type
- `packages/core/src/elements/model/ModelWidget.ts` — short-term warn (independent of codegen)
