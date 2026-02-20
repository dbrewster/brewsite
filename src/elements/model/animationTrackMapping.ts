// animationTrackMapping — maps raw GLTF track target names through the anchor target map.
// Pure functions, no Three.js. Safe to unit-test without a DOM.

import type { AnchorTargetMap } from './metadata';
import type { AnimationTrack } from '../../runtime/types';

/**
 * Resolves a raw GLTF track target name to the canonical bone/node name.
 *
 * If the anchorTargets map contains the raw name as a key, returns the mapped
 * value. Otherwise passes the name through unchanged. This lets consumers remap
 * model-specific bone names (e.g. "mixamorig:Head") to stable IDs used at
 * runtime (e.g. "head").
 */
export const resolveTrackTargetName = (
  rawName: string,
  anchorTargets: AnchorTargetMap,
): string => anchorTargets[rawName] ?? rawName;

/**
 * Identity mapping — returns the name unchanged.
 *
 * Provided so call-sites that accept a name-mapper function can pass this
 * as a no-op default instead of constructing a lambda.
 */
export const mapTrackTargetName = (name: string): string => name;

/**
 * Filters and renames an animation track through the anchor target map.
 *
 * Returns null if the resolved target name is empty or the track should be
 * suppressed. Otherwise returns a new track with the target name replaced by
 * the resolved canonical name.
 *
 * This is a pure function — the original track is never mutated.
 */
export const filterAndRenameTrack = (
  track: AnimationTrack,
  anchorTargets: AnchorTargetMap,
): AnimationTrack | null => {
  const resolved = resolveTrackTargetName(track.targetName, anchorTargets);
  if (!resolved) return null;
  if (resolved === track.targetName) return track;
  return { ...track, targetName: resolved };
};
