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
export { compileDiagram, functionalDiagramTransitionSpec } from './elements/diagram/compile';

// ─── ImagePanel element ─────────────────────────────────────────────────────
export type { ImagePanelState, ImagePanelDSL, ImagePanelBezelVariant } from './elements/image-panel/types';
export { ImagePanel } from './elements/image-panel/dsl';
export { compileImagePanel, functionalImagePanelTransitionSpec } from './elements/image-panel/compile';

// ─── Screen element ─────────────────────────────────────────────────────────
export type { ScreenState, ScreenDSL, ScreenBezelVariant } from './elements/screen/types';
export { Screen } from './elements/screen/dsl';
export { compileScreen, functionalScreenTransitionSpec } from './elements/screen/compile';
