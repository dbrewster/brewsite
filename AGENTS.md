# Repository Guidelines

## Project Structure & Module Organization
- `src/robot/` houses the core TypeScript + React implementation. Submodules include `engine/`, `runtime/`, `model/`, `elements/`, `annotations/`, and `scenes/`.
- Tests live alongside code in `__tests__/` directories (for example `src/robot/runtime/__tests__/`), with files named `*.test.ts` or `*.test.tsx`.
- Tooling and asset pipelines live in `scripts/` (GLTF/FBX conversion, metadata extraction, build helpers).
- Build configuration is in `vite.config.ts`, with TypeScript settings in `tsconfig.json`.

## Build, Test, and Development Commands
- `pnpm install`: install dependencies.
- `pnpm dev`: start the Vite dev server.
- `pnpm build`: run metadata extraction, TypeScript build, Vite build, and prune the `dist` output.
- `pnpm preview`: serve the production build locally.
- `pnpm typecheck`: run `tsc` in `--noEmit` mode.
- `pnpm test`: run the Vitest test suite once.
- `pnpm test:watch`: run Vitest in watch mode.
- `pnpm coverage`: run tests with coverage output.

## Coding Style & Naming Conventions
- TypeScript + React with strict type checking (`tsconfig.json` sets `strict: true`).
- Use 2-space indentation and semicolons, consistent with existing files like `src/robot/robotTimeline.ts`.
- Prefer named exports for modules; follow existing casing patterns (`camelCase` for functions, `PascalCase` for React components and types).

## Testing Guidelines
- Testing framework: Vitest.
- Place tests in `__tests__/` near the implementation and name files `*.test.ts` or `*.test.tsx`.
- When adding runtime or engine features, add at least one unit test and, if behavior spans modules, an integration test mirroring existing patterns in `src/robot/runtime/__tests__/`.

## Commit & Pull Request Guidelines
- Git history is minimal and does not establish a commit message convention. Use concise, imperative messages (for example `Add scene DSL compiler tests`).
- PRs should include a short summary, test command output (or note why tests were skipped), and screenshots or short clips for visual/3D output changes.

## Asset & Script Notes
- For model or animation changes, prefer existing helpers in `scripts/` (for example `scripts/extract-model-metadata.mjs` and conversion scripts) instead of ad-hoc pipelines.
- If you introduce new asset-processing steps, document the command and expected outputs in the PR description.
