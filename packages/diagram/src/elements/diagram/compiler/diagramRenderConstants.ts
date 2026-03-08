// Constants that must be identical across the compile layer and the render layer.
// The compiler uses these to compute edge routing positions around groups;
// the renderer uses them to lay out group geometry. Both must always use the same values.

/** Converts "border width in display units" (theme value) to canvas-world border width. */
export const GROUP_BORDER_PX_TO_UNITS: number = 0.4;

/** Z-coordinate at which group planes are positioned in canvas-local space. */
export const GROUP_RENDER_Z: number = -0.6;
