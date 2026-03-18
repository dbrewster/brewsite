#!/usr/bin/env node
// Builds and publishes all BrewSite packages to npm.
// Usage: node scripts/publish-all.mjs <dev|point|minor|major> [--force]
//
// Tracks git tree hashes per package in .publish-hashes.json to skip
// re-publishing packages whose source (and dependencies) haven't changed.
// Pass --force to publish everything regardless.

import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createInterface } from "node:readline";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

// ─── Package registry ────────────────────────────────────────────────────────
// Publish order matters: core must build and publish before dependents.
// `deps` lists in-repo packages whose changes should also trigger a republish.
// Standalone CLI packages (claude-author, create-brewsite, brewsite) go last.

const packages = [
  { name: "@brewsite/core",          dir: path.join(repoRoot, "packages/core"),                   gitPath: "packages/core",                deps: [] },
  { name: "@brewsite/diagram",       dir: path.join(repoRoot, "packages/diagram"),                gitPath: "packages/diagram",             deps: ["@brewsite/core"] },
  { name: "@brewsite/model",         dir: path.join(repoRoot, "packages/model"),                  gitPath: "packages/model",               deps: ["@brewsite/core"] },
  { name: "@brewsite/charts",        dir: path.join(repoRoot, "packages/charts"),                 gitPath: "packages/charts",              deps: ["@brewsite/core"] },
  { name: "@brewsite/screens",       dir: path.join(repoRoot, "packages/screens"),                gitPath: "packages/screens",             deps: ["@brewsite/core"] },
  { name: "@brewsite/textures",      dir: path.join(repoRoot, "packages/textures"),               gitPath: "packages/textures",            deps: ["@brewsite/core"] },
  { name: "@brewsite/slides",        dir: path.join(repoRoot, "packages/slides"),                 gitPath: "packages/slides",              deps: ["@brewsite/core", "@brewsite/diagram", "@brewsite/model", "@brewsite/charts"] },
  { name: "@brewsite/themes",        dir: path.join(repoRoot, "packages/themes"),                 gitPath: "packages/themes",              deps: ["@brewsite/core", "@brewsite/diagram", "@brewsite/charts"] },
  { name: "@brewsite/claude-author", dir: path.join(repoRoot, "packages/claude-author"),          gitPath: "packages/claude-author",       deps: [] },
  { name: "create-brewsite",         dir: path.join(repoRoot, "packages/npx/create-brewsite"),    gitPath: "packages/npx/create-brewsite", deps: [] },
  { name: "brewsite",                dir: path.join(repoRoot, "packages/npx/brewsite"),           gitPath: "packages/npx/brewsite",        deps: [] },
];

const HASH_FILE = path.join(repoRoot, ".publish-hashes.json");

const usage = [
  "Usage:",
  "  node scripts/publish-all.mjs <dev|point|minor|major> [--force]",
  "",
  "Examples:",
  "  node scripts/publish-all.mjs dev",
  "  node scripts/publish-all.mjs point",
  "  node scripts/publish-all.mjs minor --force",
].join("\n");

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

// ─── Git tree hashing ────────────────────────────────────────────────────────

/**
 * Returns the git tree SHA for a directory at HEAD.
 * This is a content-addressed hash of every file in the directory —
 * it changes if and only if any tracked file inside changes.
 */
function getGitTreeHash(gitPath) {
  const result = spawnSync("git", ["rev-parse", `HEAD:${gitPath}`], {
    cwd: repoRoot, encoding: "utf8",
  });
  if (result.status !== 0) {
    console.warn(`Warning: could not get tree hash for ${gitPath}`);
    return null;
  }
  return result.stdout.trim();
}

/** Read the stored publish hashes, or empty object if file doesn't exist. */
function readPublishHashes() {
  if (!existsSync(HASH_FILE)) return {};
  try {
    return JSON.parse(readFileSync(HASH_FILE, "utf8"));
  } catch {
    return {};
  }
}

/** Write updated publish hashes to disk. */
function writePublishHashes(hashes) {
  writeFileSync(HASH_FILE, `${JSON.stringify(hashes, null, 2)}\n`, "utf8");
}

/**
 * Compute an effective hash for a package that includes its own tree hash
 * plus the tree hashes of all its in-repo dependencies.
 * If any dep changed, the combined hash changes → package gets republished.
 */
function computeEffectiveHash(pkg, hashByName) {
  const parts = [hashByName[pkg.name] ?? "unknown"];
  for (const depName of pkg.deps) {
    parts.push(hashByName[depName] ?? "unknown");
  }
  return parts.join("+");
}

// ─── Validate args ───────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const forcePublish = args.includes("--force");
const releaseType = args.find((a) => !a.startsWith("--"));
const validReleaseTypes = new Set(["dev", "point", "minor", "major"]);

if (!validReleaseTypes.has(releaseType)) {
  console.error(`Invalid release type: ${releaseType ?? "(none)"}`);
  console.error(usage);
  process.exit(1);
}

const versionArg = releaseType === "point" ? "patch" : releaseType;
const isDevRelease = releaseType === "dev";

console.log(`\nPublishing all BrewSite packages as "${releaseType}" release...\n`);

// ─── Step 0: Compute tree hashes and determine which packages changed ────────

const previousHashes = readPublishHashes();
const currentTreeHashes = {};
for (const pkg of packages) {
  currentTreeHashes[pkg.name] = getGitTreeHash(pkg.gitPath);
}

const currentEffectiveHashes = {};
for (const pkg of packages) {
  currentEffectiveHashes[pkg.name] = computeEffectiveHash(pkg, currentTreeHashes);
}

const changedPackages = new Set();
const skippedPackages = new Set();

if (forcePublish) {
  for (const pkg of packages) changedPackages.add(pkg.name);
  console.log("--force: publishing all packages.\n");
} else {
  for (const pkg of packages) {
    const prev = previousHashes[pkg.name];
    const curr = currentEffectiveHashes[pkg.name];
    if (prev === curr) {
      skippedPackages.add(pkg.name);
    } else {
      changedPackages.add(pkg.name);
    }
  }

  if (changedPackages.size === 0) {
    console.log("No packages have changed since last publish. Nothing to do.");
    console.log("Use --force to publish anyway.\n");
    process.exit(0);
  }

  console.log("Changed packages:");
  for (const name of changedPackages) console.log(`  ✦ ${name}`);
  if (skippedPackages.size > 0) {
    console.log("Unchanged (will skip publish):");
    for (const name of skippedPackages) console.log(`  ○ ${name}`);
  }
  console.log();
}

// ─── Step 1: Bump versions (all packages, to keep versions in sync) ──────────

for (const pkg of packages) {
  const npmVersionArgs = ["version", versionArg, "--no-git-tag-version"];
  if (isDevRelease) npmVersionArgs.push("--preid", "dev");
  console.log(`Bumping ${pkg.name}...`);
  runInDir(pkg.dir, "npm", npmVersionArgs);
}

// ─── Step 2: Pin @brewsite/core version in all dependents ────────────────────
// workspace:* refs are not resolved by npm publish — replace with real version.

const coreVersion = readVersion(packages[0].dir);
const diagramVersion = readVersion(packages[1].dir);
const modelVersion = readVersion(packages[2].dir);
const chartsVersion = readVersion(packages[3].dir);

console.log(`\nPinning inter-package versions (core@${coreVersion})...`);

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

// @brewsite/screens — peer dependency
const { packageJsonPath: screensPath, packageJson: screensJson } =
  readPackageJson(packages[4].dir);
screensJson.peerDependencies = screensJson.peerDependencies ?? {};
screensJson.peerDependencies["@brewsite/core"] = `^${coreVersion}`;
writePackageJson(screensPath, screensJson);
console.log(`  @brewsite/screens peerDependencies["@brewsite/core"] -> ^${coreVersion}`);

// @brewsite/textures — peer dependency
const { packageJsonPath: texturesPath, packageJson: texturesJson } =
  readPackageJson(packages[5].dir);
texturesJson.peerDependencies = texturesJson.peerDependencies ?? {};
texturesJson.peerDependencies["@brewsite/core"] = `^${coreVersion}`;
writePackageJson(texturesPath, texturesJson);
console.log(`  @brewsite/textures peerDependencies["@brewsite/core"] -> ^${coreVersion}`);

// @brewsite/slides — peer dependencies on core, diagram, model, charts
const { packageJsonPath: slidesPath, packageJson: slidesJson } =
  readPackageJson(packages[6].dir);
slidesJson.peerDependencies = slidesJson.peerDependencies ?? {};
slidesJson.peerDependencies["@brewsite/core"] = `^${coreVersion}`;
slidesJson.peerDependencies["@brewsite/diagram"] = `^${diagramVersion}`;
slidesJson.peerDependencies["@brewsite/model"] = `^${modelVersion}`;
slidesJson.peerDependencies["@brewsite/charts"] = `^${chartsVersion}`;
writePackageJson(slidesPath, slidesJson);
console.log(`  @brewsite/slides peerDependencies["@brewsite/core"] -> ^${coreVersion}`);

// @brewsite/themes — hard dependencies on core, diagram, charts
const { packageJsonPath: themesPath, packageJson: themesJson } =
  readPackageJson(packages[7].dir);
themesJson.dependencies = themesJson.dependencies ?? {};
themesJson.dependencies["@brewsite/core"] = coreVersion;
themesJson.dependencies["@brewsite/diagram"] = diagramVersion;
themesJson.dependencies["@brewsite/charts"] = chartsVersion;
writePackageJson(themesPath, themesJson);
console.log(`  @brewsite/themes dependencies["@brewsite/core"] -> ${coreVersion}`);

// ─── Step 3: Confirm versions ────────────────────────────────────────────────

console.log("\nVersions:");
for (const pkg of packages) {
  const marker = changedPackages.has(pkg.name) ? "✦" : "○";
  console.log(`  ${marker} ${pkg.name} -> ${readVersion(pkg.dir)}`);
}

// ─── Step 4: Generate changelog ──────────────────────────────────────────────

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

// ─── Step 5: Build all packages ──────────────────────────────────────────────
// Build everything (even unchanged) so dependents can resolve types from dist/.

console.log("\nBuilding packages...");
run("pnpm", ["--filter", "@brewsite/core", "build"]);
run("pnpm", ["--filter", "@brewsite/diagram", "build"]);
run("pnpm", ["--filter", "@brewsite/model", "build"]);
run("pnpm", ["--filter", "@brewsite/charts", "build"]);
run("pnpm", ["--filter", "@brewsite/screens", "build"]);
run("pnpm", ["--filter", "@brewsite/textures", "build"]);
run("pnpm", ["--filter", "@brewsite/slides", "build"]);
run("pnpm", ["--filter", "@brewsite/themes", "build"]);
run("pnpm", ["--filter", "@brewsite/claude-author", "build"]);
run("pnpm", ["--filter", "create-brewsite", "build"]);
run("pnpm", ["--filter", "brewsite", "build"]);

// ─── Step 6: Publish (only changed packages) ────────────────────────────────

const publishedHashes = { ...previousHashes };

for (const pkg of packages) {
  if (!changedPackages.has(pkg.name)) {
    console.log(`\nSkipping ${pkg.name} (unchanged)`);
    continue;
  }

  console.log(`\nPublishing ${pkg.name}@${readVersion(pkg.dir)}...`);
  const publishArgs = ["publish", "--access", "public"];
  if (isDevRelease) publishArgs.push("--tag", "dev");
  runInDir(pkg.dir, "npm", publishArgs);

  // Record the effective hash for this successful publish
  publishedHashes[pkg.name] = currentEffectiveHashes[pkg.name];
  // Write after each publish so we don't lose progress if a later publish fails
  writePublishHashes(publishedHashes);
}

console.log(`\nPublish hashes saved to ${path.relative(repoRoot, HASH_FILE)}`);

// ─── Step 7: Git tag and commit ──────────────────────────────────────────────
// Commit the version bumps and publish hashes, then tag for changelog generation.

const tagName = `v${coreVersion}`;
console.log(`\nCommitting version bumps and tagging ${tagName}...`);

// Stage all package.json changes and the publish hashes file
run("git", ["add", "-A", "packages/*/package.json", "packages/npx/*/package.json", HASH_FILE]);
const commitResult = spawnSync("git", ["commit", "-m", `Release ${tagName}`], {
  cwd: repoRoot, stdio: "inherit",
});
// commit may fail if nothing changed (e.g. --force re-publish at same version) — that's ok
if (commitResult.status === 0) {
  run("git", ["tag", "-a", tagName, "-m", `Release ${tagName}`]);
  console.log(`Tagged ${tagName}. Push with: git push && git push --tags`);
} else {
  console.warn("No changes to commit — skipping tag.");
}

console.log("\nDone.");
