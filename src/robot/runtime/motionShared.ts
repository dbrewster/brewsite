import {resolveMotionCommands} from '../model/motionState';
import type {RobotMotionCommand, RobotPose, SceneMotion} from '../elements/model/index';

const buildFlexCommands = (timeSeconds: number): RobotMotionCommand[] => {
  const flexCycleSeconds = 9;
  const flexWindowSeconds = 1.1;
  const flexPhase = timeSeconds % flexCycleSeconds;
  const flexSide = Math.floor(timeSeconds / flexCycleSeconds) % 2;
  const flexFactor =
    flexPhase < flexWindowSeconds
      ? Math.sin((flexPhase / flexWindowSeconds) * Math.PI)
      : 0;

  return flexFactor > 0.001
    ? [
        {
          groupId: flexSide === 0 ? 'left_fingers' : 'right_fingers',
          rotate: { pitchPct: 0.25 * flexFactor },
        },
        {
          groupId: flexSide === 0 ? 'left_thumb' : 'right_thumb',
          rotate: { pitchPct: 0.12 * flexFactor },
        },
      ]
    : [];
};

const buildPoseCommands = (pose?: RobotPose): RobotMotionCommand[] => {
  if (!pose) return [];
  const commands: RobotMotionCommand[] = [];
  for (const [groupId, spec] of Object.entries(pose.groups ?? {})) {
    if (!spec) continue;
    if (!spec.rotate && !spec.translate) continue;
    commands.push({
      groupId,
      rotate: spec.rotate,
      translate: spec.translate,
      space: spec.space,
    });
  }
  return commands;
};

export const buildMergedMotionCommands = (
  sceneMotion: SceneMotion,
  sceneProgress: number,
  timeSeconds: number,
): RobotMotionCommand[] => {
  const scrollCommands = resolveMotionCommands({
    scrollScenes: sceneMotion.scenes,
    scrollProgress: sceneProgress,
    timeSeconds,
  });
  const flexCommands = buildFlexCommands(timeSeconds);
  const poseCommands = buildPoseCommands(sceneMotion.pose);
  const poseGroupIds = new Set(poseCommands.map((command) => command.groupId));
  const poseMode = sceneMotion.pose?.mode ?? 'override';

  const filteredScrollCommands = poseMode === 'override'
    ? scrollCommands.filter((command) => !poseGroupIds.has(command.groupId))
    : scrollCommands;
  const filteredCommands = poseMode === 'override'
    ? sceneMotion.commands.filter((command) => !poseGroupIds.has(command.groupId))
    : sceneMotion.commands;

  if (filteredScrollCommands.length) {
    return [...filteredScrollCommands, ...poseCommands, ...filteredCommands, ...flexCommands];
  }
  return [...poseCommands, ...filteredCommands, ...flexCommands];
};

export const __test__ = {
  buildFlexCommands,
};
