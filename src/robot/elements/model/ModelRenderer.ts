/**
 * ModelRenderer — the OO rendering class for a single robot model instance.
 *
 * Responsibilities:
 * - `prepare()`: Resolves bone targets ONCE from the asset manifest, eliminating
 *   per-frame regex bone searches.
 * - `apply()`: Unified per-frame entrypoint — applies model state, animation, motion,
 *   and anchored objects (brain + particles) for one tick.
 *
 * Bone resolution:
 * - With manifest: head/chest anchors resolved at prepare() time via
 *   manifest.robot.anchorTargets — O(1) map lookup.
 * - Without manifest: falls back to runtime regex resolution (legacy path).
 */

import type {
  CustomAnimation,
  CustomAnimationContext,
  CustomAnimationOp,
  SceneFrame,
  SceneModel,
  ScenePlayback,
} from '../../model/robotSceneTypes';
import { applyModelTransform } from './render';
import { MODEL_BONE_NAME_MAP } from '../../../components/logoParticleOptimizedViewer/robotStructureTypes';
import { buildNameCandidates } from '../../../components/logoParticleOptimizedViewer/robotRigIndex';
import { applyPoseSnapshot, capturePose } from '../../runtime/pose';
import { lerpVec3 } from '../../runtime/math';
import { computeAnimationTimeSeconds, computeTickTiming } from '../../runtime/scenePlaybackHelpers';
import { computeMotionFlags } from '../../runtime/scenePlaybackPolicies';
import type {
  AnchoredObject,
  AnimationPlayer,
  Component,
  Model,
  MotionSystem,
  Node,
  PoseSnapshotMap,
  World,
} from '../../runtime/types';
import type { CompiledAnimation, SceneTrackTick } from '../../runtime/compiler/sceneTrackTypes';
import type { AssetManifest } from './metadata';
import type { ResourceRegistry } from '../../../resources/sceneResources.generated';

// ─── Internal bone resolution helpers (fallback when no manifest) ────────────

const resolveNodeByCandidates = (world: World, names: string[]): Node | null => {
  for (const name of names) {
    const node = world.getNode(name);
    if (node) return node;
  }
  return null;
};

const isRuntimeAnchorNode = (name: string) =>
  name.startsWith('ANCHOR_') ||
  name.startsWith('Light_') ||
  name === 'Ribbon' ||
  name === 'Background' ||
  name === 'Env_Map' ||
  name === 'Floor';

const resolveNodeByPredicate = (
  world: World,
  predicate: (name: string, node: Node) => boolean,
): Node | null => {
  for (const [name, node] of world.nodesByName.entries()) {
    if (isRuntimeAnchorNode(name)) continue;
    if (predicate(name, node)) return node;
  }
  return null;
};

const resolveChestTargetFallback = (world: World): Node | null => {
  const names = [
    ...buildNameCandidates('spine1'),
    ...buildNameCandidates('spine2'),
    ...buildNameCandidates('spine'),
    ...buildNameCandidates('chest'),
    ...buildNameCandidates('torso'),
    MODEL_BONE_NAME_MAP.Spine1,
    MODEL_BONE_NAME_MAP.Spine2,
    MODEL_BONE_NAME_MAP.Spine,
  ];
  const direct = resolveNodeByCandidates(world, names);
  if (direct) return direct;
  return resolveNodeByPredicate(world, (name) => /spine|chest|torso/i.test(name));
};

const resolveHeadTargetFallback = (world: World): Node | null => {
  const names = [
    MODEL_BONE_NAME_MAP.Head,
    'mixamorig:Head',
    'mixamorigHead',
    ...buildNameCandidates('head'),
  ];
  const direct = resolveNodeByCandidates(world, names);
  if (direct) return direct;
  return resolveNodeByPredicate(world, (name) => /head/i.test(name) && !/end/i.test(name));
};

// ─── ApplyOptions ─────────────────────────────────────────────────────────────

export type ModelRendererApplyOptions = {
  deltaSeconds: number;
  globalProgress: number;
  wallTimeSeconds?: number;
  /** Pre-resolved model state (after overrides). Reads from tick when omitted. */
  resolvedModel?: SceneModel;
  /** Pre-resolved playback state (after overrides). Reads from tick when omitted. */
  resolvedPlayback?: ScenePlayback;
  /** Pre-compiled animation (after overrides). Reads from tick.modelAnimations when omitted. */
  compiledAnimation?: CompiledAnimation;
};

// ─── ModelRenderer ────────────────────────────────────────────────────────────

/**
 * OO renderer for a single robot model instance.
 *
 * Lifecycle:
 * 1. Construct with world/model/animation/motion/manifest + modelId.
 * 2. Call `prepare()` once after the model is loaded into the world.
 *    This caches bone targets from the manifest — no more per-frame regex.
 * 3. Call `apply(tick, options)` each frame.
 */
export class ModelRenderer {
  // ── Public tracking state ──
  currentSceneId: string | null = null;
  modelId: string | null = null;

  // ── Internal state ──
  private world: World;
  private model: Model;
  private motionSystem: MotionSystem;
  private animationPlayer: AnimationPlayer;
  private manifest: AssetManifest | null;
  private _modelId: string | null;

  // Anchor targets — cached after prepare()
  private anchorTargets: Map<string, Node | null> = new Map();
  private prepared = false;

  // Animation state
  private activeClipName?: string;
  private animationTimeSeconds = 0;
  private animationTimeOverride: number | null = null;

  // Timing
  private lastGlobalProgress = 0;
  private wallTimeSeconds = 0;
  private deterministicTime = false;

  // Behaviour flags
  private prefersReducedMotion = false;
  private particleContext: Record<string, unknown> | null = null;

  // Logging
  private anchoredIds = new Set<string>();
  private loggedSubparts = new Set<string>();
  private loggedMissingModelDelta = new Set<string>();

  // Registry
  private resourceRegistry: ResourceRegistry | null = null;

  // Delta tracking for apply() — mirrors RuntimeDriver outer logic
  private _lastApplyTickIndex: number | null = null;

  constructor(options: {
    world: World;
    model: Model;
    motionSystem: MotionSystem;
    animationPlayer: AnimationPlayer;
    /**
     * Asset manifest from robot-metadata.json.
     * When provided, `prepare()` resolves bone targets once from anchorTargets.
     * When absent, falls back to runtime bone resolution (legacy behaviour).
     */
    manifest?: AssetManifest;
    /** The model ID this renderer manages. Used in `apply()`. */
    modelId?: string;
    /** Resource registry — used to resolve anchors and contained models. */
    resourceRegistry?: ResourceRegistry;
  }) {
    this.world = options.world;
    this.model = options.model;
    this.motionSystem = options.motionSystem;
    this.animationPlayer = options.animationPlayer;
    this.manifest = options.manifest ?? null;
    this._modelId = options.modelId ?? null;
    this.resourceRegistry = options.resourceRegistry ?? null;
  }

  // ── One-time setup ───────────────────────────────────────────────────────────

  /**
   * Resolves bone anchor targets exactly once after the model is loaded.
   *
   * When a manifest is supplied: looks up the named bones directly (O(1)).
   * Fallback: iterates the world graph with regex matching (legacy path).
   *
   * Call this after the GLB is loaded and added to the world.
   */
  prepare(): void {
    this.anchorTargets.clear();
    const registryModel = this._resolveRegistryModel();
    if (registryModel?.anchors) {
      for (const [anchorId, targetName] of Object.entries(registryModel.anchors)) {
        if (!targetName) {
          this.anchorTargets.set(anchorId, null);
          continue;
        }
        const resolved = this.world.getNode(targetName) ?? this._resolveAnchorFallback(anchorId);
        this.anchorTargets.set(anchorId, resolved);
      }
    } else if (this.manifest) {
      const { head, chest } = this.manifest.robot.anchorTargets;
      this.anchorTargets.set('head', this.world.getNode(head) ?? resolveHeadTargetFallback(this.world));
      this.anchorTargets.set('chest', this.world.getNode(chest) ?? resolveChestTargetFallback(this.world));
    } else {
      this.anchorTargets.set('head', resolveHeadTargetFallback(this.world));
      this.anchorTargets.set('chest', resolveChestTargetFallback(this.world));
    }
    this.prepared = true;
  }

  /**
   * Updates the asset manifest and re-runs prepare() in-place.
   *
   * Prefer this over replacing the entire ModelRenderer instance when the
   * manifest becomes available asynchronously after construction. All
   * animation state, delta tracking, and accumulated context are preserved.
   */
  setManifest(manifest: AssetManifest): void {
    this.manifest = manifest;
    this.prepare();
  }

  setResourceRegistry(registry: ResourceRegistry): void {
    this.resourceRegistry = registry;
    this.prepare();
  }

  // ── Unified per-frame API ────────────────────────────────────────────────────

  /**
   * Unified per-frame entrypoint. Applies model state, animation, motion, and
   * anchored objects (brain + particles) for one tick.
   *
   * Replaces the three-step setScene() + applyModelState() + tick() sequence
   * used by RuntimeDriver with a single call.
   *
   * @param tick The current compiled tick from the scene track.
   * @param options Per-frame options including timing and optional overrides.
   */
  apply(tick: SceneTrackTick, options: ModelRendererApplyOptions): void {
    const effectiveModelId = this._modelId ?? this.modelId;
    if (!effectiveModelId) return;

    const instanceState = tick.state.models?.[effectiveModelId];

    // Use explicit overrides first; fall back to tick state.
    // When an explicit resolvedModel is provided, apply() can run even if the
    // tick has no instance entry for this modelId (e.g. when RuntimeDriver
    // pre-resolves overrides before calling apply).
    const resolvedModel = options.resolvedModel ?? instanceState?.model;
    if (!resolvedModel) return;

    // Resolve playback state early — required for wall-time animation even when
    // the tick index does not change.
    const resolvedPlayback = options.resolvedPlayback ?? instanceState?.playback;

    // Determine delta mode (mirrors RuntimeDriver outer logic).
    const mode: 'full' | 'forward' | 'backward' | 'none' =
      this._lastApplyTickIndex === null           ? 'full'
      : tick.index === this._lastApplyTickIndex   ? 'none'
      : tick.index === this._lastApplyTickIndex + 1 ? 'forward'
      : tick.index === this._lastApplyTickIndex - 1 ? 'backward'
      : 'full';

    this._lastApplyTickIndex = tick.index;

    if (tick.state.id !== this.currentSceneId) {
      this.currentSceneId = tick.state.id;
    }

    // ── Phase A: model state (skipped on 'none' — scroll position unchanged) ────

    if (mode !== 'none') {
      if (resolvedModel.enabled === false) {
        this.model.getRoot().localScale = [0, 0, 0];
        this.model.setAnchoredObjects([]);
        this._finishTick(options.globalProgress);
        return;
      }

      const modelDelta =
        mode === 'forward'  ? tick.deltaForward.models?.[effectiveModelId]?.model
        : mode === 'backward' ? tick.deltaBackward.models?.[effectiveModelId]?.model
        : undefined;

      this.applyModelState(resolvedModel, modelDelta, {
        mode,
        sceneId: tick.sceneId,
        tickIndex: tick.index,
        progress: tick.progress,
      });
    }

    // ── Phase B: wall-time (always runs — clock advances every RAF frame) ──────

    if (!resolvedPlayback || resolvedModel.enabled === false) {
      this._finishTick(options.globalProgress);
      return;
    }

    const timing = this._applyTiming({
      deltaSeconds: options.deltaSeconds,
      globalProgress: options.globalProgress,
      wallTimeSeconds: options.wallTimeSeconds,
    });

    const motion = resolvedPlayback.motion;
    const { hasMotion } = computeMotionFlags(motion);
    const applyMotion = !this.prefersReducedMotion;
    if (applyMotion && hasMotion) {
      this.motionSystem.reset(this.world);
      this.motionSystem.apply(motion, tick.state.scrollProgress, this.wallTimeSeconds, this.world);
    }

    const compiledAnimation =
      options.compiledAnimation ?? tick.modelAnimations?.[effectiveModelId];

    const basePose = this._capturePoseSnapshot();
    if (applyMotion && motion.customAnimations?.length) {
      this._applyCustomAnimations(
        motion.customAnimations,
        'base',
        this._buildCustomContext({
          tickTimeSeconds: timing.tickTimeSeconds,
          wallTimeSeconds: this.wallTimeSeconds,
          scene: tick.state,
          globalProgress: options.globalProgress,
          basePose,
        }),
        basePose,
      );
    }

    if (compiledAnimation?.enabled) {
      this._applyAnimationClip({
        scene: tick.state,
        playback: resolvedPlayback,
        basePose,
        compiledAnimation: compiledAnimation as CompiledAnimation & Required<Pick<CompiledAnimation, 'clipName' | 'clipDuration' | 'range'>>,
        timing,
        globalProgress: options.globalProgress,
        deltaSeconds: options.deltaSeconds,
        applyOverlay: applyMotion,
      });
    } else {
      if (this.activeClipName) {
        this.animationPlayer.setClip(undefined);
        this.activeClipName = undefined;
      }
      applyPoseSnapshot(this.model.getRoot(), basePose);
      if (applyMotion && motion.customAnimations?.length) {
        const overlayPose = this._capturePoseSnapshot();
        this._applyCustomAnimations(
          motion.customAnimations,
          'overlay',
          this._buildCustomContext({
            tickTimeSeconds: timing.tickTimeSeconds,
            wallTimeSeconds: this.wallTimeSeconds,
            scene: tick.state,
            globalProgress: options.globalProgress,
            basePose: overlayPose,
          }),
          overlayPose,
        );
        applyPoseSnapshot(this.model.getRoot(), overlayPose);
      }
    }

    // Re-assert the model root transform after the motion + pose cycle.
    //
    // motionSystem.reset() (via resetRobotPose) resets the quaternion of every
    // object captured in the motion rig — which can include the model's root
    // Group if it was added as a 'robot' group target at rig-build time. The
    // subsequent capturePoseSnapshot then captures that reset value, and
    // applyPoseSnapshot restores it, permanently losing the scene's desired
    // root rotation/position/scale.
    //
    // The fix: the model root transform is owned exclusively by the compiled
    // scene state (SceneModel.position / rotation / scale). Re-applying it here
    // guarantees the scene always wins, regardless of what the motion rig did.
    applyModelTransform(resolvedModel, this.model.getRoot());

    if (typeof this.model.updateParticleSystems === 'function') {
      this.model.updateParticleSystems(this.particleContext ?? undefined);
    }

    this._finishTick(options.globalProgress);
  }

  // ── Public API ───────────────────────────────────────────────────────────────

  setPrefersReducedMotion(value: boolean): void {
    this.prefersReducedMotion = value;
  }

  setParticleContext(context: Record<string, unknown> | null): void {
    this.particleContext = context;
  }

  setDeterministicTime(value: boolean): void {
    this.deterministicTime = value;
  }

  setAnimationTimeOverride(timeSeconds?: number): void {
    this.animationTimeOverride = typeof timeSeconds === 'number' ? timeSeconds : null;
  }

  setMotionSystem(motionSystem: MotionSystem): void {
    this.motionSystem = motionSystem;
  }

  resetAnimationState(): void {
    if (this.activeClipName) {
      this.animationPlayer.setClip(undefined);
    }
    this.activeClipName = undefined;
    this.animationTimeSeconds = 0;
    // _lastApplyTickIndex is intentionally NOT reset here. Delta tracking is
    // independent of animation state. Use resetDeltaTracking() when a forced
    // 'full' apply is required (e.g. after a scene recompile or override change).
  }

  /**
   * Resets only the tick-delta tracking, forcing the next apply() into 'full'
   * mode without disturbing animation timing or active clip state.
   *
   * Use this when the model's scene state must be fully re-applied (e.g. after
   * a recompile or model-override change) but animation should continue from
   * its current position.
   */
  resetDeltaTracking(): void {
    this._lastApplyTickIndex = null;
  }

  applyModelState(
    modelState: SceneModel | undefined,
    modelDelta: SceneModel | undefined,
    options: { mode: 'full' | 'forward' | 'backward'; sceneId?: string; tickIndex?: number; progress?: number },
  ): void {
    if (!modelState) return;
    const hasModelDelta = options.mode === 'full' || modelDelta !== undefined;

    if (!hasModelDelta && options.mode !== 'full') {
      if (typeof window !== 'undefined') {
        const debug = (window as unknown as { __robotRuntimeDebug?: { modelDelta?: boolean } })
          .__robotRuntimeDebug;
        if (debug?.modelDelta && options.sceneId !== undefined && options.tickIndex !== undefined) {
          const key = `${options.sceneId}:${options.tickIndex}`;
          if (!this.loggedMissingModelDelta.has(key)) {
            this.loggedMissingModelDelta.add(key);
            console.warn('[ModelRenderer]', 'model.delta.missing', {
              sceneId: options.sceneId,
              tickIndex: options.tickIndex,
              progress: options.progress,
              mode: options.mode,
            });
          }
        }
      }
    }


    const root = this.model.getRoot();
    applyModelTransform(modelState, root);
    if (modelState.enabled === false) {
      this.model.setAnchoredObjects([]);
      return;
    }

    this.model.applyMaterialOverrides(modelState.bodyPartOverrides ?? {}, {
      metalness: modelState.metalness,
      roughness: modelState.roughness,
    });

    const anchoredObjects = this._buildAnchoredObjects(modelState);
    this._logAnchoredDiff(anchoredObjects);
    this.model.setAnchoredObjects(anchoredObjects);
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  /**
   * Builds the anchored objects list for contained models.
   *
   * Anchor targets come from the registry when available, otherwise fall back
   * to runtime bone resolution.
   */
  private _buildAnchoredObjects(modelState: SceneModel): AnchoredObject[] {
    const parts = modelState.parts ?? {};
    const anchored: AnchoredObject[] = [];
    const partEntries = Object.values(parts) as Array<NonNullable<SceneModel['parts']>[string]>;
    const needsWorldMatrix = partEntries.some((part) => (part.space ?? 'local') !== 'local');
    const anchorWorldPositions = new Map<string, [number, number, number]>();

    if (needsWorldMatrix) {
      this.world.updateWorldMatrix();
    }

    const resolveAnchorWorldPosition = (anchor: Node): [number, number, number] => {
      const cached = anchorWorldPositions.get(anchor.name);
      if (cached) return cached;
      const next: [number, number, number] = [
        anchor.worldPosition[0],
        anchor.worldPosition[1],
        anchor.worldPosition[2],
      ];
      anchorWorldPositions.set(anchor.name, next);
      return next;
    };

    const applySpace = (part: NonNullable<SceneModel['parts']>[string], anchor: Node) => {
      const space = part.space ?? 'local';
      if (space === 'local') {
        return {
          localPosition: part.position,
          localRotation: part.rotation,
          localScale: part.scale,
        };
      }
      const anchorPos = resolveAnchorWorldPosition(anchor);
      return {
        localPosition: [part.position[0] - anchorPos[0], part.position[1] - anchorPos[1], part.position[2] - anchorPos[2]] as [number, number, number],
        localRotation: part.rotation,
        localScale: part.scale,
      };
    };

    for (const part of partEntries) {
      if (!part?.anchor) continue;
      const anchorTarget = this._resolveAnchorNode(part.anchor);
      if (!anchorTarget) continue;
      if (!part.modelId) continue;
      const containedModel = this.model.getContainedModel?.(part.modelId);
      if (!containedModel) continue;

      const transform = applySpace(part, anchorTarget);
      const partOpacity = part.enabled ? part.opacity : 0;

      anchored.push({
        id: part.id,
        anchorId: anchorTarget.name,
        type: 'model',
        enabled: part.enabled,
        localPosition: transform.localPosition,
        localRotation: transform.localRotation,
        localScale: transform.localScale,
        model: containedModel,
        visibility: partOpacity !== undefined ? { opacity: partOpacity, visible: part.enabled } : { visible: part.enabled },
      });

      const containedRoot = containedModel.getRoot();
      if (typeof part.metalness === 'number' || typeof part.roughness === 'number') {
        const existing = containedRoot.components.find((c) => c.type === 'materialOverride');
        const props = { metalness: part.metalness, roughness: part.roughness } as Record<string, unknown>;
        if (existing) {
          existing.props = { ...existing.props, ...props };
        } else {
          containedRoot.components.push({ type: 'materialOverride', props });
        }
      }

      if (part.subparts) {
        for (const [id, spec] of Object.entries(part.subparts) as Array<[
          string,
          NonNullable<typeof part.subparts>[keyof NonNullable<typeof part.subparts>]
        ]>) {
          if (!spec) continue;
          const node = containedModel.getObject(id);
          if (!node) continue;
          const existing = node.components.find((c) => c.type === 'materialOverride');
          const props = {
            color: spec.color,
            metalness: spec.metalness,
            roughness: spec.roughness,
            opacity: spec.enabled === false ? 0 : spec.opacity,
          } as Record<string, unknown>;
          if (existing) {
            existing.props = { ...existing.props, ...props };
          } else {
            node.components.push({ type: 'materialOverride', props });
          }
          if (spec.color && typeof window !== 'undefined' && !this.loggedSubparts.has(id)) {
            console.info('[ModelRenderer]', 'model.subpart.tint', { id, color: spec.color });
            this.loggedSubparts.add(id);
          }
        }
      }
    }

    return anchored;
  }

  private _logAnchoredDiff(objects: AnchoredObject[]): void {
    const nextIds = new Set(objects.map((o) => o.id));
    const created: string[] = [];
    const removed: string[] = [];
    for (const id of nextIds) {
      if (!this.anchoredIds.has(id)) created.push(id);
    }
    for (const id of this.anchoredIds) {
      if (!nextIds.has(id)) removed.push(id);
    }
    if (typeof window !== 'undefined') {
      if (created.length) console.log('[ModelRenderer]', 'attachments.created', { ids: created });
      if (removed.length) console.log('[ModelRenderer]', 'attachments.removed', { ids: removed });
    }
    this.anchoredIds = nextIds;
  }

  private _applyTiming(options: {
    deltaSeconds: number;
    globalProgress: number;
    wallTimeSeconds?: number;
  }) {
    const timing = computeTickTiming({
      deltaSeconds: options.deltaSeconds,
      globalProgress: options.globalProgress,
      lastGlobalProgress: this.lastGlobalProgress,
      deterministicTime: this.deterministicTime,
      wallTimeSeconds: this.wallTimeSeconds,
      wallTimeOverride: options.wallTimeSeconds,
    });
    this.wallTimeSeconds = timing.wallTimeSecondsNext;
    return {
      tickTimeSeconds: timing.tickTimeSeconds,
      isReverse: timing.isReverse,
      isScrubbing: timing.isScrubbing,
      useScrubTime: timing.useScrubTime,
      wallTimeSeconds: this.wallTimeSeconds,
    };
  }

  private _finishTick(globalProgress: number): void {
    this.lastGlobalProgress = globalProgress;
  }

  private _resolveRegistryModel() {
    const effectiveModelId = this._modelId ?? this.modelId;
    if (!this.resourceRegistry || !effectiveModelId) return null;
    const models = this.resourceRegistry.models as Record<string, ResourceRegistry['models'][keyof ResourceRegistry['models']]>;
    return models[effectiveModelId] ?? null;
  }

  private _resolveAnchorFallback(anchorId: string): Node | null {
    if (anchorId === 'head') return resolveHeadTargetFallback(this.world);
    if (anchorId === 'chest') return resolveChestTargetFallback(this.world);
    return this.world.getNode(anchorId);
  }

  private _resolveAnchorNode(anchorId: string): Node | null {
    if (!anchorId) return null;
    if (this.anchorTargets.has(anchorId)) {
      return this.anchorTargets.get(anchorId) ?? null;
    }
    const resolved = this._resolveAnchorFallback(anchorId);
    this.anchorTargets.set(anchorId, resolved);
    return resolved;
  }

  private _capturePoseSnapshot(): PoseSnapshotMap {
    const pose: PoseSnapshotMap = new Map();
    capturePose(this.model.getRoot(), pose);
    return pose;
  }

  private _applyAnimationClip(options: {
    scene: SceneFrame;
    playback: ScenePlayback;
    basePose: PoseSnapshotMap;
    compiledAnimation: CompiledAnimation & Required<Pick<CompiledAnimation, 'clipName' | 'clipDuration' | 'range'>>;
    timing: { tickTimeSeconds: number; wallTimeSeconds: number; useScrubTime: boolean };
    globalProgress: number;
    deltaSeconds: number;
    applyOverlay: boolean;
  }): void {
    const { scene, playback, basePose, compiledAnimation, timing, globalProgress, deltaSeconds, applyOverlay } = options;
    const clipName = compiledAnimation.clipName;
    if (clipName !== this.activeClipName) {
      this.animationPlayer.setClip(clipName);
      this.activeClipName = clipName;
      this.animationTimeSeconds = 0;
      if (typeof window !== 'undefined') {
        const debug = (window as unknown as { __robotRuntimeDebug?: boolean }).__robotRuntimeDebug;
        if (debug) {
          console.log('[ModelRenderer]', 'animation.clipChanged', { sceneId: scene.id, clipName });
        }
      }
    }

    const clipRange = compiledAnimation.range;
    const animationSettings = playback.animation;
    this.animationPlayer.setTrackFilter({
      allowRotation: animationSettings.allowRotation,
      allowScale: animationSettings.allowScale,
    });
    if (this.animationTimeSeconds <= 0) {
      this.animationTimeSeconds = clipRange.startSeconds;
    }
    let timeSeconds: number;
    if (this.animationTimeOverride !== null) {
      timeSeconds = this.animationTimeOverride;
    } else if (timing.useScrubTime) {
      timeSeconds = this.animationTimeSeconds;
    } else {
      timeSeconds = computeAnimationTimeSeconds({
        holdStartPose: animationSettings.holdStartPose === true,
        blendingIn: false,
        deterministicTime: this.deterministicTime,
        useScrubTimeAnimation: false,
        sceneProgress: scene.scrollProgress,
        animationSettings,
        clipDuration: compiledAnimation.clipDuration,
        clipRange,
        animationTimeSeconds: this.animationTimeSeconds,
        deltaSeconds,
      });
      this.animationTimeSeconds = timeSeconds;
    }

    applyPoseSnapshot(this.model.getRoot(), basePose);
    this.animationPlayer.setTime(timeSeconds, this.world);

    if (applyOverlay && playback.motion.customAnimations?.length) {
      const overlayPose = this._capturePoseSnapshot();
      this._applyCustomAnimations(
        playback.motion.customAnimations,
        'overlay',
        this._buildCustomContext({ tickTimeSeconds: timing.tickTimeSeconds, wallTimeSeconds: this.wallTimeSeconds, scene, globalProgress, basePose: overlayPose }),
        overlayPose,
      );
      applyPoseSnapshot(this.model.getRoot(), overlayPose);
    }
  }

  private _buildCustomContext(options: {
    tickTimeSeconds: number;
    wallTimeSeconds: number;
    scene: SceneFrame;
    globalProgress: number;
    basePose: PoseSnapshotMap;
  }): CustomAnimationContext {
    const { tickTimeSeconds, wallTimeSeconds, scene, globalProgress, basePose } = options;
    return {
      tickTimeSeconds,
      wallTimeSeconds,
      sceneProgress: scene.scrollProgress,
      globalProgress,
      getBaseTransform: (name) => {
        const base = basePose.get(name);
        if (!base) return null;
        return {
          position: [base.position[0], base.position[1], base.position[2]],
          rotation: [base.rotation[0], base.rotation[1], base.rotation[2]],
          scale: [base.scale[0], base.scale[1], base.scale[2]],
        };
      },
    };
  }

  private _applyCustomAnimations(
    customAnimations: CustomAnimation[] | undefined,
    layer: 'base' | 'overlay',
    context: CustomAnimationContext,
    pose?: PoseSnapshotMap,
  ): void {
    if (!customAnimations?.length) return;
    for (const animation of customAnimations) {
      if (!animation.enabled) continue;
      const animationLayer = animation.layer ?? 'base';
      if (animationLayer !== layer) continue;
      const ops = animation.apply(context);
      if (!ops?.length) continue;
      const weight = typeof animation.weight === 'number' ? animation.weight : 1;
      if (pose) {
        this._applyCustomAnimationOpsToPose(ops, weight, pose);
      } else {
        this._applyCustomAnimationOps(ops, weight);
      }
    }
  }

  private _applyCustomAnimationOpsToPose(
    ops: CustomAnimationOp[],
    weight: number,
    pose: PoseSnapshotMap,
  ): void {
    for (const op of ops) {
      const snapshot = pose.get(op.targetName);
      if (!snapshot) continue;
      const opWeight = (op.weight ?? 1) * weight;
      if (opWeight <= 0) continue;
      const mode = op.mode ?? 'add';
      if (op.type === 'rotation') {
        snapshot.rotation =
          mode === 'add'
            ? [snapshot.rotation[0] + op.value[0] * opWeight, snapshot.rotation[1] + op.value[1] * opWeight, snapshot.rotation[2] + op.value[2] * opWeight]
            : lerpVec3(snapshot.rotation, op.value, opWeight);
      } else if (op.type === 'position') {
        snapshot.position =
          mode === 'add'
            ? [snapshot.position[0] + op.value[0] * opWeight, snapshot.position[1] + op.value[1] * opWeight, snapshot.position[2] + op.value[2] * opWeight]
            : lerpVec3(snapshot.position, op.value, opWeight);
      } else if (op.type === 'scale') {
        snapshot.scale =
          mode === 'add'
            ? [snapshot.scale[0] + op.value[0] * opWeight, snapshot.scale[1] + op.value[1] * opWeight, snapshot.scale[2] + op.value[2] * opWeight]
            : lerpVec3(snapshot.scale, op.value, opWeight);
      }
      pose.set(op.targetName, snapshot);
    }
  }

  private _applyCustomAnimationOps(ops: CustomAnimationOp[], weight: number): void {
    for (const op of ops) {
      const node = this.world.getNode(op.targetName);
      if (!node) continue;
      const opWeight = (op.weight ?? 1) * weight;
      if (opWeight <= 0) continue;
      const mode = op.mode ?? 'add';
      if (op.type === 'rotation') {
        node.localRotation =
          mode === 'add'
            ? [node.localRotation[0] + op.value[0] * opWeight, node.localRotation[1] + op.value[1] * opWeight, node.localRotation[2] + op.value[2] * opWeight]
            : lerpVec3(node.localRotation, op.value, opWeight);
      } else if (op.type === 'position') {
        node.localPosition =
          mode === 'add'
            ? [node.localPosition[0] + op.value[0] * opWeight, node.localPosition[1] + op.value[1] * opWeight, node.localPosition[2] + op.value[2] * opWeight]
            : lerpVec3(node.localPosition, op.value, opWeight);
      } else if (op.type === 'scale') {
        node.localScale =
          mode === 'add'
            ? [node.localScale[0] + op.value[0] * opWeight, node.localScale[1] + op.value[1] * opWeight, node.localScale[2] + op.value[2] * opWeight]
            : lerpVec3(node.localScale, op.value, opWeight);
      }
    }
  }
}
