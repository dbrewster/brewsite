// spotlightNeonCyberTheme — electric cyan beams paired with neonCyberTheme.

import type { SpotlightRigTheme } from '../types';

/**
 * Pairs with neonCyberTheme — electric cyan beams against void-black sky.
 * Fast sweep, tight cone, high intensity for a sci-fi / club aesthetic.
 */
export const spotlightNeonCyberTheme: SpotlightRigTheme = {
  color: '#00E7FF',        // direct match to neonCyber edge flow color
  intensity: 160,          // high — void background can handle it
  speed: 1.4,              // fast and electric
  radius: 14,
  height: 24,
  targetY: 0,
  angle: Math.PI / 20,    // ~9° — tightest cone, laser-like
  penumbra: 0.12,          // hard edge matches the sharp neon aesthetic
  decay: 2.0,
  distance: 55,
  castShadow: false,
  shadowMapSize: 1024,
  showBeam: true,
  beamOpacity: 0.18,       // more visible against pure black
  beamColor: '#80F4FF',    // lighter cyan
  showHalo: true,          // halo looks great against void background
  haloOpacity: 0.40,
  haloSize: 9,
};
