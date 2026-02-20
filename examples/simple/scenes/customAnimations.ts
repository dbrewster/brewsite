import type {CustomAnimation, CustomAnimationOp} from '../../../robot/model/robotSceneTypes';
import {computeBlinkState, computeRestDelta} from '../../../robot/runtime/motionEffects';
import {type RestBoneSpec, ROBOT_REST_RIG_TARGETS, ROBOT_SKELETON} from '../../../components/logoParticleOptimizedViewer/robotRig';

export const createBreathingAnimation = (options?: {
  id?: string;
  enabled?: boolean;
  intensity?: number;
  speed?: number;
  layer?: 'base' | 'overlay';
  weight?: number;
}): CustomAnimation => {
  const {
    id = 'breathing',
    enabled = true,
    intensity = 1,
    speed = 1,
    layer = 'base',
    weight,
  } = options ?? {};

  return {
    id,
    enabled,
    layer,
    weight,
    apply: ({ wallTimeSeconds }) => {
      const ops: CustomAnimationOp[] = [];
      for (const spec of Object.values(ROBOT_REST_RIG_TARGETS) as RestBoneSpec[]) {
        const delta = computeRestDelta(spec, wallTimeSeconds, intensity, speed);
        if (delta.rotX || delta.rotY || delta.rotZ) {
          ops.push({
            targetName: spec.name,
            type: 'rotation' as const,
            mode: 'add' as const,
            value: [delta.rotX, delta.rotY, delta.rotZ] as [number, number, number],
          });
        }
        if (spec.posX || spec.posY || spec.posZ) {
          ops.push({
            targetName: spec.name,
            type: 'position' as const,
            mode: 'add' as const,
            value: [delta.posX ?? 0, delta.posY ?? 0, delta.posZ ?? 0] as [number, number, number],
          });
        }
      }
      return ops;
    },
  };
};

export const createBlinkAnimation = (options?: {
  id?: string;
  enabled?: boolean;
  layer?: 'base' | 'overlay';
  weight?: number;
}): CustomAnimation => {
  const {
    id = 'blink',
    enabled = true,
    layer = 'overlay',
    weight,
  } = options ?? {};
  const eyesName = ROBOT_SKELETON.objects.eyes;

  return {
    id,
    enabled,
    layer,
    weight,
    apply: ({ wallTimeSeconds, getBaseTransform }) => {
      const base = getBaseTransform(eyesName);
      if (!base) return [];
      const blink = computeBlinkState(wallTimeSeconds);
      const scale = [base.scale[0], base.scale[1] * blink.scaleY, base.scale[2]] as [number, number, number];
      const yOffset = base.scale[1] * blink.yOffsetFactor;
      const position = [base.position[0], base.position[1] - yOffset, base.position[2]] as [number, number, number];
      return [
        { targetName: eyesName, type: 'scale', mode: 'set', value: scale },
        { targetName: eyesName, type: 'position', mode: 'set', value: position },
      ];
    },
  };
};
