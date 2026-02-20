import {describe, expect, it} from 'vitest';
import {resolveMotionCommands} from '../motionState';
import type {RobotMotionScene} from '../robotMotionTypes';

const ease = (t: number) => t * t;

describe('motionState', () => {
  it('returns commands within a scene window', () => {
    const scenes: RobotMotionScene[] = [
      {
        id: 'test',
        start: 0.2,
        end: 0.4,
        ease,
        commands: [{ groupId: 'head', rotate: { yawPct: 0.5 } }],
      },
    ];

    const commands = resolveMotionCommands({ scrollScenes: scenes, scrollProgress: 0.3, timeSeconds: 1 });
    expect(commands.length).toBe(1);
    expect(commands[0]?.groupId).toBe('head');
    expect(commands[0]?.weight).toBeGreaterThan(0);
  });

  it('returns empty outside window when holdAtEnd is false', () => {
    const scenes: RobotMotionScene[] = [
      {
        id: 'test',
        start: 0.2,
        end: 0.4,
        commands: [{ groupId: 'head', rotate: { yawPct: 0.5 } }],
      },
    ];

    const commands = resolveMotionCommands({ scrollScenes: scenes, scrollProgress: 0.1, timeSeconds: 1 });
    expect(commands).toEqual([]);
  });

  it('returns commands after end when holdAtEnd is true', () => {
    const scenes: RobotMotionScene[] = [
      {
        id: 'test',
        start: 0.2,
        end: 0.4,
        holdAtEnd: true,
        commands: [{ groupId: 'head', rotate: { yawPct: 0.5 } }],
      },
    ];

    const commands = resolveMotionCommands({ scrollScenes: scenes, scrollProgress: 0.9, timeSeconds: 1 });
    expect(commands.length).toBe(1);
  });
});
