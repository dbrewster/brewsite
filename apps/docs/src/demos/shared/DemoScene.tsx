import {
  SceneEmbed,
  useEngineState,
  useEngineScrubber,
  type WidgetPlugin,
} from '@brewsite/core';
import { type JSX, type ReactNode, useMemo } from 'react';
import { createDemoWidgetSetup } from './demoSetup';

interface DemoSceneProps {
  children: ReactNode;
  sceneCount: number;
  height?: number;
  sceneDuration?: number;
  plugins?: WidgetPlugin[];
}

/**
 * DemoSceneControls — prev/next/scrubber overlay.
 * Must be rendered inside SceneEmbed (requires engine context).
 */
function DemoSceneControls({
  sceneCount,
}: {
  sceneCount: number;
}): JSX.Element {
  const state = useEngineState();
  const { setProgress } = useEngineScrubber();

  const stepSize = 1 / Math.max(1, sceneCount);
  const currentScene = Math.min(
    sceneCount,
    Math.floor(state.progress * Math.max(1, sceneCount)) + 1,
  );

  const nextScene = (): void => {
    const next = Math.min(1, Math.round((state.progress + stepSize) / stepSize) * stepSize);
    setProgress(next);
  };

  const prevScene = (): void => {
    const next = Math.max(0, Math.round((state.progress - stepSize) / stepSize) * stepSize);
    setProgress(next);
  };

  return (
    <div className="demo-scene__controls">
      <button className="demo-btn" type="button" onClick={prevScene} disabled={state.progress <= 0}>
        ◀
      </button>
      <button className="demo-btn" type="button" onClick={nextScene} disabled={state.progress >= 0.999}>
        ▶
      </button>
      <div className="demo-progress">
        <input
          type="range"
          min={0}
          max={1}
          step={0.001}
          value={state.progress}
          onChange={(event) => setProgress(Number(event.target.value))}
          aria-label="Demo progress"
        />
      </div>
      <span className="demo-scene-label">
        {currentScene} / {Math.max(1, sceneCount)}
      </span>
    </div>
  );
}

export function DemoScene({
  children,
  sceneCount,
  height = 420,
  sceneDuration = 2500,
  plugins,
}: DemoSceneProps): JSX.Element {
  const totalDuration = Math.max(1, sceneCount) * (sceneDuration / 1000);
  const resolvedPlugins = useMemo(
    () => plugins ?? createDemoWidgetSetup(),
    [plugins],
  );

  return (
    <div className="demo-scene" style={{ height, overflow: 'hidden' }}>
      <SceneEmbed
        height={height}
        plugins={resolvedPlugins}
        autoPlay={{ duration: totalDuration, loop: true }}
        visibility="autopause"
      >
        {children}
        <DemoSceneControls sceneCount={sceneCount} />
      </SceneEmbed>
    </div>
  );
}
