// @brewsite/model public API surface.

// Plugin factory
export { modelPlugin } from './plugin';
export type { ModelPluginOptions } from './plugin';

// Model element public surface
export type {
  SceneModel,
  SceneModelInstanceState,
  SceneAnimation,
  ScenePlayback,
  BodyPartOverride,
  BodyPartOverrideMap,
  ModelPartSpec,
  ModelSubpartSpec,
  MotionCommand,
  MotionScene,
  CustomAnimation,
  Vec3,
  ClipMeta,
  AxisRotation,
  AxisTranslation,
  ModelPartId,
  ModelPartAnchor,
  ModelPartOverrides,
  PoseGroup,
  ModelPose,
  MotionGroupLimits,
  CustomAnimationContext,
  CustomAnimationOp,
  SceneMotion,
  ModelSubpartId,
} from './elements/model/types';
export type { CompiledAnimation } from './elements/model/compile';
export type { NVSRect } from '@brewsite/core';
export { ModelWidget } from './elements/model/ModelWidget';
export type { ModelWidgetConfig } from './elements/model/ModelWidget';
export type { AssetManifest, ModelMeta, AnimationEntry } from './elements/model/metadata';
export { clipMetaFromManifest, assertManifestValid, findModelMeta, ASSET_MANIFEST_VERSION } from './elements/model/metadata';

// Model DSL components
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
} from './elements/model/ModelWidget';
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
} from './elements/model/dsl';

// Label public surface
export type { LabelDefinition, LabelResolved, LabelStyle } from './labels/types';
export { Label } from './labels';
export { LabelItem } from './labels/LabelItem';
export { LabelPositioner } from './player/LabelPositioner';
export { LabelPositionerContext, useLabelPositioner } from './player/LabelPositionerContext';

// Widget contract extensions
export type { IContainedModel } from './widget/types';

// Handler registration
export { registerModelHandlers } from './handlers';
