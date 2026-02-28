import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const examplesPublic = resolve(__dirname, '../../../apps/examples/public');
const docsPublic = resolve(__dirname, '../public');

const ASSETS = [
  'assets/motion-dummy_male.no-normals.glb',
  'assets/motion/chat-relax-m.glb',
  'assets/motion/standing_chat_m_270753.glb',
];

for (const asset of ASSETS) {
  const src = resolve(examplesPublic, asset);
  const dst = resolve(docsPublic, asset);

  if (!existsSync(src)) {
    console.warn(`[copy-demo-assets] Missing source: ${src}`);
    continue;
  }

  mkdirSync(dirname(dst), { recursive: true });
  cpSync(src, dst);
  console.log(`[copy-demo-assets] Copied: ${asset}`);
}
