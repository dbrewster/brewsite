import { describe, it, expect } from 'vitest';
import { createSceneTimeline, createQualityTimeline } from '..';

describe('timeline', () => {
  it('creates a timeline with derived values', () => {
    const timeline = createSceneTimeline([{ id: 'a' }, { id: 'b' }], { framesPerScene: 10, subTicksPerSegment: 2, oversamplingRate: 2 });
    expect(timeline.sceneCount).toBe(2);
    expect(timeline.tickStep).toBe(1);
    expect(timeline.subTickCount).toBe(1 * 2 * 2 + 1);
    expect(timeline.tick(1)).toBe(1);
    expect(timeline.snapToTick(0.6)).toBe(1);
  });

  it('createQualityTimeline adjusts subTickCount', () => {
    const base = createSceneTimeline([{ id: 'a' }, { id: 'b' }, { id: 'c' }], { subTicksPerSegment: 1, oversamplingRate: 2 });
    const quality = createQualityTimeline(base, 3);
    expect(quality.subTickCount).toBe((base.sceneCount - 1) * 3 * base.oversamplingRate + 1);
  });
});
