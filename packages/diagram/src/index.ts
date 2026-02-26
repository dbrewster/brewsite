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
  DiagramPivot,
  DiagramEasing,
  DiagramExitConfig,
  DiagramEnterConfig,
  DiagramExitDSL,
  DiagramEnterDSL,
  DiagramInteractionEvent,
} from './elements/diagram/types';
export type { DiagramShapeVariant } from './elements/diagram/shapes/shapeVariants';
export { Diagram, DiagramNode, DiagramEdge, DiagramGroup, Exit, Enter } from './elements/diagram/dsl';
export type { ExitProps, EnterProps } from './elements/diagram/dsl';
export {
  compileDiagram,
  resolveLayout,
  routeEdges,
  compileNode,
  compileEdge,
  compileGroup,
  applyDiagramExit,
  applyDiagramEnter,
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

// ─── DiagramCanvas element ──────────────────────────────────────────────────
export type { DiagramCanvasState, DiagramPipeState, DiagramCanvasDSL, DiagramPipeDSL } from './elements/diagram/canvas/types';
export { DiagramCanvas, DiagramPipe } from './elements/diagram/canvas/dsl';
export type { DiagramCanvasProps, DiagramPipeProps } from './elements/diagram/canvas/dsl';
export { compileCanvas, compilePipe, functionalDiagramCanvasTransitionSpec } from './elements/diagram/canvas/compile';
export { DiagramCanvasRenderer } from './elements/diagram/canvas/render';
export { DiagramCanvasWidget } from './elements/diagram/canvas/widget';

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
