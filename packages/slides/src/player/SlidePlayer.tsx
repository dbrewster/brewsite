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

type SlidePlayerInnerProps = {
  spec: ReturnType<typeof compileDeck>;
  progressIndicator: ProgressStyle;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  imperativeRef: MutableRefObject<SlidePlayerHandle | null>;
  navigation?: SlideNavigationConfig;
};

/**
 * Inner component rendered inside `SceneEngine`. Attaches keyboard, pointer,
 * and touch navigation handlers. Exposes the imperative handle via `imperativeRef`.
 */
const SlidePlayerInner = ({
  spec,
  progressIndicator,
  canvasRef,
  imperativeRef,
  navigation,
}: SlidePlayerInnerProps): ReactElement => {
  const engine = useSceneEngineContext();
  const scrollUnits = useMemo(
    () => spec.slides.map((s) => s.scrollUnits),
    [spec.slides],
  );
  const nav = useSlideNavigation(spec.slides.length, scrollUnits);

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
        // Compute exact start progress using cumulative scrollUnits (not i/(n-1),
        // which is wrong for non-uniform budgets like title=100, body=400).
        const targetProgress = computeSlideStartProgress(scrollUnits, i);
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

  // Keyboard navigation — scope-aware: 'window' (default) or 'canvas' (containerRef).
  // Bindings: ArrowRight/ArrowDown/Space/Enter/PageDown → next;
  //           ArrowLeft/ArrowUp/PageUp → prev; Home → first slide; End → last slide.
  // F-key fullscreen is handled in the outer SlidePlayer component.
  useEffect(() => {
    if (navigation?.keyboard === false) return;
    const handler = (e: KeyboardEvent): void => {
      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowDown':
        case ' ':
        case 'Enter':
        case 'PageDown':
          e.preventDefault();
          nav.next();
          break;
        case 'ArrowLeft':
        case 'ArrowUp':
        case 'PageUp':
          e.preventDefault();
          nav.prev();
          break;
        case 'Home':
          e.preventDefault();
          nav.goTo(0);
          break;
        case 'End':
          e.preventDefault();
          nav.goTo(spec.slides.length - 1);
          break;
        default:
          break;
      }
    };
    // scope='canvas' attaches to the EngineInputRegion container div.
    // In v1.0, containerRef is NOT forwarded into SlidePlayerInner; scope='canvas'
    // falls back to window. The full scoped implementation is a v1.1 enhancement.
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [nav, navigation, spec.slides.length]);

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
      if (dx < 0) nav.next(); // swipe left → next
      else nav.prev(); // swipe right → prev
    };
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, [nav, navigation]);

  return (
    <>
      <SlideProgressIndicator nav={nav} style={progressIndicator} />
      {/*
       * Pointer navigation overlay: click → next, right-click → prev.
       * Rendered as a full-size transparent div layered above the EngineOverlayHost
       * (z-index: 11 vs overlay host's z-index: 10) but below the progress
       * indicator (z-index: 20). Only rendered when pointer navigation is not
       * explicitly disabled.
       *
       * EngineOverlayHost is set to passthroughPointerEvents so TextBox content
       * does not block click events. The pointer overlay captures all remaining
       * pointer interactions for slide navigation.
       */}
      {navigation?.pointer !== false && (
        <div
          aria-hidden
          style={{ position: 'absolute', inset: 0, zIndex: 11, cursor: 'pointer' }}
          onClick={() => nav.next()}
          onContextMenu={(e) => {
            e.preventDefault();
            nav.prev();
          }}
        />
      )}
    </>
  );
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
export const SlidePlayer = forwardRef<SlidePlayerHandle, SlidePlayerProps>(
  function SlidePlayer(
    {
      children,
      theme,
      transition = 'dissolve',
      progressIndicator = 'dots',
      id,
      plugins = [],
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
          onSceneChange: onSlideChange
            ? (sceneId, sceneIndex) => onSlideChange(sceneIndex, sceneId)
            : undefined,
        }),
        slidesPlugin({ theme: resolvedTheme, navigation }),
        ...plugins,
      ],
      [resolvedTheme, navigation, plugins, onSlideChange],
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

    const containerStyle: CSSProperties = effectiveFullscreen
      ? {
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          background: resolvedTheme.background.color,
        }
      : { position: 'relative', width: '100%', ...style };

    return (
      <div ref={containerRef} className={className} style={containerStyle}>
        <SceneEngine
          id={id}
          plugins={allPlugins}
          sceneTheme={resolvedTheme.sceneTheme}
        >
          {/* Inject <Slide>→<Scene> expanded children into the engine's scene registration */}
          {sceneElements}

          <EngineARContainer aspectRatio={aspectRatio} scaleMode="fit-width">
            {/* SceneCanvas uses forwardRef<HTMLCanvasElement> — prop is `ref`, NOT `canvasRef`. */}
            <SceneCanvas ref={canvasRef} />
            <EngineOverlayHost
              passthroughPointerEvents
              overlayTransition={
                transition === 'none'
                  ? { enabled: false }
                  : { enabled: true, durationMs: 200 }
              }
            />
            {/* Inner component uses hooks — must be inside SceneEngine */}
            <SlidePlayerInner
              spec={spec}
              progressIndicator={progressIndicator}
              canvasRef={canvasRef}
              imperativeRef={imperativeRef}
              navigation={navigation}
            />
          </EngineARContainer>
        </SceneEngine>
      </div>
    );
  },
);
SlidePlayer.displayName = 'SlidePlayer';
