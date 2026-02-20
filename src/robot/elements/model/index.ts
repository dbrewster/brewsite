// Types
export type {
  Vec3,
  ModelPartId,
  ModelPartAnchor,
  ModelSubpartId,
  ModelSubpartSpec,
  ModelPartSpec,
  ModelPartOverrides,
  BodyPartOverride,
  BodyPartOverrideMap,
  SceneModel,
  SceneModelInstanceState,
  RobotAxisRotation,
  RobotAxisTranslation,
  RobotMotionCommand,
  RobotPoseGroup,
  RobotPose,
  RobotMotionScene,
  RobotGroupLimits,
  CustomAnimationContext,
  CustomAnimationOp,
  CustomAnimation,
  SceneMotion,
  SceneAnimation,
  ScenePlayback,
  ClipMeta,
} from './types';

// Compilation: transition specs and animation compiler
export { modelTransitionSpec, playbackTransitionSpec, compileAnimation, resolveClipRangeSeconds } from './compile';
export type { CompiledAnimation } from './compile';

// Asset manifest: build-time model metadata types and helpers
export type { AnimationEntry, AnchorTargetMap, ModelMeta, BrainMeta, AssetManifest } from './metadata';
export { clipMetaFromManifest, assertManifestValid, ASSET_MANIFEST_VERSION } from './metadata';

// Render: model transform application
export { applyModelTransform } from './render';

// OO renderer: stateful per-model rendering class
export { ModelRenderer } from './ModelRenderer';
export type { ModelRendererApplyOptions } from './ModelRenderer';

// DSL: scene authoring primitives
export {
  Model,
  BodyParts,
  BodyPart,
  Pose,
  ModelPart,
  ContainedModel,
  Subpart,
  Playback,
  Motion,
  Animation,
} from './dsl';
export type {
  ModelProps,
  BodyPartProps,
  BodyPartByIdProps,
  PoseProps,
  ModelPartProps,
  ContainedModelProps,
  SubpartProps,
  PlaybackProps,
  MotionProps,
  AnimationProps,
} from './dsl';
