import type {SceneEnvironment, SceneFloor, SceneFrame, SceneLighting, SceneModelInstanceState, SceneRibbon,} from '../../model/robotSceneTypes';
import type {AnnotationResolved} from '../../annotations/annotationNormalized';
import type {AnchorTargetMap} from '../../elements/model/metadata';

export type SceneWindow = {
  id: string;
  index: number;
  start: number;
  end: number;
  entryStart: number;
};

export type SceneFrameDelta = Partial<
  Omit<SceneFrame, 'lighting' | 'environment' | 'floor' | 'background' | 'ribbon' | 'models'>
> & {
  lighting?: SceneLighting;
  environment?: SceneEnvironment;
  floor?: SceneFloor;
  background?: SceneFrame['background'];
  ribbon?: SceneRibbon;
  models?: Record<string, Partial<SceneModelInstanceState>>;
  annotationDefaults?: SceneFrame['annotationDefaults'];
};

export type CompiledAnimation = {
  enabled: boolean;
  clipName?: string;
  clipDuration?: number;
  range?: { startSeconds: number; endSeconds: number; span: number };
};

export type SceneTrackTick = {
  index: number;
  progress: number;
  sceneId: string;
  sceneIndex: number;
  sceneProgress: number;
  state: SceneFrame;
  annotationPrimitives?: AnnotationResolved[];
  deltaForward: SceneFrameDelta;
  deltaBackward: SceneFrameDelta;
  modelAnimations?: Record<string, CompiledAnimation>;
};

export type SceneTrack = {
  ticks: SceneTrackTick[];
  tickStep: number;
  subTickCount: number;
  sceneWindows: SceneWindow[];
  /**
   * Bone names to use when anchoring sub-models to the robot skeleton.
   * Present when the track was compiled with an AssetManifest (Track B+).
   * Absent when compiled with legacy availableClips — use fallback bone search.
   */
  anchorTargets?: AnchorTargetMap;
};
