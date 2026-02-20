import {createRobotTimeline} from '../../../robot/robotTimeline';
import type {SceneGroup} from '../../../robot/runtime/compiler/sceneTypes';
import {CORE_MESSAGE_SCENES} from './sceneOrder';

export const coreMessageSceneGroup: SceneGroup = {
  id: 'core-message',
  scenes: CORE_MESSAGE_SCENES,
  timeline: createRobotTimeline(CORE_MESSAGE_SCENES),
};
