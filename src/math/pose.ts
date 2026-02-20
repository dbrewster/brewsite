import { lerpVec3, quatFromEuler, quatSlerp, quatToEuler } from './index';
import type { Node, PoseSnapshot, PoseSnapshotMap, Vec3 } from '../legacy/runtime/types';

export const capturePose = (node: Node, pose: PoseSnapshotMap): void => {
  pose.set(node.name, {
    position: [node.localPosition[0], node.localPosition[1], node.localPosition[2]],
    rotation: [node.localRotation[0], node.localRotation[1], node.localRotation[2]],
    scale: [node.localScale[0], node.localScale[1], node.localScale[2]],
  });
  node.children.forEach((child) => capturePose(child, pose));
};

export const applyPoseSnapshot = (node: Node, pose: PoseSnapshotMap): void => {
  const snapshot = pose.get(node.name);
  if (snapshot) {
    node.localPosition = [snapshot.position[0], snapshot.position[1], snapshot.position[2]];
    node.localRotation = [snapshot.rotation[0], snapshot.rotation[1], snapshot.rotation[2]];
    node.localScale = [snapshot.scale[0], snapshot.scale[1], snapshot.scale[2]];
  }
  node.children.forEach((child) => applyPoseSnapshot(child, pose));
};

export const blendPoseSnapshot = (node: Node, pose: PoseSnapshotMap, t: number): void => {
  const snapshot = pose.get(node.name);
  if (snapshot) {
    node.localPosition = lerpVec3(snapshot.position, node.localPosition, t);
    node.localScale = lerpVec3(snapshot.scale, node.localScale, t);
    const fromQ = quatFromEuler(snapshot.rotation);
    const toQ = quatFromEuler(node.localRotation);
    const blended = quatSlerp(fromQ, toQ, t);
    node.localRotation = quatToEuler(blended);
  }
  node.children.forEach((child) => blendPoseSnapshot(child, pose, t));
};

export const blendPoseSnapshots = (
  node: Node,
  fromPose: PoseSnapshotMap,
  toPose: PoseSnapshotMap,
  t: number,
): void => {
  const from = fromPose.get(node.name);
  const to = toPose.get(node.name);
  if (from && to) {
    node.localPosition = lerpVec3(from.position, to.position, t);
    node.localScale = lerpVec3(from.scale, to.scale, t);
    const fromQ = quatFromEuler(from.rotation);
    const toQ = quatFromEuler(to.rotation);
    const blended = quatSlerp(fromQ, toQ, t);
    node.localRotation = quatToEuler(blended);
  } else if (to) {
    node.localPosition = [to.position[0], to.position[1], to.position[2]];
    node.localRotation = [to.rotation[0], to.rotation[1], to.rotation[2]];
    node.localScale = [to.scale[0], to.scale[1], to.scale[2]];
  } else if (from) {
    node.localPosition = [from.position[0], from.position[1], from.position[2]];
    node.localRotation = [from.rotation[0], from.rotation[1], from.rotation[2]];
    node.localScale = [from.scale[0], from.scale[1], from.scale[2]];
  }
  node.children.forEach((child) => blendPoseSnapshots(child, fromPose, toPose, t));
};

const vec3Equals = (a: Vec3, b: Vec3, epsilon: number): boolean => (
  Math.abs(a[0] - b[0]) <= epsilon
  && Math.abs(a[1] - b[1]) <= epsilon
  && Math.abs(a[2] - b[2]) <= epsilon
);

export const poseSnapshotEquals = (
  left: PoseSnapshot | null | undefined,
  right: PoseSnapshot | null | undefined,
  options: { epsilon?: number } = {},
): boolean => {
  if (left === right) return true;
  if (!left || !right) return false;
  const epsilon = options.epsilon ?? 0;
  return (
    vec3Equals(left.position, right.position, epsilon)
    && vec3Equals(left.rotation, right.rotation, epsilon)
    && vec3Equals(left.scale, right.scale, epsilon)
  );
};
