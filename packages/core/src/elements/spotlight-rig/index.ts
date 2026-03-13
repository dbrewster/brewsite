// SpotlightRig element — public surface.
export { SpotlightRig, SpotlightRigWidget } from './SpotlightRigWidget';
export type { SpotlightRigProps } from './dsl';
export type { SpotlightRigTheme, SpotlightRigState, Vec3Tuple as SpotlightRigVec3 } from './types';
export { mergeSpotlightRigTheme, DEFAULT_SPOTLIGHT_RIG_THEME } from './compile';
export {
  moviePremiereTheme, concertStageTheme,
  spotlightDarkGlassTheme, spotlightEnterpriseTheme,
  spotlightNeonCyberTheme, spotlightLightMinimalTheme,
} from './themes';
