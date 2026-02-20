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

  it('findModelMeta finds by id', () => {
    const manifest = makeManifest();
    const model = findModelMeta(manifest, 'bot');
    expect(model?.glb).toBe('/bot.glb');
  });

  it('assertManifestValid accepts valid manifest', () => {
    const manifest = makeManifest();
    expect(assertManifestValid(manifest)).toBe(manifest);
  });

  it('assertManifestValid throws on bad version', () => {
    const manifest = { ...makeManifest(), version: 999 };
    expect(() => assertManifestValid(manifest)).toThrow();
  });
});
