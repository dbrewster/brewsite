---
title: "Pre-Release Audit — @brewsite/diagram"
doc_type: plan
owner: architect
status: complete
updated: 2026-03-12
---

# Pre-Release Audit — @brewsite/diagram

## Coverage Summary

| Metric | Value |
|---|---|
| **Statement coverage** | 92.15% |
| **Branch coverage** | 84.71% |
| **Function coverage** | 96.28% |
| **Test files** | ~60 |
| **Tests passing** | All |

### Low-Coverage Files

| File | Stmts | Notes |
|---|---|---|
| `rendering/HDRLoader.ts` | 4.11% | No test — Three.js loader |
| `rendering/IconLoader.ts` | 72.3% | Partial coverage |
| `rendering/InteractionRegistry.ts` | 81.81% | Moderate |
| `hooks/useDiagramTheme.ts` | 0% | No test |
| `compiler/routingTypes.ts` | 0% | Type-only file |
| `image-panel/dsl.tsx` | 0% | DSL stub — type-only |
| `screen/dsl.tsx` | 0% | DSL stub — type-only |

---

## P0 — Must Fix Before Release

### P0-1: Theme Bug — `lightCanvas` and `midnight` Missing `nodeEnvMapIntensity`

`midnightTheme` and `lightCanvasTheme` do not set `nodeEnvMapIntensity` on their `node` config. The fallback in `themeResolver.ts` line 22 is `?? 0.15`. This means `lightCanvas` gets env map intensity `0.15` when it logically should be near `0` (its `envMapUrl` is `'none'`). This is a silent visual correctness bug.

- `packages/diagram/src/elements/diagram/themes/midnight.ts`
- `packages/diagram/src/elements/diagram/themes/lightCanvas.ts`
- `packages/diagram/src/elements/diagram/compiler/themeResolver.ts` line 22

**Fix:** Add explicit `nodeEnvMapIntensity` to both themes. For `lightCanvas`, set to `0`. For `midnight`, set to an intentional value.

### P0-2: `console.warn` in Compile-Layer Functions (Side Effects in "Pure" Code)

Three compile-layer functions emit `console.warn` unconditionally — these run in production:

1. `compile.ts` line 92 — `resolveTheme` warns on unknown theme name
2. `screen/compile.ts` line 34 — `compileScreen` warns on rotation axis overflow
3. `compiler/layoutAlgorithms.ts` line 40 — `resolveLayout` warns on unknown layout kind

**Fix:** Replace with `onWarn` callback injection (already used by `compileDiagram`). Make all compile-layer code truly side-effect-free.

---

## P1 — High Priority

### P1-1: Over-Exposure of Compilation Internals in Public API

`index.ts` exports `compileNode`, `compileEdge`, `compileGroup`, `resolveLayout`, and `routeEdges`. These are pipeline-internal functions with no documented external use case. Exporting them signals they are stable extension points, which they are not.

**Fix:** Remove from `index.ts`. Consumers who need them for testing can use direct deep imports.

### P1-2: Dead Debug Infrastructure in `edgeRouter.ts` (~100 lines)

Lines 279–390 define `ROUTE_DEBUG_ENABLED = false`, `ROUTE_DEBUG_FILTER`, `appendDebugEntry`, and `emitRouteDebugLog`. All are dead code in production and development. They add ~100 lines to a performance-critical file.

**Fix:** Remove entirely, or move behind a build-time conditional / separate debug module.

### P1-3: `diagramRenderConstants.ts` Backward-Compat Shim Without Deprecation

`packages/diagram/src/elements/diagram/compiler/diagramRenderConstants.ts` is a one-line re-export shim for constants canonical in `constants.ts`. No deprecation notice, no timeline.

**Fix:** Migrate all internal callers to import from `constants.ts` directly. Delete the shim.

### P1-4: `compile.ts` Does Too Much (574 lines)

Contains: theme resolution, main `compileDiagram` pipeline, pure math helpers (`applyEasing`, `lerpNum`, `lerpNVSRect`), fade helpers, exit/enter animation functions, and the full `functionalDiagramTransitionSpec` including a stateful memoization cache buried in a closure.

The memoization cache (lines 514–544) is not independently testable — the existing test at `functionalTransitionSpec.test.ts` uses `themeConfig: {} as any` and bypasses routing entirely.

**Fix:** Extract `applyDiagramExit`/`applyDiagramEnter` and the fade helpers into `compiler/transitionHelpers.ts`. Move the `resolveTheme` function to `compiler/themeResolver.ts` (where it logically belongs). Consider extracting the transition spec into its own file.

### P1-5: `DiagramWidget.ts` God Class (611 lines)

Acts as: DSL composite, renderable, loadable, lighting override handler, DOM event listener, hover state machine dispatcher, canvas action accumulator, and ghost node merger. The DOM interaction handling (lines 405–610) is ~200 lines that are not independently testable without a real Three.js renderer.

**Fix:** Extract DOM interaction/hover logic into a separate `DiagramInteractionHandler` class that can be tested with mocked registry and raycaster.

### P1-6: Side-Effect Import in `index.ts` Line 2

`import './register'` on line 2 means importing *any* symbol from `@brewsite/diagram` — even `import type { DiagramTheme }` in some build configs — triggers handler registration as a global side effect. This is difficult to control in tests.

**Fix:** Document this clearly. Consider lazy registration or explicit `initDiagram()` call for consumers who want full control. At minimum, ensure `import type` does not trigger the side effect in the published ESM output.

### P1-7: Unused Parameters in `edgeRouter.ts`

- `void sx` at line 139 — `sx` is computed then discarded in `getFacePortAnchor`
- `void targetSize` at line 215 — parameter received but never used in `nearestFaceForNodePair`

**Fix:** Remove the dead computation and the unused parameter.

---

## P2 — Medium Priority

### P2-1: `toMutableVec3` Duplicated Across 4 Files

Identical `toMutableVec3 = (v: Vec3): [number, number, number] => [v[0], v[1], v[2]]` in:
- `packages/diagram/src/elements/diagram/compile.ts`
- `packages/diagram/src/elements/diagram/compiler/transitionHelpers.ts` line 14
- `packages/diagram/src/elements/image-panel/compile.ts` line 8
- `packages/diagram/src/elements/screen/compile.ts` line 11

**Fix:** Extract to shared utility (e.g., `elements/_shared/mathUtils.ts` or import from `@brewsite/core/math`).

### P2-2: `lerpNum` / `lerp` Duplicated in 2 Files

- `compile.ts` line 396: `lerpNum`
- `compiler/transitionHelpers.ts` line 17: `lerp`

Identical implementation, different names.

**Fix:** Consolidate into one location.

### P2-3: `BezelVariant` Union Type Defined 3 Times

- `image-panel/types.ts` lines 7-12: `ImagePanelBezelVariant`
- `screen/types.ts` lines 7-12: `ScreenBezelVariant`
- `_shared/bezelGeometry.ts`: `BezelVariant`

All are `'none' | 'thin' | 'dark' | 'light' | 'chrome'`. Both element types explicitly acknowledge the duplication in comments.

**Fix:** Import from `_shared/bezelGeometry.ts` and alias: `export type ImagePanelBezelVariant = BezelVariant`.

### P2-4: `getFaceNormal` Duplicated Between `edgeRouter.ts` and `edgeCandidateScorer.ts`

`edgeRouter.ts` exports `getFaceNormal(face)`. `edgeCandidateScorer.ts` defines private `getFaceNormalLocal(face)` — identical logic.

**Fix:** Import from `edgeRouter.ts` instead of duplicating.

### P2-5: Edge Routing Config Repeated Verbatim Across 6 Themes

All six themes with flow routing repeat the same 9 flow config values. `edgeRouter.ts` already defines `DEFAULT_FLOW_ROUTING_CONFIG` with these exact values.

**Fix:** Themes should spread the default: `{ ...DEFAULT_FLOW_ROUTING_CONFIG, flowBundleStrength: 0.9 }`.

### P2-6: `fadeNodesOut/In`, `fadeEdgesOut/In` Duplication in `compile.ts`

Four nearly identical helpers (lines 405-427) apply opacity blending. The same pattern exists in `transitionHelpers.ts`'s `blendDiagramNodes` and `blendDiagramEdges`.

**Fix:** Delegate to a shared helper or merge into `transitionHelpers.ts`.

### P2-7: Double-Export in `index.ts`

`ImagePanel` and `ImagePanelWidget` exported on separate lines from the same module (lines 99+102). Same for `Screen`/`ScreenWidget` (lines 106+109).

**Fix:** Collapse into single export statements.

### P2-8: `DiagramPluginOptions.diagrams` Requires Manual ID Duplication

Users must declare `diagramPlugin({ diagrams: ['my-diagram'] })` AND `<Diagram id="my-diagram">` in the DSL. If the DSL ID changes without updating plugin options, the widget silently fails. No compile-time check.

**Fix:** Consider auto-discovery of diagram IDs from the compiled scene track, or at minimum add a runtime warning when a `<Diagram>` ID doesn't match any registered widget.

---

## P3 — Low Priority / Polish

### P3-1: Missing Tests

The following files have no test coverage:
- `hooks/useDiagramTheme.ts` — exported from public API, no test
- `rendering/GroupInteractionRegistry.ts` — counterpart to tested `InteractionRegistry.ts`
- `compiler/curveKernel.ts` — math in routing pipeline
- `rendering/HDRLoader.ts` — 4% coverage

### P3-2: `layoutAlgorithms.ts` is a 641-Line Monolith

`resolveLayoutWithGroups` is 430 lines (lines 205-641) containing topological sort, bottom-up group layout, cross-group edge remapping, synthetic block creation, and connection affinity refinement. The affinity refinement phase (lines 462-603) is embedded and not independently testable.

**Fix:** Extract the affinity refinement phase into a separate pure function.

### P3-3: `EnvMapManager.reloadPageOnceForHdr` Side Effect

Lines 28-40 of `EnvMapManager.ts` call `globalThis.location.reload()` in dev mode on HDR load failure. Testing-hostile (modifies global browser state). Inconsistent error feedback depending on `sessionStorage` availability.

### P3-4: `void focusCenter` in `DiagramWidget.applyCanvasAction`

Line 369 — reserved for future viewport re-centering. Acceptable tech debt but should have a tracking note.

### P3-5: Missing JSDoc on Public API

None of the exported functions in `index.ts` have JSDoc. For a published library, this is a significant gap. The `dsl.tsx` has inline JSDoc on props, and `widget.ts` has JSDoc on DSL stubs, but the public index surface is uncommented.

### P3-6: TODO Comment in `edgeCandidateScorer.ts`

Line 30: `// TODO: distinguish penetration-depth penalty from simple hit count (BLOCKER_PENETRATION_PENALTY).`
Known limitation in obstacle scoring — all obstacle hits treated equally.

### P3-7: `functionalDiagramTransitionSpec.interpolateFn` Memoization Untested

The fingerprint cache (`cachedFingerprint`, `cachedRouting`) inside `interpolateFn` (lines 514-543 of `compile.ts`) is not accessible for inspection or reset in tests. Caching correctness has no test coverage.

### P3-8: `nodeEnvMapIntensity` Should Be Required or Have Documented Fallback

The field is optional in `DiagramThemeNodeConfig` with an undocumented `?? 0.15` fallback in `themeResolver.ts`. Either make it required (so themes can't silently omit it) or add JSDoc documenting the fallback value.
