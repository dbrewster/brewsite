// SpotlightRig element — public surface.
export { SpotlightRig, Spotlight, SpotlightRigWidget } from './SpotlightRigWidget';
export type { SpotlightRigProps, SpotlightProps } from './dsl';
export type {
  SpotlightRigTheme,
  SpotlightRigState,
  SpotlightLightState,
  OrbitFn,
  Vec3Tuple as SpotlightRigVec3,
} from './types';
export {
  mergeSpotlightRigTheme,
  DEFAULT_SPOTLIGHT_RIG_THEME,
  DEFAULT_SPOTLIGHT_RIG_STATE,
} from './compile';
export {
  moviePremiereTheme, concertStageTheme,
  spotlightDarkGlassTheme, spotlightEnterpriseTheme,
  spotlightNeonCyberTheme, spotlightLightMinimalTheme,
} from './themes';
