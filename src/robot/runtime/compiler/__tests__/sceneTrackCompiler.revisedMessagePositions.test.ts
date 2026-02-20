import {describe, expect, it} from 'vitest';
import {compileSceneTrack} from '../sceneTrackCompiler';
import {coreMessageSceneGroup} from '../../../../pages/revised-message/scenes/sceneGroup';
import type {SceneTrackTick} from '../sceneTrackTypes';

const findFirstTick = (ticks: SceneTrackTick[], sceneId: string) =>
  ticks.find((tick) => tick.sceneId === sceneId) ?? null;

describe('sceneTrackCompiler revised-message model positions', () => {
  it('applies scene model position in robot scene (revised-message)', () => {
    const track = compileSceneTrack({
      scenes: coreMessageSceneGroup.scenes,
      timeline: coreMessageSceneGroup.timeline,
      assetsReady: true,
      availableClips: [],
      prefersReducedMotion: false,
      ui: {ar: 16 / 9},
    });

    const introTick = findFirstTick(track.ticks, 'intro');
    const robotTick = findFirstTick(track.ticks, 'robot');
    expect(introTick).toBeTruthy();
    expect(robotTick).toBeTruthy();

    const introModel = introTick?.state.models?.['primary-revised']?.model;
    const robotModel = robotTick?.state.models?.['primary-revised']?.model;
    expect(introModel).toBeTruthy();
    expect(robotModel).toBeTruthy();

    const introY = introModel?.position[1] ?? 0;
    const robotY = robotModel?.position[1] ?? 0;
    // intro is at [0, -20, 0]; robot is at [6, -25+moveDelta, 0]
    // Positions must differ by more than 2 units in Y
    expect(Math.abs(introY - robotY)).toBeGreaterThan(2);
  });

  it('blends model position across the intro -> robot transition window (revised-message)', () => {
    const track = compileSceneTrack({
      scenes: coreMessageSceneGroup.scenes,
      timeline: coreMessageSceneGroup.timeline,
      assetsReady: true,
      availableClips: [],
      prefersReducedMotion: false,
      ui: {ar: 16 / 9},
    });

    const introTicks = track.ticks.filter((tick) => tick.sceneId === 'intro');
    const robotTicks = track.ticks.filter((tick) => tick.sceneId === 'robot');
    expect(introTicks.length).toBeGreaterThan(0);
    expect(robotTicks.length).toBeGreaterThan(0);

    const introBase = introTicks[0]?.state.models?.['primary-revised']?.model.position;
    const robotBase = robotTicks[0]?.state.models?.['primary-revised']?.model.position;
    if (!introBase || !robotBase) throw new Error('Missing model positions');

    // Find a tick in the intro scene where sceneProgress > 0.75 (blend zone)
    const blendTick = introTicks.find((tick) => tick.sceneProgress > 0.75);
    expect(blendTick).toBeTruthy();
    const blendPos = blendTick?.state.models?.['primary-revised']?.model.position;
    if (!blendPos) throw new Error('Missing blended position');

    const minY = Math.min(introBase[1], robotBase[1]);
    const maxY = Math.max(introBase[1], robotBase[1]);
    expect(blendPos[1]).toBeGreaterThan(minY);
    expect(blendPos[1]).toBeLessThan(maxY);
  });

  it('robot scene has different position than intro scene (revised-message)', () => {
    const track = compileSceneTrack({
      scenes: coreMessageSceneGroup.scenes,
      timeline: coreMessageSceneGroup.timeline,
      assetsReady: true,
      availableClips: [],
      prefersReducedMotion: false,
      // No ui.ar — moveDelta = 0
    });

    const introTick = findFirstTick(track.ticks, 'intro');
    const robotTick = findFirstTick(track.ticks, 'robot');
    if (!introTick || !robotTick) throw new Error('Missing ticks');

    const introPos = introTick.state.models?.['primary-revised']?.model.position;
    const robotPos = robotTick.state.models?.['primary-revised']?.model.position;
    if (!introPos || !robotPos) throw new Error('Missing model positions');

    // Even without ui.ar (moveDelta=0): intro [0,-20,0] vs robot [6,-25,0]
    expect(introPos[0]).not.toBe(robotPos[0]); // X: 0 vs 6
    expect(introPos[1]).not.toBe(robotPos[1]); // Y: -20 vs -25
  });
});
