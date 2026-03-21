// packages/slides/src/player/SlidePlayer.tsx
// Primary SlidePlayer component. Renders inside a parent SceneEngine context.

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
  EngineOverlayHost,
  useSceneEngineContext,
  useVariable,
} from '@brewsite/core';
import type {
  SlideTheme,
  SlideTemplate,
  SlideTransition,
  ProgressStyle,
  SlideNavigationConfig,
  SlidePlayerHandle,
} from '../types';
import { resolveSlideConfig } from '../compiler/themeCompiler';
import { compileDeck, buildSceneElements } from '../compiler/deckCompiler';
import { resolveTemplate } from '../template/resolveTemplate';
import { SlideChromeLogo } from './SlideChromeLogo';
import { SlideChromeFooter } from './SlideChromeFooter';
import { SlideChromeWatermark } from './SlideChromeWatermark';
import { useSlideNavigation, computeSlideStartProgress } from './useSlideNavigation';
import { SlideProgressIndicator } from './SlideProgressIndicator';
import { Slide } from '../dsl';
import { SLIDE_META_NAMESPACE } from '../widget/SlideMetaWidget';

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
// EngineARContainer.

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
  onSlideChangeRef: MutableRefObject<((index: number, slideKey: string) => void) | undefined>;
  setCurrentSlideIndex: (index: number) => void;
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
  onSlideChangeRef,
  setCurrentSlideIndex,
}: SlidePlayerInnerProps): null => {
  const engine = useSceneEngineContext();
  const scrollUnits = useMemo(
    () => spec.slides.map((s) => s.scrollUnits),
    [spec.slides],
  );
  const nav = useSlideNavigation(spec.slides.length, scrollUnits);

  // Keep navRef in sync every render so the outer component reads fresh callbacks.
  navRef.current = nav;

  // VariableStore-based slide change detection
  const currentLogicalIndex = useVariable(SLIDE_META_NAMESPACE, 'currentLogicalIndex');
  const currentSlideKey = useVariable(SLIDE_META_NAMESPACE, 'currentSlideKey');

  useEffect(() => {
    if (typeof currentLogicalIndex !== 'number') return;
    if (typeof currentSlideKey !== 'string') return;
    onSlideChangeRef.current?.(currentLogicalIndex, currentSlideKey);
    setCurrentSlideIndex(currentLogicalIndex);
  }, [currentLogicalIndex, currentSlideKey, onSlideChangeRef, setCurrentSlideIndex]);

  // Expose imperative handle via the internal mutable ref.
  useImperativeHandle(imperativeRef, () => ({
    goTo: nav.goTo,
    next: nav.next,
    prev: nav.prev,
    captureSlideSnapshots: async (): Promise<Map<string, string>> => {
      const canvas = canvasRef.current;
      if (!canvas) return new Map();
      const result = new Map<string, string>();

      const savedProgress = engine.frameState.progress;

      for (let i = 0; i < spec.slides.length; i++) {
        const slide = spec.slides[i]!;
        const targetProgress = spec.slides.length > 1 ? i / (spec.slides.length - 1) : 0;
        engine.setProgress(targetProgress);
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        );
        result.set(slide.key, canvas.toDataURL('image/png'));
      }

      engine.setProgress(savedProgress);
      return result;
    },
  }), [nav, canvasRef, engine, spec.slides, scrollUnits]);

  // ─── Stable ref for nav callbacks ──────────────────────────────────────────
  const navCallbackRef = useRef(nav);
  navCallbackRef.current = nav;

  // Keyboard navigation
  useEffect(() => {
    if (navigation?.keyboard === false) return;
    const totalSlides = spec.slides.length;
    const handler = (e: KeyboardEvent): void => {
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

  // Touch swipe
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
      if (dx < 0) n.next();
      else n.prev();
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
  /** <Slide> elements authored with the slides DSL. */
  children: ReactNode;
  /** Presentation behavioral theme. Default: defaultSlideTheme. */
  slideTheme?: SlideTheme;
  /** Corporate chrome template (Phase 2). */
  template?: SlideTemplate;
  /** Default slide transition. Default: 'dissolve'. */
  transition?: SlideTransition;
  /** Progress indicator style. Default: 'dots'. */
  progressIndicator?: ProgressStyle;
  /** Canvas aspect ratio. Default: 16/9. */
  aspectRatio?: number;
  /**
   * How the deck fits within the display. Default: 'contain'.
   *
   * NOTE: This default intentionally differs from EngineARContainer's own
   * default of 'fit-width'. Presentations use 'contain' because slide
   * content should never be cropped — letterboxing/pillarboxing is the
   * industry-standard behavior for fixed-aspect-ratio presentation decks.
   */
  scaleMode?: 'contain' | 'cover' | 'fit-width' | 'fit-height';
  /**
   * Reference width for content scaling. Default: 1920.
   * Content authored at this pixel width scales proportionally to all
   * displays via the --scene-scale CSS variable.
   */
  referenceWidth?: number;
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
 * Must be rendered inside a `<SceneEngine>` context — does not create its own engine.
 * Visual tokens come from SceneTheme via the parent engine. Behavioral tokens come
 * from SlideTheme via `--slide-*` CSS variables injected on the container.
 *
 * @example
 * ```tsx
 * <SceneEngine plugins={[corePlugin(), slidesPlugin()]}>
 *   <SlidePlayer>
 *     <Slide key="intro"><TitleSlide title="Hello" /></Slide>
 *     <Slide key="body"><ContentSlide title="Content"><Body>...</Body></ContentSlide></Slide>
 *   </SlidePlayer>
 * </SceneEngine>
 * ```
 */
export const SlidePlayer = forwardRef<SlidePlayerHandle, SlidePlayerProps>(
  function SlidePlayer(
    {
      children,
      slideTheme,
      template,
      transition: transitionProp,
      progressIndicator: progressIndicatorProp,
      aspectRatio = 16 / 9,
      scaleMode = 'contain',
      referenceWidth = 1920,
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
    // Apply template defaults, then fall back to hard defaults
    const transition = transitionProp ?? template?.defaultTransition ?? 'dissolve';
    const progressIndicator = progressIndicatorProp ?? template?.defaultProgressIndicator ?? 'dots';
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const imperativeRef = useRef<SlidePlayerHandle | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const navRef = useRef<SlideNavRef | null>(null);

    const onSlideChangeRef = useRef(onSlideChange);
    onSlideChangeRef.current = onSlideChange;

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

    // F key fullscreen toggle
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

    // Resolve SlideTheme → CSS vars
    const resolvedConfig = useMemo(
      () => resolveSlideConfig(slideTheme),
      [slideTheme],
    );

    // Resolve SlideTemplate → CSS vars + master chrome config
    const resolvedTemplate = useMemo(
      () => resolveTemplate(template),
      [template],
    );

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
      () => compileDeck(slideElements, transition),
      [slideElements, transition],
    );

    // Build Scene elements from spec.
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

    // Expose the imperative handle via the forwarded ref.
    useImperativeHandle(ref, () => ({
      goTo: (i) => imperativeRef.current?.goTo(i),
      next: () => imperativeRef.current?.next(),
      prev: () => imperativeRef.current?.prev(),
      captureSlideSnapshots: () =>
        imperativeRef.current?.captureSlideSnapshots() ??
        Promise.resolve(new Map()),
    }));

    // Inject --slide-* CSS custom properties on the container
    const cssVarStyle = {
      ...resolvedConfig.cssVars,
      ...(resolvedTemplate?.cssVars ?? {}),
    } as CSSProperties;

    // Derive current slide layout for template exclusion rules
    const currentSlideLayout = spec.slides[currentSlideIndex]?.layout;

    const containerStyle: CSSProperties = effectiveFullscreen
      ? { position: 'fixed', inset: 0, zIndex: 9999, ...cssVarStyle }
      : { position: 'relative', width: '100%', height: '100%', ...cssVarStyle, ...style };

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

    // Stable setCurrentSlideIndex for SlidePlayerInner
    const stableSetCurrentSlideIndex = useCallback((index: number) => {
      setCurrentSlideIndex(index);
    }, []);

    return (
      <div ref={containerRef} className={className} style={containerStyle}>
        {/* Scene elements injected directly — SceneEngine context comes from parent */}
        {sceneElements}

        <EngineARContainer aspectRatio={aspectRatio} scaleMode={scaleMode} referenceWidth={referenceWidth}>
          <BackgroundLayer style={{ position: 'absolute', inset: 0, zIndex: 0 }} />
          <SceneCanvas ref={canvasRef} style={{ position: 'absolute', inset: 0, zIndex: 1 }} />
          <EngineOverlayHost
            passthroughPointerEvents
            overlayTransition={
              transition === 'cut'
                ? { enabled: false }
                : { enabled: true, durationMs: 200 }
            }
          />
          <SlidePlayerInner
            spec={spec}
            canvasRef={canvasRef}
            imperativeRef={imperativeRef}
            navRef={navRef}
            navigation={navigation}
            onSlideChangeRef={onSlideChangeRef}
            setCurrentSlideIndex={stableSetCurrentSlideIndex}
          />
          {resolvedTemplate?.template.master?.logo && (
            <SlideChromeLogo
              template={resolvedTemplate.template}
              currentLayout={currentSlideLayout}
            />
          )}
          {resolvedTemplate?.template.master?.footer && (
            <SlideChromeFooter
              template={resolvedTemplate.template}
              currentIndex={currentSlideIndex}
              totalSlides={spec.slides.length}
              currentLayout={currentSlideLayout}
            />
          )}
          {resolvedTemplate?.template.master?.watermark && (
            <SlideChromeWatermark template={resolvedTemplate.template} />
          )}
        </EngineARContainer>

        {/* Navigation UI outside EngineARContainer */}
        {navigation?.pointer !== false && (
          <div
            aria-hidden
            style={{ position: 'absolute', inset: 0, zIndex: 30, cursor: 'pointer' }}
            onClick={handlePointerNext}
            onContextMenu={handlePointerPrev}
          />
        )}

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
