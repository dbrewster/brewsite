// Utilities for extracting JSX source-location data from React elements (dev-mode only).

import type { ReactElement } from 'react';
import type { DslBreadcrumb } from './sceneTrackTypes';

/**
 * The shape Babel's JSX transform attaches to props.__source in development builds.
 * Not part of the public React type system — accessed via runtime type guard.
 */
type BabelJsxSource = {
  fileName: string;
  lineNumber: number;
  columnNumber: number;
};

function isBabelJsxSource(value: unknown): value is BabelJsxSource {
  return (
    value !== null &&
    typeof value === 'object' &&
    typeof (value as Record<string, unknown>)['fileName'] === 'string' &&
    typeof (value as Record<string, unknown>)['lineNumber'] === 'number'
  );
}

/**
 * Extract the component name from a ReactElement's type, preferring displayName.
 */
export function getComponentName(element: ReactElement): string {
  const t = element.type;
  if (typeof t === 'string') return t;
  if (typeof t === 'function') {
    const fn = t as { displayName?: string; name?: string };
    return fn.displayName || fn.name || 'Anonymous';
  }
  return 'Unknown';
}

/**
 * Extract the raw key, stripping the '.$' prefix that Children.toArray adds.
 */
export function getElementKey(element: ReactElement): string | undefined {
  const k = element.key;
  if (k === null) return undefined;
  return k.startsWith('.$') ? k.slice(2) : k;
}

/**
 * Build a DslBreadcrumb for a ReactElement.
 * source is only populated in development builds where __source is injected.
 */
export function buildBreadcrumb(element: ReactElement): DslBreadcrumb {
  const props = element.props as Record<string, unknown>;
  const rawSource = props['__source'];
  const source = isBabelJsxSource(rawSource) ? rawSource : undefined;
  return {
    componentName: getComponentName(element),
    key: getElementKey(element),
    source,
  };
}

/**
 * Format a breadcrumb chain as a human-readable ancestry string.
 * Example: "Scene[bfm-hero] (scene_hero.tsx:7) > TextBox[bfm-hero-content] (scene_hero.tsx:13)"
 */
export function formatBreadcrumbChain(breadcrumbs: readonly DslBreadcrumb[]): string {
  return breadcrumbs
    .map((b) => {
      const id = b.key ? `[${b.key}]` : '';
      const loc = b.source
        ? ` (${b.source.fileName}:${b.source.lineNumber})`
        : '';
      return `${b.componentName}${id}${loc}`;
    })
    .join(' > ');
}

/**
 * Format a single source location for inline use in a warning message.
 * Returns '' when source is absent (production builds).
 */
export function formatSourceLocation(breadcrumb: DslBreadcrumb): string {
  if (!breadcrumb.source) return '';
  return ` at ${breadcrumb.source.fileName}:${breadcrumb.source.lineNumber}`;
}
