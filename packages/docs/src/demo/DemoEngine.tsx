// EngineProvider wrapper for docs demos — integrates with DemoCaptureContext.

import React, {
  useContext,
  useEffect,
  useId,
  type ReactElement,
  type ReactNode,
} from 'react';
import {
  EngineProvider,
  type EngineProviderProps,
  useSceneEngineContext,
  InputController,
  Scene as SceneDsl,
} from '@brewsite/core';
import { DemoCaptureContext } from './DemoCaptureContext';

/**
 * Props for DemoEngine.
 *
 * Accepts all EngineProvider props except:
 * - `id` — assigned automatically via useId()
 * - `scrollHeightPx` — irrelevant; demos use direct setRawProgress
 *
 * Every other EngineProvider prop (plugins, quality, manifestUrl, sceneTheme, etc.)
 * is forwarded directly.
 *
 * **Do NOT include `<EngineInputRegion>` or `<EngineScrollRegion>` in demo children.**
 * DemoEngine manages progress via wheel capture from the parent DocsDemo.
 * Including these components would conflict with the wheel-capture model.
 */
export type DemoEngineProps = Omit<EngineProviderProps, 'id' | 'scrollHeightPx' | 'children'> & {
  children?: ReactNode;
};

/**
 * Injects an empty <InputController> into the first <Scene> child.
 *
 * This is required to force the engine into "direct" input mode, where
 * progress is managed via setRawProgress rather than window.scrollY.
 * Without this injection, the engine creates a tall scroll spacer and calls
 * window.scrollTo() on every progress update, which hijacks the docs page scroll.
 *
 * `inputModePolicy="prefer-direct"` alone is NOT sufficient — it only returns
 * "direct" when hasSceneInputController is true (useSceneEngine.ts). The
 * InputController injection is what actually satisfies that condition.
 */
function injectDirectMode(children: ReactNode): ReactNode {
  let injected = false;
  return React.Children.map(children, (child) => {
    if (
      !injected &&
      React.isValidElement(child) &&
      (child as React.ReactElement).type === (SceneDsl as React.ComponentType)
    ) {
      injected = true;
      const el = child as React.ReactElement<{ children?: ReactNode }>;
      const existing = el.props.children;
      const existingArray = existing
        ? Array.isArray(existing) ? existing : [existing]
        : [];
      return React.cloneElement(el, undefined, ...existingArray, <InputController key="__dm_direct__" />);
    }
    return child;
  });
}

/**
 * Inner component rendered inside EngineProvider.
 * Reads useSceneEngineContext() and registers setRawProgress with DemoCaptureContext.
 * Renders null — no DOM output.
 */
function DemoEngineRegistrar(): null {
  const { setRawProgress } = useSceneEngineContext();
  const captureCtx = useContext(DemoCaptureContext);

  useEffect(() => {
    if (!captureCtx) return;
    const cleanup = captureCtx.registerEngine(setRawProgress);
    return cleanup;
  }, [captureCtx, setRawProgress]);

  return null;
}

/**
 * Drop-in EngineProvider for docs demos.
 *
 * Usage:
 * ```tsx
 * export function MyDemo() {
 *   return (
 *     <DemoEngine plugins={[corePlugin()]} manifestUrl="/scene-manifest.json">
 *       <Scene id="s1">...</Scene>
 *       <SceneCanvas style={{ width: '100%', height: '100%' }} />
 *       <EngineOverlayHost />
 *     </DemoEngine>
 *   );
 * }
 * ```
 *
 * Place MyDemo inside <DocsDemo scrollUnits={2400} height={480}>:
 * ```tsx
 * <DocsDemo scrollUnits={2400} height={480}>
 *   <MyDemo />
 * </DocsDemo>
 * ```
 *
 * Progress is driven by wheel scroll over the DocsDemo region.
 * DemoEngine automatically injects <InputController> into the first <Scene>
 * child to force the engine into direct mode (no scroll spacer, no
 * window.scrollY mapping). Do NOT add <EngineInputRegion> or <EngineScrollRegion>
 * to demo children — they conflict with the wheel-capture model.
 */
export function DemoEngine({ children, ...rest }: DemoEngineProps): ReactElement {
  // Stable auto-generated id. Stable across re-renders; unique per demo instance.
  const autoId = useId();

  // Inject <InputController> into the first <Scene> to force direct mode.
  // See injectDirectMode() for why this is required over inputModePolicy alone.
  const directModeChildren = injectDirectMode(children);

  return (
    <EngineProvider {...rest} id={autoId}>
      {directModeChildren}
      {/* DemoEngineRegistrar must be inside EngineProvider to read its context. */}
      <DemoEngineRegistrar />
    </EngineProvider>
  );
}
