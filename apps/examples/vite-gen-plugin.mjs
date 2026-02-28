// Vite plugin: watches siteResources.ts and re-runs gen:scene-dsl on change.
// Also runs gen:scene-dsl at the start of every build (dev or prod).

import { execSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

const SOURCE_FILE = 'siteResources.ts';
const GEN_SCRIPT = path.resolve('../../scripts/gen-scene-dsl.mjs');
const OUT_DIR = 'generated';
const MANIFEST_OUT = 'public/scene-manifest.json';

/**
 * Returns true if the generated files are stale relative to siteResources.ts.
 * Stale = source is newer than the manifest output, or manifest is missing.
 */
function isStale(root) {
  const srcPath = path.resolve(root, SOURCE_FILE);
  const outPath = path.resolve(root, MANIFEST_OUT);
  if (!fs.existsSync(outPath)) return true;
  return fs.statSync(srcPath).mtimeMs > fs.statSync(outPath).mtimeMs;
}

function runGenerator(root) {
  try {
    execSync(
      `node ${GEN_SCRIPT} --input ${SOURCE_FILE} --out-dir ${OUT_DIR}` +
      ` --asset-root public --manifest-out ${MANIFEST_OUT}`,
      { cwd: root, stdio: 'inherit' },
    );
  } catch (err) {
    console.error('[brewsite-gen] Code generation failed:', err.message);
  }
}

export function brewsiteGenPlugin() {
  let viteRoot = process.cwd();

  return {
    name: 'brewsite-gen',

    configResolved(config) {
      viteRoot = config.root;
    },

    buildStart() {
      // In dev: only regenerate if stale. In prod: always regenerate.
      if (this.meta?.watchMode && !isStale(viteRoot)) return;
      console.log('[brewsite-gen] Running gen:scene-dsl...');
      runGenerator(viteRoot);
    },

    configureServer(server) {
      const sourceAbsPath = path.resolve(viteRoot, SOURCE_FILE);
      server.watcher.add(sourceAbsPath);
      server.watcher.on('change', (file) => {
        if (path.normalize(file) !== path.normalize(sourceAbsPath)) return;
        console.log('[brewsite-gen] siteResources.ts changed — regenerating...');
        runGenerator(viteRoot);
        server.ws.send({ type: 'full-reload' });
      });
    },
  };
}
