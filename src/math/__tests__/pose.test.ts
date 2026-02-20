import { describe, it, expect } from 'vitest';
import { applyPoseSnapshot, blendPoseSnapshot, blendPoseSnapshots, capturePose, poseSnapshotEquals } from '../pose';
import type { Node, PoseSnapshotMap } from '../../runtime/types';

const makeNode = (name: string, children: Node[] = []): Node => ({
  name,
  parent: undefined,
  children,
  localPosition: [0, 0, 0],
  localRotation: [0, 0, 0],
  localScale: [1, 1, 1],
  worldPosition: [0, 0, 0],
  worldRotation: [0, 0, 0],
  worldScale: [1, 1, 1],
  add(child: Node) {
    this.children.push(child);
    child.parent = this;
  },
  remove(child: Node) {
    this.children = this.children.filter((c) => c !== child);
    child.parent = undefined;
  },
});

describe('pose utilities', () => {
  it('capturePose and applyPoseSnapshot round-trip', () => {
    const child = makeNode('child');
    const root = makeNode('root', [child]);
    root.localPosition = [1, 2, 3];
    child.localScale = [2, 2, 2];

    const pose: PoseSnapshotMap = new Map();
    capturePose(root, pose);

    root.localPosition = [0, 0, 0];
    child.localScale = [1, 1, 1];

    applyPoseSnapshot(root, pose);
    expect(root.localPosition).toEqual([1, 2, 3]);
    expect(child.localScale).toEqual([2, 2, 2]);
  });

  it('blendPoseSnapshot blends toward current node transform', () => {
    const root = makeNode('root');
    root.localPosition = [10, 0, 0];
    const pose: PoseSnapshotMap = new Map();
    pose.set('root', {
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    });
    blendPoseSnapshot(root, pose, 0.5);
    expect(root.localPosition[0]).toBeCloseTo(5, 4);
  });

  it('blendPoseSnapshots handles missing poses', () => {
    const root = makeNode('root');
    const fromPose: PoseSnapshotMap = new Map();
    const toPose: PoseSnapshotMap = new Map();
    toPose.set('root', {
      position: [1, 2, 3],
      rotation: [0, 0, 0],
      scale: [2, 2, 2],
    });
    blendPoseSnapshots(root, fromPose, toPose, 0.5);
    expect(root.localPosition).toEqual([1, 2, 3]);
    expect(root.localScale).toEqual([2, 2, 2]);
  });

  it('poseSnapshotEquals respects epsilon', () => {
    const snap = { position: [1, 1, 1] as [number, number, number], rotation: [0, 0, 0] as [number, number, number], scale: [1, 1, 1] as [number, number, number] };
    const near = { position: [1.001, 1, 1] as [number, number, number], rotation: [0, 0, 0] as [number, number, number], scale: [1, 1, 1] as [number, number, number] };
    expect(poseSnapshotEquals(snap, snap)).toBe(true);
    expect(poseSnapshotEquals(snap, null)).toBe(false);
    expect(poseSnapshotEquals(snap, near)).toBe(false);
    expect(poseSnapshotEquals(snap, near, { epsilon: 0.01 })).toBe(true);
  });
});
