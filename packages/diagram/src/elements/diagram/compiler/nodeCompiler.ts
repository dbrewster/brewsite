// Node/edge/group defaults and compilers extracted from compile.ts.
// Pure functions only — no Three.js, no React.

import type {
  DiagramNodeDSL,
  DiagramNodeState,
  DiagramEdgeDSL,
  DiagramEdgeState,
  DiagramTheme,
} from '../types';
import { resolveIconUrl } from '../shapes/iconRegistry';
import { DEFAULT_NODE_SHAPE } from '../shapes/shapeVariants';
import { deriveColor } from '../math/colorUtils';

const edgeIdFor = (edge: DiagramEdgeDSL, index: number): string =>
  edge.id ?? `${edge.from}-${edge.to}-${index}`;

export const buildNodeDefaults = (theme: DiagramTheme) => ({
  shape:                DEFAULT_NODE_SHAPE,
  size:                 [4, 2] as [number, number],
  thickness:            theme.node.defaultThickness,
  color:                theme.node.defaultColor,
  metalness:            theme.node.defaultMetalness,
  roughness:            theme.node.defaultRoughness,
  emissiveIntensity:    theme.node.defaultEmissiveIntensity,
  cornerRadius:         theme.node.cornerRadius,
  labelColor:           theme.node.defaultLabelColor,
  sublabelColor:        theme.node.defaultSublabelColor,
  opacity:              1,
  clickable:            false,
  enabled:              true,
  iconScale:            0.6,
  iconStyle:            theme.node.defaultIconStyle,
  iconDepth:            0.15,
});

export const buildEdgeDefaults = (theme: DiagramTheme) => ({
  style:      'solid' as const,
  arrowStart: 'none' as const,
  arrowEnd:   'none' as const,
  color:      theme.edge.defaultColor,
  thickness:  theme.edge.defaultThickness,
  opacity:    1,
  routing:    theme.edge.routing,
  flow:       'none' as const,
});

export const buildGroupDefaults = (theme: DiagramTheme) => ({
  variant:       'boundary' as const,
  orientation:   'vertical' as const,
  color:         theme.group.defaultColor,
  borderColor:   theme.group.defaultBorderColor,
  borderWidth:   theme.group.defaultBorderWidth,
  borderHeight:  theme.group.defaultBorderHeight,
  borderStyle:   'solid' as const,
  fillOpacity:   theme.group.defaultFillOpacity,
  borderOpacity: theme.group.defaultBorderOpacity,
  borderEmissiveColor: theme.group.defaultBorderEmissiveColor ?? theme.group.defaultBorderColor,
  borderEmissiveIntensity: theme.group.defaultBorderEmissiveIntensity ?? 0,
});

export function compileNode(
  dsl: DiagramNodeDSL,
  position: readonly [number, number, number],
  groupId: string | undefined,
  theme: DiagramTheme,
  positionInherited = false,
): DiagramNodeState {
  const nd = buildNodeDefaults(theme);
  const shape = dsl.shape ?? nd.shape;
  const color = dsl.color ?? nd.color;
  const sideColor = dsl.sideColor ?? deriveColor(color, -0.15);
  const borderColor = dsl.borderColor ?? deriveColor(color, 0.25);
  const emissiveIntensity = (() => {
    if (dsl.glow === false) return 0;
    if (typeof dsl.glow === 'object' && dsl.glow !== null && dsl.glow.intensity !== undefined) {
      return dsl.glow.intensity;
    }
    return nd.emissiveIntensity; // theme default
  })();
  const emissive = (() => {
    if (dsl.glow === false) return false;
    if (dsl.glow === true) return true;
    return emissiveIntensity > 0;
  })();
  const emissiveColor = (() => {
    if (typeof dsl.glow === 'object' && dsl.glow !== null && dsl.glow.color !== undefined) {
      return dsl.glow.color;
    }
    return color; // default to node face color
  })();

  return {
    id: dsl.id,
    label: dsl.label,
    sublabel: dsl.sublabel,
    shape,
    position,
    size: dsl.size ?? nd.size,
    thickness: dsl.thickness ?? nd.thickness,
    color,
    sideColor,
    borderColor,
    metalness: dsl.metalness ?? nd.metalness,
    roughness: dsl.roughness ?? nd.roughness,
    emissiveIntensity,
    emissive,
    emissiveColor,
    cornerRadius: dsl.cornerRadius ?? nd.cornerRadius,
    labelColor: dsl.labelColor ?? nd.labelColor,
    sublabelColor: dsl.sublabelColor ?? nd.sublabelColor,
    opacity: dsl.opacity ?? nd.opacity,
    clickable: dsl.clickable ?? nd.clickable,
    enabled: dsl.enabled ?? nd.enabled,
    iconUrl: resolveIconUrl(dsl.icon),
    iconScale: dsl.iconScale ?? nd.iconScale,
    iconStyle: dsl.iconStyle ?? nd.iconStyle,
    iconDepth: dsl.iconDepth ?? nd.iconDepth,
    groupId,
    onMouseEnter: dsl.onMouseEnter,
    onMouseLeave: dsl.onMouseLeave,
    positionInherited: positionInherited || undefined,
  };
}

export function compileEdge(
  dsl: DiagramEdgeDSL,
  controlPoints: ReadonlyArray<readonly [number, number, number]>,
  index: number,
  theme: DiagramTheme,
): DiagramEdgeState {
  const ed = buildEdgeDefaults(theme);
  return {
    id: edgeIdFor(dsl, index),
    fromId: dsl.from,
    toId: dsl.to,
    label: dsl.label,
    style: dsl.style ?? ed.style,
    arrowStart: dsl.arrowStart ?? ed.arrowStart,
    arrowEnd: dsl.arrowEnd ?? ed.arrowEnd,
    color: dsl.color ?? ed.color,
    thickness: dsl.thickness ?? ed.thickness,
    controlPoints,
    opacity: dsl.opacity ?? ed.opacity,
    routing: dsl.routing ?? ed.routing,
    fromPort: dsl.fromPort,
    toPort: dsl.toPort,
    flow: dsl.flow ?? ed.flow,
    flowColor: dsl.flowColor ?? theme.edge.defaultFlowColor,
  };
}
