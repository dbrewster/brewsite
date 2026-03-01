import React, { JSX, ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import {
  InputController,
  Scene as SceneDsl,
  ScenePlayer,
  useEngineState,
  useSceneEngineContext,
  type ScenePlayerProps,
} from '@brewsite/core';
import { createDemoWidgetSetup } from './demoSetup';

interface DemoSceneProps {
  children: ReactNode;
  sceneCount: number;
  height?: number;
  sceneDuration?: number;
  manifestUrl?: string;
  widgetSetup?: NonNullable<ScenePlayerProps['widgetSetup']>;
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
      engine.scrollToProgress(elapsed / totalDuration);
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
  }, [autoPlay, engine, totalDuration]);

  const nextScene = (): void => {
    setAutoPlay(false);
    const next = Math.min(1, Math.round((state.progress + stepSize) / stepSize) * stepSize);
    engine.scrollToProgress(next);
  };

  const prevScene = (): void => {
    setAutoPlay(false);
    const next = Math.max(0, Math.round((state.progress - stepSize) / stepSize) * stepSize);
    engine.scrollToProgress(next);
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
            engine.scrollToProgress(Number(event.target.value));
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

/**
 * Injects an empty <InputController> into the first <Scene> child.
 *
 * This forces ScenePlayer into "direct" input mode — engine progress is managed
 * as React state rather than being mapped to window.scrollY. Without this, the
 * engine creates a tall scroll spacer and calls window.scrollTo() on every
 * progress update, which hijacks the page scroll.
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

export function DemoScene({
  children,
  sceneCount,
  height = 420,
  sceneDuration = 2500,
  manifestUrl = '/scene-manifest.json',
  widgetSetup,
}: DemoSceneProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [autoPlay, setAutoPlay] = useState(false);

  // Auto-play when scrolled into view (suppressed if prefers-reduced-motion)
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

  // Force direct mode so page scroll is never touched
  const directModeChildren = injectDirectMode(children);

  return (
    <div className="demo-scene" ref={containerRef} style={{ height }}>
      <ScenePlayer
        manifestUrl={manifestUrl}
        widgetSetup={widgetSetup ?? createDemoWidgetSetup()}
      >
        {directModeChildren}
        <DemoSceneControls
          sceneCount={sceneCount}
          sceneDuration={sceneDuration}
          autoPlay={autoPlay}
          setAutoPlay={setAutoPlay}
        />
      </ScenePlayer>
    </div>
  );
}
