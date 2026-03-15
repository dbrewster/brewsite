---
title: "@brewsite/claude-author — AI-Assisted Scene Authoring Tooling"
doc_type: prd
status: active
owner: Toolkit Product
last_updated: 2026-03-15
change_history:
  - date: 2026-03-15
    author: "Toolkit Product"
    summary: "Initial PRD created post-implementation. Documents the shipped v0.1.0 feature: MCP server, CLI tooling, search stack, build pipeline, and monorepo integration."
  - date: 2026-03-15
    author: "Toolkit Product"
    summary: "Codebase alignment audit. Fixed brewsite_search tool: added topic parameter (optional enum: 'core' | 'diagram' | 'model' | 'charts' | 'screens' | 'guides'). Fixed brewsite_get_doc tool: parameter is id (not path), format is '{filePath}#{heading}' compound key, retrieves individual ##-level chunks. Fixed brewsite_list_topics return type: actual returns TopicInfo { topic, count, description }, not TopicEntry { category, title, path }. Fixed SearchResult type: actual has nested meta object { filePath, heading, title, topic }, not flat fields."
---

# `@brewsite/claude-author` — AI-Assisted Scene Authoring Tooling

## 1. Overview

`@brewsite/claude-author` is a published npm package that provides an AI-powered documentation assistant for developers integrating the BrewSite toolkit. It registers an MCP (Model Context Protocol) server that Claude Code launches automatically on project open, enabling Claude to search and retrieve BrewSite documentation in real time — fully in-process, with no external services, API keys, or configuration required.

This PRD covers three published packages and their monorepo integration:

| Package | npm Name | Role |
|---|---|---|
| `packages/claude-author/` | `@brewsite/claude-author` | MCP server + docs search + init CLI |
| `packages/create-brewsite/` | `create-brewsite` | Interactive project scaffolder |
| `packages/brewsite/` | `brewsite` | Utility CLI (`npx brewsite add`) |

All three are developer tooling packages. None are imported into application runtime code.

**Affected packages:** `@brewsite/claude-author`, `create-brewsite`, `brewsite`. No changes to `@brewsite/core`, `@brewsite/diagram`, `@brewsite/model`, or `@brewsite/charts`.

## 2. Problem Statement

Developers integrating the BrewSite toolkit work with a non-trivial API surface: the scene DSL, the compiler pipeline, the widget SDK, the element module pattern, diagram elements, model labels, input controllers, and more. Without in-context documentation, Claude (and the developer) must rely on memory, source code spelunking, or context window exhaustion from pasting large README sections.

`claude-author` eliminates this by making the full toolkit documentation available as a first-class, queryable knowledge source directly in Claude's tool loop.

## 3. Goals & Success Metrics

| Goal | Metric |
|---|---|
| Developers get accurate BrewSite answers without leaving Claude Code | MCP server responds to queries in < 200ms after warm startup |
| Zero-config setup for new projects | `npx create-brewsite@latest` completes full setup with no manual steps |
| Existing projects can add tooling incrementally | `npx brewsite add claude-author` is idempotent and non-destructive |
| Startup time is acceptable | MCP server ready in < 500ms on warm cache |
| No external service dependencies | All search is local; no network calls during operation |

**Guardrail metrics:**
- No impact on `@brewsite/core` or `@brewsite/diagram` bundle size
- No new peer dependencies introduced to library packages
- Existing consumers are unaffected

## 4. Non-Goals

- **Runtime documentation generation:** The index is static, built at publish time. Developers cannot add their own docs to the index in v1.
- **Multi-language support:** English only.
- **Cloud-hosted search:** Everything is local. No telemetry, no analytics, no network calls during search.
- **Interactive tutorials or guided setup via MCP:** The MCP server answers questions; it does not guide setup flows.
- **Model fine-tuning:** The embedding model is used as-is.
- **WASM ONNX backend:** v1 uses `onnxruntime-node` (native). WASM fallback may be evaluated in a future version.

## 5. Consumer Stories

- As a toolkit consumer, I want Claude to understand BrewSite's DSL and API so that I get accurate scene authoring guidance without pasting docs into context.
- As a toolkit consumer, I want `npx create-brewsite@latest` to scaffold a working project with Claude Code integration so that I can start authoring scenes immediately.
- As a toolkit consumer, I want `npx brewsite add claude-author` to add AI tooling to my existing project so that I don't have to start over.
- As a toolkit consumer, I want the MCP server to start quickly and respond fast so that it doesn't slow down my Claude Code workflow.

## 6. Functional Requirements

### 6.1 MCP Server (`@brewsite/claude-author`)

1. The MCP server uses stdio transport. Claude Code launches it as a child process via `.mcp.json` at the project root.
2. The server exposes three tools:

   **`brewsite_search`** — Hybrid semantic + full-text search over the documentation corpus.
   - Input: `query` (string, required), `topic` (optional enum: `'core' | 'diagram' | 'model' | 'charts' | 'screens' | 'guides'`), `limit` (number, optional, default 5, max 20)
   - Returns: Array of `SearchResult` objects with `id`, `content`, `score`, and `meta: { filePath, heading, title, topic }`

   **`brewsite_get_doc`** — Retrieve a specific documentation chunk by its compound ID.
   - Input: `id` (string, required) — format is `"{filePath}#{heading}"`, e.g. `"core/input-dsl.md#WheelMap"`
   - Returns: Single `SearchResult` with full chunk content, or error if not found. Retrieves individual `##`-level chunks, not entire documents.

   **`brewsite_list_topics`** — List available documentation topic areas for discovery.
   - Input: none
   - Returns: Array of `TopicInfo` objects with `topic` (string), `count` (number), and `description` (string)

3. The server loads a pre-built Orama index (`index/orama-index.json`) at startup. No index building occurs at runtime.
4. Query embedding uses `nomic-embed-text-v1.5` (int4 quantized ONNX, ~65MB) bundled in the package under `models/nomic-embed-text-v1.5/`.
5. The model is accessed via `@huggingface/transformers` with `env.localModelPath` pointing to the bundled model directory and `env.allowRemoteModels = false`.
6. All queries are prefixed with `search_query: ` before embedding (required by nomic-embed-text-v1.5 task prefix convention).

### 6.2 Init CLI (`npx @brewsite/claude-author init`)

1. The init command writes three files into the developer's project:
   - `.mcp.json` — Registers the MCP server with Claude Code (merges if file exists; never overwrites existing entries)
   - `.claude/mcp-servers/brewsite-docs.js` — One-liner entry point that imports and starts the server from the installed package
   - `.claude/agents/brewsite-scene-author.md` — Scene authoring agent definition
2. The command is idempotent — running it twice does not duplicate or overwrite existing config.
3. The entry point uses `node` (not `tsx`) — the server is pre-built JavaScript via esbuild.
4. The bin entry is exposed as `brewsite-author` in `package.json`.

### 6.3 Project Scaffolder (`create-brewsite`)

1. `npx create-brewsite@latest` runs an interactive CLI that:
   - Prompts the developer to select BrewSite modules (`@brewsite/core` is required; `diagram`, `model`, `charts`, `screens` are optional)
   - Installs selected packages as dependencies
   - Installs `@brewsite/claude-author` as a dev dependency
   - Creates a starter scene file (`src/scenes/intro.tsx`) — a valid, renderable scene with background and camera
   - Runs `npx @brewsite/claude-author init` as a child process
2. `create-brewsite` does NOT depend on `@brewsite/claude-author` as a direct npm dependency. It installs `claude-author` into the target project first, then shells out. This keeps the scaffolder lightweight (sub-1MB).
3. Package name is `create-brewsite` (unscoped) for `npx create-` convention compatibility.

### 6.4 Utility CLI (`brewsite`)

1. `npx brewsite add <module>` installs BrewSite modules into an existing project.
   - Supported modules: `diagram`, `model`, `charts`, `screens`, `claude-author`
   - `brewsite add claude-author` installs the package and runs `npx @brewsite/claude-author init`
2. Like `create-brewsite`, the `brewsite` CLI does NOT depend on `@brewsite/claude-author` as a direct npm dependency.
3. Package name is `brewsite` (unscoped) for `npx brewsite` resolution.

## 7. API Design

### MCP Tool Signatures

```typescript
// ─── Shared types (packages/claude-author/src/types.ts) ─────────────────────

/** Available topic areas for filtering. */
type TopicArea = 'core' | 'diagram' | 'model' | 'charts' | 'screens' | 'guides';

/** Metadata stored alongside each documentation chunk. */
interface DocChunkMeta {
  filePath: string;   // e.g. "core/input-dsl.md"
  heading: string;    // e.g. "WheelMap"
  title: string;      // document-level title
  topic: string;      // e.g. "core", "diagram", "charts"
}

/** Result returned from search or getDocById. */
interface SearchResult {
  id: string;         // compound key: "{filePath}#{heading}"
  content: string;    // chunk text
  score: number;      // relevance score (0-1, higher is better)
  meta: DocChunkMeta; // source metadata (nested object)
}

// ─── brewsite_search ─────────────────────────────────────────────────────────
interface SearchDocsInput {
  query: string;           // natural language search query
  topic?: TopicArea;       // optional topic filter
  limit?: number;          // default 5, max 20
}
// Returns: SearchResult[]

// ─── brewsite_get_doc ────────────────────────────────────────────────────────
interface GetDocInput {
  id: string;              // "{filePath}#{heading}" compound key
}
// Returns: SearchResult (single chunk) or error

// ─── brewsite_list_topics ────────────────────────────────────────────────────
// Input: {} (no parameters)
// Returns: TopicInfo[]
interface TopicInfo {
  topic: string;           // e.g. "core", "diagram"
  count: number;           // number of indexed sections
  description: string;     // human-readable topic summary
}
```

### Package Exports

```typescript
// @brewsite/claude-author — no public TypeScript API
// The package exposes only:
//   bin: "brewsite-author" -> dist/bin/init.js
//   exports: "./server"   -> dist/server.js (consumed by the MCP entry point)
```

## 8. Technical Considerations

### Build Pipeline

The `claude-author` package has a two-step build:
1. **esbuild** bundles `src/server.ts` and `src/bin/init.ts` into `dist/` with two entry points. `onnxruntime-node` and `@huggingface/transformers` are marked as external (native bindings / dynamic requires).
2. **`scripts/build-index.mjs`** reads all Markdown from `docs/`, chunks by `##` headers, embeds with nomic-embed-text-v1.5 (prefixed with `search_document: `), and serializes an Orama hybrid index to `index/orama-index.json`.

### Turborepo Integration

A package-specific task override in `turbo.json` for `@brewsite/claude-author#build` declares `outputs: ["dist/**", "index/**"]` to ensure the generated index is cached.

### Monorepo Changes

- Root `package.json` renamed from `"brewsite"` to `"brewsite-monorepo"` to avoid pnpm workspace name collision with the `brewsite` CLI package.
- `scripts/publish-core-diagram.mjs` renamed to `scripts/publish-all.mjs`, extended to cover all eight published packages.
- Root script `publish:all` replaces `publish:core-diagram`.
- `.gitattributes` marks `orama-index.json` as `linguist-generated binary` to prevent noisy PR diffs.

### Dependencies

| Package | Key Dependencies |
|---|---|
| `@brewsite/claude-author` | `@modelcontextprotocol/sdk`, `@orama/orama`, `@huggingface/transformers`, `onnxruntime-node`, `zod` |
| `create-brewsite` | Interactive prompt library (lightweight) |
| `brewsite` | Minimal CLI (lightweight) |

None of the three packages depend on any `@brewsite/*` library package.

### npm Package Size

`@brewsite/claude-author` publishes at approximately 70-80MB, dominated by the bundled ONNX model (~65MB). `create-brewsite` and `brewsite` are sub-1MB each.

## 9. Breaking Change Assessment

**Semver impact: N/A (new packages)**

These are entirely new packages with no existing consumers. The monorepo infrastructure changes (root package rename, publish script rename) are internal and do not affect any published package API.

## 10. Dependencies

- No dependency on `@brewsite/core`, `@brewsite/diagram`, `@brewsite/model`, or `@brewsite/charts`.
- `@modelcontextprotocol/sdk` for MCP protocol implementation.
- `@orama/orama` for hybrid search (BM25 + vector).
- `@huggingface/transformers` + `onnxruntime-node` for local ONNX inference.

## 11. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Large npm package size (~70-80MB) | Documented in README; model is essential for local inference quality |
| `onnxruntime-node` platform compatibility | Native bindings cover macOS/Linux/Windows; WASM fallback evaluable in future |
| Orama index staleness | Index is rebuilt on every publish; tied to package version |
| MCP protocol evolution | Pinned to `@modelcontextprotocol/sdk` stable release |

## 12. Open Questions

None remaining for v0.1.0. All product decisions were resolved during the design phase.

## 13. Launch Criteria

- [x] MCP server responds to all three tools (`brewsite_search`, `brewsite_get_doc`, `brewsite_list_topics`)
- [x] `npx @brewsite/claude-author init` writes `.mcp.json`, `.claude/mcp-servers/brewsite-docs.js`, `.claude/agents/brewsite-scene-author.md`
- [x] Init is idempotent
- [x] `create-brewsite` scaffolds a working project with Claude Code integration
- [x] `brewsite add claude-author` works for existing projects
- [x] Pre-built Orama index ships with the package
- [x] nomic-embed-text-v1.5 model bundled under `models/`
- [x] Turborepo build graph includes all three packages
- [x] `scripts/publish-all.mjs` covers all eight published packages
- [x] `.gitattributes` configured for generated index
- [x] CLAUDE.md updated with new package references
- [x] Tests pass for MCP server and CLI init
