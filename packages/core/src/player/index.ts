// ─── Composition Primitives ───────────────────────────────────────────────────
export { EngineProvider } from './EngineProvider';
export type { EngineProviderProps } from './EngineProvider';
export { EngineInputRegion } from './EngineInputRegion';
export type { EngineInputRegionProps } from './EngineInputRegion';
export { SceneCanvas } from './SceneCanvas';
export type { SceneCanvasProps } from './SceneCanvas';
export { EngineOverlayHost } from './EngineOverlayHost';
export type { EngineOverlayHostProps } from './EngineOverlayHost';
export { EngineGate } from './EngineGate';
export type { EngineGateProps } from './EngineGate';
export { ScrollCaptureSection } from './ScrollCaptureSection';
export type { ScrollCaptureSectionProps } from './ScrollCaptureSection';

// ─── Hooks ────────────────────────────────────────────────────────────────────
export { useSceneEngine } from './useSceneEngine';
export { useEngineScroll } from './useEngineScroll';
export type { UseEngineScrollOptions, UseEngineScrollResult } from './useEngineScroll';
export { useEngineInput } from './useEngineInput';
export type { UseEngineInputOptions, UseEngineInputResult } from './useEngineInput';
export { useEngineScrubber } from './useEngineScrubber';
export type { UseEngineScrubberOptions, UseEngineScrubberResult } from './useEngineScrubber';
export { useSceneProgress } from './useSceneProgress';
export { useCurrentScene } from './useCurrentScene';
export { useSceneRuntime } from './useSceneRuntime';
export type { SceneRuntimeState } from './ScenePlayerRegistry';
export { useEngineState } from './EngineStateContext';
export { useSceneEngineState } from './useSceneEngineState';
export type { SceneEngineSnapshot } from './ScenePlayerRegistry';
export { EngineContext, useSceneEngineContext } from './EngineContext';

// ─── Plugin System ────────────────────────────────────────────────────────────
export { corePlugin } from './plugins';
export type { CorePluginOptions } from './plugins';

// ─── Types ────────────────────────────────────────────────────────────────────
export type { EngineFrameState, EngineState } from './engineTypes';

// ─── UI Components (stable public API) ────────────────────────────────────────
// TimelineWidget is consumer-facing product surface — not a dev tool.
export { TimelineWidget } from './TimelineWidget';
export type { TimelineWidgetProps, TimelineTickStyle, TimelineTheme } from './TimelineWidgetTypes';

// ─── Dev Tools (unstable; not part of the public API contract) ────────────────
// These exist for development and debugging. They are exported but not stable.
export { CameraControlPanel } from './CameraControlPanel';
export { CameraInteractionInfoDialog } from './CameraInteractionInfoDialog';
export { SceneInspector } from './SceneInspector';
export type { SceneInspectorProps } from './SceneInspector';
