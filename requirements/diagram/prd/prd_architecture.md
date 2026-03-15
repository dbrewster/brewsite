---
title: "BrewSite Diagram — Architecture Reference"
doc_type: prd
status: active
owner: brewsite-product-manager
last_updated: 2026-03-15
change_history:
  - date: 2026-03-09
    author: "Toolkit Product"
    summary: "NVS Universal Coordinate System: DiagramCanvas and DiagramPipe removed. canvas/ directory deleted. Compiler registration table updated (DiagramCanvas and DiagramPipe handlers removed). diagramPlugin() example updated — no canvases parameter. Module source structure updated to reflect deleted canvas/ subtree. Goals updated to remove compileCanvas. Consumer story about cross-diagram pipes updated to reflect removal. Breaking change: @brewsite/diagram major version bump."
  - date: 2026-03-02
    author: "Toolkit Product"
    summary: "Initial PRD created. Comprehensive documentation of the @brewsite/diagram architecture as implemented."
  - date: 2026-03-02
    author: "Toolkit Product"
    summary: "Breaking DX improvements: diagramPlugin() factory eliminates manual DiagramCanvasWidget pre-registration; DiagramWidget removed from public exports; Enter/Exit renamed to DiagramEnter/DiagramExit; ghost node trigger changed from label==='' to label===undefined. Updated Goals, Compiler Registration Contract, Widget Registration, Transition Model, and Design Rule 9 accordingly."
  - date: 2026-03-08
    author: "Toolkit Product"
    summary: "DSL stub co-location: dsl.tsx is now a pure type module (prop interfaces only). DSL stub functions moved to widget.ts files. Updated mandatory element module pattern to reflect new dsl.tsx and widget.ts roles."
  - date: 2026-03-08
    author: "Toolkit Product"
    summary: "Architecture cleanup: added diagramLayoutConstants.ts and diagramRenderConstants.ts as shared constant sources; removed dead code (groupConstants.ts, TextRenderer.ts, createRoundedBorderGeometry, DiagramPivot type); DiagramRenderer constructor now requires DiagramThemeRenderConfig; 5 group edge light types added to package root exports; updated module source structure and rendering architecture sections."
  - date: 2026-03-12
    author: "Toolkit Product"
    summary: "Input unification: documented diagramPlugin.getActionInputExtension() and DiagramWidget.applyCanvasAction(). Added section on diagram canvas action routing through the unified input system. Diagram canvas actions (diagram-canvas.move, diagram-canvas.rotate, diagram-canvas.focus, diagram-canvas.reset) are now dispatched via ActionInputExtensionContext to DiagramWidget, not through a separate input subsystem."
  - date: 2026-03-12
    author: "Toolkit Product"
    summary: "View/Region Architecture: groupCompiler.ts now imports unionBounds from @brewsite/core/layout instead of a local copy. Updated Dependencies section and groupCompiler note."
  - date: 2026-03-10
    author: "Toolkit Product"
    summary: "Module architecture redesign for testability: extracted pure-function modules (defaultsCompiler.ts, ghostNodeMerge.ts, hoverStateMachine.ts, normalizeToViewport.ts); split layoutAlgorithms.ts into compiler/layout/ sub-directory (bounds, flowLayout, gridLayout, hierarchicalLayout); extracted nodeLabelLayout.ts from NodeRenderer; added IFocusRegionService interface + DiagramFocusRegionService class to focusRegion.ts; added optional IIconLoader injection to DiagramRenderer; added constants.ts for shared compile/render constants. Public API at index.ts unchanged. Updated Module Source Structure, Design Rules, and Testing Philosophy sections."
  - date: 2026-03-13
    author: "Toolkit Product"
    summary: "Audit against codebase: corrected diagramPlugin() — it requires an explicit diagrams: string[] option, not auto-discovery. Updated Widget Registration section, Goals, and all code examples accordingly. Corrected DiagramWidget interface list to include IDslComposite and ILightingOverride. Corrected focusRegion.ts API — publishDiagramFocusGroup/Canvas accept Pick<DiagramState,'id'> not Pick<DiagramCanvasState,'id'>. Documented api.composeBounds/composeZ/composeOpacity usage in the Diagram handler. Corrected the useDiagramTheme hook export. Noted DiagramNodeGlowConfig export."
  - date: 2026-03-15
    author: "Toolkit Product"
    summary: "Codebase alignment: diagramPlugin() no longer requires diagrams param — the field is deprecated, createWidgets() returns [], configureRegistry() is the new hook for lazy widget creation via registerDiagramHandlers(registry). Removed DEBT paragraph about manual ID duplication. Updated RoutingProfileContext type to match routingTypes.ts (added groupIds, obstacleGroupIds, fromId, toId, allowUnderpass, organicVariation fields). Noted diagramRenderConstants.ts is a deprecated shim re-exporting from ../constants. Corrected theme exports: only enterpriseTheme, enterpriseLightTheme, defaultDiagramTheme, defaultLightDiagramTheme are exported from package barrel. Removed darkGlass, neonCyber, lightMinimal from implied exports. Corrected diagramLayoutConstants.ts exports (removed DEFAULT_NODE_SIZE — actual exports are DEFAULT_GROUP_PADDING, DEFAULT_TITLE_GAP, DEFAULT_MANUAL_GROUP_PADDING, DEFAULT_MANUAL_TITLE_GAP). Moved RoutingProfile and RoutingProfileContext types from edgeRoutingProfiles.ts to routingTypes.ts to match source."
---

# BrewSite Diagram — Architecture Reference

## Overview

`@brewsite/diagram` is a published TypeScript + React + Three.js library that extends `@brewsite/core` with immersive 3D diagram, image panel, and screen elements. It provides a declarative JSX authoring surface for describing animated 3D diagrams — including nodes, edges, groups, cross-diagram pipes, image panels, and live iframe screens — which compile to flat state structures and render via Three.js. This package is for TypeScript developers integrating immersive visual storytelling into `@brewsite/core`-powered scenes.

Affected packages: `@brewsite/diagram` (primary). `@brewsite/core` is a peer dependency, never a reverse dependency.

## Problem Statement

`@brewsite/core` provides the engine primitives (compiler, runtime, widget SDK, player) but has no knowledge of diagram, image panel, or screen concepts. Without `@brewsite/diagram`, toolkit consumers must implement their own Three.js renderers for structured node-edge visualizations and frame any reusable patterns from scratch. This creates duplicated effort, inconsistent visual output, and no shared DSL contract. `@brewsite/diagram` solves this by providing a complete, production-ready element library that plugs cleanly into the existing `@brewsite/core` compiler and runtime.

## Goals & Success Metrics

**Primary metrics:**
- Consumers can author, compile, and play back a multi-scene diagram with zero Three.js code in their scene files.
- Adding `@brewsite/diagram` to a project requires calling `diagramPlugin()` in the `plugins` array passed to `EngineProvider` — no manual widget pre-registration or diagram ID listing is needed.
- All compile functions (`compileDiagram`, `compileImagePanel`, `compileScreen`) pass their full test suites with real DSL inputs and asserted real outputs.

**Guardrail metrics:**
- No Three.js import leaks into `types.ts`, `dsl.tsx`, or `compile.ts` for any element.
- No `@brewsite/core` import from any file in `@brewsite/core` that originates in `@brewsite/diagram`.
- Bundle size increase over a bare `@brewsite/core` integration is justified by the element surface offered.

## Non-Goals

- `@brewsite/diagram` does not define the scene player, camera widget, or lighting widget. Those remain in `@brewsite/core`.
- This package does not include a general SVG-to-3D conversion utility. The `svgIcon3D.ts` module handles only the icon overlay use case for diagram nodes.
- Lucid import utilities (`lucid/`) are a consumer-facing adapter layer, not part of this architecture specification. Their API details are covered separately.
- The package does not provide a React component tree for rendering. All rendering is Three.js and is initiated by the widget's `apply()` method.

## Consumer Stories

- As a toolkit consumer, I want to author a diagram in JSX and have it render as a 3D scene without writing any Three.js code.
- As a toolkit consumer, I want diagrams across multiple scenes to transition smoothly — nodes moving, edges rerouting, and new nodes fading in.
- As a toolkit consumer, I want to group related nodes visually using swimlanes, boundaries, or clusters without changing my layout strategy.
- As a toolkit consumer, I want to place multiple `<Diagram>` elements as siblings in the same scene, each with independent `x/y/w/h` NVS bounds, so that I can compose multi-diagram layouts without a container element.
- As a toolkit consumer, I want to call `diagramPlugin()` once and have `DiagramWidget` instances created automatically for each `<Diagram>` in my scenes, so I do not need to list diagram IDs or construct widgets manually.
- As a toolkit consumer, I want to display a static 3D image frame or a live iframe screen alongside diagram content.

## Package Overview

### Identity

| Property | Value |
|---|---|
| Package name | `@brewsite/diagram` |
| Build tooling | `tsc` only (no Vite library mode) |
| Peer dependencies | `react`, `react-dom`, `three`, `@brewsite/core` |
| Dependency rule | May import from `@brewsite/core`; `@brewsite/core` must never import from this package |
| Published artifacts | `dist/` (ESM + type declarations) |

### Module Source Structure

```
packages/diagram/src/
├── index.ts              ← public re-exports + side-effect registration import
├── register.ts           ← calls registerDiagramHandlers() at module-load time
├── troika-three-text.d.ts
├── compiler/
│   └── handlers.ts       ← registerDiagramHandlers(); bridges DSL → compile → setWidgetState
└── elements/
    ├── diagram/           ← Diagram, DiagramNode, DiagramEdge, DiagramGroup
    │   ├── types.ts
    │   ├── dsl.tsx
    │   ├── compile.ts
    │   ├── render.ts      ← DiagramRenderer; accepts optional IIconLoader injection
    │   ├── widget.ts
    │   ├── constants.ts   ← shared compile/render constants (GROUP_BORDER_PX_TO_UNITS, GROUP_RENDER_Z)
    │   ├── focusRegion.ts ← IFocusRegionService interface + DiagramFocusRegionService class; module-level wrappers preserved for backwards compat
    │   ├── useDiagramFocusRegion.ts
    │   ├── index.ts
    │   ├── compiler/      ← pure sub-compilers; all files are Three.js-free and React-free
    │   │   ├── defaultsCompiler.ts       ← NodeDefaults, EdgeDefaults, GroupDefaults; buildNodeDefaults/buildEdgeDefaults/buildGroupDefaults
    │   │   ├── diagramLayoutConstants.ts ← canonical layout constants (DEFAULT_GROUP_PADDING, DEFAULT_TITLE_GAP, DEFAULT_MANUAL_GROUP_PADDING, DEFAULT_MANUAL_TITLE_GAP)
    │   │   ├── diagramRenderConstants.ts ← deprecated shim; re-exports from ../constants. Will be removed.
    │   │   ├── ghostNodeMerge.ts         ← pure ghost node inheritance logic extracted from widget.ts
    │   │   ├── groupCompiler.ts          ← imports unionBounds from @brewsite/core layout module
    │   │   ├── hoverStateMachine.ts      ← pure hover event computation extracted from widget.ts
    │   │   ├── layoutAlgorithms.ts       ← 120-line orchestrator; algorithm implementations live in layout/
    │   │   ├── layoutResolver.ts
    │   │   ├── nodeCompiler.ts
    │   │   ├── normalizeToViewport.ts    ← pure coordinate transformation (diagram units → NVS); directly unit-testable
    │   │   ├── transitionHelpers.ts
    │   │   ├── themeResolver.ts
    │   │   ├── edgeRouter.ts
    │   │   └── layout/                  ← extracted layout algorithm modules
    │   │       ├── bounds.ts             ← computeBounds()
    │   │       ├── flowLayout.ts         ← resolveFlowLayout()
    │   │       ├── gridLayout.ts         ← resolveGridLayout()
    │   │       ├── hierarchicalLayout.ts ← resolveHierarchicalLayout()
    │   │       └── index.ts              ← barrel re-exports (not layoutAlgorithms to avoid circular dep)
    │   ├── math/          ← color utilities (pure functions)
    │   ├── rendering/     ← Three.js renderers (NodeRenderer, EdgeRenderer, GroupRenderer, ...)
    │   │   └── nodeLabelLayout.ts        ← pure label position arithmetic extracted from NodeRenderer; NodeLabelLayout type
    │   ├── shapes/        ← geometry factory, icon registry, shape variants
    │   └── themes/        ← theme presets; package barrel exports enterpriseTheme, enterpriseLightTheme, defaultDiagramTheme, defaultLightDiagramTheme
    ├── image-panel/       ← ImagePanel element (3D image frame with bezel and glow)
    ├── screen/            ← Screen element (3D iframe frame)
    └── _shared/           ← bezelGeometry, glowSprite (shared Three.js geometry)
```

**Deleted files (dead code removal, prior overhaul):**
- `elements/diagram/compiler/groupConstants.ts` — single unused constant; canonical value is in `diagramLayoutConstants.ts`
- `elements/diagram/rendering/TextRenderer.ts` — two-line re-export with no logic; `NodeRenderer` and `GroupRenderer` import directly from `@brewsite/core`

## Mandatory Element Module Pattern

Every element in `@brewsite/diagram` follows the same strict dependency chain. No file is permitted to violate the direction listed here.

```
types.ts
  ↓  interface contracts only; no runtime, Three.js, or React imports

dsl.tsx
  ↓  prop type interfaces only; imports from types.ts; no React components, no Three.js

compile.ts
  ↓  pure transformation functions; imports from types.ts and @brewsite/core math utils;
     no React, no Three.js, no side effects

render.ts
  ↓  Three.js application layer; imports from types.ts and rendering/;
     no React, no compiler imports

widget.ts
  ↓  defines DSL stub functions (null-returning components);
     implements IWidget from @brewsite/core;
     imports compile.ts (for transitionSpec), render.ts (for renderer), types.ts, dsl.tsx (prop types);
     bridges compiler output to render layer

index.ts
     public re-exports only; no logic
```

Violations of this chain — e.g., importing Three.js in `compile.ts`, or importing from `render.ts` in `compile.ts` — are product defects. They break SSR safety, pollute the compiler pipeline with renderer state, and prevent testing `compile.ts` in pure Node.js environments.

## Compiler Registration Contract

`packages/diagram/src/register.ts` calls `registerDiagramHandlers()` at module-load time. Importing `@brewsite/diagram` (i.e., its `index.ts`) triggers this side effect automatically via the `import './register';` statement at the top of `index.ts`. `registerNode()` is idempotent — multiple imports are safe.

`registerDiagramHandlers()` registers the following DSL node types with `@brewsite/core`'s compiler registry:

| DSL Component | Handler Behavior |
|---|---|
| `Diagram` | Calls `extractDiagramDSL(node, helpers)` → `compileDiagram(dsl)` → `api.setWidgetState(dsl.id, state)`. Auto-registers a `DiagramWidget` instance when called through `diagramPlugin()`. |
| `ImagePanel` | Calls `compileImagePanel(dsl)` → `api.setWidgetState()` |
| `Screen` | Calls `compileScreen(dsl)` → `api.setWidgetState()` |
| `DiagramNode`, `DiagramEdge`, `DiagramGroup`, `DiagramExit`, `DiagramEnter` | Registered as leaf primitives (empty handler); `collectChildren()` preserves them for parent handler extraction |

**Removed handlers:** `DiagramCanvas` and `DiagramPipe` handlers were removed in the NVS Universal Coordinate System release. `DiagramCanvas`, `DiagramPipe`, and all related compile functions (`compileCanvas`, `compilePipe`) are no longer part of the package.

The `registry` parameter to `registerDiagramHandlers(registry?)` is optional. When provided, the `Diagram` handler uses it to auto-register `DiagramWidget` instances at compile time.

```typescript
// packages/diagram/src/register.ts
import { registerDiagramHandlers } from './compiler/handlers';
registerDiagramHandlers();

// packages/diagram/src/index.ts (first line, before all exports)
import './register';
```

## Widget Registration via diagramPlugin()

`diagramPlugin()` is the primary integration pattern. It returns a `WidgetPlugin` that automatically creates `DiagramWidget` instances lazily on first DSL encounter during compilation. No diagram IDs need to be listed upfront.

```typescript
import { useMemo } from 'react';
import { EngineProvider, corePlugin } from '@brewsite/core';
import { diagramPlugin } from '@brewsite/diagram';

function App() {
  const diagPlugin = useMemo(() => diagramPlugin(), []);
  return (
    <EngineProvider
      manifestUrl="/assets/manifest.json"
      plugins={[corePlugin(), diagPlugin]}
    >
      {/* scenes with <Diagram> elements */}
    </EngineProvider>
  );
}
```

`diagramPlugin()` also works with `ScenePlayer`:

```typescript
import { ScenePlayer, corePlugin } from '@brewsite/core';
import { diagramPlugin } from '@brewsite/diagram';

<ScenePlayer
  sceneGroup={sceneGroup}
  plugins={[corePlugin(), diagramPlugin()]}
/>
```

The plugin lifecycle has three hooks:

- **`createWidgets()`** — Returns `[]`. DiagramWidget instances are not pre-created; they are created lazily during compilation.
- **`registerHandlers()`** — Calls `registerDiagramHandlers()` to install baseline DSL node handlers (without registry access).
- **`configureRegistry(registry)`** — Re-registers the Diagram handler with `WidgetRegistry` access by calling `registerDiagramHandlers(registry)`. This overwrites the baseline handler with a registry-aware version that creates `DiagramWidget` instances on first encounter of each `<Diagram id="...">` during compilation.

The `DiagramPluginOptions.diagrams` field is **deprecated**. Passing it emits a console warning. The field is no longer needed because widget instances are created automatically when the Diagram node handler encounters a new `id` during compilation.

For `ImagePanel` and `Screen` elements, widget instances must still be registered explicitly (they require asset loading configuration that cannot be auto-inferred from the DSL alone).

## Diagram Canvas Action Input

`diagramPlugin()` implements `WidgetPlugin.getActionInputExtension(registry)` to wire diagram-canvas-specific action types into the unified `ActionInput` system from `@brewsite/core`. This means scene authors can declare `<Action type="diagram-canvas.move">` etc. inside `<InputController>` without any additional wiring.

```typescript
// packages/diagram/src/player/diagramPlugin.ts

export function diagramPlugin(options: DiagramPluginOptions = {}): WidgetPlugin {
  return {
    createWidgets(): DiagramWidget[] {
      // DiagramWidget instances are created lazily via the Diagram node handler
      // in configureRegistry(). No pre-declaration of diagram IDs is required.
      return [];
    },

    registerHandlers(): void {
      registerDiagramHandlers(); // baseline handler + child component handlers, no registry
    },

    configureRegistry(registry: WidgetRegistry): void {
      // Re-register the Diagram handler with registry access for lazy widget creation.
      registerDiagramHandlers(registry);
    },

    getActionInputExtension(registry) {
      return {
        onUnknownAction: (type, canvasId, _event, extra) => {
          if (!canvasId) return;
          const widget = registry.get(canvasId);
          if (!widget || !('applyCanvasAction' in widget)) return;

          const dx = (extra['dx'] as number) ?? 0;
          const dy = (extra['dy'] as number) ?? 0;
          const speed = (extra['speed'] as number) ?? 1;

          switch (type) {
            case 'diagram-canvas.move':
              (widget as DiagramWidget).applyCanvasAction('move', dx, dy, speed);
              break;
            case 'diagram-canvas.rotate':
              (widget as DiagramWidget).applyCanvasAction('rotate', dx, dy, speed);
              break;
            case 'diagram-canvas.focus':
              (widget as DiagramWidget).applyCanvasAction(
                'focus', 0, 0, 1,
                extra['focusCenter'] as [number, number] | undefined,
              );
              break;
            case 'diagram-canvas.reset':
              (widget as DiagramWidget).applyCanvasAction('reset', 0, 0, 1);
              break;
          }
        },
      };
    },
  };
}
```

**Supported diagram-canvas action types:**

| Action Type | Effect |
|---|---|
| `diagram-canvas.move` | Pan the diagram canvas; `dx`/`dy` from the pointer delta |
| `diagram-canvas.rotate` | Rotate the diagram canvas; `dx`/`dy` from the pointer delta |
| `diagram-canvas.focus` | Focus the canvas on a point; `focusCenter: [x, y]` from the `<Action>` spec |
| `diagram-canvas.reset` | Reset canvas to default position/rotation |

**Scene authoring example:**

```tsx
<Scene key="detail">
  <InputController scope="canvas">
    <Action id="pan" type="diagram-canvas.move" canvasId="my-diagram">
      <PointerMap drag button="left" />
    </Action>
    <Action id="rotate" type="diagram-canvas.rotate" canvasId="my-diagram">
      <PointerMap drag button="right" />
    </Action>
    <Action id="reset" type="diagram-canvas.reset" canvasId="my-diagram">
      <KeyMap key="r" />
    </Action>
  </InputController>
  <Diagram id="my-diagram" ... />
</Scene>
```

**`DiagramWidget.applyCanvasAction`** — The imperative method called by the extension. Its signature:

```typescript
applyCanvasAction(
  action: 'move' | 'rotate' | 'focus' | 'reset',
  dx: number,
  dy: number,
  speed: number,
  focusCenter?: [number, number],
): void;
```

This method is called directly on the `DiagramWidget` instance (looked up by `canvasId` from the registry). For `'move'`, it accumulates `_canvasPan.x/y` offsets that are composed with the viewportBounds center on the next `apply()` tick. For `'rotate'`, it accumulates `_tiltDelta.x/y` that are added to `state.tiltRotation` in `apply()`. For `'focus'`, it publishes a canvas-level focus event via `publishDiagramFocusCanvas`. For `'reset'`, it zeroes both accumulators and clears the focus region. `diagram-canvas.*` action types are owned by `@brewsite/diagram` — they are string literals, not part of the `InputActionType` enum in `@brewsite/core`.

## State Flow

The full path from JSX authoring surface to Three.js renderer:

```
Scene JSX (Diagram, DiagramNode, DiagramEdge, DiagramGroup, ...)
  │
  ▼ compiler/handlers.ts → extractDiagramDSL(node, helpers)
  │
DiagramDSL { id, x, y, w, h, tilt, z, scale, nodes[], edges[], groups[], layout, theme, exit, enter }
  │
  ▼ api.composeBounds(localBounds) → composed viewportBounds (respects parent View/carousel context)
  ▼ api.composeZ(dsl.z) → composed world-space Z
  ▼ api.composeOpacity(1) → view opacity multiplier (carousel fade)
  │
  ▼ compileDiagram({ ...dsl, x, y, w, h, z: composedZ }, fallbackTheme?, warnFn?)
  │
DiagramState { id, viewportBounds, tiltRotation, z, scale, contentAspect,
               nodes[], edges[], groups[], exit, enter, themeConfig }
  │
  ▼ api.setWidgetState(widgetId, state) → stored in SceneFrame.widgets[widgetId]
  │
  ▼ SceneTrack baking (functionalDiagramTransitionSpec: exitFn, enterFn, interpolateFn)
  │
SceneTrackTick.state.widgets[widgetId] = blended DiagramState at tick t
  │
  ▼ DiagramWidget.apply(state, context)     (IRenderable contract)
  │
  ▼ DiagramRenderer.update(state, scene)
  │
Three.js Scene (NodeRenderer, EdgeRenderer, GroupRenderer)
```

Multiple `<Diagram>` siblings in the same scene each follow this flow independently — each compiles to its own `DiagramState` and is registered with its own `DiagramWidget` instance.

## Transition Model

`@brewsite/diagram` exports `functionalDiagramTransitionSpec` — a `FunctionalTransitionSpec<DiagramState>` from `@brewsite/core`. The spec implements three functions:

**`exitFn(from)(ctx)`** — applies the diagram's compiled `DiagramExitConfig` at exit progress `ctx.t`. When `config.to` is present, the diagram's `viewportBounds` center is animated toward that NVS target. Per-node/edge opacities fade to 0 if `config.fade`. Uses the easing function specified by `config.easing`.

**`enterFn(to)(ctx)`** — applies the diagram's compiled `DiagramEnterConfig` at enter progress `ctx.t`. When `config.from` is present, the diagram's `viewportBounds` center is animated from that NVS origin. Per-node/edge opacities fade in from 0 if `config.fade`.

**`interpolateFn(from, to)(ctx)`** — produces a blended `DiagramState` at `ctx.t` between two scenes:
- `blendDiagramNodes(from.nodes, to.nodes, t)` — nodes present in both states are interpolated; nodes present only in `from` are faded out; nodes present only in `to` are faded in.
- `buildLiveNodeMaps([...blended, ...fading])` — extracts live positions/sizes for edge rerouting.
- `rerouteLiveEdges(to.edges, from.edges, toEdgeIds, positions, sizes)` — recomputes control points at the current blended node positions so edges follow their nodes smoothly during the transition.
- `blendDiagramEdges(from.edges, to.edges, liveControlPoints, t)` — interpolates edge colors, thicknesses, and opacities.
- `viewportBounds` and `tiltRotation` are blended between `from` and `to` states using component-wise linear interpolation.

`DiagramWidget.mergeSnapshot(prev, next)` runs before the transition baking phase. It carries forward `label`, `sublabel`, `shape`, `iconUrl`, `iconScale`, and `sublabelColor` for ghost nodes (nodes whose `DiagramNodeState.label` is `undefined` in the next scene — i.e., the `label` prop was omitted entirely in the DSL), and carries forward `position`, `size`, and `thickness` for nodes with `positionInherited: true`. Explicitly setting `label=""` (empty string) is not a ghost node; it declares a node with a blank text label that preserves all other explicitly authored props. This enables minimal ghost node declarations in drill-down scenes.

## SSR Safety

All diagram elements satisfy SSR safety requirements:

- No file outside `render.ts` and `widget.ts` imports or references `three`, browser globals (`window`, `document`, `navigator`), or DOM APIs.
- `types.ts`, `dsl.tsx`, and all `compiler/` files run safely in Node.js and Vitest with zero browser polyfills.
- Three.js object instantiation (geometries, materials, meshes) is deferred to `IRenderable.apply()` and `ILoadable.load()`.
- DSL components return `null` and carry no runtime state.

## Design Rules

The following rules are non-negotiable for all code in this package:

1. **`@brewsite/core` is never imported by `@brewsite/core`.** `@brewsite/diagram` may import from core; the reverse direction is prohibited at all times.
2. **Three.js is confined to `render.ts` and `rendering/` subdirectories.** No `import * as THREE` in `types.ts`, `dsl.tsx`, `compile.ts`, or any `compiler/` file.
3. **`compile.ts` functions are pure.** They accept plain data and return plain data. No side effects, no global state, no async operations.
4. **DSL components return `null`.** They exist only to carry typed props through the React element tree for compiler extraction. They are not rendered to the DOM.
5. **Element module pattern is mandatory.** Every element follows `types → dsl → compile → render → widget → index`. No file may import from a module that is downstream of it in this chain.
6. **Widget IDs are stable across scenes.** The `widgetId` passed to a widget constructor must match the `id` prop of the corresponding DSL element in every scene.
7. **Scenes are purely declarative.** No animation math, no Three.js, no frame logic appears in scene files. All rendering logic lives in `render.ts` and `rendering/`.
8. **`index.ts` re-exports only.** No logic, no side effects other than the `import './register'` at the top of the package root `index.ts`.
9. **Ghost nodes do not have positions resolved by the layout engine.** A ghost node is a `<DiagramNode>` whose `label` prop is absent (`undefined`) in the DSL. `mergeSnapshot` provides their label, shape, icon, size, and thickness from the previous scene after compilation. The layout resolver must never assign positions to ghost nodes (nodes with `positionInherited: true`).
10. **Entry transitions belong to the incoming scene.** Exit transitions belong to the outgoing scene. This mirrors the `@brewsite/core` convention.

## Testing Philosophy

- All `compile.ts` functions are pure and are tested with real DSL input → asserted real output. Tests live in `__tests__/` directories co-located with source.
- The extracted pure-function modules (`defaultsCompiler.ts`, `ghostNodeMerge.ts`, `hoverStateMachine.ts`, `normalizeToViewport.ts`, `rendering/nodeLabelLayout.ts`, `compiler/layout/bounds.ts`, `compiler/layout/flowLayout.ts`, `compiler/layout/gridLayout.ts`, `compiler/layout/hierarchicalLayout.ts`) each have co-located `__tests__/` suites with real inputs and asserted real outputs. No mocking required.
- `render.ts` and `rendering/` files (except `nodeLabelLayout.ts`) are excluded from coverage instrumentation. They require WebGL and are validated via manual integration testing.
- `focusRegion.ts` is tested via `DiagramFocusRegionService` instances — each test constructs a fresh service instance to avoid singleton bleed between tests. The module-level `getDiagramFocusRegion`, `publishDiagramFocusGroup`, `publishDiagramFocusCanvas`, and `clearDiagramFocusRegion` exports are backwards-compatible wrappers that delegate to a shared `diagramFocusRegionService` singleton of type `DiagramFocusRegionService`.
- `DiagramRenderer` accepts an optional `IIconLoader` injection. Tests that exercise the renderer path pass a stub `IIconLoader` implementation rather than relying on global state or network icon loading.
- Widget integration is tested using `RuntimeDriverImpl` with interface-conforming doubles from `packages/core/src/runtime/mocks/`.
- The `registerDiagramHandlers` function is called in test files that clear the registry, ensuring handler registration is always re-applied before test cases run.

## Breaking Change Assessment

Semver impact: **major** (for the 2026-03-08 overhaul — see element PRDs for per-field migration tables).

Key architectural-level breaking changes (from initial 2026-03-08 overhaul through current state):

- **`DiagramState.position/rotation/scale/pivot/bounds` removed** — replaced with `viewportBounds: NVSRect` and `tiltRotation: readonly [number,number,number]`. Any code reading these fields from compiled `DiagramState` objects must be updated.
- **`DiagramRenderer` constructor signature changed** — now requires `DiagramThemeRenderConfig` as second argument. Code constructing `DiagramRenderer` directly must pass the resolved config.
- **`DiagramPivot` type deleted** — the exported type and its DSL usage no longer exist. Any `import { DiagramPivot }` from `@brewsite/diagram` will fail to compile.
- **5 group edge light types added to package root exports** — `DiagramGroupSide`, `DiagramGroupEdgeLightColorResolver`, `DiagramGroupEdgeLightState`, `DiagramGroupEdgeLightsState`, `DiagramGroupEdgeLightsDSL` are now exported from `@brewsite/diagram`. This is a minor-compatible addition.
- **`diagramPlugin()` no longer requires `diagrams: string[]`** — the `diagrams` option is deprecated and emits a console warning if provided. `DiagramWidget` instances are created lazily during compilation via `configureRegistry()`. Callers should remove the `diagrams` array.
- **`publishDiagramFocusGroup/Canvas` parameter type changed** — these functions now accept `Pick<DiagramState, 'id'>` (not `Pick<DiagramCanvasState, 'id'>`). Callers using canvas state objects must update to use the diagram widget's `DiagramState`.
- **`DiagramWidget` implements `IDslComposite` and `ILightingOverride`** — code narrowing on `DiagramWidget`'s interface list must account for these new contracts.

## Dependencies

- `@brewsite/core` (peer, `^0.x`) — compiler registry, widget SDK interfaces, runtime, math utilities, layout helpers. `groupCompiler.ts` imports `unionBounds` from `@brewsite/core`'s `layout/regionNormalize` module rather than maintaining a local copy. This ensures group bounds computation stays consistent with the View/Region architecture used by other packages.
- `react` (peer) — DSL component definitions
- `react-dom` (peer) — implied by react usage
- `three` (peer) — Three.js rendering in `render.ts` files
- `troika-three-text` (bundled ambient type declaration) — text rendering on diagram nodes

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Three.js import leak into compile pipeline | CI type-check enforces no `import three` in `compile.ts`; module pattern documented and enforced in code review |
| Reverse dependency (`@brewsite/core` importing from `@brewsite/diagram`) | Enforced by monorepo dependency rule; `@brewsite/core` package.json has no dependency on `@brewsite/diagram` |
| Widget ID mismatch between DSL and registry | Runtime warning emitted by `Diagram` handler when `registry` is provided; documented in consumer integration guide |
| SSR breakage from browser-global access in compile pipeline | Node.js-compatible test suite catches regressions without WebGL polyfills |

## Open Questions

None at this time. This document reflects the current implemented architecture.

## Launch Criteria

This is a documentation PRD for an implemented package. The architecture it describes is live. The criteria for keeping it current are:

- Updated within one sprint of any architectural change to the module pattern, compiler registration contract, state flow, or transition model.
- TypeScript types referenced in the State Flow section match the exported types in `packages/diagram/src/index.ts`.
- The Design Rules section is reviewed on every major version bump.
