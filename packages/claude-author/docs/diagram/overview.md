---
title: "@brewsite/diagram — Overview"
doc_type: note
owner: claude-author
status: active
updated: 2026-03-19
---

## What @brewsite/diagram Provides

`@brewsite/diagram` adds interactive 3D architecture diagram rendering to the BrewSite engine. It renders nodes (3D prism boxes), edges (tube geometry curves), and group containers (boundary, cluster, swimlane, or container regions) as Three.js objects inside an isolated orthographic scene.

Key capabilities:
- **Nodes** — 3D geometry prisms with PBR materials, icons, labels, sublabels, glow effects. Shapes include rectangles, circles, hexagons, diamonds, clouds, and more.
- **Edges** — CatmullRom tube geometry connecting nodes. Four routing algorithms: `curved`, `straight`, `organic`, `flow` (obstacle-aware). Animated directional flow pulses.
- **Groups** — Rectangular container regions with four variants: `boundary`, `cluster`, `swimlane`, `container`. Supports nesting.
- **Auto-layout** — GridLayout, HierarchicalLayout, FlowLayout automatically compute node positions from graph topology.
- **ManualLayout** — Author-specified NVS positions for pixel-precise control.
- **Transitions** — `<DiagramEnter>` and `<DiagramExit>` DSL components control how diagrams animate in and out between scenes.
- **Interactive canvas** — Supports `diagram-canvas.move`, `diagram-canvas.rotate`, `diagram-canvas.reset`, and `diagram-canvas.focus` input actions for pan/orbit/focus at runtime.
- **Focus regions** — `useDiagramFocusRegion` hook and programmatic `getDiagramFocusRegion` / `clearDiagramFocusRegion` for focus state management.

The diagram renders in its own isolated OrthographicCamera scene, separate from the main scene camera. This is what the codebase and comments call "the DiagramCanvas" — it is not a separate DSL component, it is the `<Diagram>` element itself owning its own Three.js scene.

## Installation and Plugin Registration

Install the package:

```bash
pnpm add @brewsite/diagram
```

Register `diagramPlugin()` alongside `corePlugin()` in your `SceneEngine` plugins array. No configuration is required — widgets are created lazily when `<Diagram>` elements are first encountered during compilation.

```tsx
import { SceneEngine, corePlugin, SceneCanvas, ScrollStage, BackgroundLayer, EngineOverlayHost, InputCoordinator } from '@brewsite/core';
import { diagramPlugin } from '@brewsite/diagram';
import { themesPlugin, themes } from '@brewsite/themes';

export default function MyPage() {
  const plugins = [
    corePlugin(),
    diagramPlugin(),
    themesPlugin(),    // optional — registers named theme families (darkGlass, midnight, etc.)
  ];

  return (
    <div style={{ height: '100vh', overflow: 'hidden' }}>
      <SceneEngine plugins={plugins} theme={themes.darkGlass.dark}>
        {scenes}
        <ScrollStage scrollHeightMode="scene-count" pixelsPerScene={1400}>
          <EngineARContainer aspectRatio={16 / 9} scaleMode="fit-width" referenceWidth={1920}>
            <BackgroundLayer style={{ position: 'absolute', inset: 0, zIndex: 0 }} />
            <SceneCanvas style={{ position: 'absolute', inset: 0, zIndex: 1 }} />
            <EngineOverlayHost />
          </EngineARContainer>
          <InputCoordinator />
        </ScrollStage>
      </SceneEngine>
    </div>
  );
}
```

`@brewsite/diagram` registers its DSL node handlers automatically as a side-effect at module-load time (via `import './register'` in `index.ts`). The `diagramPlugin()` call additionally wires the registry so widgets are created lazily on first `<Diagram>` encounter. You do not need to pre-declare diagram IDs.

## Package Exports

**DSL components (use in scene JSX):**
- `Diagram` — root diagram element
- `DiagramNode` — a node/vertex in the diagram
- `DiagramEdge` — a connector between two nodes
- `DiagramGroup` — a labeled container region
- `DiagramEnter` — enter transition spec (child of `<Diagram>`)
- `DiagramExit` — exit transition spec (child of `<Diagram>`)
- `GridLayout` — grid auto-layout config (child of `<Diagram>` or `<DiagramGroup>`)
- `HierarchicalLayout` — tree/hierarchy auto-layout config
- `ManualLayout` — manual NVS-position layout config
- `FlowLayout` — linear flow auto-layout config

**Plugin:**
- `diagramPlugin()` — `WidgetPlugin` factory; add to `SceneEngine plugins` array

**Theme objects:**
- `enterpriseTheme` — dark enterprise preset
- `enterpriseLightTheme` — light enterprise preset
- `defaultDiagramTheme` — alias for `enterpriseTheme`
- `defaultLightDiagramTheme` — alias for `enterpriseLightTheme`

**Theme registry:**
- `registerDiagramThemePair(family, { dark, light })` — register a custom theme family
- `resolveDiagramTheme(family, polarity)` — resolve a theme by family + polarity
- `mergeTheme(base, overrides)` — compose a new theme from a base + partial overrides
- `withColorMode(preset, colorMode)` — apply color-mode-derived label colors to a preset

**Hooks:**
- `useDiagramTheme()` — returns the `DiagramTheme` resolved from the current `SceneEngine` theme context
- `useDiagramFocusRegion(options?)` — React hook to subscribe to the active diagram focus region

**Focus region API:**
- `getDiagramFocusRegion()` — returns the current `DiagramFocusRegionState | null`
- `clearDiagramFocusRegion(canvasId?)` — clear the focus region
- `DIAGRAM_FOCUS_REGION_EVENT` — CustomEvent type string dispatched on `window`

**Types (exported for authoring):**
- `DiagramTheme`, `DiagramThemePair`
- `DiagramThemeRenderConfig`, `DiagramThemeNodeConfig`, `DiagramThemeEdgeConfig`, `DiagramThemeGroupConfig`, `DiagramThemeEnvironmentConfig`, `DiagramThemeLayoutConfig`
- `DiagramCanvasInputConfig`
- `DiagramNodeShape`, `DiagramIconVariant`
- `DiagramEdgeStyle`, `DiagramArrowVariant`, `DiagramEdgeFlow`
- `DiagramGroupVariant`, `DiagramOrientation`
- `DiagramGroupSide`, `DiagramGroupEdgeLightColorResolver`, `DiagramGroupEdgeLightState`, `DiagramGroupEdgeLightsState`, `DiagramGroupEdgeLightsDSL`
- `DiagramEasing`
- `DiagramNodeGlowConfig`
- `EdgeRoutingAlgorithm`, `EdgeLandingAlgorithm`, `DiagramEdgePort`
- `SvgIcon3DStyle`
- `DiagramFocusRegionState`, `DiagramFocusRegionKind`
- `UseDiagramFocusRegionOptions`
- `LayoutPadding`, `LayoutAlignment`, `LayoutDisconnected`
- `DiagramNodeShape` constant: `DEFAULT_NODE_SHAPE` (value: `'rectangle'`)
- All DSL prop types: `DiagramProps`, `DiagramNodeProps`, `DiagramEdgeProps`, `DiagramGroupProps`, `DiagramExitProps`, `DiagramEnterProps`, `GridLayoutProps`, `HierarchicalLayoutProps`, `ManualLayoutProps`, `FlowLayoutProps`
- All state types: `DiagramDSL`, `DiagramNodeDSL`, `DiagramEdgeDSL`, `DiagramGroupDSL`, `DiagramState`, `DiagramNodeState`, `DiagramEdgeState`, `DiagramGroupState`
- Interaction types: `DiagramInteractionEvent`, `DiagramHoverControls`, `DiagramHoverEventBase`, `DiagramNodeHoverEvent`, `DiagramGroupHoverEvent`, `DiagramNodeMouseHandler`, `DiagramGroupMouseHandler`
- Transition types: `DiagramExitConfig`, `DiagramEnterConfig`, `DiagramExitDSL`, `DiagramEnterDSL`
- Edge path types: `DiagramEdgePathCommand`, `DiagramEdgePathState`, `DiagramEdgePathDebug`

**Icon shape namespaces (for `DiagramNode icon` prop):**
- `FlowIconShape` (`flow:*`) — legacy flow shapes (exported)
- `AwsShape` (`aws:*`) — AWS service icons (exported)
- `GcpShape` (`gcp:*`) — Google Cloud service icons (exported)
- `AzureShape` (`azure:*`) — Azure service icons (exported)
- `NetworkShape` (`net:*`) — network topology icons (exported)
- `custom:${string}` — escape hatch for custom resolver integrations

Note: `UiShape` (`ui:*`), `TechShape` (`tech:*`), `SecurityShape` (`security:*`), and `DataShape` (`data:*`) are internal types not exported from the package index. The icon string values (e.g. `"ui:server"`, `"tech:docker"`) are still valid for the `icon` prop — they are accepted by the `DiagramIconVariant` union type. Only the named shape union types are not re-exported.

## Coordinate Systems in Diagrams

The `<Diagram>` component uses NVS fractions [0..1] throughout — for the diagram viewport and for all node sizes and positions inside it.

**NVS (viewport fractions)** — The `<Diagram>` element's own `x`, `y`, `w`, `h` props position the diagram viewport on screen using NVS [0, 1] coordinates. This is the same system all other elements use.

```tsx
// Diagram occupies the right 80% of the viewport, nearly full height
<Diagram id="arch" x={0.1} y={0.05} w={0.8} h={0.9}>
```

**Node sizes are also NVS** — `<DiagramNode size>` uses NVS fractions [0..1] in all layout modes. A `size={[0.15, 0.08]}` node is 15% of the diagram viewport wide and 8% tall. The theme default is `[0.15, 0.08]`.

```tsx
// Standard node size — 15% wide, 8% tall relative to diagram viewport
<DiagramNode id="api" label="API Server" icon="tech:nodejs" size={[0.15, 0.08]} />
```

For the complete spatial reference including recommended node sizes and layout spacing values, see [layout-spatial-awareness.md](../guides/layout-spatial-awareness.md).

## Diagram vs DiagramCanvas

In BrewSite documentation and code comments, "DiagramCanvas" refers to the orthographic Three.js scene that `<Diagram>` owns — it is not a separate exported DSL component. There is one DSL element: `<Diagram>`.

`<Diagram>` owns:
- Its own isolated `OrthographicCamera` (separate from the main scene perspective camera)
- Its own Three.js `Scene` graph with IBL environment map
- All node, edge, and group geometry inside NVS-positioned viewport bounds

Use `<Diagram>` for every 3D architecture diagram use case. The `x`, `y`, `w`, `h` props position the diagram in NVS space (see the Diagram Props section in nodes-edges-groups.md). The `tilt` prop pitches the geometry plane for angled perspective views.

The interactive canvas actions (`diagram-canvas.move`, `diagram-canvas.rotate`, `diagram-canvas.focus`, `diagram-canvas.reset`) all target a `<Diagram>` by its `id`, wired through `<Action canvasId="...">` in an `<InputController>`. See canvas.md for the complete interactive canvas reference.
