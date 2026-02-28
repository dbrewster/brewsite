# @brewsite/core

The core animation engine for the BrewFlow Scene Toolkit. Provides a TypeScript + React + Three.js framework for authoring multi-scene, scroll-driven 3D experiences via a declarative JSX DSL.

## Installation

```bash
npm install @brewsite/core react react-dom three
```

Peer dependencies: `react ^19`, `react-dom ^19`, `three ^0.183`.

## Overview

Scene authors declare state in a typed JSX DSL. The compiler pre-bakes those declarations into a flat `SceneTrack` for O(1) runtime sampling. The widget-based runtime dispatches compiled state to registered widgets each frame — no model- or element-specific code required at the engine level.

## Quick Start

```tsx
import {
  ScenePlayer, createDefaultWidgetRegistry,
  Scene, Lighting, Ambient, Directional,
} from '@brewsite/core';
import type { SceneDefinition, AssetManifest } from '@brewsite/core';

const scene01: SceneDefinition = {
  id: 'intro',
  index: 0,
  getFrame: () => (
    <Scene id="intro">
      <Lighting intensityScale={1}>
        <Ambient intensity={2} color="#ffffff" />
        <Directional intensity={2} color="#ffffff" position={[20, 30, 40]} />
      </Lighting>
    </Scene>
  ),
};

export default function Page() {
  return (
    <ScenePlayer
      sceneGroup={{ id: 'demo', scenes: [scene01] }}
      manifestUrl="/scene-manifest.json"
      widgetSetup={(manifest: AssetManifest | null) => createDefaultWidgetRegistry(manifest)}
      framesPerTick={100}
      pixelsPerScene={1600}
    />
  );
}
```

## Key Exports

### Player (React integration surface)

| Export | Description |
|---|---|
| `ScenePlayer` | Top-level React component — renders the Three.js canvas, HUD, labels, scroll region |
| `useSceneEngine` | Low-level hook for custom player layouts |
| `useEngineScroll` | Hook for scroll-progress binding |
| `useEngineInput` | Hook for input binding |
| `useEngineScrubber` | Hook for scrubber/seek binding |
| `useSceneProgress` | Hook for current scene progress (0–1) |
| `useCurrentScene` | Hook for current scene metadata |
| `useEngineState` | Hook for full engine frame state |
| `EngineContext` / `useSceneEngineContext` | Engine context for custom integrations |
| `createDefaultWidgetRegistry` | Creates a pre-configured `WidgetRegistry` with core widgets (Model, Lighting, Background, Environment, Floor, Camera) |
| `EngineScrollRegion` | Scroll spacer for scroll-mode navigation |
| `EngineInputRegion` | Input capture region for direct-mode navigation |
| `LabelPositioner` | 3D-to-screen projection for label overlays |
| `LabelPositionerContext` / `useLabelPositioner` | Label positioner context for custom label components |
| `TimelineWidget` | Debug timeline overlay |
| `CameraControlPanel` | Camera orbit/dolly control UI |
| `CameraInteractionInfoDialog` | Camera interaction help dialog |

### Compiler DSL (scene authoring)

| Export | Description |
|---|---|
| `Scene` | Root DSL component for a scene frame |
| `Hud` / `HudItem` | HUD overlay authoring |
| `InputController` / `Action` | Action-mapped input configuration |
| `PointerMap` / `WheelMap` / `KeyMap` / `PinchMap` | Input binding maps |
| `registerNode` | Register a custom DSL node handler |

### Widget SDK

| Export | Description |
|---|---|
| `WidgetRegistry` | Plugin registry; maps DSL components to widget instances |
| `VariableStore` | Reactive key-value store for cross-widget state |
| `useVariable` | React hook for reading a `VariableStore` variable |

### Core element DSL components

Base compilers and types for first-party elements:

```ts
import { compileModel, compileLighting, compileBackground, compileCamera } from '@brewsite/core';
```

### Type exports

```ts
import type {
  SceneDefinition,
  SceneGroup,
  SceneFrame,
  SceneTrack,
  SceneTrackTick,
  ClipMeta,
  AssetManifest,
  WidgetRegistry,
  RuntimeDriver,
  SceneNavInputMap,
  SceneInputControllerSpec,
  InputActionSpec,
  FunctionalTransitionSpec,
  ElementTransitionSpec,
} from '@brewsite/core';
```

### Transition utilities

```ts
import { blendNumber, blendOpacity, blendVec3, blendColor, transitionT } from '@brewsite/core';
```

## Peer Dependencies

| Package | Version |
|---|---|
| `react` | ^19 |
| `react-dom` | ^19 |
| `three` | ^0.183 |

## Architecture

The engine is structured in layers (top to bottom):

1. **Player** (`src/player/`) — React integration surface
2. **Runtime** (`src/runtime/`) — Generic widget-based execution coordinator
3. **Compiler** (`src/compiler/`) — Pure DSL → SceneTrack pipeline (no Three.js, no React)
4. **Elements** (`src/elements/`) — Core renderable widgets (model, camera, lighting, background, environment, floor)
5. **Widget SDK** (`src/widget/`) — `WidgetRegistry`, `VariableStore`, widget interfaces
6. **HUD / Labels / Input** — Overlay and input systems

Each element follows a strict module pattern:
```
types.ts → dsl.tsx → compile.ts → render.ts → {Name}Widget.ts → index.ts
```
- `types.ts` — interface contracts only; no Three.js or React
- `dsl.tsx` — React DSL components; no Three.js
- `compile.ts` — pure transformation functions; no React, no Three.js
- `render.ts` — Three.js application layer
- `{Name}Widget.ts` — implements `IWidget`; bridges compiled state to render layer

## License

See [LICENSE](./LICENSE).
