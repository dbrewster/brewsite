---
title: "@brewsite/diagram — Nodes, Edges, and Groups"
doc_type: note
owner: claude-author
status: active
updated: 2026-03-15
---

## Diagram Element Overview

`<Diagram>` renders a 3D architecture diagram: nodes as geometry prisms, edges as tube curves, and groups as labeled rectangular regions. The diagram occupies an NVS-positioned viewport region and renders in an isolated OrthographicCamera scene.

The full DSL structure:

```tsx
<Diagram id="my-diagram" x={0} y={0} w={1} h={1}>
  <GridLayout columns={3} spacing={[2, 2]} />     {/* one layout element */}
  <DiagramEnter fade />                            {/* optional enter transition */}
  <DiagramExit fade />                             {/* optional exit transition */}

  <DiagramGroup id="group-a" label="Frontend" variant="boundary">
    <DiagramNode id="web" label="Web App" icon="tech:react" />
    <DiagramNode id="cdn" label="CDN" icon="aws:cloudfront" />
  </DiagramGroup>

  <DiagramNode id="api" label="API Gateway" icon="aws:api-gateway" />
  <DiagramEdge from="web" to="api" flow="forward" />
</Diagram>
```

Nodes inside a `<DiagramGroup>` belong to that group. Nodes outside any group are top-level. All `<DiagramEdge>` elements must be direct children of `<Diagram>` — not inside groups.

## Diagram Props

```tsx
interface DiagramProps {
  id: string;        // Required. Unique across all scenes. Must be stable.
  x?: number;        // NVS left edge [0..1]. Default: 0
  y?: number;        // NVS top edge [0..1]. Default: 0
  w?: number;        // NVS width [0..1]. Default: 1
  h?: number;        // NVS height [0..1]. Default: 1
  tilt?: number;     // Pitch tilt in radians. Default: 0. Use negative for angled view.
  z?: number;        // World-space Z depth of diagram plane. Default: 0
  scale?: number;    // World-space geometry scale. Default: 1
  children?: ReactNode;
}
```

NVS coordinates: `x=0` is the left edge of the viewport, `x=1` is the right edge. `y=0` is the top, `y=1` is the bottom.

To position a diagram in the left half of the screen:

```tsx
<Diagram id="left-diagram" x={0} y={0} w={0.5} h={1}>
```

To tilt the diagram plane for a dramatic angled view (common in architecture showcases):

```tsx
<Diagram id="angled" tilt={-Math.PI / 4} scale={1.1}>
```

When `<Diagram>` is nested inside a `<View>`, its NVS coordinates are relative to the view bounds — the compiler composes parent NVS context automatically.

## Node DSL

`<DiagramNode>` declares a node/vertex. The `id` must be unique within the diagram and stable across scenes (ghost node merging uses it to carry forward state).

```tsx
interface DiagramNodeProps {
  id: string;                            // Required. Unique within the diagram.
  label?: string;                        // Primary label text
  sublabel?: string;                     // Secondary label below primary
  shape?: DiagramNodeShape;             // Geometry shape. Default: 'rectangle'
  icon?: DiagramIconVariant;            // SVG icon on the front face
  position?: [number, number, number];  // [x, y, z] in NVS (ManualLayout only)
  size?: [number, number];              // [width, height] in diagram units (auto) or NVS (manual)
  thickness?: number;                   // 3D prism depth. Default: from theme
  color?: string;                       // Front-face CSS hex. Default: '#2a2d3e'
  boxColor?: string;                    // Side/top/bottom/back face CSS hex
  sideColor?: string;                   // Legacy alias for boxColor
  borderColor?: string;                 // Border outline CSS hex
  metalness?: number;                   // PBR metalness [0–1]. Default: from theme (~0.40)
  roughness?: number;                   // PBR roughness [0–1]. Default: from theme (~0.30)
  glow?: boolean | { intensity?: number; color?: string };  // Glow config
  cornerRadius?: number;                // Corner radius for rect shapes. Default: from theme
  labelColor?: string;                  // Label text CSS hex
  sublabelColor?: string;               // Sublabel text CSS hex. Default: '#a0a8c0'
  labelPadding?: number;                // Vertical label offset fraction [0–1]
  opacity?: number;                     // [0–1]. Default: 1
  clickable?: boolean;                  // Enable click/raycast. Default: false
  enabled?: boolean;                    // Whether rendered. Default: true
  iconScale?: number;                   // Icon scale relative to face [0–1]
  iconStyle?: SvgIcon3DStyle;           // 'flat' | 'extruded' | 'layered' | 'embossed'
  iconDepthFactor?: number;             // Icon extrusion depth as fraction of node thickness [0..1]
  surfaceMaterial?: string;              // Named material preset to apply
  materialApplication?: MaterialApplication; // How the material is applied
  onMouseEnter?: DiagramNodeMouseHandler;
  onMouseLeave?: DiagramNodeMouseHandler;
}
```

**Shapes — `DiagramNodeShape`:**

Regular polygon prisms: `'circle'` (32-sided), `'triangle'`, `'square'`, `'rectangle'` (default), `'pentagon'`, `'hexagon'`, `'heptagon'`, `'octagon'`, `'nonagon'`, `'decagon'`

Special extruded shapes: `'diamond'`, `'oval'`, `'cloud'`, `'document'`, `'parallelogram'`

```tsx
<DiagramNode id="db" label="Database" shape="rectangle" icon="flow:cylinder" />
<DiagramNode id="decision" label="Route?" shape="diamond" color="#4a3a10" />
<DiagramNode id="service" label="API" shape="hexagon" icon="tech:nodejs" />
```

**Icons — `DiagramIconVariant`:**

All icon values are namespaced strings. Main namespaces:

- `flow:actor`, `flow:cylinder`, `flow:cylinder-stack`, `flow:queue`
- `ui:server`, `ui:cloud`, `ui:database`, `ui:lock-closed`, `ui:user`, `ui:globe-alt`, `ui:code-bracket`, and many more Heroicons
- `tech:docker`, `tech:kubernetes`, `tech:postgresql`, `tech:kafka`, `tech:react`, `tech:github`, and many more Simple Icons
- `security:shield`, `security:lock`, `security:key`, `security:vpn`, `security:waf`, etc.
- `data:pipeline`, `data:warehouse`, `data:etl`, `data:stream`, etc.
- `aws:ec2`, `aws:s3`, `aws:lambda`, `aws:rds`, `aws:api-gateway`, `aws:cloudfront`, `aws:dynamodb`, etc.
- `gcp:compute-engine`, `gcp:cloud-run`, `gcp:bigquery`, `gcp:pubsub`, `gcp:gke`, etc.
- `azure:virtual-machine`, `azure:functions`, `azure:aks`, `azure:cosmos-db`, `azure:key-vault`, etc.
- `net:router`, `net:switch`, `net:firewall`, `net:load-balancer`, `net:server`, `net:cdn-pop`, etc.
- `custom:${string}` — escape hatch; requires a custom resolver

```tsx
<DiagramNode id="lambda" label="Auth Lambda" icon="aws:lambda" color="#f90" />
<DiagramNode id="pg" label="Postgres" icon="tech:postgresql" shape="rectangle" />
<DiagramNode id="k8s" label="Cluster" icon="tech:kubernetes" iconStyle="layered" />
```

**Icon 3D style (`iconStyle`):**

- `'flat'` — ShapeGeometry, unlit (default, lowest cost)
- `'extruded'` — ExtrudeGeometry, PBR lit (depth visible)
- `'layered'` — Most impactful for cloud icons; multiple depth layers
- `'embossed'` — Shallow relief

**Glow prop:**

```tsx
<DiagramNode id="critical" glow={{ intensity: 0.4, color: '#ff4444' }} />
<DiagramNode id="normal" glow={true} />      // theme-default intensity
<DiagramNode id="plain" glow={false} />      // suppress theme glow
```

**Position and size for ManualLayout:**

With `<ManualLayout>`, positions are NVS fractions `[0..1]` where `[0.5, 0.5, 0]` is the center of the diagram viewport. Size is also NVS — `[0.15, 0.08]` is 15% wide by 8% tall.

```tsx
<Diagram id="d1" x={0} y={0} w={1} h={1}>
  <ManualLayout />
  <DiagramNode id="node-a" label="Service A" position={[0.2, 0.4, 0]} size={[0.15, 0.08]} />
  <DiagramNode id="node-b" label="Service B" position={[0.6, 0.4, 0]} size={[0.15, 0.08]} />
</Diagram>
```

With auto-layout (GridLayout, HierarchicalLayout, FlowLayout), do not specify `position`. The `size` is in diagram units (default `[4, 2]` from theme). Position is auto-assigned and normalized.

## Edge DSL

`<DiagramEdge>` declares a connector between two nodes. The `from` and `to` values must exactly match sibling `<DiagramNode id="...">` values.

```tsx
interface DiagramEdgeProps {
  id?: string;                          // Optional unique ID
  from: string;                         // Source node id
  to: string;                           // Destination node id
  label?: string;                       // Label at edge midpoint
  style?: DiagramEdgeStyle;            // 'solid' | 'dashed' | 'dotted'. Default: 'solid'
  arrowStart?: DiagramArrowVariant;    // 'none' | 'open' | 'filled' | 'diamond' | 'circle'. Default: 'none'
  arrowEnd?: DiagramArrowVariant;      // Default: 'open'
  flow?: DiagramEdgeFlow;              // 'none' | 'forward' | 'backward' | 'bidirectional'
  flowColor?: string;                  // CSS hex for flow pulse. Default: edge color
  color?: string;                      // Edge tube CSS hex. Default: from theme
  thickness?: number;                  // Tube radius in diagram units. Default: from theme
  opacity?: number;                    // [0–1]. Default: 1
  routing?: EdgeRoutingAlgorithm;      // 'curved' | 'straight' | 'organic' | 'flow'
  flowTurnRadius?: number;             // Per-edge override for flow routing turn radius
  flowFaceStub?: number;               // Per-edge override for flow face stub length
  flowBundleStrength?: number;         // Per-edge override for flow bundle trunk length
  flowTargetApproachBias?: number;     // Per-edge override for flow target ingress bias
  allowUnderpass?: boolean;            // Enable Z underpass escape hatch in flow routing
  fromPort?: DiagramEdgePort;          // 'top' | 'bottom' | 'left' | 'right' | 'front' | 'back'
  toPort?: DiagramEdgePort;            // Explicit attachment port at destination
}
```

Common patterns:

```tsx
{/* Simple directed edge with flow animation */}
<DiagramEdge from="client" to="api" flow="forward" />

{/* Bidirectional with label */}
<DiagramEdge from="api" to="db" label="SQL" flow="bidirectional" color="#4488ff" />

{/* Dashed dependency line */}
<DiagramEdge from="service-a" to="config" style="dashed" arrowEnd="none" opacity={0.6} />

{/* Obstacle-aware routing */}
<DiagramEdge from="ingress" to="backend" routing="flow" arrowEnd="filled" />

{/* Explicit port attachment */}
<DiagramEdge from="load-balancer" to="server-1" fromPort="bottom" toPort="top" />
```

`<DiagramEdge>` must be a direct child of `<Diagram>`, not nested inside a `<DiagramGroup>`.

## Group DSL

`<DiagramGroup>` wraps `<DiagramNode>` children (and optionally nested `<DiagramGroup>` children) into a labeled container region. Group bounds are computed from the union of child node positions and sizes.

```tsx
interface DiagramGroupProps {
  id: string;                               // Required. Unique within the diagram.
  label?: string;                           // Header label
  variant?: DiagramGroupVariant;           // 'boundary' | 'cluster' | 'swimlane' | 'container'
  orientation?: DiagramOrientation;        // 'horizontal' | 'vertical' (swimlane only)
  color?: string;                          // Fill CSS hex. Default: '#1a1d2e'
  borderColor?: string;                    // Border CSS hex. Default: '#3a4060'
  borderStyle?: 'solid' | 'dashed' | 'none'; // Default: 'solid'
  fillOpacity?: number;                    // [0–1]. Default: 0.08
  borderOpacity?: number;                  // [0–1]. Default: 0.6
  borderEmissiveColor?: string;            // Border emissive CSS hex. Default: borderColor
  borderEmissiveIntensity?: number;        // Border emissive intensity [0–1+]. Default: 0
  labelColor?: string;                     // Title label CSS hex. Default: from theme
  edgeLights?: DiagramGroupEdgeLightsDSL; // Point lights around group border
  surfaceMaterial?: string;              // Named material preset to apply
  materialApplication?: MaterialApplication; // How the material is applied
  onMouseEnter?: DiagramGroupMouseHandler;
  onMouseLeave?: DiagramGroupMouseHandler;
  children?: ReactNode;
}
```

**Group variants:**

- `'boundary'` — outlined rectangular region with a visible border frame
- `'cluster'` — shaded container with soft fill
- `'swimlane'` — lane container with title/divider; `orientation` controls axis
- `'container'` — borderless region; border style is always suppressed

```tsx
<DiagramGroup id="frontend" label="Frontend Tier" variant="boundary" color="#1a2040" borderStyle="dashed">
  <DiagramNode id="web" label="React SPA" icon="tech:react" />
  <DiagramNode id="cdn" label="CloudFront" icon="aws:cloudfront" />
</DiagramGroup>

<DiagramGroup id="backend" label="Backend Tier" variant="cluster" color="#0a1a10">
  <DiagramNode id="api" label="API Server" icon="tech:nodejs" />
  <DiagramNode id="cache" label="Redis" icon="tech:redis" />
</DiagramGroup>
```

Nodes can only belong to one group. A node declared inside a `<DiagramGroup>` is collected into that group and excluded from the top-level node list. Nested `<DiagramGroup>` children create sub-groups.

## Layout Algorithms

Declare exactly one layout element as a direct child of `<Diagram>` (or inside a `<DiagramGroup>` for per-group layout). If no layout element is declared, the theme's `layout.defaultKind` applies (typically `'grid'`).

**GridLayout** — arranges nodes in a column-based grid:

```tsx
interface GridLayoutProps {
  columns?: number | 'auto'; // Number of columns. Default: 4
  spacing?: [number, number]; // [colGap, rowGap] in diagram units. Default: [2, 2]
  margin?: number | [number, number]; // Per-node margin expanding footprint
  groupPadding?: LayoutPadding; // Padding inside group boxes. Default: 1.5
  titleGap?: number;            // Gap between group title and content. Default: 0.75
  alignment?: LayoutAlignment;  // 'left' | 'center' | 'right'. Default: 'left'
  disconnected?: LayoutDisconnected; // Placement for disconnected nodes. Default: 'next-to'
}
```

```tsx
<Diagram id="services">
  <GridLayout columns={3} spacing={[3, 2]} />
  <DiagramNode id="svc-a" label="Auth" icon="security:lock" />
  <DiagramNode id="svc-b" label="Users" icon="ui:users" />
  <DiagramNode id="svc-c" label="Billing" icon="ui:credit-card" />
</Diagram>
```

**HierarchicalLayout** — arranges nodes in a tree/hierarchy by edge direction:

```tsx
interface HierarchicalLayoutProps {
  direction?: 'top-down' | 'left-right'; // Layout axis. Default: 'top-down'
  spacing?: [number, number];             // [colGap, rowGap]. Default: [2, 2]
  margin?: number | [number, number];
  groupPadding?: LayoutPadding;
  titleGap?: number;
  alignment?: LayoutAlignment;           // Default: 'center'
  disconnected?: LayoutDisconnected;
}
```

```tsx
<Diagram id="hierarchy">
  <HierarchicalLayout direction="top-down" spacing={[2, 3]} />
  <DiagramNode id="ceo" label="CEO" />
  <DiagramNode id="cto" label="CTO" />
  <DiagramNode id="eng" label="Engineering" />
  <DiagramEdge from="ceo" to="cto" />
  <DiagramEdge from="cto" to="eng" />
</Diagram>
```

**FlowLayout** — stacks nodes linearly along an axis:

```tsx
interface FlowLayoutProps {
  direction?: 'top-down' | 'left-right'; // Default: 'top-down'
  gap?: number;                           // Edge-to-edge gap in diagram units. Default: 2
  groupPadding?: LayoutPadding;
  titleGap?: number;                      // Default: 1
}
```

```tsx
<Diagram id="pipeline">
  <FlowLayout direction="left-right" gap={3} />
  <DiagramNode id="ingest" label="Ingest" icon="data:stream" />
  <DiagramNode id="transform" label="Transform" icon="data:etl" />
  <DiagramNode id="load" label="Load" icon="data:warehouse" />
  <DiagramEdge from="ingest" to="transform" flow="forward" />
  <DiagramEdge from="transform" to="load" flow="forward" />
</Diagram>
```

**ManualLayout** — no automatic positioning; every node requires an explicit `position` in NVS `[0..1]` space:

```tsx
interface ManualLayoutProps {
  groupPadding?: LayoutPadding;
  titleGap?: number;
}
```

With `<ManualLayout>`, node `position` is `[x, y, z]` where `x=0` is left edge, `x=1` is right edge of the diagram viewport, `y=0` is top, `y=1` is bottom. Node `size` is NVS fractions `[width, height]`. The theme default size `[4, 2]` is in diagram units — it is not valid for ManualLayout. Always provide explicit `size` with ManualLayout.

```tsx
<Diagram id="manual-arch">
  <ManualLayout />
  <DiagramNode id="lb" label="Load Balancer" icon="aws:alb"
    position={[0.5, 0.15, 0]} size={[0.15, 0.07]} />
  <DiagramNode id="app-a" label="App A" icon="tech:nodejs"
    position={[0.3, 0.45, 0]} size={[0.13, 0.07]} />
  <DiagramNode id="app-b" label="App B" icon="tech:nodejs"
    position={[0.7, 0.45, 0]} size={[0.13, 0.07]} />
  <DiagramEdge from="lb" to="app-a" routing="flow" />
  <DiagramEdge from="lb" to="app-b" routing="flow" />
</Diagram>
```

## Diagram Themes

Themes control all default material properties, colors, routing, and layout defaults. Two built-in presets ship with `@brewsite/diagram`:

- `enterpriseTheme` / `defaultDiagramTheme` — dark enterprise aesthetic (exported from `@brewsite/diagram`)
- `enterpriseLightTheme` / `defaultLightDiagramTheme` — light enterprise aesthetic

Additional named theme families (`darkGlass`, `midnight`, `neonCyber`, `lightMinimal`, etc.) ship with `@brewsite/themes` and are registered via `themesPlugin()`.

**Using a theme:** Themes are not passed directly to `<Diagram>`. They are resolved from the engine-level `SceneEngine theme` prop via `diagramPlugin`'s compilation context. The theme family + polarity is set on the engine:

```tsx
// Set theme on SceneEngine — all diagrams in this engine use this theme
<SceneEngine plugins={plugins} theme={themes.darkGlass.dark}>
```

To manually resolve a theme object (e.g. for static rendering without an engine):

```tsx
import { resolveDiagramTheme } from '@brewsite/diagram';
const theme = resolveDiagramTheme('darkGlass', 'dark');
```

To register a custom theme family:

```tsx
import { registerDiagramThemePair, mergeTheme, defaultDiagramTheme } from '@brewsite/diagram';

registerDiagramThemePair('my-brand', {
  dark: mergeTheme(defaultDiagramTheme, {
    node: { defaultColor: '#1a0030', defaultMetalness: 0.6 },
    edge: { defaultColor: '#aa44ff' },
  }),
  light: enterpriseLightTheme,
});
```

In React components, use `useDiagramTheme()` to get the currently active theme:

```tsx
import { useDiagramTheme } from '@brewsite/diagram';

function MyComponent() {
  const theme = useDiagramTheme();
  // theme is undefined if no ThemeKeyContext is present
}
```

## Diagram Animations

Diagrams transition between scenes by interpolating all per-element state (positions, opacities, colors). For smooth scene-to-scene morphing, keep the same `<Diagram id="...">` across scenes — nodes with matching `id` values are cross-faded. New nodes fade in; removed nodes fade out.

**Enter transition** — controls how a diagram animates in at the start of its scene:

```tsx
<Diagram id="d1">
  <DiagramEnter
    from={[0.5, -0.5, 0]}  // Start position in NVS (off-screen above)
    fade={true}             // Fade node/edge opacities from 0. Default: true
    easing="ease"           // 'linear' | 'ease' | 'ease-in' | 'ease-out' | 'spring'
  />
  {/* nodes, edges, groups */}
</Diagram>
```

If `from` is omitted, the diagram fades in from its declared viewport bounds (no positional animation).

**Exit transition** — controls how a diagram animates out at the end of its scene:

```tsx
<Diagram id="d1">
  <DiagramExit
    to={[0.5, 1.5, 0]}    // End position in NVS (off-screen below)
    fade={true}             // Fade to 0. Default: true
    easing="spring"         // 'spring' adds a slight overshoot feel
  />
  {/* nodes, edges, groups */}
</Diagram>
```

NVS values outside `[0..1]` are off-screen. `to={[-1, 0.5, 0]}` exits one full viewport width to the left. `to={[0.5, 2, 0]}` exits one full viewport height below center.

Both `<DiagramEnter>` and `<DiagramExit>` must be direct children of `<Diagram>`. Placing them inside a `<DiagramGroup>` is a compile-time warning and they will be ignored.

**Fade-only (no positional animation):**

```tsx
<DiagramEnter fade />        {/* no `from` — just fades in from current position */}
<DiagramExit fade />         {/* no `to` — just fades out in place */}
```

## Complete Diagram Example

This is a complete, runnable scene with `diagramPlugin` registration, camera, lighting, background, and a diagram with nodes, edges, groups, and a hierarchical layout.

**Widget setup file (`widgetSetup.ts`):**

```tsx
import type { WidgetPlugin, ActiveTheme } from '@brewsite/core';
import { corePlugin } from '@brewsite/core';
import { diagramPlugin } from '@brewsite/diagram';
import { themesPlugin, themes } from '@brewsite/themes';

export function createPlugins(): { plugins: WidgetPlugin[]; theme: ActiveTheme } {
  return {
    plugins: [corePlugin(), diagramPlugin(), themesPlugin()],
    theme: themes.darkGlass.dark,
  };
}
```

**Scene DSL:**

```tsx
import type { JSX } from 'react';
import {
  Scene, ProgressManager, Camera, Lighting, Ambient, Directional, Background,
} from '@brewsite/core';
import {
  Diagram, DiagramNode, DiagramEdge, DiagramGroup,
  DiagramEnter, HierarchicalLayout,
} from '@brewsite/diagram';

export const SceneCloudArchitecture = (): JSX.Element => (
  <Scene id="cloud-arch">
    <ProgressManager scrollUnits={2000} />
    <Camera mode="world" position={[0, 5, 22]} target={[0, 0, 0]} fov={52} />
    <Lighting intensityScale={1}>
      <Ambient intensity={1.1} color="#ffffff" />
      <Directional intensity={0.5} color="#aaccff" position={[0, 20, 30]} />
      <Directional intensity={0.3} color="#6688cc" position={[-20, 10, 10]} />
    </Lighting>
    <Background color="#080b14" />

    <Diagram id="cloud-arch-diagram" x={0.05} y={0.05} w={0.9} h={0.85}>
      <HierarchicalLayout direction="top-down" spacing={[3, 3]} />
      <DiagramEnter fade />

      {/* Entry point */}
      <DiagramNode
        id="user"
        label="Users"
        icon="ui:users"
        shape="circle"
        color="#1a2040"
        size={[5, 3]}
      />

      {/* Frontend group */}
      <DiagramGroup id="frontend" label="Frontend" variant="boundary" color="#1a2040">
        <DiagramNode
          id="cloudfront"
          label="CloudFront CDN"
          icon="aws:cloudfront"
          color="#1a3040"
        />
        <DiagramNode
          id="alb"
          label="App Load Balancer"
          icon="aws:alb"
          color="#1a3040"
        />
      </DiagramGroup>

      {/* Backend group */}
      <DiagramGroup id="backend" label="Backend Services" variant="cluster" color="#0a1a10">
        <DiagramNode
          id="api"
          label="API Service"
          icon="aws:ecs"
          color="#102020"
          glow={{ intensity: 0.15, color: '#44aaff' }}
        />
        <DiagramNode
          id="auth"
          label="Auth Lambda"
          icon="aws:lambda"
          color="#102010"
        />
      </DiagramGroup>

      {/* Data tier */}
      <DiagramNode
        id="rds"
        label="Aurora RDS"
        icon="aws:aurora"
        shape="rectangle"
        color="#1a1020"
        size={[5, 2.5]}
      />

      {/* Edges */}
      <DiagramEdge from="user" to="cloudfront" flow="forward" color="#4488aa" />
      <DiagramEdge from="cloudfront" to="alb" flow="forward" color="#4488aa" />
      <DiagramEdge from="alb" to="api" flow="forward" color="#44aa88" />
      <DiagramEdge from="alb" to="auth" style="dashed" color="#44aa88" />
      <DiagramEdge from="api" to="rds" flow="forward" label="SQL" color="#8844aa" />
    </Diagram>
  </Scene>
);
```

**Page component:**

```tsx
import { useMemo } from 'react';
import {
  SceneEngine, SceneCanvas, ScrollStage, BackgroundLayer,
  EngineARContainer, EngineOverlayHost, InputCoordinator,
} from '@brewsite/core';
import { createPlugins } from './widgetSetup';
import { SceneCloudArchitecture } from './scenes';

export default function CloudArchPage() {
  const { plugins, theme } = useMemo(() => createPlugins(), []);

  return (
    <div style={{ background: '#080b14', height: '100vh', overflow: 'hidden' }}>
      <SceneEngine plugins={plugins} theme={theme}>
        {[<SceneCloudArchitecture key="cloud-arch" />]}
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
