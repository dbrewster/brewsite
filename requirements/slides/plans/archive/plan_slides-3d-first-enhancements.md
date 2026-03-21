---
title: "Slides 3D-First Enhancements — Implementation Plan"
doc_type: plan
owner: Architecture
status: complete
updated: 2026-03-21
---

# Slides 3D-First Enhancements — Implementation Plan

## Overview

Three enhancements that shift `@brewsite/slides` toward a 3D-first content model:

1. **Smart Layout Routing** — The deck compiler auto-routes 3D DSL elements to `<View>` regions and HTML content to `<TextBox>` regions based on `getNodeHandler()` detection.
2. **Scene-Level Lazy Loading (Phase 1)** — `SceneLoadPolicy` with `eager` and `preloadAhead`. No unload. Scene membership tracked as side-output of compilation.
3. **AR/Display Sizing** — Expose `scaleMode` and `referenceWidth` as pass-through props on `SlidePlayer`.

---

## Parallel Work Streams

These three enhancements have clean separation:

| Stream | Enhancement | Package(s) | Shared Files |
|--------|------------|------------|-------------|
| **A** | Smart Layout Routing | `@brewsite/slides` | None |
| **B** | Scene-Level Lazy Loading | `@brewsite/core` | None |
| **C** | AR/Display Sizing | `@brewsite/slides` | `SlidePlayer.tsx` (trivial) |

**Streams A and B have zero shared files and can run in full parallel.** Stream C touches `SlidePlayer.tsx` which Stream A also reads but does not modify — C modifies only the props interface and the `<EngineARContainer>` call. C can run in parallel with A and B.

Up to 3 parallel developers. Streams A and B are substantial; Stream C is trivial (< 1 hour).

---

## Enhancement #1: Smart Layout Routing

### Concept

Today, `buildSceneElements()` in `deckCompiler.tsx` wraps all region content in `<TextBox>` elements. The author must use the `sceneDsl` prop to manually place `<View>` elements at manually-computed NVS coordinates.

After this enhancement, the compiler inspects each region's content children. If a child's React element type has a registered `NodeHandler` (checked via `getNodeHandler()` from `packages/core/src/compiler/registry.ts`), it's a 3D DSL element and gets routed to a `<View>`. Otherwise it's HTML and goes to a `<TextBox>`.

### Detection Algorithm

```typescript
import { getNodeHandler } from '@brewsite/core';

type RegionContentType = 'html' | '3d' | 'mixed';

/**
 * Classifies the content of a layout region by inspecting the top-level
 * React element types. A child is "3D" if getNodeHandler(child.type) returns
 * a handler. Everything else is "HTML".
 *
 * Fragment children are expanded. Nested components wrapping 3D elements
 * are NOT detected — only direct children are inspected.
 */
function classifyRegionContent(children: React.ReactNode): {
  contentType: RegionContentType;
  htmlChildren: React.ReactNode[];
  dslChildren: React.ReactNode[];
}
```

**Rules:**
1. `children` is flattened: `React.Children.toArray()` applied, Fragments expanded one level.
2. Each child is tested: `isValidElement(child) && getNodeHandler(child.type) !== undefined`.
3. If all children are 3D → `contentType: '3d'`.
4. If all children are HTML → `contentType: 'html'`.
5. If mixed → `contentType: 'mixed'`.
6. Non-element children (strings, numbers, null) are classified as HTML.

**The `contentType` is a local variable within `buildSceneElements()`. It is NOT stored on `SlideRegion`.** `SlideRegion` remains a pure NVS-positioning struct with fields: `id`, `x`, `y`, `w`, `h`, `layer`.

### File Changes

#### `packages/slides/src/compiler/deckCompiler.tsx`

**New import** (add at top, after existing `@brewsite/core` imports):

```typescript
import { getNodeHandler } from '@brewsite/core';
```

> Verify this is exported from `@brewsite/core`'s public barrel. If not, import from `@brewsite/core/compiler/registry` — but the barrel should already export it. Check `packages/core/src/index.ts` for `getNodeHandler`.

**New helper function** — add after the `countAnimatedListItems` function (around line 165):

```typescript
// ─── Content Type Classification ─────────────────────────────────────────────

type RegionContentType = 'html' | '3d' | 'mixed';

type ClassifiedContent = {
  contentType: RegionContentType;
  htmlChildren: React.ReactNode[];
  dslChildren: React.ReactNode[];
};

/**
 * Classifies region content into HTML vs 3D DSL elements.
 * 3D elements are identified by having a registered NodeHandler.
 *
 * Fragment children are expanded one level. Nested React components
 * that internally render 3D elements are NOT detected — only the
 * top-level element type is inspected.
 *
 * @param children - The ReactNode content of a layout region slot.
 * @returns Classification result with separated children arrays.
 */
function classifyRegionContent(children: React.ReactNode): ClassifiedContent {
  const htmlChildren: React.ReactNode[] = [];
  const dslChildren: React.ReactNode[] = [];

  // Flatten one level of Fragments
  const flatChildren: React.ReactNode[] = [];
  Children.forEach(children, (child) => {
    if (isValidElement(child) && child.type === React.Fragment) {
      // Expand fragment children
      Children.forEach(
        (child.props as { children?: React.ReactNode }).children,
        (fragmentChild) => flatChildren.push(fragmentChild),
      );
    } else {
      flatChildren.push(child);
    }
  });

  for (const child of flatChildren) {
    if (isValidElement(child) && getNodeHandler(child.type) !== undefined) {
      dslChildren.push(child);
    } else {
      htmlChildren.push(child);
    }
  }

  const has3d = dslChildren.length > 0;
  const hasHtml = htmlChildren.length > 0;
  const contentType: RegionContentType =
    has3d && hasHtml ? 'mixed' :
    has3d ? '3d' :
    'html';

  return { contentType, htmlChildren, dslChildren };
}
```

**Modification to `buildSceneElements()`** — the region rendering loop (currently lines ~462–740) currently always emits a `<TextBox>` per region. Change the emission logic to:

For each region in `slideSpec.regions`, after computing `regionContent`:

1. **Classify the region content** using `classifyRegionContent(regionContent)`.
2. **Emit based on `contentType`:**

```typescript
// After regionContent is determined for this region:
const classified = classifyRegionContent(regionContent);

if (classified.contentType === 'html') {
  // Existing path: emit a TextBox
  return React.createElement(
    TextBox,
    {
      key: `${slideSpec.key}-${region.id}`,
      id: `${slideSpec.key}-${region.id}`,
      x: region.x, y: region.y, w: region.w, h: region.h,
      layer: region.layer,
    },
    regionContent,
  );
} else if (classified.contentType === '3d') {
  // New path: emit a View at the region's NVS bounds
  return React.createElement(
    View,
    {
      key: `${slideSpec.key}-${region.id}-view`,
      id: `slide-view-${slideSpec.key}-${region.id}`,
      x: region.x, y: region.y, w: region.w, h: region.h,
    },
    ...classified.dslChildren,
  );
} else {
  // Mixed: emit BOTH a View and a TextBox at the same region bounds.
  // View renders in the 3D canvas; TextBox renders in the CSS overlay on top.
  return React.createElement(
    React.Fragment,
    { key: `${slideSpec.key}-${region.id}-mixed` },
    React.createElement(
      View,
      {
        key: `${slideSpec.key}-${region.id}-view`,
        id: `slide-view-${slideSpec.key}-${region.id}`,
        x: region.x, y: region.y, w: region.w, h: region.h,
      },
      ...classified.dslChildren,
    ),
    React.createElement(
      TextBox,
      {
        key: `${slideSpec.key}-${region.id}-text`,
        id: `${slideSpec.key}-${region.id}`,
        x: region.x, y: region.y, w: region.w, h: region.h,
        layer: region.layer,
      },
      ...classified.htmlChildren,
    ),
  );
}
```

**Important implementation detail:** The classification must happen on the *final* `regionContent` ReactNode, not on the raw `layoutInfo.contentChildren`. The current code builds `regionContent` through a large `if/else` chain per layout type. The classification wraps this output.

The cleanest approach: factor the per-region content resolution into a `resolveRegionContent()` helper (pure refactor of existing code), then apply `classifyRegionContent()` to its output.

**However**, to minimize refactoring scope: apply classification **only** to regions where the author places content directly — specifically the `body`, `left`, `right`, and `image` region IDs from layout slots where arbitrary `ReactNode` children are passed. Title regions always contain HTML (headings). Structured data regions (`stat-N`, `metric-N`) are always HTML.

The practical implementation: classification applies to these code paths in `buildSceneElements()`:
- `layout === 'content'`, region `body` → classify `asReactNode(data)`
- `layout === 'two-column'`, regions `left`/`right` → classify `twoColContent?.left` / `twoColContent?.right`
- `layout === 'blank'`, region `body` → classify `asReactNode(data)`
- `layout === 'full-bleed'`, region `overlay` → classify `asReactNode(data)`
- `layout === 'image'`, region `body` → classify `asReactNode(data)`

Title regions and structured-data regions (big-number stats, metric-grid metrics, comparison table, quote, agenda) skip classification — they always emit `<TextBox>`.

### Default Camera Injection

When any region emits a `<View>` (contentType is `'3d'` or `'mixed'`), the scene needs a Camera. The deck compiler already injects Lighting, Floor, and Background per scene (lines 748–752 of `deckCompiler.tsx`). Add a conditional Camera injection.

**In `buildSceneElements()`**, after the `textBoxElements` mapping, before assembling the final `Scene` element:

```typescript
// Determine if this slide has any routed 3D content
const hasRouted3D = /* flag set during textBoxElements.map() when any region is '3d' or 'mixed' */;

// Track whether the author's sceneDsl already provides a Camera
const sceneDslHasCamera = slideSpec.sceneDsl
  ? hasElementOfType(slideSpec.sceneDsl, Camera)
  : false;

// Inject a default camera for slides with routed 3D content (unless author provides one)
const defaultCameraElement = (hasRouted3D && !sceneDslHasCamera)
  ? React.createElement(Camera, {
      key: 'slide-default-cam',
      id: 'slide-default-camera',
      mode: 'world',
      position: [0, 1.5, 5],
      target: [0, 0, 0],
      fov: 42,
    })
  : null;
```

**New helper** — `hasElementOfType`:

```typescript
/**
 * Returns true if the ReactNode tree contains an element of the given type
 * at the top level (does not recurse into component children).
 */
function hasElementOfType(node: React.ReactNode, type: unknown): boolean {
  let found = false;
  Children.forEach(node, (child) => {
    if (isValidElement(child) && child.type === type) {
      found = true;
    }
  });
  return found;
}
```

**Imports needed:** Add `Camera` to the `@brewsite/core` import line:

```typescript
import { TextBox, Scene, ProgressManager, Floor, Background, Lighting, Ambient, View, Camera } from '@brewsite/core';
```

> Verify `Camera` DSL component is exported from `@brewsite/core`'s public barrel. It should be — it's a core DSL element.

### sceneDsl Merge Algorithm

The existing `sceneDsl` handling (lines 766–779 of `deckCompiler.tsx`) already wraps `sceneDsl` in a fullscreen `<View x={0} y={0} w={1} h={1}>`. This remains unchanged — it's the backdrop layer.

Layout-routed `<View>` elements are positioned at each region's NVS bounds. They appear after the sceneDsl View in the Scene children, giving them higher z-priority in the renderer.

Ambient elements (Camera, Lighting, Background, Floor) from `sceneDsl` are already emitted at Scene level (not inside any View). The existing injection of Lighting/Floor/Background at lines 748–752 serves as baseline defaults. When `sceneDsl` provides its own Camera/Lighting, those override the defaults through the standard compiler precedence (later DSL elements override earlier ones for the same widget ID).

No changes needed to the merge algorithm — the existing architecture handles this correctly.

### No Changes to `SlideRegion`

The `SlideRegion` type in `packages/slides/src/types.ts` is **not modified**. No `contentType` field is added. Content type is a compile-time local variable only.

### No Changes to `layoutCompiler.ts`

The layout compiler produces NVS regions without knowledge of content types. It remains unchanged.

### Testing Strategy — Enhancement #1

**Test file:** `packages/slides/src/compiler/__tests__/deckCompiler.test.ts` (extend existing)

**New test cases:**

```
describe('smart layout routing', () => {
  describe('classifyRegionContent', () => {
    it('classifies HTML-only content as html');
    it('classifies a registered DSL element as 3d');
    it('classifies mixed content as mixed');
    it('expands Fragment children when classifying');
    it('classifies non-element children (strings, numbers) as html');
    it('classifies an unregistered component as html');
  });

  describe('buildSceneElements routing', () => {
    it('emits TextBox for HTML-only region content');
    it('emits View for 3D-only region content');
    it('emits both View and TextBox for mixed content');
    it('positions routed View at the region NVS bounds');
    it('injects default Camera when a region has 3D content');
    it('does not inject Camera when sceneDsl already provides one');
    it('preserves sceneDsl fullscreen View as backdrop layer');
    it('routes two-column left=HTML, right=3D correctly');
    it('title regions always emit TextBox regardless of content');
  });
});
```

**Test setup:** Tests need `getNodeHandler()` to return a handler for 3D DSL elements. Before each test, call `registerNode(MockDslComponent, () => {})` to register a mock DSL component, then verify `classifyRegionContent` detects it. After each test, call `clearRegistry()` to reset.

`clearRegistry` must be exported from `@brewsite/core`'s public barrel as a dev/test utility (step A1 adds this export alongside the existing `clearSceneTrackCache` dev export pattern). Then import normally:

```typescript
import { registerNode, clearRegistry } from '@brewsite/core';

const Mock3DComponent = (() => null) as React.FC;
Mock3DComponent.displayName = 'Mock3DComponent';

beforeEach(() => {
  registerNode(Mock3DComponent, () => {});
});

afterEach(() => {
  clearRegistry();
});
```

---

## Enhancement #2: Scene-Level Lazy Loading (Phase 1)

### Concept

Currently, `RuntimeDriverImpl._loadAssets()` loads ALL `ILoadable` widgets upfront during `initialize()`. For large decks with 3D content per slide, this is wasteful.

Phase 1 adds:
- `SceneLoadPolicy` type with `eager` (which scene indices to load on init) and `preloadAhead` (how many scenes ahead to preload).
- Scene membership tracking (which widgets appear in which scenes).
- Partitioned asset loading in `RuntimeDriverImpl`.
- `useSceneLoadState()` hook for per-scene loading status.
- No `unload()`, no `keepBehind`, no `ILoadable` changes.

### Types

#### `packages/core/src/runtime/types.ts` — New Types

Add after the existing `RuntimeDriver` type (after line 149):

```typescript
// ─── Scene Load Policy ───────────────────────────────────────────────────────

/**
 * Controls when widget assets are loaded relative to scene navigation.
 *
 * When omitted from SceneEngine, all ILoadable widgets load upfront
 * (backward-compatible default).
 *
 * When provided, assets are partitioned by scene membership:
 * - `eager` scenes load immediately after setSceneTrack() (blocking assetsReady).
 * - `preloadAhead` scenes load in the background on navigation.
 *
 * Phase 1: assets are loaded but never unloaded. Memory grows monotonically.
 */
export type SceneLoadPolicy = {
  /**
   * Scene indices to load eagerly after compilation.
   * These block assetsReady — the engine won't tick until they're loaded.
   * Default: [0] (first scene only).
   */
  eager?: number[];

  /**
   * How many scenes ahead of the current scene to preload.
   * Preloading is non-blocking — it happens in the background.
   * Default: 1.
   */
  preloadAhead?: number;
};

// ─── Scene Membership ────────────────────────────────────────────────────────

/**
 * Maps scene indices to the set of widget IDs that appear in each scene.
 * Produced as a side-output of compileSceneTrack() and consumed by
 * RuntimeDriverImpl for partitioned asset loading.
 *
 * Widget "appearance" means the widget has non-default state in that scene's
 * compiled SceneFrame — i.e., the scene's DSL references that widget.
 */
export type SceneMembership = Map<number, Set<string>>;
```

#### `packages/core/src/runtime/types.ts` — RuntimeDriver Interface Extension

Add to the `RuntimeDriver` type (inside the existing type literal):

```typescript
  /**
   * Scene-to-widget membership mapping. Populated after setSceneTrack().
   * Used by the player layer and useSceneLoadState() hook.
   * Null when no SceneTrack has been set.
   */
  readonly sceneMembership: SceneMembership | null;
```

### Scene Membership Tracking

#### `packages/core/src/compiler/sceneTrackCompiler.ts`

**Modify `compileSceneTrack()` return type.** The function currently returns `SceneTrack`. It will return an extended type that includes scene membership.

**Option: Attach to `SceneTrack` directly.** Add an optional `sceneMembership` field to `SceneTrack` in `sceneTrackTypes.ts`.

#### `packages/core/src/compiler/sceneTrackTypes.ts`

Add to the `SceneTrack` type (after the existing optional fields):

```typescript
  /**
   * Scene-to-widget membership mapping. Maps scene index → set of widget IDs
   * that have non-default state in that scene.
   *
   * Produced by compileSceneTrack(). Consumed by RuntimeDriverImpl for
   * partitioned asset loading. Absent when all scenes are loaded upfront.
   */
  sceneMembership?: Map<number, Set<string>>;
```

#### `packages/core/src/compiler/sceneTrackCompiler.ts` — Build SceneMembership

After Step 1 (snapshot evaluation, around line 402), before Step 2 (frame allocation):

```typescript
  // ── Step 1.4: Build scene membership mapping ──────────────────────────────
  // For each scene, record which widget IDs have non-undefined state.
  // This is used by RuntimeDriverImpl for partitioned asset loading.
  const sceneMembership = new Map<number, Set<string>>();
  for (let i = 0; i < snapshots.length; i++) {
    const snapshot = snapshots[i];
    if (!snapshot) continue;
    const widgetIds = new Set<string>();
    for (const [widgetId, state] of Object.entries(snapshot.widgets)) {
      if (state !== undefined) {
        widgetIds.add(widgetId);
      }
    }
    sceneMembership.set(i, widgetIds);
  }
```

In the return statement (around line 697), add `sceneMembership`:

```typescript
  return {
    ticks: frames,
    tickStep,
    subTickCount: totalFrames,
    sceneWindows,
    sceneMembership,  // ← NEW
    ...(progressProfile !== undefined ? { progressProfile } : {}),
    ...(transitionBlocks.length > 0 ? { transitionBlocks } : {}),
    ...(warnings.length > 0 ? { warnings } : {}),
    ...(sceneOverlays.size > 0 ? { sceneOverlays } : {}),
  };
```

### RuntimeDriver Partitioned Loading

#### `packages/core/src/runtime/RuntimeDriver.ts`

**New fields** — add to the class (after existing private fields, around line 73):

```typescript
  /** Scene load policy. When null, all widgets load upfront (backward compat). */
  private loadPolicy: SceneLoadPolicy | null = null;

  /** Scene-to-widget membership mapping. Set by setSceneTrack(). */
  private _sceneMembership: SceneMembership | null = null;

  /** Scenes whose ILoadable widgets have finished loading. */
  private _loadedScenes = new Set<number>();

  /** Scenes currently being loaded. */
  private _loadingScenes = new Set<number>();

  /** Listeners notified when loadedScenes/loadingScenes change. */
  private _sceneLoadListeners = new Set<() => void>();

  /**
   * Cached snapshot for useSyncExternalStore. A new object is created only
   * when _loadedScenes or _loadingScenes actually change (in _notifySceneLoadListeners).
   * Between changes, getSceneLoadState() returns the same reference — this satisfies
   * useSyncExternalStore's requirement for referential stability of unchanged snapshots.
   * Sets are defensively copied so consumers cannot corrupt driver state.
   */
  private _sceneLoadStateSnapshot: { loadedScenes: ReadonlySet<number>; loadingScenes: ReadonlySet<number> } = {
    loadedScenes: new Set(),
    loadingScenes: new Set(),
  };

  /** Last observed scene index — used for preload-ahead triggers. */
  private _lastObservedSceneIndex = -1;
```

**Public getter for sceneMembership** (implements the RuntimeDriver interface addition):

```typescript
  get sceneMembership(): SceneMembership | null {
    return this._sceneMembership;
  }
```

**New method: `setLoadPolicy()`** — called from `useSceneEngine` when the prop is provided:

```typescript
  /**
   * Configures scene-level lazy loading. Must be called before initialize().
   * When set, _loadAssets() in initialize() becomes a no-op; partitioned
   * loading is triggered from setSceneTrack() instead.
   */
  setLoadPolicy(policy: SceneLoadPolicy): void {
    this.loadPolicy = policy;
  }
```

**Modify `_loadAssets()`** — skip loading when loadPolicy is set:

```typescript
  private async _loadAssets(): Promise<void> {
    // When loadPolicy is configured, skip upfront loading.
    // Partitioned loading is triggered from setSceneTrack().
    if (this.loadPolicy) {
      return;
    }

    // Existing code: load all ILoadable widgets upfront.
    const loadables = this.widgetRegistry.getLoadables();
    await Promise.all(
      loadables.map((w) =>
        w.load(this.manifest).catch((e: unknown) => {
          const err = e instanceof Error ? e : new Error(String(e));
          this.loadErroredWidgets.add(w.widgetId);
          this.onWidgetError?.(w.widgetId, err);
        }),
      ),
    );
    this.attachContainedRenderables();
    this.assetsReady = true;
    this.onAssetsReady?.();
  }
```

**Modify `setSceneTrack()`** — trigger partitioned loading:

```typescript
  setSceneTrack(track: SceneTrack): void {
    this.sampler = createSceneTrackSampler(track);
    this.track = track;

    // Store scene membership from compilation output.
    this._sceneMembership = track.sceneMembership ?? null;

    // Re-read widget lists — compilation may have lazily registered new widgets.
    this._refreshWidgetLists();

    // Trigger partitioned loading when a load policy is configured.
    if (this.loadPolicy && this._sceneMembership) {
      void this._loadEagerScenes();
    }
  }
```

**New method: `_loadEagerScenes()`**:

```typescript
  /**
   * Loads assets for eager scenes (blocking assetsReady) then starts
   * preloading ahead scenes in the background.
   */
  private async _loadEagerScenes(): Promise<void> {
    const policy = this.loadPolicy!;
    const eagerIndices = policy.eager ?? [0];

    // Load eager scenes — these block assetsReady.
    await this._loadScenesAssets(eagerIndices);

    // Mark assets ready once eager scenes are loaded.
    this.attachContainedRenderables();
    this.assetsReady = true;
    this.onAssetsReady?.();

    // Preload ahead from the first eager scene.
    const currentScene = eagerIndices[0] ?? 0;
    this._preloadAhead(currentScene);
  }
```

**New method: `_loadScenesAssets()`**:

```typescript
  /**
   * Loads ILoadable widgets for the given scene indices.
   * Skips widgets that are already loaded or currently loading.
   * Updates _loadedScenes and _loadingScenes sets.
   */
  private async _loadScenesAssets(sceneIndices: number[]): Promise<void> {
    const membership = this._sceneMembership;
    if (!membership) return;

    // Collect widget IDs from requested scenes that haven't been loaded yet.
    const widgetIdsToLoad = new Set<string>();
    const scenesToMark = new Set<number>();

    for (const idx of sceneIndices) {
      if (this._loadedScenes.has(idx)) continue;
      scenesToMark.add(idx);
      const widgetIds = membership.get(idx);
      if (!widgetIds) continue;
      for (const id of widgetIds) {
        widgetIdsToLoad.add(id);
      }
    }

    if (widgetIdsToLoad.size === 0) {
      // All widgets for these scenes are already loaded.
      for (const idx of scenesToMark) {
        this._loadedScenes.add(idx);
      }
      this._notifySceneLoadListeners();
      return;
    }

    // Mark scenes as loading.
    for (const idx of scenesToMark) {
      this._loadingScenes.add(idx);
    }
    this._notifySceneLoadListeners();

    // Load only the ILoadable widgets in the requested scenes that aren't already loaded.
    const loadables = this.widgetRegistry.getLoadables()
      .filter((w) => widgetIdsToLoad.has(w.widgetId) && !w.isLoaded);

    await Promise.all(
      loadables.map((w) =>
        w.load(this.manifest).catch((e: unknown) => {
          const err = e instanceof Error ? e : new Error(String(e));
          this.loadErroredWidgets.add(w.widgetId);
          this.onWidgetError?.(w.widgetId, err);
        }),
      ),
    );

    // Attach any IContainedRenderable widgets that were just loaded.
    // Without this, contained models loaded via preload-ahead would never
    // be parented to their host's attachment point.
    this.attachContainedRenderables();

    // Mark scenes as loaded (not loading).
    for (const idx of scenesToMark) {
      this._loadingScenes.delete(idx);
      this._loadedScenes.add(idx);
    }
    this._notifySceneLoadListeners();
  }
```

**New method: `_preloadAhead()`**:

```typescript
  /**
   * Preloads scenes ahead of the current scene index (non-blocking).
   */
  private _preloadAhead(currentSceneIndex: number): void {
    const policy = this.loadPolicy;
    if (!policy || !this._sceneMembership) return;
    // Use sceneWindows.length as the authoritative scene count, not
    // _sceneMembership.size — empty scenes (no widgets) may be absent
    // from the membership map but still exist in the track.
    const totalScenes = this.track?.sceneWindows.length ?? 0;
    const ahead = policy.preloadAhead ?? 1;

    const indicesToPreload: number[] = [];
    for (let i = 1; i <= ahead; i++) {
      const idx = currentSceneIndex + i;
      if (idx < totalScenes && !this._loadedScenes.has(idx) && !this._loadingScenes.has(idx)) {
        indicesToPreload.push(idx);
      }
    }

    if (indicesToPreload.length > 0) {
      void this._loadScenesAssets(indicesToPreload);
    }
  }
```

**New method: Scene load state subscription**:

```typescript
  /** Subscribe to scene load state changes. Returns unsubscribe function. */
  subscribeSceneLoadState(listener: () => void): () => void {
    this._sceneLoadListeners.add(listener);
    return () => this._sceneLoadListeners.delete(listener);
  }

  /**
   * Returns the cached snapshot. Same object reference between state changes —
   * required by useSyncExternalStore for referential stability.
   */
  getSceneLoadState(): { loadedScenes: ReadonlySet<number>; loadingScenes: ReadonlySet<number> } {
    return this._sceneLoadStateSnapshot;
  }

  /**
   * Creates a new snapshot (new object identity signals change to useSyncExternalStore),
   * then notifies all subscribed listeners. Sets are defensively copied so consumers
   * cannot mutate driver internals.
   */
  private _notifySceneLoadListeners(): void {
    this._sceneLoadStateSnapshot = {
      loadedScenes: new Set(this._loadedScenes),
      loadingScenes: new Set(this._loadingScenes),
    };
    for (const listener of this._sceneLoadListeners) {
      listener();
    }
  }
```

**Modify `tick()`** — trigger preload-ahead on scene change:

In the existing `tick()` method, after sampling the SceneTrack (the current tick is determined), check if the scene index changed:

```typescript
  // After sampling:
  const tick = this.sampler.sample(globalProgress);
  this.currentTick = tick;

  // Trigger preload-ahead on scene change (lazy loading mode).
  if (this.loadPolicy && tick && tick.sceneIndex !== this._lastObservedSceneIndex) {
    this._lastObservedSceneIndex = tick.sceneIndex;
    this._preloadAhead(tick.sceneIndex);
  }
```

This snippet goes in the existing `tick()` method, after the `this.currentTick = tick` line (around line 320 in the current code). The exact insertion point is after `Step 1: Sample SceneTrack`.

### SceneEngine Props

#### `packages/core/src/player/SceneEngine.tsx`

**Add to `SceneEngineProps`** (after `maxAnimBoostPerFrame`, around line 79):

```typescript
  /**
   * Scene-level lazy loading policy. When provided, assets are loaded
   * per-scene instead of all-at-once.
   *
   * When omitted, all ILoadable widgets load upfront (backward compat).
   *
   * @example
   * <SceneEngine loadPolicy={{ eager: [0, 1], preloadAhead: 1 }} ...>
   */
  loadPolicy?: import('../runtime/types').SceneLoadPolicy;
```

**Pass to RuntimeDriverImpl** — in the `useSceneEngine` call (around line 269), pass `loadPolicy`:

```typescript
  const engine = useSceneEngine({
    ...
    loadPolicy: props.loadPolicy,
    ...
  });
```

#### `packages/core/src/player/useSceneEngine.ts`

**Accept `loadPolicy` in options.**

Add to the options type:

```typescript
  loadPolicy?: SceneLoadPolicy;
```

Import `SceneLoadPolicy` from `../runtime/types`.

**Pass to RuntimeDriverImpl construction.** After creating the driver (around line 553):

```typescript
  const driver = new RuntimeDriverImpl({
    widgetRegistry: options.widgetRegistry,
    variableStore,
    manifest: options.manifest ?? null,
    ...
  });

  // Configure lazy loading before initialize()
  if (options.loadPolicy) {
    driver.setLoadPolicy(options.loadPolicy);
  }
```

### useSceneLoadState Hook

#### New file: `packages/core/src/player/useSceneLoadState.ts`

```typescript
// Hook for reading per-scene loading state from RuntimeDriverImpl.

import { createContext, useContext, useSyncExternalStore } from 'react';
import type { RuntimeDriverImpl } from '../runtime/RuntimeDriver';

// ─── Context ─────────────────────────────────────────────────────────────────

export type SceneLoadStateContextValue = {
  driver: RuntimeDriverImpl | null;
};

export const SceneLoadStateContext = createContext<SceneLoadStateContextValue>({
  driver: null,
});

// ─── Hook ────────────────────────────────────────────────────────────────────

export type SceneLoadState = {
  /** Set of scene indices whose assets are fully loaded. */
  loadedScenes: ReadonlySet<number>;
  /** Set of scene indices currently loading. */
  loadingScenes: ReadonlySet<number>;
};

const EMPTY_STATE: SceneLoadState = {
  loadedScenes: new Set(),
  loadingScenes: new Set(),
};

/**
 * Returns per-scene loading status for the nearest SceneEngine.
 *
 * Only meaningful when the engine has a `loadPolicy` configured.
 * When no loadPolicy is set, returns empty sets (all loading is upfront).
 *
 * Uses useSyncExternalStore for tear-free reads.
 */
export function useSceneLoadState(): SceneLoadState {
  const { driver } = useContext(SceneLoadStateContext);

  const subscribe = (onStoreChange: () => void): (() => void) => {
    if (!driver) return () => {};
    return driver.subscribeSceneLoadState(onStoreChange);
  };

  const getSnapshot = (): SceneLoadState => {
    if (!driver) return EMPTY_STATE;
    return driver.getSceneLoadState();
  };

  return useSyncExternalStore(subscribe, getSnapshot, () => EMPTY_STATE);
}
```

#### `packages/core/src/player/SceneEngine.tsx` — Provide Context

Add the `SceneLoadStateContext` provider inside the component:

```typescript
import { SceneLoadStateContext } from './useSceneLoadState';

// Inside SceneEngine, after engine hook:
const sceneLoadContextValue = useMemo(
  () => ({ driver: engine.driverRef?.current ?? null }),
  [engine.driverRef],
);

// Wrap innerContent with SceneLoadStateContext.Provider:
<SceneLoadStateContext.Provider value={sceneLoadContextValue}>
  {innerContent}
</SceneLoadStateContext.Provider>
```

> Implementation note: `useSceneEngine` must expose a `driverRef` (a `RefObject<RuntimeDriverImpl>`) so that `SceneEngine` can provide it to the context. Currently `driverRef` is internal to `useSceneEngine`. Expose it in the return value as `driverRef: driverRef` (read-only ref).

#### `packages/core/src/player/useSceneEngine.ts` — Expose driverRef

In the return object of `useSceneEngine()`, add:

```typescript
  return {
    ...existingReturnValues,
    /** Ref to the RuntimeDriverImpl instance — used by SceneLoadStateContext. */
    driverRef,
  };
```

### SlidePlayer and `loadPolicy` — Consumer Responsibility

`SlidePlayer` renders **inside** a `<SceneEngine>` context — it is a child, not a parent. It cannot set props on `SceneEngine`. Therefore, the **consumer** is responsible for setting `loadPolicy` on `SceneEngine` when wrapping `SlidePlayer`.

```tsx
// Consumer code — loadPolicy is set on SceneEngine, not SlidePlayer
<SceneEngine
  plugins={[corePlugin(), slidesPlugin()]}
  loadPolicy={{ eager: [0, 1], preloadAhead: 1 }}
>
  <SlidePlayer>
    <Slide key="intro">...</Slide>
    <Slide key="body">...</Slide>
  </SlidePlayer>
</SceneEngine>
```

This is a Phase 1 limitation. A future enhancement could add a `defaultLoadPolicy` prop to `SlidePlayer` that propagates upward via a context, but the added complexity is not justified for Phase 1.

When no `loadPolicy` is provided, all ILoadable widgets load upfront — backward compatible with all existing usage.

### Public Barrel Exports

#### `packages/core/src/index.ts`

Add to the public barrel:

```typescript
// Stream A: test utility for clearing NodeHandler registry between tests
export { clearRegistry } from './compiler/registry';

// Stream B: lazy loading types and hook
export type { SceneLoadPolicy, SceneMembership } from './runtime/types';
export { useSceneLoadState } from './player/useSceneLoadState';
export type { SceneLoadState } from './player/useSceneLoadState';
```

### Testing Strategy — Enhancement #2

#### Test file: `packages/core/src/compiler/__tests__/sceneMembership.test.ts` (new)

```
describe('compileSceneTrack sceneMembership', () => {
  it('produces SceneMembership with correct widget IDs per scene');
  it('excludes widgets not present in a scene');
  it('includes widgets present across multiple scenes in each');
  it('handles single-scene tracks (one scene, no transitions)');
  it('handles empty scenes (no widgets)');
});
```

**Test approach:** Real inputs to `compileSceneTrack()`. Create a minimal `WidgetRegistry` with 2-3 test widgets (using real `ISceneElement` doubles from `runtime/mocks/`). Create scene definitions where widget A appears in scenes 0 and 1, widget B appears only in scene 1. Assert the `sceneMembership` map has the correct structure.

#### Test file: `packages/core/src/runtime/__tests__/SceneLoadPolicy.test.ts` (new)

```
describe('RuntimeDriverImpl with SceneLoadPolicy', () => {
  describe('backward compatibility', () => {
    it('loads all ILoadable widgets upfront when no loadPolicy is set');
    it('fires onAssetsReady after all widgets load');
  });

  describe('eager loading', () => {
    it('loads only eager scene widgets when loadPolicy is set');
    it('blocks assetsReady until eager scenes finish loading');
    it('passes cached manifest to each widget load() call');
  });

  describe('preload-ahead', () => {
    it('preloads next scene when current scene changes');
    it('does not preload scenes already loaded');
    it('does not preload scenes currently loading');
    it('preloads multiple scenes when preloadAhead > 1');
  });

  describe('scene load state', () => {
    it('subscribeSceneLoadState fires on load start/complete');
    it('getSceneLoadState returns correct loaded/loading sets');
    it('getSceneLoadState returns same object reference when state has not changed');
    it('getSceneLoadState returns new object reference after state change');
    it('returned sets are defensive copies — mutating them does not corrupt driver state');
  });

  describe('contained renderables', () => {
    it('calls attachContainedRenderables after eager scene loading');
    it('calls attachContainedRenderables after preload-ahead scene loading');
  });
});
```

**Test doubles:**
- `MockLoadableWidget` — implements `IWidget` + `ILoadable`. `load()` returns a controllable Promise (via a deferred pattern). `isLoaded` tracks state.
- Use real `WidgetRegistry`, real `VariableStore`.
- Create SceneTracks with `sceneMembership` set explicitly (no need to run actual compilation in these tests — that's tested separately).

#### Test file: `packages/core/src/player/__tests__/useSceneLoadState.test.ts` (new)

```
describe('useSceneLoadState', () => {
  it('returns empty sets when no driver is provided');
  it('returns current loaded/loading sets from driver');
  it('re-renders when driver notifies scene load state change');
});
```

**Test approach:** Use `renderHook` with a wrapper providing `SceneLoadStateContext`. Mock driver with controllable subscription.

---

## Enhancement #3: AR/Display Sizing

### Concept

`SlidePlayer` already passes `aspectRatio` to `EngineARContainer`. Add `scaleMode` and `referenceWidth` as additional pass-through props.

### File Changes

#### `packages/slides/src/player/SlidePlayer.tsx`

**Modify `SlidePlayerProps`** (around line 273):

```typescript
export type SlidePlayerProps = {
  // ... existing props ...

  /**
   * How the deck fits within the display. Default: 'contain'.
   *
   * NOTE: This default intentionally differs from EngineARContainer's own
   * default of 'fit-width'. Presentations use 'contain' because slide
   * content should never be cropped — letterboxing/pillarboxing is the
   * industry-standard behavior for fixed-aspect-ratio presentation decks.
   */
  scaleMode?: 'contain' | 'cover' | 'fit-width' | 'fit-height';

  /**
   * Reference width for content scaling. Default: 1920.
   * Content authored at this pixel width scales proportionally to all
   * displays via the --scene-scale CSS variable.
   */
  referenceWidth?: number;
};
```

**Modify the destructured props** (around line 321):

```typescript
function SlidePlayer(
  {
    children,
    slideTheme,
    template,
    transition: transitionProp,
    progressIndicator: progressIndicatorProp,
    aspectRatio = 16 / 9,
    scaleMode = 'contain',      // ← NEW
    referenceWidth = 1920,       // ← NEW
    navigation,
    // ... rest ...
  }: SlidePlayerProps,
  ref,
)
```

**Modify `<EngineARContainer>`** (around line 479):

```tsx
<EngineARContainer
  aspectRatio={aspectRatio}
  scaleMode={scaleMode}
  referenceWidth={referenceWidth}
>
```

Currently line 479 is:
```tsx
<EngineARContainer aspectRatio={aspectRatio} scaleMode="contain">
```

Change to:
```tsx
<EngineARContainer aspectRatio={aspectRatio} scaleMode={scaleMode} referenceWidth={referenceWidth}>
```

### No Changes to `packages/slides/src/types.ts`

`SlidePlayerProps` is defined inline in `SlidePlayer.tsx`, not in `types.ts`. No changes needed to the types file.

### Testing Strategy — Enhancement #3

**Test file:** `packages/slides/src/player/__tests__/SlidePlayer.test.tsx` (extend existing)

```
describe('AR/display sizing props', () => {
  it('passes scaleMode to EngineARContainer (default: contain)');
  it('passes referenceWidth to EngineARContainer (default: 1920)');
  it('overrides scaleMode when prop is provided');
  it('overrides referenceWidth when prop is provided');
});
```

**Test approach:** Render `SlidePlayer` inside a mock `SceneEngine` context. Assert that the `EngineARContainer` receives the expected props. Use shallow rendering or inspect rendered HTML attributes.

---

## Implementation Sequence

### Stream A: Smart Layout Routing (Enhancement #1)

**Developer: 1**
**Estimated complexity: Medium**

| Step | Action | File |
|------|--------|------|
| A1 | Verify `getNodeHandler` is exported from `@brewsite/core` barrel (confirmed: line 33). Add `clearRegistry` export as a dev/test utility (follows the existing `clearSceneTrackCache` pattern). | `packages/core/src/index.ts` |
| A2 | Verify `Camera` DSL component is exported from `@brewsite/core` barrel (confirmed: transitively via `export * from './elements'` → `elements/camera/index.ts` line 21). No changes needed. | — |
| A3 | Add `classifyRegionContent()` helper function. | `packages/slides/src/compiler/deckCompiler.tsx` |
| A4 | Add `hasElementOfType()` helper function. | `packages/slides/src/compiler/deckCompiler.tsx` |
| A5 | Modify `buildSceneElements()` — apply classification to body/left/right regions, emit View/TextBox/both based on contentType. | `packages/slides/src/compiler/deckCompiler.tsx` |
| A6 | Add default Camera injection for slides with routed 3D content. | `packages/slides/src/compiler/deckCompiler.tsx` |
| A7 | Write tests for `classifyRegionContent`. | `packages/slides/src/compiler/__tests__/deckCompiler.test.ts` |
| A8 | Write tests for `buildSceneElements` routing behavior. | `packages/slides/src/compiler/__tests__/deckCompiler.test.ts` |
| A9 | Run `pnpm --filter @brewsite/slides typecheck` and `pnpm --filter @brewsite/slides test`. | — |

### Stream B: Scene-Level Lazy Loading (Enhancement #2)

**Developer: 1-2** (B1-B4 can be done by one dev, B5-B6 by another in parallel after B3 lands)

| Step | Action | File |
|------|--------|------|
| B1 | Add `SceneLoadPolicy` and `SceneMembership` types. Add `sceneMembership` to `RuntimeDriver` interface. | `packages/core/src/runtime/types.ts` |
| B2 | Add `sceneMembership` optional field to `SceneTrack` type. | `packages/core/src/compiler/sceneTrackTypes.ts` |
| B3 | Build scene membership in `compileSceneTrack()` Step 1.4. Include in return value. | `packages/core/src/compiler/sceneTrackCompiler.ts` |
| B4 | Write `sceneMembership.test.ts` — verify compilation output. | `packages/core/src/compiler/__tests__/sceneMembership.test.ts` |
| B5 | Add partitioned loading to `RuntimeDriverImpl`: `setLoadPolicy()`, modify `_loadAssets()`, modify `setSceneTrack()`, add `_loadEagerScenes()`, `_loadScenesAssets()`, `_preloadAhead()`, scene load state subscription API, preload-ahead trigger in `tick()`. | `packages/core/src/runtime/RuntimeDriver.ts` |
| B6 | Write `SceneLoadPolicy.test.ts` — verify partitioned loading behavior. | `packages/core/src/runtime/__tests__/SceneLoadPolicy.test.ts` |
| B7 | Create `useSceneLoadState.ts` — hook + context. | `packages/core/src/player/useSceneLoadState.ts` |
| B8 | Add `loadPolicy` prop to `SceneEngineProps`. Pass to `useSceneEngine`. Provide `SceneLoadStateContext`. | `packages/core/src/player/SceneEngine.tsx` |
| B9 | Accept `loadPolicy` in `useSceneEngine` options. Pass to `RuntimeDriverImpl`. Expose `driverRef`. | `packages/core/src/player/useSceneEngine.ts` |
| B10 | Add public barrel exports: `SceneLoadPolicy`, `SceneMembership`, `useSceneLoadState`. | `packages/core/src/index.ts` |
| B11 | Write `useSceneLoadState.test.ts`. | `packages/core/src/player/__tests__/useSceneLoadState.test.ts` |
| B12 | Run `pnpm --filter @brewsite/core typecheck` and `pnpm --filter @brewsite/core test`. | — |

### Stream C: AR/Display Sizing (Enhancement #3)

**Developer: 1 (trivial — can be done by Stream A developer as a 15-minute task)**

| Step | Action | File |
|------|--------|------|
| C1 | Add `scaleMode` and `referenceWidth` to `SlidePlayerProps`. Destructure with defaults. Pass to `EngineARContainer`. | `packages/slides/src/player/SlidePlayer.tsx` |
| C2 | Write/extend tests for the new props. | `packages/slides/src/player/__tests__/SlidePlayer.test.tsx` |
| C3 | Run `pnpm --filter @brewsite/slides typecheck` and `pnpm --filter @brewsite/slides test`. | — |

---

## Files Created/Modified Summary

### New Files

| File | Package | Stream |
|------|---------|--------|
| `packages/core/src/player/useSceneLoadState.ts` | `@brewsite/core` | B |
| `packages/core/src/compiler/__tests__/sceneMembership.test.ts` | `@brewsite/core` | B |
| `packages/core/src/runtime/__tests__/SceneLoadPolicy.test.ts` | `@brewsite/core` | B |
| `packages/core/src/player/__tests__/useSceneLoadState.test.ts` | `@brewsite/core` | B |

### Modified Files

| File | Package | Stream | Change Summary |
|------|---------|--------|---------------|
| `packages/slides/src/compiler/deckCompiler.tsx` | `@brewsite/slides` | A | Add `classifyRegionContent`, `hasElementOfType`, modify `buildSceneElements` routing, add Camera import + default injection |
| `packages/slides/src/compiler/__tests__/deckCompiler.test.ts` | `@brewsite/slides` | A | Add smart routing tests |
| `packages/slides/src/player/SlidePlayer.tsx` | `@brewsite/slides` | C | Add `scaleMode`, `referenceWidth` props |
| `packages/slides/src/player/__tests__/SlidePlayer.test.tsx` | `@brewsite/slides` | C | Add AR sizing tests |
| `packages/core/src/runtime/types.ts` | `@brewsite/core` | B | Add `SceneLoadPolicy`, `SceneMembership` types, extend `RuntimeDriver` |
| `packages/core/src/compiler/sceneTrackTypes.ts` | `@brewsite/core` | B | Add `sceneMembership` to `SceneTrack` |
| `packages/core/src/compiler/sceneTrackCompiler.ts` | `@brewsite/core` | B | Build `sceneMembership` in Step 1.4 |
| `packages/core/src/runtime/RuntimeDriver.ts` | `@brewsite/core` | B | Add partitioned loading, scene load state API |
| `packages/core/src/player/SceneEngine.tsx` | `@brewsite/core` | B | Add `loadPolicy` prop, provide `SceneLoadStateContext` |
| `packages/core/src/player/useSceneEngine.ts` | `@brewsite/core` | B | Accept `loadPolicy`, expose `driverRef` |
| `packages/core/src/index.ts` | `@brewsite/core` | A+B | Export `clearRegistry` (test utility, Stream A); export `SceneLoadPolicy`, `SceneMembership`, `useSceneLoadState` (Stream B) |

### Deleted Files

None.

---

## Backward Compatibility

All three enhancements are **backward compatible**:

1. **Smart Layout Routing:** Regions with only HTML content (all existing usage) continue to emit `<TextBox>` exactly as today. No behavior change without 3D DSL elements in layout slots.

2. **Scene-Level Lazy Loading:** When no `loadPolicy` prop is provided, `RuntimeDriverImpl._loadAssets()` runs exactly as today — all widgets load upfront. The `sceneMembership` field on `SceneTrack` is ignored.

3. **AR/Display Sizing:** `scaleMode` defaults to `'contain'` and `referenceWidth` defaults to `1920` — same values as the current hardcoded behavior.

---

## Semver Impact

- `@brewsite/core`: **Minor** — new types, new optional prop on `SceneEngine`, new hook export. No breaking changes.
- `@brewsite/slides`: **Minor** — new optional props on `SlidePlayer`, new compiler behavior (opt-in via content). No breaking changes.

---

## Phase 2 Deferral (Out of Scope)

The following are explicitly **out of scope** for this plan:

- `ILoadable.unload()` method
- `SceneLoadPolicy.keepBehind` field
- Shared asset reference counting (fonts, textures, env maps)
- Memory pressure monitoring
- `useSceneLoadState()` reflecting unloaded scenes

These will be addressed in a separate PRD when measured memory pressure from large decks (>50 slides) becomes a concern.
