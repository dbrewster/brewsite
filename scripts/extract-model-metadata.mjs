/**
 * extract-model-metadata.mjs
 *
 * Reads all robot GLB assets and emits public/assets/robot-metadata.json.
 * This file is the build-time source of truth for:
 *   - Robot bone names and anchor targets (head, chest)
 *   - Robot mesh names
 *   - Brain subpart node names
 *   - Animation clip names and durations
 *
 * Run via: node scripts/extract-model-metadata.mjs
 * Integrated into: pnpm build (runs before tsc + vite)
 *
 * Exits non-zero if any required bones, animations, or GLBs are missing.
 */

import { NodeIO } from '@gltf-transform/core';
import { KHRMeshQuantization, KHRTextureBasisu, KHRTextureTransform } from '@gltf-transform/extensions';
import { writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const ASSETS = resolve(ROOT, 'public/assets');
const OUT = resolve(ASSETS, 'robot-metadata.json');

const io = new NodeIO().registerExtensions([
  KHRMeshQuantization,
  KHRTextureBasisu,
  KHRTextureTransform,
]);

// ─── helpers ──────────────────────────────────────────────────────────────────

let errors = 0;
const warn  = (msg) => console.warn(`[extract-metadata] WARN:  ${msg}`);
const fail  = (msg) => { console.error(`[extract-metadata] ERROR: ${msg}`); errors++; };
const info  = (msg) => console.log(`[extract-metadata] ${msg}`);

async function readGlb(relativePath) {
  const abs = resolve(ASSETS, relativePath);
  try {
    return (await io.read(abs)).getRoot();
  } catch (err) {
    fail(`Could not read ${relativePath}: ${err.message}`);
    return null;
  }
}

/**
 * Returns the max timestamp (duration) of an animation by inspecting its
 * input accessors (time tracks). gltf-transform stores keyframe times in the
 * "input" accessor of each AnimationSampler.
 */
function animationDuration(anim) {
  let max = 0;
  for (const sampler of anim.listSamplers()) {
    const input = sampler.getInput();
    if (!input) continue;
    const m = input.getMax([])[0];
    if (typeof m === 'number' && m > max) max = m;
  }
  return Math.round(max * 1000) / 1000; // round to ms
}

/**
 * Finds the first bone whose name matches one of the candidates (in order).
 * Falls back to a regex scan if none of the candidates are present.
 */
function resolveBone(boneNames, candidates, fallbackPattern) {
  for (const candidate of candidates) {
    if (boneNames.includes(candidate)) return candidate;
  }
  return boneNames.find((n) => fallbackPattern.test(n)) ?? null;
}

// ─── asset config ─────────────────────────────────────────────────────────────

// Priority-ordered candidates for anchor bone resolution.
// Matches the logic previously in resolveHeadTarget / resolveChestTarget.
const HEAD_BONE_CANDIDATES  = ['mixamorig:Head', 'HEAD'];
const CHEST_BONE_CANDIDATES = ['mixamorig:Spine1', 'mixamorig:Spine2', 'mixamorig:Spine', 'CHEST'];

/**
 * Each entry describes one animation GLB.
 * `id`      — stable identifier used in scene definitions
 * `glbFile` — path relative to public/assets/
 * `assetUrl`— public URL the browser will fetch at runtime
 */
const ANIMATION_ENTRIES = [
  {
    id: 'breathing-m',
    glbFile: 'motion/Breathing/breathing-m.glb',
    assetUrl: '/assets/motion/Breathing/breathing-m.glb',
  },
  {
    id: 'chat-relax-m',
    glbFile: 'motion/ChatRelaxM/chat-relax-m.glb',
    assetUrl: '/assets/motion/ChatRelaxM/chat-relax-m.glb',
  },
  {
    id: 'chat-relax-f',
    glbFile: 'motion/ChatRelaxF/chat-relax-f.glb',
    assetUrl: '/assets/motion/ChatRelaxF/chat-relax-f.glb',
  },
  {
    id: 'chat-talk-laugh-m',
    glbFile: 'motion/ChatTalkLaughM/chat-talkandlaugh-m.glb',
    assetUrl: '/assets/motion/ChatTalkLaughM/chat-talkandlaugh-m.glb',
  },
  {
    id: 'chat-talk-laugh-f',
    glbFile: 'motion/ChatTalkLaughF/chat-talkandlaugh-f.glb',
    assetUrl: '/assets/motion/ChatTalkLaughF/chat-talkandlaugh-f.glb',
  },
  {
    id: 'waving',
    glbFile: 'motion/Waving/elevator_greeting_m.glb',
    assetUrl: '/assets/motion/Waving/elevator_greeting_m.glb',
  },
];

// ─── 1. robot GLB ─────────────────────────────────────────────────────────────

info('Loading robot GLB...');
const robotRoot = await readGlb('robot.ktx2.no-normals.glb');

let robotBones       = [];
let robotMeshes      = [];
let robotAnchorTargets = { head: null, chest: null };

if (robotRoot) {
  robotBones  = robotRoot.listNodes().map((n) => n.getName()).filter(Boolean).sort();
  robotMeshes = robotRoot.listMeshes().map((m) => m.getName()).filter(Boolean).sort();

  const embeddedAnims = robotRoot.listAnimations();
  if (embeddedAnims.length > 0) {
    warn(`robot GLB contains ${embeddedAnims.length} embedded animation(s) — these are not listed in animations[]. If intentional, add them to ANIMATION_ENTRIES.`);
  }

  const headBone  = resolveBone(robotBones, HEAD_BONE_CANDIDATES,  /head/i);
  const chestBone = resolveBone(robotBones, CHEST_BONE_CANDIDATES, /spine|chest|torso/i);

  if (!headBone)  fail('Could not resolve head anchor bone in robot GLB');
  if (!chestBone) fail('Could not resolve chest anchor bone in robot GLB');

  robotAnchorTargets = { head: headBone, chest: chestBone };
  info(`Robot: ${robotBones.length} bones, ${robotMeshes.length} meshes — head="${headBone}", chest="${chestBone}"`);
}

// ─── 2. brain GLB ─────────────────────────────────────────────────────────────

info('Loading brain GLB...');
const brainRoot = await readGlb('brain_separated.glb');

let brainSubparts = [];

if (brainRoot) {
  const allBrainNodes = brainRoot.listNodes().map((n) => n.getName()).filter(Boolean).sort();

  // Separate primary subparts (semantic regions) from marker nodes (debug overlays).
  // Marker nodes have a "marker_" prefix and are used for region-highlight effects.
  brainSubparts = allBrainNodes.filter((n) => !n.startsWith('marker_'));
  const markerNodes = allBrainNodes.filter((n) => n.startsWith('marker_'));

  info(`Brain: ${brainSubparts.length} subparts, ${markerNodes.length} marker nodes`);
  if (brainSubparts.length === 0) {
    fail('No brain subparts found in brain_separated.glb — expected at least one non-marker node');
  }
}

// ─── 3. animation GLBs ────────────────────────────────────────────────────────

info('Loading animation GLBs...');
const animations = [];

for (const entry of ANIMATION_ENTRIES) {
  const root = await readGlb(entry.glbFile);
  if (!root) continue; // readGlb already recorded the error

  const anims = root.listAnimations();
  if (anims.length === 0) {
    fail(`No animations found in ${entry.glbFile}`);
    continue;
  }
  if (anims.length > 1) {
    warn(`${entry.glbFile} contains ${anims.length} animations; using the first one ("${anims[0].getName()}")`);
  }

  const anim     = anims[0];
  const clipName = anim.getName();
  const duration = animationDuration(anim);

  if (!clipName) {
    fail(`Animation in ${entry.glbFile} has no name — clip name required for runtime lookup`);
    continue;
  }
  if (duration <= 0) {
    warn(`Animation "${clipName}" in ${entry.glbFile} has zero duration`);
  }

  info(`  ${entry.id}: clipName="${clipName}", duration=${duration}s`);
  animations.push({
    id:       entry.id,
    glb:      entry.assetUrl,
    clipName,
    duration,
  });
}

// ─── 4. guard ─────────────────────────────────────────────────────────────────

if (errors > 0) {
  console.error(`\n[extract-metadata] ${errors} error(s). Fix the issues above before building.\n`);
  process.exit(1);
}

// ─── 5. emit ──────────────────────────────────────────────────────────────────

const metadata = {
  /**
   * Increment when the schema changes in a breaking way.
   * Consumers should assert version === 1 and fail loudly if not.
   */
  version: 1,

  robot: {
    glb: '/assets/robot.ktx2.no-normals.glb',
    /** All node names in the robot skeleton (bones + structural nodes). */
    bones: robotBones,
    /** All mesh names in the robot GLB. */
    meshes: robotMeshes,
    /**
     * Pre-resolved anchor bones for attaching sub-models (brain, particles).
     * These are resolved once here so the runtime never has to search for them.
     */
    anchorTargets: robotAnchorTargets,
  },

  brain: {
    glb: '/assets/brain_separated.glb',
    /**
     * Primary region node names. Valid keys for SceneModel.parts.brain.brainSubparts.
     * Does not include marker_ nodes (used for highlight effects, not material overrides).
     */
    subparts: brainSubparts,
  },

  /**
   * All animation clips available for scene use.
   * `id`       — use this in scene definitions (SceneAnimation.animationId or similar)
   * `glb`      — browser-fetchable URL for the GLB containing this clip
   * `clipName` — the clip name as it appears in the GLB (use for THREE.AnimationMixer lookup)
   * `duration` — clip duration in seconds (pre-computed; no need to load GLB to get this)
   */
  animations,
};

await writeFile(OUT, JSON.stringify(metadata, null, 2) + '\n');
info(`Written: ${OUT}`);
info('Done.');
