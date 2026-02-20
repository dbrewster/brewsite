import type {ReactNode} from 'react';
import type {RobotTimeline} from '../../robotTimeline';
import type {SceneFrame, SceneFrameOverride as BaseSceneFrameOverride, SceneModel as BaseSceneModel} from '../../model/robotSceneTypes';
import type {LogoRotationRuntime} from '../../logoRotator/LogoRotationRuntime';
import type {ResourceRegistry} from '../../../resources/sceneResources.generated';

export type SceneFrameState = SceneFrame;
export type SceneFrameOverride = BaseSceneFrameOverride;
export type SceneModel = BaseSceneModel;

export type SceneFrameContext = {
  progress: number;
  sceneProgress: number;
  sceneProgressRaw?: number;
  globalProgress: number;
  sceneStart: number;
  sceneEnd: number;
  assetsReady: boolean;
  timeline: RobotTimeline;
  baseState?: SceneFrameState;
  baseStateRaw?: SceneFrameState;
  nextState?: SceneFrameState;
  resourceRegistry?: ResourceRegistry;
  ui?: {
    logo?: LogoRotationRuntime;
    ar?: number;
  };
};

export type SceneTransition = {
  id: string;
  start: number | ((context: SceneFrameContext) => number);
  end: number | ((context: SceneFrameContext) => number);
  scope?: 'active' | 'persist';
  apply: (state: SceneFrameState, context: SceneFrameContext, t: number) => SceneFrameState;
};

export type SceneDefinition = {
  id: string;
  index: number;
  entryLead?: number;
  entryStart?: number;
  getFrame: (context: SceneFrameContext) => SceneFrameState;
  transitions?: SceneTransition[];
};

export type SceneFn = (context: SceneFrameContext) => ReactNode;

export type SceneSpec = {
  id: string;
  index: number;
  entryLead?: number;
  entryStart?: number;
  render: SceneFn;
};

export type SceneSource = SceneDefinition | SceneSpec;

export type SceneGroup = {
  id: string;
  scenes: SceneSource[];
  timeline: RobotTimeline;
  uiConfig?: Record<string, unknown>;
  features?: Record<string, unknown>;
};
