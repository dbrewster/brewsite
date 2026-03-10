// @brewsite/diagram — 3D immersive diagram and screen elements
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
export type { DiagramExitProps, DiagramEnterProps, GridLayoutProps, HierarchicalLayoutProps, ManualLayoutProps, FlowLayoutProps } from './elements/diagram/dsl';
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
export { diagramPlugin } from './player/diagramPlugin';
export type { DiagramPluginOptions } from './player/diagramPlugin';
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

// ─── ImagePanel element ─────────────────────────────────────────────────────
export type { ImagePanelState, ImagePanelDSL, ImagePanelBezelVariant } from './elements/image-panel/types';
export { ImagePanel } from './elements/image-panel/widget';
export { compileImagePanel, functionalImagePanelTransitionSpec } from './elements/image-panel/compile';
export { ImagePanelRenderer } from './elements/image-panel/render';
export { ImagePanelWidget } from './elements/image-panel/widget';

// ─── Screen element ─────────────────────────────────────────────────────────
export type { ScreenState, ScreenDSL, ScreenBezelVariant } from './elements/screen/types';
export { Screen } from './elements/screen/widget';
export { compileScreen, functionalScreenTransitionSpec } from './elements/screen/compile';
export { ScreenRenderer } from './elements/screen/render';
export { ScreenWidget } from './elements/screen/widget';

// ─── Theme presets ────────────────────────────────────────────────────────────
export { darkGlassTheme, neonCyberTheme, enterpriseTheme, lightMinimalTheme } from './elements/diagram/themes';
export { mergeTheme, withColorMode } from './elements/diagram/themes/mergeTheme';

// ─── Compiler handler registration ──────────────────────────────────────────
// registerDiagramHandlers is called automatically via ./register.ts at module-load time.
