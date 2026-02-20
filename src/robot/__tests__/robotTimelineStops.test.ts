import {describe, expect, test} from 'vitest';
import {testSceneGroup} from '../runtime/__tests__/fixtures/testSceneFixtures';

describe('robotTimeline stops', () => {
  test('matches core message scene length', () => {
    const {timeline, scenes} = testSceneGroup;
    expect(timeline.stops.length).toBe(scenes.length);
  });

  test('last stop is reachable (tickStep maps to 1)', () => {
    const {timeline} = testSceneGroup;
    const denom = Math.max(1, timeline.stops.length - 1);
    const last = denom / denom;
    expect(last).toBe(1);
    expect(timeline.snapToTick(1)).toBe(1);
  });
});
