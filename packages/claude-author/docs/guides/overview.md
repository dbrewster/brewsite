---
title: BrewSite Overview
doc_type: guide
owner: claude-author
status: active
updated: 2026-03-20
---

## What BrewSite Is

BrewSite is a TypeScript + React + Three.js framework for authoring and playing back animated 3D marketing scenes. You write declarative JSX that describes what each scene looks like — which elements are present, their positions, opacities, and properties — and the compiler bakes that into a flat, pre-indexed playback track. The engine then samples that track at O(1) cost every frame, driving Three.js rendering and HTML overlay content in sync.

## The Mental Model

**Scenes are pure state declarations. The compiler bakes them. The engine plays back.**

You never write animation math in a scene file. You never import Three.js. You never think about frames or timing. You describe: in Scene 1, the robot is at position (0.5, 0.5) with opacity 1. In Scene 2, the robot is at (0.7, 0.3) with opacity 0. The compiler produces a pre-baked `SceneTrack` — a flat array where every index maps directly to a complete widget state snapshot. The engine samples this array based on scroll position or time progress, and widgets apply the state to the Three.js scene.

The pipeline is:

```
Scene DSL (JSX) → resolveSceneFromDsl() → SceneFrame[]
  → sceneTrackCompiler → SceneTrack (flat tick array)
    → RuntimeDriverImpl.tick() → per-frame widget state dispatch
      → Three.js render
```

## The Four Embedding Modes

- **Scroll-driven** — a `ScrollStage` containing the canvas; window or container scroll drives scene progression. Best for landing pages where users scroll through a story.
- **Embedded player** — `SceneReel` convenience wrapper with `TimeInput` for auto-advance. Best for docs pages, presentations, and fixed-size embeds that run on their own.
- **Programmatic / controlled** — external UI (buttons, tabs) drives a `ControlledInput` value or calls `useGoToScene()`. Best when you need nav buttons, step indicators, or external state controlling the scene.
- **Canvas region** — `SceneReel` with `InputCoordinator` for camera orbit/zoom/pan. Default bindings work out of the box. Best for interactive product viewers or standalone 3D regions with no scene sequencing.

Full details for each mode: search for `embedding-modes`.

## Package Map

| Package | What lives there |
|---|---|
| `@brewsite/core` | `Scene`, `ProgressManager`, `View`, `ViewLayout`, `InputController`, `Action`, `Transition`, `Camera`, `Lighting`, `Background`, `Environment`, `Floor`, `SpotlightRig` DSL; all player components (`SceneEngine`, `ScrollStage`, `SceneReel`, `SceneCanvas`, etc.) |
| `@brewsite/diagram` | `Diagram`, `DiagramCanvas`, `ImagePanel`, `Screen` DSL elements; diagram theming and rendering |
| `@brewsite/model` | `Model`, `Playback`, `Animation`, `LabelItem`, `LabelPositioner` DSL; GLTF model loading and label system |
| `@brewsite/charts` | `ChartWidget` and chart DSL elements; 3D chart rendering |
| `@brewsite/slides` | `SlidePlayer`, `Slide`, layout DSL (`TitleSlide`, `ContentSlide`, `BigNumberSlide`, etc.), graphics components (`StatCard`, `Timeline`, `ProgressRing`, etc.), animation hooks (`useCountUp`, `useStaggeredReveal`), `slidesPlugin` |

Import DSL components from their owning package. Do not cross-import between packages from scene files — let the engine wire them together through `plugins`.

## NVS Coordinate System (Brief)

NVS (Normalized Viewport Space) is the coordinate system for all element positioning. `(0, 0)` is top-left, `(1, 1)` is bottom-right. Think CSS `left`/`top` percentages, but for 3D space. An element at `x={0.5} y={0.5}` is centered. An element at `x={0} y={0} w={0.5} h={1}` occupies the left half.

**Critical:** Y=0 is TOP. Y=1 is BOTTOM. This is the opposite of standard 3D Y-up convention. The NVS service converts to world space with a Y-flip internally.

Full detail: search for `nvs-spatial-model`.

## Critical Rules

These rules must never be violated. Violations cause silent failures, render bugs, or architecture corruption.

**1. Entry transitions belong to the incoming scene, not the outgoing one.**
The `transition` prop on `<Scene>` and `exitStart` configure how *that scene's block* behaves when transitioning *into* it. If you want a model to fade in when Scene 2 begins, author the transition config on Scene 2 — not Scene 1.

**2. Three.js is never imported in DSL or scene files.**
Three.js imports belong exclusively in `render.ts` files inside element modules. Scene files, DSL files, and compile-time code must have zero Three.js dependencies.

**3. Scenes are pure state declarations — no animation math.**
A scene describes what things look like at that point. It does not compute positions over time, does not interpolate, does not call easing functions at runtime. The compiler does all of that at build/compile time.

**4. `plugins` is required on `<SceneEngine>`.**
Without `plugins={[corePlugin(), ...]}`, the engine has no widgets registered and nothing renders. Every `SceneEngine` must declare its plugins. For model content, add `modelPlugin(...)` from `@brewsite/model`. For diagram content, add `diagramPlugin` from `@brewsite/diagram`.

**5. Scene `id` props must be unique within one engine.**
Duplicate scene ids cause the compiler to overwrite one scene with another. Every `<Scene id="...">` in a single `SceneEngine` must have a distinct id.

**6. `<InputController>` is one-per-scene.**
Only one `<InputController>` is allowed inside a `<Scene>`. The compiler throws if you add more than one. Action ids within an `InputController` must also be unique.

**7. Do not set `position: absolute` or `position: relative` on `<SceneCanvas>` via inline styles.**
`SceneCanvas` renders a `div` + `canvas` block. Use NVS for 3D element positioning. Use `EngineOverlayHost` for HTML overlay positioning. Never try to CSS-position the canvas itself.

**8. `compiler/index.ts` exports only the DSL authoring surface.**
Infrastructure types (`SceneTrack`, `compileSceneTrack`) are internal. Scene authors import only from the named exports of `@brewsite/core`, `@brewsite/model`, `@brewsite/diagram`, and `@brewsite/charts`.

## How to Find More Information

Search for specific topics using the brewsite_docs tool. Key topics:

- `nvs-spatial-model` — The NVS coordinate system in full detail
- `embedding-modes` — All four embedding modes with complete working examples
- `scene-dsl` — `Scene`, `ProgressManager`, `View`, `ViewLayout`, HUD system
- `input-dsl` — `InputController`, `Action`, all map types, action type values
- `transitions` — Transition types, entry vs exit rules, easing functions
- `camera` — Camera modes, orbit, dolly, pan
- `lighting` — Ambient, directional, spotlight rig
- `background` — Background color and gradient DSL
- `environment` — HDR environment maps
- `floor` — Reflective floor plane
- `diagram-dsl` — Diagram nodes, edges, groups, theming
- `model-dsl` — GLTF models, animations, labels
- `charts-dsl` — 3D chart elements
- `slides-overview` — Slide deck package: SlidePlayer, layouts, graphics, animation hooks
- `slide-layouts` — All 19 layout archetypes with props and examples
- `slide-graphics` — Graphics components: StatCard, Timeline, ProgressRing, etc.
- `slide-animation` — Animation hooks: useCountUp, useStaggeredReveal, useEntrance
- `slide-themes` — SlideTheme system, presets, CSS variable reference
- `slide-templates` — SlideTemplate for corporate branding
- `deck-patterns` — Common corporate deck patterns and recipes
- `common-gotchas` — Most frequent mistakes and how to avoid them
