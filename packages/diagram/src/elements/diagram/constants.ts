// Constants shared between the compile and render layers. No Three.js. No React.

/** Converts "border width in display units" (theme value) to canvas-world border width. */
export const GROUP_BORDER_PX_TO_UNITS: number = 0.4;

/** Z-coordinate at which group planes are positioned in canvas-local space. */
export const GROUP_RENDER_Z: number = -0.6;
