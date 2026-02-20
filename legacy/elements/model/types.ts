export type Vec3 = [number, number, number];

export type ModelPartId = string;
export type ModelPartAnchor = string;

export type ModelSubpartId = string;

export type ModelSubpartSpec = {
  id: ModelSubpartId;
  enabled?: boolean;
  opacity?: number;
  color?: string;
  metalness?: number;
  roughness?: number;
};

export type ModelPartSpec = {
  id: ModelPartId;
  anchor: ModelPartAnchor;
  enabled: boolean;
  space?: 'local' | 'world';
  position: Vec3;
  rotation: Vec3;
  scale: number;
  opacity?: number;
  metalness?: number;
  roughness?: number;
  modelId?: string;
  subparts?: Partial<Record<ModelSubpartId, ModelSubpartSpec>>;
};

export type ModelPartOverrides = Partial<Record<ModelPartId, Partial<ModelPartSpec>>>;

export type BodyPartOverride = {
  opacity?: number;
  color?: string;
  metalness?: number;
  roughness?: number;
  pose?: RobotPoseGroup;
};

export type BodyPartOverrideMap = Partial<Record<string, BodyPartOverride>>;

export type SceneModel = {
  scale: number;
  position: Vec3;
  rotation: Vec3;
  metalness?: number;
  roughness?: number;
  bodyPartOverrides?: BodyPartOverrideMap;
  parts?: Record<ModelPartId, ModelPartSpec>;
  enabled?: boolean;
};

export type RobotAxisRotation = {
  yawPct?: number;
  pitchPct?: number;
  rollPct?: number;
};

export type RobotAxisTranslation = {
  xPct?: number;
  yPct?: number;
  zPct?: number;
};

export type RobotMotionCommand = {
  groupId: string;
  rotate?: RobotAxisRotation;
  translate?: RobotAxisTranslation;
  weight?: number;
  space?: 'local' | 'world';
};

export type RobotPoseGroup = {
  rotate?: RobotAxisRotation;
  translate?: RobotAxisTranslation;
  space?: 'local' | 'world';
};

export type RobotPose = {
  mode?: 'override' | 'add';
  groups: Partial<Record<string, RobotPoseGroup>>;
};

export type RobotMotionScene = {
  id: string;
  start: number;
  end: number;
  ease?: (t: number) => number;
  commands: RobotMotionCommand[] | ((t: number, timeSeconds: number) => RobotMotionCommand[]);
  holdAtEnd?: boolean;
};

export type RobotGroupLimits = {
  yaw: number;
  pitch: number;
  roll: number;
  x?: number;
  y?: number;
  z?: number;
};

export type CustomAnimationContext = {
  tickTimeSeconds: number;
  wallTimeSeconds: number;
  sceneProgress: number;
  globalProgress: number;
  getBaseTransform: (name: string) => { position: Vec3; rotation: Vec3; scale: Vec3 } | null;
};

export type CustomAnimationOp = {
  targetName: string;
  type: 'rotation' | 'position' | 'scale';
  value: Vec3;
  mode?: 'add' | 'set';
  weight?: number;
};

export type CustomAnimation = {
  id: string;
  enabled: boolean;
  layer?: 'base' | 'overlay';
  weight?: number;
  apply: (context: CustomAnimationContext) => CustomAnimationOp[];
};

export type SceneMotion = {
  commands: RobotMotionCommand[];
  scenes: RobotMotionScene[];
  customAnimations?: CustomAnimation[];
  pose?: RobotPose;
};

export type SceneAnimation = {
  enabled: boolean;
  clipName?: string;
  gltfUrl?: string;
  gltfClipName?: string;
  fbxUrl?: string;
  fbxClipName?: string;
  fbxRetarget?: boolean;
  fadeInSeconds?: number;
  weight?: number;
  clipStart?: number;
  clipEnd?: number;
  clipRangeUnit?: 'seconds' | 'percent';
  clipRepeat?: boolean;
  holdStartPose?: boolean;
  allowRotation?: boolean;
  allowScale?: boolean;
};

export type ScenePlayback = {
  motion: SceneMotion;
  animation: SceneAnimation;
};

export type SceneModelInstanceState = {
  model: SceneModel;
  playback: ScenePlayback;
  enabled?: boolean;
};

export type ClipMeta = { name: string; duration: number };
