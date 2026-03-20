// Constants shared between the compile and render layers. No Three.js. No React.

/** Z-coordinate at which group planes are positioned in canvas-local space. Groups are the furthest-back layer (Z=0). */
export const GROUP_RENDER_Z: number = 0;

/**
 * Z offset applied to all node and edge geometry in world space, placing them
 * in front of group background planes. Must be large enough to prevent
 * Z-fighting but small enough to avoid visible parallax from perspective cameras.
 */
export const NODE_RENDER_Z_OFFSET: number = 0.02;
