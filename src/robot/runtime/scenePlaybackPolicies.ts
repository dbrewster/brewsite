import type {SceneMotion} from '../elements/model/index';

export type MotionFlags = {
  hasMotion: boolean;
};

export const computeMotionFlags = (motion: SceneMotion): MotionFlags => ({
  hasMotion:
    motion.commands.length > 0 ||
    motion.scenes.length > 0 ||
    Object.keys(motion.pose?.groups ?? {}).length > 0 ||
    (motion.customAnimations?.length ?? 0) > 0,
});
