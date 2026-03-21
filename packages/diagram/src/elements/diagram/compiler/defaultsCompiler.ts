// Owns all DSL-to-default-value transformations for nodes, edges, and groups.
// Single location for theme-driven defaults. Pure functions only — no Three.js, no React.

import type { DiagramTheme } from '../types';
import type { SvgIcon3DStyle } from '../types';
import type { EdgeRoutingAlgorithm } from '../types';
import type { DiagramNodeShape } from '../shapes/shapeVariants';
import { DEFAULT_NODE_SHAPE } from '../shapes/shapeVariants';
import { resolveToNVS, isUniformUnit } from '@brewsite/core';

/** Default values derived from a DiagramTheme for a diagram node. */
export interface NodeDefaults {
  readonly shape: DiagramNodeShape;
  readonly size: [number, number];
  readonly thickness: number;
  readonly color: string;
  readonly boxColor: string;
  readonly borderColor: string;
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
  readonly iconDepth: number;
  readonly iconColor: string;
  readonly labelPadding: number;
  readonly sublabelWrap: boolean;
  readonly sublabelMaxLines: number;
  readonly borderWidth: number;
  readonly borderHeight: number;
  /** Whether the theme's spatial defaults use uniform (u) units. */
  readonly uniformSizing: boolean;
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
  /** Whether the theme's edge spatial defaults use uniform (u) units. */
  readonly uniformSizing: boolean;
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
  readonly backColor: string | undefined;
  /** Whether the theme's group spatial defaults use uniform (u) units. */
  readonly uniformSizing: boolean;
}

/**
 * Builds default node values from the given theme.
 * Resolves SceneLength values to NVS fractions and determines uniformSizing.
 */
export function buildNodeDefaults(theme: DiagramTheme): NodeDefaults {
  const defaultBorderWidth = theme.node.defaultNodeBorderWidth ?? '0.5%';
  const defaultBorderHeight = theme.node.defaultNodeBorderHeight ?? '0.5%';
  const uniformSizing = isUniformUnit(theme.node.defaultSize[0])
    || isUniformUnit(theme.node.defaultThickness);
  return {
    shape:                    DEFAULT_NODE_SHAPE,
    size:                     [resolveToNVS(theme.node.defaultSize[0]), resolveToNVS(theme.node.defaultSize[1])],
    thickness:                resolveToNVS(theme.node.defaultThickness),
    color:                    theme.node.defaultColor,
    boxColor:                 theme.node.defaultBoxColor,
    borderColor:              theme.node.defaultBorderColor,
    metalness:                theme.node.defaultMetalness,
    roughness:                theme.node.defaultRoughness,
    emissiveIntensity:        theme.node.defaultEmissiveIntensity,
    cornerRadius:             resolveToNVS(theme.node.cornerRadius),
    labelColor:               theme.node.defaultLabelColor,
    sublabelColor:            theme.node.defaultSublabelColor,
    opacity:                  1,
    clickable:                false,
    enabled:                  true,
    iconScale:                theme.node.defaultIconScale,
    iconStyle:                theme.node.defaultIconStyle,
    iconDepth:                resolveToNVS(theme.node.defaultIconDepth),
    iconColor:                theme.node.defaultIconColor ?? '#ffffff',
    labelPadding:             theme.node.defaultLabelPadding,
    sublabelWrap:             false,
    sublabelMaxLines:         2,
    borderWidth:              resolveToNVS(defaultBorderWidth),
    borderHeight:             resolveToNVS(defaultBorderHeight),
    uniformSizing,
  };
}

/**
 * Builds default edge values from the given theme.
 * Resolves SceneLength values to NVS fractions and determines uniformSizing.
 */
export function buildEdgeDefaults(theme: DiagramTheme): EdgeDefaults {
  const uniformSizing = isUniformUnit(theme.edge.defaultThickness);
  return {
    style:                   'solid',
    arrowStart:              'none',
    arrowEnd:                'none',
    color:                   theme.edge.defaultColor,
    thickness:               resolveToNVS(theme.edge.defaultThickness),
    opacity:                 1,
    routing:                 theme.edge.routing,
    flowTurnRadius:          resolveToNVS(theme.edge.flowTurnRadius),
    flowFaceStub:            resolveToNVS(theme.edge.flowFaceStub),
    flowBundleStrength:      theme.edge.flowBundleStrength,
    flowTargetApproachBias:  theme.edge.flowTargetApproachBias,
    allowUnderpass:          true,
    flow:                    'none',
    uniformSizing,
  };
}

/**
 * Builds default group values from the given theme.
 * Resolves SceneLength values to NVS fractions and determines uniformSizing.
 */
export function buildGroupDefaults(theme: DiagramTheme): GroupDefaults {
  const uniformSizing = isUniformUnit(theme.group.defaultBorderWidth);
  return {
    variant:                  'boundary',
    orientation:              'vertical',
    color:                    theme.group.defaultColor,
    borderColor:              theme.group.defaultBorderColor,
    borderWidth:              resolveToNVS(theme.group.defaultBorderWidth),
    borderHeight:             resolveToNVS(theme.group.defaultBorderHeight),
    borderStyle:              'solid',
    fillOpacity:              theme.group.defaultFillOpacity,
    borderOpacity:            theme.group.defaultBorderOpacity,
    borderEmissiveColor:      theme.group.defaultBorderEmissiveColor ?? theme.group.defaultBorderColor,
    borderEmissiveIntensity:  theme.group.defaultBorderEmissiveIntensity ?? 0,
    labelColor:               theme.group.defaultLabelColor,
    backColor:                theme.group.defaultBackColor,
    uniformSizing,
  };
}
