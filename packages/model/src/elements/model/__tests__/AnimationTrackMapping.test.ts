import { describe, it, expect } from 'vitest';
import {
  resolveTrackTargetName,
  mapTrackTargetName,
  filterAndRenameTrack,
} from '../animationTrackMapping';
import type { AnimationTrack } from '@brewsite/core/runtime/types';

describe('animationTrackMapping', () => {
  it('resolveTrackTargetName maps anchor targets', () => {
    const result = resolveTrackTargetName('mixamorig:Head', { 'mixamorig:Head': 'head' });
    expect(result).toBe('head');
  });

  it('mapTrackTargetName is identity', () => {
    expect(mapTrackTargetName('spine')).toBe('spine');
  });

  it('filterAndRenameTrack renames when mapped', () => {
    const track: AnimationTrack = {
      targetName: 'mixamorig:Head',
      property: 'position',
      keyframes: [{ t: 0, value: [0, 0, 0] }],
    };
    const result = filterAndRenameTrack(track, { 'mixamorig:Head': 'head' });
    expect(result?.targetName).toBe('head');
  });

  it('filterAndRenameTrack returns original track when unchanged', () => {
    const track: AnimationTrack = {
      targetName: 'spine',
      property: 'rotation',
      keyframes: [{ t: 0, value: [0, 0, 0] }],
    };
    const result = filterAndRenameTrack(track, {});
    expect(result).toBe(track);
  });
});
