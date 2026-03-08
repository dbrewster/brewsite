---
title: "BrewSite Core — HUD Overlay System"
doc_type: prd
status: deprecated
owner: brewsite-product-manager
last_updated: 2026-03-07
change_history:
  - date: 2026-02-28
    author: "Toolkit Product"
    summary: "Initial PRD created. Documents the full HUD overlay system for @brewsite/core: two-tier architecture, DSL authoring surface, compiled primitives, HudPhaseContext, HudOverlay renderer, anime.js preset sub-module, contentSlots, and authoring patterns."
  - date: 2026-03-01
    author: "Toolkit Product"
    summary: "Compiled HUD pipeline deleted as part of engine decomposition. <Hud> and <HudItem> DSL components removed. Scene overlay content is now authored as HTML children inside <Scene> and rendered by EngineOverlayHost. hud/animejs/ utilities retained for animating overlay content. PRD status set to deprecated."
  - date: 2026-03-07
    author: "Toolkit Product"
    summary: "hud/animejs/ sub-module fully removed from @brewsite/core. The Fade, MidFade, SlideUp, SlideDown, ScrollOn, ScrollOff preset components and useScrollTimeline have been deleted from packages/core/src/hud/animejs/. The animejs package is no longer a production dependency of @brewsite/core. These utilities are available as copy-paste recipes in apps/examples/. Consumers who were importing from @brewsite/core/hud/animejs must migrate to a local copy or use a standalone animation library."
---

# BrewSite Core — HUD Overlay System (Deprecated)

## Status

This feature is deprecated. The compiled HUD pipeline — `<Hud>`, `<HudItem>`, `hudCompiler.ts`, `HudOverlay.tsx`, `HudPhaseContext`, and all related types — has been removed from `@brewsite/core`.

Scene overlay content is authored as plain HTML children directly inside `<Scene>` and rendered by the `EngineOverlayHost` player primitive. The `hud/animejs/` sub-module has also been removed — see Section 2.

See `prd_scene_authoring.md` for the current overlay authoring surface and `prd_player_runtime.md` for `EngineOverlayHost` documentation.

---

## 1. What Was Removed

The following modules, types, and exports have been deleted:

**DSL components (compiler layer):**
- `<Hud>` — `compiler/blocks/hudBlocks.tsx`
- `<HudItem>` — `compiler/blocks/hudBlocks.tsx`

**Compiler infrastructure:**
- `hudCompiler.ts` — compiled `HudItemDefinition[]` to `HudItemResolved[]` per tick
- `pushHudItem` — removed from `CompileApi`

**Runtime infrastructure:**
- `HudOverlay.tsx` — React component that rendered compiled HUD primitives
- `HudItem.tsx` (internal renderer)
- `HudPhaseContext.ts` — React context providing `phase` and `blockProgress`

**Types:**
- `HudItemDefinition`
- `HudItemResolved`
- `HudPhase`

**SceneFrame / SceneTrackTick fields:**
- `SceneFrame.hudItems` — removed
- `SceneTrackTick.hudPrimitives` — removed
- `SceneFrameDelta.hudItems` — removed

**ScenePlayer prop:**
- `contentSlots` — removed (the overlay host pattern replaces it)

---

## 2. hud/animejs Removed

The `hud/animejs/` sub-module has been **removed** from `@brewsite/core`. The following files no longer exist in `packages/core/src/hud/animejs/`:
- `transitions.tsx` — exported `Fade`, `MidFade`, `SlideUp`, `SlideDown`, `ScrollOn`, `ScrollOff`
- `useScrollTimeline.ts` — scrubbed an anime.js timeline to scroll blockProgress
- `index.ts` — barrel export

The `animejs` package has been removed as a production dependency of `@brewsite/core`.

**Migration:** Copy the preset components you need from `apps/examples/` into your own codebase. They are standalone React components with no dependency on the removed HUD pipeline. You must add `animejs` as a dependency in your application directly.

---

## 3. Migration

Replace `<Hud>` and `<HudItem>` blocks with HTML children directly inside `<Scene>`. The `EngineOverlayHost` player primitive renders the current scene's overlay children over the canvas, with a CSS fade-in on scene change.

**Before (removed):**

```tsx
<Scene id="features">
  <Model id="bot" type="mesh" position={[0, 0, 0]} />
  <Hud>
    <HudItem id="label-battery" style={{ position: 'absolute', top: '20%', left: '10%' }}>
      <div className="feature-callout">Battery Life</div>
    </HudItem>
  </Hud>
</Scene>
```

**After (current):**

```tsx
<Scene id="features">
  <Model id="bot" type="mesh" position={[0, 0, 0]} />
  <div style={{ position: 'absolute', top: '20%', left: '10%' }}>
    <div className="feature-callout">Battery Life</div>
  </div>
</Scene>
```

The `EngineOverlayHost` component handles rendering. It is included automatically inside `ScenePlayer`. When composing the engine manually with `EngineProvider`, mount `EngineOverlayHost` alongside `SceneCanvas`.

For persistent overlay content (navigation arrows, progress dots) that must appear regardless of the active scene, render those components as siblings of `EngineOverlayHost` — they are not part of scene overlay children.

---

## 4. What Replaced the HUD System

| Old mechanism | Replacement |
|---|---|
| `<Hud><HudItem id="x">...</HudItem></Hud>` in scene DSL | HTML children directly in `<Scene>` |
| `HudOverlay` — rendered compiled primitives | `EngineOverlayHost` — renders current scene's ReactNode overlay |
| `HudPhaseContext` — provided `phase` / `blockProgress` | No direct replacement. Use `useSceneProgress()` or animate on mount. |
| `contentSlots` on `ScenePlayer` | Sibling components alongside `EngineOverlayHost` |
| `SceneFrame.hudItems` field | `SceneFrame.sceneOverlay?: ReactNode` |
| `SceneTrackTick.hudPrimitives` | Removed. Overlays are per-scene ReactNodes on `SceneTrack.sceneOverlays`. |

---

## 5. Migration from hud/animejs

The `@brewsite/core/hud/animejs` import path no longer exists. The `./hud/animejs` subpath has been removed from `@brewsite/core`'s exports map. The `animejs` package is no longer a dependency of `@brewsite/core`.

Copy the animation preset components (`Fade`, `MidFade`, `SlideUp`, `SlideDown`, `ScrollOn`, `ScrollOff`) and `useScrollTimeline` from `apps/examples/` into your project. Add `animejs` as a direct dependency in your application's `package.json`. These components have no dependency on any BrewSite infrastructure — they are self-contained React animation utilities.

---

## 6. Dependencies

- **React** (peer): used by overlay authoring components.

The `animejs` peer dependency has been removed from `@brewsite/core`.
