export type NeonSignState = {
  enabled: boolean;
  opacity: number;
  text: string;
  fontUrl: string;
  color: string;
  emissiveColor: string;
  intensity: number;
  // NVS coordinates
  x: number;        // NVS x [0..1], 0=left, 1=right
  y: number;        // NVS y [0..1], 0=top, 1=bottom
  w: number;        // NVS width [0..1]
  h: number;        // NVS height [0..1]
  z: number;        // World-space depth
  tilt: number;     // X-axis rotation in radians (for angled view)
  yRotation: number; // Y-axis rotation in radians
};
