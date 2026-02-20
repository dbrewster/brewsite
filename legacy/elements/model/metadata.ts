/**
 * metadata.ts
 *
 * Types for the robot asset manifest (public/assets/robot-metadata.json).
 * Generated at build time by scripts/extract-model-metadata.mjs.
 *
 * This file is the TypeScript source of truth for the manifest schema.
 * The extraction script must produce JSON that satisfies AssetManifest.
 */

import type { ClipMeta } from './types';

/** Expected schema version. Consumers should assert this. */
export const ASSET_MANIFEST_VERSION = 1;

/** A single animation clip available for scene use. */
export type AnimationEntry = {
  /** Stable ID used in scene definitions to reference this clip. */
  id: string;
  /** Browser-fetchable URL for the GLB that contains this clip. */
  glb: string;
  /** The clip name as it appears inside the GLB (used for THREE.AnimationMixer lookup). */
  clipName: string;
  /** Clip duration in seconds, pre-computed from the GLB keyframe timestamps. */
  duration: number;
};

/** Bone names used to anchor sub-models (brain, chest particles). */
export type AnchorTargetMap = {
  /** Bone name in the robot skeleton where the brain model attaches. */
  head: string;
  /** Bone name in the robot skeleton where chest particles attach. */
  chest: string;
};

/** Metadata for the robot body GLB. */
export type ModelMeta = {
  /** Public URL of the GLB. */
  glb: string;
  /** All node names in the skeleton (bones + structural nodes), sorted. */
  bones: string[];
  /** All mesh names in the GLB, sorted. */
  meshes: string[];
  /** Pre-resolved anchor bones — use these instead of searching the scene graph. */
  anchorTargets: AnchorTargetMap;
};

/** Metadata for the brain sub-model GLB. */
export type BrainMeta = {
  /** Public URL of the GLB. */
  glb: string;
  /**
   * Primary region node names — valid keys for SceneModel.parts.*.subparts.
   * Does not include marker_ nodes.
   */
  subparts: string[];
};

/**
 * The full asset manifest for the robot experience.
 * Loaded from /assets/robot-metadata.json at runtime.
 */
export type AssetManifest = {
  /** Increment when the schema changes in a breaking way. */
  version: number;
  robot: ModelMeta;
  brain: BrainMeta;
  animations: AnimationEntry[];
};

/**
 * Converts the manifest's animation list to the ClipMeta format expected by
 * compileAnimation and the scene track compiler.
 *
 * ClipMeta.name maps to AnimationEntry.clipName (the name inside the GLB),
 * not AnimationEntry.id (the stable scene-authoring identifier).
 */
export const clipMetaFromManifest = (manifest: AssetManifest): ClipMeta[] =>
  manifest.animations.map((a) => ({ name: a.clipName, duration: a.duration }));

/**
 * Asserts that the loaded JSON is a valid AssetManifest at the expected version.
 * Throws if validation fails — callers should handle this as a fatal loading error.
 */
export const assertManifestValid = (raw: unknown): AssetManifest => {
  if (!raw || typeof raw !== 'object') {
    throw new Error('[AssetManifest] manifest is not an object');
  }
  const m = raw as Record<string, unknown>;
  if (m['version'] !== ASSET_MANIFEST_VERSION) {
    throw new Error(
      `[AssetManifest] version mismatch: expected ${ASSET_MANIFEST_VERSION}, got ${String(m['version'])}`,
    );
  }
  if (!m['robot'] || !m['brain'] || !Array.isArray(m['animations'])) {
    throw new Error('[AssetManifest] manifest is missing required fields (robot, brain, animations)');
  }
  return raw as AssetManifest;
};
