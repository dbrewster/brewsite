---
title: "Embedding Modes — Cleanup & Backlog"
doc_type: note
status: active
owner: Toolkit Product
last_updated: 2026-03-15
change_history:
  - date: 2026-03-14
    author: "Toolkit Product"
    summary: "Initial note. Captures the four named embedding modes, SceneReel prop forwarding debt (P0), Canvas Region example (P2), and EngineARContainer naming audit (P3). Embedding guide is tracked separately."
  - date: 2026-03-15
    author: "Toolkit Product"
    summary: "Codebase audit against note claims. Corrected P0: removed cameraInteractionDefaults (already forwarded since initial SceneReel), removed disableDefaultInputSpec (prop does not exist on SceneEngine — must be a new feature if needed, not a forwarding fix). Added note that deprecated themeFamily/themePolarity are also not forwarded but theme supersedes them. Updated P2: InputHud exists as a stub (returns null) — sequencing dependency is unresolved. Updated P3: context rename to ViewportScaleContext already shipped; only the component name EngineARContainer remains. Added SceneReel source file references."
  - date: 2026-03-15
    author: "Toolkit Product"
    summary: "PM debate resolved. P0: finalized 4-prop list, added acceptance criterion to update/remove stale DEBT comment text. disableDefaultInputSpec removed entirely — consumers can declare an empty <InputController> to suppress default injection; a cleaner opt-out is a separate PRD if there's demand. P2: removed InputHud sequencing dependency — example ships without InputHud rendering (stub). InputHud rendering is tracked separately. P3: no changes."
---

# Embedding Modes — Cleanup & Backlog

## Context

BrewSite supports four distinct embedding modes that exist as first-class runtime behaviors but have never been named, documented as choices, or demonstrated side-by-side. The result is that consumers hit the API without a mental model, reverse-engineer the pattern from examples, and frequently author the wrong composition for their use case.

The architecture is sound. The composability model (`SceneEngine` as context root, individual primitives layered on top) is the right design. This backlog is not a refactor or repackage — it is a targeted set of fixes and additions that make the existing architecture discoverable and correct.

The embedding guide is tracked separately.

---

## The Four Embedding Modes

These are the canonical named modes. All four are fully supported today.

### 1. Scroll-Driven
Full-page sticky canvas. Scroll Y drives scene progression. The primary mode for marketing sites and long-form product storytelling.

**Canonical composition:**
```tsx
<SceneEngine plugins={plugins}>
  <ScrollStage scrollHeightMode="scene-count" pixelsPerScene={1200}>
    <BackgroundLayer />
    <SceneCanvas />
    <EngineOverlayHost />
    <InputCoordinator inertiaSensitivity={0.008} />
  </ScrollStage>
</SceneEngine>
```

**Reference:** `apps/examples/src/core-showcase/CoreShowcasePage.tsx`

---

### 2. Embedded Player
Fixed-size container. Progression via time auto-advance, keyboard, or programmatic API. No page scroll involvement. Primary mode for docs, product tours, and inline marketing blocks.

**Canonical composition:**
```tsx
<SceneReel height={400} plugins={[corePlugin()]}>
  <Scene id="step1">...</Scene>
  <Scene id="step2">...</Scene>
  <TimeInput duration={4} loop pauseWhenHidden={{ y: 0.5 }} />
</SceneReel>
```

**Reference:** `packages/core/README.md`

---

### 3. Programmatic / Controlled
External UI (buttons, sidebar nav, custom progress bar) drives scene navigation. No scroll. No auto-advance. The consumer controls progress entirely.

**Canonical composition:**
```tsx
function SceneNav() {
  const goToScene = useGoToScene();
  return (
    <nav>
      <button onClick={() => goToScene('overview')}>Overview</button>
      <button onClick={() => goToScene('details')}>Details</button>
    </nav>
  );
}

<SceneEngine plugins={[corePlugin()]}>
  <Scene id="overview">...</Scene>
  <Scene id="details">...</Scene>
  <SceneNav />
  <SceneCanvas />
</SceneEngine>
```

Alternatively, `<ControlledInput value={externalProgress} />` for continuous external drives (scrubber, animation library, etc.).

---

### 4. Canvas Region
Self-contained interactive 3D region. No scene navigation at all — the canvas owns its own camera/interaction input. Primary mode for product viewers, embedded diagrams, and interactive visualizations embedded in a page that otherwise owns scrolling.

**Canonical composition:**
```tsx
<SceneReel height={500} plugins={[corePlugin(), modelPlugin()]}>
  <Scene id="viewer">
    <InputController>
      <Action type="camera.orbit" maps={[
        { kind: 'pointer', event: 'drag', button: 'left', axis: 'xy' }
      ]} cameraId="main" />
      <Action type="camera.zoom" maps={[
        { kind: 'pinch' },
        { kind: 'wheel', modifiers: ['meta'] }
      ]} cameraId="main" />
      <Action type="camera.reset" maps={[
        { kind: 'key', key: 'r' }
      ]} cameraId="main" />
    </InputController>
    {/* model, lighting, etc. */}
  </Scene>
</SceneReel>
```

**Note:** After the `createDefaultInputSpec()` major release, the `<InputController>` block above is not required — the default spec includes orbit, zoom, pan, and reset bindings automatically. Canvas Region becomes even simpler.

**Current gap:** No dedicated example exists in `apps/examples/`. See P2 below.

---

## Backlog Items

### P0 — Fix `SceneReel` Prop Forwarding

**Status:** Known DEBT. Must be resolved in the current input system major release.

`SceneReel` is the convenience entry point for Embedded Player and Canvas Region modes, but it does not forward several important `SceneEngine` props. Consumers who need any of the missing props must abandon `SceneReel` entirely and compose manually, with no guidance that this is the right move or how to do it.

**Props `SceneReel` must accept and forward to `SceneEngine`:**

| Prop | Added When | Why It Matters | Status |
|---|---|---|---|
| `theme` | Theme overhaul | New `ActiveTheme` prop; supersedes deprecated `sceneTheme` (which IS forwarded) | ❌ Missing |
| `scrollSource` | Existing | Viewport-relative scroll for context lifecycle management (multi-panel layouts) | ❌ Missing |
| `defaultTransitionDuration` | Input system major | Animated navigation — inaccessible via `SceneReel` without this | ❌ Missing |
| `defaultTransitionEasing` | Input system major | Easing for animated navigation | ❌ Missing |

**Props verified as already forwarded (no action needed):**
- `cameraInteractionDefaults` — forwarded since initial SceneReel implementation (`SceneReel.tsx:28,83`)
- `sceneTheme` (deprecated) — forwarded (`SceneReel.tsx:31,86`)
- `plugins`, `id`, `timingProfile`, `primaryCameraId`, `primaryCanvasActionTargetId`, `invalidateCacheToken`, `maxAnimBoostPerFrame` — all forwarded
- All lifecycle callbacks (`onReady`, `onError`, `onWidgetError`, `onCompileWarning`) — all forwarded

**Props that do NOT exist on `SceneEngine` (removed from this list):**
- ~~`disableDefaultInputSpec`~~ — This prop does not exist on `SceneEngineProps`. Default input spec injection is handled in the compiler (`sceneTrackCompiler.ts:426-430`): if any scene declares an `<InputController>`, the default is not injected. Consumers who need to suppress all default bindings can declare an empty `<InputController />` (compiles to a spec with zero actions, which satisfies the `anyHasInput` guard). A cleaner opt-out API (e.g., a `SceneEngine` prop threading through to `compileSceneTrack` options) is a separate feature if there's demand — not part of this cleanup.

**Note on deprecated props:** `themeFamily` and `themePolarity` exist on `SceneEngine` (deprecated) but are NOT forwarded by `SceneReel`. Since `theme` supersedes both, forwarding `theme` alone is sufficient — no need to forward deprecated props.

**Source:** `packages/core/src/player/SceneReel.tsx` — DEBT comment on line 13 references this gap.

**Acceptance criteria:**
- The four missing props above accepted on `SceneReel` and forwarded to the underlying `SceneEngine`
- `SceneReel` type signature updated (add to `SceneReelProps` interface)
- DEBT comment in source (`SceneReel.tsx:13`) removed or updated — the current text references `themeFamily, themePolarity, or scrollSource` which predates the `theme`, `defaultTransitionDuration`, and `defaultTransitionEasing` additions to `SceneEngine`. If all gaps are closed, remove entirely.
- README example for Embedded Player mode uses `defaultTransitionDuration` via `SceneReel`

---

### P2 — Canvas Region Example

**Status:** Unbuilt. Unblocked — ships after P0 prop forwarding fix.

No example in `apps/examples/` demonstrates the Canvas Region mode. This is the pattern websites and product pages need most when embedding a 3D viewer — but it is invisible in the current example set.

Existing example directories: `core-showcase`, `input-showcase`, `model-showcase`, `views`, `media-screen-demo`, `chart`, `slides-demo`, `theme-gallery`, and several `brewflow-*` demos. None demonstrate an embedded Canvas Region pattern.

**Scope:**
- New example page in `apps/examples/` — "Canvas Region / Product Viewer"
- Uses `SceneReel` (after P0 prop forwarding fix is in place)
- Single scene; no scene navigation
- Model or diagram element as the 3D content
- Camera orbit, zoom, pan, reset via default input spec (no hand-authored `<InputController>`)
- Page layout demonstrates the canvas as an embedded region within a normal HTML page (sidebar or prose alongside)

**InputHud note:** `InputHud` rendering is tracked separately (the component is currently a stub returning `null`; the data model and event plumbing are implemented). When InputHud rendering ships, the Canvas Region example is a natural place to demonstrate it — add `<InputHud position="bottom-right" />` at that time.

---

### P3 — `EngineARContainer` Naming Audit

**Status:** Low urgency. Cosmetic, but compounds onboarding friction for new consumers.

`EngineARContainer` is the component that provides a fixed aspect-ratio container with four scale modes (`fit-width`, `fit-height`, `contain`, `cover`). Its name is opaque. The NVS system documentation calls it "Normalized Viewport Space" which is the right conceptual frame, but that label is equally inaccessible to a consumer trying to embed a scene in a fixed layout.

**Current state:** The associated context has already been renamed. `ViewportScaleContext` is the new name; `EngineARContainerContext` is a deprecated alias (`EngineARContainer.tsx:100-101`). Both are exported from `player/index.ts`. The type alias `EngineARContainerContextValue` → `ViewportScaleContextValue` is also deprecated. Only the **component name** `EngineARContainer` itself remains to be addressed.

**Exported surface (`player/index.ts:36-41`):**
- `EngineARContainer` (component)
- `EngineARContainerProps` (type)
- `ScaleMode` (type)
- `ViewportScaleContextValue` (type — current name)
- `EngineARContainerContextValue` (type — deprecated alias)
- `ViewportScaleContext` (context — current name)
- `EngineARContainerContext` (context — deprecated alias)
- `computeContainerDims` (utility function)

**Options (not a decision, flagging for future milestone):**
- Export an alias: `SceneRegion` or `ContainedScene` alongside `EngineARContainer`
- Rename in a major version with a one-release alias deprecation
- Leave as-is and document it thoroughly in the embedding guide

This does not block anything. Revisit at the v1.0 milestone planning session when breaking changes can be batched.

---

## Explicit Non-Goals

These were considered and rejected during the audit. Do not revisit without new evidence.

- **No package repackaging.** The split across `@brewsite/core`, `@brewsite/diagram`, `@brewsite/model`, and `@brewsite/charts` is correct. The embedding modes do not map to package boundaries.
- **No refactor of the composability model.** `SceneEngine` as context root with layered primitives is the right design. `SceneReel` as a convenience shortcut on top of it is the right pattern.
- **No new "presentation mode" abstraction.** The four modes are already fully supported — they need names and documentation, not a new API layer.
- **No `IScrollSource` / Lenis integration story.** The interface exists; ship a note about it in the embedding guide. Do not invest in a first-class custom scroll driver story until there is consumer demand.
- **No rename of `SceneEngine`.** Used everywhere, breaking change, and the concept is clear once explained. Cosmetic churn with no DX benefit.
