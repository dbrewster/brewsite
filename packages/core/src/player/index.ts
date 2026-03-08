// ─── Composition Primitives ───────────────────────────────────────────────────
export { EngineProvider } from './EngineProvider';
export type { EngineProviderProps } from './EngineProvider';
export { EngineInputRegion } from './EngineInputRegion';
export type { EngineInputRegionProps } from './EngineInputRegion';
export { SceneCanvas } from './SceneCanvas';
export type { SceneCanvasProps } from './SceneCanvas';
export { EngineOverlayHost } from './EngineOverlayHost';
export type { EngineOverlayHostProps } from './EngineOverlayHost';
export { EngineARContainer } from './EngineARContainer';
export type { EngineARContainerProps, ScaleMode, ViewportScaleContextValue, EngineARContainerContextValue } from './EngineARContainer';
export { ViewportScaleContext, EngineARContainerContext } from './EngineARContainer';
export { computeContainerDims } from './EngineARContainer';
export { EngineGate } from './EngineGate';
export type { EngineGateProps } from './EngineGate';
export { ScrollCaptureSection } from './ScrollCaptureSection';
export type { ScrollCaptureSectionProps } from './ScrollCaptureSection';

// ─── Hooks ────────────────────────────────────────────────────────────────────
export { useSceneEngine } from './useSceneEngine';
export type { UseSceneEngineResult } from './useSceneEngine';
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

// ─── Dev Tools (move to @brewsite/core/devtools; deprecated here) ─────────────
/** @deprecated Import from `@brewsite/core/devtools` instead. Will be removed in v3. */
export { CameraControlPanel } from './CameraControlPanel';
/** @deprecated Import from `@brewsite/core/devtools` instead. Will be removed in v3. */
export { CameraInteractionInfoDialog } from './CameraInteractionInfoDialog';
/** @deprecated Import from `@brewsite/core/devtools` instead. Will be removed in v3. */
export { SceneInspector } from './SceneInspector';
export type { SceneInspectorProps } from './SceneInspector';
