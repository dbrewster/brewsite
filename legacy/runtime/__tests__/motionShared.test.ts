import {describe, expect, it} from 'vitest';
import type {SceneMotion} from '../../model/robotSceneTypes';
import {__test__, buildMergedMotionCommands} from '../motionShared';

describe('motionShared', () => {
  it('merges scroll, scene, and flex commands in order', () => {
    const sceneMotion: SceneMotion = {
      commands: [{ groupId: 'torso', rotate: { yawPct: 0.1 } }],
      scenes: [
        {
          id: 'scroll',
          start: 0,
          end: 1,
          holdAtEnd: true,
          commands: (t) => [{ groupId: 'left_arm', rotate: { yawPct: t } }],
        },
      ],
    };

    const merged = buildMergedMotionCommands(sceneMotion, 0.5, 0.5);
    expect(merged[0]?.groupId).toBe('left_arm');
    expect(merged[1]?.groupId).toBe('torso');
    expect(merged.some((command) => command.groupId === 'left_fingers')).toBe(true);
  });

  it('suppresses flex commands outside the flex window', () => {
    const flexNone = __test__.buildFlexCommands(2);
    expect(flexNone.length).toBe(0);
  });
});
