---
title: NVS Spatial Model
doc_type: guide
owner: claude-author
status: active
updated: 2026-03-19
---

> **Complete spatial reference:** For the full spatial guide including diagram node sizing, world coordinates, and a prop-to-coordinate-system quick reference table, see [layout-spatial-awareness.md](./layout-spatial-awareness.md).

## World Coordinates vs NVS

Camera, Lighting, and Floor use **world coordinates** (unbounded Three.js units, typically -10 to +10). Everything else — Diagrams, Models, Charts, ImagePanels, Screens, Views, TextBoxes — uses **NVS** (Normalized Viewport Space, range [0, 1]).

Inside a `<Diagram>`, node `size` props also use NVS fractions [0..1] — the same system as the diagram viewport itself. See the sizing recipes table in [layout-spatial-awareness.md](./layout-spatial-awareness.md) for recommended values.

## What NVS Is

NVS (Normalized Viewport Space) is the coordinate system used for all 3D element placement in BrewSite scenes.

- X axis: `0` = left edge, `1` = right edge
- Y axis: `0` = top edge, `1` = bottom edge
- Z axis: depth from camera, used for layering (higher Z = further from camera)

Think of it as CSS percentage-based positioning — an element at `x={0.5} y={0.5}` is horizontally and vertically centered. An element at `x={0} y={0}` is at the top-left corner.

**The single most important thing to memorize:** Y=0 is TOP, Y=1 is BOTTOM. This is the opposite of standard 3D Y-up convention. The NVS system automatically applies a Y-flip when converting to Three.js world coordinates — scene authors never deal with the flip, but you must author Y values as if the origin is top-left.

## How Elements Use NVS

DSL elements accept `x`, `y`, `w`, `h`, and `z` props. These are all NVS values in the range `[0, 1]`:

```tsx
// Centered element, 40% wide, 60% tall
<Model id="hero" type="Robot" x={0.3} y={0.2} w={0.4} h={0.6} z={0} />

// Right half of the viewport, full height
<ImagePanel id="panel" x={0.5} y={0} w={0.5} h={1} z={0} />

// Full-width diagram, nearly full height (typical for architecture diagrams)
<Diagram id="arch" x={0.05} y={0.05} w={0.9} h={0.9} z={0} />
```

`x` and `y` set the **center** of the element in some elements and the **position** of the bounding box in others — check the specific element's docs. For `Model`, `x` and `y` define the NVS center of the element's bounding region.

## NVS Scale

`w` and `h` define the element's NVS extent. `w={1}` means the element spans the full viewport width. `w={0.5}` means half the viewport width.

There is no separate "scale=1 means X world units" rule to memorize. Scale is always relative to the viewport: a `w={0.5}` element is half the viewport width regardless of window size. The engine recomputes world coordinates on every resize.

For `Model` elements, there is an additional `scale` prop that is a viewport-relative scale factor. The world-space scale applied to the model is `scale * visibleWorldHeight`. A value of `0.06` is typical for a human figure (6% of viewport height). This is distinct from the NVS `w`/`h` region that controls placement.

## The EngineARContainer and Aspect Ratio

`EngineARContainer` is an optional but recommended wrapper that maintains a fixed aspect ratio regardless of the viewport size. All NVS coordinates are computed relative to the AR-locked container, not the raw window.

```tsx
<SceneEngine plugins={plugins}>
  {/* scenes */}
  <ScrollStage scrollHeightMode="scene-count" pixelsPerScene={800}>
    <EngineARContainer aspectRatio={16 / 9} scaleMode="fit-width">
      <BackgroundLayer style={{ position: 'absolute', inset: 0, zIndex: 0 }} />
      <SceneCanvas style={{ position: 'absolute', inset: 0, zIndex: 1 }} />
      <EngineOverlayHost />
    </EngineARContainer>
    <InputCoordinator />
  </ScrollStage>
</SceneEngine>
```

Props:

- `aspectRatio` — The fixed aspect ratio. Default: `16/9`.
- `referenceWidth` — Pixel width at which `--scene-scale = 1.0`. Default: `1920`. Used to scale HTML overlay text proportionally.
- `scaleMode` — How the AR-locked box fits in its parent:
  - `'fit-width'` (default) — width fills parent; height derived from AR
  - `'fit-height'` — height fills parent; width derived from AR
  - `'contain'` — both dimensions fit; shorter axis letterboxes
  - `'cover'` — both dimensions fill; excess is clipped

`EngineARContainer` injects the `--scene-scale` CSS custom property on every resize. Overlay components can use `calc(24px * var(--scene-scale))` for text that scales proportionally with the container.

`ScrollStage` and `SceneReel` both detect `EngineARContainerContext` and use `computedArHeight` for their sticky stage height automatically.

## NVS Stability Under Camera Interaction

NVS-positioned content (Diagrams, Charts, Screens, Models, Views) is stable under camera interaction. When a user zooms, orbits, or pans the camera via `InputController` actions or the legacy `interaction` prop, NVS-positioned elements do not shift in world space. The NVS coordinate mapping uses the scene author's compiled camera state, not the live Three.js camera. This means you can freely enable camera orbit, zoom, and pan on scenes with NVS-positioned content without worrying about elements drifting.

The NVS center point (`toWorld(0.5, 0.5)`) maps to the camera's look-at target point. For `nvsViewport` cameras (the standard for diagrams and charts), the target is at the origin, so center mapping is identical to world origin. For `world` and `orbit` mode cameras, NVS center tracks the authored `target` position.

## What Happens on Resize

When the viewport resizes, the engine recomputes all world-space coordinates via the NVS coordinate service. The service takes an `NVSCameraParams` object (distance, FOV, and optional center offset) derived from the compiled camera state — not the live Three.js camera. The NVS-to-world transform is:

```
worldX = (nvsX - 0.5) * visibleWorldWidth  + centerX
worldY = -(nvsY - 0.5) * visibleWorldHeight + centerY   // Y-flip here
```

`visibleWorldWidth` and `visibleWorldHeight` come from the camera FOV and distance. `centerX` and `centerY` come from the camera's look-at target. Distance is computed as full 3D distance from camera position to target, not just the Z component — orbit-mode cameras at any azimuth angle produce correct NVS mappings. Widgets receive a fresh `NVSCoordService` each frame so element positions are always pixel-accurate.

You do not need to think about this conversion. NVS values you write in DSL are stable across window sizes and stable under camera interaction. An element at `x={0.5} y={0.5}` is always centered, regardless of whether the viewport is 800px or 1920px wide, and regardless of whether the user has orbited or zoomed the camera.

## Common Layout Patterns

### Centered element

```tsx
<Model id="hero" type="Robot" x={0.5} y={0.5} w={0.5} h={0.8} z={0} />
```

### Top-right corner badge

```tsx
<ImagePanel id="badge" x={0.75} y={0.05} w={0.2} h={0.15} z={0} />
```

### Bottom strip (full width, lower quarter)

```tsx
<Diagram id="timeline" x={0} y={0.75} w={1} h={0.25} z={0} />
```

### Left panel + right panel split

```tsx
// Left 45%
<Diagram id="left-diagram" x={0} y={0} w={0.45} h={1} z={0} />

// Right 55%
<Model id="right-model" type="Robot" x={0.45} y={0} w={0.55} h={1} z={0} />
```

### Using View for a contained region

`View` creates a named NVS subregion. Elements inside a `View` author in the View's local coordinate space (0,0 = View's top-left, 1,1 = View's bottom-right):

```tsx
<View id="right-panel" x={0.4} y={0} w={0.6} h={1} padding={[0.05, 0.04]}>
  <Model id="robot" type="Robot" x={0} y={0} w={1} h={1} z={0} />
</View>
```

`padding` is `[topBottom, leftRight]` or a full `[top, right, bottom, left]` array, as fractions of the View's dimensions.

## Z-Depth Layering

`z` controls depth layering. Elements with lower `z` are closer to the camera (rendered in front). Elements with higher `z` are further back. The exact world-space depth of `z={1}` depends on the scene camera distance — use small values (0, 0.1, 0.5) for layering within a scene.

In `ViewLayout kind="carousel"`, `zStep` pushes inactive panels back in Z automatically — you do not manually set Z on carousel children.

## Diagram Node Sizing Recipes

All diagram node sizes are NVS fractions [0..1] — the same system as the diagram viewport. Use these recommended values as a starting point:

| Recipe | Size | Use Case |
|---|---|---|
| Standard | `[0.15, 0.08]` | Default. 6-12 node diagrams. |
| Compact | `[0.10, 0.06]` | Dense diagrams (13+ nodes). |
| Hero | `[0.25, 0.14]` | Title/header nodes. |
| Wide | `[0.22, 0.10]` | Nodes with long labels. |
| Square | `[0.12, 0.12]` | Icon-heavy nodes, circle shapes. |
| Banner | `[0.35, 0.10]` | Full-width title bars. |

## Common Gotchas

**Y=0 is top, not bottom.** The single most common positioning mistake. An element placed at `y={0}` is at the TOP of the viewport. To place something at the bottom, use `y={1}` (or `y={0.8}` for "near the bottom with some margin").

**Do not add top/left CSS to overlay children.** HTML content in `EngineOverlayHost` uses its own CSS layout; NVS only applies to Three.js elements rendered on the canvas. If you need to position HTML overlay content, use CSS position/flexbox on the overlay elements.

**`w` and `h` are extents, not coordinates.** An element at `x={0.5} w={0.4}` spans from `x=0.3` to `x=0.7` (centered at 0.5, half-width 0.2 on each side). Whether the element is center-anchored or edge-anchored depends on the element type.

**Scale is applied before NVS placement.** For `Model`, `scale` is a viewport-relative factor (`worldScale = scale * visibleWorldHeight`). It does not affect NVS bounding box calculations; `w` and `h` define the placement region independently.
