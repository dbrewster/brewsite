import { describe, it, expect } from 'vitest';
import {
  ASSET_MANIFEST_VERSION,
  clipMetaFromManifest,
  findModelMeta,
  assertManifestValid,
} from '../metadata';
import type { AssetManifest } from '../metadata';

const makeManifest = (): AssetManifest => ({
  version: ASSET_MANIFEST_VERSION,
  models: [{ id: 'bot', glb: '/bot.glb', bones: [], meshes: [], anchorTargets: {} }],
  containedModels: [],
  animations: [{ id: 'idle', glb: '/idle.glb', clipName: 'Idle', duration: 2 }],
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

  it('findModelMeta finds by id', () => {
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
