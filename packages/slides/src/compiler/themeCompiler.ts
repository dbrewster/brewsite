// Pure function: SlideTheme → ResolvedSlideConfig. No React, no Three.js.

import type { SlideTheme, ResolvedSlideConfig } from '../types';
import { defaultSlideTheme } from '../theme';

/**
 * Resolves a SlideTheme (with potential missing fields) into a
 * ResolvedSlideConfig with all fields filled and CSS variables computed.
 *
 * Pure function — same inputs always produce the same output.
 */
export function resolveSlideConfig(
  slideTheme?: Partial<SlideTheme>,
): ResolvedSlideConfig {
  const resolved: Required<SlideTheme> = {
    timing: { ...defaultSlideTheme.timing, ...slideTheme?.timing },
    density: { ...defaultSlideTheme.density, ...slideTheme?.density },
    typography: { ...defaultSlideTheme.typography, ...slideTheme?.typography },
    components: { ...defaultSlideTheme.components, ...slideTheme?.components },
  };

  const cssVars: Record<string, string> = {
    // Timing
    '--slide-transition-duration':       resolved.timing.transitionDuration,
    '--slide-entrance-duration':         String(resolved.timing.entranceDuration),
    '--slide-entrance-distance':         resolved.timing.entranceDistance,
    '--slide-stagger-delay':             String(resolved.timing.staggerDelay),
    '--slide-count-up-duration':         String(resolved.timing.countUpDuration),
    // Density
    '--slide-content-padding':           resolved.density.contentPadding,
    '--slide-content-gap':               resolved.density.contentGap,
    '--slide-title-height':              String(resolved.density.titleHeight),
    '--slide-gutter':                    String(resolved.density.gutter),
    // Typography scale
    '--slide-heading-scale':             String(resolved.typography.headingScale),
    '--slide-body-scale':                String(resolved.typography.bodyScale),
    '--slide-caption-scale':             String(resolved.typography.captionScale),
    // Component sizing
    '--slide-card-border-width':         resolved.components.cardBorderWidth,
    '--slide-timeline-connector-width':  resolved.components.timelineConnectorWidth,
    '--slide-timeline-dot-size':         resolved.components.timelineDotSize,
    '--slide-progress-ring-size':        resolved.components.progressRingSize,
    '--slide-progress-ring-thickness':   resolved.components.progressRingThickness,
  };

  return { slideTheme: resolved, cssVars };
}
