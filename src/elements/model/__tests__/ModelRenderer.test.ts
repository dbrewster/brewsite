import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { ModelRenderer } from '../ModelRenderer';
import { createDefaultModelInstanceState } from '../compile';
import type { SceneModelInstanceState } from '../types';

const identity: SceneModelInstanceState = {
  model: {
    scale: 0.1,
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    enabled: true,
    bodyPartOverrides: {},
  },
  playback: {
    motion: { commands: [], scenes: [], customAnimations: [] },
    animation: { enabled: false },
  },
};

const buildState = (): SceneModelInstanceState => ({
  ...createDefaultModelInstanceState('primary', identity),
  model: {
    ...createDefaultModelInstanceState('primary', identity).model,
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

  it('treats disabled model as fully transparent', () => {
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
    state.model.enabled = false;
    renderer.apply(state);

    const mat = mesh.material as THREE.MeshStandardMaterial;
    expect(mat.opacity).toBeCloseTo(0);
    expect(mesh.visible).toBe(false);
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

  it('uses meshId field for material overrides on linked components', () => {
    const scene = new THREE.Scene();
    const renderer = new ModelRenderer(scene);

    const group = new THREE.Group();
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({ color: '#ffffff' }),
    );
    mesh.name = 'FOREARM_RIGHT';
    group.add(mesh);
    (renderer as any).ingestModel(group, []);

    const state: SceneModelInstanceState = {
      ...createDefaultModelInstanceState('primary', identity),
      model: {
        ...createDefaultModelInstanceState('primary', identity).model,
        bodyPartOverrides: {
          // Linked component: key is canonical name, meshId routes to actual mesh
          RightForeArm: {
            color: '#ff0000',
            meshId: 'FOREARM_RIGHT',
            boneId: 'mixamorigRightForeArm',
          },
        },
      },
    };

    renderer.apply(state);

    const mat = mesh.material as THREE.MeshStandardMaterial;
    expect(mat.color.getHexString()).toBe('ff0000');
  });

  it('skips material application for bone-only entries (no warning spam)', () => {
    const scene = new THREE.Scene();
    const renderer = new ModelRenderer(scene);

    const group = new THREE.Group();
    // Add a bone — note: no mesh named 'mixamorigHead'
    const bone = new THREE.Bone();
    bone.name = 'mixamorigHead';
    group.add(bone);
    (renderer as any).ingestModel(group, []);

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const state: SceneModelInstanceState = {
      ...createDefaultModelInstanceState('primary', identity),
      model: {
        ...createDefaultModelInstanceState('primary', identity).model,
        bodyPartOverrides: {
          // Bone-only identity entry — should NOT trigger a warning
          'mixamorigHead': { targetKind: 'bone' },
        },
      },
    };

    renderer.apply(state);

    expect(warnSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('[ModelRenderer] missing mesh'),
    );
    warnSpy.mockRestore();
  });

  it('uses boneId field for pose overrides on linked components', () => {
    const scene = new THREE.Scene();
    const renderer = new ModelRenderer(scene);

    const group = new THREE.Group();
    const bone = new THREE.Bone();
    bone.name = 'mixamorigRightForeArm';
    bone.position.set(0, 0, 0);
    bone.rotation.set(0, 0, 0);
    group.add(bone);
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(),
      new THREE.MeshStandardMaterial(),
    );
    mesh.name = 'FOREARM_RIGHT';
    group.add(mesh);
    (renderer as any).ingestModel(group, []);

    const state: SceneModelInstanceState = {
      ...createDefaultModelInstanceState('primary', identity),
      model: {
        ...createDefaultModelInstanceState('primary', identity).model,
        bodyPartOverrides: {
          RightForeArm: {
            color: '#00ff00',
            boneId: 'mixamorigRightForeArm',
            meshId: 'FOREARM_RIGHT',
            pose: { rotate: { yawPct: 0.5 } },
          },
        },
      },
    };

    renderer.apply(state);

    // The bone should have its rotation modified via pose override
    expect(bone.rotation.y).toBeCloseTo(0.5);
    // The mesh should have its color updated via meshId routing
    const mat = mesh.material as THREE.MeshStandardMaterial;
    expect(mat.color.getHexString()).toBe('00ff00');
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

    const state = createDefaultModelInstanceState('primary', identity) as SceneModelInstanceState;
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
    if (!mat) {
      throw new Error('Expected material to be defined');
    }
    expect(mat.opacity).toBeCloseTo(0.4);
  });
});
