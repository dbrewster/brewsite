# BrewFlow Scene Toolkit

The BrewFlow Scene Toolkit is an open source TypeScript + React + Three.js toolkit for building multi-scene, scroll-driven experiences that blend 3D content with React UI. Scene authors declare state in a typed JSX DSL; the compiler pre-bakes those declarations into a flat SceneTrack for O(1) runtime sampling and smooth playback. The core architecture is widget-based: built-in and custom elements both implement the same capability interfaces and are registered through a WidgetRegistry.

## Where to Find Things

- `src/widget/` — Widget SDK interfaces, WidgetRegistry, VariableStore, `useVariable` hook.
- `src/compiler/` — Scene DSL compiler and SceneTrack sampler (pure TypeScript, no Three.js).
- `src/runtime/` — Runtime driver and tick loop (generic, no element knowledge).
- `src/elements/` — First-party widgets (model, lighting, background, environment, floor).
- `src/player/` — Public consumer API: `ScenePlayer`, hooks, engine lifecycle.
- `src/annotations/` and `src/labels/` — Overlay systems for annotations and labels.
- `src/timeline/` and `src/math/` — Pure utilities.
- `examples/` — Example scenes and consumer widgets.
- `scripts/` — Asset pipeline and build helpers (`gen-scene-dsl.mjs`, `extract-model-metadata.mjs`).
- `requirements/prd/` — Product requirements and architecture references.

## How to Get Started (Run the Examples)

1. Install dependencies:

```bash
pnpm install
```

2. Generate the example DSL and asset manifest:

```bash
pnpm gen:scene-dsl
```

3. Start the dev server (serves the examples app on port 5173):

```bash
pnpm dev
```

The examples app routes live in `examples/vite-app/App.tsx` and include:
- `/simple` → `examples/simple/pages/SimplePage.tsx`
- `/two-bots` → `examples/two-bots/pages/TwoBots.tsx`
- `/complex` → `examples/complex/pages/ComplexPage.tsx`
- `/meeting` → `examples/meeting/pages/MeetingPage.tsx`

## Examples Directory Guide

- `examples/simple/` — Minimal two-scene demo with labels and a basic widget registry.
- `examples/two-bots/` — Variant of the simple scene setup with alternate scenes and assets.
- `examples/complex/` — Multi-scene walkthrough with more states and transitions.
- `examples/meeting/` — Two-scene meeting demo using the same engine surface.
- `examples/widgets/` — Reference custom widgets: `brain-model`, `logo-rotator`, `ribbon`.
- `examples/siteResources.ts` — Asset manifest input for the generator.
- `examples/generated/` — Auto-generated types and DSL wrappers from the asset pipeline.
- `examples/public/` — Generated `scene-manifest.json` and public assets for the example app.

## Defining a Site With `siteResources.ts`

`examples/siteResources.ts` is the source of truth for models, contained models, and animations. The generator reads this file and produces:
- `examples/generated/sceneDsl.generated.ts` — typed unions and DSL components (e.g., `Robot`, `BrainSubparts`).
- `examples/public/scene-manifest.json` — runtime manifest consumed by the engine.

Minimal example:

```ts
// examples/siteResources.ts
export const siteResources = {
  models: [
    {
      type: 'Robot',
      role: 'primary' as const,
      path: '/assets/robot.no-normals.glb',
      anchorKeys: ['Head', 'chest'],
      footOffsetY: -130,
    },
  ],
  containedModels: [
    {
      type: 'brain',
      path: '/assets/brain_separated.glb',
      target: 'Head',
      scale: 0.53,
      position: [0, -0.03, 0.12],
      rotation: [-0.3, 0, 0],
    },
  ],
  animations: [
    { type: 'ChatRelaxF', path: '/assets/motion/chat-relax-f.glb' },
  ],
} as const;
```

## Generate Code and Use It

1. Generate the DSL and manifest:

```bash
pnpm gen:scene-dsl
```

2. Import generated DSL components and types in your scenes:

```tsx
import { Scene, Lighting, Ambient, Directional } from '@brewsite/core';
import type { SceneDefinition } from '@brewsite/core';
import { Robot, BrainSubparts } from '../generated/sceneDsl.generated';

export const scene01: SceneDefinition = {
  id: 'intro',
  index: 0,
  getFrame: () => (
    <Scene id="intro">
      <Lighting intensityScale={1}>
        <Ambient intensity={2} color="#ffffff" />
        <Directional intensity={2} color="#ffffff" position={[20, 30, 40]} />
      </Lighting>
      <Robot id="primary" position={[0, -30, 0]} scale={0.2}>
        <Robot.Brain opacity={1}>
          <BrainSubparts>
            <BrainSubparts.MarkerFrontLeft />
          </BrainSubparts>
        </Robot.Brain>
      </Robot>
    </Scene>
  ),
};
```

3. Provide a widget registry and render `ScenePlayer`:

```tsx
import { ScenePlayer, createDefaultWidgetRegistry } from '@brewsite/core';
import type { AssetManifest } from '@brewsite/core';
import { scene01 } from './scenes/scene01';

const createWidgetSetup = (manifest: AssetManifest | null) =>
  createDefaultWidgetRegistry(manifest);

export default function Page() {
  return (
    <ScenePlayer
      sceneGroup={{ id: 'demo', scenes: [scene01] }}
      manifestUrl="/scene-manifest.json"
      widgetSetup={createWidgetSetup}
      framesPerTick={100}
      pixelsPerScene={1600}
    />
  );
}
```

## Common Commands

```bash
pnpm dev        # Vite dev server (examples app)
pnpm build      # generate DSL → typecheck → build
pnpm test       # run Vitest suite once
pnpm typecheck  # tsc --noEmit
```
