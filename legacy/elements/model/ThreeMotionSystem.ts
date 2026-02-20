import { Euler, Object3D, Quaternion, Vector3 } from 'three';
import type { SceneMotion } from './types';
import type { MotionRigData, MotionSystem, PoseSnapshotMap, World } from '../../runtime/types';
import { applyRobotCommands, createRobotMotionRig, resetRobotPose, type RobotMotionRig } from '../../../components/logoParticleOptimizedViewer/robotMotionEngine';
import { buildMergedMotionCommands } from '../../runtime/motionShared';

export class ThreeMotionSystem implements MotionSystem {
  timeSeconds = 0;
  lastSceneProgress = 0;

  private rig: RobotMotionRig | null = null;
  private warnedGroups = new Set<string>();
  private commandScratch = {
    euler: new Euler(),
    quat: new Quaternion(),
    vec: new Vector3(),
  };

  constructor(options: { rig: MotionRigData<Object3D> }) {
    this.buildRig(options.rig);
  }

  reset(_world: World): void {
    if (this.rig) resetRobotPose(this.rig);
  }

  snapshotPose(world: World): PoseSnapshotMap {
    const snapshot: PoseSnapshotMap = new Map();
    world.nodesByName.forEach((node) => {
      snapshot.set(node.name, {
        position: [...node.localPosition],
        rotation: [...node.localRotation],
        scale: [...node.localScale],
      });
    });
    return snapshot;
  }

  apply(sceneMotion: SceneMotion, sceneProgress: number, timeSeconds: number, _world: World): void {
    if (!this.rig) return;
    this.timeSeconds = timeSeconds;
    this.lastSceneProgress = sceneProgress;

    resetRobotPose(this.rig);

    const mergedCommands = buildMergedMotionCommands(sceneMotion, sceneProgress, timeSeconds);

    for (const command of mergedCommands) {
      const targets = this.rig.groupTargets.get(command.groupId);
      if (targets && targets.length > 0) continue;
      if (this.warnedGroups.has(command.groupId)) continue;
      this.warnedGroups.add(command.groupId);
      console.warn(`Motion rig group has no targets: ${command.groupId}`);
    }

    applyRobotCommands({
      rig: this.rig,
      commands: mergedCommands,
      scratch: this.commandScratch,
    });
  }

  private buildRig(rig: MotionRigData<Object3D>): void {
    for (const [groupId, targets] of rig.groupTargets.entries()) {
      if (targets.length === 0 && !this.warnedGroups.has(groupId)) {
        this.warnedGroups.add(groupId);
        console.warn('Motion rig group resolved no targets.', { groupId });
      }
    }
    this.rig = createRobotMotionRig({
      groupTargets: rig.groupTargets,
      groupLimits: rig.groupLimits,
    });
  }
}
