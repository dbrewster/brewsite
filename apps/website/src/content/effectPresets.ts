// Visual effect preset constants — consumed at the DSL authoring surface.

import type { SceneLength } from '@brewsite/core/units/types';

/** Color palette identifier for effect widgets. */
export type EffectPalette = 'hero' | 'violet' | 'warm' | 'aurora';

/** Preset configuration for the SignalField particle widget. */
export type SignalFieldPreset = {
  readonly count: number;
  readonly opacity: number;
  readonly size: SceneLength;
  readonly speed: number;
  readonly depth: SceneLength;
  readonly spread: SceneLength;
  readonly flow: 'orbit' | 'stream' | 'assemble' | 'dissolve';
  readonly palette: EffectPalette;
  readonly targetBias: number;
};

/** Preset configuration for the PostFX post-processing widget. */
export type PostFxPreset = {
  readonly bloomStrength: number;
  readonly bloomRadius: number;
  readonly bloomThreshold: number;
  readonly vignetteStrength: number;
  readonly gradeMix: number;
};

// ── Signal field presets ────────────────────────────────────────────────────

/** Hero chamber — low-density ambient orbit particles. */
export const heroSignalPreset: SignalFieldPreset = {
  count: 120,
  opacity: 0.4,
  size: '2u' satisfies SceneLength,
  speed: 0.6,
  depth: '5u' satisfies SceneLength,
  spread: '15u' satisfies SceneLength,
  flow: 'orbit',
  palette: 'hero',
  targetBias: 0.3,
};

/** Transformation acts — denser streaming particles. */
export const transformSignalPreset: SignalFieldPreset = {
  count: 200,
  opacity: 0.6,
  size: '1.5u' satisfies SceneLength,
  speed: 1.0,
  depth: '8u' satisfies SceneLength,
  spread: '20u' satisfies SceneLength,
  flow: 'stream',
  palette: 'violet',
  targetBias: 0.5,
};

/** Assembling particles — convergence effect. */
export const assembleSignalPreset: SignalFieldPreset = {
  count: 160,
  opacity: 0.5,
  size: '1u' satisfies SceneLength,
  speed: 0.8,
  depth: '4u' satisfies SceneLength,
  spread: '12u' satisfies SceneLength,
  flow: 'assemble',
  palette: 'warm',
  targetBias: 0.7,
};

// ── PostFX presets ──────────────────────────────────────────────────────────

/** Default bloom — restrained glow for hero and CTA acts. */
export const defaultPostFxPreset: PostFxPreset = {
  bloomStrength: 0.4,
  bloomRadius: 0.3,
  bloomThreshold: 0.85,
  vignetteStrength: 0.25,
  gradeMix: 0.15,
};

/** Cinematic bloom — heightened for transformation scenes. */
export const cinematicPostFxPreset: PostFxPreset = {
  bloomStrength: 0.7,
  bloomRadius: 0.5,
  bloomThreshold: 0.7,
  vignetteStrength: 0.35,
  gradeMix: 0.25,
};

/** Minimal bloom — for authoring and trust acts. */
export const minimalPostFxPreset: PostFxPreset = {
  bloomStrength: 0.2,
  bloomRadius: 0.2,
  bloomThreshold: 0.9,
  vignetteStrength: 0.15,
  gradeMix: 0.1,
};
