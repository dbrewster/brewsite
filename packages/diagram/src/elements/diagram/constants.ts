// Constants shared between the compile and render layers. No Three.js. No React.

/** Converts "border width in display units" (theme value) to canvas-world border width. */
export const GROUP_BORDER_PX_TO_UNITS: number = 0.4;

/** Z-coordinate at which group planes are positioned in canvas-local space. Groups are the furthest-back layer (Z=0). */
export const GROUP_RENDER_Z: number = 0;

/** Z offset applied to all node and edge geometry in world space, placing them in front of groups. */
export const NODE_RENDER_Z_OFFSET: number = 0.6;
