---
title: "Documentation Site — @brewsite/diagram Book"
doc_type: plan
status: draft
owner: brewsite-product-manager
last_updated: 2026-02-28
change_history:
  - date: 2026-02-28
    author: "Toolkit Product"
    summary: "Initial plan created. Full implementation blueprint for the @brewsite/diagram documentation book. Covers all diagram-specific pages, demo files, navigation, widget setup, and integration with the shared docs infrastructure from plan_docs_core.md."
  - date: 2026-02-28
    author: "Toolkit Product"
    summary: "Incorporated resolved design decisions: widget constructors verified against source — all require (widgetId, defaultState); defaultState is produced via compileDiagram/compileCanvas/compileImagePanel/compileScreen functions. HDR environment map configured via vite fs.allow from packages/diagram/public. Icon registry populated via pnpm sync:icons with documentation on how to run it. All demos use DSL only (no direct widget API exposure). Light/dark theme toggle applies to diagram docs pages consistent with core book."
---

# Documentation Site — @brewsite/diagram Book

## Overview

This plan covers the `@brewsite/diagram` documentation book. It builds on top of the shared infrastructure defined in `plan_docs_core.md`. The diagram book is a second "book" within the same `apps/docs` Vite app, accessible at the `/diagram/*` route prefix.

`@brewsite/diagram` is the ideal package to document with live demos: all of its elements — `Diagram`, `DiagramCanvas`, `ImagePanel`, `Screen` — generate geometry procedurally in Three.js. No external model assets are required. Every page in the diagram book has a fully live, interactive 3D widget demo.

---

## 1. Diagram Book Navigation — `src/nav/diagram-nav.ts`

```typescript
import type { NavSection } from './types';

export const diagramNav: NavSection[] = [
  {
    title: 'Getting Started',
    items: [
      { label: 'What is @brewsite/diagram?', path: '/diagram/getting-started' },
      { label: 'Setup & Registration',       path: '/diagram/setup' },
    ],
  },
  {
    title: 'Diagram Element',
    items: [
      { label: 'Overview',                   path: '/diagram/overview' },
      { label: 'Nodes',                      path: '/diagram/nodes' },
      { label: 'Edges',                      path: '/diagram/edges' },
      { label: 'Groups',                     path: '/diagram/groups' },
      { label: 'Layouts',                    path: '/diagram/layouts' },
      { label: 'Enter & Exit Animations',    path: '/diagram/animations' },
    ],
  },
  {
    title: 'DiagramCanvas',
    items: [
      { label: 'DiagramCanvas',              path: '/diagram/canvas' },
      { label: 'Focus Regions',              path: '/diagram/focus-region' },
    ],
  },
  {
    title: 'Theming',
    items: [
      { label: 'Built-in Themes',            path: '/diagram/themes' },
      { label: 'Custom Themes',              path: '/diagram/custom-themes' },
    ],
  },
  {
    title: 'Additional Elements',
    items: [
      { label: 'ImagePanel',                 path: '/diagram/image-panel' },
      { label: 'Screen',                     path: '/diagram/screen' },
    ],
  },
  {
    title: 'Widget Integration',
    items: [
      { label: 'Registering Widgets',        path: '/diagram/widget-setup' },
    ],
  },
  {
    title: 'Reference',
    items: [
      { label: 'Type Reference',             path: '/diagram/types' },
    ],
  },
];
```

---

## 2. Route Configuration

The diagram routes are added to the `App.tsx` router established in `plan_docs_core.md`. Add these routes inside the `/diagram/*` `<Route>`:

```tsx
// All lazy-imported from pages/diagram/
<Route path="getting-started" element={<DiagramGettingStarted />} />
<Route path="setup"           element={<DiagramSetup />} />
<Route path="overview"        element={<DiagramOverview />} />
<Route path="nodes"           element={<DiagramNodes />} />
<Route path="edges"           element={<DiagramEdges />} />
<Route path="groups"          element={<DiagramGroups />} />
<Route path="layouts"         element={<DiagramLayouts />} />
<Route path="animations"      element={<DiagramAnimations />} />
<Route path="canvas"          element={<DiagramCanvasPage />} />
<Route path="focus-region"    element={<DiagramFocusRegion />} />
<Route path="themes"          element={<DiagramThemes />} />
<Route path="custom-themes"   element={<DiagramCustomThemes />} />
<Route path="image-panel"     element={<DiagramImagePanel />} />
<Route path="screen"          element={<DiagramScreen />} />
<Route path="widget-setup"    element={<DiagramWidgetSetup />} />
<Route path="types"           element={<DiagramTypes />} />
```

---

## 3. Widget Registry Setup for Diagram Demos

All diagram demos require both `@brewsite/core` widgets AND `@brewsite/diagram` widgets registered. `@brewsite/diagram` auto-registers its node handlers at import time via `import './register'` in its `index.ts`, but the widget instances (`DiagramWidget`, `DiagramCanvasWidget`, etc.) must still be registered in the `WidgetRegistry`.

### 3.1 `src/demos/shared/diagramDemoSetup.ts`

All four diagram widget constructors take `(widgetId: string, defaultState: T)`. The `defaultState` is produced by calling the compile function for that element type with a minimal default definition. This pattern is confirmed against the source code in `packages/diagram/src/elements/*/widget.ts`.

```typescript
import { createDefaultWidgetRegistry, WidgetRegistry } from '@brewsite/core';
import {
  DiagramWidget,
  DiagramCanvasWidget,
  ImagePanelWidget,
  ScreenWidget,
  compileDiagram,
  compileCanvas,
  compileImagePanel,
  compileScreen,
} from '@brewsite/diagram';
import { darkGlassTheme } from '@brewsite/diagram';

/**
 * Creates the default DiagramState for a demo diagram widget.
 * The widgetId here must match the `id` prop on the <Diagram> DSL component.
 */
function makeDiagramDefault(id: string) {
  return compileDiagram({
    id,
    layout: { kind: 'grid', columns: 3 },
    pivot: 'center',
    nodes: [],
    edges: [],
    groups: [],
  });
}

function makeCanvasDefault(id: string) {
  return compileCanvas({ id }, [], []);
}

function makeImagePanelDefault(id: string) {
  return compileImagePanel({
    id,
    src: '/assets/docs/sample-image.jpg',
    position: [0, 0, 0],
    width: 4,
    bezel: 'thin',
    gloss: 0.4,
    glow: false,
    enabled: true,
  });
}

function makeScreenDefault(id: string) {
  return compileScreen({
    id,
    src: '/assets/docs/sample-screen.png',
    position: [0, 0, 0],
    width: 5,
    height: 3,
    bezel: 'chrome',
    glow: false,
    enabled: true,
  });
}

/**
 * Creates a WidgetRegistry with all @brewsite/core built-ins
 * plus diagram widget instances matching the IDs used in demos.
 *
 * widgetId values here MUST match the `id` prop on the corresponding DSL elements.
 */
export function createDiagramDemoRegistry(): WidgetRegistry {
  const registry = createDefaultWidgetRegistry(null);

  registry
    .register(new DiagramWidget('diagram',           makeDiagramDefault('diagram')))
    .register(new DiagramWidget('nodes-demo',        makeDiagramDefault('nodes-demo')))
    .register(new DiagramWidget('edges-demo',        makeDiagramDefault('edges-demo')))
    .register(new DiagramWidget('groups-demo',       makeDiagramDefault('groups-demo')))
    .register(new DiagramWidget('layout-demo',       makeDiagramDefault('layout-demo')))
    .register(new DiagramWidget('anim-demo',         makeDiagramDefault('anim-demo')))
    .register(new DiagramWidget('theme-dark',        makeDiagramDefault('theme-dark')))
    .register(new DiagramWidget('theme-neon',        makeDiagramDefault('theme-neon')))
    .register(new DiagramWidget('theme-enterprise',  makeDiagramDefault('theme-enterprise')))
    .register(new DiagramWidget('theme-light',       makeDiagramDefault('theme-light')))
    .register(new DiagramCanvasWidget('canvas-demo', makeCanvasDefault('canvas-demo')))
    .register(new DiagramWidget('arch',              makeDiagramDefault('arch')))  // child of canvas-demo
    .register(new ImagePanelWidget('image-panel',    makeImagePanelDefault('image-panel')))
    .register(new ScreenWidget('screen',             makeScreenDefault('screen')));

  return registry;
}
```

> **Important**: Every `<Diagram id="...">` that appears in any demo scene requires a corresponding `DiagramWidget` instance registered with a matching `widgetId`. The registry is created once at module level (not inside the component render function) to avoid recreation on re-renders.

---

## 3.2 HDR Environment Map for Diagram Demos

`@brewsite/diagram` ships its HDR environment map at `packages/diagram/public/assets/envmaps/`. Diagram demos need this file to render the `darkGlassTheme` and `neonCyberTheme` correctly (those themes reference the env map via `DiagramThemeEnvironmentConfig.envMapPath`).

**Dev server**: Add to the `vite.config.ts` `server.fs.allow` array:
```typescript
server: {
  fs: {
    allow: [
      '../../apps/examples/public',      // MaleDummy and animation GLBs
      '../../packages/diagram/public',   // diagram HDR env map
      '../..',
    ],
  },
},
```

Then the env map is accessible at `/assets/envmaps/...` via the Vite dev server's file serving, since `packages/diagram/public/` is the `publicDir` for the diagram package (which Vite's FS allow makes reachable).

**Production build**: Add to `scripts/copy-demo-assets.mjs`:
```javascript
// Also copy diagram env map
const diagramPublic = resolve(__dirname, '../../../packages/diagram/public');
const envmapFiles = [
  'assets/envmaps/diagram-envmap.hdr',  // verify exact filename with ls packages/diagram/public/assets/envmaps/
];
for (const asset of envmapFiles) {
  const src = resolve(diagramPublic, asset);
  const dst = resolve(docsPublic, asset);
  mkdirSync(dirname(dst), { recursive: true });
  if (existsSync(src)) cpSync(src, dst);
}
```

> **Implementor note**: Verify the exact HDR filename by listing `packages/diagram/public/assets/envmaps/`. The filename is not hardcoded in this plan to avoid staleness.

---

## 4. Diagram Demo Files — `src/demos/diagram/`

All diagram demos are fully live — no external assets required. Diagrams generate their own Three.js geometry from node/edge/group definitions.

### 4.1 File List

```
src/demos/diagram/
├── BasicDiagram.demo.tsx
├── DiagramNodes.demo.tsx
├── DiagramEdges.demo.tsx
├── DiagramGroups.demo.tsx
├── GridLayout.demo.tsx
├── HierarchicalLayout.demo.tsx
├── ManualLayout.demo.tsx
├── DiagramThemeDark.demo.tsx
├── DiagramThemeNeon.demo.tsx
├── DiagramThemeEnterprise.demo.tsx
├── DiagramThemeLight.demo.tsx
├── DiagramAnimations.demo.tsx
├── DiagramCanvasDemo.demo.tsx
├── DiagramFocusDemo.demo.tsx
├── ImagePanelDemo.demo.tsx
└── ScreenDemo.demo.tsx
```

---

### 4.2 `BasicDiagram.demo.tsx`

Shows the minimum viable diagram: 3 nodes, 2 edges, dark glass theme.

```tsx
import React, { JSX } from 'react';
import { Scene, Camera, Background, Lighting } from '@brewsite/core';
import {
  Diagram, DiagramNode, DiagramEdge,
  darkGlassTheme,
  GridLayout,
} from '@brewsite/diagram';
import { DemoScene } from '../shared/DemoScene';
import { createDiagramDemoRegistry } from '../shared/diagramDemoSetup';

const registry = createDiagramDemoRegistry();

export const CODE = `
import { Diagram, DiagramNode, DiagramEdge, darkGlassTheme, GridLayout } from '@brewsite/diagram';

<Scene key="diagram-intro">
  <Camera descriptor={{ mode: 'world', position: [0, 5, 10], target: [0, 0, 0] }} />
  <Lighting ambient={{ color: '#ffffff', intensity: 0.4 }} />
  <Background color="#0a0a12" />
  <Diagram id="demo" theme={darkGlassTheme}>
    <GridLayout columns={3} />
    <DiagramNode id="A" label="Service A" />
    <DiagramNode id="B" label="Service B" />
    <DiagramNode id="C" label="Service C" />
    <DiagramEdge from="A" to="B" />
    <DiagramEdge from="B" to="C" />
  </Diagram>
</Scene>
`.trim();

export default function BasicDiagramDemo(): JSX.Element {
  return (
    <DemoScene registry={registry} sceneCount={1} height={420}>
      <Scene key="diagram-intro">
        <Camera descriptor={{ mode: 'world', position: [0, 5, 10], target: [0, 0, 0] }} />
        <Lighting ambient={{ color: '#ffffff', intensity: 0.4 }}
                  directional={{ color: '#aaddff', intensity: 0.8, position: [5, 10, 5] }} />
        <Background color="#0a0a12" />
        <Diagram id="demo" theme={darkGlassTheme}>
          <GridLayout columns={3} />
          <DiagramNode id="A" label="Service A" />
          <DiagramNode id="B" label="Service B" />
          <DiagramNode id="C" label="Service C" />
          <DiagramEdge from="A" to="B" />
          <DiagramEdge from="B" to="C" />
        </Diagram>
      </Scene>
    </DemoScene>
  );
}
```

---

### 4.3 `DiagramNodes.demo.tsx`

Shows all node shape variants across multiple scenes. Scene 1: default shapes. Scene 2: icon shapes with specific `shape` values. Scene 3: hover state with `hoverControls`.

Key node shapes to demonstrate:
- `'pill'` (default)
- `'hex'`
- `'circle'`
- `'diamond'`
- `'rectangle'`
- Icon shape (e.g., AWS CloudFront icon if the icon registry is populated)

```tsx
export const CODE = `
// Scenes showing different node shapes
<Diagram id="nodes" theme={darkGlassTheme}>
  <GridLayout columns={4} />
  <DiagramNode id="n1" label="Pill"       shape="pill" />
  <DiagramNode id="n2" label="Hex"        shape="hex" />
  <DiagramNode id="n3" label="Circle"     shape="circle" />
  <DiagramNode id="n4" label="Diamond"    shape="diamond" />
  <DiagramNode id="n5" label="Rectangle"  shape="rectangle" />
</Diagram>
`.trim();
```

---

### 4.4 `DiagramEdges.demo.tsx`

Shows edge style variants in a single diagram scene. 4 edges each with different `style`:
- `'straight'`
- `'curved'`
- `'orthogonal'`
- `'flow'` (animated edge flow)

Also shows `arrowVariant` values: `'none'`, `'arrow'`, `'openArrow'`.

```tsx
export const CODE = `
<Diagram id="edges" theme={darkGlassTheme}>
  <ManualLayout />
  <DiagramNode id="A" label="Source"      position={[-4, 0]} />
  <DiagramNode id="B" label="Target"      position={[ 4, 0]} />
  <DiagramEdge from="A" to="B" style="curved" arrowVariant="arrow" />
</Diagram>
`.trim();
```

---

### 4.5 `DiagramGroups.demo.tsx`

Shows group variants. 2 scenes:
- Scene 1: `'frame'` variant group containing 3 nodes
- Scene 2: `'region'` variant with edge lighting enabled

```tsx
export const CODE = `
<Diagram id="groups" theme={darkGlassTheme}>
  <GridLayout columns={2} />
  <DiagramGroup id="g1" label="Backend" variant="frame">
    <DiagramNode id="api"  label="API" />
    <DiagramNode id="db"   label="Database" />
    <DiagramNode id="auth" label="Auth" />
  </DiagramGroup>
</Diagram>
`.trim();
```

---

### 4.6 `GridLayout.demo.tsx`

Shows `GridLayout` with `columns` varying across scenes (1, 2, 3, 4 columns for the same 6 nodes). Demonstrates how layout reflow is animated.

---

### 4.7 `HierarchicalLayout.demo.tsx`

Shows `HierarchicalLayout` with `direction: 'top-down'` and `'left-right'`. 6 nodes in a tree structure.

---

### 4.8 `ManualLayout.demo.tsx`

Shows `ManualLayout` where nodes have explicit `position: [x, y]` props. Scene 1: spread out. Scene 2: nodes moved to different positions via scene transition.

---

### 4.9 `DiagramThemeDark.demo.tsx`

Demonstrates `darkGlassTheme`. Shows a 4-node, 3-edge diagram with the dark glass visual style (glassmorphism nodes, subtle grid, environment reflections).

---

### 4.10 `DiagramThemeNeon.demo.tsx`

Demonstrates `neonCyberTheme`. Same diagram structure as dark theme demo but with neon colors, glowing edges.

---

### 4.11 `DiagramThemeEnterprise.demo.tsx`

Demonstrates `enterpriseTheme`. Clean, corporate style with flat nodes and minimal chrome.

---

### 4.12 `DiagramThemeLight.demo.tsx`

Demonstrates `lightMinimalTheme`. Light background with dark text nodes.

---

### 4.13 `DiagramAnimations.demo.tsx`

Shows `<Enter>` and `<Exit>` animation components. 3 scenes:
- Scene 1: diagram before transition (nodes hidden, opacity 0)
- Scene 2: nodes enter with animated `Enter` config
- Scene 3: nodes exit with `Exit` config

```tsx
export const CODE = `
<Diagram id="anim" theme={neonCyberTheme}>
  <GridLayout columns={3} />
  <Enter duration={0.6} easing="easeOutElastic" />
  <Exit  duration={0.4} easing="easeIn" />
  <DiagramNode id="A" label="API Gateway" />
  <DiagramNode id="B" label="Auth"        />
  <DiagramNode id="C" label="Service"     />
</Diagram>
`.trim();
```

---

### 4.14 `DiagramCanvasDemo.demo.tsx`

Shows the `DiagramCanvas` element — an embedded orthographic diagram canvas within a scene. This is the interactive orbit/dolly experience.

```tsx
export const CODE = `
<Scene key="canvas-demo">
  <Camera descriptor={{ mode: 'world', position: [0, 3, 8], target: [0, 0, 0] }} />
  <Background color="#080810" />
  <Lighting ambient={{ intensity: 0.5 }} />
  <InputController scope="canvas">
    <Action drag={{ button: 0 }} onAction="camera.orbit" />
    <Action wheel={{ key: 'none' }} onAction="camera.dolly" />
    <Action key={{ code: 'KeyR' }} onAction="camera.reset" />
    <Action click={{ button: 0, key: 'ctrl' }} onAction="canvas.focus" />
  </InputController>
  <DiagramCanvas id="diagram-canvas">
    <DiagramPipe id="main">
      <Diagram id="arch" theme={darkGlassTheme}>
        <HierarchicalLayout direction="top-down" />
        <DiagramNode id="client" label="Client" />
        <DiagramNode id="lb"     label="Load Balancer" />
        <DiagramNode id="svc-a"  label="Service A" />
        <DiagramNode id="svc-b"  label="Service B" />
        <DiagramEdge from="client" to="lb" />
        <DiagramEdge from="lb" to="svc-a" />
        <DiagramEdge from="lb" to="svc-b" />
      </Diagram>
    </DiagramPipe>
  </DiagramCanvas>
</Scene>
`.trim();
```

This demo enables orbit drag and wheel dolly. The demo component uses `EngineInputRegion`.

---

### 4.15 `DiagramFocusDemo.demo.tsx`

Shows `useDiagramFocusRegion` — how clicking a node triggers `canvas.focus` to animate the camera to that node.

This demo shows a split: left panel is the 3D diagram canvas, right panel shows the current focused node ID as text (updated via `useDiagramFocusRegion` hook).

---

### 4.16 `ImagePanelDemo.demo.tsx`

Shows `<ImagePanel>` with different `bezel` variants: `'none'`, `'thin'`, `'thick'`. 3 scenes, one per variant.

```tsx
export const CODE = `
<Scene key="image-panel">
  <Camera descriptor={{ mode: 'world', position: [0, 1, 5], target: [0, 0, 0] }} />
  <Background color="#111118" />
  <Lighting ambient={{ intensity: 0.4 }} />
  <ImagePanel
    id="panel"
    src="/assets/docs/sample-image.jpg"
    bezel="thin"
    position={[0, 0, 0]}
    width={3}
    height={2}
  />
</Scene>
`.trim();
```

> **Asset note**: Include a 512×341px sample image at `apps/docs/public/assets/docs/sample-image.jpg`. This can be a simple gradient or abstract graphic generated at build time.

---

### 4.17 `ScreenDemo.demo.tsx`

Shows `<Screen>` element with different bezel variants and aspect ratios. 2 scenes.

---

## 5. Doc Pages — Full Content Specification

All pages live in `src/pages/diagram/`.

---

### 5.1 `GettingStarted.tsx`

**Route**: `/diagram/getting-started`

**Content**:
1. H1: "What is @brewsite/diagram?"
2. Pitch paragraph: immersive 3D diagrams, image panels, and screens for `@brewsite/core` scenes
3. Package relationship: `@brewsite/diagram` extends `@brewsite/core`; must have core set up first
4. `LiveDemo` embedding `BasicDiagramDemo`
5. H2: "When to Use @brewsite/diagram"
   - Architecture diagrams, product screenshots, system overviews
   - Animated diagram transitions for storytelling
6. Link: "Continue to Setup →"

---

### 5.2 `DiagramSetup.tsx`

**Route**: `/diagram/setup`

**Content**:
1. H1: "Setup & Registration"
2. H2: "Install"
   - `CodeBlock` (bash): `npm install @brewsite/diagram`
3. H2: "Register Diagram Widgets"
   - Key concept: `createDefaultWidgetRegistry` registers core widgets; diagram widgets must be added manually
   - `CodeBlock` showing the full `widgetSetup` function:
     ```tsx
     import { createDefaultWidgetRegistry } from '@brewsite/core';
     import {
       DiagramWidget, DiagramCanvasWidget,
       ImagePanelWidget, ScreenWidget,
     } from '@brewsite/diagram';

     export function createWidgetRegistry(manifest) {
       const registry = createDefaultWidgetRegistry(manifest);
       registry.register(new DiagramWidget('diagram'));
       registry.register(new DiagramCanvasWidget('diagram-canvas'));
       registry.register(new ImagePanelWidget('image-panel'));
       registry.register(new ScreenWidget('screen'));
       return registry;
     }
     ```
4. H2: "Auto-Registration of DSL Handlers"
   - Explain that `import '@brewsite/diagram'` auto-registers DSL node handlers via `./register.ts`
   - The widget instances (above) are still required for runtime rendering
5. H2: "Icon Assets (Optional)"
   - `Callout type="note"`: "If you want icon-shape nodes (AWS, GCP, Azure, Heroicons), run `pnpm sync:icons` from the monorepo root after install."
   - `CodeBlock` (bash): `pnpm sync:icons`
   - Explanation of what the script does and where it puts files
6. H2: "HDR Environment Map"
   - The diagram package includes an HDR env map at `packages/diagram/public/assets/envmaps/`
   - Vite alias setup needed so the env map is served correctly — shown in code
   - Note: `neonCyberTheme` and `darkGlassTheme` reference this env map for realistic reflections
7. H2: "ScenePlayer Integration"
   - Full `<ScenePlayer>` setup code with the diagram registry
8. `Callout type="tip"`: "Because `@brewsite/diagram` imports from `@brewsite/core`, ensure both packages resolve to the same React and Three.js instances — use the `dedupe` option in Vite if needed."

---

### 5.3 `DiagramOverview.tsx`

**Route**: `/diagram/overview`

**Content**:
1. H1: "Diagram Element"
2. Overview: `<Diagram>` contains `<DiagramNode>`, `<DiagramEdge>`, `<DiagramGroup>`, and a layout component
3. Architecture box:
   ```
   <Diagram>
     <GridLayout />       ← layout strategy
     <DiagramNode />      ← nodes
     <DiagramEdge />      ← edges between nodes
     <DiagramGroup>       ← groups (contain nodes)
       <DiagramNode />
     </DiagramGroup>
     <Enter />            ← entry animation config
     <Exit />             ← exit animation config
   </Diagram>
   ```
4. `LiveDemo` embedding `BasicDiagramDemo`
5. H2: "`<Diagram>` Props"
   - `PropTable`: id, theme, orientation, pivot
6. H2: "Themes"
   - Brief overview with link to Themes page
7. H2: "Orientation"
   - `DiagramOrientation`: `'horizontal'`, `'vertical'`, `'flat'`

---

### 5.4 `DiagramNodes.tsx`

**Route**: `/diagram/nodes`

**Content**:
1. H1: "Nodes"
2. `LiveDemo` embedding `DiagramNodesDemo` (showing shape variants)
3. H2: "`<DiagramNode>` Props"
   - Full `PropTable` for `DiagramNodeDSL`:
     - `id` (required) — unique node identifier
     - `label` — display text
     - `shape` — `DiagramNodeShape` type
     - `sublabel` — secondary text below label
     - `icon` — `DiagramIconVariant`
     - `color` — node accent color
     - `opacity` — node opacity [0,1]
     - `enabled` — visibility
     - `emissive` — boolean: glow effect
     - `emissiveColor` — CSS color
     - `emissiveIntensity` — [0, 5]
     - `hoverControls` — `DiagramHoverControls`
4. H2: "Node Shapes"
   - Visual gallery showing each `DiagramNodeShape` value
   - Table: shape name, description
   - Available values: `'pill'`, `'hex'`, `'circle'`, `'diamond'`, `'rectangle'`, plus icon shapes
5. H2: "Icon Variants"
   - `DiagramIconVariant` — Heroicon name, AWS/GCP/Azure/Network shape names
   - `Callout type="note"`: "Icon shapes require running `pnpm sync:icons` to download and register icon SVGs into the diagram package. This is a one-time setup step."
   - H3: "Running the Icon Sync"
     - `CodeBlock` (bash):
       ```bash
       # From the monorepo root — downloads Heroicons + Simple Icons SVGs
       pnpm sync:icons
       ```
     - Explanation: `scripts/sync-icons.mjs` downloads the latest Heroicons and cloud provider icons (AWS, GCP, Azure, Network) into `packages/diagram/public/assets/shapes/`. Without running this, icon shapes fall back to a generic placeholder.
     - `Callout type="tip"`: "Commit the generated icon files to your repo. The `sync:icons` script only needs to be re-run when you want to update icon versions."
   - Table of available `DiagramIconVariant` categories: Heroicons UI (`ui:*`), AWS (`aws:*`), GCP (`gcp:*`), Azure (`azure:*`), Network (`network:*`)
   - Link to the `sync:icons` script source in the repo
6. H2: "Emissive (Glow) Effect"
   - `emissive`, `emissiveColor`, `emissiveIntensity` props
   - `CodeBlock` showing glowing node setup
7. H2: "Hover Interactions"
   - `DiagramHoverControls` type
   - `onHover`, `onLeave` handler types
   - Usage example

---

### 5.5 `DiagramEdges.tsx`

**Route**: `/diagram/edges`

**Content**:
1. H1: "Edges"
2. `LiveDemo` embedding `DiagramEdgesDemo`
3. H2: "`<DiagramEdge>` Props"
   - Full `PropTable` for `DiagramEdgeDSL`:
     - `from` (required) — source node id
     - `to` (required) — target node id
     - `id` — optional explicit edge ID
     - `style` — `DiagramEdgeStyle`: `'straight'`, `'curved'`, `'orthogonal'`
     - `arrowVariant` — `DiagramArrowVariant`: `'none'`, `'arrow'`, `'openArrow'`, `'dot'`
     - `flow` — `DiagramEdgeFlow`: animated flow effect
     - `color` — edge color
     - `opacity` — edge opacity
     - `enabled` — visibility
     - `fromPort` / `toPort` — `DiagramEdgePort` for anchor control
4. H2: "Edge Styles"
   - `'straight'`, `'curved'`, `'orthogonal'` visual comparison
5. H2: "Arrow Variants"
   - Visual table of arrow types
6. H2: "Animated Flow"
   - `flow` prop: speed, direction
   - Use case: shows data flow direction
7. H2: "Edge Routing Algorithms"
   - `EdgeRoutingAlgorithm` type reference
   - How routing interacts with layout

---

### 5.6 `DiagramGroups.tsx`

**Route**: `/diagram/groups`

**Content**:
1. H1: "Groups"
2. `LiveDemo` embedding `DiagramGroupsDemo`
3. H2: "`<DiagramGroup>` Props"
   - Full `PropTable` for `DiagramGroupDSL`:
     - `id` (required)
     - `label`
     - `variant` — `DiagramGroupVariant`: `'frame'`, `'region'`, `'cloud'`
     - `color`
     - `opacity`
     - `enabled`
     - `edgeLights` — edge lighting config object
       - `density`, `color`, `intensity`, `distance`, `decay`
4. H2: "Group Variants"
   - `'frame'` — solid border enclosing child nodes
   - `'region'` — subtle background fill
   - `'cloud'` — rounded cloud shape
5. H2: "Edge Lighting"
   - `edgeLights` prop creates dynamic point lights at group edges
   - Use case: highlighting active clusters
   - `CodeBlock` example
6. H2: "Nesting Groups"
   - Groups can contain other groups
   - Note on layout behavior with nested groups

---

### 5.7 `DiagramLayouts.tsx`

**Route**: `/diagram/layouts`

**Content**:
1. H1: "Layouts"
2. H2: "GridLayout"
   - `LiveDemo` embedding `GridLayoutDemo`
   - `PropTable` for `GridLayoutProps`: columns, gap, padding, alignment
3. H2: "HierarchicalLayout"
   - `LiveDemo` embedding `HierarchicalLayoutDemo`
   - `PropTable` for `HierarchicalLayoutProps`: direction, levelGap, nodeGap
   - Note: edges define parent → child relationships
4. H2: "ManualLayout"
   - `LiveDemo` embedding `ManualLayoutDemo`
   - Nodes must specify `position: [x, y]`
   - `PropTable` for `ManualLayoutProps`
5. H2: "Layout and Scene Transitions"
   - When layouts change across scenes, nodes animate to new positions
   - `CodeBlock` showing a layout change in a multi-scene sequence

---

### 5.8 `DiagramAnimations.tsx`

**Route**: `/diagram/animations`

**Content**:
1. H1: "Enter & Exit Animations"
2. `LiveDemo` embedding `DiagramAnimationsDemo`
3. H2: "`<Enter>` Props"
   - `PropTable` for `EnterProps`: duration, easing, stagger, offset
4. H2: "`<Exit>` Props"
   - `PropTable` for `ExitProps`: duration, easing, stagger
5. H2: "Stagger"
   - `stagger` prop animates nodes one-by-one
   - Code example with `stagger={0.08}` (each node delays 80ms)
6. H2: "Per-Node Overrides"
   - `DiagramNode` can override `Enter`/`Exit` timing via `enterConfig`/`exitConfig` props
7. H2: "Easing Values"
   - `DiagramEasing` type reference

---

### 5.9 `DiagramCanvasPage.tsx`

**Route**: `/diagram/canvas`

**Content**:
1. H1: "DiagramCanvas"
2. Overview: `DiagramCanvas` is a nested element that renders a diagram in an orthographic 3D viewport embedded within the main scene
3. Architecture: `<DiagramCanvas>` → `<DiagramPipe>` → `<Diagram>` hierarchy
4. `LiveDemo` embedding `DiagramCanvasDemo` (interactive — user can orbit)
5. H2: "`<DiagramCanvas>` Props"
   - `PropTable` for `DiagramCanvasDSL`:
     - `id` (required)
     - `position` — Vec3
     - `rotation` — Vec3
     - `scale` — number
     - `opacity`
     - `enabled`
6. H2: "`<DiagramPipe>` Props"
   - `PropTable` for `DiagramPipeDSL`:
     - `id` (required)
     - Width/height configuration
7. H2: "Camera Integration"
   - Use `InputController` + `Action` DSL to enable orbit/dolly on the canvas
   - `CodeBlock` showing full `<InputController>` setup for diagram canvas
   - `canvas.focus` action for click-to-focus
8. H2: "Combining with Main Scene Camera"
   - The `<DiagramCanvas>` has its own orthographic camera
   - The main scene `<Camera>` and the canvas camera are independent
   - `Callout type="note"`: "Use `scope='canvas'` on `<InputController>` to scope input to the canvas only."

---

### 5.10 `DiagramFocusRegion.tsx`

**Route**: `/diagram/focus-region`

**Content**:
1. H1: "Focus Regions"
2. Overview: the `useDiagramFocusRegion` hook lets React components subscribe to which diagram element the camera is currently focused on
3. `LiveDemo` embedding `DiagramFocusDemo` (shows current focus node ID in a React overlay)
4. H2: "`useDiagramFocusRegion`"
   ```tsx
   import { useDiagramFocusRegion } from '@brewsite/diagram';

   function FocusIndicator() {
     const focus = useDiagramFocusRegion('diagram-canvas');
     if (!focus) return null;
     return <div>Focused: {focus.nodeId ?? 'none'}</div>;
   }
   ```
5. H2: "API Reference"
   - `getDiagramFocusRegion(canvasId)` — imperative read
   - `clearDiagramFocusRegion(canvasId)` — reset focus
   - `DIAGRAM_FOCUS_REGION_EVENT` — custom event dispatched on focus change
   - `UseDiagramFocusRegionOptions` type
   - `DiagramFocusRegionKind` — `'node'`, `'group'`, `'canvas'`
   - `DiagramFocusRegionState` — `{ kind, nodeId?, groupId?, center? }`
6. H2: "Integration Pattern"
   - Full code showing canvas + focus indicator + `canvas.focus` action

---

### 5.11 `DiagramThemes.tsx`

**Route**: `/diagram/themes`

**Content**:
1. H1: "Built-in Themes"
2. H2: "`darkGlassTheme`"
   - `LiveDemo` embedding `DiagramThemeDarkDemo`
   - Description: dark glassmorphism, frosted glass nodes, environmental reflections
3. H2: "`neonCyberTheme`"
   - `LiveDemo` embedding `DiagramThemeNeonDemo`
   - Description: neon glows, cyberpunk palette, emissive edges
4. H2: "`enterpriseTheme`"
   - `LiveDemo` embedding `DiagramThemeEnterpriseDemo`
   - Description: clean corporate, flat nodes, minimal chrome
5. H2: "`lightMinimalTheme`"
   - `LiveDemo` embedding `DiagramThemeLightDemo`
   - Description: light background, dark text, clean minimal
6. H2: "How to Apply a Theme"
   - `<Diagram id="..." theme={darkGlassTheme}>`
   - `CodeBlock`

---

### 5.12 `DiagramCustomThemes.tsx`

**Route**: `/diagram/custom-themes`

**Content**:
1. H1: "Custom Themes"
2. Overview of `DiagramTheme` as the full theme object type
3. H2: "`DiagramTheme` Structure"
   - `DiagramThemeRenderConfig` — renderer settings (env map, tone mapping)
   - `DiagramThemeNodeConfig` — node material properties
   - `DiagramThemeEdgeConfig` — edge material properties
   - `DiagramThemeGroupConfig` — group material properties
   - `DiagramThemeEnvironmentConfig` — HDR env map reference
   - `DiagramThemeLayoutConfig` — spacing defaults
4. H2: "Creating a Custom Theme"
   - `CodeBlock` showing a minimal theme based on `darkGlassTheme` with overrides:
     ```tsx
     import { darkGlassTheme } from '@brewsite/diagram';

     export const myTheme: DiagramTheme = {
       ...darkGlassTheme,
       node: {
         ...darkGlassTheme.node,
         baseColor: '#1a2040',
         borderColor: '#4d9fff',
         borderOpacity: 0.9,
       },
       edge: {
         ...darkGlassTheme.edge,
         color: '#4d9fff',
       },
     };
     ```
5. H2: "Full `DiagramTheme` Type Reference"
   - All nested types listed with their fields and types

---

### 5.13 `DiagramImagePanel.tsx`

**Route**: `/diagram/image-panel`

**Content**:
1. H1: "ImagePanel"
2. Overview: 3D image panel element with bezel, gloss overlay, and optional glow
3. `LiveDemo` embedding `ImagePanelDemo`
4. H2: "`<ImagePanel>` Props"
   - Full `PropTable` for `ImagePanelDSL`:
     - `id` (required)
     - `src` (required) — URL or data URI for the texture
     - `bezel` — `ImagePanelBezelVariant`: `'none'`, `'thin'`, `'thick'`, `'display'`
     - `width`, `height` — world unit dimensions
     - `position` — Vec3
     - `rotation` — Vec3
     - `opacity`
     - `gloss` — boolean, adds glass sheen overlay
     - `glow` — boolean, adds edge glow sprite
     - `enabled`
5. H2: "Bezel Variants"
   - Visual comparison table of `'none'`, `'thin'`, `'thick'`, `'display'`
6. H2: "Integration Pattern"
   - Full scene code with image panel + camera positioned to frame it

---

### 5.14 `DiagramScreen.tsx`

**Route**: `/diagram/screen`

**Content**:
1. H1: "Screen"
2. Overview: 3D screen element — similar to ImagePanel but with a monitor/display bezel
3. `LiveDemo` embedding `ScreenDemo`
4. H2: "`<Screen>` Props"
   - `PropTable` for `ScreenDSL`:
     - `id` (required)
     - `src` — texture URL
     - `bezel` — `ScreenBezelVariant`
     - `width`, `height`
     - `position`, `rotation`
     - `opacity`, `enabled`
5. H2: "Screen vs ImagePanel"
   - When to use each
   - Screen has display-specific bezel geometry; ImagePanel is a flat panel

---

### 5.15 `DiagramWidgetSetup.tsx`

**Route**: `/diagram/widget-setup`

**Content**:
1. H1: "Widget Integration"
2. Overview: how diagram widgets fit into the `WidgetRegistry` pattern from `@brewsite/core`
3. H2: "Complete Setup Pattern"
   - Full `CodeBlock` showing widgetSetup function with all four diagram widgets registered
   - Shows how to pass to `<ScenePlayer widgetRegistry={...}>`
4. H2: "Individual Widget IDs"
   - Table: Widget class → default widgetId → matches DSL `id` prop
   - `DiagramWidget` → matches `<Diagram id="...">`
   - `DiagramCanvasWidget` → matches `<DiagramCanvas id="...">`
   - `ImagePanelWidget` → matches `<ImagePanel id="...">`
   - `ScreenWidget` → matches `<Screen id="...">`
5. H2: "Multiple Diagram Instances"
   - Code showing two `DiagramWidget` instances for two `<Diagram>` elements in the same scene
6. H2: "DSL Handler Auto-Registration"
   - Explain the `import '@brewsite/diagram'` side-effect
   - When it matters (SSR, manual imports)
7. `Callout type="warning"`: "Widget `id` props in DSL must exactly match the `widgetId` passed to widget constructors."

---

### 5.16 `DiagramTypes.tsx`

**Route**: `/diagram/types`

**Content**:
Full TypeScript type reference for all exported types from `@brewsite/diagram`, organized alphabetically.

**Type groups**:

1. **State Types**: `DiagramState`, `DiagramNodeState`, `DiagramEdgeState`, `DiagramGroupState`, `DiagramCanvasState`, `DiagramPipeState`, `ImagePanelState`, `ScreenState`

2. **DSL Types**: `DiagramDSL`, `DiagramNodeDSL`, `DiagramEdgeDSL`, `DiagramGroupDSL`, `DiagramCanvasDSL`, `DiagramPipeDSL`, `ImagePanelDSL`, `ScreenDSL`

3. **Layout Types**: `LayoutDSL`, `LayoutPadding`, `LayoutAlignment`, `LayoutDisconnected`, `GridLayoutProps`, `HierarchicalLayoutProps`, `ManualLayoutProps`

4. **Theme Types**: `DiagramTheme`, `DiagramThemeRenderConfig`, `DiagramThemeNodeConfig`, `DiagramThemeEdgeConfig`, `DiagramThemeGroupConfig`, `DiagramThemeEnvironmentConfig`, `DiagramThemeLayoutConfig`

5. **Animation Types**: `DiagramEnterConfig`, `DiagramExitConfig`, `DiagramEnterDSL`, `DiagramExitDSL`, `DiagramEasing`

6. **Interaction Types**: `DiagramInteractionEvent`, `DiagramHoverControls`, `DiagramHoverEventBase`, `DiagramNodeHoverEvent`, `DiagramGroupHoverEvent`, `DiagramNodeMouseHandler`, `DiagramGroupMouseHandler`

7. **Edge/Routing Types**: `DiagramEdgeStyle`, `DiagramArrowVariant`, `DiagramEdgeFlow`, `DiagramEdgePort`, `EdgeRoutingAlgorithm`, `EdgeLandingAlgorithm`

8. **Shape Types**: `DiagramNodeShape`, `DiagramIconVariant`, `SvgIcon3DStyle`, `FlowIconShape`, `AwsShape`, `GcpShape`, `AzureShape`, `NetworkShape`

9. **Canvas/Focus Types**: `DiagramFocusRegionKind`, `DiagramFocusRegionState`, `UseDiagramFocusRegionOptions`

10. **Other**: `DiagramOrientation`, `DiagramPivot`

For each type, show the TypeScript definition and a one-line description.

---

## 6. Demo Architecture Notes for Diagram

### 6.1 Camera Configuration for Diagram Demos

All diagram demos use a consistent camera setup that frames the diagram well:

```tsx
// Standard diagram demo camera — frames a ~8-unit wide diagram at 45° angle
<Camera
  descriptor={{
    mode: 'world',
    position: [0, 6, 10],
    target: [0, 0, 0],
  }}
  lens={{ fov: 45 }}
/>
```

For larger diagrams (6+ nodes), adjust to `position: [0, 8, 14]`.

For DiagramCanvas demos, use the orthographic camera managed by `DiagramCanvas` itself.

### 6.2 Lighting for Diagram Demos

All diagram demos use this consistent lighting:

```tsx
<Lighting
  ambient={{ color: '#ffffff', intensity: 0.3 }}
  directional={{ color: '#aaddff', intensity: 0.8, position: [5, 10, 5] }}
/>
```

### 6.3 Background for Diagram Demos

Dark backgrounds are used for all dark-theme demos:

```tsx
<Background color="#07070e" />
```

Light-theme demos use:

```tsx
<Background color="#f0f0f8" />
```

### 6.4 Handling `DiagramWidget` Constructor Arguments

The `DiagramWidget` constructor signature must be verified against the source. The expected pattern based on the index.ts export:

```typescript
// Likely constructor signature (verify against packages/diagram/src/elements/diagram/widget.ts)
new DiagramWidget(widgetId: string)
```

If the constructor requires additional arguments (theme, renderer config), wrap in a factory:

```typescript
const createDiagramRegistry = () => {
  const registry = createDefaultWidgetRegistry(null);
  const diagramWidget = new DiagramWidget('diagram');  // or with options
  registry.register(diagramWidget);
  return registry;
};
```

---

## 7. Public Assets for Diagram Demos

Create these assets in `apps/docs/public/assets/docs/`:

1. **`sample-image.jpg`** — 512×341px abstract gradient image for `ImagePanel` demos
2. **`sample-screen.png`** — 512×288px (16:9) screenshot-style image for `Screen` demos

These should be small (< 20KB each), self-contained, and not require external licenses.

The diagram HDR environment map is expected at `packages/diagram/public/assets/envmaps/`. Reference it from the docs vite config as a static asset via the `publicDir` pointing to both locations, or copy it to `apps/docs/public/` as part of the build.

---

## 8. Implementation Order

1. **Phase 1**: Add `diagram-nav.ts` and diagram routes to `App.tsx`
2. **Phase 2**: Create `diagramDemoSetup.ts` in `demos/shared/`
3. **Phase 3**: Implement demo files (start with `BasicDiagram.demo.tsx`, then nodes, edges, groups)
4. **Phase 4**: Implement theme demo files (all 4 themes)
5. **Phase 5**: Implement layout demo files (grid, hierarchical, manual)
6. **Phase 6**: Implement DiagramCanvas demo (most complex — requires `EngineInputRegion` integration)
7. **Phase 7**: Implement Focus Region demo
8. **Phase 8**: Implement ImagePanel and Screen demos
9. **Phase 9**: Implement Animations demo
10. **Phase 10**: Write all doc pages in order: GettingStarted → Setup → Overview → Nodes → Edges → Groups → Layouts → Animations → Canvas → Focus → Themes → CustomThemes → ImagePanel → Screen → WidgetSetup → Types

---

## 9. Testing Strategy

Same as core docs: TypeScript typecheck + build validation + manual visual review. Additionally:

- **Interaction demos**: manually verify orbit drag works in `DiagramCanvasDemo`
- **Focus demo**: verify `useDiagramFocusRegion` updates when clicking nodes
- **Theme demos**: verify all 4 themes render distinctly
- **Widget ID alignment**: verify `widgetId` in registry constructor matches `id` prop in DSL — any mismatch produces a runtime error visible in browser console

---

## 10. Design Notes

- **Demo first, prose second**: Diagram demos are more visually dramatic than core demos. The demo should appear before the prose explanation on diagram pages to lead with impact.
- **Interactive demos**: The `DiagramCanvas` page should encourage interaction. Add a prominent "Try dragging to orbit" hint overlay in the demo.
- **Theme comparison**: The themes page should allow the user to switch between all 4 themes on the same diagram in a tab interface. This requires a `DemoTabs` component that re-mounts the demo with a different registry/theme prop.
