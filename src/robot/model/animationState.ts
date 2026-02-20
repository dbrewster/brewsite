import type {ClipMeta, ScenePlayback} from './robotSceneTypes';

export type AnimationState = {
  clipEnabled: boolean;
  resolvedClipName?: string;
  resolvedClips: ClipMeta[];
  hasAnimationRequest: boolean;
};

export function resolveAnimationState(options: {
  playback: ScenePlayback;
  prefersReducedMotion: boolean;
  availableClips?: ClipMeta[];
}): AnimationState {
  const { playback, prefersReducedMotion } = options;
  const availableClips = options.availableClips ?? [];
  const animation = playback.animation ?? null;
  const requestedClip = animation?.enabled
    ? animation.clipName ?? animation.gltfClipName ?? animation.fbxClipName
    : undefined;
  const hasAnimationRequest =
    !!animation &&
    animation.enabled &&
    (!!requestedClip || !!animation.gltfUrl || !!animation.fbxUrl);
  const clipExists = requestedClip ? availableClips.some((clip) => clip.name === requestedClip) : false;
  const clipEnabled = !prefersReducedMotion && hasAnimationRequest && (!requestedClip || clipExists);

  return {
    clipEnabled,
    resolvedClipName: requestedClip,
    resolvedClips: availableClips,
    hasAnimationRequest,
  };
}
