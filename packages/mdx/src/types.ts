// Public type contracts for the @brewsite/mdx package.

import type { ComponentType, ReactNode } from 'react';
import type { WidgetPlugin, ActiveTheme } from '@brewsite/core';

/**
 * Entry in a hierarchical table-of-contents extracted from MDX headings.
 * h2s are top-level entries, h3s nest under the preceding h2, and so on.
 */
export interface TocEntry {
  /** Heading level (1-6). */
  depth: number;
  /** Text content of the heading. */
  text: string;
  /** Slugified id for anchor linking. */
  id: string;
  /** Nested child headings. */
  children: TocEntry[];
}

/**
 * Internal flat heading representation collected by the remark plugin
 * before nesting is applied.
 */
export interface FlatHeading {
  /** Heading level (1-6). */
  depth: number;
  /** Text content of the heading. */
  text: string;
  /** Slugified id for anchor linking. */
  id: string;
}

/**
 * Result of the useMdxCompile hook.
 * Provides the compiled React component, extraction results, and status.
 */
export interface UseMdxCompileResult {
  /** The compiled React component, or null while compiling. */
  Content: ComponentType<{ components?: Record<string, ComponentType> }> | null;
  /** Compilation error, if any. */
  error: Error | null;
  /** Whether compilation is in progress. */
  isCompiling: boolean;
  /** Extracted frontmatter (empty object if none). */
  frontmatter: Record<string, unknown>;
  /** Extracted heading TOC. */
  toc: TocEntry[];
}

/**
 * Options for the useMdxFetch hook.
 */
export interface UseMdxFetchOptions {
  /** Fetch options (headers, credentials, etc.). */
  fetchOptions?: RequestInit;
  /** Revalidate when this key changes. */
  revalidateKey?: string | number;
}

/**
 * Result of the useMdxFetch hook.
 * Extends UseMdxCompileResult with fetch-specific status fields.
 */
export interface UseMdxFetchResult extends UseMdxCompileResult {
  /** Whether the fetch is in progress (before compilation starts). */
  isFetching: boolean;
  /** Fetch error (network, 404, etc.), separate from compilation error. */
  fetchError: Error | null;
}

/**
 * Props for the main BrewSiteMdx component.
 */
export interface BrewSiteMdxProps {
  /**
   * MDX source string as children. Can contain JSX (SceneEmbed, Diagram, etc.),
   * standard markdown, GFM tables, and YAML frontmatter.
   *
   * ```tsx
   * <BrewSiteMdx plugins={plugins}>{mdxString}</BrewSiteMdx>
   * ```
   */
  children: string;

  /**
   * WidgetPlugin array for all SceneEmbed instances in the content.
   * Injected automatically -- MDX authors don't pass plugins to SceneEmbed.
   */
  plugins?: WidgetPlugin[];

  /**
   * Active theme for all SceneEmbed instances in the content.
   */
  theme?: ActiveTheme;

  /**
   * Additional React components available to MDX content.
   * Merged with the built-in BrewSite + docs component map.
   * Consumer components override built-ins with the same name.
   */
  components?: Record<string, ComponentType<Record<string, unknown>>>;

  /**
   * Called when frontmatter is extracted from the MDX source.
   * Fires after compilation, before first render.
   */
  onFrontmatter?: (frontmatter: Record<string, unknown>) => void;

  /**
   * Called with extracted heading hierarchy for TOC generation.
   * Fires after compilation, before first render.
   */
  onToc?: (headings: TocEntry[]) => void;

  /**
   * Content to show during MDX compilation (~10-30ms).
   * Default: null (render nothing until ready).
   */
  placeholder?: ReactNode;

  /**
   * Content to show when MDX compilation fails.
   * Receives the compilation error.
   * Default: a styled error message with the error text.
   */
  errorFallback?: ComponentType<{ error: Error }>;

  /**
   * CSS class applied to the outer wrapper div.
   */
  className?: string;
}

/**
 * Internal cache entry stored by the compilation cache.
 */
export interface CacheEntry {
  /** The compiled React component. */
  Content: ComponentType<{ components?: Record<string, ComponentType> }>;
  /** Extracted frontmatter. */
  frontmatter: Record<string, unknown>;
  /** Extracted TOC. */
  toc: TocEntry[];
  /** Compilation timestamp (for LRU ordering). */
  timestamp: number;
}
