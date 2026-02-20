import {createElement} from 'react';
import {describe, expect, it} from 'vitest';
import {createAutoTransitionTransition} from '../sceneTransitions';
import {compileSceneTrack} from '../sceneTrackCompiler';
import {Annotations, AutoTransition, Scene, Transitions} from '../primitives';
import {MessageAnnotation} from '../blocks/annotationBlocks';
import {compileTestTrack, createTestScene, createTestTimeline, SceneTrackInspector} from './compilerE2eUtils';

const modelId = 'model-a';

const buildTransition = (timeline: ReturnType<typeof createTestTimeline>) =>
  createAutoTransitionTransition(
    { exitStart: 0.2, exitEnd: 0.6, enterStart: 0.6, enterEnd: 1 },
    {
      progress: 0,
      sceneProgress: 0,
      globalProgress: 0,
      sceneStart: 0,
      sceneEnd: 1,
      assetsReady: true,
      timeline,
    },
  );

describe('auto transition integration', () => {
  it('fades old hud annotations out and new ones in', () => {
    const timeline = createTestTimeline(['a', 'b'], 20);
    const transition = buildTransition(timeline);
    const sceneA = createTestScene({
      id: 'a',
      index: 0,
      transitions: [transition],
      frame: {
        annotations: [
          {
            id: 'old-hud',
            label: 'Old',
            mode: 'hud',
            target: { targetPoint: [0, 0, 0] },
            labelAnchor: { reference: { x: 'left', y: 'top' }, offset: { xPct: 0.1, yPct: 0.1 } },
            style: {
              labelOpacity: 1,
              lineOpacity: 1,
              containerCss: { opacity: 1 },
              css: { opacity: 1 },
            },
          },
        ],
      },
    });
    const sceneB = createTestScene({
      id: 'b',
      index: 1,
      frame: {
        annotations: [
          {
            id: 'new-hud',
            label: 'New',
            mode: 'hud',
            target: { targetPoint: [0, 0, 0] },
            labelAnchor: { reference: { x: 'left', y: 'top' }, offset: { xPct: 0.1, yPct: 0.1 } },
            style: {
              labelOpacity: 1,
              lineOpacity: 1,
              containerCss: { opacity: 1 },
              css: { opacity: 1 },
            },
          },
        ],
      },
    });

    const track = compileTestTrack({ scenes: [sceneA, sceneB], timeline });
    const inspector = new SceneTrackInspector(track);

    const exitTick = inspector.tickAtSceneProgress('a', 0.4);
    const oldExit = exitTick.state.annotations?.find((anno) => anno.id === 'old-hud');
    const newExit = exitTick.state.annotations?.find((anno) => anno.id === 'new-hud');
    expect(oldExit?.style?.labelOpacity ?? 1).toBeLessThan(1);
    expect(oldExit?.style?.containerCss?.opacity ?? 1).toBeLessThan(1);
    expect(newExit?.style?.labelOpacity ?? 0).toBe(0);
    expect(newExit?.style?.containerCss?.opacity ?? 0).toBe(0);

    const enterTick = inspector.tickAtSceneProgress('a', 0.8);
    const oldEnter = enterTick.state.annotations?.find((anno) => anno.id === 'old-hud');
    const newEnter = enterTick.state.annotations?.find((anno) => anno.id === 'new-hud');
    expect(oldEnter?.style?.labelOpacity ?? 0).toBeLessThan(0.5);
    expect(newEnter?.style?.labelOpacity ?? 0).toBeGreaterThan(0);
    expect(newEnter?.style?.containerCss?.opacity ?? 0).toBeGreaterThan(0);
  });

  it('fades body part overrides out during exit', () => {
    const timeline = createTestTimeline(['a', 'b'], 20);
    const transition = buildTransition(timeline);
    const sceneA = createTestScene({
      id: 'a',
      index: 0,
      transitions: [transition],
      frame: {
        models: {
          [modelId]: {
            model: {
              bodyPartOverrides: {
                head: { opacity: 1 },
              },
            },
          },
        },
      },
    });
    const sceneB = createTestScene({ id: 'b', index: 1 });

    const track = compileTestTrack({ scenes: [sceneA, sceneB], timeline });
    const inspector = new SceneTrackInspector(track);
    const exitTick = inspector.tickAtSceneProgress('a', 0.4);
    const opacity = exitTick.state.models?.[modelId]?.model.bodyPartOverrides?.head?.opacity ?? 1;
    expect(opacity).toBeLessThan(1);
    expect(opacity).toBeGreaterThan(0);
  });

  it('fades labels attached to body parts', () => {
    const timeline = createTestTimeline(['a', 'b'], 20);
    const transition = buildTransition(timeline);
    const sceneA = createTestScene({
      id: 'a',
      index: 0,
      transitions: [transition],
      frame: {
        annotations: [
          {
            id: 'part-label',
            label: 'Head',
            mode: 'world',
            target: { targetPartId: 'head' },
            labelAnchor: { labelOffset: [0, 0, 0] },
            style: {
              labelOpacity: 1,
              lineOpacity: 1,
            },
          },
        ],
      },
    });
    const sceneB = createTestScene({ id: 'b', index: 1, frame: { annotations: [] } });

    const track = compileTestTrack({ scenes: [sceneA, sceneB], timeline });
    const inspector = new SceneTrackInspector(track);
    const exitTick = inspector.tickAtSceneProgress('a', 0.4);
    const label = exitTick.state.annotations?.find((anno) => anno.id === 'part-label');
    expect(label?.style?.labelOpacity ?? 1).toBeLessThan(1);
    expect(label?.style?.lineOpacity ?? 1).toBeLessThan(1);
  });

  it('transitions MessageAnnotation across exit/enter with new ids', () => {
    const timeline = createTestTimeline(['a', 'b'], 20);
    const scenes = [
      {
        id: 'a',
        index: 0,
        render: () =>
          createElement(
            Scene,
            { id: 'a', index: 0 },
            createElement(
              Transitions,
              null,
              createElement(AutoTransition, { exitStart: 0.2, exitEnd: 0.6, enterStart: 0.6, enterEnd: 1 }),
            ),
            createElement(
              Annotations,
              null,
              createElement(MessageAnnotation, { id: 'hero-a', content: 'Hello A' }),
            ),
          ),
      },
      {
        id: 'b',
        index: 1,
        render: () =>
          createElement(
            Scene,
            { id: 'b', index: 1 },
            createElement(
              Annotations,
              null,
              createElement(MessageAnnotation, { id: 'hero-b', content: 'Hello B' }),
            ),
          ),
      },
    ];

    const track = compileSceneTrack({
      scenes,
      timeline,
      assetsReady: true,
      availableClips: [],
      prefersReducedMotion: false,
    });
    const inspector = new SceneTrackInspector(track);

    const exitTick = inspector.tickAtSceneProgress('a', 0.4);
    const oldExit = exitTick.state.annotations?.find((anno) => anno.id === 'hero-a');
    const newExit = exitTick.state.annotations?.find((anno) => anno.id === 'hero-b');
    expect(oldExit?.style?.labelOpacity ?? 1).toBeLessThan(1);
    expect(oldExit?.style?.css?.opacity ?? 1).toBeLessThan(1);
    expect(newExit?.style?.labelOpacity ?? 0).toBe(0);
    expect(newExit?.style?.css?.opacity ?? 0).toBe(0);

    const enterTick = inspector.tickAtSceneProgress('a', 0.8);
    const oldEnter = enterTick.state.annotations?.find((anno) => anno.id === 'hero-a');
    const newEnter = enterTick.state.annotations?.find((anno) => anno.id === 'hero-b');
    expect(oldEnter?.style?.labelOpacity ?? 0).toBeLessThan(0.5);
    expect(newEnter?.style?.labelOpacity ?? 0).toBeGreaterThan(0);
    expect(newEnter?.style?.css?.opacity ?? 0).toBeGreaterThan(0);
  });
});
