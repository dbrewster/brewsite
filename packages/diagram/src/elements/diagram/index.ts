// Public re-exports for the diagram element module.
// Consumers inside this package import from this barrel; the root src/index.ts re-exports further.

export type {
  DiagramState,
  DiagramNodeState,
  DiagramEdgeState,
  DiagramGroupState,
  DiagramDSL,
  DiagramNodeDSL,
  DiagramEdgeDSL,
  DiagramGroupDSL,
  DiagramEdgeStyle,
  DiagramArrowVariant,
  DiagramGroupVariant,
  DiagramOrientation,
  DiagramInteractionEvent,
} from './types';
export type { DiagramShapeVariant, FlowShape, AwsShape, GcpShape, AzureShape, NetworkShape } from './shapes/shapeVariants';
export { Diagram, DiagramNode, DiagramEdge, DiagramGroup } from './dsl';
export {
  compileDiagram,
  compileNode,
  compileEdge,
  compileGroup,
  resolveLayout,
  computeBounds,
  routeEdges,
  functionalDiagramTransitionSpec,
} from './compile';
export { DiagramRenderer } from './render';
export { DiagramWidget } from './widget';
