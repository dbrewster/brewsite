import type {ClipMeta} from '../../model/robotSceneTypes';
import type {RobotTimeline} from '../../robotTimeline';
import type {SceneFrameContext, SceneSource} from './sceneTypes';
import type {SceneTrack} from './sceneTrackTypes';
import {compileSceneTrack} from './sceneTrackCompiler';
import {createSceneTrackSampler, type SceneTrackSampler} from './sceneTrackSampler';
import type {AssetManifest} from '../../elements/model/metadata';
import {clipMetaFromManifest} from '../../elements/model/metadata';

export type SceneTrackQuality = 'low' | 'high';
export type SceneTrackKey = string;

type CacheEntry = {
  track: SceneTrack;
  sampler: SceneTrackSampler;
};

const trackCache = new Map<SceneTrackKey, CacheEntry>();
const trackCacheByUi = new WeakMap<object, Map<SceneTrackKey, CacheEntry>>();

const buildSceneIdsKey = (scenes: SceneSource[]) => scenes.map((scene) => scene.id).join('|');

const buildTimelineKey = (timeline: RobotTimeline) =>
  `${timeline.sceneCount}|${timeline.subTickCount}|${timeline.tickStep}|${timeline.timelineDuration}`;

export const buildClipMetaKey = (clips: ClipMeta[]) =>
  clips.map((clip) => `${clip.name}:${clip.duration.toFixed(3)}`).join('|');

export const buildSceneTrackKey = (options: {
  scenes: SceneSource[];
  timeline: RobotTimeline;
  clipKey: string;
  prefersReducedMotion: boolean;
  assetsReady: boolean;
  quality?: SceneTrackQuality;
  uiKey?: string;
}): SceneTrackKey => {
  const { scenes, timeline, clipKey, prefersReducedMotion, assetsReady, quality, uiKey } = options;
  return [
    buildSceneIdsKey(scenes),
    buildTimelineKey(timeline),
    clipKey,
    prefersReducedMotion ? 'rm:1' : 'rm:0',
    assetsReady ? 'assets:1' : 'assets:0',
    quality ? `q:${quality}` : '',
    uiKey ? `ui:${uiKey}` : '',
  ]
    .filter((entry) => entry.length > 0)
    .join('|');
};

export const getOrCompileSceneTrack = (options: {
  scenes: SceneSource[];
  timeline: RobotTimeline;
  assetsReady: boolean;
  /** Preferred: derives clip metadata and adds anchor/subpart data to the track. */
  manifest?: AssetManifest;
  /** Legacy fallback: used when manifest is not yet available. Ignored when manifest is provided. */
  availableClips?: ClipMeta[];
  prefersReducedMotion: boolean;
  ui?: SceneFrameContext['ui'];
  uiKey?: string;
  quality?: SceneTrackQuality;
}): CacheEntry => {
  const resolvedClips = options.manifest
    ? clipMetaFromManifest(options.manifest)
    : (options.availableClips ?? []);
  const clipKey = buildClipMetaKey(resolvedClips);
  const key = buildSceneTrackKey({
    scenes: options.scenes,
    timeline: options.timeline,
    clipKey,
    prefersReducedMotion: options.prefersReducedMotion,
    assetsReady: options.assetsReady,
    quality: options.quality,
    uiKey: options.uiKey,
  });

  const compileOptions = {
    scenes: options.scenes,
    timeline: options.timeline,
    assetsReady: options.assetsReady,
    manifest: options.manifest,
    availableClips: resolvedClips,
    prefersReducedMotion: options.prefersReducedMotion,
    ui: options.ui,
  };

  const uiRef = options.ui?.logo ?? null;
  if (uiRef && typeof uiRef === 'object') {
    const map = trackCacheByUi.get(uiRef) ?? new Map<SceneTrackKey, CacheEntry>();
    const cached = map.get(key);
    if (cached) return cached;
    const track = compileSceneTrack(compileOptions);
    const sampler = createSceneTrackSampler(track);
    const entry = { track, sampler };
    map.set(key, entry);
    trackCacheByUi.set(uiRef, map);
    return entry;
  }

  const cached = trackCache.get(key);
  if (cached) return cached;
  const track = compileSceneTrack(compileOptions);
  const sampler = createSceneTrackSampler(track);
  const entry = { track, sampler };
  trackCache.set(key, entry);
  return entry;
};
