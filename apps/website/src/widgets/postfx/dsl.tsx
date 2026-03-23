// DSL prop interface for the PostFX widget — all dimensionless, no SceneLength needed.

/** DSL props for the PostFX widget. All fields are dimensionless scalars. */
export type PostFxProps = {
  enabled?: boolean;
  bloomStrength?: number;
  bloomRadius?: number;
  bloomThreshold?: number;
  vignetteStrength?: number;
  gradeMix?: number;
  quality?: 'high' | 'medium' | 'off';
  children?: React.ReactNode;
};

export const PostFx = (_props: PostFxProps) => null;
