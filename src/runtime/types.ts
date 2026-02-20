// Phase 6: Runtime infrastructure types — generic, widget-based layer.

import type { SceneTrack, SceneTrackTick } from '../compiler/sceneTrackTypes';

export type Vec3 = [number, number, number];

// ====================
// Scene/Animation Types
// ====================

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

// ====================
// Node and World Types
// ====================

export type Node = {
  readonly name: string;
  parent?: Node;
  children: Node[];
  localPosition: Vec3;
  localRotation: Vec3;
  localScale: Vec3;
  readonly worldPosition: Vec3;
  readonly worldRotation: Vec3;
  readonly worldScale: Vec3;
  readonly components?: Component[];
  readonly matrixWorld?: number[];
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
  readonly nodesByName: ReadonlyMap<string, Node>;
  readonly root: Node;
  createNode(name: string): Node;
  addNode(node: Node, parentName?: string): void;
  removeNode(name: string): void;
  getNode(name: string): Node | null;
  updateWorldMatrix(): void;
  snapshot(): WorldSnapshot;
};

// ====================
// Model Types
// ====================

export type BodyPartOverrideMap = Record<string, unknown>;

export type Model = {
  readonly world: World;
  readonly rootName: string;
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

// ====================
// Anchored Object Types
// ====================

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

// ====================
// Animation Types
// ====================

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
  readonly tracks: AnimationTrack[];
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

// ====================
// Motion Types
// ====================

export type RobotGroupLimits = {
  yaw?: number;
  pitch?: number;
  roll?: number;
  x?: number;
  y?: number;
  z?: number;
};

export type RobotPoseGroup = {
  rotate?: { yawPct?: number; pitchPct?: number; rollPct?: number };
  translate?: { xPct?: number; yPct?: number; zPct?: number };
  space?: 'local' | 'world';
};

export type RobotMotionCommand = {
  groupId: string;
  weight?: number;
  rotate?: { yawPct?: number; pitchPct?: number; rollPct?: number };
  translate?: { xPct?: number; yPct?: number; zPct?: number };
};

export type SceneMotion = {
  commands: RobotMotionCommand[];
  scenes: Array<{
    name: string;
    commands:
      | RobotMotionCommand[]
      | ((sceneProgress: number, timeSeconds: number) => RobotMotionCommand[]);
  }>;
  customAnimations: unknown[];
  pose?: {
    mode?: string;
    groups?: Record<string, RobotPoseGroup>;
  };
};

export type MotionRigData<T> = {
  groupTargets: Map<string, T[]>;
  groupLimits: Record<string, RobotGroupLimits>;
};

export type MotionSystem = {
  readonly timeSeconds: number;
  readonly lastSceneProgress: number;
  apply(sceneMotion: SceneMotion, sceneProgress: number, timeSeconds: number, world: World): void;
  reset(world: World): void;
  snapshotPose(world: World): PoseSnapshotMap;
};

// ====================
// Runtime Driver Types
// ====================

// ====================
// Generic Runtime Driver Interface
// ====================

/**
 * Minimal contract for the generic, widget-based runtime driver.
 *
 * This interface contains only the methods needed by the engine layer and the
 * RuntimeLoop.  Robot/model-specific concepts (world, motionSystem, etc.) live
 * in widget implementations and do NOT belong here.
 */
export type RuntimeDriver = {
  /** True once all ILoadable widgets have resolved their load() promises. */
  assetsReady: boolean;

  /** Update assetsReady and notify any waiting subscribers. */
  setAssetsReady(ready: boolean): void;

  /** Install a compiled SceneTrack so the driver can sample it each tick. */
  setSceneTrack(track: SceneTrack): void;

  /** Advance the runtime by one frame. */
  tick(options: { deltaSeconds: number; globalProgress: number; wallTimeSeconds?: number }): void;

  /**
   * Returns a map of bone/node world positions contributed by IRenderable
   * widgets.  Used by the annotation positioner to project 3-D targets to
   * screen space.
   */
  getBoneWorldPositions(): Map<string, [number, number, number]>;

  /** Returns the SceneTrackTick sampled during the most recent tick(). */
  getCurrentTick(): SceneTrackTick | null;

  /** Returns the cumulative wall-clock time at the end of the last tick(). */
  getWallTimeSeconds(): number;

  /** Dispose all widget resources and release internal state. */
  dispose(): void;
};
