# @brewsite/core

The core animation engine for the BrewSite Scene Toolkit. Provides a TypeScript + React + Three.js framework for authoring multi-scene, scroll-driven 3D experiences via a declarative JSX DSL.

## Installation

```bash
npm install @brewsite/core react react-dom three
```

Peer dependencies: `react ^19`, `react-dom ^19`, `three ^0.183`.

## Overview

Scene authors declare state in a typed JSX DSL. The compiler pre-bakes those declarations into a flat `SceneTrack` for O(1) runtime sampling. The widget-based runtime dispatches compiled state to registered widgets each frame — no model- or element-specific code required at the engine level.

## Quick Start

### Full-page marketing scroll

```tsx
import {
  SceneEngine, ScrollStage, BackgroundLayer, SceneCanvas, EngineOverlayHost,
  ScrollInput, KeyboardInput, corePlugin, Scene,
} from '@brewsite/core';
import { modelPlugin } from '@brewsite/model';

const PLUGINS = [corePlugin(), modelPlugin(null)];

export default function LandingPage() {
  return (
    <SceneEngine plugins={PLUGINS} onError={console.error}>
      <Scene id="intro">...</Scene>
      <Scene id="features">...</Scene>

      <ScrollStage scrollHeightMode="scene-count" pixelsPerScene={1400}>
        <BackgroundLayer style={{ position: 'absolute', inset: 0, zIndex: 0 }} />
        <SceneCanvas style={{ width: '100%', height: '100%' }} />
        <ScrollInput source="window" />
        <KeyboardInput />
        <EngineOverlayHost />
      </ScrollStage>
    </SceneEngine>
  );
}
```

### Embedded reel (docs / slides)

```tsx
import { SceneReel, TimeInput, Scene, corePlugin } from '@brewsite/core';

export function DemoWidget() {
  return (
    <SceneReel height={400} plugins={[corePlugin()]}>
      <Scene id="step1">...</Scene>
      <Scene id="step2">...</Scene>
      <TimeInput duration={4} loop pauseWhenHidden={{ y: 0.5 }} />
    </SceneReel>
  );
}
```

### Slide deck (keyboard navigation)

```tsx
import { SceneReel, KeyboardInput, Scene, corePlugin } from '@brewsite/core';

export function SlideDeck() {
  return (
    <SceneReel height={600} plugins={[corePlugin()]}>
      <Scene id="slide1">...</Scene>
      <Scene id="slide2">...</Scene>
      <KeyboardInput />
    </SceneReel>
  );
}
```

### Complex layout with sidebar nav

```tsx
import { SceneEngine, SceneCanvas, ScrollInput, useGoToScene, corePlugin, Scene } from '@brewsite/core';

function Sidebar() {
  const goToScene = useGoToScene();
  return (
    <nav>
      <button onClick={() => goToScene('overview')}>Overview</button>
      <button onClick={() => goToScene('features')}>Features</button>
    </nav>
  );
}

export function DocsLayout() {
  return (
    <SceneEngine plugins={[corePlugin()]}>
      <Scene id="overview">...</Scene>
      <Scene id="features">...</Scene>
      <ScrollInput source="inertia" />

      <div style={{ display: 'flex' }}>
        <Sidebar />
        <SceneCanvas style={{ flex: 1 }} />
      </div>
    </SceneEngine>
  );
}
```

### App-level plugin hoisting (root zero-scene mode)

```tsx
import { SceneEngine, SceneReel, TimeInput, Scene, corePlugin } from '@brewsite/core';
import { modelPlugin } from '@brewsite/model';
import { diagramPlugin } from '@brewsite/diagram';

// Root layout — no scenes; provides plugins for all nested reels.
function RootLayout({ children }: { children: React.ReactNode }) {
  const plugins = useMemo(() => [corePlugin(), modelPlugin({ manifestUrl: '/manifest.json' }), diagramPlugin()], []);
  return (
    <SceneEngine plugins={plugins}>
      {children}
    </SceneEngine>
  );
}

// Anywhere nested (plugins inherited automatically):
function ProductPage() {
  return (
    <SceneReel height={400}>   {/* no plugins prop needed */}
      <Scene id="hero">...</Scene>
      <TimeInput duration={5} loop />
    </SceneReel>
  );
}
```

---

## Key Exports

### Core Engine

| Export | Description |
|---|---|
| `SceneEngine` | Root engine component — pure context provider, zero DOM output |
| `SceneReel` | Convenience wrapper for embedded/docs/slides use cases |

### Layout Components

| Export | Description |
|---|---|
| `ScrollStage` | DOM layout helper for the full-page sticky-canvas pattern |
| `BackgroundLayer` | Wires `engine.setBackgroundRef` to a positioned div |
| `SceneCanvas` | Renders the Three.js canvas |
| `EngineOverlayHost` | Renders HUD overlay content |
| `EngineARContainer` | Fixed aspect-ratio container with scale mode handling |
| `EngineGate` | Gates rendering until the first frame; shows placeholder during loading |

### Input Components

| Export | Description |
|---|---|
| `ScrollInput` | Drives engine progress from scroll (inertia, window, element, or custom `IScrollSource`) |
| `TimeInput` | Drives engine progress via wall-clock auto-advance |
| `KeyboardInput` | Keyboard scene navigation (arrow keys, space) |
| `PointerInput` | Click-to-advance or hover-to-scrub pointer input |
| `ControlledInput` | Drives engine progress from an external `value` prop (highest priority) |

### Scroll Source

| Export | Description |
|---|---|
| `useNativeScrollSource` | Creates a hidden off-screen native scroll container returning `IScrollSource` |
| `IScrollSource` | Interface for custom scroll source implementations (Lenis, Virtual Scroll, etc.) |
| `ScrollSourceProp` | Union type for the `source` prop on `<ScrollInput>` |

### Hooks

| Export | Description |
|---|---|
| `useEngineState()` | Engine frame state from nearest `SceneEngine` context |
| `useEngineState(id)` | Engine frame state from global registry by engine id |
| `useGoToScene()` | Returns a stable function for programmatic scene navigation |
| `useEngineScrubber()` | Scrubbing state + `setProgress` for drag/seek UI |
| `useSceneProgress()` | Current scene-local progress [0, 1] |
| `useCurrentScene()` | Current scene id and index |
| `useSceneRuntime(id)` | Runtime state (assets, viewport) from global registry |
| `useSceneEngineContext()` | Raw engine context for advanced custom integrations |
| `useNativeScrollSource(opts)` | Hidden native scroll region as `IScrollSource` |

### Plugin System

| Export | Description |
|---|---|
| `corePlugin` | Registers core widgets: Lighting, Background, Environment, Floor, Camera, SceneMeta |

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
| `WidgetRegistry` | Plugin registry — maps DSL components to widget instances |
| `VariableStore` | Reactive key-value store for cross-widget state |
| `useVariable` | React hook for reading a `VariableStore` variable |
| `CUSTOM_NODE_HANDLER` | Symbol for widgets that override default DSL node routing |

### UI Components

| Export | Description |
|---|---|
| `TimelineWidget` | Timeline scrubber overlay component |
| `CameraControlPanel` | Camera orbit/dolly control UI *(dev tool)* |
| `SceneInspector` | Scene navigation overlay *(dev tool)* |

---

## Upgrading from v1

See [MIGRATION.md](./MIGRATION.md) for a complete v1 → v2 upgrade guide.

**Summary of breaking changes:**
- `EngineProvider` deleted → use `SceneEngine`
- `EngineInputRegion` deleted → use `ScrollStage` + `ScrollInput` (scroll mode) or `SceneReel` (embedded mode)
- `ScrollCaptureSection` deleted → use `ScrollStage`
- `useEngineScroll` / `useEngineInput` deleted → functionality internalized in input components
- `useSceneEngineState(id)` deleted → use `useEngineState(id)`
- `engine.scrollToProgress(p)` deleted → use `engine.setProgress(p)` or `useGoToScene()`
- `InputModePolicy` / `ScrollSource` types deleted → no replacement needed
- `useEngineScrubber` no longer takes an options argument

---

## Architecture

The engine is structured in layers (top to bottom):

1. **Player** (`src/player/`) — React integration surface
2. **Runtime** (`src/runtime/`) — Generic widget-based execution coordinator
3. **Compiler** (`src/compiler/`) — Pure DSL → SceneTrack pipeline (no Three.js, no React)
4. **Elements** (`src/elements/`) — Core renderable widgets (model, camera, lighting, background, environment, floor)
5. **Widget SDK** (`src/widget/`) — `WidgetRegistry`, `VariableStore`, widget interfaces
6. **HUD / Input** — Overlay and input systems

Each element follows a strict module pattern:
```
types.ts → dsl.tsx → compile.ts → render.ts → {Name}Widget.ts → index.ts
```

## Peer Dependencies

| Package | Version |
|---|---|
| `react` | ^19 |
| `react-dom` | ^19 |
| `three` | ^0.183 |

## License

See [LICENSE](./LICENSE).
