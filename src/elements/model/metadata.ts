/**
 * Model element metadata - types for runtime asset manifest v2.
 *
 * Defines the schema for public/assets/scene-manifest.json,
 * generated at build time by scripts/gen-scene-dsl.mjs.
 */

import type { ClipMeta } from '../../compiler/sceneTrackTypes';

export const ASSET_MANIFEST_VERSION = 2;

// ─── Anchor Targets ─────────────────────────────────────────────────────────

/** Maps anchor key names (e.g. 'head', 'chest') to actual bone node names in the GLB. */
export type AnchorTargetMap = Record<string, string>;

// ─── Model Metadata ─────────────────────────────────────────────────────────

export type ModelMeta = {
  id: string;
  glb: string;
  bones: string[];
  meshes: string[];
  /** Resolved anchor targets: anchorKey → bone node name. */
  anchorTargets: AnchorTargetMap;
  bodyParts?: string[];
};

// ─── Contained Model Metadata ────────────────────────────────────────────────

export type ContainedModelMeta = {
  id: string;
  glb: string;
  subparts: string[];
};

// ─── Animation Entry ─────────────────────────────────────────────────────────

export type AnimationEntry = {
  id: string;
  glb: string;
  clipName: string;
  duration: number;
};

// ─── Asset Manifest (v2 schema) ───────────────────────────────────────────────

export type AssetManifest = {
  version: number;
  models: ModelMeta[];
  containedModels: ContainedModelMeta[];
  animations: AnimationEntry[];
};

// ─── Conversion helpers ──────────────────────────────────────────────────────

/**
 * Converts manifest animation list to ClipMeta format.
 * ClipMeta.name maps to AnimationEntry.clipName (inside GLB).
 */
export const clipMetaFromManifest = (manifest: AssetManifest): ClipMeta[] =>
  manifest.animations.map((a) => ({
    name: a.clipName,
    duration: a.duration,
  }));

/**
 * Finds a model by ID in the manifest.
 */
export const findModelMeta = (manifest: AssetManifest, modelId: string): ModelMeta | undefined =>
  manifest.models.find((m) => m.id === modelId);

/**
 * Asserts manifest is valid at expected version.
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
  if (!Array.isArray(m['models'])) {
    throw new Error('[AssetManifest] manifest is missing models array');
  }
  if (!Array.isArray(m['containedModels'])) {
    throw new Error('[AssetManifest] manifest is missing containedModels array');
  }
  if (!Array.isArray(m['animations'])) {
    throw new Error('[AssetManifest] manifest is missing animations array');
  }
  return raw as AssetManifest;
};
