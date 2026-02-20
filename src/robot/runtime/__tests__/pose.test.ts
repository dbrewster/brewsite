import {describe, expect, it} from 'vitest';
import {applyPoseSnapshot, blendPoseSnapshot, capturePose, poseSnapshotEquals} from '../pose';
import type {PoseSnapshotMap} from '../types';
import {MockNode} from '../mocks/MockWorld';

const buildTree = () => {
  const root = new MockNode('root');
  root.localPosition = [1, 0, 0];
  const child = new MockNode('child');
  child.localPosition = [0, 2, 0];
  root.add(child);
  return { root, child };
};

describe('pose helpers', () => {
  it('captures and reapplies poses', () => {
    const { root, child } = buildTree();
    const pose: PoseSnapshotMap = new Map();
    capturePose(root, pose);

    root.localPosition = [10, 0, 0];
    child.localPosition = [0, 20, 0];

    applyPoseSnapshot(root, pose);
    expect(root.localPosition[0]).toBe(1);
    expect(child.localPosition[1]).toBe(2);
  });

  it('blends pose snapshots', () => {
    const { root } = buildTree();
    const pose: PoseSnapshotMap = new Map();
    capturePose(root, pose);

    root.localPosition = [5, 0, 0];
    blendPoseSnapshot(root, pose, 0.5);
    expect(root.localPosition[0]).toBeCloseTo(3, 5);
  });

  it('blends across +/- PI without flipping', () => {
    const root = new MockNode('root');
    const child = new MockNode('child');
    root.add(child);

    const pose: PoseSnapshotMap = new Map();
    root.localRotation = [0, 0, Math.PI - 0.0174533];
    child.localRotation = [0, 0, Math.PI - 0.0174533];
    capturePose(root, pose);

    root.localRotation = [0, 0, -Math.PI + 0.0174533];
    child.localRotation = [0, 0, -Math.PI + 0.0174533];

    blendPoseSnapshot(root, pose, 0.5);

    const rootYaw = root.localRotation[2];
    const childYaw = child.localRotation[2];
    expect(Math.abs(Math.abs(rootYaw) - Math.PI)).toBeLessThan(0.05);
    expect(Math.abs(Math.abs(childYaw) - Math.PI)).toBeLessThan(0.05);
  });

  it('compares pose snapshots with epsilon', () => {
    const left = {
      position: [1, 2, 3] as [number, number, number],
      rotation: [0.1, 0.2, 0.3] as [number, number, number],
      scale: [1, 1, 1] as [number, number, number],
    };
    const right = {
      position: [1.0004, 2.0004, 3.0004] as [number, number, number],
      rotation: [0.1004, 0.2004, 0.3004] as [number, number, number],
      scale: [1.0004, 1.0004, 1.0004] as [number, number, number],
    };

    expect(poseSnapshotEquals(left, right)).toBe(false);
    expect(poseSnapshotEquals(left, right, { epsilon: 0.001 })).toBe(true);
  });
});
