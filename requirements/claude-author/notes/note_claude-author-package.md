---
title: "PM Note: @brewsite/claude-author Package"
doc_type: note
owner: Toolkit Product
status: implemented
last_updated: 2026-03-15
change_history:
  - date: 2026-03-15
    author: "Toolkit Product"
    summary: "Initial note created. Defined scope, delivery mechanism, MCP server architecture, search stack, build pipeline, package structure, and monorepo integration."
  - date: 2026-03-15
    author: "PM-1 / PM-2 Debate"
    summary: "Applied 15 amendments from PM review: fixed root package name collision, reversed scaffolder dependency on claude-author (shell exec instead of import), specified ONNX backend + esbuild externals, added @brewsite/screens to inventory, eliminated tsx runtime dependency (pre-built .js entry), added turbo.json cache override, documented package size, added git hygiene for orama-index.json, fixed esbuild multi-entry build, documented templates/ directory, added screens to scaffolder, specified starter scene constraints, added .gitignore guidance."
---

# PM Note: `@brewsite/claude-author` Package

## Overview

This note captures all product decisions made for the `@brewsite/claude-author` package and the `create-brewsite` / `brewsite` CLI tooling that scaffolds it into developer projects. It is intended to give the architect everything needed to write the implementation plan.

---

## What This Is

`@brewsite/claude-author` is a new published npm package in the BrewSite monorepo. Its sole purpose is to give developers using the BrewSite toolkit an AI-powered documentation assistant that works natively inside Claude Code. When installed, it registers an MCP (Model Context Protocol) server that Claude Code launches automatically on project open. That MCP server allows Claude to search and retrieve BrewSite documentation in real time, in-process, with no external services, no API keys, and no configuration required from the developer.

This is a **developer tooling package**, not a runtime package. It is never imported into application code. It is installed as a dev dependency and its only integration surface is the MCP server it exposes to Claude Code.

---

## The Problem It Solves

Developers integrating the BrewSite toolkit work with a non-trivial API surface: the scene DSL, the compiler pipeline, the widget SDK, the element module pattern, diagram elements, model labels, input controllers, and more. Without in-context documentation, Claude (and the developer) must rely on memory, source code spelunking, or context window exhaustion from pasting large README sections. `claude-author` eliminates this by making the full toolkit documentation available as a first-class, queryable knowledge source directly in Claude's tool loop.

---

## Delivery Mechanism: npx Scaffolders

The toolkit is delivered via three CLI entry points. None require a global install.

### `create-brewsite` (new project scaffolding)

```bash
npx create-brewsite@latest
```

The primary entry point for developers starting a new BrewSite project. It runs interactively and is responsible for:

1. Prompting the developer to select which BrewSite modules to install (`@brewsite/core` is always required; `@brewsite/diagram`, `@brewsite/model`, `@brewsite/charts`, `@brewsite/screens` are optional).
2. Installing the selected packages as dependencies.
3. Installing `@brewsite/claude-author` as a dev dependency in the scaffolded project.
4. Creating a starter scene file (see Starter Scene below).
5. Generating or updating `tsconfig.json` if needed.
6. Running `npx @brewsite/claude-author init` as a child process to complete the Claude Code setup.

`create-brewsite` does **not** write anything under `.claude/` or touch `.mcp.json`. That responsibility belongs exclusively to `claude-author`.

**Critical constraint:** `create-brewsite` must NOT depend on `@brewsite/claude-author` as a direct npm dependency. The `claude-author` package bundles a ~65MB ONNX model, and making it a dependency would cause `npx create-brewsite@latest` to download 65MB+ before the scaffolder even starts. Instead, `create-brewsite` installs `claude-author` into the target project's `node_modules` first, then shells out to `npx @brewsite/claude-author init`. This keeps the scaffolder itself lightweight (sub-1MB).

### Starter Scene

The starter scene file created by `create-brewsite` is a minimal, working BrewSite scene that the developer can run immediately. It must import `Scene` from `@brewsite/core` and render at minimum a background and camera. The architect designs the exact template content, but it must be a valid, renderable scene that demonstrates the basic DSL pattern. The starter scene should be TypeScript (`.tsx`) and placed at a conventional path like `src/scenes/intro.tsx`.

### `@brewsite/claude-author init` (Claude Code setup)

```bash
npx @brewsite/claude-author init
```

`claude-author` has its own npx entry point that owns all Claude Code integration. It is responsible for:

1. Writing `.mcp.json` at the project root (merging if one already exists).
2. Creating `.claude/mcp-servers/brewsite-docs.js` — the one-liner MCP server entry point (pre-built JavaScript, not TypeScript — see MCP Server Architecture below).
3. Creating `.claude/agents/brewsite-scene-author.md` — the scene authoring agent definition.

This command is called by `create-brewsite` automatically on new project setup, and can be run independently by developers adding `claude-author` to an existing project. It is idempotent — running it twice does not duplicate or overwrite existing config.

### `brewsite add` (additive, for existing projects)

```bash
npx brewsite add diagram
npx brewsite add model
npx brewsite add screens
npx brewsite add claude-author
```

The entry point for developers adding BrewSite modules to an existing project. `brewsite add claude-author` installs the package and then runs `npx @brewsite/claude-author init` as a child process to handle the `.claude/` setup. All `.claude/` writes remain owned by `claude-author`.

**Critical constraint:** Like `create-brewsite`, the `brewsite` CLI must NOT depend on `@brewsite/claude-author` as a direct npm dependency. It installs `claude-author` into the target project and shells out. Same rationale: avoid 65MB+ download for a lightweight CLI tool.

### Manual Setup

Full manual setup instructions must be included in `claude-author`'s documentation. Some developers work in environments where `npx` scaffolding scripts are restricted (CI, corporate proxies, custom monorepos). The manual path is a first-class supported option. The architect must include the manual instructions document as part of the deliverable.

### Version Control Guidance

Files created by `claude-author init` should be committed to the developer's repository so all team members get the MCP server and agent definition automatically:

- `.mcp.json` — commit (team members need it for Claude Code to discover the MCP server)
- `.claude/agents/brewsite-scene-author.md` — commit (team members need the agent definition)
- `.claude/mcp-servers/brewsite-docs.js` — commit (it's a one-liner with no secrets; team members need it)

The architect should include this guidance in the manual setup docs and optionally as console output after `init` runs.

---

## MCP Server Architecture

### Transport

The MCP server uses **stdio transport**. Claude Code launches it as a child process by reading `.mcp.json` at the project root. This is a project-scoped MCP registration, meaning it only activates for projects that have `@brewsite/claude-author` installed.

### `.mcp.json` (written by the scaffolder)

The scaffolder writes a `.mcp.json` at the project root. The command uses `node` (not `tsx`) to run the pre-built `.claude/mcp-servers/brewsite-docs.js` entry point. Since the MCP server is esbuild-bundled into `dist/server.js` at publish time, the scaffolded `.js` one-liner simply requires the pre-built server — no TypeScript compilation at runtime. This eliminates `tsx` as a runtime dependency entirely. All required environment is self-contained — no env vars needed from the user.

### MCP Tool Surface

The architect should design the exact tool signatures, but the product requirement is that Claude can:

- Search documentation by natural language query (semantic + full-text hybrid)
- Retrieve a specific document or section by identifier
- List available topic areas (for discovery)

The MCP server should be fast to respond. Startup time (the time from Claude Code launching the process to the server being ready) must be under 500ms on a warm cache. Cold start (first ever launch, model not yet loaded) is acceptable to be slower but should complete without timing out.

---

## Search Stack

### In-Process, Zero External Services

The search stack runs entirely in-process inside the MCP server. There is no Qdrant instance, no Docker container, no network call, no external database. Everything the server needs is bundled in the package.

### Orama

[Orama](https://github.com/oramasearch/orama) is the search engine. It is pure TypeScript, zero native dependencies, and supports full-text (BM25), vector, and hybrid search in the same API. The pre-built index is serialized as a JSON file and loaded into memory at server startup. The architect should evaluate whether to use Orama's native serialization format or a custom one.

### Embedding Model: `nomic-embed-text-v1.5`

The embedding model is `nomic-embed-text-v1.5` in int4 quantized ONNX format (~65MB). This model is **bundled directly in the npm package** under `packages/claude-author/models/nomic-embed-text-v1.5/`. It is not downloaded at runtime. The ONNX files are committed to the repo and shipped with the package.

The model supports an **8,192-token context window**, which is essential for indexing long documentation sections without truncation. `all-MiniLM-L6-v2` was rejected for this reason — its 256-token max would silently truncate most real documentation chunks.

The model is accessed via `@huggingface/transformers`. The server must configure `env.localModelPath` to point at the bundled model directory and set `env.allowRemoteModels = false` to prevent any attempt to reach the HuggingFace Hub.

**ONNX Runtime Backend:** The server uses `onnxruntime-node` (native bindings) for inference performance. This is a local dev tool where startup time and query latency matter more than portability. The `onnxruntime-node` package contains platform-specific native binaries (`.node` files) that cannot be bundled by esbuild — they must be marked as external in the esbuild configuration (see Build Tooling below). The WASM backend (`onnxruntime-web`) is not used in v1 but could be evaluated as a fallback in a future version if platform compatibility issues arise.

The model is used exclusively for **query-time embedding** — embedding the developer's search query as a vector so it can be compared against the pre-built vector index. Document embeddings are pre-computed at publish time (see Build Pipeline below).

**Task Prefixes (required):** `nomic-embed-text-v1.5` was trained with task-specific input prefixes and retrieval quality degrades meaningfully without them. The build script must prefix every document chunk with `search_document: ` before embedding. The MCP server must prefix every incoming query with `search_query: ` before embedding. This is not optional.

### Hybrid Search

The search mode should be hybrid (BM25 + vector combined). For a technical English corpus with precise API terminology, full-text alone will satisfy most queries. Vector search handles the conceptual queries ("how do transitions work") that keyword search misses. Hybrid gives both.

---

## Build Pipeline: Pre-Baked Index

### Philosophy

Document embeddings are computed **once, at publish time**, by the BrewSite team. They are never recomputed on the developer's machine. This is possible because the docs corpus is fixed between releases. The pre-built index ships as a file inside the npm package.

### Ownership: Part of the `claude-author` Package Build

The index build is the `build` script for `packages/claude-author/` in `package.json`. It is not a root-level script and not part of the Turborepo pipeline for other packages. When `pnpm build` runs for `@brewsite/claude-author`, it produces `index/orama-index.json`. The Turborepo pipeline should include `@brewsite/claude-author` in the standard `build` task graph so it participates in `pnpm build` from the root like every other package.

**Turborepo cache configuration:** The default `build` task in `turbo.json` declares `outputs: ["dist/**"]`. Since `claude-author`'s build also produces `index/orama-index.json`, the architect must add a package-specific task override in `turbo.json` for `@brewsite/claude-author#build` with `outputs: ["dist/**", "index/**"]`. Without this, Turborepo will not cache the generated index and will silently skip it on incremental builds.

### What the Build Script Does

The build script lives at `packages/claude-author/scripts/build-index.mjs` and is invoked by the `build` entry in `packages/claude-author/package.json`. It performs the following steps:

1. Reads all Markdown files from `packages/claude-author/docs/`
2. Chunks each file by `##` section headers — each section becomes one chunk. Every chunk must carry the following metadata stored alongside it in the Orama index:
   - `filePath` — relative path from `docs/`, e.g. `core/input-dsl.md`
   - `heading` — the exact `##` section heading text, e.g. `WheelMap`
   - `title` — the top-level `#` document title
   When Claude retrieves a chunk it must be able to report "this came from `core/input-dsl.md` → `## WheelMap`" so it knows what to do with the content. Chunks without this provenance are significantly less useful.
3. Prepends `search_document: ` to each chunk's text content before embedding (required by `nomic-embed-text-v1.5` — see task prefix requirement above)
4. Embeds each prefixed chunk using `nomic-embed-text-v1.5` (same model used at query time — they must match)
5. Builds an Orama index with both the text content, the vector embeddings, and the chunk metadata
6. Serializes the index to `packages/claude-author/index/orama-index.json`

The `orama-index.json` file is committed to the repository. It is a generated artifact, but committing it means no developer cloning the repo needs to run a build step to have a working package. Add a note in `CONTRIBUTING.md` that it must be regenerated before publishing whenever docs change.

**Git LFS (required):** The ONNX model file (`model_quantized.onnx`) is ~65MB. GitHub warns at 50MB and hard-blocks at 100MB. The file must be tracked with Git LFS. The architect must add the following to the repo's `.gitattributes` before committing the model:

```
packages/claude-author/models/**/*.onnx filter=lfs diff=lfs merge=lfs -text
```

Git LFS must be initialised in the repo (`git lfs install`) and the LFS tracking must be in place before the ONNX file is first added. If the file is committed to regular git history first it must be purged with `git lfs migrate` — doing it in the wrong order is painful.

**Git hygiene for the index:** The generated `orama-index.json` is several MB but well under the 50MB threshold so it does not need LFS. It will however produce noisy diffs. Add a `.gitattributes` entry to suppress diff output:

```
packages/claude-author/index/orama-index.json linguist-generated=true -diff
```

---

## Package Structure

```
packages/claude-author/
├── docs/                            <- doc author writes here
│   ├── core/
│   ├── diagram/
│   ├── model/
│   ├── charts/
│   ├── screens/                     <- TODO: screens docs not yet authored
│   └── guides/
├── models/
│   └── nomic-embed-text-v1.5/
│       ├── onnx/
│       │   └── model_quantized.onnx
│       ├── tokenizer.json
│       ├── tokenizer_config.json
│       └── config.json
├── index/
│   └── orama-index.json             <- generated by build script
├── templates/
│   ├── brewsite-docs.js             <- one-liner MCP entry point (copied to .claude/mcp-servers/)
│   └── brewsite-scene-author.md     <- agent definition (copied to .claude/agents/)
├── src/
│   ├── server.ts                    <- MCP server implementation
│   └── bin/
│       └── init.ts                  <- CLI init command
├── scripts/
│   └── build-index.mjs              <- index build script
└── package.json
```

The entire MCP server implementation lives inside `@brewsite/claude-author`. The scaffolded `.claude/mcp-servers/brewsite-docs.js` in the developer's project is a one-liner that imports and starts the server from the installed package — nothing more. This is the whole point of the package: the developer installs it and gets everything. Logic does not live in the scaffolded file.

**Note on docs/screens/:** `@brewsite/screens` is a published package but its documentation has not yet been authored. This is a known content gap. The `docs/screens/` directory should be created and populated before the first publish of `claude-author` that claims full toolkit coverage. Until then, the search index will not include screens documentation.

---

## Monorepo Integration

Three new packages are added under `packages/` alongside the existing published packages. They do not go in `apps/` (which is for private, unpublished apps) and they do not go at the root. `packages/` is the correct home because all three are published npm packages with their own versions and publish lifecycles.

**Root package name collision:** The current root `package.json` has `"name": "brewsite"` (private: true). The proposed `packages/brewsite/` package also has npm name `brewsite`. pnpm workspace resolution will fail if two packages share the same name. The root `package.json` name must be changed to `brewsite-monorepo` (or similar) before adding `packages/brewsite/`. This is a prerequisite for the architect's implementation.

```
packages/
├── core/               -> @brewsite/core          (existing)
├── diagram/            -> @brewsite/diagram        (existing)
├── model/              -> @brewsite/model          (existing)
├── charts/             -> @brewsite/charts         (existing)
├── screens/            -> @brewsite/screens        (existing)
├── claude-author/      -> @brewsite/claude-author  (new)
├── create-brewsite/    -> create-brewsite          (new)
└── brewsite/           -> brewsite                 (new)

scripts/
└── publish-all.mjs     -> renamed from publish-core-diagram.mjs, extended to cover all eight packages
```

Each package has different build tooling, publish configuration, and npm package shape, detailed below.

---

### `packages/claude-author/` — `@brewsite/claude-author`

**Build tooling:** Multi-step build. First, esbuild bundles the source into `dist/` with **two entry points**: `src/server.ts` (MCP server) and `src/bin/init.ts` (CLI init command). Second, `scripts/build-index.mjs` runs to produce `index/orama-index.json`. Both steps are part of the `build` script in `package.json`.

**esbuild constraints:** The following packages contain native Node.js bindings or dynamic requires that esbuild cannot bundle. They must be marked as `external` in the esbuild configuration:
- `onnxruntime-node` — native `.node` binaries for ONNX inference
- `@huggingface/transformers` — dynamically resolves the ONNX backend at runtime

The architect must configure esbuild with `--external:onnxruntime-node --external:@huggingface/transformers` (or equivalent API config). These packages remain as runtime dependencies resolved from `node_modules` at execution time.

```json
{
  "scripts": {
    "build": "node scripts/build.mjs && node scripts/build-index.mjs"
  }
}
```

The `scripts/build.mjs` file wraps the esbuild API call with the correct entry points and externals configuration. A single-line esbuild CLI invocation is not sufficient given the number of constraints — the architect should use the esbuild JavaScript API.

**Bin entry:** The init command is exposed as a bin script. The entry point file (`src/bin/init.ts`) must have `#!/usr/bin/env node` as its first line. esbuild preserves this when bundling.

```json
{
  "bin": {
    "brewsite-author": "./dist/bin/init.js"
  }
}
```

**`files` field:** Unlike the library packages which ship only `dist/`, `claude-author` must also ship the bundled model and the pre-baked index:

```json
{
  "files": ["dist/", "models/", "index/", "templates/"]
}
```

The `templates/` directory contains the files that the init command copies into the developer's project:
- `templates/brewsite-docs.js` — the one-liner MCP server entry point (copied to `.claude/mcp-servers/`)
- `templates/brewsite-scene-author.md` — the scene authoring agent definition (copied to `.claude/agents/`)

**Expected npm package size:** The published package will be approximately 70-80MB, dominated by the bundled ONNX model (~65MB). This is within npm's 1GB upload limit. The publish checklist must include running `npm pack --dry-run` to verify the package size before every release. The README should document the expected download size so developers are not surprised.

**Dependencies:**
- `@orama/orama` — search engine
- `@huggingface/transformers` — ONNX runtime for query embedding (marked external in esbuild)
- `onnxruntime-node` — native ONNX inference backend (marked external in esbuild)
- `@modelcontextprotocol/sdk` — MCP server protocol implementation

No dependency on any other `@brewsite/*` package.

---

### `packages/create-brewsite/` — `create-brewsite`

**Package name:** Must be `create-brewsite` (unscoped) — not `@brewsite/create-brewsite`. npm's `create-` convention requires the unscoped name for `npx create-brewsite@latest` to resolve correctly.

**Build tooling:** esbuild bundles the entire CLI into a single self-contained `dist/index.js`. No tsc declaration files needed — this is an executable, not a library.

```json
{
  "scripts": {
    "build": "esbuild src/index.ts --bundle --platform=node --outfile=dist/index.js"
  }
}
```

**Bin entry:**
```json
{
  "bin": {
    "create-brewsite": "./dist/index.js"
  }
}
```

**`files` field:**
```json
{
  "files": ["dist/"]
}
```

**Dependencies:** Does NOT depend on `@brewsite/claude-author`. The scaffolder installs `claude-author` as a dev dependency in the target project using the package manager, then shells out to `npx @brewsite/claude-author init` as a child process. This keeps `create-brewsite` lightweight (sub-1MB download). Also depends on whatever interactive prompt library the architect selects (e.g. `@clack/prompts`).

---

### `packages/brewsite/` — `brewsite`

**Package name:** `brewsite` (unscoped) so `npx brewsite add` resolves correctly.

**Prerequisite:** The root `package.json` name must be renamed from `brewsite` to `brewsite-monorepo` before this package is added (see Root Package Name Collision above).

**Build tooling:** Same esbuild single-file bundle pattern as `create-brewsite`.

```json
{
  "scripts": {
    "build": "esbuild src/index.ts --bundle --platform=node --outfile=dist/index.js"
  }
}
```

**Bin entry:**
```json
{
  "bin": {
    "brewsite": "./dist/index.js"
  }
}
```

**`files` field:**
```json
{
  "files": ["dist/"]
}
```

**Dependencies:** Does NOT depend on `@brewsite/claude-author`. Same pattern as `create-brewsite` — installs into the target project then shells out.

---

### Publishing

The three new packages are added to the existing `scripts/publish-core-diagram.mjs` script (renamed to `publish-all.mjs`). Publish order matters — `@brewsite/claude-author` must publish before `create-brewsite` and `brewsite` since both reference it by version in their scaffolding logic:

```js
const packages = [
  { name: "@brewsite/core",          dir: "packages/core" },
  { name: "@brewsite/diagram",       dir: "packages/diagram" },
  { name: "@brewsite/model",         dir: "packages/model" },
  { name: "@brewsite/charts",        dir: "packages/charts" },
  { name: "@brewsite/screens",       dir: "packages/screens" },
  { name: "@brewsite/claude-author", dir: "packages/claude-author" },
  { name: "create-brewsite",         dir: "packages/create-brewsite" },
  { name: "brewsite",                dir: "packages/brewsite" },
];
```

The root `package.json` `pnpm publish:core-diagram` script name should be updated to `publish:all` to reflect that it now covers the full published surface. The architect should rename it and update `CLAUDE.md` accordingly.

The root-level `pnpm build` command via Turborepo should include all three new packages in the build graph. The Turborepo pipeline handles build ordering automatically via `dependsOn: ["^build"]`.

**Version pinning in publish script:** The existing publish script pins `@brewsite/core` version in dependents (diagram, model, charts, screens). The updated script must also handle any version references between the new packages — specifically, `create-brewsite` and `brewsite` may reference the `@brewsite/claude-author` version in their scaffolding logic (e.g., the version they install into the target project). The architect must ensure version pinning covers all cross-package references.

---

## What `claude-author init` Writes Into the Developer's Project

All Claude Code integration is written exclusively by `npx @brewsite/claude-author init`. Nothing under `.claude/` is touched by `create-brewsite` or `brewsite add`. This is a firm ownership boundary.

### `.mcp.json` (project root)
Registers the MCP server with Claude Code using stdio transport. Points to `.claude/mcp-servers/brewsite-docs.js`. Uses `node` as the command (not `tsx` — the entry point is pre-built JavaScript). If `.mcp.json` already exists, the `brewsite-docs` entry is merged in — existing entries are never touched.

### `.claude/mcp-servers/brewsite-docs.js`
A one-liner JavaScript file that imports and starts the server from the installed `@brewsite/claude-author` package. It runs with `node` directly — no TypeScript compilation at runtime, no `tsx` dependency. It lives in the developer's project so they can see exactly what is running, but contains no logic of its own.

### `.claude/agents/brewsite-scene-author.md`
An agent definition that gives Claude specialized context for authoring BrewSite scenes. The content is authored by the BrewSite team and shipped as a template inside `@brewsite/claude-author`. The init command copies it into the developer's `.claude/agents/` directory.

---

## Versioning and Index Freshness

The pre-built index must be tied to the package version. When the BrewSite team publishes a new version with updated docs, the index is rebuilt and the new version is published. Developers get updated docs simply by running `npm update @brewsite/claude-author`. No cache invalidation logic is needed on the developer's machine because the index is fully contained in the package.

---

## Out of Scope

- **Runtime documentation generation**: The index is static, built at publish time. There is no facility for developers to add their own docs to the index in v1.
- **Multi-language support**: English only.
- **Cloud-hosted search**: Everything is local. No telemetry, no analytics, no network calls during search.
- **Interactive tutorials or guided setup via MCP**: The MCP server answers questions; it does not guide setup flows.
- **Model fine-tuning**: The embedding model is used as-is. No fine-tuning on BrewSite-specific vocabulary in v1.
- **WASM ONNX backend**: v1 uses `onnxruntime-node` (native). WASM fallback may be evaluated in a future version for broader platform compatibility.

---

## Decisions for the Architect

All product decisions are resolved above. The following implementation details are delegated to the architect:

- Exact MCP tool signatures and response schemas
- Orama index serialization format (native vs. custom)
- TypeScript types for the chunked doc metadata schema
- How `.mcp.json` merging is implemented in the scaffolder (read -> patch -> write)
- Interactive prompt library selection for `create-brewsite` and `brewsite` CLIs (e.g. `@clack/prompts`)
- esbuild JavaScript API configuration for multi-entry-point build with externals
- Exact starter scene template content (must be a valid, renderable scene with background + camera)
