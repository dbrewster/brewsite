import {compileSceneTrack} from './compiler/sceneTrackCompiler';
import type {SceneTrackSampler} from './compiler/sceneTrackSampler';
import {createSceneTrackSampler} from './compiler/sceneTrackSampler';
import type {CompiledAnimation, SceneTrack} from './compiler/sceneTrackTypes';
import type {
  ClipMeta,
  SceneAnimation,
  SceneBackground,
  SceneEnvironment,
  SceneFloor,
  SceneLighting,
  SceneModel,
  SceneModelInstanceState,
  ScenePlayback,
  SceneRibbon
} from '../model/robotSceneTypes';
import {resolveAnimationState} from '../model/animationState';
import {createRobotTimeline, type RobotTimeline} from '../robotTimeline';
import type {SceneSource} from './compiler/sceneTypes';
import type {AnimationPlayer, Model, MotionSystem, RuntimeDriver, RuntimeModelOverride, World, WorldSnapshot} from './types';
import type {AssetManifest} from '../elements/model/index';
import {ModelRenderer, resolveClipRangeSeconds} from '../elements/model/index';
import type {ResourceRegistry} from '../../resources/sceneResources.generated';

export class RuntimeDriverImpl implements RuntimeDriver {
  world: World;
  model: Model;
  motionSystem: MotionSystem;
  animationPlayer: AnimationPlayer;
  sceneRuntime: ModelRenderer;
  assetsReady = false;
  prefersReducedMotion = false;
  availableClips: ClipMeta[] = [];
  particleContext: Record<string, unknown> | null = null;
  lightingRenderer?: (state: SceneLighting) => void;
  environmentRenderer?: (state: SceneEnvironment) => void;
  floorRenderer?: (state: SceneFloor) => void;
  ribbonRenderer?: (state: SceneRibbon) => void;
  backgroundRenderer?: (state: SceneBackground) => void;
  private manifest: AssetManifest | null = null;
  private resourceRegistry: ResourceRegistry | null = null;
  private clipsReady = false;
  private particleContextReady = false;
  private sceneTrack: SceneTrack | null = null;
  private sceneSampler: SceneTrackSampler | null = null;
  private lastTickIndex: number | null = null;
  private needsSeed = false;
  private hasExternalSceneTrack = false;
  private scenes: SceneSource[];
  private timeline: RobotTimeline;
  private deterministicTime = false;
  private animationTimeOverride: number | undefined;
  private baseModelId: string | null = null;
  private modelInstancesNeedSeed = new Set<string>();
  private modelOverrides: Record<string, RuntimeModelOverride> = {};
  private modelInstances = new Map<string, {
    world: World;
    model: Model;
    motionSystem: MotionSystem;
    animationPlayer: AnimationPlayer;
    sceneRuntime: ModelRenderer;
  }>();

  private debugMarkSeed(reason: string): void {
    if (typeof window === 'undefined') return;
    console.info('[RobotRuntime]', 'seed.marked', {
      reason,
      baseModelId: this.baseModelId,
      assetsReady: this.assetsReady,
      clipsReady: this.clipsReady,
      particleContextReady: this.particleContextReady,
      hasSceneTrack: Boolean(this.sceneTrack),
    });
  }

  constructor(options: {
    world: World;
    model: Model;
    motionSystem: MotionSystem;
    animationPlayer: AnimationPlayer;
    scenes?: SceneSource[];
    timeline?: RobotTimeline;
    /** Asset manifest — when provided, ModelRenderer resolves bones once at prepare() time. */
    manifest?: AssetManifest;
    resourceRegistry?: ResourceRegistry;
  }) {
    this.world = options.world;
    this.model = options.model;
    this.motionSystem = options.motionSystem;
    this.animationPlayer = options.animationPlayer;
    this.scenes = options.scenes ?? [];
    this.timeline = options.timeline ?? createRobotTimeline(this.scenes);
    this.manifest = options.manifest ?? null;
    this.resourceRegistry = options.resourceRegistry ?? null;
    this.sceneRuntime = new ModelRenderer({
      world: options.world,
      model: options.model,
      motionSystem: options.motionSystem,
      animationPlayer: options.animationPlayer,
      manifest: this.manifest ?? undefined,
      resourceRegistry: this.resourceRegistry ?? undefined,
    });
  }

  /**
   * Provides the asset manifest to the driver and prepares all model renderers.
   * Call once after the model is loaded and the manifest is available.
   *
   * Calls ModelRenderer.setManifest() on each existing renderer, which runs
   * prepare() in-place (O(1) bone resolution). Does NOT replace the renderer
   * instances — all animation state and delta tracking are preserved.
   */
  setManifest(manifest: AssetManifest): void {
    this.manifest = manifest;
    this.sceneRuntime.setManifest(manifest);
    for (const instance of this.modelInstances.values()) {
      instance.sceneRuntime.setManifest(manifest);
    }
    // No needsSeed: manifest only updates bone-anchor resolution, which takes
    // effect naturally on the next Phase A. No full re-seed is required.
  }

  setResourceRegistry(registry: ResourceRegistry): void {
    this.resourceRegistry = registry;
    this.sceneRuntime.setResourceRegistry(registry);
    for (const instance of this.modelInstances.values()) {
      instance.sceneRuntime.setResourceRegistry(registry);
    }
    this.rebuildSceneTrack();
  }

  /**
   * Triggers one-time bone resolution on the base model renderer.
   * Call after the model GLB is loaded and present in the world graph.
   * If a manifest was provided, bones are resolved by name (O(1)).
   * Otherwise falls back to regex-based resolution.
   */
  prepareModelRenderer(): void {
    this.sceneRuntime.prepare();
    this.needsSeed = true;
    this.debugMarkSeed('prepareModelRenderer');
  }

  setAssetsReady(ready: boolean): void {
    if (ready === this.assetsReady) return;
    if (!ready && this.assetsReady) return;
    this.assetsReady = ready;
    this.rebuildSceneTrack();
  }

  setPrefersReducedMotion(value: boolean): void {
    this.prefersReducedMotion = value;
    this.sceneRuntime.setPrefersReducedMotion(value);
    for (const instance of this.modelInstances.values()) {
      instance.sceneRuntime.setPrefersReducedMotion(value);
    }
    this.rebuildSceneTrack();
  }

  setAvailableClips(clips: ClipMeta[]): void {
    this.availableClips = clips;
    this.clipsReady = true;
    this.rebuildSceneTrack();
  }

  setParticleContext(context: Record<string, unknown> | null): void {
    this.particleContext = context;
    if (context) this.particleContextReady = true;
    this.sceneRuntime.setParticleContext(context);
    for (const instance of this.modelInstances.values()) {
      instance.sceneRuntime.setParticleContext(context);
    }
    if (!this.sceneTrack || !this.sceneSampler) {
      this.rebuildSceneTrack();
    }
  }

  setSceneTrack(track: SceneTrack, sampler?: SceneTrackSampler | null): void {
    if (track === this.sceneTrack) return;  // no-op: same compiled track
    this.sceneTrack = track;
    this.sceneSampler = sampler ?? createSceneTrackSampler(track);
    this.hasExternalSceneTrack = true;
    this.lastTickIndex = null;
    this.needsSeed = true;
    this.debugMarkSeed('setSceneTrack');
  }

  setDeterministicTime(value: boolean): void {
    this.deterministicTime = value;
    this.sceneRuntime.setDeterministicTime(value);
    for (const instance of this.modelInstances.values()) {
      instance.sceneRuntime.setDeterministicTime(value);
    }
  }

  setAnimationTimeOverride(timeSeconds?: number): void {
    this.animationTimeOverride = timeSeconds;
    this.sceneRuntime.setAnimationTimeOverride(timeSeconds);
    for (const instance of this.modelInstances.values()) {
      instance.sceneRuntime.setAnimationTimeOverride(timeSeconds);
    }
  }

  setMotionSystem(motionSystem: MotionSystem): void {
    this.motionSystem = motionSystem;
    this.sceneRuntime.setMotionSystem(motionSystem);
  }

  setModelOverrides(overrides: Record<string, RuntimeModelOverride> | null): void {
    const next = overrides ?? {};
    if (next === this.modelOverrides) return;  // no-op: same overrides object
    this.modelOverrides = next;
    this.needsSeed = true;
    this.debugMarkSeed('setModelOverrides');
    if (this.baseModelId) {
      this.modelInstancesNeedSeed.add(this.baseModelId);
    }
    for (const id of this.modelInstances.keys()) {
      this.modelInstancesNeedSeed.add(id);
    }
  }

  setBaseModelId(id: string | null): void {
    const normalized = id && id.trim().length > 0 ? id : null;
    if (normalized === this.baseModelId) return;
    this.baseModelId = normalized;
    if (normalized) {
      this.modelInstancesNeedSeed.add(normalized);
    }
    this.needsSeed = true;
    this.debugMarkSeed('setBaseModelId');
  }

  resetAnimationState(): void {
    this.sceneRuntime.resetAnimationState();
    for (const instance of this.modelInstances.values()) {
      instance.sceneRuntime.resetAnimationState();
    }
  }

  private computeCompiledAnimation(playback: ScenePlayback): CompiledAnimation {
    const animationState = resolveAnimationState({
      playback,
      prefersReducedMotion: this.prefersReducedMotion,
      availableClips: this.availableClips,
    });
    const clipName = animationState.resolvedClipName;
    const clip = clipName ? this.availableClips.find((item) => item.name === clipName) : undefined;
    if (!animationState.clipEnabled || !clip) {
      return {enabled: false, clipName};
    }
    const range = resolveClipRangeSeconds(playback.animation as SceneAnimation, clip.duration);
    return {
      enabled: true,
      clipName,
      clipDuration: clip.duration,
      range,
    };
  }

  private applyOverrideToState(
    state: { model: SceneModel; playback: ScenePlayback },
    override?: RuntimeModelOverride,
  ): { model: SceneModel; playback: ScenePlayback } {
    if (!override) return state;
    const nextModel = override.model
      ? {
        ...state.model,
        ...override.model,
        position: override.model.position ?? state.model.position,
        rotation: override.model.rotation ?? state.model.rotation,
        scale: override.model.scale ?? state.model.scale,
        bodyPartOverrides: {
          ...(state.model.bodyPartOverrides ?? {}),
          ...((override.model.bodyPartOverrides ?? {}) as NonNullable<SceneModel['bodyPartOverrides']>),
        },
        parts: override.model.parts ?? state.model.parts,
      }
      : state.model;
    const overridePoseGroups = override.poseGroups;
    const overrideAnimation = override.animation;
    let nextPlayback = state.playback;
    if (overridePoseGroups) {
      const existingPose = state.playback.motion.pose;
      const mergedGroups = {
        ...(existingPose?.groups ?? {}),
        ...overridePoseGroups,
      };
      const nextPose = {
        mode: override.poseMode ?? existingPose?.mode ?? 'override',
        groups: mergedGroups,
      };
      nextPlayback = {
        ...nextPlayback,
        motion: {
          ...nextPlayback.motion,
          pose: nextPose,
        },
      };
    }
    if (overrideAnimation) {
      nextPlayback = {
        ...nextPlayback,
        animation: {
          ...nextPlayback.animation,
          ...overrideAnimation,
        },
      };
    }
    return {model: nextModel, playback: nextPlayback};
  }

  setModelInstance(
    id: string,
    instance: { world: World; model: Model; motionSystem: MotionSystem; animationPlayer: AnimationPlayer },
  ): void {
    const sceneRuntime = new ModelRenderer({
      world: instance.world,
      model: instance.model,
      motionSystem: instance.motionSystem,
      animationPlayer: instance.animationPlayer,
      manifest: this.manifest ?? undefined,
      modelId: id,
      resourceRegistry: this.resourceRegistry ?? undefined,
    });
    sceneRuntime.setPrefersReducedMotion(this.prefersReducedMotion);
    sceneRuntime.setParticleContext(this.particleContext);
    sceneRuntime.setDeterministicTime(this.deterministicTime);
    if (this.animationTimeOverride !== undefined) {
      sceneRuntime.setAnimationTimeOverride(this.animationTimeOverride);
    }
    if (this.manifest) {
      sceneRuntime.prepare();
    }
    this.modelInstances.set(id, {
      ...instance,
      sceneRuntime,
    });
    this.modelInstancesNeedSeed.add(id);
    this.needsSeed = true;
    this.debugMarkSeed(`setModelInstance:${id}`);
  }

  removeModelInstance(id: string): void {
    this.modelInstances.delete(id);
  }

  tick(options: { deltaSeconds: number; globalProgress: number; wallTimeSeconds?: number }): void {
    const {deltaSeconds, globalProgress, wallTimeSeconds} = options;
    if (!this.sceneSampler) {
      this.rebuildSceneTrack();
    }
    if (!this.sceneSampler) return;
    const tick = this.sceneSampler.sample(globalProgress);
    const modelEntries = Object.entries(tick.state.models ?? {});
    const currentTickModelIds = new Set(modelEntries.map(([id]) => id));
    const activeBaseModelId = this.baseModelId ?? modelEntries[0]?.[0] ?? null;
    if (this.needsSeed && activeBaseModelId) {
      this.modelInstancesNeedSeed.add(activeBaseModelId);
    }
    const applyElementRenderers = (applyMode: 'full' | 'forward' | 'backward' | 'none') => {
      if (applyMode !== 'none') {
        this.lightingRenderer?.(tick.state.lighting);
        this.environmentRenderer?.(tick.state.environment);
        this.floorRenderer?.(tick.state.floor);
        this.ribbonRenderer?.(tick.state.ribbon);
        this.backgroundRenderer?.(tick.state.background);
      }
    };
    const resolveInstance = (id: string) => {
      if (id === activeBaseModelId) {
        return {
          sceneRuntime: this.sceneRuntime,
          modelId: id,
        };
      }
      const instance = this.modelInstances.get(id);
      if (!instance) return null;
      return {
        sceneRuntime: instance.sceneRuntime,
        modelId: id,
      };
    };
    const applyInstance = (sourceTick: typeof tick, id: string, instanceState: SceneModelInstanceState, _mode: 'full' | 'forward' | 'backward' | 'none', forceFull: boolean, globalProgressOverride: number) => {
      const runtime = resolveInstance(id);
      if (!runtime) return;
      const override = this.modelOverrides[id] ?? this.modelOverrides.__base__;
      const resolved = override
        ? this.applyOverrideToState({model: instanceState.model, playback: instanceState.playback}, override)
        : {model: instanceState.model, playback: instanceState.playback};
      const animation = sourceTick.modelAnimations?.[id];
      const compiledOverride = override?.animation ? this.computeCompiledAnimation(resolved.playback) : null;

      runtime.sceneRuntime.modelId = id;

      if (forceFull) {
        // resetDeltaTracking() forces the next apply() into 'full' mode without
        // wiping animation timing or the active clip. resetAnimationState() is
        // reserved for callers that explicitly need to restart the animation
        // (e.g. when the clip library changes).
        runtime.sceneRuntime.resetDeltaTracking();
        this.modelInstancesNeedSeed.delete(id);
      }

      runtime.sceneRuntime.apply(sourceTick, {
        deltaSeconds,
        globalProgress: globalProgressOverride,
        wallTimeSeconds,
        resolvedModel: resolved.model,
        resolvedPlayback: resolved.playback,
        compiledAnimation: compiledOverride ?? animation,
      });
      if (typeof window !== 'undefined') {
        const debug = (window as unknown as { __robotRuntimeDebug?: { modelRotation?: boolean } }).__robotRuntimeDebug;
        if (debug?.modelRotation) {
          console.info('[RobotRuntime]', 'debug.modelRotation', {
            sceneId: sourceTick.sceneId,
            modelId: id,
            modelRotation: resolved.model.rotation,
          });
        }
      }
    };

    if (!this.needsSeed && this.lastTickIndex !== null && this.sceneTrack) {
      const indexDelta = tick.index - this.lastTickIndex;
      if (Math.abs(indexDelta) > 1) {
        const step = indexDelta > 0 ? 1 : -1;
        const ticks = this.sceneTrack.ticks;
        const stepCount = Math.abs(indexDelta);
        const stepDeltaSeconds = stepCount > 0 ? deltaSeconds / stepCount : deltaSeconds;
        for (let i = this.lastTickIndex + step; i !== tick.index + step; i += step) {
          const intermediate = ticks[i];
          if (!intermediate) continue;
          const mode = step > 0 ? 'forward' : 'backward';
          applyElementRenderers(mode);
          const intermediateModels = intermediate.state.models ?? {};
          const intermediateModelIds = new Set(Object.keys(intermediateModels));
          for (const [id, instanceState] of Object.entries(intermediateModels)) {
            const progressOverride = i === tick.index ? globalProgress : intermediate.progress;
            applyInstance(intermediate, id, instanceState, mode, false, progressOverride);
          }
          // Hide model instances absent from this intermediate tick (backward scrub removal)
          for (const [id, instance] of this.modelInstances.entries()) {
            if (!intermediateModelIds.has(id)) {
              instance.model.getRoot().localScale = [0, 0, 0];
            }
          }
        }
        this.lastTickIndex = tick.index;
        return;
      }
    }
    let applyMode: 'full' | 'forward' | 'backward' | 'none' = 'full';
    if (this.lastTickIndex !== null) {
      if (tick.index === this.lastTickIndex) {
        applyMode = 'none';
      } else if (tick.index === this.lastTickIndex + 1) {
        applyMode = 'forward';
      } else if (tick.index === this.lastTickIndex - 1) {
        applyMode = 'backward';
      } else {
        applyMode = 'full';
      }
    }
    if (this.needsSeed) {
      applyMode = 'full';
      this.needsSeed = false;
    }
    this.lastTickIndex = tick.index;
    applyElementRenderers(applyMode);
    for (const [id, instanceState] of modelEntries) {
      const forceFull = this.modelInstancesNeedSeed.has(id);
      applyInstance(tick, id, instanceState, applyMode, forceFull, globalProgress);
    }
    // Hide model instances absent from the current tick (handles backward scrub removal)
    if (applyMode !== 'none') {
      for (const [id, instance] of this.modelInstances.entries()) {
        if (!currentTickModelIds.has(id)) {
          instance.model.getRoot().localScale = [0, 0, 0];
        }
      }
    }
  }

  getWorldSnapshot(): WorldSnapshot {
    return this.world.snapshot();
  }

  private rebuildSceneTrack(): void {
    if (this.hasExternalSceneTrack) {
      return;
    }
    if (!this.assetsReady || !this.clipsReady || !this.particleContextReady) {
      this.sceneTrack = null;
      this.sceneSampler = null;
      this.lastTickIndex = null;
      this.needsSeed = false;
      return;
    }
    this.sceneTrack = compileSceneTrack({
      scenes: this.scenes,
      timeline: this.timeline,
      assetsReady: this.assetsReady,
      availableClips: this.availableClips,
      prefersReducedMotion: this.prefersReducedMotion,
      manifest: this.manifest ?? undefined,
      resourceRegistry: this.resourceRegistry ?? undefined,
    });
    this.sceneSampler = createSceneTrackSampler(this.sceneTrack);
    this.needsSeed = true;
    this.debugMarkSeed('rebuildSceneTrack');
  }
}
