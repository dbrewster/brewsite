# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm install          # install dependencies
pnpm dev              # turbo dev --filter=@brewsite/examples
pnpm build            # turbo build
pnpm typecheck        # turbo typecheck
pnpm test             # turbo test
pnpm coverage         # turbo coverage
pnpm --filter @brewsite/examples preview    # serve production build locally (examples app)
pnpm --filter @brewsite/core test:watch     # Vitest in watch mode (core)
```

To run a single test file:
```bash
pnpm --filter @brewsite/core vitest run src/robot/runtime/__tests__/someFile.test.ts
```

## Architecture Overview

**BrewSite** is a TypeScript + React + Three.js app for authoring and playing back animated robot marketing scenes. The core lives entirely in `packages/core/src/robot/`.

### Layers (top-to-bottom)

1. **Engine** (`packages/core/src/robot/engine/`) — React hook layer. Exports `useSceneEngine`, `useEngineScroll`, `SceneCompiler`, `ModelResourceManager`, `EngineFrameDriver`, `EngineScrollRegion`. This is the public integration surface for pages/routes.

2. **Runtime** (`packages/core/src/robot/runtime/`) — Execution coordinator. `RuntimeDriverImpl` drives playback: it owns the `World`, `Model`, `MotionSystem`, `AnimationPlayer`, and `ModelRenderer`. It consumes the pre-compiled `SceneTrack` and applies element state each tick.

3. **Compiler** (`packages/core/src/robot/runtime/compiler/`) — Pure compilation pipeline. Scene DSL (JSX) → `SceneFrame[]` → pre-baked `SceneTrack` (flat tick lookup). Three passes: base state → auto-entry transitions → tick baking. No Three.js allowed here. See `packages/core/src/robot/runtime/compiler/CLAUDE.md` for the full compiler contract.

4. **Elements** (`packages/core/src/robot/elements/`) — One subdirectory per renderable concept (model, lighting, background, floor, environment, ribbon, annotations). Every element follows the **mandatory module pattern** with a hard dependency direction:

   ```
   types.ts → dsl.tsx → compile.ts → render.ts → index.ts
   ```
   - `types.ts` — interface contracts only, no runtime imports
   - `dsl.tsx` — React DSL components, no Three.js
   - `compile.ts` — pure transformation functions, no React, no Three.js
   - `render.ts` — Three.js application, no React, no compiler imports
   - `index.ts` — public re-exports

5. **Scenes** (`packages/core/src/robot/scenes/`) — Declarative scene definitions using the DSL. No animation logic, no Three.js, no frame math allowed here.

6. **Timeline** (`packages/core/src/robot/robotTimeline.ts`, `robotTimelineMath.ts`) — Timeline algebra: stops, frame counts, tick steps, progress mapping.

### Key Design Rules

- **Entry transitions belong to the incoming scene**, not the outgoing one.
- **Three.js is confined to `render.ts` files** — nowhere else in the element stack.
- **Scenes are purely declarative** — describe state, not how to animate.
- The compiler output (`SceneTrack`) is a flat pre-baked array for O(1) sampling at playback time (`sceneTrackSampler.ts`).

### Testing

Tests live in `__tests__/` directories co-located with code, named `*.test.ts` / `*.test.tsx`. The pattern is **interface-based stateful tests**: use real inputs, assert real outputs. For runtime tests, use interface-conforming doubles from `packages/core/src/robot/runtime/mocks/` rather than mocking internals. Coverage instrumentation targets `packages/core/src/robot/{model,scenes,runtime,elements}/**/*.ts` and excludes `render.ts` files and barrel exports.

### Asset Pipeline

Model/animation changes go through `scripts/`:
- `extract-model-metadata.mjs` — extract metadata from GLTF at build time
- `gen-scene-dsl.mjs` — generate scene DSL types from resources
- `prune-dist.mjs` — post-build artifact cleanup

Prefer these helpers over ad-hoc pipelines for any asset-processing work.

## Workspace Filters

```bash
pnpm --filter @brewsite/core test:watch
pnpm --filter @brewsite/diagram typecheck
```

## Package Dependency Rules

- `@brewsite/diagram` may import from `@brewsite/core`, never vice-versa.

## Requirements and Documentation Policies
- PRDs live under `requirements/prd/**` and are the source of truth; the structure has changed, so read the specific PRD for the area you touch.
- Naming: `prd_`, `plan_`, `idea_`, `note_`, `playbook_`, plus scaffolding files (`AGENTS.md`, `README.md`).
- Front matter on every Markdown file except AGENTS/README: `title`, `doc_type`, `owner`, `status`, `updated` (ISO).
- `requirements/**/archive/**` is read-only without explicit approval.
- Keep requirements synchronized with behavior changes; PRDs stay present-tense with tidy version history; update link targets when files move.

## Plans
- Plans live in `requirements/plans/**` and are authored by the PM/product architect bot. All plans must be created in this directory.
- When a plan is complete, mark it complete and move it into `requirements/plans/archive/**`.
- Once a plan is verified 100% complete, it can and should be moved into the archive.
- When creating a plan, do not leave product design or architecture up to the implementing bot. Be complete and very detailed. This is VERY important.
- Plans must include: explicit file paths, module boundaries, data types, API/native commands, UI layout structure, CSS/styling direction, state management, error handling, telemetry, and testing strategy.
- Plans should be verbose enough that a coding bot can implement without additional research, architecture, code design, etc...
- Design code to be modular and testable, with minimal coupling between modules and clear seams for unit tests. Include these instructions in the plan.

### Code Style

TypeScript strict mode, 2-space indentation, semicolons. Named exports preferred. `camelCase` for functions/variables, `PascalCase` for React components and types. Package manager is `pnpm` exclusively.
