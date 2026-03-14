/**
 * ModelRenderer - Three.js rendering for model elements.
 *
 * Responsibilities:
 * - Load GLB models (primary + contained models)
 * - Apply model state (position, rotation, scale)
 * - Orchestrate animation playback via ModelAnimationPlayer
 * - Apply material overrides via ModelMaterialManager
 * - Manage contained model attachments and pose overrides
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { MeshoptDecoder } from 'meshoptimizer';
import type { Vec3, ModelPartSpec, ModelSubpartSpec } from './types';
import type { ModelRenderInstanceState } from './_renderTypes';
import type { CompiledAnimation } from './compile';
import type { WidgetRenderContext } from '@brewsite/core';
import { applyModelTransform } from './render';
import type { IRenderable as RenderInterface } from './render';
import type { AssetManifest, AnimationEntry, ModelMeta } from './metadata';
import { ModelAnimationPlayer } from './ModelAnimationPlayer';
import { ModelMaterialManager } from './ModelMaterialManager';

const applyMultiplier = (value: number | undefined, multiplier: number): number | undefined =>
  typeof value === 'number' ? value * multiplier : value;

type LoadOptions = {
  anchorTargets?: Record<string, string>;
  manifest?: AssetManifest | null;
  containedModels?: ModelMeta[];
  footOffsetY?: number;
  baseRotation?: Vec3;
};

type ContainedInstance = {
  modelId: string;
  group: THREE.Group;
  model: THREE.Group;
};

type CachedGltf = {
  scene: THREE.Group;
  animations: THREE.AnimationClip[];
};

export class ModelRenderer {
  private scene: THREE.Scene;
  private renderer?: THREE.WebGLRenderer;
  private model: THREE.Group | null = null;
  private animationPlayer!: ModelAnimationPlayer;
  private materialManager!: ModelMaterialManager;
  private baseRotation: Vec3 | null = null;
  private warnedMissingPoseTargets = new Set<string>();
  private warnedMissingMeshes = new Set<string>();
  private warnedMissingContainedModels = new Set<string>();
  private warnedMissingAnchors = new Set<string>();
  private warnedResolvedAnchors = new Set<string>();
  private warnedMissingSubparts = new Set<string>();
  private bodyPartMeshMap = new Map<string, string>();
  private lastPoseOverrideBase = new Map<string, { position: Vec3; rotation: Vec3; scale: Vec3 }>();

  private anchorTargets: Record<string, string> = {};
  private footOffsetY = 0;
  private nodeByName = new Map<string, THREE.Object3D>();
  private boneByName = new Map<string, THREE.Object3D>();
  private meshByName = new Map<string, THREE.Mesh>();
  private boneByNormalizedName = new Map<string, THREE.Object3D>();

  private containedModelTemplates = new Map<string, THREE.Group>();
  private attachedParts = new Map<string, ContainedInstance>();

  private static gltfCache = new Map<string, Promise<CachedGltf>>();

  static clearCache(): void { ModelRenderer.gltfCache.clear(); }

  private static ktx2Loaders = new WeakMap<THREE.WebGLRenderer, KTX2Loader>();
  private static getKtx2Loader(renderer: THREE.WebGLRenderer): KTX2Loader {
    const existing = ModelRenderer.ktx2Loaders.get(renderer);
    if (existing) return existing;
    const loader = new KTX2Loader();
    loader.setTranscoderPath('/assets/basis/');
    loader.detectSupport(renderer);
    ModelRenderer.ktx2Loaders.set(renderer, loader);
    return loader;
  }

  static disposeKtx2Loader(renderer: THREE.WebGLRenderer): void {
    const loader = ModelRenderer.ktx2Loaders.get(renderer);
    if (!loader) return;
    loader.dispose();
    ModelRenderer.ktx2Loaders.delete(renderer);
  }

  constructor(scene: THREE.Scene, renderer?: THREE.WebGLRenderer) {
    this.scene = scene;
    this.renderer = renderer;
  }

  /**
   * Load a GLB model from a URL (and optional contained models / animations from manifest).
   */
  async loadGlb(glbUrl: string, options?: LoadOptions): Promise<void> {
    this.clearContainedModels();
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    if (this.renderer) {
      loader.setKTX2Loader(ModelRenderer.getKtx2Loader(this.renderer));
    }

    const gltf = await ModelRenderer.loadGltfCached(
      loader,
      glbUrl,
      ModelRenderer.getGltfCacheKey(glbUrl, !!this.renderer),
    );
    const scene = SkeletonUtils.clone(gltf.scene) as THREE.Group;

    this.anchorTargets = options?.anchorTargets ?? {};
    this.footOffsetY = typeof options?.footOffsetY === 'number' ? options.footOffsetY : 0;
    this.baseRotation = options?.baseRotation ?? null;
    this.ingestModel(scene, gltf.animations ?? []);

    const manifest = options?.manifest ?? null;
    const containedModels = options?.containedModels ?? [];
    if (containedModels.length > 0) {
      await this.loadContainedModels(loader, containedModels);
    }
    if (manifest) {
      await this.loadAnimationClips(loader, manifest.animations ?? []);
    }
  }

  /**
   * Apply model state to the Three.js scene.
   * state.model must be a ModelRenderInput (world-space position already resolved by ModelWidget).
   */
  apply(
    state: ModelRenderInstanceState,
    animation?: CompiledAnimation,
    ctx?: WidgetRenderContext,
  ): void {
    if (!this.model) return;

    this.restorePoseOverrideBase();
    this.lastPoseOverrideBase.clear();

    const group = this.model;
    const wrapper: RenderInterface = {
      get localPosition() {
        const pos = group.position;
        return [pos.x, pos.y, pos.z] as Vec3;
      },
      set localPosition(value: Vec3) {
        group.position.set(value[0], value[1], value[2]);
      },
      get localRotation() {
        const euler = new THREE.Euler().setFromQuaternion(group.quaternion);
        return [euler.x, euler.y, euler.z] as Vec3;
      },
      set localRotation(value: Vec3) {
        group.quaternion.setFromEuler(new THREE.Euler(value[0], value[1], value[2]));
      },
      get localScale() {
        const scale = group.scale;
        return [scale.x, scale.y, scale.z] as Vec3;
      },
      set localScale(value: Vec3) {
        group.scale.set(value[0], value[1], value[2]);
      },
    };

    // Apply the model transform (with optional foot offset)
    const footOffset = this.footOffsetY * (state.model.scale ?? 1);
    const withBaseRotation: Vec3 = this.baseRotation
      ? [
        state.model.rotation[0] + this.baseRotation[0],
        state.model.rotation[1] + this.baseRotation[1],
        state.model.rotation[2] + this.baseRotation[2],
      ]
      : state.model.rotation;
    const adjustedModel = footOffset !== 0
      ? { ...state.model, position: [state.model.position[0], state.model.position[1] - footOffset, state.model.position[2]] as Vec3, rotation: withBaseRotation }
      : { ...state.model, rotation: withBaseRotation };
    applyModelTransform(adjustedModel, wrapper);

    const effectiveOpacity = state.model.enabled === false ? 0 : state.model.opacity;

    // Apply material overrides
    this.applyBodyPartOverrides(state, effectiveOpacity);

    // Apply contained model attachments
    this.applyModelParts(
      state.model.parts ?? {},
      effectiveOpacity,
      state.model.metalnessMultiplier ?? 1,
      state.model.roughnessMultiplier ?? 1,
    );

    // Delegate all animation and custom animation to the player
    this.animationPlayer.apply(state, animation, ctx, this.nodeByName);

    // Apply body part pose overrides last so they are visible on top of animations.
    this.applyBodyPartPoseOverrides(state);
  }

  /**
   * Get world positions of all bones.
   */
  getBoneWorldPositions(): Map<string, [number, number, number]> {
    const result = new Map<string, [number, number, number]>();
    if (!this.model) return result;
    this.model.updateMatrixWorld(true);
    for (const [name, node] of this.boneByName) {
      const pos = new THREE.Vector3();
      node.getWorldPosition(pos);
      result.set(name, [pos.x, pos.y, pos.z]);
    }
    for (const [name, node] of this.nodeByName) {
      if (result.has(name)) continue;
      const pos = new THREE.Vector3();
      node.getWorldPosition(pos);
      result.set(name, [pos.x, pos.y, pos.z]);
    }
    for (const [partId, instance] of this.attachedParts) {
      instance.group.updateMatrixWorld(true);
      instance.model.traverse((obj) => {
        if (!obj.name) return;
        const pos = new THREE.Vector3();
        obj.getWorldPosition(pos);
        result.set(`${partId}:${obj.name}`, [pos.x, pos.y, pos.z]);
      });
    }
    return result;
  }

  /**
   * Find a node by name.
   */
  findNodeByName(name: string): THREE.Object3D | undefined {
    return this.nodeByName.get(name);
  }

  /**
   * Dispose of resources.
   */
  dispose(): void {
    if (this.model) {
      this.scene.remove(this.model);
      this.disposeObject3D(this.model);
      this.model = null;
    }
    if (this.animationPlayer) {
      this.animationPlayer.dispose();
    }
    if (this.materialManager) {
      this.materialManager.disposeMaterials();
    }
    this.nodeByName.clear();
    this.boneByName.clear();
    this.boneByNormalizedName.clear();
    this.meshByName.clear();
    this.clearContainedModels();
    this.bodyPartMeshMap.clear();
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Internal helpers
  // ────────────────────────────────────────────────────────────────────────────

  protected ingestModel(group: THREE.Group, clips: THREE.AnimationClip[]): void {
    if (this.model) {
      this.scene.remove(this.model);
      this.disposeObject3D(this.model);
    }
    this.model = group;
    this.scene.add(group);

    this.nodeByName.clear();
    this.boneByName.clear();
    this.meshByName.clear();

    // Instantiate fresh managers for this model instance
    this.animationPlayer = new ModelAnimationPlayer(group);
    this.materialManager = new ModelMaterialManager();

    group.traverse((obj) => {
      if (!obj.name) return;
      this.nodeByName.set(obj.name, obj);
      if ((obj as THREE.Bone).isBone || obj.type === 'Bone') {
        this.boneByName.set(obj.name, obj);
        const normalized = this.normalizeAnchorName(obj.name);
        if (normalized) {
          this.boneByNormalizedName.set(normalized, obj);
        }
      }
      if ((obj as THREE.Mesh).isMesh || obj.type === 'Mesh') {
        const mesh = obj as THREE.Mesh;
        // Ensure per-mesh material instances so overrides don't bleed across shared materials.
        if (Array.isArray(mesh.material)) {
          mesh.material = mesh.material.map((mat) => (mat ? mat.clone() : mat));
        } else if (mesh.material) {
          mesh.material = mesh.material.clone();
        }
        this.meshByName.set(mesh.name, mesh);
        this.materialManager.cacheMaterial(mesh.material);
      }
    });

    this.animationPlayer.addClips(clips);
  }

  private static getGltfCacheKey(glbUrl: string, hasRenderer: boolean): string {
    return `${glbUrl}|ktx2:${hasRenderer ? 1 : 0}`;
  }

  private static loadGltfCached(
    loader: GLTFLoader,
    glbUrl: string,
    cacheKey: string,
  ): Promise<CachedGltf> {
    const cached = ModelRenderer.gltfCache.get(cacheKey);
    if (cached) return cached;
    const pending = new Promise<CachedGltf>((resolve, reject) => {
      loader.load(
        glbUrl,
        (loaded) => resolve({ scene: loaded.scene, animations: loaded.animations ?? [] }),
        undefined,
        (error) => reject(error),
      );
    });
    ModelRenderer.gltfCache.set(cacheKey, pending);
    return pending;
  }

  private async loadContainedModels(loader: GLTFLoader, models: ModelMeta[]): Promise<void> {
    const loads = models.map(async (meta) => {
      const gltf = await ModelRenderer.loadGltfCached(
        loader,
        meta.glb,
        ModelRenderer.getGltfCacheKey(meta.glb, !!this.renderer),
      );
      return { id: meta.type, group: SkeletonUtils.clone(gltf.scene) as THREE.Group };
    });

    const results = await Promise.all(loads);
    for (const entry of results) {
      this.containedModelTemplates.set(entry.id, entry.group);
    }
  }

  private async loadAnimationClips(loader: GLTFLoader, animations: AnimationEntry[]): Promise<void> {
    if (animations.length === 0) return;
    const loads = animations.map(async (entry) => {
      const gltf = await ModelRenderer.loadGltfCached(
        loader,
        entry.glb,
        ModelRenderer.getGltfCacheKey(entry.glb, !!this.renderer),
      );
      return { entry, clips: gltf.animations ?? [] };
    });

    const results = await Promise.all(loads);
    for (const result of results) {
      const clip = THREE.AnimationClip.findByName(result.clips, result.entry.clipName);
      if (clip) {
        const normalized = clip.clone();
        normalized.name = result.entry.clipName;
        this.remapClipTrackNames(normalized);
        this.animationPlayer.addRemappedClip(result.entry.clipName, normalized);
      }
    }
  }

  // DEBT: Expose bone root remap table as configurable via ModelMeta/LoadOptions
  private remapClipTrackNames(clip: THREE.AnimationClip): void {
    const remap = new Map<string, string>();
    if (!this.nodeByName.has('CC_Base_BoneRoot')) {
      const resolved = this.nodeByName.has('RL_BoneRoot')
        ? 'RL_BoneRoot'
        : (this.nodeByName.has('RootNode') ? 'RootNode' : null);
      if (resolved) remap.set('CC_Base_BoneRoot', resolved);
    }
    if (remap.size === 0) return;

    const validTargets = new Set([
      ...this.nodeByName.keys(),
      ...this.boneByName.keys(),
      ...this.meshByName.keys(),
    ]);
    const nextTracks: THREE.KeyframeTrack[] = [];
    for (const track of clip.tracks) {
      for (const [from, to] of remap) {
        const prefix = `${from}.`;
        if (track.name.startsWith(prefix)) {
          track.name = `${to}.${track.name.slice(prefix.length)}`;
          break;
        }
      }
      const targetName = track.name.split('.')[0];
      if (!validTargets.has(targetName)) continue;
      nextTracks.push(track);
    }
    clip.tracks = nextTracks;
  }

  private applyBodyPartOverrides(
    state: ModelRenderInstanceState,
    modelOpacityOverride?: number,
  ): void {
    if (!this.model) return;
    this.bodyPartMeshMap.clear();
    const metalnessMultiplier = state.model.metalnessMultiplier ?? 1;
    const roughnessMultiplier = state.model.roughnessMultiplier ?? 1;
    const baseMetalness = applyMultiplier(state.model.metalness, metalnessMultiplier);
    const baseRoughness = applyMultiplier(state.model.roughness, roughnessMultiplier);
    const modelOpacity = modelOpacityOverride ?? state.model.opacity;

    for (const mesh of this.meshByName.values()) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.materialManager.applyOverrides(mesh.material, {
        opacity: modelOpacity,
        metalness: baseMetalness,
        roughness: baseRoughness,
      });
      if (typeof modelOpacity === 'number') {
        mesh.visible = modelOpacity > 0;
      } else {
        mesh.visible = true;
      }
    }

    const overrides = state.model.bodyPartOverrides ?? {};
    for (const [id, override] of Object.entries(overrides)) {
      if (!override) continue;
      // Determine mesh lookup target:
      // 1. Explicit meshId on the override (linked bone+mesh component)
      // 2. Direct id — but only when not bone-only (targetKind !== 'bone')
      const meshLookupId = override.meshId
        ?? (override.targetKind === 'bone' ? null : id);
      if (meshLookupId === null) continue; // bone-only entry — no material to apply

      this.bodyPartMeshMap.set(id, meshLookupId);
      if (override.boneId) {
        this.bodyPartMeshMap.set(override.boneId, meshLookupId);
      }

      const mesh = this.meshByName.get(meshLookupId);
      if (!mesh && !this.warnedMissingMeshes.has(meshLookupId)) {
        console.warn(`[ModelRenderer] missing mesh for BodyPart override "${meshLookupId}"`);
        this.warnedMissingMeshes.add(meshLookupId);
      }
      if (!mesh) continue;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      const opacity =
        typeof modelOpacity === 'number'
          ? (typeof override.opacity === 'number' ? override.opacity : 1) * modelOpacity
          : override.opacity;
      const overrideMetalness =
        override.metalness !== undefined
          ? applyMultiplier(override.metalness, metalnessMultiplier)
          : baseMetalness;
      const overrideRoughness =
        override.roughness !== undefined
          ? applyMultiplier(override.roughness, roughnessMultiplier)
          : baseRoughness;
      this.materialManager.applyOverrides(mesh.material, {
        color: override.color,
        opacity,
        metalness: overrideMetalness,
        roughness: overrideRoughness,
      });
      if (typeof opacity === 'number') {
        mesh.visible = opacity > 0;
      }
    }
  }

  getTargetColors(): Map<string, string> {
    const result = new Map<string, string>();

    const readMaterialColor = (material: THREE.Material | THREE.Material[] | undefined): string | null => {
      if (!material) return null;
      const materials = Array.isArray(material) ? material : [material];
      for (const mat of materials) {
        const color = (mat as THREE.MeshStandardMaterial).color;
        if (color && typeof color.getHexString === 'function') {
          return `#${color.getHexString()}`;
        }
      }
      return null;
    };

    for (const [name, mesh] of this.meshByName) {
      const color = readMaterialColor(mesh.material);
      if (color) {
        result.set(name, color);
      }
    }

    for (const [targetId, meshId] of this.bodyPartMeshMap) {
      const mesh = this.meshByName.get(meshId);
      const color = mesh ? readMaterialColor(mesh.material) : result.get(meshId);
      if (color) {
        result.set(targetId, color);
      }
    }

    for (const [partId, instance] of this.attachedParts) {
      instance.model.traverse((obj) => {
        if (!obj.name) return;
        if (!((obj as THREE.Mesh).isMesh || obj.type === 'Mesh')) return;
        const mesh = obj as THREE.Mesh;
        const color = readMaterialColor(mesh.material);
        if (color) {
          result.set(`${partId}:${obj.name}`, color);
        }
      });
    }

    return result;
  }

  private applyBodyPartPoseOverrides(state: ModelRenderInstanceState): void {
    if (!this.model) return;
    const overrides = state.model.bodyPartOverrides ?? {};
    const basePose = this.capturePose();

    for (const [id, override] of Object.entries(overrides)) {
      if (!override?.pose) continue;
      // Use explicit boneId for pose target lookup when available (linked component)
      const poseLookupId = override.boneId ?? id;
      // Determine targetKind for pose resolution:
      // - explicit boneId → prefer bone lookup
      // - explicit meshId but no boneId → prefer mesh lookup
      // - otherwise fall through to the targetKind field
      const poseTargetKind: 'bone' | 'mesh' | undefined = override.boneId
        ? 'bone'
        : override.meshId
          ? 'mesh'
          : override.targetKind;
      const target = this.resolvePoseTarget(poseLookupId, poseTargetKind);
      if (!target) {
        if (!this.warnedMissingPoseTargets.has(poseLookupId)) {
          console.warn(
            `[ModelRenderer] missing pose target "${poseLookupId}" (targetKind=${poseTargetKind ?? 'auto'})`,
          );
          this.warnedMissingPoseTargets.add(poseLookupId);
        }
        continue;
      }
      const base = basePose.get(target.name);
      if (!base && !this.warnedMissingPoseTargets.has(`${poseLookupId}::base`)) {
        console.warn(
          `[ModelRenderer] missing base pose for "${poseLookupId}" (resolved to "${target.name}")`,
        );
        this.warnedMissingPoseTargets.add(`${poseLookupId}::base`);
      }
      if (!base) continue;

      this.lastPoseOverrideBase.set(target.name, {
        position: [base.position[0], base.position[1], base.position[2]],
        rotation: [base.rotation[0], base.rotation[1], base.rotation[2]],
        scale: [base.scale[0], base.scale[1], base.scale[2]],
      });

      if (override.pose.rotate) {
        const yaw = override.pose.rotate.yawPct ?? 0;
        const pitch = override.pose.rotate.pitchPct ?? 0;
        const roll = override.pose.rotate.rollPct ?? 0;
        target.rotation.set(
          base.rotation[0] + pitch,
          base.rotation[1] + yaw,
          base.rotation[2] + roll,
        );
      }

      if (override.pose.translate) {
        const x = override.pose.translate.xPct ?? 0;
        const y = override.pose.translate.yPct ?? 0;
        const z = override.pose.translate.zPct ?? 0;
        target.position.set(
          base.position[0] + x,
          base.position[1] + y,
          base.position[2] + z,
        );
      }
    }
  }

  private resolvePoseTarget(
    id: string,
    targetKind?: 'bone' | 'mesh',
  ): THREE.Object3D | undefined {
    if (targetKind === 'bone') {
      return this.boneByName.get(id) ?? this.nodeByName.get(id) ?? this.meshByName.get(id);
    }
    if (targetKind === 'mesh') {
      return this.meshByName.get(id) ?? this.nodeByName.get(id) ?? this.boneByName.get(id);
    }
    return this.boneByName.get(id) ?? this.meshByName.get(id) ?? this.nodeByName.get(id);
  }

  private resolveAnchorTarget(anchorName: string): THREE.Object3D | undefined {
    const direct = this.resolvePoseTarget(anchorName);
    if (direct) return direct;
    const normalized = this.normalizeAnchorName(anchorName);
    if (!normalized) return undefined;
    let resolved = this.boneByNormalizedName.get(normalized);
    if (!resolved) {
      const prefixed = this.normalizeAnchorName(`mixamorig${anchorName}`);
      resolved = this.boneByNormalizedName.get(prefixed);
    }
    if (!resolved) {
      const prefixed = this.normalizeAnchorName(`mixamorig:${anchorName}`);
      resolved = this.boneByNormalizedName.get(prefixed);
    }
    if (!resolved) {
      const prefixed = this.normalizeAnchorName(`CC_Base_${anchorName}`);
      resolved = this.boneByNormalizedName.get(prefixed);
    }
    if (resolved && !this.warnedResolvedAnchors.has(anchorName)) {
      this.warnedResolvedAnchors.add(anchorName);
    }
    return resolved;
  }

  private normalizeAnchorName(name: string): string {
    return name
      .replace(/^mixamorig:/i, '')
      .replace(/^mixamorig/i, '')
      .replace(/^cc_base_/i, '')
      .replace(/[^a-z0-9]/gi, '')
      .toLowerCase();
  }

  private applyModelParts(
    parts: Record<string, ModelPartSpec>,
    modelOpacity?: number,
    metalnessMultiplier = 1,
    roughnessMultiplier = 1,
  ): void {
    if (!this.model) return;
    const partIds = new Set(Object.keys(parts));

    // Remove stale attachments
    for (const [id, instance] of this.attachedParts) {
      if (partIds.has(id)) continue;
      instance.group.removeFromParent();
      this.disposeObject3D(instance.group);
      this.attachedParts.delete(id);
    }

    for (const part of Object.values(parts)) {
      if (!part?.modelId) continue;
      const anchorName = this.anchorTargets[part.anchor] ?? part.anchor;
      const anchorNode = this.resolveAnchorTarget(anchorName);
      if (!anchorNode) {
        if (!this.warnedMissingAnchors.has(`${part.id}:${anchorName}`)) {
          console.warn(`[ModelRenderer] missing anchor "${anchorName}" for part "${part.id}"`);
          this.warnedMissingAnchors.add(`${part.id}:${anchorName}`);
        }
        continue;
      }

      const instance = this.getOrCreateContainedInstance(part);
      if (!instance) {
        if (!this.warnedMissingContainedModels.has(part.id)) {
          console.warn(`[ModelRenderer] missing contained model template "${part.modelId ?? ''}" for part "${part.id}"`);
          this.warnedMissingContainedModels.add(part.id);
        }
        continue;
      }

      if (instance.group.parent !== anchorNode) {
        anchorNode.add(instance.group);
      }

      instance.group.visible = part.enabled !== false;
      if (!instance.group.visible) continue;

      instance.model.position.set(
        part.containedPosition?.[0] ?? 0,
        part.containedPosition?.[1] ?? 0,
        part.containedPosition?.[2] ?? 0,
      );
      instance.model.rotation.set(
        part.containedRotation?.[0] ?? 0,
        part.containedRotation?.[1] ?? 0,
        part.containedRotation?.[2] ?? 0,
      );
      const containedScale = typeof part.containedScale === 'number' ? part.containedScale : 1;
      instance.model.scale.set(containedScale, containedScale, containedScale);

      const nextPosition = this.resolvePartPosition(part, anchorNode);
      instance.group.position.set(nextPosition[0], nextPosition[1], nextPosition[2]);
      instance.group.rotation.set(part.rotation[0], part.rotation[1], part.rotation[2]);
      instance.group.scale.set(part.scale, part.scale, part.scale);

      this.applyContainedOverrides(
        instance.group,
        part,
        modelOpacity,
        metalnessMultiplier,
        roughnessMultiplier,
      );
    }
  }

  private resolvePartPosition(part: ModelPartSpec, anchorNode: THREE.Object3D): Vec3 {
    if ((part.space ?? 'local') === 'local') {
      return part.position;
    }
    this.model?.updateMatrixWorld(true);
    const worldPos = new THREE.Vector3(part.position[0], part.position[1], part.position[2]);
    anchorNode.updateMatrixWorld(true);
    const local = anchorNode.worldToLocal(worldPos);
    return [local.x, local.y, local.z];
  }

  private getOrCreateContainedInstance(part: ModelPartSpec): ContainedInstance | null {
    const existing = this.attachedParts.get(part.id);
    if (existing) return existing;
    const template = this.containedModelTemplates.get(part.modelId ?? '');
    if (!template) return null;
    const clone = template.clone(true) as THREE.Group;
    const wrapper = new THREE.Group();
    wrapper.add(clone);
    clone.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh || obj.type === 'Mesh') {
        const mesh = obj as THREE.Mesh;
        if (Array.isArray(mesh.material)) {
          mesh.material = mesh.material.map((mat) => mat.clone());
        } else if (mesh.material) {
          mesh.material = mesh.material.clone();
        }
        this.materialManager.cacheMaterial(mesh.material);
      }
    });
    const instance = { modelId: part.modelId ?? '', group: wrapper, model: clone };
    this.attachedParts.set(part.id, instance);
    return instance;
  }

  private clearContainedModels(): void {
    for (const instance of this.attachedParts.values()) {
      this.disposeObject3D(instance.group);
    }
    for (const template of this.containedModelTemplates.values()) {
      this.disposeObject3D(template);
    }
    this.attachedParts.clear();
    this.containedModelTemplates.clear();
  }

  private disposeObject3D(root: THREE.Object3D): void {
    root.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.geometry) {
        mesh.geometry.dispose();
      }
      const material = (mesh as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
      if (material) {
        if (Array.isArray(material)) {
          material.forEach((mat) => this.disposeMaterial(mat));
        } else {
          this.disposeMaterial(material);
        }
      }
    });
  }

  private disposeMaterial(material: THREE.Material): void {
    const mat = material as unknown as Record<string, unknown>;
    for (const value of Object.values(mat)) {
      if (value && typeof value === 'object' && (value as THREE.Texture).isTexture) {
        (value as THREE.Texture).dispose();
      }
    }
    material.dispose();
  }

  private applyContainedOverrides(
    group: THREE.Group,
    part: ModelPartSpec,
    modelOpacity?: number,
    metalnessMultiplier = 1,
    roughnessMultiplier = 1,
  ): void {
    const opacityScale = typeof modelOpacity === 'number' ? modelOpacity : undefined;
    group.traverse((obj) => {
      if (!((obj as THREE.Mesh).isMesh || obj.type === 'Mesh')) return;
      const mesh = obj as THREE.Mesh;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      const opacity =
        typeof opacityScale === 'number'
          ? (typeof part.opacity === 'number' ? part.opacity : 1) * opacityScale
          : part.opacity;
      this.materialManager.applyOverrides(mesh.material, {
        metalness: applyMultiplier(part.metalness, metalnessMultiplier),
        roughness: applyMultiplier(part.roughness, roughnessMultiplier),
        opacity,
      });
      if (typeof opacity === 'number') {
        mesh.visible = opacity > 0;
      }
    });

    const subparts = part.subparts ?? {};
    for (const [id, spec] of Object.entries(subparts) as Array<[string, ModelSubpartSpec]>) {
      const node = group.getObjectByName(id) as THREE.Mesh | null;
      if (!node) {
        const key = `${part.id}:${id}`;
        if (!this.warnedMissingSubparts.has(key)) {
          console.warn(`[ModelRenderer] missing subpart "${id}" on part "${part.id}"`);
          this.warnedMissingSubparts.add(key);
        }
        continue;
      }
      if ((node as THREE.Mesh).isMesh || node.type === 'Mesh') {
        const mesh = node as THREE.Mesh;
        const subOpacity = typeof spec.opacity === 'number' ? spec.opacity : 1;
        const baseOpacity = spec.enabled === false ? 0 : subOpacity;
        const opacity =
          typeof opacityScale === 'number' ? baseOpacity * opacityScale : baseOpacity;
        this.materialManager.applyOverrides(mesh.material, {
          color: spec.color,
          opacity,
          metalness: applyMultiplier(spec.metalness, metalnessMultiplier),
          roughness: applyMultiplier(spec.roughness, roughnessMultiplier),
        });
        mesh.visible = spec.enabled !== false && opacity > 0;
      }
    }
  }

  private capturePose(): Map<string, { position: Vec3; rotation: Vec3; scale: Vec3 }> {
    const pose = new Map<string, { position: Vec3; rotation: Vec3; scale: Vec3 }>();
    if (!this.model) return pose;
    this.model.traverse((obj) => {
      if (!obj.name) return;
      pose.set(obj.name, {
        position: [obj.position.x, obj.position.y, obj.position.z],
        rotation: [obj.rotation.x, obj.rotation.y, obj.rotation.z],
        scale: [obj.scale.x, obj.scale.y, obj.scale.z],
      });
    });
    return pose;
  }

  private restorePoseOverrideBase(): void {
    if (!this.model || this.lastPoseOverrideBase.size === 0) return;
    for (const [name, snapshot] of this.lastPoseOverrideBase) {
      const node = this.nodeByName.get(name);
      if (!node) continue;
      node.position.set(snapshot.position[0], snapshot.position[1], snapshot.position[2]);
      node.rotation.set(snapshot.rotation[0], snapshot.rotation[1], snapshot.rotation[2]);
      node.scale.set(snapshot.scale[0], snapshot.scale[1], snapshot.scale[2]);
    }
  }
}
