---
title: "Pre-Release Audit — @brewsite/model"
doc_type: plan
owner: architect
status: complete
updated: 2026-03-12
---

# Pre-Release Audit — @brewsite/model

## Coverage Summary

| Metric | Value |
|---|---|
| **Statement coverage** | 91.17% |
| **Branch coverage** | 75.37% |
| **Function coverage** | 89.32% |
| **Test files** | 20 |
| **Tests passing** | All (194 tests) |

### Low-Coverage Files

| File | Stmts | Notes |
|---|---|---|
| `plugin.ts` | 36.23% | Plugin lifecycle largely untested |
| `elements/model/_renderTypes.ts` | 0% | Type-only file |
| `elements/model/dsl.tsx` | 0% | DSL stubs — type-only |
| `labels/dsl.tsx` | 0% | Type-only |
| `widget/types.ts` | 0% | Interface-only |
| `player/LabelPositionerContext.ts` | 77.77% | Error branch untested |

---

## P0 — Must Fix Before Release

### P0-1: `LabelPositionerSyncer` Multi-Model Bug (BUG)

`plugin.ts` lines 81-89: `LabelPositionerSyncer` uses `modelWidgets[0]` — a hardcoded index into a mutable array. In multi-model scenes, only the first model's `nvsBounds` governs label positioning for ALL models. Labels on the second model will be positioned incorrectly.

Additionally, `modelWidgets[0]?.nvsBounds` in the `useEffect` dependency array is reading a mutable array index — an anti-pattern that React's rules-of-hooks linter would flag.

- `packages/model/src/plugin.ts` lines 81-89

**Fix:** Store `nvsBounds` per-widget and either accept a `widgetId` parameter to `LabelPositioner.setContainerSize`, or iterate all `modelWidgets` and compose their bounds.

### P0-2: Remove `renderLabels` Stub from Public Surface

`packages/model/src/labels/render.ts` lines 8-11 exports an empty function with a stale "Phase 11 implementation" comment. It is re-exported from `labels/index.ts`. Shipping an empty function in a library communicates a contract that doesn't exist.

**Fix:** Delete the function and remove from `labels/index.ts`, or implement it.

### P0-3: Vacuous Type Test in `ModelDslTypes.test.ts`

`packages/model/src/elements/model/__tests__/ModelDslTypes.test.ts` lines 7-9: Tests `ModelProps['position']` which does not exist on `ModelProps` (the actual props are `x`, `y`, `w`, `h`, `z`). The `Extract<..., Function>` resolves to `never`, making the test pass vacuously without testing anything.

**Fix:** Remove or replace with a test for a prop that actually exists (e.g., `x` which accepts `Resolvable<number>`).

---

## P1 — High Priority

### P1-1: `NVSRect` Missing from Public API Surface

`SceneModelInstanceState.nvsBounds` uses `NVSRect` (from `@brewsite/core`), but `NVSRect` is not re-exported from `@brewsite/model`. Consumers must know to import it from `@brewsite/core` — a leaky abstraction.

- `packages/model/src/index.ts` — add `export type { NVSRect } from '@brewsite/core'`

### P1-2: Sub-Module Barrel Exports Symbols Not in Public `index.ts`

`packages/model/src/elements/model/index.ts` exports many symbols that are NOT in `src/index.ts`:
- `MotionGroupLimits`, `ModelPose`, `SceneMotion`, `ModelPartOverrides`
- `AxisRotation`, `AxisTranslation`, `ModelPartId`, `ModelPartAnchor`, `ModelSubpartId`
- `applyModelEnter`, `applyModelExit`, `applyModelInterpolate`
- `functionalInstanceTransitionSpec`, `instanceTransitionSpec`
- `ASSET_MANIFEST_VERSION`, `applyModelTransform`, `ModelRenderer`

Consumers who need `AxisRotation` (to type a `MotionCommand`) must use a deep import. Decide what belongs in the public API and add it, or remove from the sub-barrel.

### P1-3: `instanceTransitionSpec` is Dead Code — No Deprecation Notice

`packages/model/src/elements/model/compile.ts` exports both `instanceTransitionSpec` (frame-baked) and `functionalInstanceTransitionSpec` (runtime closure). `ModelWidget` hardcodes `transitionSpec = functionalInstanceTransitionSpec`, making the first one dead code. Both are exported with no deprecation guidance.

**Fix:** Add `@deprecated` to `instanceTransitionSpec` or remove it entirely.

### P1-4: `__authored` Side-Channel Bypasses Type System

`packages/model/src/elements/model/ModelWidget.ts` lines 677 and 775 attach a hidden `__authored` field to `SceneModelInstanceState` via type casting:
```ts
(state as SceneModelInstanceState & { __authored?: ModelAuthoredFlags }).__authored = authored;
```

If a third party clones or merges the state object, `__authored` survives invisibly or is silently lost.

**Fix:** Use a `WeakMap<SceneModelInstanceState, ModelAuthoredFlags>` keyed by state identity, or a symbol-keyed field on the type.

### P1-5: `ModelWidget.ts` is a God Class (917 lines)

Contains:
1. DSL stub component declarations (13 stubs)
2. The `ModelWidget` class with:
   - 200+ line `CUSTOM_NODE_HANDLER` inline closure in the constructor
   - `mergeSnapshot` (~100 lines)
   - Asset loading, Three.js initialization, per-frame application
3. Five module-level helper functions for DSL compilation

The `CUSTOM_NODE_HANDLER` closure should be extracted into a standalone compile function in `compile.ts`.

**Fix:** Extract DSL compilation logic to `compile.ts` as `compileModelNode(node, api, helpers, config)`. Reduce `ModelWidget` to a coordinator.

### P1-6: `ModelRenderer` Not Unit-Testable Without `as any`

9 of 10 tests in `ModelRenderer.test.ts` access private methods/fields via `(renderer as any).ingestModel(...)`. The key setup path `ingestModel` is `private`, forcing all tests to bypass TypeScript access controls.

**Fix:** Make `ingestModel` `protected` for test subclassing, or expose a test-only factory interface.

---

## P2 — Medium Priority

### P2-1: Duplicate Test Fixtures Across 3 Files

`makeIdentity()`, `makeModelMeta()`, `makeConfig()` are copy-pasted into:
- `__tests__/ModelWidget.test.ts` lines 44-75
- `__tests__/composeBounds.test.ts` lines 14-44
- `__tests__/nvsBounds.test.ts` lines 14-44

The `composeBounds` and `nvsBounds` versions are character-identical.

**Fix:** Move to the existing `elementTestMocks.ts` fixture file.

### P2-2: Three Structurally Identical Blend Functions

`blendCommands`, `blendMotionScenes`, `blendCustomAnimations` in `compile.ts` (lines 384-518) follow the exact same pattern: build Map from `to` array, iterate `from`, merge matched, push exits, add remaining `to` entries.

**Fix:** Extract generic `blendArrayById<T>(from, to, idKey, merger)` helper (~30 lines instead of ~135).

### P2-3: `applyMultiplier` Lambda Duplicated in `ModelRenderer`

`const applyMultiplier = (value, multiplier) => ...` appears at lines 448-449 and again at lines 828-829 of `ModelRenderer.ts`.

**Fix:** Extract as a private method.

### P2-4: Static `gltfCache` Never Cleared

`packages/model/src/elements/model/ModelRenderer.ts` line 86 has a static `gltfCache` that grows indefinitely. No `clearCache()` or TTL mechanism. For hot-module-reload during development, this serves stale cached scenes.

**Fix:** Add `static clearCache()` or document the lifetime.

### P2-5: `cloneIdentityState` Has Dead `JSON.parse/stringify` Fallback

`compile.ts` lines 655-660: `structuredClone` is available in all modern environments. The `JSON` fallback silently drops `Function`-valued props like `MotionScene.commands`.

**Fix:** Remove the fallback.

### P2-6: Hardcoded Bone Root Names in `ModelRenderer.remapClipTrackNames`

Lines 409-418 hardcode `CC_Base_BoneRoot`, `RL_BoneRoot`, `RootNode` — vendor-specific skeleton names from Character Creator and generic GLTF exporters. No tests cover this path.

**Fix:** Expose as a configurable remap table in `ModelMeta` or `LoadOptions`.

### P2-7: `plugin.ts` Has Significant Untested Code Paths

- `configureRegistry` factory callback (lines 118-139) — error paths untested
- `fetchManifest` non-ok HTTP response — untested
- `LabelPositionerSyncer` component — untested
- `onRendererDisposing` — untested

### P2-8: `isComponent` Name-Based Fallback is Fragile

`ModelWidget.ts` lines 106-112: Falls back to string-based `displayName`/`name` comparison for component identity. If both are `undefined` (anonymous functions), silently returns `false` — DSL components could be skipped without error. No test covers this fallback path.

---

## P3 — Low Priority / Polish

### P3-1: `LabelCompileContext` is Trivially Thin

`compiler/labelCompiler.ts` line 2 defines `LabelCompileContext = { sceneProgress: number }` — a one-field type. Could just pass `sceneProgress: number` directly, or document why the wrapper exists (future expansion).

### P3-2: Missing JSDoc on Public Exports

`src/index.ts` has no JSDoc on any export. Functions like `clipMetaFromManifest`, `assertManifestValid`, `findModelMeta`, and `registerModelHandlers` have no documentation at the point of consumption.

### P3-3: `useLabelPositioner` Error Message References Wrong Package

`player/LabelPositionerContext.ts` — the error in `useLabelPositioner` references `<ScenePlayer>` which is in `@brewsite/core`, not this package.

### P3-4: `console.warn` Calls in `ModelRenderer.ts` Lack Full Test Coverage

7 `console.warn` calls throughout the file (missing mesh, missing pose target, missing anchor, etc.). Most are de-duplication-guarded but only some paths are tested.

### P3-5: `LabelProps` Cross-Module Dependency

`LabelProps` is defined in `labels/dsl.tsx` but the `Label` component lives in `elements/model/ModelWidget.ts`. `labels/index.ts` re-exports `Label` from `elements/model/`. This creates a bidirectional dependency between the labels and model modules.

### P3-6: `resetModelHandlerRegistrationForTesting` Discoverable via Deep Import

`handlers.ts` exports this test-only function. It's not in `src/index.ts` (good) but is accessible via deep import. Add a comment making the intent explicit, or move to a `testing.ts` entry point.
