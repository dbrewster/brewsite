---
title: "Architecture Diagram Scenes — apps/examples"
doc_type: plan
owner: brewsite-architect
status: active
updated: 2026-03-03
---

# Architecture Diagram Scenes — apps/examples

## Overview

This plan specifies four animated 3D diagram scenes — one per BrewSite package (`@brewsite/core`,
`@brewsite/diagram`, `@brewsite/model`, `@brewsite/charts`) — to live in
`apps/examples/src/architecture/`. Each scene uses `DiagramCanvas` DSL to tell the story of what
the package **enables developers to build**, not how it works internally. Copy leads with the output
and the experience; mechanism and implementation details belong in docs, not on screen.

All scenes use `darkGlassTheme` for visual consistency. All scenes use manual camera control
(`mode="world"`) with `ProgressManager` auto-advance. All overlay animations use `MidFade` and
`ScrollOn` from `@brewsite/core/hud/animejs`.

---

## App Scaffold

### File Inventory

```
apps/examples/src/
  App.tsx                              ← UPDATE: add /architecture route
  architecture/
    ArchitecturePage.tsx               ← NEW: page component
    widgetSetup.ts                     ← NEW: plugin setup
    flow.tsx                           ← NEW: scene array
    scenes/
      scene_core.tsx                   ← NEW: @brewsite/core scene
      scene_diagram.tsx                ← NEW: @brewsite/diagram scene
      scene_model.tsx                  ← NEW: @brewsite/model scene
      scene_charts.tsx                 ← NEW: @brewsite/charts scene
```

---

### `apps/examples/src/App.tsx` — Update

Add a lazy-loaded route for `/architecture`. The existing `/chart` route is unchanged.

```tsx
import type { JSX } from 'react';
import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router';

const ChartDemoPage = lazy(() => import('./chart/ChartDemoPage'));
const ArchitecturePage = lazy(() => import('./architecture/ArchitecturePage'));

function Loading(): JSX.Element {
  return <div style={{ padding: '2rem' }}>Loading example...</div>;
}

export default function ExamplesApp(): JSX.Element {
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route path="/chart" element={<ChartDemoPage />} />
        <Route path="/architecture" element={<ArchitecturePage />} />
        <Route
          path="/"
          element={
            <div style={{ padding: '2rem', fontFamily: 'system-ui' }}>
              <h1>BrewSite Examples</h1>
              <ul>
                <li><a href="/examples/chart">Chart Demo</a></li>
                <li><a href="/examples/architecture">Package Architecture</a></li>
              </ul>
            </div>
          }
        />
      </Routes>
    </Suspense>
  );
}
```

---

### `apps/examples/src/architecture/ArchitecturePage.tsx`

```tsx
import { useMemo } from 'react';
import type { JSX } from 'react';
import {
  EngineProvider,
  EngineInputRegion,
  SceneCanvas,
} from '@brewsite/core';
import { createArchitecturePlugins } from './widgetSetup';
import { architectureFlowScenes } from './flow';

const MANIFEST_URL = '/scene-manifest.json';

export default function ArchitecturePage(): JSX.Element {
  const { plugins } = useMemo(() => createArchitecturePlugins(), []);

  return (
    <EngineProvider manifestUrl={MANIFEST_URL} plugins={plugins}>
      {architectureFlowScenes}
      <EngineInputRegion>
        <SceneCanvas />
      </EngineInputRegion>
    </EngineProvider>
  );
}
```

---

### `apps/examples/src/architecture/widgetSetup.ts`

No GLTF models are used in these scenes. Only `corePlugin` and `diagramPlugin` are needed.
The four `DiagramCanvas` IDs are declared explicitly so the compiler emits `MISSING_WIDGET`
warnings if a canvas id in the DSL does not match.

```typescript
import { corePlugin } from '@brewsite/core';
import { diagramPlugin } from '@brewsite/diagram';
import type { WidgetPlugin } from '@brewsite/core';

/**
 * Creates the WidgetPlugin array for the architecture diagram scenes.
 * No GLTF models — only core engine + diagram canvas.
 */
export function createArchitecturePlugins(): { plugins: WidgetPlugin[] } {
  return {
    plugins: [
      corePlugin(),
      diagramPlugin({
        canvases: [
          'arch-core-canvas',
          'arch-diagram-canvas',
          'arch-model-canvas',
          'arch-charts-canvas',
        ],
      }),
    ],
  };
}
```

---

### `apps/examples/src/architecture/flow.tsx`

```tsx
import { Fragment } from 'react';
import type { JSX } from 'react';
import { sceneCoreArch } from './scenes/scene_core';
import { sceneDiagramArch } from './scenes/scene_diagram';
import { sceneModelArch } from './scenes/scene_model';
import { sceneChartsArch } from './scenes/scene_charts';

export const architectureFlowScenes: JSX.Element[] = [
  <Fragment key="arch-core">{sceneCoreArch}</Fragment>,
  <Fragment key="arch-diagram">{sceneDiagramArch}</Fragment>,
  <Fragment key="arch-model">{sceneModelArch}</Fragment>,
  <Fragment key="arch-charts">{sceneChartsArch}</Fragment>,
];
```

---

## Shared Constants

Define these once per scene file (each file is standalone):

```typescript
const LATE_FADE = {
  exit: [1.0, 1.0] as [number, number],
  enter: [1.0, 1.0] as [number, number],
};
```

---

## Scene 1: @brewsite/core

### Narrative

This scene answers: **"What is @brewsite/core and what does writing a scene actually look like?"**
It shows the authoring surface (the DSL components an author writes) flowing into the engine
(EngineProvider + SceneCanvas) and producing the output capabilities users experience. The story
is "write JSX → ship cinema." No internals, no compiler pipeline, no runtime architecture.

### File path

`apps/examples/src/architecture/scenes/scene_core.tsx`

### Scene DSL: Complete Implementation

```tsx
import type { JSX } from 'react';
import {
  Scene,
  Camera,
  Lighting,
  Ambient,
  Directional,
  ProgressManager,
} from '@brewsite/core';
import {
  DiagramCanvas,
  Diagram,
  DiagramNode,
  DiagramEdge,
  DiagramGroup,
  ManualLayout,
  darkGlassTheme,
} from '@brewsite/diagram';
import { MidFade, ScrollOn } from '@brewsite/core/hud/animejs';

const LATE_FADE = {
  exit: [1.0, 1.0] as [number, number],
  enter: [1.0, 1.0] as [number, number],
};

export const sceneCoreArch: JSX.Element = (
  <Scene id="arch-core" transition={LATE_FADE}>
    <ProgressManager
      scrollUnits={1800}
      autoAdvance={{ duration: 9, max: 0.88, pauseOnScroll: true }}
    />
    <Camera
      mode="world"
      position={[0, 5, 50]}
      target={[0, -1, 0]}
      fov={52}
    />
    <Lighting intensityScale={1}>
      <Ambient intensity={1.0} color="#ffffff" />
      <Directional intensity={0.6} color="#aaccff" position={[0, 20, 30]} />
      <Directional intensity={0.3} color="#6677ff" position={[-15, 5, 10]} />
    </Lighting>

    <DiagramCanvas
      id="arch-core-canvas"
      rotation={[-Math.PI / 10, 0, 0]}
      scale={1.15}
      theme={darkGlassTheme}
    >
      <Diagram id="core-arch" pivot="center">
        <ManualLayout />

        {/* ── LEFT COLUMN: What you write ── */}
        <DiagramGroup id="dsl-group" label="What You Write" variant="boundary">
          <DiagramNode
            id="scene-comp"
            label="<Scene>"
            sublabel="declare a visual stop"
            icon="ui:document-text"
            position={[-10.5, 5, 0]}
            size={[4.5, 2.2]}
          />
          <DiagramNode
            id="camera-comp"
            label="<Camera>"
            sublabel="position · mode · fov"
            icon="ui:camera"
            position={[-10.5, 1.5, 0]}
            size={[4.5, 2.2]}
          />
          <DiagramNode
            id="lighting-comp"
            label="<Lighting>"
            sublabel="ambient · directional"
            icon="ui:sun"
            position={[-10.5, -2, 0]}
            size={[4.5, 2.2]}
          />
          <DiagramNode
            id="bg-comp"
            label="<Background>"
            sublabel="color · gradient"
            icon="ui:swatch"
            position={[-10.5, -5.5, 0]}
            size={[4.5, 2.2]}
          />
        </DiagramGroup>

        {/* ── CENTER: The engine ── */}
        <DiagramGroup id="engine-group" label="Engine" variant="cluster">
          <DiagramNode
            id="engine-prov"
            label="EngineProvider"
            sublabel="one component"
            icon="ui:squares-plus"
            position={[0, 3.5, 0]}
            size={[5.5, 2.5]}
          />
          <DiagramNode
            id="scene-canvas"
            label="SceneCanvas"
            sublabel="WebGL output"
            icon="ui:photo"
            position={[0, -0.5, 0]}
            size={[5.5, 2.5]}
          />
          <DiagramNode
            id="progress-comp"
            label="ProgressManager"
            sublabel="scroll · time · auto"
            icon="ui:adjustments-horizontal"
            position={[0, -4.5, 0]}
            size={[5.5, 2.5]}
          />
        </DiagramGroup>

        {/* ── RIGHT COLUMN: What users experience ── */}
        <DiagramGroup id="output-group" label="What Users Experience" variant="boundary">
          <DiagramNode
            id="scroll-out"
            label="Scroll-Driven"
            sublabel="any scroll source"
            icon="ui:cursor-arrow-rays"
            position={[10.5, 5, 0]}
            size={[4.5, 2.2]}
          />
          <DiagramNode
            id="auto-out"
            label="Auto-Advance"
            sublabel="timed sequences"
            icon="ui:play-circle"
            position={[10.5, 1.5, 0]}
            size={[4.5, 2.2]}
          />
          <DiagramNode
            id="hud-out"
            label="HUD Overlays"
            sublabel="React on WebGL"
            icon="ui:chat-bubble-left-right"
            position={[10.5, -2, 0]}
            size={[4.5, 2.2]}
          />
          <DiagramNode
            id="ssr-out"
            label="SSR Safe"
            sublabel="Next.js · Vite · any React"
            icon="ui:check-circle"
            position={[10.5, -5.5, 0]}
            size={[4.5, 2.2]}
          />
        </DiagramGroup>

        {/* Left → Center edges */}
        <DiagramEdge from="scene-comp" to="engine-prov" flow="forward" />
        <DiagramEdge from="camera-comp" to="engine-prov" flow="forward" />
        <DiagramEdge from="lighting-comp" to="engine-prov" flow="forward" />
        <DiagramEdge from="bg-comp" to="engine-prov" flow="forward" />

        {/* Center internal */}
        <DiagramEdge from="engine-prov" to="scene-canvas" flow="forward" />
        <DiagramEdge from="engine-prov" to="progress-comp" flow="forward" style="dashed" />

        {/* Center → Right edges */}
        <DiagramEdge from="scene-canvas" to="scroll-out" flow="forward" />
        <DiagramEdge from="scene-canvas" to="auto-out" flow="forward" />
        <DiagramEdge from="scene-canvas" to="hud-out" flow="forward" />
        <DiagramEdge from="scene-canvas" to="ssr-out" flow="forward" />
        <DiagramEdge from="progress-comp" to="scroll-out" style="dashed" arrowEnd="open" />
        <DiagramEdge from="progress-comp" to="auto-out" style="dashed" arrowEnd="open" />
      </Diagram>
    </DiagramCanvas>

    {/* Overlay */}
    <div style={{
      position: 'absolute',
      bottom: '10%',
      left: '5%',
      maxWidth: 380,
    }}>
      <MidFade duration={1200}>
        <div style={{
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 10,
          letterSpacing: '0.3em',
          textTransform: 'uppercase' as const,
          color: 'rgba(130, 100, 255, 0.8)',
          marginBottom: 10,
        }}>
          @brewsite/core
        </div>
        <div style={{
          fontSize: 'clamp(20px, 3vw, 26px)',
          fontWeight: 600,
          color: '#f0f6fc',
          lineHeight: 1.2,
          marginBottom: 14,
        }}>
          Author in JSX.<br />Ship to any surface.
        </div>
      </MidFade>
      <ScrollOn duration={900} delay={150}>
        <div style={{
          fontSize: 'clamp(13px, 1.6vw, 14px)',
          color: 'rgba(240, 246, 252, 0.6)',
          lineHeight: 1.65,
        }}>
          Declare scenes, cameras, and lighting in JSX.
          Scroll, drag, or auto-advance through them.
          Drop into Next.js, Vite, or any React app with a single component.
        </div>
      </ScrollOn>
    </div>
  </Scene>
);
```

---

## Scene 2: @brewsite/diagram

### Narrative

This scene shows a **software delivery pipeline** — a CI/CD flow from commit to production. The
goal is to demonstrate what `@brewsite/diagram` lets you BUILD: a complex, grouped, animated 3D
diagram authored entirely in JSX. The diagram IS the demo. Copy simply says "From whiteboard to
3D." No DSL explanation, no compiler talk.

The scene uses `HierarchicalLayout` (left-right direction) to visually emphasize the pipeline
flow. Group swimlanes separate the stages.

### File path

`apps/examples/src/architecture/scenes/scene_diagram.tsx`

### Scene DSL: Complete Implementation

```tsx
import type { JSX } from 'react';
import {
  Scene,
  Camera,
  Lighting,
  Ambient,
  Directional,
  ProgressManager,
} from '@brewsite/core';
import {
  DiagramCanvas,
  Diagram,
  DiagramNode,
  DiagramEdge,
  DiagramGroup,
  HierarchicalLayout,
  GridLayout,
  darkGlassTheme,
} from '@brewsite/diagram';
import { MidFade, ScrollOn } from '@brewsite/core/hud/animejs';

const LATE_FADE = {
  exit: [1.0, 1.0] as [number, number],
  enter: [1.0, 1.0] as [number, number],
};

export const sceneDiagramArch: JSX.Element = (
  <Scene id="arch-diagram" transition={LATE_FADE}>
    <ProgressManager
      scrollUnits={1800}
      autoAdvance={{ duration: 9, max: 0.88, pauseOnScroll: true }}
    />
    <Camera
      mode="world"
      position={[0, 8, 52]}
      target={[0, 0, 0]}
      fov={50}
    />
    <Lighting intensityScale={1}>
      <Ambient intensity={1.1} color="#ffffff" />
      <Directional intensity={0.5} color="#aaccff" position={[0, 20, 30]} />
      <Directional intensity={0.4} color="#9966ff" position={[-20, 10, 10]} />
    </Lighting>

    <DiagramCanvas
      id="arch-diagram-canvas"
      rotation={[-Math.PI / 10, 0, 0]}
      scale={1.2}
      theme={darkGlassTheme}
    >
      <Diagram id="diagram-arch" pivot="center">
        <HierarchicalLayout direction="left-right" spacing={[5, 3]} />

        {/* Stage 1: Source */}
        <DiagramGroup id="source-group" label="Source" variant="boundary">
          <DiagramNode
            id="commit"
            label="Commit"
            sublabel="feature branch"
            icon="ui:code-bracket-square"
            size={[4.5, 2.2]}
          />
          <DiagramNode
            id="pr"
            label="Pull Request"
            sublabel="review + merge"
            icon="ui:document-text"
            size={[4.5, 2.2]}
          />
        </DiagramGroup>

        {/* Stage 2: Build */}
        <DiagramGroup id="build-group" label="Build" variant="boundary">
          <DiagramNode
            id="docker-build"
            label="Docker Build"
            sublabel="multi-stage"
            icon="tech:docker"
            size={[4.5, 2.2]}
          />
          <DiagramNode
            id="image-registry"
            label="Image Registry"
            sublabel="tagged artifact"
            icon="ui:archive-box"
            size={[4.5, 2.2]}
          />
        </DiagramGroup>

        {/* Stage 3: Test */}
        <DiagramGroup id="test-group" label="Test" variant="swimlane">
          <GridLayout columns={1} spacing={[3, 2.5]} />
          <DiagramNode
            id="unit-tests"
            label="Unit Tests"
            sublabel="fast · isolated"
            icon="ui:check-circle"
            size={[4.5, 2.2]}
          />
          <DiagramNode
            id="integration"
            label="Integration"
            sublabel="service contracts"
            icon="ui:link"
            size={[4.5, 2.2]}
          />
          <DiagramNode
            id="security-scan"
            label="Security Scan"
            sublabel="CVE check"
            icon="ui:shield-check"
            size={[4.5, 2.2]}
          />
        </DiagramGroup>

        {/* Stage 4: Deploy */}
        <DiagramGroup id="deploy-group" label="Deploy" variant="boundary">
          <DiagramNode
            id="staging"
            label="Staging"
            sublabel="smoke + e2e"
            icon="ui:server"
            size={[4.5, 2.2]}
          />
          <DiagramNode
            id="production"
            label="Production"
            sublabel="blue / green"
            icon="ui:rocket-launch"
            size={[4.5, 2.2]}
            color="#1a3d5c"
            glow={{ intensity: 0.25 }}
          />
        </DiagramGroup>

        {/* Pipeline flow edges */}
        <DiagramEdge from="commit" to="pr" flow="forward" />
        <DiagramEdge from="pr" to="docker-build" label="merge" flow="forward" />
        <DiagramEdge from="docker-build" to="image-registry" flow="forward" />
        <DiagramEdge from="image-registry" to="unit-tests" flow="forward" />
        <DiagramEdge from="unit-tests" to="integration" flow="forward" />
        <DiagramEdge from="integration" to="security-scan" flow="forward" />
        <DiagramEdge from="security-scan" to="staging" flow="forward" />
        <DiagramEdge from="staging" to="production" label="approved" flow="forward" />
      </Diagram>
    </DiagramCanvas>

    {/* Overlay */}
    <div style={{
      position: 'absolute',
      bottom: '10%',
      right: '5%',
      maxWidth: 360,
      textAlign: 'right',
    }}>
      <MidFade duration={1200}>
        <div style={{
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 10,
          letterSpacing: '0.3em',
          textTransform: 'uppercase' as const,
          color: 'rgba(130, 100, 255, 0.8)',
          marginBottom: 10,
        }}>
          @brewsite/diagram
        </div>
        <div style={{
          fontSize: 'clamp(20px, 3vw, 26px)',
          fontWeight: 600,
          color: '#f0f6fc',
          lineHeight: 1.2,
          marginBottom: 14,
        }}>
          From whiteboard<br />to 3D.
        </div>
      </MidFade>
      <ScrollOn duration={900} delay={150}>
        <div style={{
          fontSize: 'clamp(13px, 1.6vw, 14px)',
          color: 'rgba(240, 246, 252, 0.6)',
          lineHeight: 1.65,
        }}>
          Write this in JSX.
          Auto-layout, themes, and routing handle the visual complexity.
          Transitions between scenes animate automatically.
        </div>
      </ScrollOn>
    </div>
  </Scene>
);
```

---

## Scene 3: @brewsite/model

### Narrative

This scene answers: **"What does authoring a model sequence actually look like?"** It shows a
left column of what you declare in JSX (the authoring surface) and a right column of what the
engine delivers to users (smooth motion, animations, material control). A central `modelPlugin()`
node bridges the two sides. Copy: "Your 3D models, brought to life."

This is explicitly NOT showing GLTF internals, AnimationMixer, or bone traversal. It shows the
developer's authoring vocabulary and the experiential output.

### File path

`apps/examples/src/architecture/scenes/scene_model.tsx`

### Scene DSL: Complete Implementation

```tsx
import type { JSX } from 'react';
import {
  Scene,
  Camera,
  Lighting,
  Ambient,
  Directional,
  ProgressManager,
} from '@brewsite/core';
import {
  DiagramCanvas,
  Diagram,
  DiagramNode,
  DiagramEdge,
  DiagramGroup,
  ManualLayout,
  darkGlassTheme,
} from '@brewsite/diagram';
import { MidFade, ScrollOn } from '@brewsite/core/hud/animejs';

const LATE_FADE = {
  exit: [1.0, 1.0] as [number, number],
  enter: [1.0, 1.0] as [number, number],
};

export const sceneModelArch: JSX.Element = (
  <Scene id="arch-model" transition={LATE_FADE}>
    <ProgressManager
      scrollUnits={1800}
      autoAdvance={{ duration: 9, max: 0.88, pauseOnScroll: true }}
    />
    <Camera
      mode="world"
      position={[0, 4, 44]}
      target={[0, -0.5, 0]}
      fov={52}
    />
    <Lighting intensityScale={1}>
      <Ambient intensity={1.0} color="#ffffff" />
      <Directional intensity={0.5} color="#ffeecc" position={[10, 20, 20]} />
      <Directional intensity={0.4} color="#aaccff" position={[-10, 5, 20]} />
    </Lighting>

    <DiagramCanvas
      id="arch-model-canvas"
      rotation={[-Math.PI / 10, 0, 0]}
      scale={1.15}
      theme={darkGlassTheme}
    >
      <Diagram id="model-arch" pivot="center">
        <ManualLayout />

        {/* ── LEFT: What you declare ── */}
        <DiagramGroup id="declare-group" label="You Declare" variant="boundary">
          <DiagramNode
            id="model-tag"
            label="<Model id='robot'>"
            sublabel="declare once, reuse"
            icon="ui:cube"
            position={[-9, 5, 0]}
            size={[5.5, 2.2]}
          />
          <DiagramNode
            id="pos-prop"
            label="position=[5, 0, 2]"
            sublabel="per scene"
            icon="ui:arrows-pointing-out"
            position={[-9, 1.5, 0]}
            size={[5.5, 2.2]}
          />
          <DiagramNode
            id="clip-prop"
            label="clipName='Walk'"
            sublabel="animation clip"
            icon="ui:film"
            position={[-9, -2, 0]}
            size={[5.5, 2.2]}
          />
          <DiagramNode
            id="parts-prop"
            label="parts=[...]"
            sublabel="per-mesh overrides"
            icon="ui:paint-brush"
            position={[-9, -5.5, 0]}
            size={[5.5, 2.2]}
          />
        </DiagramGroup>

        {/* ── CENTER: The bridge ── */}
        <DiagramNode
          id="model-plugin"
          label="modelPlugin()"
          sublabel="one line of setup"
          icon="ui:puzzle-piece"
          position={[0, -0.5, 0]}
          size={[5.5, 2.8]}
          color="#1a3060"
          glow={{ intensity: 0.2 }}
        />

        {/* ── RIGHT: What users experience ── */}
        <DiagramGroup id="experience-group" label="Users Experience" variant="boundary">
          <DiagramNode
            id="gltf-loaded"
            label="GLTF Loaded"
            sublabel="async · cached"
            icon="ui:arrow-down-tray"
            position={[9, 5, 0]}
            size={[5.5, 2.2]}
          />
          <DiagramNode
            id="smooth-motion"
            label="Smooth Motion"
            sublabel="position · rotation · scale"
            icon="ui:play-circle"
            position={[9, 1.5, 0]}
            size={[5.5, 2.2]}
          />
          <DiagramNode
            id="anim-blend"
            label="Animation Blend"
            sublabel="crossfade between clips"
            icon="ui:musical-note"
            position={[9, -2, 0]}
            size={[5.5, 2.2]}
          />
          <DiagramNode
            id="material-ctrl"
            label="Material Control"
            sublabel="any mesh, any color"
            icon="ui:swatch"
            position={[9, -5.5, 0]}
            size={[5.5, 2.2]}
          />
        </DiagramGroup>

        {/* Left → center */}
        <DiagramEdge from="model-tag" to="model-plugin" flow="forward" />
        <DiagramEdge from="pos-prop" to="model-plugin" flow="forward" />
        <DiagramEdge from="clip-prop" to="model-plugin" flow="forward" />
        <DiagramEdge from="parts-prop" to="model-plugin" flow="forward" />

        {/* Center → right */}
        <DiagramEdge from="model-plugin" to="gltf-loaded" flow="forward" />
        <DiagramEdge from="model-plugin" to="smooth-motion" flow="forward" />
        <DiagramEdge from="model-plugin" to="anim-blend" flow="forward" />
        <DiagramEdge from="model-plugin" to="material-ctrl" flow="forward" />
      </Diagram>
    </DiagramCanvas>

    {/* Overlay */}
    <div style={{
      position: 'absolute',
      bottom: '10%',
      left: '5%',
      maxWidth: 380,
    }}>
      <MidFade duration={1200}>
        <div style={{
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 10,
          letterSpacing: '0.3em',
          textTransform: 'uppercase' as const,
          color: 'rgba(130, 100, 255, 0.8)',
          marginBottom: 10,
        }}>
          @brewsite/model
        </div>
        <div style={{
          fontSize: 'clamp(20px, 3vw, 26px)',
          fontWeight: 600,
          color: '#f0f6fc',
          lineHeight: 1.2,
          marginBottom: 14,
        }}>
          Your 3D models,<br />brought to life.
        </div>
      </MidFade>
      <ScrollOn duration={900} delay={150}>
        <div style={{
          fontSize: 'clamp(13px, 1.6vw, 14px)',
          color: 'rgba(240, 246, 252, 0.6)',
          lineHeight: 1.65,
        }}>
          Drop in a GLTF. Declare positions, animation clips, and
          material overrides per scene. The engine handles the
          loading, transitions, and crossfades. Your scene files stay in JSX.
        </div>
      </ScrollOn>
    </div>
  </Scene>
);
```

---

## Scene 4: @brewsite/charts

### Narrative

This scene leads with the **visual output**: six native 3D chart types that look and behave
differently from anything built on canvas textures. Bars cast real shadows. Pie slices catch
environment light. Scatter clouds can be orbited. The diagram shows the six chart types as the
hero, flanked by the data layer (ChartProvider / cross-filtering) and the three defining visual
qualities (shadows, environment, PBR materials).

Copy: "Data that belongs in 3D."

### File path

`apps/examples/src/architecture/scenes/scene_charts.tsx`

### Scene DSL: Complete Implementation

```tsx
import type { JSX } from 'react';
import {
  Scene,
  Camera,
  Lighting,
  Ambient,
  Directional,
  ProgressManager,
} from '@brewsite/core';
import {
  DiagramCanvas,
  Diagram,
  DiagramNode,
  DiagramEdge,
  DiagramGroup,
  ManualLayout,
  darkGlassTheme,
} from '@brewsite/diagram';
import { MidFade, ScrollOn } from '@brewsite/core/hud/animejs';

const LATE_FADE = {
  exit: [1.0, 1.0] as [number, number],
  enter: [1.0, 1.0] as [number, number],
};

export const sceneChartsArch: JSX.Element = (
  <Scene id="arch-charts" transition={LATE_FADE}>
    <ProgressManager
      scrollUnits={1800}
      autoAdvance={{ duration: 9, max: 0.88, pauseOnScroll: true }}
    />
    <Camera
      mode="world"
      position={[0, 6, 50]}
      target={[0, 0, 0]}
      fov={50}
    />
    <Lighting intensityScale={1}>
      <Ambient intensity={1.0} color="#ffffff" />
      <Directional intensity={0.6} color="#aaccff" position={[0, 20, 30]} />
      <Directional intensity={0.35} color="#ff9944" position={[20, 5, 15]} />
    </Lighting>

    <DiagramCanvas
      id="arch-charts-canvas"
      rotation={[-Math.PI / 10, 0, 0]}
      scale={1.1}
      theme={darkGlassTheme}
    >
      <Diagram id="charts-arch" pivot="center">
        <ManualLayout />

        {/* ── LEFT: Data layer ── */}
        <DiagramGroup id="data-group" label="Data Layer" variant="cluster">
          <DiagramNode
            id="chart-provider"
            label="ChartProvider"
            sublabel="any data, any source"
            icon="ui:server"
            position={[-12, 4.5, 0]}
            size={[5, 2.2]}
          />
          <DiagramNode
            id="named-source"
            label="Named Sources"
            sublabel="filter · group · sort"
            icon="ui:circle-stack"
            position={[-12, 1, 0]}
            size={[5, 2.2]}
          />
          <DiagramNode
            id="cross-filter"
            label="Cross-Filter"
            sublabel="linked chart brushing"
            icon="ui:funnel"
            position={[-12, -2.5, 0]}
            size={[5, 2.2]}
          />
        </DiagramGroup>

        {/* ── CENTER: Six chart types (3×2 grid) ── */}
        <DiagramGroup id="chart-types-group" label="Native 3D Chart Types" variant="boundary">
          {/* Row 1 */}
          <DiagramNode
            id="bar-chart"
            label="Bar Chart"
            sublabel="casts real shadows"
            icon="ui:chart-bar"
            position={[-2.5, 5.5, 0]}
            size={[4.5, 2.2]}
          />
          <DiagramNode
            id="line-chart"
            label="Line Chart"
            sublabel="luminous tubes"
            icon="ui:presentation-chart-line"
            position={[3, 5.5, 0]}
            size={[4.5, 2.2]}
          />
          {/* Row 2 */}
          <DiagramNode
            id="area-chart"
            label="Area Chart"
            sublabel="translucent ribbon"
            icon="ui:presentation-chart-bar"
            position={[-2.5, 2.5, 0]}
            size={[4.5, 2.2]}
          />
          <DiagramNode
            id="pie-chart"
            label="Pie / Donut"
            sublabel="catches env light"
            icon="ui:chart-pie"
            position={[3, 2.5, 0]}
            size={[4.5, 2.2]}
          />
          {/* Row 3 */}
          <DiagramNode
            id="scatter-plot"
            label="Scatter Plot"
            sublabel="orbit-able point cloud"
            icon="ui:variable"
            position={[-2.5, -0.5, 0]}
            size={[4.5, 2.2]}
          />
          <DiagramNode
            id="heatmap"
            label="Heatmap"
            sublabel="color + height = 4D"
            icon="ui:squares-2x2"
            position={[3, -0.5, 0]}
            size={[4.5, 2.2]}
          />
        </DiagramGroup>

        {/* ── RIGHT: Visual qualities ── */}
        <DiagramGroup id="visual-group" label="Native 3D Qualities" variant="cluster">
          <DiagramNode
            id="shadows-node"
            label="Real Shadows"
            sublabel="geometry casts + receives"
            icon="ui:sun"
            position={[12, 4.5, 0]}
            size={[5, 2.2]}
          />
          <DiagramNode
            id="env-light-node"
            label="Environment Light"
            sublabel="HDR reflections"
            icon="ui:globe-alt"
            position={[12, 1, 0]}
            size={[5, 2.2]}
          />
          <DiagramNode
            id="pbr-node"
            label="PBR Materials"
            sublabel="glass · metal · matte"
            icon="ui:swatch"
            position={[12, -2.5, 0]}
            size={[5, 2.2]}
          />
        </DiagramGroup>

        {/* Data → chart types */}
        <DiagramEdge from="chart-provider" to="bar-chart" flow="forward" />
        <DiagramEdge from="chart-provider" to="pie-chart" style="dashed" />
        <DiagramEdge from="named-source" to="scatter-plot" flow="forward" />
        <DiagramEdge from="cross-filter" to="bar-chart" style="dashed" arrowEnd="open" />
        <DiagramEdge from="cross-filter" to="scatter-plot" style="dashed" arrowEnd="open" />

        {/* Chart types → visual qualities */}
        <DiagramEdge from="bar-chart" to="shadows-node" flow="forward" />
        <DiagramEdge from="area-chart" to="env-light-node" style="dashed" />
        <DiagramEdge from="pie-chart" to="env-light-node" flow="forward" />
        <DiagramEdge from="scatter-plot" to="pbr-node" style="dashed" />
        <DiagramEdge from="heatmap" to="pbr-node" flow="forward" />
      </Diagram>
    </DiagramCanvas>

    {/* Overlay */}
    <div style={{
      position: 'absolute',
      bottom: '10%',
      right: '5%',
      maxWidth: 380,
      textAlign: 'right',
    }}>
      <MidFade duration={1200}>
        <div style={{
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 10,
          letterSpacing: '0.3em',
          textTransform: 'uppercase' as const,
          color: 'rgba(130, 100, 255, 0.8)',
          marginBottom: 10,
        }}>
          @brewsite/charts
        </div>
        <div style={{
          fontSize: 'clamp(20px, 3vw, 26px)',
          fontWeight: 600,
          color: '#f0f6fc',
          lineHeight: 1.2,
          marginBottom: 14,
        }}>
          Data that belongs<br />in 3D.
        </div>
      </MidFade>
      <ScrollOn duration={900} delay={150}>
        <div style={{
          fontSize: 'clamp(13px, 1.6vw, 14px)',
          color: 'rgba(240, 246, 252, 0.6)',
          lineHeight: 1.65,
        }}>
          Six native chart types. Bars cast real shadows. Pie slices
          catch environment light. Cross-filter across linked charts
          with a single prop. No canvas textures.
        </div>
      </ScrollOn>
    </div>
  </Scene>
);
```

---

## Coexistence with `apps/examples/src/chart/`

The architecture section and the chart demo are completely separate routes with independent
`EngineProvider` instances. They share no state, no plugins, and no widget registries.

| Route | Page | Plugins | Entry |
|---|---|---|---|
| `/examples/chart` | `ChartDemoPage` | `corePlugin` + `chartPlugin` | unchanged |
| `/examples/architecture` | `ArchitecturePage` | `corePlugin` + `diagramPlugin` | new |

Both are registered in `App.tsx` as lazy-loaded routes. The index page (`/examples/`) shows links
to both. No changes required to the chart demo files.

---

## Import Paths

All paths in scene files are relative to the workspace packages via the Vite alias config in
`apps/vite.config.ts`:

```typescript
// Used in all 4 scene files:
import { Scene, Camera, Lighting, Ambient, Directional, ProgressManager } from '@brewsite/core';
import { MidFade, ScrollOn } from '@brewsite/core/hud/animejs';
import {
  DiagramCanvas,
  Diagram,
  DiagramNode,
  DiagramEdge,
  DiagramGroup,
  ManualLayout,
  HierarchicalLayout,
  GridLayout,
  darkGlassTheme,
} from '@brewsite/diagram';

// In widgetSetup.ts:
import { corePlugin } from '@brewsite/core';
import { diagramPlugin } from '@brewsite/diagram';
import type { WidgetPlugin } from '@brewsite/core';

// In ArchitecturePage.tsx:
import { EngineProvider, EngineInputRegion, SceneCanvas } from '@brewsite/core';
```

`@brewsite/charts` is **not imported** in any architecture scene file. These scenes describe
the charts package through a diagram — they do not use chart widgets.

---

## Icon Reference

All icons follow the `namespace:name` pattern of `DiagramIconVariant`. Icons used in this plan:

| Icon string | Source | Notes |
|---|---|---|
| `ui:document-text` | heroicons-24/outline | ✓ confirmed in website scenes |
| `ui:camera` | heroicons-24/outline | standard heroicons |
| `ui:sun` | heroicons-24/outline | standard heroicons |
| `ui:swatch` | heroicons-24/outline | standard heroicons |
| `ui:squares-plus` | heroicons-24/outline | standard heroicons |
| `ui:photo` | heroicons-24/outline | standard heroicons |
| `ui:adjustments-horizontal` | heroicons-24/outline | standard heroicons |
| `ui:cursor-arrow-rays` | heroicons-24/outline | standard heroicons |
| `ui:play-circle` | heroicons-24/outline | standard heroicons |
| `ui:chat-bubble-left-right` | heroicons-24/outline | standard heroicons |
| `ui:check-circle` | heroicons-24/outline | standard heroicons |
| `ui:code-bracket-square` | heroicons-24/outline | standard heroicons |
| `ui:link` | heroicons-24/outline | standard heroicons |
| `ui:shield-check` | heroicons-24/outline | standard heroicons |
| `ui:server` | heroicons-24/outline | standard heroicons |
| `ui:rocket-launch` | heroicons-24/outline | standard heroicons |
| `ui:archive-box` | heroicons-24/outline | standard heroicons |
| `ui:cube` | heroicons-24/outline | standard heroicons |
| `ui:puzzle-piece` | heroicons-24/outline | standard heroicons |
| `ui:film` | heroicons-24/outline | standard heroicons |
| `ui:paint-brush` | heroicons-24/outline | standard heroicons |
| `ui:arrows-pointing-out` | heroicons-24/outline | standard heroicons |
| `ui:musical-note` | heroicons-24/outline | standard heroicons |
| `ui:arrow-down-tray` | heroicons-24/outline | standard heroicons |
| `ui:chart-bar` | heroicons-24/outline | standard heroicons |
| `ui:presentation-chart-line` | heroicons-24/outline | standard heroicons |
| `ui:presentation-chart-bar` | heroicons-24/outline | standard heroicons |
| `ui:chart-pie` | heroicons-24/outline | standard heroicons |
| `ui:variable` | heroicons-24/outline | standard heroicons |
| `ui:squares-2x2` | heroicons-24/outline | standard heroicons |
| `ui:circle-stack` | heroicons-24/outline | standard heroicons |
| `ui:funnel` | heroicons-24/outline | standard heroicons |
| `ui:globe-alt` | heroicons-24/outline | ✓ confirmed in website scenes |
| `tech:docker` | simple-icons | verify with `pnpm sync:icons` output |

**If `tech:docker` is unavailable** in the icon registry, replace it in `scene_diagram.tsx` with
`ui:archive-box`. Icon resolution degrades gracefully — missing icons render without a symbol,
not with an error.

---

## Styling Notes

### Overlay container positioning
- Scenes 1 and 3 (core, model): overlay `bottom: 10%, left: 5%`
- Scenes 2 and 4 (diagram, charts): overlay `bottom: 10%, right: 5%, textAlign: 'right'`

This alternation prevents visual monotony across the four scenes.

### Font
The overlay uses `JetBrains Mono` for the eyebrow and `system-ui` defaults for the body. The
`JetBrains Mono` font is preloaded in `apps/index.html`. No additional font setup is required.

### Eyebrow accent color
All scenes use `rgba(130, 100, 255, 0.8)` — a muted purple that complements `darkGlassTheme`'s
node palette without overpowering the 3D content.

---

## ProgressManager Configuration

All scenes use identical ProgressManager settings:
```tsx
<ProgressManager
  scrollUnits={1800}
  autoAdvance={{ duration: 9, max: 0.88, pauseOnScroll: true }}
/>
```

- `scrollUnits: 1800` — each scene occupies 1800px of scroll height
- `duration: 9` — auto-advance fires after 9 seconds of no interaction
- `max: 0.88` — auto-advance moves to 88% progress, leaving the scene visible
- `pauseOnScroll: true` — scroll interaction pauses auto-advance for the current scene

---

## TypeScript Notes

### `textTransform: 'uppercase' as const`
The overlay JSX uses inline styles. `textTransform: 'uppercase'` requires `as const` to satisfy
TypeScript's `CSSProperties` type (it expects a string literal, not `string`).

### `DiagramEdge flow prop`
`flow="forward"` is valid on `DiagramEdge`. Edges without `flow` default to `'none'` (no
animated flow pulse).

### `DiagramNode glow prop`
`glow={{ intensity: 0.2 }}` enables the glow effect with a custom intensity. The type is
`boolean | DiagramNodeGlowConfig`. When passing an object, TypeScript requires `intensity` to be
a `number`.

---

## Implementation Order

Implement in this order to catch structural issues early:

1. `apps/examples/src/architecture/widgetSetup.ts`
2. `apps/examples/src/architecture/flow.tsx`
3. `apps/examples/src/architecture/ArchitecturePage.tsx`
4. `apps/examples/src/App.tsx` (add route)
5. `apps/examples/src/architecture/scenes/scene_core.tsx`
6. `apps/examples/src/architecture/scenes/scene_diagram.tsx`
7. `apps/examples/src/architecture/scenes/scene_model.tsx`
8. `apps/examples/src/architecture/scenes/scene_charts.tsx`

After each scene file, verify it compiles with `pnpm --filter @brewsite/apps typecheck` (or the
equivalent typecheck command for the apps workspace).

---

## Verification Checklist

- [ ] `pnpm --filter @brewsite/apps typecheck` passes with zero errors
- [ ] `/examples/architecture` loads in browser
- [ ] All 4 scenes auto-advance correctly (9s timer, pauses on scroll)
- [ ] Camera and DiagramCanvas show the full diagram without clipping
- [ ] All 4 eyebrow / headline / body overlays animate in correctly
- [ ] Existing `/examples/chart` route is unaffected
- [ ] No `@brewsite/charts` or `@brewsite/model` imports in architecture scene files
