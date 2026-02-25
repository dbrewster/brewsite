/**
 * Environment element types.
 */

export type SceneEnvironment = {
  enabled: boolean;
  intensity: number;
  source?: EnvironmentSource;
};

export type EnvironmentSourceHdri = {
  type: 'hdr';
  url: string;
  background?: boolean;
};

export type EnvironmentSourceExr = {
  type: 'exr';
  url: string;
  background?: boolean;
};

export type EnvironmentSourceCube = {
  type: 'cube';
  urls: [string, string, string, string, string, string];
  background?: boolean;
};

export type EnvironmentSource = EnvironmentSourceHdri | EnvironmentSourceExr | EnvironmentSourceCube;
