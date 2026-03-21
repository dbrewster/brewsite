// packages/slides/src/player/SlideTransitionWrapper.tsx
// CSS transition class wrapper for slide content transitions.
// Applies CSS class names based on the SlideTransition variant.

import React, { type CSSProperties, type ReactElement, type ReactNode } from 'react';
import type { SlideTransition } from '../types';

/** Props for SlideTransitionWrapper. */
export type SlideTransitionWrapperProps = {
  /** Transition type. Controls which CSS class is applied to the wrapper. */
  transition: SlideTransition;
  /**
   * When true, appends the '--active' modifier class to indicate the
   * entering/active phase of the transition.
   * Default: false.
   */
  active?: boolean;
  children: ReactNode;
  style?: CSSProperties;
  className?: string;
};

/**
 * Returns the CSS class name for the given transition type and active state.
 * Pure function — exported for testing.
 */
export function resolveTransitionClass(transition: SlideTransition, active: boolean): string {
  if (transition === 'cut') return '';
  // 'fade' is an alias for 'dissolve'
  const effectiveTransition = transition === 'fade' ? 'dissolve' : transition;
  const base = `slide-transition--${effectiveTransition}`;
  return active ? `${base} ${base}--active` : base;
}

/** Injects CSS keyframes for all transition types once per document lifecycle. */
let _transitionKeyframesInjected = false;
function injectTransitionKeyframes(): void {
  if (_transitionKeyframesInjected || typeof document === 'undefined') return;
  _transitionKeyframesInjected = true;
  const style = document.createElement('style');
  style.textContent = `
    .slide-transition--dissolve { opacity: 0; transition: opacity var(--slide-transition-duration, 300ms) ease; }
    .slide-transition--dissolve--active { opacity: 1; }

    .slide-transition--push-left { transform: translateX(100%); transition: transform var(--slide-transition-duration, 300ms) ease; }
    .slide-transition--push-left--active { transform: translateX(0); }

    .slide-transition--push-right { transform: translateX(-100%); transition: transform var(--slide-transition-duration, 300ms) ease; }
    .slide-transition--push-right--active { transform: translateX(0); }

    .slide-transition--push-up { transform: translateY(100%); transition: transform var(--slide-transition-duration, 300ms) ease; }
    .slide-transition--push-up--active { transform: translateY(0); }

    .slide-transition--push-down { transform: translateY(-100%); transition: transform var(--slide-transition-duration, 300ms) ease; }
    .slide-transition--push-down--active { transform: translateY(0); }

    .slide-transition--zoom-in { transform: scale(0.8); opacity: 0; transition: transform var(--slide-transition-duration, 300ms) ease, opacity var(--slide-transition-duration, 300ms) ease; }
    .slide-transition--zoom-in--active { transform: scale(1); opacity: 1; }

    .slide-transition--zoom-out { transform: scale(1.2); opacity: 0; transition: transform var(--slide-transition-duration, 300ms) ease, opacity var(--slide-transition-duration, 300ms) ease; }
    .slide-transition--zoom-out--active { transform: scale(1); opacity: 1; }
  `;
  document.head.appendChild(style);
}

/**
 * Wraps slide content with a div that carries CSS transition class names.
 * Transition keyframe styles are injected once into the document head.
 */
export const SlideTransitionWrapper = ({
  transition,
  active = false,
  children,
  style,
  className,
}: SlideTransitionWrapperProps): ReactElement => {
  // Inject keyframes on first render (no-op in SSR / node environment)
  injectTransitionKeyframes();

  const transitionClass = resolveTransitionClass(transition, active);
  const combinedClass = [transitionClass, className].filter(Boolean).join(' ') || undefined;

  return (
    <div
      className={combinedClass}
      data-transition={transition}
      style={style}
    >
      {children}
    </div>
  );
};
SlideTransitionWrapper.displayName = 'SlideTransitionWrapper';
