/**
 * Background element types.
 */

// NOTE: SceneTheme is NOT stored in SceneBackground.
// The BackgroundWidget CUSTOM_NODE_HANDLER resolves SceneTheme at compile time
// into the concrete fields below.

export type SceneBackground = {
  imageUrl?: string;
  opacity: number;
  color?: string;        // CSS background color (e.g. '#0a0a14')
  /** CSS gradient string — takes precedence over color/imageUrl when set */
  gradient?: string;
  cssPosition?: string;
  cssSize?: string;
  cssRepeat?: string;
  /** CSS filter applied to the background DOM element. e.g. 'blur(4px) brightness(0.8)' */
  cssFilter?: string;
  /**
   * CSS gradient string for an overlay element above the background, below scene content.
   * Requires BackgroundWidget to manage an overlayElement (second DOM element).
   */
  overlayGradient?: string;
  /** CSS backdrop-filter applied to the overlay element. e.g. 'blur(12px)' */
  backdropFilter?: string;
};
