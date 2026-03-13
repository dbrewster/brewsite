// spotlightEnterpriseTheme — cool blue-white spotlights paired with enterpriseTheme.

import type { SpotlightRigTheme } from '../types';

/**
 * Pairs with enterpriseTheme — cool blue-white spotlights against deep navy sky.
 * Measured sweep, medium cone, professional and unobtrusive.
 */
export const spotlightEnterpriseTheme: SpotlightRigTheme = {
  color: '#C8D8F0',        // steel blue-white (matches #4F76B8 palette desaturated)
  intensity: 90,
  speed: 0.45,
  radius: 18,
  height: 26,
  targetY: 0,
  angle: Math.PI / 14,    // ~13° — moderate cone
  penumbra: 0.30,
  decay: 2.0,
  distance: 60,
  castShadow: false,
  shadowMapSize: 1024,
  showBeam: true,
  beamOpacity: 0.08,       // subtle — enterprise aesthetic is restrained
  beamColor: '#E0E8F8',
  showHalo: false,
  haloOpacity: 0.20,
  haloSize: 6,
};
