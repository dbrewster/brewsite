export type Vec3 = [number, number, number];

export type RibbonCurveConfig = {
  width: number;
  yOffset: number;
  z: number;
  waveAmplitude: number;
  waveFrequency: number;
  depthAmplitude: number;
  depthFrequency: number;
  depthPhase: number;
};

export type RibbonConfig = {
  strandCount: number;
  spacing: number;
  radius: number;
  radiusTaper: number;
  segments: number;
  twistFrequency: number;
  twistPhase: number;
  opacity?: number;
  glowLightsEnabled: boolean;
  glowLightCount: number;
  glowLightIntensity: number;
  glowLightColor: string;
  glowLightDistance: number;
  glowLightDecay: number;
  curve: RibbonCurveConfig;
  position: Vec3;
  rotation: Vec3;
  scale: Vec3;
};

export type SceneRibbon = {
  enabled: boolean;
  config?: RibbonConfig;
};
