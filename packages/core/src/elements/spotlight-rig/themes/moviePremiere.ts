// moviePremiereTheme — tall slow-sweeping blue-white beams for red-carpet aesthetics.

import type { SpotlightRigTheme } from '../types';

/**
 * Movie premiere / red-carpet look: tall slow-sweeping blue-white beams,
 * dramatic narrow cone, subtle beam opacity.
 */
export const moviePremiereTheme: SpotlightRigTheme = {
  color: '#d0e8ff',
  intensity: 120,
  speed: 0.35,
  radius: 18,
  height: 30,
  targetY: 0,
  angle: Math.PI / 20,
  penumbra: 0.15,
  decay: 2.0,
  distance: 70,
  castShadow: false,
  shadowMapSize: 1024,
  showBeam: true,
  beamOpacity: 0.12,
  beamColor: '#e8f4ff',
  showHalo: false,
  haloOpacity: 0.25,
  haloSize: 8,
};
