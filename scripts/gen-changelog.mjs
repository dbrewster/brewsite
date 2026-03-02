#!/usr/bin/env node
// Generates a CHANGELOG_DRAFT.md for a release using the Claude API.
// Reads git history and public API surfaces since the previous tag.
//
// Usage:
//   node scripts/gen-changelog.mjs <prevTag> <newVersion>
//   node scripts/gen-changelog.mjs v0.4.2 0.5.1
//
// Requires: ANTHROPIC_API_KEY env var

import Anthropic from "@anthropic-ai/sdk";
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

// ─── Args ─────────────────────────────────────────────────────────────────────

const prevTag = process.argv[2];
const newVersion = process.argv[3];

if (!prevTag || !newVersion) {
  console.error("Usage: node scripts/gen-changelog.mjs <prevTag> <newVersion>");
  console.error("Example: node scripts/gen-changelog.mjs v0.4.2 0.5.1");
  process.exit(1);
}

if (!process.env.ANTHROPIC_API_KEY) {
  console.error("Error: ANTHROPIC_API_KEY environment variable is not set.");
  process.exit(1);
}

// ─── Git helpers ──────────────────────────────────────────────────────────────

function git(args) {
  try {
    return execSync(`git ${args}`, { cwd: repoRoot, encoding: "utf8" }).trim();
  } catch {
    return "";
  }
}

/** Truncate a string to maxBytes, appending a note if truncated. */
function cap(str, maxBytes) {
  if (str.length <= maxBytes) return str;
  return str.slice(0, maxBytes) + `\n... [truncated — ${str.length - maxBytes} bytes omitted]`;
}

// ─── Assemble context ─────────────────────────────────────────────────────────

const packages = [
  { name: "@brewsite/core",    dir: "packages/core",    role: "animation engine: compiler pipeline, widget SDK, React player, camera, background, lighting, environment, floor elements" },
  { name: "@brewsite/diagram", dir: "packages/diagram", role: "3D diagram element: nodes, edges, groups, themes, canvas with orbit/dolly/focus controls" },
  { name: "@brewsite/model",   dir: "packages/model",   role: "GLTF model element, skeletal animation, 3D-tracked labels" },
  { name: "@brewsite/charts",  dir: "packages/charts",  role: "3D chart elements: bar, line, area, scatter, pie, heatmap" },
];

console.log(`\nAssembling git context since ${prevTag}...\n`);

// Commits since prev tag
const commitLog = git(
  `log ${prevTag}..HEAD --no-merges --format="- %s (%h)" -- packages/`
);

// Per-package change stats (file counts + insertions/deletions)
const changeStats = packages.map(({ name, dir }) => {
  const stat = git(`diff ${prevTag}..HEAD --stat -- ${dir}/src/`);
  return stat ? `${name}:\n${stat}` : `${name}: no changes`;
}).join("\n\n");

// Public API diffs — always include these in full (they're small and most important)
const publicApiDiffs = packages.map(({ name, dir }) => {
  const diff = git(`diff ${prevTag}..HEAD -- ${dir}/src/index.ts`);
  if (!diff) return null;
  return `=== ${name} public API (src/index.ts) ===\n${diff}`;
}).filter(Boolean).join("\n\n");

// Per-package source diffs — cap each to keep total context reasonable
const sourceDiffs = packages.map(({ name, dir }) => {
  const diff = git(`diff ${prevTag}..HEAD -- ${dir}/src/`);
  if (!diff) return null;
  return `=== ${name} source diff ===\n${cap(diff, 40_000)}`;
}).filter(Boolean).join("\n\n");

// ─── Prompt ───────────────────────────────────────────────────────────────────

const today = new Date().toISOString().slice(0, 10);

const prompt = `You are writing a CHANGELOG for a set of published TypeScript npm libraries.

RELEASE: ${prevTag} → v${newVersion} (${today})

PACKAGES (all published together with the same version):
${packages.map(p => `- ${p.name}: ${p.role}`).join("\n")}

YOUR TASK:
Write a CHANGELOG entry covering all four packages. Format it exactly as shown below.
Write for the developer who CONSUMES these packages — focus on what changed for them.
Be specific: name the APIs, components, and config options that changed.

INCLUDE:
- Breaking changes (renamed/removed exports, changed function signatures, peer dep changes)
- New features and new DSL components
- Bug fixes that consumers would have felt
- Performance improvements with measurable impact

EXCLUDE:
- Internal refactors that don't affect the public API
- Test-only changes
- Comment and documentation changes
- Dev tooling changes (build config, linting)

OUTPUT FORMAT (strict markdown, no preamble, start directly with the version heading):
---
## v${newVersion} (${today})

### @brewsite/core
#### Breaking Changes
[or omit this section if none]
#### New Features
#### Bug Fixes
#### Performance

### @brewsite/diagram
[same structure, omit empty sections]

### @brewsite/model
[same structure, omit empty sections]

### @brewsite/charts
[same structure, omit empty sections]
---

If a package has no consumer-visible changes, write a single line: "No consumer-facing changes."

─── COMMIT LOG ───
${commitLog || "(no commits found — check prevTag argument)"}

─── CHANGE STATS BY PACKAGE ───
${changeStats}

─── PUBLIC API DIFFS (src/index.ts) ───
${publicApiDiffs || "(no public API changes)"}

─── FULL SOURCE DIFFS ───
${sourceDiffs || "(no source changes)"}
`;

// ─── Call Claude API (streaming) ──────────────────────────────────────────────

console.log("Calling Claude API (streaming)...\n");
console.log("─".repeat(60));

const client = new Anthropic();
let fullResponse = "";

const stream = await client.messages.stream({
  model: "claude-opus-4-5",
  max_tokens: 4096,
  messages: [{ role: "user", content: prompt }],
});

for await (const chunk of stream) {
  if (
    chunk.type === "content_block_delta" &&
    chunk.delta.type === "text_delta"
  ) {
    process.stdout.write(chunk.delta.text);
    fullResponse += chunk.delta.text;
  }
}

console.log("\n" + "─".repeat(60));

// ─── Write output ─────────────────────────────────────────────────────────────

const draftPath = path.join(repoRoot, "CHANGELOG_DRAFT.md");
writeFileSync(draftPath, fullResponse.trim() + "\n", "utf8");
console.log(`\nDraft written to: CHANGELOG_DRAFT.md`);

// Prepend to CHANGELOG.md
const changelogPath = path.join(repoRoot, "CHANGELOG.md");
const existing = existsSync(changelogPath)
  ? readFileSync(changelogPath, "utf8")
  : "";

const separator = existing ? "\n\n---\n\n" : "";
writeFileSync(
  changelogPath,
  fullResponse.trim() + separator + existing,
  "utf8"
);
console.log("Prepended to: CHANGELOG.md");
console.log("\nReview both files, edit as needed, then continue the publish.\n");
