import {describe, expect, it} from 'vitest';
import {compileSceneTrack} from '../sceneTrackCompiler';
import {testSceneGroup} from '../../__tests__/fixtures/testSceneFixtures';
import type {SceneTrackTick} from '../sceneTrackTypes';

const findFirstTick = (ticks: SceneTrackTick[], sceneId: string) =>
  ticks.find((tick) => tick.sceneId === sceneId) ?? null;

describe('sceneTrackCompiler model positions', () => {
  it('applies scene model position in robot scene', () => {
    const track = compileSceneTrack({
      scenes: testSceneGroup.scenes,
      timeline: testSceneGroup.timeline,
      assetsReady: true,
      availableClips: [],
      prefersReducedMotion: false,
      ui: { ar: 16 / 9 },
    });

    const introTick = findFirstTick(track.ticks, 'intro');
    const robotTick = findFirstTick(track.ticks, 'robot');
    expect(introTick).toBeTruthy();
    expect(robotTick).toBeTruthy();

    const introModel = introTick?.state.models?.primary?.model;
    const robotModel = robotTick?.state.models?.primary?.model;
    expect(introModel).toBeTruthy();
    expect(robotModel).toBeTruthy();

    const introY = introModel?.position[1] ?? 0;
    const robotY = robotModel?.position[1] ?? 0;
    expect(Math.abs(introY - robotY)).toBeGreaterThan(2);
  });

  it('blends model position across the intro -> robot transition window', () => {
    const track = compileSceneTrack({
      scenes: testSceneGroup.scenes,
      timeline: testSceneGroup.timeline,
      assetsReady: true,
      availableClips: [],
      prefersReducedMotion: false,
      ui: { ar: 16 / 9 },
    });

    const introTicks = track.ticks.filter((tick) => tick.sceneId === 'intro');
    const robotTicks = track.ticks.filter((tick) => tick.sceneId === 'robot');
    expect(introTicks.length).toBeGreaterThan(0);
    expect(robotTicks.length).toBeGreaterThan(0);

    const introBase = introTicks[0]?.state.models?.primary?.model.position;
    const robotBase = robotTicks[0]?.state.models?.primary?.model.position;
    if (!introBase || !robotBase) throw new Error('Missing model positions');

    const blendTick = introTicks.find((tick) => tick.sceneProgress > 0.75);
    expect(blendTick).toBeTruthy();
    const blendPos = blendTick?.state.models?.primary?.model.position;
    if (!blendPos) throw new Error('Missing blended position');

    const minY = Math.min(introBase[1], robotBase[1]);
    const maxY = Math.max(introBase[1], robotBase[1]);
    expect(blendPos[1]).toBeGreaterThan(minY);
    expect(blendPos[1]).toBeLessThan(maxY);
  });
});
