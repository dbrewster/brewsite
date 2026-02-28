# BrewFlow Scene Toolkit

**BrewFlow** is an open-source TypeScript + React + Three.js framework for building scroll-driven, multi-scene 3D experiences. Scene authors declare state in a typed JSX DSL; the compiler pre-bakes those declarations into a flat `SceneTrack` for O(1) runtime sampling and smooth playback. A widget-based runtime means custom elements plug in without modifying the engine.

## Packages

| Package | Version | Description |
|---|---|---|
| [`@brewsite/core`](./packages/core) | 0.4.x | Animation engine: compiler, runtime, player, widget SDK |
| [`@brewsite/diagram`](./packages/diagram) | 0.1.x | 3D diagram, canvas, image-panel, and screen elements |

Both packages are published to npm and can be used independently. `@brewsite/diagram` extends core with interactive architectural diagram rendering — nodes, edges, groups, animated transitions, and cloud provider icon support.

## Install

```bash
# Core engine only
npm install @brewsite/core react react-dom three

# With 3D diagram elements
npm install @brewsite/core @brewsite/diagram react react-dom three
```

Peer dependencies: `react ^19`, `react-dom ^19`, `three ^0.183`.

## Quick Example

Declare scenes as typed JSX and hand them to `ScenePlayer`:

```tsx
import {
  ScenePlayer, createDefaultWidgetRegistry,
  Scene, Lighting, Ambient, Directional,
} from '@brewsite/core';
import type { SceneDefinition, AssetManifest } from '@brewsite/core';

const intro: SceneDefinition = {
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
      sceneGroup={{ id: 'demo', scenes: [intro] }}
      widgetSetup={(manifest: AssetManifest | null) => createDefaultWidgetRegistry(manifest)}
      framesPerTick={100}
      pixelsPerScene={1600}
    />
  );
}
```

For diagram usage, see the [`@brewsite/diagram` README](./packages/diagram/README.md).
For the full core API, see the [`@brewsite/core` README](./packages/core/README.md).

## Running the Examples

The `apps/examples` directory contains a runnable dev app demonstrating core and diagram features.

**Prerequisites:** [pnpm](https://pnpm.io) v10+

```bash
# 1. Install workspace dependencies
pnpm install

# 2. Generate DSL types from the asset manifest (required before first run)
pnpm gen:scene-dsl

# 3. Start the dev server (port 5173)
pnpm dev
```

### Example Routes

| Route | Description |
|---|---|
| `/` or `/simple` | Minimal two-scene demo with labels |
| `/two-bots` | Alternate simple scenes with different assets |
| `/complex` | Multi-scene walkthrough |
| `/meeting` | Two-scene meeting demo |
| `/anim` | Multiple simultaneous animation clips |
| `/diagram` | Interactive 3D architecture diagram with orbit/dolly/focus |
| `/diagram-auto` | Auto-layout diagram (hierarchical layout engine) |
| `/diagram-example` | Lucid-imported diagram example |

## Where to Find Things

```
packages/core/src/
  player/       — ScenePlayer, hooks, engine lifecycle (React)
  compiler/     — Scene DSL → SceneTrack compiler (pure TypeScript, no Three.js)
  runtime/      — Widget-based execution coordinator
  elements/     — Model, camera, lighting, background, environment, floor
  widget/       — WidgetRegistry, VariableStore, widget interfaces
  hud/          — HUD overlay system
  labels/       — 3D-tracked label overlays
  input/        — Scene navigation and action-based input

packages/diagram/src/
  elements/diagram/    — Diagram nodes, edges, groups, animations, canvas
  elements/image-panel/ — 3D image panel with bezel and glow
  elements/screen/     — 3D screen element

apps/examples/         — Runnable example scenes (not published)
scripts/               — Asset pipeline helpers
requirements/prd/      — Product requirements and architecture docs
```

## Common Commands

```bash
pnpm install                                # install all workspace dependencies
pnpm dev                                    # Vite dev server (examples app, port 5173)
pnpm build                                  # build all packages (turbo, dependency-ordered)
pnpm typecheck                              # tsc --noEmit across all packages
pnpm test                                   # Vitest suite across all packages
pnpm sync:icons                             # sync heroicons + simple-icons into diagram assets
pnpm --filter @brewsite/core test:watch     # Vitest watch mode (core)
pnpm --filter @brewsite/diagram test:watch  # Vitest watch mode (diagram)
```

## License

See [LICENSE](./LICENSE).