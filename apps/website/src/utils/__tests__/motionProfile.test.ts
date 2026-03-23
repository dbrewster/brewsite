// Tests for deterministic motion profile resolution.

import { describe, it, expect } from 'vitest';
import { resolveMotionProfile } from '../motionProfile';

describe('resolveMotionProfile', () => {
  it('disables everything when reducedMotion is true', () => {
    const profile = resolveMotionProfile({ reducedMotion: true, perfTier: 'high', isMobile: false });
    expect(profile.reducedMotion).toBe(true);
    expect(profile.allowParticles).toBe(false);
    expect(profile.allowPostFx).toBe(false);
    expect(profile.allowHeavyShaderDistortion).toBe(false);
    expect(profile.environmentQuality).toBe('low');
  });

  it('disables everything on low perf tier', () => {
    const profile = resolveMotionProfile({ reducedMotion: false, perfTier: 'low', isMobile: true });
    expect(profile.reducedMotion).toBe(false);
    expect(profile.allowParticles).toBe(false);
    expect(profile.allowPostFx).toBe(false);
    expect(profile.allowHeavyShaderDistortion).toBe(false);
    expect(profile.environmentQuality).toBe('low');
  });

  it('allows particles but limits distortion on medium mobile', () => {
    const profile = resolveMotionProfile({ reducedMotion: false, perfTier: 'medium', isMobile: true });
    expect(profile.allowParticles).toBe(true);
    expect(profile.allowPostFx).toBe(false);
    expect(profile.allowHeavyShaderDistortion).toBe(false);
    expect(profile.environmentQuality).toBe('medium');
  });

  it('allows more features on medium desktop', () => {
    const profile = resolveMotionProfile({ reducedMotion: false, perfTier: 'medium', isMobile: false });
    expect(profile.allowParticles).toBe(true);
    expect(profile.allowPostFx).toBe(true);
    expect(profile.allowHeavyShaderDistortion).toBe(true);
    expect(profile.environmentQuality).toBe('high');
  });

  it('enables everything on high perf tier', () => {
    const profile = resolveMotionProfile({ reducedMotion: false, perfTier: 'high', isMobile: false });
    expect(profile.reducedMotion).toBe(false);
    expect(profile.allowParticles).toBe(true);
    expect(profile.allowPostFx).toBe(true);
    expect(profile.allowHeavyShaderDistortion).toBe(true);
    expect(profile.environmentQuality).toBe('high');
  });

  it('enables everything on high perf tier even on mobile', () => {
    const profile = resolveMotionProfile({ reducedMotion: false, perfTier: 'high', isMobile: true });
    expect(profile.allowParticles).toBe(true);
    expect(profile.allowPostFx).toBe(true);
    expect(profile.allowHeavyShaderDistortion).toBe(true);
    expect(profile.environmentQuality).toBe('high');
  });

  it('reduced motion overrides high perf tier', () => {
    const profile = resolveMotionProfile({ reducedMotion: true, perfTier: 'high', isMobile: false });
    expect(profile.allowParticles).toBe(false);
    expect(profile.allowPostFx).toBe(false);
  });
});
