#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const packages = [
  {
    name: "@brewsite/core",
    dir: path.join(repoRoot, "packages/core"),
  },
  {
    name: "@brewsite/diagram",
    dir: path.join(repoRoot, "packages/diagram"),
  },
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

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function runInDir(cwd, command, args) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: "inherit",
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function readVersion(pkgDir) {
  const packageJsonPath = path.join(pkgDir, "package.json");
  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
  return packageJson.version;
}

function readPackageJson(pkgDir) {
  const packageJsonPath = path.join(pkgDir, "package.json");
  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
  return { packageJsonPath, packageJson };
}

function writePackageJson(packageJsonPath, packageJson) {
  writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");
}

const releaseType = process.argv[2];
const validReleaseTypes = new Set(["dev", "point", "minor", "major"]);

if (!validReleaseTypes.has(releaseType)) {
  console.error(`Invalid release type: ${releaseType ?? "(none)"}`);
  console.error(usage);
  process.exit(1);
}

const versionArg = releaseType === "point" ? "patch" : releaseType;
const isDevRelease = releaseType === "dev";

console.log(`\nPublishing core + diagram as "${releaseType}" release...\n`);

for (const pkg of packages) {
  const npmVersionArgs = ["version", versionArg, "--no-git-tag-version"];
  if (isDevRelease) {
    npmVersionArgs.push("--preid", "dev");
  }

  console.log(`\nBumping ${pkg.name}...`);
  runInDir(pkg.dir, "npm", npmVersionArgs);
}

const corePackage = packages.find((pkg) => pkg.name === "@brewsite/core");
const diagramPackage = packages.find((pkg) => pkg.name === "@brewsite/diagram");

if (!corePackage || !diagramPackage) {
  console.error("Missing @brewsite/core or @brewsite/diagram package config.");
  process.exit(1);
}

const coreVersion = readVersion(corePackage.dir);
const { packageJsonPath: diagramPackageJsonPath, packageJson: diagramPackageJson } = readPackageJson(
  diagramPackage.dir,
);
diagramPackageJson.dependencies = diagramPackageJson.dependencies ?? {};
diagramPackageJson.dependencies["@brewsite/core"] = coreVersion;
writePackageJson(diagramPackageJsonPath, diagramPackageJson);
console.log(`Pinned @brewsite/diagram dependency @brewsite/core -> ${coreVersion}`);

for (const pkg of packages) {
  const version = readVersion(pkg.dir);
  console.log(`${pkg.name} -> ${version}`);
}

console.log("\nBuilding packages...");
run("pnpm", ["--filter", "@brewsite/core", "build"]);
run("pnpm", ["--filter", "@brewsite/diagram", "build"]);

for (const pkg of packages) {
  console.log(`\nPublishing ${pkg.name}...`);
  const publishArgs = ["publish", "--access", "public"];
  if (isDevRelease) {
    publishArgs.push("--tag", "dev");
  }
  runInDir(pkg.dir, "npm", publishArgs);
}

console.log("\nDone.");
