import type {RobotGroupLimits} from '../../model/robotSceneTypes';
import type {Node, World} from '../types';

export const buildMockMotionRig = (
  world: World,
  groupLimits: Record<string, RobotGroupLimits>,
): { groupTargets: Map<string, Node[]>; groupLimits: Record<string, RobotGroupLimits> } => {
  const groupTargets = new Map<string, Node[]>();
  for (const groupId of Object.keys(groupLimits)) {
    const node = world.getNode(groupId);
    groupTargets.set(groupId, node ? [node] : []);
  }
  return { groupTargets, groupLimits };
};
