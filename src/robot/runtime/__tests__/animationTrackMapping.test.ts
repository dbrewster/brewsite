import {describe, expect, it} from 'vitest';
import {filterAndRenameTrack} from '../animationTrackMapping';

describe('animationTrackMapping', () => {
  it('renames bones to model mapping and filters missing targets', () => {
    const targets = new Set<string>(['mixamorigSpine', 'mixamorigHead']);
    const bones = new Set<string>(['mixamorigSpine', 'mixamorigHead']);
    const renamed = filterAndRenameTrack('Hips.position', targets, bones);
    expect(renamed.allowed).toBe(false);

    const headTrack = filterAndRenameTrack('mixamorig:Head.quaternion', targets, bones);
    expect(headTrack.allowed).toBe(true);
    expect(headTrack.name.startsWith('mixamorigHead.')).toBe(true);
  });
});
