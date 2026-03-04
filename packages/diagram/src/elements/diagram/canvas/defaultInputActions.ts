// Canonical default input actions for a DiagramCanvas.
// Used as the reference value for theme.input.defaultActions in scene setups that
// want pointer-driven pan/rotate with click-to-focus.

import type { InputActionSpec } from '@brewsite/core';

/**
 * Default input action set for a DiagramCanvas.
 * Provides:
 *   - Left-drag or scroll-wheel (sticky-axis) to move (pan) the canvas
 *   - Right-drag to rotate the canvas
 *   - 'R' key to reset position and rotation
 *   - Meta+left-click to focus on the nearest group or canvas center
 *     (unmodified click is reserved for node interaction)
 *
 * canvasId is intentionally absent: the compiler injects it from the
 * <DiagramCanvas id="..."> when this array is used via theme.input.defaultActions.
 *
 * Note: diagram-canvas.dolly and keyboard-based pan/rotate are not included here.
 * They require a separate InputActionType registration fix (tracked separately).
 */
export const defaultDiagramCanvasInputActions: ReadonlyArray<
  Omit<InputActionSpec, 'canvasId'>
> = [
  {
    id: 'diagram-canvas-move',
    type: 'diagram-canvas.move',
    speed: 1,
    maps: [
      { kind: 'pointer', event: 'drag', button: 'left', axis: 'xy' },
      { kind: 'wheel', axis: 'xy', lockAxis: 'sticky' },
    ],
  },
  {
    id: 'diagram-canvas-rotate',
    type: 'diagram-canvas.rotate',
    speed: 1,
    maps: [{ kind: 'pointer', event: 'drag', button: 'right', axis: 'xy' }],
  },
  {
    id: 'diagram-canvas-reset',
    type: 'diagram-canvas.reset',
    maps: [{ kind: 'key', key: 'r' }],
  },
  {
    // meta+click: avoids conflict with node interaction clicks (unmodified left-click)
    // Matches the existing metaKey guard in DiagramCanvasWidget.handleClick().
    id: 'diagram-canvas-focus',
    type: 'diagram-canvas.focus',
    maps: [{ kind: 'pointer', event: 'click', button: 'left', modifiers: ['meta'] }],
  },
];
