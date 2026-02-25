---
title: Monorepo Migration — pnpm Workspaces + Turborepo
doc_type: plan
owner: architecture
status: active
updated: 2026-02-25
---

# Monorepo Migration Plan
## pnpm Workspaces + Turborepo: Single Package → Multi-Package Repository

---

## 1. Purpose and Motivation

The BrewSite repository currently ships as a single package (`@brewsite/core`) with examples
co-located at the root. As new capability packages are added — starting with `@brewsite/diagram`
— the single-package model becomes untenable:

- Consumers who want only the robot animation engine would install diagram rendering code they
  don't need.
- The build pipeline cannot express package-level dependency ordering.
- TypeScript cannot enforce the boundary between `core` and `diagram` at compile time.
- Test and build caches cannot be scoped per-package.

This plan migrates the repository to a **pnpm workspaces + Turborepo** monorepo with three
initial members:

| Package | Path | Published | Purpose |
|---|---|---|---|
| `@brewsite/core` | `packages/core/` | Yes | Robot animation engine (existing) |
| `@brewsite/diagram` | `packages/diagram/` | Yes | 3D diagram + Screen elements (new) |
| `@brewsite/examples` | `apps/examples/` | No | Dev/demo Vite application |

Turborepo provides task orchestration (dependency-aware build ordering, parallel test runs,
persistent caching).

---

## 2. Target Repository Structure

```
brewsite/                               ← repo root (private workspace orchestrator)
├── packages/
│   ├── core/                           ← @brewsite/core (existing src/ moves here)
│   │   ├── src/                        ← verbatim copy of current src/
│   │   │   ├── index.ts
│   │   │   ├── compiler/
│   │   │   ├── elements/
│   │   │   ├── hud/
│   │   │   ├── labels/
│   │   │   ├── math/
│   │   │   ├── player/
│   │   │   ├── runtime/
│   │   │   ├── timeline/
│   │   │   ├── types/
│   │   │   └── widget/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── tsconfig.build.json
│   │   ├── vite.config.ts              ← lib build only (no dev server)
│   │   └── vitest.config.ts            ← extracted from root vite.config.ts
│   │
│   └── diagram/                        ← @brewsite/diagram (new — see plan_diagram_package.md)
│       ├── src/
│       │   ├── index.ts
│       │   ├── elements/
│       │   │   ├── _shared/            ← bezelGeometry.ts, glowSprite.ts
│       │   │   ├── diagram/
│       │   │   ├── image-panel/
│       │   │   └── screen/
│       │   └── compiler/
│       │       └── handlers.ts
│       ├── public/
│       │   └── assets/
│       │       └── shapes/
│       │           ├── aws/
│       │           ├── gcp/
│       │           ├── azure/
│       │           └── flow/
│       ├── scripts/
│       │   └── import-lucid.mjs        ← build-time Lucid → DSL converter
│       ├── package.json
│       ├── tsconfig.json
│       ├── tsconfig.build.json
│       └── vitest.config.ts
│
├── apps/
│   └── examples/                       ← private Vite dev app (existing examples/ moves here)
│       ├── complex/
│       ├── generated/
│       ├── meeting/
│       ├── multi-animation/
│       ├── public/
│       ├── simple/
│       ├── two-bots/
│       ├── vite-app/
│       ├── widgets/
│       ├── siteResources.ts
│       ├── package.json                ← new (declares workspace deps)
│       └── vite.config.ts              ← adapted from examples/vite-app/vite.config.ts
│
├── scripts/                            ← repo-level tooling (stays at root)
│   ├── extract-model-metadata.mjs
│   ├── gen-scene-dsl.mjs
│   └── prune-dist.mjs
│
├── requirements/                       ← stays at root (product/plan docs)
├── pnpm-workspace.yaml                 ← new
├── turbo.json                          ← new
├── package.json                        ← new root (private, workspace scripts only)
├── tsconfig.json                       ← replaced with project-references root config
├── .npmrc                              ← new (workspace settings)
├── .gitignore                          ← updated to add Turborepo cache
├── CLAUDE.md
└── pnpm-lock.yaml                      ← regenerated after migration
```

---

## 3. Configuration Files — Full Content

### 3.1 `pnpm-workspace.yaml` (new at root)

```yaml
packages:
  - 'packages/*'
  - 'apps/*'
```

### 3.2 `.npmrc` (new at root)

```ini
# Hoist packages required by all workspaces (Three.js, React, Vite, TypeScript)
# so they resolve from the root node_modules rather than per-package.
# This avoids duplicate Three.js instances which would break shared Object3D identity.
public-hoist-pattern[]=*three*
public-hoist-pattern[]=*react*
public-hoist-pattern[]=*react-dom*

# Ensure peer dependencies are installed automatically in dev
auto-install-peers=true

# Strict peer dependency checking — surfaces version mismatches early
strict-peer-dependencies=false
```

> **Critical:** Three.js and React must be hoisted. Multiple instances of Three.js break shared
> `Object3D` identity (scene graph corruption). Multiple React instances cause hook errors.
> The `public-hoist-pattern` entries ensure a single copy lives in the root `node_modules`.

### 3.3 `turbo.json` (new at root)

```json
{
  "$schema": "https://turbo.build/schema.json",
  "ui": "tui",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "inputs": ["src/**", "tsconfig*.json", "vite.config.ts", "package.json"],
      "outputs": ["dist/**"]
    },
    "build:lib": {
      "dependsOn": ["^build:lib"],
      "inputs": ["src/**", "tsconfig*.json", "package.json"],
      "outputs": ["dist/**"]
    },
    "typecheck": {
      "dependsOn": ["^typecheck"],
      "inputs": ["src/**", "tsconfig*.json"]
    },
    "test": {
      "dependsOn": [],
      "inputs": ["src/**", "vitest.config.ts"],
      "outputs": []
    },
    "coverage": {
      "dependsOn": [],
      "inputs": ["src/**", "vitest.config.ts"],
      "outputs": ["coverage/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "gen:scene-dsl": {
      "inputs": ["siteResources.ts", "public/**"],
      "outputs": ["generated/**", "public/scene-manifest.json"]
    }
  }
}
```

**Task dependency semantics:**
- `"dependsOn": ["^build"]` — `build` must complete in all dependency packages before running
  in the current package (i.e., `core` builds before `diagram`, `diagram` builds before
  `examples`).
- `"dependsOn": []` — `test` runs independently per package with no ordering requirement.
  Allows full parallelism.
- `"cache": false` on `dev` — dev server must not be cached.

### 3.4 Root `package.json` (replaces current root package.json)

```json
{
  "name": "brewsite",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "build":     "turbo build",
    "build:lib": "turbo build:lib",
    "typecheck": "turbo typecheck",
    "test":      "turbo test",
    "coverage":  "turbo coverage",
    "dev":       "turbo dev --filter=@brewsite/examples",
    "gen:scene-dsl": "turbo gen:scene-dsl --filter=@brewsite/examples"
  },
  "devDependencies": {
    "turbo": "^2.3.0",
    "typescript": "^5.9.3"
  }
}
```

> The root package is private and has no `main`/`module`/`types` fields. It is purely
> an orchestration shim. Published packages define their own fields.

### 3.5 Root `tsconfig.json` (replaces current root tsconfig.json)

The root tsconfig becomes a **project references** file only. It does not compile any source
itself — it delegates to each package's build tsconfig. References point to `tsconfig.build.json`
files (which carry `"composite": true`) rather than to the development `tsconfig.json`
(which has `"noEmit": true`). TypeScript requires composite projects to emit, so `composite`
and `noEmit` must live in separate tsconfig files.

```json
{
  "files": [],
  "references": [
    { "path": "packages/core/tsconfig.build.json" },
    { "path": "packages/diagram/tsconfig.build.json" }
  ]
}
```

> `apps/examples` is intentionally omitted from the root references — it is a private dev
> app and does not need to be part of the `tsc -b` chain. Turbo runs its typecheck
> independently via its own `typecheck` script.

---

## 4. Package Configurations

### 4.1 `packages/core/package.json`

```json
{
  "name": "@brewsite/core",
  "version": "0.4.2",
  "private": false,
  "type": "module",
  "main": "./dist/index.js",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types":   "./dist/index.d.ts",
      "import":  "./dist/index.js",
      "default": "./dist/index.js"
    }
  },
  "files": ["dist", "LICENSE", "README.md"],
  "scripts": {
    "build":      "tsc -b tsconfig.build.json && vite build",
    "build:lib":  "tsc -p tsconfig.build.json",
    "typecheck":  "tsc --noEmit -p tsconfig.json",
    "test":       "vitest run",
    "test:watch": "vitest",
    "coverage":   "vitest run --coverage",
    "dev":        "vite build --watch"
  },
  "dependencies": {
    "animejs":        "^3.2.2",
    "meshoptimizer":  "^0.23.0",
    "react-router":   "^7.13.0"
  },
  "peerDependencies": {
    "react":     "^19.2.4",
    "react-dom": "^19.2.4",
    "three":     "^0.169.0"
  },
  "devDependencies": {
    "@babel/parser":            "^7.29.0",
    "@gltf-transform/cli":      "^4.3.0",
    "@gltf-transform/core":     "^4.3.0",
    "@gltf-transform/extensions": "^4.3.0",
    "@gltf-transform/functions": "^4.3.0",
    "@types/react":             "^19.2.14",
    "@types/react-dom":         "^19.2.3",
    "@types/three":             "^0.169.0",
    "@testing-library/react":   "^16.3.2",
    "@vitejs/plugin-react":     "^4.7.0",
    "@vitest/coverage-v8":      "^2.1.9",
    "jsdom":                    "^24.0.0",
    "typescript":               "^5.9.3",
    "vite":                     "^5.4.21",
    "vitest":                   "^2.1.9"
  }
}
```

### 4.2 `packages/core/tsconfig.json`

This is the **development tsconfig** — used by the IDE, Vitest, and the `typecheck` script.
It deliberately does NOT have `composite: true` (which would conflict with `noEmit: true`).
The `composite` flag lives only in `tsconfig.build.json`.

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@brewsite/core": ["src/index.ts"]
    },
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": false,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist", "**/__tests__/**", "**/*.test.*"]
}
```

> **`noEmit: true` and `composite: true` cannot coexist.** TypeScript requires composite
> projects to emit declaration files, but `noEmit` suppresses all output — a direct
> contradiction that causes a hard TypeScript error. The solution: `noEmit: true` stays in
> `tsconfig.json` (development/typecheck config); `composite: true` goes in
> `tsconfig.build.json` (build config). The `typecheck` script uses `tsc --noEmit -p
> tsconfig.json`; the build script uses `tsc -p tsconfig.build.json`.

### 4.3 `packages/core/tsconfig.build.json`

This is the **build tsconfig** — used by `tsc -p tsconfig.build.json` and referenced by
other packages via project references. It carries `composite: true` and overrides
`noEmit: false` (inherited from `tsconfig.json`).

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "composite": true,
    "noEmit": false,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist", "**/__tests__/**", "**/*.test.*"]
}
```

> `composite: true` here enables project references — other packages reference this file
> specifically (e.g. `{ "path": "../../packages/core/tsconfig.build.json" }`).
> `noEmit: false` overrides the `true` value inherited from `tsconfig.json`.

### 4.4 `packages/core/vite.config.ts`

This is the library build config only (no dev server — dev server lives in `apps/examples`).

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      formats: ['es'],
      fileName: 'index',
    },
    rollupOptions: {
      external: ['react', 'react-dom', 'three', 'react-router'],
      output: {
        preserveModules: true,
        preserveModulesRoot: 'src',
      },
    },
    sourcemap: true,
  },
  resolve: {
    alias: {
      '@brewsite/core': resolve(__dirname, 'src/index.ts'),
    },
  },
});
```

### 4.5 `packages/core/vitest.config.ts`

Extracted from the current root `vite.config.ts` test block:

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@brewsite/core': resolve(__dirname, 'src/index.ts'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/__tests__/**/*.test.{ts,tsx}'],
    exclude: ['src/legacy'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json'],
      reportsDirectory: './coverage',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/__tests__/**',
        'src/runtime/mocks/**/*.ts',
        'src/elements/**/render.ts',
        'src/elements/**/ModelRenderer.ts',
        'src/labels/render.ts',
        'src/**/index.ts',
        'src/legacy',
      ],
    },
  },
});
```

### 4.6 `apps/examples/package.json`

```json
{
  "name": "@brewsite/examples",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev":           "vite --config vite.config.ts",
    "build":         "pnpm gen:scene-dsl && vite build",
    "preview":       "vite preview",
    "typecheck":     "tsc --noEmit -p tsconfig.json",
    "test":          "vitest run",
    "test:watch":    "vitest",
    "gen:scene-dsl": "node ../../scripts/gen-scene-dsl.mjs --input siteResources.ts --out-dir generated --asset-root public --manifest-out public/scene-manifest.json"
  },
  "dependencies": {
    "@brewsite/core":    "workspace:*",
    "@brewsite/diagram": "workspace:*",
    "react":     "^19.2.4",
    "react-dom": "^19.2.4",
    "three":     "^0.169.0"
  },
  "devDependencies": {
    "@types/react":       "^19.2.14",
    "@types/react-dom":   "^19.2.3",
    "@types/three":       "^0.169.0",
    "@vitejs/plugin-react": "^4.7.0",
    "typescript":         "^5.9.3",
    "vite":               "^5.4.21"
  }
}
```

> `"workspace:*"` is pnpm's workspace protocol. It resolves to the local workspace package
> during development and to the published version during release.

### 4.7 `apps/examples/vite.config.ts`

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    dedupe: ['react', 'react-dom', 'three'],
    alias: {
      // During local development, resolve workspace packages from source
      // rather than built dist/ — enables hot reload across packages.
      '@brewsite/core':    resolve(__dirname, '../../packages/core/src/index.ts'),
      '@brewsite/diagram': resolve(__dirname, '../../packages/diagram/src/index.ts'),
    },
  },
  server: {
    host: true,
    port: 5173,
    allowedHosts: ['localhost', '127.0.0.1'],
  },
  // Asset serving for diagram shape icons
  publicDir: 'public',
});
```

> **Dev alias strategy:** In development, the examples app aliases workspace packages to
> their TypeScript source entry points. This means edits to `packages/core/src/` hot-reload
> immediately in the examples dev server without requiring a build step. In production builds
> (CI), the aliases are removed and the built `dist/` is used via normal package resolution.
>
> This is the standard Turborepo pattern for TypeScript monorepos and avoids the
> `build-to-dev-to-build` loop that plagues naive monorepo setups.

### 4.8 `apps/examples/tsconfig.json`

`apps/examples` is a consumer, not a published library. It does NOT need `composite: true`.
References point explicitly at `tsconfig.build.json` in each package (where `composite: true`
lives) so TypeScript can resolve types from source during development.

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@brewsite/core":    ["../../packages/core/src/index.ts"],
      "@brewsite/diagram": ["../../packages/diagram/src/index.ts"]
    },
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": false,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true
  },
  "references": [
    { "path": "../../packages/core/tsconfig.build.json" },
    { "path": "../../packages/diagram/tsconfig.build.json" }
  ],
  "include": ["."],
  "exclude": ["node_modules", "dist", "generated"]
}
```

### 4.9 `apps/examples/vitest.config.ts`

After migration, any tests in `apps/examples/` need their own vitest config or turbo's `test`
task will silently skip them. The current root `vite.config.ts` includes
`'examples/**/__tests__/**/*.test.{ts,tsx}'` in test inputs — those tests must remain reachable.

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@brewsite/core':    resolve(__dirname, '../../packages/core/src/index.ts'),
      '@brewsite/diagram': resolve(__dirname, '../../packages/diagram/src/index.ts'),
    },
  },
  test: {
    environment: 'node',
    include: ['**/__tests__/**/*.test.{ts,tsx}'],
    exclude: ['node_modules', 'dist', 'generated'],
  },
});
```

---

## 5. Migration Execution Steps

Execute these steps **in order**. Each step is independently verifiable before proceeding.

### Step 0 — Prerequisites

```bash
# Ensure pnpm ≥ 9.x is installed (workspace protocol requires 9+)
pnpm --version

# Install Turborepo globally for CLI access during migration
pnpm add -g turbo

# Ensure you are on a clean git branch
git checkout -b feat/monorepo-migration
git status  # should be clean
```

### Step 1 — Create Workspace Config Files at Root

Create the following new files at the repo root (content from Section 3 above):
- `pnpm-workspace.yaml`
- `.npmrc`

Do NOT create `turbo.json` or update `package.json` yet — those come later.

**Verify:** `cat pnpm-workspace.yaml` shows the packages/apps globs.

### Step 2 — Create Package Directory Structure

```bash
mkdir -p packages/core
mkdir -p packages/diagram
mkdir -p apps/examples
```

### Step 3 — Copy Core Source Into packages/core/

```bash
# Create the destination directory first (required for the copy idiom below)
mkdir -p packages/core/src

# Copy all contents of src/ including hidden files.
# The trailing /. ensures we copy CONTENTS, not the directory itself.
# This avoids the platform-inconsistent behavior of cp -r src/ dest/
cp -r src/. packages/core/src/

# Verify the copy — should list the same subdirectories as the current src/
ls packages/core/src/
# Expected: annotations/ compiler/ elements/ hud/ labels/ math/ player/ runtime/ timeline/ types/ widget/ index.ts
```

> Do not `mv` yet — keep the original `src/` in place until the migration is verified.
> We are working from copies until Step 14.

### Step 4 — Create packages/core Config Files

Write the following files using the full content specified in Section 4:
- `packages/core/package.json`       (Section 4.1)
- `packages/core/tsconfig.json`      (Section 4.2) — dev config, `noEmit: true`, no composite
- `packages/core/tsconfig.build.json` (Section 4.3) — build config, `composite: true`
- `packages/core/vite.config.ts`     (Section 4.4) — lib-only build, no dev server
- `packages/core/vitest.config.ts`   (Section 4.5) — extracted from root vite.config.ts test block

> **Do not copy the root `tsconfig.build.json` directly** — the new `packages/core/tsconfig.build.json`
> is different: it adds `composite: true`, removes the old `moduleResolution` duplicate,
> and tightens `exclude` to remove the now-irrelevant `examples/` and `scripts/` entries.

**Verify:** `cat packages/core/package.json | jq .name` prints `"@brewsite/core"`.

### Step 5 — Copy Examples Into apps/examples/

```bash
# Create the destination directory first
mkdir -p apps/examples

# Copy all example content including hidden files
cp -r examples/. apps/examples/

# The old examples/vite-app/vite.config.ts remains (copied in) but is superseded
# by the new top-level apps/examples/vite.config.ts we create next.
```

Create:
- `apps/examples/package.json`
- `apps/examples/vite.config.ts`
- `apps/examples/tsconfig.json`

**Verify:** `ls apps/examples/` shows simple/, complex/, meeting/, etc.

### Step 6 — Create packages/diagram Skeleton

Create the directory structure only (full implementation is `plan_diagram_package.md`):

```bash
# Element modules (three elements + shared utilities)
mkdir -p packages/diagram/src/elements/_shared
mkdir -p packages/diagram/src/elements/diagram
mkdir -p packages/diagram/src/elements/image-panel
mkdir -p packages/diagram/src/elements/screen

# Compiler handler registration
mkdir -p packages/diagram/src/compiler

# Shape icon assets
mkdir -p packages/diagram/public/assets/shapes/aws
mkdir -p packages/diagram/public/assets/shapes/gcp
mkdir -p packages/diagram/public/assets/shapes/azure
mkdir -p packages/diagram/public/assets/shapes/flow

# Lucid import script (at package root, NOT inside src/)
mkdir -p packages/diagram/scripts
```

Create `packages/diagram/src/index.ts` with a placeholder export:
```typescript
// @brewsite/diagram — 3D immersive diagram and screen elements
// Full implementation: see requirements/plans/plan_diagram_package.md
export {};
```

Create `packages/diagram/package.json` (see Section 5 of plan_diagram_package.md for the full
content once the diagram package is implemented).

**Minimal skeleton for the migration to proceed:**
```json
{
  "name": "@brewsite/diagram",
  "version": "0.1.0",
  "private": false,
  "type": "module",
  "main": "./dist/index.js",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types":   "./dist/index.d.ts",
      "import":  "./dist/index.js",
      "default": "./dist/index.js"
    }
  },
  "scripts": {
    "build":      "tsc -p tsconfig.build.json",
    "typecheck":  "tsc --noEmit -p tsconfig.json",
    "test":       "vitest run",
    "test:watch": "vitest",
    "coverage":   "vitest run --coverage"
  },
  "dependencies": {
    "@brewsite/core": "workspace:*"
  },
  "peerDependencies": {
    "react":     "^19.2.4",
    "react-dom": "^19.2.4",
    "three":     "^0.169.0"
  },
  "devDependencies": {
    "@types/react":         "^19.2.14",
    "@types/react-dom":     "^19.2.3",
    "@types/three":         "^0.169.0",
    "@vitejs/plugin-react": "^4.7.0",
    "@vitest/coverage-v8":  "^2.1.9",
    "typescript":           "^5.9.3",
    "vite":                 "^5.4.21",
    "vitest":               "^2.1.9"
  }
}
```

Create `packages/diagram/tsconfig.json` (development config — no `composite`):
```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@brewsite/core":    ["../../packages/core/src/index.ts"],
      "@brewsite/diagram": ["src/index.ts"]
    },
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": false,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noFallthroughCasesInSwitch": true
  },
  "references": [
    { "path": "../../packages/core/tsconfig.build.json" }
  ],
  "include": ["src"],
  "exclude": ["node_modules", "dist", "**/__tests__/**", "**/*.test.*"]
}
```

> References point to `packages/core/tsconfig.build.json` — the composite-enabled config.
> Pointing at a directory (e.g. `../../packages/core`) would resolve to that directory's
> `tsconfig.json`, which has `noEmit: true` and no `composite`, causing a TypeScript error:
> "Referenced project must have setting composite: true."

Create `packages/diagram/tsconfig.build.json` (build config — carries `composite`):
```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "composite": true,
    "noEmit": false,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist", "**/__tests__/**", "**/*.test.*"]
}
```

### Step 7 — Update Root package.json

Replace the root `package.json` with the workspace orchestration version (Section 3.4). Key
changes from the current version:
- Remove `name: "@brewsite/core"` → replace with `name: "brewsite"`
- Remove `main`, `module`, `types`, `exports`, `files` fields
- Remove all non-workspace dependencies (they move to packages/core)
- Add `turbo` as a devDependency
- Replace `scripts` with workspace-delegating turbo scripts

### Step 8 — Update Root tsconfig.json

Replace root `tsconfig.json` with the project references version (Section 3.5).

### Step 9 — Create turbo.json

Create `turbo.json` at root (Section 3.3).

### Step 9b — Update `.gitignore`

Append the following to the root `.gitignore`:

```bash
cat >> .gitignore << 'EOF'

# Turborepo
.turbo

# Per-package build outputs
packages/*/dist/
apps/*/dist/
EOF
```

**Verify:** `cat .gitignore | grep turbo` shows the new entries.

### Step 10 — Install Dependencies

```bash
# From repo root — pnpm will wire up workspace symlinks for all packages
pnpm install
```

This regenerates `pnpm-lock.yaml`. The workspace packages will be symlinked in each package's
`node_modules/@brewsite/`. Verify with:

```bash
ls packages/diagram/node_modules/@brewsite/
# Should show: core -> ../../../packages/core
```

### Step 11 — Verify TypeScript

```bash
# Type-check all packages from root
turbo typecheck

# Or individually to isolate issues
pnpm --filter @brewsite/core typecheck
pnpm --filter @brewsite/diagram typecheck
pnpm --filter @brewsite/examples typecheck
```

Fix any path-alias issues before proceeding. Common issues:
- Imports using the old root-relative `../../src/` paths in examples — update to `@brewsite/core`
- Type resolution errors where `@brewsite/core` is not found — check `paths` aliases in
  each package's `tsconfig.json` and verify `composite: true` is in `packages/core/tsconfig.build.json`
- `"Referenced project must have setting composite: true"` — means a `references` entry
  points at a `tsconfig.json` instead of `tsconfig.build.json`; fix the path

### Step 12 — Verify Tests

```bash
# Run all tests from root
turbo test

# Or per-package
pnpm --filter @brewsite/core test
```

Existing tests in `src/` should all pass unchanged from `packages/core/src/`.

### Step 13 — Verify Dev Server

```bash
# Start the examples dev server
pnpm dev
# OR
turbo dev --filter=@brewsite/examples
```

Navigate to `http://localhost:5173` and verify examples load correctly.

### Step 14 — Remove Old Source Locations

Only after Steps 11–13 all pass:

```bash
# Remove the original src/ (now lives at packages/core/src/)
rm -rf src/

# Remove the original examples/ (now lives at apps/examples/)
rm -rf examples/

# Remove the old root vite.config.ts (replaced by package-level configs)
rm vite.config.ts

# Remove the old root tsconfig.build.json (replaced by package-level configs)
rm tsconfig.build.json
```

### Step 15 — Final Verification

```bash
# Full build pipeline from root
turbo build

# All tests
turbo test

# Type checking
turbo typecheck

# Dev server smoke test
pnpm dev
```

Commit if everything passes:
```bash
git add -A
git commit -m "feat: migrate to pnpm workspaces + Turborepo monorepo

- packages/core: existing @brewsite/core library
- packages/diagram: new @brewsite/diagram skeleton
- apps/examples: examples Vite app
- Root orchestrates via turbo.json pipelines

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## 6. TypeScript Project References — Why and How

TypeScript project references (`"composite": true` + `"references": [...]`) give us:

1. **Type-safe cross-package imports** — TypeScript reads the referenced package's source
   directly, not just the built `dist/`.
2. **Incremental builds** — `tsc --build` only recompiles packages whose inputs changed.
3. **Correct dependency ordering** — `tsc --build` respects the reference graph.

### The Two-Config Pattern (critical)

TypeScript has a hard constraint: **`composite: true` and `noEmit: true` cannot coexist**.
Composite requires the project to emit `.d.ts` files; `noEmit` suppresses all output.
This forces a two-config split in every published package:

| File | Purpose | Key flags |
|---|---|---|
| `tsconfig.json` | IDE, Vitest, `typecheck` script | `noEmit: true`, no composite |
| `tsconfig.build.json` | Library builds, project references | `composite: true`, `noEmit: false`, `declaration: true` |

All `"references"` entries in this repo point to `tsconfig.build.json` files, never to
`tsconfig.json` — because the latter isn't composite and TypeScript would error:
`"Referenced project must have setting composite: true"`.

### The Reference Graph

```
apps/examples/tsconfig.json
  └── references packages/core/tsconfig.build.json
  └── references packages/diagram/tsconfig.build.json

packages/diagram/tsconfig.json
  └── references packages/core/tsconfig.build.json

packages/diagram/tsconfig.build.json
  └── (inherits references from tsconfig.json via extends)

packages/core/tsconfig.build.json
  └── (no references — leaf node)

root tsconfig.json  [tsc -b entry point]
  └── references packages/core/tsconfig.build.json
  └── references packages/diagram/tsconfig.build.json
```

`apps/examples` is excluded from the root `tsc -b` graph — it is a dev app, not a library,
and Turbo runs its typecheck independently.

---

## 7. pnpm Workspace Protocol Semantics

In workspace package.json files, `"@brewsite/core": "workspace:*"` means:

- **During development** (local `pnpm install`): resolves to the local `packages/core/`
  directory via a symlink.
- **During publish** (e.g., `pnpm publish`): pnpm replaces `workspace:*` with the actual
  published version number (e.g., `"^0.4.2"`) in the tarball. The consumer sees a normal
  semver range.

This means published packages never contain `workspace:` references — they work as normal npm
packages for external consumers.

---

## 8. Turborepo Caching Behavior

Turbo caches task outputs by hashing inputs. Configure `.gitignore` to exclude the cache:

```gitignore
# Turborepo
.turbo

# Per-package build outputs (already covered by dist/)
packages/*/dist/
apps/*/dist/
```

The cache lives in `.turbo/` at the repo root by default. With a remote cache (Vercel or
self-hosted) configured, this extends to CI — identical builds across machines are retrieved
from cache rather than re-executed.

For CI, add to turbo.json:
```json
{
  "remoteCache": {
    "signature": true
  }
}
```

This is optional for initial migration but highly recommended for CI speed once established.

---

## 9. Turborepo Filter Syntax Reference

Common commands after migration:

```bash
# Run a task in one package only
turbo build --filter=@brewsite/core
turbo test  --filter=@brewsite/diagram

# Run a task in a package and all its dependencies
turbo build --filter=@brewsite/examples...

# Run a task in packages that have changed since main
turbo test --filter=[main]

# Run the dev server (examples app only)
turbo dev --filter=@brewsite/examples

# Pass pnpm args through
pnpm --filter @brewsite/core add lodash-es
```

---

## 10. Known Risks and Mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| Duplicate Three.js instances | High without `.npmrc` | `public-hoist-pattern[]=*three*` in `.npmrc` ensures single copy |
| Duplicate React instances | High without `.npmrc` | `public-hoist-pattern[]=*react*` same pattern |
| `composite: true` + `noEmit: true` conflict | Certain if mixed | Two-config split: `composite` in `tsconfig.build.json` only; `noEmit` in `tsconfig.json` only |
| References pointing at non-composite tsconfig | High if paths wrong | All `references` entries explicitly point to `tsconfig.build.json`, never bare directories |
| Vite dev server not resolving workspace packages | Medium | Explicit alias in `apps/examples/vite.config.ts` pointing to `src/index.ts` |
| TypeScript not finding cross-package types | Medium | Project references via `tsconfig.build.json` + `paths` aliases in each tsconfig |
| pnpm-lock.yaml conflicts on team | Low | Regenerate via `pnpm install` after merge; do not hand-edit |
| Scripts using relative paths to `../../scripts/` | Low | Paths updated in `apps/examples/package.json` — verify with `pnpm gen:scene-dsl` |
| tsconfig `include` picking up wrong files | Medium | Explicit `include`/`exclude` in each package tsconfig |
| Examples tests lost after migration | Medium | `apps/examples/vitest.config.ts` (Section 4.9) picks up tests in `apps/examples/**/__tests__/` |
| Turbo not finding vitest config | Low | Turbo's `test` task inputs include `vitest.config.ts`; each package has its own |
| `.turbo/` cache directory not gitignored | Low | Step 9b appends `.turbo` to `.gitignore` before first `pnpm install` |

---

## 11. Post-Migration CLAUDE.md Updates

After migration is complete, update `CLAUDE.md` with:

1. **Updated commands** — all top-level commands delegate through `turbo`:
   ```bash
   pnpm dev            # turbo dev --filter=@brewsite/examples
   pnpm build          # turbo build
   pnpm test           # turbo test
   pnpm typecheck      # turbo typecheck
   ```

2. **Updated architecture paths** — all paths now under `packages/core/src/` and
   `packages/diagram/src/`.

3. **Filter flags for per-package work:**
   ```bash
   pnpm --filter @brewsite/core test:watch
   pnpm --filter @brewsite/diagram typecheck
   ```

4. **Package dependency rule** — `@brewsite/diagram` depends on `@brewsite/core` as a
   workspace dependency. Code in `packages/diagram/` may import from `@brewsite/core`
   but never vice-versa.

---

## 12. Future Package Additions

To add a fourth package (e.g., `@brewsite/timeline-editor`):

1. Create `packages/timeline-editor/` with the standard structure:
   - `package.json`, `tsconfig.json` (noEmit, no composite), `tsconfig.build.json` (composite)
   - `src/index.ts`, `vitest.config.ts`
2. Add to `pnpm-workspace.yaml` (already covered by the `packages/*` glob — no change needed)
3. Add `{ "path": "packages/timeline-editor/tsconfig.build.json" }` to root `tsconfig.json` references
4. If `apps/examples` consumes it:
   - Add `"@brewsite/timeline-editor": "workspace:*"` to `apps/examples/package.json` dependencies
   - Add `{ "path": "../../packages/timeline-editor/tsconfig.build.json" }` to `apps/examples/tsconfig.json` references
   - Add `'@brewsite/timeline-editor': resolve(__dirname, '../../packages/timeline-editor/src/index.ts')` to `apps/examples/vite.config.ts` aliases
5. Run `pnpm install` to wire workspace symlinks

The monorepo structure is designed to be additive — new packages slot in without touching
existing package configurations.
