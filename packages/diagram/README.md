# @brewsite/diagram

3D immersive diagram, canvas, image-panel, and screen elements for the BrewFlow Scene Toolkit. Built on top of `@brewsite/core`, this package adds interactive architectural diagram rendering with node/edge/group layouts, animated transitions, cloud provider icon support, and multiple visual themes.

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
      <DiagramCanvas id="main-canvas" rotation={[-Math.PI / 6, 0, 0]}>
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

**2. Create the widget setup** (compile initial state and register widgets):

```ts
// widgetSetup.ts
import { createDefaultWidgetRegistry } from '@brewsite/core';
import type { AssetManifest } from '@brewsite/core';
import {
  DiagramCanvasWidget,
  compileCanvas,
  compileDiagram,
  registerDiagramHandlers,
} from '@brewsite/diagram';

export const createWidgetSetup = (manifest: AssetManifest | null) => {
  registerDiagramHandlers();

  const registry = createDefaultWidgetRegistry(manifest);

  const canvasDefault = compileCanvas(
    { id: 'main-canvas' },
    [
      compileDiagram({
        id: 'arch-diagram',
        layout: { kind: 'hierarchical', spacing: [3, 2] },
        pivot: 'center',
        nodes: [
          { id: 'api', label: 'API Gateway', icon: 'aws:api-gateway' },
          { id: 'svc', label: 'Service',     icon: 'aws:ecs' },
          { id: 'db',  label: 'Database',    icon: 'aws:rds' },
        ],
        edges: [
          { from: 'api', to: 'svc' },
          { from: 'svc', to: 'db' },
        ],
        groups: [],
      }),
    ],
    [],
  );

  registry.register(new DiagramCanvasWidget('main-canvas', canvasDefault));
  return registry;
};
```

**3. Render** with `ScenePlayer`:

```tsx
import { ScenePlayer } from '@brewsite/core';
import { myScene } from './scenes/myScene';
import { createWidgetSetup } from './widgetSetup';

export default function Page() {
  return (
    <ScenePlayer
      sceneGroup={{ id: 'demo', scenes: [myScene] }}
      widgetSetup={createWidgetSetup}
      framesPerTick={100}
      pixelsPerScene={1600}
    />
  );
}
```

> **Note:** `registerDiagramHandlers()` must be called before the first `ScenePlayer` render. Calling it inside `widgetSetup` (as above) is the recommended pattern.

## Key Exports

### DSL Components

| Export | Description |
|---|---|
| `Diagram` | Root diagram element (nodes, edges, groups) |
| `DiagramNode` | A single node in the diagram |
| `DiagramEdge` | A directed edge between nodes |
| `DiagramGroup` | A group container for nodes |
| `Exit` / `Enter` | Per-element animated enter/exit transitions |
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

### Widget Classes

| Export | Description |
|---|---|
| `DiagramCanvasWidget` | Runtime widget for `DiagramCanvas` elements |
| `DiagramWidget` | Runtime widget for standalone `Diagram` elements |
| `ImagePanelWidget` | Runtime widget for `ImagePanel` elements |
| `ScreenWidget` | Runtime widget for `Screen` elements |

### Registration

```ts
import { registerDiagramHandlers } from '@brewsite/diagram';

// Call once, before the first ScenePlayer render
registerDiagramHandlers();
```

### Themes

```ts
import { darkGlassTheme, neonCyberTheme, enterpriseTheme, lightMinimalTheme } from '@brewsite/diagram';
```

Pass a theme to the `Diagram` DSL component via the `theme` prop.

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

## Icon Support

Node icons are referenced via `icon` strings in the format `"provider:name"`:

- `aws:*` — AWS service icons (e.g., `aws:s3`, `aws:rds`, `aws:ecs`, `aws:lambda`)
- `gcp:*` — Google Cloud icons
- `azure:*` — Azure icons
- `network:*` — Network/infrastructure icons
- `ui:*` — Generic UI icons (e.g., `ui:user`, `ui:server`)

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
