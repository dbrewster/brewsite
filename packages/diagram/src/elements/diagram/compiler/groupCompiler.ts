// Group compiler extracted from compile.ts.
// Pure functions only — no Three.js, no React.

import type {
  DiagramGroupDSL,
  DiagramGroupState,
  DiagramTheme,
  DiagramGroupSide,
  DiagramGroupEdgeLightsState,
} from '../types';
import { unionBounds } from '@brewsite/core';
import { buildGroupDefaults } from './defaultsCompiler';
import { computeBounds } from './layoutAlgorithms';
import type { ResolvedLayout } from './layoutResolver';
import { GROUP_BORDER_PX_TO_UNITS } from '../constants';
import { DEFAULT_GROUP_PADDING, DEFAULT_TITLE_GAP } from './diagramLayoutConstants';

/**
 * Bounding box for a group, in diagram units pre-normalization, or in [0..1] NVS
 * fractions post-normalization (after normalizeToViewport() in compile.ts).
 *
 * Pre-normalization (auto-layout): x/y are Cartesian diagram units; y = bottom edge (Y-up).
 * Post-normalization: x/y are NVS fractions; y = TOP edge (Y-down, NVS convention).
 * ManualLayout: positions are authored in [0..1] NVS; y = NVS top edge from the start.
 */
export type GroupBounds = {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  /** Resolved padding [top, right, bottom, left]. Units match the current coordinate space. */
  readonly padding: readonly [number, number, number, number];
  /** Gap between group title label and content. Units match the current coordinate space. */
  readonly titleGap: number;
};

const isEmptyBounds = (bounds: { w: number; h: number }): boolean =>
  bounds.w === 0 && bounds.h === 0;

const DEFAULT_EDGE_LIGHT_DENSITY = 1;
const DEFAULT_EDGE_LIGHT_COLOR = '#ffffff';
const DEFAULT_EDGE_LIGHT_INTENSITY = 0.75;
const DEFAULT_EDGE_LIGHT_DISTANCE = 3;
const DEFAULT_EDGE_LIGHT_DECAY = 2;
const DEFAULT_EDGE_LIGHT_Z_OFFSET = 0.12;
const clampNonNegativeFinite = (value: number, fallback = 0): number =>
  Number.isFinite(value) ? Math.max(0, value) : fallback;

type Point2 = { x: number; y: number };

const SIDE_ORDER: readonly DiagramGroupSide[] = ['top', 'right', 'bottom', 'left'];

const resolveSideDensity = (
  side: DiagramGroupSide,
  baseDensity: number,
  densityBySide?: Partial<Record<DiagramGroupSide, number>>,
): number => {
  const override = densityBySide?.[side];
  if (override === undefined) return baseDensity;
  return clampNonNegativeFinite(override, 0);
};

const sideStartEnd = (
  side: DiagramGroupSide,
  halfW: number,
  halfH: number,
): { start: Point2; end: Point2; length: number } => {
  switch (side) {
    case 'top':
      return { start: { x: -halfW, y: halfH }, end: { x: halfW, y: halfH }, length: halfW * 2 };
    case 'right':
      return { start: { x: halfW, y: halfH }, end: { x: halfW, y: -halfH }, length: halfH * 2 };
    case 'bottom':
      return { start: { x: halfW, y: -halfH }, end: { x: -halfW, y: -halfH }, length: halfW * 2 };
    case 'left':
      return { start: { x: -halfW, y: -halfH }, end: { x: -halfW, y: halfH }, length: halfH * 2 };
  }
};

function compileEdgeLights(
  dsl: DiagramGroupDSL,
  bounds: GroupBounds,
  borderWidth: number,
  borderHeight: number,
  borderStyle: 'solid' | 'dashed' | 'none',
): DiagramGroupEdgeLightsState | undefined {
  const spec = dsl.edgeLights;
  if (!spec || spec.enabled === false) return undefined;
  if (bounds.w <= 0 || bounds.h <= 0) return undefined;
  if (borderStyle === 'none') return undefined;

  const baseDensity = clampNonNegativeFinite(spec.density ?? DEFAULT_EDGE_LIGHT_DENSITY, 0);
  if (baseDensity <= 0 && !spec.densityBySide) return undefined;

  const borderWidthUnits = Math.max(0, borderWidth * GROUP_BORDER_PX_TO_UNITS);
  const centerlineW = bounds.w + borderWidthUnits;
  const centerlineH = bounds.h + borderWidthUnits;
  const halfW = centerlineW / 2;
  const halfH = centerlineH / 2;
  const z = Math.max(0.01, borderHeight) / 2 + clampNonNegativeFinite(spec.zOffset ?? DEFAULT_EDGE_LIGHT_Z_OFFSET, 0);

  const lights: Array<DiagramGroupEdgeLightsState['lights'][number]> = [];
  let lightIndex = 0;

  for (const side of SIDE_ORDER) {
    const density = resolveSideDensity(side, baseDensity, spec.densityBySide);
    if (density <= 0) continue;

    const { start, end, length } = sideStartEnd(side, halfW, halfH);
    const lightCount = Math.max(1, Math.round(length * density));
    for (let indexOnSide = 0; indexOnSide < lightCount; indexOnSide += 1) {
      const t = indexOnSide / lightCount;
      const x = start.x + (end.x - start.x) * t;
      const y = start.y + (end.y - start.y) * t;
      const rawColor = typeof spec.color === 'function'
        ? spec.color(lightIndex, side, indexOnSide)
        : spec.color;
      lights.push({
        index: lightIndex,
        side,
        indexOnSide,
        position: [x, y, z],
        color: typeof rawColor === 'string' && rawColor.length > 0 ? rawColor : DEFAULT_EDGE_LIGHT_COLOR,
      });
      lightIndex += 1;
    }
  }

  if (lights.length === 0) return undefined;

  return {
    lights,
    intensity: clampNonNegativeFinite(spec.intensity ?? DEFAULT_EDGE_LIGHT_INTENSITY, DEFAULT_EDGE_LIGHT_INTENSITY),
    distance: clampNonNegativeFinite(spec.distance ?? DEFAULT_EDGE_LIGHT_DISTANCE, DEFAULT_EDGE_LIGHT_DISTANCE),
    decay: clampNonNegativeFinite(spec.decay ?? DEFAULT_EDGE_LIGHT_DECAY, DEFAULT_EDGE_LIGHT_DECAY),
  };
}

export function resolveGroupBoundsMap(
  groups: ReadonlyArray<DiagramGroupDSL>,
  positions: Map<string, readonly [number, number, number]>,
  sizes: Map<string, readonly [number, number] | readonly [number, number, number]>,
  groupLayouts: Map<string, ResolvedLayout>,
): Map<string, GroupBounds> {
  const groupById = new Map(groups.map((g) => [g.id, g]));
  const memo = new Map<string, GroupBounds>();
  const visiting = new Set<string>();

  const computeGroupBounds = (groupId: string): GroupBounds => {
    const cached = memo.get(groupId);
    if (cached) return cached;
    if (visiting.has(groupId)) {
      return { x: 0, y: 0, w: 0, h: 0, padding: DEFAULT_GROUP_PADDING, titleGap: DEFAULT_TITLE_GAP };
    }
    visiting.add(groupId);
    const group = groupById.get(groupId);
    if (!group) {
      const empty: GroupBounds = { x: 0, y: 0, w: 0, h: 0, padding: DEFAULT_GROUP_PADDING, titleGap: DEFAULT_TITLE_GAP };
      memo.set(groupId, empty);
      visiting.delete(groupId);
      return empty;
    }

    const nodeBounds = computeBounds(group.nodeIds, positions, sizes);
    let combined: { x: number; y: number; w: number; h: number } | null =
      group.nodeIds.length > 0 && !isEmptyBounds(nodeBounds)
        ? { x: nodeBounds.x, y: nodeBounds.y, w: nodeBounds.w, h: nodeBounds.h }
        : null;

    const childIds = group.childGroupIds ?? [];
    for (const childId of childIds) {
      const childBounds = computeGroupBounds(childId);
      if (isEmptyBounds(childBounds)) continue;
      if (!combined) {
        combined = { x: childBounds.x, y: childBounds.y, w: childBounds.w, h: childBounds.h };
      } else {
        combined = unionBounds(combined, childBounds);
      }
    }

    const base = combined ?? { x: 0, y: 0, w: 0, h: 0 };
    const gl = groupLayouts.get(groupId);
    const [pt, pr, pb, pl] = gl?.groupPadding ?? DEFAULT_GROUP_PADDING;
    const titleGap = gl?.titleGap ?? DEFAULT_TITLE_GAP;
    const padded: GroupBounds = {
      x: base.x - pl,
      y: base.y - pb,
      w: base.w + pl + pr,
      h: base.h + pb + pt,
      padding: [pt, pr, pb, pl],
      titleGap,
    };

    memo.set(groupId, padded);
    visiting.delete(groupId);
    return padded;
  };

  groups.forEach((group) => {
    computeGroupBounds(group.id);
  });

  return memo;
}

export function compileGroup(
  dsl: DiagramGroupDSL,
  bounds: GroupBounds,
  theme: DiagramTheme,
): DiagramGroupState {
  const gd = buildGroupDefaults(theme);
  const variant = dsl.variant ?? gd.variant;
  const isContainer = variant === 'container';
  const borderStyle = isContainer ? 'none' : (dsl.borderStyle ?? gd.borderStyle);
  const edgeLights = compileEdgeLights(
    dsl,
    bounds,
    gd.borderWidth,
    gd.borderHeight,
    borderStyle,
  );

  return {
    id: dsl.id,
    label: dsl.label ?? '',
    variant,
    orientation: dsl.orientation ?? gd.orientation,
    parentId: dsl.parentId,
    bounds,
    color: dsl.color ?? gd.color,
    borderColor: dsl.borderColor ?? gd.borderColor,
    borderWidth: gd.borderWidth,
    borderHeight: gd.borderHeight,
    borderStyle,
    fillOpacity: isContainer ? 0 : (dsl.fillOpacity ?? gd.fillOpacity),
    borderOpacity: isContainer ? 0 : (dsl.borderOpacity ?? gd.borderOpacity),
    borderEmissiveColor: dsl.borderEmissiveColor ?? gd.borderEmissiveColor,
    borderEmissiveIntensity: isContainer ? 0 : clampNonNegativeFinite(
      dsl.borderEmissiveIntensity ?? gd.borderEmissiveIntensity,
      0,
    ),
    onMouseEnter: dsl.onMouseEnter,
    onMouseLeave: dsl.onMouseLeave,
    edgeLights,
    labelColor: dsl.labelColor ?? gd.labelColor,
    surfaceMaterial: dsl.surfaceMaterial,
    materialApplication: dsl.materialApplication,
  };
}
