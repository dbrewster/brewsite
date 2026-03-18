---
title: "v1 Release Readiness Audit — Implementation Plan"
doc_type: plan
owner: Toolkit Architecture
status: complete
updated: 2026-03-18
---

# v1 Release Readiness Audit — Implementation Plan

## Overview

This plan decomposes the v1 release readiness audit (see `requirements/core/notes/note_v1-release-readiness-audit.md`) into **5 parallel work streams** that can execute simultaneously without any two developers modifying the same file. Every BLOCKING and HIGH item from the audit is covered. MEDIUM items are included only when low-effort and low-risk.

### Work Stream Summary

| Stream | Scope | Developer | Risk | Est. Files |
|--------|-------|-----------|------|------------|
| **WS-1** | Build health: unused vars, test fix | Dev-1 | Low | ~6 files |
| **WS-2** | Export hygiene: barrel cleanup, missing types, `/testing` sub-paths | Dev-2 | Low | ~15 files |
| **WS-3** | API cleanup: deprecated removal, type quality | Dev-3 | Medium | ~12 files |
| **WS-4** | Peer deps + package.json fixes | Dev-4 | Low | ~8 files |
| **WS-5** | Documentation: EngineProvider refs, READMEs, templates, CLAUDE.md | Dev-5 | Low | ~45 files |

### Sequencing Dependencies

```
WS-1 ──┐
        ├──▶ WS-3 (depends on green typecheck from WS-1)
WS-2 ──┘
WS-4 ─────▶ independent (can start immediately)
WS-5 ─────▶ independent (can start immediately)
```

- **WS-1** and **WS-2** can start immediately and run in parallel.
- **WS-3** should start after WS-1 and WS-2 land (barrel changes in WS-2 affect which deprecated symbols are reachable; typecheck must pass from WS-1).
- **WS-4** and **WS-5** are fully independent of all other streams.

---

## Work Stream 1: Build Health (Dev-1)

**Goal:** Get `pnpm typecheck` and `pnpm test` to pass cleanly.

### File Ownership

Dev-1 exclusively modifies these files:
- `packages/core/src/elements/carousel-scrubber/render.ts`
- `packages/core/src/elements/view/ViewWidget.ts`
- `packages/core/src/player/InputCoordinator.tsx`
- `packages/core/src/widget/MaterialLoader.ts`
- `packages/claude-author/__tests__/init.test.ts` (or `packages/claude-author/src/init.ts`)
- `packages/screens/src/__tests__/plugin.test.ts` (NEW)

### Task 1.1: Fix 13 Unused Variable TypeCheck Errors

**Note reference:** Section 1.1

All errors are in `@brewsite/core`. The fix is mechanical: prefix unused parameters/variables with `_`, delete unused imports, or delete dead code.

#### File: `packages/core/src/elements/carousel-scrubber/render.ts`

This file has ~8 unused symbols. They are leftover from the carousel highlight refactor.

1. **Lines 8-9: `HL_DEFAULT_GLOW_INTENSITY`, `HL_DEFAULT_HOLOGRAPHIC_INTENSITY`** — imported from `./highlightConstants` but unused.
   - **Action:** Remove these two symbols from the import on line 8. The import currently reads:
     ```ts
     import {
       HL_DEFAULT_GLOW_INTENSITY, HL_DEFAULT_HOLOGRAPHIC_INTENSITY,
       HL_DEFAULT_BACKDROP_OPACITY, ...
     } from './highlightConstants';
     ```
     Remove the first two entries. Leave all other imports intact.

2. **Line 20: `updatePresetTextures`** — imported from `../_shared/materialFactory` but unused.
   - **Action:** Remove `updatePresetTextures` from the import on line 20. Keep `createPresetMaterial` and `applyMaterialApplication`.

3. **Lines 26-27: `generateRoundedRectPoints`** — imported from `./geometry` but unused.
   - **Action:** Remove `generateRoundedRectPoints` from the import on line 22-33. Keep all other geometry imports.

4. **Line ~35 area: Unused import declaration** — The exact line will be an import that TypeScript flags. Verify with `pnpm --filter @brewsite/core typecheck 2>&1 | grep render.ts` and remove the identified import.

5. **Line ~554: `particleOpacity`** — imported from `./highlightParticles` on line 40 but unused.
   - **Action:** Remove `particleOpacity` from the import on lines 36-43.

6. **Line ~649: `color`** — destructured but unused in a function body.
   - **Action:** Prefix with `_color` or remove the destructuring if the surrounding code doesn't need it.

7. **`tickWidgetStates`** — unused somewhere in the file.
   - **Action:** Find and remove or prefix with `_`.

#### File: `packages/core/src/elements/view/ViewWidget.ts`

1. **`SNAP_THRESHOLD`** — a constant declared but never used.
   - **Action:** Delete the constant declaration entirely.

2. **`scene`** — a variable assigned but never read.
   - **Action:** Remove the assignment and the variable. If it's a destructured field, prefix with `_scene`.

#### File: `packages/core/src/player/InputCoordinator.tsx`

1. **`prevProg`** — assigned but never read.
   - **Action:** Delete the variable declaration and assignment.

#### File: `packages/core/src/widget/MaterialLoader.ts`

1. **`presetName`** — assigned but never read.
   - **Action:** Delete or prefix with `_presetName`.

#### Verification

```bash
pnpm --filter @brewsite/core typecheck
```

Must exit 0 with zero errors.

### Task 1.2: Fix `@brewsite/claude-author` Init Test

**Note reference:** Section 1.2

File: `packages/claude-author/__tests__/init.test.ts` line 61.

The test `"does not create .mcp.json"` expects that `.mcp.json` is NOT created in a certain scenario, but the init CLI now creates it.

**Action:** Read the test to understand the scenario. Two options:
- **Option A (preferred):** If the init CLI correctly creates `.mcp.json` in all scenarios, update the test expectation: replace `expect(fs.existsSync(mcpPath)).toBe(false)` with `expect(fs.existsSync(mcpPath)).toBe(true)` and verify the file contents are correct.
- **Option B:** If the test is testing a "no-config" mode, fix the init CLI to not create `.mcp.json` when that mode is selected.

Read the test file and the init CLI source first; do not blindly change the assertion.

#### Verification

```bash
pnpm --filter @brewsite/claude-author vitest run
```

Must exit 0.

### Task 1.3: Write Screens Plugin Registration Test

**Note reference:** Section 8.5 (v1 DEBT)

File to create: `packages/screens/src/__tests__/plugin.test.ts`

The `screensPlugin()` function in `packages/screens/src/plugin.ts` has no test coverage. Its `configureRegistry()` method registers 3 node handlers (Screen, MediaScreen, ImagePanel) that lazily create widget instances.

**Action:** Write an interface-based stateful test that:

1. Creates a real `WidgetRegistry` instance.
2. Calls `screensPlugin().configureRegistry(registry)`.
3. Simulates a DSL node compilation for each element type (Screen, MediaScreen, ImagePanel) by invoking the registered node handlers with minimal props.
4. Asserts that:
   - Widget instances are created lazily (not present before first compile).
   - After handler invocation, `registry.get(id)` returns a widget instance of the correct type (`ScreenWidget`, `MediaScreenWidget`, `ImagePanelWidget`).
   - `api.setWidgetState()` is called with the compiled state.

**Test structure:**
```ts
import { describe, it, expect } from 'vitest';
import { WidgetRegistry } from '@brewsite/core';
import { screensPlugin } from '../plugin';
import { ScreenWidget } from '../elements/screen/widget';
import { MediaScreenWidget } from '../elements/media-screen/widget';
import { ImagePanelWidget } from '../elements/image-panel/widget';

describe('screensPlugin', () => {
  it('lazily creates ScreenWidget on first DSL encounter', () => {
    // ... construct registry, call configureRegistry, invoke handler, assert
  });

  it('lazily creates MediaScreenWidget on first DSL encounter', () => {
    // ...
  });

  it('lazily creates ImagePanelWidget on first DSL encounter', () => {
    // ...
  });

  it('does not duplicate widget on second DSL encounter', () => {
    // invoke handler twice with same id, assert registry.get returns same instance
  });
});
```

Use real `WidgetRegistry` and real compiled state — no mocks. Construct a minimal `CompileApi` from the test utilities or build one inline with the required methods (`setWidgetState`, etc.).

#### Verification

```bash
pnpm --filter @brewsite/screens vitest run
```

### Final WS-1 Verification

```bash
pnpm typecheck && pnpm test
```

Both must pass.

---

## Work Stream 2: Export Hygiene (Dev-2)

**Goal:** Clean all package barrel exports — remove internals, add missing types, create `/testing` sub-paths.

### File Ownership

Dev-2 exclusively modifies these files:
- `packages/core/src/theme/index.ts`
- `packages/core/src/elements/index.ts`
- `packages/core/src/elements/carousel-scrubber/index.ts`
- `packages/core/src/elements/camera/types.ts` (line 122 only — `DofConfig`)
- `packages/core/src/player/index.ts` (devtools removal only)
- `packages/core/src/testing.ts`
- `packages/core/src/compiler/index.ts` (type exports only)
- `packages/core/package.json` (exports map only — NOT peerDeps, that's WS-4)
- `packages/diagram/src/index.ts`
- `packages/diagram/src/testing.ts` (NEW)
- `packages/diagram/package.json` (exports map only — NOT deps, that's WS-4)
- `packages/charts/src/index.ts`
- `packages/charts/src/testing.ts` (NEW)
- `packages/charts/package.json` (exports map only)
- `packages/model/src/index.ts`

### Task 2.1: Move Test-Reset Functions to `/testing` Sub-Paths

**Note reference:** Section 2.1

#### Core package (already has `/testing`)

File: `packages/core/src/theme/index.ts` line 42.

**Action:** Remove `_resetSceneThemeRegistryForTesting` from the export block on lines 38-43. Change:
```ts
export {
  registerSceneThemePair,
  resolveSceneTheme,
  _resetSceneThemeRegistryForTesting,
} from './sceneThemeRegistry';
```
To:
```ts
export {
  registerSceneThemePair,
  resolveSceneTheme,
} from './sceneThemeRegistry';
```

File: `packages/core/src/testing.ts` — Add the re-export:
```ts
// @brewsite/core/testing — test utilities. NOT for production use.
export { clearRegistry } from './compiler/registry';
export { _resetSceneThemeRegistryForTesting } from './theme/sceneThemeRegistry';
```

#### Diagram package (needs new `/testing` sub-path)

1. Create file `packages/diagram/src/testing.ts`:
```ts
// @brewsite/diagram/testing — test utilities. NOT for production use.
export { _resetDiagramThemeRegistryForTesting } from './elements/diagram/themes';
```

2. File: `packages/diagram/src/index.ts` lines 99-103 — Remove `_resetDiagramThemeRegistryForTesting` from the export block. Change:
```ts
export {
  registerDiagramThemePair,
  resolveDiagramTheme,
  _resetDiagramThemeRegistryForTesting,
} from './elements/diagram/themes';
```
To:
```ts
export {
  registerDiagramThemePair,
  resolveDiagramTheme,
} from './elements/diagram/themes';
```

3. File: `packages/diagram/package.json` — Add `"./testing"` to the exports map:
```json
"exports": {
  ".": {
    "types": "./dist/index.d.ts",
    "import": "./dist/index.js",
    "default": "./dist/index.js"
  },
  "./testing": {
    "types": "./dist/testing.d.ts",
    "import": "./dist/testing.js",
    "default": "./dist/testing.js"
  }
}
```

#### Charts package (needs new `/testing` sub-path)

1. Create file `packages/charts/src/testing.ts`:
```ts
// @brewsite/charts/testing — test utilities. NOT for production use.
export { _resetChartThemeRegistryForTesting } from './themes/chartThemeRegistry';
```

2. File: `packages/charts/src/index.ts` lines 150-154 — Remove `_resetChartThemeRegistryForTesting` from the export block. Change:
```ts
export {
  registerChartThemePair,
  resolveChartTheme,
  _resetChartThemeRegistryForTesting,
} from './themes/chartThemeRegistry';
```
To:
```ts
export {
  registerChartThemePair,
  resolveChartTheme,
} from './themes/chartThemeRegistry';
```

3. File: `packages/charts/package.json` — Add `"./testing"` to the exports map:
```json
"exports": {
  ".": {
    "types": "./dist/index.d.ts",
    "import": "./dist/index.js",
    "default": "./dist/index.js"
  },
  "./testing": {
    "types": "./dist/testing.d.ts",
    "import": "./dist/testing.js",
    "default": "./dist/testing.js"
  }
}
```

4. While editing `packages/charts/src/index.ts`, also remove the deprecated `ChartThemePair` re-export on line 133:
```ts
export type { ChartThemePair } from './themes/index';
```
Delete this line. (The deprecated type definition in `themes/index.ts` is handled by WS-3 Task 3.3b.)

5. **Update test imports**: Grep for `_resetChartThemeRegistryForTesting` and `_resetDiagramThemeRegistryForTesting` in test files across the repo. Update those imports to use the new `/testing` sub-path:
```ts
// Before
import { _resetChartThemeRegistryForTesting } from '@brewsite/charts';
// After
import { _resetChartThemeRegistryForTesting } from '@brewsite/charts/testing';
```

Use: `grep -r "_resetChartThemeRegistryForTesting\|_resetDiagramThemeRegistryForTesting\|_resetSceneThemeRegistryForTesting" packages/ --include="*.test.*" --include="*.spec.*"` to find all test files that import these.

### Task 2.2: Remove `@internal` Pipeline Exports

**Note reference:** Section 2.2

#### Diagram package

File: `packages/diagram/src/index.ts` lines 71-72.

**Action:** Remove the entire `@internal` line and its export:
```ts
/** @internal Pipeline-internal — not a stable extension point. */
export { resolveLayout, routeEdges, compileNode, compileEdge, compileGroup } from './elements/diagram/compile';
```
Delete both lines entirely.

**Before proceeding:** Search for external consumers of these symbols. Run:
```bash
grep -r "resolveLayout\|routeEdges\|compileNode\|compileEdge\|compileGroup" packages/ --include="*.ts" --include="*.tsx" | grep -v "packages/diagram/"
```
If any `apps/` files use these, update their imports to use a deep path (since they're private apps, not published). If any other published package uses them, that's a design bug — flag it.

#### Charts package

File: `packages/charts/src/index.ts` lines 56-68.

**Action:** Remove the `@internal` export block entirely:
```ts
/** @internal */
export {
  compileChart,
  compileTooltipDsl,
  compileBarChartOptions,
  compileLineChartOptions,
  compileScatterChartOptions,
  compilePieChartOptions,
  compileAreaChartOptions,
  compileHeatMapChartOptions,
  functionalChartTransitionSpec,
} from './elements/chart/compile';
```
Delete the block (lines 57-68).

**Before proceeding:** Run the same search as above for charts internal symbols.

### Task 2.3: Export Missing Critical Types

**Note reference:** Section 2.3

#### Core: `SceneTrack`, `SceneTrackTick`, `SceneFrame`

File: `packages/core/src/compiler/index.ts` — Do NOT export from here (compiler index is DSL-only surface).

Instead, add these types to `packages/core/src/widget/index.ts` (or `packages/core/src/index.ts` — whichever is the main barrel). Check which barrel re-exports widget types. The most likely home is the main `packages/core/src/index.ts`:

**Action:** Find the barrel that re-exports from `widget/` and add:
```ts
export type { SceneTrack, SceneTrackTick, SceneFrame } from '../compiler/sceneTrackTypes';
```

Or add to `packages/core/src/player/index.ts` in the Types section (around line 72):
```ts
export type { SceneTrack, SceneTrackTick } from '../compiler/sceneTrackTypes';
export type { SceneFrame } from '../compiler/sceneFrameTypes';
```

First verify the source location:
```bash
grep -n "export type SceneFrame " packages/core/src/compiler/*.ts
grep -n "export type SceneTrack " packages/core/src/compiler/*.ts
```

Then add the exports.

#### Diagram: `DiagramNodeProps`, `DiagramEdgeProps`, `DiagramGroupProps`, `DiagramProps`

File: `packages/diagram/src/index.ts` line 64.

**Action:** Add these prop types to the existing export. Currently:
```ts
export type { DiagramExitProps, DiagramEnterProps, GridLayoutProps, HierarchicalLayoutProps, ManualLayoutProps, FlowLayoutProps } from './elements/diagram/dsl';
```
Change to:
```ts
export type {
  DiagramProps,
  DiagramNodeProps,
  DiagramEdgeProps,
  DiagramGroupProps,
  DiagramExitProps,
  DiagramEnterProps,
  GridLayoutProps,
  HierarchicalLayoutProps,
  ManualLayoutProps,
  FlowLayoutProps,
} from './elements/diagram/dsl';
```

First verify these types exist in dsl.tsx:
```bash
grep "export interface Diagram.*Props" packages/diagram/src/elements/diagram/dsl.tsx
```

#### Model: `AxisRotation`, `AxisTranslation`

File: `packages/model/src/index.ts`.

**Action:** Add to the type export from `./elements/model/types` (around line 8):
```ts
export type {
  SceneModel,
  SceneModelInstanceState,
  SceneAnimation,
  ScenePlayback,
  BodyPartOverride,
  BodyPartOverrideMap,
  ModelPartSpec,
  ModelSubpartSpec,
  MotionCommand,
  MotionScene,
  CustomAnimation,
  Vec3,
  ClipMeta,
  AxisRotation,   // ADD
  AxisTranslation, // ADD
} from './elements/model/types';
```

#### Charts: `ChartSeriesMaterialTokens`, `ChartAxisTokens`, `ChartBackgroundTokens`

File: `packages/charts/src/index.ts` — the themes types section (around line 134).

**Action:** Add to the existing `ChartTheme` type export block:
```ts
export type {
  ChartTheme,
  ChartThemeName,
  ChartSeriesMaterialTokens,  // ADD
  ChartAxisTokens,            // ADD
  ChartBackgroundTokens,      // ADD
  ChartLegendTokens,
  ChartPieTokens,
  ChartInteractionTokens,
  ChartBarTokens,
  ChartAreaTokens,
  ChartGridlinesTokens,
  ChartDataLabelsTokens,
  ChartReferenceLineTokens,
  ChartTooltipTokens,
  ChartProjectionTokens,
} from './themes/types';
```

### Task 2.4: Remove DevTools from Main Entry

**Note reference:** Section 2.4

File: `packages/core/src/player/index.ts` lines 86-93.

**Action:** Delete the entire Dev Tools section:
```ts
// ─── Dev Tools ────────────────────────────────────────────────────────────
/** @internal Dev-tools component. Not part of the stable public API. */
export { CameraControlPanel } from './CameraControlPanel';
/** @internal Dev-tools component. Not part of the stable public API. */
export { CameraInteractionInfoDialog } from './CameraInteractionInfoDialog';
/** @internal Dev-tools component. Not part of the stable public API. */
export { SceneInspector } from './SceneInspector';
export type { SceneInspectorProps } from './SceneInspector';
```

These are already correctly exported from `packages/core/src/player/devtools.ts` → `@brewsite/core/devtools`.

**After deletion:** Grep for imports of these from `@brewsite/core` (not `/devtools`):
```bash
grep -rn "from '@brewsite/core'" packages/ apps/ --include="*.ts" --include="*.tsx" | grep -E "CameraControlPanel|CameraInteractionInfoDialog|SceneInspector"
```
Update any found imports to use `@brewsite/core/devtools`.

### Task 2.5: Remove `DofConfig = never`

**Note reference:** Section 2.5

File: `packages/core/src/elements/camera/types.ts` lines 117-122.

**Action:** Delete these 6 lines:
```ts
// Phase 2 (deferred): DofConfig and full bokeh post-processing via EffectComposer.
// Implementing DoF requires calling composer.render() instead of renderer.render()
// which is a runtime loop change out of scope for this plan. The type is reserved
// here as a placeholder so scene authors can wire it up in a future phase without
// a breaking change to SceneCamera.
export type DofConfig = never; // Phase 2 — not yet implemented
```

Then grep for any usage of `DofConfig`:
```bash
grep -rn "DofConfig" packages/core/src/
```
Remove any re-exports from barrel files or any field that references this type.

### Task 2.6: Remove Carousel Scrubber Internal Types from Barrel

**Note reference:** Sections 2.6 and 2.7

File: `packages/core/src/elements/carousel-scrubber/index.ts`.

Current content:
```ts
export type { CarouselScrubberState, CarouselScrubberStyle, CarouselTrayEdgeStyle, CarouselTraySurfacePattern, ViewHighlightMode, ViewHighlightConfig, ViewHighlight } from './types';
export {
  CarouselScrubber,
  CarouselScrubberWidget,
  carouselScrubberNodeHandler,
  isCarouselScrubberStateLike,
} from './CarouselScrubberWidget';
export {
  DEFAULT_CAROUSEL_SCRUBBER_STATE,
  DEFAULT_CAROUSEL_SCRUBBER_STYLE,
  carouselScrubberTransitionSpec,
  compileCarouselScrubber,
} from './compile';
export type { CarouselScrubberProps } from './dsl';
export type { ShapePoint, TrayShapeKind, TrayGeometryParams } from './geometry';
export type { TrayCoordService, TrayPositionResult } from './trayPosition';
export { useCarouselHighlight, createCarouselHighlightController } from './useCarouselHighlight';
```

**Action:** Remove the internal types and compiler internals. The barrel should only export what scene authors or extension developers need:

```ts
export type { CarouselScrubberState, CarouselScrubberStyle, CarouselTrayEdgeStyle, CarouselTraySurfacePattern, ViewHighlightMode, ViewHighlightConfig, ViewHighlight } from './types';
export {
  CarouselScrubber,
  CarouselScrubberWidget,
  carouselScrubberNodeHandler,
  isCarouselScrubberStateLike,
} from './CarouselScrubberWidget';
export {
  DEFAULT_CAROUSEL_SCRUBBER_STATE,
  DEFAULT_CAROUSEL_SCRUBBER_STYLE,
} from './compile';
export type { CarouselScrubberProps } from './dsl';
export { useCarouselHighlight, createCarouselHighlightController } from './useCarouselHighlight';
```

Removed:
- `carouselScrubberTransitionSpec` (compile-time internal)
- `compileCarouselScrubber` (compile-time internal)
- `ShapePoint`, `TrayShapeKind`, `TrayGeometryParams` (geometry internals)
- `TrayCoordService`, `TrayPositionResult` (position calculation internals)

**After deletion:** Search for any imports of the removed symbols outside the carousel-scrubber directory:
```bash
grep -rn "carouselScrubberTransitionSpec\|compileCarouselScrubber\|ShapePoint\|TrayShapeKind\|TrayGeometryParams\|TrayCoordService\|TrayPositionResult" packages/ apps/ --include="*.ts" --include="*.tsx" | grep -v "carousel-scrubber/"
```
Fix any found imports to use direct file imports.

Then check what `packages/core/src/elements/index.ts` re-exports from carousel-scrubber (lines 74-75). Currently:
```ts
export type { ViewHighlightMode, ViewHighlightConfig } from './carousel-scrubber';
export { useCarouselHighlight, createCarouselHighlightController } from './carousel-scrubber';
```
This is fine — the elements barrel correctly only exports the public surface.

### Task 2.7: DEBT Export — Camera Types

**Note reference:** Section 8.1 (`DEBT: Missing exports for ICameraHost, CameraInteractionDefaults...`)

File: `packages/core/src/elements/index.ts` line 58.

**Action:** Add the missing camera type exports. First verify each type exists:
```bash
grep -n "export type ICameraHost\|export interface ICameraHost\|export type CameraInteractionDefaults\|export interface CameraInteractionDefaults\|export type FitBotHeightCamera\|export type FitFloorDepthCamera\|export type WorldSpaceCamera\|export type OrbitCamera" packages/core/src/elements/camera/types.ts
```

Then add to the camera export section in `packages/core/src/elements/index.ts`:
```ts
export type {
  SceneCamera,
  CameraPositionDescriptor,
  CameraLens,
  CameraPost,
  TrackpadCameraConfig,
  ICameraInteractionDriver,
  CameraInteractionDriverFactory,
  EaseFnName,
  CameraTransitionInterpolation,
  CameraOverrideState,
  // Newly exported (was DEBT)
  WorldSpaceCamera,
  OrbitCamera,
  FitBotHeightCamera,
  FitFloorDepthCamera,
} from './camera';
```

Also check whether `ICameraHost` and `CameraInteractionDefaults` exist in the camera types:
```bash
grep "CameraInteractionDefaults" packages/core/src/elements/camera/types.ts
```
If they exist, add them too. Remove the `// DEBT:` comment on line 58.

### Task 2.8: Model Barrel Export Audit

**Note reference:** Section 8.2 (HIGH)

File: `packages/model/src/index.ts`.

The internal `packages/model/src/elements/model/index.ts` exports 18+ symbols with a DEBT comment: "Audit which symbols here should be promoted to the public src/index.ts barrel." The public barrel (`packages/model/src/index.ts`) currently only exports a subset.

**Promote these TYPE symbols** — consumers building custom widgets or programmatic model configuration need them:

Add to `packages/model/src/index.ts` type exports:
```ts
export type {
  // ... existing exports ...
  // Newly promoted from internal barrel:
  ModelPartId,
  ModelPartAnchor,
  ModelPartOverrides,
  PoseGroup,
  ModelPose,
  MotionGroupLimits,
  CustomAnimationContext,
  CustomAnimationOp,
  SceneMotion,
  CompiledAnimation,
  ModelSubpartId,
} from './elements/model/types';
```

Also promote the `ASSET_MANIFEST_VERSION` constant (consumers building asset pipelines need this):
```ts
export { ASSET_MANIFEST_VERSION } from './elements/model/metadata';
```

**Keep these INTERNAL — do not promote:**
- `modelTransitionSpec`, `playbackTransitionSpec` — compile-time internals per element module pattern
- `compileAnimation`, `resolveClipRangeSeconds` — compiler layer, not consumer-facing
- `poseGroupTransition`, `blendBodyOverrides` — blend helpers (internal composition)
- `applyModelTransform` — render layer function
- `ModelRenderer` — render layer class (Three.js)

These follow the standard module boundary: compile/render internals are not part of the public surface.

**After adding exports:** Remove the DEBT comment from `packages/model/src/elements/model/index.ts` line 4.

**Verification:**
```bash
pnpm --filter @brewsite/model typecheck
```

### WS-2 Verification

```bash
pnpm --filter @brewsite/core typecheck
pnpm --filter @brewsite/diagram typecheck
pnpm --filter @brewsite/charts typecheck
pnpm --filter @brewsite/model typecheck
pnpm build:lib
```

All must pass.

---

## Work Stream 3: API Cleanup + Type Quality (Dev-3)

**Goal:** Remove deprecated APIs, tighten types. Depends on WS-1 (green typecheck) and WS-2 (barrel changes).

### File Ownership

Dev-3 exclusively modifies these files:
- `packages/core/src/widget/types.ts` (deprecated interface + `unknown` → generic)
- `packages/core/src/widget/WidgetPlugin.ts` (EngineProvider→SceneEngine in JSDoc)
- `packages/core/src/player/engineTypes.ts` (`EngineState` deprecated alias + EngineProvider→SceneEngine)
- `packages/core/src/player/SceneEngine.tsx` (deprecated props + EngineProvider→SceneEngine)
- `packages/core/src/player/EngineARContainer.tsx` (deprecated aliases + EngineProvider→SceneEngine)
- `packages/core/src/compiler/blocks/inputController.tsx` (deprecated props)
- `packages/core/src/compiler/sceneDslCompiler.ts` (EngineProvider→SceneEngine only)
- `packages/core/src/theme/sceneThemeRegistry.ts` (string → ThemeFamily)
- `packages/core/src/theme/types.ts` (`polarity` → `ThemePolarity` + EngineProvider→SceneEngine)
- `packages/core/src/compiler/sceneTrackTypes.ts` (`sceneProgress` required)
- `packages/diagram/src/player/diagramPlugin.ts` (deprecated `diagrams` field)
- `packages/charts/src/player/ChartTooltipOverlay.tsx` (delete file)
- `packages/charts/src/player/__tests__/ChartTooltipOverlay.test.tsx` (delete file)
- `packages/charts/src/elements/chart/stubs.ts` (remove deprecated `Chart` stub)
- `packages/charts/src/elements/chart/dsl.tsx` (remove `ChartProps`, `bounds` prop)
- `packages/charts/src/elements/chart/types.ts` (remove `ChartDSL`)
- `packages/charts/src/elements/chart/index.ts` (remove deprecated re-exports)
- `packages/charts/src/elements/chart/ChartWidget.ts` (remove deprecated `Chart` re-export)
- `packages/charts/src/themes/index.ts` (remove deprecated `ChartThemePair`)
- `packages/charts/src/elements/chart/compile.ts` (remove `bounds` fallback handling)
- `packages/diagram/src/elements/diagram/compiler/diagramRenderConstants.ts` (DEBT shim)

### Task 3.0: EngineProvider → SceneEngine in WS-3-Owned Files

**Note reference:** Section 5.6 (BLOCKING) — shared responsibility with WS-5.

Dev-5 handles the bulk EngineProvider replacement, but several files are owned by Dev-3. To prevent merge conflicts, Dev-3 does the EngineProvider→SceneEngine text replacement in every file they touch for deprecated API removal. This runs as part of the same edit pass.

**Files Dev-3 handles EngineProvider replacement in:**

1. `packages/core/src/widget/WidgetPlugin.ts` — 5 occurrences (lines 13, 18, 23, 72, 73). Replace `EngineProvider` with `SceneEngine` in all JSDoc.
2. `packages/core/src/player/engineTypes.ts` — 2 occurrences (lines 22, 28). Replace in comments.
3. `packages/core/src/player/SceneEngine.tsx` — 4 internal comments (lines 2, 139, 222, 400). Replace.
4. `packages/core/src/player/EngineARContainer.tsx` — check for EngineProvider references and replace.
5. `packages/core/src/theme/types.ts` — line 324. Replace.
6. `packages/core/src/compiler/sceneDslCompiler.ts` — 3 occurrences (lines 442, 519, 529). Replace.

**Process:** In each file below where Dev-3 makes structural changes, also do a find-replace of `EngineProvider` → `SceneEngine` in strings, JSDoc, and comments before committing.

Dev-5's Task 5.1 file list must **exclude** all files listed above to prevent conflicts.

### Task 3.1: Remove Core Deprecated APIs

**Note reference:** Section 4.1

#### 3.1.1: Remove `ThemeKeyContext`, `useThemeKey`, `ThemeKey`

These are exported from `packages/core/src/theme/index.ts` lines 23-31.

**Action:** Delete these lines:
```ts
/**
 * @deprecated ThemeKeyContext is superseded by the compile-time theme path via
 * `<SceneEngine theme={...}>`. It will be removed in the next major release.
 */
export { ThemeKeyContext, useThemeKey } from './ThemeKeyContext';
/**
 * @deprecated ThemeKey is superseded by ActiveTheme. Use `ActiveTheme` instead.
 */
export type { ThemeKey } from './ThemeKeyContext';
```

**IMPORTANT — WS-2 also touches this file.** Coordinate: Dev-2 removes `_resetSceneThemeRegistryForTesting` from lines 38-43. Dev-3 removes lines 23-31. These are separate line ranges — no conflict if both work on the same base, but to be safe, **Dev-3 should start this file AFTER Dev-2's changes land**, or they should agree on the final file state.

**Safer alternative:** Dev-3 does NOT touch `packages/core/src/theme/index.ts`. Instead, Dev-3 only removes the re-exports from the main `packages/core/src/index.ts` barrel. Check whether `ThemeKeyContext`, `useThemeKey`, and `ThemeKey` are re-exported from the top-level barrel. If so, remove from there. The theme/index.ts internal export can stay (it's not the published surface).

**After deletion:** Search for consumers:
```bash
grep -rn "ThemeKeyContext\|useThemeKey\|ThemeKey" packages/ apps/ --include="*.ts" --include="*.tsx" | grep -v "ThemeContext\|ThemeKeyContext.ts\|theme/index.ts"
```
Update any found references to use `ActiveTheme` and `useTheme`.

#### 3.1.2: Remove `EngineState` Alias

File: `packages/core/src/player/engineTypes.ts` line 19.

**Action:** Delete lines 14-19:
```ts
/**
 * @deprecated Use EngineFrameState instead.
 * EngineState was a subset of EngineFrameState differing only in the absence
 * of the `tick` field. EngineFrameState now has `tick` as optional.
 */
export type EngineState = EngineFrameState;
```

Also remove `EngineState` from the re-export in `packages/core/src/player/index.ts` line 65. Change:
```ts
export type { EngineFrameState, EngineState } from './engineTypes';
```
To:
```ts
export type { EngineFrameState } from './engineTypes';
```

**After deletion:** Search for `EngineState` in consumer code (excluding the type definition itself) and update to `EngineFrameState`.

#### 3.1.3: Remove `ICameraActionTarget`

File: `packages/core/src/widget/types.ts` lines 159-168.

**Action:** Delete the entire interface:
```ts
/**
 * @deprecated No built-in widget implements this interface. If your custom widget
 * uses ICameraActionTarget, migrate to ActionInputController's onUnknownAction callback
 * pattern. This interface will be removed in v3.
 */
export interface ICameraActionTarget extends IWidget {
  applyOrbit(dx: number, dy: number, speed: number): void;
  applyDolly(delta: number, speed: number): void;
  applyReset(): void;
}
```

Search for re-exports and consumer references:
```bash
grep -rn "ICameraActionTarget" packages/ apps/ --include="*.ts" --include="*.tsx"
```
Remove all found references.

#### 3.1.4: Remove Deprecated `SceneEngineProps` Fields

File: `packages/core/src/player/SceneEngine.tsx` lines 87-103.

**Action:** Delete the three deprecated props from `SceneEngineProps`:
```ts
  /**
   * Scene theme token set for cross-package visual styling.
   * @deprecated Use `theme` prop instead.
   */
  sceneTheme?: SceneTheme;

  /**
   * Theme family key.
   * @deprecated Use `theme` prop instead: `theme={{ family: 'darkGlass', polarity: 'dark' }}`.
   */
  themeFamily?: ThemeFamily;

  /**
   * Theme polarity ('dark' | 'light'). Defaults to 'dark' when themeFamily is set.
   * @deprecated Use `theme` prop instead.
   */
  themePolarity?: ThemePolarity;
```

Then search the `SceneEngine` component body for runtime handling of these props (fallback logic that reads `sceneTheme`, `themeFamily`, `themePolarity` from props). Remove the fallback code.

**After deletion:** Search for any `apps/` usage:
```bash
grep -rn "sceneTheme=\|themeFamily=\|themePolarity=" apps/ --include="*.tsx"
```
Update to use `theme={{ family: '...', polarity: '...' }}`.

#### 3.1.5: Remove Deprecated `PointerMapProps` and `KeyMapProps` Fields

File: `packages/core/src/compiler/blocks/inputController.tsx` lines 51-53 and 86-88.

**Action:** Remove the deprecated `drag`, `click` props from `PointerMapProps`:
```ts
  /** @deprecated Use event="drag" instead. */
  drag?: boolean;
  /** @deprecated Use event="click" instead. */
  click?: boolean;
```

Remove the deprecated `key` prop from `KeyMapProps`:
```ts
  /**
   * @deprecated React's key prop is reserved. Use keyName instead.
   */
  key?: string;
```

Search for runtime fallback handling of these props in the compiler (likely in the `PointerMap` and `KeyMap` node handlers) and remove it.

#### 3.1.6: Remove Deprecated EngineARContainer Aliases

File: `packages/core/src/player/EngineARContainer.tsx` lines 86-87 and 100-101.

**Action:** Remove:
```ts
/** @deprecated Use ViewportScaleContextValue. Alias will be removed in v3. */
export type EngineARContainerContextValue = ViewportScaleContextValue;
```
and:
```ts
/** @deprecated Use ViewportScaleContext. Alias will be removed in v3. */
export const EngineARContainerContext = ViewportScaleContext;
```

Also remove from `packages/core/src/player/index.ts` lines 37-41:
Remove `EngineARContainerContextValue` and `EngineARContainerContext` from the exports. Keep `ViewportScaleContextValue`, `ViewportScaleContext`, and the rest.

### Task 3.2: Remove Diagram Deprecated APIs

**Note reference:** Section 4.2

File: `packages/diagram/src/player/diagramPlugin.ts` lines 11-22.

**Action:** Remove the `diagrams` field from `DiagramPluginOptions`:
```ts
export type DiagramPluginOptions = {
  /**
   * @deprecated Since v0.x. DiagramWidget instances are now created lazily on
   * first DSL encounter during compilation. This field is no longer needed and
   * will be removed in a future major release.
   */
  diagrams?: readonly string[];
};
```

If `DiagramPluginOptions` has no remaining fields, either:
- Delete the type and remove it from exports, changing `diagramPlugin(options?: DiagramPluginOptions)` to `diagramPlugin()`.
- Or keep the type as `export type DiagramPluginOptions = Record<string, never>;` for future extension.

Check the `diagramPlugin` function body for any runtime handling of `diagrams` (likely a `console.warn` about deprecation). Remove that code.

### Task 3.3: Remove Charts Deprecated APIs and Dead Files

**Note reference:** Section 4.3

#### 3.3a: Delete `ChartTooltipOverlay` Dead File

File: `packages/charts/src/player/ChartTooltipOverlay.tsx` — **Delete this file entirely.**
File: `packages/charts/src/player/__tests__/ChartTooltipOverlay.test.tsx` — **Delete this file entirely.**

Verify neither is imported anywhere:
```bash
grep -rn "ChartTooltipOverlay" packages/charts/src/ --include="*.ts" --include="*.tsx" | grep -v "ChartTooltipOverlay.tsx\|ChartTooltipOverlay.test.tsx"
```

Note: `ChartTooltipHost.tsx` and `projectUtils.ts` reference `ChartTooltipOverlay` in internal comments only — update those comments to remove stale references.

#### 3.3b: Remove Deprecated `ChartThemePair` Type from Barrel

File: `packages/charts/src/index.ts` line 133:
```ts
export type { ChartThemePair } from './themes/index';
```
**Action:** Delete this line. The deprecated type at `packages/charts/src/themes/index.ts` lines 38-42 can stay internal (it's not in the barrel after this change), but preferably also delete the type definition itself:
```ts
/** @deprecated Use registerChartThemePair / resolveChartTheme instead. */
export type ChartThemePair = {
  readonly dark: ChartTheme;
  readonly light: ChartTheme;
};
```
Then grep for consumers:
```bash
grep -rn "ChartThemePair[^E]" packages/ apps/ --include="*.ts" --include="*.tsx" | grep -v "chartThemeRegistry\|themes/index"
```
The non-deprecated replacement is `ChartThemePairEntry` (already exported).

#### 3.3c: Remove Deprecated `ChartDSL` Type

File: `packages/charts/src/elements/chart/types.ts` lines 329-344.

**Action:** Delete the entire `ChartDSL` type:
```ts
/**
 * V1 generic chart DSL props — kept for the deprecated <Chart type="..."> component.
 * @deprecated Use BarChartDSL, LineChartDSL, etc.
 */
export type ChartDSL = { ... };
```

`ChartDSL` is NOT exported from the package barrel (`index.ts`), so this only affects internal code. Search for internal consumers:
```bash
grep -rn "ChartDSL" packages/charts/src/ --include="*.ts" --include="*.tsx"
```
Update any found references to use the per-type DSL types (`BarChartDSL`, etc.).

#### 3.3d: Remove Deprecated `ChartProps` Type

File: `packages/charts/src/elements/chart/dsl.tsx` lines 149-150:
```ts
/** @deprecated Use BarChartProps, LineChartProps, etc. instead. */
export type ChartProps = ChartDSL & { children?: React.ReactNode };
```

**Action:** Delete these 2 lines. `ChartProps` is NOT in the package barrel but IS re-exported from `elements/chart/index.ts` line 4. Also remove it from that internal barrel.

Then search for consumers:
```bash
grep -rn "\bChartProps\b" packages/charts/src/ --include="*.ts" --include="*.tsx" | grep -v "dsl.tsx\|index.ts"
```
The deprecated `Chart()` stub in `stubs.ts` uses `ChartProps` — handle this in 3.3e below.

#### 3.3e: Remove Deprecated `Chart` Component Stub

File: `packages/charts/src/elements/chart/stubs.ts` lines 21-23:
```ts
/** @deprecated Use <BarChart>, <LineChart>, etc. instead. */
export function Chart(_props: ChartProps): null { return null; }
Chart.displayName = 'Chart';
```

**Action:** Delete these 3 lines. Then remove the `Chart` re-export from:
- `packages/charts/src/elements/chart/index.ts` line 3 (the `@deprecated @internal` export)
- `packages/charts/src/elements/chart/ChartWidget.ts` line 625-626 (the `@deprecated @internal` re-export)

Search for any node handler registration for `Chart`:
```bash
grep -rn "registerNode(Chart" packages/charts/src/ --include="*.ts"
```
If a handler exists, remove it. The per-type components (`BarChart`, etc.) have their own handlers.

#### 3.3f: Remove Deprecated `bounds` Prop from `BaseChartDSL`

File: `packages/charts/src/elements/chart/dsl.tsx` lines 44-56:
```ts
  /**
   * @deprecated Use `depth` for the 3D extrusion depth. `bounds.width` and `bounds.height`
   * are ignored ...
   */
  bounds?: {
    /** @deprecated Use top-level `depth` prop instead. */
    readonly depth?: number;
    /** @deprecated Has no effect. Use `w` to set chart geometry width. */
    readonly width?: number;
    /** @deprecated Has no effect. Use `h` to set chart geometry height. */
    readonly height?: number;
  };
```

**Action:** Delete the entire `bounds` field and its JSDoc. Then search for runtime handling of `bounds` in the chart compiler:
```bash
grep -rn "\.bounds" packages/charts/src/elements/chart/compile.ts
```
Remove any fallback code that reads `bounds.depth`, `bounds.width`, `bounds.height`. Since no v1-beta external consumers exist, this is safe.

### Task 3.4: Tighten Type Quality

**Note reference:** Sections 3.2, 3.3, 3.4, 3.5

#### 3.4.1: Make `sceneProgress` Required

File: `packages/core/src/compiler/sceneTrackTypes.ts` line 389.

**Action:** Change:
```ts
  sceneProgress?: number;
```
To:
```ts
  sceneProgress: number;
```

Remove the DEBT comment on line 387. Update the JSDoc above it to remove "Optional (not present in tracks compiled before this field was added)."

Then search for defensive checks:
```bash
grep -rn "sceneProgress" packages/core/src/ --include="*.ts" --include="*.tsx"
```
Any code doing `tick.sceneProgress ?? tick.blockProgress` can now just use `tick.sceneProgress`.

#### 3.4.2: Tighten `string` → `ThemeFamily` in Registry

File: `packages/core/src/theme/sceneThemeRegistry.ts` lines 22-35.

**Action:** Import `ThemeFamily` and use it:
```ts
import type { SceneTheme, ThemeFamily } from './types';
```

Change `registerSceneThemePair`:
```ts
export function registerSceneThemePair(
  family: ThemeFamily | (string & {}),
  pair: SceneThemePair,
): void {
```

Change `resolveSceneTheme`:
```ts
export function resolveSceneTheme(
  family: ThemeFamily | (string & {}),
  polarity: 'dark' | 'light',
): SceneTheme {
```

The `(string & {})` pattern provides autocomplete for known `ThemeFamily` values while still allowing arbitrary strings for extensibility.

#### 3.4.3: Use `ThemePolarity` in `ActiveTheme`

File: `packages/core/src/theme/types.ts` line 376.

**Action:** First, verify `ThemePolarity` is defined in this file:
```bash
grep -n "ThemePolarity" packages/core/src/theme/types.ts
```

Then change:
```ts
export interface ActiveTheme {
  readonly family: ThemeFamily;
  readonly polarity: 'dark' | 'light';
}
```
To:
```ts
export interface ActiveTheme {
  readonly family: ThemeFamily;
  readonly polarity: ThemePolarity;
}
```

#### 3.4.4: Tighten `unknown` in `AnimationTickContext.resolvedState`

File: `packages/core/src/widget/types.ts` line 556.

**Action:** Make `AnimationTickContext` generic:
```ts
export type AnimationTickContext<TState = unknown> = {
  // ... existing fields ...
  resolvedState: TState;
  // ... rest ...
};
```

This is non-breaking — existing code using `AnimationTickContext` without a type parameter gets `unknown` (same as before).

#### 3.4.5: Tighten `AssetManifest` Fields

File: `packages/core/src/widget/types.ts` lines 12-16.

**Action:** Change:
```ts
export type AssetManifest = {
  readonly version: number;
  readonly models: unknown[];
  readonly animations: unknown[];
};
```
To:
```ts
export type AssetManifest = {
  readonly version: number;
  readonly models: readonly { id: string; url: string }[];
  readonly animations: readonly { id: string; url: string }[];
};
```

**Before applying:** Verify this is compatible by checking how `AssetManifest` is created:
```bash
grep -rn "AssetManifest" packages/core/src/ packages/model/src/ --include="*.ts" | head -20
```

If `@brewsite/model` extends this type, ensure the narrowing is compatible.

#### 3.4.6: Tighten `ICameraInteractionDriver.attach(cameraObject: unknown)`

File: `packages/core/src/elements/camera/types.ts`.

**Action:** Find the `attach` method on `ICameraInteractionDriver` and change:
```ts
attach(cameraObject: unknown): void;
```
To:
```ts
attach(cameraObject: PerspectiveCamera): void;
```

The file already imports from `three` (confirmed: `import type { ... } from 'three'` would be needed — check if `PerspectiveCamera` is already imported in this file). If not, add the import.

#### 3.4.7: Remove Diagram DEBT Shim

File: `packages/diagram/src/elements/diagram/compiler/diagramRenderConstants.ts`.

**Action:** Read the file. If it's a deprecated re-export shim (as described), delete the entire file. Then grep for imports of this file:
```bash
grep -rn "diagramRenderConstants" packages/diagram/src/ --include="*.ts"
```
Update any imports to point to the canonical source.

### Verification

```bash
pnpm typecheck && pnpm test
```

All must pass. If any `apps/` code breaks due to deprecated API removal, update the app code (apps are private, not published).

---

## Work Stream 4: Peer Dependencies + Package.json (Dev-4)

**Goal:** Fix peer dependency ranges, move `@brewsite/core` to peerDeps in diagram, document `camera-controls`.

### File Ownership

Dev-4 exclusively modifies these files:
- `packages/core/package.json` (peerDependencies section only — NOT exports map, that's WS-2)
- `packages/diagram/package.json` (dependencies/peerDependencies section only — NOT exports map)
- `packages/model/package.json` (peerDependencies only)
- `packages/charts/package.json` (peerDependencies only)
- `packages/screens/package.json` (peerDependencies only)
- `packages/slides/package.json` (peerDependencies only, if it exists)
- `packages/npx/create-brewsite/templates/tsconfig.json` (if dependency template needs update)

### Task 4.1: Widen React Peer Dep Range

**Note reference:** Section 6.1

**Research result:** Grep confirms NO React 19-only APIs are used across all packages (`use()`, `useActionState`, `useFormStatus`, `useOptimistic` — zero matches). The codebase is React 18 compatible.

**Action:** In ALL published packages' `package.json` files, change the React peer dep from `^19.2.4` to `^18.0.0 || ^19.0.0`:

```json
"peerDependencies": {
  "react": "^18.0.0 || ^19.0.0",
  "react-dom": "^18.0.0 || ^19.0.0",
  ...
}
```

Files to update:
- `packages/core/package.json`
- `packages/diagram/package.json`
- `packages/model/package.json`
- `packages/charts/package.json`
- `packages/screens/package.json`

Check if `packages/slides/package.json` and `packages/docs/package.json` have peer deps too (they may be private apps — if private, skip).

### Task 4.2: Move `@brewsite/core` from `dependencies` to `peerDependencies` in Diagram

**Note reference:** Section 6.2

File: `packages/diagram/package.json`.

Currently (line 33):
```json
"dependencies": {
  "@brewsite/core": "workspace:*"
},
```

**Action:** Remove `@brewsite/core` from `dependencies` and add to `peerDependencies`:
```json
"dependencies": {},
"peerDependencies": {
  "@brewsite/core": "workspace:*",
  "react": "^18.0.0 || ^19.0.0",
  "react-dom": "^18.0.0 || ^19.0.0",
  "three": "^0.170.0",
  "troika-three-text": "^0.52.4"
}
```

If `dependencies` becomes empty, you may remove the key entirely.

**Note:** The publish script (`scripts/publish-all.mjs`) already resolves `workspace:*` to concrete versions. Verify this by reading the publish script. No changes should be needed there.

### Task 4.3: Evaluate Three.js Version Range

**Note reference:** Section 6.3

**Action:** Research minimum Three.js version required. Check:
1. `camera-controls` requires `three >= ?` — check its package.json/README.
2. `troika-three-text` requires `three >= ?`.
3. Search for Three.js APIs introduced after r170 that we use:
   ```bash
   grep -rn "BatchedMesh\|WebGPURenderer\|TSL\|NodeMaterial" packages/core/src/ packages/diagram/src/ --include="*.ts"
   ```
   If none found, `^0.170.0` is likely safe.

**Conservative action:** Widen to `^0.175.0` (giving ~8 minor versions of range) in all published packages. If the developer confirms `^0.170.0` works, use that instead.

Update in:
- `packages/core/package.json`
- `packages/diagram/package.json`
- `packages/model/package.json`
- `packages/charts/package.json`
- `packages/screens/package.json`

### Task 4.4: Document `camera-controls` Peer Dependency

**Note reference:** Section 6.4

**Action:** `camera-controls` is used by `CameraWidget` for orbit/dolly/pan. It has module-level state (it creates an `EventDispatcher` subclass) — it should stay as a peer dep to ensure a single instance.

The documentation fix happens in WS-5 (README updates). Dev-4's responsibility is only to ensure the peer dep is correctly declared and version-ranged.

Check if `camera-controls@^3.1.2` can be widened:
```bash
npm view camera-controls versions --json | tail -10
```

If 3.x is the only major series, keep `^3.1.2` or widen slightly.

### Verification

```bash
pnpm install  # Ensure workspace links resolve correctly
pnpm build:lib  # Ensure all packages still compile
```

---

## Work Stream 5: Documentation + DX (Dev-5)

**Goal:** Fix all EngineProvider references, write missing READMEs, fix templates, update CLAUDE.md.

### File Ownership

Dev-5 exclusively modifies these files:
- ~39 files containing `EngineProvider` references (see list below — excludes CHANGELOG.md and MIGRATION.md)
- `packages/core/README.md`
- `packages/model/README.md` (NEW)
- `packages/screens/README.md` (NEW)
- `packages/diagram/README.md`
- `packages/charts/README.md`
- `packages/npx/create-brewsite/templates/starter-scene.tsx`
- `CLAUDE.md` (root)
- `packages/claude-author/templates/brewsite-scene-author.md`
- `packages/claude-author/.claude/agents/brewsite-scene-author.md`

### Task 5.1: Global `EngineProvider` → `SceneEngine` Replacement

**Note reference:** Section 5.6 (BLOCKING)

This is the highest-priority item. Replace all references to the deleted `EngineProvider` component with `SceneEngine`.

**Scope:** All `packages/*/src/**/*.ts`, `packages/*/src/**/*.tsx`, and `packages/*/README.md` files. **EXCLUDE:**
- `CHANGELOG.md` and `MIGRATION.md` (historical references are correct)
- Files owned by Dev-3 (WS-3 handles EngineProvider replacement in these as part of Task 3.0):
  - `packages/core/src/widget/WidgetPlugin.ts`
  - `packages/core/src/player/engineTypes.ts`
  - `packages/core/src/player/SceneEngine.tsx`
  - `packages/core/src/player/EngineARContainer.tsx`
  - `packages/core/src/theme/types.ts`
  - `packages/core/src/compiler/sceneDslCompiler.ts`

**Method:** Use a targeted find-and-replace. The replacement is NOT a blind `s/EngineProvider/SceneEngine/g` — some contexts need more nuanced changes:

1. **Runtime error messages** — Replace the text string:
   - `packages/core/src/widget/useVariable.ts` line 23: Change `'[useVariable] must be used inside <EngineProvider>'` to `'[useVariable] must be used inside <SceneEngine>'`.
   - `packages/charts/src/data/ChartStoreContext.tsx` line 20: Change `'[ChartStoreContext] useChartStore() must be called inside an EngineProvider with chartPlugin().'` to `'[ChartStoreContext] useChartStore() must be called inside a <SceneEngine> with chartPlugin().'`.

2. **JSDoc and comments** — Replace `EngineProvider` with `SceneEngine` in:
   - `packages/core/src/player/useSceneRuntime.ts` — `<EngineProvider id="...">` → `<SceneEngine id="...">`
   - `packages/core/src/player/EngineGate.tsx` — JSDoc usage example
   - `packages/core/src/widget/WidgetPlugin.ts` — all 5 occurrences
   - `packages/core/src/player/plugins.ts` — JSDoc example
   - `packages/core/src/compiler/sceneDslCompiler.ts` — 3 occurrences
   - `packages/core/src/player/engineTypes.ts` — 2 occurrences (line 22: "EngineProvider" in comment, line 28: same)
   - `packages/core/src/player/ScenePlayerRegistry.ts` — line 71
   - `packages/core/src/player/SceneEngine.tsx` — 4 internal comments
   - `packages/core/src/player/EngineOverlayHost.tsx` — line 32
   - `packages/core/src/player/serializeJsx.ts` — line 25
   - `packages/core/src/theme/ThemeContext.ts` — line 1
   - `packages/core/src/theme/types.ts` — line 324
   - `packages/core/src/elements/carousel-scrubber/useCarouselHighlight.ts` — lines 11, 18
   - `packages/charts/src/player/ChartProvider.tsx` — 3 occurrences
   - `packages/charts/src/player/chartPlugin.ts` — 3 occurrences
   - `packages/model/src/plugin.ts` — 2 occurrences
   - `packages/screens/src/index.ts` — line 2 barrel comment
   - `packages/slides/src/` — multiple files (if slides is published, fix these too)
   - `packages/docs/src/` — multiple files (if docs is published, fix these too; if private app, still fix for consistency)

3. **README code examples:**
   - `packages/charts/README.md` — 4 occurrences in code examples
   - `packages/diagram/README.md` — 1 occurrence in code example
   - `packages/core/README.md` — 1 occurrence (if present)

4. **Claude-author templates:**
   - `packages/claude-author/templates/brewsite-scene-author.md` — 24 occurrences
   - `packages/claude-author/.claude/agents/brewsite-scene-author.md` — 24 occurrences

**Process:**
1. Start with runtime error messages (highest user impact).
2. Then JSDoc/comments in `packages/core/src/`.
3. Then JSDoc/comments in other packages.
4. Then README files.
5. Then claude-author templates.

**After each batch:** Run a grep to verify remaining occurrences:
```bash
grep -rn "EngineProvider" packages/ --include="*.ts" --include="*.tsx" --include="*.md" | grep -v CHANGELOG | grep -v MIGRATION | grep -v node_modules
```

Target: zero remaining occurrences (excluding CHANGELOG.md and MIGRATION.md).

### Task 5.2: Fix Core README

**Note reference:** Section 5.1 (BLOCKING)

File: `packages/core/README.md`.

**Action:** Find the input section (lines 166-173 per the note) and rewrite. Replace references to `ScrollInput`, `KeyboardInput`, `PointerInput` with `InputCoordinator`:

```md
### Input

The `InputCoordinator` component handles all scroll, keyboard, and pointer input for scene navigation:

```tsx
import { InputCoordinator } from '@brewsite/core/player';

<InputCoordinator
  inertiaSensitivity={1.2}
  inertiaDecay={0.92}
  target={canvasRef}
  keyboardTarget={containerRef}
  pauseWhenHidden
/>
```
```

Also add `camera-controls` to the installation/peer dependencies section of the README (per Task 4.4).

### Task 5.3: Write Model Package README

**Note reference:** Section 5.2 (BLOCKING)

Create file: `packages/model/README.md`.

```md
# @brewsite/model

3D model loading, animation playback, and label system for BrewSite scenes.

## Installation

```bash
pnpm add @brewsite/model @brewsite/core react react-dom three
```

## Setup

Add `modelPlugin()` to your `SceneEngine` plugins:

```tsx
import { SceneEngine, SceneCanvas, EngineOverlayHost } from '@brewsite/core/player';
import { modelPlugin } from '@brewsite/model';

function App() {
  return (
    <SceneEngine
      plugins={[modelPlugin({ manifest: '/assets/manifest.json' })]}
      getFrame={() => <IntroScene />}
    >
      <SceneCanvas />
      <EngineOverlayHost />
    </SceneEngine>
  );
}
```

## Scene Authoring

```tsx
import { Scene } from '@brewsite/core/compiler';
import { Camera, Background, Lighting, Ambient } from '@brewsite/core/elements';
import { Model, Animation, Label } from '@brewsite/model';

function IntroScene() {
  return (
    <Scene id="intro">
      <Camera mode="orbit" distance={3} azimuth={0} polar={60} fov={45} />
      <Background color="#1a1a2e" />
      <Lighting><Ambient intensity={0.6} /></Lighting>
      <Model id="hero" src="hero-bot" scale={1} y={0} />
      <Animation model="hero" clip="idle" />
      <Label target="hero" bone="head" text="Hello!" />
    </Scene>
  );
}
```

## API

See the [full documentation](https://brewsite.dev/docs/model) for complete API reference.
```

### Task 5.4: Write Screens Package README

**Note reference:** Section 5.3 (BLOCKING)

Create file: `packages/screens/README.md`.

```md
# @brewsite/screens

3D screen, media screen, and image panel elements for BrewSite scenes.

## Installation

```bash
pnpm add @brewsite/screens @brewsite/core react react-dom three
```

## Setup

Add `screensPlugin()` to your `SceneEngine` plugins:

```tsx
import { SceneEngine } from '@brewsite/core/player';
import { screensPlugin } from '@brewsite/screens';

<SceneEngine plugins={[screensPlugin()]} getFrame={() => <MyScene />}>
  {/* ... */}
</SceneEngine>
```

## Elements

### Screen

```tsx
import { Screen } from '@brewsite/screens';

<Screen id="demo-screen" width={1.6} height={0.9} bezel="rounded" />
```

### MediaScreen

```tsx
import { MediaScreen } from '@brewsite/screens';

<MediaScreen id="video" width={1.6} height={0.9} source="webcam" />
```

### ImagePanel

```tsx
import { ImagePanel } from '@brewsite/screens';

<ImagePanel id="hero-image" src="/images/hero.png" width={2} height={1.2} bezel="glass" />
```

## API

See the [full documentation](https://brewsite.dev/docs/screens) for complete API reference.
```

### Task 5.5: Fix `create-brewsite` Template

**Note reference:** Section 5.4 (BLOCKING)

File: `packages/npx/create-brewsite/templates/starter-scene.tsx`.

**Action:** Replace the entire file content with a valid camera configuration:

```tsx
import { Scene } from '@brewsite/core/compiler';
import { Camera, Background, Lighting, Ambient, Directional } from '@brewsite/core/elements';

export function IntroScene(): JSX.Element {
  return (
    <Scene id="intro">
      <Camera mode="orbit" distance={5} azimuth={0} polar={70} fov={45} />
      <Background color="#0f172a" />
      <Lighting>
        <Ambient intensity={0.4} />
        <Directional intensity={0.8} x={5} y={10} z={5} />
      </Lighting>
    </Scene>
  );
}
```

### Task 5.6: Add `create-brewsite` App.tsx Template

**Note reference:** Section 5.5 (HIGH)

Create file: `packages/npx/create-brewsite/templates/App.tsx`:

```tsx
import { SceneEngine, SceneCanvas, EngineOverlayHost, ScrollStage } from '@brewsite/core/player';
import { corePlugin } from '@brewsite/core/player';
import { IntroScene } from './scenes/intro';

export default function App() {
  return (
    <ScrollStage>
      <SceneEngine
        plugins={[corePlugin()]}
        getFrame={() => <IntroScene />}
      >
        <SceneCanvas />
        <EngineOverlayHost />
      </SceneEngine>
    </ScrollStage>
  );
}
```

Then update the scaffolder source (`packages/npx/create-brewsite/src/scaffold.ts`) to copy `App.tsx` into the generated project's `src/` directory. Read the scaffolder source first to understand how templates are copied.

Also update the generated `package.json` template to include `camera-controls` as a dependency (per Section 6.4 documentation requirement).

### Task 5.7: Update CLAUDE.md

**Note reference:** Section 5.8 (HIGH)

File: `CLAUDE.md` (root).

**Action:** Find lines 62-63 which reference `createDefaultWidgetRegistry(manifest)`:
```
   - Exports: `ScenePlayer`, `useSceneEngine`, `useEngineScroll`, `useEngineInput`, `useEngineScrubber`, `useSceneProgress`, `useCurrentScene`, `EngineFrameDriver`, `EngineScrollRegion`, `EngineInputRegion`, `createDefaultWidgetRegistry`, `TimelineWidget`, `CameraControlPanel`.
   - `createDefaultWidgetRegistry(manifest)` wires the built-in core widgets (Lighting, Background, Environment, Floor, Camera, SceneMeta). Model and label widgets are registered separately via `@brewsite/model`.
```

Replace with:
```
   - Exports: `SceneEngine`, `SceneCanvas`, `EngineOverlayHost`, `ScrollStage`, `InputCoordinator`, `useSceneEngine`, `useEngineState`, `useEngineScrubber`, `useSceneProgress`, `useCurrentScene`, `corePlugin`, `TimelineWidget`, `EngineGate`, `BackgroundLayer`.
   - `corePlugin()` is the plugin factory that wires the built-in core widgets (Lighting, Background, Environment, Floor, Camera, SceneMeta). Model and label widgets are registered separately via `@brewsite/model` using `modelPlugin()`.
```

Also scan the rest of CLAUDE.md for any other outdated references (e.g., `EngineProvider`, `EngineScrollRegion`, `EngineInputRegion`, `EngineFrameDriver`) and update them to current names.

### Verification

```bash
# Verify zero EngineProvider refs remain (excluding changelogs)
grep -rn "EngineProvider" packages/ --include="*.ts" --include="*.tsx" --include="*.md" | grep -v CHANGELOG | grep -v MIGRATION | grep -v node_modules | wc -l
# Should be 0

# Verify templates compile
cd packages/npx/create-brewsite && pnpm typecheck
```

---

## MEDIUM Items — Included If Low-Effort

These are included in the plan but are **optional** — skip if they risk destabilizing the release.

### M.1: Add `eslint-disable` for Intentional `any` on `DslComponent` (WS-3 can do this)

File: `packages/core/src/widget/types.ts` line 45.

**Action:** Add the line above:
```ts
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly DslComponent: React.ComponentType<any>; // intentional: see JSDoc
```

### M.2: Fix `math/pose.ts` Self-Import (WS-2 can do this if touching math barrel)

File: `packages/core/src/math/pose.ts`.

**Action:** Read the file. If it imports from `./index`, change to import from the specific source module.

### M.3: Delete Diagram DEBT Shim (WS-3 already covers this)

Already in Task 3.4.7.

---

## Verification Criteria

### Green CI (BLOCKING)

```bash
pnpm install
pnpm typecheck   # Zero errors across all packages
pnpm test         # Zero failures across all packages
pnpm build        # Clean build of all packages
```

### Export Surface Audit

After all streams land, run:

```bash
# No test-only functions in public barrels
grep -rn "_resetSceneThemeRegistryForTesting\|_resetDiagramThemeRegistryForTesting\|_resetChartThemeRegistryForTesting" packages/*/src/index.ts
# Should be 0

# No @internal exports in public barrels
grep -rn "@internal" packages/*/src/index.ts
# Should be 0

# No EngineProvider in src (excluding changelogs)
grep -rn "EngineProvider" packages/*/src/ --include="*.ts" --include="*.tsx" | wc -l
# Should be 0

# No deprecated APIs remain
grep -rn "@deprecated" packages/core/src/player/index.ts packages/core/src/player/engineTypes.ts packages/core/src/widget/types.ts packages/core/src/player/EngineARContainer.tsx packages/core/src/compiler/blocks/inputController.tsx
# Should only show deprecations in other files that were NOT targeted for removal
```

### Documentation

- `packages/core/README.md` mentions `InputCoordinator`, not `ScrollInput`/`KeyboardInput`/`PointerInput`
- `packages/model/README.md` exists and shows `modelPlugin()` setup
- `packages/screens/README.md` exists and shows `screensPlugin()` setup
- `packages/npx/create-brewsite/templates/starter-scene.tsx` uses `Camera mode="orbit"`
- `packages/npx/create-brewsite/templates/App.tsx` exists
- `CLAUDE.md` references `corePlugin()`, not `createDefaultWidgetRegistry()`

### Peer Dependencies

- All published packages declare `react: ^18.0.0 || ^19.0.0`
- `packages/diagram/package.json` has `@brewsite/core` in `peerDependencies`, not `dependencies`
- Three.js range is widened from `^0.183.1`

---

## Summary Checklist

| # | Item | Stream | Priority | Section Ref |
|---|------|--------|----------|-------------|
| 1 | Fix 13 unused variable errors | WS-1 | BLOCKING | 1.1 |
| 2 | Fix claude-author init test | WS-1 | BLOCKING | 1.2 |
| 3 | Write screens plugin registration test | WS-1 | HIGH | 8.5 |
| 4 | Move test-reset fns to `/testing` sub-paths | WS-2 | BLOCKING | 2.1 |
| 5 | Remove `@internal` pipeline exports | WS-2 | BLOCKING | 2.2 |
| 6 | Export missing critical types | WS-2 | BLOCKING | 2.3 |
| 7 | Remove DevTools from main entry | WS-2 | BLOCKING | 2.4 |
| 8 | Remove `DofConfig = never` | WS-2 | BLOCKING | 2.5 |
| 9 | Remove carousel-scrubber internals from barrel | WS-2 | BLOCKING | 2.6-2.7 |
| 10 | Export missing camera types (DEBT) | WS-2 | BLOCKING | 8.1 |
| 11 | Audit model barrel exports | WS-2 | HIGH | 8.2 |
| 12 | EngineProvider→SceneEngine in WS-3 owned files | WS-3 | BLOCKING | 5.6 |
| 13 | Remove deprecated core APIs (~12 symbols) | WS-3 | HIGH | 4.1 |
| 14 | Remove deprecated diagram APIs | WS-3 | HIGH | 4.2 |
| 15 | Remove charts deprecated APIs (6 items) | WS-3 | HIGH | 4.3 |
| 16 | Make `sceneProgress` required | WS-3 | HIGH | 3.5 |
| 17 | Tighten `string` → `ThemeFamily` | WS-3 | HIGH | 3.3 |
| 18 | Use `ThemePolarity` in `ActiveTheme` | WS-3 | HIGH | 3.4 |
| 19 | Tighten `unknown` types | WS-3 | HIGH | 3.2 |
| 20 | Widen React peer dep to ^18 ∥ ^19 | WS-4 | HIGH | 6.1 |
| 21 | Move core to peerDeps in diagram | WS-4 | HIGH | 6.2 |
| 22 | Widen Three.js range | WS-4 | HIGH | 6.3 |
| 23 | Replace EngineProvider refs globally (excl. WS-3 files) | WS-5 | BLOCKING | 5.6 |
| 24 | Fix core README | WS-5 | BLOCKING | 5.1 |
| 25 | Write model README | WS-5 | BLOCKING | 5.2 |
| 26 | Write screens README | WS-5 | BLOCKING | 5.3 |
| 27 | Fix create-brewsite template | WS-5 | BLOCKING | 5.4 |
| 28 | Document camera-controls peer dep | WS-5 | HIGH | 6.4 |
| 29 | Add create-brewsite App.tsx template | WS-5 | HIGH | 5.5 |
| 30 | Update CLAUDE.md | WS-5 | HIGH | 5.8 |
| 31 | eslint-disable for intentional `any` | WS-3 | MEDIUM | 3.1 |
| 32 | Fix math/pose.ts self-import | WS-2 | MEDIUM | 7.8 |
| 33 | Delete diagram DEBT shim | WS-3 | MEDIUM | 8.3 |

---

## Shared File Conflict Prevention

The following table shows which developer owns which files. **No two developers should modify the same file.**

**Key principle:** WS-3 depends on WS-1 and WS-2, so Dev-2→Dev-3 conflicts on shared files are resolved by sequencing (Dev-2 merges first). Dev-5 EngineProvider replacements explicitly **exclude** all WS-3-owned files (Dev-3 handles those in Task 3.0).

| File | Owner | Notes |
|------|-------|-------|
| `packages/core/src/elements/carousel-scrubber/render.ts` | Dev-1 | |
| `packages/core/src/elements/view/ViewWidget.ts` | Dev-1 | |
| `packages/core/src/player/InputCoordinator.tsx` | Dev-1 | |
| `packages/core/src/widget/MaterialLoader.ts` | Dev-1 | |
| `packages/claude-author/__tests__/init.test.ts` | Dev-1 | |
| `packages/screens/src/__tests__/plugin.test.ts` (NEW) | Dev-1 | |
| `packages/core/src/theme/index.ts` | Dev-2 then Dev-3 | Dev-2 removes `_resetForTesting`; Dev-3 removes deprecated exports after WS-2 merges |
| `packages/core/src/elements/index.ts` | Dev-2 | |
| `packages/core/src/elements/carousel-scrubber/index.ts` | Dev-2 | |
| `packages/core/src/elements/camera/types.ts` | Dev-2 then Dev-3 | Dev-2 removes DofConfig; Dev-3 tightens ICameraInteractionDriver after |
| `packages/core/src/player/index.ts` | Dev-2 then Dev-3 | Dev-2 removes devtools; Dev-3 removes EngineState + deprecated aliases after |
| `packages/core/src/testing.ts` | Dev-2 | |
| `packages/diagram/src/index.ts` | Dev-2 | |
| `packages/diagram/src/testing.ts` (NEW) | Dev-2 | |
| `packages/charts/src/index.ts` | Dev-2 | Removes `@internal` exports, adds missing types, removes `ChartThemePair` |
| `packages/charts/src/testing.ts` (NEW) | Dev-2 | |
| `packages/model/src/index.ts` | Dev-2 | Adds missing types + model barrel audit |
| `packages/core/package.json` exports map | Dev-2 | **Only** exports map changes |
| `packages/diagram/package.json` exports map | Dev-2 | **Only** exports map changes |
| `packages/charts/package.json` exports map | Dev-2 | **Only** exports map changes |
| `packages/core/src/widget/types.ts` | Dev-3 | Deprecated interfaces + type tightening |
| `packages/core/src/widget/WidgetPlugin.ts` | Dev-3 | EngineProvider→SceneEngine in JSDoc |
| `packages/core/src/player/engineTypes.ts` | Dev-3 | Remove EngineState + EngineProvider→SceneEngine |
| `packages/core/src/player/SceneEngine.tsx` | Dev-3 | Remove deprecated props + EngineProvider→SceneEngine |
| `packages/core/src/player/EngineARContainer.tsx` | Dev-3 | Remove deprecated aliases + EngineProvider→SceneEngine |
| `packages/core/src/compiler/blocks/inputController.tsx` | Dev-3 | Remove deprecated props |
| `packages/core/src/compiler/sceneDslCompiler.ts` | Dev-3 | EngineProvider→SceneEngine only |
| `packages/core/src/theme/sceneThemeRegistry.ts` | Dev-3 | string→ThemeFamily |
| `packages/core/src/theme/types.ts` | Dev-3 | polarity→ThemePolarity + EngineProvider→SceneEngine |
| `packages/core/src/compiler/sceneTrackTypes.ts` | Dev-3 | sceneProgress required |
| `packages/diagram/src/player/diagramPlugin.ts` | Dev-3 | Remove deprecated `diagrams` field |
| `packages/charts/src/player/ChartTooltipOverlay.tsx` (DELETE) | Dev-3 | |
| `packages/charts/src/player/__tests__/ChartTooltipOverlay.test.tsx` (DELETE) | Dev-3 | |
| `packages/charts/src/elements/chart/stubs.ts` | Dev-3 | Remove deprecated `Chart` stub |
| `packages/charts/src/elements/chart/dsl.tsx` | Dev-3 | Remove `ChartProps`, `bounds` prop |
| `packages/charts/src/elements/chart/types.ts` | Dev-3 | Remove `ChartDSL` |
| `packages/charts/src/elements/chart/index.ts` | Dev-3 | Remove deprecated re-exports |
| `packages/charts/src/elements/chart/ChartWidget.ts` | Dev-3 | Remove deprecated `Chart` re-export |
| `packages/charts/src/elements/chart/compile.ts` | Dev-3 | Remove `bounds` fallback |
| `packages/charts/src/themes/index.ts` | Dev-3 | Remove deprecated `ChartThemePair` |
| `packages/diagram/src/elements/diagram/compiler/diagramRenderConstants.ts` | Dev-3 | DEBT shim |
| `packages/core/package.json` peerDeps | Dev-4 | **Only** peerDependencies changes |
| `packages/diagram/package.json` deps/peerDeps | Dev-4 | **Only** dependency section changes |
| `packages/model/package.json` peerDeps | Dev-4 | |
| `packages/charts/package.json` peerDeps | Dev-4 | |
| `packages/screens/package.json` peerDeps | Dev-4 | |
| All EngineProvider text replacements in src/ | Dev-5 | **Excludes** Dev-3 owned files (see Task 5.1 scope) |
| All README.md files | Dev-5 | |
| `packages/npx/create-brewsite/templates/*` | Dev-5 | |
| `packages/claude-author/templates/*` | Dev-5 | |
| `packages/claude-author/.claude/agents/*` | Dev-5 | |
| `CLAUDE.md` | Dev-5 | |

**Conflict resolution strategy:**
- **Dev-2 → Dev-3 on 3 shared files** (`theme/index.ts`, `camera/types.ts`, `player/index.ts`): Resolved by sequencing — WS-3 starts after WS-2 merges.
- **Dev-3 → Dev-5 on EngineProvider files**: Resolved by ownership split — Dev-3 handles EngineProvider replacement in the 6 files they already modify (Task 3.0); Dev-5 excludes those files.
- **Dev-2 → Dev-4 on package.json files**: Resolved by section ownership — Dev-2 touches only `exports` map; Dev-4 touches only `peerDependencies`/`dependencies` sections. These are separate JSON keys with no overlap.
