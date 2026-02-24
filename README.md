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

The examples live under `examples/`:
- `examples/simple/` — End-to-end sample scene group.
- `examples/widgets/` — Reference custom widget implementations.

## Common Commands

```bash
pnpm dev        # Vite dev server (examples app)
pnpm build      # generate DSL → typecheck → build
pnpm test       # run Vitest suite once
pnpm typecheck  # tsc --noEmit
```
