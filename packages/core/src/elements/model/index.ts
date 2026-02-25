/**
 * Model element public API.
 */

// Widget class
export { ModelWidget } from './ModelWidget';
export type { ModelWidgetConfig } from './ModelWidget';

// Types
export type {
  ClipMeta,
  ModelPartId,
  ModelPartAnchor,
  ModelSubpartId,
  ModelSubpartSpec,
  ModelPartSpec,
  ModelPartOverrides,
  BodyPartOverride,
  BodyPartOverrideMap,
  AxisRotation,
  AxisTranslation,
  MotionCommand,
  PoseGroup,
  ModelPose,
  MotionScene,
  MotionGroupLimits,
  CustomAnimationContext,
  CustomAnimationOp,
  CustomAnimation,
  SceneMotion,
  SceneAnimation,
  ScenePlayback,
  SceneModel,
  SceneModelInstanceState,
} from './types';

// Compilation
export { modelTransitionSpec, playbackTransitionSpec, instanceTransitionSpec, compileAnimation, resolveClipRangeSeconds } from './compile';
export type { CompiledAnimation } from './compile';

// Metadata
export type { AnimationEntry, AnchorTargetMap, BodyPartGroup, ModelMeta, AssetManifest } from './metadata';
export { clipMetaFromManifest, findModelMeta, assertManifestValid, ASSET_MANIFEST_VERSION } from './metadata';

// Rendering
export { applyModelTransform } from './render';
export { ModelRenderer } from './ModelRenderer';

// DSL components
export {
  Model,
  ModelRouter,
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
