// ─── Core Engine ──────────────────────────────────────────────────────────────
export { SceneEngine } from './SceneEngine';
export type { SceneEngineProps } from './SceneEngine';

// ─── Layout Components ────────────────────────────────────────────────────────
export { SceneCanvas } from './SceneCanvas';
export type { SceneCanvasProps } from './SceneCanvas';
export { ScrollStage } from './ScrollStage';
export type { ScrollStageHandle, ScrollStageProps, ScrollStageSnapshot } from './ScrollStage';
export { BackgroundLayer } from './BackgroundLayer';
export type { BackgroundLayerProps } from './BackgroundLayer';
export { SceneReel } from './SceneReel';
export type { SceneReelProps } from './SceneReel';

// ─── Input Components ─────────────────────────────────────────────────────────
export { InputCoordinator } from './InputCoordinator';
export type { InputCoordinatorProps } from './InputCoordinator';
export { CustomScrollSource, ElementScrollSource } from './StageScrollSources';
export type { ElementScrollSourceProps } from './StageScrollSources';
export { TimeInput } from './TimeInput';
export type { TimeInputProps } from './TimeInput';
export { ControlledInput } from './ControlledInput';
export type { ControlledInputProps } from './ControlledInput';

// ─── Scroll Source ────────────────────────────────────────────────────────────
export type { IScrollSource, ScrollSourceProp } from './scrollSourceTypes';
export { useNativeScrollSource } from './useNativeScrollSource';
export type {
  UseNativeScrollSourceOptions,
  UseNativeScrollSourceResult,
} from './useNativeScrollSource';

// ─── Unchanged Components ─────────────────────────────────────────────────────
export { EngineOverlayHost } from './EngineOverlayHost';
export type { EngineOverlayHostProps } from './EngineOverlayHost';
export { EngineARContainer, ViewportScaleContainer } from './EngineARContainer';
export type {
  EngineARContainerProps, ViewportScaleContainerProps,
  ScaleMode, ViewportScaleContextValue,
} from './EngineARContainer';
export { ViewportScaleContext } from './EngineARContainer';
export { computeContainerDims } from './EngineARContainer';
export { EngineGate } from './EngineGate';
export type { EngineGateProps } from './EngineGate';

// ─── Hooks ────────────────────────────────────────────────────────────────────
export { useSceneEngine } from './useSceneEngine';
export type { UseSceneEngineResult } from './useSceneEngine';
export { useEngineState } from './useEngineState';
export { useEngineScrubber } from './useEngineScrubber';
export type { UseEngineScrubberResult } from './useEngineScrubber';
export { useSceneProgress } from './useSceneProgress';
export { useCurrentScene } from './useCurrentScene';
export { useSceneRuntime } from './useSceneRuntime';
export type { SceneRuntimeState } from './ScenePlayerRegistry';
export { useSceneEngineContext, EngineContext } from './EngineContext';
export { useGoToScene } from './useGoToScene';

// ─── Plugin System ────────────────────────────────────────────────────────────
export { corePlugin } from './plugins';
export type { CorePluginOptions } from './plugins';

// ─── Types ────────────────────────────────────────────────────────────────────
export type { ActiveTheme } from '../theme/types';
export type { EngineFrameState } from './engineTypes';
export type { SceneTrack, SceneTrackTick, SceneFrame } from '../compiler/sceneTrackTypes';
export type { EngineTimingProfile, InternalSceneSpec } from './engineTypes';
// Types only — consumers need ViewportRelativeScrollSource to type their refs when
// constructing scrollSource={{ kind: 'viewport-relative', containerRef, canvasRef }}.
// The hook (useViewportRelativeScroll) is an internal implementation detail of
// SceneEngine and is NOT exported. Consumers must not call it directly.
export type { ViewportRelativeScrollSource, EngineInternalScrollSource, ScrollSource } from './engineTypes';
export type { SceneEngineSnapshot } from './ScenePlayerRegistry';

// ─── InputHud ─────────────────────────────────────────────────────────────────
export { InputHud } from '../hud/InputHud';
export type { InputHudProps } from '../hud/InputHud';
export type { InputHudHint, InputHudState } from '../hud/inputHudTypes';

// ─── Transition Easing ────────────────────────────────────────────────────────
export type { TransitionEasing } from '../input/transitionAnimator';

// ─── UI Components (stable public API) ────────────────────────────────────────
export { TimelineWidget } from './TimelineWidget';
export type { TimelineWidgetProps, TimelineTickStyle, TimelineTheme } from './TimelineWidgetTypes';


// ─── SpotlightRig Element ─────────────────────────────────────────────────────
export { SpotlightRig, Spotlight, SpotlightRigWidget } from '../elements/spotlight-rig';
export type {
  SpotlightRigProps, SpotlightProps,
  SpotlightRigPreset, SpotlightRigState, SpotlightLightState,
  OrbitFn,
} from '../elements/spotlight-rig';
export {
  DEFAULT_SPOTLIGHT_RIG_THEME, DEFAULT_SPOTLIGHT_RIG_STATE,
  moviePremierePreset, moviePremiereTheme,
  concertStagePreset, concertStageTheme,
} from '../elements/spotlight-rig';

// ─── REMOVED from v1 (not re-exported, not shim-exported): ───────────────────
// SceneEngine (was EngineProvider), EngineInputRegion, ScrollCaptureSection
// useEngineScroll, useEngineInput, UseEngineScrollOptions, UseEngineInputOptions
// InputModePolicy, ScrollSource
// useSceneEngineState (replaced by useEngineState(id))
