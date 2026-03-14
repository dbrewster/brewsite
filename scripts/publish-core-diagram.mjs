#!/usr/bin/env node
// Builds and publishes all four BrewSite library packages to npm.
// Usage: node scripts/publish-core-diagram.mjs <dev|point|minor|major>

import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

// Publish order matters: core must build and publish before dependents.
const packages = [
  { name: "@brewsite/core",    dir: path.join(repoRoot, "packages/core") },
  { name: "@brewsite/diagram", dir: path.join(repoRoot, "packages/diagram") },
  { name: "@brewsite/model",   dir: path.join(repoRoot, "packages/model") },
  { name: "@brewsite/charts",  dir: path.join(repoRoot, "packages/charts") },
  { name: "@brewsite/screens", dir: path.join(repoRoot, "packages/screens") },
];

const usage = [
  "Usage:",
  "  node scripts/publish-core-diagram.mjs <dev|point|minor|major>",
  "",
  "Examples:",
  "  node scripts/publish-core-diagram.mjs dev",
  "  node scripts/publish-core-diagram.mjs point",
].join("\n");

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    stdio: "inherit",
    ...options,
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function runInDir(cwd, command, args) {
  const result = spawnSync(command, args, { cwd, stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function readPackageJson(pkgDir) {
  const packageJsonPath = path.join(pkgDir, "package.json");
  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
  return { packageJsonPath, packageJson };
}

function writePackageJson(packageJsonPath, packageJson) {
  writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");
}

function readVersion(pkgDir) {
  return readPackageJson(pkgDir).packageJson.version;
}

function waitForEnter(message) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    rl.question(message, () => { rl.close(); resolve(); });
  });
}

function getLatestTag() {
  try {
    return spawnSync("git", ["describe", "--tags", "--abbrev=0"], {
      cwd: repoRoot, encoding: "utf8",
    }).stdout.trim();
  } catch {
    return null;
  }
}

// ─── Validate args ────────────────────────────────────────────────────────────

const releaseType = process.argv[2];
const validReleaseTypes = new Set(["dev", "point", "minor", "major"]);

if (!validReleaseTypes.has(releaseType)) {
  console.error(`Invalid release type: ${releaseType ?? "(none)"}`);
  console.error(usage);
  process.exit(1);
}

const versionArg = releaseType === "point" ? "patch" : releaseType;
const isDevRelease = releaseType === "dev";

console.log(`\nPublishing all BrewSite packages as "${releaseType}" release...\n`);

// ─── Step 1: Bump versions ────────────────────────────────────────────────────

for (const pkg of packages) {
  const npmVersionArgs = ["version", versionArg, "--no-git-tag-version"];
  if (isDevRelease) npmVersionArgs.push("--preid", "dev");
  console.log(`Bumping ${pkg.name}...`);
  runInDir(pkg.dir, "npm", npmVersionArgs);
}

// ─── Step 2: Pin @brewsite/core version in all dependents ────────────────────
// workspace:* refs are not resolved by npm publish — replace with real version.

const coreVersion = readVersion(packages[0].dir);
console.log(`\nPinning @brewsite/core@${coreVersion} in all dependents...`);

// @brewsite/diagram — hard dependency (ships alongside core)
const { packageJsonPath: diagramPath, packageJson: diagramJson } =
  readPackageJson(packages[1].dir);
diagramJson.dependencies = diagramJson.dependencies ?? {};
diagramJson.dependencies["@brewsite/core"] = coreVersion;
writePackageJson(diagramPath, diagramJson);
console.log(`  @brewsite/diagram dependencies["@brewsite/core"] -> ${coreVersion}`);

// @brewsite/model — peer dependency (caret range so consumers can control it)
const { packageJsonPath: modelPath, packageJson: modelJson } =
  readPackageJson(packages[2].dir);
modelJson.peerDependencies = modelJson.peerDependencies ?? {};
modelJson.peerDependencies["@brewsite/core"] = `^${coreVersion}`;
writePackageJson(modelPath, modelJson);
console.log(`  @brewsite/model peerDependencies["@brewsite/core"] -> ^${coreVersion}`);

// @brewsite/charts — peer dependency
const { packageJsonPath: chartsPath, packageJson: chartsJson } =
  readPackageJson(packages[3].dir);
chartsJson.peerDependencies = chartsJson.peerDependencies ?? {};
chartsJson.peerDependencies["@brewsite/core"] = `^${coreVersion}`;
writePackageJson(chartsPath, chartsJson);
console.log(`  @brewsite/charts peerDependencies["@brewsite/core"] -> ^${coreVersion}`);

// ─── Step 3: Confirm versions ─────────────────────────────────────────────────

console.log("\nVersions:");
for (const pkg of packages) {
  console.log(`  ${pkg.name} -> ${readVersion(pkg.dir)}`);
}

// ─── Step 4: Generate changelog ───────────────────────────────────────────────

const prevTag = getLatestTag();
if (!prevTag) {
  console.warn("\nWarning: no previous git tag found — skipping changelog generation.");
} else if (!process.env.ANTHROPIC_API_KEY) {
  console.warn("\nWarning: ANTHROPIC_API_KEY not set — skipping changelog generation.");
  console.warn("Set it to auto-generate a changelog draft.\n");
} else {
  console.log(`\nGenerating changelog draft (${prevTag} → v${coreVersion})...`);
  run("node", ["scripts/gen-changelog.mjs", prevTag, coreVersion]);
  await waitForEnter(
    "\nReview CHANGELOG_DRAFT.md and edit CHANGELOG.md as needed.\nPress Enter when ready to build and publish... "
  );
}

// ─── Step 5: Build all packages ───────────────────────────────────────────────
// Core must build first (diagram, model, charts resolve its types from dist/).
// The remaining three have no inter-dependencies and can run sequentially.

console.log("\nBuilding packages...");
run("pnpm", ["--filter", "@brewsite/core", "build"]);
run("pnpm", ["--filter", "@brewsite/diagram", "build"]);
run("pnpm", ["--filter", "@brewsite/model", "build"]);
run("pnpm", ["--filter", "@brewsite/charts", "build"]);
run("pnpm", ["--filter", "@brewsite/screens", "build"]);

// ─── Step 6: Publish ──────────────────────────────────────────────────────────

for (const pkg of packages) {
  console.log(`\nPublishing ${pkg.name}@${readVersion(pkg.dir)}...`);
  const publishArgs = ["publish", "--access", "public"];
  if (isDevRelease) publishArgs.push("--tag", "dev");
  runInDir(pkg.dir, "npm", publishArgs);
}

console.log("\nDone.");
