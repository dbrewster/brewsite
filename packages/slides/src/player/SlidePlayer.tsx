// packages/slides/src/player/SlidePlayer.tsx
// Primary SlidePlayer component. Assembles SceneEngine + full slide stack.

import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  Children,
  isValidElement,
  type CSSProperties,
  type MutableRefObject,
  type ReactElement,
  type ReactNode,
  type RefObject,
} from 'react';
import {
  BackgroundLayer,
  EngineARContainer,
  SceneCanvas,
  SceneEngine,
  EngineOverlayHost,
  corePlugin,
  useSceneEngineContext,
  useVariable,
  // NOTE: VariableStoreContext is NOT exported from @brewsite/core.
  // Use the useVariable hook for reactive VariableStore reads.
} from '@brewsite/core';
import type { WidgetPlugin } from '@brewsite/core';
import type {
  DeckTheme,
  ProgressStyle,
  SlideNavigationConfig,
  SlidePlayerHandle,
} from '../types';
import { compileDeckTheme } from '../compiler/themeCompiler';
import { compileDeck, buildSceneElements } from '../compiler/deckCompiler';
import { slidesPlugin } from '../plugin';
import { useSlideNavigation, computeSlideStartProgress } from './useSlideNavigation';
import { SlideProgressIndicator } from './SlideProgressIndicator';
import { Slide } from '../dsl';
import { SLIDE_META_NAMESPACE } from '../widget/SlideMetaWidget';

// ─── Constants ────────────────────────────────────────────────────────────────

// ─── SlideContentWithProgress ─────────────────────────────────────────────────

/**
 * Wraps body content and injects `visibleCount` into `BulletList`/`NumberedList`
 * children when `animateEntrance=true`.
 *
 * CRITICAL DESIGN NOTE: This component reads `sceneProgress` via `useVariable` at render
 * time — it does NOT accept sceneProgress as a prop. If it accepted a prop, the value
 * would be frozen at the time `buildSceneElements` runs (compile time), and animated
 * bullets would never advance past their initial state.
 *
 * The correct re-render chain:
 *   SlideMetaWidget.apply() → writes sceneProgress to VariableStore
 *   → EngineOverlayHost re-renders (subscribed to VariableStore changes)
 *   → SlideContentWithProgress re-renders as a child, reads fresh sceneProgress
 *   → visibleCount updates → bullets reveal correctly
 *
 * This component is stored as a static ReactElement in TextBox's childrenMap.
 * React renders it fresh on every EngineOverlayHost re-render, giving it access
 * to the current VariableStore state via context.
 */
export const SlideContentWithProgress = ({
  slideKey,
  totalBullets,
  children,
}: {
  /** The slide's stable key — used to look up sceneProgress in VariableStore. */
  slideKey: string;
  totalBullets: number;
  children: ReactNode;
}): ReactElement => {
  // Read sceneProgress reactively via useVariable (exported from @brewsite/core).
  // useVariable subscribes to VariableStore updates and triggers re-renders when
  // the value changes. This is the correct reactive read pattern.
  // VariableStoreContext is NOT exported from @brewsite/core — do not use useContext.
  const rawProgress = useVariable(SLIDE_META_NAMESPACE, `${slideKey}.sceneProgress`);
  const progress = typeof rawProgress === 'number' ? rawProgress : 0;

  const visibleCount =
    totalBullets > 0 ? Math.ceil(progress * totalBullets) : undefined;

  const injected =
    visibleCount !== undefined
      ? Children.map(children, (child) => {
          if (!isValidElement(child)) return child;
          const el = child as ReactElement<Record<string, unknown>>;
          const displayName = (el.type as { displayName?: string }).displayName;
          if (displayName === 'BulletList' || displayName === 'NumberedList') {
            if (el.props['animateEntrance'] === true) {
              return React.cloneElement(el, { visibleCount });
            }
          }
          return child;
        })
      : children;

  return <>{injected}</>;
};
SlideContentWithProgress.displayName = 'SlideContentWithProgress';

// ─── SlidePlayerInner ─────────────────────────────────────────────────────────
// Separated so it can use hooks (must be inside SceneEngine).
// Renders NO DOM — all visual output (pointer overlay, progress indicator) is
// rendered by the outer SlidePlayer at the containerRef level, outside the
// EngineARContainer. This ensures click targets cover the full player area
// (including letterbox) rather than being trapped inside the AR-locked inner div.

/**
 * Navigation state exposed to the outer SlidePlayer via a mutable ref.
 * Updated by SlidePlayerInner on every render so the outer component's
 * pointer overlay and progress indicator always use fresh callbacks.
 */
export type SlideNavRef = {
  current: number;
  total: number;
  goTo: (index: number) => void;
  next: () => void;
  prev: () => void;
};

type SlidePlayerInnerProps = {
  spec: ReturnType<typeof compileDeck>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  imperativeRef: MutableRefObject<SlidePlayerHandle | null>;
  navRef: MutableRefObject<SlideNavRef | null>;
  navigation?: SlideNavigationConfig;
};

/**
 * Inner component rendered inside `SceneEngine`. Attaches keyboard and touch
 * navigation handlers via window listeners. Exposes navigation state to the
 * outer SlidePlayer via `navRef` and `imperativeRef`.
 *
 * Renders null — all visible navigation UI lives in the outer SlidePlayer
 * where it can cover the full player container, not just the AR-locked box.
 */
const SlidePlayerInner = ({
  spec,
  canvasRef,
  imperativeRef,
  navRef,
  navigation,
}: SlidePlayerInnerProps): null => {
  const engine = useSceneEngineContext();
  const scrollUnits = useMemo(
    () => spec.slides.map((s) => s.scrollUnits),
    [spec.slides],
  );
  const nav = useSlideNavigation(spec.slides.length, scrollUnits);

  // Keep navRef in sync every render so the outer component reads fresh callbacks.
  navRef.current = nav;

  // Expose imperative handle via the internal mutable ref.
  // SlidePlayer (outer) delegates to this via the forwarded ref.
  useImperativeHandle(imperativeRef, () => ({
    goTo: nav.goTo,
    next: nav.next,
    prev: nav.prev,
    captureSlideSnapshots: async (): Promise<Map<string, string>> => {
      const canvas = canvasRef.current;
      if (!canvas) return new Map();
      const result = new Map<string, string>();

      // Save current progress.
      const savedProgress = engine.frameState.progress;

      for (let i = 0; i < spec.slides.length; i++) {
        const slide = spec.slides[i]!;
        // Engine-space: scene i starts at i/(n-1). This is the uniform progress value
        // that matches SceneTrack's engineStart per scene (see sceneTrackCompiler.ts §298).
        // setProgress() takes post-mapper engine-space — do NOT use computeSlideStartProgress
        // here, which returns scroll-space and would navigate to the wrong slide for
        // non-uniform scroll budgets (e.g. title=100 + body=400).
        const targetProgress = spec.slides.length > 1 ? i / (spec.slides.length - 1) : 0;
        engine.setProgress(targetProgress);
        // Wait two rAF cycles for Three.js to render the new frame.
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        );
        result.set(slide.key, canvas.toDataURL('image/png'));
      }

      engine.setProgress(savedProgress);
      return result;
    },
  }), [nav, canvasRef, engine, spec.slides, scrollUnits]);

  // Slide-change notification is handled by corePlugin({ onSceneChange }) — NOT here.
  // Using both corePlugin.onSceneChange and a useEffect would fire the callback twice
  // per slide change. The corePlugin path is the sole owner of onSlideChange dispatch.

  // ─── Stable ref for nav callbacks ──────────────────────────────────────────
  // The nav object changes reference on every sceneIndex change (because next/prev
  // are useCallback with [engine, sceneIndex, totalSlides] deps). Using a ref avoids
  // tearing down and re-registering window event listeners on every slide change.
  // The handler reads navRef.current at call time — always fresh, zero listener churn.
  const navCallbackRef = useRef(nav);
  navCallbackRef.current = nav;

  // Keyboard navigation — registered once on mount (stable handler via ref).
  // Bindings: ArrowRight/ArrowDown/Space/Enter/PageDown → next;
  //           ArrowLeft/ArrowUp/PageUp → prev; Home → first slide; End → last slide.
  // F-key fullscreen is handled in the outer SlidePlayer component.
  useEffect(() => {
    if (navigation?.keyboard === false) return;
    const totalSlides = spec.slides.length;
    const handler = (e: KeyboardEvent): void => {
      // Skip navigation keys when a form element has focus (e.g. toolbar <select>).
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'SELECT' || tag === 'INPUT' || tag === 'TEXTAREA') return;

      const n = navCallbackRef.current;
      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowDown':
        case ' ':
        case 'Enter':
        case 'PageDown':
          e.preventDefault();
          n.next();
          break;
        case 'ArrowLeft':
        case 'ArrowUp':
        case 'PageUp':
          e.preventDefault();
          n.prev();
          break;
        case 'Home':
          e.preventDefault();
          n.goTo(0);
          break;
        case 'End':
          e.preventDefault();
          n.goTo(totalSlides - 1);
          break;
        default:
          break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [navigation, spec.slides.length]);

  // Touch swipe: track touchstart X, fire next/prev on touchend based on delta.
  useEffect(() => {
    if (navigation?.touch === false) return;
    let startX = 0;
    const MIN_SWIPE_PX = 40;
    const onTouchStart = (e: TouchEvent): void => {
      startX = e.touches[0]?.clientX ?? 0;
    };
    const onTouchEnd = (e: TouchEvent): void => {
      const dx = (e.changedTouches[0]?.clientX ?? 0) - startX;
      if (Math.abs(dx) < MIN_SWIPE_PX) return;
      const n = navCallbackRef.current;
      if (dx < 0) n.next(); // swipe left → next
      else n.prev(); // swipe right → prev
    };
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, [navigation]);

  return null;
};

// ─── SlidePlayer Props ────────────────────────────────────────────────────────

/**
 * Props for the `<SlidePlayer>` component.
 */
export type SlidePlayerProps = {
  /** `<Slide>` elements authored with the slides DSL. */
  children: ReactNode;
  /** Deck-level theme. Merged with `defaultDeckTheme`. */
  theme?: Partial<DeckTheme>;
  /** Default slide transition. Default: 'dissolve'. */
  transition?: 'dissolve' | 'none';
  /** Progress indicator style. Default: 'dots'. */
  progressIndicator?: ProgressStyle;
  /** Optional engine ID for `useSceneEngineState(id)`. */
  id?: string;
  /** Additional plugins (e.g. `diagramPlugin()`, `modelPlugin()`). */
  plugins?: WidgetPlugin[];
  /** Canvas aspect ratio. Default: 16/9. */
  aspectRatio?: number;
  /** Navigation configuration. */
  navigation?: SlideNavigationConfig;
  /** Force fullscreen mode (controlled). */
  fullscreen?: boolean;
  /** Uncontrolled default fullscreen state. */
  defaultFullscreen?: boolean;
  /** Called when fullscreen state changes. */
  onFullscreenChange?: (isFullscreen: boolean) => void;
  /** Called when the active slide changes. */
  onSlideChange?: (index: number, slideKey: string) => void;
  className?: string;
  style?: CSSProperties;
};

// ─── SlidePlayer ─────────────────────────────────────────────────────────────

/**
 * Primary slide deck player component.
 *
 * Owns the full engine stack: `SceneEngine` → `EngineARContainer` →
 * `EngineInputRegion` → `SceneCanvas` + `EngineOverlayHost`.
 *
 * @example
 * ```tsx
 * <SlidePlayer theme={darkDeckTheme}>
 *   <Slide key="intro"><TitleLayout title="Hello" /></Slide>
 *   <Slide key="body"><TitleBodyLayout title="Content"><Body>...</Body></TitleBodyLayout></Slide>
 * </SlidePlayer>
 * ```
 */
// Stable empty array for the default plugins prop — avoids creating a new []
// on every render, which would cascade to widgetRegistry/driver rebuilds.
const EMPTY_PLUGINS: WidgetPlugin[] = [];

export const SlidePlayer = forwardRef<SlidePlayerHandle, SlidePlayerProps>(
  function SlidePlayer(
    {
      children,
      theme,
      transition = 'dissolve',
      progressIndicator = 'dots',
      id,
      plugins = EMPTY_PLUGINS,
      aspectRatio = 16 / 9,
      navigation,
      fullscreen,
      defaultFullscreen = false,
      onFullscreenChange,
      onSlideChange,
      className,
      style,
    }: SlidePlayerProps,
    ref,
  ) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    // Internal ref for imperative handle; populated by SlidePlayerInner.
    const imperativeRef = useRef<SlidePlayerHandle | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    // Navigation state ref — written by SlidePlayerInner every render, read by
    // the pointer overlay and progress indicator rendered here in the outer component.
    const navRef = useRef<SlideNavRef | null>(null);

    // Stable refs for callbacks and config objects — prevents the allPlugins memo
    // and SceneEngine props from recomputing when the caller passes unstable
    // (inline arrow / inline object) values. Read via ref at call time.
    const onSlideChangeRef = useRef(onSlideChange);
    onSlideChangeRef.current = onSlideChange;

    const navigationRef = useRef(navigation);
    navigationRef.current = navigation;

    // Current slide index — driven by corePlugin.onSceneChange so the progress
    // indicator (rendered at the container level, outside SceneEngine) re-renders
    // whenever the active slide changes.
    const [currentSlideIndex, setCurrentSlideIndex] = useState(0);

    // Fullscreen state
    const [isFullscreen, setIsFullscreen] = useState(defaultFullscreen);
    const effectiveFullscreen =
      fullscreen !== undefined ? fullscreen : isFullscreen;

    const toggleFullscreen = useCallback(() => {
      const el = containerRef.current;
      if (!el) return;
      if (!document.fullscreenElement) {
        el.requestFullscreen().then(() => {
          setIsFullscreen(true);
          onFullscreenChange?.(true);
        }).catch(() => {});
      } else {
        document.exitFullscreen().then(() => {
          setIsFullscreen(false);
          onFullscreenChange?.(false);
        }).catch(() => {});
      }
    }, [onFullscreenChange]);

    // F key fullscreen toggle — always window-scoped regardless of navigation.scope.
    // Slide navigation keys (arrows, space, etc.) are handled inside SlidePlayerInner
    // which has access to the engine context. The F-key handler is here because
    // toggleFullscreen references containerRef which is only in this scope.
    useEffect(() => {
      if (navigation?.keyboard === false) return;
      const handler = (e: KeyboardEvent): void => {
        if (e.key === 'f' || e.key === 'F') {
          e.preventDefault();
          toggleFullscreen();
        }
      };
      window.addEventListener('keydown', handler);
      return () => window.removeEventListener('keydown', handler);
    }, [toggleFullscreen, navigation]);

    // Compile theme once per theme prop change
    const resolvedTheme = useMemo(() => compileDeckTheme(theme), [theme]);

    // Collect and validate <Slide> children
    const slideElements = useMemo(() => {
      const slides: ReactElement<Record<string, unknown>>[] = [];
      Children.forEach(children, (child) => {
        if (isValidElement(child) && child.type === Slide) {
          slides.push(child as ReactElement<Record<string, unknown>>);
        }
      });
      return slides;
    }, [children]);

    // Compile DeckSpec once per children change
    const spec = useMemo(
      () => compileDeck(slideElements, resolvedTheme, transition),
      [slideElements, resolvedTheme, transition],
    );

    // Build Scene elements from spec.
    // buildSceneElements is pure — it produces STATIC JSX with no runtime state dependency.
    // SlideContentWithProgress inside the JSX reads sceneProgress via useVariable
    // at render time, so animated bullet reveals work without recompiling the SceneTrack.
    const sceneElements = useMemo(
      () =>
        buildSceneElements(
          slideElements,
          spec,
          (slideKey, totalBullets, content) => (
            <SlideContentWithProgress
              slideKey={slideKey}
              totalBullets={totalBullets}
            >
              {content}
            </SlideContentWithProgress>
          ),
        ),
      [slideElements, spec],
    );

    // Build plugin array.
    // onSlideChange is wired through corePlugin({ onSceneChange }) — the single source
    // of slide-change notification. Using both corePlugin.onSceneChange AND a useEffect
    // inside SlidePlayerInner would fire the callback twice per scene change. Only
    // corePlugin is used; SlidePlayerInner has NO useEffect for onSlideChange.
    // Note: corePlugin's onSceneChange receives (sceneId: string, sceneIndex: number);
    // SlidePlayer's onSlideChange contract is (index: number, slideKey: string).
    const allPlugins = useMemo(
      () => [
        corePlugin({
          onSceneChange: (sceneId, sceneIndex) => {
            setCurrentSlideIndex(sceneIndex);
            onSlideChangeRef.current?.(sceneIndex, sceneId);
          },
        }),
        slidesPlugin({ theme: resolvedTheme, navigation: navigationRef.current }),
        ...plugins,
      ],
      // onSlideChange and navigation excluded — read via refs to avoid plugin/registry
      // rebuild when the caller passes unstable (inline arrow / inline object) values.
      [resolvedTheme, plugins], // eslint-disable-line react-hooks/exhaustive-deps
    );

    // Expose the imperative handle via the forwarded ref.
    // SlidePlayerInner populates imperativeRef via its own useImperativeHandle.
    useImperativeHandle(ref, () => ({
      goTo: (i) => imperativeRef.current?.goTo(i),
      next: () => imperativeRef.current?.next(),
      prev: () => imperativeRef.current?.prev(),
      captureSlideSnapshots: () =>
        imperativeRef.current?.captureSlideSnapshots() ??
        Promise.resolve(new Map()),
    }));

    // Inject --slide-* CSS custom properties and --brewsite-accent-color so that
    // slide content (TextBox children) can consume them via var(). Custom properties
    // are inherited — applying them here makes them available to all descendants
    // including EngineOverlayHost's overlay divs.
    // NOTE: EngineOverlayHost only injects --brewsite-font-family, --brewsite-font-size-*,
    // etc. It does NOT inject --slide-* or --brewsite-accent-color; that is done here.
    const cssVarStyle = {
      ...resolvedTheme.cssVars,
      '--brewsite-accent-color': resolvedTheme.accentColor,
    } as CSSProperties;

    const containerStyle: CSSProperties = effectiveFullscreen
      ? {
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          background: resolvedTheme.background.color,
          ...cssVarStyle,
        }
      : { position: 'relative', width: '100%', height: '100%', ...cssVarStyle, ...style };

    // ─── Navigation adapter for outer UI ──────────────────────────────────────
    // The progress indicator and pointer overlay live at the containerRef level
    // (outside EngineARContainer) so they cover the full player area including
    // letterbox. They read navigation state via navRef (written by SlidePlayerInner)
    // and are re-rendered via onSlideChange which triggers a state update in the
    // demo page. For the standalone case (no onSlideChange), the outer component
    // uses the imperative ref which always returns fresh nav callbacks.

    /** Stable error handler — avoids inline arrow in JSX which causes SceneEngine re-render. */
    const handleEngineError = useCallback((err: Error) => {
      console.error('[SlidePlayer] Engine error:', err);
    }, []);

    /** Stable click handler — reads navRef at call time, never stale. */
    const handlePointerNext = useCallback(() => {
      navRef.current?.next();
    }, []);

    const handlePointerPrev = useCallback((e: React.MouseEvent) => {
      e.preventDefault();
      navRef.current?.prev();
    }, []);

    const handleProgressGoTo = useCallback((index: number) => {
      navRef.current?.goTo(index);
    }, []);

    return (
      <div ref={containerRef} className={className} style={containerStyle}>
        <SceneEngine
          id={id}
          plugins={allPlugins}
          sceneTheme={resolvedTheme.sceneTheme}
          defaultTransitionDuration={400}
          onError={handleEngineError}
        >
          {/* Inject <Slide>→<Scene> expanded children into the engine's scene registration */}
          {sceneElements}

          <EngineARContainer aspectRatio={aspectRatio} scaleMode="contain">
            {/*
             * BackgroundLayer is required for <Background color> DSL to take effect.
             * BackgroundWidget.apply() is a no-op when no DOM element is wired.
             * The WebGL renderer uses alpha:true + setClearColor(0,0) = transparent canvas,
             * so without BackgroundLayer the slide area is completely transparent.
             * (SceneReel includes this internally; SlidePlayer must add it explicitly.)
             */}
            <BackgroundLayer style={{ position: 'absolute', inset: 0, zIndex: 0 }} />
            {/* SceneCanvas uses forwardRef<HTMLCanvasElement> — prop is `ref`, NOT `canvasRef`. */}
            <SceneCanvas ref={canvasRef} style={{ position: 'absolute', inset: 0, zIndex: 1 }} />
            <EngineOverlayHost
              passthroughPointerEvents
              overlayTransition={
                transition === 'none'
                  ? { enabled: false }
                  : { enabled: true, durationMs: 200 }
              }
            />
            {/* Inner component uses hooks — must be inside SceneEngine.
              * Renders null — all visible navigation UI is below, at the container level. */}
            <SlidePlayerInner
              spec={spec}
              canvasRef={canvasRef}
              imperativeRef={imperativeRef}
              navRef={navRef}
              navigation={navigation}
            />
          </EngineARContainer>
        </SceneEngine>

        {/*
         * Navigation UI rendered OUTSIDE EngineARContainer so it covers the
         * full player container (including letterbox area in contain mode).
         * z-index 30 puts these above the AR container's children (canvas z:1,
         * overlay host z:10, etc.).
         */}

        {/* Pointer navigation overlay: click → next, right-click → prev. */}
        {navigation?.pointer !== false && (
          <div
            aria-hidden
            style={{ position: 'absolute', inset: 0, zIndex: 30, cursor: 'pointer' }}
            onClick={handlePointerNext}
            onContextMenu={handlePointerPrev}
          />
        )}

        {/* Progress indicator (dots / bar / numbers).
          * Uses currentSlideIndex state (driven by corePlugin.onSceneChange)
          * so it re-renders on every slide change. */}
        <SlideProgressIndicator
          nav={{
            current: currentSlideIndex,
            total: spec.slides.length,
            goTo: handleProgressGoTo,
            next: handlePointerNext,
            prev: () => navRef.current?.prev(),
          }}
          style={progressIndicator}
        />
      </div>
    );
  },
);
SlidePlayer.displayName = 'SlidePlayer';
