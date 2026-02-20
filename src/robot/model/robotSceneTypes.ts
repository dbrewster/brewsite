// Re-exports from element modules
export type { Vec3 } from '../elements/model/types';
export type {
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
} from '../elements/model/types';
export type { SceneLighting } from '../elements/lighting/types';
export type { SceneEnvironment } from '../elements/environment/types';
export type { SceneBackground } from '../elements/background/types';
export type { SceneFloor } from '../elements/floor/types';
export type { SceneRibbon, RibbonConfig, RibbonCurveConfig } from '../elements/ribbon/types';

import type {AnnotationDefaults, AnnotationDefinition} from '../annotations/annotationTypes';
import type {SceneLighting} from '../elements/lighting/types';
import type {SceneEnvironment} from '../elements/environment/types';
import type {SceneFloor} from '../elements/floor/types';
import type {SceneBackground} from '../elements/background/types';
import type {SceneRibbon} from '../elements/ribbon/types';
import type {SceneModel, SceneModelInstanceState} from '../elements/model/types';

export type SceneFrame = {
  id: string;
  scrollProgress: number;
  lighting: SceneLighting;
  environment: SceneEnvironment;
  floor: SceneFloor;
  background: SceneBackground;
  ribbon: SceneRibbon;
  isLightScene: boolean;
  models?: Record<string, SceneModelInstanceState>;
  annotations?: AnnotationDefinition[];
  annotationDefaults?: Partial<AnnotationDefaults>;
};

export type SceneFrameOverride = Partial<
  Omit<
    SceneFrame,
    'lighting' | 'environment' | 'floor' | 'background' | 'ribbon' | 'models'
  >
> & {
  lighting?: Partial<SceneLighting>;
  environment?: Partial<SceneEnvironment>;
  floor?: Partial<SceneFloor>;
  background?: Partial<SceneBackground>;
  ribbon?: Partial<SceneRibbon>;
  models?: Record<string, {
    model?: Partial<Omit<SceneModel, 'parts'>> & { parts?: import('../elements/model/types').ModelPartOverrides };
    playback?: {
      motion?: Partial<import('../elements/model/types').SceneMotion>;
      animation?: Partial<import('../elements/model/types').SceneAnimation>;
    };
    enabled?: boolean;
  }>;
  annotationDefaults?: Partial<AnnotationDefaults>;
};
