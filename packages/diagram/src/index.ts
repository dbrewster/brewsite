// @brewsite/diagram — 3D immersive diagram and screen elements
// Full implementation: see requirements/plans/plan_diagram_package.md
import './register';

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
  DiagramEdgeFlow,
  DiagramGroupVariant,
  DiagramOrientation,
  DiagramPivot,
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
export { Diagram, DiagramNode, DiagramEdge, DiagramGroup, DiagramExit, DiagramEnter, GridLayout, HierarchicalLayout, ManualLayout, FlowLayout } from './elements/diagram/dsl';
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

// ─── Theme presets ────────────────────────────────────────────────────────────
export { darkGlassTheme, neonCyberTheme, enterpriseTheme, lightMinimalTheme } from './elements/diagram/themes';
export { mergeTheme, withColorMode } from './elements/diagram/themes/mergeTheme';
export { defaultDiagramCanvasInputActions } from './elements/diagram/canvas/defaultInputActions';

// ─── Compiler handler registration ──────────────────────────────────────────
// registerDiagramHandlers is called automatically via ./register.ts at module-load time.
