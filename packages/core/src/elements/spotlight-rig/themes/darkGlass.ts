// spotlightDarkGlassTheme — warm incandescent spotlights paired with darkGlassTheme.

import type { SpotlightRigTheme } from '../types';

/**
 * Pairs with darkGlassTheme — warm incandescent spotlights against near-black sky.
 * Slow sweep, narrow cone, ember-warm beam for a moody control-room aesthetic.
 */
export const spotlightDarkGlassTheme: SpotlightRigTheme = {
  color: '#FFD0A0',        // warm incandescent white (matches ember accent palette)
  intensity: 100,
  speed: 0.3,              // slow and deliberate
  radius: 16,
  height: 28,
  targetY: 0,
  angle: Math.PI / 18,    // ~10° — very narrow, dramatic
  penumbra: 0.20,
  decay: 2.0,
  distance: 65,
  castShadow: false,
  shadowMapSize: 1024,
  showBeam: true,
  beamOpacity: 0.11,
  beamColor: '#FFE8CC',   // slightly lighter than the light color
  showHalo: false,
  haloOpacity: 0.25,
  haloSize: 7,
};
