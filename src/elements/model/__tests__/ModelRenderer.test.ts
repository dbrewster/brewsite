import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { ModelRenderer } from '../ModelRenderer';
import { createDefaultModelInstanceState } from '../compile';
import type { SceneModelInstanceState } from '../types';

const buildState = (): SceneModelInstanceState => ({
  ...createDefaultModelInstanceState('primary'),
  model: {
    ...createDefaultModelInstanceState('primary').model,
    position: [1, 2, 3],
    rotation: [0.1, 0.2, 0.3],
    scale: 2,
    metalness: 0.2,
    roughness: 0.8,
    bodyPartOverrides: {
      Body: { color: '#ff0000', opacity: 0.5, metalness: 0.1, roughness: 0.9 },
    },
  },
});

describe('ModelRenderer', () => {
  it('applies model transform and body part overrides', () => {
    const scene = new THREE.Scene();
    const renderer = new ModelRenderer(scene);

    const group = new THREE.Group();
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({ color: '#00ff00', metalness: 0.5, roughness: 0.5 }),
    );
    mesh.name = 'Body';
    group.add(mesh);

    (renderer as any).ingestModel(group, []);

    const state = buildState();
    renderer.apply(state);

    expect(group.position.x).toBeCloseTo(1);
    expect(group.position.y).toBeCloseTo(2);
    expect(group.position.z).toBeCloseTo(3);
    expect(group.scale.x).toBeCloseTo(2);

    const mat = mesh.material as THREE.MeshStandardMaterial;
    expect(mat.color.getHexString()).toBe('ff0000');
    expect(mat.opacity).toBeCloseTo(0.5);
    expect(mat.metalness).toBeCloseTo(0.1);
    expect(mat.roughness).toBeCloseTo(0.9);
  });

  it('returns bone world positions', () => {
    const scene = new THREE.Scene();
    const renderer = new ModelRenderer(scene);

    const group = new THREE.Group();
    const bone = new THREE.Bone();
    bone.name = 'Head';
    bone.position.set(5, 6, 7);
    group.add(bone);
    group.updateMatrixWorld(true);

    (renderer as any).ingestModel(group, []);

    const positions = renderer.getBoneWorldPositions();
    const head = positions.get('Head');
    expect(head).toBeDefined();
    expect(head?.[0]).toBeCloseTo(5);
    expect(head?.[1]).toBeCloseTo(6);
    expect(head?.[2]).toBeCloseTo(7);
  });

  it('attaches contained model parts to anchors with overrides', () => {
    const scene = new THREE.Scene();
    const renderer = new ModelRenderer(scene);

    const group = new THREE.Group();
    const anchor = new THREE.Bone();
    anchor.name = 'headBone';
    group.add(anchor);
    group.updateMatrixWorld(true);

    (renderer as any).ingestModel(group, []);
    (renderer as any).anchorTargets = { head: 'headBone' };

    const contained = new THREE.Group();
    const subMesh = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({ color: '#ffffff' }),
    );
    subMesh.name = 'Cortex';
    contained.add(subMesh);

    (renderer as any).containedModelTemplates.set('brain', contained);

    const state = createDefaultModelInstanceState('primary') as SceneModelInstanceState;
    state.model.parts = {
      brain: {
        id: 'brain',
        anchor: 'head',
        enabled: true,
        space: 'local',
        position: [1, 0, 0],
        rotation: [0, 0, 0],
        scale: 1,
        modelId: 'brain',
        subparts: {
          Cortex: {
            id: 'Cortex',
            enabled: true,
            opacity: 0.4,
            color: '#00ffff',
          },
        },
      },
    };

    renderer.apply(state);

    const instance = (renderer as any).attachedParts.get('brain');
    expect(instance).toBeDefined();
    expect(instance.group.parent).toBe(anchor);
    expect(instance.group.position.x).toBeCloseTo(1);
    const instanceMesh = instance.group.getObjectByName('Cortex') as THREE.Mesh | null;
    const mat = instanceMesh?.material as THREE.MeshStandardMaterial | undefined;
    expect(instanceMesh).toBeTruthy();
    expect(mat.opacity).toBeCloseTo(0.4);
  });
});
