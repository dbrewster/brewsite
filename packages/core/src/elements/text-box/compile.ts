// Pure compiler function for the TextBox element.
// No React, no Three.js, no side effects.

import type { TextBoxState } from './types';
import type { TextBoxProps } from './dsl';

/**
 * Compiles TextBox DSL props into a TextBoxState.
 * Fills all optional fields with their documented defaults.
 * The children field is passed through by reference — it is React content
 * authored in the scene file and not transformed by the compiler.
 *
 * This function is pure: same inputs always produce the same output.
 */
export function compileTextBox(props: TextBoxProps): TextBoxState {
  return {
    x: props.x ?? 0,
    y: props.y ?? 0,
    w: props.w ?? 1,
    h: props.h ?? 1,
    opacity: props.opacity ?? 1,
    anchor: props.anchor ?? 'scene',
    edge: props.edge,
    inset: props.inset ?? 0,
    overflow: props.overflow ?? 'hidden',
    layer: props.layer ?? 0,
    children: props.children,
  };
}
