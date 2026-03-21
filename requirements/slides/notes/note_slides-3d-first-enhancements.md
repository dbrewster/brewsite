---
title: "Slides 3D-First Enhancements"
doc_type: note
owner: Toolkit Product
status: draft
updated: 2026-03-21
change_history:
  - date: 2026-03-20
    author: "Toolkit Product"
    summary: "Initial note created. Defined three enhancements: smart layout routing, scene-level lazy loading, AR/display sizing."
  - date: 2026-03-21
    author: "Toolkit Product (PM review)"
    summary: >
      Revised after PM-1/PM-2 debate. Key changes: (1) Enhancement #1: corrected CompileApi claim
      to use getNodeHandler() directly; added Known Limitations for nested component detection;
      removed contentType from SlideRegion type; added concrete sceneDsl merge algorithm and
      mixed-content behavior spec. (2) Enhancement #2: fixed loaded→isLoaded; moved scene
      membership from WidgetRegistry to RuntimeDriver/sceneTrackCompiler output; scoped to
      Phase 1 (eager + preload-ahead only — removed unload(), keepBehind, ILoadable changes);
      replaced EngineFrameState extension with useSceneLoadState() hook; fixed EngineGate
      description; added lifecycle ordering section with _refreshWidgetLists() integration point;
      changed semver to minor-with-opt-in; added explicit Phase 2 deferral for unload lifecycle.
      (3) Enhancement #3: acknowledged aspectRatio already exists; scoped to scaleMode and
      referenceWidth pass-through only; documented scaleMode default difference from EngineARContainer.
---

# Slides 3D-First Enhancements

This note specifies three enhancements that shift `@brewsite/slides` toward a 3D-first content model:

1. **Smart layout routing** — Layout slots automatically route content to 3D Views or HTML TextBoxes based on what the content is
2. **Scene-level lazy loading** — Per-slide asset loading with preload-ahead policy (Phase 1: eager + preload only; no unload)
3. **AR and display sizing** — Expose scaleMode and referenceWidth on SlidePlayer (aspectRatio already exists)

---

## 1. Smart Layout Routing

### The Problem Today

The `deckCompiler` wraps all `sceneDsl` content in a single fullscreen `<View x={0} y={0} w={1} h={1}>`. Layout regions produce `TextBox` elements for HTML overlay. The two layers are spatially independent — the author must manually align NVS coordinates between `sceneDsl` View sub-regions and the layout's HTML regions:

```tsx
// Today: manual NVS alignment (fragile, error-prone)
<Slide key="dash" sceneDsl={<>
  <Camera mode="world" position={[0, 1.5, 5]} />
  <Lighting><Ambient intensity={0.8} /></Lighting>
  <View x={0.52} y={0.22} w={0.44} h={0.56}>  {/* manually matched to right column */}
    <BarChart id="rev" data={revenueData} ... />
  </View>
</>}>
  <TwoColumnSlide title="Dashboard"
    left={<StatCard value="42K" label="Users" />}
    right={null}  {/* empty — chart shows through from canvas */}
  />
</Slide>
```

The author has to know that `TwoColumnSlide`'s right column compiles to approximately `{x: 0.52, y: 0.22, w: 0.44, h: 0.56}`, and manually set matching coordinates in `sceneDsl`. If the layout changes (different gutter, different title height), the View coordinates break silently.

### The Solution: Content-Type Routing in the Deck Compiler

The layout compiler already knows each region's NVS bounds. The enhancement: when a layout slot receives a **3D DSL element** (a component with a registered `NodeHandler` — BarChart, Diagram, Timeline3D, etc.), the compiler routes it to a `<View>` at that region's bounds instead of a `<TextBox>`. When it receives **HTML content** (text primitives, React components), it routes to a `TextBox` as today.

```tsx
// Enhanced: compiler routes automatically
<Slide key="dash">
  <TwoColumnSlide title="Dashboard"
    left={<StatCard value="42K" label="Users" />}
    right={<BarChart id="rev" data={revenueData} animateEntry />}
  />
</Slide>
```

The compiler sees:
- `left` contains HTML content (`StatCard` is a React component, no NodeHandler) → wraps in `TextBox` at left region bounds
- `right` contains a 3D DSL element (`BarChart` has a registered NodeHandler) → wraps in `<View>` at right region bounds

The author never writes `sceneDsl` or NVS coordinates. The layout handles it.

### How It Works: Compiler Changes

**Detection:** The compiler needs to determine whether a child is a 3D DSL element or an HTML component. Two approaches:

**Option A: NodeHandler registry check** — At compile time, use `getNodeHandler()` from `compiler/registry.ts` to check if the child element's type has a registered `NodeHandler`. If yes, it's 3D. If no, it's HTML. This function is a direct import — no changes to `CompileApi` are needed.

**Option B: Explicit marker** — 3D elements export a static property (e.g., `BarChart.__brewsite_dsl = true`) that the compiler checks without needing registry access.

**Recommendation: Option A.** `getNodeHandler()` already exists and is the canonical way to check whether a component has a registered handler. This is the architecturally clean path — no static markers, no new conventions.

**Compilation output:** For each layout region, the compiler produces either:
- A `TextBox` element (HTML overlay) — same as today
- A `View` element (3D canvas) — new, positioned at the region's NVS bounds

When a region contains **mixed content** (both 3D DSL elements and HTML content), the compiler emits both elements at the same region bounds: a `<View>` for the 3D elements and a `<TextBox>` for the HTML content. The TextBox renders as an overlay on top of the View at the same NVS position.

The content type (html, 3d, or mixed) is determined as a local variable within `buildSceneElements()` during compilation. It is **not** persisted on the `SlideRegion` type — `SlideRegion` remains a pure NVS-positioning struct.

**File changes:**

| File | Change |
|------|--------|
| `packages/slides/src/compiler/deckCompiler.tsx` | `buildSceneElements()` inspects each region's content via `getNodeHandler()`. If content is a registered DSL element, emit a `<View>` at the region's NVS bounds instead of a `<TextBox>`. For mixed content, emit both. |

### What Happens to `sceneDsl`

`sceneDsl` is **not removed**. It remains as an escape hatch for:
- Custom camera overrides per slide
- Custom lighting per slide
- 3D content that doesn't fit in a layout region (e.g., a background model, ambient particles)
- Advanced multi-View compositions that the layout compiler can't express

### Merge Algorithm: `sceneDsl` + Routed 3D Content

When both `sceneDsl` and layout-routed 3D content exist on the same slide, the compiler merges them using the following algorithm:

1. **Ambient elements are scene-global.** Camera, Lighting, Background, and Floor are registered with `NodeHandlerCategory: 'ambient'` — they are not scoped to any View. Whether they appear in `sceneDsl` or not, they apply to the entire scene including all routed Views. The deck compiler's default injections (Lighting, Floor, Background) serve as baseline; `sceneDsl` overrides replace them.

2. **sceneDsl spatial elements go in the default fullscreen View.** Any non-ambient 3D content in `sceneDsl` (models, particles, custom geometry) is placed in a `<View x={0} y={0} w={1} h={1}>` — the backdrop layer.

3. **Layout-routed Views are positioned at region NVS bounds.** Each region that contains 3D content gets its own `<View x={region.x} y={region.y} w={region.w} h={region.h}>`.

4. **Z-ordering:** The fullscreen sceneDsl View renders first (backdrop). Region-positioned Views render on top. TextBox HTML overlays render above all Views (they are in the CSS overlay layer, not the WebGL canvas).

### Camera and Lighting for Routed 3D Content

When the compiler routes 3D content into a View, the slide needs Camera and Lighting. Three options:

**Option A: SlidePlayer provides defaults.** The deck compiler already injects `<Lighting><Ambient intensity={1} /></Lighting>` per scene (line 750-752 of `deckCompiler.tsx`). It also injects `<Floor enabled={false}>` and `<Background>`. It does NOT inject a Camera — the engine has a default camera.

For slides with routed 3D content, the compiler should also inject a default Camera suitable for the layout:
```tsx
<Camera mode="world" position={[0, 1.5, 5]} target={[0, 0, 0]} fov={42} />
```

This default works for most chart/diagram/stat display content. Authors override via `sceneDsl` when they need a different camera.

**Option B: Per-element camera hints.** 3D elements like `BarChart` and `Diagram` already specify their own NVS bounds and position themselves in world-space. The camera just needs to be positioned to see all the content. The engine's camera framing already handles this — the camera sees all NVS-bounded content.

**Recommendation: Option A for simplicity.** Inject a sensible default camera. Authors override via `sceneDsl` when needed. Most slides won't need custom cameras.

### Known Limitations

1. **Nested React components wrapping 3D elements are not detected.** The `getNodeHandler()` check inspects only the top-level element type in a layout slot. A React component like `<StatCard>` that internally renders `<BarChart>` will be classified as HTML content, because `StatCard` itself has no registered NodeHandler. **Recommendation:** Authors should place 3D DSL elements directly in layout slots. Wrapping them in intermediary React components defeats automatic routing. This limitation should be documented in the slides authoring guide.

2. **Fragment children require iteration.** If a slot contains a React Fragment (`<>...</>`) with mixed children, the compiler must iterate the Fragment's children to classify each one. The implementation should handle this case.

### Example: Full 3D-First Slide Deck

```tsx
<SlidePlayer slideTheme={cinematicSlideTheme} template={acmeTemplate}>

  <Slide key="title">
    <TitleSlide title="Q1 Results" subtitle="March 2026" />
  </Slide>

  <Slide key="kpis">
    {/* BigNumberSlide could render 3D stat displays automatically */}
    <BigNumberSlide title="Key Metrics" stats={[
      { value: 42000, label: 'Active Users', trend: '+12%', trendDirection: 'up' },
      { value: 1200000, label: 'Revenue', trend: '+8%', trendDirection: 'up' },
      { value: 99.9, label: 'Uptime %', trend: '+0.1%', trendDirection: 'up' },
    ]} />
  </Slide>

  <Slide key="revenue">
    {/* BarChart routed to right column automatically */}
    <TwoColumnSlide title="Revenue Breakdown"
      left={<BulletList items={['SaaS grew 24%', 'Enterprise flat', 'Self-serve up 18%']} />}
      right={<BarChart id="rev" data={revenueData} animateEntry />}
    />
  </Slide>

  <Slide key="roadmap">
    {/* 3D timeline routed to body region automatically */}
    <ContentSlide title="Product Roadmap">
      <Timeline3D id="roadmap" items={milestones} orientation="horizontal" />
    </ContentSlide>
  </Slide>

  <Slide key="arch">
    {/* Diagram routed to body region automatically */}
    <ContentSlide title="System Architecture">
      <Diagram id="arch">
        <DiagramNode id="api" label="API Gateway" ... />
        <DiagramNode id="db" label="Database" ... />
        <DiagramEdge from="api" to="db" ... />
      </Diagram>
    </ContentSlide>
  </Slide>

  <Slide key="close">
    <ClosingSlide heading="Thank You" subtext="Questions?" />
  </Slide>

</SlidePlayer>
```

No `sceneDsl` anywhere. No manual NVS coordinates. The compiler handles routing charts, diagrams, and timelines to `<View>` regions and text to `<TextBox>` regions.

---

## 2. Scene-Level Lazy Loading (Phase 1: Eager + Preload)

### The Problem

`RuntimeDriver._loadAssets()` loads ALL `ILoadable` widgets across ALL scenes upfront. For a 30-slide deck with 3D charts, diagrams, and models on each slide, this means:
- Loading 30+ Three.js geometries, materials, textures, and fonts before slide 1 appears
- Potentially hundreds of megabytes of GLTF models and textures
- Long initial load time; wasted bandwidth for slides never viewed

### Proposed Architecture

**Package:** `@brewsite/core`
**Semver:** Minor with behavioral opt-in — when no `loadPolicy` is provided, existing "load all upfront" behavior is preserved. Scene-partitioned loading activates only when `loadPolicy` is explicitly set.

**New type:**

```typescript
interface SceneLoadPolicy {
  /**
   * Scene indices to load eagerly on engine init.
   * Default: undefined (load all — existing behavior).
   * For slides: [0, 1] (first two slides).
   */
  eager?: number[];

  /**
   * How many scenes ahead of the current scene to preload.
   * Default: 1. Preloading begins when the user arrives at the current scene.
   */
  preloadAhead?: number;
}
```

### How It Works

**Scene-to-widget membership tracking:**

Scene membership is a compilation-time concept — it depends on which scenes reference which widgets in the DSL. The membership mapping is produced as a **side-output of `compileSceneTrack()`** and stored on the `RuntimeDriver`, not on `WidgetRegistry` (which is a registration-time construct that should not carry compilation-derived state).

```typescript
// Side-output of compileSceneTrack()
type SceneMembership = Map<number, Set<string>>; // sceneIndex → Set<widgetId>

// Stored on RuntimeDriver after setSceneTrack()
readonly sceneMembership: SceneMembership;
```

During `compileSceneTrack()`, as each scene's DSL is compiled and widget state is set via `api.setWidgetState()`, the scene index is recorded against each widget ID.

**Lifecycle ordering:**

The current lifecycle is: `initialize()` → `_loadAssets()` (fire-and-forget) → `setSceneTrack()`. This means `_loadAssets()` fires before scene membership is known. The phased loading mechanism must account for this:

1. When no `loadPolicy` is configured: `_loadAssets()` in `initialize()` loads all widgets as today (backward compatible).
2. When `loadPolicy` is configured: `_loadAssets()` in `initialize()` is skipped (or loads nothing). Partitioned eager loading is triggered from `setSceneTrack()`, which already calls `_refreshWidgetLists()` (RuntimeDriver.ts:222) to handle late-discovered widgets. This existing refresh point is the natural integration point — when `setSceneTrack()` is called and scene membership becomes available, the RuntimeDriver triggers partitioned loading for the eager scenes.

**Phased asset loading in RuntimeDriver:**

```typescript
// Triggered from setSceneTrack() when loadPolicy is configured:

// Step 1: Load eager scenes (blocking — must complete before assetsReady)
const eagerScenes = policy.eager ?? [0];
await this.loadScenesAssets(eagerScenes);
this.setAssetsReady(true);

// Step 2: Preload on navigation (non-blocking — happens in background)
onSceneChange(newSceneIndex: number) {
  const ahead = Array.from(
    { length: policy.preloadAhead ?? 1 },
    (_, i) => newSceneIndex + 1 + i
  ).filter(i => i < totalScenes);

  for (const idx of ahead) {
    if (!this.loadedScenes.has(idx)) {
      this.loadSceneAssets(idx);  // async, non-blocking
    }
  }
}
```

Assets are loaded but **never unloaded** in Phase 1. Memory grows monotonically. This is acceptable for decks up to ~50 slides.

**Manifest caching:** RuntimeDriver must cache the `AssetManifest` received during `initialize()` so that `loadSceneAssets()` can pass it to each widget's `load(manifest)` call. This is also required for any future Phase 2 reload scenarios.

**Per-scene loading state:**

The engine exposes per-scene loading status via a dedicated hook, **not** on the existing engine state context (which uses primitive memo equality that `ReadonlySet` references would break):

```typescript
// New hook — separate from useEngineState()
function useSceneLoadState(): {
  /** Set of scene indices whose assets are fully loaded. */
  loadedScenes: ReadonlySet<number>;
  /** Set of scene indices currently loading. */
  loadingScenes: ReadonlySet<number>;
};
```

This hook reads from a dedicated `SceneLoadStateContext` provided by `SceneEngine`. `SlidePlayer` reads this internally to show a themed loading placeholder on slides whose 3D content is still loading. The HTML overlay (title, text) renders immediately — it doesn't require loading.

**Note on EngineGate:** The existing `EngineGate` component gates on `state.tickIndex < 0` (first tick), not on asset readiness. It does not need to change for Phase 1. Per-scene loading UI is handled by `SlidePlayer` reading `useSceneLoadState()`, not by EngineGate.

### ILoadable — No Changes in Phase 1

The existing `ILoadable` interface is unchanged:

```typescript
interface ILoadable extends IWidget {
  load(manifest: AssetManifest | null): Promise<void>;
  readonly isLoaded: boolean;
}
```

No `unload()` method is added. No `keepBehind` policy is supported. Widgets are loaded once and remain loaded for the lifetime of the engine instance.

### File Changes

| File | Change |
|------|--------|
| `packages/core/src/runtime/types.ts` | Add `SceneLoadPolicy` type. Add `SceneMembership` type. |
| `packages/core/src/runtime/RuntimeDriver.ts` | Scene-partitioned loading triggered from `setSceneTrack()`. Track `loadedScenes` / `loadingScenes`. Implement `loadScenesAssets()`. Cache manifest. Skip `_loadAssets()` in `initialize()` when `loadPolicy` is set. |
| `packages/core/src/player/SceneEngine.tsx` | Accept `loadPolicy` prop. Pass to RuntimeDriver. Provide `SceneLoadStateContext`. |
| `packages/core/src/player/useSceneLoadState.ts` | New hook: `useSceneLoadState()` reading from `SceneLoadStateContext`. |
| `packages/core/src/compiler/sceneTrackCompiler.ts` | Emit `SceneMembership` as a side-output of `compileSceneTrack()`. |

### SlidePlayer Integration

```tsx
<SceneEngine
  loadPolicy={{ eager: [0, 1], preloadAhead: 1 }}
  plugins={plugins}
>
  <SlidePlayer ...>
    {/* Slide 0 and 1 load immediately. Slide 2 preloads when user reaches slide 1. */}
  </SlidePlayer>
</SceneEngine>
```

`SlidePlayer` sets a sensible default `loadPolicy` automatically — the consumer doesn't need to think about it unless they want to tune preloading behavior.

### Test Plan

- Unit test: `compileSceneTrack()` produces correct `SceneMembership` mapping
- Unit test: `RuntimeDriver` loads only eager scenes initially, then preloads on scene change
- Unit test: When no `loadPolicy` is set, all widgets load upfront (backward compat)
- Unit test: `loadScenesAssets()` passes cached manifest to each widget's `load()`
- Integration test: EngineGate opens after eager scenes load, even if later scenes are still loading
- Integration test: `useSceneLoadState()` correctly reflects loading/loaded scene sets
- Performance test: 20-scene deck with `eager: [0, 1]` has initial load time proportional to 2 scenes, not 20

### Phase 2 (Deferred): Asset Unloading

Asset unloading (releasing Three.js objects to free memory) is **out of scope** for this enhancement. When memory pressure from large decks (>50 slides) becomes a measured problem, a separate PRD will specify:

- `ILoadable.unload?(): void` — optional method to release GPU resources
- `SceneLoadPolicy.keepBehind` — how many scenes behind current to keep loaded
- Shared asset reference counting — fonts, environment maps, and textures shared across scenes must not be destroyed while any consuming scene is still loaded
- Manifest caching for reload — `load()` takes a manifest parameter; the driver must provide it on re-entry after unload
- `useSceneLoadState()` update to reflect unloaded scenes

This phased approach delivers 90% of the user-facing benefit (fast initial load) at ~30% of the implementation complexity.

---

## 3. AR and Display Sizing

### Current State

`SlidePlayer` already accepts an `aspectRatio` prop (default: `16/9`) and passes it to the internal `EngineARContainer`. `EngineARContainer` already supports `aspectRatio`, `scaleMode`, and `referenceWidth` as props.

The remaining work is exposing `scaleMode` and `referenceWidth` as pass-through props on `SlidePlayer`.

### SlidePlayer Props (additions only)

```typescript
interface SlidePlayerProps {
  // ... existing props (including aspectRatio which already exists)

  /**
   * How the deck fits within the display. Default: 'contain'.
   *
   * NOTE: This default intentionally differs from EngineARContainer's own default
   * of 'fit-width'. Presentations use 'contain' because slide content should never
   * be cropped — letterboxing/pillarboxing is the industry-standard behavior for
   * fixed-aspect-ratio presentation decks.
   */
  scaleMode?: 'contain' | 'cover' | 'fit-width' | 'fit-height';

  /**
   * Reference width for content scaling. Default: 1920.
   * Content authored at this pixel width scales proportionally to all displays
   * via the --scene-scale CSS variable.
   */
  referenceWidth?: number;
}
```

**Behavior:**
- `scaleMode: 'contain'` (default) — letterbox/pillarbox to fit display, content never cropped.
- `referenceWidth: 1920` (default) — content authored at 1920px width scales proportionally.

**Layout compiler is already AR-independent** — NVS coordinates are [0,1] normalized. No layout changes needed for any AR or scale mode.

### File Changes

| File | Change |
|------|--------|
| `packages/slides/src/player/SlidePlayer.tsx` | Accept `scaleMode` and `referenceWidth` props. Pass to `EngineARContainer` (replacing the hardcoded `scaleMode="contain"`). |
| `packages/slides/src/types.ts` | Add `scaleMode` and `referenceWidth` to `SlidePlayerProps` type (if props type is defined there). |

---

## 4. Relationship to the Main Change Plan

These enhancements slot into the existing change plan phases:

| Enhancement | Phase | Notes |
|------------|-------|-------|
| Smart layout routing | **Phase 1B** (layout system) | The routing logic lives in `deckCompiler.tsx`'s `buildSceneElements()` function, which is already being rewritten for the new layouts. |
| Scene-level lazy loading (Phase 1) | **New Phase 0C** (core prerequisite) | Must land in `@brewsite/core` before slides with heavy 3D content are practical. Can be implemented in parallel with Phase 0A and 0B. |
| AR and display sizing | **Phase 1A** (SlidePlayer rewrite) | Simple prop pass-through. Trivial addition to the SlidePlayer rewrite. |

### Updated Implementation Sequence

```
0A  Core: SceneTheme + EngineOverlayHost CSS vars ──┐
0B  Themes: accentColor in scene presets ────────────┤
0C  Core: Scene-level lazy loading (Phase 1) ────────┤
                                                     │
                                                     ├─→ 1A  Slides: SlideTheme + SceneTheme + AR props
                                                     │    1B  Slides: Layout system + smart routing
                                                     │    1C  Slides: Graphics (3D elements + HTML)
                                                     │    1D  Slides: Animation hooks
                                                     │    1E  Slides: Expanded transitions
                                                     │
                                                     ├─→ 2A  Slides: SlideTemplate + brand assets
                                                     │
                                                     └─→ 3A  Claude-author: slides/ docs (12 files)
                                                          3B  Claude-author: gotchas + guide updates
```

Phase 0C is independent of 0A and 0B and can be implemented in parallel.
