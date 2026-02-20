import { copyFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';

const distRoot = resolve(process.cwd(), 'dist');
await copyFile(resolve(distRoot, 'index.html'), resolve(distRoot, '404.html'));

// Source/scratch assets that Vite copies from public/ but should never ship.
// Keep this list minimal and avoid hardcoded project-specific assets.
const targets = [];

await Promise.all(
  targets.map((target) =>
    rm(resolve(distRoot, target), { recursive: true, force: true }),
  ),
);
