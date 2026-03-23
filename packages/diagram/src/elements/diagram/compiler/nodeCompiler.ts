// Node/edge/group defaults and compilers extracted from compile.ts.
// Pure functions only — no Three.js, no React.

import type {
  DiagramNodeDSL,
  DiagramNodeState,
  DiagramEdgeDSL,
  DiagramEdgeState,
  DiagramEdgePathState,
  DiagramTheme,
} from '../types';
import { resolveIconUrl } from '../shapes/iconRegistry';
import { buildNodeDefaults, buildEdgeDefaults } from './defaultsCompiler';
import { resolveToNVS, isUniformUnit } from '@brewsite/core';
import type { SceneLength } from '@brewsite/core';

const edgeIdFor = (edge: DiagramEdgeDSL, index: number): string =>
  edge.id ?? `${edge.from}-${edge.to}-${index}`;

/**
 * Checks if ANY SceneLength value in the list uses uniform (u) units.
 * Returns true if at least one non-undefined value uses `u`.
 */
function anyUniform(...values: ReadonlyArray<SceneLength | undefined>): boolean {
  for (const v of values) {
    if (v !== undefined && isUniformUnit(v)) return true;
  }
  return false;
}

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
  const sideColor = dsl.boxColor ?? dsl.sideColor ?? nd.boxColor;
  const borderColor = dsl.borderColor ?? nd.borderColor;
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

  // Resolve DSL SceneLength values to NVS numbers, falling back to theme defaults.
  const size: [number, number] = dsl.size
    ? [resolveToNVS(dsl.size[0]), resolveToNVS(dsl.size[1])]
    : nd.size;
  const thickness = dsl.thickness !== undefined ? resolveToNVS(dsl.thickness) : nd.thickness;
  const cornerRadius = dsl.cornerRadius !== undefined ? resolveToNVS(dsl.cornerRadius) : nd.cornerRadius;
  const borderWidth = dsl.borderWidth !== undefined ? resolveToNVS(dsl.borderWidth) : nd.borderWidth;
  const borderHeight = dsl.borderHeight !== undefined ? resolveToNVS(dsl.borderHeight) : nd.borderHeight;
  const iconDepth = dsl.iconDepth !== undefined ? resolveToNVS(dsl.iconDepth) : nd.iconDepth;

  // Determine uniformSizing: if ANY DSL size-like prop uses `u`, flag is true.
  // If no DSL overrides provided, inherit from theme defaults.
  const hasDslSpatial = dsl.size !== undefined || dsl.thickness !== undefined
    || dsl.cornerRadius !== undefined || dsl.borderWidth !== undefined
    || dsl.borderHeight !== undefined || dsl.iconDepth !== undefined;

  const uniformSizing = hasDslSpatial
    ? anyUniform(
        dsl.size?.[0], dsl.size?.[1],
        dsl.thickness,
        dsl.cornerRadius,
        dsl.borderWidth,
        dsl.borderHeight,
        dsl.iconDepth,
      )
    : nd.uniformSizing;

  return {
    id: dsl.id,
    label: dsl.label,
    sublabel: dsl.sublabel,
    shape,
    position,
    size,
    thickness,
    uniformSizing,
    color,
    sideColor,
    borderColor,
    borderWidth,
    borderHeight,
    metalness: dsl.metalness ?? nd.metalness,
    roughness: dsl.roughness ?? nd.roughness,
    emissiveIntensity,
    emissive,
    emissiveColor,
    cornerRadius,
    labelColor: dsl.labelColor ?? nd.labelColor,
    sublabelColor: dsl.sublabelColor ?? nd.sublabelColor,
    labelPadding: dsl.labelPadding ?? nd.labelPadding,
    opacity: dsl.opacity ?? nd.opacity,
    clickable: dsl.clickable ?? nd.clickable,
    enabled: dsl.enabled ?? nd.enabled,
    iconUrl: resolveIconUrl(dsl.icon),
    iconScale: dsl.iconScale ?? nd.iconScale,
    iconStyle: dsl.iconStyle ?? nd.iconStyle,
    iconDepth,
    iconColor: dsl.iconColor ?? nd.iconColor,
    sublabelWrap: dsl.sublabelWrap ?? nd.sublabelWrap,
    sublabelMaxLines: dsl.sublabelMaxLines ?? nd.sublabelMaxLines,
    groupId,
    onMouseEnter: dsl.onMouseEnter,
    onMouseLeave: dsl.onMouseLeave,
    positionInherited: positionInherited || undefined,
    surfaceMaterial: dsl.surfaceMaterial ?? theme.node.surfaceMaterial,
    materialApplication: dsl.materialApplication ?? theme.node.materialApplication,
  };
}

export function compileEdge(
  dsl: DiagramEdgeDSL,
  path: DiagramEdgePathState,
  controlPoints: ReadonlyArray<readonly [number, number, number]>,
  index: number,
  theme: DiagramTheme,
  pathDebug?: DiagramEdgeState['pathDebug'],
): DiagramEdgeState {
  const ed = buildEdgeDefaults(theme);

  // Resolve DSL SceneLength values to NVS numbers, falling back to theme defaults.
  const thickness = dsl.thickness !== undefined ? resolveToNVS(dsl.thickness) : ed.thickness;
  const flowTurnRadius = dsl.flowTurnRadius !== undefined ? resolveToNVS(dsl.flowTurnRadius) : ed.flowTurnRadius;
  const flowFaceStub = dsl.flowFaceStub !== undefined ? resolveToNVS(dsl.flowFaceStub) : ed.flowFaceStub;

  // Determine uniformSizing from DSL or theme defaults.
  const hasDslSpatial = dsl.thickness !== undefined || dsl.flowTurnRadius !== undefined || dsl.flowFaceStub !== undefined;
  const uniformSizing = hasDslSpatial
    ? anyUniform(dsl.thickness, dsl.flowTurnRadius, dsl.flowFaceStub)
    : ed.uniformSizing;

  return {
    id: edgeIdFor(dsl, index),
    fromId: dsl.from,
    toId: dsl.to,
    label: dsl.label,
    style: dsl.style ?? ed.style,
    arrowStart: dsl.arrowStart ?? ed.arrowStart,
    arrowEnd: dsl.arrowEnd ?? ed.arrowEnd,
    color: dsl.color ?? ed.color,
    thickness,
    uniformSizing,
    path,
    controlPoints,
    opacity: dsl.opacity ?? ed.opacity,
    routing: dsl.routing ?? ed.routing,
    flowTurnRadius,
    flowFaceStub,
    flowBundleStrength: dsl.flowBundleStrength ?? ed.flowBundleStrength,
    flowTargetApproachBias: dsl.flowTargetApproachBias ?? ed.flowTargetApproachBias,
    fromPort: dsl.fromPort,
    toPort: dsl.toPort,
    flow: dsl.flow ?? ed.flow,
    flowColor: dsl.flowColor ?? theme.edge.defaultFlowColor,
    pathDebug,
  };
}
