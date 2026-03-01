---
title: "BrewSite Core — HUD Overlay System"
doc_type: prd
status: deprecated
owner: brewsite-product-manager
last_updated: 2026-03-01
change_history:
  - date: 2026-02-28
    author: "Toolkit Product"
    summary: "Initial PRD created. Documents the full HUD overlay system for @brewsite/core: two-tier architecture, DSL authoring surface, compiled primitives, HudPhaseContext, HudOverlay renderer, anime.js preset sub-module, contentSlots, and authoring patterns."
  - date: 2026-03-01
    author: "Toolkit Product"
    summary: "Compiled HUD pipeline deleted as part of engine decomposition. <Hud> and <HudItem> DSL components removed. Scene overlay content is now authored as HTML children inside <Scene> and rendered by EngineOverlayHost. hud/animejs/ utilities retained for animating overlay content. PRD status set to deprecated."
---

# BrewSite Core — HUD Overlay System (Deprecated)

## Status

This feature is deprecated. The compiled HUD pipeline — `<Hud>`, `<HudItem>`, `hudCompiler.ts`, `HudOverlay.tsx`, `HudPhaseContext`, and all related types — has been removed from `@brewsite/core`.

Scene overlay content is authored as plain HTML children directly inside `<Scene>` and rendered by the `EngineOverlayHost` player primitive. The `hud/animejs/` sub-module is retained and continues to function as a standalone utility for animating overlay content.

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

## 2. What Is Retained

The `hud/animejs/` sub-module is **retained** and continues to ship as `@brewsite/core/hud/animejs`. It is independently useful for animating overlay content written as HTML children in `<Scene>`. It does not depend on the removed HUD pipeline.

Retained exports from `hud/animejs/`:
- `useScrollTimeline` — scrubs an anime.js timeline to scroll blockProgress
- `Fade`, `MidFade`, `SlideUp`, `SlideDown`, `ScrollOn`, `ScrollOff` — animation preset components

The `hud/animejs/` sub-module now reads `blockProgress` from a different context source — consumers must wire it manually or use the `EngineOverlayHost` scene change lifecycle. Refer to the current `hud/animejs/` README for updated integration guidance.

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

## 5. hud/animejs Sub-Module (Retained)

The `hud/animejs/` sub-module ships unchanged and is available at `@brewsite/core/hud/animejs`.

```typescript
import { useScrollTimeline, SlideUp, Fade } from '@brewsite/core/hud/animejs';
```

These utilities are still useful for animating HTML overlay content that is authored as children of `<Scene>`. They operate on React refs and anime.js timelines — they have no dependency on the removed HUD pipeline.

**Peer dependency:** `animejs` must be installed by the consumer. Importing `@brewsite/core/hud/animejs` without `animejs` installed throws a module resolution error at import time.

```json
{
  "exports": {
    ".": "./dist/index.js",
    "./hud/animejs": "./dist/hud/animejs/index.js"
  }
}
```

---

## 6. Dependencies (Retained Sub-Module Only)

- **anime.js** (optional peer dependency, sub-path only): `AnimeTimelineInstance`, `anime.timeline()`, `timeline.seek()`
- **React** (peer): `React.useRef`, `React.useContext`

No dependency on any removed HUD infrastructure.
