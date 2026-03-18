# @brewsite/model

3D model loading, animation playback, and label system for BrewSite scenes.

## Installation

```bash
pnpm add @brewsite/model @brewsite/core react react-dom three
```

## Setup

Add `modelPlugin()` to your `SceneEngine` plugins:

```tsx
import { SceneEngine, SceneCanvas, EngineOverlayHost } from '@brewsite/core/player';
import { modelPlugin } from '@brewsite/model';

function App() {
  return (
    <SceneEngine
      plugins={[modelPlugin({ manifest: '/assets/manifest.json' })]}
      getFrame={() => <IntroScene />}
    >
      <SceneCanvas />
      <EngineOverlayHost />
    </SceneEngine>
  );
}
```

## Scene Authoring

```tsx
import { Scene } from '@brewsite/core/compiler';
import { Camera, Background, Lighting, Ambient } from '@brewsite/core/elements';
import { Model, Animation, Label } from '@brewsite/model';

function IntroScene() {
  return (
    <Scene id="intro">
      <Camera mode="orbit" distance={3} azimuth={0} polar={60} fov={45} />
      <Background color="#1a1a2e" />
      <Lighting><Ambient intensity={0.6} /></Lighting>
      <Model id="hero" src="hero-bot" scale={1} y={0} />
      <Animation model="hero" clip="idle" />
      <Label target="hero" bone="head" text="Hello!" />
    </Scene>
  );
}
```

## API

See the [full documentation](https://brewsite.dev/docs/model) for complete API reference.
