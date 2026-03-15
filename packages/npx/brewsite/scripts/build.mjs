#!/usr/bin/env node
// Bundles brewsite CLI into a single dist/index.js file.

import { build } from 'esbuild';

await build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'esm',
  outfile: 'dist/index.js',
  banner: {
    js: '#!/usr/bin/env node',
  },
});

console.log('brewsite built to dist/index.js');
