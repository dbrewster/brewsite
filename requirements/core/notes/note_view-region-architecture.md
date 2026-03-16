---
title: "View/Region Architecture for Cross-Module Composition"
doc_type: note
status: draft
owner: Toolkit Product
last_updated: 2026-03-15
change_history:
  - date: 2026-03-12
    author: Toolkit Product
    summary: "Initial note. Defines Region, View, and ViewLayoutManager architecture; specifies cross-package changes for core, diagram, model, charts, and slides; includes migration path from diagram-only grouping to shared region infrastructure."
  - date: 2026-03-12
    author: "PM-1 (Review)"
    summary: "Cross-referenced all source files. Added Section 1.1 documenting existing NVS infrastructure in core/layout/. Corrected RegionBounds to extend NVSRect. Fixed slides file paths (player/ not components/). Noted model uses CUSTOM_NODE_HANDLER not compile.ts for compilation. Added Section 5.3 on actual groupCompiler internals. Updated Section 6.1 to account for existing layout/ module. Annotated open questions with findings from code review."
  - date: 2026-03-12
    author: "PM-1 + PM-2 (Debate)"
    summary: "Resolved 8 challenges from PM-2 debate. Reframed Phase 1 as internal milestone (not standalone release). Split View DSL into standalone vs. managed authoring modes. Removed 'wheel' from v1; defined carousel geometry contract. Decided Option C (api.composeBounds) for compile-context propagation. Added chart center-point recomputation spec. Added backward-compat snapshot testing strategy. Reframed slides Phase 4 as conditional. Resolved Section 4 / carousel scene tension with explicit JSX repetition trade-off. All open questions resolved."
---

# View/Region Architecture for Cross-Module Composition

## 1. Context

The current page-level composition model is fragmented:

- `@brewsite/diagram` has `DiagramGroup`, but it mixes three concerns:
  1. structural containment,
  2. layout orchestration,
  3. group-specific rendering/interaction.
- `@brewsite/model`, `@brewsite/charts`, and `@brewsite/diagram` each already participate in NVS bounds (`x/y/w/h` or `nvsBounds`) but do not share a composition primitive.
- `Scene` is timeline/state sequencing, not a local spatial composition primitive.

Result: local multi-view presentation patterns (stack, carousel, queue) are hard to author across modules.

### 1.1 Existing NVS Infrastructure (Baseline)

Before proposing new region/view primitives, the existing shared NVS infrastructure in `packages/core/src/layout/` must be understood, as any new region types must compose with — not duplicate — these contracts.

**Core types** (`packages/core/src/layout/types.ts`):
- `NVSRect { x, y, w, h }` — canonical NVS bounding rectangle, [0..1] relative to AR-locked container. Origin: top-left.
- `NVSPosition { x, y }` — NVS point.
- `INVSBounded { readonly nvsBounds: NVSRect }` — widget SDK interface for widgets declaring sub-viewport regions. Implemented by `DiagramCanvasWidget`, `ChartWidget`, `ModelWidget`.

**Coordinate bridge** (`packages/core/src/layout/nvsCoordService.ts`):
- `NVSCoordService` — injected per-frame into `WidgetRenderContext`. Converts NVS → world-space via `toWorld(nvsX, nvsY, z)` and `toWorldSize(nvsW, nvsH)`. Pinned to compiled camera state via `NVSCameraParams` — user camera interaction does not affect NVS positions.
- `createNVSCoordService(camera: NVSCameraParams, width, height)` — pure-math factory, no Three.js dependency. `resolveNVSParamsFromCameraState(state)` extracts params from compiled `SceneCamera`.
- All three consumer packages (chart, model, diagram) use this service in their render/apply paths.

**Pure analytic bridge** (`packages/core/src/layout/nvsWorldBridge.ts`):
- Camera-free NVS ↔ world conversions: `nvsToWorldAnalytic()`, `worldToNvsAnalytic()`, `computeWorldDimensions()`.
- Safe for use in compile.ts files (no Three.js runtime dependency).

**Validation** (`packages/core/src/layout/nvsValidation.ts`):
- `validateNVSScalar()`, `validateNVSRect()`, `validateNVSPosition()` — dev-time range/overflow checks, no-ops in production.

**Key implication**: The proposed `RegionBounds` type should extend or alias `NVSRect`, not introduce a parallel rect contract. The existing `INVSBounded` interface is the natural integration point for any region-aware widget.

## 2. Decision

Adopt a three-layer composition model:

1. `Region` (base spatial primitive, nestable)
2. `View` (addressable region for presentable units)
3. `ViewLayoutManager` (arranges multiple views)

`Scene` remains temporal narrative sequencing.

`DiagramGroup` is treated as a diagram-scoped region container, but not as a literal alias of core `View`.

## 3. Core Model

### 3.1 Region

Purpose: reusable spatial container semantics independent of chart/model/diagram specifics.

Responsibilities:
- NVS bounds and fit-box behavior.
- padding/inset normalization.
- optional clipping/overflow policy (opt-in; default off).
- child ordering semantics for composition.
- pure compile-time geometry helpers (no Three.js, no React).

Non-responsibilities:
- timeline progression.
- diagram graph membership semantics.
- data rendering semantics (chart/model internals).

### 3.2 View

Purpose: a region that is a first-class, addressable presentation unit.

Responsibilities:
- stable identity.
- optional metadata for navigation/selection.
- container for a single renderable element (v1 constraint — see Section 12, Q1).

Views are nestable; they are not top-level only.

**Two authoring modes** (see Section 7 for examples):

1. **Standalone View** (no parent `ViewLayout`): `x/y/w/h` on `View` specifies the absolute NVS rect. The view is manually positioned.
2. **Managed View** (inside a `ViewLayout`): The layout manager controls `x/y` positioning. The author may optionally specify `w/h` as size hints to the layout manager. Authored `x/y` values are ignored — the layout policy is the sole source of truth for position.

### 3.3 ViewLayoutManager

Purpose: orchestrate multiple sibling views.

Responsibilities:
- layout policy selection (`stack`, `carousel`; later extensible).
- ordering/index mapping.
- per-view transform derivation for arrangement, including `layer` (z-order) assignment.
- `activeIndex` for carousel-style arrangements (compile-time per scene; see Section 4.1).

**Layout policy geometry contracts:**

`stack` — Views arranged linearly along a single axis.
- `direction`: `'horizontal'` (default) or `'vertical'`.
- Each view placed sequentially with `gap` spacing between.
- All views at same z-depth and same scale.
- Deterministic: view N is at offset `sum(widths[0..N-1]) + N * gap` along the axis.

`carousel` — Views arranged along a horizontal line with depth and scale attenuation based on distance from the active view.
- `activeIndex`: which view is "front" (0-indexed).
- Active view: centered horizontally within the layout rect, full scale (1.0), z = 0 (front).
- Adjacent views: offset horizontally by `±(activeWidth/2 + gap + adjacentWidth * scale/2)`, scaled down by `inactiveScale` (default 0.75), z receded by `zStep` (default 0.1 NVS units per position from active).
- Views further from active: continue the pattern with cumulative offset, cumulative z recession, and cumulative scale reduction.
- `layer` assignment: active view gets highest layer; layers decrease with distance from active.
- The math is symmetric around the active view.

Non-responsibilities:
- rendering internals of contained elements.
- scene sequencing.
- runtime-variable active index (deferred to future release; see Section 12, Q2).

## 4. Relationship to Scenes

`Scene` and `View` are intentionally different:

- `Scene`: temporal state step in a compiled track.
- `View`: spatial composition unit inside a scene.

Why not use scenes for this:
- Scene transitions are global timeline operations.
- Scene semantics include transition windows, progress manager behavior, and scene-level input concerns.
- Local spatial layout patterns should not require duplicating scene definitions — authors should not need to redefine every element just to change one element's position.

Conclusion: scenes are right-sized for chapter/beat flow, but over-scoped for local composition.

### 4.1 Carousel State and Scene Transitions

In v1, authors repeat the `<ViewLayout>` child tree in each scene definition, changing only `activeIndex`. This is intentional — the ViewLayout absorbs all positioning complexity so the only authoring variation is a single prop. JSX constant extraction can reduce the visual repetition; the compiler treats each scene's tree independently. The scene transition system provides the animation between arrangements.

What WOULD violate Section 4's intent: requiring authors to manually position every view differently in each scene, computing x/y/w/h by hand for each arrangement.

**Known trade-off: JSX tree repetition.** Multi-scene authoring for view layout transitions requires repeating the `<ViewLayout>` child tree across scenes. Each scene is an independent DSL tree in the compiler — there is no implicit state carry-over. With N carousel states and M views, the author writes N copies of the M-view tree. JSX constant extraction at the authoring layer can reduce visual repetition (e.g., extracting the view children to a shared array constant), but the compiler treats each scene's tree independently. This is a v1 trade-off; a future "scene inheritance" or "layout slot" mechanism could eliminate it, but that is out of scope.

Example — carousel cycling via scenes:

```tsx
// Authoring-layer constant to reduce repetition:
const carouselViews = <>
  <View id="v1"><Diagram id="arch" /></View>
  <View id="v2"><BarChart id="metrics" /></View>
  <View id="v3"><Model id="product" /></View>
</>;

<Scene key="carousel-slide-1">
  <ViewLayout kind="carousel" activeIndex={0} gap={0.04}>
    {carouselViews}
  </ViewLayout>
</Scene>

<Scene key="carousel-slide-2">
  <ViewLayout kind="carousel" activeIndex={1} gap={0.04}>
    {carouselViews}
  </ViewLayout>
</Scene>
```

The compiler pre-bakes the arrangement for each `activeIndex` value. Scene transitions animate between the two arrangements.

## 5. DiagramGroup Positioning

`DiagramGroup` remains diagram-specific, but adopts shared region infrastructure.

### 5.1 What stays diagram-specific

- node/group membership extraction.
- swimlane/cluster/boundary/container variants.
- edge-routing interactions with group bounds.
- diagram hover/interaction semantics.
- edge-light compilation (`compileEdgeLights()` — positions lights along group border centerlines based on border width, density, and z-offset).

### 5.2 What moves to shared region infrastructure

- bounds/padding/title-gap normalization helpers.
- generic containment math utilities (union bounds, child extent calculation).
- child-order handling for mixed node/group ordering.

Implementation rule:
- `DiagramGroup` compiles through shared `RegionContract` helpers, then adds diagram-only fields.

### 5.3 Current groupCompiler Internals (Reference)

The current implementation in `packages/diagram/src/elements/diagram/compiler/groupCompiler.ts` uses:

- `GroupBounds` internal type: `{ x, y, w, h, padding: [t, r, b, l], titleGap }`.
- `resolveGroupBoundsMap()` — recursive function that computes bounds for all groups bottom-up.
- `computeGroupBounds()` — inner function: computes union of child node bounds, recursively includes child group bounds via `unionBounds()`, then applies `groupPadding` and `titleGap` from `ResolvedLayout`.
- Defaults imported from `diagramLayoutConstants`: `DEFAULT_GROUP_PADDING: [0.1, 0.1, 0.1, 0.1]`, `DEFAULT_TITLE_GAP: 0.3`.
- **Two coordinate spaces**: auto-layout produces diagram-unit bounds (Y-up) pre-normalization; post-normalization converts to NVS fractions (Y-down, [0..1]). Manual layout starts in NVS directly.

The extractable helpers are: union-bounds calculation, padding application to a rect, and title-gap offset. The coordinate-space flip and diagram-unit semantics remain diagram-specific.

## 6. Required Module Changes

### 6.1 `@brewsite/core`

**Extend existing layout module** rather than creating a parallel `region/` directory. The `packages/core/src/layout/` module already owns NVS types, validation, and coordinate services. Region helpers belong here.

Add region primitives to the existing layout module:

- `packages/core/src/layout/regionTypes.ts` — `RegionPadding`, `RegionContract`, `ResolvedRegion`
- `packages/core/src/layout/regionNormalize.ts` — padding application, inset computation, bounds composition
- `packages/core/src/layout/regionLayout.ts` — layout policy resolution (stack, carousel)

`RegionBounds` should be defined as a type alias or extension of `NVSRect` — not a separate rect type:
```typescript
// RegionBounds IS NVSRect, not a parallel concept
type RegionBounds = NVSRect;
```

Add view DSL/compiler surface:

- `packages/core/src/compiler/blocks/viewDsl.tsx`
- `packages/core/src/compiler/blocks/viewLayoutDsl.tsx`

Handler registration follows the existing pattern in `packages/core/src/compiler/coreHandlers.ts`. Handlers for `View` and `ViewLayout` should be registered there — not in a separate `handlers/` directory, which does not exist in the current codebase. The existing pattern is handler functions co-located with their DSL blocks, registered centrally in `coreHandlers.ts`.

Add state contracts:

- `packages/core/src/compiler/viewTypes.ts`

Add runtime support (lightweight, compile-first):

- view layout resolution performed at compile-time into widget/view placement state.
- runtime consumes resolved placement with no per-frame layout solving by default.

Export strategy:
- export new DSL blocks from `packages/core/src/compiler/index.ts`.
- export region/view types from `packages/core/src/layout/index.ts` (existing barrel) and `packages/core/src/index.ts`.

### 6.2 `@brewsite/diagram`

Refactor `DiagramGroup` compile path:

- update `packages/diagram/src/elements/diagram/compiler/groupCompiler.ts`
  to consume shared core region helpers for bounds/padding logic.
- keep diagram-specific fields in `DiagramGroupState`.
- keep coordinate-space normalization (diagram-unit Y-up → NVS Y-down) in diagram code.

Keep DSL stable initially:
- no breaking rename of `<DiagramGroup>`.
- no forced migration for existing diagrams.

### 6.3 `@brewsite/model`

Align model placement to region/view containers:

- ensure `SceneModelInstanceState.nvsBounds` composes correctly when model is nested in view/region.
- use `api.composeBounds()` (see Section 6.6) in model compile path to resolve effective bounds from parent region/view when present.

**Implementation note**: Model compilation uses `CUSTOM_NODE_HANDLER` on `ModelWidget` (not a standalone `compile.ts` function). The NVS bounds extraction happens inside `ModelWidget`'s handler (lines ~632-682) and `mergeSnapshot()` (lines ~696-780). The model package does have a `compile.ts` but the main DSL-to-state path runs through the widget's custom handler.

Integration is a targeted change in the handler:
```typescript
// Before (current):
const nvsBounds = { x, y, w, h };
// After (with region composition):
const nvsBounds = api.composeBounds({ x, y, w, h });
```

Files likely touched:
- `packages/model/src/elements/model/ModelWidget.ts` (primary — custom node handler and mergeSnapshot)
- `packages/model/src/elements/model/types.ts`

### 6.4 `@brewsite/charts`

Align chart placement to region/view containers:

- compose `ChartState.nvsBounds` with parent view/region bounds via `api.composeBounds()`.
- preserve existing `x/y/w/h` authoring behavior when no parent region is present.

**Implementation note**: Chart compilation uses `compileChart()` in `compile.ts` which extracts `x/y/w/h` DSL props and builds `nvsBounds: NVSRect`, computing `nvsX = x + w/2`, `nvsY = y + h/2` as center-point convenience fields. The chart also derives `bounds.width = w`, `bounds.height = h` for geometry sizing. `ChartWidget` implements `INVSBounded` and uses `nvsBounds` for raycaster NDC clipping in `getNdc()`.

**Center-point recomputation rule**: When a chart is nested in a view, composition happens at **compile time**. The `compileChart()` function uses `api.composeBounds()` to produce the final absolute NVS rect. Center-point fields `nvsX` and `nvsY` are then derived from the *composed absolute rect*, not the authored local rect:

```typescript
const absoluteBounds = api.composeBounds({ x, y, w, h });
state.nvsBounds = absoluteBounds;
state.nvsX = absoluteBounds.x + absoluteBounds.w / 2;
state.nvsY = absoluteBounds.y + absoluteBounds.h / 2;
state.bounds.width = absoluteBounds.w;
state.bounds.height = absoluteBounds.h;
```

No runtime re-derivation is needed. The compiled state already contains correct absolute values, so `ChartWidget.getNdc()` continues to work unchanged.

Files likely touched:
- `packages/charts/src/elements/chart/compile.ts`
- `packages/charts/src/elements/chart/types.ts`
- `packages/charts/src/elements/chart/ChartWidget.ts`

### 6.5 `@brewsite/slides` (Conditional)

**Note**: `@brewsite/slides` exists in the repo with real code (compiler, player, widgets, themes, tests) but is not yet listed as a published package in CLAUDE.md's workspace table. This section is conditional on slides reaching published status.

Slides would become simpler by using view/layout primitives instead of bespoke layout projection.

**Current state**: `packages/slides/src/compiler/layoutCompiler.ts` is a pure function `compileLayout(input: LayoutInput): SlideRegion[]` that maps 5 layout types (`title`, `title-body`, `two-column`, `full-bleed`, `blank`) to NVS-coordinate `SlideRegion[]` arrays. It uses hardcoded constants (`TITLE_H=0.18`, `GUTTER=0.02`, `COL_GAP=0.04`) and handles overlay anchor positions. This is the primary candidate for replacement with `ViewLayoutManager` patterns.

Potential simplifications:
- map slide layout variants to prebuilt `ViewLayoutManager` patterns.
- replace hardcoded layout constants with region-normalized configuration.
- reduce or eliminate `SlideRegion` type in favor of `ResolvedRegion`.

Files likely touched:
- `packages/slides/src/compiler/layoutCompiler.ts`
- `packages/slides/src/player/SlidePlayer.tsx`
- `packages/slides/src/player/PresenterView.tsx`
- `packages/slides/src/types.ts` (`SlideRegion` type definition)

### 6.6 Compile-Context Propagation for Parent Region Bounds

This is the key architectural mechanism enabling Milestone 3 (cross-package integration). When a widget is compiled inside a `<View>`, the widget's handler needs access to the parent region's resolved bounds to compose local bounds into absolute NVS bounds.

**Decided: Option C — `CompileApi` exposes `composeBounds(localRect: NVSRect): NVSRect`.** Returns identity when no parent region is present.

**Mechanism:**
- `CompileApi` gains a `composeBounds(localRect: NVSRect): NVSRect` method.
- When no parent region exists (default), `composeBounds` is the identity function — returns `localRect` unchanged. This means all existing widget handlers produce identical output without modification.
- When inside a `<View>`, the view's compiler handler creates a child `CompileApi` whose `composeBounds` maps local [0..1] coordinates to the view's absolute NVS sub-rect.
- Composition math: `absolute.x = parent.x + local.x * parent.w`, `absolute.y = parent.y + local.y * parent.h`, `absolute.w = local.w * parent.w`, `absolute.h = local.h * parent.h`.
- Supports arbitrary nesting: each level's `composeBounds` chains with its parent's (the child function calls the parent function on its result).

**Why Option C over alternatives:**

*Option A (rejected): `CompileApi.parentRegion` field.* Simple but flat — only one level of nesting. Nested views require cloning `CompileApi` at each level, and every consumer handler must implement the composition math itself.

*Option B (rejected): Region context stack on `CompileHelpers`.* Supports nesting but uses mutable state (push/pop). Risk of mismatched push/pop in error paths. Harder to test and reason about.

*Option C advantages:* Encapsulates composition logic — child handlers don't know or care about parent details. Identity by default — zero impact on existing handlers. One-line integration for charts and models in Milestone 3. Pure functional — no mutable stack. Nestable — each level chains.

## 7. API Direction (Draft)

Two distinct authoring modes. Exact names can be finalized in PRD.

### 7.1 Standalone Views (Manual Placement)

When `View` is used without a parent `ViewLayout`, the author specifies the absolute NVS rect:

```tsx
<Scene key="side-by-side">
  <View id="left" x={0.02} y={0.05} w={0.46} h={0.9}>
    <Diagram id="architecture" />
  </View>
  <View id="right" x={0.52} y={0.05} w={0.46} h={0.9}>
    <BarChart id="metrics" />
  </View>
</Scene>
```

### 7.2 Managed Views (Layout-Controlled Placement)

When `View` is inside a `ViewLayout`, position (`x/y`) is controlled by the layout manager. Authors may optionally specify `w/h` as size hints. Authored `x/y` values are ignored.

```tsx
<Scene key="carousel-1">
  <ViewLayout kind="carousel" activeIndex={0} gap={0.04}>
    <View id="v1"><Diagram id="architecture" /></View>
    <View id="v2"><BarChart id="metrics" /></View>
    <View id="v3"><Model id="product" /></View>
  </ViewLayout>
</Scene>
```

**Resolution rule**: When `View` is inside a `ViewLayout`, the layout manager is the sole source of truth for positioning. The compiler emits a warning if `x` or `y` are explicitly set on a managed view.

### 7.3 DSL Pattern

`<View>` and `<ViewLayout>` follow the existing DSL block pattern: null-returning React components consumed by registered handlers in the compiler. The closest precedent is `<InputController>` and `<ProgressManager>` in `packages/core/src/compiler/blocks/`.

### 7.4 Diagram-Internal Composition

Diagram-internal composition remains valid and separate:

```tsx
<Diagram id="d1">
  <DiagramGroup id="cluster-a" variant="cluster">
    {/* node/group children */}
  </DiagramGroup>
</Diagram>
```

## 8. Phased Delivery

### Milestone 1: Shared Region Infrastructure (Internal — ships with Milestone 2)

This is an internal engineering prerequisite, not a standalone publishable release. No new authoring surface. No user-visible change.

- Implement region helpers in `packages/core/src/layout/` (not a new `region/` directory).
- Refactor diagram group bounds/padding internals to use these helpers.
- Zero DSL breaking changes.
- Verified by: `groupCompiler` regression tests + compilation snapshot baselines.

### Milestone 2: View + ViewLayoutManager (First Publishable Release)

The first release with user-facing value. Includes Milestone 1's work.

- Introduce `<View>` and `<ViewLayout>` DSL blocks.
- Register handlers in `coreHandlers.ts`.
- Implement `api.composeBounds()` on `CompileApi` (identity when no parent region).
- Support standalone and managed view modes.
- Layout modes: `stack` (horizontal/vertical), `carousel` (ring arrangement with compile-time `activeIndex`).
- Single renderable child per view.
- Add examples demonstrating both modes.

### Milestone 3: Cross-Package Integration

- Integrate `api.composeBounds()` into chart, model, and diagram widget handlers.
- All center-point and geometry-size fields derived from composed absolute bounds.
- Add examples proving mixed diagram/model/chart inside view layouts.

### Milestone 4: Slides Adoption (Conditional)

Conditional on `@brewsite/slides` reaching published package status. Not a gate for the view/region feature.

- Migrate slide layout compiler to view primitives.
- Reduce custom layout math and duplicate abstractions.

## 9. Backward Compatibility

- No removal of `DiagramGroup`.
- No removal of chart/model direct `x/y/w/h` authoring.
- Existing scenes must compile unchanged (enforced by snapshot tests — see Section 10).
- New view/region semantics are additive.
- `INVSBounded` interface remains unchanged; widgets inside views report their effective (composed) NVS bounds.
- `api.composeBounds()` is identity when no parent region exists, so existing handlers produce identical output without modification.

Potential future deprecations (not in initial rollout):
- deprecate duplicated layout math utilities once region helpers are fully adopted.

## 10. Testing Strategy

### Backward Compatibility Enforcement

- **Baseline corpus**: All scene files under `apps/examples/src/*/scenes/` (diagram, chart, simple, complex, meeting, lucid, two-bots, multi-animation).
- **Verification method**: Snapshot tests. Compile each baseline scene through `compileSceneTrack()` and assert the output `SceneTrack` matches a stored snapshot. Any change to compiled output fails the test.
- **Failure mode**: Snapshot mismatch triggers CI failure. Developer must either fix the regression or explicitly update the snapshot with justification in the commit message.
- **Scope**: Applies to Milestone 1 (groupCompiler refactor) and Milestone 3 (chart/model bounds composition). Milestone 2 (new DSL) is additive and does not touch existing compilation paths.

### Unit Tests

Core:
- Unit tests for region normalize and layout helpers (pure math, no Three.js).
- Compiler tests for nested region/view resolution.
- Verify `NVSRect` composition: child NVS bounds within parent region produce correct effective bounds.
- Verify `composeBounds()` is identity when no parent region context.
- Verify `composeBounds()` chains correctly through nested views.

Diagram:
- Regression tests ensuring `DiagramGroup` bounds and edge behavior remain stable after helper extraction.
- Verify `resolveGroupBoundsMap()` produces identical output when using shared region helpers vs. current inline math.

Model/Charts:
- Tests verifying effective bounds composition when nested in views/regions.
- Verify `INVSBounded.nvsBounds` returns the effective (composed) bounds, not the local bounds, when inside a view.
- Verify chart center-point fields (`nvsX`, `nvsY`) are derived from composed absolute rect.

### Integration Tests

- Examples under `apps/examples` showing mixed module composition in carousel/stack view layouts.

### Slides (Conditional)

- Slide layout tests verifying equivalent output with reduced custom logic.
- Compare `compileLayout()` output against equivalent `ViewLayoutManager` resolution.

## 11. Risks

- Overlap/confusion between diagram-local grouping and cross-module view composition.
  - Mitigation: keep separate DSL concepts; shared helpers only.
- Unexpected bounds composition behavior in nested regions.
  - Mitigation: explicit, tested composition rules and invariant checks via `composeBounds()`.
- Layout manager feature creep.
  - Mitigation: strict v1 scope (`stack`, `carousel`) and additive expansion. `wheel` deferred.
- `RegionBounds`/`NVSRect` duplication — introducing a parallel rect type that diverges from `NVSRect`.
  - Mitigation: define `RegionBounds` as alias of `NVSRect`; all region math operates on `NVSRect` directly.
- Parent-region context propagation — child widget handlers (especially `CUSTOM_NODE_HANDLER` on ModelWidget) need access to the parent region's resolved bounds during compilation.
  - Mitigation: `api.composeBounds()` mechanism (Section 6.6) designed before implementation. Identity function when no parent region, so existing handlers are unaffected.
- Carousel naming confusion — "carousel" with compile-only `activeIndex` may mislead authors expecting runtime interactivity.
  - Mitigation: documentation clearly states carousel arrangement is compile-time per scene; runtime cycling is a future capability. Error or warning if author attempts to bind `activeIndex` to a runtime variable.

## 12. Open Questions (Resolved)

All questions resolved during PM debate. Resolutions are recorded here for traceability.

1. **Should `View` allow multiple root children in v1, or require a single region child for stricter layout guarantees?**
   - **Resolution: Single renderable child per view in v1.** `INVSBounded` is per-widget, and each widget independently declares its own `nvsBounds`. Multiple children would require z-ordering and overlap-resolution. Single child eliminates this complexity. Multiple children can be considered in a future release once single-child usage patterns are validated.

2. **Should `ViewLayoutManager` expose runtime-controlled active index in v1, or compile-only static arrangement first?**
   - **Resolution: Compile-only static arrangement in v1.** Runtime-variable layout would require per-frame resolution, breaking the compile-once/O(1)-sample invariant of `SceneTrack`. Scene authors achieve carousel cycling by authoring multiple scenes with different `activeIndex` values (see Section 4.1). Runtime active-index can be evaluated as a future feature once compile-time patterns are proven.

3. **Should clipping be opt-in or default-on for `Region`?**
   - **Resolution: Opt-in. Default off.** No existing NVS clipping mechanism exists in core. Three.js clipping planes add per-frame GPU cost. Charts and models currently render without clipping (they trust authored bounds). Opt-in avoids performance regression for the common case.

4. **Do we need a dedicated z-order policy contract for overlapping views in carousel/wheel modes?**
   - **Resolution: No dedicated policy contract. Add optional `layer: number` field to `ResolvedRegion`, defaulting to 0.** Layout managers set layer values based on arrangement (e.g., carousel front = highest layer). Precedent: `SlideRegion.layer` already exists in slides. Diagram groups handle z-ordering via `GroupRenderer` using Three.js `renderOrder`.
