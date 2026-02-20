import type { RobotMotionCommand, RobotGroupLimits, SceneMotion } from '../types';
import type { MotionSystem, Node, PoseSnapshotMap, World } from '../types';

/**
 * Mock implementation of MotionSystem for testing.
 * Stub - implemented in Phase 6
 */
const DEG_TO_RAD = Math.PI / 180;

const applyCommandsToNode = (
  node: Node,
  commands: RobotMotionCommand[],
  basePose: PoseSnapshotMap,
  groupLimits: Record<string, RobotGroupLimits>,
) => {
  let rotX = 0;
  let rotY = 0;
  let rotZ = 0;
  let posX = 0;
  let posY = 0;
  let posZ = 0;

  for (const command of commands) {
    const limits = groupLimits[command.groupId];
    const weight = command.weight ?? 1;
    const rotate = command.rotate;
    const translate = command.translate;

    if (rotate && limits) {
      rotY += (rotate.yawPct ?? 0) * (limits.yaw ?? 0) * weight * DEG_TO_RAD;
      rotX += (rotate.pitchPct ?? 0) * (limits.pitch ?? 0) * weight * DEG_TO_RAD;
      rotZ += (rotate.rollPct ?? 0) * (limits.roll ?? 0) * weight * DEG_TO_RAD;
    }

    if (translate && limits) {
      posX += (translate.xPct ?? 0) * (limits.x ?? 0) * weight;
      posY += (translate.yPct ?? 0) * (limits.y ?? 0) * weight;
      posZ += (translate.zPct ?? 0) * (limits.z ?? 0) * weight;
    }
  }

  const base = basePose.get(node.name);
  if (!base) return;
  node.localRotation = [
    base.rotation[0] + rotX,
    base.rotation[1] + rotY,
    base.rotation[2] + rotZ,
  ];
  node.localPosition = [
    base.position[0] + posX,
    base.position[1] + posY,
    base.position[2] + posZ,
  ];
};

export class MockMotionSystem implements MotionSystem {
  readonly timeSeconds: number = 0;
  readonly lastSceneProgress: number = 0;
  private basePose: PoseSnapshotMap = new Map();
  private groupTargets: Map<string, Node[]>;
  private groupLimits: Record<string, RobotGroupLimits>;

  constructor(options: { groupTargets: Map<string, Node[]>; groupLimits: Record<string, RobotGroupLimits> }) {
    this.groupTargets = options.groupTargets;
    this.groupLimits = options.groupLimits;
  }

  private ensureBasePose(world: World): void {
    if (this.basePose.size > 0) return;
    world.nodesByName.forEach((node) => {
      this.basePose.set(node.name, {
        position: [node.localPosition[0], node.localPosition[1], node.localPosition[2]],
        rotation: [node.localRotation[0], node.localRotation[1], node.localRotation[2]],
        scale: [node.localScale[0], node.localScale[1], node.localScale[2]],
      });
    });
  }

  reset(world: World): void {
    this.ensureBasePose(world);
    for (const [name, pose] of this.basePose) {
      const node = world.getNode(name);
      if (!node) continue;
      node.localPosition = [pose.position[0], pose.position[1], pose.position[2]];
      node.localRotation = [pose.rotation[0], pose.rotation[1], pose.rotation[2]];
      node.localScale = [pose.scale[0], pose.scale[1], pose.scale[2]];
    }
  }

  snapshotPose(world: World): PoseSnapshotMap {
    const snapshot: PoseSnapshotMap = new Map();
    world.nodesByName.forEach((node) => {
      snapshot.set(node.name, {
        position: [node.localPosition[0], node.localPosition[1], node.localPosition[2]],
        rotation: [node.localRotation[0], node.localRotation[1], node.localRotation[2]],
        scale: [node.localScale[0], node.localScale[1], node.localScale[2]],
      });
    });
    return snapshot;
  }

  apply(_sceneMotion: SceneMotion, _sceneProgress: number, _timeSeconds: number, _world: World): void {
    // Stub - full implementation would apply motion commands to nodes
  }
}
