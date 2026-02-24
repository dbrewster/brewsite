/**
 * Model element metadata - types for runtime asset manifest v2.
 *
 * Defines the schema for public/assets/scene-manifest.json,
 * generated at build time by scripts/gen-scene-dsl.mjs.
 */

import type { ClipMeta } from '../../compiler/sceneTrackTypes';
import type { SceneModelInstanceState, Vec3 } from './types';

export const ASSET_MANIFEST_VERSION = 2;

// ─── Anchor Targets ─────────────────────────────────────────────────────────

/** Maps anchor key names (e.g. 'head', 'chest') to actual bone node names in the GLB. */
export type AnchorTargetMap = Record<string, string>;

// ─── Body Part Groups ────────────────────────────────────────────────────────

/**
 * A canonical grouping of one or more bones and meshes representing the same
 * anatomical part. Derived at build time by the generator's bag-of-words
 * matching algorithm (side + base tokens). Used to produce unified DSL
 * components that route material overrides to the mesh and pose overrides to
 * the bone in a single authoring expression.
 */
export type BodyPartGroup = {
  /** PascalCase component name derived from the bone display name (e.g. 'RightForeArm'). */
  name: string;
  /** GLB bone/joint names for pose overrides (may be empty). */
  boneIds: string[];
  /** GLB mesh names for material overrides (may be empty). */
  meshIds: string[];
};

// ─── Model Metadata ─────────────────────────────────────────────────────────

export type ModelMeta = {
  type: string;
  glb: string;
  bones: string[];
  meshes: string[];
  /** Y offset from model origin to feet (scale=1). Computed at build time with optional delta. */
  footOffsetY?: number;
  /** Resolved anchor targets: anchorKey → bone node name. */
  anchorTargets: AnchorTargetMap;
  bodyParts?: string[];
  /**
   * Canonical body part groups built by the generator's bag-of-words matching.
   * Optional for backward compatibility — old manifests may omit this field.
   */
  bodyPartGroups?: BodyPartGroup[];
  /** Fully specified default state derived from the GLB. */
  identity: SceneModelInstanceState;
};

// ─── Contained Model Metadata ────────────────────────────────────────────────

export type ContainedModelMeta = {
  type: string;
  glb: string;
  subparts: string[];
  target?: string;
  position?: Vec3;
  rotation?: Vec3;
  scale?: number;
};

// ─── Animation Entry ─────────────────────────────────────────────────────────

export type AnimationEntry = {
  type: string;
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
export const findModelMeta = (manifest: AssetManifest, modelType: string): ModelMeta | undefined =>
  manifest.models.find((m) => m.type === modelType);

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
