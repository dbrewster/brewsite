#!/usr/bin/env node
/**
 * Converts one or more FBX animations to glTF and appends the resulting animation clips to a base GLB.
 *
 * Notes:
 * - This does NOT retarget between different skeletons. It assumes the FBX clip's animated bone names
 *   correspond to nodes/bones in the target GLB (exactly, or with namespace differences like `mixamorig:`).
 * - If your FBX animations come from a different rig (e.g. UE Mannequin), you must retarget first.
 *
 * Example:
 *   node scripts/add_fbx_animations_to_glb.mjs \
 *     --base public/assets/robot.ktx2.no-normals.glb \
 *     --out public/assets/robot.ktx2.no-normals.glb \
 *     --clip Breathing=public/assets/Breathing/breathing-m.fbx \
 *     --clip Waving=public/assets/Waving/elevator_greeting_m.fbx \
 *     --in-place-root
 */

import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { mkdtempSync } from 'node:fs';
import { renameSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';

function parseArgs(argv) {
  const args = {
    base: undefined,
    out: undefined,
    clips: [],
    inPlaceRoot: false,
    debug: false,
  };

  for (let i = 2; i < argv.length; i++) {
    const token = argv[i];
    if (!token) continue;

    if (token === '--base') {
      args.base = argv[++i];
      continue;
    }
    if (token === '--out') {
      args.out = argv[++i];
      continue;
    }
    if (token === '--clip') {
      const spec = argv[++i];
      if (!spec || !spec.includes('=')) throw new Error('Expected --clip in format Name=/path/to/clip.fbx');
      const [name, fbx] = spec.split('=', 2);
      if (!name?.trim()) throw new Error('Clip name cannot be empty.');
      if (!fbx?.trim()) throw new Error(`Clip "${name}" path cannot be empty.`);
      args.clips.push({ name: name.trim(), fbx: fbx.trim() });
      continue;
    }
    if (token === '--in-place-root') {
      args.inPlaceRoot = true;
      continue;
    }
    if (token === '--debug') {
      args.debug = true;
      continue;
    }

    throw new Error(`Unknown argument: ${token}`);
  }

  if (!args.base) throw new Error('Missing required --base path.');
  if (!args.out) throw new Error('Missing required --out path.');
  if (!args.clips.length) throw new Error('At least one --clip is required.');

  return args;
}

function getFbx2GltfExe() {
  const platform = process.platform;
  const platformDir =
    platform === 'darwin'
      ? 'Darwin'
      : platform === 'linux'
        ? 'Linux'
        : platform === 'win32'
          ? 'Windows_NT'
          : null;

  if (!platformDir) throw new Error(`Unsupported platform for FBX2glTF: ${platform}`);

  const exeName = platform === 'win32' ? 'FBX2glTF.exe' : 'FBX2glTF';
  return path.resolve('node_modules', 'fbx2gltf', 'bin', platformDir, exeName);
}

function stripNamespace(name) {
  const idx = name.lastIndexOf(':');
  return idx >= 0 ? name.slice(idx + 1) : name;
}

function buildNodeLookup(doc) {
  const nodes = doc.getRoot().listNodes();

  const byExact = new Map();
  const byLower = new Map();
  const byShort = new Map();
  const byShortLower = new Map();

  for (const node of nodes) {
    const name = node.getName();
    if (!name) continue;

    byExact.set(name, node);
    byLower.set(name.toLowerCase(), node);

    const short = stripNamespace(name);
    byShort.set(short, node);
    byShortLower.set(short.toLowerCase(), node);
  }

  const resolve = (name) => {
    if (!name) return null;
    const exact = byExact.get(name);
    if (exact) return exact;
    const lower = byLower.get(name.toLowerCase());
    if (lower) return lower;
    const short = stripNamespace(name);
    const byS = byShort.get(short);
    if (byS) return byS;
    const bySL = byShortLower.get(short.toLowerCase());
    if (bySL) return bySL;
    // Namespace suffix match, e.g. mixamorig:Hips vs Hips.
    const suffix = `:${short}`;
    for (const [k, v] of byExact) {
      if (k.endsWith(suffix)) return v;
    }
    return null;
  };

  return { resolve, nodes };
}

function shouldZeroRootTranslation(nodeName) {
  if (!nodeName) return false;
  const n = nodeName.toLowerCase();
  return n.includes('hips') || n.includes('pelvis') || n.includes('root');
}

function copyAccessor(doc, srcAccessor, name) {
  const arr = srcAccessor.getArray();
  const next = arr.slice(0);
  const accessor = doc.createAccessor(name).setArray(next).setType(srcAccessor.getType()).setNormalized(srcAccessor.getNormalized());
  return accessor;
}

async function main() {
  const args = parseArgs(process.argv);
  const fbx2gltfExe = getFbx2GltfExe();

  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

  const tempRoot = mkdtempSync(path.join(tmpdir(), 'brewflow-fbx-anims-'));
  const tmpOut = path.join(tempRoot, 'out');
  mkdirSync(tmpOut, { recursive: true });

  try {
    const baseDoc = await io.read(args.base);
    const baseLookup = buildNodeLookup(baseDoc);

    const addedClipNames = [];
    const missingTargets = new Map(); // targetName -> count

    for (const clip of args.clips) {
      const outStem = path.join(tmpOut, clip.name.replaceAll(/[^\w.-]+/g, '_'));
      const outGlb = `${outStem}.glb`;

      execFileSync(
        fbx2gltfExe,
        [
          '--binary',
          '--anim-framerate',
          'bake30',
          '--fbx-temp-dir',
          tempRoot,
          '--output',
          outStem,
          '--input',
          path.resolve(clip.fbx),
        ],
        { stdio: args.debug ? 'inherit' : 'pipe' },
      );

      const animDoc = await io.read(outGlb);
      const anims = animDoc.getRoot().listAnimations();
      if (!anims.length) throw new Error(`No animations found in converted FBX: ${clip.fbx}`);

      anims.sort((a, b) => b.listChannels().length - a.listChannels().length);
      const srcAnim = anims[0];
      const dstAnim = baseDoc.createAnimation(clip.name);

      const samplerMap = new Map();
      for (const srcSampler of srcAnim.listSamplers()) {
        const input = srcSampler.getInput();
        const output = srcSampler.getOutput();
        if (!input || !output) continue;

        const dstSampler = baseDoc.createAnimationSampler(clip.name);
        dstSampler.setInterpolation(srcSampler.getInterpolation());
        dstSampler.setInput(copyAccessor(baseDoc, input, `${clip.name}__time`));

        const outputAccessor = copyAccessor(baseDoc, output, `${clip.name}__values`);
        dstSampler.setOutput(outputAccessor);
        dstAnim.addSampler(dstSampler);
        samplerMap.set(srcSampler, dstSampler);
      }

      for (const srcChannel of srcAnim.listChannels()) {
        const srcTargetNode = srcChannel.getTargetNode();
        const targetName = srcTargetNode ? srcTargetNode.getName() : '';
        const dstTargetNode = baseLookup.resolve(targetName);
        if (!dstTargetNode) {
          const key = targetName || '(unnamed)';
          missingTargets.set(key, (missingTargets.get(key) ?? 0) + 1);
          continue;
        }

        const srcSampler = srcChannel.getSampler();
        const dstSampler = samplerMap.get(srcSampler);
        if (!dstSampler) continue;

        const dstChannel = baseDoc.createAnimationChannel(clip.name);
        dstChannel.setSampler(dstSampler);
        dstChannel.setTargetNode(dstTargetNode);
        dstChannel.setTargetPath(srcChannel.getTargetPath());

        // Optional: zero root-motion translation on hips/root bones.
        if (args.inPlaceRoot && srcChannel.getTargetPath() === 'translation' && shouldZeroRootTranslation(dstTargetNode.getName())) {
          const out = dstSampler.getOutput();
          const arr = out.getArray();
          for (let i = 0; i < arr.length; i += 3) {
            arr[i + 0] = 0; // x
            arr[i + 2] = 0; // z
          }
          out.setArray(arr);
        }

        dstAnim.addChannel(dstChannel);
      }

      addedClipNames.push(clip.name);
    }

    if (missingTargets.size) {
      const first = [...missingTargets.entries()].slice(0, 30);
      throw new Error(
        `Some animation targets were not found in base GLB. First 30:\n` +
          first.map(([name, count]) => `- ${name} (channels skipped: ${count})`).join('\n'),
      );
    }

    // Write to a temp file first, then move into place.
    const outDir = path.dirname(args.out);
    mkdirSync(outDir, { recursive: true });
    const outTemp = path.join(outDir, `.tmp.${path.basename(args.out)}.${Date.now()}.glb`);
    await io.write(outTemp, baseDoc);

    // Atomic-ish replace.
    renameSync(outTemp, args.out);

    if (args.debug) {
      // eslint-disable-next-line no-console
      console.log(`Added clips: ${addedClipNames.join(', ')}`);
    }
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

await main();
