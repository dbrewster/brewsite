import {
  EngineProvider,
  EngineInputRegion,
  SceneCanvas,
  useEngineState,
  useSceneEngineContext,
  type WidgetPlugin,
} from '@brewsite/core';
import { JSX, ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { createDemoWidgetSetup } from './demoSetup';

interface DemoSceneProps {
  children: ReactNode;
  sceneCount: number;
  height?: number;
  sceneDuration?: number;
  manifestUrl?: string;
  plugins?: WidgetPlugin[];
}

const prefersReducedMotion =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function DemoSceneControls({
  sceneCount,
  sceneDuration,
  autoPlay,
  setAutoPlay,
}: {
  sceneCount: number;
  sceneDuration: number;
  autoPlay: boolean;
  setAutoPlay: (next: boolean) => void;
}): JSX.Element {
  const engine = useSceneEngineContext();
  const state = useEngineState();
  const rafRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);

  const stepSize = useMemo(() => 1 / Math.max(1, sceneCount), [sceneCount]);
  const totalDuration = useMemo(() => Math.max(1, sceneCount) * sceneDuration, [sceneCount, sceneDuration]);

  // engine.scrollToProgress is a stable useCallback in every mode (scroll,
  // direct, controlled). Extract it so the auto-play effect depends on the
  // stable function identity, NOT on the engine object — which is recreated
  // on every render in controlled mode (progress changes → re-render →
  // new engine object → effect resets startTimeRef → scene jumps to 0).
  const { scrollToProgress } = engine;

  useEffect(() => {
    if (!autoPlay) {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      return;
    }

    const tick = (ts: number): void => {
      if (startTimeRef.current === 0) {
        startTimeRef.current = ts;
      }
      const elapsed = (ts - startTimeRef.current) % totalDuration;
      scrollToProgress(elapsed / totalDuration);
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
      rafRef.current = null;
      startTimeRef.current = 0;
    };
  }, [autoPlay, scrollToProgress, totalDuration]);

  const nextScene = (): void => {
    setAutoPlay(false);
    const next = Math.min(1, Math.round((state.progress + stepSize) / stepSize) * stepSize);
    scrollToProgress(next);
  };

  const prevScene = (): void => {
    setAutoPlay(false);
    const next = Math.max(0, Math.round((state.progress - stepSize) / stepSize) * stepSize);
    scrollToProgress(next);
  };

  const currentScene = Math.min(sceneCount, Math.floor(state.progress * Math.max(1, sceneCount)) + 1);

  return (
    <div className="demo-scene__controls">
      <button className="demo-btn" type="button" onClick={prevScene} disabled={state.progress <= 0}>
        ◀
      </button>
      <button className="demo-btn" type="button" onClick={nextScene} disabled={state.progress >= 0.999}>
        ▶
      </button>
      <button
        className={`demo-btn${autoPlay ? ' demo-btn--active' : ''}`}
        type="button"
        onClick={() => {
          startTimeRef.current = 0;
          setAutoPlay(!autoPlay);
        }}
        title={autoPlay ? 'Pause auto-play' : 'Start auto-play'}
      >
        {autoPlay ? '⏸' : '▶▶'}
      </button>
      <div className="demo-progress">
        <input
          type="range"
          min={0}
          max={1}
          step={0.001}
          value={state.progress}
          onChange={(event) => {
            setAutoPlay(false);
            scrollToProgress(Number(event.target.value));
          }}
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
  manifestUrl = '/scene-manifest.json',
  plugins,
}: DemoSceneProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [autoPlay, setAutoPlay] = useState(false);
  // Controlled progress (0–1) drives the engine directly without touching
  // window.scrollY or window.scrollTo, so the page can scroll freely.
  const [progress, setProgress] = useState(0);

  // IMPORTANT: resolvedPlugins must be a stable reference. DemoScene re-renders
  // on every progress tick (setProgress is called each RAF frame). If
  // plugins were recreated inline, EngineProvider's widgetRegistry useMemo
  // would fire every frame, disposing and recreating the Three.js driver 60×/s.
  const resolvedPlugins = useMemo(
    () => plugins ?? createDemoWidgetSetup(),
    // plugins is expected to be stable at the call site; createDemoWidgetSetup
    // has no args so calling it once is safe. Re-memoize only if the prop changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [plugins],
  );

  useEffect(() => {
    if (prefersReducedMotion || !containerRef.current) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        setAutoPlay(entry.isIntersecting);
      },
      { threshold: 0.4 },
    );

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    // overflow: hidden keeps the player canvas clipped to the declared
    // height even during brief layout transitions.
    <div className="demo-scene" ref={containerRef} style={{ height, overflow: 'hidden' }}>
      <EngineProvider
        manifestUrl={manifestUrl}
        plugins={resolvedPlugins}
        controlledProgress={progress}
        onControlledProgressChange={setProgress}
      >
        {children}
        <EngineInputRegion fillContainer>
          <SceneCanvas style={{ width: '100%', height: '100%' }} />
          <DemoSceneControls
            sceneCount={sceneCount}
            sceneDuration={sceneDuration}
            autoPlay={autoPlay}
            setAutoPlay={setAutoPlay}
          />
        </EngineInputRegion>
      </EngineProvider>
    </div>
  );
}
