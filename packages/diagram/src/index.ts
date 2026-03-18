// @brewsite/diagram — 3D immersive diagram and screen elements
// Handler registration runs as a side-effect on first import. This is intentional — all diagram DSL components must be registered before any scene compilation.
import './register';

// ─── Diagram element ─────────────────────────────────────────────────────────
export type {
  DiagramState,
  DiagramNodeState,
  DiagramEdgeState,
  DiagramEdgePathCommand,
  DiagramEdgePathState,
  DiagramEdgePathDebug,
  DiagramGroupState,
  DiagramDSL,
  DiagramNodeDSL,
  DiagramEdgeDSL,
  DiagramGroupDSL,
  DiagramEdgeStyle,
  DiagramArrowVariant,
  DiagramEdgeFlow,
  DiagramGroupVariant,
  DiagramOrientation,

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
  DiagramGroupSide,
  DiagramGroupEdgeLightColorResolver,
  DiagramGroupEdgeLightState,
  DiagramGroupEdgeLightsState,
  DiagramGroupEdgeLightsDSL,
  // Theming
  DiagramTheme,
  DiagramCanvasInputConfig,
  DiagramThemeRenderConfig,
  DiagramThemeNodeConfig,
  DiagramThemeEdgeConfig,
  DiagramThemeGroupConfig,
  DiagramThemeEnvironmentConfig,
  DiagramThemeLayoutConfig,
  EdgeRoutingAlgorithm,
  EdgeLandingAlgorithm,
  DiagramEdgePort,
  SvgIcon3DStyle,
  DiagramNodeGlowConfig,
} from './elements/diagram/types';

export type { DiagramNodeShape, DiagramIconVariant } from './elements/diagram/shapes/shapeVariants';
export { DEFAULT_NODE_SHAPE } from './elements/diagram/shapes/shapeVariants';
export { Diagram, DiagramNode, DiagramEdge, DiagramGroup, DiagramExit, DiagramEnter, GridLayout, HierarchicalLayout, ManualLayout, FlowLayout, DiagramWidget } from './elements/diagram/widget';
export type {
  DiagramProps,
  DiagramNodeProps,
  DiagramEdgeProps,
  DiagramGroupProps,
  DiagramExitProps,
  DiagramEnterProps,
  GridLayoutProps,
  HierarchicalLayoutProps,
  ManualLayoutProps,
  FlowLayoutProps,
} from './elements/diagram/dsl';
export {
  compileDiagram,
  applyDiagramExit,
  applyDiagramEnter,
  functionalDiagramTransitionSpec,
} from './elements/diagram/compile';
export { DiagramRenderer } from './elements/diagram/render';
export { diagramPlugin } from './player/diagramPlugin';
export {
  DIAGRAM_FOCUS_REGION_EVENT,
  getDiagramFocusRegion,
  clearDiagramFocusRegion,
} from './elements/diagram/focusRegion';
export type {
  DiagramFocusRegionKind,
  DiagramFocusRegionState,
} from './elements/diagram/focusRegion';
export { useDiagramFocusRegion } from './elements/diagram/useDiagramFocusRegion';
export type { UseDiagramFocusRegionOptions } from './elements/diagram/useDiagramFocusRegion';
export type {
  FlowIconShape,
  AwsShape,
  GcpShape,
  AzureShape,
  NetworkShape,
} from './elements/diagram/shapes/shapeVariants';

// ─── Diagram themes ───────────────────────────────────────────────────────────
// Default presets (enterprise aesthetic)
export { enterpriseTheme, enterpriseLightTheme, defaultDiagramTheme, defaultLightDiagramTheme } from './elements/diagram/themes';
// Theme registry
export {
  registerDiagramThemePair,
  resolveDiagramTheme,
} from './elements/diagram/themes';
export type { DiagramThemePair } from './elements/diagram/themes';
// Theme composition helpers
export { mergeTheme, withColorMode } from './elements/diagram/themes/mergeTheme';
// Convenience hooks
export { useDiagramTheme } from './hooks/useDiagramTheme';

// ─── Compiler handler registration ──────────────────────────────────────────
// registerDiagramHandlers is called automatically via ./register.ts at module-load time.
