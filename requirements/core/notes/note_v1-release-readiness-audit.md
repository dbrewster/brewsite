---
title: "v1 Release Readiness Audit"
doc_type: note
owner: Toolkit Product
status: complete
last_updated: 2026-03-18
change_history:
  - date: 2026-03-17
    author: "Toolkit Product"
    summary: "Initial audit note. Full pre-release audit across all published packages: core, diagram, model, charts, screens. Covers export hygiene, type quality, build health, DX, documentation, and DEBT inventory."
  - date: 2026-03-18
    author: "PM-1 Review"
    summary: "Cross-referenced 13+ BLOCKING/HIGH claims against source. All verified accurate. Corrected Section 3.1: DslComponent `any` is intentional per JSDoc — reframed as design decision to revisit, demoted to MEDIUM. No missing BLOCKING items found."
  - date: 2026-03-18
    author: "PM-1 + PM-2 Debate"
    summary: "Seven changes from adversarial review: (1) Promoted Section 5.6 EngineProvider references from HIGH to BLOCKING — runtime throws in charts reference deleted component. (2) Expanded 5.6 scope from core-only to all packages (39 files across core, charts, model, screens, diagram). Merged 5.7 into 5.6. (3) Made Section 6.1 React peer dep action concrete — determine minimum version, grep for React 19 APIs, take a position. (4) Added Section 6.4: undocumented `camera-controls` peer dependency in core. (5) Tightened Section 3.1 action: add eslint-disable + file v2 issue instead of open-ended research. (6) Added Section 2.1 implementation detail: `/testing` sub-paths require new barrel files + package.json exports map changes. (7) Added Section 10: Implementation Strategy recommending three parallel work streams."
---

# v1 Release Readiness Audit

## Purpose

This note captures every issue identified during the comprehensive pre-release audit of the BrewSite toolkit packages (`@brewsite/core`, `@brewsite/diagram`, `@brewsite/model`, `@brewsite/charts`, `@brewsite/screens`, plus CLI packages). The audit examined the public API surface, build health, type quality, developer experience, and documentation readiness.

**The code is the source of truth.** All findings reference specific files and line numbers.

**Intended audience:** The implementing architect and engineering team. Each section is self-contained and can be assigned independently.

---

## Section 1: Build Health (BLOCKING)

These issues prevent a clean CI pipeline. They must be resolved first as other work depends on a green build.

### 1.1 TypeCheck Failures — 13 Unused Variable Errors

`pnpm typecheck` fails due to unused variables in `@brewsite/core`. These surface when the docs-app tsconfig (stricter TS6133/TS6192 checking) compiles core source files.

| File | Unused Symbol | Line |
|---|---|---|
| `packages/core/src/elements/carousel-scrubber/render.ts` | `HL_DEFAULT_GLOW_INTENSITY` | — |
| `packages/core/src/elements/carousel-scrubber/render.ts` | `HL_DEFAULT_HOLOGRAPHIC_INTENSITY` | — |
| `packages/core/src/elements/carousel-scrubber/render.ts` | `updatePresetTextures` | — |
| `packages/core/src/elements/carousel-scrubber/render.ts` | `generateRoundedRectPoints` | — |
| `packages/core/src/elements/carousel-scrubber/render.ts` | Unused import declaration | ~line 35 |
| `packages/core/src/elements/carousel-scrubber/render.ts` | `particleOpacity` | ~line 554 |
| `packages/core/src/elements/carousel-scrubber/render.ts` | `color` | ~line 649 |
| `packages/core/src/elements/carousel-scrubber/render.ts` | `tickWidgetStates` | — |
| `packages/core/src/elements/view/ViewWidget.ts` | `SNAP_THRESHOLD` | — |
| `packages/core/src/elements/view/ViewWidget.ts` | `scene` | — |
| `packages/core/src/player/InputCoordinator.tsx` | `prevProg` | — |
| `packages/core/src/widget/MaterialLoader.ts` | `presetName` | — |

**Action:** Remove or prefix with `_` all unused declarations. If code is needed for a future feature, comment it out with a DEBT marker.

### 1.2 Test Failure — `@brewsite/claude-author` init CLI

`pnpm test` fails on `packages/claude-author/__tests__/init.test.ts`:

```
> "does not create .mcp.json": Expected `.mcp.json` to not exist, but it does.
```

Line 61 of `init.test.ts`. The init CLI is creating `.mcp.json` when the test expects it should not.

**Action:** Either fix the init CLI behavior (don't create `.mcp.json` in the tested scenario) or update the test expectation to match the current correct behavior.

---

## Section 2: Export Hygiene (BLOCKING)

These are the highest-impact pre-release issues. Once published, every symbol in the public barrel is a semver commitment. Removing anything after v1 requires a major version bump.

### 2.1 Test-Only Functions in Public API

Three packages leak test-reset functions into their public barrels:

| Package | Symbol | File |
|---|---|---|
| `@brewsite/core` | `_resetSceneThemeRegistryForTesting` | `packages/core/src/theme/index.ts` line 43 |
| `@brewsite/diagram` | `_resetDiagramThemeRegistryForTesting` | `packages/diagram/src/index.ts` line 102 |
| `@brewsite/charts` | `_resetChartThemeRegistryForTesting` | `packages/charts/src/index.ts` line 153 |

**Action:** Remove all three from their respective public barrels. Move them exclusively to the `@brewsite/core/testing` entry point (for core) or create equivalent `/testing` sub-path exports for diagram and charts. These functions should only be importable by test code. Note: `@brewsite/diagram` and `@brewsite/charts` do not currently have `/testing` sub-path exports. Implementation requires three steps per package: (1) create a `testing.ts` barrel file, (2) add `"./testing"` to the `exports` map in `package.json`, (3) move the `_resetXxxForTesting` function to the new barrel.

### 2.2 `@internal` Pipeline Functions Publicly Exported

Two packages export compiler/pipeline internals marked `@internal` in JSDoc:

**`@brewsite/diagram`** (`packages/diagram/src/index.ts` lines 71-72):
- `resolveLayout`
- `routeEdges`
- `compileNode`
- `compileEdge`
- `compileGroup`

**`@brewsite/charts`** (`packages/charts/src/index.ts` lines 57-68):
- `compileChart`
- `compileTooltipDsl`
- `compileBarChartOptions`
- (and other `compile*` functions)

**Action:** Either remove these from the public barrel entirely (preferred — they are labeled internal), or accept them as stable API and remove the `@internal` annotation. Do not ship both signals simultaneously.

### 2.3 Missing Critical Type Exports

Types that consumers need but cannot import:

**`@brewsite/core`:**
- `SceneTrack`, `SceneTrackTick`, `SceneFrame` — used by `WidgetRenderContext.tick`, `AnimationTickContext.tick`, `WidgetPlugin.onTrackCompiled`. Any custom widget or plugin author needs these. They must be exported from `@brewsite/core/widget` or `@brewsite/core/compiler`.

**`@brewsite/diagram`:**
- `DiagramNodeProps`, `DiagramEdgeProps`, `DiagramGroupProps`, `DiagramProps` — the four most important DSL prop types are NOT exported from `packages/diagram/src/index.ts`. Consumers building wrappers or dynamic node generation cannot type their props. Export all four.
- `DiagramThemeName` — referenced in documentation but not exported from package root. Either export it or document that consumers should import `ThemeFamily` from `@brewsite/core`.

**`@brewsite/model`:**
- `AxisRotation`, `AxisTranslation` — used in the exported `PoseProps` type. Consumers constructing `PoseProps` programmatically cannot import these.

**`@brewsite/charts`:**
- `ChartSeriesMaterialTokens`, `ChartAxisTokens`, `ChartBackgroundTokens` — needed by anyone implementing `ChartThemeOverrides`. Exported from `themes/types.ts` but not from the package barrel.

**Action:** Add all missing types to their respective package barrel exports.

### 2.4 DevTools Components Leaked into Main Entry

`packages/core/src/player/index.ts` (lines 87-93) exports `CameraControlPanel`, `CameraInteractionInfoDialog`, and `SceneInspector` from the main `@brewsite/core` entry point. These are also correctly exported from `@brewsite/core/devtools`.

**Action:** Remove `CameraControlPanel`, `CameraInteractionInfoDialog`, and `SceneInspector` from `player/index.ts`. The `/devtools` sub-path is the correct home. Shipping them in both locations creates a duplicate export that is harder to remove later.

### 2.5 Placeholder `DofConfig = never` Exported

`packages/core/src/elements/camera/types.ts` line 122:
```ts
export type DofConfig = never; // Phase 2 -- not yet implemented
```

This is re-exported through `elements/camera` into the public surface. Shipping `never` as a public type creates a semver commitment to a name that may be wrong when actually implemented.

**Action:** Remove the export. Add it when Phase 2 has a real design.

### 2.6 Carousel Scrubber Internal Types Leaked

`packages/core/src/elements/carousel-scrubber/index.ts` (lines 12-16) exports implementation details:
- `ShapePoint`
- `TrayShapeKind`
- `TrayGeometryParams`
- `TrayCoordService`
- `TrayPositionResult`

These are internal geometry/rendering types.

**Action:** Remove from the carousel-scrubber element's public barrel. If advanced consumers need them, create a documented extension point instead.

### 2.7 `compileCarouselScrubber` and `carouselScrubberTransitionSpec` Exported

`packages/core/src/elements/carousel-scrubber/index.ts` line 13.

These are compile-time internals used by the widget, not by scene authors.

**Action:** Remove from public barrel.

---

## Section 3: Type Quality (HIGH)

These issues don't block release but create API regret — designs that are painful to evolve without breaking changes.

### 3.1 `any` in Public Interface

`packages/core/src/widget/types.ts` line 45:
```ts
readonly DslComponent: React.ComponentType<any>; // intentional: see JSDoc
```

The code has an explicit JSDoc comment explaining why `any` is intentional: "Narrowing this type with a generic would propagate a TProps type parameter through the entire registry without adding safety." The registry uses the component as a lookup key, never calling it. While the rationale is valid, shipping `any` in a public interface is still an API quality risk — it leaks into consumer code via type inference.

**Action:** Add an `// eslint-disable-next-line @typescript-eslint/no-explicit-any` comment to make the intentional `any` explicit in lint tooling. The existing JSDoc rationale is sufficient. File a tracking issue to revisit for v2 whether `React.ComponentType<Record<string, unknown>>` or `React.ComponentType<never>` could replace the `any` without propagating a TProps generic through the registry. This is a MEDIUM priority — a design decision to revisit, not a bug.

### 3.2 `unknown` in Contexts That Should Be Generic

| Location | Field | Current Type | Recommended |
|---|---|---|---|
| `widget/types.ts` line 556 | `AnimationTickContext.resolvedState` | `unknown` | Make `AnimationTickContext<TState = unknown>` generic |
| `widget/types.ts` lines 12-16 | `AssetManifest.models` / `.animations` | `unknown[]` | At minimum `{ id: string; url: string }[]` |
| `camera/types.ts` line 292 | `ICameraInteractionDriver.attach(cameraObject)` | `unknown` | `PerspectiveCamera` (Three.js already imported in this file) |

**Action:** Tighten all three. Adding generics is non-breaking; narrowing `unknown` to a concrete type is also non-breaking.

### 3.3 `string` Where Union Type Expected

`packages/core/src/theme/sceneThemeRegistry.ts` lines 22-38:

`registerSceneThemePair` and `resolveSceneTheme` accept `family: string` instead of `ThemeFamily`. Consumers get no autocomplete or type checking on the family name.

**Action:** Change parameter type to `ThemeFamily | (string & {})` (allows extensibility while providing autocomplete for known families) or just `ThemeFamily`.

### 3.4 `ThemePolarity` Not Used in `ActiveTheme`

`packages/core/src/theme/types.ts` line 376:
```ts
export interface ActiveTheme {
  readonly family: ThemeFamily;
  readonly polarity: 'dark' | 'light';  // should reference ThemePolarity
}
```

**Action:** Use `readonly polarity: ThemePolarity` for consistency.

### 3.5 `SceneTrackTick.sceneProgress` Optional — Should Be Required

`packages/core/src/compiler/sceneTrackTypes.ts` line 389:
```ts
sceneProgress?: number;  // DEBT: Make this required in next major version
```

v1 IS the next major version.

**Action:** Make `sceneProgress` required now.

---

## Section 4: Deprecated API Cleanup (HIGH)

v1 is the one opportunity to remove deprecated APIs without a semver penalty. After v1, removing any of these requires a major version bump.

### 4.1 Core Deprecated APIs — Recommended for Removal

| Symbol | File | Superseded By |
|---|---|---|
| `ThemeKeyContext` | `theme/index.ts` lines 24-31 | `ActiveTheme` |
| `useThemeKey` | `theme/index.ts` lines 24-31 | `ActiveTheme` |
| `ThemeKey` | `theme/index.ts` lines 24-31 | `ActiveTheme` |
| `EngineState` | `player/engineTypes.ts` line 19 | `EngineFrameState` (same type, just aliased) |
| `ICameraActionTarget` | `widget/types.ts` line 164 | Marked "will be removed in v3" — remove now |
| `SceneEngineProps.sceneTheme` | `player/SceneEngine.tsx` line 89 | `SceneEngineProps.theme` |
| `SceneEngineProps.themeFamily` | `player/SceneEngine.tsx` line 95 | `SceneEngineProps.theme` |
| `SceneEngineProps.themePolarity` | `player/SceneEngine.tsx` line 103 | `SceneEngineProps.theme` |
| `PointerMapProps.drag` | `compiler/blocks/inputController.tsx` line 51 | `PointerMapProps.event` |
| `PointerMapProps.click` | `compiler/blocks/inputController.tsx` line 53 | `PointerMapProps.event` |
| `KeyMapProps.key` | `compiler/blocks/inputController.tsx` line 88 | Conflicts with React's reserved `key` prop — use `keys` |
| `EngineARContainerContextValue` | `player/EngineARContainer.tsx` line 86 | Deprecated alias referencing "v3" |
| `ViewportScaleContextValue` | `player/EngineARContainer.tsx` line 100 | Deprecated alias referencing "v3" |

**Action:** Remove all of the above before v1. No external consumers exist yet.

### 4.2 Diagram Deprecated APIs — Recommended for Removal

| Symbol | File | Superseded By |
|---|---|---|
| `DiagramPluginOptions.diagrams` | `player/diagramPlugin.ts` lines 13-22 | `diagramPlugin()` with no args |

**Action:** Remove the deprecated `diagrams` field and its runtime warning.

### 4.3 Charts Deprecated APIs — Triage Required

| Symbol | File | Recommendation |
|---|---|---|
| `Chart` component + `ChartProps` | `elements/chart/` | **Remove** — superseded by per-type components (`BarChart`, `LineChart`, etc.) |
| `ChartTooltipOverlay` + `ChartTooltipOverlayProps` | `player/ChartTooltipOverlay.tsx` | **Remove** — superseded by `ChartTooltip` + `ChartTooltipHost` |
| `ChartThemePair` type (deprecated alias) | `themes/` | **Remove** — superseded by registry |
| `ChartDSL` type alias | `types.ts` | **Remove** |
| `bounds` prop on `BaseChartDSL` | `dsl.tsx` lines 48-56 | **Keep with warning** for one minor version if any V1-beta consumers exist, otherwise remove |
| Dead `ChartTooltipOverlay.tsx` file | `player/ChartTooltipOverlay.tsx` | **Delete file** — not in barrel but ships in dist |

---

## Section 5: Documentation & DX (BLOCKING + HIGH)

### 5.1 BLOCKING — Core README Documents Non-Existent Components

`packages/core/README.md` (lines 166-173) lists `ScrollInput`, `KeyboardInput`, `PointerInput` as exported input components. These do not exist. The actual component is `InputCoordinator`.

**Action:** Rewrite the README's input section. Replace the three fake components with `InputCoordinator` and its actual props (`inertiaSensitivity`, `inertiaDecay`, `target`, `keyboardTarget`, `pauseWhenHidden`).

### 5.2 BLOCKING — Model Package Has No README

`packages/model/` has no `README.md`. A developer installing `@brewsite/model` from npm gets zero documentation.

**Action:** Write a README covering: installation, plugin setup (`modelPlugin()`), minimal scene example with `<Model>`, `<Animation>`, and `<Label>`, and link to full docs.

### 5.3 BLOCKING — Screens Package Has No README

`packages/screens/` has no `README.md`.

**Action:** Write a README covering: installation, plugin setup (`screensPlugin()`), minimal examples for `<Screen>`, `<MediaScreen>`, and `<ImagePanel>`.

### 5.4 BLOCKING — `create-brewsite` Template Won't Compile

`packages/npx/create-brewsite/templates/starter-scene.tsx` uses Camera props that don't match any current camera mode:
```tsx
<Camera x={0.5} y={0.5} w={1} h={1} fov={45} lookAtX={0} lookAtY={1} lookAtZ={0} distance={5} azimuth={0} polar={70} />
```

The current Camera DSL requires a `mode` discriminant (`'world'`, `'orbit'`, `'nvsViewport'`, etc.). Props like `lookAtX`, `x`, `y`, `w`, `h` are not part of any camera mode.

**Action:** Rewrite the template to use a valid camera configuration, e.g.:
```tsx
<Camera mode="orbit" distance={5} azimuth={0} polar={70} fov={45} />
```

### 5.5 HIGH — `create-brewsite` Has No App.tsx Template

The scaffolder only creates `src/scenes/intro.tsx` (a scene DSL file). It does not create the `App.tsx` or page component that sets up `SceneEngine`, plugins, `SceneCanvas`, etc. A new user would have a scene file but no idea how to render it.

**Action:** Add an `App.tsx` template that imports the scene, sets up `SceneEngine` with `corePlugin()`, and renders `ScenePlayer` or the manual `ScrollStage` + `SceneCanvas` + `EngineOverlayHost` composition.

### 5.6 BLOCKING — Error Messages and JSDoc Reference Deleted `EngineProvider`

39 files across all published packages reference `EngineProvider` instead of `SceneEngine`. This includes runtime error throws that will confuse v1 consumers with messages pointing to a component that does not exist.

**Core package** (~25 occurrences including runtime errors, JSDoc, and comments):

| File | Location |
|---|---|
| `packages/core/src/widget/useVariable.ts` | line 23: `throw new Error('[useVariable] must be used inside <EngineProvider>')` |
| `packages/core/src/player/useSceneRuntime.ts` | line 14: References `<EngineProvider id="...">` |
| `packages/core/src/player/EngineGate.tsx` | lines 17-28: JSDoc usage example |
| `packages/core/src/widget/WidgetPlugin.ts` | lines 13, 18, 23, 72-73: JSDoc referencing EngineProvider |
| `packages/core/src/player/plugins.ts` | line 51: JSDoc example |
| `packages/core/src/compiler/sceneDslCompiler.ts` | lines 442, 519, 529 |
| `packages/core/src/player/engineTypes.ts` | lines 22, 28 |
| `packages/core/src/player/ScenePlayerRegistry.ts` | line 71 |
| `packages/core/src/player/SceneEngine.tsx` | lines 2, 139, 222, 400 (internal comments — lower priority but should be cleaned) |
| `packages/core/src/player/EngineOverlayHost.tsx` | line 32 |
| `packages/core/src/player/serializeJsx.ts` | line 25 |
| `packages/core/src/theme/ThemeContext.ts` | line 1 |
| `packages/core/src/theme/types.ts` | line 324 |
| `packages/core/src/elements/carousel-scrubber/useCarouselHighlight.ts` | lines 11, 18 |

**Charts package** (8 occurrences including a runtime throw):

| File | Location |
|---|---|
| `packages/charts/src/data/ChartStoreContext.tsx` | line 20: **Runtime throw**: `'[ChartStoreContext] useChartStore() must be called inside an EngineProvider with chartPlugin().'` |
| `packages/charts/src/player/ChartProvider.tsx` | lines 45, 49, 53: JSDoc + code example |
| `packages/charts/src/player/chartPlugin.ts` | lines 136, 141, 145: JSDoc + code example |
| `packages/charts/README.md` | lines 64-80: Plugin Setup code example |

**Model package** (2 occurrences):

| File | Location |
|---|---|
| `packages/model/src/plugin.ts` | lines 22, 62: JSDoc |

**Screens package** (1 occurrence):

| File | Location |
|---|---|
| `packages/screens/src/index.ts` | line 2: barrel comment |

**Diagram package** (README):

| File | Location |
|---|---|
| `packages/diagram/README.md` | code example |

**Action:** Global find-and-replace `EngineProvider` with `SceneEngine` in all error messages, JSDoc, comments, and README code examples across **all** `packages/*/src/` directories and `packages/*/README.md` files. Exclude `CHANGELOG.md` and `MIGRATION.md` (historical references are correct in those files).

### 5.8 HIGH — `CLAUDE.md` References Deleted `createDefaultWidgetRegistry`

The project's `CLAUDE.md` still mentions `createDefaultWidgetRegistry(manifest)` as a key player export. This function no longer exists — the plugin system supersedes it.

**Action:** Update CLAUDE.md to describe the current plugin-based setup.

### 5.9 MEDIUM — No Minimal "Hello World" Example

The simplest entry point for a new user is buried inside larger showcases. A `hello-world/` or `minimal/` example directory would significantly help onboarding.

**Action:** Create a minimal example with ~30 lines showing a single scene with a camera, background, and lighting.

### 5.10 MEDIUM — Almost No `@default` Annotations on DSL Props

Only 1 `@default` JSDoc annotation found across all compiler DSL prop types. Optional props like `fov`, `worldScale`, `opacity`, etc. lack `@default` tags. TypeScript autocomplete tooltips won't show defaults.

**Action:** Add `@default` JSDoc annotations to all optional DSL props that have documented defaults.

### 5.11 MEDIUM — No `@example` JSDoc Tags on Primary DSL Components

Only `ProgressManager` has an `@example` tag. `Scene`, `Camera`, `Background`, `Lighting`, `Diagram`, etc. have none.

**Action:** Add `@example` JSDoc to the top 10 most-used DSL components.

---

## Section 6: Peer Dependencies (HIGH)

### 6.1 React Peer Dep Range Too Narrow

All packages declare `react: ^19.2.4`. This excludes React 18.x users entirely.

**Action:** Determine the minimum React version required. The implementing engineer should grep all `packages/*/src/` for React 19-specific APIs: `use()` (the new hook), `useActionState`, `useFormStatus`, `useOptimistic`, `useTransition` with async functions, React Server Component patterns, and `ref` as a prop (vs `forwardRef`). If only stable React 18 APIs are used, widen to `^18.0.0 || ^19.0.0` across all published packages. If React 19 features are required, document the React 19 requirement prominently in all READMEs and in the `create-brewsite` template's generated `package.json`.

### 6.2 `@brewsite/core` Should Be Peer Dep in Diagram

`packages/diagram/package.json` line 33 lists `@brewsite/core` as a regular `dependency` (not `peerDependency`). This means consumers could get duplicate copies of core — problematic since core has module-level state (theme registries, widget registries).

**Action:** Move `@brewsite/core` from `dependencies` to `peerDependencies` in diagram's `package.json`. The publish script already handles `workspace:*` resolution.

### 6.3 Three.js Range Is Narrow

All packages declare `three: ^0.183.1`. This pins to a very recent release.

**Action:** Evaluate minimum Three.js version actually required. If `^0.170.0` or similar works, widen the range.

### 6.4 `camera-controls` Peer Dependency Undocumented

`packages/core/package.json` line 67 declares `camera-controls: ^3.1.2` as a peer dependency. This is a relatively obscure library that consumers must install alongside `@brewsite/core`, but:
- It is not mentioned in `packages/core/README.md`
- It is not included in the `create-brewsite` template's generated dependencies
- A consumer running `npm install @brewsite/core` will get a peer dep warning with no guidance

**Action:** Either (a) document `camera-controls` as a required peer dependency in the core README's installation section and include it in the `create-brewsite` template, or (b) move it from `peerDependencies` to `dependencies` if tree-shaking and singleton concerns allow it. The architect should determine whether `camera-controls` has module-level state that requires a single instance (favoring peer dep) or is a pure utility (favoring regular dep).

---

## Section 7: Structural & Organizational (MEDIUM)

### 7.1 `SpotlightRig` Exported from Wrong Layer

`packages/core/src/player/index.ts` lines 96-106 export `SpotlightRig` DSL components and types. Element DSL surfaces should live under `elements/`.

**Action:** Move SpotlightRig exports to `elements/index.ts`.

### 7.2 `DiagramEdgePathDebug` Has Duplicate Fields

`packages/diagram/src/elements/diagram/types.ts` lines 926-951.

The interface has both `selectedFaces` (structured object) and `selectedSrcFace`/`selectedDstFace` (flat strings), plus both `selectedPorts` (structured) and `selectedSourcePortIndex`/`selectedDestinationPortIndex` (flat numbers). Looks like an incomplete migration.

**Action:** If this type is public, clean up the duplication. Keep one representation.

### 7.3 `DiagramTheme` Sub-Configs All Required

`packages/diagram/src/elements/diagram/types.ts` lines 38-406.

Building a custom `DiagramTheme` from scratch requires specifying ~60+ fields. `mergeTheme()` mitigates this, but the type is intimidating.

**Action:** Document that `mergeTheme()` is the intended way to create themes. Consider `DeepPartial`-friendly input types in a future minor.

### 7.4 Missing Sub-Path Exports

`packages/core/package.json` exports map has entries for `./player`, `./compiler`, `./widget`, `./elements`, `./runtime`, `./devtools`, `./testing` but not `./theme`, `./input`, `./layout`, `./math`, `./timeline`.

**Action:** Add sub-path exports for `./theme` and `./input` at minimum. Others can be deferred.

### 7.5 No Asset Sub-Path in Diagram

`packages/diagram/package.json` — the `files` array includes `public/assets/shapes` and `public/assets/envmaps`, but the exports map only has `"."`. Consumers loading SVG icons need deep paths.

**Action:** Add `"./assets/*"` sub-path export or document the convention.

### 7.6 `MaterialApplication` Type Not Re-Exported from Screens

`packages/screens/src/elements/image-panel/types.ts` and `media-screen/types.ts` use `MaterialApplication` from `@brewsite/core`. Consumers must know to import it separately.

**Action:** Either re-export from screens or document the cross-package import requirement.

### 7.7 Screens Renderer Classes Exported — Intentional?

`ScreenRenderer`, `compileScreen`, `functionalScreenTransitionSpec` (and equivalents for MediaScreen and ImagePanel) are all publicly exported. `ScreenRenderer` is a Three.js render-layer class.

**Action:** Decide if these are intended for advanced use. If not, remove from barrel. If yes, document.

### 7.8 `math/pose.ts` Self-Imports from Barrel

`packages/core/src/math/pose.ts` imports from `./index` (its own barrel). This creates a circular dependency risk.

**Action:** Replace with direct imports from the source module.

---

## Section 8: DEBT Inventory

The following DEBT markers exist in the codebase. Each represents known incomplete work that the architect should triage for v1 vs. post-v1.

### 8.1 Core Package DEBT

| File | DEBT Description | Triage Recommendation |
|---|---|---|
| `packages/core/src/elements/index.ts` line 58 | "Missing exports for ICameraHost, CameraInteractionDefaults, FitBotHeightCamera, FitFloorDepthCamera, WorldSpaceCamera, OrbitCamera" | **v1** — These are commonly needed types. Export them. |
| `packages/core/src/compiler/sceneTrackTypes.ts` line 389 | "`sceneProgress` should be required in next major version" | **v1** — v1 IS the next major. Make it required. |
| `packages/core/src/elements/carousel-scrubber/render.ts` | Multiple unused variables (7 items) — leftover from refactoring | **v1** — Must fix for typecheck to pass (Section 1.1). |
| `packages/core/src/elements/view/ViewWidget.ts` | `SNAP_THRESHOLD` unused, `scene` unused | **v1** — Must fix for typecheck (Section 1.1). |
| `packages/core/src/player/InputCoordinator.tsx` | `prevProg` unused | **v1** — Must fix for typecheck (Section 1.1). |
| `packages/core/src/widget/MaterialLoader.ts` | `presetName` unused | **v1** — Must fix for typecheck (Section 1.1). |

### 8.2 Model Package DEBT

| File | DEBT Description | Triage Recommendation |
|---|---|---|
| `packages/model/src/elements/model/index.ts` | "DEBT: Audit which symbols here should be promoted to the public src/index.ts barrel" — 12+ unexported symbols including `ModelPartId`, `ModelPartAnchor`, `ModelPartOverrides`, `PoseGroup`, `ModelPose`, `MotionGroupLimits`, `CustomAnimationContext`, `CustomAnimationOp`, `SceneMotion`, `CompiledAnimation`, `ASSET_MANIFEST_VERSION`, `modelTransitionSpec`, `playbackTransitionSpec`, `compileAnimation`, `resolveClipRangeSeconds`, `poseGroupTransition`, `blendBodyOverrides`, `applyModelTransform`, `ModelRenderer` | **v1** — Audit and promote necessary symbols before the barrel is locked by semver. |
| `packages/model/src/plugin.ts` line 81 | Missing tests for error paths | **Post-v1** — Not blocking but a gap in test coverage. |
| `packages/model/src/elements/model/modelDslHandler.ts` line 137 | Untested fallback path | **Post-v1** |
| `packages/model/src/elements/model/modelBlend.ts` line 295 | Code duplication to extract | **Post-v1** |
| `packages/model/src/elements/model/ModelRenderer.ts` line 376 | Hardcoded config value | **Post-v1** |
| `packages/model/src/elements/model/ModelRenderer.ts` | Additional DEBT markers for material handling | **Post-v1** |
| `packages/model/src/elements/model/modelBlend.ts` | Additional duplication markers | **Post-v1** |

### 8.3 Diagram Package DEBT

| File | DEBT Description | Triage Recommendation |
|---|---|---|
| `packages/diagram/src/elements/diagram/compiler/diagramRenderConstants.ts` | "This shim will be removed" — deprecated re-export shim | **v1** — Either remove it or stop claiming it will be removed. Not in public barrel (good). |
| `packages/diagram/src/elements/diagram/compiler/edgeCandidateScorer.ts` line 18 | TODO: distinguish penetration-depth penalty | **Post-v1** — Optimization. |

### 8.4 Charts Package DEBT

| File | DEBT Description | Triage Recommendation |
|---|---|---|
| `packages/charts/src/player/ChartTooltipOverlay.tsx` | Dead file — deprecated component not in barrel but ships in dist | **v1** — Delete the file. |

### 8.5 Screens Package DEBT

| File | DEBT Description | Triage Recommendation |
|---|---|---|
| `packages/screens/src/plugin.ts` | No test file for plugin registration logic | **v1** — Write a test for `configureRegistry`. The plugin's lazy widget creation and `registerNode` calls are untested. |

### 8.6 Cross-Package DEBT

| Item | Description | Triage Recommendation |
|---|---|---|
| `console.warn` statements | ~50+ across core, diagram, model, charts — runtime warnings for missing assets, invalid config, fallback behavior | **Post-v1** — Consider a structured logging/warning system in a future release. |
| `--passWithNoTests` flag | Present in charts and screens `package.json` test scripts | **Post-v1** — Can mask missing tests. Remove once all packages have tests. |

---

## Section 9: Summary Checklist

### Must Complete Before v1 (BLOCKING)

- [ ] Fix 13 unused variable type errors (Section 1.1)
- [ ] Fix claude-author init test (Section 1.2)
- [ ] Remove 3 test-reset functions from public barrels; create `/testing` sub-paths for diagram + charts (Section 2.1)
- [ ] Remove or stabilize `@internal` pipeline exports (Section 2.2)
- [ ] Export missing critical types: SceneTrack/SceneFrame, DiagramNodeProps/EdgeProps/GroupProps/Props, AxisRotation/AxisTranslation, chart theme tokens (Section 2.3)
- [ ] Remove DevTools from main entry (Section 2.4)
- [ ] Remove `DofConfig = never` (Section 2.5)
- [ ] Remove carousel-scrubber internal types from barrel (Section 2.6-2.7)
- [ ] Fix core README (Section 5.1)
- [ ] Write model README (Section 5.2)
- [ ] Write screens README (Section 5.3)
- [ ] Fix create-brewsite template (Section 5.4)
- [ ] Replace all `EngineProvider` references with `SceneEngine` across all packages (Section 5.6)

### Should Complete Before v1 (HIGH)

- [ ] Tighten `unknown` types in widget/camera contexts (Section 3.2)
- [ ] Fix `string` → `ThemeFamily` in registry (Section 3.3)
- [ ] Make `sceneProgress` required (Section 3.5)
- [ ] Remove deprecated APIs (Section 4)
- [ ] Update CLAUDE.md (Section 5.8)
- [ ] Determine React peer dep minimum version (Section 6.1)
- [ ] Move core to peerDeps in diagram (Section 6.2)
- [ ] Document or internalize `camera-controls` peer dep (Section 6.4)
- [ ] Add create-brewsite App.tsx template (Section 5.5)
- [ ] Audit model barrel exports (Section 8.2, first item)

### Can Ship After v1 (MEDIUM/LOW)

- [ ] Add eslint-disable for intentional `any` on DslComponent + file v2 issue (Section 3.1)
- [ ] Add `@default` / `@example` JSDoc (Section 5.10-5.11)
- [ ] Add hello-world example (Section 5.9)
- [ ] Fix structural issues (Section 7)
- [ ] Address remaining DEBT items (Section 8, post-v1 items)
- [ ] Structured logging system for console.warn

---

## Section 10: Implementation Strategy

The audit identifies ~25 BLOCKING + HIGH items. To make this tractable, the architect should decompose into three parallel work streams:

### Stream 1: Build Health + Export Hygiene + Type Fixes (Low Risk, Mechanical)

Sections 1, 2, 3.5, and v1 DEBT items from Section 8.

These are mechanical changes: removing unused variables, adjusting barrel exports, adding missing type exports, creating `/testing` sub-paths. Low risk of regression. Can be done in a single pass across all package barrels.

**Dependencies:** None. Can start immediately.

### Stream 2: API Cleanup + Deprecated Removal + Peer Dependencies (Medium Risk, Design Decisions)

Sections 3 (remaining), 4, and 6.

These require design decisions: which deprecated APIs to remove, what React version range to support, whether `camera-controls` should be a peer dep, and what to do with `@internal` exports. Some items may require testing across example apps to verify no breakage.

**Dependencies:** Should start after Stream 1 lands, since barrel changes in Stream 1 affect which deprecated symbols are still reachable.

### Stream 3: Documentation + DX + Templates (Low Risk, Independent)

Sections 5 (READMEs, CLAUDE.md, templates, EngineProvider references), and Section 5.6 (global find-replace).

Mostly prose and template code. Independent of Streams 1 and 2. The EngineProvider find-replace (Section 5.6) is the highest-priority item in this stream — it is BLOCKING.

**Dependencies:** None. Can run in parallel with Stream 1.

---

## Section 11: Approved Deviations

Two items from the audit were not completed and are documented as approved deviations:

### 11.1 `SceneEngineProps.sceneTheme` Prop Kept

**Item:** Section 4.1 recommended removing the deprecated `sceneTheme` prop from `SceneEngineProps`.

**Decision:** Keep. The `sceneTheme` prop is actively used by `SlidePlayer` and `SceneReel` to pass a resolved `SceneTheme` object directly, bypassing the `ActiveTheme` registry resolution path. Removing it would break these components. The `@deprecated` annotation remains as a signal to prefer the `theme` prop for new integrations.

### 11.2 `AssetManifest` Field Tightening Deferred

**Item:** Section 3.2 recommended tightening `AssetManifest.models` and `.animations` from `unknown[]` to `{ id: string; url: string }[]`.

**Decision:** Deferred. `@brewsite/model`'s `ModelMeta` type (which is used to populate `AssetManifest` entries) has a richer shape that is incompatible with the proposed `{ id: string; url: string }[]` narrowing. Tightening the type would either break `@brewsite/model`'s usage or require introducing a generic `AssetManifest<TModel, TAnimation>`, which is a larger cross-package design change. This is tracked for a future minor release after the `AssetManifest` contract is redesigned to accommodate all consumer packages.
