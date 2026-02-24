import { describe, it, expect } from 'vitest';
import {
  ASSET_MANIFEST_VERSION,
  clipMetaFromManifest,
  findModelMeta,
  assertManifestValid,
} from '../metadata';
import type { AssetManifest, BodyPartGroup } from '../metadata';

// boneIds use Three.js runtime format (colon stripped): "mixamorigRightForeArm"
// gltf-transform reports "mixamorig:RightForeArm" but Three.js strips the colon.
const makeBodyPartGroups = (): BodyPartGroup[] => [
  { name: 'RightForeArm', boneIds: ['mixamorigRightForeArm'], meshIds: ['FOREARM_RIGHT'] },
  { name: 'LeftHand', boneIds: ['mixamorigLeftHand'], meshIds: ['HAND_LEFT'] },
  { name: 'CalfInRight', boneIds: [], meshIds: ['CALF_IN_RIGHT'] },
  { name: 'LeftHandIndex1', boneIds: ['mixamorigLeftHandIndex1'], meshIds: [] },
];

const makeManifest = (): AssetManifest => ({
  version: ASSET_MANIFEST_VERSION,
  models: [{
    type: 'bot',
    glb: '/bot.glb',
    bones: [],
    meshes: [],
    anchorTargets: {},
    bodyPartGroups: makeBodyPartGroups(),
    identity: {
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
    },
  }],
  containedModels: [],
  animations: [{ type: 'idle', glb: '/idle.glb', clipName: 'Idle', duration: 2 }],
});

describe('model metadata helpers', () => {
  it('clipMetaFromManifest maps animation clip names', () => {
    const manifest = makeManifest();
    const clips = clipMetaFromManifest(manifest);
    expect(clips[0].name).toBe('Idle');
    expect(clips[0].duration).toBe(2);
  });

  it('clipMetaFromManifest returns empty array when no animations', () => {
    const manifest = { ...makeManifest(), animations: [] };
    const clips = clipMetaFromManifest(manifest);
    expect(clips).toEqual([]);
  });

  it('findModelMeta finds by type', () => {
    const manifest = makeManifest();
    const model = findModelMeta(manifest, 'bot');
    expect(model?.glb).toBe('/bot.glb');
  });

  it('findModelMeta returns undefined when missing', () => {
    const manifest = makeManifest();
    expect(findModelMeta(manifest, 'missing')).toBeUndefined();
  });

  it('assertManifestValid accepts valid manifest', () => {
    const manifest = makeManifest();
    expect(assertManifestValid(manifest)).toBe(manifest);
  });

  it('assertManifestValid throws on bad version', () => {
    const manifest = { ...makeManifest(), version: 999 };
    expect(() => assertManifestValid(manifest)).toThrow();
  });

  it('assertManifestValid throws on missing arrays', () => {
    const bad = { version: ASSET_MANIFEST_VERSION, models: [], containedModels: [] };
    expect(() => assertManifestValid(bad as unknown)).toThrow('animations');
    expect(() => assertManifestValid({ version: ASSET_MANIFEST_VERSION, containedModels: [], animations: [] } as unknown)).toThrow('models');
    expect(() => assertManifestValid({ version: ASSET_MANIFEST_VERSION, models: [], animations: [] } as unknown)).toThrow('containedModels');
  });

  it('assertManifestValid throws on non-object input', () => {
    expect(() => assertManifestValid(null)).toThrow('not an object');
    expect(() => assertManifestValid(123 as unknown)).toThrow('not an object');
  });
});

describe('BodyPartGroup manifest round-trip', () => {
  it('bodyPartGroups are preserved through manifest assertion', () => {
    const groups = makeBodyPartGroups();
    const manifest = makeManifest();
    const validated = assertManifestValid(manifest);
    const botMeta = validated.models.find((m) => m.type === 'bot');
    expect(botMeta?.bodyPartGroups).toHaveLength(groups.length);
    expect(botMeta?.bodyPartGroups?.[0].name).toBe('RightForeArm');
    expect(botMeta?.bodyPartGroups?.[0].boneIds).toEqual(['mixamorigRightForeArm']);
    expect(botMeta?.bodyPartGroups?.[0].meshIds).toEqual(['FOREARM_RIGHT']);
  });

  it('manifest without bodyPartGroups is still valid (optional field)', () => {
    const manifest: AssetManifest = {
      version: ASSET_MANIFEST_VERSION,
      models: [{
        type: 'legacy',
        glb: '/legacy.glb',
        bones: [],
        meshes: [],
        anchorTargets: {},
        // bodyPartGroups intentionally omitted
        identity: {
          model: { scale: 0.1, position: [0, 0, 0], rotation: [0, 0, 0], enabled: true, bodyPartOverrides: {} },
          playback: { motion: { commands: [], scenes: [], customAnimations: [] }, animation: { enabled: false } },
        },
      }],
      containedModels: [],
      animations: [],
    };
    const validated = assertManifestValid(manifest);
    const legacyMeta = validated.models.find((m) => m.type === 'legacy');
    expect(legacyMeta?.bodyPartGroups).toBeUndefined();
  });

  it('linked group has both boneIds and meshIds', () => {
    const groups = makeBodyPartGroups();
    const linked = groups.find((g) => g.name === 'RightForeArm');
    expect(linked?.boneIds.length).toBeGreaterThan(0);
    expect(linked?.meshIds.length).toBeGreaterThan(0);
  });

  it('mesh-only group has empty boneIds', () => {
    const groups = makeBodyPartGroups();
    const meshOnly = groups.find((g) => g.name === 'CalfInRight');
    expect(meshOnly?.boneIds).toHaveLength(0);
    expect(meshOnly?.meshIds.length).toBeGreaterThan(0);
  });

  it('bone-only group has empty meshIds', () => {
    const groups = makeBodyPartGroups();
    const boneOnly = groups.find((g) => g.name === 'LeftHandIndex1');
    expect(boneOnly?.meshIds).toHaveLength(0);
    expect(boneOnly?.boneIds.length).toBeGreaterThan(0);
  });
});
