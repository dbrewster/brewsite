// spotlightLightMinimalTheme — barely-there spotlights paired with lightMinimalTheme.

import type { SpotlightRigTheme } from '../types';

/**
 * Pairs with lightMinimalTheme — soft warm-white spotlights on a bright background.
 * Very low intensity, no beam (invisible on light bg), no halo.
 * Primarily contributes subtle directional fill; visible effect is minimal by design.
 */
export const spotlightLightMinimalTheme: SpotlightRigTheme = {
  color: '#FFF8F0',        // barely-warm white
  intensity: 25,           // low — scene is already bright from ambient
  speed: 0.25,             // gentle, almost imperceptible
  radius: 20,
  height: 30,
  targetY: 0,
  angle: Math.PI / 8,     // wide cone — softer, less defined
  penumbra: 0.7,           // very soft edges
  decay: 2.0,
  distance: 70,
  castShadow: false,
  shadowMapSize: 1024,
  showBeam: false,         // beams are invisible and look wrong on light backgrounds
  beamOpacity: 0.0,
  beamColor: '#ffffff',
  showHalo: false,         // halos look wrong on white
  haloOpacity: 0.0,
  haloSize: 6,
};
