// @brewsite/screens — Screen, MediaScreen, and ImagePanel elements for the BrewSite toolkit.
// Handler registration is NOT automatic — use screensPlugin() with EngineProvider.

// ─── Plugin ───────────────────────────────────────────────────────────────────
export { screensPlugin } from './plugin';

// ─── Screen element ───────────────────────────────────────────────────────────
export type { ScreenState, ScreenDSL, ScreenBezelVariant } from './elements/screen/types';
export type { ScreenProps } from './elements/screen/dsl';
export { Screen, ScreenWidget } from './elements/screen/widget';
export { compileScreen, functionalScreenTransitionSpec } from './elements/screen/compile';
export { ScreenRenderer } from './elements/screen/render';

// ─── MediaScreen element ──────────────────────────────────────────────────────
export type {
  MediaScreenState, MediaScreenDSL, MediaScreenBezelVariant, MediaScreenSourceKind,
} from './elements/media-screen/types';
export type { MediaScreenProps } from './elements/media-screen/dsl';
export { MediaScreen, MediaScreenWidget } from './elements/media-screen/widget';
export { compileMediaScreen, functionalMediaScreenTransitionSpec } from './elements/media-screen/compile';
export { MediaScreenRenderer } from './elements/media-screen/render';
export { captureCanvasStream, stopCaptureStream } from './elements/media-screen/streamUtils';

// ─── ImagePanel element ───────────────────────────────────────────────────────
export type { ImagePanelState, ImagePanelDSL, ImagePanelBezelVariant } from './elements/image-panel/types';
export type { ImagePanelProps } from './elements/image-panel/dsl';
export { ImagePanel, ImagePanelWidget } from './elements/image-panel/widget';
export { compileImagePanel, functionalImagePanelTransitionSpec } from './elements/image-panel/compile';
export { ImagePanelRenderer } from './elements/image-panel/render';

// ─── Hooks ────────────────────────────────────────────────────────────────────
export { useDisplayCapture } from './hooks/useDisplayCapture';
export type { UseDisplayCaptureOptions, UseDisplayCaptureResult } from './hooks/useDisplayCapture';
