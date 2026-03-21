// Pure function: SlideTemplate → resolved template with CSS vars + master elements.

import type { SlideTemplate } from '../types';

/** Resolved template output containing the original template and computed CSS variables. */
export type ResolvedTemplate = {
  readonly template: SlideTemplate;
  readonly cssVars: Record<string, string>;
};

/**
 * Resolves a SlideTemplate into CSS custom properties for master slide chrome.
 * Returns undefined when no template is provided.
 */
export function resolveTemplate(template?: SlideTemplate): ResolvedTemplate | undefined {
  if (!template) return undefined;

  const cssVars: Record<string, string> = {};

  // Footer height
  if (template.master?.footer) {
    cssVars['--slide-footer-height'] = '32px';
  } else {
    cssVars['--slide-footer-height'] = '0px';
  }

  // Logo size
  if (template.master?.logo) {
    cssVars['--slide-logo-size'] = template.master.logo.size ?? '40px';
  } else {
    cssVars['--slide-logo-size'] = '0px';
  }

  // Watermark opacity
  if (template.master?.watermark) {
    cssVars['--slide-watermark-opacity'] = String(template.master.watermark.opacity ?? 0.05);
  } else {
    cssVars['--slide-watermark-opacity'] = '0';
  }

  return { template, cssVars };
}
