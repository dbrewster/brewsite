// ModelAnimationPlayer.test.ts — Animation player state machine tests.
// Uses real Three.js objects (no WebGL required for AnimationMixer/AnimationClip logic).

import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { ModelAnimationPlayer } from '../ModelAnimationPlayer';
import type { ModelRenderInstanceState } from '../_renderTypes';
import type { CompiledAnimation } from '../compile';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Create a minimal AnimationClip that can be used with THREE.AnimationMixer. */
function makeClip(name: string, duration = 1): THREE.AnimationClip {
  const times = [0, duration];
  const values = [0, 0, 0, 0, 0, 0]; // position x,y,z at t=0 and t=duration
  const track = new THREE.VectorKeyframeTrack('.position', times, values);
  return new THREE.AnimationClip(name, duration, [track]);
}

/** Create a minimal ModelRenderInstanceState for testing. */
function makeRenderState(
  overrides: Partial<{
    clipName: string;
    clipRepeat: boolean;
    fadeInSeconds: number;
    weight: number;
    allowScale: boolean;
    allowRotation: boolean;
    reset: boolean;
    clipStartOnce: number;
    clipRangeUnit: 'seconds' | 'percent';
  }> = {},
): ModelRenderInstanceState {
  return {
    model: {
      scale: 1,
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      enabled: true,
      bodyPartOverrides: {},
    },
    playback: {
      motion: { commands: [], scenes: [], customAnimations: [] },
      animation: {
        enabled: true,
        clipName: overrides.clipName ?? 'idle',
        clipRepeat: overrides.clipRepeat,
        fadeInSeconds: overrides.fadeInSeconds,
        weight: overrides.weight,
        allowScale: overrides.allowScale,
        allowRotation: overrides.allowRotation,
        reset: overrides.reset,
        clipStartOnce: overrides.clipStartOnce,
        clipRangeUnit: overrides.clipRangeUnit,
      },
    },
    enabled: true,
    nvsBounds: { x: 0, y: 0, w: 1, h: 1 },
  } as ModelRenderInstanceState;
}

/** Create a minimal CompiledAnimation descriptor. */
function makeCompiledAnimation(
  clipName: string,
  overrides: Partial<CompiledAnimation> = {},
): CompiledAnimation {
  return { enabled: true, clipName, ...overrides };
}

// ─── shouldResetOnProgress ────────────────────────────────────────────────────

describe('ModelAnimationPlayer.shouldResetOnProgress', () => {
  let player: ModelAnimationPlayer;

  beforeEach(() => {
    player = new ModelAnimationPlayer(new THREE.Group());
  });

  it('returns false when globalProgress is undefined', () => {
    expect(player.shouldResetOnProgress(undefined, 'sig-a')).toBe(false);
  });

  it('returns false on the first call (no previous progress)', () => {
    expect(player.shouldResetOnProgress(0.5, 'sig-a')).toBe(false);
  });

  it('returns false when progress moves forward', () => {
    player.shouldResetOnProgress(0.3, 'sig-a'); // first call
    expect(player.shouldResetOnProgress(0.6, 'sig-a')).toBe(false);
  });

  it('returns false when progress moves backward but signature is the same', () => {
    player.shouldResetOnProgress(0.6, 'sig-a');
    // Going backward but same signature
    expect(player.shouldResetOnProgress(0.3, 'sig-a')).toBe(false);
  });

  it('returns true when progress moves backward AND signature changes', () => {
    player.shouldResetOnProgress(0.6, 'sig-a');
    // Going backward (0.6 → 0.2) with a different signature
    expect(player.shouldResetOnProgress(0.2, 'sig-b')).toBe(true);
  });

  it('returns false when progress difference is below threshold (1e-4)', () => {
    player.shouldResetOnProgress(0.5, 'sig-a');
    // Tiny backward step — within float tolerance
    expect(player.shouldResetOnProgress(0.5 - 5e-5, 'sig-b')).toBe(false);
  });

  it('updates stored progress on each call', () => {
    player.shouldResetOnProgress(0.5, 'sig-a');
    player.shouldResetOnProgress(0.8, 'sig-a');
    // Going backward from 0.8 to 0.2 with different signature
    expect(player.shouldResetOnProgress(0.2, 'sig-b')).toBe(true);
  });
});

// ─── addClips / addRemappedClip ───────────────────────────────────────────────

describe('ModelAnimationPlayer clip registration', () => {
  it('addClips registers clips by name', () => {
    const group = new THREE.Group();
    const player = new ModelAnimationPlayer(group);
    const clip = makeClip('idle', 2);
    player.addClips([clip]);

    // If the clip is registered, apply() with that clipName should not warn
    const state = makeRenderState({ clipName: 'idle' });
    const animation = makeCompiledAnimation('idle');
    // Should not throw
    expect(() => player.apply(state, animation, undefined, new Map())).not.toThrow();
  });

  it('addClips skips clips without a name', () => {
    const group = new THREE.Group();
    const player = new ModelAnimationPlayer(group);
    const clip = makeClip('', 2);
    clip.name = ''; // empty name
    player.addClips([clip]);
    // Empty-named clip was skipped — apply() with empty clipName should not crash
    expect(() => player.apply(makeRenderState({ clipName: '' }), { enabled: true, clipName: '' }, undefined, new Map())).not.toThrow();
  });

  it('addRemappedClip registers clip under a given key', () => {
    const group = new THREE.Group();
    const player = new ModelAnimationPlayer(group);
    const clip = makeClip('raw-name', 2);
    player.addRemappedClip('normalized-name', clip);

    const state = makeRenderState({ clipName: 'normalized-name' });
    const animation = makeCompiledAnimation('normalized-name');
    expect(() => player.apply(state, animation, undefined, new Map())).not.toThrow();
  });
});

// ─── apply() — clip not found ─────────────────────────────────────────────────

describe('ModelAnimationPlayer.apply — clip not found', () => {
  it('returns without applying when clipName is not in animationClips', () => {
    const group = new THREE.Group();
    const player = new ModelAnimationPlayer(group);
    // No clips added — 'idle' not found
    const state = makeRenderState({ clipName: 'idle' });
    const animation = makeCompiledAnimation('idle');

    // Should complete without error — applyAnimation returns early when baseClip not found
    expect(() => player.apply(state, animation, undefined, new Map())).not.toThrow();
  });

  it('clears active animation when animation is disabled', () => {
    const group = new THREE.Group();
    const player = new ModelAnimationPlayer(group);

    const state = makeRenderState();
    // animation = undefined → clearActiveAnimation branch
    expect(() => player.apply(state, undefined, undefined, new Map())).not.toThrow();
  });
});

// ─── apply() — LoopOnce when clipRepeat=false ─────────────────────────────────

describe('ModelAnimationPlayer.apply — clip loop mode', () => {
  it('uses LoopRepeat when clipRepeat is not specified (default)', () => {
    const group = new THREE.Group();
    const player = new ModelAnimationPlayer(group);
    const clip = makeClip('idle', 2);
    player.addRemappedClip('idle', clip);

    const state = makeRenderState({ clipName: 'idle', clipRepeat: undefined });
    const animation = makeCompiledAnimation('idle');
    player.apply(state, animation, undefined, new Map());

    // Access internal filteredClips to get the exact clip used by the mixer
    const filteredClips = (player as unknown as { filteredClips: Map<string, THREE.AnimationClip> }).filteredClips;
    const filteredClip = Array.from(filteredClips.values())[0];
    expect(filteredClip).toBeDefined();

    const mixer = (player as unknown as { mixer: THREE.AnimationMixer }).mixer;
    const action = mixer.existingAction(filteredClip);
    expect(action?.loop).toBe(THREE.LoopRepeat);
  });

  it('uses LoopOnce when clipRepeat=false', () => {
    const group = new THREE.Group();
    const player = new ModelAnimationPlayer(group);
    const clip = makeClip('walk', 2);
    player.addRemappedClip('walk', clip);

    const state = makeRenderState({ clipName: 'walk', clipRepeat: false });
    const animation = makeCompiledAnimation('walk');
    player.apply(state, animation, undefined, new Map());

    const filteredClips = (player as unknown as { filteredClips: Map<string, THREE.AnimationClip> }).filteredClips;
    const filteredClip = Array.from(filteredClips.values())[0];
    const mixer = (player as unknown as { mixer: THREE.AnimationMixer }).mixer;
    const action = mixer.existingAction(filteredClip);
    expect(action?.loop).toBe(THREE.LoopOnce);
    expect(action?.clampWhenFinished).toBe(true);
  });
});

// ─── apply() — fadeIn > 0 ────────────────────────────────────────────────────

describe('ModelAnimationPlayer.apply — fadeIn', () => {
  it('action is running after apply() with fadeInSeconds > 0', () => {
    const group = new THREE.Group();
    const player = new ModelAnimationPlayer(group);
    const clip = makeClip('walk', 2);
    player.addRemappedClip('walk', clip);

    const state = makeRenderState({ clipName: 'walk', fadeInSeconds: 0.5 });
    const animation = makeCompiledAnimation('walk');
    player.apply(state, animation, undefined, new Map());

    const filteredClips = (player as unknown as { filteredClips: Map<string, THREE.AnimationClip> }).filteredClips;
    const filteredClip = Array.from(filteredClips.values())[0];
    const mixer = (player as unknown as { mixer: THREE.AnimationMixer }).mixer;
    const action = mixer.existingAction(filteredClip);
    // The action was started with play(), so isRunning should be true
    expect(action?.isRunning()).toBe(true);
  });
});

// ─── shouldResetOnProgress — integration with apply() ─────────────────────────

describe('ModelAnimationPlayer — reset on progress', () => {
  it('re-applies animation after reset triggered by backward progress + signature change', () => {
    const group = new THREE.Group();
    const player = new ModelAnimationPlayer(group);
    const clip = makeClip('idle', 2);
    player.addRemappedClip('idle', clip);

    const state = makeRenderState({ clipName: 'idle' });
    const animA = makeCompiledAnimation('idle');
    const ctx1 = { globalProgress: 0.5, effectiveDeltaSeconds: 0.016 } as never;
    player.apply(state, animA, ctx1, new Map());

    // Same clip, progress goes forward — no reset
    const ctx2 = { globalProgress: 0.8, effectiveDeltaSeconds: 0.016 } as never;
    player.apply(state, animA, ctx2, new Map());

    // Progress goes backward with a different signature (different clip range)
    const animB = makeCompiledAnimation('idle', {
      range: { startSeconds: 0.5, endSeconds: 1.5, span: 1 },
    });
    const ctx3 = { globalProgress: 0.2, effectiveDeltaSeconds: 0.016 } as never;
    // This should trigger shouldResetOnProgress → true, which triggers clearActiveAnimation
    expect(() => player.apply(state, animB, ctx3, new Map())).not.toThrow();
  });
});

// ─── dispose() ────────────────────────────────────────────────────────────────

describe('ModelAnimationPlayer.dispose', () => {
  it('clears all state and does not throw', () => {
    const group = new THREE.Group();
    const player = new ModelAnimationPlayer(group);
    const clip = makeClip('idle', 2);
    player.addRemappedClip('idle', clip);

    const state = makeRenderState({ clipName: 'idle' });
    const animation = makeCompiledAnimation('idle');
    player.apply(state, animation, undefined, new Map());

    expect(() => player.dispose()).not.toThrow();

    // After dispose, shouldResetOnProgress returns false (null progress)
    expect(player.shouldResetOnProgress(0.5, 'sig')).toBe(false);
  });

  it('can be called multiple times without error', () => {
    const group = new THREE.Group();
    const player = new ModelAnimationPlayer(group);
    player.dispose();
    player.dispose();
  });
});
