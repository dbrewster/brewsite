import { describe, it, expect, vi } from 'vitest';
import { EngineFrameDriver } from '../EngineFrameDriver';
import type { SceneTrackTick } from '../../runtime/compiler/sceneTrackTypes';
import type { SceneTrackSampler } from '../../runtime/compiler/sceneTrackSampler';

const makeTick = (index: number, total: number): SceneTrackTick => ({
  index,
  progress: total > 1 ? index / (total - 1) : 0,
  sceneId: 'test',
  sceneIndex: 0,
  sceneProgress: total > 1 ? index / (total - 1) : 0,
  state: {} as SceneTrackTick['state'],
  deltaForward: {},
  deltaBackward: {},
});

const makeSampler = (ticks: SceneTrackTick[]): SceneTrackSampler => ({
  track: {
    ticks,
    tickStep: 1 / Math.max(1, ticks.length - 1),
    subTickCount: ticks.length,
    sceneWindows: [],
  },
  sample: (progress: number): SceneTrackTick => {
    if (ticks.length === 0) throw new Error('empty');
    const index = Math.round(progress * (ticks.length - 1));
    return ticks[Math.max(0, Math.min(ticks.length - 1, index))]!;
  },
});

describe('EngineFrameDriver', () => {
  it('notifies on the first tick regardless of frame', () => {
    const ticks = [makeTick(0, 3), makeTick(1, 3), makeTick(2, 3)];
    const sampler = makeSampler(ticks);
    const onChange = vi.fn();
    const driver = new EngineFrameDriver({ sampler, onScrollFrameChange: onChange });

    driver.tick({ globalProgress: 0, wallTimeSeconds: 0 });

    expect(onChange).toHaveBeenCalledOnce();
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ frameIndex: 0 }));
  });

  it('does not notify when frame index stays the same', () => {
    const ticks = [makeTick(0, 3), makeTick(1, 3), makeTick(2, 3)];
    const sampler = makeSampler(ticks);
    const onChange = vi.fn();
    const driver = new EngineFrameDriver({ sampler, onScrollFrameChange: onChange });

    driver.tick({ globalProgress: 0, wallTimeSeconds: 0 });
    // progress 0.01 still maps to tick index 0 (nearest integer out of 2)
    driver.tick({ globalProgress: 0.01, wallTimeSeconds: 0.016 });

    expect(onChange).toHaveBeenCalledOnce();
  });

  it('notifies each time the frame index changes', () => {
    const ticks = [makeTick(0, 3), makeTick(1, 3), makeTick(2, 3)];
    const sampler = makeSampler(ticks);
    const onChange = vi.fn();
    const driver = new EngineFrameDriver({ sampler, onScrollFrameChange: onChange });

    driver.tick({ globalProgress: 0, wallTimeSeconds: 0 });      // frame 0
    driver.tick({ globalProgress: 0.5, wallTimeSeconds: 0.016 }); // frame 1
    driver.tick({ globalProgress: 1, wallTimeSeconds: 0.032 });   // frame 2

    expect(onChange).toHaveBeenCalledTimes(3);
  });

  it('emits correct frameIndex, globalProgress, wallTimeSeconds, and tick', () => {
    const ticks = [makeTick(0, 2), makeTick(1, 2)];
    const sampler = makeSampler(ticks);
    const onChange = vi.fn();
    const driver = new EngineFrameDriver({ sampler, onScrollFrameChange: onChange });

    driver.tick({ globalProgress: 1, wallTimeSeconds: 1.23 });

    expect(onChange).toHaveBeenCalledWith({
      frameIndex: 1,
      globalProgress: 1,
      wallTimeSeconds: 1.23,
      tick: ticks[1],
    });
  });

  it('does not emit when scrolling back to same frame', () => {
    const ticks = [makeTick(0, 3), makeTick(1, 3), makeTick(2, 3)];
    const sampler = makeSampler(ticks);
    const onChange = vi.fn();
    const driver = new EngineFrameDriver({ sampler, onScrollFrameChange: onChange });

    driver.tick({ globalProgress: 0, wallTimeSeconds: 0 });   // frame 0: emit
    driver.tick({ globalProgress: 0.5, wallTimeSeconds: 1 }); // frame 1: emit
    driver.tick({ globalProgress: 0, wallTimeSeconds: 2 });   // frame 0: emit (changed)
    driver.tick({ globalProgress: 0, wallTimeSeconds: 3 });   // frame 0: no change, no emit

    expect(onChange).toHaveBeenCalledTimes(3);
  });

  it('reset() forces re-notification on the next tick with the same frame', () => {
    const ticks = [makeTick(0, 2), makeTick(1, 2)];
    const sampler = makeSampler(ticks);
    const onChange = vi.fn();
    const driver = new EngineFrameDriver({ sampler, onScrollFrameChange: onChange });

    driver.tick({ globalProgress: 0, wallTimeSeconds: 0 }); // frame 0: emit
    driver.tick({ globalProgress: 0, wallTimeSeconds: 1 }); // no change, no emit

    driver.reset();

    driver.tick({ globalProgress: 0, wallTimeSeconds: 2 }); // after reset: emit again

    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it('emits with wallTimeSeconds from the tick options', () => {
    const ticks = [makeTick(0, 1)];
    const sampler = makeSampler(ticks);
    const onChange = vi.fn();
    const driver = new EngineFrameDriver({ sampler, onScrollFrameChange: onChange });

    driver.tick({ globalProgress: 0, wallTimeSeconds: 42.5 });

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ wallTimeSeconds: 42.5 }),
    );
  });
});
