// ScenePlayer — thin composition of EngineProvider + layout primitives.
// For the common full-page scroll case. Props are unchanged from before decomposition.

import { useCallback, useState, type ReactElement, type ReactNode } from 'react';
import type { WidgetRegistry } from '../widget/WidgetRegistry';
import type { WidgetPlugin } from '../widget/WidgetPlugin';
import { EngineProvider } from './EngineProvider';
import { EngineInputRegion } from './EngineInputRegion';
import { SceneCanvas } from './SceneCanvas';
import { EngineOverlayHost } from './EngineOverlayHost';
import { useSceneEngineContext } from './EngineContext';
// LabelItem moved to @brewsite/model in Phase 4 — labels rendered by modelPlugin
import { TimelineWidget } from './TimelineWidget';
import type { TimelineWidgetProps } from './TimelineWidgetTypes';
import { SceneInspector } from './SceneInspector';
import type { SceneNavInputMap } from '../input/types';
import type { CompileWarning } from '../compiler/sceneTrackTypes';

/** Minimal asset manifest type for backward compat. Full type lives in @brewsite/model. */
type AssetManifest = { version: number; models: unknown[]; animations: unknown[] };

export type ScenePlayerProps = {
  id?: string;
  manifestUrl: string;
  /**
   * Composable widget plugins. Each plugin contributes widgets and DSL handlers.
   * Use corePlugin() from @brewsite/core for built-in widgets, and modelPlugin()
   * from @brewsite/model for model and label support.
   *
   * When provided, `widgetSetup` is ignored.
   *
   * @example
   * plugins={[corePlugin(), modelPlugin({ manifestUrl: '/assets/manifest.json' })]}
   */
  plugins?: WidgetPlugin[];
  /**
   * Optional widget registry factory.
   *
   * When omitted, `createDefaultWidgetRegistry(manifest)` is used automatically.
   * When provided, this function is called only after the manifest has loaded
   * successfully — the `manifest` argument is guaranteed non-null.
   *
   * @deprecated Use `plugins` instead. Will be removed in the next major version.
   */
  widgetSetup?: (manifest: AssetManifest) => WidgetRegistry;
  className?: string;
  fpsCap?: number;
  /**
   * Pixels of scroll allocated per scene. Also described as "scroll depth" in docs.
   * Higher values = slower scroll-to-advance. Default: 800.
   */
  pixelsPerScene?: number;
  framesPerTick?: number;
  /**
   * Rendering quality preset. Controls pre-baked transition frame count (framesPerTick).
   *
   * | Preset        | framesPerTick | Use case                              |
   * |---------------|---------------|---------------------------------------|
   * | 'performance' | 30            | Low-power / battery-conscious devices |
   * | 'balanced'    | 60            | Most marketing pages                  |
   * | 'high'        | 120           | Maximum smoothness, larger memory     |
   *
   * When both `quality` and `framesPerTick` are present, `framesPerTick` wins.
   * When neither is set, the internal default (10 frames) is preserved for
   * backward compatibility with existing consumers.
   */
  quality?: 'performance' | 'balanced' | 'high';
  onReady?: () => void;
  onError?: (error: Error) => void;
  /** Called when the manifest fetch fails. The engine continues with default widgets. */
  onManifestError?: (error: Error) => void;
  /** Called when a single widget fails during load or apply. Engine continues rendering other widgets. */
  onWidgetError?: (widgetId: string, error: Error) => void;
  onCompileWarning?: (warnings: CompileWarning[]) => void;
  onSceneChange?: (sceneId: string, sceneIndex: number) => void;
  /**
   * @deprecated Use modelPlugin({ defaultModelStates }) from @brewsite/model instead.
   */
  defaultModelStates?: Partial<Record<string, Partial<Record<string, unknown>>>>;
  placeholder?: ReactNode;
  /** Input configuration for scene navigation. */
  inputMap?: SceneNavInputMap;
  /**
   * Whether to render the built-in timeline widget at the bottom.
   * Pass `true` for defaults, or a `TimelineWidgetProps` subset to configure it.
   */
  timeline?: boolean | Omit<TimelineWidgetProps, 'engine' | 'scenes'>;
  /**
   * When true, renders a `<SceneInspector>` overlay with scene list, progress
   * readouts, and click-to-jump navigation. Intended for development only.
   * Set via `debug={process.env.NODE_ENV === 'development'}` for automatic
   * removal in production builds.
   */
  debug?: boolean;
  /**
   * When provided, bypasses scroll-driven progress entirely. The engine reads
   * this value ([0, 1]) on every frame without touching `window.scrollY` or
   * `window.scrollTo`. Ideal for embedded players (e.g. inside a doc page)
   * where you control progress via buttons, RAF timers, or external state.
   *
   * The player renders with `height: 100%` when this prop is set, so the
   * containing element **must** have an explicit CSS height.
   *
   * Pair with `onControlledProgressChange` to keep UI controls in sync when
   * they call `engine.scrollToProgress()` internally.
   */
  controlledProgress?: number;
  /**
   * Called when the engine sets progress via `scrollToProgress` while
   * `controlledProgress` is active. Wire to the same state setter that feeds
   * `controlledProgress` to complete the controlled-component loop.
   */
  onControlledProgressChange?: (p: number) => void;
  /**
   * Scene content. Direct <Scene id="..."> elements and React components that
   * render <Scene> are both supported.
   */
  children: ReactNode;
};

// ─── ScenePlayerInner ─────────────────────────────────────────────────────────
// Internal component that reads engine context (must be a child of EngineProvider).

type ScenePlayerInnerProps = {
  loadError: Error | null;
  placeholder?: ReactNode;
  className?: string;
  controlledProgress?: number;
  timeline?: boolean | Omit<TimelineWidgetProps, 'engine' | 'scenes'>;
  debug?: boolean;
};

const ScenePlayerInner = (props: ScenePlayerInnerProps): ReactElement => {
  const engine = useSceneEngineContext();
  const isControlled = props.controlledProgress !== undefined;
  const isLoading = engine.frameState.tickIndex < 0;

  return (
    <div
      className={props.className}
      style={{ position: 'relative', ...(isControlled ? { height: '100%' } : {}) }}
    >
      {props.loadError && (
        <div role="alert">Scene engine error: {props.loadError.message}</div>
      )}
      {isLoading && props.placeholder && (
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          {props.placeholder}
        </div>
      )}
      <EngineInputRegion engine={engine} fillContainer={isControlled}>
        {/* Canvas fills the EngineInputRegion viewport */}
        <SceneCanvas
          style={{ width: '100%', height: '100%' }}
        />

        {/* Scene overlay content — HTML children from <Scene> */}
        <EngineOverlayHost passthroughPointerEvents={false} />

        {/* Optional built-in timeline scrubber */}
        {props.timeline && (
          <TimelineWidget
            engine={engine}
            scenes={engine.sceneIds.map((id) => ({ id }))}
            {...(typeof props.timeline === 'object' ? props.timeline : {})}
          />
        )}

        {/* Dev-mode inspector */}
        {props.debug && <SceneInspector sceneIds={engine.sceneIds} />}
      </EngineInputRegion>
    </div>
  );
};

// ─── ScenePlayer ──────────────────────────────────────────────────────────────

export const ScenePlayer = (props: ScenePlayerProps): ReactElement | null => {
  const [loadError, setLoadError] = useState<Error | null>(null);

  const handleError = useCallback((err: Error) => {
    setLoadError(err);
    props.onError?.(err);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.onError]);

  // Server-side rendering: return placeholder only.
  // EngineProvider renders children on the server for SSR layout purposes.
  // ScenePlayer uses a hard client-only guard since it owns the full layout.
  if (typeof window === 'undefined') {
    return (props.placeholder ?? null) as ReactElement | null;
  }

  return (
    <EngineProvider
      id={props.id}
      manifestUrl={props.manifestUrl}
      plugins={props.plugins}
      widgetSetup={props.widgetSetup}
      fpsCap={props.fpsCap}
      pixelsPerScene={props.pixelsPerScene}
      framesPerTick={props.framesPerTick}
      quality={props.quality}
      onReady={props.onReady}
      onError={handleError}
      onManifestError={props.onManifestError}
      onWidgetError={props.onWidgetError}
      onCompileWarning={props.onCompileWarning}
      onSceneChange={props.onSceneChange}
      defaultModelStates={props.defaultModelStates}
      inputMap={props.inputMap}
      controlledProgress={props.controlledProgress}
      onControlledProgressChange={props.onControlledProgressChange}
    >
      {/* Scene declarations — <Scene> components register via SceneRegistrationContext */}
      {props.children}

      {/* Layout and rendering — reads EngineContext set by EngineProvider */}
      <ScenePlayerInner
        loadError={loadError}
        placeholder={props.placeholder}
        className={props.className}
        controlledProgress={props.controlledProgress}
        timeline={props.timeline}
        debug={props.debug}
      />
    </EngineProvider>
  );
};
