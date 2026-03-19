---
title: "Implementation Plan: Diagram Rendering Fixes — SceneTheme Bridge, Example Fixes, Bot Docs"
doc_type: plan
owner: Toolkit Architect
status: complete
updated: 2026-03-18
---

# Plan: Diagram Rendering Fixes

## Overview

Three remaining work items from the consolidated rendering fixes note (`note_diagram-rendering-fixes-consolidated.md`):

1. **SceneTheme → DiagramTheme bridge** — cross-package compile pipeline plumbing (core + diagram)
2. **Fix all 13 example diagrams** — visual review and size/spacing adjustments (apps only)
3. **Update bot docs** — spatial awareness and sizing guide in `@brewsite/claude-author`

All aspect ratio, font size base, slides fontSize, fit-to-content layout, and icon positioning fixes are already implemented and committed.

---

## Dependency Graph

```
Stream A: SceneTheme bridge — core changes
    │
    ▼
Stream B: SceneTheme bridge — diagram handler changes (depends on A)
    │
    ▼
Stream C: Example fixes — apps/examples/ (depends on B; 7 files)
Stream D: Example fixes — apps/website/ (depends on B; 6 files, parallel with C)
    │
    ▼  (C + D both complete)
Stream E: Bot docs — claude-author (can start in parallel with C/D, finalize after)
```

**Stream E** has no code dependency on A–D but should reference final verified behavior, so it can start drafting in parallel and finalize after C/D complete.

---

## Stream A: SceneTheme Bridge — Core Changes

**Package:** `@brewsite/core`
**Files modified:** 4 (`sceneTrackCompiler.ts`, `sceneTypes.ts`, `useSceneEngine.ts`, `sceneTrackCache.ts`) + test file
**Estimated scope:** ~20 lines of production code + test additions

### A.1 — Add `sceneTheme` to `CompileSceneTrackOptions`

**File:** `packages/core/src/compiler/sceneTrackCompiler.ts`

At line 27, the `CompileSceneTrackOptions` type currently has:

```ts
export type CompileSceneTrackOptions = {
  scenes: SceneDefinition[];
  widgetRegistry: WidgetRegistry;
  blockSize: number;
  prefersReducedMotion?: boolean;
  activeTheme?: ActiveTheme;
};
```

**Add** after `activeTheme`:

```ts
  /**
   * Optional scene theme tokens — font URLs, font size scales, color mode.
   * Propagated into SceneSnapshotContext for downstream NodeHandlers
   * (e.g., diagram handler bridges this into DiagramTheme.sceneTheme).
   */
  sceneTheme?: SceneTheme;
```

**Add import** at top of file (alongside the existing `ActiveTheme` import from `'../theme/types'`):

```ts
import type { SceneTheme } from '../theme/types';
```

The `ActiveTheme` import already exists on line 4. Merge `SceneTheme` into the same import statement:

```ts
import type { ActiveTheme, SceneTheme } from '../theme/types';
```

### A.2 — Add `sceneTheme` to `SceneSnapshotContext`

**File:** `packages/core/src/compiler/sceneTypes.ts`

Current type (lines 6–28):

```ts
export type SceneSnapshotContext = {
  sceneIndex: number;
  numScenes: number;
  assetsReady: boolean;
  variables?: VariableStoreReader;
  viewport?: { width: number; height: number; aspectRatio: number };
  themeFamily: ThemeFamily;
  themePolarity: 'dark' | 'light';
};
```

**Add** after `themePolarity`:

```ts
  /**
   * Optional scene theme tokens for cross-package theming.
   * Contains font URLs (webglFontUrl), font size scales, and color mode.
   * Consumed by downstream NodeHandlers — e.g., the diagram handler
   * bridges this into `DiagramTheme.sceneTheme` for font and sizing integration.
   *
   * Optional — existing scenes without a SceneTheme behave identically to before.
   */
  sceneTheme?: SceneTheme;
```

**Add import** at top of file:

```ts
import type { SceneTheme } from '../theme/types';
```

Currently line 4 imports `ThemeFamily` from `'../theme/types'`. Merge:

```ts
import type { ThemeFamily, SceneTheme } from '../theme/types';
```

**Public API note:** `SceneSnapshotContext` is a public type — it's the parameter for `Resolvable<T>` callbacks. Adding an optional field is backward-compatible; no existing consumer breaks.

### A.3 — Populate `sceneTheme` in the context construction

**File:** `packages/core/src/compiler/sceneTrackCompiler.ts`

At line 373, the context object is constructed:

```ts
const context = {
  sceneIndex: i,
  numScenes: scenes.length,
  assetsReady: true,
  themeFamily:   options.activeTheme?.family   ?? 'default' as const,
  themePolarity: options.activeTheme?.polarity ?? 'dark' as const,
};
```

**Add** after `themePolarity`:

```ts
  sceneTheme: options.sceneTheme,
```

This spreads the `SceneTheme` reference (or `undefined`) into every `SceneSnapshotContext` created during compilation.

### A.4 — Pass `sceneTheme` from `useSceneEngine` into both `compileSceneTrack` calls

**File:** `packages/core/src/player/useSceneEngine.ts`

There are two `compileSceneTrack()` call sites:

**Call site 1 — Discovery pass (line 650):**

```ts
const discoveryTrack = compileSceneTrack({
  scenes: sceneDefs,
  widgetRegistry: options.widgetRegistry,
  blockSize,
  prefersReducedMotion,
  activeTheme: options.activeTheme,
});
```

**Add** after `activeTheme`:

```ts
  sceneTheme: options.sceneTheme ?? undefined,
```

**Call site 2 — Authoritative pass (line 681):**

```ts
const compiled = compileSceneTrack({
  scenes: sceneDefs,
  widgetRegistry: options.widgetRegistry,
  blockSize,
  prefersReducedMotion,
  activeTheme: options.activeTheme,
});
```

**Add** after `activeTheme`:

```ts
  sceneTheme: options.sceneTheme ?? undefined,
```

**Verification:** `UseSceneEngineOptions` already has `sceneTheme?: SceneTheme | null` at line 44. The `?? undefined` coerces `null` to `undefined` to match the optional field type on `CompileSceneTrackOptions`.

### A.4b — Add `options.sceneTheme` to the recompile `useEffect` dependency array

**File:** `packages/core/src/player/useSceneEngine.ts`

**CRITICAL:** The recompile effect's dependency array (lines 705–715) must include `options.sceneTheme`, otherwise a runtime SceneTheme change (e.g., host app changes `webglFontUrl` without changing `activeTheme` family/polarity) will not trigger recompilation. The cache key change (A.5) only helps when the effect fires for another reason.

Current dependency array:

```ts
], [
  options.scenes,
  options.widgetRegistry,
  options.plugins,
  blockSize,
  prefersReducedMotion,
  sceneDefs,
  options.invalidateCacheToken,
  options.activeTheme,
  options.onCompileWarning,
]);
```

**Add** `options.sceneTheme` after `options.activeTheme`:

```ts
  options.activeTheme,
  options.sceneTheme,
  options.onCompileWarning,
```

**Note:** The scene lifecycle effect (lines 567–575) intentionally excludes `options.sceneTheme` — that's correct because theme content changes don't require tearing down the Three.js scene/camera/widgets. Only the *recompile* effect needs to re-fire to produce an updated `SceneTrack`.

### A.5 — Pass `sceneTheme` into `buildSceneTrackKey`

**File:** `packages/core/src/player/useSceneEngine.ts`

The cache key builder at line 663 must include `sceneTheme` so that changing the theme invalidates the cached track:

```ts
const key = buildSceneTrackKey({
  scenes: options.scenes,
  widgetRegistry: options.widgetRegistry,
  blockSize,
  prefersReducedMotion,
  invalidateCacheToken: options.invalidateCacheToken,
  activeTheme: options.activeTheme,
});
```

**Add** after `activeTheme`:

```ts
  sceneTheme: options.sceneTheme ?? undefined,
```

**File:** `packages/core/src/compiler/sceneTrackCache.ts`

The cache key builder enumerates fields explicitly (line 11–26). Add `sceneTheme` to the options type and the key string.

**Add to the options type** (after `activeTheme`):

```ts
  sceneTheme?: SceneTheme;
```

**Add import:**

```ts
import type { ActiveTheme, SceneTheme } from '../theme/types';
```

**Add to the key construction** (after the `themeKey` line):

```ts
  const stKey = `st:${options.sceneTheme?.font.webglFontUrl ?? ''}:${options.sceneTheme?.fontSize.label ?? ''}:${options.sceneTheme?.fontSize.caption ?? ''}`;
```

And add `stKey` to the join array:

```ts
  return [contentKeys, blockKey, widgetKey, rmKey, tokenKey, themeKey, stKey].join('::');
```

Only the three fields that affect diagram compilation output need to be in the key (`webglFontUrl`, `fontSize.label`, `fontSize.caption`). Including the full SceneTheme object would over-invalidate the cache on unrelated background/floor changes.

**Note:** `colorMode` is intentionally excluded from the cache key because it does not flow through `buildThemeRenderConfig()` today — built-in diagram theme presets all have explicit `defaultLabelColor` values, so `colorMode` has no effect on compiled output. If `colorMode` is later used in diagram compilation (e.g., for dynamic label color resolution), the cache key must be updated to include it.

### A.6 — Testing

**File:** `packages/core/src/compiler/__tests__/sceneTrackCompiler.test.ts`

Add test case:

```ts
it('passes sceneTheme from options into SceneSnapshotContext', () => {
  const mockSceneTheme: SceneTheme = {
    colorMode: 'dark',
    font: { htmlFamily: 'Inter, sans-serif', webglFontUrl: 'https://example.com/inter.ttf' },
    fontSize: { heading: 2.4, body: 1.0, label: 1.0, caption: 1.0, annotation: 0.7 },
  };

  // Create a scene that captures its context
  let capturedContext: SceneSnapshotContext | undefined;
  const scene: SceneDefinition = {
    id: 'test-scene',
    getFrame: (ctx) => {
      capturedContext = ctx;
      return { id: 'test-scene', scrollProgress: 0, widgets: {} };
    },
  };

  compileSceneTrack({
    scenes: [scene, scene], // need at least 2 for a valid track
    widgetRegistry: createTestRegistry(),
    blockSize: 30,
    sceneTheme: mockSceneTheme,
  });

  expect(capturedContext).toBeDefined();
  expect(capturedContext!.sceneTheme).toBe(mockSceneTheme);
  expect(capturedContext!.sceneTheme?.font.webglFontUrl).toBe('https://example.com/inter.ttf');
});

it('sceneTheme is undefined when not provided in options', () => {
  let capturedContext: SceneSnapshotContext | undefined;
  const scene: SceneDefinition = {
    id: 'test-scene',
    getFrame: (ctx) => {
      capturedContext = ctx;
      return { id: 'test-scene', scrollProgress: 0, widgets: {} };
    },
  };

  compileSceneTrack({
    scenes: [scene, scene],
    widgetRegistry: createTestRegistry(),
    blockSize: 30,
  });

  expect(capturedContext!.sceneTheme).toBeUndefined();
});
```

If `createTestRegistry` doesn't exist, use the same pattern as existing tests in that file — construct a minimal `WidgetRegistry` instance.

---

## Stream B: SceneTheme Bridge — Diagram Handler Changes

**Package:** `@brewsite/diagram`
**Files modified:** 1
**Depends on:** Stream A (core changes must be built/available)

### B.1 — Bridge `sceneTheme` into resolved `DiagramTheme`

**File:** `packages/diagram/src/compiler/handlers.ts`

In the `registerNode(Diagram, ...)` handler (line 287), after theme resolution (line 292–295):

**Current code:**

```ts
const resolvedTheme = resolveDiagramTheme(
  api.context.themeFamily,
  api.context.themePolarity,
);
```

**Replace with:**

```ts
const resolvedTheme = resolveDiagramTheme(
  api.context.themeFamily,
  api.context.themePolarity,
);

// Bridge engine-level SceneTheme into DiagramTheme so that
// buildThemeRenderConfig() can derive fontUrl and fontSize multipliers.
const themedResolvedTheme = api.context.sceneTheme
  ? { ...resolvedTheme, sceneTheme: api.context.sceneTheme }
  : resolvedTheme;
```

Then update the `compileDiagram` call (line 311) to use `themedResolvedTheme`:

**Current:**

```ts
let diagramState = compileDiagram(
  { ...dsl, x: composedBounds.x, y: composedBounds.y, w: composedBounds.w, h: composedBounds.h, z: composedZ },
  resolvedTheme,
  onWarn,
);
```

**Change to:**

```ts
let diagramState = compileDiagram(
  { ...dsl, x: composedBounds.x, y: composedBounds.y, w: composedBounds.w, h: composedBounds.h, z: composedZ },
  themedResolvedTheme,
  onWarn,
);
```

**Do NOT change `makeDefaultDiagramState`.** This function creates the initial default state for a newly registered `DiagramWidget` (line 240). The default state is immediately overwritten by `api.setWidgetState(dsl.id, diagramState)` on line 338 — the compiled state with the bridged theme always replaces it before rendering. Adding `sceneTheme` to the default would be unnecessary complexity with no observable effect.

**Import note:** `SceneTheme` is already exported from `@brewsite/core`'s public API surface via `packages/core/src/theme/index.ts` (line 3). No barrel changes needed.

### B.2 — Testing

**File:** `packages/diagram/src/compiler/__tests__/handlers.test.tsx` (already exists)

This file already has a `makeContext()` helper (line 12–18) and the full test infrastructure (`resolveSceneFromDsl`, `WidgetRegistry`, `registerCoreHandlers`, `registerDiagramHandlers`). Add a new `describe` block using the existing pattern:

```tsx
import type { SceneTheme } from '@brewsite/core';

// Helper: extend existing makeContext() with sceneTheme
const makeContextWithTheme = (sceneTheme: SceneTheme) => ({
  ...makeContext(),
  sceneTheme,
});

const testSceneTheme: SceneTheme = {
  colorMode: 'dark' as const,
  font: { htmlFamily: 'Inter, sans-serif', webglFontUrl: 'https://example.com/inter.ttf' },
  fontSize: { heading: 2.4, body: 1.0, label: 1.0, caption: 1.0, annotation: 0.7 },
};

describe('registerDiagramHandlers — SceneTheme bridging', () => {
  it('bridges sceneTheme.font.webglFontUrl into themeConfig.fontUrl', () => {
    const registry = new WidgetRegistry();
    registerCoreHandlers();
    registerDiagramHandlers();

    const tree = (
      <Scene id="test">
        <Diagram id="d1">
          <ManualLayout />
          <DiagramNode id="n1" label="Node" position={[0, 0, 0]} />
        </Diagram>
      </Scene>
    );

    const { frame } = resolveSceneFromDsl(tree, makeContextWithTheme(testSceneTheme), registry);
    const state = frame.widgets['d1'] as DiagramState;
    expect(state.themeConfig.fontUrl).toBe('https://example.com/inter.ttf');
  });

  it('bridges sceneTheme.fontSize.label into effectiveLabelSizeFactor', () => {
    const registry = new WidgetRegistry();
    registerCoreHandlers();
    registerDiagramHandlers();

    const scaledTheme: SceneTheme = {
      ...testSceneTheme,
      fontSize: { ...testSceneTheme.fontSize, label: 1.5 },
    };

    const tree = (
      <Scene id="test">
        <Diagram id="d1">
          <ManualLayout />
          <DiagramNode id="n1" label="Node" position={[0, 0, 0]} />
        </Diagram>
      </Scene>
    );

    const { frame } = resolveSceneFromDsl(tree, makeContextWithTheme(scaledTheme), registry);
    const state = frame.widgets['d1'] as DiagramState;
    // effectiveLabelSizeFactor = theme.node.labelSizeFactor (1.0 for default theme) * 1.5
    expect(state.themeConfig.effectiveLabelSizeFactor).toBeCloseTo(1.5);
  });

  it('falls back to undefined fontUrl when no sceneTheme is provided', () => {
    const registry = new WidgetRegistry();
    registerCoreHandlers();
    registerDiagramHandlers();

    const tree = (
      <Scene id="test">
        <Diagram id="d1">
          <ManualLayout />
          <DiagramNode id="n1" label="Node" position={[0, 0, 0]} />
        </Diagram>
      </Scene>
    );

    const { frame } = resolveSceneFromDsl(tree, makeContext(), registry);
    const state = frame.widgets['d1'] as DiagramState;
    expect(state.themeConfig.fontUrl).toBeUndefined();
  });
});
```

**Testing approach:** These tests compile real DSL through the existing handler pipeline using the same pattern as the other tests in this file. No mocks — real `SceneSnapshotContext` objects with and without `sceneTheme`.

### B.3 — Verification

After Stream A + B are complete:

```bash
pnpm --filter @brewsite/core typecheck
pnpm --filter @brewsite/core test
pnpm --filter @brewsite/diagram typecheck
pnpm --filter @brewsite/diagram test
```

All must pass. Then visually verify in the dev server:

```bash
pnpm dev
```

Navigate to a diagram example that uses a slide deck SceneTheme (e.g., `slides-demo`). Diagram text should now use the SceneTheme's configured webgl font instead of troika's default Roboto.

---

## Stream C: Example Fixes — `apps/examples/`

**Package:** `apps/examples` (private, not published)
**Files modified:** 7
**Depends on:** Stream B complete (so font rendering is also correct during visual review)

### File List

| # | File | Key Concern |
|---|------|-------------|
| 1 | `apps/examples/src/slides-demo/deck.tsx` | Slide deck with embedded diagrams; check font rendering with SceneTheme bridge |
| 2 | `apps/examples/src/carousel-selection/scenes/sceneDiagramDetail.tsx` | Carousel diagram detail; check node sizes after aspect ratio fix |
| 3 | `apps/examples/src/carousel-selection/scenes/scenePicker.tsx` | Carousel picker; check diagram fits in carousel view |
| 4 | `apps/examples/src/views/scenes/scene3-carousel.tsx` | View carousel; check diagram rendering in carousel context |
| 5 | `apps/examples/src/core-showcase/scenes.tsx` | Core showcase; check all diagram variants |
| 6 | `apps/examples/src/input-showcase/scenes/scene2-camera-controls.tsx` | Input showcase; check diagram interactivity after changes |
| 7 | `apps/examples/src/canvas-region/scenes/viewerScene.tsx` | Canvas region; check diagram fits canvas bounds |

### Per-File Fix Procedure

For EACH file, the developer must:

**Step 1: Read and inventory all `<DiagramNode>` declarations.** Note each node's `id`, `size`, `shape`, `icon`, `label`, `sublabel` props.

**Step 2: Fix node sizes using these rules:**

- Nodes with `size={[W, H]}` where W ≠ H that were intended to be square (evidenced by context — e.g., a grid of "equal" nodes): change to `size={[N, N]}` where N is the larger of W, H.
- Nodes without explicit `size` use theme default `[4, 2]` — leave as-is unless visual inspection shows problems.
- Apply minimum size table:

| Content | Minimum Size | Notes |
|---------|-------------|-------|
| Label only | `[4, 2]` | Theme default |
| Label + sublabel | `[4, 2.5]` | Two text lines need vertical room |
| Icon + label | `[3, 3]` | Icon needs vertical space |
| Icon + label + sublabel | `[4, 3]` | Safe minimum for all three stacking |
| Icon + label + sublabel (circle/hex) | `[3.5, 3.5]` | Polygon content area < bounding box |
| Icon + label + sublabel (diamond) | `[4, 4]` | Diamond content area ~50% of bbox |

**Step 3: Check group labels.** Groups with long `label` strings may clip differently after aspect ratio correction. Verify visibility.

**Step 4: Check layout spacing.** `spacing` values in `<GridLayout>`, `<HierarchicalLayout>`, `<FlowLayout>` are in diagram units. If diagrams look cramped or spread out, adjust.

**Step 5: Visual verification.** Run `pnpm dev`, navigate to the example, compare before/after.

### Snapshot Baselines

After all 7 files are fixed, regenerate snapshots. The `apps/` directory is a single package (`@brewsite/apps`), with `examples/` and `website/` as subdirectories:

```bash
pnpm --filter @brewsite/apps vitest run --update
```

Snapshot files live at:
- `apps/examples/src/__tests__/__snapshots__/snapshotBaseline.test.ts.snap`
- `apps/examples/src/__tests__/__snapshots__/snapshotBaseline.test.tsx.snap`

Verify the diff is only diagram-related changes. Note: `apps/website/` has no snapshot files — only `apps/examples/` does.

---

## Stream D: Example Fixes — `apps/website/`

**Package:** `apps/website` (private, not published)
**Files modified:** 6
**Depends on:** Stream B complete
**Parallel with:** Stream C

### File List

| # | File | Key Concern |
|---|------|-------------|
| 8 | `apps/website/src/scenes/act5_act6/scene_01_simple_diagram.tsx` | Website simple diagram |
| 9 | `apps/website/src/scenes/act5_act6/scene_02_arch_overview.tsx` | Website architecture overview |
| 10 | `apps/website/src/scenes/act5_act6/scene_03_arch_detail.tsx` | Website architecture detail |
| 11 | `apps/website/src/scenes/act7/scene_02_combined.tsx` | Website combined scene |
| 12 | `apps/website/src/scenes/act1_act2/scene_01_core_intro.tsx` | Website core intro |
| 13 | `apps/website/src/scenes/act1_act2/scene_02_core_baked.tsx` | Website core baked |

### Fix Procedure

Same 5-step procedure as Stream C (see above). The website diagrams tend to be more complex (architecture overviews, multi-group layouts), so particular attention to:

- **Group nesting depth** — deeply nested groups may need padding/spacing adjustments
- **Edge routing** — verify edges still connect correctly after node size changes
- **Tilt rendering** — tilted diagrams (`tilt` prop) interact with aspect ratio correction; verify no distortion

### Snapshot Baselines

`apps/website/` has no snapshot test files — only `apps/examples/` has snapshots. The Stream C developer handles snapshot regeneration for the entire `@brewsite/apps` package after both C and D are complete (see Stream C snapshot section). Stream D developers do not need to run snapshot updates independently.

---

## Stream E: Bot Docs Updates — `@brewsite/claude-author`

**Package:** `packages/claude-author`
**Files modified:** 4 existing + 1 new
**Can start:** Immediately (content drafting), finalize after C/D

### E.1 — CREATE: `packages/claude-author/docs/guides/layout-spatial-awareness.md`

**Purpose:** Primary spatial reference for AI scene-authoring bots.

**Content structure:**

```markdown
# Layout and Spatial Awareness

## The Two Coordinate Systems

### 1. NVS (Normalized Viewport Space) — Percentage Layout
- Range: [0, 1]
- Used by: Element placement (x, y, w, h), Diagram viewport bounds, View bounds,
  TextBox regions, Chart placement, ImagePanel placement, Screen placement
- y=0 is TOP, y=1 is BOTTOM
- Example: x=0.5 y=0.5 w=0.4 h=0.3 = centered, 40% wide, 30% tall

### 2. World Coordinates — 3D Scene Space
- Range: unbounded (typically -10 to +10)
- Used by: Camera position/target, Lighting positions, Floor configuration ONLY
- Camera at position=[0, 2, 5] means 5 units from origin, 2 units up

## Diagram Node Sizes — A Special Case
- Inside <Diagram>, node size props are in diagram content units (NOT NVS, NOT world)
- size={[4, 4]} always renders as a square
- For ManualLayout, node sizes are in [0..1] NVS fractions

### Recommended Node Sizes
[Include the full minimum sizes table from the consolidated note]

## Quick Reference Table
[Include the full prop→coordinate system reference table from the audit note]
```

Full content specification is in `note_example-diagram-audit.md` § Work Item 3 — the developer should transcribe the complete content from there.

### E.2 — UPDATE: `packages/claude-author/docs/guides/nvs-spatial-model.md`

Changes:
1. Add prominent callout at top: *"For the complete spatial reference including diagram sizing, see `layout-spatial-awareness.md`."*
2. Add "World Coordinates vs NVS" section: *"Camera, Lighting, and Floor use world coordinates. Everything else uses NVS."*
3. Fix the unrealistic `<Diagram>` example showing `w={0.3} h={0.2}` — change to a realistic size like `w={0.8} h={0.9}` or remove if misleading.

### E.3 — UPDATE: `packages/claude-author/docs/diagram/nodes-edges-groups.md`

Changes:
1. Update `size` prop docs to state units clearly (diagram content units for auto-layout, NVS for manual layout)
2. Add "Sizing Guide" subsection after shape/icon docs with the recommended minimums table
3. Update `iconScale` docs: note that icons are automatically scaled down by fit-to-content layout
4. Add callout: *"If your node has an icon AND a sublabel, use `size={[4, 3]}` minimum for rectangles."*

### E.4 — UPDATE: `packages/claude-author/docs/guides/common-gotchas.md`

Add three new gotchas:
1. **"Node too small for icon + label + sublabel"** — explain fit-to-content behavior and recommended minimums
2. **"Diagram sizes are NOT NVS"** — `<DiagramNode size={[4, 3]}>` is diagram content units, not viewport fractions
3. **"Square nodes need equal width and height"** — `size={[4, 4]}` = square, `size={[4, 2]}` = rectangle

### E.5 — UPDATE: `packages/claude-author/docs/diagram/overview.md`

Add "Coordinate Systems in Diagrams" section explaining: `<Diagram x/y/w/h>` is NVS, but `<DiagramNode size>` inside the diagram is in diagram content units.

### E.6 — Rebuild Search Index

After all doc changes:

```bash
pnpm --filter @brewsite/claude-author build
```

The build script auto-discovers all `.md` files under `docs/`, chunks by `##` heading, embeds each chunk, and serializes to `index/orama-index.json`. No separate manifest update needed — the new `layout-spatial-awareness.md` file is automatically indexed.

### E.7 — Testing

Verify the build succeeds and the search index contains the new content:

```bash
pnpm --filter @brewsite/claude-author build
# Verify: index/orama-index.json should include chunks from layout-spatial-awareness.md
```

No unit tests needed for doc content — the search index build is the validation.

---

## Parallelization Assignment (5 Developers)

| Developer | Stream | Files | Depends On |
|-----------|--------|-------|------------|
| Dev 1 | **A** (core bridge) | `sceneTrackCompiler.ts`, `sceneTypes.ts`, `useSceneEngine.ts`, `sceneTrackCache.ts`, compiler test | None |
| Dev 2 | **B** (diagram bridge) | `handlers.ts`, handlers test | A complete |
| Dev 3 | **C** (examples fixes) | 7 files in `apps/examples/` | B complete |
| Dev 4 | **D** (website fixes) | 6 files in `apps/website/` | B complete |
| Dev 5 | **E** (bot docs) | 5 files in `packages/claude-author/docs/` | None (start drafting immediately; finalize after C/D) |

**No two developers modify the same file.** The only sequential dependency is A → B → (C ∥ D). Stream E is fully independent.

**Timeline:** A and B are small (~30 min each). C and D are the bulk of the work (visual review per file). E is documentation-only.

---

## Final Verification Checklist

After all 5 streams complete:

```bash
# 1. Full typecheck
pnpm typecheck

# 2. Full test suite
pnpm test

# 3. Visual verification
pnpm dev
# Navigate to each of the 13 example diagrams and verify:
# - Nodes with size={[N, N]} render as squares
# - Icon + label + sublabel nodes are readable
# - Group labels are visible
# - Edge routing is correct
# - Tilted diagrams render without distortion
# - Diagram text uses SceneTheme font (where SceneTheme is configured)

# 4. Bot docs search index
pnpm --filter @brewsite/claude-author build
# Verify new spatial awareness guide appears in search results
```

---

## Semver Impact

**Minor** — no public API signatures change in a breaking way. Changes:
- `CompileSceneTrackOptions`: new optional `sceneTheme` field (additive)
- `SceneSnapshotContext`: new optional `sceneTheme` field (additive, public type)
- Example files: visual adjustments only (private apps, no published API)
- Bot docs: documentation only

All changes are backward-compatible.
