export type Vec3 = [number, number, number];

export type NeonSignState = {
  enabled: boolean;
  opacity: number;
  text: string;
  fontUrl: string;
  color: string;
  emissiveColor: string;
  intensity: number;
  position: Vec3;
  rotation: Vec3;
  scale: number;
};
