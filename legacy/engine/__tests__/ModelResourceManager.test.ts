import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { ModelResourceManager } from '../ModelResourceManager';
import type { AssetManifest } from '../../elements/model/metadata';
import { ASSET_MANIFEST_VERSION } from '../../elements/model/metadata';

const VALID_MANIFEST: AssetManifest = {
  version: ASSET_MANIFEST_VERSION,
  robot: {
    glb: '/robot.glb',
    bones: ['mixamorig:Head', 'mixamorig:Spine1'],
    meshes: ['Body_Mesh'],
    anchorTargets: { head: 'mixamorig:Head', chest: 'mixamorig:Spine1' },
  },
  brain: {
    glb: '/brain.glb',
    subparts: ['CortexLeft', 'CortexRight'],
  },
  animations: [
    { id: 'idle', glb: '/idle.glb', clipName: 'idle_clip', duration: 3.5 },
  ],
};

const buildFetchStub = (manifest: unknown, status = 200) =>
  vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn().mockResolvedValue(manifest),
  } as unknown as Response);

describe('ModelResourceManager', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchSpy = buildFetchStub(VALID_MANIFEST);
    vi.stubGlobal('fetch', fetchSpy);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('initial state', () => {
    it('starts idle', () => {
      const mgr = new ModelResourceManager();
      expect(mgr.getState().phase).toBe('idle');
    });

    it('getManifest() returns null when idle', () => {
      const mgr = new ModelResourceManager();
      expect(mgr.getManifest()).toBeNull();
    });

    it('isReady() returns false when idle', () => {
      const mgr = new ModelResourceManager();
      expect(mgr.isReady()).toBe(false);
    });
  });

  describe('loadManifest()', () => {
    it('transitions idle → loading-manifest → manifest-ready', async () => {
      const mgr = new ModelResourceManager();
      const phases: string[] = [];
      mgr.subscribe((s) => phases.push(s.phase));

      await mgr.loadManifest('/assets/robot-metadata.json');

      expect(phases).toEqual(['loading-manifest', 'manifest-ready']);
      expect(mgr.getState().phase).toBe('manifest-ready');
    });

    it('returns the validated manifest', async () => {
      const mgr = new ModelResourceManager();
      const manifest = await mgr.loadManifest('/assets/robot-metadata.json');
      expect(manifest.version).toBe(ASSET_MANIFEST_VERSION);
      expect(manifest.robot.anchorTargets.head).toBe('mixamorig:Head');
    });

    it('getManifest() returns the manifest after load', async () => {
      const mgr = new ModelResourceManager();
      await mgr.loadManifest('/assets/robot-metadata.json');
      expect(mgr.getManifest()).not.toBeNull();
      expect(mgr.getManifest()?.robot.anchorTargets.chest).toBe('mixamorig:Spine1');
    });

    it('transitions to error on non-ok HTTP response', async () => {
      vi.stubGlobal('fetch', buildFetchStub({}, 404));
      const mgr = new ModelResourceManager();

      await expect(mgr.loadManifest('/missing.json')).rejects.toThrow('HTTP 404');
      expect(mgr.getState().phase).toBe('error');
      if (mgr.getState().phase === 'error') {
        expect(mgr.getState().phase).toBe('error');
      }
    });

    it('transitions to error on invalid manifest (wrong version)', async () => {
      vi.stubGlobal('fetch', buildFetchStub({ version: 999, robot: {}, brain: {}, animations: [] }));
      const mgr = new ModelResourceManager();

      await expect(mgr.loadManifest('/bad.json')).rejects.toThrow();
      expect(mgr.getState().phase).toBe('error');
    });

    it('transitions to error when manifest missing required fields', async () => {
      vi.stubGlobal('fetch', buildFetchStub({ version: ASSET_MANIFEST_VERSION }));
      const mgr = new ModelResourceManager();

      await expect(mgr.loadManifest('/incomplete.json')).rejects.toThrow();
      expect(mgr.getState().phase).toBe('error');
    });

    it('passes signal to fetch for abort support', async () => {
      const mgr = new ModelResourceManager();
      await mgr.loadManifest('/assets/robot-metadata.json');
      const callArgs = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(callArgs[1]?.signal).toBeInstanceOf(AbortSignal);
    });
  });

  describe('model lifecycle notifications', () => {
    it('notifyModelLoading() transitions manifest-ready → loading-model', async () => {
      const mgr = new ModelResourceManager();
      await mgr.loadManifest('/assets/robot-metadata.json');
      expect(mgr.getState().phase).toBe('manifest-ready');

      mgr.notifyModelLoading();
      expect(mgr.getState().phase).toBe('loading-model');
    });

    it('notifyModelReady() transitions loading-model → ready', async () => {
      const mgr = new ModelResourceManager();
      await mgr.loadManifest('/assets/robot-metadata.json');
      mgr.notifyModelLoading();
      mgr.notifyModelReady();

      expect(mgr.getState().phase).toBe('ready');
      expect(mgr.isReady()).toBe(true);
    });

    it('notifyModelReady() can skip loading-model (direct manifest-ready → ready)', async () => {
      const mgr = new ModelResourceManager();
      await mgr.loadManifest('/assets/robot-metadata.json');
      mgr.notifyModelReady();

      expect(mgr.getState().phase).toBe('ready');
    });

    it('notifyModelLoading() is a no-op before manifest is ready', () => {
      const mgr = new ModelResourceManager();
      mgr.notifyModelLoading();
      expect(mgr.getState().phase).toBe('idle');
    });

    it('notifyModelReady() is a no-op when idle', () => {
      const mgr = new ModelResourceManager();
      mgr.notifyModelReady();
      expect(mgr.getState().phase).toBe('idle');
    });

    it('getManifest() returns manifest in ready state', async () => {
      const mgr = new ModelResourceManager();
      await mgr.loadManifest('/assets/robot-metadata.json');
      mgr.notifyModelLoading();
      mgr.notifyModelReady();

      expect(mgr.getManifest()?.brain.subparts).toContain('CortexLeft');
    });
  });

  describe('error handling', () => {
    it('notifyError() transitions to error with the given reason', async () => {
      const mgr = new ModelResourceManager();
      await mgr.loadManifest('/assets/robot-metadata.json');
      mgr.notifyError('GLB load failed');

      const state = mgr.getState();
      expect(state.phase).toBe('error');
      if (state.phase === 'error') {
        expect(state.reason).toBe('GLB load failed');
      }
    });

    it('getManifest() returns null in error state', async () => {
      const mgr = new ModelResourceManager();
      mgr.notifyError('something broke');
      expect(mgr.getManifest()).toBeNull();
    });
  });

  describe('reset()', () => {
    it('resets from ready back to idle', async () => {
      const mgr = new ModelResourceManager();
      await mgr.loadManifest('/assets/robot-metadata.json');
      mgr.notifyModelReady();
      mgr.reset();

      expect(mgr.getState().phase).toBe('idle');
      expect(mgr.getManifest()).toBeNull();
      expect(mgr.isReady()).toBe(false);
    });

    it('resets from error back to idle', () => {
      const mgr = new ModelResourceManager();
      mgr.notifyError('some error');
      mgr.reset();

      expect(mgr.getState().phase).toBe('idle');
    });
  });

  describe('subscribe()', () => {
    it('listener receives state updates', async () => {
      const mgr = new ModelResourceManager();
      const updates: string[] = [];
      mgr.subscribe((s) => updates.push(s.phase));

      await mgr.loadManifest('/assets/robot-metadata.json');
      mgr.notifyModelLoading();
      mgr.notifyModelReady();

      expect(updates).toEqual(['loading-manifest', 'manifest-ready', 'loading-model', 'ready']);
    });

    it('unsubscribe stops receiving updates', async () => {
      const mgr = new ModelResourceManager();
      const updates: string[] = [];
      const unsub = mgr.subscribe((s) => updates.push(s.phase));

      await mgr.loadManifest('/assets/robot-metadata.json');
      unsub();

      mgr.notifyModelLoading();
      mgr.notifyModelReady();

      // Only receives events before unsubscribe
      expect(updates).toEqual(['loading-manifest', 'manifest-ready']);
    });

    it('multiple listeners all receive the same state', async () => {
      const mgr = new ModelResourceManager();
      const updates1: string[] = [];
      const updates2: string[] = [];
      mgr.subscribe((s) => updates1.push(s.phase));
      mgr.subscribe((s) => updates2.push(s.phase));

      await mgr.loadManifest('/assets/robot-metadata.json');

      expect(updates1).toEqual(['loading-manifest', 'manifest-ready']);
      expect(updates2).toEqual(['loading-manifest', 'manifest-ready']);
    });
  });

  describe('concurrent load protection', () => {
    it('second loadManifest() call aborts the first', async () => {
      const mgr = new ModelResourceManager();
      const phases: string[] = [];
      mgr.subscribe((s) => phases.push(s.phase));

      // First call (will be aborted)
      const first = mgr.loadManifest('/slow.json').catch(() => null);
      // Second call immediately
      await mgr.loadManifest('/assets/robot-metadata.json');
      await first;

      // Should end in manifest-ready from the second call
      expect(mgr.getState().phase).toBe('manifest-ready');
    });
  });
});
