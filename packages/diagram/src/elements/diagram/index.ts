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
  DiagramGroupSide,
  DiagramOrientation,
  DiagramThemeName,

  DiagramEasing,
  DiagramExitConfig,
  DiagramEnterConfig,
  DiagramExitDSL,
  DiagramEnterDSL,
  DiagramInteractionEvent,
  DiagramHoverControls,
  DiagramHoverEventBase,
  DiagramNodeHoverEvent,
  DiagramGroupHoverEvent,
  DiagramNodeMouseHandler,
  DiagramGroupMouseHandler,
  LayoutDSL,
  LayoutPadding,
  LayoutAlignment,
  LayoutDisconnected,
  DiagramGroupEdgeLightColorResolver,
  DiagramGroupEdgeLightState,
  DiagramGroupEdgeLightsState,
  DiagramGroupEdgeLightsDSL,
  DiagramNodeGlowConfig,
} from './types';
export type {
  DiagramNodeShape,
  DiagramIconVariant,
  FlowIconShape,
  UiShape,
  TechShape,
  SecurityShape,
  DataShape,
  AwsShape,
  GcpShape,
  AzureShape,
  NetworkShape,
} from './shapes/shapeVariants';
export { DEFAULT_NODE_SHAPE } from './shapes/shapeVariants';
export {
  Diagram,
  DiagramNode,
  DiagramEdge,
  DiagramGroup,
  GridLayout,
  HierarchicalLayout,
  ManualLayout,
  DiagramExit,
  DiagramEnter,
} from './widget';
export type {
  DiagramExitProps,
  DiagramEnterProps,
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
// DiagramWidget is kept as an internal implementation detail but removed from public API.
export {
  enterpriseTheme,
  enterpriseLightTheme,
  defaultDiagramTheme,
  defaultLightDiagramTheme,
  registerDiagramThemePair,
  resolveDiagramTheme,
  _resetDiagramThemeRegistryForTesting,
} from './themes';
export type { DiagramThemePair } from './themes';
export { mergeTheme } from './themes/mergeTheme';
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
