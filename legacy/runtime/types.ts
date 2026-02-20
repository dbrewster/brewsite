import type {BodyPartOverrideMap, ClipMeta, RobotGroupLimits, RobotPoseGroup, SceneAnimation, SceneModel, SceneMotion, Vec3,} from '../elements/model/index';
// Compiler imports are necessary here because they define the runtime API boundary.
// RuntimeDriver uses SceneTrack and SceneTrackSampler to accept pre-compiled track data.
import type {SceneTrack} from './compiler/sceneTrackTypes';
import type {SceneTrackSampler} from './compiler/sceneTrackSampler';

export type {Vec3};

export type ComponentBase = {
  type: string;
  props: Record<string, unknown>;
};

export type LightComponent = {
  type: 'light';
  props: {
    lightType: 'ambient' | 'directional' | 'point' | 'spot';
    color: string;
    intensity: number;
    position?: Vec3;
    target?: Vec3;
    angle?: number;
    penumbra?: number;
    distance?: number;
    decay?: number;
    enabled: boolean;
  };
};

export type ParticleComponent = {
  type: 'particles';
  props: {
    enabled: boolean;
    opacity?: number;
    color?: string;
    count?: number;
    size?: number;
    seed?: number;
    [key: string]: unknown;
  };
};

export type MaterialOverrideComponent = {
  type: 'materialOverride';
  props: {
    targetMeshId?: string;
    color?: string;
    metalness?: number;
    roughness?: number;
    opacity?: number;
  };
};

export type EnvironmentComponent = {
  type: 'environment';
  props: {
    enabled: boolean;
    url?: string;
    preset?: 'room';
    intensity: number;
  };
};

export type FloorComponent = {
  type: 'floor';
  props: {
    enabled: boolean;
    textureUrl?: string;
  };
};

export type BackgroundComponent = {
  type: 'background';
  props: {
    imageUrl?: string;
    opacity: number;
  };
};

export type RibbonComponent = {
  type: 'ribbon';
  props: {
    enabled: boolean;
    config?: Record<string, unknown>;
  };
};

export type Component =
  | ComponentBase
  | LightComponent
  | ParticleComponent
  | MaterialOverrideComponent
  | EnvironmentComponent
  | FloorComponent
  | BackgroundComponent
  | RibbonComponent;

export type Node = {
  name: string;
  parent?: Node;
  children: Node[];
  localPosition: Vec3;
  localRotation: Vec3;
  localScale: Vec3;
  worldPosition: Vec3;
  worldRotation: Vec3;
  worldScale: Vec3;
  components: Component[];
  matrixWorld?: number[];
  add(child: Node): void;
  remove(child: Node): void;
};

export type WorldSnapshot = {
  nodes: Array<{
    name: string;
    worldPosition: Vec3;
    worldRotation: Vec3;
    worldScale: Vec3;
    components: Component[];
  }>;
};

export type World = {
  nodesByName: Map<string, Node>;
  root: Node;
  createNode(name: string): Node;
  addNode(node: Node, parentName?: string): void;
  removeNode(name: string): void;
  getNode(name: string): Node | null;
  updateWorldMatrix(): void;
  snapshot(): WorldSnapshot;
};

export type Model = {
  world: World;
  rootName: string;
  getRoot(): Node;
  getObject(name: string): Node | null;
  traverse(fn: (node: Node) => void): void;
  updateWorldMatrix(): void;
  applyMaterialOverrides(
    overrides: BodyPartOverrideMap,
    options?: { metalness?: number; roughness?: number; opacity?: number },
  ): void;
  setAnchoredObjects(objects: AnchoredObject[]): void;
  updateParticleSystems?(contextOverride?: Record<string, unknown>): void;
  getContainedModel?(id: string): Model | null;
  setContainedModel?(id: string, model: Model | null): void;
};

export type AnchoredObjectBase = {
  id: string;
  anchorId: string;
  localPosition: Vec3;
  localRotation: Vec3;
  localScale: Vec3 | number;
  enabled: boolean;
  visibility?: { opacity?: number; visible?: boolean };
  applyRotationScale?: boolean;
};

export type AnchoredObjectModel = AnchoredObjectBase & {
  type: 'model';
  model: Model;
};

export type AnchoredObjectComponent = AnchoredObjectBase & {
  type: 'component';
  componentType: string;
  props: Record<string, unknown>;
};

export type AnchoredObject = AnchoredObjectModel | AnchoredObjectComponent;

export type PoseSnapshot = { position: Vec3; rotation: Vec3; scale: Vec3 };
export type PoseSnapshotMap = Map<string, PoseSnapshot>;

export type AnimationTrack = {
  targetName: string;
  property: 'position' | 'rotation' | 'scale' | 'component';
  componentType?: string;
  componentKey?: string;
  keyframes: Array<{ t: number; value: number | number[] }>;
};

export type AnimationPlayer = {
  tracks: AnimationTrack[];
  timeSeconds: number;
  playing: boolean;
  setClip(clipName?: string): void;
  load(tracks: AnimationTrack[]): void;
  play(startTime?: number): void;
  stop(): void;
  reset(): void;
  tick(dtSeconds: number, world: World): void;
  setTime(timeSeconds: number, world: World): void;
  setTrackFilter(filter: { allowRotation?: boolean; allowScale?: boolean }): void;
  getPoseSnapshot(): PoseSnapshotMap;
  getClipTargetNames(clipName?: string): Set<string>;
};

export type MotionSystem = {
  timeSeconds: number;
  lastSceneProgress: number;
  apply(sceneMotion: SceneMotion, sceneProgress: number, timeSeconds: number, world: World): void;
  reset(world: World): void;
  snapshotPose(world: World): PoseSnapshotMap;
};

export type MotionRigData<T> = {
  groupTargets: Map<string, T[]>;
  groupLimits: Record<string, RobotGroupLimits>;
};

export type RuntimeModelOverride = {
  model?: Partial<SceneModel>;
  poseMode?: 'override' | 'add';
  poseGroups?: Partial<Record<string, RobotPoseGroup>>;
  animation?: Partial<SceneAnimation> & { enabled?: boolean };
};

export type RuntimeDriver = {
  world: World;
  model: Model;
  motionSystem: MotionSystem;
  animationPlayer: AnimationPlayer;
  assetsReady: boolean;
  prefersReducedMotion: boolean;
  availableClips: ClipMeta[];
  particleContext: Record<string, unknown> | null;
  setAssetsReady(ready: boolean): void;
  setPrefersReducedMotion(value: boolean): void;
  setAvailableClips(clips: ClipMeta[]): void;
  setParticleContext(context: Record<string, unknown> | null): void;
  setSceneTrack(track: SceneTrack, sampler?: SceneTrackSampler | null): void;
  setDeterministicTime(value: boolean): void;
  setAnimationTimeOverride(timeSeconds?: number): void;
  setMotionSystem(motionSystem: MotionSystem): void;
  setModelOverrides(overrides: Record<string, RuntimeModelOverride> | null): void;
  setBaseModelId(id: string | null): void;
  setResourceRegistry(registry: import('../../resources/sceneResources.generated').ResourceRegistry): void;
  tick(options: { deltaSeconds: number; globalProgress: number; wallTimeSeconds?: number }): void;
  getWorldSnapshot(): WorldSnapshot;
  setModelInstance(id: string, instance: { world: World; model: Model; motionSystem: MotionSystem; animationPlayer: AnimationPlayer }): void;
  removeModelInstance(id: string): void;
  /**
   * Provides the asset manifest and re-creates model renderers with pre-resolved
   * bone targets. Call once after the model is loaded.
   */
  setManifest?(manifest: import('../elements/model/metadata').AssetManifest): void;
  /**
   * Triggers one-time bone resolution on the base model renderer.
   * Call after the model GLB is present in the world graph.
   */
  prepareModelRenderer?(): void;
};
