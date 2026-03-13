// Owns all DSL-to-default-value transformations for nodes, edges, and groups.
// Single location for theme-driven defaults. Pure functions only — no Three.js, no React.

import type { DiagramTheme } from '../types';
import type { SvgIcon3DStyle } from '../types';
import type { EdgeRoutingAlgorithm } from '../types';
import type { DiagramNodeShape } from '../shapes/shapeVariants';
import { DEFAULT_NODE_SHAPE } from '../shapes/shapeVariants';

/** Default values derived from a DiagramTheme for a diagram node. */
export interface NodeDefaults {
  readonly shape: DiagramNodeShape;
  readonly size: [number, number];
  readonly thickness: number;
  readonly color: string;
  readonly boxColor: string | undefined;
  readonly metalness: number;
  readonly roughness: number;
  readonly emissiveIntensity: number;
  readonly cornerRadius: number;
  readonly labelColor: string;
  readonly sublabelColor: string;
  readonly opacity: number;
  readonly clickable: boolean;
  readonly enabled: boolean;
  readonly iconScale: number;
  readonly iconStyle: SvgIcon3DStyle;
  readonly iconDepthFactor: number;
  readonly labelPadding: number;
  readonly sideColorDarkenFactor: number;
  readonly borderColorLightenFactor: number;
}

/** Default values derived from a DiagramTheme for a diagram edge. */
export interface EdgeDefaults {
  readonly style: 'solid';
  readonly arrowStart: 'none';
  readonly arrowEnd: 'none';
  readonly color: string;
  readonly thickness: number;
  readonly opacity: number;
  readonly routing: EdgeRoutingAlgorithm;
  readonly flowTurnRadius: number;
  readonly flowFaceStub: number;
  readonly flowBundleStrength: number;
  readonly flowTargetApproachBias: number;
  readonly allowUnderpass: boolean;
  readonly flow: 'none';
}

/** Default values derived from a DiagramTheme for a diagram group. */
export interface GroupDefaults {
  readonly variant: 'boundary';
  readonly orientation: 'vertical';
  readonly color: string;
  readonly borderColor: string;
  readonly borderWidth: number;
  readonly borderHeight: number;
  readonly borderStyle: 'solid';
  readonly fillOpacity: number;
  readonly borderOpacity: number;
  readonly borderEmissiveColor: string;
  readonly borderEmissiveIntensity: number;
  readonly labelColor: string;
}

/**
 * Builds default node values from the given theme.
 * Used by the node compiler to fill in unspecified DSL props.
 */
export function buildNodeDefaults(theme: DiagramTheme): NodeDefaults {
  return {
    shape:                    DEFAULT_NODE_SHAPE,
    size:                     theme.node.defaultSize as [number, number],
    thickness:                theme.node.defaultThickness,
    color:                    theme.node.defaultColor,
    boxColor:                 theme.node.defaultBoxColor,
    metalness:                theme.node.defaultMetalness,
    roughness:                theme.node.defaultRoughness,
    emissiveIntensity:        theme.node.defaultEmissiveIntensity,
    cornerRadius:             theme.node.cornerRadius,
    labelColor:               theme.node.defaultLabelColor,
    sublabelColor:            theme.node.defaultSublabelColor,
    opacity:                  1,
    clickable:                false,
    enabled:                  true,
    iconScale:                theme.node.defaultIconScale,
    iconStyle:                theme.node.defaultIconStyle,
    iconDepthFactor:          theme.node.defaultIconDepthFactor,
    labelPadding:             theme.node.defaultLabelPadding,
    sideColorDarkenFactor:    theme.node.sideColorDarkenFactor,
    borderColorLightenFactor: theme.node.borderColorLightenFactor,
  };
}

/**
 * Builds default edge values from the given theme.
 * Used by the edge compiler to fill in unspecified DSL props.
 */
export function buildEdgeDefaults(theme: DiagramTheme): EdgeDefaults {
  return {
    style:                   'solid',
    arrowStart:              'none',
    arrowEnd:                'none',
    color:                   theme.edge.defaultColor,
    thickness:               theme.edge.defaultThickness,
    opacity:                 1,
    routing:                 theme.edge.routing,
    flowTurnRadius:          theme.edge.flowTurnRadius,
    flowFaceStub:            theme.edge.flowFaceStub,
    flowBundleStrength:      theme.edge.flowBundleStrength,
    flowTargetApproachBias:  theme.edge.flowTargetApproachBias,
    allowUnderpass:          true,
    flow:                    'none',
  };
}

/**
 * Builds default group values from the given theme.
 * Used by the group compiler to fill in unspecified DSL props.
 */
export function buildGroupDefaults(theme: DiagramTheme): GroupDefaults {
  return {
    variant:                  'boundary',
    orientation:              'vertical',
    color:                    theme.group.defaultColor,
    borderColor:              theme.group.defaultBorderColor,
    borderWidth:              theme.group.defaultBorderWidth,
    borderHeight:             theme.group.defaultBorderHeight,
    borderStyle:              'solid',
    fillOpacity:              theme.group.defaultFillOpacity,
    borderOpacity:            theme.group.defaultBorderOpacity,
    borderEmissiveColor:      theme.group.defaultBorderEmissiveColor ?? theme.group.defaultBorderColor,
    borderEmissiveIntensity:  theme.group.defaultBorderEmissiveIntensity ?? 0,
    labelColor:               theme.group.defaultLabelColor,
  };
}
