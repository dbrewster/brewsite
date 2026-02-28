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
  DiagramPivot,
  DiagramEasing,
  DiagramExitConfig,
  DiagramEnterConfig,
  DiagramExitDSL,
  DiagramEnterDSL,
  DiagramInteractionEvent,
  LayoutDSL,
  LayoutPadding,
  LayoutAlignment,
  LayoutDisconnected,
} from './types';
export type { DiagramShapeVariant, FlowShape, AwsShape, GcpShape, AzureShape, NetworkShape } from './shapes/shapeVariants';
export {
  Diagram,
  DiagramNode,
  DiagramEdge,
  DiagramGroup,
  GridLayout,
  HierarchicalLayout,
  ManualLayout,
  Exit,
  Enter,
} from './dsl';
export type {
  ExitProps,
  EnterProps,
  GridLayoutProps,
  HierarchicalLayoutProps,
  ManualLayoutProps,
} from './dsl';
export {
  compileDiagram,
  compileNode,
  compileEdge,
  compileGroup,
  resolveLayout,
  computeBounds,
  routeEdges,
  applyDiagramExit,
  applyDiagramEnter,
  functionalDiagramTransitionSpec,
} from './compile';
export { DiagramRenderer } from './render';
export { InteractionRegistry } from './rendering/InteractionRegistry';
export type { IInteractionRegistry } from './rendering/InteractionRegistry';
export { DiagramWidget } from './widget';
export { enterpriseTheme, darkGlassTheme, lightMinimalTheme, neonCyberTheme } from './themes';
export {
  DIAGRAM_FOCUS_REGION_EVENT,
  getDiagramFocusRegion,
  clearDiagramFocusRegion,
} from './focusRegion';
export type {
  DiagramFocusRegionKind,
  DiagramFocusRegionState,
} from './focusRegion';
export { useDiagramFocusRegion } from './useDiagramFocusRegion';
export type { UseDiagramFocusRegionOptions } from './useDiagramFocusRegion';
