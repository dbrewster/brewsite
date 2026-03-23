// Centralized reduced-motion detection for the website.

/**
 * Returns true if the user prefers reduced motion.
 * Reads from the `prefers-reduced-motion` media query.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
