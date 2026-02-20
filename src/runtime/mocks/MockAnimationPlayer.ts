import { clamp01 } from '../math';
import type { AnimationPlayer, AnimationTrack, PoseSnapshotMap, World } from '../types';

/**
 * Mock implementation of AnimationPlayer for testing.
 * Stub - implemented in Phase 6
 */
const pickKeyframes = (track: AnimationTrack, time: number) => {
  const frames = track.keyframes;
  if (frames.length === 0) return null;
  if (frames.length === 1) return { a: frames[0], b: frames[0], t: 0 };

  let prev = frames[0];
  for (let i = 1; i < frames.length; i += 1) {
    const next = frames[i];
    if (time <= next.t) {
      const span = Math.max(1e-6, next.t - prev.t);
      const t = clamp01((time - prev.t) / span);
      return { a: prev, b: next, t };
    }
    prev = next;
  }
  return { a: prev, b: prev, t: 0 };
};

const interpolateValue = (a: number | number[], b: number | number[], t: number) => {
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.map((value, index) => {
      const target = b[index] ?? value;
      return value + (target - value) * t;
    });
  }
  if (typeof a === 'number' && typeof b === 'number') {
    return a + (b - a) * t;
  }
  return Array.isArray(a) ? [...a] : b;
};

export class MockAnimationPlayer implements AnimationPlayer {
  readonly tracks: AnimationTrack[] = [];
  timeSeconds = 0;
  playing = false;
  private trackFilter: { allowRotation?: boolean; allowScale?: boolean } = {};
  private currentClip?: string;

  setClip(clipName?: string): void {
    this.currentClip = clipName;
  }

  load(tracks: AnimationTrack[]): void {
    (this as any).tracks = tracks.map((track) => ({
      ...track,
      keyframes: track.keyframes.map((frame) => ({ ...frame })),
    }));
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
  }

  tick(dtSeconds: number, world: World): void {
    if (!this.playing) return;
    this.timeSeconds += dtSeconds;
    this.setTime(this.timeSeconds, world);
  }

  setTime(timeSeconds: number, world: World): void {
    this.timeSeconds = timeSeconds;
    for (const track of this.tracks) {
      if (!this.isTrackAllowed(track)) continue;
      const node = world.getNode(track.targetName);
      if (!node) {
        console.warn('[MockAnimationPlayer] Missing node for track.', { target: track.targetName });
        continue;
      }
      const frame = pickKeyframes(track, timeSeconds);
      if (!frame) continue;
      const value = interpolateValue(frame.a.value, frame.b.value, frame.t);

      if (track.property === 'position' && Array.isArray(value)) {
        node.localPosition = [value[0] ?? 0, value[1] ?? 0, value[2] ?? 0];
      } else if (track.property === 'rotation' && Array.isArray(value)) {
        node.localRotation = [value[0] ?? 0, value[1] ?? 0, value[2] ?? 0];
      } else if (track.property === 'scale' && Array.isArray(value)) {
        node.localScale = [value[0] ?? 1, value[1] ?? 1, value[2] ?? 1];
      } else if (track.property === 'component') {
        const componentType = track.componentType ?? 'custom';
        const key = track.componentKey ?? 'value';
        let component = (node.components ?? []).find((entry) => entry.type === componentType);
        if (!component) {
          component = { type: componentType, props: {} };
          (node as any).components = [...(node.components ?? []), component];
        }
        (component.props as Record<string, unknown>)[key] = value as number | number[];
      }
    }
  }

  setTrackFilter(filter: { allowRotation?: boolean; allowScale?: boolean }): void {
    this.trackFilter = filter;
  }

  getPoseSnapshot(): PoseSnapshotMap {
    return new Map();
  }

  getClipTargetNames(): Set<string> {
    const targets = new Set<string>();
    for (const track of this.tracks) {
      targets.add(track.targetName);
    }
    return targets;
  }

  private isTrackAllowed(track: AnimationTrack): boolean {
    const allowRotation = this.trackFilter.allowRotation ?? true;
    const allowScale = this.trackFilter.allowScale ?? true;
    if (!allowRotation && track.property === 'rotation') return false;
    if (!allowScale && track.property === 'scale') return false;
    return true;
  }
}
