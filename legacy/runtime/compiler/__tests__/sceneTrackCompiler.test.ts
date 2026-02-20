import {describe, expect, it} from 'vitest';
import {compileSceneTrack} from '../sceneTrackCompiler';
import {createSceneTrackSampler} from '../sceneTrackSampler';
import {testSceneGroup} from '../../__tests__/fixtures/testSceneFixtures';
import {compileTestTrack, createTestScene, createTestTimeline, SceneTrackInspector} from './compilerE2eUtils';

const sampleProgress = (start: number, end: number) => (start + end) / 2;

describe('sceneTrackCompiler', () => {
  it('bakes ribbon state into robot scene ticks', () => {
    const track = compileSceneTrack({
      scenes: testSceneGroup.scenes,
      timeline: testSceneGroup.timeline,
      assetsReady: true,
      availableClips: [
        { name: 'retargeted_action', duration: 4 },
        { name: 'breathing-m', duration: 3 },
      ],
      prefersReducedMotion: false,
    });
    const sampler = createSceneTrackSampler(track);
    const robotWindow = track.sceneWindows.find((window) => window.id === 'robot');
    expect(robotWindow).toBeTruthy();
    if (!robotWindow) return;
    const tick = sampler.sample(sampleProgress(robotWindow.start, robotWindow.end));
    expect(tick.state.ribbon.enabled).toBe(true);
    expect(tick.state.ribbon.config?.opacity ?? 0).toBeCloseTo(0, 5);
  });

  it('keeps brain enabled in detail scene ticks', () => {
    const track = compileSceneTrack({
      scenes: testSceneGroup.scenes,
      timeline: testSceneGroup.timeline,
      assetsReady: true,
      availableClips: [
        { name: 'retargeted_action', duration: 4 },
        { name: 'breathing-m', duration: 3 },
      ],
      prefersReducedMotion: false,
    });
    const sampler = createSceneTrackSampler(track);
    const memoryWindow = track.sceneWindows.find((window) => window.id === 'memory');
    expect(memoryWindow).toBeTruthy();
    if (!memoryWindow) return;
    const tick = sampler.sample(sampleProgress(memoryWindow.start, memoryWindow.end));
    const modelId = Object.keys(tick.state.models ?? {})[0];
    expect(tick.state.models?.[modelId]?.model.parts?.brain?.enabled).toBe(true);
  });

  it('keeps brain enabled in robot scene ticks', () => {
    const track = compileSceneTrack({
      scenes: testSceneGroup.scenes,
      timeline: testSceneGroup.timeline,
      assetsReady: true,
      availableClips: [
        { name: 'retargeted_action', duration: 4 },
        { name: 'breathing-m', duration: 3 },
      ],
      prefersReducedMotion: false,
    });
    const sampler = createSceneTrackSampler(track);
    const robotWindow = track.sceneWindows.find((window) => window.id === 'robot');
    expect(robotWindow).toBeTruthy();
    if (!robotWindow) return;
    const tick = sampler.sample(sampleProgress(robotWindow.start, robotWindow.end));
    const modelId = Object.keys(tick.state.models ?? {})[0];
    expect(tick.state.models?.[modelId]?.model.parts?.brain?.enabled).toBe(true);
  });

  it('keeps ribbon opacity stable across the intro transition', () => {
    const track = compileSceneTrack({
      scenes: testSceneGroup.scenes,
      timeline: testSceneGroup.timeline,
      assetsReady: true,
      availableClips: [
        { name: 'retargeted_action', duration: 4 },
        { name: 'breathing-m', duration: 3 },
      ],
      prefersReducedMotion: false,
    });
    const sampler = createSceneTrackSampler(track);
    const introWindow = track.sceneWindows.find((window) => window.id === 'intro');
    expect(introWindow).toBeTruthy();
    if (!introWindow) return;
    const early = sampler.sample(introWindow.start + (introWindow.end - introWindow.start) * 0.2);
    const late = sampler.sample(introWindow.start + (introWindow.end - introWindow.start) * 0.8);
    const earlyOpacity = early.state.ribbon.config?.opacity ?? 0;
    const lateOpacity = late.state.ribbon.config?.opacity ?? 0;
    expect(lateOpacity).toBeCloseTo(earlyOpacity, 5);
  });

  it('keeps animation metadata disabled when scenes opt out', () => {
    const track = compileSceneTrack({
      scenes: testSceneGroup.scenes,
      timeline: testSceneGroup.timeline,
      assetsReady: true,
      availableClips: [
        { name: 'retargeted_action', duration: 4 },
        { name: 'breathing-m', duration: 3 },
      ],
      prefersReducedMotion: false,
    });
    const sampler = createSceneTrackSampler(track);
    const ecWindow = track.sceneWindows.find((window) => window.id === 'ec');
    expect(ecWindow).toBeTruthy();
    if (!ecWindow) return;
    const tick = sampler.sample(sampleProgress(ecWindow.start, ecWindow.end));
    const modelId = Object.keys(tick.state.models ?? {})[0];
    expect(tick.modelAnimations?.[modelId]?.enabled ?? false).toBe(false);
  });

  it('re-enables parts when scrubbing backward', () => {
    const track = compileSceneTrack({
      scenes: testSceneGroup.scenes,
      timeline: testSceneGroup.timeline,
      assetsReady: true,
      availableClips: [
        { name: 'retargeted_action', duration: 4 },
        { name: 'breathing-m', duration: 3 },
      ],
      prefersReducedMotion: false,
    });
    const sampler = createSceneTrackSampler(track);
    const introWindow = track.sceneWindows.find((window) => window.id === 'intro');
    expect(introWindow).toBeTruthy();
    if (!introWindow) return;
    const tick = sampler.sample(introWindow.start + (introWindow.end - introWindow.start) * 0.9);
    const modelId = Object.keys(tick.state.models ?? {})[0];
    const enabled = modelId
      ? tick.deltaBackward.models?.[modelId]?.model?.parts?.attachment?.enabled
      : undefined;
    expect(enabled).toBe(true);
  });

  it('merges annotation deltas across scenes by id', () => {
    const timeline = createTestTimeline(['intro', 'detail'], 4);
    const track = compileTestTrack({
      timeline,
      scenes: [
        createTestScene({
          id: 'intro',
          index: 0,
          frame: {
            annotations: [
              {
                id: 'hero',
                label: 'Hero',
                mode: 'screen',
                target: { targetPoint: [0, 0, 0] },
                labelAnchor: {
                  reference: { x: 'center', y: 'center' },
                  offset: { xPct: 0, yPct: 0 },
                },
                style: {
                  lineOpacity: 0.2,
                  lineThickness: 0.1,
                },
              },
            ],
          },
        }),
        createTestScene({
          id: 'detail',
          index: 1,
          frame: {
            annotations: [
              {
                id: 'hero',
                style: {
                  lineOpacity: 0.9,
                },
                visibility: {
                  minDistance: 5,
                },
              },
            ],
          },
        }),
      ],
    });
    const inspector = new SceneTrackInspector(track);
    const tick = inspector.tickAtSceneProgress('detail', 0.5);
    const annotation = tick.annotationPrimitives?.find((item) => item.id === 'hero');
    expect(annotation).toBeTruthy();
    expect(annotation?.label).toBe('Hero');
    expect(annotation?.style.lineOpacity).toBe(0.9);
    expect(annotation?.style.lineThickness).toBe(0.1);
    expect(annotation?.visibility.minDistance).toBe(5);
    expect(annotation?.labelAnchor).toBeTruthy();
  });

  it('compiles animation metadata for multiple models', () => {
    const timeline = createTestTimeline(['alpha'], 4);
    const track = compileTestTrack({
      timeline,
      scenes: [
        createTestScene({
          id: 'alpha',
          index: 0,
          frame: {
            models: {
              a: { playback: { animation: { enabled: true, clipName: 'one' } } },
              b: { playback: { animation: { enabled: true, clipName: 'two' } } },
            },
          },
        }),
      ],
      availableClips: [
        { name: 'one', duration: 2 },
        { name: 'two', duration: 3 },
      ],
    });
    const inspector = new SceneTrackInspector(track);
    const tick = inspector.tickAtSceneProgress('alpha', 0.5);
    expect(tick.modelAnimations?.a?.clipName).toBe('one');
    expect(tick.modelAnimations?.b?.clipName).toBe('two');
  });
});
