import { AnimationAction, AnimationClip, AnimationMixer, type Object3D } from 'three';
import type { AnimationPlayer, PoseSnapshotMap, World } from '../../runtime/types';
import { mapTrackTargetName, resolveTrackTargetName } from '../../runtime/animationTrackMapping';

export class ThreeAnimationPlayer implements AnimationPlayer {
  tracks = [] as AnimationPlayer['tracks'];
  timeSeconds = 0;
  playing = false;
  private mixer: AnimationMixer;
  private actions = new Map<string, AnimationAction>();
  private activeAction: AnimationAction | null = null;
  private activeClipName?: string;
  private trackFilter: { allowRotation?: boolean; allowScale?: boolean } = {};
  private clipsByName = new Map<string, AnimationClip>();
  private filteredClipsByKey = new Map<string, AnimationClip>();

  constructor(root: Object3D, clips: AnimationClip[]) {
    this.mixer = new AnimationMixer(root);
    this.setClips(clips);
  }

  setClips(clips: AnimationClip[]): void {
    this.actions.clear();
    this.activeAction = null;
    this.activeClipName = undefined;
    this.filteredClipsByKey.clear();
    this.clipsByName.clear();
    clips.forEach((clip) => {
      this.clipsByName.set(clip.name, clip);
    });
  }

  setClip(clipName?: string): void {
    if (clipName === this.activeClipName) return;
    if (this.activeAction) {
      this.activeAction.stop();
    }
    this.activeClipName = clipName;
    if (!clipName) {
      this.activeAction = null;
      return;
    }
    const key = this.buildClipKey(clipName);
    const action = this.actions.get(key) ?? null;
    if (!action) {
      const clip = this.getFilteredClip(clipName);
      const nextAction = this.mixer.clipAction(clip);
      nextAction.enabled = true;
      nextAction.setEffectiveWeight(1);
      nextAction.paused = true;
      this.actions.set(key, nextAction);
      this.activeAction = nextAction;
    } else {
      this.activeAction = action;
    }
    if (this.activeAction) {
      this.activeAction.reset();
      this.activeAction.play();
      this.activeAction.paused = true;
    }
  }

  load(_tracks: AnimationPlayer['tracks']): void {
    this.tracks = _tracks;
  }

  play(startTime?: number): void {
    this.playing = true;
    if (typeof startTime === 'number') {
      this.timeSeconds = startTime;
    }
  }

  stop(): void {
    this.playing = false;
  }

  reset(): void {
    this.timeSeconds = 0;
    this.playing = false;
    this.activeAction = null;
  }

  tick(dtSeconds: number, _world: World): void {
    if (!this.playing || !this.activeAction) return;
    this.timeSeconds += dtSeconds;
    this.activeAction.time = this.timeSeconds;
    this.mixer.update(0);
  }

  setTime(timeSeconds: number, _world: World): void {
    this.timeSeconds = timeSeconds;
    if (!this.activeAction) return;
    this.activeAction.time = timeSeconds;
    this.activeAction.paused = true;
    this.activeAction.enabled = true;
    this.activeAction.play();
    this.mixer.update(0);
    if (typeof window !== 'undefined') {
      const debug = (window as unknown as { __robotRuntimeDebug?: boolean }).__robotRuntimeDebug;
      if (debug && this.activeClipName) {
        console.info('[RobotRuntime]', 'animation.tick', {
          clipName: this.activeClipName,
          timeSeconds,
        });
      }
    }
  }

  setTrackFilter(filter: { allowRotation?: boolean; allowScale?: boolean }): void {
    const next = {
      allowRotation: filter.allowRotation ?? true,
      allowScale: filter.allowScale ?? true,
    };
    const current = {
      allowRotation: this.trackFilter.allowRotation ?? true,
      allowScale: this.trackFilter.allowScale ?? true,
    };
    if (next.allowRotation === current.allowRotation && next.allowScale === current.allowScale) return;
    this.trackFilter = next;
    if (this.activeClipName) {
      const clipName = this.activeClipName;
      this.activeClipName = undefined;
      this.setClip(clipName);
    }
  }

  getPoseSnapshot(): PoseSnapshotMap {
    return new Map();
  }

  getClipTargetNames(clipName?: string): Set<string> {
    if (!clipName) return new Set();
    const clip = this.clipsByName.get(clipName);
    if (!clip) return new Set();
    const targets = new Set<string>();
    for (const track of clip.tracks) {
      const rawTarget = resolveTrackTargetName(track.name);
      if (!rawTarget) continue;
      targets.add(mapTrackTargetName(rawTarget));
    }
    return targets;
  }

  private buildClipKey(clipName: string): string {
    const allowRotation = this.trackFilter.allowRotation ?? true;
    const allowScale = this.trackFilter.allowScale ?? true;
    return `${clipName}|r${allowRotation ? 1 : 0}|s${allowScale ? 1 : 0}`;
  }

  private getFilteredClip(clipName: string): AnimationClip {
    const key = this.buildClipKey(clipName);
    const cached = this.filteredClipsByKey.get(key);
    if (cached) return cached;
    const base = this.clipsByName.get(clipName);
    if (!base) return new AnimationClip(clipName, -1, []);
    const allowRotation = this.trackFilter.allowRotation ?? true;
    const allowScale = this.trackFilter.allowScale ?? true;
    const stripped: string[] = [];
    const filteredTracks = base.tracks.filter((track) => {
      const name = track.name;
      const dot = name.lastIndexOf('.');
      const property = dot >= 0 ? name.slice(dot + 1) : name;
      if (!allowRotation && (property === 'rotation' || property === 'quaternion')) {
        stripped.push(track.name);
        return false;
      }
      if (!allowScale && property === 'scale') {
        stripped.push(track.name);
        return false;
      }
      return true;
    });
    const next = base.clone();
    next.tracks = filteredTracks;
    this.filteredClipsByKey.set(key, next);
    if (typeof window !== 'undefined') {
      const scaleTracks = base.tracks.filter((track) => track.name.endsWith('.scale')).length;
      const rotationTracks = base.tracks.filter(
        (track) => track.name.endsWith('.rotation') || track.name.endsWith('.quaternion'),
      ).length;
      console.info('[RobotRuntime]', 'animation.tracks.filtered', {
        clip: clipName,
        allowRotation,
        allowScale,
        totalTracks: base.tracks.length,
        rotationTracks,
        scaleTracks,
        removed: stripped.length,
        sample: stripped.slice(0, 10),
      });
    }
    return next;
  }
}
