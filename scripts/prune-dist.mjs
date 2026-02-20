import { copyFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';

const distRoot = resolve(process.cwd(), 'dist');
await copyFile(resolve(distRoot, 'index.html'), resolve(distRoot, '404.html'));

// Source/scratch assets that Vite copies from public/ but should never ship.
// Add any file here that belongs to the authoring pipeline, not the runtime.
const targets = [
  // Legacy blend/fbx source files (leftover from early asset pipeline).
  'android_humanoid_robot_rigged.blend',
  'anroid_robot_rigged_and_materialed.fbx',
  'anroid_robot_rigged_and_materialed.fbm',
  // Robot source FBX — runtime uses the compiled robot.ktx2.no-normals.glb.
  'assets/Brain_Model.fbx',
  // Orphaned brain assets — not referenced by any page or component.
  'assets/brain_areas.glb',
  'assets/brain_project_mask.png',
  'assets/brain_project_regions.glb',
  'assets/brain_tex.jpg',
];

await Promise.all(
  targets.map((target) =>
    rm(resolve(distRoot, target), { recursive: true, force: true }),
  ),
);
