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
import { deriveColor } from '../math/colorUtils';
import { buildNodeDefaults, buildEdgeDefaults } from './defaultsCompiler';

const edgeIdFor = (edge: DiagramEdgeDSL, index: number): string =>
  edge.id ?? `${edge.from}-${edge.to}-${index}`;

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
  const sideColor = dsl.boxColor ?? dsl.sideColor ?? nd.boxColor ?? deriveColor(color, nd.sideColorDarkenFactor);
  const borderColor = dsl.borderColor ?? deriveColor(color, nd.borderColorLightenFactor);
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
    labelPadding: dsl.labelPadding ?? nd.labelPadding,
    opacity: dsl.opacity ?? nd.opacity,
    clickable: dsl.clickable ?? nd.clickable,
    enabled: dsl.enabled ?? nd.enabled,
    iconUrl: resolveIconUrl(dsl.icon),
    iconScale: dsl.iconScale ?? nd.iconScale,
    iconStyle: dsl.iconStyle ?? nd.iconStyle,
    iconDepthFactor: dsl.iconDepthFactor ?? nd.iconDepthFactor,
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
    path,
    controlPoints,
    opacity: dsl.opacity ?? ed.opacity,
    routing: dsl.routing ?? ed.routing,
    flowTurnRadius: dsl.flowTurnRadius ?? ed.flowTurnRadius,
    flowFaceStub: dsl.flowFaceStub ?? ed.flowFaceStub,
    flowBundleStrength: dsl.flowBundleStrength ?? ed.flowBundleStrength,
    flowTargetApproachBias: dsl.flowTargetApproachBias ?? ed.flowTargetApproachBias,
    allowUnderpass: dsl.allowUnderpass ?? ed.allowUnderpass,
    fromPort: dsl.fromPort,
    toPort: dsl.toPort,
    flow: dsl.flow ?? ed.flow,
    flowColor: dsl.flowColor ?? theme.edge.defaultFlowColor,
    pathDebug,
  };
}
