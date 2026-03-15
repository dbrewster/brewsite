#!/usr/bin/env node
// Bundles @brewsite/claude-author source into dist/ using esbuild.
// Two entry points: server.ts (MCP server) and bin/init.ts (CLI).

import { build } from 'esbuild';

await build({
  entryPoints: [
    'src/server.ts',
    'src/bin/init.ts',
    'src/chunker.ts',
  ],
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'esm',
  outdir: 'dist',
  // Preserve directory structure in output:
  //   dist/server.js, dist/bin/init.js, dist/chunker.js
  external: [
    'onnxruntime-node',
    '@huggingface/transformers',
  ],
  banner: {
    js: '',  // Shebang added only to bin/init.ts via a post-step — see below
  },
});

// Add shebang to bin/init.js
import { readFileSync, writeFileSync } from 'node:fs';
const initPath = 'dist/bin/init.js';
const initContent = readFileSync(initPath, 'utf-8');
if (!initContent.startsWith('#!')) {
  writeFileSync(initPath, `#!/usr/bin/env node\n${initContent}`);
}

console.log('claude-author built to dist/');
