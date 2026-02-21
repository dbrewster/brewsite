import { describe, it, expect } from 'vitest';
import { EngineFrameDriver } from '../EngineFrameDriver';
import type { SceneTrackTick } from '../../compiler/sceneTrackTypes';

const makeTick = (index: number, progress: number): SceneTrackTick => ({
  index,
  progress,
  sceneId: `scene-${index}`,
  sceneIndex: index,
  blockProgress: progress,
  state: {
    id: `scene-${index}`,
    scrollProgress: progress,
    widgets: {},
  },
  deltaForward: {},
  deltaBackward: {},
});

describe('EngineFrameDriver', () => {
  it('emits when tick index changes', () => {
    const events: Array<{ tickIndex: number }> = [];
    const driver = new EngineFrameDriver((state) => events.push({ tickIndex: state.tickIndex }));

    driver.handleTick(makeTick(0, 0));
    driver.handleTick(makeTick(0, 0.1));
    driver.handleTick(makeTick(1, 0.2));

    expect(events).toEqual([{ tickIndex: 0 }, { tickIndex: 1 }]);
  });

  it('resets and emits again after reset', () => {
    const events: number[] = [];
    const driver = new EngineFrameDriver((state) => events.push(state.tickIndex));

    driver.handleTick(makeTick(0, 0));
    driver.reset();
    driver.handleTick(makeTick(0, 0.1));

    expect(events).toEqual([0, 0]);
  });
});
