// Motion profile resolution — centralizes effect gating decisions.

import type { PerfTier } from './perfTier';

/** Motion profile that governs which effects are enabled. */
export type MotionProfile = {
  readonly reducedMotion: boolean;
  readonly allowParticles: boolean;
  readonly allowPostFx: boolean;
  readonly allowHeavyShaderDistortion: boolean;
  readonly environmentQuality: 'high' | 'medium' | 'low';
};

/**
 * Input for motion profile resolution.
 */
export type MotionProfileInput = {
  readonly reducedMotion: boolean;
  readonly perfTier: PerfTier;
  readonly isMobile: boolean;
};

/**
 * Resolves a MotionProfile from user preferences and device capabilities.
 *
 * Policy:
 * - Reduced motion: disables particles, postfx, heavy shader distortion
 * - Low perf tier: disables particles, postfx, heavy shader distortion
 * - Medium perf tier: allows particles but disables heavy distortion on mobile
 * - High perf tier: enables everything
 */
export function resolveMotionProfile(input: MotionProfileInput): MotionProfile {
  if (input.reducedMotion) {
    return {
      reducedMotion: true,
      allowParticles: false,
      allowPostFx: false,
      allowHeavyShaderDistortion: false,
      environmentQuality: 'low',
    };
  }

  if (input.perfTier === 'low') {
    return {
      reducedMotion: false,
      allowParticles: false,
      allowPostFx: false,
      allowHeavyShaderDistortion: false,
      environmentQuality: 'low',
    };
  }

  if (input.perfTier === 'medium') {
    return {
      reducedMotion: false,
      allowParticles: true,
      allowPostFx: !input.isMobile,
      allowHeavyShaderDistortion: !input.isMobile,
      environmentQuality: input.isMobile ? 'medium' : 'high',
    };
  }

  // High tier
  return {
    reducedMotion: false,
    allowParticles: true,
    allowPostFx: true,
    allowHeavyShaderDistortion: true,
    environmentQuality: 'high',
  };
}
