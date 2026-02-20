import {MODEL_BONE_NAME_MAP, STANDARD_TO_MODEL_BONE_NAME} from '../../components/logoParticleOptimizedViewer/robotStructureTypes';

const BONE_TRACK_PATTERN = /\.bones\[([^\]]+)\]\./;

export const resolveTrackTargetName = (trackName: string): string | null => {
  const boneMatch = trackName.match(BONE_TRACK_PATTERN);
  if (boneMatch) return boneMatch[1] ?? null;
  const dot = trackName.indexOf('.');
  if (dot <= 0) return null;
  return trackName.slice(0, dot) || null;
};

export const mapTrackTargetName = (rawTarget: string): string => {
  if (Object.prototype.hasOwnProperty.call(STANDARD_TO_MODEL_BONE_NAME, rawTarget)) {
    return STANDARD_TO_MODEL_BONE_NAME[rawTarget as keyof typeof STANDARD_TO_MODEL_BONE_NAME];
  }
  if (Object.prototype.hasOwnProperty.call(MODEL_BONE_NAME_MAP, rawTarget)) {
    return (MODEL_BONE_NAME_MAP as Record<string, string>)[rawTarget] ?? rawTarget;
  }
  return rawTarget;
};

export const filterAndRenameTrack = (
  trackName: string,
  targetNodeNames: Set<string>,
  boneNames?: Set<string>,
): { allowed: boolean; name: string } => {
  const rawTarget = resolveTrackTargetName(trackName);
  if (!rawTarget) {
    return { allowed: true, name: trackName };
  }
  const resolvedName = mapTrackTargetName(rawTarget);

  if (boneNames && boneNames.size > 0 && !boneNames.has(resolvedName)) return { allowed: false, name: trackName };
  if (targetNodeNames.size > 0 && !targetNodeNames.has(resolvedName)) return { allowed: false, name: trackName };

  if (resolvedName !== rawTarget) {
    if (trackName.match(BONE_TRACK_PATTERN)) {
      return { allowed: true, name: trackName.replace(BONE_TRACK_PATTERN, `.bones[${resolvedName}].`) };
    }
    return { allowed: true, name: `${resolvedName}${trackName.slice(rawTarget.length)}` };
  }
  return { allowed: true, name: trackName };
};
