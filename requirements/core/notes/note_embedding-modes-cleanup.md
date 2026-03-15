---
title: "Embedding Modes — Cleanup & Backlog"
doc_type: note
status: completed
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
  - date: 2026-03-15
    author: "Toolkit Product"
    summary: "All three backlog items implemented and verified. P0: SceneReel now forwards theme, scrollSource, defaultTransitionDuration, defaultTransitionEasing to SceneEngine; DEBT comment removed; 4 new tests pass. P2: Canvas Region example at apps/examples/src/canvas-region/ with two-column layout (sidebar + 3D diagram viewer); uses default input spec for camera interaction; ships without InputHud. P3: ViewportScaleContainer exported as stable alias for EngineARContainer; ViewportScaleContainerProps type alias also exported; no deprecation — both names stable. README updated with defaultTransitionDuration example. Note status set to completed."
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

**Reference:** `apps/examples/src/canvas-region/CanvasRegionPage.tsx`

---

## Backlog Items

### P0 — Fix `SceneReel` Prop Forwarding

**Status:** Complete.

`SceneReel` forwards all `SceneEngine` props that consumers need for Embedded Player and Canvas Region modes.

**Props added to `SceneReel` and forwarded to `SceneEngine`:**

| Prop | Added When | Why It Matters | Status |
|---|---|---|---|
| `theme` | Theme overhaul | New `ActiveTheme` prop; supersedes deprecated `sceneTheme` (which IS forwarded) | ✅ Shipped |
| `scrollSource` | Existing | Viewport-relative scroll for context lifecycle management (multi-panel layouts) | ✅ Shipped |
| `defaultTransitionDuration` | Input system major | Animated navigation — inaccessible via `SceneReel` without this | ✅ Shipped |
| `defaultTransitionEasing` | Input system major | Easing for animated navigation | ✅ Shipped |

**Props verified as already forwarded (no action needed):**
- `cameraInteractionDefaults` — forwarded since initial SceneReel implementation (`SceneReel.tsx:28,83`)
- `sceneTheme` (deprecated) — forwarded (`SceneReel.tsx:31,86`)
- `plugins`, `id`, `timingProfile`, `primaryCameraId`, `primaryCanvasActionTargetId`, `invalidateCacheToken`, `maxAnimBoostPerFrame` — all forwarded
- All lifecycle callbacks (`onReady`, `onError`, `onWidgetError`, `onCompileWarning`) — all forwarded

**Props that do NOT exist on `SceneEngine` (removed from this list):**
- ~~`disableDefaultInputSpec`~~ — This prop does not exist on `SceneEngineProps`. Default input spec injection is handled in the compiler (`sceneTrackCompiler.ts:426-430`): if any scene declares an `<InputController>`, the default is not injected. Consumers who need to suppress all default bindings can declare an empty `<InputController />` (compiles to a spec with zero actions, which satisfies the `anyHasInput` guard). A cleaner opt-out API (e.g., a `SceneEngine` prop threading through to `compileSceneTrack` options) is a separate feature if there's demand — not part of this cleanup.

**Note on deprecated props:** `themeFamily` and `themePolarity` exist on `SceneEngine` (deprecated) but are NOT forwarded by `SceneReel`. Since `theme` supersedes both, forwarding `theme` alone is sufficient — no need to forward deprecated props.

**Source:** `packages/core/src/player/SceneReel.tsx`

**Acceptance criteria (all met):**
- ✅ The four props accepted on `SceneReel` and forwarded to the underlying `SceneEngine`
- ✅ `SceneReel` type signature updated (`SceneReelProps` interface)
- ✅ DEBT comment removed from source
- ✅ README example for Embedded Player mode uses `defaultTransitionDuration` via `SceneReel`
- ✅ Four new test cases pass

---

### P2 — Canvas Region Example

**Status:** Complete.

A Canvas Region example exists at `apps/examples/src/canvas-region/` demonstrating the embedded 3D viewer pattern.

**What shipped:**
- New example page at `/examples/canvas-region` — "Canvas Region — Embedded 3D Viewer"
- Two-column layout: sidebar prose (360px) + 3D diagram canvas (flex: 1)
- Uses `SceneReel` with the new `theme` and `defaultTransitionDuration` props
- Single scene with a 3-node architecture diagram (`DiagramCanvas` + `Diagram`)
- Camera orbit, zoom, pan, reset via default input spec — no hand-authored `<InputController>`
- No `InputHud` — ships separately (stub returning null)

**Files:** `CanvasRegionPage.tsx`, `widgetSetup.ts`, `scenes/viewerScene.tsx`, plus `App.tsx` route entry.

**InputHud note:** When InputHud rendering ships, the Canvas Region example is a natural place to demonstrate it — add `<InputHud position="bottom-right" />` at that time.

---

### P3 — `EngineARContainer` Naming Audit

**Status:** Complete. Additive alias shipped — non-breaking.

`ViewportScaleContainer` is now exported as a stable alias for `EngineARContainer`. `ViewportScaleContainerProps` is exported as a type alias for `EngineARContainerProps`. Both names are stable — no deprecation on either.

**Exported surface (`player/index.ts`):**
- `EngineARContainer` (component — original name, stable)
- `ViewportScaleContainer` (component — alias, stable)
- `EngineARContainerProps` (type — original name, stable)
- `ViewportScaleContainerProps` (type — alias, stable)
- `ScaleMode` (type)
- `ViewportScaleContextValue` (type — current name)
- `EngineARContainerContextValue` (type — deprecated alias)
- `ViewportScaleContext` (context — current name)
- `EngineARContainerContext` (context — deprecated alias)
- `computeContainerDims` (utility function)

The naming family is now internally consistent: `ViewportScale{Context, ContextValue, Container, ContainerProps}`. A full rename of `EngineARContainer` (with deprecation) is deferred to v3 planning when breaking changes can be batched.

---

## Explicit Non-Goals

These were considered and rejected during the audit. Do not revisit without new evidence.

- **No package repackaging.** The split across `@brewsite/core`, `@brewsite/diagram`, `@brewsite/model`, and `@brewsite/charts` is correct. The embedding modes do not map to package boundaries.
- **No refactor of the composability model.** `SceneEngine` as context root with layered primitives is the right design. `SceneReel` as a convenience shortcut on top of it is the right pattern.
- **No new "presentation mode" abstraction.** The four modes are already fully supported — they need names and documentation, not a new API layer.
- **No `IScrollSource` / Lenis integration story.** The interface exists; ship a note about it in the embedding guide. Do not invest in a first-class custom scroll driver story until there is consumer demand.
- **No rename of `SceneEngine`.** Used everywhere, breaking change, and the concept is clear once explained. Cosmetic churn with no DX benefit.
