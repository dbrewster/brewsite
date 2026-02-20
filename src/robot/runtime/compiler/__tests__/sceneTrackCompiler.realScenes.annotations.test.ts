import {describe, expect, it} from 'vitest';
import {compileSceneTrack} from '../sceneTrackCompiler';
import {testSceneGroup} from '../../__tests__/fixtures/testSceneFixtures';
import {SceneTrackInspector} from './compilerE2eUtils';

const buildInspector = () => {
  const track = compileSceneTrack({
    scenes: testSceneGroup.scenes,
    timeline: testSceneGroup.timeline,
    assetsReady: true,
    availableClips: [],
    prefersReducedMotion: false,
  });
  return new SceneTrackInspector(track);
};

const findAnnotation = (annotations?: Array<{ id: string; style?: { labelOpacity?: number } }>, id?: string) =>
  annotations && annotations.find((item) => item.id === id);

describe('sceneTrackCompiler real scenes annotations', () => {
  it('fades base-message out and robot-message in during intro -> robot transition', () => {
    const inspector = buildInspector();
    const early = inspector.tickAtSceneProgress('intro', 0.1);
    const midExit = inspector.tickAtSceneProgress('intro', 0.4);
    const exitEnd = inspector.tickAtSceneProgress('intro', 0.6);
    const enterMid = inspector.tickAtSceneProgress('intro', 0.7);
    const enterLate = inspector.tickAtSceneProgress('intro', 0.95);

    const baseEarly = findAnnotation(early.annotationPrimitives, 'base-message');
    const baseMid = findAnnotation(midExit.annotationPrimitives, 'base-message');
    const baseExit = findAnnotation(exitEnd.annotationPrimitives, 'base-message');
    const robotEnter = findAnnotation(enterMid.annotationPrimitives, 'robot-message');
    const robotLate = findAnnotation(enterLate.annotationPrimitives, 'robot-message');

    expect(baseEarly?.style?.labelOpacity).toBeGreaterThan(0.8);
    expect(baseMid?.style?.labelOpacity).toBeLessThan(0.9);
    expect(baseMid?.style?.labelOpacity).toBeGreaterThan(0.1);
    expect(baseExit?.style?.labelOpacity ?? 0).toBeLessThan(0.05);

    expect(robotEnter?.style?.labelOpacity ?? 0).toBeGreaterThan(0);
    expect(robotLate?.style?.labelOpacity ?? 0).toBeGreaterThan(0.7);
  });
});
