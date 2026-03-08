# @brewsite/diagram

3D immersive diagram, canvas, image-panel, and screen elements for the BrewSite Scene Toolkit. Built on top of `@brewsite/core`, this package adds interactive architectural diagram rendering with node/edge/group layouts, animated transitions, cloud provider icon support, and multiple visual themes.

## Installation

```bash
npm install @brewsite/diagram @brewsite/core react react-dom three
```

Peer dependencies: `react ^19`, `react-dom ^19`, `three ^0.183`.

## Overview

`@brewsite/diagram` provides Three.js-rendered diagram elements that integrate with the `@brewsite/core` widget registry and scene compiler. Diagrams are authored declaratively in the scene DSL — no imperative Three.js in scene files.

## Quick Start

**1. Declare the scene** (DSL-only, purely declarative):

```tsx
// scenes/myScene.tsx
import type { SceneDefinition } from '@brewsite/core';
import { Scene, Lighting, Ambient, Directional } from '@brewsite/core';
import { DiagramCanvas, Diagram, DiagramNode, DiagramEdge, HierarchicalLayout } from '@brewsite/diagram';

export const myScene: SceneDefinition = {
  id: 'arch',
  index: 0,
  getFrame: () => (
    <Scene id="arch">
      <Lighting intensityScale={1}>
        <Ambient intensity={1.5} color="#ffffff" />
        <Directional intensity={2.5} color="#ffffff" position={[10, 30, 60]} />
      </Lighting>
      <DiagramCanvas id="main-canvas" tilt={-Math.PI / 6}>
        <Diagram id="arch-diagram" pivot="center">
          <HierarchicalLayout spacing={[3, 2]} />
          <DiagramNode id="api"   label="API Gateway" icon="aws:api-gateway" />
          <DiagramNode id="svc"   label="Service"     icon="aws:ecs" />
          <DiagramNode id="db"    label="Database"    icon="aws:rds" />
          <DiagramEdge from="api" to="svc" label="REST" />
          <DiagramEdge from="svc" to="db"  label="TCP" />
        </Diagram>
      </DiagramCanvas>
    </Scene>
  ),
};
```

**2. Register the plugin** (replaces manual widget setup):

```tsx
// App.tsx
import { useMemo } from 'react';
import { ScenePlayer, corePlugin } from '@brewsite/core';
import { diagramPlugin } from '@brewsite/diagram';
import { myScene } from './scenes/myScene';

export default function Page() {
  const diagPlugin = useMemo(() => diagramPlugin(), []);
  return (
    <ScenePlayer
      sceneGroup={{ id: 'demo', scenes: [myScene] }}
      plugins={[corePlugin(), diagPlugin]}
      framesPerTick={100}
      pixelsPerScene={1600}
    />
  );
}
```

`diagramPlugin()` automatically registers `DiagramCanvasWidget` instances at compile time — no separate `widgetSetup.ts` file required for diagram canvases.

## Key Exports

### DSL Components

| Export | Description |
|---|---|
| `Diagram` | Root diagram element (nodes, edges, groups) |
| `DiagramNode` | A single node in the diagram |
| `DiagramEdge` | A directed edge between nodes |
| `DiagramGroup` | A group container for nodes |
| `DiagramEnter` / `DiagramExit` | Per-diagram animated enter/exit transitions |
| `GridLayout` / `HierarchicalLayout` / `ManualLayout` | Layout DSL wrappers |
| `DiagramCanvas` | Orthographic 3D scene with camera orbit/dolly/focus |
| `DiagramPipe` | 3D pipe connection between canvas diagram positions |
| `ImagePanel` | 3D image panel with bezel, gloss, and glow |
| `Screen` | 3D screen element (live URL or static src) |

### Compile Functions

| Export | Description |
|---|---|
| `compileDiagram` | Compile a diagram DSL to initial `DiagramState` |
| `compileCanvas` | Compile a canvas (containing diagrams and pipes) to initial state |
| `compileImagePanel` | Compile an image panel to initial state |
| `compileScreen` | Compile a screen to initial state |
| `resolveLayout` | Resolve node positions from a layout DSL |
| `routeEdges` | Route edges between positioned nodes |

### Plugin Factory

```ts
import { diagramPlugin } from '@brewsite/diagram';

// Pass to EngineProvider or ScenePlayer plugins prop
const plugin = diagramPlugin();
```

`diagramPlugin()` handles compiler handler registration and auto-creates `DiagramCanvasWidget` instances on first DSL encounter. Use it instead of calling `registerDiagramHandlers()` manually.

### Widget Classes

| Export | Description |
|---|---|
| `DiagramCanvasWidget` | Runtime widget for `DiagramCanvas` elements |
| `ImagePanelWidget` | Runtime widget for `ImagePanel` elements |
| `ScreenWidget` | Runtime widget for `Screen` elements |

> **Note:** `DiagramWidget` is an internal implementation class and is not part of the public API. Use `DiagramCanvasWidget` (via `diagramPlugin()`) for all diagram rendering.

### Theme Helpers

```ts
import { darkGlassTheme, neonCyberTheme, enterpriseTheme, lightMinimalTheme } from '@brewsite/diagram';
import { mergeTheme } from '@brewsite/diagram';

// Custom theme from preset — override just the parts you need
const brandTheme = mergeTheme(darkGlassTheme, {
  node: { defaultColor: '#2a1a40' },
  edge: { routing: 'orthogonal', defaultColor: '#ff6b35' },
});
```

Pass a theme to `<Diagram theme={...}>` or to `<DiagramCanvas theme={...}>` (canvas theme acts as fallback for all child diagrams).

### Focus Region

```ts
import { useDiagramFocusRegion, DIAGRAM_FOCUS_REGION_EVENT } from '@brewsite/diagram';
```

Used to programmatically focus the camera on a specific node or region within a `DiagramCanvas`.

## Visual Themes

| Theme | Description |
|---|---|
| `darkGlassTheme` | Dark glass panels with glowing edges |
| `neonCyberTheme` | Neon cyberpunk style |
| `enterpriseTheme` | Clean enterprise / corporate look |
| `lightMinimalTheme` | Light minimal style |

## Key Node Props

| Prop | Type | Description |
|---|---|---|
| `id` | `string` | Unique ID within the diagram (required) |
| `label` | `string \| undefined` | Primary label text. **Omit entirely** (not `label=""`) to declare a ghost node that inherits from the prior scene. |
| `thickness` | `number` | Physical prism depth in diagram units. Default: from theme. |
| `glow` | `boolean \| { intensity?, color? }` | Emissive glow override. Omit to inherit from theme. |
| `icon` | `DiagramIconVariant` | SVG icon on the front face (e.g. `"aws:s3"`, `"ui:user"`) |
| `shape` | `DiagramNodeShape` | Geometry shape. Default: `'rectangle'` |

## Ghost Nodes

A ghost node is a `<DiagramNode>` whose `label` prop is absent (not provided). It inherits its label, shape, icon, size, and thickness from the matching node in the previous scene, enabling drill-down animations.

```tsx
// Scene 1: full diagram
<DiagramNode id="api" label="API Gateway" icon="aws:api-gateway" size={[4, 2]} />

// Scene 2: spotlight a different node; keep API Gateway as faded context
<DiagramNode id="api" opacity={0.2} />  // ← ghost: label absent, inherits from Scene 1
```

Setting `label=""` (explicit empty string) is **not** a ghost node. It declares a blank-label node and keeps all other props as authored.

## Icon Support

Node icons are referenced via `icon` strings in the format `"provider:name"`:

- `aws:*` — AWS service icons (e.g., `aws:s3`, `aws:rds`, `aws:ecs`, `aws:lambda`)
- `gcp:*` — Google Cloud icons
- `azure:*` — Azure icons
- `net:*` — Network/infrastructure icons
- `ui:*` — Generic UI icons (e.g., `ui:user`, `ui:server`)
- `tech:*` — Technology icons (e.g., `tech:react`, `tech:postgresql`)
- `security:*` — Security icons
- `data:*` — Data/analytics icons

Icons are synced from [simple-icons](https://simpleicons.org) and [heroicons](https://heroicons.com) via `pnpm sync:icons` in the monorepo.

### 3D Icon Styles

The `iconStyle` prop on `DiagramNode` controls how SVG icons are extruded into 3D geometry:

| Style | Description |
|---|---|
| `layered` | Background colour slab + white symbol raised above it (ideal for two-layer SVGs like AWS icons) |
| `extruded` | All paths extruded to the same depth; PBR side faces catch lighting |
| `embossed` | Shallow extrusion with wide bevel chamfer — coin/medallion look |

## Peer Dependencies

| Package | Version |
|---|---|
| `@brewsite/core` | ^0.4 |
| `react` | ^19 |
| `react-dom` | ^19 |
| `three` | ^0.183 |

## Architecture

`@brewsite/diagram` follows the same mandatory element module pattern as `@brewsite/core`:

```
types.ts → dsl.tsx → compile.ts → render.ts → widget.ts → index.ts
```

The `diagram` element embeds additional sub-modules:
- `compiler/` — Node, group, layout, edge routing, and transition compilers
- `shapes/` — Geometry factory, icon registry, shape variants, 3D SVG icon renderer
- `themes/` — Theme preset objects
- `rendering/` — Three.js renderers (node, edge, group, text, icon, environment map)
- `canvas/` — `DiagramCanvas` orthographic scene with camera orbit/dolly/focus

## License

See [LICENSE](./LICENSE).
