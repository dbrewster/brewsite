/**
 * ModelRenderer - Three.js rendering for model elements.
 *
 * Responsibilities:
 * - Load GLB models (primary + contained models)
 * - Apply model state (position, rotation, scale)
 * - Manage animation playback
 * - Apply material overrides + contained model attachments
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { MeshoptDecoder } from 'meshoptimizer';
import type { SceneModelInstanceState, Vec3, ModelPartSpec, ModelSubpartSpec, CustomAnimation, CustomAnimationOp } from './types';
import type { CompiledAnimation } from './compile';
import type { WidgetRenderContext } from '../../widget/types';
import { applyModelTransform } from './render';
import type { IRenderable as RenderInterface } from './render';
import type { AssetManifest, ContainedModelMeta, AnimationEntry } from './metadata';

type MaterialBase = {
  color?: THREE.Color;
  opacity?: number;
  transparent?: boolean;
  depthWrite?: boolean;
  metalness?: number;
  roughness?: number;
};

type LoadOptions = {
  anchorTargets?: Record<string, string>;
  manifest?: AssetManifest | null;
  footOffsetY?: number;
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
  private mixer: THREE.AnimationMixer | null = null;
  private animationClips = new Map<string, THREE.AnimationClip>();
  private activeClip: THREE.AnimationClip | null = null;
  private lastGlobalProgress: number | null = null;
  private initialStartOffsets = new Map<string, number>();
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
  private materialBase = new Map<string, MaterialBase>();
  private filteredClips = new Map<string, THREE.AnimationClip>();
  private rangedClips = new Map<string, THREE.AnimationClip>();

  private containedModelTemplates = new Map<string, THREE.Group>();
  private attachedParts = new Map<string, ContainedInstance>();

  private static gltfCache = new Map<string, Promise<CachedGltf>>();

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
    this.ingestModel(scene, gltf.animations ?? []);

    const manifest = options?.manifest ?? null;
    if (manifest) {
      await this.loadContainedModels(loader, manifest.containedModels ?? []);
      await this.loadAnimationClips(loader, manifest.animations ?? []);
    }
  }

  /**
   * Apply model state to the Three.js scene.
   */
  apply(
    state: SceneModelInstanceState,
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
    const adjustedModel = footOffset !== 0
      ? { ...state.model, position: [state.model.position[0], state.model.position[1] - footOffset, state.model.position[2]] as Vec3 }
      : state.model;
    applyModelTransform(adjustedModel, wrapper);

    const effectiveOpacity = state.model.enabled === false ? 0 : state.model.opacity;

    // Apply material overrides
    this.applyBodyPartOverrides(state, effectiveOpacity);

    // Apply contained model attachments
    this.applyModelParts(state.model.parts ?? {}, effectiveOpacity);

    if (animation?.enabled && animation.clipName) {
      const resetDueToProgress = this.shouldResetOnProgress(ctx?.globalProgress);
      this.applyAnimation(state, animation, ctx, resetDueToProgress);
    } else {
      this.clearActiveAnimation();
    }

    // Apply custom animations (if any)
    const customAnimations = state.playback.motion.customAnimations ?? [];
    if (customAnimations.length > 0) {
      this.applyCustomAnimations(customAnimations, ctx);
    }

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
    if (this.mixer) {
      this.mixer.stopAllAction();
      this.mixer = null;
    }
    this.animationClips.clear();
    this.activeClip = null;
    this.nodeByName.clear();
    this.boneByName.clear();
    this.boneByNormalizedName.clear();
    this.meshByName.clear();
    this.materialBase.clear();
    this.filteredClips.clear();
    this.rangedClips.clear();
    this.initialStartOffsets.clear();
    this.lastGlobalProgress = null;
    this.clearContainedModels();
    this.bodyPartMeshMap.clear();
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Internal helpers
  // ────────────────────────────────────────────────────────────────────────────

  private ingestModel(group: THREE.Group, clips: THREE.AnimationClip[]): void {
    if (this.model) {
      this.scene.remove(this.model);
      this.disposeObject3D(this.model);
    }
    this.model = group;
    this.scene.add(group);
    this.mixer = new THREE.AnimationMixer(group);

    this.nodeByName.clear();
    this.boneByName.clear();
    this.meshByName.clear();
    this.materialBase.clear();
    this.animationClips.clear();
    this.filteredClips.clear();
    this.rangedClips.clear();
    this.initialStartOffsets.clear();
    this.lastGlobalProgress = null;

    const seenMaterialUuids = new Set<string>();
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
          mesh.material = mesh.material.map((mat) => {
            if (!mat) return mat;
            if (seenMaterialUuids.has(mat.uuid)) {
              return mat.clone();
            }
            seenMaterialUuids.add(mat.uuid);
            return mat;
          });
        } else if (mesh.material) {
          const mat = mesh.material;
          if (seenMaterialUuids.has(mat.uuid)) {
            mesh.material = mat.clone();
          } else {
            seenMaterialUuids.add(mat.uuid);
          }
        }
        this.meshByName.set(mesh.name, mesh);
        this.cacheMaterialBase(mesh.material);
      }
    });

    clips.forEach((clip) => {
      if (!clip.name) return;
      this.animationClips.set(clip.name, clip);
    });
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

  private async loadContainedModels(loader: GLTFLoader, models: ContainedModelMeta[]): Promise<void> {
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
        this.animationClips.set(result.entry.clipName, normalized);
      }
    }
  }

  private applyBodyPartOverrides(
    state: SceneModelInstanceState,
    modelOpacityOverride?: number,
  ): void {
    if (!this.model) return;
    this.bodyPartMeshMap.clear();
    const baseMetalness = state.model.metalness;
    const baseRoughness = state.model.roughness;
    const modelOpacity = modelOpacityOverride ?? state.model.opacity;

    for (const mesh of this.meshByName.values()) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.applyMaterialOverrides(mesh.material, {
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
      this.applyMaterialOverrides(mesh.material, {
        color: override.color,
        opacity,
        metalness: override.metalness ?? baseMetalness,
        roughness: override.roughness ?? baseRoughness,
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

  private applyBodyPartPoseOverrides(state: SceneModelInstanceState): void {
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
    if (resolved && !this.warnedResolvedAnchors.has(anchorName)) {
      this.warnedResolvedAnchors.add(anchorName);
    }
    return resolved;
  }

  private normalizeAnchorName(name: string): string {
    return name.replace(/^mixamorig:/i, '').replace(/[^a-z0-9]/gi, '').toLowerCase();
  }

  private applyModelParts(parts: Record<string, ModelPartSpec>, modelOpacity?: number): void {
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

      this.applyContainedOverrides(instance.group, part, modelOpacity);
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
        this.cacheMaterialBase(mesh.material);
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

  private applyContainedOverrides(group: THREE.Group, part: ModelPartSpec, modelOpacity?: number): void {
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
      this.applyMaterialOverrides(mesh.material, {
        metalness: part.metalness,
        roughness: part.roughness,
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
        this.applyMaterialOverrides(mesh.material, {
          color: spec.color,
          opacity,
          metalness: spec.metalness,
          roughness: spec.roughness,
        });
        mesh.visible = spec.enabled !== false && opacity > 0;
      }
    }
  }

  private applyMaterialOverrides(
    material: THREE.Material | THREE.Material[],
    overrides: { color?: string; opacity?: number; metalness?: number; roughness?: number },
  ): void {
    const materials = Array.isArray(material) ? material : [material];
    materials.forEach((mat) => {
      if (!mat) return;
      const base = this.materialBase.get(mat.uuid);
      if (base) {
        if ('color' in mat && base.color) {
          (mat as THREE.MeshStandardMaterial).color.copy(base.color);
        }
        if (typeof base.opacity === 'number') {
          (mat as THREE.MeshStandardMaterial).opacity = base.opacity;
        }
        if (typeof base.transparent === 'boolean') {
          (mat as THREE.MeshStandardMaterial).transparent = base.transparent;
        }
        if (typeof base.depthWrite === 'boolean') {
          (mat as THREE.MeshStandardMaterial).depthWrite = base.depthWrite;
        }
        if (typeof base.metalness === 'number') {
          (mat as THREE.MeshStandardMaterial).metalness = base.metalness;
        }
        if (typeof base.roughness === 'number') {
          (mat as THREE.MeshStandardMaterial).roughness = base.roughness;
        }
      }
      if ('color' in mat && overrides.color) {
        (mat as THREE.MeshStandardMaterial).color = new THREE.Color(overrides.color);
      }
      if (typeof overrides.opacity === 'number') {
        (mat as THREE.MeshStandardMaterial).transparent = true;
        (mat as THREE.MeshStandardMaterial).opacity = overrides.opacity;
        const baseDepthWrite = base?.depthWrite ?? true;
        (mat as THREE.MeshStandardMaterial).depthWrite =
          overrides.opacity < 1 ? false : baseDepthWrite;
      }
      if (typeof overrides.metalness === 'number' && 'metalness' in mat) {
        (mat as THREE.MeshStandardMaterial).metalness = overrides.metalness;
      }
      if (typeof overrides.roughness === 'number' && 'roughness' in mat) {
        (mat as THREE.MeshStandardMaterial).roughness = overrides.roughness;
      }
    });
  }

  private cacheMaterialBase(material: THREE.Material | THREE.Material[]): void {
    const materials = Array.isArray(material) ? material : [material];
    materials.forEach((mat) => {
      if (!mat || this.materialBase.has(mat.uuid)) return;
      const base: MaterialBase = {};
      if ('color' in mat && (mat as THREE.MeshStandardMaterial).color) {
        base.color = (mat as THREE.MeshStandardMaterial).color.clone();
      }
      if ('opacity' in mat) base.opacity = (mat as THREE.MeshStandardMaterial).opacity;
      if ('transparent' in mat) base.transparent = (mat as THREE.MeshStandardMaterial).transparent;
      if ('depthWrite' in mat) base.depthWrite = (mat as THREE.MeshStandardMaterial).depthWrite;
      if ('metalness' in mat) base.metalness = (mat as THREE.MeshStandardMaterial).metalness;
      if ('roughness' in mat) base.roughness = (mat as THREE.MeshStandardMaterial).roughness;
      this.materialBase.set(mat.uuid, base);
    });
  }

  private applyAnimation(
    state: SceneModelInstanceState,
    animation: CompiledAnimation,
    ctx?: WidgetRenderContext,
    resetDueToProgress = false,
  ): void {
    if (!this.mixer) {
      console.warn('[ModelRenderer] missing mixer, cannot apply animation');
      return;
    }
    const baseClip = this.animationClips.get(animation.clipName ?? '');
    if (!baseClip) return;
    const allowScale = state.playback.animation.allowScale === true;
    const allowRotation = state.playback.animation.allowRotation !== false;
    const filteredClip = this.getFilteredClip(baseClip, allowScale, allowRotation);
    const clip = this.getRangedClip(filteredClip, animation.range);
    if (!clip) return;

    const shouldReset = resetDueToProgress || state.playback.animation.reset === true;
    if (shouldReset && this.activeClip === clip) {
      this.clearActiveAnimation();
    }

    const repeat = state.playback.animation.clipRepeat !== false;
    const action = this.mixer.clipAction(clip);
    if (this.activeClip !== clip) {
      this.clearActiveAnimation();
      const fadeIn = state.playback.animation.fadeInSeconds ?? 0;
      action.reset();
      if (fadeIn > 0) action.fadeIn(fadeIn);
      action.play();
      action.setLoop(repeat ? THREE.LoopRepeat : THREE.LoopOnce, repeat ? Infinity : 1);
      action.clampWhenFinished = !repeat;
      this.activeClip = clip;

      const initialOffset = this.getInitialStartOffset(clip, state);
      if (initialOffset > 0) {
        action.time = Math.min(initialOffset, Math.max(0, clip.duration));
        this.mixer.update(0);
      }
    }

    const weight = state.playback.animation.weight ?? 1;
    action.setEffectiveWeight(weight);
    const deltaSeconds = ctx?.deltaSeconds ?? 0;
    this.mixer.update(deltaSeconds);
  }

  private clearActiveAnimation(): void {
    if (!this.mixer || !this.activeClip) return;
    this.mixer.clipAction(this.activeClip).stop();
    this.activeClip = null;
  }

  // (debug pose diff helpers removed)

  private shouldResetOnProgress(globalProgress?: number): boolean {
    if (typeof globalProgress !== 'number') return false;
    const last = this.lastGlobalProgress;
    this.lastGlobalProgress = globalProgress;
    if (last === null) return false;
    return globalProgress < last - 1e-4;
  }

  private getInitialStartOffset(
    clip: THREE.AnimationClip,
    state: SceneModelInstanceState,
  ): number {
    const specifiedOffset = state.playback.animation.clipStartOnce;
    if (typeof specifiedOffset !== 'number') return 0;
    const offset = this.resolveClipOffsetSeconds(
      specifiedOffset,
      clip.duration,
      state.playback.animation.clipRangeUnit,
    );
    const key = `${clip.name}|${clip.duration}`;
    const existing = this.initialStartOffsets.get(key);
    if (typeof existing === 'number') return existing;
    this.initialStartOffsets.set(key, offset);
    return offset;
  }

  private resolveClipOffsetSeconds(
    offset: number,
    spanSeconds: number,
    unit?: 'seconds' | 'percent',
  ): number {
    if (unit === 'percent') {
      const pct = offset > 1 ? offset / 100 : offset;
      return pct * spanSeconds;
    }
    if (offset < 0) return 0;
    if (offset > spanSeconds) return Math.max(0, spanSeconds);
    return offset;
  }

  private getFilteredClip(
    baseClip: THREE.AnimationClip,
    allowScale: boolean,
    allowRotation: boolean,
  ): THREE.AnimationClip {
    const key = `${baseClip.name}|s:${allowScale ? 1 : 0}|r:${allowRotation ? 1 : 0}`;
    const cached = this.filteredClips.get(key);
    if (cached) return cached;

    const tracks = allowScale
      ? baseClip.tracks
      : baseClip.tracks.filter((track) => !/\.scale(\b|\[)/.test(track.name));
    const filteredTracks = allowRotation
      ? tracks
      : tracks.filter((track) =>
        !/\.quaternion(\b|\[)/.test(track.name) && !/\.rotation(\b|\[)/.test(track.name));
    const clip = new THREE.AnimationClip(baseClip.name, baseClip.duration, filteredTracks);
    clip.optimize();
    this.filteredClips.set(key, clip);
    return clip;
  }

  private getRangedClip(
    baseClip: THREE.AnimationClip,
    range?: { startSeconds: number; endSeconds: number; span: number },
  ): THREE.AnimationClip {
    if (!range) return baseClip;
    const start = Math.max(0, range.startSeconds);
    const end = Math.max(start, range.endSeconds);
    const key = `${baseClip.uuid}|${start}|${end}`;
    const cached = this.rangedClips.get(key);
    if (cached) return cached;

    const duration = Math.max(1e-4, end - start);
    const tracks = baseClip.tracks.map((track) => {
      const clone = track.clone();
      clone.trim(start, end);
      clone.shift(-start);
      return clone;
    });
    const clip = new THREE.AnimationClip(`${baseClip.name}|${start}-${end}`, duration, tracks);
    clip.optimize();
    this.rangedClips.set(key, clip);
    return clip;
  }

  private applyCustomAnimations(customAnimations: CustomAnimation[], ctx?: WidgetRenderContext): void {
    if (!this.model) return;
    const base = this.capturePose();
    const context = {
      tickTimeSeconds: ctx?.deltaSeconds ?? 0,
      wallTimeSeconds: ctx?.wallTimeSeconds ?? 0,
      sceneProgress: ctx?.globalProgress ?? 0,
      globalProgress: ctx?.globalProgress ?? 0,
      getBaseTransform: (name: string) => {
        const snapshot = base.get(name);
        if (!snapshot) return null;
        return {
          position: [snapshot.position[0], snapshot.position[1], snapshot.position[2]] as Vec3,
          rotation: [snapshot.rotation[0], snapshot.rotation[1], snapshot.rotation[2]] as Vec3,
          scale: [snapshot.scale[0], snapshot.scale[1], snapshot.scale[2]] as Vec3,
        };
      },
    };

    for (const animation of customAnimations) {
      if (!animation.enabled) continue;
      const ops = animation.apply(context);
      if (!ops?.length) continue;
      const weight = animation.weight ?? 1;
      this.applyCustomOps(ops, weight);
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

  private applyCustomOps(ops: CustomAnimationOp[], weight: number): void {
    for (const op of ops) {
      const node = this.nodeByName.get(op.targetName);
      if (!node) continue;
      const opWeight = (op.weight ?? 1) * weight;
      if (opWeight <= 0) continue;
      if (op.type === 'rotation') {
        if (op.mode === 'set') {
          node.rotation.set(op.value[0], op.value[1], op.value[2]);
        } else {
          node.rotation.set(
            node.rotation.x + op.value[0] * opWeight,
            node.rotation.y + op.value[1] * opWeight,
            node.rotation.z + op.value[2] * opWeight,
          );
        }
      } else if (op.type === 'position') {
        if (op.mode === 'set') {
          node.position.set(op.value[0], op.value[1], op.value[2]);
        } else {
          node.position.set(
            node.position.x + op.value[0] * opWeight,
            node.position.y + op.value[1] * opWeight,
            node.position.z + op.value[2] * opWeight,
          );
        }
      } else if (op.type === 'scale') {
        if (op.mode === 'set') {
          node.scale.set(op.value[0], op.value[1], op.value[2]);
        } else {
          node.scale.set(
            node.scale.x + op.value[0] * opWeight,
            node.scale.y + op.value[1] * opWeight,
            node.scale.z + op.value[2] * opWeight,
          );
        }
      }
    }
  }
}
