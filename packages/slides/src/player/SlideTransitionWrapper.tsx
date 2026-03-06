// packages/slides/src/player/SlideTransitionWrapper.tsx
// CSS transition class wrapper for slide content transitions.
// Applies CSS class names based on the SlideTransition variant.

import React, { type CSSProperties, type ReactElement, type ReactNode } from 'react';
import type { SlideTransition } from '../types';

/** Props for SlideTransitionWrapper. */
export type SlideTransitionWrapperProps = {
  /**
   * Transition type. Controls which CSS class is applied to the wrapper.
   * 'dissolve' → slide-transition--dissolve
   * 'none'     → no transition class applied
   */
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
  if (transition === 'none') return '';
  const base = `slide-transition--${transition}`;
  return active ? `${base} ${base}--active` : base;
}

/**
 * Wraps slide content with a div that carries CSS transition class names.
 * Authors apply animation via CSS targeting `.slide-transition--dissolve` etc.
 *
 * The v1.0 SlideTransition type supports 'dissolve' and 'none'.
 * When v1.1 extends the type, this component handles new variants automatically
 * because the class name is derived from the transition string.
 */
export const SlideTransitionWrapper = ({
  transition,
  active = false,
  children,
  style,
  className,
}: SlideTransitionWrapperProps): ReactElement => {
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
