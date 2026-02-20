import {describe, expect, it} from 'vitest';
import {modelTransitionSpec} from '../transitions/modelTransitions';
import type {ModelPartId, ModelPartSpec, SceneModel} from '../../../model/robotSceneTypes';
import {buildContext, expectNumberClose, expectVec3Close} from './transitionTestUtils';

const vec = [0, 0, 0] as [number, number, number];

const baseModel: SceneModel = {
  scale: 1,
  position: vec,
  rotation: vec,
  bodyPartOverrides: {},
};

const baseParts = (): Record<ModelPartId, ModelPartSpec> => ({
  brain: {
    id: 'brain',
    anchor: 'head',
    enabled: true,
    modelId: 'brain',
    position: [0, 0, 0] as [number, number, number],
    rotation: [0, 0, 0] as [number, number, number],
    scale: 1,
    opacity: 1,
  },
  attachment: {
    id: 'attachment',
    anchor: 'chest',
    enabled: true,
    modelId: 'brain',
    position: [0, 0, 0] as [number, number, number],
    rotation: [0, 0, 0] as [number, number, number],
    scale: 1,
    opacity: 1,
  },
});

describe('model transitions', () => {
  it('blends model position across', () => {
    const from = { ...baseModel, position: [0, 0, 0] as [number, number, number] };
    const to = { ...baseModel, position: [10, 0, 0] as [number, number, number] };
    const result = modelTransitionSpec.interpolate(from, to, buildContext({ tFull: 0.5 }));
    expectNumberClose(result.position[0], 5);
  });

  it('fades part opacity on transition out', () => {
    const from = {
      ...baseModel,
      parts: baseParts(),
    } satisfies SceneModel;
    const result = modelTransitionSpec.exit(from, buildContext({ tExit: 0.5 }));
    expectNumberClose(result.parts?.brain.opacity, 0);
  });

  it('blends body part pose overrides across', () => {
    const from = {
      ...baseModel,
      bodyPartOverrides: {
        head: { pose: { rotate: { yawPct: 0 } } },
      },
    } satisfies SceneModel;
    const to = {
      ...baseModel,
      bodyPartOverrides: {
        head: { pose: { rotate: { yawPct: 1 } } },
      },
    } satisfies SceneModel;
    const result = modelTransitionSpec.interpolate(from, to, buildContext({ tFull: 0.5 }));
    expectNumberClose(result.bodyPartOverrides?.head?.pose?.rotate?.yawPct, 0.5);
  });

  it('blends model rotation/scale/metalness/roughness across', () => {
    const from = { ...baseModel, rotation: [0, 0, 0] as [number, number, number], scale: 1, metalness: 0, roughness: 0 };
    const to = { ...baseModel, rotation: [1, 2, 3] as [number, number, number], scale: 3, metalness: 1, roughness: 1 };
    const result = modelTransitionSpec.interpolate(from, to, buildContext({ tFull: 0.5 }));
    expectVec3Close(result.rotation, [0.5, 1, 1.5]);
    expectNumberClose(result.scale, 2);
    expectNumberClose(result.metalness, 0.5);
    expectNumberClose(result.roughness, 0.5);
  });

  it('finishes model exit by mid-scene when the next model is hidden', () => {
    const from = { ...baseModel, scale: 1 };
    const to = { ...baseModel, scale: 0.001 };
    const result = modelTransitionSpec.interpolate(
      from,
      to,
      buildContext({ progress: 0.5, exitStart: 0.2, exitEnd: 0.6, tFull: 0.5 }),
    );
    expectNumberClose(result.scale, 0.001);
  });

  it('blends body part override opacity/color/metalness/roughness', () => {
    const from = {
      ...baseModel,
      bodyPartOverrides: {
        head: { opacity: 1, color: '#000000', metalness: 0, roughness: 0 },
      },
    } satisfies SceneModel;
    const to = {
      ...baseModel,
      bodyPartOverrides: {
        head: { opacity: 0, color: '#ffffff', metalness: 1, roughness: 1 },
      },
    } satisfies SceneModel;
    const result = modelTransitionSpec.interpolate(from, to, buildContext({ tFull: 0.5 }));
    expectNumberClose(result.bodyPartOverrides?.head?.opacity, 0.5);
    expect(result.bodyPartOverrides?.head?.color).toBe('#808080');
    expectNumberClose(result.bodyPartOverrides?.head?.metalness, 0.5);
    expectNumberClose(result.bodyPartOverrides?.head?.roughness, 0.5);
  });

  it('blends part transforms across', () => {
    const from = {
      ...baseModel,
      parts: {
        ...baseParts(),
        brain: {
          ...baseParts().brain,
          opacity: 0,
        },
      },
    } satisfies SceneModel;
    const to = {
      ...baseModel,
      parts: {
        ...baseParts(),
        brain: {
          ...baseParts().brain,
          position: [2, 2, 2],
          rotation: [1, 1, 1],
          scale: 2,
          opacity: 1,
        },
      },
    } satisfies SceneModel;
    const result = modelTransitionSpec.interpolate(from, to, buildContext({ tFull: 0.5 }));
    expectVec3Close(result.parts?.brain.position, [1, 1, 1]);
    expectVec3Close(result.parts?.brain.rotation, [0.5, 0.5, 0.5]);
    expectNumberClose(result.parts?.brain.scale, 1.5);
    expectNumberClose(result.parts?.brain.opacity, 0.5);
  });

  it('blends attachment transforms across', () => {
    const from = {
      ...baseModel,
      parts: {
        ...baseParts(),
        attachment: {
          ...baseParts().attachment,
          position: [0, 0, 0],
          rotation: [0, 0, 0],
          scale: 1,
        },
      },
    } satisfies SceneModel;
    const to = {
      ...baseModel,
      parts: {
        ...baseParts(),
        attachment: {
          ...baseParts().attachment,
          position: [2, 2, 2],
          rotation: [1, 1, 1],
          scale: 2,
        },
      },
    } satisfies SceneModel;
    const result = modelTransitionSpec.interpolate(from, to, buildContext({ tFull: 0.5 }));
    expectVec3Close(result.parts?.attachment.position, [1, 1, 1]);
    expectVec3Close(result.parts?.attachment.rotation, [0.5, 0.5, 0.5]);
    expectNumberClose(result.parts?.attachment.scale, 1.5);
  });

  it('blends subparts opacity/color/metalness/roughness', () => {
    const from = {
      ...baseModel,
      parts: {
        ...baseParts(),
        brain: {
          ...baseParts().brain,
          subparts: {
            left: { id: 'left', enabled: true, opacity: 0, color: '#000000', metalness: 0, roughness: 0 },
          },
        },
      },
    } satisfies SceneModel;
    const to = {
      ...baseModel,
      parts: {
        ...baseParts(),
        brain: {
          ...baseParts().brain,
          subparts: {
            left: { id: 'left', enabled: true, opacity: 1, color: '#ffffff', metalness: 1, roughness: 1 },
          },
        },
      },
    } satisfies SceneModel;
    const result = modelTransitionSpec.interpolate(from, to, buildContext({ tFull: 0.5 }));
    const subpart = result.parts?.brain.subparts?.left;
    expectNumberClose(subpart?.opacity, 0.5);
    expect(subpart?.color).toBe('#808080');
    expectNumberClose(subpart?.metalness, 0.5);
    expectNumberClose(subpart?.roughness, 0.5);
  });

  it('keeps both model parts when opacity differs', () => {
    const from = {
      ...baseModel,
      parts: baseParts(),
    } satisfies SceneModel;
    const to = {
      ...baseModel,
      parts: {
        ...baseParts(),
        brain: { ...baseParts().brain, opacity: 0 },
        attachment: { ...baseParts().attachment, opacity: 1 },
      },
    } satisfies SceneModel;
    const result = modelTransitionSpec.interpolate(from, to, buildContext({ tExit: 0.5, tEnter: 0.5, tFull: 0.5 }));
    expect(result.parts && Object.keys(result.parts).length).toBe(2);
  });

  it('treats differing override keys as out/in (no blend)', () => {
    const from = { ...baseModel, bodyPartOverrides: { head: { opacity: 1 } } } satisfies SceneModel;
    const to = { ...baseModel, bodyPartOverrides: { chest: { opacity: 1 } } } satisfies SceneModel;
    const result = modelTransitionSpec.interpolate(from, to, buildContext({ tExit: 0.5, tEnter: 0.5, tFull: 0.5 }));
    expect(result.bodyPartOverrides && Object.keys(result.bodyPartOverrides).length).toBe(2);
  });
});
