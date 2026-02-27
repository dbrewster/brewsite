// Group compiler extracted from compile.ts.
// Pure functions only — no Three.js, no React.

import type { DiagramGroupDSL, DiagramGroupState, DiagramTheme } from '../types';
import { buildGroupDefaults } from './nodeCompiler';
import { computeBounds } from './layoutAlgorithms';

const GROUP_PADDING = 1.5;

export function compileGroup(
  dsl: DiagramGroupDSL,
  positions: Map<string, readonly [number, number, number]>,
  sizes: Map<string, readonly [number, number] | readonly [number, number, number]>,
  theme: DiagramTheme,
): DiagramGroupState {
  const gd = buildGroupDefaults(theme);
  const bounds = computeBounds(dsl.nodeIds, positions, sizes);
  const padding = GROUP_PADDING;

  return {
    id: dsl.id,
    label: dsl.label,
    variant: dsl.variant ?? gd.variant,
    orientation: dsl.orientation ?? gd.orientation,
    bounds: {
      x: bounds.x - padding,
      y: bounds.y - padding,
      w: bounds.w + padding * 2,
      h: bounds.h + padding * 2,
      padding,
    },
    color: dsl.color ?? gd.color,
    borderColor: dsl.borderColor ?? gd.borderColor,
    borderStyle: dsl.borderStyle ?? gd.borderStyle,
    fillOpacity: dsl.fillOpacity ?? gd.fillOpacity,
    borderOpacity: dsl.borderOpacity ?? gd.borderOpacity,
  };
}
