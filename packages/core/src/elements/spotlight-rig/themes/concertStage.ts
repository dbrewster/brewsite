// concertStagePreset — fast sweeping warm-white beams for concert stage aesthetics.

import type { SpotlightRigPreset } from '../types';

/**
 * Concert stage: fast sweeping warm-white beams, wider cone,
 * more visible beam with optional halo.
 */
export const concertStagePreset: SpotlightRigPreset = {
  color: '#fff5e0',
  intensity: 150,
  speed: 1.2,
  radius: 12,
  height: 20,
  targetY: 0,
  angle: Math.PI / 10,
  penumbra: 0.4,
  decay: 2.0,
  distance: 50,
  castShadow: false,
  shadowMapSize: 1024,
  showBeam: true,
  beamOpacity: 0.20,
  beamColor: '#fffaf0',
  showHalo: true,
  haloOpacity: 0.35,
  haloSize: 10,
};

/** @deprecated Use concertStagePreset */
export const concertStageTheme = concertStagePreset;
