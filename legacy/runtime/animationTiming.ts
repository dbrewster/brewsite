import type {SceneAnimation} from '../elements/model/index';
import {resolveClipRangeSeconds} from '../elements/model/index';

export const toAnimationTimeSeconds = (
  sceneProgress: number,
  animation: SceneAnimation,
  clipDuration: number,
): number => {
  const { startSeconds, endSeconds, span } = resolveClipRangeSeconds(animation, clipDuration);
  let timeSeconds = startSeconds + sceneProgress * span;
  const repeat = animation.clipRepeat !== false;
  if (repeat) {
    const wrapped = ((timeSeconds - startSeconds) % span + span) % span;
    timeSeconds = startSeconds + wrapped;
  } else {
    timeSeconds = Math.min(endSeconds, Math.max(startSeconds, timeSeconds));
  }
  return timeSeconds;
};
