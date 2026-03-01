/**
 * Evaluated once at module load time (browser SPA — window is always available).
 * Use this constant to branch on mobile-specific camera positions, PAIR_COUNT,
 * mirror resolution, diagram scale, etc.
 */
export const isMobile: boolean =
  typeof window !== 'undefined' && window.innerWidth < 768;
