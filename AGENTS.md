# AGENTS.md

This file provides guidance to AI agents (Claude Code and other automated tools) when working with this repository.

## Commands

### Root-level (via Turborepo)
```bash
pnpm install                      # install all workspace dependencies
pnpm dev                          # turbo dev --filter=@brewsite/examples (Vite dev server)
pnpm build                        # turbo build (all packages, dependency-ordered)
pnpm build:lib                    # turbo build:lib (library tsc builds only)
pnpm typecheck                    # turbo typecheck
pnpm test                         # turbo test (all packages)
pnpm coverage                     # turbo coverage
pnpm sync:icons                   # sync heroicons + simple-icons into diagram assets
pnpm publish:core-diagram         # publish @brewsite/core and @brewsite/diagram
```

### Per-package
```bash
pnpm --filter @brewsite/examples preview          # serve production build locally
pnpm --filter @brewsite/examples gen:scene-dsl    # regenerate scene DSL types from siteResources.ts
pnpm --filter @brewsite/core test:watch           # Vitest in watch mode (core)
pnpm --filter @brewsite/diagram test:watch        # Vitest in watch mode (diagram)
pnpm --filter @brewsite/diagram typecheck         # typecheck diagram package only
pnpm --filter @brewsite/diagram gen-envmap        # regenerate diagram HDR environment map
```

### Run a single test file
```bash
pnpm --filter @brewsite/core vitest run src/compiler/__tests__/someFile.test.ts
pnpm --filter @brewsite/diagram vitest run src/elements/diagram/__tests__/compile.test.ts
```

---

## Workspace Layout

This is a **pnpm + Turborepo monorepo**.

```
brewsite/
├── packages/
│   ├── core/        (@brewsite/core)     — published animation engine library
│   └── diagram/     (@brewsite/diagram)  — published diagram/screen element library
├── apps/
│   └── examples/    (@brewsite/examples) — private dev/demo app
├── scripts/                              — shared build/asset scripts
└── requirements/                         — PRDs, plans, architecture docs
```

**Dependency rule:** `@brewsite/diagram` → `@brewsite/core`. Never the reverse. `apps/examples` may import from both.

---

## Architecture

### `packages/core/src/` — Layers (top to bottom)

1. **Player** (`player/`)
   - React integration surface. Public entry point for host applications.
   - Exports: `ScenePlayer`, `useSceneEngine`, `useEngineScroll`, `useEngineInput`, `useEngineScrubber`, `useSceneProgress`, `useCurrentScene`, `EngineFrameDriver`, `EngineScrollRegion`, `EngineInputRegion`, `createDefaultWidgetRegistry`, `LabelPositioner`, `TimelineWidget`, `CameraControlPanel`.
   - `createDefaultWidgetRegistry(manifest)` wires the built-in widget set (Model, Lighting, Background, Environment, Floor, Camera, SceneMeta).

2. **Runtime** (`runtime/`)
   - Generic widget-based execution coordinator.
   - `RuntimeDriverImpl` drives the tick loop: holds a `WidgetRegistry`, samples the `SceneTrack` each frame, and dispatches compiled state to each widget.
   - `RuntimeLoop` owns the `requestAnimationFrame` loop.
   - `RuntimeDriver` interface (in `runtime/types.ts`) is the contract; the player layer depends only on that interface.
   - Test doubles: `runtime/mocks/`.

3. **Compiler** (`compiler/`)
   - Pure compilation pipeline. **No Three.js. No React. No side effects.**
   - Scene DSL (JSX) → `SceneFrame[]` → `SceneTrack` (flat tick array, O(1) sampling).
   - Three passes: base-state collection → auto-entry transitions → tick baking.
   - `compiler/index.ts` exports **only the DSL authoring surface** (`Scene`, `Hud`, `InputController`, `Action`, `PointerMap`, `WheelMap`, `KeyMap`, `registerNode`, etc.).
   - Infrastructure types (`SceneTrack`, `compileSceneTrack`, cache fns) are imported from source files directly — never re-exported from `compiler/index.ts`.
   - Sub-directories: `blocks/` (Hud, InputController DSL blocks), `transitions/` (transition type system), `primitives/` (per-element primitive compilers).

4. **Elements** (`elements/`)
   - Core renderable concepts: `model/`, `camera/`, `background/`, `lighting/`, `floor/`, `environment/`.
   - **Mandatory module pattern** (hard dependency direction):
     ```
     types.ts → dsl.tsx → compile.ts → render.ts → {Name}Widget.ts → index.ts
     ```
     - `types.ts` — interface contracts only; no runtime, Three.js, or React
     - `dsl.tsx` — React DSL components; no Three.js
     - `compile.ts` — pure transformation functions; no React, no Three.js
     - `render.ts` — Three.js application; no React, no compiler imports
     - `{Name}Widget.ts` — implements `IWidget`; bridges compiled state to render
     - `index.ts` — re-exports only

5. **Widget SDK** (`widget/`)
   - `WidgetRegistry` — registers widgets and routes DSL nodes.
   - `VariableStore` — reactive key-value store for cross-widget state.
   - Interfaces: `IWidget`, `ISceneElement`, `IRenderable`, `ILoadable`, `IDslComposite`, `IContainedModel`, `IAnimationController`, `IVariableProvider`.

6. **HUD** (`hud/`) — `HudOverlay`, `HudItem`, `HudPhaseContext`. Compiled by `compiler/hudCompiler.ts`.

7. **Labels** (`labels/`) — `LabelItem` (React), `LabelPositioner` (3D→screen). Compiled by `compiler/labelCompiler.ts`.

8. **Input** (`input/`)
   - `InputController` — scroll/direct-mode scene navigation.
   - `ActionInputController` — action-mapped input (camera orbit, dolly, canvas focus, etc.).
   - Types: `SceneNavInputMap`, `SceneInputControllerSpec`, `InputActionSpec`.

9. **Timeline** (`timeline/`) — Timeline algebra: stops, frame counts, tick steps, progress mapping.

10. **Math** (`math/`) — General math utilities.

---

### `packages/diagram/src/` — Diagram Extension

| Path | Contents |
|---|---|
| `elements/diagram/` | Full diagram element: `types.ts`, `dsl.tsx`, `compile.ts`, `render.ts`, `widget.ts` |
| `elements/diagram/compiler/` | Node, group, layout, transition, theme compilers |
| `elements/diagram/shapes/` | `geometryFactory`, `iconRegistry`, `shapeVariants`, `svgIcon3D` |
| `elements/diagram/themes/` | `darkGlass`, `enterprise`, `neonCyber`, `lightMinimal` |
| `elements/diagram/rendering/` | `NodeRenderer`, `EdgeRenderer`, `GroupRenderer`, `TextRenderer`, `IconLoader`, `EnvMapManager`, `InteractionRegistry` |
| `elements/diagram/canvas/` | `DiagramCanvas` orthographic 3D scene with camera orbit/dolly/focus |
| `elements/image-panel/` | 3D image panel with bezel, gloss, glow |
| `elements/screen/` | 3D screen element |
| `elements/_shared/` | Shared geometry helpers |
| `compiler/` | `handlers.ts` — registers diagram DSL node handlers |
| `lucid/` | Lucid diagram import utilities |

---

### `apps/examples/` — Demo App

Example scenes — **not published**, used for development and demonstration.

- Scene dirs: `diagram/`, `lucid/`, `complex/`, `simple/`, `meeting/`, `two-bots/`, `multi-animation/`
- Each has `scenes/` (declarative DSL files), `widgetSetup.ts`, `autoWidgetSetup.ts`
- `widgets/` — custom widget examples: `brain-model/`, `logo-rotator/`, `ribbon/`
- `siteResources.ts` — asset manifest; run `gen:scene-dsl` after changes
- `generated/` — auto-generated types (do not edit by hand)

---

## Key Design Rules

- **Entry transitions belong to the incoming scene**, not the outgoing one.
- **Three.js is confined to `render.ts` files** — nowhere else in the element stack.
- **Scenes are purely declarative** — state only; no animation math, no Three.js, no frame logic.
- **`compiler/index.ts` exports only the DSL authoring surface.** Infrastructure types import directly from source.
- **Widget classes are the runtime integration contract.** New renderable concepts implement `IWidget`.
- **No `any` or `unknown` without a justifying comment** in TypeScript strict mode.
- **`pnpm` exclusively.** No npm or yarn commands.

## Testing

- Tests in `__tests__/` co-located with code, named `*.test.ts` / `*.test.tsx`.
- **Interface-based stateful tests**: real inputs → real outputs. No spy-heavy mocking of internals.
- Runtime test doubles: `packages/core/src/runtime/mocks/`.
- `compile.ts` functions are pure — pass real inputs, assert real outputs. No mocks needed.
- Coverage targets: `packages/core/src/{compiler,elements,runtime,widget,player,hud,labels,input,timeline,math}/**/*.ts` and `packages/diagram/src/**/*.ts`. Excludes `render.ts` and barrel exports.

## Asset Pipeline

Scripts in `scripts/` at repo root:
- `gen-scene-dsl.mjs` — generate scene DSL types from `siteResources.ts`
- `sync-icons.mjs` — sync heroicons + simple-icons into diagram assets
- `gen-diagram-envmap.mjs` — regenerate diagram HDR environment map
- `extract-model-metadata.mjs` — extract metadata from GLTF
- `prune-dist.mjs` — post-build artifact cleanup
- `publish-core-diagram.mjs` — publish `@brewsite/core` and `@brewsite/diagram`

## Requirements and Documentation Policies

- PRDs: `requirements/prd/**` (source of truth per feature area)
- Plans: `requirements/plans/**` (authored by architect bot, archived when complete)
- Naming: `prd_`, `plan_`, `idea_`, `note_`, `playbook_`, `AGENTS.md`, `README.md`
- Front matter on all Markdown except AGENTS/README: `title`, `doc_type`, `owner`, `status`, `updated` (ISO date)
- `requirements/**/archive/**` is read-only without explicit approval
- Keep requirements synchronized with behavior changes

## Code Style

TypeScript strict mode, 2-space indentation, semicolons. Named exports preferred. `camelCase` for functions/variables, `PascalCase` for React components and types. Package manager is `pnpm` exclusively.
