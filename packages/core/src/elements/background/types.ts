/**
 * Background element types.
 */

export type Vec3 = [number, number, number];

export type SceneBackground = {
  imageUrl?: string;
  opacity: number;
  color?: string;        // CSS background color (e.g. '#0a0a14')
  position?: Vec3;
  cssPosition?: string;
  cssSize?: string;
  cssRepeat?: string;
};
