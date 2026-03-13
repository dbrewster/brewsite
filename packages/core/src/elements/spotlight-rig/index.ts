// SpotlightRig element — public surface.
export { SpotlightRig, Spotlight, SpotlightRigWidget } from './SpotlightRigWidget';
export type { SpotlightRigProps, SpotlightProps } from './dsl';
export type {
  SpotlightRigPreset,
  SpotlightRigState,
  SpotlightLightState,
  OrbitFn,
  Vec3Tuple as SpotlightRigVec3,
} from './types';
export {
  DEFAULT_SPOTLIGHT_RIG_THEME,
  DEFAULT_SPOTLIGHT_RIG_STATE,
} from './compile';
export {
  moviePremierePreset, moviePremiereTheme,
  concertStagePreset, concertStageTheme,
} from './themes';
