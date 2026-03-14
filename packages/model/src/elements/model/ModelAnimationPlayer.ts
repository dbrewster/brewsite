// ModelAnimationPlayer.ts — AnimationMixer management and clip application for a model instance.

import * as THREE from 'three';
import type { Vec3, CustomAnimation, CustomAnimationOp } from './types';
import type { ModelRenderInstanceState } from './_renderTypes';
import type { CompiledAnimation } from './compile';
import type { WidgetRenderContext } from '@brewsite/core';

/** Snapshot of an Object3D's local transform used for pose capture and restore. */
type PoseSnapshot = {
  position: Vec3;
  rotation: Vec3;
  scale: Vec3;
};

/**
 * Owns the THREE.AnimationMixer and all animation clip management for a single model instance.
 * Handles clip filtering, range trimming, custom procedural animations, and progress-based reset.
 */
export class ModelAnimationPlayer {
  private readonly model: THREE.Group;
  private mixer: THREE.AnimationMixer;
  private animationClips = new Map<string, THREE.AnimationClip>();
  private activeClip: THREE.AnimationClip | null = null;
  private filteredClips = new Map<string, THREE.AnimationClip>();
  private rangedClips = new Map<string, THREE.AnimationClip>();
  private initialStartOffsets = new Map<string, number>();
  private lastAnimationSignature: string | null = null;
  private lastGlobalProgress: number | null = null;
  private lastPoseOverrideBase = new Map<string, PoseSnapshot>();

  constructor(model: THREE.Group) {
    this.model = model;
    this.mixer = new THREE.AnimationMixer(model);
  }

  /**
   * Add animation clips sourced directly from the GLTF scene.
   * Called once per model load. Clips are keyed by their name.
   */
  addClips(clips: THREE.AnimationClip[]): void {
    for (const clip of clips) {
      if (!clip.name) continue;
      this.animationClips.set(clip.name, clip);
    }
  }

  /**
   * Add a remapped clip after track name normalization (performed externally by ModelRenderer).
   * Key = clip name from the AnimationEntry manifest.
   */
  addRemappedClip(clipName: string, clip: THREE.AnimationClip): void {
    this.animationClips.set(clipName, clip);
  }

  /**
   * Apply animation state for this frame.
   * Handles clip selection, filtering, range trimming, reset-on-progress, and mixer update.
   * Also applies custom procedural animations on top.
   *
   * @param state - Full instance state including animation playback configuration.
   * @param animation - Compiled animation descriptor (from compile.ts). Undefined = no animation.
   * @param ctx - Widget render context providing delta time and global progress.
   * @param nodeByName - Read-only node map from the loaded model for custom animation ops.
   */
  apply(
    state: ModelRenderInstanceState,
    animation: CompiledAnimation | undefined,
    ctx: WidgetRenderContext | undefined,
    nodeByName: ReadonlyMap<string, THREE.Object3D>,
  ): void {
    this.restorePoseOverrideBase(nodeByName);
    this.lastPoseOverrideBase.clear();

    if (animation?.enabled && animation.clipName) {
      const animationSignature = this.getAnimationSignature(state, animation);
      const resetDueToProgress = this.shouldResetOnProgress(ctx?.globalProgress, animationSignature ?? '');
      this.applyAnimation(state, animation, ctx, resetDueToProgress);
    } else {
      this.clearActiveAnimation();
    }

    const customAnimations = state.playback.motion.customAnimations ?? [];
    if (customAnimations.length > 0) {
      this.applyCustomAnimations(customAnimations, ctx, nodeByName);
    }
  }

  /**
   * Apply custom (procedural) animations for this frame.
   * Each animation's apply() callback returns a list of ops that are blended onto the current pose.
   *
   * @param customAnimations - Array of custom animation descriptors.
   * @param ctx - Widget render context for time values.
   * @param nodeByName - Read-only node map from the loaded model.
   */
  applyCustomAnimations(
    customAnimations: CustomAnimation[],
    ctx: WidgetRenderContext | undefined,
    nodeByName: ReadonlyMap<string, THREE.Object3D>,
  ): void {
    const base = this.capturePose();
    const context = {
      tickTimeSeconds: ctx?.effectiveDeltaSeconds ?? 0,
      wallTimeSeconds: ctx?.clock?.wallTimeSeconds ?? 0,
      sceneProgress: ctx?.globalProgress ?? 0,
      globalProgress: ctx?.globalProgress ?? 0,
      getBaseTransform: (name: string) => {
        const snapshot = base.get(name);
        if (!snapshot) return null;
        return {
          position: [snapshot.position[0], snapshot.position[1], snapshot.position[2]] as Vec3,
          rotation: [snapshot.rotation[0], snapshot.rotation[1], snapshot.rotation[2]] as Vec3,
          scale: [snapshot.scale[0], snapshot.scale[1], snapshot.scale[2]] as Vec3,
        };
      },
    };

    for (const animation of customAnimations) {
      if (!animation.enabled) continue;
      const ops = animation.apply(context);
      if (!ops?.length) continue;
      const weight = animation.weight ?? 1;
      this.applyCustomOps(ops, weight, nodeByName);
    }
  }

  /**
   * Returns true if the animation mixer should reset because the engine scrubbed backward
   * and the animation signature changed (i.e., a different animation was active before).
   *
   * @param globalProgress - Current global progress value from WidgetRenderContext.
   * @param signature - String key identifying the current animation configuration.
   */
  shouldResetOnProgress(globalProgress: number | undefined, signature: string): boolean {
    if (typeof globalProgress !== 'number') return false;
    const last = this.lastGlobalProgress;
    const lastSignature = this.lastAnimationSignature;
    this.lastGlobalProgress = globalProgress;
    this.lastAnimationSignature = signature;
    if (last === null) return false;
    const wentBackward = globalProgress < last - 1e-4;
    if (!wentBackward) return false;
    return signature !== lastSignature;
  }

  /**
   * Stop all active animations and release animation clips.
   * Call when the model instance is removed from the scene.
   */
  dispose(): void {
    if (this.mixer) {
      this.mixer.stopAllAction();
    }
    this.animationClips.clear();
    this.filteredClips.clear();
    this.rangedClips.clear();
    this.initialStartOffsets.clear();
    this.activeClip = null;
    this.lastGlobalProgress = null;
    this.lastAnimationSignature = null;
    this.lastPoseOverrideBase.clear();
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Private helpers

  private applyAnimation(
    state: ModelRenderInstanceState,
    animation: CompiledAnimation,
    ctx: WidgetRenderContext | undefined,
    resetDueToProgress: boolean,
  ): void {
    if (!this.mixer) {
      console.warn('[ModelAnimationPlayer] missing mixer, cannot apply animation');
      return;
    }
    const baseClip = this.animationClips.get(animation.clipName ?? '');
    if (!baseClip) return;
    const allowScale = state.playback.animation.allowScale === true;
    const allowRotation = state.playback.animation.allowRotation !== false;
    const filteredClip = this.getFilteredClip(baseClip, allowScale, allowRotation);
    const clip = this.getRangedClip(filteredClip, animation.range);
    if (!clip) return;

    const shouldReset = resetDueToProgress || state.playback.animation.reset === true;
    if (shouldReset && this.activeClip === clip) {
      this.clearActiveAnimation();
    }

    const repeat = state.playback.animation.clipRepeat !== false;
    const action = this.mixer.clipAction(clip);
    if (this.activeClip !== clip) {
      this.clearActiveAnimation();
      const fadeIn = state.playback.animation.fadeInSeconds ?? 0;
      action.reset();
      if (fadeIn > 0) action.fadeIn(fadeIn);
      action.play();
      action.setLoop(repeat ? THREE.LoopRepeat : THREE.LoopOnce, repeat ? Infinity : 1);
      action.clampWhenFinished = !repeat;
      this.activeClip = clip;

      const initialOffset = this.getInitialStartOffset(clip, state);
      if (initialOffset > 0) {
        action.time = Math.min(initialOffset, Math.max(0, clip.duration));
        this.mixer.update(0);
      }
    }

    const weight = state.playback.animation.weight ?? 1;
    action.setEffectiveWeight(weight);
    const deltaSeconds = ctx?.effectiveDeltaSeconds ?? 0;
    this.mixer.update(deltaSeconds);
  }

  private clearActiveAnimation(): void {
    if (!this.mixer || !this.activeClip) return;
    this.mixer.clipAction(this.activeClip).stop();
    this.activeClip = null;
  }

  private getFilteredClip(
    baseClip: THREE.AnimationClip,
    allowScale: boolean,
    allowRotation: boolean,
  ): THREE.AnimationClip {
    const key = `${baseClip.name}|s:${allowScale ? 1 : 0}|r:${allowRotation ? 1 : 0}`;
    const cached = this.filteredClips.get(key);
    if (cached) return cached;

    const tracks = allowScale
      ? baseClip.tracks
      : baseClip.tracks.filter((track) => !/\.scale(\b|\[)/.test(track.name));
    const filteredTracks = allowRotation
      ? tracks
      : tracks.filter((track) =>
        !/\.quaternion(\b|\[)/.test(track.name) && !/\.rotation(\b|\[)/.test(track.name));
    const clip = new THREE.AnimationClip(baseClip.name, baseClip.duration, filteredTracks);
    clip.optimize();
    this.filteredClips.set(key, clip);
    return clip;
  }

  private getRangedClip(
    baseClip: THREE.AnimationClip,
    range?: { startSeconds: number; endSeconds: number; span: number },
  ): THREE.AnimationClip {
    if (!range) return baseClip;
    const start = Math.max(0, range.startSeconds);
    const end = Math.max(start, range.endSeconds);
    const key = `${baseClip.uuid}|${start}|${end}`;
    const cached = this.rangedClips.get(key);
    if (cached) return cached;

    const duration = Math.max(1e-4, end - start);
    const tracks = baseClip.tracks.map((track) => {
      const clone = track.clone();
      clone.trim(start, end);
      clone.shift(-start);
      return clone;
    });
    const clip = new THREE.AnimationClip(`${baseClip.name}|${start}-${end}`, duration, tracks);
    clip.optimize();
    this.rangedClips.set(key, clip);
    return clip;
  }

  private getInitialStartOffset(
    clip: THREE.AnimationClip,
    state: ModelRenderInstanceState,
  ): number {
    const specifiedOffset = state.playback.animation.clipStartOnce;
    if (typeof specifiedOffset !== 'number') return 0;
    const offset = this.resolveClipOffsetSeconds(
      specifiedOffset,
      clip.duration,
      state.playback.animation.clipRangeUnit,
    );
    const key = `${clip.name}|${clip.duration}`;
    const existing = this.initialStartOffsets.get(key);
    if (typeof existing === 'number') return existing;
    this.initialStartOffsets.set(key, offset);
    return offset;
  }

  private resolveClipOffsetSeconds(
    offset: number,
    spanSeconds: number,
    unit?: 'seconds' | 'percent',
  ): number {
    if (unit === 'percent') {
      const pct = offset > 1 ? offset / 100 : offset;
      return pct * spanSeconds;
    }
    if (offset < 0) return 0;
    if (offset > spanSeconds) return Math.max(0, spanSeconds);
    return offset;
  }

  private getAnimationSignature(
    state: ModelRenderInstanceState,
    animation?: CompiledAnimation,
  ): string | null {
    if (!animation?.enabled || !animation.clipName) return null;
    const range = animation.range;
    const rangeKey = range
      ? `${range.startSeconds.toFixed(4)}-${range.endSeconds.toFixed(4)}`
      : 'full';
    const repeat = state.playback.animation.clipRepeat !== false;
    const allowScale = state.playback.animation.allowScale === true;
    const allowRotation = state.playback.animation.allowRotation !== false;
    return `${animation.clipName}|${rangeKey}|r:${repeat ? 1 : 0}|s:${allowScale ? 1 : 0}|rot:${allowRotation ? 1 : 0}`;
  }

  private capturePose(): Map<string, PoseSnapshot> {
    const pose = new Map<string, PoseSnapshot>();
    this.model.traverse((obj) => {
      if (!obj.name) return;
      pose.set(obj.name, {
        position: [obj.position.x, obj.position.y, obj.position.z],
        rotation: [obj.rotation.x, obj.rotation.y, obj.rotation.z],
        scale: [obj.scale.x, obj.scale.y, obj.scale.z],
      });
    });
    return pose;
  }

  private restorePoseOverrideBase(nodeByName: ReadonlyMap<string, THREE.Object3D>): void {
    if (this.lastPoseOverrideBase.size === 0) return;
    for (const [name, snapshot] of this.lastPoseOverrideBase) {
      const node = nodeByName.get(name);
      if (!node) continue;
      node.position.set(snapshot.position[0], snapshot.position[1], snapshot.position[2]);
      node.rotation.set(snapshot.rotation[0], snapshot.rotation[1], snapshot.rotation[2]);
      node.scale.set(snapshot.scale[0], snapshot.scale[1], snapshot.scale[2]);
    }
  }

  private applyCustomOps(
    ops: CustomAnimationOp[],
    weight: number,
    nodeByName: ReadonlyMap<string, THREE.Object3D>,
  ): void {
    for (const op of ops) {
      const node = nodeByName.get(op.targetName);
      if (!node) continue;
      const opWeight = (op.weight ?? 1) * weight;
      if (opWeight <= 0) continue;
      if (op.type === 'rotation') {
        if (op.mode === 'set') {
          node.rotation.set(op.value[0], op.value[1], op.value[2]);
        } else {
          node.rotation.set(
            node.rotation.x + op.value[0] * opWeight,
            node.rotation.y + op.value[1] * opWeight,
            node.rotation.z + op.value[2] * opWeight,
          );
        }
      } else if (op.type === 'position') {
        if (op.mode === 'set') {
          node.position.set(op.value[0], op.value[1], op.value[2]);
        } else {
          node.position.set(
            node.position.x + op.value[0] * opWeight,
            node.position.y + op.value[1] * opWeight,
            node.position.z + op.value[2] * opWeight,
          );
        }
      } else if (op.type === 'scale') {
        if (op.mode === 'set') {
          node.scale.set(op.value[0], op.value[1], op.value[2]);
        } else {
          node.scale.set(
            node.scale.x + op.value[0] * opWeight,
            node.scale.y + op.value[1] * opWeight,
            node.scale.z + op.value[2] * opWeight,
          );
        }
      }
    }
  }
}
