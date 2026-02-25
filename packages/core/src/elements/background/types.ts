/**
 * Background element types.
 */

export type Vec3 = [number, number, number];

export type SceneBackground = {
  imageUrl?: string;
  opacity: number;
  position?: Vec3;
  cssPosition?: string;
  cssSize?: string;
  cssRepeat?: string;
};
