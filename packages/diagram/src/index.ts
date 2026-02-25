// @brewsite/diagram — 3D immersive diagram and screen elements
// Full implementation: see requirements/plans/plan_diagram_package.md

// ─── Diagram element ─────────────────────────────────────────────────────────
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
} from './elements/diagram/types';
export type { DiagramShapeVariant } from './elements/diagram/shapes/shapeVariants';
export { Diagram, DiagramNode, DiagramEdge, DiagramGroup } from './elements/diagram/dsl';
export {
  compileDiagram,
  resolveLayout,
  routeEdges,
  compileNode,
  compileEdge,
  compileGroup,
  functionalDiagramTransitionSpec,
} from './elements/diagram/compile';
export { DiagramRenderer } from './elements/diagram/render';
export { DiagramWidget } from './elements/diagram/widget';
export type {
  FlowShape,
  AwsShape,
  GcpShape,
  AzureShape,
  NetworkShape,
} from './elements/diagram/shapes/shapeVariants';

// ─── ImagePanel element ─────────────────────────────────────────────────────
export type { ImagePanelState, ImagePanelDSL, ImagePanelBezelVariant } from './elements/image-panel/types';
export { ImagePanel } from './elements/image-panel/dsl';
export { compileImagePanel, functionalImagePanelTransitionSpec } from './elements/image-panel/compile';
export { ImagePanelRenderer } from './elements/image-panel/render';
export { ImagePanelWidget } from './elements/image-panel/widget';

// ─── Screen element ─────────────────────────────────────────────────────────
export type { ScreenState, ScreenDSL, ScreenBezelVariant } from './elements/screen/types';
export { Screen } from './elements/screen/dsl';
export { compileScreen, functionalScreenTransitionSpec } from './elements/screen/compile';
export { ScreenRenderer } from './elements/screen/render';
export { ScreenWidget } from './elements/screen/widget';

// ─── Compiler handler registration ──────────────────────────────────────────
export { registerDiagramHandlers } from './compiler/handlers';
