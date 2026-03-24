# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Root-level (via Turborepo)
```bash
pnpm install                      # install all workspace dependencies
pnpm dev                          # turbo dev --filter=@brewsite/examples (Vite dev server)
pnpm build                        # turbo build (all packages, dependency-ordered)
pnpm build:lib                    # turbo build:lib (library tsc builds only, no Vite)
pnpm typecheck                    # turbo typecheck
pnpm test                         # turbo test (all packages)
pnpm coverage                     # turbo coverage
pnpm sync:icons                   # sync heroicons + simple-icons into diagram package assets
pnpm publish:all                  # publish all BrewSite packages to npm
```

### Per-package
```bash
pnpm --filter @brewsite/examples preview          # serve production build locally
pnpm --filter @brewsite/examples gen:scene-dsl    # regenerate scene DSL types from siteResources.ts
pnpm --filter @brewsite/core test:watch           # Vitest in watch mode (core)
pnpm --filter @brewsite/diagram test:watch        # Vitest in watch mode (diagram)
pnpm --filter @brewsite/diagram typecheck         # typecheck diagram package
pnpm --filter @brewsite/diagram gen-envmap        # regenerate HDR environment map
```

### Run a single test file
```bash
pnpm --filter @brewsite/core vitest run src/compiler/__tests__/someFile.test.ts
pnpm --filter @brewsite/diagram vitest run src/elements/diagram/__tests__/compile.test.ts
```

## Workspace Structure

This is a **pnpm + Turborepo monorepo** with published packages and private apps:

| Package | Name | Role |
|---|---|---|
| `packages/core` | `@brewsite/core` | Animation engine library (published) |
| `packages/diagram` | `@brewsite/diagram` | Diagram + screen element library (published) |
| `packages/model` | `@brewsite/model` | GLTF model + label system (published) |
| `packages/charts` | `@brewsite/charts` | 3D chart element library (published) |
| `packages/screens` | `@brewsite/screens` | 3D screen element library (published) |
| `packages/textures` | `@brewsite/textures` | PBR material texture presets (published) |
| `packages/slides` | `@brewsite/slides` | Slide deck presentation system (published) |
| `packages/themes` | `@brewsite/themes` | Theme bundles for scenes, diagrams, charts (published) |
| `packages/mdx` | `@brewsite/mdx` | Runtime browser-side MDX compilation with pre-registered BrewSite components (published) |
| `packages/claude-author` | `@brewsite/claude-author` | MCP server + docs search for AI-assisted scene authoring (published) |
| `packages/create-brewsite` | `create-brewsite` | Project scaffolder CLI (`npm create brewsite`) (published) |
| `packages/brewsite` | `brewsite` | Utility CLI (`npx brewsite add ...`) (published) |
| `apps/` | `@brewsite/apps` | Dev/demo apps (private) |

**Dependency rule:** `@brewsite/diagram`, `@brewsite/model`, and `@brewsite/charts` may import from `@brewsite/core`. `@brewsite/core` must never import from any of them. `@brewsite/mdx` depends on `@brewsite/core` as a peer and optionally integrates with `@brewsite/diagram`, `@brewsite/model`, `@brewsite/charts`, and `@brewsite/docs` when installed. The three CLI/tooling packages (`claude-author`, `create-brewsite`, `brewsite`) are standalone — they have no cross-package build dependencies. The apps may import from all packages.

---

## Architecture Overview

**BrewSite** is a TypeScript + React + Three.js framework for authoring and playing back animated 3D marketing scenes. The core engine lives in `packages/core/src/`; the diagram extension lives in `packages/diagram/src/`.

### `packages/core/src/` — Layer Map (top-to-bottom)

1. **Player** (`player/`) — React integration surface. The public entry point for pages/routes.
   - Exports: `SceneEngine`, `SceneCanvas`, `EngineOverlayHost`, `ScrollStage`, `InputCoordinator`, `useSceneEngine`, `useEngineState`, `useEngineScrubber`, `useSceneProgress`, `useCurrentScene`, `corePlugin`, `TimelineWidget`, `EngineGate`, `BackgroundLayer`.
   - `corePlugin()` is the plugin factory that wires the built-in core widgets (Lighting, Background, Environment, Floor, Camera, SceneMeta). Model and label widgets are registered separately via `@brewsite/model` using `modelPlugin()`.

2. **Runtime** (`runtime/`) — Generic widget-based execution coordinator.
   - `RuntimeDriverImpl` drives the tick loop: it holds a `WidgetRegistry`, samples the `SceneTrack`, and dispatches state to each registered widget each frame.
   - `RuntimeLoop` owns the `requestAnimationFrame` loop.
   - Contract is expressed in `runtime/types.ts` (`RuntimeDriver` interface).
   - Test doubles live in `runtime/mocks/`.

3. **Compiler** (`compiler/`) — Pure compilation pipeline. No Three.js, no React, no side effects.
   - Scene DSL (JSX) → `SceneFrame[]` → pre-baked `SceneTrack` (flat tick array for O(1) sampling).
   - Three internal passes: base-state collection → auto-entry transitions → tick baking.
   - `compiler/index.ts` exports **only the DSL authoring surface** (`Scene`, `Hud`, `InputController`, `Action`, etc.). Infrastructure types (`SceneTrack`, `compileSceneTrack`, cache functions) are imported directly from their source files by the player layer — never re-exported through this index.
   - Sub-directories:
     - `blocks/` — DSL block components (`hudBlocks.tsx`, `inputController.tsx`)
     - `transitions/` — Transition type system (`transitionTypes.ts`)
     - `primitives/` — Only `progressManager.ts` is active. Background, Camera, Environment, Floor, Lighting files are legacy dead code pending removal.

4. **Elements** (`elements/`) — Core renderable concepts. Each element is a self-contained module:
   - `model/` — GLTF model loading, animation playback
   - `camera/` — Camera state and orbit controls
   - `background/` — Scene background
   - `lighting/` — Scene lighting
   - `floor/` — Reflective floor plane
   - `environment/` — HDR environment map

   **Mandatory module pattern** with hard dependency direction:
   ```
   types.ts → dsl.tsx → compile.ts → render.ts → {Name}Widget.ts → index.ts
   ```
   - `types.ts` — interface contracts only; no runtime, Three.js, or React imports
   - `dsl.tsx` — prop type interfaces only; no React component functions, no Three.js
   - `compile.ts` — pure transformation functions; no React, no Three.js
   - `render.ts` — Three.js application layer; no React, no compiler imports
   - `{Name}Widget.ts` — implements `IWidget` (and relevant sub-interfaces); defines DSL stub functions (null-returning components); bridges compiler state to render layer
   - `index.ts` — public re-exports only

5. **Widget SDK** (`widget/`) — Plugin system for extending the runtime.
   - `WidgetRegistry` — registers widgets and routes DSL nodes to widget handlers.
   - `VariableStore` — reactive key-value store for cross-widget state sharing.
   - Widget interfaces: `IWidget`, `ISceneElement`, `IRenderable`, `ILoadable`, `IDslComposite`, `IContainedModel`, `IAnimationController`, `IVariableProvider`.
   - `CUSTOM_NODE_HANDLER` symbol — used to give a widget its own DSL node handler.

6. **HUD** (`hud/`) — Heads-up display overlay system.
   - `HudOverlay`, `HudItem`, `HudPhaseContext`.
   - Compiled via `compiler/hudCompiler.ts`; rendered as React in `player/`.

7. **Labels** — Moved to `@brewsite/model`. `LabelItem`, `LabelPositioner`, and `compiler/labelCompiler.ts` all live in `packages/model/src/`.

8. **Input** (`input/`) — Scene navigation and action-based input.
   - `InputController` — scroll/direct-mode scene navigation controller.
   - `ActionInputController` — action-mapped camera/canvas input (orbit, dolly, focus, etc.).
   - Type contracts: `SceneNavInputMap`, `SceneInputControllerSpec`, `InputActionSpec`, `InputActionMap`.

9. **Timeline** (`timeline/`) — Timeline algebra: stops, frame counts, tick steps, progress mapping.

10. **Math** (`math/`) — General math utilities.

### `packages/diagram/src/` — Layer Map

The diagram package adds immersive 3D diagram, image-panel, and screen elements on top of core.

- **`elements/diagram/`** — Full diagram element (nodes, edges, groups, animations):
  - `types.ts`, `dsl.tsx`, `compile.ts`, `render.ts` — standard module pattern
  - `compiler/` — Sub-compilers: `nodeCompiler`, `groupCompiler`, `layoutResolver`, `layoutAlgorithms`, `transitionHelpers`, `themeResolver`, `edgeRouter`
  - `shapes/` — `geometryFactory`, `iconRegistry`, `shapeVariants`, `svgIcon3D`
  - `themes/` — `darkGlass`, `enterprise`, `neonCyber`, `lightMinimal`
  - `rendering/` — `NodeRenderer`, `EdgeRenderer`, `GroupRenderer`, `TextRenderer`, `IconLoader`, `EnvMapManager`, `InteractionRegistry`, `GroupInteractionRegistry`
  - `canvas/` — `DiagramCanvas` element (orthographic 3D scene with camera orbit/dolly/focus)
  - `focusRegion.ts`, `useDiagramFocusRegion.ts`, `widget.ts`
- **`elements/image-panel/`** — 3D image-panel with bezel, gloss, and glow.
- **`elements/screen/`** — 3D screen element.
- **`elements/_shared/`** — Shared geometry helpers (`bezelGeometry`, `glowSprite`).
- **`compiler/`** — `handlers.ts` — registers diagram DSL node handlers into the compiler registry.
- **`lucid/`** — Lucid diagram import utilities.

### `apps/examples/` — Demo App

Example scenes demonstrating the full stack. Not part of any published package.

- Scene directories: `diagram/`, `lucid/`, `complex/`, `simple/`, `meeting/`, `two-bots/`, `multi-animation/`
- Each scene directory contains `scenes/` (declarative DSL), `widgetSetup.ts`, `autoWidgetSetup.ts`
- `widgets/` — Custom widget examples: `brain-model/`, `logo-rotator/`, `ribbon/`
- `siteResources.ts` — Asset manifest source; run `gen:scene-dsl` after changes
- `generated/` — Auto-generated DSL types (do not edit by hand)

---

### Key Design Rules

- **Entry transitions belong to the incoming scene**, not the outgoing one.
- **Three.js is confined to `render.ts` files** — nowhere else in the element stack.
- **Scenes are purely declarative** — describe state only; no animation math, no Three.js, no frame logic.
- The compiler output (`SceneTrack`) is a flat pre-baked array for O(1) sampling at playback time (`sceneTrackSampler.ts`).
- **`compiler/index.ts` exports only DSL authoring surface.** Infrastructure types are imported from their source files directly.
- **`@brewsite/diagram` may import from `@brewsite/core`, never vice-versa.**
- **Widget classes are the runtime integration contract.** New renderable concepts implement `IWidget` and optionally `ISceneElement`, `IRenderable`, `ILoadable`.

### Testing

Tests live in `__tests__/` directories co-located with code, named `*.test.ts` / `*.test.tsx`. The pattern is **interface-based stateful tests**: use real inputs, assert real outputs. For runtime tests, use interface-conforming doubles from `packages/core/src/runtime/mocks/` rather than mocking internals.

Coverage instrumentation targets:
```
packages/core/src/{compiler,elements,runtime,widget,player,hud,input,timeline,math}/**/*.ts
packages/diagram/src/**/*.ts
packages/model/src/**/*.ts
packages/charts/src/**/*.ts
packages/mdx/src/**/*.ts
```
Excludes `render.ts` files and barrel exports.

### Asset Pipeline

Model/animation changes go through `scripts/` at the repo root:
- `gen-scene-dsl.mjs` — generate scene DSL types from `siteResources.ts` (run via `gen:scene-dsl`)
- `sync-icons.mjs` — sync heroicons + simple-icons SVGs into diagram package assets
- `gen-diagram-envmap.mjs` — generate HDR environment map for diagram rendering
- `extract-model-metadata.mjs` — extract metadata from GLTF at build time
- `prune-dist.mjs` — post-build artifact cleanup
- `publish-all.mjs` — publish all BrewSite packages (`core`, `diagram`, `model`, `charts`, `screens`, `textures`, `slides`, `themes`, `mdx`, `claude-author`, `create-brewsite`, `brewsite`)

Prefer these helpers over ad-hoc pipelines for any asset-processing work.

---

## Requirements and Documentation Policies
- PRDs live under `requirements/*/prd/**` and are the source of truth; the structure has changed, so read the specific PRD for the area you touch.
- Naming: `prd_`, `plan_`, `idea_`, `note_`, `playbook_`, plus scaffolding files (`AGENTS.md`, `README.md`).
- Front matter on every Markdown file except AGENTS/README: `title`, `doc_type`, `owner`, `status`, `updated` (ISO).
- `requirements/**/archive/**` is read-only without explicit approval.
- Keep requirements synchronized with behavior changes; PRDs stay present-tense with tidy version history; update link targets when files move.

## Plans
- Plans live in `requirements/*/plans/**` and are authored by the PM/product architect bot. All plans must be created in this directory.
- When a plan is complete, mark it complete and move it into `requirements/*/plans/archive/**`.
- Once a plan is verified 100% complete, it can and should be moved into the archive.
- When creating a plan, do not leave product design or architecture up to the implementing bot. Be complete and very detailed. This is VERY important.
- Plans must include: explicit file paths, module boundaries, data types, API/native commands, UI layout structure, CSS/styling direction, state management, error handling, telemetry, and testing strategy.
- Plans should be verbose enough that a coding bot can implement without additional research, architecture, code design, etc...
- Design code to be modular and testable, with minimal coupling between modules and clear seams for unit tests. Include these instructions in the plan.

### Code Style

TypeScript strict mode, 2-space indentation, semicolons. Named exports preferred. `camelCase` for functions/variables, `PascalCase` for React components and types. Package manager is `pnpm` exclusively.
